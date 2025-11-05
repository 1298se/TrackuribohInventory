"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/shadcn/ui/chart";
import { format } from "date-fns";
import { InventoryPriceHistoryItem } from "@/features/market/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { getConditionChartColor } from "@/features/catalog/utils";

interface PriceHistoryItem {
  datetime: string;
  price: { amount: number; currency: string };
}

interface SKUInfo {
  id: string;
  condition: { name: string; abbreviation: string };
  printing: { name: string };
  language: { name: string; abbreviation: string };
}

interface SKUPriceHistorySeries {
  sku: SKUInfo;
  items: PriceHistoryItem[];
}

interface PriceHistoryChartProps {
  data?: InventoryPriceHistoryItem[];
  series?: SKUPriceHistorySeries[];
  isLoading: boolean;
  currency?: string;
}

function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD",
): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

export function PriceHistoryChart({
  data,
  series,
  isLoading,
  currency = "USD",
}: PriceHistoryChartProps) {
  // Support both single series (data) and multiple series (series) modes
  const isMultiSeries = !!series && series.length > 0;
  const singleSeriesData = data || [];

  // Transform data for the chart
  let chartData: any[] = [];
  let chartConfig: Record<string, { label: string; color: string }> = {};

  if (isMultiSeries) {
    // Multi-series mode: merge all series by datetime
    const dataByDate = new Map<string, any>();

    series!.forEach((skuSeries, index) => {
      const skuKey = `sku_${index}`;
      const skuLabel = `${skuSeries.sku.condition.name}`;
      const color = getConditionChartColor(skuSeries.sku.condition.name);

      chartConfig[skuKey] = { label: skuLabel, color };

      skuSeries.items.forEach((item) => {
        const dateKey = item.datetime;
        if (!dataByDate.has(dateKey)) {
          dataByDate.set(dateKey, {
            datetime: dateKey,
            formattedDate: format(new Date(dateKey), "MMM dd"),
          });
        }
        dataByDate.get(dateKey)![skuKey] = item.price.amount;
      });
    });

    chartData = Array.from(dataByDate.values()).sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );
  } else {
    // Single series mode (backward compatible)
    chartData = singleSeriesData.map((item) => ({
      datetime: item.datetime,
      price: item.price.amount,
      formattedDate: format(new Date(item.datetime), "MMM dd"),
    }));
    chartConfig = { price: { label: "Price", color: "#3B82F6" } };
  }

  // Calculate price change (only for single series mode)
  const priceChange =
    !isMultiSeries && singleSeriesData.length > 1
      ? (() => {
          const currentPrice =
            singleSeriesData[singleSeriesData.length - 1]?.price?.amount || 0;
          const previousPrice = singleSeriesData[0]?.price?.amount || 0;
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
      {/* Header with current price and trend (only in single series mode) */}
      {!isMultiSeries && (
        <div className="space-y-1">
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : singleSeriesData.length > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">
                Current Price
              </span>
              <div className="flex items-baseline gap-4">
                <h2 className="text-3xl font-bold tracking-tight">
                  {formatCurrency(
                    singleSeriesData[singleSeriesData.length - 1]?.price
                      ?.amount || 0,
                    currency,
                  )}
                </h2>
                {priceChange && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      priceChange.isPositive
                        ? "text-green-600"
                        : "text-red-600",
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
      )}

      <ChartContainer
        id="price-history-chart"
        className="h-[300px] w-full"
        config={chartConfig}
      >
        {isLoading ? (
          <Skeleton className="w-full mb-1 h-[240px]" />
        ) : chartData.length === 0 ? (
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

                  const datetime = payload[0]?.payload?.datetime;

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <p className="text-sm font-medium mb-1">
                        {datetime
                          ? format(new Date(datetime), "MMM dd, yyyy")
                          : label}
                      </p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm">
                          <span style={{ color: entry.color }}>
                            {chartConfig[entry.dataKey]?.label || entry.dataKey}
                            :
                          </span>{" "}
                          {formatCurrency(entry.value as number, currency)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {isMultiSeries && <Legend />}
              {isMultiSeries ? (
                // Multi-series mode: render multiple lines
                Object.keys(chartConfig).map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={chartConfig[key].label}
                    stroke={chartConfig[key].color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: chartConfig[key].color }}
                    connectNulls
                  />
                ))
              ) : (
                // Single series mode: render one line
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "#3B82F6" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>
    </div>
  );
}
