'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, ListTree, Pause, Play, X } from 'lucide-react';
import type { KeeperActivity, KeeperOperation } from '@/lib/keeper-choreography';
import type { Job, SearchMode } from '@/lib/types';
import { clerkPresentation } from '@/lib/clerk-room';
import ClerkAnimatedScene, { type MotionPreview } from './clerk-animated-scene';
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
  composer: ReactNode;
  options: ReactNode;
  results: ReactNode;
  library: ReactNode;
}

// Stations sit along the drawing; x is a percentage of the drawing's width.
const STATIONS: { id: Station; x: number; job: SearchMode; name: string }[] = [
  { id: 'desks', x: 14, job: 'search', name: 'the desks' },
  { id: 'counter', x: 54, job: 'ask', name: 'the counter' },
  { id: 'window', x: 87, job: 'discover', name: 'the window' },
];
const JOB_LINES: Record<SearchMode, string> = { discover: 'Send the spider onto the web', search: 'Check the desks for something you saved', ask: 'Ask the book, answered from your library' };
const IMPORT_STATIONS = ['queued', 'processing', 'searchable'] as const;

export function stationFor(operation: KeeperOperation | SearchMode): Station {
  return operation === 'discover' ? 'window' : operation === 'ask' ? 'counter' : 'desks';
}
// Tags hang on their objects in drawing coordinates; a phone frame is narrower, so a few hang a little differently there.
const at = (l: number, t: number, tilt = -2, phone?: [number, number]) => ({ '--l': `${l}%`, '--t': `${t}%`, '--tilt': `${tilt}deg`, ...(phone ? { '--lm': `${phone[0]}%`, '--tm': `${phone[1]}%` } : {}) }) as CSSProperties;

export default function Shop(props: ShopProps) {
  const [station, setStation] = useState<Station>('counter');
  const [drawer, setDrawer] = useState(false);
  const [plain, setPlain] = useState(false);
  const [preview, setPreview] = useState<MotionPreview | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const frames = useRef<Partial<Record<Station, HTMLDivElement | null>>>({});
  const settle = useRef(0);
  const presentation = clerkPresentation(props.activity);
  const resultsStation = stationFor(props.activity.operation);
  const activeJob = props.job && !['completed', 'ready', 'failed', 'cancelled'].includes(props.job.status) ? props.job : null;
  const importStage = props.job ? (['completed', 'ready'].includes(props.job.status) ? 'searchable' : props.job.status === 'processing' || props.job.status === 'running' ? 'processing' : props.job.status === 'queued' ? 'queued' : props.job.status) : null;

  const focusSlip = () => document.getElementById('keeper-query')?.focus({ preventScroll: true });
  const goTo = useCallback((next: Station) => {
    setStation(next);
    const frame = frames.current[next];
    if (!frame || !scroller.current || plain) return;
    scroller.current.scrollTo({ left: frame.offsetLeft, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [plain, reducedMotion]);

  useEffect(() => {
    const counter = frames.current.counter;
    if (counter && scroller.current) scroller.current.scrollTo({ left: counter.offsetLeft, behavior: 'instant' });
    // The slip is the first thing to touch on a desk; on a phone, focusing it would raise the keyboard over the room.
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

  // Swiping to a station picks that station's job for the slip. Results stay where they were found.
  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = scroller.current; if (!el) return;
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
    if (!drawer) return;
    const close = (event: KeyboardEvent) => {
      // Reader and edit/import dialogs own Escape while on the modal top layer.
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setDrawer(false); focusSlip(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);

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
  // Tapping a paper's body pulls it forward on touch screens, where there is no hover.
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

  return <div className={styles.shop} data-shop data-station={station} data-pose={presentation.pose} data-request-active={props.activity.active} data-paused={props.paused || reducedMotion} data-reading={props.reading} data-plain={plain} data-drawer={drawer}>
    {/* A pencil never draws a perfectly straight edge: every paper object borrows this filter for its outline. */}
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><filter id="fk-wobble" x="-4%" y="-8%" width="108%" height="116%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="4" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" /></filter></svg>

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
          <div className={styles.art}><ClerkAnimatedScene activity={props.activity} paused={props.paused} reducedMotion={reducedMotion} preview={props.activity.active ? null : preview} /></div>
        </div>

        <button className={styles.tag} style={at(6, 47, 2, [6, 24])} onClick={openDrawer} aria-expanded={drawer} aria-controls="shop-drawer"><span className={styles.tagCard}>The tray<small>add a document</small></span></button>
        <button className={styles.tag} style={at(24, 58, -2, [16, 38])} onClick={() => chooseJob('search')} disabled={props.disabled} aria-pressed={props.mode === 'search'}><span className={styles.tagCard}>The desks<small>search what you saved</small></span></button>
        <button className={styles.tag} style={at(25, 46, 1.5, [12, 30])} onClick={openDrawer} aria-expanded={drawer} aria-controls="shop-drawer"><span className={styles.tagCard}>The drawers<small>{props.loading ? 'opening the library…' : `${props.documentCount} kept · ${props.collectionName}`}</small></span></button>
        <button className={styles.tag} style={at(57, 66, -1.5, [62, 41])} onClick={() => chooseJob('ask')} disabled={props.disabled} aria-pressed={props.mode === 'ask'}><span className={styles.tagCard}>The book<small>ask, answered from your library</small></span></button>
        <button className={styles.tag} style={at(84, 50, 2)} onClick={() => chooseJob('discover')} disabled={props.disabled} aria-pressed={props.mode === 'discover'}><span className={styles.tagCard}>The window<small>send the spider onto the web</small></span></button>

        {STATIONS.map(item => <div key={item.id} className={styles.frame} data-station={item.id} data-current={station === item.id} ref={el => { frames.current[item.id] = el; }} style={{ '--x': item.x } as CSSProperties}>
          {item.id === 'desks' && <aside id="shop-drawer" className={styles.drawer} hidden={!drawer} aria-label="Your collections">
            <div className={styles.drawerHead}><div><h2>The drawers</h2><p>Open a collection to read what is in it, or search within it from the desks.</p></div><button aria-label="Close the drawers" onClick={() => { setDrawer(false); focusSlip(); }}><X size={18} /></button></div>
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
        {foundElsewhere && foundLine ? <button className={styles.announce} onClick={() => goTo(resultsStation)}>{foundLine}<ArrowRight size={13} /></button> : <span>{props.mode === 'discover' ? 'Free full text only; other matches stay in a separate pile.' : props.collectionName === 'All documents' ? 'Searching every drawer.' : `Searching the ${props.collectionName} drawer.`}</span>}
      </div>
    </div>
  </div>;
}
