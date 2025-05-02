import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
  RowSelectionState,
  OnChangeFn,
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
};

interface DataTableProps<TData, TValue> {
  columns: Column<TData, TValue>[];
  data: TData[];
  rowSelectionProps?: RowSelectionProps<TData>;
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
    },
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: rowSelectionProps?.enableRowSelection,
    onRowSelectionChange: rowSelectionProps?.onRowSelectionStateChange,
    getRowId: getRowId,
    // Enable manual filtering for server-side filtering
    manualFiltering: true,
  });

  return (
    <div className="w-full h-full">
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column, columnIndex) => (
                    <TableCell key={columnIndex}>
                      {column.loading ? (
                        <column.loading />
                      ) : (
                        <Skeleton className="h-4 w-24" />
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
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
