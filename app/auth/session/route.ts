import { claims, cognitoEnabled, session, withCookies } from '@/lib/cognito-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who is signed in, for display. Tokens stay in HttpOnly cookies; only the address and name come back. */
export async function GET(request: Request) {
  if (!cognitoEnabled()) return Response.json({ signedIn: false }, { status: 404 });
  const { idToken, setCookies } = await session(request);
  const user = idToken ? claims(idToken) : null;
  const body = user ? { signedIn: true, email: user.email ?? null, name: (user.name as string) || (user.email as string) || null } : { signedIn: false };
  return withCookies(Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } }), setCookies);
}
