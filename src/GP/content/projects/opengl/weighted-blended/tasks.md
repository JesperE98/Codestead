# Weighted Blended OIT – tasks (OpenGL)

learnopengl "Guest Articles / OIT / Weighted Blended": `src/8.guest/2020/oit/weighted_blended.cpp` with `solid.vs/.fs`,
`transparent.vs/.fs`, `composite.vs/.fs`, `screen.vs/.fs` (learnopengl's file names). Files: `main.cpp`, `shader_m.h`
and the eight shader files. No textures. The start is the `oit-introduction` chapter's project (the problem the
introduction describes: unsorted alpha blending).

**Screenshot time: 1.0 s** (nothing moves: every picture is the same at any time).

**OpenGL version: 4.2 core** (learnopengl's): `glBlendFunci` (a blend function per colour attachment) is core in 4.0 and
`layout (binding = N)` on a sampler in GLSL needs 4.2 (`#version 420 core` in all shaders). The course's other code is
3.3. macOS stops at 4.1: there you would ask for 4.1, write `#version 410 core` and set the two samplers' units with
`compositeShader.setInt("accum", 0)` / `setInt("reveal", 1)` instead of `layout (binding = …)`.

**Fixed choices (the same in every API):**
- Window 800×600, camera (0, 0, 5) looking down -z (the camera globals: yaw -90, pitch 0, fov 45, 800/600, near 0.1,
  far 100), no input. Clear colour (0, 0, 0, 0) everywhere (learnopengl's).
- Three 2×2 quads facing the camera (learnopengl's `quadVertices`: 6 vertices, position + uv, ±1 in x and y, z = 0),
  placed with learnopengl's `calculate_model_matrix(position)` (translate · rotate x/y/z · scale; only translations here):
  - **red**, opaque `(1, 0, 0)`, at (0.5, -0.2, 1.0);
  - **green**, transparent `(0, 1, 0, 0.5)`, at (-0.3, -0.6, 2.0) – the nearest;
  - **blue**, transparent `(0, 0, 1, 0.5)`, at (-0.6, 0.5, 0.0) – the farthest, its lower right part behind the red quad.
  learnopengl puts all three at x = y = 0 (red z 1, green z 0, blue z 2), where they cover each other completely; the
  course moves them apart so every case shows (a transparent quad over the background, over the opaque quad, over another
  transparent quad, and behind the opaque quad), and swaps the green and blue depths so that learnopengl's drawing
  order (green, then blue) is **near to far** – the wrong order for ordinary blending.
- Drawing order: red (solid pass), then green, then blue (transparent pass) – learnopengl's.
- `mvp = projection * view * model` set per draw (`setMat4("mvp", vp * redModelMat)`), colours with `setVec3("color", …)`
  (solid) / `setVec4("color", …)` (transparent) – learnopengl's uniforms.
- Weighted blended OIT exactly as learnopengl: accumulation texture `GL_RGBA16F` (blend `GL_ONE, GL_ONE`, cleared to
  (0, 0, 0, 0)), revealage texture `GL_R8` (blend `GL_ZERO, GL_ONE_MINUS_SRC_COLOR`, cleared to 1), both `GL_LINEAR`;
  the transparent framebuffer shares the opaque framebuffer's depth texture (`GL_DEPTH_COMPONENT`), depth test LESS on,
  depth writes off; learnopengl's weight function `clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 -
  gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3)`; the composite pass (depth ALWAYS, blend `GL_SRC_ALPHA,
  GL_ONE_MINUS_SRC_ALPHA`) into the opaque framebuffer with `texelFetch` at `gl_FragCoord.xy`, discarding where the
  revealage is 1; the final pass copies the opaque texture to the window with the screen shader (depth test off, no
  blending).
- **Other APIs** (for their tasks.md): the transparent pass needs a different blend state per colour attachment –
  Vulkan: two `VkPipelineColorBlendAttachmentState`s in one pipeline with the device feature `independentBlend`
  (attachment 0: ONE/ONE add; attachment 1: ZERO/ONE_MINUS_SRC_COLOR add) and clear values (0,0,0,0) / (1,…) for the two
  attachments; DirectX 12: `BlendState.IndependentBlendEnable = TRUE` with `RenderTarget[0]` and `RenderTarget[1]`
  set separately, `ClearRenderTargetView` with the two clear colours. Formats: R16G16B16A16 float for accumulation and
  the opaque image, R8 UNORM for revealage. Vulkan/D3D12 depth is 0…1 like OpenGL's window depth, so the weight function
  gets the same `gl_FragCoord.z` / `SV_Position.z` values.

**What the camera sees** (pixels from the top left of the 800×600 window): the red quad x 309..671, y 155..516; the green
quad x 86..568, y 203..599 (cut by the bottom edge); the blue quad x 168..457, y 83..371 (its lower right part x 309..457,
y 155..371 is behind the red quad). Measured with Mesa (llvmpipe); nothing depends on time.

Named points: **red** (620,300) (red alone), **green-over-red** (450,400), **green** (200,450) (green over the
background), **blue** (250,120) (blue over the background), **overlap** (230,300) (green in front of blue, no red behind:
x 168..308, y 203..371), **red-over-blue** (400,180) (the red quad in front of the blue one), **background** (700,80).

**Start picture** (ordinary blending, unsorted, depth writes on – `oit-introduction`'s project): red = 255,0,0,
green-over-red = 127,128,0, green = 0,128,0, blue = 0,0,128, **overlap = 0,128,0** (wrong: the green quad was drawn
first and wrote its depth, so the blue quad behind it fails the depth test there – the blue quad's lower left corner is
cut off along the green quad's top edge y = 203), red-over-blue = 255,0,0, background = 0,0,0.

## `opaque-pass`
- **Task:** Render the scene into an off-screen "opaque" framebuffer – a `GL_RGBA16F` colour texture and a `GL_DEPTH_COMPONENT` depth texture – and draw that texture to the window with the screen shader at the end of the frame.
- **Hint:** learnopengl's setup: `glGenFramebuffers(1, &opaqueFBO)`, `opaqueTexture` (`glTexImage2D(…, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_HALF_FLOAT, NULL)`, `GL_LINEAR`), `depthTexture` (`GL_DEPTH_COMPONENT`, `GL_FLOAT`), both attached with `glFramebufferTexture2D` (`GL_COLOR_ATTACHMENT0`, `GL_DEPTH_ATTACHMENT`), then `glCheckFramebufferStatus`. In the loop bind `opaqueFBO` before the first `glClear`; the final pass: depth test off, `glDepthMask(GL_TRUE)`, blending off, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`, clear, `screenShader.use()`, bind `opaqueTexture` on unit 0, draw the quad.
- **When done:** `main.cpp`: `Shader screenShader("screen.vs", "screen.fs");`, `opaqueFBO` / `opaqueTexture`
  (`GL_RGBA16F`, `GL_HALF_FLOAT`) / `depthTexture` (`GL_DEPTH_COMPONENT`) with the two `glFramebufferTexture2D` calls and
  the completeness check; `glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);` before the solid pass's `glClear`; learnopengl's
  `// draw to backbuffer (final pass)` block (`glDisable(GL_DEPTH_TEST)`, `glDepthMask(GL_TRUE)`, `glDisable(GL_BLEND)`,
  `glBindFramebuffer(GL_FRAMEBUFFER, 0)`, `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT)`,
  `screenShader.use()`, `glBindTexture(GL_TEXTURE_2D, opaqueTexture)`, `glDrawArrays(GL_TRIANGLES, 0, 6)`); cleanup deletes
  the two textures and the framebuffer. The transparent quads are still blended the ordinary way (now into the opaque
  framebuffer). **No visible change** (green-over-red = 128,128,0 instead of 127,128,0 – the 16-bit float target rounds
  differently; everything else the same as the start, overlap still 0,128,0).

## `transparent-pass`
- **Task:** Draw the transparent quads into a second framebuffer with two colour attachments – an accumulation texture (`GL_RGBA16F`) and a revealage texture (`GL_R8`) – that shares the opaque framebuffer's depth texture. Depth writes off; attachment 0 blends with `GL_ONE, GL_ONE`, attachment 1 with `GL_ZERO, GL_ONE_MINUS_SRC_COLOR`; clear them to 0 and 1. The transparent shader writes the weighted, premultiplied colour and the alpha.
- **Hint:** `glFramebufferTexture2D(…, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTexture, 0)` on `transparentFBO` (the opaque one's depth), `const GLenum transparentDrawBuffers[] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 }; glDrawBuffers(2, transparentDrawBuffers);`. In the loop: `glDepthMask(GL_FALSE); glEnable(GL_BLEND); glBlendFunci(0, GL_ONE, GL_ONE); glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR); glBlendEquation(GL_FUNC_ADD);`, bind `transparentFBO`, `glClearBufferfv(GL_COLOR, 0, &zeroFillerVec[0]); glClearBufferfv(GL_COLOR, 1, &oneFillerVec[0]);`. `transparent.fs`: `layout (location = 0) out vec4 accum; layout (location = 1) out float reveal;`, learnopengl's weight, `accum = vec4(color.rgb * color.a, color.a) * weight; reveal = color.a;`.
- **When done:** `main.cpp`: `transparentFBO`, `accumTexture` (`GL_RGBA16F`), `revealTexture` (`GL_R8`, `GL_RED`), attached
  as `GL_COLOR_ATTACHMENT0` / `GL_COLOR_ATTACHMENT1` with `depthTexture` as `GL_DEPTH_ATTACHMENT`, `glDrawBuffers(2,
  transparentDrawBuffers)`, the completeness check; `glm::vec4 zeroFillerVec(0.0f); glm::vec4 oneFillerVec(1.0f);`; the
  transparent pass's states (`glDepthMask(GL_FALSE)`, `glBlendFunci(0, GL_ONE, GL_ONE)`, `glBlendFunci(1, GL_ZERO,
  GL_ONE_MINUS_SRC_COLOR)`, `glBlendEquation(GL_FUNC_ADD)`), `glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO)` and the two
  `glClearBufferfv` calls before the green and blue draws; cleanup. `transparent.fs`: the two outputs, the weight
  function, `accum` and `reveal`. The transparent quads go into textures nobody shows yet: the window shows **only the
  red quad** on black: red = green-over-red = red-over-blue = 255,0,0; green, blue, overlap, background = 0,0,0.

## `composite`
- **Task:** Composite the transparent result over the opaque image: draw a full-screen quad into the opaque framebuffer with the composite shader (depth function `GL_ALWAYS`, blending `GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA`), reading the accumulation texture on unit 0 and the revealage texture on unit 1. The shader divides the accumulated colour by the accumulated alpha and uses `1 - revealage` as the alpha.
- **Hint:** `Shader compositeShader("composite.vs", "composite.fs");`. In the loop after the transparent quads: `glDepthFunc(GL_ALWAYS); glEnable(GL_BLEND); glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA); glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO); compositeShader.use();`, `accumTexture` on `GL_TEXTURE0`, `revealTexture` on `GL_TEXTURE1`, draw the quad. `composite.fs`: `layout (binding = 0) uniform sampler2D accum; layout (binding = 1) uniform sampler2D reveal;`, `texelFetch(…, ivec2(gl_FragCoord.xy), 0)`, `discard` where the revealage is (approximately) 1, overflow guard with `isinf`, `average_color = accumulation.rgb / max(accumulation.a, EPSILON)`, `frag = vec4(average_color, 1.0f - revealage)`.
- **When done:** `main.cpp`: `Shader compositeShader("composite.vs", "composite.fs");`, learnopengl's `// draw composite image
  (composite pass)` block (`glDepthFunc(GL_ALWAYS)`, `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`,
  `glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO)`, `compositeShader.use()`, `accumTexture` on unit 0, `revealTexture` on unit
  1, `glDrawArrays(GL_TRIANGLES, 0, 6)`) between the transparent pass and the final pass. `composite.fs`: learnopengl's
  shader (`isApproximatelyEqual`, `max3`, `texelFetch`, `discard`, `isinf`, `average_color`, `1.0f - revealage`). The
  transparent quads are back, now **independent of their drawing order**: red = 255,0,0, green-over-red = 127,128,0,
  green = 0,128,0, blue = 0,0,128, red-over-blue = 255,0,0 (the blue quad is still hidden behind the red one: the shared
  depth texture), background = 0,0,0, and **overlap = 0,96,96** (start 0,128,0): green and blue both count there – the
  average colour (0, 0.5, 0.5) with alpha 1 - 0.5 · 0.5 = 0.75 over black. The blue quad's lower left corner now shows
  through the green quad (x 168..308, y 203..371). Note: the weights of the two quads are both clamped to 3000 here
  (their depths are close to 1), so they count equally; ordinary blending sorted back to front would give 0,128,64 (blue first, green over it:
  green on top dominates) – weighted blended OIT approximates. This is the solution.
