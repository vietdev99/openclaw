/**
 * IPC Server for Terminal Host
 * Runs in isolated process, receives commands via WebSocket
 */

import { WebSocketServer, WebSocket } from "ws";
import { spawn, type ChildProcess } from "node:child_process";
import { selectShell, getShellByName, type TerminalConfig } from "./shell-selector.js";
import type {
  ExecRequest,
  ExecResponse,
  StreamUpdate,
  TerminalHostMessage,
} from "./types.js";

const DEFAULT_PORT = 18792;
const DEFAULT_TIMEOUT = 120000;

interface ActiveCommand {
  id: string;
  process: ChildProcess;
  startTime: number;
  stdout: string;
  stderr: string;
  timeoutId: NodeJS.Timeout | null;
}

export class TerminalHostServer {
  private wss: WebSocketServer | null = null;
  private config: TerminalConfig;
  private activeCommands: Map<string, ActiveCommand> = new Map();
  private clients: Set<WebSocket> = new Set();

  constructor(config: Partial<TerminalConfig> = {}) {
    this.config = {
      mode: "isolated",
      shell: config.shell ?? "auto",
      host: {
        port: config.host?.port ?? DEFAULT_PORT,
        maxRestarts: config.host?.maxRestarts ?? 10,
        timeout: config.host?.timeout ?? DEFAULT_TIMEOUT,
      },
    };
  }

  /**
   * Start the IPC server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = this.config.host?.port ?? DEFAULT_PORT;

      try {
        this.wss = new WebSocketServer({ port });

        this.wss.on("connection", (ws) => {
          this.clients.add(ws);
          console.log(`[terminal-host] Client connected. Total: ${this.clients.size}`);

          ws.on("message", (data) => {
            this.handleMessage(ws, data.toString());
          });

          ws.on("close", () => {
            this.clients.delete(ws);
            console.log(`[terminal-host] Client disconnected. Total: ${this.clients.size}`);
          });

          ws.on("error", (err) => {
            console.error(`[terminal-host] WebSocket error:`, err.message);
          });

          // Send ready signal
          this.send(ws, { type: "ready" });
        });

        this.wss.on("listening", () => {
          console.log(`[terminal-host] Server listening on port ${port}`);
          resolve();
        });

        this.wss.on("error", (err) => {
          console.error(`[terminal-host] Server error:`, err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the server and cleanup
   */
  async stop(): Promise<void> {
    // Kill all active commands
    for (const [id, cmd] of this.activeCommands) {
      this.killCommand(id);
    }

    // Close all client connections
    for (const ws of this.clients) {
      ws.close();
    }

    // Close server
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          console.log("[terminal-host] Server stopped");
          resolve();
        });
      });
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, rawData: string): void {
    try {
      const message: TerminalHostMessage = JSON.parse(rawData);

      switch (message.type) {
        case "exec":
          this.handleExec(ws, message.payload as ExecRequest);
          break;
        case "ping":
          this.send(ws, { type: "pong", id: message.id });
          break;
        case "shutdown":
          this.stop();
          break;
        default:
          console.warn(`[terminal-host] Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`[terminal-host] Failed to parse message:`, err);
    }
  }

  /**
   * Execute a command
   */
  private handleExec(ws: WebSocket, request: ExecRequest): void {
    const { id, command, workdir, env, timeout, shell } = request;
    const effectiveTimeout = timeout ?? this.config.host?.timeout ?? DEFAULT_TIMEOUT;

    // Select shell
    const shellConfig = shell
      ? getShellByName(shell)
      : selectShell(this.config);

    console.log(`[terminal-host] Exec [${id}]: ${command.slice(0, 100)}...`);

    const startTime = Date.now();

    // Spawn process
    const proc = spawn(shellConfig.cmd, [...shellConfig.args, command], {
      cwd: workdir ?? process.cwd(),
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const activeCmd: ActiveCommand = {
      id,
      process: proc,
      startTime,
      stdout: "",
      stderr: "",
      timeoutId: null,
    };

    this.activeCommands.set(id, activeCmd);

    // Setup timeout
    activeCmd.timeoutId = setTimeout(() => {
      console.warn(`[terminal-host] Command ${id} timed out after ${effectiveTimeout}ms`);
      this.killCommand(id, true);
    }, effectiveTimeout);

    // Handle stdout
    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      activeCmd.stdout += text;

      // Stream update to client
      const streamUpdate: StreamUpdate = {
        id,
        type: "stream",
        stream: "stdout",
        data: text,
      };
      this.send(ws, { type: "stream", id, payload: streamUpdate });
    });

    // Handle stderr
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      activeCmd.stderr += text;

      // Stream update to client
      const streamUpdate: StreamUpdate = {
        id,
        type: "stream",
        stream: "stderr",
        data: text,
      };
      this.send(ws, { type: "stream", id, payload: streamUpdate });
    });

    // Handle process exit
    proc.on("close", (code, signal) => {
      const duration = Date.now() - startTime;
      const timedOut = !this.activeCommands.has(id); // Was killed by timeout

      // Clear timeout
      if (activeCmd.timeoutId) {
        clearTimeout(activeCmd.timeoutId);
      }

      // Remove from active commands
      this.activeCommands.delete(id);

      // Send result
      const response: ExecResponse = {
        id,
        type: "exec_result",
        success: code === 0,
        stdout: activeCmd.stdout,
        stderr: activeCmd.stderr,
        exitCode: code,
        signal: signal,
        timedOut,
        duration,
      };

      this.send(ws, { type: "exec_result", id, payload: response });
      console.log(`[terminal-host] Exec [${id}] completed: code=${code} duration=${duration}ms`);
    });

    // Handle process error
    proc.on("error", (err) => {
      const duration = Date.now() - startTime;

      // Clear timeout
      if (activeCmd.timeoutId) {
        clearTimeout(activeCmd.timeoutId);
      }

      // Remove from active commands
      this.activeCommands.delete(id);

      // Send error response
      const response: ExecResponse = {
        id,
        type: "exec_result",
        success: false,
        stdout: activeCmd.stdout,
        stderr: activeCmd.stderr,
        exitCode: null,
        signal: null,
        timedOut: false,
        duration,
        error: err.message,
      };

      this.send(ws, { type: "exec_result", id, payload: response });
      console.error(`[terminal-host] Exec [${id}] error:`, err.message);
    });
  }

  /**
   * Kill a running command
   */
  private killCommand(id: string, timedOut = false): void {
    const cmd = this.activeCommands.get(id);
    if (!cmd) return;

    if (cmd.timeoutId) {
      clearTimeout(cmd.timeoutId);
    }

    // Try graceful kill first
    cmd.process.kill("SIGTERM");

    // Force kill after 5 seconds
    setTimeout(() => {
      if (cmd.process.killed) return;
      cmd.process.kill("SIGKILL");
    }, 5000);

    if (timedOut) {
      this.activeCommands.delete(id);
    }
  }

  /**
   * Send message to client
   */
  private send(ws: WebSocket, message: TerminalHostMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; port: number; activeCommands: number; clients: number } {
    return {
      running: this.wss !== null,
      port: this.config.host?.port ?? DEFAULT_PORT,
      activeCommands: this.activeCommands.size,
      clients: this.clients.size,
    };
  }
}

// Entry point when run as standalone process
if (process.argv[1]?.endsWith("ipc-server.js") || process.argv[1]?.endsWith("ipc-server.ts")) {
  const port = parseInt(process.env.TERMINAL_HOST_PORT ?? String(DEFAULT_PORT), 10);
  const server = new TerminalHostServer({ host: { port } });

  server.start().then(() => {
    console.log(`[terminal-host] Started on port ${port}`);
  }).catch((err) => {
    console.error(`[terminal-host] Failed to start:`, err);
    process.exit(1);
  });

  // Handle shutdown signals
  process.on("SIGTERM", async () => {
    console.log("[terminal-host] Received SIGTERM, shutting down...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[terminal-host] Received SIGINT, shutting down...");
    await server.stop();
    process.exit(0);
  });
}
