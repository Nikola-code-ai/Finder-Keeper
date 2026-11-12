import { authorizeUrl, cognitoEnabled, cookie, pkce, PKCE_COOKIE, safeReturn } from '@/lib/cognito-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Start Cognito managed login (authorization code + PKCE). */
export async function GET(request: Request) {
  if (!cognitoEnabled()) return Response.json({ detail: 'Sign-in is not configured.' }, { status: 404 });
  const { verifier, challenge, state } = pkce();
  const returnTo = safeReturn(new URL(request.url).searchParams.get('return'));
  return new Response(null, { status: 302, headers: [
    ['Location', authorizeUrl(state, challenge)],
    ['Set-Cookie', cookie(PKCE_COOKIE, JSON.stringify({ state, verifier, returnTo }), 600, '/auth')],
    ['Cache-Control', 'no-store'],
  ] });
}
