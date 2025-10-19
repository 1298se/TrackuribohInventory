import { Card, CardContent, CardFooter } from "@/shadcn/ui/card";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import { formatCurrency } from "@/shared/utils";
import { ProductType } from "@/features/catalog/types";
import { Skeleton } from "@/shadcn/ui/skeleton";
import Link from "next/link";
import { Button } from "@/shadcn/ui/button";
import { PlusIcon } from "lucide-react";

export type DisplayCardProps = {
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
  product_type: ProductType;
};

export function DisplayCard({ card }: { card: DisplayCardProps }) {
  return (
    <Card className="p-3 gap-2 h-[300px] relative">
      <Link
        href={`/market/${card.productId}`}
        className="absolute inset-0 z-0"
      />
      <CardContent className="px-0 py-0 w-full flex justify-center rounded-md bg-white p-2 border relative z-10 pointer-events-none">
        <div
          className={`w-[120px] h-[160px] flex items-center justify-center rounded-md`}
        >
          <ProductImage
            src={getLargeTCGPlayerImage({ imageUrl: card.image_url })}
            alt={card.name}
            containerClassName="w-full h-full rounded-sm"
            className="object-contain"
            productType={card.product_type}
          />
        </div>
      </CardContent>
      <CardFooter className="p-0 h-full flex flex-col justify-between items-start relative z-10 pointer-events-none">
        <div>
          <p className="text-sm font-medium tracking-wide">{card.name}</p>
          <p className="text-xs text-muted-foreground">{card.set.name}</p>
        </div>

        <div className="flex justify-between w-full">
          <p className="font-semibold text-lg">{formatCurrency(card.price)}</p>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8 pointer-events-auto"
            aria-label={`Add ${card.name} to inventory`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export function DisplayCardSkeleton() {
  return (
    <Card className="p-3 gap-2 h-[300px]">
      <CardContent className="px-0 py-0 w-full flex justify-center rounded-md bg-muted p-2 border">
        <Skeleton className="w-[120px] h-[160px] rounded-md" />
      </CardContent>
      <CardFooter className="p-0 h-full flex flex-col justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex justify-between w-full">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="w-8 h-8 rounded-md" />
        </div>
      </CardFooter>
    </Card>
  );
}
