"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import { Command, CommandInput } from "@/components/ui/command";
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
import { ProductSearchResultItem } from "@/features/catalog/types";
import { CommandKeyBlock } from "@/shared/components/CommandKeyBlock";
import { useKeyboardListener } from "@/shared/hooks/useKeyboardListener";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
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
  });

  const shouldShowSkeleton =
    isLoading || isFetching || isPending || isRefetching;

  React.useEffect(() => {
    setDebouncedQuery(query);
    setSelectedIndex(0); // Reset selection when query changes
  }, [query, setDebouncedQuery]);

  // Handle keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    const results = searchResults?.results || [];
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      router.push(`/market/${results[selectedIndex].id}`);
      onClose();
    }
  }

  return (
    <DialogContent className="w-xl overflow-y-auto p-0">
      <DialogTitle className="sr-only">Search Pokemon cards</DialogTitle>
      <Command onKeyDown={handleKeyDown}>
        <CommandInput
          placeholder="Search Pokemon cards..."
          className="h-12 text-lg"
          value={query}
          onValueChange={setQuery}
        />

        <div className="h-[300px] overflow-auto p-1 flex flex-col gap-1">
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
      <>
        {searchResults?.results.map((product, index) => {
          return (
            <SearchResultItem
              product={product}
              query={query}
              onSelect={onClose}
              key={product.id}
              isSelected={index === selectedIndex}
            />
          );
        })}
      </>
    );
  }
}

function SearchResultItem({
  product,
  query,
  onSelect,
  isSelected,
}: {
  product: ProductSearchResultItem;
  query: string;
  onSelect: () => void;
  isSelected: boolean;
}) {
  function getImageSrc(product: ProductSearchResultItem) {
    return product.image_url || "/assets/placeholder-pokemon-back.png";
  }

  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    img.src = "/assets/placeholder-pokemon-back.png";
  }

  // TODO: We should prefetch product types when we hover over the search result
  // Doing this in development is reallyyyy slow, so will stop for now
  function handlePrefetch() {
    // queryClient.prefetchQuery(getProductQuery(product.id));
  }

  return (
    <Link href={`/market/${product.id}`}>
      <button
        value={product.id}
        onClick={onSelect}
        onMouseEnter={handlePrefetch}
        className="w-full"
      >
        <div
          className={`flex items-center gap-3 rounded-sm justify-start text-left hover:bg-blue-500/10 p-2 w-full transition-colors ${
            isSelected && "bg-muted"
          }`}
        >
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
            <span className="font-medium text-sm">
              {highlightText(product.name, query)}
            </span>
            <span className="text-xs text-muted-foreground">
              {highlightText(product.set.name, query)}{" "}
              {product.number && `#${product.number}`}
            </span>
          </div>
        </div>
      </button>
    </Link>
  );
}

function SearchEmptyState() {
  return (
    <EmptyState
      icon={Search}
      title="No cards found"
      description="Try searching for a different Pokemon name or set"
      action={
        <div className="text-xs text-muted-foreground">
          Try &quot;Pikachu&quot;, &quot;Charizard&quot;, or &quot;Base
          Set&quot;
        </div>
      }
    />
  );
}

function SearchResultSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, index) => (
        <div className="flex items-center gap-3 w-full p-1">
          <div className="w-[30px] h-[45px] bg-muted rounded-sm animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-4 bg-muted rounded animate-pulse w-32" />
            <div className="h-3 bg-muted rounded animate-pulse w-24" />
          </div>
        </div>
      ))}
    </>
  );
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;

  // Split query into individual words and escape each for regex
  const queryWords = query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (queryWords.length === 0) return text;

  // Create regex that matches any of the query words
  const regex = new RegExp(`(${queryWords.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-blue-400/70 text-white">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
