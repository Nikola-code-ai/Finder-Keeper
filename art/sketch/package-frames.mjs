import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'../..');
const art=path.join(root,'art/sketch'), out=path.join(root,'public/character-sketch');
const W=256,H=320,baseline=304;
const run=args=>execFileSync('convert',args,{encoding:'utf8'});
const sheets={
 'walk-away-source.png':{ref:475,states:[['walk',0,6,5],['away',6,6,4]]},
 'perch-rise-peek-source.png':{ref:453,states:[['idle',0,4,2],['stand',4,4,4],['peek',8,4,3]]},
 'actions-source.png':{ref:451,states:[['reach',0,4,4],['rummage',4,4,4],['pull',8,4,4]]},
 'carry-shrug-search-source.png':{ref:478,states:[['carry',0,4,4],['shrug',4,4,3],['search',8,4,4]]},
};
function components(source){
 const meta=JSON.parse(execFileSync('identify',['-format','{"width":%w,"height":%h}',source],{encoding:'utf8'}));
 const info=run([source,'-alpha','extract','-threshold','50%','-define','connected-components:verbose=true','-connected-components','8','null:']);
 const b=[];
 for(const l of info.split('\n')){const m=l.match(/^\s*(\d+): (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) (\d+) gray\(255\)/);if(m&&+m[8]>10000)b.push({id:+m[1],w:+m[2],h:+m[3],x:+m[4],y:+m[5],cx:+m[6],cy:+m[7],area:+m[8]});}
 b.sort((a,b)=>Math.floor(a.cy/(meta.height/3))-Math.floor(b.cy/(meta.height/3))||a.cx-b.cx);
 if(b.length!==12)throw Error(`${source} has ${b.length} sprites`);
 return b;
}
const manifest={version:2,name:'Keeper — rough ink',width:W,height:H,anchor:[.5,.95],defaultState:'idle',reducedMotion:'/character-sketch/idle/00.webp',uniqueDrawings:48,production:'48 distinct AI-generated black-ink-style drawings, cropped from four source sheets; no pose is synthesized by transforms.',states:{}};
const report=[];
for(const [filename,spec] of Object.entries(sheets)){
 const source=path.join(art,filename), boxes=components(source);
 for(const [name,start,count,fps] of spec.states){
  const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});const frames=[],frameAnchors=[];
  for(let i=0;i<count;i++){
   const b=boxes[start+i],pad=3,x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad),cw=Math.min(b.w+pad*2,JSON.parse(execFileSync('identify',['-format','{"w":%w}',source])).w-x),ch=b.h+pad*2;
   const mask=path.join(art,'.mask.png'),isolated=path.join(art,'.isolated.png');
   // Sprite-sheet extraction only: retain generated RGBA pixels inside this connected figure.
   // Expand its segmentation mask to preserve antialiased contours; discard neighboring sprites.
   run([source,'-alpha','extract','-threshold','50%','-define','connected-components:mean-color=true',`-define`,`connected-components:keep=${b.id}`,'-connected-components','8','-morphology','Dilate','Disk:3','-alpha','copy',mask]);
   run([source,mask,'-compose','DstIn','-composite','-crop',`${cw}x${ch}+${x}+${y}`,'+repage',isolated]);
   const {data,info}=await sharp(isolated).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let weight=0,footSum=0;
   for(let yy=Math.floor(ch*.9);yy<ch;yy++)for(let xx=0;xx<cw;xx++){const a=data[(yy*cw+xx)*4+3];if(a>128){weight+=a;footSum+=xx*a;}}
   const footX=weight?footSum/weight:cw/2;
   let scale=260/spec.ref;
   // Preserve relative pose heights; only constrain broad arm gestures to the shared canvas.
   scale=Math.min(scale,240/cw);
   let tw=Math.round(cw*scale),th=Math.round(ch*scale),ox=Math.round(W*.5-footX*scale),oy=baseline-th;
   ox=Math.max(6,Math.min(W-tw-6,ox));
   const png=path.join(dir,`${String(i).padStart(2,'0')}.png`), webp=png.replace('.png','.webp');
   await sharp(isolated).resize(tw,th).extend({left:ox,right:W-tw-ox,top:oy,bottom:H-th-oy,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(png);
   await sharp(png).webp({lossless:true}).toFile(webp);
   const feet=[(ox+footX*scale)/W,baseline/H];
   frames.push(`/character-sketch/${name}/${String(i).padStart(2,'0')}.webp`);
   frameAnchors.push({feet});report.push({state:name,index:i,source:filename,component:b,scale,offset:[ox,oy],crop:[x,y,cw,ch],feet});
  }
  manifest.states[name]={frames,fps,loop:!['stand','reach','pull','peek','shrug'].includes(name),anchors:{feet:[.5,.95]},frameAnchors};
 }
}
// Carefully measured contact positions are specified in final-canvas coordinates below.
const anchors={idle:{seat:[.31,.72],hand:[.62,.38]},stand:{seat:[.31,.72],hand:[.58,.66]},walk:{hand:[.52,.66]},away:{hand:[.57,.66]},reach:{hand:[.92,.42]},pull:{hand:[.88,.49]},rummage:{hand:[.76,.63]},search:{hand:[.78,.60]},peek:{hand:[.86,.50]},carry:{hand:[.53,.47]},shrug:{hand:[.79,.68]}};
for(const [name,a]of Object.entries(anchors))Object.assign(manifest.states[name].anchors,a);
// Hand and seat landmarks measured against the original drawings, converted to
// normalized final-canvas coordinates. Consumers may use frameAnchors for contact.
const landmarks={
 idle:{seat:[[124,286],[431,287],[739,288],[1060,286]]},
 reach:{hand:[[278,190],[516,216],[747,220],[1014,223]]},
 pull:{hand:[[249,1210],[502,1217],[759,1220],[1008,1216]]},
 rummage:{hand:[[250,823],[469,758],[729,819],[970,773]]},
 search:{hand:[[224,1296],[484,1270],[756,1290],[1005,1258]]},
 peek:{hand:[[280,1119],[583,1084],[891,1046],[1194,1009]]},
};
for(const [name,kinds] of Object.entries(landmarks))for(const [kind,points] of Object.entries(kinds)){
 const entries=report.filter(r=>r.state===name);
 points.forEach(([px,py],i)=>{const r=entries[i];manifest.states[name].frameAnchors[i][kind]=[(r.offset[0]+(px-r.crop[0])*r.scale)/W,(r.offset[1]+(py-r.crop[1])*r.scale)/H];});
 manifest.states[name].anchors[kind]=manifest.states[name].frameAnchors[name==='idle'?0:points.length-1][kind];
}
manifest.states.rummage.frames.push(...manifest.states.search.frames);
manifest.states.rummage.frameAnchors.push(...manifest.states.search.frameAnchors);
// search alias is intentionally retained for richer storyboards; uniqueDrawings counts source drawings once.
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(art,'frame-packaging.json'),JSON.stringify(report,null,2)+'\n');
for(const name of Object.keys(manifest.states)){
 const frames=manifest.states[name].frames.map(f=>path.join(root,'public',f));
 execFileSync('montage',[...frames,'-background','white','-alpha','remove','-alpha','off','-thumbnail','128x160','-tile','6x','-geometry','+8+8',path.join(art,`${name}-contact.png`)]);
}
for(const f of ['.mask.png','.isolated.png','test-mask.png'])fs.rmSync(path.join(art,f),{force:true});
console.log('Packaged48distinctdrawings in10states plussearchalias.');
