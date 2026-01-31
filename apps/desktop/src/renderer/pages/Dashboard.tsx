import React, { useState, useEffect } from 'react';

interface GatewayStatus {
  running: boolean;
  port?: number;
  pid?: number;
  startedAt?: Date;
  channels?: string[];
  error?: string;
}

function Dashboard() {
  const [status, setStatus] = useState<GatewayStatus>({ running: false });
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Get initial status
    fetchStatus();

    // Subscribe to status changes
    const unsubscribe = window.electronAPI.gateway.onStatusChange((newStatus) => {
      setStatus(newStatus);
      addLog(`Status changed: ${newStatus.running ? 'Running' : 'Stopped'}`);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await window.electronAPI.gateway.getStatus();
      setStatus(status);
    } catch (err) {
      addLog(`Error fetching status: ${err}`);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const handleStart = async () => {
    setLoading(true);
    addLog('Starting gateway...');
    try {
      const result = await window.electronAPI.gateway.start();
      setStatus(result);
      addLog('Gateway started successfully');
    } catch (err) {
      addLog(`Failed to start: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    addLog('Stopping gateway...');
    try {
      const result = await window.electronAPI.gateway.stop();
      setStatus(result);
      addLog('Gateway stopped');
    } catch (err) {
      addLog(`Failed to stop: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    addLog('Restarting gateway...');
    try {
      const result = await window.electronAPI.gateway.restart();
      setStatus(result);
      addLog('Gateway restarted');
    } catch (err) {
      addLog(`Failed to restart: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = () => {
    if (!status.startedAt) return 'N/A';
    const start = new Date(status.startedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Status Card */}
      <div className="card status-card">
        <div className="card-header">
          <h2>Gateway Status</h2>
          <span className={`status-badge ${status.running ? 'running' : 'stopped'}`}>
            {status.running ? '● Running' : '○ Stopped'}
          </span>
        </div>

        <div className="status-grid">
          <div className="status-item">
            <label>Port</label>
            <span>{status.port ?? 18789}</span>
          </div>
          <div className="status-item">
            <label>PID</label>
            <span>{status.pid ?? 'N/A'}</span>
          </div>
          <div className="status-item">
            <label>Uptime</label>
            <span>{status.running ? formatUptime() : 'N/A'}</span>
          </div>
        </div>

        {status.error && (
          <div className="error-message">
            Error: {status.error}
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={loading || status.running}
          >
            {loading ? 'Loading...' : 'Start'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleStop}
            disabled={loading || !status.running}
          >
            Stop
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleRestart}
            disabled={loading || !status.running}
          >
            Restart
          </button>
        </div>
      </div>

      {/* Channels Card */}
      <div className="card">
        <div className="card-header">
          <h2>Active Channels</h2>
        </div>
        <div className="channels-list">
          {status.channels && status.channels.length > 0 ? (
            status.channels.map((channel, i) => (
              <div key={i} className="channel-item">
                <span className="channel-icon">📡</span>
                <span>{channel}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              {status.running ? 'No active channels' : 'Start gateway to see channels'}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="card">
        <div className="card-header">
          <h2>Activity Log</h2>
          <button className="btn btn-small" onClick={() => setLogs([])}>
            Clear
          </button>
        </div>
        <div className="log-container">
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} className="log-entry">
                {log}
              </div>
            ))
          ) : (
            <div className="empty-state">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
