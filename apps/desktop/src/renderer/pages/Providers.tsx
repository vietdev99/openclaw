import React, { useState, useEffect } from 'react';
import ProviderList from '../components/ProviderList';
import ProviderWizard from '../components/ProviderWizard';

interface ProviderConfig {
  baseUrl: string;
  api: 'anthropic-messages' | 'openai-completions' | 'google-genai';
  apiKey?: string;
  apiKeySource?: 'env' | 'direct';
  models: {
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
  }[];
}

function Providers() {
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [currentModel, setCurrentModel] = useState<{ provider?: string; model?: string }>({});
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersData, currentModelData, path] = await Promise.all([
        window.electronAPI.config.getProviders(),
        window.electronAPI.config.getCurrentModel(),
        window.electronAPI.config.getPath(),
      ]);
      setProviders(providersData || {});
      setCurrentModel(currentModelData || {});
      setConfigPath(path || '');
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowWizard(true);
  };

  const handleEditProvider = (name: string) => {
    setEditingProvider(name);
    setShowWizard(true);
  };

  const handleDeleteProvider = async (name: string) => {
    if (!confirm(`Delete provider "${name}"?`)) return;

    try {
      const updatedProviders = await window.electronAPI.config.deleteProvider(name);
      setProviders(updatedProviders || {});

      // Reload current model in case it was deleted
      const currentModelData = await window.electronAPI.config.getCurrentModel();
      setCurrentModel(currentModelData || {});
    } catch (err) {
      console.error('Failed to delete provider:', err);
      alert('Failed to delete provider');
    }
  };

  const handleSetActive = async (providerName: string, modelId: string) => {
    try {
      const result = await window.electronAPI.config.setCurrentModel(providerName, modelId);
      setCurrentModel(result || {});
    } catch (err) {
      console.error('Failed to set active model:', err);
      alert('Failed to set active model');
    }
  };

  const handleWizardComplete = async (name: string, config: ProviderConfig) => {
    try {
      if (editingProvider) {
        await window.electronAPI.config.updateProvider(name, config);
      } else {
        await window.electronAPI.config.addProvider(name, config);
      }
      await loadData();
      setShowWizard(false);
      setEditingProvider(null);
    } catch (err) {
      console.error('Failed to save provider:', err);
      alert('Failed to save provider');
    }
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingProvider(null);
  };

  if (loading) {
    return (
      <div className="providers loading">
        <div className="spinner"></div>
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="providers">
      <div className="providers-header">
        <h1>Providers</h1>
        <button className="btn btn-primary" onClick={handleAddProvider}>
          + Add Provider
        </button>
      </div>

      <div className="config-path">
        Config: <code>{configPath}</code>
      </div>

      <ProviderList
        providers={providers}
        currentModel={currentModel}
        onEdit={handleEditProvider}
        onDelete={handleDeleteProvider}
        onSetActive={handleSetActive}
      />

      {showWizard && (
        <ProviderWizard
          editingProvider={editingProvider}
          existingConfig={editingProvider ? providers[editingProvider] : undefined}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
    </div>
  );
}

export default Providers;
