import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ZaloWeb from './pages/ZaloWeb';
import Setup from './pages/Setup';
import { DashboardIcon, SettingsIcon, ZaloIcon, RobotIcon } from './components/BrandIcons';

type TabId = 'dashboard' | 'zaloweb' | 'settings';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showSetup, setShowSetup] = useState<boolean | null>(null);
  const [zaloWebEnabled, setZaloWebEnabled] = useState(false);

  // Function to reload config state - can be called from Settings
  const reloadConfig = useCallback(async () => {
    try {
      const fullConfig = await window.electronAPI.config.getFullConfig() as any;

      // Check if zaloweb extension is enabled (if config section exists, it's considered enabled)
      const zaloEnabled = !!fullConfig?.channels?.zaloweb ||
                          fullConfig?.plugins?.entries?.zaloweb?.enabled === true;
      setZaloWebEnabled(zaloEnabled);
    } catch (err) {
      console.error('Failed to reload config:', err);
    }
  }, []);

  useEffect(() => {
    // Check if first-time setup is needed
    checkFirstTimeSetup();
  }, []);

  const checkFirstTimeSetup = async () => {
    try {
      const fullConfig = await window.electronAPI.config.getFullConfig() as any;
      const providers = await window.electronAPI.config.getProviders();
      const authProfiles = await window.electronAPI.config.getAuthProfiles();

      // Check if we have any provider configured
      const hasProvider = Object.keys(providers).length > 0 ||
                          Object.keys(authProfiles).length > 0 ||
                          !!fullConfig?.agents?.defaults?.model?.primary;

      // Check if zaloweb extension is enabled (if config section exists, it's considered enabled)
      const zaloEnabled = !!fullConfig?.channels?.zaloweb ||
                          fullConfig?.plugins?.entries?.zaloweb?.enabled === true;
      setZaloWebEnabled(zaloEnabled);

      // Show setup if no provider configured
      setShowSetup(!hasProvider);
    } catch (err) {
      console.error('Failed to check setup state:', err);
      setShowSetup(false); // Default to not showing setup on error
    }
  };

  // Build tabs list based on enabled extensions
  const tabs = useMemo(() => {
    const allTabs: TabConfig[] = [
      { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon size={20} /> },
    ];

    // Add Zalo Web tab if enabled
    if (zaloWebEnabled) {
      allTabs.push({ id: 'zaloweb', label: 'Zalo Web', icon: <ZaloIcon size={20} /> });
    }

    // Settings is always last
    allTabs.push({ id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> });

    return allTabs;
  }, [zaloWebEnabled]);

  // If current tab is removed (e.g., zaloweb disabled), switch to dashboard
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [tabs, activeTab]);

  const handleSetupComplete = () => {
    setShowSetup(false);
  };

  const handleReinitSetup = () => {
    setShowSetup(true);
  };

  // Show loading while checking
  if (showSetup === null) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
        <style>{`
          .app-loading {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: var(--bg-primary, #1a1a2e);
            color: var(--text-secondary, #aaa);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border-color, #2a3a5a);
            border-top-color: var(--accent-primary, #4CAF50);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show setup wizard for first-time users
  if (showSetup) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'zaloweb':
        return <ZaloWeb />;
      case 'settings':
        return <Settings onConfigChange={reloadConfig} onReinitSetup={handleReinitSetup} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <span className="logo-icon"><RobotIcon size={28} /></span>
          <span className="logo-text">Clawdbot</span>
        </div>

        <div className="nav-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="version">v1.0.0</div>
        </div>
      </nav>

      <main className="content">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default App;
