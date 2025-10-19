"use client"; // Keep client directive for consistency for now

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";

// --- Financial Metric Card Component ---

export interface MetricCardProps {
  title: ReactNode;
  value?: ReactNode;
  subtitle?: ReactNode;
  icon?: React.ElementType;
  valuePrefix?: string;
  valueColorClass?: string;
  isLoading?: boolean; // Added isLoading prop
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueColorClass,
  isLoading,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          {/* Title Skeleton */}
          <Skeleton className="h-4 w-3/4 mb-1" />
          {/* Main Value Skeleton */}
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        {/* Subtitle Skeleton */}
        <CardContent>
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-2">
      <CardHeader className="pb-2">
        <CardDescription className="flex justify-between items-center">
          {title} {/* Title is always needed, even if loading */}
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </CardDescription>
        <CardTitle className={cn("text-2xl font-bold", valueColorClass)}>
          {value}
        </CardTitle>
      </CardHeader>
      {/* Conditionally render CardContent only if subtitle exists */}
      {subtitle && (
        <CardContent>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </CardContent>
      )}
    </Card>
  );
}
