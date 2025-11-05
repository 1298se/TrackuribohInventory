import { API_URL } from "@/shared/fetcher";
import {
  MarketDataResponse,
  BuyDecisionsResponse,
  ProductListingsResponse,
} from "./types";
import { DisplayCardProps } from "@/features/catalog/components/DisplayCard";
import { queryOptions } from "@tanstack/react-query";

async function fetchBuyDecisions(): Promise<BuyDecisionsResponse> {
  const response = await fetch(`${API_URL}/buy-decisions`);
  return response.json();
}

export function getCardDecisionsQuery() {
  return queryOptions<BuyDecisionsResponse, Error, DisplayCardProps[]>({
    queryKey: ["cardDecisions"],
    queryFn: fetchBuyDecisions,
    select: (data) => {
      return data.decisions
        .map((decision) => {
          const productVariantId = decision.sku.variant_id;
          if (!productVariantId) {
            return null;
          }

          return {
            decisionId: decision.id,
            productVariantId,
            name: decision.sku.product.name,
            number: decision.sku.product.number,
            image_url: decision.sku.product.image_url,
            set: {
              name: decision.sku.product.set.name,
              id: decision.sku.product.set.id,
            },
            price: decision.buy_vwap.amount,
            product_type: decision.sku.product.product_type,
          } satisfies DisplayCardProps;
        })
        .filter((card): card is DisplayCardProps => card !== null);
    },
  });
}

function parseMarketData(marketDepth: MarketDataResponse | undefined) {
  if (!marketDepth?.market_data_items) return null;

  const data = marketDepth.market_data_items;

  // Get unique marketplaces
  const marketplaces = Array.from(
    new Set(
      data
        .filter((i) => i.sku.condition.abbreviation !== "NM")
        .map((i) => i.marketplace),
    ),
  );

  // For now, let's use the first marketplace (you can add marketplace selection later)
  const selectedMarketplace = marketplaces[0] || "";
  const itemsForMarketplace = data.filter(
    (i) => i.marketplace === selectedMarketplace,
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
          },
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
          },
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
    }),
  );

  const salesChartData = (() => {
    if (!salesDepthLevels.length) return [];

    // Find the maximum cumulative count to reverse the sales data
    const maxCount = Math.max(
      ...salesDepthLevels.map((d) => d.cumulative_count),
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
        0,
      );
      const totalQuantity = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_quantity,
        0,
      );
      const totalSales = itemsForMarketplace.reduce(
        (s, i) => s + i.market_data.total_sales,
        0,
      );

      // Calculate true sales velocity: total sales / lookback days
      const salesVelocity = totalSales / 7; // 7 days lookback

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

async function fetchProductVariantMarketData(
  productVariantId: string,
  salesLookbackDays: number = 7,
): Promise<MarketDataResponse> {
  const response = await fetch(
    `${API_URL}/market/product-variants/${productVariantId}/market-data?sales_lookback_days=${salesLookbackDays}`,
  );
  return response.json();
}

export function getProductVariantMarketDepthQuery({
  productVariantId,
  salesLookbackDays,
}: {
  productVariantId: string;
  salesLookbackDays: number;
}) {
  return queryOptions<
    MarketDataResponse,
    Error,
    ReturnType<typeof parseMarketData>
  >({
    queryKey: ["productVariantMarketDepth", productVariantId],
    queryFn: () =>
      fetchProductVariantMarketData(productVariantId, salesLookbackDays),
    select: parseMarketData,
  });
}

async function fetchProductVariantListings(
  productVariantId: string,
): Promise<ProductListingsResponse> {
  const response = await fetch(
    `${API_URL}/market/product-variants/${productVariantId}/listings`,
  );
  return response.json();
}

export function getProductVariantListingsQuery(productVariantId: string) {
  return queryOptions<ProductListingsResponse, Error>({
    queryKey: ["productVariantListings", productVariantId],
    queryFn: () => fetchProductVariantListings(productVariantId),
    select: (data) => ({
      ...data,
      results: data.results.map((listing) => ({
        ...listing,
        price: Number(listing.price) || 0,
        shipping_price:
          listing.shipping_price !== null
            ? Number(listing.shipping_price)
            : null,
      })),
    }),
  });
}
