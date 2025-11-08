"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ReferenceLine } from "recharts";
import type { ReferenceLineProps } from "recharts";
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
  const [isHovered, setIsHovered] = useState(false);

  const mergedData = useMemo(() => {
    return mergeMarketDepthData(listingsCumulativeDepth, salesCumulativeDepth);
  }, [listingsCumulativeDepth, salesCumulativeDepth]);

  // Calculate price levels (percentiles) for reference lines
  const priceLevels = useMemo(() => {
    if (listingsCumulativeDepth.length === 0)
      return {
        low: { count: 0, price: 0 },
        medium: { count: 0, price: 0 },
        high: { count: 0, price: 0 },
      };

    const sortedData = [...listingsCumulativeDepth].sort(
      (a, b) => a.price - b.price,
    );

    // Indices at 33rd, 66th, and 100th percentiles
    const lowIndex = Math.floor(sortedData.length * 0.33);
    const mediumIndex = Math.floor(sortedData.length * 0.66);
    const highIndex = sortedData.length - 1;

    const lowPoint = sortedData[lowIndex];
    const mediumPoint = sortedData[mediumIndex];
    const highPoint = sortedData[highIndex];

    return {
      low: {
        count: Math.round(lowPoint.cumulativeCount),
        price: lowPoint.price,
      },
      medium: {
        count: Math.round(mediumPoint.cumulativeCount),
        price: mediumPoint.price,
      },
      high: {
        count: Math.round(highPoint.cumulativeCount),
        price: highPoint.price,
      },
    };
  }, [listingsCumulativeDepth]);

  const createReferenceLineProps = (
    count: number,
    price?: number,
  ): Pick<
    ReferenceLineProps,
    "stroke" | "strokeDasharray" | "strokeWidth" | "label"
  > => ({
    stroke: "rgba(255, 255, 255, 0.6)",
    strokeDasharray: "4 4",
    strokeWidth: 0.5,
    label: isHovered
      ? undefined
      : {
          value: price
            ? `${count} listings to be sold until ${formatCurrency(
                price,
                currency,
              )}`
            : `${count} listings`,
          position: "top",
          style: {
            fill: "rgba(255, 255, 255, 0.9)",
            fontSize: "11px",
            fontWeight: "500",
          },
        },
  });

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
        margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          domain={[0, "dataMax + 10"]}
          tickFormatter={(val) => String(val)}
          hide={true}
        />

        {/* Price level reference lines */}
        <ReferenceLine
          y={priceLevels.low.count}
          {...createReferenceLineProps(
            priceLevels.low.count,
            priceLevels.low.price,
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <ReferenceLine
          y={priceLevels.medium.count}
          {...createReferenceLineProps(
            priceLevels.medium.count,
            priceLevels.medium.price,
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <ReferenceLine
          y={priceLevels.high.count}
          {...createReferenceLineProps(
            priceLevels.high.count,
            priceLevels.high.price,
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />

        <ChartTooltip
          shared
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const value = payload[0];

                return `Price: ${formatCurrency(
                  value.payload.price,
                  currency,
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
          opacity={isHovered ? 1 : 0.4}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <Area
          type="stepAfter"
          dataKey="salesCumulativeCount"
          name="Sales"
          stroke="rgb(34 197 94)" // green-500
          fill="url(#salesGradient)"
          connectNulls
          opacity={isHovered ? 1 : 0.4}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function mergeMarketDepthData(
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[],
  salesCumulativeDepth: { price: number; cumulativeCount: number }[],
) {
  // Merge series by price, sorted from lowest to highest (left to right)
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
