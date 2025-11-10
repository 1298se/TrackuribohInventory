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
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

import { Badge } from "@/shadcn/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/ui/table";
import { formatCurrency } from "@/shared/utils";
import { ProductSaleResponse } from "@/features/market/types";
import {
  getConditionColor,
  getConditionDisplayName,
  getConditionRank,
} from "@/features/catalog/utils";
import { TablePaginatedFooter } from "@/shared/components/TablePaginatedFooter";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export const SALES_COLUMNS: ColumnDef<ProductSaleResponse>[] = [
  {
    accessorKey: "price",
    header: "Price (USD)",
    cell: ({ row }) => {
      const sale = row.original;
      return (
        <div className="flex flex-col">
          <div className="font-medium">{formatCurrency(sale.price.amount)}</div>
          <div className="text-xs text-muted-foreground font-normal">
            {sale.shipping_price !== null
              ? sale.shipping_price.amount === 0
                ? "Free shipping"
                : `+${formatCurrency(sale.shipping_price.amount)} shipping`
              : "Free shipping"}
          </div>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      return rowA.original.price.amount - rowB.original.price.amount;
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
                condition,
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
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.quantity}</div>;
    },
    enableSorting: false,
  },
  {
    accessorKey: "order_date",
    header: "Sale Date",
    cell: ({ row }) => {
      const orderDate = new Date(row.original.order_date);
      const relativeTime = formatDistanceToNow(orderDate, { addSuffix: true });

      return (
        <div className="flex flex-col">
          <div className="font-medium text-sm">{relativeTime}</div>
          <div className="text-xs text-muted-foreground">
            {orderDate.toLocaleDateString()}
          </div>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.original.order_date).getTime();
      const dateB = new Date(rowB.original.order_date).getTime();
      return dateB - dateA; // Most recent first
    },
  },
];

export function SalesTable({ sales }: { sales: ProductSaleResponse[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "order_date", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data: sales,
    columns: SALES_COLUMNS,
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
                      className="px-6"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
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
                return (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell key={cell.id} className="px-6">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
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
                  colSpan={SALES_COLUMNS.length}
                  className="h-24 text-center"
                >
                  No sales found
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

export function SalesTableLoading() {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-6">Price (USD)</TableHead>
            <TableHead className="px-6">Condition</TableHead>
            <TableHead className="px-6">Quantity</TableHead>
            <TableHead className="px-6">Sale Date</TableHead>
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
        <div className="h-4 w-8 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell className="px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
        </div>
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
