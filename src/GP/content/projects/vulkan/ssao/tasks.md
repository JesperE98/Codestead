# SSAO (Vulkan) – tasks

learnopengl "SSAO": `src/5.advanced_lighting/9.ssao`. Files: `main.cpp`, the read-only model in `models/`
(`planet.obj`, `planet.mtl` and its four textures – the textures are not used here), and in `shaders/` (each built to
`<name>.spv`): `ssao_geometry.vert/.frag` (the geometry pass), `ssao.vert` (the screen quad, shared by the three screen
passes), `ssao_lighting.frag` (the lighting pass), `ssao.frag` and `ssao_blur.frag` (their `main` is a TODO in the start:
they compile and write nothing until the tasks fill them).

**Fixed choices (the same in every API):**
- learnopengl's scene with the course's planet instead of learnopengl's **backpack** model: the room = the
  `renderCube()` cube (vertices 0..35 of `vertexBuffer`, with the screen quad at 36..41) with model = translate(0, 7, 0)
  · scale(7.5) and `invertedNormals = VK_TRUE` (the inside is seen: floor at y = -0.5, back wall at z = -7.5); the planet
  (the Model Loading part's `loadModel(MODEL_PATH, modelVertices, modelIndices)` with tinyobjloader, `MODEL_PATH =
  "models/planet.obj"`, de-duplicated vertices, its own vertex and index buffers, one `vkCmdDrawIndexed` for both
  objects – sphere radius 1 and the flat ring 1.4–2.0 in the xz plane, normal +y) with model = translate(0, 0.5, 0) ·
  scale(1.0): it stands on the floor. learnopengl rotates the backpack -90° about x – the planet is not rotated.
  `struct PushConstants { glm::mat4 model; VkBool32 invertedNormals; }` (a GLSL `bool` is 4 bytes), vertex stage.
- Camera (0, 0, 5) looking down -z (yaw -90, pitch 0), fov 45, 800/600, near 0.1, **far 50** (learnopengl's ssao.cpp
  uses 50), `GLM_FORCE_DEPTH_ZERO_TO_ONE` and `proj[1][1] *= -1`. Clear (0, 0, 0), no culling. The ring at y = 0.5 is just
  above the eye: it is seen **from below**.
- G-buffer in **view space** (learnopengl's ssao_geometry.vs: `fragPos = (view * model * pos).xyz`, normal matrix
  `transpose(inverse(mat3(view * model)))`, the normal negated when `invertedNormals`): `gPosition` and `gNormal`
  `VK_FORMAT_R16G16B16A16_SFLOAT`, `gAlbedo` `VK_FORMAT_R8G8B8A8_UNORM`, + a depth image; all sampled with
  `gBufferSampler` (NEAREST, **CLAMP_TO_EDGE**: the SSAO samples near the window's edges must not wrap; anisotropic
  filtering off for NEAREST samplers – with it, lavapipe averages several texels where the SSAO lookups' derivatives
  are large, and the AO comes out too dark). Albedo = `vec4(vec3(0.95), 1.0)` for everything (learnopengl's).
- **One descriptor set for all passes** (`descriptorSet`, like vulkan-tutorial's, written in `createDescriptorSet()` from
  the members): the uniform buffer at binding 0, gPosition / gNormal / gAlbedo at 1 / 2 / 3; the tasks add the noise
  texture (4), the SSAO image (5) and the blurred SSAO image (6). Each pass's shaders read only the bindings they
  declare (the geometry pass only the uniform buffer).
- The window's render pass has **no depth attachment** (only the screen quad is drawn into it); the screen quads' pipelines
  are made with `depthTestEnable = VK_FALSE` (`createPipeline(…, colorAttachmentCount, depthTestEnable, …)` from the
  deferred-shading chapter).
- One light: position (2, 4, -2) in world space, sent in **view space** (`glm::vec3(ubo.view * glm::vec4(lightPos,
  1.0))` in `updateUniformBuffer()`), colour (0.2, 0.2, 0.7), linear 0.09, quadratic 0.032: `struct Light { glm::vec3
  position; float linear; glm::vec3 color; float quadratic; }` (std140: a float fills the 4 bytes after each vec3) in
  the uniform buffer. `ssao_lighting.frag` (learnopengl's): ambient `0.3 * Diffuse` (× AO after `apply`), diffuse,
  Blinn-Phong specular `pow(…, 8.0)` with viewDir = `normalize(-FragPos)`, attenuated.
- **Kernel: 32 samples** (learnopengl 64; the course's simulator computes the SSAO pass on the CPU), radius 0.5, bias
  0.025, `int kernelSize = 32;` in `ssao.frag`. **Random numbers: `srand(42)` and `rand() / (float)RAND_MAX`** instead of
  learnopengl's `std::uniform_real_distribution` + `std::default_random_engine` (whose sequence differs between standard
  libraries): the course's simulator reproduces glibc's rand() exactly. Every random number gets its own statement
  (`float x = …; float y = …; float z = …;`) – C++ does not fix the order in which a function's arguments are evaluated.
  Order: per sample x, y (`* 2.0f - 1.0f`), z (0..1), then the length factor; `scale = ourLerp(0.1f, 1.0f, (i /
  32.0f)²)`; then the 16 noise vectors (x, y). `generateSampleKernel()` fills the member `std::vector<glm::vec3>
  ssaoKernel`; `updateUniformBuffer()` copies it into `glm::vec4 samples[32]` (**std140: array elements are 16 bytes
  apart – vec4s, xyz used**).
- Noise texture 4 × 4 `VK_FORMAT_R32G32B32A32_SFLOAT` (learnopengl's `GL_RGBA32F`; the noise vectors are `glm::vec4(x,
  y, 0, 0)` because Vulkan devices need not sample 3-channel float images), uploaded through a staging buffer
  (`createNoiseTexture()`), sampled with `noiseSampler` (NEAREST, **REPEAT**) and `noiseScale = vec2(800.0/4.0,
  600.0/4.0)`. SSAO target: `VK_FORMAT_R8_UNORM` (learnopengl's `GL_RED`), 800 × 600; the blur target the same, drawn
  with the same render pass (`ssaoRenderPass`: one colour attachment, loadOp DONT_CARE – the quad covers every pixel –,
  final layout `SHADER_READ_ONLY_OPTIMAL`, no depth).
- `ssao.frag` projects the samples with `ubo.proj` and `offset.xy * 0.5 + 0.5`: with the flipped projection the clip
  space y points down, like the image's v, so no extra flip is needed (only xy are used, Vulkan's depth is 0..1 anyway).
- What the window shows in between: after `kernel` and `blur` the lighting pass still runs, but `ssao_lighting.frag`
  ends with `outColor = vec4(vec3(texture(ssao, fragTexCoord).r), 1.0); // for now: show the SSAO texture` – the grey AO
  texture (binding 5, the raw SSAO image, after `kernel`; binding 6, the blurred one, after `blur`). `apply` removes the
  line.
- No input (nothing depends on time).

**What the camera sees** (start / solution): the inside of a large grey room lit blue from the upper right: the back
wall, the floor below y ≈ 327, and the grey planet in the middle (x ≈ 252..548, y ≈ 75..372) standing on the floor; its
front gets only the ambient light, its upper right edge is lit blue. The ring crosses in front of it from x ≈ 85 to 715
(y ≈ 180..245), seen from below. **Why the ring is dark in the AO picture:** it is a single plane whose normal points up
(+y), and the camera sees its underside; SSAO puts its hemisphere of samples on the normal's side – behind the ring as
the camera sees it – so most samples count as occluded (learnopengl's backpack has no such one-sided surfaces).

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Named points
(the OpenGL chapter's): **planet** (400,280), **planet-left** (300,240), **planet-lit** (470,110), **above-ring**
(400,172), **ring-mid** (400,190), **ring-left** (150,213), **ring-right** (650,215), **contact** (400,376),
**contact-left** (340,372), **edge** (100,327), **floor** (400,500), **wall** (100,100), **wall-lit** (520,40).
Comparison with OpenGL: the start is identical (mean difference 0.01/255); the AO pictures agree in their statistics
(45,332 pixels below 250 after `kernel`, OpenGL 45,069; neighbour difference 0.82 / 0.11 after `kernel` / `blur`,
OpenGL 0.85 / 0.11) but not pixel for pixel: the 4 × 4 noise is tiled from the window's **top** in Vulkan (v points
down) and from its bottom in OpenGL, so a pixel gets another of the 16 rotations (single raw-AO pixels differ by up to
65), and learnopengl's blur window (offsets -2..1) leans the other way vertically (half a pixel up instead of down) –
at the sharp contact shadow under the planet this matters: contact = 127 here, 161 in OpenGL after `blur`. Checks on
single AO pixels need a tolerance (or use areas); the final picture differs by at most 17 (≤ 0.23 mean, no pixel by
more than 24).

**Start picture** (deferred, no AO): planet = 73,73,73, planet-left = 73,73,73, planet-lit = 103,103,179, above-ring =
73,73,75, ring-mid = 87,87,122, ring-left = 84,84,114, ring-right = 99,99,165, contact = 93,93,144, contact-left =
91,91,136, edge = 79,79,95, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199.

## kernel
- **Task:** Generate the SSAO input on the CPU – the 32-sample kernel in a hemisphere (`srand(42)`, `rand() / (float)RAND_MAX`) and the 4 × 4 noise texture of random rotations – and add the SSAO pass: a render pass with one `VK_FORMAT_R8_UNORM` colour attachment, filled by `ssao.frag` on the screen quad. For now show the SSAO image in the window.
- **Hint:** `generateSampleKernel()`: per sample `x`, `y` = `rand() / (float)RAND_MAX * 2.0f - 1.0f`, `z` = `rand() / (float)RAND_MAX`; normalize, multiply by another random float, then by `ourLerp(0.1f, 1.0f, scale * scale)` with `scale = float(i) / 32.0f`; `ssaoKernel.push_back(sample)`. `createNoiseTexture()`: 16 × `glm::vec4(x, y, 0.0f, 0.0f)`, a staging buffer, a 4 × 4 `VK_FORMAT_R32G32B32A32_SFLOAT` image (transfer destination + sampled), `transitionImageLayout` / `copyBufferToImage` / `transitionImageLayout` as for a texture, its view; `noiseSampler` NEAREST + REPEAT. `createSsaoRenderPass()` like the bloom chapter's blur pass, `createSsaoFramebuffers()`: the image (colour attachment + sampled), its view and framebuffer. `ssaoPipeline` = `createPipeline("shaders/ssao.vert.spv", "shaders/ssao.frag.spv", ssaoRenderPass, 1, VK_FALSE, …)`. Bindings 4 (noise) and 5 (SSAO image) in the layout, the pool (5 samplers) and `createDescriptorSet()`. The uniform buffer gets `glm::vec4 samples[32]`, filled from `ssaoKernel` every frame. In `recordCommandBuffer()` between the geometry pass and the window's pass: `// 2. generate SSAO texture` (`ssaoRenderPass`, `ssaoFramebuffer`, no clear values, `ssaoPipeline`, the quad). `ssao.frag`: learnopengl's `main` with `ubo.samples[i].xyz` and `ubo.proj`. `ssao_lighting.frag`: `layout(binding = 5) uniform sampler2D ssao;` and the "for now" line.
- **When done:** `main.cpp`: `float ourLerp(float a, float b, float f)` (a free function); `glm::vec4 samples[32];` in
  `UniformBufferObject`; `ssaoRenderPass` (`createSsaoRenderPass()`: `VK_FORMAT_R8_UNORM`, `loadOp =
  VK_ATTACHMENT_LOAD_OP_DONT_CARE`, `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, no depth, two dependencies);
  `ssaoColorImage` / `ssaoColorImageMemory` / `ssaoColorImageView` / `ssaoFramebuffer` (`createSsaoFramebuffers()`);
  `ssaoPipeline`; `std::vector<glm::vec3> ssaoKernel` (`generateSampleKernel()`: `srand(42)`, the loop `i < 32` with the
  four `rand() / (float)RAND_MAX`, `glm::normalize`, `ourLerp(0.1f, 1.0f, scale * scale)`, `push_back`);
  `noiseTextureImage` / `…Memory` / `…ImageView` (`createNoiseTexture()`: `std::vector<glm::vec4> ssaoNoise`, 16 vectors,
  staging buffer, `createImage(4, 4, VK_FORMAT_R32G32B32A32_SFLOAT, …)`, `copyBufferToImage(stagingBuffer,
  noiseTextureImage, 4, 4)`); `noiseSampler` = `createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_REPEAT,
  …)`; in `initVulkan()` `generateSampleKernel()` before `createNoiseTexture()` (the random numbers' order);
  `texNoiseLayoutBinding` (4) and `ssaoLayoutBinding` (5), pool 5 samplers, `noiseInfo` / `ssaoInfo` and
  `descriptorWrites[4]` / `[5]` (an array of 6); `// send kernel`: `ubo.samples[i] = glm::vec4(ssaoKernel[i], 0.0f)` for
  `i < 32`; `// 2. generate SSAO texture` in `recordCommandBuffer()`; everything destroyed in `cleanup()`. `ssao.frag`:
  learnopengl's `main` (TBN from the normal and `randomVec`, `samplePos = fragPos + TBN * ubo.samples[i].xyz * radius`,
  `ubo.proj`, `offset.xy * 0.5 + 0.5`, `texture(gPosition, offset.xy).z`, `rangeCheck`, `outColor = 1.0 - occlusion /
  kernelSize` into `layout(location = 0) out float outColor`). The window shows **the raw SSAO image in grey**: white
  (255) where nothing occludes – planet, planet-left, planet-lit, floor, wall, wall-lit = 255,255,255; grey where it
  does: the ring's underside dark (ring-left = 61,61,61, ring-right = 56,56,56, ring-mid = 120,120,120; darkest ≈ 42),
  the contact shadow under the planet (contact = 151,151,151, contact-left = 192,192,192), the floor/wall edge as a thin
  grey line (edge = 205,205,205), a faint band on the planet above the ring (above-ring = 228,228,228). 45,332 pixels are
  below 250. The grey areas show the **4 × 4 noise pattern** (a fine regular dither: neighbouring pixels differ).

## blur
- **Task:** Blur the SSAO image to remove the noise pattern: a second `VK_FORMAT_R8_UNORM` image and framebuffer (the same render pass), filled by `ssao_blur.frag` (learnopengl's 4 × 4 box blur) reading the SSAO image. Show the blurred image.
- **Hint:** In `createSsaoFramebuffers()` a second image + view and, reusing `framebufferInfo` with `pAttachments = &ssaoBlurImageView`, `ssaoBlurFramebuffer`. `ssaoBlurPipeline` with `ssao_blur.frag` and `ssaoRenderPass`. Binding 6 (the blurred image) in the layout, the pool (6 samplers) and the set. In `recordCommandBuffer()` after the SSAO pass: `// 3. blur SSAO texture to remove noise` (a copy of `ssaoPassInfo` with `ssaoBlurFramebuffer`, `ssaoBlurPipeline`, the quad). `ssao_blur.frag`: `ssaoInput` at binding 5, `vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));`, the sum over x, y = -2..1, divided by 16. `ssao_lighting.frag` now reads binding 6.
- **When done:** `main.cpp`: `ssaoBlurImage` / `ssaoBlurImageMemory` / `ssaoBlurImageView` / `ssaoBlurFramebuffer`
  (`// and blur stage` in `createSsaoFramebuffers()`), `ssaoBlurPipeline` (`"shaders/ssao.vert.spv"`,
  `"shaders/ssao_blur.frag.spv"`, `ssaoRenderPass`, 1, `VK_FALSE`), `ssaoBlurLayoutBinding` (binding 6, an array of 7
  bindings), pool 6 samplers, `ssaoBlurInfo` and `descriptorWrites[6]` (an array of 7); in `recordCommandBuffer()`
  `VkRenderPassBeginInfo ssaoBlurPassInfo = ssaoPassInfo; ssaoBlurPassInfo.framebuffer = ssaoBlurFramebuffer;`,
  `vkCmdBeginRenderPass`, `ssaoBlurPipeline`, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`, `vkCmdEndRenderPass`; cleanup.
  `ssao_blur.frag`: learnopengl's `main` (`layout(binding = 5) uniform sampler2D ssaoInput;`, `out float`).
  `ssao_lighting.frag`: `layout(binding = 6) uniform sampler2D ssao; // the blurred SSAO image`. The window shows **the
  smooth AO** (the dither is gone: the mean difference between horizontal neighbours drops from 0.82 to 0.11): ring-left
  = 60,60,60, ring-right = 58,58,58, ring-mid = 118,118,118, contact = 127,127,127, contact-left = 191,191,191, edge =
  217,217,217, above-ring = 237,237,237; still white: planet, planet-left, planet-lit, floor, wall, wall-lit =
  255,255,255. (The 4 × 4 window is not centred – offsets -2..1 – so the picture moves by half a pixel, up and left in
  Vulkan, where v points down.)

## apply
- **Task:** Use the blurred AO in the lighting: multiply the ambient term by it, and remove the line that showed the SSAO image.
- **Hint:** `float AmbientOcclusion = texture(ssao, fragTexCoord).r;` and `vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);` – only the ambient light is occluded; the direct light keeps its own (shadow-free) diffuse and specular.
- **When done:** `ssao_lighting.frag`: `float AmbientOcclusion = texture(ssao, fragTexCoord).r;`, `vec3 ambient =
  vec3(0.3 * Diffuse * AmbientOcclusion);`, the "for now" line is gone (learnopengl's 9.ssao_lighting.fs); `main.cpp`:
  the pass comment `// 4. lighting pass: traditional deferred Blinn-Phong lighting with added screen-space ambient
  occlusion`. The lit scene is back, **darker where the AO is grey**: the ring's underside (ring-left = 29,29,59 – start
  84,84,114; ring-right = 43,43,109 – start 99,99,165; ring-mid = 48,48,83 – start 87,87,122), the contact shadow under
  the planet (contact = 56,56,107 – start 93,93,144; contact-left = 73,73,118 – start 91,91,136), the floor/wall edge
  (edge = 68,68,84 – start 79,79,95), above-ring = 68,68,69 (start 73,73,75); unchanged: planet = 73,73,73, planet-left =
  73,73,73, planet-lit = 103,103,179, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199. 41,903 pixels get
  darker by more than 2 (13,836 by more than 30, at most 60; none brighter), all between y = 166 and 384. This is the
  solution.
