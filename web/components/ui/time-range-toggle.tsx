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
  value: number;
  onChange: (value: number) => void;
  options?: { label: string; value: number }[];
  id?: string;
}

export function TimeRangeToggle({
  value,
  onChange,
  options = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
  ],
  id = "time-range-select",
}: TimeRangeToggleProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Select
        id={id}
        value={value.toString()}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
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
      value={value.toString()}
      onValueChange={(v) => v && onChange(Number(v))}
      className="space-x-2"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value.toString()}
          aria-label={opt.label}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
