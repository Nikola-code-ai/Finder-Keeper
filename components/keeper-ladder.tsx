import type { KeeperLadder as LadderGeometry } from '@/lib/keeper-choreography';

/** A fixed, visible support. Only its telescoping reveal changes during setup. */
export function KeeperLadder({ ladder, prefix }: { ladder: LadderGeometry; prefix: string }) {
  const left = ladder.x - ladder.width / 2, right = ladder.x + ladder.width / 2;
  const top = ladder.railTop, bottom = ladder.bottom;
  const visibleTop = bottom - (bottom - top + 7) * ladder.progress;
  const rungs = Array.from({ length: Math.ceil((bottom - top) / ladder.rungSpacing) + 1 }, (_, i) => bottom - i * ladder.rungSpacing).filter(y => y >= top);
  const clip = `${prefix}-ladder-extension`;
  const rail = (x: number, sign: number) => `M ${x} ${bottom + 2} L ${x + sign * .8} ${bottom - (bottom - top) * .42} L ${x - sign * .6} ${top + 4} Q ${x} ${top - 4} ${x + sign * 5} ${top - 3}`;
  return <g data-keeper-ladder={ladder.id} data-keeper-ladder-progress={ladder.progress} aria-hidden="true">
    <defs><clipPath id={clip}><rect x={Math.min(left, ladder.landingX) - 12} y={visibleTop - 6} width={Math.max(right, ladder.landingX) - Math.min(left, ladder.landingX) + 24} height={bottom - visibleTop + 18} /></clipPath></defs>
    <g clipPath={`url(#${clip})`} strokeLinecap="round" strokeLinejoin="round">
      <path d={`${rail(left, -1)} ${rail(right, 1)}`} stroke="#fff" strokeWidth="6" fill="none" />
      <path d={`${rail(left, -1)} ${rail(right, 1)}`} stroke="#363636" strokeWidth="2.4" fill="none" />
      {rungs.map((y, i) => <g key={i}>
        <path d={`M ${left} ${y} L ${right} ${y + (i % 2 ? .7 : -.6)}`} stroke="#fff" strokeWidth="5" />
        <path d={`M ${left - 1} ${y} Q ${ladder.x} ${y + (i % 2 ? 1.2 : -1)} ${right + 1} ${y}`} stroke="#3b3b3b" strokeWidth="2" fill="none" />
      </g>)}
      <path d={`M ${ladder.side === 'right' ? left : right} ${ladder.top} L ${ladder.landingX} ${ladder.top} l 0 7`} stroke="#fff" strokeWidth="6" fill="none" />
      <path d={`M ${ladder.side === 'right' ? left : right} ${ladder.top} L ${ladder.landingX} ${ladder.top} l 0 7`} stroke="#343434" strokeWidth="2.5" fill="none" />
      <path d={`M ${left - 5} ${bottom + 2} h 10 M ${right - 5} ${bottom + 2} h 10`} stroke="#262626" strokeWidth="3.5" />
    </g>
  </g>;
}
