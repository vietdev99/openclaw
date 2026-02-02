export { applyMediaUnderstanding } from "./apply.js";
export { formatMediaUnderstandingBody } from "./format.js";
export { resolveMediaUnderstandingScope } from "./scope.js";
export type {
  MediaAttachment,
  MediaUnderstandingOutput,
  MediaUnderstandingProvider,
  MediaUnderstandingKind,
} from "./types.js";

// Deferred reply (async audio processing)
export {
  shouldUseDeferredProcessing,
  startDeferredAudioProcessing,
  resolveDeferredReplyConfig,
  hasPendingDeferredTasks,
} from "./deferred-reply.js";
export type { DeferredReplyConfig, StartDeferredAudioParams } from "./deferred-reply.js";

// Pending tasks
export {
  createPendingTask,
  getPendingTask,
  getPendingTasksBySession,
  getPendingTasksByChannel,
  updateTaskStatus,
  deletePendingTask,
  getActivePendingTaskCount,
  clearAllPendingTasks,
} from "./pending-tasks.js";
export type { PendingMediaTask, PendingMediaTaskStatus } from "./pending-tasks.js";

// Background processor
export {
  startBackgroundProcessing,
  updateBackgroundProgress,
  finishBackgroundTask,
} from "./background-processor.js";
export type { BackgroundProcessorParams } from "./background-processor.js";

// Media events
export { emitMediaEvent, onMediaEvent, removeMediaEventListener } from "./media-events.js";
export type { MediaEventPayload, MediaEventType } from "./media-events.js";

// Channel messenger
export { sendChannelMessage, editChannelMessage } from "./channel-messenger.js";
export type {
  SendMessageParams,
  SendMessageResult,
  EditMessageParams,
  EditMessageResult,
} from "./channel-messenger.js";
