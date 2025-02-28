"use client"

import { format } from "date-fns"
import { SKUDisplay } from "@/components/ui/sku-display"
import { Separator } from "@/components/ui/separator"
import { useTransaction } from "../api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { DataTable } from "../../inventory/data-table"
import { type Column } from "../../inventory/data-table"
import { LineItemResponse } from "../schemas"
import { cn } from "@/lib/utils"
import { MoneyInput } from "@/components/ui/money-input"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
)
const DefaultLoading = () => <Skeleton className="h-4 w-24" />

export function TransactionDetails({ transactionId }: TransactionDetailsProps) {
    const { data: transaction, isLoading, error } = useTransaction(transactionId)
    const [isEditing, setIsEditing] = useState(false)
    const [priceInputs, setPriceInputs] = useState<Record<string, number | undefined>>({})
    
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

    const getLineItemPrice = (skuId: string) => {
        return priceInputs[skuId] ?? 
            transaction.line_items.find(item => item.sku_id === skuId)?.price_per_item_amount ?? 0
    }

    const getLineItemQuantity = (skuId: string) => {
        return transaction.line_items.find(item => item.sku_id === skuId)?.quantity ?? 0
    }

    const handleUnitPriceInputChange = (skuId: string, value: number | undefined) => {
        // Only update the input value state during typing
        setPriceInputs(prev => ({
            ...prev,
            [skuId]: value
        }))
    }

    const totalAmount = transaction.line_items.reduce((sum, item) => {
        const price = isEditing ? getLineItemPrice(item.sku_id) : item.price_per_item_amount
        const quantity = getLineItemQuantity(item.sku_id)
        // Use Number constructor to convert the toFixed string back to a number for the sum
        return sum + Number((price * quantity).toFixed(2))
    }, 0)

    const currency = transaction.currency
    
    // Helper function to format currency values
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    const handleSaveChanges = () => {
        // Here you would implement API call to save the updated line items
        const updatedLineItems = Object.entries(priceInputs).map(([skuId, price]) => ({
            sku_id: skuId,
            price,
            quantity: getLineItemQuantity(skuId)
        })).filter(item => item.price !== undefined)
        
        console.log('Saving changes:', updatedLineItems)
        // After successful save:
        setIsEditing(false)
        setPriceInputs({})
        // You might want to refresh the transaction data here
    }

    const lineItemColumns: Column<LineItemResponse, any>[] = [
        {
            accessorKey: "sku.product.image_url",
            header: "Image",
            loading: ImageLoading,
            cell: ({ row }) => {
                const imageUrl = row.original.sku.product.image_url
                return (
                    <div className="h-16 w-16">
                        <img 
                            src={imageUrl} 
                            alt={row.original.sku.product.name}
                            className="h-full w-full object-contain rounded-md"
                        />
                    </div>
                )
            }
        },
        {
            accessorKey: "sku.product.name",
            header: "Product",
            loading: ProductLoading,
            cell: ({ row }) => {
                return <SKUDisplay sku={row.original.sku} />
            }
        },
        {
            accessorKey: "quantity",
            header: "Quantity",
            loading: DefaultLoading,
            cell: ({ row }) => {
                return <div className="font-medium tabular-nums">{row.getValue("quantity")}</div>
            }
        },
        {
            accessorKey: "price_per_item_amount",
            header: "Unit Price",
            loading: DefaultLoading,
            cell: ({ row }) => {
                const skuId = row.original.sku_id
                if (isEditing) {
                    return (
                        <MoneyInput
                            key={`price-input-${skuId}`}
                            initialValue={priceInputs[skuId] ?? row.original.price_per_item_amount}
                            onChange={(value) => handleUnitPriceInputChange(skuId, value)}
                            className="w-20"
                        />
                    )
                }

                const amount = row.original.price_per_item_amount
                const formatted = formatCurrency(amount)
                return <div className="font-medium tabular-nums">{formatted}</div>
            }
        },
        {
            id: "total_price",
            header: "Total Price",
            loading: DefaultLoading,
            cell: ({ row }) => {
                const skuId = row.original.sku_id
                const quantity = row.original.quantity
                const unitPrice = isEditing ? getLineItemPrice(skuId) : row.original.price_per_item_amount
                const total = Number((unitPrice * quantity).toFixed(2))
                const formatted = formatCurrency(total)
                return <div className="font-medium tabular-nums">{formatted}</div>
            }
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-start">
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
                <div>
                    {isEditing ? (
                        <div className="space-x-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                    setIsEditing(false)
                                    setPriceInputs({})
                                }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                size="sm"
                                onClick={handleSaveChanges}
                            >
                                Save Changes
                            </Button>
                        </div>
                    ) : (
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                                // Initialize price inputs when entering edit mode
                                const initialInputValues: Record<string, number> = {}
                                
                                transaction.line_items.forEach(item => {
                                    // Ensure values are numbers
                                    initialInputValues[item.sku_id] = Number(item.price_per_item_amount)
                                })
                                
                                setPriceInputs(initialInputValues)
                                setIsEditing(true)
                            }}
                        >
                            Edit Prices
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-sm font-medium">Total Amount</div>
                <div className="text-2xl font-bold">
                    {formatCurrency(totalAmount)}
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-sm font-medium">Items</h3>
                <DataTable 
                    columns={lineItemColumns}
                    data={transaction.line_items}
                    loading={false}
                />
            </div>
        </div>
    )
} 