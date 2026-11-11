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
  sky with clouds and a bright, hazy sun (radiance about 60, some 8° wide), hills on the horizon, a dark ground and three coloured
  lamps. `hdr/environment_preview.png` is a tone-mapped look at it (not used by the course).

For the In Practice chapters (drawn by `make_practice.py`):
- `game/`: the sprites of the course's 2D game, **Hedgerow** (a ball, a paddle and a wall of blocks – the genre of
  learnopengl's game, with our own art and levels): `background.png` (800×600, a garden at dusk), `ball.png` (128²,
  RGBA, a glowing seed pod), `paddle.png` (512×128, RGBA, a wooden plank with brass ends), `block.png` (128², a light
  leafy tile the game tints), `block_solid.png` (128², stone with rivets), `particle.png` (64², RGBA, a soft spark) and
  six power-up badges `powerup_speed|sticky|pass|increase|confuse|chaos.png` (512×128, RGBA, tinted by the game);
  `game/levels/one.lvl … four.lvl` – four levels of our own in learnopengl's format (0 = empty, 1 = solid, 2–5 =
  colours).
- `../fonts/Inter-Bold.otf` + `OFL.txt`: Inter Bold (SIL Open Font License 1.1) reduced to printable ASCII, the font
  of the text chapters. The same script writes `Codestead.GP.Gpu/Fonts/inter-bold.glyphs.json`: the glyphs FreeType
  makes of it at 24 and 48 pixels, which the simulator uses in FreeType's place.

For the Guest Articles chapters:
- `heightmap.png` (256×256, one grey channel, drawn by `make_guest.py`): seeded fractal hills, a ridge of peaks along
  the top edge, a river valley from the left edge to the bottom edge and a lake in the bottom right – the terrain of the
  two Tessellation chapters (learnopengl uses a 2.6 k map of Iceland).
- `ltc/ltc_matrix.hpp` (written by `ltc/make_ltc.py`): the LTC lookup tables `LTC1` / `LTC2` (64 × 64 × RGBA floats) of
  the Area Lights chapter. **Not ours**: the GGX fit of Heitz, Dupuy, Hill and Neubelt from github.com/selfshadow/ltc_code
  (`fit/results/ltc.js`), shipped under its BSD-style licence, which allows redistribution with the copyright notice and
  a reference to the paper – both are in the header and in `ltc/LICENSE-ltc_code.txt`.
- `../models/tentacle.gltf` + `tentacle.bin` + `tentacle.png` (drawn by `../models/make_tentacle.py`): the animated model of
  the Skeletal Animation chapter – a tentacle of 495 vertices with four bones (Base → Lower → Upper → Tip) and one
  looping 2-second animation with position, rotation and scale keys (glTF 2.0; learnopengl uses a Mixamo vampire).
