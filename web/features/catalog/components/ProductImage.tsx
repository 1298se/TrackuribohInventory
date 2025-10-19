"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { ProductType } from "@/features/catalog/types";
import Image from "next/image";

interface ProductImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackClassName?: string;
  productType?: ProductType;
}

/**
 * A component for displaying product images with a proper fallback
 */
export function ProductImage({
  src,
  alt,
  className,
  containerClassName,
  fallbackClassName,
  productType,
  ...props
}: ProductImageProps) {
  const [hasError, setHasError] = React.useState(false);

  const handleError = () => {
    setHasError(true);
  };

  const shouldUsePokemonBack = productType === "CARDS";

  return (
    <div className={cn("relative h-16 w-16", containerClassName)} {...props}>
      {!hasError ? (
        // Needs to be dynamic bc pulling from TCGPlayer, will move to own bucket later
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-contain rounded-sm", className)}
          onError={handleError}
        />
      ) : shouldUsePokemonBack ? (
        <Image
          src="/assets/placeholder-pokemon-back.png"
          alt="Pokemon card back"
          fill
          className={cn("object-contain rounded-sm", className)}
        />
      ) : (
        <div
          className={cn(
            "h-full w-full flex items-center justify-center rounded-xs bg-white border",
            fallbackClassName
          )}
        >
          <div className="flex flex-col items-center justify-center p-1 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mt-1">No image</span>
          </div>
        </div>
      )}
    </div>
  );
}
