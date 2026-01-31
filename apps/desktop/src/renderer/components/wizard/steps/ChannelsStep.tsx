import React from 'react';
import { ChannelMultiSelect, type Channel, type ChannelConfig } from '../ChannelMultiSelect';
import {
  TelegramIcon,
  DiscordIcon,
  WhatsAppIcon,
  ZaloIcon,
  SlackIcon,
  SignalIcon,
  IMessageIcon,
  MatrixIcon,
  TeamsIcon,
  MattermostIcon,
  BlueBubblesIcon,
  GoogleIcon,
} from '../../BrandIcons';

export interface ChannelsStepProps {
  selected: string[];
  configs: Record<string, ChannelConfig>;
  onChange: (channelId: string, enabled: boolean, config?: ChannelConfig) => void;
}

export const ChannelsStep: React.FC<ChannelsStepProps> = ({ selected, configs, onChange }) => {
  const channels: Channel[] = [
    // Core channels (from registry.ts CHAT_CHANNEL_ORDER)
    {
      id: 'telegram',
      name: 'Telegram',
      icon: <TelegramIcon size={32} />,
      description: 'Simplest way to get started — register a bot with @BotFather',
      requiresConfig: true,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: <WhatsAppIcon size={32} />,
      description: 'Works with your own number; recommend separate phone + eSIM',
      requiresConfig: false,
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: <DiscordIcon size={32} />,
      description: 'Very well supported right now',
      requiresConfig: true,
    },
    {
      id: 'googlechat',
      name: 'Google Chat',
      icon: <GoogleIcon size={32} />,
      description: 'Google Workspace Chat app with HTTP webhook',
      requiresConfig: true,
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: <SlackIcon size={32} />,
      description: 'Supported (Socket Mode)',
      requiresConfig: true,
    },
    {
      id: 'signal',
      name: 'Signal',
      icon: <SignalIcon size={32} />,
      description: 'signal-cli linked device; more setup required',
      requiresConfig: true,
    },
    {
      id: 'imessage',
      name: 'iMessage',
      icon: <IMessageIcon size={32} />,
      description: 'Work in progress',
      requiresConfig: true,
    },

    // Zalo Family
    {
      id: 'zaloweb',
      name: 'Zalo Web',
      icon: <ZaloIcon size={32} />,
      description: 'Zalo Web via Electron integration (Recommended)',
      requiresConfig: false,
    },
    {
      id: 'zalo',
      name: 'Zalo OA',
      icon: <ZaloIcon size={32} />,
      description: 'Zalo Official Account (Requires Business License)',
      requiresConfig: true,
    },
    {
      id: 'zalouser',
      name: 'Zalo User (CLI)',
      icon: <ZaloIcon size={32} />,
      description: 'Experimental CLI integration for personal accounts',
      requiresConfig: true,
    },

    // Plugin channels
    {
      id: 'matrix',
      name: 'Matrix',
      icon: <MatrixIcon size={32} />,
      description: 'Decentralized chat protocol',
      requiresConfig: true,
    },
    {
      id: 'msteams',
      name: 'Microsoft Teams',
      icon: <TeamsIcon size={32} />,
      description: 'Enterprise chat platform',
      requiresConfig: true,
    },
    {
      id: 'mattermost',
      name: 'Mattermost',
      icon: <MattermostIcon size={32} />,
      description: 'Open-source team collaboration',
      requiresConfig: true,
    },
    {
      id: 'bluebubbles',
      name: 'BlueBubbles',
      icon: <BlueBubblesIcon size={32} />,
      description: 'iMessage server for Android/Windows',
      requiresConfig: true,
    },
  ];

  return (
    <div className="step-card channels-step">
      <h2>Messaging Channels</h2>
      <p>
        Select and configure your messaging platforms.
      </p>

      <ChannelMultiSelect
        channels={channels}
        selected={selected}
        configs={configs}
        onChange={onChange}
      />
    </div>
  );
};
