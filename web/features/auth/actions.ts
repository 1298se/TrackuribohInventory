"use server";

import { API_URL } from "@/app/api/fetcher";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";
import { assertNotNullable } from "../../lib/validation";
import { emailAuthSchema } from "./schemas";

export const loginUser = actionClient
  .inputSchema(emailAuthSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    console.log("loginUser1", email, password);
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      returnValidationErrors(emailAuthSchema, {
        _errors: ["Invalid email or password"],
      });
    }

    return {
      success: true,
      email,
    };
  });

export const signupUser = actionClient
  .inputSchema(emailAuthSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createClient();

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    console.log("authData", authData);
    console.log("error", error);

    if (error) {
      return returnValidationErrors(emailAuthSchema, {
        _errors: ["Failed to send sign up request"],
      });
    }

    assertNotNullable(authData.user);

    try {
      // Sync user to your PostgreSQL database
      await fetch(`${API_URL}/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: authData.user.id,
          email: authData.user.email,
        }),
      });
    } catch {
      return returnValidationErrors(emailAuthSchema, {
        _errors: ["Failed to sync sign up request"],
      });
    }

    return {
      success: true,
      email,
    };
  });

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  console.log("error", error);

  if (error) {
    redirect("/error");
  }
}
