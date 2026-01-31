import { z } from "zod";

const groupConfigSchema = z.object({
  allow: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const ZalowebConfigSchema = z.object({
  /** Enable the channel */
  enabled: z.boolean().optional(),
  /** DM policy */
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  /** Allowed senders */
  allowFrom: z.array(z.string()).optional(),
  /** Group policy */
  groupPolicy: z.enum(["disabled", "allowlist", "open"]).optional(),
  /** Groups configuration */
  groups: z.record(groupConfigSchema).optional(),
  /** Auto-reply enabled */
  autoReply: z.boolean().optional(),
  /** Message prefix */
  messagePrefix: z.string().optional(),
});

export type ZalowebConfigType = z.infer<typeof ZalowebConfigSchema>;
