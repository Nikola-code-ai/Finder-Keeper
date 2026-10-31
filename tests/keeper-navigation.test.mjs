import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampToViewport, gait, planRoute, sampleRoute, stepGravity, supportBelow } from '../lib/keeper-navigation.ts';

const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < .00001, `${message}: ${actual} != ${expected}`);
const platform = (id, left, right, y, kind = 'folder') => ({ id, left, right, y, kind });
const floor = platform('floor', 0, 1200, 800, 'floor');
const worlds = [platform('folder-low', 60, 430, 510), platform('folder-high', 60, 430, 370), platform('composer', 700, 1120, 360, 'composer'), floor];

test('swept gravity lands on the first crossed top, even with a long delayed frame', () => {
  const result = stepGravity({ x: 200, y: 100 }, { x: 0, y: 20 }, 3, worlds);
  assert.equal(result.supportId, 'folder-high');
  assert.equal(result.landed, true);
  near(result.position.y, 370); near(result.velocity.y, 0);
});

test('collision uses X at crossing instead of X at the end of a long frame', () => {
  const target = platform('narrow', 45, 55, 100);
  const result = stepGravity({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, [target], 800);
  assert.equal(result.supportId, 'narrow'); near(result.position.x, 50);
});

test('a drop below a platform cannot snap upward; a lateral miss falls to floor', () => {
  assert.equal(supportBelow({ x: 200, y: 390 }, worlds)?.id, 'folder-low');
  assert.equal(stepGravity({ x: 200, y: 390 }, { x: 0, y: 0 }, .1, worlds).landed, false);
  assert.equal(stepGravity({ x: 550, y: 100 }, { x: 0, y: 0 }, 2, worlds).supportId, 'floor');
});

test('an upward jump passes a one-way surface and may land on its downward crossing', () => {
  const ledge = platform('ledge', 0, 100, 150);
  const rising = stepGravity({ x: 50, y: 200 }, { x: 0, y: -400 }, .2, [ledge]);
  assert.equal(rising.landed, false); assert.ok(rising.position.y < 150);
  const landing = stepGravity({ x: 50, y: 200 }, { x: 0, y: -400 }, 1, [ledge]);
  assert.equal(landing.supportId, 'ledge'); near(landing.position.y, 150);
});

test('resize clamps feet safely without inventing a support or invalid range', () => {
  assert.deepEqual(clampToViewport({ x: 500, y: 900 }, { width: 300, height: 400 }, 30), { x: 270, y: 400 });
  assert.deepEqual(clampToViewport({ x: -100, y: -50 }, { width: 20, height: 20 }, 50), { x: 10, y: 0 });
});

test('one full gait cycle includes every drawing and both leading legs', () => {
  const samples = Array.from({ length: 8 }, (_, index) => gait(index * 6 + 1, 48, 8));
  assert.deepEqual(samples.map(sample => sample.frame), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([...new Set(samples.map(sample => sample.lead))], ['left', 'right']);
  assert.equal(gait(48).frame, 0); assert.deepEqual(gait(0), gait(-20));
});

test('route endpoints are continuous and walks/climbs never glide diagonally', () => {
  const route = planRoute({ from: { x: 210, y: 370 }, fromPlatformId: 'folder-high', toPlatformId: 'composer', toX: 1000, platforms: worlds });
  assert.equal(route.complete, true);
  let previous = route.initial;
  for (const segment of route.segments) {
    assert.deepEqual(segment.from, previous);
    if (segment.kind === 'walk') near(segment.from.y, segment.to.y);
    if (segment.kind === 'ladder') {
      near(segment.from.x, segment.to.x);
      assert.ok(worlds.some(p => p.id === segment.fromPlatformId && p.y === segment.from.y && segment.from.x >= p.left && segment.from.x <= p.right));
      assert.ok(worlds.some(p => p.id === segment.platformId && p.y === segment.to.y && segment.to.x >= p.left && segment.to.x <= p.right));
    }
    previous = segment.to;
  }
  assert.deepEqual(route.final, { x: 1000, y: 360 });
  assert.equal(sampleRoute(route, route.duration + 10).supportId, 'composer');
});

test('a short gap uses a jump arc; time samples have actual gravity and no straight glide', () => {
  const platforms = [platform('a', 0, 120, 300), platform('b', 170, 300, 270)];
  const route = planRoute({ from: { x: 70, y: 300 }, fromPlatformId: 'a', toPlatformId: 'b', platforms });
  const jump = route.segments.find(segment => segment.kind === 'jump');
  assert.ok(jump); assert.ok(!route.segments.some(segment => segment.kind === 'ladder'));
  const middle = sampleRoute(route, jump.start + jump.duration / 2);
  assert.ok(middle.position.y < Math.min(jump.from.y, jump.to.y));
  near(middle.velocity.y, jump.velocityY + jump.gravity * jump.duration / 2);
  assert.equal(middle.grounded, false);
});

test('falling onto an intervening platform cannot be skipped to reach a lower target', () => {
  const platforms = [platform('top', 100, 200, 100), platform('middle', 50, 250, 300), floor];
  const route = planRoute({ from: { x: 150, y: 100 }, fromPlatformId: 'top', toPlatformId: 'floor', platforms });
  assert.equal(route.complete, true);
  const firstAir = route.segments.find(segment => segment.kind === 'fall' || segment.kind === 'jump');
  assert.equal(firstAir.platformId, 'middle');
});

test('an unsupported start falls first, and an unreachable target leaves the actor in place', () => {
  const route = planRoute({ from: { x: 200, y: 390 }, toPlatformId: 'composer', platforms: worlds });
  assert.equal(route.segments[0].kind, 'fall'); assert.equal(route.segments[0].platformId, 'folder-low');
  assert.equal(route.complete, true);
  const unsupported = planRoute({ from: { x: 550, y: 100 }, toPlatformId: 'composer', platforms: worlds.filter(p => p.id !== 'floor') });
  assert.equal(unsupported.complete, false); assert.deepEqual(unsupported.final, { x: 550, y: 100 });
});

test('distance drives a full walking and climbing gait, and no gait advances during flight or idle', () => {
  const route = planRoute({ from: { x: 900, y: 800 }, fromPlatformId: 'floor', toPlatformId: 'composer', toX: 900, platforms: worlds });
  const climb = route.segments.find(segment => segment.kind === 'ladder');
  assert.ok(climb);
  const a = sampleRoute(route, climb.start + .2), b = sampleRoute(route, climb.start + .8);
  near(b.gaitDistance - a.gaitDistance, 34 * .6);
  near(a.position.x, b.position.x);
  assert.deepEqual(sampleRoute(route, route.duration + 1), sampleRoute(route, route.duration + 100));
});

test('same-platform recovery only walks, and no-op recovery is stable', () => {
  const route = planRoute({ from: { x: 800, y: 360 }, fromPlatformId: 'composer', toPlatformId: 'composer', toX: 900, platforms: worlds });
  assert.deepEqual(route.segments.map(segment => segment.kind), ['walk']);
  const settled = planRoute({ from: { x: 900, y: 360 }, fromPlatformId: 'composer', toPlatformId: 'composer', toX: 900, platforms: worlds });
  assert.equal(settled.duration, 0); assert.equal(sampleRoute(settled, 0).done, true);
  assert.deepEqual(sampleRoute(settled, 0).position, { x: 900, y: 360 });
});

test('solid UI faces use an outside ladder followed by an explicit hop onto the lip', () => {
  const platforms = [{ ...worlds[2], bottom: 450 }, { ...worlds[0], bottom: 600 }, floor];
  const route = planRoute({ from: { x: 900, y: 800 }, fromPlatformId: 'floor', toPlatformId: 'composer', platforms, options: { actorHeight: 150, bodyRadius: 24 } });
  assert.equal(route.complete, true);
  const ladderIndex = route.segments.findIndex(segment => segment.kind === 'ladder');
  const ladder = route.segments[ladderIndex];
  assert.ok(ladder.from.x + 24 < 700 || ladder.from.x - 24 > 1120);
  assert.equal(route.segments[ladderIndex + 1].kind, 'jump');
  assert.deepEqual(route.segments[ladderIndex + 1].from, ladder.to);
});

test('recovering from a solid folder clears its face before landing on the floor', () => {
  const platforms = [{ ...worlds[2], bottom: 450 }, { ...worlds[0], bottom: 600 }, floor];
  const route = planRoute({ from: { x: 200, y: 510 }, fromPlatformId: 'folder-low', toPlatformId: 'composer', platforms, options: { actorHeight: 150, bodyRadius: 24 } });
  assert.equal(route.complete, true);
  for (let time = 0; time <= route.duration; time += 1 / 60) {
    const { position } = sampleRoute(route, time);
    for (const face of platforms.filter(p => p.bottom !== undefined)) {
      const collides = position.x - 24 < face.right - .01 && position.x + 24 > face.left + .01 && position.y - 150 < face.bottom - .01 && position.y > face.y + .01;
      assert.equal(collides, false, `body intersects ${face.id} at ${time}`);
    }
  }
});

test('blocked side alleys reject a route rather than climbing through a UI face', () => {
  const platforms = [
    { ...platform('composer', 400, 800, 200, 'composer'), bottom: 300 },
    { ...platform('left-wall', 0, 399, 100), bottom: 790 },
    { ...platform('right-wall', 801, 1200, 100), bottom: 790 }, floor,
  ];
  const route = planRoute({ from: { x: 600, y: 800 }, toPlatformId: 'composer', platforms, options: { actorHeight: 150, bodyRadius: 24 } });
  assert.equal(route.complete, false);
  assert.deepEqual(route.final, { x: 600, y: 800 });
});
