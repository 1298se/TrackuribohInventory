import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

export interface DatePickerInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  dateFormat?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  calendarClassName?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Select date...",
  dateFormat = "MM/dd/yyyy",
  className = "w-[280px]",
  inputClassName,
  buttonClassName,
  calendarClassName,
  disabled = false,
  clearable = false,
}: DatePickerInputProps) {
  const [stringDate, setStringDate] = React.useState<string>(
    value ? format(value, dateFormat) : ""
  );
  const [date, setDate] = React.useState<Date | undefined>(value);
  
  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      setDate(value);
      setStringDate(format(value, dateFormat));
    } else {
      setDate(undefined);
      setStringDate("");
    }
  }, [value, dateFormat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStringDate = e.target.value;
    
    // Validate input: only allow digits and date separators
    // If the new value contains invalid characters, reject the change
    if (newStringDate && !/^[\d\/\-\.\s]+$/.test(newStringDate)) {
      return; // Reject the change by not updating state
    }
    
    setStringDate(newStringDate);
    
    if (!newStringDate) {
      setDate(undefined);
      onChange?.(undefined);
      return;
    }
    
    // Count actual digits in the string (remove separators)
    const digitCount = newStringDate.replace(/\D/g, '').length;
    
    // Only try to parse if we have 8 digits (complete date: MM/DD/YYYY)
    if (digitCount < 8) {
      return;
    }

    // Only attempt date parsing if the input has separators (/, -, etc)
    if (/[\/\-\.\s]/.test(newStringDate)) {
      try {
        // First try to parse with the specified format
        const parsedDate = parse(newStringDate, dateFormat, new Date());
        
        if (isValid(parsedDate)) {
          setDate(parsedDate);
          onChange?.(parsedDate);
          return;
        }
      } catch (error) {
        // Parsing with the specified format failed, continue to fallback
      }
      
      // Fallback to built-in date parsing for common formats
      const parsedDate = new Date(newStringDate);
      if (parsedDate.toString() !== "Invalid Date" && 
          parsedDate.getFullYear() > 1900 && 
          parsedDate.getFullYear() < 2100) {
        setDate(parsedDate);
        onChange?.(parsedDate);
      } else {
        setDate(undefined);
        onChange?.(undefined);
      }
    } else {
      // Input doesn't contain separators
      setDate(undefined);
      onChange?.(undefined);
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    
    setDate(selectedDate);
    setStringDate(format(selectedDate, dateFormat));
    onChange?.(selectedDate);
  };

  const handleClear = () => {
    setDate(undefined);
    setStringDate("");
    onChange?.(undefined);
  };

  // Function to handle blur - finalize the date after user finishes typing
  const handleBlur = () => {
    if (!stringDate) return;
    
    try {
      const parsedDate = parse(stringDate, dateFormat, new Date());
      if (isValid(parsedDate)) {
        setDate(parsedDate);
        // Format the display to match the expected format
        setStringDate(format(parsedDate, dateFormat));
        onChange?.(parsedDate);
        return;
      }
    } catch (error) {
      // If parsing fails, try fallback
    }
    
    // Try native date parsing as fallback
    const parsedDate = new Date(stringDate);
    if (parsedDate.toString() !== "Invalid Date" && 
        parsedDate.getFullYear() > 1900 && 
        parsedDate.getFullYear() < 2100) {
      setDate(parsedDate);
      setStringDate(format(parsedDate, dateFormat));
      onChange?.(parsedDate);
    }
  };

  return (
    <Popover>
      <div className={cn("relative", className)}>
        <Input
          type="text"
          value={stringDate}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName}
        />
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "font-normal absolute right-0 translate-y-[-50%] top-[50%] rounded-l-none",
              !date && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className={cn("w-auto p-0", calendarClassName)}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleCalendarSelect}
          defaultMonth={date}
          initialFocus
        />
        {clearable && date && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-sm"
              onClick={handleClear}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
} 