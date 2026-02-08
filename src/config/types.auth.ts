export type AuthProfileConfig = {
  provider: string;
  /**
   * Credential type expected in auth-profiles.json for this profile id.
   * - api_key: static provider API key
   * - oauth: refreshable OAuth credentials (access+refresh+expires)
   * - token: static bearer-style token (optionally expiring; no refresh)
   */
  mode: "api_key" | "oauth" | "token";
  email?: string;
  /** When true, this profile is excluded from routing (failover + loadbalance). */
  disabled?: boolean;
};

export type AuthProfileStrategy = "failover" | "loadbalance";

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  /**
   * Per-provider profile selection strategy.
   * - "failover": use lastGood profile first, switch to next on failure (default)
   * - "loadbalance": round-robin across profiles by least-recently-used
   */
  profileStrategy?: Record<string, AuthProfileStrategy>;
  cooldowns?: {
    /** Default billing backoff (hours). Default: 5. */
    billingBackoffHours?: number;
    /** Optional per-provider billing backoff (hours). */
    billingBackoffHoursByProvider?: Record<string, number>;
    /** Billing backoff cap (hours). Default: 24. */
    billingMaxHours?: number;
    /**
     * Failure window for backoff counters (hours). If no failures occur within
     * this window, counters reset. Default: 24.
     */
    failureWindowHours?: number;
  };
};
