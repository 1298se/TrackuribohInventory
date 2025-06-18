import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
  RowSelectionState,
  OnChangeFn,
  ColumnFiltersState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SearchInput } from "./search-input";

export type Column<TData, TValue> = ColumnDef<TData, TValue> & {
  loading?: React.ComponentType;
  align?: "left" | "center" | "right";
};

interface DataTableProps<TData, TValue> {
  columns: Column<TData, TValue>[];
  data: TData[];
  rowSelectionProps?: RowSelectionProps<TData>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  loading?: boolean;
  onRowClick?: (row: Row<TData>) => void;
  getRowId?: (row: TData) => string;
}

interface RowSelectionProps<TData> {
  enableRowSelection?: boolean;
  rowSelectionState?: RowSelectionState;
  onRowSelectionStateChange?: OnChangeFn<RowSelectionState>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowSelectionProps,
  columnFilters,
  onColumnFiltersChange,
  loading = false,
  onRowClick,
  getRowId,
}: DataTableProps<TData, TValue>) {
  // Set up table with manual filtering
  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection: rowSelectionProps?.rowSelectionState,
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: rowSelectionProps?.enableRowSelection,
    onRowSelectionChange: rowSelectionProps?.onRowSelectionStateChange,
    onColumnFiltersChange,
    getRowId: getRowId,
    // Enable manual filtering for server-side filtering
    manualFiltering: true,
  });

  return (
    <div className="w-full h-full">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = (
                    header.column.columnDef as Column<TData, TValue>
                  ).align;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        align === "center" && "text-center",
                        align === "right" && "text-right pr-4",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={columnIndex}
                      className={cn(
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right pr-4",
                      )}
                    >
                      {column.loading ? (
                        <column.loading />
                      ) : (
                        <div
                          className={cn(
                            column.align === "center" && "flex justify-center",
                            column.align === "right" && "flex justify-end",
                          )}
                        >
                          <Skeleton className="h-4 w-24" />
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  {...(rowSelectionProps?.enableRowSelection
                    ? { "data-state": row.getIsSelected() && "selected" }
                    : {})}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted")}
                  onClick={() => onRowClick?.(row)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (
                      cell.column.columnDef as Column<TData, TValue>
                    ).align;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          align === "center" && "text-center",
                          align === "right" && "text-right pr-4",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
