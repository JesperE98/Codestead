# Deferred Shading (Vulkan) – tasks

learnopengl "Deferred Shading": `src/5.advanced_lighting/8.1.deferred_shading` and `8.2.deferred_shading_volumes`.
Files: `main.cpp`, `textures/container2.png`, `textures/container2_specular.png`, and in `shaders/` (each built to
`<name>.spv`): `forward_shading.vert/.frag` (the start's forward renderer), `g_buffer.vert` (complete) / `g_buffer.frag`
(TODO), `deferred_shading.vert` (complete: the screen quad) / `deferred_shading.frag` (TODO),
`deferred_light_box.vert` (complete) / `deferred_light_box.frag` (TODO). A shader file whose `main` is a TODO compiles
(it writes nothing); the tasks fill it.

**Fixed choices (the same in every API):**
- **Camera: (0, 5, 9), yaw -90, pitch -35** (`cameraFront = (0, -0.5735764, -0.8191520)`), fov 45, 800/600, near 0.1,
  far 100, `GLM_FORCE_DEPTH_ZERO_TO_ONE` and `proj[1][1] *= -1` as always. learnopengl starts at (0, 0, 5) looking straight
  ahead: from there the front row hides the grid and most lights; from above and behind the whole 3 × 3 grid shows.
- **Boxes instead of learnopengl's backpack**: the `renderCube()` cube (vertices 0..35 of the one vertex buffer, 2×2×2,
  position + normal + texcoords, v flipped) at learnopengl's nine `objectPositions` (a `const std::vector<glm::vec3>`
  global: x -3, 0, 3; y -0.5; z -3, 0, 3), model = translate(objectPositions[i]) · **scale(0.75)** (boxes 1.5 units wide),
  in a `for` loop in `recordCommandBuffer()` with `vkCmdPushConstants` + `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`.
  `container2.png` (diffuse, `texture_diffuse1`, binding 1) and `container2_specular.png` (specular, `texture_specular1`,
  binding 2), loaded **linear** (`VK_FORMAT_R8G8B8A8_UNORM`: learnopengl's deferred demo does not gamma-correct), REPEAT,
  in `containerDescriptorSet` (uniform buffer at binding 0). Clear (0, 0, 0), depth test on, no culling. The screen quad
  is vertices 36..41 (`renderQuad()`).
- **32 lights**, learnopengl's: `createLights()` (called in `initVulkan()`) does `srand(13)` and the loop with learnopengl's
  formulas (per light x, y, z, then r, g, b; `rand() % 100`), filling the globals `std::vector<glm::vec3> lightPositions`
  and `lightColors` (`const unsigned int NR_LIGHTS = 32;`). Attenuation constant 1 (not sent), linear 0.7, quadratic 1.8.
- Uniform buffer: `struct Light { glm::vec3 position; float linear; glm::vec3 color; float quadratic; }` – **std140: a
  vec3 starts at a multiple of 16 bytes, so a float fills the 4 bytes after each vec3** (learnopengl's order is
  Position, Color, Linear, Quadratic: the floats are moved into the gaps so the C++ struct needs no padding; 32 bytes) –
  and `struct UniformBufferObject { glm::mat4 view; glm::mat4 proj; Light lights[NR_LIGHTS]; glm::vec3 viewPos; }`, filled
  in `updateUniformBuffer()` (a `for` loop: position, colour, `const float linear = 0.7f;`, `const float quadratic =
  1.8f;`; `viewPos = cameraPos`). The shaders declare the same `struct Light` and `Light lights[NR_LIGHTS]` (`const int
  NR_LIGHTS = 32;`).
- Lighting (learnopengl's deferred_shading.fs, in the start's `forward_shading.frag` too): ambient `Diffuse * 0.1`; per
  light diffuse `max(dot(Normal, lightDir), 0.0) * Diffuse * color`, Blinn-Phong specular `pow(max(dot(Normal,
  halfwayDir), 0.0), 16.0) * color * Specular` (Specular = the specular map's red channel), both times `1.0 / (1.0 +
  linear * d + quadratic * d * d)`; world space; no tone mapping, no gamma.
- **Start** = forward rendering: `forwardPipeline` (`forward_shading.vert/.frag`) draws the boxes straight into the
  window (window render pass with its own depth image), every fragment lit by all 32 lights – the same lighting code, so
  the deferred picture after `lighting-pass` equals the start. No light cubes yet. The forward shader files stay in the
  project after `g-buffer` (no longer used – like the OpenGL project).
- The pipeline helper: `createPipeline(vertFile, fragFile, pipelineRenderPass, colorAttachmentCount, pipeline)` (one
  blend state per colour attachment, up to 3); `light-cubes` adds a `VkBool32 depthTestEnable` parameter.
- Samplers: `createTextureSampler(VkFilter filter, VkSamplerAddressMode addressMode, VkSampler& sampler)`; anisotropic
  filtering only for `VK_FILTER_LINEAR` – a NEAREST sampler must return exactly one texel (with anisotropy on, lavapipe
  averages several texels even with NEAREST where the lookup's derivatives are large).
- No input (learnopengl's camera can fly; nothing depends on time).

**What the camera sees** (solution): the 3 × 3 grid of wooden boxes with steel frames from above and behind, the near
row large at the bottom (y ≈ 300..495), the far row small at the top (y ≈ 110..225), black around them; the boxes' tops
and the faces turned to nearby lights are lit warm, the rest dark (ambient 0.1). After `light-cubes`, 32 small pastel
cubes float between, above and below the boxes (those behind a box are hidden).

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every picture
equals the OpenGL chapter's (mean difference ≤ 0.27/255 (≤ 0.77 after `g-buffer`), ≤ 0.07 % of the pixels differ by more
than 24; the small differences: OpenGL's mipmapped textures vs. Vulkan's single level – e.g. back-frame 143 vs 149).
Named points (the OpenGL chapter's): **mid-box** (400,280), **front-top** (400,340), **front-face** (400,440),
**left-side** (195,400), **right-side** (610,400), **back-frame** (400,150), **left-top** (110,340), **background**
(400,50), **light-grey** (150,226), **light-orange** (609,233), **light-pink** (428,258), **light-mint** (288,212),
**light-cyan** (320,446), **light-purple** (543,556).

**Start picture** (forward rendering, no light cubes): mid-box = 77,46,25, front-top = 35,24,13, front-face = 15,10,5,
left-side = 86,59,32, right-side = 51,34,18, back-frame = 143,141,153, left-top = 33,22,12, background = 0,0,0,
light-grey = 34,24,13 (the box behind it), light-orange = 80,79,72 (a box frame), light-pink = 114,60,34 (the middle box),
light-mint = light-cyan = light-purple = 0,0,0.

## g-buffer
- **Task:** Render the boxes into a G-buffer instead of the window: a render pass with three colour attachments – positions (`VK_FORMAT_R16G16B16A16_SFLOAT`), normals (the same), albedo + specular (`VK_FORMAT_R8G8B8A8_UNORM`) – and a depth attachment, filled by the geometry pass (`g_buffer.vert/.frag`). Then draw the screen quad into the window with the lighting pass's shader, which for now shows the albedo.
- **Hint:** `createGBufferRenderPass()`: three colour attachments (CLEAR, STORE, final layout `SHADER_READ_ONLY_OPTIMAL`), `std::array<VkAttachmentReference, 3>` (attachments 0, 1, 2 = the fragment shader's locations 0, 1, 2 – learnopengl's `glDrawBuffers`), depth at attachment 3, the two subpass dependencies of the HDR chapter. `createGBuffer()`: three images (colour attachment + sampled) + views, a depth image, a framebuffer with the four views. `geometryPipeline` = `createPipeline("shaders/g_buffer.vert.spv", "shaders/g_buffer.frag.spv", gBufferRenderPass, 3, …)`, `lightingPipeline` = `createPipeline("shaders/deferred_shading.vert.spv", "shaders/deferred_shading.frag.spv", renderPass, 1, …)` (instead of `forwardPipeline`). The layout gets binding 3; `createGBufferDescriptorSet()` writes the uniform buffer and the three images (bindings 1–3) with `gBufferSampler` (NEAREST, CLAMP_TO_EDGE – learnopengl's GL_NEAREST). In `recordCommandBuffer()`: the geometry pass (four clear values) with the boxes, then the window's pass with the quad (`vkCmdDraw(commandBuffer, 6, 1, 36, 0)`) and `gBufferDescriptorSet`. `g_buffer.frag`: `layout(location = 0/1/2) out vec4 gPosition / gNormal / gAlbedoSpec`.
- **When done:** `main.cpp`: `gBufferRenderPass` (`createGBufferRenderPass()`: `positionAttachment`
  `VK_FORMAT_R16G16B16A16_SFLOAT`, `normalAttachment = positionAttachment`, `albedoSpecAttachment` with
  `VK_FORMAT_R8G8B8A8_UNORM`, `depthAttachment` `findDepthFormat()`, `std::array<VkAttachmentReference, 3>
  colorAttachmentRefs`, `depthAttachmentRef.attachment = 3`, two dependencies); `gPositionImage` / `gNormalImage` /
  `gAlbedoSpecImage` (+ `…Memory`, `…ImageView`), `gBufferDepthImage…`, `gBufferFramebuffer` (`createGBuffer()`, called
  before `createFramebuffers()`); `geometryPipeline` and `lightingPipeline` replace `forwardPipeline`; `gBufferSampler`
  = `createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, …)`; the layout's
  `sampler3LayoutBinding` (binding 3); pool 2 uniform buffers / 6 samplers, `maxSets = 2`;
  `createGBufferDescriptorSet(gPositionImageView, gNormalImageView, gAlbedoSpecImageView, gBufferSampler,
  gBufferDescriptorSet)` (four `VkWriteDescriptorSet`s); everything destroyed in `cleanup()`. `recordCommandBuffer()`:
  `// 1. geometry pass` (`gBufferRenderPass`, `gBufferFramebuffer`, `std::array<VkClearValue, 4> gBufferClearValues`,
  viewport, scissor, vertex buffer, `geometryPipeline`, `containerDescriptorSet`, the nine boxes) and `// 2. lighting
  pass` (the window's pass, `lightingPipeline`, `gBufferDescriptorSet`, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`).
  `g_buffer.frag`: `gPosition = vec4(fs_in.fragPos, 1.0)`, `gNormal = vec4(normalize(fs_in.normal), 1.0)`,
  `gAlbedoSpec.rgb = texture(texture_diffuse1, …).rgb`, `gAlbedoSpec.a = texture(texture_specular1, …).r`.
  `deferred_shading.frag`: `layout(binding = 3) uniform sampler2D gAlbedoSpec;` and `outColor = vec4(Diffuse, 1.0)`
  ("for now: show the G-buffer's albedo"). The window shows the **albedo, unlit**: mid-box = 138,91,48, front-top =
  150,98,52, front-face = 150,98,52, left-side = 150,98,52, right-side = 134,88,46, back-frame = 150,152,158, left-top =
  150,98,52, light-grey = 150,98,52, light-orange = 150,152,158, light-pink = 134,88,46, background = light-mint =
  light-cyan = light-purple = 0,0,0 – every face equally bright: wood ≈ 150,98,52, steel ≈ 150,152,158.

## lighting-pass
- **Task:** Light the G-buffer in the lighting pass: in `deferred_shading.frag` read the position, normal, albedo and specular from the G-buffer's three images and compute learnopengl's lighting with the 32 lights and the view position from the uniform buffer.
- **Hint:** The lights and `viewPos` are already in the uniform buffer (`updateUniformBuffer()`), and `gBufferDescriptorSet` has it at binding 0: only the shader changes. Declare `struct Light` and the uniform block like `forward_shading.frag`, `gPosition` / `gNormal` / `gAlbedoSpec` at bindings 1, 2, 3; then `vec3 lighting = Diffuse * 0.1;`, `vec3 viewDir = normalize(ubo.viewPos - FragPos);` and per light the diffuse, Blinn-Phong specular (`pow(…, 16.0)` × `Specular`) and attenuation – the forward shader's code.
- **When done:** `deferred_shading.frag`: `const int NR_LIGHTS = 32;`, `struct Light { vec3 position; float linear; vec3
  color; float quadratic; };`, `layout(binding = 0) uniform UniformBufferObject { mat4 view; mat4 proj; Light
  lights[NR_LIGHTS]; vec3 viewPos; } ubo;`, `layout(binding = 1) uniform sampler2D gPosition;`, `(binding = 2) gNormal`,
  `(binding = 3) gAlbedoSpec`; `FragPos`, `Normal`, `Diffuse` (`.rgb`), `Specular` (`.a`) from the G-buffer and
  learnopengl's 8.1 loop (`for (int i = 0; i < NR_LIGHTS; ++i)`); `outColor = vec4(lighting, 1.0)`. `main.cpp` is
  unchanged. The picture is **the start picture again** (measured: no pixel differs by more than 1 from the forward
  rendering): mid-box = 77,46,25, front-top = 35,24,13, front-face = 15,10,5, left-side = 86,59,32, right-side =
  51,34,18, back-frame = 143,141,153, left-top = 33,22,12, light-grey = 34,24,13, light-orange = 80,80,72, light-pink =
  114,60,34, background = light-mint = light-cyan = light-purple = 0,0,0.

## light-cubes
- **Task:** Show the lights: draw a small cube at every light (scale 0.125) in the light's colour with `deferred_light_box.vert/.frag`, in the window's pass after the screen quad, depth-tested against the boxes – the window's pass uses the G-buffer's depth image as its depth attachment.
- **Hint:** learnopengl copies the G-buffer's depth into the window's with `glBlitFramebuffer`; `vkCmdBlitImage` cannot blit depth images on every device (it needs `VK_FORMAT_FEATURE_BLIT_SRC/DST_BIT` for the depth format), and copying (`vkCmdCopyImage`) needs two depth images and barriers – but Vulkan can simply **use the G-buffer's depth image in the window's framebuffer**: the geometry pass keeps it (`storeOp = STORE`), the window's render pass loads it (`loadOp = LOAD`, `initialLayout = DEPTH_STENCIL_ATTACHMENT_OPTIMAL`, the dependency's `dstAccessMask` + `DEPTH_STENCIL_ATTACHMENT_READ_BIT`), and the window's own depth image goes away. The quad must neither be hidden by that depth nor overwrite it: `createPipeline(…, VkBool32 depthTestEnable, …)` (`depthTestEnable` and `depthWriteEnable`), `VK_FALSE` for `lightingPipeline`. `PushConstants` gets `glm::vec3 lightColor;` (the range now for the vertex **and** fragment stages – every `vkCmdPushConstants` too).
- **When done:** `main.cpp`: `struct PushConstants { glm::mat4 model; glm::vec3 lightColor; };`,
  `pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT` and the same flags in the
  boxes' `vkCmdPushConstants`; `createPipeline(…, uint32_t colorAttachmentCount, VkBool32 depthTestEnable, VkPipeline&
  pipeline)` with `depthStencil.depthTestEnable = depthTestEnable; depthStencil.depthWriteEnable = depthTestEnable;`,
  called with `VK_TRUE` (geometry), `VK_FALSE` (lighting) and `VK_TRUE` for the new `lightBoxPipeline`
  (`"shaders/deferred_light_box.vert.spv"`, `"shaders/deferred_light_box.frag.spv"`, `renderPass`, 1); the G-buffer's
  `depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE`; the window's `depthAttachment.loadOp =
  VK_ATTACHMENT_LOAD_OP_LOAD`, `initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL`, the dependency's
  `dstAccessMask` with `VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_READ_BIT`; `createFramebuffers()` uses
  `gBufferDepthImageView`; `depthImage` / `depthImageMemory` / `depthImageView` and `createDepthResources()` are gone;
  in `recordCommandBuffer()` after the quad `// 3. render lights on top of scene`: `lightBoxPipeline` and the loop over
  `lightPositions.size()` with translate(lightPositions[i]) · scale(0.125), `constants.lightColor = lightColors[i]`,
  `vkCmdPushConstants` (vertex | fragment), `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`. `deferred_light_box.frag`: the push
  constant block `{ mat4 model; vec3 lightColor; }` and `outColor = vec4(pc.lightColor, 1.0)`. **32 small pastel cubes**
  appear (a few hidden behind boxes): light-grey = 161,159,163, light-orange = 244,209,158, light-pink = 238,150,171,
  light-mint = 143,204,181, light-cyan = 129,242,231, light-purple = 201,157,237; everything else as before (mid-box =
  77,46,25, back-frame = 143,141,153, background = 0,0,0 …); 13,569 pixels change by more than 2.

## light-volumes
- **Task:** Give every light a radius (learnopengl's light volume: the distance where its attenuated brightness falls below 5/256), send it in the uniform buffer, and skip the light in the lighting shader where the fragment is farther away.
- **Hint:** `float radius;` in `Light` – then the struct is 36 bytes, and **std140 rounds an array element (a struct) up to a multiple of 16 bytes: 48**, so C++ adds `float pad1, pad2, pad3;`. In `updateUniformBuffer()`'s loop: `const float constant = 1.0f;`, `const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);`, `float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);`, `ubo.lights[i].radius = radius;`. In the shader: `float radius;` in `Light`, the distance first, then `if (distance < ubo.lights[i].radius) { … }`.
- **When done:** `main.cpp`: `struct Light { …; float quadratic; float radius; float pad1; float pad2; float pad3; }`
  (stride 48), `// update attenuation parameters and calculate radius`, `const float constant = 1.0f;`, `// then
  calculate radius of light volume/sphere`, `maxBrightness` with `std::fmaxf`, `radius` with `std::sqrt`,
  `ubo.lights[i].radius = radius;`. `deferred_shading.frag`: `float radius;` in `Light` and learnopengl's 8.2 loop
  (`float distance = …; if (distance < ubo.lights[i].radius) { … }`). The radii are about 3.5 (colour 0.5) to 5.1 (colour
  1.0). The picture is **almost the same, a little darker where many lights just outside their radius used to add up**:
  28,588 pixels get darker by more than 5 (8,038 by more than 20, at most 44; none brighter), mainly the steel frames of
  the far row and the inner sides of the front corner boxes: back-frame = 113,109,120 (before 143,141,153), left-side =
  66,46,25 (86,59,32), right-side = 37,24,12 (51,34,18), mid-box = 76,45,24, left-top = 31,20,11; unchanged: front-top =
  35,24,13, front-face = 15,10,5, the light cubes, background = 0,0,0. Why a real renderer goes further: the `if` saves
  little on a GPU – the fragments of a group run in lockstep, so the loop still costs every light wherever one fragment
  of the group needs it. learnopengl's answer is to draw each light's **volume** (a sphere of that radius) and light only
  the pixels it covers – the lighting shader then runs once per light per covered pixel (with front-face culling, so it
  also works when the camera is inside a volume). This is the solution.
