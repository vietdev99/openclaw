/**
 * CLI Path Resolver
 * Detects CLI location based on environment (dev vs production)
 */

import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';

export function getCLIRoot(): string {
  if (!app.isPackaged) {
    // DEV MODE: CLI ở source root (clawdbot/)
    return path.resolve(__dirname, '..', '..', '..', '..');
  } else {
    // PROD MODE: CLI ở ~/.moltbot/cli/
    return path.join(os.homedir(), '.moltbot', 'cli');
  }
}

export function getCLIEntryPoint(): string {
  return path.join(getCLIRoot(), 'moltbot.mjs');
}
