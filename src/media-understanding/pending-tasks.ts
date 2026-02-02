import crypto from "node:crypto";

import type { MediaUnderstandingOutput } from "./types.js";

export type PendingMediaTaskStatus = "pending" | "processing" | "complete" | "failed";

export type PendingMediaTask = {
  id: string;
  channelId: string;
  channelType: string;
  messageId: string;
  sessionKey: string;
  capability: "audio" | "image" | "video";
  status: PendingMediaTaskStatus;
  result?: MediaUnderstandingOutput;
  error?: string;
  progress?: number;
  placeholderMessageId?: string;
  createdAt: number;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

const pendingTasks = new Map<string, PendingMediaTask>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function generateTaskId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function createPendingTask(params: {
  channelId: string;
  channelType: string;
  messageId: string;
  sessionKey: string;
  capability: "audio" | "image" | "video";
  ttlMs?: number;
}): PendingMediaTask {
  const id = generateTaskId();
  const now = Date.now();
  const task: PendingMediaTask = {
    id,
    channelId: params.channelId,
    channelType: params.channelType,
    messageId: params.messageId,
    sessionKey: params.sessionKey,
    capability: params.capability,
    status: "pending",
    createdAt: now,
    expiresAt: now + (params.ttlMs ?? DEFAULT_TTL_MS),
  };
  pendingTasks.set(id, task);
  ensureCleanupTimer();
  return task;
}

export function getPendingTask(taskId: string): PendingMediaTask | undefined {
  const task = pendingTasks.get(taskId);
  if (!task) {
    return undefined;
  }
  if (Date.now() > task.expiresAt) {
    pendingTasks.delete(taskId);
    return undefined;
  }
  return task;
}

export function updateTaskStatus(
  taskId: string,
  status: PendingMediaTaskStatus,
  updates?: Partial<Pick<PendingMediaTask, "result" | "error" | "progress" | "placeholderMessageId">>,
): PendingMediaTask | undefined {
  const task = pendingTasks.get(taskId);
  if (!task) {
    return undefined;
  }
  task.status = status;
  if (updates?.result !== undefined) {
    task.result = updates.result;
  }
  if (updates?.error !== undefined) {
    task.error = updates.error;
  }
  if (updates?.progress !== undefined) {
    task.progress = updates.progress;
  }
  if (updates?.placeholderMessageId !== undefined) {
    task.placeholderMessageId = updates.placeholderMessageId;
  }
  return task;
}

export function setTaskPlaceholderMessageId(
  taskId: string,
  placeholderMessageId: string,
): void {
  const task = pendingTasks.get(taskId);
  if (task) {
    task.placeholderMessageId = placeholderMessageId;
  }
}

export function deletePendingTask(taskId: string): boolean {
  return pendingTasks.delete(taskId);
}

export function getPendingTasksBySession(sessionKey: string): PendingMediaTask[] {
  const now = Date.now();
  const tasks: PendingMediaTask[] = [];
  for (const task of pendingTasks.values()) {
    if (task.sessionKey === sessionKey && now <= task.expiresAt) {
      tasks.push(task);
    }
  }
  return tasks;
}

export function getPendingTasksByChannel(channelId: string): PendingMediaTask[] {
  const now = Date.now();
  const tasks: PendingMediaTask[] = [];
  for (const task of pendingTasks.values()) {
    if (task.channelId === channelId && now <= task.expiresAt) {
      tasks.push(task);
    }
  }
  return tasks;
}

function cleanupExpiredTasks(): void {
  const now = Date.now();
  for (const [taskId, task] of pendingTasks) {
    if (now > task.expiresAt) {
      pendingTasks.delete(taskId);
    }
  }
  if (pendingTasks.size === 0 && cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

function ensureCleanupTimer(): void {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(cleanupExpiredTasks, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

export function getActivePendingTaskCount(): number {
  cleanupExpiredTasks();
  return pendingTasks.size;
}

// For testing
export function clearAllPendingTasks(): void {
  pendingTasks.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
