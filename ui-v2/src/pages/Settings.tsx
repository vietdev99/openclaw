import {
  Save,
  ChevronDown,
  ChevronRight,
  Globe,
  Terminal as TerminalIcon,
  MessageCircle,
  Command,
  Wrench,
  Film,
  Puzzle,
  Server,
  Shield,
  Search,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type {
  GatewayConfig,
  TerminalConfig,
  MessagesConfig,
  CommandsConfig,
  ToolsConfig,
  PluginsConfig,
} from "@/types/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGateway } from "@/lib/gateway-context";
import { useConfigStore, loadConfig, patchConfig } from "@/lib/stores/config-store";

// ─── CSS Helpers ────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";
const selectCls = inputCls;
const labelCls = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
const helpCls = "mt-1 text-xs text-gray-500";

// ─── Collapsible Section ────────────────────────

function Section({
  id,
  icon: Icon,
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
            {badge && (
              <Badge variant="secondary" className="text-[10px]">
                {badge}
              </Badge>
            )}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-4 border-t pt-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Toggle Switch ──────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="peer h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-gray-600" />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  );
}

// ─── Main Component ─────────────────────────────

export function Settings() {
  const { connected, request } = useGateway();
  const { snapshot, saving } = useConfigStore();

  // Track which sections are open
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["gateway"]));
  const toggle = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Form state
  const [gateway, setGateway] = useState<GatewayConfig>({});
  const [terminal, setTerminal] = useState<TerminalConfig>({});
  const [messages, setMessages] = useState<MessagesConfig>({});
  const [commands, setCommands] = useState<CommandsConfig>({});
  const [tools, setTools] = useState<ToolsConfig>({});
  const [plugins, setPlugins] = useState<PluginsConfig>({});

  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Load config
  useEffect(() => {
    if (connected && !snapshot) {
      loadConfig(request).catch(console.error);
    }
  }, [connected, request, snapshot]);

  // Sync from snapshot
  useEffect(() => {
    if (snapshot?.config) {
      const c = snapshot.config;
      setGateway(c.gateway || {});
      setTerminal(c.terminal || {});
      setMessages(c.messages || {});
      setCommands(c.commands || {});
      setTools(c.tools || {});
      setPlugins(c.plugins || {});
      setDirty(false);
    }
  }, [snapshot]);

  const markDirty = useCallback(() => setDirty(true), []);

  // Save all settings
  const handleSave = async () => {
    if (!snapshot?.hash) return;
    setSaveStatus("saving");
    try {
      await patchConfig(request, { gateway, terminal, messages, commands, tools, plugins });
      await new Promise((r) => setTimeout(r, 1000));
      await loadConfig(request);
      setDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveStatus("idle");
    }
  };

  const handleDiscard = () => {
    if (snapshot?.config) {
      const c = snapshot.config;
      setGateway(c.gateway || {});
      setTerminal(c.terminal || {});
      setMessages(c.messages || {});
      setCommands(c.commands || {});
      setTools(c.tools || {});
      setPlugins(c.plugins || {});
      setDirty(false);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500">
            Gateway, terminal, messaging, tools, and plugin configuration
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={handleDiscard}>
              Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={!dirty || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "✓ Saved"
                : "Save All"}
          </Button>
        </div>
      </div>

      {/* ─── Gateway ─────────────────────────────── */}
      <Section
        id="gateway"
        icon={Server}
        title="Gateway"
        badge={`port ${gateway.port || 18789}`}
        open={openSections.has("gateway")}
        onToggle={() => toggle("gateway")}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Port</label>
            <input
              type="number"
              className={inputCls}
              value={gateway.port || 18789}
              onChange={(e) => {
                setGateway({ ...gateway, port: Number(e.target.value) });
                markDirty();
              }}
            />
          </div>
          <div>
            <label className={labelCls}>Bind Mode</label>
            <select
              className={selectCls}
              value={gateway.bind || "loopback"}
              onChange={(e) => {
                setGateway({ ...gateway, bind: e.target.value as any });
                markDirty();
              }}
            >
              <option value="loopback">Loopback (127.0.0.1)</option>
              <option value="lan">LAN (0.0.0.0)</option>
              <option value="auto">Auto</option>
              <option value="tailnet">Tailnet</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Mode</label>
            <select
              className={selectCls}
              value={gateway.mode || "local"}
              onChange={(e) => {
                setGateway({ ...gateway, mode: e.target.value as any });
                markDirty();
              }}
            >
              <option value="local">Local</option>
              <option value="remote">Remote</option>
            </select>
          </div>
        </div>

        {gateway.bind === "custom" && (
          <div>
            <label className={labelCls}>Custom Bind Host</label>
            <input
              className={inputCls}
              value={gateway.customBindHost || ""}
              onChange={(e) => {
                setGateway({ ...gateway, customBindHost: e.target.value });
                markDirty();
              }}
              placeholder="0.0.0.0"
            />
          </div>
        )}

        {/* Auth */}
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-3.5 w-3.5" /> Authentication
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Auth Mode</label>
              <select
                className={selectCls}
                value={gateway.auth?.mode || "token"}
                onChange={(e) => {
                  setGateway({
                    ...gateway,
                    auth: { ...gateway.auth, mode: e.target.value as any },
                  });
                  markDirty();
                }}
              >
                <option value="token">Token</option>
                <option value="password">Password</option>
              </select>
            </div>
            {(gateway.auth?.mode || "token") === "token" && (
              <div>
                <label className={labelCls}>Token</label>
                <input
                  type="password"
                  className={inputCls + " font-mono text-xs"}
                  value={gateway.auth?.token || ""}
                  onChange={(e) => {
                    setGateway({ ...gateway, auth: { ...gateway.auth, token: e.target.value } });
                    markDirty();
                  }}
                  placeholder="Auto-generated"
                />
              </div>
            )}
            {gateway.auth?.mode === "password" && (
              <div>
                <label className={labelCls}>Password</label>
                <input
                  type="password"
                  className={inputCls}
                  value={gateway.auth?.password || ""}
                  onChange={(e) => {
                    setGateway({ ...gateway, auth: { ...gateway.auth, password: e.target.value } });
                    markDirty();
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* TLS */}
        <div className="flex flex-wrap gap-6">
          <Toggle
            checked={gateway.tls?.enabled ?? false}
            onChange={(v) => {
              setGateway({ ...gateway, tls: { ...gateway.tls, enabled: v } });
              markDirty();
            }}
            label="TLS Enabled"
          />
          {gateway.tls?.enabled && (
            <Toggle
              checked={gateway.tls?.autoGenerate ?? true}
              onChange={(v) => {
                setGateway({ ...gateway, tls: { ...gateway.tls, autoGenerate: v } });
                markDirty();
              }}
              label="Auto-generate Cert"
            />
          )}
        </div>

        {/* Reload */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Reload Strategy</label>
            <select
              className={selectCls}
              value={gateway.reload?.mode || "hybrid"}
              onChange={(e) => {
                setGateway({
                  ...gateway,
                  reload: { ...gateway.reload, mode: e.target.value as any },
                });
                markDirty();
              }}
            >
              <option value="hybrid">Hybrid</option>
              <option value="hot">Hot</option>
              <option value="restart">Restart</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Debounce (ms)</label>
            <input
              type="number"
              className={inputCls}
              value={gateway.reload?.debounceMs ?? 300}
              onChange={(e) => {
                setGateway({
                  ...gateway,
                  reload: { ...gateway.reload, debounceMs: Number(e.target.value) },
                });
                markDirty();
              }}
            />
          </div>
          <div>
            <label className={labelCls}>Tailscale Mode</label>
            <select
              className={selectCls}
              value={gateway.tailscale?.mode || "off"}
              onChange={(e) => {
                setGateway({
                  ...gateway,
                  tailscale: { ...gateway.tailscale, mode: e.target.value as any },
                });
                markDirty();
              }}
            >
              <option value="off">Off</option>
              <option value="serve">Serve</option>
              <option value="funnel">Funnel</option>
            </select>
          </div>
        </div>

        {/* HTTP Endpoints */}
        <div className="flex flex-wrap gap-6">
          <Toggle
            checked={gateway.http?.endpoints?.chatCompletions?.enabled ?? false}
            onChange={(v) => {
              setGateway({
                ...gateway,
                http: {
                  ...gateway.http,
                  endpoints: { ...gateway.http?.endpoints, chatCompletions: { enabled: v } },
                },
              });
              markDirty();
            }}
            label="HTTP: Chat Completions"
          />
          <Toggle
            checked={gateway.http?.endpoints?.responses?.enabled ?? false}
            onChange={(v) => {
              setGateway({
                ...gateway,
                http: {
                  ...gateway.http,
                  endpoints: { ...gateway.http?.endpoints, responses: { enabled: v } },
                },
              });
              markDirty();
            }}
            label="HTTP: Responses API"
          />
        </div>
      </Section>

      {/* ─── Terminal ────────────────────────────── */}
      <Section
        id="terminal"
        icon={TerminalIcon}
        title="Terminal"
        badge={terminal.mode || "legacy"}
        open={openSections.has("terminal")}
        onToggle={() => toggle("terminal")}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Execution Mode</label>
            <select
              className={selectCls}
              value={terminal.mode || "legacy"}
              onChange={(e) => {
                setTerminal({ ...terminal, mode: e.target.value as any });
                markDirty();
              }}
            >
              <option value="legacy">Legacy (in-process)</option>
              <option value="isolated">Isolated (crash-safe)</option>
            </select>
            <p className={helpCls}>Isolated mode runs commands in a separate process</p>
          </div>
          <div>
            <label className={labelCls}>Shell</label>
            <select
              className={selectCls}
              value={terminal.shell || "auto"}
              onChange={(e) => {
                setTerminal({ ...terminal, shell: e.target.value as any });
                markDirty();
              }}
            >
              <option value="auto">Auto-detect</option>
              <option value="bash">Bash</option>
              <option value="powershell">PowerShell</option>
              <option value="cmd">CMD</option>
            </select>
          </div>
          {terminal.mode === "isolated" && (
            <>
              <div>
                <label className={labelCls}>Host Port</label>
                <input
                  type="number"
                  className={inputCls}
                  value={terminal.host?.port ?? 18792}
                  onChange={(e) => {
                    setTerminal({
                      ...terminal,
                      host: { ...terminal.host, port: Number(e.target.value) },
                    });
                    markDirty();
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>Max Restarts</label>
                <input
                  type="number"
                  className={inputCls}
                  value={terminal.host?.maxRestarts ?? 10}
                  onChange={(e) => {
                    setTerminal({
                      ...terminal,
                      host: { ...terminal.host, maxRestarts: Number(e.target.value) },
                    });
                    markDirty();
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>Timeout (ms)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={terminal.host?.timeout ?? 120000}
                  onChange={(e) => {
                    setTerminal({
                      ...terminal,
                      host: { ...terminal.host, timeout: Number(e.target.value) },
                    });
                    markDirty();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* ─── Messages ────────────────────────────── */}
      <Section
        id="messages"
        icon={MessageCircle}
        title="Messages"
        open={openSections.has("messages")}
        onToggle={() => toggle("messages")}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Response Prefix</label>
            <input
              className={inputCls}
              value={messages.responsePrefix || ""}
              onChange={(e) => {
                setMessages({ ...messages, responsePrefix: e.target.value });
                markDirty();
              }}
              placeholder="[{model}] or auto"
            />
            <p className={helpCls}>Prefix added to all outbound replies</p>
          </div>
          <div>
            <label className={labelCls}>Ack Reaction</label>
            <input
              className={inputCls}
              value={messages.ackReaction || ""}
              onChange={(e) => {
                setMessages({ ...messages, ackReaction: e.target.value });
                markDirty();
              }}
              placeholder="👀"
            />
            <p className={helpCls}>Emoji sent to acknowledge messages</p>
          </div>
          <div>
            <label className={labelCls}>Ack Scope</label>
            <select
              className={selectCls}
              value={messages.ackReactionScope || "group-mentions"}
              onChange={(e) => {
                setMessages({ ...messages, ackReactionScope: e.target.value as any });
                markDirty();
              }}
            >
              <option value="group-mentions">Group Mentions</option>
              <option value="group-all">Group All</option>
              <option value="direct">Direct Only</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle
            checked={messages.removeAckAfterReply ?? false}
            onChange={(v) => {
              setMessages({ ...messages, removeAckAfterReply: v });
              markDirty();
            }}
            label="Remove Ack After Reply"
          />
        </div>

        {/* Queue */}
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="mb-3 text-sm font-semibold">Queue</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Queue Mode</label>
              <input
                className={inputCls}
                value={messages.queue?.mode || ""}
                onChange={(e) => {
                  setMessages({ ...messages, queue: { ...messages.queue, mode: e.target.value } });
                  markDirty();
                }}
                placeholder="serial"
              />
            </div>
            <div>
              <label className={labelCls}>Debounce (ms)</label>
              <input
                type="number"
                className={inputCls}
                value={messages.queue?.debounceMs ?? ""}
                onChange={(e) => {
                  setMessages({
                    ...messages,
                    queue: {
                      ...messages.queue,
                      debounceMs: e.target.value ? Number(e.target.value) : undefined,
                    },
                  });
                  markDirty();
                }}
                placeholder="300"
              />
            </div>
            <div>
              <label className={labelCls}>Cap</label>
              <input
                type="number"
                className={inputCls}
                value={messages.queue?.cap ?? ""}
                onChange={(e) => {
                  setMessages({
                    ...messages,
                    queue: {
                      ...messages.queue,
                      cap: e.target.value ? Number(e.target.value) : undefined,
                    },
                  });
                  markDirty();
                }}
                placeholder="—"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Commands ────────────────────────────── */}
      <Section
        id="commands"
        icon={Command}
        title="Commands"
        open={openSections.has("commands")}
        onToggle={() => toggle("commands")}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Native Commands</label>
            <select
              className={selectCls}
              value={String(commands.native ?? "auto")}
              onChange={(e) => {
                const v = e.target.value;
                setCommands({
                  ...commands,
                  native: v === "true" ? true : v === "false" ? false : ("auto" as any),
                });
                markDirty();
              }}
            >
              <option value="auto">Auto</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Native Skills</label>
            <select
              className={selectCls}
              value={String(commands.nativeSkills ?? "auto")}
              onChange={(e) => {
                const v = e.target.value;
                setCommands({
                  ...commands,
                  nativeSkills: v === "true" ? true : v === "false" ? false : ("auto" as any),
                });
                markDirty();
              }}
            >
              <option value="auto">Auto</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Bash Foreground (ms)</label>
            <input
              type="number"
              className={inputCls}
              value={commands.bashForegroundMs ?? 2000}
              onChange={(e) => {
                setCommands({ ...commands, bashForegroundMs: Number(e.target.value) });
                markDirty();
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle
            checked={commands.text !== false}
            onChange={(v) => {
              setCommands({ ...commands, text: v });
              markDirty();
            }}
            label="Text Commands"
          />
          <Toggle
            checked={commands.bash ?? false}
            onChange={(v) => {
              setCommands({ ...commands, bash: v });
              markDirty();
            }}
            label="Bash Command (!)"
          />
          <Toggle
            checked={commands.config ?? false}
            onChange={(v) => {
              setCommands({ ...commands, config: v });
              markDirty();
            }}
            label="/config Command"
          />
          <Toggle
            checked={commands.debug ?? false}
            onChange={(v) => {
              setCommands({ ...commands, debug: v });
              markDirty();
            }}
            label="/debug Command"
          />
          <Toggle
            checked={commands.restart ?? false}
            onChange={(v) => {
              setCommands({ ...commands, restart: v });
              markDirty();
            }}
            label="Restart Command"
          />
        </div>
      </Section>

      {/* ─── Tools ───────────────────────────────── */}
      <Section
        id="tools"
        icon={Wrench}
        title="Tools"
        badge={tools.profile || "full"}
        open={openSections.has("tools")}
        onToggle={() => toggle("tools")}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Tool Profile</label>
            <select
              className={selectCls}
              value={tools.profile || "full"}
              onChange={(e) => {
                setTools({ ...tools, profile: e.target.value as any });
                markDirty();
              }}
            >
              <option value="full">Full</option>
              <option value="coding">Coding</option>
              <option value="messaging">Messaging</option>
              <option value="minimal">Minimal</option>
            </select>
            <p className={helpCls}>Base set of allowed tools</p>
          </div>
        </div>

        {/* Web Tools */}
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Search className="h-3.5 w-3.5" /> Web Tools
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-full flex flex-wrap gap-6">
              <Toggle
                checked={tools.web?.search?.enabled ?? false}
                onChange={(v) => {
                  setTools({
                    ...tools,
                    web: { ...tools.web, search: { ...tools.web?.search, enabled: v } },
                  });
                  markDirty();
                }}
                label="Web Search"
              />
              <Toggle
                checked={tools.web?.fetch?.enabled ?? true}
                onChange={(v) => {
                  setTools({
                    ...tools,
                    web: { ...tools.web, fetch: { ...tools.web?.fetch, enabled: v } },
                  });
                  markDirty();
                }}
                label="Web Fetch"
              />
            </div>
            {tools.web?.search?.enabled && (
              <div>
                <label className={labelCls}>Search Provider</label>
                <select
                  className={selectCls}
                  value={tools.web?.search?.provider || "brave"}
                  onChange={(e) => {
                    setTools({
                      ...tools,
                      web: {
                        ...tools.web,
                        search: { ...tools.web?.search, provider: e.target.value as any },
                      },
                    });
                    markDirty();
                  }}
                >
                  <option value="brave">Brave</option>
                  <option value="perplexity">Perplexity</option>
                </select>
              </div>
            )}
            {tools.web?.fetch?.enabled !== false && (
              <>
                <div>
                  <label className={labelCls}>Max Chars</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={tools.web?.fetch?.maxChars ?? ""}
                    onChange={(e) => {
                      setTools({
                        ...tools,
                        web: {
                          ...tools.web,
                          fetch: {
                            ...tools.web?.fetch,
                            maxChars: e.target.value ? Number(e.target.value) : undefined,
                          },
                        },
                      });
                      markDirty();
                    }}
                    placeholder="50000"
                  />
                </div>
                <div className="flex items-end">
                  <Toggle
                    checked={tools.web?.fetch?.readability ?? true}
                    onChange={(v) => {
                      setTools({
                        ...tools,
                        web: { ...tools.web, fetch: { ...tools.web?.fetch, readability: v } },
                      });
                      markDirty();
                    }}
                    label="Readability"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Exec */}
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TerminalIcon className="h-3.5 w-3.5" /> Exec
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Host</label>
              <select
                className={selectCls}
                value={tools.exec?.host || "sandbox"}
                onChange={(e) => {
                  setTools({ ...tools, exec: { ...tools.exec, host: e.target.value as any } });
                  markDirty();
                }}
              >
                <option value="sandbox">Sandbox</option>
                <option value="gateway">Gateway</option>
                <option value="node">Node</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Security</label>
              <select
                className={selectCls}
                value={tools.exec?.security || "deny"}
                onChange={(e) => {
                  setTools({ ...tools, exec: { ...tools.exec, security: e.target.value as any } });
                  markDirty();
                }}
              >
                <option value="deny">Deny</option>
                <option value="allowlist">Allowlist</option>
                <option value="full">Full</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ask Mode</label>
              <select
                className={selectCls}
                value={tools.exec?.ask || "on-miss"}
                onChange={(e) => {
                  setTools({ ...tools, exec: { ...tools.exec, ask: e.target.value as any } });
                  markDirty();
                }}
              >
                <option value="off">Off</option>
                <option value="on-miss">On Miss</option>
                <option value="always">Always</option>
              </select>
            </div>
          </div>
        </div>

        {/* Extra toggles */}
        <div className="flex flex-wrap gap-6">
          <Toggle
            checked={tools.elevated?.enabled ?? true}
            onChange={(v) => {
              setTools({ ...tools, elevated: { ...tools.elevated, enabled: v } });
              markDirty();
            }}
            label="Elevated Exec"
          />
          <Toggle
            checked={tools.agentToAgent?.enabled ?? false}
            onChange={(v) => {
              setTools({ ...tools, agentToAgent: { ...tools.agentToAgent, enabled: v } });
              markDirty();
            }}
            label="Agent-to-Agent"
          />
        </div>
      </Section>

      {/* ─── Media ───────────────────────────────── */}
      <Section
        id="media"
        icon={Film}
        title="Media"
        open={openSections.has("media")}
        onToggle={() => toggle("media")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["image", "audio", "video"] as const).map((mediaType) => {
            const cfg = tools.media?.[mediaType];
            return (
              <div
                key={mediaType}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <h4 className="mb-2 text-sm font-semibold capitalize">
                  {mediaType === "image" ? "🖼️" : mediaType === "audio" ? "🎵" : "🎬"} {mediaType}
                </h4>
                <div className="space-y-2">
                  <Toggle
                    checked={cfg?.enabled ?? false}
                    onChange={(v) => {
                      setTools({
                        ...tools,
                        media: { ...tools.media, [mediaType]: { ...cfg, enabled: v } },
                      });
                      markDirty();
                    }}
                    label="Enabled"
                  />
                  {cfg?.enabled && (
                    <Toggle
                      checked={cfg?.asyncMode ?? false}
                      onChange={(v) => {
                        setTools({
                          ...tools,
                          media: { ...tools.media, [mediaType]: { ...cfg, asyncMode: v } },
                        });
                        markDirty();
                      }}
                      label="Async Mode"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <label className={labelCls}>Max Concurrent</label>
          <input
            type="number"
            className={inputCls + " w-32"}
            value={tools.media?.concurrency ?? 2}
            min={1}
            max={10}
            onChange={(e) => {
              setTools({
                ...tools,
                media: { ...tools.media, concurrency: Number(e.target.value) },
              });
              markDirty();
            }}
          />
          <p className={helpCls}>Maximum concurrent media understanding tasks</p>
        </div>
      </Section>

      {/* ─── Plugins ─────────────────────────────── */}
      <Section
        id="plugins"
        icon={Puzzle}
        title="Plugins"
        badge={plugins.entries ? `${Object.keys(plugins.entries).length} loaded` : undefined}
        open={openSections.has("plugins")}
        onToggle={() => toggle("plugins")}
      >
        <Toggle
          checked={plugins.enabled !== false}
          onChange={(v) => {
            setPlugins({ ...plugins, enabled: v });
            markDirty();
          }}
          label="Plugin Loading"
        />

        {/* Memory Slot */}
        <div>
          <label className={labelCls}>Memory Slot</label>
          <input
            className={inputCls}
            value={plugins.slots?.memory || ""}
            onChange={(e) => {
              setPlugins({
                ...plugins,
                slots: { ...plugins.slots, memory: e.target.value || undefined },
              });
              markDirty();
            }}
            placeholder="memory-core"
          />
          <p className={helpCls}>Plugin that owns the memory slot</p>
        </div>

        {/* Plugin Entries */}
        {plugins.entries && Object.keys(plugins.entries).length > 0 && (
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <h4 className="mb-3 text-sm font-semibold">Loaded Plugins</h4>
            <div className="space-y-2">
              {Object.entries(plugins.entries).map(([pluginId, entry]) => (
                <div
                  key={pluginId}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${entry.enabled !== false ? "bg-green-500" : "bg-gray-400"}`}
                    />
                    <span className="text-sm font-medium">{pluginId}</span>
                  </div>
                  <Toggle
                    checked={entry.enabled !== false}
                    onChange={(v) => {
                      setPlugins({
                        ...plugins,
                        entries: { ...plugins.entries, [pluginId]: { ...entry, enabled: v } },
                      });
                      markDirty();
                    }}
                    label=""
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Load Paths */}
        <div>
          <label className={labelCls}>Additional Load Paths</label>
          <input
            className={inputCls}
            value={(plugins.load?.paths || []).join(", ")}
            onChange={(e) => {
              const paths = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              setPlugins({
                ...plugins,
                load: { ...plugins.load, paths: paths.length > 0 ? paths : undefined },
              });
              markDirty();
            }}
            placeholder="/path/to/extensions, /another/path"
          />
          <p className={helpCls}>Comma-separated extra plugin directories</p>
        </div>

        {/* Allow/Deny */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Allowlist</label>
            <input
              className={inputCls}
              value={(plugins.allow || []).join(", ")}
              onChange={(e) => {
                const list = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setPlugins({ ...plugins, allow: list.length > 0 ? list : undefined });
                markDirty();
              }}
              placeholder="All allowed"
            />
          </div>
          <div>
            <label className={labelCls}>Denylist</label>
            <input
              className={inputCls}
              value={(plugins.deny || []).join(", ")}
              onChange={(e) => {
                const list = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setPlugins({ ...plugins, deny: list.length > 0 ? list : undefined });
                markDirty();
              }}
              placeholder="None denied"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
