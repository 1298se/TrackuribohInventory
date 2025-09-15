import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center py-12 px-8 ${className}`}
    >
      {Icon && (
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-muted/50 rounded-full blur-2xl scale-125" />
          <div className="relative bg-muted p-4 rounded-full border">
            <Icon className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="text-center max-w-sm space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
