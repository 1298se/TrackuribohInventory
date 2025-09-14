// Schemas for the Catalog module
import { z } from "zod";

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
// Define product type constants
export const PRODUCT_TYPES = {
  CARDS: "CARDS",
  SEALED: "SEALED",
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
  product_type: z.enum(["CARDS", "SEALED"]), // Matches backend enum values
  data: z.array(z.record(z.string())), // Generic list of dicts
  rarity: z.string().nullable(),
  number: z.string().nullable(),
});

export type ProductBaseResponseSchemaType = z.infer<
  typeof ProductBaseResponseSchema
>;

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
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
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
export const CumulativeDepthLevelSchema = z.object({
  price: z.number(),
  cumulative_count: z.number(), // Use snake_case from backend
});
export type CumulativeDepthLevel = z.infer<typeof CumulativeDepthLevelSchema>;

// Schema for cumulative sales depth levels
export const SaleCumulativeDepthLevelSchema = z.object({
  price: z.number(),
  cumulative_count: z.number(),
});
export type SaleCumulativeDepthLevel = z.infer<
  typeof SaleCumulativeDepthLevelSchema
>;

export const SKUMarketDataSchema = z.object({
  total_listings: z.number(),
  total_quantity: z.number(),
  total_sales: z.number(),
  sales_velocity: z.number(),
  days_of_inventory: z.number().nullable().optional(),
  cumulative_depth_levels: z.array(CumulativeDepthLevelSchema),
  cumulative_sales_depth_levels: z.array(SaleCumulativeDepthLevelSchema),
});
export type SKUMarketData = z.infer<typeof SKUMarketDataSchema>;

export const SKUMarketDataItemSchema = z.object({
  marketplace: z.string(),
  sku: SKUBaseSchema,
  market_data: SKUMarketDataSchema,
});
export type SKUMarketDataItem = z.infer<typeof SKUMarketDataItemSchema>;

// Rename to match backend MarketDataResponseSchema
export const MarketDataResponseSchema = z.object({
  market_data_items: z.array(SKUMarketDataItemSchema),
});

export type MarketDataResponseSchemaType = z.infer<
  typeof MarketDataResponseSchema
>;
