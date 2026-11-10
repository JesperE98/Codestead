#!/usr/bin/env python3
"""Draws the course's images for the Advanced Lighting chapters (our own work, so they can ship with the app):
wood.png, brickwall.png + brickwall_normal.png, bricks2.png + bricks2_normal.png + bricks2_disp.png.

    python3 make_advanced_lighting.py      (needs Pillow and NumPy)

Normal maps are tangent-space, OpenGL convention: x right (+u), y up (+v, the image's top as learnopengl loads it with
stbi_set_flip_vertically_on_load), z out of the surface; stored as (n + 1) / 2. The displacement map is a depth map as
learnopengl's parallax mapping expects it: white = deep (the mortar), black = the surface (the bricks).
"""
import math
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def value_noise(w, h, cells, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for _ in range(octaves):
        c = cells
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
        cells *= 2
    return out / total


def save(name, array):
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8)).save(os.path.join(HERE, name))


# wood.png: warm wooden floor boards (the floor of the lighting, gamma and shadow chapters). Colours as a photo would
# store them (sRGB): the gamma chapter loads it as an sRGB texture.
N = 256
y, x = np.mgrid[0:N, 0:N] / N
boards = 4
board = np.floor(x * boards)
u = x * boards - board                                  # 0..1 across a board
grain_noise = value_noise(N, N, 3, seed=11)
offset = (board * 0.37) % 1.0
rings = np.sin((y * 6 + offset * 5 + grain_noise * 2.5 + u * 0.6) * math.pi * 2)
grain = 0.5 + 0.5 * rings
streaks = value_noise(N, N, 16, seed=12)
shade = 0.78 + 0.12 * grain + 0.10 * streaks + 0.05 * np.sin(board * 2.1)
gap = (u < 0.03) | (u > 0.97)
# the boards' ends, staggered
ends = np.abs(((y + offset) % 0.5) - 0.0) < 0.008
shade = np.where(gap | ends, 0.35, shade)
wood = np.stack([196 * shade, 134 * shade, 82 * shade], -1)
save("wood.png", wood)


def bricks(n, rows, cols, mortar, seed):
    """Height (1 = brick face, 0 = mortar) and a per-brick colour variation for a running-bond wall."""
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = np.floor(yy * rows)
    shift = (row % 2) * 0.5
    col = np.floor(xx * cols + shift)
    fu = xx * cols + shift - col                         # 0..1 inside a brick
    fv = yy * rows - row
    edge = np.minimum(np.minimum(fu, 1 - fu) / cols, np.minimum(fv, 1 - fv) / rows)
    height = np.clip(edge / mortar, 0, 1) ** 0.6          # a bevel from the mortar up to the face
    rough = value_noise(n, n, 8, seed=seed + 1)
    height = np.where(height > 0.999, 1 - 0.08 * rough, height * (1 - 0.08 * rough))
    tint = r.random((rows + 1, cols + 2))
    brick_tint = tint[row.astype(int), (col.astype(int) % (cols + 2))]
    return height, brick_tint, rough


def normal_map(height, strength):
    # Gradients in texture space: +u to the right, +v up (image rows go down, so d/dv = -d/drow).
    dh_du = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * height.shape[1]
    dh_dv = -(np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * height.shape[0]
    nx, ny, nz = -dh_du * strength, -dh_dv * strength, np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([(nx / length + 1) * 127.5, (ny / length + 1) * 127.5, (nz / length + 1) * 127.5], -1)


def brick_colour(height, tint, rough, base, mortar_colour):
    face = np.array(base)[None, None, :] * (0.85 + 0.25 * tint[..., None]) * (0.9 + 0.2 * rough[..., None])
    m = np.array(mortar_colour)[None, None, :] * (0.9 + 0.2 * rough[..., None])
    t = np.clip(height * 1.5, 0, 1)[..., None]
    return face * t + m * (1 - t)


# brickwall.png + brickwall_normal.png: red bricks (the normal mapping chapter).
N = 256
h, tint, rough = bricks(N, 8, 4, 0.012, seed=21)
save("brickwall.png", brick_colour(h, tint, rough, (170, 74, 52), (196, 190, 178)))
save("brickwall_normal.png", normal_map(h, 0.012))

# bricks2.png + bricks2_normal.png + bricks2_disp.png: deeper, sandier bricks with wide mortar (parallax mapping).
h2, tint2, rough2 = bricks(N, 6, 3, 0.03, seed=31)
save("bricks2.png", brick_colour(h2, tint2, rough2, (178, 112, 72), (120, 112, 104)))
save("bricks2_normal.png", normal_map(h2, 0.02))
save("bricks2_disp.png", np.repeat(((1 - h2) * 255)[..., None], 3, -1))
