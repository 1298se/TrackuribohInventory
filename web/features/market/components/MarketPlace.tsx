"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconTrendingUp } from "@tabler/icons-react";
import { API_URL } from "@/app/api/fetcher";
import { ProductBaseResponseSchema } from "@/app/catalog/schemas";
import { z } from "zod";
import Image from "next/image";
import { useDebouncedState } from "@tanstack/react-pacer/debouncer";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { POKEMON_CATALOG_ID } from "@/shared/constants";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getLargeTCGPlayerImage } from "../utils";
import { Skeleton } from "@/components/ui/skeleton";

type ProductBaseResponseType = z.infer<typeof ProductBaseResponseSchema>;

const SEARCH_DEBOUNCE_TIME_MS = 1000;

export function MarketPlace() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery, debouncer] = useDebouncedState(
    query,
    {
      wait: SEARCH_DEBOUNCE_TIME_MS,
      leading: true,
      // enabled: () => instantCount > 2, // optional, defaults to true
      // leading: true, // optional, defaults to false
    },
    // Optional Selector function to pick the state you want to track and use
    (state) => ({
      isPending: state.isPending,
      executionCount: state.executionCount,
    })
  );

  const {
    data: products = [],
    isLoading,
    isFetching,
  } = useQuery<ProductBaseResponseType[]>({
    queryKey: ["catalog", debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (debouncedQuery.length === 0) {
        params.set("query", "pikachu");
      } else {
        params.set("query", debouncedQuery);
      }

      params.set("catalog_id", POKEMON_CATALOG_ID);
      params.set("product_type", "CARDS");

      console.log(params.toString());
      const response = await fetch(
        `${API_URL}/catalog/search?${params.toString()}`
      );
      const data = await response.json();

      return data.results;
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setDebouncedQuery(query);
  }, [query]);

  return (
    <section className="flex flex-col gap-4 m-8">
      <div className="relative">
        <label htmlFor="search" className="sr-only">
          Search products
        </label>
        <Input
          id="search"
          leftIcon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          loading={isFetching}
          placeholder="Search Charmander, Bulbasaur, Squirtle..."
        />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <DisplayCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <DisplayCardsSection products={products} />
      )}
    </section>
  );
}

function DisplayCardSkeleton() {
  return (
    <div className="w-[200px] h-[360px]">
      <Skeleton className="w-[200px] h-[280px]" />
      <div className="py-4">
        <Skeleton className="h-[20px] w-[80px]" />
        <Skeleton className="h-[20px] w-[100px]" />
      </div>
    </div>
  );
}

function DisplayCardsSection({
  products,
}: {
  products: ProductBaseResponseType[];
}) {
  if (products.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-20">
        <h2 className="text-xl">No products found</h2>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-3">
      {products.map((product) => (
        <DisplayCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function DisplayCard({ product }: { product: ProductBaseResponseType }) {
  return (
    <Link href={`/market/${product.id}`} className="h-[380px] w-[200px]">
      <div className="w-[200px]">
        <CardContent className="px-0 py-0 w-full">
          <div className="w-[200px] h-[280px] flex items-center justify-center bg-muted bg-gradient-to-t from-muted/5 rounded-md border">
            <Image
              src={getLargeTCGPlayerImage({ imageUrl: product.image_url })}
              alt={product.name}
              width={200}
              height={280}
              className="rounded-md shadow-2xl outline-2 outline-sidebar-border"
            />
          </div>
        </CardContent>
        <div>
          <div className="pt-2">
            <p className="mb-0 text-xs text-muted-foreground">
              {product.number}
            </p>
            <p className="font-semibold text-xs">{product.name}</p>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">TCG Player</p>
            <p className="text-xs text-muted-foreground">$1200.0</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
