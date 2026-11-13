# 거래노트 3D 앱 아이콘: 아래가 톱니로 잘린 영수증 + 초록 입금완료 체크 + 작은 동전. 배경 투명 PNG.
# usage: blender -b -P icon.py -- <out.png> <size> [samples]
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, SIZE = argv[0], int(argv[1])
SAMPLES = int(argv[2]) if len(argv) > 2 else 128

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)

def mat(name, color, rough=0.4, metal=0.0, coat=0.0, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k in ('Coat Weight', 'Clearcoat'):
        if k in b.inputs: b.inputs[k].default_value = coat; break
    return m

def slab(name, w, h, d, r, seg=10):
    bm = bmesh.new(); pts = []
    for cx, cy, a0 in [(w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)]:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    f = bm.faces.new([bm.verts.new((x, y, -d / 2)) for x, y in pts])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, 0, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    bv = o.modifiers.new('bv', 'BEVEL'); bv.width = min(d * 0.4, 0.03); bv.segments = 4; bv.limit_method = 'ANGLE'
    for p in o.data.polygons: p.use_smooth = True
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return o

# ---------- 영수증 ----------
W, H, TEETH = 1.9, 2.5, 6
pts = [(-W / 2, H / 2), (W / 2, H / 2)]
step = W / TEETH
for i in range(TEETH + 1):
    pts.append((W / 2 - i * step, -H / 2 if i % 2 == 0 else -H / 2 + 0.17))
bm = bmesh.new()
bm.faces.new([bm.verts.new((x, y, 0)) for x, y in pts])
me = bpy.data.meshes.new('R'); bm.to_mesh(me); bm.free()
receipt = bpy.data.objects.new('Receipt', me); sc.collection.objects.link(receipt)
s = receipt.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.06; s.offset = 0
bv = receipt.modifiers.new('b', 'BEVEL'); bv.width = 0.02; bv.segments = 3
receipt.data.materials.append(mat('Paper', '#F3F6FB', rough=0.6))
for p in receipt.data.polygons: p.use_smooth = True

lm = mat('Line', '#AFC0D8', rough=0.6)
for i, (y, w) in enumerate([(0.82, 1.15), (0.56, 0.75)]):
    l = slab(f'L{i}', w, 0.13, 0.03, 0.065, 6); l.data.materials.append(lm)
    l.parent = receipt; l.location = (-0.62 + w / 2, y, 0.05)

# 초록 체크(굵은 튜브)
cu = bpy.data.curves.new('Check', 'CURVE'); cu.dimensions = '3D'
sp = cu.splines.new('POLY'); sp.points.add(2)
for p, co in zip(sp.points, [(-0.5, -0.18, 0), (-0.14, -0.55, 0), (0.55, 0.22, 0)]): p.co = (*co, 1)
cu.bevel_depth = 0.15; cu.bevel_resolution = 8; cu.use_fill_caps = True
check = bpy.data.objects.new('Check', cu); sc.collection.objects.link(check)
check.data.materials.append(mat('Green', '#059669', rough=0.3, coat=0.7))
check.parent = receipt; check.location = (0, 0, 0.16)

receipt.rotation_euler = (math.radians(-10), math.radians(14), math.radians(-7))
receipt.location = (-0.1, 0.08, 0)
receipt.scale = (0.86, 0.86, 0.86)

# ---------- 동전(오른쪽 아래, 깊이감) ----------
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.36, depth=0.1, location=(0.72, -0.84, 0.45), rotation=(math.radians(58), math.radians(-18), 0))
coin = bpy.context.active_object
cb = coin.modifiers.new('b', 'BEVEL'); cb.width = 0.03; cb.segments = 4
bpy.ops.object.shade_smooth()
coin.data.materials.append(mat('Coin', '#F2C24E', rough=0.28, metal=0.6, coat=0.5))

# ---------- 조명·카메라 ----------
world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = lin('#DCE6F5'); bg.inputs[1].default_value = 0.35

def area(name, loc, power, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.size = size
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area('Key', (-4, 3, 5), 260, 3)
area('Fill', (4, -2, 3), 60, 5)
area('Rim', (2, 5, 1.5), 160, 2)

cam_d = bpy.data.cameras.new('C'); cam_d.lens = 90
cam = bpy.data.objects.new('C', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.35, -1.7, 9.2)
cam.rotation_euler = (math.atan2(1.65, 9.2), math.radians(2), 0)

sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            if any(d.type == t for d in prefs.devices):
                for d in prefs.devices: d.use = True
                sc.cycles.device = 'GPU'; break
        except Exception: pass
except Exception: pass
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDERED', OUT)
