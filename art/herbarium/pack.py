"""Pack the rendered herbarium frames into delivery assets:
room layers and drawer plates as WebP, the character frames cropped to their
shared bounding box and packed into alpha WebP atlases, plus a manifest that
tells the page where the crop sits inside the room's frame.

  python3 art/herbarium/pack.py
"""
import json, math
from pathlib import Path
from PIL import Image

SOURCE = Path(__file__).resolve().parent
OUT = SOURCE.parents[1] / 'public/herbarium'
FRAMES = SOURCE / 'frames'
landmarks = json.loads((SOURCE / 'landmarks.json').read_text())
W, H = landmarks['width'], landmarks['height']
phases = json.loads((SOURCE / 'phases.json').read_text())

# Room layers and drawer plates: lossy WebP keeps the cel shading clean at a fraction of the PNG size.
for png in sorted(OUT.glob('*.png')):
    im = Image.open(png).convert('RGBA')
    if png.stem.startswith('drawer-'):
        bbox = im.getbbox()
        if bbox:
            pad = 24; bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(W, bbox[2] + pad), min(H, bbox[3] + pad))
            im.crop(bbox).save(OUT / f'{png.stem}.webp', quality=88, method=6)
            (OUT / f'{png.stem}.json').write_text(json.dumps({'box': [b / (W if i % 2 == 0 else H) for i, b in enumerate(bbox)]}))
    else:
        im.save(OUT / f'{png.stem}.webp', quality=86, method=6)
    print('layer', png.stem, (OUT / f'{png.stem}.webp').stat().st_size)

# The character frames: one crop box for every phase so the atlas sits at a fixed place over the room.
first = next(FRAMES.glob('idle-000.png'))
fw, fh = Image.open(first).size
union = None
for name, spec in phases.items():
    for i in range(spec['frames']):
        bbox = Image.open(FRAMES / f'{name}-{i:03}.png').getbbox()
        if not bbox: continue
        union = bbox if union is None else (min(union[0], bbox[0]), min(union[1], bbox[1]), max(union[2], bbox[2]), max(union[3], bbox[3]))
pad = 12
box = (max(0, union[0] - pad), max(0, union[1] - pad), min(fw, union[2] + pad), min(fh, union[3] + pad))
cw, ch = box[2] - box[0], box[3] - box[1]
scale = min(1.0, 1100 / cw)  # keep atlases decodable on a phone
tw, th = round(cw * scale), round(ch * scale)
columns = 6
manifest = {'version': 2, 'frameWidth': tw, 'frameHeight': th, 'fps': 12, 'box': [box[0] / fw, box[1] / fh, box[2] / fw, box[3] / fh], 'phases': {}}
for name, spec in phases.items():
    rows = math.ceil(spec['frames'] / columns)
    atlas = Image.new('RGBA', (tw * columns, th * rows), (0, 0, 0, 0))
    for i in range(spec['frames']):
        frame = Image.open(FRAMES / f'{name}-{i:03}.png').convert('RGBA').crop(box)
        if scale < 1: frame = frame.resize((tw, th), Image.LANCZOS)
        atlas.paste(frame, ((i % columns) * tw, (i // columns) * th))
    atlas.save(OUT / f'keeper-{name}.webp', quality=86, method=6)
    manifest['phases'][name] = {'src': f'/herbarium/keeper-{name}.webp', 'frames': spec['frames'], 'columns': columns, 'rows': rows, 'durationMs': spec['durationMs'], 'loop': spec['loop']}
    if name == 'idle':
        Image.open(FRAMES / 'idle-000.png').convert('RGBA').crop(box).resize((tw, th), Image.LANCZOS).save(OUT / 'keeper-poster.webp', quality=90, method=6)
    print('atlas', name, (OUT / f'keeper-{name}.webp').stat().st_size)
manifest['poster'] = '/herbarium/keeper-poster.webp'
manifest['landmarks'] = landmarks['landmarks']
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('manifest written', tw, th, manifest['box'])
