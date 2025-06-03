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
import { DollarSign, TrendingUp, Receipt, AlertCircle } from "lucide-react";
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

function TransactionOverviewSection({
  metricData,
  metricLoading,
}: {
  metricData?: any;
  metricLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Transaction Overview
              </CardTitle>
              <CardDescription className="text-sm">
                All-time transaction summary and totals
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(metricData?.total_revenue)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(metricData?.total_spent)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  (metricData?.net_profit ?? 0) >= 0
                    ? "bg-emerald-500"
                    : "bg-red-500",
                )}
              ></div>
              <p className="text-sm font-medium text-muted-foreground">
                Net Profit
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    (metricData?.net_profit ?? 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                  )}
                >
                  {formatCurrency(metricData?.net_profit)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Transactions
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {metricData?.total_transactions?.toLocaleString() ?? 0}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionPerformanceSection() {
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
        <TransactionPerformanceChart />
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
              <CardTitle className="text-xl font-semibold">
                Transaction Details
              </CardTitle>
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
      mutate();
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
      <div className="container space-y-4">
        <ErrorState message={error.message || "Failed to load transactions."} />
      </div>
    );
  }

  return (
    <div className="container space-y-8">
      {/* Static Transaction Overview Section */}
      <TransactionOverviewSection
        metricData={metricData}
        metricLoading={metricLoading}
      />

      {/* Transaction Performance Section */}
      <TransactionPerformanceSection />

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
