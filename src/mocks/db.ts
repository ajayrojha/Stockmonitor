import type { User } from '../auth/types';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demoAccounts';

// A tiny fake "database" for the mock API. It lives in localStorage so a page
// reload behaves like a real server that remembers sessions. In Phase 2 this
// whole folder is replaced by the real auth and user service.

interface StoredUser extends User {
  password: string; // plain text only because this is a mock; a real server stores a hash
}

interface Session {
  userId: string;
  expiresAt: number; // epoch ms
}

interface MockDb {
  users: StoredUser[];
  accessTokens: Record<string, Session>;
  refreshTokens: Record<string, Session>;
}

export const ACCESS_TOKEN_TTL_S = 5 * 60;
export const REFRESH_TOKEN_TTL_S = 8 * 60 * 60;

const STORAGE_KEY = 'stockmonitor.mockdb.v1';

const seedUsers: StoredUser[] = DEMO_ACCOUNTS.map(a => ({ ...a, active: true, password: DEMO_PASSWORD }));

const load = (): MockDb => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // Corrupt or blocked storage: start fresh.
  }
  return { users: seedUsers, accessTokens: {}, refreshTokens: {} };
};

const db: MockDb = load();

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable (private mode); the mock still works for this tab.
  }
};

const toPublicUser = (stored: StoredUser): User => {
  const { id, email, name, role, active } = stored;
  return { id, email, name, role, active };
};

export const findUserByCredentials = (email: string, password: string) => {
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  return user ? toPublicUser(user) : null;
};

export const findUserById = (id: string) => {
  const user = db.users.find(u => u.id === id);
  return user ? toPublicUser(user) : null;
};

const issue = (store: Record<string, Session>, userId: string, ttlSeconds: number) => {
  const token = crypto.randomUUID();
  store[token] = { userId, expiresAt: Date.now() + ttlSeconds * 1000 };
  save();
  return token;
};

export const issueAccessToken = (userId: string) => issue(db.accessTokens, userId, ACCESS_TOKEN_TTL_S);
export const issueRefreshToken = (userId: string) => issue(db.refreshTokens, userId, REFRESH_TOKEN_TTL_S);

const resolve = (store: Record<string, Session>, token: string | undefined) => {
  if (!token) return null;
  const session = store[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete store[token];
    save();
    return null;
  }
  return findUserById(session.userId);
};

export const userForAccessToken = (token: string | undefined) => resolve(db.accessTokens, token);
export const userForRefreshToken = (token: string | undefined) => resolve(db.refreshTokens, token);

export const revokeRefreshToken = (token: string | undefined) => {
  if (token && db.refreshTokens[token]) {
    delete db.refreshTokens[token];
    save();
  }
};
