"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shadcn/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/shadcn/ui/toggle-group";

const chartData = [
  { date: "2024-04-01", topChaseCard: 222, boosterBox: 180 },
  { date: "2024-04-02", topChaseCard: 97, boosterBox: 200 },
  { date: "2024-04-03", topChaseCard: 167, boosterBox: 140 },
  { date: "2024-04-04", topChaseCard: 242, boosterBox: 280 },
  { date: "2024-04-05", topChaseCard: 373, boosterBox: 320 },
  { date: "2024-04-06", topChaseCard: 301, boosterBox: 380 },
  { date: "2024-04-07", topChaseCard: 245, boosterBox: 200 },
  { date: "2024-04-08", topChaseCard: 409, boosterBox: 360 },
  { date: "2024-04-09", topChaseCard: 59, boosterBox: 130 },
  { date: "2024-04-10", topChaseCard: 261, boosterBox: 220 },
  { date: "2024-04-11", topChaseCard: 327, boosterBox: 390 },
  { date: "2024-04-12", topChaseCard: 292, boosterBox: 240 },
  { date: "2024-04-13", topChaseCard: 342, boosterBox: 420 },
  { date: "2024-04-14", topChaseCard: 137, boosterBox: 250 },
  { date: "2024-04-15", topChaseCard: 120, boosterBox: 190 },
  { date: "2024-04-16", topChaseCard: 138, boosterBox: 220 },
  { date: "2024-04-17", topChaseCard: 446, boosterBox: 400 },
  { date: "2024-04-18", topChaseCard: 364, boosterBox: 450 },
  { date: "2024-04-19", topChaseCard: 243, boosterBox: 200 },
  { date: "2024-04-20", topChaseCard: 89, boosterBox: 170 },
  { date: "2024-04-21", topChaseCard: 137, boosterBox: 230 },
  { date: "2024-04-22", topChaseCard: 224, boosterBox: 190 },
  { date: "2024-04-23", topChaseCard: 138, boosterBox: 260 },
  { date: "2024-04-24", topChaseCard: 387, boosterBox: 320 },
  { date: "2024-04-25", topChaseCard: 215, boosterBox: 280 },
  { date: "2024-04-26", topChaseCard: 75, boosterBox: 150 },
  { date: "2024-04-27", topChaseCard: 383, boosterBox: 460 },
  { date: "2024-04-28", topChaseCard: 122, boosterBox: 200 },
  { date: "2024-04-29", topChaseCard: 315, boosterBox: 270 },
  { date: "2024-04-30", topChaseCard: 454, boosterBox: 420 },
  { date: "2024-05-01", topChaseCard: 165, boosterBox: 250 },
  { date: "2024-05-02", topChaseCard: 293, boosterBox: 340 },
  { date: "2024-05-03", topChaseCard: 247, boosterBox: 220 },
  { date: "2024-05-04", topChaseCard: 385, boosterBox: 460 },
  { date: "2024-05-05", topChaseCard: 481, boosterBox: 430 },
  { date: "2024-05-06", topChaseCard: 498, boosterBox: 570 },
  { date: "2024-05-07", topChaseCard: 388, boosterBox: 330 },
  { date: "2024-05-08", topChaseCard: 149, boosterBox: 240 },
  { date: "2024-05-09", topChaseCard: 227, boosterBox: 200 },
  { date: "2024-05-10", topChaseCard: 293, boosterBox: 360 },
  { date: "2024-05-11", topChaseCard: 335, boosterBox: 300 },
  { date: "2024-05-12", topChaseCard: 197, boosterBox: 270 },
  { date: "2024-05-13", topChaseCard: 197, boosterBox: 180 },
  { date: "2024-05-14", topChaseCard: 448, boosterBox: 540 },
  { date: "2024-05-15", topChaseCard: 473, boosterBox: 420 },
  { date: "2024-05-16", topChaseCard: 338, boosterBox: 440 },
  { date: "2024-05-17", topChaseCard: 499, boosterBox: 460 },
  { date: "2024-05-18", topChaseCard: 315, boosterBox: 390 },
  { date: "2024-05-19", topChaseCard: 235, boosterBox: 200 },
  { date: "2024-05-20", topChaseCard: 177, boosterBox: 260 },
  { date: "2024-05-21", topChaseCard: 82, boosterBox: 160 },
  { date: "2024-05-22", topChaseCard: 81, boosterBox: 140 },
  { date: "2024-05-23", topChaseCard: 252, boosterBox: 320 },
  { date: "2024-05-24", topChaseCard: 294, boosterBox: 250 },
  { date: "2024-05-25", topChaseCard: 201, boosterBox: 280 },
  { date: "2024-05-26", topChaseCard: 213, boosterBox: 190 },
  { date: "2024-05-27", topChaseCard: 420, boosterBox: 510 },
  { date: "2024-05-28", topChaseCard: 233, boosterBox: 210 },
  { date: "2024-05-29", topChaseCard: 78, boosterBox: 150 },
  { date: "2024-05-30", topChaseCard: 340, boosterBox: 310 },
  { date: "2024-05-31", topChaseCard: 178, boosterBox: 260 },
  { date: "2024-06-01", topChaseCard: 178, boosterBox: 230 },
  { date: "2024-06-02", topChaseCard: 470, boosterBox: 450 },
  { date: "2024-06-03", topChaseCard: 103, boosterBox: 180 },
  { date: "2024-06-04", topChaseCard: 439, boosterBox: 420 },
  { date: "2024-06-05", topChaseCard: 88, boosterBox: 160 },
  { date: "2024-06-06", topChaseCard: 294, boosterBox: 280 },
  { date: "2024-06-07", topChaseCard: 323, boosterBox: 410 },
  { date: "2024-06-08", topChaseCard: 385, boosterBox: 350 },
  { date: "2024-06-09", topChaseCard: 438, boosterBox: 530 },
  { date: "2024-06-10", topChaseCard: 155, boosterBox: 230 },
  { date: "2024-06-11", topChaseCard: 92, boosterBox: 170 },
  { date: "2024-06-12", topChaseCard: 492, boosterBox: 460 },
  { date: "2024-06-13", topChaseCard: 81, boosterBox: 150 },
  { date: "2024-06-14", topChaseCard: 426, boosterBox: 420 },
  { date: "2024-06-15", topChaseCard: 307, boosterBox: 390 },
  { date: "2024-06-16", topChaseCard: 371, boosterBox: 340 },
  { date: "2024-06-17", topChaseCard: 475, boosterBox: 570 },
  { date: "2024-06-18", topChaseCard: 107, boosterBox: 190 },
  { date: "2024-06-19", topChaseCard: 341, boosterBox: 320 },
  { date: "2024-06-20", topChaseCard: 408, boosterBox: 500 },
  { date: "2024-06-21", topChaseCard: 169, boosterBox: 240 },
  { date: "2024-06-22", topChaseCard: 317, boosterBox: 300 },
  { date: "2024-06-23", topChaseCard: 480, boosterBox: 580 },
  { date: "2024-06-24", topChaseCard: 132, boosterBox: 200 },
  { date: "2024-06-25", topChaseCard: 141, boosterBox: 220 },
  { date: "2024-06-26", topChaseCard: 434, boosterBox: 420 },
  { date: "2024-06-27", topChaseCard: 448, boosterBox: 540 },
  { date: "2024-06-28", topChaseCard: 149, boosterBox: 230 },
  { date: "2024-06-29", topChaseCard: 103, boosterBox: 180 },
  { date: "2024-06-30", topChaseCard: 446, boosterBox: 440 },
];

const chartConfig = {
  topChaseCard: {
    label: "Top Chase Card",
    color: "rgb(59 130 246)",
  },
  boosterBox: {
    label: "Booster Box",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function SealedVsSingleOverviewChart() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date("2024-06-30");
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Top Chase Card vs Booster Box Price</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Price comparison over the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Price comparison</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillTopChaseCard" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-topChaseCard)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-topChaseCard)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBoosterBox" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-boosterBox)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-boosterBox)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="topChaseCard"
              type="natural"
              fill="url(#fillTopChaseCard)"
              stroke="var(--color-topChaseCard)"
              stackId="a"
            />
            <Area
              dataKey="boosterBox"
              type="natural"
              fill="url(#fillBoosterBox)"
              stroke="var(--color-boosterBox)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
