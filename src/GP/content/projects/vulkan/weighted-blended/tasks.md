# Weighted Blended OIT (Vulkan) – tasks

learnopengl "Guest Articles / OIT / Weighted Blended": `src/8.guest/2020/oit/weighted_blended.cpp`. Files: `main.cpp`
and in `shaders/` (each built to `<name>.spv`, learnopengl's names): `solid.vert/.frag`, `transparent.vert/.frag`,
`composite.vert/.frag`, `screen.vert/.frag`. No textures. The start is the `oit-introduction` chapter's project (the
problem the introduction describes: ordinary alpha blending in drawing order).

**Screenshot time: 1.0 s** (nothing moves: every picture is the same at any time).

**Fixed choices (the same in every API, see `../../opengl/weighted-blended/tasks.md`):**
- Window 800×600, camera (0, 0, 5) looking down -z (the camera globals: yaw -90, pitch 0, fov 45, 800/600, near 0.1,
  far 100, `proj[1][1] *= -1` for Vulkan's y), no input. Clear colour (0, 0, 0, 0) everywhere (learnopengl's).
- Three 2×2 quads facing the camera (learnopengl's `quadVertices`: 6 vertices, position + uv, ±1 in x and y, z = 0 – the
  one vertex buffer; `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }`), placed with learnopengl's free function
  `calculate_model_matrix(position)` (translate · rotate x/y/z · scale; only translations here), computed in
  `recordCommandBuffer()`:
  - **red**, opaque `(1, 0, 0)`, at (0.5, -0.2, 1.0);
  - **green**, transparent `(0, 1, 0, 0.5)`, at (-0.3, -0.6, 2.0) – the nearest;
  - **blue**, transparent `(0, 0, 1, 0.5)`, at (-0.6, 0.5, 0.0) – the farthest, its lower right part behind the red quad.
  learnopengl puts all three at x = y = 0; the course moves them apart so every case shows, and learnopengl's drawing
  order (red, then green, then blue) is near to far for the two transparent quads – the wrong order for ordinary
  blending.
- learnopengl's two uniforms `mvp` and `color` are **push constants**: `struct PushConstants { glm::mat4 mvp; glm::vec4
  color; }` (one range for the vertex and fragment stages; `mvp = vp * redModelMat` with `vp = projection * view`
  computed once per frame); `solid.frag` uses `pc.color.rgb` (learnopengl's `uniform vec3 color`).
- Every vertex shader declares `layout(location = 1) in vec2 uv;` even where it does not use it (the vertex buffer has
  it; otherwise the validation layer warns that the attribute is not consumed).
- Render states are pipeline state in Vulkan: one helper `createPipeline(vertFile, fragFile, pipelineRenderPass,
  colorAttachmentCount, depthTestEnable, depthWriteEnable, blendEnable, srcBlendFactor0, dstBlendFactor0,
  srcBlendFactor1, dstBlendFactor1, pipeline)` (in the start already) sets learnopengl's `glEnable(GL_DEPTH_TEST)` /
  `glDepthMask` / `glBlendFunc(i)` per pipeline: the factors of colour attachment 0 and 1, the alpha channel blended
  with the same factors (like `glBlendFunc`), `VK_BLEND_OP_ADD` (learnopengl's `glBlendEquation(GL_FUNC_ADD)`), depth
  compare `LESS`. learnopengl's `glDepthFunc(GL_ALWAYS)` for the composite pass = a pipeline without depth test (the
  composite pass has no depth attachment).
- Weighted blended OIT as learnopengl, in Vulkan terms: the **opaque framebuffer** = an `R16G16B16A16_SFLOAT` colour
  image (`opaqueImage`) + a depth image of its own (`opaqueDepthImage`, learnopengl's `depthTexture`; the window keeps
  its own `depthImage`); the **transparent framebuffer** = an accumulation image `R16G16B16A16_SFLOAT` (`accumImage`,
  cleared to (0, 0, 0, 0), blend ONE / ONE) + a revealage image `R8_UNORM` (`revealImage`, cleared to 1, blend ZERO /
  ONE_MINUS_SRC_COLOR) + the opaque depth image, loaded (`loadOp LOAD`, not cleared) and only tested (depth writes
  off). A different blend state per colour attachment (learnopengl's `glBlendFunci`) needs the device feature
  **`independentBlend`** (checked in `isDeviceSuitable`, enabled in `createLogicalDevice`; D3D12's
  `IndependentBlendEnable`). learnopengl's weight function `clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 -
  gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3)`: Vulkan's `gl_FragCoord.z` with `GLM_FORCE_DEPTH_ZERO_TO_ONE` is exactly
  OpenGL's window depth (both are f / (f - n) + f·n / ((f - n)·z_eye)), so the weights are the same.
- Four render passes per frame, recorded in this order in `recordCommandBuffer()` (learnopengl binds framebuffers
  instead): `opaqueRenderPass` (solid pass: colour + depth cleared, both stored), `transparentRenderPass` (two colour
  attachments, the depth loaded; accum and reveal end in `SHADER_READ_ONLY_OPTIMAL`), `compositeRenderPass` (the
  opaque colour image again, `loadOp LOAD`, initial layout `COLOR_ATTACHMENT_OPTIMAL`, final `SHADER_READ_ONLY_OPTIMAL`)
  and the window's `renderPass` (the screen quad). Each off-screen render pass has subpass dependencies so that the
  next pass waits for the images it reads (colour writes → fragment shader reads; depth writes → depth tests;
  colour writes → the composite's blending reads). Each framebuffer is made for its render pass
  (`opaqueFramebuffer`, `transparentFramebuffer`, `compositeFramebuffer` with only `opaqueImageView`).
- The composite and screen shaders read their images through descriptor sets of one layout with two combined image
  samplers at bindings 0 and 1 (learnopengl's `layout (binding = 0) uniform sampler2D accum; layout (binding = 1) …
  reveal`), sampled with `colorBufferSampler` (LINEAR, clamp to edge): `compositeDescriptorSet` (accum, reveal) and
  `screenDescriptorSet` (the opaque image at binding 0; binding 1 gets the same view and is unused). The start already
  has the layout, the pool (two sets), the sampler and the helper `createDescriptorSet(firstView, secondView, set)`.
- The screen quad is the same 6 vertices with their uv unchanged: in Vulkan both the window's y and an image's v point
  down, so the image shows upright; `composite.frag` uses `texelFetch` at `ivec2(gl_FragCoord.xy)` like learnopengl.

**What the camera sees** (pixels from the top left of the 800×600 window): the red quad x 309..671, y 155..516; the green
quad x 86..568, y 203..599 (cut by the bottom edge); the blue quad x 168..457, y 83..371 (its lower right part x 309..457,
y 155..371 is behind the red quad). Measured on lavapipe; nothing depends on time; every state's picture equals OpenGL's
(at most 1,652 edge pixels differ, by at most 10/255).

Named points: **red** (620,300), **green-over-red** (450,400), **green** (200,450) (green over the background), **blue**
(250,120) (blue over the background), **overlap** (230,300) (green in front of blue, no red behind: x 168..308, y
203..371), **red-over-blue** (400,180) (the red quad in front of the blue one), **background** (700,80).

**Start picture** (ordinary blending, in drawing order, depth writes on, everything drawn into the window's render
pass): red = 255,0,0, green-over-red = 127,128,0, green = 0,128,0, blue = 0,0,128, **overlap = 0,128,0** (wrong: the
green quad was drawn first and wrote its depth, so the blue quad behind it fails the depth test there – the blue quad's
lower left corner is cut off along the green quad's top edge y = 203), red-over-blue = 255,0,0, background = 0,0,0.

## `opaque-pass`
- **Task:** Render the scene into an off-screen "opaque" framebuffer – a 16-bit float colour image and a depth image with a render pass of their own – and draw that image to the window with the screen shader at the end of the frame.
- **Hint:** `createOpaqueRenderPass()`: colour `VK_FORMAT_R16G16B16A16_SFLOAT` and `findDepthFormat()`, both `CLEAR` / `STORE`; for now the colour ends in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` (the final pass samples it), with a dependency from colour writes to fragment-shader reads. `createOpaqueFramebuffer()`: `createImage` + `createImageView` for both (colour: `COLOR_ATTACHMENT | SAMPLED` usage). The solid and transparent pipelines are now made for `opaqueRenderPass`; the screen pipeline for the window's `renderPass` (no depth test, no blending); `createDescriptorSet(opaqueImageView, opaqueImageView, screenDescriptorSet)`. In `recordCommandBuffer()` begin the opaque pass instead of the window's, and after it the final pass: the window's render pass, `screenPipeline`, `screenDescriptorSet`, `vkCmdDraw(commandBuffer, 6, 1, 0, 0)`.
- **When done:** code: `VkRenderPass opaqueRenderPass`, `createOpaqueRenderPass()` (format `R16G16B16A16_SFLOAT`,
  two attachments, `pDependencies` with 2 dependencies), `opaqueImage` / `opaqueDepthImage` and their memory and views,
  `opaqueFramebuffer`, `createOpaqueFramebuffer()`, `screenPipeline` (`createPipeline("shaders/screen.vert.spv",
  "shaders/screen.frag.spv", renderPass, 1, VK_FALSE, VK_FALSE, VK_FALSE, …)`), `screenDescriptorSet`, the solid and
  transparent `createPipeline` calls with `opaqueRenderPass`; `recordCommandBuffer()`: `opaquePassInfo` with
  `opaqueRenderPass` / `opaqueFramebuffer` and two clear values ((0, 0, 0, 0), depth 1.0), and the `// draw to backbuffer
  (final pass)` block (window render pass, `screenPipeline`, `screenDescriptorSet`, 6 vertices); cleanup destroys the
  new objects. The transparent quads are still blended the ordinary way (now inside the opaque pass). **No visible
  change**: green-over-red = 128,128,0 (127,128,0 before – the 16-bit float image rounds differently), every other point
  as the start, overlap still 0,128,0.

## `transparent-pass`
- **Task:** Draw the transparent quads in a render pass of their own with two colour attachments – an accumulation image (`R16G16B16A16_SFLOAT`) and a revealage image (`R8_UNORM`) – and the opaque pass's depth image, loaded, tested but not written. Blend attachment 0 with ONE / ONE and attachment 1 with ZERO / ONE_MINUS_SRC_COLOR (enable the device feature `independentBlend`), clear them to 0 and 1, and let the transparent shader write the weighted, premultiplied colour and the alpha.
- **Hint:** `createTransparentRenderPass()`: three attachments – accum and reveal `CLEAR` / `STORE`, final layout `SHADER_READ_ONLY_OPTIMAL`; the depth `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD` with `initialLayout = finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL`; `colorAttachmentCount = 2` (shader output location 0 → accum, 1 → reveal). `createTransparentFramebuffer()` with `accumImageView`, `revealImageView`, `opaqueDepthImageView`. The pipeline: `createPipeline(…transparent…, transparentRenderPass, 2, VK_TRUE, VK_FALSE, VK_TRUE, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, VK_BLEND_FACTOR_ONE_MINUS_SRC_COLOR, transparentPipeline)`. `deviceFeatures.independentBlend = VK_TRUE;` and `supportedFeatures.independentBlend` in `isDeviceSuitable`. In `recordCommandBuffer()` end the opaque pass after the red quad and begin the transparent pass (clear values (0, 0, 0, 0) and (1, 1, 1, 1); the third, for the loaded depth, is ignored). `transparent.frag`: `layout(location = 0) out vec4 accum; layout(location = 1) out float reveal;`, learnopengl's weight, `accum = vec4(pc.color.rgb * pc.color.a, pc.color.a) * weight; reveal = pc.color.a;`.
- **When done:** code: `deviceFeatures.independentBlend = VK_TRUE`, the feature check, `transparentRenderPass`
  (`createTransparentRenderPass()`: `VK_FORMAT_R16G16B16A16_SFLOAT`, `VK_FORMAT_R8_UNORM`, the depth with
  `VK_ATTACHMENT_LOAD_OP_LOAD`), `accumImage`, `revealImage`, `transparentFramebuffer` (`createTransparentFramebuffer()`
  with `opaqueDepthImageView`), the transparent pipeline with 2 attachments, depth writes off and the two blend factor
  pairs; `recordCommandBuffer()`: `vkCmdEndRenderPass` after the red quad, `transparentPassInfo` (3 clear values) before
  the green and blue quads; `transparent.frag` with two outputs and the weight function. The transparent quads go into
  images nobody shows yet: the window shows **only the red quad** on black: red = green-over-red = red-over-blue =
  255,0,0; green, blue, overlap, background = 0,0,0.

## `composite`
- **Task:** Composite the transparent result over the opaque image: a third render pass that loads the opaque colour image (not cleared) and draws the screen quad with the composite shader – no depth test, blending SRC_ALPHA / ONE_MINUS_SRC_ALPHA – reading the accumulation image at binding 0 and the revealage image at binding 1. The shader divides the accumulated colour by the accumulated alpha and uses `1 - revealage` as the alpha.
- **Hint:** The opaque render pass now leaves its colour in `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` (the composite pass draws into it again); `createCompositeRenderPass()`: one attachment, `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD`, `initialLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`, `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, a dependency from the solid pass's colour writes to the blending's reads (`COLOR_ATTACHMENT_READ`). `createCompositeFramebuffer()` with only `opaqueImageView`. `createPipeline(…composite…, compositeRenderPass, 1, VK_FALSE, VK_FALSE, VK_TRUE, VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, …)`, `createDescriptorSet(accumImageView, revealImageView, compositeDescriptorSet)`. Record it between the transparent pass and the final pass (`clearValueCount = 0`). `composite.frag`: learnopengl's shader with `layout(binding = 0) uniform sampler2D accum; layout(binding = 1) uniform sampler2D reveal;`.
- **When done:** code: `compositeRenderPass` (`createCompositeRenderPass()`: `VK_ATTACHMENT_LOAD_OP_LOAD`, initial layout
  `COLOR_ATTACHMENT_OPTIMAL`), the opaque pass's colour `finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`,
  `compositeFramebuffer`, `compositePipeline`, `compositeDescriptorSet`; `recordCommandBuffer()`: the `// draw composite
  image (composite pass)` block (`compositePassInfo`, `compositePipeline`, `compositeDescriptorSet`, 6 vertices) between
  the transparent pass and the final pass. `composite.frag`: `isApproximatelyEqual`, `max3`, `texelFetch`, `discard`,
  `isinf`, `average_color`, `frag = vec4(average_color, 1.0 - revealage)`. The transparent quads are back, now
  **independent of their drawing order**: red = 255,0,0, green-over-red = 127,128,0, green = 0,128,0, blue = 0,0,128,
  red-over-blue = 255,0,0 (the blue quad is still hidden behind the red one: the shared depth image), background = 0,0,0,
  and **overlap = 0,96,96** (start 0,128,0): green and blue both count there – the average colour (0, 0.5, 0.5) with
  alpha 1 - 0.5 · 0.5 = 0.75 over black. The blue quad's lower left corner now shows through the green quad (x 168..308,
  y 203..371). Both weights are clamped to 3000 here (the quads' depths are close to 1), so they count equally;
  ordinary blending sorted back to front would give 0,128,64 – weighted blended OIT approximates. This is the solution.
