import { z, ZodError } from "zod"; // Import ZodError for potential type checking if needed
import { getAccessToken, isTokenExpired, clearTokens } from "./token";
import { refresh as refreshTokens } from "./auth";
import { handle401Error } from "../_core/auth-utils";

export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

// Extended to support all HTTP methods
export interface FetcherParams<T extends z.ZodTypeAny> {
  url: string;
  method?: HTTPMethod;
  body?: any;
  init?: RequestInit;
  params?: Record<string, string | string[]>;
  schema: T;
}

// Deduplicate concurrent refresh requests
let refreshInFlight: Promise<unknown> | null = null;
async function ensureRefreshedOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doFetch(url: string, options: RequestInit) {
  // Inject Authorization if we have an access token
  const token = getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Always include credentials so the refresh cookie is sent
  return fetch(url, { ...options, headers, credentials: "include" });
}

// Enhanced fetcher that supports GET and mutation operations
export const fetcher = async <T extends z.ZodTypeAny>({
  url,
  method = HTTPMethod.GET,
  body = undefined,
  init = {},
  params = undefined,
  schema,
}: FetcherParams<T>): Promise<z.infer<T>> => {
  // Append params if they exist
  if (params) {
    const queryParams = new URLSearchParams();

    // Handle array parameters properly
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // For arrays, append each value as a separate parameter
        value.forEach((v) => queryParams.append(key, v));
      } else {
        queryParams.append(key, value);
      }
    });

    url = `${url}?${queryParams}`;
  }

  // Prepare fetch options
  const fetchOptions: RequestInit = {
    ...init,
    method,
  };

  // Add body for non-GET requests
  if (method !== HTTPMethod.GET && body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const isRefreshCall = url.includes("/auth/refresh");

  // Proactive token refresh - refresh before token expires to prevent 401s
  // Skip for the refresh endpoint itself
  if (!isRefreshCall && isTokenExpired()) {
    try {
      await ensureRefreshedOnce();
    } catch (refreshError) {
      console.error("Proactive token refresh failed:", refreshError);
      // Continue with the request - it may fail with 401 and trigger reactive refresh
    }
  }

  // Perform the fetch with one retry after refresh on 401
  let response = await doFetch(url, fetchOptions);

  if (response.status === 401) {
    try {
      // Attempt to refresh tokens (but never when we're already hitting the refresh endpoint)
      if (!isRefreshCall) {
        await ensureRefreshedOnce();
        // Now retry the request with the new access token
        response = await doFetch(url, fetchOptions);

        // If the retry still returns 401, handle logout
        if (response.status === 401) {
          await handle401Error();
          throw new Error("Authentication failed. Please log in again.");
        }
      } else {
        // If we're hitting the refresh endpoint and get 401, handle logout
        await handle401Error();
        throw new Error("Authentication failed. Please log in again.");
      }
    } catch (refreshError) {
      // If refresh fails, the user needs to log in again
      console.error("Token refresh failed:", refreshError);
      // Handle 401 by logging out and redirecting
      await handle401Error();
      throw new Error("Authentication failed. Please log in again.");
    }
  }

  // Check for HTTP errors
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content responses for any HTTP method
  if (response.status === 204) {
    return undefined as z.infer<T>;
  }

  // Parse JSON - potential error source
  const data = await response.json().catch(() => ({}));

  // Validate using safeParse
  const parseResult = schema.safeParse(data);

  if (!parseResult.success) {
    console.error(
      `Zod validation failed for URL ${url}:`,
      parseResult.error.flatten()
    );
    throw new Error(
      `API response validation failed for ${url}: ${parseResult.error.message}`
    );
  }

  // Return validated data
  return parseResult.data;
};

// Helper for creating SWR mutation functions
export function createMutation<RequestType, ResponseType extends z.ZodTypeAny>(
  endpoint: string,
  method: HTTPMethod,
  responseSchema: ResponseType
) {
  return async function (_: string, { arg }: { arg: RequestType }) {
    return fetcher({
      url: `${API_URL}${endpoint}`,
      method,
      body: arg,
      schema: responseSchema,
    });
  };
}
