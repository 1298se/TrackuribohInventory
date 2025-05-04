"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketDepthChartProps {
  data?: { price: number; cumulativeCount: number }[];
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

export function MarketDepthChart({
  data = [],
  isLoading,
  currency = "USD",
}: MarketDepthChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No market depth data available.
      </div>
    );
  }

  return (
    <ChartContainer
      id="market-depth-chart"
      config={{
        price: { label: "Price", color: "#3B82F6" },
        cumulativeCount: { label: "Cumulative Count", color: "#3B82F6" },
      }}
      className="h-[300px] w-full"
    >
      <AreaChart
        layout="horizontal"
        data={data}
        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
      >
        <XAxis
          dataKey="cumulativeCount"
          type="number"
          domain={[0, "dataMax"]}
          allowDecimals={false}
          tickFormatter={(value) => String(value)}
        />
        <YAxis
          dataKey="price"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(val) => formatCurrency(val, currency)}
        />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === "cumulativeCount" ? value : formatCurrency(value, currency)
          }
          labelFormatter={(label) => label}
        />
        <Area
          type="stepAfter"
          dataKey="price"
          stroke="#3B82F6"
          fill="rgba(59,130,246,0.3)"
          dot={{ r: 2, fill: "#3B82F6" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
