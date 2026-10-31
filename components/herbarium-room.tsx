'use client';

import { useId } from 'react';

/**
 * The herbarium shop as three painted layers (back wall and folio shelves, the desks and counter,
 * the foreground), each a full-width plate in the same 2160×1440 coordinate space so the camera
 * can move them at different speeds. Authored as vector washes: no image generation was available
 * for this round, so these plates stand in for painted ones (see the surface brief).
 */
const VB = '0 0 2160 1440';
const C = { cloth: '#35503a', clothDeep: '#263b2b', clothLight: '#4a6a4f', wood: '#7a6244', woodDeep: '#4f3f2b', woodLight: '#9a7f5a', wall: '#9aa58a', wallDeep: '#7f8c72', sheet: '#efe9da', sheetShade: '#d9d0b6', ink: '#2a2a26', red: '#9c3b2c', glass: '#cfdac2', glassDeep: '#a9bc9d', floor: '#6e5a3f' };

function Defs({ id }: { id: string }) {
  return <defs>
    {/* Wash: ragged wet edges on every big fill. */}
    <filter id={`${id}-wash`} x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="7" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" /></filter>
    {/* Grain: pigment settling into the paper tooth. */}
    <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="g" /><feColorMatrix in="g" type="matrix" values="0 0 0 0 .16 0 0 0 0 .14 0 0 0 0 .1 0 0 0 .18 0" result="t" /><feBlend in="SourceGraphic" in2="t" mode="multiply" /></filter>
    <linearGradient id={`${id}-wallg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.wall} /><stop offset="1" stopColor={C.wallDeep} /></linearGradient>
    <linearGradient id={`${id}-glassg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.glass} /><stop offset="1" stopColor={C.glassDeep} /></linearGradient>
    <linearGradient id={`${id}-woodg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.woodLight} /><stop offset=".12" stopColor={C.wood} /><stop offset="1" stopColor={C.woodDeep} /></linearGradient>
    <pattern id={`${id}-folios`} width="54" height="300" patternUnits="userSpaceOnUse"><rect width="54" height="300" fill={C.clothDeep} /><rect x="4" y="6" width="44" height="288" rx="3" fill={C.cloth} /><rect x="12" y="40" width="28" height="60" fill={C.sheet} opacity=".85" /><rect x="12" y="110" width="28" height="3" fill={C.sheetShade} /><rect x="12" y="122" width="28" height="3" fill={C.sheetShade} /></pattern>
    <pattern id={`${id}-folios2`} width="62" height="300" patternUnits="userSpaceOnUse"><rect width="62" height="300" fill={C.clothDeep} /><rect x="5" y="4" width="50" height="292" rx="3" fill={C.clothLight} /><rect x="14" y="60" width="32" height="54" fill={C.sheet} opacity=".8" /></pattern>
    <pattern id={`${id}-boards`} width="140" height="1440" patternUnits="userSpaceOnUse"><rect width="140" height="1440" fill={C.floor} /><rect x="136" width="4" height="1440" fill={C.woodDeep} opacity=".6" /></pattern>
  </defs>;
}

/** Back wall, folio shelves, the window and the web. Moves slowest. */
export function RoomBack() {
  const id = useId().replace(/:/g, '');
  return <svg viewBox={VB} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <Defs id={id} />
    <rect width="2160" height="1440" fill={`url(#${id}-wallg)`} />
    <g filter={`url(#${id}-grain)`}>
      {/* Folio shelves, left and centre-right, each case a cloth-bound run. */}
      {[[0, 60, 820, 1000], [1240, 120, 420, 940]].map(([x, y, w, h], i) => <g key={i}>
        <rect x={x} y={y} width={w} height={h} fill={C.woodDeep} filter={`url(#${id}-wash)`} />
        {Array.from({ length: Math.floor(h / 200) }, (_, r) => <g key={r}>
          <rect x={x + 14} y={y + 24 + r * 200} width={w - 28} height={150} fill={`url(#${id}-${r % 2 ? 'folios2' : 'folios'})`} />
          <rect x={x + 8} y={y + 176 + r * 200} width={w - 16} height={18} fill={C.wood} />
        </g>)}
      </g>)}
      {/* A botanical print pinned to the wall between the cases. */}
      <rect x="900" y="300" width="260" height="340" fill={C.sheet} stroke={C.woodDeep} strokeWidth="10" />
      <path d="M1030 600 C 1010 520, 990 470, 1030 380 M1030 560 C 1070 540, 1090 500, 1080 460 M1030 500 C 990 480, 970 440, 980 400" fill="none" stroke={C.cloth} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="1055" cy="430" rx="22" ry="38" fill={C.clothLight} transform="rotate(-30 1055 430)" /><ellipse cx="1000" cy="470" rx="20" ry="34" fill={C.cloth} transform="rotate(35 1000 470)" />
    </g>
  </svg>;
}

/** The desks, the counter and the floor: the working surfaces the objects sit on. */
export function RoomMid() {
  const id = useId().replace(/:/g, '');
  return <svg viewBox={VB} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <Defs id={id} />
    <rect x="0" y="1020" width="2160" height="420" fill={`url(#${id}-boards)`} />
    <g filter={`url(#${id}-grain)`}>
      {/* The window: an arch of green light with the web in its corner. It sits in this layer so its label and the spider stay on it. */}
      <path d="M1700 180 a 150 150 0 0 1 300 0 v 560 h -300 z" fill={`url(#${id}-glassg)`} stroke={C.woodDeep} strokeWidth="22" />
      <path d="M1850 30 v 710 M1700 420 h 300 M1700 600 h 300" stroke={C.woodDeep} strokeWidth="12" />
      <g stroke={C.sheet} strokeWidth="2.5" fill="none" opacity=".85">{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M2000 ${60 + i * 48} Q ${1920 - i * 14} ${80 + i * 46} ${1842 - i * 12} ${40 + i * 60}`} />)}{[0, 1, 2, 3].map(i => <path key={`s${i}`} d={`M2000 40 L ${1850 - i * 30} ${300 + i * 20}`} />)}</g>
      {/* Left desks: two tiers where the folios lie. */}
      <path d="M30 860 L 640 820 L 640 1100 L 30 1130 Z" fill={`url(#${id}-woodg)`} filter={`url(#${id}-wash)`} />
      <rect x="30" y="826" width="610" height="34" fill={C.woodLight} transform="skewY(-3.7)" />
      <rect x="60" y="1100" width="40" height="220" fill={C.woodDeep} /><rect x="580" y="1070" width="40" height="230" fill={C.woodDeep} />
      {/* The counter: the Keeper stands behind it, your sheets lie on it. */}
      <path d="M760 880 L 1900 880 L 1900 1440 L 760 1440 Z" fill={C.woodDeep} />
      <path d="M740 850 L 1920 850 L 1920 905 L 740 905 Z" fill={`url(#${id}-woodg)`} />
      <rect x="790" y="960" width="1080" height="300" fill="none" stroke={C.wood} strokeWidth="8" opacity=".6" />
      {/* A small table under the window. */}
      <path d="M1720 980 L 2000 980 L 2000 1010 L 1720 1010 Z" fill={C.wood} /><rect x="1740" y="1010" width="24" height="180" fill={C.woodDeep} /><rect x="1950" y="1010" width="24" height="180" fill={C.woodDeep} />
    </g>
  </svg>;
}

/** Foreground: the near edge of the counter, a plant, the room's shadowed corners. Moves fastest. */
export function RoomFront() {
  const id = useId().replace(/:/g, '');
  return <svg viewBox={VB} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <Defs id={id} />
    <g filter={`url(#${id}-grain)`}>
      <path d="M700 1300 L 1960 1300 L 1960 1440 L 700 1440 Z" fill={C.woodDeep} />
      <path d="M680 1270 L 1980 1270 L 1980 1310 L 680 1310 Z" fill={C.wood} />
      {/* A trailing plant at the far right, between you and the window. */}
      <g transform="translate(2040 1120)">{[-70, -40, -10, 20, 50].map((a, i) => <path key={i} d={`M0 0 C ${a} -80, ${a * 1.4} -160, ${a * 1.2} -240`} fill="none" stroke={C.cloth} strokeWidth="8" strokeLinecap="round" />)}{[-80, -54, 10, 60].map((x, i) => <ellipse key={`l${i}`} cx={x} cy={-150 - i * 30} rx="28" ry="44" fill={i % 2 ? C.clothLight : C.cloth} transform={`rotate(${x / 2} ${x} ${-150 - i * 30})`} />)}</g>
      <path d="M1990 1120 h 100 l -14 120 h -72 z" fill={C.woodDeep} />
    </g>
    <rect width="2160" height="1440" fill="url(#vignette)" opacity="0" />
  </svg>;
}
