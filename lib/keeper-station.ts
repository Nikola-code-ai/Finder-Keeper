import type { KeeperActivity } from './keeper-choreography';

export const STATION_START_DELAY_MS = 100;
export const STATION_REACH_MS = 320;
export const STATION_SETTLE_MS = 160;

export interface StationClock {
  requestId: number;
  active: boolean;
  operation: KeeperActivity['operation'];
  elapsedMs: number;
  updatedAt: number;
  paused: boolean;
}

export function stationClock(activity: KeeperActivity, now: number, paused = false): StationClock {
  return {requestId:activity.id,active:activity.active,operation:activity.operation,elapsedMs:0,updatedAt:now,paused};
}

/** Motion time belongs only to a live request. A terminal event always wins
 * over pause and resets the drawing immediately; there is no queued ending. */
export function advanceStationClock(previous: StationClock, activity: KeeperActivity, now: number, paused: boolean): StationClock {
  if (!activity.active || previous.requestId !== activity.id || previous.operation !== activity.operation || !previous.active) return stationClock(activity,now,paused);
  const delta = paused || previous.paused ? 0 : Math.max(0,now-previous.updatedAt);
  return {...previous,elapsedMs:previous.elapsedMs+delta,updatedAt:now,paused};
}

export interface StationPose {
  phase: 'idle' | 'starting' | 'reaching' | 'working' | 'online';
  drawing: 'idle' | 'reach' | 'work' | 'laptop';
  drawerOpen: number;
}

export function sampleStation(clock: StationClock, reducedMotion = false): StationPose {
  if (!clock.active) return {phase:'idle',drawing:'idle',drawerOpen:0};
  // A cached response never flashes a complete physical work sequence.
  if (clock.elapsedMs < STATION_START_DELAY_MS) return {phase:'starting',drawing:'idle',drawerOpen:0};
  if (clock.operation === 'discover') return {phase:'online',drawing:'laptop',drawerOpen:0};
  const progress = reducedMotion ? 1 : Math.min(1,(clock.elapsedMs-STATION_START_DELAY_MS)/STATION_REACH_MS);
  return {phase:progress<1 ? 'reaching' : 'working',drawing:progress<1 ? 'reach' : 'work',drawerOpen:progress};
}

// Measured per-frame anchors from manifest-v4. These two neighboring reach
// drawings keep both feet planted and the hand within the same drawer mouth.
export const STATION_DRAWINGS = {
  idle: {src:'/character-motion-v2/stand/07.webp',feet:[.4998604113597096,.95],hand:undefined},
  reach: {src:'/character-sketch/rummage/02.webp',feet:[.5002722392918645,.95],hand:[.8432216601995566,.6549404101995566]},
  work: {src:'/character-sketch/rummage/00.webp',feet:[.50125865206774,.95],hand:[.8460712305986696,.6631790465631929]},
} as const;

export function stationGeometry(width: number, height: number, drawing: keyof typeof STATION_DRAWINGS, drawerOpen = 0) {
  const actorHeight=Math.max(180,height-20),actorWidth=actorHeight*.8;
  const feet={x:width/2+(width<520 ? 20 : 28),y:height-12};
  const frame=STATION_DRAWINGS[drawing];
  const actor={left:feet.x-(1-frame.feet[0])*actorWidth,top:feet.y-frame.feet[1]*actorHeight,width:actorWidth,height:actorHeight};
  const hand=frame.hand ? {x:actor.left+(1-frame.hand[0])*actorWidth,y:actor.top+frame.hand[1]*actorHeight} : undefined;
  const work=STATION_DRAWINGS.work;
  const workHand={x:feet.x-(work.hand[0]-work.feet[0])*actorWidth,y:feet.y-(work.feet[1]-work.hand[1])*actorHeight};
  const drawerWidth=width<520 ? 132 : 170;
  const drawer={left:workHand.x+24-drawerWidth,top:workHand.y-8,width:drawerWidth,height:width<520 ? 76 : 88,slide:20*Math.min(1,Math.max(0,drawerOpen)),mouthHeight:26};
  return {actor,feet,hand,drawer};
}
