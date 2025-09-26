"use client";

import { InventoryPriceHistoryItem } from "@/features/market/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SparklineChartProps {
  data: InventoryPriceHistoryItem[];
  isLoading: boolean;
  className?: string;
}

export function SparklineChart({
  data,
  isLoading,
  className,
}: SparklineChartProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-8 w-16" />
        <div className="flex flex-col items-end">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground text-xs",
          className
        )}
      >
        <span>—</span>
      </div>
    );
  }

  // Calculate 7-day change
  const firstPrice = data[0]?.price?.amount || 0;
  const lastPrice = data[data.length - 1]?.price?.amount || 0;
  const absoluteChange = lastPrice - firstPrice;
  const percentageChange =
    firstPrice > 0 ? (absoluteChange / firstPrice) * 100 : 0;
  const isPositive = absoluteChange > 0;
  const isNegative = absoluteChange < 0;
  const isFlat = absoluteChange === 0;

  // Format numbers
  const formattedAbsolute = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(absoluteChange));

  const formattedPercentage = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(percentageChange));

  const sign = isPositive ? "+" : isNegative ? "-" : "";

  // Determine colors
  const textColor = isPositive
    ? "text-green-600"
    : isNegative
    ? "text-red-600"
    : "text-muted-foreground";

  return (
    <div className={cn("flex items-center justify-end", className)}>
      {/* 7D Change */}
      <div className="flex items-center">
        {isFlat ? (
          <div className="text-muted-foreground flex items-center justify-end">
            <span className="text-xs">——</span>
          </div>
        ) : (
          <div className={cn("font-medium flex flex-col items-end", textColor)}>
            <div className="flex items-baseline gap-0.5">
              <span>{sign}$</span>
              <span className="tabular-nums">{formattedAbsolute}</span>
            </div>
            <span className="text-sm tabular-nums">
              <span>{sign}</span>
              {formattedPercentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
