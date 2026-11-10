#!/usr/bin/env python3
"""Draws the course's assets for the "In Practice" chapters (our own work, so they can ship with the app):

  game/background.png, game/ball.png, game/paddle.png, game/block.png, game/block_solid.png, game/particle.png,
  game/powerup_speed.png, game/powerup_sticky.png, game/powerup_pass.png, game/powerup_increase.png,
  game/powerup_confuse.png, game/powerup_chaos.png
      the sprites of the course's 2D game, "Hedgerow" (a ball, a paddle and a wall of blocks: the genre of
      learnopengl's 2D game, with the course's own name, art and levels).
  game/levels/one.lvl … four.lvl
      the game's four levels, in learnopengl's level format (0 = no block, 1 = solid, 2–5 = coloured blocks).
  fonts/Inter-Bold.otf (+ fonts/OFL.txt)
      Inter Bold (SIL Open Font License 1.1), reduced to the printable ASCII characters – the font of the text
      rendering chapters, loaded with FreeType.
  ../../Codestead.GP.Gpu/Fonts/inter-bold.glyphs.json
      what FreeType's FT_Load_Char(face, c, FT_LOAD_RENDER) gives for that font at the pixel sizes the course uses:
      the simulator's stand-in for FreeType (it has no font rasteriser of its own).

    python3 make_practice.py      (needs Pillow, NumPy, fonttools and freetype-py; the system's Inter font)
"""
import base64
import hashlib
import json
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "game")
os.makedirs(os.path.join(GAME, "levels"), exist_ok=True)


def save(name, img):
    path = os.path.join(GAME, name)
    img.save(path)


rng = np.random.default_rng(7)

# ---------- background: a garden at dusk (800 x 600) ----------
W, H = 800, 600
y = np.linspace(0, 1, H)[:, None]
sky_top = np.array([22, 28, 62]); sky_low = np.array([148, 96, 118])
sky = sky_top * (1 - y ** 1.6) + sky_low * y ** 1.6
img = np.repeat(sky[:, None, :], W, axis=1).reshape(H, W, 3)
# stars
for _ in range(140):
    sx, sy = rng.integers(0, W), rng.integers(0, int(H * 0.45))
    b = rng.uniform(120, 230)
    img[sy, sx] = np.maximum(img[sy, sx], [b, b, b * 0.95])
# a big pale moon at the top right
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt((xx - 640) ** 2 + (yy - 110) ** 2)
img = np.where((d < 46)[..., None], np.array([236, 230, 205]), img)
img = img + (np.clip(1 - d / 160, 0, 1) ** 2 * 40)[..., None]
# two layers of hills with hedges
x = np.arange(W)
far = 430 + 22 * np.sin(x / 90.0) + 12 * np.sin(x / 37.0 + 1.3)
near = 500 + 18 * np.sin(x / 120.0 + 2.0) + 9 * np.sin(x / 23.0)
img = np.where((yy > far[None, :])[..., None], np.array([46, 52, 74]), img)
img = np.where((yy > near[None, :])[..., None], np.array([30, 40, 46]), img)
bg = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(bg)
for cx in range(30, W, 110):  # round hedge bushes on the near hill
    top = int(near[min(cx, W - 1)]) - 26
    dr.ellipse([cx - 34, top, cx + 34, top + 56], fill=(26, 46, 40))
bg = bg.filter(ImageFilter.GaussianBlur(0.6))
save("background.png", bg)

# ---------- ball: a glowing seed pod with a light rim (128 x 128, RGBA) ----------
S = 128
yy, xx = np.mgrid[0:S, 0:S] / (S - 1) * 2 - 1
r = np.sqrt(xx ** 2 + yy ** 2)
alpha = np.clip((1 - r) * 40, 0, 1)
light = np.clip(1 - np.sqrt((xx + 0.35) ** 2 + (yy + 0.35) ** 2) / 1.3, 0, 1)
ball = np.stack([120 + 120 * light, 200 + 50 * light, 120 + 100 * light], -1)
ring = np.clip(1 - np.abs(r - 0.82) / 0.06, 0, 1)
ball = ball * (1 - ring[..., None] * 0.5) + np.array([255, 255, 230]) * ring[..., None] * 0.5
rgba = np.dstack([np.clip(ball, 0, 255), alpha * 255]).astype(np.uint8)
save("ball.png", Image.fromarray(rgba, "RGBA"))

# ---------- paddle: a wooden plank with brass ends (512 x 128, RGBA) ----------
PW, PH = 512, 128
pad = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
dr = ImageDraw.Draw(pad)
dr.rounded_rectangle([4, 20, PW - 5, PH - 21], radius=40, fill=(150, 102, 62, 255))
grain = rng.random((PH, PW))
arr = np.array(pad).astype(float)
stripes = 0.85 + 0.15 * np.sin(np.arange(PH)[:, None] / 3.0 + 4 * grain)
arr[..., :3] *= stripes[..., None]
pad = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
dr = ImageDraw.Draw(pad)
for x0 in (18, PW - 78):
    dr.rounded_rectangle([x0, 24, x0 + 60, PH - 25], radius=30, fill=(214, 170, 72, 255))
dr.rounded_rectangle([4, 20, PW - 5, PH - 21], radius=40, outline=(70, 44, 24, 255), width=6)
save("paddle.png", pad)

# ---------- blocks (128 x 128): a light tile that the game tints, and a solid stone one ----------
B = 128
tile = np.full((B, B, 3), 225.0)
yy, xx = np.mgrid[0:B, 0:B]
edge = np.minimum(np.minimum(xx, B - 1 - xx), np.minimum(yy, B - 1 - yy))
tile -= np.clip(1 - edge / 12, 0, 1)[..., None] * 70  # a soft bevel
tile += np.where((xx + yy < B)[..., None], 18, -12)  # lit from the top left
leaf = rng.random((B // 8, B // 8))
tile -= np.kron(leaf, np.ones((8, 8)))[..., None] * 22  # a leafy texture
save("block.png", Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)))
stone = np.full((B, B, 3), 150.0)
noise = np.kron(rng.random((16, 16)), np.ones((8, 8)))
stone += (noise[..., None] - 0.5) * 40
stone -= np.clip(1 - edge / 10, 0, 1)[..., None] * 60
cracks = (np.abs(((xx * 0.7 + yy * 1.3) % 61) - 30) < 1.2) | (np.abs(((xx * 1.1 - yy * 0.5) % 47) - 23) < 1.0)
stone[cracks] *= 0.6
for cx, cy in ((22, 22), (B - 23, 22), (22, B - 23), (B - 23, B - 23)):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    stone = np.where((d < 8)[..., None], np.array([95, 95, 100]) + 60 * np.clip(1 - d / 8, 0, 1)[..., None], stone)
save("block_solid.png", Image.fromarray(np.clip(stone, 0, 255).astype(np.uint8)))

# ---------- particle: a soft round spark (64 x 64, RGBA) ----------
P = 64
yy, xx = np.mgrid[0:P, 0:P] / (P - 1) * 2 - 1
r = np.sqrt(xx ** 2 + yy ** 2)
a = np.clip(1 - r, 0, 1) ** 2
rgba = np.dstack([np.full((P, P), 255), np.full((P, P), 255), np.full((P, P), 255), a * 255]).astype(np.uint8)
save("particle.png", Image.fromarray(rgba, "RGBA"))

# ---------- power-ups (512 x 128, RGBA): a rounded badge with a symbol; the game tints them ----------
def badge(symbol):
    im = Image.new("RGBA", (512, 128), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([6, 6, 505, 121], radius=56, fill=(235, 235, 235, 255), outline=(255, 255, 255, 255), width=8)
    c = (40, 40, 40, 255)
    if symbol == "speed":  # two arrows to the right
        for x0 in (190, 260):
            dr.polygon([(x0, 30), (x0 + 60, 64), (x0, 98)], fill=c)
    elif symbol == "sticky":  # a drop
        dr.ellipse([216, 46, 296, 112], fill=c)
        dr.polygon([(222, 70), (256, 14), (290, 70)], fill=c)
    elif symbol == "pass":  # a ball passing through a wall
        dr.rectangle([248, 22, 264, 106], fill=c)
        dr.ellipse([290, 44, 330, 84], fill=c)
        dr.line([(170, 64), (285, 64)], fill=c, width=6)
    elif symbol == "increase":  # a wide bar with arrows out
        dr.rectangle([196, 54, 316, 74], fill=c)
        dr.polygon([(176, 64), (200, 40), (200, 88)], fill=c)
        dr.polygon([(336, 64), (312, 40), (312, 88)], fill=c)
    elif symbol == "confuse":  # a spiral
        pts = [(256 + 4 * t * math.cos(t), 64 + 4 * t * math.sin(t)) for t in np.linspace(0, 4 * math.pi, 120)]
        dr.line(pts, fill=c, width=7)
    elif symbol == "chaos":  # a jagged star
        pts = []
        for k in range(16):
            rad = 50 if k % 2 == 0 else 22
            ang = k * math.pi / 8
            pts.append((256 + rad * math.cos(ang), 64 + rad * math.sin(ang) * 0.9))
        dr.polygon(pts, fill=c)
    return im


for name in ("speed", "sticky", "pass", "increase", "confuse", "chaos"):
    save(f"powerup_{name}.png", badge(name))

# ---------- levels (learnopengl's format; the course's own layouts) ----------
LEVELS = {
    # 1: a hedge of colours over a low stone wall
    "one.lvl": [
        "5 5 5 5 5 5 5 5 5 5 5 5 5 5 5",
        "4 4 4 4 4 4 4 4 4 4 4 4 4 4 4",
        "3 3 3 3 3 3 3 3 3 3 3 3 3 3 3",
        "2 2 2 2 2 2 2 2 2 2 2 2 2 2 2",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "1 1 0 0 1 1 0 0 0 1 1 0 0 1 1",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    ],
    # 2: a gate between two stone towers
    "two.lvl": [
        "1 2 2 2 2 2 2 2 2 2 2 2 2 2 1",
        "1 3 3 3 3 3 0 0 0 3 3 3 3 3 1",
        "1 4 4 4 4 0 0 0 0 0 4 4 4 4 1",
        "1 5 5 5 0 0 1 1 1 0 0 5 5 5 1",
        "1 2 2 0 0 0 0 0 0 0 0 0 2 2 1",
        "1 0 0 0 0 0 0 0 0 0 0 0 0 0 1",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    ],
    # 3: diamonds
    "three.lvl": [
        "0 0 0 2 0 0 0 0 0 0 0 4 0 0 0",
        "0 0 2 3 2 0 0 0 0 0 4 5 4 0 0",
        "0 2 3 5 3 2 0 1 0 4 5 3 5 4 0",
        "0 0 2 3 2 0 0 0 0 0 4 5 4 0 0",
        "0 0 0 2 0 0 0 0 0 0 0 4 0 0 0",
        "0 0 0 0 0 0 1 0 1 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    ],
    # 4: a checkerboard garden with stone posts
    "four.lvl": [
        "2 3 2 3 2 3 2 3 2 3 2 3 2 3 2",
        "3 1 3 4 3 4 3 1 3 4 3 4 3 1 3",
        "4 5 4 5 4 5 4 5 4 5 4 5 4 5 4",
        "5 4 1 4 5 4 5 4 5 4 5 4 1 4 5",
        "2 3 2 3 2 3 2 3 2 3 2 3 2 3 2",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
        "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    ],
}
for name, rows in LEVELS.items():
    with open(os.path.join(GAME, "levels", name), "w") as f:
        f.write("\n".join(rows) + "\n")

# ---------- the font: Inter Bold, printable ASCII ----------
from fontTools import subset

FONTS = os.path.join(HERE, "..", "fonts")
os.makedirs(FONTS, exist_ok=True)
src = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
font_out = os.path.join(FONTS, "Inter-Bold.otf")
options = subset.Options()
options.layout_features = []          # no ligatures or kerning tables: FreeType's simple path, as learnopengl uses it
options.name_IDs = ["*"]
options.notdef_outline = True
font = subset.load_font(src, options)
sub = subset.Subsetter(options)
sub.populate(unicodes=range(32, 127))
sub.subset(font)
subset.save_font(font, font_out, options)
with open(os.path.join(FONTS, "OFL.txt"), "w") as f:
    f.write(
        "Inter Bold (Inter-Bold.otf, reduced to the printable ASCII characters)\n"
        "Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)\n\n"
        "This Font Software is licensed under the SIL Open Font License, Version 1.1.\n"
        "The license is available with a FAQ at: https://openfontlicense.org\n"
    )

# ---------- FreeType's glyphs for the simulator ----------
import freetype

data = open(font_out, "rb").read()
face = freetype.Face(font_out)
glyphs = {"sha256": hashlib.sha256(data).hexdigest(), "file": "Inter-Bold.otf", "sizes": {}}
for size in (24, 48):
    face.set_pixel_sizes(0, size)
    table = {}
    for code in range(32, 127):
        face.load_char(chr(code), freetype.FT_LOAD_RENDER)
        g = face.glyph
        bm = g.bitmap
        buf = bytes(bm.buffer)
        table[str(code)] = {
            "width": bm.width, "rows": bm.rows, "pitch": bm.pitch,
            "left": g.bitmap_left, "top": g.bitmap_top, "advance": g.advance.x,
            "bitmap": base64.b64encode(buf).decode("ascii"),
        }
    glyphs["sizes"][str(size)] = table
out = os.path.join(HERE, "..", "..", "Codestead.GP.Gpu", "Fonts")
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "inter-bold.glyphs.json"), "w") as f:
    json.dump(glyphs, f, separators=(",", ":"))
print("ok", glyphs["sha256"][:12], os.path.getsize(font_out), "bytes")
