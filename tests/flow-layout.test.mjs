import assert from 'node:assert/strict';
import { test } from 'node:test';
import { depths, lanes, layoutFlow, progressOf, readingOrder, wirePath, NODE } from '../lib/flow-layout.ts';

// start → s1 → c1 ⇒ (carry on) s2 → finish
//                  ⇒ (go deeper) s3 → s2
const graph = {
  steps: [
    { id: 'start', kind: 'start', title: 'Begin' },
    { id: 's1', kind: 'read', title: 'First' },
    { id: 'c1', kind: 'choice', title: 'Deeper?' },
    { id: 's3', kind: 'read', title: 'Detour', detour: true },
    { id: 's2', kind: 'read', title: 'Second' },
    { id: 'finish', kind: 'synthesize', title: 'Together' },
  ],
  edges: [
    { from: 'start', to: 's1', label: 'Start here' }, { from: 's1', to: 'c1' },
    { from: 'c1', to: 's2', label: 'Carry on' }, { from: 'c1', to: 's3', label: 'Go deeper' },
    { from: 's3', to: 's2' }, { from: 's2', to: 'finish' },
  ],
};

test('depth is the longest path in, so a step waits to the right of its detour', () => {
  const d = depths(graph);
  assert.deepEqual(Object.fromEntries(d), { start: 0, s1: 1, c1: 2, s3: 3, s2: 4, finish: 5 });
});

test('the main path keeps the top lane and the detour drops one lane', () => {
  const l = lanes(graph, depths(graph));
  assert.equal(l.get('start'), 0); assert.equal(l.get('s1'), 0); assert.equal(l.get('c1'), 0);
  assert.equal(l.get('s2'), 0, 'carry on stays on the main lane');
  assert.equal(l.get('s3'), 1, 'go deeper is the second exit of the fork');
  assert.equal(l.get('finish'), 0);
});

test('two steps that would share a cell stack into separate lanes', () => {
  const twins = { steps: [{ id: 'a', kind: 'read', title: 'A' }, { id: 'b', kind: 'read', title: 'B' }, { id: 'c', kind: 'read', title: 'C' }], edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }] };
  const l = lanes(twins, depths(twins));
  assert.deepEqual([l.get('b'), l.get('c')], [0, 1]);
});

test('layout sizes the canvas to its columns and lanes and wires every edge between placed steps', () => {
  const layout = layoutFlow(graph);
  assert.equal(layout.cols, 6); assert.equal(layout.lanes, 2);
  assert.equal(layout.width, NODE.pad * 2 + 6 * NODE.w + 5 * NODE.colGap);
  assert.equal(layout.height, NODE.pad * 2 + 2 * NODE.h + NODE.rowGap);
  assert.equal(layout.wires.length, graph.edges.length);
  const detour = layout.wires.find(w => w.edge.label === 'Go deeper');
  assert.ok(detour.to.y > detour.from.y, 'the detour wire runs downward');
  assert.match(detour.path, /^M[\d.]+ [\d.]+ C/);
});

test('a backward wire swings under both steps instead of crossing them', () => {
  const a = { step: { id: 'a', kind: 'read', title: 'a' }, depth: 1, lane: 0, x: 300, y: 16 };
  const b = { step: { id: 'b', kind: 'read', title: 'b' }, depth: 0, lane: 0, x: 16, y: 16 };
  const { path, mid } = wirePath(a, b);
  assert.ok(mid.y > a.y + NODE.h, 'the label sits in the dip below');
  assert.match(path, /^M500 62 C540 /);
});

test('a cycle left by a hand edit still places every step', () => {
  const loop = { steps: [{ id: 'a', kind: 'read', title: 'A' }, { id: 'b', kind: 'read', title: 'B' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] };
  const d = depths(loop);
  assert.deepEqual([...d.values()].sort(), [0, 1]);
  assert.equal(layoutFlow(loop).nodes.length, 2);
});

test('progress opens a step once any path into it is done, and an untaken detour never blocks the finish', () => {
  const fresh = progressOf(graph, []);
  assert.deepEqual(fresh.next, ['start', 's1'], 'the start is always open and so is the first reading');
  assert.equal(fresh.total, 4, 'three readings and the synthesis; the start is a doorway, not a task');
  const read = progressOf(graph, ['s1']);
  assert.ok(read.available.has('s2') && read.available.has('s3'), 'the fork opens both exits');
  assert.ok(!read.available.has('finish'));
  assert.deepEqual(read.next, ['start', 's3', 's2']);
  const skipped = progressOf(graph, ['start', 's1', 's2']);
  assert.ok(skipped.available.has('finish'));
  assert.deepEqual(skipped.next, ['s3', 'finish']);
  const done = progressOf(graph, ['start', 's1', 's2', 'finish']);
  assert.equal(done.complete, true); assert.equal(done.completed, 3, 'the untaken detour is not counted against the reader');
  assert.equal(progressOf(graph, ['s1', 's2', 's3']).complete, false);
});

test('reading order follows depth, with the detour before the step it rejoins', () => {
  assert.deepEqual(readingOrder(graph).map(s => s.id), ['start', 's1', 'c1', 's3', 's2', 'finish']);
});
