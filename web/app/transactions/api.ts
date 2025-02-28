import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { API_URL, fetcher } from "../api/fetcher";
import { 
    TransactionCreateRequest, 
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
