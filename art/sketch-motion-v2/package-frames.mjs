import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const art = path.join(root, 'art/sketch-motion-v2');
const out = path.join(root, 'public/character-motion-v2');
const width = 256, height = 320, baseline = 304;
const run = args => execFileSync('convert', args, { encoding: 'utf8' });
const specs = {
  walk: { source: 'walk-source.png', count: 12, rows: 3, referenceHeight: 380, fps: 8, loop: true },
  away: { source: 'away-source.png', count: 12, rows: 3, referenceHeight: 404, fps: 8, loop: true },
  stand: { source: 'stand-source.png', count: 8, rows: 2, targetHeights: [225, 227, 232, 239, 244, 249, 253, 258], fps: 6, loop: false },
};

function findFigures(source, spec) {
  const meta = JSON.parse(execFileSync('identify', ['-format', '{"width":%w,"height":%h}', source], { encoding: 'utf8' }));
  const info = run([source, '-alpha', 'extract', '-threshold', '50%', '-define', 'connected-components:verbose=true', '-connected-components', '8', 'null:']);
  const figures = [];
  for (const line of info.split('\n')) {
    const match = line.match(/^\s*(\d+): (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) (\d+) gray\(255\)/);
    if (match && +match[8] > 10000) figures.push({ id: +match[1], w: +match[2], h: +match[3], x: +match[4], y: +match[5], cx: +match[6], cy: +match[7], area: +match[8] });
  }
  figures.sort((a, b) => Math.floor(a.cy / (meta.height / spec.rows)) - Math.floor(b.cy / (meta.height / spec.rows)) || a.cx - b.cx);
  if (figures.length !== spec.count) throw Error(`${source}: expected ${spec.count} figures, found ${figures.length}`);
  return { figures, meta };
}

const manifest = {
  version: 1, width, height, anchor: [.5, .95], uniqueDrawings: 32,
  production: '32 separately generated raster drawings. Sprite extraction, rescaling, and anchoring only; no artificial inbetween poses or crossfades.',
  preserves: '/character-sketch/idle/00.webp',
  states: {},
};
const report = [];

for (const [name, spec] of Object.entries(specs)) {
  const source = path.join(art, spec.source);
  const { figures, meta } = findFigures(source, spec);
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  const frames = [], frameAnchors = [];

  for (let i = 0; i < figures.length; i++) {
    const figure = figures[i], pad = 3;
    const x = Math.max(0, figure.x - pad), y = Math.max(0, figure.y - pad);
    const cropWidth = Math.min(figure.w + pad * 2, meta.width - x);
    const cropHeight = Math.min(figure.h + pad * 2, meta.height - y);
    const mask = path.join(art, '.mask.png'), isolated = path.join(art, '.isolated.png');
    // Isolate generated opaque drawing; this also excludes semitransparent sheet halos.
    run([source, '-alpha', 'extract', '-threshold', '50%', '-define', 'connected-components:mean-color=true', '-define', `connected-components:keep=${figure.id}`, '-connected-components', '8', '-morphology', 'Dilate', 'Disk:3', '-alpha', 'copy', mask]);
    run([source, mask, '-compose', 'DstIn', '-composite', '-crop', `${cropWidth}x${cropHeight}+${x}+${y}`, '+repage', isolated]);
    const { data } = await sharp(isolated).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let weight = 0, weightedX = 0;
    for (let yy = Math.floor(cropHeight * .9); yy < cropHeight; yy++) for (let xx = 0; xx < cropWidth; xx++) {
      const alpha = data[(yy * cropWidth + xx) * 4 + 3];
      if (alpha > 128) { weight += alpha; weightedX += xx * alpha; }
    }
    const footX = weight ? weightedX / weight : cropWidth / 2;
    const scale = spec.targetHeights ? spec.targetHeights[i] / cropHeight : 255 / spec.referenceHeight;
    const targetWidth = Math.round(cropWidth * scale), targetHeight = Math.round(cropHeight * scale);
    let offsetX = Math.round(width * .5 - footX * scale);
    offsetX = Math.max(4, Math.min(width - targetWidth - 4, offsetX));
    const offsetY = baseline - targetHeight;
    if (offsetY < 0 || targetWidth > width) throw Error(`${name}/${i}: sprite exceeds canvas`);
    const stem = String(i).padStart(2, '0'), png = path.join(dir, `${stem}.png`), webp = path.join(dir, `${stem}.webp`);
    await sharp(isolated).resize(targetWidth, targetHeight).extend({ left: offsetX, right: width - targetWidth - offsetX, top: offsetY, bottom: height - targetHeight - offsetY, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(png);
    await sharp(png).webp({ lossless: true }).toFile(webp);
    const feet = [(offsetX + footX * scale) / width, baseline / height];
    frameAnchors.push({ feet });
    frames.push(`/character-motion-v2/${name}/${stem}.webp`);
    report.push({ state: name, index: i, source: spec.source, component: figure, crop: [x, y, cropWidth, cropHeight], scale, offset: [offsetX, offsetY], feet });
  }

  manifest.states[name] = { frames, fps: spec.fps, loop: spec.loop, anchors: { feet: [.5, .95] }, frameAnchors };
}

// Seat contact landmarks inspected on the generated source drawings. Later poses
// are airborne over the seat and should be pinned by their planted feet instead.
const seatPoints = [[144, 406], [506, 405], [875, 389]];
for (const [i, point] of seatPoints.entries()) {
  const entry = report.find(r => r.state === 'stand' && r.index === i);
  const seat = [(entry.offset[0] + (point[0] - entry.crop[0]) * entry.scale) / width, (entry.offset[1] + (point[1] - entry.crop[1]) * entry.scale) / height];
  manifest.states.stand.frameAnchors[i].seat = seat;
  entry.sourceSeat = point;
  entry.seat = seat;
}
manifest.states.stand.anchors.seat = manifest.states.stand.frameAnchors[0].seat;
manifest.states.stand.contactNotes = 'Frames 0–1 settle forward on the invisible seat; frame 2 is the final forward shift; frames 3–7 have left the seat and use the feet anchor.';
manifest.states.walk.anchors.hand = [.52, .66];
manifest.states.away.anchors.hand = [.57, .66];

fs.writeFileSync(path.join(out, 'manifest-fragment.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(art, 'frame-packaging.json'), JSON.stringify(report, null, 2) + '\n');
for (const [name, state] of Object.entries(manifest.states)) {
  execFileSync('montage', [...state.frames.map(f => path.join(root, 'public', f)), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-thumbnail', '128x160', '-tile', '6x', '-geometry', '+8+8', path.join(art, `${name}-contact.png`)]);
}
for (const temp of ['.mask.png', '.isolated.png']) fs.rmSync(path.join(art, temp), { force: true });
console.log('Packaged 32 drawings: walk12, away12, stand8. Original character manifest and idle untouched.');
