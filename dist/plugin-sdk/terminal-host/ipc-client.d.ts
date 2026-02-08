/**
 * IPC Client for Terminal Host
 * Runs in main gateway process, communicates with isolated terminal host
 */
import type { ExecOptions, ExecResult, TerminalHostStatus } from "./types.js";
import { type TerminalConfig } from "./shell-selector.js";
export declare class TerminalHostClient {
    private ws;
    private config;
    private hostProcess;
    private pendingRequests;
    private reconnectAttempts;
    private actualPort;
    private status;
    private pingInterval;
    private connecting;
    constructor(config?: Partial<TerminalConfig>);
    /**
     * Start the terminal host and connect
     */
    start(): Promise<void>;
    /**
     * Start the terminal host process
     */
    private startHostProcess;
    /**
     * Connect to the terminal host
     */
    private connect;
    /**
     * Handle disconnection and reconnect
     */
    private handleDisconnect;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle exec result
     */
    private handleExecResult;
    /**
     * Handle stream update
     */
    private handleStreamUpdate;
    /**
     * Execute a command via terminal host
     */
    exec(options: ExecOptions): Promise<ExecResult>;
    /**
     * Send message to terminal host
     */
    private send;
    /**
     * Start ping interval to keep connection alive
     */
    private startPingInterval;
    /**
     * Stop ping interval
     */
    private stopPingInterval;
    /**
     * Reject all pending requests
     */
    private rejectAllPending;
    /**
     * Stop client and terminal host
     */
    stop(): Promise<void>;
    /**
     * Get client status
     */
    getStatus(): TerminalHostStatus;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
/**
 * Create a new terminal host client instance
 * Note: This creates a NEW instance each time - no singleton
 * Caller is responsible for calling stop() when done
 */
export declare function createTerminalHostClient(config?: Partial<TerminalConfig>): TerminalHostClient;
/**
 * Get or create terminal host client (LEGACY - singleton)
 * @deprecated Use createTerminalHostClient() for per-conversation isolation
 */
export declare function getTerminalHostClient(config?: Partial<TerminalConfig>): TerminalHostClient;
/**
 * Reset legacy client instance (for testing)
 * @deprecated Use createTerminalHostClient() for per-conversation isolation
 */
export declare function resetTerminalHostClient(): void;
