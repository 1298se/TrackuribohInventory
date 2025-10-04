"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedState } from "@tanstack/react-pacer/debouncer";
import { EmptyState } from "@/shared/components/EmptyState";
import { getProductSearchQuery } from "@/features/catalog/api";
import Link from "next/link";
import Image from "next/image";

const SEARCH_DEBOUNCE_TIME_MS = 200;
const DEFAULT_QUERY = "pikachu";

export function GlobalSearchInput() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useDebouncedState(
    query,
    {
      wait: SEARCH_DEBOUNCE_TIME_MS,
      leading: true,
    },
    (state) => ({
      isPending: state.isPending,
      executionCount: state.executionCount,
    })
  );

  const debouncedQueryKey =
    debouncedQuery.length > 0 ? debouncedQuery : DEFAULT_QUERY;

  const {
    data: searchResults,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(
    getProductSearchQuery({
      query: debouncedQueryKey,
      productType: "CARDS",
    })
  );

  const shouldShowSkeleton = isLoading || isFetching || isPending;

  useEffect(() => {
    setDebouncedQuery(query);
  }, [query, setDebouncedQuery]);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    img.src = "/assets/placeholder-pokemon-back.png";
  };

  const getImageSrc = (product: any) => {
    return product.image_url || "/assets/placeholder-pokemon-back.png";
  };

  // Add keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          role="combobox"
          aria-expanded={open}
          variant="secondary"
          className="w-full justify-between max-w-[500px]"
        >
          <div className="flex items-center gap-2">
            <Search className="size-4" />
            Search Pokemon cards...
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-background text-muted-foreground pointer-events-none flex h-5 items-center justify-center gap-1 rounded border px-1 font-sans text-[0.7rem] font-medium select-none [&_svg:not([class*='size-'])]:size-3">
              ⌘
            </kbd>
            <kbd className="bg-background text-muted-foreground pointer-events-none flex h-5 items-center justify-center gap-1 rounded border px-1 font-sans text-[0.7rem] font-medium select-none [&_svg:not([class*='size-'])]:size-3">
              K
            </kbd>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">Search Pokemon cards</DialogTitle>
        <Command>
          <CommandInput
            placeholder="Search Pokemon cards..."
            className="h-12 text-lg"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="h-[500px]">
            <CommandEmpty>
              {shouldShowSkeleton ? (
                <SearchResultSkeleton />
              ) : (
                <EmptyState
                  title="No cards found"
                  description="Try searching for a different Pokemon name or set"
                  icon={Search}
                  action={
                    <div className="text-xs text-muted-foreground">
                      Try &quot;Pikachu&quot;, &quot;Charizard&quot;, or
                      &quot;Base Set&quot;
                    </div>
                  }
                />
              )}
            </CommandEmpty>
            <CommandGroup className="h-full">
              {shouldShowSkeleton ? (
                <SearchResultSkeleton />
              ) : (
                searchResults?.results.map((product) => (
                  <Link href={`/market/${product.id}`} key={product.id}>
                    <CommandItem
                      key={product.id}
                      value={product.name}
                      onSelect={() => {
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Image
                          src={getImageSrc(product)}
                          alt={product.name}
                          width={35}
                          height={56}
                          className="rounded-sm"
                          onError={handleImageError}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {product.set.name}{" "}
                            {product.number && `#${product.number}`}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  </Link>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SearchResultSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, index) => (
        <CommandItem key={`skeleton-${index}`} disabled>
          <div className="flex items-center gap-3 w-full">
            <div className="w-[35px] h-[56px] bg-muted rounded-sm animate-pulse" />
            <div className="flex flex-col gap-1">
              <div className="h-4 bg-muted rounded animate-pulse w-32" />
              <div className="h-3 bg-muted rounded animate-pulse w-24" />
            </div>
          </div>
        </CommandItem>
      ))}
    </>
  );
}
