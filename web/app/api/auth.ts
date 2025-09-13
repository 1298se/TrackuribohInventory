import { z } from "zod";
import { API_URL, fetcher, HTTPMethod } from "./fetcher";
import { setTokens, clearTokens, AuthTokens } from "./token";

// Schemas matching backend responses
const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string(),
});

const AuthResponseSchema = z.object({
  user: AuthUserSchema,
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  token_type: z.string().default("bearer"),
  expires_in: z.number().optional(),
});

const MessageResponseSchema = z.object({
  message: z.string(),
  success: z.boolean().default(true),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetcher({
    url: `${API_URL}/auth/login`,
    method: HTTPMethod.POST,
    body: { email, password },
    schema: AuthResponseSchema,
  });

  if (res.access_token) {
    const tokens: AuthTokens = {
      accessToken: res.access_token,
      expiresIn: res.expires_in,
    };
    setTokens(tokens);
  }

  return res;
}

export async function refresh(): Promise<AuthResponse> {
  const res = await fetcher({
    url: `${API_URL}/auth/refresh`,
    method: HTTPMethod.POST,
    schema: AuthResponseSchema,
  });

  if (res.access_token) {
    const tokens: AuthTokens = {
      accessToken: res.access_token,
      expiresIn: res.expires_in,
    };
    setTokens(tokens);
  }

  return res;
}

export async function logout(): Promise<MessageResponse> {
  const res = await fetcher({
    url: `${API_URL}/auth/logout`,
    method: HTTPMethod.POST,
    schema: MessageResponseSchema,
  });
  clearTokens();
  return res;
}

export async function me(): Promise<z.infer<typeof AuthUserSchema>> {
  return fetcher({
    url: `${API_URL}/auth/me`,
    schema: AuthUserSchema,
  });
}
