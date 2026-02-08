import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClawdbotConfig, RuntimeEnv, HistoryEntry } from "openclaw/plugin-sdk";
import * as Lark from "@larksuiteoapi/node-sdk";
import { registerPluginHttpRoute } from "openclaw/plugin-sdk";
import type { ResolvedFeishuAccount } from "./types.js";
import { resolveFeishuAccount, listEnabledFeishuAccounts } from "./accounts.js";
import { handleFeishuMessage, type FeishuMessageEvent, type FeishuBotAddedEvent } from "./bot.js";
import { createFeishuWSClient, createEventDispatcher } from "./client.js";
import { probeFeishu } from "./probe.js";

export type MonitorFeishuOpts = {
  config?: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string;
};

// Per-account WebSocket clients and bot info
const wsClients = new Map<string, Lark.WSClient>();
const botOpenIds = new Map<string, string>();

async function fetchBotOpenId(account: ResolvedFeishuAccount): Promise<string | undefined> {
  try {
    const result = await probeFeishu(account);
    return result.ok ? result.botOpenId : undefined;
  } catch {
    return undefined;
  }
}

/** Read incoming request body as a string. */
function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * Register event handlers on the given EventDispatcher.
 * Shared between WebSocket and webhook modes.
 */
function registerFeishuEvents(
  eventDispatcher: Lark.EventDispatcher,
  params: {
    cfg: ClawdbotConfig;
    accountId: string;
    chatHistories: Map<string, HistoryEntry[]>;
    runtime?: RuntimeEnv;
  },
): void {
  const { cfg, accountId, chatHistories, runtime } = params;
  const error = runtime?.error ?? console.error;
  const log = runtime?.log ?? console.log;

  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        const event = data as unknown as FeishuMessageEvent;
        await handleFeishuMessage({
          cfg,
          event,
          botOpenId: botOpenIds.get(accountId),
          runtime,
          chatHistories,
          accountId,
        });
      } catch (err) {
        error(`feishu[${accountId}]: error handling message: ${String(err)}`);
      }
    },
    "im.message.message_read_v1": async () => {
      // Ignore read receipts
    },
    "im.chat.member.bot.added_v1": async (data) => {
      try {
        const event = data as unknown as FeishuBotAddedEvent;
        log(`feishu[${accountId}]: bot added to chat ${event.chat_id}`);
      } catch (err) {
        error(`feishu[${accountId}]: error handling bot added event: ${String(err)}`);
      }
    },
    "im.chat.member.bot.deleted_v1": async (data) => {
      try {
        const event = data as unknown as { chat_id: string };
        log(`feishu[${accountId}]: bot removed from chat ${event.chat_id}`);
      } catch (err) {
        error(`feishu[${accountId}]: error handling bot removed event: ${String(err)}`);
      }
    },
  });
}

/**
 * Start webhook mode for a single account.
 * Registers an HTTP route on the gateway server to receive Lark events.
 */
async function startWebhookMode(params: {
  cfg: ClawdbotConfig;
  account: ResolvedFeishuAccount;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const { cfg, account, runtime, abortSignal } = params;
  const { accountId } = account;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const webhookPath = account.config.webhookPath ?? "/feishu/events";
  const chatHistories = new Map<string, HistoryEntry[]>();
  const eventDispatcher = createEventDispatcher(account);

  // Register the same event handlers as WebSocket mode
  registerFeishuEvents(eventDispatcher, { cfg, accountId, chatHistories, runtime });

  // Build the AES cipher for encrypted events (if encryptKey is set)
  const encryptKey = account.encryptKey;
  let aesCipher: Lark.AESCipher | null = null;
  if (encryptKey) {
    aesCipher = new Lark.AESCipher(encryptKey);
  }

  // Register HTTP route on the gateway server
  const unregisterHttp = registerPluginHttpRoute({
    path: webhookPath,
    pluginId: "feishu",
    accountId,
    log: (msg) => log(msg),
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      // Only accept POST requests
      if (req.method !== "POST") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain");
        res.end("Feishu webhook endpoint is active");
        return;
      }

      try {
        const rawBody = await readRequestBody(req);
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        // Handle encrypted events
        if (body.encrypt && typeof body.encrypt === "string" && aesCipher) {
          try {
            const decrypted = JSON.parse(aesCipher.decrypt(body.encrypt));
            body = { ...decrypted, ...body };
            delete body.encrypt;
          } catch (err) {
            error(`feishu[${accountId}]: failed to decrypt event: ${String(err)}`);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Decryption failed" }));
            return;
          }
        }

        // Handle URL verification challenge
        if (body.type === "url_verification") {
          log(`feishu[${accountId}]: URL verification challenge received`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ challenge: body.challenge }));
          return;
        }

        // Respond immediately with 200 to avoid Lark timeout
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ code: 0, msg: "ok" }));

        // Process event asynchronously via the EventDispatcher
        const dataWithHeaders = Object.assign(Object.create({ headers: req.headers }), body);

        try {
          await eventDispatcher.invoke(dataWithHeaders, { needCheck: false });
        } catch (err) {
          error(`feishu[${accountId}]: error processing webhook event: ${String(err)}`);
        }
      } catch (err) {
        error(`feishu[${accountId}]: webhook handler error: ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
    },
  });

  log(`feishu[${accountId}]: webhook handler registered at ${webhookPath}`);

  // Wait until abort signal
  return new Promise<void>((resolve) => {
    const handleAbort = () => {
      log(`feishu[${accountId}]: abort signal received, stopping webhook`);
      unregisterHttp();
      botOpenIds.delete(accountId);
      resolve();
    };

    if (abortSignal?.aborted) {
      unregisterHttp();
      botOpenIds.delete(accountId);
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });
  });
}

/**
 * Start WebSocket mode for a single account.
 */
async function startWebSocketMode(params: {
  cfg: ClawdbotConfig;
  account: ResolvedFeishuAccount;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const { cfg, account, runtime, abortSignal } = params;
  const { accountId } = account;
  const log = runtime?.log ?? console.log;

  log(`feishu[${accountId}]: starting WebSocket connection...`);

  const wsClient = createFeishuWSClient(account);
  wsClients.set(accountId, wsClient);

  const chatHistories = new Map<string, HistoryEntry[]>();
  const eventDispatcher = createEventDispatcher(account);

  // Register the same event handlers
  registerFeishuEvents(eventDispatcher, { cfg, accountId, chatHistories, runtime });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      wsClients.delete(accountId);
      botOpenIds.delete(accountId);
    };

    const handleAbort = () => {
      log(`feishu[${accountId}]: abort signal received, stopping`);
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    try {
      void wsClient.start({ eventDispatcher });
      log(`feishu[${accountId}]: WebSocket client started`);
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}

/**
 * Monitor a single Feishu account.
 */
async function monitorSingleAccount(params: {
  cfg: ClawdbotConfig;
  account: ResolvedFeishuAccount;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const { cfg, account, runtime, abortSignal } = params;
  const { accountId } = account;
  const log = runtime?.log ?? console.log;

  // Fetch bot open_id
  const botOpenId = await fetchBotOpenId(account);
  botOpenIds.set(accountId, botOpenId ?? "");
  log(`feishu[${accountId}]: bot open_id resolved: ${botOpenId ?? "unknown"}`);

  const connectionMode = account.config.connectionMode ?? "websocket";

  if (connectionMode === "webhook") {
    return startWebhookMode({ cfg, account, runtime, abortSignal });
  }

  return startWebSocketMode({ cfg, account, runtime, abortSignal });
}

/**
 * Main entry: start monitoring for all enabled accounts.
 */
export async function monitorFeishuProvider(opts: MonitorFeishuOpts = {}): Promise<void> {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for Feishu monitor");
  }

  const log = opts.runtime?.log ?? console.log;

  // If accountId is specified, only monitor that account
  if (opts.accountId) {
    const account = resolveFeishuAccount({ cfg, accountId: opts.accountId });
    if (!account.enabled || !account.configured) {
      throw new Error(`Feishu account "${opts.accountId}" not configured or disabled`);
    }
    return monitorSingleAccount({
      cfg,
      account,
      runtime: opts.runtime,
      abortSignal: opts.abortSignal,
    });
  }

  // Otherwise, start all enabled accounts
  const accounts = listEnabledFeishuAccounts(cfg);
  if (accounts.length === 0) {
    throw new Error("No enabled Feishu accounts configured");
  }

  log(
    `feishu: starting ${accounts.length} account(s): ${accounts.map((a) => a.accountId).join(", ")}`,
  );

  // Start all accounts in parallel
  await Promise.all(
    accounts.map((account) =>
      monitorSingleAccount({
        cfg,
        account,
        runtime: opts.runtime,
        abortSignal: opts.abortSignal,
      }),
    ),
  );
}

/**
 * Stop monitoring for a specific account or all accounts.
 */
export function stopFeishuMonitor(accountId?: string): void {
  if (accountId) {
    wsClients.delete(accountId);
    botOpenIds.delete(accountId);
  } else {
    wsClients.clear();
    botOpenIds.clear();
  }
}
