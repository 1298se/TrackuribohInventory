"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ProductDetails } from "@/features/inventorySearch/components/ProductDetails";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string;

  return <ProductDetails productId={productId} />;
}
