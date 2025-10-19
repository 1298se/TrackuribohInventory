"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/shadcn/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/ui/tabs";
import { MarketAnalysisTable } from "./MarketAnalysisTable";
import { SealedVsSingleOverviewChart } from "./SealedVsSingleOverviewChart";
import { ClientOnly } from "@/shadcn/ui/client-only";
import { MonitorDot } from "@/shared/components/MonitorDot";
import { MarketPlaceTopStatCardsSection } from "./MarketPlaceTopStatCardsSection";

interface DashboardConfig {
  id: string;
  name: string;
  code: string;
  set_id?: string;
}

const defaultDashboardConfig: DashboardConfig = {
  id: "general",
  name: "SV: White Flare",
  code: "WHT",
  set_id: "068302bb-43d9-745a-8000-614780ab883d", // White Flare set ID
};

export function MarketPlace() {
  const [dashboards, _setDashboards] = useState<DashboardConfig[]>([
    defaultDashboardConfig,
  ]);
  const [activeTab, setActiveTab] = useState("general");

  const addNewDashboard = () => {};

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
  // Temp setting default ID
  const setId = config.set_id ?? "068302bb-43d9-745a-8000-614780ab883d";

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <h2 className="text-2xl font-semibold lg:px-6 flex gap-2 items-center">
        <MonitorDot /> {config.name}
      </h2>
      <MarketPlaceTopStatCardsSection setId={setId} />
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
