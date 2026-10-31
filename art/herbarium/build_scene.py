"""The herbarium shop in Blender 5.2: an anime-shaded library room in three layers, a
continuous-body Keeper with a real armature, and a 3D spider. One camera; every
render registers with every other. Run headless:

  blender -b --python art/herbarium/build_scene.py -- preview   # idle frame + half-size layers, saves the .blend
  blender -b --python art/herbarium/build_scene.py -- room      # the three room layers + drawer plates, full size
  blender -b --python art/herbarium/build_scene.py -- keeper    # every phase, transparent character frames
  blender -b --python art/herbarium/build_scene.py -- all

Then: python3 art/herbarium/pack.py
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUT = ROOT / 'public/herbarium'
FRAMES = SOURCE / 'frames'
OUT.mkdir(parents=True, exist_ok=True); FRAMES.mkdir(exist_ok=True)
MODE = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else ['preview']
W, H = 2160, 1440

# ---------------------------------------------------------------- scene reset
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
scene = bpy.context.scene
def collection(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
COL = {n: collection(n) for n in ['ROOM_BACK', 'ROOM_MID', 'ROOM_FRONT', 'DRAWERS', 'KEEPER', 'SPIDER', 'LIGHTS']}

# ---------------------------------------------------------------- toon materials
def hexrgb(h, k=1.0):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    srgb = lambda c: ((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92
    return (srgb(r) * k, srgb(g) * k, srgb(b) * k, 1)
MATS = {}
def toon(name, base, shade=None, light=None, steps=(.38, .82)):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; out = nt.nodes['Material Output']; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1); bsdf.inputs['Roughness'].default_value = 1
    rgb = nt.nodes.new('ShaderNodeShaderToRGB'); ramp = nt.nodes.new('ShaderNodeValToRGB'); em = nt.nodes.new('ShaderNodeEmission')
    cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
    b = hexrgb(base); cr.elements[0].color = shade and hexrgb(shade) or tuple(v * .62 for v in b[:3]) + (1,)
    cr.elements[1].position = steps[0]; cr.elements[1].color = b
    e = cr.elements.new(steps[1]); e.color = light and hexrgb(light) or tuple(min(1, v * 1.18 + .03) for v in b[:3]) + (1,)
    nt.links.new(bsdf.outputs[0], rgb.inputs[0]); nt.links.new(rgb.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], out.inputs[0])
    MATS[name] = m; return m
cloth = toon('folio cloth', '#35503a'); cloth2 = toon('folio cloth light', '#4a6a4f'); clothdeep = toon('folio cloth deep', '#263b2b')
wood = toon('wood', '#7a6244'); wooddeep = toon('wood deep', '#4f3f2b'); woodlight = toon('wood light', '#9a7f5a')
sheet = toon('sheet', '#efe9da', '#d4caa8', '#fbf8ef'); wall = toon('wall', '#9aa58a', '#7f8c72', '#aab59a')
ink = toon('ink', '#2a2a26', '#1a1a17', '#3a3a35'); red = toon('red', '#9c3b2c'); glass = toon('glass', '#cfdac2', '#a9bc9d', '#e2ead8')
skin = toon('skin', '#e9d2b7', '#c9a98a', '#f4e4cf'); hair = toon('white hair', '#f1ede4', '#cfc8b8', '#ffffff')
vest = toon('waistcoat', '#3b5140', '#263b2b', '#4a6a4f'); shirt = toon('shirt', '#f3efe3', '#cfc8b8', '#ffffff')
trouser = toon('trousers', '#5a4731', '#3e3022', '#7a6244'); apron = toon('apron', '#e9e3d3', '#c9c2ae', '#f6f2e8')
metal = toon('spectacles', '#6b6256', '#3a352d', '#9a9385'); floor = toon('floor', '#6e5a3f', '#4f3f2b', '#8a7350')
spiderm = toon('spider', '#2f2d2a', '#1a1917', '#4a4742'); eyew = toon('eye white', '#fbf8ef', '#e0dacb', '#ffffff')

# ---------------------------------------------------------------- primitives
def link(o, col):
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o
def box(name, loc, dim, mat, col, rot=(0, 0, 0), bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object
    o.name = name; o.scale = (dim[0], dim[1], dim[2]); setmat(o, mat)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 2
    return link(o, col)
def sphere(name, loc, scl, mat, col, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc); o = bpy.context.object
    o.name = name; o.scale = scl; setmat(o, mat); bpy.ops.object.shade_smooth(); return link(o, col)
def rod(name, a, b, r, mat, col, verts=16):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2); o = bpy.context.object
    o.name = name; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); setmat(o, mat); bpy.ops.object.shade_smooth(); return link(o, col)
def ring(name, loc, radius, thick, mat, col, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thick, location=loc, rotation=rot); o = bpy.context.object
    o.name = name; setmat(o, mat); bpy.ops.object.shade_smooth(); return link(o, col)
def empty(name, loc, col, parent=None):
    o = bpy.data.objects.new(name, None); col.objects.link(o); o.location = loc; o.parent = parent; o.empty_display_size = .1; return o

# ---------------------------------------------------------------- the room (x: left -7 .. right +7; camera looks +Y)
FLOOR_Y = 0
box('wall', (0, 3.2, 4.5), (18, .2, 9.0), wall, COL['ROOM_BACK'])
box('floor', (0, -2, -.05), (16, 12, .1), floor, COL['ROOM_BACK'])
for i in range(-8, 9): box(f'floorboard seam {i}', (i * .9, -2, .005), (.025, 12, .01), wooddeep, COL['ROOM_BACK'])
def folio_case(name, x0, x1, y, rows, col, z0=.25, zh=5.6):
    box(f'{name} back', ((x0 + x1) / 2, y + .02, z0 + zh / 2), (x1 - x0, .18, zh), wooddeep, col)
    rh = zh / rows
    for r in range(rows):
        z = z0 + r * rh
        box(f'{name} shelf {r}', ((x0 + x1) / 2, y - .2, z + .04), (x1 - x0 + .1, .62, .08), wood, col)
        x = x0 + .12; k = 0
        while x < x1 - .3:
            w = .22 + ((k * 7 + r * 3) % 5) * .035; h = rh * (.74 + ((k * 5 + r) % 4) * .05)
            m = [cloth, cloth2, clothdeep, cloth][(k + r) % 4]
            box(f'{name} folio {r}-{k}', (x + w / 2, y - .22, z + .08 + h / 2), (w, .5, h), m, col, bevel=.01)
            box(f'{name} label {r}-{k}', (x + w / 2, y - .475, z + .08 + h * .55), (w * .62, .01, h * .22), sheet, col)
            x += w + .035; k += 1
    for s in (x0, x1): box(f'{name} side {s}', (s, y - .2, z0 + zh / 2), (.1, .64, zh), wooddeep, col)
folio_case('left case', -7.8, -1.6, 2.9, 6, COL['ROOM_BACK'], zh=6.6)
folio_case('right case', 2.0, 4.8, 2.9, 6, COL['ROOM_BACK'], zh=6.6)
# A botanical print between the cases.
box('print frame', (-.1, 2.95, 4.0), (1.3, .08, 1.7), wooddeep, COL['ROOM_BACK']); box('print sheet', (-.1, 2.9, 4.0), (1.1, .02, 1.5), sheet, COL['ROOM_BACK'])
for i, (x, z, s) in enumerate([(-.1, 3.6, .22), (-.35, 4.1, .18), (.12, 4.35, .16)]): sphere(f'print leaf {i}', (x, 2.86, z), (s, .01, s * 1.5), cloth, COL['ROOM_BACK'])
rod('print stem', (-.1, 2.86, 3.3), (-.1, 2.86, 4.6), .012, cloth, COL['ROOM_BACK'])
# The window, in the mid layer so its label and the spider stay anchored to it.
WX, WY = 6.4, 2.85
box('window glass', (WX, WY + .05, 3.6), (2.2, .04, 3.4), glass, COL['ROOM_MID'])
for z in (2.0, 3.0, 4.2, 5.2): box(f'window bar {z}', (WX, WY - .02, z), (2.3, .12, .12), wooddeep, COL['ROOM_MID'])
for x in (WX - 1.12, WX, WX + 1.12): box(f'window mullion {x}', (x, WY - .02, 3.6), (.12, .12, 3.4), wooddeep, COL['ROOM_MID'])
box('window sill', (WX, WY - .15, 1.9), (2.5, .5, .14), wood, COL['ROOM_MID'])
for i in range(5):
    rod(f'web strand {i}', (WX + 1.1, WY - .1, 5.2 - i * .02), (WX + .15 + i * .05, WY - .1, 4.0 + i * .2), .006, sheet, COL['ROOM_MID'])
for i in range(3): rod(f'web spiral {i}', (WX + .9 - i * .2, WY - .1, 5.1 - i * .25), (WX + .4 - i * .1, WY - .1, 4.6 - i * .15), .005, sheet, COL['ROOM_MID'])
# The desks (left) with drawers, and the counter (centre).
DESK_X, DESK_Y, DESK_TOP = -3.55, -.6, 1.65
box('desk top', (DESK_X, DESK_Y, DESK_TOP), (3.1, 1.9, .12), woodlight, COL['ROOM_MID'], bevel=.02)
box('desk body', (DESK_X, DESK_Y + .15, 1.0), (3.0, 1.5, 1.2), wood, COL['ROOM_MID'])
DRAWERS = []
for r in range(2):
    for c in range(3):
        x = DESK_X - .95 + c * .95; z = 1.33 - r * .5
        box(f'drawer front {r}{c}', (x, DESK_Y - .62, z), (.86, .06, .42), woodlight, COL['ROOM_MID'], bevel=.01)
        box(f'drawer plate {r}{c}', (x, DESK_Y - .66, z + .02), (.38, .02, .14), sheet, COL['ROOM_MID'])
        ring(f'drawer pull {r}{c}', (x, DESK_Y - .68, z - .1), .05, .012, metal, COL['ROOM_MID'], rot=(math.pi / 2, 0, 0))
        DRAWERS.append((r, c, x, z))
box('counter top', (0.6, -1.0, 1.75), (6.0, 1.6, .14), woodlight, COL['ROOM_MID'], bevel=.02)
box('counter body', (0.6, -.9, .9), (5.9, 1.3, 1.6), wood, COL['ROOM_MID'])
# Front layer: what stands between the visitor and the Keeper.
box('counter lip', (0.6, -1.78, 1.72), (6.1, .18, .2), woodlight, COL['ROOM_FRONT'], bevel=.02)
box('counter face', (0.6, -1.75, .9), (6.0, .1, 1.5), wooddeep, COL['ROOM_FRONT'])
box('desk face', (DESK_X, DESK_Y - .55, .95), (3.1, .08, 1.3), wooddeep, COL['ROOM_FRONT'])
for r, c, x, z in DRAWERS:
    box(f'desk face drawer {r}{c}', (x, DESK_Y - .60, z), (.84, .05, .40), wood, COL['ROOM_FRONT'])
    box(f'desk face plate {r}{c}', (x, DESK_Y - .64, z + .02), (.36, .02, .13), sheet, COL['ROOM_FRONT'])
rod('lamp cord', (0.6, -.6, 9), (0.6, -.6, 6.3), .015, ink, COL['ROOM_BACK']); sphere('lamp shade', (0.6, -.6, 6.1), (.55, .55, .3), cloth, COL['ROOM_BACK']); sphere('lamp bulb', (0.6, -.6, 5.95), (.18, .18, .14), sheet, COL['ROOM_BACK'])
# A plant at the far right, in front.
for i, (a, h) in enumerate([(-.5, 2.3), (-.2, 2.6), (.1, 2.45), (.4, 2.2)]):
    rod(f'plant stem {i}', (7.0, -2.6, .8), (7.0 + a, -2.4, h), .025, cloth, COL['ROOM_FRONT'])
    sphere(f'plant leaf {i}', (7.0 + a * 1.1, -2.4, h + .1), (.22, .08, .3), cloth2 if i % 2 else cloth, COL['ROOM_FRONT'])
box('plant pot', (7.0, -2.6, .55), (.7, .7, .7), wooddeep, COL['ROOM_FRONT'])
# Open drawers, each in its own collection so it renders as a plate.
DRAWER_COLS = []
for r, c, x, z in DRAWERS:
    col = collection(f'DRAWER_{r}{c}'); DRAWER_COLS.append(col)
    box(f'open drawer box {r}{c}', (x, DESK_Y - 1.05, z - .05), (.84, .9, .34), wood, col)
    box(f'open drawer cavity {r}{c}', (x, DESK_Y - 1.05, z + .0), (.74, .8, .26), wooddeep, col)
    box(f'open drawer front {r}{c}', (x, DESK_Y - 1.52, z), (.86, .06, .42), woodlight, col, bevel=.01)
    box(f'open drawer plate {r}{c}', (x, DESK_Y - 1.56, z + .02), (.38, .02, .14), sheet, col)
    for k in range(4): box(f'open drawer sheet {r}{c}-{k}', (x - .22 + k * .15, DESK_Y - 1.0 - k * .05, z + .05 + k * .03), (.5, .7, .01), sheet, col, rot=(0, .05 * (k - 1.5), .08 * (k % 2 - .5)))

# ---------------------------------------------------------------- the Keeper: one fused body on an armature
KX, KY = 0.0, 0.1
def part(name, kind, *a, **k):
    f = {'sphere': sphere, 'box': box, 'rod': rod}[kind]; return f(name, *a, col=COL['KEEPER'], **k)
body_parts = []
body_parts.append(part('torso', 'sphere', (KX, KY, 2.35), (.46, .36, .52), vest))
body_parts.append(part('belly', 'sphere', (KX, KY - .03, 2.05), (.44, .36, .40), vest))
body_parts.append(part('hips', 'sphere', (KX, KY, 1.70), (.38, .30, .30), trouser))
body_parts.append(part('neck', 'rod', (KX, KY, 2.70), (KX, KY, 2.95), .13, skin))
body_parts.append(part('head', 'sphere', (KX, KY - .02, 3.15), (.40, .36, .42), skin))
body_parts.append(part('jaw', 'sphere', (KX, KY - .06, 2.98), (.33, .30, .26), skin))
for s in (-1, 1):
    body_parts.append(part(f'shoulder {s}', 'sphere', (KX + s * .42, KY, 2.62), (.18, .17, .17), vest))
    body_parts.append(part(f'upper arm {s}', 'rod', (KX + s * .44, KY, 2.60), (KX + s * .62, KY - .1, 2.10), .13, shirt))
    body_parts.append(part(f'forearm {s}', 'rod', (KX + s * .62, KY - .1, 2.10), (KX + s * .58, KY - .72, 1.95), .10, skin))
    body_parts.append(part(f'thigh {s}', 'rod', (KX + s * .19, KY, 1.65), (KX + s * .23, KY - .05, .95), .15, trouser))
    body_parts.append(part(f'shin {s}', 'rod', (KX + s * .23, KY - .05, .95), (KX + s * .23, KY, .25), .11, trouser))
# Fuse the parts into one continuous surface: the neck belongs to the body.
for o in body_parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]
bpy.ops.object.transform_apply(scale=True, rotation=True)
bpy.ops.object.join(); body = bpy.context.object; body.name = 'Keeper body'
rm = body.modifiers.new('fuse', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = .045; rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='fuse')
sm = body.modifiers.new('soften', 'SMOOTH'); sm.factor = .6; sm.iterations = 6
bpy.ops.object.modifier_apply(modifier='soften')
bpy.ops.object.shade_smooth()
body.data.materials.clear()
for m in (skin, vest, shirt, trouser): body.data.materials.append(m)
# Paint the fused body by height and limb: a simple, honest cel-shaded figure.
for poly in body.data.polygons:
    z = sum(body.data.vertices[v].co.z for v in poly.vertices) / len(poly.vertices)
    x = abs(sum(body.data.vertices[v].co.x for v in poly.vertices) / len(poly.vertices) - KX)
    poly.material_index = 0 if z > 2.66 else (2 if x > .5 and z > 2.0 else (0 if x > .5 else (1 if z > 1.82 else 3)))
bpy.ops.object.select_all(action='DESELECT')
# Apron, collar and shirt front sit on the body as thin shells.
part('apron', 'box', (KX, KY - .36, 1.45), (.9, .06, .75), apron, bevel=.03)
part('apron bib', 'box', (KX, KY - .40, 2.15), (.5, .04, .55), apron, bevel=.02)
part('collar', 'box', (KX, KY - .30, 2.72), (.36, .08, .16), shirt, bevel=.03)
for s in (-1, 1): part(f'lapel {s}', 'box', (KX + s * .17, KY - .35, 2.35), (.14, .04, .5), vest, rot=(0, 0, s * .22))
shells = [bpy.data.objects[n] for n in ('apron', 'apron bib', 'collar', 'lapel -1', 'lapel 1')]
# Head features (follow the head bone).
feat = []
feat.append(part('face', 'sphere', (KX, KY - .30, 3.10), (.28, .14, .30), skin))
for s in (-1, 1):
    feat.append(part(f'ear {s}', 'sphere', (KX + s * .40, KY, 3.08), (.07, .06, .11), skin))
    feat.append(part(f'eye white {s}', 'sphere', (KX + s * .15, KY - .455, 3.18), (.085, .035, .075), eyew))
    feat.append(part(f'pupil {s}', 'sphere', (KX + s * .15, KY - .49, 3.175), (.04, .02, .045), ink))
    feat.append(part(f'brow {s}', 'sphere', (KX + s * .15, KY - .475, 3.29), (.11, .03, .03), hair))
    feat.append(ring(f'spectacle {s}', (KX + s * .16, KY - .51, 3.17), .115, .012, metal, COL['KEEPER'], rot=(math.pi / 2, 0, 0)))
    feat.append(part(f'temple {s}', 'rod', (KX + s * .275, KY - .50, 3.17), (KX + s * .40, KY - .02, 3.15), .01, metal))
    feat.append(part(f'side hair {s}', 'sphere', (KX + s * .36, KY + .10, 3.18), (.10, .17, .19), hair))
    feat.append(part(f'moustache {s}', 'sphere', (KX + s * .08, KY - .50, 2.995), (.11, .05, .045), hair))
feat.append(part('spectacle bridge', 'rod', (KX - .05, KY - .52, 3.17), (KX + .05, KY - .52, 3.17), .01, metal))
feat.append(part('nose', 'sphere', (KX, KY - .50, 3.07), (.07, .10, .08), skin))
feat.append(part('beard', 'sphere', (KX, KY - .30, 2.80), (.27, .22, .20), hair))
feat.append(part('back hair', 'sphere', (KX, KY + .20, 3.22), (.26, .18, .26), hair))
feat.append(part('smile', 'rod', (KX - .09, KY - .52, 2.96), (KX + .09, KY - .52, 2.96), .012, ink))
# Hands (follow the hand bones) and the things he holds.
hands = {}
for s in (-1, 1):
    h = part(f'hand {s}', 'sphere', (KX + s * .58, KY - .75, 1.93), (.11, .15, .07), skin)
    for f in range(4): part(f'finger {s}{f}', 'sphere', (KX + s * .58 + (f - 1.5) * .045, KY - .88, 1.92), (.025, .09, .025), skin)
    part(f'thumb {s}', 'sphere', (KX + s * .49, KY - .76, 1.95), (.035, .07, .035), skin)
    hands[s] = h
shoes = {s: part(f'shoe {s}', 'sphere', (KX + s * .23, KY - .12, .18), (.16, .3, .12), ink) for s in (-1, 1)}

# Armature
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0)); arm = bpy.context.object; arm.name = 'Keeper rig'
link(arm, COL['KEEPER']); arm.show_in_front = True
eb = arm.data.edit_bones
for b in list(eb): eb.remove(b)
def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name); b.head = Vector(head); b.tail = Vector(tail); b.use_connect = connect
    if parent: b.parent = eb[parent]
    return b
bone('root', (KX, KY, 1.55), (KX, KY, 1.75))
bone('spine', (KX, KY, 1.75), (KX, KY, 2.35), 'root', True)
bone('chest', (KX, KY, 2.35), (KX, KY, 2.70), 'spine', True)
bone('neck', (KX, KY, 2.70), (KX, KY, 2.92), 'chest', True)
bone('head', (KX, KY, 2.92), (KX, KY, 3.45), 'neck', True)
for s, tag in ((-1, 'L'), (1, 'R')):
    bone(f'upper_arm.{tag}', (KX + s * .44, KY, 2.60), (KX + s * .62, KY - .1, 2.10), 'chest')
    bone(f'forearm.{tag}', (KX + s * .62, KY - .1, 2.10), (KX + s * .58, KY - .72, 1.95), f'upper_arm.{tag}', True)
    bone(f'hand.{tag}', (KX + s * .58, KY - .72, 1.95), (KX + s * .58, KY - .92, 1.92), f'forearm.{tag}', True)
    bone(f'thigh.{tag}', (KX + s * .19, KY, 1.65), (KX + s * .23, KY - .05, .95), 'root')
    bone(f'shin.{tag}', (KX + s * .23, KY - .05, .95), (KX + s * .23, KY, .25), f'thigh.{tag}', True)
    bone(f'foot.{tag}', (KX + s * .23, KY, .25), (KX + s * .23, KY - .3, .15), f'shin.{tag}', True)
bpy.ops.object.mode_set(mode='OBJECT')
# Automatic weights for the fused body and its shells; bone parents for the rigid pieces.
for o in [body] + shells:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
def bone_parent(o, name):
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = name
    b = arm.data.bones[name]
    o.matrix_parent_inverse = (arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
for o in feat: bone_parent(o, 'head')
for s, tag in ((-1, 'L'), (1, 'R')):
    bone_parent(hands[s], f'hand.{tag}')
    for f in range(4): bone_parent(bpy.data.objects[f'finger {s}{f}'], f'hand.{tag}')
    bone_parent(bpy.data.objects[f'thumb {s}'], f'hand.{tag}')
    bone_parent(shoes[s], f'foot.{tag}')
# IK targets: hands and feet are placed, the arms and legs follow.
targets = {}
for s, tag in ((-1, 'L'), (1, 'R')):
    for part_name, bone_name, loc in ((f'hand target {tag}', f'forearm.{tag}', (KX + s * .58, KY - .72, 1.95)), (f'foot target {tag}', f'shin.{tag}', (KX + s * .23, KY, .25))):
        t = empty(part_name, loc, COL['KEEPER']); targets[part_name] = t
        pb = arm.pose.bones[bone_name]; ik = pb.constraints.new('IK'); ik.target = t; ik.chain_count = 2
    pole = empty(f'elbow pole {tag}', (KX + s * 1.4, KY + 1.2, 2.2), COL['KEEPER']); targets[f'elbow pole {tag}'] = pole
    ik = arm.pose.bones[f'forearm.{tag}'].constraints['IK']; ik.pole_target = pole; ik.pole_angle = math.radians(-90 if s < 0 else 90)
    kpole = empty(f'knee pole {tag}', (KX + s * .3, KY - 2.0, .9), COL['KEEPER']); targets[f'knee pole {tag}'] = kpole
    ik2 = arm.pose.bones[f'shin.{tag}'].constraints['IK']; ik2.pole_target = kpole; ik2.pole_angle = math.radians(-90)
# Props he handles.
folio_prop = part('held folio', 'box', (0, 0, 0), (.9, .62, .05), cloth, bevel=.01); folio_prop.location = (0, 0, -20)
folio_leaf = part('folio leaf', 'box', (0, 0, 0), (.42, .6, .01), sheet); folio_leaf.location = (0, 0, -20)
held_sheet = part('held sheet', 'box', (0, 0, 0), (.62, .78, .012), sheet); held_sheet.location = (0, 0, -20)
for j in range(6): part(f'held line {j}', 'box', (0, -.22 + j * .08, .009), (.44 if j < 5 else .26, .012, .003), ink).parent = held_sheet
register = part('register', 'box', (0.95, -.95, 1.86), (1.1, .78, .1), sheet, bevel=.01)
part('register spine', 'box', (0.95, -.95, 1.82), (.04, .8, .12), wooddeep)
page = empty('register page pivot', (0.95, -.95, 1.92), COL['KEEPER'])
page_leaf = part('register page', 'box', (.26, 0, 0), (.52, .74, .008), sheet); page_leaf.parent = page
for j in range(7): part(f'register line {j}', 'box', (.26, -.28 + j * .09, .006), (.4, .012, .003), ink).parent = page

# ---------------------------------------------------------------- the spider
spider = empty('spider root', (1.9, -.7, 1.98), COL['SPIDER'])
def spart(name, kind, *a, **k): o = {'sphere': sphere, 'rod': rod}[kind](name, *a, col=COL['SPIDER'], **k); o.parent = spider; return o
spart('abdomen', 'sphere', (0, .06, 0), (.17, .21, .15), spiderm); spart('cephalothorax', 'sphere', (0, -.13, -.01), (.12, .12, .11), spiderm)
for s in (-1, 1):
    spart(f'spider eye {s}', 'sphere', (s * .05, -.23, .03), (.034, .025, .04), eyew); spart(f'spider pupil {s}', 'sphere', (s * .05, -.252, .03), (.016, .01, .02), ink)
legs = []
for s in (-1, 1):
    for i in range(4):
        yy = -.12 + i * .09; a = (s * .09, yy, 0); b = (s * .26, yy + (i - 1.5) * .06, .08); c = (s * .37, yy + (i - 1.5) * .09, -.14)
        up = spart(f'spider leg up {s}{i}', 'rod', a, b, .015, spiderm); low = spart(f'spider leg low {s}{i}', 'rod', b, c, .012, spiderm)
        legs.append((s, i, up, low))

# ---------------------------------------------------------------- light, camera, render
scene.world.use_nodes = True; scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.75, .78, .7, 1); scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
def sun(name, rot, energy, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = color; d.angle = .3
    o = bpy.data.objects.new(name, d); COL['LIGHTS'].objects.link(o); o.rotation_euler = rot; return o
sun('key', (math.radians(52), math.radians(-18), math.radians(-25)), 3.2, (1, .97, .9))
sun('fill', (math.radians(70), math.radians(20), math.radians(40)), 1.1, (.85, .95, .9))
bpy.ops.object.camera_add(location=(0.4, -9.5, 3.0)); cam = bpy.context.object; cam.name = 'camera'; link(cam, COL['LIGHTS'])
cam.rotation_euler = (Vector((0.4, 1.5, 2.15)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 30; scene.camera = cam
scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'; scene.render.film_transparent = True; scene.render.fps = 12
scene.render.use_freestyle = True; scene.render.line_thickness = 1.7
scene.view_layers[0].use_freestyle = True
ls = scene.view_layers[0].freestyle_settings.linesets.new('ink') if not scene.view_layers[0].freestyle_settings.linesets else scene.view_layers[0].freestyle_settings.linesets[0]
ls.linestyle.color = (.16, .16, .15); ls.linestyle.thickness = 1.7; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
try: scene.eevee.taa_render_samples = 16
except Exception: pass
scene['world'] = 'The Herbarium Folio: an anime-shaded library, a continuous-body Keeper on a real armature, a 3D spider.'

# ---------------------------------------------------------------- posing
def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
REST_HAND = {-1: (KX - .58, KY - .72, 1.95), 1: (KX + .58, KY - .72, 1.95)}
REST_FOOT = {-1: (KX - .23, KY, .25), 1: (KX + .23, KY, .25)}
DESK_STAND = (DESK_X + 1.25, DESK_Y + .95)  # where he stands to work the desk, beside it
SPIDER_HOME = (1.9, -.7, 1.98); SPIDER_WEB = (WX + .6, WY - .25, 4.7)
def key_all(frame):
    for pb in arm.pose.bones: pb.keyframe_insert('rotation_euler', frame=frame)
    for o in [arm, spider, folio_prop, folio_leaf, held_sheet, page] + list(targets.values()):
        o.keyframe_insert('location', frame=frame); o.keyframe_insert('rotation_euler', frame=frame)
    for s, i, up, low in legs:
        for o in (up, low): o.keyframe_insert('location', frame=frame); o.keyframe_insert('rotation_euler', frame=frame); o.keyframe_insert('scale', frame=frame)
def move_rod(o, a, b):
    a, b = Vector(a), Vector(b); o.location = (a + b) / 2; o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    depth = max(v.co.z for v in o.data.vertices) - min(v.co.z for v in o.data.vertices); o.scale.z = (b - a).length / depth
def pose(phase, t):
    cyc = math.sin(t * math.tau)
    for pb in arm.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
    arm.location = (0, 0, .006 * cyc); arm.rotation_euler = (0, 0, 0)
    hands_at = dict(REST_HAND); feet_at = dict(REST_FOOT)
    head = [.04 * cyc, 0, .02 * cyc]; chest = [.01 * cyc, 0, 0]
    spider.location = SPIDER_HOME; spider.rotation_euler = (0, 0, 0)
    folio_prop.location = (0, 0, -20); folio_leaf.location = (0, 0, -20); held_sheet.location = (0, 0, -20); held_sheet.rotation_euler = (0, 0, 0)
    page.rotation_euler = (0, 0, 0)
    walking = 0; dx = dy = 0
    if phase == 'greet':
        # Head down over the register, then he looks up at you and straightens.
        q = smooth((t - .15) / .55); head = [.42 * (1 - q) - .04 * q, 0, .12 * (1 - q)]; chest = [.12 * (1 - q), 0, 0]
        hands_at[1] = lerp((KX + .5, KY - .9, 1.92), REST_HAND[1], q); hands_at[-1] = lerp((KX - .5, KY - .9, 1.92), REST_HAND[-1], q)
    elif phase == 'dispatch':
        q = smooth(t / .55); hands_at[1] = lerp(REST_HAND[1], (KX + 1.25, KY - .55, 2.25), q); head = [0, 0, -.28 * q]
        r = smooth((t - .3) / .7); spider.location = lerp(SPIDER_HOME, SPIDER_WEB, r); spider.location.z += .5 * math.sin(r * math.pi); spider.rotation_euler = (0, 0, -.5)
    elif phase == 'web':
        spider.location = (SPIDER_WEB[0] + .08 * cyc, SPIDER_WEB[1], SPIDER_WEB[2] + .1 * math.cos(t * math.tau)); spider.rotation_euler = (0, 0, -.5)
        head = [0, 0, -.22 + .05 * cyc]; hands_at[1] = (KX + .62, KY - .6, 2.0 + .03 * cyc)
    elif phase in ('walk', 'return'):
        q = smooth(t if phase == 'walk' else 1 - t); dx = DESK_STAND[0] * q; dy = DESK_STAND[1] * q
        walking = math.sin(t * math.tau * 2); arm.location = (dx, dy, .03 * abs(walking)); arm.rotation_euler = (0, 0, -.9 * math.sin(q * math.pi) * (1 if phase == 'walk' else -1))
        for s in (-1, 1): hands_at[s] = (KX + dx + s * .6, KY + dy - .1 + s * .3 * walking, 1.9); feet_at[s] = (KX + dx + s * .23, KY + dy + s * .45 * walking, .25 + .14 * max(0, s * walking))
        head = [.05, 0, .25 * math.sin(q * math.pi)]
    elif phase == 'documents':
        dx, dy = DESK_STAND; arm.location = (dx, dy, 0); arm.rotation_euler = (0, 0, .55)
        head = [.35, 0, .3 + .05 * cyc]; chest = [.18, 0, 0]
        lift = .5 * (1 + cyc)
        hands_at[-1] = (KX + dx - .55, KY + dy - .65, DESK_TOP + .15); hands_at[1] = (KX + dx + .05, KY + dy - .75, DESK_TOP + .25 + .22 * lift)
        for s in (-1, 1): feet_at[s] = (KX + dx + s * .23, KY + dy, .25)
        folio_prop.location = (KX + dx - .3, KY + dy - .75, DESK_TOP + .09); folio_prop.rotation_euler = (0, 0, .55)
        folio_leaf.location = (KX + dx - .1, KY + dy - .72, DESK_TOP + .13 + .2 * lift); folio_leaf.rotation_euler = (.9 * lift, 0, .55)
    elif phase == 'read':
        q = t % 1; turn = smooth((q - .1) / .6); page.rotation_euler.y = -math.pi * turn
        head = [.38 + .03 * cyc, 0, -.12 + .25 * turn]; chest = [.14, 0, 0]
        hturn = turn if q < .72 else 1 - smooth((q - .72) / .28)
        hands_at[1] = (0.95 + .5 * math.cos(math.pi * hturn), -.95 - .3, 1.95 + .3 * math.sin(math.pi * hturn)); hands_at[-1] = (0.5, -1.25, 1.93)
    elif phase == 'present':
        q = smooth(t / .6); hands_at[1] = lerp(REST_HAND[1], (KX + .2, KY - 1.35, 2.15), q); hands_at[-1] = lerp(REST_HAND[-1], (KX - .25, KY - 1.3, 2.1), q)
        held_sheet.location = lerp((KX, KY - .9, 1.95), (KX, KY - 1.45, 2.2), q); held_sheet.rotation_euler = (.5 + .3 * q, 0, 0); head = [.08 * q, 0, 0]
    elif phase == 'error':
        q = math.sin(t * math.pi)
        for s in (-1, 1): hands_at[s] = (KX + s * (.6 + .15 * q), KY - .55, 1.95 + .4 * q)
        head = [0, .08 * q, .07 * q]
    elif phase == 'cancelled':
        q = 1 - smooth(t); hands_at[1] = (KX + .58, KY - .72 + .2 * q, 1.95 + .25 * q); head = [.1 * q, 0, 0]
    elif phase == 'web-return':
        q = smooth(t); spider.location = lerp(SPIDER_WEB, SPIDER_HOME, q); spider.location.z += .5 * math.sin(q * math.pi); spider.rotation_euler = (0, 0, -.5 + .5 * q)
        r = smooth(t / .6); hands_at[1] = lerp(REST_HAND[1], (KX + .2, KY - 1.35, 2.15), r); held_sheet.location = lerp((KX, KY - .9, 1.95), (KX, KY - 1.45, 2.2), r); held_sheet.rotation_euler = (.5 + .3 * r, 0, 0)
    elif phase == 'web-settle':
        q = smooth(t); spider.location = lerp(SPIDER_WEB, SPIDER_HOME, q); spider.location.z += .5 * math.sin(q * math.pi); spider.rotation_euler = (0, 0, -.5 + .5 * q)
        hands_at[1] = (KX + .58, KY - .72 + .2 * (1 - q), 1.95 + .25 * (1 - q)); head = [.1 * (1 - q), 0, 0]
    arm.pose.bones['head'].rotation_euler = head; arm.pose.bones['chest'].rotation_euler = chest
    for s, tag in ((-1, 'L'), (1, 'R')):
        targets[f'hand target {tag}'].location = hands_at[s]; targets[f'foot target {tag}'].location = feet_at[s]
        targets[f'elbow pole {tag}'].location = (KX + dx + s * 1.4, KY + dy + 1.2, 2.2); targets[f'knee pole {tag}'].location = (KX + dx + s * .3, KY + dy - 2.0, .9)
    gait = phase in ('dispatch', 'web', 'web-return', 'web-settle')
    for s, i, up, low in legs:
        wave = math.sin(t * math.tau * 3 + i * math.pi * .65 + s * math.pi / 2) if gait else .05 * cyc
        yy = -.12 + i * .09; a = (s * .09, yy, 0); b = (s * (.26 + .03 * wave), yy + (i - 1.5) * .06 + .02 * wave, .08); c = (s * .37, yy + (i - 1.5) * .09 + .06 * wave, -.14 + .04 * max(wave, 0))
        move_rod(up, a, b); move_rod(low, b, c)
    bpy.context.view_layer.update()

PHASES = {'greet': (18, False), 'idle': (24, True), 'dispatch': (24, False), 'web': (24, True), 'walk': (24, False), 'documents': (24, True), 'read': (24, True), 'return': (24, False), 'present': (24, False), 'error': (18, False), 'cancelled': (12, False), 'web-return': (24, False), 'web-settle': (18, False)}

# ---------------------------------------------------------------- landmarks (normalized image coordinates for the UI)
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()  # the camera's matrix is stale until the depsgraph runs
def ndc(p):
    v = world_to_camera_view(scene, cam, Vector(p)); return [round(v.x, 4), round(1 - v.y, 4)]
landmarks = {
    'desks': ndc((DESK_X, DESK_Y, DESK_TOP)), 'desksLabel': ndc((DESK_X, DESK_Y, DESK_TOP + .9)), 'tray': ndc((DESK_X - 1.5, DESK_Y, DESK_TOP + .5)),
    'counter': ndc((0.6, -1.0, 1.75)), 'register': ndc((0.95, -.95, 1.86)), 'keeperHead': ndc((KX, KY, 3.15)),
    'window': ndc((WX, WY, 3.6)), 'windowLabel': ndc((WX, WY, 1.5)), 'web': ndc(SPIDER_WEB), 'spiderHome': ndc(SPIDER_HOME),
    'drawers': [{'id': f'{r}{c}', 'at': ndc((x, DESK_Y - .62, z)), 'open': ndc((x, DESK_Y - 1.5, z))} for r, c, x, z in DRAWERS],
}

def set_visible(cols):
    for c in COL.values(): c.hide_render = c.name not in cols
    for c in DRAWER_COLS: c.hide_render = c.name not in cols
    scene.render.use_freestyle = True
def render(path):
    scene.render.filepath = str(path); bpy.ops.render.render(write_still=True); print('RENDERED', path, flush=True)

if 'preview' in MODE or 'all' in MODE:
    scene.render.resolution_percentage = 50
    pose('idle', 0); set_visible(['ROOM_BACK', 'ROOM_MID', 'ROOM_FRONT', 'KEEPER', 'SPIDER', 'LIGHTS']); render(SOURCE / 'preview-all.png')
    scene.render.resolution_percentage = 100
if 'room' in MODE or 'all' in MODE:
    pose('idle', 0)
    for layer in ('ROOM_BACK', 'ROOM_MID', 'ROOM_FRONT'):
        set_visible([layer, 'LIGHTS']); render(OUT / f'{layer.lower().replace("room_", "room-")}.png')
    for col in DRAWER_COLS:
        set_visible([col.name, 'LIGHTS']); render(OUT / f'drawer-{col.name[-2:]}.png')
if 'keeper' in MODE or 'all' in MODE:
    set_visible(['KEEPER', 'SPIDER', 'LIGHTS']); offset = 1; manifest_phases = {}; scene.render.resolution_percentage = 75
    for name, (n, loop) in PHASES.items():
        scene.timeline_markers.new(name, frame=offset)
        for i in range(n):
            frame = offset + i; scene.frame_set(frame); pose(name, i / n if loop else i / max(n - 1, 1)); key_all(frame)
            f = FRAMES / f'{name}-{i:03}.png'
            if not f.exists(): render(f)
        manifest_phases[name] = {'frames': n, 'loop': loop, 'startFrame': offset, 'durationMs': round(n / 12 * 1000)}
        offset += n
    scene.frame_end = offset - 1; scene.frame_set(1); scene.render.resolution_percentage = 100
    (SOURCE / 'phases.json').write_text(json.dumps(manifest_phases, indent=2))
(SOURCE / 'landmarks.json').write_text(json.dumps({'width': W, 'height': H, 'landmarks': landmarks}, indent=2))
if 'landmarks' not in MODE: bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'herbarium.blend'), compress=True)
print('DONE', MODE, flush=True)
