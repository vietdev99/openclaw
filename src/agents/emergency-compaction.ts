/**
 * Emergency Compaction for Oversized Sessions
 *
 * When a session exceeds the context window limit, normal compaction fails
 * because the AI call itself would overflow. This module provides emergency
 * recovery by:
 *
 * 1. Backing up the original session file
 * 2. Splitting the conversation into smaller chunks that fit within context
 * 3. Summarizing each chunk separately
 * 4. Combining summaries into a new, compact session
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { compactEmbeddedPiSession } from "./pi-embedded-runner.js";
import { lookupContextTokens } from "./context.js";
import { DEFAULT_CONTEXT_TOKENS } from "./defaults.js";
import { log } from "./pi-embedded-runner/logger.js";

export type EmergencyCompactionResult = {
  ok: boolean;
  backupPath?: string;
  chunksProcessed?: number;
  tokensBefore?: number;
  tokensAfter?: number;
  error?: string;
};

export type EmergencyCompactionParams = {
  sessionId: string;
  sessionKey?: string;
  sessionFile: string;
  workspaceDir: string;
  agentDir?: string;
  config?: OpenClawConfig;
  provider?: string;
  model?: string;
  authProfileId?: string;
  /** Maximum tokens per chunk (default: 80% of context window) */
  maxChunkTokens?: number;
  /** Whether to keep the backup file after success (default: true) */
  keepBackup?: boolean;
};

type SessionMessage = {
  role: string;
  content: unknown;
  timestamp?: number;
  usage?: { input?: number; output?: number; total?: number };
  [key: string]: unknown;
};

type SessionData = {
  messages: SessionMessage[];
  [key: string]: unknown;
};

/**
 * Estimates token count for a message based on content length.
 * This is a rough estimate: ~4 characters per token.
 */
function estimateMessageTokens(message: SessionMessage): number {
  const content = message.content;
  let chars = 0;
  if (typeof content === "string") {
    chars = content.length;
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "string") {
        chars += block.length;
      } else if (typeof block === "object" && block && "text" in block) {
        chars += String(block.text ?? "").length;
      }
    }
  } else if (typeof content === "object" && content) {
    chars = JSON.stringify(content).length;
  }
  // Rough estimate: 4 characters per token
  return Math.ceil(chars / 4);
}

/**
 * Calculates total tokens for a session based on message content.
 */
function calculateSessionTokens(messages: SessionMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Splits messages into chunks that each fit within the token limit.
 */
function splitIntoChunks(
  messages: SessionMessage[],
  maxChunkTokens: number,
): SessionMessage[][] {
  const chunks: SessionMessage[][] = [];
  let currentChunk: SessionMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const msgTokens = estimateMessageTokens(message);

    // If single message exceeds limit, it goes in its own chunk
    if (msgTokens > maxChunkTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }
      chunks.push([message]);
      continue;
    }

    // If adding this message would exceed limit, start new chunk
    if (currentTokens + msgTokens > maxChunkTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(message);
    currentTokens += msgTokens;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Creates a backup of the session file.
 */
async function backupSessionFile(sessionFile: string): Promise<string> {
  const dir = path.dirname(sessionFile);
  const ext = path.extname(sessionFile);
  const base = path.basename(sessionFile, ext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(dir, `${base}.backup-${timestamp}${ext}`);

  await fs.copyFile(sessionFile, backupPath);
  return backupPath;
}

/**
 * Reads and parses a session file.
 * Session files can be JSONL format (one JSON object per line).
 */
async function readSessionFile(sessionFile: string): Promise<SessionData> {
  const content = await fs.readFile(sessionFile, "utf-8");
  const lines = content.trim().split("\n");
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.role) {
        messages.push(parsed as SessionMessage);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return { messages };
}

/**
 * Writes a session back to file in JSONL format.
 */
async function writeSessionFile(
  sessionFile: string,
  session: SessionData,
): Promise<void> {
  const lines = session.messages.map((msg) => JSON.stringify(msg));
  await fs.writeFile(sessionFile, lines.join("\n") + "\n", "utf-8");
}

/**
 * Creates a summary prompt for a chunk of messages.
 */
function createChunkSummaryPrompt(
  chunkIndex: number,
  totalChunks: number,
  messages: SessionMessage[],
): string {
  const conversationText = messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return `${role}: ${content.slice(0, 1000)}${content.length > 1000 ? "..." : ""}`;
    })
    .join("\n\n");

  return `[Emergency Compaction - Chunk ${chunkIndex + 1}/${totalChunks}]

Please create a concise summary of this conversation segment. Include:
- Key topics discussed
- Important decisions or conclusions
- Any action items or pending tasks
- Critical context that should be preserved

Conversation segment:
${conversationText}

Provide a structured summary that captures the essential information.`;
}

/**
 * Performs emergency compaction on an oversized session.
 *
 * This is used when a session has exceeded the context window and
 * normal compaction would fail due to overflow.
 */
export async function emergencyCompactSession(
  params: EmergencyCompactionParams,
): Promise<EmergencyCompactionResult> {
  const {
    sessionFile,
    sessionKey,
    workspaceDir,
    agentDir,
    config,
    provider,
    model,
    authProfileId,
    keepBackup = true,
  } = params;

  // Resolve context window
  const contextTokens =
    lookupContextTokens(model) ??
    config?.agents?.defaults?.contextTokens ??
    DEFAULT_CONTEXT_TOKENS;

  // Use 50% of context window for each chunk (conservative for safety)
  const maxChunkTokens = params.maxChunkTokens ?? Math.floor(contextTokens * 0.5);

  log.info(
    `[emergency-compaction] starting for session=${sessionKey} ` +
      `contextWindow=${contextTokens} maxChunkTokens=${maxChunkTokens}`,
  );

  let backupPath: string | undefined;

  try {
    // Step 1: Backup the session file
    try {
      backupPath = await backupSessionFile(sessionFile);
      log.info(`[emergency-compaction] backed up to ${backupPath}`);
    } catch (err) {
      return {
        ok: false,
        error: `Failed to backup session: ${String(err)}`,
      };
    }

    // Step 2: Read and analyze the session
    let session: SessionData;
    try {
      session = await readSessionFile(sessionFile);
    } catch (err) {
      return {
        ok: false,
        backupPath,
        error: `Failed to read session: ${String(err)}`,
      };
    }

    const tokensBefore = calculateSessionTokens(session.messages);
    log.info(
      `[emergency-compaction] session has ${session.messages.length} messages, ` +
        `~${tokensBefore} tokens`,
    );

    // Step 3: Split into chunks
    const chunks = splitIntoChunks(session.messages, maxChunkTokens);
    log.info(`[emergency-compaction] split into ${chunks.length} chunks`);

    if (chunks.length <= 1) {
      // Session is small enough for normal compaction
      log.info("[emergency-compaction] session small enough for normal compaction");
      const result = await compactEmbeddedPiSession({
        sessionId: params.sessionId,
        sessionKey,
        sessionFile,
        workspaceDir,
        agentDir,
        config,
        provider,
        model,
        authProfileId,
      });

      if (!result.ok || !result.compacted) {
        return {
          ok: false,
          backupPath,
          tokensBefore,
          error: result.reason ?? "Compaction failed",
        };
      }

      return {
        ok: true,
        backupPath: keepBackup ? backupPath : undefined,
        chunksProcessed: 1,
        tokensBefore,
        tokensAfter: result.result?.tokensAfter,
      };
    }

    // Step 4: Create a minimal session with system message and summaries
    const summaries: string[] = [];
    let successfulChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const summaryPrompt = createChunkSummaryPrompt(i, chunks.length, chunk);

      // Create a temporary mini-session for this chunk
      const tempSessionFile = `${sessionFile}.chunk-${i}.tmp`;
      const tempSession: SessionData = {
        messages: [
          {
            role: "user",
            content: summaryPrompt,
            timestamp: Date.now(),
          },
        ],
      };

      try {
        await writeSessionFile(tempSessionFile, tempSession);

        // Use the agent to summarize this chunk
        const result = await compactEmbeddedPiSession({
          sessionId: `${params.sessionId}-chunk-${i}`,
          sessionKey: sessionKey ? `${sessionKey}:chunk-${i}` : undefined,
          sessionFile: tempSessionFile,
          workspaceDir,
          agentDir,
          config,
          provider,
          model,
          authProfileId,
          customInstructions: "Summarize the conversation segment provided.",
        });

        if (result.ok && result.result?.summary) {
          summaries.push(`[Chunk ${i + 1}/${chunks.length}]\n${result.result.summary}`);
          successfulChunks++;
          log.info(`[emergency-compaction] chunk ${i + 1}/${chunks.length} summarized`);
        } else {
          // Fallback: create a basic summary from message count
          summaries.push(
            `[Chunk ${i + 1}/${chunks.length}] ` +
              `Contains ${chunk.length} messages (summary unavailable)`,
          );
          log.warn(`[emergency-compaction] chunk ${i + 1} summary failed, using fallback`);
        }
      } catch (err) {
        log.error(`[emergency-compaction] chunk ${i + 1} error: ${String(err)}`);
        summaries.push(
          `[Chunk ${i + 1}/${chunks.length}] ` +
            `Contains ${chunk.length} messages (error during summary)`,
        );
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempSessionFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Step 5: Create new compact session with combined summaries
    const combinedSummary = summaries.join("\n\n---\n\n");
    const newSession: SessionData = {
      messages: [
        {
          role: "user",
          content:
            "[Session Recovery] This session was recovered via emergency compaction. " +
            "The original conversation has been summarized below:\n\n" +
            combinedSummary,
          timestamp: Date.now(),
        },
        {
          role: "assistant",
          content:
            "I understand. I've reviewed the recovered session summaries and am ready to continue. " +
            "The conversation history has been preserved in summarized form. How can I help you?",
          timestamp: Date.now(),
        },
      ],
    };

    // Write the new compact session
    await writeSessionFile(sessionFile, newSession);
    const tokensAfter = calculateSessionTokens(newSession.messages);

    log.info(
      `[emergency-compaction] complete: ${tokensBefore} → ${tokensAfter} tokens, ` +
        `${successfulChunks}/${chunks.length} chunks summarized`,
    );

    // Clean up backup if not keeping
    if (!keepBackup && backupPath) {
      try {
        await fs.unlink(backupPath);
        backupPath = undefined;
      } catch {
        // Keep backup if deletion fails
      }
    }

    return {
      ok: true,
      backupPath,
      chunksProcessed: chunks.length,
      tokensBefore,
      tokensAfter,
    };
  } catch (err) {
    log.error(`[emergency-compaction] failed: ${String(err)}`);
    return {
      ok: false,
      backupPath,
      error: String(err),
    };
  }
}

/**
 * Checks if a session needs emergency compaction.
 * Returns true if the session exceeds the context window.
 */
export function needsEmergencyCompaction(params: {
  totalTokens?: number;
  contextWindow: number;
}): boolean {
  const { totalTokens, contextWindow } = params;
  if (!totalTokens || totalTokens <= 0) {
    return false;
  }
  // Need emergency compaction if tokens exceed 95% of context window
  return totalTokens > contextWindow * 0.95;
}
