import { API_URL } from "@/app/api/fetcher";
import { ProductWithSetAndSKUsResponse, SetsResponse } from "./schemas";
import { POKEMON_CATALOG_ID } from "@/shared/constants";
import { queryOptions } from "@tanstack/react-query";

async function fetchProduct(
  sku: string
): Promise<ProductWithSetAndSKUsResponse> {
  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  return response.json();
}

export function getProductQuery(sku: string) {
  return queryOptions<ProductWithSetAndSKUsResponse>({
    queryKey: ["product", sku],
    queryFn: () => fetchProduct(sku),
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
  limit: number;
}) {
  const params = new URLSearchParams();

  params.set("query", query);
  params.set("catalog_id", POKEMON_CATALOG_ID);
  params.set("limit", limit.toString());

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
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

const DEFAULT_LIMIT = 15;

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
    queryFn: () =>
      fetchSearch({ query, productType, setId, limit: DEFAULT_LIMIT }),
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
