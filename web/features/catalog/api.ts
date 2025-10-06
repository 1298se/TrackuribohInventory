import { API_URL } from "@/app/api/fetcher";
import {
  ProductWithSetAndSKUsResponse,
  SetsResponse,
  SetPriceSummaryResponse,
  HistoricalPriceComparisonResponse,
} from "./types";
import { POKEMON_CATALOG_ID } from "@/shared/constants";
import { queryOptions } from "@tanstack/react-query";

async function fetchProduct(
  sku: string
): Promise<ProductWithSetAndSKUsResponse | null> {
  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  return response.json();
}

export function getProductQuery(sku: string) {
  return queryOptions<ProductWithSetAndSKUsResponse | null>({
    queryKey: ["product", sku],
    queryFn: () => fetchProduct(sku),
  });
}

async function fetchSearch({
  query,
  productType,
  setId,
}: {
  query: string;
  productType?: string;
  setId?: string;
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

  const response = await fetch(
    `${API_URL}/catalog/search?${params.toString()}`
  );
  const data = await response.json();
  return data;
}

interface SearchResult {
  results: ProductWithSetAndSKUsResponse[];
  total: number;
  page: number;
  has_next: boolean;
  has_prev: boolean;
}

export function getProductSearchQuery({
  query,
  productType,
  setId,
}: {
  query: string;
  productType?: string;
  setId?: string;
}) {
  return queryOptions<SearchResult>({
    queryKey: ["search", query, productType, setId],
    queryFn: () => fetchSearch({ query, productType, setId }),
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
  setId: string
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
  daysAgo: number = 30
): Promise<HistoricalPriceComparisonResponse> {
  const response = await fetch(
    `${API_URL}/market/set/${setId}/price-comparison?days_ago=${daysAgo}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch set price comparison");
  }
  return response.json();
}

export function getSetPriceComparisonQuery(
  setId: string,
  daysAgo: number = 30
) {
  return queryOptions<HistoricalPriceComparisonResponse>({
    queryKey: ["set-price-comparison", setId, daysAgo],
    queryFn: () => fetchSetPriceComparison(setId, daysAgo),
  });
}
