'use client';
// Who is looking at a public page. Locally there is one reader and the door is open; in the cloud the page works
// signed out (read-only) and remembers ticks, follows and notes once the reader has signed in.
import { useEffect, useState } from 'react';
import { api, setTokenProvider } from './api';
import type { ReaderProfile } from './types';

export interface Viewer { ready: boolean; signedIn: boolean; local: boolean; name: string | null; handle: string | null }

export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>({ ready: false, signedIn: false, local: false, name: null, handle: null });
  useEffect(() => {
    let unsubscribe: (() => void) | undefined, live = true;
    (async () => {
      try {
        const [config, status] = await Promise.all([
          fetch('/config').then(r => r.json()).catch(() => ({})),
          fetch('/api/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (status && !status.auth_required) {
          const me = await api<ReaderProfile>('/me/profile').catch(() => null);
          if (live) setViewer({ ready: true, signedIn: true, local: true, name: me?.display_name || 'You', handle: me?.handle || null });
          return;
        }
        if (config.firebase?.apiKey && config.firebase?.projectId) {
          const { initializeApp, getApps } = await import('firebase/app');
          const { getAuth, onAuthStateChanged } = await import('firebase/auth');
          const auth = getAuth(getApps()[0] || initializeApp(config.firebase));
          setTokenProvider(async () => auth.currentUser?.getIdToken());
          unsubscribe = onAuthStateChanged(auth, async user => {
            if (!live) return;
            if (!user) { setViewer({ ready: true, signedIn: false, local: false, name: null, handle: null }); return; }
            const me = await api<ReaderProfile>('/me/profile').catch(() => null);
            if (live) setViewer({ ready: true, signedIn: true, local: false, name: user.displayName || user.email || 'You', handle: me?.handle || null });
          });
          return;
        }
      } catch { /* the page still reads */ }
      if (live) setViewer(v => ({ ...v, ready: true }));
    })();
    return () => { live = false; unsubscribe?.(); };
  }, []);
  return viewer;
}
