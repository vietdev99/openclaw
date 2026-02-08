import { Shield, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthProfileStore, AuthProfileCredential } from "@/types/auth";
import { AddProviderModal } from "@/components/providers/AddProviderModal";
import { CliInitModal } from "@/components/providers/CliInitModal";
import { OAuthEditModal } from "@/components/providers/OAuthEditModal";
import { ProfileModal, type ProfileFormData } from "@/components/providers/ProfileModal";
import { ProviderGrid } from "@/components/providers/ProviderGrid";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/lib/gateway-context";
import { initiateAntigravityOAuth } from "@/lib/oauth/antigravity";
import { useAuthStore, extractAuthFromConfig } from "@/lib/stores/auth-store";
import {
  useConfigStore,
  loadConfig,
  applyPendingChanges,
  reloadGateway,
} from "@/lib/stores/config-store";
import { PROVIDER_METADATA } from "@/types/auth";

export function Providers() {
  const { connected, request } = useGateway();
  const { snapshot, loading, hasPendingChanges, pendingChanges, addPendingChange, saving } =
    useConfigStore();
  const { providers, setProfileStore, setProfileConfigs, setProviderModels } = useAuthStore();

  // Modal states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [addProviderModalOpen, setAddProviderModalOpen] = useState(false);
  const [cliInitModalOpen, setCliInitModalOpen] = useState(false);
  const [cliInitProviderId, setCliInitProviderId] = useState<string | null>(null);
  const [oauthEditModalOpen, setOAuthEditModalOpen] = useState(false);
  const [oauthEditProvider, setOAuthEditProvider] = useState<{
    providerId: string;
    accessToken: string;
    email?: string;
  } | null>(null);
  const [editingProfile, setEditingProfile] = useState<{
    providerId: string;
    profile?: AuthProfileCredential & { id: string };
    mode: "add" | "edit";
  } | null>(null);

  // Load config on mount
  useEffect(() => {
    if (connected && !snapshot) {
      loadConfig(request).catch(console.error);
    }
  }, [connected, request, snapshot]);

  // Extract auth profiles from config when loaded
  useEffect(() => {
    if (snapshot?.config) {
      const authConfigs = extractAuthFromConfig(snapshot.config);
      setProfileConfigs(authConfigs);

      // Create profile store from config providers
      const mockStore: AuthProfileStore = {
        version: 1,
        profiles: {},
        lastGood: {},
        usageStats: {},
      };

      const modelProviders = snapshot.config.models?.providers ?? {};

      // Map config provider IDs to UI provider IDs where they differ
      // Note: 'antigravity' stays as 'antigravity' — it's the OAuth-based Antigravity provider
      const providerIdMap: Record<string, string> = {
        // Add mappings here if config key differs from UI provider ID
      };

      // Track which providers already have profiles (to avoid duplicates)
      const providersWithProfiles = new Set<string>();

      // 1. Create profiles from models.providers (inline apiKey)
      for (const [configProviderId, providerConfig] of Object.entries(modelProviders)) {
        // Map provider ID if needed
        const providerId = providerIdMap[configProviderId] ?? configProviderId;

        if (providerConfig.apiKey) {
          const profileId = `${providerId}:default`;
          mockStore.profiles[profileId] = {
            type: "api_key",
            provider: providerId,
            key: providerConfig.apiKey,
          };
          mockStore.lastGood![providerId] = profileId;
          mockStore.usageStats![profileId] = {
            lastUsed: Date.now() - Math.random() * 3600000,
            errorCount: 0,
          };
          providersWithProfiles.add(providerId);
        }
      }

      // 2. Create profiles from auth.profiles config section
      // These are providers using the auth profile system (e.g. Anthropic with multiple API keys)
      for (const [profileId, profileConfig] of Object.entries(authConfigs)) {
        const providerId = profileConfig.provider;

        // Skip if this provider already has an inline apiKey profile from models.providers
        // But do NOT skip additional auth profiles for the same provider (multi-account support)
        if (providersWithProfiles.has(providerId) && mockStore.profiles[profileId]) continue;

        // Look up the apiKey from models.providers as fallback display
        const configProviderId =
          Object.entries(providerIdMap).find(([, v]) => v === providerId)?.[0] ?? providerId;
        const providerApiKey = modelProviders[configProviderId]?.apiKey;

        const credential: AuthProfileCredential =
          profileConfig.mode === "oauth"
            ? {
                type: "oauth" as const,
                provider: providerId,
                accessToken: "",
                refreshToken: providerApiKey || "",
                expiresAt: 0,
                email: profileConfig.email,
              }
            : {
                type: "api_key" as const,
                provider: providerId,
                key: providerApiKey || "••••••••••••",
                email: profileConfig.email,
              };
        mockStore.profiles[profileId] = credential;

        if (!mockStore.lastGood![providerId]) {
          mockStore.lastGood![providerId] = profileId;
        }
        mockStore.usageStats![profileId] = {
          lastUsed: Date.now() - Math.random() * 3600000,
          errorCount: 0,
        };
      }

      setProfileStore(mockStore);

      // 3. Extract models per provider
      const modelsMap: Record<string, { id: string; name: string }[]> = {};
      for (const [configProviderId, providerConfig] of Object.entries(modelProviders)) {
        const providerId = providerIdMap[configProviderId] ?? configProviderId;
        if (providerConfig.models && providerConfig.models.length > 0) {
          modelsMap[providerId] = providerConfig.models.map((m) => ({
            id: m.id,
            name: m.name,
          }));
        }
      }
      setProviderModels(modelsMap);

      // Also fetch models from gateway catalog for plugin providers (e.g. google-antigravity)
      if (connected) {
        request<{ models: Array<{ id: string; name: string; provider: string }> }>(
          "models.list",
          {},
        )
          .then((res) => {
            if (!res?.models) return;
            const merged = { ...modelsMap };
            for (const model of res.models) {
              if (!merged[model.provider]) {
                merged[model.provider] = [];
              }
              // Only add if not already present
              if (!merged[model.provider].some((m) => m.id === model.id)) {
                merged[model.provider].push({ id: model.id, name: model.name || model.id });
              }
            }
            setProviderModels(merged);
          })
          .catch(console.error);
      }
    }
  }, [snapshot, setProfileConfigs, setProfileStore, setProviderModels, connected, request]);

  const handleEditProfile = (providerId: string, profileId: string) => {
    // CLI providers (Anthropic) — open CLI init modal
    const meta = PROVIDER_METADATA[providerId];
    if (meta?.authType === "cli") {
      setCliInitProviderId(providerId);
      setCliInitModalOpen(true);
      return;
    }

    // OAuth providers (Antigravity) — open OAuth edit modal
    if (meta?.authType === "oauth") {
      const provider = providers.find((p) => p.id === providerId);
      const profile = provider?.profiles[0];
      const token = profile && "key" in profile ? profile.key : "";
      setOAuthEditProvider({
        providerId,
        accessToken: token,
        email: profile && "email" in profile ? profile.email : undefined,
      });
      setOAuthEditModalOpen(true);
      return;
    }

    const provider = providers.find((p) => p.id === providerId);
    const profile = provider?.profiles.find(
      (p) => (p as AuthProfileCredential & { id: string }).id === profileId,
    ) as (AuthProfileCredential & { id: string }) | undefined;

    if (profile) {
      setEditingProfile({ providerId, profile, mode: "edit" });
      setProfileModalOpen(true);
    }
  };

  const handleDeleteProfile = async (providerId: string, _profileId: string) => {
    const providerName = PROVIDER_METADATA[providerId]?.name ?? providerId;
    if (!confirm(`Are you sure you want to delete "${providerName}" credentials?`)) return;
    if (!snapshot?.config || !snapshot.hash) return;

    try {
      // Build a JSON Merge Patch: set keys to null to delete them
      // This avoids re-serializing the entire config (which causes type coercion bugs)
      const patch: Record<string, unknown> = {};

      // 1. Remove from models.providers
      if (snapshot.config.models?.providers?.[providerId]) {
        patch.models = {
          providers: { [providerId]: null },
        };
      }

      // 2. Remove matching auth.profiles entries
      const authProfilesNulls: Record<string, null> = {};
      if (snapshot.config.auth?.profiles) {
        for (const [profileKey, profile] of Object.entries(snapshot.config.auth.profiles)) {
          if ((profile as { provider?: string }).provider === providerId) {
            authProfilesNulls[profileKey] = null;
          }
        }
      }

      // 3. Remove from auth.order
      const authOrderNulls: Record<string, null> = {};
      if ((snapshot.config.auth as { order?: Record<string, unknown> })?.order?.[providerId]) {
        authOrderNulls[providerId] = null;
      }

      if (Object.keys(authProfilesNulls).length > 0 || Object.keys(authOrderNulls).length > 0) {
        patch.auth = {
          ...(Object.keys(authProfilesNulls).length > 0 ? { profiles: authProfilesNulls } : {}),
          ...(Object.keys(authOrderNulls).length > 0 ? { order: authOrderNulls } : {}),
        };
      }

      // 4. Clean up agents.defaults referencing the deleted provider
      const agentsPatch: Record<string, unknown> = {};
      const defaultsPatch: Record<string, unknown> = {};

      // Clean agents.defaults.models entries
      const modelsNulls: Record<string, null> = {};
      if (snapshot.config.agents?.defaults?.models) {
        for (const modelKey of Object.keys(snapshot.config.agents.defaults.models)) {
          if (modelKey.startsWith(`${providerId}/`)) {
            modelsNulls[modelKey] = null;
          }
        }
      }
      if (Object.keys(modelsNulls).length > 0) {
        defaultsPatch.models = modelsNulls;
      }

      // Clean agents.defaults.model.primary
      const modelConfig = snapshot.config.agents?.defaults?.model;
      if (modelConfig && typeof modelConfig === "object") {
        const mc = modelConfig as { primary?: string; fallbacks?: string[] };
        if (mc.primary?.startsWith(`${providerId}/`)) {
          defaultsPatch.model = { ...mc, primary: "" };
        }
        if (mc.fallbacks?.some((fb) => fb.startsWith(`${providerId}/`))) {
          const existing = (defaultsPatch.model as Record<string, unknown>) ?? { ...mc };
          existing.fallbacks = (mc.fallbacks ?? []).filter(
            (fb) => !fb.startsWith(`${providerId}/`),
          );
          defaultsPatch.model = existing;
        }
      }

      // Clean agents.defaults.imageModel.primary
      const imgModel = snapshot.config.agents?.defaults?.imageModel;
      if (imgModel && typeof imgModel === "object") {
        const im = imgModel as { primary?: string };
        if (im.primary?.startsWith(`${providerId}/`)) {
          defaultsPatch.imageModel = { ...imgModel, primary: "" };
        }
      }

      if (Object.keys(defaultsPatch).length > 0) {
        agentsPatch.defaults = defaultsPatch;
        patch.agents = agentsPatch;
      }

      console.log("[DeleteProvider] Sending patch:", JSON.stringify(patch));

      // Send as config.patch (only changed keys, avoids serialization type bugs)
      await request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash: snapshot.hash,
      });

      // Gateway will restart after config change — just reload the page
      // to reconnect cleanly instead of trying to call loadConfig during restart
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      // Ignore "gateway not connected" since it means the patch succeeded
      // and the gateway is restarting
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("gateway not connected") || msg.includes("not connected")) {
        setTimeout(() => window.location.reload(), 2000);
        return;
      }
      console.error("Failed to delete provider:", err);
      alert(`Failed to delete provider: ${msg}`);
    }
  };

  const handleAddProfile = (providerId: string) => {
    const meta = PROVIDER_METADATA[providerId];
    if (meta?.authType === "oauth") {
      initiateAntigravityOAuth();
      return;
    }
    if (meta?.authType === "cli") {
      setCliInitProviderId(providerId);
      setCliInitModalOpen(true);
      return;
    }

    // Single credential per provider: if already has one, switch to edit mode
    const provider = providers.find((p) => p.id === providerId);
    if (provider && provider.profiles.length > 0) {
      const profile = provider.profiles[0] as AuthProfileCredential & { id: string };
      setEditingProfile({ providerId, profile, mode: "edit" });
    } else {
      setEditingProfile({ providerId, mode: "add" });
    }
    setProfileModalOpen(true);
  };

  const handleAddProvider = () => {
    setAddProviderModalOpen(true);
  };

  const handleSelectProvider = (providerId: string) => {
    const meta = PROVIDER_METADATA[providerId];
    if (meta?.authType === "oauth") {
      setAddProviderModalOpen(false);
      initiateAntigravityOAuth();
      return;
    }
    if (meta?.authType === "cli") {
      setAddProviderModalOpen(false);
      setCliInitProviderId(providerId);
      setCliInitModalOpen(true);
      return;
    }

    // After selecting a provider, open the add profile modal for it
    setEditingProfile({ providerId, mode: "add" });
    setProfileModalOpen(true);
  };

  const handleCliInitSync = async () => {
    try {
      // Reload gateway — this triggers backend to re-read ~/.claude/.credentials.json
      // via syncExternalCliCredentials and auth profile store initialization
      await reloadGateway(request);
      // Wait a moment for gateway to restart and pick up credentials
      await new Promise((r) => setTimeout(r, 1500));
      // Refresh our config snapshot to see the updated profiles
      await loadConfig(request);
      setCliInitModalOpen(false);
    } catch (err) {
      console.error("Failed to sync CLI credentials:", err);
    }
  };

  const handleSaveProfile = async (data: ProfileFormData) => {
    if (!snapshot || !editingProfile) return;

    // Map UI provider ID back to config provider ID
    const reverseProviderIdMap: Record<string, string> = {
      // Add reverse mappings here if config key differs from UI provider ID
    };
    const configProviderId =
      reverseProviderIdMap[editingProfile.providerId] ?? editingProfile.providerId;

    // Get existing provider config or create new one
    const existingProvider = snapshot.config.models?.providers?.[configProviderId] ?? {};

    // Build patch - only update apiKey and baseUrl if provided
    const providerPatch: Record<string, unknown> = {
      ...existingProvider,
      apiKey: data.apiKey,
    };

    if (data.baseUrl) {
      providerPatch.baseUrl = data.baseUrl;
    }

    // If this is a new provider, set default api type
    if (!existingProvider.api) {
      const defaultApis: Record<string, string> = {
        anthropic: "anthropic-messages",
        google: "google-generative-ai",
        openai: "openai-chat",
        ollama: "ollama",
      };
      providerPatch.api = defaultApis[configProviderId] ?? "anthropic-messages";
    }

    // Build the patch object
    const patch = {
      models: {
        providers: {
          [configProviderId]: providerPatch,
        },
      },
    };

    // Soft save: add to pending changes instead of calling API
    const providerName =
      PROVIDER_METADATA[editingProfile.providerId]?.name ?? editingProfile.providerId;
    addPendingChange({
      type: editingProfile.mode === "add" ? "provider-add" : "provider-update",
      path: `models.providers.${configProviderId}`,
      description:
        editingProfile.mode === "add"
          ? `Add ${providerName} profile`
          : `Update ${providerName} profile`,
      patch,
    });

    console.log("Soft saved profile change:", { providerId: configProviderId, patch });

    setProfileModalOpen(false);
    setEditingProfile(null);
  };

  const handleApplyChanges = async () => {
    const result = await applyPendingChanges(request);
    if (result.ok) {
      console.log("Changes applied successfully");
    } else {
      alert("Failed to apply changes: " + (result.error ?? "Unknown error"));
    }
  };

  const handleReloadGateway = async () => {
    const result = await reloadGateway(request);
    if (result.ok) {
      console.log("Gateway reloaded successfully");
    } else {
      alert("Failed to reload gateway: " + (result.error ?? "Unknown error"));
    }
  };

  const handleOAuthLogin = (providerId: string) => {
    console.log("OAuth login for:", providerId);
    if (providerId === "antigravity") {
      initiateAntigravityOAuth();
    }
  };

  const globalStrategy: "failover" | "loadbalance" =
    snapshot?.config?.agents?.defaults?.strategy ?? "failover";

  const handleStrategyChange = async (strategy: "failover" | "loadbalance") => {
    try {
      const patch = {
        agents: {
          defaults: {
            strategy,
          },
        },
      };
      await request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash: snapshot?.hash,
      });
      // Gateway restarts after config change — reload to reconnect
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("gateway not connected") || msg.includes("not connected")) {
        setTimeout(() => window.location.reload(), 2000);
        return;
      }
      console.error("Failed to update strategy:", err);
      alert("Failed to update strategy: " + msg);
    }
  };

  // Compute disabled profiles from config
  const disabledProfiles = new Set<string>(
    Object.entries(snapshot?.config?.auth?.profiles ?? {})
      .filter(([, p]) => (p as { disabled?: boolean }).disabled)
      .map(([id]) => id),
  );

  const handleToggleDisable = async (profileId: string, disabled: boolean) => {
    try {
      const existingProfile = snapshot?.config?.auth?.profiles?.[profileId];
      if (!existingProfile) {
        console.warn("Profile not found in config:", profileId);
        return;
      }
      const patch = {
        auth: {
          profiles: {
            [profileId]: {
              ...existingProfile,
              disabled,
            },
          },
        },
      };
      await request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash: snapshot?.hash,
      });
      // Reload to pick up changes
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("gateway not connected") || msg.includes("not connected")) {
        setTimeout(() => window.location.reload(), 2000);
        return;
      }
      console.error("Failed to toggle profile:", err);
      alert("Failed to toggle profile: " + msg);
    }
  };

  if (!connected || loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto" />
          <p className="text-gray-500">{!connected ? "Connecting..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-gray-500">Manage your AI provider credentials and API keys</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {hasPendingChanges && (
            <Button
              onClick={handleApplyChanges}
              disabled={saving}
              className="bg-primary-500 hover:bg-primary-600"
            >
              {saving ? "Saving..." : `Apply Changes (${pendingChanges.length})`}
            </Button>
          )}
          <Button variant="outline" onClick={handleReloadGateway} disabled={saving}>
            Reload Gateway
          </Button>
        </div>
      </div>

      {/* Pending changes banner */}
      {hasPendingChanges && (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-950">
          <div className="flex items-start gap-3">
            <span className="text-warning-500">⚠</span>
            <div className="flex-1">
              <p className="font-medium text-warning-700 dark:text-warning-300">
                You have {pendingChanges.length} unsaved change
                {pendingChanges.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-1 text-sm text-warning-600 dark:text-warning-400">
                {pendingChanges.map((change) => (
                  <li key={change.id}>• {change.description}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-warning-500">
                Click "Apply Changes" to save, then "Reload Gateway" to activate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global Strategy Toggle */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Routing Strategy
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {globalStrategy === "failover"
                ? "Use primary model, switch to fallback models on failure"
                : "Rotate across providers using round-robin"}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 text-xs overflow-hidden">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${
                globalStrategy === "failover"
                  ? "bg-primary-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
              onClick={() => handleStrategyChange("failover")}
              title="Use primary model, switch to fallback models on failure"
            >
              <Shield className="h-3.5 w-3.5" />
              Failover
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${
                globalStrategy === "loadbalance"
                  ? "bg-primary-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
              onClick={() => handleStrategyChange("loadbalance")}
              title="Rotate across providers using round-robin"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Load Balance
            </button>
          </div>
        </div>
      </div>

      <ProviderGrid
        providers={providers}
        onEditProfile={handleEditProfile}
        onDeleteProfile={handleDeleteProfile}
        onAddProfile={handleAddProfile}
        onAddProvider={handleAddProvider}
        onOAuthLogin={handleOAuthLogin}
        onToggleDisable={handleToggleDisable}
        disabledProfiles={disabledProfiles}
      />

      {/* Profile Modal */}
      {editingProfile && (
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            setEditingProfile(null);
          }}
          onSave={handleSaveProfile}
          providerId={editingProfile.providerId}
          providerName={
            PROVIDER_METADATA[editingProfile.providerId]?.name ?? editingProfile.providerId
          }
          profile={editingProfile.profile}
          mode={editingProfile.mode}
        />
      )}

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={addProviderModalOpen}
        onClose={() => setAddProviderModalOpen(false)}
        onSelect={handleSelectProvider}
        existingProviders={providers.map((p) => p.id)}
      />

      {/* CLI Init Modal (for Anthropic) */}
      <CliInitModal
        isOpen={cliInitModalOpen}
        onClose={() => setCliInitModalOpen(false)}
        onSync={handleCliInitSync}
        providerId={cliInitProviderId}
      />

      {/* OAuth Edit Modal (for Antigravity) */}
      {oauthEditProvider && (
        <OAuthEditModal
          isOpen={oauthEditModalOpen}
          onClose={() => {
            setOAuthEditModalOpen(false);
            setOAuthEditProvider(null);
          }}
          onReAuth={() => {
            setOAuthEditModalOpen(false);
            setOAuthEditProvider(null);
            initiateAntigravityOAuth();
          }}
          providerId={oauthEditProvider.providerId}
          accessToken={oauthEditProvider.accessToken}
          email={oauthEditProvider.email}
        />
      )}
    </div>
  );
}
