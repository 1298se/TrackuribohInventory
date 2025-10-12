"use client";

import { useQuery } from "@tanstack/react-query";
import { getProductSearchQuery } from "@/features/catalog/api";
import {
  DisplayCardGrid,
  DisplayCardGridSkeleton,
} from "@/features/catalog/components/DisplayCardGrid";
import { DisplayCardProps } from "@/features/catalog/components/DisplayCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductVariantResponse } from "@/features/catalog/types";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNotNullable } from "@/lib/validation";
import { EmptyState } from "@/shared/components/EmptyState";
import { Search } from "lucide-react";

interface SetListProps {
  setId: string;
}

export function SetList({ setId }: SetListProps) {
  const {
    data: setList,
    isLoading,
    error,
  } = useQuery(getProductSearchQuery({ query: "", setId }));

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">
          <Skeleton className="h-8 w-64" />
        </h1>
        <Tabs defaultValue="cards" className="w-full">
          <TabsList>
            <TabsTrigger value="cards">
              <Skeleton className="h-4 w-16" />
            </TabsTrigger>
            <TabsTrigger value="sealed">
              <Skeleton className="h-4 w-16" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cards" className="mt-6">
            <DisplayCardGridSkeleton />
          </TabsContent>
          <TabsContent value="sealed" className="mt-6">
            <DisplayCardGridSkeleton />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Error loading products: {error.message}
      </div>
    );
  }

  if (!setList || setList.results.length === 0) {
    return (
      <EmptyState
        title="No cards found"
        description="Try searching for a different Pokemon name or set"
        icon={Search}
      />
    );
  }

  const setName = setList.results[0]?.set.name;

  assertNotNullable(setName, "Set name is required");

  const cardProducts = setList.results
    .filter((v) => v.product.product_type === "CARDS")
    .sort((a, b) => {
      const cardA = parseInt(a.product.number || "0", 10);
      const cardB = parseInt(b.product.number || "0", 10);
      return cardB - cardA;
    });
  const sealedProducts = setList.results.filter(
    (v) => v.product.product_type === "SEALED"
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">{setName}</h1>
      <Tabs defaultValue="cards" className="w-full">
        <TabsList>
          <TabsTrigger value="cards">Cards ({cardProducts.length})</TabsTrigger>
          <TabsTrigger value="sealed">
            Sealed ({sealedProducts.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="mt-6">
          <DisplayCardGrid cards={cardProducts.map(mapToDisplayCard)} />
        </TabsContent>
        <TabsContent value="sealed" className="mt-6">
          <DisplayCardGrid cards={sealedProducts.map(mapToDisplayCard)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function mapToDisplayCard(variant: ProductVariantResponse): DisplayCardProps {
  return {
    decisionId: variant.id,
    productId: variant.product.id,
    name: variant.product.name,
    number: variant.product.number,
    image_url: variant.product.image_url,
    set: {
      name: variant.set.name,
      id: variant.set.id,
    },
    price: 0,
    product_type: variant.product.product_type,
  };
}
