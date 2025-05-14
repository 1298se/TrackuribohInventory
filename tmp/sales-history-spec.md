# Sales History Bar Chart Implementation Spec

## 1. Overview

We will add a Sales History bar chart to the **Market Data** tab of the product detail page (`page.tsx`). The chart will visualize historical sales volume over time for the selected marketplace and SKU (or aggregated across SKUs). It will sit below the existing **Market Depth** component, using a similar design language (Cards, Filters, Recharts, SWR hooks).

Goals:

- Surface historical sales velocity to complement current depth data
- Reuse project conventions (SWR hooks, Zod schemas, Recharts + `ChartContainer`, ShadCN `Card`)
- Keep filters (marketplace & SKU) in sync or clearly duplicated

## 2. Placement & Information Architecture

Inside `web/app/catalog/product/[productId]/page.tsx`, in the `<TabsContent value="market">` section:
This same placement logic applies to an inventory-specific view like `web/app/inventory/[inventoryItemId]/inventory-item-details.tsx`, where the sales history would be for the specific SKU of the inventory item. The chart would be placed within the "Market Data" tab, below the market depth chart.

```tsx
<TabsContent value="market" className="mt-4 space-y-6">
  <MarketDepthWithMetrics
  // Props for MarketDepth, potentially including selectedMarketplace from lifted state
  />

  {/* SALES HISTORY CARD BELOW */}
  <SalesHistoryWithMetrics
    // For an inventory item, this would be the SKU ID of the item
    skuId={inventoryItem.sku.id}
    // This would come from a lifted state, shared with MarketDepthWithMetrics
    selectedMarketplace={selectedMarketplace}
    // other props like days, resolution
  />
</TabsContent>
```

We wrap the new chart in its own `Card` to separate concerns and maintain consistency.

## 3. API & Hook

### 3.1. Backend Endpoint

Add a new FastAPI endpoint to `/app/routes/catalog/api.py`:

```python
@router.get(
    "/{product_id}/sales-history",
    response_model=SalesHistoryResponseSchema,
)
def get_product_sales_history(
    product_id: UUID,
    marketplace: str | None = None,
    sku_id: UUID | None = None,
    days: int = 30,
    resolution: Literal['daily','weekly'] = 'daily',
    session: Session = Depends(get_db_session),
):
    # Query sales history from database (group by date)
    return SalesHistoryResponseSchema(sales_history=...)
```

Define Pydantic schema in `app/routes/catalog/schemas.py`:

```python
class SalesHistoryPointSchema(BaseModel):
    date: datetime
    sales_count: int

class SalesHistoryResponseSchema(BaseModel):
    sales_history: list[SalesHistoryPointSchema]
```

### 3.2. Frontend Zod Schemas

In `web/app/catalog/schemas.ts` (append at end):

```ts
// --- Sales History Schemas ---
export const SalesHistoryPointSchema = z.object({
  date: z.string().datetime(),
  sales_count: z.number(),
});
export type SalesHistoryPoint = z.infer<typeof SalesHistoryPointSchema>;

export const SalesHistoryResponseSchema = z.object({
  sales_history: z.array(SalesHistoryPointSchema),
});
export type SalesHistoryResponse = z.infer<typeof SalesHistoryResponseSchema>;
```

### 3.3. SWR Hook

In `web/app/catalog/api.ts`, add:

```ts
import { SalesHistoryResponseSchema, SalesHistoryResponse } from "./schemas";

export function useProductSalesHistory(
  productId: UUID | undefined,
  marketplace?: string,
  skuId?: string,
  days: number = 30,
  resolution: "daily" | "weekly" = "daily",
) {
  const params: Record<string, string> = { days: String(days), resolution };
  if (marketplace) params.marketplace = marketplace;
  if (skuId && skuId !== "aggregated") params.sku_id = skuId;

  const key = productId
    ? [`/catalog/product/${productId}/sales-history`, params]
    : null;

  const {
    data,
    error,
    isValidating: isLoading,
  } = useSWR<SalesHistoryResponse, Error, [string, Record<string, string>]>(
    key,
    ([path, params]) =>
      fetcher({
        url: `${API_URL}${path}`,
        params,
        method: HTTPMethod.GET,
        schema: SalesHistoryResponseSchema,
      }),
  );

  return {
    data: data?.sales_history || [],
    error,
    isLoading,
  };
}
```

## 4. Component Design

### 4.1. SalesHistoryChart

Create `web/components/sales-history-chart.tsx`:

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesHistoryChartProps {
  data?: { date: string; sales_count: number }[];
  isLoading: boolean;
}

export function SalesHistoryChart({
  data = [],
  isLoading,
}: SalesHistoryChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[300px] w-full text-muted-foreground">
        No sales history available.
      </div>
    );
  }

  return (
    <ChartContainer
      id="sales-history-chart"
      config={{
        sales_count: { label: "Sales Count", color: "#10B981" },
      }}
      className="h-[300px] w-full"
    >
      <BarChart
        data={data.map(({ date, sales_count }) => ({
          date,
          salesCount: sales_count,
        }))}
        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={(d) => new Date(d).toLocaleDateString()}
        />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="salesCount" fill="#10B981" />
      </BarChart>
    </ChartContainer>
  );
}
```

### 4.2. SalesHistoryWithMetrics (Optional)

If we want to reuse marketplace/SKU filters, create a wrapper component mirroring `MarketDepthWithMetrics`.
It is **highly recommended** to lift the marketplace selection state to a common parent component that also contains `MarketDepthWithMetrics`. This single, shared marketplace filter (e.g., a `<Select>` component) would then control both the Market Depth and Sales History displays, ensuring a consistent user experience. The list of available marketplaces can be derived from `marketDataItems` (e.g., from the `useSkuMarketData` hook).

For a view like `inventory-item-details.tsx` which is specific to one SKU, a SKU filter within this component is not necessary. The `skuId` prop for fetching sales history would be fixed to the ID of the inventory item's SKU.

`web/components/SalesHistoryWithMetrics.tsx`:

```tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesHistoryChart } from "./sales-history-chart";
import { useProductSalesHistory } from "@/app/catalog/api";
import { SKUMarketDataItem } from "@/app/catalog/schemas";

interface Props {
  productId: string; // In an inventory item context, this would be the SKU ID.
  selectedMarketplace?: string; // Passed from the lifted state.
  // Potentially other props like 'days' and 'resolution' if they also need to be controlled globally or passed down.
}

export function SalesHistoryWithMetrics({
  productId,
  selectedMarketplace,
}: Props) {
  // The marketplace picker UI itself would live in the parent component.
  // This component would receive 'selectedMarketplace' as a prop.
  // The 'skuId' for useProductSalesHistory would effectively be 'productId'.
  // Fetch salesHistory using useProductSalesHistory, passing productId (as SKU ID) and selectedMarketplace.
  // ... implement similar to MarketDepthWithMetrics but using useProductSalesHistory hook
  // ... and using the passed 'selectedMarketplace' prop.
}
```

## 5. Page Updates

In `web/app/catalog/product/[productId]/page.tsx`:

1. Import hook and component:

   ```tsx
   import { useProductSalesHistory } from "@/app/catalog/api";
   import { SalesHistoryChart } from "@/components/sales-history-chart";
   // or import SalesHistoryWithMetrics
   ```

2. Call the hook inside the component, passing `productId`, `selectedMarketplace`, `selectedSkuId`:

   ```tsx
   const {
     data: salesHistory,
     isLoading: salesHistoryLoading,
     error: salesHistoryError,
   } = useProductSalesHistory(inventoryItem.sku.id, selectedMarketplace);
   ```

3. Render below the depth chart:

   ```tsx
   <Card>
     <CardHeader>
       <CardTitle>Sales History</nCardTitle>
       <CardDescription>
         Sales over time for { /* For inventory item, variant is fixed */ 'the current variant' }{' '}
         on {selectedMarketplace || 'all marketplaces (if applicable)'}.
       </CardDescription>
     </CardHeader>
     <CardContent>
       {salesHistoryError ? (
         <Alert variant="destructive">
           <AlertDescription>
             Failed to load sales history.
           </AlertDescription>
         </Alert>
       ) : (
         <SalesHistoryChart
           data={salesHistory}
           isLoading={salesHistoryLoading}
         />
       )}
     </CardContent>
   </Card>
   ```

4. Make sure to wrap the two cards in a vertical `space-y-6` container.

## 6. Styling & Responsiveness

- Use the same height (`h-[300px]`) for the chart skeleton and chart container.
- Ensure padding and margins match `MarketDepthWithMetrics` (`gap-6`, `mt-4`, etc.).
- Use `aspect-video` from `ChartContainer` to maintain aspect ratio.
- Cards should be full width on mobile, side-by-side at larger breakpoints if desired.

## 7. Testing

- **Hook Tests**: Add unit tests for `useProductSalesHistory` mocking SWR responses.
- **Component Tests**: Snapshot tests for `SalesHistoryChart` with sample data.
- **E2E**: Verify charts render in Storybook or manual QA across time ranges.

## 8. Future Improvements

- Add date-range picker (7d/30d/90d) to the filter bar.
- Allow switching resolution (daily/weekly/monthly).
- **Stacked Bar Chart for "All Marketplaces" View:**

  - **Concept:** When an "All Marketplaces" option is selected in the consolidated marketplace filter (or if no specific marketplace is chosen), display a stacked bar chart. Each bar (representing a date point) would be segmented by marketplace, showing each marketplace's contribution to the total sales for that day/week.
  - **Benefit:** Allows users to easily compare sales volumes across different marketplaces simultaneously over time without needing to repeatedly change the filter.
  - **Behavior with Single Marketplace Selection:** If a specific marketplace is selected, the chart would revert to a simple bar chart showing sales for only that marketplace.
  - **API & Schema Implications:**

    - **Backend Endpoint (`get_product_sales_history`):** Would need to be modified. If `marketplace` is `None` (or a special "all" value), the endpoint should return sales data grouped by date _and then by marketplace_ within each date point.
    - **Pydantic Schema (`SalesHistoryPointSchema` in `app/routes/catalog/schemas.py`):** Would need to change from a single `sales_count` to accommodate per-marketplace counts. For example:

      ```python
      class MarketplaceSalePoint(BaseModel):
          marketplace: str
          sales_count: int

      class SalesHistoryPointSchema(BaseModel):
          date: datetime
          # Option 1: A list of sales by marketplace
          sales_by_marketplace: list[MarketplaceSalePoint]
          # Option 2: Or, keep total and add a breakdown if preferred by charting library
          # total_sales_count: int
          # marketplace_breakdown: list[MarketplaceSalePoint] # if total_sales_count is also sent
      ```

    - **Frontend Zod Schema (`SalesHistoryPointSchema` in `web/app/catalog/schemas.ts`):** Would need a corresponding update to match the new backend structure, e.g.:
      ```ts
      export const MarketplaceSalePointSchema = z.object({
        marketplace: z.string(),
        sales_count: z.number(),
      });
      export const SalesHistoryPointSchema = z.object({
        date: z.string().datetime(),
        sales_by_marketplace: z.array(MarketplaceSalePointSchema),
      });
      ```
    - **SWR Hook (`useProductSalesHistory`):** The `SalesHistoryResponse` type and any data transformation logic would need to be updated to handle the new data structure.
    - **Chart Component (`SalesHistoryChart`):** Would require changes to render a stacked bar chart (e.g., using multiple `<Bar>` components in Recharts if `sales_by_marketplace` is an array within each data point).

- Tooltip and axis formatting improvements (currency, locale).
