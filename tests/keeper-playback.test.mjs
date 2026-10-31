import assert from 'node:assert/strict';
import {test} from 'node:test';
import {updateKeeperRun, resumeAfterDrop, playbackSeconds} from '../lib/keeper-playback.ts';

const idle={kind:'idle',started:0,activity:{id:0,operation:'search',active:false}};
test('mounting during an active request starts its journey',()=>{
  const activity={id:5,operation:'ask',active:true};
  const run=updateKeeperRun({...idle,activity},activity,100);
  assert.equal(run.kind,'pending'); assert.equal(run.started,100);
  assert.equal(updateKeeperRun(idle,idle.activity,100).kind,'idle');
});
test('real responses stop pending work; successful local responses enter source presentation',()=>{
  for(const operation of ['search','ask','discover','import']) for(const outcome of ['success','empty','cancelled','error']) {
    const pending=updateKeeperRun(idle,{id:1,operation,active:true},100);
    pending.plan={duration:20};
    const response=updateKeeperRun(pending,{id:1,operation,active:false,outcome},140);
    assert.equal(response.kind,outcome==='success' && operation!=='discover' ? 'presenting' : 'arrival'); assert.equal(response.started,140);
    assert.equal(response.activity.active,false);
    assert.equal(response.plan,undefined);
  }
});
test('a cached response is already complete while Keeper presents its source',()=>{
  const run=updateKeeperRun(idle,{id:2,operation:'ask',active:false,outcome:'success'},100);
  assert.equal(run.kind,'presenting'); assert.equal(run.activity.active,false);
});
test('backend stage changes preserve the route while publishing the current stage',()=>{
  const pending=updateKeeperRun(idle,{id:1,operation:'import',active:true,status:'downloading'},100);
  pending.plan={duration:20};
  const changed=updateKeeperRun(pending,{...pending.activity,status:'indexing'},400);
  assert.equal(changed.plan,pending.plan); assert.equal(changed.started,100);
  assert.equal(changed.activity.status,'indexing');
});
test('a changed collection replans from the current frame instead of keeping the wrong destination',()=>{
  const pending=updateKeeperRun(idle,{id:1,operation:'search',active:true,destinationId:'collection:a'},100);
  pending.plan={duration:20};
  const changed=updateKeeperRun(pending,{...pending.activity,destinationId:'collection:b'},200);
  assert.equal(changed.kind,'pending'); assert.equal(changed.plan,undefined); assert.equal(changed.started,200);
});
test('new requests discard earlier outcomes and plans',()=>{
  const old={...idle,kind:'idle',plan:{duration:20},activity:{id:1,operation:'ask',active:false,outcome:'success'}};
  const next=updateKeeperRun(old,{id:2,operation:'search',active:true},200);
  assert.equal(next.kind,'pending'); assert.equal(next.activity.outcome,undefined); assert.equal(next.plan,undefined);
});
test('dragging can finish a queued presentation but never replay a completed one',()=>{
  const done={id:1,operation:'ask',active:false,outcome:'success'};
  assert.equal(resumeAfterDrop({...idle,activity:done},done,100).kind,'presenting');
  assert.equal(resumeAfterDrop({...idle,activity:done,presentationDone:true},done,100).kind,'arrival');
  assert.equal(resumeAfterDrop(idle,idle.activity,100).kind,'arrival');
  const active={...done,active:true,outcome:undefined};
  assert.equal(resumeAfterDrop(idle,active,100).kind,'pending');
});
test('the playback clock respects pause offsets and never runs backward',()=>{
  assert.equal(playbackSeconds(2000,1000),2.4);
  assert.equal(playbackSeconds(7000,6000),2.4);
  assert.equal(playbackSeconds(500,1000),0);
});
test('an outcome update clears the previous acknowledgment without starting another search',()=>{
  const completed=updateKeeperRun(idle,{id:1,operation:'search',active:false,outcome:'success'},100);
  const cancelled=updateKeeperRun({...completed,kind:'idle'},{...completed.activity,outcome:'cancelled'},200);
  assert.equal(cancelled.kind,'arrival'); assert.equal(cancelled.activity.outcome,'cancelled');
});
