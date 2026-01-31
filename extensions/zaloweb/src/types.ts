/**
 * Zalo Web message types
 */

export interface ZalowebMessage {
  /** Message ID from Zalo */
  msgId: string;
  /** Thread/conversation ID */
  threadId: string;
  /** Sender user ID */
  senderId: string;
  /** Sender display name */
  senderName: string;
  /** Message content */
  content: string;
  /** Message type: text, image, sticker, etc */
  msgType: "text" | "image" | "sticker" | "file" | "link" | "unknown";
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Is this a group message */
  isGroup: boolean;
  /** Group name if applicable */
  groupName?: string;
  /** Quote/reply info if this is a reply */
  quote?: {
    msgId: string;
    content: string;
    senderId: string;
  };
  /** Media URL if applicable */
  mediaUrl?: string;
  /** Raw message data from Zalo */
  raw?: unknown;
}

export interface ZalowebThread {
  /** Thread ID */
  threadId: string;
  /** Thread name (user name or group name) */
  name: string;
  /** Is this a group */
  isGroup: boolean;
  /** Avatar URL */
  avatarUrl?: string;
  /** Last message preview */
  lastMessage?: string;
  /** Last activity timestamp */
  lastActivity?: number;
  /** Unread count */
  unreadCount?: number;
}

export interface ZalowebUser {
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Phone number if available */
  phone?: string;
}

export interface ZalowebConfig {
  /** Enable the channel */
  enabled?: boolean;
  /** DM policy: pairing, allowlist, open, disabled */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  /** Allowed senders (user IDs or group IDs) */
  allowFrom?: string[];
  /** Group policy */
  groupPolicy?: "disabled" | "allowlist" | "open";
  /** Groups configuration */
  groups?: Record<string, {
    allow?: boolean;
    enabled?: boolean;
  }>;
  /** Auto-reply enabled */
  autoReply?: boolean;
  /** Message prefix for bot responses */
  messagePrefix?: string;
}

export interface ZalowebAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: ZalowebConfig;
  /** Is logged in (has session) */
  loggedIn?: boolean;
  /** Self user info */
  selfUser?: ZalowebUser;
}

/**
 * IPC message types between main process and renderer/preload
 */
export interface ZalowebIpcMessage {
  type: "message" | "thread_list" | "login_status" | "error" | "send_result";
  payload: unknown;
}

export interface ZalowebSendRequest {
  threadId: string;
  content: string;
  /** Optional: reply to specific message */
  replyToMsgId?: string;
}

export interface ZalowebLoginStatus {
  loggedIn: boolean;
  user?: ZalowebUser;
  error?: string;
}
