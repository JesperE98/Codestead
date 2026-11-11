# Tessellation (GPU) (Vulkan) – tasks

learnopengl "Guest Articles / Tessellation / Tessellation": `src/8.guest/2021/3.tessellation/terrain_gpu_dist/main.cpp`
with `8.3.gpuheight.vs/.tcs/.tes/.fs`. Files: `main.cpp`, `textures/heightmap.png`, and in `shaders/`: `cpuheight.vert/.frag`
(the start's CPU shaders, unused once the CPU grid is gone – the edits cannot delete files) and `gpuheight.vert`,
`gpuheight.tesc` (tessellation control), `gpuheight.tese` (tessellation evaluation), `gpuheight.frag` – built to
`gpuheight.vert.spv`, `.tesc.spv`, `.tese.spv`, `.frag.spv` (verify.sh compiles `.tesc` / `.tese` like the other stages).

**Start = the solution of `tessellation-height-map`** (the CPU terrain: `main.cpp` unchanged), with the GPU shader files
added: `gpuheight.vert` and `gpuheight.frag` complete, `gpuheight.tesc` passing the control points through with every
level 1 (a TODO), `gpuheight.tese` a TODO that compiles. The tasks replace the CPU grid by patches the GPU tessellates.

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API, see `../../opengl/tessellation/tasks.md`):**
- Height map, orientation, heights, colour, camera (0, 190, 290) with pitch -35, projection (near 0.1, far 1000), clear
  colour: exactly as in `tessellation-height-map`.
- **The tessellation feature** (task `tessellation-feature`, OpenGL's `opengl-4-1`): Vulkan has no versions to ask
  for; tessellation shaders are an optional **device feature**: `deviceFeatures.tessellationShader = VK_TRUE` in
  `createLogicalDevice()` and `supportedFeatures.tessellationShader` checked in `isDeviceSuitable()`. The largest level
  is a device limit: `VkPhysicalDeviceLimits::maxTessellationGenerationLevel` (`printTessellationLimits()` prints
  `Max available tess level: 64` on lavapipe, like Mesa's OpenGL; NVIDIA and AMD say 64 too).
- **The height map as a texture**: loaded with `stbi_load(path, …, STBI_grey)` (one channel) into a
  **`VK_FORMAT_R8_UNORM`** image through a staging buffer (`createTextureImage`: 1 byte per texel), not flipped, read as
  `.r` in the evaluation shader. Sampler: linear, **clamp to edge** (OpenGL's `GL_CLAMP_TO_EDGE`), **no mipmaps and no
  anisotropy**: OpenGL generates mipmaps, but outside the fragment shader `texture()` has no screen-space derivatives
  and reads level 0, so they would never be used. Binding 1 of the descriptor set (stage `TESSELLATION_EVALUATION`).
- **Patches** (learnopengl's): `rez = 20` → 20 × 20 patches of **4 control points** (`NUM_PATCH_PTS = 4`), 1,600
  vertices (`struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }`, locations 0 and 1), corners in learnopengl's order
  `(x_i, z_j), (x_i+1, z_j), (x_i, z_j+1), (x_i+1, z_j+1)`, y = 0, texture coordinates `(i / rez, j / rez)` …, filled in
  `loadHeightMap()` after the texture (learnopengl's order: the texture's width and height size the grid).
- **The pipeline** (task `tess-evaluation`): `createPipeline(vert, tesc, tese, frag, pipeline)` with four stages
  (`VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT`, `..._EVALUATION_BIT`), `inputAssembly.topology =
  VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` (OpenGL's `GL_PATCHES`) and **`VkPipelineTessellationStateCreateInfo` with
  `patchControlPoints = NUM_PATCH_PTS`** (OpenGL's `glPatchParameteri(GL_PATCH_VERTICES, 4)` – in Vulkan it is part of the
  pipeline, so it comes with the pipeline in this task, not with the vertices in `patch-grid`); drawn with
  `vkCmdDraw(commandBuffer, NUM_PATCH_PTS * rez * rez, 1, 0, 0)`. The uniform buffer (view, projection) and the push
  constant (model) move from the vertex stage to the control and evaluation stages.
- **Vulkan always needs both tessellation stages**: OpenGL can run a program with only an evaluation shader (default
  levels 1); a Vulkan pipeline with tessellation must have a control and an evaluation shader. So the start's
  `gpuheight.tesc` writes level 1 everywhere (OpenGL's start does the same), and `tess-evaluation` builds the pipeline
  with it: the same coarse terrain as OpenGL's.
- **Tessellation coordinates**: Vulkan's tessellator places `gl_TessCoord` like OpenGL's (u along the first edge, v
  along the second, `layout(quads, fractional_odd_spacing, ccw) in;`); the winding is irrelevant without culling. Not
  mirrored: lavapipe's picture is OpenGL's.
- **Control levels**: first (task `tess-control`) all four outer and both inner levels **8**; then (task
  `distance-levels`) learnopengl's distance-based levels with the course's numbers: `MIN_TESS_LEVEL = 2`,
  `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450` (learnopengl: 4, 64, 20, 800 for its 2.6 k map).
- **Wireframe** (task `wireframe`): `rasterizer.polygonMode = VK_POLYGON_MODE_LINE` with the **`fillModeNonSolid`**
  device feature (enabled and checked like `tessellationShader`). The solution ends in wireframe.
- **The vertex attributes**: the `patch-grid` task adds `texCoord` to `Vertex`, but its attribute description (location 1)
  comes with the new pipeline in `tess-evaluation`: until then the CPU pipeline's vertex shader has only location 0, and
  the validation layer warns about an attribute the shader does not read.
- **No vertex buffer while there are no vertices** (`height-texture` → `patch-grid`): Vulkan cannot create a buffer of
  size 0, so `height-texture` removes the `createVertexBuffer()` call (a TODO) and `patch-grid` brings it back;
  `vertexBuffer` starts as `VK_NULL_HANDLE`, which `cleanup()` may destroy.

**What the camera sees** (lavapipe, 800×600): the terrain of `tessellation-height-map`. Named points (OpenGL's): **peak**
(420,110), **ridge** (230,150), **centre** (400,300), **hill** (150,380), **valley** (380,440), **lake** (580,390),
**front** (600,470), **background** (400,40), **below** (400,560); for the wireframe the **front box** (x 300…499,
y 400…449) and the **back box** (x 250…449, y 150…199). Every solid state is OpenGL's picture exactly (0–1 pixel
differs); the wireframe lines are rasterized a little differently (about 1.4 % of the pixels, the lines a little
denser on lavapipe – compare the boxes' share of line pixels, not single pixels).

**Start picture** (= the solution of `tessellation-height-map`): peak = 212,212,212, ridge = 144,144,144, centre =
91,91,91, hill = 102,102,102, valley = 88,88,88, lake = 28,28,28, front = 66,66,66, background = below = 26,26,26.

Note for checks: lavapipe tessellates on the CPU; the screenshots were taken after 6 s (`VERIFY_WAIT=6`).

## `tessellation-feature`
- **Task:** Turn on the GPU's tessellation stages – an optional device feature in Vulkan – and only accept a GPU that has them; print the largest tessellation level the GPU supports.
- **Hint:** `deviceFeatures.tessellationShader = VK_TRUE;` in `createLogicalDevice()`; in `isDeviceSuitable()` `vkGetPhysicalDeviceFeatures(device, &supportedFeatures)` and `&& supportedFeatures.tessellationShader`. `printTessellationLimits()` (called after `pickPhysicalDevice()`): `properties.limits.maxTessellationGenerationLevel` from `vkGetPhysicalDeviceProperties`.
- **When done:** `main.cpp`: `deviceFeatures.tessellationShader = VK_TRUE`, the feature check, `printTessellationLimits()`
  and its call; prints `Max available tess level: 64`. The CPU terrain is still drawn: **no visible change** (the start
  picture).

## `height-texture`
- **Task:** The GPU will read the heights itself: `loadHeightMap()` now loads the height map into a texture (one channel, `VK_FORMAT_R8_UNORM`) with a clamping sampler at binding 1 of the descriptor set. Remove the CPU grid – its vertices, indices, index buffer and the strip drawing – and, until there are patches, the vertex buffer.
- **Hint:** `stbi_load(path, &width, &height, &nrChannels, STBI_grey)`, `createTextureImage(data, width, height, heightMapImage, heightMapImageMemory)` (a staging buffer of `width * height` bytes, `VK_FORMAT_R8_UNORM`), `createImageView(heightMapImage, VK_FORMAT_R8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT)`, `stbi_image_free(data)`. `createTextureSampler()`: linear, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`. Binding 1: `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`, `VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT`; the pool gets one combined image sampler, the set a second write. Destroy the sampler, view, image and memory in `cleanup()`.
- **When done:** `main.cpp`: `heightMapImage` / `…Memory` / `…View`, `textureSampler`, `createTextureImage`,
  `copyBufferToImage`, `transitionImageLayout`, `createTextureSampler`, binding 1 in the layout, pool and set; no
  `indices`, `numStrips`, `numTrisPerStrip`, `indexBuffer`, `createIndexBuffer`, strip loop or `createVertexBuffer()`
  call. Nothing is drawn: **only the clear colour** (all named points 26,26,26).

## `patch-grid`
- **Task:** Build the patches: a grid of 20 × 20 flat squares, each given as its 4 corners (a patch of 4 control points) with a position (y = 0) and a texture coordinate, and create the vertex buffer from them.
- **Hint:** `glm::vec2 texCoord;` in `Vertex`; `const unsigned int NUM_PATCH_PTS = 4;` and `const unsigned int rez = 20;`. learnopengl's loop over `i` and `j` (0 … rez - 1) pushes the corners (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1): x = `-width / 2.0f + width * i / (float) rez`, z = `-height / 2.0f + height * j / (float) rez`, texture coordinate `(i / (float) rez, j / (float) rez)`. Then `createVertexBuffer();` in `initVulkan()`.
- **When done:** `main.cpp`: `texCoord` in `Vertex`, `NUM_PATCH_PTS`, `rez`, the 1,600 vertices, the prints (`Loaded 400
  patches of 4 control points each`, `Processing 1600 vertices in vertex shader`), `createVertexBuffer();`. Still nothing
  drawn: **only the clear colour**.

## `tess-evaluation`
- **Task:** Write the tessellation evaluation shader: for each vertex the tessellator makes (at `gl_TessCoord` u, v inside the patch) interpolate the corners' texture coordinates and positions bilinearly, read the height from the height map, move the point up by it, and project it. Build the pipeline from all four stages – patches of 4 control points – and draw the patches.
- **Hint:** `layout(quads, fractional_odd_spacing, ccw) in;`; `t0 = (t01 - t00) * u + t00; t1 = (t11 - t10) * u + t10; texCoord = (t1 - t0) * v + t0;` (the same for the positions), `Height = texture(heightMap, texCoord).r * 64.0 - 16.0;`, the normal `normalize(cross(vVec.xyz, uVec.xyz))`; the block and push constant like the control shader's, `layout(binding = 1) uniform sampler2D heightMap;`. In C++: `createPipeline("shaders/gpuheight.vert.spv", "shaders/gpuheight.tesc.spv", "shaders/gpuheight.tese.spv", "shaders/gpuheight.frag.spv", graphicsPipeline)` with two more stages, `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST`, `tessellationState.patchControlPoints = NUM_PATCH_PTS` (`pipelineInfo.pTessellationState`); the attribute description of `texCoord` (location 1, `VK_FORMAT_R32G32_SFLOAT`); the uniform buffer, the push constant range and `vkCmdPushConstants` for `VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT | VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT`; `vkCmdBindVertexBuffers` + `vkCmdDraw(commandBuffer, NUM_PATCH_PTS * rez * rez, 1, 0, 0)`.
- **When done:** `gpuheight.tese`: learnopengl's evaluation shader. `main.cpp`: the four-stage `createPipeline`, the
  patch list topology and tessellation state, attribute 1, the tessellation stage flags, the draw. The start's control
  shader sets every level to 1, so **every patch is one flat quad** with the heights of its 4 corners: **a coarse
  terrain** (800 triangles): peak = 214,214,214, ridge = 144,144,144, centre = 87,87,87, hill = 101,101,101, valley =
  76,76,76, lake = 28,28,28, front = 64,64,64, background = below = 26,26,26 (214,031 pixels not background – OpenGL's
  picture exactly).

## `tess-control`
- **Task:** Tessellate: in the control shader set all four outer levels and both inner levels to 8, so every patch is cut into 9 × 9 small quads (fractional_odd spacing rounds level 8 up to 9 segments) whose new vertices each read their own height.
- **Hint:** `gl_TessLevelOuter[0..3] = 8; gl_TessLevelInner[0..1] = 8;` – written once per patch, by invocation 0 (`if (gl_InvocationID == 0)`).
- **When done:** `gpuheight.tesc`: the six levels 8. **The full terrain** again: peak = 213,213,213, ridge =
  145,145,145, centre = 91,91,91, hill = 101,101,101, valley = 88,88,88, lake = 28,28,28, front = 67,67,67, background =
  below = 26,26,26 (213,964 pixels – OpenGL's picture exactly).

## `wireframe`
- **Task:** Draw only the triangles' edges to see the tessellation.
- **Hint:** `rasterizer.polygonMode = VK_POLYGON_MODE_LINE;` needs the `fillModeNonSolid` device feature: `deviceFeatures.fillModeNonSolid = VK_TRUE;` and `&& supportedFeatures.fillModeNonSolid` in `isDeviceSuitable()`.
- **When done:** `main.cpp`: `VK_POLYGON_MODE_LINE`, `fillModeNonSolid` enabled and checked. **The terrain as a grey
  wireframe**, the same density on every patch (174,903 pixels not background, OpenGL 167,297; front box 78.5 % lines,
  OpenGL 74.8 %; back box 90.3 %, OpenGL 87.3 %). The named points lie on lines or gaps by chance – check the boxes.

## `distance-levels`
- **Task:** Make the levels depend on the distance to the camera: for each corner its eye-space depth, scaled to 0…1 between `MIN_DISTANCE` (250) and `MAX_DISTANCE` (450); each outer level from the nearer of its edge's two corners, mixed from `MAX_TESS_LEVEL` (8) near to `MIN_TESS_LEVEL` (2) far; the inner levels the larger of the opposite outer levels.
- **Hint:** learnopengl's code with the block's matrices: `vec4 eyeSpacePos00 = ubo.view * pc.model * gl_in[0].gl_Position;`, `float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);`, `tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));` …, `gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);`. An edge shared by two patches gets the same level from both, so no cracks open.
- **When done:** `gpuheight.tesc`: `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450`,
  the distance-based levels. **Near patches stay fine, far ones get coarse**: back box 50.7 % lines (OpenGL 47.3 %),
  front box 75.5 % (OpenGL 71.8 %); 145,430 pixels not background (OpenGL 137,244). This is the solution.
