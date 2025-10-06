"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import { Command, CommandInput, CommandItem } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedState } from "@tanstack/react-pacer/debouncer";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getProductSearchQuery, getProductQuery } from "@/features/catalog/api";
import {
  getMarketDepthQuery,
  getProductListingsQuery,
} from "@/features/market/api";
import Link from "next/link";
import Image from "next/image";
import { ProductWithSetAndSKUsResponse } from "@/app/catalog/schemas";
import { CommandKeyBlock } from "@/shared/components/CommandKeyBlock";
import { useKeyboardListener } from "@/shared/hooks/useKeyboardListener";

const SEARCH_DEBOUNCE_TIME_MS = 200;
const DEFAULT_QUERY = "pikachu";

export function GlobalSearchInput() {
  const [open, setOpen] = React.useState(false);

  useKeyboardListener(() => setOpen(true), {
    key: "k",
    metaKey: true,
    ctrlKey: true,
    preventDefault: true,
  });

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
            <CommandKeyBlock>⌘</CommandKeyBlock>
            <CommandKeyBlock>K</CommandKeyBlock>
          </div>
        </Button>
      </DialogTrigger>

      {open && <SearchDialogContent onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

function SearchDialogContent({ onClose }: { onClose: () => void }) {
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
    isRefetching,
    isPending,
  } = useQuery({
    ...getProductSearchQuery({
      query: debouncedQueryKey,
    }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const shouldShowSkeleton =
    isLoading || isFetching || isPending || isRefetching;

  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: searchResults?.results?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 5,
  });

  React.useEffect(() => {
    setDebouncedQuery(query);
  }, [query, setDebouncedQuery]);

  return (
    <DialogContent className="w-xl overflow-y-auto p-0">
      <DialogTitle className="sr-only">Search Pokemon cards</DialogTitle>
      <Command>
        <CommandInput
          placeholder="Search Pokemon cards..."
          className="h-12 text-lg"
          value={query}
          onValueChange={setQuery}
        />

        <div ref={parentRef} className="h-[300px] overflow-auto px-1">
          {renderSearchResults()}
        </div>
      </Command>
    </DialogContent>
  );

  function renderSearchResults() {
    if (shouldShowSkeleton) {
      return <SearchResultSkeleton />;
    }

    if (searchResults?.results?.length === 0) {
      return <SearchEmptyState />;
    }

    return (
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const product = searchResults?.results[virtualItem.index];
          if (!product) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <SearchResultItem
                product={product}
                query={query}
                onSelect={onClose}
              />
            </div>
          );
        })}
      </div>
    );
  }
}

function SearchResultItem({
  product,
  query,
  onSelect,
}: {
  product: ProductWithSetAndSKUsResponse;
  query: string;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();

  function getImageSrc(product: ProductWithSetAndSKUsResponse) {
    return product.image_url || "/assets/placeholder-pokemon-back.png";
  }

  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    img.src = "/assets/placeholder-pokemon-back.png";
  }

  function handlePrefetch() {
    queryClient.prefetchQuery(getProductQuery(product.id));
    queryClient.prefetchQuery(
      getMarketDepthQuery({ sku: product.id, salesLookbackDays: 7 })
    );
    queryClient.prefetchQuery(getProductListingsQuery(product.id));
  }

  // Utility function to highlight matching text
  function highlightText(text: string, query: string) {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-blue-300/70 text-white px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <Link href={`/market/${product.id}`}>
      <CommandItem
        value={product.name}
        onSelect={onSelect}
        onMouseEnter={handlePrefetch}
      >
        <div className="flex items-center gap-3 w-full">
          <Image
            src={getImageSrc(product)}
            alt={product.name}
            width={30}
            height={45}
            objectFit="contain"
            onError={handleImageError}
            className="w-[30px] max-h-[45px]"
          />
          <div className="flex flex-col">
            <span className="font-medium">
              {highlightText(product.name, query)}
            </span>
            <span className="text-xs text-muted-foreground">
              {highlightText(product.set.name, query)}{" "}
              {product.number && `#${product.number}`}
            </span>
          </div>
        </div>
      </CommandItem>
    </Link>
  );
}

function SearchEmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>No cards found</EmptyTitle>
        <EmptyDescription>
          Try searching for a different Pokemon name or set
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="text-xs text-muted-foreground">
          Try &quot;Pikachu&quot;, &quot;Charizard&quot;, or &quot;Base
          Set&quot;
        </div>
      </EmptyContent>
    </Empty>
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
