import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

// Track app quitting state
let isQuitting = false;

export function setQuitting(value: boolean) {
  isQuitting = value;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    log.info('Creating main window...');

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      title: 'Clawdbot Desktop',
      icon: path.join(__dirname, '../../resources/icon.ico'),
      backgroundColor: '#1a1b26', // Dark background color
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Required for preload script
      },
      show: false, // Don't show until ready
      autoHideMenuBar: true,
      titleBarStyle: 'default', // Use default title bar with dark theme
      darkTheme: true, // Enable dark theme for Windows
    });

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Hide instead of close (tray app behavior)
    this.mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
        log.info('Window hidden to tray');
      }
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Load the app - auto-detect dev mode by checking if production file exists
    const productionIndexPath = path.join(__dirname, '../renderer/index.html');
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

    // Check if production build exists
    const hasProductionBuild = fs.existsSync(productionIndexPath);
    const isDev = process.env.NODE_ENV === 'development' ||
                  process.env.VITE_DEV_SERVER_URL ||
                  !hasProductionBuild;

    if (isDev) {
      log.info(`Loading dev URL: ${devUrl}`);
      try {
        await this.mainWindow.loadURL(devUrl);
        this.mainWindow.webContents.openDevTools();
      } catch (err) {
        log.error('Failed to load dev URL, falling back to production:', err);
        if (hasProductionBuild) {
          await this.mainWindow.loadFile(productionIndexPath);
        }
      }
    } else {
      log.info(`Loading production file: ${productionIndexPath}`);
      await this.mainWindow.loadFile(productionIndexPath);
    }

    log.info('Main window created');
    return this.mainWindow;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  show() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hide() {
    this.mainWindow?.hide();
  }

  toggle() {
    if (this.mainWindow?.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  focus() {
    this.mainWindow?.focus();
  }

  close() {
    this.mainWindow?.close();
  }

  destroy() {
    this.mainWindow?.destroy();
    this.mainWindow = null;
  }
}
