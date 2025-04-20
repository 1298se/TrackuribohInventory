"use client"

import { useInventoryItem, useInventoryItemTransactions } from "../api"
import { InventorySKUTransactionLineItem, InventoryItemResponse } from "../schemas"
import { DataTable } from "@/components/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { SKUDisplay } from "@/components/ui/sku-display"
import { ProductImage } from "@/components/ui/product-image"
import { cn } from "@/lib/utils"
import { MetricCard } from "@/components/ui/metric-card"

interface InventoryItemDetailsProps {
    inventoryItemId: string
}

function formatCurrency(amount: number | null | undefined, currency: string = "USD"): string {
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
            const unitPrice = row.getValue("unit_price") as { amount?: number | null; currency?: string | null } | null;
            const formatted = formatCurrency(unitPrice?.amount, unitPrice?.currency ?? "USD");
            return <div className="tabular-nums">{formatted}</div>;
        },
    },
    {
        accessorKey: "platform_name",
        header: "Platform",
        cell: ({ row }) => {
            return row.getValue("platform_name") || <span className="text-muted-foreground italic">N/A</span>;
        },
    },
];

export function InventoryItemDetails({ inventoryItemId }: InventoryItemDetailsProps) {
    const { data: inventoryItem, isLoading: itemLoading, error: itemError } = useInventoryItem(inventoryItemId);
    const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = useInventoryItemTransactions(inventoryItemId);

    if (itemError) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Failed to load item details.</AlertDescription></Alert>;
    }
     if (transactionsError) {
         console.error("Transaction History Error:", transactionsError);
     }

    const quantity = !itemLoading && inventoryItem ? inventoryItem.quantity : 0;
    const avgCostPerUnit = !itemLoading && inventoryItem ? inventoryItem.average_cost_per_item?.amount ?? 0 : 0;
    const marketPricePerUnit = !itemLoading && inventoryItem ? inventoryItem.lowest_listing_price?.amount : undefined;
    const currency = !itemLoading && inventoryItem ? inventoryItem.average_cost_per_item?.currency ?? inventoryItem.lowest_listing_price?.currency ?? "USD" : "USD";

    const totalAcquisitionCost = avgCostPerUnit * quantity;
    const totalMarketValue = marketPricePerUnit !== undefined ? marketPricePerUnit * quantity : null;
    const totalProfitLoss = totalMarketValue !== null ? totalMarketValue - totalAcquisitionCost : null;

    const profitPercentage = (totalProfitLoss !== null && totalAcquisitionCost > 0) 
        ? (totalProfitLoss / totalAcquisitionCost) * 100 
        : null;

    const formattedPercentage = profitPercentage !== null 
        ? `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(1)}%`
        : null;

    if (!itemLoading && !inventoryItem) {
        return <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Inventory item not found.</AlertDescription></Alert>;
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <Card>
                <CardContent className="pt-6">
                    {itemLoading ? (
                        <div className="flex items-start gap-6">
                            <Skeleton className="h-32 w-24 rounded-md flex-shrink-0" />
                            <div className="space-y-2 flex-grow pt-1"> 
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                            <ProductImage
                                src={inventoryItem!.sku.product.image_url}
                                alt={inventoryItem!.sku.product.name}
                                containerClassName="h-32 w-24 flex-shrink-0 rounded-md overflow-hidden"
                            />
                            <div className="space-y-1 flex-grow">
                                <h1 className="text-2xl font-semibold leading-tight">
                                    {inventoryItem!.sku.product.name}
                                </h1>
                                <div className="text-sm text-muted-foreground">
                                    <div className="text-base font-medium text-foreground">{inventoryItem!.sku.product.set.name}</div>
                                    <div className="pt-0.5">{inventoryItem!.sku.product.rarity}</div>
                                    <div className="pt-0.5">
                                        {[inventoryItem!.sku.condition?.name, inventoryItem!.sku.printing?.name, inventoryItem!.sku.language?.name]
                                            .filter(Boolean)
                                            .join(" • ")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Financial Snapshot Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                    subtitle={marketPricePerUnit !== undefined 
                        ? `${formatCurrency(marketPricePerUnit, currency)} /unit market price` 
                        : "Market price unavailable"}
                />
                <MetricCard
                    isLoading={itemLoading}
                    title="Unrealized Profit"
                    value={formatCurrency(totalProfitLoss, currency)}
                    subtitle={formattedPercentage ?? "Cost basis zero"}
                />
            </div>

            <DataTable
                columns={transactionColumns}
                data={transactionsData?.items ?? []} 
                loading={itemLoading || transactionsLoading}
            />
        </div>
    );
} 