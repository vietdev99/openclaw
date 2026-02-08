/**
 * Deferred reply handling for long-running media processing.
 *
 * When audio/video transcription takes too long, instead of blocking:
 * 1. Send a placeholder message immediately
 * 2. Run transcription in background
 * 3. When done, edit placeholder with AI response
 */
import type { OpenClawConfig } from "../config/config.js";
import type { MsgContext } from "../auto-reply/templating.js";
import type { MediaUnderstandingOutput } from "./types.js";
export type DeferredReplyConfig = {
    /** Enable async mode for audio processing */
    asyncAudioEnabled: boolean;
    /** Estimated threshold in seconds to switch to async mode */
    asyncThresholdSeconds: number;
};
/**
 * Resolve deferred reply config from OpenClawConfig.
 */
export declare function resolveDeferredReplyConfig(cfg: OpenClawConfig): DeferredReplyConfig;
/**
 * Check if we should use deferred processing for audio.
 */
export declare function shouldUseDeferredProcessing(ctx: MsgContext, cfg: OpenClawConfig): boolean;
export type StartDeferredAudioParams = {
    ctx: MsgContext;
    cfg: OpenClawConfig;
    channelType: string;
    channelId: string;
    messageId: string;
    sessionKey: string;
    runTranscription: () => Promise<MediaUnderstandingOutput | null>;
    onReplyReady: (transcript: string, ctx: MsgContext) => Promise<string>;
};
/**
 * Start deferred audio processing.
 *
 * 1. Creates a pending task
 * 2. Sends placeholder message
 * 3. Runs transcription in background
 * 4. Calls onReplyReady when done to get AI response
 * 5. Edits placeholder with final response
 */
export declare function startDeferredAudioProcessing(params: StartDeferredAudioParams): Promise<{
    taskId: string;
    placeholderSent: boolean;
}>;
/**
 * Check if a session has pending deferred tasks.
 */
export declare function hasPendingDeferredTasks(sessionKey: string): boolean;
