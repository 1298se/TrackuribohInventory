"use client";

import { CardFooter } from "@/shadcn/ui/card";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { getSetPriceComparisonQuery } from "@/features/catalog/api";
import { formatCurrency, formatPercentage } from "@/shared/utils";

interface StatCard {
  description: ReactNode;
  value: string | null;
  historicalValue: string | null;
  footer: React.ReactNode;
  delta?: string;
  isIncrease?: boolean;
}

interface StatCardsProps {
  setId: string;
}

export function MarketPlaceTopStatCardsSection({ setId }: StatCardsProps) {
  const { data: priceComparisonData, isLoading } = useQuery(
    getSetPriceComparisonQuery(setId, 30),
  );

  const dynamicStatCards: StatCard[] = [
    {
      description: "Total Market Value",
      value: priceComparisonData?.current_total_market_value
        ? formatCurrency(priceComparisonData.current_total_market_value)
        : null,
      footer: priceComparisonData?.historical_total_market_value
        ? formatCurrency(priceComparisonData.historical_total_market_value)
        : null,
      historicalValue: priceComparisonData?.historical_total_market_value
        ? formatCurrency(priceComparisonData.historical_total_market_value)
        : null,
      delta: priceComparisonData?.growth_percentage
        ? formatPercentage(priceComparisonData.growth_percentage)
        : undefined,
      isIncrease: priceComparisonData?.growth_percentage
        ? priceComparisonData.growth_percentage > 0
        : true,
    },
    {
      description: priceComparisonData?.current_top_priced_card ? (
        <>
          Top Chase Card:{" "}
          {/* TODO: switch to product variant URL once MarketPlace is live */}
          <Link
            href={`/market/${priceComparisonData.current_top_priced_card.sku_id}`}
            className="underline"
          >
            {priceComparisonData.current_top_priced_card.product_name}
          </Link>
        </>
      ) : null,
      value: priceComparisonData?.current_top_priced_card
        ? formatCurrency(priceComparisonData.current_top_priced_card.price)
        : null,
      historicalValue: priceComparisonData?.historical_top_priced_card
        ? formatCurrency(priceComparisonData.historical_top_priced_card.price)
        : null,
      footer: priceComparisonData?.historical_top_priced_card
        ? formatCurrency(priceComparisonData.historical_top_priced_card.price)
        : null,
      delta: priceComparisonData?.top_card_growth_percentage
        ? formatPercentage(priceComparisonData.top_card_growth_percentage)
        : undefined,
      isIncrease: priceComparisonData?.top_card_growth_percentage
        ? priceComparisonData.top_card_growth_percentage > 0
        : true,
    },
  ];

  if (isLoading) {
    return (
      <StatCardContainer>
        {dynamicStatCards.map((card, index) => (
          <Card key={index} className="@container/card relative gap-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-xs pt-0">
              <Skeleton className="h-3 w-40" />
            </CardFooter>
          </Card>
        ))}
      </StatCardContainer>
    );
  }

  return (
    <StatCardContainer>
      {dynamicStatCards.map((card, index) => (
        <StatCard key={index} card={card} />
      ))}
    </StatCardContainer>
  );
}

function StatCardContainer({ children }: { children: ReactNode }) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
      {children}
    </div>
  );
}

function StatCard({ card }: { card: StatCard }) {
  return (
    <Card className="relative gap-2 h-[125px]">
      <CardHeader className="">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardDescription className="text-xs">
              {card.description}
            </CardDescription>
            <CardTitle className="text-xl font-semibold flex items-baseline gap-2">
              {card.value}
            </CardTitle>
          </div>
          {card.delta && (
            <div
              className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${
                card.isIncrease
                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {card.delta}
            </div>
          )}
        </div>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-xs pt-0">
        <div className="text-muted-foreground"> 1 mo. ago {card.footer}</div>
      </CardFooter>
    </Card>
  );
}
