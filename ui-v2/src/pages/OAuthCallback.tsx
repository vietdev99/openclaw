import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useGateway } from "@/lib/gateway-context";
import {
  getStoredOAuthState,
  clearOAuthState,
  exchangeCodeForToken,
} from "@/lib/oauth/antigravity";
import { loadConfig } from "@/lib/stores/config-store";

type CallbackStatus = "processing" | "success" | "error";

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { request, connected } = useGateway();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Processing OAuth callback...");
  const [email, setEmail] = useState<string | null>(null);

  // Prevent double-processing (React StrictMode runs effects twice)
  const processingRef = useRef(false);
  const processedRef = useRef(false);

  // Read OAuth params once on mount
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Validate state immediately (before gateway connects)
  const storedState = getStoredOAuthState();
  const stateValid = !error && !!storedState && storedState.state === state && !!code;

  useEffect(() => {
    // Already processed or currently processing — skip
    if (processedRef.current || processingRef.current) return;

    // Handle OAuth error from Google
    if (error) {
      setStatus("error");
      setMessage(`OAuth error: ${error}`);
      processedRef.current = true;
      return;
    }

    // Verify state
    if (!storedState || storedState.state !== state) {
      console.error("[OAuthCallback] State mismatch", {
        hasStoredState: !!storedState,
        storedStateValue: storedState?.state,
        urlState: state,
      });
      setStatus("error");
      setMessage("Invalid OAuth state. Please try again.");
      clearOAuthState();
      processedRef.current = true;
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      clearOAuthState();
      processedRef.current = true;
      return;
    }

    // Wait for gateway connection
    if (!connected) {
      setMessage("Waiting for gateway connection...");
      return;
    }

    // Lock processing
    processingRef.current = true;

    const doExchange = async () => {
      setMessage("Exchanging authorization code...");

      try {
        const result = await exchangeCodeForToken(code, request);

        if (result.success) {
          setStatus("success");
          setEmail(result.email || null);
          setMessage("Successfully logged in!");
          clearOAuthState();

          // Reload config so Providers page shows the new credential
          try {
            await loadConfig(request);
          } catch {
            // Non-fatal: config will reload on Providers page mount
          }

          // Redirect after short delay
          setTimeout(() => {
            navigate(storedState.returnUrl || "/providers");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(result.error || "Failed to exchange authorization code.");
          clearOAuthState();
        }
      } catch (err) {
        setStatus("error");
        setMessage(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
        clearOAuthState();
      }

      processedRef.current = true;
      processingRef.current = false;
    };

    doExchange();
  }, [connected]); // Only re-run when connection status changes

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {status === "processing" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
              <p className="text-center text-gray-600">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-success-500" />
              <div className="text-center">
                <p className="font-medium text-success-600">{message}</p>
                {email && <p className="mt-1 text-sm text-gray-500">Logged in as {email}</p>}
                <p className="mt-2 text-sm text-gray-400">Redirecting...</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-danger-500" />
              <div className="text-center">
                <p className="font-medium text-danger-600">{message}</p>
                <button
                  className="mt-4 text-sm text-primary-500 hover:underline"
                  onClick={() => navigate("/providers")}
                >
                  Return to Providers
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
