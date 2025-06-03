import React from "react";
import { BarChart as BarChartIcon } from "lucide-react";

interface EmptyStateProps {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  message,
  icon: Icon = BarChartIcon,
}: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-sm text-muted-foreground">
        <Icon className="mx-auto mb-2 h-8 w-8" />
        {message}
      </div>
    </div>
  );
}
