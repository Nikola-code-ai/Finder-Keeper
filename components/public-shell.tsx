'use client';

// The frame around a public page of the commons: the same reading-room surface as the library, with a header
// that leads back in. No sign-in is needed to read; the viewer, if signed in, is named at the right.
import type { ReactNode } from 'react';
import { useViewer } from '@/lib/viewer';
import { WebCorner } from './spider-bits';
import { HangingLamp } from './library-doodles';
import s from './commons.module.css';
import ws from './workspace.module.css';

export default function PublicShell({ children, section }: { children: ReactNode; section?: 'flows' | 'community' }) {
  const viewer = useViewer();
  return <div className={`${ws.workspace} ${ws.shell} ${s.public}`} data-workspace="">
    <div className={ws.aura} aria-hidden="true" />
    <div className={ws.doodles} aria-hidden="true"><HangingLamp className={ws.dLamp} /><WebCorner corner="top-right" size={190} className={ws.dWebTop} /><WebCorner corner="bottom-left" size={150} className={ws.dWebBottom} /></div>
    <header className={ws.header}>
      <a className={ws.brand} href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={30} height={30} />
        <span>Finder &amp; Keeper</span><i aria-hidden="true">•</i><small>the commons</small>
      </a>
      <nav className={`${ws.nav} ${s.publicNav}`} aria-label="Sections"><a href="/">Library</a><a href="/?view=flows" aria-current={section === 'flows' ? 'page' : undefined}>Flows</a><a href="/?view=community" aria-current={section === 'community' ? 'page' : undefined}>Community</a></nav>
      <div className={ws.headerEnd}>{viewer.ready && (viewer.signedIn ? <a className={ws.avatar} href={viewer.handle ? `/u/${viewer.handle}` : '/?view=community'} title={viewer.name || 'You'}>{(viewer.name || 'K').slice(0, 1).toUpperCase()}</a> : <a className={s.ghost} href="/sign-in">Sign in</a>)}</div>
    </header>
    <main className={`${ws.main} ${s.publicMain}`} id="main">{children}</main>
    <footer className={ws.footer}><span>Finder &amp; Keeper <i aria-hidden="true">•</i> the commons</span><span>open shelves <i aria-hidden="true">•</i> reading flows <i aria-hidden="true">•</i> reviews</span></footer>
  </div>;
}
