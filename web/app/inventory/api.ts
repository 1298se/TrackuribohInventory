import { z } from "zod";
import useSWR from "swr";
import { InventoryResponse, InventoryResponseSchema, ProductSearchResponse, ProductSearchResponseSchema, CatalogsResponse, CatalogsResponseSchema } from "./schemas";
import { API_URL, fetcher, HTTPMethod, createMutation } from "../api/fetcher";

export function useInventory(query: string | null = null, catalog_id: string | null = null) {
  // Prepare parameters object
  const params: { [key: string]: string } = {};
  if (query) {
    params.query = query;
  }
  if (catalog_id) {
    params.catalog_id = catalog_id;
  }

  return useSWR(
    ['/inventory', params],
    ([path, params]) => fetcher({ 
      url: `${API_URL}${path}`, 
      params,
      method: HTTPMethod.GET,
      schema: InventoryResponseSchema 
    })
  );
}

export function useSearchProducts(query: string, catalog: string | null = null, productType: string | null = null) {
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

  return useSWR(
    ['/catalog/search', params],
    ([path, params]) => fetcher({ 
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      schema: ProductSearchResponseSchema 
    })
  );
}

export function useCatalogs() {
  return useSWR(
    '/catalog/catalogs',
    (path) => fetcher({ 
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema 
    })
  );
}

export function useInventoryCatalogs() {
  return useSWR(
    '/inventory/catalogs',
    (path) => fetcher({ 
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: CatalogsResponseSchema 
    })
  );
}

