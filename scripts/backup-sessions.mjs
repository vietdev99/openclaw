#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const sessionsPath =
  "C:/Users/Printway - Win VM 1/.openclaw/agents/main/sessions/sessions.json";
const data = JSON.parse(fs.readFileSync(sessionsPath, "utf-8"));

const CONTEXT_WINDOW = 200000;
const THRESHOLD_PERCENT = 80;
const threshold = CONTEXT_WINDOW * (THRESHOLD_PERCENT / 100);

const sessionsDir = "C:/Users/Printway - Win VM 1/.openclaw/agents/main/sessions";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(sessionsDir, `backup-${timestamp}`);

// Create backup directory
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
console.log("Backup directory:", backupDir);

const toCompact = [];

for (const [key, entry] of Object.entries(data)) {
  const tokens = entry.totalTokens || 0;
  if (tokens >= threshold) {
    const sessionFile = entry.sessionFile;
    if (sessionFile) {
      // Resolve session file path
      let fullPath = sessionFile;
      if (!path.isAbsolute(sessionFile)) {
        fullPath = path.join(sessionsDir, sessionFile);
      }

      if (fs.existsSync(fullPath)) {
        // Backup the session file
        const backupFile = path.join(backupDir, path.basename(fullPath));
        try {
          fs.copyFileSync(fullPath, backupFile);
          console.log("Backed up:", path.basename(fullPath));
          toCompact.push({
            key,
            tokens,
            sessionId: entry.sessionId,
            sessionFile: fullPath,
            backupFile,
          });
        } catch (err) {
          console.log("Failed to backup:", path.basename(fullPath), err.message);
        }
      } else {
        console.log("Session file not found:", sessionFile);
      }
    }
  }
}

console.log("");
console.log("Sessions to compact:", toCompact.length);
toCompact.forEach((s) => console.log("  -", s.key, "(" + s.tokens + " tokens)"));

// Save list for later processing
fs.writeFileSync(
  path.join(backupDir, "sessions-to-compact.json"),
  JSON.stringify(toCompact, null, 2),
);
console.log("");
console.log("Session list saved to:", path.join(backupDir, "sessions-to-compact.json"));
