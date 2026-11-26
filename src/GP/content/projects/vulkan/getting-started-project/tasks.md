# Project: The planetarium sign – milestones (Vulkan)

The optional project after *Getting started* (brief: `chapters/<lang>/getting-started-project.md`; checks:
`ts/packages/gp-course/src/Checks/TaskChecks.Project.GettingStarted.ts`). Nothing new is taught and no matrices are
used: the learner combines the clear colour, the vertex positions, texture coordinates and wrap modes, the vertex
colour passed from the vertex shader, and the time as a push constant with `sin` in the fragment shader.

Start = `textures/solution` unchanged (files `main.cpp`, `shaders/shader.vert`, `shaders/shader.frag`,
`textures/container.png`, `textures/awesomeface.png`): the rectangle x, y ±0.5 with texture coordinates 0..2, the
crate (through `clampSampler`, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`) in the top-left quarter and its edge stretched
over the rest, mixed 50/50 with the face (`textureSampler`, repeat, mirrored, 2 × 2) by the push constant `mixValue`;
`fragColor` (top left yellow, top right red, bottom right green, bottom left blue) arrives in `shader.frag` unused. Teal background.

The checks read the picture (the course's 160-pixel check frame), measured from the sign's bounding box (the pixels
that are not the clear colour), so sizes, coordinates, speeds and brightnesses are the learner's. Only `repeat-wood`
also reads the code (the crate no longer read through the clamping sampler), because with the faces repeating already a stretched crate edge and
a repeating crate are too close to tell apart once the tint and glow are on. Every check also passes on the final
program (the later milestones do not undo the earlier ones in the picture).

## `night-blue`
- **Task:** Clear the window to a deep night blue.
- **Hint:** `VkClearValue clearColor` in `recordCommandBuffer()`, e.g. (0.03, 0.04, 0.15).
- **When done:** `VkClearValue clearColor = {{{0.03f, 0.04f, 0.15f, 1.0f}}};`. The same rectangle on a dark blue background. Check: red
  and green of the clear colour ≤ 0.15, blue ≤ 0.45 and at least 0.04 above both.

## `wide-sign`
- **Task:** Move the corners so the sign is clearly wider than tall – e.g. x ±0.9, y ±0.6.
- **Hint:** The first part of each `Vertex` (Vulkan's y points down: the top corners have y = -0.6).
- **When done:** positions (±0.9, ±0.6): a sign of 720 × 360 pixels, the faces stretched to ellipses (still 2 × 2,
  the crate in the top-left quarter). Check: the drawn box at least 60 % of the window's width and 1.8 times as
  wide as tall (the start's is 400 × 300).

## `repeat-wood`
- **Task:** Make the crate repeat across the sign – texture coordinates up to 4 × 2 and a sampler that repeats.
- **Hint:** u 2.0 → 4.0 on the right-hand vertices; the crate's `imageInfo.sampler = textureSampler`, `clampSampler`
  removed.
- **When done:** u 0..4, v 0..2; `imageInfo.sampler = textureSampler`; the member `clampSampler`, its
  `vkCreateSampler` (and the three clamp address modes before it) and its `vkDestroySampler` removed. Eight square tiles of 180 × 180 pixels, each a
  crate with a face. Check: no `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`/`_BORDER` in the code or no `….sampler = clampSampler`, and the picture repeats 3–8 times
  across the sign (each pixel compared, relative to the mean of its 7 × 7 neighbourhood, with the pixel a copy's
  width to its right: mean difference < 0.05; the stretched-edge start gives about 0.2).

## `tint`
- **Task:** Tint the sign with the corners' colours.
- **Hint:** `* vec4(fragColor, 1.0)` after `mix(...)`.
- **When done:** yellow → red along the top, blue → green along the bottom (the blue corner almost black: the wood and
  the face have little blue). Check: near the top-right corner red is over 0.06 and more than twice green and blue;
  near the bottom-right corner green likewise.

## `glow`
- **Task:** Let the sign get brighter and darker over and over, with the time from the CPU.
- **Hint:** `float time` after `mixValue` in `PushConstants` and the shader's block, `glow = 0.7 + 0.3 * sin(pc.time * 2.0)`.
- **When done:** `shader.frag` computes the tinted colour, then `outColor = vec4(color.rgb * glow, 1.0)`; `main.cpp`
  includes `<chrono>`, and `recordCommandBuffer()` fills `constants.time` with the seconds since the first frame (the
  `std::chrono` lines of *Shaders*). The push constant range (fragment stage, `sizeof(PushConstants)`) needs no change. The whole sign between 0.4 and 1.0 of its brightness, once every π s. Check: the
  scene is animated and, of five upright strips of the sign (at 10, 30, 50, 70 and 90 % of its width), one changes
  its mean brightness by at least a fifth of its brightest over 0.5, 1.0 … 4.0 s.

## `wave`
- **Task:** Make the glow travel across the sign from left to right.
- **Hint:** `sin(pc.time * 2.0 - fragTexCoord.x)`.
- **When done:** the glow's phase falls by 4 rad from the left edge to the right, so the bright band runs to the right
  (at 1 s the left end is bright, the right end at 0.43). Check: the `glow` check, and at one of the times two strips
  differ by more than 0.2 in their brightness relative to their own mean over the times (a pulse of the whole sign
  keeps them equal).
