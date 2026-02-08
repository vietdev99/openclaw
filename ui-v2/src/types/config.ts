// Config types matching openclaw.json schema

// ─── Auth ───────────────────────────────────────

export interface AuthConfig {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  profileStrategy?: Record<string, "failover" | "loadbalance">;
  cooldowns?: {
    billingBackoffHours?: number;
    billingBackoffHoursByProvider?: Record<string, number>;
    billingMaxHours?: number;
    failureWindowHours?: number;
  };
}

export interface AuthProfileConfig {
  provider: string;
  mode: "api_key" | "oauth" | "token";
  email?: string;
  disabled?: boolean;
}

// ─── Models ─────────────────────────────────────

export interface ModelsConfig {
  providers?: Record<string, ProviderConfig>;
}

export interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  models?: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  cost?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  contextWindow?: number;
  maxTokens?: number;
}

// ─── Agents ─────────────────────────────────────

export interface AgentsConfig {
  defaults?: {
    model?: {
      primary?: string;
      fallbacks?: string[];
    };
    imageModel?: {
      primary?: string;
    };
    models?: Record<string, Record<string, unknown>>;
    strategy?: "failover" | "loadbalance";
    workspace?: string;
    maxConcurrent?: number;
    blockStreamingBreak?: string;
    subagents?: {
      maxConcurrent?: number;
    };
  };
}

// ─── Channels ───────────────────────────────────

export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";
export type GroupPolicy = "open" | "disabled" | "allowlist";
export type ReplyToMode = "off" | "first" | "all";

export interface ChannelHeartbeatConfig {
  showOk?: boolean;
  showAlerts?: boolean;
  useIndicator?: boolean;
}

export interface ChannelDefaultsConfig {
  groupPolicy?: GroupPolicy;
  heartbeat?: ChannelHeartbeatConfig;
}

// Common fields shared by all channel account configs
export interface BaseChannelAccountConfig {
  name?: string;
  enabled?: boolean;
  capabilities?: string[];
  configWrites?: boolean;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  allowFrom?: (string | number)[];
  groupAllowFrom?: (string | number)[];
  historyLimit?: number;
  dmHistoryLimit?: number;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  mediaMaxMb?: number;
  blockStreaming?: boolean;
  responsePrefix?: string;
  heartbeat?: ChannelHeartbeatConfig;
}

export interface TelegramAccountConfig extends BaseChannelAccountConfig {
  botToken?: string;
  tokenFile?: string;
  streamMode?: "off" | "partial" | "block";
  replyToMode?: ReplyToMode;
  reactionLevel?: "off" | "ack" | "minimal" | "extensive";
  reactionNotifications?: "off" | "own" | "all";
  linkPreview?: boolean;
  proxy?: string;
  webhookUrl?: string;
  timeoutSeconds?: number;
  actions?: {
    reactions?: boolean;
    sendMessage?: boolean;
    deleteMessage?: boolean;
    editMessage?: boolean;
    sticker?: boolean;
  };
  groups?: Record<string, TelegramGroupConfig>;
}

export interface TelegramGroupConfig {
  requireMention?: boolean;
  groupPolicy?: GroupPolicy;
  enabled?: boolean;
  allowFrom?: (string | number)[];
  systemPrompt?: string;
}

export interface TelegramConfig extends TelegramAccountConfig {
  accounts?: Record<string, TelegramAccountConfig>;
}

export interface DiscordAccountConfig extends BaseChannelAccountConfig {
  token?: string;
  allowBots?: boolean;
  maxLinesPerMessage?: number;
  replyToMode?: ReplyToMode;
  dm?: {
    enabled?: boolean;
    policy?: DmPolicy;
    allowFrom?: (string | number)[];
    groupEnabled?: boolean;
  };
  guilds?: Record<string, DiscordGuildConfig>;
  actions?: {
    reactions?: boolean;
    stickers?: boolean;
    polls?: boolean;
    permissions?: boolean;
    messages?: boolean;
    threads?: boolean;
    pins?: boolean;
    search?: boolean;
    memberInfo?: boolean;
    roleInfo?: boolean;
    roles?: boolean;
    channelInfo?: boolean;
    voiceStatus?: boolean;
    events?: boolean;
    moderation?: boolean;
    presence?: boolean;
  };
  intents?: {
    presence?: boolean;
    guildMembers?: boolean;
  };
}

export interface DiscordGuildConfig {
  slug?: string;
  requireMention?: boolean;
  users?: (string | number)[];
  channels?: Record<string, { allow?: boolean; requireMention?: boolean; enabled?: boolean }>;
}

export interface DiscordConfig extends DiscordAccountConfig {
  accounts?: Record<string, DiscordAccountConfig>;
}

export interface WhatsAppAccountConfig extends BaseChannelAccountConfig {
  sendReadReceipts?: boolean;
  messagePrefix?: string;
  selfChatMode?: boolean;
  authDir?: string;
  debounceMs?: number;
  ackReaction?: {
    emoji?: string;
    direct?: boolean;
    group?: "always" | "mentions" | "never";
  };
}

export interface WhatsAppConfig extends WhatsAppAccountConfig {
  accounts?: Record<string, WhatsAppAccountConfig>;
}

export interface SlackAccountConfig extends BaseChannelAccountConfig {
  mode?: "socket" | "http";
  botToken?: string;
  appToken?: string;
  userToken?: string;
  signingSecret?: string;
  webhookPath?: string;
  allowBots?: boolean;
  requireMention?: boolean;
  replyToMode?: ReplyToMode;
  channels?: Record<string, { enabled?: boolean; requireMention?: boolean }>;
  dm?: {
    enabled?: boolean;
    policy?: DmPolicy;
    allowFrom?: (string | number)[];
  };
  actions?: {
    reactions?: boolean;
    messages?: boolean;
    pins?: boolean;
    search?: boolean;
  };
}

export interface SlackConfig extends SlackAccountConfig {
  accounts?: Record<string, SlackAccountConfig>;
}

export interface SignalAccountConfig extends BaseChannelAccountConfig {
  account?: string;
  httpUrl?: string;
  httpHost?: string;
  httpPort?: number;
  cliPath?: string;
  autoStart?: boolean;
  reactionLevel?: "off" | "ack" | "minimal" | "extensive";
  reactionNotifications?: "off" | "own" | "all" | "allowlist";
}

export interface SignalConfig extends SignalAccountConfig {
  accounts?: Record<string, SignalAccountConfig>;
}

export interface GoogleChatAccountConfig extends BaseChannelAccountConfig {
  allowBots?: boolean;
  requireMention?: boolean;
  serviceAccountFile?: string;
  audienceType?: "app-url" | "project-number";
  audience?: string;
  webhookPath?: string;
  webhookUrl?: string;
  botUser?: string;
  replyToMode?: ReplyToMode;
  typingIndicator?: "none" | "message" | "reaction";
  dm?: {
    enabled?: boolean;
    policy?: DmPolicy;
    allowFrom?: (string | number)[];
  };
  groups?: Record<string, { enabled?: boolean; requireMention?: boolean }>;
}

export interface GoogleChatConfig extends GoogleChatAccountConfig {
  accounts?: Record<string, GoogleChatAccountConfig>;
  defaultAccount?: string;
}

// iMessage & MSTeams — minimal stubs (rarely configured)
export interface IMessageConfig {
  [key: string]: unknown;
}

export interface MSTeamsConfig {
  [key: string]: unknown;
}

export interface FeishuAccountConfig extends BaseChannelAccountConfig {
  appId?: string;
  appSecret?: string;
}

export type FeishuConfig = FeishuAccountConfig | { accounts?: Record<string, FeishuAccountConfig> };

export interface ChannelsConfig {
  defaults?: ChannelDefaultsConfig;
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  whatsapp?: WhatsAppConfig;
  slack?: SlackConfig;
  signal?: SignalConfig;
  googlechat?: GoogleChatConfig;
  imessage?: IMessageConfig;
  feishu?: FeishuConfig;
  msteams?: MSTeamsConfig;
  [key: string]: unknown;
}

// ─── Gateway ────────────────────────────────────

export type GatewayBindMode = "auto" | "lan" | "loopback" | "custom" | "tailnet";
export type GatewayAuthMode = "token" | "password";
export type GatewayReloadMode = "off" | "restart" | "hot" | "hybrid";
export type GatewayTailscaleMode = "off" | "serve" | "funnel";

export interface GatewayConfig {
  port?: number;
  mode?: "local" | "remote";
  bind?: GatewayBindMode;
  customBindHost?: string;
  controlUi?: {
    enabled?: boolean;
    basePath?: string;
    allowedOrigins?: string[];
    allowInsecureAuth?: boolean;
  };
  auth?: {
    mode?: GatewayAuthMode;
    token?: string;
    password?: string;
    allowTailscale?: boolean;
  };
  tailscale?: {
    mode?: GatewayTailscaleMode;
    resetOnExit?: boolean;
  };
  reload?: {
    mode?: GatewayReloadMode;
    debounceMs?: number;
  };
  tls?: {
    enabled?: boolean;
    autoGenerate?: boolean;
    certPath?: string;
    keyPath?: string;
  };
  http?: {
    endpoints?: {
      chatCompletions?: { enabled?: boolean };
      responses?: { enabled?: boolean; maxBodyBytes?: number };
    };
  };
  trustedProxies?: string[];
}

// ─── Terminal ───────────────────────────────────

export interface TerminalConfig {
  mode?: "legacy" | "isolated";
  shell?: "auto" | "bash" | "powershell" | "cmd";
  host?: {
    port?: number;
    maxRestarts?: number;
    timeout?: number;
  };
}

// ─── Messages ───────────────────────────────────

export interface MessagesConfig {
  responsePrefix?: string;
  ackReaction?: string;
  ackReactionScope?: "group-mentions" | "group-all" | "direct" | "all";
  removeAckAfterReply?: boolean;
  groupChat?: {
    mentionPatterns?: string[];
    historyLimit?: number;
  };
  queue?: {
    mode?: string;
    debounceMs?: number;
    cap?: number;
    drop?: string;
  };
  inbound?: {
    debounceMs?: number;
    byChannel?: Record<string, number>;
  };
  tts?: Record<string, unknown>;
}

// ─── Commands ───────────────────────────────────

export type NativeCommandsSetting = boolean | "auto";

export interface CommandsConfig {
  native?: NativeCommandsSetting;
  nativeSkills?: NativeCommandsSetting;
  text?: boolean;
  bash?: boolean;
  bashForegroundMs?: number;
  config?: boolean;
  debug?: boolean;
  restart?: boolean;
  useAccessGroups?: boolean;
  ownerAllowFrom?: (string | number)[];
}

// ─── Tools ──────────────────────────────────────

export type ToolProfileId = "minimal" | "coding" | "messaging" | "full";

export interface ExecToolConfig {
  host?: "sandbox" | "gateway" | "node";
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
  backgroundMs?: number;
  timeoutSec?: number;
  notifyOnExit?: boolean;
}

export interface ToolsConfig {
  profile?: ToolProfileId;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
  web?: {
    search?: {
      enabled?: boolean;
      provider?: "brave" | "perplexity";
      apiKey?: string;
      maxResults?: number;
      timeoutSeconds?: number;
      cacheTtlMinutes?: number;
    };
    fetch?: {
      enabled?: boolean;
      maxChars?: number;
      timeoutSeconds?: number;
      readability?: boolean;
    };
  };
  media?: {
    concurrency?: number;
    image?: MediaUnderstandingConfig;
    audio?: MediaUnderstandingConfig;
    video?: MediaUnderstandingConfig;
  };
  exec?: ExecToolConfig;
  elevated?: {
    enabled?: boolean;
  };
  agentToAgent?: {
    enabled?: boolean;
  };
  subagents?: {
    model?: string | { primary?: string; fallbacks?: string[] };
  };
  message?: {
    allowCrossContextSend?: boolean;
    crossContext?: {
      allowWithinProvider?: boolean;
      allowAcrossProviders?: boolean;
    };
  };
}

export interface MediaUnderstandingConfig {
  enabled?: boolean;
  asyncMode?: boolean;
  maxBytes?: number;
  maxChars?: number;
  prompt?: string;
  timeoutSeconds?: number;
  models?: MediaUnderstandingModelConfig[];
}

export interface MediaUnderstandingModelConfig {
  provider?: string;
  model?: string;
  type?: "provider" | "cli";
  command?: string;
  prompt?: string;
  maxChars?: number;
  timeoutSeconds?: number;
}

// ─── Plugins ────────────────────────────────────

export interface PluginEntryConfig {
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface PluginsConfig {
  enabled?: boolean;
  allow?: string[];
  deny?: string[];
  load?: {
    paths?: string[];
  };
  slots?: {
    memory?: string;
  };
  entries?: Record<string, PluginEntryConfig>;
  installs?: Record<
    string,
    {
      source: "npm" | "archive" | "path";
      spec?: string;
      version?: string;
      installedAt?: string;
    }
  >;
}

// ─── Root Config ────────────────────────────────

export interface OpenClawConfig {
  meta?: {
    lastTouchedVersion?: string;
    lastTouchedAt?: string;
  };
  auth?: AuthConfig;
  models?: ModelsConfig;
  agents?: AgentsConfig;
  channels?: ChannelsConfig;
  gateway?: GatewayConfig;
  tools?: ToolsConfig;
  messages?: MessagesConfig;
  commands?: CommandsConfig;
  plugins?: PluginsConfig;
  terminal?: TerminalConfig;
}

// Config snapshot from gateway
export interface ConfigSnapshot {
  config: OpenClawConfig;
  hash: string;
  valid: boolean;
  path: string;
}
