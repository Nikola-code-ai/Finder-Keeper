import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const base = read('public/character-sketch/manifest.json');
const climbing = read('public/character-climb/manifest-fragment.json');
const gaitPath = 'public/character-motion-v2/manifest-fragment.json';
const gait = fs.existsSync(path.join(root, gaitPath)) ? read(gaitPath) : { states: {} };
const motionPath = 'public/character-motion-v3/manifest-fragment.json';
const motion = fs.existsSync(path.join(root, motionPath)) ? read(motionPath) : {states:{}};
const states = { ...base.states, ...gait.states, ...climbing.states, ...motion.states };
const uniqueDrawings = new Set(Object.values(states).flatMap(state => state.frames)).size;
const manifest = { ...base, version: 4, name: 'Keeper — alternating steps and pickup', states, uniqueDrawings,
  production: 'Original generated raster poses. Still seated hold, alternating left/right gait, crawl, climb, pickup, landing and top-out drawings. No synthetic pose tweening.' };
fs.writeFileSync(path.join(root, 'public/character-sketch/manifest-v4.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Composed ${uniqueDrawings} distinct drawings.`);
