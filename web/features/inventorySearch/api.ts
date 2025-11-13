import { queryOptions } from "@tanstack/react-query";
import { API_URL } from "@/shared/fetcher";
import { useAuthenticatedRequest } from "@/features/auth/useAuthenticatedRequest";
import {
  ProductSearchResponse,
  ProductWithSetAndSKUsResponse,
  CatalogsResponse,
} from "./types";
import { SKUMarketDataItem } from "@/features/market/types";

// Hooks that return query options
export function useGetProductSearchQuery(
  query: string,
  catalogId: string | null = null,
  page: number = 1,
  limit: number = 20,
) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["product-search", query, catalogId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        query,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (catalogId) {
        params.set("catalog_id", catalogId);
      }

      const response = await authenticatedFetch(
        `${API_URL}/catalog/search?${params.toString()}`,
      );
      return response.json() as Promise<ProductSearchResponse>;
    },
  });
}

export function useGetProductDetailQuery(productId: string | undefined) {
  const { authenticatedFetch } = useAuthenticatedRequest();

  return queryOptions({
    queryKey: ["product-detail", productId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_URL}/catalog/product/${productId}`,
      );
      return response.json() as Promise<ProductWithSetAndSKUsResponse>;
    },
    enabled: !!productId,
  });
}

// Catalogs query (non-authenticated, no hook wrapper needed)
export function getCatalogsQuery() {
  return queryOptions<CatalogsResponse>({
    queryKey: ["catalogs"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/catalog/catalogs`);
      return response.json();
    },
  });
}
