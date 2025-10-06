"use client";

import { Menu } from "lucide-react";
import { useState, useTransition } from "react";

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
import { usePathname, useRouter } from "next/navigation";
import { useBreakpoint } from "@/shared/hooks/useBreakpoint";
import { logout } from "@/features/auth/actions";
import { GlobalSearchInput } from "@/features/catalog/components/GlobalSearchInput";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface AuthState {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email?: string;
  };
}

interface Props {
  authState?: AuthState;
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
  authState,
  logo = {
    url: "/",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: "logo",
    title: "codex",
  },
  menu = [],
  auth = {
    login: { title: "Sign in", url: "#" },
    signup: { title: "Sign up", url: "#" },
  },
}: Props) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const isMdOrLarger = useBreakpoint("md");

  const isAuthenticated = !!authState?.isAuthenticated;

  const handleLogout = () => {
    setLogoutError(null);

    startLogoutTransition(async () => {
      try {
        await logout();
        router.replace("/login");
        router.refresh();
      } catch (error) {
        console.error("Logout failed", error);
        setLogoutError("Unable to log out. Please try again.");
      }
    });
  };

  return (
    <section className={`sticky top-0 z-50 bg-background shadow-sm border-b-2`}>
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
          {isMdOrLarger && <GlobalSearchInput />}
          <div className="flex items-center gap-2">
            <NavigationMenu>
              <NavigationMenuList>
                {menu.map((item) => renderMenuItem(item))}
              </NavigationMenuList>
            </NavigationMenu>
            {isAuthenticated ? (
              <>
                <Link href="/inventory">
                  <Button variant="ghost">Inventory</Button>
                </Link>
                <Link href="/transactions">
                  <Button variant="ghost">Transactions</Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href={auth.login.url}>
                  <Button variant="ghost">{auth.login.title}</Button>
                </Link>
                <Link href={auth.signup.url}>
                  <Button>{auth.signup.title}</Button>
                </Link>
              </>
            )}
            {logoutError && (
              <span className="sr-only" role="alert">
                {logoutError}
              </span>
            )}
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
                      {isAuthenticated ? (
                        <>
                          <Link href="/inventory">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                            >
                              Inventory
                            </Button>
                          </Link>
                          <Link href="/transactions">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                            >
                              Transactions
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="w-full justify-start"
                            disabled={isLoggingOut}
                          >
                            Logout
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link href={auth.login.url}>{auth.login.title}</Link>
                          <Link href={auth.signup.url}>
                            {auth.signup.title}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            {!isMdOrLarger && <GlobalSearchInput />}
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
