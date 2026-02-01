import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import log from 'electron-log';

export interface GatewayStatus {
  running: boolean;
  port?: number;
  pid?: number;
  startedAt?: Date;
  channels?: string[];
  error?: string;
}

export interface GatewayConfig {
  port?: number;
  configPath?: string;
}

export class GatewayBridge extends EventEmitter {
  private gatewayProcess: ChildProcess | null = null;
  private status: GatewayStatus = { running: false };
  private config: GatewayConfig = { port: 18789 };

  constructor(config?: GatewayConfig) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async start(): Promise<void> {
    if (this.status.running) {
      log.info('Gateway already running');
      return;
    }

    // Kill any existing gateway process before starting
    await this.killExistingGateway();

    log.info('Starting gateway...');

    try {
      // Find clawdbot entry point
      const clawdbotPath = this.findClawdbotPath();
      log.info(`Clawdbot path: ${clawdbotPath}`);

      // Find config path - check multiple locations
      const configPath = this.findConfigPath();
      log.info(`Config path: ${configPath}`);

      // Spawn gateway process with config path
      this.gatewayProcess = spawn('node', [clawdbotPath, 'gateway'], {
        cwd: path.dirname(clawdbotPath),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          // OpenClaw env vars (new standard)
          OPENCLAW_CONFIG_PATH: configPath,
          OPENCLAW_STATE_DIR: path.dirname(configPath),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Handle stdout
      this.gatewayProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.info(`[gateway] ${output.trim()}`);

        // Parse status from output
        if (output.includes('listening on')) {
          this.updateStatus({
            running: true,
            port: this.config.port,
            pid: this.gatewayProcess?.pid,
            startedAt: new Date(),
            error: undefined, // Clear any previous error when gateway starts successfully
          });
        }
      });

      // Handle stderr
      this.gatewayProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.warn(`[gateway:err] ${output.trim()}`);
      });

      // Handle process exit
      this.gatewayProcess.on('exit', (code, signal) => {
        log.info(`Gateway exited with code ${code}, signal ${signal}`);
        this.updateStatus({
          running: false,
          error: code !== 0 ? `Exited with code ${code}` : undefined,
        });
        this.gatewayProcess = null;
      });

      // Handle process error
      this.gatewayProcess.on('error', (err) => {
        log.error('Gateway process error:', err);
        this.updateStatus({
          running: false,
          error: err.message,
        });
      });

      // Wait a bit for startup
      await this.waitForStartup();

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('Failed to start gateway:', error);
      this.updateStatus({ running: false, error });
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.gatewayProcess) {
      log.info('Gateway not running');
      return;
    }

    log.info('Stopping gateway...');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown takes too long
        log.warn('Gateway did not stop gracefully, force killing...');
        this.gatewayProcess?.kill('SIGKILL');
      }, 5000);

      this.gatewayProcess!.once('exit', () => {
        clearTimeout(timeout);
        this.updateStatus({ running: false });
        this.gatewayProcess = null;
        log.info('Gateway stopped');
        resolve();
      });

      // Try graceful shutdown first
      this.gatewayProcess!.kill('SIGTERM');
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }

  getStatus(): GatewayStatus {
    return { ...this.status };
  }

  private updateStatus(partial: Partial<GatewayStatus>) {
    const oldRunning = this.status.running;
    this.status = { ...this.status, ...partial };

    if (oldRunning !== this.status.running) {
      this.emit('status-change', this.status);
    }

    this.emit('status-update', this.status);
  }

  private async killExistingGateway(): Promise<void> {
    // Try to kill any existing gateway process on the same port
    try {
      const { execSync } = require('child_process');

      // Find process using port 18789
      const port = this.config.port || 18789;

      if (process.platform === 'win32') {
        // Windows: find and kill process on port
        try {
          const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(Number(pid))) {
              log.info(`Killing existing gateway process (PID: ${pid})`);
              try {
                execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
              } catch {
                // Process might already be dead
              }
            }
          }
        } catch {
          // No process found on port, that's fine
        }
      } else {
        // Unix: use lsof and kill
        try {
          const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
          const pids = result.trim().split('\n').filter(Boolean);
          for (const pid of pids) {
            log.info(`Killing existing gateway process (PID: ${pid})`);
            try {
              execSync(`kill -9 ${pid}`);
            } catch {
              // Process might already be dead
            }
          }
        } catch {
          // No process found on port, that's fine
        }
      }

      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      log.warn('Failed to kill existing gateway:', err);
    }
  }

  private findClawdbotPath(): string {
    // Try multiple paths for development and production
    const possiblePaths = [
      // Production: bundled in resources/cli/
      path.join(process.resourcesPath || '', 'cli', 'openclaw.mjs'),
      // Development: relative to apps/desktop (dist/main -> apps/desktop -> clawdbot root)
      path.resolve(__dirname, '..', '..', '..', '..', 'openclaw.mjs'),
      // Alternative: 3 levels up from dist
      path.resolve(__dirname, '..', '..', '..', 'openclaw.mjs'),
      // Alternative: dist folder
      path.resolve(__dirname, '..', '..', '..', '..', 'dist', 'openclaw.mjs'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        log.info(`Found CLI at: ${p}`);
        return p;
      }
    }

    // Default to first path and let it fail with clear error
    log.warn('Could not find openclaw entry point, trying paths:', possiblePaths);
    return possiblePaths[0];
  }

  private findConfigPath(): string {
    // Try multiple config locations in priority order
    const possiblePaths = [
      // New OpenClaw path
      path.join(os.homedir(), '.openclaw', 'openclaw.json'),
      // Legacy moltbot path
      path.join(os.homedir(), '.moltbot', 'moltbot.json'),
      // Legacy clawdbot path
      path.join(os.homedir(), '.clawdbot', 'moltbot.json'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        log.info(`Found config at: ${p}`);
        return p;
      }
    }

    // Default to openclaw path
    log.warn('No config file found, using default openclaw path');
    return possiblePaths[0];
  }

  private async waitForStartup(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkStatus = () => {
        if (this.status.running) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          // Don't throw - gateway might still start successfully
          // Just log warning and resolve, UI will update when "listening on" is received
          log.warn('Gateway startup taking longer than expected');
          resolve();
          return;
        }

        if (!this.gatewayProcess) {
          // Process terminated - this is a real error
          this.updateStatus({ running: false, error: 'Gateway process terminated' });
          resolve();
          return;
        }

        setTimeout(checkStatus, 500);
      };

      checkStatus();
    });
  }
}
