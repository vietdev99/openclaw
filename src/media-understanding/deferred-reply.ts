/**
 * Deferred reply handling for long-running media processing.
 *
 * When audio/video transcription takes too long, instead of blocking:
 * 1. Send a placeholder message immediately
 * 2. Run transcription in background
 * 3. When done, edit placeholder with AI response
 */

import type { OpenClawConfig } from "../config/config.js";
import type { MsgContext } from "../auto-reply/templating.js";
import { logInfo, logError } from "../logger.js";
import { logVerbose } from "../globals.js";
import { loadConfig } from "../config/config.js";
import {
  type PendingMediaTask,
  createPendingTask,
  getPendingTask,
  deletePendingTask,
} from "./pending-tasks.js";
import {
  startBackgroundProcessing,
  finishBackgroundTask,
} from "./background-processor.js";
import { deleteChannelMessage } from "./channel-messenger.js";
import type { MediaUnderstandingOutput } from "./types.js";

export type DeferredReplyConfig = {
  /** Enable async mode for audio processing */
  asyncAudioEnabled: boolean;
  /** Estimated threshold in seconds to switch to async mode */
  asyncThresholdSeconds: number;
};

const DEFAULT_CONFIG: DeferredReplyConfig = {
  asyncAudioEnabled: false,
  asyncThresholdSeconds: 30,
};

/**
 * Resolve deferred reply config from OpenClawConfig.
 */
export function resolveDeferredReplyConfig(cfg: OpenClawConfig): DeferredReplyConfig {
  const audioConfig = cfg.tools?.media?.audio;
  return {
    asyncAudioEnabled: (audioConfig as Record<string, unknown>)?.asyncMode === true,
    asyncThresholdSeconds:
      typeof (audioConfig as Record<string, unknown>)?.asyncThresholdSeconds === "number"
        ? ((audioConfig as Record<string, unknown>).asyncThresholdSeconds as number)
        : DEFAULT_CONFIG.asyncThresholdSeconds,
  };
}

/**
 * Check if we should use deferred processing for audio.
 */
export function shouldUseDeferredProcessing(
  ctx: MsgContext,
  cfg: OpenClawConfig,
): boolean {
  const config = resolveDeferredReplyConfig(cfg);

  // Debug: Log deferred processing check
  logVerbose(`[DEFERRED] asyncAudioEnabled=${config.asyncAudioEnabled}`);

  if (!config.asyncAudioEnabled) {
    logVerbose(`[DEFERRED] skipped: asyncMode not enabled`);
    return false;
  }

  // Check if there are audio attachments via MediaTypes or MediaUrls
  const mediaTypes = ctx.MediaTypes ?? [];
  const mediaUrls = ctx.MediaUrls ?? [];
  const mediaPaths = ctx.MediaPaths ?? [];

  // Debug: Log media context
  logVerbose(`[DEFERRED] MediaTypes=${JSON.stringify(mediaTypes)}`);
  logVerbose(`[DEFERRED] MediaUrls=${JSON.stringify(mediaUrls)}`);
  logVerbose(`[DEFERRED] MediaPaths=${JSON.stringify(mediaPaths)}`);
  logVerbose(`[DEFERRED] Body=${ctx.Body?.substring(0, 100)}`);

  if (mediaTypes.length === 0 && mediaUrls.length === 0) {
    logVerbose(`[DEFERRED] skipped: no media types or urls`);
    return false;
  }

  // Check MediaTypes for audio indicators
  const hasAudioType = mediaTypes.some((type) => {
    const t = type?.toLowerCase() ?? "";
    return t === "audio" || t === "voice" || t.startsWith("audio/");
  });

  // Check MediaUrls for audio file extensions
  const hasAudioUrl = mediaUrls.some((url) => {
    const u = url?.toLowerCase() ?? "";
    return (
      u.endsWith(".ogg") ||
      u.endsWith(".oga") ||
      u.endsWith(".mp3") ||
      u.endsWith(".wav") ||
      u.endsWith(".m4a") ||
      u.endsWith(".opus") ||
      u.includes("voice") ||
      u.includes("audio")
    );
  });

  // Check MediaPaths for audio file extensions
  const hasAudioPath = mediaPaths.some((p) => {
    const u = p?.toLowerCase() ?? "";
    return (
      u.endsWith(".ogg") ||
      u.endsWith(".oga") ||
      u.endsWith(".mp3") ||
      u.endsWith(".wav") ||
      u.endsWith(".m4a") ||
      u.endsWith(".opus")
    );
  });

  const result = hasAudioType || hasAudioUrl || hasAudioPath;
  logVerbose(`[DEFERRED] hasAudioType=${hasAudioType}, hasAudioUrl=${hasAudioUrl}, hasAudioPath=${hasAudioPath}, result=${result}`);

  return result;
}

export type StartDeferredAudioParams = {
  ctx: MsgContext;
  cfg: OpenClawConfig;
  channelType: string;
  channelId: string;
  messageId: string;
  sessionKey: string;
  runTranscription: () => Promise<MediaUnderstandingOutput | null>;
  onReplyReady: (transcript: string, ctx: MsgContext) => Promise<string>;
};

/**
 * Start deferred audio processing.
 *
 * 1. Creates a pending task
 * 2. Sends placeholder message
 * 3. Runs transcription in background
 * 4. Calls onReplyReady when done to get AI response
 * 5. Edits placeholder with final response
 */
export async function startDeferredAudioProcessing(
  params: StartDeferredAudioParams,
): Promise<{ taskId: string; placeholderSent: boolean }> {
  const {
    ctx,
    cfg,
    channelType,
    channelId,
    messageId,
    sessionKey,
    runTranscription,
    onReplyReady,
  } = params;

  // Create pending task
  const task = createPendingTask({
    channelId,
    channelType,
    messageId,
    sessionKey,
    capability: "audio",
  });

  logInfo(`Created deferred audio task ${task.id} for session ${sessionKey}`);

  // Start background processing
  const result = await startBackgroundProcessing({
    taskId: task.id,
    cfg,
    ctx,
    runTranscription,
    onComplete: async (completedTask, transcriptionResult) => {
      await handleDeferredCompletion(completedTask, transcriptionResult, ctx, cfg, onReplyReady);
    },
  });

  return {
    taskId: task.id,
    placeholderSent: result.placeholderSent,
  };
}

async function handleDeferredCompletion(
  task: PendingMediaTask,
  result: MediaUnderstandingOutput | null,
  originalCtx: MsgContext,
  cfg: OpenClawConfig,
  onReplyReady: (transcript: string, ctx: MsgContext) => Promise<string>,
): Promise<void> {
  const transcript = result?.text?.trim() ?? "";

  logInfo(`[DEFERRED] handleDeferredCompletion: task=${task.id}, transcript="${transcript.substring(0, 100)}..."`);

  if (!transcript) {
    logError(`Deferred task ${task.id} completed but no transcript`);
    await finishBackgroundTask(
      task.id,
      "❌ Không thể xử lý audio. Vui lòng thử lại.",
      cfg,
    );
    return;
  }

  try {
    // Create new context with transcript
    const ctx: MsgContext = {
      ...originalCtx,
      Transcript: transcript,
      Body: transcript,
      CommandBody: transcript,
      RawBody: transcript,
    };

    logInfo(`[DEFERRED] Calling onReplyReady with transcript...`);

    // Get AI reply - AI will send message directly via message tool
    // The returned string may be empty if AI sent via tool
    const aiReply = await onReplyReady(transcript, ctx);

    logInfo(`[DEFERRED] onReplyReady returned: "${aiReply.substring(0, 100)}..."`);

    // Strategy:
    // - If AI returned text, edit placeholder with that text
    // - If AI returned empty (sent via message tool), delete placeholder
    if (aiReply.trim()) {
      logInfo(`[DEFERRED] Editing placeholder with AI reply`);
      await finishBackgroundTask(task.id, aiReply, cfg);
    } else {
      logInfo(`[DEFERRED] AI sent directly via tool, deleting placeholder`);
      await deletePlaceholder(task, cfg);
    }

    logInfo(`Deferred task ${task.id} completed successfully`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logError(`Failed to generate deferred reply for task ${task.id}: ${errorMsg}`);

    await finishBackgroundTask(
      task.id,
      `❌ Lỗi xử lý: ${errorMsg}`,
      cfg,
    );
  }
}

/**
 * Delete the placeholder message when AI has sent reply directly.
 */
async function deletePlaceholder(
  task: PendingMediaTask,
  cfg: OpenClawConfig,
): Promise<void> {
  const updatedTask = getPendingTask(task.id);
  if (!updatedTask?.placeholderMessageId) {
    logVerbose(`[DEFERRED] No placeholder to delete for task ${task.id}`);
    deletePendingTask(task.id);
    return;
  }

  const result = await deleteChannelMessage({
    channelType: updatedTask.channelType,
    channelId: updatedTask.channelId,
    messageId: updatedTask.placeholderMessageId,
    cfg,
  });

  if (result.ok) {
    logInfo(`[DEFERRED] Deleted placeholder message ${updatedTask.placeholderMessageId}`);
  } else {
    logVerbose(`[DEFERRED] Failed to delete placeholder: ${result.error}`);
  }

  deletePendingTask(task.id);
}

/**
 * Check if a session has pending deferred tasks.
 */
export function hasPendingDeferredTasks(sessionKey: string): boolean {
  const { getPendingTasksBySession } = require("./pending-tasks.js");
  const tasks = getPendingTasksBySession(sessionKey);
  return tasks.length > 0;
}
