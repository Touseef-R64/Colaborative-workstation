const ACCESS_TOKEN_KEY = "access";
const REFRESH_TOKEN_KEY = "refresh";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
// How long before expiry to proactively refresh. You said you'd tune this —
// this is the single place to change it.
const REFRESH_BUFFER_SECONDS = 60;

interface JwtPayload {
  exp: number; // seconds since epoch
  [key: string]: unknown;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getAccessTokenExpiryMs(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    // TODO: confirm this matches your actual refresh endpoint path.
    const res = await fetch(`${API_URL}/users/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;

    const data = await res.json();
    if (!data.access) return false;

    setTokens(data.access, data.refresh ?? refresh); // handles ROTATE_REFRESH_TOKENS either way
    return true;
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

export function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    return {
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Wrapper around fetch that automatically adds JWT headers.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const headers = {
    ...getAuthHeaders(),
    ...(init.headers || {}),
  };

  return fetch(input, {
    ...init,
    headers,
  });
}