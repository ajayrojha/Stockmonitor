import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../api/client';
import * as authApi from './authApi';
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext';
import type { User } from './types';
import { useIdleTimeout } from './useIdleTimeout';

const IDLE_LOGOUT_MS = 15 * 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Restore a session from the refresh cookie once, on page load.
  useEffect(() => {
    let cancelled = false;
    authApi
      .restoreSession()
      .catch(() => null)
      .then(restored => {
        if (cancelled) return;
        setUser(restored);
        setStatus(restored ? 'authenticated' : 'anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If any API call finds the session can't be refreshed, sign out here too.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await authApi.login(email, password);
    setUser(signedIn);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useIdleTimeout(IDLE_LOGOUT_MS, logout, status === 'authenticated');

  // Memoised so consumers only re-render when auth actually changes.
  const value = useMemo<AuthContextValue>(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
