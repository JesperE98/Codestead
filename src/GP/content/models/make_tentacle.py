#!/usr/bin/env python3
"""Draws the course's animated model for the Skeletal Animation chapter: a tentacle with four bones and one looping
animation (our own work, so it can ship with the app). Writes tentacle.gltf (glTF 2.0), tentacle.bin (its vertex,
index, skin and animation data) and tentacle.png (the texture).

    python3 make_tentacle.py      (needs Pillow and NumPy)

The model (units: the tentacle is 2.2 tall, its foot at the origin, +y up):
- One mesh: a tapered tube of 24 rings x 16 segments (+ a seam column for the texture), a rounded tip and a closed
  foot – 495 vertices, 928 triangles. Normals and texture coordinates (glTF's convention: v = 0 is the image's top
  row; the tip is at the top of the image).
- A skeleton of four bones in a chain: Base (at y 0) -> Lower (y 0.55) -> Upper (y 1.1) -> Tip (y 1.65). Every vertex
  is weighted to at most two neighbouring bones (smooth hat functions over its height), so the tube bends smoothly.
  The skin's inverse bind matrices move a vertex from model space into each bone's space (assimp's aiBone::
  mOffsetMatrix).
- One animation, "Sway", 2 seconds long, keys at 0, 0.5, 1.0, 1.5 and 2.0 s (the last equal to the first, so it
  loops), LINEAR interpolation. Every bone has a translation, a rotation and a scale track with those five keys:
  the bones rotate about z with a delay from bone to bone (a wave runs up the tentacle), Base also turns about y and
  bobs up and down, Tip's scale swells (the bulb at the end throbs). The pose at t = 0 is not the rest pose (the
  rest pose is straight), so a program that evaluates the animation at time 0 already shows a bent tentacle.
assimp (5.x) reads glTF 2.0 animations in milliseconds: aiAnimation::mTicksPerSecond = 1000, mDuration = 2000 and
key times 0, 500, 1000, 1500, 2000.
"""
import json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

RINGS, SEGS = 24, 16          # rings along the tube (bottom to y = 1.8), segments around it
TUBE_H = 1.8                  # the tube's height; a rounded tip on top reaches y = 2.2
BONES = ["Base", "Lower", "Upper", "Tip"]
BONE_Y = [0.0, 0.55, 1.1, 1.65]
KEY_T = [0.0, 0.5, 1.0, 1.5, 2.0]

def radius(y):                # tapers from 0.24 at the foot to 0.11 under the tip
    return 0.24 - 0.13 * (y / TUBE_H)

def weights(y):               # hat functions around the middle of each bone's segment
    centres = [0.0, 0.55, 1.1, 1.65]
    w = []
    for i, c in enumerate(centres):
        if i == 0 and y <= c: w.append(1.0); continue
        if i == len(centres) - 1 and y >= c: w.append(1.0); continue
        w.append(max(0.0, 1.0 - abs(y - c) / 0.55))
    w = np.array(w)
    return w / w.sum()

pos, nrm, uv, joints, wts = [], [], [], [], []
def vertex(p, n, t, y):
    w = weights(y)
    idx = [i for i in np.argsort(-w)[:4]]
    idx = sorted(i for i in idx if w[i] > 1e-6)
    j4 = idx + [0] * (4 - len(idx)); w4 = [float(w[i]) for i in idx] + [0.0] * (4 - len(idx))
    pos.append(p); nrm.append(n); uv.append(t); joints.append(j4); wts.append(w4)
    return len(pos) - 1

# the tube: ring k at height TUBE_H * k / RINGS, SEGS + 1 vertices (the last repeats the first with u = 1)
slope = 0.13 / TUBE_H
ring_index = []
for k in range(RINGS + 1):
    y = TUBE_H * k / RINGS
    r = radius(y)
    row = []
    for s in range(SEGS + 1):
        a = 2 * math.pi * s / SEGS
        d = (math.sin(a), 0.0, math.cos(a))                     # s = 0 faces +z (the camera)
        n = np.array([d[0], slope, d[2]]); n /= np.linalg.norm(n)
        row.append(vertex((r * d[0], y, r * d[2]), tuple(n), (s / SEGS, 1.0 - 0.82 * y / TUBE_H), y))
    ring_index.append(row)
# the rounded tip: 4 more rings on a quarter circle, then the apex
r0 = radius(TUBE_H)
for k in range(1, 5):
    phi = (math.pi / 2) * k / 5
    y = TUBE_H + 0.4 * math.sin(phi)
    r = r0 * math.cos(phi)
    row = []
    for s in range(SEGS + 1):
        a = 2 * math.pi * s / SEGS
        n = np.array([math.sin(a) * math.cos(phi), math.sin(phi) * 1.5, math.cos(a) * math.cos(phi)]); n /= np.linalg.norm(n)
        row.append(vertex((r * math.sin(a), y, r * math.cos(a)), tuple(n), (s / SEGS, 0.18 - 0.16 * k / 5), y))
    ring_index.append(row)
apex = vertex((0.0, TUBE_H + 0.4, 0.0), (0.0, 1.0, 0.0), (0.5, 0.0), TUBE_H + 0.4)
foot = vertex((0.0, 0.0, 0.0), (0.0, -1.0, 0.0), (0.5, 1.0), 0.0)

tris = []
for k in range(len(ring_index) - 1):
    a, b = ring_index[k], ring_index[k + 1]
    for s in range(SEGS):          # counter-clockwise seen from outside
        tris += [(a[s], a[s + 1], b[s + 1]), (a[s], b[s + 1], b[s])]
top = ring_index[-1]
for s in range(SEGS):
    tris.append((top[s], top[s + 1], apex))
bottom = ring_index[0]
for s in range(SEGS):
    tris.append((bottom[s + 1], bottom[s], foot))

# ---- animation: a value per bone per key ----
def quat_axis_angle(axis, deg):
    ax = np.array(axis, float); ax /= np.linalg.norm(ax)
    h = math.radians(deg) / 2
    return np.array([*(ax * math.sin(h)), math.cos(h)])      # glTF order: x, y, z, w

def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])

AMP = [14.0, 22.0, 26.0, 30.0]      # degrees about z per bone
rot_keys, pos_keys, scl_keys = [], [], []
for b in range(4):
    rk, pk, sk = [], [], []
    for t in KEY_T:
        ph = math.pi * t + math.pi / 2 - 0.9 * b           # a wave going up the tentacle; t = 0 is bent
        q = quat_axis_angle((0, 0, 1), AMP[b] * math.sin(ph))
        if b == 0:
            q = qmul(quat_axis_angle((0, 1, 0), 25.0 * math.sin(math.pi * t)), q)
        rk.append(q)
        p = [0.0, BONE_Y[b] - (BONE_Y[b - 1] if b else 0.0), 0.0]
        if b == 0:
            p[1] = 0.12 * (1 - math.cos(2 * math.pi * t)) / 2       # Base bobs up at 0.5 s and 1.5 s
        pk.append(p)
        s = 1.0 + (0.35 * math.sin(math.pi * t) ** 2 if b == 3 else 0.0)
        sk.append([s, s, s])
    rot_keys.append(rk); pos_keys.append(pk); scl_keys.append(sk)
# the last key repeats the first exactly, so the loop has no jump
for b in range(4):
    rot_keys[b][-1] = rot_keys[b][0]; pos_keys[b][-1] = list(pos_keys[b][0]); scl_keys[b][-1] = list(scl_keys[b][0])

# ---- binary buffer ----
blob = bytearray()
views, accessors = [], []
def add(data, comp, typ, count, target=None, minmax=False):
    while len(blob) % 4: blob.append(0)
    off = len(blob)
    blob.extend(data)
    v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
    if target: v["target"] = target
    views.append(v)
    a = {"bufferView": len(views) - 1, "componentType": comp, "count": count, "type": typ}
    accessors.append(a)
    return a, len(accessors) - 1

F, U16, U32 = 5126, 5123, 5125
P = np.array(pos, np.float32)
a, i_pos = add(P.tobytes(), F, "VEC3", len(P), 34962)
a["min"] = [float(v) for v in P.min(0)]; a["max"] = [float(v) for v in P.max(0)]
_, i_nrm = add(np.array(nrm, np.float32).tobytes(), F, "VEC3", len(P), 34962)
_, i_uv = add(np.array(uv, np.float32).tobytes(), F, "VEC2", len(P), 34962)
_, i_jnt = add(np.array(joints, np.uint16).tobytes(), U16, "VEC4", len(P), 34962)
_, i_wgt = add(np.array(wts, np.float32).tobytes(), F, "VEC4", len(P), 34962)
_, i_idx = add(np.array(tris, np.uint32).ravel().tobytes(), U32, "SCALAR", len(tris) * 3, 34963)
ibm = []
for y in BONE_Y:              # column-major 4x4: translate(0, -y, 0)
    ibm += [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -y, 0, 1]
_, i_ibm = add(np.array(ibm, np.float32).tobytes(), F, "MAT4", 4)
a, i_time = add(np.array(KEY_T, np.float32).tobytes(), F, "SCALAR", len(KEY_T))
a["min"] = [KEY_T[0]]; a["max"] = [KEY_T[-1]]

samplers, channels = [], []
for b in range(4):
    node = 2 + b
    for path, keys, typ in (("translation", pos_keys[b], "VEC3"), ("rotation", rot_keys[b], "VEC4"), ("scale", scl_keys[b], "VEC3")):
        _, acc = add(np.array(keys, np.float32).tobytes(), F, typ, len(keys))
        samplers.append({"input": i_time, "output": acc, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path}})

nodes = [
    {"name": "Tentacle", "children": [1, 2]},
    {"name": "TentacleMesh", "mesh": 0, "skin": 0},
]
for b in range(4):
    n = {"name": BONES[b], "translation": [0.0, BONE_Y[b] - (BONE_Y[b - 1] if b else 0.0), 0.0]}
    if b < 3: n["children"] = [3 + b]
    nodes.append(n)

gltf = {
    "asset": {"version": "2.0", "generator": "Codestead GP make_tentacle.py"},
    "scene": 0,
    "scenes": [{"name": "Scene", "nodes": [0]}],
    "nodes": nodes,
    "meshes": [{"name": "Tentacle", "primitives": [{
        "attributes": {"POSITION": i_pos, "NORMAL": i_nrm, "TEXCOORD_0": i_uv, "JOINTS_0": i_jnt, "WEIGHTS_0": i_wgt},
        "indices": i_idx, "material": 0, "mode": 4}]}],
    "skins": [{"name": "Skeleton", "joints": [2, 3, 4, 5], "skeleton": 2, "inverseBindMatrices": i_ibm}],
    "materials": [{"name": "TentacleSkin", "pbrMetallicRoughness": {
        "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.8}}],
    "textures": [{"source": 0, "sampler": 0}],
    "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
    "images": [{"uri": "tentacle.png"}],
    "animations": [{"name": "Sway", "samplers": samplers, "channels": channels}],
    "buffers": [{"uri": "tentacle.bin", "byteLength": len(blob)}],
    "bufferViews": views,
    "accessors": accessors,
}
with open(os.path.join(HERE, "tentacle.bin"), "wb") as f:
    f.write(blob)
with open(os.path.join(HERE, "tentacle.gltf"), "w", newline="\n") as f:
    json.dump(gltf, f, indent=1)
    f.write("\n")

# ---- texture: 256 x 256, the tip at the top (v = 0), the foot at the bottom ----
W = H = 256
yy, xx = np.mgrid[0:H, 0:W].astype(float)
t = 1.0 - yy / (H - 1)                    # 0 at the foot (bottom row), 1 at the tip (top row)
deep = np.array([70, 30, 110.0]); warm = np.array([235, 120, 70.0]); tipc = np.array([255, 214, 120.0])
base = deep[None, None] * (1 - t[..., None]) + warm[None, None] * t[..., None]
tip = np.clip((t - 0.82) / 0.18, 0, 1)[..., None]
base = base * (1 - tip) + tipc[None, None] * tip
u = xx / W
stripe = 0.82 + 0.18 * (np.floor(u * 8) % 2)  # eight stripes around the tube
ring = 1.0 - 0.35 * (np.abs(((t * 0.82 / 0.82) * 12) % 1.0 - 0.5) < 0.06)   # dark rings, 12 along the tube
img = base * stripe[..., None] * ring[..., None]
# a row of pale suckers on the side that faces the camera at rest (u near 0 and 1 wrap around +z)
for k in range(10):
    cy = (0.06 + 0.075 * k) * (H - 1)
    cy = (H - 1) - cy
    for cx in (0.0, W):
        d = np.hypot(xx - cx, yy - cy)
        rr = 9 - 0.4 * k
        m = d < rr
        img[m] = img[m] * 0.25 + np.array([250, 225, 210.0]) * 0.75
        rim = (d >= rr) & (d < rr + 2)
        img[rim] = img[rim] * 0.6
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").save(os.path.join(HERE, "tentacle.png"), optimize=True)
print(f"tentacle.gltf: {len(pos)} vertices, {len(tris)} triangles, {len(BONES)} bones, {len(KEY_T)} keys")
