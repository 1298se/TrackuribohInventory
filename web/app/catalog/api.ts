import { fetcherWithoutSchema, HTTPMethod, API_URL } from "../api/fetcher";
import useSWR from "swr";
import {
  ProductSearchResponse,
  ProductWithSetAndSKUsResponse,
} from "../../features/catalog/types";
import {
  SKUMarketDataItem,
  MarketDataResponse,
} from "../../features/market/types";
import { UUID } from "crypto";

// Define the type for product details
type ProductDetailType = ProductWithSetAndSKUsResponse;

/**
 * Hook to fetch market depth and stubbed summary for a specific SKU.
 * Returns market data for a single SKU across available marketplaces.
 */
export function useSkuMarketData(
  skuId: string | null,
  salesLookbackDays: number = 30,
  token: string
) {
  // Key for SWR: [path, params]
  const key: string | null = skuId
    ? `/market/skus/${skuId}?sales_lookback_days=${salesLookbackDays}`
    : null;

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<{ market_data_items: SKUMarketDataItem[] }, Error, string | null>(
    key,
    (path) => {
      if (!path) throw new Error("SKU ID required");
      return fetcherWithoutSchema<{ market_data_items: SKUMarketDataItem[] }>({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        token,
      });
    }
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
  token: string,
  page: number = 1,
  limit: number = 20
) {
  // Prepare query params (always include `query`, even if empty)
  const params: Record<string, string> = {
    query,
    page: page.toString(),
    limit: limit.toString(),
  };
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
      return fetcherWithoutSchema<ProductSearchResponse>({
        url: `${API_URL}${path}`,
        params,
        method: HTTPMethod.GET,
        token,
      });
    }
  );

  return { data, error, isLoading };
}

/**
 * Fetches detailed information for a specific product.
 * @param productId - The ID of the product to fetch.
 * @returns SWR response with product data, error, and loading state.
 */
export function useProductDetail(productId: UUID | undefined, token: string) {
  // Key for SWR: path string or null if productId is undefined
  const key: string | null = productId ? `/catalog/product/${productId}` : null;

  const { data, error, isValidating } = useSWR<
    ProductDetailType,
    Error,
    string | null
  >(key, (path) => {
    if (!path) throw new Error("Product ID is required");
    return fetcherWithoutSchema<ProductWithSetAndSKUsResponse>({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      token,
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
  token: string
) {
  // Key for SWR: path string or null if productId is undefined
  const key: string | null = productId
    ? `/market/products/${productId}?sales_lookback_days=${salesLookbackDays}` // Updated endpoint with sales_lookback_days
    : null;

  const { data, error, isValidating } = useSWR<
    MarketDataResponse,
    Error,
    string | null
  >(key, (path) => {
    if (!path) throw new Error("Product ID is required for market data");
    return fetcherWithoutSchema<MarketDataResponse>({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      token,
    });
  });

  return {
    data: data?.market_data_items || [],
    error,
    isLoading: isValidating,
  };
}
