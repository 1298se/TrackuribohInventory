"use client";

import { useInventoryItem, useInventoryItemTransactions } from "../api";
import {
  InventorySKUTransactionLineItem,
  InventoryItemResponse,
} from "../schemas";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
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
import { SKUDisplay } from "@/components/sku-display";
import { ProductImage } from "@/components/ui/product-image";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useSkuMarketData } from "../../catalog/api";

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
    data: marketData,
    isLoading: marketLoading,
    error: marketError,
  } = useSkuMarketData(inventoryItemId, 30, "daily");

  if (itemError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load item details.</AlertDescription>
      </Alert>
    );
  }
  if (transactionsError) {
    console.error("Transaction History Error:", transactionsError);
  }

  const quantity = !itemLoading && inventoryItem ? inventoryItem.quantity : 0;
  const avgCostPerUnit =
    !itemLoading && inventoryItem
      ? (inventoryItem.average_cost_per_item?.amount ?? 0)
      : 0;
  const marketPricePerUnit =
    !itemLoading && inventoryItem
      ? inventoryItem.lowest_listing_price?.amount
      : undefined;
  const currency =
    !itemLoading && inventoryItem
      ? (inventoryItem.average_cost_per_item?.currency ??
        inventoryItem.lowest_listing_price?.currency ??
        "USD")
      : "USD";

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

  // Prepare cumulative depth data: aggregate listing_count up to each price point
  const depthData = marketData?.depth_levels ?? [];
  const cumulativeData = depthData.reduce(
    (acc: Array<{ price: number; cumulativeCount: number }>, lvl) => {
      const prevTotal =
        acc.length > 0 ? acc[acc.length - 1].cumulativeCount : 0;
      acc.push({
        price: lvl.price,
        cumulativeCount: prevTotal + lvl.listing_count,
      });
      return acc;
    },
    [],
  );

  if (!itemLoading && !inventoryItem) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Inventory item not found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Combined Overview Section */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Column 1: Item Identification Card */}
        <Card className="lg:w-1/3 flex-shrink-0">
          <CardContent className="pt-4">
            {itemLoading ? (
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-32 w-24 rounded-md" />
                <div className="space-y-1 w-full text-center">
                  <Skeleton className="h-5 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-1/2 mx-auto" />
                  <Skeleton className="h-4 w-1/4 mx-auto" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ProductImage
                  src={inventoryItem!.sku.product.image_url}
                  alt={inventoryItem!.sku.product.name}
                  containerClassName="h-32 w-auto max-w-[8rem] rounded-md overflow-hidden"
                />
                <div className="space-y-1 text-center">
                  <h1 className="text-lg font-semibold leading-tight">
                    {inventoryItem!.sku.product.name}
                  </h1>
                  <div className="text-sm text-muted-foreground">
                    <div className="text-base font-medium text-foreground">
                      {inventoryItem!.sku.product.set.name}
                    </div>
                    <div className="pt-0.5">
                      {inventoryItem!.sku.product.rarity}
                    </div>
                    <div className="pt-0.5 text-xs">
                      {[
                        inventoryItem!.sku.condition?.name,
                        inventoryItem!.sku.printing?.name,
                        inventoryItem!.sku.language?.name,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                  {/* Quantity could also go here if needed */}
                  {/* <p className="text-sm font-medium pt-2">Quantity: {quantity}</p> */}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Financial Snapshot Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-grow">
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
            // TODO: Add pagination/filtering if needed
          />
          {/* TODO: Add Listing History Table here */}
          {/* TODO: Add Audit Trail Table here */}
        </TabsContent>
        <TabsContent value="market" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Market Depth</CardTitle>
              <CardDescription>
                Displays the cumulative number of active listings at each price
                level, helping you gauge supply and pricing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {marketError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load market depth.
                  </AlertDescription>
                </Alert>
              )}
              {marketLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ChartContainer
                  id="market-depth"
                  config={{
                    price: { label: "Price", color: "#3B82F6" },
                    cumulativeCount: {
                      label: "Cumulative Count",
                      color: "#3B82F6",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <AreaChart
                    layout="horizontal"
                    data={cumulativeData}
                    margin={{ top: 10, right: 30, left: 60, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="cumulativeCount"
                      type="number"
                      domain={[0, "dataMax"]}
                    />
                    <YAxis
                      dataKey="price"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(value) => formatCurrency(value, currency)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "cumulativeCount"
                          ? value
                          : formatCurrency(value, currency)
                      }
                      labelFormatter={(label: number) => label}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="price"
                      stroke="#3B82F6"
                      fill="rgba(59,130,246,0.3)"
                      dot={{ r: 2, fill: "#3B82F6" }}
                    />
                  </AreaChart>
                </ChartContainer>
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
