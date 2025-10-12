"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import {
  getSetsQuery,
  getProductTypesQuery,
  getProductSearchQuery,
} from "@/features/catalog/api";
import { ChecklistFilter } from "@/shared/components/ChecklistFilter";
import { PRODUCT_TYPES, SET_ERA_MAP } from "@/features/catalog/constants";
import { DisplayCardGrid } from "@/features/catalog/components/DisplayCardGrid";
import { DisplayCardProps } from "@/features/catalog/components/DisplayCard";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(
    []
  );

  const {
    data: setsData,
    error: setsError,
    isLoading: setsLoading,
  } = useQuery(getSetsQuery());

  const {
    data: productTypesData,
    error: productTypesError,
    isLoading: productTypesLoading,
  } = useQuery(getProductTypesQuery());

  const {
    data: searchResults,
    error: searchError,
    isLoading: searchLoading,
  } = useQuery({
    ...getProductSearchQuery({
      query: searchQuery,
      productType:
        selectedProductTypes.length === 1 ? selectedProductTypes[0] : undefined,
      setId: selectedSets.length === 1 ? selectedSets[0] : undefined,
    }),
  });

  if (setsLoading || productTypesLoading) {
    return <div>Loading filters...</div>;
  }

  if (setsError || productTypesError) {
    return (
      <div>
        Error loading data: {setsError?.message || productTypesError?.message}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <Separator className="mb-6" />

      <div className="mb-6">
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search for products (optional)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <h2 className="text-lg font-semibold mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Sets</h3>
              {selectedSets.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedSets.length} of {setsData?.sets.length || 0} selected
                </span>
              )}
            </div>
            <ChecklistFilter
              options={
                setsData?.sets.map((set) => ({
                  id: set.id,
                  name: set.name,
                  era: SET_ERA_MAP[set.id] || "Other",
                  release_date: set.release_date,
                })) || []
              }
              selectedValues={selectedSets}
              onSelectionChange={setSelectedSets}
              placeholder="Select sets..."
              searchPlaceholder="Search sets..."
              groupBy="era"
              sortBy="release_date"
              sortOrder="desc"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Product Types</h3>
              {selectedProductTypes.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedProductTypes.length} of{" "}
                  {productTypesData?.product_types.length || 0} selected
                </span>
              )}
            </div>
            <ChecklistFilter
              options={
                productTypesData?.product_types.map((type) => ({
                  id: type,
                  name: PRODUCT_TYPES[type],
                })) || []
              }
              selectedValues={selectedProductTypes}
              onSelectionChange={setSelectedProductTypes}
              placeholder="Select product types..."
              searchPlaceholder="Search product types..."
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Search Results
          {searchResults && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({searchResults.total} results)
            </span>
          )}
        </h2>

        {searchLoading && <div>Searching...</div>}

        {searchError && (
          <div className="text-red-500">
            Error searching: {searchError.message}
          </div>
        )}

        {searchResults && (
          <DisplayCardGrid
            cards={searchResults.results.map(
              (variant): DisplayCardProps => ({
                decisionId: variant.id, // Using variant ID as decision ID
                productId: variant.product.id,
                name: variant.product.name,
                number: variant.product.number,
                image_url: variant.product.image_url,
                set: {
                  name: variant.set.name,
                  id: variant.set.id,
                },
                product_type: variant.product.product_type,
                price: 0,
              })
            )}
          />
        )}
      </div>
    </div>
  );
}
