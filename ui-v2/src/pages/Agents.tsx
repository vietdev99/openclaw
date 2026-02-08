import { Save, Plus, X, GripVertical, Bot, Cpu, Image, FolderOpen, Zap } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { ModelConfig } from "@/types/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useGateway } from "@/lib/gateway-context";
import { useConfigStore, loadConfig, patchConfig } from "@/lib/stores/config-store";
import { PROVIDER_METADATA } from "@/types/auth";

interface AggregatedModel {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  fullId: string; // provider/modelId
  reasoning?: boolean;
  input?: ("text" | "image")[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input: number; output: number };
}

export function Agents() {
  const { connected, request } = useGateway();
  const { snapshot, saving } = useConfigStore();

  // Form state
  const [primaryModel, setPrimaryModel] = useState("");
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [imageModel, setImageModel] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState(4);
  const [subagentMaxConcurrent, setSubagentMaxConcurrent] = useState(8);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Load config on mount
  useEffect(() => {
    if (connected && !snapshot) {
      loadConfig(request).catch(console.error);
    }
  }, [connected, request, snapshot]);

  // Fetch models from gateway (includes plugin providers like google-antigravity)
  const [gatewayModels, setGatewayModels] = useState<
    Array<{
      id: string;
      name: string;
      provider: string;
      contextWindow?: number;
      reasoning?: boolean;
      input?: ("text" | "image")[];
    }>
  >([]);

  useEffect(() => {
    if (!connected) return;
    request<{ models: typeof gatewayModels }>("models.list", {})
      .then((res) => {
        if (res?.models) setGatewayModels(res.models);
      })
      .catch(console.error);
  }, [connected, request]);

  // Aggregate all available models from config providers + gateway catalog
  const allModels = useMemo<AggregatedModel[]>(() => {
    const models: AggregatedModel[] = [];
    const seen = new Set<string>();

    // Determine which providers the user has actually configured
    const configuredProviders = new Set<string>();
    if (snapshot?.config?.models?.providers) {
      for (const providerId of Object.keys(snapshot.config.models.providers)) {
        configuredProviders.add(providerId);
      }
    }
    // Also include providers that have auth profiles (e.g. google-antigravity)
    if (snapshot?.config?.auth?.profiles) {
      for (const profile of Object.values(snapshot.config.auth.profiles)) {
        const provider = (profile as { provider?: string }).provider;
        if (provider) configuredProviders.add(provider);
      }
    }

    // 1. Models from config providers (have full details like cost, maxTokens)
    if (snapshot?.config?.models?.providers) {
      for (const [providerId, providerConfig] of Object.entries(snapshot.config.models.providers)) {
        const providerName = PROVIDER_METADATA[providerId]?.name ?? providerId;
        for (const model of providerConfig.models ?? []) {
          const fullId = `${providerId}/${model.id}`;
          seen.add(fullId);
          models.push({
            providerId,
            providerName,
            modelId: model.id,
            modelName: model.name,
            fullId,
            reasoning: model.reasoning,
            input: model.input,
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
            cost: model.cost ? { input: model.cost.input, output: model.cost.output } : undefined,
          });
        }
      }
    }

    // 2. Models from gateway catalog — only for configured providers
    for (const gm of gatewayModels) {
      if (!configuredProviders.has(gm.provider)) continue; // Skip unconfigured providers
      const fullId = `${gm.provider}/${gm.id}`;
      if (seen.has(fullId)) continue; // Don't duplicate
      seen.add(fullId);
      const providerName = PROVIDER_METADATA[gm.provider]?.name ?? gm.provider;
      models.push({
        providerId: gm.provider,
        providerName,
        modelId: gm.id,
        modelName: gm.name || gm.id,
        fullId,
        reasoning: gm.reasoning,
        input: gm.input,
        contextWindow: gm.contextWindow,
      });
    }

    return models;
  }, [snapshot, gatewayModels]);

  // Group models by provider for dropdown
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, AggregatedModel[]> = {};
    for (const model of allModels) {
      if (!groups[model.providerName]) {
        groups[model.providerName] = [];
      }
      groups[model.providerName].push(model);
    }
    return groups;
  }, [allModels]);

  // Vision-capable models for image model dropdown
  const visionModels = useMemo(
    () => allModels.filter((m) => m.input?.includes("image")),
    [allModels],
  );

  // Load current agent config into form
  useEffect(() => {
    if (snapshot?.config?.agents?.defaults) {
      const defaults = snapshot.config.agents.defaults;
      setPrimaryModel(defaults.model?.primary ?? "");
      setFallbacks(defaults.model?.fallbacks ?? []);
      setImageModel(defaults.imageModel?.primary ?? "");
      setWorkspace(defaults.workspace ?? "");
      setMaxConcurrent(defaults.maxConcurrent ?? 4);
      setSubagentMaxConcurrent(defaults.subagents?.maxConcurrent ?? 8);
      setDirty(false);
    }
  }, [snapshot]);

  const handleSave = async () => {
    if (!snapshot?.hash) return;

    setSaveStatus("saving");
    try {
      await patchConfig(request, {
        agents: {
          defaults: {
            model: {
              primary: primaryModel || undefined,
              fallbacks: fallbacks.length > 0 ? fallbacks : undefined,
            },
            imageModel: {
              primary: imageModel || undefined,
            },
            workspace: workspace || undefined,
            maxConcurrent,
            subagents: {
              maxConcurrent: subagentMaxConcurrent,
            },
          },
        },
      });

      await new Promise((r) => setTimeout(r, 1000));
      await loadConfig(request);
      setDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save agent config:", err);
      setSaveStatus("idle");
    }
  };

  const markDirty = () => setDirty(true);

  const addFallback = (modelId: string) => {
    if (modelId && !fallbacks.includes(modelId)) {
      setFallbacks([...fallbacks, modelId]);
      markDirty();
    }
  };

  const removeFallback = (idx: number) => {
    setFallbacks(fallbacks.filter((_, i) => i !== idx));
    markDirty();
  };

  const moveFallback = (from: number, to: number) => {
    const newFallbacks = [...fallbacks];
    const [item] = newFallbacks.splice(from, 1);
    newFallbacks.splice(to, 0, item);
    setFallbacks(newFallbacks);
    markDirty();
  };

  const getModelDisplayName = (fullId: string) => {
    const model = allModels.find((m) => m.fullId === fullId);
    return model ? `${model.modelName}` : fullId;
  };

  const getModelProvider = (fullId: string) => {
    const model = allModels.find((m) => m.fullId === fullId);
    return model?.providerName ?? fullId.split("/")[0];
  };

  if (!connected) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-500">Connecting to gateway...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Configuration</h1>
          <p className="text-sm text-gray-500">
            Configure model selection, fallbacks, and runtime settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-2 h-4 w-4" />
          {saveStatus === "saving"
            ? "Saving..."
            : saveStatus === "saved"
              ? "✓ Saved"
              : "Save Changes"}
        </Button>
      </div>

      {allModels.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Bot className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-medium text-gray-600">No models configured</p>
            <p className="mt-1 text-sm text-gray-500">Add providers with model definitions first</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Primary Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              Primary Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-500">The main model used for all agent tasks</p>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              value={primaryModel}
              onChange={(e) => {
                setPrimaryModel(e.target.value);
                markDirty();
              }}
            >
              <option value="">Select a model...</option>
              {Object.entries(modelsByProvider).map(([providerName, models]) => (
                <optgroup key={providerName} label={providerName}>
                  {models.map((m) => (
                    <option key={m.fullId} value={m.fullId}>
                      {m.modelName} ({m.modelId})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {primaryModel && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="default">{getModelProvider(primaryModel)}</Badge>
                <span className="text-xs text-gray-500">{primaryModel}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Image className="h-4 w-4" />
              Image Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-500">Model used for image/vision tasks</p>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              value={imageModel}
              onChange={(e) => {
                setImageModel(e.target.value);
                markDirty();
              }}
            >
              <option value="">Select a model...</option>
              {/* Show all models, but highlight vision-capable */}
              {Object.entries(modelsByProvider).map(([providerName, models]) => (
                <optgroup key={providerName} label={providerName}>
                  {models.map((m) => (
                    <option key={m.fullId} value={m.fullId}>
                      {m.modelName} {m.input?.includes("image") ? "📷" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {imageModel && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="default">{getModelProvider(imageModel)}</Badge>
                <span className="text-xs text-gray-500">{imageModel}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fallback Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Fallback Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-gray-500">
            Models tried in order when the primary model is unavailable. Drag to reorder priority.
          </p>

          {fallbacks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-4 text-center text-sm text-gray-400 dark:border-gray-700">
              No fallback models configured
            </div>
          ) : (
            <div className="space-y-2">
              {fallbacks.map((fb, idx) => (
                <div
                  key={`${fb}-${idx}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-center gap-1 text-gray-400">
                    {idx > 0 && (
                      <button
                        className="hover:text-gray-600 p-0.5"
                        onClick={() => moveFallback(idx, idx - 1)}
                        title="Move up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < fallbacks.length - 1 && (
                      <button
                        className="hover:text-gray-600 p-0.5"
                        onClick={() => moveFallback(idx, idx + 1)}
                        title="Move down"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    #{idx + 1}
                  </Badge>
                  <span className="flex-1 text-sm font-medium">{getModelDisplayName(fb)}</span>
                  <Badge variant="default" className="text-xs">
                    {getModelProvider(fb)}
                  </Badge>
                  <code className="text-[10px] text-gray-400">{fb}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFallback(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add fallback selector */}
          <div className="mt-3">
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              value=""
              onChange={(e) => addFallback(e.target.value)}
            >
              <option value="">+ Add fallback model...</option>
              {Object.entries(modelsByProvider).map(([providerName, models]) => (
                <optgroup key={providerName} label={providerName}>
                  {models
                    .filter((m) => m.fullId !== primaryModel && !fallbacks.includes(m.fullId))
                    .map((m) => (
                      <option key={m.fullId} value={m.fullId}>
                        {m.modelName} ({m.modelId})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Runtime Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />
            Runtime Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workspace */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
              Workspace Path
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                markDirty();
              }}
              placeholder="~/.openclaw/workspace"
            />
            <p className="mt-1 text-xs text-gray-500">Directory for agent workspace files</p>
          </div>

          {/* Concurrency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Concurrent Agents
              </label>
              <input
                type="number"
                min={1}
                max={16}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
                value={maxConcurrent}
                onChange={(e) => {
                  setMaxConcurrent(Number(e.target.value));
                  markDirty();
                }}
              />
              <p className="mt-1 text-xs text-gray-500">Main agent concurrency limit</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Concurrent Subagents
              </label>
              <input
                type="number"
                min={1}
                max={32}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
                value={subagentMaxConcurrent}
                onChange={(e) => {
                  setSubagentMaxConcurrent(Number(e.target.value));
                  markDirty();
                }}
              />
              <p className="mt-1 text-xs text-gray-500">Subagent concurrency limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Models Summary */}
      {allModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Available Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Provider</th>
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Context</th>
                    <th className="pb-2 pr-4">Max Tokens</th>
                    <th className="pb-2">Vision</th>
                  </tr>
                </thead>
                <tbody>
                  {allModels.map((m) => (
                    <tr key={m.fullId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className="text-xs">
                          {m.providerName}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-medium">{m.modelName}</td>
                      <td className="py-2 pr-4">
                        <code className="text-xs text-gray-500">{m.fullId}</code>
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {m.maxTokens ? `${(m.maxTokens / 1000).toFixed(0)}k` : "—"}
                      </td>
                      <td className="py-2 text-xs">{m.input?.includes("image") ? "📷" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
