export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD"
): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount
  );
}

/**
 * Find Near Mint SKUs from a list of SKUs
 * @param skus - Array of SKU objects with condition property
 * @returns Array of Near Mint SKUs
 */
export function findNearMintSkus<
  T extends { condition: { abbreviation: string } }
>(skus: T[]): T[] {
  return skus.filter((sku) => sku.condition.abbreviation === "NM");
}

/**
 * Find the first Near Mint SKU from a list of SKUs
 * @param skus - Array of SKU objects with condition property
 * @returns First Near Mint SKU or undefined if none found
 */
export function findFirstNearMintSku<
  T extends { condition: { abbreviation: string } }
>(skus: T[]): T | undefined {
  return skus.find((sku) => sku.condition.abbreviation === "NM");
}
