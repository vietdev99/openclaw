import React, { useState, useEffect } from 'react';
import { ProgressStepper } from '../components/wizard/ProgressStepper';
import { WelcomeStep } from '../components/wizard/steps/WelcomeStep';
import { SecurityStep } from '../components/wizard/steps/SecurityStep';
import { WorkspaceStep } from '../components/wizard/steps/WorkspaceStep';
import { AuthProviderStep } from '../components/wizard/steps/AuthProviderStep';
import { ModelStep } from '../components/wizard/steps/ModelStep';
import { GatewayStep, type GatewayConfig } from '../components/wizard/steps/GatewayStep';
import { ChannelsStep } from '../components/wizard/steps/ChannelsStep';
import { CompleteStep, type CompleteStepData } from '../components/wizard/steps/CompleteStep';
import type { ChannelConfig } from '../components/wizard/ChannelMultiSelect';

export interface SetupProps {
  onComplete?: () => void;
}

interface WizardState {
  currentStep: number;
  totalSteps: number;
  data: {
    installMode: 'existing' | 'fresh' | null;
    securityConsent: boolean;
    workspace: string;
    authProvider: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
    authData: { apiKey?: string; baseUrl?: string };
    model: string;
    gateway: GatewayConfig;
    channels: Array<{
      id: string;
      enabled: boolean;
      config: Record<string, any>;
    }>;
  };
  errors: Record<string, string>;
  loading: boolean;
  oauthLoading: boolean;
  oauthStatus: string;
  confirmed: boolean;
}

export const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    totalSteps: 8,
    data: {
      installMode: null,
      securityConsent: false,
      workspace: '',
      authProvider: 'skip',
      authData: {},
      model: 'claude-sonnet-4-5-20251101',
      gateway: {
        mode: 'local',
        port: 18789,
        bind: 'localhost',
        auth: 'token',
      },
      channels: [],
    },
    errors: {},
    loading: false,
    oauthLoading: false,
    oauthStatus: '',
    confirmed: false,
  });

  // Load default workspace path on mount
  useEffect(() => {
    const loadDefaultWorkspacePath = async () => {
      try {
        const result = await window.electronAPI.setup.getDefaultWorkspacePath();
        if (result.success && result.path) {
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, workspace: result.path },
          }));
        }
      } catch (error) {
        console.error('Failed to load default workspace path:', error);
      }
    };

    loadDefaultWorkspacePath();
  }, []);

  // Step navigation
  const goToStep = (step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  const nextStep = async () => {
    // Validation before moving to next step
    const { currentStep, data } = state;

    if (currentStep === 1 && !data.installMode) {
      return; // Must select install mode
    }

    if (currentStep === 2 && !data.securityConsent) {
      return; // Must consent to security notice
    }

    if (currentStep === 3 && !data.workspace) {
      return; // Must select workspace
    }

    if (currentStep < state.totalSteps) {
      goToStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (state.currentStep > 1) {
      goToStep(state.currentStep - 1);
    }
  };

  // Step 1: Welcome - Handle install mode selection
  const handleWelcome = async (mode: 'existing' | 'fresh') => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      if (mode === 'existing') {
        // Skip to complete step
        setState((prev) => ({
          ...prev,
          data: { ...prev.data, installMode: mode },
          currentStep: 8,
          loading: false,
        }));
      } else if (mode === 'fresh') {
        // Backup and reset config
        const result = await window.electronAPI.setup.backupAndReset();

        if (result.success) {
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, installMode: mode },
            currentStep: 2,
            loading: false,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            errors: { backup: result.error || 'Backup failed' },
            loading: false,
          }));
        }
      }
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        errors: { backup: error.message },
        loading: false,
      }));
    }
  };

  // Step 2: Security consent
  const handleSecurityConsent = (consent: boolean) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, securityConsent: consent },
    }));
  };

  // Step 3: Workspace validation
  const handleWorkspace = (workspace: string) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, workspace },
    }));
  };

  const validateWorkspace = async (workspacePath: string) => {
    const result = await window.electronAPI.setup.validateWorkspace(workspacePath);

    if (!result.writable) {
      return { valid: false, error: 'Directory is not writable' };
    }

    return { valid: result.valid || !result.exists, error: result.error };
  };

  // Step 4: Auth provider
  const handleAuthProvider = (value: {
    provider: 'anthropic' | 'google' | 'antigravity' | 'custom' | 'skip';
    apiKey?: string;
    baseUrl?: string;
  }) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        authProvider: value.provider,
        authData: {
          apiKey: value.apiKey,
          baseUrl: value.baseUrl,
        },
      },
    }));
  };

  const handleOAuth = async (provider: string) => {
    setState((prev) => ({
      ...prev,
      oauthLoading: true,
      oauthStatus: 'Opening authentication terminal...'
    }));

    try {
      const result = await window.electronAPI.setup.authOAuth(provider);

      if (!result.success) {
        throw new Error(result.error || 'Failed to open terminal');
      }

      // Update auth provider state
      setState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          authProvider: provider as 'anthropic' | 'google' | 'antigravity',
        },
        oauthLoading: false,
        oauthStatus: 'Terminal opened. Complete authentication in the terminal window.',
      }));

      // Clear status after 5 seconds
      setTimeout(() => {
        setState((prev) => ({ ...prev, oauthStatus: '' }));
      }, 5000);
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        errors: { oauth: error.message },
        oauthLoading: false,
        oauthStatus: '',
      }));
    }
  };

  // Step 5: Model selection
  const handleModel = (model: string) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, model },
    }));
  };

  // Step 6: Gateway configuration
  const handleGateway = (config: GatewayConfig) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, gateway: config },
    }));
  };

  // Step 7: Channels configuration
  const handleChannels = (channelId: string, enabled: boolean, config?: ChannelConfig) => {
    setState((prev) => {
      const channels = [...prev.data.channels];
      const index = channels.findIndex((c) => c.id === channelId);

      if (enabled) {
        if (index >= 0) {
          channels[index] = { id: channelId, enabled: true, config: config || {} };
        } else {
          channels.push({ id: channelId, enabled: true, config: config || {} });
        }
      } else {
        if (index >= 0) {
          channels.splice(index, 1);
        }
      }

      return {
        ...prev,
        data: { ...prev.data, channels },
      };
    });
  };

  // Step 8: Confirm - Save configuration
  const handleConfirm = async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      // Save all configuration
      const { data } = state;

      // 1. Save model config
      await window.electronAPI.config.updateAgentsDefaults({
        model: {
          primary: data.model,
        },
      });

      // 2. Save gateway config with correct format
      // Map bind values to schema-compliant values
      const bindMap: Record<string, string> = {
        'localhost': 'loopback',
        'all-interfaces': 'lan',
        'tailscale': 'tailnet',
      };

      const gatewayConfig: any = {
        port: data.gateway.port,
        mode: data.gateway.mode === 'service' ? 'local' : 'local', // Always local for now
        bind: bindMap[data.gateway.bind] || 'loopback',
      };

      // Auth must be object format
      if (data.gateway.auth === 'token') {
        gatewayConfig.auth = {
          mode: 'token',
          token: data.gateway.token || '',
        };
      } else if (data.gateway.auth === 'password') {
        gatewayConfig.auth = {
          mode: 'password',
          password: data.gateway.password || '',
        };
      }

      const config = await window.electronAPI.config.getFullConfig() as any;
      config.gateway = { ...config.gateway, ...gatewayConfig };
      await window.electronAPI.config.updateAgentsDefaults({}); // Trigger save

      // 3. Install gateway service if needed
      if (data.gateway.mode === 'service') {
        const result = await window.electronAPI.setup.installGatewayService(data.gateway);
        if (!result.success) {
          console.error('Failed to install gateway service:', result.error);
        }
      }

      // 4. Save channel configurations
      for (const channel of data.channels) {
        if (channel.enabled) {
          const channelConfig: any = {
            enabled: true,
            ...channel.config,
          };

          // Fix: If dmPolicy is "open", must include allowFrom: ["*"]
          if (channelConfig.dmPolicy === 'open' && !channelConfig.allowFrom) {
            channelConfig.allowFrom = ['*'];
          }

          await window.electronAPI.config.updateChannel(channel.id, channelConfig);
        }
      }

      // Mark as confirmed
      setState((prev) => ({ ...prev, loading: false, confirmed: true }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        errors: { complete: error.message },
        loading: false,
      }));
    }
  };

  // Step 8: Quick Actions - After confirmation
  const handleQuickAction = async (action: 'start-gateway' | 'dashboard' | 'skills') => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      if (action === 'start-gateway') {
        await window.electronAPI.gateway.start();
      }

      // Complete setup
      setState((prev) => ({ ...prev, loading: false }));

      if (onComplete) {
        onComplete();
      }
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        errors: { action: error.message },
        loading: false,
      }));
    }
  };

  // Render current step
  const renderStep = () => {
    const { currentStep, data, loading, oauthLoading } = state;

    switch (currentStep) {
      case 1:
        return <WelcomeStep onSelect={handleWelcome} loading={loading} />;

      case 2:
        return (
          <SecurityStep value={data.securityConsent} onChange={handleSecurityConsent} />
        );

      case 3:
        return (
          <WorkspaceStep
            value={data.workspace}
            onChange={handleWorkspace}
            validate={validateWorkspace}
          />
        );

      case 4:
        return (
          <AuthProviderStep
            value={{
              provider: data.authProvider,
              apiKey: data.authData.apiKey,
              baseUrl: data.authData.baseUrl,
            }}
            onChange={handleAuthProvider}
            onOAuth={handleOAuth}
            oauthLoading={oauthLoading}
            oauthStatus={state.oauthStatus}
          />
        );

      case 5:
        return (
          <ModelStep
            value={data.model}
            onChange={handleModel}
            provider={data.authProvider}
            customModelInput={data.authProvider === 'custom'}
          />
        );

      case 6:
        return <GatewayStep value={data.gateway} onChange={handleGateway} />;

      case 7:
        const selectedChannelIds = data.channels.filter((c) => c.enabled).map((c) => c.id);
        const channelConfigs = data.channels.reduce((acc, c) => {
          acc[c.id] = { enabled: c.enabled, ...c.config };
          return acc;
        }, {} as Record<string, ChannelConfig>);

        return (
          <ChannelsStep
            selected={selectedChannelIds}
            configs={channelConfigs}
            onChange={handleChannels}
          />
        );

      case 8:
        const completeData: CompleteStepData = {
          installMode: data.installMode,
          workspace: data.workspace,
          authProvider: data.authProvider,
          model: data.model,
          gateway: {
            mode: data.gateway.mode,
            port: data.gateway.port,
            bind: data.gateway.bind,
          },
          channels: data.channels,
        };

        return (
          <CompleteStep
            data={completeData}
            onConfirm={handleConfirm}
            onBack={prevStep}
            onStartGateway={() => handleQuickAction('start-gateway')}
            onOpenDashboard={() => handleQuickAction('dashboard')}
            onConfigureSkills={() => handleQuickAction('skills')}
            loading={loading}
            confirmed={state.confirmed}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="setup-wizard">
      <ProgressStepper current={state.currentStep} total={state.totalSteps} />

      <div className="wizard-content">{renderStep()}</div>

      {state.currentStep > 1 && state.currentStep < 8 && (
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={state.loading}
          >
            ← Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={nextStep}
            disabled={state.loading || (state.currentStep === 2 && !state.data.securityConsent)}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
};

export default Setup;
