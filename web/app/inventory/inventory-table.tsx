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
  TrendingUp,
  Package,
  Warehouse,
  Minus,
  Triangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn, formatCurrencyNumber } from "@/lib/utils";
import { type Column } from "../../components/data-table";
import { SKUDisplay } from "@/components/sku-display";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventoryCatalogs, useInventoryMetrics } from "./api";
import { InventoryHistoryGraph } from "./inventory-history-graph";
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

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function formatCurrency(
  amount?: number | null,
  currency: string = "USD",
): string {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function InventoryOverviewSection({
  metricData,
  metricLoading,
}: {
  metricData?: any;
  metricLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Inventory Overview
              </CardTitle>
              <CardDescription className="text-sm">
                Current inventory status and holdings
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Items in Stock
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {metricData?.number_of_items?.toLocaleString() ?? 0}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Cost
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(metricData?.total_inventory_cost)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-muted-foreground">
                Market Value
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(metricData?.total_market_value)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  (metricData?.unrealised_profit ?? 0) >= 0
                    ? "bg-emerald-500"
                    : "bg-red-500",
                )}
              ></div>
              <p className="text-sm font-medium text-muted-foreground">
                Unrealized P&L
              </p>
            </div>
            {metricLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    (metricData?.unrealised_profit ?? 0) >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                  )}
                >
                  {formatCurrency(metricData?.unrealised_profit)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioPerformanceSection({
  selectedCatalogId,
  catalogsData,
  catalogsLoading,
  onCatalogChange,
}: {
  selectedCatalogId: string | null;
  catalogsData?: any;
  catalogsLoading: boolean;
  onCatalogChange: (value: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Portfolio Performance
              </CardTitle>
              <CardDescription className="text-sm">
                Market value trends and historical performance
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {catalogsLoading ? (
              <Skeleton className="h-9 w-[180px]" />
            ) : (
              <Tabs
                value={selectedCatalogId || "all"}
                onValueChange={onCatalogChange}
              >
                <TabsList className="bg-white dark:bg-slate-800">
                  <TabsTrigger value="all" className="text-xs">
                    All
                  </TabsTrigger>
                  {catalogsData?.catalogs.map((catalog: any) => (
                    <TabsTrigger
                      key={catalog.id}
                      value={catalog.id}
                      className="text-xs"
                    >
                      {catalog.display_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <InventoryHistoryGraph catalogId={selectedCatalogId} />
      </CardContent>
    </Card>
  );
}

function InventoryDetailsSection({
  initialQuery,
  handleFilterSubmit,
  data,
  isLoading,
  router,
}: {
  initialQuery: string;
  handleFilterSubmit: (query: string) => void;
  data?: any;
  isLoading: boolean;
  router: any;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Warehouse className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Inventory Details
              </CardTitle>
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

  // Fetch aggregate metrics (does not depend on search query)
  const { data: metricData, isLoading: metricLoading } =
    useInventoryMetrics(selectedCatalogId);

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
    <div className="space-y-8">
      {/* Static Inventory Overview Section */}
      <InventoryOverviewSection
        metricData={metricData}
        metricLoading={metricLoading}
      />

      {/* Portfolio Performance Section */}
      <PortfolioPerformanceSection
        selectedCatalogId={selectedCatalogId}
        catalogsData={catalogsData}
        catalogsLoading={catalogsLoading}
        onCatalogChange={handleCatalogChange}
      />

      {/* Inventory Details Section */}
      <InventoryDetailsSection
        initialQuery={initialQuery}
        handleFilterSubmit={handleFilterSubmit}
        data={data}
        isLoading={isLoading}
        router={router}
      />
    </div>
  );
}
