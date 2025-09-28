"use client";

import { formatCurrency, isTruthy } from "@/shared/utils";
import { ProductListingResponse } from "@/features/market/types";
import {
  type ConditionFilter,
  getConditionRank,
  getConditionColor,
  getConditionDisplayName,
  CONDITION_TYPES,
} from "../utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface MarketListingsTableConditionsProps {
  listings: ProductListingResponse[];
  selectedCondition?: ConditionFilter;
  onConditionSelect: (condition: ConditionFilter) => void;
}

interface ConditionData {
  name: ConditionFilter;
  count: number;
  averagePrice: number;
}

export function MarketListingsTableConditions({
  listings,
  selectedCondition,
  onConditionSelect,
}: MarketListingsTableConditionsProps) {
  // Group listings by condition and calculate stats using reduce
  const conditionData: ConditionData[] = Object.values(CONDITION_TYPES)
    .map((conditionType) => {
      const conditionListings = listings.filter(
        (listing) => listing.sku.condition.name === conditionType
      );

      if (conditionListings.length === 0) {
        return null;
      }

      const totalPrice = conditionListings.reduce((sum, listing) => {
        return sum + listing.price;
      }, 0);

      return {
        name: conditionType,
        count: conditionListings.length,
        averagePrice: totalPrice / conditionListings.length,
      };
    })
    .filter(isTruthy);

  conditionData.sort(
    (a, b) => getConditionRank(b.name!) - getConditionRank(a.name!)
  );

  return (
    <Tabs
      value={selectedCondition || "all"}
      onValueChange={(value) =>
        onConditionSelect(value === "all" ? null : (value as ConditionFilter))
      }
      className="mb-4"
    >
      <TabsList>
        <TabsTrigger value="all" className="flex gap-2 items-center">
          All
          <Badge
            variant="outline"
            className="flex gap-2 items-center text-[10px] text-muted-foreground"
          >
            {listings.length}
          </Badge>
        </TabsTrigger>
        {conditionData.map((condition) => (
          <TabsTrigger key={condition.name} value={condition.name as string}>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getConditionColor(
                  condition.name as string
                )}`}
              />
              <span>{getConditionDisplayName(condition.name as string)}</span>
              <Badge
                variant="outline"
                className="flex gap-2 items-center text-xs"
              >
                {formatCurrency(condition.averagePrice)}{" "}
                <span className="text-[10px] text-muted-foreground">
                  {condition.count}
                </span>
              </Badge>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
