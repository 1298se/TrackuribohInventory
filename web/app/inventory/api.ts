import { z } from "zod";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { InventoryResponse, InventoryResponseSchema, ProductSearchResponse, ProductSearchResponseSchema, CatalogsResponse, CatalogsResponseSchema } from "./schemas";
import { API_URL, fetcher } from "../api/fetcher";

export function useInventory(query: string | null = null) {
  // Prepare parameters object
  const params: { [key: string]: string } = {};
  if (query) {
    params.query = query;
  }

  const key = {
    url: `${API_URL}/inventory`,
    params,
  };

  return useSWR<InventoryResponse>(
    key,
    () => fetcher({ ...key, schema: InventoryResponseSchema })
  );
}

export function useSearchProducts(query: string, catalog: string | null = null, productType: string | null = null) {
  // Construct parameters for the API call using ProductSearchRequestParams.
  const params: { [key: string]: string } = { query }
  
  // Include the catalog_id parameter if it's provided.
  if (catalog) {
    params.catalog_id = catalog;
  }

  // Include the product_type parameter if it's provided.
  if (productType) {
    params.product_type = productType;
  }

  const key = {
    url: `${API_URL}/catalog/search`,
    params,
  };

  return useSWR<ProductSearchResponse>(
    key,
    // Pass an inline function that calls fetcher correctly
    () => fetcher({ ...key, schema: ProductSearchResponseSchema })
  )
}

export function useCatalogs() {
  const key = {
    url: `${API_URL}/catalog/catalogs`
  };

  return useSWR<CatalogsResponse>(
    key,
    () => fetcher({ ...key, schema: CatalogsResponseSchema })
  )
}

