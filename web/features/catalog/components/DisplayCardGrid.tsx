import { EmptyState } from "@/shared/components/EmptyState";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DisplayCard,
  DisplayCardProps,
} from "@/features/catalog/components/DisplayCard";

export function DisplayCardGrid({
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
    <div className="grid grid-cols-4 gap-6 place-items-center">
      {cards.map((product) => (
        <DisplayCard key={product.decisionId} card={product} />
      ))}
    </div>
  );
}
