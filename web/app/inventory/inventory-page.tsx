"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useInventory, useInventoryCatalogs, useInventoryMetrics } from "./api";
import { PortfolioPerformance } from "./portfolio-performance";
import { InventoryTable } from "./inventory-table";

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function InventoryPage({ token }: { token: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get initial query and catalog from URL or default to empty/null
  const initialQuery = searchParams.get("q") || "";
  const initialCatalogId = searchParams.get("catalog_id");

  const [selectedCatalogId, setSelectedCatalogId] = useState(initialCatalogId);

  // Fetch catalogs for Tabs
  const { data: catalogsData, isLoading: catalogsLoading } =
    useInventoryCatalogs(token);

  // Fetch inventory data based on selected catalog
  const { data, isLoading, error } = useInventory(
    initialQuery,
    selectedCatalogId,
    token
  );

  // Fetch aggregate metrics (does not depend on search query)
  const { data: metricData, isLoading: metricLoading } = useInventoryMetrics(
    selectedCatalogId,
    token
  );

  // Sync selectedCatalogId when URL param changes (e.g., via back/forward)
  useEffect(() => {
    if (initialCatalogId !== selectedCatalogId) {
      setSelectedCatalogId(initialCatalogId);
    }
  }, [initialCatalogId]);

  // Handler to update URL when filter is submitted via DataTable
  const handleFilterSubmit = useCallback(
    (query: string) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      if (!query) {
        current.delete("q");
      } else {
        current.set("q", query);
      }
      const search = current.toString();
      const queryStr = search ? `?${search}` : "";
      router.replace(`${pathname}${queryStr}`);
    },
    [router, searchParams, pathname]
  );

  // Handler for catalog tab change
  const handleCatalogChange = useCallback(
    (value: string) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      if (value === "all") {
        current.delete("catalog_id");
        setSelectedCatalogId(null);
      } else {
        current.set("catalog_id", value);
        setSelectedCatalogId(value);
      }
      const search = current.toString();
      const queryStr = search ? `?${search}` : "";
      router.replace(`${pathname}${queryStr}`);
    },
    [router, searchParams, pathname]
  );

  // Handle potential error state from useInventory
  if (error) {
    return (
      <ErrorState message={error.message || "Failed to load inventory."} />
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Selector */}
      <div>
        {catalogsLoading ? (
          <Skeleton className="h-10 w-[300px]" />
        ) : (
          <Tabs
            value={selectedCatalogId || "all"}
            onValueChange={handleCatalogChange}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {catalogsData?.catalogs?.map((catalog: any) => (
                <TabsTrigger key={catalog.id} value={catalog.id}>
                  {catalog.display_name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Portfolio Performance Section */}
      {metricData && (
        <PortfolioPerformance
          selectedCatalogId={selectedCatalogId}
          metricData={metricData}
          metricLoading={metricLoading}
          token={token}
        />
      )}

      {/* Inventory Table Section */}
      <InventoryTable
        initialQuery={initialQuery}
        handleFilterSubmit={handleFilterSubmit}
        data={data}
        isLoading={isLoading}
      />
    </div>
  );
}
