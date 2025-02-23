import { SKUWithProductResponse } from "@/app/inventory/schemas"
import { z } from "zod"

interface SKUDisplayProps {
    sku: SKUWithProductResponse
}

export function SKUDisplay({ sku }: SKUDisplayProps) {
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