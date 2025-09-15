import { API_URL } from "@/app/api/fetcher";
import {
  MarketDataResponseSchemaType,
  ProductBaseResponseSchemaType,
  ProductWithSetAndSKUsResponse,
} from "@/app/catalog/schemas";

export interface SearchProduct {
  id: string;
  name: string;
  number?: string;
  image_url: string;
  set: {
    name: string;
    code: string;
  };
}

export interface SearchResult {
  results: ProductBaseResponseSchemaType[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

export async function fetchProduct(
  sku: string
): Promise<ProductWithSetAndSKUsResponse> {
  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  return response.json();
}

export async function fetchMarketData(
  sku: string,
  salesLookbackDays: number = 7
): Promise<MarketDataResponseSchemaType> {
  const response = await fetch(
    `${API_URL}/catalog/product/${sku}/market-data?sales_lookback_days=${salesLookbackDays}`
  );
  return response.json();
}

export async function searchProducts(
  query: string,
  catalogId: string,
  productType: string = "CARDS",
  limit: number = 10
): Promise<ProductBaseResponseSchemaType> {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("catalog_id", catalogId);
  params.set("product_type", productType);
  params.set("limit", limit.toString());

  const response = await fetch(
    `${API_URL}/catalog/search?${params.toString()}`
  );
  return await response.json();
}
