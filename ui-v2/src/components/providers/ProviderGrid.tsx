import { Plus } from "lucide-react";
import type { ProviderInfo } from "@/types/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderCard } from "./ProviderCard";

interface ProviderGridProps {
  providers: ProviderInfo[];
  onEditProfile?: (providerId: string, profileId: string) => void;
  onDeleteProfile?: (providerId: string, profileId: string) => void;
  onAddProfile?: (providerId: string) => void;
  onAddProvider?: () => void;
  onOAuthLogin?: (providerId: string) => void;
  onToggleDisable?: (profileId: string, disabled: boolean) => void;
  disabledProfiles?: Set<string>;
}

export function ProviderGrid({
  providers,
  onEditProfile,
  onDeleteProfile,
  onAddProfile,
  onAddProvider,
  onOAuthLogin,
  onToggleDisable,
  disabledProfiles,
}: ProviderGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          onEdit={(profileId) => onEditProfile?.(provider.id, profileId)}
          onDelete={(profileId) => onDeleteProfile?.(provider.id, profileId)}
          onAdd={() => onAddProfile?.(provider.id)}
          onOAuthLogin={onOAuthLogin}
          onToggleDisable={onToggleDisable}
          disabledProfiles={disabledProfiles}
        />
      ))}

      {/* Add Provider Card */}
      <Card
        className="flex cursor-pointer items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-600 dark:hover:bg-primary-950"
        onClick={onAddProvider}
      >
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800">
            <Plus className="h-6 w-6 text-gray-500" />
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Add Provider</span>
        </CardContent>
      </Card>
    </div>
  );
}
