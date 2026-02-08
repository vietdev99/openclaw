import {
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  Server,
  Cloud,
  Terminal,
  Bot,
  Cpu,
  Github,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Power,
} from "lucide-react";
import { useState } from "react";
import type { ProviderInfo, ProviderStatus, AuthProfileCredential } from "@/types/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { cn, formatRelativeTime, maskToken } from "@/lib/utils";
import { PROVIDER_METADATA } from "@/types/auth";

interface ProviderCardProps {
  provider: ProviderInfo;
  onEdit?: (profileId: string) => void;
  onDelete?: (profileId: string) => void;
  onAdd?: () => void;
  onOAuthLogin?: (providerId: string) => void;
  onToggleDisable?: (profileId: string, disabled: boolean) => void;
  disabledProfiles?: Set<string>;
}

const statusConfig: Record<
  ProviderStatus,
  { label: string; variant: "success" | "warning" | "error" | "secondary" }
> = {
  healthy: { label: "OK", variant: "success" },
  warning: { label: "Warning", variant: "warning" },
  error: { label: "Error", variant: "error" },
  unknown: { label: "Unknown", variant: "secondary" },
};

function ProviderIcon({ providerId }: { providerId: string }) {
  const iconClass = "h-5 w-5";
  switch (providerId) {
    case "anthropic":
      return <Bot className={iconClass} />;
    case "google":
      return <span className="text-lg font-bold">G</span>;
    case "openai":
      return <Cpu className={iconClass} />;
    case "github":
      return <Github className={iconClass} />;
    case "mixed-agent-proxy":
      return <Server className={iconClass} />;
    case "antigravity":
      return <Cloud className={iconClass} />;
    case "ollama":
      return <Terminal className={iconClass} />;
    default:
      return <span className="text-sm font-bold">{providerId.slice(0, 2).toUpperCase()}</span>;
  }
}

export function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onAdd,
  onOAuthLogin,
  onToggleDisable,
  disabledProfiles,
}: ProviderCardProps) {
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [showModels, setShowModels] = useState(false);
  const status = statusConfig[provider.status];

  const toggleShowToken = (profileId: string) => {
    setShowTokens((prev) => ({ ...prev, [profileId]: !prev[profileId] }));
  };

  const getTokenDisplay = (credential: AuthProfileCredential, profileId: string) => {
    // CLI providers show managed status, not a real key
    const isCli = PROVIDER_METADATA[provider.id]?.authType === "cli";
    if (isCli) {
      return "Managed by Claude CLI";
    }

    // OAuth providers show access token label
    const isOAuth = PROVIDER_METADATA[provider.id]?.authType === "oauth";
    if (isOAuth && credential.type === "api_key") {
      const token = credential.key;
      return showTokens[profileId] ? token : `OAuth ✓  ${maskToken(token)}`;
    }

    let token = "";
    if (credential.type === "api_key") {
      token = credential.key;
    } else if (credential.type === "token") {
      token = credential.token;
    } else if (credential.type === "oauth") {
      return `OAuth (${credential.email ?? "connected"})`;
    }

    return showTokens[profileId] ? token : maskToken(token);
  };

  const isCli = PROVIDER_METADATA[provider.id]?.authType === "cli";

  return (
    <Card className="relative overflow-hidden">
      {/* Status indicator bar at top */}
      <div
        className={cn(
          "absolute left-0 right-0 top-0 h-1",
          provider.status === "healthy" && "bg-success-500",
          provider.status === "warning" && "bg-warning-500",
          provider.status === "error" && "bg-danger-500",
          provider.status === "unknown" && "bg-gray-400",
        )}
      />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <ProviderIcon providerId={provider.id} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">
                {provider.profiles.length} profile{provider.profiles.length !== 1 ? "s" : ""}
              </p>
              {provider.models.length > 0 && <span className="text-xs text-gray-400">•</span>}
              {provider.models.length > 0 && (
                <p className="text-sm text-gray-500">
                  {provider.models.length} model{provider.models.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {provider.profiles.length === 0 ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-gray-500">No credentials configured</p>
            {provider.authType === "oauth" ? (
              <Button size="sm" onClick={() => onOAuthLogin?.(provider.id)}>
                <Cloud className="mr-1 h-4 w-4" />
                Login with Google
              </Button>
            ) : provider.authType === "cli" ? (
              <Button size="sm" onClick={onAdd}>
                <Terminal className="mr-1 h-4 w-4" />
                Sync from Claude CLI
              </Button>
            ) : (
              <Button size="sm" onClick={onAdd}>
                <Plus className="mr-1 h-4 w-4" />
                Add API Key
              </Button>
            )}
          </div>
        ) : (
          <>
            {provider.profiles.map((profile) => {
              const profileId = (profile as AuthProfileCredential & { id: string }).id;
              return (
                <div
                  key={profileId}
                  className={cn(
                    "rounded-lg border p-3",
                    disabledProfiles?.has(profileId)
                      ? "border-gray-300 bg-gray-100 opacity-50 dark:border-gray-700 dark:bg-gray-900"
                      : provider.activeProfileId === profileId
                        ? "border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950"
                        : "border-gray-200 dark:border-gray-800",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        disabledProfiles?.has(profileId) && "line-through text-gray-400",
                      )}
                    >
                      {profileId}
                    </span>
                    <div className="flex items-center gap-1">
                      {disabledProfiles?.has(profileId) && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                      {provider.activeProfileId === profileId &&
                        !disabledProfiles?.has(profileId) && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                      {getTokenDisplay(profile, profileId)}
                    </code>
                    {!isCli && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleShowToken(profileId)}
                      >
                        {showTokens[profileId] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit?.(profileId)}
                      title={isCli ? "Sync credentials" : "Edit"}
                    >
                      {isCli ? <RefreshCw className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        disabledProfiles?.has(profileId)
                          ? "text-success-500 hover:text-success-600"
                          : "text-warning-500 hover:text-warning-600",
                      )}
                      onClick={() =>
                        onToggleDisable?.(profileId, !disabledProfiles?.has(profileId))
                      }
                      title={
                        disabledProfiles?.has(profileId)
                          ? "Enable this profile"
                          : "Disable this profile"
                      }
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger-500 hover:text-danger-600"
                      onClick={() => onDelete?.(profileId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Single credential per provider — no "Add Profile" button when one exists */}
          </>
        )}
      </CardContent>

      {/* Models list (expandable) */}
      {provider.models.length > 0 && (
        <div className="border-t">
          <button
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setShowModels(!showModels)}
          >
            <span>
              {provider.models.length} model{provider.models.length !== 1 ? "s" : ""} available
            </span>
            {showModels ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showModels && (
            <div className="border-t px-4 py-2 space-y-1">
              {provider.models.map((model) => (
                <div key={model.id} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                    {model.name}
                  </span>
                  <span className="text-gray-400 truncate ml-auto text-[10px]">{model.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {provider.lastUsed && (
        <CardFooter className="border-t pt-3 text-xs text-gray-500">
          Last used: {formatRelativeTime(provider.lastUsed)}
        </CardFooter>
      )}
    </Card>
  );
}
