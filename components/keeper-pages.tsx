export interface PageDrawing { x: number; y: number; scale: number; reading: boolean; frame: number; facing: 1 | -1 }

/** Loose pages are attached to the current drawing's measured hand, including through glass. */
export function KeeperPages({x,y,scale,reading,frame,facing}: PageDrawing) {
  const turn = ((frame % 4) - 1.5) * 3;
  return <g data-keeper-pages={reading ? 'reading' : 'rummaging'} transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true" stroke="#333" strokeWidth="1.2" strokeLinejoin="round" fill="#fff">
    {reading ? <g transform={`rotate(${-7 * facing})`}>
      <path d="M -19 -8 Q -8 -11 0 -5 Q 10 -11 20 -8 L 19 16 Q 9 13 0 18 Q -9 13 -19 16 Z" />
      <path d="M 0 -5 V 18 M -15 -2 L -5 -1 M -15 3 L -5 4 M 5 -1 L 15 -2 M 5 4 L 15 3" fill="none" strokeWidth=".8" />
      <path d="M 5 9 L 15 8" strokeWidth="2" />
    </g> : <g transform={`rotate(${turn * facing})`}>
      <rect x="-10" y="-5" width="22" height="28" rx="1" transform="rotate(-18)" />
      <rect x="-9" y="-8" width="22" height="28" rx="1" transform="rotate(13)" />
      <rect x="-10" y="-9" width="22" height="28" rx="1" />
      <path d="M -6 -3 H 7 M -6 2 H 7 M -6 7 H 3" fill="none" strokeWidth=".8" />
    </g>}
  </g>;
}
