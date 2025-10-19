import { ProductWithSetAndSKUsResponse } from "@/features/catalog/types";
import React from "react";

interface ProductDisplayProps {
  product: ProductWithSetAndSKUsResponse;
}

export function ProductDisplay({ product }: ProductDisplayProps) {
  // Show set name and optionally rarity
  const details = [product.set.name];
  if (product.rarity) {
    details.push(product.rarity);
  }

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">{product.name}</h4>
      <div className="text-sm text-muted-foreground">
        <div>{details.join(" · ")}</div>
      </div>
    </div>
  );
}
