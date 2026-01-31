import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as tar from 'tar';
import log from 'electron-log';
import JSON5 from 'json5';

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

export interface AgentModelConfig {
  primary: string;
  fallbacks?: string[];
}

export interface AgentsDefaults {
  model?: AgentModelConfig;
  models?: Record<string, { alias?: string }>;
  workspace?: string;
  maxConcurrent?: number;
  subagents?: {
    maxConcurrent?: number;
  };
}

export interface AuthProfile {
  provider: string;
  mode: 'oauth' | 'api_key';
}

export interface MoltbotConfig {
  models?: {
    provider?: string;
    model?: string;
    providers?: Record<string, ProviderConfig>;
  };
  agents?: {
    defaults?: AgentsDefaults;
  };
  auth?: {
    profiles?: Record<string, AuthProfile>;
  };
  [key: string]: any;
}

export class ConfigManager {
  private configPath: string;

  constructor() {
    // Find config path: ~/.moltbot/moltbot.json or ~/.clawdbot/moltbot.json
    const moltbotDir = path.join(os.homedir(), '.moltbot');
    const clawdbotDir = path.join(os.homedir(), '.clawdbot');

    if (fs.existsSync(path.join(moltbotDir, 'moltbot.json'))) {
      this.configPath = path.join(moltbotDir, 'moltbot.json');
    } else if (fs.existsSync(path.join(clawdbotDir, 'moltbot.json'))) {
      this.configPath = path.join(clawdbotDir, 'moltbot.json');
    } else {
      // Default to clawdbot dir, create if needed
      if (!fs.existsSync(clawdbotDir)) {
        fs.mkdirSync(clawdbotDir, { recursive: true });
      }
      this.configPath = path.join(clawdbotDir, 'moltbot.json');
    }

    log.info(`ConfigManager using config path: ${this.configPath}`);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getWorkspaceDir(): string {
    return path.dirname(this.configPath);
  }

  async loadConfig(): Promise<MoltbotConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        log.info('Config file does not exist, returning empty config');
        return {};
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');

      // Use JSON5 parser - supports comments, trailing commas, and handles edge cases
      const config = JSON5.parse(content);

      log.info('Config loaded successfully');
      return config;
    } catch (err) {
      log.error('Failed to load config:', err);
      return {};
    }
  }

  async saveConfig(config: MoltbotConfig): Promise<void> {
    try {
      // Create backup
      if (fs.existsSync(this.configPath)) {
        const backupPath = this.configPath + '.bak';
        fs.copyFileSync(this.configPath, backupPath);
      }

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write config with pretty formatting
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf-8');

      log.info('Config saved successfully');
    } catch (err) {
      log.error('Failed to save config:', err);
      throw err;
    }
  }

  async getProviders(): Promise<Record<string, ProviderConfig>> {
    const config = await this.loadConfig();
    return config?.models?.providers || {};
  }

  async addProvider(name: string, provider: ProviderConfig): Promise<void> {
    const config = await this.loadConfig();

    if (!config.models) {
      config.models = {};
    }
    if (!config.models.providers) {
      config.models.providers = {};
    }

    config.models.providers[name] = provider;
    await this.saveConfig(config);

    log.info(`Provider added: ${name}`);
  }

  async updateProvider(name: string, provider: ProviderConfig): Promise<void> {
    const config = await this.loadConfig();

    if (!config.models?.providers?.[name]) {
      throw new Error(`Provider not found: ${name}`);
    }

    config.models.providers[name] = provider;
    await this.saveConfig(config);

    log.info(`Provider updated: ${name}`);
  }

  async deleteProvider(name: string): Promise<void> {
    const config = await this.loadConfig();

    if (config.models?.providers?.[name]) {
      delete config.models.providers[name];

      // If deleted provider was the current one, clear it
      if (config.models.provider === name) {
        delete config.models.provider;
        delete config.models.model;
      }

      await this.saveConfig(config);
      log.info(`Provider deleted: ${name}`);
    }
  }

  async getCurrentModel(): Promise<{ provider?: string; model?: string }> {
    const config = await this.loadConfig();
    return {
      provider: config?.models?.provider,
      model: config?.models?.model,
    };
  }

  async setCurrentModel(provider: string, model: string): Promise<void> {
    const config = await this.loadConfig();

    if (!config.models) {
      config.models = {};
    }

    config.models.provider = provider;
    config.models.model = model;

    await this.saveConfig(config);
    log.info(`Current model set: ${provider}/${model}`);
  }

  async getAgentsDefaults(): Promise<AgentsDefaults | undefined> {
    const config = await this.loadConfig();
    return config?.agents?.defaults;
  }

  async getAuthProfiles(): Promise<Record<string, AuthProfile>> {
    const config = await this.loadConfig();
    return config?.auth?.profiles || {};
  }

  /**
   * Get a summary of all configured model sources:
   * - Explicit providers from models.providers
   * - Auth profiles (anthropic from CLI, etc.)
   * - Agent defaults (primary model, fallbacks)
   */
  async getModelSummary(): Promise<{
    providers: Record<string, ProviderConfig>;
    authProfiles: Record<string, AuthProfile>;
    agentsDefaults?: AgentsDefaults;
    currentModel: { provider?: string; model?: string };
  }> {
    const config = await this.loadConfig();
    return {
      providers: config?.models?.providers || {},
      authProfiles: config?.auth?.profiles || {},
      agentsDefaults: config?.agents?.defaults,
      currentModel: {
        provider: config?.models?.provider,
        model: config?.models?.model,
      },
    };
  }

  // Auth Profile CRUD
  async addAuthProfile(id: string, profile: AuthProfile): Promise<void> {
    const config = await this.loadConfig();
    if (!config.auth) config.auth = {};
    if (!config.auth.profiles) config.auth.profiles = {};
    config.auth.profiles[id] = profile;
    await this.saveConfig(config);
    log.info(`Auth profile added: ${id}`);
  }

  async deleteAuthProfile(id: string): Promise<void> {
    const config = await this.loadConfig();
    if (config.auth?.profiles?.[id]) {
      delete config.auth.profiles[id];
      await this.saveConfig(config);
      log.info(`Auth profile deleted: ${id}`);
    }
  }

  // Agent Defaults updates - deep merge to preserve existing fields
  async updateAgentsDefaults(updates: Partial<AgentsDefaults>): Promise<void> {
    const config = await this.loadConfig();
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};

    const existing = config.agents.defaults;

    // Deep merge - preserve fields not in updates
    if (updates.model) {
      existing.model = {
        ...existing.model,
        ...updates.model,
      };
    }
    if (updates.models) {
      existing.models = {
        ...existing.models,
        ...updates.models,
      };
    }
    if (updates.maxConcurrent !== undefined) {
      existing.maxConcurrent = updates.maxConcurrent;
    }
    if (updates.subagents) {
      existing.subagents = {
        ...existing.subagents,
        ...updates.subagents,
      };
    }
    // Preserve workspace, compaction, and other fields not in UI
    // (they are not touched by this update)

    await this.saveConfig(config);
    log.info('Agent defaults updated');
  }

  async setAgentPrimaryModel(primary: string, fallbacks?: string[]): Promise<void> {
    const config = await this.loadConfig();
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};

    config.agents.defaults.model = { primary, fallbacks };
    await this.saveConfig(config);
    log.info(`Agent primary model set: ${primary}`);
  }

  async addModelAlias(modelId: string, alias: string): Promise<void> {
    const config = await this.loadConfig();
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.models) config.agents.defaults.models = {};

    config.agents.defaults.models[modelId] = { alias };
    await this.saveConfig(config);
    log.info(`Model alias added: ${modelId} -> ${alias}`);
  }

  async removeModelAlias(modelId: string): Promise<void> {
    const config = await this.loadConfig();
    if (config.agents?.defaults?.models?.[modelId]) {
      delete config.agents.defaults.models[modelId];
      await this.saveConfig(config);
      log.info(`Model alias removed: ${modelId}`);
    }
  }

  // Channels config
  async getChannelsConfig(): Promise<Record<string, any>> {
    const config = await this.loadConfig();
    return config?.channels || {};
  }

  async updateChannelConfig(channelName: string, channelConfig: any): Promise<void> {
    const config = await this.loadConfig();
    if (!config.channels) config.channels = {};
    config.channels[channelName] = channelConfig;
    await this.saveConfig(config);
    log.info(`Channel config updated: ${channelName}`);
  }

  // Gateway config
  async getGatewayConfig(): Promise<any> {
    const config = await this.loadConfig();
    return config?.gateway || {};
  }

  async updateGatewayConfig(gatewayConfig: any): Promise<void> {
    const config = await this.loadConfig();
    config.gateway = gatewayConfig;
    await this.saveConfig(config);
    log.info('Gateway config updated');
  }

  // Get raw config for display
  async getRawConfig(): Promise<string> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return '{}';
      }
      return fs.readFileSync(this.configPath, 'utf-8');
    } catch (err) {
      log.error('Failed to read raw config:', err);
      return '{}';
    }
  }

  // Get full config object
  async getFullConfig(): Promise<MoltbotConfig> {
    return this.loadConfig();
  }

  // Backup config directories to timestamped tar.gz file
  async backupConfig(): Promise<string> {
    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5); // Remove milliseconds
      const backupFileName = `moltbot_backup_${timestamp}.tar.gz`;
      const backupPath = path.join(os.homedir(), backupFileName);

      // Backup ~/.moltbot and ~/.clawdbot
      const dirs = [
        path.join(os.homedir(), '.moltbot'),
        path.join(os.homedir(), '.clawdbot'),
      ];

      // Filter to only existing directories
      const existingDirs = dirs.filter((d) => fs.existsSync(d));

      if (existingDirs.length === 0) {
        log.warn('No config directories found to backup');
        return '';
      }

      // Create tar.gz archive
      await tar.create(
        {
          gzip: true,
          file: backupPath,
          cwd: os.homedir(),
        },
        existingDirs.map((d) => path.basename(d))
      );

      log.info(`Config backed up to: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      log.error('Failed to backup config:', error);
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  // Reset config directories (delete and recreate)
  async resetConfig(): Promise<void> {
    try {
      const dirs = [
        path.join(os.homedir(), '.moltbot'),
        path.join(os.homedir(), '.clawdbot'),
      ];

      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          await fse.remove(dir);
          log.info(`Removed directory: ${dir}`);
        }
      }

      // Recreate workspace with fresh config
      const workspaceDir = path.join(os.homedir(), '.moltbot');
      await this.initializeWorkspace(workspaceDir);

      // Update config path
      this.configPath = path.join(workspaceDir, 'moltbot.json');
      log.info(`Workspace reset and reinitialized at: ${workspaceDir}`);
    } catch (error: any) {
      log.error('Failed to reset config:', error);
      throw new Error(`Reset failed: ${error.message}`);
    }
  }

  // Validate if a path is a valid workspace directory
  async isValidWorkspace(dirPath: string): Promise<boolean> {
    try {
      const configPath = path.join(dirPath, 'moltbot.json');
      if (!fs.existsSync(configPath)) {
        return false;
      }

      // Try to parse the config
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON5.parse(content);

      // Basic validation - must be an object
      return config && typeof config === 'object';
    } catch (error) {
      log.warn(`Workspace validation failed for ${dirPath}:`, error);
      return false;
    }
  }

  // Initialize a fresh workspace directory
  private async initializeWorkspace(workspaceDir: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }

      // Create fresh moltbot.json with minimal config
      const freshConfig: MoltbotConfig = {
        models: {
          providers: {},
        },
        agents: {
          defaults: {},
        },
        channels: {},
        gateway: {
          port: 18789,
          mode: 'local',
          bind: 'loopback', // Schema-compliant value
          auth: {
            mode: 'token',
            token: '',
          },
        },
      };

      const configPath = path.join(workspaceDir, 'moltbot.json');
      fs.writeFileSync(configPath, JSON.stringify(freshConfig, null, 2), 'utf-8');

      log.info(`Fresh workspace initialized at: ${workspaceDir}`);
    } catch (error: any) {
      log.error('Failed to initialize workspace:', error);
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  // Skills config
  async getSkills(): Promise<Record<string, any>> {
    const config = await this.loadConfig();
    return config?.skills?.entries || {};
  }

  async updateSkills(skillsConfig: Record<string, any>): Promise<void> {
    const config = await this.loadConfig();
    if (!config.skills) config.skills = {};
    config.skills.entries = skillsConfig;
    await this.saveConfig(config);
    log.info('Skills config updated');
  }

  /**
   * Get the model catalog - fetches from gateway if running, otherwise uses known models
   */
  async getModelCatalog(): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    contextWindow?: number;
    reasoning?: boolean;
  }>> {
    // Try to fetch from gateway first
    const gatewayUrl = 'http://127.0.0.1:8765';
    try {
      const response = await fetch(`${gatewayUrl}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'models.list',
          params: {},
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const result = await response.json() as { result?: { models?: any[] } };
        if (result?.result?.models) {
          log.info(`Model catalog fetched from gateway: ${result.result.models.length} models`);
          return result.result.models;
        }
      }
    } catch (err) {
      log.warn('Failed to fetch model catalog from gateway:', err);
    }

    // Fallback: return known models from config providers + well-known defaults
    const config = await this.loadConfig();
    const models: Array<{
      id: string;
      name: string;
      provider: string;
      contextWindow?: number;
      reasoning?: boolean;
    }> = [];

    // Add models from configured providers
    const providers = config?.models?.providers || {};
    for (const [providerName, provider] of Object.entries(providers)) {
      for (const model of provider.models || []) {
        models.push({
          id: model.id,
          name: model.name || model.id,
          provider: providerName,
          contextWindow: model.contextWindow,
        });
      }
    }

    // Add well-known Anthropic models
    const knownAnthropicModels = [
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextWindow: 200000 },
      { id: 'claude-sonnet-4-5-20251101', name: 'Claude Sonnet 4.5', contextWindow: 200000 },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', contextWindow: 200000, reasoning: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000 },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000 },
    ];

    // Only add if not already present
    const hasAnthropic = models.some(m => m.provider === 'anthropic');
    if (!hasAnthropic) {
      for (const model of knownAnthropicModels) {
        models.push({ ...model, provider: 'anthropic' });
      }
    }

    // Add well-known Google models
    const knownGoogleModels = [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', contextWindow: 1000000 },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', contextWindow: 1000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000 },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', contextWindow: 1000000, reasoning: true },
    ];

    const hasGoogle = models.some(m => m.provider === 'google');
    if (!hasGoogle) {
      for (const model of knownGoogleModels) {
        models.push({ ...model, provider: 'google' });
      }
    }

    // Add well-known OpenAI models
    const knownOpenAIModels = [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
      { id: 'o1', name: 'o1', contextWindow: 200000, reasoning: true },
      { id: 'o1-mini', name: 'o1 Mini', contextWindow: 128000, reasoning: true },
      { id: 'o3-mini', name: 'o3 Mini', contextWindow: 200000, reasoning: true },
    ];

    const hasOpenAI = models.some(m => m.provider === 'openai');
    if (!hasOpenAI) {
      for (const model of knownOpenAIModels) {
        models.push({ ...model, provider: 'openai' });
      }
    }

    log.info(`Model catalog from fallback: ${models.length} models`);
    return models;
  }

}
