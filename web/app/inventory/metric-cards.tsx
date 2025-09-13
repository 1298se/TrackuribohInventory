import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns"; // not used but maybe future
import { useInventoryMetrics } from "./api";

function formatCurrency(
  amount?: number | null,
  currency: string = "USD",
): string {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface InventoryMetricCardsProps {
  catalogId?: string | null;
}

export function InventoryMetricCards({ catalogId }: InventoryMetricCardsProps) {
  const { data, isLoading } = useInventoryMetrics(catalogId ?? null);

  const cards = [
    { title: "Items in Stock", value: data?.number_of_items ?? 0 },
    { title: "Total Cost", value: formatCurrency(data?.total_inventory_cost) },
    { title: "Market Value", value: formatCurrency(data?.total_market_value) },
    {
      title: "Unrealised Profit",
      value: formatCurrency(data?.unrealised_profit),
    },
  ];

  return (
    <div className="flex justify-center">
      <div className="data-[slot=card]:*:from-primary/5 data-[slot=card]:*:to-card dark:data-[slot=card]:*:bg-card grid grid-cols-1 gap-4 px-4 data-[slot=card]:*:bg-linear-to-t data-[slot=card]:*:shadow-2xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 w-full max-w-(--breakpoint-xl)">
        {cards.map(({ title, value }) => (
          <Card key={title} className="@container/card" data-slot="card">
            <CardHeader>
              <CardDescription>{title}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {isLoading ? <Skeleton className="h-6 w-24" /> : value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
