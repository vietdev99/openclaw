/**
 * Preload script for Zalo Web BrowserView
 * This script is injected into the Zalo Web context and provides
 * a bridge between Zalo Web and the Electron main process.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface ZaloMessage {
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
}

export interface ZaloLoginStatus {
  loggedIn: boolean;
  userId?: string;
  userName?: string;
  error?: string;
}

// Expose Zalo-specific API to the renderer (Zalo Web page context)
contextBridge.exposeInMainWorld('electronAPI', {
  zalo: {
    /**
     * Report a new message to main process
     */
    reportMessage: (message: ZaloMessage) => {
      ipcRenderer.send('zaloweb:internal:message', message);
    },

    /**
     * Report login status change
     */
    reportLoginStatus: (status: ZaloLoginStatus) => {
      ipcRenderer.send('zaloweb:internal:login-status', status);
    },

    /**
     * Report thread list
     */
    reportThreads: (threads: Array<{ threadId: string; name: string; isGroup: boolean }>) => {
      ipcRenderer.send('zaloweb:internal:threads', threads);
    },

    /**
     * Report an error
     */
    reportError: (error: string) => {
      ipcRenderer.send('zaloweb:internal:error', error);
    },
  },
});

// Log that preload script is loaded
console.log('[Moltbot] Zalo Web preload script loaded');
