/**
 * Terminal Host Configuration Types
 *
 * Configuration for isolated terminal host execution mode.
 * Allows commands to run in a separate process to prevent main gateway crashes.
 */
export type TerminalHostConfig = {
    /** IPC port for terminal host WebSocket server (default: 18792). */
    port?: number;
    /** Max number of auto-restarts before giving up (default: 10). */
    maxRestarts?: number;
    /** Default command timeout in milliseconds (default: 120000). */
    timeout?: number;
};
export type TerminalConfig = {
    /**
     * Execution mode:
     * - "legacy": Run commands directly in main process (default, backward compatible)
     * - "isolated": Run commands in separate terminal host process (crash-resistant)
     */
    mode?: "legacy" | "isolated";
    /**
     * Shell selection:
     * - "auto": Auto-detect based on OS (bash on Linux/macOS, PowerShell on Windows)
     * - "bash": Force bash (uses Git Bash on Windows)
     * - "powershell": Force PowerShell
     * - "cmd": Force CMD (Windows only)
     */
    shell?: "auto" | "bash" | "powershell" | "cmd";
    /** Terminal host configuration (used when mode="isolated"). */
    host?: TerminalHostConfig;
};
