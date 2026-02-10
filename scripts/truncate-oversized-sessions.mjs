#!/usr/bin/env node

/**
 * Truncate oversized sessions by keeping only recent messages.
 * This is a simple recovery mechanism that doesn't require AI API calls.
 *
 * Usage: node scripts/truncate-oversized-sessions.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const CONTEXT_WINDOW = 200000;
const TARGET_TOKENS = Math.floor(CONTEXT_WINDOW * 0.5); // Reduce to 50%
const CHARS_PER_TOKEN = 4; // Rough estimate

const sessionsDir =
  "C:/Users/Printway - Win VM 1/.openclaw/agents/main/sessions";
const sessionsJsonPath = path.join(sessionsDir, "sessions.json");

console.log("=== Session Truncation Script ===");
console.log("Mode:", dryRun ? "DRY RUN" : "LIVE");
console.log("Context Window:", CONTEXT_WINDOW);
console.log("Target Tokens:", TARGET_TOKENS, "(50% of context)");
console.log("");

// Load session store
const store = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));
const threshold = CONTEXT_WINDOW * 0.95;

// Create backup directory
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(sessionsDir, `truncate-backup-${timestamp}`);

if (!dryRun) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log("Backup directory:", backupDir);
  console.log("");
}

let processed = 0;

for (const [sessionKey, entry] of Object.entries(store)) {
  const tokens = entry.totalTokens || 0;
  if (tokens < threshold) continue;

  const sessionId = entry.sessionId;
  const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFile)) {
    console.log(`[SKIP] ${sessionKey}: file not found`);
    continue;
  }

  console.log(`[${sessionKey}]`);
  console.log(`  Current tokens: ${tokens}`);

  // Read session file
  const content = fs.readFileSync(sessionFile, "utf-8");
  const lines = content.trim().split("\n").filter((l) => l.trim());

  console.log(`  Messages: ${lines.length}`);

  if (lines.length === 0) {
    console.log("  -> Empty session, skipping");
    continue;
  }

  // Estimate tokens and find cutoff point
  let totalChars = 0;
  const targetChars = TARGET_TOKENS * CHARS_PER_TOKEN;

  // Work backwards from end to find messages to keep
  const toKeep = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineChars = lines[i].length;
    if (totalChars + lineChars > targetChars && toKeep.length > 0) {
      break;
    }
    toKeep.unshift(lines[i]);
    totalChars += lineChars;
  }

  const kept = toKeep.length;
  const removed = lines.length - kept;
  const newTokensEstimate = Math.floor(totalChars / CHARS_PER_TOKEN);

  console.log(`  Keeping: ${kept} messages (removing ${removed})`);
  console.log(`  Estimated new tokens: ${newTokensEstimate}`);

  if (dryRun) {
    console.log("  -> Would truncate");
    continue;
  }

  // Backup original
  const backupFile = path.join(backupDir, `${sessionId}.jsonl`);
  fs.copyFileSync(sessionFile, backupFile);
  console.log(`  -> Backed up to ${path.basename(backupFile)}`);

  // Create recovery message
  const recoveryMessage = JSON.stringify({
    role: "system",
    content: `[Session Recovery] This session was truncated to recover from context overflow. ${removed} older messages were removed. The conversation continues from the most recent messages.`,
    timestamp: Date.now(),
    _recovery: {
      removedMessages: removed,
      previousTokens: tokens,
      truncatedAt: new Date().toISOString(),
    },
  });

  // Write truncated session
  const newContent = [recoveryMessage, ...toKeep].join("\n") + "\n";
  fs.writeFileSync(sessionFile, newContent, "utf-8");
  console.log(`  -> Truncated`);

  // Update session store
  entry.totalTokens = newTokensEstimate;
  entry.compactionCount = (entry.compactionCount || 0) + 1;
  processed++;
}

// Save updated store
if (!dryRun && processed > 0) {
  fs.writeFileSync(sessionsJsonPath, JSON.stringify(store, null, 2));
  console.log("");
  console.log(`Updated sessions.json with new token counts`);
}

console.log("");
console.log(`Done! Processed ${processed} sessions`);

if (!dryRun && processed > 0) {
  console.log(`Backups saved to: ${backupDir}`);
}
