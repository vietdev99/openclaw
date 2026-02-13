export declare function setCommandLaneConcurrency(lane: string, maxConcurrent: number): void;
export declare function enqueueCommandInLane<T>(lane: string, task: () => Promise<T>, opts?: {
    warnAfterMs?: number;
    onWait?: (waitMs: number, queuedAhead: number) => void;
}): Promise<T>;
export declare function enqueueCommand<T>(task: () => Promise<T>, opts?: {
    warnAfterMs?: number;
    onWait?: (waitMs: number, queuedAhead: number) => void;
}): Promise<T>;
export declare function getQueueSize(lane?: string): number;
export declare function getTotalQueueSize(): number;
export declare function clearCommandLane(lane?: string): number;
/**
 * Returns the total number of actively executing tasks across all lanes
 * (excludes queued-but-not-started entries).
 */
export declare function getActiveTaskCount(): number;
/**
 * Wait for all currently active tasks across all lanes to finish.
 * Polls at a short interval; resolves when no tasks are active or
 * when `timeoutMs` elapses (whichever comes first).
 *
 * New tasks enqueued after this call are ignored — only tasks that are
 * already executing are waited on.
 */
export declare function waitForActiveTasks(timeoutMs: number): Promise<{
    drained: boolean;
}>;
