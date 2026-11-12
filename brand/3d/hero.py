# 거래노트 메인 3D 그래픽: 네이비 카드 + 입금완료 영수증 + 동전. 배경 투명 PNG로 렌더링합니다.
# usage: blender -b -P hero.py -- <out.png> <width> <height> [samples]
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, W, H = argv[0], int(argv[1]), int(argv[2])
SAMPLES = int(argv[3]) if len(argv) > 3 else 96

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def hexc(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)

def mat(name, color, rough=0.4, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for key in ('Coat Weight', 'Clearcoat'):
        if key in b.inputs:
            b.inputs[key].default_value = coat
            break
    return m

def rounded_box(name, w, h, d, r, bevel_seg=8):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, h, d)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new('bevel', 'BEVEL')
    bv.width = r
    bv.segments = bevel_seg
    bv.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth()
    return o

def rounded_slab(name, w, h, d, r, seg=10):
    bm = bmesh.new()
    pts = []
    for cx, cy, a0 in [(w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)]:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    vs = [bm.verts.new((x, y, -d / 2)) for x, y in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, 0, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = min(d * 0.35, 0.02); bv.segments = 3; bv.limit_method = 'ANGLE'
    for p in o.data.polygons: p.use_smooth = True
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return o

NAVY, NAVY2, GREEN, PAPER, LINE, GOLD = '#1E3A5F', '#28507F', '#059669', '#FBFBF8', '#C7D2E0', '#D8B66A'

# ---------- 카드 ----------
card = rounded_slab('Card', 3.4, 2.14, 0.06, 0.22)
# 카드 모서리를 크게 둥글게: 위에서 본 모서리(수직 엣지)만 큰 반경
cm = mat('CardNavy', NAVY, rough=0.32, coat=0.6)
card.data.materials.append(cm)
# 카드 그라데이션 느낌: 같은 계열 안에서 명도만 바꾸는 텍스처
nt = cm.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tc = nt.nodes.new('ShaderNodeTexCoord'); gr = nt.nodes.new('ShaderNodeTexGradient'); ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = hexc(NAVY2); ramp.color_ramp.elements[1].color = hexc('#162C48')
nt.links.new(tc.outputs['Generated'], gr.inputs['Vector']); nt.links.new(gr.outputs['Color'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
chip = rounded_slab('Chip', 0.46, 0.36, 0.02, 0.07)
chip.data.materials.append(mat('Gold', GOLD, rough=0.25, metal=1.0))
chip.parent = card; chip.location = (-1.05, 0.25, 0.04)
for i, (x, w) in enumerate([(-0.95, 0.5), (-0.35, 0.5), (0.25, 0.5), (0.85, 0.5)]):
    bar = rounded_box(f'Pan{i}', w, 0.07, 0.01, 0.02, 2)
    bar.data.materials.append(mat(f'PanM{i}', '#9FB4CF', rough=0.5))
    bar.parent = card; bar.location = (x, -0.45, 0.035)
card.location = (-1.55, -0.55, 0.9)
card.rotation_euler = (math.radians(62), math.radians(-6), math.radians(-24))

# ---------- 영수증 ----------
bm = bmesh.new()
rw, rh, teeth = 2.2, 3.0, 8
pts = [(-rw / 2, rh / 2), (rw / 2, rh / 2)]
step = rw / teeth
for i in range(teeth + 1):
    x = rw / 2 - i * step
    y = -rh / 2 if i % 2 == 0 else -rh / 2 + 0.16
    pts.append((x, y))
verts = [bm.verts.new((x, y, 0)) for x, y in pts]
bm.faces.new(verts)
me = bpy.data.meshes.new('ReceiptMesh'); bm.to_mesh(me); bm.free()
receipt = bpy.data.objects.new('Receipt', me); sc.collection.objects.link(receipt)
sol = receipt.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.015
receipt.data.materials.append(mat('Paper', PAPER, rough=0.85))
lm = mat('Line', LINE, rough=0.8)
for i, (y, w) in enumerate([(1.0, 1.5), (0.72, 1.0), (0.44, 1.25)]):
    l = rounded_box(f'Line{i}', w, 0.11, 0.01, 0.05, 3)
    l.data.materials.append(lm); l.parent = receipt; l.location = (-0.75 + w / 2, y, 0.02)
# 점선 구분선
for i in range(11):
    d = rounded_box(f'Dash{i}', 0.1, 0.025, 0.005, 0.01, 1)
    d.data.materials.append(lm); d.parent = receipt; d.location = (-0.9 + i * 0.18, 0.12, 0.02)
# 초록 체크 (커브 + 두께)
cu = bpy.data.curves.new('Check', 'CURVE'); cu.dimensions = '3D'
sp = cu.splines.new('POLY'); sp.points.add(2)
for p, co in zip(sp.points, [(-0.45, -0.55, 0), (-0.12, -0.88, 0), (0.5, -0.22, 0)]):
    p.co = (*co, 1)
cu.bevel_depth = 0.085; cu.bevel_resolution = 6; cu.use_fill_caps = True
check = bpy.data.objects.new('Check', cu); sc.collection.objects.link(check)
check.data.materials.append(mat('Green', GREEN, rough=0.35, coat=0.3))
check.parent = receipt; check.location = (0, 0, 0.09)
receipt.location = (0.55, 0.65, 1.55)
receipt.rotation_euler = (math.radians(78), math.radians(4), math.radians(10))

# ---------- 동전 ----------
def coin(name, color, loc, rot):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.62, depth=0.12, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = 0.03; bv.segments = 4
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat(name + 'M', color, rough=0.28, metal=0.35, coat=0.5))
    # 가운데 살짝 들어간 원
    bpy.ops.mesh.primitive_torus_add(major_radius=0.46, minor_radius=0.025, location=loc, rotation=rot)
    t = bpy.context.active_object; t.data.materials.append(o.data.materials[0])
    t.parent = o; t.matrix_parent_inverse = o.matrix_world.inverted()
    return o
coin('CoinG', GREEN, (2.35, -0.2, 0.06), (0, 0, 0))
coin('CoinN', NAVY, (2.4, -0.15, 0.19), (0, 0, 0))
coin('CoinG2', GREEN, (2.32, -0.22, 0.32), (0, 0, 0))
coin('CoinFloat', GREEN, (1.95, 0.9, 1.9), (math.radians(70), math.radians(10), math.radians(-30)))

# ---------- 바닥(그림자만 받는 투명 바닥) ----------
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
floor = bpy.context.active_object
floor.is_shadow_catcher = True

# ---------- 조명·카메라 ----------
world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = hexc('#EEF2F8'); bg.inputs[1].default_value = 0.55
def area(name, loc, power, size, color='#FFFFFF'):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.size = size; l.color = hexc(color)[:3]
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    d = Vector((0.3, 0.2, 1.0)) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
area('Key', (-4, -5, 7), 520, 6)
area('Fill', (6, -3, 4), 160, 6, '#EAF1FF')
area('Rim', (2, 6, 5), 260, 4)

cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 33
cam = bpy.data.objects.new('Cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.5, -10.5, 4.6)
target = Vector((0.4, 0.2, 1.05))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()

# ---------- 렌더 ----------
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            if any(d.type == t for d in prefs.devices):
                for d in prefs.devices: d.use = True
                sc.cycles.device = 'GPU'; break
        except Exception:
            pass
except Exception:
    pass
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
try:
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
except Exception:
    pass
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDERED', OUT, sc.cycles.device)
