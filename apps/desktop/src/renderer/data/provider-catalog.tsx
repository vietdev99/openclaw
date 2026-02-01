/**
 * Provider Catalog
 * Currently focused on Anthropic and Mixed Agent providers
 */

import { ProviderDefinition } from '../types/providers';
import {
  ClaudeIcon,
  MixedAgentIcon
} from '../components/BrandIcons';

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: <ClaudeIcon size={24} />,
    description: 'Claude Sonnet, Opus, Haiku',
    tier: 1,
    methods: [
      {
        id: 'apiKey',
        label: 'API Key',
        kind: 'api_key',
        hint: 'From console.anthropic.com',
        instructions: 'Get your API key from https://console.anthropic.com/settings/keys'
      },
      {
        id: 'import-claude-cli',
        label: 'Import from ~/.claude',
        kind: 'import',
        hint: 'Automatically read token from Claude CLI',
        instructions: 'This will read your authentication token from ~/.claude directory if you have Claude CLI installed'
      }
    ]
  },
  {
    id: 'mixed-agent',
    name: 'Mixed Agent',
    icon: <MixedAgentIcon size={24} />,
    description: 'Multi-model AI proxy service',
    tier: 1,
    methods: [
      {
        id: 'api-key-url',
        label: 'API Key + Proxy URL',
        kind: 'custom',
        hint: 'API key and proxy base URL',
        instructions: 'Enter your API key and the base URL of your proxy server',
        customFields: [
          {
            id: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'sk-ant-...',
          },
          {
            id: 'baseUrl',
            label: 'Proxy Base URL',
            type: 'url',
            default: 'https://antigravity.vollx.com/v1',
            placeholder: 'https://your-proxy.com/v1',
          }
        ]
      }
    ]
  }
];

/**
 * Get provider by ID
 */
export function getProviderById(id: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find(p => p.id === id);
}

/**
 * Get providers by tier
 */
export function getProvidersByTier(tier: number): ProviderDefinition[] {
  return PROVIDER_CATALOG.filter(p => p.tier === tier);
}

/**
 * Get all tier 1 (major) providers
 */
export function getMajorProviders(): ProviderDefinition[] {
  return getProvidersByTier(1);
}
