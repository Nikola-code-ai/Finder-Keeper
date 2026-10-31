'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, LoaderCircle, Quote, X } from 'lucide-react';
import { api, authHeaders, downloadDocument } from '@/lib/api';
import type { Document, SearchResult } from '@/lib/types';
import Dialog from './dialog';
export default function Reader({ document: initial, match, onClose }: { document: Document; match?: SearchResult; onClose: () => void }) {
  const [doc, setDoc] = useState(initial), [page, setPage] = useState(match?.page_number || 1), [error, setError] = useState(initial.error || ''), [rendering, setRendering] = useState(true);
  const [textOnly, setTextOnly] = useState(initial.kind !== 'PDF');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<import('pdfjs-dist').PDFDocumentLoadingTask | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const textMatchRef = useRef<HTMLElement>(null);
  const [pdfReady, setPdfReady] = useState(false);
  useEffect(() => {
    if (['ready', 'failed', 'cancelled'].includes(doc.status)) return;
    let disposed = false;
    let attempts = 0;
    const timer = setInterval(async () => {
      if (++attempts > 120) { clearInterval(timer); return; }
      try {
        const value = await api<Document>(`/documents/${initial.id}`);
        if (disposed) return;
        setDoc(value);
        if (value.error) setError(value.error);
      } catch { /* The user can continue reading the original while the service reconnects. */ }
    }, 2500);
    return () => { disposed = true; clearInterval(timer); };
  }, [initial.id, doc.status]);
  useEffect(() => {
    let cancelled = false;
    api<Document>(`/documents/${initial.id}`).then(value => { if (!cancelled) { setDoc(value); if (value.error) setError(value.error); } }).catch(e => setError(e.message));
    async function load() {
      if (initial.kind !== 'PDF') { setTextOnly(true); setRendering(false); return; }
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const response = await fetch(`/api/documents/${initial.id}/file`, { headers: await authHeaders() });
        if (!response.ok) throw new Error('Could not load the original file.');
        const type = response.headers.get('content-type') || '';
        if (!type.includes('pdf')) { if (!cancelled) { setTextOnly(true); setRendering(false); } return; }
        const loadingTask = pdfjs.getDocument({ data: await response.arrayBuffer() }); loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) { loadingTask.destroy(); return; }
        pdfRef.current = pdf; setPdfReady(true);
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : 'Preview unavailable.'); setRendering(false); setTextOnly(true); } }
    }
    load();
    return () => { cancelled = true; loadingTaskRef.current?.destroy(); pdfRef.current = null; };
  }, [initial.id]);
  useEffect(() => {
    if (!pdfReady || textOnly || !canvasRef.current || !pdfRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | undefined;
    setRendering(true);
    (async () => {
      const pdfPage = await pdfRef.current!.getPage(page);
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const viewport = pdfPage.getViewport({ scale: 1.35 });
      canvas.width = viewport.width; canvas.height = viewport.height;
      const render = pdfPage.render({ canvas, viewport }); task = render;
      await render.promise;
      if (cancelled) return;
      const layer = layerRef.current;
      if (layer) {
        layer.replaceChildren(); layer.style.width = `${viewport.width}px`; layer.style.height = `${viewport.height}px`;
        if (match && match.page_number === page) {
          const pdfjs = await import('pdfjs-dist');
          const content = await pdfPage.getTextContent();
          const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
          const excerpt = normalize(match.excerpt);
          for (const item of content.items) {
            if (!('str' in item) || item.str.trim().length < 5) continue;
            const line = normalize(item.str);
            if (!excerpt.includes(line) && !line.includes(excerpt.slice(0, 45))) continue;
            const transform = pdfjs.Util.transform(viewport.transform, item.transform);
            const height = Math.hypot(transform[2], transform[3]);
            const mark = window.document.createElement('span'); mark.className = 'pdf-highlight';
            Object.assign(mark.style, { left: `${transform[4]}px`, top: `${transform[5] - height}px`, width: `${item.width * viewport.scale}px`, height: `${height * 1.2}px` });
            layer.appendChild(mark);
          }
        }
      }
      setRendering(false);
    })().catch(e => { if (!cancelled && e?.name !== 'RenderingCancelledException') { setError('The PDF preview could not be rendered. Extracted text is still available.'); setTextOnly(true); setRendering(false); } });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdfReady, page, match, textOnly]);
  const sourceUrl = (() => { try { const url = new URL(doc.source_url || ''); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } })();
  const pages = doc.pages || [];
  const currentText = pages.find(value => value.page_number === page)?.text || '';
  const pageCount = pdfRef.current?.numPages || doc.page_count || 1;
  const activeMatch = match && match.page_number === page ? match : undefined;
  const sourceOffset = activeMatch?.start_char === undefined ? -1 : Array.from(currentText).slice(0, activeMatch.start_char).join('').length;
  const matchStart = activeMatch ? (sourceOffset >= 0 && currentText.slice(sourceOffset, sourceOffset + activeMatch.excerpt.length) === activeMatch.excerpt ? sourceOffset : currentText.indexOf(activeMatch.excerpt)) : -1;
  useEffect(() => {
    if (textOnly && matchStart >= 0) textMatchRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [textOnly, page, currentText, matchStart]);
  return <Dialog title="A closer look" wide onClose={onClose}>
    <div className="reader-meta"><div><h3>{doc.title}</h3><p>{doc.authors?.join(', ') || 'Your library'}{doc.year ? ` · ${doc.year}` : ''} · {doc.kind || 'Document'} · {doc.license || 'Private library'}</p></div><button className="button secondary" onClick={() => downloadDocument(doc.id, doc.title).catch(e => setError(e.message))}><Download size={15} /> Download</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="reader-toolbar"><div className="view-toggle"><button className={!textOnly ? 'active' : ''} onClick={() => setTextOnly(false)} disabled={!pdfReady}>Original</button><button className={textOnly ? 'active' : ''} onClick={() => setTextOnly(true)}>Readable text</button></div><div className="page-controls"><button className="icon-button" disabled={page <= 1} aria-label={doc.kind === 'PDF' ? 'Previous page' : 'Previous section'} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span>{doc.kind === 'PDF' ? 'Page' : 'Section'} {page} of {pageCount}</span><button className="icon-button" disabled={page >= pageCount} aria-label={doc.kind === 'PDF' ? 'Next page' : 'Next section'} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>
    {doc.kind !== 'PDF' && pages.length > 1 && <label className="section-jump">Jump to section<select aria-label="Jump to section" value={page} onChange={e => setPage(Number(e.target.value))}>{pages.map(section => <option key={section.page_number} value={section.page_number}>{section.page_number}. {section.text.split('\n')[0].slice(0, 85)}</option>)}</select></label>}
    {match && <div className="matched-passage"><Quote size={18} /><div><strong>The passage you were looking for · {match.location_label || `${doc.kind === 'PDF' ? 'page' : 'section'} ${match.page_number}`}</strong><p>{match.excerpt}</p>{page !== match.page_number && <button className="text-button" onClick={() => setPage(match.page_number)}>Go to matching {doc.kind === 'PDF' ? 'page' : 'section'}</button>}</div></div>}
    <div className="reader-content">{textOnly ? <article className="readable-text">{currentText ? <p>{activeMatch && matchStart >= 0 ? <>{currentText.slice(0, matchStart)}<mark ref={textMatchRef} className="matched-text">{activeMatch.excerpt}</mark>{currentText.slice(matchStart + activeMatch.excerpt.length)}</> : currentText}</p> : <p>{doc.status === 'failed' ? 'This document could not be indexed. You can still download the original.' : 'Extracted text is being prepared.'}</p>}</article> : <div className="pdf-container">{rendering && <div className="pdf-loading"><LoaderCircle className="spin" size={24} /><span>Opening your document…</span></div>}<div className="pdf-page"><canvas ref={canvasRef} /><div className="pdf-highlight-layer" ref={layerRef} /></div></div>}</div>
    {sourceUrl && <a className="source-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">View original source <ExternalLink size={13} /></a>}
  </Dialog>;
}
