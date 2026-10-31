'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Ellipsis, FileText, Folder as FolderIcon, FolderPlus, Globe2, HardDrive, Library, Link, LoaderCircle, LogOut, MessageSquareText, Pause, Play, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { Auth, User } from 'firebase/auth';
import { api, setTokenProvider } from '@/lib/api';
import type { Discovery, DiscoveryKind, Document, Folder, Job, SearchMode, SearchResult, Status } from '@/lib/types';
import { Bookseller, LibraryDrawer } from './bookseller';
import SpiderLookout from './spider-lookout';
import type { KeeperActivity, KeeperOperation, KeeperOutcome } from '@/lib/keeper-choreography';
import room from './bookseller-room.module.css';
import RequestGuide from './request-guide';
import { RequestActivity } from './library-scene';
import Dialog from './dialog';
import Reader from './reader';
import DiscoveryResults from './discovery-results';
import Shop from './shop';
import shop from './shop.module.css';
const COLORS = ['sage', 'blue', 'sand', 'rose'];
const PLACEHOLDERS = { discover: 'Find me a book, paper, or article…', search: 'Find an idea in my documents…', ask: 'Ask something of my library…' };
function formatBytes(bytes?: number) { if (!bytes) return ''; return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`; }
function relativeDate(date: string) { const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`; }
function cleanStatus(status: string) { return ['ready', 'searchable', 'completed'].includes(status) ? 'Searchable' : status.replaceAll('_', ' '); }
export default function LibraryApp({ view = 'classic' }: { view?: 'classic' | 'counter' }) {
  const [keeperActivity, setKeeperActivity] = useState<KeeperActivity>({ id: 0, operation: 'search', active: false });
  const [spiderPaused, setSpiderPaused] = useState(false);
  const keeperSequence = useRef(0), keeperJob = useRef<{ jobId: string; requestId: number } | null>(null);
  const beginKeeper = (operation: KeeperOperation, targetId?: string, destinationId?: string) => {
    const id = ++keeperSequence.current;
    setKeeperActivity({ id, operation, active: true, targetId, destinationId, status: operation === 'discover' ? 'Searching public sources and checking available full text.' : operation === 'ask' ? 'Retrieving saved passages and preparing a response with sources.' : operation === 'search' ? 'Comparing your words and their meaning with saved passages.' : 'Receiving your document…' }); return id;
  };
  const finishKeeper = (id: number, outcome: KeeperOutcome, targetId?: string, status?: string) => setKeeperActivity(current => current.id === id ? { ...current, active: false, outcome, status, targetId: targetId || current.targetId } : current);
  const cancelKeeperSearch = () => setKeeperActivity(current => current.active && current.operation !== 'import' ? { ...current, active: false, outcome: 'cancelled', status: undefined } : current);
  const [folders, setFolders] = useState<Folder[]>([]), [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState<Status | null>(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const recoveryInFlight = useRef(false);
  const [folder, setFolder] = useState<string | null>(null), [showAll, setShowAll] = useState(false), [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [mode, setMode] = useState<SearchMode>('discover'), [query, setQuery] = useState(''), [submitted, setSubmitted] = useState('');
  const [discoveryKind, setDiscoveryKind] = useState<DiscoveryKind>('any'), [unavailable, setUnavailable] = useState<Discovery[]>([]), [showUnavailable, setShowUnavailable] = useState(false);
  const [linkCandidate, setLinkCandidate] = useState<Discovery | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null), [discoveries, setDiscoveries] = useState<Discovery[] | null>(null);
  const [answer, setAnswer] = useState(''), [answerMode, setAnswerMode] = useState(''), [discoveryNotice, setDiscoveryNotice] = useState(''), [busy, setBusy] = useState(false), [job, setJob] = useState<Job | null>(null);
  const [toast, setToast] = useState(''), [error, setError] = useState(''), [showHelp, setShowHelp] = useState(false), [showAdd, setShowAdd] = useState(false), [cabinetOpen, setCabinetOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<Folder | 'new' | null>(null), [folderName, setFolderName] = useState(''), [folderColor, setFolderColor] = useState('sage');
  const [linkDialog, setLinkDialog] = useState(false), [linkValue, setLinkValue] = useState(''), [rights, setRights] = useState(false), [saving, setSaving] = useState(false);
  const [reader, setReader] = useState<{ document: Document; match?: SearchResult } | null>(null), [manageDoc, setManageDoc] = useState<Document | null>(null), [docTitle, setDocTitle] = useState(''), [docFolder, setDocFolder] = useState('');
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null), [dragging, setDragging] = useState(false), [user, setUser] = useState<User | null>(null), [authReady, setAuthReady] = useState(false);
  const authRef = useRef<Auth | null>(null), fileRef = useRef<HTMLInputElement>(null), inputRef = useRef<HTMLInputElement>(null), abortRef = useRef<AbortController | null>(null), mounted = useRef(true);
  const notify = useCallback((message: string) => setToast(message), []);
  const refresh = useCallback(async () => {
    try { const library = await api<{ folders: Folder[]; documents: Document[] }>('/library'); if (!mounted.current) return; setFolders(library.folders); setDocuments(library.documents); setLoadError(''); }
    catch (e) { if (mounted.current) setLoadError(e instanceof Error ? e.message : 'Could not open your library.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  const reconnectLibrary = useCallback(async () => {
    if (recoveryInFlight.current) return;
    recoveryInFlight.current = true;
    setReconnecting(true);
    try {
      const state = await api<Status>('/status');
      if (!mounted.current) return;
      setStatus(state);
      if (!state.auth_required || authRef.current?.currentUser) await refresh();
    } catch (e) {
      if (mounted.current) setLoadError(e instanceof Error ? e.message : 'Could not reconnect to your library.');
    } finally {
      recoveryInFlight.current = false;
      if (mounted.current) setReconnecting(false);
    }
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    let unsubscribe: (() => void) | undefined;
    async function initialize() {
      try {
        const config = await fetch('/config').then(r => r.json());
        if (config.firebase?.apiKey && config.firebase?.projectId) {
          const { initializeApp, getApps } = await import('firebase/app');
          const { getAuth, onAuthStateChanged } = await import('firebase/auth');
          const app = getApps()[0] || initializeApp(config.firebase); const auth = getAuth(app); authRef.current = auth;
          setTokenProvider(async () => auth.currentUser?.getIdToken());
          unsubscribe = onAuthStateChanged(auth, async current => { if (!mounted.current) return; setUser(current); setAuthReady(true); if (current) refresh(); });
        } else setAuthReady(true);
        const state = await api<Status>('/status'); if (!mounted.current) return; setStatus(state);
        if (!state.auth_required) await refresh(); else setLoading(false);
      } catch (e) { setLoading(false); setAuthReady(true); setLoadError(e instanceof Error ? e.message : 'The library is starting up.'); }
    }
    initialize();
    const interval = setInterval(() => api<Status>('/status').then(state => { if (mounted.current) setStatus(state); }).catch(() => {}), 15000);
    return () => { mounted.current = false; unsubscribe?.(); clearInterval(interval); abortRef.current?.abort(); };
  }, [refresh]);
  useEffect(() => {
    if (!loadError || !authReady || (authRef.current && !user)) return;
    // A successful status ping alone does not repopulate the drawers. Retry
    // the library read too, without requiring a page reload or losing input.
    const timer = window.setInterval(reconnectLibrary, 5000);
    return () => window.clearInterval(timer);
  }, [loadError, authReady, user, reconnectLibrary]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!job || keeperJob.current?.jobId !== job.id) return;
    const requestId = keeperJob.current.requestId;
    const terminal = ['completed', 'ready', 'failed', 'cancelled'].includes(job.status);
    setKeeperActivity(current => current.id === requestId ? { ...current, active: !terminal, status: terminal && ['completed', 'ready'].includes(job.status) ? 'Your document is saved and searchable.' : terminal && job.status === 'cancelled' ? 'Import cancelled.' : terminal && job.status === 'failed' ? job.error || 'The document could not be processed.' : job.stage, targetId: terminal && job.document_id ? `document:${job.document_id}` : current.targetId, outcome: !terminal ? undefined : job.status === 'failed' ? 'error' : job.status === 'cancelled' ? 'cancelled' : 'success' } : current);
  }, [job]);
  useEffect(() => {
    if (!job || ['completed', 'ready', 'failed', 'cancelled'].includes(job.status)) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const next = await api<Job>(`/jobs/${job.id}`, { signal: controller.signal });
        if (!controller.signal.aborted) setJob(current => current?.id === job.id && !['completed', 'ready', 'failed', 'cancelled'].includes(current.status) ? next : current);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not check the import.'); }
      finally { inFlight = false; }
    }, 1500);
    return () => { controller.abort(); clearInterval(timer); };
  }, [job?.id, job?.status]);
  useEffect(() => {
    if (job && ['completed', 'ready'].includes(job.status)) { refresh(); notify('A new find, safely kept.'); }
    else if (job?.status === 'failed') { setError(job.error || 'This document could not be imported.'); refresh(); }
  }, [job?.id, job?.status, job?.error, refresh, notify]);
  const signIn = async () => {
    if (!authRef.current) { setError('Sign-in has not been configured for this installation.'); return; }
    try { const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth'); await signInWithPopup(authRef.current, new GoogleAuthProvider()); } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in did not complete.'); }
  };
  const clearSearch = () => { abortRef.current?.abort(); setKeeperActivity(current => current.operation === 'import' ? current : { ...current, active: false, outcome: undefined, status: undefined }); setBusy(false); setResults(null); setDiscoveries(null); setUnavailable([]); setShowUnavailable(false); setDiscoveryNotice(''); setAnswer(''); setSubmitted(''); setError(''); };
  const runSearch = async (override?: string, overrideMode?: SearchMode) => {
    const text = (override ?? query).trim(), selectedMode = overrideMode || mode;
    if (!text) { inputRef.current?.focus(); return; }
    if (saving || (job && !['completed', 'ready', 'failed', 'cancelled'].includes(job.status))) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    const keeperId = beginKeeper(selectedMode, undefined, selectedMode === 'discover' ? 'reading-desk' : `collection:${folder || 'all'}`);
    setBusy(true); setError(''); setSubmitted(text); setResults(null); setDiscoveries(null); setUnavailable([]); setShowUnavailable(false); setDiscoveryNotice(''); setAnswer('');
    try {
      if (selectedMode === 'discover') { const value = await api<{ results: Discovery[]; unavailable_results?: Discovery[]; warnings?: string[] }>('/discover', { method: 'POST', body: JSON.stringify({ query: text, kind: discoveryKind }), signal: controller.signal }); if (controller.signal.aborted) return; setDiscoveries(value.results); setUnavailable(value.unavailable_results || []); setDiscoveryNotice(value.warnings?.join(' ') || ''); const found = value.results.find(item => item.access_status === 'verified_full_text'); finishKeeper(keeperId, found ? 'success' : 'empty', found ? `result:${found.id}` : undefined, found ? `${value.results.filter(item => item.access_status === 'verified_full_text').length} full-text sources checked. Choose one to read or keep.` : 'No verified full text found. Try a more specific title or topic.'); }
      else if (selectedMode === 'search') { const value = await api<{ results: SearchResult[] }>('/search', { method: 'POST', body: JSON.stringify({ query: text, folder_id: folder, limit: 8 }), signal: controller.signal }); if (controller.signal.aborted) return; setResults(value.results); finishKeeper(keeperId, value.results.length ? 'success' : 'empty', value.results[0] ? `result:${value.results[0].document.id}` : undefined, value.results.length ? `${value.results.length} matching passages found. Open one at its source.` : undefined); }
      else { const value = await api<{ answer: string; citations: SearchResult[]; mode: string }>('/ask', { method: 'POST', body: JSON.stringify({ query: text, folder_id: folder }), signal: controller.signal }); if (controller.signal.aborted) return; setAnswer(value.answer); setAnswerMode(value.mode); setResults(value.citations); finishKeeper(keeperId, value.citations.length ? 'success' : 'empty', value.citations[0] ? `result:${value.citations[0].document.id}` : undefined, value.citations.length ? value.mode.includes('extract') ? 'Source extracts are ready. These are saved passages, not a generated answer.' : 'Your answer is ready with linked passages. Check the sources for context.' : undefined); }
    } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'The search could not finish.'); finishKeeper(keeperId, 'error'); } }
    finally { if (abortRef.current === controller) setBusy(false); }
  };
  const upload = async (file: File) => {
    if (keeperActivity.active || saving) { notify('Let the current request finish before adding another document.'); return; }
    setSaving(true); setShowAdd(false); setError('');
    const keeperId = beginKeeper('import', undefined, `collection:${folder || 'all'}`);
    try { const data = new FormData(); data.append('file', file); if (folder) data.append('folder_id', folder); const value = await api<{ job_id?: string; document?: Document; id?: string; status?: string }>('/documents/upload', { method: 'POST', body: data }); if (value.job_id) { keeperJob.current = { jobId: value.job_id, requestId: keeperId }; setJob({ id: value.job_id, status: 'queued', stage: 'Reading your document…' }); } else { notify('Document added to your library.'); finishKeeper(keeperId, 'success'); } await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); finishKeeper(keeperId, 'error'); } finally { setSaving(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const importDocument = async (url: string, candidate?: Discovery, rightsConfirmed = false) => {
    if (keeperActivity.active || saving) return;
    setSaving(true); setError('');
    const keeperId = beginKeeper('import', candidate ? `result:${candidate.id}` : undefined, `collection:${folder || 'all'}`);
    try { const value = await api<{ job_id: string }>('/import', { method: 'POST', body: JSON.stringify({ url, title: candidate?.title, folder_id: folder, source_url: candidate?.source_url, license: candidate?.license, rights_confirmed: rightsConfirmed }) }); keeperJob.current = { jobId: value.job_id, requestId: keeperId }; setJob({ id: value.job_id, status: 'queued', stage: 'Following your lead…' }); setLinkDialog(false); setLinkCandidate(null); setLinkValue(''); setRights(false); } catch (e) { setError(e instanceof Error ? e.message : 'Could not import this document.'); finishKeeper(keeperId, 'error'); } finally { setSaving(false); }
  };
  const editFolder = (item: Folder | 'new') => { setFolderDialog(item); setFolderName(item === 'new' ? '' : item.name); setFolderColor(item === 'new' ? 'sage' : item.color); setShowAdd(false); };
  const saveFolder = async () => {
    if (!folderName.trim() || !folderDialog) return; setSaving(true);
    try { await api(folderDialog === 'new' ? '/folders' : `/folders/${folderDialog.id}`, { method: folderDialog === 'new' ? 'POST' : 'PATCH', body: JSON.stringify({ name: folderName.trim(), color: folderColor }) }); setFolderDialog(null); refresh(); notify('A little more organized.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save folder.'); } finally { setSaving(false); }
  };
  useEffect(() => {
    if (!documents.some(doc => !['ready', 'searchable', 'completed', 'failed', 'cancelled'].includes(doc.status))) return;
    const interval = setInterval(refresh, 3000); return () => clearInterval(interval);
  }, [documents, refresh]);
  const selectedFolder = folders.find(f => f.id === folder);
  const visibleDocs = documents.filter(doc => !folder || doc.folder_id === folder).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.created_at.localeCompare(a.created_at));
  const stationCollectionId = keeperActivity.active && keeperActivity.operation !== 'discover' ? keeperActivity.destinationId?.replace(/^collection:/, '') || 'all' : folder || 'all';
  const stationCollectionName = folders.find(item => item.id === stationCollectionId)?.name || 'All documents';
  const stationDocuments = documents.filter(doc => stationCollectionId === 'all' || doc.folder_id === stationCollectionId);
  const hasResults = results !== null || discoveries !== null || busy;
  const importing = !!job && !['completed', 'ready', 'failed', 'cancelled'].includes(job.status);
  const working = busy || importing;
  const signedOut = !!status?.auth_required && !user;
  const docRow = (doc: Document, compact = false) => <div key={doc.id} data-keeper-anchor={`document:${doc.id}`} className={`document-row ${compact ? 'compact' : ''}`}>
    <button className="document-open" onClick={() => { setCabinetOpen(false); setReader({ document: doc }); }}><span className="document-icon"><FileText size={20} strokeWidth={1.5} /></span><span className="document-info"><strong>{doc.title}</strong><small>{doc.is_starter || doc.kind === 'starter' ? 'STARTER NOTE' : (doc.kind || 'PDF').toUpperCase()}<span>·</span>{doc.page_count || '–'} {doc.kind === 'PDF' ? 'pages' : 'sections'}<span>·</span>{relativeDate(doc.created_at)}</small></span></button>
    <span className={`doc-status ${cleanStatus(doc.status) === 'Searchable' ? 'ready' : ''}`} title={cleanStatus(doc.status)}>{cleanStatus(doc.status) === 'Searchable' ? <Sparkles size={13} /> : doc.status === 'failed' ? <CircleHelp size={13} /> : <LoaderCircle size={13} className="spin" />}</span>
    <button className="icon-button doc-menu" aria-label={`Manage ${doc.title}`} onClick={() => { setCabinetOpen(false); setManageDoc(doc); setDocTitle(doc.title); setDocFolder(doc.folder_id || ''); }}><Ellipsis size={18} /></button>
  </div>;
  const requestComposer = <form data-keeper-anchor="composer" className="composer" onSubmit={e => { e.preventDefault(); runSearch(); }}>
          <div className="composer-input-row"><input id="keeper-query" ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={PLACEHOLDERS[mode]} aria-label={PLACEHOLDERS[mode]} maxLength={1000} disabled={signedOut} /><button className="submit-button" type="submit" disabled={loading || !!loadError || busy || saving || signedOut || !!job && !['completed', 'ready', 'failed', 'cancelled'].includes(job.status) || !query.trim()} aria-label={busy ? 'Searching' : 'Send to Keeper'}>{busy ? <LoaderCircle className="spin" size={20} /> : <ArrowUp size={21} />}</button></div>
        </form>;
  const requestOptions = <>{mode === 'discover' && <label className={room.modeSelect}><span className="visually-hidden">Document type</span><select aria-label="Document type" value={discoveryKind} disabled={busy} onChange={e => { setDiscoveryKind(e.target.value as DiscoveryKind); clearSearch(); }}><option value="any">All types</option><option value="book">Books</option><option value="paper">Papers & articles</option></select><ChevronDown size={11} aria-hidden="true" /></label>}
          {folder && mode !== 'discover' && <button className={room.scope} onClick={() => { setFolder(null); clearSearch(); }} aria-label={`Search all documents instead of ${selectedFolder?.name}`}><FolderIcon size={11} /> {selectedFolder?.name}<X size={11} /></button>}</>;
  const resultsPanel = <>{hasResults && <div className={`library-content results-content ${room.results}`} aria-label="Search results">
              <div className="results-caption"><p>{busy ? 'Following a few promising leads…' : `Results for “${submitted}”`}</p><button className="icon-button" aria-label="Clear search results" onClick={clearSearch}><X size={14} /></button></div>
              {busy && <div className="search-loading"><span className="search-pulse"><Search size={22} /></span><h3>{keeperActivity.operation === 'discover' ? 'A little looking around.' : keeperActivity.operation === 'ask' ? 'Connecting the ideas.' : 'Following the meaning.'}</h3><p>{keeperActivity.operation === 'discover' ? 'Following open copies and checking the full text. This may take a little longer.' : keeperActivity.operation === 'ask' ? 'Reading the passages that matter to your question.' : 'Searching passages, not just document titles.'}</p><button className="text-button" onClick={() => { abortRef.current?.abort(); cancelKeeperSearch(); setBusy(false); notify('Search cancelled.'); }}>Cancel search</button></div>}
              {answer && <div className="answer-card" data-keeper-anchor="answer"><div className="answer-text">{answer.split('\n').filter(Boolean).map((line,i) => <p key={i}>{line.split(/(\[\d+\])/g).map((part, j) => { const citation = /^\[(\d+)\]$/.exec(part); const source = citation && results?.[Number(citation[1]) - 1]; return source ? <button key={j} className="inline-citation" aria-label={`Open source ${citation[1]}`} onClick={() => setReader({ document: source.document, match: source })}>{part}</button> : part; })}</p>)}</div><small>{answerMode.includes('extract') ? 'Selected directly from your saved passages.' : 'Written locally, using the sources below. Check the passages for context.'}</small></div>}
              {results?.map((result, i) => <button key={`${result.document.id}-${result.page_number}-${i}`} className="search-result" data-keeper-anchor={`result:${result.document.id}`} onClick={() => setReader({ document: result.document, match: result })}><span className="result-top"><span className="document-icon"><FileText size={18} /></span><span><strong>{answer && <span className="citation-number">[{i + 1}] </span>}{result.document.title}</strong><small>{result.location_label || `Page ${result.page_number}`} · {result.match_type === 'exact title' ? 'Title match' : result.match_type?.includes('keywords') ? 'Words & meaning' : 'Related meaning'}</small></span><ArrowUpRight size={17} /></span><p className="result-excerpt">{result.excerpt}</p><span className="result-footer"><span><Sparkles size={12} /> Found by meaning</span><span>Open passage <ArrowRight size={13} /></span></span></button>)}
              {discoveryNotice && <details className="discovery-notice"><summary>Search notes</summary><p>{discoveryNotice}</p></details>}
              {discoveries && !busy && <DiscoveryResults results={discoveries} unavailable={unavailable} showUnavailable={showUnavailable} onToggle={() => setShowUnavailable(value => !value)} disabled={saving || working} onKeep={item => importDocument(item.import_url!, item)} onPermission={item => { setLinkCandidate(item); setLinkValue(item.import_url || ''); setRights(false); setLinkDialog(true); }} />}
              {!busy && results?.length === 0 && <div className="empty-state"><Search size={26} /><h3>No good match just yet.</h3><p>{keeperActivity.operation === 'discover' ? 'Try a title, an author, or a more specific topic. You can also import a document by link.' : 'Try a different description, or add a document about this topic.'}</p></div>}
        </div>}</>;
  const libraryPanel = <section className={room.shelf} aria-label="Your document library">
        <div className={room.cabinet}>
        <div className={room.shelfTools} data-library-tools="">
          <span className={room.shelfLabel} data-library-label="">THE DRAWERS <span>{loading ? 'Loading…' : signedOut ? 'Sign in to open' : loadError ? 'Reconnecting…' : `${documents.length} kept`}</span></span>
          <div className="add-wrapper">
            <button className={`icon-button ${room.addButton}`} aria-label="Add to your library" disabled={loading || !!loadError || signedOut} onClick={() => setShowAdd(value => !value)} aria-expanded={showAdd}><Plus size={17} /></button>
            {showAdd && <><button className="menu-dismiss" aria-label="Close add menu" onClick={() => setShowAdd(false)} /><div className="dropdown-menu"><button onClick={() => { fileRef.current?.click(); setShowAdd(false); }}><Upload size={16} /> Upload a document</button><button onClick={() => { setLinkCandidate(null); setLinkValue(''); setRights(false); setLinkDialog(true); setShowAdd(false); }}><Link size={16} /> Import from a link</button><button onClick={() => editFolder('new')}><FolderPlus size={16} /> New collection</button></div></>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.epub,.txt,.md,.html,.htm" className="visually-hidden" aria-label="Upload document" onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); }} />
        {signedOut ? <div className="empty-state"><ShieldCheck size={26} /><h3>Your library.</h3><p>Sign in to open your documents.</p><button className="button primary" onClick={signIn}>Continue with Google <ArrowRight size={16} /></button></div> : loading ? <div className="library-skeleton" aria-label="Loading library">{[1,2,3].map(n => <div key={n} className="skeleton-row" />)}</div> : loadError ? <div className="empty-state"><BookOpen size={28} /><h3>Reconnecting to your library.</h3><p>{loadError}</p><p>We’ll retry automatically.</p><button className="button secondary" disabled={reconnecting} onClick={reconnectLibrary}>{reconnecting ? 'Connecting…' : 'Try again now'}</button></div> : <div className="collections-list">
          <LibraryDrawer id="all" open={showAll}>
            <div data-keeper-anchor="collection:all" className={`collection-row ${showAll ? room.selectedFolder : ''}`}><span className={room.folderCavity} data-keeper-cavity aria-hidden="true"><i /><i /><i /></span><span className={room.folderLid} data-keeper-lid aria-hidden="true"><i /></span><button className="collection-open" aria-expanded={showAll} aria-controls="all-documents" onClick={() => { setFolder(null); setShowAll(value => !value); clearSearch(); }}><span className={room.pullHandle} aria-hidden="true" /><span className="collection-icon"><Library size={23} strokeWidth={1.25} /></span><span className="collection-info"><strong>All documents</strong><small>{documents.length} documents · {showAll ? 'Close drawer' : 'Pull open'}</small></span><ChevronRight size={16} className="collection-arrow" /></button></div>
            {showAll && <div id="all-documents" className={room.folderContents} data-folder-contents="" aria-label="All documents"><div className={room.folderContentTools}><span>{visibleDocs.length} documents</span><button className="icon-button" aria-label={`Sort by ${sort === 'recent' ? 'title' : 'most recent'}`} onClick={() => setSort(s => s === 'recent' ? 'title' : 'recent')}><ArrowDownUp size={14} /></button></div>{visibleDocs.length ? visibleDocs.map(doc => docRow(doc)) : <button className={room.emptyFolder} data-empty-folder="" onClick={() => fileRef.current?.click()}><Upload size={15} /> Add your first document</button>}</div>}
          </LibraryDrawer>
          {folders.map((item, index) => <LibraryDrawer key={item.id} id={item.id} open={folder === item.id}>
            <div data-keeper-anchor={`collection:${item.id}`} className={`collection-row color-${COLORS.includes(item.color) ? item.color : COLORS[index % COLORS.length]} ${folder === item.id ? room.selectedFolder : ''}`}>
              <span className={room.folderCavity} data-keeper-cavity aria-hidden="true"><i /><i /><i /></span><span className={room.folderLid} data-keeper-lid aria-hidden="true"><i /></span>
              <button className="collection-open" aria-expanded={folder === item.id} aria-controls={`folder-documents-${item.id}`} onClick={() => { setFolder(folder === item.id ? null : item.id); setShowAll(false); clearSearch(); }}><span className={room.pullHandle} aria-hidden="true" /><span className="collection-icon"><FolderIcon size={24} strokeWidth={1.25} /></span><span className="collection-info"><strong>{item.name}</strong><small>{item.count} {item.count === 1 ? 'document' : 'documents'} · {folder === item.id ? 'Close drawer' : 'Pull open'}</small></span><ChevronRight size={16} className="collection-arrow" /></button>
              <button className="collection-edit" aria-label={`Edit ${item.name}`} onClick={() => editFolder(item)}><Ellipsis size={17} /></button>
            </div>
            {folder === item.id && <div id={`folder-documents-${item.id}`} className={room.folderContents} data-folder-contents="" aria-label={`${item.name} documents`}><div className={room.folderContentTools}><span>{visibleDocs.length} documents</span><button className="icon-button" aria-label={`Sort by ${sort === 'recent' ? 'title' : 'most recent'}`} onClick={() => setSort(s => s === 'recent' ? 'title' : 'recent')}><ArrowDownUp size={14} /></button></div>{visibleDocs.length ? visibleDocs.map(doc => docRow(doc)) : <button className={room.emptyFolder} data-empty-folder="" onClick={() => fileRef.current?.click()}><Upload size={15} /> Add your first document</button>}</div>}
          </LibraryDrawer>)}

        </div>}
        </div>
      </section>;
  return <div className={`app-shell ${view === 'counter' ? shop.shell : room.room} ${dragging ? 'dragging' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) upload(file); }}>
    {view === 'counter' ? <Shop
      activity={keeperActivity} mode={mode}
      // Findings stay at the station that made them; only a new request replaces them.
      onModeChange={next => { if (next !== mode) setMode(next); }}
      paused={spiderPaused} onPause={() => setSpiderPaused(value => !value)} onHelp={() => setShowHelp(true)}
      disabled={busy || saving || importing} collectionName={selectedFolder?.name || 'All documents'}
      documentCount={documents.length} collectionCount={visibleDocs.length} loading={loading} hasResults={hasResults}
      resultCount={busy ? null : discoveries ? discoveries.filter(item => item.access_status === 'verified_full_text').length : results ? results.length : null}
      job={job} reading={!!reader}
      composer={requestComposer} options={requestOptions} results={resultsPanel} library={libraryPanel}
    /> : <main className={room.world} aria-label="Finder Keeper">
      <h1 className="visually-hidden">Your library</h1>
      <section className={room.searchSide} aria-label="Ask your Keeper">

        <div className={room.counter} data-search-counter>
          <span className={room.counterContact} aria-hidden="true" /><div className={room.counterActor}><Bookseller /></div>
          <div className={room.counterInput}>
        <div className={room.jobGuide}><RequestGuide compact mode={mode} onModeChange={next => { if (next === mode) return; setMode(next); clearSearch(); }} disabled={busy || saving || !!job && !['completed', 'ready', 'failed', 'cancelled'].includes(job.status)} onExample={text => { setQuery(text); inputRef.current?.focus(); }} /></div>
          <label className="visually-hidden" htmlFor="keeper-query">What are we looking for?</label>
        {requestComposer}
          </div>
        <div className={room.searchOptions} data-keeper-obstacle>

          {requestOptions}
          <div className={room.quietControls}><button className="icon-button" onClick={() => setSpiderPaused(value => !value)} aria-label={spiderPaused ? 'Resume spider motion' : 'Pause spider motion'} aria-pressed={spiderPaused} title={spiderPaused ? 'Resume spider motion' : 'Pause spider motion'}>{spiderPaused ? <Play size={13} /> : <Pause size={13} />}</button><button className="icon-button" aria-label="About your library" title="About your library" onClick={() => setShowHelp(true)}><CircleHelp size={14} /></button></div>
        </div>
        </div>
        {(keeperActivity.active || keeperActivity.outcome) && <RequestActivity activity={keeperActivity} query={submitted} paused={spiderPaused} />}
        {resultsPanel}
      </section>
      {libraryPanel}
      <aside className={room.companion} aria-label="The spider’s lookout"><SpiderLookout quiet active={keeperActivity.active && keeperActivity.operation === 'discover'} paused={spiderPaused} disabled={loading || !!loadError || keeperActivity.active || saving || signedOut} onExplore={() => { if (!keeperActivity.active) { setMode('discover'); clearSearch(); inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); } }} /></aside>
    </main>}
    {(error || saving || importing) && <div className={`activity-bar ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></> : <><LoaderCircle className="spin" size={16} /><span>{saving ? 'Making room for your document…' : job?.stage}</span>{job && !saving && <button className="text-button" onClick={async () => { try { const next = await api<Job>(`/jobs/${job.id}`, { method: 'DELETE' }); setJob(current => current?.id === next.id ? { ...current, ...next } : current); refresh(); if (next.status === 'cancelled') notify('Import cancelled.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel this import.'); } }}>Cancel</button>}</>}</div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    {dragging && <div className="drop-overlay"><Upload size={40} /><h2>Something worth keeping?</h2><p>Drop your document to add it to the library.</p></div>}
    {reader && <Reader document={reader.document} match={reader.match} onClose={() => setReader(null)} />}
    {cabinetOpen && <Dialog title={stationCollectionName} onClose={() => setCabinetOpen(false)}><p className="dialog-description">{stationDocuments.length} {stationDocuments.length === 1 ? 'document' : 'documents'} in this drawer.</p><div className={room.cabinetDocuments}>{stationDocuments.length ? stationDocuments.map(doc => docRow(doc)) : <button className={room.emptyFolder} data-empty-folder="" onClick={() => { setCabinetOpen(false); fileRef.current?.click(); }}><Upload size={15} /> Add your first document</button>}</div></Dialog>}
    {folderDialog && <Dialog title={folderDialog === 'new' ? 'Make a little room.' : 'Your collection'} onClose={() => setFolderDialog(null)}><p className="dialog-description">A home for ideas that belong together.</p><form onSubmit={e => { e.preventDefault(); saveFolder(); }}><label className="field-label" htmlFor="folder-name">Collection name</label><input id="folder-name" className="field-input" value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={80} placeholder="e.g. Things to think about" autoFocus required /><span className="field-label">A little color</span><div className="color-picker">{COLORS.map(color => <button key={color} type="button" className={`color-choice color-${color} ${folderColor === color ? 'selected' : ''}`} aria-label={color} aria-pressed={folderColor === color} onClick={() => setFolderColor(color)}>{folderColor === color && <Check size={17} />}</button>)}</div><div className="dialog-actions">{folderDialog !== 'new' && <button type="button" className="text-button danger" onClick={async () => { try { await api(`/folders/${folderDialog.id}`, { method: 'DELETE' }); if (folder === folderDialog.id) setFolder(null); setFolderDialog(null); refresh(); notify('Collection removed. Your documents are still in All documents.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove collection.'); } }}>Remove collection</button>}<button className="button primary" disabled={saving || !folderName.trim()}>{saving ? 'Saving…' : 'Save collection'}<ArrowRight size={15} /></button></div></form></Dialog>}
    {linkDialog && <Dialog title="Follow a good link." onClose={() => setLinkDialog(false)}><p className="dialog-description">Keep a PDF, EPUB, or readable web document in your library. We'll check the content before saving it.</p><form onSubmit={e => { e.preventDefault(); importDocument(linkValue, linkCandidate || undefined, rights); }}><label className="field-label" htmlFor="document-url">Document URL</label><input id="document-url" className="field-input" type="url" value={linkValue} onChange={e => { setLinkValue(e.target.value); setLinkCandidate(null); setRights(false); }} placeholder="https://…" autoFocus required /><label className="checkbox-label"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} required /><span>I have permission to store this document, or it is available under a suitable open license.</span></label><div className="dialog-actions"><button className="button primary" disabled={saving || !rights || !linkValue}>{saving ? 'Following the link…' : 'Keep this document'}<ArrowRight size={15} /></button></div></form></Dialog>}
    {manageDoc && <Dialog title="A place for this one." onClose={() => setManageDoc(null)}><label className="field-label" htmlFor="document-title">Document title</label><input id="document-title" className="field-input" value={docTitle} onChange={e => setDocTitle(e.target.value)} /><label className="field-label" htmlFor="document-folder">Collection</label><select id="document-folder" className="field-input" value={docFolder} onChange={e => setDocFolder(e.target.value)}><option value="">Unfiled</option>{folders.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="document-detail-meta"><span>{manageDoc.page_count} {manageDoc.kind === 'PDF' ? 'pages' : 'sections'}</span><span>{formatBytes(manageDoc.file_size)}</span><span>{cleanStatus(manageDoc.status)}</span></div>{manageDoc.error && <p className="inline-error">{manageDoc.error}</p>}{['failed', 'cancelled'].includes(manageDoc.status) && <button className="text-button" disabled={keeperActivity.active || saving} onClick={async () => { if (keeperActivity.active || saving) return; setSaving(true); const keeperId = beginKeeper('import', undefined, `collection:${manageDoc.folder_id || 'all'}`); try { const value = await api<{ job_id: string }>(`/documents/${manageDoc.id}/retry`, { method: 'POST' }); keeperJob.current = { jobId: value.job_id, requestId: keeperId }; setJob({ id: value.job_id, status: 'queued', stage: 'Reading your document again…' }); setManageDoc(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not retry processing.'); finishKeeper(keeperId, 'error'); } finally { setSaving(false); } }}>Try processing again</button>}<div className="dialog-actions"><button className="text-button danger" onClick={() => { setDeleteDoc(manageDoc); setManageDoc(null); }}><Trash2 size={14} /> Delete</button><button className="button primary" disabled={!docTitle.trim()} onClick={async () => { try { await api(`/documents/${manageDoc.id}`, { method: 'PATCH', body: JSON.stringify({ title: docTitle, folder_id: docFolder || null }) }); setManageDoc(null); refresh(); notify('Just where it belongs.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); } }}>Save changes<Check size={15} /></button></div></Dialog>}
    {deleteDoc && <Dialog title="Let this one go?" onClose={() => setDeleteDoc(null)}><p className="dialog-description">“{deleteDoc.title}” will be removed from your library, including its file and search index.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setDeleteDoc(null)}>Keep it</button><button className="button danger-button" onClick={async () => { try { await api(`/documents/${deleteDoc.id}`, { method: 'DELETE' }); setDeleteDoc(null); refresh(); clearSearch(); notify('Document removed.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete document.'); } }}>Delete document</button></div></Dialog>}
    {showHelp && <Dialog title="For the things worth finding." onClose={() => setShowHelp(false)}><p className="dialog-description">Finder Keeper is your personal research room. A place to collect good documents, rediscover ideas, and follow your curiosity.</p><p className="dialog-description">{view === 'counter' ? 'The shop is wider than your window: the desks are to the left, the counter in the middle, the window to the right. Write on your slip and point the Keeper at a station by its tag, or walk there with the arrows at the edges (or a swipe). He sends his spider out of the window to find free full text online; he checks the desks for what you saved; he answers from the book with sources. What he finds appears at the station that found it, as papers you can pull forward. The drawers are your real collections. Pause stops the motion, never the request; Plain list lays everything out as a column.' : 'The shopkeeper keeps his seat at the counter while you browse. The drawers are your actual document collections. Choose a document to read it, or search within the open collection. The spider’s lost-and-found window takes you to online discovery; it follows the sill while a search runs. You can pause the spider’s motion while requests continue.'}</p><div className="help-steps"><div><Globe2 size={21} /><span><strong>Find something out there.</strong><p>Find free full text in PDF, EPUB, or web form. We check copies before showing them here; other catalog matches stay tucked away.</p></span></div><div><Library size={21} /><span><strong>Give it a home.</strong><p>Upload PDFs, EPUBs, text, or articles. Organize them into collections. Your files stay private.</p></span></div><div><Sparkles size={21} /><span><strong>Find it by what it means.</strong><p>Each passage gets a real semantic embedding. Describe an idea to find the document and page where it lives.</p></span></div></div><div className="local-info"><HardDrive size={18} /><span><strong>{status?.auth_required ? 'A private cloud library' : 'Running on your computer'}</strong><small>{status?.auth_required ? 'Your documents are tied to your account.' : 'Files, search embeddings, and answers stay local. Online discovery contacts public document sources.'}</small></span></div><p className="help-footnote">The included starter notes are original example documents, clearly labeled in the library. Answers should always be checked against their linked passages.</p>{user && <button className="text-button" onClick={async () => { clearSearch(); setReader(null); setManageDoc(null); setQuery(''); const { signOut } = await import('firebase/auth'); if (authRef.current) await signOut(authRef.current); setFolders([]); setDocuments([]); setShowHelp(false); }}><LogOut size={14} /> Sign out</button>}</Dialog>}
  </div>;
}
