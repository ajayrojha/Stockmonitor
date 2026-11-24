import { http, HttpResponse, delay } from 'msw';
import type { LoginResponse } from '../auth/types';
import {
  ACCESS_TOKEN_TTL_S,
  REFRESH_TOKEN_TTL_S,
  findUserByCredentials,
  issueAccessToken,
  issueRefreshToken,
  revokeRefreshToken,
  userForAccessToken,
  userForRefreshToken,
} from './db';

// The refresh token travels in a cookie, like a real server would send it.
// A real server marks it HttpOnly so page scripts can never read it; a mock
// running inside the page can't enforce that, which is one reason this whole
// folder is replaced by a real service in Phase 2.
const REFRESH_COOKIE = 'sm_refresh';

const refreshCookie = (token: string) =>
  `${REFRESH_COOKIE}=${token}; Path=/; Max-Age=${REFRESH_TOKEN_TTL_S}; SameSite=Strict`;
const clearRefreshCookie = `${REFRESH_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict`;

const bearerToken = (request: Request) =>
  request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || undefined;

const error = (status: number, message: string) => HttpResponse.json({ message }, { status });

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(400);
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    const user = findUserByCredentials(email ?? '', password ?? '');
    // Same message for unknown email and wrong password, so the API doesn't
    // reveal which accounts exist.
    if (!user) return error(401, 'Invalid email or password.');
    if (!user.active) return error(403, 'This account has been deactivated.');

    const body: LoginResponse = { accessToken: issueAccessToken(user.id), expiresIn: ACCESS_TOKEN_TTL_S, user };
    return HttpResponse.json(body, { headers: { 'Set-Cookie': refreshCookie(issueRefreshToken(user.id)) } });
  }),

  http.post('/api/auth/refresh', async ({ cookies }) => {
    await delay(150);
    const oldToken = cookies[REFRESH_COOKIE];
    const user = userForRefreshToken(oldToken);
    if (!user || !user.active) {
      return HttpResponse.json({ message: 'Session expired.' }, { status: 401, headers: { 'Set-Cookie': clearRefreshCookie } });
    }
    // Rotate the refresh token on every use so a stolen one stops working.
    revokeRefreshToken(oldToken);
    const body: LoginResponse = { accessToken: issueAccessToken(user.id), expiresIn: ACCESS_TOKEN_TTL_S, user };
    return HttpResponse.json(body, { headers: { 'Set-Cookie': refreshCookie(issueRefreshToken(user.id)) } });
  }),

  http.post('/api/auth/logout', async ({ cookies }) => {
    revokeRefreshToken(cookies[REFRESH_COOKIE]);
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': clearRefreshCookie } });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(150);
    const user = userForAccessToken(bearerToken(request));
    return user ? HttpResponse.json(user) : error(401, 'Not signed in.');
  }),
];
