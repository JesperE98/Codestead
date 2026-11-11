# Cascaded Shadow Mapping (Vulkan) – tasks

learnopengl "Guest Articles / Cascaded Shadow Mapping": `src/8.guest/2021/2.csm/shadow_mapping.cpp` with
`10.shadow_mapping.vs/.fs`, `10.shadow_mapping_depth.vs/.fs/.gs`, `10.debug_quad.vs`, `10.debug_quad_depth.fs`. Files:
`main.cpp`, `textures/wood.png` and in `shaders/` (each built to `<name>.spv`): `shadow_mapping.vert/.frag` (the scene's
lighting; the cascades are TODOs), `shadow_mapping_depth.vert/.frag/.geom` (the depth pass; the geometry shader is a
pass-through TODO in the start), `debug_quad.vert`, `debug_quad_depth.frag` (shows one layer of the shadow maps;
complete in the start). The project is built on the Vulkan `shadow-mapping` chapter (its depth-only render pass, the
`createPipeline` helper – here with an optional geometry shader file as in `point-shadows` –, `renderScene`, the debug
quad). The visualisation of the cascade volumes (learnopengl's key C) is described in the text, not a task.

**Screenshot time: 1.0 s** (nothing moves; the light-space matrices are recomputed every frame from the camera, as
learnopengl does).

**Fixed choices (the same in every API, see `../../opengl/csm/tasks.md`):**
- Scene: learnopengl's floor (±25 at **y = -2**, normals up, texcoords 0..25, REPEAT) and **ten cubes** with `wood.png`:
  translate(position) · rotate(angle about normalize(1, 0, 1)) · scale(s): (-3, 0, 11) 30° 0.8; (2.5, 1, 9) 60° 0.7;
  (0, -1, 5) 15° 1.0; (-5, 1.5, 3) 45° 0.9; (4.5, 0.5, 1) 75° 1.0; (-1.5, 2.5, -3) 120° 0.8; (6, -1, -7) 150° 1.0;
  (-7, 2, -10) 90° 1.0; (1.5, 1, -14) 10° 1.0; (-4, 0, -20) 160° 1.0 (`cubePositions[]`, `cubeAngles[]`, `cubeScales[]`,
  drawn by `renderScene()` after the floor; learnopengl places its cubes at random).
- Camera: **(0, 3, 17)**, yaw -90, **pitch -15** (`cameraFront = (0, -0.25882, -0.96593)`), fov 45, 800/600, **near 0.1,
  far 500** (`cameraNearPlane`, `cameraFarPlane`; `proj[1][1] *= -1` for the window). Clear (0.1, 0.1, 0.1).
- Light: directional, `lightDir = normalize(20, 50, 20)`, Blinn-Phong with light colour 0.3, exponent 64, ambient `0.3 *
  lightColor` (the Shadow Mapping chapter's).
- Cascades: `shadowCascadeLevels = { far / 50, far / 25, far / 10, far / 2 }` = 10, 20, 50, 250 → **five cascades**.
  learnopengl's `getFrustumCornersWorldSpace`, `getLightSpaceMatrix(near, far)` (centre of the 8 corners, `lookAt(center
  + lightDir, center, (0, 1, 0))`, the corners' box in light space, z stretched by `zMult = 10`, `glm::ortho`) and
  `getLightSpaceMatrices()`, as free functions with the camera globals. **Vulkan's corners:** the normalized device
  coordinates box of a `GLM_FORCE_DEPTH_ZERO_TO_ONE` projection has z from **0 to 1** (OpenGL's from -1 to 1), so the
  corners are `inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, (float)z, 1.0f)` – with learnopengl's `2.0f * z - 1.0f`
  the near corners would land at about half the near distance (cascade 1 would start at 6.7 instead of 10) and the
  cascades' boxes would grow. `glm::ortho` maps the light's z range to 0..1, which is the depth range Vulkan stores, so
  the shadow maps hold exactly OpenGL's depths (the `depth-maps` debug picture is pixel-identical to OpenGL's).
- **Two uniform buffers** like learnopengl: the per-frame `UniformBufferObject` at binding 0 (view, proj, viewPos,
  lightDir, and from `cascade-layer` farPlane, cascadeCount, `glm::vec4 cascadePlaneDistances[16]` – std140: array
  elements are 16 bytes apart, only `.x` is used; `farPlane` and `cascadeCount` fill the 4 bytes after the two vec3s) and
  learnopengl's `matricesUBO`: `struct LightSpaceMatrices { glm::mat4 lightSpaceMatrices[16]; }` in its own persistently
  mapped buffer (`lightMatricesBuffer`) at **binding 2** (stages geometry + fragment), filled in `updateUniformBuffer()`
  from `getLightSpaceMatrices()` every frame. The shaders declare it as learnopengl's block (`layout(binding = 2)
  uniform LightSpaceMatrices { mat4 lightSpaceMatrices[16]; };`).
- **Shadow maps: one depth image with 5 array layers** (`lightDepthMaps`, `findDepthMapFormat()` = `D32_SFLOAT`,
  **1024 × 1024 × 5**; learnopengl 4096²), usage depth attachment + sampled; **one `VK_IMAGE_VIEW_TYPE_2D_ARRAY` view of all
  layers**, used both for sampling (`sampler2DArray` at **binding 3**) and as the attachment of a **layered framebuffer**
  (`layers = 5`, `lightFramebuffer`); a depth-only render pass (`depthMapRenderPass`: clear, store, final layout
  `DEPTH_STENCIL_READ_ONLY_OPTIMAL`); a sampler with NEAREST filtering and `CLAMP_TO_BORDER` +
  `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` (learnopengl's border 1.0).
- **One depth pass for all cascades** (learnopengl's way): the scene is drawn once; the geometry shader runs 5 times per
  triangle (`layout(triangles, invocations = 5) in;`, needs the **`geometryShader` device feature**) and writes
  `gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position; gl_Layer = gl_InvocationID;` (the depth
  vertex shader outputs world positions). The alternative – one render pass per cascade with a single-layer view and
  framebuffer per layer and a push-constant cascade index, no geometry shader – draws the scene 5 times from the CPU
  side; the course follows learnopengl (and its Point Shadows chapter) and lets the GPU replicate the triangles.
- Lookup (`shadow_mapping.frag`): `CascadeLayer` – the first i with `abs((view * fragPos).z) <
  cascadePlaneDistances[i].x`, else `cascadeCount`; `projCoords.xy = projCoords.xy * 0.5 + 0.5` (z is 0..1 already, as in
  the Shadow Mapping chapter); no shadow when `projCoords.z > 1.0`; bias `max(0.05 * (1.0 - dot(normal, lightDir)),
  0.005)` scaled by `1 / (distance * 0.5)` with the cascade's far distance; `texture(shadowMap, vec3(projCoords.xy,
  layer))`. No y flip anywhere in the light's path: the depth pass and the lookup use the same matrices.
- Push constants: `struct PushConstants { glm::mat4 model; int layer; }` (vertex + fragment): `layer` is learnopengl's
  `debugLayer` uniform for the debug quad (from `depth-maps` on).
- The descriptor set is bound once at the start of `recordCommandBuffer()`, before both passes (binding 0 the uniform
  buffer, 1 the wood texture, 2 the light-space matrices, 3 the shadow maps).

**What the camera sees** (lavapipe, 800×600): the wooden floor from y ≈ 195 to the bottom, the grey background above,
the ten cubes floating above the floor; the light comes from above, right and in front, the shadows fall back and to
the left. Named points (OpenGL's): **shadow-a** (490,475), **shadow-b** (290,273), **shadow-c** (405,221), **shadow-d**
(155,335), **lit-a** (650,470), **lit-b** (200,280), **lit-c** (480,230), **cube-front** (400,370), **background**
(400,40), **dbg-floor** (100,560). The cascades on the floor along x = 400: cascade 0 from y 481 down, cascade 1 y
267..480, cascade 2 y 195..266. Every state equals OpenGL's picture except for the wood's fine grain: OpenGL samples the
wood with mipmaps, the Vulkan Shadow Mapping project without mipmaps but anisotropic – single pixels differ by up to
~35 (0.1 % of the pixels by more than 24; e.g. cube-front 10,7,4 here, 15,10,6 in OpenGL; shadow-b in the start
64,44,27 vs 61,42,26). The shadows, the cascade bands and the debug view land on the same pixels.

**Start picture** (no shadows, `shadow = 0.0`): shadow-a = 59,40,25, shadow-b = 64,44,27, shadow-c = 62,42,26, shadow-d
= 50,34,21, lit-a = 67,46,28, lit-b = 56,38,23, lit-c = 60,41,25, cube-front = 10,7,4, background = 26,26,26, dbg-floor
= 18,12,8.

Note for checks: the depth pass (5 × 1024² layers through a geometry shader) makes lavapipe's first frame take several
seconds – the screenshots were taken after 12 s (`VERIFY_WAIT=12`).

## `light-matrices`
- **Task:** Compute a light-space matrix for each of the five cascades every frame and put them into a second uniform buffer: the split distances `shadowCascadeLevels` (far / 50, / 25, / 10, / 2), `getFrustumCornersWorldSpace` (the 8 corners of a frustum from the inverse of projection · view – in Vulkan's depth range z = 0..1), `getLightSpaceMatrix(near, far)` and `getLightSpaceMatrices()`; the buffer (`struct LightSpaceMatrices { glm::mat4 lightSpaceMatrices[16]; }`) at binding 2 of the descriptor set, filled in `updateUniformBuffer()`.
- **Hint:** learnopengl's functions with the camera globals: `glm::perspective(glm::radians(fov), (float)WIDTH / (float)HEIGHT, nearPlane, farPlane)`, `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`. The buffer like the first one (`createBuffer` with `VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT`, host visible, `vkMapMemory` once); a layout binding 2 (`VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER`, `VK_SHADER_STAGE_GEOMETRY_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`), a third descriptor write, two uniform buffers in the pool. In `updateUniformBuffer()`: `const std::vector<glm::mat4> lightMatrices = getLightSpaceMatrices();`, copy them into a `LightSpaceMatrices` and `memcpy` it.
- **When done:** `main.cpp`: `std::vector<float> shadowCascadeLevels{ cameraFarPlane / 50.0f, … / 25.0f, … / 10.0f, … /
  2.0f };`, `getFrustumCornersWorldSpace(const glm::mat4& projview)` (+ the `(proj, view)` overload, z = `(float)z`),
  `glm::mat4 getLightSpaceMatrix(const float nearPlane, const float farPlane)` (`lookAt(center + lightDir, center, …)`,
  min/max in light space, `zMult = 10.0f`, `glm::ortho`), `std::vector<glm::mat4> getLightSpaceMatrices()` (5 matrices),
  `struct LightSpaceMatrices`, `lightMatricesBuffer` / `…Memory` / `…Mapped` (created in `createUniformBuffers()`,
  destroyed in `cleanup()`), binding 2 in the layout and the set, the copy in `updateUniformBuffer()`. Nothing uses
  them yet: **no visible change** (same pixels as the start).

## `depth-maps`
- **Task:** Create the shadow maps – a depth image with 5 layers (1024 × 1024), a 2D-array view of all layers, a layered framebuffer (`layers = 5`) for a depth-only render pass, a white-border sampler – and render the scene's depth into all five layers in one pass: the geometry shader runs 5 times per triangle (`invocations = 5`), transforms it with `lightSpaceMatrices[gl_InvocationID]` and sends it to layer `gl_InvocationID`. For now show layer 2 of the array on the debug quad instead of the scene.
- **Hint:** `createDepthMapRenderPass()` (the Shadow Mapping chapter's), `createDepthMaps()` (`imageInfo.arrayLayers = 5`, `viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D_ARRAY`, `subresourceRange.layerCount = 5`, `framebufferInfo.layers = 5`), `createDepthMapSampler()` (`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER`, `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE`). `deviceFeatures.geometryShader = VK_TRUE` (and check it in `isDeviceSuitable`). The depth pipeline: `createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv", "shaders/shadow_mapping_depth.geom.spv", 1, depthMapRenderPass, 0, depthPipeline)`; the debug pipeline with `debug_quad`. The shadow maps at binding 3 (`createDescriptorSet(…, lightDepthMapsView, depthMapSampler, …)`). `int layer;` in `PushConstants` and the push constants for both stages. In `recordCommandBuffer()` the depth pass before the window pass (viewport and scissor 1024 × 1024, `renderScene`), and `if (showQuad)` the debug pipeline with `constants.layer = debugLayer` and the quad (vertices 42..47).
- **When done:** `main.cpp`: `constexpr unsigned int depthMapResolution = 1024;`, `bool showQuad = true; // for now`,
  `int debugLayer = 2;`, `depthMapRenderPass`, `depthPipeline`, `debugPipeline`, `lightDepthMaps` / `…Memory` /
  `lightDepthMapsView` / `lightFramebuffer` / `depthMapSampler`, the three functions, the `geometryShader` feature,
  binding 3, the depth pass (`// 1.`) and the debug quad block in `recordCommandBuffer()`, the cleanup.
  `shadow_mapping_depth.geom`: `layout(triangles, invocations = 5) in;`, the `LightSpaceMatrices` block (binding 2),
  `lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position`, `gl_Layer = gl_InvocationID;`. The window shows **layer 2
  of the shadow maps** (pixel-identical to OpenGL's): white (depth 1) in the top and the right, the floor's corner as a
  grey diamond (162..174) with its corners near (115,148) and (648,452), the cubes as faint darker patches: shadow-a =
  165,165,165, shadow-b = 170,170,170, shadow-c = 255,255,255, shadow-d = 166,166,166, lit-a = 255,255,255, lit-b =
  170,170,170, lit-c = 255,255,255, cube-front = 168,168,168, background = 255,255,255, dbg-floor = 162,162,162.

## `cascade-layer`
- **Task:** Back to the scene (`showQuad = false`). Give the scene shader the cascades – `farPlane`, `cascadeCount` and `cascadePlaneDistances[16]` in the uniform buffer (the view matrix is there already) – and a function `CascadeLayer` that picks a fragment's cascade from its depth in view space: the first cascade whose far distance is beyond it, else the last. For now tint every fragment with its cascade's colour (red, green, blue, yellow, magenta).
- **Hint:** In `UniformBufferObject` replace the two padding floats by `float farPlane;` and `int cascadeCount;` and add `glm::vec4 cascadePlaneDistances[16];` (std140 arrays: 16 bytes per element); in `updateUniformBuffer()` `ubo.farPlane = cameraFarPlane; ubo.cascadeCount = static_cast<int>(shadowCascadeLevels.size());` and `ubo.cascadePlaneDistances[i] = glm::vec4(shadowCascadeLevels[i]);`. The same block in `shadow_mapping.frag`; `CascadeLayer`: `float depthValue = abs((ubo.view * vec4(fragPosWorldSpace, 1.0)).z);`, learnopengl's `for` loop over `ubo.cascadePlaneDistances[i].x` with `break`. Tint: `lighting *= cascadeColors[CascadeLayer(fs_in.fragPos)];`.
- **When done:** `main.cpp`: `bool showQuad = false;`, the three uniform buffer members and their values.
  `shadow_mapping.frag`: `float farPlane; … int cascadeCount; vec4 cascadePlaneDistances[16];` in the block, `int
  CascadeLayer(vec3 fragPosWorldSpace)`, the `cascadeColors` tint. The scene with **coloured bands**: the floor red near
  the camera (cascade 0), green in the middle (cascade 1), blue at the back (cascade 2), the cubes tinted by their
  cascade: shadow-a = 24,40,10 (green), shadow-b = 26,17,27 (blue), shadow-c = 25,17,26 (blue), shadow-d = 20,34,8
  (green), lit-a = 27,46,11, lit-b = 22,15,23, lit-c = 24,16,25, cube-front = 4,7,2, background = 26,26,26, dbg-floor =
  18,5,3 (red).

## `shadows`
- **Task:** Shadows: the scene shader gets the light-space matrices (binding 2) and the shadow map array (`sampler2DArray shadowMap`, binding 3); `ShadowCalculation` transforms the fragment with its cascade's light-space matrix, maps x and y to 0..1, returns 0 beyond the light's far plane, scales the bias by the cascade's far distance, and compares with one sample of that layer. Remove the debug tint.
- **Hint:** `vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0); vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w; projCoords.xy = projCoords.xy * 0.5 + 0.5;` – z is in 0..1 already. `bias *= 1 / (ubo.cascadePlaneDistances[layer].x * biasModifier)` (or `ubo.farPlane` for the last cascade, `biasModifier = 0.5`), `texture(shadowMap, vec3(projCoords.xy, layer)).r`. Nothing to do in C++: the descriptor set has both since `depth-maps` and `light-matrices`.
- **When done:** `shadow_mapping.frag`: `layout(binding = 2) uniform LightSpaceMatrices { mat4 lightSpaceMatrices[16]; };`,
  `layout(binding = 3) uniform sampler2DArray shadowMap;`, `float ShadowCalculation(vec3 fragPosWorldSpace)` (without PCF),
  `float shadow = ShadowCalculation(fs_in.fragPos);`, no tint. **The cubes cast shadows** onto the floor in all three
  cascades: shadow-a = 15,10,6, shadow-b = 16,11,7, shadow-c = 16,11,7, shadow-d = 13,9,5 (only the ambient term left);
  lit-a = 67,46,28, lit-b = 56,38,23, lit-c = 60,41,25, cube-front = 10,7,4, background = 26,26,26, dbg-floor = 18,12,8.

## `pcf`
- **Task:** Soften the shadow edges with percentage-closer filtering: average the comparison over the 3 × 3 texels around the position in the cascade's layer.
- **Hint:** `vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));` (the `.xy` of the array's size), two `for` loops from -1 to 1 with `texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r` and `shadow /= 9.0;`.
- **When done:** `shadow_mapping.frag`: learnopengl's PCF loop in `ShadowCalculation`. The shadows' edges get a one-texel
  soft border; the named points keep their values (shadow-a = 15,10,6, shadow-b = 16,11,7, shadow-c = 16,11,7, shadow-d
  = 13,9,5, lit-a = 67,46,28, lit-b = 56,38,23, lit-c = 60,41,25, cube-front = 10,7,4, background = 26,26,26, dbg-floor
  = 18,12,8). This is the solution.
