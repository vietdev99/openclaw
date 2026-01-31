import React from 'react';
import { IconBaseProps } from 'react-icons';
import {
  SiAnthropic,
  SiGoogle,
  SiTelegram,
  SiWhatsapp,
  SiDiscord,
  SiSlack,
  SiSignal,
  SiMatrix,
  SiImessage,
  SiMattermost,
  SiZalo
} from 'react-icons/si';
import { FaRocket, FaCog, FaChartLine, FaRobot, FaCommentDots, FaMicrosoft } from 'react-icons/fa';
import { BiMessageSquareDetail } from 'react-icons/bi';

// Interface wrapper to match existing props
interface IconProps extends IconBaseProps {
  size?: number;
  color?: string;
  className?: string;
}

// Wrapper component to adapt react-icons to our interface
const IconWrapper = ({ icon: Icon, size = 20, color, className, ...props }: IconProps & { icon: React.ComponentType<IconBaseProps> }) => (
  <Icon size={size} color={color} className={className} {...props} />
);

// Anthropic Claude
export const ClaudeIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiAnthropic} {...props} />
);

// Google
export const GoogleIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiGoogle} {...props} />
);

// Telegram
export const TelegramIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiTelegram} {...props} color={props.color || '#26A5E4'} />
);

// WhatsApp
export const WhatsAppIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiWhatsapp} {...props} color={props.color || '#25D366'} />
);

// Discord
export const DiscordIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiDiscord} {...props} color={props.color || '#5865F2'} />
);

// Slack
export const SlackIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiSlack} {...props} />
);

// Signal
export const SignalIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiSignal} {...props} color={props.color || '#3A76F0'} />
);

// Matrix
export const MatrixIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiMatrix} {...props} />
);

// Microsoft Teams
export const TeamsIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaMicrosoft} {...props} color={props.color || '#6264A7'} />
);

// Apple iMessage - Using generic message icon if SiImessage not available, or specific one
export const IMessageIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiImessage} {...props} color={props.color || '#34C759'} />
);

// Mattermost
export const MattermostIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiMattermost} {...props} color={props.color || '#0058CC'} />
);

// BlueBubbles - No direct icon, using Message Square
export const BlueBubblesIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={BiMessageSquareDetail} {...props} color={props.color || '#1E90FF'} />
);

// Zalo
export const ZaloIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={SiZalo} {...props} color={props.color || '#0068FF'} />
);

// Antigravity
export const AntigravityIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaRocket} {...props} />
);

// Dashboard
export const DashboardIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaChartLine} {...props} />
);

// Settings
export const SettingsIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaCog} {...props} />
);

// Robot
export const RobotIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaRobot} {...props} />
);

// Generic Chat
export const ChatIcon: React.FC<IconProps> = (props) => (
  <IconWrapper icon={FaCommentDots} {...props} />
);

export const BrandIcons = {
  claude: ClaudeIcon,
  google: GoogleIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
  discord: DiscordIcon,
  slack: SlackIcon,
  signal: SignalIcon,
  matrix: MatrixIcon,
  teams: TeamsIcon,
  imessage: IMessageIcon,
  mattermost: MattermostIcon,
  bluebubbles: BlueBubblesIcon,
  zalo: ZaloIcon,
  antigravity: AntigravityIcon,
  dashboard: DashboardIcon,
  settings: SettingsIcon,
  robot: RobotIcon,
  chat: ChatIcon
};

export default BrandIcons;
