"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useProductDetail, useProductMarketData } from "@/app/catalog/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { UUID } from "crypto";
import { MarketDepthChart } from "@/components/market-depth-chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { SKUMarketDataItem, CumulativeDepthLevel } from "@/app/catalog/schemas";
import { formatSKU } from "@/app/catalog/utils";
import { ProductHeader } from "@/components/product-header";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId as UUID | undefined;

  // Fetch product details and pre-aggregated market depth
  const {
    product,
    isLoading: productLoading,
    error: productError,
  } = useProductDetail(productId);
  const {
    data: productMarketData,
    isLoading: marketLoading,
    error: marketError,
  } = useProductMarketData(productId);

  // Controlled component state for marketplace and SKU filtering
  const marketDataItems: SKUMarketDataItem[] =
    productMarketData?.market_data_items || [];
  const marketplaces = useMemo(
    () => Array.from(new Set(marketDataItems.map((i) => i.marketplace))),
    [marketDataItems],
  );

  // Initialize marketplace selection
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>("");
  useEffect(() => {
    if (
      marketplaces.length > 0 &&
      !marketplaces.includes(selectedMarketplace)
    ) {
      setSelectedMarketplace(marketplaces[0]);
    }
  }, [marketplaces, selectedMarketplace]);

  // Filter items by selected marketplace
  const itemsForMarketplace = useMemo(
    () => marketDataItems.filter((i) => i.marketplace === selectedMarketplace),
    [marketDataItems, selectedMarketplace],
  );

  // Get available SKUs for selected marketplace
  const skus = useMemo(
    () => itemsForMarketplace.map((i) => i.sku),
    [itemsForMarketplace],
  );

  // Initialize or update SKU selection
  const [selectedSku, setSelectedSku] = useState<string>("");
  useEffect(() => {
    // Set default SKU when the list changes (on marketplace change)
    if (skus.length > 1) {
      setSelectedSku("aggregated");
    } else if (skus.length === 1) {
      setSelectedSku(skus[0].id);
    }
  }, [skus]);

  // Compute depth levels based on selection
  const displayedDepthLevels = useMemo(() => {
    if (!itemsForMarketplace.length) return [];

    // For "All Variants" option, aggregate data
    if (skus.length > 1 && selectedSku === "aggregated") {
      // Store non-cumulative quantity at each price point
      const rawMap = new Map<number, number>();

      itemsForMarketplace.forEach(({ market_data }) => {
        let prevCum = 0;
        market_data.cumulative_depth_levels.forEach(
          ({ price, cumulative_count }) => {
            // Get delta (actual quantity at this price point)
            const delta = cumulative_count - prevCum;
            rawMap.set(price, (rawMap.get(price) || 0) + delta);
            prevCum = cumulative_count;
          },
        );
      });

      // Rebuild cumulative data
      const sortedPrices = Array.from(rawMap.keys()).sort((a, b) => a - b);
      let cumSum = 0;
      return sortedPrices.map((price) => {
        cumSum += rawMap.get(price)!;
        return { price, cumulative_count: cumSum };
      });
    }

    // For single SKU selection
    const target =
      skus.length > 1
        ? itemsForMarketplace.find((i) => i.sku.id === selectedSku)
        : itemsForMarketplace[0];

    return target?.market_data.cumulative_depth_levels || [];
  }, [itemsForMarketplace, selectedSku, skus]);
  const chartData = useMemo(
    () =>
      displayedDepthLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [displayedDepthLevels],
  );

  // Loading & Error Handling
  if (productLoading) {
    return (
      <div className="container mx-auto p-4">Loading Product Details...</div>
    );
  }

  if (productError) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load product details. {productError.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="default">
          <AlertDescription>Product not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Product Header */}
      <ProductHeader
        imageUrl={product.image_url}
        name={product.name}
        badgeContent={product.rarity || undefined}
        setName={product.set.name}
        setNumber={product.number}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        {/* Market Depth Chart */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Market Depth</CardTitle>
                <CardDescription>
                  Near Mint listings from TCGPlayer.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {marketDataItems.length > 0 && !marketError && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Marketplace:</label>
                    <Select
                      value={selectedMarketplace}
                      onValueChange={setSelectedMarketplace}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder="Select marketplace" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketplaces.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {skus.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">SKU:</label>
                    <Select value={selectedSku} onValueChange={setSelectedSku}>
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {skus.length > 1 && (
                          <SelectItem value="aggregated">
                            All Variants
                          </SelectItem>
                        )}
                        {skus.map((sku) => {
                          return (
                            <SelectItem key={sku.id} value={sku.id}>
                              {formatSKU(
                                sku.condition,
                                sku.printing,
                                sku.language,
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {marketError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load market data. {marketError.message}
                </AlertDescription>
              </Alert>
            )}
            <MarketDepthChart isLoading={marketLoading} data={chartData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
