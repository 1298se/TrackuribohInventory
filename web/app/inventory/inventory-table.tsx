import { ColumnDef } from "@tanstack/react-table";
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
import { Warehouse, Minus, Triangle } from "lucide-react";
import { cn, formatCurrencyNumber } from "@/lib/utils";
import { type Column } from "../../components/data-table";
import { SKUDisplay } from "@/components/sku-display";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />;
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
);
const DefaultLoading = () => <Skeleton className="h-4 w-24" />;

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
    loading: DefaultLoading,
    cell: ({ row }) => {
      return (
        <div className="font-medium text-right tabular-nums">
          {row.getValue("quantity")}
        </div>
      );
    },
  },
  {
    accessorKey: "average_cost_per_item.amount",
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

interface InventoryTableProps {
  initialQuery: string;
  handleFilterSubmit: (query: string) => void;
  data?: any;
  isLoading: boolean;
}

export function InventoryTable({
  initialQuery,
  handleFilterSubmit,
  data,
  isLoading,
}: InventoryTableProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Warehouse className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-xl font-semibold">
                  Inventory Details
                </CardTitle>
                {!isLoading && data?.inventory_items && (
                  <span className="text-lg font-medium text-muted-foreground tabular-nums">
                    {data.inventory_items.length} items
                  </span>
                )}
              </div>
              <CardDescription className="text-sm">
                Browse your complete inventory
              </CardDescription>
            </div>
          </div>
          <SearchInput
            placeholder="Search by name, set, rarity..."
            initialValue={initialQuery}
            onSubmit={handleFilterSubmit}
            className="w-full max-w-md"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={data?.inventory_items ?? []}
          loading={isLoading}
          onRowClick={(row) => router.push(`/inventory/${row.original.sku.id}`)}
        />
      </CardContent>
    </Card>
  );
}
