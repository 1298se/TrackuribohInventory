import { z } from "zod";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { InventoryResponse, ProductSearchResponse } from "./schemas";
import { API_URL, fetcher } from "../api/fetcher";

export function useInventory() {
  return useSWR<InventoryResponse>(
    `${API_URL}/inventory`,
    (url: string) => fetcher({
      url
    })
  );
}



export function useSearchProducts(query: string) {
  return useSWR<ProductSearchResponse>(
    {
      url: `${API_URL}/catalog/search`, params: {
        "query": query,
      }
    },
    fetcher
  )
}

