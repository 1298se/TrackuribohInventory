import { fetcher, HTTPMethod, API_URL } from "../api/fetcher";
import useSWR from "swr";
import { z } from "zod";
import {
  SKUMarketData,
  SKUMarketDataSchema,
  ProductSearchResponse,
  ProductSearchResponseSchema,
  ProductWithSetAndSKUsResponseSchema,
  ProductMarketSchema,
  ProductMarketData,
  SKUMarketDataItem,
  ProductMarketSchema as SKUMarketDataItemsSchema,
} from "./schemas";
import { UUID } from "crypto";

// Define the type inferred from the schema
type ProductDetailType = z.infer<typeof ProductWithSetAndSKUsResponseSchema>;

// Infer the ProductMarketData type from the schema
type ProductMarketDataType = z.infer<typeof ProductMarketSchema>;

/**
 * Hook to fetch market depth and stubbed summary for a specific SKU.
 * Returns market data for a single SKU across available marketplaces.
 */
export function useSkuMarketData(
  skuId: string | null,
  // days: number = 30, // Params removed if not used by backend
  // resolution: "daily" | "weekly" = "daily",
) {
  // Key for SWR: [path, params]
  const key: string | null = skuId ? `/catalog/sku/${skuId}/market-data` : null;

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
        // params: query, // Removed if backend doesn't use them
        method: HTTPMethod.GET,
        schema: SKUMarketDataItemsSchema, // Expect list of market data items
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
 * Fetches market data for all Near Mint SKUs of a specific product.
 * @param productId - The ID of the product to fetch market data for.
 * @returns SWR response with product market data, error, and loading state.
 */
export function useProductMarketData(productId: UUID | undefined) {
  // Key for SWR: path string or null if productId is undefined
  const key: string | null = productId
    ? `/catalog/product/${productId}/market-data` // Updated endpoint path
    : null;

  const { data, error, isValidating } = useSWR<
    ProductMarketDataType, // Use the inferred type
    Error,
    string | null // Explicitly type the key for useSWR
  >(key, (path) => {
    if (!path) throw new Error("Product ID is required for market data");
    return fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: ProductMarketSchema, // Validate response against this schema
    });
  });

  return {
    data, // Structure: { market_data_items: [...] }
    error,
    isLoading: isValidating,
  };
}
