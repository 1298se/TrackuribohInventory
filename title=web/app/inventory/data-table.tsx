import { useState } from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

interface DataTableProps<TData, TValue> {
  columns: Column<TData, TValue>[]
  data: TData[]
  loading?: boolean
  onRowClick?: (row: Row<TData>) => void
  // Controlled selection state (optional)
  selectedRowIds?: Record<string, boolean>;
  // Callback when the row selection changes
  onSelectedRowsChange?: (selectedRowIds: Record<string, boolean>) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  onRowClick,
  selectedRowIds,
  onSelectedRowsChange,
}: DataTableProps<TData, TValue>) {
  // Use controlled selection if provided; otherwise, manage it internally.
  const [internalRowSelection, setInternalRowSelection] = useState<Record<string, boolean>>({});
  const stateRowSelection = selectedRowIds ?? internalRowSelection;
  const handleRowSelectionChange = onSelectedRowsChange ?? setInternalRowSelection;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection: stateRowSelection,
    },
    onRowSelectionChange: handleRowSelectionChange,
  })

  return (
    <div className="h-[300px] w-full">
      {table.getRowModel().rows.map(row => (
        <div
          key={row.id}
          className="flex items-center space-x-2"
          onClick={() => onRowClick?.(row)}
        >
          {row.getVisibleCells().map(cell => (
            <div key={cell.id} className="px-2 py-1">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
} 