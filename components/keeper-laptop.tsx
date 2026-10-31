export interface LaptopDrawing { x:number; y:number; scale:number; facing:1|-1; frame:number }

/** The keyboard's near edge is attached to the drawing's measured hands. */
export function KeeperLaptop({x,y,scale,facing,frame}:LaptopDrawing) {
  return <g data-keeper-laptop transform={`translate(${x} ${y}) scale(${scale*facing} ${scale})`} aria-hidden="true" stroke="#292929" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M -21 -7 L -17 -39 Q -16 -42 -13 -42 H 26 Q 29 -42 29 -39 L 24 -7 Z" fill="#fafafa" />
    <path d="M -13 -35 H 23 L 20 -12 H -16 Z" fill="#e4e4e4" strokeWidth=".8" />
    <path d="M -10 -29 H 15 M -11 -23 H 8 M -12 -17 H 12" fill="none" strokeWidth="1" />
    <circle cx={15+(frame%3)*2} cy="-17" r="1.2" fill="#333" stroke="none" />
    <path d="M -21 -7 H 24 L 35 3 Q 36 5 31 6 H -27 Q -31 5 -29 3 Z" fill="#fff" />
    <path d="M -16 -3 H 21 M -19 0 H 24 M -9 -5 L -11 2 M 0 -5 V 2 M 9 -5 L 11 2 M 18 -5 L 22 2" fill="none" strokeWidth=".6" />
    <path d="M -4 3 H 7" strokeWidth="1.5" />
  </g>;
}
