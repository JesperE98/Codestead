# Point Shadows (Vulkan) – tasks

learnopengl "Point Shadows": `src/5.advanced_lighting/3.2.1.point_shadows`, `3.2.2.point_shadows_soft`. Files: `main.cpp`,
`textures/wood.png`, and in `shaders/` (each built to `<name>.spv`): `point_shadows.vert/.frag` (the scene's lighting),
`point_shadows_depth.vert`, `point_shadows_depth.geom`, `point_shadows_depth.frag` (the depth pass – TODO stubs in the
start that compile but do nothing).

Scene (learnopengl's): one vertex buffer with the `renderCube()` cube (36 vertices with normals and texture coordinates,
v flipped (1 - v) as in the earlier chapters so the image is upright). The draws are learnopengl's `renderScene()`: a
helper `renderScene(VkCommandBuffer commandBuffer)` called from `recordCommandBuffer()` that pushes each draw's values
(`vkCmdPushConstants`, `struct PushConstants { glm::mat4 model; VkBool32 reverse_normals; }`, vertex stage) and draws the
cube (`vkCmdDraw(commandBuffer, 36, 1, 0, 0)`) six times: the **room** (scale 5, `reverse_normals = VK_TRUE` – the
normals turned around so the inside is lit, learnopengl's "small little hack"), then five cubes with
`reverse_normals = VK_FALSE`: (4, -3.5, 0) scale 0.5; (2, 3, 1) scale 0.75; (-3, -1, 0) scale 0.5; (-1.5, 1, 1.5) scale
0.5; (-1.5, 2, -3) rotated 60° about normalize(1, 0, 1), scale 0.75 – all with `wood.png`. `lightPos` (0, 0, 0) (a global,
the middle of the room). learnopengl moves the light with `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`; here it stays
still so the picture does not change (try the line in `updateUniformBuffer()` if you like – the shadows then sweep over
the walls). learnopengl's shadow toggle (Space, `shadows` uniform) is left out: no input. Camera globals at (0, 0, 3)
looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1) (hidden: the room fills the
window), depth test on. **Culling:** learnopengl culls back faces but turns culling off for the room (seen from the
inside); here every pipeline has `cullMode = VK_CULL_MODE_NONE` – for the closed cubes that gives the same picture and
avoids a second pipeline only for the room. Uniform buffer (binding 0): `view`, `proj`, `viewPos` (+ `float pad1`),
`lightPos` (+ `float pad2`) – std140 pads each vec3 to 16 bytes. `point_shadows.frag` is learnopengl's: light colour 0.3,
ambient 0.3 × light colour, diffuse, Blinn-Phong specular (64), `lighting = (ambient + (1.0 - shadow) * (diffuse +
specular)) * color`. The `createPipeline` helper takes an optional geometry shader (`""` = none), the number of vertex
attributes the vertex shader reads, the render pass and its number of colour attachments (as in Geometry Shader and
Shadow Mapping).

Start: no shadows yet (`float shadow = 0.0;`), no depth cube map. TODOs in `main.cpp` (the face size, `far_plane` and
`shadowMatrices` in the uniform buffer, the render pass, the depth pipeline, the depth cube map and its sampler, the
matrices in `updateUniformBuffer()`, the depth pass in `recordCommandBuffer()`), in the three depth shaders, and in
`point_shadows.frag` (`ShadowCalculation` – for the `shadows` task).

**What the camera sees:** from (0, 0, 3) the back wall (z = -5) fills the window – the wood stretched over the 10 × 10
wall, with dark seams – with a soft highlight a little left of the centre, and only one of the five cubes: the rotated
one at (-1.5, 2, -3), in the top-left corner (in the very corner, x 0..40, y 0..110, an edge of the cube at
(-1.5, 1, 1.5) next to the camera). Light and camera are almost on one line, so the cube hides most of its own shadow:
the shadow shows as a dark band on the wall around the cube's upper-left edge (x 38..110, y 0..100), a thin line along
its lower-left edge and a small piece right of its top corner (x ≈ 300..350, y 0..40). The other four cubes and their
shadows (on the side walls, floor and ceiling) are outside the view.

**Cube map directions (all APIs the same):** the six faces' views are learnopengl's: targets +x, -x, +y, -y, +z, -z with
ups (0, -1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0), and gl_Layer = face index = the order of the
cube map's layers (+X, -X, +Y, -Y, +Z, -Z). These ups come from how cube-map lookups pick a face and the (s, t)
position on it – a table that is the same in OpenGL, Vulkan and Direct3D, with t growing downwards on each face, hence the
"upside-down" (0, -1, 0). **No y flip** in `shadowProj` (no `[1][1] *= -1`): in the depth pass NDC y = -1 lands on each
layer's row 0 (Vulkan's framebuffer y points down) – exactly the row OpenGL writes NDC y = -1 to (its window y points
up, but its row 0 is the bottom, y = -1). So the layers hold the same texels in both APIs, and the same `texture(depthMap,
fragToLight)` reads them – verified on lavapipe: the depth cube map picture and the shadows equal OpenGL's pixel for
pixel. The depth range (`GLM_FORCE_DEPTH_ZERO_TO_ONE`) does not matter here: the depth pass writes its own depth,
`distance / far_plane`, with `gl_FragDepth`; the near plane 1.0 clips the same in both APIs. No culling, so the winding
does not matter either.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every
picture equals the OpenGL chapter's (mean difference ≤ 0.11/255; the depth cube map view identical; every named point
below within 1/255 of OpenGL's). Named points (the same as OpenGL's): **wall-centre** (350,300) = 117,80,49 (in the
highlight); **seam** (400,300) = 47,32,19; **wall-right** (700,450) = 61,42,25; **wall-left** (100,500) = 60,41,25;
**wall-top-right** (750,50) = 54,37,22; **cube-face** (150,100) = 69,47,29 (the rotated cube's lit face); **shadow-1**
(60,40), **shadow-2** (50,80), **shadow-3** (330,15) – on the wall where the cube's shadow falls; **edge-1** (150,160),
**edge-2** (120,150) – at the shadow's lower edge.

**Start picture:** the room lit, no shadows: shadow-1 = 56,38,23, shadow-2 = 51,35,21, shadow-3 = 61,41,25, edge-1 =
55,38,23, edge-2 = 57,39,24; the other named points as above. In the box x 0..360, y 0..200, ≈ 4,975 pixels have red < 20
(the cube's dark faces and seams; OpenGL 4,751 – rasterisation details at the edges).

## depth-cubemap
- **Task:** Create the depth cube map – one depth image with six 1024×1024 layers, viewable as a cube map – with a depth-only render pass, a framebuffer with six layers, a sampler and a depth pipeline whose geometry shader draws every triangle into all six faces (`gl_Layer`), storing each fragment's distance to the light divided by `far_plane`; record that pass every frame before the window's, and show the cube map: the fragment shader outputs the stored distance in the direction from the light to the fragment, as grey.
- **Hint:** `const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`. Uniform buffer: `float far_plane;` in place of `pad2` (it fills the 4 bytes after the vec3 `lightPos`) and `glm::mat4 shadowMatrices[6];` after it (std140: a mat4 array starts at a multiple of 16 – offset 160). `updateUniformBuffer()`: `glm::perspective(glm::radians(90.0f), (float) SHADOW_WIDTH / (float) SHADOW_HEIGHT, near_plane, far_plane)` (1.0, 25.0) times learnopengl's six `glm::lookAt(lightPos, lightPos + direction, up)` – **without** a y flip – and `ubo.far_plane`. `createDepthMapRenderPass()` as in Shadow Mapping (one depth attachment, `findDepthMapFormat()`, storeOp STORE, finalLayout `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`, `colorAttachmentCount = 0`, the two dependencies). `createDepthCubemap()`: `VkImageCreateInfo` with `flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, `arrayLayers = 6`, usage `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`; a view with `VK_IMAGE_VIEW_TYPE_CUBE`, depth aspect, `layerCount = 6` – used both for sampling and as the framebuffer's attachment; the framebuffer with `layers = 6` (a layered framebuffer: learnopengl's `glFramebufferTexture`). `createDepthCubemapSampler()`: `VK_FILTER_NEAREST`, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`. The geometry shader needs the device feature: `deviceFeatures.geometryShader = VK_TRUE` (and check `supportedFeatures.geometryShader` in `isDeviceSuitable`); the uniform buffer's stages get `VK_SHADER_STAGE_GEOMETRY_BIT`. Descriptor binding 2 = the cube map (`samplerCube depthMap`, image layout `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`; the pool gets 2 image samplers). The depth pipeline: `createPipeline("shaders/point_shadows_depth.vert.spv", "shaders/point_shadows_depth.frag.spv", "shaders/point_shadows_depth.geom.spv", 1, depthMapRenderPass, 0, depthPipeline)`. Shaders: `.vert` `gl_Position = pc.model * vec4(inPosition, 1.0);` (world space); `.geom` learnopengl's loop – for each face `gl_Layer = face;`, for each vertex `fragPos = gl_in[i].gl_Position; gl_Position = ubo.shadowMatrices[face] * fragPos; EmitVertex();`, then `EndPrimitive();` (`layout(triangles) in; layout(triangle_strip, max_vertices = 18) out;`); `.frag` `gl_FragDepth = length(fragPos.xyz - ubo.lightPos) / ubo.far_plane;`. Each shader declares the uniform block up to the last member it reads, so the offsets match the C++ struct. In `point_shadows.frag` add `float far_plane;` to the block and `layout(binding = 2) uniform samplerCube depthMap;`, and replace the output with the debug view: `vec3 fragToLight = fs_in.fragPos - ubo.lightPos; float closestDepth = texture(depthMap, fragToLight).r; outColor = vec4(vec3(closestDepth), 1.0);`.
- **When done:** `main.cpp`: `SHADOW_WIDTH` / `SHADOW_HEIGHT` 1024; `float far_plane` and `glm::mat4 shadowMatrices[6]` in
  `UniformBufferObject`, set in `updateUniformBuffer()` (`shadowProj` = `glm::perspective(glm::radians(90.0f), …, 1.0f,
  25.0f)`, six `ubo.shadowMatrices[i] = shadowProj * glm::lookAt(lightPos, lightPos + …, …)`, `ubo.far_plane =
  far_plane`); `createDepthMapRenderPass()` (`vkCreateRenderPass(…, &depthMapRenderPass)`, one depth attachment,
  `colorAttachmentCount = 0`); `createDepthCubemap()` (`depthCubemapImage` with `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`,
  `arrayLayers = 6`, `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`; `depthCubemapImageView`
  with `VK_IMAGE_VIEW_TYPE_CUBE`, `layerCount = 6`; `vkCreateFramebuffer(…, &depthMapFramebuffer)` with `layers = 6`);
  `createDepthCubemapSampler()` (`VK_FILTER_NEAREST`, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`); `findDepthMapFormat()`;
  `deviceFeatures.geometryShader = VK_TRUE`; the UBO binding's stages include `VK_SHADER_STAGE_GEOMETRY_BIT`; descriptor
  binding 2 = the depth cube map; the depth pipeline with the three `point_shadows_depth` shaders, 1 attribute,
  `depthMapRenderPass`, 0 colour attachments; in `recordCommandBuffer()` – after binding the vertex buffer and the
  descriptor set – a first `vkCmdBeginRenderPass` with `depthMapRenderPass` / `depthMapFramebuffer`, extent 1024×1024, one
  clear value (depth 1.0), `depthPipeline`, a 1024×1024 viewport and scissor, `renderScene(commandBuffer)`, end; then the
  window's pass as before; everything destroyed in `cleanup()`. The window shows the **depth cube map seen from the camera** – grey everywhere (r = g = b, 15..84), dark: the wall
  is 5–8.7 units from the light, 0.2–0.35 of far_plane. seam/centre (400,300) = 51,51,51 (distance 5 → 0.2 × 255),
  (400,20) = 60,60,60, (20,300) = 67,67,67, wall-right (700,450) = 64,64,64, wall-left (100,500) = 65,65,65,
  wall-top-right (750,50) = 70,70,70, (780,580) = 74,74,74 (the corner, farthest); wall-centre (350,300) = 51,51,51. The
  cube is darker (closer to the light): cube-face (150,100) = 34,34,34. **The shadow shows here too:** where the cube
  hides the wall from the light, the cube map holds the cube's distance: shadow-1 (60,40) = 34,34,34, shadow-2 (50,80) =
  35,35,35, shadow-3 (330,15) = 32,32,32, edge-1 (150,160) = 35,35,35, while the wall next to it is lighter: edge-2
  (120,150) = 62,62,62. No wood texture, no lighting. Identical to OpenGL's picture.

## shadows
- **Task:** Draw the scene lit again with shadows (learnopengl 3.2.1): `ShadowCalculation(fragPos)` samples the cube map with the vector from the light to the fragment, turns the stored 0..1 back into a distance (`closestDepth *= far_plane`), and compares it with the fragment's own distance to the light, with a bias of 0.05.
- **Hint:** `vec3 fragToLight = fragPos - ubo.lightPos; float closestDepth = texture(depthMap, fragToLight).r; closestDepth *= ubo.far_plane; float currentDepth = length(fragToLight); float bias = 0.05; float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;` – no projection and no texture coordinates: the direction picks the face and the texel. In `main()`: `float shadow = ShadowCalculation(fs_in.fragPos);` and `outColor = vec4(lighting, 1.0);` again (the debug view goes, it stays as a comment in `ShadowCalculation`).
- **When done:** `point_shadows.frag`: `float ShadowCalculation(vec3 fragPos)` (learnopengl's, `closestDepth *=
  ubo.far_plane`, `bias = 0.05`), `float shadow = ShadowCalculation(fs_in.fragPos);`, `outColor = vec4(lighting, 1.0);`
  without the debug lines. The lit room is back with the cube's **shadow** on the back wall: shadow-1 (60,40) = 16,11,7, shadow-2 (50,80) =
  15,10,6, shadow-3 (330,15) = 16,11,7, edge-1 (150,160) = 14,10,6 (ambient only: 0.09 × the wood); edge-2 (120,150) =
  57,39,24 (lit, just outside the shadow); all other named points as in the start (wall-centre 117,80,49, seam 47,32,19,
  wall-right 61,42,25, wall-left 60,41,25, wall-top-right 54,37,22, cube-face 69,47,29). About 7,100 pixels change
  against the start, all inside x 38..351, y 0..196. In the box x 0..360, y 0..200, ≈ 12,080 pixels have red < 20
  (start ≈ 4,975). Hard, jagged edges (one cube map texel per sample); no shadow acne (the bias in world units covers
  the depth texels).

## pcf
- **Task:** Soften the shadow's edges (learnopengl 3.2.2): average 20 comparisons in directions around `fragToLight` – learnopengl's `gridSamplingDisk` offsets – scaled by a disk radius that grows with the distance to the viewer, with a bias of 0.15.
- **Hint:** The global array `vec3 gridSamplingDisk[20] = vec3[](…)` (learnopengl's 20 offsets). In `ShadowCalculation`: `float shadow = 0.0; float bias = 0.15; int samples = 20; float viewDistance = length(ubo.viewPos - fragPos); float diskRadius = (1.0 + (viewDistance / ubo.far_plane)) / 25.0;` then `for (int i = 0; i < samples; ++i)` sample `texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r`, multiply by `ubo.far_plane`, `if (currentDepth - bias > closestDepth) shadow += 1.0;`; at the end `shadow /= float(samples);`. (learnopengl's first attempt, 4 × 4 × 4 = 64 samples in a cube of offsets, is mostly redundant – the disk of 20 directions perpendicular-ish to `fragToLight` does the same with fewer samples.)
- **When done:** `point_shadows.frag`: `gridSamplingDisk[20]`, `ShadowCalculation` with the 20-sample loop (`bias = 0.15`,
  `diskRadius = (1.0 + (viewDistance / ubo.far_plane)) / 25.0`, `shadow /= float(samples)`). The shadow's **edges become soft**, its inside stays: shadow-1/2/3 = 16,11,7 / 15,10,6 / 16,11,7; edge-1 (150,160) =
  21,14,9 (was 14,10,6), edge-2 (120,150) = 51,35,21 (was 57,39,24). About 3,800 pixels change against `shadows`, all at
  the shadow's edges (x 38..357, y 0..202); in the box x 0..360, y 0..200 the pixels with red < 20 go from ≈ 12,080 to
  ≈ 10,545, those with red 20..49 from ≈ 5,416 to ≈ 7,990. The rest of the picture is unchanged. This is the solution
  (learnopengl's `3.2.2.point_shadows.fs`, without the `shadows` toggle).

Simulator (checked with the app's simulator, `Simulator.Build` + `Rasterizer.Render`): the start matches lavapipe
(mean difference 0.01). From `depth-cubemap` on it does not: the debug view is black everywhere (lavapipe: grey 15..84)
and in `shadows` / `pcf` everything is in shadow (seam (400,300) 6,4,3 instead of 47,32,19) – sampling the cube view of the
rendered depth image returns 0 (the reader's cube textures come only from uploaded layer images, not from a layered depth
render target: the 6-layer framebuffer, `gl_Layer` routing and `gl_FragDepth` of the depth pass are not connected to the
`samplerCube` lookup).
