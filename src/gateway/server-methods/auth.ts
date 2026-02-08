import type { GatewayRequestHandlers } from "./types.js";
import { resolveAgentDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { upsertAuthProfile } from "../../agents/auth-profiles.js";
import { applyAuthProfileConfig } from "../../commands/onboard-auth.js";
import { loadConfig, readConfigFileSnapshot, writeConfigFile } from "../../config/config.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

export const authHandlers: GatewayRequestHandlers = {
  /**
   * Save an OAuth credential to auth-profiles.json and update config metadata.
   * Used by the UI OAuth callback to persist Google Antigravity credentials.
   *
   * Params:
   *   profileId: string — e.g. "google-antigravity:default"
   *   provider: string — e.g. "google-antigravity"
   *   credential: { type, refresh, access, expires, provider, email?, projectId?, clientId? }
   *   setDefault?: boolean — if true, update default model to provider
   *   defaultModel?: string — model ref to set as default e.g. "google-antigravity/claude-opus-4-6"
   */
  "auth.profile.upsert": async ({ params, respond }) => {
    const profileId = (params as { profileId?: string }).profileId?.trim();
    const provider = (params as { provider?: string }).provider?.trim();
    const credential = (params as { credential?: Record<string, unknown> }).credential;

    if (!profileId || !provider || !credential) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "auth.profile.upsert requires profileId, provider, and credential",
        ),
      );
      return;
    }

    // Validate credential has required fields
    const credType = credential.type as string;
    if (!["api_key", "oauth", "token"].includes(credType)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `invalid credential type: ${credType}`),
      );
      return;
    }

    try {
      const config = loadConfig();
      const defaultAgentId = resolveDefaultAgentId(config);
      const agentDir = resolveAgentDir(config, defaultAgentId);

      // 1. Save actual credential to auth-profiles.json on disk
      upsertAuthProfile({
        profileId,
        credential: {
          ...credential,
          type: credType,
          provider,
        } as Parameters<typeof upsertAuthProfile>[0]["credential"],
        agentDir,
      });

      // 2. Update config metadata (auth.profiles section in openclaw.json)
      const snapshot = await readConfigFileSnapshot();
      if (!snapshot.valid) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid config"));
        return;
      }

      const mode = credType === "api_key" ? "api_key" : credType === "token" ? "token" : "oauth";
      let updatedConfig = applyAuthProfileConfig(snapshot.config, {
        profileId,
        provider,
        mode: mode as "api_key" | "oauth" | "token",
        email: credential.email as string | undefined,
      });

      // 3. If defaultModel is set, apply it
      const defaultModel = (params as { defaultModel?: string }).defaultModel?.trim();
      const setDefault = (params as { setDefault?: boolean }).setDefault;
      if (setDefault && defaultModel) {
        const models = { ...updatedConfig.agents?.defaults?.models };
        models[defaultModel] = models[defaultModel] ?? {};
        const existingModel = updatedConfig.agents?.defaults?.model;
        updatedConfig = {
          ...updatedConfig,
          agents: {
            ...updatedConfig.agents,
            defaults: {
              ...updatedConfig.agents?.defaults,
              models,
              model: {
                ...(existingModel &&
                typeof existingModel === "object" &&
                "fallbacks" in existingModel
                  ? { fallbacks: (existingModel as { fallbacks?: string[] }).fallbacks }
                  : undefined),
                primary: defaultModel,
              },
            },
          },
        };
      }

      await writeConfigFile(updatedConfig);

      // 4. Schedule gateway restart to pick up the new auth profile
      scheduleGatewaySigusr1Restart({ reason: "auth-profile-upsert" });

      respond(
        true,
        {
          ok: true,
          profileId,
          provider,
          email: credential.email ?? null,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `Failed to save auth profile: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },
};
