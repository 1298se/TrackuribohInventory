import { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Label } from "@/shadcn/ui/label";
import { Input } from "@/shadcn/ui/input";
import { FormFieldError } from "./FormFieldError";
import { cn } from "@/lib/utils";

interface FormFieldInputContainerProps<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  form: UseFormReturn<TFieldValues>;
  name: TFieldName;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export const FormFieldInputContainer = <
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  form,
  name,
  label,
  required = false,
  type = "text",
  placeholder,
  className,
  inputClassName,
}: FormFieldInputContainerProps<TFieldValues, TFieldName>) => {
  return (
    <div className={cn("grid gap-3", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="flex flex-col gap-1">
        <Input
          id={name}
          type={type}
          placeholder={
            required && placeholder ? `${placeholder} (Required)` : placeholder
          }
          className={inputClassName}
          {...form.register(name)}
        />
        <FormFieldError form={form} name={name} />
      </div>
    </div>
  );
};
