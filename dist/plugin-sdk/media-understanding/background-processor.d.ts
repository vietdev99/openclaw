/**
 * Background processor for long-running media understanding tasks.
 * Handles async audio/video transcription with progress updates and deferred replies.
 */
import type { OpenClawConfig } from "../config/config.js";
import type { MsgContext } from "../auto-reply/templating.js";
import { type PendingMediaTask } from "./pending-tasks.js";
import type { MediaUnderstandingOutput } from "./types.js";
export type BackgroundProcessorParams = {
    taskId: string;
    cfg: OpenClawConfig;
    ctx: MsgContext;
    runTranscription: () => Promise<MediaUnderstandingOutput | null>;
    onComplete?: (task: PendingMediaTask, result: MediaUnderstandingOutput | null) => Promise<void>;
};
/**
 * Send a placeholder message and start background processing.
 * Returns immediately after sending placeholder.
 */
export declare function startBackgroundProcessing(params: BackgroundProcessorParams): Promise<{
    placeholderSent: boolean;
    error?: string;
}>;
/**
 * Update the placeholder message with progress.
 */
export declare function updateBackgroundProgress(taskId: string, progress: number, cfg: OpenClawConfig): Promise<void>;
/**
 * Edit the placeholder message with the final result.
 */
export declare function finishBackgroundTask(taskId: string, finalText: string, cfg: OpenClawConfig): Promise<{
    ok: boolean;
    error?: string;
}>;
