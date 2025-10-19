import {
  Select as UISelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shadcn/ui/select";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string | undefined;
  onChange: (option: Option) => void;
  options: Option[];
}

export function Select({ value, onChange, options }: SelectProps) {
  const handleChange = (newValue: string) => {
    const selected = options.find((opt) => opt.value === newValue);
    if (selected) onChange(selected);
  };

  return (
    <UISelect value={value ?? ""} onValueChange={handleChange}>
      <SelectTrigger className="w-32 font-normal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  );
}
