import { CellContext, ColumnDef } from "@tanstack/react-table";
import { useInventory } from "./api";
import { DataTable } from "../../components/data-table";
import { InventoryItemResponse } from "./schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package2,
  AlertCircle,
  Triangle,
  TriangleAlert,
  Minus,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn, formatCurrencyNumber } from "@/lib/utils";
import { type Column } from "../../components/data-table";
import { SKUDisplay } from "@/components/sku-display";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventoryCatalogs } from "./api";
import { PortfolioValueChart } from "./portfolio-value-chart";
import { SearchInput } from "@/components/search-input";

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />;
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
);

export const columns: Column<InventoryItemResponse, any>[] = [
  {
    accessorKey: "sku.product.image_url",
    header: "Image",
    loading: ImageLoading,
    cell: ({ row }) => {
      const imageUrl = row.original.sku.product.image_url;

      return (
        <div className="h-16 w-16">
          <img
            src={imageUrl}
            alt={row.original.sku.product.name}
            className="h-full w-full object-contain rounded-md"
          />
        </div>
      );
    },
  },
  {
    accessorKey: "sku.product.name",
    header: "Product",
    loading: ProductLoading,
    cell: ({ row }) => {
      return <SKUDisplay sku={row.original.sku} />;
    },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    align: "right",
    cell: ({ row }) => {
      return (
        <div className="font-medium tabular-nums text-right">
          {row.getValue("quantity")}
        </div>
      );
    },
  },
  {
    accessorKey: "cost_per_item.amount",
    header: "Avg. Cost",
    align: "right",
    cell: ({ row }) => {
      const amount = row.original.average_cost_per_item.amount;
      return (
        <div className="font-medium text-right">
          ${formatCurrencyNumber(amount)}
        </div>
      );
    },
  },
  {
    accessorKey: "lowest_listing_price.amount",
    header: "Market Price",
    align: "right",
    cell: ({ row }) => {
      const lowestListingPrice = row.original.lowest_listing_price;
      if (!lowestListingPrice) {
        return <div className="text-muted-foreground text-right">N/A</div>;
      }

      const amount = lowestListingPrice.amount;
      return (
        <div className="font-medium text-right">
          ${formatCurrencyNumber(amount)}
        </div>
      );
    },
  },
  {
    accessorKey: "price_change_24h_amount.amount",
    header: "24h Change",
    align: "right",
    cell: ({ row }) => {
      const changeAmount = row.original.price_change_24h_amount;
      const changePercentage = row.original.price_change_24h_percentage;

      if (!changeAmount || changePercentage === null) {
        return <div className="text-muted-foreground text-right">N/A</div>;
      }

      const amount = changeAmount.amount;

      // Show "—" for zero change
      if (changePercentage === 0) {
        return (
          <div className="text-muted-foreground flex items-center justify-end gap-1">
            <Minus className="h-3 w-3" />
            <span>—</span>
          </div>
        );
      }

      const formattedNumber = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: "never",
      }).format(Math.abs(amount));

      const formattedPercentage = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "never",
      }).format(Math.abs(changePercentage));

      const isPositive = amount > 0;
      const isNegative = amount < 0;
      const sign = isPositive ? "+" : "-";

      return (
        <div
          className={cn(
            "font-medium flex items-center justify-end gap-1",
            isPositive
              ? "text-green-600"
              : isNegative
                ? "text-red-600"
                : "text-muted-foreground",
          )}
        >
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs">{sign}$</span>
              <span className="tabular-nums">{formattedNumber}</span>
            </div>
            <span className="text-sm tabular-nums">
              <span className="text-xs">{sign}</span>
              {formattedPercentage}%
            </span>
          </div>
          {isPositive ? (
            <Triangle className="h-3 w-3 flex-shrink-0 fill-current" />
          ) : (
            <Triangle className="h-3 w-3 flex-shrink-0 rotate-180 fill-current" />
          )}
        </div>
      );
    },
  },
  {
    id: "unrealized_profit",
    header: "Unrealized Profit",
    align: "right",
    cell: ({ row }) => {
      const lowestListingPrice = row.original.lowest_listing_price;
      if (!lowestListingPrice) {
        return <div className="text-muted-foreground text-right">N/A</div>;
      }

      const listingAmount = lowestListingPrice.amount;
      const costAmount = row.original.average_cost_per_item.amount;
      const quantity = row.original.quantity;

      const profit = (listingAmount - costAmount) * quantity;
      const percentageGain = ((listingAmount - costAmount) / costAmount) * 100;

      const formattedNumber = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(profit));

      const percentFormatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "never",
      }).format(Math.abs(percentageGain));

      const isPositive = profit > 0;
      const isNegative = profit < 0;
      const sign = isPositive ? "+" : "-";

      return (
        <div
          className={cn(
            "font-medium flex flex-col items-end",
            isPositive ? "text-green-600" : isNegative ? "text-red-600" : "",
          )}
        >
          <div className="flex items-baseline gap-0.5">
            <span className="text-xs">{sign}$</span>
            <span className="tabular-nums">{formattedNumber}</span>
          </div>
          <span className="text-sm tabular-nums">
            <span className="text-xs">{sign}</span>
            {percentFormatted}%
          </span>
        </div>
      );
    },
  },
];

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function InventoryTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get initial query and catalog from URL or default to empty/null
  const initialQuery = searchParams.get("q") || "";
  const initialCatalogId = searchParams.get("catalog_id");

  const [selectedCatalogId, setSelectedCatalogId] = useState(initialCatalogId);

  // Fetch catalogs for Tabs
  const { data: catalogsData, isLoading: catalogsLoading } =
    useInventoryCatalogs();

  // Fetch inventory data based on selected catalog
  const { data, isLoading, error } = useInventory(
    initialQuery,
    selectedCatalogId,
  );

  // Sync selectedCatalogId when URL param changes (e.g., via back/forward)
  useEffect(() => {
    if (initialCatalogId !== selectedCatalogId) {
      setSelectedCatalogId(initialCatalogId);
    }
  }, [initialCatalogId]);

  // Handler to update URL when filter is submitted via DataTable
  const handleFilterSubmit = useCallback(
    (query: string) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      if (!query) {
        current.delete("q");
      } else {
        current.set("q", query);
      }
      const search = current.toString();
      const queryStr = search ? `?${search}` : "";
      router.replace(`${pathname}${queryStr}`);
    },
    [router, searchParams, pathname],
  );

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
    [router, searchParams, pathname],
  );

  // Handle potential error state from useInventory
  if (error) {
    return (
      <ErrorState message={error.message || "Failed to load inventory."} />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Portfolio Value with Chart */}
      <PortfolioValueChart catalogId={selectedCatalogId} />

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

      {/* Search filter input under tabs */}
      <SearchInput
        placeholder="Search by name, set, rarity..."
        initialValue={initialQuery}
        onSubmit={handleFilterSubmit}
        className="w-full max-w-md"
      />

      {/* DataTable is now rendered unconditionally */}
      <DataTable
        columns={columns}
        data={data?.inventory_items ?? []}
        loading={isLoading}
        onRowClick={(row) => router.push(`/inventory/${row.original.sku.id}`)}
      />
    </div>
  );
}
