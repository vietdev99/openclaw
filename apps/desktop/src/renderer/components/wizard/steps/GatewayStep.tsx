import React, { useState, useEffect } from 'react';

export interface GatewayConfig {
  mode: 'local' | 'service';
  port: number;
  bind: 'localhost' | 'all-interfaces' | 'tailscale';
  auth: 'token' | 'password' | 'none';
  token?: string;
  password?: string;
}

export interface GatewayStepProps {
  value: GatewayConfig;
  onChange: (config: GatewayConfig) => void;
}

export const GatewayStep: React.FC<GatewayStepProps> = ({ value, onChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-generate token if auth is 'token' and no token exists
  useEffect(() => {
    if (value.auth === 'token' && !value.token) {
      const randomToken = Array.from({ length: 32 }, () =>
        Math.random().toString(36)[2]
      ).join('');
      onChange({ ...value, token: randomToken });
    }
  }, [value.auth]);

  const handleModeChange = (mode: 'local' | 'service') => {
    onChange({ ...value, mode });
  };

  const handleFieldChange = (field: keyof GatewayConfig, fieldValue: any) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className="step-card gateway-step">
      <h2>Gateway Configuration</h2>
      <p>
        The Gateway provides a web UI and JSON-RPC API for managing the bot. Choose how you want
        to run it:
      </p>

      <div className="gateway-mode-select">
        <div
          className={`mode-card ${value.mode === 'local' ? 'selected' : ''}`}
          onClick={() => handleModeChange('local')}
        >
          <div className="mode-radio">{value.mode === 'local' ? '●' : '○'}</div>
          <div className="mode-info">
            <h3>Local Process (Recommended)</h3>
            <p>
              Gateway runs only when the desktop app is open. Stops when you close the app.
              Perfect for personal use.
            </p>
          </div>
        </div>

        <div
          className={`mode-card ${value.mode === 'service' ? 'selected' : ''}`}
          onClick={() => handleModeChange('service')}
        >
          <div className="mode-radio">{value.mode === 'service' ? '●' : '○'}</div>
          <div className="mode-info">
            <h3>System Service</h3>
            <p>
              Install as a persistent system service (systemd/launchd/Task Scheduler). Runs
              continuously in the background.
            </p>
            <div className="mode-warning">
              ⚠ Requires administrator/sudo privileges
            </div>
          </div>
        </div>
      </div>

      <div className="gateway-settings">
        <div className="form-group">
          <label>Port</label>
          <input
            type="number"
            className="form-input"
            value={value.port}
            onChange={(e) => handleFieldChange('port', parseInt(e.target.value, 10))}
            min="1024"
            max="65535"
          />
          <div className="form-hint">Default: 18789</div>
        </div>

        <div className="advanced-toggle">
          <button
            type="button"
            className="btn btn-link"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-settings">
            <div className="form-group">
              <label>Bind Address</label>
              <select
                className="form-select"
                value={value.bind}
                onChange={(e) =>
                  handleFieldChange('bind', e.target.value as 'localhost' | 'all-interfaces' | 'tailscale')
                }
              >
                <option value="localhost">Loopback - Only this machine (127.0.0.1)</option>
                <option value="all-interfaces">LAN - All network interfaces (0.0.0.0)</option>
                <option value="tailscale">Tailnet - Tailscale VPN (100.x.x.x)</option>
              </select>
              <div className="form-hint">
                {value.bind === 'localhost' && '✓ Secure: Only accessible from this machine'}
                {value.bind === 'all-interfaces' && '⚠ Warning: Accessible from any device on your network. Requires authentication!'}
                {value.bind === 'tailscale' && '✓ Secure: Accessible via encrypted Tailscale VPN'}
              </div>
            </div>

            <div className="form-group">
              <label>Authentication</label>
              <select
                className="form-select"
                value={value.auth}
                onChange={(e) =>
                  handleFieldChange('auth', e.target.value as 'token' | 'password' | 'none')
                }
              >
                <option value="token">Token-based (Recommended)</option>
                <option value="password">Password</option>
                <option value="none">None (Unsafe)</option>
              </select>
            </div>

            {value.auth === 'token' && (
              <div className="form-group">
                <label>Access Token</label>
                <input
                  type="text"
                  className="form-input"
                  value={value.token || ''}
                  readOnly
                />
                <div className="form-hint">
                  Auto-generated secure token. Save this token to access the gateway.
                </div>
              </div>
            )}

            {value.auth === 'password' && (
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter password..."
                  value={value.password || ''}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                />
              </div>
            )}

            {value.auth === 'none' && (
              <div className="warning-box">
                <p>
                  ⚠ <strong>Warning:</strong> Running without authentication is not recommended,
                  especially if binding to all interfaces.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
