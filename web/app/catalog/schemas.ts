import { z } from "zod";

const UUIDSchema = z.string().uuid("Expected a UUID string");

export const ProductTypeSchema = z.enum(["CARDS", "SEALED"]);

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
  release_date: z.string().datetime(),
});

export const SKUBaseResponseSchema = z.object({
  id: UUIDSchema,
  condition: ConditionResponseSchema,
  printing: PrintingResponseSchema,
  language: LanguageResponseSchema,
  lowest_listing_price_total: z.number(),
});

export const ProductBaseResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  tcgplayer_url: z.string(),
  image_url: z.string(),
  product_type: ProductTypeSchema,
  data: z.array(z.record(z.string(), z.string())),
  rarity: z.string().nullable(),
  number: z.string().nullable(),
});

export const ProductWithSetAndSKUsResponseSchema =
  ProductBaseResponseSchema.extend({
    set: SetBaseResponseSchema,
    skus: z.array(SKUBaseResponseSchema),
  });

export const SKUWithProductResponseSchema = SKUBaseResponseSchema.extend({
  product: ProductWithSetAndSKUsResponseSchema,
});

export const ProductSearchResponseSchema = z.object({
  results: z.array(ProductWithSetAndSKUsResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type PrintingResponse = z.infer<typeof PrintingResponseSchema>;
export type LanguageResponse = z.infer<typeof LanguageResponseSchema>;
export type ConditionResponse = z.infer<typeof ConditionResponseSchema>;
export type SetBaseResponse = z.infer<typeof SetBaseResponseSchema>;
export type SKUBaseResponse = z.infer<typeof SKUBaseResponseSchema>;
export type ProductBaseResponse = z.infer<typeof ProductBaseResponseSchema>;
export type ProductWithSetAndSKUsResponse = z.infer<
  typeof ProductWithSetAndSKUsResponseSchema
>;
export type SKUWithProductResponse = z.infer<
  typeof SKUWithProductResponseSchema
>;
export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>;

export type { SKUMarketDataItem } from "@/features/market/types";
