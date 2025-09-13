import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { TimeRangeToggle } from "@/components/ui/time-range-toggle";
import { PortfolioValueChart } from "./portfolio-value-chart";

interface PortfolioPerformanceProps {
  selectedCatalogId: string | null;
  metricData?: any;
  metricLoading: boolean;
}

export function PortfolioPerformance({
  selectedCatalogId,
  metricData,
  metricLoading,
}: PortfolioPerformanceProps) {
  const [days, setDays] = useState<string | undefined>(undefined);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">
                Portfolio Performance
              </CardTitle>
              <CardDescription className="text-sm">
                Market value trends and historical performance
              </CardDescription>
            </div>
          </div>
          <div>
            <TimeRangeToggle
              value={days}
              onChange={setDays}
              options={[
                { label: "7d", value: "7d" },
                { label: "30d", value: "30d" },
                { label: "90d", value: "90d" },
                { label: "1y", value: "1y" },
                { label: "All time", value: "all" },
              ]}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <PortfolioValueChart
          catalogId={selectedCatalogId}
          days={days}
          metricData={metricData}
          metricLoading={metricLoading}
        />
      </CardContent>
    </Card>
  );
}
