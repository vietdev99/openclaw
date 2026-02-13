import type { OpenClawConfig } from "../../config/config.js";
import { lookupContextTokens } from "../../agents/context.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../agents/defaults.js";
import { DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR } from "../../agents/pi-settings.js";
import { resolveFreshSessionTotalTokens, type SessionEntry } from "../../config/sessions.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";

export const DEFAULT_MEMORY_FLUSH_SOFT_TOKENS = 4000;

export const DEFAULT_MEMORY_FLUSH_PROMPT = [
  "Pre-compaction memory flush.",
  "Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed).",
  "IMPORTANT: If the file already exists, APPEND new content only and do not overwrite existing entries.",
  `If nothing to store, reply with ${SILENT_REPLY_TOKEN}.`,
].join(" ");

export const DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT = [
  "Pre-compaction memory flush turn.",
  "The session is near auto-compaction; capture durable memories to disk.",
  `You may reply, but usually ${SILENT_REPLY_TOKEN} is correct.`,
].join(" ");

export type MemoryFlushSettings = {
  enabled: boolean;
  softThresholdTokens: number;
  prompt: string;
  systemPrompt: string;
  reserveTokensFloor: number;
};

export const DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_PERCENT = 80;

export type ProactiveCompactionSettings = {
  enabled: boolean;
  thresholdPercent: number;
  contextWindowTokens: number;
};

const normalizeNonNegativeInt = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const int = Math.floor(value);
  return int >= 0 ? int : null;
};

export function resolveMemoryFlushSettings(cfg?: OpenClawConfig): MemoryFlushSettings | null {
  const defaults = cfg?.agents?.defaults?.compaction?.memoryFlush;
  const enabled = defaults?.enabled ?? true;
  if (!enabled) {
    return null;
  }
  const softThresholdTokens =
    normalizeNonNegativeInt(defaults?.softThresholdTokens) ?? DEFAULT_MEMORY_FLUSH_SOFT_TOKENS;
  const prompt = defaults?.prompt?.trim() || DEFAULT_MEMORY_FLUSH_PROMPT;
  const systemPrompt = defaults?.systemPrompt?.trim() || DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT;
  const reserveTokensFloor =
    normalizeNonNegativeInt(cfg?.agents?.defaults?.compaction?.reserveTokensFloor) ??
    DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR;

  return {
    enabled,
    softThresholdTokens,
    prompt: ensureNoReplyHint(prompt),
    systemPrompt: ensureNoReplyHint(systemPrompt),
    reserveTokensFloor,
  };
}

function ensureNoReplyHint(text: string): string {
  if (text.includes(SILENT_REPLY_TOKEN)) {
    return text;
  }
  return `${text}\n\nIf no user-visible reply is needed, start with ${SILENT_REPLY_TOKEN}.`;
}

export function resolveMemoryFlushContextWindowTokens(params: {
  modelId?: string;
  agentCfgContextTokens?: number;
}): number {
  return (
    lookupContextTokens(params.modelId) ?? params.agentCfgContextTokens ?? DEFAULT_CONTEXT_TOKENS
  );
}

export function shouldRunMemoryFlush(params: {
  entry?: Pick<
    SessionEntry,
    "totalTokens" | "totalTokensFresh" | "compactionCount" | "memoryFlushCompactionCount"
  >;
  contextWindowTokens: number;
  reserveTokensFloor: number;
  softThresholdTokens: number;
}): boolean {
  const totalTokens = resolveFreshSessionTotalTokens(params.entry);
  if (!totalTokens || totalTokens <= 0) {
    return false;
  }
  const contextWindow = Math.max(1, Math.floor(params.contextWindowTokens));
  const reserveTokens = Math.max(0, Math.floor(params.reserveTokensFloor));
  const softThreshold = Math.max(0, Math.floor(params.softThresholdTokens));
  const threshold = Math.max(0, contextWindow - reserveTokens - softThreshold);
  if (threshold <= 0) {
    return false;
  }
  if (totalTokens < threshold) {
    return false;
  }

  const compactionCount = params.entry?.compactionCount ?? 0;
  const lastFlushAt = params.entry?.memoryFlushCompactionCount;
  if (typeof lastFlushAt === "number" && lastFlushAt === compactionCount) {
    return false;
  }

  return true;
}

/**
 * Resolves proactive compaction settings from config.
 * Proactive compaction triggers BEFORE context overflow at a configured threshold (default 80%).
 */
export function resolveProactiveCompactionSettings(params: {
  cfg?: OpenClawConfig;
  modelId?: string;
  agentCfgContextTokens?: number;
}): ProactiveCompactionSettings {
  const compactionCfg = params.cfg?.agents?.defaults?.compaction;
  // Proactive compaction enabled by default
  const enabled = compactionCfg?.proactiveEnabled !== false;
  // Default threshold is 80% of context window
  const rawThreshold = compactionCfg?.proactiveThresholdPercent;
  let thresholdPercent = DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_PERCENT;
  if (typeof rawThreshold === "number" && Number.isFinite(rawThreshold)) {
    // Clamp between 50% and 95% (below 50% is too aggressive, above 95% is too late)
    thresholdPercent = Math.max(50, Math.min(95, Math.floor(rawThreshold)));
  }
  const contextWindowTokens = resolveMemoryFlushContextWindowTokens({
    modelId: params.modelId,
    agentCfgContextTokens: params.agentCfgContextTokens,
  });

  return {
    enabled,
    thresholdPercent,
    contextWindowTokens,
  };
}

/**
 * Determines if proactive compaction should run to prevent context overflow.
 * This triggers compaction BEFORE the context window is exceeded.
 */
export function shouldRunProactiveCompaction(params: {
  entry?: Pick<SessionEntry, "totalTokens" | "compactionCount">;
  settings: ProactiveCompactionSettings;
  /** Compaction count at which proactive compaction last ran for this session */
  lastProactiveCompactionCount?: number;
}): boolean {
  if (!params.settings.enabled) {
    return false;
  }
  const totalTokens = params.entry?.totalTokens;
  if (!totalTokens || totalTokens <= 0) {
    return false;
  }
  const contextWindow = params.settings.contextWindowTokens;
  if (contextWindow <= 0) {
    return false;
  }
  // Calculate threshold in tokens (e.g., 80% of 200K = 160K)
  const thresholdTokens = Math.floor(contextWindow * (params.settings.thresholdPercent / 100));
  if (totalTokens < thresholdTokens) {
    return false;
  }
  // Avoid running proactive compaction multiple times at the same compaction count
  const compactionCount = params.entry?.compactionCount ?? 0;
  if (
    typeof params.lastProactiveCompactionCount === "number" &&
    params.lastProactiveCompactionCount >= compactionCount
  ) {
    return false;
  }
  return true;
}
