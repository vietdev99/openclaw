import type { MsgContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveSessionAgentId,
  resolveAgentSkillsFilter,
} from "../../agents/agent-scope.js";
import { resolveModelRefFromString } from "../../agents/model-selection.js";
import { resolveAgentTimeoutMs } from "../../agents/timeout.js";
import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../../agents/workspace.js";
import { type OpenClawConfig, loadConfig } from "../../config/config.js";
import { applyLinkUnderstanding } from "../../link-understanding/apply.js";
import { applyMediaUnderstanding } from "../../media-understanding/apply.js";
import { defaultRuntime } from "../../runtime.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";
import {
  shouldUseDeferredProcessing,
  startDeferredAudioProcessing,
} from "../../media-understanding/deferred-reply.js";
import { logInfo } from "../../logger.js";
import { resolveDefaultModel } from "./directive-handling.js";
import { resolveReplyDirectives } from "./get-reply-directives.js";
import { handleInlineActions } from "./get-reply-inline-actions.js";
import { runPreparedReply } from "./get-reply-run.js";
import { finalizeInboundContext } from "./inbound-context.js";
import { applyResetModelOverride } from "./session-reset-model.js";
import { initSessionState } from "./session.js";
import { stageSandboxMedia } from "./stage-sandbox-media.js";
import { createTypingController } from "./typing.js";

function mergeSkillFilters(channelFilter?: string[], agentFilter?: string[]): string[] | undefined {
  const normalize = (list?: string[]) => {
    if (!Array.isArray(list)) {
      return undefined;
    }
    return list.map((entry) => String(entry).trim()).filter(Boolean);
  };
  const channel = normalize(channelFilter);
  const agent = normalize(agentFilter);
  if (!channel && !agent) {
    return undefined;
  }
  if (!channel) {
    return agent;
  }
  if (!agent) {
    return channel;
  }
  if (channel.length === 0 || agent.length === 0) {
    return [];
  }
  const agentSet = new Set(agent);
  return channel.filter((name) => agentSet.has(name));
}

export async function getReplyFromConfig(
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: OpenClawConfig,
): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  const isFastTestEnv = process.env.OPENCLAW_TEST_FAST === "1";
  const cfg = configOverride ?? loadConfig();
  const targetSessionKey =
    ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
  const agentSessionKey = targetSessionKey || ctx.SessionKey;
  const agentId = resolveSessionAgentId({
    sessionKey: agentSessionKey,
    config: cfg,
  });
  const mergedSkillFilter = mergeSkillFilters(
    opts?.skillFilter,
    resolveAgentSkillsFilter(cfg, agentId),
  );
  const resolvedOpts =
    mergedSkillFilter !== undefined ? { ...opts, skillFilter: mergedSkillFilter } : opts;
  const agentCfg = cfg.agents?.defaults;
  const sessionCfg = cfg.session;
  const { defaultProvider, defaultModel, aliasIndex } = resolveDefaultModel({
    cfg,
    agentId,
  });
  let provider = defaultProvider;
  let model = defaultModel;
  if (opts?.isHeartbeat) {
    const heartbeatRaw = agentCfg?.heartbeat?.model?.trim() ?? "";
    const heartbeatRef = heartbeatRaw
      ? resolveModelRefFromString({
          raw: heartbeatRaw,
          defaultProvider,
          aliasIndex,
        })
      : null;
    if (heartbeatRef) {
      provider = heartbeatRef.ref.provider;
      model = heartbeatRef.ref.model;
    }
  }

  const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, agentId) ?? DEFAULT_AGENT_WORKSPACE_DIR;
  const workspace = await ensureAgentWorkspace({
    dir: workspaceDirRaw,
    ensureBootstrapFiles: !agentCfg?.skipBootstrap && !isFastTestEnv,
  });
  const workspaceDir = workspace.dir;
  const agentDir = resolveAgentDir(cfg, agentId);
  const timeoutMs = resolveAgentTimeoutMs({ cfg });
  const configuredTypingSeconds =
    agentCfg?.typingIntervalSeconds ?? sessionCfg?.typingIntervalSeconds;
  const typingIntervalSeconds =
    typeof configuredTypingSeconds === "number" ? configuredTypingSeconds : 6;
  const typing = createTypingController({
    onReplyStart: opts?.onReplyStart,
    typingIntervalSeconds,
    silentToken: SILENT_REPLY_TOKEN,
    log: defaultRuntime.log,
  });
  opts?.onTypingController?.(typing);

  const finalized = finalizeInboundContext(ctx);

  // Check if transcript already exists (from deferred callback) - skip media understanding
  const hasTranscript = Boolean(finalized.Transcript);

  if (!isFastTestEnv) {
    // Check if we should use deferred processing for audio
    // Skip if this is already a deferred reply callback (Transcript already set)
    const skipDeferred = hasTranscript || opts?.skipDeferredProcessing;
    if (!skipDeferred && shouldUseDeferredProcessing(finalized, cfg)) {
      const channelType = String(finalized.OriginatingChannel ?? finalized.Provider ?? "telegram");
      const channelId = finalized.OriginatingTo ?? finalized.To ?? "";
      const messageId = finalized.MessageSid ?? "";
      const sessionKey = finalized.SessionKey ?? "";

      if (channelId && sessionKey) {
        logInfo(`[DEFERRED] Starting deferred audio processing for session ${sessionKey}`);

        const result = await startDeferredAudioProcessing({
          ctx: finalized,
          cfg,
          channelType,
          channelId,
          messageId,
          sessionKey,
          runTranscription: async () => {
            // Run only audio transcription
            const mediaResult = await applyMediaUnderstanding({
              ctx: finalized,
              cfg,
              agentDir,
              activeModel: { provider, model },
            });
            // Return the audio transcription output if any
            const audioOutput = mediaResult.outputs.find((o) => o.kind === "audio.transcription");
            return audioOutput ?? null;
          },
          onReplyReady: async (transcript, deferredCtx) => {
            logInfo(`[DEFERRED] onReplyReady called with transcript: "${transcript.substring(0, 100)}..."`);
            logInfo(`[DEFERRED] deferredCtx.Body: "${deferredCtx.Body?.substring(0, 100)}..."`);
            logInfo(`[DEFERRED] deferredCtx.Transcript: "${deferredCtx.Transcript?.substring(0, 100)}..."`);

            // Capture text from block replies (AI may send via tool)
            const capturedTexts: string[] = [];

            // Get the AI reply with the transcript already populated
            // Note: We don't pass onReplyStart to avoid creating a typing loop
            // since we're running in background and placeholder was already sent
            const replyResult = await getReplyFromConfig(deferredCtx, {
              ...opts,
              skipDeferredProcessing: true,
              // Disable typing for background processing - placeholder already sent
              onReplyStart: undefined,
              onTypingController: undefined,
              // Capture block replies to get text sent via message tool
              onBlockReply: async (payload) => {
                logInfo(`[DEFERRED] onBlockReply received: text="${payload.text?.substring(0, 100)}..." mediaUrl=${payload.mediaUrl ?? "none"}`);
                if (payload.text?.trim()) {
                  capturedTexts.push(payload.text);
                }
              },
            }, configOverride);

            logInfo(`[DEFERRED] AI call complete: capturedTexts.length=${capturedTexts.length}`);
            logInfo(`[DEFERRED] replyResult type=${Array.isArray(replyResult) ? "array" : typeof replyResult}, text="${(Array.isArray(replyResult) ? replyResult[0]?.text : replyResult?.text)?.substring(0, 100) ?? "empty"}..."`);

            // Use captured block reply text if available, otherwise use return value
            if (capturedTexts.length > 0) {
              const result = capturedTexts.join("\n");
              logInfo(`[DEFERRED] Returning capturedTexts: "${result.substring(0, 100)}..."`);
              return result;
            }

            // Fallback: Extract text from reply
            if (Array.isArray(replyResult)) {
              const result = replyResult.map((r) => r.text ?? "").join("\n");
              logInfo(`[DEFERRED] Returning array result: "${result.substring(0, 100)}..."`);
              return result;
            }
            const result = replyResult?.text ?? "";
            logInfo(`[DEFERRED] Returning single result: "${result.substring(0, 100)}..."`);
            return result;
          },
        });

        // Cleanup typing controller since we're returning early
        // The background task has its own typing lifecycle
        typing.cleanup();

        // Return a special "deferred" response indicating the task was started
        return {
          text: "", // Empty text - placeholder already sent
          channelData: {
            deferred: true,
            taskId: result.taskId,
            placeholderSent: result.placeholderSent,
          },
        };
      }
    }

    // Normal synchronous processing
    // Skip media understanding if transcript already exists (from deferred callback)
    if (!hasTranscript) {
      await applyMediaUnderstanding({
        ctx: finalized,
        cfg,
        agentDir,
        activeModel: { provider, model },
      });
      await applyLinkUnderstanding({
        ctx: finalized,
        cfg,
      });
    } else {
      logInfo(`[DEFERRED] Skipping media understanding - transcript already exists`);
    }
  }

  const commandAuthorized = finalized.CommandAuthorized;
  resolveCommandAuthorization({
    ctx: finalized,
    cfg,
    commandAuthorized,
  });
  const sessionState = await initSessionState({
    ctx: finalized,
    cfg,
    commandAuthorized,
  });
  let {
    sessionCtx,
    sessionEntry,
    previousSessionEntry,
    sessionStore,
    sessionKey,
    sessionId,
    isNewSession,
    resetTriggered,
    systemSent,
    abortedLastRun,
    storePath,
    sessionScope,
    groupResolution,
    isGroup,
    triggerBodyNormalized,
    bodyStripped,
  } = sessionState;

  await applyResetModelOverride({
    cfg,
    resetTriggered,
    bodyStripped,
    sessionCtx,
    ctx: finalized,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    defaultProvider,
    defaultModel,
    aliasIndex,
  });

  const directiveResult = await resolveReplyDirectives({
    ctx: finalized,
    cfg,
    agentId,
    agentDir,
    workspaceDir,
    agentCfg,
    sessionCtx,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    sessionScope,
    groupResolution,
    isGroup,
    triggerBodyNormalized,
    commandAuthorized,
    defaultProvider,
    defaultModel,
    aliasIndex,
    provider,
    model,
    typing,
    opts: resolvedOpts,
    skillFilter: mergedSkillFilter,
  });
  if (directiveResult.kind === "reply") {
    return directiveResult.reply;
  }

  let {
    commandSource,
    command,
    allowTextCommands,
    skillCommands,
    directives,
    cleanedBody,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    defaultActivation,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    execOverrides,
    blockStreamingEnabled,
    blockReplyChunking,
    resolvedBlockStreamingBreak,
    provider: resolvedProvider,
    model: resolvedModel,
    modelState,
    contextTokens,
    inlineStatusRequested,
    directiveAck,
    perMessageQueueMode,
    perMessageQueueOptions,
  } = directiveResult.result;
  provider = resolvedProvider;
  model = resolvedModel;

  const inlineActionResult = await handleInlineActions({
    ctx,
    sessionCtx,
    cfg,
    agentId,
    agentDir,
    sessionEntry,
    previousSessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    sessionScope,
    workspaceDir,
    isGroup,
    opts: resolvedOpts,
    typing,
    allowTextCommands,
    inlineStatusRequested,
    command,
    skillCommands,
    directives,
    cleanedBody,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    defaultActivation: () => defaultActivation,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    resolveDefaultThinkingLevel: modelState.resolveDefaultThinkingLevel,
    provider,
    model,
    contextTokens,
    directiveAck,
    abortedLastRun,
    skillFilter: mergedSkillFilter,
  });
  if (inlineActionResult.kind === "reply") {
    return inlineActionResult.reply;
  }
  directives = inlineActionResult.directives;
  abortedLastRun = inlineActionResult.abortedLastRun ?? abortedLastRun;

  await stageSandboxMedia({
    ctx,
    sessionCtx,
    cfg,
    sessionKey,
    workspaceDir,
  });

  return runPreparedReply({
    ctx,
    sessionCtx,
    cfg,
    agentId,
    agentDir,
    agentCfg,
    sessionCfg,
    commandAuthorized,
    command,
    commandSource,
    allowTextCommands,
    directives,
    defaultActivation,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    execOverrides,
    elevatedEnabled,
    elevatedAllowed,
    blockStreamingEnabled,
    blockReplyChunking,
    resolvedBlockStreamingBreak,
    modelState,
    provider,
    model,
    perMessageQueueMode,
    perMessageQueueOptions,
    typing,
    opts: resolvedOpts,
    defaultProvider,
    defaultModel,
    timeoutMs,
    isNewSession,
    resetTriggered,
    systemSent,
    sessionEntry,
    sessionStore,
    sessionKey,
    sessionId,
    storePath,
    workspaceDir,
    abortedLastRun,
  });
}
