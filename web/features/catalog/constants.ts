import { ProductType } from "./types";

export const PRODUCT_TYPES: Record<ProductType, string> = {
  CARDS: "Cards",
  SEALED: "Sealed Products",
} as const;
