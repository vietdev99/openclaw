import React, { useState, useEffect } from 'react';
import {
  TelegramIcon,
  WhatsAppIcon,
  DiscordIcon,
  SlackIcon,
  SignalIcon,
  IMessageIcon,
  ZaloIcon,
  MatrixIcon,
  MattermostIcon,
  TeamsIcon,
  BlueBubblesIcon,
  GoogleIcon,
} from '../components/BrandIcons';

// Channel icon mapping
const ChannelIcons: Record<string, React.ReactNode> = {
  telegram: <TelegramIcon size={24} />,
  whatsapp: <WhatsAppIcon size={24} />,
  discord: <DiscordIcon size={24} />,
  googlechat: <GoogleIcon size={24} />,
  slack: <SlackIcon size={24} />,
  signal: <SignalIcon size={24} />,
  imessage: <IMessageIcon size={24} />,
  zaloweb: <ZaloIcon size={24} />,
  zalo: <ZaloIcon size={24} />,
  zalouser: <ZaloIcon size={24} />,
  matrix: <MatrixIcon size={24} />,
  mattermost: <MattermostIcon size={24} />,
  teams: <TeamsIcon size={24} />,
  bluebubbles: <BlueBubblesIcon size={24} />,
};

// Core channels that are always available
const CORE_CHANNELS = [
  { id: 'telegram', label: 'Telegram', description: 'Telegram Bot API' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp Web (QR link)' },
  { id: 'discord', label: 'Discord', description: 'Discord Bot API' },
  { id: 'googlechat', label: 'Google Chat', description: 'Google Chat API' },
  { id: 'slack', label: 'Slack', description: 'Slack (Socket Mode)' },
  { id: 'signal', label: 'Signal', description: 'Signal (signal-cli)' },
  { id: 'imessage', label: 'iMessage', description: 'iMessage (macOS only)' },
];

// Extension channels
const EXTENSION_CHANNELS = [
  { id: 'zaloweb', label: 'Zalo Web', description: 'Zalo Web (Embedded Browser)' },
  { id: 'zalo', label: 'Zalo OA', description: 'Zalo Official Account' },
  { id: 'zalouser', label: 'Zalo User', description: 'Zalo User Account (CLI)' },
  { id: 'matrix', label: 'Matrix', description: 'Matrix/Element' },
  { id: 'mattermost', label: 'Mattermost', description: 'Mattermost Bot' },
  { id: 'teams', label: 'MS Teams', description: 'Microsoft Teams' },
  { id: 'bluebubbles', label: 'BlueBubbles', description: 'BlueBubbles (iOS)' },
];

type ChannelStatus = 'running' | 'configured' | 'disabled' | 'not-configured';

interface ChannelConfig {
  enabled?: boolean;
  token?: string;
  botToken?: string;
  dmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
  streamMode?: 'off' | 'partial' | 'block';
  allowFrom?: string[];
  [key: string]: unknown;
}

interface ChannelInfo {
  id: string;
  label: string;
  description: string;
  status: ChannelStatus;
  config?: ChannelConfig;
}

interface ChannelsProps {
  onConfigSave?: () => void;
}

function Channels({ onConfigSave }: ChannelsProps = {}) {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const configuredChannels = await window.electronAPI.config.getChannels();

      // Merge core channels with their config status
      const coreWithStatus = CORE_CHANNELS.map((ch) => {
        const config = configuredChannels[ch.id];
        let status: ChannelStatus = 'not-configured';

        if (config) {
          if (config.enabled === false) {
            status = 'disabled';
          } else if (config.token || config.botToken) {
            status = 'configured';
          } else {
            status = 'configured';
          }
        }

        return { ...ch, status, config };
      });

      // Extension channels
      const extensionWithStatus = EXTENSION_CHANNELS.map((ch) => {
        const config = configuredChannels[ch.id];
        let status: ChannelStatus = 'not-configured';

        if (config) {
          if (config.enabled === false) {
            status = 'disabled';
          } else {
            status = 'configured';
          }
        }

        return { ...ch, status, config };
      });

      setChannels([...coreWithStatus, ...extensionWithStatus]);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureChannel = (channel: ChannelInfo) => {
    setSelectedChannel(channel);
    setIsModalOpen(true);
  };

  const handleSaveChannel = async (channelId: string, config: ChannelConfig) => {
    try {
      await window.electronAPI.config.updateChannel(channelId, config);
      await loadChannels();
      setIsModalOpen(false);
      setSelectedChannel(null);
      // Notify parent that config changed (e.g., to update sidebar menu)
      onConfigSave?.();
    } catch (error) {
      console.error('Failed to save channel config:', error);
    }
  };

  const handleToggleChannel = async (channel: ChannelInfo) => {
    const newConfig = {
      ...channel.config,
      enabled: !(channel.config?.enabled ?? true),
    };
    await handleSaveChannel(channel.id, newConfig);
  };

  const getStatusBadge = (status: ChannelStatus) => {
    switch (status) {
      case 'running':
        return <span className="status-badge running">Running</span>;
      case 'configured':
        return <span className="status-badge configured">Configured</span>;
      case 'disabled':
        return <span className="status-badge disabled">Disabled</span>;
      default:
        return <span className="status-badge not-configured">Not Configured</span>;
    }
  };

  if (loading) {
    return (
      <div className="page channels-page">
        <div className="page-header">
          <h1>Channels</h1>
        </div>
        <div className="loading">Loading channels...</div>
      </div>
    );
  }

  const coreChannels = channels.filter((ch) =>
    CORE_CHANNELS.some((core) => core.id === ch.id)
  );
  const extensionChannels = channels.filter((ch) =>
    EXTENSION_CHANNELS.some((ext) => ext.id === ch.id)
  );

  return (
    <div className="page channels-page">
      <div className="page-header">
        <h1>Channels</h1>
        <p className="page-description">
          Configure chat channels for your bot. Each channel connects to a different
          messaging platform.
        </p>
      </div>

      <div className="channels-section">
        <h2>Core Channels</h2>
        <div className="channel-grid">
          {coreChannels.map((channel) => (
            <div key={channel.id} className={`channel-card ${channel.status}`}>
              <div className="channel-header">
                <span className="channel-icon">{ChannelIcons[channel.id]}</span>
                <div className="channel-info">
                  <h3>{channel.label}</h3>
                  <p>{channel.description}</p>
                </div>
                {getStatusBadge(channel.status)}
              </div>

              <div className="channel-details">
                {channel.config?.dmPolicy && (
                  <div className="detail-row">
                    <span className="detail-label">DM Policy:</span>
                    <span className="detail-value">{channel.config.dmPolicy}</span>
                  </div>
                )}
                {channel.config?.streamMode && (
                  <div className="detail-row">
                    <span className="detail-label">Streaming:</span>
                    <span className="detail-value">{channel.config.streamMode}</span>
                  </div>
                )}
              </div>

              <div className="channel-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleConfigureChannel(channel)}
                >
                  Configure
                </button>
                {channel.status !== 'not-configured' && (
                  <button
                    className={`btn ${channel.config?.enabled !== false ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => handleToggleChannel(channel)}
                  >
                    {channel.config?.enabled !== false ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="channels-section">
        <h2>Extension Channels</h2>
        <div className="channel-grid">
          {extensionChannels.map((channel) => (
            <div key={channel.id} className={`channel-card ${channel.status}`}>
              <div className="channel-header">
                <span className="channel-icon">{ChannelIcons[channel.id]}</span>
                <div className="channel-info">
                  <h3>{channel.label}</h3>
                  <p>{channel.description}</p>
                </div>
                {getStatusBadge(channel.status)}
              </div>

              <div className="channel-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleConfigureChannel(channel)}
                >
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && selectedChannel && (
        <ChannelConfigModal
          channel={selectedChannel}
          onSave={handleSaveChannel}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedChannel(null);
          }}
        />
      )}
    </div>
  );
}

// Channel Configuration Modal
function ChannelConfigModal({
  channel,
  onSave,
  onClose,
}: {
  channel: ChannelInfo;
  onSave: (channelId: string, config: ChannelConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<ChannelConfig>(channel.config || {});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'groups' | 'advanced'>('general');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(channel.id, config);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateNestedConfig = (parent: string, key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [parent]: { ...(prev[parent] as Record<string, unknown> || {}), [key]: value },
    }));
  };

  // Check if channel has tabs
  const showTabs = ['whatsapp', 'discord', 'telegram'].includes(channel.id);

  // WhatsApp-specific fields
  const renderWhatsAppFields = () => (
    <>
      {activeTab === 'general' && (
        <>
          <div className="form-group">
            <label>Self Chat Mode</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={config.selfChatMode === true}
                onChange={(e) => updateConfig('selfChatMode', e.target.checked)}
              />
              <span className="toggle-label">
                {config.selfChatMode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="form-help">Chat with yourself (testing)</p>
          </div>

          <div className="form-group">
            <label>Send Read Receipts</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={config.sendReadReceipts !== false}
                onChange={(e) => updateConfig('sendReadReceipts', e.target.checked)}
              />
              <span className="toggle-label">
                {config.sendReadReceipts !== false ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>Message Prefix</label>
            <input
              type="text"
              value={(config.messagePrefix as string) || ''}
              onChange={(e) => updateConfig('messagePrefix', e.target.value)}
              placeholder="Optional prefix for messages"
            />
          </div>

          <div className="form-group">
            <label>Auth Directory</label>
            <input
              type="text"
              value={(config.authDir as string) || ''}
              onChange={(e) => updateConfig('authDir', e.target.value)}
              placeholder="Custom Baileys auth directory"
            />
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <>
          <div className="form-group">
            <label>Group Policy</label>
            <select
              value={(config.groupPolicy as string) || 'allowlist'}
              onChange={(e) => updateConfig('groupPolicy', e.target.value)}
            >
              <option value="allowlist">Allowlist</option>
              <option value="open">Open</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="form-group">
            <label>Group Allow From</label>
            <textarea
              value={((config.groupAllowFrom as string[]) || []).join('\n')}
              onChange={(e) =>
                updateConfig('groupAllowFrom', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="Group JIDs (123456789@g.us)"
              rows={4}
            />
          </div>
        </>
      )}

      {activeTab === 'advanced' && (
        <>
          <div className="form-group">
            <label>History Limit</label>
            <input
              type="number"
              value={(config.historyLimit as number) || 0}
              onChange={(e) => updateConfig('historyLimit', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Text Chunk Limit</label>
            <input
              type="number"
              value={(config.textChunkLimit as number) || 4096}
              onChange={(e) => updateConfig('textChunkLimit', parseInt(e.target.value) || 4096)}
              min={100}
            />
          </div>

          <div className="form-group">
            <label>Media Max MB</label>
            <input
              type="number"
              value={(config.mediaMaxMb as number) || 50}
              onChange={(e) => updateConfig('mediaMaxMb', parseInt(e.target.value) || 50)}
              min={1}
            />
          </div>

          <div className="form-group">
            <label>Debounce (ms)</label>
            <input
              type="number"
              value={(config.debounceMs as number) || 0}
              onChange={(e) => updateConfig('debounceMs', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Block Streaming</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={config.blockStreaming === true}
                onChange={(e) => updateConfig('blockStreaming', e.target.checked)}
              />
            </div>
          </div>

          <h4>Ack Reaction</h4>
          <div className="form-group">
            <label>Emoji</label>
            <input
              type="text"
              value={(config.ackReaction as Record<string, unknown>)?.emoji as string || ''}
              onChange={(e) => updateNestedConfig('ackReaction', 'emoji', e.target.value)}
              placeholder="e.g., 👀"
            />
          </div>
          <div className="form-group">
            <label>Group React</label>
            <select
              value={(config.ackReaction as Record<string, unknown>)?.group as string || 'mentions'}
              onChange={(e) => updateNestedConfig('ackReaction', 'group', e.target.value)}
            >
              <option value="always">Always</option>
              <option value="mentions">On Mentions</option>
              <option value="never">Never</option>
            </select>
          </div>
        </>
      )}
    </>
  );

  // Discord-specific fields
  const renderDiscordFields = () => (
    <>
      {activeTab === 'general' && (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input
              type="password"
              value={(config.token as string) || ''}
              onChange={(e) => updateConfig('token', e.target.value)}
              placeholder="Discord bot token"
            />
          </div>

          <div className="form-group">
            <label>Allow Bots</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={config.allowBots === true}
                onChange={(e) => updateConfig('allowBots', e.target.checked)}
              />
              <span className="toggle-label">
                {config.allowBots ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <>
          <div className="form-group">
            <label>Group Policy</label>
            <select
              value={(config.groupPolicy as string) || 'allowlist'}
              onChange={(e) => updateConfig('groupPolicy', e.target.value)}
            >
              <option value="allowlist">Allowlist</option>
              <option value="open">Open</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <h4>DM Settings</h4>
          <div className="form-group">
            <label>DM Enabled</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={(config.dm as Record<string, unknown>)?.enabled !== false}
                onChange={(e) => updateNestedConfig('dm', 'enabled', e.target.checked)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>DM Policy</label>
            <select
              value={(config.dm as Record<string, unknown>)?.policy as string || 'pairing'}
              onChange={(e) => updateNestedConfig('dm', 'policy', e.target.value)}
            >
              <option value="pairing">Pairing</option>
              <option value="allowlist">Allowlist</option>
              <option value="open">Open</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="form-group">
            <label>Group DMs</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={(config.dm as Record<string, unknown>)?.groupEnabled === true}
                onChange={(e) => updateNestedConfig('dm', 'groupEnabled', e.target.checked)}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'advanced' && (
        <>
          <div className="form-group">
            <label>History Limit</label>
            <input
              type="number"
              value={(config.historyLimit as number) || 0}
              onChange={(e) => updateConfig('historyLimit', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Text Chunk Limit</label>
            <input
              type="number"
              value={(config.textChunkLimit as number) || 2000}
              onChange={(e) => updateConfig('textChunkLimit', parseInt(e.target.value) || 2000)}
              min={100}
            />
          </div>

          <div className="form-group">
            <label>Block Streaming</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={config.blockStreaming === true}
                onChange={(e) => updateConfig('blockStreaming', e.target.checked)}
              />
            </div>
          </div>

          <h4>Intents</h4>
          <div className="form-group">
            <label>Presence</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={(config.intents as Record<string, unknown>)?.presence === true}
                onChange={(e) => updateNestedConfig('intents', 'presence', e.target.checked)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Guild Members</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={(config.intents as Record<string, unknown>)?.guildMembers === true}
                onChange={(e) => updateNestedConfig('intents', 'guildMembers', e.target.checked)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );

  // Telegram-specific fields
  const renderTelegramFields = () => (
    <>
      {activeTab === 'general' && (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input
              type="password"
              value={(config.botToken as string) || ''}
              onChange={(e) => updateConfig('botToken', e.target.value)}
              placeholder="Token from @BotFather"
            />
          </div>

          <div className="form-group">
            <label>Stream Mode</label>
            <select
              value={(config.streamMode as string) || 'partial'}
              onChange={(e) => updateConfig('streamMode', e.target.value)}
            >
              <option value="off">Off</option>
              <option value="partial">Partial</option>
              <option value="block">Block</option>
            </select>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <>
          <div className="form-group">
            <label>Group Policy</label>
            <select
              value={(config.groupPolicy as string) || 'allowlist'}
              onChange={(e) => updateConfig('groupPolicy', e.target.value)}
            >
              <option value="allowlist">Allowlist</option>
              <option value="open">Open</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="form-group">
            <label>Group Allow From</label>
            <textarea
              value={((config.groupAllowFrom as (string | number)[]) || []).map(String).join('\n')}
              onChange={(e) =>
                updateConfig('groupAllowFrom', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="Chat IDs, one per line"
              rows={4}
            />
          </div>
        </>
      )}

      {activeTab === 'advanced' && (
        <>
          <div className="form-group">
            <label>History Limit</label>
            <input
              type="number"
              value={(config.historyLimit as number) || 0}
              onChange={(e) => updateConfig('historyLimit', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Timeout (sec)</label>
            <input
              type="number"
              value={(config.timeoutSeconds as number) || 30}
              onChange={(e) => updateConfig('timeoutSeconds', parseInt(e.target.value) || 30)}
              min={5}
            />
          </div>

          <div className="form-group">
            <label>Webhook URL</label>
            <input
              type="text"
              value={(config.webhookUrl as string) || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              placeholder="https://your-domain.com/webhook"
            />
          </div>

          <div className="form-group">
            <label>Proxy</label>
            <input
              type="text"
              value={(config.proxy as string) || ''}
              onChange={(e) => updateConfig('proxy', e.target.value)}
              placeholder="socks5://127.0.0.1:1080"
            />
          </div>
        </>
      )}
    </>
  );

  // Render channel-specific fields
  const renderChannelFields = () => {
    switch (channel.id) {
      case 'whatsapp':
        return renderWhatsAppFields();
      case 'discord':
        return renderDiscordFields();
      case 'telegram':
        return renderTelegramFields();
      default:
        return renderGenericFields();
    }
  };

  // Generic fields for other channels
  const renderGenericFields = () => (
    <>
      {['slack'].includes(channel.id) && (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input
              type="password"
              value={(config.botToken as string) || ''}
              onChange={(e) => updateConfig('botToken', e.target.value)}
              placeholder="xoxb-..."
            />
          </div>
          <div className="form-group">
            <label>App Token</label>
            <input
              type="password"
              value={(config.appToken as string) || ''}
              onChange={(e) => updateConfig('appToken', e.target.value)}
              placeholder="xapp-..."
            />
          </div>
        </>
      )}

      {['signal'].includes(channel.id) && (
        <>
          <div className="form-group">
            <label>Account Phone</label>
            <input
              type="text"
              value={(config.account as string) || ''}
              onChange={(e) => updateConfig('account', e.target.value)}
              placeholder="+1234567890"
            />
          </div>
          <div className="form-group">
            <label>Signal CLI Path</label>
            <input
              type="text"
              value={(config.cliPath as string) || ''}
              onChange={(e) => updateConfig('cliPath', e.target.value)}
              placeholder="/usr/local/bin/signal-cli"
            />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${showTabs ? 'modal-large' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span className="channel-icon">{ChannelIcons[channel.id]}</span>
            Configure {channel.label}
          </h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {showTabs && (
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`modal-tab ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              Groups
            </button>
            <button
              className={`modal-tab ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              Advanced
            </button>
          </div>
        )}

        <div className="modal-body">
          {/* Common fields - always show in general tab or for non-tabbed channels */}
          {(activeTab === 'general' || !showTabs) && (
            <>
              <div className="form-group">
                <label>Enabled</label>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={config.enabled !== false}
                    onChange={(e) => updateConfig('enabled', e.target.checked)}
                  />
                  <span className="toggle-label">
                    {config.enabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>DM Policy</label>
                <select
                  value={config.dmPolicy || 'pairing'}
                  onChange={(e) => updateConfig('dmPolicy', e.target.value)}
                >
                  <option value="pairing">Pairing</option>
                  <option value="allowlist">Allowlist</option>
                  <option value="open">Open</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {config.dmPolicy === 'allowlist' && (
                <div className="form-group">
                  <label>Allowed Users</label>
                  <textarea
                    value={(config.allowFrom || []).map(String).join('\n')}
                    onChange={(e) =>
                      updateConfig('allowFrom', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
                    }
                    placeholder="One per line"
                    rows={3}
                  />
                </div>
              )}
            </>
          )}

          {/* Channel-specific fields */}
          {renderChannelFields()}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Channels;
