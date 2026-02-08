/**
 * Shell selector for multi-platform terminal execution.
 * Supports: bash (Linux/macOS), PowerShell (Windows), CMD (Windows fallback)
 */
export interface ShellConfig {
    name: "bash" | "powershell" | "cmd";
    cmd: string;
    args: string[];
    encoding: BufferEncoding;
}
export interface TerminalConfig {
    mode: "legacy" | "isolated";
    shell: "auto" | "bash" | "powershell" | "cmd";
    host?: {
        port?: number;
        maxRestarts?: number;
        timeout?: number;
    };
}
/**
 * Get shell config by name
 */
export declare function getShellByName(name: string): ShellConfig;
/**
 * Select appropriate shell based on config and OS
 */
export declare function selectShell(config: TerminalConfig): ShellConfig;
/**
 * Get default terminal config
 */
export declare function getDefaultTerminalConfig(): TerminalConfig;
/**
 * Merge user config with defaults
 */
export declare function mergeTerminalConfig(userConfig: Partial<TerminalConfig> | undefined): TerminalConfig;
