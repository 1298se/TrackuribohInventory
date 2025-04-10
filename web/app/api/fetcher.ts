import { z, ZodError } from "zod"; // Import ZodError for potential type checking if needed

export const API_URL = "http://localhost:8000"

// Make FetcherParams generic and add required schema
export interface FetcherParams<T extends z.ZodTypeAny> {
  url: string;
  init?: RequestInit;
  params?: Record<string, string>;
  schema: T; // Require a Zod schema
}

// Make fetcher generic, accepting FetcherParams<T> and returning Promise<z.infer<T>>
export const fetcher = async <T extends z.ZodTypeAny>({ 
  url, 
  init = undefined, 
  params = undefined, 
  schema // Destructure the schema
}: FetcherParams<T>): Promise<z.infer<T>> => {
  
  // Append params if they exist
  if (params) {
    const queryParams = new URLSearchParams(params)
    url = `${url}?${queryParams}`
  }

  // Perform the fetch
  const response = await fetch(url, init);

  // Check for HTTP errors
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Parse JSON - potential error source
  const data = await response.json();
  
  // Validate using safeParse
  const parseResult = schema.safeParse(data);

  if (!parseResult.success) {
    console.error(`Zod validation failed for URL ${url}:`, parseResult.error.flatten()); // Keep specific Zod error log
    throw new Error(`API response validation failed for ${url}: ${parseResult.error.message}`);
  }

  // Return validated data
  return parseResult.data;
};
