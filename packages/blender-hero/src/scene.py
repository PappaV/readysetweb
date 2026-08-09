"""
SiteCraft from-scratch 3D hero renderer — AESTHETICS NICHÉ.
Builds photoreal 3D models entirely procedurally (no scraped images):
  - serum bottle with true glass (IOR 1.45, transmission), tinted liquid, gold cap
  - suspended droplets + a liquid crown
  - studio podium + caustic light + bokeh particles
  - a slow cinematic camera orbit rendered as N keyframes
The frames are later cut into a Hollywood-style 15s trailer by ffmpeg.

Usage:
  blender --background --factory-startup --python scene.py -- <brandAccentHex> <brandPrimaryHex> <outDir> <seed> <stills>
"""

import bpy
import json
import math
import os
import random
import sys


def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4))


# ---- args ----
positional = [a for a in sys.argv[sys.argv.index("--") + 1:]] if "--" in sys.argv else []
accent_hex = positional[0] if len(positional) > 0 else "#d9a441"
primary_hex = positional[1] if len(positional) > 1 else "#1a2b3c"
out_dir = positional[2] if len(positional) > 2 else "."
seed = int(positional[3]) if len(positional) > 3 else 7
stills = int(positional[4]) if len(positional) > 4 else 8

accent = hex_to_rgb(accent_hex)
primary = hex_to_rgb(primary_hex)
random.seed(seed)
os.makedirs(out_dir, exist_ok=True)


def make_pbr(name, base, metallic=0.0, rough=0.3, ior=1.45, trans=0.0, emiss=0.0, emiss_col=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Transmission Weight"].default_value = trans
    if emiss > 0:
        bsdf.inputs["Emission Color"].default_value = (*(emiss_col or base), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emiss
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def assign(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def obj_add(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---- scene ----
clear_scene()
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = "PNG"
scene.eevee.taa_render_samples = 10
scene.eevee.use_shadows = True

# World: soft dark studio with a brand-tinted ambient.
world = bpy.data.worlds.new("studio")
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (*primary, 1.0)
    bg.inputs["Strength"].default_value = 0.25
scene.world = world

GROUP = bpy.data.collections.new("hero")
scene.collection.children.link(GROUP)

# ---- glass serum bottle ----
glass = make_pbr("glass", (0.92, 0.96, 1.0), rough=0.02, ior=1.45, trans=1.0)
gold = make_pbr("gold", (0.9, 0.66, 0.2), metallic=1.0, rough=0.14)
liquid_c = make_pbr("liquid", accent, rough=0.04, ior=1.33, trans=0.9, emiss=0.05)
metal_band = make_pbr("band", (0.75, 0.78, 0.82), metallic=1.0, rough=0.3)

# Bottle body
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=0.5, depth=1.5, location=(0, 0, 0.85))
bottle = bpy.context.active_object
bottle.data.materials.append(glass)

# Liquid inside the bottle (slightly smaller, floats at 40% fill)
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=0.44, depth=0.7, location=(0, 0, 0.55))
liquid = bpy.context.active_object
liquid.data.materials.append(liquid_c)

# Liquid top meniscus (squashed sphere)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.44, location=(0, 0, 0.91))
meniscus = bpy.context.active_object
meniscus.scale = (1.0, 1.0, 0.28)
meniscus.data.materials.append(liquid_c)

# Neck
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=0.24, depth=0.4, location=(0, 0, 1.75))
neck = bpy.context.active_object
neck.data.materials.append(glass)

# Gold cap
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=0.3, depth=0.3, location=(0, 0, 2.0))
cap = bpy.context.active_object
cap.data.materials.append(gold)

# Metal band at neck
bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.035, location=(0, 0, 1.55))
band = bpy.context.active_object
band.rotation_euler = (math.pi / 2, 0, 0)
band.data.materials.append(metal_band)

# ---- suspended droplets ----
for i in range(18):
    ang = i / 18 * math.tau + random.uniform(0, 0.3)
    r = random.uniform(1.1, 2.0)
    y = random.uniform(1.1, 2.6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.03, 0.07), location=(math.cos(ang) * r, math.sin(ang) * r, y))
    d = bpy.context.active_object
    d.data.materials.append(glass if i % 2 else liquid_c)

# ---- podium (dark marble disc) ----
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=2.6, depth=0.25, location=(0, 0, -0.13))
podium = bpy.context.active_object
podium.data.materials.append(make_pbr("podium", (0.05, 0.05, 0.07), metallic=0.35, rough=0.35))

# ---- studio floor ----
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.27))
floor = bpy.context.active_object
floor.data.materials.append(make_pbr("floor", (0.03, 0.03, 0.04), metallic=0.3, rough=0.5))

# ---- bokeh particle field ----
for i in range(120):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.004, 0.02),
                                         location=(random.uniform(-5, 5), random.uniform(-5, 5), random.uniform(0.5, 5)))
    p = bpy.context.active_object
    p.data.materials.append(make_pbr("bokeh", accent, emiss=2.5))

# ---- lighting: bright studio key + rim ----
key = bpy.ops.object.light_add(type="AREA", location=(4, -4, 5))
key_obj = bpy.context.active_object
key_obj.data.energy = 1200
key_obj.data.size = 4
key_obj.rotation_euler = (math.radians(-30), 0, math.radians(45))

rim = bpy.ops.object.light_add(type="AREA", location=(-5, 3, 4))
rim_obj = bpy.context.active_object
rim_obj.data.energy = 500
rim_obj.data.size = 3
rim_obj.data.color = accent

fill = bpy.ops.object.light_add(type="AREA", location=(0, 5, 3))
fill_obj = bpy.context.active_object
fill_obj.data.energy = 350
fill_obj.data.size = 5

# ---- camera: cinematic orbit ----
def camera_points(n=stills):
    pts = []
    for i in range(n):
        ang = i / n * math.tau + 0.6
        r = 5.4
        z = 1.5 + math.sin(ang * 1.7) * 0.8
        pts.append((math.cos(ang) * r, math.sin(ang) * r, z))
    return pts

pts = camera_points()
bpy.ops.object.camera_add(align="WORLD", location=pts[0], rotation=(1.25, 0, 0.5))
cam = bpy.context.active_object
cam.data.lens = 40
scene.camera = cam

# Track the bottle center
track = cam.constraints.new(type="TRACK_TO")
track.target = obj_add(bpy.data.objects.new("aim", None))
track.target.location = (0, 0, 1.0)
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

# Render stills along the orbit.
for idx in range(stills):
    px, py, pz = pts[idx]
    cam.location = (px, py, pz)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(out_dir, f"hero-{idx:03d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"STILL {idx + 1}/{stills} done")

print("BLENDER_HERO_OK")
