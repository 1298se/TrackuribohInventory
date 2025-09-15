"use client";

import { CardContent } from "@/components/ui/card";
import { ProductBaseResponseSchema } from "@/app/catalog/schemas";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { getLargeTCGPlayerImage } from "../utils";

type ProductBaseResponseType = z.infer<typeof ProductBaseResponseSchema>;

export function MarketPlace() {
  // Pass empty array since search is now handled in the top nav
  const products: ProductBaseResponseType[] = [];

  return (
    <section className="flex flex-col gap-4 m-8">
      <DisplayCardsSection products={products} />
    </section>
  );
}

function DisplayCardsSection({
  products,
}: {
  products: ProductBaseResponseType[];
}) {
  if (products.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-20">
        <h2 className="text-xl">
          Use the search bar above to find Pokemon cards
        </h2>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-6 place-items-center">
      {products.map((product) => (
        <DisplayCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function DisplayCard({ product }: { product: ProductBaseResponseType }) {
  return (
    <Link href={`/market/${product.id}`} className="h-[360px] w-[200px]">
      <div className="w-[200px]">
        <CardContent className="px-0 py-0 w-full">
          <div className="w-[200px] h-[280px] flex items-center justify-center bg-muted bg-gradient-to-t from-muted/5 rounded-md border">
            <Image
              src={getLargeTCGPlayerImage({ imageUrl: product.image_url })}
              alt={product.name}
              width={200}
              height={280}
              className="rounded-md shadow-2xl outline-2 outline-sidebar-border"
            />
          </div>
        </CardContent>
        <div>
          <div className="pt-1">
            <p className="mb-0 text-xs text-muted-foreground">
              {product.number}
            </p>
            <p className="font-semibold text-xs">{product.name}</p>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">TCG Player</p>
            <p className="text-xs text-muted-foreground">$1200.0</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
