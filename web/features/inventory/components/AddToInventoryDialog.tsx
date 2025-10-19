"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog";
import { Button } from "@/shadcn/ui/button";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import { useCreateInventoryItem } from "../api";
import { ProductWithSetAndSKUsResponse } from "@/features/inventorySearch/types";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { Alert, AlertDescription } from "@/shadcn/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";

interface AddToInventoryDialogProps {
  product: ProductWithSetAndSKUsResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToInventoryDialog({
  product,
  open,
  onOpenChange,
}: AddToInventoryDialogProps) {
  const [selectedSkuId, setSelectedSkuId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [costPerItem, setCostPerItem] = useState<string>("");
  const [error, setError] = useState<string>("");

  const createMutation = useCreateInventoryItem();

  // Reset form when dialog opens/closes or product changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedSkuId("");
      setQuantity("1");
      setCostPerItem("");
      setError("");
      createMutation.reset();
    }
    onOpenChange(newOpen);
  };

  // Set default SKU when product changes
  useState(() => {
    if (product?.skus && product.skus.length > 0) {
      setSelectedSkuId(product.skus[0].id);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedSkuId) {
      setError("Please select a SKU variant");
      return;
    }

    const quantityNum = parseInt(quantity, 10);
    const costNum = parseFloat(costPerItem);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError("Quantity must be a positive number");
      return;
    }

    if (isNaN(costNum) || costNum < 0) {
      setError("Cost must be a valid number");
      return;
    }

    try {
      await createMutation.mutateAsync({
        sku_id: selectedSkuId,
        quantity: quantityNum,
        cost_per_item_amount: costNum,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  if (!product) return null;

  const formatSkuLabel = (sku: any) => {
    const parts = [];
    if (sku.condition?.name) parts.push(sku.condition.name);
    if (sku.printing?.name) parts.push(sku.printing.name);
    if (sku.language?.name) parts.push(sku.language.name);
    return parts.length > 0 ? parts.join(" • ") : "Default";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Inventory</DialogTitle>
          <DialogDescription>
            Add this product to your inventory with quantity and cost details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Product Display */}
            <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
              <ProductImage
                src={product.image_url}
                alt={product.name}
                containerClassName="w-16 h-16"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{product.name}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {product.set.name}
                  {product.rarity && ` • ${product.rarity}`}
                </p>
              </div>
            </div>

            {/* SKU Selection */}
            <div className="space-y-2">
              <Label htmlFor="sku">Variant</Label>
              <Select value={selectedSkuId} onValueChange={setSelectedSkuId}>
                <SelectTrigger id="sku">
                  <SelectValue placeholder="Select variant" />
                </SelectTrigger>
                <SelectContent>
                  {product.skus?.map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {formatSkuLabel(sku)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                required
              />
            </div>

            {/* Cost Per Item */}
            <div className="space-y-2">
              <Label htmlFor="cost">Cost Per Item ($)</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={costPerItem}
                onChange={(e) => setCostPerItem(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {/* Error Display */}
            {(error || createMutation.isError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error || "Failed to add item to inventory"}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add to Inventory
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
