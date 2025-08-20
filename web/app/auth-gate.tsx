"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isLoginRoute = pathname === "/login";
    if (!isAuthenticated && !isLoginRoute) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Allow access to login route without auth
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Only render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
}
