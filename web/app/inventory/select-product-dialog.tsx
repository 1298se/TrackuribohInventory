import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DialogProps } from "@radix-ui/react-dialog"
import { Search, Loader2, Plus } from "lucide-react"
import { useSearchProducts, useCatalogs } from "./api"
import { useState } from "react"
import { ProductWithSetAndSKUsResponse } from "./schemas"
import { useDebounce } from "@/hooks/use-debounce"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

// Define constants for the "all" options
const CATALOG_ALL = "all";
const PRODUCT_TYPE_ALL = "all";

// Product type values from ProductTypeSchema in schemas.ts
const PRODUCT_TYPE = {
    CARDS: "Cards",
    SEALED: "Sealed Products"
};

interface SelectProductDialogProps extends DialogProps {
    // Parent passes in a callback to handle the selected product
    onSelect: (product: ProductWithSetAndSKUsResponse) => void;
}

export function SelectProductDialog({ onSelect, ...props }: SelectProductDialogProps) {
    const [query, setQuery] = useState("")
    // Use the constants for the initial state
    const [selectedCatalog, setSelectedCatalog] = useState(CATALOG_ALL)
    const [selectedProductType, setSelectedProductType] = useState(PRODUCT_TYPE_ALL)
    const { data: catalogsData } = useCatalogs();
    const [open, setOpen] = useState(false)

    const debouncedQuery = useDebounce(query, 500)

    // Modified to match the API implementation and include productType
    const { data, error, isLoading } = useSearchProducts(
        debouncedQuery,
        selectedCatalog === CATALOG_ALL ? null : selectedCatalog,
        selectedProductType === PRODUCT_TYPE_ALL ? null : selectedProductType
    )

    const handleProductSelect = (product: ProductWithSetAndSKUsResponse) => {
        onSelect(product);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen} {...props}>

            <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="secondary"
                    >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                </Button>
            </DialogTrigger>

            <DialogContent className="min-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Select Product</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-4">
                    <Select value={selectedCatalog} onValueChange={setSelectedCatalog}>
                        <SelectTrigger className="rounded-md border bg-background p-2 text-sm max-w-[200px]">
                            <SelectValue placeholder="Catalog" className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Use constant for the "All Catalogs" option */}
                            <SelectItem value={CATALOG_ALL}>All Catalogs</SelectItem>
                            {catalogsData?.catalogs.map((catalog) => (
                                <SelectItem key={catalog.id} value={catalog.id}>
                                    {catalog.display_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                        <SelectTrigger className="rounded-md border bg-background p-2 text-sm max-w-[200px]">
                            <SelectValue placeholder="Product Type" className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={PRODUCT_TYPE_ALL}>All Types</SelectItem>
                            <SelectItem value={PRODUCT_TYPE.CARDS}>Cards</SelectItem>
                            <SelectItem value={PRODUCT_TYPE.SEALED}>Sealed Products</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search for products"
                            className="pl-8"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search for products"
                        />
                    </div>
                </div>
                <Separator />

                <ScrollArea className="h-80">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center p-4">
                            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="p-4 text-center text-red-600">
                            Error loading products. Please try again.
                        </div>
                    ) : data && data.results.length === 0 ? (
                        <div className="p-4 text-center">
                            No products found.
                        </div>
                    ) : (
                        data?.results.map((product: ProductWithSetAndSKUsResponse) => (
                            <div
                                key={product.id}
                                onClick={() => handleProductSelect(product)}
                                className="flex items-center justify-between p-2 border rounded gap-4 hover:bg-muted transition cursor-pointer"
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
                        ))
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
