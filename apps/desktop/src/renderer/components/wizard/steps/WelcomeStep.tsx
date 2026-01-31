import React from 'react';
import { RobotIcon } from '../../BrandIcons';

export interface WelcomeStepProps {
  onSelect: (mode: 'existing' | 'fresh') => void;
  loading?: boolean;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onSelect, loading }) => {
  return (
    <div className="step-card welcome-step">
      <div className="welcome-icon">
        <RobotIcon size={64} />
      </div>
      <h1>Welcome to Clawdbot</h1>
      <p className="welcome-description">
        Clawdbot is an AI-powered chatbot framework that connects to various messaging platforms
        and provides intelligent responses using large language models.
      </p>

      <div className="welcome-options">
        <button
          className="btn btn-primary btn-large"
          onClick={() => onSelect('existing')}
          disabled={loading}
        >
          Use Existing Configuration
        </button>

        <div className="option-divider">
          <span>or</span>
        </div>

        <button
          className="btn btn-secondary btn-large"
          onClick={() => onSelect('fresh')}
          disabled={loading}
        >
          Fresh Install
        </button>
      </div>

      <div className="welcome-note">
        <p>
          <strong>Fresh Install:</strong> Will backup your existing configuration and create a
          new setup from scratch.
        </p>
      </div>
    </div>
  );
};
