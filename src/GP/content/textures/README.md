# Textures

The images the course's texture chapters load. Both were drawn for Codestead (a short Pillow script, no outside
assets), so they can be shipped with the app:

- `container.png` (256×256, RGB): a wooden crate – planks, a dark frame and a diagonal brace.
- `awesomeface.png` (256×256, RGBA): a smiling face on a transparent background, with a red heart on its right side
  as you look at it, so you can tell when the image is mirrored.

learnopengl.com uses `container.jpg` and `awesomeface.png`; ours play the same roles. Each chapter's projects carry
copies next to their code (`projects/<api>/<chapter>/start/`), as a real project would.
- `container2.png` (256×256, RGB): wooden planks in a steel frame with rivets – the diffuse map of the lighting chapters.
- `container2_specular.png`: its specular map – the steel bright, the wood almost black.
- `matrix.png`: an emission map of glowing green glyphs on black (the "Lighting maps" exercise).

For the Advanced OpenGL chapters (drawn by `make_advanced.py`):
- `marble.png` (256×256, RGB): light marble with dark veins – the cubes of the depth, stencil and blending chapters.
- `metal.png` (256×256, RGB): a steel floor plate with a diamond pattern and four bolts – the floor.
- `grass.png` (128×128, RGBA): grass blades on a fully transparent background (alpha is 0 or 255): the discard example.
- `window.png` (128×128, RGBA): red tinted glass (alpha about 0.55) in an opaque frame: the blending example.
- `skybox/right.png`, `left.png`, `top.png`, `bottom.png`, `front.png`, `back.png` (256×256, RGB): the six faces
  (+X, -X, +Y, -Y, +Z, -Z) of one sky – clouds, a sun towards -Z (in front of the default camera) and green fields
  below the horizon – made with the cube map rule of the OpenGL specification, so they join without seams.
