# Cubemaps (Vulkan) – a skybox, then cubes that mirror and bend it (learnopengl "Cubemaps")

learnopengl `6.1.cubemaps_skybox` and `6.2.cubemaps_environment_mapping`. Files: `main.cpp`, `shaders/cubemaps.vert` /
`.frag` (the cubes), `shaders/skybox.vert` / `.frag` (TODOs in start), `textures/marble.png`, and the sky's six images
`textures/skybox/right.png`, `left.png`, `top.png`, `bottom.png`, `front.png`, `back.png` (+X, -X, +Y, -Y, +Z, -Z; 256×256).

Start: the depth-testing scene **without the floor** (learnopengl draws only the cubes here): the two marble cubes at
(-1, 0, -1) and (2, 0, 0), camera (0, 0, 3) looking down -z, clear colour (0.1, 0.1, 0.1). One vertex buffer (cube vertices
0..35), `loadTexture` / `createTextureSampler` / `createDescriptorSet` helpers, one descriptor set (pool of 1),
`createPipeline(vert, frag, pipeline)`, the model matrix in a push constant, view/projection in the uniform buffer. In
`recordCommandBuffer()` the pipeline is bound after the vertex buffer, with a TODO for the skybox before it.

A Vulkan cube map is **one image with 6 array layers** (created with `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`), read through
a **`VK_IMAGE_VIEW_TYPE_CUBE` view** as a `samplerCube`. It uses the same face order and orientation rules as OpenGL, and
the y flip in the projection only turns the picture upright – the directions in the world are the same – so the images
are loaded **without flipping** and the sky looks exactly like the OpenGL chapter's.

Pixels measured on lavapipe (800×600, from the top left; nothing depends on time), equal to the OpenGL chapter's:
- start: **background** (400,100), (600,60), (400,500) = 26,26,26; **cube0-centre** (193,300) = 141,140,138 (a vein),
  **cube0-light** (150,250) = 208,204,194; **cube1** (760,250) = 163,161,156.
- the sky (from `skybox` on): **sky** (400,100) = 128,164,219, (600,60) = 113,153,215; **mountain** (400,250) =
  108,120,144, (500,270) = 102,114,138; **haze** just below the horizon (400,330) = 144,176,175; **ground** (400,500) =
  85,132,56, (100,550) = 70,120,50 (green checkerboard).

## load-cubemap
- **Task:** Add `loadCubemap(faces, image, imageMemory, imageView)`: load the six images with `stbi_load` (RGBA, no flip),
  copy them one after the other into one staging buffer, create the image with `arrayLayers = 6` and
  `flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, transition all 6 layers to `TRANSFER_DST_OPTIMAL`, copy face i of the
  buffer to array layer i (`bufferOffset = faceSize * i`, `baseArrayLayer = i`), transition to `SHADER_READ_ONLY_OPTIMAL`,
  and create a `VK_IMAGE_VIEW_TYPE_CUBE` view of the 6 layers. In `initVulkan()` call it with
  `std::vector<std::string> faces` = right, left, top, bottom, front, back (`textures/skybox/…`), and create
  `cubemapSampler` with `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, cubemapSampler)`. Destroy them in
  `cleanup()`.
- **Hint:** Array layer i is learnopengl's `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`. Clamp to edge avoids seams where two faces
  meet. The barriers cover all six layers (`layerCount = 6`).
- **When done:** no visible change (the cube map is not used yet): all points as at the start. Code:
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, `arrayLayers = 6`, `VK_IMAGE_VIEW_TYPE_CUBE`, six copy regions, the six file
  names in this order.

## skybox
- **Task:** Draw the sky: add learnopengl's `skyboxVertices` to `vertices` (vertices 36..71, positions only:
  `{{-1.0f, 1.0f, -1.0f}}` …), a pipeline `skyboxPipeline` from `skybox.vert/.frag` **without depth writes**
  (createPipeline gets `uint32_t attributeCount, VkBool32 depthWriteEnable, VkCompareOp depthCompareOp` parameters:
  `2, VK_TRUE, VK_COMPARE_OP_LESS` for the cubes, `1, VK_FALSE, VK_COMPARE_OP_LESS` for the skybox), a descriptor set
  `createDescriptorSet(cubemapImageView, cubemapSampler, skyboxDescriptorSet)` (pool: 2 sets), and draw it **first** in
  `recordCommandBuffer()`: bind `skyboxPipeline` and `skyboxDescriptorSet`, `vkCmdDraw(commandBuffer, 36, 1, 36, 0)`.
  `skybox.vert`: `fragTexCoord = inPosition;` and `gl_Position = ubo.proj * mat4(mat3(ubo.view)) * vec4(inPosition, 1.0);`
  `skybox.frag`: `outColor = texture(skybox, fragTexCoord);`.
- **Hint:** A cube map is sampled with a direction: the position of a skybox vertex is its direction from the centre.
  `mat4(mat3(view))` drops the view's translation, so the sky never comes nearer when the camera moves (learnopengl does
  this in C++; with one uniform buffer for all pipelines it is done in the shader). The skybox's shader reads only the
  position: with `attributeCount = 1` the pipeline describes only that attribute (a described attribute the shader does
  not read draws a validation performance warning).
- **When done:** the sky appears behind the cubes: the sky/mountain/haze/ground values above; **cube0-centre** (193,300),
  **cube0-light** (150,250) and **cube1** (760,250) unchanged (marble; also (193,230) = 194,191,183, (193,288) =
  188,185,178, (193,380) = 195,192,184). Code: `skyboxPipeline` with
  `depthWriteEnable = VK_FALSE`, its draw recorded before the cubes'.

## skybox-last
- **Task:** learnopengl's optimisation: draw the skybox **last** with `VK_COMPARE_OP_LESS_OR_EQUAL` in its pipeline, and
  in `skybox.vert` put it at the far plane: `vec4 pos = ubo.proj * view * vec4(inPosition, 1.0); gl_Position = pos.xyww;`.
- **Hint:** With z = w the depth after the perspective divide is 1.0 – the cleared depth. LESS_OR_EQUAL lets the sky pass
  where nothing was drawn (1.0 ≤ 1.0), and the fragment shader no longer runs for the pixels the cubes cover.
- **When done:** no visible change: all points as after `skybox`. Code: the skybox's draw after the cubes',
  `VK_COMPARE_OP_LESS_OR_EQUAL` for `skyboxPipeline`, `pos.xyww`.

## reflection
- **Task:** Make the cubes mirrors: `Vertex` gets `glm::vec3 normal` instead of the texture coordinates (attribute 1:
  `VK_FORMAT_R32G32B32_SFLOAT`, `offsetof(Vertex, normal)`), the cube's 36 vertices become learnopengl's position + normal
  vertices, the uniform buffer gets `glm::vec3 cameraPos` (set in `updateUniformBuffer()`, the binding visible to the
  fragment stage too), the cubes bind `skyboxDescriptorSet` (the marble texture, its sampler and its set are removed; pool:
  1 set). `cubemaps.vert` outputs `fragNormal = mat3(transpose(inverse(pc.model))) * inNormal` and the world position;
  `cubemaps.frag`: `I = normalize(fragPosition - ubo.cameraPos)`, `R = reflect(I, normalize(fragNormal))`,
  `outColor = vec4(texture(skybox, R).rgb, 1.0)`.
- **Hint:** The view ray is mirrored at the surface and looks up the sky in that direction. `cameraPos` follows `proj` at
  offset 128, a multiple of 16, so the C++ struct and the std140 block agree without padding (it is the last member).
- **When done:** the cubes show the mirrored sky, their marble is gone. Cube 0's front face (x 90..319, y 197..402)
  shows sky above, a band of mountains at y ≈ 272..302 and the ground below: **cube0-upper** (193,230) = 159,191,230,
  **cube0-band** (193,288) = 103,115,139, **cube0-lower** (193,380) = 109,150,112, **cube0-light** (150,250) =
  157,191,230, **cube1** (760,250) = 158,192,230 (sky); (193,300) lies on the band's lower edge (135,157,178) – use the
  points above. The sky points unchanged.

## refraction
- **Task:** Make the cubes glass: in `cubemaps.frag` use `float ratio = 1.00 / 1.52;` and
  `R = refract(I, normalize(fragNormal), ratio)` instead of `reflect`.
- **Hint:** The ray is bent where it enters the glass (from air, 1.00, into glass, 1.52), so you see the sky behind the
  cube, slightly shifted and magnified.
- **When done (the solution):** the cubes are almost invisible glass blocks; through cube 0 the mountains look taller
  (y ≈ 200..302): **cube0-upper** (193,230) = 111,123,147, **cube0-band** (193,288) = 95,107,131, **cube0-lower**
  (193,380) = 132,168,148, **cube0-light** (150,250) = 106,118,142, **cube1** (760,250) = 159,191,226; the sky points
  unchanged.
