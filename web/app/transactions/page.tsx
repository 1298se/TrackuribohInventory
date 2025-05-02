"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TransactionTable } from "./transaction-table";
import { useTransactions, useDeleteTransactions } from "./api";
import { SearchInput } from "@/components/search-input";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get the current query from URL or default
  const initialQuery = searchParams.get("q") || "";
  // Fetch transactions based on the current query
  const { data, isLoading, mutate } = useTransactions(initialQuery);
  // Hook to delete transactions
  const deleteMutation = useDeleteTransactions();

  // Handler to update URL when search is submitted
  const handleFilterSubmit = useCallback(
    (query: string) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (!query) {
        params.delete("q");
      } else {
        params.set("q", query);
      }
      const search = params.toString();
      const queryStr = search ? `?${search}` : "";
      router.replace(`${pathname}${queryStr}`);
    },
    [router, searchParams, pathname],
  );

  // Handler to delete selected transactions
  const handleDeleteSelected = async (ids: string[]) => {
    try {
      await deleteMutation.trigger(ids);
      mutate();
    } catch (error) {
      console.error(error);
    }
  };

  // Handler for row click navigation
  const handleRowClick = (id: string) => {
    router.push(`/transactions/${id}`);
  };

  return (
    <div className="container space-y-4">
      {/* Search filter UI lifted to page level */}
      <SearchInput
        placeholder="Search by counterparty or product name..."
        initialValue={initialQuery}
        onSubmit={handleFilterSubmit}
        className="w-full max-w-md"
      />
      <TransactionTable
        transactions={data?.transactions ?? []}
        loading={isLoading}
        onRowClick={handleRowClick}
        onDeleteSelected={handleDeleteSelected}
      />
    </div>
  );
}
