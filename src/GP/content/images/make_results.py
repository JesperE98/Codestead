"""Turns the frames that src/GP/tools/RenderResults renders into the chapters' result pictures.

    dotnet run -c Release --project src/GP/tools/RenderResults -- src/GP/content <frames dir> [chapter ...]
    python3 src/GP/content/images/make_results.py <frames dir>

Each chapter's result – the course's own OpenGL solution, run by the simulated GPU – becomes
results/<chapter>.webp: a still picture, or a short loop when the scene moves. Needs Pillow.
"""
import os
import sys

from PIL import Image

# Chapters whose final state is not a picture worth showing: nothing drawn yet, a cleared window, a depth or debug view.
SKIP = {"api", "introduction", "ide-setup", "hello-window", "assimp", "mesh", "game-intro", "game-setup", "pbr-theory",
        "depth-testing"}

frames_dir = sys.argv[1]
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
os.makedirs(out_dir, exist_ok=True)
for chapter in sorted(os.listdir(frames_dir)):
    size = os.path.join(frames_dir, chapter, "size.txt")
    if not os.path.exists(size) or chapter in SKIP:
        continue
    w, h, ms, n = (int(v) for v in open(size).read().split())
    frames = []
    for i in range(n):
        with open(os.path.join(frames_dir, chapter, f"{i:03d}.rgb"), "rb") as f:
            frames.append(Image.frombytes("RGB", (w, h), f.read()))
    target = os.path.join(out_dir, chapter + ".webp")
    if n == 1:
        frames[0].save(target, "WEBP", quality=82, method=6)
    else:
        frames[0].save(target, "WEBP", save_all=True, append_images=frames[1:], duration=ms, loop=0, quality=75, method=6)
    print(f"{chapter}: {n} frame(s), {os.path.getsize(target) // 1024} KB")
