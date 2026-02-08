// Antigravity OAuth configuration
// Uses Google OAuth for Antigravity provider authentication

const OAUTH_CONFIG = {
  clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  clientSecret: "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",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ],
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userinfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
};

function getRedirectUri(): string {
  return `${window.location.origin}/v2/oauth/callback`;
}

export interface OAuthState {
  provider: string;
  state: string;
  returnUrl: string;
}

export async function initiateAntigravityOAuth(): Promise<void> {
  const state = crypto.randomUUID();

  // Store state for callback verification
  const oauthState: OAuthState = {
    provider: "antigravity",
    state,
    returnUrl: window.location.pathname,
  };
  localStorage.setItem("oauth_state", JSON.stringify(oauthState));

  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  window.location.href = `${OAUTH_CONFIG.authUrl}?${params}`;
}

export function getStoredOAuthState(): OAuthState | null {
  const stored = localStorage.getItem("oauth_state");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as OAuthState;
  } catch {
    return null;
  }
}

export function clearOAuthState(): void {
  localStorage.removeItem("oauth_state");
}

export interface TokenExchangeResult {
  success: boolean;
  error?: string;
  email?: string;
  refreshToken?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  scope?: string;
}

interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Exchange authorization code for tokens directly with Google,
 * then save the OAuth credential via gateway auth.profile.upsert API.
 */
export async function exchangeCodeForToken(
  code: string,
  request: <T>(method: string, params?: unknown) => Promise<T>,
): Promise<TokenExchangeResult> {
  try {
    // 1. Exchange code for tokens with Google
    const tokenParams = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      code,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return { success: false, error: `Token exchange failed: ${errorText}` };
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    if (!tokenData.refresh_token) {
      return {
        success: false,
        error:
          "Google did not return a refresh_token. You may need to revoke access in Google Account settings and try again.",
      };
    }

    // 2. Fetch user info
    let email = "";
    try {
      const userInfoResponse = await fetch(OAUTH_CONFIG.userinfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo: GoogleUserInfo = await userInfoResponse.json();
        email = userInfo.email;
      }
    } catch {
      // Non-fatal: continue without email
    }

    // 3. Discover Cloud Code Assist projectId via loadCodeAssist API
    // This must use the same discovery method as pi-ai (loadCodeAssist),
    // NOT Cloud Resource Manager — they return different project types.
    let projectId = "";
    const codeAssistEndpoints = [
      "https://cloudcode-pa.googleapis.com",
      "https://daily-cloudcode-pa.sandbox.googleapis.com",
    ];
    const codeAssistHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
      "User-Agent": "google-api-nodejs-client/9.15.1",
      "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    };
    const codeAssistBody = JSON.stringify({
      metadata: {
        ideType: "IDE_UNSPECIFIED",
        platform: "PLATFORM_UNSPECIFIED",
        pluginType: "GEMINI",
      },
    });
    for (const endpoint of codeAssistEndpoints) {
      try {
        const resp = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
          method: "POST",
          headers: codeAssistHeaders,
          body: codeAssistBody,
        });
        if (resp.ok) {
          const data = await resp.json();
          const proj = data.cloudaicompanionProject;
          if (typeof proj === "string" && proj) {
            projectId = proj;
            break;
          }
          if (proj && typeof proj === "object" && proj.id) {
            projectId = proj.id;
            break;
          }
        }
      } catch {
        // Try next endpoint
      }
    }
    if (!projectId) {
      // Fallback project ID (same as pi-ai default)
      projectId = "rising-fact-p41fc";
    }
    console.log("[AntigravityOAuth] Discovered projectId:", projectId, "email:", email);

    // 4. Save the OAuth credential via gateway auth.profile.upsert
    const profileId = `google-antigravity:${email || "default"}`;
    const credential = {
      type: "oauth" as const,
      provider: "google-antigravity",
      refresh: tokenData.refresh_token,
      access: tokenData.access_token,
      expires: Date.now() + tokenData.expires_in * 1000,
      clientId: OAUTH_CONFIG.clientId,
      email: email || undefined,
      projectId,
    };

    console.log("[AntigravityOAuth] Saving auth profile:", profileId);

    const upsertResult = await request<{ ok: boolean; profileId: string }>("auth.profile.upsert", {
      profileId,
      provider: "google-antigravity",
      credential,
      setDefault: true,
      defaultModel: "google-antigravity/claude-opus-4-6",
    });

    console.log("[AntigravityOAuth] auth.profile.upsert result:", upsertResult);

    // 5. Wait briefly for gateway to restart after config change
    await new Promise((r) => setTimeout(r, 2000));

    return {
      success: true,
      email,
      refreshToken: tokenData.refresh_token,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error during OAuth",
    };
  }
}
