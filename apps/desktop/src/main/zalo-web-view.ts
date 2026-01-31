import { BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

const ZALO_WEB_URL = 'https://chat.zalo.me';
const ZALO_PARTITION = 'persist:zaloweb';

export interface ZaloWebMessage {
  msgId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  msgType: 'text' | 'image' | 'sticker' | 'file' | 'link' | 'unknown';
  timestamp: number;
  isGroup: boolean;
  groupName?: string;
  mediaUrl?: string;
  raw?: unknown;
}

export interface ZaloLoginStatus {
  loggedIn: boolean;
  userId?: string;
  userName?: string;
  error?: string;
}

export interface ZaloWebViewStatus {
  active: boolean;
  loggedIn: boolean;
  url?: string;
  userId?: string;
  userName?: string;
}

type MessageCallback = (message: ZaloWebMessage) => void;
type LoginStatusCallback = (status: ZaloLoginStatus) => void;

export class ZaloWebViewManager {
  private zaloWindow: BrowserWindow | null = null;
  private messageCallbacks: MessageCallback[] = [];
  private loginStatusCallbacks: LoginStatusCallback[] = [];
  private isLoggedIn = false;
  private currentUser: { userId?: string; userName?: string } = {};
  private injectScriptPath: string;

  constructor() {
    // Path to inject script - __dirname is dist/main, preload is in dist/preload
    this.injectScriptPath = path.join(__dirname, '..', 'preload', 'zalo-inject.js');
    log.info('Zalo inject script path:', this.injectScriptPath);
  }

  /**
   * Setup IPC listeners for messages from the injected script
   * Call this once after creating the manager
   */
  setupIpcListeners() {
    // Handle messages from injected script (these are 'on' not 'handle')
    ipcMain.on('zaloweb:internal:message', (event, message: ZaloWebMessage) => {
      log.info('Zalo Web message received:', message.msgId);
      this.messageCallbacks.forEach(cb => cb(message));
    });

    // Handle login status updates from injected script
    ipcMain.on('zaloweb:internal:login-status', (event, status: ZaloLoginStatus) => {
      log.info('Zalo Web login status:', status);
      this.isLoggedIn = status.loggedIn;
      if (status.loggedIn) {
        this.currentUser = {
          userId: status.userId,
          userName: status.userName,
        };
      }
      this.loginStatusCallbacks.forEach(cb => cb(status));
    });
  }

  /**
   * Open Zalo Web in a separate window
   */
  async show(): Promise<boolean> {
    // If window already exists, just focus it
    if (this.zaloWindow && !this.zaloWindow.isDestroyed()) {
      this.zaloWindow.focus();
      return true;
    }

    try {
      // Create session with persistence
      const ses = session.fromPartition(ZALO_PARTITION);

      // Create new window for Zalo Web
      this.zaloWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Zalo Web - Clawdbot',
        icon: path.join(__dirname, '..', '..', 'resources', 'icon.png'),
        webPreferences: {
          partition: ZALO_PARTITION,
          preload: this.injectScriptPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      // Handle window close - just hide, don't destroy (to keep session)
      this.zaloWindow.on('close', (e) => {
        // Prevent actual close, just hide
        e.preventDefault();
        this.zaloWindow?.hide();
        log.info('Zalo Web window hidden');
      });

      // Handle window destroy
      this.zaloWindow.on('closed', () => {
        this.zaloWindow = null;
        log.info('Zalo Web window destroyed');
      });

      // Load Zalo Web
      await this.zaloWindow.loadURL(ZALO_WEB_URL);
      log.info('Zalo Web loaded:', ZALO_WEB_URL);

      // Inject monitoring script after page loads
      this.zaloWindow.webContents.on('did-finish-load', () => {
        this.injectMonitorScript();
      });

      return true;
    } catch (error) {
      log.error('Failed to open Zalo Web window:', error);
      return false;
    }
  }

  /**
   * Hide the Zalo Web window (keeps session active)
   */
  hide(): boolean {
    if (!this.zaloWindow || this.zaloWindow.isDestroyed()) {
      return false;
    }

    try {
      this.zaloWindow.hide();
      log.info('Zalo WebView hidden');
      return true;
    } catch (error) {
      log.error('Failed to hide Zalo WebView:', error);
      return false;
    }
  }

  /**
   * Check if window is currently visible
   */
  isVisible(): boolean {
    return this.zaloWindow !== null && !this.zaloWindow.isDestroyed() && this.zaloWindow.isVisible();
  }

  /**
   * Get current status
   */
  getStatus(): ZaloWebViewStatus {
    const windowActive = this.zaloWindow !== null && !this.zaloWindow.isDestroyed();
    return {
      active: windowActive,
      loggedIn: this.isLoggedIn,
      url: windowActive ? this.zaloWindow?.webContents.getURL() : undefined,
      userId: this.currentUser.userId,
      userName: this.currentUser.userName,
    };
  }

  /**
   * Inject the monitoring script into Zalo Web
   */
  private async injectMonitorScript(): Promise<void> {
    if (!this.zaloWindow || this.zaloWindow.isDestroyed()) return;

    try {
      // Read and inject the monitor script
      const scriptPath = path.join(__dirname, '..', 'preload', 'zalo-monitor.js');

      // Check if file exists, if not use inline script
      let script: string;
      if (fs.existsSync(scriptPath)) {
        script = fs.readFileSync(scriptPath, 'utf-8');
      } else {
        // Inline fallback script
        script = this.getInlineMonitorScript();
      }

      await this.zaloWindow.webContents.executeJavaScript(script);
      log.info('Zalo monitor script injected');
    } catch (error) {
      log.error('Failed to inject monitor script:', error);
    }
  }

  /**
   * Inline monitor script as fallback
   */
  private getInlineMonitorScript(): string {
    return `
      (function() {
        console.log('[Moltbot] Zalo Web monitor initialized');

        // Check login status
        function checkLoginStatus() {
          const isLoggedIn = !!document.querySelector('[data-id="conversation-list"]') ||
                            !!document.querySelector('.conv-list') ||
                            !!document.querySelector('[class*="ChatList"]');

          // Try to get user info
          let userId, userName;
          const userElement = document.querySelector('[data-id="profile"]') ||
                             document.querySelector('.user-profile') ||
                             document.querySelector('[class*="UserProfile"]');
          if (userElement) {
            userName = userElement.textContent?.trim();
          }

          window.electronAPI?.zalo?.reportLoginStatus({
            loggedIn: isLoggedIn,
            userId,
            userName,
          });

          return isLoggedIn;
        }

        // Monitor for new messages using MutationObserver
        function setupMessageObserver() {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  // Check if this is a new message element
                  const msgElement = node.querySelector?.('[data-id^="msg-"]') ||
                                    (node.matches?.('[data-id^="msg-"]') ? node : null);
                  if (msgElement) {
                    const message = extractMessageData(msgElement);
                    if (message) {
                      window.electronAPI?.zalo?.reportMessage(message);
                    }
                  }
                }
              });
            });
          });

          // Start observing
          const chatContainer = document.querySelector('[data-id="conversation-messages"]') ||
                               document.querySelector('.chat-messages') ||
                               document.querySelector('[class*="MessageList"]') ||
                               document.body;

          observer.observe(chatContainer, {
            childList: true,
            subtree: true,
          });

          console.log('[Moltbot] Message observer started');
        }

        // Extract message data from DOM element
        function extractMessageData(element) {
          try {
            const msgId = element.getAttribute('data-id') || 'msg-' + Date.now();
            const content = element.querySelector('.message-content, [class*="content"]')?.textContent || '';
            const senderEl = element.querySelector('.sender-name, [class*="sender"]');
            const senderName = senderEl?.textContent || 'Unknown';

            // Determine if group message
            const isGroup = !!document.querySelector('[data-id="group-info"]') ||
                           !!document.querySelector('[class*="GroupHeader"]');

            return {
              msgId,
              threadId: getCurrentThreadId(),
              senderId: '',
              senderName,
              content,
              msgType: 'text',
              timestamp: Date.now(),
              isGroup,
            };
          } catch (e) {
            console.error('[Moltbot] Failed to extract message:', e);
            return null;
          }
        }

        // Get current thread/conversation ID
        function getCurrentThreadId() {
          // Try to extract from URL or DOM
          const url = window.location.href;
          const match = url.match(/\\/([\\w-]+)$/);
          if (match) return match[1];

          const activeConv = document.querySelector('.conversation-item.active, [class*="active"]');
          return activeConv?.getAttribute('data-id') || 'unknown';
        }

        // Initialize
        let checkCount = 0;
        const initInterval = setInterval(() => {
          checkCount++;
          if (checkLoginStatus()) {
            clearInterval(initInterval);
            setupMessageObserver();
          } else if (checkCount > 30) {
            // Stop checking after 30 seconds
            clearInterval(initInterval);
            console.log('[Moltbot] Login check timeout');
          }
        }, 1000);
      })();
    `;
  }

  /**
   * Send a message to a thread
   */
  async sendMessage(threadId: string, content: string, replyToMsgId?: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.zaloWindow || this.zaloWindow.isDestroyed() || !this.isLoggedIn) {
      return { ok: false, error: 'Zalo Web not ready' };
    }

    try {
      // Execute script to send message
      const script = `
        (function() {
          // Navigate to thread if needed
          const threadEl = document.querySelector('[data-id="${threadId}"]');
          if (threadEl) threadEl.click();

          // Wait a bit then type and send
          setTimeout(() => {
            const input = document.querySelector('[data-id="chat-input"]') ||
                         document.querySelector('[contenteditable="true"]') ||
                         document.querySelector('textarea');
            if (input) {
              input.focus();
              input.value = ${JSON.stringify(content)};
              input.dispatchEvent(new Event('input', { bubbles: true }));

              // Trigger send
              const sendBtn = document.querySelector('[data-id="send-btn"]') ||
                             document.querySelector('button[type="submit"]');
              if (sendBtn) sendBtn.click();

              // Or press Enter
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
            }
          }, 500);
          return true;
        })();
      `;

      await this.zaloWindow.webContents.executeJavaScript(script);
      return { ok: true };
    } catch (error) {
      log.error('Failed to send Zalo message:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get list of threads/conversations
   */
  async getThreads(): Promise<Array<{ threadId: string; name: string; isGroup: boolean }>> {
    if (!this.zaloWindow || this.zaloWindow.isDestroyed() || !this.isLoggedIn) {
      return [];
    }

    try {
      const script = `
        (function() {
          const threads = [];
          const convItems = document.querySelectorAll('[data-id^="conv-"], .conversation-item');
          convItems.forEach(item => {
            const id = item.getAttribute('data-id') || '';
            const name = item.querySelector('.conv-name, [class*="name"]')?.textContent || '';
            const isGroup = !!item.querySelector('[class*="group"]');
            threads.push({ threadId: id, name, isGroup });
          });
          return threads;
        })();
      `;

      return await this.zaloWindow.webContents.executeJavaScript(script);
    } catch (error) {
      log.error('Failed to get Zalo threads:', error);
      return [];
    }
  }

  /**
   * Register callback for new messages
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Register callback for login status changes
   */
  onLoginStatus(callback: LoginStatusCallback): void {
    this.loginStatusCallbacks.push(callback);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.zaloWindow && !this.zaloWindow.isDestroyed()) {
      // Force close without hiding
      this.zaloWindow.removeAllListeners('close');
      this.zaloWindow.close();
      this.zaloWindow = null;
    }
    this.messageCallbacks = [];
    this.loginStatusCallbacks = [];
  }
}

// Singleton instance
let zaloWebViewManager: ZaloWebViewManager | null = null;

export function getZaloWebViewManager(): ZaloWebViewManager {
  if (!zaloWebViewManager) {
    zaloWebViewManager = new ZaloWebViewManager();
  }
  return zaloWebViewManager;
}

export function destroyZaloWebViewManager(): void {
  if (zaloWebViewManager) {
    zaloWebViewManager.destroy();
    zaloWebViewManager = null;
  }
}
