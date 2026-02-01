/**
 * IPC Client for Terminal Host
 * Runs in main gateway process, communicates with isolated terminal host
 */

import WebSocket from "ws";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  ExecRequest,
  ExecResponse,
  ExecOptions,
  ExecResult,
  TerminalHostMessage,
  TerminalHostStatus,
  StreamUpdate,
} from "./types.js";
import { type TerminalConfig, mergeTerminalConfig } from "./shell-selector.js";

const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL = 30000;

interface PendingRequest {
  resolve: (result: ExecResult) => void;
  reject: (error: Error) => void;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  startTime: number;
}

export class TerminalHostClient {
  private ws: WebSocket | null = null;
  private config: TerminalConfig;
  private hostProcess: ChildProcess | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private reconnectAttempts = 0;
  private actualPort: number | null = null;  // Dynamic port from server
  private status: TerminalHostStatus = {
    running: false,
    pid: null,
    restarts: 0,
    lastRestartAt: null,
    activeCommands: 0,
  };
  private pingInterval: NodeJS.Timeout | null = null;
  private connecting = false;

  constructor(config?: Partial<TerminalConfig>) {
    this.config = mergeTerminalConfig(config);
  }

  /**
   * Start the terminal host and connect
   */
  async start(): Promise<void> {
    if (this.config.mode !== "isolated") {
      console.log("[terminal-client] Mode is not 'isolated', skipping start");
      return;
    }

    await this.startHostProcess();
    await this.connect();
  }

  /**
   * Start the terminal host process
   */
  private async startHostProcess(): Promise<void> {
    // Use port 0 for dynamic allocation
    const port = 0;

    // Determine runtime and script path based on environment
    const currentDir = import.meta.dirname ?? __dirname;
    const isDevMode = currentDir.includes("src") && !currentDir.includes("dist");

    let runtime: string;
    let serverPath: string;
    let runtimeArgs: string[] = [];

    if (isDevMode) {
      // Development mode: use bun to run .ts files directly
      serverPath = path.join(currentDir, "ipc-server.ts");
      // Try bun first, fall back to node with tsx
      runtime = "bun";
      runtimeArgs = ["run"];
    } else {
      // Production mode: use node to run compiled .js files
      serverPath = path.join(currentDir, "ipc-server.js");
      runtime = "node";
      runtimeArgs = [];
    }

    console.log(`[terminal-client] Starting terminal host with dynamic port allocation (${runtime} ${serverPath})`);

    return new Promise((resolve, reject) => {
      this.hostProcess = spawn(runtime, [...runtimeArgs, serverPath], {
        env: {
          ...process.env,
          TERMINAL_HOST_PORT: "0", // Dynamic allocation
        },
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
      });

      this.status.pid = this.hostProcess.pid ?? null;
      this.status.running = true;

      let portResolved = false;

      this.hostProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        console.log(`[terminal-host] ${output}`);

        // Parse PORT= line to get dynamic port
        const portMatch = output.match(/\[terminal-host\] PORT=(\d+)/);
        if (portMatch && !portResolved) {
          this.actualPort = parseInt(portMatch[1], 10);
          console.log(`[terminal-client] Got dynamic port: ${this.actualPort}`);
          portResolved = true;
          resolve();
        }
      });

      this.hostProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[terminal-host] ${data.toString().trim()}`);
      });

      this.hostProcess.on("exit", (code, signal) => {
        console.log(`[terminal-host] Process exited: code=${code} signal=${signal}`);
        this.status.running = false;
        this.status.pid = null;
        this.actualPort = null;

        // Auto-restart if configured
        const maxRestarts = this.config.host?.maxRestarts ?? 10;
        if (this.status.restarts < maxRestarts) {
          this.status.restarts++;
          this.status.lastRestartAt = Date.now();
          console.log(`[terminal-client] Restarting terminal host (${this.status.restarts}/${maxRestarts})`);
          setTimeout(() => this.startHostProcess(), RECONNECT_DELAY);
        } else {
          console.error(`[terminal-client] Max restarts reached (${maxRestarts})`);
        }
      });

      this.hostProcess.on("error", (err) => {
        console.error(`[terminal-client] Failed to start host process:`, err);
        if (!portResolved) {
          reject(err);
        }
      });

      // Timeout if port not received
      setTimeout(() => {
        if (!portResolved) {
          reject(new Error("Timeout waiting for terminal host port"));
        }
      }, 10000);
    });
  }

  /**
   * Connect to the terminal host
   */
  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;

    if (!this.actualPort) {
      this.connecting = false;
      throw new Error("Terminal host port not available");
    }

    const url = `ws://127.0.0.1:${this.actualPort}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on("open", () => {
          console.log(`[terminal-client] Connected to terminal host on port ${this.actualPort}`);
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve();
        });

        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on("close", () => {
          console.log("[terminal-client] Connection closed");
          this.stopPingInterval();
          this.handleDisconnect();
        });

        this.ws.on("error", (err) => {
          console.error("[terminal-client] Connection error:", err.message);
          this.connecting = false;

          if (this.reconnectAttempts === 0) {
            reject(err);
          }
        });
      } catch (err) {
        this.connecting = false;
        reject(err);
      }
    });
  }

  /**
   * Handle disconnection and reconnect
   */
  private handleDisconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[terminal-client] Max reconnect attempts reached");
      this.rejectAllPending(new Error("Terminal host disconnected"));
      return;
    }

    this.reconnectAttempts++;
    console.log(`[terminal-client] Reconnecting (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[terminal-client] Reconnect failed:", err.message);
      });
    }, RECONNECT_DELAY * this.reconnectAttempts);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(rawData: string): void {
    try {
      const message: TerminalHostMessage = JSON.parse(rawData);

      switch (message.type) {
        case "ready":
          console.log("[terminal-client] Terminal host ready");
          break;

        case "exec_result":
          this.handleExecResult(message.payload as ExecResponse);
          break;

        case "stream":
          this.handleStreamUpdate(message.payload as StreamUpdate);
          break;

        case "pong":
          // Ping response received
          break;

        default:
          console.warn(`[terminal-client] Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error("[terminal-client] Failed to parse message:", err);
    }
  }

  /**
   * Handle exec result
   */
  private handleExecResult(response: ExecResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn(`[terminal-client] No pending request for id: ${response.id}`);
      return;
    }

    this.pendingRequests.delete(response.id);
    this.status.activeCommands = this.pendingRequests.size;

    const result: ExecResult = {
      success: response.success,
      stdout: response.stdout,
      stderr: response.stderr,
      exitCode: response.exitCode,
      signal: response.signal,
      timedOut: response.timedOut,
      duration: response.duration,
      error: response.error,
    };

    pending.resolve(result);
  }

  /**
   * Handle stream update
   */
  private handleStreamUpdate(update: StreamUpdate): void {
    const pending = this.pendingRequests.get(update.id);
    if (!pending) return;

    if (update.stream === "stdout" && pending.onStdout) {
      pending.onStdout(update.data);
    } else if (update.stream === "stderr" && pending.onStderr) {
      pending.onStderr(update.data);
    }
  }

  /**
   * Execute a command via terminal host
   */
  async exec(options: ExecOptions): Promise<ExecResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Terminal host not connected");
    }

    const id = randomUUID();
    const timeout = options.timeout ?? this.config.host?.timeout ?? 120000;

    const request: ExecRequest = {
      id,
      type: "exec",
      command: options.command,
      workdir: options.workdir,
      env: options.env,
      timeout,
      shell: options.shell,
    };

    return new Promise((resolve, reject) => {
      // Setup timeout on client side as backup
      const timeoutId = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`Command timed out after ${timeout}ms`));
        }
      }, timeout + 5000); // Add 5s buffer for network latency

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        onStdout: options.onStdout,
        onStderr: options.onStderr,
        startTime: Date.now(),
      });

      this.status.activeCommands = this.pendingRequests.size;

      // Send request
      this.send({ type: "exec", id, payload: request });
    });
  }

  /**
   * Send message to terminal host
   */
  private send(message: TerminalHostMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping", id: randomUUID() });
    }, PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
    this.status.activeCommands = 0;
  }

  /**
   * Stop client and terminal host
   */
  async stop(): Promise<void> {
    this.stopPingInterval();

    // Send shutdown to host
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: "shutdown" });
      this.ws.close();
    }

    // Kill host process if still running
    if (this.hostProcess && !this.hostProcess.killed) {
      this.hostProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.hostProcess && !this.hostProcess.killed) {
            this.hostProcess.kill("SIGKILL");
          }
          resolve();
        }, 5000);
      });
    }

    this.rejectAllPending(new Error("Terminal host stopped"));
    this.status.running = false;
    this.status.pid = null;
  }

  /**
   * Get client status
   */
  getStatus(): TerminalHostStatus {
    return { ...this.status };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Factory function to create new terminal host client instances
// Each conversation/context should create its own instance

/**
 * Create a new terminal host client instance
 * Note: This creates a NEW instance each time - no singleton
 * Caller is responsible for calling stop() when done
 */
export function createTerminalHostClient(config?: Partial<TerminalConfig>): TerminalHostClient {
  return new TerminalHostClient(config);
}

// Legacy singleton support for backward compatibility
let legacyClientInstance: TerminalHostClient | null = null;

/**
 * Get or create terminal host client (LEGACY - singleton)
 * @deprecated Use createTerminalHostClient() for per-conversation isolation
 */
export function getTerminalHostClient(config?: Partial<TerminalConfig>): TerminalHostClient {
  if (!legacyClientInstance) {
    legacyClientInstance = new TerminalHostClient(config);
  }
  return legacyClientInstance;
}

/**
 * Reset legacy client instance (for testing)
 * @deprecated Use createTerminalHostClient() for per-conversation isolation
 */
export function resetTerminalHostClient(): void {
  if (legacyClientInstance) {
    legacyClientInstance.stop().catch(() => {});
    legacyClientInstance = null;
  }
}
