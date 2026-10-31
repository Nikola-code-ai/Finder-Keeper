'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeeperActivity, KeeperOperation } from '@/lib/keeper-choreography';
import { advanceClerkClock, clerkAnimationFrame, CLERK_PHASE_LABELS, startClerkClock, syncClerkClock } from '@/lib/clerk-animation';
import ClerkIllustratedScene from './clerk-illustrated-scene';

export interface MotionPreview { operation: KeeperOperation; run: number }

export default function ClerkAnimatedScene({ activity, paused, reducedMotion, preview }: {
  activity: KeeperActivity; paused: boolean; reducedMotion: boolean; preview: MotionPreview | null;
}) {
  const effectiveActivity: KeeperActivity = preview ? { id: -preview.run - 1, operation: preview.operation, active: true } : activity;
  const clock = useRef(startClerkClock(effectiveActivity));
  const [frame, setFrame] = useState(() => clerkAnimationFrame(clock.current, reducedMotion));

  useEffect(() => {
    clock.current = syncClerkClock(clock.current, effectiveActivity);
    if (!paused || reducedMotion) setFrame(clerkAnimationFrame(clock.current, reducedMotion));
  }, [effectiveActivity.id, effectiveActivity.operation, effectiveActivity.active, effectiveActivity.outcome, reducedMotion, paused]);

  useEffect(() => {
    if (paused || reducedMotion) return;
    let handle = 0;
    let previous = 0;
    const tick = (now: number) => {
      if (document.hidden) previous = 0;
      else if (!previous) previous = now;
      else if (now - previous >= 1000 / 24) {
        clock.current = advanceClerkClock(clock.current, Math.min((now - previous) / 1000, 0.1));
        if (preview && clock.current.elapsed >= 6 && clock.current.completionAt === null) {
          clock.current = { ...clock.current, completionAt: 6, outcome: 'success' };
        }
        setFrame(clerkAnimationFrame(clock.current));
        previous = now;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [paused, reducedMotion, preview?.run]);

  return <div data-clerk-animation data-phase={frame.phase} data-motion-time={frame.time.toFixed(2)} data-preview={Boolean(preview)} role="img" aria-label={`Facing the elderly shopkeeper across his counter. ${CLERK_PHASE_LABELS[frame.phase]}`} style={{ position: 'absolute', inset: 0 }}>
    <ClerkIllustratedScene {...frame} paused={paused} reducedMotion={reducedMotion} operation={effectiveActivity.operation} />
  </div>;
}
