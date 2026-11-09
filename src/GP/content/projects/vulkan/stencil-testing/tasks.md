# Stencil Testing (Vulkan) – outlining the cubes (learnopengl "Stencil testing")

learnopengl `2.stencil_testing`. Files: `main.cpp`, `shaders/stencil_testing.vert` / `.frag`,
`shaders/stencil_single_color.frag` (a TODO at the start; the outline pipeline reuses `stencil_testing.vert`),
`textures/marble.png`, `textures/metal.png`.

Start: the Depth Testing scene (see that chapter's tasks.md: one vertex buffer, one descriptor set per texture with the
UBO at binding 0 and the texture at binding 1, `createPipeline(vertFile, fragFile, pipeline)`, depth LESS), drawn in
learnopengl's stencil order: **floor first**, then cube 0 and cube 1. The depth buffer has no stencil part yet
(`findDepthFormat()` prefers `VK_FORMAT_D32_SFLOAT`).

Pixels measured on lavapipe, 800×600, nothing depends on time. Start = the Depth Testing start: **background**
(400,100) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138, (150,250) ≈ 208,204,194; **cube 1** (760,250) ≈
163,161,156; **floor-near** (100,500) ≈ 137,141,147, **floor-far** (600,370) ≈ 130,134,140. Outline points before
`outline`: **ring-left** (82,300), **ring-right** (323,300), **ring-top** (193,190), **ring-cube1** (702,300) = 26,26,26
(background); **ring-bottom** (193,408) ≈ 174,178,184 (floor).

## stencil-buffer
- **Task:** Give the depth image a stencil part and switch the stencil test on: `findDepthFormat()` candidates
  `{VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT}`, the depth image view with
  `VK_IMAGE_ASPECT_DEPTH_BIT | VK_IMAGE_ASPECT_STENCIL_BIT`, `depthAttachment.stencilLoadOp =
  VK_ATTACHMENT_LOAD_OP_CLEAR` (the clear value `depthStencil = {1.0f, 0}` clears it to 0), and in `createPipeline()`
  `depthStencil.stencilTestEnable = VK_TRUE` with `front.failOp = KEEP`, `front.depthFailOp = KEEP`, `front.passOp =
  REPLACE`, `front.compareOp = ALWAYS`, `compareMask = 0xFF`, `writeMask = 0xFF`, `reference = 1`,
  `depthStencil.back = depthStencil.front`.
- **Hint:** OpenGL's `glEnable(GL_STENCIL_TEST)`, `glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE)` and
  `GL_STENCIL_BUFFER_BIT` in glClear. `findSupportedFormat` picks the first candidate the GPU supports (lavapipe:
  D32_SFLOAT_S8_UINT; D24_UNORM_S8_UINT is the common alternative). The stencil state lives in the pipeline, for front
  and back faces separately.
- **When done:** no visible change (every draw passes the stencil test and writes 1). All points as at the start.

## single-color
- **Task:** Write the outline's fragment shader `shaders/stencil_single_color.frag`:
  `outColor = vec4(0.04, 0.28, 0.26, 1.0);`.
- **Hint:** learnopengl's `stencil_single_color.fs`: one colour, no texture.
- **When done:** no visible change yet (no pipeline uses the shader). The shader writes (0.04, 0.28, 0.26, 1.0).

## write-stencil
- **Task:** Give `createPipeline()` two parameters, `VkCompareOp stencilCompareOp, uint32_t stencilWriteMask`
  (assigned to `depthStencil.front.compareOp` and `.writeMask`); create `floorPipeline` with
  `(VK_COMPARE_OP_ALWAYS, 0x00)` and `graphicsPipeline` with `(VK_COMPARE_OP_ALWAYS, 0xFF)` (destroy both in
  `cleanup()`); in `recordCommandBuffer()` bind `floorPipeline` for the floor and `graphicsPipeline` before the cubes.
- **Hint:** A write mask of 0x00 is OpenGL's `glStencilMask(0x00)`: the floor passes the test but writes nothing; the
  cubes write the reference value 1 wherever they are drawn (`glStencilFunc(GL_ALWAYS, 1, 0xFF)`, `glStencilMask(0xFF)`).
- **When done:** no visible change; the stencil buffer holds 1 where the cubes are drawn, 0 elsewhere (also under the
  floor). Two pipelines bound: floor with write mask 0x00, cubes with 0xFF.

## outline
- **Task:** Add a `VkBool32 depthTestEnable` parameter (assigned to `depthTestEnable` and `depthWriteEnable`; VK_TRUE
  for the two pipelines), create `outlinePipeline` from `stencil_testing.vert` + `stencil_single_color.frag` with
  `(VK_FALSE, VK_COMPARE_OP_NOT_EQUAL, 0x00)` (destroy it in `cleanup()`), and after the cubes bind it and draw both
  cubes again scaled by `1.1f` (`model = glm::scale(model, glm::vec3(scale, scale, scale))` after the translate).
- **Hint:** The bigger cubes pass the stencil test only where the stencil value is not 1 – around the cubes – and with
  the depth test off the outline shows even over the floor. Nothing has to be restored afterwards: each pipeline
  carries its own depth and stencil state (OpenGL needs `glStencilMask(0xFF)`, `glStencilFunc(GL_ALWAYS, 0, 0xFF)`,
  `glEnable(GL_DEPTH_TEST)` again).
- **When done:** a teal ring (10,71,66) = (0.04, 0.28, 0.26) around each cube: **ring-left** (82,300), **ring-right**
  (323,300), **ring-top** (193,190), **ring-bottom** (193,408) (over the floor) and **ring-cube1** (702,300) =
  10,71,66; the cubes themselves unchanged (**cube0-centre** (193,300) ≈ 141,140,138, (760,250) ≈ 163,161,156), floor
  and background unchanged. Five draws: floor, two cubes, two outlines.
