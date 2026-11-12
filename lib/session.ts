'use client';
// Cognito sign-in on the AWS deployment. The session lives in HttpOnly cookies set by /auth/*, so the page
// holds no token: requests to /api carry the cookie and the server proxy attaches the reader's ID token.
export type SessionUser = { name: string | null; email: string | null };

export async function cognitoUser(): Promise<SessionUser | null> {
  try {
    const response = await fetch('/auth/session', { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json();
    return body.signedIn ? { name: body.name ?? null, email: body.email ?? null } : null;
  } catch { return null; }
}

export function cognitoSignIn(returnTo = location.pathname + location.search) {
  location.href = `/auth/login?return=${encodeURIComponent(returnTo)}`;
}

/** A real form POST, so the browser follows the redirect to Cognito's logout page. */
export function cognitoSignOut() {
  const form = document.createElement('form');
  form.method = 'POST'; form.action = '/auth/logout';
  document.body.appendChild(form); form.submit();
}
