import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {chestWorkPoint,createWorld, idleBeat, keepFloorInView, keeperRequestNote, placeDrawing,planRequestPending, planRequestSettled, requestDestination, sampleJourney} from '../lib/keeper-choreography.ts';

const home={left:650,top:290,width:350,height:70};
const world=createWorld({width:1280,height:900,actorHeight:150,floorY:820,platforms:[
  {id:'keeper-home',rect:home},
  {id:'collection:chosen',rect:{left:70,top:730,width:300,height:85}},
  {id:'collection:other',rect:{left:70,top:610,width:300,height:85}},
  {id:'portal',rect:{left:70,top:400,width:300,height:80}},
  {id:'reading-desk',rect:{left:650,top:490,width:350,height:80}},
]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
const atFloor={pose:'stand',at:{x:500,y:820},pin:'feet',facing:1,scale:1,frameTime:0,phase:'request-complete',depth:0,grounded:true,supportId:'floor'};

test('local work never falls back to a generic desk when its real collection is absent',()=>{
  assert.equal(requestDestination(world,{operation:'search',destinationId:'collection:chosen'},'keeper-home'),'collection:chosen');
  assert.equal(requestDestination(world,{operation:'search',destinationId:'collection:hidden'},'keeper-home'),undefined);
  assert.equal(requestDestination(world,{operation:'discover'},'keeper-home'),'reading-desk');
  assert.equal(requestDestination(world,{operation:'ask'},'keeper-home'),undefined);
  const blocked=planRequestPending(world,'keeper-home',{id:1,operation:'search',active:true,destinationId:'collection:hidden'},atFloor);
  assert.equal(blocked.final.phase,'waiting-for-visible-collection'); assert.equal(blocked.final.pose,'stand');
  assert.equal(blocked.final.storageId,undefined);
});
test('production discovers online without leaving or hiding off the page',()=>{
  const journey=planRequestPending(world,'keeper-home',{id:1,operation:'discover',active:true,destinationId:'portal'},atFloor);
  assert.ok(journey.segments.length);
  assert.ok(journey.segments.every(segment=>!segment.to.hidden && !['leaving-page','off-page'].includes(segment.phase)));
  near(journey.initial.at.x,atFloor.at.x); near(journey.initial.at.y,atFloor.at.y);
  assert.equal(journey.final.phase,'using-laptop'); assert.equal(journey.final.laptop,true);
  assert.equal(journey.final.supportId,'reading-desk');
});
test('local inspection belongs to the selected folder, never a convenient lower folder',()=>{
  for(const destinationId of ['collection:chosen','collection:other']) {
    const journey=planRequestPending(world,'keeper-home',{id:1,operation:'search',active:true,destinationId},atFloor);
    const inspections=journey.segments.filter(segment=>segment.to.storageId);
    assert.ok(inspections.length);
    assert.ok(inspections.every(segment=>segment.to.storageId===destinationId));
    assert.equal(journey.final.storageId,destinationId);
  }
});
test('a high folder is reached by ladder before contact and transparent inspection',()=>{
  const journey=planRequestPending(world,'keeper-home',{id:1,operation:'search',active:true,destinationId:'collection:other'},atFloor);
  assert.equal(journey.final.phase,'checking-storage');
  const contact=journey.segments.find(segment=>segment.phase==='opening-folder');
  assert.ok(contact); assert.equal(contact.from.supportId,'collection:other');
  assert.ok(journey.segments.some(segment=>segment.kind==='climb' && segment.start<contact.start));
  assert.equal(contact.to.lidOpen,1);
  assert.equal(journey.final.supportId,'collection:other'); assert.ok(journey.final.depth>.5);
});
test('completion, empty, cancellation and errors settle in place without a homeward route',()=>{
  for(const outcome of ['success','empty','error','cancelled']) {
    const journey=planRequestSettled(world,atFloor,{id:1,operation:'search',active:false,outcome});
    near(journey.initial.at.x,atFloor.at.x); near(journey.final.at.x,atFloor.at.x);
    near(journey.final.at.y,atFloor.at.y); assert.equal(journey.final.supportId,'floor');
    assert.ok(journey.segments.every(segment=>segment.kind==='hold'));
    assert.deepEqual(sampleJourney(journey,20),sampleJourney(journey,200));
  }
});
test('completion in a fall finishes gravity before acknowledging the outcome',()=>{
  const falling={...atFloor,at:{x:500,y:720},grounded:false,supportId:undefined,velocityY:100,phase:'falling'};
  const journey=planRequestSettled(world,falling,{id:1,operation:'ask',active:false,outcome:'success'});
  assert.equal(journey.segments[0].kind,'fall');
  near(journey.initial.at.y,720); near(journey.final.at.y,820); near(journey.final.at.x,500);
  assert.ok(journey.segments[0].duration<Math.sqrt(200/760));
});
test('an instant response on the original seat stays on that same seat',()=>{
  const seated={...idleBeat(home),supportId:'keeper-home'};
  const journey=planRequestSettled(world,seated,{id:1,operation:'ask',active:false,outcome:'success'});
  assert.equal(journey.final.pose,'idle'); assert.equal(journey.final.supportId,'keeper-home');
  assert.equal(journey.segments.length,1); assert.equal(journey.segments[0].kind,'hold');
});
test('request copy reflects backend work and outcomes without elapsed-time stage guesses',()=>{
  assert.equal(keeperRequestNote({operation:'import',active:true,status:'extracting'}),'Reading the document…');
  assert.equal(keeperRequestNote({operation:'import',active:true,status:'indexing'}),'Making it searchable…');
  assert.equal(keeperRequestNote({operation:'ask',active:false,outcome:'success'}),'Ready. Take a look.');
  assert.equal(keeperRequestNote({operation:'search',active:false,outcome:'cancelled'}),'Stopped here.');
  assert.equal(keeperRequestNote({operation:'search',active:true,status:'Searching stored documents'}),'Searching your saved pages…');
});

test('a new request starts from a different existing seat instead of relocating to the original desk',()=>{
  const collection=world.platforms.find(surface=>surface.id==='collection:other');
  const start={...idleBeat(collection.rect),supportId:collection.id};
  const journey=planRequestPending(world,'keeper-home',{id:2,operation:'discover',active:true,destinationId:'portal'},start);
  assert.equal(journey.initial.supportId,collection.id);
  assert.equal(journey.segments[0]?.from.supportId,collection.id);
  assert.ok(journey.initial.at.x < 400);
});
test('a removed support releases the actor into gravity without sending it home',()=>{
  const start={...atFloor,at:{x:500,y:650},supportId:'collection:removed'};
  const journey=planRequestSettled(world,start,{id:1,operation:'search',active:false,outcome:'success'});
  assert.equal(journey.segments[0].kind,'fall');
  near(journey.final.at.x,500); near(journey.final.at.y,820);
});
test('a response midway through standing settles onto that same real ledge',()=>{
  const rising={...atFloor,at:{x:800,y:315},supportId:'keeper-home',phase:'getting-up'};
  const journey=planRequestSettled(world,rising,{id:1,operation:'search',active:false,outcome:'success'});
  assert.equal(journey.segments[0].kind,'rise');
  near(journey.final.at.x,800); near(journey.final.at.y,290);
  assert.equal(journey.final.supportId,'keeper-home');
});

test('the next request exits an open chest before traveling to another one',()=>{
  const first=planRequestPending(world,'keeper-home',{id:1,operation:'search',active:true,destinationId:'collection:chosen'},atFloor);
  const settled=first.final;
  assert.equal(settled.lidOpen,1); assert.ok(settled.depth>.5);
  const next=planRequestPending(world,'keeper-home',{id:2,operation:'search',active:true,destinationId:'collection:other'},settled);
  assert.equal(next.segments[0].phase,'leaving-glass-folder');
  near(next.initial.at.x,settled.at.x); near(next.initial.at.y,settled.at.y);
  assert.equal(next.final.storageId,'collection:other'); assert.equal(next.final.supportId,'collection:other');
});

test('all actual rummage and reading frame hands stay inside the 26px chest cavity',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/character-sketch/manifest-v4.json',import.meta.url),'utf8'));
  const chest=world.platforms.find(surface=>surface.id==='collection:chosen');
  for(const actorHeight of [150,180]) {
    const geometry={...world,actorHeight}; const at=chestWorkPoint(geometry,chest);
    const height=actorHeight*(1-.16*.78),width=height*manifest.width/manifest.height;
    for(const pose of ['rummage','search']) for(const anchors of manifest.states[pose].frameAnchors) {
      const drawing=placeDrawing(at,anchors.feet,width,height,1);
      const hand={x:drawing.x+anchors.hand[0]*width,y:drawing.y+anchors.hand[1]*height};
      assert.ok(hand.y>=chest.rect.top-2 && hand.y<=chest.rect.top+26,`${pose}: hand y=${hand.y-chest.rect.top}`);
      assert.ok(hand.x>=chest.rect.left+6 && hand.x<=chest.rect.left+chest.rect.width-6);
    }
  }
});

test('cached local success reaches the chest, presents its source, closes its lid and stays there',()=>{
  const journey=planRequestPending(world,'keeper-home',{id:2,operation:'search',active:false,outcome:'success',destinationId:'collection:chosen'},atFloor);
  const phases=journey.segments.map(segment=>segment.phase);
  assert.ok(phases.indexOf('opening-folder')<phases.indexOf('presenting-source'));
  assert.ok(phases.indexOf('presenting-source')<phases.indexOf('closing-folder'));
  assert.equal(journey.final.phase,'source-presented'); assert.equal(journey.final.supportId,'collection:chosen');
  assert.equal(journey.final.lidOpen,0); assert.equal(journey.final.pose,'idle');
});

test('online discovery opens a laptop on the existing seat without visiting a collection or portal',()=>{
  const seated={...idleBeat(home),supportId:'keeper-home'};
  const journey=planRequestPending(world,'keeper-home',{id:1,operation:'discover',active:true,destinationId:'portal'},seated);
  assert.equal(journey.segments.length,1); assert.equal(journey.final.phase,'using-laptop');
  assert.equal(journey.final.laptop,true); assert.equal(journey.final.storageId,undefined);
  assert.equal(journey.final.supportId,'keeper-home');
});

test('scroll and a narrower viewport cannot leave a floor-supported actor offscreen',()=>{
  const resized=createWorld({width:390,height:844,actorHeight:150,floorY:826,platforms:[]});
  const stale={...atFloor,at:{x:1135.05,y:1097},groundY:1097};
  const placed=keepFloorInView(resized,stale);
  near(placed.at.y,826); near(placed.groundY,826);
  assert.ok(placed.at.x+resized.halfWidth<=390);
  assert.equal(keepFloorInView(resized,placed),placed);
  const shelfSupported={...stale,supportId:'collection:chosen'};
  assert.equal(keepFloorInView(resized,shelfSupported),shelfSupported);
  const falling={...stale,grounded:false};
  assert.equal(keepFloorInView(resized,falling),falling);
});

test('finishing laptop work leaves Keeper seated, and the next local request starts from that seat',()=>{
  const seated={...idleBeat(home),supportId:'keeper-home'};
  const online=planRequestPending(world,'keeper-home',{id:1,operation:'discover',active:true},seated).final;
  const settled=planRequestSettled(world,online,{id:1,operation:'discover',active:false,outcome:'success'}).final;
  assert.equal(settled.pose,'idle'); assert.equal(settled.laptop,false); assert.equal(settled.supportId,'keeper-home');
  near(settled.at.x,online.at.x); near(settled.at.y,online.at.y);
  const local=planRequestPending(world,'keeper-home',{id:2,operation:'search',active:true,destinationId:'collection:chosen'},online);
  assert.equal(local.initial.supportId,'keeper-home'); assert.equal(local.final.storageId,'collection:chosen');
});

// Captured from the live manga room at 1280x900 after scrollY327.
const measuredHome={left:1073.8125,top:347.640625,width:126,height:12};
const measuredDesktop=createWorld({width:1280,height:900,actorHeight:180,bodyRadius:39.6,floorY:882,platforms:[
  {id:'keeper-home',rect:measuredHome},
  {id:'reading-desk',rect:{left:640.46875,top:413.640625,width:583.34375,height:12}},
  {id:'composer',rect:{left:650.46875,top:417.640625,width:563.34375,height:65}},
  {id:'collection:all',rect:{left:95.1875,top:204.203125,width:421.6875,height:108}},
  ...[382.203125,560.203125].flatMap((top,i)=>[
    {id:`collection:a${i}`,rect:{left:69.1875,top,width:221.84375,height:108}},
    {id:`collection:b${i}`,rect:{left:321.03125,top,width:221.84375,height:108}},
  ]),
],obstacles:[
  {id:'guide',rect:{left:650.46875,top:28.953125,width:563.34375,height:209.6875}},
  {id:'toolbar',rect:{left:650.46875,top:482.640625,width:563.34375,height:42}},
]});

test('the measured desktop reaches All from a fresh home, stepping down through the desk',()=>{
  const journey=planRequestPending(measuredDesktop,'keeper-home',{id:1,operation:'search',active:true,destinationId:'collection:all'},{...idleBeat(measuredHome),supportId:'keeper-home'});
  assert.equal(journey.final.storageId,'collection:all'); assert.equal(journey.final.phase,'checking-storage');
  assert.ok(journey.segments.some(segment=>segment.phase==='landing' && segment.to.supportId==='reading-desk'));
  for(let t=0;t<=journey.duration;t+=1/12){
    const beat=sampleJourney(journey,t);
    assert.ok(beat.at.x>=0 && beat.at.x<=1280,`${beat.phase} leaves viewport at ${beat.at.x}`);
  }
  const opening=journey.segments.find(segment=>segment.phase==='opening-folder');
  assert.ok(Math.abs(opening.from.at.x-opening.to.at.x)<1,'opening a chest must not slide sideways from a distant perch');
});

test('a mobile chest with the reserved right alley is reachable and remains the working object',()=>{
  const mobile=createWorld({width:390,height:844,actorHeight:150,bodyRadius:33,floorY:826,platforms:[
    {id:'collection:all',rect:{left:32,top:631.359,width:211,height:102}},
    {id:'collection:cs',rect:{left:32,top:798.359,width:211,height:126.5}},
    {id:'portal',rect:{left:42,top:399.359,width:118,height:116}},
  ]});
  const journey=planRequestPending(mobile,'collection:all',{id:1,operation:'search',active:true,destinationId:'collection:all'},{...atFloor,at:{x:345,y:826}});
  assert.equal(journey.final.storageId,'collection:all'); assert.equal(journey.final.phase,'checking-storage');
  assert.ok(journey.segments.some(segment=>segment.phase==='climbing-ladder'));
});

const expandedHome={left:1073.8125,top:347.640625,width:126,height:12};
const expandedRoom=createWorld({width:1280,height:900,actorHeight:180,bodyRadius:39.6,floorY:882,platforms:[
  {id:'keeper-home',rect:expandedHome},
  {id:'collection:all',rect:{left:95.1875,top:204.203125,width:401.546875,height:108}},
  {id:'collection:cs',rect:{left:69.1875,top:382.203125,width:453.546875,height:108}},
  {id:'collection:design',rect:{left:69.1875,top:821.203125,width:211.765625,height:108}},
  {id:'collection:reading',rect:{left:310.953125,top:821.203125,width:211.78125,height:108}},
  {id:'reading-desk',rect:{left:662.734375,top:413.640625,width:561.078125,height:12}},
  {id:'composer',rect:{left:672.734375,top:417.640625,width:541.078125,height:65}},
],obstacles:[
  {id:'guide',rect:{left:672.734375,top:28.953125,width:541.078125,height:209.6875}},
  {id:'toolbar',rect:{left:672.734375,top:482.640625,width:541.078125,height:42}},
  {id:'result',rect:{left:673.734375,top:732.8125,width:525.078125,height:167.1875}},
  ...[547.203125,612.203125,677.203125].map((top,i)=>({id:`doc:${i}`,rect:{left:82.1875,top,width:427.546875,height:65}})),
]});

test('live expanded Computer science is reachable from All, and the next request can get back',()=>{
  const all=expandedRoom.platforms.find(surface=>surface.id==='collection:all');
  const first=planRequestPending(expandedRoom,'keeper-home',{id:2,operation:'search',active:false,outcome:'success',destinationId:'collection:cs'},{...idleBeat(all.rect),supportId:'collection:all'});
  assert.equal(first.final.phase,'source-presented');assert.equal(first.final.supportId,'collection:cs');
  assert.ok(first.segments.some(segment=>segment.phase==='descending-ladder'));
  const second=planRequestPending(expandedRoom,'keeper-home',{id:3,operation:'search',active:true,destinationId:'collection:all'},first.final);
  assert.equal(second.final.phase,'checking-storage');assert.equal(second.final.storageId,'collection:all');
});

test('a cached Computer science response during the initial rise resumes the actual home support',()=>{
  const activity={id:4,operation:'search',active:true,destinationId:'collection:cs'};
  const journey=planRequestPending(expandedRoom,'keeper-home',activity,{...idleBeat(expandedHome),supportId:'keeper-home'});
  const rise=journey.segments[0];
  assert.equal(rise.phase,'getting-up');
  for(let t=0;t<rise.duration;t+=1/12) {
    const interrupted=sampleJourney(journey,t);
    const resumed=planRequestPending(expandedRoom,'keeper-home',{...activity,active:false,outcome:'success'},interrupted);
    near(resumed.initial.at.x,interrupted.at.x);near(resumed.initial.at.y,interrupted.at.y);
    assert.equal(resumed.segments[0].to.supportId,'keeper-home',`recovery at ${t} must finish on its real support`);
    near(resumed.segments[0].to.at.y,expandedHome.top);
    assert.equal(resumed.final.phase,'source-presented',`response at ${t} must reach its selected chest`);
    assert.equal(resumed.final.supportId,'collection:cs');
  }
});

test('a layout replan during the initial rise preserves its source support and still reaches the selected chest',()=>{
  const activity={id:4,operation:'search',active:true,destinationId:'collection:cs'};
  const journey=planRequestPending(expandedRoom,'keeper-home',activity,{...idleBeat(expandedHome),supportId:'keeper-home'});
  const interrupted=sampleJourney(journey,.25);
  const shift=37;
  const moved=createWorld({...expandedRoom,bodyRadius:expandedRoom.halfWidth,platforms:expandedRoom.platforms.map(surface=>({...surface,rect:{...surface.rect,top:surface.rect.top+shift}})),obstacles:expandedRoom.obstacles.map(surface=>({...surface,rect:{...surface.rect,top:surface.rect.top+shift}}))});
  const carried={...interrupted,at:{...interrupted.at,y:interrupted.at.y+shift},groundY:interrupted.groundY+shift};
  const resumed=planRequestPending(moved,'keeper-home',activity,carried);
  near(resumed.initial.at.y,carried.at.y);
  assert.equal(resumed.segments[0].to.supportId,'keeper-home');
  near(resumed.segments[0].to.at.y,expandedHome.top+shift);
  assert.equal(resumed.final.phase,'checking-storage');assert.equal(resumed.final.storageId,'collection:cs');
});

test('a response at any drawing frame of the live home-to-CS route remains continuous and reaches that chest',()=>{
  const activity={id:5,operation:'search',active:true,destinationId:'collection:cs'};
  const journey=planRequestPending(expandedRoom,'keeper-home',activity,{...idleBeat(expandedHome),supportId:'keeper-home'});
  for(let t=0;t<journey.duration;t+=1/12) {
    const interrupted=sampleJourney(journey,t);
    const resumed=planRequestPending(expandedRoom,'keeper-home',{...activity,active:false,outcome:'success'},interrupted);
    near(resumed.initial.at.x,interrupted.at.x);near(resumed.initial.at.y,interrupted.at.y);
    assert.equal(resumed.final.phase,'source-presented',`${interrupted.phase} at ${t} must reach its selected chest`);
    assert.equal(resumed.final.supportId,'collection:cs');
  }
});

test('closing Computer science contents preserves its chest width and allows the next All request',()=>{
  const first=planRequestPending(expandedRoom,'keeper-home',{id:6,operation:'search',active:false,outcome:'success',destinationId:'collection:cs'},{...idleBeat(expandedHome),supportId:'keeper-home'});
  assert.equal(first.final.supportId,'collection:cs');
  // Single-column chests keep their physical width when their document list
  // closes. The page scroll changes and the lower chests move back up.
  const shift=75;
  const fixedRoom=createWorld({...expandedRoom,bodyRadius:expandedRoom.halfWidth,platforms:[
    ...expandedRoom.platforms.filter(surface=>!surface.id.startsWith('collection:')).map(surface=>({...surface,rect:{...surface.rect,top:surface.rect.top+shift}})),
    ...['all','cs','design','reading'].map((id,i)=>({id:`collection:${id}`,rect:{left:69.1875,top:279.203125+i*178,width:453.546875,height:Math.min(108,900-(279.203125+i*178))}})),
  ],obstacles:expandedRoom.obstacles.filter(surface=>!surface.id.startsWith('doc:')).map(surface=>({...surface,rect:{...surface.rect,top:surface.rect.top+shift,height:Math.min(surface.rect.height,900-surface.rect.top-shift)}}))});
  const carried={...first.final,at:{...first.final.at,y:first.final.at.y+shift},groundY:first.final.groundY+shift};
  const next=planRequestPending(fixedRoom,'keeper-home',{id:7,operation:'search',active:false,outcome:'success',destinationId:'collection:all'},carried);
  near(next.initial.at.x,carried.at.x);near(next.initial.at.y,carried.at.y);
  assert.ok(next.segments.some(segment=>segment.phase==='descending-ladder'));
  assert.equal(next.final.phase,'source-presented');assert.equal(next.final.supportId,'collection:all');
});

test('success during every CS-to-All frame preserves chest entry support and completes on All',()=>{
  const fixedRoom=createWorld({...expandedRoom,bodyRadius:expandedRoom.halfWidth,platforms:[
    ...expandedRoom.platforms.filter(surface=>!surface.id.startsWith('collection:')),
    ...['all','cs','design','reading'].map((id,i)=>({id:`collection:${id}`,rect:{left:69.1875,top:204.203125+i*178,width:453.546875,height:108}})),
  ],obstacles:expandedRoom.obstacles.filter(surface=>!surface.id.startsWith('doc:'))});
  const source=planRequestPending(fixedRoom,'keeper-home',{id:8,operation:'search',active:false,outcome:'success',destinationId:'collection:cs'},{...idleBeat(expandedHome),supportId:'keeper-home'}).final;
  const activity={id:9,operation:'search',active:true,destinationId:'collection:all'};
  const journey=planRequestPending(fixedRoom,'keeper-home',activity,source);
  let partialEntries=0;
  for(let t=0;t<journey.duration;t+=1/12) {
    const interrupted=sampleJourney(journey,t);
    const resumed=planRequestPending(fixedRoom,'keeper-home',{...activity,active:false,outcome:'success'},interrupted);
    near(resumed.initial.at.x,interrupted.at.x);near(resumed.initial.at.y,interrupted.at.y);
    if(interrupted.storageId==='collection:cs' && interrupted.depth>0 && interrupted.depth<.5) {
      partialEntries++;
      assert.equal(resumed.segments[0].to.supportId,'collection:cs');
      near(resumed.segments[0].to.at.x,interrupted.at.x);
    }
    assert.equal(resumed.final.phase,'source-presented',`${interrupted.phase} at ${t} must finish presenting at All`);
    assert.equal(resumed.final.supportId,'collection:all');
  }
  assert.ok(partialEntries>0,'the regression must cover partly entering the source chest');
});
