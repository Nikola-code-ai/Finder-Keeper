"""Native Blender visitor-view bookshop and articulated request animations.
Run: blender -b --python art/clerk-room/front-blender/build_room.py -- preview|render
All motion is native geometry transform keyframes, not image morphing.
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SOURCE=Path(__file__).resolve().parent
OUT=ROOT/'public/clerk-room/front-blender'
FRAMES=SOURCE/'frames'
OUT.mkdir(parents=True,exist_ok=True);FRAMES.mkdir(exist_ok=True)
# Share primitive model builders; the old overhead scene is never executed.
helpers=(ROOT/'art/clerk-room/blender/build_room.py').read_text().split('# -- ROOM:')[0]
exec(helpers.replace("ROOT = Path(__file__).resolve().parents[3]", "ROOT = Path(__file__).resolve().parents[3]").replace("OUT = ROOT / 'public' / 'clerk-room'", "OUT = ROOT / 'public' / 'clerk-room' / 'front-blender'"))
SOURCE=Path(__file__).resolve().parent;FRAMES=SOURCE/'frames'
# A warm grayscale room, seen by a visitor standing across the counter.
box('Room | floor',(0,1,-.15),(12,10,.25),floor,.02)
for i in range(17):
    x=-5.6+i*.7
    box('Floorboard seam',(x,0,-.015),(.015,10,.005),grain,0)
box('Room | plaster rear wall',(0,3.6,2.5),(12,.2,5.1),wall,.02)
box('Room | bottom skirting',(0,3.44,.19),(12,.09,.34),dark,.02)
box('Room | picture rail',(0,3.44,3.9),(12,.09,.10),wood,.02)
# Cabinets at rear. Every book is modeled with spine bands.
for bx in [-4.5,-2.7,0,2.7]:
    width=1.65
    box('Cabinet | dark back',(bx,3.36,1.9),(width,.12,3.6),dark,.025)
    for sx in [-.83,.83]:box('Cabinet | stiles',(bx+sx,3.09,1.91),(.105,.64,3.7),wood,.02)
    for z in [.22,1.08,1.95,2.82,3.72]:box('Cabinet | shelf',(bx,3.07,z),(1.78,.69,.10),wood,.02)
    for k,z in enumerate([.30,1.16,2.03,2.90]):
        xx=bx-.72
        for j in range(8):
            bw=random.uniform(.10,.16);bh=random.uniform(.49,.68)
            bm=[ink,cloth,paper,wood][(k+j)%4]
            box('Cabinet | bound volume',(xx,2.98,z+bh/2),(bw,.43,bh),bm,.008)
            for band in [.10,bh-.10]:box('Cabinet | spine band',(xx,2.754,z+band),(bw*.90,.008,.022),silver,.001)
            xx+=bw+.038
# Right window, silk strands and plant.
box('Window | dark inset',(4.2,3.32,2.42),(1.4,.20,2.15),dark,.04)
wm=material('Window | overcast daylight',.93,.9)
for xx in [-.32,.32]:
    for zz in [-.47,.47]:box('Window | panes',(4.2+xx,3.20,2.42+zz),(.57,.07,.88),wm,.01)
box('Window | sill',(4.2,3.04,1.33),(1.72,.48,.14),wood,.035)
for a in range(7):
    theta=a*math.pi/6
    rod('Window | silk spoke',(4.75,3.135,3.32),(4.75-.85*math.cos(theta),3.135,3.32-.85*math.sin(theta)),.004,white)
for radius in [.25,.5,.78]:
    curve('Window | silk arc',[(4.75-radius*math.cos(a*math.pi/18),3.13,3.32-radius*math.sin(a*math.pi/18)) for a in range(10)],.004,white)
plant(4.1,2.4,.02,.84)
# Left-hand actual desks. Main sorting station and lower intake desk.
top_doc=table('Left documents sorting desk',-3.2,.65,2.25,1.5,1.21)
for xx,yy,n in [(-3.72,.43,11),(-2.63,.79,7)]:
    paper_stack(xx,yy,top_doc+.018,.61,.75,n)
    box('Archive | dark folder',(xx,yy,top_doc+.01),(.69,.83,.02),dark,.01)
for j in range(6):box('Archive | upright file',(-3.7+j*.18,1.15,top_doc+.34),(.055,.33,.58),paper if j%2 else cloth,.004,rot=(0,.09,0))
lamp(-4.05,1.0,top_doc,.58)
top_intake=table('Left document intake desk',-3.47,-1.43,1.72,1.18,1.00)
paper_stack(-3.65,-1.42,top_intake+.02,.75,.73,12)
book('Intake ledger',-2.99,-1.30,top_intake+.02,.45,.70,.15,wood)
# Main counter - front edge and detailed cabinetry face the visitor.
top=table('Shopkeeper counter',0,-.89,3.9,1.78,1.44)
box('Counter | front panel',(0,-1.68,.83),(3.65,.12,.99),dark,.035)
for px in [-1.16,0,1.16]:
    box('Counter | recessed panel',(px,-1.751,.83),(1.03,.025,.72),wood,.025)
    box('Counter | inset border',(px,-1.771,.83),(.85,.025,.57),dark,.02)
    box('Counter | inner field',(px,-1.790,.83),(.79,.015,.51),wood,.015)
box('Desk | leather writing pad',(0,-.94,top+.015),(1.93,1.34,.018),ink,.035)
book('Keeper | open desk book',0,-.91,top+.045,.44,.69,.10,opened=True)
book('Keeper | desk atlas',1.39,-1.05,top+.025,.58,.78,.15,dark,.08)
book('Keeper | desk reference',1.39,-1.05,top+.215,.51,.72,.12,paper,-.045)
lamp(-1.43,-.56,top,.61)
cylinder('Keeper | teacup',(-.87,-.46,top+.105),.105,.21,white)
cylinder('Keeper | tea',(-.87,-.46,top+.212),.09,.008,ink)
ring('Keeper | cup handle',(-1.0,-.46,top+.11),.08,.022,white,(math.pi/2,0,0))
# Small silk bridge allows Pip to physically crawl from desk towards the window.
curve('Pip | silk bridge',[(1.25,-.55,1.83),(2.0,.15,1.94),(2.85,1.24,2.11),(4.13,2.89,2.42)],.005,white)
# Chair remains when the keeper walks away.
box('Chair | seat',(0,.63,.83),(1.05,.91,.15),dark,.10)
box('Chair | cushion',(0,.63,.93),(.95,.82,.13),cloth,.09)
for sx in [-.44,.44]:
    for sy in [.25,.98]:rod('Chair | turned foot',(sx,sy,.81),(sx*1.1,sy,.05),.055,wood)
for sx in [-.47,.47]:rod('Chair | back upright',(sx,1.0,.75),(sx,1.0,2.05),.055,wood)
box('Chair | back cushion',(0,1.0,1.62),(1.05,.16,.76),cloth,.12)
box('Chair | top rail',(0,1.0,2.03),(1.17,.21,.12),wood,.05)
# -- RIG. Geometry is attached to editable torso/head/hand transforms. ----------
def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
rig=empty('RIG | shopkeeper root',(0,.38,0))
headrig=empty('RIG | head nod and gaze',(0,-.02,2.48),rig)
animated=[]
def attach(o,parent):o.parent=parent;return o
# Full old, kind face; white side hair, beard, rounded wire glasses and smile.
attach(sphere('Keeper | face',(0,-.015,.20),(.405,.34,.46),skin,32),headrig)
for s in [-1,1]:
    attach(sphere('Keeper | ear',(s*.395,-.015,.21),(.085,.085,.13),skin),headrig)
    attach(sphere('Keeper | inner ear',(s*.435,-.073,.21),(.027,.024,.07),wood),headrig)
    attach(sphere('Keeper | cheerful cheek',(s*.23,-.284,.10),(.13,.10,.115),skin),headrig)
    # Bald crown surrounded by wispy silver hair.
    for i in range(7):
        z=.14+i*.058;x=s*(.36+.015*math.sin(i));y=.025+max(0,i-4)*.019
        attach(sphere('Keeper | silver temple curl',(x,y,z),(.09,.15,.078),paper),headrig)
    attach(sphere('Keeper | side hair',(s*.33,.16,.32),(.12,.18,.25),paper),headrig)
    attach(sphere('Keeper | white eyebrow',(s*.153,-.307,.335),(.122,.037,.035),wood),headrig)
    attach(sphere('Keeper | eye white',(s*.15,-.327,.273),(.085,.03,.058),white),headrig)
    attach(sphere('Keeper | attentive pupil',(s*.15,-.354,.270),(.028,.015,.031),ink),headrig)
    attach(ring('Keeper | round spectacles',(s*.16,-.378,.27),.112,.014,metal,(math.pi/2,0,0)),headrig)
    attach(rod('Keeper | glasses temple',(s*.273,-.371,.27),(s*.394,-.018,.27),.012,metal),headrig)
attach(rod('Keeper | spectacle bridge',(-.05,-.383,.27),(.05,-.383,.27),.012,metal),headrig)
attach(sphere('Keeper | round kind nose',(0,-.371,.17),(.092,.135,.104),skin),headrig)
# Beard follows jawline, individual tufts catching light.
attach(sphere('Keeper | white beard',(0,-.20,-.055),(.32,.245,.225),paper),headrig)
for s in [-1,1]:
    attach(sphere('Keeper | moustache',(s*.094,-.365,.065),(.133,.071,.055),white),headrig)
    for j in range(4):
        attach(sphere('Keeper | beard curl',(s*(.075+j*.065),-.350+j*.019,-.08+j*.026),(.065,.047,.088),paper),headrig)
attach(curve('Keeper | welcoming smile',[(-.115,-.439,-.005),(-.065,-.454,-.031),(0,-.462,-.041),(.065,-.454,-.031),(.115,-.439,-.005)],.012,dark),headrig)
# Body and cloth details.
attach(sphere('Keeper | plump shirt',(0,.02,1.89),(.48,.31,.54),paper),rig)
attach(sphere('Keeper | waistcoat',(0,-.035,1.83),(.465,.305,.49),dark),rig)
attach(box('Keeper | shirt front',(0,-.336,2.13),(.23,.035,.39),paper,.04),rig)
for s in [-1,1]:
    attach(box('Keeper | waistcoat lapel',(s*.19,-.328,2.08),(.15,.05,.40),ink,.025,rot=(0,s*.10,s*.25)),rig)
    attach(box('Keeper | collar',(s*.10,-.32,2.32),(.18,.055,.17),white,.025,rot=(0,0,s*.35)),rig)
for z in [1.68,1.84,2.0]:attach(sphere('Keeper | vest button',(.04,-.344,z),(.027,.017,.027),silver),rig)
attach(box('Keeper | apron',(0,-.24,1.33),(.82,.10,.55),paper,.07),rig)
attach(box('Keeper | apron pocket',(0,-.304,1.39),(.35,.018,.20),white,.025),rig)
attach(sphere('Keeper | hips',(0,.07,1.06),(.35,.27,.23),ink),rig)
# Segmented limbs update endpoints. Curved capsules keep the crafted figure feel.
limbs={};hands={};eyes=[o for o in headrig.children if 'eye white' in o.name or 'pupil' in o.name]
def seg(name,a,b,r,mat,parent=rig):
    o=attach(rod(name,a,b,r,mat),parent);limbs[name]=o;return o
for s in [-1,1]:
    tag='L' if s<0 else 'R'
    seg(tag+' upper arm',(s*.4,0,2.14),(s*.63,-.24,1.79),.145,paper)
    seg(tag+' forearm',(s*.63,-.24,1.79),(s*.56,-.8,1.61),.10,skin)
    attach(sphere(tag+' rolled sleeve',(s*.62,-.28,1.78),(.15,.14,.12),white),rig)
    hands[tag]=empty(tag+' hand control',(s*.56,-.8,1.61),rig)
    attach(sphere(tag+' hand',(0,0,0),(.115,.155,.063),skin),hands[tag])
    for f in range(4):attach(sphere(tag+' finger',((f-1.5)*.042,-.12,-.008),(.025,.105,.025),skin),hands[tag])
    attach(sphere(tag+' thumb',(-s*.103,-.01,.012),(.04,.075,.04),skin),hands[tag])
    seg(tag+' thigh',(s*.2,.04,1.03),(s*.23,-.21,.62),.145,cloth)
    seg(tag+' shin',(s*.23,-.21,.62),(s*.23,-.08,.18),.105,ink)
    shoe=attach(sphere(tag+' shoe',(s*.23,-.2,.135),(.16,.30,.12),dark),rig);limbs[tag+' shoe']=shoe
# A real hinged paper leaf on the book, not an overlaid visual cue.
page=empty('PROP | physical turning page',(0,-.91,top+.19))
attach(box('Book | moving page',(.21,0,0),(.42,.65,.009),paper,.003),page)
for j in range(7):attach(box('Book | moving ink',(.20,-.24+j*.067,.006),(.31,.006,.003),grain,0),page)
# The document is held at the left desk, then extended toward the visitor.
held=empty('PROP | held document',(0,0,-10))
attach(box('Paper | offered sheet',(0,0,0),(.62,.76,.012),paper,.006),held)
for j in range(7):attach(box('Paper | text line',(0,-.22+j*.07,.008),(.46 if j<6 else .28,.011,.003),grain,0),held)
# Articulated spider, with distinct alternating gait on eight legs.
spider=empty('RIG | Pip spider',(1.15,-.52,1.82));spiderleg=[]
attach(sphere('Pip | round abdomen',(0,.05,0),(.18,.22,.15),ink),spider)
attach(sphere('Pip | head',(0,-.14,-.005),(.135,.13,.12),dark),spider)
for s in [-1,1]:
    attach(sphere('Pip | eye',(s*.056,-.244,.037),(.038,.027,.046),white),spider)
    attach(sphere('Pip | pupil',(s*.056,-.267,.036),(.018,.012,.022),ink),spider)
    for i in range(4):
        yy=-.13+i*.095
        a=(s*.10,yy,0);b=(s*.27,yy+(i-1.5)*.06,.07);c=(s*.38,yy+(i-1.5)*.095,-.13)
        up=attach(rod('Pip | upper articulated leg',a,b,.016,ink),spider)
        low=attach(rod('Pip | lower articulated leg',b,c,.013,ink),spider)
        spiderleg.append((s,i,up,low))
# Lighting and visitor perspective. This is explicitly not the former overhead view.
scene=bpy.context.scene;world=scene.world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.7,.7,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35

def area(name,loc,power,size,target):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Light | soft daylight',(-3,-3,7),900,5,(0,0,1))
area('Light | face fill',(1,-6,4),350,4,(0,0,2.1))
area('Light | window glow',(4,2,5),650,3,(0,0,1))
bpy.ops.object.camera_add(location=(0,-10.6,4.15));camera=bpy.context.object
camera.name='Camera | visitor facing the shopkeeper';camera.rotation_euler=(Vector((0,.35,1.85))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='PERSP';camera.data.lens=42;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
try:
    p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
    accel=any(d.type=='OPTIX' for d in p.devices)
    for d in p.devices:d.use=d.type=='OPTIX' if accel else d.type=='CPU'
    scene.cycles.device='GPU' if accel else 'CPU'
except Exception:pass
scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.fps=12
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.3
scene['source']='Native Blender geometry and keyframed articulated character, no generated bitmap character.'
scene['view']='First-person visitor facing older shopkeeper across counter.'
# Endpoint-based limb rig animation: smooth contact paths, anticipation and follow-through.
def lerp(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def move_rod(o,a,b):
    a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.scale.z=(b-a).length/o.data.vertices[0].co.z/2 if False else 1
    # Cylinder mesh was created with authored depth; update scale from its cached base.
    if 'base_depth' not in o:o['base_depth']=o.dimensions.z
    # dimensions.z is world AABB for rotated objects, so use actual mesh span instead.
    depth=max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices)
    o.scale.z=(b-a).length/depth

def pose(phase,t):
    cyc=math.sin(t*math.tau);rig.location=(0,.38,.008*cyc);rig.rotation_euler=(0,0,0)
    headrig.rotation_euler=(.025*cyc,0,.018*cyc)
    page.rotation_euler=(0,0,0);held.location=(0,0,-10);held.rotation_euler=(0,0,0)
    spider.location=(1.15,-.52,1.82);spider.rotation_euler=(0,0,0)
    elbows={-1:(-.64,-.28,1.79),1:(.64,-.28,1.79)}
    wrists={-1:(-.56,-.82,1.62),1:(.56,-.82,1.62)}
    walking=0
    if phase=='dispatch':
        arm=math.sin(min(t/.7,1)*math.pi/2)
        wrists[1]=lerp((.56,-.82,1.62),(1.16,-.53,1.94),arm);elbows[1]=(.79,-.14,1.94)
        headrig.rotation_euler.z=-.18*arm
        q=smooth((t-.25)/.75);spider.location=lerp((1.15,-.52,1.82),(4.08,2.85,2.42),q)
        spider.rotation_euler.z=-.65
    elif phase=='web':
        spider.location=(4.08+.07*cyc,2.85,2.42+.09*math.cos(t*math.tau));spider.rotation_euler.z=-.65
        headrig.rotation_euler.z=-.10+.06*cyc
        wrists[1]=(.58,-.65,1.70+.03*cyc)
    elif phase in ['walk','return']:
        q=smooth(t if phase=='walk' else 1-t);rig.location=(-3.17*q,.38+.85*q,.12*math.sin(q*math.pi/2)+.035*abs(math.sin(t*math.tau*2)))
        rig.rotation_euler.z=-.25*math.sin(q*math.pi)
        walking=math.sin(t*math.tau*2)
        for s in [-1,1]:
            wrists[s]=(s*.57,.02+s*.28*walking,1.22);elbows[s]=(s*.59,.03+s*.12*walking,1.72)
        headrig.rotation_euler=(.035,0,.15*math.sin(q*math.pi))
    elif phase=='documents':
        rig.location=(-3.17,1.23,.12);headrig.rotation_euler=(.16,0,.10*cyc)
        elbows[-1]=(-.59,-.34,1.66);elbows[1]=(.55,-.33,1.61)
        wrists[-1]=(-.33,-.72,1.50+.18*(cyc+1)/2);wrists[1]=(.38,-.82,1.27)
        held.location=(-3.44,.53,1.70+.18*(cyc+1)/2);held.rotation_euler=(.22+.12*cyc,.06*cyc,-.12)
    elif phase=='read':
        q=(t*1.0)%1;turn=smooth((q-.08)/.60);page.rotation_euler.y=-math.pi*turn
        headrig.rotation_euler=(.16+.025*cyc,0,-.08+.16*turn)
        handturn=turn if q<.72 else 1-smooth((q-.72)/.28)
        wrists[1]=(.46*math.cos(math.pi*handturn),-.94,1.70+.34*math.sin(math.pi*handturn));elbows[1]=(.58,-.37,1.83)
        wrists[-1]=(-.47,-.97,1.61)
    elif phase=='present':
        q=math.sin(min(t/.7,1)*math.pi/2);wrists[1]=lerp((.56,-.82,1.62),(.16,-1.26,1.98),q)
        elbows[1]=(.62,-.38,1.95);held.location=lerp((.17,-.95,1.76),(.10,-1.26,2.04),q);held.rotation_euler=(.34+.35*q,0,-.07)
        headrig.rotation_euler=(-.02*math.sin(t*math.pi),0,0)
    elif phase=='error':
        q=math.sin(t*math.pi)
        for s in [-1,1]:wrists[s]=(s*(.56+.14*q),-.55,1.62+.35*q);elbows[s]=(s*(.64+.10*q),-.13,1.79+.14*q)
        headrig.rotation_euler=(0,.08*q,.06*q)
    elif phase=='cancelled':
        q=1-smooth(t)
        wrists[1]=(.56,-.82+.2*q,1.62+.22*q);headrig.rotation_euler=(.08*q,0,0)
    # Sleepy-soft blinking is an actual eyelid compression, once per loop.
    blink=max(0,1-abs(t-.76)/.055)
    for eye in eyes:eye.scale.z=(.031 if 'pupil' in eye.name else .058)*(1-.9*blink)
    for s in [-1,1]:
        tag='L' if s<0 else 'R';shoulder=(s*.41,0,2.15);elbow=elbows[s];wrist=wrists[s]
        move_rod(limbs[tag+' upper arm'],shoulder,elbow);move_rod(limbs[tag+' forearm'],elbow,wrist)
        bpy.data.objects[tag+' rolled sleeve'].location=lerp(elbow,wrist,.12)
        hands[tag].location=wrist;hands[tag].rotation_euler=(.1 if phase=='present' and s==1 else 0,0,0)
        hip=(s*.20,.04,1.04);knee=(s*.23,-.19+s*.25*walking,.61+.06*abs(walking));ankle=(s*.23,-.04+s*.38*walking,.18+.08*max(0,s*walking))
        move_rod(limbs[tag+' thigh'],hip,knee);move_rod(limbs[tag+' shin'],knee,ankle);limbs[tag+' shoe'].location=(ankle[0],ankle[1]-.13,ankle[2]-.05)
    for s,i,up,low in spiderleg:
        wave=math.sin(t*math.tau*3+i*math.pi*.65+s*math.pi/2) if phase in ['dispatch','web'] else .06*cyc
        yy=-.13+i*.095;a=(s*.10,yy,0);b=(s*(.27+.025*wave),yy+(i-1.5)*.06+.025*wave,.07)
        c=(s*.38,yy+(i-1.5)*.095+.06*wave,-.13+.04*max(wave,0))
        move_rod(up,a,b);move_rod(low,b,c)
    bpy.context.view_layer.update()

phases={'idle':(24,True),'dispatch':(24,False),'web':(24,True),'walk':(24,False),'documents':(24,True),'read':(24,True),'return':(24,False),'present':(24,False),'error':(18,False),'cancelled':(12,False)}
manifest={'version':1,'width':768,'height':512,'fps':12,'poster':'/clerk-room/front-blender/poster.webp','phases':{},'view':'Visitor across the counter; front-facing older shopkeeper','source':'Native Blender geometry with articulated keyframed motion'}
for name,(n,loop) in phases.items():manifest['phases'][name]={'src':f'/clerk-room/front-blender/{name}.webp','frames':n,'columns':6,'rows':math.ceil(n/6),'durationMs':round(n/12*1000),'loop':loop}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
if 'preview' in sys.argv:
    pose('idle',0);scene.cycles.samples=32;scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shopkeeper.blend'),compress=True)
else:
    # All animation is retained as timeline keyframes in the editable .blend.
    moving=[rig,headrig,page,held,spider]+list(limbs.values())+list(hands.values())+[x for _,_,u,l in spiderleg for x in [u,l]]+eyes+[bpy.data.objects[t+' rolled sleeve'] for t in ['L','R']]
    offset=1
    for phase,(n,loop) in phases.items():
        scene.timeline_markers.new(phase,frame=offset);manifest['phases'][phase]['startFrame']=offset
        for i in range(n):
            frame=offset+i;scene.frame_set(frame);pose(phase,i/n if loop else i/max(n-1,1))
            for o in moving:
                for prop in ['location','rotation_euler','scale']:o.keyframe_insert(prop,frame=frame)
            framefile=FRAMES/f'{phase}-{i:03}.png'
            if not framefile.exists():
                scene.render.filepath=str(framefile);bpy.ops.render.render(write_still=True)
            print('FRAME_COMPLETE',phase,i,flush=True)
        offset+=n
    scene.frame_end=offset-1;scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shopkeeper.blend'),compress=True)
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
