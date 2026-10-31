import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const art = path.join(root, 'art/sketch-motion-v3');
const output = path.join(root, 'public/character-motion-v3');
const W = 256, H = 320, baseline = 304;
const command = args => execFileSync('convert', args, { encoding: 'utf8' });
const specs = {
  walk: { source: 'walk', count: 12, rows: 2, scale: 255 / 407, fps: 8, loop: true },
  away: { source: 'away', count: 8, rows: 2, scale: 255 / 475, order: [0, 1, 2, 3, 5, 6, 7, 4], fps: 6, loop: true },
  crawl: { source: 'crawl', count: 8, rows: 2, scale: .52, fps: 6, loop: true },
  climb: { source: 'climb', count: 12, rows: 3, scale: .81, fps: 8, loop: true },
  picked: { source: 'pickup', sourceCount: 8, count: 4, rows: 2, start: 0, scale: .51, fps: 4, loop: true },
  landing: { source: 'pickup', sourceCount: 8, count: 4, rows: 2, start: 4, scale: .51, fps: 8, loop: false },
};

// Inspected landmarks in each generated figure's bounding box. Coordinates
// follow the near/far ink identity rather than assuming the rightmost shoe is
// always the same anatomical leg. White = near; hatched = far. These are contact
// guides for the browser world, not synthetic animation or image modifications.
// Each row: nearFoot, farFoot, nearHand, farHand, seat, collar.
const points = {
  walk: [
    [[.85,.97],[.13,.97],[.13,.64],[.75,.64],[.49,.61],[.53,.31]],
    [[.83,.97],[.12,.83],[.59,.65],[.56,.61],[.53,.61],[.58,.31]],
    [[.81,.97],[.12,.85],[.35,.66],[.77,.65],[.50,.61],[.58,.31]],
    [[.38,.97],[.67,.78],[.55,.61],[.62,.58],[.46,.61],[.53,.31]],
    [[.15,.97],[.86,.96],[.75,.61],[.67,.59],[.48,.61],[.52,.31]],
    [[.14,.97],[.88,.95],[.70,.61],[.27,.64],[.49,.61],[.53,.31]],
    [[.11,.97],[.86,.98],[.17,.66],[.73,.64],[.49,.61],[.53,.31]],
    [[.12,.97],[.84,.96],[.63,.65],[.58,.60],[.49,.61],[.53,.31]],
    [[.78,.85],[.13,.97],[.16,.66],[.55,.63],[.49,.61],[.53,.31]],
    [[.66,.82],[.18,.98],[.68,.59],[.57,.58],[.49,.61],[.53,.31]],
    [[.88,.97],[.12,.97],[.69,.63],[.58,.59],[.49,.61],[.53,.31]],
    [[.86,.97],[.13,.93],[.23,.65],[.71,.61],[.49,.61],[.53,.31]],
  ],
  away: [
    [[.84,.94],[.13,.96],[.16,.63],[.80,.60],[.52,.61],[.51,.24]],
    [[.80,.97],[.10,.83],[.20,.63],[.87,.58],[.52,.61],[.51,.24]],
    [[.27,.98],[.72,.78],[.15,.63],[.87,.58],[.52,.61],[.51,.24]],
    [[.13,.96],[.84,.94],[.26,.62],[.85,.60],[.52,.61],[.51,.24]],
    [[.85,.96],[.14,.98],[.13,.63],[.83,.60],[.52,.61],[.51,.24]],
    [[.12,.81],[.79,.97],[.17,.63],[.87,.60],[.52,.61],[.51,.24]],
    [[.72,.85],[.29,.97],[.18,.62],[.86,.59],[.52,.61],[.51,.24]],
    [[.84,.95],[.11,.97],[.18,.63],[.85,.60],[.52,.61],[.51,.24]],
  ],
  crawl: [
    [[.06,.86],[.34,.88],[.88,.96],[.84,.83],[.32,.52],[.61,.45]],
    [[.06,.84],[.30,.86],[.76,.96],[.92,.75],[.31,.53],[.57,.45]],
    [[.07,.87],[.33,.86],[.76,.96],[.92,.72],[.31,.53],[.57,.45]],
    [[.06,.88],[.28,.85],[.61,.96],[.92,.91],[.29,.52],[.59,.45]],
    [[.22,.94],[.05,.84],[.62,.96],[.92,.88],[.29,.52],[.59,.45]],
    [[.25,.86],[.06,.85],[.77,.95],[.93,.84],[.30,.52],[.59,.45]],
    [[.07,.83],[.40,.88],[.92,.88],[.71,.95],[.30,.52],[.59,.45]],
    [[.06,.84],[.33,.87],[.92,.96],[.77,.80],[.30,.52],[.59,.45]],
  ],
  climb: [
    [[.26,.97],[.74,.76],[.91,.09],[.80,.39],[.48,.58],[.58,.31]],
    [[.38,.97],[.75,.67],[.91,.08],[.69,.39],[.50,.56],[.58,.31]],
    [[.30,.96],[.76,.73],[.78,.08],[.92,.25],[.48,.59],[.58,.31]],
    [[.85,.68],[.31,.97],[.85,.22],[.72,.08],[.48,.59],[.58,.31]],
    [[.87,.72],[.32,.97],[.80,.39],[.85,.07],[.48,.60],[.58,.31]],
    [[.84,.73],[.31,.98],[.78,.40],[.85,.08],[.48,.60],[.58,.31]],
    [[.86,.71],[.32,.98],[.80,.39],[.72,.07],[.48,.60],[.58,.31]],
    [[.82,.73],[.31,.98],[.82,.39],[.85,.07],[.48,.60],[.58,.31]],
    [[.29,.97],[.78,.72],[.92,.16],[.71,.06],[.48,.60],[.58,.31]],
    [[.30,.97],[.80,.74],[.81,.07],[.70,.38],[.48,.60],[.58,.31]],
    [[.78,.72],[.30,.98],[.84,.08],[.78,.40],[.48,.60],[.58,.31]],
    [[.30,.97],[.80,.74],[.86,.07],[.80,.40],[.48,.60],[.58,.31]],
  ],
  picked: [
    [[.26,.96],[.53,.96],[.27,.64],[.57,.63],[.44,.61],[.30,.25]],
    [[.59,.96],[.25,.78],[.42,.63],[.85,.61],[.48,.59],[.26,.25]],
    [[.31,.96],[.65,.81],[.15,.66],[.70,.64],[.46,.60],[.25,.25]],
    [[.46,.95],[.80,.89],[.42,.65],[.71,.60],[.47,.61],[.27,.25]],
  ],
  landing: [
    [[.15,.94],[.82,.83],[.56,.95],[.56,.61],[.23,.52],[.45,.38]],
    [[.33,.95],[.76,.93],[.39,.64],[.64,.61],[.34,.60],[.45,.34]],
    [[.32,.96],[.78,.94],[.43,.68],[.65,.66],[.42,.62],[.45,.32]],
    [[.34,.96],[.77,.94],[.26,.68],[.69,.64],[.46,.62],[.45,.29]],
  ],
};
const supports = {
  walk: ['near-heel','near-foot','near-foot','near-foot','far-heel','far-foot','far-foot','far-foot','far-foot','far-foot','near-heel','near-foot'],
  away: ['near-heel','near-foot','near-foot','far-heel','near-heel','far-foot','far-foot','near-heel'],
  crawl: ['near-hand+far-knee','near-hand+far-knee','near-hand+far-knee','far-hand+near-knee','far-hand+near-knee','far-hand+near-knee','far-hand+near-knee','near-hand+far-knee'],
  climb: ['near-hand+far-foot','near-hand+far-foot','near-hand+far-foot','far-hand+near-foot','far-hand+near-foot','far-hand+near-foot','far-hand+near-foot','far-hand+near-foot','far-hand+near-foot','near-hand+far-foot','near-hand+far-foot','near-hand+far-foot'],
  picked: ['airborne','airborne','airborne','airborne'],
  landing: ['both-feet+near-hand','both-feet','both-feet','both-feet'],
};

function figuresFor(source, rows, expected) {
  const metadata = JSON.parse(execFileSync('identify', ['-format','{"width":%w,"height":%h}',source], {encoding:'utf8'}));
  const rowsText = command([source,'-alpha','extract','-threshold','50%','-define','connected-components:verbose=true','-connected-components','8','null:']);
  const figures = rowsText.split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+): (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) (\d+) gray\(255\)/);
    return m && +m[8] > 10000 ? [{id:+m[1],w:+m[2],h:+m[3],x:+m[4],y:+m[5],cx:+m[6],cy:+m[7]}] : [];
  }).sort((a,b) => Math.floor(a.cy / (metadata.height / rows)) - Math.floor(b.cy / (metadata.height / rows)) || a.cx-b.cx);
  if(figures.length !== expected) throw Error(`${source}: ${figures.length} figures, expected ${expected}`);
  return {figures,metadata};
}

const manifest = {
  version: 1, width: W, height: H, anchor: [.5,.95], uniqueDrawings: 48,
  production: '48 separately generated raster drawings with complete near/far support cycles. Frames are extracted, resized and anchored; no invented tween poses or repeated one-legged cycles.',
  anchorConvention: 'feet is the floor reference at y=.95; nearFoot/farFoot identify actual shoe landmarks, nearHand/farHand actual palms. White limbs are near, hatched limbs far. hand follows the planted/reaching hand for each state. seat is a hip guide, not a seat contact except explicit seated states. All coordinates are normalized to the full 256x320 canvas.',
  states: {},
};
const report = [];
for(const [name,spec] of Object.entries(specs)) {
  const source = path.join(art,`${spec.source}-source.png`);
  const {figures,metadata} = figuresFor(source,spec.rows,spec.sourceCount??spec.count);
  const dir=path.join(output,name);fs.mkdirSync(dir,{recursive:true});
  const frames=[],frameAnchors=[],frameContacts=[];
  for(let i=0;i<spec.count;i++) {
    const sourceIndex = spec.order?.[i] ?? i;
    const figure=figures[sourceIndex+(spec.start??0)],pad=3;
    const x=Math.max(0,figure.x-pad),y=Math.max(0,figure.y-pad);
    const cw=Math.min(figure.w+pad*2,metadata.width-x),ch=Math.min(figure.h+pad*2,metadata.height-y);
    const mask=path.join(art,'.mask.png'), isolated=path.join(art,'.isolated.png');
    // Connected-component extraction only: preserve generated RGB and alpha.
    // The extraction matte excludes unrelated semi-transparent sheet haze.
    command([source,'-alpha','extract','-threshold','50%','-define','connected-components:mean-color=true','-define',`connected-components:keep=${figure.id}`,'-connected-components','8','-morphology','Dilate','Disk:3','-alpha','copy',mask]);
    command([source,mask,'-compose','DstIn','-composite','-crop',`${cw}x${ch}+${x}+${y}`,'+repage',isolated]);
    const tw=Math.round(cw*spec.scale),th=Math.round(ch*spec.scale);
    const ox=Math.round((W-tw)/2),oy=baseline-th;
    if(ox<4||oy<4)throw Error(`Frame ${name}/${i} exceeds canvas`);
    const stem=String(i).padStart(2,'0'),png=path.join(dir,`${stem}.png`);
    await sharp(isolated).resize(tw,th).extend({left:ox,right:W-tw-ox,top:oy,bottom:H-th-oy,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(png);
    await sharp(png).webp({lossless:true}).toFile(path.join(dir,`${stem}.webp`));
    const pointRow=points[name][sourceIndex];
    const transform=([px,py])=>[(ox+((figure.x-x)+px*figure.w)*spec.scale)/W,(oy+((figure.y-y)+py*figure.h)*spec.scale)/H];
    const [nearFoot,farFoot,nearHand,farHand,seat,collar]=pointRow.map(transform);
    const support=supports[name][sourceIndex];
    const hand=support.startsWith('far-hand')?farHand:nearHand;
    const anchors={feet:[.5,.95],hand,seat,collar,nearFoot,farFoot,nearHand,farHand};
    frames.push(`/character-motion-v3/${name}/${stem}.webp`);frameAnchors.push(anchors);frameContacts.push(support);
    report.push({state:name,index:i,sourceIndex,source:spec.source,figure,crop:[x,y,cw,ch],scale:spec.scale,offset:[ox,oy],anchors,support});
  }
  manifest.states[name]={frames,fps:spec.fps,loop:spec.loop,anchors:frameAnchors[0],frameAnchors,frameContacts};
  execFileSync('montage',[...frames.map(f=>path.join(root,'public',f)),'-background','white','-alpha','remove','-alpha','off','-thumbnail','192x240','-tile','4x','-geometry','+12+12',path.join(art,`${name}-contact.png`)]);
}
manifest.states.walk.cycleSteps=2;
manifest.states.away.cycleSteps=2;
manifest.states.crawl.cycleSteps=2;
manifest.states.climb.cycleSteps=2;
manifest.states.climb.contactNotes='Frames 0-2 near hand high/far knee high; 3-8 far hand high/near knee high; 9-11 transfer back. Keep phase across the full two-rung cycle.';
manifest.states.crawl.contactNotes='Frames 0-2 near palm supports while far hand reaches; 3-5 far palm supports while near knee advances; 6 near palm reaches; 7 near palm plants. Preserve low horizontal torso scale.';
manifest.states.picked.contactNotes='Attach the cursor to collar, not feet; hanging feet and asymmetric knees are real drawn poses.';
manifest.states.landing.contactNotes='Four impact-to-recovery drawings at common body scale, feet on baseline; frame 0 is compressed, frame 3 standing.';
fs.writeFileSync(path.join(output,'manifest-fragment.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(art,'packaging.json'),JSON.stringify(report,null,2)+'\n');
for(const name of ['.mask.png','.isolated.png'])fs.rmSync(path.join(art,name),{force:true});
console.log('Packaged walk12, away8, crawl8, climb12, picked4, landing4 (48 unique drawings).');
