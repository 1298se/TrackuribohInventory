import { API_URL } from "@/shared/fetcher";
import {
  ProductWithSetAndSKUsResponse,
  ProductMarketPricesResponse,
  SetsResponse,
  SetPriceSummaryResponse,
  HistoricalPriceComparisonResponse,
  ProductVariantResponse,
  ProductVariantPriceSummaryResponse,
  ProductVariantPriceHistoryResponse,
} from "./types";
import { POKEMON_CATALOG_ID } from "@/shared/constants";
import { queryOptions } from "@tanstack/react-query";

async function fetchProductVariant(
  productVariantId: string,
): Promise<ProductVariantResponse | null> {
  const response = await fetch(
    `${API_URL}/catalog/product-variant/${productVariantId}`,
  );
  return response.json();
}

export function getProductVariantQuery(productVariantId: string) {
  return queryOptions<ProductVariantResponse | null>({
    queryKey: ["product-variant", productVariantId],
    queryFn: () => fetchProductVariant(productVariantId),
  });
}

async function fetchProductVariantPriceSummary(
  productVariantId: string,
): Promise<ProductVariantPriceSummaryResponse> {
  const response = await fetch(
    `${API_URL}/market/product-variant/${productVariantId}/price-summary`,
  );
  return response.json();
}

export function getProductVariantPriceSummaryQuery(productVariantId: string) {
  return queryOptions<ProductVariantPriceSummaryResponse>({
    queryKey: ["product-variant-price-summary", productVariantId],
    queryFn: () => fetchProductVariantPriceSummary(productVariantId),
  });
}

async function fetchSearch({
  query,
  productType,
  setId,
  limit,
}: {
  query: string;
  productType?: string;
  setId?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();

  params.set("query", query);
  params.set("catalog_id", POKEMON_CATALOG_ID);

  if (productType) {
    params.set("product_type", productType);
  }

  if (setId) {
    params.set("set_id", setId);
  }

  if (limit !== undefined) {
    params.set("limit", limit.toString());
  }

  const response = await fetch(
    `${API_URL}/catalog/search?${params.toString()}`,
  );
  const data = await response.json();
  return data;
}

interface SearchResult {
  results: ProductVariantResponse[];
  total?: number;
  page?: number;
  has_next?: boolean;
  has_prev?: boolean;
}

export function getProductSearchQuery({
  query,
  productType,
  setId,
  limit,
}: {
  query: string;
  productType?: string;
  setId?: string;
  limit?: number;
}) {
  return queryOptions<SearchResult>({
    queryKey: ["search", query, productType, setId, limit],
    queryFn: () => fetchSearch({ query, productType, setId, limit }),
  });
}

async function fetchSets(): Promise<SetsResponse> {
  const response = await fetch(`${API_URL}/catalog/sets`);
  if (!response.ok) {
    throw new Error("Failed to fetch sets");
  }
  return response.json();
}

export function getSetsQuery() {
  return queryOptions<SetsResponse>({
    queryKey: ["sets"],
    queryFn: fetchSets,
  });
}

type ProductType = "CARDS" | "SEALED";

export interface ProductTypesResponse {
  product_types: ProductType[];
}

async function fetchProductTypes(): Promise<ProductTypesResponse> {
  const response = await fetch(`${API_URL}/catalog/product-types`);
  if (!response.ok) {
    throw new Error("Failed to fetch product types");
  }
  return response.json();
}

export function getProductTypesQuery() {
  return queryOptions<ProductTypesResponse>({
    queryKey: ["product-types"],
    queryFn: fetchProductTypes,
  });
}

async function fetchSetPriceSummary(
  setId: string,
): Promise<SetPriceSummaryResponse> {
  const response = await fetch(`${API_URL}/market/set/${setId}/price-summary`);
  if (!response.ok) {
    throw new Error("Failed to fetch set price summary");
  }
  return response.json();
}

export function getSetPriceSummaryQuery(setId: string) {
  return queryOptions<SetPriceSummaryResponse>({
    queryKey: ["set-price-summary", setId],
    queryFn: () => fetchSetPriceSummary(setId),
  });
}

async function fetchSetPriceComparison(
  setId: string,
  daysAgo: number = 30,
): Promise<HistoricalPriceComparisonResponse> {
  const response = await fetch(
    `${API_URL}/market/set/${setId}/price-comparison?days_ago=${daysAgo}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch set price comparison");
  }
  return response.json();
}

export function getSetPriceComparisonQuery(
  setId: string,
  daysAgo: number = 30,
) {
  return queryOptions<HistoricalPriceComparisonResponse>({
    queryKey: ["set-price-comparison", setId, daysAgo],
    queryFn: () => fetchSetPriceComparison(setId, daysAgo),
  });
}

async function fetchProductVariantPriceHistory(
  productVariantId: string,
  days: number = 30,
  marketplace?: string,
): Promise<ProductVariantPriceHistoryResponse> {
  const params = new URLSearchParams();
  params.set("days", days.toString());
  if (marketplace) {
    params.set("marketplace", marketplace);
  }

  const response = await fetch(
    `${API_URL}/market/product-variants/${productVariantId}/price-history?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch product variant price history");
  }
  return response.json();
}

export function getProductVariantPriceHistoryQuery(
  productVariantId: string | null,
  days: number = 30,
  marketplace?: string | null,
) {
  return queryOptions<ProductVariantPriceHistoryResponse>({
    queryKey: [
      "product-variant-price-history",
      productVariantId,
      days,
      marketplace,
    ],
    queryFn: () =>
      fetchProductVariantPriceHistory(
        productVariantId!,
        days,
        marketplace || undefined,
      ),
    enabled: !!productVariantId,
  });
}
