import React, { useState, useEffect } from 'react';

interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
}

interface ProviderConfig {
  baseUrl: string;
  api: 'anthropic-messages' | 'openai-completions' | 'google-genai';
  apiKey?: string;
  models: ModelConfig[];
}

interface ProviderWizardProps {
  editingProvider: string | null;
  existingConfig?: ProviderConfig;
  onComplete: (name: string, config: ProviderConfig) => void;
  onCancel: () => void;
}

interface ProviderType {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  api: 'anthropic-messages' | 'openai-completions' | 'google-genai';
  defaultModels: ModelConfig[];
  requiresApiKey: boolean;
  supportsOAuth?: boolean;
  oauthProvider?: string;
}

const PROVIDER_TYPES: ProviderType[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🤖',
    baseUrl: 'https://api.anthropic.com',
    api: 'anthropic-messages',
    requiresApiKey: true,
    supportsOAuth: true,
    oauthProvider: 'anthropic',
    defaultModels: [
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-sonnet-4-5-20251101', name: 'Claude Sonnet 4.5', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, maxTokens: 8192 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
    requiresApiKey: true,
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxTokens: 16384 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, maxTokens: 16384 },
      { id: 'o1', name: 'o1', contextWindow: 200000, maxTokens: 100000 },
      { id: 'o1-mini', name: 'o1 Mini', contextWindow: 128000, maxTokens: 65536 },
      { id: 'o3-mini', name: 'o3 Mini', contextWindow: 200000, maxTokens: 100000 },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: '🔮',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    api: 'google-genai',
    requiresApiKey: true,
    supportsOAuth: true,
    oauthProvider: 'google',
    defaultModels: [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', contextWindow: 1000000, maxTokens: 8192 },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', contextWindow: 1000000, maxTokens: 8192 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxTokens: 8192 },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', contextWindow: 1000000, maxTokens: 8192 },
    ],
  },
  {
    id: 'antigravity',
    name: 'Antigravity Proxy',
    icon: '🚀',
    baseUrl: 'https://antigravity.vollx.com',
    api: 'anthropic-messages',
    requiresApiKey: true,
    defaultModels: [
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5 Thinking', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-opus', name: 'Claude 3 Opus', contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', contextWindow: 200000, maxTokens: 8192 },
      { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro High', contextWindow: 200000, maxTokens: 8192 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 200000, maxTokens: 8192 },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    baseUrl: 'https://openrouter.ai/api/v1',
    api: 'openai-completions',
    requiresApiKey: true,
    defaultModels: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxTokens: 8192 },
      { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxTokens: 16384 },
      { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxTokens: 8192 },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, maxTokens: 8192 },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '💻',
    baseUrl: 'http://localhost:11434/v1',
    api: 'openai-completions',
    requiresApiKey: false,
    defaultModels: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, maxTokens: 4096 },
      { id: 'codellama', name: 'CodeLlama', contextWindow: 16384, maxTokens: 4096 },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 128000, maxTokens: 8192 },
      { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000, maxTokens: 8192 },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    icon: '⚙️',
    baseUrl: '',
    api: 'openai-completions',
    requiresApiKey: true,
    defaultModels: [],
  },
];

function ProviderWizard({
  editingProvider,
  existingConfig,
  onComplete,
  onCancel,
}: ProviderWizardProps) {
  const [step, setStep] = useState(1);
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [providerName, setProviderName] = useState(editingProvider || '');

  // Step 2 state
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authMode, setAuthMode] = useState<'api_key' | 'oauth'>('api_key');
  const [oauthStatus, setOauthStatus] = useState<'none' | 'pending' | 'success' | 'error'>('none');

  // Step 3 state
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([]);
  const [customModel, setCustomModel] = useState({ id: '', name: '' });

  // Initialize from existing config
  useEffect(() => {
    if (existingConfig && editingProvider) {
      // Try to match provider type
      const matchedType = PROVIDER_TYPES.find(
        (pt) => pt.baseUrl === existingConfig.baseUrl || pt.api === existingConfig.api
      );
      if (matchedType) {
        setProviderType(matchedType);
      }

      setBaseUrl(existingConfig.baseUrl);
      setApiKey(existingConfig.apiKey || '');
      setSelectedModels(existingConfig.models || []);
      setStep(2); // Start at step 2 for editing
    }
  }, [existingConfig, editingProvider]);

  // Step 1: Select Provider Type
  const handleSelectType = (type: ProviderType) => {
    setProviderType(type);
    setProviderName(editingProvider || type.id);
    setBaseUrl(type.baseUrl);
    setSelectedModels(type.defaultModels);
    setStep(2);
  };

  // OAuth login handler
  const handleOAuthLogin = async () => {
    if (!providerType?.oauthProvider) return;

    setOauthStatus('pending');
    try {
      const provider = providerType.oauthProvider;
      const result = await window.electronAPI.app.runAuthLogin(provider);

      if (result.success) {
        setOauthStatus('success');
      } else {
        console.error('OAuth login failed:', result.error);
        setOauthStatus('error');
      }
    } catch (err) {
      console.error('OAuth login failed:', err);
      setOauthStatus('error');
    }
  };

  // Step 2: Credentials
  const handleCredentialsNext = () => {
    if (!baseUrl) {
      alert('Please enter a base URL');
      return;
    }
    // OAuth mode doesn't require API key
    if (authMode === 'api_key' && providerType?.requiresApiKey && !apiKey) {
      alert('Please enter an API key');
      return;
    }
    setStep(3);
  };

  // Step 3: Models
  const handleToggleModel = (model: ModelConfig) => {
    const exists = selectedModels.find((m) => m.id === model.id);
    if (exists) {
      setSelectedModels(selectedModels.filter((m) => m.id !== model.id));
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const handleAddCustomModel = () => {
    if (!customModel.id) {
      alert('Please enter a model ID');
      return;
    }
    const newModel: ModelConfig = {
      id: customModel.id,
      name: customModel.name || customModel.id,
      contextWindow: 128000,
      maxTokens: 8192,
    };
    setSelectedModels([...selectedModels, newModel]);
    setCustomModel({ id: '', name: '' });
  };

  const handleModelsNext = () => {
    if (selectedModels.length === 0) {
      alert('Please select at least one model');
      return;
    }
    setStep(4);
  };

  // Step 4: Review & Complete
  const handleComplete = () => {
    const config: ProviderConfig = {
      baseUrl,
      api: providerType?.api || 'openai-completions',
      apiKey,
      models: selectedModels,
    };

    onComplete(providerName, config);
  };

  const renderStepIndicator = () => (
    <div className="wizard-steps">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`step ${s === step ? 'active' : ''} ${s < step ? 'completed' : ''}`}>
          {s < step ? '✓' : s}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="wizard-content">
      <h3>Step 1: Select Provider Type</h3>
      <div className="provider-type-list">
        {PROVIDER_TYPES.map((type) => (
          <button
            key={type.id}
            className={`provider-type-btn ${providerType?.id === type.id ? 'selected' : ''}`}
            onClick={() => handleSelectType(type)}
          >
            <span className="icon">{type.icon}</span>
            <span className="name">{type.name}</span>
            <span className="url">{type.baseUrl || 'Custom URL'}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-content">
      <h3>Step 2: Credentials</h3>

      <div className="form-group">
        <label>Provider Name</label>
        <input
          type="text"
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="e.g., my-provider"
        />
      </div>

      <div className="form-group">
        <label>Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
        />
      </div>

      {providerType?.requiresApiKey && (
        <>
          {/* Auth mode selector for OAuth-capable providers */}
          {providerType.supportsOAuth && (
            <div className="form-group">
              <label>Authentication Method</label>
              <div className="auth-mode-selector">
                <button
                  className={`auth-mode-btn ${authMode === 'api_key' ? 'active' : ''}`}
                  onClick={() => setAuthMode('api_key')}
                >
                  🔑 API Key
                </button>
                <button
                  className={`auth-mode-btn ${authMode === 'oauth' ? 'active' : ''}`}
                  onClick={() => setAuthMode('oauth')}
                >
                  🔐 OAuth Login
                </button>
              </div>
            </div>
          )}

          {authMode === 'api_key' ? (
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="hint">API key will be saved directly in the config file</p>
            </div>
          ) : (
            <div className="form-group oauth-section">
              <label>OAuth Authentication</label>
              <div className="oauth-actions">
                <button
                  className={`btn btn-oauth ${oauthStatus === 'pending' ? 'loading' : ''}`}
                  onClick={handleOAuthLogin}
                  disabled={oauthStatus === 'pending'}
                >
                  {oauthStatus === 'pending' ? '⏳ Authenticating...' : `🔐 Login with ${providerType.name}`}
                </button>
              </div>
              {oauthStatus === 'success' && (
                <p className="hint success">✓ OAuth authentication successful</p>
              )}
              {oauthStatus === 'error' && (
                <p className="hint error">✗ OAuth authentication failed. Please try again.</p>
              )}
              <p className="hint">
                OAuth tokens are stored securely in the auth-profiles and refreshed automatically.
              </p>
            </div>
          )}
        </>
      )}

      <div className="wizard-actions">
        <button className="btn btn-secondary" onClick={() => setStep(1)}>
          Back
        </button>
        <button className="btn btn-primary" onClick={handleCredentialsNext}>
          Next
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-content">
      <h3>Step 3: Select Models</h3>

      <div className="model-selection">
        {providerType?.defaultModels.map((model) => (
          <label key={model.id} className="model-checkbox">
            <input
              type="checkbox"
              checked={selectedModels.some((m) => m.id === model.id)}
              onChange={() => handleToggleModel(model)}
            />
            <span className="model-name">{model.name}</span>
            <span className="model-id">({model.id})</span>
          </label>
        ))}
      </div>

      <div className="add-custom-model">
        <h4>Add Custom Model</h4>
        <div className="custom-model-form">
          <input
            type="text"
            value={customModel.id}
            onChange={(e) => setCustomModel({ ...customModel, id: e.target.value })}
            placeholder="Model ID"
          />
          <input
            type="text"
            value={customModel.name}
            onChange={(e) => setCustomModel({ ...customModel, name: e.target.value })}
            placeholder="Display Name (optional)"
          />
          <button className="btn btn-secondary btn-small" onClick={handleAddCustomModel}>
            Add
          </button>
        </div>
      </div>

      {selectedModels.length > 0 && (
        <div className="selected-models">
          <h4>Selected Models ({selectedModels.length})</h4>
          <ul>
            {selectedModels.map((model) => (
              <li key={model.id}>
                {model.name} ({model.id})
                <button
                  className="btn-remove"
                  onClick={() => setSelectedModels(selectedModels.filter((m) => m.id !== model.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="wizard-actions">
        <button className="btn btn-secondary" onClick={() => setStep(2)}>
          Back
        </button>
        <button className="btn btn-primary" onClick={handleModelsNext}>
          Next
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-content">
      <h3>Step 4: Review & Confirm</h3>

      <div className="review-section">
        <div className="review-item">
          <span className="label">Provider Name:</span>
          <span className="value">{providerName}</span>
        </div>
        <div className="review-item">
          <span className="label">Base URL:</span>
          <span className="value">{baseUrl}</span>
        </div>
        <div className="review-item">
          <span className="label">API Format:</span>
          <span className="value">{providerType?.api}</span>
        </div>
        <div className="review-item">
          <span className="label">API Key:</span>
          <span className="value">{apiKey ? '••••••••' : 'Not required'}</span>
        </div>
        <div className="review-item">
          <span className="label">Models:</span>
          <span className="value">{selectedModels.map((m) => m.name).join(', ')}</span>
        </div>
      </div>

      <div className="json-preview">
        <h4>Config Preview</h4>
        <pre>
          {JSON.stringify(
            {
              [providerName]: {
                baseUrl,
                api: providerType?.api,
                apiKey: apiKey ? '***' : undefined,
                models: selectedModels,
              },
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="wizard-actions">
        <button className="btn btn-secondary" onClick={() => setStep(3)}>
          Back
        </button>
        <button className="btn btn-primary" onClick={handleComplete}>
          {editingProvider ? 'Update Provider' : 'Add Provider'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>{editingProvider ? 'Edit Provider' : 'Add Provider'}</h2>
          <button className="btn-close" onClick={onCancel}>
            ×
          </button>
        </div>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}

export default ProviderWizard;
