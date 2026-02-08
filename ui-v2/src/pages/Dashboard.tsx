import { useEffect } from "react";
import type { AuthProfileStore } from "@/types/auth";
import { ProviderGrid } from "@/components/providers/ProviderGrid";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGateway } from "@/lib/gateway-context";
import { useAuthStore, extractAuthFromConfig } from "@/lib/stores/auth-store";
import { useConfigStore, loadConfig } from "@/lib/stores/config-store";

export function Dashboard() {
  const { connected, request } = useGateway();
  const { snapshot, loading, error } = useConfigStore();
  const { providers, setProfileStore, setProfileConfigs } = useAuthStore();

  // Load config on mount
  useEffect(() => {
    if (connected) {
      loadConfig(request).catch(console.error);
    }
  }, [connected, request]);

  // Extract auth profiles from config when loaded
  useEffect(() => {
    if (snapshot?.config) {
      const authConfigs = extractAuthFromConfig(snapshot.config);
      setProfileConfigs(authConfigs);

      // For now, create mock profile store from config
      // In production, this would come from auth-profiles.json via gateway API
      const mockStore: AuthProfileStore = {
        version: 1,
        profiles: {},
        lastGood: {},
        usageStats: {},
      };

      // Create profiles from config providers
      const modelProviders = snapshot.config.models?.providers ?? {};
      for (const [providerId, providerConfig] of Object.entries(modelProviders)) {
        if (providerConfig.apiKey) {
          const profileId = `${providerId}:default`;
          mockStore.profiles[profileId] = {
            type: "api_key",
            provider: providerId,
            key: providerConfig.apiKey,
          };
          mockStore.lastGood![providerId] = profileId;
          mockStore.usageStats![profileId] = {
            lastUsed: Date.now() - Math.random() * 3600000, // Random time in last hour
            errorCount: 0,
          };
        }
      }

      setProfileStore(mockStore);
    }
  }, [snapshot, setProfileConfigs, setProfileStore]);

  const handleEditProfile = (providerId: string, profileId: string) => {
    console.log("Edit profile:", providerId, profileId);
    // TODO: Open edit dialog
  };

  const handleDeleteProfile = (providerId: string, profileId: string) => {
    console.log("Delete profile:", providerId, profileId);
    // TODO: Confirm and delete
  };

  const handleAddProfile = (providerId: string) => {
    console.log("Add profile for:", providerId);
    // TODO: Open add dialog
  };

  const handleAddProvider = () => {
    console.log("Add new provider");
    // TODO: Open provider selection dialog
  };

  if (!connected) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto" />
          <p className="text-gray-500">Connecting to gateway...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto" />
          <p className="text-gray-500">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-danger-500">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Manage your AI providers and credentials</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {providers.reduce((acc, p) => acc + p.profiles.length, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="success">
                {providers.filter((p) => p.status === "healthy").length} OK
              </Badge>
              {providers.filter((p) => p.status === "warning").length > 0 && (
                <Badge variant="warning">
                  {providers.filter((p) => p.status === "warning").length} Warning
                </Badge>
              )}
              {providers.filter((p) => p.status === "error").length > 0 && (
                <Badge variant="error">
                  {providers.filter((p) => p.status === "error").length} Error
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Gateway</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-500" />
              <span className="text-sm">Port {snapshot?.config.gateway?.port ?? 18789}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Providers Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Providers</h2>
        <ProviderGrid
          providers={providers}
          onEditProfile={handleEditProfile}
          onDeleteProfile={handleDeleteProfile}
          onAddProfile={handleAddProfile}
          onAddProvider={handleAddProvider}
        />
      </div>
    </div>
  );
}
