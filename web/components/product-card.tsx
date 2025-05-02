"use client";

import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { ProductWithSetAndSKUsResponse } from "@/app/catalog/schemas";
import { ProductImage } from "@/components/ui/product-image";

interface ProductCardProps {
  product: ProductWithSetAndSKUsResponse;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/catalog/product/${product.id}`} className="block h-full">
      <Card className="h-full flex flex-col px-1 hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-col items-center px-0">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            containerClassName="h-32 w-32"
          />
          <CardTitle className="text-lg text-center">{product.name}</CardTitle>
          <CardDescription className="w-full text-center text-muted-foreground">
            {product.number && (
              <p className="text-xs font-mono text-muted-foreground">
                {product.number}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{product.set.name}</p>
            {product.rarity && (
              <p className="text-sm text-muted-foreground">{product.rarity}</p>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
