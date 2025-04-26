import { z } from "zod";
import { MoneySchema } from "../schemas";
import { TransactionTypeSchema } from "../transactions/schemas";
import {
  SKUWithProductResponseSchema,
  ProductSearchResponseSchema, // Keep if needed, otherwise remove
  ProductWithSetAndSKUsResponseSchema,
  CatalogSchema, // Import moved Catalog schemas
  CatalogsResponseSchema, // Import moved Catalog schemas
} from "../catalog/schemas";

/* -----------------------------------------------------
 * 1) Primitive Enums
 * ----------------------------------------------------- */
// REMOVED ProductTypeSchema definition

/* -----------------------------------------------------
 * 2) Basic Schemas (used by others)
 * ----------------------------------------------------- */

// REMOVED ConditionResponseSchema definition
// REMOVED PrintingResponseSchema definition
// REMOVED LanguageResponseSchema definition

/* -----------------------------------------------------
 * 3) Product, SKU, and Set Schemas
 * ----------------------------------------------------- */

// REMOVED SetBaseResponseSchema definition
// REMOVED SKUBaseResponseSchema definition
// REMOVED ProductWithSetAndSKUsResponseSchema definition
// REMOVED SKUWithProductResponseSchema definition
// REMOVED ProductSearchResponseSchema definition

/* -----------------------------------------------------
 * 5) Inventory Schemas
 * ----------------------------------------------------- */

// InventoryItemResponseSchema
export const InventoryItemResponseSchema = z.object({
  sku: SKUWithProductResponseSchema,
  quantity: z.number(),
  average_cost_per_item: MoneySchema,
  lowest_listing_price: MoneySchema.nullable(),
});

// InventoryResponseSchema
export const InventoryResponseSchema = z.object({
  inventory_items: z.array(InventoryItemResponseSchema),
});

// Inventory Item Detail Response Schema (identical to InventoryItemResponseSchema for now)
// In the future, this could be extended with additional fields specific to the detail view
export const InventoryItemDetailResponseSchema = InventoryItemResponseSchema;

// Inventory Item Update Request Schema
export const InventoryItemUpdateRequestSchema = z.object({
  quantity: z.number().int().min(0, "Quantity must be 0 or greater"),
  cost_per_item_amount: z.number().min(0, "Cost must be 0 or greater"),
});

// Type inference (Remove types related to moved schemas)
// export type ProductWithSetAndSKUsResponse = z.infer<typeof ProductWithSetAndSKUsResponseSchema>
export type InventoryItemResponse = z.infer<typeof InventoryItemResponseSchema>;
export type InventoryResponse = z.infer<typeof InventoryResponseSchema>;
// export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>
// export type SKUWithProductResponse = z.infer<typeof SKUWithProductResponseSchema>
export type InventoryItemDetailResponse = z.infer<
  typeof InventoryItemDetailResponseSchema
>;
export type InventoryItemUpdateRequest = z.infer<
  typeof InventoryItemUpdateRequestSchema
>;

/* -----------------------------------------------------
 * 6) Inventory SKU Transaction History Schemas
 * ----------------------------------------------------- */

export const InventorySKUTransactionLineItemSchema = z.object({
  transaction_id: z.string().uuid(),
  transaction_date: z.string().datetime(), // Assuming datetime comes as string
  transaction_type: TransactionTypeSchema,
  quantity: z.number().int(),
  unit_price: MoneySchema,
  platform_name: z.string().nullable(),
});

export const InventorySKUTransactionsResponseSchema = z.object({
  items: z.array(InventorySKUTransactionLineItemSchema),
  total: z.number().int(),
});

// Type inference for transaction history
export type InventorySKUTransactionLineItem = z.infer<
  typeof InventorySKUTransactionLineItemSchema
>;
export type InventorySKUTransactionsResponse = z.infer<
  typeof InventorySKUTransactionsResponseSchema
>;

export const InventoryMetricsResponseSchema = z.object({
  number_of_items: z.number(),
  total_inventory_cost: z.number(),
  total_market_value: z.number(),
  unrealised_profit: z.number(),
  currency: z.string(),
});

export type InventoryMetricsResponse = z.infer<
  typeof InventoryMetricsResponseSchema
>;
