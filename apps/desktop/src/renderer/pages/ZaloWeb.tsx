import React, { useState, useEffect } from 'react';

interface ZaloWebStatus {
  active: boolean;
  loggedIn: boolean;
  url?: string;
  userId?: string;
  userName?: string;
}

function ZaloWeb() {
  const [status, setStatus] = useState<ZaloWebStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load status on mount
  useEffect(() => {
    loadStatus();

    // Subscribe to login status changes
    const unsubLogin = window.electronAPI.zaloweb.onLoginStatus((loginStatus) => {
      setStatus((prev) => prev ? { ...prev, ...loginStatus } : null);
    });

    return () => {
      unsubLogin();
    };
  }, []);

  const loadStatus = async () => {
    try {
      const st = await window.electronAPI.zaloweb.getStatus();
      setStatus(st);
    } catch (err) {
      setError('Failed to get Zalo Web status');
    }
  };

  const handleOpenZaloWeb = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.zaloweb.open();
      if (result) {
        await loadStatus();
      } else {
        setError('Failed to open Zalo Web window');
      }
    } catch (err) {
      setError('Error opening Zalo Web');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page zaloweb-page">
      <div className="page-header">
        <h1>💬 Zalo Web</h1>
        <p className="page-description">
          Connect to Zalo using a separate browser window. Login once with QR code,
          then messages flow through Clawdbot.
        </p>
      </div>

      {/* Launch Card */}
      <div className="card launch-card">
        <div className="launch-content">
          <div className="launch-icon">📱</div>
          <h2>Zalo Web Connection</h2>
          <p className="launch-description">
            Opens Zalo Web in a separate window. Your session will be preserved
            even when the window is closed.
          </p>

          {/* Status indicator */}
          {status && (
            <div className="status-badges">
              <span className={`badge ${status.active ? 'badge-success' : 'badge-neutral'}`}>
                {status.active ? '● Window Active' : '○ Window Inactive'}
              </span>
              <span className={`badge ${status.loggedIn ? 'badge-success' : 'badge-warning'}`}>
                {status.loggedIn ? '✓ Logged In' : '○ Not Logged In'}
              </span>
              {status.userName && (
                <span className="badge badge-info">
                  {status.userName}
                </span>
              )}
            </div>
          )}

          <button
            className="btn btn-primary btn-large"
            onClick={handleOpenZaloWeb}
            disabled={loading}
          >
            {loading ? 'Opening...' : '🌐 Open Zalo Web'}
          </button>

          {error && (
            <p className="error-text">⚠️ {error}</p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="card instructions-card">
        <h2>How it works</h2>
        <ol className="instructions-list">
          <li>Click <strong>"Open Zalo Web"</strong> to launch a new window</li>
          <li>Scan the QR code with your Zalo mobile app</li>
          <li>Once logged in, messages are monitored automatically</li>
          <li>Close the window anytime - your session stays active</li>
        </ol>
        <p className="instructions-note">
          <strong>Note:</strong> This uses your Zalo Web session slot.
          If logged in elsewhere, that session will be disconnected.
        </p>
      </div>

      <style>{`
        .zaloweb-page {
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
        }

        .page-header h1 {
          margin-bottom: 8px;
          color: var(--text-primary, #e4e4e7);
        }

        .page-description {
          color: var(--text-secondary, #a1a1aa);
          margin-bottom: 24px;
        }

        .card {
          background: var(--bg-secondary, #1e1e2e);
          border: 1px solid var(--border-color, #2d2d3d);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .card h2 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #e4e4e7);
        }

        .launch-card {
          text-align: center;
        }

        .launch-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .launch-icon {
          font-size: 48px;
        }

        .launch-description {
          color: var(--text-secondary, #a1a1aa);
          margin: 0;
          max-width: 400px;
        }

        .status-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-success {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .badge-warning {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .badge-neutral {
          background: var(--bg-tertiary, #252536);
          color: var(--text-secondary, #a1a1aa);
          border: 1px solid var(--border-color, #2d2d3d);
        }

        .badge-info {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent-primary, #3b82f6);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover, #2563eb);
          transform: translateY(-1px);
        }

        .btn-large {
          padding: 14px 32px;
          font-size: 16px;
        }

        .error-text {
          color: #f87171;
          font-size: 14px;
          margin: 8px 0 0 0;
        }

        .instructions-list {
          margin: 0;
          padding-left: 20px;
          color: var(--text-primary, #e4e4e7);
        }

        .instructions-list li {
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .instructions-note {
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          font-size: 13px;
          color: #fbbf24;
        }

        .instructions-note strong {
          color: #fcd34d;
        }
      `}</style>
    </div>
  );
}

export default ZaloWeb;
