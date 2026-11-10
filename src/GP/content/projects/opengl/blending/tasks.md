# Blending – tasks (OpenGL)

learnopengl "Blending": `3.1.blending_discard` (`blending_discard.cpp`, `3.1.blending.fs`) then `3.2.blending_sort`
(`blending_sorted.cpp`). Files: `main.cpp`, `shader_m.h`, `blending.vs`, `blending.fs`, `marble.png`, `metal.png`,
`grass.png` (128×128 RGBA, grass blades, the rest fully transparent black: alpha 0 or 255), `window.png` (128×128 RGBA,
red glass alpha ≈ 0.55 in an opaque dark red frame with a cross).

Start: the Depth Testing scene drawn normally (`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, cube 0, cube 1, floor),
same camera globals (cameraPos (0, 0, 3) looking down -z, fov 45), clear colour (0.1, 0.1, 0.1), one
`Shader shader("blending.vs", "blending.fs")` that samples `texture1`. TODOs: after `planeVertices` (the quad's
vertices), after the plane VAO (the quad's VAO), after loading the textures (grass.png + the positions), after the
floor's draw (draw the quads). `loadTexture()` flips images on load (v = 1 is an image's top row), so the quad's texture
coordinates are learnopengl's with v swapped back (learnopengl does not flip and swaps them instead): the grass stands
upright.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Start picture = the Depth Testing start: **background** (400,100) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138,
**cube0-light** (150,240) ≈ 214,210,199 (marble); **cube 1** (760,250) ≈ 168,165,159;
**floor-near** (100,500) ≈ 137,141,147, **floor-far** (600,370) ≈ 135,139,145; **sky-quad** (470,230) = 26,26,26;
**overlap** (600,330) and (450,330) = 26,26,26.

The five quads (learnopengl's positions, each 1 × 1, left edge at the position's x, standing on the floor):
(-1.5, 0, -0.48) just in front of cube 0 (screen x ≈ 88..296), (1.5, 0, 0.51), (0, 0, 0.7) the nearest and biggest
(x ≈ 400..715, top y ≈ 143), (-0.3, 0, -2.3) far behind, (0.5, 0, -0.6) behind the nearest one (they overlap at
**overlap** (600,330)).

## `grass`
- **Task:** Add the vegetation: a transparent quad (`transparentVertices`, 6 vertices, position + texcoords) with its own VAO, `grass.png` loaded as `transparentTexture`, a `std::vector<glm::vec3> vegetation` with learnopengl's five positions, and after the floor one draw per position.
- **Hint:** The quad goes from (0, -0.5) to (1, 0.5) at z = 0, so `glm::translate(model, vegetation[i])` puts its bottom on the floor. `#include <vector>`. Bind `transparentVAO` and `transparentTexture`, then in a `for` loop set `model` and call `glDrawArrays(GL_TRIANGLES, 0, 6)`.
- **When done:** `#include <vector>`; `float transparentVertices[]` (top-left (0, 0.5) uv (0, 1), bottom-left (0, -0.5)
  uv (0, 0), bottom-right (1, -0.5) uv (1, 0), …), `transparentVAO`/`transparentVBO` set up like the plane,
  `unsigned int transparentTexture = loadTexture("grass.png");`, `std::vector<glm::vec3> vegetation { (-1.5, 0, -0.48),
  (1.5, 0, 0.51), (0, 0, 0.7), (-0.3, 0, -2.3), (0.5, 0, -0.6) }`, the draw loop
  `for (unsigned int i = 0; i < vegetation.size(); i++)` with `model = glm::translate(glm::mat4(1.0f), vegetation[i])`
  after the floor, and the new VAO/VBO/texture deleted at the end. Five **grass quads, each a black square** with green
  blades: the transparent texels are drawn with their RGB (black) because nothing discards or blends them yet:
  **cube0-centre** (193,300) = 0,0,0 (the quad in front of cube 0 hides it), **sky-quad** (470,230) = 0,0,0, a blade at
  (150,240) ≈ 48,131,25, another at **floor-far** (600,370) ≈ 57,155,30. Cube 1 (760,250) and **floor-near** (100,500)
  unchanged.

## `discard`
- **Task:** Throw away the transparent fragments: in `blending.fs` discard every fragment whose texture alpha is below 0.1. In `loadTexture`, use `GL_CLAMP_TO_EDGE` for RGBA images.
- **Hint:** `vec4 texColor = texture(texture1, TexCoords); if(texColor.a < 0.1) discard; FragColor = texColor;`. With GL_REPEAT the linear filter at the quad's top edge mixes in texels from the opposite (bottom) edge – opaque grass – and a thin semi-transparent line appears: `format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT`.
- **When done:** `blending.fs` = learnopengl's `3.1.blending.fs` (`vec4 texColor = …; if(texColor.a < 0.1) discard;
  FragColor = texColor;`); `loadTexture` sets WRAP_S/WRAP_T to `format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT` (the
  floor and the cubes still repeat). **Only the grass blades remain**: **cube0-centre** (193,300) ≈ 141,140,138 (the cube
  is visible again between the blades), **sky-quad** (470,230) = 26,26,26 (background), blades unchanged at (150,240) ≈
  48,131,25 and (600,370) ≈ 57,155,30; no line along the quads' top edges (e.g. row y = 143..148 between x = 420 and 700
  is background).

## `blend`
- **Task:** Turn the grass into windows: load `window.png` instead of `grass.png`, rename the positions to `windows`, and enable alpha blending with `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`.
- **Hint:** `glEnable(GL_BLEND);` next to the depth test. The result is `src * src.alpha + dst * (1 - src.alpha)`: the glass (alpha ≈ 0.55) mixes with what is already in the colour buffer. The discard in the shader can stay (no window texel is below 0.1).
- **When done:** `glEnable(GL_BLEND);` and `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);` after `glDepthFunc`;
  `loadTexture("window.png")`; the vector is `std::vector<glm::vec3> windows` (comment `// transparent window
  locations`) and the draw loop (`// windows`) iterates over `windows`. Five **red windows**; the cube, the floor and
  the background **show through the glass**: glass over cube 0 (150,240) ≈ 218,117,112 (was marble 214,210,199), the
  frame cross at **cube0-centre** (193,300) = 110,20,20 (opaque), glass over the background **sky-quad** (470,230) ≈
  133,34,34. Still drawn in the vector's order, so where the nearest window (0, 0, 0.7, drawn 3rd) covers the window at
  (0.5, 0, -0.6) (drawn 5th, behind it), the farther one fails the depth test and is **missing behind the glass**:
  **overlap** (600,330) ≈ 133,34,34 and (450,330) ≈ 133,34,34 (just one layer of glass over the background), the floor
  behind the near window at (600,370) ≈ 182,85,87.

## `sort`
- **Task:** Draw the windows from the farthest to the nearest: each frame fill a `std::map<float, glm::vec3> sorted` with the distance from the camera (`glm::length(cameraPos - windows[i])`) as key, then draw with a `reverse_iterator` from `sorted.rbegin()` to `sorted.rend()`.
- **Hint:** `#include <map>`. A map keeps its keys sorted (smallest first), so walking it backwards gives the farthest window first. Opaque objects are already drawn first; the windows come last. Use `it->second` as the position.
- **When done:** `#include <map>`; after `processInput(window);` learnopengl's block `std::map<float, glm::vec3> sorted;
  for (unsigned int i = 0; i < windows.size(); i++) { float distance = glm::length(cameraPos - windows[i]);
  sorted[distance] = windows[i]; }`; the draw loop is `for (std::map<float, glm::vec3>::reverse_iterator it =
  sorted.rbegin(); it != sorted.rend(); ++it)` with `model = glm::translate(model, it->second);` (comment `// windows
  (from furthest to nearest)`). Order: (-0.3, 0, -2.3), (-1.5, 0, -0.48), (0.5, 0, -0.6), (1.5, 0, 0.51), (0, 0, 0.7).
  The window behind the nearest one now **shows through it** (two layers of glass, darker/redder): **overlap** (600,330)
  ≈ 171,31,31, (450,330) ≈ 181,37,37, (600,370) ≈ 171,31,31. Everything else unchanged (glass over cube 0 (150,240) ≈
  218,117,112, (193,300) = 110,20,20, sky-quad (470,230) ≈ 133,34,34, cube 1 (760,250) ≈ 168,165,159). Final state =
  learnopengl's blending_sorted.cpp (with the discard of 3.1 still in the shader).
