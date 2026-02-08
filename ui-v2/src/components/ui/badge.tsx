import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "secondary";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
        {
          "border-transparent bg-primary-500 text-white": variant === "default",
          "border-transparent bg-success-500 text-white": variant === "success",
          "border-transparent bg-warning-500 text-white": variant === "warning",
          "border-transparent bg-danger-500 text-white": variant === "error",
          "border-gray-200 bg-gray-100 text-gray-900 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100":
            variant === "secondary",
        },
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
