// Schemas for the Catalog module
import { z } from "zod";

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
// Define product type constants
export const PRODUCT_TYPES = {
  CARDS: "Cards",
  SEALED: "Sealed Products",
} as const;

// Define the schema using the values from PRODUCT_TYPES
export const ProductTypeSchema = z.nativeEnum(PRODUCT_TYPES);

/* -----------------------------------------------------
 * 2) Basic Schemas (used by others)
 * ----------------------------------------------------- */

// ConditionResponseSchema
export const ConditionResponseSchema = z.object({
  name: z.string(),
  abbreviation: z.string(),
});

// PrintingResponseSchema
export const PrintingResponseSchema = z.object({
  name: z.string(),
});

// LanguageResponseSchema
export const LanguageResponseSchema = z.object({
  name: z.string(),
  abbreviation: z.string(),
});

/* -----------------------------------------------------
 * 3) Product, SKU, and Set Schemas
 * ----------------------------------------------------- */

// SetBaseResponseSchema
export const SetBaseResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  release_date: z.string(),
});

// SKUBaseResponseSchema
export const SKUBaseResponseSchema = z.object({
  id: z.string().uuid(),
  condition: ConditionResponseSchema,
  printing: PrintingResponseSchema,
  language: LanguageResponseSchema,
});

// ProductWithSetAndSKUsResponseSchema
export const ProductWithSetAndSKUsResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    tcgplayer_url: z.string(),
    image_url: z.string(),
    product_type: ProductTypeSchema,
    // data is an array of objects that can have any string key -> string value
    data: z.array(z.record(z.string())),
    set: SetBaseResponseSchema,
    skus: z.array(SKUBaseResponseSchema),
  })
  .transform((product) => {
    const rawRarity = product.data.find(
      (item) => item.name === "Rarity",
    )?.value;
    const rawNumber = product.data.find(
      (item) => item.name === "Number",
    )?.value;
    return {
      ...product,
      // Derive and sanitize rarity: treat missing or "None" as null
      rarity:
        rawRarity === undefined || rawRarity === "None" ? null : rawRarity,
      // Derive and sanitize number: treat missing or "None" as null
      number:
        rawNumber === undefined || rawNumber === "None" ? null : rawNumber,
    };
  });

// SKUWithProductResponseSchema
export const SKUWithProductResponseSchema = SKUBaseResponseSchema.extend({
  product: ProductWithSetAndSKUsResponseSchema,
});

// ProductSearchResponseSchema
export const ProductSearchResponseSchema = z.object({
  results: z.array(ProductWithSetAndSKUsResponseSchema),
});

// Type inference for catalog related schemas
export type ProductType = z.infer<typeof ProductTypeSchema>;
export type ConditionResponse = z.infer<typeof ConditionResponseSchema>;
export type PrintingResponse = z.infer<typeof PrintingResponseSchema>;
export type LanguageResponse = z.infer<typeof LanguageResponseSchema>;
export type SetBaseResponse = z.infer<typeof SetBaseResponseSchema>;
export type SKUBaseResponse = z.infer<typeof SKUBaseResponseSchema>;
export type ProductWithSetAndSKUsResponse = z.infer<
  typeof ProductWithSetAndSKUsResponseSchema
>;
export type SKUWithProductResponse = z.infer<
  typeof SKUWithProductResponseSchema
>;
export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>;

/* -----------------------------------------------------
 * Catalog List Schemas
 * ----------------------------------------------------- */
export const CatalogSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
});

export const CatalogsResponseSchema = z.object({
  catalogs: z.array(CatalogSchema),
});

export type Catalog = z.infer<typeof CatalogSchema>;
export type CatalogsResponse = z.infer<typeof CatalogsResponseSchema>;

/* -----------------------------------------------------
 * 6) Market Data Schemas
 * ----------------------------------------------------- */
// Summary metrics (stubbed for initial depth-only view)
export const MarketDataSummarySchema = z.object({
  current_lowest_listing_price: z.number().nullable(),
  median_sale_price_30_days: z.number().nullable(),
  avg_sale_price_last_7_days: z.number().nullable(),
  sale_count_last_7_days: z.number().nullable(),
  liquidity_ratio: z.number().nullable(),
  price_volatility_30_days: z.number().nullable(),
  price_spread_percent: z.number().nullable(),
  time_to_sell_estimate_days: z.number().nullable(),
});
export type MarketDataSummary = z.infer<typeof MarketDataSummarySchema>;

// Depth level entry
export const DepthLevelSchema = z.object({
  price: z.number(),
  listing_count: z.number(),
});
export type DepthLevel = z.infer<typeof DepthLevelSchema>;

// Full market data for SKU
export const SKUMarketDataSchema = z.object({
  summary: MarketDataSummarySchema,
  depth_levels: z.array(DepthLevelSchema),
  listings: z.array(z.any()), // stub for future
  sales: z.array(z.any()), // stub for future
});
export type SKUMarketData = z.infer<typeof SKUMarketDataSchema>;
