import {
  DisplayCard,
  DisplayCardProps,
  DisplayCardSkeleton,
} from "@/features/catalog/components/DisplayCard";
import { ReactNode } from "react";

export function DisplayCardGrid({ cards }: { cards: DisplayCardProps[] }) {
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {children}
    </div>
  );
}
