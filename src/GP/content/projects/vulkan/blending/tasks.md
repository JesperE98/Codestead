# Blending (Vulkan) – discarding fragments, alpha blending, sorting the windows (learnopengl "Blending")

learnopengl `3.1.blending_discard` then `3.2.blending_sort`. Files: `main.cpp`, `shaders/blending.vert` / `.frag`,
`textures/marble.png`, `textures/metal.png`, `textures/grass.png` (RGBA, alpha 0 or 255; the transparent pixels are
black), `textures/window.png` (red glass, alpha ≈ 0.55, in an opaque frame).

Start: the Depth Testing scene (see that chapter's tasks.md: one vertex buffer – cube vertices 0..35, floor 36..41 –,
one descriptor set per texture with the UBO at binding 0 and the texture at binding 1, `loadTexture(...)`,
`createTextureSampler(addressMode, sampler)`, one pipeline, depth LESS), drawn cube 0, cube 1, floor, and a TODO in
`recordCommandBuffer()` after the floor.

The five quads (learnopengl's positions, each 1 × 1, left edge at the position's x, standing on the floor):
(-1.5, 0, -0.48) just in front of cube 0 (screen x ≈ 88..296), (1.5, 0, 0.51), (0, 0, 0.7) the nearest and biggest
(x ≈ 400..715, top y ≈ 143), (-0.3, 0, -2.3) far behind, (0.5, 0, -0.6) behind the nearest one (they overlap at
**overlap** (600,330)).

Pixels measured on lavapipe, 800×600, nothing depends on time. Start = the Depth Testing start: **background**
(400,100) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138, **cube0-light** (150,240) ≈ 214,210,199; **cube 1**
(760,250) ≈ 163,161,156; **floor-near** (100,500) ≈ 137,141,147, **floor-far** (600,370) ≈ 130,134,140; **sky-quad**
(470,230) = 26,26,26; **overlap** (600,330) and (450,330) = 26,26,26.

## grass
- **Task:** Draw learnopengl's vegetation: append the transparent quad (learnopengl's `transparentVertices`, 6
  vertices, x 0..1, y -0.5..0.5) to `vertices` (vertices 42..47), add the global `vegetation` positions, load
  `"textures/grass.png"` into `transparentTextureImage/Memory/View`, create `transparentSampler` with
  `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` and `transparentDescriptorSet` (pool: maxSets and both descriptor counts 3),
  destroy them in `cleanup()`, and replace the TODO with a loop over `vegetation` that binds `transparentDescriptorSet`,
  pushes `glm::translate(glm::mat4(1.0f), vegetation[i])` and draws `vkCmdDraw(commandBuffer, 6, 1, 42, 0)`.
- **Hint:** learnopengl's texture coordinates for the quad already have v = 0 at the top edge (stb_image's first row
  is the top of the image), so the grass stands upright. Clamp to edge: with REPEAT, linear filtering at the top edge
  would mix in the opaque bottom row of the image and draw a thin line.
- **When done:** five quads with grass blades on **black** squares (the transparent texels are black and nothing
  discards them): (193,300) = 0,0,0 (black over cube 0), **sky-quad** (470,230) = 0,0,0, a blade at (150,240) ≈
  46,124,24, **overlap** (600,330) ≈ 65,170,30, **floor-far** (600,370) ≈ 57,155,30 (blades); background (400,100),
  cube 1 (760,250) and **floor-near** (100,500) unchanged. 8 draws.

## discard
- **Task:** In `shaders/blending.frag` read the texel into `vec4 texColor`, `discard` it when `texColor.a < 0.1`, else
  output it.
- **Hint:** A discarded fragment writes neither colour nor depth: what is behind the quad stays visible.
- **When done:** only the blades are left: **cube0-centre** (193,300) ≈ 141,140,138 and (150,250) ≈ 208,204,194
  (marble again), **sky-quad** (470,230) = 26,26,26; blades unchanged at (150,240) ≈ 46,124,24, (600,330) ≈
  65,170,30, (600,370) ≈ 57,155,30.

## blend
- **Task:** Switch the quads to windows: load `"textures/window.png"` instead of grass.png, rename `vegetation` to
  `windows`, and enable alpha blending in `createPipeline()`: `blendEnable = VK_TRUE`, `srcColorBlendFactor =
  VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, `colorBlendOp = ADD`,
  `srcAlphaBlendFactor = ONE`, `dstAlphaBlendFactor = ZERO`, `alphaBlendOp = ADD` (vulkan-tutorial's alpha blending).
- **Hint:** OpenGL's `glEnable(GL_BLEND)` + `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` – here part of the one
  pipeline, so the opaque objects (alpha 1) are unchanged. The discard of the previous task stays (it never triggers
  for the window). The windows are still drawn in list order, so a near window drawn before a far one hides it: the
  depth test throws away the far window behind the near glass.
- **When done:** red tinted glass: **sky-quad** (470,230) = 133,34,34 (glass over the background), cube 0 seen through
  glass (150,240) ≈ 218,117,112, (193,300) = 110,20,20 (the frame); **overlap** (600,330) = 133,34,34 and (600,370) ≈
  180,82,85 – the window at (0.5, 0, -0.6) is **missing** behind the nearest window (drawn earlier); (450,330) =
  133,34,34. Background, cube 1 and **floor-near** unchanged.

## sort
- **Task:** Sort the windows by distance and draw them from far to near: before drawing them in
  `recordCommandBuffer()`, fill `std::map<float, glm::vec3> sorted;` in a for loop with
  `float distance = glm::length(cameraPos - windows[i]); sorted[distance] = windows[i];`, then draw with
  `for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)` and
  `glm::translate(model, it->second)`; `#include <map>`.
- **Hint:** A std::map keeps its keys sorted (smallest first); the reverse iterator walks from the largest distance to
  the smallest. Opaque objects first, then the sorted transparent ones.
- **When done:** the hidden window shows through the nearest one: **overlap** (600,330) = 171,31,31 and (600,370) =
  171,31,31 (two layers of glass), (450,330) = 181,37,37 (the far window at (-0.3, 0, -2.3) and the nearest);
  **sky-quad** (470,230) = 133,34,34, (150,240) ≈ 218,117,112, (193,300) = 110,20,20, background, cube 1 and floor
  unchanged. 8 draws, the windows in the order (-0.3, 0, -2.3), (-1.5, 0, -0.48), (0.5, 0, -0.6), (1.5, 0, 0.51),
  (0, 0, 0.7).
