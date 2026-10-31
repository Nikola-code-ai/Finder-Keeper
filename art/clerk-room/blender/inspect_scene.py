"""Inspect the saved native scene and export exact UI hotspot metadata."""
import bpy, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

scene=bpy.context.scene
points={
    'reading_book':(.60,-.07,1.62),
    'seated_clerk':(.65,-1.55,2.25),
    'documents_upper':(-4.35,1.45,1.30),
    'documents_lower':(-4.20,-1.46,1.30),
    'spider':(4.63,.28,1.30),
    'web_gate':(4.80,2.75,1.50),
    'chair':(.65,-1.74,.90),
}
hotspots={}
for label,co in points.items():
    p=world_to_camera_view(scene,scene.camera,Vector(co))
    hotspots[label]={'x_percent':round(p.x*100,2),'y_percent':round((1-p.y)*100,2)}
frames={}
for frame in [1,2,3]:
    scene.frame_set(frame)
    objects=[o.name for o in bpy.data.objects if not o.hide_render]
    frames[frame]={
        'central_clerk_visible':any(n.startswith('Keeper | sculpted head') for n in objects),
        'documents_clerk_visible':any(n.startswith('Documents pose | Keeper | sculpted head') for n in objects),
        'spider_visible':any(n.startswith('Pip | velvet abdomen') for n in objects),
    }
metadata={
    'generator':'Native Blender 4.5.2 LTS; procedural geometry and materials',
    'image_size':[scene.render.resolution_x,scene.render.resolution_y],
    'camera_type':scene.camera.data.type,
    'object_count':len(bpy.data.objects),
    'frames':frames,
    'hotspots':hotspots,
    'source':'art/clerk-room/blender/clerk-room.blend',
    'script':'art/clerk-room/blender/build_room.py',
    'images':['public/clerk-room/blender.png','public/clerk-room/blender-documents.png','public/clerk-room/blender-web.png'],
    'documentation':['https://docs.blender.org/api/4.5/bpy.ops.render.html','https://docs.blender.org/api/4.5/bpy.ops.object.html'],
}
output=Path(__file__).resolve().parent/'scene-manifest.json'
output.write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
