/**
 * Utility functions for sending and editing messages across different channels.
 * Used by background media processing to send deferred replies.
 */
import type { OpenClawConfig } from "../config/config.js";
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
export declare function sendChannelMessage(params: SendMessageParams): Promise<SendMessageResult>;
/**
 * Edit an existing message in a channel.
 */
export declare function editChannelMessage(params: EditMessageParams): Promise<EditMessageResult>;
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
export declare function deleteChannelMessage(params: DeleteMessageParams): Promise<DeleteMessageResult>;
