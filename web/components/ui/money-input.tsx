import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps extends React.ComponentPropsWithoutRef<"input"> {}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Only allow empty string or a valid decimal with at most 2 decimal places.
      if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
        onChange && onChange(e);
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        onChange={handleChange}
        className={cn("w-24", className)}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export { MoneyInput }; 