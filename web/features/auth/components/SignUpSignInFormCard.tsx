"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormRootError } from "@/components/FormFieldError";
import { FormFieldInputContainer } from "@/components/FormFieldInputContainer";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { EmailAuthAction, emailAuthSchema } from "../schemas";
import { useRouter } from "next/navigation";

export function SignUpSignInFormCard({
  className,
  title,
  description,
  formAction,
  cta,
  redirect,
  variant,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
  description: string;
  cta: string;
  formAction: EmailAuthAction;
  variant: "signup" | "login";
  redirect: string;
}) {
  const router = useRouter();
  const { form, handleSubmitWithAction } = useHookFormAction(
    formAction,
    zodResolver(emailAuthSchema),
    {
      formProps: {
        mode: "onChange",
      },
      actionProps: {
        onSuccess: () => {
          router.push(redirect);
        },
      },
    }
  );

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitWithAction}>
            <div className="flex flex-col gap-6">
              <FormFieldInputContainer
                form={form}
                name="email"
                label="Email"
                type="email"
                placeholder="Email"
                required
              />
              <FormFieldInputContainer
                form={form}
                name="password"
                label="Password"
                type="password"
                placeholder="Password"
                required
              />
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  formAction={formAction}
                  loading={form.formState.isSubmitting}
                >
                  {cta}
                </Button>
              </div>
              <FormRootError form={form} />
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {variant === "signup"
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
              <a
                href={variant === "signup" ? "/login" : "/signup"}
                className="underline underline-offset-4 text-primary hover:text-muted-foreground"
              >
                {variant === "signup" ? "Login" : "Sign up"}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
