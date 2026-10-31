"""Pack actual native Blender animation frames into browser-friendly WebP atlases."""
from pathlib import Path
from PIL import Image, ImageOps
import json, math
SOURCE=Path(__file__).resolve().parent
OUT=SOURCE.parents[2]/'public/clerk-room/front-blender'
manifest=json.loads((OUT/'manifest.json').read_text())
for name,spec in manifest['phases'].items():
    width,height=manifest['width'],manifest['height']
    frames=[SOURCE/'frames'/f'{name}-{i:03}.png' for i in range(spec['frames'])]
    if not all(p.exists() for p in frames):continue
    destination=OUT/f'{name}.webp'
    if destination.exists() and destination.stat().st_mtime>=max(p.stat().st_mtime for p in frames):continue
    atlas=Image.new('RGB',(width*spec['columns'],height*spec['rows']),(242,242,242))
    for i,path in enumerate(frames):
        frame=Image.open(path).convert('RGB')
        atlas.paste(frame,((i%spec['columns'])*width,(i//spec['columns'])*height))
    atlas.save(OUT/f'{name}.webp',quality=86,method=6)
    if name=='idle':Image.open(frames[0]).save(OUT/'poster.webp',quality=92,method=6)
    print(name,(OUT/f'{name}.webp').stat().st_size)
