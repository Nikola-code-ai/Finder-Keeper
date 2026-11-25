'use client';

// The Stitch "Archival Scholar" design, as designed: Library home, Passages, Synthesize and the Collections catalogue.
// Additions: faint line doodles in the margins (Finder the spider, cobwebs, books caught in webs), and the two
// characters as clickable guides in the corner: Finder explains gathering, Keeper explains storing and search.
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { ArrowRight, ArrowUp, BookOpen, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Ellipsis, FolderPlus, Globe2, Link as LinkIcon, LoaderCircle, Pencil, Plus, Quote, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { KeeperActivity } from '@/lib/keeper-choreography';
import type { Discovery, DiscoveryKind, Document, Folder, Job, ReaderProfile, SearchMode, SearchResult, SharedCollection, Status } from '@/lib/types';
import DiscoveryResults from './discovery-results';
import Guides from './guides';
import FlowsView from './flows-view';
import CommunityView from './community-view';
import { BookInWeb, BookStack, Dangler, SpiderGlyph, WebCorner } from './spider-bits';
import { Bookcase, Dust, HangingLamp, LoosePages } from './library-doodles';
import styles from './workspace.module.css';

export interface WorkspaceProps {
  activity: KeeperActivity; paused: boolean; onPause: () => void; onHelp: () => void;
  status: Status | null; signedOut: boolean; loading: boolean; loadError: string; reconnecting: boolean; onReconnect: () => void; onSignIn: () => void; signInLabel?: string; userName?: string | null;
  profile: ReaderProfile | null; onProfile: (profile: ReaderProfile) => void; onPublishFolder: (folder: Folder, published: boolean) => void; onRefresh: () => void; notify: (message: string) => void; onError: (message: string) => void;
  folders: Folder[]; documents: Document[]; shared: SharedCollection[]; folder: string | null; onFolder: (id: string | null) => void;
  mode: SearchMode; onMode: (mode: SearchMode) => void; query: string; onQuery: (value: string) => void; onSubmit: (text?: string, mode?: SearchMode) => void; inputRef: RefObject<HTMLInputElement | null>;
  busy: boolean; locked: boolean; job: Job | null;
  discoveryKind: DiscoveryKind; onDiscoveryKind: (kind: DiscoveryKind) => void;
  submitted: string; results: SearchResult[] | null; answer: string; answerMode: string;
  discoveries: Discovery[] | null; unavailable: Discovery[]; showUnavailable: boolean; onToggleUnavailable: () => void; discoveryNotice: string;
  onCancelSearch: () => void; onClear: () => void;
  onOpen: (doc: Document, match?: SearchResult) => void; onManage: (doc: Document) => void;
  onEditFolder: (folder: Folder | 'new') => void; onShare: (folder: Folder) => void;
  onUpload: () => void; onImportLink: () => void; onKeep: (item: Discovery) => void; onPermission: (item: Discovery) => void;
  onCopy: (text: string) => void;
}

type View = 'library' | 'passages' | 'synthesize' | 'collections' | 'flows' | 'community';
// On a phone the six sections share a 58px bar, so each has a short name too.
const NAV: { id: View; label: string; short: string }[] = [{ id: 'library', label: 'Library', short: 'Library' }, { id: 'passages', label: 'Passages', short: 'Passages' }, { id: 'synthesize', label: 'Synthesize', short: 'Ask' }, { id: 'collections', label: 'Collections', short: 'Catalog' }, { id: 'flows', label: 'Flows', short: 'Flows' }, { id: 'community', label: 'Community', short: 'Commons' }];
const VIEWS = new Set<string>(NAV.map(n => n.id));
const MODES: { id: SearchMode; label: string; icon: typeof Globe2; placeholder: string; hint: string }[] = [
  { id: 'search', label: 'Recall Passages', icon: Quote, placeholder: 'Search passages, ideas, or titles across your archive…', hint: 'Passage search by words and meaning' },
  { id: 'ask', label: 'Synthesize', icon: Sparkles, placeholder: 'Ask a question of your archive…', hint: 'Answers grounded in your own documents' },
  { id: 'discover', label: 'Find Online', icon: Globe2, placeholder: 'A title, an author, or a topic to find on the web…', hint: 'Free full text from public sources' },
];
const KINDS: { id: DiscoveryKind; label: string }[] = [{ id: 'any', label: 'Any kind' }, { id: 'book', label: 'Books' }, { id: 'paper', label: 'Papers & articles' }];
const TYPES = [{ id: 'all', label: 'All' }, { id: 'books', label: 'Books' }, { id: 'papers', label: 'Papers' }, { id: 'notes', label: 'Notes' }] as const;
type TypeFilter = typeof TYPES[number]['id'];
const PAGE = 10;

const isReady = (doc: Document) => ['ready', 'searchable', 'completed'].includes(doc.status);
const isFailed = (doc: Document) => ['failed', 'cancelled'].includes(doc.status);
function format(doc: Document): { label: string; tone: 'pdf' | 'epub' | 'web' | 'note'; long: string } {
  const kind = (doc.kind || '').toLowerCase();
  if (doc.is_starter || kind === 'starter') return { label: 'NOTE', tone: 'note', long: 'Starter note' };
  if (kind === 'pdf') return { label: 'PDF', tone: 'pdf', long: 'PDF' };
  if (kind === 'epub') return { label: 'EPUB', tone: 'epub', long: 'Book (EPUB)' };
  if (['html', 'htm', 'web', 'article', 'url'].includes(kind)) return { label: 'WEB', tone: 'web', long: 'Web article' };
  if (kind === 'md' || kind === 'markdown') return { label: 'NOTE', tone: 'note', long: 'Markdown notes' };
  return { label: 'TEXT', tone: 'note', long: 'Text' };
}
const typeOf = (doc: Document): TypeFilter => { const t = format(doc).tone; return t === 'epub' ? 'books' : t === 'pdf' ? 'papers' : 'notes'; };
const unit = (doc: Document) => doc.kind === 'PDF' ? 'p.' : 'sec.';
const byline = (doc: Document) => doc.authors?.length ? doc.authors.slice(0, 2).join(', ') + (doc.authors.length > 2 ? ' et al.' : '') : doc.is_starter ? 'Starter note' : 'Your library';

const STOP = new Set(['each', 'other', 'down', 'about', 'what', 'when', 'where', 'which', 'with', 'that', 'this', 'there', 'their', 'they', 'them', 'from', 'into', 'have', 'does', 'were', 'will', 'would', 'could', 'should', 'some', 'more', 'most', 'than', 'then', 'also', 'just', 'like', 'over', 'under', 'very', 'your', 'mine', 'part', 'thing', 'things']);
function Lit({ text, query }: { text: string; query: string }) {
  const words = useMemo(() => [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])].filter(w => !STOP.has(w)).slice(0, 8), [query]);
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
  return <>{text.split(pattern).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part)}</>;
}
const paragraphs = (text: string) => text.split(/\n{2,}|\n(?=[A-Z0-9“"])/).map(t => t.trim()).filter(Boolean);

function stateLine(activity: KeeperActivity, ready: boolean | undefined): { text: string; tone: 'idle' | 'busy' | 'done' | 'warn' } {
  if (activity.active) return { text: activity.status || 'Working…', tone: 'busy' };
  if (activity.outcome === 'success') return { text: activity.status || 'Findings ready.', tone: 'done' };
  if (activity.outcome === 'empty') return { text: activity.status || 'No match. Try other words.', tone: 'warn' };
  if (activity.outcome === 'error') return { text: activity.status || 'The request failed. Your library is unchanged.', tone: 'warn' };
  if (activity.outcome === 'cancelled') return { text: 'Stopped.', tone: 'idle' };
  return { text: ready === false ? 'Semantic index warming up' : 'Semantic index ready', tone: ready === false ? 'busy' : 'done' };
}

/** The Passages screen's reading pane: the page around a recalled passage, with the passage set apart. */
function PassageViewer({ match, folderName, onOpenReader, onCopy }: { match: SearchResult; folderName?: string; onOpenReader: () => void; onCopy: (text: string) => void }) {
  const [doc, setDoc] = useState<Document | null>(null), [page, setPage] = useState(match.page_number), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; setDoc(null); setError(''); setPage(match.page_number);
    api<Document>(`/documents/${match.document.id}`).then(value => { if (!cancelled) setDoc(value); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open this document.'); });
    return () => { cancelled = true; };
  }, [match.document.id, match.page_number, match.excerpt]);
  const d = doc || match.document;
  const pages = doc?.pages || [];
  const total = pages.length || d.page_count || 1;
  const text = pages.find(p => p.page_number === page)?.text || '';
  const at = page === match.page_number && text ? text.indexOf(match.excerpt) : -1;
  const citeLine = `${byline(d)}${d.year ? ` (${d.year})` : ''}`;
  const matched = <figure className={styles.matched}>
    <figcaption><i aria-hidden="true" />Matched passage</figcaption>
    <blockquote>“{match.excerpt}”</blockquote>
    <div className={styles.matchedFoot}><span>{citeLine}</span><span><button className={styles.ghostSmall} onClick={() => onCopy(`“${match.excerpt}” ${citeLine}, ${match.location_label || `${unit(d)} ${match.page_number}`}`)}><Copy size={13} /> Copy quote</button><button className={styles.amberSmall} onClick={onOpenReader}><BookOpen size={13} /> Open in reader</button></span></div>
  </figure>;
  return <article className={styles.viewer} aria-label={`Reading ${d.title}`}>
    <header className={styles.viewerHead}>
      <div><h2>{d.title}</h2><p>{[byline(d), d.year, format(d).long, folderName].filter(Boolean).join(' · ')}</p></div>
      <div className={styles.viewerTools}>
        <div className={styles.toggle} role="group" aria-label="View"><button aria-pressed="true">Text</button><button aria-pressed="false" onClick={onOpenReader}>Original</button></div>
        <div className={styles.pager}><button aria-label={`Previous ${unit(d) === 'p.' ? 'page' : 'section'}`} disabled={page <= 1} onClick={() => setPage(n => n - 1)}><ChevronLeft size={15} /></button><span>{page} <i>/</i> {total}</span><button aria-label={`Next ${unit(d) === 'p.' ? 'page' : 'section'}`} disabled={page >= total} onClick={() => setPage(n => n + 1)}><ChevronRight size={15} /></button></div>
      </div>
    </header>
    <div className={styles.viewerBody}>
      <div className={styles.viewerLabel}><span>{page === match.page_number && match.location_label ? match.location_label : d.title}</span><span>{unit(d)} {page}</span></div>
      {error && <p className={styles.inlineNote}>{error}</p>}
      {!doc && !error ? <div className={styles.viewerLoading}><LoaderCircle size={18} className="spin" /> Opening the page…</div>
        : at >= 0 ? <>{paragraphs(text.slice(0, at)).map((t, i) => <p key={`b${i}`}>{t}</p>)}{matched}{paragraphs(text.slice(at + match.excerpt.length)).map((t, i) => <p key={`a${i}`}>{t}</p>)}</>
        : page === match.page_number ? <>{matched}{paragraphs(text).map((t, i) => <p key={i}>{t}</p>)}</>
        : text ? paragraphs(text).map((t, i) => <p key={i}>{t}</p>) : <p className={styles.inlineNote}>No extracted text for this {unit(d) === 'p.' ? 'page' : 'section'}. Open the original to read it.</p>}
    </div>
  </article>;
}

export default function Workspace(p: WorkspaceProps) {
  const [view, setView] = useState<View>('library');
  const [active, setActive] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const blocked = p.loading || !!p.loadError || p.signedOut;
  const modeInfo = MODES.find(m => m.id === p.mode)!;
  const state = stateLine(p.activity, p.status?.embedding_ready);
  const top = p.folders.filter(f => !f.parent_id);
  const folderName = (id?: string | null) => p.folders.find(f => f.id === id)?.name;
  const selected = p.folders.find(f => f.id === p.folder);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); p.inputRef.current?.focus(); p.inputRef.current?.select(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [p.inputRef]);
  useEffect(() => { setActive(0); }, [p.results]);
  useEffect(() => { setPage(1); }, [type, sort, filter, p.folder]);
  // A link from the commons may open a screen directly: /?view=flows, /?view=community.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('view');
    if (wanted && VIEWS.has(wanted)) setView(wanted as View);
  }, []);

  // Each screen owns one job: Passages recalls, Synthesize asks, the Library home finds online too.
  const go = (next: View) => {
    setView(next); setAddOpen(false);
    if (next === 'passages' && p.mode !== 'search') p.onMode('search');
    if (next === 'synthesize' && p.mode !== 'ask') p.onMode('ask');
    window.scrollTo({ top: 0 });
  };
  const submit = (text?: string, mode: SearchMode = p.mode) => {
    if (mode === 'search') setView('passages'); else if (mode === 'ask') setView('synthesize'); else setView('library');
    if (text !== undefined) p.onQuery(text);
    p.onSubmit(text, mode);
    window.scrollTo({ top: 0 });
  };

  const searchBar = (variant: 'hero' | 'bar') => <form className={styles.search} data-variant={variant} data-busy={p.busy} onSubmit={e => { e.preventDefault(); submit(); }}>
    <label className="visually-hidden" htmlFor="keeper-query">{modeInfo.placeholder}</label>
    {p.mode === 'ask' ? <Sparkles size={19} className={styles.searchIcon} aria-hidden="true" /> : <Search size={19} className={styles.searchIcon} aria-hidden="true" />}
    <input id="keeper-query" ref={p.inputRef} value={p.query} onChange={e => p.onQuery(e.target.value)} placeholder={modeInfo.placeholder} maxLength={1000} disabled={p.signedOut} autoComplete="off" onKeyDown={e => { if (e.key === 'Escape' && !p.busy && (p.results || p.discoveries)) p.onClear(); }} />
    {variant === 'bar' && p.results && !p.busy && p.mode === 'search' && <span className={styles.count}>{p.results.length} {p.results.length === 1 ? 'passage' : 'passages'} recalled</span>}
    {variant === 'hero' && <kbd aria-hidden="true">⌘K</kbd>}
    {variant === 'bar' && (p.results || p.answer) && !p.busy ? <button type="button" className={styles.clear} aria-label="Clear" onClick={() => { p.onClear(); p.onQuery(''); p.inputRef.current?.focus(); }}><X size={17} /></button> : null}
    <button className={styles.send} type="submit" disabled={blocked || p.busy || p.locked || !p.query.trim()} aria-label={p.busy ? 'Working' : 'Search'}>{p.busy ? <LoaderCircle size={18} className="spin" /> : <ArrowUp size={18} />}</button>
    {p.busy && <span className={styles.searchThread} aria-hidden="true" />}
  </form>;

  const working = (what: string, detail: string) => <div className={styles.working} role="status">
    <Dangler className={styles.descend} drop={60} size={20} />
    <h3>{what}</h3><p>{detail}</p>
    <button className={styles.ghost} onClick={p.onCancelSearch}>Stop</button>
  </div>;

  const gate = p.signedOut ? <div className={styles.empty}><ShieldCheck size={22} /><h3>Sign in to open your library.</h3><p>Your archive is tied to your account.</p><div className={styles.emptyActions}><button className={styles.primary} onClick={p.onSignIn}>{p.signInLabel || 'Sign in'} <ArrowRight size={15} /></button><a className={styles.ghost} href="/sign-in">About signing in</a></div></div>
    : p.loadError ? <div className={styles.empty}><BookOpen size={22} /><h3>Reconnecting to your library.</h3><p>{p.loadError}</p><div className={styles.emptyActions}><button className={styles.ghost} disabled={p.reconnecting} onClick={p.onReconnect}>{p.reconnecting ? 'Connecting…' : 'Try again now'}</button></div></div>
    : p.loading ? <div className={styles.skeleton} aria-label="Loading your library">{[0, 1, 2, 3, 4].map(n => <span key={n} />)}</div> : null;

  const row = (doc: Document) => {
    const f = format(doc), s = isReady(doc) ? 'ready' : isFailed(doc) ? 'failed' : 'indexing';
    return <li key={doc.id} className={styles.shelfRow}>
      <button className={styles.shelfOpen} onClick={() => p.onOpen(doc)}>
        <span className={styles.badge} data-tone={f.tone}>{f.label}</span>
        <span className={styles.shelfTitle}><strong>{doc.title}</strong><small>{byline(doc)}{doc.year ? ` • ${doc.year}` : ''}</small></span>
        <span className={styles.meta}>{folderName(doc.folder_id) || 'Unfiled'}</span>
        <span className={styles.meta}>{doc.page_count || '–'} {doc.kind === 'PDF' ? 'pages' : 'sections'}</span>
        <span className={styles.state} data-state={s}>{s === 'ready' ? 'Ready' : s === 'failed' ? 'Failed' : 'Indexing'}</span>
      </button>
      <button className={styles.rowMenu} aria-label={`Manage ${doc.title}`} onClick={() => p.onManage(doc)}><Ellipsis size={16} /></button>
    </li>;
  };

  const recent = [...p.documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).filter(d => !p.folder || d.folder_id === p.folder);
  const libraryView = <>
    <section className={styles.hero}>
      <h1>What are we looking for?</h1>
      <p>Find documents, recall passages across them, and synthesize answers from your own research.</p>
      <div className={styles.modes} role="tablist" aria-label="Search mode">
        {MODES.map(m => { const Icon = m.icon; return <button key={m.id} role="tab" aria-selected={p.mode === m.id} disabled={p.busy} onClick={() => p.onMode(m.id)}><Icon size={15} aria-hidden="true" />{m.label}</button>; })}
      </div>
      {searchBar('hero')}
      <div className={styles.hint}><span>{modeInfo.hint}{p.mode !== 'discover' && selected ? ` · ${selected.name} only` : ''}</span><span className={styles.stateLine} data-tone={state.tone} role="status">{state.text}</span></div>
      <div className={styles.chips} role="group" aria-label={p.mode === 'discover' ? 'Kind of document' : 'Where to look'}>
        {p.mode === 'discover' ? KINDS.map(k => <button key={k.id} aria-pressed={p.discoveryKind === k.id} disabled={p.busy} onClick={() => p.onDiscoveryKind(k.id)}>{k.label}</button>)
          : <><button aria-pressed={!p.folder} onClick={() => p.onFolder(null)} disabled={blocked}>All Sources</button>{top.slice(0, 5).map(f => <button key={f.id} aria-pressed={p.folder === f.id} onClick={() => p.onFolder(p.folder === f.id ? null : f.id)}>{f.name}</button>)}</>}
      </div>
    </section>
    <hr className={styles.rule} />
    {gate || (p.mode === 'discover' && (p.busy || p.discoveries) ? <section className={styles.section} aria-label="Found online">
      <div className={styles.sectionHead}><h2>{p.busy ? 'Searching public sources' : 'Found online'} {!p.busy && <small>(for “{p.submitted}”)</small>}</h2><button className={styles.link} onClick={p.onClear}>Back to the shelf <ArrowRight size={14} /></button></div>
      {p.busy ? working('Checking public sources.', 'Each copy is checked for real full text, so this can take a little longer.') : <div className={styles.discoveries}>
        {p.discoveryNotice && <details className={styles.notice}><summary>Notes from the search</summary><p>{p.discoveryNotice}</p></details>}
        <DiscoveryResults results={p.discoveries || []} unavailable={p.unavailable} showUnavailable={p.showUnavailable} onToggle={p.onToggleUnavailable} disabled={p.locked} onKeep={p.onKeep} onPermission={p.onPermission} />
      </div>}
    </section> : <section className={styles.section} aria-labelledby="shelf-title">
      <div className={styles.sectionHead}><h2 id="shelf-title">Archival Shelf <small>({Math.min(8, recent.length)} recently added{selected ? ` · ${selected.name}` : ''})</small></h2><button className={styles.link} onClick={() => go('collections')}>View Catalog <ArrowRight size={14} /></button></div>
      {recent.length ? <ul className={styles.shelfList}>{recent.slice(0, 8).map(row)}</ul> : <div className={styles.empty}>
        <WebCorner corner="top-left" size={60} className={styles.emptyWeb} /><SpiderGlyph size={22} eyes={false} />
        <h3>{selected ? 'This collection is empty.' : 'Nothing on the shelf yet.'}</h3><p>Upload a PDF, EPUB or text file, or find a free copy online.</p>
        <div className={styles.emptyActions}><button className={styles.primary} onClick={p.onUpload}><Upload size={15} /> Upload a document</button><button className={styles.ghost} onClick={() => p.onMode('discover')}><Globe2 size={15} /> Find online</button></div>
      </div>}
    </section>)}
  </>;

  const results = p.results || [];
  const current = results[Math.min(active, results.length - 1)];
  const passagesView = <>
    <div className={styles.queryBar}>{searchBar('bar')}</div>
    {gate || (p.busy && p.mode === 'search' ? working('Searching your documents.', 'Matching your words and their meaning, not only titles.')
      : !p.answer && results.length ? <div className={styles.split}>
        <aside className={styles.recalled} aria-label="Recalled passages">
          <div className={styles.paneHead}><h2>Recalled passages</h2><span>Semantic rank</span></div>
          <ol>{results.map((r, i) => <li key={`${r.document.id}-${r.page_number}-${i}`}><button className={styles.recall} aria-current={i === active ? 'true' : undefined} onClick={() => setActive(i)}>
            <span className={styles.recallTop}><strong>{byline(r.document)}</strong><small>{r.location_label || `${unit(r.document)} ${r.page_number}`}</small></span>
            <span className={styles.recallDoc}>{r.document.title}</span>
            <q><Lit text={r.excerpt} query={p.submitted} /></q>
            <span className={styles.recallFoot}><span>{i === active ? <><i aria-hidden="true" />Active in reader</> : (r.match_type === 'exact title' ? 'Title match' : r.match_type?.includes('keywords') ? 'Words & meaning' : 'Related meaning')}</span><span>{folderName(r.document.folder_id) || ''}</span></span>
          </button></li>)}</ol>
        </aside>
        {current && <PassageViewer match={current} folderName={folderName(current.document.folder_id)} onOpenReader={() => p.onOpen(current.document, current)} onCopy={p.onCopy} />}
      </div>
      : p.results && !p.busy && !p.answer ? <div className={styles.empty}><WebCorner corner="top-left" size={60} className={styles.emptyWeb} /><SpiderGlyph size={22} eyes={false} /><h3>No passages matched.</h3><p>Try the words you remember, a different description, or look online.</p><div className={styles.emptyActions}><button className={styles.ghost} disabled={p.locked} onClick={() => submit(p.submitted, 'discover')}><Globe2 size={15} /> Look online instead</button></div></div>
      : <div className={styles.empty}><Quote size={22} /><h3>Recall a passage.</h3><p>Describe what you half-remember. Passages come back ranked by meaning, with the page they live on.</p></div>)}
  </>;

  const synthesizeView = <>
    {gate || (p.busy && p.mode === 'ask' ? <><div className={styles.queryBar}>{searchBar('bar')}</div>{working('Reading the passages that matter.', 'Gathering evidence before writing an answer.')}</>
      : p.answer ? <>
        <div className={styles.question}>
          <Sparkles size={19} aria-hidden="true" /><p>{p.submitted}</p>
          <button className={styles.editQuestion} aria-label="Edit the question" onClick={() => { p.onQuery(p.submitted); p.onClear(); setTimeout(() => p.inputRef.current?.focus(), 0); }}><Pencil size={15} /></button>
          <div className={styles.questionFoot}><span><i aria-hidden="true" />{results.length ? `Grounded in ${[...new Set(results.map(r => r.document.title))].slice(0, 2).join(' and ')}${new Set(results.map(r => r.document.id)).size > 2 ? ' and others' : ''}` : 'No passages to ground it'}</span><span>{results.length} source {results.length === 1 ? 'passage' : 'passages'}</span></div>
        </div>
        <div className={styles.synthesis}>
          <div className={styles.answer}>
            {p.answer.split('\n').filter(Boolean).map((para, i) => <section key={i}><span className={styles.num}>{String(i + 1).padStart(2, '0')}</span><p>{para.split(/(\[\d+\])/g).map((part, j) => { const cite = /^\[(\d+)\]$/.exec(part); const source = cite && results[Number(cite[1]) - 1]; return source ? <button key={j} className={styles.cite} aria-label={`Open source ${cite[1]}: ${source.document.title}`} onClick={() => p.onOpen(source.document, source)}>{part}</button> : part; })}</p></section>)}
            <div className={styles.answerFoot}><span><button className={styles.textButton} onClick={() => p.onCopy(p.answer)}><Copy size={14} /> Copy</button></span><small>{p.answerMode.includes('extract') ? 'Source extracts, selected verbatim' : 'Finder & Keeper synthesis · check each citation'}</small></div>
          </div>
          <aside className={styles.grounding} aria-label="Grounding passages">
            <div className={styles.paneHead}><h2>Grounding Passages</h2><span>Verbatim sources</span></div>
            {results.map((r, i) => <article key={`${r.document.id}-${r.page_number}-${i}`} className={styles.source}>
              <div className={styles.sourceTop}><b>[{i + 1}] {byline(r.document)}{r.document.year ? ` • ${r.document.year}` : ''}</b><small>{r.location_label || `${unit(r.document)} ${r.page_number}`}</small></div>
              <q>{r.excerpt}</q>
              <div className={styles.sourceFoot}><span>{r.document.title}</span><button onClick={() => p.onOpen(r.document, r)}>Open in Reader <ArrowRight size={13} /></button></div>
            </article>)}
            {!results.length && <p className={styles.inlineNote}>Nothing in your library answers this yet.</p>}
          </aside>
        </div>
      </> : <><div className={styles.queryBar}>{searchBar('bar')}</div><div className={styles.empty}><Sparkles size={22} /><h3>Ask your archive.</h3><p>Answers are written from passages you have kept, and every claim links to its source.</p></div></>)}
  </>;

  const shelf = p.documents.filter(d => (!p.folder || d.folder_id === p.folder) && (type === 'all' || typeOf(d) === type) && (!filter || d.title.toLowerCase().includes(filter.toLowerCase()) || byline(d).toLowerCase().includes(filter.toLowerCase())))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.created_at.localeCompare(a.created_at));
  const pages = Math.max(1, Math.ceil(shelf.length / PAGE)), pageNow = Math.min(page, pages);
  const collectionsView = <>
    <div className={styles.catalogHead}>
      <h1>{selected ? selected.name : 'Library'} <small>{p.loading ? '…' : `${shelf.length} ${shelf.length === 1 ? 'source' : 'sources'}`}</small></h1>
      <label className={styles.filter}><Search size={15} aria-hidden="true" /><span className="visually-hidden">Filter by title or author</span><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter the catalog…" />{filter && <button aria-label="Clear filter" onClick={() => setFilter('')}><X size={14} /></button>}</label>
    </div>
    <div className={styles.collectionStrip} role="group" aria-label="Collections">
      <button aria-pressed={!p.folder} onClick={() => p.onFolder(null)}>All collections <small>{p.documents.length}</small></button>
      {p.folders.map(f => <button key={f.id} aria-pressed={p.folder === f.id} onClick={() => p.onFolder(p.folder === f.id ? null : f.id)}>{f.parent_id ? <span aria-hidden="true">›</span> : null}{f.name} <small>{f.count}</small></button>)}
      <button className={styles.newCollection} onClick={() => p.onEditFolder('new')} disabled={blocked}><FolderPlus size={14} /> New collection</button>
    </div>
    {selected && <div className={styles.collectionTools}><button className={styles.textButton} onClick={() => p.onEditFolder(selected)}><Pencil size={13} /> Edit collection</button>{!selected.parent_id && <button className={styles.textButton} onClick={() => p.onShare(selected)}><LinkIcon size={13} /> Lend to a friend</button>}{!selected.parent_id && <button className={styles.textButton} onClick={() => p.onPublishFolder(selected, !selected.published)}><Globe2 size={13} /> {selected.published ? 'Close the open shelf' : 'Open to the commons'}</button>}{selected.published && <a className={styles.textButton} href={`/shelves/${selected.id}`}>See the open shelf <ArrowRight size={13} /></a>}</div>}
    {p.shared.length > 0 && !p.folder && <div className={styles.lent}><span>Lent to you</span>{p.shared.map(s => <button key={s.id} onClick={() => s.documents[0] && p.onOpen(s.documents[0])} title={`Lent by ${s.owner_email}, read-only`}>{s.name} <small>{s.count}</small></button>)}</div>}
    <div className={styles.tabsRow}>
      <div className={styles.tabs} role="group" aria-label="Type">{TYPES.map(t => <button key={t.id} aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}</div>
      <button className={styles.textButton} onClick={() => setSort(s => s === 'recent' ? 'title' : 'recent')}>{sort === 'recent' ? 'Recent' : 'Title A–Z'} <ChevronDown size={14} /></button>
    </div>
    {gate || (shelf.length ? <><ul className={styles.catalog}>{shelf.slice((pageNow - 1) * PAGE, pageNow * PAGE).map(doc => {
      const f = format(doc), s = isReady(doc) ? 'ready' : isFailed(doc) ? 'failed' : 'indexing';
      return <li key={doc.id} className={styles.catalogRow}>
        <button className={styles.catalogOpen} onClick={() => p.onOpen(doc)}>
          <strong>{doc.title}<i data-state={s} aria-label={s === 'ready' ? 'Ready' : s === 'failed' ? 'Failed' : 'Indexing'} />{s === 'indexing' && <em>Indexing</em>}{s === 'failed' && <em data-failed="true">Failed</em>}</strong>
          <span>{byline(doc)}{doc.year ? ` · ${doc.year}` : ''}<b aria-hidden="true">|</b><span className={styles.collectionName} data-unfiled={!folderName(doc.folder_id)}>{folderName(doc.folder_id) || 'Unfiled'}</span><b aria-hidden="true">|</b><code>{f.long}</code></span>
        </button>
        <button className={styles.rowMenu} aria-label={`Manage ${doc.title}`} onClick={() => p.onManage(doc)}><Ellipsis size={16} /></button>
      </li>;
    })}</ul>
      <div className={styles.pagination}><span>Displaying {shelf.slice((pageNow - 1) * PAGE, pageNow * PAGE).length} of {shelf.length} items</span><span><button disabled={pageNow <= 1} onClick={() => setPage(n => n - 1)}>Previous</button><i aria-hidden="true">·</i><button disabled={pageNow >= pages} onClick={() => setPage(n => n + 1)}>Next page</button></span></div>
    </> : <div className={styles.empty}><WebCorner corner="top-left" size={60} className={styles.emptyWeb} /><SpiderGlyph size={22} eyes={false} /><h3>{filter || type !== 'all' ? 'Nothing matches that filter.' : 'Nothing here yet.'}</h3><p>{filter || type !== 'all' ? 'Try another title or type.' : 'Add a document to start the catalog.'}</p><div className={styles.emptyActions}>{filter || type !== 'all' ? <button className={styles.ghost} onClick={() => { setFilter(''); setType('all'); }}>Clear filters</button> : <button className={styles.primary} onClick={p.onUpload}><Upload size={15} /> Upload a document</button>}</div></div>)}
  </>;

  return <div className={styles.workspace} data-workspace="" data-view={view}>
    <div className={styles.aura} aria-hidden="true" />
    {/* Background doodles: the old bookshop's spider, its cobwebs, and the books that got caught in them. */}
    <div className={styles.doodles} aria-hidden="true">
      <Bookcase className={styles.dCaseLeft} seed={7} />
      <Bookcase className={styles.dCaseRight} seed={19} flip />
      <HangingLamp className={styles.dLamp} />
      <LoosePages className={styles.dPages} />
      <Dust className={styles.dDust} />
      <WebCorner corner="top-right" size={190} className={styles.dWebTop} />
      <Dangler className={styles.dDangler} drop={150} size={18} />
      <BookInWeb width={170} className={styles.dBookWeb} />
      <WebCorner corner="bottom-left" size={150} className={styles.dWebBottom} />
      <BookStack width={118} className={styles.dStack} />
      <SpiderGlyph size={14} eyes={false} className={styles.dSpiderSmall} />
    </div>

    <header className={styles.header}>
      <a className={styles.brand} href="/" onClick={e => { e.preventDefault(); go('library'); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={30} height={30} />
        <span>Finder &amp; Keeper</span><i aria-hidden="true">•</i><small>A quiet research library</small>
      </a>
      <nav className={styles.nav} aria-label="Sections">{NAV.map(n => <button key={n.id} aria-current={view === n.id ? 'page' : undefined} aria-label={n.label} onClick={() => go(n.id)}><span className={styles.navLong}>{n.label}</span><span className={styles.navShort} aria-hidden="true">{n.short}</span></button>)}</nav>
      <div className={styles.headerEnd}>
        <span className={styles.sep} aria-hidden="true" />
        <div className={styles.addWrap}>
          <button className={styles.iconButton} disabled={blocked} aria-expanded={addOpen} aria-label="Add to your library" title="Add to your library" onClick={() => setAddOpen(v => !v)}><Plus size={19} /></button>
          {addOpen && <><button className={styles.dismiss} aria-label="Close add menu" onClick={() => setAddOpen(false)} />
            <div className={styles.addMenu} onKeyDown={e => { if (e.key === 'Escape') setAddOpen(false); }}>
              <button onClick={() => { setAddOpen(false); p.onUpload(); }}><Upload size={15} /><span>Upload a file<small>PDF, EPUB, text or HTML · or drop it on the page</small></span></button>
              <button onClick={() => { setAddOpen(false); p.onImportLink(); }}><LinkIcon size={15} /><span>Import from a link<small>checked before it is kept</small></span></button>
              <button onClick={() => { setAddOpen(false); p.onEditFolder('new'); }}><FolderPlus size={15} /><span>New collection<small>group documents that belong together</small></span></button>
            </div></>}
        </div>
        <button className={styles.iconButton} onClick={p.onHelp} aria-label="How the library works" title="How the library works"><CircleHelp size={18} /></button>
        <span className={styles.avatar} title={p.userName || 'Your library'}>{(p.userName || 'K').slice(0, 1).toUpperCase()}</span>
      </div>
    </header>

    <main className={styles.main} id="main" data-view={view}>
      {view === 'library' ? libraryView : view === 'passages' ? passagesView : view === 'synthesize' ? synthesizeView : view === 'collections' ? collectionsView
        : view === 'flows' ? <FlowsView folders={p.folders} documents={p.documents} blocked={blocked} gate={gate} embeddingReady={p.status?.embedding_ready !== false} viewerHandle={p.profile?.handle || null}
          onOpen={p.onOpen} onFind={title => submit(title, 'discover')} onAsk={query => submit(query, 'ask')} onCopy={p.onCopy} notify={p.notify} onError={p.onError} />
        : <CommunityView folders={p.folders} documents={p.documents} blocked={blocked} gate={gate} viewerHandle={p.profile?.handle || null} onRefresh={p.onRefresh} onProfile={p.onProfile} onOpen={doc => p.onOpen(doc)} notify={p.notify} onError={p.onError} />}
    </main>

    <footer className={styles.footer}>
      <span>Finder &amp; Keeper <i aria-hidden="true">•</i> <b data-ready={!!p.status?.embedding_ready} aria-hidden="true" /> {p.status?.auth_required ? 'Private cloud library' : 'Local library active'}</span>
      <span>{p.documents.length} documents <i aria-hidden="true">•</i> {p.folders.length} collections{p.status?.embedding_model ? <> <i aria-hidden="true">•</i> {p.status.embedding_model}</> : null}</span>
    </footer>
    <Guides status={p.status} busy={p.busy || p.activity.active} paused={p.paused} mode={p.mode} />
  </div>;
}
