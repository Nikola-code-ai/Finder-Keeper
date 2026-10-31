import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Deterministic asset packaging only: crop, uniformly resize, transparent pad.
// The generated RGBA drawings remain untouched: no alpha thresholding, cleanup,
// painting, pose changes, or synthesized image content is performed here.
const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, '../../public/characters/ui-studies');
const generatedDir = '/home/nikola/.codex/generated_images/01a155fd-b89f-7df1-b057-7fcd8c6420d3';
const canvas = { width: 384, height: 480 };
const margin = 8;
const definitions = [
  { name: 'bookseller', source: 'exec-10e0512a-b708-4791-95e8-6d507d30c4d1.png', split: 768,
    contact: 'seat', canonical: [.36, .68], anchors: [[230, 588], [960, 589]],
    note: 'Rear underside of the seated hips, with apron and legs hanging in front of the support edge.' },
  { name: 'spider', source: 'exec-f32bac59-1919-47bc-b05b-550116cbd954.png', split: 887,
    contact: 'feet', canonical: [.36, .83], anchors: [[444, 742], [1352, 742]],
    note: 'Horizontal support baseline beneath planted leg tips; x is the body/leg-spread center. Front legs hold the paper in the active drawing.' },
  { name: 'wanderer', source: 'exec-1b9a59d4-bc5a-4898-99ec-ec1892dd8b33.png', split: 768,
    contact: 'seat', canonical: [.36, .68], anchors: [[285, 575], [1001, 577]],
    note: 'Rear underside of the hips, beside the satchel; loose legs and boots hang over the front edge.' },
  { name: 'mage', source: 'exec-7bb05519-ade6-4116-bd4d-0f174daab3c1.png', split: 816,
    contact: 'seat', canonical: [.36, .68], anchors: [[291, 630], [997, 630]],
    note: 'Underside of the seated robe/hips. The sheet is split at x=816, rather than its midpoint, to preserve the entire idle right boot.' },
  { name: 'inventor', source: 'exec-20e21349-b8de-42d8-8de5-c04b4520fc73.png', split: 768,
    contact: 'seat', canonical: [.36, .68], anchors: [[281, 617], [993, 617]],
    note: 'Rear underside of the seated trousers; patched knees and boots extend in front of the support edge.' },
];

/** Inspect alpha only. Bounds contain every pixel with nonzero generated alpha. */
function alphaBounds(data, width, height, channels, minimum = 1) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * channels + channels - 1] < minimum) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (right <= left || bottom <= top) throw new Error('Empty generated drawing');
  return { left, top, width: right - left, height: bottom - top };
}

function maximumScale(crop, anchor, canonical) {
  const x = anchor[0] - crop.left, y = anchor[1] - crop.top;
  const targetX = canonical[0] * canvas.width, targetY = canonical[1] * canvas.height;
  return Math.min(
    (targetX - margin) / x,
    (targetY - margin) / y,
    (canvas.width - margin - targetX) / (crop.width - x),
    (canvas.height - margin - targetY) / (crop.height - y),
  );
}

await fs.mkdir(outputDir, { recursive: true });
const manifest = {
  version: 1,
  canvas,
  generation: 'Built-in imagegen; exact prompts and generation details are recorded in PROMPTS.md.',
  packaging: 'Original PNG sources copied without modification. Per-drawing extraction, a common uniform scale for each idle/active pair, transparent padding, and lossless WebP encoding only. Generated alpha is preserved, with ordinary resize resampling. No background removal or thresholding.',
  contactMeasurement: 'Source anchors were visually measured in original-sheet pixel coordinates. Canonical anchors are normalized against the full output canvas, including transparent margins. Integer image placement introduces at most 0.5 px anchor error.',
  characters: {},
};

for (const definition of definitions) {
  const sourceCopy = path.join(here, `${definition.name}-source.png`);
  try { await fs.access(sourceCopy); }
  catch { await fs.copyFile(path.join(generatedDir, definition.source), sourceCopy); }
  const metadata = await sharp(sourceCopy).metadata();
  if (!metadata.hasAlpha) throw new Error(`${definition.name}: generated source has no alpha`);
  const sourceWidth = metadata.width, sourceHeight = metadata.height;
  const crops = [];
  for (let index = 0; index < 2; index++) {
    const panel = { left: index ? definition.split : 0, top: 0,
      width: index ? sourceWidth - definition.split : definition.split, height: sourceHeight };
    const { data, info } = await sharp(sourceCopy).extract(panel).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bounds = alphaBounds(data, info.width, info.height, info.channels);
    crops.push({ left: panel.left + bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });
  }
  // A shared factor preserves relative size when switching between the two drawings.
  const scale = Math.min(...crops.map((crop, index) => maximumScale(crop, definition.anchors[index], definition.canonical)));
  const frames = [];
  for (let index = 0; index < 2; index++) {
    const pose = index ? 'active' : 'idle';
    const crop = crops[index], sourceAnchor = definition.anchors[index];
    const width = Math.floor(crop.width * scale);
    const { data: resized, info: resizedInfo } = await sharp(sourceCopy).extract(crop)
      .resize({ width, kernel: 'lanczos3' }).png().toBuffer({ resolveWithObject: true });
    const scaleX = resizedInfo.width / crop.width, scaleY = resizedInfo.height / crop.height;
    const left = Math.round(definition.canonical[0] * canvas.width - (sourceAnchor[0] - crop.left) * scaleX);
    const top = Math.round(definition.canonical[1] * canvas.height - (sourceAnchor[1] - crop.top) * scaleY);
    if (left < 0 || top < 0 || left + resizedInfo.width > canvas.width || top + resizedInfo.height > canvas.height)
      throw new Error(`${definition.name}-${pose}: packaging would clip the drawing`);
    const filename = `${definition.name}-${pose}.webp`;
    const destination = path.join(outputDir, filename);
    await sharp({ create: { ...canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left, top }]).webp({ lossless: true, exact: true, effort: 6 }).toFile(destination);
    const { data: finalData, info: finalInfo } = await sharp(destination).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    frames.push({
      pose, src: `/characters/ui-studies/${filename}`, sourceAnchor, crop,
      uniformScale: scale, resized: { width: resizedInfo.width, height: resizedInfo.height }, padding: { left, top },
      achievedAnchor: [(left + (sourceAnchor[0] - crop.left) * scaleX) / canvas.width,
        (top + (sourceAnchor[1] - crop.top) * scaleY) / canvas.height],
      visibleBoundsAlpha128: alphaBounds(finalData, finalInfo.width, finalInfo.height, finalInfo.channels, 128),
      bytes: (await fs.stat(destination)).size,
    });
  }
  manifest.characters[definition.name] = {
    source: `art/ui-studies/${definition.name}-source.png`, generatedSource: path.join(generatedDir, definition.source),
    sourceDimensions: { width: sourceWidth, height: sourceHeight }, contact: definition.contact,
    anchor: definition.canonical, note: definition.note, frames,
  };
  console.log(`${definition.name}: ${frames.map(frame => `${frame.pose} ${(frame.bytes / 1024).toFixed(1)} KB`).join(', ')}`);
}

// The four crawl drawings have unequal gutters. Equal-width sheet splitting
// would cut off the first and second front legs; these divisions lie in the
// inspected transparent gaps. Pad each source cell before resizing so every
// frame uses exactly the same source-to-output body scale.
const crawlGenerated = path.join(generatedDir, 'exec-5bd5b5f7-e92e-4a53-a535-0b822c022555.png');
const crawlSource = path.join(here, 'spider-crawl-source.png');
try { await fs.access(crawlSource); }
catch { await fs.copyFile(crawlGenerated, crawlSource); }
const crawlMetadata = await sharp(crawlSource).metadata();
if (crawlMetadata.width !== 2172 || crawlMetadata.height !== 724 || !crawlMetadata.hasAlpha)
  throw new Error('Unexpected spider crawl source dimensions or alpha');
const crawlSplits = [0, 575, 1115, 1640, 2172];
const crawlAnchors = [[294, 592], [828, 592], [1370, 593], [1902, 593]];
const crawlCell = { width: 575, height: 724 };
const crawlWidth = 240;
const crawlCanonical = [.36, .83];
const crawlFrames = [];
for (let index = 0; index < 4; index++) {
  const crop = { left: crawlSplits[index], top: 0,
    width: crawlSplits[index + 1] - crawlSplits[index], height: crawlCell.height };
  const panel = await sharp(crawlSource).extract(crop).png().toBuffer();
  const normalizedCell = await sharp({ create: { ...crawlCell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: panel, left: 0, top: 0 }]).png().toBuffer();
  const { data: resized, info } = await sharp(normalizedCell).resize({ width: crawlWidth, kernel: 'lanczos3' })
    .png().toBuffer({ resolveWithObject: true });
  const sourceAnchor = crawlAnchors[index];
  const scaleX = info.width / crawlCell.width, scaleY = info.height / crawlCell.height;
  const left = Math.round(crawlCanonical[0] * canvas.width - (sourceAnchor[0] - crop.left) * scaleX);
  const top = Math.round(crawlCanonical[1] * canvas.height - sourceAnchor[1] * scaleY);
  if (left < 0 || top < 0 || left + info.width > canvas.width || top + info.height > canvas.height)
    throw new Error(`spider-walk-${index}: packaging would clip the drawing`);
  const filename = `spider-walk-${index}.webp`, destination = path.join(outputDir, filename);
  await sharp({ create: { ...canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }]).webp({ lossless: true, exact: true, effort: 6 }).toFile(destination);
  const { data: finalData, info: finalInfo } = await sharp(destination).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  crawlFrames.push({
    index, src: `/characters/ui-studies/${filename}`, sourceAnchor, crop, paddedSourceDimensions: crawlCell,
    uniformScale: scaleX, resized: { width: info.width, height: info.height }, padding: { left, top },
    achievedAnchor: [(left + (sourceAnchor[0] - crop.left) * scaleX) / canvas.width,
      (top + sourceAnchor[1] * scaleY) / canvas.height],
    visibleBoundsAlpha128: alphaBounds(finalData, finalInfo.width, finalInfo.height, finalInfo.channels, 128),
    bytes: (await fs.stat(destination)).size,
  });
}
manifest.characters.spider.walk = {
  source: 'art/ui-studies/spider-crawl-source.png', generatedSource: crawlGenerated,
  sourceDimensions: { width: 2172, height: 724 }, anchor: crawlCanonical, contact: 'feet', fps: 6, loop: true,
  note: 'Four original alternating-leg drawings. All four share a padded 575x724 source cell and identical 240x302 resize, preserving constant body scale. Baselines are measured at planted leg tips. Visible crown-to-ground height matches the idle sprite within approximately 2 px. Divisions follow actual transparent gaps, not equal columns.',
  frames: crawlFrames,
};
console.log(`spider crawl: ${crawlFrames.length} frames at identical ${crawlWidth / crawlCell.width} scale`);
await fs.writeFile(path.join(here, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
