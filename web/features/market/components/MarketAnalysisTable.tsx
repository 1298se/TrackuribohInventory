"use client";

import * as React from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";
import { Button } from "@/shadcn/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/ui/table";

export const schema = z.object({
  id: z.number(),
  header: z.string(),
});

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    accessorKey: "header",
    header: "Product Name",
    cell: ({ row }) => {
      return row.original.header;
    },
    enableHiding: false,
    size: 300,
    minSize: 300,
    maxSize: 300,
  },
  {
    accessorKey: "marketPrice",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hover:bg-transparent inline-flex items-center gap-1"
        >
          Market Price
          <span className="w-4 h-4 flex items-center justify-center">
            {column.getIsSorted() === "asc" && (
              <IconChevronDown className="h-4 w-4" />
            )}
            {column.getIsSorted() === "desc" && (
              <IconChevronDown className="h-4 w-4 rotate-180" />
            )}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      // Use deterministic value based on row ID to prevent hydration mismatches
      const price = (((row.original.id * 7.3) % 90) + 10).toFixed(2);
      return <div className="font-mono">${price}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const priceA = ((rowA.original.id * 7.3) % 90) + 10;
      const priceB = ((rowB.original.id * 7.3) % 90) + 10;
      return priceA - priceB;
    },
  },
];

const initialData = [
  { id: 1, header: "Cover page" },
  { id: 2, header: "Table of contents" },
  { id: 3, header: "Executive summary" },
  { id: 4, header: "Technical approach" },
  { id: 5, header: "Design" },
  { id: 6, header: "Capabilities" },
  { id: 7, header: "Integration with existing systems" },
  { id: 8, header: "Innovation and Advantages" },
  { id: 9, header: "Overview of EMR's Innovative Solutions" },
  { id: 10, header: "Advanced Algorithms and Machine Learning" },
  { id: 11, header: "Adaptive Communication Protocols" },
  { id: 12, header: "Advantages Over Current Technologies" },
  { id: 13, header: "Past Performance" },
  { id: 14, header: "Customer Feedback and Satisfaction Levels" },
  { id: 15, header: "Implementation Challenges and Solutions" },
  { id: 16, header: "Security Measures and Data Protection Policies" },
  { id: 17, header: "Scalability and Future Proofing" },
  { id: 18, header: "Cost-Benefit Analysis" },
  { id: 19, header: "User Training and Onboarding Experience" },
  { id: 20, header: "Future Development Roadmap" },
  { id: 21, header: "System Architecture Overview" },
  { id: 22, header: "Risk Management Plan" },
  { id: 23, header: "Compliance Documentation" },
  { id: 24, header: "API Documentation" },
  { id: 25, header: "User Interface Mockups" },
  { id: 26, header: "Database Schema" },
  { id: 27, header: "Testing Methodology" },
  { id: 28, header: "Deployment Strategy" },
  { id: 29, header: "Budget Breakdown" },
  { id: 30, header: "Market Analysis" },
  { id: 31, header: "Competitor Comparison" },
  { id: 32, header: "Maintenance Plan" },
  { id: 33, header: "User Personas" },
  { id: 34, header: "Accessibility Compliance" },
  { id: 35, header: "Performance Metrics" },
  { id: 36, header: "Disaster Recovery Plan" },
  { id: 37, header: "Third-party Integrations" },
  { id: 38, header: "User Feedback Summary" },
  { id: 39, header: "Localization Strategy" },
  { id: 40, header: "Mobile Compatibility" },
  { id: 41, header: "Data Migration Plan" },
  { id: 42, header: "Quality Assurance Protocols" },
  { id: 43, header: "Stakeholder Analysis" },
  { id: 44, header: "Environmental Impact Assessment" },
  { id: 45, header: "Intellectual Property Rights" },
  { id: 46, header: "Customer Support Framework" },
  { id: 47, header: "Version Control Strategy" },
  { id: 48, header: "Continuous Integration Pipeline" },
  { id: 49, header: "Regulatory Compliance" },
  { id: 50, header: "User Authentication System" },
  { id: 51, header: "Data Analytics Framework" },
  { id: 52, header: "Cloud Infrastructure" },
  { id: 53, header: "Network Security Measures" },
  { id: 54, header: "Project Timeline" },
  { id: 55, header: "Resource Allocation" },
  { id: 56, header: "Team Structure and Roles" },
  { id: 57, header: "Communication Protocols" },
  { id: 58, header: "Success Metrics" },
  { id: 59, header: "Internationalization Support" },
  { id: 60, header: "Backup and Recovery Procedures" },
  { id: 61, header: "Monitoring and Alerting System" },
  { id: 62, header: "Code Review Guidelines" },
  { id: 63, header: "Documentation Standards" },
  { id: 64, header: "Release Management Process" },
  { id: 65, header: "Feature Prioritization Matrix" },
  { id: 66, header: "Technical Debt Assessment" },
  { id: 67, header: "Capacity Planning" },
  { id: 68, header: "Service Level Agreements" },
];

export function MarketAnalysisTable() {
  const [data, setData] = React.useState(initialData);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "marketPrice", desc: true },
  ]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className="px-6"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-6"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center px-6"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-6">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
