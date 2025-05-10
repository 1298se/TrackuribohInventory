"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { UUID } from "crypto";

// Hooks
import { useProductDetail, useProductMarketData } from "@/app/catalog/api";

// UI Components
import { ProductHeader } from "@/components/product-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Utils
import { formatSKU } from "@/app/catalog/utils";
import { MarketDepthChart } from "@/components/market-depth-chart";
import { MarketDepthWithMetrics } from "@/components/MarketDepthWithMetrics";
import { SKUMarketDataItem } from "@/app/catalog/schemas";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string as UUID;

  // Existing data fetching
  const {
    product,
    isLoading: productLoading,
    error: productError,
  } = useProductDetail(productId);

  const {
    data: marketDataItems,
    isLoading: marketLoading,
    error: marketError,
  } = useProductMarketData(productId);

  // SKU and Marketplace selection state
  const marketplaces = useMemo(
    () => Array.from(new Set(marketDataItems.map((i) => i.marketplace))),
    [marketDataItems],
  );

  const [selectedMarketplace, setSelectedMarketplace] = useState<string>("");
  useEffect(() => {
    if (
      marketplaces.length > 0 &&
      !marketplaces.includes(selectedMarketplace)
    ) {
      setSelectedMarketplace(marketplaces[0]);
    }
  }, [marketplaces, selectedMarketplace]);

  const itemsForMarketplace = useMemo(
    () => marketDataItems.filter((i) => i.marketplace === selectedMarketplace),
    [marketDataItems, selectedMarketplace],
  );

  const skusForMarketplace = useMemo(
    () => itemsForMarketplace.map((i) => i.sku),
    [itemsForMarketplace],
  );

  // Default to "aggregated" or first SKU
  const [selectedSkuId, setSelectedSkuId] = useState<string>("aggregated");
  useEffect(() => {
    if (skusForMarketplace.length > 0) {
      if (
        (skusForMarketplace.length > 1 && selectedSkuId === "") ||
        (!skusForMarketplace.find((s) => s.id === selectedSkuId) &&
          selectedSkuId !== "aggregated")
      ) {
        setSelectedSkuId("aggregated"); // Default to aggregated if multiple SKUs
      } else if (
        skusForMarketplace.length === 1 &&
        selectedSkuId !== skusForMarketplace[0].id
      ) {
        setSelectedSkuId(skusForMarketplace[0].id); // Default to the single SKU's ID
      }
    } else if (selectedSkuId !== "aggregated") {
      setSelectedSkuId("aggregated"); // Reset if no SKUs for marketplace
    }
  }, [skusForMarketplace, selectedSkuId]);

  // Compute depth levels based on selection (using the existing logic)
  const displayedDepthLevels = useMemo(() => {
    if (!itemsForMarketplace.length) return [];

    // For "All Variants" option, aggregate data
    if (skusForMarketplace.length > 1 && selectedSkuId === "aggregated") {
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
      skusForMarketplace.length > 1
        ? itemsForMarketplace.find((i) => i.sku.id === selectedSkuId)
        : itemsForMarketplace[0];

    return target?.market_data.cumulative_depth_levels || [];
  }, [itemsForMarketplace, selectedSkuId, skusForMarketplace]);

  const chartData = useMemo(
    () =>
      displayedDepthLevels.map(({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      })),
    [displayedDepthLevels],
  );

  // Compute summary metrics for the selected marketplace/SKU or aggregated across SKUs
  const selectedMetrics = useMemo(() => {
    if (!itemsForMarketplace.length) return null;
    if (selectedSkuId === "aggregated") {
      const total_listings = itemsForMarketplace.reduce(
        (sum, i) => sum + i.market_data.total_listings,
        0,
      );
      const total_quantity = itemsForMarketplace.reduce(
        (sum, i) => sum + i.market_data.total_quantity,
        0,
      );
      const sales_velocity = itemsForMarketplace.reduce(
        (sum, i) => sum + i.market_data.sales_velocity,
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
    return item?.market_data ?? null;
  }, [itemsForMarketplace, selectedSkuId]);

  // Basic loading and error handling for product details
  if (productLoading)
    return (
      <div className="container mx-auto p-4">Loading Product Details...</div>
    );
  if (productError)
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load product details: {productError.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  if (!product)
    return (
      <div className="container mx-auto p-4">
        <Alert>
          <AlertDescription>Product not found.</AlertDescription>
        </Alert>
      </div>
    );

  // Main page structure
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

      {/* Tabbed Interface */}
      <Tabs defaultValue="market" className="w-full">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="market">Market Data</TabsTrigger>
            <TabsTrigger value="similar">Similar Products</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="market" className="mt-4">
          {/* Market Depth Chart */}
          <MarketDepthWithMetrics
            data={marketDataItems}
            isLoading={marketLoading}
            error={marketError}
          />
        </TabsContent>

        <TabsContent value="similar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Similar Products</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Details about similar products will be displayed here. (Future
                Implementation)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Other product-specific details will be displayed here. (Future
                Implementation)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
