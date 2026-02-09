import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
type PerplexityConfig = {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
};
type PerplexityApiKeySource = "config" | "perplexity_env" | "openrouter_env" | "none";
type GrokConfig = {
    apiKey?: string;
    model?: string;
    inlineCitations?: boolean;
};
type PerplexityBaseUrlHint = "direct" | "openrouter";
declare function inferPerplexityBaseUrlFromApiKey(apiKey?: string): PerplexityBaseUrlHint | undefined;
declare function resolvePerplexityBaseUrl(perplexity?: PerplexityConfig, apiKeySource?: PerplexityApiKeySource, apiKey?: string): string;
declare function isDirectPerplexityBaseUrl(baseUrl: string): boolean;
declare function resolvePerplexityRequestModel(baseUrl: string, model: string): string;
declare function resolveGrokApiKey(grok?: GrokConfig): string | undefined;
declare function resolveGrokModel(grok?: GrokConfig): string;
declare function resolveGrokInlineCitations(grok?: GrokConfig): boolean;
declare function normalizeFreshness(value: string | undefined): string | undefined;
export declare function createWebSearchTool(options?: {
    config?: OpenClawConfig;
    sandboxed?: boolean;
}): AnyAgentTool | null;
export declare const __testing: {
    readonly inferPerplexityBaseUrlFromApiKey: typeof inferPerplexityBaseUrlFromApiKey;
    readonly resolvePerplexityBaseUrl: typeof resolvePerplexityBaseUrl;
    readonly isDirectPerplexityBaseUrl: typeof isDirectPerplexityBaseUrl;
    readonly resolvePerplexityRequestModel: typeof resolvePerplexityRequestModel;
    readonly normalizeFreshness: typeof normalizeFreshness;
    readonly resolveGrokApiKey: typeof resolveGrokApiKey;
    readonly resolveGrokModel: typeof resolveGrokModel;
    readonly resolveGrokInlineCitations: typeof resolveGrokInlineCitations;
};
export {};
