"use client";

import {
  useInventoryItem,
  useInventoryItemTransactions,
  useInventoryPriceHistory,
  useSkuMarketplaces,
} from "../api";
import { InventorySKUTransactionLineItem } from "../schemas";
import { DataTable } from "@/components/data-table";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Package,
  BarChart3,
  TrendingUp,
  History,
} from "lucide-react";
import { formatCurrencyNumber } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSkuMarketData } from "@/app/catalog/api";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { formatSKU } from "@/app/catalog/utils";
import { ProductHeader } from "@/components/product-header";
import { MarketDepthWithMetrics } from "@/components/market-depth-chart-with-metrics";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { Select } from "@/components/marketplace-selector";

interface InventoryItemDetailsProps {
  inventoryItemId: string;
}

function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD",
): string {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

const transactionColumns: ColumnDef<InventorySKUTransactionLineItem>[] = [
  {
    accessorKey: "transaction_date",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("transaction_date"));
      return format(date, "MMM d, yyyy");
    },
  },
  {
    accessorKey: "counterparty_name",
    header: "Counterparty",
    cell: ({ row }) => {
      return (
        row.getValue("counterparty_name") || (
          <span className="text-muted-foreground italic">N/A</span>
        )
      );
    },
  },
  {
    accessorKey: "transaction_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("transaction_type") as string;
      return <span className="capitalize">{type.toLowerCase()}</span>;
    },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const quantity = row.getValue("quantity") as number;
      return <div className="tabular-nums text-right">{quantity}</div>;
    },
  },
  {
    accessorKey: "unit_price",
    header: "Unit Price",
    cell: ({ row }) => {
      const unitPrice = row.getValue("unit_price") as {
        amount?: number | null;
        currency?: string | null;
      } | null;
      if (unitPrice?.amount == null) {
        return <div className="text-muted-foreground text-right">N/A</div>;
      }
      return (
        <div className="tabular-nums text-right">
          ${formatCurrencyNumber(unitPrice.amount)}
        </div>
      );
    },
  },
];

export function InventoryItemDetails({
  inventoryItemId,
}: InventoryItemDetailsProps) {
  const router = useRouter();

  // State declarations first
  const [marketAnalysisDays, setMarketAnalysisDays] = useState<number | null>(
    null,
  );
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(
    null,
  );

  // Data fetching hooks
  const {
    data: inventoryItem,
    isLoading: itemLoading,
    error: itemError,
  } = useInventoryItem(inventoryItemId);

  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useInventoryItemTransactions(inventoryItemId);

  const {
    data: marketDataItems,
    isLoading: marketLoading,
    error: marketError,
  } = useSkuMarketData(
    inventoryItem?.sku.id || null,
    marketAnalysisDays || undefined,
  );

  const {
    data: marketplacesData,
    isLoading: marketplacesLoading,
    error: marketplacesError,
  } = useSkuMarketplaces(inventoryItem?.sku.id || null);

  const {
    data: priceHistoryData,
    isLoading: priceHistoryLoading,
    error: priceHistoryError,
  } = useInventoryPriceHistory(
    inventoryItem?.sku.id && selectedMarketplace ? inventoryItem.sku.id : null,
    marketAnalysisDays || undefined,
    selectedMarketplace,
  );

  // Get marketplace options from dedicated endpoint
  const marketplaceOptions = marketplacesData?.marketplaces || [];

  // Auto-select first marketplace when options change
  useEffect(() => {
    if (!marketplaceOptions.length) return;

    const effectiveMarketplace = selectedMarketplace || marketplaceOptions[0];

    if (!selectedMarketplace && effectiveMarketplace) {
      setSelectedMarketplace(effectiveMarketplace);
    }
  }, [marketplaceOptions, selectedMarketplace]);

  // Event handlers
  const handleTransactionRowClick = (
    row: Row<InventorySKUTransactionLineItem>,
  ) => {
    const transactionId = row.original.transaction_id;
    router.push(`/transactions/${transactionId}`);
  };

  if (itemError) {
    return <div>Error loading inventory item: {itemError.message}</div>;
  }
  if (transactionsError) {
    console.error("Transaction History Error:", transactionsError);
  }

  const quantity = inventoryItem ? inventoryItem.quantity : 0;
  const avgCostPerUnit = inventoryItem?.average_cost_per_item?.amount ?? 0;
  const marketPricePerUnit = inventoryItem?.lowest_listing_price?.amount;
  const currency =
    inventoryItem?.average_cost_per_item?.currency ??
    inventoryItem?.lowest_listing_price?.currency ??
    "USD";
  const totalAcquisitionCost = avgCostPerUnit * quantity;
  const totalMarketValue =
    marketPricePerUnit !== undefined ? marketPricePerUnit * quantity : null;
  const totalProfitLoss =
    totalMarketValue !== null ? totalMarketValue - totalAcquisitionCost : null;
  const profitPercentage =
    totalProfitLoss !== null && totalAcquisitionCost > 0
      ? (totalProfitLoss / totalAcquisitionCost) * 100
      : null;
  const formattedPercentage =
    profitPercentage !== null
      ? `${profitPercentage >= 0 ? "+" : ""}${profitPercentage.toFixed(1)}%`
      : null;

  if (itemLoading) {
    return <div>Loading inventory details...</div>;
  }

  if (!inventoryItem) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Inventory item not found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Product Header */}
      <ProductHeader
        imageUrl={inventoryItem.sku.product.image_url}
        name={inventoryItem.sku.product.name}
        badgeContent={
          inventoryItem.sku.product.rarity === null
            ? undefined
            : inventoryItem.sku.product.rarity
        }
        setName={inventoryItem.sku.product.set.name}
        setNumber={inventoryItem.sku.product.number}
        details={formatSKU(
          inventoryItem.sku.condition || { name: "" },
          inventoryItem.sku.printing || { name: "" },
          inventoryItem.sku.language || { name: "" },
        )}
      />

      {/* Inventory Overview Section */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Inventory Overview
              </CardTitle>
              <CardDescription className="text-sm">
                Current holdings and financial position
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm font-medium text-muted-foreground">
                  Quantity In Stock
                </p>
              </div>
              {itemLoading ? (
                <div className="space-y-1">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">{quantity}</p>
                  <p className="text-sm text-muted-foreground">Units</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Cost
                </p>
              </div>
              {itemLoading ? (
                <div className="space-y-1">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(totalAcquisitionCost, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Avg. {formatCurrency(avgCostPerUnit, currency)} /unit
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm font-medium text-muted-foreground">
                  Market Value
                </p>
              </div>
              {itemLoading ? (
                <div className="space-y-1">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(totalMarketValue, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {marketPricePerUnit !== undefined
                      ? `${formatCurrency(marketPricePerUnit, currency)} /unit market price`
                      : "Market price unavailable"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    (totalProfitLoss ?? 0) >= 0
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                ></div>
                <p className="text-sm font-medium text-muted-foreground">
                  Unrealized P&L
                </p>
              </div>
              {itemLoading ? (
                <div className="space-y-1">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p
                    className={`text-2xl font-bold tabular-nums ${
                      (totalProfitLoss ?? 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(totalProfitLoss, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formattedPercentage ?? "Cost basis zero"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="market" className="w-full">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="market">Market Analysis</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="market" className="mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">
                      Market Analysis
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Price trends and market depth for this SKU
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <TimeRangeToggle
                    value={marketAnalysisDays}
                    onChange={setMarketAnalysisDays}
                    options={[
                      { label: "7d", value: 7 },
                      { label: "30d", value: 30 },
                      { label: "90d", value: 90 },
                      { label: "1y", value: 365 },
                    ]}
                  />
                  {marketplaceOptions.length > 0 && (
                    <Select
                      value={selectedMarketplace}
                      onChange={(option) =>
                        setSelectedMarketplace(option.value)
                      }
                      options={marketplaceOptions.map((mp) => ({
                        value: mp,
                        label: mp,
                      }))}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              {/* Price History Section */}
              <div className="p-6 pb-0">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Price History</h3>
                  <p className="text-sm text-muted-foreground">
                    Historical price data for this SKU on{" "}
                    {selectedMarketplace || "the marketplace"}
                  </p>
                </div>
                <PriceHistoryChart
                  data={priceHistoryData?.items || []}
                  isLoading={priceHistoryLoading}
                  currency={
                    inventoryItem?.average_cost_per_item?.currency ?? "USD"
                  }
                />
                {priceHistoryError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load price history: {priceHistoryError.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Market Depth Section */}
              <div className="px-6 pb-6 border-t">
                <div className="pt-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">Market Depth</h3>
                    <p className="text-sm text-muted-foreground">
                      Current active listings and sales activity on{" "}
                      {selectedMarketplace || "the marketplace"}
                    </p>
                  </div>
                  <MarketDepthWithMetrics
                    data={marketDataItems}
                    isLoading={marketLoading}
                    error={marketError}
                    currency={
                      inventoryItem?.average_cost_per_item?.currency ?? "USD"
                    }
                    salesLookbackDays={marketAnalysisDays ?? undefined}
                    selectedMarketplace={selectedMarketplace}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold">
                    Transaction History
                  </CardTitle>
                  <CardDescription className="text-sm">
                    All transactions for this inventory item
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={transactionColumns}
                data={transactionsData?.items ?? []}
                loading={itemLoading || transactionsLoading}
                onRowClick={handleTransactionRowClick}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
