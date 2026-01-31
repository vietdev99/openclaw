/**
 * Shell selector for multi-platform terminal execution.
 * Supports: bash (Linux/macOS), PowerShell (Windows), CMD (Windows fallback)
 */

import { execSync } from "node:child_process";

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

const SHELLS: Record<string, ShellConfig> = {
  bash: {
    name: "bash",
    cmd: "/bin/bash",
    args: ["-c"],
    encoding: "utf8",
  },
  powershell: {
    name: "powershell",
    cmd: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command"],
    encoding: "utf8",
  },
  cmd: {
    name: "cmd",
    cmd: "cmd.exe",
    args: ["/c"],
    encoding: "utf8",
  },
};

/**
 * Check if PowerShell is available on the system
 */
function isPowerShellAvailable(): boolean {
  try {
    execSync("powershell.exe -NoProfile -Command $PSVersionTable", {
      stdio: "pipe",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Git Bash is available on Windows
 */
function isGitBashAvailable(): boolean {
  if (process.platform !== "win32") return false;

  const gitBashPaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    process.env.PROGRAMFILES + "\\Git\\bin\\bash.exe",
  ];

  for (const path of gitBashPaths) {
    try {
      execSync(`"${path}" --version`, { stdio: "pipe", timeout: 5000 });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Get Git Bash path on Windows
 */
function getGitBashPath(): string | null {
  const gitBashPaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    process.env.PROGRAMFILES + "\\Git\\bin\\bash.exe",
  ];

  for (const path of gitBashPaths) {
    try {
      execSync(`"${path}" --version`, { stdio: "pipe", timeout: 5000 });
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Get shell config by name
 */
export function getShellByName(name: string): ShellConfig {
  const shell = SHELLS[name];
  if (!shell) {
    throw new Error(`Unknown shell: ${name}. Valid options: bash, powershell, cmd`);
  }

  // Special handling for bash on Windows (use Git Bash)
  if (name === "bash" && process.platform === "win32") {
    const gitBashPath = getGitBashPath();
    if (gitBashPath) {
      return { ...shell, cmd: gitBashPath };
    }
    throw new Error("Bash requested on Windows but Git Bash not found");
  }

  return shell;
}

/**
 * Select appropriate shell based on config and OS
 */
export function selectShell(config: TerminalConfig): ShellConfig {
  // If explicit shell specified, use it
  if (config.shell !== "auto") {
    return getShellByName(config.shell);
  }

  // Auto-detect based on OS
  switch (process.platform) {
    case "win32":
      // On Windows: prefer PowerShell, fallback to CMD
      if (isPowerShellAvailable()) {
        return SHELLS.powershell;
      }
      return SHELLS.cmd;

    case "darwin":
    case "linux":
      return SHELLS.bash;

    default:
      // Unknown platform, try bash
      return SHELLS.bash;
  }
}

/**
 * Get default terminal config
 */
export function getDefaultTerminalConfig(): TerminalConfig {
  return {
    mode: "legacy", // Default to legacy for backward compatibility
    shell: "auto",
    host: {
      port: 18792,
      maxRestarts: 10,
      timeout: 120000,
    },
  };
}

/**
 * Merge user config with defaults
 */
export function mergeTerminalConfig(
  userConfig: Partial<TerminalConfig> | undefined
): TerminalConfig {
  const defaults = getDefaultTerminalConfig();

  if (!userConfig) {
    return defaults;
  }

  return {
    mode: userConfig.mode ?? defaults.mode,
    shell: userConfig.shell ?? defaults.shell,
    host: {
      port: userConfig.host?.port ?? defaults.host?.port,
      maxRestarts: userConfig.host?.maxRestarts ?? defaults.host?.maxRestarts,
      timeout: userConfig.host?.timeout ?? defaults.host?.timeout,
    },
  };
}
