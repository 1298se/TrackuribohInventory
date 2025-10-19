"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";

import { Badge } from "@/shadcn/ui/badge";
import { Button } from "@/shadcn/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/ui/table";
import { formatCurrency } from "@/shared/utils";
import { ProductListingResponse } from "@/features/market/types";
import {
  getConditionColor,
  getConditionDisplayName,
  getConditionRank,
} from "@/features/catalog/utils";
import { TablePaginatedFooter } from "@/shared/components/TablePaginatedFooter";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

const TABLE_HEADERS = [
  { key: "price", label: "Price (USD)" },
  { key: "condition", label: "Condition" },
  { key: "seller", label: "Seller" },
  { key: "actions", label: "Action", sticky: true },
];

const COLUMNS: ColumnDef<ProductListingResponse>[] = [
  {
    accessorKey: "price",
    header: "Price (USD)",
    cell: ({ row }) => {
      const listing = row.original;
      return (
        <div className="flex flex-col">
          <div className="font-medium">{formatCurrency(listing.price)}</div>
          <div className="text-xs text-muted-foreground font-normal">
            {listing.shipping_price
              ? (() => {
                  return listing.shipping_price === 0
                    ? "Free shipping"
                    : `+${formatCurrency(listing.shipping_price)} shipping`;
                })()
              : "Free shipping"}
          </div>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      return rowA.original.price - rowB.original.price;
    },
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => {
      const condition = row.original.sku.condition.name;

      return (
        <div className="w-32">
          <Badge
            variant="outline"
            className="text-muted-foreground px-1.5 font-normal text-xs"
          >
            <div
              className={`w-2 h-2 rounded-full ${getConditionColor(
                condition
              )} mr-2`}
            />
            {getConditionDisplayName(condition)}
          </Badge>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const rankA = getConditionRank(rowA.original.sku.condition.name);
      const rankB = getConditionRank(rowB.original.sku.condition.name);
      return rankA - rankB;
    },
  },
  {
    accessorKey: "seller_name",
    header: "Seller",
    cell: ({ row }) => {
      const listing = row.original;

      return (
        <div className="flex flex-col">
          <div className="font-medium">{listing.seller_name}</div>
          <div className="font-mono text-xs text-muted-foreground">
            TCG: {listing.listing_id}
          </div>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const listing = row.original;
      const purchaseUrl = generatePurchaseUrl(listing);
      return (
        <Button variant="outline" size="sm">
          <a
            href={purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="w-2 h-2 mr-2" />
            Purchase
          </a>
        </Button>
      );
    },
    enableSorting: false,
  },
];

export function MarketListingsTable({
  listings,
}: {
  listings: ProductListingResponse[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "condition", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data: listings,
    columns: COLUMNS,
    state: {
      sorting,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <TableContainer>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`px-6 ${
                        header.column.id === "actions" && "sticky right-0 w-32"
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span className="text-xs text-muted-foreground">
                              {header.column.getIsSorted() === "asc" ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronsUpDown className="h-3 w-3 opacity-50" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const listing = row.original;
                const purchaseUrl = generatePurchaseUrl(listing);

                return (
                  <TableRow
                    key={row.id}
                    onClick={() =>
                      window.open(purchaseUrl, "_blank", "noopener,noreferrer")
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isActionColumn = cell.column.id === "actions";

                      return (
                        <TableCell
                          key={cell.id}
                          className={`px-6 ${
                            isActionColumn && "sticky right-0 w-32"
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length}
                  className="h-24 text-center"
                >
                  No results
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePaginatedFooter table={table} pageSizeOptions={PAGE_SIZE_OPTIONS} />
    </div>
  );
}

export function MarketListingsTableLoading() {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            {TABLE_HEADERS.map((header) => (
              <TableHead
                key={header.key}
                className={`px-6 ${header.sticky ? "sticky right-0 w-32" : ""}`}
              >
                {header.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonRow key={index} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell className="px-6">
        <div className="flex flex-col space-y-2">
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell className="px-6">
        <div className="w-32">
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell className="px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell className="px-6">
        <div className="h-4 w-8 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell className="px-6 sticky right-0 w-32 bg-background">
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      </TableCell>
    </TableRow>
  );
}

function TableContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border space-y-4 min-h-[550px]">
      {children}
    </div>
  );
}

function generatePurchaseUrl(listing: ProductListingResponse): string {
  let baseUrl = listing.sku.product.tcgplayer_url;
  // Ensure the URL has the proper protocol
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }
  const sellerId = listing.seller_id || listing.listing_id;
  return `${baseUrl}?seller=${sellerId}&page=1&Language=English`;
}
