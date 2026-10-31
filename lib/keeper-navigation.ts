/** Small, deterministic platform physics. Coordinates describe the character's feet. */
export interface Point { x: number; y: number }
export interface Platform { id: string; left: number; right: number; y: number; bottom?: number; kind: 'folder' | 'composer' | 'floor' | 'result' }
export interface Viewport { width: number; height: number }
export interface Flight { position: Point; velocity: Point; landed: boolean; supportId?: string }
export interface NavigationOptions {
  gravity?: number; walkSpeed?: number; climbSpeed?: number; maxJumpGap?: number; maxJumpRise?: number; maxJumpDrop?: number; inset?: number; stride?: number; actorHeight?: number; bodyRadius?: number;
}
export interface Ladder { x: number; top: number; bottom: number }
export interface RouteSegment {
  kind: 'walk' | 'jump' | 'ladder' | 'fall'; start: number; duration: number;
  from: Point; to: Point; distance: number; fromPlatformId?: string; platformId?: string;
  velocityY?: number; gravity?: number; ladder?: Ladder;
}
export interface Route { segments: RouteSegment[]; duration: number; initial: Point; final: Point; supportId?: string; complete: boolean; stride: number }
export interface RouteSample {
  position: Point; velocity: Point; kind: RouteSegment['kind'] | 'idle'; facing: 1 | -1;
  grounded: boolean; supportId?: string; ladder?: Ladder; gaitDistance: number; gaitPhase: number; progress: number; done: boolean;
}

export const NAVIGATION_GRAVITY = 760;
const EPSILON = 0.00001;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));
const contains = (platform: Platform, x: number) => x >= platform.left - EPSILON && x <= platform.right + EPSILON;
const clean = (platforms: readonly Platform[]) => platforms.filter(p => Number.isFinite(p.left) && Number.isFinite(p.right) && Number.isFinite(p.y) && p.right >= p.left);
const onPlatform = (point: Point, platforms: readonly Platform[]) => platforms.find(p => contains(p, point.x) && Math.abs(p.y - point.y) < .5);

/** Foot positions remain visible after a resize, including viewports smaller than the actor. */
export function clampToViewport(point: Point, viewport: Viewport, radius = 0): Point {
  const inset = Math.max(0, Math.min(radius, viewport.width / 2));
  return { x: clamp(point.x, inset, viewport.width - inset), y: clamp(point.y, 0, viewport.height) };
}

/** A drop may land below its current feet; it never snaps upward to a nearby shelf. */
export function supportBelow(point: Point, platforms: readonly Platform[]): Platform | undefined {
  return clean(platforms).filter(p => contains(p, point.x) && p.y >= point.y - EPSILON).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id))[0];
}

/** Exact swept collision with one-way tops, even across a long animation frame. */
export function stepGravity(position: Point, velocity: Point, dt: number, platforms: readonly Platform[], gravity = NAVIGATION_GRAVITY): Flight {
  const seconds = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const g = Math.max(EPSILON, gravity);
  const end = { x: position.x + velocity.x * seconds, y: position.y + velocity.y * seconds + .5 * g * seconds * seconds };
  let earliest = Infinity;
  let support: Platform | undefined;
  for (const platform of clean(platforms)) {
    const discriminant = velocity.y * velocity.y + 2 * g * (platform.y - position.y);
    if (discriminant < 0) continue;
    // The positive square-root selects the descending crossing, including a jump's return.
    const time = (-velocity.y + Math.sqrt(discriminant)) / g;
    if (time < -EPSILON || time > seconds + EPSILON || time >= earliest) continue;
    if (velocity.y + g * time < -EPSILON) continue;
    const x = position.x + velocity.x * Math.max(0, time);
    if (!contains(platform, x)) continue;
    earliest = Math.max(0, time); support = platform;
  }
  if (support) return { position: { x: position.x + velocity.x * earliest, y: support.y }, velocity: { x: 0, y: 0 }, landed: true, supportId: support.id };
  return { position: end, velocity: { x: velocity.x, y: velocity.y + g * seconds }, landed: false };
}

/** A stride is a LEFT + RIGHT pair, not one repeated step. Distance, not elapsed time, drives it. */
export function gait(distance: number, stride = 48, frameCount = 8): { phase: number; frame: number; lead: 'left' | 'right' } {
  const cycle = Math.max(EPSILON, stride);
  const phase = ((Math.max(0, distance) % cycle) + cycle) % cycle / cycle;
  return { phase, frame: Math.min(Math.max(1, Math.floor(frameCount)) - 1, Math.floor(phase * Math.max(1, Math.floor(frameCount)))), lead: phase < .5 ? 'left' : 'right' };
}

type Edge = Omit<RouteSegment, 'start'> & { continuation?: Edge };
const defaults = { gravity: NAVIGATION_GRAVITY, walkSpeed: 48, climbSpeed: 34, maxJumpGap: 96, maxJumpRise: 76, maxJumpDrop: 115, inset: 12, stride: 48, actorHeight: 100, bodyRadius: 18 };
function interior(platform: Platform, x: number, inset: number) {
  const margin = Math.min(inset, (platform.right - platform.left) / 2);
  return clamp(x, platform.left + margin, platform.right - margin);
}
function airEdge(kind: 'jump' | 'fall', from: Point, to: Point, sourceId: string | undefined, targetId: string, options: typeof defaults): Edge {
  let velocityY = 0;
  let duration: number;
  if (kind === 'fall') duration = Math.sqrt(Math.max(0, 2 * (to.y - from.y) / options.gravity));
  else {
    // Fixed apex clearance gives a real takeoff and landing, including upward hops.
    const rise = Math.max(28, from.y - to.y + 22, Math.abs(to.x - from.x) * .2);
    velocityY = -Math.sqrt(2 * options.gravity * rise);
    duration = (-velocityY + Math.sqrt(velocityY * velocityY + 2 * options.gravity * (to.y - from.y))) / options.gravity;
  }
  return { kind, from, to, fromPlatformId: sourceId, platformId: targetId, duration: Math.max(.001, duration), distance: Math.abs(to.x - from.x), velocityY, gravity: options.gravity };
}
function clearBodyLine(from: Point, to: Point, platforms: readonly Platform[], options: typeof defaults) {
  const left = Math.min(from.x, to.x) - options.bodyRadius, right = Math.max(from.x, to.x) + options.bodyRadius;
  const top = Math.min(from.y, to.y) - options.actorHeight, bottom = Math.max(from.y, to.y);
  return platforms.every(platform => platform.bottom === undefined || platform.kind === 'floor' || !(left < platform.right - EPSILON && right > platform.left + EPSILON && top < platform.bottom - EPSILON && bottom > platform.y + EPSILON));
}
function clearFlight(edge: Edge, platforms: readonly Platform[], options: typeof defaults) {
  const vx = (edge.to.x - edge.from.x) / edge.duration;
  const result = stepGravity(edge.from, { x: vx, y: edge.velocityY || 0 }, edge.duration, platforms.filter(p => p.id !== edge.fromPlatformId), edge.gravity);
  if (!result.landed || result.supportId !== edge.platformId || Math.abs(result.position.x - edge.to.x) >= .1) return false;
  let previous = edge.from;
  for (let step = 1; step <= 40; step++) {
    const time = edge.duration * step / 40;
    const point = { x: edge.from.x + vx * time, y: edge.from.y + (edge.velocityY || 0) * time + .5 * (edge.gravity || options.gravity) * time * time };
    if (!clearBodyLine(previous, point, platforms, options)) return false;
    previous = point;
  }
  return true;
}

/** Transfers are either ballistic, strictly vertical ladders, or supported horizontal walks. */
function transfers(source: Platform, target: Platform, platforms: readonly Platform[], options: typeof defaults): Edge[] {
  const edges: Edge[] = [];
  const overlapLeft = Math.max(source.left, target.left);
  const overlapRight = Math.min(source.right, target.right);
  const gap = Math.max(0, target.left - source.right, source.left - target.right);
  const rise = source.y - target.y;
  if (Math.abs(rise) < EPSILON && gap < EPSILON) {
    const x = (overlapLeft + overlapRight) / 2;
    edges.push({ kind: 'walk', from: { x, y: source.y }, to: { x, y: target.y }, duration: .001, distance: 0, fromPlatformId: source.id, platformId: target.id });
    return edges;
  }
  if (gap <= options.maxJumpGap && rise <= options.maxJumpRise && -rise <= options.maxJumpDrop) {
    const middle = (overlapLeft + overlapRight) / 2;
    const fromX = overlapRight >= overlapLeft ? interior(source, middle, options.inset) : interior(source, target.left > source.right ? source.right : source.left, options.inset);
    const toX = overlapRight >= overlapLeft ? interior(target, middle, options.inset) : interior(target, target.left > source.right ? target.left : target.right, options.inset);
    const edge = airEdge('jump', { x: fromX, y: source.y }, { x: toX, y: target.y }, source.id, target.id, options);
    if (Math.abs(toX - fromX) <= options.maxJumpGap + options.inset * 2 && clearFlight(edge, platforms, options)) edges.push(edge);
  }
  // Walking off an edge can reach a lower, wider platform. Feet leave the actual edge.
  if (rise < -EPSILON) {
    const duration = Math.sqrt(-2 * rise / options.gravity);
    for (const direction of [-1, 1]) {
      // The whole body must clear a solid face before descending past its lip.
      // With faces present use an outward jump with enough drift to clear the lip.
      const edgeX = direction > 0 ? source.right : source.left;
      const targetX = edgeX + direction * Math.min(options.walkSpeed * duration, options.inset + 8);
      if (!contains(target, targetX) || contains(source, targetX)) continue;
      const edge = airEdge('fall', { x: edgeX, y: source.y }, { x: targetX, y: target.y }, source.id, target.id, options);
      if (clearFlight(edge, platforms, options)) edges.push(edge);
      else if (source.bottom !== undefined) {
        const takeoffX = interior(source, edgeX, options.inset);
        for (const extra of [0, 30, 60, 90, 140]) {
          const landingX = edgeX + direction * (options.bodyRadius + options.inset + 3 + extra);
          if (!contains(target, landingX)) continue;
          const hop = airEdge('jump', { x: takeoffX, y: source.y }, { x: landingX, y: target.y }, source.id, target.id, options);
          if (Math.abs(landingX - takeoffX) / hop.duration > Math.max(100, options.walkSpeed * 2.8)) continue;
          if (clearFlight(hop, platforms, options)) { edges.push(hop); break; }
        }
      }
    }
  }
  // A ladder is needed only when a short jump cannot make this vertical transfer.
  // No diagonal climbing: both ends have the identical X on real supports.
  if (!edges.length && rise > EPSILON && target.bottom !== undefined) {
    // A visible ladder occupies a clear side alley. Its top is still outside the
    // bubble: an explicit ballistic hop, never a diagonal glide, lands on the lip.
    for (const direction of [-1, 1]) {
      const edgeX = direction < 0 ? target.left : target.right;
      const x = edgeX + direction * (options.bodyRadius + options.inset + 3);
      if (!contains(source, x)) continue;
      const from = { x, y: source.y }, to = { x, y: target.y };
      if (!clearBodyLine(from, to, platforms, options)) continue;
      const landing = { x: interior(target, edgeX, options.inset + options.bodyRadius), y: target.y };
      const continuation = airEdge('jump', to, landing, `ladder:${target.id}`, target.id, options);
      if (!clearFlight(continuation, platforms, options)) continue;
      edges.push({ kind: 'ladder', from, to, duration: rise / options.climbSpeed, distance: rise, fromPlatformId: source.id, platformId: target.id, ladder: { x, top: target.y, bottom: source.y }, continuation });
    }
  }
  if (!edges.length && target.bottom === undefined && overlapRight - overlapLeft >= Math.min(options.inset * 2, 12) && Math.abs(rise) > EPSILON) {
    for (const x of [overlapRight - Math.min(options.inset, (overlapRight - overlapLeft) / 2), overlapLeft + Math.min(options.inset, (overlapRight - overlapLeft) / 2)]) {
      const top = Math.min(source.y, target.y), bottom = Math.max(source.y, target.y);
      const intercepted = platforms.some(p => p.id !== source.id && p.id !== target.id && contains(p, x) && p.y > top + EPSILON && p.y < bottom - EPSILON);
      if (intercepted || !clearBodyLine({ x, y: source.y }, { x, y: target.y }, platforms, options)) continue;
      edges.push({ kind: 'ladder', from: { x, y: source.y }, to: { x, y: target.y }, duration: Math.abs(rise) / options.climbSpeed, distance: Math.abs(rise), fromPlatformId: source.id, platformId: target.id, ladder: { x, top, bottom } });
    }
  }
  return edges;
}

export function planRoute(input: { from: Point; fromPlatformId?: string; toPlatformId: string; toX?: number; platforms: readonly Platform[]; options?: NavigationOptions }): Route {
  const options = { ...defaults, ...input.options };
  for (const key of Object.keys(options) as Array<keyof typeof options>) options[key] = Math.max(.001, options[key]);
  const platforms = clean(input.platforms);
  const target = platforms.find(p => p.id === input.toPlatformId);
  const segments: RouteSegment[] = [];
  let current = { ...input.from }, duration = 0;
  let support = platforms.find(p => p.id === input.fromPlatformId && contains(p, current.x) && Math.abs(p.y - current.y) < .5) || onPlatform(current, platforms);
  const add = (edge: Edge) => { const { continuation: _continuation, ...segment } = edge; segments.push({ ...segment, from: { ...edge.from }, to: { ...edge.to }, start: duration }); duration += edge.duration; current = { ...edge.to }; };
  const finish = (complete: boolean): Route => ({ segments, duration, initial: { ...input.from }, final: current, supportId: support?.id, complete, stride: options.stride });
  if (!target) return finish(false);
  if (!support) {
    const below = supportBelow(current, platforms);
    if (!below) return finish(false);
    if (below.y > current.y + EPSILON) add(airEdge('fall', current, { x: current.x, y: below.y }, undefined, below.id, options));
    support = below;
  }
  const walk = (x: number, platform: Platform) => {
    const distance = Math.abs(x - current.x);
    if (distance > EPSILON) add({ kind: 'walk', from: current, to: { x, y: platform.y }, duration: distance / options.walkSpeed, distance, fromPlatformId: platform.id, platformId: platform.id });
  };
  // Each graph node carries its arrival X, so path costs include walking to the next transfer.
  const costs = new Map<string, number>([[support.id, 0]]);
  const positions = new Map<string, Point>([[support.id, current]]);
  const parents = new Map<string, { from: string; edge: Edge }>();
  const visited = new Set<string>();
  while (visited.size < platforms.length) {
    const source = platforms.filter(p => !visited.has(p.id) && costs.has(p.id)).sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
    if (!source || source.id === target.id) break;
    visited.add(source.id);
    for (const destination of platforms) {
      if (destination.id === source.id || visited.has(destination.id)) continue;
      for (const edge of transfers(source, destination, platforms, options)) {
        if (!clearBodyLine(positions.get(source.id)!, edge.from, platforms, options)) continue;
        const cost = costs.get(source.id)! + Math.abs(positions.get(source.id)!.x - edge.from.x) / options.walkSpeed + edge.duration + (edge.continuation?.duration || 0);
        if (cost + EPSILON < (costs.get(destination.id) ?? Infinity)) { costs.set(destination.id, cost); positions.set(destination.id, edge.continuation?.to || edge.to); parents.set(destination.id, { from: source.id, edge }); }
      }
    }
  }
  if (!costs.has(target.id)) return finish(false);
  const path: Edge[] = [];
  let node = target.id;
  while (node !== support.id) {
    const parent = parents.get(node);
    if (!parent) return finish(false);
    path.unshift(parent.edge); node = parent.from;
  }
  for (const edge of path) { walk(edge.from.x, support); add(edge); if (edge.continuation) add(edge.continuation); support = platforms.find(p => p.id === edge.platformId)!; }
  const finalX = interior(target, input.toX ?? (target.left + target.right) / 2, options.inset);
  if (!clearBodyLine(current, { x: finalX, y: target.y }, platforms, options)) return finish(false);
  walk(finalX, target);
  return finish(true);
}

export function sampleRoute(route: Route, seconds: number): RouteSample {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalGait = route.segments.reduce((sum, segment) => sum + (segment.kind === 'walk' || segment.kind === 'ladder' ? segment.distance : 0), 0);
  const lastMoving = [...route.segments].reverse().find(segment => Math.abs(segment.to.x - segment.from.x) > EPSILON);
  const defaultFacing = lastMoving && lastMoving.to.x < lastMoving.from.x ? -1 : 1;
  if (time >= route.duration || !route.segments.length) return { position: { ...route.final }, velocity: { x: 0, y: 0 }, kind: 'idle', facing: defaultFacing, grounded: !!route.supportId, supportId: route.supportId, gaitDistance: totalGait, gaitPhase: gait(totalGait, route.stride).phase, progress: 1, done: true };
  const index = route.segments.findIndex(segment => time < segment.start + segment.duration);
  const segment = route.segments[Math.max(0, index)];
  const elapsed = clamp(time - segment.start, 0, segment.duration), progress = elapsed / segment.duration;
  const position = { x: segment.from.x + (segment.to.x - segment.from.x) * progress, y: segment.from.y + (segment.to.y - segment.from.y) * progress };
  const velocity = { x: (segment.to.x - segment.from.x) / segment.duration, y: (segment.to.y - segment.from.y) / segment.duration };
  const flying = segment.kind === 'jump' || segment.kind === 'fall';
  if (flying) { position.y = segment.from.y + (segment.velocityY || 0) * elapsed + .5 * (segment.gravity || NAVIGATION_GRAVITY) * elapsed * elapsed; velocity.y = (segment.velocityY || 0) + (segment.gravity || NAVIGATION_GRAVITY) * elapsed; }
  const previousDistance = route.segments.slice(0, index).reduce((sum, item) => sum + (item.kind === 'walk' || item.kind === 'ladder' ? item.distance : 0), 0);
  const gaitDistance = previousDistance + (flying ? 0 : segment.distance * progress);
  return { position, velocity, kind: segment.kind, facing: velocity.x < -EPSILON ? -1 : velocity.x > EPSILON ? 1 : defaultFacing, grounded: segment.kind === 'walk', supportId: segment.kind === 'walk' ? segment.fromPlatformId : undefined, ladder: segment.ladder, gaitDistance, gaitPhase: gait(gaitDistance, route.stride).phase, progress, done: false };
}
