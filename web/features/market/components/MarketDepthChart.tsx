"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shadcn/ui/chart";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatCurrency } from "@/shared/utils";

interface MarketDepthChartProps {
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[];
  salesCumulativeDepth: { price: number; cumulativeCount: number }[];
  currency?: string;
}

export function MarketDepthChart({
  listingsCumulativeDepth = [],
  salesCumulativeDepth = [],
  currency = "USD",
}: MarketDepthChartProps) {
  const mergedData = useMemo(() => {
    return mergeMarketDepthData(listingsCumulativeDepth, salesCumulativeDepth);
  }, [listingsCumulativeDepth, salesCumulativeDepth]);

  return (
    <ChartContainer
      id="market-depth-chart"
      className="aspect-auto h-[250px] w-full"
      config={{
        listingCumulativeCount: {
          label: "Listings",
          color: "rgb(59 130 246)", // blue-500
        },
        salesCumulativeCount: {
          label: "Sales",
          color: "rgb(34 197 94)", // green-500
        },
      }}
    >
      <AreaChart
        data={mergedData}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="listingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="price"
          type="number"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          domain={["dataMin", "dataMax"]}
          tickFormatter={(val) => formatCurrency(val, currency)}
        />
        <YAxis
          type="number"
          domain={[0, "dataMax"]}
          tickFormatter={(val) => String(val)}
          hide={true}
        />
        <ChartTooltip
          shared
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const value = payload[0];

                return `Price: ${formatCurrency(
                  value.payload.price,
                  currency
                )}`;
              }}
              formatter={(value: ValueType, name: NameType) => {
                if (value === undefined) return null;

                const isListings =
                  name === "listingCumulativeCount" || name === "Listings";
                const color = isListings ? "rgb(59 130 246)" : "rgb(34 197 94)";
                const label = isListings ? "Listings" : "Sales";

                return [
                  <div key={name} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{value}</span>
                  </div>,
                  label,
                ];
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="stepAfter"
          dataKey="listingCumulativeCount"
          name="Listings"
          stroke="rgb(59 130 246)" // blue-500
          fill="url(#listingsGradient)"
          connectNulls
        />
        <Area
          type="stepAfter"
          dataKey="salesCumulativeCount"
          name="Sales"
          stroke="rgb(34 197 94)" // green-500
          fill="url(#salesGradient)"
          connectNulls
        />
      </AreaChart>
    </ChartContainer>
  );
}

function mergeMarketDepthData(
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[],
  salesCumulativeDepth: { price: number; cumulativeCount: number }[]
) {
  // Merge series by price, sorted from lowest to highest (left to right)
  const prices = Array.from(
    new Set([
      ...listingsCumulativeDepth.map((d) => d.price),
      ...salesCumulativeDepth.map((d) => d.price),
    ])
  ).sort((a, b) => a - b);

  const listingMap: Record<number, number> = Object.fromEntries(
    listingsCumulativeDepth.map((d) => [d.price, d.cumulativeCount])
  );

  const salesMap: Record<number, number> = Object.fromEntries(
    salesCumulativeDepth.map((d) => [d.price, d.cumulativeCount])
  );

  // Track last known values for step interpolation
  let lastListingValue: number | undefined = undefined;
  let lastSalesValue: number | undefined = undefined;

  return prices.map((price) => {
    // Update last known values if present at this price point
    if (listingMap[price] !== undefined) {
      lastListingValue = listingMap[price];
    }
    if (salesMap[price] !== undefined) {
      lastSalesValue = salesMap[price];
    }

    return {
      price,
      listingCumulativeCount: lastListingValue,
      salesCumulativeCount:
        salesCumulativeDepth.length > 0 ? lastSalesValue : undefined,
    };
  });
}
