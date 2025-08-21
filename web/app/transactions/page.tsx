"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TransactionTable } from "./transaction-table";
import {
  useTransactions,
  useDeleteTransactions,
  useTransactionFilterOptions,
  useTransactionMetrics,
} from "./api";
import { SearchInput } from "@/components/search-input";
import { useTransactionFilters } from "./hooks/use-transaction-filters";
import { TransactionPerformanceChart } from "./transaction-performance-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Receipt, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

function TransactionPerformanceSection({
  metricData,
  metricLoading,
}: {
  metricData?: any;
  metricLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold">
              Transaction Performance
            </CardTitle>
            <CardDescription className="text-sm">
              Revenue and expense trends over time
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <TransactionPerformanceChart
          metricData={metricData}
          metricLoading={metricLoading}
        />
      </CardContent>
    </Card>
  );
}

function TransactionDetailsSection({
  filters,
  updateFilters,
  data,
  isLoading,
  handleRowClick,
  handleDeleteSelected,
  filterOptions,
  handleSearchSubmit,
}: {
  filters: any;
  updateFilters: any;
  data?: any;
  isLoading: boolean;
  handleRowClick: (id: string) => void;
  handleDeleteSelected: (ids: string[]) => void;
  filterOptions?: any;
  handleSearchSubmit: (query: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Receipt className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-xl font-semibold">
                  Transaction Details
                </CardTitle>
                {!isLoading && data?.transactions && (
                  <span className="text-lg font-medium text-muted-foreground tabular-nums">
                    {data.transactions.length} transactions
                  </span>
                )}
              </div>
              <CardDescription className="text-sm">
                Browse and manage all transactions
              </CardDescription>
            </div>
          </div>
          <SearchInput
            placeholder="Search by counterparty or product name..."
            initialValue={filters.q || ""}
            onSubmit={handleSearchSubmit}
            className="w-full max-w-md"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <TransactionTable
          transactions={data?.transactions ?? []}
          loading={isLoading}
          onRowClick={handleRowClick}
          onDeleteSelected={handleDeleteSelected}
          filters={filters}
          onFiltersChange={updateFilters}
          filterOptions={filterOptions}
        />
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default function TransactionsPage() {
  const router = useRouter();

  // Use the filter hook to manage all filter state
  const { filters, updateFilters } = useTransactionFilters();

  // Fetch transactions with all filters
  const { data, isLoading, mutate, error } = useTransactions(filters);
  // Fetch filter options for dropdowns
  const { data: filterOptions } = useTransactionFilterOptions();
  // Fetch aggregate metrics
  const { data: metricData, isLoading: metricLoading } =
    useTransactionMetrics();
  // Hook to delete transactions
  const deleteMutation = useDeleteTransactions();

  // Handler to update search query
  const handleSearchSubmit = useCallback(
    (query: string) => {
      updateFilters({ q: query || undefined });
    },
    [updateFilters],
  );

  // Handler to delete selected transactions
  const handleDeleteSelected = async (ids: string[]) => {
    try {
      await deleteMutation.trigger(ids);
      await mutate();
    } catch (error) {
      console.error(error);
    }
  };

  // Handler for row click navigation
  const handleRowClick = (id: string) => {
    router.push(`/transactions/${id}`);
  };

  // Handle potential error state
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState message={error.message || "Failed to load transactions."} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Transaction Performance Section */}
      <TransactionPerformanceSection
        metricData={metricData}
        metricLoading={metricLoading}
      />

      {/* Transaction Details Section */}
      <TransactionDetailsSection
        filters={filters}
        updateFilters={updateFilters}
        data={data}
        isLoading={isLoading}
        handleRowClick={handleRowClick}
        handleDeleteSelected={handleDeleteSelected}
        filterOptions={filterOptions}
        handleSearchSubmit={handleSearchSubmit}
      />
    </div>
  );
}
