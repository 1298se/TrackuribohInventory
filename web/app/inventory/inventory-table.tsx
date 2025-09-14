import { DataTable } from "../../components/data-table";
import { InventoryItemResponse } from "../../features/market/schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Column } from "../../components/data-table";
import { SKUDisplay } from "@/components/sku-display";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { SparklineChart } from "@/components/sparkline-chart";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const SparklineCell = ({
  inventoryItem,
}: {
  inventoryItem: InventoryItemResponse;
}) => {
  return (
    <SparklineChart
      data={inventoryItem.price_history_7d || []}
      isLoading={false}
    />
  );
};

export const columns: Column<InventoryItemResponse, any>[] = [
  {
    accessorKey: "sku.product.name",
    header: "Product",
    size: 400,
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
      return <div className="font-medium text-right">${amount}</div>;
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
      return <div className="font-medium text-right">$amount</div>;
    },
  },
  {
    id: "price_chart_7d",
    header: "7-Day Change",
    align: "right",
    cell: ({ row }) => {
      return <SparklineCell inventoryItem={row.original} />;
    },
  },
  {
    id: "price_chart_sparkline",
    header: "",
    align: "right",
    cell: ({ row }) => {
      const inventoryItem = row.original;
      const data = inventoryItem.price_history_7d || [];

      if (!data || data.length === 0) {
        return <div className="w-24 h-8 ml-auto" />;
      }

      const chartData = data.map((item, index) => ({
        index,
        price: item.price.amount,
      }));

      const firstPrice = data[0]?.price?.amount || 0;
      const lastPrice = data[data.length - 1]?.price?.amount || 0;
      const absoluteChange = lastPrice - firstPrice;
      const isPositive = absoluteChange > 0;
      const isNegative = absoluteChange < 0;
      const lineColor = isPositive
        ? "#16a34a"
        : isNegative
        ? "#dc2626"
        : "#6b7280";

      return (
        <div className="w-24 h-8 ml-auto">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
              syncId={undefined}
              compact={true}
            >
              <Line
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    },
  },
  {
    id: "unrealized_profit",
    header: "Unrealized P&L",
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
            isPositive ? "text-green-600" : isNegative ? "text-red-600" : ""
          )}
        >
          <div className="flex items-baseline gap-0.5">
            <span>{sign}$</span>
            <span className="tabular-nums">{formattedNumber}</span>
          </div>
          <span className="text-sm tabular-nums">
            <span>{sign}</span>
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
      <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
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
