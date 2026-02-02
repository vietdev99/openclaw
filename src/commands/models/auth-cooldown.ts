import { resolveAgentDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { clearAuthProfileCooldown } from "../../agents/auth-profiles/usage.js";
import { loadConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";
import { shortenHomePath } from "../../utils.js";
import { resolveKnownAgentId } from "./shared.js";

function resolveTargetAgent(
  cfg: ReturnType<typeof loadConfig>,
  raw?: string,
): {
  agentId: string;
  agentDir: string;
} {
  const agentId = resolveKnownAgentId({ cfg, rawAgentId: raw }) ?? resolveDefaultAgentId(cfg);
  const agentDir = resolveAgentDir(cfg, agentId);
  return { agentId, agentDir };
}

export async function modelsAuthClearCooldownCommand(
  opts: { profileId: string; agent?: string; all?: boolean },
  runtime: RuntimeEnv,
) {
  const cfg = loadConfig();
  const { agentId, agentDir } = resolveTargetAgent(cfg, opts.agent);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
  });

  if (opts.all) {
    // Clear cooldown for all profiles
    const profileIds = Object.keys(store.profiles);
    if (profileIds.length === 0) {
      runtime.log("No auth profiles found.");
      return;
    }

    let clearedCount = 0;
    for (const profileId of profileIds) {
      const stats = store.usageStats?.[profileId];
      const hasCooldown =
        (stats?.cooldownUntil && stats.cooldownUntil > Date.now()) ||
        (stats?.disabledUntil && stats.disabledUntil > Date.now());

      if (hasCooldown) {
        await clearAuthProfileCooldown({
          store,
          profileId,
          agentDir,
        });
        clearedCount++;
        runtime.log(`Cleared cooldown for: ${profileId}`);
      }
    }

    if (clearedCount === 0) {
      runtime.log("No profiles are currently in cooldown.");
    } else {
      runtime.log(`\nCleared cooldown for ${clearedCount} profile(s).`);
    }
    return;
  }

  // Clear cooldown for specific profile
  const profileId = opts.profileId?.trim();
  if (!profileId) {
    throw new Error("Missing profile id. Usage: openclaw models auth clear-cooldown <profileId>");
  }

  const profile = store.profiles[profileId];
  if (!profile) {
    const available = Object.keys(store.profiles);
    throw new Error(
      `Auth profile "${profileId}" not found.\nAvailable profiles: ${available.length > 0 ? available.join(", ") : "(none)"}`,
    );
  }

  const stats = store.usageStats?.[profileId];
  const cooldownUntil = stats?.cooldownUntil;
  const disabledUntil = stats?.disabledUntil;
  const now = Date.now();

  const hasCooldown =
    (cooldownUntil && cooldownUntil > now) || (disabledUntil && disabledUntil > now);

  if (!hasCooldown) {
    runtime.log(`Profile "${profileId}" is not in cooldown.`);
    return;
  }

  await clearAuthProfileCooldown({
    store,
    profileId,
    agentDir,
  });

  runtime.log(`Agent: ${agentId}`);
  runtime.log(`Auth file: ${shortenHomePath(`${agentDir}/auth-profiles.json`)}`);
  runtime.log(`Cleared cooldown for profile: ${profileId}`);
  runtime.log(`Provider: ${profile.provider}`);
  if (stats?.disabledReason) {
    runtime.log(`Previous failure reason: ${stats.disabledReason}`);
  }
  runtime.log("\nThe profile is now available for use immediately.");
}

export async function modelsAuthListCooldownsCommand(
  opts: { agent?: string; json?: boolean },
  runtime: RuntimeEnv,
) {
  const cfg = loadConfig();
  const { agentId, agentDir } = resolveTargetAgent(cfg, opts.agent);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
  });

  const now = Date.now();
  const cooldowns: Array<{
    profileId: string;
    provider: string;
    reason?: string;
    cooldownUntil?: number;
    disabledUntil?: number;
    remainingMs: number;
  }> = [];

  for (const [profileId, profile] of Object.entries(store.profiles)) {
    const stats = store.usageStats?.[profileId];
    if (!stats) continue;

    const cooldownUntil = stats.cooldownUntil ?? 0;
    const disabledUntil = stats.disabledUntil ?? 0;
    const maxUntil = Math.max(cooldownUntil, disabledUntil);

    if (maxUntil > now) {
      cooldowns.push({
        profileId,
        provider: profile.provider,
        reason: stats.disabledReason,
        cooldownUntil: cooldownUntil > now ? cooldownUntil : undefined,
        disabledUntil: disabledUntil > now ? disabledUntil : undefined,
        remainingMs: maxUntil - now,
      });
    }
  }

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          agentId,
          agentDir,
          cooldowns,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(`Agent: ${agentId}`);
  runtime.log(`Auth file: ${shortenHomePath(`${agentDir}/auth-profiles.json`)}`);
  runtime.log("");

  if (cooldowns.length === 0) {
    runtime.log("No profiles are currently in cooldown.");
    return;
  }

  runtime.log(`Profiles in cooldown (${cooldowns.length}):\n`);
  for (const entry of cooldowns) {
    const remainingMin = Math.ceil(entry.remainingMs / 60000);
    const remainingStr =
      remainingMin >= 60
        ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m`
        : `${remainingMin}m`;

    runtime.log(`  ${entry.profileId}`);
    runtime.log(`    Provider: ${entry.provider}`);
    if (entry.reason) {
      runtime.log(`    Reason: ${entry.reason}`);
    }
    runtime.log(`    Remaining: ${remainingStr}`);
    runtime.log("");
  }

  runtime.log(`To clear a cooldown: openclaw models auth clear-cooldown <profileId>`);
  runtime.log(`To clear all: openclaw models auth clear-cooldown --all`);
}
