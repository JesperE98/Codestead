# Diffuse irradiance (Vulkan) – tasks

learnopengl "PBR / IBL / Diffuse irradiance": `src/6.pbr/2.1.1.ibl_irradiance_conversion`, `2.1.2.ibl_irradiance`. Files:
`main.cpp`, `textures/environment.hdr` (512 × 256 Radiance HDR, equirectangular: a blue sky with clouds and a hazy sun,
hills on the horizon, a dark ground, three coloured lamps; learnopengl uses newport_loft.hdr) and in `shaders/` (each
built to `<name>.spv`): `pbr.vert/.frag` (the spheres), `cubemap.vert` (complete: the cube of a capture pass),
`equirectangular_to_cubemap.frag`, `irradiance_convolution.frag`, `background.vert/.frag` (TODO stubs in the start that
compile but are not used yet).

The fixed choices of the PBR part (camera (0, 0, 22), the 7 × 7 spheres at z = 0, the lights, the sphere and its
helpers, the uniform buffer, the named points sRC / h33 / bg) are at the top of `../pbr-lighting/tasks.md`.

**Start:** the end of `pbr-lighting` before its `textured` task: the 7 × 7 spheres with the complete reflectance equation,
Reinhard and gamma, constant ambient `vec3(0.03) * albedo * ao`; clear (0.1, 0.1, 0.1). The pipeline is called
`pbrPipeline` now. Prepared: the global `vertices` – learnopengl's `renderCube()` cube (36 vertices, 2 × 2 × 2, the
`Vertex` struct of the sphere with the tangent left zero) –, its `vertexBuffer` and `renderCube(VkCommandBuffer)`
(`vkCmdBindVertexBuffers` + `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`), not used yet. TODOs in `main.cpp` (members,
pipelines, the images, the capture, the background draw, cleanup) and in the four stub shaders.

**The simulator's numbers** (it draws on the CPU; a real GPU handles learnopengl's easily): environment cube map
**128²** per face (learnopengl 512²), irradiance map **32²** with `sampleDelta = 0.1` (learnopengl 0.025).

**How the setup-time passes are done in Vulkan.** learnopengl renders into the cube maps once, before the render loop,
with one framebuffer object whose colour attachment it changes (`glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X
+ i, …)`). Here: `createCaptureRenderPass(format, renderPass)` makes a render pass with one colour attachment and no
depth (the cube is seen from the inside, nothing can hide anything; loadOp DONT_CARE – the cube covers every pixel;
finalLayout `SHADER_READ_ONLY_OPTIMAL`); `createCubemap(size, mipLevels, image, memory, view)` makes a
`VK_FORMAT_R16G16B16A16_SFLOAT` image with 6 array layers and `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT` (usage
`COLOR_ATTACHMENT | SAMPLED`) and its `VK_IMAGE_VIEW_TYPE_CUBE` view; `renderToCubemap(pipeline, descriptorSet,
cubemapImage, size)` creates a 2D view (`baseArrayLayer = i`) and a framebuffer per face, records six render passes into
a **one-time command buffer** (`beginSingleTimeCommands()` … `endSingleTimeCommands()`: submitted and waited for – in
`initVulkan()`, after the resources and descriptor sets exist, before the first frame) – each pass binds the pipeline
and the descriptor set, pushes `CapturePushConstants { glm::mat4 projectionView; }` = `captureProjection *
captureViews[i]` (learnopengl's `glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f)` and its six `glm::lookAt`s)
and calls `renderCube(commandBuffer)` – and destroys the face views and framebuffers again. The uniform buffer cannot
change between the draws of one command buffer, so the per-face matrix is a push constant; `CapturePushConstants` shares
the pipeline layout's one push constant range with `PushConstants` (`size = std::max(sizeof(PushConstants),
sizeof(CapturePushConstants))`).

**Cube map faces and y (verified: the pictures equal OpenGL's to 1/255 – the sky is upright, the horizon and the sun are
where OpenGL shows them).** The six views are learnopengl's: targets +x, -x, +y, -y, +z, -z with ups (0, -1, 0),
(0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0), layer i = face i. **No y flip in `captureProjection`** (no
`[1][1] *= -1`): a cube map lookup picks the face and the texel by the same table in OpenGL and Vulkan; in a capture
pass NDC y = -1 lands on a layer's row 0 in Vulkan (framebuffer y points down) – the row OpenGL writes NDC y = -1 to as
well (its row 0 is the bottom). So the layers hold the same texels in both APIs. Only the window's projection has the
flip, as always. `GLM_FORCE_DEPTH_ZERO_TO_ONE` changes clip z only; no culling, so the winding does not matter.
`environment.hdr` is loaded with `stbi_set_flip_vertically_on_load(true)` like learnopengl, so `SampleSphericalMap`
is learnopengl's unchanged.

**Descriptor sets:** the layout gets one image at binding 1. `createTextureDescriptorSet(imageView, sampler,
descriptorSet)` makes a set with the uniform buffer and one image – `hdrDescriptorSet` (the HDR image),
`envDescriptorSet` (the environment cube map), `irradianceDescriptorSet` –; binding one before a draw is Vulkan's
`glBindTexture`. The spheres keep their own `descriptorSet` (`createDescriptorSet()`), which gets the irradiance map
at binding 1 in the last task. One sampler `clampSampler` (linear, `CLAMP_TO_EDGE`, no anisotropy) for the HDR image
and the cube maps. Vulkan filters across the edges of cube map faces (OpenGL only with
`GL_TEXTURE_CUBE_MAP_SEAMLESS`, which learnopengl turns on in the next chapter) – no visible difference here.

Named points, besides the spheres' (sRC = centre of the sphere in row R, column C; h33 (411,289)): background points
between and around the spheres – **sky-tl** (20,20), **sky-top** (359,12), **sky-low** (359,177), **hills** (359,259),
**ground** (359,341), **ground-bottom** (359,588), **left** (60,300), **right** (740,300), **ground-bl** (100,560),
**ground-br** (700,560); on spheres **top33** (400,275), **bot33** (400,325), **top00** (153,522), **bot00** (153,572),
**top60** (153,28), **bot60** (153,78). Pixels measured on lavapipe; nothing depends on time.

**Start picture:** s00 = 157,1,1, s03 = 146,27,27, s06 = 159,41,41, s30 = 111,0,0, s33 = 115,19,19, s36 = 128,29,29, s60
= 68,0,0, s63 = 95,11,11, s66 = 124,17,17, h33 = 177,70,70, top33 = 102,13,13, bot33 = 101,12,12, top00 = 122,0,0, bot00
= 153,0,0, top60 = 67,0,0, bot60 = 53,0,0; every background point = 26,26,26.

## environment-map
- **Task:** Load `textures/environment.hdr` with `stbi_loadf` into a floating-point 2D image, convert it to a 128 × 128 floating-point cube map by drawing the cube into each of its six faces with the equirectangular-to-cubemap shader – once, in `initVulkan()` –, and draw the cube map as the background behind the spheres (drawn last, at depth 1.0, with depth function less-or-equal, tone mapped and gamma corrected).
- **Hint:** `struct CapturePushConstants { glm::mat4 projectionView; };` (and `pushConstantRange.size = std::max(sizeof(PushConstants), sizeof(CapturePushConstants))`). Members: `captureRenderPass`, `equirectangularToCubemapPipeline`, `backgroundPipeline`, `hdrImage` / `hdrImageMemory` / `hdrImageView`, `envCubemapImage` / `…Memory` / `…View`, `clampSampler`, `hdrDescriptorSet`, `envDescriptorSet`. `createCaptureRenderPass(VK_FORMAT_R16G16B16A16_SFLOAT, captureRenderPass)` after `createRenderPass()`. `createPipeline` gets two parameters – `VkRenderPass pipelineRenderPass`, `VkPrimitiveTopology topology` (assigned to `pipelineInfo.renderPass` and `inputAssembly.topology`) – and `depthCompareOp = VK_COMPARE_OP_LESS_OR_EQUAL` (learnopengl's `glDepthFunc(GL_LEQUAL)`): `createPipeline("shaders/pbr.vert.spv", "shaders/pbr.frag.spv", renderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP, pbrPipeline)`, `createPipeline("shaders/cubemap.vert.spv", "shaders/equirectangular_to_cubemap.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, equirectangularToCubemapPipeline)`, `createPipeline("shaders/background.vert.spv", "shaders/background.frag.spv", renderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, backgroundPipeline)`. `loadHdrTexture(path, image, imageMemory, imageView)`: `stbi_set_flip_vertically_on_load(true); float* data = stbi_loadf(path, &width, &height, &nrComponents, STBI_rgb_alpha);` → `VK_FORMAT_R32G32B32A32_SFLOAT` (checked with `findSupportedFormat` for `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT`: linear filtering of 32-bit float images is optional in Vulkan), `imageSize = width * height * 4 * sizeof(float)`, `createTextureImage(data, imageSize, width, height, 1, format, …)`, `createImageView(…, 1)`. `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, VK_FALSE, clampSampler)`. `createCubemap(128, 1, envCubemapImage, envCubemapImageMemory, envCubemapImageView)`. The layout: `std::array<VkDescriptorSetLayoutBinding, 2>` (binding 1 a combined image sampler, fragment stage); the pool: 3 sets, 3 uniform buffers, 3 image samplers. After `createDescriptorSet()`: `createTextureDescriptorSet(hdrImageView, clampSampler, hdrDescriptorSet); createTextureDescriptorSet(envCubemapImageView, clampSampler, envDescriptorSet); renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 128);`. In `recordCommandBuffer()` after the spheres: `vkCmdBindPipeline(…, backgroundPipeline); vkCmdBindDescriptorSets(…, &envDescriptorSet, …); renderCube(commandBuffer);`. Shaders: `equirectangular_to_cubemap.frag` – `SampleSphericalMap(v)`: `vec2 uv = vec2(atan(v.z, v.x), asin(v.y)); uv *= invAtan; uv += 0.5;` with `invAtan = vec2(0.1591, 0.3183)`, then `texture(equirectangularMap, uv).rgb`; `background.vert` – `mat4 rotView = mat4(mat3(ubo.view)); vec4 clipPos = ubo.proj * rotView * vec4(fragWorldPos, 1.0); gl_Position = clipPos.xyww;`; `background.frag` – `textureLod(environmentMap, fragWorldPos, 0.0).rgb`, `envColor / (envColor + vec3(1.0))`, `pow(envColor, vec3(1.0 / 2.2))`.
- **When done:** `main.cpp`: `struct CapturePushConstants`; `createCaptureRenderPass(VkFormat format, VkRenderPass&
  captureRenderPass)` (one colour attachment, finalLayout `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`) called with
  `VK_FORMAT_R16G16B16A16_SFLOAT`; `createPipeline(vertFile, fragFile, pipelineRenderPass, topology, pipeline)` with
  `VK_COMPARE_OP_LESS_OR_EQUAL`, called three times (pbr: strip, window pass; equirectangular_to_cubemap: list, capture
  pass; background: list, window pass); `loadHdrTexture("textures/environment.hdr", hdrImage, hdrImageMemory,
  hdrImageView)` (`stbi_loadf`, `VK_FORMAT_R32G32B32A32_SFLOAT`); `createCubemap(128, 1, envCubemapImage, …)`
  (`VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, `arrayLayers = 6`, `VK_FORMAT_R16G16B16A16_SFLOAT`, `VK_IMAGE_VIEW_TYPE_CUBE`);
  `clampSampler`; `std::array<VkDescriptorSetLayoutBinding, 2> bindings` (binding 1 a combined image sampler), `maxSets = 3`;
  `createTextureDescriptorSet(imageView, sampler, descriptorSet)` for `hdrDescriptorSet` and `envDescriptorSet`;
  `renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 128)` – six
  `vkCmdBeginRenderPass(captureRenderPass, framebuffers[i])`, a 128 × 128 viewport, `vkCmdPushConstants` with
  `constants.projectionView = captureProjection * captureViews[i]`, `renderCube(commandBuffer)` – before
  `createCommandBuffer()`; in `recordCommandBuffer()` the background draw (`backgroundPipeline`, `envDescriptorSet`,
  `renderCube`) after the spheres; everything destroyed in `cleanup()`. The three shaders as in the hint.
  **The environment shows behind the spheres** (which are unchanged: all sRC, h33, top/bot points as in the start): a
  light blue sky – sky-tl = 165,176,194, sky-top = 161,173,193, sky-low = 180,187,198 (paler towards the horizon) –, a
  band of dark green hills on the horizon (y ≈ 248..297) – hills = 85,103,86, left = 96,99,83, right = 100,103,89 – and
  the grey-brown ground below – ground = 112,105,94, ground-bottom = 104,97,87, ground-bl = ground-br = 106,99,88. No
  26,26,26 pixel is left. (The camera looks down -z; the sun and the lamps are in other directions and show in the
  spheres' reflections in the next chapter.)

## irradiance-map
- **Task:** Convolute the environment cube map into a 32 × 32 irradiance cube map – `irradiance_convolution.frag` adds up the environment's radiance over the hemisphere around each direction (`sampleDelta = 0.1`) – with a second capture after the first, and show the irradiance map as the background for now.
- **Hint:** Members `irradiancePipeline`, `irradianceImage` / `…Memory` / `…View`, `irradianceDescriptorSet`. `createPipeline("shaders/cubemap.vert.spv", "shaders/irradiance_convolution.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, irradiancePipeline)`; `createCubemap(32, 1, irradianceImage, irradianceImageMemory, irradianceImageView)`; `createTextureDescriptorSet(irradianceImageView, clampSampler, irradianceDescriptorSet)`; `renderToCubemap(irradiancePipeline, envDescriptorSet, irradianceImage, 32)` after the conversion (it samples the environment cube map: `envDescriptorSet`); pool: 4 sets. Background: bind `irradianceDescriptorSet` instead of `envDescriptorSet`. Shader: `vec3 up = vec3(0.0, 1.0, 0.0); vec3 right = normalize(cross(up, N)); up = normalize(cross(N, right));` then two loops `for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)` / `for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)`: `tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta))`, `sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N`, `irradiance += texture(environmentMap, sampleVec).rgb * cos(theta) * sin(theta); nrSamples++;`, at the end `irradiance = PI * irradiance * (1.0 / float(nrSamples));`.
- **When done:** `main.cpp`: `irradiancePipeline` (cubemap.vert + irradiance_convolution.frag, `captureRenderPass`, triangle
  list), `createCubemap(32, 1, irradianceImage, …)`, `irradianceDescriptorSet`, `renderToCubemap(irradiancePipeline,
  envDescriptorSet, irradianceImage, 32)` after the first `renderToCubemap`, `maxSets = 4`, the background's
  `vkCmdBindDescriptorSets(…, &irradianceDescriptorSet, …)`; destroyed in `cleanup()`. `irradiance_convolution.frag`:
  the two loops with `sampleDelta = 0.1` (63 × 16 = 1008 samples per pixel; learnopengl's 0.025 takes 16 times as many).
  **The background is a smooth blur with no detail** – pale lilac-grey, a little bluer at the top and warmer at the
  bottom: sky-tl = 162,164,177, sky-top = 164,165,179, sky-low = 163,161,174, hills = 162,158,171, ground = 161,155,167,
  ground-bottom = 157,146,154, left = 160,157,167, right = 160,155,171, ground-bl = 159,150,155, ground-br = 159,147,160
  – no horizon, no hills. (Bright: every direction gathers light from half of the environment, the sun included.) The
  spheres are unchanged.

## ambient
- **Task:** Use the irradiance map as the spheres' ambient light: put it into the spheres' descriptor set (binding 1) and replace the constant ambient term in `pbr.frag` with `kD * irradiance * albedo * ao`, where `kD` comes from `fresnelSchlickRoughness`. Show the environment map as the background again.
- **Hint:** `createDescriptorSet()`: a `VkDescriptorImageInfo irradianceInfo` (`irradianceImageView`, `clampSampler`, `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`) and a second write with `dstBinding = 1` (`std::array<VkWriteDescriptorSet, 2>`). Background: bind `envDescriptorSet` again (keep the irradiance line as a comment, like learnopengl). `pbr.frag`: `layout(binding = 1) uniform samplerCube irradianceMap;`, `vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) { return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }`, and `vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness); vec3 kD = 1.0 - kS; kD *= 1.0 - metallic; vec3 irradiance = texture(irradianceMap, N).rgb; vec3 diffuse = irradiance * albedo; vec3 ambient = (kD * diffuse) * ao;`.
- **When done:** `main.cpp`: `createDescriptorSet()` writes `irradianceImageView` / `clampSampler` to binding 1 of
  `descriptorSet`; the background binds `envDescriptorSet`. `pbr.frag`: `samplerCube irradianceMap` at binding 1,
  `fresnelSchlickRoughness`, the ambient term from `texture(irradianceMap, N).rgb` (no `vec3(0.03)` any more).
  **The spheres are lit by the sky**: the non-metallic rows (bottom) much brighter, the upper halves brighter than the
  lower ones; the metallic rows (top) change little (kD → 0): s00 = 193,1,1 (was 157,1,1), s03 = 187,27,27, s06 =
  188,41,41, s30 = 147,0,0, s33 = 146,19,19 (was 115,19,19), s36 = 149,29,29, s60 = 76,0,0, s63 = 99,11,11, s66 =
  125,17,17 (was 124,17,17); h33 = 190,70,70; top33 = 151,13,13 against bot33 = 109,12,12 (start: 102 / 101), top00 =
  186,0,0, bot00 = 174,0,0, top60 = 86,0,0, bot60 = 48,0,0. Only the red channel changes (albedo (0.5, 0, 0)). The
  background is the environment again (the values of `environment-map`: sky-tl = 165,176,194, hills = 85,103,86, ground
  = 112,105,94 …). This is the solution (learnopengl's `2.1.2`).
