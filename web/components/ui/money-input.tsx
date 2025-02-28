import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { MoneyAmountSchema } from "@/app/schemas";

export interface MoneyInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange"> {
  onChange?: (value: number | undefined) => void;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState<string>("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      
      // Allow empty input or valid positive decimal number format (including in-progress decimal inputs)
      const isValidInput = value === "" || /^\d*\.?\d{0,2}$/.test(value);
      
      if (isValidInput) {
        setInputValue(value);
        
        // Try to parse as a complete number for the onChange callback
        const parseResponse = MoneyAmountSchema.safeParse(value);
        
        if (parseResponse.success) {
          const numericValue = value === "" ? undefined : parseResponse.data;
          onChange && onChange(numericValue);
        } else if (value === "") {
          // Handle empty input
          onChange && onChange(undefined);
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