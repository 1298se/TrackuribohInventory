import { z } from "zod";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import {
  InventoryItemDetailResponseSchema,
  InventoryItemDetailResponse,
  InventoryItemUpdateRequest,
  InventoryItemUpdateRequestSchema,
  InventoryResponse,
  InventoryResponseSchema,
  InventorySKUTransactionsResponse,
  InventorySKUTransactionsResponseSchema,
  InventoryMetricsResponse,
  InventoryMetricsResponseSchema,
} from "./schemas";
import {
  ProductSearchResponseSchema,
  CatalogsResponseSchema,
  CatalogsResponse,
} from "../catalog/schemas";
import { API_URL, fetcher, HTTPMethod, createMutation } from "../api/fetcher";

export function useInventory(
  query: string | null = null,
  catalog_id: string | null = null,
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
    }),
  );
}

export function useSearchProducts(
  query: string,
  catalog: string | null = null,
  productType: string | null = null,
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
    }),
  );
}

export function useCatalogs() {
  return useSWR("/catalog/catalogs", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema,
    }),
  );
}

export function useInventoryCatalogs() {
  return useSWR("/inventory/catalogs", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema,
    }),
  );
}

export function useInventoryItem(inventoryItemId: string) {
  return useSWR(
    inventoryItemId ? `/inventory/${inventoryItemId}` : null,
    (path) =>
      fetcher({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        schema: InventoryItemDetailResponseSchema,
      }),
  );
}

export function useUpdateInventoryItem() {
  return useSWRMutation<
    InventoryItemDetailResponse,
    Error,
    string,
    { id: string; data: InventoryItemUpdateRequest }
  >(
    `${API_URL}/inventory`,
    async (
      _url: string,
      { arg }: { arg: { id: string; data: InventoryItemUpdateRequest } },
    ) => {
      return fetcher({
        url: `${API_URL}/inventory/${arg.id}`,
        method: HTTPMethod.PATCH,
        body: arg.data,
        schema: InventoryItemDetailResponseSchema,
      });
    },
  );
}

// Hook to fetch transaction history for a specific SKU
export function useInventoryItemTransactions(skuId: string | null) {
  const key = skuId ? `/inventory/${skuId}/transactions` : null;

  return useSWR<InventorySKUTransactionsResponse>(key, (path: string) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: InventorySKUTransactionsResponseSchema, // Ensure validation against the correct schema
    }),
  );
}

export function useInventoryMetrics(catalog_id: string | null = null) {
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
      });
    },
  );
}
