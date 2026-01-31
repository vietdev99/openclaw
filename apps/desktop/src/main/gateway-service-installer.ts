import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';

export interface GatewayConfig {
  port: number;
  bind: 'localhost' | 'all-interfaces' | 'tailscale';
  auth: 'token' | 'password' | 'none';
  token?: string;
  password?: string;
}

export interface ServiceStatus {
  installed: boolean;
  running: boolean;
  platform: string;
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class GatewayServiceInstaller {
  constructor(private workspaceDir: string) {}

  async installService(config: GatewayConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const platform = os.platform();
      const moltbotPath = path.join(this.workspaceDir, 'moltbot.mjs');

      // Call CLI command: moltbot gateway install
      const result = await this.execCommand(
        `node "${moltbotPath}" gateway install`,
        { cwd: this.workspaceDir }
      );

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || result.stdout };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const platform = os.platform();

    try {
      if (platform === 'linux') {
        // Check systemd service status
        const result = await this.execCommand('systemctl --user status moltbot-gateway');
        return {
          installed: result.exitCode === 0,
          running: result.stdout.includes('Active: active'),
          platform: 'systemd'
        };
      } else if (platform === 'darwin') {
        // Check launchd service status
        const result = await this.execCommand('launchctl list | grep moltbot-gateway');
        return {
          installed: result.exitCode === 0,
          running: result.stdout.trim().length > 0,
          platform: 'launchd'
        };
      } else if (platform === 'win32') {
        // Check Windows Task Scheduler
        const result = await this.execCommand('schtasks /query /tn "MoltbotGateway"');
        return {
          installed: result.exitCode === 0,
          running: result.stdout.includes('Running'),
          platform: 'task-scheduler'
        };
      }

      return { installed: false, running: false, platform: 'unknown' };
    } catch {
      return { installed: false, running: false, platform: 'unknown' };
    }
  }

  private execCommand(command: string, options?: any): Promise<ExecResult> {
    return new Promise((resolve) => {
      const proc = spawn(command, { shell: true, ...options });
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => (stdout += data.toString()));
      proc.stderr?.on('data', (data) => (stderr += data.toString()));

      proc.on('close', (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });

      proc.on('error', (error) => {
        resolve({ exitCode: 1, stdout, stderr: error.message });
      });
    });
  }
}
