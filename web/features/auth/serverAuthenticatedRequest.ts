import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export async function createAuthenticatedRequest() {
  const supabase = await createClient();

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    // Get the current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }

    if (!session?.access_token) {
      throw new Error("No valid session found. Please log in.");
    }

    // Add the authorization header with the Supabase access token
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };

    // Make the request with credentials included
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // Handle 401 responses - session expired
    if (response.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }

    // Handle 404 responses
    if (response.status === 404) {
      notFound();
    }

    return response;
  };

  return { authenticatedFetch };
}
