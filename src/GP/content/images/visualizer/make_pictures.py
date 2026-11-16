"""The chapters' pictures from the Render Pipeline Visualizer (https://github.com/jesper-e98/RenderpipelineVisualizer).

1. Build the visualizer and serve it: `npm ci && npx vite build && npx vite preview --port 4173`.
2. Capture every step in Swedish and English (Playwright):
   `node capture.js <captures dir> "$(cat steps.txt)"` – writes <captures dir>/{sv,en}/<slide>-<step>.png.
3. `python3 make_pictures.py <captures dir>` – writes ../{sv,en}/viz-*.webp: still pictures, and slideshows of
   several steps (the app fades from one to the next). Needs Pillow.
"""
import os
import sys

from PIL import Image

WIDTH = 720
HOLD_MS = 2600

# picture name -> the visualizer steps it shows (several: a slideshow)
PICTURES = {
    "viz-pipeline": ["overview-1", "overview-2", "overview-3", "overview-4"],
    "viz-present": ["present-1", "present-2", "present-3", "present-4"],
    "viz-buffers": ["buffers-1", "buffers-2", "buffers-3", "buffers-4", "buffers-5"],
    "viz-input-layout": ["input-layout-1", "input-layout-2", "input-layout-3", "input-layout-4"],
    "viz-indices": ["input-assembly-1", "input-assembly-2", "input-assembly-3"],
    "viz-strip": ["input-assembly-4"],
    "viz-rasterization": ["rasterization-1", "rasterization-2", "rasterization-3"],
    "viz-msaa": ["rasterization-4"],
    "viz-shaders": ["shaders-1", "shaders-2", "shaders-3", "shaders-4"],
    "viz-uniforms": ["descriptors-1", "descriptors-2", "descriptors-3", "descriptors-4"],
    "viz-spaces": ["vertex-shader-1", "vertex-shader-2", "vertex-shader-3", "vertex-shader-4"],
    "viz-clipping": ["clipping-1", "clipping-2", "clipping-3", "clipping-4"],
    "viz-viewport": ["viewport-culling-1"],
    "viz-winding": ["viewport-culling-2"],
    "viz-culling": ["viewport-culling-3", "viewport-culling-4"],
    "viz-fragment": ["fragment-shader-1", "fragment-shader-2", "fragment-shader-3"],
    "viz-depth": ["depth-1", "depth-2", "depth-3", "depth-4"],
    "viz-blending": ["blending-1", "blending-2", "blending-3", "blending-4"],
    "viz-parse": ["parse-1", "parse-2", "parse-3", "parse-4"],
    "viz-commands": ["commands-1", "commands-2", "commands-3", "commands-4"],
}

captures = sys.argv[1]
images = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for lang in ("sv", "en"):
    os.makedirs(os.path.join(images, lang), exist_ok=True)
    for name, steps in PICTURES.items():
        frames = []
        for step in steps:
            im = Image.open(os.path.join(captures, lang, step + ".png")).convert("RGB")
            frames.append(im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS))
        target = os.path.join(images, lang, name + ".webp")
        if len(frames) == 1:
            frames[0].save(target, "WEBP", quality=80, method=6)
        else:
            frames[0].save(target, "WEBP", save_all=True, append_images=frames[1:], duration=HOLD_MS, loop=0, quality=78, method=6)
        print(lang, name, len(frames), f"{os.path.getsize(target) // 1024} KB")
