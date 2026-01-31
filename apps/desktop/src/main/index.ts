import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { TrayManager } from './tray';
import { WindowManager, setQuitting } from './window';
import { GatewayBridge } from './gateway-bridge';
import { ConfigManager } from './config-manager';
import { GatewayServiceInstaller } from './gateway-service-installer';
import { getZaloWebViewManager, destroyZaloWebViewManager, type ZaloWebMessage } from './zalo-web-view';
import { terminalRunner } from './terminal-runner';
import { getCLIRoot, getCLIEntryPoint } from './cli-resolver';
import log from 'electron-log';

// Debug: Check if app is defined
if (!app) {
  console.error('FATAL: Electron app is undefined! This script must be run with Electron, not Node.');
  console.error('process.versions:', process.versions);
  process.exit(1);
}

// Handle EPIPE errors globally - must be first!
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    // Ignore EPIPE errors (broken pipe when console is closed)
    return;
  }
  // Log other errors
  log.error('Uncaught exception:', error);
});

// Configure logging - disable console to prevent EPIPE errors
log.transports.file.level = 'info';
log.transports.console.level = false;

// Singleton instances
let trayManager: TrayManager | null = null;
let windowManager: WindowManager | null = null;
let gatewayBridge: GatewayBridge | null = null;
let configManager: ConfigManager | null = null;

async function createApp() {
  log.info('Starting Clawdbot Desktop...');

  // Initialize config manager
  configManager = new ConfigManager();

  // Initialize gateway bridge
  gatewayBridge = new GatewayBridge();

  // Create window manager
  windowManager = new WindowManager();
  await windowManager.createMainWindow();

  // Create tray manager
  trayManager = new TrayManager({
    onShowWindow: () => windowManager?.show(),
    onHideWindow: () => windowManager?.hide(),
    onToggleWindow: () => windowManager?.toggle(),
    onStartGateway: () => gatewayBridge?.start(),
    onStopGateway: () => gatewayBridge?.stop(),
    onRestartGateway: () => gatewayBridge?.restart(),
    onQuit: () => app.quit(),
    getGatewayStatus: () => gatewayBridge?.getStatus() ?? { running: false },
  });

  // Setup IPC handlers
  setupIpcHandlers();

  // Initialize Zalo WebView manager
  const zaloManager = getZaloWebViewManager();
  zaloManager.setupIpcListeners(); // Setup internal IPC listeners

  // Set main window for terminal runner
  const mainWin = windowManager.getWindow();
  if (mainWin) {
    terminalRunner.setMainWindow(mainWin);
  }

  const mainWindow = windowManager.getWindow();
  if (mainWindow) {
    // Forward Zalo messages to renderer
    zaloManager.onMessage((message: ZaloWebMessage) => {
      log.info('Zalo message received, forwarding to renderer:', message.msgId);
      mainWindow.webContents.send('zaloweb:message', message);
    });

    zaloManager.onLoginStatus((status) => {
      log.info('Zalo login status changed:', status.loggedIn);
      mainWindow.webContents.send('zaloweb:login-status', status);
    });
  }

  // Auto-start gateway (optional - can be controlled via settings)
  // await gatewayBridge.start();

  log.info('Clawdbot Desktop initialized');
}

function setupIpcHandlers() {
  // Gateway control
  ipcMain.handle('gateway:start', async () => {
    log.info('IPC: gateway:start');
    await gatewayBridge?.start();
    return gatewayBridge?.getStatus();
  });

  ipcMain.handle('gateway:stop', async () => {
    log.info('IPC: gateway:stop');
    await gatewayBridge?.stop();
    return gatewayBridge?.getStatus();
  });

  ipcMain.handle('gateway:restart', async () => {
    log.info('IPC: gateway:restart');
    await gatewayBridge?.restart();
    return gatewayBridge?.getStatus();
  });

  ipcMain.handle('gateway:status', () => {
    return gatewayBridge?.getStatus();
  });

  // Gateway status updates
  gatewayBridge?.on('status-change', (status) => {
    windowManager?.getWindow()?.webContents.send('gateway:status-changed', status);
    trayManager?.updateStatus(status.running);
  });

  // Config management
  ipcMain.handle('config:get-providers', async () => {
    log.info('IPC: config:get-providers');
    return configManager?.getProviders();
  });

  ipcMain.handle('config:add-provider', async (_, name: string, config: any) => {
    log.info(`IPC: config:add-provider - ${name}`);
    await configManager?.addProvider(name, config);
    return configManager?.getProviders();
  });

  ipcMain.handle('config:update-provider', async (_, name: string, config: any) => {
    log.info(`IPC: config:update-provider - ${name}`);
    await configManager?.updateProvider(name, config);
    return configManager?.getProviders();
  });

  ipcMain.handle('config:delete-provider', async (_, name: string) => {
    log.info(`IPC: config:delete-provider - ${name}`);
    await configManager?.deleteProvider(name);
    return configManager?.getProviders();
  });

  ipcMain.handle('config:get-current-model', async () => {
    log.info('IPC: config:get-current-model');
    return configManager?.getCurrentModel();
  });

  ipcMain.handle('config:set-current-model', async (_, provider: string, model: string) => {
    log.info(`IPC: config:set-current-model - ${provider}/${model}`);
    await configManager?.setCurrentModel(provider, model);
    return configManager?.getCurrentModel();
  });

  ipcMain.handle('config:get-path', () => {
    return configManager?.getConfigPath();
  });

  ipcMain.handle('config:get-model-summary', async () => {
    log.info('IPC: config:get-model-summary');
    return configManager?.getModelSummary();
  });

  ipcMain.handle('config:get-agents-defaults', async () => {
    log.info('IPC: config:get-agents-defaults');
    return configManager?.getAgentsDefaults();
  });

  ipcMain.handle('config:get-auth-profiles', async () => {
    log.info('IPC: config:get-auth-profiles');
    return configManager?.getAuthProfiles();
  });

  ipcMain.handle('config:update-agents-defaults', async (_, updates: any) => {
    log.info('IPC: config:update-agents-defaults');
    await configManager?.updateAgentsDefaults(updates);
    return configManager?.getAgentsDefaults();
  });

  ipcMain.handle('config:delete-auth-profile', async (_, id: string) => {
    log.info(`IPC: config:delete-auth-profile - ${id}`);
    await configManager?.deleteAuthProfile(id);
    return configManager?.getAuthProfiles();
  });

  // Channels config
  ipcMain.handle('config:get-channels', async () => {
    log.info('IPC: config:get-channels');
    return configManager?.getChannelsConfig();
  });

  ipcMain.handle('config:update-channel', async (_, channelId: string, channelConfig: any) => {
    log.info(`IPC: config:update-channel - ${channelId}`);
    await configManager?.updateChannelConfig(channelId, channelConfig);
    return configManager?.getChannelsConfig();
  });

  // Full config for viewer
  ipcMain.handle('config:get-full', async () => {
    log.info('IPC: config:get-full');
    return configManager?.getFullConfig();
  });

  ipcMain.handle('config:get-raw', async () => {
    log.info('IPC: config:get-raw');
    return configManager?.getRawConfig();
  });

  ipcMain.handle('config:get-model-catalog', async () => {
    log.info('IPC: config:get-model-catalog');
    return configManager?.getModelCatalog();
  });

  // Skills config
  ipcMain.handle('config:get-skills', async () => {
    log.info('IPC: config:get-skills');
    return configManager?.getSkills();
  });

  ipcMain.handle('config:update-skills', async (_, skillsConfig: any) => {
    log.info('IPC: config:update-skills');
    await configManager?.updateSkills(skillsConfig);
    return configManager?.getSkills();
  });

  // Workspace and setup handlers
  ipcMain.handle('config:backup-and-reset', async () => {
    log.info('IPC: config:backup-and-reset');
    try {
      const backupPath = await configManager?.backupConfig();
      await configManager?.resetConfig();
      return { success: true, backupPath };
    } catch (error: any) {
      log.error('Backup and reset failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workspace:validate', async (_, workspacePath: string) => {
    log.info(`IPC: workspace:validate - ${workspacePath}`);
    try {
      const fs = await import('fs');
      const fsPromises = await import('fs/promises');

      const exists = fs.existsSync(workspacePath);
      let writable = false;

      if (exists) {
        try {
          await fsPromises.access(workspacePath, fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
      } else {
        writable = true; // Non-existent paths are considered writable (can be created)
      }

      const valid = exists ? await configManager?.isValidWorkspace(workspacePath) : true;

      return { valid, writable, exists };
    } catch (error: any) {
      log.error('Workspace validation failed:', error);
      return { valid: false, writable: false, exists: false, error: error.message };
    }
  });

  ipcMain.handle('workspace:get-default-path', async () => {
    log.info('IPC: workspace:get-default-path');
    try {
      const homeDir = os.homedir();
      const defaultPath = path.join(homeDir, '.moltbot');
      return { success: true, path: defaultPath };
    } catch (error: any) {
      log.error('Failed to get default workspace path:', error);
      return { success: false, path: '', error: error.message };
    }
  });

  ipcMain.handle('gateway:install-service', async (_, config: any) => {
    log.info('IPC: gateway:install-service');
    try {
      const workspaceDir = configManager?.getWorkspaceDir();
      if (!workspaceDir) {
        throw new Error('Workspace directory not found');
      }

      const installer = new GatewayServiceInstaller(workspaceDir);
      const result = await installer.installService(config);

      return result;
    } catch (error: any) {
      log.error('Service installation failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('gateway:get-service-status', async () => {
    log.info('IPC: gateway:get-service-status');
    try {
      const workspaceDir = configManager?.getWorkspaceDir();
      if (!workspaceDir) {
        throw new Error('Workspace directory not found');
      }

      const installer = new GatewayServiceInstaller(workspaceDir);
      return await installer.getServiceStatus();
    } catch (error: any) {
      log.error('Failed to get service status:', error);
      return { installed: false, running: false, platform: 'unknown', error: error.message };
    }
  });

  // Dialog and shell handlers
  ipcMain.handle('dialog:showOpenDialog', async (_, options: any) => {
    log.info('IPC: dialog:showOpenDialog');
    return dialog.showOpenDialog(options);
  });

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    log.info(`IPC: shell:openExternal - ${url}`);
    const { shell } = await import('electron');
    return shell.openExternal(url);
  });

  // Plugin management handlers
  ipcMain.handle('plugins:check-installed', async (_, pluginSpec: string) => {
    log.info(`IPC: plugins:check-installed - ${pluginSpec}`);
    try {
      const workspaceDir = configManager?.getWorkspaceDir();
      if (!workspaceDir) {
        return { installed: false, error: 'Workspace not initialized' };
      }

      const fsPromises = await import('fs/promises');

      // Check if plugin exists in workspace node_modules
      const pluginName = pluginSpec.startsWith('@') ? pluginSpec : `@${pluginSpec}`;
      const pluginPath = path.join(workspaceDir, 'node_modules', pluginName);

      const exists = await fsPromises.access(pluginPath)
        .then(() => true)
        .catch(() => false);

      return { installed: exists };
    } catch (error: any) {
      log.error('Plugin check failed:', error);
      return { installed: false, error: error.message };
    }
  });

  ipcMain.handle('plugins:install', async (_, pluginSpec: string) => {
    log.info(`IPC: plugins:install - ${pluginSpec}`);
    try {
      const workspaceDir = configManager?.getWorkspaceDir();
      if (!workspaceDir) {
        throw new Error('Workspace not initialized');
      }

      const { spawn } = await import('child_process');
      const pathModule = await import('path');
      const clawdbotRoot = pathModule.resolve(__dirname, '..', '..', '..', '..');
      const entryPoint = pathModule.join(clawdbotRoot, 'moltbot.mjs');

      return new Promise((resolve) => {
        const child = spawn('node', [entryPoint, 'plugins', 'install', pluginSpec], {
          cwd: clawdbotRoot,
          stdio: 'pipe',
          env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
          log.info(`[plugins install] ${data.toString().trim()}`);
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
          log.error(`[plugins install] ${data.toString().trim()}`);
        });

        child.on('close', (code) => {
          if (code === 0) {
            log.info(`Plugin ${pluginSpec} installed successfully`);
            resolve({ success: true, output: stdout });
          } else {
            log.error(`Plugin install failed with code ${code}: ${stderr}`);
            resolve({ success: false, error: stderr || `Exit code ${code}` });
          }
        });

        child.on('error', (err) => {
          log.error('Plugin install process error:', err);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error: any) {
      log.error('Plugin install failed:', error);
      return { success: false, error: error.message };
    }
  });

  // App commands
  ipcMain.handle('app:run-auth-login', async (_, provider: string) => {
    log.info(`IPC: app:run-auth-login - ${provider}`);
    const { spawn, exec, execSync } = await import('child_process');
    const pathModule = await import('path');
    const fsPromises = await import('fs/promises');

    return new Promise(async (resolve) => {
      try {
        // Find clawdbot entry point - go up from dist/main to project root
        const clawdbotRoot = pathModule.resolve(__dirname, '..', '..', '..', '..');
        const entryPoint = pathModule.join(clawdbotRoot, 'moltbot.mjs');

        log.info(`Running auth login with entry point: ${entryPoint}`);
        log.info(`Clawdbot root: ${clawdbotRoot}`);

        // Check if entry point exists
        try {
          await fsPromises.access(entryPoint);
          log.info('Entry point exists');
        } catch {
          log.error(`Entry point not found: ${entryPoint}`);
          resolve({ success: false, error: `Entry point not found: ${entryPoint}` });
          return;
        }

        // Step 1: Install required plugins synchronously first
        log.info('Installing required plugins...');
        try {
          execSync(`node "${entryPoint}" plugins install @mariozechner/pi-providers`, {
            cwd: clawdbotRoot,
            stdio: 'pipe',
            env: { ...process.env },
            timeout: 120000, // 2 minute timeout
          });
          log.info('Plugins installed successfully');
        } catch (installError: any) {
          log.warn('Plugin install warning (may already be installed):', installError.message);
          // Continue anyway - plugin might already be installed
        }

        // Step 2: Open terminal for auth login (requires interactive TTY)
        const command = `node "${entryPoint}" models auth login --provider ${provider}`;
        log.info(`Command: ${command}`);

        if (process.platform === 'win32') {
          // Windows: Write a temp batch file and execute it - most reliable approach
          log.info(`Opening Windows terminal for auth login...`);
          log.info(`Entry point: ${entryPoint}`);
          log.info(`Working dir: ${clawdbotRoot}`);

          const os = await import('os');
          const tempDir = os.tmpdir();
          const batchFile = pathModule.join(tempDir, `clawdbot-auth-${Date.now()}.bat`);

          // Create batch file content - plugins already installed, just run auth
          const batchContent = `@echo off
cd /d "${clawdbotRoot}"
echo.
echo ========================================
echo   Clawdbot Authentication - ${provider}
echo ========================================
echo.
echo Starting authentication...
${command}
echo.
echo Authentication complete. You can close this window.
pause
`;

          // Write batch file
          await fsPromises.writeFile(batchFile, batchContent, 'utf8');
          log.info(`Batch file created: ${batchFile}`);

          // Execute with start command to open new window
          exec(`start "" "${batchFile}"`, {
            cwd: clawdbotRoot,
          }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              log.error('Failed to open terminal:', error);
              log.error('stderr:', stderr);
              resolve({ success: false, error: error.message });
            } else {
              log.info('Windows terminal opened successfully');
              // Clean up batch file after a delay
              setTimeout(() => {
                fsPromises.unlink(batchFile).catch(() => {});
              }, 60000); // Delete after 1 minute
              resolve({ success: true, message: 'Terminal opened for authentication' });
            }
          });
        } else if (process.platform === 'darwin') {
          // macOS: open Terminal app
          const script = `tell application "Terminal" to do script "cd '${clawdbotRoot}' && ${command}"`;
          const child = spawn('osascript', ['-e', script], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          log.info('macOS Terminal opened');
          resolve({ success: true, message: 'Terminal opened for authentication' });
        } else {
          // Linux: try common terminal emulators
          const child = spawn('x-terminal-emulator', ['-e', `bash -c 'cd "${clawdbotRoot}" && ${command}; read -p "Press Enter to close..."'`], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          log.info('Linux terminal opened');
          resolve({ success: true, message: 'Terminal opened for authentication' });
        }
      } catch (error: any) {
        log.error('Auth login failed:', error);
        resolve({ success: false, error: error.message });
      }
    });
  });

  // Zalo Web handlers
  ipcMain.handle('zaloweb:open', async () => {
    log.info('IPC: zaloweb:open');
    try {
      const zaloManager = getZaloWebViewManager();
      return zaloManager.show();
    } catch (error) {
      log.error('Error opening Zalo Web:', error);
      return false;
    }
  });

  ipcMain.handle('zaloweb:hide', async () => {
    log.info('IPC: zaloweb:hide');
    const zaloManager = getZaloWebViewManager();
    return zaloManager.hide();
  });

  ipcMain.handle('zaloweb:status', async () => {
    log.info('IPC: zaloweb:status');
    const zaloManager = getZaloWebViewManager();
    return zaloManager.getStatus();
  });

  ipcMain.handle('zaloweb:send', async (_, threadId: string, content: string, replyToMsgId?: string) => {
    log.info(`IPC: zaloweb:send - thread: ${threadId}`);
    const zaloManager = getZaloWebViewManager();
    return zaloManager.sendMessage(threadId, content, replyToMsgId);
  });

  ipcMain.handle('zaloweb:threads', async () => {
    log.info('IPC: zaloweb:threads');
    const zaloManager = getZaloWebViewManager();
    return zaloManager.getThreads();
  });

  // Terminal IPC handlers for embedded terminal
  ipcMain.handle('terminal:spawn', async (_, id: string, command: string, args: string[], cwd: string) => {
    log.info(`IPC: terminal:spawn - ${id}: ${command} ${args.join(' ')}`);
    try {
      terminalRunner.spawn(id, command, args, cwd);
      return { success: true };
    } catch (error: any) {
      log.error('Terminal spawn failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('terminal:write', (_, id: string, data: string) => {
    terminalRunner.write(id, data);
  });

  ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
    terminalRunner.resize(id, cols, rows);
  });

  ipcMain.handle('terminal:kill', async (_, id: string) => {
    log.info(`IPC: terminal:kill - ${id}`);
    terminalRunner.kill(id);
    return { success: true };
  });

  // Direct plugin install handler - uses child_process to avoid CJS/ESM issues
  ipcMain.handle('plugins:install-direct', async (_, pluginSpec: string) => {
    log.info(`IPC: plugins:install-direct - ${pluginSpec}`);

    try {
      const { spawn } = await import('child_process');
      const clawdbotRoot = getCLIRoot();
      const entryPoint = getCLIEntryPoint();

      log.info(`Installing plugin via CLI: ${entryPoint} plugins install ${pluginSpec}`);
      log.info(`CLI Root: ${clawdbotRoot}`);

      return new Promise((resolve) => {
        const child = spawn('node', [entryPoint, 'plugins', 'install', pluginSpec], {
          cwd: clawdbotRoot,
          stdio: 'pipe',
          env: { ...process.env },
          shell: true, // Required on Windows to find npm/pnpm in PATH
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          const line = data.toString();
          stdout += line;
          log.info(`[plugin] ${line.trim()}`);
        });

        child.stderr?.on('data', (data) => {
          const line = data.toString();
          stderr += line;
          log.warn(`[plugin] ${line.trim()}`);
        });

        child.on('close', (code) => {
          if (code === 0) {
            log.info(`Plugin ${pluginSpec} installed successfully`);
            resolve({ success: true, pluginId: pluginSpec });
          } else {
            log.error(`Plugin install failed with code ${code}: ${stderr}`);
            resolve({ success: false, error: stderr || `Exit code ${code}` });
          }
        });

        child.on('error', (err) => {
          log.error('Plugin install process error:', err);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error: any) {
      log.error('Direct plugin install failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get clawdbot root path
  ipcMain.handle('app:get-clawdbot-root', async () => {
    return getCLIRoot();
  });

  // Open external terminal window (simpler than PTY, avoids PATH issues)
  ipcMain.handle('terminal:open-external', async (_, cwd: string, command: string) => {
    log.info(`IPC: terminal:open-external - cwd: ${cwd}`);
    log.info(`Command: ${command}`);

    try {
      const { exec } = await import('child_process');

      // Use 'start' to open new CMD window that stays open
      // /k keeps window open, even if command fails
      const fullCommand = `start "Clawdbot Auth" /D "${cwd}" cmd /k "${command}"`;

      log.info(`Executing: ${fullCommand}`);

      exec(fullCommand, (error) => {
        if (error) {
          log.error('Error opening terminal:', error);
        }
      });

      log.info('External terminal opened successfully');
      return { success: true };
    } catch (error: any) {
      log.error('Failed to open external terminal:', error);
      return { success: false, error: error.message };
    }
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is already running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    windowManager?.show();
    windowManager?.focus();
  });

  app.whenReady().then(createApp);
}

// macOS specific
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager?.createMainWindow();
  } else {
    windowManager?.show();
  }
});

// Prevent app from closing when all windows are closed (tray app behavior)
app.on('window-all-closed', () => {
  // Don't quit on macOS or Windows - keep running in tray
  // Only quit if explicitly requested
});

// Cleanup on quit
app.on('before-quit', async () => {
  log.info('Shutting down Clawdbot Desktop...');
  setQuitting(true);
  destroyZaloWebViewManager();
  await gatewayBridge?.stop();
  trayManager?.destroy();
});
