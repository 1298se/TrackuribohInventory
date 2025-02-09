export const API_URL = "http://localhost:8000"

export interface FetcherParams {
  url: string;
  init?: RequestInit;
  params?: Record<string, string>
}

export const fetcher = async ({ url, init = undefined, params = undefined }: FetcherParams) => {
  try {
    if (params) {
      const queryParams = new URLSearchParams(params)
      url = `${url}?${queryParams}`
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetching error:", error);
    throw error; // Re-throw the error so useSWR can handle it
  }
};
