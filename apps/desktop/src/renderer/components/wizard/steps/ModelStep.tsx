import React from 'react';

export interface ModelStepProps {
  value: string;
  onChange: (model: string) => void;
  provider: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
  customModelInput?: boolean;
}

export const ModelStep: React.FC<ModelStepProps> = ({
  value,
  onChange,
  provider,
  customModelInput,
}) => {
  const anthropicModels = [
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 (Most Capable)' },
    { id: 'claude-sonnet-4-5-20251101', name: 'Claude Sonnet 4.5 (Recommended)' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Extended Thinking)' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
  ];

  const googleModels = [
    { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro (Most Capable)' },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking (Experimental)' },
  ];

  const getModels = () => {
    if (provider === 'anthropic') return anthropicModels;
    if (provider === 'google' || provider === 'antigravity') return googleModels;
    return [];
  };

  const models = getModels();

  return (
    <div className="step-card model-step">
      <h2>Default Model</h2>
      <p>Select the AI model that Clawdbot will use by default:</p>

      {provider === 'skip' && (
        <div className="info-box">
          <p>
            You skipped authentication. A default model will be configured, but you'll need to
            set up authentication before the bot can work.
          </p>
        </div>
      )}

      {(provider === 'anthropic' || provider === 'google' || provider === 'antigravity') && models.length > 0 && (
        <div className="model-select">
          {models.map((model) => (
            <div
              key={model.id}
              className={`model-card ${value === model.id ? 'selected' : ''}`}
              onClick={() => onChange(model.id)}
            >
              <div className="model-radio">
                {value === model.id ? '●' : '○'}
              </div>
              <div className="model-info">
                <div className="model-name">{model.name}</div>
                <div className="model-id">{model.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(provider === 'custom' || customModelInput) && (
        <div className="custom-model-input">
          <div className="form-group">
            <label>Model ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="claude-sonnet-4-5-20251101"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="form-hint">
              Enter the exact model ID as expected by your API provider
            </div>
          </div>
        </div>
      )}

      {provider === 'skip' && (
        <div className="model-select">
          {anthropicModels.map((model) => (
            <div
              key={model.id}
              className={`model-card ${value === model.id ? 'selected' : ''}`}
              onClick={() => onChange(model.id)}
            >
              <div className="model-radio">
                {value === model.id ? '●' : '○'}
              </div>
              <div className="model-info">
                <div className="model-name">{model.name}</div>
                <div className="model-id">{model.id}</div>
              </div>
            </div>
          ))}
          <div className="skip-model-notice" style={{marginTop: '16px', textAlign: 'center'}}>
            <p>You can change this later in settings.</p>
          </div>
        </div>
      )}
    </div>
  );
};
