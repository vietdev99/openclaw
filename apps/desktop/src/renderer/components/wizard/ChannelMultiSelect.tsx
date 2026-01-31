import React, { useState, useEffect } from 'react';

export interface Channel {
  id: string;
  name: string;
  icon: React.ReactNode;
  description?: string;
  requiresConfig?: boolean;
}

export interface ChannelConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface ChannelMultiSelectProps {
  channels: Channel[];
  selected: string[];
  configs: Record<string, ChannelConfig>;
  onChange: (channelId: string, enabled: boolean, config?: ChannelConfig) => void;
}

export const ChannelMultiSelect: React.FC<ChannelMultiSelectProps> = ({
  channels,
  selected,
  configs,
  onChange,
}) => {
  // Default to first channel selected if available
  const [activeChannelId, setActiveChannelId] = useState<string | null>(channels[0]?.id || null);

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const isChannelEnabled = activeChannelId ? selected.includes(activeChannelId) : false;

  const handleToggle = (channelId: string, enabled: boolean) => {
    if (enabled) {
      // Enabling
      const defaultConfig: ChannelConfig = {
        enabled: true,
        dmPolicy: 'pairing',
        groupPolicy: 'allowlist',
      };
      onChange(channelId, true, defaultConfig);
    } else {
      // Disabling
      onChange(channelId, false);
    }
  };

  const handleConfigChange = (channelId: string, key: string, value: any) => {
    const existingConfig = configs[channelId] || { enabled: true };
    const newConfig = { ...existingConfig, [key]: value };
    onChange(channelId, true, newConfig);
  };

  return (
    <div className="channel-multi-select two-panel">
      {/* Left Panel: Channel List */}
      <div className="channel-list-panel">
        <div className="channel-list">
          {channels.map((channel) => {
            const isEnabled = selected.includes(channel.id);
            const isActive = activeChannelId === channel.id;

            return (
              <div
                key={channel.id}
                className={`channel-list-item ${isActive ? 'active' : ''} ${isEnabled ? 'enabled' : ''}`}
                onClick={() => setActiveChannelId(channel.id)}
              >
                <div className="channel-icon-small">{channel.icon}</div>
                <div className="channel-info">
                  <div className="channel-name">{channel.name}</div>
                  <div className="channel-status">
                    {isEnabled ? (
                      <span className="status-enabled">● Enabled</span>
                    ) : (
                      <span className="status-disabled">○ Disabled</span>
                    )}
                  </div>
                </div>
                <div className="channel-chevron">›</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Configuration */}
      <div className="channel-config-panel">
        {activeChannel ? (
          <div className="config-content">
            <div className="config-header-main">
              <div className="header-icon">{activeChannel.icon}</div>
              <div className="header-text">
                <h3>{activeChannel.name}</h3>
                <p>{activeChannel.description}</p>
              </div>
              <div className="header-toggle">
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id={`toggle-${activeChannel.id}`}
                    checked={isChannelEnabled}
                    onChange={(e) => handleToggle(activeChannel.id, e.target.checked)}
                  />
                  <label htmlFor={`toggle-${activeChannel.id}`}></label>
                </div>
              </div>
            </div>

            {isChannelEnabled && activeChannel.requiresConfig ? (
              <div className="config-form-container">
                {activeChannel.id === 'telegram' && (
                  <div className="form-group">
                    <label>Bot Token</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="123456:ABC-DEF..."
                      value={configs[activeChannel.id]?.botToken || ''}
                      onChange={(e) =>
                        handleConfigChange(activeChannel.id, 'botToken', e.target.value)
                      }
                    />
                    <div className="form-hint">Get this from @BotFather</div>
                  </div>
                )}

                {activeChannel.id === 'discord' && (
                  <div className="form-group">
                    <label>Bot Token</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Discord Bot Token"
                      value={configs[activeChannel.id]?.botToken || ''}
                      onChange={(e) =>
                        handleConfigChange(activeChannel.id, 'botToken', e.target.value)
                      }
                    />
                  </div>
                )}

                {/* Zalo User / Zalo OA specific fields could go here */}

                <div className="form-section-title">Policies</div>

                <div className="form-group">
                  <label>DM Policy</label>
                  <select
                    className="form-select"
                    value={configs[activeChannel.id]?.dmPolicy || 'pairing'}
                    onChange={(e) =>
                      handleConfigChange(activeChannel.id, 'dmPolicy', e.target.value)
                    }
                  >
                    <option value="pairing">Pairing - User must pair first</option>
                    <option value="allowlist">Allowlist - Only approved users</option>
                    <option value="open">Open - Anyone can message</option>
                    <option value="disabled">Disabled - No DM access</option>
                  </select>
                  <div className="form-hint">
                    {(!configs[activeChannel.id]?.dmPolicy || configs[activeChannel.id]?.dmPolicy === 'pairing') && 'Recommended: Users must request access first'}
                    {configs[activeChannel.id]?.dmPolicy === 'allowlist' && 'Only users in allowlist can send messages'}
                    {configs[activeChannel.id]?.dmPolicy === 'open' && '⚠ Warning: Anyone can send messages'}
                    {configs[activeChannel.id]?.dmPolicy === 'disabled' && 'Bot will not respond to direct messages'}
                  </div>
                </div>

                <div className="form-group">
                  <label>Group Policy</label>
                  <select
                    className="form-select"
                    value={configs[activeChannel.id]?.groupPolicy || 'allowlist'}
                    onChange={(e) =>
                      handleConfigChange(activeChannel.id, 'groupPolicy', e.target.value)
                    }
                  >
                    <option value="allowlist">Allowlist - Only approved groups</option>
                    <option value="open">Open - All groups</option>
                    <option value="disabled">Disabled - No group access</option>
                  </select>
                </div>
              </div>
            ) : isChannelEnabled ? (
              <div className="config-empty-state">
                <p>This channel is enabled and requires no further configuration.</p>
              </div>
            ) : (
              <div className="config-empty-state disabled">
                <p>Enable this channel to configure it.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="config-placeholder">
            <p>Select a channel to configure</p>
          </div>
        )}
      </div>
    </div>
  );
};
