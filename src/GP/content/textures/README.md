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
  (+X, -X, +Y, -Y, +Z, -Z) of one sky – clouds, a sun towards -Z (in front of the default camera), mountains on the
  horizon, a red and white striped tower towards +Z (behind the camera: what mirrors facing it show) and green fields
  below the horizon – made with the cube map rule of the OpenGL specification, so they join without seams.

For the Advanced Lighting chapters (drawn by `make_advanced_lighting.py`):
- `wood.png` (256×256, RGB): warm wooden floor boards, stored as sRGB colours like a photo – the floor of the
  Blinn-Phong, gamma correction and shadow chapters (the gamma chapter loads it once as linear and once as sRGB).
- `brickwall.png` + `brickwall_normal.png` (256×256): red bricks and their tangent-space normal map (OpenGL
  convention: +x right, +y up in the texture as loaded with a vertical flip, z out of the wall) – normal mapping.
- `bricks2.png` + `bricks2_normal.png` + `bricks2_disp.png` (256×256): sandier bricks with deep mortar, their normal
  map and their depth map (white = deep, the mortar) – parallax mapping.

For the PBR chapters (drawn by `make_pbr.py`):
- `pbr/albedo.png`, `pbr/normal.png`, `pbr/metallic.png`, `pbr/roughness.png`, `pbr/ao.png` (256×256): one material –
  riveted steel plates with patches of rust (the albedo as sRGB colours; the normal map tangent-space, OpenGL
  convention; metallic, roughness and ambient occlusion as grey data). learnopengl uses a rusted iron material.
- `hdr/environment.hdr` (512×256, Radiance RGBE): an equirectangular HDR environment for image based lighting – a blue
  sky with clouds and a very bright sun (radiance about 400), hills on the horizon, a dark ground and three coloured
  lamps. `hdr/environment_preview.png` is a tone-mapped look at it (not used by the course).
