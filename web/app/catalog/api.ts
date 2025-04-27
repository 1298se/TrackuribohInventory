import { fetcher, HTTPMethod, API_URL } from "../api/fetcher";
import useSWR from "swr";
import { SKUMarketData, SKUMarketDataSchema } from "./schemas";

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
  const key = skuId ? [`/catalog/sku/${skuId}/market-data`, params] : null;

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<SKUMarketData>(key, ([path, query]) =>
    fetcher({
      url: `${API_URL}${path}`,
      params: query,
      method: HTTPMethod.GET,
      schema: SKUMarketDataSchema,
    }),
  );

  return { data, error, isLoading };
}
