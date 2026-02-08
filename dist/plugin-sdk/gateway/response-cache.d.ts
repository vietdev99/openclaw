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
    fullText: string;
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
    appendChunk: (idempotencyKey: string, chunk: {
        seq: number;
        text: string;
    }) => void;
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
    stats: () => {
        size: number;
        oldestAt: number | null;
    };
};
export declare function createResponseCache(options?: ResponseCacheOptions): ResponseCache;
