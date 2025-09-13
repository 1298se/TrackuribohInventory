"use server";

import { API_URL } from "@/app/api/fetcher";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import "dotenv/config";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  console.log("error", error);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  console.log("error", error);

  if (error) {
    redirect("/error");
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  console.log("sign up");

  const { data: authData, error } = await supabase.auth.signUp(data);

  if (error) {
    redirect("/error");
  }

  if (!authData) {
    redirect("/error");
  }

  // Sync user to your PostgreSQL database
  if (authData.user) {
    const response = await fetch(`${API_URL}/auth/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: authData.user.id,
        email: authData.user.email,
      }),
    });
  } else {
    console.log("User not created in database");
  }

  revalidatePath("/");
}
