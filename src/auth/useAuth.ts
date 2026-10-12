import { useContext } from 'react';
import { AuthContext } from './authContext';

// Like injecting an AuthService in Angular, but resolved from the nearest
// <AuthProvider> above this component in the tree.
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
};
