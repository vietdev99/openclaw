import { create } from "zustand";
import type {
  AuthProfileStore,
  AuthProfileCredential,
  ProviderInfo,
  ProviderStatus,
  ProviderAuthType,
} from "@/types/auth";
import type { OpenClawConfig, AuthProfileConfig } from "@/types/config";
import { PROVIDER_METADATA } from "@/types/auth";

interface AuthState {
  // From auth-profiles.json (credentials)
  profileStore: AuthProfileStore | null;

  // From config (profile metadata)
  profileConfigs: Record<string, AuthProfileConfig>;

  // Models per provider (from models.providers[id].models)
  providerModels: Record<string, { id: string; name: string }[]>;

  // Derived
  providers: ProviderInfo[];

  // Actions
  setProfileStore: (store: AuthProfileStore) => void;
  setProfileConfigs: (configs: Record<string, AuthProfileConfig>) => void;
  setProviderModels: (models: Record<string, { id: string; name: string }[]>) => void;
  computeProviders: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profileStore: null,
  profileConfigs: {},
  providerModels: {},
  providers: [],

  setProfileStore: (store) => {
    set({ profileStore: store });
    get().computeProviders();
  },

  setProfileConfigs: (configs) => {
    set({ profileConfigs: configs });
    get().computeProviders();
  },

  setProviderModels: (models) => {
    set({ providerModels: models });
    get().computeProviders();
  },

  computeProviders: () => {
    const { profileStore, profileConfigs } = get();
    if (!profileStore) {
      set({ providers: [] });
      return;
    }

    // Group profiles by provider
    const providerMap = new Map<string, AuthProfileCredential[]>();

    for (const [profileId, credential] of Object.entries(profileStore.profiles)) {
      const provider = credential.provider;
      if (!providerMap.has(provider)) {
        providerMap.set(provider, []);
      }
      providerMap
        .get(provider)!
        .push({ ...credential, id: profileId } as AuthProfileCredential & { id: string });
    }

    // Also add providers from config that might not have credentials yet
    for (const [, config] of Object.entries(profileConfigs)) {
      const provider = config.provider;
      if (!providerMap.has(provider)) {
        providerMap.set(provider, []);
      }
    }

    // Build provider info list
    const providers: ProviderInfo[] = [];

    for (const [providerId, profiles] of providerMap) {
      const usageStats = profileStore.usageStats ?? {};
      const lastGood = profileStore.lastGood?.[providerId];

      // Determine status
      let status: ProviderStatus = "unknown";
      let lastUsed: number | undefined;

      if (profiles.length === 0) {
        status = "error"; // No credentials
      } else {
        // Check profiles for status
        let hasHealthy = false;
        let hasWarning = false;

        for (const profile of profiles) {
          const profileId = (profile as AuthProfileCredential & { id: string }).id;
          const stats = usageStats[profileId];

          if (stats?.lastUsed) {
            lastUsed = Math.max(lastUsed ?? 0, stats.lastUsed);
          }

          if (stats?.cooldownUntil && stats.cooldownUntil > Date.now()) {
            hasWarning = true;
          } else if (stats?.disabledUntil && stats.disabledUntil > Date.now()) {
            hasWarning = true;
          } else {
            hasHealthy = true;
          }
        }

        if (hasHealthy) {
          status = "healthy";
        } else if (hasWarning) {
          status = "warning";
        } else {
          status = "unknown";
        }
      }

      providers.push({
        id: providerId,
        name: getProviderName(providerId),
        icon: getProviderIcon(providerId),
        authType: getProviderAuthType(providerId),
        profiles,
        models: get().providerModels[providerId] ?? [],
        status,
        lastUsed,
        activeProfileId: lastGood,
      });
    }

    // Sort: healthy first, then warning, then error, then unknown
    providers.sort((a, b) => {
      const order = { healthy: 0, warning: 1, error: 2, unknown: 3 };
      return order[a.status] - order[b.status];
    });

    set({ providers });
  },
}));

function getProviderName(providerId: string): string {
  return PROVIDER_METADATA[providerId]?.name ?? providerId;
}

function getProviderIcon(providerId: string): string {
  return PROVIDER_METADATA[providerId]?.icon ?? "server";
}

function getProviderAuthType(providerId: string): ProviderAuthType {
  return PROVIDER_METADATA[providerId]?.authType ?? "api_key";
}

// Helper to extract auth data from config
export function extractAuthFromConfig(config: OpenClawConfig): Record<string, AuthProfileConfig> {
  return config.auth?.profiles ?? {};
}
