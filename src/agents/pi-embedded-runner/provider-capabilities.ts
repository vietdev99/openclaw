/**
 * Provider Capability Detection
 *
 * Determines which providers support native tool_calls vs requiring XML parsing.
 * Also tracks other provider-specific capabilities.
 */

export interface ProviderCapabilities {
  /** Provider supports native tool_calls in API */
  supportsNativeToolCalls: boolean;
  /** Provider supports streaming responses */
  supportsStreaming: boolean;
  /** Provider supports system messages */
  supportsSystemMessages: boolean;
  /** Provider supports images in messages */
  supportsImages: boolean;
  /** XML tool format if native not supported */
  xmlToolFormat?: "anthropic" | "openai" | "generic";
  /** Message format expected by provider */
  messageFormat: "anthropic" | "openai" | "gemini" | "generic";
  /** Whether to use XML tool parsing for this provider */
  useXmlToolParsing: boolean;
}

// Known provider capabilities
const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  // Native Anthropic API
  anthropic: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "anthropic",
    useXmlToolParsing: false,
  },

  // Native OpenAI API
  openai: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "openai",
    useXmlToolParsing: false,
  },

  // Google Gemini/Vertex AI
  google: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "gemini",
    useXmlToolParsing: false,
  },
  gemini: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "gemini",
    useXmlToolParsing: false,
  },
  vertex: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "gemini",
    useXmlToolParsing: false,
  },

  // Antigravity proxy - OpenAI-compatible but may not support native tool_calls
  antigravity: {
    supportsNativeToolCalls: false, // Uses XML in text responses
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    xmlToolFormat: "anthropic",
    messageFormat: "openai",
    useXmlToolParsing: true,
  },

  // OpenRouter - usually supports native tool_calls
  openrouter: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    messageFormat: "openai",
    useXmlToolParsing: false,
  },

  // Together AI
  together: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: false,
    messageFormat: "openai",
    useXmlToolParsing: false,
  },

  // Groq
  groq: {
    supportsNativeToolCalls: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: false,
    messageFormat: "openai",
    useXmlToolParsing: false,
  },

  // Ollama - may need XML depending on model
  ollama: {
    supportsNativeToolCalls: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: true,
    xmlToolFormat: "generic",
    messageFormat: "openai",
    useXmlToolParsing: true,
  },

  // LM Studio - typically no native tool support
  lmstudio: {
    supportsNativeToolCalls: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: false,
    xmlToolFormat: "generic",
    messageFormat: "openai",
    useXmlToolParsing: true,
  },

  // Generic OpenAI-compatible proxy
  "openai-compatible": {
    supportsNativeToolCalls: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsImages: false,
    xmlToolFormat: "generic",
    messageFormat: "openai",
    useXmlToolParsing: true,
  },
};

// Default capabilities for unknown providers
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsNativeToolCalls: false,
  supportsStreaming: true,
  supportsSystemMessages: true,
  supportsImages: false,
  xmlToolFormat: "generic",
  messageFormat: "openai",
  useXmlToolParsing: true,
};

/**
 * Get capabilities for a provider by ID
 */
export function getProviderCapabilities(
  providerId: string
): ProviderCapabilities {
  const normalized = providerId.toLowerCase().trim();

  // Check for exact match
  if (PROVIDER_CAPABILITIES[normalized]) {
    return PROVIDER_CAPABILITIES[normalized];
  }

  // Check for partial matches
  for (const [key, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return caps;
    }
  }

  return DEFAULT_CAPABILITIES;
}

/**
 * Check if a provider requires XML tool parsing
 */
export function requiresXmlToolParsing(providerId: string): boolean {
  return getProviderCapabilities(providerId).useXmlToolParsing;
}

/**
 * Check if a provider supports native tool calls
 */
export function supportsNativeToolCalls(providerId: string): boolean {
  return getProviderCapabilities(providerId).supportsNativeToolCalls;
}

/**
 * Override capabilities for a specific provider
 */
export function setProviderCapabilities(
  providerId: string,
  capabilities: Partial<ProviderCapabilities>
): void {
  const normalized = providerId.toLowerCase().trim();
  const existing = PROVIDER_CAPABILITIES[normalized] ?? DEFAULT_CAPABILITIES;
  PROVIDER_CAPABILITIES[normalized] = { ...existing, ...capabilities };
}

/**
 * Get all registered provider IDs
 */
export function getRegisteredProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES);
}

/**
 * Detect provider from model ID string
 * Format: "provider/model" or "provider:model"
 */
export function detectProviderFromModelId(modelId: string): string | null {
  if (!modelId) return null;

  // Check for provider/model format
  const slashIndex = modelId.indexOf("/");
  if (slashIndex > 0) {
    return modelId.slice(0, slashIndex).toLowerCase();
  }

  // Check for provider:model format
  const colonIndex = modelId.indexOf(":");
  if (colonIndex > 0) {
    return modelId.slice(0, colonIndex).toLowerCase();
  }

  // Try to detect from model name patterns
  const lower = modelId.toLowerCase();

  if (lower.includes("claude") || lower.includes("anthropic")) {
    return "anthropic";
  }
  if (lower.includes("gpt") || lower.includes("o1") || lower.includes("o3")) {
    return "openai";
  }
  if (lower.includes("gemini") || lower.includes("palm")) {
    return "google";
  }
  if (lower.includes("llama") || lower.includes("mistral") || lower.includes("mixtral")) {
    // Could be various providers, return generic
    return "openai-compatible";
  }

  return null;
}

/**
 * Determine if XML tool parsing should be used for a given model/provider combo
 */
export function shouldUseXmlToolParsing(
  modelId: string,
  providerId?: string
): boolean {
  // If provider explicitly given, use its settings
  if (providerId) {
    return requiresXmlToolParsing(providerId);
  }

  // Try to detect provider from model ID
  const detectedProvider = detectProviderFromModelId(modelId);
  if (detectedProvider) {
    return requiresXmlToolParsing(detectedProvider);
  }

  // Default to XML parsing for safety
  return true;
}
