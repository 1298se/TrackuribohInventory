"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Package2, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/auth-provider";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout, loading } = useAuth();

  const navigation = [
    {
      name: "Inventory",
      href: "/inventory",
      icon: Package2,
    },
    {
      name: "Transactions",
      href: "/transactions",
      icon: CircleDollarSign,
    },
  ];

  // Always show Add Transaction since we removed catalog
  const showAddTransaction = true;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <Link href="/inventory" className="flex items-center space-x-2">
            <Package2 className="h-5 w-5 md:h-6 md:w-6" />
            <span className="font-bold text-sm md:text-base">Codex.tcg</span>
          </Link>
        </div>

        {/* Right side: Navigation + Actions */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Main Navigation */}
          <nav className="hidden md:flex items-center space-x-4 text-sm font-medium">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md transition-colors hover:bg-muted",
                    isActive
                      ? "text-foreground bg-muted font-medium"
                      : "text-foreground/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center space-x-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-md transition-colors",
                    isActive
                      ? "text-foreground bg-muted"
                      : "text-foreground/60 hover:text-foreground hover:bg-muted",
                  )}
                  title={item.name}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              );
            })}
          </nav>

          {/* Add Transaction */}
          <Button
            size="sm"
            onClick={() => router.push("/transactions/new")}
            className="flex items-center space-x-1 md:space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline text-xs md:text-sm">
              Add Transaction
            </span>
          </Button>

          {/* Auth Controls */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <span className="hidden sm:inline text-sm text-foreground/70">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={logout}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/login")}
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
