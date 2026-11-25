# Project: The glass pavilion – milestones (OpenGL)

The optional project after *Advanced OpenGL* (`chapters/<lang>/advanced-opengl-project.md`). The start is the
*Framebuffers* chapter's solution unchanged (`main.cpp`, `shader_m.h`, `framebuffers.vs/.fs`, `framebuffers_screen.vs/.fs`
with the edge-detection kernel, `marble.png`, `metal.png`), plus what the milestones need: the sky's images
(`skybox/`, from *Cubemaps*), `window.png` (from *Blending*) and four shader files with a TODO – `skybox.vs`,
`skybox.fs`, `columns.vs` and `outline.fs` (the learner creates them; the texts name them). Camera at (0, 0, 3).
Checks: `Checks/TaskChecks.Project.AdvancedOpenGL.ts`, the same for every API: the picture, and where it cannot tell,
the draw calls (`Scene.draws`: order, instances, stencil, blend).

Start picture: the edge-detected scene (dark, with light edges). Finished picture (simulator and Mesa agree): the sky
(clouds, mountains, the sun at the top right), five marble columns at z = -4 (three whole, two cut off at the
edges), the left sculpture with a 10 px gold outline (x ≈ 75..330, y ≈ 185..415), the red window between the
sculptures (x ≈ 468..694, y ≈ 187..413), the corners black.

## `vignette`
- **When done:** `framebuffers_screen.fs`: `vec3 col = texture(screenTexture, TexCoords).rgb;`,
  `col *= 1.0 - smoothstep(0.4, 0.7, length(TexCoords - vec2(0.5)));`, `FragColor = vec4(col, 1.0);` (the kernel is
  gone). Check: the four corner pixels darker than 0.45 (sum of the channels), the sculpture's middle (200, 300) marble.

## `sky`
- **When done:** `loadCubemap` (from *Cubemaps*, with `<string>`/`<vector>`), `skyboxVertices` and their VAO, the
  `skybox` shader (`skybox.vs` with `pos.xyww`, `skybox.fs` sampling the `samplerCube`), and after the floor:
  `glDepthFunc(GL_LEQUAL)`, the view without translation, the draw, `glDepthFunc(GL_LESS)`. Check: a draw whose
  fragment shader samples a cube map comes after another draw into the same target; more than 200 sky-blue pixels
  (blue over red by 0.15) in the check frame; the sculpture still marble.

## `columns`
- **When done:** `columns.vs`: `vec3 position = aPos * vec3(0.5, 3.0, 0.5) + vec3(-4.0 + 2.0 * gl_InstanceID, 1.0, -4.0);`;
  `Shader columnShader("columns.vs", "framebuffers.fs")` (`texture1` = 0); before the sky
  `glDrawArraysInstanced(GL_TRIANGLES, 0, 36, 5)` with the marble texture. Check: a draw with 4 or more instances, and
  a row between y = 40 and 180 that crosses at least three separate marble pieces (grey: red and blue within 0.08).

## `outline`
- **When done:** `outline.fs`: `FragColor = vec4(1.0, 0.8, 0.2, 1.0);`; `glEnable(GL_STENCIL_TEST)`,
  `glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE)`, `GL_STENCIL_BUFFER_BIT` cleared; cube 0 with
  `glStencilFunc(GL_ALWAYS, 1, 0xFF)` / `glStencilMask(0xFF)`, then mask `0x00`; after the sky
  `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)`, depth test off, cube 0 scaled 1.1 with `outlineShader`, then mask `0xFF`,
  `GL_ALWAYS`, depth test on. Check: gold on row 300 between x = 40 and 110 and on column 205 between y = 150 and 200,
  the sculpture's middle marble, and a draw with a stencil function other than ALWAYS / NEVER.

## `glass`
- **When done:** `glassVertices` (learnopengl's transparentVertices) and their VAO, `loadTexture("window.png")`, and
  as the last draw of the off-screen pass `glEnable(GL_BLEND)`, `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`,
  the scene's shader with `translate(0.3, 0, -0.2)`, `glDisable(GL_BLEND)`. Check: a blended draw, and at least 300
  red-glass pixels (red over green by 0.2 and over blue by 0.15) sampled every 5 px in (470..690, 190..410).
