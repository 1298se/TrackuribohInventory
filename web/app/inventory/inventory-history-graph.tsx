"use client";

import React, { useState, useEffect } from "react";
import { parseISO, format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInventoryHistory } from "./api";
import { BarChart as BarChartIcon } from "lucide-react";

interface InventoryHistoryGraphProps {
  catalogId: string | null;
}

export function InventoryHistoryGraph({
  catalogId,
}: InventoryHistoryGraphProps) {
  const isMobile = useIsMobile();
  const [days, setDays] = useState<number>(isMobile ? 7 : 30);

  // Reset default when switching between mobile/desktop
  useEffect(() => {
    setDays(isMobile ? 7 : 30);
  }, [isMobile]);

  const { data, error, isLoading } = useInventoryHistory(catalogId, days);

  const timeRanges = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
  ];

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Inventory History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">
            Failed to load inventory history.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="relative">
        <CardTitle>Inventory History</CardTitle>
        <div className="absolute right-4 top-4">
          {isMobile ? (
            <Select
              value={days.toString()}
              onValueChange={(v) => setDays(Number(v))}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((tr) => (
                  <SelectItem key={tr.value} value={tr.value.toString()}>
                    {tr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ToggleGroup
              type="single"
              value={days.toString()}
              onValueChange={(v) => v && setDays(Number(v))}
            >
              {timeRanges.map((tr) => (
                <ToggleGroupItem
                  key={tr.value}
                  value={tr.value.toString()}
                  aria-label={tr.label}
                >
                  {tr.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[250px] relative">
        {isLoading || !data ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading graph...
            </div>
          </div>
        ) : data.length === 0 ? (
          <>
            <ChartContainer
              id="inventory-history"
              config={{
                total_cost: { label: "Cost", color: "#3b82f6" },
                total_market_value: { label: "Market Value", color: "#10b981" },
              }}
              className="h-full w-full"
            >
              <AreaChart
                data={data}
                margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
                <XAxis
                  dataKey="snapshot_date"
                  tickFormatter={(dateStr) =>
                    format(parseISO(dateStr), "MMM d")
                  }
                  axisLine={true}
                  tickLine={true}
                />
                <YAxis
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    }).format(value)
                  }
                  axisLine={true}
                  tickLine={true}
                  domain={["auto", "auto"]}
                  tickCount={6}
                  allowDecimals={false}
                />
              </AreaChart>
            </ChartContainer>
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <BarChartIcon className="mr-2 h-5 w-5" />
              No inventory snapshots yet for the last {days} days
            </div>
          </>
        ) : (
          <ChartContainer
            id="inventory-history"
            config={{
              total_cost: { label: "Cost", color: "#3b82f6" },
              total_market_value: { label: "Market Value", color: "#10b981" },
            }}
            className="h-full w-full"
          >
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradient-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_cost)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="gradient-market"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total_market_value)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="snapshot_date"
                tickFormatter={(dateStr) => format(parseISO(dateStr), "MMM d")}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(value)
                }
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickCount={6}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="total_cost"
                stroke="var(--color-total_cost)"
                fill="url(#gradient-cost)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="total_market_value"
                stroke="var(--color-total_market_value)"
                fill="url(#gradient-market)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
