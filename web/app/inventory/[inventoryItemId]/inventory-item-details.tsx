"use client";

import { useInventoryItem, useInventoryItemTransactions } from "../api";
import {
  InventorySKUTransactionLineItem,
  InventoryItemResponse,
} from "../schemas";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useSkuMarketData } from "@/app/catalog/api";
import { useRouter } from "next/navigation";
import { MarketDepthChart } from "@/components/market-depth-chart";
import { SKUMarketDataItem, SkuBase } from "@/app/catalog/schemas";
import { useMemo, useState } from "react";
import { formatSKU } from "@/app/catalog/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductHeader } from "@/components/product-header";

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
      return <div className="tabular-nums">{quantity}</div>;
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
      const formatted = formatCurrency(
        unitPrice?.amount,
        unitPrice?.currency ?? "USD",
      );
      return <div className="tabular-nums">{formatted}</div>;
    },
  },
  {
    accessorKey: "platform_name",
    header: "Platform",
    cell: ({ row }) => {
      return (
        row.getValue("platform_name") || (
          <span className="text-muted-foreground italic">N/A</span>
        )
      );
    },
  },
];

export function InventoryItemDetails({
  inventoryItemId,
}: InventoryItemDetailsProps) {
  const router = useRouter();
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
  const handleTransactionRowClick = (
    row: Row<InventorySKUTransactionLineItem>,
  ) => {
    const transactionId = row.original.transaction_id;
    router.push(`/transactions/${transactionId}`);
  };

  // Updated to handle multiple marketplace data
  const {
    data: marketDataItems,
    isLoading: marketLoading,
    error: marketError,
  } = useSkuMarketData(inventoryItem?.sku.id || null);

  // Add state for selected marketplace
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(
    null,
  );

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

  // Generate a list of unique marketplaces from the market data
  const marketplaceOptions = useMemo(() => {
    if (!marketDataItems?.length) return [];
    return Array.from(new Set(marketDataItems.map((item) => item.marketplace)));
  }, [marketDataItems]);

  // Get the market data for the selected marketplace or fall back to first available
  const selectedMarketData = useMemo(() => {
    if (!marketDataItems?.length) return null;

    // If no marketplace is selected yet or selection invalid, use the first one
    const effectiveMarketplace =
      selectedMarketplace || marketDataItems[0]?.marketplace;

    // Auto-select first marketplace when options change
    if (!selectedMarketplace && effectiveMarketplace) {
      setSelectedMarketplace(effectiveMarketplace);
    }

    // Find the matching market data item
    return (
      marketDataItems.find((item) => item.marketplace === effectiveMarketplace)
        ?.market_data || null
    );
  }, [marketDataItems, selectedMarketplace]);

  // Compute chart data from the selected market data
  const chartData = useMemo(() => {
    if (!selectedMarketData?.cumulative_depth_levels?.length) return [];

    return selectedMarketData.cumulative_depth_levels.map(
      ({ price, cumulative_count }) => ({
        price,
        cumulativeCount: cumulative_count,
      }),
    );
  }, [selectedMarketData]);

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
            <TabsTrigger value="market">Market Data</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
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
        <TabsContent value="market" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Market Depth</CardTitle>
                  <CardDescription>
                    Cumulative active listings by price for this specific SKU.
                  </CardDescription>
                </div>
                {marketplaceOptions.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Marketplace:
                    </span>
                    <Select
                      value={selectedMarketplace || undefined}
                      onValueChange={(value) => setSelectedMarketplace(value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select marketplace" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketplaceOptions.map((marketplace) => (
                          <SelectItem key={marketplace} value={marketplace}>
                            {marketplace}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {marketError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load market depth. {marketError.message}
                  </AlertDescription>
                </Alert>
              )}
              {marketLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <MarketDepthChart
                  isLoading={marketLoading}
                  data={chartData}
                  currency={
                    inventoryItem?.average_cost_per_item?.currency ?? "USD"
                  }
                />
              )}
            </CardContent>
          </Card>
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
