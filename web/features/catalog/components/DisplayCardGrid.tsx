import { EmptyState } from "@/shared/components/EmptyState";
import { Search } from "lucide-react";
import {
  DisplayCard,
  DisplayCardProps,
  DisplayCardSkeleton,
} from "@/features/catalog/components/DisplayCard";
import { ReactNode } from "react";

export function DisplayCardGrid({ cards }: { cards: DisplayCardProps[] }) {
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
    <DisplayCardGridLayout>
      {cards.map((product) => (
        <DisplayCard key={product.decisionId} card={product} />
      ))}
    </DisplayCardGridLayout>
  );
}

export function DisplayCardGridSkeleton() {
  return (
    <DisplayCardGridLayout>
      {Array.from({ length: 10 }).map((_, index) => (
        <DisplayCardSkeleton key={index} />
      ))}
    </DisplayCardGridLayout>
  );
}

function DisplayCardGridLayout({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-3">{children}</div>;
}
