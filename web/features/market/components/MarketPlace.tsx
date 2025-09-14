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

type ProductBaseResponseType = z.infer<typeof ProductBaseResponseSchema>;

const SEARCH_DEBOUNCE_TIME_MS = 500;

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
        {isFetching && !isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {products?.map((product) => (
          <DisplayCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function DisplayCard({ product }: { product: ProductBaseResponseType }) {
  console.log(product);
  return (
    <Link href={`/market/${product.id}`}>
      <div className="w-[200px]">
        <CardContent className="px-0 py-0 w-full">
          <div className="w-full h-[150px] flex items-center justify-center bg-muted bg-gradient-to-t from-muted/5 rounded-tl-md rounded-tr-md border">
            <Image
              src={product.image_url}
              alt={product.name}
              width={70}
              height={70}
              className="rounded-sm shadow-2xl"
            />
          </div>
        </CardContent>
        <Card className="w-full h-[120px] pb-4 hover:bg-muted hover:bg-gradient-to-t hover:from-muted/5 rounded-tr-none rounded-tl-none border-t-0">
          <CardHeader className="px-4 pb-0 pt-4">
            <CardDescription className="mb-0 text-xs">
              {product.name}
            </CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-3xl">
              $1,250.00{" "}
            </CardTitle>

            <div className="flex items-center gap-1 text-sm text-green-400">
              <IconTrendingUp className="size-4" />
              +12.5%
            </div>
          </CardHeader>
        </Card>
      </div>
    </Link>
  );
}
