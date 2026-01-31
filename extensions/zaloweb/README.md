# @clawdbot/zaloweb

Zalo Web channel plugin for Moltbot - integrates Zalo via Electron BrowserView.

## Overview

This plugin embeds `chat.zalo.me` in an Electron BrowserView, allowing Moltbot to:
- Receive messages from all your Zalo conversations
- Send messages on your behalf
- Use your existing Zalo session (no separate login needed)

## Requirements

- **Moltbot Desktop App** (Electron) - This plugin requires the desktop app
- Zalo account

## How It Works

1. Opens a BrowserView with `chat.zalo.me`
2. You login with QR code (one-time)
3. Injects script to intercept incoming messages
4. Forwards messages to Moltbot Gateway for processing
5. Agent responses are sent back via injected script

## Installation

```bash
moltbot plugins install @clawdbot/zaloweb
```

Or during onboarding, select "Zalo Web" from the channel list.

## Configuration

```json5
{
  channels: {
    zaloweb: {
      enabled: true,
      dmPolicy: "pairing",
      // Optional: auto-reply settings
      autoReply: true,
      // Optional: specific conversations to monitor
      allowFrom: ["user_id_1", "group_id_2"]
    }
  }
}
```

## Usage

1. Start Moltbot Desktop
2. Go to Channels → Zalo Web → Enable
3. Click "Open Zalo Web" to login via QR if not logged in
4. Messages will flow through Moltbot

## Comparison with Other Zalo Integrations

| Feature | zaloweb | zalouser | zalo (OA) |
|---------|---------|----------|-----------|
| Login | QR in Electron | QR via CLI | Bot Token |
| Session conflict | No (IS the web client) | Yes (separate session) | N/A |
| Requires | Desktop app | zca-cli | OA account |
| All conversations | ✅ | ✅ | ❌ (bot only) |

## Notes

- This replaces your Zalo Web session on PC (Zalo only allows one web session)
- The Electron app becomes your Zalo Web client
- Mobile app is not affected
