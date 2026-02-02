import type { MediaUnderstandingOutput } from "./types.js";

export type MediaEventType = "pending" | "processing" | "progress" | "complete" | "failed";

export type MediaEventPayload = {
  type: MediaEventType;
  taskId: string;
  channelId: string;
  channelType: string;
  messageId: string;
  sessionKey: string;
  capability: "audio" | "image" | "video";
  progress?: number;
  result?: MediaUnderstandingOutput;
  error?: string;
  timestamp: number;
};

type MediaEventListener = (event: MediaEventPayload) => void;

const listeners = new Set<MediaEventListener>();

export function emitMediaEvent(
  event: Omit<MediaEventPayload, "timestamp">,
): void {
  const payload: MediaEventPayload = {
    ...event,
    timestamp: Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // Ignore listener errors
    }
  }
}

export function onMediaEvent(listener: MediaEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function removeMediaEventListener(listener: MediaEventListener): void {
  listeners.delete(listener);
}

export function getMediaEventListenerCount(): number {
  return listeners.size;
}

// For testing
export function clearMediaEventListeners(): void {
  listeners.clear();
}
