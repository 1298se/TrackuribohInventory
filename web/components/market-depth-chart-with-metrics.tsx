import React, { useState, useEffect, useMemo } from "react";
import { SKUMarketDataItem } from "@/app/catalog/schemas";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketDepthChart } from "@/components/market-depth-chart";
import { formatSKU } from "@/app/catalog/utils";
import {
  Select as UISelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { Select } from "@/components/marketplace-selector";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, InfoIcon } from "lucide-react";

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
    <Card className="border-0">
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load market data.</AlertDescription>
          </Alert>
        )}
        <div className="flex w-full items-start gap-6">
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4">
            <MarketDepthChart
              listingsCumulativeDepth={listingChartData}
              salesCumulativeDepth={salesChartData}
              isLoading={isLoading}
              currency={currency}
            />
          </div>
          <TooltipProvider>
            <div className="flex w-48 flex-none flex-col items-start gap-3">
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Quantity
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-lg font-semibold">
                    {selectedMetrics?.total_quantity}
                  </span>
                )}
              </div>
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Listings
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-lg font-semibold">
                    {selectedMetrics?.total_listings}
                  </span>
                )}
              </div>
              <div className="flex w-full flex-col items-start gap-1 relative pl-2 border-l-2 border-l-blue-300/50 dark:border-l-blue-700/50">
                <span className="text-xs font-medium text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1 text-blue-500" />
                  Sales Velocity
                  <Badge
                    variant="secondary"
                    className="ml-1 text-[10px] px-1 py-0"
                  >
                    {salesLookbackDays ?? 7}d
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 ml-1 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Average daily sales over the selected time period</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-lg font-semibold transition-opacity duration-200">
                    {selectedMetrics?.sales_velocity} /day
                  </span>
                )}
              </div>
              <div className="flex w-full flex-col items-start gap-1 relative pl-2 border-l-2 border-l-blue-300/50 dark:border-l-blue-700/50">
                <span className="text-xs font-medium text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1 text-blue-500" />
                  Days of Inventory
                  <Badge
                    variant="secondary"
                    className="ml-1 text-[10px] px-1 py-0"
                  >
                    {salesLookbackDays ?? 7}d
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-3 w-3 ml-1 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        How long current inventory would last at current sales
                        velocity
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-lg font-semibold transition-opacity duration-200">
                    {selectedMetrics?.days_of_inventory != null
                      ? `${selectedMetrics.days_of_inventory} days`
                      : "—"}
                  </span>
                )}
              </div>
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
