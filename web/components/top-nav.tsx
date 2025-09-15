"use client";
import { Book, Menu, Search, Sunset, Trees, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import Image from "next/image";
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
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/app/api/fetcher";
import { POKEMON_CATALOG_ID } from "@/shared/constants";
import { useDebouncedState } from "@tanstack/react-pacer/debouncer";
import { ProductWithSetAndSKUsResponse } from "@/app/catalog/schemas";
import { useRouter } from "next/navigation";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface SearchResult {
  results: ProductWithSetAndSKUsResponse[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

interface Props {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
  };
  menu?: MenuItem[];
  auth?: {
    login: {
      title: string;
      url: string;
    };
    signup: {
      title: string;
      url: string;
    };
  };
}

export function TopNav({
  logo = {
    url: "/",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: "logo",
    title: "codex",
  },
  menu = [
    {
      title: "Sets",
      url: "#",
      items: [
        {
          title: "Blog",
          description: "The latest industry news, updates, and info",
          icon: <Book className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Company",
          description: "Our mission is to innovate and empower the world",
          icon: <Trees className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Careers",
          description: "Browse job listing and discover our workspace",
          icon: <Sunset className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Support",
          description:
            "Get in touch with our support team or visit our community forums",
          icon: <Zap className="size-5 shrink-0" />,
          url: "#",
        },
      ],
    },
  ],
  auth = {
    login: { title: "Sign in", url: "#" },
    signup: { title: "Sign up", url: "#" },
  },
}: Props) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      className={`sticky top-0 z-50 ${
        isScrolled ? "bg-background shadow-sm border-b-2" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto max-w-7xl py-4 h-[65px] flex items-center px-4">
        {/* Desktop Menu */}
        <nav className="hidden justify-between lg:flex  w-full">
          {/* Logo */}
          <Link href={logo.url} className="flex items-center gap-2">
            <img
              src={logo.src}
              className="max-h-8 dark:invert"
              alt={logo.alt}
            />
            <span className="text-lg font-semibold tracking-widest">
              {logo.title}
            </span>
          </Link>
          <SearchBar />
          <div className="flex items-center gap-2">
            <NavigationMenu>
              <NavigationMenuList>
                {menu.map((item) => renderMenuItem(item))}
              </NavigationMenuList>
            </NavigationMenu>
            <Link href={auth.login.url}>
              <Button variant="ghost">{auth.login.title}</Button>
            </Link>
            <Link href={auth.signup.url}>
              <Button>{auth.signup.title}</Button>
            </Link>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div className="block lg:hidden w-full">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Link href={logo.url} className="flex items-center gap-2">
                <img
                  src={logo.src}
                  className="max-h-8 dark:invert"
                  alt={logo.alt}
                />
              </Link>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                      <Link href={logo.url} className="flex items-center gap-2">
                        <Image
                          src={logo.src}
                          className="max-h-8 dark:invert"
                          alt={logo.alt}
                        />
                      </Link>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6 p-4">
                    <Accordion
                      type="single"
                      collapsible
                      className="flex w-full flex-col gap-4"
                    >
                      {menu.map((item) => renderMobileMenuItem(item))}
                    </Accordion>

                    <div className="flex flex-col gap-3">
                      <Link href={auth.login.url}>{auth.login.title}</Link>
                      <Link href={auth.signup.url}>{auth.signup.title}</Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <SearchBar />
          </div>
        </div>
      </div>
    </section>
  );
}

function renderMenuItem(item: MenuItem) {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.items.map((subItem) => (
            <NavigationMenuLink asChild key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} />
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink
        href={item.url}
        className="bg-background hover:bg-muted hover:text-accent-foreground group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

function renderMobileMenuItem(item: MenuItem) {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <SubMenuLink key={subItem.title} item={subItem} />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <Link key={item.title} href={item.url} className="text-md font-semibold">
      {item.title}
    </Link>
  );
}

function SubMenuLink({ item }: { item: MenuItem }) {
  return (
    <Link
      className="hover:bg-muted hover:text-accent-foreground flex min-w-80 select-none flex-row gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors"
      href={item.url}
    >
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{item.title}</div>
        {item.description && (
          <p className="text-muted-foreground text-sm leading-snug">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}

const SEARCH_DEBOUNCE_TIME_MS = 200;

const DEFAULT_QUERY = "pikachu";

const LIMIT_PER_PAGE = 10;

export function SearchBar() {
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
  } = useQuery<SearchResult>({
    queryKey: ["search", debouncedQueryKey],
    queryFn: async () => {
      const params = new URLSearchParams();

      params.set("query", debouncedQueryKey);
      params.set("catalog_id", POKEMON_CATALOG_ID);
      params.set("product_type", "CARDS");
      params.set("limit", LIMIT_PER_PAGE.toString());

      const response = await fetch(
        `${API_URL}/catalog/search?${params.toString()}`
      );
      const data = await response.json();
      return data;
    },
  });

  const shouldShowSkeleton = isLoading || isFetching || isPending;

  useEffect(() => {
    setDebouncedQuery(query);
  }, [query, setDebouncedQuery]);

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

  const history = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          role="combobox"
          aria-expanded={open}
          variant="secondary"
          className="w-full lg:w-[700px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="size-4" />
            {query || "Search Pokemon cards..."}
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-background text-muted-foreground pointer-events-none flex h-5 items-center justify-center gap-1 rounded border px-1 font-sans text-[0.7rem] font-medium select-none [&amp;_svg:not([class*='size-'])]:size-3">
              ⌘
            </kbd>
            <kbd className="bg-background text-muted-foreground pointer-events-none flex h-5 items-center justify-center gap-1 rounded border px-1 font-sans text-[0.7rem] font-medium select-none [&amp;_svg:not([class*='size-'])]:size-3">
              K
            </kbd>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-xl h-[500px] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Search Pokemon cards</DialogTitle>
        <Command>
          <CommandInput
            placeholder="Search Pokemon cards..."
            className="h-12 text-lg"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>
              {shouldShowSkeleton ? (
                <SearchResultSkeleton />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-8">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-muted/50 rounded-full blur-2xl scale-125" />
                    <div className="relative bg-muted p-4 rounded-full border">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="text-center max-w-sm space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      No cards found
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Try searching for a different Pokemon name or set
                    </p>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      Try &quot;Pikachu&quot;, &quot;Charizard&quot;, or
                      &quot;Base Set&quot;
                    </p>
                  </div>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {shouldShowSkeleton ? (
                <SearchResultSkeleton />
              ) : (
                searchResults?.results.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      setOpen(false);
                      history.push(`/market/${product.id}`);
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={35}
                        height={56}
                        className="rounded-sm"
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
      {Array.from({ length: LIMIT_PER_PAGE }).map((_, index) => (
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
