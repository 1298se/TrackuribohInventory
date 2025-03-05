import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { MoneyAmountSchema } from "@/app/schemas";

export interface MoneyInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange" | "value" | "defaultValue"> {
  onChange: (value: number | undefined) => void;
  initialValue?: number;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, initialValue, ...props }, ref) => {
    
    // Use initialValue prop for initial state
    const [inputValue, setInputValue] = React.useState<string>(
      initialValue !== undefined ? initialValue.toString() : ""
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Allow empty input or valid positive decimal number format (including in-progress decimal inputs)
      const isValidInput = rawValue === "" || /^\d*\.?\d{0,2}$/.test(rawValue);
      
      if (isValidInput) {
        
        // Try to parse as a complete number for the onChange callback
        const parseResponse = MoneyAmountSchema.safeParse(rawValue);
        
        if (parseResponse.success) {
          setInputValue(rawValue);
          onChange(parseResponse.data);
        } else if (rawValue === "") {
          setInputValue("0.00")
          // Handle empty input
          onChange(0.00);
        }
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        onChange={handleChange}
        value={inputValue}
        className={cn("w-24", className)}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export { MoneyInput }; 