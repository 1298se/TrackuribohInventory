"use client";

import React, { useState, useEffect, useMemo } from "react";
import { parseISO, format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { useInventoryPerformance, useInventoryMetrics } from "./api";
import {
  BarChart as BarChartIcon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioValueChartProps {
  catalogId: string | null;
  days: number;
}

export function PortfolioValueChart({
  catalogId,
  days,
}: PortfolioValueChartProps) {
  const { data: currentMetrics, isLoading: metricsLoading } =
    useInventoryMetrics(catalogId);
  const {
    data: performanceData,
    error: performanceError,
    isLoading: performanceLoading,
  } = useInventoryPerformance(catalogId, days);

  // Combine historical data with current metrics for a complete chart
  const chartData = useMemo(() => {
    if (!performanceData || performanceData.length === 0) {
      return [];
    }

    return performanceData.map((item) => ({
      date: item.snapshot_date,
      market_value: item.total_market_value,
      cost: item.total_cost,
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
    const previousValue = firstSnapshot.market_value;

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
      <Card className="w-full">
        <CardHeader>
          <div className="text-destructive">Failed to load portfolio data.</div>
        </CardHeader>
      </Card>
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
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Portfolio Performance
            </p>
            <div className="flex items-baseline gap-4">
              {metricsLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          <div>
            <TimeRangeToggle
              value={days}
              onChange={(newDays) => {
                // Handle the change in days
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {performanceError && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load portfolio data.</AlertDescription>
          </Alert>
        )}
        <div className="flex w-full items-start gap-6">
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
            <div className="h-[250px] w-full">
              {performanceLoading || !chartData ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading...
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <>
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
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(dateStr) =>
                          format(parseISO(dateStr), days <= 7 ? "EEE" : "MMM d")
                        }
                        axisLine={true}
                        tickLine={true}
                      />
                      <YAxis hide />
                    </AreaChart>
                  </ChartContainer>
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    <BarChartIcon className="mr-2 h-5 w-5" />
                    No data for the selected period
                  </div>
                </>
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
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
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
                      <linearGradient
                        id="gradient-cost"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
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
                      dataKey="date"
                      tickFormatter={(dateStr) =>
                        format(parseISO(dateStr), days <= 7 ? "EEE" : "MMM d")
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0)
                          return null;

                        const portfolioValue = payload.find(
                          (p) => p.dataKey === "market_value",
                        )?.value as number;
                        const costBasis = payload.find(
                          (p) => p.dataKey === "cost",
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
                                days <= 7 ? "EEE, MMM d" : "MMM d, yyyy",
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
                                <span className="text-[#6366f1]">
                                  Cost Basis:
                                </span>{" "}
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
                      dataKey="cost"
                      stroke="var(--color-total_cost)"
                      strokeWidth={2}
                      fill="url(#gradient-cost)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="market_value"
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
          <div className="flex w-48 flex-none flex-col items-start gap-3">
            <div className="flex w-full flex-col items-start gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Portfolio Value
              </span>
              {metricsLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className="text-lg font-semibold">
                  {formatCurrency(currentMetrics?.total_market_value || 0)}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Cost Basis
              </span>
              {metricsLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className="text-lg font-semibold">
                  {formatCurrency(currentMetrics?.total_inventory_cost || 0)}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Total P&L
              </span>
              {metricsLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <div
                  className={`${
                    (currentMetrics?.unrealised_profit || 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  <span className="text-lg font-semibold">
                    {currentMetrics?.unrealised_profit != null
                      ? `${currentMetrics.unrealised_profit >= 0 ? "+" : ""}${formatCurrency(currentMetrics.unrealised_profit)}`
                      : "—"}
                  </span>
                  {currentMetrics?.unrealised_profit != null &&
                    currentMetrics?.total_inventory_cost != null &&
                    currentMetrics.total_inventory_cost > 0 && (
                      <span className="text-sm font-medium ml-2">
                        ({currentMetrics.unrealised_profit >= 0 ? "+" : ""}
                        {(
                          (currentMetrics.unrealised_profit /
                            currentMetrics.total_inventory_cost) *
                          100
                        ).toFixed(1)}
                        %)
                      </span>
                    )}
                </div>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Items in Stock
              </span>
              {metricsLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className="text-lg font-semibold">
                  {currentMetrics?.number_of_items ?? 0}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
