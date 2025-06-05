"use client";

import React, { useState, useMemo } from "react";
import { parseISO, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { useTransactionPerformance } from "./api";
import {
  TrendingUp,
  TrendingDown,
  BarChart as BarChartIcon,
} from "lucide-react";
import { cn, formatCurrencyNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export function TransactionPerformanceChart() {
  const [days, setDays] = useState<number | null>(null);

  const {
    data: performanceData,
    error,
    isLoading,
  } = useTransactionPerformance(days);

  // Process data for chart visualization
  const chartData = useMemo(() => {
    if (!performanceData?.data_points) return [];

    return performanceData.data_points.map((point) => ({
      date: point.date,
      sales: point.revenue, // Sales as positive values
      purchases: -point.expenses, // Purchases as negative values for downward bars
      net_profit: point.net_profit,
      transaction_count: point.transaction_count,
    }));
  }, [performanceData]);

  // Calculate period summary from data points
  const periodSummary = useMemo(() => {
    if (
      !performanceData?.data_points ||
      performanceData.data_points.length === 0
    ) {
      return {
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
      };
    }

    const summary = performanceData.data_points.reduce(
      (acc, point) => ({
        total_revenue: acc.total_revenue + point.revenue,
        total_expenses: acc.total_expenses + point.expenses,
        net_profit: acc.net_profit + point.net_profit,
      }),
      { total_revenue: 0, total_expenses: 0, net_profit: 0 },
    );

    return summary;
  }, [performanceData]);

  // Calculate period change based on selected time range
  const periodChange = useMemo(() => {
    if (
      !performanceData?.data_points ||
      performanceData.data_points.length === 0
    ) {
      return null;
    }

    const dataPoints = performanceData.data_points;
    const currentPeriodRevenue =
      dataPoints[dataPoints.length - 1]?.revenue || 0;
    const previousPeriodRevenue = dataPoints[0]?.revenue || 0;

    const absoluteChange = currentPeriodRevenue - previousPeriodRevenue;
    const percentageChange =
      previousPeriodRevenue > 0
        ? (absoluteChange / previousPeriodRevenue) * 100
        : 0;

    return {
      absolute: absoluteChange,
      percentage: percentageChange,
      isPositive: absoluteChange >= 0,
    };
  }, [performanceData]);

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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load transaction performance.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-end mb-6">
        <TimeRangeToggle
          value={days}
          onChange={setDays}
          options={[
            { label: "7d", value: 7 },
            { label: "30d", value: 30 },
            { label: "90d", value: 90 },
            { label: "1yr", value: 365 },
            { label: "All time", value: null },
          ]}
        />
      </div>

      <div className="h-[300px] w-full">
        {isLoading || !chartData ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading...
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <EmptyState message="No transaction data for the selected period" />
        ) : (
          <ChartContainer
            id="transaction-performance"
            config={{
              sales: {
                label: "Sales",
                color: "#10b981", // Green for sales (positive)
              },
              purchases: {
                label: "Purchases",
                color: "#3b82f6", // Blue for purchases (neutral investment)
              },
              net_profit: {
                label: "Net Profit",
                color: "#6366f1",
              },
            }}
            className="h-full w-full"
          >
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(dateStr) =>
                  format(parseISO(dateStr), days && days <= 7 ? "EEE" : "MMM d")
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis hide />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const sales = payload.find((p) => p.dataKey === "sales")
                    ?.value as number;
                  const purchases = payload.find(
                    (p) => p.dataKey === "purchases",
                  )?.value as number;
                  const netProfit = payload.find(
                    (p) => p.dataKey === "net_profit",
                  )?.value as number;
                  const transactionCount = payload.find(
                    (p) => p.dataKey === "transaction_count",
                  )?.value as number;

                  // Convert purchases back to positive for display
                  const purchasesAmount = Math.abs(purchases);

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <p className="text-sm font-medium mb-2">
                        {format(
                          parseISO(label),
                          days && days <= 7 ? "EEE, MMM d" : "MMM d, yyyy",
                        )}
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="text-[#10b981]">Sales:</span>{" "}
                          {formatCurrency(sales)}
                        </p>
                        <p className="text-sm">
                          <span className="text-[#3b82f6]">Purchases:</span>{" "}
                          {formatCurrency(purchasesAmount)}
                        </p>
                        <hr className="my-1" />
                        <p className="text-sm font-medium">
                          <span
                            className={
                              netProfit >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            Net Profit:
                          </span>{" "}
                          <span
                            className={
                              netProfit >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            {formatCurrency(netProfit)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transactionCount} transaction
                          {transactionCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="sales"
                fill="var(--color-sales)"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="purchases"
                fill="var(--color-purchases)"
                radius={[0, 0, 2, 2]}
              />
              <Line
                type="monotone"
                dataKey="net_profit"
                stroke="var(--color-net_profit)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
