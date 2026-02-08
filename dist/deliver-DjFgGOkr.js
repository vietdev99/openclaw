import { j as normalizeAccountId$1 } from "./agent-scope-CfzZRWcV.js";
import { b as getActivePluginRegistry } from "./exec-B7WKla_0.js";
import { M as getChannelPlugin, P as normalizeChannelId, j as mediaKindFromMime } from "./image-ops-CHacgj65.js";
import { t as loadConfig } from "./config-DxG-_fT0.js";
import { G as appendAssistantMessageToSessionTranscript, K as resolveMirroredTranscriptText, Zt as resolveSignalAccount, gt as getChannelDock, kt as saveMediaBuffer, m as isMessagingToolDuplicate } from "./pi-embedded-helpers-C0npD99M.js";
import { S as parseFenceSpans, d as resolveMarkdownTableMode, h as chunkMarkdownTextWithMode, i as markdownToIR, o as loadWebMedia, p as chunkByParagraph, r as chunkMarkdownIR, t as resolveFetch, v as resolveChunkMode, y as resolveTextChunkLimit } from "./fetch-ByF-CNua.js";
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
  return target;
};
import { randomUUID } from "node:crypto";

//#region src/auto-reply/tokens.ts
const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
const SILENT_REPLY_TOKEN = "NO_REPLY";
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isSilentReplyText(text, token = SILENT_REPLY_TOKEN) {
	if (!text) return false;
	const escaped = escapeRegExp(token);
	if (new RegExp(`^\\s*${escaped}(?=$|\\W)`).test(text)) return true;
	return new RegExp(`\\b${escaped}\\b\\W*$`).test(text);
}

//#endregion
//#region src/utils/directive-tags.ts
const AUDIO_TAG_RE = /\[\[\s*audio_as_voice\s*\]\]/gi;
const REPLY_TAG_RE = /\[\[\s*(?:reply_to_current|reply_to\s*:\s*([^\]\n]+))\s*\]\]/gi;
function normalizeDirectiveWhitespace(text) {
	return text.replace(/[ \t]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim();
}
function parseInlineDirectives(text, options = {}) {
	const { currentMessageId, stripAudioTag = true, stripReplyTags = true } = options;
	if (!text) return {
		text: "",
		audioAsVoice: false,
		replyToCurrent: false,
		hasAudioTag: false,
		hasReplyTag: false
	};
	let cleaned = text;
	let audioAsVoice = false;
	let hasAudioTag = false;
	let hasReplyTag = false;
	let sawCurrent = false;
	let lastExplicitId;
	cleaned = cleaned.replace(AUDIO_TAG_RE, (match) => {
		audioAsVoice = true;
		hasAudioTag = true;
		return stripAudioTag ? " " : match;
	});
	cleaned = cleaned.replace(REPLY_TAG_RE, (match, idRaw) => {
		hasReplyTag = true;
		if (idRaw === void 0) sawCurrent = true;
		else {
			const id = idRaw.trim();
			if (id) lastExplicitId = id;
		}
		return stripReplyTags ? " " : match;
	});
	cleaned = normalizeDirectiveWhitespace(cleaned);
	const replyToId = lastExplicitId ?? (sawCurrent ? currentMessageId?.trim() || void 0 : void 0);
	return {
		text: cleaned,
		audioAsVoice,
		replyToId,
		replyToExplicitId: lastExplicitId,
		replyToCurrent: sawCurrent,
		hasAudioTag,
		hasReplyTag
	};
}

//#endregion
//#region src/media/audio-tags.ts
/**
* Extract audio mode tag from text.
* Supports [[audio_as_voice]] to send audio as voice bubble instead of file.
* Default is file (preserves backward compatibility).
*/
function parseAudioTag(text) {
	const result = parseInlineDirectives(text, { stripReplyTags: false });
	return {
		text: result.text,
		audioAsVoice: result.audioAsVoice,
		hadTag: result.hasAudioTag
	};
}

//#endregion
//#region src/media/parse.ts
const MEDIA_TOKEN_RE = /\bMEDIA:\s*`?([^\n]+)`?/gi;
function normalizeMediaSource(src) {
	return src.startsWith("file://") ? src.replace("file://", "") : src;
}
function cleanCandidate(raw) {
	return raw.replace(/^[`"'[{(]+/, "").replace(/[`"'\\})\],]+$/, "");
}
function isValidMedia(candidate, opts) {
	if (!candidate) return false;
	if (candidate.length > 4096) return false;
	if (!opts?.allowSpaces && /\s/.test(candidate)) return false;
	if (/^https?:\/\//i.test(candidate)) return true;
	return candidate.startsWith("./") && !candidate.includes("..");
}
function unwrapQuoted(value) {
	const trimmed = value.trim();
	if (trimmed.length < 2) return;
	const first = trimmed[0];
	if (first !== trimmed[trimmed.length - 1]) return;
	if (first !== `"` && first !== "'" && first !== "`") return;
	return trimmed.slice(1, -1).trim();
}
function isInsideFence(fenceSpans, offset) {
	return fenceSpans.some((span) => offset >= span.start && offset < span.end);
}
function splitMediaFromOutput(raw) {
	const trimmedRaw = raw.trimEnd();
	if (!trimmedRaw.trim()) return { text: "" };
	const media = [];
	let foundMediaToken = false;
	const fenceSpans = parseFenceSpans(trimmedRaw);
	const lines = trimmedRaw.split("\n");
	const keptLines = [];
	let lineOffset = 0;
	for (const line of lines) {
		if (isInsideFence(fenceSpans, lineOffset)) {
			keptLines.push(line);
			lineOffset += line.length + 1;
			continue;
		}
		if (!line.trimStart().startsWith("MEDIA:")) {
			keptLines.push(line);
			lineOffset += line.length + 1;
			continue;
		}
		const matches = Array.from(line.matchAll(MEDIA_TOKEN_RE));
		if (matches.length === 0) {
			keptLines.push(line);
			lineOffset += line.length + 1;
			continue;
		}
		const pieces = [];
		let cursor = 0;
		for (const match of matches) {
			const start = match.index ?? 0;
			pieces.push(line.slice(cursor, start));
			const payload = match[1];
			const unwrapped = unwrapQuoted(payload);
			const payloadValue = unwrapped ?? payload;
			const parts = unwrapped ? [unwrapped] : payload.split(/\s+/).filter(Boolean);
			const mediaStartIndex = media.length;
			let validCount = 0;
			const invalidParts = [];
			let hasValidMedia = false;
			for (const part of parts) {
				const candidate = normalizeMediaSource(cleanCandidate(part));
				if (isValidMedia(candidate, unwrapped ? { allowSpaces: true } : void 0)) {
					media.push(candidate);
					hasValidMedia = true;
					foundMediaToken = true;
					validCount += 1;
				} else invalidParts.push(part);
			}
			const trimmedPayload = payloadValue.trim();
			const looksLikeLocalPath = trimmedPayload.startsWith("/") || trimmedPayload.startsWith("./") || trimmedPayload.startsWith("../") || trimmedPayload.startsWith("~") || trimmedPayload.startsWith("file://");
			if (!unwrapped && validCount === 1 && invalidParts.length > 0 && /\s/.test(payloadValue) && looksLikeLocalPath) {
				const fallback = normalizeMediaSource(cleanCandidate(payloadValue));
				if (isValidMedia(fallback, { allowSpaces: true })) {
					media.splice(mediaStartIndex, media.length - mediaStartIndex, fallback);
					hasValidMedia = true;
					foundMediaToken = true;
					validCount = 1;
					invalidParts.length = 0;
				}
			}
			if (!hasValidMedia) {
				const fallback = normalizeMediaSource(cleanCandidate(payloadValue));
				if (isValidMedia(fallback, { allowSpaces: true })) {
					media.push(fallback);
					hasValidMedia = true;
					foundMediaToken = true;
					invalidParts.length = 0;
				}
			}
			if (hasValidMedia) {
				if (invalidParts.length > 0) pieces.push(invalidParts.join(" "));
			} else pieces.push(match[0]);
			cursor = start + match[0].length;
		}
		pieces.push(line.slice(cursor));
		const cleanedLine = pieces.join("").replace(/[ \t]{2,}/g, " ").trim();
		if (cleanedLine) keptLines.push(cleanedLine);
		lineOffset += line.length + 1;
	}
	let cleanedText = keptLines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n").trim();
	const audioTagResult = parseAudioTag(cleanedText);
	const hasAudioAsVoice = audioTagResult.audioAsVoice;
	if (audioTagResult.hadTag) cleanedText = audioTagResult.text.replace(/\n{2,}/g, "\n").trim();
	if (media.length === 0) {
		const result = { text: foundMediaToken || hasAudioAsVoice ? cleanedText : trimmedRaw };
		if (hasAudioAsVoice) result.audioAsVoice = true;
		return result;
	}
	return {
		text: cleanedText,
		mediaUrls: media,
		mediaUrl: media[0],
		...hasAudioAsVoice ? { audioAsVoice: true } : {}
	};
}

//#endregion
//#region src/auto-reply/reply/reply-directives.ts
function parseReplyDirectives(raw, options = {}) {
	const split = splitMediaFromOutput(raw);
	let text = split.text ?? "";
	const replyParsed = parseInlineDirectives(text, {
		currentMessageId: options.currentMessageId,
		stripAudioTag: false,
		stripReplyTags: true
	});
	if (replyParsed.hasReplyTag) text = replyParsed.text;
	const silentToken = options.silentToken ?? SILENT_REPLY_TOKEN;
	const isSilent = isSilentReplyText(text, silentToken);
	if (isSilent) text = "";
	return {
		text,
		mediaUrls: split.mediaUrls,
		mediaUrl: split.mediaUrl,
		replyToId: replyParsed.replyToId,
		replyToCurrent: replyParsed.replyToCurrent,
		replyToTag: replyParsed.hasReplyTag,
		audioAsVoice: split.audioAsVoice,
		isSilent
	};
}

//#endregion
//#region src/infra/outbound/target-normalization.ts
function normalizeChannelTargetInput(raw) {
	return raw.trim();
}
function normalizeTargetForProvider(provider, raw) {
	if (!raw) return;
	const providerId = normalizeChannelId(provider);
	return ((providerId ? getChannelPlugin(providerId) : void 0)?.messaging?.normalizeTarget?.(raw) ?? (raw.trim().toLowerCase() || void 0)) || void 0;
}
function buildTargetResolverSignature(channel) {
	const resolver = getChannelPlugin(channel)?.messaging?.targetResolver;
	const hint = resolver?.hint ?? "";
	const looksLike = resolver?.looksLikeId;
	return hashSignature(`${hint}|${looksLike ? looksLike.toString() : ""}`);
}
function hashSignature(value) {
	let hash = 5381;
	for (let i = 0; i < value.length; i += 1) hash = (hash << 5) + hash ^ value.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

//#endregion
//#region src/channels/plugins/media-limits.ts
const MB = 1024 * 1024;
function resolveChannelMediaMaxBytes(params) {
	const accountId = normalizeAccountId$1(params.accountId);
	const channelLimit = params.resolveChannelLimitMb({
		cfg: params.cfg,
		accountId
	});
	if (channelLimit) return channelLimit * MB;
	if (params.cfg.agents?.defaults?.mediaMaxMb) return params.cfg.agents.defaults.mediaMaxMb * MB;
}

//#endregion
//#region src/channels/plugins/outbound/load.ts
const cache = /* @__PURE__ */ new Map();
let lastRegistry = null;
function ensureCacheForRegistry(registry) {
	if (registry === lastRegistry) return;
	cache.clear();
	lastRegistry = registry;
}
async function loadChannelOutboundAdapter(id) {
	const registry = getActivePluginRegistry();
	ensureCacheForRegistry(registry);
	const cached = cache.get(id);
	if (cached) return cached;
	const outbound = (registry?.channels.find((entry) => entry.plugin.id === id))?.plugin.outbound;
	if (outbound) {
		cache.set(id, outbound);
		return outbound;
	}
}

//#endregion
//#region src/signal/format.ts
function mapStyle(style) {
	switch (style) {
		case "bold": return "BOLD";
		case "italic": return "ITALIC";
		case "strikethrough": return "STRIKETHROUGH";
		case "code":
		case "code_block": return "MONOSPACE";
		case "spoiler": return "SPOILER";
		default: return null;
	}
}
function mergeStyles(styles) {
	const sorted = [...styles].toSorted((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		if (a.length !== b.length) return a.length - b.length;
		return a.style.localeCompare(b.style);
	});
	const merged = [];
	for (const style of sorted) {
		const prev = merged[merged.length - 1];
		if (prev && prev.style === style.style && style.start <= prev.start + prev.length) {
			const prevEnd = prev.start + prev.length;
			prev.length = Math.max(prevEnd, style.start + style.length) - prev.start;
			continue;
		}
		merged.push({ ...style });
	}
	return merged;
}
function clampStyles(styles, maxLength) {
	const clamped = [];
	for (const style of styles) {
		const start = Math.max(0, Math.min(style.start, maxLength));
		const length = Math.min(style.start + style.length, maxLength) - start;
		if (length > 0) clamped.push({
			start,
			length,
			style: style.style
		});
	}
	return clamped;
}
function applyInsertionsToStyles(spans, insertions) {
	if (insertions.length === 0) return spans;
	const sortedInsertions = [...insertions].toSorted((a, b) => a.pos - b.pos);
	let updated = spans;
	for (const insertion of sortedInsertions) {
		const next = [];
		for (const span of updated) {
			if (span.end <= insertion.pos) {
				next.push(span);
				continue;
			}
			if (span.start >= insertion.pos) {
				next.push({
					start: span.start + insertion.length,
					end: span.end + insertion.length,
					style: span.style
				});
				continue;
			}
			if (span.start < insertion.pos && span.end > insertion.pos) {
				if (insertion.pos > span.start) next.push({
					start: span.start,
					end: insertion.pos,
					style: span.style
				});
				const shiftedStart = insertion.pos + insertion.length;
				const shiftedEnd = span.end + insertion.length;
				if (shiftedEnd > shiftedStart) next.push({
					start: shiftedStart,
					end: shiftedEnd,
					style: span.style
				});
			}
		}
		updated = next;
	}
	return updated;
}
function renderSignalText(ir) {
	const text = ir.text ?? "";
	if (!text) return {
		text: "",
		styles: []
	};
	const sortedLinks = [...ir.links].toSorted((a, b) => a.start - b.start);
	let out = "";
	let cursor = 0;
	const insertions = [];
	for (const link of sortedLinks) {
		if (link.start < cursor) continue;
		out += text.slice(cursor, link.end);
		const href = link.href.trim();
		const trimmedLabel = text.slice(link.start, link.end).trim();
		const comparableHref = href.startsWith("mailto:") ? href.slice(7) : href;
		if (href) {
			if (!trimmedLabel) {
				out += href;
				insertions.push({
					pos: link.end,
					length: href.length
				});
			} else if (trimmedLabel !== href && trimmedLabel !== comparableHref) {
				const addition = ` (${href})`;
				out += addition;
				insertions.push({
					pos: link.end,
					length: addition.length
				});
			}
		}
		cursor = link.end;
	}
	out += text.slice(cursor);
	const adjusted = applyInsertionsToStyles(ir.styles.map((span) => {
		const mapped = mapStyle(span.style);
		if (!mapped) return null;
		return {
			start: span.start,
			end: span.end,
			style: mapped
		};
	}).filter((span) => span !== null), insertions);
	const trimmedText = out.trimEnd();
	const trimmedLength = trimmedText.length;
	return {
		text: trimmedText,
		styles: mergeStyles(clampStyles(adjusted.map((span) => ({
			start: span.start,
			length: span.end - span.start,
			style: span.style
		})), trimmedLength))
	};
}
function markdownToSignalText(markdown, options = {}) {
	return renderSignalText(markdownToIR(markdown ?? "", {
		linkify: true,
		enableSpoilers: true,
		headingStyle: "none",
		blockquotePrefix: "",
		tableMode: options.tableMode
	}));
}
function markdownToSignalTextChunks(markdown, limit, options = {}) {
	return chunkMarkdownIR(markdownToIR(markdown ?? "", {
		linkify: true,
		enableSpoilers: true,
		headingStyle: "none",
		blockquotePrefix: "",
		tableMode: options.tableMode
	}), limit).map((chunk) => renderSignalText(chunk));
}

//#endregion
//#region src/signal/client.ts
const DEFAULT_TIMEOUT_MS = 1e4;
function normalizeBaseUrl(url) {
	const trimmed = url.trim();
	if (!trimmed) throw new Error("Signal base URL is required");
	if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
	return `http://${trimmed}`.replace(/\/+$/, "");
}
async function fetchWithTimeout(url, init, timeoutMs) {
	const fetchImpl = resolveFetch();
	if (!fetchImpl) throw new Error("fetch is not available");
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetchImpl(url, {
			...init,
			signal: controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
}
async function signalRpcRequest(method, params, opts) {
	const baseUrl = normalizeBaseUrl(opts.baseUrl);
	const id = randomUUID();
	const body = JSON.stringify({
		jsonrpc: "2.0",
		method,
		params,
		id
	});
	const res = await fetchWithTimeout(`${baseUrl}/api/v1/rpc`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body
	}, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	if (res.status === 201) return;
	const text = await res.text();
	if (!text) throw new Error(`Signal RPC empty response (status ${res.status})`);
	const parsed = JSON.parse(text);
	if (parsed.error) {
		const code = parsed.error.code ?? "unknown";
		const msg = parsed.error.message ?? "Signal RPC error";
		throw new Error(`Signal RPC ${code}: ${msg}`);
	}
	return parsed.result;
}
async function signalCheck(baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const normalized = normalizeBaseUrl(baseUrl);
	try {
		const res = await fetchWithTimeout(`${normalized}/api/v1/check`, { method: "GET" }, timeoutMs);
		if (!res.ok) return {
			ok: false,
			status: res.status,
			error: `HTTP ${res.status}`
		};
		return {
			ok: true,
			status: res.status,
			error: null
		};
	} catch (err) {
		return {
			ok: false,
			status: null,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
async function streamSignalEvents(params) {
	const baseUrl = normalizeBaseUrl(params.baseUrl);
	const url = new URL(`${baseUrl}/api/v1/events`);
	if (params.account) url.searchParams.set("account", params.account);
	const fetchImpl = resolveFetch();
	if (!fetchImpl) throw new Error("fetch is not available");
	const res = await fetchImpl(url, {
		method: "GET",
		headers: { Accept: "text/event-stream" },
		signal: params.abortSignal
	});
	if (!res.ok || !res.body) throw new Error(`Signal SSE failed (${res.status} ${res.statusText || "error"})`);
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let currentEvent = {};
	const flushEvent = () => {
		if (!currentEvent.data && !currentEvent.event && !currentEvent.id) return;
		params.onEvent({
			event: currentEvent.event,
			data: currentEvent.data,
			id: currentEvent.id
		});
		currentEvent = {};
	};
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let lineEnd = buffer.indexOf("\n");
		while (lineEnd !== -1) {
			let line = buffer.slice(0, lineEnd);
			buffer = buffer.slice(lineEnd + 1);
			if (line.endsWith("\r")) line = line.slice(0, -1);
			if (line === "") {
				flushEvent();
				lineEnd = buffer.indexOf("\n");
				continue;
			}
			if (line.startsWith(":")) {
				lineEnd = buffer.indexOf("\n");
				continue;
			}
			const [rawField, ...rest] = line.split(":");
			const field = rawField.trim();
			const rawValue = rest.join(":");
			const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
			if (field === "event") currentEvent.event = value;
			else if (field === "data") currentEvent.data = currentEvent.data ? `${currentEvent.data}\n${value}` : value;
			else if (field === "id") currentEvent.id = value;
			lineEnd = buffer.indexOf("\n");
		}
	}
	flushEvent();
}

//#endregion
//#region src/signal/send.ts
function parseTarget(raw) {
	let value = raw.trim();
	if (!value) throw new Error("Signal recipient is required");
	if (value.toLowerCase().startsWith("signal:")) value = value.slice(7).trim();
	const normalized = value.toLowerCase();
	if (normalized.startsWith("group:")) return {
		type: "group",
		groupId: value.slice(6).trim()
	};
	if (normalized.startsWith("username:")) return {
		type: "username",
		username: value.slice(9).trim()
	};
	if (normalized.startsWith("u:")) return {
		type: "username",
		username: value.trim()
	};
	return {
		type: "recipient",
		recipient: value
	};
}
function buildTargetParams(target, allow) {
	if (target.type === "recipient") {
		if (!allow.recipient) return null;
		return { recipient: [target.recipient] };
	}
	if (target.type === "group") {
		if (!allow.group) return null;
		return { groupId: target.groupId };
	}
	if (target.type === "username") {
		if (!allow.username) return null;
		return { username: [target.username] };
	}
	return null;
}
function resolveSignalRpcContext(opts, accountInfo) {
	const hasBaseUrl = Boolean(opts.baseUrl?.trim());
	const hasAccount = Boolean(opts.account?.trim());
	const resolvedAccount = accountInfo || (!hasBaseUrl || !hasAccount ? resolveSignalAccount({
		cfg: loadConfig(),
		accountId: opts.accountId
	}) : void 0);
	const baseUrl = opts.baseUrl?.trim() || resolvedAccount?.baseUrl;
	if (!baseUrl) throw new Error("Signal base URL is required");
	return {
		baseUrl,
		account: opts.account?.trim() || resolvedAccount?.config.account?.trim()
	};
}
async function resolveAttachment(mediaUrl, maxBytes) {
	const media = await loadWebMedia(mediaUrl, maxBytes);
	const saved = await saveMediaBuffer(media.buffer, media.contentType ?? void 0, "outbound", maxBytes);
	return {
		path: saved.path,
		contentType: saved.contentType
	};
}
async function sendMessageSignal(to, text, opts = {}) {
	const cfg = loadConfig();
	const accountInfo = resolveSignalAccount({
		cfg,
		accountId: opts.accountId
	});
	const { baseUrl, account } = resolveSignalRpcContext(opts, accountInfo);
	const target = parseTarget(to);
	let message = text ?? "";
	let messageFromPlaceholder = false;
	let textStyles = [];
	const textMode = opts.textMode ?? "markdown";
	const maxBytes = (() => {
		if (typeof opts.maxBytes === "number") return opts.maxBytes;
		if (typeof accountInfo.config.mediaMaxMb === "number") return accountInfo.config.mediaMaxMb * 1024 * 1024;
		if (typeof cfg.agents?.defaults?.mediaMaxMb === "number") return cfg.agents.defaults.mediaMaxMb * 1024 * 1024;
		return 8 * 1024 * 1024;
	})();
	let attachments;
	if (opts.mediaUrl?.trim()) {
		const resolved = await resolveAttachment(opts.mediaUrl.trim(), maxBytes);
		attachments = [resolved.path];
		const kind = mediaKindFromMime(resolved.contentType ?? void 0);
		if (!message && kind) {
			message = kind === "image" ? "<media:image>" : `<media:${kind}>`;
			messageFromPlaceholder = true;
		}
	}
	if (message.trim() && !messageFromPlaceholder) if (textMode === "plain") textStyles = opts.textStyles ?? [];
	else {
		const tableMode = resolveMarkdownTableMode({
			cfg,
			channel: "signal",
			accountId: accountInfo.accountId
		});
		const formatted = markdownToSignalText(message, { tableMode });
		message = formatted.text;
		textStyles = formatted.styles;
	}
	if (!message.trim() && (!attachments || attachments.length === 0)) throw new Error("Signal send requires text or media");
	const params = { message };
	if (textStyles.length > 0) params["text-style"] = textStyles.map((style) => `${style.start}:${style.length}:${style.style}`);
	if (account) params.account = account;
	if (attachments && attachments.length > 0) params.attachments = attachments;
	const targetParams = buildTargetParams(target, {
		recipient: true,
		group: true,
		username: true
	});
	if (!targetParams) throw new Error("Signal recipient is required");
	Object.assign(params, targetParams);
	const timestamp = (await signalRpcRequest("send", params, {
		baseUrl,
		timeoutMs: opts.timeoutMs
	}))?.timestamp;
	return {
		messageId: timestamp ? String(timestamp) : "unknown",
		timestamp
	};
}
async function sendTypingSignal(to, opts = {}) {
	const { baseUrl, account } = resolveSignalRpcContext(opts);
	const targetParams = buildTargetParams(parseTarget(to), {
		recipient: true,
		group: true
	});
	if (!targetParams) return false;
	const params = { ...targetParams };
	if (account) params.account = account;
	if (opts.stop) params.stop = true;
	await signalRpcRequest("sendTyping", params, {
		baseUrl,
		timeoutMs: opts.timeoutMs
	});
	return true;
}
async function sendReadReceiptSignal(to, targetTimestamp, opts = {}) {
	if (!Number.isFinite(targetTimestamp) || targetTimestamp <= 0) return false;
	const { baseUrl, account } = resolveSignalRpcContext(opts);
	const targetParams = buildTargetParams(parseTarget(to), { recipient: true });
	if (!targetParams) return false;
	const params = {
		...targetParams,
		targetTimestamp,
		type: opts.type ?? "read"
	};
	if (account) params.account = account;
	await signalRpcRequest("sendReceipt", params, {
		baseUrl,
		timeoutMs: opts.timeoutMs
	});
	return true;
}

//#endregion
//#region src/auto-reply/reply/reply-tags.ts
function extractReplyToTag(text, currentMessageId) {
	const result = parseInlineDirectives(text, {
		currentMessageId,
		stripAudioTag: false
	});
	return {
		cleaned: result.text,
		replyToId: result.replyToId,
		replyToCurrent: result.replyToCurrent,
		hasTag: result.hasReplyTag
	};
}

//#endregion
//#region src/auto-reply/reply/reply-threading.ts
function resolveReplyToMode(cfg, channel, accountId, chatType) {
	const provider = normalizeChannelId(channel);
	if (!provider) return "all";
	return getChannelDock(provider)?.threading?.resolveReplyToMode?.({
		cfg,
		accountId,
		chatType
	}) ?? "all";
}
function createReplyToModeFilter(mode, opts = {}) {
	let hasThreaded = false;
	return (payload) => {
		if (!payload.replyToId) return payload;
		if (mode === "off") {
			if (opts.allowTagsWhenOff && payload.replyToTag) return payload;
			return {
				...payload,
				replyToId: void 0
			};
		}
		if (mode === "all") return payload;
		if (hasThreaded) return {
			...payload,
			replyToId: void 0
		};
		hasThreaded = true;
		return payload;
	};
}
function createReplyToModeFilterForChannel(mode, channel) {
	const provider = normalizeChannelId(channel);
	return createReplyToModeFilter(mode, { allowTagsWhenOff: provider ? Boolean(getChannelDock(provider)?.threading?.allowTagsWhenOff) : false });
}

//#endregion
//#region src/auto-reply/reply/reply-payloads.ts
function applyReplyTagsToPayload(payload, currentMessageId) {
	if (typeof payload.text !== "string") {
		if (!payload.replyToCurrent || payload.replyToId) return payload;
		return {
			...payload,
			replyToId: currentMessageId?.trim() || void 0
		};
	}
	if (!payload.text.includes("[[")) {
		if (!payload.replyToCurrent || payload.replyToId) return payload;
		return {
			...payload,
			replyToId: currentMessageId?.trim() || void 0,
			replyToTag: payload.replyToTag ?? true
		};
	}
	const { cleaned, replyToId, replyToCurrent, hasTag } = extractReplyToTag(payload.text, currentMessageId);
	return {
		...payload,
		text: cleaned ? cleaned : void 0,
		replyToId: replyToId ?? payload.replyToId,
		replyToTag: hasTag || payload.replyToTag,
		replyToCurrent: replyToCurrent || payload.replyToCurrent
	};
}
function isRenderablePayload(payload) {
	return Boolean(payload.text || payload.mediaUrl || payload.mediaUrls && payload.mediaUrls.length > 0 || payload.audioAsVoice || payload.channelData);
}
function applyReplyThreading(params) {
	const { payloads, replyToMode, replyToChannel, currentMessageId } = params;
	const applyReplyToMode = createReplyToModeFilterForChannel(replyToMode, replyToChannel);
	return payloads.map((payload) => applyReplyTagsToPayload(payload, currentMessageId)).filter(isRenderablePayload).map(applyReplyToMode);
}
function filterMessagingToolDuplicates(params) {
	const { payloads, sentTexts } = params;
	if (sentTexts.length === 0) return payloads;
	return payloads.filter((payload) => !isMessagingToolDuplicate(payload.text ?? "", sentTexts));
}
function normalizeAccountId(value) {
	const trimmed = value?.trim();
	return trimmed ? trimmed.toLowerCase() : void 0;
}
function shouldSuppressMessagingToolReplies(params) {
	const provider = params.messageProvider?.trim().toLowerCase();
	if (!provider) return false;
	const originTarget = normalizeTargetForProvider(provider, params.originatingTo);
	if (!originTarget) return false;
	const originAccount = normalizeAccountId(params.accountId);
	const sentTargets = params.messagingToolSentTargets ?? [];
	if (sentTargets.length === 0) return false;
	return sentTargets.some((target) => {
		if (!target?.provider) return false;
		if (target.provider.trim().toLowerCase() !== provider) return false;
		const targetKey = normalizeTargetForProvider(provider, target.to);
		if (!targetKey) return false;
		const targetAccount = normalizeAccountId(target.accountId);
		if (originAccount && targetAccount && originAccount !== targetAccount) return false;
		return targetKey === originTarget;
	});
}

//#endregion
//#region src/infra/outbound/payloads.ts
function mergeMediaUrls(...lists) {
	const seen = /* @__PURE__ */ new Set();
	const merged = [];
	for (const list of lists) {
		if (!list) continue;
		for (const entry of list) {
			const trimmed = entry?.trim();
			if (!trimmed) continue;
			if (seen.has(trimmed)) continue;
			seen.add(trimmed);
			merged.push(trimmed);
		}
	}
	return merged;
}
function normalizeReplyPayloadsForDelivery(payloads) {
	return payloads.flatMap((payload) => {
		const parsed = parseReplyDirectives(payload.text ?? "");
		const explicitMediaUrls = payload.mediaUrls ?? parsed.mediaUrls;
		const explicitMediaUrl = payload.mediaUrl ?? parsed.mediaUrl;
		const mergedMedia = mergeMediaUrls(explicitMediaUrls, explicitMediaUrl ? [explicitMediaUrl] : void 0);
		const resolvedMediaUrl = (explicitMediaUrls?.length ?? 0) > 1 ? void 0 : explicitMediaUrl;
		const next = {
			...payload,
			text: parsed.text ?? "",
			mediaUrls: mergedMedia.length ? mergedMedia : void 0,
			mediaUrl: resolvedMediaUrl,
			replyToId: payload.replyToId ?? parsed.replyToId,
			replyToTag: payload.replyToTag || parsed.replyToTag,
			replyToCurrent: payload.replyToCurrent || parsed.replyToCurrent,
			audioAsVoice: Boolean(payload.audioAsVoice || parsed.audioAsVoice)
		};
		if (parsed.isSilent && mergedMedia.length === 0) return [];
		if (!isRenderablePayload(next)) return [];
		return [next];
	});
}

//#endregion
//#region src/infra/outbound/deliver.ts
var deliver_exports = /* @__PURE__ */ __exportAll({ deliverOutboundPayloads: () => deliverOutboundPayloads });
function throwIfAborted(abortSignal) {
	if (abortSignal?.aborted) throw new Error("Outbound delivery aborted");
}
async function createChannelHandler(params) {
	const outbound = await loadChannelOutboundAdapter(params.channel);
	if (!outbound?.sendText || !outbound?.sendMedia) throw new Error(`Outbound not configured for channel: ${params.channel}`);
	const handler = createPluginHandler({
		outbound,
		cfg: params.cfg,
		channel: params.channel,
		to: params.to,
		accountId: params.accountId,
		replyToId: params.replyToId,
		threadId: params.threadId,
		deps: params.deps,
		gifPlayback: params.gifPlayback
	});
	if (!handler) throw new Error(`Outbound not configured for channel: ${params.channel}`);
	return handler;
}
function createPluginHandler(params) {
	const outbound = params.outbound;
	if (!outbound?.sendText || !outbound?.sendMedia) return null;
	const sendText = outbound.sendText;
	const sendMedia = outbound.sendMedia;
	return {
		chunker: outbound.chunker ?? null,
		chunkerMode: outbound.chunkerMode,
		textChunkLimit: outbound.textChunkLimit,
		sendPayload: outbound.sendPayload ? async (payload) => outbound.sendPayload({
			cfg: params.cfg,
			to: params.to,
			text: payload.text ?? "",
			mediaUrl: payload.mediaUrl,
			accountId: params.accountId,
			replyToId: params.replyToId,
			threadId: params.threadId,
			gifPlayback: params.gifPlayback,
			deps: params.deps,
			payload
		}) : void 0,
		sendText: async (text) => sendText({
			cfg: params.cfg,
			to: params.to,
			text,
			accountId: params.accountId,
			replyToId: params.replyToId,
			threadId: params.threadId,
			gifPlayback: params.gifPlayback,
			deps: params.deps
		}),
		sendMedia: async (caption, mediaUrl) => sendMedia({
			cfg: params.cfg,
			to: params.to,
			text: caption,
			mediaUrl,
			accountId: params.accountId,
			replyToId: params.replyToId,
			threadId: params.threadId,
			gifPlayback: params.gifPlayback,
			deps: params.deps
		})
	};
}
async function deliverOutboundPayloads(params) {
	const { cfg, channel, to, payloads } = params;
	const accountId = params.accountId;
	const deps = params.deps;
	const abortSignal = params.abortSignal;
	const sendSignal = params.deps?.sendSignal ?? sendMessageSignal;
	const results = [];
	const handler = await createChannelHandler({
		cfg,
		channel,
		to,
		deps,
		accountId,
		replyToId: params.replyToId,
		threadId: params.threadId,
		gifPlayback: params.gifPlayback
	});
	const textLimit = handler.chunker ? resolveTextChunkLimit(cfg, channel, accountId, { fallbackLimit: handler.textChunkLimit }) : void 0;
	const chunkMode = handler.chunker ? resolveChunkMode(cfg, channel, accountId) : "length";
	const isSignalChannel = channel === "signal";
	const signalTableMode = isSignalChannel ? resolveMarkdownTableMode({
		cfg,
		channel: "signal",
		accountId
	}) : "code";
	const signalMaxBytes = isSignalChannel ? resolveChannelMediaMaxBytes({
		cfg,
		resolveChannelLimitMb: ({ cfg, accountId }) => cfg.channels?.signal?.accounts?.[accountId]?.mediaMaxMb ?? cfg.channels?.signal?.mediaMaxMb,
		accountId
	}) : void 0;
	const sendTextChunks = async (text) => {
		throwIfAborted(abortSignal);
		if (!handler.chunker || textLimit === void 0) {
			results.push(await handler.sendText(text));
			return;
		}
		if (chunkMode === "newline") {
			const blockChunks = (handler.chunkerMode ?? "text") === "markdown" ? chunkMarkdownTextWithMode(text, textLimit, "newline") : chunkByParagraph(text, textLimit);
			if (!blockChunks.length && text) blockChunks.push(text);
			for (const blockChunk of blockChunks) {
				const chunks = handler.chunker(blockChunk, textLimit);
				if (!chunks.length && blockChunk) chunks.push(blockChunk);
				for (const chunk of chunks) {
					throwIfAborted(abortSignal);
					results.push(await handler.sendText(chunk));
				}
			}
			return;
		}
		const chunks = handler.chunker(text, textLimit);
		for (const chunk of chunks) {
			throwIfAborted(abortSignal);
			results.push(await handler.sendText(chunk));
		}
	};
	const sendSignalText = async (text, styles) => {
		throwIfAborted(abortSignal);
		return {
			channel: "signal",
			...await sendSignal(to, text, {
				maxBytes: signalMaxBytes,
				accountId: accountId ?? void 0,
				textMode: "plain",
				textStyles: styles
			})
		};
	};
	const sendSignalTextChunks = async (text) => {
		throwIfAborted(abortSignal);
		let signalChunks = textLimit === void 0 ? markdownToSignalTextChunks(text, Number.POSITIVE_INFINITY, { tableMode: signalTableMode }) : markdownToSignalTextChunks(text, textLimit, { tableMode: signalTableMode });
		if (signalChunks.length === 0 && text) signalChunks = [{
			text,
			styles: []
		}];
		for (const chunk of signalChunks) {
			throwIfAborted(abortSignal);
			results.push(await sendSignalText(chunk.text, chunk.styles));
		}
	};
	const sendSignalMedia = async (caption, mediaUrl) => {
		throwIfAborted(abortSignal);
		const formatted = markdownToSignalTextChunks(caption, Number.POSITIVE_INFINITY, { tableMode: signalTableMode })[0] ?? {
			text: caption,
			styles: []
		};
		return {
			channel: "signal",
			...await sendSignal(to, formatted.text, {
				mediaUrl,
				maxBytes: signalMaxBytes,
				accountId: accountId ?? void 0,
				textMode: "plain",
				textStyles: formatted.styles
			})
		};
	};
	const normalizedPayloads = normalizeReplyPayloadsForDelivery(payloads);
	for (const payload of normalizedPayloads) {
		const payloadSummary = {
			text: payload.text ?? "",
			mediaUrls: payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []),
			channelData: payload.channelData
		};
		try {
			throwIfAborted(abortSignal);
			params.onPayload?.(payloadSummary);
			if (handler.sendPayload && payload.channelData) {
				results.push(await handler.sendPayload(payload));
				continue;
			}
			if (payloadSummary.mediaUrls.length === 0) {
				if (isSignalChannel) await sendSignalTextChunks(payloadSummary.text);
				else await sendTextChunks(payloadSummary.text);
				continue;
			}
			let first = true;
			for (const url of payloadSummary.mediaUrls) {
				throwIfAborted(abortSignal);
				const caption = first ? payloadSummary.text : "";
				first = false;
				if (isSignalChannel) results.push(await sendSignalMedia(caption, url));
				else results.push(await handler.sendMedia(caption, url));
			}
		} catch (err) {
			if (!params.bestEffort) throw err;
			params.onError?.(err, payloadSummary);
		}
	}
	if (params.mirror && results.length > 0) {
		const mirrorText = resolveMirroredTranscriptText({
			text: params.mirror.text,
			mediaUrls: params.mirror.mediaUrls
		});
		if (mirrorText) await appendAssistantMessageToSessionTranscript({
			agentId: params.mirror.agentId,
			sessionKey: params.mirror.sessionKey,
			text: mirrorText
		});
	}
	return results;
}

//#endregion
export { HEARTBEAT_TOKEN as C, parseInlineDirectives as S, isSilentReplyText as T, buildTargetResolverSignature as _, applyReplyThreading as a, parseReplyDirectives as b, shouldSuppressMessagingToolReplies as c, sendMessageSignal as d, sendReadReceiptSignal as f, streamSignalEvents as g, signalRpcRequest as h, applyReplyTagsToPayload as i, createReplyToModeFilterForChannel as l, signalCheck as m, deliver_exports as n, filterMessagingToolDuplicates as o, sendTypingSignal as p, normalizeReplyPayloadsForDelivery as r, isRenderablePayload as s, deliverOutboundPayloads as t, resolveReplyToMode as u, normalizeChannelTargetInput as v, SILENT_REPLY_TOKEN as w, splitMediaFromOutput as x, normalizeTargetForProvider as y };