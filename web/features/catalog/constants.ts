import { ProductType } from "./schemas";

export const PRODUCT_TYPES: Record<ProductType, string> = {
  CARDS: "Cards",
  SEALED: "Sealed Products",
} as const;
