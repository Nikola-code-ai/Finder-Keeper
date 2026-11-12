// Laying a reading flow out as a map: the main path runs left to right along the top lane, detours drop
// to the lanes below and rejoin. Pure functions, so the map renders the same on the server and the client.
import type { FlowEdge, FlowGraph, FlowStep, FlowStepKind } from './types';

// The column gap leaves room for a wire's label ("Carry on", "Go deeper") between two cards.
export const NODE = { w: 200, h: 92, colGap: 118, rowGap: 34, pad: 16 };
export const CHECKABLE: FlowStepKind[] = ['start', 'read', 'synthesize', 'note'];
export const isCheckable = (step: FlowStep) => CHECKABLE.includes(step.kind);

export interface Placed { step: FlowStep; depth: number; lane: number; x: number; y: number }
export interface Wire { edge: FlowEdge; from: Placed; to: Placed; path: string; mid: { x: number; y: number } }
export interface Layout { nodes: Placed[]; wires: Wire[]; width: number; height: number; cols: number; lanes: number }

/** Longest path from the sources, so a step sits to the right of everything that leads to it. */
export function depths(graph: FlowGraph): Map<string, number> {
  const ids = graph.steps.map(s => s.id), known = new Set(ids);
  const edges = graph.edges.filter(e => known.has(e.from) && known.has(e.to) && e.from !== e.to);
  const indegree = new Map(ids.map(id => [id, 0]));
  for (const e of edges) indegree.set(e.to, (indegree.get(e.to) || 0) + 1);
  const depth = new Map<string, number>();
  const queue = ids.filter(id => !indegree.get(id));
  for (const id of queue) depth.set(id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.from !== id) continue;
      depth.set(e.to, Math.max(depth.get(e.to) ?? 0, depth.get(id)! + 1));
      indegree.set(e.to, indegree.get(e.to)! - 1);
      if (!indegree.get(e.to)) queue.push(e.to);
    }
  }
  // Anything left is caught in a cycle (hand-edited flows can do that); it lines up after everything placed.
  let tail = Math.max(-1, ...depth.values()) + 1;
  for (const id of ids) if (!depth.has(id)) depth.set(id, tail++);
  return depth;
}

/** Lanes: a step takes the lane of the path that leads to it; a fork's second exit drops one lane. */
export function lanes(graph: FlowGraph, depth: Map<string, number>): Map<string, number> {
  const lane = new Map<string, number>();
  const taken = new Map<number, Set<number>>();
  const outgoing = (id: string) => graph.edges.filter(e => e.from === id && e.to !== id);
  const ordered = [...graph.steps].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || graph.steps.indexOf(a) - graph.steps.indexOf(b));
  for (const step of ordered) {
    const d = depth.get(step.id)!;
    const candidates = graph.edges.filter(e => e.to === step.id && lane.has(e.from) && depth.get(e.from)! < d).map(e => lane.get(e.from)! + outgoing(e.from).findIndex(o => o.to === step.id));
    let l = candidates.length ? Math.min(...candidates) : 0;
    const used = taken.get(d) || new Set<number>();
    while (used.has(l)) l++;
    used.add(l); taken.set(d, used); lane.set(step.id, l);
  }
  return lane;
}

export function wirePath(from: Placed, to: Placed, size = NODE): { path: string; mid: { x: number; y: number } } {
  const x1 = from.x + size.w, y1 = from.y + size.h / 2, x2 = to.x, y2 = to.y + size.h / 2;
  if (x2 <= x1) {
    // A backward wire (only in a hand-edited loop) swings under both steps.
    const dip = Math.max(from.y, to.y) + size.h + 24;
    return { path: `M${x1} ${y1} C${x1 + 40} ${dip} ${x2 - 40} ${dip} ${x2} ${y2}`, mid: { x: (x1 + x2) / 2, y: dip - 6 } };
  }
  const cx = (x1 + x2) / 2;
  return { path: `M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`, mid: { x: cx, y: (y1 + y2) / 2 } };
}

export function layoutFlow(graph: FlowGraph, size = NODE): Layout {
  const depth = depths(graph), lane = lanes(graph, depth);
  const nodes: Placed[] = graph.steps.map(step => {
    const d = depth.get(step.id)!, l = lane.get(step.id)!;
    return { step, depth: d, lane: l, x: size.pad + d * (size.w + size.colGap), y: size.pad + l * (size.h + size.rowGap) };
  });
  const byId = new Map(nodes.map(n => [n.step.id, n]));
  const wires: Wire[] = graph.edges.flatMap(edge => {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    return from && to && from !== to ? [{ edge, from, to, ...wirePath(from, to, size) }] : [];
  });
  const cols = Math.max(0, ...nodes.map(n => n.depth)) + 1, laneCount = Math.max(0, ...nodes.map(n => n.lane)) + 1;
  return { nodes, wires, cols, lanes: laneCount, width: size.pad * 2 + cols * size.w + (cols - 1) * size.colGap, height: size.pad * 2 + laneCount * size.h + (laneCount - 1) * size.rowGap };
}

export interface Progress { done: Set<string>; satisfied: Set<string>; available: Set<string>; next: string[]; total: number; completed: number; complete: boolean }

/**
 * Where a reader stands. A step is available once any path into it is satisfied: a done step satisfies, a fork passes
 * satisfaction through, and the start is always open. Untaken detours never hold a flow back.
 */
export function progressOf(graph: FlowGraph, done: Iterable<string>): Progress {
  const ticked = new Set(done);
  const ids = new Set(graph.steps.map(s => s.id));
  const kind = new Map(graph.steps.map(s => [s.id, s.kind]));
  const preds = (id: string) => graph.edges.filter(e => e.to === id && ids.has(e.from) && e.from !== id).map(e => e.from);
  const satisfied = new Set<string>();
  const sources = graph.steps.filter(s => !preds(s.id).length).map(s => s.id);
  let changed = true, rounds = 0;
  while (changed && rounds++ < ids.size + 2) {
    changed = false;
    for (const id of ids) {
      if (satisfied.has(id)) continue;
      const k = kind.get(id);
      const fed = preds(id).some(p => satisfied.has(p));
      if (ticked.has(id) || k === 'start' || (k === 'choice' && (fed || sources.includes(id)))) { satisfied.add(id); changed = true; }
    }
  }
  const available = new Set<string>();
  for (const id of ids) if (sources.includes(id) || preds(id).some(p => satisfied.has(p))) available.add(id);
  const checkable = graph.steps.filter(s => isCheckable(s) && s.kind !== 'start');
  const next = graph.steps.filter(s => isCheckable(s) && available.has(s.id) && !ticked.has(s.id)).map(s => s.id);
  return { done: ticked, satisfied, available, next, total: checkable.length, completed: checkable.filter(s => ticked.has(s.id)).length, complete: ticked.has('finish') || (checkable.length > 0 && checkable.every(s => ticked.has(s.id))) };
}

/** Reading order for the checklist: the steps as listed, which the planner writes in walking order. */
export function readingOrder(graph: FlowGraph): FlowStep[] {
  const depth = depths(graph);
  return [...graph.steps].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || graph.steps.indexOf(a) - graph.steps.indexOf(b));
}
