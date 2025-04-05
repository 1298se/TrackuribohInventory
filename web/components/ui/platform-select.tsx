import { FormControl, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatforms } from "@/app/transactions/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";

interface PlatformSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  isEditing?: boolean;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
  className?: string;
  displayValue?: string;
}

export function PlatformSelect({
  value,
  onChange,
  isEditing = true,
  label = "Platform",
  placeholder = "Select a platform",
  showLabel = true,
  className,
  displayValue
}: PlatformSelectProps) {
  const { data: platforms, isLoading } = usePlatforms();

  if (isLoading) {
    return (
      <div className={className}>
        {showLabel && <Skeleton className="h-4 w-24 mb-2" />}
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!isEditing) {
    const selectedPlatform = platforms?.find(p => p.id === value);
    return (
      <div className={className}>
        {showLabel && <div className="text-sm font-medium mb-2">{label}</div>}
        <div className="mt-2">
          {displayValue || (selectedPlatform ? selectedPlatform.name : 
           <span className="text-muted-foreground italic">None</span>)}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {showLabel && <div className="text-sm font-medium mb-2">{label}</div>}
      <Select
        onValueChange={(value) => onChange(value === "null" ? null : value)}
        value={value ?? "null"}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">None</SelectItem>
          {platforms?.map((platform) => (
            <SelectItem key={platform.id} value={platform.id}>
              {platform.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormFieldPlatformSelect({
  control,
  name,
  label = "Platform",
  placeholder = "Select a platform",
  isEditing = true,
  displayValue,
}: {
  control: any;
  name: string;
  label?: string;
  placeholder?: string;
  isEditing?: boolean;
  displayValue?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PlatformSelect
              value={field.value}
              onChange={(value) => field.onChange(value)}
              isEditing={isEditing}
              showLabel={false}
              placeholder={placeholder}
              displayValue={displayValue}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
} 