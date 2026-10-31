"""Finder Keeper: a hand-modelled, monochrome clerk's study.

Run with Blender 4.5 LTS (portable is fine):
  blender -b --python art/clerk-room/blender/build_room.py -- [preview]

No external textures or purchased assets. Geometry, materials, light, and
action poses are procedural and editable in clerk-room.blend.
"""
import bpy, math, random, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public' / 'clerk-room'
SOURCE = Path(__file__).resolve().parent
PREVIEW = 'preview' in sys.argv
random.seed(42)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)

def material(name, value, roughness=.7, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(value,value,value,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(value,value,value,1)
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metal
    return m

ink=material('01 | soft charcoal',.022,.65)
dark=material('02 | dark stained oak',.075,.58)
wood=material('03 | silvered oak',.23,.69)
grain=material('04 | wood grain',.12,.9)
paper=material('05 | cotton paper',.82,.88)
white=material('06 | porcelain white',.91,.38)
wall=material('07 | chalk plaster',.60,.95)
floor=material('08 | ash floorboards',.45,.86)
cloth=material('09 | woven charcoal',.17,.99)
skin=material('10 | ivory clay skin',.66,.65)
metal=material('11 | brushed pewter',.29,.32,.72)
silver=material('12 | polished silver',.62,.23,.8)
glass=material('13 | dark bottle glass',.095,.18,.3)

def finish(o,name,mat):
    o.name=name
    if mat:o.data.materials.append(mat)
    return o

def box(name,loc,scale,mat,bevel=.035,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    if bevel:
        m=o.modifiers.new('Soft crafted edges','BEVEL');m.width=bevel;m.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return finish(o,name,mat)

def sphere(name,loc,scale,mat,seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=16,radius=1,location=loc)
    o=bpy.context.object;o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def cylinder(name,loc,r,depth,mat,vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    b=o.modifiers.new('Rounded edges','BEVEL');b.width=min(.018,r*.2);b.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,mat)

def rod(name,a,b,r,mat):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,mat,16)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def curve(name,points,r,mat,cyclic=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12
    c.bevel_depth=r;c.bevel_resolution=3
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o)
    return finish(o,name,mat)

def ring(name,loc,radius,minor,mat,rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=minor,
        major_segments=48,minor_segments=10,location=loc,rotation=rotation or (0,0,0))
    o=bpy.context.object
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat)

def text(name,body,loc,size,mat,rotation=(0,0,0),align='CENTER'):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x=align;c.size=size;c.extrude=.001
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o)
    o.location=loc;o.rotation_euler=rotation
    return finish(o,name,mat)

def page_lines(x,y,z,w,h,count=6,rotation=0):
    for i in range(count):
        length=w*(.57 if i==count-1 else random.uniform(.83,.96))
        yy=y-h*.34+i*h*.10
        # All visible page marks are geometry, not texture/AI art.
        box('Ink line on paper',(x,yy,z),(length,.009,.002),grain,0)

def book(name,x,y,z,w=.62,h=.82,t=.13,cover=dark,angle=0,opened=False):
    objects=[]
    before=set(bpy.data.objects)
    if opened:
        box(name+' spread cover',(x,y,z),(w*1.95,h,.04),cover,.015)
        for side in [-1,1]:
            o=box(name+' fanned pages',(x+side*w*.47,y,z+.065),(w*.94,h*.96,.09),paper,.014,
                rot=(0,side*math.radians(5),0))
            page_lines(x+side*w*.47,y,z+.12,w*.76,h,8)
        rod(name+' binding seam',(x,y-h*.5,z+.09),(x,y+h*.5,z+.09),.012,grain)
        curve(name+' loose ribbon',[(x,y-.18,z+.13),(x+.04,y-.48,z+.12),(x+.08,y-.68,z+.05)],.015,ink)
    else:
        box(name+' lower cover',(x,y,z),(w,h,.028),cover,.012)
        box(name+' page block',(x,y,z+t/2),(w*.95,h*.94,t*.8),paper,.008)
        box(name+' upper cover',(x,y,z+t),(w,h,.028),cover,.012)
        box(name+' spine',(x-w*.48,y,z+t/2),(.044,h,t),cover,.012)
        for yy in [-.29,.29]:
            box(name+' spine band',(x-w*.505,y+h*yy,z+t/2),(.012,.04,t*.84),silver,.005)
        box(name+' cover embossed line',(x,y,z+t+.018),(w*.66,h*.72,.003),grain,.006)
        box(name+' cover inset',(x,y,z+t+.022),(w*.61,h*.67,.003),cover,.006)
    created=set(bpy.data.objects)-before
    if angle:
        for o in created:
            dx,dy=o.location.x-x,o.location.y-y
            o.location.x=x+dx*math.cos(angle)-dy*math.sin(angle)
            o.location.y=y+dx*math.sin(angle)+dy*math.cos(angle)
            o.rotation_euler.z+=angle
    return list(created)

def paper_stack(x,y,z,w=.67,h=.9,n=9):
    for i in range(n):
        a=random.uniform(-.04,.04)
        box('Stack | individual sheet',(x+random.uniform(-.012,.012),y,z+i*.018),(w,h,.014),paper,.003,(0,0,a))
    page_lines(x,y,z+n*.018,w*.81,h,6)
    return z+n*.018

def table(name,x,y,w,d,z=1.33):
    box(name+' top',(x,y,z),(w,d,.18),wood,.07)
    for i in range(6):
        yy=y-d*.5+(i+1)*d/7
        curve(name+' oak grain',[(x-w*.47+j*w*.094,yy+.012*math.sin(j+i),z+.095) for j in range(11)],.0045,grain)
    box(name+' front apron',(x,y-d*.42,z-.19),(w*.88,.12,.26),dark,.025)
    for dx in [-1,1]:
        for dy in [-1,1]:
            px=x+dx*(w*.5-.17);py=y+dy*(d*.5-.15)
            box(name+' square leg',(px,py,(z-.18)/2),(.12,.12,z-.18),dark,.025)
            sphere(name+' turned leg foot',(px,py,.1),(.11,.11,.09),dark)
    for dx in [-1,1]:
        box(name+' drawer',(x+dx*w*.24,y-d*.5-.008,z-.17),(w*.43,.06,.21),wood,.025)
        ring(name+' drawer pull',(x+dx*w*.24,y-d*.5-.06,z-.19),.05,.012,metal,(math.pi/2,0,0))
    return z+.1

def lamp(x,y,z,scale=1):
    cylinder('Lamp | stepped foot',(x,y,z+.025),.21*scale,.05*scale,dark)
    cylinder('Lamp | foot lip',(x,y,z+.06),.155*scale,.04*scale,metal)
    rod('Lamp | lower stem',(x,y,z+.08),(x,y,z+.65*scale),.033*scale,metal)
    rod('Lamp | angled arm',(x,y,z+.65*scale),(x+.22*scale,y,z+.94*scale),.032*scale,metal)
    sphere('Lamp | hinge',(x+.22*scale,y,z+.94*scale),(.065*scale,)*3,metal)
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.30*scale,radius2=.10*scale,depth=.19*scale,
        location=(x+.22*scale,y,z+.90*scale))
    finish(bpy.context.object,'Lamp | enamel shade',dark)
    cylinder('Lamp | white inner shade',(x+.22*scale,y,z+.80*scale),.26*scale,.015,white)
    ld=bpy.data.lights.new('Lamp soft pool','AREA');ld.energy=12*scale;ld.shape='DISK';ld.size=.45*scale
    lo=bpy.data.objects.new('Lamp soft pool',ld);bpy.context.collection.objects.link(lo);lo.location=(x+.22*scale,y,z+.78*scale)

def plant(x,y,z=.04,scale=1):
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.22*scale,radius2=.31*scale,depth=.50*scale,location=(x,y,z+.25*scale))
    finish(bpy.context.object,'Pot | porcelain',paper)
    ring('Pot | rolled lip',(x,y,z+.49*scale),.29*scale,.034*scale,white)
    cylinder('Pot | dark soil',(x,y,z+.49*scale),.26*scale,.02,ink)
    for i in range(8):
        a=i*math.tau/8;tip=(x+math.cos(a)*.4*scale,y+math.sin(a)*.4*scale,z+(1+random.uniform(-.2,.2))*scale)
        rod('Plant | stem',(x,y,z+.47*scale),tip,.014*scale,dark)
        o=sphere('Plant | sculpted leaf',tip,(.12*scale,.28*scale,.035*scale),wood)
        o.rotation_euler=(.2,random.uniform(-.8,.8),a-math.pi/2)

# -- ROOM: a stage-like cutaway, broadly symmetrical in camera space. ---------
box('Floating maquette | foundation',(0,0,-.21),(13.3,9,.34),dark,.09)
for row in range(23):
    y=-4.35+row*.386
    for col in range(5):
        x=-6.5+col*3.25-(1.62 if row%2 else 0)
        a=max(-6.5,x);b=min(6.5,x+3.23)
        if b>a:
            fm=material('Ash board %02d %d'%(row,col),random.uniform(.36,.48),.86)
            box('Floor | staggered ash plank',((a+b)/2,y,-.005),(b-a,.37,.07),fm,.012)
            for j in range(2):
                curve('Floor | quiet grain',[(a+.08+k*(b-a-.16)/6,y+(j-.5)*.12+.01*math.sin(k+row),.033) for k in range(7)],.002,grain)
box('Rear wall | cutaway',(0,4.36,.78),(13.3,.17,1.55),wall,.025)
box('Rear wall | dark skirting',(0,4.22,.16),(13.1,.08,.26),dark,.015)
box('Rear wall | cap',(0,4.36,1.57),(13.35,.23,.08),white,.03)
box('Left wall | cutaway',(-6.57,0,.41),(.17,8.7,.8),wall,.025)
box('Left wall | cap',(-6.57,0,.82),(.24,8.75,.07),white,.025)
box('Right wall | cutaway',(6.57,0,.41),(.17,8.7,.8),wall,.025)
box('Right wall | cap',(6.57,0,.82),(.24,8.75,.07),white,.025)

# Woven rug under the central desk, multiple inset borders and fringe.
box('Rug | charcoal field',(.65,-.53,.065),(5.55,5.2,.055),cloth,.055)
for inset,m in [(.12,paper),(.20,ink),(.26,paper),(.34,cloth)]:
    curve('Rug | inset border',[(.65-2.775+inset,-.53-2.6+inset,.099),(.65+2.775-inset,-.53-2.6+inset,.099),(.65+2.775-inset,-.53+2.6-inset,.099),(.65-2.775+inset,-.53+2.6-inset,.099)],.012,m,True)
for x in [(-2.05+i*.11) for i in range(50)]:
    for y in [-3.2,2.14]:rod('Rug | cotton fringe',(x,y-.08,.06),(x,y+.08,.06),.012,paper)

# Rear bookshelf has individually bound volumes, not a texture plane.
for x in [-2.1,0,2.1]:
    box('Library | tall cabinet back',(x,3.91,1.2),(1.95,.13,2.3),dark,.03)
    for dx in [-.98,.98]:box('Library | upright',(x+dx,3.63,1.2),(.09,.65,2.4),wood,.02)
    for z in [.12,.85,1.6,2.35]:box('Library | shelf',(x,3.60,z),(2.04,.75,.095),wood,.025)
    for level,z in enumerate([.2,.93,1.68]):
        px=x-.84
        for j in range(10):
            width=random.uniform(.105,.18);height=random.uniform(.42,.61)
            bm=[ink,paper,wood,cloth][(j+level)%4]
            box('Library | book spine',(px,3.40,z+height/2),(width,.42,height),bm,.014)
            for zz in [z+.09,z+height-.09]:box('Library | gilt spine band',(px,3.18,zz),(width*.85,.008,.017),silver,.002)
            px+=width+.021
    box('Library | cornice',(x,3.62,2.43),(2.10,.78,.13),dark,.035)

# Main reading desk.
top=table('Keeper desk',.65,.15,4.35,1.94,1.37)
box('Desk | leather writing mat',(.65,.02,top+.014),(2.25,1.4,.025),ink,.045)
for side in [-1,1]:
    for end in [-1,1]:box('Desk | brass mat corner',(.65+side*1.05,.02+end*.63,top+.03),(.12,.07,.008),metal,.005)
book('Open reference book',.60,-.07,top+.05,.58,.90,.12,opened=True)
book('Desk | atlas',1.97,.54,top+.04,.66,.90,.16,dark,.10)
book('Desk | index',2.00,.54,top+.23,.60,.83,.12,paper,-.04)
book('Desk | notebook',-.87,.18,top+.02,.50,.76,.11,wood,-.13)
lamp(-1.06,.70,top,.8)
cylinder('Inkwell | base',(1.60,-.56,top+.07),.10,.14,glass)
cylinder('Inkwell | cap',(1.60,-.56,top+.16),.07,.03,metal)
rod('Pen | long nib',(1.63,-.53,top+.16),(1.80,-.49,top+.60),.014,ink)
cylinder('Mug | porcelain',(-.51,.64,top+.11),.105,.22,white)
cylinder('Mug | coffee',(-.51,.64,top+.223),.088,.01,ink)
ring('Mug | handle',(-.38,.64,top+.12),.085,.023,white,(math.pi/2,0,0))
paper_stack(1.35,.76,top+.01,.37,.36,3)

# Two actual document workstations, kept on the left.
for k,(x,y) in enumerate([(-4.35,1.45),(-4.20,-1.46)]):
    z=table('Documents desk %d'%(k+1),x,y,2.45,1.75,1.08)
    for xx,yy,n in [(x-.62,y+.20,13),(x+.55,y-.14,8)]:
        paper_stack(xx,yy,z+.02,.64,.87,n)
        box('Documents | dark clipboard',(xx,yy,z+.015),(.72,.95,.023),dark,.018)
    box('Documents | sorting tray',(x+.55,y+.49,z+.13),(.77,.5,.22),wood,.025)
    box('Documents | tray opening',(x+.55,y+.48,z+.25),(.66,.41,.03),ink,.01)
    for j in range(5):
        box('Documents | upright folder',(x+.3+j*.105,y+.48,z+.40),(.034,.37,.38),paper if j%2 else cloth,.006,rot=(0,.10,0))
    lamp(x-.88,y+.58,z,.58)
    # Small document plaque on the front edge.
    box('Documents | numbered enamel label',(x,y-.88,1.03),(.44,.035,.12),paper,.015)
    text('Documents | label',('I' if k==0 else 'II'),(x,y-.901,1.0),.095,ink,(math.pi/2,0,0))

# Archive stools and a rolling paper trolley.
for x,y in [(-4.2,-2.7),(-4.4,.15)]:
    cylinder('Archive stool | seat',(x,y,.56),.34,.12,dark)
    for a in [0,math.tau/3,math.tau*2/3]:
        rod('Archive stool | leg',(x+math.cos(a)*.22,y+math.sin(a)*.22,.5),(x+math.cos(a)*.29,y+math.sin(a)*.29,.08),.035,wood)
plant(-5.72,3.33,.04,.83)
plant(5.62,-2.95,.04,1.2)

# Web dispatch: round map table + thread gate + friendly spider.
for a in [0,math.tau/3,math.tau*2/3]:
    rod('Web station | curved leg',(4.64+math.cos(a)*.35,.35+math.sin(a)*.35,.85),(4.64+math.cos(a)*.55,.35+math.sin(a)*.55,.05),.055,dark)
cylinder('Web station | round tabletop',(4.64,.35,.91),1.0,.15,wood,64)
for r in [.65,.82]:ring('Web station | engraved ring',(4.64,.35,.992),r,.009,paper)
for angle in [0,math.pi/3,2*math.pi/3]:
    rod('Web station | engraved compass',(4.64-math.cos(angle)*.75,.35-math.sin(angle)*.75,.998),(4.64+math.cos(angle)*.75,.35+math.sin(angle)*.75,.998),.004,paper)
# A freestanding wire web at the rear-right, a visual destination for the spider.
webcenter=(4.8,2.75,1.50)
for x in [3.76,5.84]:
    rod('Web gate | upright',(x,2.75,.05),(x,2.75,2.57),.06,dark)
    sphere('Web gate | finial',(x,2.75,2.63),(.10,)*3,metal)
    cylinder('Web gate | foot',(x,2.75,.09),.22,.14,dark)
rod('Web gate | top',(3.76,2.75,2.57),(5.84,2.75,2.57),.05,dark)
for a in [i*math.tau/8 for i in range(8)]:
    rod('Web | spoke',webcenter,(webcenter[0]+math.cos(a)*1.01,2.75,webcenter[2]+math.sin(a)*1.01),.008,paper)
for radius in [.24,.48,.73,1.01]:
    curve('Web | silken polygon',[(webcenter[0]+math.cos(a)*radius,2.75,webcenter[2]+math.sin(a)*radius) for a in [i*math.tau/8 for i in range(8)]],.009,white,True)

spider_before=set(bpy.data.objects)
sx,sy,sz=4.63,.28,1.19
sphere('Pip | velvet abdomen',(sx,sy+.09,sz),(.26,.32,.21),ink)
sphere('Pip | head',(sx,sy-.18,sz-.01),(.20,.18,.18),dark)
for dx in [-.075,.075]:
    sphere('Pip | white eye',(sx+dx,sy-.32,sz+.035),(.049,.038,.063),white)
    sphere('Pip | pupil',(sx+dx,sy-.35,sz+.025),(.020,.012,.026),ink)
for side in [-1,1]:
    for i in range(4):
        yy=sy-.18+i*.14
        a=(sx+side*.16,yy,sz+.01)
        b=(sx+side*(.39+abs(i-1.5)*.04),yy+(i-1.5)*.08,sz+.12)
        c=(sx+side*(.53+abs(i-1.5)*.04),yy+(i-1.5)*.15,1.02)
        rod('Pip | upper leg',a,b,.024,ink);rod('Pip | lower leg',b,c,.018,ink)
        sphere('Pip | joint',b,(.032,)*3,dark)
spider_objects=list(set(bpy.data.objects)-spider_before)

# A tufted chair, with actual back slats and carved base.
cx,cy=.65,-1.74
box('Chair | seat',(cx,cy,.75),(1.12,1.06,.15),dark,.11)
box('Chair | leather seat cushion',(cx,cy,.86),(.99,.96,.17),cloth,.11)
for dx in [-.48,.48]:
    for dy in [-.4,.4]:rod('Chair | foot',(cx+dx,cy+dy,.72),(cx+dx*1.12,cy+dy*1.18,.09),.065,wood)
for dx in [-.51,.51]:
    rod('Chair | back upright',(cx+dx,cy-.45,.75),(cx+dx,cy-.46,1.73),.055,wood)
box('Chair | curved back cushion',(cx,cy-.47,1.33),(1.12,.16,.63),cloth,.14)
box('Chair | top rail',(cx,cy-.47,1.69),(1.19,.20,.12),dark,.06)
for dx in [-.27,0,.27]:
    sphere('Chair | tuft',(cx+dx,cy-.565,1.34),(.035,.018,.035),ink)
for dx in [-.59,.59]:
    rod('Chair | arm support',(cx+dx,cy+.12,.79),(cx+dx,cy+.12,1.13),.04,wood)
    box('Chair | armrest',(cx+dx,cy,1.15),(.13,.75,.11),wood,.045)

# Keeper, handmade clay character with jacket, rolled sleeves, hands, hair,
# collar, nose, ears, spectacles, and separately articulated limbs.
clerk_before=set(bpy.data.objects)
sphere('Keeper | seated trousers',(cx,cy+.06,1.02),(.39,.32,.24),ink)
for side in [-1,1]:
    rod('Keeper | thigh',(cx+side*.22,cy+.05,.97),(cx+side*.27,cy+.55,.83),.16,cloth)
    rod('Keeper | shin',(cx+side*.27,cy+.55,.83),(cx+side*.25,cy+.57,.30),.115,ink)
    sphere('Keeper | polished shoe',(cx+side*.25,cy+.69,.22),(.16,.29,.12),dark)
torso=sphere('Keeper | tailored waistcoat',(cx,cy+.02,1.42),(.39,.29,.50),dark)
torso.rotation_euler.x=math.radians(-12)
box('Keeper | white shirt bib',(cx,cy+.286,1.60),(.19,.045,.41),paper,.035,rot=(math.radians(-12),0,0))
for side in [-1,1]:
    lapel=box('Keeper | waistcoat lapel',(cx+side*.16,cy+.263,1.65),(.12,.055,.34),ink,.015,rot=(math.radians(-12),side*.22,side*.25))
for z in [1.35,1.48,1.61]:sphere('Keeper | waistcoat button',(cx+.045,cy+.30,z),(.025,.016,.025),metal)
cylinder('Keeper | neck',(cx,cy+.13,1.94),.13,.24,skin)
ring('Keeper | white collar',(cx,cy+.13,1.89),.15,.045,white)
# Head tilted forward; crown and side profile remain legible from camera above.
head=sphere('Keeper | sculpted head',(cx,cy+.19,2.17),(.29,.27,.34),skin,32)
head.rotation_euler.x=math.radians(-14)
for side in [-1,1]:
    sphere('Keeper | ear',(cx+side*.282,cy+.17,2.16),(.061,.065,.095),skin)
    sphere('Keeper | inner ear',(cx+side*.312,cy+.154,2.17),(.018,.037,.053),wood)
sphere('Keeper | nose',(cx,cy+.448,2.14),(.070,.105,.079),skin)
# Hair cap built from overlapping sculpted locks, clearly separate from skin.
sphere('Keeper | swept hair cap',(cx,cy+.10,2.35),(.297,.259,.197),ink,32)
for i in range(7):
    xx=cx-.23+i*.074
    o=sphere('Keeper | swept lock',(xx,cy+.205,2.435-abs(i-3)*.015),(.085,.195,.074),dark)
    o.rotation_euler.z=-.30
for side in [-1,1]:
    sphere('Keeper | sideburn',(cx+side*.255,cy+.24,2.25),(.045,.075,.12),ink)
for side in [-1,1]:
    # Spectacle circles face +Y, the same direction as the open book.
    ring('Keeper | wire spectacles',(cx+side*.112,cy+.425,2.245),.081,.009,metal,(math.pi/2,0,0))
    sphere('Keeper | eye',(cx+side*.112,cy+.428,2.242),(.022,.012,.025),ink)
    rod('Keeper | spectacles arm',(cx+side*.20,cy+.425,2.245),(cx+side*.27,cy+.15,2.24),.008,metal)
rod('Keeper | glasses bridge',(cx-.03,cy+.43,2.245),(cx+.03,cy+.43,2.245),.009,metal)
for side in [-1,1]:
    shoulder=(cx+side*.34,cy+.04,1.72)
    elbow=(cx+side*.56,cy+.47,1.40)
    wrist=(cx+side*.44,cy+1.08,top+.12)
    rod('Keeper | white upper sleeve',shoulder,elbow,.14,paper)
    sphere('Keeper | elbow',elbow,(.145,.145,.13),paper)
    rod('Keeper | rolled forearm',elbow,wrist,.115,white)
    sphere('Keeper | cuff',wrist,(.12,.09,.08),paper)
    hand=(cx+side*.40,cy+1.19,top+.11)
    sphere('Keeper | hand',hand,(.12,.17,.055),skin)
    for finger in range(4):
        xx=hand[0]+(finger-1.5)*.044
        rod('Keeper | resting finger',(xx,hand[1]+.05,hand[2]),(xx-side*.018,hand[1]+.17-.012*abs(finger-1),hand[2]-.012),.021,skin)
    sphere('Keeper | thumb',(hand[0]-side*.10,hand[1]+.015,hand[2]+.005),(.045,.075,.04),skin)
clerk_objects=list(set(bpy.data.objects)-clerk_before)

# Scattered floor books give the miniature a lived-in silhouette.
book('Floor atlas',2.62,-2.42,.12,.67,.88,.16,dark,.18)
book('Floor index',2.57,-2.42,.32,.59,.81,.11,paper,-.08)
box('Wastepaper basket | body',(-2.1,-1.6,.29),(.49,.49,.55),wood,.08)
box('Wastepaper basket | shadow opening',(-2.1,-1.6,.57),(.39,.39,.025),ink,.06)
for i in range(5):sphere('Wastepaper | crumpled sheet',(-2.1+random.uniform(-.13,.13),-1.6+random.uniform(-.13,.13),.56),(.12,.1,.10),paper)

# Camera and soft, gallery-quality monochrome lighting.
world=bpy.context.scene.world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.74,.74,.74,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65

def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
area('Softbox | large northwest key',(-5,-3,10),1500,7)
area('Softbox | rim',(5,5,8),1000,6)
area('Softbox | gentle front',(0,-7,5),450,5)
box('Backdrop | matte white',(0,0,-.48),(200,200,.1),paper,0)

bpy.ops.object.camera_add(location=(0,-10.8,17.8))
camera=bpy.context.object;camera.name='Camera | orthographic top-down study'
target=Vector((0,.05,.40));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=15.2
scene=bpy.context.scene;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24 if PREVIEW else 80
scene.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    accelerated=any(d.type=='OPTIX' for d in prefs.devices)
    for d in prefs.devices:d.use=d.type=='OPTIX' if accelerated else d.type=='CPU'
    scene.cycles.device='GPU' if accelerated else 'CPU'
except Exception:
    scene.cycles.device='CPU'
scene.render.resolution_x=900 if PREVIEW else 1536
scene.render.resolution_y=600 if PREVIEW else 1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.color_mode='RGB'
scene.render.filepath=str(OUT/('blender-preview.png' if PREVIEW else 'blender.png'))
scene['asset_notes']='Native Blender geometry. No image generation. Grayscale materials. Orthographic clerk study.'
scene['hotspots']='Image percentages from top-left: book 53.95,44.63; clerk 54.28,53.74; upper documents 21.38,33.58; lower documents 22.37,57.94; spider 80.46,43.37; web gate 81.58,21.65. See scene-manifest.json.'
scene['authoring_script']='art/clerk-room/blender/build_room.py'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'clerk-room.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',scene.render.filepath)

# A genuine second character pose for document retrieval. The chair remains at
# the main desk, empty. Both poses are preserved on the native file timeline.
doc_before=set(bpy.data.objects)
dx,dy=-4.95,1.43
skip=('trousers','thigh','shin','shoe','sleeve','elbow','forearm','cuff','hand','finger','thumb')
for original in clerk_objects:
    if any(part in original.name for part in skip):continue
    duplicate=original.copy();duplicate.data=original.data.copy()
    duplicate.name='Documents pose | '+original.name
    bpy.context.collection.objects.link(duplicate)
    duplicate.location+=Vector((dx,dy,.13))
dcx,dcy=cx+dx,cy+dy
sphere('Documents pose | trousers',(dcx,dcy+.04,1.10),(.29,.24,.22),ink)
for side in [-1,1]:
    rod('Documents pose | thigh',(dcx+side*.16,dcy,1.04),(dcx+side*.18,dcy+.02,.60),.13,cloth)
    rod('Documents pose | shin',(dcx+side*.18,dcy+.02,.60),(dcx+side*.20,dcy+.08,.19),.10,ink)
    sphere('Documents pose | shoe',(dcx+side*.20,dcy+.18,.14),(.14,.25,.10),dark)
    shoulder=(dcx+side*.34,dcy+.04,1.85)
    elbow=(dcx+side*.48,dcy+.39,1.48)
    wrist=(dcx+side*.38,dcy+.88,1.31)
    rod('Documents pose | white sleeve',shoulder,elbow,.14,paper)
    sphere('Documents pose | elbow',elbow,(.14,.14,.13),paper)
    rod('Documents pose | rolled forearm',elbow,wrist,.11,white)
    sphere('Documents pose | cuff',wrist,(.12,.08,.08),paper)
    hand=(dcx+side*.35,dcy+1.0,1.31)
    sphere('Documents pose | hand',hand,(.12,.15,.055),skin)
    for finger in range(4):
        xx=hand[0]+(finger-1.5)*.044
        rod('Documents pose | finger',(xx,hand[1]+.04,hand[2]),(xx,hand[1]+.15-.01*abs(finger-1),hand[2]-.008),.021,skin)
    sphere('Documents pose | thumb',(hand[0]-side*.09,hand[1]+.01,hand[2]),(.04,.07,.04),skin)
doc_objects=list(set(bpy.data.objects)-doc_before)
for o in clerk_objects:
    o.hide_render=False;o.hide_viewport=False
    o.keyframe_insert('hide_render',frame=1);o.keyframe_insert('hide_viewport',frame=1)
    o.hide_render=True;o.hide_viewport=True
    o.keyframe_insert('hide_render',frame=2);o.keyframe_insert('hide_viewport',frame=2)
for o in doc_objects:
    o.hide_render=True;o.hide_viewport=True
    o.keyframe_insert('hide_render',frame=1);o.keyframe_insert('hide_viewport',frame=1)
    o.hide_render=False;o.hide_viewport=False
    o.keyframe_insert('hide_render',frame=2);o.keyframe_insert('hide_viewport',frame=2)
scene.frame_end=3
scene.timeline_markers.new('01 | Keeper reading at central desk',frame=1)
scene.timeline_markers.new('02 | Keeper checking left document desk',frame=2)
scene.frame_set(2)
scene.render.filepath=str(OUT/('blender-documents-preview.png' if PREVIEW else 'blender-documents.png'))
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',scene.render.filepath)
# Web dispatch plate: Pip leaves the station, so the UI can animate a single
# spider over this clean background without leaving a duplicate behind.
for o in clerk_objects:
    o.hide_render=False;o.hide_viewport=False
    o.keyframe_insert('hide_render',frame=3);o.keyframe_insert('hide_viewport',frame=3)
for o in doc_objects:
    o.hide_render=True;o.hide_viewport=True
    o.keyframe_insert('hide_render',frame=3);o.keyframe_insert('hide_viewport',frame=3)
for o in spider_objects:
    o.hide_render=False;o.hide_viewport=False
    o.keyframe_insert('hide_render',frame=1);o.keyframe_insert('hide_viewport',frame=1)
    o.hide_render=False;o.hide_viewport=False
    o.keyframe_insert('hide_render',frame=2);o.keyframe_insert('hide_viewport',frame=2)
    o.hide_render=True;o.hide_viewport=True
    o.keyframe_insert('hide_render',frame=3);o.keyframe_insert('hide_viewport',frame=3)
scene.timeline_markers.new('03 | Web dispatch clean plate for animated Pip',frame=3)
scene.frame_set(3)
scene.render.filepath=str(OUT/('blender-web-preview.png' if PREVIEW else 'blender-web.png'))
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',scene.render.filepath)
scene.frame_set(1)
scene.render.filepath=str(OUT/'blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'clerk-room.blend'),compress=True)
