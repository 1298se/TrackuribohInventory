import { createClient } from "@/lib/supabase/server";

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

    // Handle 401 responses by refreshing the session
    if (response.status === 401) {
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession?.access_token) {
        throw new Error("Session expired. Please log in again.");
      }

      // Retry the request with the new token
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${refreshedSession.access_token}`,
        "Content-Type": "application/json",
      };

      return fetch(url, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
      });
    }

    return response;
  };

  return { authenticatedFetch };
}
