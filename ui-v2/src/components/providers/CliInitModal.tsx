import { X, Terminal, RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { PROVIDER_METADATA } from "@/types/auth";

interface CliInitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: () => Promise<void>;
  providerId: string | null;
}

export function CliInitModal({ isOpen, onClose, onSync, providerId }: CliInitModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const providerName = providerId ? (PROVIDER_METADATA[providerId]?.name ?? providerId) : "";

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
      setSynced(true);
      setTimeout(() => {
        setSynced(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen || !providerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {providerName} — CLI Credentials
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {synced ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-12 w-12 text-success-500" />
              <p className="font-medium text-success-600">Credentials synced successfully!</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <p className="font-medium mb-1">How to authenticate:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    Run{" "}
                    <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">
                      claude /login
                    </code>{" "}
                    in your terminal
                  </li>
                  <li>Complete the authentication in your browser</li>
                  <li>
                    Click <strong>"Sync from Claude CLI"</strong> below
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <p>
                  Credentials are read from{" "}
                  <code className="rounded bg-gray-200 px-1 py-0.5 dark:bg-gray-700">
                    ~/.claude/.credentials.json
                  </code>
                </p>
                <p className="mt-1">
                  The gateway will automatically sync and refresh the access token.
                </p>
              </div>
            </>
          )}
        </CardContent>

        {!synced && (
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync from Claude CLI
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
