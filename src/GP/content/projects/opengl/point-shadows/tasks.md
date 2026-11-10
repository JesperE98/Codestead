# Point Shadows – tasks (OpenGL)

learnopengl "Point Shadows": `src/5.advanced_lighting/3.2.1.point_shadows`, `3.2.2.point_shadows_soft`. Files:
`main.cpp`, `shader_m.h` (the Shader class with the optional geometry shader file, as in the geometry-shader chapter),
`wood.png`, `point_shadows.vs/.fs` (the scene's lighting), `point_shadows_depth.vs/.gs/.fs` (the depth pass: their
`main` functions are TODOs; the declarations – `uniform mat4 model`, `layout (triangles) in`, `layout (triangle_strip,
max_vertices=18) out`, `uniform mat4 shadowMatrices[6]`, `out vec4 FragPos` / `in vec4 FragPos`, `uniform vec3
lightPos`, `uniform float far_plane` – are already there).

**Fixed choices (the same in every API):**
- Scene (learnopengl's `renderScene`): the room – learnopengl's 2×2×2 `renderCube()` cube scaled 5 (walls at ±5),
  drawn with culling **off** and `reverse_normals` = 1 (the vertex shader negates the normal so the inside is lit) – and
  five cubes with culling on (`glEnable(GL_CULL_FACE)`, back faces, CCW front): (4, -3.5, 0) scale 0.5; (2, 3, 1)
  scale 0.75; (-3, -1, 0) scale 0.5; (-1.5, 1, 1.5) scale 0.5; (-1.5, 2, -3) rotated 60° about normalize(1, 0, 1),
  scale 0.75. All `wood.png` (texture unit 0, sampler `diffuseTexture`, `GL_REPEAT`, loaded linear like round 1, flipped
  on load).
- The light at `lightPos` (0, 0, 0), **static**: learnopengl moves it with `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`
  – that line is in `main.cpp`, commented out, so the picture does not depend on time.
- Camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1)
  (never visible: the room fills the window), depth test on.
- Lighting (learnopengl's point_shadows.fs): light colour 0.3, ambient 0.3 × light colour, diffuse, Blinn-Phong
  specular (64), `lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color`.
- Shadow cube map: 1024 × 1024 per face, `GL_DEPTH_COMPONENT`, `GL_NEAREST`, `GL_CLAMP_TO_EDGE` on S, T and R. Light
  projection `glm::perspective(glm::radians(90.0f), 1.0f, near_plane 1.0, far_plane 25.0)`; the six views
  `glm::lookAt(lightPos, lightPos + dir, up)` in the cube map face order +X, -X, +Y, -Y, +Z, -Z with dir / up:
  (1,0,0)/(0,-1,0), (-1,0,0)/(0,-1,0), (0,1,0)/(0,0,1), (0,-1,0)/(0,0,-1), (0,0,1)/(0,-1,0), (0,0,-1)/(0,-1,0).
  The depth stored is the **linear distance to the light / far_plane** (written with `gl_FragDepth`).
- **Deviation from learnopengl:** no `shadows` uniform (learnopengl toggles shadows with the Space key; there is no input
  here – the `shadows` task switches them on in the code). learnopengl's PCF bias 0.15 is kept in the `pcf` task (the
  single-sample test uses 0.05, as learnopengl).

**What the camera sees:** from (0, 0, 3) the back wall (z = -5) fills the window – the wood stretched over the 10 × 10
wall, with dark seams – with a soft highlight a little left of the centre, and only one of the five cubes: the rotated
one at (-1.5, 2, -3), in the top-left corner. Light and camera are almost on one line, so the cube hides most of its own
shadow: the shadow shows as a dark band around the cube's upper-left edge (x 38..110, y 0..100), a thin line along its
lower-left edge and a small piece right of its top corner (x ≈ 300..350, y 0..40). The other four cubes and their
shadows (on the side walls, floor and ceiling) are outside the view. (A camera moved back and turned would show more –
the course keeps learnopengl's start position; WASD / mouse still work in the real program.)

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **wall-centre** (350,300) = 117,80,49 (in the highlight); **seam** (400,300) = 47,32,19; **wall-right**
(700,450) = 61,42,25; **wall-left** (100,500) = 60,41,25; **wall-top-right** (750,50) = 54,37,22; **cube-face**
(150,100) = 69,47,29 (the rotated cube's lit face); **shadow-1** (60,40), **shadow-2** (50,80), **shadow-3** (330,15)
– on the wall where the cube's shadow falls; **edge-1** (150,160), **edge-2** (120,150) – at the shadow's lower edge.

**Start picture:** the room lit, no shadows: shadow-1 = 56,38,23, shadow-2 = 52,35,22, shadow-3 = 61,41,25, edge-1 =
55,38,23, edge-2 = 57,39,24; the other named points as above. In the box x 0..360, y 0..200, 4,751 pixels have red < 20
(the cube's dark faces and seams).

## `depth-cubemap`
- **Task:** Create the depth cube map – six 1024×1024 depth faces attached as a whole (layered) to a framebuffer without a colour buffer – and render the scene into all six faces in one pass from the light: a geometry shader sends every triangle to each face (`gl_Layer`) with that face's light matrix, the fragment shader stores the distance to the light / far plane as the depth. Then show the cube map: the scene's fragment shader outputs the stored depth in the fragment's direction from the light as grey.
- **Hint:** `glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap)`, then `for (unsigned int i = 0; i < 6; ++i) glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);`, and `glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0);` (no `2D`: the whole cube map, all layers). `shadowProj = glm::perspective(glm::radians(90.0f), (float)SHADOW_WIDTH / (float)SHADOW_HEIGHT, near_plane, far_plane)` – 90° so the six faces cover every direction. The geometry shader: `for(int face = 0; face < 6; ++face) { gl_Layer = face; for(int i = 0; i < 3; ++i) { FragPos = gl_in[i].gl_Position; gl_Position = shadowMatrices[face] * FragPos; EmitVertex(); } EndPrimitive(); }` (the vertex shader outputs the world position only). The depth fragment shader: `gl_FragDepth = length(FragPos.xyz - lightPos) / far_plane;`. Debug view: `texture(depthMap, fs_in.FragPos - lightPos).r` on a `samplerCube depthMap` (unit 1).
- **When done:** `main.cpp`: `Shader simpleDepthShader("point_shadows_depth.vs", "point_shadows_depth.fs",
  "point_shadows_depth.gs");`; learnopengl's `// configure depth map FBO` block (`SHADOW_WIDTH = 1024, SHADOW_HEIGHT =
  1024`, `depthMapFBO`, `depthCubemap` with `GL_TEXTURE_CUBE_MAP`, six `glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i,
  … GL_DEPTH_COMPONENT … GL_FLOAT, NULL)`, `GL_NEAREST` mag/min, `GL_CLAMP_TO_EDGE` on S/T/R,
  `glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0)`, `glDrawBuffer(GL_NONE)`,
  `glReadBuffer(GL_NONE)`); `shader.setInt("depthMap", 1);`; in the loop `// 0.` (`near_plane = 1.0f`, `far_plane =
  25.0f`, `shadowProj`, `std::vector<glm::mat4> shadowTransforms` with the six `push_back(shadowProj * glm::lookAt(…))`)
  and `// 1.` (`glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)`, `glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO)`,
  `glClear(GL_DEPTH_BUFFER_BIT)`, `simpleDepthShader.use()`, `setMat4("shadowMatrices[" + std::to_string(i) + "]",
  shadowTransforms[i])` in a for loop, `setFloat("far_plane", far_plane)`, `setVec3("lightPos", lightPos)`,
  `renderScene(simpleDepthShader)`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`); in pass 2 `shader.setFloat("far_plane",
  far_plane);` and `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);`; cleanup deletes
  `depthCubemap` and `depthMapFBO`. The three depth shaders as learnopengl's (`gl_Position = model * vec4(aPos, 1.0);`,
  the GS loop with `gl_Layer = face`, `gl_FragDepth = lightDistance` with `lightDistance = length(FragPos.xyz -
  lightPos) / far_plane`). `point_shadows.fs`: `uniform samplerCube depthMap;`, `uniform float far_plane;`, and at the
  end of `main` (instead of `FragColor = vec4(lighting, 1.0);`, which is commented out) `vec3 fragToLight =
  fs_in.FragPos - lightPos; float closestDepth = texture(depthMap, fragToLight).r; FragColor =
  vec4(vec3(closestDepth), 1.0);` – learnopengl's debug line `FragColor = vec4(vec3(closestDepth / far_plane), 1.0)`
  (there `closestDepth` has already been multiplied by far_plane).
  The window shows the **depth cube map seen from the camera** – grey everywhere (r = g = b, 15..84), dark: the
  wall is 5–8.7 units from the light, 0.2–0.35 of far_plane. **seam**/centre (400,300) = 51,51,51 (distance 5 →
  0.2 × 255), (400,20) = 60,60,60, (20,300) = 67,67,67, wall-right (700,450) = 64,64,64, wall-left (100,500) =
  65,65,65, wall-top-right (750,50) = 70,70,70, (780,580) = 74,74,74 (the corner, farthest); the wall gets lighter
  towards the edges. The cube is darker (closer to the light): cube-face (150,100) = 34,34,34. **The shadow shows here
  too:** where the cube hides the wall from the light, the cube map holds the cube's distance, not the wall's:
  shadow-1 (60,40) = 34,34,34, shadow-2 (50,80) = 35,35,35, shadow-3 (330,15) = 32,32,32, edge-1 (150,160) =
  35,35,35, while the wall next to it is lighter: edge-2 (120,150) = 62,62,62. No wood texture, no lighting.

## `shadows`
- **Task:** Draw the lit scene again with shadows: `ShadowCalculation(fragPos)` reads the closest depth in the direction from the light to the fragment, turns it back into a distance (`* far_plane`), and compares it with the fragment's own distance to the light, with a bias of 0.05.
- **Hint:** `vec3 fragToLight = fragPos - lightPos; float closestDepth = texture(depthMap, fragToLight).r; closestDepth *= far_plane; float currentDepth = length(fragToLight); float bias = 0.05; float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;`. In `main`: `float shadow = ShadowCalculation(fs_in.FragPos);` and `FragColor = vec4(lighting, 1.0);` again. The direction vector does not need to be normalised: the cube map picks the face and texel from its direction only.
- **When done:** `point_shadows.fs`: learnopengl 3.2.1's `float ShadowCalculation(vec3 fragPos)` (with its commented
  debug line), `float shadow = ShadowCalculation(fs_in.FragPos);`, `FragColor = vec4(lighting, 1.0);` (the debug output
  removed). The lit room is back with the cube's **shadow** on the back wall: shadow-1 (60,40) = 16,11,7, shadow-2
  (50,80) = 15,10,6, shadow-3 (330,15) = 16,11,7, edge-1 (150,160) = 14,10,6 (ambient only: 0.09 × the wood);
  edge-2 (120,150) = 57,39,24 (lit, just outside the shadow); all other named points as in the start (wall-centre
  117,80,49, wall-right 61,42,25, wall-left 60,41,25, cube-face 69,47,29, wall-top-right 54,37,22). About 7,100
  pixels change against the start, all inside x 38..351, y 0..196. In the box x 0..360, y 0..200, 11,860 pixels have
  red < 20 (start 4,751). Hard, jagged edges (one cube map texel per sample). No shadow acne (the bias in world units
  covers the depth texels).

## `pcf`
- **Task:** Soften the shadow's edges with learnopengl's PCF for cube maps: 20 samples along offset directions (`gridSamplingDisk`), spread over a disk whose radius grows with the distance to the viewer, averaged; bias 0.15.
- **Hint:** Add learnopengl's `vec3 gridSamplingDisk[20] = vec3[](…)` (the 8 corners, 12 edge middles of a cube). In `ShadowCalculation`: `float shadow = 0.0; float bias = 0.15; int samples = 20; float viewDistance = length(viewPos - fragPos); float diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0;` then `for(int i = 0; i < samples; ++i) { float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r; closestDepth *= far_plane; if(currentDepth - bias > closestDepth) shadow += 1.0; } shadow /= float(samples);`.
- **When done:** `point_shadows.fs`: the `gridSamplingDisk[20]` array and learnopengl 3.2.2's PCF loop in
  `ShadowCalculation` (`bias = 0.15`, `samples = 20`, `viewDistance`, `diskRadius`, `shadow /= float(samples)`). The
  shadow's **edges become soft**, its inside stays: shadow-1/2/3 = 16,11,7 / 15,10,6 / 16,11,7; edge-1 (150,160) =
  21,14,9 (was 14,10,6), edge-2 (120,150) = 51,35,22 (was 57,39,24). Only ≈ 1,600 pixels change against `shadows`, all
  at the shadow's edges (x 38..353, y 0..198); in the box x 0..360, y 0..200 the pixels with red < 20 go from 11,860 to
  10,321, those with red 20..49 from 5,688 to 8,258. The rest of the picture is unchanged. This is the solution
  (learnopengl's `3.2.2.point_shadows.fs`, without the `shadows` toggle).

## Cube map directions and clip space (for every API)
- **Face selection** is defined the same way in OpenGL, Vulkan and Direct3D (the largest component of the direction
  picks the face; the face's s/t follow the RenderMan convention, with t pointing *down* the face). learnopengl's six
  lookAt targets/ups are exactly that rule: rendering face +X with `lookAt(light, light + (1,0,0), (0,-1,0))` – up =
  -y – puts what the light sees in that direction where `texture(depthMap, dir)` will look for it. So the six
  targets/ups are the same in every API (Direct3D additionally needs a y flip, below).
- **Memory rows:** in all three APIs a cube face's texel row 0 is t = 0 (the first row uploaded / rendered), so the
  sampling side is identical. What differs is which NDC y lands on row 0 when rendering into a face:
  **OpenGL** maps NDC y = -1 to row 0 (the bottom of a window), **Vulkan** also maps NDC y = -1 to row 0 (the top of
  its framebuffer – the same memory row), **Direct3D** maps NDC y = +1 to row 0.
- **OpenGL and Vulkan** therefore use learnopengl's six matrices unchanged. In Vulkan do **not** apply the camera's
  `proj[1][1] *= -1` to `shadowProj`: that flip only makes the window picture upright; applied to the shadow matrices it
  would store every face upside down. **Direct3D** stores each face upside down with these matrices: flip y in the
  shadow projection (or derive the faces from D3D's own convention: LH lookAt with up +y, (0,0,-1) / (0,0,1) for ±Y),
  and mind that a y flip reverses the winding for the culled cubes. Each writer checks on their side that the shadows
  land where OpenGL's do (shadow-1/2/3 dark, edge-2 lit, and the debug view's grey values).
- **Depth values:** the stored depth is our own `gl_FragDepth` / `SV_Depth` (distance / far_plane), so the projection's
  depth range (-1..1 in OpenGL, 0..1 in Vulkan/Direct3D with `GLM_FORCE_DEPTH_ZERO_TO_ONE` / RH) does not change the
  value; near 1.0 and far 25.0 still clip (nothing here is nearer than 1.0 or farther than 25 – the room's corners are
  8.7 from the light).
