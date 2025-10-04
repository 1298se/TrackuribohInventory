"use client";

import { useState } from "react";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import {
  getMarketDepthQuery,
  getProductListingsQuery,
} from "@/features/market/api";
import { getProductQuery } from "@/features/catalog/api";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MarketDepthChart } from "@/features/market/components/MarketDepthChart";
import { MarketLevelsChartCard } from "@/features/market/components/MarketLevelsChartCard";
import Link from "next/link";
import { findFirstNearMintSku, formatCurrency } from "@/shared/utils";
import { assertNotNullable, assert } from "@/lib/validation";
import { Loader2 } from "lucide-react";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { MonitorDot } from "@/shared/components/MonitorDot";
import {
  MarketListingsTable,
  MarketListingsTableLoading,
} from "@/features/catalog/components/MarketListingsTable";
import { MarketListingsTableConditions } from "@/features/catalog/components/MarketListingsTableConditions";
import {
  type ConditionFilter,
  isValidCondition,
} from "@/features/catalog/utils";

export default function ProductSKUDetailsPage() {
  const { sku } = useParams();

  assert(typeof sku === "string", "Invalid SKU");

  const { data: product } = useSuspenseQuery(getProductQuery(sku));

  assertNotNullable(product, "Product not found");

  const nearMintSku =
    product && product.skus?.length > 0
      ? findFirstNearMintSku(product.skus)
      : null;

  const { data: parsedMarketDepth } = useQuery(
    getMarketDepthQuery({ sku, salesLookbackDays: 7 })
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Desktop: Sidebar + Main content */}
      <div className="md:flex w-full">
        {/* Persistent Sidebar */}
        <div className="md:w-80 md:flex-shrink-0 p-6 md:border-r md:bg-background/50 md:sticky md:top-[62px] md:h-[calc(100vh-62px)] md:overflow-y-auto ">
          <div className="space-y-6">
            <ProductTitleInsightsCard
              productName={product?.name}
              productSetName={product?.set.name}
              productSetID={product?.set.id}
              imageUrl={product?.image_url}
              isLoading={!product}
            />

            <TCGMarketPlacePriceCard
              totalQuantity={parsedMarketDepth?.metrics?.total_quantity || 0}
              lowestListingPriceTotal={
                nearMintSku?.lowest_listing_price_total || 0
              }
              productURL={product?.tcgplayer_url}
              isLoading={!product}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6">
          <div className="flex flex-row gap-4 items-center">
            {parsedMarketDepth ? (
              <MonitorDot />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            <h2 className="text-lg font-medium">Performance monitoring</h2>
          </div>

          <div className="flex flex-col gap-4">
            <MarketDepthChartCard
              listingsCumulativeDepth={parsedMarketDepth?.listingChartData}
              salesCumulativeDepth={parsedMarketDepth?.salesChartData}
            />
            <MarketLevelsChartCard
              listingsCumulativeDepth={parsedMarketDepth?.listingChartData}
              currentPrice={nearMintSku?.lowest_listing_price_total}
              isLoading={!parsedMarketDepth}
            />
          </div>

          <Separator className="my-8" />

          {product?.id && <ListingsCard productId={product.id} />}
        </div>
      </div>
    </div>
  );
}

function ProductImageDisplay({
  imageUrl,
  name,
  isLoading,
  ratio = 1,
}: {
  imageUrl?: string;
  name?: string;
  isLoading?: boolean;
  ratio?: number;
}) {
  const baseWidth = 534;
  const baseHeight = 800;
  const scaledWidth = Math.round(baseWidth * ratio);
  const scaledHeight = Math.round(baseHeight * ratio);

  if (isLoading) {
    return (
      <Skeleton
        className="rounded-[10px]  mx-auto lg:mx-0"
        style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
      />
    );
  }

  assertNotNullable(imageUrl);
  assertNotNullable(name);

  return (
    <ProductImage
      src={getLargeTCGPlayerImage({
        imageUrl: imageUrl,
        size: 800,
      })}
      alt={name}
      containerClassName="w-full h-full"
      className="rounded-[10px] mx-auto lg:mx-0"
      style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
    />
  );
}

function ProductTitle({
  productName,
  productSetName,
  productSetID,
  isLoading,
}: {
  productName: string | undefined;
  productSetName: string | undefined;
  productSetID: string | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="py-2">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-4 w-full mb-1" />
      </div>
    );
  }

  assertNotNullable(productName, "Product name is required");
  assertNotNullable(productSetName, "Product set name is required");
  assertNotNullable(productSetID, "Product set ID is required");

  return (
    <div>
      <CardTitle className="text-xl font-bold">{productName}</CardTitle>
      <Link
        target="_blank"
        href={`/market/set/${productSetID}`}
        className="underline text-muted-foreground text-xs"
      >
        {productSetName}
      </Link>
    </div>
  );
}

function ProductTitleInsightsCard({
  productName,
  productSetName,
  productSetID,
  isLoading,
  imageUrl,
}: {
  productName: string | undefined;
  productSetName: string | undefined;
  productSetID: string | undefined;
  isLoading: boolean;
  imageUrl: string | undefined;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-4 w-3/4 mb-1" />
        </CardHeader>
        <CardContent className="min-h-[150px]" />
      </Card>
    );
  }

  assertNotNullable(productName, "Product name is required");
  assertNotNullable(productSetName, "Product set name is required");
  assertNotNullable(productSetID, "Product set ID is required");

  return (
    <Card className="pb-0 pt-4">
      <CardHeader className="hidden md:block">
        <ProductTitle
          productName={productName}
          productSetName={productSetName}
          productSetID={productSetID}
          isLoading={isLoading}
        />
      </CardHeader>
      <div className="w-full h-full bg-white flex items-center justify-center py-2 rounded-b-xl">
        <ProductImageDisplay
          imageUrl={imageUrl}
          name={productName}
          ratio={0.2}
          isLoading={isLoading}
        />
      </div>
    </Card>
  );
}

function TCGMarketPlacePriceCard({
  totalQuantity,
  lowestListingPriceTotal,
  productURL,
  isLoading,
}: {
  totalQuantity: number | undefined;
  lowestListingPriceTotal: number | undefined;
  productURL: string | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="min-h-[128px]">
        <CardHeader>
          <Skeleton className="h-4 w-3/4 mb-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-3/4 mb-1" />
        </CardContent>
      </Card>
    );
  }

  assertNotNullable(totalQuantity);
  assertNotNullable(lowestListingPriceTotal);
  assertNotNullable(productURL);

  return (
    <MetricCard
      title={
        <div className="flex gap-1">
          <Link
            href={productURL}
            target="_blank"
            className="underline text-muted-foreground text-xs"
          >
            TCGPlayer
          </Link>
          <span className="text-muted-foreground text-xs">Market Price</span>
        </div>
      }
      value={formatCurrency(lowestListingPriceTotal)}
      subtitle={`From ${totalQuantity} units in the market`}
    />
  );
}

function ListingsCard({ productId }: { productId?: string }) {
  const [selectedCondition, setSelectedCondition] =
    useState<ConditionFilter>(null);

  const { data: listingsData, isLoading } = useQuery(
    getProductListingsQuery(productId!)
  );

  const allListings = listingsData?.results || [];

  // Filter listings by condition if one is selected
  const filteredListings = selectedCondition
    ? allListings.filter(
        (listing) =>
          isValidCondition(listing.sku.condition.name) &&
          listing.sku.condition.name === selectedCondition
      )
    : allListings;

  if (isLoading) {
    return <MarketListingsTableLoading />;
  }

  return (
    <div>
      <MarketListingsTableConditions
        listings={allListings}
        selectedCondition={selectedCondition}
        onConditionSelect={setSelectedCondition}
      />
      <MarketListingsTable listings={filteredListings} />
    </div>
  );
}

function MarketDepthChartCard({
  listingsCumulativeDepth,
  salesCumulativeDepth,
}: {
  listingsCumulativeDepth:
    | { price: number; cumulativeCount: number }[]
    | undefined;
  salesCumulativeDepth:
    | { price: number; cumulativeCount: number }[]
    | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Depth analysis</CardTitle>
        <CardDescription>
          Showing total listings and sales for the last 7 days
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 w-full">
        {listingsCumulativeDepth && salesCumulativeDepth ? (
          <MarketDepthChart
            listingsCumulativeDepth={listingsCumulativeDepth}
            salesCumulativeDepth={salesCumulativeDepth}
            currency="USD"
          />
        ) : (
          <Skeleton className="w-full mb-1 h-[240px]" />
        )}
      </CardContent>
    </Card>
  );
}
