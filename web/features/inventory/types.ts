import { SKUWithProductResponse } from "../catalog/types";

// Money types
export interface Money {
  amount: number;
  currency: string;
}

export interface MoneyAmount {
  amount: number;
  currency: string;
}

// Inventory price history
export interface InventoryPriceHistoryItem {
  datetime: string;
  price: Money;
}

// Inventory item types
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

export interface InventoryItemCreateRequest {
  sku_id: string;
  quantity: number;
  cost_per_item_amount: number;
}

// Transaction history types
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

// Metrics types
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
