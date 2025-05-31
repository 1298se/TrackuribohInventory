"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface MarketDepthChartProps {
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[];
  salesCumulativeDepth: { price: number; cumulativeCount: number }[];
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
  listingsCumulativeDepth = [],
  salesCumulativeDepth = [],
  isLoading,
  currency = "USD",
}: MarketDepthChartProps) {
  // Merge series by price, but use null for missing sales data
  const prices = Array.from(
    new Set([
      ...listingsCumulativeDepth.map((d) => d.price),
      ...salesCumulativeDepth.map((d) => d.price),
    ]),
  ).sort((a, b) => a - b);

  const listingMap: Record<number, number> = Object.fromEntries(
    listingsCumulativeDepth.map((d) => [d.price, d.cumulativeCount]),
  );

  const salesMap: Record<number, number> = Object.fromEntries(
    salesCumulativeDepth.map((d) => [d.price, d.cumulativeCount]),
  );

  const mergedData = prices.map((price) => ({
    price,
    listingCumulativeCount: listingMap[price],
    // Use undefined for missing sales points so Recharts doesn't draw them
    salesCumulativeCount:
      salesCumulativeDepth.length > 0 ? salesMap[price] : undefined,
  }));

  return (
    <ChartContainer
      id="market-depth-chart"
      className="h-[300px] w-full"
      config={{
        listingCumulativeCount: { label: "Listings", color: "#3B82F6" },
        salesCumulativeCount: { label: "Sales", color: "#F97316" },
      }}
    >
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Loading market depth...
          </div>
        </div>
      ) : !listingsCumulativeDepth.length && !salesCumulativeDepth.length ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          No market depth data available.
        </div>
      ) : (
        <AreaChart
          data={mergedData}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <XAxis
            dataKey="price"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(val) => formatCurrency(val, currency)}
          />
          <YAxis
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(val) => String(val)}
          />
          <Tooltip
            labelFormatter={(label: number) =>
              `Price: ${formatCurrency(label, currency)}`
            }
            formatter={(value: number, name: string) => [
              value,
              name === "Listings" ? "Listings" : "Sales",
            ]}
          />
          <Legend />
          <Area
            type="stepAfter"
            dataKey="listingCumulativeCount"
            name="Listings"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.4}
            connectNulls
            style={{ mixBlendMode: "multiply" }}
            dot={{ r: 2, fill: "#3B82F6" }}
          />
          <Area
            type="stepAfter"
            dataKey="salesCumulativeCount"
            name="Sales"
            stroke="#F97316"
            fill="#F97316"
            fillOpacity={0.4}
            style={{ mixBlendMode: "multiply" }}
            connectNulls
            dot={{ r: 2, fill: "#F97316" }}
          />
        </AreaChart>
      )}
    </ChartContainer>
  );
}
