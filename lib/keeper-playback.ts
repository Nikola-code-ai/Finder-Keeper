import type { KeeperActivity, KeeperJourney } from './keeper-choreography';

/** Spatial journeys play faster without changing their collision or gait math. */
export const KEEPER_PLAYBACK_RATE = 2.4;
export interface KeeperRun {
  kind: 'idle' | 'pending' | 'presenting' | 'arrival';
  started: number;
  activity: KeeperActivity;
  plan?: KeeperJourney;
  signature?: string;
  presentationDone?: boolean;
}
export const playbackSeconds = (now: number, started: number) => Math.max(0, now - started) / 1000 * KEEPER_PLAYBACK_RATE;

export const shouldPresentSource = (activity: KeeperActivity) => !activity.active && activity.outcome === 'success' && activity.operation !== 'discover';
/** A successful local response may show where its returned source lives. This
 * is presentation after completion, never a delayed result or pending search. */
export function updateKeeperRun(run: KeeperRun, activity: KeeperActivity, now: number): KeeperRun {
  const changedRequest = run.activity.id !== activity.id;
  const changedActive = run.activity.active !== activity.active;
  const changedDestination = run.activity.destinationId !== activity.destinationId;
  const changedOutcome = run.activity.outcome !== activity.outcome;
  if (!changedRequest && !changedActive && !changedDestination && !changedOutcome && !(run.kind === 'idle' && activity.active)) return {...run, activity};
  return {kind:activity.active ? 'pending' : shouldPresentSource(activity) ? 'presenting' : activity.id > 0 ? 'arrival' : 'idle', started:now, activity};
}

/** Resume real work after a drop; a completed request stays completed. */
export function resumeAfterDrop(run: KeeperRun, activity: KeeperActivity, now: number): KeeperRun {
  return {kind:activity.active ? 'pending' : shouldPresentSource(activity) && !run.presentationDone ? 'presenting' : 'arrival', started:now, activity,presentationDone:run.presentationDone};
}
