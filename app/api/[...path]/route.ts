import { GoogleAuth } from 'google-auth-library';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const googleAuth = new GoogleAuth();
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: Request, context: Context) {
  const localMode = process.env.AUTH_MODE !== 'firebase' && process.env.APP_ENV !== 'production';
  if (localMode) {
    const requestUrl = new URL(request.url);
    const host = request.headers.get('host') || '';
    const allowedHosts = new Set([`localhost:${requestUrl.port || '3000'}`, `127.0.0.1:${requestUrl.port || '3000'}`, `[::1]:${requestUrl.port || '3000'}`]);
    const origin = request.headers.get('origin');
    let validOrigin = !origin;
    if (origin) { try { validOrigin = allowedHosts.has(new URL(origin).host) && new URL(origin).protocol === 'http:'; } catch { validOrigin = false; } }
    if (!allowedHosts.has(host) || !validOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return Response.json({ detail: 'This local library only accepts requests from its own browser window.' }, { status: 403 });
    }
  }
  const { path } = await context.params;
  if (path.some(segment => segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    return Response.json({ detail: 'Invalid API path.' }, { status: 400 });
  }
  // Internal task endpoints are deliberately not exposed through the browser proxy.
  if (!['status','library','folders','documents','search','ask','discover','import','jobs','health'].includes(path[0])) {
    return Response.json({ detail: 'Not found.' }, { status: 404 });
  }
  const base = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:8010').replace(/\/$/, '');
  const target = new URL(`${base}/api/${path.map(encodeURIComponent).join('/')}`);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const key of ['authorization','content-type','range','if-range','accept','origin']) {
    const value = request.headers.get(key); if (value) headers.set(key, value);
  }
  try {
    if (process.env.CLOUD_RUN_PROXY_AUTH === 'true') {
      const client = await googleAuth.getIdTokenClient(base);
      const iamHeaders = await client.getRequestHeaders();
      const iamAuthorization = iamHeaders.get('authorization');
      if (iamAuthorization) headers.set('X-Serverless-Authorization', iamAuthorization);
    }
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 30 * 1024 * 1024) return Response.json({ detail: 'Please choose a file smaller than 30 MB.' }, { status: 413 });
    const response = await fetch(target, { method: request.method, headers, body, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(180000) });
    const outputHeaders = new Headers();
    for (const key of ['content-type','content-disposition','content-range','accept-ranges','retry-after']) {
      const value = response.headers.get(key); if (value) outputHeaders.set(key, value);
    }
    outputHeaders.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  } catch {
    return Response.json({ detail: 'The library service is not available yet. Please try again in a moment.' }, { status: 503 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as PUT, proxy as HEAD };
