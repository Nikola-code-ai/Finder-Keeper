import { clearCookies, cognitoEnabled, logoutUrl, readCookies, REFRESH_COOKIE, revoke, sameOrigin } from '@/lib/cognito-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke the refresh token, clear the cookies, and end the managed-login session too. */
export async function POST(request: Request) {
  if (!cognitoEnabled()) return Response.json({ detail: 'Sign-in is not configured.' }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ detail: 'Sign out from the site itself.' }, { status: 403 });
  const refresh = readCookies(request)[REFRESH_COOKIE];
  if (refresh) await revoke(refresh);
  const headers = new Headers({ Location: logoutUrl(), 'Cache-Control': 'no-store' });
  for (const value of clearCookies()) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}
