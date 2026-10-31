import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bodyBounds, blockingMove, canChangeDepth, createWorld, DRAWING_FPS, frameClock,
  GRAVITY, idleBeat, libraryCheckEnd, nextLanding, placeDrawing, placeLadder, planArrival, planPending, plantedProgress, safePerch, sampleJourney,
} from '../lib/keeper-choreography.ts';

const shelf = Object.freeze({ left: 140, top: 290, width: 460, height: 82 });
const makeWorld = (extra = {}) => createWorld({ width: 1280, height: 900, actorHeight: 218, platforms: [{ id: 'home', rect: shelf }], floorY: 740, ...extra });
const near = (a, b, message = '') => assert.ok(Math.abs(a - b) < .00001, `${message}: ${a} != ${b}`);
const intersects = (a, b) => a.left < b.left + b.width - .01 && a.left + a.width > b.left + .01 && a.top < b.top + b.height - .01 && a.top + a.height > b.top + .01;
const phaseTime = (plan, phase, fraction = .5) => {
  const segment = plan.segments.find(item => item.phase === phase);
  assert.ok(segment, `missing phase ${phase}`);
  return segment.start + segment.duration * fraction + 1 / DRAWING_FPS;
};
const assertContinuous = plan => {
  let previous = plan.initial;
  for (const segment of plan.segments) {
    near(segment.from.at.x, previous.at.x, `${segment.phase} x`);
    near(segment.from.at.y, previous.at.y, `${segment.phase} y`);
    near(segment.from.depth || 0, previous.depth || 0, `${segment.phase} depth`);
    assert.equal(segment.from.pin, 'feet'); assert.equal(segment.to.pin, 'feet');
    previous = segment.to;
  }
  near(plan.final.at.x, previous.at.x); near(plan.final.at.y, previous.at.y);
};

test('the seated standby frame is completely frozen even after a long wait', () => {
  assert.deepEqual(idleBeat(shelf, 0), idleBeat(shelf, 19));
  assert.deepEqual(idleBeat(shelf, 0), idleBeat(shelf, 60000));
  assert.equal(idleBeat(shelf, 20).frameTime, 0);
});

test('planted steps pause at either end and progress without reversal', () => {
  for (let step = 0; step < 4; step++) {
    near(plantedProgress((step + .1) / 4, 4), step / 4);
    near(plantedProgress((step + .9) / 4, 4), (step + 1) / 4);
  }
  let previous = 0;
  for (let n = 0; n <= 1000; n++) {
    const p = plantedProgress(n / 1000, 6); assert.ok(p >= previous && p <= 1); previous = p;
  }
});

test('horizontal swept collisions stop the body before a thin opaque button', () => {
  const world = makeWorld({ obstacles: [{ id: 'button', rect: { left: 900, top: 550, width: 12, height: 180 } }] });
  const result = blockingMove(world, { x: 700, y: 740 }, 1150);
  assert.equal(result.blockedBy, 'button');
  assert.ok(bodyBounds(world, result.at).left + bodyBounds(world, result.at).width < 900);
  const reverse = blockingMove(world, { x: 1100, y: 740 }, 700);
  assert.equal(reverse.blockedBy, 'button');
  assert.ok(bodyBounds(world, reverse.at).left > 912);
});

test('a front-plane character cannot cross a folder but may walk on its top', () => {
  const world = makeWorld();
  assert.equal(blockingMove(world, { x: 60, y: 400 }, 700).blockedBy, 'home');
  assert.equal(blockingMove(world, { x: 180, y: 290 }, 520).blockedBy, undefined);
  assert.equal(blockingMove(world, { x: 60, y: 400 }, 700, 1).blockedBy, undefined);
});

test('gravity selects the next eligible platform and then the floor', () => {
  const world = makeWorld({ platforms: [
    { id: 'top', rect: { left: 100, top: 200, width: 300, height: 60 } },
    { id: 'middle', rect: { left: 100, top: 390, width: 490, height: 60 } },
    { id: 'bottom', rect: { left: 100, top: 580, width: 600, height: 60 } },
  ] });
  assert.deepEqual(nextLanding(world, { x: 455, y: 200 }), { y: 390, supportId: 'middle' });
  assert.deepEqual(nextLanding(world, { x: 645, y: 390 }), { y: 580, supportId: 'bottom' });
  assert.deepEqual(nextLanding(world, { x: 760, y: 580 }), { y: 740, supportId: 'floor' });
  assert.deepEqual(nextLanding(world, { x: 455, y: 200 }, 1), { y: 740, supportId: 'floor' });
});

test('a depth transition requires the whole body to clear the shelf and opaque controls', () => {
  const world = makeWorld();
  assert.equal(canChangeDepth(world, { x: 550, y: 740 }), false);
  assert.equal(canChangeDepth(world, { x: 620, y: 740 }), false);
  assert.equal(canChangeDepth(world, { x: 680, y: 740 }), true);
  const obstructed = makeWorld({ obstacles: [{ id: 'control', rect: { left: 660, top: 590, width: 40, height: 70 } }] });
  assert.equal(canChangeDepth(obstructed, { x: 680, y: 740 }), false);
});

test('pending search uses supported edges, real gravity, landing, then a legal depth turn', () => {
  const world = makeWorld(); const plan = planPending(world, 'home', 'search');
  assertContinuous(plan);
  const fall = plan.segments.find(segment => segment.kind === 'fall');
  assert.ok(fall); assert.ok(fall.from.at.x - world.halfWidth > shelf.left + shelf.width);
  near(fall.to.at.y, world.floorY);
  const time = fall.start + fall.duration * .5 + .01;
  const sampled = sampleJourney(plan, time);
  const elapsed = frameClock(time) - fall.start;
  assert.equal(sampled.phase, 'falling'); assert.equal(sampled.grounded, false);
  near(sampled.at.y, fall.from.at.y + (fall.from.velocityY || 0) * elapsed + .5 * GRAVITY * elapsed * elapsed);
  assert.ok(sampled.velocityY > 0);
  const turn = plan.segments.find(segment => segment.kind === 'turn');
  assert.ok(canChangeDepth(world, turn.from.at));
  const search = sampleJourney(plan, phaseTime(plan, 'searching-behind-glass'));
  assert.equal(search.depth, 1); assert.equal(search.behind, true); assert.equal(search.supportId, 'floor');
});

test('active front-plane travel never intersects a solid folder', () => {
  const world = makeWorld(); const plan = planPending(world, 'home', 'search');
  for (let t = 0; t < plan.duration; t += 1 / DRAWING_FPS) {
    const beat = sampleJourney(plan, t);
    if ((beat.depth || 0) > 0 || beat.phase === 'getting-up') continue;
    assert.equal(intersects(bodyBounds(world, beat.at), shelf), false, `${beat.phase} at ${t}`);
  }
});

test('departure clears the full image before hiding and return walks back from that same edge', () => {
  const world = makeWorld(); const plan = planPending(world, 'home', 'discover');
  const off = plan.segments.find(item => item.phase === 'off-page');
  const returning = plan.segments.find(item => item.phase === 'returning-behind-glass');
  assert.ok(off.to.hidden); assert.ok(off.from.at.x + world.actorHeight * .8 < 0);
  near(returning.from.at.x, off.to.at.x); near(returning.from.at.y, off.to.at.y);
  assert.equal(returning.to.hidden, false);
  assert.ok(returning.to.at.x > returning.from.at.x);
});

test('arrival and cancellation preserve the actual interrupted location and depth', () => {
  const world = makeWorld(); const pending = planPending(world, 'home', 'discover');
  for (const phase of ['getting-up', 'falling', 'rounding-back-edge', 'searching-behind-glass', 'off-page', 'returning-behind-glass']) {
    const interrupted = sampleJourney(pending, phaseTime(pending, phase, .35));
    for (const outcome of ['success', 'empty', 'error', 'cancelled']) {
      const arrival = planArrival(world, 'home', interrupted, outcome, 'discover');
      near(arrival.initial.at.x, interrupted.at.x); near(arrival.initial.at.y, interrupted.at.y);
      near(arrival.initial.depth || 0, interrupted.depth || 0);
      assertContinuous(arrival);
      assert.notEqual(arrival.segments[0]?.to.phase, 'resting', 'an interrupted actor cannot teleport straight to the chair');
      assert.equal(arrival.final.hidden, false);
      assert.equal(arrival.final.displacement, undefined);
    }
  }
});

test('an interrupted fall retains downward velocity instead of hovering on completion', () => {
  const world = makeWorld(); const pending = planPending(world, 'home', 'search');
  const start = sampleJourney(pending, phaseTime(pending, 'falling', .35));
  const returnPlan = planArrival(world, 'home', start, 'cancelled', 'search');
  const fall = returnPlan.segments.find(item => item.kind === 'fall');
  assert.ok(fall); assert.ok(fall.from.velocityY > 0);
  assert.ok(fall.duration < Math.sqrt(2 * (fall.to.at.y - fall.from.at.y) / GRAVITY));
});

test('returning climbs with an explicit visible ladder then settles without changing feet anchor', () => {
  const world = makeWorld(); const pending = planPending(world, 'home', 'search');
  const start = sampleJourney(pending, phaseTime(pending, 'searching-behind-glass'));
  const arrival = planArrival(world, 'home', start, 'success', 'search');
  assertContinuous(arrival);
  const climb = arrival.segments.filter(item => item.kind === 'climb');
  assert.ok(climb.length > 0);
  for (const segment of climb) {
    assert.equal(segment.to.supportId, 'ladder:home');
    assert.equal(segment.to.pose, 'climb');
    assert.equal(segment.to.ladder.progress, 1);
    assert.ok(segment.to.at.y < segment.from.at.y);
    assert.ok(segment.to.at.x - world.halfWidth > shelf.left + shelf.width || segment.to.at.x + world.halfWidth < shelf.left);
  }
  const final = sampleJourney(arrival, 300);
  assert.equal(final.phase, 'resting'); assert.equal(final.pose, 'idle'); assert.equal(final.frameTime, 0);
  assert.equal(final.grounded, true); assert.equal(final.supportId, 'home'); assert.equal(final.done, true);
});

test('a blocker stops a route rather than permitting a portal through the button', () => {
  const world = makeWorld({ obstacles: [{ id: 'control', rect: { left: 615, top: 170, width: 25, height: 90 } }, { id: 'left-control', rect: { left: 110, top: 170, width: 25, height: 90 } }] });
  const plan = planPending(world, 'home', 'search');
  assert.ok(plan.segments.some(segment => segment.phase === 'blocked-by-control'));
  assert.equal(plan.final.depth, 0);
  assert.ok(bodyBounds(world, plan.final.at).left + bodyBounds(world, plan.final.at).width < 615);
});

test('drawings and movement hold between ticks, including long static waits', () => {
  const plan = planPending(makeWorld(), 'home', 'search');
  for (const tick of [12, 24, 29, 36, 44, 73, 89]) {
    assert.deepEqual(sampleJourney(plan, tick / DRAWING_FPS + .005), sampleJourney(plan, tick / DRAWING_FPS + .5 / DRAWING_FPS));
  }
  assert.deepEqual(sampleJourney(plan, 1000), sampleJourney(plan, 6000));
});

test('mirroring preserves the selected drawing anchor and does not alter world geometry', () => {
  const anchor = [.76, .53]; const at = { x: 612, y: 317 };
  for (const facing of [1, -1]) {
    const result = placeDrawing(at, anchor, 156, 218, facing);
    near(result.x + (facing === 1 ? anchor[0] : 1 - anchor[0]) * 156, at.x);
    near(result.y + anchor[1] * 218, at.y);
  }
  const input = { id: 'home', rect: shelf }; const original = structuredClone(input);
  planPending(createWorld({ width: 1280, height: 900, actorHeight: 218, platforms: [input] }), 'home', 'ask');
  assert.deepEqual(input, original);
});


test('a narrow right corridor routes around the left instead of clipping a result card', () => {
  const result = { left: 680, top: 350, width: 350, height: 450 };
  const world = makeWorld({ obstacles: [{ id: 'result', rect: result }] });
  const plan = planPending(world, 'home', 'discover');
  const turn = plan.segments.find(segment => segment.kind === 'turn');
  assert.ok(turn); assert.ok(turn.from.at.x < shelf.left);
  assert.ok(plan.segments.some(segment => segment.phase === 'searching-behind-glass'));
  for (let t = 0; t < plan.duration; t += 1 / DRAWING_FPS) {
    const beat = sampleJourney(plan, t);
    if ((beat.depth || 0) > 0 || beat.phase === 'getting-up') continue;
    assert.equal(intersects(bodyBounds(world, beat.at), result), false);
  }
  const returning = planArrival(world, 'home', sampleJourney(plan, phaseTime(plan, 'searching-behind-glass')), 'success', 'discover');
  assert.equal(returning.final.phase, 'waiting-for-clear-ladder');
  assert.equal(returning.final.supportId, 'floor');
  assert.ok(returning.segments.filter(segment => segment.kind === 'turn').every(segment => segment.from.at.x < shelf.left));
});


test('a step off the edge has an upward arc and clears the slab before descending', () => {
  const world = makeWorld(); const plan = planPending(world, 'home', 'search');
  const hop = plan.segments.find(segment => segment.kind === 'hop');
  assert.ok(hop); assert.ok(hop.from.at.x < shelf.left + shelf.width);
  const mid = sampleJourney(plan, hop.start + hop.duration * .5 + .03);
  assert.equal(mid.phase, 'stepping-off-edge'); assert.equal(mid.grounded, false);
  assert.ok(mid.at.y < shelf.top);
  assert.ok(hop.to.at.x - world.halfWidth > shelf.left + shelf.width);
});


test('the measured main room crawls clear of Add new, exits left, and returns without touching controls', () => {
  const home = { left: 64, top: 572.75, width: 548.421875, height: 82 };
  const obstacles = [
    { id: 'sort', rect: { left: 480, top: 422, width: 30, height: 34 } },
    { id: 'heading', rect: { left: 64, top: 431.75, width: 63.906, height: 16 } },
    { id: 'count', rect: { left: 136.906, top: 430.25, width: 20, height: 19 } },
    { id: 'back', rect: { left: 64, top: 424.75, width: 30, height: 30 } },
    { id: 'add', rect: { left: 519, top: 422, width: 93, height: 34 } },
    { id: 'composer', rect: { left: 64, top: 204.75, width: 1137, height: 151 } },
    ...[469.75, 535.75, 601.75, 667.75].map((top, index) => ({ id: `result${index}`, rect: { left: 703.421875, top, width: 481.58, height: 66 } })),
  ];
  const world = createWorld({ width: 1280, height: 720, actorHeight: 218, platforms: [{ id: 'home', rect: home }, { id: 'next', rect: { left: 64, top: 670.75, width: 548.421875, height: 49.25 } }], obstacles });
  assert.ok(safePerch(world, 'home').x < 420);
  const pending = planPending(world, 'home', 'search');
  assert.equal(pending.segments[0].phase, 'ducking-under-control');
  assert.ok(pending.segments.some(segment => segment.phase === 'walking-on-shelf' && segment.to.pose === 'crawl'));
  assert.equal(pending.segments.some(segment => segment.kind === 'walk' && segment.to.pose === 'idle'), false);
  assert.ok(pending.segments.some(segment => segment.phase === 'searching-behind-glass'));
  assert.ok(pending.segments.some(segment => segment.phase === 'ducking-under-control'));
  assert.ok(pending.segments.find(segment => segment.kind === 'hop').to.crouched);
  const returnPlan = planArrival(world, 'home', sampleJourney(pending, pending.duration + 1), 'success', 'search');
  assert.equal(returnPlan.final.phase, 'waiting-for-clear-ladder');
  assert.equal(returnPlan.final.supportId, 'floor');
  for (const plan of [pending, returnPlan]) {
    assertContinuous(plan);
    for (let t = 0; t <= plan.duration; t += 1 / DRAWING_FPS) {
      const beat = sampleJourney(plan, t);
      if ((beat.depth || 0) > .5) continue;
      const box = bodyBounds(world, beat.at, beat.depth, beat.pose, beat.crouched);
      for (const obstacle of obstacles) assert.equal(intersects(box, obstacle.rect), false, `${beat.phase} hits ${obstacle.id} at ${t}`);
    }
  }
});

test('fast completion during a crawl keeps its real support instead of falling through it', () => {
  const world = makeWorld({ obstacles: [{ id: 'add', rect: { left: 490, top: 150, width: 110, height: 30 } }] });
  const pending = planPending(world, 'home', 'search');
  const shuffle = pending.segments.find(segment => segment.phase === 'walking-on-shelf');
  assert.ok(shuffle);
  const start = sampleJourney(pending, shuffle.start + shuffle.duration * .5);
  assert.equal(start.pose, 'crawl');
  assert.ok(start.gaitDistance > 0);
  for (const outcome of ['success', 'empty', 'error', 'cancelled']) {
    const arrival = planArrival(world, 'home', start, outcome, 'search');
    assert.equal(arrival.final.phase, 'resting');
    assert.equal(arrival.final.supportId, 'home');
    assert.equal(arrival.segments.some(segment => segment.kind === 'fall'), false);
    near(arrival.initial.at.x, start.at.x); near(arrival.initial.at.y, start.at.y);
    assertContinuous(arrival);
  }
  const restarted = planPending(world, 'home', 'search', start);
  assert.ok(restarted.segments.some(segment => segment.to.pose === 'crawl'));
  const fallX = restarted.segments.find(segment => segment.kind === 'fall')?.from.at.x;
  if (fallX !== undefined) assert.ok(fallX < shelf.left - world.halfWidth || fallX > shelf.left + shelf.width + world.halfWidth);
  else assert.equal(restarted.final.supportId, 'home');
});

test('a removed shelf releases a seated character into gravity instead of preserving imaginary support', () => {
  const world = makeWorld();
  const pending = planPending(world, 'home', 'search');
  const resting = planArrival(world, 'home', sampleJourney(pending, pending.duration + 1), 'success', 'search').final;
  const withoutShelf = createWorld({ width: 1280, height: 900, actorHeight: 218, platforms: [{ id: 'lower', rect: { left: 140, top: 500, width: 460, height: 82 } }], floorY: 740 });
  const arrival = planArrival(withoutShelf, 'lower', resting, 'cancelled', 'search');
  assert.ok(arrival.segments.some(segment => segment.kind === 'fall'));
  assert.notEqual(arrival.final.supportId, 'home');
  near(arrival.initial.at.x, resting.at.x); near(arrival.initial.at.y, resting.at.y);
});

test('the measured 390px room crouches beneath controls and avoids the adjacent same-height folder', () => {
  const home = { left: 22, top: 497.796875, width: 291, height: 76 };
  const next = { left: 329, top: 497.796875, width: 291, height: 76 };
  const obstacles = [
    { id: 'composer', rect: { left: 22, top: 160.797, width: 331, height: 137 } },
    { id: 'sort', rect: { left: 221.906, top: 369.797, width: 30, height: 30 } },
    { id: 'heading', rect: { left: 22, top: 376.797, width: 63.906, height: 16 } },
    { id: 'count', rect: { left: 94.906, top: 375.297, width: 20, height: 19 } },
    { id: 'add', rect: { left: 262.906, top: 367.797, width: 90.094, height: 34 } },
    ...[668.797, 734.797, 800.797].map((top, index) => ({ id: `result${index}`, rect: { left: 23, top, width: 314, height: Math.min(66, 844 - top) } })),
  ];
  const world = createWorld({ width: 390, height: 844, actorHeight: 150, platforms: [{ id: 'home', rect: home }, { id: 'next', rect: next }], obstacles });
  assert.equal(safePerch(world, 'home'), null);
  const pending = planPending(world, 'home', 'discover');
  assert.equal(pending.segments[0].phase, 'ducking-under-control');
  assert.ok(pending.segments.some(segment => segment.phase === 'searching-behind-glass'));
  for (const time of [.01, .2, .4, .6]) {
    const interrupted = sampleJourney(pending, time);
    const fast = planArrival(world, 'home', interrupted, 'cancelled', 'discover');
    assert.equal(fast.final.phase, 'resting');
    assert.equal(fast.segments.some(segment => segment.kind === 'fall'), false, 'partial crouch cannot fall through its supporting slab');
    near(fast.initial.at.x, interrupted.at.x); near(fast.initial.at.y, interrupted.at.y);
    const restarted = planPending(world, 'home', 'discover', interrupted);
    assert.ok(restarted.segments.some(segment => segment.phase === 'searching-behind-glass'));
    for (const fall of restarted.segments.filter(segment => segment.kind === 'fall')) assert.ok(fall.from.at.x + world.halfWidth < home.left || fall.from.at.x - world.halfWidth > home.left + home.width);
  }
  const arrival = planArrival(world, 'home', sampleJourney(pending, pending.duration + 1), 'cancelled', 'discover');
  assert.equal(arrival.final.phase, 'waiting-for-clear-ladder');
  assert.equal(arrival.final.supportId, 'floor');
  for (const plan of [pending, arrival]) {
    assertContinuous(plan);
    for (const segment of plan.segments.filter(segment => segment.kind === 'turn')) assert.ok(canChangeDepth(world, segment.from.at));
    for (let t = 0; t <= plan.duration; t += 1 / DRAWING_FPS) {
      const beat = sampleJourney(plan, t);
      assert.ok(Number.isFinite(beat.at.x) && Number.isFinite(beat.at.y) && Number.isFinite(beat.scale));
      if ((beat.depth || 0) > .5) continue;
      for (const obstacle of obstacles) assert.equal(intersects(bodyBounds(world, beat.at, beat.depth, beat.pose, beat.crouched), obstacle.rect), false, `${beat.phase}: ${obstacle.id}`);
    }
  }
});

test('a hop onto an adjacent shelf at the same height lands rather than falling through it', () => {
  const world = makeWorld({ platforms: [{ id: 'home', rect: { left: 140, top: 290, width: 460, height: 82 } }, { id: 'next', rect: { left: 620, top: 290, width: 300, height: 82 } }] });
  // Starting near the right edge forces the next shelf to be encountered while settling.
  const start = { pose: 'stand', at: { x: 570, y: 290 }, pin: 'feet', facing: 1, scale: 1, frameTime: 1, phase: 'walking', supportId: 'home', grounded: true, depth: 0 };
  const plan = planArrival(world, 'next', start, 'cancelled', 'search');
  const landing = plan.segments.find(segment => segment.phase === 'landing' && segment.to.supportId === 'next');
  assert.ok(landing);
  for (const fall of plan.segments.filter(segment => segment.kind === 'fall')) assert.ok(fall.from.at.x - world.halfWidth > 920 || fall.from.at.x + world.halfWidth < 140);
});


test('ladder deployment precedes mounting, supports every upward move, and retracts after top-out', () => {
  const world = makeWorld();
  const pending = planPending(world, 'home', 'search');
  const plan = planArrival(world, 'home', sampleJourney(pending, phaseTime(pending, 'searching-behind-glass')), 'success', 'search');
  const deploy = plan.segments.find(segment => segment.phase === 'deploying-ladder');
  const mount = plan.segments.find(segment => segment.phase === 'mounting-ladder');
  const climb = plan.segments.find(segment => segment.phase === 'climbing-ladder');
  const dismount = plan.segments.find(segment => segment.phase === 'dismounting-ladder');
  const retract = plan.segments.find(segment => segment.phase === 'retracting-ladder');
  assert.ok(deploy && mount && climb && dismount && retract);
  assert.equal(deploy.to.facing, deploy.to.ladder.side === 'right' ? -1 : 1);
  assert.ok(deploy.start < mount.start && mount.start < climb.start && climb.start < dismount.start && dismount.start < retract.start);
  assert.equal(retract.to.supportId, 'home');
  assert.equal(retract.to.grounded, true);
  const halfway = sampleJourney(plan, deploy.start + deploy.duration * .5);
  assert.ok(halfway.ladder.progress > 0 && halfway.ladder.progress < 1);
  for (const segment of [mount, climb]) {
    const ladder = segment.to.ladder;
    assert.equal(ladder.progress, 1); assert.equal(segment.to.supportId, ladder.id);
    assert.ok(ladder.bodyX - world.halfWidth >= 8 && ladder.bodyX + world.halfWidth <= world.width - 8);
    near(segment.from.at.x, ladder.bodyX); near(segment.to.at.x, ladder.bodyX);
  }
  near(dismount.from.at.y, dismount.to.at.y, 'top-out has no unsupported vertical interpolation');
  assert.equal(sampleJourney(plan, phaseTime(plan, 'dismounting-ladder', .25)).facing, -1, 'hands must face toward the shelf');
  assert.equal(sampleJourney(plan, phaseTime(plan, 'dismounting-ladder', .85)).facing, 1, 'the seated drawing uses its right-facing landing anchor');
  assert.equal(plan.final.ladder, undefined);
  assertContinuous(plan);
});


test('rung steps plant feet and complete both halves of the climbing cycle', () => {
  const world = makeWorld(); const ladder = placeLadder(world, 'home');
  const start = { pose: 'stand', at: { x: ladder.bodyX, y: world.floorY }, pin: 'feet', facing: -1, scale: 1, frameTime: 1, phase: 'returning', supportId: 'floor', grounded: true, depth: 0 };
  const plan = planArrival(world, 'home', start, 'success', 'search');
  const segment = plan.segments.find(item => item.phase === 'climbing-ladder');
  let previous, planted = false, moved = false;
  const leadingLegs = new Set();
  for (let tick = Math.ceil(segment.start * DRAWING_FPS); tick < (segment.start + segment.duration) * DRAWING_FPS; tick++) {
    const beat = sampleJourney(plan, tick / DRAWING_FPS);
    assert.equal(beat.pose, 'climb'); assert.ok(beat.poseProgress >= 0 && beat.poseProgress <= 1);
    leadingLegs.add(beat.poseProgress < .5 ? 'left' : 'right');
    if (previous) { planted ||= beat.at.y === previous.at.y && beat.poseProgress === previous.poseProgress; moved ||= beat.at.y < previous.at.y; }
    previous = beat;
  }
  assert.ok(planted && moved);
  assert.deepEqual([...leadingLegs].sort(), ['left', 'right']);
});

test('mounting and climbing share one two-rung gait rather than repeating one leg', () => {
  const world = makeWorld(); const ladder = placeLadder(world, 'home');
  const start = { pose: 'stand', at: { x: ladder.bodyX, y: world.floorY }, pin: 'feet', facing: -1, scale: 1, frameTime: 1, phase: 'returning', supportId: 'floor', grounded: true, depth: 0 };
  const plan = planArrival(world, 'home', start, 'success', 'search');
  const mount = plan.segments.find(segment => segment.phase === 'mounting-ladder');
  const climb = plan.segments.find(segment => segment.phase === 'climbing-ladder');
  near(mount.to.gaitDistance, ladder.rungSpacing);
  near(climb.from.gaitDistance, mount.to.gaitDistance);
  const firstClimbTick = Math.ceil(climb.start * DRAWING_FPS) / DRAWING_FPS;
  const beat = sampleJourney(plan, firstClimbTick);
  near(beat.poseProgress, .5, 'the second leg follows the first mounting rung');
  assert.ok(climb.to.gaitDistance > 2 * ladder.rungSpacing);
});

test('moving poses expose traveled distance and never inherit transition progress', () => {
  const world = makeWorld(); const plan = planPending(world, 'home', 'search');
  for (const segment of plan.segments.filter(item => item.kind === 'walk')) {
    const a = sampleJourney(plan, segment.start + segment.duration * .3);
    const b = sampleJourney(plan, segment.start + segment.duration * .7);
    assert.equal(a.poseProgress, undefined);
    assert.equal(b.poseProgress, undefined);
    assert.ok(b.gaitDistance >= a.gaitDistance);
    near(b.gaitDistance - a.gaitDistance, Math.abs(b.at.x - a.at.x));
  }
});

test('a seated character on another folder departs that folder instead of declaring itself home', () => {
  const other = { id: 'other', rect: { left: 780, top: 340, width: 350, height: 80 } };
  const world = makeWorld({ platforms: [{ id: 'home', rect: shelf }, other] });
  const start = { ...idleBeat(other.rect), supportId: 'other' };
  const plan = planArrival(world, 'home', start, 'cancelled', 'search');
  assert.ok(plan.segments.length > 0);
  assert.equal(plan.segments[0].phase, 'getting-up');
  assert.equal(plan.segments[0].to.supportId, 'other');
  assert.notEqual(plan.final.supportId, 'other');
  assertContinuous(plan);
});

const actualSplitRoom = () => createWorld({ width: 1280, height: 720, actorHeight: 218, floorY: 702, platforms: [
  { id: 'composer', rect: { left: 662.5, top: 310, width: 530, height: 68 } },
  ...Array.from({ length: 5 }, (_, index) => ({ id: `collection:${index}`, rect: { left: index % 2 ? 96.5 : 72.5, top: 218 + index * 96, width: 366, height: 72 } })),
] });
const dropAt = (x, y) => ({ pose: 'landing', at: { x, y }, pin: 'feet', facing: 1, scale: 1, frameTime: 1, phase: 'landing-after-drop', depth: 0, grounded: true, groundY: y });

test('the actual split room returns from its floor and top folder via the central alley', () => {
  const world = actualSplitRoom();
  for (const start of [dropAt(603, 702), dropAt(250, 218)]) {
    const plan = planArrival(world, 'composer', start, 'success', 'search');
    assert.equal(plan.final.phase, 'resting'); assert.equal(plan.final.supportId, 'composer');
    assertContinuous(plan);
    const ladder = plan.segments.find(segment => segment.phase === 'deploying-ladder').to.ladder;
    assert.ok(ladder.bodyX > 462.5 + world.halfWidth && ladder.bodyX < 662.5 - world.halfWidth);
    if (start.at.y === 218) {
      const walk = plan.segments.find(segment => segment.phase === 'walking-to-edge');
      assert.ok(walk.to.at.x > walk.from.at.x, 'depart toward the central alley, not the outer left edge');
      const fall = plan.segments.find(segment => segment.kind === 'fall');
      assert.ok(fall.from.at.x - world.halfWidth > 462.5, 'clear every staggered lower shelf');
      near(fall.to.at.y, world.floorY);
    }
    for (let time = 0; time < plan.duration; time += 1 / DRAWING_FPS) {
      const segment = plan.segments.find(item => frameClock(time) < item.start + item.duration);
      if (!['walk', 'hop', 'fall', 'climb'].includes(segment.kind)) continue;
      const beat = sampleJourney(plan, time);
      if ((beat.depth || 0) > 0) continue;
      for (const platform of world.platforms) assert.equal(intersects(bodyBounds(world, beat.at, beat.depth, beat.pose, beat.crouched), platform.rect), false, `${segment.phase} crosses ${platform.id}`);
    }
  }
});

test('a manually imposed 24px gap contacts the obstructing glass before slipping behind it', () => {
  const world = actualSplitRoom(), start = dropAt(250, 506);
  const plan = planArrival(world, 'composer', start, 'success', 'search');
  assert.equal(plan.final.phase, 'resting'); assert.equal(plan.final.supportId, 'composer');
  assertContinuous(plan);
  const contact = plan.segments.find(segment => segment.phase === 'pressed-against-glass');
  assert.equal(contact.to.supportId, 'grip:collection:2');
  const contactBeat = sampleJourney(plan, contact.start + 1.25);
  assert.ok(contactBeat.displacement.x > 0);
  near(contactBeat.at.x - contact.from.at.x, contactBeat.displacement.x);
  const slip = plan.segments.find(segment => segment.phase === 'slipping-behind-glass');
  assert.deepEqual(slip.from.at, slip.to.at, 'changing depth must not teleport feet');
  near(slip.from.depth, 0); near(slip.to.depth, 1);
  const fall = plan.segments.find(segment => segment.kind === 'fall');
  near(fall.from.depth, 1); near(fall.to.at.y, 702);
  const front = plan.segments.find(segment => segment.phase === 'rounding-front-edge');
  assert.ok(canChangeDepth(world, front.from.at));
  assert.ok(front.from.at.x > 462.5 && front.from.at.x < 662.5);
  assert.equal(plan.segments.some(segment => segment.to.pose === 'crawl' && segment.to.at.y === 506), false, 'the crawler cannot fit a 24px gap');
  const ordinary = planArrival(world, 'composer', { ...start, pose: 'stand', phase: 'walking' }, 'success', 'search');
  assert.equal(ordinary.segments.some(segment => segment.phase === 'slipping-behind-glass'), false, 'autonomous paths cannot use the manual-drop exception');
});

test('interrupting a glass escape continues from the actual point without getting stuck inside it', () => {
  const world = actualSplitRoom(); const plan = planArrival(world, 'composer', dropAt(250, 506), 'success', 'search');
  for (const phase of ['pressed-against-glass', 'slipping-behind-glass']) {
    const interrupted = sampleJourney(plan, phaseTime(plan, phase, .6));
    const resumed = planArrival(world, 'composer', interrupted, 'cancelled', 'search');
    near(resumed.initial.at.x, interrupted.at.x); near(resumed.initial.at.y, interrupted.at.y);
    near(resumed.initial.depth, interrupted.depth);
    assert.equal(resumed.final.supportId, 'composer'); assert.equal(resumed.final.phase, 'resting');
    assertContinuous(resumed);
  }
});

test('search leaves the actual composer through the central alley and rummages in a visible folder', () => {
  const world = actualSplitRoom();
  const plan = planPending(world, 'composer', 'search');
  const turn = plan.segments.find(segment => segment.kind === 'turn');
  assert.ok(turn); assert.ok(canChangeDepth(world, turn.from.at));
  assert.ok(turn.from.at.x > 462.5 && turn.from.at.x < 662.5);
  const rummage = plan.segments.find(segment => segment.phase === 'checking-storage');
  assert.ok(rummage);
  const folder = world.platforms.find(item => item.id === 'collection:4');
  assert.ok(rummage.to.at.x >= folder.rect.left && rummage.to.at.x <= folder.rect.left + folder.rect.width);
  near(rummage.to.depth, 1); near(rummage.to.at.y, world.floorY);
  for (const start of [dropAt(250, 218), dropAt(250, 506)]) {
    const resumed = planPending(world, 'composer', 'search', start);
    assert.ok(resumed.segments.some(segment => segment.phase === 'checking-storage'));
    assertContinuous(resumed);
  }
});

test('local search and ask touch the actual storage bubble, then stay there instead of going online', () => {
  const world = actualSplitRoom();
  for (const operation of ['search', 'ask']) {
    const plan = planPending(world, 'composer', operation);
    assertContinuous(plan);
    const contact = plan.segments.find(segment => segment.phase === 'opening-folder');
    const checking = plan.segments.find(segment => segment.phase === 'checking-storage');
    const reading = plan.segments.find(segment => segment.phase === 'reading-passages');
    assert.ok(contact && checking);
    assert.equal(contact.to.storageId, 'collection:4');
    assert.equal(contact.to.supportId, 'grip:collection:4');
    assert.equal(checking.to.storageId, contact.to.storageId);
    assert.equal(checking.to.paper, true);
    assert.equal(checking.to.supportId, 'floor');
    assert.ok(checking.duration / 2.4 >= 1.4, 'rummaging must remain visible at the faster playback speed');
    const touch = sampleJourney(plan, contact.start + 1.25);
    assert.ok(Math.abs(touch.displacement.x) > 0);
    near(touch.at.x - contact.from.at.x, touch.displacement.x);
    near(touch.at.y, world.floorY);
    assert.equal(touch.storageId, 'collection:4');
    assert.equal(plan.segments.some(segment => ['leaving-page', 'off-page', 'returning-behind-glass'].includes(segment.phase)), false);
    assert.equal(plan.segments.some(segment => segment.to.hidden), false);
    assert.equal(plan.final.storageId, 'collection:4');
    assert.equal(plan.final.paper, true);
    near(libraryCheckEnd(plan), plan.duration);
    assert.equal(plan.final.phase, operation === 'ask' ? 'reading-passages' : 'checking-storage');
    if (operation === 'ask') {
      assert.ok(reading); assert.equal(reading.to.pose, 'search'); assert.ok(reading.duration / 2.4 >= 2, 'reading gets a clear hold at the faster playback speed');
      near(reading.start, checking.start + checking.duration);
      const first = sampleJourney(plan, reading.start + .3), next = sampleJourney(plan, reading.start + 1.2);
      assert.deepEqual(first.at, next.at);
      assert.ok(next.frameTime > first.frameTime, 'reading drawings advance while feet stay planted');
    } else assert.equal(reading, undefined);
  }
});

test('only a completed physical local-library sequence has a completion milestone', () => {
  const world = actualSplitRoom();
  for (const operation of ['discover', 'import']) {
    const plan = planPending(world, 'composer', operation);
    assert.equal(libraryCheckEnd(plan), 0);
    assert.ok(plan.segments.some(segment => segment.phase === 'off-page'));
    assert.equal(plan.segments.some(segment => segment.phase === 'opening-folder'), false);
  }
  assert.equal(libraryCheckEnd(planPending(makeWorld(), 'home', 'search')), 0, 'there is no collection bubble in this world');
  const local = planPending(world, 'composer', 'ask');
  const withoutContact = { ...local, segments: local.segments.filter(segment => segment.phase !== 'opening-folder') };
  assert.equal(libraryCheckEnd(withoutContact), 0);
  const contactOnly = { ...local, segments: local.segments.filter(segment => !['checking-storage', 'reading-passages'].includes(segment.phase)) };
  assert.equal(libraryCheckEnd(contactOnly), 0);
});

test('completion or cancellation during a local check returns continuously and clears the storage prop', () => {
  const world = actualSplitRoom();
  const local = planPending(world, 'composer', 'ask');
  for (const phase of ['opening-folder', 'checking-storage', 'reading-passages']) {
    const start = sampleJourney(local, phaseTime(local, phase, .6));
    for (const outcome of ['success', 'empty', 'error', 'cancelled']) {
      const arrival = planArrival(world, 'composer', start, outcome, 'ask');
      near(arrival.initial.at.x, start.at.x); near(arrival.initial.at.y, start.at.y);
      near(arrival.initial.depth, start.depth);
      assertContinuous(arrival);
      assert.equal(arrival.final.phase, 'resting'); assert.equal(arrival.final.supportId, 'composer');
      assert.equal(arrival.final.storageId, undefined);
      assert.equal(arrival.final.paper, false);
      assert.equal(libraryCheckEnd(arrival), 0);
    }
  }
});


test('cancelling on a ladder retains support and a new search descends before retracting it', () => {
  const world = makeWorld(); const ladder = placeLadder(world, 'home');
  const start = { pose: 'stand', at: { x: ladder.bodyX, y: world.floorY }, pin: 'feet', facing: -1, scale: 1, frameTime: 1, phase: 'returning', supportId: 'floor', grounded: true, depth: 0 };
  const arrival = planArrival(world, 'home', start, 'success', 'search');
  const climbing = sampleJourney(arrival, phaseTime(arrival, 'climbing-ladder', .4));
  const cancelled = planArrival(world, 'home', climbing, 'cancelled', 'search');
  assertContinuous(cancelled);
  assert.equal(cancelled.segments.some(segment => segment.kind === 'fall'), false);
  assert.equal(cancelled.final.phase, 'resting');
  const restarted = planPending(world, 'home', 'search', climbing);
  assert.equal(restarted.segments[0].phase, 'descending-ladder');
  assert.equal(restarted.segments[0].to.supportId, ladder.id);
  const retract = restarted.segments.find(segment => segment.phase === 'retracting-ladder');
  assert.equal(retract.to.supportId, 'floor');
  assert.equal(retract.to.facing, ladder.side === 'right' ? -1 : 1);
  assert.ok(retract.start > restarted.segments[0].start);
});

test('interrupting top-out remounts horizontally before descending and finishes retraction while seated', () => {
  const world = makeWorld(); const ladder = placeLadder(world, 'home');
  const start = { pose: 'stand', at: { x: ladder.bodyX, y: world.floorY }, pin: 'feet', facing: -1, scale: 1, frameTime: 1, phase: 'returning', supportId: 'floor', grounded: true, depth: 0 };
  const arrival = planArrival(world, 'home', start, 'success', 'search');
  const topOut = sampleJourney(arrival, phaseTime(arrival, 'dismounting-ladder', .4));
  const restarted = planPending(world, 'home', 'search', topOut);
  assertContinuous(restarted);
  assert.equal(restarted.segments[0].phase, 'remounting-ladder');
  near(restarted.segments[0].from.at.y, restarted.segments[0].to.at.y);
  assert.equal(restarted.segments[1].phase, 'descending-ladder');
  near(restarted.segments[1].from.at.x, ladder.bodyX);
  near(restarted.segments[1].to.at.x, ladder.bodyX);
  const retracting = sampleJourney(arrival, phaseTime(arrival, 'retracting-ladder', .4));
  assert.equal(retracting.pose, 'idle');
  const finished = planArrival(world, 'home', retracting, 'cancelled', 'search');
  assertContinuous(finished);
  assert.equal(finished.segments[0].phase, 'retracting-ladder');
  assert.equal(finished.segments.some(segment => segment.kind === 'fall' || segment.kind === 'climb'), false);
  near(finished.initial.ladder.progress, retracting.ladder.progress);
  assert.equal(finished.final.ladder, undefined);
  assert.equal(finished.final.phase, 'resting');
});


test('slower walking uses more drawing ticks without sliding faster across the room', () => {
  const plan = planPending(makeWorld(), 'home', 'search');
  assert.equal(DRAWING_FPS, 12);
  for (const segment of plan.segments.filter(segment => segment.kind === 'walk' && segment.to.pose !== 'idle')) {
    const speed = Math.abs(segment.to.at.x - segment.from.at.x) / segment.duration;
    assert.ok(speed <= (segment.to.crouched ? 34 : 46) + .001);
  }
});


test('the reserved desktop alley keeps the entire ladder and ascent clear of controls', () => {
  const home = { left: 64, top: 572.75, width: 458.421875, height: 82 };
  const obstacles = [
    { id: 'sort', rect: { left: 390, top: 422, width: 30, height: 34 } },
    { id: 'add', rect: { left: 429, top: 422, width: 93, height: 34 } },
    { id: 'heading', rect: { left: 64, top: 431.75, width: 63.906, height: 16 } },
    { id: 'composer', rect: { left: 64, top: 204.75, width: 1137, height: 151 } },
    ...[469.75, 535.75, 601.75, 667.75].map((top, index) => ({ id: `result${index}`, rect: { left: 703.421875, top, width: 481.58, height: 66 } })),
  ];
  const world = createWorld({ width: 1280, height: 720, actorHeight: 218, platforms: [{ id: 'home', rect: home }, { id: 'next', rect: { ...home, top: 670.75 } }], obstacles });
  const ladder = placeLadder(world, 'home');
  assert.equal(ladder.side, 'right');
  assert.ok(ladder.x - ladder.width / 2 > home.left + home.width);
  const pending = planPending(world, 'home', 'search');
  const plan = planArrival(world, 'home', sampleJourney(pending, pending.duration + 1), 'success', 'search');
  assert.equal(plan.final.phase, 'resting');
  for (let t = 0; t <= plan.duration; t += 1 / DRAWING_FPS) {
    const beat = sampleJourney(plan, t);
    if ((beat.depth || 0) > .5) continue;
    for (const obstacle of obstacles) assert.equal(intersects(bodyBounds(world, beat.at, beat.depth, beat.pose, beat.crouched), obstacle.rect), false, `${beat.phase}: ${obstacle.id}`);
  }
});


test('the reserved 390px ladder alley keeps the actor visible throughout climbing', () => {
  const home = { left: 22, top: 497.8, width: 237, height: 76 };
  const world = createWorld({ width: 390, height: 844, actorHeight: 150, platforms: [{ id: 'home', rect: home }, { id: 'next', rect: { ...home, top: 589.8 } }], obstacles: [
    { id: 'heading', rect: { left: 22, top: 376.8, width: 85, height: 20 } },
    { id: 'add', rect: { left: 169, top: 367.8, width: 90, height: 34 } },
  ] });
  const ladder = placeLadder(world, 'home');
  assert.ok(ladder); assert.equal(ladder.side, 'right');
  assert.ok(ladder.bodyX + world.halfWidth < 390);
  const pending = planPending(world, 'home', 'discover');
  const plan = planArrival(world, 'home', sampleJourney(pending, pending.duration + 1), 'success', 'discover');
  assert.equal(plan.final.phase, 'resting');
  for (const segment of plan.segments.filter(segment => segment.kind === 'climb')) {
    assert.ok(segment.to.at.x - world.halfWidth >= 0);
    assert.ok(segment.to.at.x + world.halfWidth <= 390);
    assert.equal(segment.to.supportId, 'ladder:home');
  }
});

test('the actual narrow room crawls beneath search controls after a top-folder drop and gets home', () => {
  const world = createWorld({width:390,height:844,actorHeight:150,floorY:826,
    platforms:[{id:'composer',rect:{left:25,top:200,width:217,height:64}},
      ...[431,529,627,725,823].map((top,i)=>({id:`collection:mobile-${i}`,rect:{left:i%2?40:25,top,width:202,height:74}}))],
    obstacles:[{id:'control:0',rect:{left:25,top:264,width:217,height:58}}]});
  const plan=planArrival(world,'composer',{pose:'landing',at:{x:130,y:431},pin:'feet',facing:1,scale:1,frameTime:1,phase:'landing-after-drop',depth:0,grounded:true,supportId:'collection:mobile-0'},'success','search');
  assertContinuous(plan);
  assert.ok(plan.segments.some(segment=>segment.kind==='walk' && segment.to.pose==='crawl'));
  assert.equal(plan.final.phase,'resting');
  assert.equal(plan.final.supportId,'composer');
  const climb=plan.segments.find(segment=>segment.phase==='climbing-ladder');
  assert.ok(climb && climb.to.at.x + world.halfWidth < world.width);
});
