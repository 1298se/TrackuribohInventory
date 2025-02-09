"use client"

import { format } from "date-fns"
import { ProductDisplay } from "@/components/ui/product-display"
import { Separator } from "@/components/ui/separator"
import { useTransaction } from "../api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface TransactionDetailsProps {
    transactionId: string
}

function TransactionDetailsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Skeleton className="h-6 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
            <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
            </div>
            <Separator />
            <div className="space-y-4">
                <Skeleton className="h-4 w-16" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function TransactionDetails({ transactionId }: TransactionDetailsProps) {
    const { data: transaction, isLoading, error } = useTransaction(transactionId)
    
    if (isLoading) {
        return <TransactionDetailsSkeleton />
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Failed to load transaction details. Please try again later.
                </AlertDescription>
            </Alert>
        )
    }

    if (!transaction) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Transaction not found.
                </AlertDescription>
            </Alert>
        )
    }

    const totalAmount = transaction.line_items.reduce((sum, item) => {
        const amount = parseFloat(item.price_per_item.amount)
        return sum + (amount * item.quantity)
    }, 0)

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                    {transaction.type === "PURCHASE" 
                        ? `Purchase from ${transaction.counterparty_name}`
                        : `Sale to ${transaction.counterparty_name}`
                    }
                </h2>
                <p className="text-sm text-muted-foreground">
                    {format(new Date(transaction.date), "MMMM d, yyyy")}
                </p>
            </div>

            <div className="space-y-1">
                <div className="text-sm font-medium">Total Amount</div>
                <div className="text-2xl font-bold">
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: transaction.line_items[0]?.price_per_item.currency || "USD",
                    }).format(totalAmount)}
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-sm font-medium">Items</h3>
                {transaction.line_items.map((item) => (
                    <div key={item.id} className="flex items-start gap-4">
                        <div className="h-16 w-16">
                            <img
                                src={item.sku.product.image_url}
                                alt={item.sku.product.name}
                                className="h-full w-full object-contain rounded-md"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <ProductDisplay sku={item.sku} />
                        </div>
                        <div className="text-right space-y-1">
                            <div className="font-medium">
                                {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: item.price_per_item.currency,
                                }).format(parseFloat(item.price_per_item.amount) * item.quantity)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {item.quantity}x @ {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: item.price_per_item.currency,
                                }).format(parseFloat(item.price_per_item.amount))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
} 