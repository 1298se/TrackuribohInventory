import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { cn } from "@/lib/utils";

interface InventoryMetricCardProps {
  title: string;
  value?: string | number | null;
  subtitle?: string | null;
  subtitleVariant?: "default" | "success" | "danger";
  isLoading?: boolean;
}

export function InventoryMetricCard({
  title,
  value,
  subtitle,
  subtitleVariant = "default",
  isLoading,
}: InventoryMetricCardProps) {
  return (
    <Card className="@container/card" data-slot="card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? <Skeleton className="h-6 w-24" /> : (value ?? "N/A")}
        </CardTitle>
        {subtitle && !isLoading && (
          <p
            className={cn(
              "text-sm mt-1",
              subtitleVariant === "success" && "text-green-600",
              subtitleVariant === "danger" && "text-red-600",
              subtitleVariant === "default" && "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        )}
      </CardHeader>
    </Card>
  );
}
