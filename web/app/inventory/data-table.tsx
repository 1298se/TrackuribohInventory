import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { KeyboardEvent, useState } from "react"

export type Column<TData, TValue> = ColumnDef<TData, TValue> & {
  loading?: React.ComponentType;
}

interface DataTableProps<TData, TValue> {
  columns: Column<TData, TValue>[]
  data: TData[]
  rowSelectionProps?: RowSelectionProps<TData>
  loading?: boolean
  onRowClick?: (row: Row<TData>) => void
  getRowId?: (row: TData) => string
  filterProps?: FilterProps
}

interface RowSelectionProps<TData> {
  enableRowSelection?: boolean
  rowSelectionState?: RowSelectionState,
  onRowSelectionStateChange?: OnChangeFn<RowSelectionState>
}

/**
 * Props for configuring the filtering behavior of the DataTable
 */
interface FilterProps {
  /** 
   * Customizes the placeholder text in the search input field.
   * @default "Filter..."
   */
  placeholder?: string;
  
  /** 
   * The current value of the filter input, controlled by the parent component. 
   */
  inputValue?: string;

  /**
   * Callback function triggered when the filter input value changes.
   * @param value The new value of the input.
   */
  onInputChange?: (value: string) => void;
  
  /** 
   * Callback function triggered when the filter is submitted (e.g., Enter key press).
   * This is where you should implement your server-side filtering logic.
   * @param query The current filter query string
   */
  onFilterSubmit?: (query: string) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowSelectionProps,
  loading = false,
  onRowClick,
  getRowId,
  filterProps,
}: DataTableProps<TData, TValue>) {
  // Only apply defaults if filterProps is provided
  const {
    placeholder = "Filter...",
    inputValue,
    onInputChange,
    onFilterSubmit,
  } = filterProps || {};
  
  // Local state for input is removed, now controlled by parent via props.
  
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
  })

  // Handler for key down event on filter input
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filterProps && onFilterSubmit) {
      // Use the controlled inputValue from props
      onFilterSubmit(inputValue ?? "");
    }
  };

  return (
    <div className="w-full h-full">
      {filterProps && (
        <div className="flex items-center py-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              // Use controlled input value and onChange handler from props
              value={inputValue ?? ""}
              onChange={(e) => filterProps?.onInputChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8 w-full"
            />
          </div>
        </div>
      )}
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
                          header.getContext()
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
