import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { MoneyAmountSchema } from "@/app/schemas";

export interface MoneyInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange"> {
  onChange?: (value: number | undefined) => void;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const parseResponse = MoneyAmountSchema.safeParse(value);

      if (parseResponse.success) {
        const numericValue = value === "" ? undefined : parseResponse.data;
        onChange && onChange(numericValue);
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