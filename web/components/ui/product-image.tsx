'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface ProductImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackClassName?: string;
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
  ...props
}: ProductImageProps) {
  const [hasError, setHasError] = React.useState(false);

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div className={cn('relative h-16 w-16', containerClassName)} {...props}>
      {!hasError ? (
        <img
          src={src}
          alt={alt}
          className={cn('h-full w-full object-contain rounded-md', className)}
          onError={handleError}
        />
      ) : (
        <div 
          className={cn(
            'h-full w-full flex items-center justify-center rounded-md bg-muted border', 
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