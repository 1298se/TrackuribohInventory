import { SKUWithProductResponse } from "@/features/catalog/types";

interface SKUDisplayProps {
  sku: SKUWithProductResponse;
}

export function SKUDisplay({ sku }: SKUDisplayProps) {
  return (
    <div className="flex items-center space-x-3 w-full">
      <div className="h-16 w-16 shrink-0">
        <img
          src={sku.product.image_url}
          alt={sku.product.name}
          className="h-full w-full object-contain rounded-md"
        />
      </div>
      <div className="space-y-1 min-w-0 flex-1">
        <h4 className="text-sm font-semibold truncate" title={sku.product.name}>
          {sku.product.name}
        </h4>
        <div className="text-sm text-muted-foreground">
          <div className="truncate" title={sku.product.set.name}>
            {sku.product.set.name}
          </div>
          <div className="truncate">
            {sku.product.rarity && `${sku.product.rarity} • `}
          </div>
        </div>
      </div>
    </div>
  );
}
