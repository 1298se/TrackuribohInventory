import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketLevelingChart } from "./MarketLevelingChart";
import { formatCurrency } from "@/shared/utils";
import { TrendingUp, Calculator, Target, DollarSign } from "lucide-react";

export function MarketLevelsChartCard({
  listingsCumulativeDepth,
  currentPrice,
  isLoading,
}: {
  listingsCumulativeDepth:
    | { price: number; cumulativeCount: number }[]
    | undefined;
  currentPrice?: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Price leveling
        </CardTitle>
        <CardDescription>
          See how many listings need to be sold to reach different price points
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 w-full">
        {isLoading ? (
          <Skeleton className="w-full mb-1 h-[240px]" />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            <div className="flex-1">
              {listingsCumulativeDepth && (
                <MarketLevelingChart
                  listingsCumulativeDepth={listingsCumulativeDepth}
                  currency="USD"
                />
              )}
            </div>

            {listingsCumulativeDepth && currentPrice && (
              <PriceCalculator
                listingsCumulativeDepth={listingsCumulativeDepth}
                currentPrice={currentPrice}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriceCalculator({
  listingsCumulativeDepth,
  currentPrice,
}: {
  listingsCumulativeDepth:
    | { price: number; cumulativeCount: number }[]
    | undefined;
  currentPrice?: number;
}) {
  // Calculate default target price between market price and low reference line
  const [targetPrice, setTargetPrice] = useState<string>(() => {
    if (
      !listingsCumulativeDepth ||
      !currentPrice ||
      listingsCumulativeDepth.length === 0
    ) {
      return "";
    }

    // Calculate the low reference line price (33% of price range from min)
    const prices = listingsCumulativeDepth.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const lowReferencePrice = minPrice + priceRange * 0.33;

    // Default price is halfway between current price and low reference line
    const defaultPrice =
      currentPrice + (lowReferencePrice - currentPrice) * 0.5;
    return defaultPrice.toFixed(2);
  });

  function calculateListingsToTarget(target: number) {
    if (!listingsCumulativeDepth) return null;

    // Find how many listings need to be sold to reach the target price
    const targetDataPoint = listingsCumulativeDepth.find(
      (item) => item.price >= target
    );

    if (!targetDataPoint) return null;

    const listingsToSell = targetDataPoint.cumulativeCount;

    return {
      listingsToSell,
    };
  }

  const targetPriceNum = parseFloat(targetPrice);
  const listingsToTarget =
    targetPriceNum && !isNaN(targetPriceNum)
      ? calculateListingsToTarget(targetPriceNum)
      : null;

  return (
    <div className="w-full lg:w-80 space-y-4">
      <div className="space-y-2 flex flex-col">
        <Label htmlFor="target-price" className="text-sm font-medium">
          Target price calculator
        </Label>
        <Input
          id="target-price"
          type="number"
          placeholder="Enter target price"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Current market price
        </span>
        <span className="text-xs font-medium">
          {formatCurrency(currentPrice)}
        </span>
      </div>

      <Separator />

      <Alert>
        <AlertDescription className="space-y-3">
          <div>
            <h4 className="font-medium flex justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Listings sold to reach
              </span>
              <span className="font-bold">
                {listingsToTarget
                  ? formatCurrency(targetPriceNum)
                  : formatCurrency(0)}
              </span>
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Listings to sell
              </span>
              <span className="font-bold">
                {listingsToTarget?.listingsToSell ?? 0}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
