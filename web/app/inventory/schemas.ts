import { z } from "zod";
import { MoneySchema } from "../schemas";

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
export const ProductTypeSchema = z.enum(["Cards", "Sealed Products"]);

/* -----------------------------------------------------
 * 2) Basic Schemas (used by others)
 * ----------------------------------------------------- */

// ValidationError
export const ValidationErrorSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])), // OpenAPI says: array of string or integer
  msg: z.string(),
  type: z.string(),
});

// HTTPValidationError
export const HTTPValidationErrorSchema = z.object({
  // Not listed as required, so it can be optional
  detail: z.array(ValidationErrorSchema).optional(),
});

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
export const SKUWithProductResponseSchema = z.object({
  condition: ConditionResponseSchema,
  printing: PrintingResponseSchema,
  language: LanguageResponseSchema,
  product: ProductWithSetAndSKUsResponseSchema,
});

// ProductSearchResponseSchema
export const ProductSearchResponseSchema = z.object({
  results: z.array(ProductWithSetAndSKUsResponseSchema),
});

/* -----------------------------------------------------
 * 4) Line Items
 * ----------------------------------------------------- */

// LineItemBaseSchema
export const LineItemBaseSchema = z.object({
  sku_id: z.string().uuid(),
  quantity: z.number(),
});

// LineItemProRataResponseSchema
export const LineItemProRataResponseSchema = z.object({
  sku_id: z.string().uuid(),
  quantity: z.number(),
  price_per_quantity: MoneySchema,
});

// LineItemResponseSchema
export const LineItemResponseSchema = z.object({
  id: z.string().uuid(),
  sku: SKUWithProductResponseSchema,
  price_per_item: MoneySchema,
  quantity: z.number(),
});

/* -----------------------------------------------------
 * 5) Inventory Schemas
 * ----------------------------------------------------- */

// InventoryItemResponseSchema
export const InventoryItemResponseSchema = z.object({
  sku: SKUWithProductResponseSchema,
  quantity: z.number(),
  cost_per_item: MoneySchema,
  lowest_listing_price: MoneySchema.nullable(),
});

// InventoryResponseSchema
export const InventoryResponseSchema = z.object({
  inventory_items: z.array(InventoryItemResponseSchema),
});

// Type inference
export type ProductWithSetAndSKUsResponse = z.infer<typeof ProductWithSetAndSKUsResponseSchema>
export type InventoryItemResponse = z.infer<typeof InventoryItemResponseSchema>
export type InventoryResponse = z.infer<typeof InventoryResponseSchema>
export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>
export type LineItemBase = z.infer<typeof LineItemBaseSchema>
export type LineItemProRataResponse = z.infer<typeof LineItemProRataResponseSchema>
export type SKUWithProductResponse = z.infer<typeof SKUWithProductResponseSchema>

/* -----------------------------------------------------
 * Catalog Schemas
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
