import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'public/character-motion-v3/manifest-fragment.json')));
const expected={walk:12,away:8,crawl:8,climb:12,picked:4,landing:4};
const hashes=new Set(), results=[];
for(const [state,count] of Object.entries(expected)) {
  const spec=manifest.states[state];
  assert.equal(spec.frames.length,count,state);
  assert.equal(spec.frameAnchors.length,count,state);
  assert.equal(spec.frameContacts.length,count,state);
  for(let index=0;index<count;index++) {
    const file=path.join(root,'public',spec.frames[index]);
    const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,256);assert.equal(info.height,320);
    const hash=crypto.createHash('sha256').update(data).digest('hex');
    assert(!hashes.has(hash),`${state}/${index}: duplicate drawing`);hashes.add(hash);
    let minX=256,minY=320,maxX=-1,maxY=-1,opaque=0,transparent=0,chromaMax=0;
    for(let y=0;y<320;y++)for(let x=0;x<256;x++) {
      const offset=(y*256+x)*4,alpha=data[offset+3];
      if(x===0||x===255||y===0||y===319)assert.equal(alpha,0,`${state}/${index}: opaque edge`);
      if(alpha===0)transparent++;
      if(alpha>128){opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);chromaMax=Math.max(chromaMax,Math.max(...data.subarray(offset,offset+3))-Math.min(...data.subarray(offset,offset+3)));}
    }
    assert(transparent>40000,`${state}/${index}: alpha absent`);
    assert(opaque>3000,`${state}/${index}: empty figure`);
    assert(maxY>=300&&maxY<=305,`${state}/${index}: floor baseline`);
    if(state==='crawl')assert(maxY-minY<180,`${state}/${index}: crawl was stretched`);
    for(const [key,point] of Object.entries(spec.frameAnchors[index])) {
      assert.equal(point.length,2);assert(point.every(v=>Number.isFinite(v)&&v>=0&&v<=1),`${state}/${index}/${key}: invalid anchor`);
    }
    results.push({state,index,opaqueBounds:[minX,minY,maxX,maxY],opaquePixels:opaque,transparentPixels:transparent,maxOpaqueChannelDifference:chromaMax});
  }
}
assert.equal(hashes.size,48);assert.equal(manifest.uniqueDrawings,48);
for(const name of ['walk','away']) {
  const deltas=manifest.states[name].frameAnchors.map(a=>a.nearFoot[0]-a.farFoot[0]);
  assert(Math.min(...deltas)<-.1&&Math.max(...deltas)>.1,`${name}: no opposite lead foot`);
}
const climb=manifest.states.climb.frameAnchors.map(a=>a.nearHand[1]-a.farHand[1]);
assert(Math.min(...climb)<-.1&&Math.max(...climb)>.1,'climb: hands do not exchange high rungs');
const crawl=manifest.states.crawl.frameAnchors.map(a=>a.nearHand[0]-a.farHand[0]);
assert(Math.min(...crawl)<-.1&&Math.max(...crawl)>0,'crawl: palms do not exchange lead');
fs.writeFileSync(path.join(import.meta.dirname,'validation.json'),JSON.stringify({drawings:48,passed:true,note:'File/alpha/landmark integrity. Semantic limb alternation was separately inspected on contact sheets; these checks do not replace visual inspection.',results},null,2)+'\n');
const hands=manifest.states.climb.frameAnchors;
console.log(JSON.stringify({passed:true,drawings:48,climbNearHandRange:{x:[Math.min(...hands.map(a=>a.nearHand[0])),Math.max(...hands.map(a=>a.nearHand[0]))],y:[Math.min(...hands.map(a=>a.nearHand[1])),Math.max(...hands.map(a=>a.nearHand[1]))]},climbFarHandRange:{x:[Math.min(...hands.map(a=>a.farHand[0])),Math.max(...hands.map(a=>a.farHand[0]))],y:[Math.min(...hands.map(a=>a.farHand[1])),Math.max(...hands.map(a=>a.farHand[1]))]},maxChannelDifference:Math.max(...results.map(r=>r.maxOpaqueChannelDifference))},null,2));
