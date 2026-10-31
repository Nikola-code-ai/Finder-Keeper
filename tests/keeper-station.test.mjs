import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {advanceStationClock,sampleStation,stationClock,stationGeometry,STATION_DRAWINGS,STATION_START_DELAY_MS,STATION_REACH_MS,STATION_SETTLE_MS} from '../lib/keeper-station.ts';

const request={id:1,operation:'search',active:true};
test('cached responses never trigger a delayed reach or queued presentation',()=>{
  let clock=stationClock(request,0);
  clock=advanceStationClock(clock,request,80,false);
  assert.equal(sampleStation(clock).phase,'starting');assert.equal(sampleStation(clock).drawerOpen,0);
  clock=advanceStationClock(clock,{...request,active:false,outcome:'success'},81,false);
  assert.equal(sampleStation(clock).phase,'idle');
  assert.equal(sampleStation(advanceStationClock(clock,{...request,active:false,outcome:'success'},9000,false)).phase,'idle');
});
test('a slower request reaches once within 450ms and then holds a completely still work drawing',()=>{
  let clock=stationClock(request,0);
  clock=advanceStationClock(clock,request,250,false);
  assert.equal(sampleStation(clock).phase,'reaching');
  assert.ok(STATION_START_DELAY_MS+STATION_REACH_MS<=450);assert.ok(STATION_SETTLE_MS<=200);
  clock=advanceStationClock(clock,request,450,false);
  const held=sampleStation(clock);assert.equal(held.phase,'working');assert.equal(held.drawerOpen,1);
  assert.deepEqual(sampleStation(advanceStationClock(clock,request,60000,false)),held);
});
test('every outcome stops immediately even during a paused reach',()=>{
  for(const outcome of ['success','empty','error','cancelled']) {
    const moving=advanceStationClock(stationClock(request,0),request,250,false);
    const paused=advanceStationClock(moving,request,300,true);
    const done=advanceStationClock(paused,{...request,active:false,outcome},301,true);
    assert.deepEqual(sampleStation(done),{phase:'idle',drawing:'idle',drawerOpen:0});
  }
});
test('pause freezes the drawing clock and does not count paused time on resume',()=>{
  const moving=advanceStationClock(stationClock(request,0),request,200,false);
  const paused=advanceStationClock(moving,request,210,true);
  const waiting=advanceStationClock(paused,request,50000,true);
  assert.deepEqual(sampleStation(waiting),sampleStation(moving));
  const resumed=advanceStationClock(waiting,request,50100,false);
  assert.equal(resumed.elapsedMs,200);
  assert.equal(advanceStationClock(resumed,request,50140,false).elapsedMs,240);
});
test('a repeated request starts fresh while backend stage updates preserve the current drawing',()=>{
  const work=advanceStationClock(stationClock(request,0),request,1000,false);
  const stage=advanceStationClock(work,{...request,status:'Reading passages'},1010,false);
  assert.equal(sampleStation(stage).phase,'working');
  const next=advanceStationClock(stage,{...request,id:2},1100,false);
  assert.equal(next.elapsedMs,0);assert.equal(sampleStation(next).phase,'starting');
});
test('reduced motion uses one static working pose and online work uses a held laptop',()=>{
  const work=advanceStationClock(stationClock(request,0),request,110,false);
  assert.equal(sampleStation(work,true).phase,'working');assert.equal(sampleStation(work,true).drawerOpen,1);
  const online={...request,operation:'discover'};
  const laptop=sampleStation(advanceStationClock(stationClock(online,0),online,110,false));
  assert.equal(laptop.drawing,'laptop');assert.equal(laptop.drawerOpen,0);
});
test('the measured reach and work hands meet the moving drawer opening at desktop and mobile sizes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/character-sketch/manifest-v4.json',import.meta.url),'utf8'));
  for(const [name,index] of [['reach',2],['work',0]]) {
    assert.deepEqual(STATION_DRAWINGS[name].hand,manifest.states.rummage.frameAnchors[index].hand);
    assert.deepEqual(STATION_DRAWINGS[name].feet,manifest.states.rummage.frameAnchors[index].feet);
    for(const [width,height] of [[820,320],[346,250],[300,250]]) for(const progress of [0,.25,.5,.75,1]) {
      const {actor,feet,hand,drawer}=stationGeometry(width,height,name,progress);
      assert.ok(hand.x>=drawer.left+drawer.slide && hand.x<=drawer.left+drawer.slide+drawer.width);
      assert.ok(hand.y>=drawer.top && hand.y<=drawer.top+drawer.mouthHeight);
      assert.ok(drawer.left>=0 && actor.left+actor.width<=width);
      assert.equal(feet.y,height-12);
    }
  }
});
