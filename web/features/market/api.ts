import { API_URL } from "@/app/api/fetcher";
import { MarketDataResponseSchemaType } from "@/app/catalog/schemas";
import { BuyDecisionsResponseSchemaType } from "./schemas";
import { DisplayCardProps } from "@/features/catalog/components/DisplayCard";
import { queryOptions } from "@tanstack/react-query";

async function fetchBuyDecisions(): Promise<BuyDecisionsResponseSchemaType> {
  const response = await fetch(`${API_URL}/buy-decisions`);
  return response.json();
}

export function getCardDecisionsQuery() {
  return queryOptions<
    BuyDecisionsResponseSchemaType,
    Error,
    DisplayCardProps[]
  >({
    queryKey: ["cardDecisions"],
    queryFn: fetchBuyDecisions,
    select: (data) => {
      return data.decisions.map((decision) => {
        return {
          decisionId: decision.id,
          productId: decision.sku.product.id,
          name: decision.sku.product.name,
          number: decision.sku.product.number,
          image_url: decision.sku.product.image_url,
          set: {
            name: decision.sku.product.set.name,
            id: decision.sku.product.set.id,
          },
          price: decision.buy_vwap,
        } satisfies DisplayCardProps;
      });
    },
  });
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

async function fetchMarketData(
  sku: string,
  salesLookbackDays: number = 7
): Promise<MarketDataResponseSchemaType> {
  const response = await fetch(
    `${API_URL}/market/products/${sku}?sales_lookback_days=${salesLookbackDays}`
  );
  return response.json();
}

export function getMarketDepthQuery({
  sku,
  salesLookbackDays,
}: {
  sku: string;
  salesLookbackDays: number;
}) {
  return queryOptions<
    MarketDataResponseSchemaType,
    Error,
    ReturnType<typeof parseMarketData>
  >({
    queryKey: ["marketDepth", sku],
    queryFn: () => fetchMarketData(sku, salesLookbackDays),
    select: parseMarketData,
  });
}
