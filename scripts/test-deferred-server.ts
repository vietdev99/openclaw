/**
 * Simple HTTP server to test deferred audio processing.
 *
 * Usage:
 *   npx tsx scripts/test-deferred-server.ts
 *
 * Then POST audio file path:
 *   curl -X POST http://localhost:3456/test -d '{"audioPath": "C:\\path\\to\\file.ogg"}'
 *
 * Or test with existing file:
 *   curl http://localhost:3456/test-sample
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "../src/config/config.js";
import { getReplyFromConfig } from "../src/auto-reply/reply/get-reply.js";
import type { MsgContext } from "../src/auto-reply/templating.js";

const PORT = 3456;

// Structured logging
const logs: Array<{ ts: string; level: string; msg: string }> = [];
const log = (level: string, msg: string) => {
  const ts = new Date().toISOString();
  logs.push({ ts, level, msg });
  console.log(`[${ts}] [${level}] ${msg}`);
};

const clearLogs = () => {
  logs.length = 0;
};

async function runTest(audioPath: string): Promise<{
  success: boolean;
  elapsed: number;
  result: any;
  logs: typeof logs;
  blockReplies: string[];
  toolResults: string[];
  error?: string;
}> {
  clearLogs();
  log("INFO", "=== Starting Deferred Audio Test ===");
  log("INFO", `Audio file: ${audioPath}`);

  // Verify file exists
  if (!fs.existsSync(audioPath)) {
    log("ERROR", `Audio file not found: ${audioPath}`);
    return {
      success: false,
      elapsed: 0,
      result: null,
      logs: [...logs],
      blockReplies: [],
      toolResults: [],
      error: `File not found: ${audioPath}`,
    };
  }

  const fileStats = fs.statSync(audioPath);
  log("INFO", `File size: ${fileStats.size} bytes`);

  // Load config
  const cfg = loadConfig();
  log("INFO", `Config loaded, asyncMode: ${(cfg.tools?.media?.audio as any)?.asyncMode}`);

  // Build mock MsgContext
  const mockCtx: MsgContext = {
    From: "telegram:7160335451",
    To: "7160335451",
    AccountId: "telegram:test",
    Provider: "telegram",
    OriginatingChannel: "telegram",
    OriginatingTo: "7160335451",
    Body: "[Test User] <media:audio>",
    RawBody: "[Test User] <media:audio>",
    CommandBody: "",
    MessageSid: `test-${Date.now()}`,
    MediaTypes: ["audio/ogg; codecs=opus"],
    MediaUrls: [audioPath],
    MediaPaths: [audioPath],
    NumMedia: 1,
    SessionKey: "agent:main:test-deferred",
    MessageTimestamp: new Date().toISOString(),
    ReceivedAt: Date.now(),
  };

  log("INFO", `MediaTypes: ${JSON.stringify(mockCtx.MediaTypes)}`);
  log("INFO", `MediaPaths: ${JSON.stringify(mockCtx.MediaPaths)}`);

  const startTime = Date.now();
  const blockReplies: string[] = [];
  const toolResults: string[] = [];

  try {
    log("INFO", "Calling getReplyFromConfig...");

    const result = await getReplyFromConfig(mockCtx, {
      skipDeferredProcessing: false,
      onBlockReply: async (payload) => {
        log("CALLBACK", `onBlockReply: "${payload.text?.substring(0, 80)}..."`);
        if (payload.text) blockReplies.push(payload.text);
      },
      onToolResult: async (payload) => {
        log("CALLBACK", `onToolResult: "${payload.text?.substring(0, 80)}..."`);
        if (payload.text) toolResults.push(payload.text);
      },
      onReplyStart: async () => {
        log("CALLBACK", "onReplyStart");
      },
      onAgentRunStart: (runId) => {
        log("CALLBACK", `onAgentRunStart: ${runId}`);
      },
    }, cfg);

    const elapsed = Date.now() - startTime;

    if ((result as any)?.channelData?.deferred) {
      log("INFO", ">>> DEFERRED MODE - waiting for background... <<<");
      log("INFO", `Task ID: ${(result as any)?.channelData?.taskId}`);

      // Wait for background to complete (max 60s)
      const maxWait = 60000;
      const checkInterval = 1000;
      let waited = 0;

      while (waited < maxWait) {
        await new Promise((r) => setTimeout(r, checkInterval));
        waited += checkInterval;

        // Check if we got any callbacks (indicates completion)
        if (blockReplies.length > 0 || toolResults.length > 0) {
          log("INFO", `Background completed after ${waited}ms`);
          break;
        }
      }

      if (waited >= maxWait) {
        log("WARN", "Timeout waiting for background task");
      }
    }

    log("INFO", `Elapsed: ${Date.now() - startTime}ms`);
    log("INFO", `Block replies: ${blockReplies.length}`);
    log("INFO", `Tool results: ${toolResults.length}`);
    log("INFO", `Result text: "${(result as any)?.text?.substring(0, 100) ?? "(empty)"}"`);

    return {
      success: true,
      elapsed: Date.now() - startTime,
      result: {
        text: (result as any)?.text,
        channelData: (result as any)?.channelData,
      },
      logs: [...logs],
      blockReplies,
      toolResults,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log("ERROR", `Test failed: ${errorMsg}`);

    return {
      success: false,
      elapsed: Date.now() - startTime,
      result: null,
      logs: [...logs],
      blockReplies,
      toolResults,
      error: errorMsg,
    };
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.writeHead(200);
    res.end();
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (url.pathname === "/test" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { audioPath } = JSON.parse(body);
        if (!audioPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "audioPath required" }));
          return;
        }

        console.log(`\n${"=".repeat(60)}`);
        console.log(`Testing: ${audioPath}`);
        console.log("=".repeat(60));

        const result = await runTest(audioPath);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/test-sample") {
    // Find a sample audio file in the media inbound folder
    const mediaDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".openclaw", "media", "inbound");

    if (!fs.existsSync(mediaDir)) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: `Media dir not found: ${mediaDir}` }));
      return;
    }

    const files = fs.readdirSync(mediaDir).filter((f) => f.endsWith(".ogg"));
    if (files.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "No .ogg files found", mediaDir }));
      return;
    }

    const sampleFile = path.join(mediaDir, files[files.length - 1]); // Most recent
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing sample: ${sampleFile}`);
    console.log("=".repeat(60));

    const result = await runTest(sampleFile);
    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
    return;
  }

  // Default: show usage
  res.writeHead(200);
  res.end(JSON.stringify({
    endpoints: {
      "GET /health": "Health check",
      "POST /test": "Test with audioPath in body",
      "GET /test-sample": "Test with most recent .ogg from media/inbound",
    },
    example: {
      curl: `curl -X POST http://localhost:${PORT}/test -H "Content-Type: application/json" -d '{"audioPath": "C:\\\\path\\\\to\\\\file.ogg"}'`,
    },
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Deferred Audio Test Server                         ║
╠════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                   ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /health       - Health check                       ║
║    POST /test         - Test with {"audioPath": "..."}     ║
║    GET  /test-sample  - Test with latest .ogg file         ║
║                                                            ║
║  Example:                                                  ║
║    curl http://localhost:${PORT}/test-sample                  ║
╚════════════════════════════════════════════════════════════╝
`);
});
