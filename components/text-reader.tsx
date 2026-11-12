'use client';

// Reading an openly licensed document from the commons: the extracted text, page by page, with the passage a flow
// pointed at set apart. Nothing here needs the reader's own library.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle } from 'lucide-react';
import type { Document } from '@/lib/types';
import { authorsLine } from '@/lib/commons';
import Dialog from './dialog';
import s from './commons.module.css';

export default function TextReader({ documentId, title, page: initialPage = 1, excerpt, onClose }: { documentId: string; title: string; page?: number; excerpt?: string; onClose: () => void }) {
  const [doc, setDoc] = useState<Document | null>(null), [page, setPage] = useState(initialPage || 1), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/community/documents/${encodeURIComponent(documentId)}`, { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error(r.status === 404 ? 'This text is not open to read here. Its card tells you where to find it.' : 'The text could not be opened.'); return r.json(); })
      .then(v => { if (live) setDoc(v); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [documentId]);
  const pages = doc?.pages || [];
  const total = pages.length || doc?.page_count || 1;
  const text = pages.find(p => p.page_number === page)?.text || '';
  const at = excerpt && page === initialPage ? text.indexOf(excerpt) : -1;
  const unit = doc?.kind === 'PDF' ? 'page' : 'section';
  return <Dialog title="Reading in the commons" wide onClose={onClose}>
    <div className="reader-meta"><div><h3>{doc?.title || title}</h3><p>{doc ? [authorsLine(doc), doc.year, doc.kind, doc.license].filter(Boolean).join(' · ') : 'Opening…'}</p></div>
      {doc && <a className="button secondary" href={`/api/community/documents/${encodeURIComponent(documentId)}/file`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Original</a>}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {doc && <div className="reader-toolbar"><span className={s.muted}>Openly licensed · {doc.license || 'starter note'}</span><div className="page-controls"><button className="icon-button" disabled={page <= 1} aria-label={`Previous ${unit}`} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span>{unit} {page} of {total}</span><button className="icon-button" disabled={page >= total} aria-label={`Next ${unit}`} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>}
    <div className="reader-content">
      {!doc && !error ? <p className={s.muted}><LoaderCircle size={16} className="spin" /> Opening the text…</p>
        : <article className="readable-text">{text ? <p>{at >= 0 && excerpt ? <>{text.slice(0, at)}<mark className="matched-text">{excerpt}</mark>{text.slice(at + excerpt.length)}</> : text}</p> : doc ? <p>No readable text for this {unit}.</p> : null}</article>}
    </div>
  </Dialog>;
}
