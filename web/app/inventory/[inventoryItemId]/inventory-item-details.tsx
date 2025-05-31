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
import { AlertCircle } from "lucide-react";
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
  const [marketAnalysisDays, setMarketAnalysisDays] = useState<number>(30);
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
  } = useSkuMarketData(inventoryItem?.sku.id || null, marketAnalysisDays);

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
    marketAnalysisDays,
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
    <div className="space-y-6">
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

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <MetricCard
          isLoading={itemLoading}
          title="Quantity In Stock"
          value={quantity}
          subtitle="Units"
        />
        <MetricCard
          isLoading={itemLoading}
          title="Total Cost"
          value={formatCurrency(totalAcquisitionCost, currency)}
          subtitle={`Avg. ${formatCurrency(avgCostPerUnit, currency)} /unit`}
        />
        <MetricCard
          isLoading={itemLoading}
          title="Total Market Value"
          value={formatCurrency(totalMarketValue, currency)}
          subtitle={
            marketPricePerUnit !== undefined
              ? `${formatCurrency(marketPricePerUnit, currency)} /unit market price`
              : "Market price unavailable"
          }
        />
        <MetricCard
          isLoading={itemLoading}
          title="Unrealized Profit"
          value={formatCurrency(totalProfitLoss, currency)}
          subtitle={formattedPercentage ?? "Cost basis zero"}
        />
      </div>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="market" className="w-full">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="market">Market Analysis</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="history" className="mt-4">
          <DataTable
            columns={transactionColumns}
            data={transactionsData?.items ?? []}
            loading={itemLoading || transactionsLoading}
            onRowClick={handleTransactionRowClick}
          />
          {/* TODO: Add Listing History Table here */}
          {/* TODO: Add Audit Trail Table here */}
        </TabsContent>
        <TabsContent value="market" className="mt-4 space-y-6">
          {/* Consolidated Market Analysis Controls */}
          <div className="flex justify-end mb-6">
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
                  onChange={(option) => setSelectedMarketplace(option.value)}
                  options={marketplaceOptions.map((mp) => ({
                    value: mp,
                    label: mp,
                  }))}
                />
              )}
            </div>
          </div>

          {/* Price History Section */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Price History</CardTitle>
                <CardDescription>
                  Historical price data for this SKU on{" "}
                  {selectedMarketplace || "the marketplace"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Market Depth Section */}
          <MarketDepthWithMetrics
            data={marketDataItems}
            isLoading={marketLoading}
            error={marketError}
            currency={inventoryItem?.average_cost_per_item?.currency ?? "USD"}
            salesLookbackDays={marketAnalysisDays}
            selectedMarketplace={selectedMarketplace}
          />
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent>
              {/* TODO: Implement Details components (Grading, Notes) */}
              <p>Grading information and notes will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
