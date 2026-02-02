import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
export interface GatewayStatus {
  running: boolean;
  port?: number;
  pid?: number;
  startedAt?: Date;
  channels?: string[];
  error?: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: string[];
  cost?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

export interface ProviderConfig {
  baseUrl: string;
  api: 'anthropic-messages' | 'openai-completions' | 'google-genai';
  apiKey?: string;
  apiKeySource?: 'env' | 'direct';
  models: ModelConfig[];
  headers?: Record<string, string>;
}

export interface AuthProfile {
  provider: string;
  mode: 'oauth' | 'api_key';
}

// Auth profiles store (from auth-profiles.json - separate from openclaw.json)
export interface AuthProfileCredential {
  type: 'token' | 'oauth';
  provider: string;
  token?: string;
}

export interface AuthProfileUsageStats {
  lastUsed?: number;
  errorCount?: number;
  cooldownUntil?: number;
  lastError?: string;
  lastErrorAt?: number;
}

export interface AuthProfilesStore {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
  lastGood: Record<string, string>;
  usageStats: Record<string, AuthProfileUsageStats>;
}

// Gateway config
export interface GatewayConfig {
  port?: number;
  mode?: 'local' | 'remote';
  bind?: 'loopback' | 'lan' | 'tailnet' | 'auto' | 'custom';
  auth?: {
    mode: 'token' | 'password' | 'none';
    token?: string;
    password?: string;
  };
}

export interface AgentsDefaults {
  model?: {
    primary: string;
    fallbacks?: string[];
  };
  models?: Record<string, { alias?: string }>;
  workspace?: string;
  maxConcurrent?: number;
  subagents?: {
    maxConcurrent?: number;
  };
}

export interface ModelSummary {
  providers: Record<string, ProviderConfig>;
  authProfiles: Record<string, AuthProfile>;
  agentsDefaults?: AgentsDefaults;
  currentModel: { provider?: string; model?: string };
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

export interface ChannelConfig {
  enabled?: boolean;
  token?: string;
  botToken?: string;
  dmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
  streamMode?: 'off' | 'partial' | 'block';
  allowFrom?: string[];
  [key: string]: unknown;
}

export interface SkillConfig {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

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
}

export interface ZaloWebStatus {
  active: boolean;
  loggedIn: boolean;
  url?: string;
  userId?: string;
  userName?: string;
}

export interface ZaloWebThread {
  threadId: string;
  name: string;
  isGroup: boolean;
}

export interface ElectronAPI {
  gateway: {
    start: () => Promise<GatewayStatus>;
    stop: () => Promise<GatewayStatus>;
    restart: () => Promise<GatewayStatus>;
    getStatus: () => Promise<GatewayStatus>;
    onStatusChange: (callback: (status: GatewayStatus) => void) => () => void;
  };
  terminal: {
    spawn: (id: string, command: string, args: string[], cwd: string) => Promise<{ success: boolean; error?: string }>;
    write: (id: string, data: string) => void;
    resize: (id: string, cols: number, rows: number) => void;
    kill: (id: string) => Promise<{ success: boolean }>;
    openExternal: (cwd: string, command: string) => Promise<{ success: boolean; error?: string }>;
    onOutput: (id: string, callback: (data: string) => void) => () => void;
    onExit: (id: string, callback: (code: number) => void) => () => void;
  };
  zaloweb: {
    open: () => Promise<boolean>;
    hide: () => Promise<boolean>;
    getStatus: () => Promise<ZaloWebStatus>;
    send: (threadId: string, content: string, replyToMsgId?: string) => Promise<{ ok: boolean; error?: string }>;
    getThreads: () => Promise<ZaloWebThread[]>;
    onMessage: (callback: (message: ZaloWebMessage) => void) => () => void;
    onLoginStatus: (callback: (status: { loggedIn: boolean; userId?: string; userName?: string }) => void) => () => void;
  };
  config: {
    getProviders: () => Promise<Record<string, ProviderConfig>>;
    addProvider: (name: string, config: ProviderConfig) => Promise<Record<string, ProviderConfig>>;
    updateProvider: (name: string, config: ProviderConfig) => Promise<Record<string, ProviderConfig>>;
    deleteProvider: (name: string) => Promise<Record<string, ProviderConfig>>;
    getCurrentModel: () => Promise<{ provider?: string; model?: string }>;
    setCurrentModel: (provider: string, model: string) => Promise<{ provider?: string; model?: string }>;
    getPath: () => Promise<string>;
    getModelSummary: () => Promise<ModelSummary>;
    getAgentsDefaults: () => Promise<AgentsDefaults | undefined>;
    updateAgentsDefaults: (updates: Partial<AgentsDefaults>) => Promise<AgentsDefaults | undefined>;
    getAuthProfiles: () => Promise<Record<string, AuthProfile>>;
    deleteAuthProfile: (id: string) => Promise<Record<string, AuthProfile>>;
    getChannels: () => Promise<Record<string, ChannelConfig>>;
    updateChannel: (channelId: string, config: ChannelConfig) => Promise<Record<string, ChannelConfig>>;
    getFullConfig: () => Promise<unknown>;
    getRawConfig: () => Promise<string>;
    getModelCatalog: () => Promise<ModelCatalogEntry[]>;
    getSkills: () => Promise<Record<string, SkillConfig>>;
    updateSkills: (skills: Record<string, SkillConfig>) => Promise<Record<string, SkillConfig>>;
    // Gateway config
    getGateway: () => Promise<GatewayConfig | undefined>;
    updateGateway: (config: GatewayConfig) => Promise<GatewayConfig | undefined>;
    // Auth profiles store (credentials - separate file)
    getAuthProfilesStore: () => Promise<AuthProfilesStore>;
    updateAuthProfileCredential: (profileId: string, data: AuthProfileCredential) => Promise<{ success: boolean; error?: string }>;
    deleteAuthProfileCredential: (profileId: string) => Promise<{ success: boolean; error?: string }>;
    clearAuthProfileCooldown: (profileId: string) => Promise<{ success: boolean; error?: string }>;
  };
  setup: {
    backupAndReset: () => Promise<{ success: boolean; backupPath?: string; error?: string }>;
    validateWorkspace: (path: string) => Promise<{ valid: boolean; writable: boolean; exists: boolean; error?: string }>;
    getDefaultWorkspacePath: () => Promise<{ success: boolean; path: string; error?: string }>;
    authOAuth: (provider: string) => Promise<{ success: boolean; error?: string }>;
    installGatewayService: (config: {
      port: number;
      bind: string;
      auth: string;
      token?: string;
      password?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    getServiceStatus: () => Promise<{
      installed: boolean;
      running: boolean;
      platform: string;
      error?: string;
    }>;
  };
  plugins: {
    checkInstalled: (pluginSpec: string) => Promise<{ installed: boolean; error?: string }>;
    install: (pluginSpec: string) => Promise<{ success: boolean; output?: string; error?: string }>;
    installDirect: (pluginSpec: string) => Promise<{ success: boolean; pluginId?: string; error?: string }>;
  };
  app: {
    getVersion: () => Promise<string>;
    quit: () => void;
    runAuthLogin: (provider: string) => Promise<{ success: boolean; error?: string }>;
    getClawdbotRoot: () => Promise<string>;
  };
  auth: {
    importClaudeCLI: () => Promise<{ success: boolean; token?: string; source?: string; error?: string }>;
  };
  dialog?: {
    showOpenDialog?: (options: {
      properties?: string[];
      defaultPath?: string;
    }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  shell?: {
    openExternal?: (url: string) => Promise<void>;
  };
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  gateway: {
    start: () => ipcRenderer.invoke('gateway:start'),
    stop: () => ipcRenderer.invoke('gateway:stop'),
    restart: () => ipcRenderer.invoke('gateway:restart'),
    getStatus: () => ipcRenderer.invoke('gateway:status'),
    onStatusChange: (callback: (status: GatewayStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: GatewayStatus) => {
        callback(status);
      };
      ipcRenderer.on('gateway:status-changed', handler);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('gateway:status-changed', handler);
      };
    },
  },
  terminal: {
    spawn: (id: string, command: string, args: string[], cwd: string) =>
      ipcRenderer.invoke('terminal:spawn', id, command, args, cwd),
    write: (id: string, data: string) =>
      ipcRenderer.send('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', id, cols, rows),
    kill: (id: string) =>
      ipcRenderer.invoke('terminal:kill', id),
    openExternal: (cwd: string, command: string) =>
      ipcRenderer.invoke('terminal:open-external', cwd, command),
    onOutput: (id: string, callback: (data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: string) => {
        callback(data);
      };
      ipcRenderer.on(`terminal:output:${id}`, handler);
      return () => {
        ipcRenderer.removeListener(`terminal:output:${id}`, handler);
      };
    },
    onExit: (id: string, callback: (code: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, code: number) => {
        callback(code);
      };
      ipcRenderer.on(`terminal:exit:${id}`, handler);
      return () => {
        ipcRenderer.removeListener(`terminal:exit:${id}`, handler);
      };
    },
  },
  zaloweb: {
    open: () => ipcRenderer.invoke('zaloweb:open'),
    hide: () => ipcRenderer.invoke('zaloweb:hide'),
    getStatus: () => ipcRenderer.invoke('zaloweb:status'),
    send: (threadId: string, content: string, replyToMsgId?: string) =>
      ipcRenderer.invoke('zaloweb:send', threadId, content, replyToMsgId),
    getThreads: () => ipcRenderer.invoke('zaloweb:threads'),
    onMessage: (callback: (message: ZaloWebMessage) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: ZaloWebMessage) => {
        callback(message);
      };
      ipcRenderer.on('zaloweb:message', handler);
      return () => {
        ipcRenderer.removeListener('zaloweb:message', handler);
      };
    },
    onLoginStatus: (callback: (status: { loggedIn: boolean; userId?: string; userName?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: { loggedIn: boolean; userId?: string; userName?: string }) => {
        callback(status);
      };
      ipcRenderer.on('zaloweb:login-status', handler);
      return () => {
        ipcRenderer.removeListener('zaloweb:login-status', handler);
      };
    },
  },
  config: {
    getProviders: () => ipcRenderer.invoke('config:get-providers'),
    addProvider: (name: string, config: ProviderConfig) =>
      ipcRenderer.invoke('config:add-provider', name, config),
    updateProvider: (name: string, config: ProviderConfig) =>
      ipcRenderer.invoke('config:update-provider', name, config),
    deleteProvider: (name: string) => ipcRenderer.invoke('config:delete-provider', name),
    getCurrentModel: () => ipcRenderer.invoke('config:get-current-model'),
    setCurrentModel: (provider: string, model: string) =>
      ipcRenderer.invoke('config:set-current-model', provider, model),
    getPath: () => ipcRenderer.invoke('config:get-path'),
    getModelSummary: () => ipcRenderer.invoke('config:get-model-summary'),
    getAgentsDefaults: () => ipcRenderer.invoke('config:get-agents-defaults'),
    updateAgentsDefaults: (updates: Partial<AgentsDefaults>) =>
      ipcRenderer.invoke('config:update-agents-defaults', updates),
    getAuthProfiles: () => ipcRenderer.invoke('config:get-auth-profiles'),
    deleteAuthProfile: (id: string) => ipcRenderer.invoke('config:delete-auth-profile', id),
    getChannels: () => ipcRenderer.invoke('config:get-channels'),
    updateChannel: (channelId: string, config: ChannelConfig) =>
      ipcRenderer.invoke('config:update-channel', channelId, config),
    getFullConfig: () => ipcRenderer.invoke('config:get-full'),
    getRawConfig: () => ipcRenderer.invoke('config:get-raw'),
    getModelCatalog: () => ipcRenderer.invoke('config:get-model-catalog'),
    getSkills: () => ipcRenderer.invoke('config:get-skills'),
    updateSkills: (skills: Record<string, any>) => ipcRenderer.invoke('config:update-skills', skills),
    // Gateway config
    getGateway: () => ipcRenderer.invoke('config:get-gateway'),
    updateGateway: (config: any) => ipcRenderer.invoke('config:update-gateway', config),
    // Auth profiles store (credentials - separate file)
    getAuthProfilesStore: () => ipcRenderer.invoke('config:get-auth-profiles-store'),
    updateAuthProfileCredential: (profileId: string, data: any) =>
      ipcRenderer.invoke('config:update-auth-profile-credential', profileId, data),
    deleteAuthProfileCredential: (profileId: string) =>
      ipcRenderer.invoke('config:delete-auth-profile-credential', profileId),
    clearAuthProfileCooldown: (profileId: string) =>
      ipcRenderer.invoke('config:clear-auth-profile-cooldown', profileId),
  },
  setup: {
    backupAndReset: () => ipcRenderer.invoke('config:backup-and-reset'),
    validateWorkspace: (path: string) => ipcRenderer.invoke('workspace:validate', path),
    getDefaultWorkspacePath: () => ipcRenderer.invoke('workspace:get-default-path'),
    authOAuth: (provider: string) => ipcRenderer.invoke('app:run-auth-login', provider),
    installGatewayService: (config: {
      port: number;
      bind: string;
      auth: string;
      token?: string;
      password?: string;
    }) => ipcRenderer.invoke('gateway:install-service', config),
    getServiceStatus: () => ipcRenderer.invoke('gateway:get-service-status'),
  },
  plugins: {
    checkInstalled: (pluginSpec: string) => ipcRenderer.invoke('plugins:check-installed', pluginSpec),
    install: (pluginSpec: string) => ipcRenderer.invoke('plugins:install', pluginSpec),
    installDirect: (pluginSpec: string) => ipcRenderer.invoke('plugins:install-direct', pluginSpec),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.send('app:quit'),
    runAuthLogin: (provider: string) => ipcRenderer.invoke('app:run-auth-login', provider),
    getClawdbotRoot: () => ipcRenderer.invoke('app:get-clawdbot-root'),
  },
  auth: {
    importClaudeCLI: () => ipcRenderer.invoke('auth:import-claude-cli'),
  },
  dialog: {
    showOpenDialog: (options: { properties?: string[]; defaultPath?: string }) =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
} satisfies ElectronAPI);

// Declare the global type for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
