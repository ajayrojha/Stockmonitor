import { createContext } from 'react';
import type { User } from './types';

// 'checking' covers the first moments after a page load, while we find out
// whether the refresh cookie still holds a valid session.
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
