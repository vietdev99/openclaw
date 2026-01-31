/**
 * Terminal Host Module
 *
 * Provides isolated process execution for shell commands.
 * Supports bash (Linux/macOS), PowerShell (Windows), CMD (Windows).
 *
 * Architecture:
 * - Main Gateway uses TerminalHostClient to send commands
 * - Terminal Host (isolated process) uses TerminalHostServer to execute
 * - Communication via WebSocket IPC
 *
 * Usage:
 *   // In config (clawdbot.json):
 *   {
 *     "terminal": {
 *       "mode": "isolated",    // or "legacy" for backward compat
 *       "shell": "auto",       // or "bash" | "powershell" | "cmd"
 *       "host": { "port": 18792 }
 *     }
 *   }
 *
 *   // In code:
 *   import { getTerminalHostClient, execWithTerminalHost } from "./terminal-host/index.js";
 *
 *   const client = getTerminalHostClient(config.terminal);
 *   await client.start();
 *
 *   const result = await client.exec({
 *     command: "ls -la",
 *     workdir: "/home/user",
 *     timeout: 30000
 *   });
 */

// Types
export type {
  ExecRequest,
  ExecResponse,
  ExecOptions,
  ExecResult,
  StreamUpdate,
  TerminalHostMessage,
  TerminalHostStatus,
} from "./types.js";

// Shell selector
export {
  selectShell,
  getShellByName,
  getDefaultTerminalConfig,
  mergeTerminalConfig,
  type ShellConfig,
  type TerminalConfig,
} from "./shell-selector.js";

// IPC Client (for main process)
export {
  TerminalHostClient,
  getTerminalHostClient,
  resetTerminalHostClient,
} from "./ipc-client.js";

// IPC Server (for isolated process)
export { TerminalHostServer } from "./ipc-server.js";

/**
 * Execute command using terminal host client
 * Convenience wrapper around client.exec()
 */
export async function execWithTerminalHost(
  command: string,
  options?: Partial<import("./types.js").ExecOptions>
): Promise<import("./types.js").ExecResult> {
  const { getTerminalHostClient } = await import("./ipc-client.js");
  const client = getTerminalHostClient();

  if (!client.isConnected()) {
    await client.start();
  }

  return client.exec({
    command,
    ...options,
  });
}
