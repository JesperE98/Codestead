#!/usr/bin/env python3
"""Draws the course's height map for the Tessellation chapters (our own work, so it can ship with the app):
heightmap.png – 256 x 256, one grey channel (8 bit), 0 = low, 255 = high.

    python3 make_guest.py      (needs Pillow and NumPy)

The terrain: rolling hills made of seeded fractal value noise (6 octaves), a ridge of higher peaks across the back
(the top of the image = -z in the chapters' scenes), a winding river valley from the left edge to the bottom edge and
a flat lake in the front right. learnopengl uses a 2.6 k x 2.6 k map of Iceland; ours is smaller so the course's CPU
simulator can draw the 65,536-vertex grid of the "Height map" chapter, and a real GPU does not care.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
N = 256


def value_noise(n, cells, seed):
    r = np.random.default_rng(seed)
    grid = r.random((cells + 1, cells + 1))
    t = np.linspace(0, cells, n, endpoint=False)
    i0 = t.astype(int)
    f = t - i0
    f = f * f * (3 - 2 * f)
    fy, fx = f[:, None], f[None, :]
    a = grid[i0][:, i0]; b = grid[i0][:, i0 + 1]; c = grid[i0 + 1][:, i0]; d = grid[i0 + 1][:, i0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(n, seed, octaves=6, base=4):
    out, amp, total = np.zeros((n, n)), 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(n, base * 2 ** o, seed + o)
        total += amp
        amp *= 0.5
    return out / total


yy, xx = np.mgrid[0:N, 0:N] / (N - 1)          # yy: 0 at the image's top row (the back), xx: 0 at the left
h = fbm(N, 11)
h = (h - h.min()) / (h.max() - h.min())
ridge = 1.0 - np.abs(2.0 * fbm(N, 31, octaves=5, base=3) - 1.0)            # sharp crests
back = np.clip(1.0 - yy / 0.55, 0.0, 1.0) ** 1.5                           # the peaks stand at the back
h = 0.55 * h + 0.75 * back * ridge ** 2 + 0.1
# a river valley: from the left edge (y 0.45) curving down to the bottom edge (x 0.55)
s = np.linspace(0, 1, 400)
px = 0.0 + 0.62 * s + 0.08 * np.sin(s * 9.0)
py = 0.45 + 0.55 * s ** 1.4 + 0.05 * np.sin(s * 7.0 + 1.0)
dist = np.full((N, N), 9.0)
for x0, y0 in zip(px, py):
    dist = np.minimum(dist, np.hypot(xx - x0, yy - y0))
valley = np.exp(-(dist / 0.07) ** 2)
h = h * (1.0 - 0.75 * valley) + 0.04 * valley
# a lake in the front right: flat water level
ld = np.hypot((xx - 0.78) / 1.2, yy - 0.8)
shore = 0.12 + np.clip((ld - 0.09) / 0.06, 0.0, 1.0) ** 2 * 2.0          # the banks rise smoothly around it
h = np.minimum(h, shore)
h = np.clip(h, 0.0, None)
h = h / h.max()
img = np.round(h * 255).astype(np.uint8)
Image.fromarray(img, "L").save(os.path.join(HERE, "heightmap.png"), optimize=True)
print("heightmap.png", img.shape, "min", img.min(), "max", img.max(), "mean", round(float(img.mean()), 1))
