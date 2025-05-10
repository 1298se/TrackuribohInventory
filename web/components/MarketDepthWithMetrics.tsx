import React, { useState, useEffect, useMemo } from "react";
import { SKUMarketDataItem } from "@/app/catalog/schemas";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketDepthChart } from "@/components/market-depth-chart";
import { formatSKU } from "@/app/catalog/utils";

interface Props {
  data: SKUMarketDataItem[];
  isLoading: boolean;
  error?: Error;
  currency?: string;
}

export function MarketDepthWithMetrics({
  data,
  isLoading,
  error,
  currency = "USD",
}: Props) {
  const marketplaces = useMemo(
    () => Array.from(new Set(data.map((i) => i.marketplace))),
    [data],
  );
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>("");
  useEffect(() => {
    if (marketplaces.length && !marketplaces.includes(selectedMarketplace)) {
      setSelectedMarketplace(marketplaces[0]);
    }
  }, [marketplaces, selectedMarketplace]);

  const itemsForMarketplace = useMemo(
    () => data.filter((i) => i.marketplace === selectedMarketplace),
    [data, selectedMarketplace],
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

  const chartData = useMemo(
    () =>
      displayedDepthLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [displayedDepthLevels],
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
      const sales_velocity = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.sales_velocity,
        0,
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
  }, [itemsForMarketplace, selectedSkuId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full">
          <div>
            <CardTitle>Market Depth</CardTitle>
            <CardDescription>
              Cumulative active listings{" "}
              {selectedSkuId === "aggregated"
                ? "for all variants"
                : "for selected variant"}{" "}
              on {selectedMarketplace || "all marketplaces"}.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <div className="flex items-center space-x-2">
              <label
                htmlFor="marketplace-select"
                className="text-sm font-medium"
              >
                Marketplace:
              </label>
              <Select
                value={selectedMarketplace}
                onValueChange={setSelectedMarketplace}
              >
                <SelectTrigger id="marketplace-select" className="w-32">
                  <SelectValue placeholder="All Marketplaces" />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.map((mp) => (
                    <SelectItem key={mp} value={mp}>
                      {mp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {skusForMarketplace.length > 1 && (
              <div className="flex items-center space-x-2">
                <label htmlFor="sku-select" className="text-sm font-medium">
                  SKU:
                </label>
                <Select value={selectedSkuId} onValueChange={setSelectedSkuId}>
                  <SelectTrigger id="sku-select" className="w-64">
                    <SelectValue placeholder="All SKUs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aggregated">All SKUs</SelectItem>
                    {skusForMarketplace.map((sku) => (
                      <SelectItem key={sku.id} value={sku.id}>
                        {formatSKU(sku.condition, sku.printing, sku.language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load market data.</AlertDescription>
          </Alert>
        )}
        <div className="flex w-full items-start gap-6">
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <MarketDepthChart
                data={chartData}
                isLoading={isLoading}
                currency={currency}
              />
            )}
          </div>
          <div className="flex w-64 flex-none flex-col items-start gap-4">
            <div className="flex w-full flex-col items-start gap-2">
              <span className="text-sm font-medium text-gray-600">
                Total Quantity
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="text-xl font-semibold">
                  {selectedMetrics?.total_quantity}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              <span className="text-sm font-medium text-gray-600">
                Total Listings
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="text-xl font-semibold">
                  {selectedMetrics?.total_listings}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              <span className="text-sm font-medium text-gray-600">
                Sales Velocity
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="text-xl font-semibold">
                  {selectedMetrics?.sales_velocity}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              <span className="text-sm font-medium text-gray-600">
                Days of Inventory
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="text-xl font-semibold">
                  {selectedMetrics?.days_of_inventory != null
                    ? `${selectedMetrics.days_of_inventory} days`
                    : "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
