import React, { useState, useEffect, useMemo } from "react";
import { SKUMarketDataItem } from "@/app/catalog/schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketDepthChart } from "@/components/market-depth-chart";

interface Props {
  data: SKUMarketDataItem[];
  isLoading: boolean;
  error?: Error;
  currency?: string;
  salesLookbackDays?: number;
  onSalesLookbackDaysChange?: (days: number) => void;
  selectedMarketplace?: string | null;
  onMarketplaceChange?: (marketplace: string) => void;
}

export function MarketDepthWithMetrics({
  data,
  isLoading,
  error,
  currency = "USD",
  salesLookbackDays,
  onSalesLookbackDaysChange,
  selectedMarketplace,
  onMarketplaceChange,
}: Props) {
  const marketplaces = useMemo(
    () => Array.from(new Set(data.map((i) => i.marketplace))),
    [data],
  );

  // Use prop if provided, otherwise manage internally
  const [internalSelectedMarketplace, setInternalSelectedMarketplace] =
    useState<string>("");
  const effectiveMarketplace =
    selectedMarketplace || internalSelectedMarketplace;

  useEffect(() => {
    if (
      !selectedMarketplace &&
      marketplaces.length &&
      !marketplaces.includes(internalSelectedMarketplace)
    ) {
      setInternalSelectedMarketplace(marketplaces[0]);
    }
  }, [marketplaces, internalSelectedMarketplace, selectedMarketplace]);

  const itemsForMarketplace = useMemo(
    () => data.filter((i) => i.marketplace === effectiveMarketplace),
    [data, effectiveMarketplace],
  );
  const skusForMarketplace = useMemo(
    () => itemsForMarketplace.map((i) => i.sku),
    [itemsForMarketplace],
  );

  const [selectedSkuId, setSelectedSkuId] = useState<string>("aggregated");
  useEffect(() => {
    if (skusForMarketplace.length > 1 && selectedSkuId !== "aggregated") return;
    if (skusForMarketplace.length === 1) {
      setSelectedSkuId(skusForMarketplace[0].id);
    }
  }, [skusForMarketplace, selectedSkuId]);

  const displayedDepthLevels = useMemo(() => {
    if (!itemsForMarketplace.length) return [];
    if (skusForMarketplace.length > 1 && selectedSkuId === "aggregated") {
      const rawMap = new Map<number, number>();
      itemsForMarketplace.forEach(({ market_data }) => {
        let prev = 0;
        market_data.cumulative_depth_levels.forEach(
          ({ price, cumulative_count }) => {
            const delta = cumulative_count - prev;
            rawMap.set(price, (rawMap.get(price) || 0) + delta);
            prev = cumulative_count;
          },
        );
      });
      const sorted = Array.from(rawMap.keys()).sort((a, b) => a - b);
      let cum = 0;
      return sorted.map((p) => {
        cum += rawMap.get(p)!;
        return { price: p, cumulative_count: cum };
      });
    }
    const target =
      skusForMarketplace.length > 1
        ? itemsForMarketplace.find((i) => i.sku.id === selectedSkuId)
        : itemsForMarketplace[0];
    return target?.market_data.cumulative_depth_levels || [];
  }, [itemsForMarketplace, skusForMarketplace, selectedSkuId]);

  const displayedSalesLevels = useMemo<
    { price: number; cumulative_count: number }[]
  >(() => {
    if (!itemsForMarketplace.length) return [];
    if (skusForMarketplace.length > 1 && selectedSkuId === "aggregated") {
      const rawMap = new Map<number, number>();
      itemsForMarketplace.forEach(({ market_data }) => {
        let prev = 0;
        market_data.cumulative_sales_depth_levels.forEach(
          ({ price, cumulative_count }) => {
            const delta = cumulative_count - prev;
            rawMap.set(price, (rawMap.get(price) || 0) + delta);
            prev = cumulative_count;
          },
        );
      });
      const sorted = Array.from(rawMap.keys()).sort((a, b) => a - b);
      let cum = 0;
      return sorted.map((p) => {
        cum += rawMap.get(p)!;
        return { price: p, cumulative_count: cum };
      });
    }
    const target =
      skusForMarketplace.length > 1
        ? itemsForMarketplace.find((i) => i.sku.id === selectedSkuId)
        : itemsForMarketplace[0];
    return target?.market_data.cumulative_sales_depth_levels || [];
  }, [itemsForMarketplace, skusForMarketplace, selectedSkuId]);

  const listingChartData = useMemo<
    { price: number; cumulativeCount: number }[]
  >(
    () =>
      displayedDepthLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [displayedDepthLevels],
  );
  const salesChartData = useMemo<{ price: number; cumulativeCount: number }[]>(
    () =>
      displayedSalesLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [displayedSalesLevels],
  );

  const selectedMetrics = useMemo(() => {
    if (!itemsForMarketplace.length) return null;
    if (selectedSkuId === "aggregated") {
      const total_listings = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_listings,
        0,
      );
      const total_quantity = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_quantity,
        0,
      );
      // Calculate total sales across all SKUs from cumulative sales depth levels
      const total_sales = itemsForMarketplace.reduce((sum, item) => {
        const salesLevels = item.market_data.cumulative_sales_depth_levels;
        // The last entry in cumulative sales represents total sales for this SKU
        const skuTotalSales =
          salesLevels.length > 0
            ? salesLevels[salesLevels.length - 1].cumulative_count
            : 0;
        return sum + skuTotalSales;
      }, 0);

      // Calculate true sales velocity: total sales / lookback days
      const lookbackDays = salesLookbackDays || 7;
      const sales_velocity = parseFloat(
        (total_sales / lookbackDays).toFixed(2),
      );

      const days_of_inventory =
        sales_velocity > 0
          ? parseFloat((total_quantity / sales_velocity).toFixed(1))
          : null;
      return {
        total_listings,
        total_quantity,
        sales_velocity,
        days_of_inventory,
      };
    }
    const item = itemsForMarketplace.find((i) => i.sku.id === selectedSkuId);
    return item?.market_data || null;
  }, [itemsForMarketplace, selectedSkuId, salesLookbackDays]);

  return (
    <div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load market data.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-4">
        {/* Main metric and secondary metrics */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-4">
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <h2 className="text-3xl font-bold tracking-tight">
                  {selectedMetrics?.total_quantity?.toLocaleString() || "0"}
                </h2>
                <span className="text-sm text-muted-foreground">
                  Quantity Available
                </span>
              </>
            )}
          </div>
          {/* Secondary Metrics */}
          {!isLoading && selectedMetrics && (
            <div className="flex items-center gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">Listings:</span>
                <span className="font-medium tabular-nums">
                  {selectedMetrics.total_listings?.toLocaleString() || "0"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-muted-foreground">Sales velocity:</span>
                <span className="font-medium tabular-nums">
                  {selectedMetrics.sales_velocity} /day
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-muted-foreground">
                  Days of inventory:
                </span>
                <span className="font-medium tabular-nums">
                  {selectedMetrics.days_of_inventory != null
                    ? `${selectedMetrics.days_of_inventory} days`
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="w-full">
          <MarketDepthChart
            listingsCumulativeDepth={listingChartData}
            salesCumulativeDepth={salesChartData}
            isLoading={isLoading}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
