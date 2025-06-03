import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

interface TimeRangeToggleProps {
  value: number | null;
  onChange: (value: number | null) => void;
  options?: { label: string; value: number | null }[];
}

export function TimeRangeToggle({
  value,
  onChange,
  options = [
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
    { label: "1yr", value: 365 },
    { label: "All time", value: null },
  ],
}: TimeRangeToggleProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Select
        value={value?.toString() ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem
              key={opt.value ?? "all"}
              value={opt.value?.toString() ?? "all"}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <ToggleGroup
      type="single"
      value={value?.toString() ?? "all"}
      onValueChange={(v) => v && onChange(v === "all" ? null : Number(v))}
      className="space-x-2"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value ?? "all"}
          value={opt.value?.toString() ?? "all"}
          aria-label={opt.label}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
