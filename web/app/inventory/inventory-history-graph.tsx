"use client";

import React, { useState } from "react";
import { parseISO, format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInventoryPerformance } from "./api";
import { BarChart as BarChartIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface InventoryHistoryGraphProps {
  catalogId: string | null;
}

export function InventoryHistoryGraph({
  catalogId,
}: InventoryHistoryGraphProps) {
  const isMobile = useIsMobile();
  const [days, setDays] = useState<string | undefined>(undefined);

  // Helper function to convert string time range to API days parameter
  const timeRangeToDays = (timeRange: string | undefined): number | null => {
    if (!timeRange) return null;

    switch (timeRange) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "1y":
        return 365;
      case "all":
        return null;
      default:
        return null;
    }
  };

  const daysNumber = timeRangeToDays(days);
  const { data, error, isLoading } = useInventoryPerformance(
    catalogId,
    daysNumber,
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load inventory history.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <div>
          <TimeRangeToggle
            value={days}
            onChange={setDays}
            options={[
              { label: "7d", value: "7d" },
              { label: "30d", value: "30d" },
              { label: "90d", value: "90d" },
              { label: "1y", value: "1y" },
              { label: "All time", value: "all" },
            ]}
          />
        </div>
      </div>
      <div className="h-[250px] relative">
        {isLoading || !data ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading graph...
            </div>
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message={`No inventory snapshots yet${daysNumber ? ` for the last ${daysNumber} days` : ""}`}
          />
        ) : (
          <ChartContainer
            id="inventory-history"
            config={{
              total_cost: { label: "Cost", color: "#3b82f6" },
              total_market_value: { label: "Market Value", color: "#10b981" },
            }}
            className="h-full w-full"
          >
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradient-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="gradient-market"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="snapshot_date"
                tickFormatter={(dateStr) => format(parseISO(dateStr), "MMM d")}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(value)
                }
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickCount={6}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="total_cost"
                stroke="var(--color-total_cost)"
                fill="url(#gradient-cost)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="total_market_value"
                stroke="var(--color-total_market_value)"
                fill="url(#gradient-market)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
