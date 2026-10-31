'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './spider-lookout.module.css';

type SpiderLookoutProps = {
  active: boolean;
  paused: boolean;
  disabled?: boolean;
  quiet?: boolean;
  onExplore: () => void;
};

type Step = { x: number; frame: number; facing: 'left' | 'right'; walking: boolean };

const restingStep: Step = { x: 0, frame: 0, facing: 'right', walking: false };
const drawingHeight = 172;
const drawingWidth = drawingHeight * .8;
const supportY = 114;

/** Keep every drawing's calibrated foot point on the same physical sill. */
function stepAlongSill(tick: number): Step {
  const step = tick % 64;
  if (step < 8) return restingStep;
  if (step < 20) return { x: (step - 8) * 3, frame: step % 4, facing: 'right', walking: true };
  if (step < 22) return { x: 36, frame: 0, facing: 'left', walking: false };
  if (step < 46) return { x: 36 - (step - 22) * 3, frame: step % 4, facing: 'left', walking: true };
  if (step < 48) return { x: -36, frame: 0, facing: 'right', walking: false };
  if (step < 60) return { x: -36 + (step - 48) * 3, frame: step % 4, facing: 'right', walking: true };
  return restingStep;
}

export default function SpiderLookout({ active, paused, disabled = false, quiet = false, onExplore }: SpiderLookoutProps) {
  const [step, setStep] = useState<Step>(restingStep);
  const [patrolling, setPatrolling] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const tick = useRef(0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    ['idle', 'active', ...[0, 1, 2, 3].map(frame => `walk-${frame}`)].forEach(pose => {
      const image = new window.Image();
      image.src = `/characters/ui-studies/spider-${pose}.webp`;
    });
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if ((!active && !patrolling) || paused || reducedMotion) return;
    // A held ink drawing every eighth of a second, with no timer while idle.
    const timer = window.setInterval(() => {
      tick.current += 1;
      setStep(stepAlongSill(tick.current));
      if (tick.current % 64 === 0 && !active) setPatrolling(false);
    }, 125);
    return () => window.clearInterval(timer);
  }, [active, patrolling, paused, reducedMotion]);

  const motionRequested = active || patrolling;
  const walking = motionRequested && step.walking;
  const pose = walking ? `walk-${step.frame}` : active ? 'active' : 'idle';
  const imageStyle: CSSProperties = {
    width: drawingWidth,
    height: drawingHeight,
    left: -drawingWidth * (step.facing === 'left' ? .64 : .36),
    top: -drawingHeight * .83,
    transform: step.facing === 'left' ? 'scaleX(-1)' : undefined,
  };

  return <aside className={styles.lookout} aria-label="The spider’s lost-and-found" data-active={active} data-paused={paused || reducedMotion}>
    <div className={styles.stage} aria-hidden="true">
      <span className={styles.frame} />
      <svg className={styles.silk} viewBox="0 0 250 132" fill="none">
        <path d="M50 9 L91 51 M50 9 L53 73 M50 9 L119 12 M50 29 Q69 28 71 10 M51 48 Q90 46 93 11 M52 67 Q111 64 115 12" />
        <path className={styles.thread} d={`M50 9 Q67 78 ${125 + step.x - 20} 88`} />
      </svg>
      <span className={styles.contact} style={{ left: `calc(50% + ${step.x}px)`, top: supportY - 2 }} />
      <span className={styles.actor} style={{ left: `calc(50% + ${step.x}px)`, top: supportY }} data-pose={pose}>
        {/* The original transparent canvas preserves the calibrated support point. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/characters/ui-studies/spider-${pose}.webp`} width={384} height={480} alt="" draggable={false} style={imageStyle} />
      </span>
      <span className={styles.sill} />
    </div>
    <button type="button" className={styles.sign} onClick={onExplore} disabled={disabled || active} aria-label="Find sources with the spider">
      <span>The spider’s lost-and-found</span><span aria-hidden="true">↗</span>
    </button>
    {(active || !quiet) && <p className={styles.note} role="status">{active ? 'Searching online for sources…' : 'A little help with the wider web.'}</p>}
    {!reducedMotion && <button type="button" className={styles.patrol} disabled={paused || motionRequested} onClick={() => setPatrolling(true)} title={paused ? 'Resume motion to follow the thread' : 'Watch a short walk along the sill'}>
      {patrolling ? 'Following the thread…' : 'Follow the thread'}
    </button>}
  </aside>;
}
