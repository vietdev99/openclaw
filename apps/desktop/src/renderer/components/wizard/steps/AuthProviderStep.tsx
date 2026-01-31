import React, { useState, useEffect, useCallback } from 'react';
import { ClaudeIcon, GoogleIcon } from '../../BrandIcons';
import { EmbeddedTerminal } from '../../EmbeddedTerminal';

export interface AuthProviderStepProps {
  value: {
    provider: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
    apiKey?: string;
    baseUrl?: string;
  };
  onChange: (value: {
    provider: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
    apiKey?: string;
    baseUrl?: string;
  }) => void;
  onOAuth: (provider: string) => Promise<void>;
  oauthLoading?: boolean;
  oauthStatus?: string;
}

interface ProviderInfo {
  id: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
  name: string;
  description: string;
  icon: React.ReactNode;
  oauthProvider?: string;
}

const providers: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Use API key from console.anthropic.com',
    icon: <ClaudeIcon size={32} />,
    // No oauthProvider - Anthropic uses API keys only
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Login with your Google account using OAuth',
    icon: <GoogleIcon size={32} />,
    oauthProvider: 'google',
  },
  {
    id: 'antigravity',
    name: 'Antigravity Tools',
    description: 'Login with your Google account via Antigravity proxy',
    icon: <span style={{ fontSize: '32px' }}>🚀</span>,
    oauthProvider: 'antigravity',
  },
  {
    id: 'custom',
    name: 'Custom API',
    description: 'Use your own API key or custom endpoint',
    icon: <span style={{ fontSize: '32px' }}>🔑</span>,
  },
  {
    id: 'skip',
    name: 'Skip for Now',
    description: 'Configure authentication later from settings',
    icon: <span style={{ fontSize: '32px' }}>⏭️</span>,
  },
];

type AuthStatus = 'idle' | 'installing' | 'authenticating' | 'success' | 'error';

export const AuthProviderStep: React.FC<AuthProviderStepProps> = ({
  value,
  onChange,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers.find(p => p.id === value.provider) || providers[0]
  );
  const [customApiKey, setCustomApiKey] = useState(value.apiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(value.baseUrl || '');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [terminalSession, setTerminalSession] = useState<string | null>(null);
  const [clawdbotRoot, setClawdbotRoot] = useState<string>('');

  // Get clawdbot root path on mount
  useEffect(() => {
    window.electronAPI.app.getClawdbotRoot().then(setClawdbotRoot);
  }, []);

  const handleProviderSelect = (provider: ProviderInfo) => {
    setSelectedProvider(provider);
    // Reset status when switching providers
    setAuthStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
    setTerminalSession(null);
  };

  const handleLogin = useCallback(async () => {
    if (!selectedProvider.oauthProvider || !clawdbotRoot) return;

    setAuthStatus('authenticating');
    setStatusMessage('Opening terminal window for authentication...');
    setErrorMessage('');

    try {
      // Open external CMD window for OAuth login
      // Plugin is pre-installed, no need to install at runtime
      const command = `node moltbot.mjs models auth login --provider ${selectedProvider.oauthProvider} && pause`;

      const result = await window.electronAPI.terminal.openExternal(clawdbotRoot, command);

      if (result.success) {
        setStatusMessage('Terminal opened. Please complete authentication in the new window, then click "I\'ve completed authentication".');
        setTerminalSession('external'); // Mark that terminal is open
      } else {
        setAuthStatus('error');
        setErrorMessage(`Failed to open terminal: ${result.error}`);
      }
    } catch (error: any) {
      setAuthStatus('error');
      setErrorMessage(error.message || 'Failed to open terminal');
    }
  }, [selectedProvider, clawdbotRoot]);

  const handleTerminalComplete = useCallback((exitCode: number) => {
    if (exitCode === 0) {
      setAuthStatus('success');
      setStatusMessage('Authentication successful!');
      onChange({ provider: selectedProvider.id });
    } else {
      setAuthStatus('error');
      setErrorMessage(`Authentication failed with exit code ${exitCode}`);
    }
  }, [selectedProvider, onChange]);

  const handleCustomSubmit = () => {
    onChange({
      provider: 'custom',
      apiKey: customApiKey,
      baseUrl: customBaseUrl || undefined,
    });
    setAuthStatus('success');
    setStatusMessage('API key saved!');
  };

  const handleSkip = () => {
    onChange({ provider: 'skip' });
    setAuthStatus('success');
    setStatusMessage('Authentication skipped. You can configure it later.');
  };

  const renderProviderDetails = () => {
    // OAuth providers
    if (selectedProvider.oauthProvider) {
      return (
        <>
          <div className="config-header-main">
            <div className="header-icon">
              {selectedProvider.icon}
            </div>
            <div className="header-text">
              <h3>{selectedProvider.name}</h3>
              <p>{selectedProvider.description}</p>
            </div>
          </div>

          {authStatus === 'idle' && (
            <button
              className="btn btn-primary btn-large"
              onClick={handleLogin}
              disabled={!clawdbotRoot}
            >
              Login with {selectedProvider.name.split(' ')[0]}
            </button>
          )}

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

          {terminalSession && (
            <div className="terminal-container">
              <EmbeddedTerminal
                sessionId={terminalSession}
                onComplete={handleTerminalComplete}
              />
            </div>
          )}
        </>
      );
    }

    // Custom API
    if (selectedProvider.id === 'custom') {
      return (
        <>
          <div className="config-header-main">
            <div className="header-icon">
              {selectedProvider.icon}
            </div>
            <div className="header-text">
              <h3>{selectedProvider.name}</h3>
              <p>{selectedProvider.description}</p>
            </div>
          </div>

          <div className="config-form-container">
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-ant-..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Base URL (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://api.anthropic.com"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCustomSubmit}
              disabled={!customApiKey}
            >
              Save API Key
            </button>

            {authStatus === 'success' && (
              <div className="auth-status success" style={{ marginTop: '16px' }}>
                {statusMessage}
              </div>
            )}
          </div>
        </>
      );
    }

    // Skip
    if (selectedProvider.id === 'skip') {
      return (
        <>
          <div className="config-header-main">
            <div className="header-icon">
              {selectedProvider.icon}
            </div>
            <div className="header-text">
              <h3>{selectedProvider.name}</h3>
              <p>{selectedProvider.description}</p>
            </div>
          </div>

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

          {authStatus === 'success' && (
            <div className="auth-status success" style={{ marginTop: '16px' }}>
              {statusMessage}
            </div>
          )}
        </>
      );
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
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`auth-list-item ${selectedProvider.id === provider.id ? 'active' : ''} ${value.provider === provider.id ? 'authenticated' : ''}`}
              onClick={() => handleProviderSelect(provider)}
            >
              <div className="auth-icon-small">
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

        {/* Right Panel - Provider Details */}
        <div className="auth-detail-panel">
          {renderProviderDetails()}
        </div>
      </div>
    </div>
  );
};
