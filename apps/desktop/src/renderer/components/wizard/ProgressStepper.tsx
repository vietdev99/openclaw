import React from 'react';

export interface ProgressStepperProps {
  current: number;
  total: number;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ current, total }) => {
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="progress-stepper">
      {steps.map((step) => (
        <React.Fragment key={step}>
          <div
            className={`progress-step ${step < current ? 'completed' : ''} ${
              step === current ? 'active' : ''
            }`}
          >
            {step < current ? '✓' : step}
          </div>
          {step < total && (
            <div className={`progress-line ${step < current ? 'completed' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
