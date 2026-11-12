// Server-only Cognito session for the AWS deployment. The browser never sees a token: Next.js runs the
// authorization-code + PKCE exchange and keeps the ID and refresh tokens in HttpOnly cookies; the API
// proxy attaches the ID token, which the FastAPI backend verifies against the user pool's keys.
import { createHash, randomBytes } from 'node:crypto';

export const ID_COOKIE = 'fk_id', REFRESH_COOKIE = 'fk_refresh', PKCE_COOKIE = 'fk_pkce';
const REFRESH_SECONDS = 30 * 24 * 3600;

export function cognitoEnabled() {
  return process.env.AUTH_MODE === 'cognito' && !!process.env.COGNITO_CLIENT_ID && !!process.env.COGNITO_DOMAIN;
}
export function siteUrl() { return (process.env.SITE_URL || '').replace(/\/$/, ''); }
const clientId = () => process.env.COGNITO_CLIENT_ID || '';
const domain = () => `https://${process.env.COGNITO_DOMAIN}`;
export const redirectUri = () => `${siteUrl()}/auth/callback`;

const base64url = (data: Buffer) => data.toString('base64url');
export function pkce() {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()), state: base64url(randomBytes(16)) };
}

export function readCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return out;
}
export function cookie(name: string, value: string, maxAge: number, path = '/') {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

/** Claims for display and expiry only; the backend verifies the signature on every request. */
export function claims(token: string): Record<string, unknown> {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}

/** Only same-site relative paths, so the sign-in round trip cannot be turned into an open redirect. */
export function safeReturn(path: string | null) {
  return path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/';
}

export function authorizeUrl(state: string, challenge: string) {
  const url = new URL(`${domain()}/oauth2/authorize`);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId(), redirect_uri: redirectUri(), scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return url.toString();
}
export function logoutUrl() {
  return `${domain()}/logout?${new URLSearchParams({ client_id: clientId(), logout_uri: `${siteUrl()}/` })}`;
}

type Tokens = { id_token?: string; refresh_token?: string };
async function tokenEndpoint(params: Record<string, string>): Promise<Tokens | null> {
  const response = await fetch(`${domain()}/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...params }), cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  return response.ok ? response.json() : null;
}
export function exchangeCode(code: string, verifier: string) {
  return tokenEndpoint({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri() });
}
export async function revoke(refreshToken: string) {
  await fetch(`${domain()}/oauth2/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken, client_id: clientId() }), signal: AbortSignal.timeout(5000) }).catch(() => {});
}

export function tokenCookies(tokens: Tokens): string[] {
  const out: string[] = [];
  if (tokens.id_token) out.push(cookie(ID_COOKIE, tokens.id_token, Number(claims(tokens.id_token).exp || 0) - Date.now() / 1000));
  // With refresh-token rotation Cognito returns a new refresh token; keep the old one otherwise.
  if (tokens.refresh_token) out.push(cookie(REFRESH_COOKIE, tokens.refresh_token, REFRESH_SECONDS));
  return out;
}
export const clearCookies = () => [cookie(ID_COOKIE, '', 0), cookie(REFRESH_COOKIE, '', 0)];

/** The current ID token, refreshed when it is within a minute of expiring. Returns cookies to set on the response. */
export async function session(request: Request): Promise<{ idToken?: string; setCookies: string[] }> {
  const jar = readCookies(request);
  const id = jar[ID_COOKIE];
  if (id && Number(claims(id).exp || 0) > Date.now() / 1000 + 60) return { idToken: id, setCookies: [] };
  const refresh = jar[REFRESH_COOKIE];
  if (!refresh) return { setCookies: id ? [cookie(ID_COOKIE, '', 0)] : [] };
  const tokens = await tokenEndpoint({ grant_type: 'refresh_token', refresh_token: refresh }).catch(() => null);
  if (!tokens?.id_token) return { setCookies: clearCookies() };
  return { idToken: tokens.id_token, setCookies: tokenCookies(tokens) };
}

/** Cookie-authenticated writes must come from the site itself (SameSite=Lax is the first guard). */
export function sameOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  return !!origin && origin === siteUrl();
}

export function withCookies(response: Response, setCookies: string[]) {
  for (const value of setCookies) response.headers.append('Set-Cookie', value);
  return response;
}
