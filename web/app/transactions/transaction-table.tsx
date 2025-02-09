import { useTransactions } from "./api"
import { DataTable } from "../inventory/data-table"
import { TransactionResponse } from "./schemas"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { type Column } from "../inventory/data-table"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProductDisplay } from "@/components/ui/product-display"
import { useRouter } from "next/navigation"

const DefaultLoading = () => <Skeleton className="h-4 w-24" />
const ProductLoading = () => (
    <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
    </div>
)

export const columns: Column<TransactionResponse, any>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                onClick={(e) => e.stopPropagation()}
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "counterparty_name",
        header: "Counterparty",
        loading: DefaultLoading,
        cell: ({ row }) => {
            return (
                <div className="font-medium">
                    {row.original.counterparty_name}
                </div>
            )
        }
    },
    {
        accessorKey: "type",
        header: "Type",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const type = row.original.type
            return (
                <div className={cn(
                    "font-medium",
                    type === "PURCHASE" ? "text-blue-600" : "text-green-600"
                )}>
                    {type}
                </div>
            )
        }
    },
    {
        accessorKey: "date",
        header: "Date",
        loading: DefaultLoading,
        cell: ({ row }) => {
            return (
                <div className="font-medium">
                    {format(row.original.date, "MMM d, yyyy")}
                </div>
            )
        }
    },
    {
        accessorKey: "total_amount",
        header: "Total",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const lineItems = row.original.line_items
            const totalAmount = lineItems.reduce((sum, item) => {
                const amount = parseFloat(item.price_per_item.amount)
                return sum + (amount * item.quantity)
            }, 0)

            return (
                <div className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: lineItems[0]?.price_per_item.currency || "USD",
                    }).format(totalAmount)}
                </div>
            )
        }
    },
    {
        accessorKey: "line_items",
        header: "Items",
        loading: ProductLoading,
        cell: ({ row }) => {
            const lineItems = row.original.line_items
            const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0)
            const displayItems = lineItems.slice(0, 3)
            const remainingCount = lineItems.length - 3

            return (
                <div className="h-14 flex items-center">
                    <div className="flex -space-x-2">
                        {displayItems.map((item, index) => (
                            <HoverCard key={item.id}>
                                <HoverCardTrigger>
                                    <div
                                        className="relative"
                                        style={{ zIndex: displayItems.length - index }}
                                    >
                                        <img
                                            src={item.sku.product.image_url}
                                            alt={item.sku.product.name}
                                            className="h-16 object-contain rounded-md"
                                        />
                                        <Badge
                                            variant="default"
                                            className="absolute -top-2 -right-2 h-4 min-w-4 p-1 flex items-center justify-center"
                                        >
                                            {item.quantity}
                                        </Badge>
                                    </div>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                    <ProductDisplay sku={item.sku} />
                                </HoverCardContent>
                            </HoverCard>
                        ))}
                    </div>
                    {remainingCount > 0 && (
                        <Avatar>
                            <AvatarFallback> +{remainingCount}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
            )
        }
    },
    {
        id: "transaction_comment",
        header: "Comment",
        loading: DefaultLoading,
        cell: ({ row }) => (
            <div className="font-medium">
                {row.original.comment ? row.original.comment : <span className="text-gray-500 italic">None</span>}
            </div>
        )
    },
]

export function TransactionTable() {
    const { data, isLoading } = useTransactions()
    const router = useRouter()

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={data?.transactions ?? []}
                loading={isLoading}
                onRowClick={(row) => {
                    router.push(`/transactions/${row.original.id}`)
                }}
            />
        </div>
    )
} 