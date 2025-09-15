import { API_URL } from "@/app/api/fetcher";
import {
  MarketDataResponseSchemaType,
  ProductWithSetAndSKUsResponse,
} from "@/app/catalog/schemas";

export async function fetchProduct(
  sku: string
): Promise<ProductWithSetAndSKUsResponse> {
  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  return response.json();
}

export async function fetchMarketData(
  sku: string,
  salesLookbackDays: number = 7
): Promise<MarketDataResponseSchemaType> {
  const response = await fetch(
    `${API_URL}/catalog/product/${sku}/market-data?sales_lookback_days=${salesLookbackDays}`
  );
  return response.json();
}
