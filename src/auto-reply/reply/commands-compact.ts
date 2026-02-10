import type { OpenClawConfig } from "../../config/config.js";
import type { CommandHandler } from "./commands-types.js";
import {
  abortEmbeddedPiRun,
  compactEmbeddedPiSession,
  isEmbeddedPiRunActive,
  waitForEmbeddedPiRunEnd,
} from "../../agents/pi-embedded.js";
import { emergencyCompactSession } from "../../agents/emergency-compaction.js";
import { resolveSessionFilePath } from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import { formatContextUsageShort, formatTokenCount } from "../status.js";
import { stripMentions, stripStructuralPrefixes } from "./mentions.js";
import { incrementCompactionCount } from "./session-updates.js";

function extractCompactInstructions(params: {
  rawBody?: string;
  ctx: import("../templating.js").MsgContext;
  cfg: OpenClawConfig;
  agentId?: string;
  isGroup: boolean;
}): string | undefined {
  const raw = stripStructuralPrefixes(params.rawBody ?? "");
  const stripped = params.isGroup
    ? stripMentions(raw, params.ctx, params.cfg, params.agentId)
    : raw;
  const trimmed = stripped.trim();
  if (!trimmed) {
    return undefined;
  }
  const lowered = trimmed.toLowerCase();
  const prefix = lowered.startsWith("/compact") ? "/compact" : null;
  if (!prefix) {
    return undefined;
  }
  let rest = trimmed.slice(prefix.length).trimStart();
  if (rest.startsWith(":")) {
    rest = rest.slice(1).trimStart();
  }
  return rest.length ? rest : undefined;
}

export const handleCompactCommand: CommandHandler = async (params) => {
  const compactRequested =
    params.command.commandBodyNormalized === "/compact" ||
    params.command.commandBodyNormalized.startsWith("/compact ");
  if (!compactRequested) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /compact from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (!params.sessionEntry?.sessionId) {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Compaction unavailable (missing session id)." },
    };
  }
  const sessionId = params.sessionEntry.sessionId;
  if (isEmbeddedPiRunActive(sessionId)) {
    abortEmbeddedPiRun(sessionId);
    await waitForEmbeddedPiRunEnd(sessionId, 15_000);
  }
  const customInstructions = extractCompactInstructions({
    rawBody: params.ctx.CommandBody ?? params.ctx.RawBody ?? params.ctx.Body,
    ctx: params.ctx,
    cfg: params.cfg,
    agentId: params.agentId,
    isGroup: params.isGroup,
  });
  const result = await compactEmbeddedPiSession({
    sessionId,
    sessionKey: params.sessionKey,
    messageChannel: params.command.channel,
    groupId: params.sessionEntry.groupId,
    groupChannel: params.sessionEntry.groupChannel,
    groupSpace: params.sessionEntry.space,
    spawnedBy: params.sessionEntry.spawnedBy,
    sessionFile: resolveSessionFilePath(sessionId, params.sessionEntry),
    workspaceDir: params.workspaceDir,
    config: params.cfg,
    skillsSnapshot: params.sessionEntry.skillsSnapshot,
    provider: params.provider,
    model: params.model,
    thinkLevel: params.resolvedThinkLevel ?? (await params.resolveDefaultThinkingLevel()),
    bashElevated: {
      enabled: false,
      allowed: false,
      defaultLevel: "off",
    },
    customInstructions,
    senderIsOwner: params.command.senderIsOwner,
    ownerNumbers: params.command.ownerList.length > 0 ? params.command.ownerList : undefined,
  });

  const compactLabel = result.ok
    ? result.compacted
      ? result.result?.tokensBefore != null && result.result?.tokensAfter != null
        ? `Compacted (${formatTokenCount(result.result.tokensBefore)} → ${formatTokenCount(result.result.tokensAfter)})`
        : result.result?.tokensBefore
          ? `Compacted (${formatTokenCount(result.result.tokensBefore)} before)`
          : "Compacted"
      : "Compaction skipped"
    : "Compaction failed";
  if (result.ok && result.compacted) {
    await incrementCompactionCount({
      sessionEntry: params.sessionEntry,
      sessionStore: params.sessionStore,
      sessionKey: params.sessionKey,
      storePath: params.storePath,
      // Update token counts after compaction
      tokensAfter: result.result?.tokensAfter,
    });
  }
  // Use the post-compaction token count for context summary if available
  const tokensAfterCompaction = result.result?.tokensAfter;
  const totalTokens =
    tokensAfterCompaction ??
    params.sessionEntry.totalTokens ??
    (params.sessionEntry.inputTokens ?? 0) + (params.sessionEntry.outputTokens ?? 0);
  const contextSummary = formatContextUsageShort(
    totalTokens > 0 ? totalTokens : null,
    params.contextTokens ?? params.sessionEntry.contextTokens ?? null,
  );
  const reason = result.reason?.trim();
  const line = reason
    ? `${compactLabel}: ${reason} • ${contextSummary}`
    : `${compactLabel} • ${contextSummary}`;
  enqueueSystemEvent(line, { sessionKey: params.sessionKey });
  return { shouldContinue: false, reply: { text: `⚙️ ${line}` } };
};

/**
 * Handler for /compact:emergency command.
 *
 * Used when a session has exceeded the context window and normal compaction
 * would fail. This splits the session into chunks, summarizes each separately,
 * and creates a new compact session.
 */
export const handleEmergencyCompactCommand: CommandHandler = async (params) => {
  const emergencyRequested =
    params.command.commandBodyNormalized === "/compact:emergency" ||
    params.command.commandBodyNormalized.startsWith("/compact:emergency ");
  if (!emergencyRequested) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /compact:emergency from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (!params.sessionEntry?.sessionId) {
    return {
      shouldContinue: false,
      reply: { text: "🚨 Emergency compaction unavailable (missing session id)." },
    };
  }

  const sessionId = params.sessionEntry.sessionId;

  // Abort any running agent
  if (isEmbeddedPiRunActive(sessionId)) {
    abortEmbeddedPiRun(sessionId);
    await waitForEmbeddedPiRunEnd(sessionId, 15_000);
  }

  const sessionFile = resolveSessionFilePath(sessionId, params.sessionEntry);
  if (!sessionFile) {
    return {
      shouldContinue: false,
      reply: { text: "🚨 Emergency compaction failed: cannot resolve session file." },
    };
  }

  // Notify user that emergency compaction is starting
  enqueueSystemEvent(
    `Emergency compaction starting for session ${params.sessionKey ?? sessionId}...`,
    { sessionKey: params.sessionKey },
  );

  try {
    const result = await emergencyCompactSession({
      sessionId,
      sessionKey: params.sessionKey,
      sessionFile,
      workspaceDir: params.workspaceDir,
      config: params.cfg,
      provider: params.provider,
      model: params.model,
      keepBackup: true,
    });

    if (!result.ok) {
      const errorMsg = result.error ?? "Unknown error";
      const line = `Emergency compaction failed: ${errorMsg}`;
      if (result.backupPath) {
        enqueueSystemEvent(`Backup saved at: ${result.backupPath}`, {
          sessionKey: params.sessionKey,
        });
      }
      enqueueSystemEvent(line, { sessionKey: params.sessionKey });
      return {
        shouldContinue: false,
        reply: { text: `🚨 ${line}` },
      };
    }

    // Success
    const tokensBefore = result.tokensBefore ?? 0;
    const tokensAfter = result.tokensAfter ?? 0;
    const chunks = result.chunksProcessed ?? 0;
    const line =
      `Emergency compaction complete: ` +
      `${formatTokenCount(tokensBefore)} → ${formatTokenCount(tokensAfter)} ` +
      `(${chunks} chunks processed)`;

    if (result.backupPath) {
      enqueueSystemEvent(`Backup saved at: ${result.backupPath}`, {
        sessionKey: params.sessionKey,
      });
    }

    // Update session metadata
    await incrementCompactionCount({
      sessionEntry: params.sessionEntry,
      sessionStore: params.sessionStore,
      sessionKey: params.sessionKey,
      storePath: params.storePath,
      tokensAfter,
    });

    enqueueSystemEvent(line, { sessionKey: params.sessionKey });
    return {
      shouldContinue: false,
      reply: { text: `✅ ${line}` },
    };
  } catch (err) {
    const errorMsg = String(err);
    const line = `Emergency compaction crashed: ${errorMsg}`;
    enqueueSystemEvent(line, { sessionKey: params.sessionKey });
    return {
      shouldContinue: false,
      reply: { text: `🚨 ${line}` },
    };
  }
};
