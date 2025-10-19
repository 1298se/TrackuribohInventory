"use client";

import React, { useState } from "react";

// Hooks
import { useGetProductDetailQuery, useGetProductMarketDataQuery } from "../api";
import { useQuery } from "@tanstack/react-query";

// UI Components
import { ProductHeader } from "./ProductHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { Alert, AlertDescription } from "@/shadcn/ui/alert";
import { AlertCircle } from "lucide-react";

// Utils
// import { MarketDepthWithMetrics } from "./MarketDepthWithMetrics";
import { SKUMarketDataItem } from "@/features/market/types";

interface ProductDetailsProps {
  productId: string;
}

export function ProductDetails({ productId }: ProductDetailsProps) {
  // Fetch product details
  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useQuery(useGetProductDetailQuery(productId));

  // State for sales lookback days
  const [salesLookbackDays, setSalesLookbackDays] = useState<
    number | undefined
  >(undefined);

  // Fetch market data
  const {
    data: marketData,
    isLoading: marketLoading,
    error: marketError,
  } = useQuery(useGetProductMarketDataQuery(productId, salesLookbackDays));

  const marketDataItems = marketData?.market_data_items || [];

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
          {/* <MarketDepthWithMetrics
            data={marketDataItems as SKUMarketDataItem[]}
            isLoading={marketLoading || productLoading}
            error={marketError}
            salesLookbackDays={salesLookbackDays}
            onSalesLookbackDaysChange={setSalesLookbackDays}
          /> */}
          <Card>
            <CardHeader>
              <CardTitle>Market Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Market depth and metrics will be displayed here. (Future Implementation)
              </p>
            </CardContent>
          </Card>
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
