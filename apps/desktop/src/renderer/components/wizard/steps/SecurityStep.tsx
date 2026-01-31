import React, { useState } from 'react';

export interface SecurityStepProps {
  value: boolean;
  onChange: (consent: boolean) => void;
}

export const SecurityStep: React.FC<SecurityStepProps> = ({ value, onChange }) => {
  return (
    <div className="step-card security-step">
      <h2>Security Notice</h2>

      <div className="warning-box">
        <h3>⚠ Important Security Information</h3>
        <p>Before proceeding, please understand the following:</p>

        <ul>
          <li>
            Clawdbot connects to AI providers (Anthropic, Google, OpenAI, etc.) and messaging
            platforms (Telegram, Discord, WhatsApp, etc.)
          </li>
          <li>
            The application requires API keys, OAuth tokens, and system permissions to function
          </li>
          <li>
            Bot tokens and credentials will be stored locally on your device in configuration
            files
          </li>
          <li>
            The application sends user messages to AI providers for processing
          </li>
          <li>
            You are responsible for securing your credentials and managing access to the bot
          </li>
          <li>
            Review the source code before using in production or sensitive environments
          </li>
        </ul>

        <p className="warning-footer">
          By continuing, you acknowledge these risks and agree to use Clawdbot responsibly.
        </p>
      </div>

      <div className="consent-checkbox">
        <label>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>I understand the risks and consent to proceed with the installation</span>
        </label>
      </div>

      {!value && (
        <div className="consent-hint">
          You must accept the security notice to continue.
        </div>
      )}
    </div>
  );
};
