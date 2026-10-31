import type { KeeperActivity, KeeperOperation, KeeperOutcome } from './keeper-choreography';

export type ClerkAnimationPhase = 'idle' | 'dispatch' | 'web' | 'walk' | 'documents' | 'read' | 'return' | 'present' | 'error' | 'cancelled';
export interface ClerkSceneProps { phase: ClerkAnimationPhase; time: number; paused: boolean; reducedMotion: boolean; operation?: KeeperOperation }
export interface ClerkAnimationClock {
  requestId: number;
  operation: KeeperOperation;
  elapsed: number;
  completionAt: number | null;
  outcome?: KeeperOutcome;
  started: boolean;
}

export const CLERK_PHASE_LABELS: Record<ClerkAnimationPhase, string> = {
  idle: 'Keeper welcomes you from his chair.',
  dispatch: 'Keeper sends his spider out through the window.',
  web: 'The spider explores while Keeper follows its thread.',
  walk: 'Keeper gets up and walks to the document desks.',
  documents: 'Keeper lifts and checks the papers on the left desk.',
  read: 'Keeper follows the text and turns the pages of his book.',
  return: 'Keeper carries the papers back to his chair.',
  present: 'Keeper offers his findings across the counter.',
  error: 'Keeper pauses and gently opens his hands.',
  cancelled: 'Keeper puts his work down.',
};

export function startClerkClock(activity: KeeperActivity): ClerkAnimationClock {
  return { requestId: activity.id, operation: activity.operation, elapsed: 0, completionAt: null, started: activity.active };
}

/** Network completion is recorded immediately, even when visual motion is paused. */
export function syncClerkClock(clock: ClerkAnimationClock, activity: KeeperActivity): ClerkAnimationClock {
  if (activity.id !== clock.requestId) return startClerkClock(activity);
  if (clock.started && !activity.active && clock.completionAt === null) {
    return { ...clock, completionAt: clock.elapsed, outcome: activity.outcome ?? 'cancelled' };
  }
  return clock;
}

export function advanceClerkClock(clock: ClerkAnimationClock, seconds: number): ClerkAnimationClock {
  return { ...clock, elapsed: clock.elapsed + Math.max(0, seconds) };
}

/** A short gesture can finish after results arrive. It never controls request state. */
export function clerkAnimationFrame(clock: ClerkAnimationClock, reducedMotion = false): { phase: ClerkAnimationPhase; time: number } {
  const { operation, elapsed, completionAt, outcome, started } = clock;
  const documentWork = operation === 'search' || operation === 'import';
  const work: ClerkAnimationPhase = documentWork ? 'documents' : operation === 'discover' ? 'web' : 'read';
  if (!started) return { phase: 'idle', time: reducedMotion ? 0 : elapsed };
  if (reducedMotion) return { phase: completionAt === null ? work : 'idle', time: 0.85 };
  if (completionAt !== null && (outcome === 'error' || outcome === 'cancelled')) {
    let time = elapsed - completionAt;
    // Finish an already-started release, then recall the spider. The request
    // status is already terminal; no web-search loop is entered after cancel.
    const finishRelease = operation === 'discover' ? Math.max(0, 2 - completionAt) : 0;
    if (time < finishRelease) return { phase: 'dispatch', time: elapsed };
    time -= finishRelease;
    // Reverse the distance already walked. Smoothstep is symmetric, so the
    // inverse entry time also keeps mid-stride cancellation in the same place.
    const returnDuration = documentWork ? Math.min(2, completionAt) : 0;
    if (time < returnDuration) return { phase: 'return', time: 2 - returnDuration + time };
    time -= returnDuration;
    return time < 1.8 ? { phase: outcome, time } : { phase: 'idle', time: time - 1.8 };
  }
  const entry = documentWork || operation === 'discover' ? 2 : 0;
  if (elapsed < entry) return { phase: documentWork ? 'walk' : 'dispatch', time: elapsed };
  const workEnds = completionAt === null ? Infinity : Math.max(entry + 2.8, completionAt);
  if (elapsed < workEnds) return { phase: work, time: elapsed - entry };
  let time = elapsed - workEnds;
  if (documentWork) {
    if (time < 2) return { phase: 'return', time };
    time -= 2;
  }
  // Empty results get a considerate open-handed response, not a success gesture.
  if (time < 2.4) return { phase: outcome === 'empty' ? 'error' : 'present', time };
  return { phase: 'idle', time: time - 2.4 };
}
