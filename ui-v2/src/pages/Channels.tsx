import {
  Save,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
  MessageSquare,
  Eye,
  EyeOff,
  Settings2,
  Users,
  Shield,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ChannelsConfig,
  ChannelDefaultsConfig,
  ChannelHeartbeatConfig,
  TelegramAccountConfig,
  DiscordAccountConfig,
  WhatsAppAccountConfig,
  SlackAccountConfig,
  SignalAccountConfig,
  GoogleChatAccountConfig,
  BaseChannelAccountConfig,
  DmPolicy,
  GroupPolicy,
} from "@/types/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGateway } from "@/lib/gateway-context";
import { useConfigStore, loadConfig, patchConfig } from "@/lib/stores/config-store";

// ─── Channel Metadata ───────────────────────────

interface ChannelMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
  tokenField?: string;
  tokenLabel?: string;
  hasStreamMode?: boolean;
  hasReactionLevel?: boolean;
  hasWebhook?: boolean;
  /** Channels that use appId + appSecret instead of a single token */
  hasAppCredentials?: boolean;
}

const CHANNEL_TYPES: ChannelMeta[] = [
  {
    id: "telegram",
    label: "Telegram",
    icon: "✈️",
    color: "#0088cc",
    tokenField: "botToken",
    tokenLabel: "Bot Token",
    hasStreamMode: true,
    hasReactionLevel: true,
  },
  {
    id: "discord",
    label: "Discord",
    icon: "🎮",
    color: "#5865F2",
    tokenField: "token",
    tokenLabel: "Bot Token",
  },
  { id: "whatsapp", label: "WhatsApp", icon: "💬", color: "#25D366" },
  {
    id: "slack",
    label: "Slack",
    icon: "💼",
    color: "#4A154B",
    tokenField: "botToken",
    tokenLabel: "Bot Token",
  },
  { id: "signal", label: "Signal", icon: "🔐", color: "#3A76F0", hasReactionLevel: true },
  { id: "googlechat", label: "Google Chat", icon: "💚", color: "#00AC47", hasWebhook: true },
  { id: "imessage", label: "iMessage", icon: "🍎", color: "#007AFF" },
  { id: "feishu", label: "Feishu/Lark", icon: "🐦", color: "#3370FF", hasAppCredentials: true },
  { id: "msteams", label: "MS Teams", icon: "🟣", color: "#6264A7" },
];

const DM_POLICIES: { value: DmPolicy; label: string }[] = [
  { value: "pairing", label: "Pairing (code)" },
  { value: "allowlist", label: "Allowlist only" },
  { value: "open", label: "Open (anyone)" },
  { value: "disabled", label: "Disabled" },
];

const GROUP_POLICIES: { value: GroupPolicy; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "allowlist", label: "Allowlist only" },
  { value: "disabled", label: "Disabled" },
];

// ─── Helpers ────────────────────────────────────

function getChannelConfig(
  channels: ChannelsConfig | undefined,
  channelId: string,
): Record<string, unknown> | undefined {
  return (channels as Record<string, unknown>)?.[channelId] as Record<string, unknown> | undefined;
}

function getAccounts(
  channelCfg: Record<string, unknown> | undefined,
): Record<string, Record<string, unknown>> {
  if (!channelCfg) return {};
  const accounts = channelCfg.accounts as Record<string, Record<string, unknown>> | undefined;
  if (accounts && typeof accounts === "object") return accounts;
  // If no "accounts" key, the channel cfg itself IS the default/single account
  // We represent it as { default: channelCfg }
  const singleAccount: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(channelCfg)) {
    if (k !== "accounts") singleAccount[k] = v;
  }
  if (Object.keys(singleAccount).length === 0) return {};
  return { default: singleAccount };
}

// CSS class helpers
const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";
const selectCls = inputCls;
const labelCls = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
const helpCls = "mt-1 text-xs text-gray-500";

// ─── Main Component ─────────────────────────────

export function Channels() {
  const { connected, request } = useGateway();
  const { snapshot, saving } = useConfigStore();

  const [activeTab, setActiveTab] = useState("telegram");
  const [editingAccount, setEditingAccount] = useState<{
    channelId: string;
    accountId: string;
  } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showToken, setShowToken] = useState(false);

  // Defaults form
  const [defaults, setDefaults] = useState<ChannelDefaultsConfig>({});
  const [defaultsDirty, setDefaultsDirty] = useState(false);

  // Load config
  useEffect(() => {
    if (connected && !snapshot) {
      loadConfig(request).catch(console.error);
    }
  }, [connected, request, snapshot]);

  // Sync defaults from snapshot
  useEffect(() => {
    if (snapshot?.config?.channels?.defaults) {
      setDefaults(snapshot.config.channels.defaults);
      setDefaultsDirty(false);
    }
  }, [snapshot]);

  const channelsConfig = snapshot?.config?.channels;
  const activeMeta = CHANNEL_TYPES.find((c) => c.id === activeTab)!;
  const channelCfg = getChannelConfig(channelsConfig, activeTab);
  const accounts = getAccounts(channelCfg);
  const accountEntries = Object.entries(accounts);

  // Count configured channels per type
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ct of CHANNEL_TYPES) {
      const cfg = getChannelConfig(channelsConfig, ct.id);
      const accts = getAccounts(cfg);
      counts[ct.id] = Object.keys(accts).length;
    }
    return counts;
  }, [channelsConfig]);

  // Start editing an account
  const startEdit = useCallback(
    (channelId: string, accountId: string, config: Record<string, unknown>) => {
      setEditingAccount({ channelId, accountId });
      setEditForm({ ...config });
      setDirty(false);
      setShowToken(false);
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditingAccount(null);
    setEditForm({});
    setDirty(false);
  }, []);

  const updateField = useCallback((key: string, value: unknown) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // Save account config
  const handleSave = async () => {
    if (!editingAccount || !snapshot?.hash) return;
    const { channelId, accountId } = editingAccount;

    setSaveStatus("saving");
    try {
      const accts = getAccounts(getChannelConfig(channelsConfig, channelId));
      const hasMultipleAccounts = Object.keys(accts).length > 1 || accountId !== "default";

      let patch: Record<string, unknown>;
      if (hasMultipleAccounts) {
        patch = { channels: { [channelId]: { accounts: { [accountId]: editForm } } } };
      } else {
        // Single account → write directly to channel config (no accounts wrapper)
        patch = { channels: { [channelId]: editForm } };
      }

      await patchConfig(request, patch as any);
      await new Promise((r) => setTimeout(r, 800));
      await loadConfig(request);
      setDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save channel config:", err);
      setSaveStatus("idle");
    }
  };

  // Delete account
  const handleDeleteAccount = async (channelId: string, accountId: string) => {
    if (!snapshot?.hash) return;
    if (!confirm(`Delete account "${accountId}" from ${channelId}?`)) return;

    try {
      // Set account to null to delete
      const patch = { channels: { [channelId]: { accounts: { [accountId]: null } } } };
      await patchConfig(request, patch as any);
      await new Promise((r) => setTimeout(r, 800));
      await loadConfig(request);
      if (editingAccount?.accountId === accountId) cancelEdit();
    } catch (err) {
      console.error("Failed to delete account:", err);
    }
  };

  // Add new account
  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !snapshot?.hash) return;
    const name = newAccountName.trim().toLowerCase().replace(/\s+/g, "-");

    try {
      const patch = {
        channels: { [activeTab]: { accounts: { [name]: { enabled: true, name } } } },
      };
      await patchConfig(request, patch as any);
      await new Promise((r) => setTimeout(r, 800));
      await loadConfig(request);
      setAddingAccount(false);
      setNewAccountName("");
    } catch (err) {
      console.error("Failed to add account:", err);
    }
  };

  // Save defaults
  const handleSaveDefaults = async () => {
    if (!snapshot?.hash) return;
    setSaveStatus("saving");
    try {
      await patchConfig(request, { channels: { defaults } } as any);
      await new Promise((r) => setTimeout(r, 800));
      await loadConfig(request);
      setDefaultsDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save defaults:", err);
      setSaveStatus("idle");
    }
  };

  if (!connected) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-500">Connecting to gateway...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-sm text-gray-500">
          Configure messaging platform connections and policies
        </p>
      </div>

      <div className="flex gap-6">
        {/* Channel Type Tabs (left sidebar) */}
        <div className="w-48 shrink-0">
          <div className="space-y-1">
            {CHANNEL_TYPES.map((ct) => {
              const count = channelCounts[ct.id] || 0;
              return (
                <button
                  key={ct.id}
                  onClick={() => {
                    setActiveTab(ct.id);
                    cancelEdit();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === ct.id
                      ? "bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{ct.icon}</span>
                    <span>{ct.label}</span>
                  </span>
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 space-y-4">
          {/* Active channel header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeMeta.icon}</span>
              <h2 className="text-lg font-semibold">{activeMeta.label}</h2>
              <Badge variant="secondary">
                {accountEntries.length} account{accountEntries.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddingAccount(true);
                setNewAccountName("");
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Account
            </Button>
          </div>

          {/* Add Account inline */}
          {addingAccount && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <input
                    className={inputCls + " flex-1"}
                    placeholder="Account name (e.g. work, personal)"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddAccount} disabled={!newAccountName.trim()}>
                    Create
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAddingAccount(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Cards */}
          {accountEntries.length === 0 && !addingAccount && (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  No {activeMeta.label} accounts configured
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Click "Add Account" to set up a {activeMeta.label} connection
                </p>
              </CardContent>
            </Card>
          )}

          {accountEntries.map(([accountId, accountCfg]) => {
            const isEditing =
              editingAccount?.channelId === activeTab && editingAccount?.accountId === accountId;
            const cfg = isEditing ? editForm : accountCfg;
            const isEnabled = cfg.enabled !== false;
            const displayName = (cfg.name as string) || accountId;

            return (
              <Card key={accountId} className={`transition-all ${!isEnabled ? "opacity-60" : ""}`}>
                <CardHeader
                  className="cursor-pointer pb-3"
                  onClick={() =>
                    isEditing ? cancelEdit() : startEdit(activeTab, accountId, accountCfg)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: isEnabled ? "#22c55e" : "#94a3b8" }}
                      />
                      <CardTitle className="text-sm font-semibold">{displayName}</CardTitle>
                      <Badge variant={isEnabled ? "default" : "secondary"} className="text-[10px]">
                        {isEnabled ? "Active" : "Disabled"}
                      </Badge>
                      {accountId !== "default" && (
                        <Badge variant="secondary" className="text-[10px]">
                          {accountId}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing && dirty && (
                        <>
                          <Button size="sm" onClick={handleSave} disabled={saving}>
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {saveStatus === "saving"
                              ? "Saving..."
                              : saveStatus === "saved"
                                ? "✓ Saved"
                                : "Save"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            Discard
                          </Button>
                        </>
                      )}
                      {accountId !== "default" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAccount(activeTab, accountId);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isEditing && (
                  <CardContent className="space-y-5 border-t pt-4">
                    {/* Enable toggle */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={editForm.enabled !== false}
                          onChange={(e) => updateField("enabled", e.target.checked)}
                        />
                        <div className="peer h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-gray-600" />
                      </label>
                      <span className="text-sm font-medium">Enabled</span>
                    </div>

                    {/* Name */}
                    <div>
                      <label className={labelCls}>Display Name</label>
                      <input
                        className={inputCls}
                        value={(editForm.name as string) || ""}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder={accountId}
                      />
                    </div>

                    {/* Token field (if applicable) */}
                    {activeMeta.tokenField && (
                      <div>
                        <label className={labelCls}>{activeMeta.tokenLabel}</label>
                        <div className="flex gap-2">
                          <input
                            className={inputCls + " flex-1 font-mono text-xs"}
                            type={showToken ? "text" : "password"}
                            value={(editForm[activeMeta.tokenField!] as string) || ""}
                            onChange={(e) => updateField(activeMeta.tokenField!, e.target.value)}
                            placeholder="Enter token..."
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setShowToken(!showToken)}
                          >
                            {showToken ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className={helpCls}>Authentication token for this account</p>
                      </div>
                    )}

                    {/* App Credentials (Lark) */}
                    {activeMeta.hasAppCredentials && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>App ID</label>
                          <input
                            className={inputCls + " font-mono text-xs"}
                            value={(editForm.appId as string) || ""}
                            onChange={(e) => updateField("appId", e.target.value)}
                            placeholder="cli_..."
                          />
                          <p className={helpCls}>From Lark Developer Console</p>
                        </div>
                        <div>
                          <label className={labelCls}>App Secret</label>
                          <div className="flex gap-2">
                            <input
                              className={inputCls + " flex-1 font-mono text-xs"}
                              type={showToken ? "text" : "password"}
                              value={(editForm.appSecret as string) || ""}
                              onChange={(e) => updateField("appSecret", e.target.value)}
                              placeholder="Enter app secret..."
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => setShowToken(!showToken)}
                            >
                              {showToken ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Slack additional tokens */}
                    {activeTab === "slack" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>App Token</label>
                          <input
                            className={inputCls + " font-mono text-xs"}
                            type="password"
                            value={(editForm.appToken as string) || ""}
                            onChange={(e) => updateField("appToken", e.target.value)}
                            placeholder="xapp-..."
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Connection Mode</label>
                          <select
                            className={selectCls}
                            value={(editForm.mode as string) || "socket"}
                            onChange={(e) => updateField("mode", e.target.value)}
                          >
                            <option value="socket">Socket Mode</option>
                            <option value="http">HTTP Webhook</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Policies section */}
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <Shield className="h-4 w-4" />
                        Access Policies
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>DM Policy</label>
                          <select
                            className={selectCls}
                            value={(editForm.dmPolicy as string) || "pairing"}
                            onChange={(e) => updateField("dmPolicy", e.target.value)}
                          >
                            {DM_POLICIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Group Policy</label>
                          <select
                            className={selectCls}
                            value={(editForm.groupPolicy as string) || "open"}
                            onChange={(e) => updateField("groupPolicy", e.target.value)}
                          >
                            {GROUP_POLICIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* AllowFrom */}
                      <div className="mt-3">
                        <label className={labelCls}>
                          <Users className="mr-1 inline h-3.5 w-3.5" />
                          Allow From
                        </label>
                        <input
                          className={inputCls}
                          value={((editForm.allowFrom as (string | number)[]) || []).join(", ")}
                          onChange={(e) =>
                            updateField(
                              "allowFrom",
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          placeholder="User IDs or usernames, comma-separated"
                        />
                        <p className={helpCls}>Allowed sender IDs for DM/group messages</p>
                      </div>
                    </div>

                    {/* Messaging section */}
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <Settings2 className="h-4 w-4" />
                        Messaging
                      </h4>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        <div>
                          <label className={labelCls}>History Limit</label>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            className={inputCls}
                            value={(editForm.historyLimit as number) ?? ""}
                            onChange={(e) =>
                              updateField(
                                "historyLimit",
                                e.target.value ? Number(e.target.value) : undefined,
                              )
                            }
                            placeholder="50"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>DM History</label>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            className={inputCls}
                            value={(editForm.dmHistoryLimit as number) ?? ""}
                            onChange={(e) =>
                              updateField(
                                "dmHistoryLimit",
                                e.target.value ? Number(e.target.value) : undefined,
                              )
                            }
                            placeholder="—"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Text Chunk</label>
                          <input
                            type="number"
                            min={500}
                            max={10000}
                            className={inputCls}
                            value={(editForm.textChunkLimit as number) ?? ""}
                            onChange={(e) =>
                              updateField(
                                "textChunkLimit",
                                e.target.value ? Number(e.target.value) : undefined,
                              )
                            }
                            placeholder="4000"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Media Max MB</label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            className={inputCls}
                            value={(editForm.mediaMaxMb as number) ?? ""}
                            onChange={(e) =>
                              updateField(
                                "mediaMaxMb",
                                e.target.value ? Number(e.target.value) : undefined,
                              )
                            }
                            placeholder="50"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Response Prefix</label>
                          <input
                            className={inputCls}
                            value={(editForm.responsePrefix as string) || ""}
                            onChange={(e) => updateField("responsePrefix", e.target.value)}
                            placeholder="[{model}]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Chunk Mode</label>
                          <select
                            className={selectCls}
                            value={(editForm.chunkMode as string) || "length"}
                            onChange={(e) => updateField("chunkMode", e.target.value)}
                          >
                            <option value="length">By Length</option>
                            <option value="newline">By Newline</option>
                          </select>
                        </div>
                      </div>

                      {/* Stream mode (Telegram only) */}
                      {activeMeta.hasStreamMode && (
                        <div className="mt-3">
                          <label className={labelCls}>Stream Mode</label>
                          <select
                            className={selectCls}
                            value={(editForm.streamMode as string) || "partial"}
                            onChange={(e) => updateField("streamMode", e.target.value)}
                          >
                            <option value="off">Off</option>
                            <option value="partial">Partial (edit messages)</option>
                            <option value="block">Block (full messages)</option>
                          </select>
                        </div>
                      )}

                      {/* Block streaming toggle (non-Telegram) */}
                      {!activeMeta.hasStreamMode && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={
                                editForm.blockStreaming !== false &&
                                editForm.blockStreaming !== undefined
                              }
                              onChange={(e) => updateField("blockStreaming", e.target.checked)}
                            />
                            <div className="peer h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-gray-600" />
                          </label>
                          <span className="text-sm">Block Streaming</span>
                        </div>
                      )}

                      {/* Reaction level */}
                      {activeMeta.hasReactionLevel && (
                        <div className="mt-3">
                          <label className={labelCls}>Reaction Level</label>
                          <select
                            className={selectCls}
                            value={(editForm.reactionLevel as string) || "ack"}
                            onChange={(e) => updateField("reactionLevel", e.target.value)}
                          >
                            <option value="off">Off</option>
                            <option value="ack">Ack only (👀)</option>
                            <option value="minimal">Minimal</option>
                            <option value="extensive">Extensive</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Heartbeat section */}
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        💓 Heartbeat
                      </h4>
                      <div className="flex flex-wrap gap-4">
                        {(["showOk", "showAlerts", "useIndicator"] as const).map((field) => {
                          const hb = (editForm.heartbeat as ChannelHeartbeatConfig) || {};
                          const defaultVal = field === "showOk" ? false : true;
                          return (
                            <label key={field} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={hb[field] ?? defaultVal}
                                onChange={(e) =>
                                  updateField("heartbeat", { ...hb, [field]: e.target.checked })
                                }
                                className="rounded border-gray-300 text-primary-500"
                              />
                              {field === "showOk"
                                ? "Show OK"
                                : field === "showAlerts"
                                  ? "Show Alerts"
                                  : "Use Indicator"}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Channel Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Channel Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Default Group Policy</label>
              <select
                className={selectCls}
                value={defaults.groupPolicy || ""}
                onChange={(e) => {
                  setDefaults({
                    ...defaults,
                    groupPolicy: (e.target.value || undefined) as GroupPolicy,
                  });
                  setDefaultsDirty(true);
                }}
              >
                <option value="">— Not set —</option>
                {GROUP_POLICIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Heartbeat — Show OK</label>
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  checked={defaults.heartbeat?.showOk ?? false}
                  onChange={(e) => {
                    setDefaults({
                      ...defaults,
                      heartbeat: { ...defaults.heartbeat, showOk: e.target.checked },
                    });
                    setDefaultsDirty(true);
                  }}
                  className="rounded border-gray-300"
                />
                Acknowledge heartbeat OK
              </label>
            </div>
            <div>
              <label className={labelCls}>Heartbeat — Show Alerts</label>
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  checked={defaults.heartbeat?.showAlerts ?? true}
                  onChange={(e) => {
                    setDefaults({
                      ...defaults,
                      heartbeat: { ...defaults.heartbeat, showAlerts: e.target.checked },
                    });
                    setDefaultsDirty(true);
                  }}
                  className="rounded border-gray-300"
                />
                Show heartbeat alerts
              </label>
            </div>
          </div>
          {defaultsDirty && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSaveDefaults} disabled={saving}>
                <Save className="mr-1 h-3.5 w-3.5" />
                Save Defaults
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (snapshot?.config?.channels?.defaults)
                    setDefaults(snapshot.config.channels.defaults);
                  setDefaultsDirty(false);
                }}
              >
                Discard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
