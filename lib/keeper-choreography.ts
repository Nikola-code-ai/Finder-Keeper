/** Drawings run slowly; all spatial state uses one continuous feet anchor. */
export type KeeperPose = 'idle' | 'stand' | 'walk' | 'reach' | 'rummage' | 'search' | 'away' | 'peek' | 'pull' | 'carry' | 'shrug' | 'climb' | 'clamber' | 'crawl' | 'picked' | 'landing';
export type KeeperOperation = 'discover' | 'search' | 'ask' | 'import';
export type KeeperOutcome = 'success' | 'empty' | 'error' | 'cancelled';
export interface KeeperActivity { id: number; operation: KeeperOperation; active: boolean; outcome?: KeeperOutcome; targetId?: string; destinationId?: string; status?: string }
export interface Point { x: number; y: number }
export interface WorldRect { left: number; top: number; width: number; height: number }
export interface KeeperLadder {
  id: string; surfaceId: string; x: number; bodyX: number; top: number; bottom: number; railTop: number;
  width: number; rungSpacing: number; landingX: number; exitY: number; side: 'left' | 'right'; progress: number;
}
export interface KeeperBeat {
  pose: KeeperPose; at: Point; pin: 'feet' | 'hand' | 'seat'; facing: 1 | -1; scale: number; frameTime: number; phase: string;
  displacement?: Point; behind?: boolean; hidden?: boolean; footfall?: boolean; paper?: boolean;
  depth?: number; supportId?: string; grounded?: boolean; groundY?: number; velocityY?: number; crouched?: boolean; done?: boolean; ladder?: KeeperLadder; poseProgress?: number; gaitDistance?: number; storageId?: string; lidOpen?: number; laptop?: boolean;
}
export interface WorldSurface { id: string; rect: WorldRect }
export interface KeeperWorldGeometry {
  width: number; height: number; actorHeight: number; halfWidth: number; floorY: number;
  platforms: WorldSurface[]; obstacles: WorldSurface[]; leftEdge: number; rightEdge: number;
}
export interface KeeperSegment {
  start: number; duration: number; phase: string; from: KeeperBeat; to: KeeperBeat;
  kind: 'walk' | 'hop' | 'fall' | 'climb' | 'turn' | 'hold' | 'rise' | 'sit' | 'contact' | 'ladder' | 'clamber';
}
export interface KeeperJourney { world: KeeperWorldGeometry; segments: KeeperSegment[]; duration: number; initial: KeeperBeat; final: KeeperBeat }
export const DRAWING_FPS = 12;
export const GRAVITY = 760;
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
export const between = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
export const frameClock = (seconds: number) => Math.floor(Math.max(0, seconds) * DRAWING_FPS) / DRAWING_FPS;
export function plantedProgress(progress: number, steps: number) {
  const p = clamp(progress) * steps;
  return clamp((Math.floor(p) + clamp(((p % 1) - .25) / .55)) / steps);
}
export function perch(rect: WorldRect): Point { return { x: rect.left + rect.width - Math.min(85, rect.width * .24), y: rect.top }; }
export function idleBeat(rect: WorldRect, _seconds = 0): KeeperBeat {
  return { pose: 'idle', at: perch(rect), pin: 'seat', facing: 1, scale: 1, frameTime: 0, phase: 'resting', depth: 0, grounded: true, groundY: rect.top };
}

/** Freeze measurements for one journey. Rectangles are copied, never mutated. */
export function createWorld(input: { width: number; height: number; actorHeight: number; bodyRadius?: number; platforms: WorldSurface[]; obstacles?: WorldSurface[]; floorY?: number }): KeeperWorldGeometry {
  const copy = (items: WorldSurface[]) => items.filter(item => item.rect.width > 0 && item.rect.height > 0).map(item => ({ id: item.id, rect: { ...item.rect } }));
  const platforms = copy(input.platforms);
  const obstacles = copy(input.obstacles || []);
  const bottom = Math.max(0, ...platforms.map(item => item.rect.top + item.rect.height));
  return {
    width: input.width, height: input.height, actorHeight: input.actorHeight, halfWidth: input.bodyRadius ?? input.actorHeight * .30,
    floorY: input.floorY ?? Math.min(input.height - 18, Math.max(input.height * .72, bottom + input.actorHeight * .45)),
    platforms, obstacles,
    leftEdge: Math.min(input.width * .3, ...platforms.map(item => item.rect.left)),
    rightEdge: Math.max(input.width * .3, ...platforms.map(item => item.rect.left + item.rect.width)),
  };
}
export function bodyBounds(world: KeeperWorldGeometry, at: Point, depth = 0, pose?: KeeperPose, crouched = false): WorldRect {
  const scale = 1 - .16 * clamp(depth);
  const height = world.actorHeight * (crouched || pose === 'crawl' ? .49 : pose === 'idle' || pose === 'clamber' ? .72 : .84) * scale;
  return { left: at.x - world.halfWidth * scale, top: at.y - height, width: world.halfWidth * 2 * scale, height };
}
const overlaps = (a: WorldRect, b: WorldRect) => a.left < b.left + b.width - .01 && a.left + a.width > b.left + .01 && a.top < b.top + b.height - .01 && a.top + a.height > b.top + .01;
/** A depth turn is legal only beyond the outer edge of every solid folder. */
export function canChangeDepth(world: KeeperWorldGeometry, at: Point): boolean {
  const body = bodyBounds(world, at);
  return world.platforms.every(({ rect }) => body.left >= rect.left + rect.width + 2 || body.left + body.width <= rect.left - 2)
    && world.obstacles.every(({ rect }) => !overlaps(body, rect));
}
/** Swept horizontal collision, including thin buttons that a large time step could skip. */
export function blockingMove(world: KeeperWorldGeometry, from: Point, toX: number, depth = 0, ignoreId?: string, pose?: KeeperPose, crouched = false): { at: Point; blockedBy?: string } {
  if (depth >= .99 || Math.abs(toX - from.x) < .001) return { at: { x: toX, y: from.y } };
  const box = bodyBounds(world, from, depth, pose, crouched);
  const radius = box.width / 2;
  let x = toX;
  let blockedBy: string | undefined;
  for (const surface of [...world.platforms, ...world.obstacles]) {
    if (surface.id === ignoreId) continue;
    const rect = surface.rect;
    if (box.top >= rect.top + rect.height - .01 || from.y <= rect.top + .01) continue;
    // Existing contact is permitted only when moving away from it.
    if (toX > from.x && from.x - radius < rect.left + rect.width && toX + radius > rect.left && from.x + radius <= rect.left + 1) {
      const stop = rect.left - radius - 1;
      if (stop < x) { x = Math.max(from.x, stop); blockedBy = surface.id; }
    } else if (toX < from.x && from.x + radius > rect.left && toX - radius < rect.left + rect.width && from.x - radius >= rect.left + rect.width - 1) {
      const stop = rect.left + rect.width + radius + 1;
      if (stop > x) { x = Math.min(from.x, stop); blockedBy = surface.id; }
    }
  }
  return { at: { x, y: from.y }, blockedBy };
}
/** Falling selects the first top crossed, never a lower shelf hidden underneath it. */
export function nextLanding(world: KeeperWorldGeometry, at: Point, depth = 0): { y: number; supportId: string } {
  if (depth >= .99) return { y: Math.max(at.y, world.floorY), supportId: 'floor' };
  const radius = world.halfWidth;
  const candidates = [...world.platforms, ...world.obstacles]
    .filter(({ rect }) => rect.top > at.y + .1 && at.x + radius > rect.left + 2 && at.x - radius < rect.left + rect.width - 2)
    .sort((a, b) => a.rect.top - b.rect.top);
  const first = candidates.find(item => item.rect.top <= world.floorY);
  return first ? { y: first.rect.top, supportId: first.id } : { y: Math.max(at.y, world.floorY), supportId: 'floor' };
}
function feetBeat(world: KeeperWorldGeometry, beat: KeeperBeat): KeeperBeat {
  if (beat.pin === 'feet') return { ...beat, at: { ...beat.at }, displacement: undefined, done: undefined };
  const height = world.actorHeight * beat.scale;
  // Frame zero is the sole seated hold. Its measured seat and feet are stable.
  const dx = (.5014944199568786 - .3094215645695364) * height * .8;
  const dy = (.95 - .7042977373068433) * height;
  return { ...beat, pin: 'feet', at: { x: beat.at.x + dx * beat.facing, y: beat.at.y + dy }, displacement: undefined, done: undefined };
}
function supportedAt(world: KeeperWorldGeometry, at: Point): string | undefined {
  if (Math.abs(at.y - world.floorY) < 1) return 'floor';
  return [...world.platforms, ...world.obstacles].find(({ rect }) => Math.abs(at.y - rect.top) < 1 && at.x + world.halfWidth >= rect.left && at.x - world.halfWidth <= rect.left + rect.width)?.id;
}
class JourneyBuilder {
  world: KeeperWorldGeometry; segments: KeeperSegment[] = []; current: KeeperBeat; initial: KeeperBeat; duration = 0;
  constructor(world: KeeperWorldGeometry, start: KeeperBeat) { this.world = world; this.current = feetBeat(world, start); this.initial = { ...this.current, at: { ...this.current.at } }; }
  add(kind: KeeperSegment['kind'], duration: number, next: Partial<KeeperBeat> & { at?: Point }, phase: string) {
    const from = { ...this.current, at: { ...this.current.at } };
    const walking = kind === 'walk', climbing = kind === 'climb';
    const continuedGait = walking ? ['walk', 'away', 'carry', 'crawl'].includes(from.pose) : climbing && from.pose === 'climb';
    if (walking || climbing) from.gaitDistance = continuedGait ? from.gaitDistance || 0 : 0;
    const to = { ...from, displacement: undefined, paper: false, footfall: false, poseProgress: undefined, storageId: undefined, ...next, phase, pin: 'feet' as const, frameTime: 0 };
    if (walking || climbing) to.gaitDistance = (from.gaitDistance || 0) + Math.hypot(to.at.x - from.at.x, to.at.y - from.at.y);
    to.depth = next.depth ?? from.depth ?? 0; to.scale = 1 - .16 * to.depth; to.behind = to.depth > .5;
    this.segments.push({ start: this.duration, duration: Math.max(.001, duration), phase, kind, from, to });
    this.duration += Math.max(.001, duration); this.current = to;
  }
  hold(pose: KeeperPose, seconds: number, phase: string, props: Partial<KeeperBeat> = {}) { this.add('hold', seconds, { pose, ...props }, phase); }
  walk(x: number, phase = 'walking', props: Partial<KeeperBeat> = {}): boolean {
    // A manual drop may start underneath a control. Lower the body before moving
    // out from it, even when the swept collision starts inside its footprint.
    if (!this.current.crouched && (this.current.depth || 0) < .99) {
      const surfaces = [...this.world.platforms, ...this.world.obstacles].filter(item => item.id !== this.current.supportId);
      const standing = bodyBounds(this.world, this.current.at);
      const low = bodyBounds(this.world, this.current.at, 0, 'crawl', true);
      if (surfaces.some(item => overlaps(standing, item.rect)) && surfaces.every(item => !overlaps(low, item.rect))) {
        this.hold('crawl', .45, 'ducking-under-control', {crouched: true, frameTime: 0, paper: false});
      }
    }
    let result = blockingMove(this.world, this.current.at, x, this.current.depth, this.current.supportId, this.current.pose, this.current.crouched);
    if (result.blockedBy && !this.current.crouched && (this.current.depth || 0) < .99) {
      const ducked = blockingMove(this.world, this.current.at, x, this.current.depth, this.current.supportId, 'peek', true);
      if (!ducked.blockedBy) {
        this.hold('peek', .45, 'ducking-under-control', { crouched: true, frameTime: 0, paper: false });
        result = ducked;
      }
    }
    const distance = result.at.x - this.current.at.x;
    if (Math.abs(distance) > .01) this.add('walk', Math.max(.2, Math.abs(distance) / (this.current.crouched ? 34 : 46)), { at: result.at, pose: this.current.crouched ? 'crawl' : props.paper ? 'carry' : 'walk', facing: distance < 0 ? -1 : 1, grounded: true, footfall: true, ...props, ...(this.current.crouched ? { pose: 'crawl' as const, paper: false } : {}) }, phase);
    if (result.blockedBy) { this.hold(this.current.crouched ? 'peek' : 'stand', .5, 'blocked-by-control', { frameTime: 1, supportId: this.current.supportId }); return false; }
    return true;
  }
  fall() {
    const landing = nextLanding(this.world, this.current.at, this.current.depth);
    const drop = landing.y - this.current.at.y;
    if (drop > .1) {
      const velocity = (this.current.velocityY || 0);
      const duration = (Math.sqrt(velocity * velocity + 2 * GRAVITY * drop) - velocity) / GRAVITY;
      this.add('fall', duration, { at: { x: this.current.at.x, y: landing.y }, pose: this.current.crouched ? 'peek' : 'stand', grounded: false, supportId: undefined, groundY: landing.y, footfall: false, velocityY: 0 }, 'falling');
      const canStand = [...this.world.platforms, ...this.world.obstacles].every(item => !overlaps(bodyBounds(this.world, this.current.at, this.current.depth), item.rect));
      this.hold(canStand ? 'stand' : 'peek', .38, 'landing', { grounded: true, supportId: landing.supportId, groundY: landing.y, frameTime: .8, velocityY: 0, crouched: !canStand });
    } else { this.current = { ...this.current, grounded: true, supportId: landing.supportId, groundY: landing.y }; }
  }
  hop(x: number): boolean {
    const distance = x - this.current.at.x;
    const duration = Math.max(.24, Math.abs(distance) / (this.current.crouched ? 280 : 150));
    // A small outward step clears the platform corner before the feet descend.
    const velocity = -.5 * GRAVITY * duration;
    for (let i = 1; i <= 20; i++) {
      const t = duration * i / 20;
      const at = { x: this.current.at.x + distance * i / 20, y: this.current.at.y + velocity * t + .5 * GRAVITY * t * t };
      const body = bodyBounds(this.world, at, this.current.depth, this.current.pose, this.current.crouched);
      if ([...this.world.platforms, ...this.world.obstacles].some(item => overlaps(body, item.rect))) return false;
    }
    this.add('hop', duration, { at: { x, y: this.current.at.y }, pose: this.current.crouched ? 'peek' : 'walk', grounded: false, supportId: undefined, velocityY: -velocity, groundY: nextLanding(this.world, { x, y: this.current.at.y }).y, facing: distance < 0 ? -1 : 1 }, 'stepping-off-edge');
    return true;
  }
  floor(side: 'left' | 'right' = 'right', clearStack = false): boolean {
    for (let i = 0; i < 10; i++) {
      const support = supportedAt(this.world, this.current.at);
      if (support === 'floor') { this.current.supportId = 'floor'; this.current.grounded = true; return true; }
      if (!support) { this.fall(); continue; }
      const surface = [...this.world.platforms, ...this.world.obstacles].find(item => item.id === support)!;
      this.current.supportId = support;
      const edge = side === 'right' ? surface.rect.left + surface.rect.width : surface.rect.left;
      const direction = side === 'right' ? 1 : -1;
      if (!this.walk(edge - direction * 12, 'walking-to-edge')) return false;
      // Staggered shelves below this one may extend farther into the alley.
      // A recovery hop must clear that connected stack, not land in its 24px gap.
      const stack = clearStack ? this.world.platforms.filter(item => item.rect.top >= surface.rect.top && item.rect.left < surface.rect.left + surface.rect.width && item.rect.left + item.rect.width > surface.rect.left) : [surface];
      const outside = side === 'right' ? Math.max(edge, ...stack.map(item => item.rect.left + item.rect.width)) : Math.min(edge, ...stack.map(item => item.rect.left));
      if (!this.hop(outside + direction * (this.world.halfWidth + 7))) return false;
      const adjacent = supportedAt(this.world, this.current.at);
      if (adjacent) {
        this.hold(this.current.crouched ? 'peek' : 'stand', .3, 'landing', { grounded: true, supportId: adjacent, groundY: this.current.at.y, velocityY: 0 });
      } else {
        this.current.grounded = false; this.current.supportId = undefined;
        this.fall();
      }
    }
    return false;
  }
  turn(depth: number): boolean {
    if (Math.abs((this.current.depth || 0) - depth) < .01) return true;
    if (!canChangeDepth(this.world, this.current.at)) return false;
    this.add('turn', .9, { pose: 'away', crouched: false, depth, grounded: true, groundY: this.world.floorY }, depth ? 'rounding-back-edge' : 'rounding-front-edge'); return true;
  }
  finish(): KeeperJourney { return { world: this.world, segments: this.segments, duration: this.duration, initial: this.initial, final: { ...this.current, frameTime: this.current.crouched ? 0 : this.current.pose === 'stand' ? 1 : this.current.pose === 'peek' ? 1 : 0, done: true, footfall: false, displacement: undefined } }; }
}
function homeFor(world: KeeperWorldGeometry, id: string): WorldSurface {
  return world.platforms.find(item => item.id === id) || world.platforms[0] || { id: 'floor', rect: { left: 20, top: world.floorY, width: Math.max(80, world.width * .45), height: 1 } };
}
function restingFeet(world: KeeperWorldGeometry, home: WorldSurface, seat: Point = perch(home.rect)): KeeperBeat { return { ...feetBeat(world, { ...idleBeat(home.rect), at: seat }), supportId: home.id, grounded: true, groundY: home.rect.top, crouched: false }; }
function seatedSupport(world: KeeperWorldGeometry, beat: KeeperBeat): WorldSurface | undefined {
  if (beat.pose !== 'idle') return undefined;
  const dy = world.actorHeight * beat.scale * (.95 - .7042977373068433);
  const dx = world.actorHeight * beat.scale * .8 * (.5014944199568786 - .3094215645695364) * beat.facing;
  const seat = { x: beat.at.x - dx, y: beat.at.y - dy };
  return world.platforms.find(({ rect }) => Math.abs(seat.y - rect.top) < 2 && seat.x >= rect.left && seat.x <= rect.left + rect.width);
}

/** Find room to stand without putting the head through an overhanging toolbar. */
export function safePerch(world: KeeperWorldGeometry, homeId: string): Point | null {
  const home = homeFor(world, homeId);
  const preferred = perch(home.rect);
  const dx = world.actorHeight * .154;
  const candidates: Point[] = [];
  for (let x = home.rect.left + world.halfWidth + 4; x <= home.rect.left + home.rect.width - world.halfWidth - dx - 4; x += 12) candidates.push({ x, y: home.rect.top });
  candidates.push(preferred);
  candidates.sort((a, b) => Math.abs(a.x - preferred.x) - Math.abs(b.x - preferred.x));
  return candidates.find(at => {
    // The seated feet begin slightly to the right, so clear the entire rising corridor.
    const hull = bodyBounds(world, at);
    hull.width += dx;
    return [...world.platforms, ...world.obstacles].every(item => item.id === home.id || !overlaps(hull, item.rect));
  }) || null;
}
function shuffle(builder: JourneyBuilder, home: WorldSurface, seat: Point, settle = true): boolean {
  const target = restingFeet(builder.world, home, seat);
  const seated = seatedSupport(builder.world, builder.current);
  if (seated?.id === home.id && Math.abs(target.at.x - builder.current.at.x) < .1) return true;
  if (seated?.id === home.id) {
    const dx = builder.world.actorHeight * .8 * (.5014944199568786 - .3094215645695364) * builder.current.facing;
    const standing = { x: builder.current.at.x - dx, y: home.rect.top };
    const canStand = [...builder.world.platforms, ...builder.world.obstacles].every(item => item.id === home.id || !overlaps(bodyBounds(builder.world, standing), item.rect));
    if (!canStand && [...builder.world.platforms, ...builder.world.obstacles].some(item => item.id !== home.id && overlaps(bodyBounds(builder.world, standing, 0, 'crawl', true), item.rect))) return false;
    builder.add('rise', .7, { at: standing, pose: canStand ? 'stand' : 'crawl', crouched: !canStand, supportId: home.id, grounded: true, groundY: home.rect.top }, canStand ? 'getting-up' : 'ducking-under-control');
  }
  if (!builder.walk(seat.x, 'walking-on-shelf')) return false;
  if (settle) builder.add('sit', .8, { ...target, pose: 'clamber', crouched: false, hidden: false }, 'sitting-down');
  return true;
}
function safeHold(builder: JourneyBuilder, phase = 'standing-by') { builder.hold(builder.current.supportId?.startsWith('ladder:') ? 'climb' : builder.current.crouched ? 'peek' : 'stand', .3, phase, { frameTime: .9, displacement: undefined, paper: false,storageId:undefined,laptop:false,lidOpen:0 }); return builder.finish(); }

function preferredSide(world: KeeperWorldGeometry, beat: KeeperBeat, home: WorldSurface): 'left' | 'right' {
  const clear = (side: 'left' | 'right') => {
    const corridor = side === 'right' ? world.rightEdge + world.halfWidth + 14 : world.leftEdge - world.halfWidth - 14;
    if (!canChangeDepth(world, { x: corridor, y: world.floorY })) return false;
    if (side === 'right' && world.rightEdge - (home.rect.left + home.rect.width) > world.actorHeight * .1) return false;
    if (side === 'left' && home.rect.left - world.leftEdge > world.actorHeight * .1) return false;
    if ((beat.depth || 0) > .5) return true;
    const standing = beat.phase === 'resting' || beat.pin === 'seat' ? perch(home.rect) : beat.at;
    const support = supportedAt(world, standing);
    const edge = side === 'right' ? home.rect.left + home.rect.width - 12 : home.rect.left + 12;
    return !blockingMove(world, standing, support === home.id ? edge : corridor, 0, support).blockedBy
      || !blockingMove(world, standing, support === home.id ? edge : corridor, 0, support, 'peek', true).blockedBy;
  };
  const right = clear('right'), left = clear('left');
  if (left && right) {
    const leftDistance = Math.abs(beat.at.x - (world.leftEdge - world.halfWidth - 14));
    const rightDistance = Math.abs(beat.at.x - (world.rightEdge + world.halfWidth + 14));
    return leftDistance < rightDistance ? 'left' : 'right';
  }
  return right || !left ? 'right' : 'left';
}

/** A ladder exists only in a visible, unobstructed side alley. */
export function placeLadder(world: KeeperWorldGeometry, homeId: string, preferred?: 'left' | 'right'): KeeperLadder | null {
  const home = homeFor(world, homeId);
  const candidates: KeeperLadder[] = [];
  for (const side of ['right', 'left'] as const) {
    const direction = side === 'right' ? 1 : -1;
    const edge = side === 'right' ? home.rect.left + home.rect.width : home.rect.left;
    const width=Math.min(world.actorHeight*.42,world.halfWidth*1.5);
    const stack=world.platforms.filter(item=>item.rect.top>=home.rect.top && item.rect.left<home.rect.left+home.rect.width && item.rect.left+item.rect.width>home.rect.left);
    const stackEdge=side==='right' ? Math.max(edge,...stack.map(item=>item.rect.left+item.rect.width)) : Math.min(edge,...stack.map(item=>item.rect.left));
    const stackClearance=width/2+world.actorHeight*.12+2;
    const x=side==='right' ? Math.max(edge+Math.max(world.halfWidth+10,world.actorHeight*.40285),stackEdge+stackClearance) : Math.min(edge-Math.max(world.halfWidth+10,world.actorHeight*.40285),stackEdge-stackClearance);
    const exitY = home.rect.top + world.actorHeight * (.95 - .7042977373068433);
    if (x - world.halfWidth < 8 || x + world.halfWidth > world.width - 8 || exitY >= world.floorY - 12) continue;
    const hull = bodyBounds(world, { x, y: exitY });
    hull.height = world.floorY - hull.top;
    if (hull.top < 8 || [...world.platforms, ...world.obstacles].some(item => item.id !== home.id && overlaps(hull, item.rect))) continue;
    const landingX = edge - direction * 12;
    // Clambering is a low, hand-supported top-out with dangling feet, just like the seated drawing.
    const seated = restingFeet(world, home, { x: landingX, y: home.rect.top });
    const dismount = bodyBounds(world, seated.at, 0, 'clamber');
    const corridor = { ...dismount, left: Math.min(dismount.left, x - world.halfWidth), width: Math.max(dismount.left + dismount.width, x + world.halfWidth) - Math.min(dismount.left, x - world.halfWidth) };
    if (world.obstacles.some(item => overlaps(corridor, item.rect))) continue;
    const railCenter = x - direction * world.actorHeight * .12;
    const railTop = home.rect.top - world.actorHeight * .65;
    const rails = { left: railCenter - width/2, top: railTop, width, height: world.floorY - railTop };
    if (railTop < 8 || [...world.platforms, ...world.obstacles].some(item => item.id !== home.id && overlaps(rails, item.rect))) continue;
    candidates.push({ id: `ladder:${home.id}`, surfaceId: home.id, bodyX: x, x: x - direction * world.actorHeight * .12, top: home.rect.top, bottom: world.floorY, railTop: home.rect.top - world.actorHeight * .65, width, rungSpacing: clamp(world.actorHeight * .12, 18, 26), landingX, exitY, side, progress: 1 });
  }
  return candidates.find(candidate => candidate.side === preferred) || candidates[0] || null;
}

function retractLadder(builder: JourneyBuilder, ladder: KeeperLadder) {
  const onFloor = builder.current.supportId === 'floor';
  builder.add('ladder', .9, { pose: onFloor ? 'pull' : 'idle', facing: onFloor ? ladder.side === 'right' ? -1 : 1 : builder.current.facing, crouched: false, ladder: { ...ladder, progress: 0 }, paper: false }, 'retracting-ladder');
  builder.current = { ...builder.current, ladder: undefined };
}
function descendLadder(builder: JourneyBuilder): void {
  const ladder = builder.current.ladder;
  if (!ladder) return;
  if (builder.current.supportId === ladder.id) {
    // A new task may arrive during top-out: back onto the rung horizontally
    // before descending, instead of cutting diagonally through the shelf face.
    if (Math.abs(builder.current.at.x - ladder.bodyX) > .1) builder.add('clamber', .9, { at: { x: ladder.bodyX, y: builder.current.at.y }, pose: 'clamber', facing: ladder.side === 'right' ? -1 : 1, grounded: false, supportId: ladder.id }, 'remounting-ladder');
    const distance = ladder.bottom - builder.current.at.y;
    if (distance > .1) builder.add('climb', Math.max(.8, distance / ladder.rungSpacing * .72), { at: { x: ladder.bodyX, y: ladder.bottom }, pose: 'climb', crouched: false, grounded: false, supportId: ladder.id, ladder: { ...ladder, progress: 1 }, paper: false, groundY: ladder.bottom, hidden: false }, 'descending-ladder');
    builder.hold('stand', .6, 'dismounting-ladder', { supportId: 'floor', grounded: true, crouched: false, groundY: ladder.bottom });
  }
  retractLadder(builder, ladder);
}
function ascendLadder(builder: JourneyBuilder, home: WorldSurface, ladder: KeeperLadder): boolean {
  const mounted = builder.current.supportId === ladder.id && builder.current.ladder;
  if (!mounted) {
    if (!builder.walk(ladder.bodyX, 'returning', { hidden: false, paper: false })) return false;
    builder.add('ladder', 1.2, { pose: 'pull', facing: ladder.side === 'right' ? -1 : 1, crouched: false, ladder: { ...ladder, progress: 1 }, supportId: 'floor', grounded: true, groundY: ladder.bottom, paper: false, hidden: false }, 'deploying-ladder');
    const firstY = Math.max(ladder.exitY, ladder.bottom - ladder.rungSpacing);
    builder.add('climb', .85, { at: { x: ladder.bodyX, y: firstY }, pose: 'climb', ladder, crouched: false, supportId: ladder.id, grounded: false, groundY: ladder.bottom, facing: ladder.side === 'right' ? -1 : 1, paper: false }, 'mounting-ladder');
  }
  const distance = builder.current.at.y - ladder.exitY;
  if (Math.abs(distance) > .1) builder.add('climb', Math.max(.75, Math.abs(distance) / ladder.rungSpacing * .72), { at: { x: ladder.bodyX, y: ladder.exitY }, pose: 'climb', ladder, crouched: false, supportId: ladder.id, grounded: false, groundY: ladder.bottom, paper: false, hidden: false }, 'climbing-ladder');
  const seated = restingFeet(builder.world, home, { x: ladder.landingX, y: home.rect.top });
  builder.add('clamber', 1.35, { ...seated, pose: 'clamber', facing: ladder.side === 'right' ? -1 : 1, ladder, crouched: false, supportId: ladder.id, grounded: false, groundY: home.rect.top, hidden: false }, 'dismounting-ladder');
  builder.hold('idle', .3, 'settling-on-shelf', { facing: seated.facing, supportId: home.id, grounded: true, crouched: false, groundY: home.rect.top });
  retractLadder(builder, ladder);
  return true;
}

/** A user can drop the actor into space too tight for even the crawling drawing.
 * Only that externally imposed overlap may slip through glass: first touch it,
 * then change depth at the same point, fall behind it, and exit at a legal edge.
 * Autonomous routes never use this exception to pass through a solid face.
 */
function recoverEmbeddedDrop(builder: JourneyBuilder, start?: KeeperBeat): void {
  if (!start || !['landing-after-drop', 'pressed-against-glass', 'slipping-behind-glass'].includes(start.phase)) return;
  const depth = builder.current.depth || 0;
  if (depth >= .99) return;
  const cramped = bodyBounds(builder.world, builder.current.at, 0, 'crawl', true);
  const obstruction = builder.world.platforms.find(item => overlaps(cramped, item.rect));
  if (!obstruction && start.phase !== 'slipping-behind-glass') return;
  if (depth === 0 && start.phase !== 'pressed-against-glass') {
    builder.add('contact', 1.8, { pose: 'reach', supportId: `grip:${obstruction!.id}`, grounded: true, groundY: builder.current.at.y, hidden: false, crouched: false }, 'pressed-against-glass');
  }
  builder.add('turn', .9 * (1 - depth), { pose: 'away', depth: 1, grounded: false, supportId: undefined, groundY: builder.world.floorY, hidden: false, crouched: false, displacement: undefined }, 'slipping-behind-glass');
  builder.fall();
}

function recoverySide(builder: JourneyBuilder, destinationX: number | undefined, fallback: 'left' | 'right'): 'left' | 'right' {
  const support = [...builder.world.platforms, ...builder.world.obstacles].find(item => item.id === supportedAt(builder.world, builder.current.at));
  if (!support || destinationX === undefined) return fallback;
  return destinationX >= support.rect.left + support.rect.width / 2 ? 'right' : 'left';
}

/** Stand, walk to the supported edge, fall, then turn around the outside of the glass. */
export function planPending(world: KeeperWorldGeometry, homeId: string, operation: KeeperOperation, start?: KeeperBeat): KeeperJourney {
  const home = homeFor(world, homeId);
  const collections = world.platforms.filter(item => item.id.startsWith('collection:'));
  const builder = new JourneyBuilder(world, start || restingFeet(world, home));
  recoverEmbeddedDrop(builder, start);
  if (builder.current.ladder) descendLadder(builder);
  if (!start || seatedSupport(world, builder.current)) {
    const standing = safePerch(world, home.id);
    if (standing) {
      if (!shuffle(builder, home, standing, false)) return builder.finish();
      builder.add('rise', 1.1, { at: standing, pose: 'stand', crouched: false, supportId: home.id, grounded: true, groundY: home.rect.top, hidden: false }, 'getting-up');
    } else {
      // Tight mobile shelves may allow crawling even when an upright pose cannot fit.
      const crouch = perch(home.rect);
      const hull = bodyBounds(world, crouch, 0, 'peek', true);
      if ([...world.platforms, ...world.obstacles].some(item => item.id !== home.id && overlaps(hull, item.rect))) return builder.finish();
      builder.add('rise', .8, { at: crouch, pose: 'peek', crouched: true, supportId: home.id, grounded: true, groundY: home.rect.top, hidden: false }, 'ducking-under-control');
    }
  }
  if (start && ['getting-up', 'ducking-under-control', 'sitting-down'].includes(start.phase) && start.supportId === home.id && builder.current.at.y > home.rect.top + 1) {
    // A layout change may rebuild a still-active journey halfway through the rise.
    // Keep its support and finish crouched instead of misreading the dangling feet.
    const at = { x: clamp(builder.current.at.x, home.rect.left + 12, home.rect.left + home.rect.width - 12), y: home.rect.top };
    const hull = bodyBounds(world, at, 0, 'peek', true);
    if ([...world.platforms, ...world.obstacles].some(item => item.id !== home.id && overlaps(hull, item.rect))) return safeHold(builder);
    builder.add('rise', .5, { at, pose: 'peek', crouched: true, supportId: home.id, grounded: true, groundY: home.rect.top, hidden: false }, 'ducking-under-control');
  }
  const side = home.id === 'composer' && collections.length ? placeLadder(world, home.id)?.side || preferredSide(world, builder.current, home) : preferredSide(world, builder.current, home);
  const support = supportedAt(world, builder.current.at);
  const departureSide = start && support !== home.id ? recoverySide(builder, home.rect.left + home.rect.width / 2, side) : side;
  if ((builder.current.depth || 0) < .99 && !builder.floor(departureSide, !!start)) return safeHold(builder);
  // The gap between folders and the composer is a real legal alley. Walking all
  // the way to the outermost page edge would send a front-plane actor through
  // the opposite folder stack before it could turn behind the glass.
  const corridor = (builder.current.depth || 0) >= .99 || canChangeDepth(world, builder.current.at) ? builder.current.at.x : side === 'right' ? world.rightEdge + world.halfWidth + 14 : world.leftEdge - world.halfWidth - 14;
  if (!builder.walk(corridor, 'walking-around-shelf') || !builder.turn(1)) return safeHold(builder);
  const searchHome = home.id === 'composer'
    ? collections.filter(item => item.rect.top < world.floorY && item.rect.top + item.rect.height > world.floorY - world.actorHeight * .84).sort((a, b) => b.rect.top - a.rect.top)[0] || collections[0] || home
    : home;
  const searchX = searchHome.rect.left + searchHome.rect.width * .72;
  builder.walk(searchX, 'behind-bubble', { pose: 'walk', hidden: false });
  if ((operation === 'search' || operation === 'ask') && collections.some(item => item.id === searchHome.id)) {
    // Local retrieval happens in this storage bubble. The contact and paper prop
    // name the real collection so the renderer never shakes a remote folder.
    builder.add('contact', 1.8, { pose: 'reach', supportId: `grip:${searchHome.id}`, storageId: searchHome.id, grounded: true, groundY: world.floorY, hidden: false }, 'opening-folder');
    builder.hold('rummage', 3.6, 'checking-storage', { storageId: searchHome.id, paper: true, grounded: true, supportId: 'floor', groundY: world.floorY, hidden: false });
    if (operation === 'ask') builder.hold('search', 4.8, 'reading-passages', { storageId: searchHome.id, paper: true, grounded: true, supportId: 'floor', groundY: world.floorY, hidden: false });
    return builder.finish();
  }
  builder.hold('rummage', 2.5, 'searching-behind-glass', { paper: operation === 'import', grounded: true, supportId: 'floor', groundY: world.floorY });
  builder.walk(-world.actorHeight, 'leaving-page', { pose: 'away', paper: false });
  builder.hold('stand', 1.4, 'off-page', { hidden: true });
  builder.walk(searchHome.rect.left + 45, 'returning-behind-glass', { hidden: false });
  builder.hold('peek', 2, 'looking-behind', { hidden: false });
  return builder.finish();
}

/** Only visible, measured destinations can direct travel. Missing targets do not
 * silently send Keeper to an unrelated collection. */
export function requestDestination(world: KeeperWorldGeometry, activity: KeeperActivity, fallbackId: string): string | undefined {
  if (activity.operation === 'discover') return world.platforms.some(surface => surface.id === 'reading-desk') ? 'reading-desk' : fallbackId;
  const requested = activity.destinationId?.startsWith('collection:') ? activity.destinationId : 'collection:all';
  return world.platforms.some(surface => surface.id === requested) ? requested : undefined;
}

/** The room floor is fixed to the viewport, so page scroll cannot carry an
 * actor standing on it below the screen. Surface-supported actors follow DOM
 * measurements instead and must not be snapped onto this floor. */
export function keepFloorInView(world: KeeperWorldGeometry, beat: KeeperBeat): KeeperBeat {
  if (beat.supportId !== 'floor' || !beat.grounded) return beat;
  const margin = Math.min(world.halfWidth,world.width/2);
  const x = clamp(beat.at.x,margin,world.width-margin);
  return x === beat.at.x && beat.at.y === world.floorY ? beat : {...beat,at:{x,y:world.floorY},groundY:world.floorY};
}

/** Production journeys reach the requested station and stay there. A collection
 * is entered from its real top lip; the drawing's legs remain visible through
 * that drawer's glass while its contents are being read. */
export function planRequestPending(world: KeeperWorldGeometry, homeId: string, activity: KeeperActivity, start?: KeeperBeat): KeeperJourney {
  const destinationId = requestDestination(world, activity, homeId);
  const initial = start ? feetBeat(world,start) : restingFeet(world, homeFor(world, homeId));
  if (!destinationId) return safeHold(new JourneyBuilder(world,initial),'waiting-for-visible-collection');
  const destination = homeFor(world, destinationId);
  const seatedWork = (initial.storageId || initial.laptop || initial.pose === 'idle') && seatedSupport(world, {...initial, pose:'idle'});
  if (activity.operation === 'discover' && seatedWork) {
    const seated = new JourneyBuilder(world,initial);
    seated.hold('search',1,'using-laptop',{laptop:true,storageId:undefined,lidOpen:0,depth:0,supportId:seatedWork.id,paper:false});
    return seated.finish();
  }
  const egress = new JourneyBuilder(world, initial);
  const previousChest = world.platforms.find(surface=>surface.id===initial.storageId && surface.id.startsWith('collection:'));
  const insideChest = previousChest && initial.supportId === previousChest.id && ((initial.depth || 0) > 0 || (initial.lidOpen || 0) > 0);
  const previousSeat = insideChest ? previousChest : seatedWork;
  if (previousSeat && previousSeat.id !== destinationId && ((initial.depth || 0) > 0 || previousSeat.id.startsWith('collection:'))) {
    // An outcome can interrupt the first frame of entering a chest. Any
    // measured lid/depth progress still belongs to that real chest; the .5
    // rendering threshold must not erase its physical support. Recover at the
    // current X instead of sliding across to a default perch.
    const seat = {x:clamp(initial.at.x - world.actorHeight * .8 * (.5014944199568786 - .3094215645695364) * initial.facing,previousSeat.rect.left+12,previousSeat.rect.left+previousSeat.rect.width-12),y:previousSeat.rect.top};
    const front = restingFeet(world, previousSeat, seat);
    egress.add('clamber', .7, {...front,pose:'idle',depth:0,storageId:previousSeat.id,lidOpen:0,laptop:false}, 'leaving-glass-folder');
    const ladder = placeLadder(world, previousSeat.id);
    if (ladder) {
      const edgeSeat={x:ladder.landingX,y:previousSeat.rect.top};
      const edgeBefore={length:egress.segments.length,duration:egress.duration,current:{...egress.current,at:{...egress.current.at}}};
      if (!shuffle(egress,previousSeat,edgeSeat)) {
        egress.segments.length=edgeBefore.length;egress.duration=edgeBefore.duration;egress.current=edgeBefore.current;
        const cavity=chestWorkPoint(world,previousSeat);
        egress.add('clamber',.6,{at:{x:egress.current.at.x,y:cavity.y},pose:'peek',depth:.78,storageId:previousSeat.id,lidOpen:1,crouched:true,groundY:cavity.y},'opening-folder');
        const edgeX=ladder.side==='right' ? previousSeat.rect.left+previousSeat.rect.width-20 : previousSeat.rect.left+20;
        if (!egress.walk(edgeX,'moving-inside-chest',{storageId:previousSeat.id,lidOpen:1})) return safeHold(egress,'waiting-for-clear-route');
        egress.add('clamber',.7,{...restingFeet(world,previousSeat,edgeSeat),pose:'idle',depth:0,storageId:previousSeat.id,lidOpen:0,crouched:false},'leaving-chest');
      }
      // A tight drawer stack may not have enough headroom to stand. Leave by
      // the same outside ladder used to reach its lip, with no crawl through
      // the drawer above it.
      egress.add('ladder', .8, {pose:'idle',ladder:{...ladder,progress:1}}, 'deploying-ladder');
      egress.add('clamber', .8, {at:{x:ladder.bodyX,y:egress.current.at.y},pose:'clamber',supportId:ladder.id,grounded:false,ladder}, 'remounting-ladder');
      descendLadder(egress);
    }
  }
  if (insideChest && previousChest.id === destinationId) {
    const builder = new JourneyBuilder(world,initial);
    appendChestWork(builder,destination,activity);
    return builder.finish();
  }
  const approach = planArrival(world, destinationId, egress.segments.length ? egress.current : seatedWork ? {...initial,pose:'idle'} : initial, 'success', activity.operation,true);
  const builder = new JourneyBuilder(world, approach.final);
  builder.segments = [...egress.segments, ...approach.segments.map(segment=>({...segment,start:segment.start+egress.duration}))]; builder.duration = egress.duration+approach.duration; builder.initial = egress.segments.length ? egress.initial : approach.initial;
  if (approach.final.supportId !== destinationId) return safeHold(builder, 'waiting-for-clear-route');
  if (destinationId.startsWith('collection:')) {
    appendChestWork(builder,destination,activity);
  } else {
    builder.hold('search',1,'using-laptop',{laptop:true,storageId:undefined,lidOpen:0,paper:false,grounded:true,supportId:destinationId,groundY:destination.rect.top});
  }
  return builder.finish();
}

/** The eight measured rummage hands span y=.541..663. With a .60 reference,
 * their whole sweep stays inside the actual 26px chest cavity at this scale. */
export function chestWorkPoint(world: KeeperWorldGeometry, chest: WorldSurface): Point {
  const displayHeight = world.actorHeight * (1-.16*.78);
  return {x:chest.rect.left+chest.rect.width*.56-displayHeight*.8*.29,y:chest.rect.top+10+displayHeight*.35};
}

function appendChestWork(builder: JourneyBuilder, chest: WorldSurface, activity: KeeperActivity) {
  const destinationId = chest.id;
  const at = chestWorkPoint(builder.world,chest);
  const rimSeat={x:at.x-builder.world.actorHeight*.8*(.5014944199568786-.3094215645695364),y:chest.rect.top};
  if ((builder.current.lidOpen || 0)<1) {
    const before={length:builder.segments.length,duration:builder.duration,current:{...builder.current,at:{...builder.current.at}}};
    const acrossRim=shuffle(builder,chest,rimSeat);
    if (!acrossRim) {
      builder.segments.length=before.length; builder.duration=before.duration; builder.current=before.current;
    }
    const entry=acrossRim ? at : {x:clamp(builder.current.at.x,chest.rect.left+20,chest.rect.left+chest.rect.width-20),y:at.y};
    builder.add('clamber',.85,{at:entry,pose:'peek',depth:.78,facing:1,storageId:destinationId,supportId:destinationId,grounded:true,groundY:at.y,lidOpen:1,laptop:false,paper:false},'opening-folder');
    if (!acrossRim) {
      // Tight stacked chests cannot be crossed standing on their rim. Enter
      // through the reached lid, then duck across the actual cavity instead.
      builder.current.crouched=true;
      if (!builder.walk(at.x,'moving-inside-chest',{storageId:destinationId,lidOpen:1,paper:false})) return;
    }
  }
  const presenting = !activity.active && activity.outcome === 'success';
  builder.hold(activity.operation==='ask' ? 'search' : 'rummage',presenting ? 1.1 : 1,presenting ? 'retrieving-source' : activity.operation==='ask' ? 'reading-passages' : activity.operation==='import' ? 'filing-document' : 'checking-storage',{at,depth:.78,storageId:destinationId,supportId:destinationId,grounded:true,groundY:at.y,lidOpen:1,laptop:false,paper:true,crouched:false});
  if (presenting) {
    builder.hold('search',1.4,'presenting-source',{storageId:destinationId,lidOpen:1,paper:true});
    const rim=restingFeet(builder.world,chest,rimSeat);
    builder.add('clamber',.8,{...rim,pose:'clamber',depth:0,storageId:destinationId,lidOpen:1,paper:false},'leaving-chest');
    builder.add('hold',.65,{pose:'idle',storageId:destinationId,lidOpen:0,paper:false},'closing-folder');
    builder.hold('idle',.25,'source-presented',{storageId:undefined,lidOpen:0,frameTime:0});
  }
}

/** A response ends work where it happened. Finish gravity when necessary, then
 * acknowledge the real outcome; no compulsory return to an original seat. */
export function planRequestSettled(world: KeeperWorldGeometry, start: KeeperBeat, activity: KeeperActivity): KeeperJourney {
  const builder = new JourneyBuilder(world, start);
  const supportId = start.supportId?.replace(/^grip:/,'');
  const support = world.platforms.find(surface => surface.id === supportId);
  if (support && start.storageId===support.id && (start.lidOpen || 0)>0) {
    const seat={x:builder.current.at.x-world.actorHeight*.8*(.5014944199568786-.3094215645695364),y:support.rect.top};
    builder.add('clamber',.6,{...restingFeet(world,support,seat),pose:'clamber',depth:0,storageId:support.id,lidOpen:1,paper:false,laptop:false},'leaving-chest');
    builder.add('hold',.4,{pose:'idle',storageId:support.id,lidOpen:0},'closing-folder');
  }
  if (support && ['getting-up', 'ducking-under-control', 'sitting-down'].includes(start.phase) && builder.current.at.y > support.rect.top + 1) {
    builder.add('rise', .3, { at: { x: builder.current.at.x, y: support.rect.top }, pose: start.crouched ? 'peek' : 'stand', supportId: support.id, grounded: true, groundY: support.rect.top }, 'settling-at-request');
  }
  const removedSupport = start.supportId && start.supportId !== 'floor' && !start.ladder && !start.supportId.startsWith('grip:') && !support;
  if ((start.grounded === false || removedSupport) && !start.ladder && !['rounding-back-edge', 'rounding-front-edge'].includes(start.phase)) builder.fall();
  const phase = activity.outcome === 'error' ? 'request-error' : activity.outcome === 'cancelled' ? 'request-cancelled' : activity.outcome === 'empty' ? 'request-empty' : activity.id > 0 ? 'request-complete' : 'resting';
  const seated = seatedSupport(world, builder.current) || (start.storageId || start.laptop) && seatedSupport(world, {...builder.current,pose:'idle'});
  const pose = start.ladder ? 'climb' : seated ? 'idle' : builder.current.crouched ? 'peek' : activity.outcome === 'error' || activity.outcome === 'empty' ? 'shrug' : 'stand';
  builder.hold(pose, .5, phase, { paper: false, hidden: false, displacement: undefined, storageId: undefined,laptop:false,lidOpen:0, supportId:seated ? seated.id : builder.current.supportId, footfall: false, frameTime: pose === 'stand' ? 1 : 0 });
  return builder.finish();
}

/** Copy comes from request state, never from the duration of an animation. */
export function keeperRequestNote(activity: KeeperActivity): string {
  if (!activity.active) return activity.outcome === 'error' ? 'A snag. Try again.' : activity.outcome === 'cancelled' ? 'Stopped here.' : activity.outcome === 'empty' ? 'No matches this time.' : activity.outcome === 'success' ? activity.operation === 'import' ? 'Filed in your library.' : 'Ready. Take a look.' : '';
  if (activity.operation === 'import' && activity.status) {
    const stage = activity.status.toLowerCase();
    if (/download|fetch/.test(stage)) return 'Bringing the source in…';
    if (/extract|pars|ocr/.test(stage)) return 'Reading the document…';
    if (/embed|index/.test(stage)) return 'Making it searchable…';
    if (/sav|stor|persist/.test(stage)) return 'Filing your document…';
    if (/queue/.test(stage)) return 'Your request is queued.';
  }
  return activity.operation === 'discover' ? 'Looking for open sources…' : activity.operation === 'ask' ? 'Reading your saved passages…' : activity.operation === 'import' ? 'Adding to your library…' : 'Searching your saved pages…';
}

/** The visual local-library check can finish after the response is already shown.
 * A caller may defer the return trip until this point, but must not delay results.
 * Online, blocked, or collection-free journeys have no required library check.
 */
export function libraryCheckEnd(journey: KeeperJourney): number {
  const contact = journey.segments.find(segment => segment.phase === 'opening-folder' && segment.to.storageId && segment.to.supportId === `grip:${segment.to.storageId}`);
  if (!contact) return 0;
  const meaningful = journey.segments.filter(segment => (segment.phase === 'checking-storage' || segment.phase === 'reading-passages') && segment.to.storageId === contact.to.storageId && segment.start >= contact.start + contact.duration);
  const last = meaningful[meaningful.length - 1];
  return last ? last.start + last.duration : 0;
}

/** Completion/cancellation begins exactly where the pending actor was. No portal to the seat. */
export function planArrival(world: KeeperWorldGeometry, homeId: string, start: KeeperBeat, outcome: KeeperOutcome, operation: KeeperOperation, stepDown = false): KeeperJourney {
  const home = homeFor(world, homeId);
  const builder = new JourneyBuilder(world, start);
  recoverEmbeddedDrop(builder, start);
  const seated = seatedSupport(world, builder.current);
  if (seated?.id === home.id) {
    builder.current = { ...builder.current, phase: 'resting', supportId: seated.id, grounded: true, groundY: seated.rect.top, hidden: false };
    if (builder.current.ladder) {
      retractLadder(builder, builder.current.ladder);
      builder.hold('idle', .2, 'resting', { frameTime: 0 });
    }
    return builder.finish();
  }
  if (seated && seated.id !== home.id) {
    // A dragged character may have been put on another folder. Get onto that
    // folder's real top before planning the trip home; do not keep its old seat.
    const dx = world.actorHeight * .8 * (.5014944199568786 - .3094215645695364) * builder.current.facing;
    const standing = { x: builder.current.at.x - dx, y: seated.rect.top };
    const canStand = [...world.platforms, ...world.obstacles].every(item => item.id === seated.id || !overlaps(bodyBounds(world, standing), item.rect));
    builder.add('rise', .8, { at: standing, pose: canStand ? 'stand' : 'crawl', crouched: !canStand, supportId: seated.id, grounded: true, groundY: seated.rect.top, hidden: false }, 'getting-up');
  }
  if (['getting-up', 'ducking-under-control', 'sitting-down', 'shuffling-on-shelf'].includes(start.phase) && start.supportId === home.id && builder.current.at.y > home.rect.top + 1) {
    // A request can finish halfway through rising or shuffling. Settle the existing
    // support first; dangling legs are not an instruction to fall through the slab.
    const dx = world.actorHeight * .8 * (.5014944199568786 - .3094215645695364);
    const seat = { x: clamp(builder.current.at.x - dx, home.rect.left + 12, home.rect.left + home.rect.width - 12), y: home.rect.top };
    builder.add('sit', .55, { ...restingFeet(world, home, seat), pose: 'peek', crouched: true, hidden: false }, 'sitting-down');
    builder.hold('idle', .2, 'resting', { crouched: false, grounded: true, supportId: home.id, groundY: home.rect.top, hidden: false });
    return builder.finish();
  }
  if (['getting-up', 'ducking-under-control', 'sitting-down', 'shuffling-on-shelf'].includes(start.phase)) {
    // A response or layout change can interrupt the very first rising frame.
    // Finish that movement on its actual support, never on the destination:
    // looking for a perch at the target either teleported there or held forever
    // when a different chest above the target prevented standing upright.
    const source = world.platforms.find(surface => surface.id === start.supportId);
    if (source && builder.current.at.y > source.rect.top + 1) {
      const seatDx = world.actorHeight * .8 * (.5014944199568786 - .3094215645695364);
      const seatDy = world.actorHeight * (.95 - .7042977373068433);
      const standing = { x: clamp(builder.current.at.x - Math.min(seatDy, builder.current.at.y - source.rect.top) * seatDx / seatDy * builder.current.facing, source.rect.left + 12, source.rect.left + source.rect.width - 12), y: source.rect.top };
      const clear = (crouched: boolean) => [...world.platforms, ...world.obstacles].every(surface => surface.id === source.id || !overlaps(bodyBounds(world, standing, 0, crouched ? 'crawl' : 'stand', crouched), surface.rect));
      const canStand = clear(false);
      if (!canStand && !clear(true)) return safeHold(builder);
      builder.add('rise', .45, { at: standing, pose: canStand ? 'stand' : 'crawl', crouched: !canStand, supportId: source.id, grounded: true, groundY: source.rect.top, hidden: false }, 'getting-up');
    }
  }
  const carry = operation === 'import' && outcome === 'success';
  const onExistingLadder = builder.current.ladder && builder.current.supportId === builder.current.ladder.id;
  const existingLadder = onExistingLadder ? builder.current.ladder : undefined;
  const ladder = existingLadder?.surfaceId === home.id ? existingLadder : placeLadder(world, home.id, preferredSide(world, builder.current, home));
  const side = ladder?.side || preferredSide(world, builder.current, home);
  const ladderAlley = ladder && canChangeDepth(world, { x: ladder.bodyX, y: world.floorY }) ? ladder.bodyX : undefined;
  const corridor = ladderAlley ?? (side === 'right' ? world.rightEdge + world.halfWidth + 14 : world.leftEdge - world.halfWidth - 14);
  if (builder.current.ladder && !onExistingLadder) retractLadder(builder, builder.current.ladder);
  if (onExistingLadder && existingLadder?.surfaceId !== home.id) descendLadder(builder);
  if ((builder.current.depth || 0) > .01) {
    if ((builder.current.depth || 0) < .99 && !builder.turn(1)) return safeHold(builder);
    if (!builder.walk(corridor, 'returning-behind-glass', { hidden: false, paper: carry }) || !builder.turn(0)) return safeHold(builder);
  }
  const onHome = supportedAt(world, builder.current.at) === home.id;
  if (!onHome) {
    // Resolve an interrupted hop/fall before selecting which edge to leave.
    // Choosing a direction in midair has no current surface to inspect and can
    // send a desk landing toward the viewport edge instead of the clear alley.
    if (!onExistingLadder && builder.current.grounded === false) builder.fall();
    const departureSide = recoverySide(builder, ladder?.bodyX, side);
    if (!onExistingLadder && !builder.floor(departureSide, !stepDown)) return safeHold(builder);
    if (!ladder) return safeHold(builder, 'waiting-for-clear-ladder');
    if (!ascendLadder(builder, home, ladder)) return safeHold(builder);
  }
  const resting = safePerch(world, home.id) || perch(home.rect);
  if (!shuffle(builder, home, resting)) return builder.finish();
  builder.hold('idle', .3, 'resting', { frameTime: 0, crouched: false, grounded: true, supportId: home.id, groundY: home.rect.top, hidden: false });
  return builder.finish();
}

export function sampleJourney(journey: KeeperJourney, seconds: number): KeeperBeat {
  const t = frameClock(seconds);
  if (t >= journey.duration || !journey.segments.length) return { ...journey.final, at: { ...journey.final.at } };
  const segment = journey.segments.find(item => t < item.start + item.duration) || journey.segments[journey.segments.length - 1];
  const elapsed = clamp(t - segment.start, 0, segment.duration);
  const p = elapsed / segment.duration;
  const climbSteps = segment.kind === 'climb' ? Math.max(1, Math.abs(segment.to.at.y - segment.from.at.y) / (segment.to.ladder?.rungSpacing || 24)) : 0;
  const progress = segment.kind === 'walk' ? plantedProgress(p, Math.max(1, Math.ceil(segment.duration / 1.2))) : segment.kind === 'climb' ? plantedProgress(p, climbSteps) : segment.kind === 'fall' ? p * p : p;
  const depth = mix(segment.from.depth || 0, segment.to.depth || 0, p);
  const at = between(segment.from.at, segment.to.at, progress);
  if (segment.kind === 'fall') at.y = segment.from.at.y + (segment.from.velocityY || 0) * elapsed + .5 * GRAVITY * elapsed * elapsed;
  if (segment.kind === 'hop') at.y = segment.from.at.y - .5 * GRAVITY * segment.duration * elapsed + .5 * GRAVITY * elapsed * elapsed;
  const holdFrame = segment.kind === 'hold' && !['rummage', 'search'].includes(segment.to.pose);
  const beat: KeeperBeat = {
    ...segment.to, at, depth, scale: 1 - .16 * depth, behind: depth > .5, poseProgress: undefined, frameTime: segment.to.pose === 'idle' ? 0 : holdFrame ? segment.to.frameTime || (segment.to.pose === 'stand' ? 1 : 0) : elapsed,
    grounded: segment.kind === 'fall' || segment.kind === 'hop' ? false : segment.to.grounded, velocityY: segment.kind === 'fall' ? (segment.from.velocityY || 0) + GRAVITY * elapsed : segment.kind === 'hop' ? -.5 * GRAVITY * segment.duration + GRAVITY * elapsed : 0, done: false,
  };
  if (segment.from.lidOpen !== undefined || segment.to.lidOpen !== undefined) beat.lidOpen=mix(segment.from.lidOpen || 0,segment.to.lidOpen || 0,p);
  if (segment.to.ladder) {
    const fromProgress = segment.from.ladder?.id === segment.to.ladder.id ? segment.from.ladder.progress : 0;
    beat.ladder = { ...segment.to.ladder, progress: segment.kind === 'ladder' ? mix(fromProgress, segment.to.ladder.progress, p) : segment.to.ladder.progress };
  }
  if (segment.kind === 'walk' || segment.kind === 'climb') beat.gaitDistance = (segment.from.gaitDistance || 0) + Math.hypot(at.x - segment.from.at.x, at.y - segment.from.at.y);
  if (segment.kind === 'climb') beat.poseProgress = ((beat.gaitDistance || 0) / (2 * (segment.to.ladder?.rungSpacing || 24))) % 1;
  else if (['rise', 'sit', 'clamber'].includes(segment.kind)) beat.poseProgress = p;
  // Top-out drawings 0–2 face the shelf; drawing 3 turns into the right-facing
  // seated hold whose measured feet/seat offset defines the landing position.
  if (segment.kind === 'clamber' && segment.phase === 'dismounting-ladder' && p >= .75) beat.facing = 1;
  if (segment.kind === 'contact') {
    const push = elapsed < .9 ? 0 : beat.facing * 6 * Math.sin(clamp((elapsed - .9) / .9) * Math.PI);
    beat.at.x += push; beat.displacement = { x: push, y: 0 };
  }
  return beat;
}

/** Compatibility entry points for the isolated pose study. Production uses cached journeys. */
export function pendingBeat(rect: WorldRect, seconds: number, viewportWidth: number, operation: KeeperOperation): KeeperBeat {
  const world = createWorld({ width: viewportWidth, height: Math.max(720, rect.top + rect.height + 180), actorHeight: 218, platforms: [{ id: 'home', rect }] });
  return sampleJourney(planPending(world, 'home', operation), seconds);
}
export function arrivalBeat(rect: WorldRect, seconds: number, start: Point, outcome: KeeperOutcome, operation: KeeperOperation, _side: 'left' | 'right' = 'right'): KeeperBeat {
  const world = createWorld({ width: Math.max(1280, rect.left + rect.width + 100), height: Math.max(720, rect.top + rect.height + 180), actorHeight: 218, platforms: [{ id: 'home', rect }] });
  return sampleJourney(planArrival(world, 'home', { pose: 'walk', at: start, pin: 'feet', facing: 1, scale: 1, frameTime: 0, phase: 'returning', depth: 1 }, outcome, operation), seconds);
}
/** Contact point remains exact when the drawing is mirrored. */
export function placeDrawing(at: Point, anchor: readonly [number, number], width: number, height: number, facing: 1 | -1): Point {
  return { x: at.x - (facing === 1 ? anchor[0] : 1 - anchor[0]) * width, y: at.y - anchor[1] * height };
}
