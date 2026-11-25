# Project: The glass pavilion – milestones (Vulkan)

The optional project after *Advanced OpenGL*. The start is the *Framebuffers* chapter's solution unchanged (offscreen
render pass and image, screen quad, `createPipeline(vert, frag, renderPass, depthTestEnable, pipeline)`, the
edge-detection kernel in `shaders/framebuffers_screen.frag`), plus `textures/skybox/`, `textures/window.png` and four
shader files with a TODO: `shaders/skybox.vert`, `shaders/skybox.frag`, `shaders/columns.vert`, `shaders/outline.frag`.
Checks as OpenGL's (`Checks/TaskChecks.Project.AdvancedOpenGL.ts`); the picture is the same. Every state from the
start to the solution builds and runs on lavapipe without a validation message (verify.sh).

## `vignette`
- **When done:** `framebuffers_screen.frag` samples `screenTexture` at `fragTexCoord` and multiplies it by
  `1.0 - smoothstep(0.4, 0.7, length(fragTexCoord - vec2(0.5)))`.

## `sky`
- **When done:** the 36 skybox vertices at 48..83 (position only, `{{x, y, z}}`); `skyboxPipeline`, the cube map
  (`loadCubemap` from *Cubemaps*), `cubemapSampler` (CLAMP_TO_EDGE), `skyboxDescriptorSet` (pool: 4 sets); the helper
  becomes `createPipeline(vert, frag, renderPass, attributeCount, depthTestEnable, depthCompareOp, pipeline)` (the sky
  reads one attribute – two would give the layer's "attribute not consumed" warning – and compares LESS_OR_EQUAL);
  the sky drawn after the floor; `skybox.vert` with `pos.xyww`; cleanup.

## `columns`
- **When done:** `columns.vert` with `gl_InstanceIndex`; `columnPipeline` (`columns.vert` + `framebuffers.frag`);
  `vkCmdDraw(commandBuffer, 36, 5, 0, 0)` with the marble's descriptor set before the sky.

## `outline`
- **When done:** `findDepthFormat` only `{D32_SFLOAT_S8_UINT, D24_UNORM_S8_UINT}`, both depth views with
  `DEPTH | STENCIL` aspects, the offscreen pass's `stencilLoadOp = CLEAR`; the helper gets `stencilCompareOp` and
  `stencilWriteMask` (stencil test on, REPLACE on pass, reference 1, back = front); `selectedPipeline` (ALWAYS, 0xFF)
  bound for cube 0 only; `outlinePipeline` (`framebuffers.vert` + `outline.frag`, no depth test, NOT_EQUAL, 0x00) drawn
  after the sky with the cube scaled 1.1.

## `glass`
- **When done:** the glass quad's vertices at 84..89 (v = 0 at the top), `loadTexture("textures/window.png", …)`,
  `glassDescriptorSet` (pool: 5 sets), the helper's `blendEnable` (SRC_ALPHA / ONE_MINUS_SRC_ALPHA, ADD),
  `glassPipeline` drawn last in the offscreen pass at `translate(0.3, 0, -0.2)`.
