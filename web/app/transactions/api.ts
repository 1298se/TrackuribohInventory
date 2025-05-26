import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { API_URL, fetcher, HTTPMethod, createMutation } from "../api/fetcher";
import {
  TransactionCreateRequest,
  TransactionResponse,
  TransactionResponseSchema,
  TransactionsResponse,
  TransactionsResponseSchema,
  BulkTransactionDeleteRequestSchema,
  TransactionUpdateRequest,
  PlatformResponse,
  PlatformResponseSchema,
  PlatformCreateRequest,
  WeightedPriceCalculationRequest,
  WeightedPriceCalculationResponse,
  WeightedPriceCalculationResponseSchema,
  TransactionMetricsResponse,
  TransactionMetricsResponseSchema,
  TransactionFilter,
  TransactionFilterOptionsResponse,
  TransactionFilterOptionsResponseSchema,
} from "./schemas";
import { z } from "zod";
import { ProductSearchResponse } from "../catalog/schemas";
import { MoneyAmountSchema } from "../schemas";

// Create reusable mutation functions using our helper
const createTransaction = createMutation<
  TransactionCreateRequest,
  typeof TransactionResponseSchema
>("/transactions", HTTPMethod.POST, TransactionResponseSchema);

const updateTransaction = createMutation<
  TransactionUpdateRequest,
  typeof TransactionResponseSchema
>("/transactions", HTTPMethod.PATCH, TransactionResponseSchema);

const createPlatform = createMutation<
  PlatformCreateRequest,
  typeof PlatformResponseSchema
>("/transactions/platforms", HTTPMethod.POST, PlatformResponseSchema);

const calculateWeightedPrices = createMutation<
  WeightedPriceCalculationRequest,
  typeof WeightedPriceCalculationResponseSchema
>(
  "/transactions/calculate-weighted-line-item-prices",
  HTTPMethod.POST,
  WeightedPriceCalculationResponseSchema,
);

// For DELETE, we create a specialized mutation function
const deleteTransactionsRequest = async (
  _: string,
  { arg }: { arg: string[] },
) => {
  const payload = BulkTransactionDeleteRequestSchema.parse({
    transaction_ids: arg,
  });

  return fetcher({
    url: `${API_URL}/transactions/bulk`,
    method: HTTPMethod.POST,
    body: payload,
    schema: z.void(),
  });
};

// For GET requests, we use the standard fetcher
export function useTransactions(filters?: TransactionFilter) {
  // Build query parameters - no mapping needed, names match the API
  const params: Record<string, string | string[]> = {};

  if (filters?.q) params.q = filters.q;
  if (filters?.date_start) params.date_start = filters.date_start;
  if (filters?.date_end) params.date_end = filters.date_end;
  if (filters?.types?.length) params.types = filters.types;
  if (filters?.platform_ids?.length) params.platform_ids = filters.platform_ids;
  if (filters?.include_no_platform) params.include_no_platform = "true";
  if (filters?.amount_min !== undefined)
    params.amount_min = filters.amount_min.toString();
  if (filters?.amount_max !== undefined)
    params.amount_max = filters.amount_max.toString();

  return useSWR(["/transactions", params], ([path, params]) =>
    fetcher({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      schema: TransactionsResponseSchema,
    }),
  );
}

export function useTransaction(id: string) {
  return useSWR(["/transactions", id], ([path, id]) =>
    fetcher({
      url: `${API_URL}${path}/${id}`,
      method: HTTPMethod.GET,
      schema: TransactionResponseSchema,
    }),
  );
}

export function usePlatforms() {
  const PlatformArraySchema = z.array(PlatformResponseSchema);

  return useSWR("/transactions/platforms", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: PlatformArraySchema,
    }),
  );
}

// Export hooks using our mutation functions
export function useCreateTransaction() {
  return useSWRMutation<
    TransactionResponse,
    Error,
    string,
    TransactionCreateRequest
  >(`${API_URL}/transactions`, createTransaction);
}

export function useUpdateTransaction() {
  // Note: we need to add handling for path parameter in the trigger
  return useSWRMutation<
    TransactionResponse,
    Error,
    string,
    { id: string; data: TransactionUpdateRequest }
  >(
    `${API_URL}/transactions`,
    async (
      _url: string,
      { arg }: { arg: { id: string; data: TransactionUpdateRequest } },
    ) => {
      return fetcher({
        url: `${API_URL}/transactions/${arg.id}`,
        method: HTTPMethod.PATCH,
        body: arg.data,
        schema: TransactionResponseSchema,
      });
    },
  );
}

export function useDeleteTransactions() {
  return useSWRMutation<void, Error, string, string[]>(
    `${API_URL}/transactions/bulk`,
    deleteTransactionsRequest,
  );
}

export function useCreatePlatform() {
  return useSWRMutation<PlatformResponse, Error, string, PlatformCreateRequest>(
    `${API_URL}/transactions/platforms`,
    createPlatform,
  );
}

export function useCalculateWeightedPrices() {
  return useSWRMutation<
    WeightedPriceCalculationResponse,
    Error,
    string,
    WeightedPriceCalculationRequest
  >(
    `${API_URL}/transactions/calculate-weighted-line-item-prices`,
    calculateWeightedPrices,
  );
}

export function useTransactionMetrics() {
  return useSWR("/transactions/metrics", (path) =>
    fetcher({
      url: `${API_URL}${path}`,
      method: HTTPMethod.GET,
      schema: TransactionMetricsResponseSchema,
    }),
  );
}

export function useTransactionFilterOptions(catalogId?: string) {
  const params: { [key: string]: string } = {};
  if (catalogId) {
    params.catalog_id = catalogId;
  }

  return useSWR(["/transactions/filter-options", params], ([path, params]) =>
    fetcher({
      url: `${API_URL}${path}`,
      params,
      method: HTTPMethod.GET,
      schema: TransactionFilterOptionsResponseSchema,
    }),
  );
}
