// Market Data Schemas
import { z } from "zod";

// Import SKU base schema from catalog since market data depends on SKU structure
import { SKUBaseSchema } from "@/app/catalog/schemas";

// Marketplace enum schema to match backend
export const MarketplaceSchema = z.enum(["tcgplayer"]);
export type Marketplace = z.infer<typeof MarketplaceSchema>;

/* -----------------------------------------------------
 * Market Data Schemas
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
  marketplace: MarketplaceSchema,
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
