#!/usr/bin/env python3
"""Draws the course's images for the Advanced OpenGL chapters (our own work, so they can ship with the app):
marble.png, metal.png, grass.png, window.png and the skybox faces skybox/right.png … back.png.

    python3 make_advanced.py      (needs Pillow and NumPy)
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw

rng = np.random.default_rng(7)


def value_noise(w, h, cells, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        grid = r.random((c + 1, c + 1))
        ys = np.linspace(0, c, h, endpoint=False)
        xs = np.linspace(0, c, w, endpoint=False)
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        a = grid[y0][:, x0]; b = grid[y0][:, x0 + 1]; cc = grid[y0 + 1][:, x0]; d = grid[y0 + 1][:, x0 + 1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy)
        total += amp
        amp *= 0.5
    return out / total


# marble.png: light marble with dark grey veins (the cubes of the depth/stencil/blending chapters).
N = 256
n = value_noise(N, N, 4, seed=1)
y, x = np.mgrid[0:N, 0:N] / N
veins = np.abs(np.sin((x * 3 + y * 2) * math.pi * 2 + n * 9))
v = np.clip(veins ** 0.25, 0, 1)
base = np.stack([228 - 20 * n, 224 - 20 * n, 214 - 22 * n], -1)
dark = np.array([70, 72, 78])
marble = base * v[..., None] + dark * (1 - v[..., None])
Image.fromarray(marble.astype(np.uint8)).save("marble.png", optimize=True)

# metal.png: a grey steel floor plate with a raised diamond pattern and four bolts.
n2 = value_noise(N, N, 8, 3, seed=2)
metal = np.stack([118 + 30 * n2, 122 + 30 * n2, 128 + 30 * n2], -1)
g = ((x * 16 + y * 16) % 1 < 0.12) & ((x * 16 - y * 16) % 1 < 0.6)
g2 = ((x * 16 - y * 16) % 1 < 0.12) & ((x * 16 + y * 16) % 1 > 0.4)
metal[g | g2] += 45
edge = (x < 0.02) | (x > 0.98) | (y < 0.02) | (y > 0.98)
metal[edge] -= 50
img = Image.fromarray(np.clip(metal, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
for cx, cy in ((16, 16), (240, 16), (16, 240), (240, 240)):
    d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(170, 172, 176), outline=(60, 62, 66))
img.save("metal.png", optimize=True)

# grass.png: tufts of grass on a fully transparent background (alpha is 0 or 255 – the discard example).
G = 128
grass = Image.new("RGBA", (G, G), (0, 0, 0, 0))
d = ImageDraw.Draw(grass)
for i in range(26):
    bx = 8 + i * 4.5 + rng.uniform(-2, 2)
    h = rng.uniform(55, 120)
    lean = rng.uniform(-25, 25)
    shade = int(rng.uniform(0, 60))
    d.polygon([(bx - 3, G), (bx + 3, G), (bx + lean, G - h)], fill=(40 + shade // 2, 120 + shade, 30, 255))
grass.save("grass.png", optimize=True)

# window.png: red tinted glass (alpha 0.55) in an opaque dark red frame, with a bright streak.
W = 128
win = np.zeros((W, W, 4), np.uint8)
win[:] = (220, 40, 40, 140)
yy, xx = np.mgrid[0:W, 0:W]
streak = np.abs((xx - yy) - 30) < 6
win[streak] = (255, 150, 150, 170)
frame = (xx < 8) | (xx >= W - 8) | (yy < 8) | (yy >= W - 8) | (np.abs(xx - W // 2) < 3) | (np.abs(yy - W // 2) < 3)
win[frame] = (110, 20, 20, 255)
Image.fromarray(win, "RGBA").save("window.png", optimize=True)

# The skybox: six faces of one sky, made from the direction of every texel with OpenGL's cube map rule (faces in
# the order +X right, -X left, +Y top, -Y bottom, +Z front, -Z back; texel row 0 is t = 0).
S = 256
sun = np.array([0.55, 0.35, -0.75])
sun /= np.linalg.norm(sun)
clouds = value_noise(512, 512, 6, 4, seed=3)


def sky(d):
    x, y, z = d[..., 0], d[..., 1], d[..., 2]
    up = np.clip(y, -1, 1)
    top = np.array([40, 90, 190.0]); horizon = np.array([185, 215, 240.0])
    t = np.clip(up, 0, 1)[..., None] ** 0.6
    col = horizon * (1 - t) + top * t
    # clouds: noise looked up by direction projected on a plane above
    u = (x / np.maximum(up, 0.05) * 60 + 256).astype(int) % 512
    v = (z / np.maximum(up, 0.05) * 60 + 256).astype(int) % 512
    c = np.clip((clouds[v, u] - 0.55) * 4, 0, 1)[..., None] * (up > 0.02)[..., None] * np.clip(up * 4, 0, 1)[..., None]
    col = col * (1 - c * 0.85) + np.array([250, 250, 252.0]) * c * 0.85
    # the sun
    cosang = x * sun[0] + y * sun[1] + z * sun[2]
    glow = np.clip((cosang - 0.95) / 0.05, 0, 1)[..., None] ** 2
    disc = (cosang > 0.997)[..., None]
    col = col * (1 - glow * 0.5) + np.array([255, 240, 200.0]) * glow * 0.5
    col = np.where(disc, np.array([255, 250, 230.0]), col)
    # the ground: green fields with darker rows, getting hazy towards the horizon
    gx = x / np.minimum(up, -0.02); gz = z / np.minimum(up, -0.02)
    rows = (np.floor(gx * 2) + np.floor(gz * 2)) % 2
    ground = np.where(rows[..., None] > 0, np.array([70, 120, 50.0]), np.array([95, 140, 60.0]))
    haze = np.clip(1 - (-up) * 6, 0, 1)[..., None]
    ground = ground * (1 - haze) + horizon * haze * 0.9
    col = np.where((up < 0)[..., None], ground, col)
    # mountains along the horizon (blue-grey, lighter with distance), so every direction looks different
    az = np.arctan2(x, -z)
    ridge = 0.05 + 0.05 * np.sin(az * 3 + 1) + 0.03 * np.sin(az * 7 + 2) + 0.015 * np.sin(az * 17)
    mountain = (up >= 0) & (up < ridge)
    mcol = np.array([92, 104, 128.0]) + (up / np.maximum(ridge, 1e-3))[..., None] * 30
    col = np.where(mountain[..., None], mcol, col)
    # a red and white striped tower towards +Z (behind the default camera): the cube maps' mirrors show it
    side = np.abs(x / np.maximum(z, 1e-3))
    tower = (z > 0) & (side < 0.035) & (up > -0.02) & (up < 0.42)
    stripes = (np.floor(up / 0.06) % 2 == 0)
    tcol = np.where(stripes[..., None], np.array([200, 40, 40.0]), np.array([245, 245, 245.0]))
    col = np.where(tower[..., None], tcol, col)
    return col


faces = {
    "right": lambda sc, tc: (np.ones_like(sc), -tc, -sc),
    "left": lambda sc, tc: (-np.ones_like(sc), -tc, sc),
    "top": lambda sc, tc: (sc, np.ones_like(sc), tc),
    "bottom": lambda sc, tc: (sc, -np.ones_like(sc), -tc),
    "front": lambda sc, tc: (sc, -tc, np.ones_like(sc)),
    "back": lambda sc, tc: (-sc, -tc, -np.ones_like(sc)),
}
os.makedirs("skybox", exist_ok=True)
tt, ss = (np.mgrid[0:S, 0:S] + 0.5) / S
for name, f in faces.items():
    dx, dy, dz = f(2 * ss - 1, 2 * tt - 1)
    d = np.stack([dx, dy, dz], -1)
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    Image.fromarray(np.clip(sky(d), 0, 255).astype(np.uint8)).save(f"skybox/{name}.png", optimize=True)
print("done")
