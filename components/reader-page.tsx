'use client';

// A reader's page in the commons: who they are, the shelves they opened, the flows they published, the books they reviewed.
import { useEffect, useState } from 'react';
import { LoaderCircle, UserCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { ago, initial } from '@/lib/commons';
import { useViewer } from '@/lib/viewer';
import type { ReaderPage as ReaderPageData } from '@/lib/types';
import { FlowCard, ReviewCard, ShelfCard } from './community-view';
import PublicShell from './public-shell';
import s from './commons.module.css';

export default function ReaderPage({ handle }: { handle: string }) {
  const viewer = useViewer();
  const [page, setPage] = useState<ReaderPageData | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<ReaderPageData>(`/community/readers/${encodeURIComponent(handle)}`).then(v => { if (live) setPage(v); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'This reader could not be found.'); });
    return () => { live = false; };
  }, [handle, viewer.signedIn]);
  const follow = async () => {
    if (!page || busy) return; setBusy(true);
    try { const r = await api<{ following: boolean; follower_count: number }>(`/follows/${encodeURIComponent(handle)}`, { method: 'POST' }); setPage({ ...page, following: r.following, follower_count: r.follower_count }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not follow this reader.'); } finally { setBusy(false); }
  };
  return <PublicShell section="community">
    {error && <p className={s.inlineError} role="alert">{error}</p>}
    {!page && !error && <p className={s.muted}><LoaderCircle size={14} className="spin" /> Finding this reader…</p>}
    {page && <>
      <header className={s.profileHead}>
        <span className={s.avatar} data-hero="true" aria-hidden="true">{initial(page)}</span>
        <div className={s.profileText}>
          <h1>{page.display_name} <small>@{page.handle}</small></h1>
          {page.bio && <p className={s.bio}>{page.bio}</p>}
          <p className={s.metaLine}><span>{page.shelf_count} open {page.shelf_count === 1 ? 'shelf' : 'shelves'} · {page.flow_count} {page.flow_count === 1 ? 'flow' : 'flows'} · {page.review_count} {page.review_count === 1 ? 'review' : 'reviews'}</span><span>{page.follower_count} {page.follower_count === 1 ? 'follower' : 'followers'} · following {page.following_count}{page.joined ? ` · here since ${ago(page.joined)}` : ''}</span></p>
        </div>
        <div className={s.profileTools}>
          {page.you ? <a className={s.ghost} href="/?view=community">Edit your page</a>
            : viewer.signedIn ? <button type="button" className={page.following ? s.ghost : s.amber} disabled={busy} onClick={follow}>{page.following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}</button>
            : viewer.ready ? <a className={s.ghost} href="/sign-in">Sign in to follow</a> : null}
        </div>
      </header>
      <section className={s.block} aria-labelledby="shelves-h"><h2 id="shelves-h">Open shelves <small>{page.shelves.length}</small></h2>{page.shelves.length ? <div className={s.cards}>{page.shelves.map(sh => <ShelfCard key={sh.id} shelf={sh} />)}</div> : <p className={s.muted}>No shelves opened yet.</p>}</section>
      <section className={s.block} aria-labelledby="flows-h"><h2 id="flows-h">Reading flows <small>{page.flows.length}</small></h2>{page.flows.length ? <div className={s.cards}>{page.flows.map(f => <FlowCard key={f.id} flow={f} />)}</div> : <p className={s.muted}>No flows published yet.</p>}</section>
      <section className={s.block} aria-labelledby="reviews-h"><h2 id="reviews-h">Reviews <small>{page.reviews.length}</small></h2>{page.reviews.length ? <div className={s.reviewList}>{page.reviews.map(r => <ReviewCard key={r.id} review={r} />)}</div> : <p className={s.muted}>No reviews yet.</p>}</section>
    </>}
  </PublicShell>;
}
