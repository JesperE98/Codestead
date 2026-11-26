# Project: The planetarium sign – milestones (OpenGL)

The optional project after *Getting started* (brief: `chapters/<lang>/getting-started-project.md`; checks:
`ts/packages/gp-course/src/Checks/TaskChecks.Project.GettingStarted.ts`). Nothing new is taught and no matrices are
used: the learner combines the clear colour, the vertex positions, texture coordinates and wrap modes, the vertex
colour passed from the vertex shader, and a time uniform with `sin` in the fragment shader.

Start = `textures/solution` unchanged (files `main.cpp`, `shader_s.h`, `shader.vs`, `shader.fs`, `container.png`,
`awesomeface.png`): the rectangle x, y ±0.5 with texture coordinates 0..2, the crate (`GL_CLAMP_TO_EDGE`) in the
bottom-left quarter and its edge stretched over the rest, mixed 50/50 with the face (`GL_REPEAT`, mirrored, 2 × 2) by
`mixValue`; `ourColor` (top right red, bottom right green, bottom left blue, top left yellow) arrives in `shader.fs`
unused. Teal background.

The checks read the picture (the course's 160-pixel check frame), measured from the sign's bounding box (the pixels
that are not the clear colour), so sizes, coordinates, speeds and brightnesses are the learner's. Only `repeat-wood`
also reads the code (no clamping wrap mode left), because with the faces repeating already a stretched crate edge and
a repeating crate are too close to tell apart once the tint and glow are on. Every check also passes on the final
program (the later milestones do not undo the earlier ones in the picture).

## `night-blue`
- **Task:** Clear the window to a deep night blue.
- **Hint:** `glClearColor`, e.g. (0.03, 0.04, 0.15).
- **When done:** `glClearColor(0.03f, 0.04f, 0.15f, 1.0f);`. The same rectangle on a dark blue background. Check: red
  and green of the clear colour ≤ 0.15, blue ≤ 0.45 and at least 0.04 above both.

## `wide-sign`
- **Task:** Move the corners so the sign is clearly wider than tall – e.g. x ±0.9, y ±0.6.
- **Hint:** The first three numbers of each vertex.
- **When done:** positions (±0.9, ±0.6): a sign of 720 × 360 pixels, the faces stretched to ellipses (still 2 × 2,
  the crate in the bottom-left quarter). Check: the drawn box at least 60 % of the window's width and 1.8 times as
  wide as tall (the start's is 400 × 300).

## `repeat-wood`
- **Task:** Make the crate repeat across the sign – texture coordinates up to 4 × 2 and a repeating wrap mode.
- **Hint:** s 2.0 → 4.0 on the right-hand vertices; the crate's `GL_TEXTURE_WRAP_S/T` → `GL_REPEAT`.
- **When done:** s 0..4, t 0..2; the crate's wrap mode `GL_REPEAT`. Eight square tiles of 180 × 180 pixels, each a
  crate with a face. Check: no `GL_CLAMP_TO_EDGE`/`GL_CLAMP_TO_BORDER` in the code, and the picture repeats 3–8 times
  across the sign (each pixel compared, relative to the mean of its 7 × 7 neighbourhood, with the pixel a copy's
  width to its right: mean difference < 0.05; the stretched-edge start gives about 0.2).

## `tint`
- **Task:** Tint the sign with the corners' colours.
- **Hint:** `* vec4(ourColor, 1.0)` after `mix(...)`.
- **When done:** yellow → red along the top, blue → green along the bottom (the blue corner almost black: the wood and
  the face have little blue). Check: near the top-right corner red is over 0.06 and more than twice green and blue;
  near the bottom-right corner green likewise.

## `glow`
- **Task:** Let the sign get brighter and darker over and over, with the time from the CPU.
- **Hint:** `uniform float time;`, `setFloat("time", glfwGetTime())`, `glow = 0.7 + 0.3 * sin(time * 2.0)`.
- **When done:** `shader.fs` computes the tinted colour, then `FragColor = vec4(color.rgb * glow, 1.0)`; `main.cpp`
  sets `time` next to `mixValue`. The whole sign between 0.4 and 1.0 of its brightness, once every π s. Check: the
  scene is animated and, of five upright strips of the sign (at 10, 30, 50, 70 and 90 % of its width), one changes
  its mean brightness by at least a fifth of its brightest over 0.5, 1.0 … 4.0 s.

## `wave`
- **Task:** Make the glow travel across the sign from left to right.
- **Hint:** `sin(time * 2.0 - TexCoord.x)`.
- **When done:** the glow's phase falls by 4 rad from the left edge to the right, so the bright band runs to the right
  (at 1 s the left end is bright, the right end at 0.43). Check: the `glow` check, and at one of the times two strips
  differ by more than 0.2 in their brightness relative to their own mean over the times (a pulse of the whole sign
  keeps them equal).
