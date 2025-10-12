// Types for the Catalog feature module

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
// Define product type constants
export const PRODUCT_TYPES = {
  CARDS: "CARDS",
  SEALED: "SEALED",
} as const;

export type ProductType = (typeof PRODUCT_TYPES)[keyof typeof PRODUCT_TYPES];

/* -----------------------------------------------------
 * 2) Basic Types (used by others)
 * ----------------------------------------------------- */

// Base Types (matching backend ORMModels/BaseModel)
export type UUID = string;

export interface PrintingResponse {
  id: UUID;
  name: string;
}

export interface LanguageResponse {
  id: UUID;
  name: string;
  abbreviation: string;
}

export interface ConditionResponse {
  id: UUID;
  name: string;
  abbreviation: string;
}

export interface SetBaseResponse {
  id: UUID;
  name: string;
  code: string;
  release_date: string; // ISO datetime string
}

export interface SKUBase {
  id: UUID;
  condition: ConditionResponse;
  printing: PrintingResponse;
  language: LanguageResponse;
}

export interface ProductBaseResponse {
  id: UUID;
  name: string;
  tcgplayer_url: string;
  image_url: string;
  product_type: "CARDS" | "SEALED"; // Matches backend enum values
  data: Record<string, string>[]; // Generic list of dicts
  rarity: string | null;
  number: string | null;
}

export interface ProductWithSetAndSKUsResponse extends ProductBaseResponse {
  set: SetBaseResponse;
  skus: SKUBase[];
}

export interface SKUMarketPrice {
  sku_id: string;
  lowest_listing_price_total: number | null;
}

export interface ProductMarketPricesResponse {
  prices: SKUMarketPrice[];
}

/* -----------------------------------------------------
 * 3) Product, SKU, and Set Types
 * ----------------------------------------------------- */

export interface SKUWithProductResponse extends SKUBase {
  product: ProductWithSetAndSKUsResponse;
}

export interface ProductVariantResponse {
  id: UUID;
  product: ProductBaseResponse;
  set: SetBaseResponse;
  printing: PrintingResponse;
  language: LanguageResponse;
  skus: SKUBase[];
}

export interface ProductSearchResultItem extends ProductBaseResponse {
  set: SetBaseResponse;
}

export interface ProductSearchResponse {
  results: ProductVariantResponse[];
}

/* -----------------------------------------------------
 * Catalog List Types
 * ----------------------------------------------------- */
export interface Catalog {
  id: UUID;
  display_name: string;
}

export interface CatalogsResponse {
  catalogs: Catalog[];
}

export interface SetsResponse {
  sets: SetBaseResponse[];
}

export interface TopPricedCard {
  sku_id: UUID;
  product_name: string;
  condition: string;
  printing: string;
  language: string;
  price: number;
}

export interface SetPriceSummaryResponse {
  total_market_value: number;
  top_priced_card: TopPricedCard | null;
}

export interface HistoricalPriceComparisonResponse {
  current_total_market_value: number;
  historical_total_market_value: number | null;
  growth_percentage: number | null;
  current_top_priced_card: TopPricedCard | null;
  historical_top_priced_card: TopPricedCard | null;
  top_card_growth_percentage: number | null;
}
