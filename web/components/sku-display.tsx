import { SKUWithProductResponse } from "@/app/catalog/schemas";
import { formatSKU } from "@/app/catalog/utils";

interface SKUDisplayProps {
  sku: SKUWithProductResponse;
}

export function SKUDisplay({ sku }: SKUDisplayProps) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">{sku.product.name}</h4>
      <div className="text-sm text-muted-foreground">
        <div>{sku.product.set.name}</div>
        <div>
          {sku.product.rarity && `${sku.product.rarity} • `}
          {formatSKU(sku.condition, sku.printing, sku.language)}
        </div>
      </div>
    </div>
  );
}
