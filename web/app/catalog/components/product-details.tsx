"use client";

import React, { useState } from "react";
import { UUID } from "crypto";

// Hooks
import { useProductDetail, useProductMarketData } from "@/app/catalog/api";

// UI Components
import { ProductHeader } from "@/components/product-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Utils
import { MarketDepthWithMetrics } from "@/components/market-depth-chart-with-metrics";
import { SKUMarketDataItem } from "@/app/catalog/schemas";

interface ProductDetailsProps {
  productId: UUID;
}

export function ProductDetails({ productId }: ProductDetailsProps) {
  // Fetch product details
  const {
    product,
    isLoading: productLoading,
    error: productError,
  } = useProductDetail(productId);

  // State for sales lookback days
  const [salesLookbackDays, setSalesLookbackDays] = useState<
    number | undefined
  >(undefined);

  // Fetch market data
  const {
    data: marketDataItems,
    isLoading: marketLoading,
    error: marketError,
  } = useProductMarketData(productId, salesLookbackDays);

  // Note: Additional marketplace/SKU filtering logic from the previous implementation
  // was removed for now. If we reintroduce variant filtering in the future, the relevant
  // state and calculations can be restored here.

  /* ---------------------------------------------------------------------- */
  /* Loading & error handling */
  /* ---------------------------------------------------------------------- */

  if (productError) {
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
  }

  if (!product && !productLoading) {
    return (
      <div className="container mx-auto p-4">
        <Alert>
          <AlertDescription>Product not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Main UI */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Product Header */}
      {productLoading ? (
        <div className="flex w-full items-start gap-4">
          <Skeleton className="h-24 w-24 rounded-md" />
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : (
        <ProductHeader
          imageUrl={product!.image_url}
          name={product!.name}
          badgeContent={product!.rarity || undefined}
          setName={product!.set.name}
          setNumber={product!.number}
        />
      )}

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
            data={marketDataItems as SKUMarketDataItem[]}
            isLoading={marketLoading || productLoading}
            error={marketError}
            salesLookbackDays={salesLookbackDays}
            onSalesLookbackDaysChange={setSalesLookbackDays}
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
