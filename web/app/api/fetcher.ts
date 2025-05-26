import { z, ZodError } from "zod"; // Import ZodError for potential type checking if needed

export const API_URL = "http://localhost:8000";

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
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  };

  // Add body for non-GET requests
  if (method !== HTTPMethod.GET && body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Perform the fetch
  const response = await fetch(url, fetchOptions);

  // Check for HTTP errors
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // For DELETE operations that don't return data
  if (method === HTTPMethod.DELETE && response.status === 204) {
    // If schema expects void or undefined, return it
    if (schema === z.void() || schema === z.undefined()) {
      return undefined as z.infer<T>;
    }
  }

  // Parse JSON - potential error source
  const data = await response.json().catch(() => ({}));

  // Validate using safeParse
  const parseResult = schema.safeParse(data);

  if (!parseResult.success) {
    console.error(
      `Zod validation failed for URL ${url}:`,
      parseResult.error.flatten(),
    );
    throw new Error(
      `API response validation failed for ${url}: ${parseResult.error.message}`,
    );
  }

  // Return validated data
  return parseResult.data;
};

// Helper for creating SWR mutation functions
export function createMutation<RequestType, ResponseType extends z.ZodTypeAny>(
  endpoint: string,
  method: HTTPMethod,
  responseSchema: ResponseType,
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
