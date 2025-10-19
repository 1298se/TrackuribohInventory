export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://trackuribohinventory-fragrant-bird-5215.fly.dev"
    : "http://localhost:8000");
