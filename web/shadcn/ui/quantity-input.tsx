import React, { useState, useEffect } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface QuantityInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  // Accept number or undefined for value
  value?: number; 
  // Return number or undefined for empty/invalid state
  onChange?: (value: number | undefined) => void; 
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  max = 999, // Increased default max for typical quantities
  className,
  ...props
}: QuantityInputProps) {
  const [displayValue, setDisplayValue] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  // Format number to string for display
  const formatNumberForDisplay = (num: number | undefined | null): string => {
    return typeof num === 'number' && !isNaN(num) ? String(num) : "";
  };

  // Clamp value between min and max
  const clampValue = (num: number): number => {
    return Math.min(Math.max(num, min), max);
  };

  // Effect to synchronize external value changes to displayValue ONLY when not focused
  useEffect(() => {
    if (!isFocused) {
      const formattedPropValue = formatNumberForDisplay(value);
      setDisplayValue(formattedPropValue);
    }
  }, [value, isFocused]); // Rerun when value or focus changes

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    let numericValue: number | undefined = undefined;
    const parsed = parseInt(displayValue, 10);

    if (!isNaN(parsed)) {
        numericValue = clampValue(parsed);
    } 
    
    // Update display to the potentially clamped value or empty if invalid/cleared
    setDisplayValue(formatNumberForDisplay(numericValue));

    // Propagate the final clamped value if it's different from the prop value
    if (numericValue !== value) {
       onChange?.(numericValue);
    }
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Allow only digits or empty string
    if (rawValue === "" || /^\d+$/.test(rawValue)) {
        // Update display immediately
        setDisplayValue(rawValue);

        let numericValue: number | undefined = undefined;
        if (rawValue !== "") {
            const parsed = parseInt(rawValue, 10);
            // Check if it's a valid number within potential limits (don't clamp intermediate state yet)
            if (!isNaN(parsed)) {
                 // Clamp immediately to prevent intermediate values exceeding max visually
                 numericValue = clampValue(parsed);
                 // If clamping changed the number, reflect it in display immediately
                 if (numericValue !== parsed) {
                    setDisplayValue(String(numericValue));
                 }
            }
        } 
        // Propagate change if the numeric interpretation (after potential clamp) differs
         if (numericValue !== value) {
            onChange?.(numericValue);
        }
    }
    // If invalid format (e.g., contains non-digits), do nothing
  };

  return (
    <Input
      type="text" // Use text to allow intermediate empty state
      inputMode="numeric"
      pattern="[0-9]*" // Helps mobile keyboards and basic validation
      value={displayValue} // Display the local state string
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("w-16", className)} // Default width adjusted
      {...props}
      // Pass min/max to input element too (useful for accessibility/browser hints)
      min={min}
      max={max} 
    />
  );
}