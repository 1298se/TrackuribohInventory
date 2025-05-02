import { fetcher, HTTPMethod, API_URL } from "../api/fetcher";
import useSWR from "swr";
import {
  SKUMarketData,
  SKUMarketDataSchema,
  ProductSearchResponse,
  ProductSearchResponseSchema,
} from "./schemas";

/**
 * Hook to fetch market depth and stubbed summary for a specific SKU.
 */
export function useSkuMarketData(
  skuId: string | null,
  days: number = 30,
  resolution: "daily" | "weekly" = "daily",
) {
  // Prepare query params
  const params: Record<string, string> = { days: days.toString(), resolution };

  // Key for SWR: [path, params]
  const key: [string, Record<string, string>] | null = skuId
    ? [`/catalog/sku/${skuId}/market-data`, params]
    : null;

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<SKUMarketData, Error, [string, Record<string, string>]>(
    key as [string, Record<string, string>],
    (keyTuple) => {
      const [path, query] = keyTuple;
      return fetcher({
        url: `${API_URL}${path}`,
        params: query,
        method: HTTPMethod.GET,
        schema: SKUMarketDataSchema,
      });
    },
  );

  return { data, error, isLoading };
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
