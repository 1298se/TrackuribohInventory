import { SKUWithProductResponse } from "@/app/inventory/schemas"
import { z } from "zod"

interface ProductDisplayProps {
    sku: SKUWithProductResponse
}

export function ProductDisplay({ sku }: ProductDisplayProps) {
    return (
        <div className="space-y-1">
            <h4 className="text-sm font-semibold">{sku.product.name}</h4>
            <div className="text-sm text-muted-foreground">
                <div>{sku.product.set.name}</div>
                <div>
                    {sku.condition.name} • {sku.printing.name} • {sku.language.name}
                </div>
            </div>
        </div>
    )
} 