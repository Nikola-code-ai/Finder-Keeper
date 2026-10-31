import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clerkPresentation, isClerkStyle, ROOM_ANCHORS } from '../lib/clerk-room.ts';

test('request status immediately identifies the correct physical work location', () => {
  for (const [operation, pose] of [['discover', 'web'], ['search', 'documents'], ['ask', 'reading'], ['import', 'documents']]) {
    const state = clerkPresentation({ id: 2, operation, active: true });
    assert.equal(state.pose, pose);
  }
});

test('all terminal events stop reporting active work, including cancelled imports', () => {
  for (const operation of ['discover', 'search', 'ask', 'import']) {
    for (const outcome of ['success', 'empty', 'error', 'cancelled']) {
      const state = clerkPresentation({ id: 3, operation, active: false, outcome });
      assert.equal(state.pose, 'idle');
      assert.ok(state.label.length > 0);
    }
  }
});

test('stored or URL styles cannot create an arbitrary asset path', () => {
  for (const style of ['illustrated', 'blender', 'pixel']) assert.ok(isClerkStyle(style));
  for (const invalid of [null, undefined, '', '../../other', 'constructor', 'toString']) assert.equal(isClerkStyle(invalid), false);
  for (const anchors of Object.values(ROOM_ANCHORS)) for (const [x, y] of Object.values(anchors)) {
    assert.ok(x > 0 && x < 100 && y > 0 && y < 100);
  }
});
