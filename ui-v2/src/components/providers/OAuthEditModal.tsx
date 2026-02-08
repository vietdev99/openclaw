import { X, Cloud, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { maskToken } from "@/lib/utils";
import { PROVIDER_METADATA } from "@/types/auth";

interface OAuthEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReAuth: () => void;
  providerId: string;
  accessToken: string;
  email?: string;
}

export function OAuthEditModal({
  isOpen,
  onClose,
  onReAuth,
  providerId,
  accessToken,
  email,
}: OAuthEditModalProps) {
  const [showToken, setShowToken] = useState(false);

  const providerName = PROVIDER_METADATA[providerId]?.name ?? providerId;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            {providerName}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Email / Account */}
          {email && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Account
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                {email}
              </div>
            </div>
          )}

          {/* Access Token */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Access Token
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                {showToken ? accessToken : maskToken(accessToken)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            ✓ OAuth connected
          </div>
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onReAuth}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-authenticate
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
