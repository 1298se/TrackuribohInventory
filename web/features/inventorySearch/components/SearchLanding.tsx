"use client";

import { Input } from "@/shadcn/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shadcn/ui/select";
import { Catalog } from "../types";

interface SearchLandingProps {
  query: string;
  selectedCatalog: string | null;
  catalogs: Catalog[];
  onQueryChange: (q: string) => void;
  onCatalogChange: (catalogId: string | null) => void;
  onSearchSubmit: () => void;
}

export function SearchLanding({
  query,
  selectedCatalog,
  catalogs,
  onQueryChange,
  onCatalogChange,
  onSearchSubmit,
}: SearchLandingProps) {
  // Prevent form submission behavior if wrapped in a form
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-6">
        Search the Product Catalog
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        Search for cards, booster boxes, sealed products, and more across all
        TCGs.
      </p>

      {/* Group search input and select */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-4xl">
        <Input
          type="search" // Use type=search for better semantics/mobile UI
          placeholder="Search by card name, set, or game..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-12 px-4 text-lg" // Larger input
          autoFocus // Focus input on load
        />
        <Select
          value={selectedCatalog ?? "all"}
          onValueChange={(val) => onCatalogChange(val === "all" ? null : val)}
        >
          <SelectTrigger className="w-full sm:w-48 h-12 text-lg">
            {" "}
            {/* Match height */}
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
    </div>
  );
}
