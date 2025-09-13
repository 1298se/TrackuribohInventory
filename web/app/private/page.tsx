import { createClient } from "@/lib/supabase/server";
import { useEffect } from "react";
import { API_URL } from "../api/fetcher";

export default async function PrivatePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const { data: session, error: sessionError } =
    await supabase.auth.getSession();

  console.log(data);
  console.log(error);

  console.log(session);

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    credentials: "include",
  });
  const data2 = await response.json();
  console.log(data2);

  return <p>Hello {data?.user?.email}</p>;
}
