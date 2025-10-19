"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ReferenceLine } from "recharts";
import type { ReferenceLineProps } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shadcn/ui/chart";

import { formatCurrency } from "@/shared/utils";

const COLORS = {
  LISTINGS_COLOR: "rgb(59 130 246)", // blue-500

  REFERENCE_LINE_STROKE: "rgba(255, 255, 255, 0.6)",
  REFERENCE_LINE_LABEL: "rgba(255, 255, 255, 0.9)",

  PRICE_LEVEL_LOW: "rgb(156 163 175)", // gray-400
  PRICE_LEVEL_MEDIUM: "rgb(107 114 128)", // gray-500
  PRICE_LEVEL_HIGH: "rgb(55 65 81)", // gray-700
} as const;

interface MarketLevelingChartProps {
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[];
  currency?: string;
}

export function MarketLevelingChart({
  listingsCumulativeDepth = [],
  currency = "USD",
}: MarketLevelingChartProps) {
  const [isHovered, setIsHovered] = useState(false);

  const chartData = useMemo(() => {
    return listingsCumulativeDepth.map((item) => ({
      price: item.price,
      listingCumulativeCount: item.cumulativeCount,
    }));
  }, [listingsCumulativeDepth]);

  // Percentile-based distribution for better spread
  const priceLevels = useMemo(() => {
    if (chartData.length === 0)
      return {
        low: { count: 0, price: 0 },
        medium: { count: 0, price: 0 },
        high: { count: 0, price: 0 },
      };

    const sortedData = [...chartData].sort((a, b) => a.price - b.price);

    // Indices at 33rd, 66th, and 100th percentiles
    const lowIndex = Math.floor(sortedData.length * 0.33);
    const mediumIndex = Math.floor(sortedData.length * 0.66);
    const highIndex = sortedData.length - 1;

    const lowPoint = sortedData[lowIndex];
    const mediumPoint = sortedData[mediumIndex];
    const highPoint = sortedData[highIndex];

    return {
      low: {
        count: Math.round(lowPoint.listingCumulativeCount),
        price: lowPoint.price,
      },
      medium: {
        count: Math.round(mediumPoint.listingCumulativeCount),
        price: mediumPoint.price,
      },
      high: {
        count: Math.round(highPoint.listingCumulativeCount),
        price: highPoint.price,
      },
    };
  }, [chartData]);

  const createReferenceLineProps = (
    count: number,
    price?: number
  ): Pick<
    ReferenceLineProps,
    "stroke" | "strokeDasharray" | "strokeWidth" | "label"
  > => ({
    stroke: COLORS.REFERENCE_LINE_STROKE,
    strokeDasharray: "4 4",
    strokeWidth: 0.5,
    label: isHovered
      ? undefined
      : {
          value: price
            ? `${count} listings to be sold until ${formatCurrency(
                price,
                currency
              )}`
            : `${count} listings`,
          position: "top",
          style: {
            fill: COLORS.REFERENCE_LINE_LABEL,
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
          color: COLORS.LISTINGS_COLOR,
        },
      }}
    >
      <AreaChart
        data={chartData}
        margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <defs>
          <linearGradient id="listingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={COLORS.LISTINGS_COLOR}
              stopOpacity={0.8}
            />
            <stop
              offset="100%"
              stopColor={COLORS.LISTINGS_COLOR}
              stopOpacity={0.1}
            />
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
            priceLevels.low.price
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <ReferenceLine
          y={priceLevels.medium.count}
          {...createReferenceLineProps(
            priceLevels.medium.count,
            priceLevels.medium.price
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <ReferenceLine
          y={priceLevels.high.count}
          {...createReferenceLineProps(
            priceLevels.high.count,
            priceLevels.high.price
          )}
          style={{
            transition: "opacity 0.3s ease-in-out",
          }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const [value] = payload;

                return `Price: ${formatCurrency(
                  value.payload.price,
                  currency
                )}`;
              }}
            />
          }
        />

        <Area
          type="stepAfter"
          dataKey="listingCumulativeCount"
          name="Listings"
          stroke={COLORS.LISTINGS_COLOR}
          fill="url(#listingsGradient)"
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
