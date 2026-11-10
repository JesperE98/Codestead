#!/usr/bin/env python3
"""Draws the course's model for the Model Loading chapters: a small planet with a ring (our own work, so it can ship
with the app). Writes planet.obj, planet.mtl and the textures planet_diffuse.png, planet_specular.png, rings.png,
rings_specular.png.

    python3 make_planet.py      (needs Pillow and NumPy)
"""
import math
import numpy as np
from PIL import Image

rng = np.random.default_rng(42)

def value_noise(w, h, cells, octaves=4):
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        grid = rng.random((c + 1, c * 2 + 1))
        ys = np.linspace(0, c, h, endpoint=False)
        xs = np.linspace(0, c * 2, w, endpoint=False)
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        g = grid
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; cc = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy)
        total += amp
        amp *= 0.5
    return out / total

# Textures: an equirectangular map, v = 0 at the top (north pole).
W, H = 512, 256
n = value_noise(W, H, 3)
lat = np.abs(np.linspace(-1, 1, H))[:, None] * np.ones((1, W))
land = n > 0.52
ice = lat > 0.86
diffuse = np.zeros((H, W, 3), np.uint8)
diffuse[:] = (28, 70, 150)                                   # ocean
shade = (n - 0.52) / 0.48
diffuse[land] = np.stack([60 + 90 * shade, 120 + 40 * shade, 50 + 20 * shade], -1)[land].astype(np.uint8)
diffuse[ice] = (235, 240, 245)
Image.fromarray(diffuse).save("planet_diffuse.png", optimize=True)
specular = np.where((~land) & (~ice), 200, 20).astype(np.uint8)
Image.fromarray(np.stack([specular] * 3, -1)).save("planet_specular.png", optimize=True)
rings = np.zeros((16, 256, 3), np.uint8)
for x in range(256):
    t = x / 255
    band = 0.6 + 0.4 * math.sin(t * 40) * math.sin(t * 7 + 1)
    rings[:, x] = (int(210 * band), int(180 * band), int(140 * band))
Image.fromarray(rings).save("rings.png", optimize=True)
Image.fromarray(np.full((16, 256, 3), 30, np.uint8)).save("rings_specular.png", optimize=True)   # dull dust

# The model: a UV sphere (radius 1) and a flat ring (radius 1.4–2.0), each with its own material.
lines = ["# A small planet with a ring - drawn for Codestead GP (see make_planet.py).", "mtllib planet.mtl", "o planet"]
SEG, RINGS = 32, 16
verts, uvs, norms, faces = [], [], [], []
for r in range(RINGS + 1):
    phi = math.pi * r / RINGS                      # 0 at the north pole
    for s in range(SEG + 1):
        theta = 2 * math.pi * s / SEG
        x, y, z = math.sin(phi) * math.cos(theta), math.cos(phi), -math.sin(phi) * math.sin(theta)
        verts.append((x, y, z)); norms.append((x, y, z)); uvs.append((s / SEG, 1 - r / RINGS))
def idx(r, s): return r * (SEG + 1) + s + 1
for r in range(RINGS):
    for s in range(SEG):
        a, b, c, d = idx(r, s), idx(r + 1, s), idx(r + 1, s + 1), idx(r, s + 1)
        if r != 0: faces.append((a, b, d))
        if r != RINGS - 1: faces.append((b, c, d))
lines += [f"v {x:.5f} {y:.5f} {z:.5f}" for x, y, z in verts]
lines += [f"vt {u:.5f} {v:.5f}" for u, v in uvs]
lines += [f"vn {x:.5f} {y:.5f} {z:.5f}" for x, y, z in norms]
lines += ["usemtl planet", "s 1"]
lines += [f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}" for a, b, c in faces]
base = len(verts)
lines.append("o rings")
rv, ruv = [], []
RSEG = 48
for s in range(RSEG + 1):
    theta = 2 * math.pi * s / RSEG
    for k, rad in enumerate((1.4, 2.0)):
        rv.append((rad * math.cos(theta), 0.0, -rad * math.sin(theta))); ruv.append((k, s / RSEG))
lines += [f"v {x:.5f} {y:.5f} {z:.5f}" for x, y, z in rv]
lines += [f"vt {u:.5f} {v:.5f}" for u, v in ruv]
lines += ["vn 0.00000 1.00000 0.00000", "usemtl rings", "s off"]
nring = len(norms) + 1
for s in range(RSEG):
    a, b = base + 2 * s + 1, base + 2 * s + 2
    c, d = a + 2, b + 2
    for (p, q, w) in ((a, b, d), (a, d, c)):
        lines.append(f"f {p}/{p - base + len(uvs)}/{nring} {q}/{q - base + len(uvs)}/{nring} {w}/{w - base + len(uvs)}/{nring}")
open("planet.obj", "w").write("\n".join(lines) + "\n")
open("planet.mtl", "w").write("""# Materials of planet.obj - drawn for Codestead GP.
newmtl planet
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.5 0.5 0.5
Ns 32.0
map_Kd planet_diffuse.png
map_Ks planet_specular.png

newmtl rings
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.1 0.1 0.1
Ns 8.0
map_Kd rings.png
map_Ks rings_specular.png
""")
print(len(verts), "sphere vertices,", len(faces), "sphere triangles,", 2 * RSEG, "ring triangles")
