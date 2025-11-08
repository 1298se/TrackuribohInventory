"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/ui/tabs";
import { MetricCard } from "@/shadcn/ui/metric-card";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { Separator } from "@/shadcn/ui/separator";
import { Loader2, PackageX } from "lucide-react";

import { getLargeTCGPlayerImage } from "@/features/market/utils";
import {
  getProductVariantMarketDepthQuery,
  getProductVariantListingsQuery,
} from "@/features/market/api";
import {
  getProductVariantQuery,
  getProductVariantPriceSummaryQuery,
  getProductVariantPriceHistoryQuery,
} from "@/features/catalog/api";
import { MarketDepthChart } from "@/features/market/components/MarketDepthChart";
import { MarketLevelsChartCard } from "@/features/market/components/MarketLevelsChartCard";
import { PriceHistoryChart } from "@/features/inventory/components/PriceHistoryChart";
import { TimeRangeToggle } from "@/shadcn/ui/time-range-toggle";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import {
  MarketListingsTable,
  MarketListingsTableLoading,
  TCGPLAYER_COLUMNS,
  EBAY_COLUMNS,
} from "@/features/catalog/components/MarketListingsTable";
import { MarketListingsTableConditions } from "@/features/catalog/components/MarketListingsTableConditions";
import {
  type ConditionFilter,
  isValidCondition,
} from "@/features/catalog/utils";
import { MonitorDot } from "@/shared/components/MonitorDot";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatCurrency } from "@/shared/utils";
import { assert, assertNotNullable } from "@/lib/validation";

export default function ProductVariantDetailsPage() {
  const { productVariantId } = useParams();
  const [priceHistoryDays, setPriceHistoryDays] = useState<string>("30d");

  assert(
    typeof productVariantId === "string",
    "Invalid product variant identifier",
  );

  const { data: productVariant, isLoading: isProductVariantLoading } = useQuery(
    getProductVariantQuery(productVariantId),
  );

  const { data: priceSummary, isLoading: isPriceSummaryLoading } = useQuery({
    ...getProductVariantPriceSummaryQuery(productVariantId),
    enabled: !!productVariant,
  });

  const { data: parsedMarketDepth, isLoading: isMarketDepthLoading } = useQuery(
    {
      ...getProductVariantMarketDepthQuery({
        productVariantId: productVariantId,
        salesLookbackDays: 7,
      }),
      enabled: !!productVariant,
    },
  );

  // Helper function to convert time range to days
  const timeRangeToDays = (timeRange: string): number => {
    switch (timeRange) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "1y":
        return 365;
      default:
        return 30;
    }
  };

  const { data: priceHistoryData, isLoading: isPriceHistoryLoading } = useQuery(
    {
      ...getProductVariantPriceHistoryQuery(
        productVariantId,
        timeRangeToDays(priceHistoryDays),
      ),
      enabled: !!productVariant,
    },
  );

  const effectiveProduct = productVariant?.product ?? null;
  const effectiveSet = productVariant?.set ?? null;
  const isLoading = isProductVariantLoading || isPriceSummaryLoading;

  const tcgPlayerPrice =
    priceSummary?.prices.find((p) => p.marketplace === "tcgplayer")
      ?.market_price ?? null;

  const isVariantNotFound = !isProductVariantLoading && !productVariant;

  if (isVariantNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-62px)]">
        <EmptyState
          icon={PackageX}
          title="Product variant not found"
          description="The variant you're looking for doesn't exist or has been removed."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="md:flex w-full">
        <div className="md:w-80 md:flex-shrink-0 p-6 md:border-r md:bg-background/50 md:sticky md:top-[62px] md:h-[calc(100vh-62px)] md:overflow-y-auto ">
          <div className="space-y-6">
            <ProductTitleInsightsCard
              productName={effectiveProduct?.name}
              productSetName={effectiveSet?.name}
              productSetID={effectiveSet?.id}
              imageUrl={effectiveProduct?.image_url}
              isLoading={isLoading}
              variantPrinting={productVariant?.printing.name}
            />

            <TCGMarketPlacePriceCard
              totalQuantity={parsedMarketDepth?.metrics?.total_quantity ?? null}
              lowestListingPriceTotal={tcgPlayerPrice}
              productURL={effectiveProduct?.tcgplayer_url ?? null}
              isLoading={isLoading}
            />
          </div>
        </div>

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
              currentPrice={tcgPlayerPrice ?? undefined}
              isLoading={!parsedMarketDepth}
            />
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div>
                    <CardTitle>Price History</CardTitle>
                    <CardDescription>
                      Historical prices by condition over time
                    </CardDescription>
                  </div>
                  <TimeRangeToggle
                    value={priceHistoryDays}
                    onChange={setPriceHistoryDays}
                    options={[
                      { label: "7d", value: "7d" },
                      { label: "30d", value: "30d" },
                      { label: "90d", value: "90d" },
                      { label: "1y", value: "1y" },
                    ]}
                  />
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 w-full">
                {isPriceHistoryLoading || !priceHistoryData ? (
                  <Skeleton className="w-full mb-1 h-[240px]" />
                ) : (
                  <PriceHistoryChart
                    series={priceHistoryData.series}
                    isLoading={false}
                    currency="USD"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Separator className="my-8" />

          <ListingsCard productVariantId={productVariantId} />
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
  imageUrl?: string | null;
  name?: string | null;
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
  variantPrinting,
  isLoading,
}: {
  productName: string | undefined;
  productSetName: string | undefined;
  productSetID: string | undefined;
  variantPrinting?: string;
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
      <div className="flex items-center gap-2">
        <Link
          target="_blank"
          href={`/market/set/${productSetID}`}
          className="underline text-muted-foreground text-xs"
        >
          {productSetName}
        </Link>
        {variantPrinting && (
          <span className="text-muted-foreground text-xs">
            {variantPrinting}
          </span>
        )}
      </div>
    </div>
  );
}

function ProductTitleInsightsCard({
  productName,
  productSetName,
  productSetID,
  variantPrinting,
  isLoading,
  imageUrl,
}: {
  productName: string | undefined;
  productSetName: string | undefined;
  productSetID: string | undefined;
  variantPrinting?: string;
  isLoading: boolean;
  imageUrl: string | undefined | null;
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
          variantPrinting={variantPrinting}
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
  totalQuantity: number | null;
  lowestListingPriceTotal: number | null;
  productURL: string | null;
  isLoading: boolean;
}) {
  return (
    <MetricCard
      title={
        <div className="flex gap-1">
          {productURL ? (
            <Link
              href={productURL}
              target="_blank"
              className="underline text-muted-foreground text-xs"
            >
              TCGPlayer
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">TCGPlayer</span>
          )}
          <span className="text-muted-foreground text-xs">Market Price</span>
        </div>
      }
      value={
        isLoading ? (
          <Skeleton className="h-8 w-3/4 mb-1" />
        ) : (
          formatCurrency(lowestListingPriceTotal)
        )
      }
      subtitle={
        isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          `From ${totalQuantity ?? 0} units in the market`
        )
      }
    />
  );
}

function ListingsCard({ productVariantId }: { productVariantId: string }) {
  const [selectedCondition, setSelectedCondition] =
    useState<ConditionFilter>(null);

  const { data: listingsData, isLoading } = useQuery(
    getProductVariantListingsQuery(productVariantId),
  );

  const allListings = listingsData?.results || [];

  // Split listings by marketplace
  const tcgListings = allListings.filter((l) => l.marketplace === "tcgplayer");
  const ebayListings = allListings.filter((l) => l.marketplace === "ebay");

  // Apply condition filter to each marketplace's listings
  const filteredTcgListings = selectedCondition
    ? tcgListings.filter(
        (listing) =>
          isValidCondition(listing.sku.condition.name) &&
          listing.sku.condition.name === selectedCondition,
      )
    : tcgListings;

  const filteredEbayListings = selectedCondition
    ? ebayListings.filter(
        (listing) =>
          isValidCondition(listing.sku.condition.name) &&
          listing.sku.condition.name === selectedCondition,
      )
    : ebayListings;

  if (isLoading) {
    return <MarketListingsTableLoading />;
  }

  return (
    <div className="space-y-4">
      <MarketListingsTableConditions
        listings={allListings}
        selectedCondition={selectedCondition}
        onConditionSelect={setSelectedCondition}
      />
      <Tabs defaultValue="tcgplayer">
        <TabsList>
          <TabsTrigger value="tcgplayer">
            TCGPlayer ({filteredTcgListings.length})
          </TabsTrigger>
          <TabsTrigger value="ebay">
            eBay ({filteredEbayListings.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tcgplayer">
          <MarketListingsTable
            listings={filteredTcgListings}
            columns={TCGPLAYER_COLUMNS}
          />
        </TabsContent>
        <TabsContent value="ebay">
          <MarketListingsTable
            listings={filteredEbayListings}
            columns={EBAY_COLUMNS as any}
          />
        </TabsContent>
      </Tabs>
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
