import { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, ListFilter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface TableColumnHeaderProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title: string;
  filterContent?: React.ReactNode;
  className?: string;
  enableSorting?: boolean;
}

export function TableColumnHeader<TData, TValue>({
  column,
  title,
  filterContent,
  className,
  enableSorting = false,
}: TableColumnHeaderProps<TData, TValue>) {
  const [filterOpen, setFilterOpen] = useState(false);

  const isSorted = column?.getIsSorted?.();
  const canSort = enableSorting && column?.getCanSort?.() && column;

  // Reusable sort button component
  const SortButton = () => (
    <Button
      variant="ghost"
      className="h-7 w-7 p-0"
      onClick={() => column!.toggleSorting(column!.getIsSorted() === "asc")}
    >
      {isSorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5" />
      )}
      <span className="sr-only">Sort column</span>
    </Button>
  );

  // Reusable filter button component
  const FilterButton = () => (
    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-7 w-7 p-0">
          <ListFilter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="start"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        {filterContent}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <span className="text-sm font-medium">{title}</span>

      {/* Show both sort and filter buttons when both are available */}
      {canSort && filterContent ? (
        <div className="flex items-center gap-1">
          <SortButton />
          <FilterButton />
        </div>
      ) : (
        <>
          {/* Show only sort button when available */}
          {canSort && <SortButton />}

          {/* Show only filter button when available */}
          {filterContent && <FilterButton />}
        </>
      )}
    </div>
  );
}
