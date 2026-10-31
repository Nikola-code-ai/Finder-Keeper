import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const art=path.join(root,'art');
const output=path.join(root,'public/character');
const W=384,H=512,baseline=492;
const run=(args)=>execFileSync('convert',args,{encoding:'utf8'});
const specifications={
  idle:{source:'idle-source.png',heights:Array(12).fill(336),fps:3,loop:true},
  stand:{source:'stand-source.png',heights:[336,344,350,372,380,404,428,448,448,448,448,448],fps:8,loop:false},
  walkAway:{source:'walk-away-source.png',heights:[448,446,445,447,448,449,448,446,445,447,448,449],fps:10,loop:true},
  walkBack:{source:'walk-back-source.png',heights:[448,446,445,447,448,449,448,446,445,447,448,449],fps:10,loop:true},
  sit:{source:'sit-source.png',heights:[448,438,420,400,378,360,344,336,336,336,336,336],fps:8,loop:false},
};
function bounds(file){
  const info=run([file,'-alpha','extract','-threshold','10%','-define','connected-components:verbose=true','-connected-components','8','null:']);
  const found=[];
  for(const line of info.split('\n')){
    const m=line.match(/^\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) (\d+) gray\(255\)/);
    if(m && +m[7]>10000)found.push({w:+m[1],h:+m[2],x:+m[3],y:+m[4],cx:+m[5],cy:+m[6],area:+m[7]});
  }
  // Sorting by centroid rows handles generated sheets whose rows have unequal heights.
  found.sort((a,b)=>Math.floor(a.cy/418)-Math.floor(b.cy/418)||a.cx-b.cx);
  return found;
}
const manifest={version:1,name:'The Keeper',width:W,height:H,anchor:{x:.5,y:baseline/H},hero:'/character/hero.webp',box:'/character/box.webp',seated:'/character/seated.webp',reducedMotion:'/character/idle/00.webp',uniqueDrawings:60,production:'AI-assisted hand-drawn-style raster animation; discrete poses with frame-by-frame playback.',sequences:{}};
const report=[];
for(const [name,spec] of Object.entries(specifications)){
  const source=path.join(art,spec.source), boxes=bounds(source);
  if(boxes.length!==12)throw Error(`${name}: expected 12 distinct sprites, found ${boxes.length}`);
  const dir=path.join(output,name);fs.mkdirSync(dir,{recursive:true});
  const frames=[];
  boxes.forEach((b,i)=>{
    const pad=2,x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad),w=b.w+pad*2,h=b.h+pad*2;
    const targetHeight=spec.heights[i],targetWidth=Math.round(w/h*targetHeight);
    const ox=Math.round((W-targetWidth)/2),oy=baseline-targetHeight;
    const filename=String(i).padStart(2,'0')+'.png';
    // Crop/scale/anchor are atlas packaging only; every drawing is generated artwork.
    run([source,'-crop',`${w}x${h}+${x}+${y}`,'+repage','-resize',`${targetWidth}x${targetHeight}!`,'-background','none','-gravity','northwest','-splice',`${ox}x${oy}`,'-extent',`${W}x${H}`,path.join(dir,filename)]);
    const optimized=filename.replace('.png','.webp');
    run([path.join(dir,filename),'-quality','92','-define','webp:alpha-quality=100',path.join(dir,optimized)]);
    frames.push(`/character/${name}/${optimized}`);
    report.push({sequence:name,index:i,sourceBounds:b,height:targetHeight,x:ox,y:oy});
  });
  manifest.sequences[name]={frames,fps:spec.fps,loop:spec.loop};
  const atlasPath=path.join(output,`${name}-atlas.webp`);
  execFileSync('montage',[...frames.map(f=>path.join(root,'public',f)),'-tile','4x3','-geometry',`${W}x${H}+0+0`,'-background','none','-quality','92',atlasPath]);
  manifest.sequences[name].atlas={url:`/character/${name}-atlas.webp`,columns:4,rows:3,frameWidth:W,frameHeight:H};
}
// The crate is behind the actor, aligned to the seated hip plane. Same canvas as every actor frame.
run([path.join(art,'box-source.png'),'-trim','+repage','-resize','222x160!','-background','none','-gravity','northwest','-splice','104x318','-extent',`${W}x${H}`,path.join(output,'box.png')]);
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(art,'frame-packaging.json'),JSON.stringify(report,null,2)+'\n');
// Static composed fallback with precisely the same actor/prop placement as the player.
run([path.join(output,'box.png'),path.join(output,'idle/00.png'),'-compose','over','-composite',path.join(output,'seated.png')]);
for(const stem of ['box','seated','hero'])run([path.join(output,`${stem}.png`),'-quality','92','-define','webp:alpha-quality=100',path.join(output,`${stem}.webp`)]);
for(const name of Object.keys(specifications)){
  const frames=manifest.sequences[name].frames.map(f=>path.join(root,'public',f));
  execFileSync('montage',[...frames,'-thumbnail','192x256','-tile','4x3','-geometry','+8+8','-background','#f5f3ed',path.join(art,`${name}-contact.png`)]);
}
console.log('Packaged 60 distinct drawings, five sequences, one aligned stationary crate and seated fallback.');
