import { FormControl, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue, 
  SelectSeparator,
  SelectLabel
} from "@/components/ui/select";
import * as SelectPrimitive from '@radix-ui/react-select';
import { usePlatforms, useCreatePlatform } from "@/app/transactions/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const { data: platforms, isLoading, mutate: mutatePlatforms } = usePlatforms();
  const { trigger: createPlatform, isMutating } = useCreatePlatform();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const handleAddPlatform = async () => {
    if (!newPlatformName.trim()) {
      toast.error("Platform name is required");
      return;
    }

    try {
      const result = await createPlatform({ name: newPlatformName.trim() });
      toast.success("Platform added successfully");
      
      // Close dialog and clear input
      setIsAddDialogOpen(false);
      setNewPlatformName("");
      
      // Refresh platforms and select the new one
      await mutatePlatforms();
      onChange(result.id);
    } catch (error) {
      toast.error("Failed to add platform");
      console.error(error);
    }
  };

  // Handle dialog open/close
  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      // Ensure the select dropdown is closed when dialog closes
      setIsSelectOpen(false);
    }
  };

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
      
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <Select
          open={isSelectOpen}
          onOpenChange={setIsSelectOpen}
          onValueChange={(value) => {
            onChange(value === "null" ? null : value);
          }}
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
            <SelectSeparator className="my-2" />
            <div
              role="button"
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground",
                "text-primary font-medium justify-center"
              )}
              onClick={() => {
                setIsSelectOpen(false); // Close the dropdown
                setIsAddDialogOpen(true); // Open the dialog
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span>Add new platform</span>
            </div>
          </SelectContent>
        </Select>
        
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Platform</DialogTitle>
            <DialogDescription>
              Enter the name of the new platform.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Input
              value={newPlatformName}
              onChange={(e) => setNewPlatformName(e.target.value)}
              placeholder="Platform name"
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddPlatform();
              }}
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPlatform} 
              disabled={isMutating || !newPlatformName.trim()}
            >
              {isMutating ? "Adding..." : "Add Platform"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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