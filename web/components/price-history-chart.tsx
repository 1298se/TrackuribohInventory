"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format } from "date-fns";
import { InventoryPriceHistoryItem } from "@/app/inventory/schemas";

interface PriceHistoryChartProps {
  data: InventoryPriceHistoryItem[];
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

  return (
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
            />
            <YAxis
              domain={["dataMin - 1", "dataMax + 1"]}
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => formatCurrency(val, currency)}
            />
            <Tooltip
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  const datetime = payload[0].payload.datetime;
                  return format(new Date(datetime), "MMM dd, yyyy");
                }
                return label;
              }}
              formatter={(value: number) => [
                formatCurrency(value, currency),
                "Price",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3B82F6" }}
              activeDot={{ r: 5, fill: "#3B82F6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartContainer>
  );
}
