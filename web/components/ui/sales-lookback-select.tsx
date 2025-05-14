import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface SalesLookbackSelectProps {
  value: number;
  onChange: (days: number) => void;
}

export function SalesLookbackSelect({
  value,
  onChange,
}: SalesLookbackSelectProps) {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <label htmlFor="sales-lookback-select" className="text-sm font-medium">
        Sales Lookback:
      </label>
      <Select
        id="sales-lookback-select"
        value={value.toString()}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Select days" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">7 days</SelectItem>
          <SelectItem value="30">30 days</SelectItem>
          <SelectItem value="90">90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
