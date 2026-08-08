"""
SiteCraft personalized 3D hero renderer.

Reads a business.json payload and procedurally builds a UNIQUE 3D scene for that
specific business, then renders a set of cinematic stills from a spline camera
path. The frames are later animated into a 15s hero MP4 by ffmpeg.

Every scene is personalized:
  - Category motif (medspa / guesthouse-lodge / boutique-hospitality / real-estate)
  - The business's own brand colors drive materials, lighting and environment
  - The business name appears as extruded 3D text
  - A deterministic seed varies composition, camera, and arrangement so no two
    businesses ever produce the same frames.

Usage:
  blender --background --factory-startup --python scene.py -- <business.json> <outDir> <seed>
"""

import bpy
import json
import math
import os
import random
import sys
from mathutils import Vector, Euler

# ---------------------------------------------------------------- helpers

def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4))


# ---------------------------------------------------------------- parse args

argv = sys.argv
args = [a for a in argv if a and not a.startswith("--")]
# blender args end at the first "--", everything after is ours; we just take the
# last positional tokens in order (business.json, outDir, seed)
positional = [a for a in argv[argv.index("--") + 1:]] if "--" in argv else []
if len(positional) < 3:
    print("USAGE: blender --background --python scene.py -- <business.json> <outDir> <seed>")
    sys.exit(1)

biz_path, out_dir, seed_arg = positional[0], positional[1], positional[2]
seed = int(seed_arg)
random.seed(seed)

with open(biz_path, "r", encoding="utf-8") as f:
    biz = json.load(f)

name = biz.get("name", "Business")[:34]
tagline = (biz.get("tagline") or "")[:60]
category = biz.get("category", "guesthouse-lodge")
colors = biz.get("brandColors") or {}
primary = hex_to_rgb(colors.get("primary", "#8B5A2B"))
secondary = hex_to_rgb(colors.get("secondary", "#D2B48C"))
accent = hex_to_rgb(colors.get("accent", "#F5DEB3"))
city = (biz.get("location") or {}).get("city", "")

os.makedirs(out_dir, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def make_material(hex_or_rgb, name="m", metallic=0.0, roughness=0.35, emission=0.0):
    if isinstance(hex_or_rgb, str):
        rgb = hex_to_rgb(hex_or_rgb)
    else:
        rgb = hex_or_rgb
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def assign(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def add_camera_at(loc, rot, name="cam"):
    bpy.ops.object.camera_add(align="WORLD", location=loc, rotation=rot)
    cam = bpy.context.active_object
    cam.name = name
    cam.data.lens = 35
    cam.data.sensor_width = 36
    return cam


def add_light(loc, color=(1, 1, 1), power=1000.0, type="AREA", size=4.0):
    bpy.ops.object.light_add(type=type, location=loc)
    light = bpy.context.active_object
    light.data.energy = power
    light.data.color = color
    if type == "AREA":
        light.data.size = size
    return light


def add_bezier(pts, loc=(0, 0, 0)):
    bpy.ops.curve.primitive_bezier_curve_add(location=loc)
    curve = bpy.context.active_object
    spline = curve.data.splines[0]
    spline.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = spline.bezier_points[i]
        bp.co = Vector(p)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    return curve


def extrude_text(text, size=1.0, depth=0.12, font_path=None, align_x="CENTER"):
    bpy.ops.object.text_add(location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.data.body = text
    obj.data.size = size
    obj.data.extrude = depth
    obj.data.align_x = align_x
    obj.data.bevel_depth = depth * 0.06
    obj.data.bevel_resolution = 4
    if font_path and os.path.exists(font_path):
        try:
            font = bpy.data.fonts.load(font_path)
            obj.data.font = font
        except Exception:
            pass
    return obj


def wrap_shape(group, x=0, y=0, z=0, ry=0, rz=0, scale=1.0):
    group.location = Vector((x, y, z))
    group.rotation_euler = Euler((0, math.radians(ry), math.radians(rz)))
    group.scale = Vector((scale, scale, scale))
    return group


# ---------------------------------------------------------------- scene setup

clear_scene()
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.eevee.taa_render_samples = 16
scene.eevee.taa_samples = 16

# World / environment color wash from the brand palette
world = bpy.data.worlds.new("brand_world")
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    mix = random.uniform(0.06, 0.2)
    bg.inputs["Color"].default_value = (
        primary[0] * mix + 0.02,
        primary[1] * mix + 0.02,
        primary[2] * mix + 0.06,
        1.0,
    )
    bg.inputs["Strength"].default_value = 0.6
scene.world = world

GROUP = bpy.data.collections.new("scene_group")
scene.collection.children.link(GROUP)

# ---------------------------------------------------------------- category motif

def build_motif():
    if category == "medspa":
        return motif_medspa()
    if category == "boutique-hospitality":
        return motif_boutique()
    if category == "real-estate-agent" or category == "real-estate-developer":
        return motif_realestate()
    return motif_lodge()


def motif_medspa():
    """Glass serum bottle + droplet field + soft rings."""
    g = bpy.data.objects.new("medspa", None)
    GROUP.objects.link(g)
    # bottle body
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.55, depth=1.7, location=(0, 0, 1.2))
    bottle = bpy.context.active_object
    mat = make_material(primary, "glass", metallic=0.1, roughness=0.05, emission=0.05)
    assign(bottle, mat)
    bottle.parent = g
    # neck + cap
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.24, depth=0.5, location=(0, 0, 2.25))
    neck = bpy.context.active_object
    assign(neck, make_material(accent, "gold", metallic=0.9, roughness=0.15))
    neck.parent = g
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.32, depth=0.2, location=(0, 0, 2.6))
    cap = bpy.context.active_object
    assign(cap, make_material(secondary, "cap", metallic=0.3, roughness=0.3))
    cap.parent = g
    # orbiting droplets
    for i in range(14):
        ang = random.uniform(0, math.tau)
        r = random.uniform(2.2, 3.6)
        y = random.uniform(-0.6, 3.0)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.06, 0.14),
                                             location=(math.cos(ang) * r, math.sin(ang) * r, y))
        d = bpy.context.active_object
        assign(d, make_material((accent if i % 2 else secondary), f"drop{i}",
                                metallic=0.2, roughness=0.1, emission=0.2))
        d.parent = g
    return g


def motif_lodge():
    """Mountain ridge + pine trees + warm cabin light + floating embers."""
    g = bpy.data.objects.new("lodge", None)
    GROUP.objects.link(g)
    # mountains
    for i in range(5):
        x = -8 + i * 4 + random.uniform(-1, 1)
        h = random.uniform(2.5, 4.5)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=random.uniform(1.6, 2.4),
                                        depth=h, location=(x, -3.5, h / 2 - 1))
        m = bpy.context.active_object
        assign(m, make_material((secondary if i % 2 else primary), f"mtn{i}",
                                metallic=0.0, roughness=0.9))
        m.parent = g
    # cabin box with warm window
    bpy.ops.mesh.primitive_cube_add(size=1.6, location=(0, 0.4, 0.7))
    cab = bpy.context.active_object
    assign(cab, make_material((0.12, 0.1, 0.09), "cabin", roughness=0.7))
    cab.parent = g
    # window glow
    bpy.ops.mesh.primitive_cube_add(size=0.55, location=(0, 0.4, 1.0))
    win = bpy.context.active_object
    assign(win, make_material(accent, "window", emission=2.2))
    win.parent = g
    # trees
    for i in range(10):
        x = random.uniform(-8, 8)
        z = random.uniform(-1.5, 1.5)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=random.uniform(0.3, 0.6),
                                        depth=random.uniform(1.0, 2.0),
                                        location=(x, z, random.uniform(0.7, 1.4)))
        t = bpy.context.active_object
        assign(t, make_material((0.1, 0.25, 0.14), f"tree{i}", roughness=0.9))
        t.parent = g
    # floating embers
    for i in range(18):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.03, 0.08),
                                             location=(random.uniform(-3, 3),
                                                       random.uniform(-3, 3),
                                                       random.uniform(0.5, 3)))
        e = bpy.context.active_object
        assign(e, make_material(accent, f"ember{i}", emission=3.0))
        e.parent = g
    return g


def motif_boutique():
    """Elegant columns + chandelier + warm parquet glow."""
    g = bpy.data.objects.new("boutique", None)
    GROUP.objects.link(g)
    # floor
    bpy.ops.mesh.primitive_plane_add(size=22, location=(0, 0, -0.1))
    floor = bpy.context.active_object
    assign(floor, make_material((0.06, 0.05, 0.05), "floor", metallic=0.3, roughness=0.4))
    floor.parent = g
    # columns
    for x in (-5, 5):
        for z in (-3, 3):
            bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.55, depth=6,
                                                location=(x, z, 2.9))
            col = bpy.context.active_object
            assign(col, make_material(primary, f"col{x}{z}", metallic=0.4, roughness=0.25))
            col.parent = g
    # chandelier (stacked rings)
    for i in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.2 - i * 0.3, minor_radius=0.08,
                                         location=(0, 0, 4.4 + i * 0.5))
        ring = bpy.context.active_object
        assign(ring, make_material(accent, f"ring{i}", metallic=1.0, roughness=0.2, emission=0.6))
        ring.parent = g
    # warm glow discs
    for i in range(12):
        ang = i / 12 * math.tau
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12,
                                             location=(math.cos(ang) * 1.2,
                                                       math.sin(ang) * 1.2,
                                                       random.uniform(2.8, 5.2)))
        bulb = bpy.context.active_object
        assign(bulb, make_material(accent, f"bulb{i}", emission=4.0))
        bulb.parent = g
    return g


def motif_realestate():
    """Modern house blocks + skyline towers + golden-hour sun."""
    g = bpy.data.objects.new("estate", None)
    GROUP.objects.link(g)
    for i in range(8):
        x = random.uniform(-7, 7)
        z = random.uniform(-4, 4)
        w, d, h = (random.uniform(0.8, 1.8), random.uniform(0.8, 1.8), random.uniform(1.4, 3.2))
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, z, h / 2))
        blk = bpy.context.active_object
        blk.scale = (w, d, h)
        assign(blk, make_material((secondary if i % 2 else primary), f"blk{i}",
                                  metallic=0.5, roughness=0.2))
        blk.parent = g
        # accent window strip
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, z, h * 0.7))
        win = bpy.context.active_object
        win.scale = (w * 0.7, d * 0.05, h * 0.2)
        assign(win, make_material(accent, f"win{i}", emission=2.5))
        win.parent = g
    return g


motif = build_motif()

# ---------------------------------------------------------------- brand 3D text

font_candidates = {
    "serif": ["C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/BOD_B.TTF", "C:/Windows/Fonts/CASTELAR.TTF"],
    "sans": ["C:/Windows/Fonts/bahnschrift.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/impact.ttf"],
}
use_serif = category in ("boutique-hospitality",) or seed % 2 == 0
font_pool = font_candidates["serif"] if use_serif else font_candidates["sans"]
font_path = font_pool[seed % len(font_pool)]

# Business name, big extruded 3D, brand-colored, floating above the motif
name_obj = extrude_text(name, size=random.uniform(1.3, 1.8), depth=0.16,
                        font_path=font_path, align_x="CENTER")
assign(name_obj, make_material(accent, "brand_name", metallic=0.6, roughness=0.25, emission=0.15))
name_obj.parent = motif
name_obj.location = (0, 0, random.uniform(3.2, 4.4))

# Tagline as smaller 3D text below the name
if tagline:
    tag_obj = extrude_text(tagline.upper(), size=0.5, depth=0.04,
                           font_path="C:/Windows/Fonts/segoeui.ttf", align_x="CENTER")
    assign(tag_obj, make_material((0.95, 0.95, 0.95), "tagline", metallic=0.1, roughness=0.4))
    tag_obj.parent = motif
    tag_obj.location = (0, 0, name_obj.location.z - 1.1)

# ---------------------------------------------------------------- lighting

light1 = add_light((6, -6, 8), color=(1, 0.95, 0.85), power=1200, type="AREA", size=6)
light1.parent = motif
light2 = add_light((-6, 4, 4), color=primary, power=600, type="AREA", size=5)
light2.parent = motif
if category in ("real-estate-agent", "real-estate-developer"):
    sun = add_light((10, -10, 14), color=(1, 0.7, 0.35), power=1800, type="SUN")
    sun.parent = motif

# ---------------------------------------------------------------- spline camera path

# Deterministic orbital camera: each still samples a smooth circular path around
# the scene at a varying height, giving a true cinematic fly-around.
def camera_points(n=12):
    pts = []
    for i in range(n):
        ang = i / n * math.tau + random.uniform(0, 0.4)
        r = random.uniform(7.5, 10.5)
        y = random.uniform(-2.5, 3.5)
        pts.append((math.cos(ang) * r, math.sin(ang) * r, y))
    return pts


cam_pts = camera_points()
cam_curve = add_bezier(cam_pts)
cam_curve.parent = motif
cam = add_camera_at(cam_pts[0], (1.35, 0, 0.6), name="hero_cam")
cam.parent = motif
scene.camera = cam

# Aim the camera at the motif center every frame via Track To
track = cam.constraints.new(type="TRACK_TO")
track.target = motif
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

def sample_bezier(p0, p1, p2, p3, t):
    mt = 1 - t
    return (
        mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
        mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
        mt**3 * p0[2] + 3 * mt**2 * t * p1[2] + 3 * mt * t**2 * p2[2] + t**3 * p3[2],
    )

# ---------------------------------------------------------------- render stills

STILLS = 6
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = "PNG"

# Convert the camera control points into per-still positions by sampling along
# a Catmull-Rom-style loop through the points (handled via linear interp here for
# determinism), then render each still. The Track To constraint keeps the shot
# aimed at the brand center throughout.
for idx in range(STILLS):
    # loop through the control points
    pts = cam_pts
    n = len(pts)
    f = idx / STILLS * n
    i = int(f) % n
    j = (i + 1) % n
    t = f - int(f)
    px = pts[i][0] + (pts[j][0] - pts[i][0]) * t
    py = pts[i][1] + (pts[j][1] - pts[i][1]) * t
    pz = pts[i][2] + (pts[j][2] - pts[i][2]) * t
    cam.location = (px, py, pz)
    # force scene update so Track To aims correctly
    scene.frame_set(1)
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(out_dir, f"hero-{idx:03d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"STILL {idx + 1}/{STILLS} done")

print("BLENDER_HERO_OK")
