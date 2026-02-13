import type { OpenClawConfig } from "../../config/config.js";
import { type SessionEntry } from "../../config/sessions.js";
export declare const DEFAULT_MEMORY_FLUSH_SOFT_TOKENS = 4000;
export declare const DEFAULT_MEMORY_FLUSH_PROMPT: string;
export declare const DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT: string;
export type MemoryFlushSettings = {
    enabled: boolean;
    softThresholdTokens: number;
    prompt: string;
    systemPrompt: string;
    reserveTokensFloor: number;
};
export declare const DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_PERCENT = 80;
export type ProactiveCompactionSettings = {
    enabled: boolean;
    thresholdPercent: number;
    contextWindowTokens: number;
};
export declare function resolveMemoryFlushSettings(cfg?: OpenClawConfig): MemoryFlushSettings | null;
export declare function resolveMemoryFlushContextWindowTokens(params: {
    modelId?: string;
    agentCfgContextTokens?: number;
}): number;
export declare function shouldRunMemoryFlush(params: {
    entry?: Pick<SessionEntry, "totalTokens" | "totalTokensFresh" | "compactionCount" | "memoryFlushCompactionCount">;
    contextWindowTokens: number;
    reserveTokensFloor: number;
    softThresholdTokens: number;
}): boolean;
/**
 * Resolves proactive compaction settings from config.
 * Proactive compaction triggers BEFORE context overflow at a configured threshold (default 80%).
 */
export declare function resolveProactiveCompactionSettings(params: {
    cfg?: OpenClawConfig;
    modelId?: string;
    agentCfgContextTokens?: number;
}): ProactiveCompactionSettings;
/**
 * Determines if proactive compaction should run to prevent context overflow.
 * This triggers compaction BEFORE the context window is exceeded.
 */
export declare function shouldRunProactiveCompaction(params: {
    entry?: Pick<SessionEntry, "totalTokens" | "compactionCount">;
    settings: ProactiveCompactionSettings;
    /** Compaction count at which proactive compaction last ran for this session */
    lastProactiveCompactionCount?: number;
}): boolean;
