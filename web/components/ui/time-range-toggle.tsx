import React, { useEffect } from "react";
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
  options: { label: string; value: number | null }[];
}

export function TimeRangeToggle({
  value,
  onChange,
  options,
}: TimeRangeToggleProps) {
  const isMobile = useIsMobile();

  // Auto-select first option if no value is set
  useEffect(() => {
    if (value === undefined || value === null) {
      if (options.length > 0) {
        onChange(options[0].value);
      }
    }
  }, [value, onChange, options]);

  // Get the display value - use first option if value is null
  const displayValue =
    value !== null && value !== undefined
      ? value.toString()
      : (options[0]?.value?.toString() ?? "all");

  if (isMobile) {
    return (
      <Select
        value={displayValue}
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
      value={displayValue}
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
