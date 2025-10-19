import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { API_URL } from "@/shared/fetcher";
import { useAuthenticatedRequest } from "@/features/auth/useAuthenticatedRequest";
import {
  InventoryResponse,
  InventoryItemDetailResponse,
  InventorySKUTransactionsResponse,
  InventoryMetricsResponse,
  InventoryHistoryItem,
  InventoryPriceHistoryResponse,
  InventorySkuMarketplacesResponse,
  InventoryItemUpdateRequest,
  InventoryItemCreateRequest,
} from "./types";
import { CatalogsResponse } from "../catalog/types";

// Hooks that return query options
export function useGetInventoryQuery(
  query: string | null = null,
  catalogId: string | null = null
) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory", query, catalogId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (catalogId) params.set("catalog_id", catalogId);

      const queryString = params.toString();
      const url = `${API_URL}/inventory${queryString ? `?${queryString}` : ""}`;

      const response = await authenticatedFetch(url);
      return response.json() as Promise<InventoryResponse>;
    },
  });
}

export function useGetInventoryItemQuery(inventoryItemId: string) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-item", inventoryItemId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/${inventoryItemId}`
      );
      return response.json() as Promise<InventoryItemDetailResponse>;
    },
    enabled: !!inventoryItemId,
  });
}

export function useGetInventoryTransactionsQuery(skuId: string | null) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-transactions", skuId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/${skuId}/transactions`
      );
      return response.json() as Promise<InventorySKUTransactionsResponse>;
    },
    enabled: !!skuId,
  });
}

export function useGetInventoryMetricsQuery(catalogId: string | null = null) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-metrics", catalogId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (catalogId) params.set("catalog_id", catalogId);

      const queryString = params.toString();
      const url = `${API_URL}/inventory/metrics${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await authenticatedFetch(url);
      return response.json() as Promise<InventoryMetricsResponse>;
    },
  });
}

export function useGetInventoryPerformanceQuery(
  catalogId: string | null = null,
  days: number | null = 7
) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-performance", catalogId, days],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (days !== null) params.set("days", days.toString());
      if (catalogId) params.set("catalog_id", catalogId);

      const queryString = params.toString();
      const url = `${API_URL}/inventory/performance${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await authenticatedFetch(url);
      return response.json() as Promise<InventoryHistoryItem[]>;
    },
  });
}

export function useGetInventoryPriceHistoryQuery(
  skuId: string | null,
  days: number = 30,
  marketplace: string | null = null
) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-price-history", skuId, days, marketplace],
    queryFn: async () => {
      const params = new URLSearchParams({ days: days.toString() });
      if (marketplace) params.set("marketplace", marketplace);

      const response = await authenticatedFetch(
        `${API_URL}/inventory/${skuId}/price-history?${params.toString()}`
      );
      return response.json() as Promise<InventoryPriceHistoryResponse>;
    },
    enabled: !!skuId,
  });
}

export function useGetSkuMarketplacesQuery(skuId: string | null) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["sku-marketplaces", skuId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/${skuId}/marketplaces`
      );
      return response.json() as Promise<InventorySkuMarketplacesResponse>;
    },
    enabled: !!skuId,
  });
}

export function useGetInventoryCatalogsQuery() {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["inventory-catalogs"],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/catalogs`
      );
      return response.json() as Promise<CatalogsResponse>;
    },
  });
}

// Create inventory item mutation
export function useCreateInventoryItem() {
  const { authenticatedFetch } = useAuthenticatedRequest();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InventoryItemCreateRequest) => {
      const response = await authenticatedFetch(`${API_URL}/inventory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return response.json() as Promise<InventoryItemDetailResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-metrics"] });
    },
  });
}

// Update inventory item mutation
export function useUpdateInventoryItem() {
  const { authenticatedFetch } = useAuthenticatedRequest();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: InventoryItemUpdateRequest;
    }) => {
      const response = await authenticatedFetch(`${API_URL}/inventory/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return response.json() as Promise<InventoryItemDetailResponse>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["inventory-item", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-metrics"] });
    },
  });
}
