"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCatalogs } from "@/app/inventory/api";
import SearchLanding from "./components/search-landing";
import ProductSearchContent from "./components/product-search-content";

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // State for search input
  const [query, setQuery] = useState(searchParams.get("q") || "");
  // State for executed search term (only updates on submit)
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get("q") || ""
  );

  // State for selected catalog
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(
    searchParams.get("catalog") || null
  );

  // Fetch catalogs for filter dropdown
  const { data: catalogData } = useCatalogs();
  const catalogs = catalogData?.catalogs ?? [];

  // Sync state with URL when browser navigation occurs (back/forward buttons)
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    const urlCatalog = searchParams.get("catalog") || null;

    // Update query input to match URL
    setQuery(urlQuery);
    // Update search term to match URL (this controls results display)
    setSearchTerm(urlQuery);
    // Update catalog filter to match URL
    setSelectedCatalog(urlCatalog);
  }, [searchParams]); // Only run when searchParams changes

  // Handler for catalog change
  const handleCatalogChange = useCallback((catalogId: string | null) => {
    setSelectedCatalog(catalogId);
  }, []);

  // Handler for search submission: set searchTerm and update URL
  const handleSearchSubmit = useCallback(() => {
    setSearchTerm(query);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedCatalog) params.set("catalog", selectedCatalog);
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    // Push new history entry for the search
    router.push(`${pathname}${queryStr}`, { scroll: false });
  }, [query, selectedCatalog, router, pathname]);

  return (
    <div className="container py-6">
      {/* Conditionally render landing or results based on user-submitted searchTerm */}
      {!searchTerm ? (
        <SearchLanding
          query={query}
          selectedCatalog={selectedCatalog}
          catalogs={catalogs}
          onQueryChange={setQuery}
          onCatalogChange={handleCatalogChange}
          onSearchSubmit={handleSearchSubmit}
        />
      ) : (
        <ProductSearchContent
          key={searchTerm + (selectedCatalog || "")}
          search={searchTerm}
          selectedCatalog={selectedCatalog}
          // Keep search controls visible for refinement
          query={query}
          onQueryChange={setQuery}
          catalogs={catalogs}
          onCatalogChange={handleCatalogChange}
          onSearchSubmit={handleSearchSubmit}
        />
      )}
    </div>
  );
}
