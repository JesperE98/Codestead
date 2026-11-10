#!/usr/bin/env python3
"""Draws the course's images for the PBR chapters (our own work, so they can ship with the app):

  pbr/albedo.png, pbr/normal.png, pbr/metallic.png, pbr/roughness.png, pbr/ao.png
      one material: a riveted steel plate with patches of rust (learnopengl uses a rusted iron material).
  hdr/environment.hdr
      an equirectangular HDR environment (Radiance RGBE, 512 x 256): a sky with a very bright sun, a horizon with
      hills, a ground plane and a few bright lamps – radiance values far above 1.0, as image based lighting needs.

    python3 make_pbr.py      (needs Pillow and NumPy)

The normal map is tangent-space with OpenGL's convention (+y up in the texture as loaded with a vertical flip).
Colour (albedo) is stored as sRGB; metallic, roughness and ao are linear data in grey.
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
        # wrap, so the texture tiles
        grid[c, :] = grid[0, :]
        grid[:, c] = grid[:, 0]
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
    path = os.path.join(HERE, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8)).save(path)


def grey(a):
    return np.repeat((a * 255)[..., None], 3, -1)


# ---------- the material ----------
N = 256
y, x = np.mgrid[0:N, 0:N] / N
rust_noise = value_noise(N, N, 4, octaves=5, seed=41)
rust = np.clip((rust_noise - 0.5) * 6 + 0.5, 0, 1)            # 0 = bare steel, 1 = rust (soft-edged patches)
fine = value_noise(N, N, 32, octaves=3, seed=42)

# Plates: a 2 x 2 grid of plates with grooves between them and a rivet near each plate corner.
gx, gy = (x * 2) % 1.0, (y * 2) % 1.0
groove = np.minimum(np.minimum(gx, 1 - gx), np.minimum(gy, 1 - gy))
groove_depth = np.clip(1 - groove / 0.02, 0, 1)                # 1 in the groove
rivets = np.zeros((N, N))
for cx in (0.12, 0.88):
    for cy in (0.12, 0.88):
        d = np.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
        rivets = np.maximum(rivets, np.clip(1 - d / 0.05, 0, 1))
rivet_height = np.sqrt(np.clip(rivets, 0, 1))                  # a dome

height = 0.5 - 0.5 * groove_depth + 0.35 * rivet_height + 0.08 * rust * fine + 0.02 * fine

steel = np.stack([150 + 30 * fine, 152 + 30 * fine, 158 + 30 * fine], -1)
rusty = np.stack([120 + 60 * fine, 62 + 30 * fine, 30 + 14 * fine], -1)
albedo = steel * (1 - rust[..., None]) + rusty * rust[..., None]
albedo *= (1 - 0.45 * groove_depth)[..., None]
save("pbr/albedo.png", albedo)

save("pbr/metallic.png", grey(np.clip(1 - rust, 0, 1) * (1 - 0.6 * groove_depth)))
save("pbr/roughness.png", grey(np.clip(0.25 + 0.15 * fine + 0.55 * rust + 0.2 * groove_depth, 0.05, 1)))
save("pbr/ao.png", grey(np.clip(1 - 0.6 * groove_depth - 0.25 * np.clip(rivets * 2 - 1.2, 0, 1) - 0.1 * rust * fine, 0, 1)))

# Tangent-space normals from the height: +u right, +v up (image rows go down, so d/dv = -d/drow).
dh_du = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * N
dh_dv = -(np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * N
strength = 0.02
nx, ny, nz = -dh_du * strength, -dh_dv * strength, np.ones_like(height)
length = np.sqrt(nx * nx + ny * ny + nz * nz)
save("pbr/normal.png", np.stack([(nx / length + 1) * 127.5, (ny / length + 1) * 127.5, (nz / length + 1) * 127.5], -1))


# ---------- the HDR environment ----------
W, H = 512, 256
v, u = np.mgrid[0:H, 0:W]
phi = (u + 0.5) / W * 2 * math.pi - math.pi                    # longitude, -pi .. pi (0 = the image's centre)
theta = (0.5 - (v + 0.5) / H) * math.pi                        # latitude, +pi/2 (top) .. -pi/2 (bottom)
dx, dy, dz = np.cos(theta) * np.cos(phi), np.sin(theta), np.cos(theta) * np.sin(phi)

# Sky: deep blue at the zenith, pale at the horizon; ground: dark warm grey, lighter towards the horizon.
t = np.clip(dy, 0, 1)
sky = np.stack([0.35 + 0.9 * (1 - t) ** 3, 0.55 + 0.8 * (1 - t) ** 3, 1.1 + 0.4 * (1 - t) ** 3], -1)
g = np.clip(-dy, 0, 1)
ground = np.stack([0.20 - 0.10 * g, 0.17 - 0.09 * g, 0.13 - 0.07 * g], -1)
env = np.where((dy >= 0)[..., None], sky, ground)

# Hills on the horizon (a dark green silhouette of varying height).
hill_noise = value_noise(W, 1, 8, octaves=4, seed=51)[0]
hill_top = 0.03 + 0.10 * hill_noise                            # latitude (radians) of the ridge at each longitude
hills = (theta >= 0) & (theta < hill_top[None, :])
env[hills] = np.array([0.05, 0.11, 0.05])

# Soft clouds in the sky.
clouds = value_noise(W, H, 6, octaves=4, seed=52)
cloud = np.clip((clouds - 0.55) * 4, 0, 1) * np.clip(dy * 4, 0, 1)
env = env * (1 - cloud[..., None]) + np.array([1.6, 1.6, 1.7]) * cloud[..., None]

# The sun through haze: a disc about 8 degrees wide of high radiance (60) with a glow, up to the right of the centre
# (wide enough that a convolution with a modest number of samples does not miss it).
sun_dir = np.array([math.cos(0.75) * math.cos(0.9), math.sin(0.75), math.cos(0.75) * math.sin(0.9)])
cos_sun = dx * sun_dir[0] + dy * sun_dir[1] + dz * sun_dir[2]
env += np.array([1.0, 0.9, 0.7]) * (np.clip(cos_sun, 0, 1) ** 64 * 6)[..., None]
env += np.array([1.0, 0.95, 0.85]) * (np.clip((cos_sun - 0.990) / 0.004, 0, 1) * 60)[..., None]

# Three lamps on the ground side (warm, cool, magenta): coloured highlights in reflections.
for lamp_phi, lamp_theta, colour in ((-2.2, -0.25, (40, 22, 8)), (2.6, -0.2, (8, 20, 40)), (-0.6, -0.5, (30, 6, 24))):
    ld = np.array([math.cos(lamp_theta) * math.cos(lamp_phi), math.sin(lamp_theta), math.cos(lamp_theta) * math.sin(lamp_phi)])
    c = dx * ld[0] + dy * ld[1] + dz * ld[2]
    env += np.array(colour) * np.clip((c - 0.995) / 0.005, 0, 1)[..., None]


def write_hdr(path, rgb):
    """Radiance RGBE, flat (not run-length encoded) scanlines, top row first."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w, _ = rgb.shape
    m = np.max(rgb, axis=-1)
    e = np.where(m > 1e-32, np.floor(np.log2(np.maximum(m, 1e-32))) + 1, 0)
    scale = np.where(m > 1e-32, 256.0 / np.exp2(e), 0)
    rgbe = np.zeros((h, w, 4), dtype=np.uint8)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, e + 128, 0).astype(np.uint8)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode("ascii"))
        f.write(rgbe.tobytes())


write_hdr(os.path.join(HERE, "hdr/environment.hdr"), env.astype(np.float64))

# A tone-mapped preview next to it (not used by the course; for looking at the environment).
preview = 1 - np.exp(-env * 0.8)
save("hdr/environment_preview.png", (preview ** (1 / 2.2)) * 255)
