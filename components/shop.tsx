'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, ListTree, Pause, Play, X } from 'lucide-react';
import type { KeeperActivity, KeeperOperation } from '@/lib/keeper-choreography';
import type { Document, Folder, Job, SearchMode } from '@/lib/types';
import { clerkPresentation } from '@/lib/clerk-room';
import ClerkAnimatedScene, { type MotionPreview } from './clerk-animated-scene';
import { RoomBack, RoomFront, RoomMid } from './herbarium-room';
import styles from './shop.module.css';

export type Station = 'desks' | 'counter' | 'window';

interface ShopProps {
  activity: KeeperActivity;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  paused: boolean;
  onPause: () => void;
  onHelp: () => void;
  disabled: boolean;
  collectionName: string;
  collectionCount: number;
  documentCount: number;
  loading: boolean;
  hasResults: boolean;
  resultCount: number | null;
  job: Job | null;
  reading: boolean;
  folders: Folder[];
  documents: Document[];
  selectedFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  onOpenDocument: (doc: Document) => void;
  composer: ReactNode;
  options: ReactNode;
  results: ReactNode;
  library: ReactNode;
}

// Stations sit along the painting; x is a percentage of the painting's width.
const STATIONS: { id: Station; x: number; job: SearchMode; name: string }[] = [
  { id: 'desks', x: 15, job: 'search', name: 'the desks' },
  { id: 'counter', x: 54, job: 'ask', name: 'the counter' },
  { id: 'window', x: 88, job: 'discover', name: 'the window' },
];
const JOB_LINES: Record<SearchMode, string> = { discover: 'Send the spider onto the web', search: 'Untie a folio at the desks', ask: 'Open the register, answered from your library' };
const IMPORT_STATIONS = ['queued', 'mounting', 'searchable'] as const;

export function stationFor(operation: KeeperOperation | SearchMode): Station {
  return operation === 'discover' ? 'window' : operation === 'ask' ? 'counter' : 'desks';
}
// Labels hang on their objects in painting coordinates; a phone frame is narrower, so a few hang a little differently there.
const at = (l: number, t: number, tilt = -1.5, phone?: [number, number]) => ({ '--l': `${l}%`, '--t': `${t}%`, '--tilt': `${tilt}deg`, ...(phone ? { '--lm': `${phone[0]}%`, '--tm': `${phone[1]}%` } : {}) }) as CSSProperties;
const kindOf = (doc: Document) => doc.is_starter || doc.kind === 'starter' ? 'starter note' : (doc.kind || 'document').toLowerCase();

export default function Shop(props: ShopProps) {
  const [station, setStation] = useState<Station>('counter');
  const [drawer, setDrawer] = useState(false);
  const [plain, setPlain] = useState(false);
  const [openFolio, setOpenFolio] = useState<string | null>(null);
  const [preview, setPreview] = useState<MotionPreview | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const frames = useRef<Partial<Record<Station, HTMLDivElement | null>>>({});
  const settle = useRef(0);
  const raf = useRef(0);
  const presentation = clerkPresentation(props.activity);
  const resultsStation = stationFor(props.activity.operation);
  const activeJob = props.job && !['completed', 'ready', 'failed', 'cancelled'].includes(props.job.status) ? props.job : null;
  const importStage = props.job ? (['completed', 'ready'].includes(props.job.status) ? 'searchable' : props.job.status === 'processing' || props.job.status === 'running' ? 'mounting' : props.job.status === 'queued' ? 'queued' : props.job.status) : null;

  const focusSlip = () => document.getElementById('keeper-query')?.focus({ preventScroll: true });
  const goTo = useCallback((next: Station) => {
    setStation(next);
    const frame = frames.current[next];
    if (!frame || !scroller.current || plain) return;
    scroller.current.scrollTo({ left: frame.offsetLeft, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [plain, reducedMotion]);

  useEffect(() => {
    const counter = frames.current.counter;
    if (counter && scroller.current) { scroller.current.scrollTo({ left: counter.offsetLeft, behavior: 'instant' }); scroller.current.style.setProperty('--sx', `${counter.offsetLeft}px`); }
    // The label is the first thing to touch on a desk; on a phone, focusing it would raise the keyboard over the room.
    if (window.matchMedia('(min-width: 761px)').matches) focusSlip();
    try { setPlain(localStorage.getItem('finder-keeper:plain-list') === 'true'); } catch { /* Private storage can be unavailable. */ }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // The camera follows the request to the station doing the work.
  useEffect(() => {
    if (props.activity.active) { setPreview(null); goTo(stationFor(props.activity.operation)); }
  }, [props.activity.id, props.activity.active]);

  // Parallax rides the scroll position; swiping to a station picks that station's job. Findings stay where they were found.
  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => el.style.setProperty('--sx', `${el.scrollLeft}px`));
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      let nearest: Station = station, distance = Infinity;
      for (const item of STATIONS) {
        const frame = frames.current[item.id]; if (!frame) continue;
        const d = Math.abs(frame.offsetLeft - el.scrollLeft);
        if (d < distance) { distance = d; nearest = item.id; }
      }
      if (nearest !== station) { setStation(nearest); if (!props.disabled && !props.activity.active) props.onModeChange(STATIONS.find(s => s.id === nearest)!.job); }
    }, 120);
  };

  useEffect(() => {
    if (!drawer && !openFolio) return;
    const close = (event: KeyboardEvent) => {
      // Reader and edit/import dialogs own Escape while on the modal top layer.
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setDrawer(false); setOpenFolio(null); focusSlip(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer, openFolio]);

  const chooseJob = (next: SearchMode) => {
    if (props.disabled) return;
    props.onModeChange(next);
    goTo(stationFor(next));
    setDrawer(false);
    focusSlip();
  };
  const togglePlain = () => {
    const next = !plain; setPlain(next);
    try { localStorage.setItem('finder-keeper:plain-list', String(next)); } catch { /* Private storage can be unavailable. */ }
  };
  const openDrawer = () => { setDrawer(value => !value); goTo('desks'); };
  const rehearse = () => {
    if (preview) { setPreview(null); return; }
    setPreview({ operation: props.mode, run: Date.now() }); goTo(stationFor(props.mode));
  };
  // Tapping a sheet's body pulls it forward on touch screens, where there is no hover.
  const pullPaper = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, select, summary')) return;
    const paper = target.closest('.discovery-card') as HTMLElement | null;
    if (!paper) return;
    const pulled = paper.getAttribute('data-pulled') === 'true';
    paper.parentElement?.querySelectorAll('[data-pulled]').forEach(el => el.removeAttribute('data-pulled'));
    if (!pulled) paper.setAttribute('data-pulled', 'true');
  };

  const stationIndex = STATIONS.findIndex(s => s.id === station);
  const previous = STATIONS[stationIndex - 1], next = STATIONS[stationIndex + 1];
  const foundElsewhere = props.hasResults && !props.activity.active && resultsStation !== station && !plain;
  const foundLine = props.resultCount === null ? null : props.resultCount === 0 ? `Nothing found at ${STATIONS.find(s => s.id === resultsStation)!.name}` : `${props.resultCount} found at ${STATIONS.find(s => s.id === resultsStation)!.name}`;

  // The folios on the desks are your real collections; the first is everything you keep.
  const folios: { id: string | null; name: string; count: number; docs: Document[] }[] = [
    { id: null, name: 'Everything kept', count: props.documents.length, docs: props.documents },
    ...props.folders.map(f => ({ id: f.id, name: f.name, count: f.count, docs: props.documents.filter(d => d.folder_id === f.id) })),
  ];
  const shown = folios.slice(0, 6), more = folios.length - shown.length;

  return <div className={styles.shop} data-shop data-station={station} data-pose={presentation.pose} data-request-active={props.activity.active} data-paused={props.paused || reducedMotion} data-reading={props.reading} data-plain={plain} data-drawer={drawer}>
    <a className={styles.sign} href="/" aria-label="Finder & Keeper, a quiet research library">finder &amp; keeper<small>a quiet research library</small></a>
    <div className={styles.tools} role="group" aria-label="Shop controls">
      <button onClick={rehearse} disabled={props.activity.active || reducedMotion} aria-pressed={!!preview}><Play size={12} /><span>{preview ? 'Stop rehearsal' : 'Rehearse'}</span></button>
      <button onClick={props.onPause} aria-pressed={props.paused} aria-label={props.paused ? 'Resume motion' : 'Pause motion'}>{props.paused ? <Play size={12} /> : <Pause size={12} />}<span>{props.paused ? 'Resume' : 'Pause'}</span></button>
      <button onClick={togglePlain} aria-pressed={plain} aria-label={plain ? 'Back to the shop' : 'Plain list'}><ListTree size={13} /><span>{plain ? 'The shop' : 'Plain list'}</span></button>
      <button onClick={props.onHelp} aria-label="How this shop works"><CircleHelp size={14} /><span>Help</span></button>
    </div>

    <div className={styles.strip} ref={scroller} onScroll={onScroll} aria-label="The shop, from across the counter">
      <div className={styles.stage}>
        <div className={styles.artClip} aria-hidden={plain}>
          <div className={styles.art}>
            <div className={`${styles.layer} ${styles.layerBack}`}><RoomBack /></div>
            <div className={`${styles.layer} ${styles.layerMid}`}><RoomMid /></div>
            <div className={`${styles.layer} ${styles.layerKeeper}`}><ClerkAnimatedScene activity={props.activity} paused={props.paused} reducedMotion={reducedMotion} preview={props.activity.active ? null : preview} room={false} /></div>
            <div className={`${styles.layer} ${styles.layerFront}`}><RoomFront /></div>
          </div>
        </div>

        {/* The folios on the desks: lean in (hover, focus, or tap) and a folio fans its sheets. */}
        <div className={styles.folios} role="group" aria-label="Your collections, as folios on the desks">
          {shown.map((folio, index) => <div key={folio.id ?? 'all'} className={styles.folio} data-open={openFolio === (folio.id ?? 'all')} data-selected={props.selectedFolder === folio.id} style={{ '--i': index } as CSSProperties}>
            <button className={styles.folioCover} onClick={() => { setOpenFolio(value => value === (folio.id ?? 'all') ? null : (folio.id ?? 'all')); props.onSelectFolder(folio.id); }} aria-expanded={openFolio === (folio.id ?? 'all')} aria-label={`${folio.name}, ${folio.count} ${folio.count === 1 ? 'sheet' : 'sheets'}; lean in to see them`}>
              <span className={styles.folioName}>{folio.name}</span><span className={styles.folioCount}>{props.loading ? '…' : folio.count} {folio.count === 1 ? 'sheet' : 'sheets'}</span><span className={styles.tie} aria-hidden="true" />
            </button>
            <div className={styles.fan} aria-label={`Sheets in ${folio.name}`}>
              {folio.docs.slice(0, 5).map((doc, i) => <button key={doc.id} className={styles.fanSheet} style={{ '--n': i } as CSSProperties} onClick={() => props.onOpenDocument(doc)}><span>{doc.title}</span><small>{kindOf(doc)} · {doc.page_count || '–'} {doc.kind === 'PDF' ? 'pages' : 'sections'}</small></button>)}
              {folio.docs.length > 5 && <button className={`${styles.fanSheet} ${styles.fanMore}`} style={{ '--n': 5 } as CSSProperties} onClick={openDrawer}><span>{folio.docs.length - 5} more in the drawers</span></button>}
              {folio.docs.length === 0 && <span className={`${styles.fanSheet} ${styles.fanMore}`} style={{ '--n': 0 } as CSSProperties}><span>Nothing mounted yet</span></span>}
            </div>
          </div>)}
          {more > 0 && <button className={styles.folioMore} onClick={openDrawer}>{more} more {more === 1 ? 'folio' : 'folios'} in the drawers</button>}
        </div>

        <button className={styles.tag} style={at(6, 32, 1.5, [8, 20])} onClick={openDrawer} aria-expanded={drawer} aria-controls="shop-drawer"><span className={styles.tagCard}>The tray<small>add a document</small></span></button>
        <button className={styles.tag} style={at(19, 32, -1.5, [22, 20])} onClick={() => chooseJob('search')} disabled={props.disabled} aria-pressed={props.mode === 'search'}><span className={styles.tagCard}>The desks<small>untie a folio, search what you keep</small></span></button>
        <button className={styles.tag} style={at(60, 69, -1.5, [62, 44])} onClick={() => chooseJob('ask')} disabled={props.disabled} aria-pressed={props.mode === 'ask'}><span className={styles.tagCard}>The register<small>ask, answered from your library</small></span></button>
        <button className={styles.tag} style={at(85, 56, 1.5)} onClick={() => chooseJob('discover')} disabled={props.disabled} aria-pressed={props.mode === 'discover'}><span className={styles.tagCard}>The window<small>send the spider onto the web</small></span></button>

        {STATIONS.map(item => <div key={item.id} className={styles.frame} data-station={item.id} data-current={station === item.id} ref={el => { frames.current[item.id] = el; }} style={{ '--x': item.x } as CSSProperties}>
          {item.id === 'desks' && <aside id="shop-drawer" className={styles.drawer} hidden={!drawer} aria-label="Your collections">
            <div className={styles.drawerHead}><div><h2>The drawers</h2><p>Add a document, make a folio, or tidy what is kept.</p></div><button aria-label="Close the drawers" onClick={() => { setDrawer(false); focusSlip(); }}><X size={18} /></button></div>
            {props.library}
          </aside>}
          {props.hasResults && resultsStation === item.id && <section className={styles.papers} aria-label="Keeper’s findings" onClick={pullPaper}>{props.results}</section>}
        </div>)}
      </div>
    </div>

    {previous && <button className={`${styles.edge} ${styles.edgeLeft}`} onClick={() => goTo(previous.id)} aria-label={`Walk to ${previous.name}`} hidden={plain}><ArrowLeft size={15} />{previous.name}</button>}
    {next && <button className={`${styles.edge} ${styles.edgeRight}`} onClick={() => goTo(next.id)} aria-label={`Walk to ${next.name}`} hidden={plain}>{next.name}<ArrowRight size={15} /></button>}

    <div className={styles.note} role="status">
      <strong><span className={styles.liveDot} aria-hidden="true" />{preview && !props.activity.active ? 'A rehearsal, nothing is being searched.' : presentation.label}</strong>
      <p>{props.paused && !props.activity.active ? 'Motion is paused. Requests still run.' : props.activity.status || presentation.detail}</p>
      {(activeJob || importStage === 'failed' || importStage === 'cancelled') && <div className={styles.stations} aria-label="Import progress">
        {IMPORT_STATIONS.map((stage, index) => <span key={stage} data-current={importStage === stage} data-done={importStage !== null && IMPORT_STATIONS.indexOf(importStage as typeof IMPORT_STATIONS[number]) > index}>{stage}</span>)}
        {(importStage === 'failed' || importStage === 'cancelled') && <span data-current="true">{importStage}</span>}
      </div>}
    </div>

    <div className={styles.slip} data-job={props.mode}>
      <div className={styles.slipHead}><span>{JOB_LINES[props.mode]}</span><div className={styles.slipOptions}>{props.options}</div></div>
      {props.composer}
      <div className={styles.slipFoot}>
        {foundElsewhere && foundLine ? <button className={styles.announce} onClick={() => goTo(resultsStation)}>{foundLine}<ArrowRight size={13} /></button> : <span>{props.mode === 'discover' ? 'Free full text only; other matches stay in a separate pile.' : props.collectionName === 'All documents' ? 'Every folio on the desks.' : `The ${props.collectionName} folio only.`}</span>}
      </div>
    </div>
  </div>;
}
