// Abandoned-bookshop marginalia for the background: dusty shelves with leaning and fallen books, an unlit lamp
// wrapped in old silk, loose pages on the floor, and dust drifting in the air. Line drawings only, purely ornamental.
import type { CSSProperties } from 'react';

// A small seeded generator so every render draws the same shelves (no hydration mismatch, no jitter between visits).
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

type Book = { x: number; w: number; h: number; tilt: number; bands: number };
function shelfRow(rand: () => number, width: number, maxHeight: number) {
  const books: Book[] = []; let x = 4; let leanNext = false;
  while (x < width - 14) {
    if (rand() < .12 && x > 20) { x += 14 + rand() * 18; leanNext = true; continue; } // a gap where books went missing
    const w = 9 + Math.round(rand() * 9), h = maxHeight * (.62 + rand() * .34);
    const tilt = leanNext ? -(10 + rand() * 12) : rand() < .06 ? 6 : 0;
    books.push({ x, w, h, tilt, bands: Math.floor(rand() * 3) }); x += w + (tilt ? 7 : 1); leanNext = false;
  }
  return books;
}

/** A tall, dusty bookcase seen edge-on at the side of the page. `flip` mirrors it for the right-hand wall. */
export function Bookcase({ className, seed = 7, flip = false, style }: { className?: string; seed?: number; flip?: boolean; style?: CSSProperties }) {
  const rand = seeded(seed), W = 200, shelves = [150, 300, 450, 600];
  return <svg className={className} style={style} width={W + 20} height={640} viewBox={`0 0 ${W + 20} 640`} fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <g transform={flip ? `translate(${W + 20} 0) scale(-1 1)` : undefined} stroke="currentColor">
      {/* The case: sides, crown, and planks that sag a little in the middle */}
      <path d={`M10 640 L10 8 L${W + 10} 8 L${W + 10} 640 M4 8 L${W + 16} 8 M6 2 L${W + 14} 2`} strokeWidth="1.3" />
      {shelves.map(y => <path key={y} d={`M10 ${y} Q${W / 2 + 10} ${y + 3.5} ${W + 10} ${y} M10 ${y + 7} Q${W / 2 + 10} ${y + 10} ${W + 10} ${y + 7}`} strokeWidth="1" />)}
      {shelves.map((y, row) => shelfRow(rand, W - 4, 128).map((b, i) => <g key={`${row}-${i}`} transform={`translate(${14 + b.x} ${y}) rotate(${b.tilt})`}>
        <rect x="0" y={-b.h} width={b.w} height={b.h} rx="1.2" fill="var(--doodle-fill, #0b0e14)" strokeWidth=".9" />
        {Array.from({ length: b.bands }, (_, k) => <path key={k} d={`M1.5 ${-b.h + 10 + k * 7} L${b.w - 1.5} ${-b.h + 10 + k * 7}`} strokeWidth=".6" />)}
        <path d={`M2.5 ${-14} L${b.w - 2.5} ${-14}`} strokeWidth=".5" />
      </g>))}
      {/* A book that fell and lies open on the second shelf, and one lying flat on the top shelf */}
      <path d="M118 296 Q134 284 150 292 Q166 284 182 296 M150 292 L150 298" strokeWidth=".9" />
      <path d="M126 290 Q138 284 148 289 M152 289 Q162 284 174 290" strokeWidth=".5" />
      <rect x="140" y="138" width="54" height="11" rx="1.2" fill="var(--doodle-fill, #0b0e14)" strokeWidth=".9" />
      {/* Old silk in the corners of two compartments */}
      <path d="M11 9 L46 9 M11 9 L11 44 M11 9 L38 32 M11 9 L24 40 M11 9 L42 20 M19 9 Q22 16 11 18 M29 9 Q33 26 11 30 M40 9 Q44 34 11 42" strokeWidth=".55" />
      <path d={`M${W + 9} 301 L${W - 26} 301 M${W + 9} 301 L${W + 9} 336 M${W + 9} 301 L${W - 18} 324 M${W + 9} 301 L${W - 6} 332 M${W - 2} 301 Q${W - 5} 310 ${W + 9} 312 M${W - 13} 301 Q${W - 17} 320 ${W + 9} 324`} strokeWidth=".55" />
    </g>
  </svg>;
}

/** An old pendant lamp, long unlit, with a web strung between the cord and the shade. */
export function HangingLamp({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width={90} height={280} viewBox="0 0 90 280" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <g stroke="currentColor">
      <path d="M45 0 Q47 60 44 120 Q42 160 45 186" strokeWidth="1" />
      <path d="M38 186 L52 186 L52 196 L38 196 Z" fill="var(--doodle-fill, #0b0e14)" strokeWidth="1" />
      <path d="M38 196 Q14 204 8 232 L82 232 Q76 204 52 196" fill="var(--doodle-fill, #0b0e14)" strokeWidth="1.2" />
      <path d="M14 218 Q45 212 76 218" strokeWidth=".6" />
      <path d="M36 232 Q45 252 54 232" strokeWidth=".9" />
      {/* Silk from the cord to the rim, and a broken strand hanging free */}
      <path d="M44 150 L10 230 M44 150 L80 230 M44 150 L30 214 M44 150 L62 214 M24 196 Q34 194 37 182 M66 196 Q56 194 53 182 M17 214 Q32 206 38 200 M73 214 Q58 206 52 200" strokeWidth=".5" />
      <path d="M72 232 Q74 246 70 262" strokeWidth=".5" />
    </g>
  </svg>;
}

/** Loose pages on the floor, one of them curling at the corner. */
export function LoosePages({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width={170} height={70} viewBox="0 0 170 70" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <g stroke="currentColor" fill="var(--doodle-fill, #0b0e14)">
      <path d="M8 52 L62 30 L96 52 L42 70 Z" strokeWidth="1" />
      <path d="M70 46 L118 16 L162 36 L130 62 Q122 58 116 64 Z" strokeWidth="1" />
      <path d="M130 62 Q126 52 118 56 Q120 62 116 64" strokeWidth=".8" />
    </g>
    <g stroke="currentColor" strokeWidth=".55">
      <path d="M26 52 L58 40 M32 56 L64 44 M38 60 L70 48 M44 63 L68 54" />
      <path d="M92 44 L124 26 M98 48 L132 29 M104 51 L138 33 M110 55 L140 38" />
    </g>
  </svg>;
}

// Dust in still air: a fixed set of motes, each drifting slowly on its own clock.
const MOTES = (() => { const rand = seeded(42); return Array.from({ length: 22 }, () => ({ x: rand() * 100, y: rand() * 100, s: 1 + rand() * 2.2, d: 16 + rand() * 22, delay: -rand() * 30, dx: (rand() - .5) * 60 })); })();
export function Dust({ className }: { className?: string }) {
  return <div className={className} aria-hidden="true">
    {MOTES.map((m, i) => <i key={i} style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s, animationDuration: `${m.d}s`, animationDelay: `${m.delay}s`, '--dx': `${m.dx}px` } as CSSProperties} />)}
  </div>;
}
