'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, HardDrive } from 'lucide-react';
import styles from './sign-in.module.css';

type Mode = 'checking' | 'local' | 'cloud' | 'unconfigured';

/** The shop door: sign in with Google to open your library. Locally there is one user and the door is already open. */
export default function SignIn() {
  const [mode, setMode] = useState<Mode>('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const [config, status] = await Promise.all([fetch('/config').then(r => r.json()), fetch('/api/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
        if (status && !status.auth_required) { setMode('local'); return; }
        setMode(config.firebase?.apiKey && config.firebase?.projectId ? 'cloud' : 'unconfigured');
      } catch { setMode('unconfigured'); }
    })();
  }, []);
  const signIn = async () => {
    setBusy(true); setError('');
    try {
      const config = await fetch('/config').then(r => r.json());
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const app = getApps()[0] || initializeApp(config.firebase);
      await signInWithPopup(getAuth(app), new GoogleAuthProvider());
      location.href = '/';
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in did not complete.'); } finally { setBusy(false); }
  };
  return <main className={styles.door}>
    <div className={styles.room} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.back} src="/herbarium/room-back.webp" alt="" draggable="false" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.mid} src="/herbarium/room-mid.webp" alt="" draggable="false" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.keeper} src="/herbarium/keeper-poster.webp" alt="" draggable="false" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.front} src="/herbarium/room-front.webp" alt="" draggable="false" />
    </div>
    <section className={styles.card} aria-labelledby="door-title">
      <a className={styles.sign} href="/">finder &amp; keeper<small>a quiet research library</small></a>
      <h1 id="door-title">The shop is open.</h1>
      <p>Find openly available documents, keep them in your drawers, and ask the Keeper about what you have kept. Your library is yours; lend a drawer to a friend when you like.</p>
      {mode === 'checking' && <p className={styles.quiet}>Checking the door…</p>}
      {mode === 'local' && <><p className={styles.quiet}><HardDrive size={15} /> This copy runs on your own computer with one reader, so there is nothing to sign into.</p><a className={styles.enter} href="/">Come in <ArrowRight size={16} /></a></>}
      {mode === 'cloud' && <button className={styles.enter} onClick={signIn} disabled={busy}>{busy ? 'Opening…' : 'Come in with Google'} <ArrowRight size={16} /></button>}
      {mode === 'unconfigured' && <p className={styles.quiet}>Sign-in has not been set up on this installation yet.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.footnote}>No passwords are kept here. Google tells the shop who you are; the shop keeps only your documents and whom you lent them to.</p>
    </section>
  </main>;
}
