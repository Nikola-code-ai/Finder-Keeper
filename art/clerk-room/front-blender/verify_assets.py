"""Check delivery atlas contracts and distinct character animation frames."""
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import json,hashlib
SOURCE=Path(__file__).resolve().parent
ROOT=SOURCE.parents[2]
manifest=json.loads((ROOT/'public/clerk-room/front-blender/manifest.json').read_text())
assert manifest['width']==768 and manifest['height']==512 and manifest['fps']==12
results={}
for name,spec in manifest['phases'].items():
    path=ROOT/'public'/spec['src'].lstrip('/')
    assert path.is_file(),str(path)
    im=Image.open(path);im.load()
    expected=(768*spec['columns'],512*spec['rows'])
    assert im.size==expected,(name,im.size,expected)
    assert spec['frames']<=spec['columns']*spec['rows']
    hashes=[]
    for i in range(spec['frames']):
        x=i%spec['columns']*768;y=i//spec['columns']*512
        frame=im.crop((x,y,x+768,y+512))
        hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
    distinct=len(set(hashes))
    assert distinct>1,(name,'static frames')
    results[name]={'frames':spec['frames'],'distinctFrames':distinct,'atlasDimensions':list(im.size),'bytes':path.stat().st_size}
poster=ROOT/'public'/manifest['poster'].lstrip('/')
assert Image.open(poster).size==(768,512)
report={'status':'passed','phaseCount':len(results),'frameCount':sum(s['frames'] for s in manifest['phases'].values()),'totalAtlasBytes':sum(r['bytes'] for r in results.values()),'atlases':results}
(SOURCE/'asset-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
