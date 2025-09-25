"use client";

import { CardFooter } from "@/components/ui/card";
import { useState } from "react";
import { Plus } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketAnalysisTable } from "./MarketAnalysisTable";
import { SealedVsSingleOverviewChart } from "./SealedVsSingleOverviewChart";
import { ClientOnly } from "@/components/ui/client-only";
import { Separator } from "@/components/ui/separator";
import { MonitorDot } from "@/shared/components/MonitorDot";

export const description = "An interactive area chart";

interface DashboardConfig {
  id: string;
  name: string;
  code: string;
  statCards: StatCard[];
}

const dashboardConfigs: DashboardConfig[] = [
  {
    id: "general",
    name: "SV01: Scarlet & Violet Base Set",
    code: "GENERAL",
    statCards: [
      {
        description: "Total Market Value",
        value: "$15,847.50",
        footer: "Sum of all cards in the set",
        delta: "+12.3%",
        isIncrease: true,
      },
      {
        description: "Average Pack Price",
        value: "$4.35",
        footer: "Average price of a booster pack",
        delta: "-2.1%",
        isIncrease: false,
      },
      {
        description: "Top Chase Card Performance",
        value: "+52.8%",
        footer: "Charizard VMax",
        delta: "+52.8%",
        isIncrease: true,
      },
    ],
  },
];

interface StatCard {
  description: string;
  value: string;
  footer: string;
}

// Reusable dashboard component

export function MarketPlace() {
  const [dashboards, setDashboards] =
    useState<DashboardConfig[]>(dashboardConfigs);
  const [activeTab, setActiveTab] = useState("general");

  const addNewDashboard = () => {
    const newDashboard: DashboardConfig = {
      id: `custom-${Date.now()}`,
      name: "Custom Dashboard",
      code: "CUSTOM",
      statCards: [
        {
          description: "Total Set Value",
          value: "$0.00",
          footer: "Based on current market prices",
          delta: "+0.0%",
          isIncrease: true,
        },
        {
          description: "Price Per Pack",
          value: "$0.00",
          footer: "Current market rate",
          delta: "+0.0%",
          isIncrease: true,
        },
        {
          description: "Top Chase Card Performance",
          value: "+0.0%",
          footer: "Since set release",
          delta: "+0.0%",
          isIncrease: true,
        },
      ],
    };

    setDashboards([...dashboards, newDashboard]);
    setActiveTab(newDashboard.id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 pt-4">
            <h4 className="text-md font-medium mb-4 flex gap-2 items-center">
              Monitors
            </h4>
            <TabsList className="">
              {dashboards.map((dashboard) => (
                <TabsTrigger key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </TabsTrigger>
              ))}
              <Button
                onClick={addNewDashboard}
                size="sm"
                className="h-8"
                variant="ghost"
              >
                <Plus className="h-4 w-4 mr-0.5" />
                Add
              </Button>
            </TabsList>
          </div>

          {dashboards.map((dashboard) => (
            <TabsContent key={dashboard.id} value={dashboard.id}>
              <Dashboard config={dashboard} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

interface DashboardProps {
  config: DashboardConfig;
}

function Dashboard({ config }: DashboardProps) {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <h2 className="text-2xl font-semibold lg:px-6 flex gap-2 items-center">
        <MonitorDot /> {config.name}
      </h2>
      <StatCardSection cards={config.statCards} />
      <ClientOnly>
        <div className="lg:px-6 flex flex-col gap-6">
          <SealedVsSingleOverviewChart />
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Chase cards</h3>
            <MarketAnalysisTable />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Sealed product</h3>
            <MarketAnalysisTable />
          </div>
        </div>
      </ClientOnly>
    </div>
  );
}

interface StatCard {
  description: string;
  value: string;
  footer: string;
  delta?: string;
  isIncrease?: boolean;
}

interface SectionCardsProps {
  cards: StatCard[];
}

function StatCardSection({ cards }: SectionCardsProps) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
      {cards.map((card, index) => (
        <Card key={index} className="@container/card relative gap-2">
          <CardHeader className="">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardDescription className="text-xs">
                  {card.description}
                </CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  {card.value}
                </CardTitle>
              </div>
              {card.delta && (
                <div
                  className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${
                    card.isIncrease
                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  {card.delta}
                </div>
              )}
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-xs pt-0">
            <div className="text-muted-foreground">{card.footer}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
