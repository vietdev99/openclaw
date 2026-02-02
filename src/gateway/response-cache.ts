/**
 * Response Cache for Stream Resume
 *
 * Caches streaming response chunks to enable resume when connection drops.
 * Uses idempotencyKey as the cache key.
 *
 * Pattern: Client sends request with idempotencyKey, if connection drops,
 * client retries with same key and receives cached chunks first,
 * then continues from where the stream left off.
 */

export type CachedChunk = {
  seq: number;
  text: string;
  timestamp: number;
};

export type CachedResponse = {
  idempotencyKey: string;
  sessionKey: string;
  runId: string;
  chunks: CachedChunk[];
  fullText: string; // Accumulated text for quick replay
  status: "streaming" | "complete" | "aborted" | "error";
  startedAt: number;
  expiresAt: number;
  lastChunkAt: number;
  errorMessage?: string;
};

export type ResponseCacheOptions = {
  /** TTL in milliseconds. Default: 5 minutes */
  ttlMs?: number;
  /** Max entries to keep. Default: 1000 */
  maxEntries?: number;
  /** Cleanup interval in ms. Default: 60 seconds */
  cleanupIntervalMs?: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export type ResponseCache = {
  /** Get cached response by idempotencyKey */
  get: (idempotencyKey: string) => CachedResponse | undefined;

  /** Start caching a new response */
  start: (params: {
    idempotencyKey: string;
    sessionKey: string;
    runId: string;
  }) => CachedResponse;

  /** Append a chunk to cached response */
  appendChunk: (idempotencyKey: string, chunk: { seq: number; text: string }) => void;

  /** Mark response as complete */
  complete: (idempotencyKey: string) => void;

  /** Mark response as aborted */
  abort: (idempotencyKey: string, reason?: string) => void;

  /** Mark response as error */
  error: (idempotencyKey: string, message?: string) => void;

  /** Remove cached response */
  remove: (idempotencyKey: string) => void;

  /** Clear all cache */
  clear: () => void;

  /** Stop cleanup timer */
  stop: () => void;

  /** Get cache stats */
  stats: () => { size: number; oldestAt: number | null };
};

export function createResponseCache(options: ResponseCacheOptions = {}): ResponseCache {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

  const cache = new Map<string, CachedResponse>();
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }

    // If still over limit, remove oldest entries
    if (cache.size > maxEntries) {
      const entries = [...cache.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt);
      const toRemove = entries.slice(0, cache.size - maxEntries);
      for (const [key] of toRemove) {
        cache.delete(key);
      }
    }
  };

  // Start cleanup timer
  cleanupTimer = setInterval(cleanup, cleanupIntervalMs);

  const get = (idempotencyKey: string): CachedResponse | undefined => {
    const entry = cache.get(idempotencyKey);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cache.delete(idempotencyKey);
      return undefined;
    }

    return entry;
  };

  const start = (params: {
    idempotencyKey: string;
    sessionKey: string;
    runId: string;
  }): CachedResponse => {
    const now = Date.now();
    const entry: CachedResponse = {
      idempotencyKey: params.idempotencyKey,
      sessionKey: params.sessionKey,
      runId: params.runId,
      chunks: [],
      fullText: "",
      status: "streaming",
      startedAt: now,
      expiresAt: now + ttlMs,
      lastChunkAt: now,
    };
    cache.set(params.idempotencyKey, entry);
    return entry;
  };

  const appendChunk = (idempotencyKey: string, chunk: { seq: number; text: string }) => {
    const entry = cache.get(idempotencyKey);
    if (!entry || entry.status !== "streaming") return;

    const now = Date.now();
    entry.chunks.push({
      seq: chunk.seq,
      text: chunk.text,
      timestamp: now,
    });
    entry.fullText = chunk.text; // The text is cumulative, not delta
    entry.lastChunkAt = now;
    // Extend TTL on activity
    entry.expiresAt = now + ttlMs;
  };

  const complete = (idempotencyKey: string) => {
    const entry = cache.get(idempotencyKey);
    if (!entry) return;
    entry.status = "complete";
    // Keep for shorter time after completion
    entry.expiresAt = Date.now() + ttlMs / 2;
  };

  const abort = (idempotencyKey: string, reason?: string) => {
    const entry = cache.get(idempotencyKey);
    if (!entry) return;
    entry.status = "aborted";
    entry.errorMessage = reason;
    // Keep aborted entries briefly for client to retrieve partial response
    entry.expiresAt = Date.now() + 60_000; // 1 minute
  };

  const error = (idempotencyKey: string, message?: string) => {
    const entry = cache.get(idempotencyKey);
    if (!entry) return;
    entry.status = "error";
    entry.errorMessage = message;
    entry.expiresAt = Date.now() + 60_000; // 1 minute
  };

  const remove = (idempotencyKey: string) => {
    cache.delete(idempotencyKey);
  };

  const clear = () => {
    cache.clear();
  };

  const stop = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  };

  const stats = () => {
    let oldestAt: number | null = null;
    for (const entry of cache.values()) {
      if (oldestAt === null || entry.startedAt < oldestAt) {
        oldestAt = entry.startedAt;
      }
    }
    return { size: cache.size, oldestAt };
  };

  return {
    get,
    start,
    appendChunk,
    complete,
    abort,
    error,
    remove,
    clear,
    stop,
    stats,
  };
}
