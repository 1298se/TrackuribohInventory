"use client";
import { API_URL } from "@/app/api/fetcher";
import {
  MarketDataResponseSchemaType,
  ProductBaseResponseSchemaType,
  SKUMarketDataItem,
} from "@/app/catalog/schemas";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface PageProps {
  params: { sku: string };
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

function MarketDepthChart({
  listingsCumulativeDepth = [],
  salesCumulativeDepth = [],
  isLoading,
  currency = "USD",
}: {
  listingsCumulativeDepth: { price: number; cumulativeCount: number }[];
  salesCumulativeDepth: { price: number; cumulativeCount: number }[];
  isLoading: boolean;
  currency?: string;
}) {
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

export default function Page() {
  const { sku } = useParams(); // slug is an array

  const { data: product } = useQuery<ProductBaseResponseSchemaType>({
    queryKey: ["product", sku],
    queryFn: () =>
      fetch(`${API_URL}/catalog/product/${sku}`).then((res) => res.json()),
  });

  const { data: marketDepth } = useQuery<MarketDataResponseSchemaType>({
    queryKey: ["marketDepth", sku],
    queryFn: () =>
      fetch(
        `${API_URL}/catalog/product/${sku}/market-data?sales_lookback_days=7`
      ).then((res) => res.json()),
  });

  // Parse market depth data
  const parsedMarketData = useMemo(() => {
    if (!marketDepth?.market_data_items) return null;

    const data = marketDepth.market_data_items;

    // Get unique marketplaces
    const marketplaces = Array.from(new Set(data.map((i) => i.marketplace)));

    // For now, let's use the first marketplace (you can add marketplace selection later)
    const selectedMarketplace = marketplaces[0] || "";
    const itemsForMarketplace = data.filter(
      (i) => i.marketplace === selectedMarketplace
    );

    // Get SKUs for the selected marketplace
    const skusForMarketplace = itemsForMarketplace.map((i) => i.sku);

    // For aggregated view (multiple SKUs), combine the data
    const isAggregated = skusForMarketplace.length > 1;

    return {
      marketplaces,
      selectedMarketplace,
      itemsForMarketplace,
      skusForMarketplace,
      isAggregated,
    };
  }, [marketDepth]);

  // Parse listing depth levels
  const listingDepthLevels = useMemo(() => {
    if (!parsedMarketData?.itemsForMarketplace.length) return [];

    const { itemsForMarketplace, isAggregated } = parsedMarketData;

    if (isAggregated) {
      // Aggregate across all SKUs
      const rawMap = new Map<number, number>();
      itemsForMarketplace.forEach(({ market_data }) => {
        let prev = 0;
        market_data.cumulative_depth_levels.forEach(
          ({ price, cumulative_count }) => {
            const delta = cumulative_count - prev;
            rawMap.set(price, (rawMap.get(price) || 0) + delta);
            prev = cumulative_count;
          }
        );
      });
      const sorted = Array.from(rawMap.keys()).sort((a, b) => a - b);
      let cum = 0;
      return sorted.map((p) => {
        cum += rawMap.get(p)!;
        return { price: p, cumulative_count: cum };
      });
    } else {
      // Single SKU
      return itemsForMarketplace[0]?.market_data.cumulative_depth_levels || [];
    }
  }, [parsedMarketData]);

  // Parse sales depth levels
  const salesDepthLevels = useMemo(() => {
    if (!parsedMarketData?.itemsForMarketplace.length) return [];

    const { itemsForMarketplace, isAggregated } = parsedMarketData;

    if (isAggregated) {
      // Aggregate across all SKUs
      const rawMap = new Map<number, number>();
      itemsForMarketplace.forEach(({ market_data }) => {
        let prev = 0;
        market_data.cumulative_sales_depth_levels.forEach(
          ({ price, cumulative_count }) => {
            const delta = cumulative_count - prev;
            rawMap.set(price, (rawMap.get(price) || 0) + delta);
            prev = cumulative_count;
          }
        );
      });
      const sorted = Array.from(rawMap.keys()).sort((a, b) => a - b);
      let cum = 0;
      return sorted.map((p) => {
        cum += rawMap.get(p)!;
        return { price: p, cumulative_count: cum };
      });
    } else {
      // Single SKU
      return (
        itemsForMarketplace[0]?.market_data.cumulative_sales_depth_levels || []
      );
    }
  }, [parsedMarketData]);

  // Transform for chart data
  const listingChartData = useMemo(
    () =>
      listingDepthLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [listingDepthLevels]
  );

  const salesChartData = useMemo(() => {
    if (!salesDepthLevels.length) return [];

    // Find the maximum cumulative count to reverse the sales data
    const maxCount = Math.max(
      ...salesDepthLevels.map((d) => d.cumulative_count)
    );

    return salesDepthLevels.map(({ price, cumulative_count }) => ({
      price,
      cumulativeCount: maxCount - cumulative_count,
    }));
  }, [salesDepthLevels]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!parsedMarketData?.itemsForMarketplace.length) return null;

    const { itemsForMarketplace, isAggregated } = parsedMarketData;

    if (isAggregated) {
      const total_listings = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_listings,
        0
      );
      const total_quantity = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_quantity,
        0
      );
      const total_sales = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_sales,
        0
      );

      // Calculate true sales velocity: total sales / lookback days
      const lookbackDays = 7; // from your API call
      const sales_velocity = parseFloat(
        (total_sales / lookbackDays).toFixed(2)
      );

      const days_of_inventory =
        sales_velocity > 0
          ? parseFloat((total_quantity / sales_velocity).toFixed(1))
          : null;

      return {
        total_listings,
        total_quantity,
        total_sales,
        sales_velocity,
        days_of_inventory,
      };
    } else {
      return itemsForMarketplace[0]?.market_data || null;
    }
  }, [parsedMarketData]);

  // Combine all parsed data
  const finalParsedData = useMemo(() => {
    if (!parsedMarketData) return null;

    return {
      ...parsedMarketData,
      listingDepthLevels,
      salesDepthLevels,
      listingChartData,
      salesChartData,
      metrics,
    };
  }, [
    parsedMarketData,
    listingDepthLevels,
    salesDepthLevels,
    listingChartData,
    salesChartData,
    metrics,
  ]);

  console.log("Parsed market data:", finalParsedData);

  if (!product) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{product?.name}</h1>
      <Image
        src={getLargeTCGPlayerImage({ imageUrl: product.image_url, size: 800 })}
        alt={product.name}
        width={350}
        height={350}
        className="rounded-[25px] outline-2 outline-sidebar-border shadow-2xl"
      />

      {/* Market Depth Chart with Metrics */}
      {finalParsedData && (
        <div className="mt-6 space-y-4">
          {/* Main metric and secondary metrics */}
          <div className="space-y-1">
            <div className="flex items-start gap-8">
              {/* Primary Metric */}
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">
                  Quantity Available
                </span>
                <h2 className="text-3xl font-bold tracking-tight">
                  {finalParsedData.metrics?.total_quantity?.toLocaleString() ||
                    "0"}
                </h2>
              </div>

              {/* Secondary Metrics beside primary */}
              {finalParsedData.metrics && (
                <div className="flex items-start gap-6">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Sales velocity
                    </span>
                    <div className="text-lg font-semibold text-muted-foreground tabular-nums">
                      {finalParsedData.metrics.sales_velocity} /day
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Days of inventory
                    </span>
                    <div className="text-lg font-semibold text-muted-foreground tabular-nums">
                      {finalParsedData.metrics.days_of_inventory != null
                        ? `${finalParsedData.metrics.days_of_inventory} days`
                        : "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chart Legend - Listings and Sales */}
            {finalParsedData.metrics && (
              <div className="flex items-center gap-6 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#3B82F6" }}
                  ></div>
                  <span className="text-muted-foreground">Listings:</span>
                  <span className="font-medium tabular-nums">
                    {finalParsedData.metrics.total_listings?.toLocaleString() ||
                      "0"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#F97316" }}
                  ></div>
                  <span className="text-muted-foreground">Sales:</span>
                  <span className="font-medium tabular-nums">
                    {finalParsedData.metrics.total_sales?.toLocaleString() ||
                      "0"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="w-full">
            <MarketDepthChart
              listingsCumulativeDepth={finalParsedData.listingChartData}
              salesCumulativeDepth={finalParsedData.salesChartData}
              isLoading={!marketDepth}
              currency="USD"
            />
          </div>
        </div>
      )}
    </div>
  );
}
