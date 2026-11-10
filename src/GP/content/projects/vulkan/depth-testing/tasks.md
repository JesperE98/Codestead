# Depth Testing (Vulkan) – the depth function and the depth buffer made visible (learnopengl "Depth testing")

learnopengl `1.1.depth_testing` and `1.2.depth_testing_view`. Files: `main.cpp`, `shaders/depth_testing.vert` /
`.frag` (built to `shaders/depth_testing.vert.spv` / `.frag.spv`), `textures/marble.png` (the cubes), `textures/metal.png`
(the floor).

Start: learnopengl's depth-testing scene in the program of the earlier chapters (HelloTriangleApplication, one frame in
flight, camera globals with mouse look / WASD / zoom; no input → cameraPos (0, 0, 3), cameraFront (0, 0, -1), yaw -90,
pitch 0, fov 45; projection 45°, 800/600, 0.1, 100 with `GLM_FORCE_DEPTH_ZERO_TO_ONE` and `proj[1][1] *= -1`), clear
colour (0.1, 0.1, 0.1). Changes from the lighting chapters, kept in all four chapters of this part:
- `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }`; **one vertex buffer** `vertices` holds the cube
  (learnopengl's 36 vertices, v flipped to 1 - v so the images are upright: vertices 0..35) and the floor
  (learnopengl's `planeVertices`, v flipped to 2 - v: vertices 36..41). Each draw picks its part with `firstVertex`:
  `vkCmdDraw(commandBuffer, 36, 1, 0, 0)` for a cube, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)` for the floor.
- Descriptor set layout like vulkan-tutorial: the uniform buffer (view, proj) at **binding 0**, a combined image
  sampler at **binding 1**. **One descriptor set per texture**: `createDescriptorSet(cubeTextureImageView,
  textureSampler, cubeDescriptorSet)` and `(floorTextureImageView, textureSampler, floorDescriptorSet)`, pool with
  maxSets 2. `recordCommandBuffer()` binds the right set with `vkCmdBindDescriptorSets` before each draw (Vulkan's
  glBindTexture).
- `loadTexture(path, image, memory, view)` (stbi_load → staging buffer → image → view), called in `initVulkan()` for
  `"textures/marble.png"` and `"textures/metal.png"`; `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT,
  textureSampler)` (the floor's coordinates go up to 2).
- One pipeline, `createPipeline("shaders/depth_testing.vert.spv", "shaders/depth_testing.frag.spv", graphicsPipeline)`:
  cull mode NONE, depth test and write on, `depthStencil.depthCompareOp = VK_COMPARE_OP_LESS`.
- Draw order as learnopengl: cube 0 (translate (-1, 0, -1)), cube 1 (translate (2, 0, 0)), floor (identity); the model
  matrix in the push constant.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. The same
points as the OpenGL chapter (the Vulkan pictures equal OpenGL's except for texture filtering of far/minified texels:
no mipmaps here):
- **background** (400,100) and (30,150) = 26,26,26.
- **cube 0** (left, front face x ≈ 90..319, y ≈ 197..402): **cube0-centre** (193,300) ≈ 141,140,138 (a vein),
  **cube0-light** (150,250) ≈ 208,204,194, **cube0-bottom** (193,390) ≈ 193,190,182.
- **cube 1**: only its left face at the right edge: (760,250) ≈ 163,161,156.
- **floor**: horizon at y ≈ 345; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93 (dark stripe),
  **floor-far** (600,370) ≈ 130,134,140.

## depth-always
- **Task:** Let every fragment pass the depth test: in `createPipeline()` set
  `depthStencil.depthCompareOp = VK_COMPARE_OP_ALWAYS;`.
- **Hint:** In Vulkan the depth function is part of the pipeline (OpenGL's `glDepthFunc(GL_ALWAYS)`). With ALWAYS
  the last fragment drawn wins – the same as switching the depth test off.
- **When done:** the floor (drawn last) covers the lower parts of the cubes: **cube0-bottom** (193,390) ≈ 150,154,160
  (floor; was marble 193,190,182); inside each cube the faces drawn later (back/left/top) show over the front face
  (the left cube's top/left faces become visible in its upper part). Background, **cube0-centre**, (760,250) and the
  floor points unchanged. Code: `VK_COMPARE_OP_ALWAYS` assigned to `depthCompareOp`.

## depth-less
- **Task:** Set the depth function back to `VK_COMPARE_OP_LESS`.
- **Hint:** LESS: a fragment passes when it is nearer than the depth already stored – OpenGL's default `GL_LESS`.
- **When done:** the start picture is back: **cube0-bottom** (193,390) ≈ 193,190,182 again, all points as at the start.

## visualize-depth
- **Task:** In `shaders/depth_testing.frag` output the fragment's depth as a grey: `outColor = vec4(vec3(gl_FragCoord.z), 1.0);`.
- **Hint:** `gl_FragCoord.z` is the value the depth test compares: 0.0 at the near plane, 1.0 at the far plane, and
  far from linear – most of the range is used close to the camera.
- **When done:** everything drawn is almost white, the background stays 26,26,26: **cube0-centre** (193,300) = 248,
  (760,250) = 247, **floor-near** (100,500) = 241, (400,560) = 237, **floor-far** (600,370) = 250 (grey values, r = g = b).

## linear-depth
- **Task:** Turn the depth back into a distance: add learnopengl's `near = 0.1`, `far = 100.0` and
  `LinearizeDepth(depth) = (near * far) / (far - depth * (far - near))`, and output
  `vec4(vec3(LinearizeDepth(gl_FragCoord.z) / far), 1.0)`.
- **Hint:** learnopengl first maps the depth back to NDC with `depth * 2.0 - 1.0`, because OpenGL's NDC z runs from -1
  to 1. Vulkan's NDC z already runs from 0 to 1 (and `GLM_FORCE_DEPTH_ZERO_TO_ONE` makes the projection use that), so
  the window depth *is* the NDC z: invert the projection directly – d = near·far / (far − z·(far − near)). Using
  OpenGL's formula here would give wrong (too large) distances.
- **When done:** near objects are almost black, the floor grows lighter towards the horizon, the background stays
  26,26,26: **cube0-centre** (193,300) = 9 (≈ 3.5 / 100), (760,250) = 8, **floor-near** (100,500) = 5, (400,560) = 4,
  **floor-far** (600,370) = 13 (grey values). Identical to the OpenGL chapter's final picture.
