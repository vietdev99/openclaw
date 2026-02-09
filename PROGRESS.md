# OpenClaw Bot Debug Context — Agent Returns 0 Replies

## Trạng thái hiện tại (2026-02-10)

Bot nhận tin nhắn Feishu (Lark) thành công nhưng **không trả lời**. Nguyên nhân đã được xác định.

## Nguyên nhân gốc đã tìm ra

### ✅ Đã xác nhận: Model `gemini-3-pro-high` trả output rỗng

Log `[DEBUG-EMPTY-REPLY]` cho thấy:

```
model=gemini-3-pro-high
fallbackModel=claude-opus-4-6-thinking
embeddedError=none
usage={"input":6205, "output":4, "cacheRead":251785, "total":257994}
messagingToolTexts=0
```

- **Không có lỗi API** — OAuth token hoạt động bình thường
- **Network OK** — Server kết nối được tới Google API (test trả 403 = reachable)
- **Model trả về chỉ 4 output tokens** → bị strip thành empty → 0 payloads → 0 replies
- Fallback model `claude-opus-4-6-thinking` cũng không hoạt động

### ✅ Đã xác nhận KHÔNG phải nguyên nhân

- OAuth token hết hạn (token vẫn valid khi gọi API)
- Network/firewall block (fetch test OK)
- Fire-and-forget pattern (đã revert `await` trong `monitor.ts`)
- Feishu SDK lifecycle issue (đã fix)

## Vấn đề phụ: Gateway shutdown timeout

```
[gateway] shutdown timed out; exiting without full cleanup
```

Khi config thay đổi → gateway restart → nhưng LLM call đang chạy (timeout 480s) → shutdown bị treo → gateway không restart được sạch.

## Các thay đổi đã commit (branch `main`, commit `aec7a79`)

### 1. `extensions/feishu/src/monitor.ts`

- Khôi phục `await` cho `handleFeishuMessage` (fix fire-and-forget)

### 2. `extensions/feishu/src/bot.ts`

- Sửa log dispatch: thêm `block` và `tool` counts bên cạnh `final`

### 3. `src/auto-reply/reply/agent-runner.ts`

- Thêm `[DEBUG-EMPTY-REPLY]` log khi agent trả 0 payloads
- Log: provider, model, embeddedError, usage, fallback info

### 4. `ui-v2/src/lib/oauth/antigravity.ts`

- Fix OAuth redirect URI: bỏ `/v2/` prefix

## Cấu trúc dispatch chain (đã trace đầy đủ)

```
Feishu message → handleFeishuMessage (bot.ts)
  → dispatchReplyFromConfig (dispatch-from-config.ts)
    → getReplyFromConfig (get-reply.ts)
      → runPreparedReply (get-reply-run.ts)
        → runReplyAgent (agent-runner.ts)
          → runAgentTurnWithFallback (agent-runner-execution.ts)
            → runEmbeddedPiAgent (pi-embedded-runner/run.ts)
              → Google Antigravity API call
```

Khi `payloadArray.length === 0` → trả `undefined` → `replies=[]` → `counts.final=0`

## File auth credentials

Đường dẫn: `$USERPROFILE\.openclaw\agents\main\agent\auth-profiles.json`

Profiles hoạt động:

- `google-antigravity:huongha2245@gmail.com` (projectId: `starry-retina-xc9f9`)
- `google-antigravity:twanle191@gmail.com` (projectId: `smart-shade-9tr8c`)
- Strategy: `loadbalance`

## Cần làm tiếp

### 1. Fix model (ưu tiên cao)

- Đổi `default_model` trong `openclaw.json` từ `gemini-3-pro-high` sang model hoạt động
- Thử: `gemini-2.5-flash`, `gemini-2.5-pro`
- Hoặc gửi `/model gemini-2.5-flash` trên Lark để test
- Kiểm tra file `models.generated.js` trong `@mariozechner/pi-ai` để xem model nào available

### 2. Fix gateway shutdown timeout

- Giảm LLM timeout (hiện 480s) hoặc
- Implement graceful shutdown cho running LLM calls
- Hoặc dùng process manager (PM2) để auto-restart

### 3. Kiểm tra fallback model

- `claude-opus-4-6-thinking` cũng cần verify có hoạt động không
- Có thể cần custom model mapping trong pi-ai

## Config quan trọng (openclaw.json trên remote server)

```
Path: C:\Users\Printway - Win VM 1\.openclaw\openclaw.json
```

Settings đáng chú ý:

- `maxConcurrent`: 30
- `profileStrategy`: loadbalance
- `timeoutSeconds`: 480
- `blockStreamingBreak`: message_end

## Remote server info

- User: `Printway - Win VM 1`
- State dir: `C:\Users\Printway - Win VM 1\.openclaw\`
- Gateway port: 18789
- Deploy flow: push to GitHub → pull on server → `npm run build` → `openclaw daemon start`
