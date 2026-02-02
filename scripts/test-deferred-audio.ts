/**
 * Test script for deferred audio processing flow.
 * Simulates a voice message from Telegram and logs the complete flow.
 *
 * Usage:
 *   npx tsx scripts/test-deferred-audio.ts <audio-file-path>
 *
 * Example:
 *   npx tsx scripts/test-deferred-audio.ts "C:\Users\...\file.ogg"
 */

import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "../src/config/config.js";
import { getReplyFromConfig } from "../src/auto-reply/reply/get-reply.js";
import type { MsgContext } from "../src/auto-reply/templating.js";

// Simple logging with timestamps
const log = (level: string, msg: string) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
};

async function testDeferredAudio(audioPath: string) {
  log("INFO", "=== Starting Deferred Audio Test ===");
  log("INFO", `Audio file: ${audioPath}`);

  // Verify file exists
  if (!fs.existsSync(audioPath)) {
    log("ERROR", `Audio file not found: ${audioPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(audioPath);
  log("INFO", `File size: ${fileStats.size} bytes`);

  // Load config
  const cfg = loadConfig();
  log("INFO", `Config loaded, asyncMode: ${(cfg.tools?.media?.audio as any)?.asyncMode}`);

  // Build mock MsgContext simulating Telegram voice message
  const mockCtx: MsgContext = {
    // Identity
    From: "telegram:7160335451",
    To: "7160335451",
    AccountId: "telegram:test",
    Provider: "telegram",
    OriginatingChannel: "telegram",
    OriginatingTo: "7160335451",

    // Message content
    Body: "[Test User] <media:audio>",
    RawBody: "[Test User] <media:audio>",
    CommandBody: "",
    MessageSid: `test-${Date.now()}`,

    // Media attachments - THIS IS KEY FOR DEFERRED DETECTION
    MediaTypes: ["audio/ogg; codecs=opus"],
    MediaUrls: [audioPath],
    MediaPaths: [audioPath],
    NumMedia: 1,

    // Session
    SessionKey: "agent:main:test-deferred",

    // Timestamps
    MessageTimestamp: new Date().toISOString(),
    ReceivedAt: Date.now(),
  };

  log("INFO", "Mock context created:");
  log("INFO", `  MediaTypes: ${JSON.stringify(mockCtx.MediaTypes)}`);
  log("INFO", `  MediaUrls: ${JSON.stringify(mockCtx.MediaUrls)}`);
  log("INFO", `  SessionKey: ${mockCtx.SessionKey}`);

  // Track timing
  const startTime = Date.now();

  // Track callbacks
  let blockReplies: string[] = [];
  let toolResults: string[] = [];

  try {
    log("INFO", "Calling getReplyFromConfig...");

    const result = await getReplyFromConfig(mockCtx, {
      skipDeferredProcessing: false, // Allow deferred processing
      onBlockReply: async (payload) => {
        log("CALLBACK", `onBlockReply: text="${payload.text?.substring(0, 100)}..." mediaUrl=${payload.mediaUrl ?? "none"}`);
        if (payload.text) {
          blockReplies.push(payload.text);
        }
      },
      onToolResult: async (payload) => {
        log("CALLBACK", `onToolResult: text="${payload.text?.substring(0, 100)}..."`);
        if (payload.text) {
          toolResults.push(payload.text);
        }
      },
      onReplyStart: async () => {
        log("CALLBACK", "onReplyStart called");
      },
      onAgentRunStart: (runId) => {
        log("CALLBACK", `onAgentRunStart: runId=${runId}`);
      },
    }, cfg);

    const elapsed = Date.now() - startTime;

    log("INFO", "=== Result ===");
    log("INFO", `Elapsed: ${elapsed}ms`);

    if (Array.isArray(result)) {
      log("INFO", `Result is array with ${result.length} items`);
      result.forEach((r, i) => {
        log("INFO", `  [${i}] text="${r.text?.substring(0, 100)}..." deferred=${(r.channelData as any)?.deferred}`);
      });
    } else if (result) {
      log("INFO", `Result text: "${result.text?.substring(0, 200)}..."`);
      log("INFO", `Result channelData: ${JSON.stringify(result.channelData)}`);

      if ((result.channelData as any)?.deferred) {
        log("INFO", ">>> DEFERRED MODE ACTIVATED <<<");
        log("INFO", `Task ID: ${(result.channelData as any)?.taskId}`);
        log("INFO", `Placeholder sent: ${(result.channelData as any)?.placeholderSent}`);

        // Wait for background processing to complete
        log("INFO", "Waiting 30s for background processing...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    } else {
      log("WARN", "Result is undefined");
    }

    log("INFO", "=== Callbacks Summary ===");
    log("INFO", `Block replies: ${blockReplies.length}`);
    blockReplies.forEach((t, i) => log("INFO", `  [${i}] ${t.substring(0, 100)}...`));
    log("INFO", `Tool results: ${toolResults.length}`);
    toolResults.forEach((t, i) => log("INFO", `  [${i}] ${t.substring(0, 100)}...`));

  } catch (err) {
    log("ERROR", `Test failed: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      log("ERROR", err.stack);
    }
  }

  log("INFO", "=== Test Complete ===");
}

// Main
const audioPath = process.argv[2];
if (!audioPath) {
  console.log("Usage: npx tsx scripts/test-deferred-audio.ts <audio-file-path>");
  console.log("");
  console.log("Example:");
  console.log('  npx tsx scripts/test-deferred-audio.ts "C:\\Users\\...\\file.ogg"');
  process.exit(1);
}

testDeferredAudio(path.resolve(audioPath)).catch(console.error);
