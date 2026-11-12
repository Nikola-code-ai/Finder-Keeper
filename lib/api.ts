let tokenProvider: (() => Promise<string | undefined>) | null = null;
export function setTokenProvider(provider: (() => Promise<string | undefined>) | null) { tokenProvider = provider; }
export async function authHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = await tokenProvider?.();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const error = await response.json(); message = typeof error.detail === 'string' ? error.detail : error.error || message; } catch { /* keep useful status */ }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : response.json();
}
type Upload = { mode: 'direct' | 'multipart'; upload_id?: string; url?: string; fields?: Record<string, string> };
/** On AWS the file goes straight to S3 (Lambda requests stop at 6 MB); locally it is a multipart POST. */
export async function uploadDocument<T>(file: File, folder?: string | null): Promise<T> {
  const start = await api<Upload>('/uploads', { method: 'POST', body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }) });
  if (start.mode !== 'direct' || !start.url || !start.fields || !start.upload_id) {
    const data = new FormData(); data.append('file', file); if (folder) data.append('folder_id', folder);
    return api<T>('/documents/upload', { method: 'POST', body: data });
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(start.fields)) form.append(key, value);
  form.append('file', file);
  const stored = await fetch(start.url, { method: 'POST', body: form });
  if (!stored.ok) throw new Error(stored.status === 400 ? 'Please choose a smaller document.' : 'The document could not be stored. Please try again.');
  return api<T>(`/uploads/${encodeURIComponent(start.upload_id)}/complete`, { method: 'POST', body: JSON.stringify({ filename: file.name, content_type: file.type, folder_id: folder || null }) });
}
export async function downloadDocument(id: string, title: string) {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}/file`, { headers: await authHeaders() });
  if (!response.ok) throw new Error('The document could not be downloaded.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url;
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  const type = response.headers.get('content-type') || '';
  const extension = type.includes('epub') ? 'epub' : type.includes('pdf') ? 'pdf' : type.includes('html') ? 'html' : 'txt';
  anchor.download = encoded ? decodeURIComponent(encoded[1]) : plain?.[1] || `${title.replace(/[^a-zA-Z0-9 ._-]/g, '')}.${extension}`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
