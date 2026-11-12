'use client';

// An open shelf: one collection listed for everyone. Openly licensed works read here; the rest show their card
// and where to find a copy.
import { useEffect, useState } from 'react';
import { BookOpen, Download, ExternalLink, Globe2, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ago, authorsLine, findHref, initial, readerHref } from '@/lib/commons';
import { useViewer } from '@/lib/viewer';
import type { Shelf } from '@/lib/types';
import CommentThread from './comment-thread';
import PublicShell from './public-shell';
import TextReader from './text-reader';
import s from './commons.module.css';

export default function OpenShelf({ id }: { id: string }) {
  const viewer = useViewer();
  const [shelf, setShelf] = useState<Shelf | null>(null), [error, setError] = useState(''), [reading, setReading] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    let live = true;
    api<Shelf>(`/community/shelves/${encodeURIComponent(id)}`).then(v => { if (live) setShelf(v); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'This shelf is not open.'); });
    return () => { live = false; };
  }, [id]);
  const mine = !!shelf && !!viewer.handle && shelf.author.handle === viewer.handle;
  return <PublicShell section="community">
    {error && <p className={s.inlineError} role="alert">{error}</p>}
    {!shelf && !error && <p className={s.muted}><LoaderCircle size={14} className="spin" /> Opening the shelf…</p>}
    {shelf && <>
      <header className={s.flowHead}>
        <div className={s.flowHeadText}>
          <span className={s.cardKind}><Globe2 size={12} aria-hidden="true" /> Open shelf</span>
          <h1>{shelf.name}</h1>
          {shelf.description && <p className={s.bio}>{shelf.description}</p>}
          <p className={s.metaLine}><span className={s.who}><span className={s.avatar} aria-hidden="true">{initial(shelf.author)}</span>{readerHref(shelf.author) ? <a href={readerHref(shelf.author)!}>{shelf.author.display_name}</a> : shelf.author.display_name}</span><span>{shelf.count} {shelf.count === 1 ? 'work' : 'works'}{shelf.published_at ? ` · opened ${ago(shelf.published_at)}` : ''}</span></p>
        </div>
        {mine && <div className={s.flowTools}><a className={s.ghost} href="/?view=community">Manage your shelves</a></div>}
      </header>
      <ul className={s.works} aria-label="Works on this shelf">
        {(shelf.documents || []).map(doc => <li key={doc.id} className={s.work}>
          <div className={s.workText}><strong>{doc.title}</strong><small>{[authorsLine(doc), doc.year, doc.kind, `${doc.page_count || '–'} ${doc.kind === 'PDF' ? 'pages' : 'sections'}`, doc.license].filter(Boolean).join(' · ')}</small>{doc.summary && <p>{doc.summary}</p>}</div>
          <div className={s.workTools}>
            {doc.readable ? <><button type="button" className={s.amber} onClick={() => setReading({ id: doc.id, title: doc.title })}><BookOpen size={14} /> Read</button><a className={s.ghost} href={`/api/community/documents/${doc.id}/file?download=true`} aria-label={`Download ${doc.title}`}><Download size={14} /></a></>
              : <><a className={s.ghost} href={findHref(doc.title)}><Globe2 size={14} /> Find a copy</a>{doc.source_url && <a className={s.ghost} href={doc.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Source</a>}</>}
          </div>
        </li>)}
        {(shelf.documents || []).length === 0 && <li className={s.muted}>Nothing on this shelf yet.</li>}
      </ul>
      <CommentThread kind="shelf" id={shelf.id} canPost={viewer.signedIn} canModerate={mine} viewerHandle={viewer.handle} signInHref="/sign-in" onError={setError} />
    </>}
    {reading && <TextReader documentId={reading.id} title={reading.title} onClose={() => setReading(null)} />}
  </PublicShell>;
}
