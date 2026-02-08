// Auth profile types matching auth-profiles.json

export interface AuthProfileStore {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  usageStats?: Record<string, ProfileUsageStats>;
}

export type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;

export interface ApiKeyCredential {
  type: "api_key";
  provider: string;
  key: string;
  email?: string;
}

export interface TokenCredential {
  type: "token";
  provider: string;
  token: string;
  expires?: number;
  email?: string;
}

export interface OAuthCredential {
  type: "oauth";
  provider: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId?: string;
  projectId?: string;
  email?: string;
  picture?: string;
}

export interface ProfileUsageStats {
  lastUsed?: number;
  cooldownUntil?: number;
  disabledUntil?: number;
  disabledReason?: "auth" | "format" | "rate_limit" | "billing" | "timeout" | "unknown";
  errorCount?: number;
  failureCounts?: Partial<Record<string, number>>;
  lastFailureAt?: number;
}

// Provider status for UI display
export type ProviderStatus = "healthy" | "warning" | "error" | "unknown";

// Auth type for providers
export type ProviderAuthType = "api_key" | "token" | "oauth" | "cli";

export interface ProviderMeta {
  name: string;
  icon: string;
  authType: ProviderAuthType;
}

export interface ProviderInfo {
  id: string;
  name: string;
  icon?: string;
  authType?: ProviderAuthType;
  profiles: AuthProfileCredential[];
  models: { id: string; name: string }[];
  status: ProviderStatus;
  lastUsed?: number;
  activeProfileId?: string;
  profileStrategy?: "failover" | "loadbalance";
  disabledProfiles?: Set<string>;
}

// Known providers metadata
export const PROVIDER_METADATA: Record<string, ProviderMeta> = {
  anthropic: { name: "Anthropic", icon: "anthropic", authType: "cli" },
  google: { name: "Google AI", icon: "google", authType: "api_key" },
  openai: { name: "OpenAI", icon: "openai", authType: "api_key" },
  github: { name: "GitHub Copilot", icon: "github", authType: "token" },
  "mixed-agent-proxy": { name: "Mixed Agent Proxy", icon: "server", authType: "api_key" },
  antigravity: { name: "Antigravity", icon: "cloud", authType: "oauth" },
  ollama: { name: "Ollama", icon: "terminal", authType: "api_key" },
};
