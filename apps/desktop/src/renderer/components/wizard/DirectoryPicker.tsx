import React, { useState, useEffect } from 'react';

export interface DirectoryPickerProps {
  value: string;
  onChange: (path: string) => void;
  validate?: (path: string) => Promise<{ valid: boolean; error?: string }>;
  placeholder?: string;
  label?: string;
}

export const DirectoryPicker: React.FC<DirectoryPickerProps> = ({
  value,
  onChange,
  validate,
  placeholder = 'Select directory...',
  label = 'Directory',
}) => {
  const [validationState, setValidationState] = useState<{
    valid: boolean;
    error?: string;
    validating: boolean;
  }>({ valid: true, validating: false });

  useEffect(() => {
    if (validate && value) {
      setValidationState({ valid: true, validating: true });

      const debounce = setTimeout(async () => {
        try {
          const result = await validate(value);
          setValidationState({ valid: result.valid, error: result.error, validating: false });
        } catch (error: any) {
          setValidationState({
            valid: false,
            error: error.message || 'Validation failed',
            validating: false,
          });
        }
      }, 500);

      return () => clearTimeout(debounce);
    } else {
      setValidationState({ valid: true, validating: false });
    }
  }, [value, validate]);

  const handleBrowse = async () => {
    try {
      // Use Electron dialog to pick directory
      const result = await window.electronAPI.dialog?.showOpenDialog?.({
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: value || undefined,
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        onChange(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
    }
  };

  return (
    <div className="directory-picker">
      {label && <label className="form-label">{label}</label>}
      <div className="directory-picker-input-group">
        <input
          type="text"
          className={`form-input ${!validationState.valid ? 'error' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" className="btn btn-secondary" onClick={handleBrowse}>
          Browse...
        </button>
      </div>

      {validationState.validating && (
        <div className="validation-message info">
          <span>Validating...</span>
        </div>
      )}

      {!validationState.validating && !validationState.valid && validationState.error && (
        <div className="validation-message error">
          <span>⚠</span>
          <span>{validationState.error}</span>
        </div>
      )}

      {!validationState.validating && validationState.valid && value && (
        <div className="validation-message success">
          <span>✓</span>
          <span>Valid directory</span>
        </div>
      )}
    </div>
  );
};
