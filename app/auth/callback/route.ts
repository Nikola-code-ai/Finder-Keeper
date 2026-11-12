import { cognitoEnabled, cookie, exchangeCode, PKCE_COOKIE, readCookies, safeReturn, siteUrl, tokenCookies } from '@/lib/cognito-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cognito returns here with a code; trade it (with the PKCE verifier) for tokens kept in HttpOnly cookies. */
export async function GET(request: Request) {
  if (!cognitoEnabled()) return Response.json({ detail: 'Sign-in is not configured.' }, { status: 404 });
  const params = new URL(request.url).searchParams;
  let saved: { state?: string; verifier?: string; returnTo?: string } = {};
  try { saved = JSON.parse(readCookies(request)[PKCE_COOKIE] || '{}'); } catch { /* treated as missing */ }
  const code = params.get('code');
  const failed = (reason: string) => new Response(null, { status: 302, headers: [
    ['Location', `${siteUrl()}/sign-in?error=${encodeURIComponent(reason)}`],
    ['Set-Cookie', cookie(PKCE_COOKIE, '', 0, '/auth')], ['Cache-Control', 'no-store'],
  ] });
  if (!code || !saved.state || !saved.verifier || params.get('state') !== saved.state) return failed('The sign-in link expired. Please try again.');
  const tokens = await exchangeCode(code, saved.verifier).catch(() => null);
  if (!tokens?.id_token) return failed('Sign-in did not complete. Please try again.');
  const headers = new Headers({ Location: `${siteUrl()}${safeReturn(saved.returnTo || '/')}`, 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(PKCE_COOKIE, '', 0, '/auth'));
  for (const value of tokenCookies(tokens)) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
}
