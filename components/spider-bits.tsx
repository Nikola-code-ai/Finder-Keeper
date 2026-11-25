// Finder, the Keeper's spider, in the small sizes the reading room uses: a glyph, a corner web, and Finder on a thread.
import type { CSSProperties } from 'react';

/** Finder as a glyph: eight legs, a round body, two amber eyes. Inherits colour from the text around it. */
export function SpiderGlyph({ size = 16, eyes = true, className, style }: { size?: number; eyes?: boolean; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.2 13.6 Q9 8.6 5.4 9.6" /><path d="M12.6 15.6 Q7.6 13.2 3.4 15.4" /><path d="M12.6 17.8 Q7.6 18.4 4.6 22.6" /><path d="M13.4 19.8 Q10 23.4 8.2 27.6" />
      <path d="M18.8 13.6 Q23 8.6 26.6 9.6" /><path d="M19.4 15.6 Q24.4 13.2 28.6 15.4" /><path d="M19.4 17.8 Q24.4 18.4 27.4 22.6" /><path d="M18.6 19.8 Q22 23.4 23.8 27.6" />
    </g>
    <ellipse cx="16" cy="19.6" rx="4.6" ry="5.6" fill="currentColor" />
    <circle cx="16" cy="12.4" r="3.1" fill="currentColor" />
    {eyes && <><circle cx="14.9" cy="12" r=".8" fill="#E89B53" /><circle cx="17.1" cy="12" r=".8" fill="#E89B53" /></>}
  </svg>;
}

// A corner web: five spokes from the corner and four sagging rings, drawn once.
const SPOKES = [0, 22.5, 45, 67.5, 90].map(a => a * Math.PI / 180);
const RINGS = [18, 36, 58, 82];
const point = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)] as const;
const WEB_PATH = [
  ...SPOKES.map(a => { const [x, y] = point(100, a); return `M0 0 L${x.toFixed(1)} ${y.toFixed(1)}`; }),
  ...RINGS.map(r => SPOKES.map((a, i) => {
    const [x, y] = point(r, a);
    if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const mid = (SPOKES[i - 1] + a) / 2; const [cx, cy] = point(r * .86, mid);
    return `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ')),
].join(' ');

/** A cobweb tucked into a corner of a panel. Purely ornamental. */
export function WebCorner({ corner = 'top-left', size = 72, className }: { corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; size?: number; className?: string }) {
  const flip = { 'top-left': '', 'top-right': 'scale(-1 1) translate(-100 0)', 'bottom-left': 'scale(1 -1) translate(0 -100)', 'bottom-right': 'scale(-1 -1) translate(-100 -100)' }[corner];
  return <svg className={className} data-corner={corner} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <path d={WEB_PATH} transform={flip} stroke="currentColor" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
  </svg>;
}

// A free-hanging web: spokes from a hub to its anchor points, and rings that sag toward the hub between spokes.
function radialWeb(cx: number, cy: number, anchors: [number, number][], rings: number[]) {
  const at = (p: [number, number], f: number) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f] as const;
  const spokes = anchors.map(p => `M${cx} ${cy} L${p[0]} ${p[1]}`);
  const loops = rings.map(f => anchors.map((p, i) => {
    const [x, y] = at(p, f);
    if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const prev = anchors[i - 1]; const mid: [number, number] = [(prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2];
    const [qx, qy] = at(mid, f * .8);
    return `Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + (() => { const [x, y] = at(anchors[0], f); const last = anchors[anchors.length - 1]; const [qx, qy] = at([(last[0] + anchors[0][0]) / 2, (last[1] + anchors[0][1]) / 2], f * .8); return ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; })());
  return [...spokes, ...loops].join(' ');
}
const BOOK_WEB = radialWeb(64, 50, [[4, 6], [60, 1], [126, 10], [138, 60], [114, 108], [58, 116], [10, 96], [1, 48]], [.28, .5, .72, .92]);

/** A book that fell into a cobweb and stayed there, with Finder keeping an eye on it. Line doodle. */
export function BookInWeb({ className, width = 150 }: { className?: string; width?: number }) {
  return <svg className={className} width={width} height={width * 120 / 140} viewBox="0 0 140 120" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <path d={BOOK_WEB} stroke="currentColor" strokeWidth=".7" opacity=".8" />
    <g transform="translate(76 58) rotate(17)">
      <path d="M0 2 Q0 0 2 0 L33 0 Q35 0 35 2 L35 44 Q35 46 33 46 L2 46 Q0 46 0 44 Z" fill="var(--doodle-fill, #0b0e14)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 0 L5 46 M9 10 L29 10 M9 14 L24 14 M12 34 L26 34" stroke="currentColor" strokeWidth=".9" />
      <path d="M35 4 L38 6 L38 47 Q38 49 36 49 L3 49 L0 46" stroke="currentColor" strokeWidth=".9" />
    </g>
    {/* Strands that caught the book */}
    <path d="M64 50 Q80 62 84 70 M102 46 Q98 58 104 64 M88 112 Q90 104 96 102" stroke="currentColor" strokeWidth=".7" />
    <path d="M34 22 L34 34" stroke="currentColor" strokeWidth=".6" />
    <g transform="translate(26 32) scale(.5)"><SpiderPaths /></g>
  </svg>;
}

/** A short stack of books with a web strung across the top one. Line doodle. */
export function BookStack({ className, width = 120 }: { className?: string; width?: number }) {
  return <svg className={className} width={width} height={width * 92 / 120} viewBox="0 0 120 92" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <g stroke="currentColor" strokeWidth="1.1" fill="var(--doodle-fill, #0b0e14)">
      <path d="M14 72 L98 72 Q101 72 101 75 L101 86 Q101 89 98 89 L14 89 Q11 89 11 86 L11 75 Q11 72 14 72 Z" />
      <path d="M22 56 L90 54 Q93 54 93 57 L93 69 Q93 72 90 72 L22 72 Q19 72 19 69 L19 59 Q19 56 22 56 Z" />
      <path d="M16 38 L84 42 Q87 42 87 45 L86 54 Q86 57 83 57 L15 55 Q12 54 12 51 L13 41 Q13 38 16 38 Z" />
    </g>
    <path d="M24 72 L24 89 M90 72 L90 89 M30 56 L30 72 M82 54 L82 72 M22 39 L21 55 M78 41 L77 57 M34 80 L60 80 M40 63 L66 63" stroke="currentColor" strokeWidth=".8" />
    {/* The web from the top book to the air above it */}
    <path d="M86 44 L112 6 M86 44 L118 30 M86 44 L102 2 M95 31 Q103 30 106 21 Q104 13 99 11 M101 37 Q110 33 113 22 Q112 12 104 5" stroke="currentColor" strokeWidth=".6" />
    <path d="M108 14 L108 22" stroke="currentColor" strokeWidth=".5" />
    <g transform="translate(101 21) scale(.42)"><SpiderPaths /></g>
  </svg>;
}

function SpiderPaths() {
  return <>
    <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
      <path d="M13.2 13.6 Q9 8.6 5.4 9.6" /><path d="M12.6 15.6 Q7.6 13.2 3.4 15.4" /><path d="M12.6 17.8 Q7.6 18.4 4.6 22.6" /><path d="M13.4 19.8 Q10 23.4 8.2 27.6" />
      <path d="M18.8 13.6 Q23 8.6 26.6 9.6" /><path d="M19.4 15.6 Q24.4 13.2 28.6 15.4" /><path d="M19.4 17.8 Q24.4 18.4 27.4 22.6" /><path d="M18.6 19.8 Q22 23.4 23.8 27.6" />
    </g>
    <ellipse cx="16" cy="19.6" rx="4.6" ry="5.6" fill="currentColor" /><circle cx="16" cy="12.4" r="3.1" fill="currentColor" />
  </>;
}

/** Finder let down on a silk thread. `drop` is how far the thread runs, in pixels. */
export function Dangler({ drop = 40, size = 18, className, label }: { drop?: number; size?: number; className?: string; label?: string }) {
  return <span className={className} style={{ '--drop': `${drop}px` } as CSSProperties} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <span data-thread="" />
    <SpiderGlyph size={size} />
  </span>;
}
