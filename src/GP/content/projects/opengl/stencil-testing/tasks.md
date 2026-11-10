# Stencil Testing – tasks (OpenGL)

learnopengl "Stencil testing" (object outlining): `2.stencil_testing` (`stencil_testing.cpp`,
`2.stencil_testing.vs/.fs`, `2.stencil_single_color.fs`). Files: `main.cpp`, `shader_m.h`, `stencil_testing.vs`,
`stencil_testing.fs`, `stencil_single_color.fs`, `marble.png`, `metal.png`.

Start: the Depth Testing scene drawn normally (textures, `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`), same camera
globals (cameraPos (0, 0, 3) looking down -z, fov 45), clear colour (0.1, 0.1, 0.1). As in learnopengl's
stencil_testing.cpp the loop draws the **floor first, then the two cubes** (with the depth test the order does not change
the picture; for the outlines the floor must not be in the stencil buffer). The per-frame matrices are computed before
`shader.use()` under `// set uniforms`. TODOs: after `glDepthFunc` (enable the stencil test + glStencilOp), after the
shader (build `shaderSingleColor`), above `glClear` (clear the stencil buffer), after the matrices (view/projection for
`shaderSingleColor`), before the floor (no stencil writes), before the cubes (1st pass writes 1), after the cubes (2nd
pass: the outlines). `stencil_single_color.fs` is a skeleton with an empty `main` and a TODO. The default GLFW window has
an 8-bit stencil buffer, so no window hint is needed.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
The start picture is **identical** to the Depth Testing start: **background** (400,100) = 26,26,26; **cube 0** (the
left cube, front face x ≈ 90..319, y ≈ 197..402): **cube0-centre** (193,300) ≈ 141,140,138, (150,250) ≈ 208,204,194;
**cube 1** (only its left face, at the right edge) (760,250) ≈ 168,165,159; **floor-near** (100,500) ≈ 137,141,147,
**floor-far** (600,370) ≈ 135,139,145. Outline points (background or floor before `outline`): **ring-left** (82,300) =
26,26,26, **ring-right** (323,300) = 26,26,26, **ring-top** (193,190) = 26,26,26, **ring-bottom** (193,408) = floor,
**ring-cube1** (702,300) = 26,26,26.

## `stencil-buffer`
- **Task:** Enable the stencil test, set `glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE)`, and clear the stencil buffer every frame together with the colour and depth buffers.
- **Hint:** `glEnable(GL_STENCIL_TEST);` and `glStencilOp(sfail, dpfail, dppass)`: only when both the stencil and the depth test pass is the stored value replaced by the reference value. In the loop: `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);`
- **When done:** `glEnable(GL_STENCIL_TEST);` and `glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);` after `glDepthFunc(GL_LESS);`;
  `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);`. **Nothing visible changes** (identical
  pixels): the stencil function is still the default (GL_ALWAYS, reference 0), so every fragment passes and writes 0.
  (learnopengl also calls `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)` here; the loop sets the function before every draw
  anyway, so it is left out – with it and without the per-draw state, the floor would write 1 and hide the cubes.)

## `single-color`
- **Task:** Write the outline shader: `stencil_single_color.fs` outputs `vec4(0.04, 0.28, 0.26, 1.0)`; build `shaderSingleColor` from `stencil_testing.vs` and `stencil_single_color.fs`, and give it the view and projection matrices every frame.
- **Hint:** `Shader shaderSingleColor("stencil_testing.vs", "stencil_single_color.fs");` – the same vertex shader. In the loop: `shaderSingleColor.use();` then `setMat4("view", view)` and `setMat4("projection", projection)` (a program must be in use to set its uniforms).
- **When done:** `stencil_single_color.fs`: `FragColor = vec4(0.04, 0.28, 0.26, 1.0);`; `main.cpp`:
  `Shader shaderSingleColor("stencil_testing.vs", "stencil_single_color.fs");` after `shader`, and in the loop after the
  matrices `shaderSingleColor.use(); shaderSingleColor.setMat4("view", view); shaderSingleColor.setMat4("projection", projection);`
  (before `shader.use()`). **Nothing visible changes** (nothing is drawn with it yet).

## `write-stencil`
- **Task:** Fill the stencil buffer: the floor must not write to it (`glStencilMask(0x00)`), the cubes write 1 everywhere they are drawn (`glStencilFunc(GL_ALWAYS, 1, 0xFF)` and `glStencilMask(0xFF)`).
- **Hint:** The stencil mask is ANDed with the value written: 0x00 writes nothing, 0xFF writes it as is. With `GL_ALWAYS` every cube fragment passes and, because of `GL_REPLACE`, stores the reference value 1.
- **When done:** before the floor: `glStencilMask(0x00);` (with learnopengl's comment); before the cubes: `// 1st. render
  pass …`, `glStencilFunc(GL_ALWAYS, 1, 0xFF);` and `glStencilMask(0xFF);`. **Nothing visible changes** (identical
  pixels) – the stencil buffer now holds 1 where the cubes are and 0 elsewhere. The mask is 0xFF again at the end of the
  frame, so the next `glClear` clears the stencil buffer (glClear obeys the stencil mask).

## `outline`
- **Task:** 2nd pass: draw both cubes again scaled by 1.1 with `shaderSingleColor`, only where the stencil value is not 1 (`glStencilFunc(GL_NOTEQUAL, 1, 0xFF)`), without writing the stencil (`glStencilMask(0x00)`) and with the depth test off. Then restore: mask 0xFF, `glStencilFunc(GL_ALWAYS, 0, 0xFF)`, depth test on.
- **Hint:** `float scale = 1.1f;` and `model = glm::scale(model, glm::vec3(scale, scale, scale));` after the translation. The scaled cube is bigger than the original, so only a ring around it passes the NOTEQUAL test. `glDisable(GL_DEPTH_TEST)` keeps the floor from hiding the outline.
- **When done:** after the cubes, learnopengl's 2nd pass: `glStencilFunc(GL_NOTEQUAL, 1, 0xFF); glStencilMask(0x00);
  glDisable(GL_DEPTH_TEST); shaderSingleColor.use(); float scale = 1.1f;`, the two cubes with
  `translate` + `scale(1.1)` and `shaderSingleColor.setMat4("model", model)` + `glDrawArrays(GL_TRIANGLES, 0, 36)`, then
  `glStencilMask(0xFF); glStencilFunc(GL_ALWAYS, 0, 0xFF); glEnable(GL_DEPTH_TEST);`. Both cubes get a **solid dark teal
  outline** 10,71,66 (= 0.04, 0.28, 0.26), about 8–15 px wide, drawn over the background and over the floor (no depth
  test): **ring-left** (82,300) (x ≈ 75..89), **ring-right** (323,300) (x ≈ 320..327), **ring-top** (193,190) (y ≈
  185..196), **ring-bottom** (193,408) (y ≈ 403..414, over the floor) and **ring-cube1** (702,300) (x ≈ 696..709) =
  10,71,66. The cubes themselves are unchanged (**cube0-centre** ≈ 141,140,138, cube 1 (760,250) ≈ 168,165,159), as are
  the background (400,100) and the floor away from the rings. Final state = learnopengl's stencil_testing.cpp.
