import { apiFetch, refreshAccessToken, setAccessToken } from '../api/client';
import type { LoginResponse, User } from './types';

export const login = async (email: string, password: string): Promise<User> => {
  // No refresh-and-retry here: a 401 from login means wrong credentials.
  const res = await apiFetch<LoginResponse>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  setAccessToken(res.accessToken);
  return res.user;
};

export const logout = async (): Promise<void> => {
  try {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' }, false);
  } finally {
    setAccessToken(null);
  }
};

// On page load the in-memory access token is gone, but the refresh cookie may
// still be valid. Trade it for a new access token, then load the user.
export const restoreSession = async (): Promise<User | null> => {
  const token = await refreshAccessToken();
  if (!token) return null;
  return apiFetch<User>('/api/auth/me');
};
