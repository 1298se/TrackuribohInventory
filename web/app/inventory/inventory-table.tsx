import { CellContext, ColumnDef } from "@tanstack/react-table"
import { useInventory } from "./api"
import { DataTable  } from "../../components/data-table"
import { InventoryItemResponse } from "./schemas"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Package2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { type Column } from "../../components/data-table"
import { SKUDisplay } from "@/components/ui/sku-display"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect, useCallback, useState } from "react"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useInventoryCatalogs } from "./api"

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
        accessorKey: "cost_per_item.amount",
        header: "Average Cost",
        loading: DefaultLoading,
        cell: ({ row }) => {
            const amount = row.original.average_cost_per_item.amount
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: row.original.average_cost_per_item.currency,
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

            const amount = lowestListingPrice.amount
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

            const listingAmount = lowestListingPrice.amount
            const costAmount = row.original.average_cost_per_item.amount
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

export function InventoryTable() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Get initial query and catalog from URL or default to empty/null
    const initialQuery = searchParams.get('q') || "";
    const initialCatalogId = searchParams.get('catalog_id');

    const [selectedCatalogId, setSelectedCatalogId] = useState(initialCatalogId);

    // Fetch catalogs for Tabs
    const { data: catalogsData, isLoading: catalogsLoading } = useInventoryCatalogs();

    // Fetch inventory data based on selected catalog
    const { data, isLoading, error } = useInventory(initialQuery, selectedCatalogId);

    // Sync selectedCatalogId when URL param changes (e.g., via back/forward)
    useEffect(() => {
      if (initialCatalogId !== selectedCatalogId) {
        setSelectedCatalogId(initialCatalogId);
      }
    }, [initialCatalogId]);

    // Handler to update URL when filter is submitted via DataTable
    const handleFilterSubmit = useCallback((query: string) => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        if (!query) {
            current.delete('q');
        } else {
            current.set('q', query);
        }
        const search = current.toString();
        const queryStr = search ? `?${search}` : "";
        router.replace(`${pathname}${queryStr}`);
    }, [router, searchParams, pathname]);

    // Handler for catalog tab change
    const handleCatalogChange = useCallback(
      (value: string) => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        if (value === "all") {
          current.delete("catalog_id");
          setSelectedCatalogId(null);
        } else {
          current.set("catalog_id", value);
          setSelectedCatalogId(value);
        }
        const search = current.toString();
        const queryStr = search ? `?${search}` : "";
        router.replace(`${pathname}${queryStr}`);
      },
      [router, searchParams, pathname]
    );

    // Handle potential error state from useInventory
    if (error) {
        return <ErrorState message={error.message || "Failed to load inventory."} />
    }

    const filterProps = {
        placeholder: "Search by name, set, rarity...",
        // Change inputValue to initialValue
        initialValue: initialQuery,
        // Remove onInputChange
        onFilterSubmit: handleFilterSubmit,
    };

    return (
        <div className="space-y-4">
             {/* Catalog Tabs */}
             <div className="flex items-center">
               {catalogsLoading ? (
                 <Skeleton className="h-10 w-[250px]" />
               ) : (
                 <Tabs
                   value={selectedCatalogId || "all"}
                   onValueChange={handleCatalogChange}
                 >
                   <TabsList>
                     <TabsTrigger value="all">All</TabsTrigger>
                     {catalogsData?.catalogs.map((catalog) => (
                       <TabsTrigger key={catalog.id} value={catalog.id}>
                         {catalog.display_name}
                       </TabsTrigger>
                     ))}
                   </TabsList>
                 </Tabs>
               )}
             </div>

             {/* DataTable is now rendered unconditionally */}
             <DataTable 
                columns={columns} 
                data={data?.inventory_items ?? []}
                loading={isLoading}
                filterProps={filterProps} // Pass filter props
                onRowClick={(row) => router.push(`/inventory/${row.original.sku.id}`)}
             />
        </div>
    )
}