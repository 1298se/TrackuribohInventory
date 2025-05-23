import { DataTable } from "../../components/data-table";
import { TransactionResponse } from "./schemas";
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

const DefaultLoading = () => <Skeleton className="h-4 w-24" />;
const ProductLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
);

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
    // For the selection column, we want to avoid showing a generic skeleton while loading.
    // Instead, we render a disabled checkbox so that the UI remains consistent.
    loading: () => <Checkbox disabled aria-label="Select row loading" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: () => <div className="whitespace-nowrap">Date</div>,
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
    accessorKey: "type",
    header: "Type",
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
    accessorKey: "platform",
    header: "Platform",
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
    accessorKey: "subtotal_amount",
    header: "Total",
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

// Add props interface
export interface TransactionTableProps {
  transactions: TransactionResponse[];
  loading: boolean;
  onRowClick: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void | Promise<void>;
}

export function TransactionTable({
  transactions,
  loading,
  onRowClick,
  onDeleteSelected,
}: TransactionTableProps) {
  // State for row selection remains the same
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Use controlled props
  const data = { transactions };
  const isLoading = loading;

  // handler to bulk delete the selected transactions using rowSelection state
  const handleBulkDelete = () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (key) => rowSelection[key],
    );
    if (selectedIds.length === 0) return;
    onDeleteSelected(selectedIds);
    setRowSelection({});
  };

  // Compute the count of selected rows from rowSelection
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {/* Header removed; title managed by SiteHeader */}
        <Button
          onClick={handleBulkDelete}
          disabled={selectedCount === 0}
          variant="destructive"
        >
          Delete ({selectedCount})
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={transactions}
        loading={isLoading}
        rowSelectionProps={{
          enableRowSelection: true,
          rowSelectionState: rowSelection,
          onRowSelectionStateChange: setRowSelection,
        }}
        getRowId={(row) => row.id}
        onRowClick={(row) => onRowClick(row.original.id)}
      />
    </div>
  );
}
