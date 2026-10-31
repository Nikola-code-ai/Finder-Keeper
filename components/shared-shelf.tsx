'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Download } from 'lucide-react';
import type { Document } from '@/lib/types';
import styles from './shared-shelf.module.css';

interface Shelf { name: string; owner_email: string; documents: Document[] }
interface Opened extends Document { pages?: { page_number: number; text: string }[] }

/** A collection opened by its link: one drawer from someone's desk, read-only, no sign-in. */
export default function SharedShelf({ token }: { token: string }) {
  const [shelf, setShelf] = useState<Shelf | null>(null), [error, setError] = useState(''), [open, setOpen] = useState<Opened | null>(null), [page, setPage] = useState(1);
  useEffect(() => {
    fetch(`/api/shared/${encodeURIComponent(token)}`, { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error(r.status === 404 ? 'This link does not open anything. It may have been taken back.' : 'The shelf could not be reached.'); return r.json(); }).then(setShelf).catch(e => setError(e.message));
  }, [token]);
  const read = async (doc: Document) => {
    try { const r = await fetch(`/api/shared/${encodeURIComponent(token)}/documents/${doc.id}`, { cache: 'no-store' }); if (!r.ok) throw new Error('This sheet could not be opened.'); setOpen(await r.json()); setPage(1); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this sheet.'); }
  };
  const pages = open?.pages || [];
  const text = pages.find(p => p.page_number === page)?.text || '';
  return <main className={styles.shelf}>
    <a className={styles.sign} href="/">finder &amp; keeper<small>a quiet research library</small></a>
    {error && <p className={styles.note} role="alert">{error}</p>}
    {shelf && <>
      <header className={styles.head}><h1>{shelf.name}</h1><p>A drawer lent by {shelf.owner_email || 'someone'} · {shelf.documents.length} {shelf.documents.length === 1 ? 'sheet' : 'sheets'} · read-only</p></header>
      <div className={styles.split}>
        <ul className={styles.sheets}>{shelf.documents.map(doc => <li key={doc.id} data-open={open?.id === doc.id}>
          <button onClick={() => read(doc)}><span>{doc.title}</span><small>{doc.authors?.join(', ') || 'Unknown author'}{doc.year ? ` · ${doc.year}` : ''} · {doc.kind || 'Document'} · {doc.page_count || '–'} {doc.kind === 'PDF' ? 'pages' : 'sections'}</small></button>
          <a href={`/api/shared/${encodeURIComponent(token)}/documents/${doc.id}/file?download=true`} aria-label={`Download ${doc.title}`}><Download size={15} /></a>
        </li>)}{shelf.documents.length === 0 && <li className={styles.empty}>Nothing mounted in this drawer yet.</li>}</ul>
        {open && <article className={styles.reader}>
          <h2><BookOpen size={18} /> {open.title}</h2>
          <div className={styles.pager}><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>{open.kind === 'PDF' ? 'page' : 'section'} {page} of {pages.length || open.page_count || 1}</span><button disabled={page >= (pages.length || 1)} onClick={() => setPage(p => p + 1)}>Next</button></div>
          <p className={styles.text}>{text || 'No readable text for this page.'}</p>
          <a className={styles.original} href={`/api/shared/${encodeURIComponent(token)}/documents/${open.id}/file`} target="_blank" rel="noopener noreferrer">Open the original <ArrowUpRight size={13} /></a>
        </article>}
      </div>
    </>}
  </main>;
}
