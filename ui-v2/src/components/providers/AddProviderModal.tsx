import { X, Server, Cloud, Terminal, Bot, Cpu, Github } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { PROVIDER_METADATA } from "@/types/auth";

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (providerId: string) => void;
  existingProviders: string[];
}

const providerIcons: Record<string, React.ReactNode> = {
  anthropic: <Bot className="h-5 w-5" />,
  google: <span className="text-lg font-bold">G</span>,
  openai: <Cpu className="h-5 w-5" />,
  github: <Github className="h-5 w-5" />,
  "mixed-agent-proxy": <Server className="h-5 w-5" />,
  antigravity: <Cloud className="h-5 w-5" />,
  ollama: <Terminal className="h-5 w-5" />,
};

export function AddProviderModal({
  isOpen,
  onClose,
  onSelect,
  existingProviders,
}: AddProviderModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const availableProviders = Object.entries(PROVIDER_METADATA).filter(
    ([id]) => !existingProviders.includes(id),
  );

  const handleAdd = () => {
    if (selectedProvider) {
      onSelect(selectedProvider);
      onClose();
      setSelectedProvider(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Provider</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-2">
          {availableProviders.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">All providers have been added</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-500">Select a provider to add:</p>
              {availableProviders.map(([id, meta]) => (
                <div
                  key={id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedProvider === id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                  }`}
                  onClick={() => setSelectedProvider(id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                    {providerIcons[id] || (
                      <span className="text-sm font-bold">{id.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{meta.name}</p>
                    <p className="text-xs text-gray-500">
                      {meta.authType === "oauth"
                        ? "OAuth login"
                        : meta.authType === "cli"
                          ? "Claude CLI credentials"
                          : "API Key authentication"}
                    </p>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      selectedProvider === id
                        ? "border-primary-500 bg-primary-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {selectedProvider === id && (
                      <div className="h-full w-full rounded-full bg-white scale-50" />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedProvider}>
            Add Provider
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
