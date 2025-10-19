import { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

interface FormFieldErrorProps<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  form: UseFormReturn<TFieldValues>;
  name: TFieldName;
  className?: string;
}

interface FormRootErrorProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  className?: string;
}

export function FormFieldError<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ form, name, className }: FormFieldErrorProps<TFieldValues, TFieldName>) {
  const error = form.formState.errors[name];

  if (!error?.message || typeof error.message !== "string") {
    return null;
  }

  return (
    <p className={cn("text-xs text-red-500", className)}>{error.message}</p>
  );
}

export function FormRootError<TFieldValues extends FieldValues = FieldValues>({
  form,
  className,
}: FormRootErrorProps<TFieldValues>) {
  const error = form.formState.errors.root;

  if (!error?.message || typeof error.message !== "string") {
    return null;
  }

  return (
    <p className={cn("text-sm text-red-500", className)}>{error.message}</p>
  );
}
