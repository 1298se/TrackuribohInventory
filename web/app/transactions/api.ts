import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { API_URL, fetcher } from "../api/fetcher";
import { 
    TransactionCreateRequest, 
    TransactionProRataRequest, 
    TransactionProRataResponse, 
    TransactionProRataResponseSchema, 
    TransactionResponse, 
    TransactionsResponse,
    BulkTransactionDeleteRequestSchema
} from "./schemas";

async function createTransaction(_url: string, { arg }: { arg: TransactionCreateRequest }) {
    await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(arg)
    });
}

export function useCreateTransaction() {
    return useSWRMutation(`${API_URL}/transactions`, createTransaction)
}

export async function calculateProRata(request: TransactionProRataRequest): Promise<TransactionProRataResponse> {
    const response = await fetch(`${API_URL}/transactions/pro-rata/calculate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return TransactionProRataResponseSchema.parse(data);
}

export function useCalculateProRata() {
    return useSWRMutation(
        `${API_URL}/transactions/pro-rata/calculate`,
        async (_url: string, { arg }: { arg: TransactionProRataRequest }) => {
            return calculateProRata(arg);
        }
    );
}

export function useTransactions() {
    const { data, error, isLoading, mutate } = useSWR<TransactionsResponse>(
        `${API_URL}/transactions`,
        (url: string) => fetcher({
            url
        })
    );

    return {
        data,
        isLoading,
        error,
        mutate
    };
}

export function useTransaction(id: string) {
    return useSWR<TransactionResponse>(
        `${API_URL}/transactions/${id}`,
        (url: string) => fetcher({
            url
        })
    )
}

async function deleteTransactions(transactionIds: string[]) {
    const payload = BulkTransactionDeleteRequestSchema.parse({ transaction_ids: transactionIds });

    await fetch(`${API_URL}/transactions/bulk`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function useDeleteTransactions() {
    return useSWRMutation(
        `${API_URL}/transactions/bulk`,
        async (_url: string, { arg }: { arg: string[] }) => {
            return deleteTransactions(arg);
        }
    );
}
