import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startClerkClock, syncClerkClock, advanceClerkClock, clerkAnimationFrame } from '../lib/clerk-animation.ts';

const request = (operation = 'search', id = 1) => ({ id, operation, active: true });
const at = (clock, elapsed) => clerkAnimationFrame({ ...clock, elapsed });

test('document retrieval walks, checks papers, returns, and presents without delaying completion', () => {
  let clock = startClerkClock(request());
  assert.equal(at(clock, 0).phase, 'walk');
  assert.equal(at(clock, 2.1).phase, 'documents');
  clock = syncClerkClock(advanceClerkClock(clock, 0.15), { ...request(), active: false, outcome: 'success' });
  assert.equal(clock.completionAt, 0.15);
  assert.equal(at(clock, 3).phase, 'documents');
  assert.equal(at(clock, 5).phase, 'return');
  assert.equal(at(clock, 7).phase, 'present');
  assert.equal(at(clock, 9.3).phase, 'idle');
});

test('spider is dispatched before web work; reading stays at the book', () => {
  const spider = startClerkClock(request('discover'));
  assert.equal(at(spider, 0.5).phase, 'dispatch');
  assert.equal(at(spider, 2.2).phase, 'web');
  assert.equal(at(spider, 600).phase, 'web');
  const reading = startClerkClock(request('ask'));
  assert.equal(at(reading, 0).phase, 'read');
  assert.equal(at(reading, 600).phase, 'read');
});

test('errors and cancellation immediately stop work and return from the left desk', () => {
  for (const outcome of ['error', 'cancelled']) {
    const working = advanceClerkClock(startClerkClock(request()), 3.4);
    const stopped = syncClerkClock(working, { ...request(), active: false, outcome });
    assert.deepEqual(clerkAnimationFrame(stopped), { phase: 'return', time: 0 });
    assert.equal(at(stopped, 5.5).phase, outcome);
    assert.equal(at(stopped, 7.3).phase, 'idle');
  }
});

test('empty findings never produce the success presentation', () => {
  const clock = syncClerkClock(startClerkClock(request('ask')), { ...request('ask'), active: false, outcome: 'empty' });
  assert.equal(at(clock, 3).phase, 'error');
});

test('a new request replaces any unfinished return or cancelled animation', () => {
  let clock = advanceClerkClock(startClerkClock(request()), 8);
  clock = syncClerkClock(clock, request('discover', 2));
  assert.equal(clock.requestId, 2);
  assert.equal(clock.elapsed, 0);
  assert.equal(clock.completionAt, null);
  assert.equal(clerkAnimationFrame(clock).phase, 'dispatch');
});

test('reduced motion uses meaningful static work poses and stops on completion', () => {
  for (const [operation, phase] of [['discover', 'web'], ['ask', 'read'], ['search', 'documents'], ['import', 'documents']]) {
    let clock = startClerkClock(request(operation));
    assert.equal(clerkAnimationFrame(clock, true).phase, phase);
    clock = syncClerkClock(clock, { ...request(operation), active: false, outcome: 'success' });
    assert.equal(clerkAnimationFrame(clock, true).phase, 'idle');
  }
});


test('cancelling halfway through a walk starts the return at the same distance', () => {
  const working = advanceClerkClock(startClerkClock(request()), 0.7);
  const stopped = syncClerkClock(working, { ...request(), active: false, outcome: 'cancelled' });
  assert.deepEqual(clerkAnimationFrame(stopped), { phase: 'return', time: 1.3 });
  assert.equal(at(stopped, 1.5).phase, 'cancelled');
});

test('cancelled spider departure finishes the release then recalls without entering web work', () => {
  const working = advanceClerkClock(startClerkClock(request('discover')), 0.8);
  const stopped = syncClerkClock(working, { ...request('discover'), active: false, outcome: 'cancelled' });
  assert.deepEqual(clerkAnimationFrame(stopped), { phase: 'dispatch', time: 0.8 });
  assert.equal(at(stopped, 2.1).phase, 'cancelled');
  assert.equal(at(stopped, 3.9).phase, 'idle');
});
