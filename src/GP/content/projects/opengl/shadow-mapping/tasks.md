# Shadow Mapping – tasks (OpenGL)

learnopengl "Shadow Mapping": `src/5.advanced_lighting/3.1.1.shadow_mapping_depth`, `3.1.2.shadow_mapping_base`,
`3.1.3.shadow_mapping`. Files: `main.cpp`, `shader_m.h`, `wood.png`, `shadow_mapping.vs/.fs` (the scene's lighting),
`shadow_mapping_depth.vs/.fs` (the depth pass: the vertex shader's main is a TODO, the fragment shader is
learnopengl's empty one), `debug_quad.vs` (complete) and `debug_quad_depth.fs` (main is a TODO; learnopengl's
`LinearizeDepth` for perspective lights is already there).

Scene (learnopengl's): `planeVertices` ±25 at y = -0.5 (normal up, texture coordinates 0..25, `GL_REPEAT`) in a global
`planeVAO`, three cubes drawn by learnopengl's `renderScene(const Shader &shader)` with `renderCube()` (a 2×2×2 cube with
normals and texture coordinates, its VAO made on the first call): (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5;
(-1, 0, 2) rotated 60° about normalize(1, 0, 1), scale 0.25 – all `wood.png` (`woodTexture`, unit 0, sampler
`diffuseTexture`). `lightPos` (-2, 4, -1). The course's camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0,
fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on. `shadow_mapping.fs` is learnopengl's: light colour 0.3,
ambient 0.3 × light colour, diffuse, Blinn-Phong specular (64), `lighting = (ambient + (1.0 - shadow) * (diffuse +
specular)) * color`. `renderQuad()` (learnopengl's NDC quad, triangle strip, 5 floats per vertex) is already in the start.

Start: no shadows yet (`float shadow = 0.0;` in `shadow_mapping.fs`); no depth map, no light-space matrix. TODOs in
`main.cpp`: the two extra shaders, the depth map FBO, pass 1 in the loop, the debug quad after pass 2.

**What the camera sees:** from (0, 0, 3) only the floating cube (0, 1.5, 0) is in view (top centre, seen from below), plus
the floor and the floating cube's shadow on it (lower right). The cubes at (2, 0, 1) and (-1, 0, 2) are just outside the
view (left and right of the camera, close to it); their shadows fall outside the view too. They appear in the depth map.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **background** (400,100) = 26,26,26; **cube0-bottom** (400,50) = 10,7,4 and (300,30) = 15,11,6 (the
floating cube's underside: ambient only, unchanged in every state except `depth-map`); **floor-left** (200,450) ≈
62,42,26 and (330,520) ≈ 60,41,25 (lit, never in shadow); **shadow-1** (650,450), **shadow-2** (560,440), **shadow-3**
(700,480) – inside the floating cube's shadow; **floor-right** (750,560) ≈ 57,39,24 (lit, outside the shadow).

**Start picture:** the wood floor lit evenly (dim: light colour 0.3) and the cube's underside at the top:
floor-left ≈ 62,42,26 / 60,41,25, shadow-1 ≈ 58,40,24, shadow-2 ≈ 62,43,26, shadow-3 ≈ 61,42,25 (no shadow yet),
floor-right ≈ 57,39,24, cube0-bottom = 10,7,4, background 26,26,26.

## `depth-map`
- **Task:** Create the depth map – a 1024×1024 depth texture as the only attachment of a framebuffer (no colour buffer) – and render the scene into it every frame from the light's point of view with the simple depth shader; then show the depth map on a quad over the whole window with the debug shader.
- **Hint:** `glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);` (filters `GL_NEAREST`, wrap `GL_REPEAT`), `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);` and `glDrawBuffer(GL_NONE); glReadBuffer(GL_NONE);` (a framebuffer without a colour buffer). The light: `glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane)` (1.0, 7.5) times `glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0))` = `lightSpaceMatrix`. Pass 1: `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)`, bind the FBO, `glClear(GL_DEPTH_BUFFER_BIT)`, `renderScene(simpleDepthShader)`, bind 0, viewport back to the window size and clear. The depth vertex shader: `gl_Position = lightSpaceMatrix * model * vec4(aPos, 1.0);`. The debug shader: `float depthValue = texture(depthMap, TexCoords).r; FragColor = vec4(vec3(depthValue), 1.0);`.
- **When done:** `main.cpp`: `Shader simpleDepthShader("shadow_mapping_depth.vs", "shadow_mapping_depth.fs");` and
  `Shader debugDepthQuad("debug_quad.vs", "debug_quad_depth.fs");`; learnopengl's `// configure depth map FBO` block
  (`const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`, `depthMapFBO`, `depthMap` with `GL_DEPTH_COMPONENT` /
  `GL_FLOAT` / `NULL`, `GL_NEAREST`, `GL_REPEAT`, `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D,
  depthMap, 0)`, `glDrawBuffer(GL_NONE)`, `glReadBuffer(GL_NONE)`); `debugDepthQuad.use(); debugDepthQuad.setInt("depthMap", 0);`;
  in the loop `// 1.`: `lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane)` (near_plane 1.0,
  far_plane 7.5), `lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0))`, `lightSpaceMatrix =
  lightProjection * lightView`, `simpleDepthShader.use()` + `setMat4("lightSpaceMatrix", …)`, `glViewport(0, 0,
  SHADOW_WIDTH, SHADOW_HEIGHT)`, `glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO)`, `glClear(GL_DEPTH_BUFFER_BIT)`,
  `renderScene(simpleDepthShader)`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`, `glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT)`,
  `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)`; after pass 2: `debugDepthQuad.use()`, `setFloat("near_plane", …)`,
  `setFloat("far_plane", …)`, `glBindTexture(GL_TEXTURE_2D, depthMap)` on unit 0, `renderQuad();`; cleanup deletes
  `depthMap` and `depthMapFBO`. `shadow_mapping_depth.vs`: `gl_Position = lightSpaceMatrix * model * vec4(aPos, 1.0);`.
  `debug_quad_depth.fs`: `float depthValue = texture(depthMap, TexCoords).r;` and `FragColor = vec4(vec3(depthValue),
  1.0); // orthographic`.
  The window shows the **depth map** (grey, stretched from 1024×1024 to 800×600; the quad at depth 0.5 covers the scene
  drawn before it): the floor as a vertical gradient – white at the top (far from the light; beyond the far plane
  nothing was drawn and the cleared depth 1.0 stays), (400,100) = 255,255,255, mid grey (200,300) = 163,163,163, dark
  towards the bottom (400,450) ≈ 53,53,53, (400,505) ≈ 13,13,13, then a white band again (400,560) = 255,255,255
  (in front of the near plane: clipped). The cubes: the floating cube **dark** (closest to the light) (398,275) ≈
  68,68,68; the cube at (2, 0, 1) lighter than the floor around it (400,230) ≈ 169,169,169 (floor next to it (330,230) ≈
  214,214,214); the small rotated cube (488,300) ≈ 129,129,129. The picture is grey everywhere (r = g = b).

## `shadows`
- **Task:** Draw the scene with shadows (learnopengl 3.1.2): pass the fragment's position in light space from the vertex shader (`lightSpaceMatrix`, `FragPosLightSpace`), give the fragment shader the depth map (`shadowMap`, unit 1) and a `ShadowCalculation` that compares the fragment's depth with the depth map's; stop drawing the debug quad.
- **Hint:** In the vertex shader `vs_out.FragPosLightSpace = lightSpaceMatrix * vec4(vs_out.FragPos, 1.0);` (add the field to both `VS_OUT` blocks). `ShadowCalculation`: `vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w; projCoords = projCoords * 0.5 + 0.5;` (OpenGL's NDC is -1..1 in x, y **and** z; the depth map holds 0..1), `float closestDepth = texture(shadowMap, projCoords.xy).r; float currentDepth = projCoords.z;`, `shadow = currentDepth > closestDepth ? 1.0 : 0.0`. In main: `shader.setInt("shadowMap", 1);`, `shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, depthMap);`, and comment out `renderQuad();`.
- **When done:** `shadow_mapping.vs`: `vec4 FragPosLightSpace;` in `VS_OUT`, `uniform mat4 lightSpaceMatrix;`,
  `vs_out.FragPosLightSpace = lightSpaceMatrix * vec4(vs_out.FragPos, 1.0);`. `shadow_mapping.fs`: `vec4
  FragPosLightSpace;` in the block, `uniform sampler2D shadowMap;`, learnopengl 3.1.2's `ShadowCalculation` (no bias)
  and `float shadow = ShadowCalculation(fs_in.FragPosLightSpace);`. `main.cpp`: `shader.setInt("shadowMap", 1);`,
  `shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D,
  depthMap);` before `renderScene(shader)`, `//renderQuad();`. The scene is back with the floating cube's **shadow**
  (lower right) and **shadow acne**: fine dark stripes (moiré rings) all over the lit floor.
  shadow-1 (650,450) ≈ 16,11,7, shadow-2 (560,440) ≈ 16,11,7, shadow-3 (700,480) ≈ 17,11,7 (ambient only); acne:
  floor-left (200,450) ≈ 15,11,6 (on a stripe), floor-right (750,560) ≈ 16,11,7; the lit region x 0..330, y 340..600
  has a mean luminance ≈ 28 (start ≈ 45) and ≈ 43,000 pixels darker than 20 (start ≈ 1,100) – check the stripes this
  way, not with single points. (330,520) ≈ 60,41,25 happens to be lit. Cube underside and background unchanged.

## `bias`
- **Task:** Remove the shadow acne with a bias that depends on the surface's slope towards the light: `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)`, subtracted from the fragment's depth before the comparison.
- **Hint:** `vec3 normal = normalize(fs_in.Normal); vec3 lightDir = normalize(lightPos - fs_in.FragPos); float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);` then `shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;`. The depth map's texels are big compared with the screen's pixels: several fragments share one stored depth and half of them end up "behind" it.
- **When done:** `shadow_mapping.fs`: `float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);` and `float shadow =
  currentDepth - bias > closestDepth ? 1.0 : 0.0;`. **The stripes are gone**, the shadow stays (with hard, jagged edges):
  floor-left (200,450) ≈ 62,42,26, (330,520) ≈ 60,41,25, floor-right (750,560) ≈ 57,39,24 (lit again, as in the start);
  shadow-1/2/3 ≈ 16,11,7 / 16,11,7 / 17,11,7; lit region mean luminance ≈ 45, ≈ 1,100 pixels darker than 20 (as the
  start). Column 600: the shadow's top edge between rows 415 and 416 (63 → 16), its bottom edge between 482 and 483
  (14 → 53) – a hard step.
  **Peter panning** (discussed, not a task): a bias makes shadows start a little away from the object's foot.
  learnopengl suggests culling front faces in the depth pass (`glCullFace(GL_FRONT)`) for solid objects, but that breaks
  for the floor, a single plane with no back side – the reason it is not used here.

## `over-sampling`
- **Task:** Stop over-sampling: outside the depth map nothing should be in shadow – clamp the depth texture to a white border (depth 1.0) – and fragments farther than the light's far plane (`projCoords.z > 1.0`) are never in shadow.
- **Hint:** `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);` (and `_T`), `float borderColor[] = { 1.0, 1.0, 1.0, 1.0 }; glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);`; in `ShadowCalculation` before `return`: `if(projCoords.z > 1.0) shadow = 0.0;`.
- **When done:** `main.cpp`: the depth map's wrap modes `GL_CLAMP_TO_BORDER`, `float borderColor[] = { 1.0, 1.0, 1.0,
  1.0 };` and `glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);` (instead of `GL_REPEAT`);
  `shadow_mapping.fs`: `if(projCoords.z > 1.0) shadow = 0.0;` before `return shadow;`.
  **From the default camera this changes almost nothing:** the regions outside the light's frustum lie far away near the
  horizon. Only 87 pixels change, a thin dark line on the far floor at the right edge: rows 317–319, x 705–799, e.g.
  (790,318) ≈ 15,10,6 → 26,18,11. Everything else is identical to `bias` (named points unchanged). Checked with a
  camera moved back and up (cameraPos (0, 12, 22), pitch -28.6°): before this task the right part of the floor
  (beyond the far plane 7.5) is dark, (700,400) ≈ 15,11,6, and a repeated copy of the cubes' shadows shows far away
  (the depth map wraps with `GL_REPEAT`); after it that floor is lit, (700,400) ≈ 33,23,14, and the copies are gone.
  So check the code (the border colour, `GL_CLAMP_TO_BORDER`, the `projCoords.z > 1.0` test) rather than the picture.

## `pcf`
- **Task:** Soften the shadow's edges with percentage-closer filtering: average the comparison over the 3×3 depth map texels around the position (`textureSize` gives the texel size).
- **Hint:** `float shadow = 0.0; vec2 texelSize = 1.0 / textureSize(shadowMap, 0);` then two nested loops `for(int x = -1; x <= 1; ++x)` / `for(int y = -1; y <= 1; ++y)` with `float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;` and finally `shadow /= 9.0;`.
- **When done:** `shadow_mapping.fs` `ShadowCalculation`: learnopengl 3.1.3's PCF (`vec2 texelSize = 1.0 /
  textureSize(shadowMap, 0);`, the two nested `for` loops, `shadow /= 9.0;`; the single comparison commented out), the
  `projCoords.z > 1.0` test after it. The shadow's **edges become soft**: the inside and the lit floor stay the same
  (shadow-1/2/3 ≈ 16,11,7, floor-left ≈ 62,42,26, floor-right ≈ 57,39,24), but the edge pixels get in-between values:
  column 600, top edge rows 414–416 = 63, 57, 26 → 15; bottom edge rows 481–484 = 28, 27, 40, 53 (was 14, 14, 53, 53).
  In the box x 450..800, y 400..520 the pixels with red 20..49 go from ≈ 1,250 (bias) to ≈ 3,400, the fully dark ones
  (red < 20) from ≈ 22,100 to ≈ 20,900. This is the solution (learnopengl's `shadow_mapping.fs`).

Coordinates (OpenGL): the light's projection gives NDC -1..1 in x, y and z, and the depth texture stores the window depth
0..1, so `projCoords = projCoords * 0.5 + 0.5` maps all three; texture v = 0 is the bottom row, the same direction as
NDC y, so no flip is needed.
