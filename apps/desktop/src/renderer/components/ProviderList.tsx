import React from 'react';

interface ProviderConfig {
  baseUrl: string;
  api: string;
  apiKey?: string;
  apiKeySource?: 'env' | 'direct';
  models: {
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
  }[];
}

interface ProviderListProps {
  providers: Record<string, ProviderConfig>;
  currentModel: { provider?: string; model?: string };
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
  onSetActive: (providerName: string, modelId: string) => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '🤖',
  openai: '🧠',
  'antigravity-proxy': '🚀',
  antigravity: '🚀',
  google: '🔮',
  ollama: '💻',
  default: '⚙️',
};

function ProviderList({
  providers,
  currentModel,
  onEdit,
  onDelete,
  onSetActive,
}: ProviderListProps) {
  const providerNames = Object.keys(providers);

  if (providerNames.length === 0) {
    return (
      <div className="provider-list empty">
        <div className="empty-state">
          <p>No providers configured</p>
          <p className="hint">Click "+ Add Provider" to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-list">
      {providerNames.map((name) => {
        const provider = providers[name];
        const isActive = currentModel.provider === name;
        const icon = PROVIDER_ICONS[name] || PROVIDER_ICONS.default;

        return (
          <div key={name} className={`provider-card ${isActive ? 'active' : ''}`}>
            <div className="provider-header">
              <span className="provider-icon">{icon}</span>
              <span className="provider-name">{name}</span>
              {isActive && <span className="active-badge">Active</span>}
            </div>

            <div className="provider-details">
              <div className="detail-row">
                <span className="label">URL:</span>
                <span className="value">{provider.baseUrl}</span>
              </div>
              <div className="detail-row">
                <span className="label">API:</span>
                <span className="value">{provider.api}</span>
              </div>
              <div className="detail-row">
                <span className="label">API Key:</span>
                <span className="value">
                  {provider.apiKeySource === 'env'
                    ? `${provider.apiKey} (env)`
                    : provider.apiKey
                    ? '••••••••'
                    : 'Not set'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Models:</span>
                <span className="value">
                  {provider.models?.map((m) => m.id).join(', ') || 'None'}
                </span>
              </div>
            </div>

            {provider.models?.length > 0 && (
              <div className="provider-models">
                <span className="models-label">
                  {isActive ? 'Active model:' : 'Select model:'}
                </span>
                <select
                  className="model-select"
                  value={isActive ? currentModel.model || '' : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      onSetActive(name, e.target.value);
                    }
                  }}
                >
                  {!isActive && <option value="">-- Select model --</option>}
                  {provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="provider-actions">
              <button className="btn btn-secondary btn-small" onClick={() => onEdit(name)}>
                Edit
              </button>
              <button
                className="btn btn-danger btn-small"
                onClick={() => onDelete(name)}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProviderList;
