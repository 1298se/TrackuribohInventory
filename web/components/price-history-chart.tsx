"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { format } from "date-fns";
import { InventoryPriceHistoryItem } from "@/features/market/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceHistoryChartProps {
  data: InventoryPriceHistoryItem[];
  isLoading: boolean;
  currency?: string;
}

function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD"
): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount
  );
}

export function PriceHistoryChart({
  data = [],
  isLoading,
  currency = "USD",
}: PriceHistoryChartProps) {
  // Transform data for the chart
  const chartData = data.map((item) => ({
    datetime: item.datetime,
    price: item.price.amount,
    formattedDate: format(new Date(item.datetime), "MMM dd"),
  }));

  // Calculate price change
  const priceChange =
    data.length > 1
      ? (() => {
          const currentPrice = data[data.length - 1]?.price?.amount || 0;
          const previousPrice = data[0]?.price?.amount || 0;
          const absoluteChange = currentPrice - previousPrice;
          const percentageChange =
            previousPrice > 0 ? (absoluteChange / previousPrice) * 100 : 0;
          const isPositive = absoluteChange >= 0;

          return {
            absolute: absoluteChange,
            percentage: percentageChange,
            isPositive,
          };
        })()
      : null;

  const formatCurrencyCompact = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        notation: "compact",
      }).format(value);
    }
    return formatCurrency(value, currency);
  };

  return (
    <div className="space-y-4">
      {/* Header with current price and trend */}
      <div className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : data.length > 0 ? (
          <>
            <span className="text-sm text-muted-foreground">Current Price</span>
            <div className="flex items-baseline gap-4">
              <h2 className="text-3xl font-bold tracking-tight">
                {formatCurrency(
                  data[data.length - 1]?.price?.amount || 0,
                  currency
                )}
              </h2>
              {priceChange && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    priceChange.isPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {priceChange.isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>
                    {priceChange.isPositive ? "+" : ""}
                    {formatCurrencyCompact(priceChange.absolute)}
                  </span>
                  <span className="text-xs">
                    ({priceChange.isPositive ? "+" : ""}
                    {priceChange.percentage.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <ChartContainer
        id="price-history-chart"
        className="h-[300px] w-full"
        config={{
          price: { label: "Price", color: "#3B82F6" },
        }}
      >
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading price history...
            </div>
          </div>
        ) : !data.length ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No price history data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 12 }}
                tickFormatter={(val) => formatCurrency(val, currency)}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const dataPoint = payload[0];
                  const datetime = dataPoint?.payload?.datetime;
                  const price = dataPoint?.value as number;

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <p className="text-sm font-medium mb-1">
                        {datetime
                          ? format(new Date(datetime), "MMM dd, yyyy")
                          : label}
                      </p>
                      <p className="text-sm">
                        <span className="text-[#3B82F6]">Price:</span>{" "}
                        {formatCurrency(price, currency)}
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#3B82F6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>
    </div>
  );
}
