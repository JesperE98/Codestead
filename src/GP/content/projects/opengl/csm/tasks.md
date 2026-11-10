# Cascaded Shadow Mapping – tasks (OpenGL)

learnopengl "Guest Articles / Cascaded Shadow Mapping": `src/8.guest/2021/2.csm/shadow_mapping.cpp` with
`10.shadow_mapping.vs/.fs`, `10.shadow_mapping_depth.vs/.fs/.gs`, `10.debug_quad.vs`, `10.debug_quad_depth.fs`. Files:
`main.cpp`, `shader_m.h` (the course's Shader class with the optional geometry shader, as in Point Shadows), `wood.png`,
`shadow_mapping.vs/.fs` (the scene's lighting; the cascades are TODOs), `shadow_mapping_depth.vs/.fs/.gs` (the depth
pass; the geometry shader is a pass-through TODO in the start), `debug_quad.vs`, `debug_quad_depth.fs` (shows one layer
of the shadow maps). learnopengl's file names without the `10.` prefix. The visualisation of the cascade volumes
(learnopengl's `drawCascadeVolumeVisualizers`, key C) is described in the text, not a task.

**Screenshot time: 1.0 s** (nothing moves; the light-space matrices are recomputed every frame from the camera, as
learnopengl does, so they would follow a moving camera).

**OpenGL version: 4.1 core** (learnopengl's): the geometry shader runs once per cascade with `layout (triangles,
invocations = 5) in;` – geometry shader instancing is core in 4.0. All shaders `#version 410 core`. The course's other
code is 3.3; 4.1 is also the highest version macOS offers, so this chapter runs there.

**Fixed choices (the same in every API):**
- Scene: learnopengl's floor (planeVertices ±25 at **y = -2**, normals up, texcoords 0..25, `GL_REPEAT`) and **ten cubes**
  (`renderCube()`, the 2×2×2 cube) with `wood.png` (loaded linear, flipped – the Shadow Mapping chapter's
  `loadTexture`). learnopengl places its cubes with `std::mt19937` seeded from `std::random_device` (a different scene
  every run); the course lists ten fixed placements – translate(position) · rotate(angle about normalize(1, 0, 1)) ·
  scale(s): (-3, 0, 11) 30° 0.8; (2.5, 1, 9) 60° 0.7; (0, -1, 5) 15° 1.0; (-5, 1.5, 3) 45° 0.9; (4.5, 0.5, 1) 75° 1.0;
  (-1.5, 2.5, -3) 120° 0.8; (6, -1, -7) 150° 1.0; (-7, 2, -10) 90° 1.0; (1.5, 1, -14) 10° 1.0; (-4, 0, -20) 160° 1.0
  (`cubePositions[]`, `cubeAngles[]`, `cubeScales[]`, drawn in that order after the floor).
- Camera: **(0, 3, 17)**, yaw -90, **pitch -15** (`cameraFront = (0, -0.25882, -0.96593)`), fov 45, 800/600, **near 0.1,
  far 500** (learnopengl's `cameraNearPlane` / `cameraFarPlane`; learnopengl's camera starts at (0, 0, 3)). Clear (0.1,
  0.1, 0.1).
- Light: directional, `lightDir = normalize(20, 50, 20)` (the direction towards the light), learnopengl's lighting
  (Blinn-Phong, light colour 0.3, exponent 64) – with the **ambient term of the Shadow Mapping chapter**, `0.3 *
  lightColor` (learnopengl's CSM shader writes `0.3 * color` and then multiplies by the colour again: the texture
  squared).
- Cascades (learnopengl's): `shadowCascadeLevels = { far / 50, far / 25, far / 10, far / 2 }` = 10, 20, 50, 250 → **five
  cascades**: 0.1–10, 10–20, 20–50, 50–250, 250–500. Light-space matrix per cascade: learnopengl's
  `getLightSpaceMatrix(near, far)` (the 8 corners of the cascade's part of the camera frustum via the inverse of
  projection · view, their centre, `lookAt(center + lightDir, center, (0, 1, 0))`, the corners' bounding box in light
  space, z range stretched by `zMult = 10`, `glm::ortho(minX, maxX, minY, maxY, minZ, maxZ)`), stored per frame in a
  uniform buffer (`layout (std140) uniform LightSpaceMatrices { mat4 lightSpaceMatrices[16]; };`, 16 × 64 bytes,
  binding point 0, `glBufferSubData` per matrix). Neither shader calls `glUniformBlockBinding`: a block's binding is 0 by
  default, the binding point the buffer is bound to (learnopengl relies on that too).
- Shadow maps: **one 2D texture array** `GL_DEPTH_COMPONENT32F`, **1024 × 1024 × 5 layers** (learnopengl: 4096²; the
  simulator draws on the CPU), `GL_NEAREST`, `GL_CLAMP_TO_BORDER` with border 1.0; attached whole with
  `glFramebufferTexture` (layered), `glDrawBuffer(GL_NONE)`, `glReadBuffer(GL_NONE)`. **One depth pass** draws the scene
  once; the geometry shader (invocations = 5) emits every triangle into each layer: `gl_Position =
  lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position; gl_Layer = gl_InvocationID;` (the depth vertex shader
  outputs world positions). learnopengl calls `glCullFace(GL_FRONT)` around the depth pass without enabling
  `GL_CULL_FACE` (so it does nothing); the course leaves it out.
- Lookup (`shadow_mapping.fs`): the cascade = the first i with view-space depth `abs((view * fragPos).z) <
  cascadePlaneDistances[i]`, else `cascadeCount` (= 4); `projCoords = lightSpace.xyz / w * 0.5 + 0.5`; no shadow when
  `projCoords.z > 1.0`; bias `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)` scaled by `1 / (distance * 0.5)` with the
  cascade's far distance (`farPlane` for the last); `texture(shadowMap, vec3(projCoords.xy, layer))`. The course
  writes the cascade choice as a function `int CascadeLayer(vec3 fragPosWorldSpace)` (learnopengl has it inline in
  `ShadowCalculation`), used by the `cascade-layer` debug view and by `ShadowCalculation`.
- **Other APIs** (for their tasks.md): a depth image / texture with **5 array layers** (Vulkan: `arrayLayers = 5`, a
  `VK_IMAGE_VIEW_TYPE_2D_ARRAY` view for sampling and a 5-layer framebuffer (`layers = 5`); D3D12: `DepthOrArraySize =
  5`, `R32_TYPELESS`, a `D32_FLOAT` DSV with `D3D12_DSV_DIMENSION_TEXTURE2DARRAY` / `ArraySize = 5`, an `R32_FLOAT` SRV
  with `D3D12_SRV_DIMENSION_TEXTURE2DARRAY`), filled in one pass by a geometry shader with 5 invocations writing
  `gl_Layer` (Vulkan: the `geometryShader` feature; GLSL `layout(invocations = 5)`) / `SV_RenderTargetArrayIndex`
  (HLSL `[instance(5)]` with `SV_GSInstanceID`) – as learnopengl does (one pass per cascade with a single-layer view
  would also work: say why the course does not). Light matrices in the UBO / constant buffer (the per-frame data), the
  border colour via `CLAMP_TO_BORDER` + `FLOAT_OPAQUE_WHITE` / a static sampler with `OPAQUE_WHITE`. Vulkan / D3D12 depth
  is 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE` / the RH ortho): only xy go through `* 0.5 + 0.5` (D3D12: v = -y * 0.5 + 0.5),
  as in their Shadow Mapping chapter.

**What the camera sees** (Mesa, 800×600): the wooden floor from y ≈ 195 (its far edge, 25 units away) to the bottom,
the grey background above it, the ten cubes floating above the floor (the big one at the bottom left is (-3, 0, 11), the
upright one in the centre (0, -1, 5) resting on the floor, the one at the right (4.5, 0.5, 1)). The light comes from
above, right and in front of the camera's view (+x, +z), so the shadows fall back and to the left of the cubes.

Named points: **shadow-a** (490,475) (on the floor, cascade 1), **shadow-b** (290,273) (cascade 2), **shadow-c**
(405,221) (far, cascade 2), **shadow-d** (155,335) (cascade 1) – where the shadows land; **lit-a** (650,470), **lit-b**
(200,280), **lit-c** (480,230) – lit floor; **cube-front** (400,370) (the dark front face of the centre cube);
**background** (400,40); **dbg-floor** (100,560). The cascades on the floor along x = 400: cascade 0 from y 481 to the
bottom, cascade 1 y 267..480, cascade 2 y 195..266 (the floor ends inside cascade 2; cascades 3 and 4 hold only the far
background, where nothing is drawn).

**Start picture** (no shadows, `shadow = 0.0`): shadow-a = 60,41,25, shadow-b = 61,42,26, shadow-c = 57,39,24,
shadow-d = 53,37,22, lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26,
dbg-floor = 18,13,8 (the wood's dark grain there).

## `light-matrices`
- **Task:** Compute a light-space matrix for each of the five cascades every frame and put them into a uniform buffer: the split distances `shadowCascadeLevels` (far / 50, / 25, / 10, / 2), `getFrustumCornersWorldSpace` (the 8 corners of a frustum from the inverse of projection · view), `getLightSpaceMatrix(near, far)` (a light view looking at the corners' centre along the light direction, an orthographic box around the corners in light space, its depth range stretched by 10) and `getLightSpaceMatrices()`; the UBO (16 matrices, binding point 0) filled with `glBufferSubData` each frame.
- **Hint:** learnopengl's functions, with the camera globals instead of the `Camera` class: `glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, nearPlane, farPlane)` and `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`. Corners: `inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, 2.0f * z - 1.0f, 1.0f)`, divided by `w`. UBO: `glBufferData(GL_UNIFORM_BUFFER, sizeof(glm::mat4x4) * 16, nullptr, GL_STATIC_DRAW); glBindBufferBase(GL_UNIFORM_BUFFER, 0, matricesUBO);`.
- **When done:** `main.cpp`: `std::vector<float> shadowCascadeLevels{ cameraFarPlane / 50.0f, cameraFarPlane / 25.0f,
  cameraFarPlane / 10.0f, cameraFarPlane / 2.0f };`, `std::vector<glm::vec4> getFrustumCornersWorldSpace(const
  glm::mat4& projview)` (+ the `(proj, view)` overload), `glm::mat4 getLightSpaceMatrix(const float nearPlane, const float
  farPlane)` (`lookAt(center + lightDir, center, …)`, min/max in light space, `zMult = 10.0f`, `glm::ortho`),
  `std::vector<glm::mat4> getLightSpaceMatrices()` (5 matrices); `matricesUBO` (`glGenBuffers`, `glBufferData` 16 ·
  `sizeof(glm::mat4x4)`, `glBindBufferBase(GL_UNIFORM_BUFFER, 0, matricesUBO)`); in the loop `const std::vector<glm::mat4>
  lightMatrices = getLightSpaceMatrices();` and the `glBufferSubData` loop; `glDeleteBuffers(1, &matricesUBO)`. Nothing
  uses them yet: **no visible change** (same pixels as the start).

## `depth-maps`
- **Task:** Create the shadow maps – a framebuffer with a `GL_DEPTH_COMPONENT32F` 2D texture array of 1024 × 1024 × 5 layers attached as a layered depth attachment, no colour buffer – and render the scene's depth into all five layers in one pass: the geometry shader runs 5 times per triangle (`invocations = 5`), transforms it with `lightSpaceMatrices[gl_InvocationID]` and sends it to layer `gl_InvocationID`. For now show layer 2 of the array on a screen quad instead of the scene.
- **Hint:** `glBindTexture(GL_TEXTURE_2D_ARRAY, lightDepthMaps); glTexImage3D(GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, depthMapResolution, depthMapResolution, int(shadowCascadeLevels.size()) + 1, 0, GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);`, `GL_CLAMP_TO_BORDER` with border 1.0, `glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, lightDepthMaps, 0);` (all layers), `glDrawBuffer(GL_NONE); glReadBuffer(GL_NONE);`. The depth pass: `simpleDepthShader.use()`, bind `lightFBO`, `glViewport(0, 0, depthMapResolution, depthMapResolution)`, clear the depth, `renderScene(simpleDepthShader)`. The debug view: `if (showQuad)` – `debugDepthQuad.setInt("layer", debugLayer)`, the array on unit 0, `renderQuad()`.
- **When done:** `main.cpp`: `unsigned int lightFBO; unsigned int lightDepthMaps; constexpr unsigned int
  depthMapResolution = 1024;`, `bool showQuad = true; // for now`, `int debugLayer = 2;`, the light FBO setup
  (`GL_TEXTURE_2D_ARRAY`, `glTexImage3D` with 5 layers, `GL_NEAREST`, `GL_CLAMP_TO_BORDER`, `GL_TEXTURE_BORDER_COLOR`,
  `glFramebufferTexture`, `glDrawBuffer(GL_NONE)`, `glReadBuffer(GL_NONE)`, `glCheckFramebufferStatus`), the `// 1.` depth
  pass in the loop, the debug quad block after the scene, cleanup of the array and the framebuffer.
  `shadow_mapping_depth.gs`: `layout(triangles, invocations = 5) in;`, the `LightSpaceMatrices` block,
  `lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position`, `gl_Layer = gl_InvocationID;`. The window shows **layer 2
  of the shadow maps** (the cascade 20..50 units from the camera, seen from the light): white (depth 1, nothing there) in
  the top and the right, the floor's corner as a grey diamond (162..170) with its corners near (115,148) at the top and
  (648,452) at the right, running out of the window at the left and bottom edges, the cubes as faint darker grey
  patches on it: shadow-a = 165,165,165, shadow-b = 170,170,170, shadow-c =
  255,255,255, shadow-d = 166,166,166, lit-a = 255,255,255, lit-b = 170,170,170, lit-c = 255,255,255, cube-front =
  168,168,168, background = 255,255,255, dbg-floor = 162,162,162 (290,329 pixels pure white; 189,671 below 200).

## `cascade-layer`
- **Task:** Back to the scene (`showQuad = false`). Give the scene shader the cascades – the view matrix, `farPlane`, `cascadePlaneDistances[16]`, `cascadeCount` – and a function `CascadeLayer` that picks a fragment's cascade from its depth in view space: the first cascade whose far distance is beyond it, else the last. For now tint every fragment with its cascade's colour (red, green, blue, yellow, magenta) to see where the cascades are.
- **Hint:** In the loop: `shader.setFloat("farPlane", cameraFarPlane); shader.setInt("cascadeCount", shadowCascadeLevels.size());` and `shader.setFloat("cascadePlaneDistances[" + std::to_string(i) + "]", shadowCascadeLevels[i]);` in a loop. `CascadeLayer`: `float depthValue = abs((view * vec4(fragPosWorldSpace, 1.0)).z);`, then learnopengl's `for` loop with `break`. Tint: `lighting *= cascadeColors[CascadeLayer(fs_in.FragPos)];` with `vec3(1.0, 0.4, 0.4)`, `(0.4, 1.0, 0.4)`, `(0.4, 0.4, 1.0)`, `(1.0, 1.0, 0.4)`, `(1.0, 0.4, 1.0)`.
- **When done:** `main.cpp`: `bool showQuad = false;`, the uniforms `farPlane`, `cascadeCount`, `cascadePlaneDistances[i]`.
  `shadow_mapping.fs`: `uniform float farPlane; uniform mat4 view; uniform float cascadePlaneDistances[16]; uniform int
  cascadeCount;`, `int CascadeLayer(vec3 fragPosWorldSpace)`, the `cascadeColors` tint. The scene with **coloured
  bands**: the floor red near the camera (cascade 0, below y 481 at x = 400), green in the middle (cascade 1, y
  267..480), blue at the back (cascade 2, y 195..266); the cubes tinted by their cascade (the near big cube red, the
  centre cube green, the far ones blue); the background is not drawn geometry and stays 26,26,26: shadow-a = 24,41,10
  (green), shadow-b = 24,17,26 (blue), shadow-c = 23,16,24 (blue), shadow-d = 21,37,9 (green), lit-a = 27,46,11, lit-b =
  22,15,23, lit-c = 23,16,25, cube-front = 6,10,3, background = 26,26,26, dbg-floor = 18,5,3 (red).

## `shadows`
- **Task:** Shadows: the scene shader gets the shadow map array (`sampler2DArray shadowMap`, unit 1) and the `LightSpaceMatrices` block; `ShadowCalculation` transforms the fragment with its cascade's light-space matrix, maps it to 0..1, returns 0 beyond the light's far plane, scales the bias by the cascade's far distance, and compares with one sample of that layer. Remove the debug tint.
- **Hint:** `vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0); vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w * 0.5 + 0.5;` – with `bias *= 1 / (cascadePlaneDistances[layer] * biasModifier)` (or `farPlane` for the last cascade, `biasModifier = 0.5`) and `texture(shadowMap, vec3(projCoords.xy, layer)).r`. In C++: `shader.setInt("shadowMap", 1);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D_ARRAY, lightDepthMaps);`.
- **When done:** `main.cpp`: `shader.setInt("shadowMap", 1);`, the array bound on unit 1 before `renderScene(shader)`.
  `shadow_mapping.fs`: `uniform sampler2DArray shadowMap;`, `layout (std140) uniform LightSpaceMatrices { mat4
  lightSpaceMatrices[16]; };`, `float ShadowCalculation(vec3 fragPosWorldSpace)` (learnopengl's without PCF), `float
  shadow = ShadowCalculation(fs_in.FragPos);`, no tint. **The cubes cast shadows** onto the floor in all three cascades
  (and onto each other): shadow-a = 15,11,6, shadow-b = 16,11,7, shadow-c = 15,10,6, shadow-d = 14,9,6 (only the ambient
  term left); lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26,
  dbg-floor = 18,13,8 (as the start). 19,001 pixels differ from the start (all by more than 10).

## `pcf`
- **Task:** Soften the shadow edges with percentage-closer filtering: average the comparison over the 3 × 3 texels around the position in the cascade's layer.
- **Hint:** `vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));` (the `.xy` of the array's size), then two `for` loops from -1 to 1 with `texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r` and `shadow /= 9.0;`.
- **When done:** `shadow_mapping.fs`: learnopengl's PCF loop in `ShadowCalculation`. The shadows' edges get a one-texel
  soft border (2,134 pixels differ from `shadows`, along the edges; the largest change in the far cascade, where a texel
  is biggest); the named points keep their values: shadow-a = 15,11,6, shadow-b = 16,11,7, shadow-c = 15,10,6, shadow-d
  = 14,9,6, lit-a = 67,46,28, lit-b = 55,38,23, lit-c = 58,40,25, cube-front = 15,10,6, background = 26,26,26,
  dbg-floor = 18,13,8. This is the solution.
