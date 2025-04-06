import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { API_URL, fetcher } from "../api/fetcher";
import { 
    TransactionCreateRequest, 
    TransactionResponse, 
    TransactionsResponse,
    BulkTransactionDeleteRequestSchema,
    TransactionUpdateRequest,
    PlatformResponse,
    PlatformCreateRequest
} from "./schemas";

async function createTransaction(_url: string, { arg }: { arg: TransactionCreateRequest }) {
    const response = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(arg)
    });
    
    if (!response.ok) {
        throw new Error('Failed to create transaction');
    }
    
    return response.json();
}

export function useCreateTransaction() {
    return useSWRMutation(`${API_URL}/transactions`, createTransaction)
}

export function useTransactions(query?: string) {
    // Construct the URL with query parameter if provided
    const url = query 
        ? `${API_URL}/transactions?query=${encodeURIComponent(query)}` 
        : `${API_URL}/transactions`;
    
    const { data, error, isLoading, mutate } = useSWR<TransactionsResponse>(
        url,
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

export function usePlatforms() {
    return useSWR<PlatformResponse[]>(
        `${API_URL}/transactions/platforms`,
        (url: string) => fetcher({
            url
        })
    )
}

async function createPlatform(_url: string, { arg }: { arg: PlatformCreateRequest }) {
    const response = await fetch(`${API_URL}/transactions/platforms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(arg)
    });
    
    if (!response.ok) {
        throw new Error('Failed to create platform');
    }
    
    return response.json();
}

export function useCreatePlatform() {
    return useSWRMutation(`${API_URL}/transactions/platforms`, createPlatform);
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

async function updateTransaction(arg: { id: string; data: TransactionUpdateRequest }) {
    const response = await fetch(`${API_URL}/transactions/${arg.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(arg.data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to update transaction');
    }
    
    return response.json();
}

export function useUpdateTransaction() {
    return useSWRMutation(`${API_URL}/transactions`, async (_url: string, { arg }: { arg: { id: string; data: TransactionUpdateRequest } }) => {
        return updateTransaction(arg);
    });
}
