"use client";

import React from "react";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { Badge } from "@/shadcn/ui/badge";

interface ProductHeaderProps {
  imageUrl: string;
  name: string;
  badgeContent?: string;
  setName: string;
  setNumber?: string | null;
  details?: string;
}

export function ProductHeader({
  imageUrl,
  name,
  badgeContent,
  setName,
  setNumber,
  details,
}: ProductHeaderProps) {
  return (
    <div className="flex w-full items-start gap-4">
      <div className="shrink-0">
        <ProductImage
          src={imageUrl}
          alt={name}
          containerClassName="h-24 w-auto max-w-24 rounded-md overflow-hidden"
        />
      </div>
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          {badgeContent && <Badge>{badgeContent}</Badge>}
        </div>
        <span className="text-sm text-muted-foreground">
          {setName}
          {setNumber ? ` (${setNumber})` : ""}
        </span>
        {details && (
          <div className="text-sm text-muted-foreground">{details}</div>
        )}
      </div>
    </div>
  );
}
