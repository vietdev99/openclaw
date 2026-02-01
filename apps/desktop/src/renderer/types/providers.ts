/**
 * Provider Authentication Type Definitions
 * Defines the structure for authentication providers and their methods
 */

export type ProviderAuthKind =
  | 'oauth'        // Browser OAuth with callback server (Google, OpenAI)
  | 'api_key'      // Static API key input (most providers)
  | 'token'        // Token paste (Anthropic setup-token)
  | 'import'       // Import credentials from file (Claude CLI ~/.claude)
  | 'device_code'  // Device flow with QR code (GitHub, Qwen, MiniMax)
  | 'custom';      // Provider-specific (Copilot Proxy)

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'textarea';
  default?: string;
  placeholder?: string;
  validation?: (value: string) => boolean;
}

export interface AuthMethodDefinition {
  id: string;
  label: string;
  kind: ProviderAuthKind;
  hint?: string;
  instructions?: string;
  authUrl?: string;           // For oauth
  deviceCodeUrl?: string;     // For device_code
  customFields?: CustomField[]; // For custom
}

export interface ProviderDefinition {
  id: string;
  name: string;
  icon: React.ReactNode; // React icon component
  description: string;
  methods: AuthMethodDefinition[];
  tier?: 1 | 2 | 3 | 4; // For grouping/sorting
}

export interface AuthCredential {
  provider: string;
  type: 'api_key' | 'token' | 'oauth';
  key?: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}
