#!/usr/bin/env python3
"""Draws the course's rock for the instancing chapter's asteroid field (our own work, so it can ship with the app):
a lumpy icosphere (42 vertices, 80 triangles) with one material and a grey texture. Writes rock.obj, rock.mtl and
rock.png.

    python3 make_rock.py      (needs Pillow and NumPy)
"""
import math
import numpy as np
from PIL import Image

rng = np.random.default_rng(3)

# An icosahedron, subdivided once and pushed in and out a little.
t = (1 + 5 ** 0.5) / 2
verts = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
verts = [tuple(c / math.sqrt(1 + t * t) for c in v) for v in verts]
faces = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7),
         (9, 8, 1)]
mid = {}
def midpoint(a, b):
    key = (min(a, b), max(a, b))
    if key not in mid:
        p = [(verts[a][i] + verts[b][i]) / 2 for i in range(3)]
        n = math.sqrt(sum(c * c for c in p))
        verts.append(tuple(c / n for c in p))
        mid[key] = len(verts) - 1
    return mid[key]
sub = []
for a, b, c in faces:
    ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
    sub += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
scale = 1 + 0.18 * (rng.random(len(verts)) - 0.5) * 2
pos = [tuple(c * s for c in v) for v, s in zip(verts, scale)]
# Flat-ish normals per vertex: the average of the faces around it.
normals = [np.zeros(3) for _ in pos]
for a, b, c in sub:
    n = np.cross(np.subtract(pos[b], pos[a]), np.subtract(pos[c], pos[a]))
    for i in (a, b, c): normals[i] += n
normals = [n / np.linalg.norm(n) for n in normals]
uv = [(0.5 + math.atan2(v[2], v[0]) / (2 * math.pi), 0.5 + math.asin(max(-1, min(1, v[1]))) / math.pi) for v in verts]

lines = ["# A rock for the asteroid field - drawn for Codestead GP (see make_rock.py).", "mtllib rock.mtl", "o rock"]
lines += [f"v {x:.5f} {y:.5f} {z:.5f}" for x, y, z in pos]
lines += [f"vt {u:.5f} {v:.5f}" for u, v in uv]
lines += [f"vn {n[0]:.5f} {n[1]:.5f} {n[2]:.5f}" for n in normals]
lines += ["usemtl rock", "s 1"]
lines += [f"f {a+1}/{a+1}/{a+1} {b+1}/{b+1}/{b+1} {c+1}/{c+1}/{c+1}" for a, b, c in sub]
open("rock.obj", "w").write("\n".join(lines) + "\n")
open("rock.mtl", "w").write("""# Material of rock.obj - drawn for Codestead GP.
newmtl rock
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.1 0.1 0.1
Ns 8.0
map_Kd rock.png
""")
n = rng.random((32, 32))
img = np.kron(n, np.ones((4, 4)))
g = (90 + 70 * img).astype(np.uint8)
Image.fromarray(np.stack([g + 8, g + 4, g], -1).clip(0, 255).astype(np.uint8)).save("rock.png", optimize=True)
print(len(pos), "vertices,", len(sub), "triangles")
