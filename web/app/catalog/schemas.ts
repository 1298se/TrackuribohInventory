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

// Base Schemas (matching backend ORMModels/BaseModel)
export const UUIDSchema = z.string().uuid();

export const PrintingResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
});

export const LanguageResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  abbreviation: z.string(),
});

export const ConditionResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  abbreviation: z.string(),
});

export const SetBaseResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  code: z.string(),
  release_date: z.string().datetime(), // Or z.date() if transformed
});

export const SKUBaseSchema = z.object({
  id: UUIDSchema,
  condition: ConditionResponseSchema,
  printing: PrintingResponseSchema,
  language: LanguageResponseSchema,
});
export type SkuBase = z.infer<typeof SKUBaseSchema>;

export const ProductBaseResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  tcgplayer_url: z.string(),
  image_url: z.string(),
  product_type: z.enum(["Cards", "Sealed Products"]), // Assuming enum values
  data: z.array(z.record(z.string())), // Generic list of dicts
  rarity: z.string().nullable(),
  number: z.string().nullable(),
});

export const ProductWithSetAndSKUsResponseSchema =
  ProductBaseResponseSchema.extend({
    set: SetBaseResponseSchema,
    skus: z.array(SKUBaseSchema),
  });
export type ProductWithSetAndSKUs = z.infer<
  typeof ProductWithSetAndSKUsResponseSchema
>;

/* -----------------------------------------------------
 * 3) Product, SKU, and Set Schemas
 * ----------------------------------------------------- */

// SKUWithProductResponseSchema
export const SKUWithProductResponseSchema = SKUBaseSchema.extend({
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
export type SKUBaseResponse = z.infer<typeof SKUBaseSchema>;
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
// Market Data Schemas
export const MarketDataSummarySchema = z.object({
  current_lowest_listing_price: z.number().nullable().optional(),
  median_sale_price_30_days: z.number().nullable().optional(),
  avg_sale_price_last_7_days: z.number().nullable().optional(),
  sale_count_last_7_days: z.number().nullable().optional(),
  liquidity_ratio: z.number().nullable().optional(),
  price_volatility_30_days: z.number().nullable().optional(),
  price_spread_percent: z.number().nullable().optional(),
  time_to_sell_estimate_days: z.number().nullable().optional(),
});
export type MarketDataSummary = z.infer<typeof MarketDataSummarySchema>;

export const CumulativeDepthLevelSchema = z.object({
  price: z.number(),
  cumulative_count: z.number(), // Use snake_case from backend
});
export type CumulativeDepthLevel = z.infer<typeof CumulativeDepthLevelSchema>;

export const SKUMarketDataSchema = z.object({
  summary: MarketDataSummarySchema,
  cumulative_depth_levels: z.array(CumulativeDepthLevelSchema),
  listings: z.array(z.any()),
  sales: z.array(z.any()),
});
export type SKUMarketData = z.infer<typeof SKUMarketDataSchema>;

export const SKUMarketDataItemSchema = z.object({
  marketplace: z.string(),
  sku: SKUBaseSchema,
  market_data: SKUMarketDataSchema,
});
export type SKUMarketDataItem = z.infer<typeof SKUMarketDataItemSchema>;

export const ProductMarketSchema = z.object({
  market_data_items: z.array(SKUMarketDataItemSchema),
});
export type ProductMarketData = z.infer<typeof ProductMarketSchema>;
