import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../../public/characters/bookseller-walk');
const canvas = { width: 384, height: 480 };
const groundAnchor = [.5, .94];
// Uniform per-sheet scales retain proportions; per-frame registration keeps the
// planted slipper at a common baseline without changing the generated artwork.
const frames = [
  { pose: 'stand', source: 'walk-source.png', crop: [202, 6, 198, 514], origin: [302, 515], scale: .68 },
  { pose: 'walk-1', source: 'walk-source.png', crop: [637, 18, 288, 493], origin: [761, 506], scale: .68 },
  { pose: 'walk-2', source: 'walk-source.png', crop: [1078, 18, 293, 498], origin: [1188, 511], scale: .68 },
  { pose: 'walk-3', source: 'walk-source.png', crop: [170, 518, 312, 480], origin: [300, 993], scale: .68 },
  { pose: 'walk-4', source: 'walk-source.png', crop: [676, 515, 203, 490], origin: [777, 1000], scale: .68 },
  { pose: 'rise', source: 'walk-source.png', crop: [1104, 541, 251, 467], origin: [1219, 1003], scale: .68 },
  { pose: 'climb-1', source: 'climb-source.png', crop: [225, 9, 532, 966], origin: [450, 970], scale: .40, grips: [[711, 49], [645, 392]], upperFoot: [584, 713] },
  { pose: 'climb-2', source: 'climb-source.png', crop: [891, 8, 513, 992], origin: [1080, 995], scale: .40, grips: [[1365, 50], [1307, 423]], upperFoot: [1250, 749] },
];

await fs.mkdir(output, { recursive: true });
for (const frame of frames) {
  const [x, y, width, height] = frame.crop;
  const { data, info } = await sharp(path.join(here, frame.source))
    .extract({ left: x, top: y, width, height })
    .resize({ width: Math.round(width * frame.scale) })
    .toBuffer({ resolveWithObject: true });
  const sx = info.width / width, sy = info.height / height;
  const left = Math.round(canvas.width * groundAnchor[0] - (frame.origin[0] - x) * sx);
  const top = Math.round(canvas.height * groundAnchor[1] - (frame.origin[1] - y) * sy);
  if (left < 0 || top < 0 || left + info.width > canvas.width || top + info.height > canvas.height) throw new Error(`Clipped sprite ${frame.pose}`);
  await sharp({ create: { ...canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: data, left, top }])
    .webp({ lossless: true, exact: true })
    .toFile(path.join(output, `${frame.pose}.webp`));
  frame.packaging = { left, top, resized: { width: info.width, height: info.height } };
  frame.visibleHeightAt240 = Number(((frame.origin[1] - y) * sy * .5).toFixed(1));
  if (frame.grips) frame.gripOffsetsAt240 = frame.grips.map(([gx, gy]) => [Number(((gx - frame.origin[0]) * sx * .5).toFixed(1)), Number(((gy - frame.origin[1]) * sy * .5).toFixed(1))]);
  if (frame.upperFoot) frame.upperFootOffsetAt240 = [Number(((frame.upperFoot[0] - frame.origin[0]) * sx * .5).toFixed(1)), Number(((frame.upperFoot[1] - frame.origin[1]) * sy * .5).toFixed(1))];
}
const manifest = {
  canvas,
  groundAnchor,
  facing: 'right',
  walkOrder: ['walk-1', 'walk-2', 'walk-3', 'walk-4'],
  packaging: 'Crop, uniform resize, transparent padding, lossless WebP encoding. Generated alpha preserved. No hand redrawing or background removal.',
  frames,
};
await fs.writeFile(path.join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await fs.copyFile(path.join(here, 'manifest.json'), path.join(output, 'manifest.json'));
console.log(JSON.stringify(manifest, null, 2));
