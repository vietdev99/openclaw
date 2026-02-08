/**
 * Types for Terminal Host IPC communication
 */
export interface ExecRequest {
    id: string;
    type: "exec";
    command: string;
    workdir?: string;
    env?: Record<string, string>;
    timeout?: number;
    shell?: "bash" | "powershell" | "cmd";
}
export interface ExecResponse {
    id: string;
    type: "exec_result";
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    duration: number;
    error?: string;
}
export interface StreamUpdate {
    id: string;
    type: "stream";
    stream: "stdout" | "stderr";
    data: string;
}
export interface TerminalHostMessage {
    type: "exec" | "exec_result" | "stream" | "ping" | "pong" | "shutdown" | "ready";
    id?: string;
    payload?: ExecRequest | ExecResponse | StreamUpdate | unknown;
}
export interface TerminalHostStatus {
    running: boolean;
    pid: number | null;
    restarts: number;
    lastRestartAt: number | null;
    activeCommands: number;
}
export interface ExecOptions {
    command: string;
    workdir?: string;
    env?: Record<string, string>;
    timeout?: number;
    shell?: "bash" | "powershell" | "cmd";
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
}
export interface ExecResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    duration: number;
    error?: string;
}
