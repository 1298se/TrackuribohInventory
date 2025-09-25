import { z } from "zod";
import { MoneySchema, MoneyAmountSchema } from "../../app/schemas";
import { TransactionTypeSchema } from "../../app/transactions/schemas";
import { SKUWithProductResponseSchema } from "../../app/catalog/schemas";

/* -----------------------------------------------------
 * Price History Schemas
 * ----------------------------------------------------- */

// Price History Item Schema (needs to be defined first)
const InventoryPriceHistoryItemSchema = z.object({
  datetime: z.string().datetime(),
  price: MoneySchema,
});

// InventoryItemResponseSchema
const InventoryItemResponseSchema = z.object({
  sku: SKUWithProductResponseSchema,
  quantity: z.number(),
  average_cost_per_item: MoneySchema,
  lowest_listing_price: MoneySchema.nullable(),
  price_change_7d_amount: MoneySchema.nullable(),
  price_change_7d_percentage: z.number().nullable(),
  price_history_7d: z.array(InventoryPriceHistoryItemSchema).nullable(),
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
export type InventoryItemResponse = z.infer<typeof InventoryItemResponseSchema>;
export type InventoryResponse = z.infer<typeof InventoryResponseSchema>;
export type InventoryItemDetailResponse = z.infer<
  typeof InventoryItemDetailResponseSchema
>;
export type InventoryItemUpdateRequest = z.infer<
  typeof InventoryItemUpdateRequestSchema
>;

/* -----------------------------------------------------
 * Inventory SKU Transaction History Schemas
 * ----------------------------------------------------- */

export const InventorySKUTransactionLineItemSchema = z.object({
  transaction_id: z.string().uuid(),
  counterparty_name: z.string(),
  transaction_date: z.string().datetime(), // Assuming datetime comes as string
  transaction_type: TransactionTypeSchema,
  quantity: z.number().int(),
  unit_price: MoneySchema,
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
  total_inventory_cost: MoneyAmountSchema,
  total_market_value: MoneyAmountSchema,
  unrealised_profit: MoneyAmountSchema,
  currency: z.string().default("USD"),
});

export type InventoryMetricsResponse = z.infer<
  typeof InventoryMetricsResponseSchema
>;

export const InventoryHistoryItemSchema = z.object({
  snapshot_date: z.string(),
  total_cost: z.number(),
  total_market_value: z.number(),
  unrealised_profit: z.number(),
});

export type InventoryHistoryItem = z.infer<typeof InventoryHistoryItemSchema>;

/* -----------------------------------------------------
 * 7) Inventory Price History Schemas
 * ----------------------------------------------------- */

export const InventoryPriceHistoryResponseSchema = z.object({
  items: z.array(InventoryPriceHistoryItemSchema),
});

export type InventoryPriceHistoryItem = z.infer<
  typeof InventoryPriceHistoryItemSchema
>;
export type InventoryPriceHistoryResponse = z.infer<
  typeof InventoryPriceHistoryResponseSchema
>;

/* -----------------------------------------------------
 * Inventory SKU Marketplaces Schema
 * ----------------------------------------------------- */

export const InventorySkuMarketplacesResponseSchema = z.object({
  marketplaces: z.array(z.string()),
});

export type InventorySkuMarketplacesResponse = z.infer<
  typeof InventorySkuMarketplacesResponseSchema
>;

export const MarketplaceSchema = z.enum(["tcgplayer"]);

export const DecisionSchema = z.enum(["BUY", "PASS"]);

export const BuyDecisionResponseSchema = z.object({
  id: z.string(),
  sku: SKUWithProductResponseSchema,
  decision: DecisionSchema,
  quantity: z.number(),
  buy_vwap: MoneyAmountSchema,
  expected_resale_net: MoneyAmountSchema,
  asof_listings: z.string().transform((val) => new Date(val)),
  asof_sales: z.string().transform((val) => new Date(val)),
  reason_codes: z.array(z.string()),
  created_at: z.string().transform((val) => new Date(val)),
});

export const BuyDecisionsResponseSchema = z.object({
  decisions: z.array(BuyDecisionResponseSchema),
  total_count: z.number(),
  filters_applied: z.record(z.any()),
});

export type BuyDecisionResponseSchemaType = z.infer<
  typeof BuyDecisionResponseSchema
>;
export type BuyDecisionsResponseSchemaType = z.infer<
  typeof BuyDecisionsResponseSchema
>;
/* -----------------------------------------------------
 * 9) Market product listings and sales schemas
 * ----------------------------------------------------- */

export const ProductListingResponseSchema = z.object({
  listing_id: z.string(),
  sku: SKUWithProductResponseSchema, // Full SKU with nested product
  price: MoneyAmountSchema,
  quantity: z.number().int(),
  shipping_price: MoneyAmountSchema.nullable(),
  seller_name: z.string().nullable(),
});

export const ProductListingsResponseSchema = z.object({
  results: z.array(ProductListingResponseSchema),
});

export const ProductSaleResponseSchema = z.object({
  sku: SKUWithProductResponseSchema,
  quantity: z.number().int(),
  price: MoneyAmountSchema,
  shipping_price: MoneyAmountSchema.nullable(),
  order_date: z.string().datetime(),
});

export const ProductSalesResponseSchema = z.object({
  results: z.array(ProductSaleResponseSchema),
});

export type ProductListingResponse = z.infer<
  typeof ProductListingResponseSchema
>;
export type ProductListingsResponse = z.infer<
  typeof ProductListingsResponseSchema
>;
export type ProductSaleResponse = z.infer<typeof ProductSaleResponseSchema>;
export type ProductSalesResponse = z.infer<typeof ProductSalesResponseSchema>;
