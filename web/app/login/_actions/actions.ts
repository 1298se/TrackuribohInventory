"use server";

import { API_URL } from "@/app/api/fetcher";
import { createClient } from "@/lib/supabase/server";
import { Session, User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { assertNotNullable } from "@/app/_core/utils";

const db = drizzle(process.env.DATABASE_URL!);

const usersTable = pgTable("users", {
  id: varchar({ length: 255 }).primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

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

  if (authData.user) {
    const response = await fetch(`${API_URL}/auth/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: authData.user.id,
        email: authData.user.email,
      }),
    });

    const result = await response.json();

    console.log("result", result);

    // const user: typeof usersTable.$inferInsert = {
    //   email: authData.user.email,
    //   id: authData.user.id,
    // };

    // // Sync user to your PostgreSQL database
    // await db.insert(usersTable).values(user);
  } else {
    console.log("User not created in database");
  }

  revalidatePath("/");
}
