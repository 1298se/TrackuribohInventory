import { CellContext, ColumnDef } from "@tanstack/react-table"
import { useInventory } from "./api"
import { DataTable  } from "./data-table"
import { InventoryItemResponse } from "./schemas"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Package2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { type Column } from "./data-table"
import { ProductDisplay } from "@/components/ui/product-display"

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
)
const DefaultLoading = () => <Skeleton className="h-4 w-24" />

export const columns: Column<InventoryItemResponse, any>[] = [
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
            return <ProductDisplay sku={row.original.sku} />
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
        accessorKey: "cost_per_item.amount",
        header: "Average Cost",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const amount = parseFloat(row.original.cost_per_item.amount)
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: row.original.cost_per_item.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount)
     
            return <div className="font-medium tabular-nums">{formatted}</div>
        }
    },
    {
        accessorKey: "lowest_listing_price.amount",
        header: "Lowest Listing Price",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const lowestListingPrice = row.original.lowest_listing_price
            if (!lowestListingPrice) {
                return <div className="text-muted-foreground">N/A</div>
            }

            const amount = parseFloat(lowestListingPrice.amount)
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: lowestListingPrice.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount)
     
            return <div className="font-medium tabular-nums">{formatted}</div>
        }
    },
    {
        id: "unrealized_profit",
        header: "Total Unrealized Profit",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const lowestListingPrice = row.original.lowest_listing_price
            if (!lowestListingPrice) {
                return <div className="text-muted-foreground">N/A</div>
            }

            const listingAmount = parseFloat(lowestListingPrice.amount)
            const costAmount = parseFloat(row.original.cost_per_item.amount)
            const quantity = row.original.quantity
            
            const profit = (listingAmount - costAmount) * quantity
            const percentageGain = ((listingAmount - costAmount) / costAmount) * 100
            
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: lowestListingPrice.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(profit)

            const percentFormatted = new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
                signDisplay: 'always'
            }).format(percentageGain)
     
            return (
                <div className={cn(
                    "font-medium tabular-nums flex flex-col",
                    profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : ""
                )}>
                    <span>{formatted}</span>
                    <span className="text-sm">({percentFormatted}%)</span>
                </div>
            )
        }
    },
]

function ErrorState({ message }: { message: string }) {
    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                {message}
            </AlertDescription>
        </Alert>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
            <div className="text-center space-y-2">
                <Package2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="font-medium">No inventory items</h3>
                <p className="text-sm text-muted-foreground">
                    Your inventory is currently empty.
                </p>
            </div>
        </div>
    )
}

export function InventoryTable() {
    const { data, isLoading } = useInventory()
  
    return (
        <div className="space-y-4">
            <DataTable 
                columns={columns} 
                data={data?.inventory_items ?? []}
                loading={isLoading}
            />
        </div>
    )
}