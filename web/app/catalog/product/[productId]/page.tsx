"use client";

import React from "react";
import { useParams } from "next/navigation";
import { UUID } from "crypto";

import { ProductDetails } from "@/app/catalog/components/product-details";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string as UUID;

  return <ProductDetails productId={productId} />;
}
