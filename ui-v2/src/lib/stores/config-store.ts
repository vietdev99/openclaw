import { create } from "zustand";
import type { ConfigSnapshot, OpenClawConfig } from "@/types/config";

// Pending change entry
export interface PendingChange {
  id: string;
  type: "provider-add" | "provider-update" | "provider-delete";
  path: string; // e.g., 'models.providers.anthropic'
  description: string;
  patch: Record<string, unknown>;
  timestamp: number;
}

interface ConfigState {
  snapshot: ConfigSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Pending changes (soft save)
  pendingChanges: PendingChange[];
  hasPendingChanges: boolean;

  // Actions
  setSnapshot: (snapshot: ConfigSnapshot) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  updateConfig: (config: Partial<OpenClawConfig>) => void;

  // Pending changes actions
  addPendingChange: (change: Omit<PendingChange, "id" | "timestamp">) => void;
  removePendingChange: (id: string) => void;
  clearPendingChanges: () => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  snapshot: null,
  loading: false,
  saving: false,
  error: null,
  pendingChanges: [],
  hasPendingChanges: false,

  setSnapshot: (snapshot) => set({ snapshot, error: null }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),

  updateConfig: (partialConfig) => {
    const { snapshot } = get();
    if (!snapshot) return;

    set({
      snapshot: {
        ...snapshot,
        config: {
          ...snapshot.config,
          ...partialConfig,
        },
      },
    });
  },

  addPendingChange: (change) => {
    const id = `${change.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newChange: PendingChange = {
      ...change,
      id,
      timestamp: Date.now(),
    };

    set((state) => ({
      pendingChanges: [...state.pendingChanges, newChange],
      hasPendingChanges: true,
    }));
  },

  removePendingChange: (id) => {
    set((state) => {
      const pendingChanges = state.pendingChanges.filter((c) => c.id !== id);
      return {
        pendingChanges,
        hasPendingChanges: pendingChanges.length > 0,
      };
    });
  },

  clearPendingChanges: () => {
    set({ pendingChanges: [], hasPendingChanges: false });
  },
}));

// Helper to load config from gateway
export async function loadConfig(
  request: <T>(method: string, params?: unknown) => Promise<T>,
): Promise<ConfigSnapshot> {
  const snapshot = await request<ConfigSnapshot>("config.get", {});
  useConfigStore.getState().setSnapshot(snapshot);
  return snapshot;
}

// Helper to save config via patch (triggers gateway restart)
export async function patchConfig(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  patch: Partial<OpenClawConfig>,
): Promise<void> {
  const { snapshot } = useConfigStore.getState();
  if (!snapshot?.hash) {
    throw new Error("No config loaded");
  }

  useConfigStore.getState().setSaving(true);
  useConfigStore.getState().setError(null);

  try {
    await request("config.patch", {
      raw: JSON.stringify(patch),
      baseHash: snapshot.hash,
    });

    // Reload after successful patch
    await loadConfig(request);
  } catch (e) {
    useConfigStore.getState().setError(String(e));
    throw e;
  } finally {
    useConfigStore.getState().setSaving(false);
  }
}

// Merge all pending changes into a single patch object
export function mergePendingChanges(): Record<string, unknown> {
  const { pendingChanges } = useConfigStore.getState();
  let merged: Record<string, unknown> = {};

  for (const change of pendingChanges) {
    merged = deepMerge(merged, change.patch);
  }

  return merged;
}

// Deep merge utility
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Apply all pending changes (writes config file, NO gateway restart)
export async function applyPendingChanges(
  request: <T>(method: string, params?: unknown) => Promise<T>,
): Promise<{ ok: boolean; error?: string }> {
  const store = useConfigStore.getState();
  const { snapshot, pendingChanges } = store;

  if (!snapshot?.hash) {
    return { ok: false, error: "No config loaded" };
  }

  if (pendingChanges.length === 0) {
    return { ok: true };
  }

  store.setSaving(true);
  store.setError(null);

  try {
    const patch = mergePendingChanges();
    console.log("Applying pending changes:", patch);

    // Use config.set to write without triggering restart
    // First, merge patch with current config
    const mergedConfig = deepMerge(snapshot.config as Record<string, unknown>, patch);

    const result = await request<{ ok: boolean; error?: string }>("config.set", {
      baseHash: snapshot.hash,
      raw: JSON.stringify(mergedConfig),
    });

    if (result.ok) {
      store.clearPendingChanges();
      // Reload config to get new hash
      await loadConfig(request);
      return { ok: true };
    } else {
      store.setError(result.error ?? "Failed to apply changes");
      return { ok: false, error: result.error };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    store.setError(error);
    return { ok: false, error };
  } finally {
    store.setSaving(false);
  }
}

// Reload gateway by sending a no-op config.patch to trigger restart
export async function reloadGateway(
  request: <T>(method: string, params?: unknown) => Promise<T>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Get current config hash first
    const configResult = await request<{ hash?: string }>("config.get", {});
    const baseHash = configResult?.hash;
    if (!baseHash) {
      return { ok: false, error: "Could not get current config hash" };
    }
    // Send empty patch to trigger gateway restart
    await request<{ ok: boolean }>("config.patch", {
      raw: "{}",
      baseHash,
      restartDelayMs: 500,
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}
