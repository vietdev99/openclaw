#!/usr/bin/env node

/**
 * Run emergency compaction on oversized sessions.
 *
 * Usage: node scripts/run-emergency-compaction.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// Import emergency compaction function
const { emergencyCompactSession } = await import(
  path.join(rootDir, "dist/emergency-compaction-DO-NOT-USE.js").replace(/\\/g, "/")
).catch(async () => {
  // Try direct import from source via tsx
  console.log("Loading from source...");
  const mod = await import(
    "../src/agents/emergency-compaction.js"
  );
  return mod;
});

const CONTEXT_WINDOW = 200000;
const THRESHOLD_PERCENT = 95; // Only compact sessions at 95%+ (very close to overflow)

const sessionsDir =
  "C:/Users/Printway - Win VM 1/.openclaw/agents/main/sessions";
const sessionsJsonPath = path.join(sessionsDir, "sessions.json");
const workspaceDir = "C:/Users/Printway - Win VM 1/.openclaw/workspace";

console.log("=== Emergency Compaction Script ===");
console.log("Context Window:", CONTEXT_WINDOW);
console.log("Threshold:", THRESHOLD_PERCENT + "%");
console.log("");

// Load session store
const store = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));
const threshold = CONTEXT_WINDOW * (THRESHOLD_PERCENT / 100);

// Find oversized sessions
const oversized = [];

for (const [sessionKey, entry] of Object.entries(store)) {
  const tokens = entry.totalTokens || 0;
  if (tokens < threshold) continue;

  const sessionId = entry.sessionId;
  const possibleFiles = [
    entry.sessionFile,
    `${sessionId}.jsonl`,
    path.join(sessionsDir, `${sessionId}.jsonl`),
  ].filter(Boolean);

  let sessionFile = null;
  for (const candidate of possibleFiles) {
    const fullPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(sessionsDir, candidate);
    if (fs.existsSync(fullPath)) {
      sessionFile = fullPath;
      break;
    }
  }

  if (!sessionFile) continue;

  oversized.push({
    sessionKey,
    sessionId,
    sessionFile,
    tokens,
  });
}

console.log("Sessions needing emergency compaction:", oversized.length);
console.log("");

if (oversized.length === 0) {
  console.log("No sessions need emergency compaction.");
  process.exit(0);
}

// Process each session
for (const session of oversized) {
  console.log(`[${session.sessionKey}]`);
  console.log(`  Tokens: ${session.tokens}`);
  console.log(`  File: ${path.basename(session.sessionFile)}`);

  try {
    const result = await emergencyCompactSession({
      sessionId: session.sessionId,
      sessionKey: session.sessionKey,
      sessionFile: session.sessionFile,
      workspaceDir,
      keepBackup: true,
    });

    if (result.ok) {
      console.log(
        `  ✅ SUCCESS: ${result.tokensBefore} → ${result.tokensAfter} tokens`,
      );
      console.log(`  Chunks processed: ${result.chunksProcessed}`);
      if (result.backupPath) {
        console.log(`  Backup: ${result.backupPath}`);
      }
    } else {
      console.log(`  ❌ FAILED: ${result.error}`);
      if (result.backupPath) {
        console.log(`  Backup preserved: ${result.backupPath}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
  }

  console.log("");
}

console.log("Done!");
