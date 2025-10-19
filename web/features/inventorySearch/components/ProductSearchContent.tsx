"use client";

import { Skeleton } from "@/shadcn/ui/skeleton";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/shadcn/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shadcn/ui/select";
import { useGetProductSearchQuery } from "../api";
import { useQuery } from "@tanstack/react-query";
import { Catalog } from "../types";

interface ProductSearchContentProps {
  search: string;
  selectedCatalog: string | null;
  // Props needed to show search controls for refinement
  query: string;
  onQueryChange: (q: string) => void;
  catalogs: Catalog[];
  onCatalogChange: (catalogId: string | null) => void;
  onSearchSubmit: () => void;
}

export function ProductSearchContent({
  search,
  selectedCatalog,
  query,
  onQueryChange,
  catalogs,
  onCatalogChange,
  onSearchSubmit,
}: ProductSearchContentProps) {
  const {
    data: searchData,
    error,
    isLoading,
  } = useQuery(useGetProductSearchQuery(search, selectedCatalog));

  const products = searchData?.results ?? [];

  // Prevent form submission behavior if wrapped in a form
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchSubmit();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and filter controls - Kept for refinement */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
        <Input
          type="search"
          placeholder="Refine search..."
          value={query} // Controlled by parent CatalogPage
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Select
          value={selectedCatalog ?? "all"}
          onValueChange={(val) => onCatalogChange(val === "all" ? null : val)}
        >
          <SelectTrigger className="w-full sm:w-48">
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
        <div className="text-red-600 text-center py-10">
          Failed to load products.
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

      {/* Empty Search Results State */}
      {!isLoading && !error && search && products.length === 0 && (
        <div className="text-center text-muted-foreground py-20">
          <h2 className="text-xl font-semibold mb-2">No products found</h2>
          <p>Your search for "{search}" did not match any products.</p>
        </div>
      )}

      {/* Results grid */}
      {!isLoading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
