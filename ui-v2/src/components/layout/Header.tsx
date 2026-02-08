import { useGateway } from "@/lib/gateway-context";
import { cn } from "@/lib/utils";

export function Header() {
  const { connected } = useGateway();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <svg
            className="h-6 w-6 text-primary-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="font-semibold">OpenClaw</span>
          <span className="text-xs text-gray-400">v2</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={cn("h-2 w-2 rounded-full", connected ? "bg-success-500" : "bg-danger-500")}
            />
            <span className="text-sm text-gray-500">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
