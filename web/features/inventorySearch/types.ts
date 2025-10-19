// Product type enum
export type ProductType = "CARDS" | "SEALED";

// Printing types
export interface PrintingResponse {
  id: string;
  name: string;
}

// Language types
export interface LanguageResponse {
  id: string;
  name: string;
  abbreviation: string;
}

// Condition types
export interface ConditionResponse {
  id: string;
  name: string;
  abbreviation: string;
}

// Set types
export interface SetBaseResponse {
  id: string;
  name: string;
  code: string;
  release_date: string;
}

// SKU types
export interface SKUBaseResponse {
  id: string;
  condition: ConditionResponse;
  printing: PrintingResponse;
  language: LanguageResponse;
  lowest_listing_price_total: number;
}

// Product types
export interface ProductBaseResponse {
  id: string;
  name: string;
  tcgplayer_url: string;
  image_url: string;
  product_type: ProductType;
  data: Record<string, string>[];
  rarity: string | null;
  number: string | null;
}

export interface ProductWithSetAndSKUsResponse extends ProductBaseResponse {
  set: SetBaseResponse;
  skus: SKUBaseResponse[];
}

export interface SKUWithProductResponse extends SKUBaseResponse {
  product: ProductWithSetAndSKUsResponse;
}

// Search response
export interface ProductSearchResponse {
  results: ProductWithSetAndSKUsResponse[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

// Catalog type
export interface Catalog {
  id: string;
  display_name: string;
}

export interface CatalogsResponse {
  catalogs: Catalog[];
}
