import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import { formatCurrency } from "@/shared/utils";
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
};

export function DisplayCard({ card }: { card: DisplayCardProps }) {
  return (
    <Link href={`/market/${card.productId}`}>
      <div className="w-[250px]">
        <CardContent className="px-0 py-0 w-full">
          <div className="w-[250px] h-[150px] flex items-center justify-center bg-white rounded-md border">
            <ProductImage
              src={getLargeTCGPlayerImage({ imageUrl: card.image_url })}
              alt={card.name}
              containerClassName="w-full h-full"
              className="object-contain"
            />
          </div>
        </CardContent>
        <div>
          <div className="pt-2 flex flex-col gap-0.5">
            <p className="text-sm">{card.name}</p>
            <p className="text-muted-foreground text-xs">{card.number}</p>

            <Separator className="mt-1" />
            <p className="font-semibold text-lg">
              {formatCurrency(card.price)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
