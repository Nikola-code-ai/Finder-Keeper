import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const art = path.join(root, 'art/sketch-climb');
const output = path.join(root, 'public/character-climb');
const source = path.join(art, 'climb-source.png');
const W = 256, H = 320, baseline = 304;
const command = args => execFileSync('convert', args, { encoding: 'utf8' });
const metadata = await sharp(source).metadata();
const components = command([source, '-alpha', 'extract', '-threshold', '50%', '-define', 'connected-components:verbose=true', '-connected-components', '8', 'null:']);
const boxes = components.split('\n').flatMap(line => {
  const m = line.match(/^\s*(\d+): (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) (\d+) gray\(255\)/);
  return m && +m[8] > 10000 ? [{ id: +m[1], w: +m[2], h: +m[3], x: +m[4], y: +m[5], cx: +m[6], cy: +m[7] }] : [];
}).sort((a, b) => Math.floor(a.cy / (metadata.height / 3)) - Math.floor(b.cy / (metadata.height / 3)) || a.cx - b.cx);
if (boxes.length !== 12) throw new Error(`Expected 12 drawn poses; found ${boxes.length}`);

const manifest = { width: W, height: H, uniqueDrawings: 12, states: {} };
const report = [];
for (const [name, start, count] of [['climb', 0, 8], ['clamber', 8, 4]]) {
  const dir = path.join(output, name); fs.mkdirSync(dir, { recursive: true });
  const frames = [], frameAnchors = [];
  for (let i = 0; i < count; i++) {
    const box = boxes[start + i], pad = 3;
    const x = box.x - pad, y = box.y - pad, cw = box.w + pad * 2, ch = box.h + pad * 2;
    const mask = path.join(art, '.mask.png'), isolated = path.join(art, '.isolated.png');
    command([source, '-alpha', 'extract', '-threshold', '50%', '-define', 'connected-components:mean-color=true', '-define', `connected-components:keep=${box.id}`, '-connected-components', '8', '-morphology', 'Dilate', 'Disk:3', '-alpha', 'copy', mask]);
    command([source, mask, '-compose', 'DstIn', '-composite', '-crop', `${cw}x${ch}+${x}+${y}`, '+repage', isolated]);
    const { data } = await sharp(isolated).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let weight = 0, sum = 0;
    for (let yy = Math.floor(ch * .92); yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
      const alpha = data[(yy * cw + xx) * 4 + 3];
      if (alpha > 128) { weight += alpha; sum += xx * alpha; }
    }
    const footX = weight ? sum / weight : cw / 2;
    // All poses share scale; cropping only extracts generated pixels.
    const scale = 254 / 320;
    const tw = Math.round(cw * scale), th = Math.round(ch * scale);
    const ox = Math.max(6, Math.min(W - tw - 6, Math.round(W * .5 - footX * scale))), oy = baseline - th;
    const stem = String(i).padStart(2, '0');
    const png = path.join(dir, `${stem}.png`);
    await sharp(isolated).resize(tw, th).extend({ left: ox, right: W - tw - ox, top: oy, bottom: H - th - oy, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(png);
    await sharp(png).webp({ lossless: true }).toFile(path.join(dir, `${stem}.webp`));
    const feet = [(ox + footX * scale) / W, baseline / H];
    // Top-out frames share the seated-foot benchmark used by the scene. The
    // raised shoe, then palms, then hip must meet the actual shelf top.
    const topOutContacts = [null, [622, 938], [1005, 959], [1260, 953]];
    if (name === 'clamber' && topOutContacts[i]) {
      const [contactX, contactY] = topOutContacts[i];
      feet[1] = (oy + (contactY - y) * scale) / H + (.95 - .7042977373068433);
      if (i === 3) feet[0] = (ox + (contactX - x) * scale) / W + (.5014944199568786 - .3094215645695364);
    }
    frames.push(`/character-climb/${name}/${stem}.webp`); frameAnchors.push({ feet });
    report.push({ state: name, index: i, box, crop: [x,y,cw,ch], scale, offset: [ox,oy], feet });
  }
  manifest.states[name] = { frames, fps: 10, loop: name === 'climb', anchors: { feet: [.5, .95] }, frameAnchors };
  execFileSync('montage', [...frames.map(f => path.join(root, 'public', f)), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-thumbnail', '128x160', '-tile', '4x', '-geometry', '+10+10', path.join(art, `${name}-contact.png`)]);
}
fs.writeFileSync(path.join(output, 'manifest-fragment.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(art, 'packaging.json'), JSON.stringify(report, null, 2) + '\n');
for (const name of ['.mask.png', '.isolated.png']) fs.rmSync(path.join(art, name), { force: true });
console.log('Packaged 8 ladder cycle drawings and 4 top-out drawings.');
