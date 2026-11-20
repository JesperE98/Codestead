"""The last step of make.mjs: turns the frames Chromium drew at 2x into the chapters' WebP pictures (kept at 2x, or
scaled down to 720 px). Needs Pillow.

    python3 to_webp.py <jobs.json>

jobs.json: {"jobs": [{"out", "frames": [png, ...], "frameMs", "width", "height", "lossy", "quality"}], "preview": dir|null,
"root": dir|null} – root is the images folder the names are printed relative to (default: GP's; Codestead Linux's
make.mjs passes its own).
One frame gives a still picture, several an animation that loops. With "preview", every picture is also written as a PNG
on the app's light and dark text background (side by side), to check how it sits in both themes.
"""
import json
import os
import sys

from PIL import Image

LIGHT = (255, 255, 255)  # --cs-surface, light theme
DARK = (26, 30, 36)  # --cs-surface, dark theme

spec = json.load(open(sys.argv[1]))
preview = spec.get("preview")
root = spec.get("root") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
total = 0
for job in spec["jobs"]:
    size = (job["width"], job["height"])
    frames = [Image.open(p).convert("RGBA").resize(size, Image.LANCZOS) for p in job["frames"]]
    os.makedirs(os.path.dirname(job["out"]), exist_ok=True)
    options = {"quality": job["quality"], "method": 6} if job["lossy"] else {"lossless": True, "quality": 100, "method": 6}
    if len(frames) == 1:
        frames[0].save(job["out"], "WEBP", **options)
    else:
        frames[0].save(job["out"], "WEBP", save_all=True, append_images=frames[1:], duration=job["frameMs"], loop=0, **options)
    kb = os.path.getsize(job["out"]) / 1024
    total += kb
    rel = os.path.relpath(job["out"], root)
    print(f"{rel}: {len(frames)} frame(s), {size[0]}x{size[1]}, {kb:.0f} KB")
    if preview:
        os.makedirs(preview, exist_ok=True)
        # At 720 px, as the text view shows it at most (in the app's default window it is about 530 px wide).
        first = frames[0].resize((720, round(720 * size[1] / size[0])), Image.LANCZOS)
        pw, ph = first.size
        sheet = Image.new("RGB", (pw * 2 + 48, ph + 32), LIGHT)
        sheet.paste(DARK, (pw + 24, 0, sheet.width, sheet.height))
        sheet.paste(first, (16, 16), first)
        sheet.paste(first, (pw + 40, 16), first)
        sheet.save(os.path.join(preview, rel.replace("/", "_").replace(".webp", ".png")))
print(f"{len(spec['jobs'])} picture(s), {total:.0f} KB")
