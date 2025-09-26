import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import {
  InventoryItemDetailResponse,
  InventoryItemUpdateRequest,
  InventoryResponse,
  InventorySKUTransactionsResponse,
  InventoryMetricsResponse,
  InventoryHistoryItem,
  InventoryPriceHistoryResponse,
  InventorySkuMarketplacesResponse,
} from "../../features/market/types";
import {
  ProductSearchResponse,
  CatalogsResponse,
} from "../../features/catalog/types";
import { API_URL, fetcherWithoutSchema, HTTPMethod } from "../api/fetcher";

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
    fetcherWithoutSchema<InventoryResponse>({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
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
    fetcherWithoutSchema<ProductSearchResponse>({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      token,
    })
  );
}

export function useCatalogs(token: string) {
  return useSWR("/catalog/catalogs", (path) =>
    fetcherWithoutSchema<CatalogsResponse>({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      token,
    })
  );
}

export function useInventoryCatalogs(token: string) {
  return useSWR("/inventory/catalogs", (path) =>
    fetcherWithoutSchema<CatalogsResponse>({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      token,
    })
  );
}

export function useInventoryItem(inventoryItemId: string, token: string) {
  return useSWR(
    inventoryItemId ? `/inventory/${inventoryItemId}` : null,
    (path) =>
      fetcherWithoutSchema<InventoryItemDetailResponse>({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
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
      return fetcherWithoutSchema<InventoryItemDetailResponse>({
        url: `${API_URL}/inventory/${arg.id}`,
        method: HTTPMethod.PATCH,
        body: arg.data,
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
    fetcherWithoutSchema<InventorySKUTransactionsResponse>({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
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
      return fetcherWithoutSchema<InventoryMetricsResponse>({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
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
      return fetcherWithoutSchema<InventoryHistoryItem[]>({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
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
      return fetcherWithoutSchema<InventoryPriceHistoryResponse>({
        url: `${API_URL}${path}`,
        params: queryParams,
        method: HTTPMethod.GET,
        token,
      });
    }
  );
}

export function useSkuMarketplaces(skuId: string | null, token: string) {
  return useSWR<InventorySkuMarketplacesResponse>(
    skuId ? `/inventory/${skuId}/marketplaces` : null,
    (path: string) =>
      fetcherWithoutSchema<InventorySkuMarketplacesResponse>({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        token,
      })
  );
}
