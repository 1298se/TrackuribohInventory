import { z } from "zod";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { InventoryResponse, ProductSearchResponse, CatalogsResponse } from "./schemas";
import { API_URL, fetcher } from "../api/fetcher";

export function useInventory(query: string | null = null) {
  // Construct the base URL
  const url = `${API_URL}/inventory`;
  
  // Prepare parameters object
  const params: { [key: string]: string } = {};
  if (query) {
    params.query = query;
  }

  return useSWR<InventoryResponse>(
    // Pass the URL and params object to SWR key
    // SWR will automatically handle query string formatting
    {
      url,
      params,
    },
    // The fetcher remains the same, it expects an object with url and optional params
    fetcher
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

  return useSWR<ProductSearchResponse>(
    {
      url: `${API_URL}/catalog/search`,
      params,
    },
    fetcher
  )
}

export function useCatalogs() {
  return useSWR<CatalogsResponse>(
    {
      url: `${API_URL}/catalog/catalogs`
    },
    fetcher
  )
}

