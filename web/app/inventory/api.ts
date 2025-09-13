import { z } from "zod";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import {
  InventoryItemDetailResponseSchema,
  InventoryItemDetailResponse,
  InventoryItemUpdateRequest,
  InventoryResponseSchema,
  InventorySKUTransactionsResponse,
  InventorySKUTransactionsResponseSchema,
  InventoryMetricsResponse,
  InventoryMetricsResponseSchema,
  InventoryHistoryItemSchema,
  InventoryHistoryItem,
  InventoryPriceHistoryResponse,
  InventoryPriceHistoryResponseSchema,
  InventorySkuMarketplacesResponse,
  InventorySkuMarketplacesResponseSchema,
} from "./schemas";
import {
  ProductSearchResponseSchema,
  CatalogsResponseSchema,
} from "../catalog/schemas";
import { API_URL, fetcher, HTTPMethod } from "../api/fetcher";

export function useInventory(
  query: string | null = null,
  catalog_id: string | null = null,
  token: string
) {
  // Prepare parameters object
  const params: { [key: string]: string } = {};
  if (query) {
    params.query = query;
  }
  if (catalog_id) {
    params.catalog_id = catalog_id;
  }

  return useSWR(["/inventory", params], ([path, params]) =>
    fetcher({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      schema: InventoryResponseSchema,
      token,
    })
  );
}

export function useSearchProducts(
  query: string,
  catalog: string | null = null,
  productType: string | null = null,
  token: string
) {
  // Construct parameters for the API call
  const params: { [key: string]: string } = { query };

  // Include the catalog_id parameter if it's provided.
  if (catalog) {
    params.catalog_id = catalog;
  }

  // Include the product_type parameter if it's provided.
  if (productType) {
    params.product_type = productType;
  }

  return useSWR(["/catalog/search", params], ([path, params]) =>
    fetcher({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      schema: ProductSearchResponseSchema,
      token,
    })
  );
}

export function useCatalogs(token: string) {
  return useSWR("/catalog/catalogs", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema,
      token,
    })
  );
}

export function useInventoryCatalogs(token: string) {
  return useSWR("/inventory/catalogs", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema,
      token,
    })
  );
}

export function useInventoryItem(inventoryItemId: string, token: string) {
  return useSWR(
    inventoryItemId ? `/inventory/${inventoryItemId}` : null,
    (path) =>
      fetcher({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        schema: InventoryItemDetailResponseSchema,
        token,
      })
  );
}

export function useUpdateInventoryItem(token: string) {
  return useSWRMutation<
    InventoryItemDetailResponse,
    Error,
    string,
    { id: string; data: InventoryItemUpdateRequest }
  >(
    `${API_URL}/inventory`,
    async (
      _url: string,
      { arg }: { arg: { id: string; data: InventoryItemUpdateRequest } }
    ) => {
      return fetcher({
        url: `${API_URL}/inventory/${arg.id}`,
        method: HTTPMethod.PATCH,
        body: arg.data,
        schema: InventoryItemDetailResponseSchema,
        token,
      });
    }
  );
}

// Hook to fetch transaction history for a specific SKU
export function useInventoryItemTransactions(
  skuId: string | null,
  token: string
) {
  const key = skuId ? `/inventory/${skuId}/transactions` : null;

  return useSWR<InventorySKUTransactionsResponse>(key, (path: string) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: InventorySKUTransactionsResponseSchema, // Ensure validation against the correct schema
      token,
    })
  );
}

export function useInventoryMetrics(
  catalog_id: string | null = null,
  token: string
) {
  const params: { [key: string]: string } = {};
  if (catalog_id) {
    params.catalog_id = catalog_id;
  }

  return useSWR<InventoryMetricsResponse>(
    ["/inventory/metrics", params],
    (args: [string, Record<string, string>]) => {
      const [path, queryParams] = args;
      return fetcher({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
        schema: InventoryMetricsResponseSchema,
        token,
      });
    }
  );
}

export function useInventoryPerformance(
  catalog_id: string | null = null,
  days: number | null = 7,
  token: string
) {
  const params: { [key: string]: string } = {};

  // Only include days parameter if it's not null (null means "All time")
  if (days !== null) {
    params.days = days.toString();
  }

  if (catalog_id) {
    params.catalog_id = catalog_id;
  }

  return useSWR<InventoryHistoryItem[]>(
    ["/inventory/performance", params],
    (args: [string, Record<string, string>]) => {
      const [path, queryParams] = args;
      return fetcher({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
        schema: z.array(InventoryHistoryItemSchema),
        token,
      });
    }
  );
}

export function useInventoryPriceHistory(
  skuId: string | null,
  days: number = 30,
  marketplace: string | null = null,
  token: string
) {
  const params: { [key: string]: string } = { days: days.toString() };
  if (marketplace) {
    params.marketplace = marketplace;
  }

  return useSWR<InventoryPriceHistoryResponse>(
    skuId ? [`/inventory/${skuId}/price-history`, params] : null,
    (args: [string, Record<string, string>]) => {
      const [path, queryParams] = args;
      return fetcher({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
        schema: InventoryPriceHistoryResponseSchema,
        token,
      });
    }
  );
}

export function useSkuMarketplaces(skuId: string | null, token: string) {
  return useSWR<InventorySkuMarketplacesResponse>(
    skuId ? `/inventory/${skuId}/marketplaces` : null,
    (path: string) =>
      fetcher({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        schema: InventorySkuMarketplacesResponseSchema,
        token,
      })
  );
}
