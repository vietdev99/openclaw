import crypto from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import type { TemplateContext } from "../templating.js";
import type { VerboseLevel } from "../thinking.js";
import type { GetReplyOptions } from "../types.js";
import type { FollowupRun } from "./queue.js";
import { resolveAgentModelFallbacksOverride } from "../../agents/agent-scope.js";
import { runWithModelFallback } from "../../agents/model-fallback.js";
import { isCliProvider } from "../../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { compactEmbeddedPiSession } from "../../agents/pi-embedded-runner.js";
import { resolveSandboxConfigForAgent, resolveSandboxRuntimeStatus } from "../../agents/sandbox.js";
import {
  resolveAgentIdFromSessionKey,
  type SessionEntry,
  updateSessionStoreEntry,
} from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { registerAgentRunContext } from "../../infra/agent-events.js";
import { buildThreadingToolContext, resolveEnforceFinalTag } from "./agent-runner-utils.js";
import {
  resolveMemoryFlushContextWindowTokens,
  resolveMemoryFlushSettings,
  resolveProactiveCompactionSettings,
  shouldRunMemoryFlush,
  shouldRunProactiveCompaction,
} from "./memory-flush.js";
import { incrementCompactionCount } from "./session-updates.js";

export async function runMemoryFlushIfNeeded(params: {
  cfg: OpenClawConfig;
  followupRun: FollowupRun;
  sessionCtx: TemplateContext;
  opts?: GetReplyOptions;
  defaultModel: string;
  agentCfgContextTokens?: number;
  resolvedVerboseLevel: VerboseLevel;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  isHeartbeat: boolean;
}): Promise<SessionEntry | undefined> {
  let activeSessionEntry = params.sessionEntry;
  const activeSessionStore = params.sessionStore;

  // === PROACTIVE COMPACTION ===
  // Trigger compaction BEFORE context overflow at configured threshold (default 80%)
  // This prevents the dead loop where both memory flush and compaction fail due to overflow
  const proactiveSettings = resolveProactiveCompactionSettings({
    cfg: params.cfg,
    modelId: params.followupRun.run.model ?? params.defaultModel,
    agentCfgContextTokens: params.agentCfgContextTokens,
  });

  const currentEntry =
    activeSessionEntry ??
    (params.sessionKey ? activeSessionStore?.[params.sessionKey] : undefined);

  const needsProactiveCompaction =
    !params.isHeartbeat &&
    !isCliProvider(params.followupRun.run.provider, params.cfg) &&
    shouldRunProactiveCompaction({
      entry: currentEntry,
      settings: proactiveSettings,
      lastProactiveCompactionCount: currentEntry?.compactionCount,
    });

  // Track if proactive compaction ran - if so, skip memory flush to avoid consuming the session turn
  let proactiveCompactionRan = false;

  if (needsProactiveCompaction) {
    const thresholdPct = proactiveSettings.thresholdPercent;
    const totalTokens = currentEntry?.totalTokens ?? 0;
    const contextWindow = proactiveSettings.contextWindowTokens;
    logVerbose(
      `[proactive-compaction] triggering at ${thresholdPct}% threshold ` +
        `(tokens=${totalTokens}/${contextWindow}, session=${params.sessionKey})`,
    );

    try {
      const compactResult = await compactEmbeddedPiSession({
        sessionId: params.followupRun.run.sessionId,
        sessionKey: params.sessionKey,
        messageChannel: params.sessionCtx.Provider?.trim().toLowerCase() || undefined,
        messageProvider: params.sessionCtx.Provider?.trim().toLowerCase() || undefined,
        agentAccountId: params.sessionCtx.AccountId,
        authProfileId: params.followupRun.run.authProfileId,
        sessionFile: params.followupRun.run.sessionFile,
        workspaceDir: params.followupRun.run.workspaceDir,
        agentDir: params.followupRun.run.agentDir,
        config: params.followupRun.run.config,
        skillsSnapshot: params.followupRun.run.skillsSnapshot,
        provider: params.followupRun.run.provider,
        model: params.followupRun.run.model,
        thinkLevel: params.followupRun.run.thinkLevel,
        reasoningLevel: params.followupRun.run.reasoningLevel,
        bashElevated: params.followupRun.run.bashElevated,
        extraSystemPrompt: params.followupRun.run.extraSystemPrompt,
        ownerNumbers: params.followupRun.run.ownerNumbers,
      });

      if (compactResult.compacted) {
        logVerbose(
          `[proactive-compaction] succeeded (tokensBefore=${compactResult.result?.tokensBefore}, ` +
            `tokensAfter=${compactResult.result?.tokensAfter}, session=${params.sessionKey})`,
        );
        // Mark proactive compaction as ran - skip memory flush to let user's message be processed
        proactiveCompactionRan = true;
        // Increment compaction count
        const nextCount = await incrementCompactionCount({
          sessionEntry: activeSessionEntry,
          sessionStore: activeSessionStore,
          sessionKey: params.sessionKey,
          storePath: params.storePath,
        });
        if (typeof nextCount === "number" && activeSessionEntry) {
          activeSessionEntry = { ...activeSessionEntry, compactionCount: nextCount };
        }
      } else {
        logVerbose(
          `[proactive-compaction] skipped: ${compactResult.reason ?? "nothing to compact"} ` +
            `(session=${params.sessionKey})`,
        );
      }
    } catch (err) {
      logVerbose(`[proactive-compaction] failed: ${String(err)} (session=${params.sessionKey})`);
    }
  }

  // === MEMORY FLUSH ===
  // Skip memory flush if proactive compaction just ran - we need to let the user's actual message be processed
  if (proactiveCompactionRan) {
    logVerbose(
      `[memory-flush] skipping: proactive compaction already ran this turn (session=${params.sessionKey})`,
    );
    return activeSessionEntry;
  }

  const memoryFlushSettings = resolveMemoryFlushSettings(params.cfg);
  if (!memoryFlushSettings) {
    return activeSessionEntry;
  }

  const memoryFlushWritable = (() => {
    if (!params.sessionKey) {
      return true;
    }
    const runtime = resolveSandboxRuntimeStatus({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
    });
    if (!runtime.sandboxed) {
      return true;
    }
    const sandboxCfg = resolveSandboxConfigForAgent(params.cfg, runtime.agentId);
    return sandboxCfg.workspaceAccess === "rw";
  })();

  const shouldFlushMemory =
    memoryFlushSettings &&
    memoryFlushWritable &&
    !params.isHeartbeat &&
    !isCliProvider(params.followupRun.run.provider, params.cfg) &&
    shouldRunMemoryFlush({
      entry:
        activeSessionEntry ??
        (params.sessionKey ? activeSessionStore?.[params.sessionKey] : undefined),
      contextWindowTokens: resolveMemoryFlushContextWindowTokens({
        modelId: params.followupRun.run.model ?? params.defaultModel,
        agentCfgContextTokens: params.agentCfgContextTokens,
      }),
      reserveTokensFloor: memoryFlushSettings.reserveTokensFloor,
      softThresholdTokens: memoryFlushSettings.softThresholdTokens,
    });

  if (!shouldFlushMemory) {
    return activeSessionEntry;
  }

  const flushRunId = crypto.randomUUID();
  if (params.sessionKey) {
    registerAgentRunContext(flushRunId, {
      sessionKey: params.sessionKey,
      verboseLevel: params.resolvedVerboseLevel,
    });
  }
  let memoryCompactionCompleted = false;
  const flushSystemPrompt = [
    params.followupRun.run.extraSystemPrompt,
    memoryFlushSettings.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    await runWithModelFallback({
      cfg: params.followupRun.run.config,
      provider: params.followupRun.run.provider,
      model: params.followupRun.run.model,
      agentDir: params.followupRun.run.agentDir,
      fallbacksOverride: resolveAgentModelFallbacksOverride(
        params.followupRun.run.config,
        resolveAgentIdFromSessionKey(params.followupRun.run.sessionKey),
      ),
      run: (provider, model) => {
        const authProfileId =
          provider === params.followupRun.run.provider
            ? params.followupRun.run.authProfileId
            : undefined;
        return runEmbeddedPiAgent({
          sessionId: params.followupRun.run.sessionId,
          sessionKey: params.sessionKey,
          agentId: params.followupRun.run.agentId,
          messageProvider: params.sessionCtx.Provider?.trim().toLowerCase() || undefined,
          agentAccountId: params.sessionCtx.AccountId,
          messageTo: params.sessionCtx.OriginatingTo ?? params.sessionCtx.To,
          messageThreadId: params.sessionCtx.MessageThreadId ?? undefined,
          // Provider threading context for tool auto-injection
          ...buildThreadingToolContext({
            sessionCtx: params.sessionCtx,
            config: params.followupRun.run.config,
            hasRepliedRef: params.opts?.hasRepliedRef,
          }),
          senderId: params.sessionCtx.SenderId?.trim() || undefined,
          senderName: params.sessionCtx.SenderName?.trim() || undefined,
          senderUsername: params.sessionCtx.SenderUsername?.trim() || undefined,
          senderE164: params.sessionCtx.SenderE164?.trim() || undefined,
          sessionFile: params.followupRun.run.sessionFile,
          workspaceDir: params.followupRun.run.workspaceDir,
          agentDir: params.followupRun.run.agentDir,
          config: params.followupRun.run.config,
          skillsSnapshot: params.followupRun.run.skillsSnapshot,
          prompt: memoryFlushSettings.prompt,
          extraSystemPrompt: flushSystemPrompt,
          ownerNumbers: params.followupRun.run.ownerNumbers,
          enforceFinalTag: resolveEnforceFinalTag(params.followupRun.run, provider),
          provider,
          model,
          authProfileId,
          authProfileIdSource: authProfileId
            ? params.followupRun.run.authProfileIdSource
            : undefined,
          thinkLevel: params.followupRun.run.thinkLevel,
          verboseLevel: params.followupRun.run.verboseLevel,
          reasoningLevel: params.followupRun.run.reasoningLevel,
          execOverrides: params.followupRun.run.execOverrides,
          bashElevated: params.followupRun.run.bashElevated,
          timeoutMs: params.followupRun.run.timeoutMs,
          runId: flushRunId,
          onAgentEvent: (evt) => {
            if (evt.stream === "compaction") {
              const phase = typeof evt.data.phase === "string" ? evt.data.phase : "";
              const willRetry = Boolean(evt.data.willRetry);
              if (phase === "end" && !willRetry) {
                memoryCompactionCompleted = true;
              }
            }
          },
        });
      },
    });
    let memoryFlushCompactionCount =
      activeSessionEntry?.compactionCount ??
      (params.sessionKey ? activeSessionStore?.[params.sessionKey]?.compactionCount : 0) ??
      0;
    if (memoryCompactionCompleted) {
      const nextCount = await incrementCompactionCount({
        sessionEntry: activeSessionEntry,
        sessionStore: activeSessionStore,
        sessionKey: params.sessionKey,
        storePath: params.storePath,
      });
      if (typeof nextCount === "number") {
        memoryFlushCompactionCount = nextCount;
      }
    }
    if (params.storePath && params.sessionKey) {
      try {
        const updatedEntry = await updateSessionStoreEntry({
          storePath: params.storePath,
          sessionKey: params.sessionKey,
          update: async () => ({
            memoryFlushAt: Date.now(),
            memoryFlushCompactionCount,
          }),
        });
        if (updatedEntry) {
          activeSessionEntry = updatedEntry;
        }
      } catch (err) {
        logVerbose(`failed to persist memory flush metadata: ${String(err)}`);
      }
    }
  } catch (err) {
    logVerbose(`memory flush run failed: ${String(err)}`);
  }

  return activeSessionEntry;
}
