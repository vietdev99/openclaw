import React from 'react';
import { DirectoryPicker } from '../DirectoryPicker';

export interface WorkspaceStepProps {
  value: string;
  onChange: (path: string) => void;
  validate?: (path: string) => Promise<{ valid: boolean; error?: string }>;
}

export const WorkspaceStep: React.FC<WorkspaceStepProps> = ({ value, onChange, validate }) => {
  return (
    <div className="step-card workspace-step">
      <h2>Workspace Directory</h2>
      <p>
        Select the directory where Clawdbot will store its configuration files, logs, and data.
      </p>

      <div className="workspace-info">
        <div className="info-box">
          <h4>Default Location</h4>
          <p>
            The recommended location is <code>~/.moltbot</code> (or <code>C:\Users\YourName\.moltbot</code> on Windows).
          </p>
          <p>
            This directory will contain:
          </p>
          <ul>
            <li><code>moltbot.json</code> - Main configuration file</li>
            <li><code>logs/</code> - Application logs</li>
            <li><code>data/</code> - Runtime data and caches</li>
          </ul>
        </div>
      </div>

      <DirectoryPicker
        label="Workspace Directory"
        value={value}
        onChange={onChange}
        validate={validate}
        placeholder="Select workspace directory..."
      />

      <div className="workspace-note">
        <p>
          If the directory doesn't exist, it will be created automatically.
        </p>
      </div>
    </div>
  );
};
