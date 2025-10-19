import React from "react";
import { cn } from "@/lib/utils";

interface MetricGroupProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant: "static" | "dynamic";
  timeRange?: string;
  children: React.ReactNode;
}

export function MetricGroup({
  title,
  subtitle,
  icon,
  variant,
  timeRange,
  children,
}: MetricGroupProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-4 space-y-3",
        variant === "static" && [
          "bg-gray-50 dark:bg-gray-900",
          "border border-gray-200 dark:border-gray-800",
        ],
        variant === "dynamic" && [
          "bg-blue-50/50 dark:bg-blue-950/20",
          "border border-gray-200 dark:border-gray-800",
          "border-l-4 border-l-blue-500",
        ],
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="shrink-0">{icon}</div>}
          <div>
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {timeRange && variant === "dynamic" && (
          <div className="shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
              {timeRange}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
