import React, { useState, useEffect } from 'react';
import ProviderList from '../components/ProviderList';
import ProviderWizard from '../components/ProviderWizard';
import SkillEditor from '../components/SkillEditor';
import Channels from './Channels';

interface SettingsProps {
  onConfigChange?: () => void;
  onReinitSetup?: () => void;
}

interface SkillConfig {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
}

interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

interface ProviderConfig {
  baseUrl: string;
  api: 'anthropic-messages' | 'openai-completions' | 'google-genai';
  apiKey?: string;
  apiKeySource?: 'env' | 'direct';
  models: ModelConfig[];
}

interface AuthProfile {
  provider: string;
  mode: 'oauth' | 'api_key';
}

interface AgentsDefaults {
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

type SettingsTab = 'providers' | 'auth' | 'agents' | 'skills' | 'channels' | 'gateway' | 'advanced' | 'general';

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'auth', label: 'Auth Profiles' },
  { id: 'agents', label: 'Agent Defaults' },
  { id: 'skills', label: 'Skills' },
  { id: 'channels', label: 'Channels' },
  { id: 'gateway', label: 'Gateway' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'general', label: 'Config' },
];

const AUTH_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', icon: '🧠' },
  { id: 'google', name: 'Google', icon: '🔮' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🌐' },
  { id: 'custom', name: 'Custom', icon: '⚙️' },
];

function Settings({ onConfigChange, onReinitSetup }: SettingsProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('providers');
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [authProfiles, setAuthProfiles] = useState<Record<string, AuthProfile>>({});
  const [agentsDefaults, setAgentsDefaults] = useState<AgentsDefaults | undefined>();
  const [currentModel, setCurrentModel] = useState<{ provider?: string; model?: string }>({});
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string>('');

  // Config viewer state
  const [rawConfig, setRawConfig] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editedConfig, setEditedConfig] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');

  // Agent defaults editing state
  const [editingAgents, setEditingAgents] = useState(false);
  const [editedPrimary, setEditedPrimary] = useState<string>('');
  const [editedFallbacks, setEditedFallbacks] = useState<string[]>([]);
  const [editedMaxConcurrent, setEditedMaxConcurrent] = useState<number>(4);
  const [editedSubagentMax, setEditedSubagentMax] = useState<number>(8);
  const [editedAliases, setEditedAliases] = useState<Record<string, string>>({});
  const [newAliasModel, setNewAliasModel] = useState<string>('');
  const [newAliasName, setNewAliasName] = useState<string>('');

  // Model catalog from gateway/fallback
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>([]);

  // Skills state
  const [skills, setSkills] = useState<Record<string, SkillConfig>>({});
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Gateway state for Gateway tab
  const [gatewayConfig, setGatewayConfig] = useState<{
    port: number;
    mode: string;
    bind: string;
    auth: { mode: string; token?: string; password?: string };
  } | null>(null);
  const [editingGateway, setEditingGateway] = useState(false);
  const [editedGateway, setEditedGateway] = useState<{
    port: number;
    bind: string;
    authMode: string;
    token: string;
    password: string;
  }>({ port: 18789, bind: 'loopback', authMode: 'token', token: '', password: '' });

  // Auth profiles store state (credentials from auth-profiles.json)
  const [authProfilesStore, setAuthProfilesStore] = useState<{
    profiles: Record<string, { type: string; provider: string; token?: string }>;
    usageStats: Record<string, { lastUsed?: number; errorCount?: number; cooldownUntil?: number; lastError?: string }>;
  }>({ profiles: {}, usageStats: {} });
  const [editingAuthProfile, setEditingAuthProfile] = useState<string | null>(null);
  const [editedAuthToken, setEditedAuthToken] = useState('');
  const [showAuthToken, setShowAuthToken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summary, path, raw, skillsData, gatewayData, authStoreData] = await Promise.all([
        window.electronAPI.config.getModelSummary(),
        window.electronAPI.config.getPath(),
        window.electronAPI.config.getRawConfig(),
        window.electronAPI.config.getSkills(),
        window.electronAPI.config.getGateway().catch(() => null),
        window.electronAPI.config.getAuthProfilesStore().catch(() => ({ profiles: {}, usageStats: {} })),
      ]);
      setProviders(summary.providers || {});
      setAuthProfiles(summary.authProfiles || {});
      setAgentsDefaults(summary.agentsDefaults);
      setCurrentModel(summary.currentModel || {});
      setConfigPath(path || '');
      setRawConfig(raw || '{}');
      setEditedConfig(raw || '{}');
      setSkills(skillsData || {});

      // Load model catalog
      loadModelCatalog();

      // Load gateway config
      if (gatewayData) {
        setGatewayConfig({
          port: gatewayData.port || 18789,
          mode: gatewayData.mode || 'local',
          bind: gatewayData.bind || 'loopback',
          auth: gatewayData.auth || { mode: 'token' },
        });
      }

      // Load auth profiles store (credentials)
      if (authStoreData) {
        setAuthProfilesStore({
          profiles: authStoreData.profiles || {},
          usageStats: authStoreData.usageStats || {},
        });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModelCatalog = async () => {
    try {
      setCatalogLoading(true);
      const catalog = await window.electronAPI.config.getModelCatalog();
      setModelCatalog(catalog || []);
    } catch (err) {
      console.error('Failed to load model catalog:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Provider handlers
  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowWizard(true);
  };

  const handleEditProvider = (name: string) => {
    setEditingProvider(name);
    setShowWizard(true);
  };

  const handleDeleteProvider = async (name: string) => {
    if (!confirm(`Delete provider "${name}"?`)) return;
    try {
      await window.electronAPI.config.deleteProvider(name);
      await loadData();
    } catch (err) {
      console.error('Failed to delete provider:', err);
      alert('Failed to delete provider');
    }
  };

  const handleSetActive = async (providerName: string, modelId: string) => {
    try {
      await window.electronAPI.config.setCurrentModel(providerName, modelId);
      await loadData();
    } catch (err) {
      console.error('Failed to set active model:', err);
      alert('Failed to set active model');
    }
  };

  const handleWizardComplete = async (name: string, config: ProviderConfig) => {
    try {
      if (editingProvider) {
        await window.electronAPI.config.updateProvider(name, config);
      } else {
        await window.electronAPI.config.addProvider(name, config);
      }
      await loadData();
      setShowWizard(false);
      setEditingProvider(null);
    } catch (err) {
      console.error('Failed to save provider:', err);
      alert('Failed to save provider');
    }
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingProvider(null);
  };

  // Get all available models - combines catalog + provider models
  const getAllModels = (): string[] => {
    const modelSet = new Set<string>();

    // First add from model catalog (most comprehensive)
    modelCatalog.forEach((entry) => {
      modelSet.add(`${entry.provider}/${entry.id}`);
    });

    // Also add from configured providers (in case catalog is empty)
    Object.entries(providers).forEach(([providerName, provider]) => {
      provider.models?.forEach((model) => {
        modelSet.add(`${providerName}/${model.id}`);
      });
    });

    // Sort alphabetically
    return Array.from(modelSet).sort();
  };

  // Start editing agent defaults
  const startEditingAgents = () => {
    if (agentsDefaults) {
      setEditedPrimary(agentsDefaults.model?.primary || '');
      setEditedFallbacks(agentsDefaults.model?.fallbacks || []);
      setEditedMaxConcurrent(agentsDefaults.maxConcurrent || 4);
      setEditedSubagentMax(agentsDefaults.subagents?.maxConcurrent || 8);
      const aliases: Record<string, string> = {};
      if (agentsDefaults.models) {
        Object.entries(agentsDefaults.models).forEach(([model, config]) => {
          if (config.alias) {
            aliases[model] = config.alias;
          }
        });
      }
      setEditedAliases(aliases);
    }
    setEditingAgents(true);
  };

  // Cancel editing
  const cancelEditingAgents = () => {
    setEditingAgents(false);
  };

  // Save agent defaults
  const saveAgentDefaults = async () => {
    try {
      const newDefaults: AgentsDefaults = {
        model: {
          primary: editedPrimary,
          fallbacks: editedFallbacks,
        },
        maxConcurrent: editedMaxConcurrent,
        subagents: {
          maxConcurrent: editedSubagentMax,
        },
        models: {},
      };
      // Add aliases
      Object.entries(editedAliases).forEach(([model, alias]) => {
        if (alias) {
          newDefaults.models![model] = { alias };
        }
      });
      await window.electronAPI.config.updateAgentsDefaults(newDefaults);
      await loadData();
      setEditingAgents(false);
    } catch (err) {
      console.error('Failed to save agent defaults:', err);
      alert('Failed to save agent defaults');
    }
  };

  // Fallback management
  const addFallback = (model: string) => {
    if (model && !editedFallbacks.includes(model)) {
      setEditedFallbacks([...editedFallbacks, model]);
    }
  };

  const removeFallback = (index: number) => {
    setEditedFallbacks(editedFallbacks.filter((_, i) => i !== index));
  };

  const moveFallback = (index: number, direction: 'up' | 'down') => {
    const newFallbacks = [...editedFallbacks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newFallbacks.length) {
      [newFallbacks[index], newFallbacks[newIndex]] = [newFallbacks[newIndex], newFallbacks[index]];
      setEditedFallbacks(newFallbacks);
    }
  };

  // Alias management
  const addAlias = () => {
    if (newAliasModel && newAliasName) {
      setEditedAliases({ ...editedAliases, [newAliasModel]: newAliasName });
      setNewAliasModel('');
      setNewAliasName('');
    }
  };

  const removeAlias = (model: string) => {
    const newAliases = { ...editedAliases };
    delete newAliases[model];
    setEditedAliases(newAliases);
  };

  if (loading) {
    return (
      <div className="settings loading">
        <div className="spinner"></div>
        <p>Loading configuration...</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeSettingsTab) {
      case 'providers':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Model Providers</h2>
              <button className="btn btn-primary" onClick={handleAddProvider}>
                + Add Provider
              </button>
            </div>
            <p className="section-description">
              Configure AI model providers and their API endpoints.
            </p>
            <ProviderList
              providers={providers}
              currentModel={currentModel}
              onEdit={handleEditProvider}
              onDelete={handleDeleteProvider}
              onSetActive={handleSetActive}
            />
          </div>
        );

      case 'auth':
        const formatDate = (timestamp: number) => {
          return new Date(timestamp).toLocaleString();
        };
        const isInCooldown = (profileId: string) => {
          const stats = authProfilesStore.usageStats[profileId];
          return stats?.cooldownUntil && stats.cooldownUntil > Date.now();
        };

        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Authentication Profiles</h2>
            </div>
            <div className="section-description">
              <p>Auth profiles store credentials for accessing AI providers. Credentials are stored separately in <code>auth-profiles.json</code>.</p>
              <ul className="auth-explainer">
                <li><strong>OAuth:</strong> Browser-based login (Anthropic Console, Google Cloud)</li>
                <li><strong>API Key:</strong> Direct API key/token authentication</li>
              </ul>
            </div>

            {/* Credentials from auth-profiles.json */}
            {Object.keys(authProfilesStore.profiles).length > 0 && (
              <>
                <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Stored Credentials</h3>
                <div className="auth-profiles-list">
                  {Object.entries(authProfilesStore.profiles).map(([profileId, credential]) => {
                    const PROFILE_ICONS: Record<string, string> = {
                      anthropic: '🤖',
                      openai: '🧠',
                      google: '🔮',
                      openrouter: '🌐',
                      antigravity: '🚀',
                      default: '🔑',
                    };
                    const icon = PROFILE_ICONS[credential.provider] || PROFILE_ICONS.default;
                    const stats = authProfilesStore.usageStats[profileId];
                    const inCooldown = isInCooldown(profileId);

                    return (
                      <div key={profileId} className={`auth-profile-card ${inCooldown ? 'cooldown' : ''}`}>
                        <div className="profile-header">
                          <span className="profile-icon">{icon}</span>
                          <span className="profile-name">{profileId}</span>
                          <span className={`auth-mode-badge ${credential.type}`}>
                            {credential.type === 'oauth' ? 'OAuth' : 'Token'}
                          </span>
                          {inCooldown && <span className="cooldown-badge">⏸ Cooldown</span>}
                        </div>
                        <div className="profile-details">
                          <div className="detail-row">
                            <span className="label">Provider:</span>
                            <span className="value">{credential.provider}</span>
                          </div>
                          {credential.token && (
                            <div className="detail-row">
                              <span className="label">Token:</span>
                              {editingAuthProfile === profileId ? (
                                <input
                                  type="text"
                                  className="text-input"
                                  value={editedAuthToken}
                                  onChange={(e) => setEditedAuthToken(e.target.value)}
                                  placeholder="Enter new token"
                                  style={{ flex: 1 }}
                                />
                              ) : (
                                <span className="value">
                                  {showAuthToken[profileId]
                                    ? credential.token
                                    : `${credential.token.substring(0, 12)}...${credential.token.slice(-4)}`}
                                </span>
                              )}
                              {editingAuthProfile !== profileId && (
                                <button
                                  className="btn btn-icon"
                                  onClick={() => setShowAuthToken({ ...showAuthToken, [profileId]: !showAuthToken[profileId] })}
                                  title={showAuthToken[profileId] ? 'Hide token' : 'Show token'}
                                >
                                  {showAuthToken[profileId] ? '🙈' : '👁'}
                                </button>
                              )}
                            </div>
                          )}
                          {stats?.lastUsed && (
                            <div className="detail-row">
                              <span className="label">Last Used:</span>
                              <span className="value hint">{formatDate(stats.lastUsed)}</span>
                            </div>
                          )}
                          {stats?.errorCount != null && stats.errorCount > 0 && (
                            <div className="detail-row">
                              <span className="label">Errors:</span>
                              <span className="value error">{stats.errorCount} errors</span>
                            </div>
                          )}
                          {inCooldown && stats?.cooldownUntil && (
                            <div className="detail-row cooldown-info">
                              <span className="label">Cooldown Until:</span>
                              <span className="value warning">{formatDate(stats.cooldownUntil)}</span>
                            </div>
                          )}
                          {stats?.lastError && (
                            <div className="detail-row">
                              <span className="label">Last Error:</span>
                              <span className="value error hint">{stats.lastError}</span>
                            </div>
                          )}
                        </div>
                        <div className="profile-actions">
                          {editingAuthProfile === profileId ? (
                            <>
                              <button
                                className="btn btn-secondary btn-small"
                                onClick={() => {
                                  setEditingAuthProfile(null);
                                  setEditedAuthToken('');
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="btn btn-primary btn-small"
                                onClick={async () => {
                                  try {
                                    await window.electronAPI.config.updateAuthProfileCredential(profileId, {
                                      ...credential,
                                      token: editedAuthToken,
                                    });
                                    await loadData();
                                    setEditingAuthProfile(null);
                                    setEditedAuthToken('');
                                  } catch (err) {
                                    console.error('Failed to update token:', err);
                                    alert('Failed to update token');
                                  }
                                }}
                              >
                                Save
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-secondary btn-small"
                                onClick={() => {
                                  setEditingAuthProfile(profileId);
                                  setEditedAuthToken(credential.token || '');
                                }}
                              >
                                Edit Token
                              </button>
                              {inCooldown && (
                                <button
                                  className="btn btn-warning btn-small"
                                  onClick={async () => {
                                    try {
                                      await window.electronAPI.config.clearAuthProfileCooldown(profileId);
                                      await loadData();
                                    } catch (err) {
                                      console.error('Failed to clear cooldown:', err);
                                      alert('Failed to clear cooldown');
                                    }
                                  }}
                                >
                                  Clear Cooldown
                                </button>
                              )}
                              <button
                                className="btn btn-danger btn-small"
                                onClick={async () => {
                                  if (!confirm(`Delete credential "${profileId}"?`)) return;
                                  try {
                                    await window.electronAPI.config.deleteAuthProfileCredential(profileId);
                                    await loadData();
                                  } catch (err) {
                                    console.error('Failed to delete credential:', err);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Auth profiles from openclaw.json (metadata) */}
            {Object.keys(authProfiles).length > 0 && (
              <>
                <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Profile Metadata</h3>
                <p className="hint" style={{ marginBottom: '12px' }}>These are profile references in the main config file.</p>
                <div className="auth-profiles-list">
                  {Object.entries(authProfiles).map(([name, profile]) => {
                    const PROFILE_ICONS: Record<string, string> = {
                      anthropic: '🤖',
                      openai: '🧠',
                      google: '🔮',
                      openrouter: '🌐',
                      antigravity: '🚀',
                      default: '🔑',
                    };
                    const icon = PROFILE_ICONS[profile.provider] || PROFILE_ICONS.default;

                    return (
                      <div key={name} className="auth-profile-card compact">
                        <div className="profile-header">
                          <span className="profile-icon">{icon}</span>
                          <span className="profile-name">{name}</span>
                          <span className={`auth-mode-badge ${profile.mode}`}>
                            {profile.mode === 'oauth' ? 'OAuth' : 'API Key'}
                          </span>
                        </div>
                        <div className="profile-details">
                          <div className="detail-row">
                            <span className="label">Provider:</span>
                            <span className="value">{profile.provider}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {Object.keys(authProfilesStore.profiles).length === 0 && Object.keys(authProfiles).length === 0 && (
              <div className="empty-state">
                <p>No auth profiles configured</p>
                <p className="hint">Auth profiles are created via CLI: <code>openclaw auth login</code></p>
              </div>
            )}
          </div>
        );

      case 'agents':
        const availableModels = getAllModels();
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Agent Defaults</h2>
              {!editingAgents ? (
                <button className="btn btn-primary" onClick={startEditingAgents}>
                  Edit
                </button>
              ) : (
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={cancelEditingAgents}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={saveAgentDefaults}>
                    Save
                  </button>
                </div>
              )}
            </div>
            <p className="section-description">
              Default model configuration for agent execution.
            </p>

            {editingAgents ? (
              // Edit Mode
              <div className="agents-defaults editing">
                {/* Primary Model */}
                <div className="config-card">
                  <h3>Primary Model</h3>
                  <select
                    className="model-select"
                    value={editedPrimary}
                    onChange={(e) => setEditedPrimary(e.target.value)}
                  >
                    <option value="">-- Select primary model --</option>
                    {availableModels.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>

                  <h4 style={{ marginTop: '20px' }}>Fallbacks</h4>
                  <div className="fallbacks-list">
                    {editedFallbacks.map((fb, i) => (
                      <div key={i} className="fallback-item">
                        <span className="fallback-order">{i + 1}.</span>
                        <code>{fb}</code>
                        <div className="fallback-actions">
                          <button
                            className="btn btn-icon"
                            onClick={() => moveFallback(i, 'up')}
                            disabled={i === 0}
                            title="Move up"
                          >↑</button>
                          <button
                            className="btn btn-icon"
                            onClick={() => moveFallback(i, 'down')}
                            disabled={i === editedFallbacks.length - 1}
                            title="Move down"
                          >↓</button>
                          <button
                            className="btn btn-icon btn-danger"
                            onClick={() => removeFallback(i)}
                            title="Remove"
                          >×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="add-fallback">
                    <select
                      className="model-select"
                      onChange={(e) => {
                        addFallback(e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="">+ Add fallback model...</option>
                      {availableModels
                        .filter((m) => m !== editedPrimary && !editedFallbacks.includes(m))
                        .map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Model Aliases */}
                <div className="config-card">
                  <h3>Model Aliases</h3>
                  <p className="hint">Aliases allow you to reference models by short names (e.g., "opus" instead of "anthropic/claude-opus-4-5")</p>
                  <div className="aliases-list">
                    {Object.entries(editedAliases).map(([model, alias]) => (
                      <div key={model} className="alias-item">
                        <code>{model}</code>
                        <span className="alias-arrow">→</span>
                        <span className="alias-name">{alias}</span>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => removeAlias(model)}
                          title="Remove alias"
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-alias">
                    <select
                      className="model-select"
                      value={newAliasModel}
                      onChange={(e) => setNewAliasModel(e.target.value)}
                    >
                      <option value="">Select model...</option>
                      {availableModels
                        .filter((m) => !editedAliases[m])
                        .map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      className="alias-input"
                      placeholder="Alias name (e.g., opus)"
                      value={newAliasName}
                      onChange={(e) => setNewAliasName(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={addAlias}
                      disabled={!newAliasModel || !newAliasName}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Execution Settings */}
                <div className="config-card">
                  <h3>Execution Settings</h3>
                  <div className="settings-form">
                    <div className="form-row">
                      <label>Max Concurrent Agents:</label>
                      <input
                        type="number"
                        className="number-input"
                        value={editedMaxConcurrent}
                        onChange={(e) => setEditedMaxConcurrent(parseInt(e.target.value) || 1)}
                        min={1}
                        max={16}
                      />
                    </div>
                    <div className="form-row">
                      <label>Subagents Max Concurrent:</label>
                      <input
                        type="number"
                        className="number-input"
                        value={editedSubagentMax}
                        onChange={(e) => setEditedSubagentMax(parseInt(e.target.value) || 1)}
                        min={1}
                        max={32}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="agents-defaults">
                {!agentsDefaults ? (
                  <div className="empty-state">
                    <p>No agent defaults configured</p>
                    <button className="btn btn-primary" onClick={startEditingAgents}>
                      Configure Defaults
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Primary Model */}
                    {agentsDefaults.model && (
                      <div className="config-card">
                        <h3>Primary Model</h3>
                        <div className="model-primary">
                          <code>{agentsDefaults.model.primary}</code>
                        </div>
                        {agentsDefaults.model.fallbacks && agentsDefaults.model.fallbacks.length > 0 && (
                          <div className="model-fallbacks">
                            <h4>Fallbacks</h4>
                            <ol>
                              {agentsDefaults.model.fallbacks.map((fb, i) => (
                                <li key={i}><code>{fb}</code></li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Model Aliases */}
                    {agentsDefaults.models && Object.keys(agentsDefaults.models).length > 0 && (
                      <div className="config-card">
                        <h3>Model Aliases</h3>
                        <div className="model-aliases">
                          {Object.entries(agentsDefaults.models).map(([model, config]) => (
                            <div key={model} className="alias-row">
                              <code>{model}</code>
                              {config.alias && <span className="alias-badge">alias: {config.alias}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Settings */}
                    <div className="config-card">
                      <h3>Execution Settings</h3>
                      <div className="settings-grid">
                        {agentsDefaults.workspace && (
                          <div className="setting-item">
                            <span className="label">Workspace:</span>
                            <code>{agentsDefaults.workspace}</code>
                          </div>
                        )}
                        <div className="setting-item">
                          <span className="label">Max Concurrent:</span>
                          <span>{agentsDefaults.maxConcurrent || 4}</span>
                        </div>
                        <div className="setting-item">
                          <span className="label">Subagents Max Concurrent:</span>
                          <span>{agentsDefaults.subagents?.maxConcurrent || 8}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'skills':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Skills</h2>
              <button className="btn btn-primary" onClick={() => {
                setEditingSkill(null);
                setShowSkillEditor(true);
              }}>
                + Add Skill
              </button>
            </div>
            <p className="section-description">
              Skills are reusable prompts and tools that extend agent capabilities.
            </p>

            {Object.keys(skills).length === 0 ? (
              <div className="empty-state">
                <p>No skills configured</p>
                <p className="hint">Click "Add Skill" to configure a new skill</p>
              </div>
            ) : (
              <div className="skills-grid">
                {Object.entries(skills).map(([skillId, config]) => (
                  <div key={skillId} className={`skill-card ${config.enabled === false ? 'disabled' : ''}`}>
                    <div className="skill-header">
                      <span className="skill-name">{skillId}</span>
                      <span className={`skill-status ${config.enabled === false ? 'off' : 'on'}`}>
                        {config.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                    </div>
                    <div className="skill-details">
                      {config.apiKey && (
                        <div className="skill-detail">
                          <span className="label">API Key:</span>
                          <span className="value">••••••••</span>
                        </div>
                      )}
                      {config.env && Object.keys(config.env).length > 0 && (
                        <div className="skill-detail">
                          <span className="label">Env vars:</span>
                          <span className="value">{Object.keys(config.env).length} configured</span>
                        </div>
                      )}
                    </div>
                    <div className="skill-actions">
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          setEditingSkill(skillId);
                          setShowSkillEditor(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={async () => {
                          if (!confirm(`Delete skill "${skillId}"?`)) return;
                          const newSkills = { ...skills };
                          delete newSkills[skillId];
                          setSkills(newSkills);
                          try {
                            await window.electronAPI.config.updateSkills(newSkills);
                          } catch (err) {
                            console.error('Failed to delete skill:', err);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Skill Editor Modal */}
            {showSkillEditor && (
              <SkillEditor
                skillId={editingSkill || undefined}
                existingConfig={editingSkill ? skills[editingSkill] : undefined}
                onSave={async (id, config) => {
                  const newSkills = { ...skills, [id]: config };
                  setSkills(newSkills);
                  try {
                    await window.electronAPI.config.updateSkills(newSkills);
                  } catch (err) {
                    console.error('Failed to save skill:', err);
                    alert('Failed to save skill');
                  }
                  setShowSkillEditor(false);
                  setEditingSkill(null);
                }}
                onCancel={() => {
                  setShowSkillEditor(false);
                  setEditingSkill(null);
                }}
              />
            )}
          </div>
        );

      case 'channels':
        return <Channels onConfigSave={onConfigChange} />;

      case 'gateway':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Gateway Configuration</h2>
              {!editingGateway ? (
                <button className="btn btn-primary" onClick={() => {
                  if (gatewayConfig) {
                    setEditedGateway({
                      port: gatewayConfig.port,
                      bind: gatewayConfig.bind,
                      authMode: gatewayConfig.auth?.mode || 'token',
                      token: gatewayConfig.auth?.token || '',
                      password: gatewayConfig.auth?.password || '',
                    });
                  }
                  setEditingGateway(true);
                }}>
                  Edit
                </button>
              ) : (
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={() => setEditingGateway(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      const newConfig: any = {
                        port: editedGateway.port,
                        mode: 'local',
                        bind: editedGateway.bind,
                        auth: { mode: editedGateway.authMode },
                      };
                      if (editedGateway.authMode === 'token') {
                        newConfig.auth.token = editedGateway.token;
                      } else if (editedGateway.authMode === 'password') {
                        newConfig.auth.password = editedGateway.password;
                      }
                      await window.electronAPI.config.updateGateway(newConfig);
                      await loadData();
                      setEditingGateway(false);
                    } catch (err) {
                      console.error('Failed to save gateway config:', err);
                      alert('Failed to save gateway config');
                    }
                  }}>
                    Save
                  </button>
                </div>
              )}
            </div>
            <p className="section-description">
              Configure how the gateway server listens for connections.
            </p>

            {editingGateway ? (
              <div className="config-card">
                <div className="settings-form">
                  <div className="form-row">
                    <label>Port:</label>
                    <input
                      type="number"
                      className="number-input"
                      value={editedGateway.port}
                      onChange={(e) => setEditedGateway({ ...editedGateway, port: parseInt(e.target.value) || 18789 })}
                      min={1024}
                      max={65535}
                    />
                  </div>
                  <div className="form-row">
                    <label>Bind:</label>
                    <select
                      className="model-select"
                      value={editedGateway.bind}
                      onChange={(e) => setEditedGateway({ ...editedGateway, bind: e.target.value })}
                    >
                      <option value="loopback">Loopback (127.0.0.1) - Local only</option>
                      <option value="lan">LAN (0.0.0.0) - All interfaces</option>
                      <option value="tailnet">Tailnet - Tailscale VPN</option>
                    </select>
                  </div>
                  <div className="form-hint">
                    {editedGateway.bind === 'loopback' && '✓ Secure: Only accessible from this machine'}
                    {editedGateway.bind === 'lan' && '⚠ Warning: Accessible from any device on your network'}
                    {editedGateway.bind === 'tailnet' && '✓ Secure: Accessible via encrypted Tailscale VPN'}
                  </div>
                  <div className="form-row">
                    <label>Auth Mode:</label>
                    <select
                      className="model-select"
                      value={editedGateway.authMode}
                      onChange={(e) => setEditedGateway({ ...editedGateway, authMode: e.target.value })}
                    >
                      <option value="token">Token</option>
                      <option value="password">Password</option>
                      <option value="none">None (not recommended)</option>
                    </select>
                  </div>
                  {editedGateway.authMode === 'token' && (
                    <div className="form-row">
                      <label>Token:</label>
                      <div className="input-with-button">
                        <input
                          type="text"
                          className="text-input"
                          value={editedGateway.token}
                          onChange={(e) => setEditedGateway({ ...editedGateway, token: e.target.value })}
                          placeholder="Enter token or generate one"
                        />
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => {
                            const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                              .map(b => b.toString(16).padStart(2, '0'))
                              .join('');
                            setEditedGateway({ ...editedGateway, token });
                          }}
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  )}
                  {editedGateway.authMode === 'password' && (
                    <div className="form-row">
                      <label>Password:</label>
                      <input
                        type="password"
                        className="text-input"
                        value={editedGateway.password}
                        onChange={(e) => setEditedGateway({ ...editedGateway, password: e.target.value })}
                        placeholder="Enter password"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="config-card">
                {gatewayConfig ? (
                  <div className="settings-grid">
                    <div className="setting-item">
                      <span className="label">Port:</span>
                      <code>{gatewayConfig.port}</code>
                    </div>
                    <div className="setting-item">
                      <span className="label">Bind:</span>
                      <code>{gatewayConfig.bind}</code>
                    </div>
                    <div className="setting-item">
                      <span className="label">Auth Mode:</span>
                      <code>{gatewayConfig.auth?.mode || 'none'}</code>
                    </div>
                    {gatewayConfig.auth?.token && (
                      <div className="setting-item">
                        <span className="label">Token:</span>
                        <code>{gatewayConfig.auth.token.substring(0, 8)}...</code>
                        <button
                          className="btn btn-icon"
                          onClick={() => {
                            navigator.clipboard.writeText(gatewayConfig.auth.token!);
                            alert('Token copied to clipboard');
                          }}
                          title="Copy token"
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No gateway configuration found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'advanced':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2>Advanced Settings</h2>
            </div>
            <p className="section-description">
              Developer tools and advanced configuration options.
            </p>

            {/* Gateway Web UI */}
            <div className="config-card">
              <h3>Gateway Web UI</h3>
              <p className="hint">
                Open the gateway web interface to monitor agents, view logs, and debug requests.
              </p>
              {gatewayConfig ? (
                <div className="gateway-info">
                  <div className="gateway-details">
                    <div className="detail-row">
                      <span className="label">URL:</span>
                      <code>http://localhost:{gatewayConfig.port}</code>
                    </div>
                    {gatewayConfig.auth?.token && (
                      <div className="detail-row">
                        <span className="label">Token:</span>
                        <code className="token-masked">
                          {gatewayConfig.auth.token.substring(0, 8)}...
                        </code>
                        <button
                          className="btn btn-icon"
                          onClick={() => {
                            navigator.clipboard.writeText(gatewayConfig.auth.token!);
                            alert('Token copied to clipboard');
                          }}
                          title="Copy token"
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const token = gatewayConfig.auth?.token || '';
                      const url = `http://localhost:${gatewayConfig.port}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                      window.electronAPI.shell?.openExternal?.(url) ||
                        window.open(url, '_blank');
                    }}
                  >
                    🌐 Open Gateway Web
                  </button>
                </div>
              ) : (
                <p className="empty-hint">Gateway configuration not found.</p>
              )}
            </div>

            {/* Debug Options */}
            <div className="config-card">
              <h3>Developer Options</h3>
              <div className="button-group vertical">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    window.electronAPI.shell?.openExternal?.(`file://${configPath.replace(/[^/\\]+$/, '')}`);
                  }}
                >
                  📁 Open Config Folder
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    await loadData();
                    onConfigChange?.();
                    alert('Configuration reloaded');
                  }}
                >
                  🔄 Reload All Config
                </button>
              </div>
            </div>
          </div>
        );

      case 'general':
        return (
          <div className="settings-section config-viewer">
            <div className="section-header">
              <h2>Configuration File</h2>
              <div className="button-group">
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    if (onReinitSetup) {
                      if (confirm('This will reset and re-run the initial setup wizard. Continue?')) {
                        onReinitSetup();
                      }
                    }
                  }}
                  title="Re-run the setup wizard"
                >
                  🔄 Re-init Setting
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    setEditMode(!editMode);
                    if (editMode) {
                      setEditedConfig(rawConfig);
                      setConfigError('');
                    }
                  }}
                >
                  {editMode ? 'Cancel Edit' : 'Edit Config'}
                </button>
                {editMode && (
                  <button
                    className="btn btn-primary btn-small"
                    onClick={async () => {
                      try {
                        // Validate JSON
                        JSON.parse(editedConfig);
                        setConfigError('');
                        // TODO: Save config when IPC is implemented
                        alert('Config saved! (In production, this would save to file)');
                        setEditMode(false);
                        await loadData();
                      } catch (e) {
                        setConfigError('Invalid JSON: ' + (e as Error).message);
                      }
                    }}
                  >
                    Save Config
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => loadData()}
                >
                  Reload
                </button>
              </div>
            </div>
            <p className="section-description">
              <code>{configPath}</code>
            </p>

            {configError && (
              <div className="error-message">{configError}</div>
            )}

            <div className="config-card">
              {editMode ? (
                <textarea
                  className="config-textarea"
                  value={editedConfig}
                  onChange={(e) => setEditedConfig(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <pre className="config-json">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(rawConfig), null, 2);
                    } catch {
                      return rawConfig;
                    }
                  })()}
                </pre>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* Horizontal Tabs */}
      <div className="settings-tabs">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeSettingsTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSettingsTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {renderTabContent()}
      </div>

      {/* Provider Wizard Modal */}
      {showWizard && (
        <ProviderWizard
          editingProvider={editingProvider}
          existingConfig={editingProvider ? providers[editingProvider] : undefined}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
    </div>
  );
}

export default Settings;
