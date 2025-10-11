import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import { formatCurrency } from "@/shared/utils";
import { ProductType } from "@/features/catalog/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

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
  const isSealed = card.product_type === "SEALED";

  return (
    <Link href={`/market/${card.productId}`} className="w-auto">
      <Card className="p-4 flex flex-row gap-4">
        <CardContent className="px-0 py-0 w-[120px] flex justify-center rounded-md">
          <div
            className={`w-[120px] h-[160px] flex items-center justify-center rounded-md ${
              isSealed && "bg-white p-2"
            }`}
          >
            <ProductImage
              src={getLargeTCGPlayerImage({ imageUrl: card.image_url })}
              alt={card.name}
              containerClassName="w-full h-full"
              className="object-contain"
              productType={card.product_type}
            />
          </div>
        </CardContent>
        <div className="pt-0 flex flex-col">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {card.name}
          </p>
          <p className="font-semibold text-lg tracking-wide">
            {formatCurrency(card.price)}
          </p>
        </div>
      </Card>
    </Link>
  );
}

export function DisplayCardSkeleton() {
  return (
    <Card className="p-4 flex flex-row gap-4 w-full">
      <CardContent className="px-0 py-0 w-[120px] flex justify-center rounded-md">
        <Skeleton className="w-[120px] h-[160px] rounded-md" />
      </CardContent>
      <div className="pt-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
    </Card>
  );
}
