import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryMetricCardProps {
  title: string;
  value?: string | number | null;
  isLoading?: boolean;
}

export function InventoryMetricCard({
  title,
  value,
  isLoading,
}: InventoryMetricCardProps) {
  return (
    <Card className="@container/card" data-slot="card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? <Skeleton className="h-6 w-24" /> : (value ?? "N/A")}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
