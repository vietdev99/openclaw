#!/usr/bin/env node

/**
 * Recalculate and update token counts in sessions.json based on actual file sizes.
 *
 * Usage: node scripts/recalc-session-tokens.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const CHARS_PER_TOKEN = 4; // Conservative estimate

const sessionsDir =
  "C:/Users/Printway - Win VM 1/.openclaw/agents/main/sessions";
const sessionsJsonPath = path.join(sessionsDir, "sessions.json");

console.log("=== Session Token Recalculation ===");
console.log("Mode:", dryRun ? "DRY RUN" : "LIVE");
console.log("");

// Backup sessions.json first
if (!dryRun) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = sessionsJsonPath + `.backup-${timestamp}`;
  fs.copyFileSync(sessionsJsonPath, backupPath);
  console.log("Backed up sessions.json to:", path.basename(backupPath));
  console.log("");
}

// Load session store
const store = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));

let updated = 0;
let mismatches = [];

for (const [sessionKey, entry] of Object.entries(store)) {
  const sessionId = entry.sessionId;
  const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);
  const storedTokens = entry.totalTokens || 0;

  if (!fs.existsSync(sessionFile)) {
    continue;
  }

  // Calculate actual tokens from file
  const content = fs.readFileSync(sessionFile, "utf-8");
  const actualChars = content.length;
  const actualTokens = Math.floor(actualChars / CHARS_PER_TOKEN);

  // Check for significant mismatch (>20% difference)
  const diff = Math.abs(storedTokens - actualTokens);
  const percentDiff = storedTokens > 0 ? (diff / storedTokens) * 100 : 100;

  if (percentDiff > 20) {
    mismatches.push({
      sessionKey,
      storedTokens,
      actualTokens,
      percentDiff: percentDiff.toFixed(1),
    });

    if (!dryRun) {
      entry.totalTokens = actualTokens;
      // Also recalculate input/output if present
      if (entry.inputTokens || entry.outputTokens) {
        // Can't accurately split, so just use total
        entry.inputTokens = Math.floor(actualTokens * 0.5);
        entry.outputTokens = Math.floor(actualTokens * 0.5);
      }
    }
    updated++;
  }
}

console.log("Sessions with significant token mismatches:", mismatches.length);
console.log("");

if (mismatches.length > 0) {
  console.log("Mismatches found:");
  for (const m of mismatches) {
    console.log(
      `  ${m.sessionKey}: ${m.storedTokens} stored vs ${m.actualTokens} actual (${m.percentDiff}% diff)`,
    );
  }
  console.log("");
}

if (!dryRun && updated > 0) {
  fs.writeFileSync(sessionsJsonPath, JSON.stringify(store, null, 2));
  console.log(`Updated ${updated} session entries in sessions.json`);
} else if (dryRun) {
  console.log(`Would update ${updated} session entries`);
}

console.log("");
console.log("Done!");
