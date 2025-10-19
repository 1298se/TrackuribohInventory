"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shadcn/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/ui/popover";
import { Checkbox } from "@/shadcn/ui/checkbox";
import { Badge } from "@/shadcn/ui/badge";

interface BaseFilterOption {
  id: string;
  name: string;
}

interface ChecklistFilterProps<T extends BaseFilterOption = BaseFilterOption> {
  options: T[];
  selectedValues: string[];
  onSelectionChange: (selectedValues: string[]) => void;
  placeholder?: string;
  className?: string;
  searchPlaceholder?: string;
  displayKey?: keyof T;
  groupBy?: keyof T;
  sortBy?: keyof T;
  sortOrder?: "asc" | "desc";
}

export function ChecklistFilter<T extends BaseFilterOption = BaseFilterOption>({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Filter...",
  className,
  searchPlaceholder = "Search...",
  displayKey = "name",
  groupBy,
  sortBy,
  sortOrder = "asc",
}: ChecklistFilterProps<T>) {
  const [open, setOpen] = useState(false);

  const handleOptionToggle = (optionId: string) => {
    const newSelection = selectedValues.includes(optionId)
      ? selectedValues.filter((id) => id !== optionId)
      : [...selectedValues, optionId];
    onSelectionChange(newSelection);
  };

  const selectedOptionsData = options.filter((option) =>
    selectedValues.includes(option.id)
  );

  // Sort options if sortBy is specified
  const sortedOptions = sortBy
    ? [...options].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        // Handle date strings
        if (typeof aValue === "string" && typeof bValue === "string") {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
            return sortOrder === "asc"
              ? aDate.getTime() - bDate.getTime()
              : bDate.getTime() - aDate.getTime();
          }
        }

        // Handle other comparable types
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      })
    : options;

  // Group options if groupBy is specified
  const groupedOptions = groupBy
    ? sortedOptions.reduce((groups, option) => {
        const groupKey = String(option[groupBy]) || "Other";
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(option);
        return groups;
      }, {} as Record<string, T[]>)
    : { All: sortedOptions };

  // Sort groups by the most recent item in each group (if sortBy is specified)
  const sortedGroupedOptions =
    sortBy && groupBy
      ? Object.fromEntries(
          Object.entries(groupedOptions).sort(([, groupA], [, groupB]) => {
            // Get the most recent item from each group
            const getMostRecent = (group: T[]) => {
              return group.reduce((latest, current) => {
                const latestValue = latest[sortBy];
                const currentValue = current[sortBy];

                // Handle date strings
                if (
                  typeof latestValue === "string" &&
                  typeof currentValue === "string"
                ) {
                  const latestDate = new Date(latestValue);
                  const currentDate = new Date(currentValue);
                  if (
                    !isNaN(latestDate.getTime()) &&
                    !isNaN(currentDate.getTime())
                  ) {
                    return currentDate > latestDate ? current : latest;
                  }
                  // If one is invalid, prefer the valid one
                  if (
                    !isNaN(latestDate.getTime()) &&
                    isNaN(currentDate.getTime())
                  ) {
                    return latest;
                  }
                  if (
                    isNaN(latestDate.getTime()) &&
                    !isNaN(currentDate.getTime())
                  ) {
                    return current;
                  }
                }

                // Handle other comparable types
                return currentValue > latestValue ? current : latest;
              });
            };

            const mostRecentA = getMostRecent(groupA);
            const mostRecentB = getMostRecent(groupB);
            const aValue = mostRecentA[sortBy];
            const bValue = mostRecentB[sortBy];

            // Handle date strings
            if (typeof aValue === "string" && typeof bValue === "string") {
              const aDate = new Date(aValue);
              const bDate = new Date(bValue);
              const aValid = !isNaN(aDate.getTime());
              const bValid = !isNaN(bDate.getTime());

              // If both are valid dates, compare them
              if (aValid && bValid) {
                return sortOrder === "asc"
                  ? aDate.getTime() - bDate.getTime()
                  : bDate.getTime() - aDate.getTime();
              }

              // If only one is valid, put the valid one first (for desc order)
              if (aValid && !bValid) return sortOrder === "desc" ? -1 : 1;
              if (!aValid && bValid) return sortOrder === "desc" ? 1 : -1;

              // If neither is valid, maintain original order
              return 0;
            }

            // Handle other comparable types
            if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
            if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
            return 0;
          })
        )
      : groupedOptions;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedValues.length === 0
              ? placeholder
              : selectedValues.length === 1
              ? String(
                  selectedOptionsData[0]?.[displayKey] ||
                    selectedOptionsData[0]?.name
                )
              : `${selectedValues.length} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              {Object.entries(sortedGroupedOptions).map(
                ([groupName, groupOptions]) => (
                  <CommandGroup
                    key={groupName}
                    heading={groupBy ? groupName : undefined}
                  >
                    {groupOptions.map((option) => (
                      <CommandItem
                        key={option.id}
                        onSelect={() => handleOptionToggle(option.id)}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          checked={selectedValues.includes(option.id)}
                          className="mr-2"
                        />
                        <div className="font-medium">
                          {String(option[displayKey] || option.name)}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptionsData.map((option) => (
            <Badge
              key={option.id}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => handleOptionToggle(option.id)}
            >
              {String(option[displayKey] || option.name)}
              <button
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionToggle(option.id);
                }}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Keep SetFilter as an alias for backward compatibility
export const SetFilter = ChecklistFilter;
