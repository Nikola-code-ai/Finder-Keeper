import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'source.png');
const output = path.resolve(here, '../../public/characters/ui-studies');
const canvas = { width: 384, height: 480 };
const frames = [
  { pose: 'reach', crop: { left: 0, top: 30, width: 768, height: 968 }, hip: [232, 568], grip: [610, 623] },
  { pose: 'pull', crop: { left: 768, top: 30, width: 768, height: 968 }, hip: [970, 574], grip: [1425, 695] },
];
const scale = .3551219512195121;
for (const frame of frames) {
  const { data, info } = await sharp(source).extract(frame.crop).resize({ width: Math.round(768 * scale) }).toBuffer({ resolveWithObject: true });
  const sx = info.width / frame.crop.width, sy = info.height / frame.crop.height;
  const left = Math.round(canvas.width * .36 - (frame.hip[0] - frame.crop.left) * sx);
  const top = Math.round(canvas.height * .68 - (frame.hip[1] - frame.crop.top) * sy);
  if (left < 0 || top < 0 || left + info.width > 384 || top + info.height > 480) throw new Error('Clipped sprite');
  await sharp({ create: { ...canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: data, left, top }]).webp({ lossless: true, exact: true }).toFile(path.join(output, `bookseller-${frame.pose}.webp`));
  frame.packaging = { left, top, resized: { width: info.width, height: info.height }, scale: sx };
  frame.gripFromHipAt240 = [(frame.grip[0] - frame.hip[0]) * sx * .5, (frame.grip[1] - frame.hip[1]) * sy * .5];
}
await fs.writeFile(path.join(here, 'manifest.json'), JSON.stringify({ source: 'source.png', canvas, hipAnchor: [.36, .68], packaging: 'Only crop, uniform resize, transparent padding and lossless encoding. Original alpha preserved.', frames }, null, 2) + '\n');
console.log(frames);
