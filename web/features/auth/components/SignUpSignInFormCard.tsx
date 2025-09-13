"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormFieldError, FormRootError } from "@/components/FormFieldError";
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
  footer,
  cta,
  redirect,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
  description: string;
  cta: string;
  formAction: EmailAuthAction;
  footer: React.ReactNode;
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
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitWithAction}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...form.register("email")}
                />
                <FormFieldError form={form} name="email" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                />
                <FormFieldError form={form} name="password" />
              </div>
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
            {footer}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
