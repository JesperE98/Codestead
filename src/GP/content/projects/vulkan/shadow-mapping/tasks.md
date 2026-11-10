# Shadow Mapping (Vulkan) – tasks

learnopengl "Shadow Mapping": `src/5.advanced_lighting/3.1.1.shadow_mapping_depth`, `3.1.2.shadow_mapping_base`,
`3.1.3.shadow_mapping`. Files: `main.cpp`, `textures/wood.png`, and in `shaders/` (each built to `<name>.spv`):
`shadow_mapping.vert/.frag` (the scene's lighting), `shadow_mapping_depth.vert` (the depth pass: a TODO) /
`shadow_mapping_depth.frag` (learnopengl's empty one: the depth pass writes no colour), `debug_quad.vert` (complete) and
`debug_quad_depth.frag` (main is a TODO).

Scene (learnopengl's): one vertex buffer with learnopengl's `planeVertices` (vertices 0..5: ±25 at y = -0.5, normal up,
texture coordinates 0..25 with `VK_SAMPLER_ADDRESS_MODE_REPEAT`) and the `renderCube()` cube (vertices 6..41: 2×2×2 with
normals and texture coordinates); v flipped (25 - v, 1 - v) as in the earlier chapters so the image is upright. The
draws are learnopengl's `renderScene()`: a helper `renderScene(VkCommandBuffer commandBuffer)` called from
`recordCommandBuffer()` that pushes each model matrix (`vkCmdPushConstants`, `struct PushConstants { glm::mat4 model; }`,
vertex stage) and draws the floor (`vkCmdDraw(commandBuffer, 6, 1, 0, 0)`) and three cubes (`vkCmdDraw(commandBuffer,
36, 1, 6, 0)`): (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5; (-1, 0, 2) rotated 60° about normalize(1, 0, 1), scale 0.25 –
all with `wood.png`. `lightPos` (-2, 4, -1) (a global). The camera globals at (0, 0, 3) looking down -z (yaw -90, pitch
0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on, no culling. Uniform buffer (binding 0, vertex +
fragment): `view`, `proj`, `viewPos` (+ `float pad1`), `lightPos` (+ `float pad2`) – std140 pads each vec3 to 16 bytes.
`shadow_mapping.frag` is learnopengl's: light colour 0.3, ambient 0.3 × light colour, diffuse, Blinn-Phong specular
(64), `lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color`.

Start: no shadows yet (`float shadow = 0.0;`), no depth map, no light-space matrix. TODOs in `main.cpp` (the depth map's
size, the debug quad's vertices, the render pass, the pipelines, the depth map and its sampler, the light-space matrix,
the depth pass in `recordCommandBuffer()`), in `shadow_mapping_depth.vert` and `debug_quad_depth.frag`, and in
`shadow_mapping.frag` (ShadowCalculation – for the `shadows` task).

**What the camera sees:** from (0, 0, 3) only the floating cube (0, 1.5, 0) is in view (top centre, seen from below), plus
the floor and the floating cube's shadow on it (lower right). The cubes at (2, 0, 1) and (-1, 0, 2) are just outside the
view (right and left of the camera, close to it); their shadows fall outside the view too. They appear in the depth map.

**Coordinates (Vulkan):** with `GLM_FORCE_DEPTH_ZERO_TO_ONE`, `glm::ortho` gives NDC z = 0..1 already – the same 0..1
the depth image stores – so `ShadowCalculation` maps only x and y: `projCoords.xy = projCoords.xy * 0.5 + 0.5;`
(OpenGL maps all three, its NDC z is -1..1). The y direction: the light's projection is used **without** the
`proj[1][1] *= -1` flip, in the depth pass and in the lookup alike. In the depth pass NDC y = -1 lands on the depth image's
row 0 (Vulkan's framebuffer y points down), and the lookup's v = y * 0.5 + 0.5 = 0 also reads row 0 – they agree, so no
flip is needed (verified on lavapipe: the shadows fall exactly where OpenGL's do). Only the **debug quad** needs care:
the depth map's row 0 holds the light's bottom, and the quad's top (NDC y = -1 in Vulkan) must show the light's top, so the
quad's texture coordinates are learnopengl's with v flipped (1 - v) – then the debug picture equals OpenGL's.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every
picture equals the OpenGL chapter's (the depth map exactly; the others within 1/255 at the points below, except at the
wood's dark seams). Named points (the same as OpenGL's): **background** (400,100) = 26,26,26; **cube0-bottom** (300,30)
= 15,11,6 (the floating cube's underside: ambient only, unchanged in every state except `depth-map`; (400,50) is on a
seam: 6,4,3); **floor-left** (200,450) and (330,520) (lit, never in shadow); **shadow-1** (650,450), **shadow-2**
(560,440), **shadow-3** (700,480) – inside the floating cube's shadow; **floor-right** (750,560) (lit, outside the
shadow).

**Start picture:** the wood floor lit evenly (dim: light colour 0.3) and the cube's underside at the top: floor-left
62,42,26 / 60,41,25, shadow-1 58,39,24, shadow-2 62,42,26, shadow-3 61,42,25 (no shadow yet), floor-right 57,39,24,
cube0-bottom 15,11,6, background 26,26,26.

## depth-map
- **Task:** Create the depth map – a 1024×1024 depth image that can be drawn into and sampled, with a render pass that has only a depth attachment, a framebuffer, a sampler and a depth-only pipeline – and record a first render pass every frame that draws the scene into it from the light's point of view; then show the depth map on a quad over the whole window with the debug shader (instead of the scene).
- **Hint:** `const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`. `createDepthMapRenderPass()`: one attachment with the format of `findDepthMapFormat()` (a depth format with `VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT`), loadOp CLEAR, storeOp **STORE**, finalLayout `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`, `colorAttachmentCount = 0` (learnopengl's `glDrawBuffer(GL_NONE)`), two subpass dependencies (the last frame's shader reads before the depth writes; the depth writes before this frame's shader reads). `createDepthMap()`: `createImage(SHADOW_WIDTH, SHADOW_HEIGHT, …, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, …)`, a view with `VK_IMAGE_ASPECT_DEPTH_BIT`, a framebuffer of 1024×1024. `createDepthMapSampler()`: `VK_FILTER_NEAREST`, `VK_SAMPLER_ADDRESS_MODE_REPEAT`. `createPipeline` gets `attributeCount`, `pipelineRenderPass` and `colorAttachmentCount` parameters (`colorBlending.attachmentCount = colorAttachmentCount;` must match the subpass). The descriptor set gets the depth map at binding 2 (image layout `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`). The light: `glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane)` (1.0, 7.5) times `glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0))` = `ubo.lightSpaceMatrix` (after `proj`; add `mat4 lightSpaceMatrix;` to the uniform block of `shadow_mapping.frag` too, so the members after it keep their offsets). Pass 1: `vkCmdBeginRenderPass` with `depthMapRenderPass` / `depthMapFramebuffer`, extent 1024×1024, one clear value (depth 1.0); `depthPipeline`; viewport and scissor 1024×1024 (learnopengl's `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)`); `renderScene(commandBuffer)`; end. Pass 2 (the window): the window's viewport again, `debugPipeline`, `vkCmdDraw(commandBuffer, 6, 1, 42, 0)`.
- **When done:** `main.cpp`: `SHADOW_WIDTH` / `SHADOW_HEIGHT` 1024; the debug quad (vertices 42..47); `glm::mat4
  lightSpaceMatrix` in `UniformBufferObject` (after `proj`), set in `updateUniformBuffer()` from `glm::ortho(-10.0f, 10.0f,
  -10.0f, 10.0f, near_plane, far_plane)` and `glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0))` without a
  y flip; `createDepthMapRenderPass()` (`vkCreateRenderPass(…, &depthMapRenderPass)`, one attachment, `finalLayout =
  VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`, `colorAttachmentCount = 0`); `createDepthMap()` (`depthMapImage` with
  `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`, 1024×1024, `depthMapImageView`,
  `vkCreateFramebuffer(…, &depthMapFramebuffer)`); `createDepthMapSampler()` (`VK_FILTER_NEAREST`, REPEAT); the
  pipelines `createPipeline("shaders/shadow_mapping.vert.spv", "shaders/shadow_mapping.frag.spv", 3, renderPass, 1,
  graphicsPipeline)`, `createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv",
  1, depthMapRenderPass, 0, depthPipeline)`, `createPipeline("shaders/debug_quad.vert.spv",
  "shaders/debug_quad_depth.frag.spv", 3, renderPass, 1, debugPipeline)`; descriptor binding 2 = the depth map; in
  `recordCommandBuffer()` two `vkCmdBeginRenderPass` – the first with `depthMapRenderPass`, `depthPipeline`, a 1024×1024
  viewport and `renderScene(commandBuffer)`, the second (the window) with `debugPipeline` and `vkCmdDraw(commandBuffer, 6,
  1, 42, 0)`; everything destroyed in `cleanup()`. `shadow_mapping_depth.vert`: `gl_Position = ubo.lightSpaceMatrix *
  pc.model * vec4(inPosition, 1.0);`. `debug_quad_depth.frag`: `float depthValue = texture(depthMap, fragTexCoord).r;
  outColor = vec4(vec3(depthValue), 1.0);`.
  The window shows the **depth map** (grey, stretched from 1024×1024 to 800×600): the floor as a vertical gradient –
  white at the top (far from the light; beyond the far plane nothing was drawn and the cleared depth 1.0 stays),
  (400,100) = 255,255,255, mid grey (200,300) = 163,163,163, dark towards the bottom (400,450) = 53,53,53, (400,505) =
  13,13,13, then a white band again (400,560) = 255,255,255 (in front of the near plane: clipped). The cubes: the
  floating cube **dark** (closest to the light) (398,275) = 68,68,68; the cube at (2, 0, 1) lighter than the floor
  around it (400,230) = 169,169,169 (floor next to it (330,230) = 214,214,214); the small rotated cube (488,300) =
  129,129,129. Grey everywhere (r = g = b) – identical to OpenGL's picture.

## shadows
- **Task:** Draw the scene with shadows (learnopengl 3.1.2): in the window's pass draw the scene again with `graphicsPipeline` (the debug quad's draw stays as a comment); pass the fragment's position in light space from the vertex shader (`lightSpaceMatrix`, `fragPosLightSpace`), give the fragment shader the depth map (`shadowMap`, binding 2) and a `ShadowCalculation` that compares the fragment's depth with the depth map's.
- **Hint:** Add `mat4 lightSpaceMatrix;` to the vertex shader's uniform block and `vec4 fragPosLightSpace;` to both `VS_OUT` blocks; `vs_out.fragPosLightSpace = ubo.lightSpaceMatrix * vec4(vs_out.fragPos, 1.0);`. `ShadowCalculation`: `vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w; projCoords.xy = projCoords.xy * 0.5 + 0.5;` (only x and y: z is 0..1 already), `float closestDepth = texture(shadowMap, projCoords.xy).r; float currentDepth = projCoords.z;`, `shadow = currentDepth > closestDepth ? 1.0 : 0.0`. The descriptor set bound for the depth pass stays bound in the second render pass (bindings are command buffer state).
- **When done:** `recordCommandBuffer()`: in the window's pass `vkCmdBindPipeline(…, graphicsPipeline)` and
  `renderScene(commandBuffer)`, the debug quad's two calls commented out. `shadow_mapping.vert`: `mat4 lightSpaceMatrix`
  in the block, `vec4 fragPosLightSpace;` in `VS_OUT`, `vs_out.fragPosLightSpace = ubo.lightSpaceMatrix *
  vec4(vs_out.fragPos, 1.0);`. `shadow_mapping.frag`: `layout(binding = 2) uniform sampler2D shadowMap;`, `vec4
  fragPosLightSpace;` in the block, `ShadowCalculation` (no bias) and `float shadow =
  ShadowCalculation(fs_in.fragPosLightSpace);`. The scene is back with the floating cube's **shadow** (lower right) and
  **shadow acne**: fine dark stripes (moiré rings) all over the lit floor. shadow-1 (650,450) 16,11,6, shadow-2
  (560,440) 16,11,7, shadow-3 (700,480) 17,11,7 (ambient only); acne: floor-left (200,450) 15,11,6 (on a stripe),
  floor-right (750,560) 16,11,7; the lit region x 0..330, y 340..600 has a mean luminance ≈ 28 (start ≈ 45) and ≈ 44,000
  pixels darker than 20 (start ≈ 2,100) – check the stripes this way, not with single points. (330,520) 60,41,25
  happens to be lit. Cube underside and background unchanged.

## bias
- **Task:** Remove the shadow acne with a bias that depends on the surface's slope towards the light: `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)`, subtracted from the fragment's depth before the comparison.
- **Hint:** `vec3 normal = normalize(fs_in.normal); vec3 lightDir = normalize(ubo.lightPos - fs_in.fragPos); float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);` then `shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;`. The depth map's texels are big compared with the screen's pixels: several fragments share one stored depth and half of them end up "behind" it.
- **When done:** `shadow_mapping.frag`: `float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);` and `float shadow
  = currentDepth - bias > closestDepth ? 1.0 : 0.0;`. **The stripes are gone**, the shadow stays (with hard, jagged
  edges): floor-left (200,450) 62,42,26, (330,520) 60,41,25, floor-right (750,560) 57,39,24 (lit again, as in the
  start); shadow-1/2/3 16,11,6 / 16,11,7 / 17,11,7; lit region mean luminance ≈ 45, ≈ 2,100 pixels darker than 20 (as
  the start: the wood's seams). Column 600: the shadow's top edge between rows 415 and 416 (62 → 16), its bottom edge
  between 482 and 483 (14 → 53) – a hard step.
  **Peter panning** (discussed, not a task): a bias makes shadows start a little away from the object's foot.
  learnopengl suggests culling front faces in the depth pass (in Vulkan: `rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT`
  in the depth pipeline, with `frontFace = VK_FRONT_FACE_CLOCKWISE`: the light's projection has no y flip, so the cube's
  counter-clockwise faces appear clockwise in Vulkan's framebuffer) – but that breaks for the floor, a single plane with
  no back side, the reason it is not used here.

## over-sampling
- **Task:** Stop over-sampling: outside the depth map nothing should be in shadow – the depth map's sampler clamps to a white border (depth 1.0) – and fragments farther than the light's far plane (`projCoords.z > 1.0`) are never in shadow.
- **Hint:** In `createDepthMapSampler()`: `addressModeU/V/W = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` and `samplerInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;` (Vulkan has a few fixed border colours instead of OpenGL's `GL_TEXTURE_BORDER_COLOR` array); in `ShadowCalculation` before `return`: `if (projCoords.z > 1.0) shadow = 0.0;`.
- **When done:** `main.cpp`: the depth map sampler's address modes `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` and
  `borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` (instead of REPEAT / `VK_BORDER_COLOR_INT_OPAQUE_BLACK`);
  `shadow_mapping.frag`: `if (projCoords.z > 1.0) shadow = 0.0;` before `return shadow;`.
  **From the default camera this changes almost nothing:** the regions outside the light's frustum lie far away near the
  horizon. Only a thin dark line on the far floor at the right edge changes: rows 317–319, x 705–799, e.g. (790,318)
  15,10,6 → 25,17,11 (as in OpenGL). Everything else is identical to `bias` (named points unchanged). Checked on lavapipe
  with a camera moved up and turned towards the far side of the light (cameraPos (-4, 14, -4), yaw 45, pitch -42.6):
  before this task the floor beyond the light's far plane (7.5) – a large region on the far side – is dark (in
  shadow), after it that floor is lit. So check the code (the border colour, `CLAMP_TO_BORDER`, the `projCoords.z > 1.0`
  test) rather than the picture.

## pcf
- **Task:** Soften the shadow's edges with percentage-closer filtering: average the comparison over the 3×3 depth map texels around the position (`textureSize` gives the texel size).
- **Hint:** `float shadow = 0.0; vec2 texelSize = 1.0 / textureSize(shadowMap, 0);` then two nested loops `for (int x = -1; x <= 1; ++x)` / `for (int y = -1; y <= 1; ++y)` with `float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;` and finally `shadow /= 9.0;`.
- **When done:** `shadow_mapping.frag` `ShadowCalculation`: learnopengl 3.1.3's PCF (`vec2 texelSize = 1.0 /
  textureSize(shadowMap, 0);`, the two nested `for` loops, `shadow /= 9.0;`; the single comparison commented out), the
  `projCoords.z > 1.0` test after it. The shadow's **edges become soft**: the inside and the lit floor stay the same
  (shadow-1/2/3 16,11,6 / 16,11,7 / 17,11,7, floor-left 62,42,26, floor-right 57,39,24), but the edge pixels get
  in-between values: column 600, top edge rows 414–416 = 63, 57, 26 → 15; bottom edge rows 481–484 = 27, 27, 40, 53
  (was 14, 14, 53, 53). In the box x 450..800, y 400..520 the pixels with red 20..49 go from ≈ 1,050 (bias) to ≈ 3,200,
  the fully dark ones (red < 20) from ≈ 22,100 to ≈ 20,900. This is the solution (learnopengl's `shadow_mapping.fs`).
