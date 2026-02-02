/**
 * Background processor for long-running media understanding tasks.
 * Handles async audio/video transcription with progress updates and deferred replies.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { MsgContext } from "../auto-reply/templating.js";
import { logInfo, logWarn, logError } from "../logger.js";
import {
  type PendingMediaTask,
  getPendingTask,
  updateTaskStatus,
  deletePendingTask,
} from "./pending-tasks.js";
import { emitMediaEvent } from "./media-events.js";
import { editChannelMessage, sendChannelMessage } from "./channel-messenger.js";
import type { MediaUnderstandingOutput } from "./types.js";

const PLACEHOLDER_MESSAGES: Record<string, string> = {
  audio: "🎵 Đang xử lý audio...",
  image: "🖼️ Đang xử lý hình ảnh...",
  video: "🎬 Đang xử lý video...",
};

export type BackgroundProcessorParams = {
  taskId: string;
  cfg: OpenClawConfig;
  ctx: MsgContext;
  runTranscription: () => Promise<MediaUnderstandingOutput | null>;
  onComplete?: (task: PendingMediaTask, result: MediaUnderstandingOutput | null) => Promise<void>;
};

/**
 * Send a placeholder message and start background processing.
 * Returns immediately after sending placeholder.
 */
export async function startBackgroundProcessing(
  params: BackgroundProcessorParams,
): Promise<{ placeholderSent: boolean; error?: string }> {
  const { taskId, cfg } = params;
  const task = getPendingTask(taskId);

  if (!task) {
    return { placeholderSent: false, error: "Task not found" };
  }

  // Send placeholder message
  const placeholderText = PLACEHOLDER_MESSAGES[task.capability] || "⏳ Đang xử lý...";
  const sendResult = await sendChannelMessage({
    channelType: task.channelType,
    channelId: task.channelId,
    text: placeholderText,
    replyToMessageId: task.messageId,
    cfg,
  });

  if (!sendResult.ok) {
    logWarn(`Failed to send placeholder for task ${taskId}: ${sendResult.error}`);
    return { placeholderSent: false, error: sendResult.error };
  }

  // Save placeholder message ID for later editing
  updateTaskStatus(taskId, "processing", {
    placeholderMessageId: sendResult.messageId,
  });

  logInfo(`Background processing started for task ${taskId}, placeholder: ${sendResult.messageId}`);

  // Emit processing event
  emitMediaEvent({
    type: "processing",
    taskId,
    channelId: task.channelId,
    channelType: task.channelType,
    messageId: task.messageId,
    sessionKey: task.sessionKey,
    capability: task.capability,
  });

  // Start background processing (don't await)
  runBackgroundTask(params).catch((err) => {
    logError(`Background task ${taskId} failed: ${err}`);
  });

  return { placeholderSent: true };
}

async function runBackgroundTask(params: BackgroundProcessorParams): Promise<void> {
  const { taskId, cfg, runTranscription, onComplete } = params;
  const task = getPendingTask(taskId);

  if (!task) {
    return;
  }

  try {
    // Run the actual transcription
    const result = await runTranscription();

    // Update task status
    updateTaskStatus(taskId, "complete", { result: result ?? undefined });

    // Emit complete event
    emitMediaEvent({
      type: "complete",
      taskId,
      channelId: task.channelId,
      channelType: task.channelType,
      messageId: task.messageId,
      sessionKey: task.sessionKey,
      capability: task.capability,
      result: result ?? undefined,
    });

    logInfo(`Background task ${taskId} completed`);

    // Call completion handler if provided
    if (onComplete) {
      const updatedTask = getPendingTask(taskId);
      if (updatedTask) {
        await onComplete(updatedTask, result);
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update task status
    updateTaskStatus(taskId, "failed", { error: errorMsg });

    // Emit failed event
    emitMediaEvent({
      type: "failed",
      taskId,
      channelId: task.channelId,
      channelType: task.channelType,
      messageId: task.messageId,
      sessionKey: task.sessionKey,
      capability: task.capability,
      error: errorMsg,
    });

    logError(`Background task ${taskId} failed: ${errorMsg}`);

    // Edit placeholder to show error
    const updatedTask = getPendingTask(taskId);
    if (updatedTask?.placeholderMessageId) {
      await editChannelMessage({
        channelType: updatedTask.channelType,
        channelId: updatedTask.channelId,
        messageId: updatedTask.placeholderMessageId,
        text: `❌ Lỗi xử lý ${task.capability}: ${errorMsg}`,
        cfg,
      });
    }
  }
}

/**
 * Update the placeholder message with progress.
 */
export async function updateBackgroundProgress(
  taskId: string,
  progress: number,
  cfg: OpenClawConfig,
): Promise<void> {
  const task = getPendingTask(taskId);
  if (!task?.placeholderMessageId) {
    return;
  }

  updateTaskStatus(taskId, "processing", { progress });

  // Emit progress event
  emitMediaEvent({
    type: "progress",
    taskId,
    channelId: task.channelId,
    channelType: task.channelType,
    messageId: task.messageId,
    sessionKey: task.sessionKey,
    capability: task.capability,
    progress,
  });

  const placeholderText = PLACEHOLDER_MESSAGES[task.capability] || "⏳ Đang xử lý...";
  await editChannelMessage({
    channelType: task.channelType,
    channelId: task.channelId,
    messageId: task.placeholderMessageId,
    text: `${placeholderText} (${progress}%)`,
    cfg,
  });
}

/**
 * Edit the placeholder message with the final result.
 */
export async function finishBackgroundTask(
  taskId: string,
  finalText: string,
  cfg: OpenClawConfig,
): Promise<{ ok: boolean; error?: string }> {
  const task = getPendingTask(taskId);
  if (!task?.placeholderMessageId) {
    // Fallback: send new message
    return await sendChannelMessage({
      channelType: task?.channelType ?? "telegram",
      channelId: task?.channelId ?? "",
      text: finalText,
      cfg,
    });
  }

  const editResult = await editChannelMessage({
    channelType: task.channelType,
    channelId: task.channelId,
    messageId: task.placeholderMessageId,
    text: finalText,
    cfg,
  });

  // Cleanup task after completion
  deletePendingTask(taskId);

  return editResult;
}
