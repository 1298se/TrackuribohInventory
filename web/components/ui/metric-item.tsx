import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricItemProps {
  label: string;
  value: number | string | null | undefined;
  suffix?: string;
  loading?: boolean;
  tooltip?: string;
}

export function MetricItem({
  label,
  value,
  suffix,
  loading = false,
  tooltip,
}: MetricItemProps) {
  const displayValue = value !== null && value !== undefined ? value : "—";
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : displayValue;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {tooltip && (
          <div className="text-xs text-muted-foreground/60" title={tooltip}>
            ⓘ
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <div className="flex items-baseline gap-1 metric-value transition-opacity duration-200 ease-in-out">
          <span className="text-lg font-semibold text-foreground">
            {formattedValue}
          </span>
          {suffix && displayValue !== "—" && (
            <span className="text-xs text-muted-foreground">{suffix}</span>
          )}
        </div>
      )}
    </div>
  );
}
