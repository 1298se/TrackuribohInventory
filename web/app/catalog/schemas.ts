// Schemas for the Catalog module
import { z } from "zod";

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
// Define product type constants
export const PRODUCT_TYPES = {
  CARDS: "Cards",
  SEALED: "Sealed Products"
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
export const ProductWithSetAndSKUsResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tcgplayer_url: z.string(),
  image_url: z.string(),
  product_type: ProductTypeSchema,
  // data is an array of objects that can have any string key -> string value
  data: z.array(z.record(z.string())),
  rarity: z.string().nullable(), // can be null or string
  set: SetBaseResponseSchema,
  skus: z.array(SKUBaseResponseSchema),
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
export type ProductWithSetAndSKUsResponse = z.infer<typeof ProductWithSetAndSKUsResponseSchema>;
export type SKUWithProductResponse = z.infer<typeof SKUWithProductResponseSchema>;
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