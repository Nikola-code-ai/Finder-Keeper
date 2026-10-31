"""Verify native transform animation and physical phase motion in the saved source."""
import bpy,json,math
from pathlib import Path
scene=bpy.context.scene
markers={m.name:m.frame for m in scene.timeline_markers}
required=['idle','dispatch','web','walk','documents','read','return','present','error','cancelled','web-return','web-settle']
assert all(p in markers for p in required),markers
objects=bpy.data.objects
checks={}
def delta(name,phase,property='location',a=0,b=15):
    o=objects[name];scene.frame_set(markers[phase]+a);v1=tuple(getattr(o,property))
    scene.frame_set(markers[phase]+b);v2=tuple(getattr(o,property))
    d=sum((x-y)**2 for x,y in zip(v1,v2))**.5
    return d
checks['spider settle displacement']=delta('RIG | Pip spider','web-settle',b=17)
checks['spider return displacement']=delta('RIG | Pip spider','web-return',b=23)
checks['walk displacement']=delta('RIG | shopkeeper root','walk',b=23)
checks['return displacement']=delta('RIG | shopkeeper root','return',b=23)
checks['spider departure displacement']=delta('RIG | Pip spider','dispatch',b=23)
checks['page hinge rotation']=delta('PROP | physical turning page','read','rotation_euler',b=17)
checks['document lift']=delta('PROP | held document','documents',a=0,b=6)
checks['offered paper']=delta('PROP | held document','present',b=23)
checks['spider gait']=delta('Pip | lower articulated leg','web','rotation_euler',a=0,b=2)
assert checks['spider settle displacement']>3
assert checks['spider return displacement']>3
assert checks['walk displacement']>3
assert checks['return displacement']>3
assert checks['spider departure displacement']>3
assert checks['page hinge rotation']>3
assert checks['document lift']>.08
assert checks['offered paper']>.3
assert checks['spider gait']>.05
scene.frame_set(1)
report={'result':'passed','frame_count':scene.frame_end,'markers':markers,'motion_checks':checks}
Path(__file__).with_name('native-animation-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
