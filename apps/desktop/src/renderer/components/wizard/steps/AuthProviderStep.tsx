import React, { useState, useEffect, useCallback } from 'react';
import { ClaudeIcon, GoogleIcon, ApiKeyIcon, OAuthIcon, ImportIcon, DeviceCodeIcon } from '../../BrandIcons';
import { EmbeddedTerminal } from '../../EmbeddedTerminal';
import { PROVIDER_CATALOG } from '../../../data/provider-catalog';
import { ProviderDefinition, AuthMethodDefinition } from '../../../types/providers';
import { FaCog, FaTicketAlt } from 'react-icons/fa';

export interface AuthProviderStepProps {
  value: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
  };
  onChange: (value: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
  }) => void;
  onOAuth: (provider: string) => Promise<void>;
  oauthLoading?: boolean;
  oauthStatus?: string;
}

type AuthStep = 'provider' | 'method' | 'execute';
type AuthStatus = 'idle' | 'installing' | 'authenticating' | 'success' | 'error';

export const AuthProviderStep: React.FC<AuthProviderStepProps> = ({
  value,
  onChange,
}) => {
  // 3-step state management
  const [authStep, setAuthStep] = useState<AuthStep>('provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AuthMethodDefinition | null>(null);

  // Auth execution state
  const [apiKey, setApiKey] = useState(value.apiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(value.baseUrl || '');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [terminalSession, setTerminalSession] = useState<string | null>(null);
  const [clawdbotRoot, setClawdbotRoot] = useState<string>('');

  // Get clawdbot root path on mount
  useEffect(() => {
    window.electronAPI.app.getClawdbotRoot().then(setClawdbotRoot);
  }, []);

  // Handler: Provider selected
  const handleProviderSelect = (provider: ProviderDefinition) => {
    setSelectedProvider(provider);
    setAuthStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
    setTerminalSession(null);

    // If provider has only 1 method, auto-select and go to execute
    if (provider.methods.length === 1) {
      setSelectedMethod(provider.methods[0]);
      setAuthStep('execute');
    } else {
      // Show method selection
      setAuthStep('method');
    }
  };

  // Handler: Method selected
  const handleMethodSelect = (method: AuthMethodDefinition) => {
    setSelectedMethod(method);

    // Initialize custom fields with default values
    if (method.customFields) {
      const initialFields: Record<string, string> = {};
      method.customFields.forEach((field) => {
        initialFields[field.id] = field.default || '';
      });
      setCustomFields(initialFields);
    }

    setAuthStep('execute');
  };

  // Handler: Back to provider list
  const handleBackToProviders = () => {
    setSelectedProvider(null);
    setSelectedMethod(null);
    setAuthStep('provider');
    setAuthStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
  };

  // Handler: Back to method selection
  const handleBackToMethods = () => {
    setSelectedMethod(null);
    setAuthStep('method');
    setAuthStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
  };

  // Handler: API Key Submit
  const handleApiKeySubmit = useCallback(async () => {
    if (!apiKey || !selectedProvider) return;

    setAuthStatus('authenticating');
    setStatusMessage('Saving API key...');
    setErrorMessage('');

    try {
      // Save API key to config
      // TODO: Implement proper config save via IPC
      onChange({
        provider: selectedProvider.id,
        apiKey: apiKey,
      });

      setAuthStatus('success');
      setStatusMessage('API key saved successfully!');
    } catch (error: any) {
      setAuthStatus('error');
      setErrorMessage(error.message || 'Failed to save API key');
    }
  }, [apiKey, selectedProvider, onChange]);

  // Handler: Import from ~/.claude
  const handleImportClaudeCLI = useCallback(async () => {
    if (!selectedProvider) return;

    setAuthStatus('authenticating');
    setStatusMessage('Reading token from ~/.claude...');
    setErrorMessage('');

    try {
      // Call IPC to read ~/.claude config
      const result = await window.electronAPI.auth.importClaudeCLI();

      if (result.success && result.token) {
        onChange({
          provider: selectedProvider.id,
          apiKey: result.token,
        });

        setAuthStatus('success');
        setStatusMessage(`Token imported successfully! (${result.source})`);
      } else {
        setAuthStatus('error');
        setErrorMessage(result.error || 'No token found in ~/.claude');
      }
    } catch (error: any) {
      setAuthStatus('error');
      setErrorMessage(error.message || 'Failed to import token from ~/.claude');
    }
  }, [selectedProvider, onChange]);

  // Handler: Custom Fields Submit
  const handleCustomFieldsSubmit = useCallback(async () => {
    if (!selectedProvider || !selectedMethod) return;

    // Validate required fields
    const hasAllFields = selectedMethod.customFields?.every(
      (field) => customFields[field.id] && customFields[field.id].trim() !== ''
    );

    if (!hasAllFields) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setAuthStatus('authenticating');
    setStatusMessage('Saving configuration...');
    setErrorMessage('');

    try {
      onChange({
        provider: selectedProvider.id,
        apiKey: customFields['apiKey'],
        baseUrl: customFields['baseUrl'],
      });

      setAuthStatus('success');
      setStatusMessage('Configuration saved successfully!');
    } catch (error: any) {
      setAuthStatus('error');
      setErrorMessage(error.message || 'Failed to save configuration');
    }
  }, [customFields, selectedProvider, selectedMethod, onChange]);

  // Handler: OAuth Login
  const handleOAuthLogin = useCallback(async () => {
    if (!selectedProvider || !clawdbotRoot) return;

    setAuthStatus('authenticating');
    setStatusMessage('Opening terminal window for authentication...');
    setErrorMessage('');

    try {
      // Open external CMD window for OAuth login
      const command = `node moltbot.mjs models auth login --provider ${selectedProvider.id} && pause`;

      const result = await window.electronAPI.terminal.openExternal(clawdbotRoot, command);

      if (result.success) {
        setStatusMessage('Terminal opened. Please complete authentication in the new window.');
        setTerminalSession('external');
      } else {
        setAuthStatus('error');
        setErrorMessage(`Failed to open terminal: ${result.error}`);
      }
    } catch (error: any) {
      setAuthStatus('error');
      setErrorMessage(error.message || 'Failed to open terminal');
    }
  }, [selectedProvider, clawdbotRoot]);

  // Handler: Terminal Complete
  const handleTerminalComplete = useCallback((exitCode: number) => {
    if (!selectedProvider) return;

    if (exitCode === 0) {
      setAuthStatus('success');
      setStatusMessage('Authentication successful!');
      onChange({ provider: selectedProvider.id });
    } else {
      setAuthStatus('error');
      setErrorMessage(`Authentication failed with exit code ${exitCode}`);
    }
  }, [selectedProvider, onChange]);

  // Handler: Skip Authentication
  const handleSkip = useCallback(() => {
    onChange({ provider: 'skip' });
    setAuthStatus('success');
    setStatusMessage('Authentication skipped. You can configure it later.');
  }, [onChange]);

  // Render method selection UI
  const renderMethodSelection = () => {
    if (!selectedProvider) return null;

    return (
      <div className="method-selection">
        <div className="config-header-main">
          <div className="header-icon" style={{ fontSize: '32px' }}>
            {selectedProvider.icon}
          </div>
          <div className="header-text">
            <h3>{selectedProvider.name}</h3>
            <p>Choose an authentication method:</p>
          </div>
        </div>

        <div className="method-list">
          {selectedProvider.methods.map((method) => (
            <div
              key={method.id}
              className="method-card"
              onClick={() => handleMethodSelect(method)}
            >
              <div className="method-header">
                <span className="method-label">{method.label}</span>
                <span className={`method-badge ${method.kind}`}>
                  {method.kind === 'api_key' && <><ApiKeyIcon size={14} /> API Key</>}
                  {method.kind === 'oauth' && <><OAuthIcon size={14} /> OAuth</>}
                  {method.kind === 'token' && <><FaTicketAlt size={14} /> Token</>}
                  {method.kind === 'import' && <><ImportIcon size={14} /> Import</>}
                  {method.kind === 'device_code' && <><DeviceCodeIcon size={14} /> Device Code</>}
                  {method.kind === 'custom' && <><FaCog size={14} /> Custom</>}
                </span>
              </div>
              {method.hint && <p className="method-hint">{method.hint}</p>}
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={handleBackToProviders}>
          ← Back to Providers
        </button>
      </div>
    );
  };

  // Render auth execution UI based on method kind
  const renderAuthExecution = () => {
    if (!selectedProvider || !selectedMethod) return null;

    const renderHeader = () => (
      <div className="config-header-main">
        <div className="header-icon" style={{ fontSize: '32px' }}>
          {selectedProvider.icon}
        </div>
        <div className="header-text">
          <h3>{selectedProvider.name}</h3>
          <p>{selectedMethod.label}</p>
        </div>
      </div>
    );

    const renderStatusMessages = () => (
      <>
        {(authStatus === 'installing' || authStatus === 'authenticating') && (
          <div className={`auth-status ${authStatus === 'installing' ? 'loading' : ''}`}>
            {statusMessage}
          </div>
        )}

        {authStatus === 'success' && (
          <div className="auth-status success">
            {statusMessage}
          </div>
        )}

        {authStatus === 'error' && (
          <div className="auth-status error">
            {errorMessage}
            <button
              className="btn btn-secondary"
              onClick={() => {
                setAuthStatus('idle');
                setTerminalSession(null);
              }}
              style={{ marginTop: '12px' }}
            >
              Try Again
            </button>
          </div>
        )}
      </>
    );

    // API Key method
    if (selectedMethod.kind === 'api_key') {
      return (
        <>
          {renderHeader()}
          {selectedMethod.instructions && (
            <div className="info-box">
              <p>{selectedMethod.instructions}</p>
            </div>
          )}

          <div className="config-form-container">
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleApiKeySubmit}
              disabled={!apiKey || authStatus === 'authenticating'}
            >
              {authStatus === 'authenticating' ? 'Saving...' : 'Save API Key'}
            </button>
          </div>

          {renderStatusMessages()}

          <button className="btn btn-secondary" onClick={
            selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
          } style={{ marginTop: '16px' }}>
            ← Back
          </button>
        </>
      );
    }

    // OAuth method
    if (selectedMethod.kind === 'oauth') {
      return (
        <>
          {renderHeader()}
          {selectedMethod.instructions && (
            <div className="info-box">
              <p>{selectedMethod.instructions}</p>
            </div>
          )}

          {authStatus === 'idle' && (
            <button
              className="btn btn-primary btn-large"
              onClick={handleOAuthLogin}
              disabled={!clawdbotRoot}
            >
              Login with OAuth
            </button>
          )}

          {renderStatusMessages()}

          {terminalSession && (
            <div className="terminal-container">
              <EmbeddedTerminal
                sessionId={terminalSession}
                onComplete={handleTerminalComplete}
              />
            </div>
          )}

          <button className="btn btn-secondary" onClick={
            selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
          } style={{ marginTop: '16px' }}>
            ← Back
          </button>
        </>
      );
    }

    // Token method (Anthropic setup-token)
    if (selectedMethod.kind === 'token') {
      return (
        <>
          {renderHeader()}
          {selectedMethod.instructions && (
            <div className="info-box">
              <p>{selectedMethod.instructions}</p>
            </div>
          )}

          <div className="config-form-container">
            <div className="form-group">
              <label>Token</label>
              <input
                type="password"
                className="form-input"
                placeholder="Paste your token here..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleApiKeySubmit}
              disabled={!apiKey || authStatus === 'authenticating'}
            >
              {authStatus === 'authenticating' ? 'Saving...' : 'Save Token'}
            </button>
          </div>

          {renderStatusMessages()}

          <button className="btn btn-secondary" onClick={
            selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
          } style={{ marginTop: '16px' }}>
            ← Back
          </button>
        </>
      );
    }

    // Import method (Import from ~/.claude)
    if (selectedMethod.kind === 'import') {
      return (
        <>
          {renderHeader()}
          {selectedMethod.instructions && (
            <div className="info-box">
              <p>{selectedMethod.instructions}</p>
            </div>
          )}

          {authStatus === 'idle' && (
            <button
              className="btn btn-primary btn-large"
              onClick={handleImportClaudeCLI}
            >
              📥 Import Token from ~/.claude
            </button>
          )}

          {renderStatusMessages()}

          <button className="btn btn-secondary" onClick={
            selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
          } style={{ marginTop: '16px' }}>
            ← Back
          </button>
        </>
      );
    }

    // Skip option
    if (selectedMethod.kind === 'custom' && selectedProvider.id === 'skip') {
      return (
        <>
          {renderHeader()}
          <div className="info-box">
            <p>You can configure authentication later from the Settings page.</p>
            <p>Some features may be limited until you authenticate with a provider.</p>
          </div>

          <button
            className="btn btn-secondary btn-large"
            onClick={handleSkip}
          >
            Skip Authentication
          </button>

          {renderStatusMessages()}
        </>
      );
    }

    // Custom fields method (Mixed Agent with API Key + URL)
    if (selectedMethod.kind === 'custom' && selectedMethod.customFields) {
      return (
        <>
          {renderHeader()}
          {selectedMethod.instructions && (
            <div className="info-box">
              <p>{selectedMethod.instructions}</p>
            </div>
          )}

          <div className="config-form-container">
            {selectedMethod.customFields.map((field) => (
              <div key={field.id} className="form-group">
                <label>{field.label}</label>
                <input
                  type={field.type}
                  className="form-input"
                  placeholder={field.placeholder}
                  value={customFields[field.id] || ''}
                  onChange={(e) =>
                    setCustomFields((prev) => ({
                      ...prev,
                      [field.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}

            <button
              className="btn btn-primary"
              onClick={handleCustomFieldsSubmit}
              disabled={authStatus === 'authenticating'}
            >
              {authStatus === 'authenticating' ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {renderStatusMessages()}

          <button className="btn btn-secondary" onClick={
            selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
          } style={{ marginTop: '16px' }}>
            ← Back
          </button>
        </>
      );
    }

    // Device code and other methods - TODO
    return (
      <>
        {renderHeader()}
        <div className="info-box">
          <p>This authentication method is not yet implemented in the desktop app.</p>
          <p>Please use the CLI: <code>node moltbot.mjs models auth login --provider {selectedProvider.id}</code></p>
        </div>

        <button className="btn btn-secondary" onClick={
          selectedProvider.methods.length > 1 ? handleBackToMethods : handleBackToProviders
        }>
          ← Back
        </button>
      </>
    );
  };

  // Render right panel based on current step
  const renderRightPanel = () => {
    if (authStep === 'provider') {
      return (
        <div className="empty-state">
          <p>← Select a provider to get started</p>
        </div>
      );
    }

    if (authStep === 'method') {
      return renderMethodSelection();
    }

    if (authStep === 'execute') {
      return renderAuthExecution();
    }

    return null;
  };

  return (
    <div className="step-card auth-step">
      <h2>Authentication Provider</h2>
      <p>Choose how you want to authenticate with AI providers:</p>

      <div className="auth-two-panel">
        {/* Left Panel - Provider List */}
        <div className="auth-list-panel">
          {PROVIDER_CATALOG.map((provider) => (
            <div
              key={provider.id}
              className={`auth-list-item ${selectedProvider?.id === provider.id ? 'active' : ''} ${value.provider === provider.id ? 'authenticated' : ''}`}
              onClick={() => handleProviderSelect(provider)}
            >
              <div className="auth-icon-small" style={{ fontSize: '24px' }}>
                {provider.icon}
              </div>
              <div className="auth-info">
                <div className="auth-name">{provider.name}</div>
                {value.provider === provider.id && (
                  <div className="auth-status-badge">Configured</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right Panel - Dynamic based on auth step */}
        <div className="auth-detail-panel">
          {renderRightPanel()}
        </div>
      </div>
    </div>
  );
};
