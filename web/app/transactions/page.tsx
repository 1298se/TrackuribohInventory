"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TransactionTable } from "./transaction-table";
import {
  useTransactions,
  useDeleteTransactions,
  useTransactionMetrics,
} from "./api";
import { SearchInput } from "@/components/search-input";
import { InventoryMetricCard } from "@/components/inventory-metric-card";

function formatCurrency(
  amount?: number | null,
  currency: string = "USD",
): string {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get the current query from URL or default
  const initialQuery = searchParams.get("q") || "";
  // Fetch transactions based on the current query
  const { data, isLoading, mutate } = useTransactions(initialQuery);
  // Fetch transaction metrics
  const { data: metricsData, isLoading: metricsLoading } =
    useTransactionMetrics();
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
      {/* Transaction Metric Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs w-full">
        <InventoryMetricCard
          title="Total Transactions"
          value={metricsData?.total_transactions ?? 0}
          isLoading={metricsLoading}
        />
        <InventoryMetricCard
          title="Total Revenue"
          value={formatCurrency(metricsData?.total_revenue)}
          isLoading={metricsLoading}
        />
        <InventoryMetricCard
          title="Total Spent"
          value={formatCurrency(metricsData?.total_spent)}
          isLoading={metricsLoading}
        />
        <InventoryMetricCard
          title="Net Profit"
          value={formatCurrency(metricsData?.net_profit)}
          isLoading={metricsLoading}
        />
      </div>

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
