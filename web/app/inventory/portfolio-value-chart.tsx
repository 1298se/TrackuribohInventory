"use client";

import React, { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useInventoryPerformance, useInventoryMetrics } from "./api";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioValueChartProps {
  catalogId: string | null;
  days: string | undefined;
  metricData?: any;
  metricLoading: boolean;
}

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

export function PortfolioValueChart({
  catalogId,
  days,
  metricData,
  metricLoading,
}: PortfolioValueChartProps) {
  const daysNumber = timeRangeToDays(days);
  const { data: currentMetrics, isLoading: metricsLoading } =
    useInventoryMetrics(catalogId);
  const {
    data: performanceData,
    error: performanceError,
    isLoading: performanceLoading,
  } = useInventoryPerformance(catalogId, daysNumber);

  // Combine historical data with current metrics for a complete chart
  const chartData = useMemo(() => {
    if (!performanceData || performanceData.length === 0) {
      return [];
    }

    return performanceData.map((item) => ({
      snapshot_date: item.snapshot_date,
      total_market_value: item.total_market_value,
      total_cost: item.total_cost,
      profit: item.unrealised_profit,
    }));
  }, [performanceData]);

  // Calculate change based on selected time period
  const portfolioChange = useMemo(() => {
    if (!currentMetrics || !chartData || chartData.length === 0) {
      return null;
    }

    const currentValue = currentMetrics.total_market_value;
    const firstSnapshot = chartData[0];
    const previousValue = firstSnapshot.total_market_value;

    const absoluteChange = currentValue - previousValue;
    const percentageChange =
      previousValue > 0 ? (absoluteChange / previousValue) * 100 : 0;

    return {
      absolute: absoluteChange,
      percentage: percentageChange,
      isPositive: absoluteChange >= 0,
    };
  }, [chartData, currentMetrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        notation: "compact",
      }).format(value);
    }
    return formatCurrency(value);
  };

  if (performanceError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load portfolio data.</AlertDescription>
      </Alert>
    );
  }

  if (performanceLoading || metricsLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="space-y-1">
            {metricsLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  Market Value
                </span>
                <div className="flex items-baseline gap-4">
                  <h2 className="text-3xl font-bold tracking-tight">
                    {formatCurrency(currentMetrics?.total_market_value || 0)}
                  </h2>
                  {portfolioChange && (
                    <div
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        portfolioChange.isPositive
                          ? "text-green-600"
                          : "text-red-600",
                      )}
                    >
                      {portfolioChange.isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span>
                        {portfolioChange.isPositive ? "+" : ""}
                        {formatCurrencyCompact(portfolioChange.absolute)}
                      </span>
                      <span className="text-xs">
                        ({portfolioChange.isPositive ? "+" : ""}
                        {portfolioChange.percentage.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Secondary Metrics */}
          {!metricLoading && metricData && (
            <div className="flex items-center gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#6366f1" }}
                ></div>
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(metricData.total_inventory_cost || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#10b981" }}
                ></div>
                <span className="text-muted-foreground">Unrealized P&L:</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    (metricData.unrealised_profit || 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                  )}
                >
                  {formatCurrency(metricData.unrealised_profit || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      {performanceError && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load portfolio data.</AlertDescription>
        </Alert>
      )}
      <div className="h-[250px] w-full">
        {performanceLoading || !chartData ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading...
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <EmptyState
            message={`No portfolio snapshots yet${days ? ` for the last ${days} days` : ""}`}
          />
        ) : (
          <ChartContainer
            id="portfolio-value"
            config={{
              total_market_value: {
                label: "Portfolio Value",
                color: "#10b981",
              },
              total_cost: { label: "Cost Basis", color: "#6366f1" },
            }}
            className="h-full w-full"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="gradient-portfolio"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="gradient-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="snapshot_date"
                tickFormatter={(dateStr) =>
                  format(parseISO(dateStr), days === "7d" ? "EEE" : "MMM d")
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
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
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const portfolioValue = payload.find(
                    (p) => p.dataKey === "total_market_value",
                  )?.value as number;
                  const costBasis = payload.find(
                    (p) => p.dataKey === "total_cost",
                  )?.value as number;
                  const unrealizedPL =
                    portfolioValue && costBasis
                      ? portfolioValue - costBasis
                      : 0;
                  const percentage =
                    costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <p className="text-sm font-medium mb-2">
                        {format(
                          parseISO(label),
                          days === "7d" ? "EEE, MMM d" : "MMM d, yyyy",
                        )}
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="text-[#10b981]">
                            Portfolio Value:
                          </span>{" "}
                          {formatCurrency(portfolioValue)}
                        </p>
                        <p className="text-sm">
                          <span className="text-[#6366f1]">Cost Basis:</span>{" "}
                          {formatCurrency(costBasis)}
                        </p>
                        <hr className="my-1" />
                        <p className="text-sm font-medium">
                          <span
                            className={
                              unrealizedPL >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            Unrealized P&L:
                          </span>{" "}
                          <span
                            className={
                              unrealizedPL >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {unrealizedPL >= 0 ? "+" : ""}
                            {formatCurrency(unrealizedPL)} (
                            {unrealizedPL >= 0 ? "+" : ""}
                            {percentage.toFixed(1)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="total_cost"
                stroke="var(--color-total_cost)"
                strokeWidth={2}
                fill="url(#gradient-cost)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="total_market_value"
                stroke="var(--color-total_market_value)"
                strokeWidth={2}
                fill="url(#gradient-portfolio)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
