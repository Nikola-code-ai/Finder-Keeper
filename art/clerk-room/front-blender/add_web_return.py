"""Append physical spider returns to the native source.
Run after build_room.py: blender -b --python art/clerk-room/front-blender/add_web_return.py
"""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
SOURCE=Path(__file__).resolve().parent
OUT=SOURCE.parents[2]/'public/clerk-room/front-blender'
FRAMES=SOURCE/'frames'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'shopkeeper.blend'))
scene=bpy.context.scene
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    accelerated=any(d.type=='OPTIX' for d in prefs.devices)
    for d in prefs.devices:d.use=d.type=='OPTIX' if accelerated else d.type=='CPU'
    scene.cycles.device='GPU' if accelerated else 'CPU'
except Exception:
    scene.cycles.device='CPU'
markers={m.name:m.frame for m in scene.timeline_markers}
manifest=json.loads((OUT/'manifest.json').read_text())
moving=[o for o in bpy.data.objects if o.animation_data and o.animation_data.action]
legs=[o for o in moving if o.name.startswith('Pip | ') and 'articulated leg' in o.name]
spider=bpy.data.objects['RIG | Pip spider']
start=223
for clip,source,count in [('web-return','present',24),('web-settle','cancelled',18)]:
    # Snapshot native body action and eight-legged gait before writing new keys.
    source_count=manifest['phases'][source]['frames']
    records=[]
    for i in range(count):
        scene.frame_set(markers[source]+round(i/(count-1)*(source_count-1)))
        pose={o.name:(tuple(o.location),tuple(o.rotation_euler),tuple(o.scale)) for o in moving}
        scene.frame_set(markers['web']+(i%24))
        for o in legs:pose[o.name]=(tuple(o.location),tuple(o.rotation_euler),tuple(o.scale))
        records.append(pose)
    if clip not in markers:scene.timeline_markers.new(clip,frame=start)
    for i,pose in enumerate(records):
        frame=start+i;scene.frame_set(frame)
        for name,(loc,rot,scale) in pose.items():
            o=bpy.data.objects[name];o.location=loc;o.rotation_euler=rot;o.scale=scale
        t=i/(count-1);q=max(0,min(1,(t-.06)/.88));q=q*q*(3-2*q)
        spider.location=Vector((4.08,2.85,2.42)).lerp(Vector((1.15,-.52,1.82)),q)
        spider.rotation_euler.z=.25
        for o in moving:
            for prop in ['location','rotation_euler','scale']:o.keyframe_insert(prop,frame=frame)
        scene.render.filepath=str(FRAMES/f'{clip}-{i:03}.png')
        bpy.ops.render.render(write_still=True)
        print('FRAME_COMPLETE',clip,i,flush=True)
    manifest['phases'][clip]={'src':f'/clerk-room/front-blender/{clip}.webp','frames':count,'columns':6,'rows':math.ceil(count/6),'durationMs':round(count/12*1000),'loop':False,'startFrame':start}
    start+=count
scene.frame_end=start-1;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shopkeeper.blend'),compress=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
