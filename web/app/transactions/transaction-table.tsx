import { DataTable } from "../../components/data-table";
import {
  TransactionResponse,
  TransactionFilter,
  TransactionFilterOptionsResponse,
} from "./schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type Column } from "../../components/data-table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SKUDisplay } from "@/components/sku-display";
import { ProductImage } from "@/components/ui/product-image";
import { useState } from "react";
import { RowSelectionState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { FixedFooter } from "@/components/ui/fixed-footer";
import { TableColumnHeader } from "@/components/table-column-header";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Label } from "@/components/ui/label";
import { Checkbox as FilterCheckbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListFilter } from "lucide-react";

const DefaultLoading = () => <Skeleton className="h-4 w-24" />;
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
);

// Add props interface
export interface TransactionTableProps {
  transactions: TransactionResponse[];
  loading: boolean;
  onRowClick: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void | Promise<void>;
  filters?: TransactionFilter;
  onFiltersChange?: (updates: Partial<TransactionFilter>) => void;
  filterOptions?: TransactionFilterOptionsResponse | null;
}

export function TransactionTable({
  transactions,
  loading,
  onRowClick,
  onDeleteSelected,
  filters,
  onFiltersChange,
  filterOptions,
}: TransactionTableProps) {
  // State for row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Create column definitions
  const columns: Column<TransactionResponse, any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          onClick={(e) => e.stopPropagation()}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      loading: () => <Checkbox disabled aria-label="Select row loading" />,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "date",
      accessorKey: "date",
      enableSorting: false,
      header: () => (
        <TableColumnHeader
          title="Date"
          filterContent={
            onFiltersChange && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date-start">Start Date</Label>
                  <DatePickerInput
                    value={
                      filters?.date_start
                        ? new Date(filters.date_start)
                        : undefined
                    }
                    onChange={(date: Date | undefined) => {
                      onFiltersChange({
                        date_start: date
                          ? date.toISOString().split("T")[0]
                          : undefined,
                      });
                    }}
                    placeholder="Pick a date"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-end">End Date</Label>
                  <DatePickerInput
                    value={
                      filters?.date_end ? new Date(filters.date_end) : undefined
                    }
                    onChange={(date: Date | undefined) => {
                      onFiltersChange({
                        date_end: date
                          ? date.toISOString().split("T")[0]
                          : undefined,
                      });
                    }}
                    placeholder="Pick a date"
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onFiltersChange({
                        date_start: undefined,
                        date_end: undefined,
                      });
                    }}
                    className="h-8 px-2 lg:px-3"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )
          }
        />
      ),
      loading: DefaultLoading,
      cell: ({ row }) => {
        return (
          <div className="font-medium whitespace-nowrap">
            {format(row.original.date, "MMM d, yyyy")}
          </div>
        );
      },
    },
    {
      accessorKey: "counterparty_name",
      header: "Counterparty",
      loading: DefaultLoading,
      cell: ({ row }) => {
        return (
          <div className="font-medium">{row.original.counterparty_name}</div>
        );
      },
    },
    {
      id: "type",
      accessorKey: "type",
      enableSorting: false,
      header: () => {
        const [filterOpen, setFilterOpen] = useState(false);

        const handleOptionClick = (
          value: string | undefined,
          event: React.MouseEvent,
        ) => {
          event.stopPropagation();
          if (onFiltersChange) {
            onFiltersChange({
              types: value ? [value as "PURCHASE" | "SALE"] : undefined,
            });
          }
          setFilterOpen(false);
        };

        const currentValue = filters?.types?.[0];

        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Type</span>
            {onFiltersChange && (
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-7 w-7 p-0">
                    <ListFilter className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1">
                    <div
                      className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={(e) => handleOptionClick(undefined, e)}
                    >
                      <span className="text-sm">All</span>
                      {!currentValue && (
                        <span className="text-xs text-muted-foreground">✓</span>
                      )}
                    </div>
                    <div
                      className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={(e) => handleOptionClick("PURCHASE", e)}
                    >
                      <span className="text-sm">Purchase</span>
                      {currentValue === "PURCHASE" && (
                        <span className="text-xs text-muted-foreground">✓</span>
                      )}
                    </div>
                    <div
                      className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={(e) => handleOptionClick("SALE", e)}
                    >
                      <span className="text-sm">Sale</span>
                      {currentValue === "SALE" && (
                        <span className="text-xs text-muted-foreground">✓</span>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      },
      loading: DefaultLoading,
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <div
            className={cn(
              "font-medium",
              type === "PURCHASE" ? "text-blue-600" : "text-green-600",
            )}
          >
            {type}
          </div>
        );
      },
    },
    {
      id: "platform",
      accessorKey: "platform",
      enableSorting: false,
      header: () => {
        const [filterOpen, setFilterOpen] = useState(false);

        // Local state for platform selections (only applied on "Apply")
        const [localPlatformIds, setLocalPlatformIds] = useState<string[]>(
          filters?.platform_ids || [],
        );
        const [localIncludeNoPlatform, setLocalIncludeNoPlatform] = useState(
          filters?.include_no_platform || false,
        );

        // Reset local state when popover opens
        const handleOpenChange = (open: boolean) => {
          if (open) {
            setLocalPlatformIds(filters?.platform_ids || []);
            setLocalIncludeNoPlatform(filters?.include_no_platform || false);
          }
          setFilterOpen(open);
        };

        const handlePlatformToggle = (platformId: string, checked: boolean) => {
          setLocalPlatformIds((prev) =>
            checked
              ? [...prev, platformId]
              : prev.filter((id) => id !== platformId),
          );
        };

        const handleApply = () => {
          if (!onFiltersChange) return;

          onFiltersChange({
            platform_ids:
              localPlatformIds.length > 0 ? localPlatformIds : undefined,
            include_no_platform: localIncludeNoPlatform || false,
          });
          setFilterOpen(false);
        };

        const handleCancel = () => {
          // Reset to current filter values
          setLocalPlatformIds(filters?.platform_ids || []);
          setLocalIncludeNoPlatform(filters?.include_no_platform || false);
          setFilterOpen(false);
        };

        const handleClearAll = () => {
          setLocalPlatformIds([]);
          setLocalIncludeNoPlatform(false);
        };

        // Count for display
        const currentSelectedCount =
          (filters?.platform_ids?.length || 0) +
          (filters?.include_no_platform ? 1 : 0);
        const localSelectedCount =
          localPlatformIds.length + (localIncludeNoPlatform ? 1 : 0);

        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Platform</span>
            {onFiltersChange && (
              <Popover open={filterOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-7 w-7 p-0">
                    <ListFilter className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  {!filterOptions ? (
                    // Loading state
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-3/4" />
                      </div>
                      <div className="border-t pt-3 flex gap-2">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 flex-1" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 space-y-3">
                        {/* Header with clear button */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Filter by Platform
                          </span>
                          {localSelectedCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleClearAll}
                              className="h-7 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          )}
                        </div>

                        {/* Platform options */}
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {filterOptions.platforms.map((platform) => {
                            const isChecked = localPlatformIds.includes(
                              platform.id,
                            );

                            return (
                              <div
                                key={platform.id}
                                className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlatformToggle(platform.id, !isChecked);
                                }}
                              >
                                <FilterCheckbox
                                  id={platform.id}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    handlePlatformToggle(
                                      platform.id,
                                      !!checked,
                                    );
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm flex-1">
                                  {platform.name}
                                </span>
                              </div>
                            );
                          })}

                          {/* No platform option */}
                          <div
                            className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocalIncludeNoPlatform(
                                !localIncludeNoPlatform,
                              );
                            }}
                          >
                            <FilterCheckbox
                              id="no-platform"
                              checked={localIncludeNoPlatform}
                              onCheckedChange={(checked) => {
                                setLocalIncludeNoPlatform(!!checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm flex-1 text-muted-foreground">
                              No platform
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="border-t p-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApply}
                          className="flex-1"
                        >
                          Apply
                        </Button>
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      },
      loading: DefaultLoading,
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.platform ? (
            row.original.platform.name
          ) : (
            <span className="text-gray-500 italic">None</span>
          )}
        </div>
      ),
    },
    {
      id: "subtotal_amount",
      accessorKey: "subtotal_amount",
      enableSorting: false,
      header: () => (
        <TableColumnHeader
          title="Total"
          filterContent={
            onFiltersChange && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="min">Minimum Amount</Label>
                  <Input
                    id="min"
                    type="number"
                    placeholder="0.00"
                    value={filters?.amount_min || ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? Number(e.target.value)
                        : undefined;
                      onFiltersChange({ amount_min: val });
                    }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max">Maximum Amount</Label>
                  <Input
                    id="max"
                    type="number"
                    placeholder="0.00"
                    value={filters?.amount_max || ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? Number(e.target.value)
                        : undefined;
                      onFiltersChange({ amount_max: val });
                    }}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onFiltersChange({
                        amount_min: undefined,
                        amount_max: undefined,
                      });
                    }}
                    className="h-8 px-2 lg:px-3"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )
          }
        />
      ),
      loading: DefaultLoading,
      cell: ({ row }) => {
        const lineItems = row.original.line_items;
        const totalAmount = lineItems.reduce((sum, item) => {
          const amount = item.unit_price_amount;
          return sum + amount * item.quantity;
        }, 0);

        return (
          <div className="font-medium">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: row.original.currency,
            }).format(totalAmount)}
          </div>
        );
      },
    },
    {
      accessorKey: "line_items",
      header: "Items",
      loading: ProductLoading,
      cell: ({ row }) => {
        const lineItems = row.original.line_items;
        const displayItems = lineItems.slice(0, 3);
        const remainingCount = lineItems.length - 3;

        return (
          <div className="h-14 flex items-center">
            <div className="flex -space-x-2">
              {displayItems.map((item, index) => (
                <HoverCard key={item.id + "-" + index}>
                  <HoverCardTrigger>
                    <div
                      className="relative"
                      style={{ zIndex: displayItems.length - index }}
                    >
                      <ProductImage
                        src={item.sku.product.image_url}
                        alt={item.sku.product.name}
                        containerClassName="h-16"
                      />
                      <Badge
                        variant="default"
                        className="absolute top-0 right-0 h-4 min-w-4 p-1 flex items-center justify-center translate-x-1 -translate-y-1/2"
                      >
                        {item.quantity}
                      </Badge>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <SKUDisplay sku={item.sku} />
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
            {remainingCount > 0 && (
              <Avatar>
                <AvatarFallback>+{remainingCount}</AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      },
    },
    {
      id: "transaction_comment",
      header: "Comment",
      loading: DefaultLoading,
      cell: ({ row }) => (
        <div className="font-medium max-w-[400px] truncate">
          {row.original.comment ? (
            row.original.comment
          ) : (
            <span className="text-gray-500 italic">None</span>
          )}
        </div>
      ),
    },
  ];

  // Compute selected IDs and count
  const selectedIds = Object.keys(rowSelection).filter(
    (key) => rowSelection[key],
  );
  const selectedCount = selectedIds.length;

  // handler to bulk delete the selected transactions
  const handleBulkDelete = async () => {
    await onDeleteSelected(selectedIds);
    setRowSelection({});
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="space-y-4 pb-20">
        <DataTable
          columns={columns}
          data={transactions}
          loading={loading}
          rowSelectionProps={{
            enableRowSelection: true,
            rowSelectionState: rowSelection,
            onRowSelectionStateChange: setRowSelection,
          }}
          getRowId={(row) => row.id}
          onRowClick={(row) => onRowClick(row.original.id)}
        />
      </div>

      {/* Fixed footer appears when items are selected */}
      {selectedCount > 0 && (
        <FixedFooter>
          <div className="flex items-center gap-4 w-full">
            <p className="text-sm font-medium flex-1 text-left pl-4">
              {selectedCount}{" "}
              {selectedCount === 1 ? "transaction" : "transactions"} selected
            </p>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="destructive"
              size="default"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </FixedFooter>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transactions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount}{" "}
              {selectedCount === 1 ? "transaction" : "transactions"}? This
              action cannot be undone and will affect your inventory counts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
