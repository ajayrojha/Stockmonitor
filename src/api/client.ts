// One place for every call to our own API: it attaches the access token,
// refreshes it once on a 401 and turns error responses into ApiError.
// This is the React equivalent of an Angular HttpInterceptor.

// Empty means "same origin", which is where the mock API answers. In Phase 2,
// point VITE_API_URL at the real gateway.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Kept in memory only: anything in localStorage can be read by any script
// that ends up on the page.
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// The auth provider registers this so a session that can't be refreshed
// signs the user out everywhere.
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

// Several requests can fail with 401 at the same moment; they all wait on one
// refresh instead of each starting their own.
export const refreshAccessToken = (): Promise<string | null> => {
  refreshInFlight ??= fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async res => {
      if (!res.ok) return null;
      const body = (await res.json()) as { accessToken: string };
      return body.accessToken;
    })
    .catch(() => null)
    .then(token => {
      accessToken = token;
      refreshInFlight = null;
      return token;
    });
  return refreshInFlight;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 401 && allowRefresh) {
    const token = await refreshAccessToken();
    if (token) return apiFetch<T>(path, init, false);
    onUnauthorized?.();
  }

  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Not JSON; keep the status text.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
