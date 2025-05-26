import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TransactionFilter, TransactionType } from "../schemas";

export function useTransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse current filters from URL - no mapping needed, names match the API
  const filters: TransactionFilter = {
    q: searchParams.get("q") || undefined,
    date_start: searchParams.get("date_start") || undefined,
    date_end: searchParams.get("date_end") || undefined,
    types:
      (searchParams
        .get("types")
        ?.split(",")
        .filter(Boolean) as TransactionType[]) || undefined,
    platform_ids:
      searchParams.get("platform_ids")?.split(",").filter(Boolean) || undefined,
    include_no_platform: searchParams.get("include_no_platform") === "true",
    amount_min: searchParams.get("amount_min")
      ? Number(searchParams.get("amount_min"))
      : undefined,
    amount_max: searchParams.get("amount_max")
      ? Number(searchParams.get("amount_max"))
      : undefined,
  };

  // Update multiple filters at once
  const updateFilters = useCallback(
    (updates: Partial<TransactionFilter>) => {
      const current = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          current.delete(key);
        } else if (Array.isArray(value)) {
          current.set(key, value.join(","));
        } else if (typeof value === "boolean") {
          if (value) {
            current.set(key, "true");
          } else {
            current.delete(key);
          }
        } else {
          current.set(key, value.toString());
        }
      });

      router.push(`?${current.toString()}`);
    },
    [router, searchParams],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push(window.location.pathname);
  }, [router]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
