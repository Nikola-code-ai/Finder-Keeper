'use client';

import { createContext, useContext, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import styles from './shared.module.css';

export type CharacterId = 'bookseller' | 'wanderer' | 'spider' | 'mage' | 'inventor';
export type StudyPhase = 'idle' | 'searching' | 'found';
export interface StudySceneProps {
  paused: boolean;
  phase: StudyPhase;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onRead: () => void;
}
const CharacterContext = createContext<CharacterId>('bookseller');
export function CharacterProvider({ character, children }: { character: CharacterId; children: ReactNode }) {
  useEffect(() => {
    const names = [`${character}-idle`, `${character}-active`, ...(character === 'spider' ? [0, 1, 2, 3].map(frame => `spider-walk-${frame}`) : [])];
    names.forEach(name => { const image = new window.Image(); image.src = `/characters/ui-studies/${name}.webp`; });
  }, [character]);
  return <CharacterContext.Provider value={character}>{children}</CharacterContext.Provider>;
}

/** All new seated drawings are packaged onto one canvas with a calibrated hip
 * anchor. The wrapper represents the support point, never the image bottom. */
export function KeeperPose({ pose = 'sit', height = 260, facing = 'right', className = '', style, paused = false, animated = false }: {
  pose?: 'sit' | 'stand' | 'read' | 'reach' | 'walk' | 'laptop'; height?: number; facing?: 'left' | 'right';
  animated?: boolean; paused?: boolean; className?: string; style?: CSSProperties;
}) {
  const character = useContext(CharacterContext);
  const spider = character === 'spider';
  const [frame, setFrame] = useState(0);
  const walking = spider && pose === 'walk';
  useEffect(() => {
    if (!walking || !animated || paused) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % 4), 125);
    return () => window.clearInterval(timer);
  }, [walking, animated, paused]);
  const active = pose !== 'sit';
  const width = height * .8;
  const x = facing === 'right' ? .36 : .64;
  return <span className={`${styles.actor} ${className}`} style={{ width, height, ...style }} data-character={character} data-pose={pose} data-paused={paused} aria-hidden="true">
    {/* Native images keep the calibrated transparent canvas intact. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={walking ? `/characters/ui-studies/spider-walk-${frame}.webp` : `/characters/ui-studies/${character}-${active ? 'active' : 'idle'}.webp`} alt="" draggable={false} style={{ left: -width * x, top: -height * (spider ? .83 : .68), transform: facing === 'left' ? 'scaleX(-1)' : undefined }} />
  </span>;
}

export function PipPose({ active = false, paused = false, height = 130, className = '', style }: {
  active?: boolean; paused?: boolean; height?: number; className?: string; style?: CSSProperties;
}) {
  const x = active ? .533 : .519, y = active ? .930 : .921;
  return <span className={`${styles.actor} ${className}`} style={{ width: height, height, ...style }} data-pip data-paused={paused} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/characters/pip-cat-${active ? 'search' : 'idle'}.png`} alt="" draggable={false} style={{ left: -height * x, top: -height * y }} />
  </span>;
}

export function SearchSlip({ query, onQueryChange, onSearch, phase, label = 'What would you like to find?' }: Pick<StudySceneProps, 'query' | 'onQueryChange' | 'onSearch' | 'phase'> & { label?: string }) {
  const id = useId();
  return <form className={styles.search} onSubmit={event => { event.preventDefault(); if (query.trim() && phase !== 'searching') onSearch(); }}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.searchLine}><Search size={19} strokeWidth={1.5} aria-hidden="true" /><input id={id} value={query} onChange={event => onQueryChange(event.target.value)} placeholder="A book, a thought, a loose thread…" autoComplete="off" maxLength={200} />
      <button type="submit" aria-label="Try this search interaction" disabled={!query.trim() || phase === 'searching'}><ArrowRight size={20} strokeWidth={1.5} /></button>
    </div>
  </form>;
}

export function SampleResult({ onRead, compact = false }: { onRead: () => void; compact?: boolean }) {
  return <button className={`${styles.result} ${compact ? styles.compact : ''}`} onClick={onRead}>
    <span className={styles.resultIcon}><BookOpen size={24} strokeWidth={1.2} /></span>
    <span><small>A PAGE FROM THE DEMO LIBRARY</small><strong>The small art of noticing</strong>{!compact && <em>Some good things are found in the margins.</em>}</span><ArrowRight size={18} aria-hidden="true" />
  </button>;
}
