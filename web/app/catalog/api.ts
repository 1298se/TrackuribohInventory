import { fetcher, HTTPMethod, API_URL } from "../api/fetcher";
import useSWR from "swr";
import { z } from "zod";
import {
  ProductSearchResponse,
  ProductSearchResponseSchema,
  ProductWithSetAndSKUsResponseSchema,
  SKUMarketDataItem,
  MarketDataResponseSchema,
  MarketDataResponse,
} from "./schemas";
import { UUID } from "crypto";

// Define the type inferred from the schema
type ProductDetailType = z.infer<typeof ProductWithSetAndSKUsResponseSchema>;

/**
 * Hook to fetch market depth and stubbed summary for a specific SKU.
 * Returns market data for a single SKU across available marketplaces.
 */
export function useSkuMarketData(
  skuId: string | null,
  salesLookbackDays: number = 30,
) {
  // Key for SWR: [path, params]
  const key: string | null = skuId
    ? `/catalog/sku/${skuId}/market-data?sales_lookback_days=${salesLookbackDays}`
    : null;

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<{ market_data_items: SKUMarketDataItem[] }, Error, string | null>(
    key,
    (path) => {
      if (!path) throw new Error("SKU ID required");
      return fetcher({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        schema: MarketDataResponseSchema,
      });
    },
  );

  return {
    data: data?.market_data_items || [],
    error,
    isLoading,
  };
}

/**
 * Hook to fetch searchable product list using free-text query and optional catalog filter.
 */
export function useProductSearch(
  query: string,
  catalogId: string | null = null,
) {
  // Prepare query params (always include `query`, even if empty)
  const params: Record<string, string> = { query };
  if (catalogId) {
    params.catalog_id = catalogId;
  }

  // SWR key includes path and params
  const key: [string, Record<string, string>] = ["/catalog/search", params];

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<ProductSearchResponse, Error, [string, Record<string, string>]>(
    key,
    (keyTuple) => {
      const [path, params] = keyTuple;
      return fetcher({
        url: `${API_URL}${path}`,
        params,
        method: HTTPMethod.GET,
        schema: ProductSearchResponseSchema,
      });
    },
  );

  return { data, error, isLoading };
}

/**
 * Fetches detailed information for a specific product.
 * @param productId - The ID of the product to fetch.
 * @returns SWR response with product data, error, and loading state.
 */
export function useProductDetail(productId: UUID | undefined) {
  // Key for SWR: path string or null if productId is undefined
  const key: string | null = productId ? `/catalog/product/${productId}` : null;

  const { data, error, isValidating } = useSWR<
    ProductDetailType,
    Error,
    string | null
  >(key, (path) => {
    if (!path) throw new Error("Product ID is required");
    return fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: ProductWithSetAndSKUsResponseSchema,
    });
  });

  return {
    product: data,
    error,
    isLoading: isValidating,
  };
}

/**
 * Hook to fetch market data for all Near Mint SKUs of a specific product.
 * Returns an array of SKUMarketDataItem (no wrapper).
 * @param productId - The ID of the product to fetch market data for.
 */
export function useProductMarketData(
  productId: UUID | undefined,
  salesLookbackDays: number = 30,
) {
  // Key for SWR: path string or null if productId is undefined
  const key: string | null = productId
    ? `/catalog/product/${productId}/market-data?sales_lookback_days=${salesLookbackDays}` // Updated endpoint with sales_lookback_days
    : null;

  const { data, error, isValidating } = useSWR<
    MarketDataResponse,
    Error,
    string | null
  >(key, (path) => {
    if (!path) throw new Error("Product ID is required for market data");
    return fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: MarketDataResponseSchema,
    });
  });

  return {
    data: data?.market_data_items || [],
    error,
    isLoading: isValidating,
  };
}
