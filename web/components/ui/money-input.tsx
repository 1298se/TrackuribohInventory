import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { MoneyAmountSchema } from "@/app/schemas";

export interface MoneyInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange" | "value" | "defaultValue"> {
  onChange: (value: number | undefined) => void;
  value?: number;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, value, ...props }, ref) => {

    const [displayValue, setDisplayValue] = React.useState<string>("");
    const [isFocused, setIsFocused] = React.useState(false);

    // Format number to string for display (e.g., 12.3 -> "12.30")
    const formatNumberForDisplay = (num: number | undefined | null): string => {
        if (typeof num === 'number' && !isNaN(num)) {
            return num.toFixed(2);
        }
        return "";
    };

    // Effect to synchronize external value changes to displayValue ONLY when not focused
    React.useEffect(() => {
        if (!isFocused) {
            const formattedPropValue = formatNumberForDisplay(value);
            setDisplayValue(formattedPropValue);
        }
        // We only want to run this when the EXTERNAL value changes, or focus changes.
        // Do NOT include displayValue here, it would cause infinite loops.
    }, [value, isFocused]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Select text on focus for easier editing
        e.target.select();
        // Propagate event if needed
        props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        // On blur, ensure the display value matches the formatted prop value
        const formattedPropValue = formatNumberForDisplay(value);
        setDisplayValue(formattedPropValue);
        // Propagate event if needed
        props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;

        // Regex to allow empty, integer, or decimal up to 2 places (including intermediates)
        const isValidFormat = rawValue === "" || /^\d*\.?\d{0,2}$/.test(rawValue);

        if (isValidFormat) {
            // Update display immediately
            setDisplayValue(rawValue);

            // Determine the numeric value to send to the form
            let numericValue: number | undefined = undefined;
            if (rawValue === "") {
                numericValue = undefined;
            } else if (rawValue === "." || rawValue.endsWith('.')) {
                 // Intermediate state, not a valid number yet
                numericValue = undefined;
            } else {
                 numericValue = parseFloat(rawValue);
            }

            // Only call onChange if the numeric interpretation has changed
            // This prevents unnecessary calls when typing e.g. from "1.2" to "1.20" if both parse to 1.2
            onChange(numericValue);
        }
        // If format is invalid, do nothing (don't update display, don't call onChange)
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text" // Use text to allow intermediate decimal points
        inputMode="decimal"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        value={displayValue} // Display the local state string
        className={cn("w-24", className)}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export { MoneyInput }; 