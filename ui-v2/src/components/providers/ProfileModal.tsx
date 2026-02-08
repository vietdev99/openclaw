import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { AuthProfileCredential } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProfileFormData) => void;
  providerId: string;
  providerName: string;
  profile?: AuthProfileCredential & { id: string };
  mode: "add" | "edit";
}

export interface ProfileFormData {
  profileId: string;
  apiKey: string;
  baseUrl?: string;
}

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  providerId,
  providerName,
  profile,
  mode,
}: ProfileModalProps) {
  const [formData, setFormData] = useState<ProfileFormData>({
    profileId: "",
    apiKey: "",
    baseUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile && mode === "edit") {
      setFormData({
        profileId: profile.id,
        apiKey: profile.type === "api_key" ? profile.key : "",
        baseUrl: "",
      });
    } else {
      setFormData({
        profileId: `${providerId}:default`,
        apiKey: "",
        baseUrl: "",
      });
    }
    setErrors({});
  }, [profile, mode, providerId, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.profileId.trim()) {
      newErrors.profileId = "Profile ID is required";
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = "API Key is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {mode === "edit" ? "Update API Key" : "Add API Key"} — {providerName}
            </CardTitle>
            <Button variant="ghost" size="icon" type="button" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Profile ID</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800"
                value={formData.profileId}
                onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                placeholder={`${providerId}:default`}
                disabled={mode === "edit"}
              />
              {errors.profileId && (
                <p className="mt-1 text-xs text-danger-500">{errors.profileId}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">API Key</label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
              />
              {errors.apiKey && <p className="mt-1 text-xs text-danger-500">{errors.apiKey}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Base URL (optional)</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to use the default API endpoint
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{mode === "edit" ? "Update" : "Add API Key"}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
