"use client";

import { useState } from "react";
import { useProductSearch } from "@/app/catalog/api";
import { useCatalogs } from "@/app/inventory/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

interface ProductSearchContentProps {
  query: string;
  onQueryChange: (q: string) => void;
  debouncedQuery: string;
  onSearchSubmit: () => void;
}

export default function ProductSearchContent({
  query,
  onQueryChange,
  debouncedQuery,
  onSearchSubmit,
}: ProductSearchContentProps) {
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);

  const { data: catalogData } = useCatalogs();
  const catalogs = catalogData?.catalogs ?? [];

  const {
    data: searchData,
    error,
    isLoading,
  } = useProductSearch(debouncedQuery, selectedCatalog);
  const products = searchData?.results ?? [];

  return (
    <>
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
        <Input
          placeholder="Search products..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSearchSubmit();
            }
          }}
          className="flex-1"
        />
        <Select
          value={selectedCatalog ?? "all"}
          onValueChange={(val) =>
            setSelectedCatalog(val === "all" ? null : val)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Catalogs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Catalogs</SelectItem>
            {catalogs.map((catalog) => (
              <SelectItem key={catalog.id} value={catalog.id}>
                {catalog.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-red-600">
          Failed to load products.{" "}
          <button onClick={onSearchSubmit}>Retry</button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && products.length === 0 && (
        <div className="text-center text-muted-foreground">
          No products found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}.
        </div>
      )}

      {/* Results grid */}
      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
