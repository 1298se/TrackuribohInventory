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
import { MarketLevelingChart } from "./MarketLevelingChart";

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
        <CardTitle>Price leveling</CardTitle>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
