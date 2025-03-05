import React from "react";
import { Input } from "./input";

interface QuantityInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: number | string;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  max = 999,
  className = "w-20",
  ...props
}: QuantityInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get the raw input value
    const rawValue = e.target.value;

    // Process the value and call the onChange callback
    if (rawValue !== '') {
      const newValue = parseInt(rawValue, 10);
      
      if (!isNaN(newValue)) {
        // Ensure the value is within bounds
        const boundedValue = Math.min(Math.max(newValue, min), max);
        onChange?.(boundedValue);
      } else {
        // If the value is not a number, call onChange with 0
        onChange?.(0);
      }
    } else {
      // For empty input, call onChange with 0 instead of undefined
      onChange?.(0);
    }
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}