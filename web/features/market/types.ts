// Types for the Market feature module
import { SKUWithProductResponse } from "../catalog/types";

/* -----------------------------------------------------
 * Market Data Types
 * ----------------------------------------------------- */
export interface CumulativeDepthLevel {
  price: number;
  cumulative_count: number; // Use snake_case from backend
}

export interface SaleCumulativeDepthLevel {
  price: number;
  cumulative_count: number;
}

export interface SKUMarketData {
  total_listings: number;
  total_quantity: number;
  total_sales: number;
  sales_velocity: number;
  days_of_inventory?: number | null;
  cumulative_depth_levels: CumulativeDepthLevel[];
  cumulative_sales_depth_levels: SaleCumulativeDepthLevel[];
}

export interface SKUMarketDataItem {
  marketplace: string;
  sku: SKUWithProductResponse;
  market_data: SKUMarketData;
}

export interface MarketDataResponse {
  market_data_items: SKUMarketDataItem[];
}

/* -----------------------------------------------------
 * Inventory Types
 * ----------------------------------------------------- */
export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface InventoryPriceHistoryItem {
  datetime: string;
  price: Money;
}

export interface InventoryItemResponse {
  sku: SKUWithProductResponse;
  quantity: number;
  average_cost_per_item: Money;
  lowest_listing_price: Money | null;
  price_change_7d_amount: Money | null;
  price_change_7d_percentage: number | null;
  price_history_7d: InventoryPriceHistoryItem[] | null;
}

export interface InventoryResponse {
  inventory_items: InventoryItemResponse[];
}

export interface InventoryItemDetailResponse extends InventoryItemResponse {}

export interface InventoryItemUpdateRequest {
  quantity: number;
  cost_per_item_amount: number;
}

/* -----------------------------------------------------
 * Transaction History Types
 * ----------------------------------------------------- */
export type TransactionType = "PURCHASE" | "SALE";

export interface InventorySKUTransactionLineItem {
  transaction_id: string;
  counterparty_name: string;
  transaction_date: string;
  transaction_type: TransactionType;
  quantity: number;
  unit_price: Money;
}

export interface InventorySKUTransactionsResponse {
  items: InventorySKUTransactionLineItem[];
  total: number;
}

export interface InventoryMetricsResponse {
  number_of_items: number;
  total_inventory_cost: MoneyAmount;
  total_market_value: MoneyAmount;
  unrealised_profit: MoneyAmount;
  currency: string;
}

export interface InventoryHistoryItem {
  snapshot_date: string;
  total_cost: number;
  total_market_value: number;
  unrealised_profit: number;
}

export interface InventoryPriceHistoryResponse {
  items: InventoryPriceHistoryItem[];
}

export interface InventorySkuMarketplacesResponse {
  marketplaces: string[];
}

/* -----------------------------------------------------
 * Buy Decision Types
 * ----------------------------------------------------- */
export type Marketplace = "tcgplayer";

export type Decision = "BUY" | "PASS";

export interface BuyDecisionResponse {
  id: string;
  sku: SKUWithProductResponse;
  decision: Decision;
  quantity: number;
  buy_vwap: MoneyAmount;
  expected_resale_net: MoneyAmount;
  asof_listings: Date;
  asof_sales: Date;
  reason_codes: string[];
  created_at: Date;
}

export interface BuyDecisionsResponse {
  decisions: BuyDecisionResponse[];
  total_count: number;
  filters_applied: Record<string, any>;
}

/* -----------------------------------------------------
 * Product Listings and Sales Types
 * ----------------------------------------------------- */
export interface ProductListingResponse {
  listing_id: string;
  sku: SKUWithProductResponse;
  price: MoneyAmount;
  quantity: number;
  shipping_price: MoneyAmount | null;
  seller_name: string | null;
}

export interface ProductListingsResponse {
  results: ProductListingResponse[];
}

export interface ProductSaleResponse {
  sku: SKUWithProductResponse;
  quantity: number;
  price: MoneyAmount;
  shipping_price: MoneyAmount | null;
  order_date: string;
}

export interface ProductSalesResponse {
  results: ProductSaleResponse[];
}
