export type AuthTokens = {
  accessToken: string;
  expiresIn?: number; // seconds
};

let accessTokenMemory: string | null = null;
let tokenExpiryTime: number | null = null;

export function setTokens(tokens: AuthTokens) {
  accessTokenMemory = tokens.accessToken;

  // Calculate and store expiration time
  if (tokens.expiresIn) {
    tokenExpiryTime = Date.now() + tokens.expiresIn * 1000;
  } else {
    // Default to 30 minutes if no expiresIn provided
    tokenExpiryTime = Date.now() + 30 * 60 * 1000;
  }
}

export function clearTokens() {
  accessTokenMemory = null;
  tokenExpiryTime = null;
}

export function getAccessToken(): string | null {
  // Check if token is expired
  if (tokenExpiryTime && Date.now() >= tokenExpiryTime) {
    accessTokenMemory = null;
    tokenExpiryTime = null;
    return null;
  }

  return accessTokenMemory;
}

export function isTokenExpired(): boolean {
  if (!tokenExpiryTime) return true;
  return Date.now() >= tokenExpiryTime;
}
