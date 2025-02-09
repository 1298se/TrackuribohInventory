import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { SidebarInput } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { DialogProps } from "@radix-ui/react-dialog"
import { Search } from "lucide-react"
import { useInventory, useSearchProducts } from "./api"
import { useState } from "react"
import { ProductWithSetAndSKUsResponse } from "./schemas"
import { useDebounce } from "@/hooks/use-debounce"

interface SelectProductDialogProps extends DialogProps {
  // Parent passes in a callback to handle the selected product
  onSelect: (product: ProductWithSetAndSKUsResponse) => void
}


export function SelectProductDialog({ onSelect, ...props }: SelectProductDialogProps) {
    const [query, setQuery] = useState("")

    const debouncedQuery = useDebounce(query, 500)

    const { data, error, isLoading } = useSearchProducts(debouncedQuery)

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Product</DialogTitle>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search for products" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>

                <Separator />

                <ScrollArea className="h-80">
                    {data &&
                        data.results.map((product: ProductWithSetAndSKUsResponse) => (
                            <div
                                key={product.id}
                                onClick={() => onSelect(product)}
                                className="flex items-center justify-between p-2 border rounded space-x-4"
                            >
                                {/* Product Image */}
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-auto h-16 object-cover rounded"
                                />

                                {/* Product Details */}
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium">{product.name}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {`${product.set.name}${product.rarity ? ` · ${product.rarity}` : ""}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
