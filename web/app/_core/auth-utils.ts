import { logout } from "../api/auth";
import { clearTokens } from "../api/token";

/**
 * Handles 401 authentication errors by logging out the user and redirecting to login
 * This utility should be called whenever a 401 response is encountered
 */
export async function handle401Error(): Promise<void> {
  try {
    // Clear local tokens immediately
    clearTokens();

    // Attempt to logout on the server (this may fail if the token is already invalid)
    try {
      await logout();
    } catch (error) {
      // Server logout failed, but we've already cleared local tokens
      console.warn("Server logout failed, but local tokens cleared:", error);
    }

    // Redirect to login page
    window.location.href = "/login";
  } catch (error) {
    console.error("Error during 401 logout process:", error);
    // Even if there's an error, still redirect to login
    window.location.href = "/login";
  }
}

/**
 * Checks if we're in a browser environment before attempting redirects
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Safe redirect that only works in browser environment
 */
export function safeRedirect(path: string): void {
  if (isBrowser()) {
    window.location.href = path;
  }
}
