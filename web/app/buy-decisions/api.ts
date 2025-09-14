import useSWR from "swr";
import { API_URL, fetcher, HTTPMethod } from "../api/fetcher";
import {
  BuyDecisionsResponseSchema,
  type BuyDecisionsResponse,
} from "./schemas";

export function useBuyDecisions() {
  return useSWR(
    "/buy-decisions",
    (path) =>
      fetcher({
        url: `${API_URL}${path}`,
        method: HTTPMethod.GET,
        schema: BuyDecisionsResponseSchema,
      }),
    {
      refreshInterval: 60000, // Refresh every minute
    },
  );
}
