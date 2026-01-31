import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import log from 'electron-log';

export interface TrayCallbacks {
  onShowWindow: () => void;
  onHideWindow: () => void;
  onToggleWindow: () => void;
  onStartGateway: () => void;
  onStopGateway: () => void;
  onRestartGateway: () => void;
  onQuit: () => void;
  getGatewayStatus: () => { running: boolean };
}

export class TrayManager {
  private tray: Tray | null = null;
  private callbacks: TrayCallbacks;
  private isGatewayRunning = false;

  constructor(callbacks: TrayCallbacks) {
    this.callbacks = callbacks;
    this.createTray();
  }

  private getIconPath(active: boolean): string {
    const iconName = active ? 'tray-active.png' : 'tray-inactive.png';

    // Try multiple paths for development and production
    const possiblePaths = [
      path.join(__dirname, '../../resources', iconName),
      path.join(__dirname, '../resources', iconName),
      path.join(app.getAppPath(), 'resources', iconName),
      path.join(process.resourcesPath || '', iconName),
    ];

    // Fallback to a default icon path
    return possiblePaths[0];
  }

  private createTray() {
    try {
      const iconPath = this.getIconPath(false);
      log.info(`Creating tray with icon: ${iconPath}`);

      // Create a simple 16x16 icon if file doesn't exist
      let icon = nativeImage.createEmpty();
      try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
          // Create a simple colored square as fallback
          icon = this.createFallbackIcon(false);
        }
      } catch {
        icon = this.createFallbackIcon(false);
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('Clawdbot Desktop');

      this.updateContextMenu();

      // Double-click to show window
      this.tray.on('double-click', () => {
        this.callbacks.onToggleWindow();
      });

      log.info('Tray created successfully');
    } catch (err) {
      log.error('Failed to create tray:', err);
    }
  }

  private createFallbackIcon(active: boolean): Electron.NativeImage {
    // Create a simple 16x16 icon programmatically
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);

    const color = active
      ? { r: 76, g: 175, b: 80, a: 255 }   // Green
      : { r: 158, g: 158, b: 158, a: 255 }; // Gray

    for (let i = 0; i < size * size; i++) {
      const offset = i * 4;
      canvas[offset] = color.r;
      canvas[offset + 1] = color.g;
      canvas[offset + 2] = color.b;
      canvas[offset + 3] = color.a;
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  private updateContextMenu() {
    const status = this.callbacks.getGatewayStatus();
    this.isGatewayRunning = status.running;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Dashboard',
        click: () => this.callbacks.onShowWindow(),
      },
      { type: 'separator' },
      {
        label: status.running ? '● Gateway Running' : '○ Gateway Stopped',
        enabled: false,
      },
      {
        label: 'Start Gateway',
        enabled: !status.running,
        click: () => this.callbacks.onStartGateway(),
      },
      {
        label: 'Stop Gateway',
        enabled: status.running,
        click: () => this.callbacks.onStopGateway(),
      },
      {
        label: 'Restart Gateway',
        enabled: status.running,
        click: () => this.callbacks.onRestartGateway(),
      },
      { type: 'separator' },
      {
        label: 'Quit Clawdbot',
        click: () => this.callbacks.onQuit(),
      },
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  updateStatus(running: boolean) {
    if (this.isGatewayRunning !== running) {
      this.isGatewayRunning = running;

      // Update icon
      try {
        const icon = this.createFallbackIcon(running);
        this.tray?.setImage(icon);
      } catch (err) {
        log.error('Failed to update tray icon:', err);
      }

      // Update tooltip
      this.tray?.setToolTip(
        running ? 'Clawdbot Desktop - Gateway Running' : 'Clawdbot Desktop - Gateway Stopped'
      );

      // Update menu
      this.updateContextMenu();
    }
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }
}
