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
 * Clear all pending tasks from all command lanes.
 * Active tasks will continue running but no new tasks will be started from queues.
 * Used during graceful shutdown to speed up cleanup.
 */
export declare function clearAllCommandLanes(): number;
