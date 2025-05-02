"use client";

import { useState, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import ProductSearchContent from "./components/ProductSearchContent";

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const debouncedQuery = useDebounce(query, 300);

  // Handler to update URL when search is submitted
  const handleSearchSubmit = useCallback(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (!query) {
      params.delete("q");
    } else {
      params.set("q", query);
    }
    const search = params.toString();
    const queryStr = search ? `?${search}` : "";
    router.replace(`${pathname}${queryStr}`);
  }, [query, router, searchParams, pathname]);

  return (
    <div className="container space-y-6 py-4">
      <ProductSearchContent
        query={query}
        onQueryChange={setQuery}
        debouncedQuery={debouncedQuery}
        onSearchSubmit={handleSearchSubmit}
      />
    </div>
  );
}
