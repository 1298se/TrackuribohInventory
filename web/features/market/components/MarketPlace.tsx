"use client";

import { CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { getLargeTCGPlayerImage } from "../utils";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/app/api/fetcher";
import { BuyDecisionsResponseSchemaType } from "../schemas";
import { formatCurrency } from "@/shared/utils";
import { EmptyState } from "@/shared/components/EmptyState";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketPlace() {
  const { data: decisionsResponse, isLoading } =
    useQuery<BuyDecisionsResponseSchemaType>({
      queryKey: ["decisions"],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/buy-decisions`);
        return response.json();
      },
    });

  const cardDecisions =
    decisionsResponse?.decisions.map((decision) => {
      return {
        decisionId: decision.id,
        productId: decision.sku.product.id,
        name: decision.sku.product.name,
        number: decision.sku.product.number,
        image_url: decision.sku.product.image_url,
        set: {
          name: decision.sku.product.set.name,
          id: decision.sku.product.set.id,
        },
        price: decision.buy_vwap,
      } satisfies DisplayCardProps;
    }) ?? [];

  return (
    <section className="flex flex-col gap-4 m-8">
      <DisplayCardsSection cards={cardDecisions} isLoading={isLoading} />
    </section>
  );
}

type DisplayCardProps = {
  decisionId: string;
  productId: string;
  name: string;
  number: string | null;
  image_url: string;
  set: {
    name: string;
    id: string;
  };
  price: number;
};

function DisplayCardsSection({
  cards,
  isLoading,
}: {
  cards: DisplayCardProps[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-6 place-items-center">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-4">
            <Skeleton className="h-[277px] w-[195px] rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-full mb-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards found"
        description="Try searching for a different Pokemon name or set"
        icon={Search}
        action={
          <div className="text-xs text-muted-foreground">
            Try &quot;Pikachu&quot;, &quot;Charizard&quot;, or &quot;Base
            Set&quot;
          </div>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-5 gap-6 place-items-center">
      {cards.map((product) => (
        <DisplayCard key={product.decisionId} card={product} />
      ))}
    </div>
  );
}

function DisplayCard({ card }: { card: DisplayCardProps }) {
  return (
    <Link href={`/market/${card.productId}`} className="h-[360px] w-[200px]">
      <div className="w-[200px]">
        <CardContent className="px-0 py-0 w-full">
          <div className="w-[200px] h-[280px] flex items-center justify-center bg-muted bg-gradient-to-t from-muted/5 rounded-md border">
            <Image
              src={getLargeTCGPlayerImage({ imageUrl: card.image_url })}
              alt={card.name}
              width={200}
              height={280}
              className="rounded-md shadow-2xl outline-2 outline-sidebar-border"
            />
          </div>
        </CardContent>
        <div>
          <div className="pt-1">
            <p className="mb-0 text-xs text-muted-foreground">{card.number}</p>
            <p className="font-semibold text-xs">{card.name}</p>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {formatCurrency(card.price)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
