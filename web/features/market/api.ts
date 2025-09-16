import { API_URL } from "@/app/api/fetcher";
import { ProductWithSetAndSKUsResponse } from "@/app/catalog/schemas";
import { MarketDataResponseSchemaType } from "@/app/market/schemas";

export async function fetchProduct(
  sku: string,
): Promise<ProductWithSetAndSKUsResponse> {
  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  return response.json();
}

export async function fetchMarketData(
  sku: string,
  salesLookbackDays: number = 7,
): Promise<MarketDataResponseSchemaType> {
  const response = await fetch(
    `${API_URL}/market/products/${sku}?sales_lookback_days=${salesLookbackDays}`,
  );
  return response.json();
}
