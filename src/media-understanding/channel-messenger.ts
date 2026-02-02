/**
 * Utility functions for sending and editing messages across different channels.
 * Used by background media processing to send deferred replies.
 */

import type { OpenClawConfig } from "../config/config.js";
import { logWarn } from "../logger.js";
import {
  editMessageTelegram,
  sendMessageTelegram,
} from "../telegram/send.js";
import { resolveTelegramToken } from "../telegram/token.js";

export type SendMessageParams = {
  channelType: string;
  channelId: string;
  text: string;
  replyToMessageId?: string;
  cfg: OpenClawConfig;
};

export type SendMessageResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export type EditMessageParams = {
  channelType: string;
  channelId: string;
  messageId: string;
  text: string;
  cfg: OpenClawConfig;
};

export type EditMessageResult = {
  ok: boolean;
  error?: string;
};

/**
 * Send a message to a channel and return the message ID.
 */
export async function sendChannelMessage(
  params: SendMessageParams,
): Promise<SendMessageResult> {
  const { channelType, channelId, text, replyToMessageId, cfg } = params;

  try {
    if (channelType === "telegram") {
      const { token } = resolveTelegramToken(cfg, {});
      if (!token) {
        return { ok: false, error: "Telegram bot token not configured" };
      }
      const result = await sendMessageTelegram(channelId, text, {
        token,
        replyToMessageId: replyToMessageId ? Number(replyToMessageId) : undefined,
      });
      if (result?.messageId) {
        return { ok: true, messageId: result.messageId };
      }
      return { ok: false, error: "Failed to get message ID from Telegram response" };
    }

    // TODO: Add support for other channels (Discord, Signal, etc.)
    return { ok: false, error: `Channel type "${channelType}" not supported for deferred messaging` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logWarn(`Failed to send channel message: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Edit an existing message in a channel.
 */
export async function editChannelMessage(
  params: EditMessageParams,
): Promise<EditMessageResult> {
  const { channelType, channelId, messageId, text, cfg } = params;

  try {
    if (channelType === "telegram") {
      const { token } = resolveTelegramToken(cfg, {});
      if (!token) {
        return { ok: false, error: "Telegram bot token not configured" };
      }
      await editMessageTelegram(channelId, Number(messageId), text, { token });
      return { ok: true };
    }

    // TODO: Add support for other channels (Discord, Signal, etc.)
    return { ok: false, error: `Channel type "${channelType}" not supported for message editing` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logWarn(`Failed to edit channel message: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }
}

export type DeleteMessageParams = {
  channelType: string;
  channelId: string;
  messageId: string;
  cfg: OpenClawConfig;
};

export type DeleteMessageResult = {
  ok: boolean;
  error?: string;
};

/**
 * Delete a message from a channel.
 */
export async function deleteChannelMessage(
  params: DeleteMessageParams,
): Promise<DeleteMessageResult> {
  const { channelType, channelId, messageId, cfg } = params;

  try {
    if (channelType === "telegram") {
      const { deleteMessageTelegram } = await import("../telegram/send.js");
      const { token } = resolveTelegramToken(cfg, {});
      if (!token) {
        return { ok: false, error: "Telegram bot token not configured" };
      }
      await deleteMessageTelegram(channelId, Number(messageId), { token });
      return { ok: true };
    }

    // TODO: Add support for other channels (Discord, Signal, etc.)
    return { ok: false, error: `Channel type "${channelType}" not supported for message deletion` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logWarn(`Failed to delete channel message: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }
}
