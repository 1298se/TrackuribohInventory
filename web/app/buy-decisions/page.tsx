"use client";

import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SKUDisplay } from "@/components/sku-display";
import { DataTable, type Column } from "@/components/data-table";
import { useBuyDecisions } from "./api";
import type { BuyDecisionResponse } from "./schemas";

export default function BuyDecisionsPage() {
  const { data, error, isLoading } = useBuyDecisions();

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatReasonCodes = (codes: string[]) => {
    return codes.map((code, index) => (
      <Badge key={index} variant="outline" className="mr-1">
        {code.replace(/_/g, " ").toLowerCase()}
      </Badge>
    ));
  };

  const columns: Column<BuyDecisionResponse, any>[] = [
    {
      accessorKey: "sku.product.name",
      header: "Product",
      size: 400,
      cell: ({ row }) => {
        return <SKUDisplay sku={row.original.sku} />;
      },
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      align: "right",
      cell: ({ row }) => {
        return (
          <div className="font-medium text-right tabular-nums">
            {row.original.quantity}
          </div>
        );
      },
    },
    {
      accessorKey: "buy_vwap",
      header: "Buy Price",
      align: "right",
      cell: ({ row }) => {
        return (
          <div className="font-medium text-right">
            {formatMoney(row.original.buy_vwap)}
          </div>
        );
      },
    },
    {
      id: "expected_net_resale",
      header: "Expected Net Resale (per copy)",
      align: "right",
      cell: ({ row }) => {
        return (
          <div className="font-medium text-right text-green-600">
            {formatMoney(row.original.expected_resale_net)}
          </div>
        );
      },
    },
    {
      id: "reasons",
      header: "Reasons",
      cell: ({ row }) => {
        return (
          <div className="flex flex-wrap">
            {formatReasonCodes(row.original.reason_codes)}
          </div>
        );
      },
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(row.original.created_at, { addSuffix: true })}
          </span>
        );
      },
    },
  ];

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load purchase decisions. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Current Purchase Recommendations</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Latest BUY Recommendation per SKU (by Expected Net Resale)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.decisions ?? []}
            loading={isLoading}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
