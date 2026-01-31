AGENTS.md

## External Dependencies Fixes

### 1. pi-ai Library Fix (Usage Null Check)

**Problem:** `Cannot read properties of undefined (reading 'input_tokens')` error when using proxies that don't include `usage` object in streaming events.

**Location:** `D:\Workspace\Messi\Code\pi-mono\packages\ai\src\providers\anthropic.ts`

**Fix (Line 203-206 - message_start event):**
```typescript
// Before:
output.usage.input = event.message.usage.input_tokens || 0;
output.usage.output = event.message.usage.output_tokens || 0;
output.usage.cacheRead = event.message.usage.cache_read_input_tokens || 0;
output.usage.cacheWrite = event.message.usage.cache_creation_input_tokens || 0;

// After (with optional chaining):
output.usage.input = event.message?.usage?.input_tokens || 0;
output.usage.output = event.message?.usage?.output_tokens || 0;
output.usage.cacheRead = event.message?.usage?.cache_read_input_tokens || 0;
output.usage.cacheWrite = event.message?.usage?.cache_creation_input_tokens || 0;
```

**Fix (Line 319-341 - message_delta event):**
```typescript
// Wrap entire usage handling block in null check:
if (event.usage) {
    if (event.usage.input_tokens != null) {
        output.usage.input = event.usage.input_tokens;
    }
    // ... rest of usage handling
}
```

**Setup:** Use local pi-ai instead of npm:
```json
// package.json
"@mariozechner/pi-ai": "file:../pi-mono/packages/ai"
```

---

### 2. Antigravity Tools Fix (Always Include Usage)

**Problem:** Proxy streaming response missing `usage` object in `message_start` event.

**Location:** `D:\Workspace\Messi\Code\Antigravity-Claude\src-tauri\src\proxy\mappers\claude\streaming.rs`

**Fix (Line 303-311):**
```rust
// Before:
if let Some(u) = usage {
    message["usage"] = json!(u);
}

// After (always include usage):
message["usage"] = match usage {
    Some(u) => json!(u),
    None => json!({
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0
    }),
};
```

**Deploy to Server:**
```bash
# Copy file
scp streaming.rs vollx-antigravity:~/antigravity-claude/src-tauri/src/proxy/mappers/claude/

# Build
ssh vollx-antigravity 'cd ~/antigravity-claude && cargo build --release'

# Restart
ssh vollx-antigravity 'pkill -f antigravity_tools; sleep 1'
ssh vollx-antigravity 'cd ~/antigravity-claude && ABV_DIST_PATH=~/antigravity-claude/dist nohup ./src-tauri/target/release/antigravity_tools --headless > ~/antigravity.log 2>&1 &'
```

---

### 3. Antigravity User-Agent Fix (Google Blocking)

**Problem:** Google blocks Antigravity traffic based on User-Agent header, returning error:

```text
"This version of Antigravity is no longer supported. Please update to receive the latest features!"
```

Error comes as SSE streaming with `id: "msg_unknown"` and `model: ""`.

**Root Cause:** User-Agent was set to `antigravity/1.11.9 windows/amd64`, which Google detects and blocks.

**Fix:** Change User-Agent to official Cloud Code format: `google-cloud-sdk vscode_cloudshelleditor/0.1`

**Files to modify in Antigravity-Claude:**

**1. `src-tauri/src/proxy/upstream/client.rs`**
```rust
// Line 33 - client builder
.user_agent("google-cloud-sdk vscode_cloudshelleditor/0.1");

// Lines 108-110 - header in call_v1_internal_with_headers
headers.insert(
    header::USER_AGENT,
    header::HeaderValue::from_static("google-cloud-sdk vscode_cloudshelleditor/0.1"),
);

// Lines 220-222 - header in fetch_available_models
headers.insert(
    header::USER_AGENT,
    header::HeaderValue::from_static("google-cloud-sdk vscode_cloudshelleditor/0.1"),
);
```

**2. `src-tauri/src/proxy/project_resolver.rs`**
```rust
// Line 21
.header("User-Agent", "google-cloud-sdk vscode_cloudshelleditor/0.1")
```

**3. `src-tauri/src/modules/quota.rs`**
```rust
// Line 8
const USER_AGENT: &str = "google-cloud-sdk vscode_cloudshelleditor/0.1";
```

**Server Deployment Notes:**

- Run with `--headless` flag on Linux servers without GTK
- Server runs backend+frontend on port 8911 with `/v1`, `/v1beta` paths directly
- Correct API URL: `https://antigravity.vollx.com/v1/messages` (NOT `/api/v1/messages`)

---

### 4. Provider-Specific Headers

**Important:** When calling proxies (like Antigravity), don't send Anthropic-specific headers:

- `anthropic-version: 2024-01-01` - Only for direct Anthropic API calls
- Each provider should define its own required headers
- Antigravity routes to Google's v1internal API, not Anthropic

---

## Zalo Web Extension (2026-01-30)

### Overview

Implemented `zaloweb` extension - Zalo Web integration via Electron BrowserView. This allows users to use Zalo through the desktop app without session conflict (since the Electron app IS the web client).

### Why Zalo Web instead of zca-cli?

- **Session conflict:** Zalo only allows 1 web session. Using zca-cli would kick out the user's existing Zalo Web session.
- **Electron BrowserView:** The desktop app becomes the Zalo Web client itself - no conflict.
- **Full access:** Personal account has access to ALL conversations (unlike Bot API which only sees messages in groups where bot is added).

### Files Created

**Extension (`extensions/zaloweb/`):**
```
├── package.json           # Package config
├── clawdbot.plugin.json   # Plugin manifest  
├── README.md              # Documentation
├── index.ts               # Entry point
└── src/
    ├── channel.ts         # Channel plugin definition
    ├── config-schema.ts   # Zod schema for config
    ├── types.ts           # TypeScript types
    └── runtime.ts         # Runtime exports
```

**Desktop App (`apps/desktop/src/`):**
```
├── main/
│   ├── index.ts           # Modified: Added Zalo WebView init + IPC handlers
│   └── zalo-web-view.ts   # NEW: BrowserView manager for Zalo Web
├── preload/
│   ├── index.ts           # Modified: Added Zalo Web API
│   └── zalo-inject.ts     # NEW: Preload script for Zalo BrowserView
└── renderer/
    ├── App.tsx            # Modified: Added ZaloWeb tab + first-time setup
    └── pages/
        ├── Channels.tsx   # Modified: Added zaloweb to channel list
        ├── ZaloWeb.tsx    # NEW: Zalo Web UI page
        └── Setup.tsx      # NEW: First-time setup wizard
```

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Electron Main Process              │
│  ┌─────────────────────────────────────────┐   │
│  │         ZaloWebViewManager              │   │
│  │  - BrowserView với chat.zalo.me         │   │
│  │  - Inject script để monitor messages    │   │
│  │  - IPC handlers (open/hide/send/status) │   │
│  └─────────────────────────────────────────┘   │
│                      ↕ IPC                      │
│  ┌─────────────────────────────────────────┐   │
│  │         Preload (zalo-inject.ts)        │   │
│  │  - Bridge giữa Zalo Web và Main         │   │
│  │  - reportMessage(), reportLoginStatus() │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                      ↕ IPC
┌─────────────────────────────────────────────────┐
│              Electron Renderer                  │
│  ┌─────────────────────────────────────────┐   │
│  │         ZaloWeb.tsx Page                │   │
│  │  - UI để open/hide Zalo Web             │   │
│  │  - Hiển thị status, messages, threads   │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Key Features

1. **BrowserView Embed:** Load `chat.zalo.me` trong isolated BrowserView
2. **Session Persistence:** Dùng `persist:zaloweb` partition để giữ session
3. **Message Monitoring:** MutationObserver inject vào DOM để detect new messages
4. **IPC Bridge:** Forward messages từ Zalo Web → Main → Renderer/Gateway
5. **First-time Setup:** Wizard cho user mới (chọn provider + channel)

### Config Schema

```json5
{
  channels: {
    zaloweb: {
      enabled: true,
      dmPolicy: "pairing",  // pairing | allowlist | open | disabled
      allowFrom: ["user_id"],
      groupPolicy: "allowlist",
      autoReply: true
    }
  }
}
```

### IPC Handlers

| Handler | Description |
|---------|-------------|
| `zaloweb:open` | Show BrowserView, load Zalo Web |
| `zaloweb:hide` | Hide BrowserView (session vẫn giữ) |
| `zaloweb:status` | Get login status, user info |
| `zaloweb:send` | Send message to thread |
| `zaloweb:threads` | Get conversation list |

### Notes

- Inject script cần được tweak tùy theo DOM thực tế của Zalo Web (có thể thay đổi)
- Chưa test với Zalo Web thực tế - cần verify selectors
- Message forwarding đến Gateway chưa implement đầy đủ - chỉ có skeleton

---

## Setup Wizard - OAuth Validation Fix (2026-01-31)

### Critical Issue: Gateway Config Format

**Problem:** OAuth login failed with validation error when clicking "Login with Anthropic" or "Login with Google":

```
Invalid config at C:\Users\...\moltbot.json:
- gateway.bind: Invalid input
- gateway.auth: Invalid input: expected object, received string
```

**Root Cause:** The `config-manager.ts` `initializeWorkspace()` function was creating gateway config with **WRONG format** that violated the Zod schema:

```typescript
// WRONG FORMAT (lines 488-496 in config-manager.ts):
gateway: {
  port: 18789,
  bind: 'localhost',  // ✗ Schema requires: 'loopback' | 'lan' | 'tailnet' | 'auto' | 'custom'
  auth: 'token',      // ✗ Schema requires: object { mode: string, token?: string, password?: string }
}
```

**Why This Blocks OAuth:**

1. User selects "Fresh Install" in Setup Wizard
2. Wizard calls `backupAndReset()` → `resetConfig()` → `initializeWorkspace()`
3. `initializeWorkspace()` creates `moltbot.json` with invalid gateway config
4. User clicks "Login with Anthropic" → spawns terminal with `moltbot auth login --provider anthropic`
5. CLI validates **ENTIRE** config file before running OAuth
6. Validation fails on gateway config → OAuth never starts

**Fix (apps/desktop/src/main/config-manager.ts lines 488-496):**

```typescript
// CORRECT FORMAT:
gateway: {
  port: 18789,
  mode: 'local',
  bind: 'loopback',  // ✓ Schema-compliant value
  auth: {            // ✓ Object format
    mode: 'token',
    token: '',
  },
},
```

**Key Insight:** OAuth authentication happens BEFORE gateway setup, but CLI validates the entire config file first. Invalid gateway config in the initial template blocks OAuth from running.

---

### Related Fixes

#### 1. Workspace Path Auto-fill

**Problem:** Step 3 (Workspace) didn't auto-fill path based on OS.

**Fix:** Implemented IPC-based path retrieval:

**apps/desktop/src/main/index.ts (lines 269-279):**
```typescript
ipcMain.handle('workspace:get-default-path', async () => {
  log.info('IPC: workspace:get-default-path');
  try {
    const homeDir = os.homedir();
    const defaultPath = path.join(homeDir, '.moltbot');
    return { success: true, path: defaultPath };
  } catch (error: any) {
    log.error('Failed to get default workspace path:', error);
    return { success: false, path: '', error: error.message };
  }
});
```

**apps/desktop/src/preload/index.ts:**
```typescript
setup: {
  getDefaultWorkspacePath: () => ipcRenderer.invoke('workspace:get-default-path'),
  // ... other setup methods
}
```

**apps/desktop/src/renderer/pages/Setup.tsx (lines 67-84):**
```typescript
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
```

---

#### 2. Model Selection UX

**Problem:** ModelStep showed text input for 'skip' provider - users didn't know what model ID to type.

**Fix:** Changed to dropdown with model cards showing names and IDs.

**apps/desktop/src/renderer/components/wizard/steps/ModelStep.tsx (lines 89-110):**
```typescript
{provider === 'skip' && (
  <div className="model-select">
    {anthropicModels.map((model) => (
      <div
        key={model.id}
        className={`model-card ${value === model.id ? 'selected' : ''}`}
        onClick={() => onChange(model.id)}
      >
        <div className="model-radio">
          {value === model.id ? '●' : '○'}
        </div>
        <div className="model-info">
          <div className="model-name">{model.name}</div>
          <div className="model-id">{model.id}</div>
        </div>
      </div>
    ))}
  </div>
)}
```

---

#### 3. Gateway Bind Options with Explanations

**Problem:** Users didn't understand the security implications of bind options.

**Fix:** Added descriptive labels and security hints.

**apps/desktop/src/renderer/components/wizard/steps/GatewayStep.tsx (lines 114-122):**
```typescript
<select className="form-select" value={value.bind} onChange={...}>
  <option value="localhost">Loopback - Only this machine (127.0.0.1)</option>
  <option value="all-interfaces">LAN - All network interfaces (0.0.0.0)</option>
  <option value="tailscale">Tailnet - Tailscale VPN (100.x.x.x)</option>
</select>
<div className="form-hint">
  {value.bind === 'localhost' && '✓ Secure: Only accessible from this machine'}
  {value.bind === 'all-interfaces' && '⚠ Warning: Accessible from any device on your network. Requires authentication!'}
  {value.bind === 'tailscale' && '✓ Secure: Accessible via encrypted Tailscale VPN'}
</div>
```

---

#### 4. Channel Policy Tooltips

**Problem:** Policy dropdown options (pairing, allowlist, open, disabled) weren't explained.

**Fix:** Added descriptive labels and form hints.

**apps/desktop/src/renderer/components/wizard/ChannelMultiSelect.tsx (lines 132-173):**
```typescript
// DM Policy
<select className="form-select" value={configs[channel.id]?.dmPolicy || 'pairing'} onChange={...}>
  <option value="pairing">Pairing - User must pair first</option>
  <option value="allowlist">Allowlist - Only approved users</option>
  <option value="open">Open - Anyone can message</option>
  <option value="disabled">Disabled - No DM access</option>
</select>
<div className="form-hint">
  {(!configs[channel.id]?.dmPolicy || configs[channel.id]?.dmPolicy === 'pairing') && 'Recommended: Users must request access first'}
  {configs[channel.id]?.dmPolicy === 'allowlist' && 'Only users in allowlist can send messages'}
  {configs[channel.id]?.dmPolicy === 'open' && '⚠ Warning: Anyone can send messages'}
  {configs[channel.id]?.dmPolicy === 'disabled' && 'Bot will not respond to direct messages'}
</div>

// Group Policy (similar structure)
<select className="form-select" value={configs[channel.id]?.groupPolicy || 'allowlist'} onChange={...}>
  <option value="allowlist">Allowlist - Only approved groups</option>
  <option value="open">Open - All groups</option>
  <option value="disabled">Disabled - No group access</option>
</select>
<div className="form-hint">
  {(!configs[channel.id]?.groupPolicy || configs[channel.id]?.groupPolicy === 'allowlist') && 'Recommended: Only respond in approved groups'}
  {configs[channel.id]?.groupPolicy === 'open' && '⚠ Warning: Bot will respond in any group'}
  {configs[channel.id]?.groupPolicy === 'disabled' && 'Bot will not respond in group chats'}
</div>
```

---

#### 5. Confirm Button in Complete Step

**Problem:** Complete step showed quick actions immediately without explicit confirmation.

**Fix:** Split into two states - Confirm first, then quick actions after confirmed.

**apps/desktop/src/renderer/components/wizard/steps/CompleteStep.tsx (lines 87-148):**
```typescript
{!confirmed && (
  <div className="confirm-section">
    <button
      className="btn btn-primary btn-large"
      onClick={onConfirm}
      disabled={loading}
    >
      {loading ? 'Saving Configuration...' : 'Confirm & Save Configuration'}
    </button>
  </div>
)}

{confirmed && (
  <>
    <div className="quick-actions">
      <h3>Quick Actions</h3>
      <div className="action-buttons">
        {onStartGateway && (
          <button className="btn btn-primary" onClick={onStartGateway} disabled={loading}>
            Start Gateway
          </button>
        )}
        {onOpenDashboard && (
          <button className="btn btn-secondary" onClick={onOpenDashboard} disabled={loading}>
            Open Dashboard
          </button>
        )}
        {onConfigureSkills && (
          <button className="btn btn-secondary" onClick={onConfigureSkills} disabled={loading}>
            Configure Skills
          </button>
        )}
      </div>
    </div>
  </>
)}
```

---

#### 6. Re-init Setup from Settings

**Problem:** No way to restart wizard after first run.

**Fix:** Added "Re-init Setting" button in Settings Config tab.

**apps/desktop/src/renderer/pages/Settings.tsx (lines 887-900):**
```typescript
<button
  className="btn btn-primary btn-small"
  onClick={() => {
    if (onReinitSetup) {
      if (confirm('This will reset and re-run the initial setup wizard. Continue?')) {
        onReinitSetup();
      }
    }
  }}
  title="Re-run the setup wizard"
>
  🔄 Re-init Setting
</button>
```

**apps/desktop/src/renderer/App.tsx (lines 92-94):**
```typescript
const handleReinitSetup = () => {
  setShowSetup(true);
};

// Line 141
<Settings onConfigChange={reloadConfig} onReinitSetup={handleReinitSetup} />
```

---

#### 7. Gateway Config Mapping in Setup.tsx

**Problem:** UI uses user-friendly values ('localhost', 'token') but schema requires specific values ('loopback', object format).

**Fix:** Added mapping logic in handleConfirm.

**apps/desktop/src/renderer/pages/Setup.tsx (lines 268-311):**
```typescript
const handleConfirm = async () => {
  setState((prev) => ({ ...prev, loading: true }));

  try {
    const { data } = state;

    // 1. Save model config
    await window.electronAPI.config.updateAgentsDefaults({
      model: { primary: data.model },
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
      mode: data.gateway.mode === 'service' ? 'local' : 'local',
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
    await window.electronAPI.config.updateAgentsDefaults({});

    // 3. Save channel configurations
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
```

---

### Development Restart Script

**apps/desktop/localdesktoprun.bat:**

Batch script to kill all processes and restart cleanly:

```batch
@echo off
echo ====================================
echo Clawdbot Desktop - Local Dev Restart
echo ====================================
echo.

REM Kill all related processes
echo [1/5] Killing existing processes...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM moltbot.exe 2>nul
echo Done.
echo.

REM Wait a bit for processes to fully terminate
timeout /t 2 /nobreak >nul

REM Clean up any stuck ports
echo [2/5] Cleaning up ports...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5173') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :18789') DO taskkill /F /PID %%P 2>nul
echo Done.
echo.

REM Rebuild main process
echo [3/5] Rebuilding main process...
call npm run build:main
if %errorlevel% neq 0 (
    echo ERROR: Main build failed!
    pause
    exit /b 1
)
echo Done.
echo.

REM Rebuild preload
echo [4/5] Rebuilding preload...
call npm run build:preload
if %errorlevel% neq 0 (
    echo ERROR: Preload build failed!
    pause
    exit /b 1
)
echo Done.
echo.

REM Start dev server
echo [5/5] Starting dev server...
echo.
echo ====================================
echo   App should open in a few seconds
echo   Press Ctrl+C to stop
echo ====================================
echo.
call npm run dev
```

---

### Pending Tasks

From user's original 9-issue feedback, still pending:

1. **Add Google Gemini models to ModelStep** - Currently only shows Anthropic models
2. **Add Antigravity provider to AuthProviderStep** - Type updated but UI not implemented
3. **Verify all providers match CLI `onboard --install`** - Need audit
4. **Verify all channels match CLI `onboard --install`** - Need audit
5. **Fix channel icons (Zalo and Claude)** - Details unclear

---
