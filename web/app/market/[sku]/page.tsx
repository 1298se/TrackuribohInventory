"use client";

import {
  MarketDataResponseSchemaType,
  ProductWithSetAndSKUsResponse,
} from "@/app/catalog/schemas";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import { fetchProduct, fetchMarketData } from "@/features/market/api";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo } from "react";
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
import { MarketLevelingChart } from "@/features/market/components/MarketLevelingChart";
import Link from "next/link";
import { findFirstNearMintSku, formatCurrency } from "@/shared/utils";
import { MarketRecentSalesSnapshot } from "@/features/market/components/MarketRecentSalesSnapshot";
import { assertNotNullable } from "@/lib/validation";
import { Loader2 } from "lucide-react";

export default function ProductSKUDetailsPage() {
  const { sku } = useParams();

  if (typeof sku !== "string") {
    throw new Error("Invalid SKU");
  }

  const { data: product } = useQuery<ProductWithSetAndSKUsResponse>({
    queryKey: ["product", sku],
    queryFn: () => fetchProduct(sku),
  });

  const nearMintSku = product ? findFirstNearMintSku(product.skus) : null;

  const { data: marketDepth } = useQuery<MarketDataResponseSchemaType>({
    queryKey: ["marketDepth", sku],
    queryFn: () => fetchMarketData(sku, 7),
  });

  const parsedMarketDepth = useMemo(() => {
    return parseMarketData(marketDepth);
  }, [marketDepth]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-6 grow-1 min-w-[200px]">
        <div className="block md:hidden">
          <ProductTitle
            productName={product?.name}
            productSetName={product?.set.name}
            productSetID={product?.set.id}
            isLoading={!product}
          />
        </div>

        <ProductImage
          imageUrl={product?.image_url}
          name={product?.name}
          ratio={0.3}
          isLoading={!product}
        />

        <div className="grow-2 hidden md:block">
          <ProductTitleInsightsCard
            productName={product?.name}
            productSetName={product?.set.name}
            productSetID={product?.set.id}
            isLoading={!product}
          />
        </div>

        <div className="min-w-[200px]">
          <TCGMarketPlacePriceCard
            totalQuantity={parsedMarketDepth?.metrics?.total_quantity || 0}
            lowestListingPriceTotal={
              nearMintSku?.lowest_listing_price_total || 0
            }
            productURL={product?.tcgplayer_url}
            isLoading={!product}
          />
        </div>

        <div className="block md:hidden">
          <ProductInsightsCard />
        </div>
      </div>

      <Separator className="my-8" />

      <div className="flex flex-row gap-4 items-center">
        {parsedMarketDepth ? (
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex size-3 rounded-full bg-blue-500"></span>
          </span>
        ) : (
          <Loader2 className="w-3 h-3 animate-spin" />
        )}
        <h2 className="text-2xl font-bold">Performance monitoring</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketDepthChartCard
          listingsCumulativeDepth={parsedMarketDepth?.listingChartData}
          salesCumulativeDepth={parsedMarketDepth?.salesChartData}
        />
        <MarketLevelsChartCard
          listingsCumulativeDepth={parsedMarketDepth?.listingChartData}
          isLoading={!parsedMarketDepth}
        />
      </div>

      <ListingsCard />
    </div>
  );
}

function ProductImage({
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
        className="rounded-[10px] shadow-2xl mx-auto lg:mx-0"
        style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
      />
    );
  }

  assertNotNullable(imageUrl);
  assertNotNullable(name);

  return (
    <Image
      src={getLargeTCGPlayerImage({
        imageUrl: imageUrl,
        size: 800,
      })}
      alt={name}
      width={300}
      height={300}
      className="rounded-[10px] shadow-2xl mx-auto lg:mx-0"
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
      <CardTitle className="text-2xl font-bold">{productName}</CardTitle>
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

function ProductInsightsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[138px] h-full">
        <ProductInsightsContent />
      </CardContent>
    </Card>
  );
}

function ProductInsightsContent() {
  return <div>AI insights here</div>;
}

function ProductTitleInsightsCard({
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
    <Card>
      <CardHeader className="hidden md:block">
        <ProductTitle
          productName={productName}
          productSetName={productSetName}
          productSetID={productSetID}
          isLoading={isLoading}
        />
      </CardHeader>
      <Separator />
      <CardContent className="min-h-[133px] h-full">
        <ProductInsightsContent />
      </CardContent>
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
        <Link
          href={productURL}
          target="_blank"
          className="underline text-muted-foreground text-xs"
        >
          TCGPlayer
        </Link>
      }
      value={formatCurrency(lowestListingPriceTotal)}
      subtitle={`From ${totalQuantity} units in the market`}
    />
  );
}

function ListingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Listings</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <MarketRecentSalesSnapshot />
      </CardContent>
    </Card>
  );
}

function MarketLevelsChartCard({
  listingsCumulativeDepth,
}: {
  listingsCumulativeDepth:
    | { price: number; cumulativeCount: number }[]
    | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price leveling</CardTitle>
        <CardDescription>
          See how many listings need to be sold to reach different price points
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 w-full">
        {listingsCumulativeDepth ? (
          <MarketLevelingChart
            listingsCumulativeDepth={listingsCumulativeDepth}
            currency="USD"
          />
        ) : (
          <Skeleton className="w-full mb-1 h-[240px]" />
        )}
      </CardContent>
    </Card>
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

function parseMarketData(
  marketDepth: MarketDataResponseSchemaType | undefined
) {
  if (!marketDepth?.market_data_items) return null;

  const data = marketDepth.market_data_items;

  // Get unique marketplaces
  const marketplaces = Array.from(
    new Set(
      data
        .filter((i) => i.sku.condition.abbreviation !== "NM")
        .map((i) => i.marketplace)
    )
  );

  // For now, let's use the first marketplace (you can add marketplace selection later)
  const selectedMarketplace = marketplaces[0] || "";
  const itemsForMarketplace = data.filter(
    (i) => i.marketplace === selectedMarketplace
  );

  // Get SKUs for the selected marketplace
  const skusForMarketplace = itemsForMarketplace.map((i) => i.sku);

  // For aggregated view (multiple SKUs), combine the data
  const isAggregated = skusForMarketplace.length > 1;

  const parsedMarketData = {
    marketplaces,
    selectedMarketplace,
    itemsForMarketplace,
    skusForMarketplace,
    isAggregated,
  };

  // Parse listing depth levels
  const listingDepthLevels = (() => {
    if (!parsedMarketData.itemsForMarketplace.length) return [];

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
  })();

  // Parse sales depth levels
  const salesDepthLevels = (() => {
    if (!parsedMarketData.itemsForMarketplace.length) return [];

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
  })();

  // Transform for chart data
  const listingChartData = listingDepthLevels.map(
    ({ price, cumulative_count }) => ({
      price,
      cumulativeCount: cumulative_count,
    })
  );

  const salesChartData = (() => {
    if (!salesDepthLevels.length) return [];

    // Find the maximum cumulative count to reverse the sales data
    const maxCount = Math.max(
      ...salesDepthLevels.map((d) => d.cumulative_count)
    );

    return salesDepthLevels.map(({ price, cumulative_count }) => ({
      price,
      cumulativeCount: maxCount - cumulative_count,
    }));
  })();

  // Calculate metrics
  const metrics = (() => {
    if (!parsedMarketData.itemsForMarketplace.length) return null;

    const { itemsForMarketplace, isAggregated } = parsedMarketData;

    if (isAggregated) {
      const totalListings = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_listings,
        0
      );
      const totalQuantity = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_quantity,
        0
      );
      const totalSales = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_sales,
        0
      );

      // Calculate true sales velocity: total sales / lookback days
      const lookbackDays = 7; // from your API call
      const salesVelocity = parseFloat((totalSales / lookbackDays).toFixed(2));

      return {
        total_listings: totalListings,
        total_quantity: totalQuantity,
        total_sales: totalSales,
        sales_velocity: salesVelocity,
      };
    } else {
      return itemsForMarketplace[0]?.market_data || null;
    }
  })();

  // Combine all parsed data
  return {
    ...parsedMarketData,
    listingDepthLevels,
    salesDepthLevels,
    listingChartData,
    salesChartData,
    metrics,
  };
}
