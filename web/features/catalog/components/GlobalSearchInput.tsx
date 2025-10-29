"use client";

import { Search, Loader2 } from "lucide-react";
import {
  useState,
  useEffect,
  useRef,
  type SyntheticEvent,
  KeyboardEvent,
} from "react";
import { Command } from "@/shadcn/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/shadcn/ui/dialog";
import { Button } from "@/shadcn/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedState } from "@tanstack/react-pacer/debouncer";
import { EmptyState } from "@/shared/components/EmptyState";
import { getProductSearchQuery } from "@/features/catalog/api";
import Link from "next/link";
import Image from "next/image";
import {
  ProductSearchResultItem,
  ProductVariantResponse,
} from "@/features/catalog/types";
import { CommandKeyBlock } from "@/shared/components/CommandKeyBlock";
import { useRouter } from "next/navigation";
import { useKeyboardListener } from "@/shared/hooks/useKeyboardListener";

const SEARCH_DEBOUNCE_TIME_MS = 200;
const DEFAULT_QUERY = "pikachu";

export function GlobalSearchInput() {
  const [open, setOpen] = useState(false);

  useKeyboardListener(
    () => {
      setOpen((prev) => !prev);
    },
    {
      key: "k",
      metaOrCtrl: true,
      preventDefault: true,
    },
  );

  return (
    <>
      <Button
        role="combobox"
        aria-expanded={open}
        variant="secondary"
        onClick={() => setOpen(true)}
        className="w-full justify-between max-w-[500px]"
      >
        <div className="flex items-center gap-2">
          <Search className="size-4" />
          Search Pokemon cards...
        </div>
        <div className="items-center gap-1 hidden md:flex">
          <CommandKeyBlock>Ctrl</CommandKeyBlock>
          <CommandKeyBlock>K</CommandKeyBlock>
        </div>
      </Button>
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <SearchDialogContent onClose={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}

function SearchDialogContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useDebouncedState(
    query,
    {
      wait: SEARCH_DEBOUNCE_TIME_MS,
      leading: true,
    },
    (state) => ({
      isPending: state.isPending,
      executionCount: state.executionCount,
    }),
  );

  const debouncedQueryKey =
    debouncedQuery.length > 0 ? debouncedQuery : DEFAULT_QUERY;

  const {
    data: searchResults,
    isLoading,
    isFetching,
    isPending,
  } = useQuery({
    ...getProductSearchQuery({
      query: debouncedQueryKey,
      limit: 30,
    }),
    placeholderData: (previousData) => previousData,
  });

  const shouldShowSkeleton = isLoading || isPending;

  useEffect(
    function onQueryChange() {
      setDebouncedQuery(query);
      setSelectedIndex(0);
    },
    [query, setDebouncedQuery],
  );

  useEffect(
    function scrollSelectedItemIntoView() {
      const selectedElement = itemRefs.current[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    },
    [selectedIndex],
  );

  function handleKeyDown(e: KeyboardEvent) {
    const results = searchResults?.results || [];

    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (
      (e.key === "Enter" || e.key === "Tab") &&
      results[selectedIndex]
    ) {
      e.preventDefault();
      router.push(`/market/${results[selectedIndex].product.id}`);
      onClose();
    }
  }

  return (
    <DialogContent className="w-[90%]sm:w-sm md:w-xl overflow-y-auto p-0">
      <DialogTitle className="sr-only">Search Pokemon cards</DialogTitle>
      <Command onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 shrink-0 opacity-50 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          )}
          <input
            placeholder="Search Pokemon cards..."
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-lg outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

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

    const sortedResults = sortResultsByRelevance(searchResults?.results, query);

    return (
      <>
        {sortedResults.map((variant, index) => {
          return (
            <div
              key={variant.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            >
              <SearchResultItem
                variant={variant}
                query={query}
                onSelect={onClose}
                isSelected={index === selectedIndex}
              />
            </div>
          );
        })}
      </>
    );
  }

  function calculateMatchScore(
    variant: ProductVariantResponse,
    query: string,
  ): number {
    if (!query.trim()) return 0;

    const queryWords = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (queryWords.length === 0) return 0;

    const productText = `${variant.product.name} ${variant.set.name} ${
      variant.product.number || ""
    }`.toLowerCase();

    // Count how many query words are found in the product text
    let matchCount = 0;
    queryWords.forEach((word) => {
      if (productText.includes(word)) {
        matchCount++;
      }
    });

    return matchCount;
  }

  function sortResultsByRelevance(
    results: ProductVariantResponse[] | undefined,
    query: string,
  ): ProductVariantResponse[] {
    if (!results) return [];

    return [...results].sort((a, b) => {
      const scoreA = calculateMatchScore(a, query);
      const scoreB = calculateMatchScore(b, query);
      return scoreB - scoreA;
    });
  }
}

function SearchResultItem({
  variant,
  query,
  onSelect,
  isSelected,
}: {
  variant: ProductVariantResponse;
  query: string;
  onSelect: () => void;
  isSelected: boolean;
}) {
  function getImageSrc(variant: ProductVariantResponse) {
    return variant.product.image_url || "/assets/placeholder-pokemon-back.png";
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    img.src = "/assets/placeholder-pokemon-back.png";
  }

  function handlePrefetch() {
    // TODO: We should prefetch product types when we hover over the search result
    // Doing this in development is reallyyyy slow, so will stop for now
    // queryClient.prefetchQuery(getProductQuery(variant.product.id));
  }

  return (
    <Link href={`/market/${variant.product.id}`}>
      <button
        value={variant.product.id}
        onClick={onSelect}
        onMouseEnter={handlePrefetch}
        className="w-full"
      >
        <div
          className={`flex items-center gap-3 rounded-sm justify-start text-left hover:bg-secondary/50 p-2 w-full transition-colors ${
            isSelected && "bg-muted"
          }`}
        >
          <Image
            src={getImageSrc(variant)}
            alt={variant.product.name}
            width={30}
            height={45}
            objectFit="contain"
            onError={handleImageError}
            className="w-[30px] max-h-[45px]"
          />
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {highlightText(variant.product.name, query)}
            </span>
            <span className="text-xs text-muted-foreground">
              {highlightText(variant.set.name, query)}{" "}
              {variant.product.number && `#${variant.product.number}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {variant.printing.name}
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
        <div className="flex items-center gap-3 w-full p-1" key={index}>
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
    ),
  );
}
