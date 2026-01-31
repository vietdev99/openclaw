import React from 'react';

export interface CompleteStepData {
  installMode: 'existing' | 'fresh' | null;
  workspace: string;
  authProvider: string;
  model: string;
  gateway: {
    mode: 'local' | 'service';
    port: number;
    bind: string;
  };
  channels: Array<{ id: string; enabled: boolean }>;
}

export interface CompleteStepProps {
  data: CompleteStepData;
  onConfirm: () => void;
  onBack?: () => void;
  onStartGateway?: () => void;
  onOpenDashboard?: () => void;
  onConfigureSkills?: () => void;
  loading?: boolean;
  confirmed?: boolean;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({
  data,
  onConfirm,
  onBack,
  onStartGateway,
  onOpenDashboard,
  onConfigureSkills,
  loading,
  confirmed = false,
}) => {
  const enabledChannels = data.channels.filter((c) => c.enabled);

  return (
    <div className="step-card complete-step">
      <div className="complete-icon">✓</div>
      <h1>{confirmed ? 'Setup Complete!' : 'Review Your Configuration'}</h1>
      <p className="complete-description">
        {confirmed
          ? 'Clawdbot has been configured successfully. Here\'s a summary of your setup:'
          : 'Please review your configuration before confirming. You can change these settings later from the Settings page.'}
      </p>

      <div className="summary-cards">
        <div className="summary-card">
          <h3>Workspace</h3>
          <p className="summary-value">{data.workspace}</p>
        </div>

        <div className="summary-card">
          <h3>Authentication</h3>
          <p className="summary-value">
            {data.authProvider === 'anthropic' && 'Anthropic Claude'}
            {data.authProvider === 'google' && 'Google Gemini'}
            {data.authProvider === 'antigravity' && 'Antigravity Tools'}
            {data.authProvider === 'custom' && 'Custom API'}
            {data.authProvider === 'skip' && 'Not configured'}
          </p>
        </div>

        <div className="summary-card">
          <h3>Default Model</h3>
          <p className="summary-value">{data.model || 'Not configured'}</p>
        </div>

        <div className="summary-card">
          <h3>Gateway</h3>
          <p className="summary-value">
            {data.gateway.mode === 'local' ? 'Local Process' : 'System Service'}
          </p>
          <p className="summary-detail">
            Port: {data.gateway.port} | Bind: {data.gateway.bind}
          </p>
        </div>

        <div className="summary-card">
          <h3>Channels</h3>
          <p className="summary-value">
            {enabledChannels.length > 0
              ? `${enabledChannels.length} channel${enabledChannels.length > 1 ? 's' : ''} enabled`
              : 'No channels configured'}
          </p>
          {enabledChannels.length > 0 && (
            <div className="summary-detail">
              {enabledChannels.map((c) => c.id).join(', ')}
            </div>
          )}
        </div>
      </div>

      {!confirmed && (
        <div className="confirm-section">
          <div className="button-group">
            {onBack && (
              <button
                className="btn btn-secondary"
                onClick={onBack}
                disabled={loading}
              >
                ← Back
              </button>
            )}
            <button
              className="btn btn-primary btn-large"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Saving Configuration...' : 'Confirm & Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <>
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              {onStartGateway && (
                <button
                  className="btn btn-primary"
                  onClick={onStartGateway}
                  disabled={loading}
                >
                  Start Gateway
                </button>
              )}

              {onOpenDashboard && (
                <button
                  className="btn btn-secondary"
                  onClick={onOpenDashboard}
                  disabled={loading}
                >
                  Open Dashboard
                </button>
              )}

              {onConfigureSkills && (
                <button
                  className="btn btn-secondary"
                  onClick={onConfigureSkills}
                  disabled={loading}
                >
                  Configure Skills
                </button>
              )}
            </div>
          </div>

          <div className="complete-note">
            <p>
              You can always change these settings later from the Settings page.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
