import React, { useEffect, useState } from "react";
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
  value: string | undefined;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

interface TimeRangeToggleControlledProps {
  options: { label: string; value: string }[];
  onValueChange?: (value: string) => void;
}

export function TimeRangeToggle({
  value,
  onChange,
  options,
}: TimeRangeToggleProps) {
  const isMobile = useIsMobile();

  // Auto-select first option if no value is set (undefined means not initialized, null means "All time")
  useEffect(() => {
    if (value === undefined) {
      if (options.length > 0) {
        onChange(options[0].value);
      }
    }
  }, [onChange, options]); // Removed 'value' from dependencies to prevent re-triggering

  // Get the display value - use value directly since it's already a string
  const displayValue = value ?? options[0]?.value ?? "";

  if (isMobile) {
    return (
      <Select value={displayValue} onValueChange={onChange}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
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
      onValueChange={(v) => v && onChange(v)}
      className="space-x-2"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          aria-label={opt.label}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// Self-controlled version with internal state management
export function TimeRangeToggleControlled({
  options,
  onValueChange,
}: TimeRangeToggleControlledProps) {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  );
  const isMobile = useIsMobile();

  // Auto-select first option on mount
  useEffect(() => {
    if (internalValue === undefined && options.length > 0) {
      const firstValue = options[0].value;
      setInternalValue(firstValue);
      onValueChange?.(firstValue);
    }
  }, [internalValue, options, onValueChange]);

  const handleChange = (value: string) => {
    setInternalValue(value);
    onValueChange?.(value);
  };

  // Get the display value - use value directly since it's already a string
  const displayValue = internalValue ?? options[0]?.value ?? "";

  if (isMobile) {
    return (
      <Select value={displayValue} onValueChange={handleChange}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
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
      onValueChange={(v) => v && handleChange(v)}
      className="space-x-2"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          aria-label={opt.label}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
