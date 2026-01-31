import type {
  ChannelPlugin,
  ChannelDirectoryEntry,
  MoltbotConfig,
} from "clawdbot/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
} from "clawdbot/plugin-sdk";
import { ZalowebConfigSchema } from "./config-schema.js";
import type { ZalowebAccount, ZalowebConfig } from "./types.js";

const meta = {
  id: "zaloweb",
  label: "Zalo Web",
  selectionLabel: "Zalo (Web Embedded)",
  docsPath: "/channels/zaloweb",
  docsLabel: "zaloweb",
  blurb: "Zalo Web integration via Electron BrowserView.",
  aliases: ["zlw"],
  order: 84,
  quickstartAllowFrom: true,
};

function resolveZalowebAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string;
}): ZalowebAccount {
  const { cfg, accountId } = params;
  const channelConfig = cfg.channels?.zaloweb as ZalowebConfig | undefined;
  const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID;

  return {
    accountId: resolvedAccountId,
    name: "Zalo Web",
    enabled: channelConfig?.enabled !== false,
    config: channelConfig || {},
  };
}

export const zalowebPlugin: ChannelPlugin<ZalowebAccount> = {
  id: "zaloweb",
  meta: {
    ...meta,
    showConfigured: true,
    quickstartAllowFrom: true,
    // This channel requires Electron desktop app
    requiresDesktopApp: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    polls: false,
    reactions: true,
    media: true,
  },
  configSchema: buildChannelConfigSchema(ZalowebConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveZalowebAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isEnabled: (account) => account.enabled !== false,
    disabledReason: () => "disabled",
    isConfigured: async (account) => account.config.enabled === true,
    unconfiguredReason: () => "not configured",
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.config.enabled === true,
      dmPolicy: account.config.dmPolicy,
      allowFrom: account.config.allowFrom,
    }),
    resolveAllowFrom: ({ cfg }) => {
      const channelConfig = cfg.channels?.zaloweb as ZalowebConfig | undefined;
      return channelConfig?.allowFrom ?? [];
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter((entry): entry is string => Boolean(entry)),
  },
  security: {
    resolveDmPolicy: ({ account }) => {
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: "channels.zaloweb.dmPolicy",
        allowFromPath: "channels.zaloweb.",
        approveHint: formatPairingApproveHint("zaloweb"),
        normalizeEntry: (raw) => String(raw).trim(),
      };
    },
  },
  groups: {
    resolveRequireMention: () => true,
    resolveToolPolicy: () => undefined,
  },
  directory: {
    self: async () => {
      // This will be populated by the Electron app when logged in
      return null;
    },
    listPeers: async () => {
      // Peers will be fetched from Electron app
      return [];
    },
    listGroups: async () => {
      // Groups will be fetched from Electron app
      return [];
    },
  },
  outbound: {
    deliveryMode: "gateway",
    textChunkLimit: 5000,
    resolveTarget: ({ to, allowFrom, mode }) => {
      const trimmed = to?.trim() ?? "";
      const allowList = (allowFrom ?? [])
        .map((entry) => String(entry).trim())
        .filter(Boolean);

      if (trimmed) {
        return { ok: true, to: trimmed };
      }

      if (allowList.length > 0) {
        return { ok: true, to: allowList[0] };
      }

      return {
        ok: false,
        error: "Missing target. Provide threadId or configure channels.zaloweb.allowFrom.",
      };
    },
    sendText: async ({ to, text }) => {
      // This will be handled by Electron IPC - the gateway will forward to desktop app
      // For now, return a placeholder that the desktop app integration will handle
      return {
        channel: "zaloweb",
        ok: false,
        error: "Zalo Web sending requires the desktop app. Use the Electron app to send messages.",
      };
    },
    sendMedia: async ({ to, text, mediaUrl }) => {
      return {
        channel: "zaloweb",
        ok: false,
        error: "Zalo Web media sending requires the desktop app.",
      };
    },
  },
};
