# Specular IBL (Vulkan) – tasks

learnopengl "PBR / IBL / Specular IBL": `src/6.pbr/2.2.1.ibl_specular`, then `2.2.2.ibl_specular_textured`. Files:
`main.cpp`, `textures/environment.hdr` and the material's five maps (`albedo.png`, `normal.png`, `metallic.png`,
`roughness.png`, `ao.png` – for the last task), and in `shaders/` (each built to `<name>.spv`): the shaders of
`diffuse-irradiance` (`pbr.vert/.frag`, `cubemap.vert`, `equirectangular_to_cubemap.frag`,
`irradiance_convolution.frag`, `background.vert/.frag`) and new: `prefilter.frag` and `brdf.frag` (partly given:
`DistributionGGX`, `RadicalInverse_VdC`, `Hammersley`; the rest TODO), `brdf.vert` (complete: the screen quad) and
`debug_quad.frag` (complete: shows a two-channel texture on the screen quad).

The fixed choices of the PBR part are at the top of `../pbr-lighting/tasks.md`; how the setup-time passes, the cube
map faces and the descriptor sets work in Vulkan is described in `../diffuse-irradiance/tasks.md` (the same named
points: sRC, h33, top/bot, sky-tl, sky-top, sky-low, hills, ground, ground-bottom, left, right, ground-bl, ground-br).

**Start:** the end of `diffuse-irradiance`. Prepared: the global `vertices` also holds the screen quad (vertices 36..41,
learnopengl's `renderQuad()` quad as two triangles) with `renderQuad(VkCommandBuffer)` (`vkCmdDraw(commandBuffer, 6, 1,
36, 0)`), the four new shader files, the textures, TODOs.

**The simulator's numbers** (a real GPU handles learnopengl's easily): pre-filter map **64²** with 5 mip levels (64, 32,
16, 8, 4) and `SAMPLE_COUNT = 128u` (learnopengl 128² and 1024), `resolution = 128.0` (the environment map's face) in
`prefilter.frag`; BRDF lookup texture **128²** with `SAMPLE_COUNT = 128u` (learnopengl 512² and 1024).

**Vulkan notes.**
- *Mip levels of the environment map:* learnopengl calls `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` after the conversion;
  here the cube map is created with 8 levels and `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128,
  128, 8, 6)` – the function already used by `loadTexture` – blits each level into the next for all six layers at once
  (the image needs `TRANSFER_SRC | TRANSFER_DST` usage). The sampler already filters between mip levels.
- *Rendering into a mip level:* `renderToCubemap` gets `mipLevel` (the face view's `baseMipLevel`), the size of that
  level and `roughness` (a second member of `CapturePushConstants`, read by `prefilter.frag`).
- *Seamless cube maps:* learnopengl enables `GL_TEXTURE_CUBE_MAP_SEAMLESS`; Vulkan always filters across face edges –
  nothing to do.
- *The lookup texture:* `VK_FORMAT_R16G16_SFLOAT` (learnopengl `GL_RG16F`), a second render pass from the same helper
  (`createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass)`), `renderBrdfLUT()` draws the screen quad into it
  once with a one-time command buffer. NdotV = u, roughness = v: the quad's vertex with texture coordinates (0, 0) is at
  NDC (-1, -1), which Vulkan writes to row 0 – v = 0 –, exactly the texel OpenGL writes it to (its row 0 is the
  bottom): the texture holds the same data. Only *showing* it differs: the window's y points down, so `debug_quad.frag`
  samples at `1.0 - v` to show roughness 0 at the bottom, as OpenGL's picture does.
- *Descriptor sets:* from `specular` on the layout has three images (bindings 1, 2, 3: `irradianceMap`, `prefilterMap`,
  `brdfLUT` – learnopengl's texture units 0, 1, 2), from `textured` on eight (the maps at bindings 4..8 = units 3..7);
  the single-image sets leave the other bindings empty (their shaders do not use them).

Pixels measured on lavapipe; nothing depends on time. Every state equals the OpenGL chapter's picture (largest
difference 1/255; the textured state: one pixel differs by 5).

**Start picture** (= the end of `diffuse-irradiance`): s00 = 193,1,1, s03 = 187,27,27, s06 = 188,41,41, s30 = 147,0,0, s33
= 146,19,19, s36 = 149,29,29, s60 = 76,0,0, s63 = 99,11,11, s66 = 125,17,17, h33 = 190,70,70, top33 = 151,13,13, bot33 =
109,12,12; sky-tl = 165,176,194, sky-top = 161,173,193, sky-low = 180,187,198, hills = 85,103,86, ground = 112,105,94,
ground-bottom = 104,97,87, left = 96,99,83, right = 100,103,89, ground-bl = ground-br = 106,99,88.

## prefilter-map
- **Task:** Create the pre-filtered environment map: a 64 × 64 cube map with 5 mip levels, each level rendered with `prefilter.frag` for one roughness (0, 0.25 … 1) – importance-sampled GGX with 128 Hammersley samples, each sample read from the environment map's mip level that matches its probability (so give the environment map mip levels first). Show it as the background at mip level 1.2 for now.
- **Hint:** `CapturePushConstants` gets `float roughness;`. Members `prefilterPipeline`, `prefilterImage` / `…Memory` / `…View`, `prefilterDescriptorSet`. `createPipeline("shaders/cubemap.vert.spv", "shaders/prefilter.frag.spv", captureRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, prefilterPipeline)`. `createCubemap(128, 8, envCubemapImage, …)` (8 levels) and `createCubemap(64, 5, prefilterImage, …)`; in `createCubemap` add `VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT`. `renderToCubemap(pipeline, descriptorSet, cubemapImage, mipLevel, size, roughness)`: `viewInfo.subresourceRange.baseMipLevel = mipLevel;`, `constants.roughness = roughness;`; the two existing calls become `(…, envCubemapImage, 0, 128, 0.0f)` and `(…, irradianceImage, 0, 32, 0.0f)`. After the conversion: `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6);`. After the irradiance pass: `unsigned int maxMipLevels = 5; for (unsigned int mip = 0; mip < maxMipLevels; ++mip) { unsigned int mipWidth = static_cast<unsigned int>(64 * std::pow(0.5, mip)); float roughness = (float)mip / (float)(maxMipLevels - 1); renderToCubemap(prefilterPipeline, envDescriptorSet, prefilterImage, mip, mipWidth, roughness); }`. `createTextureDescriptorSet(prefilterImageView, clampSampler, prefilterDescriptorSet)`; pool: 5 sets. Background: bind `prefilterDescriptorSet`; `background.frag`: `textureLod(environmentMap, fragWorldPos, 1.2)`. `prefilter.frag`: `ImportanceSampleGGX(Xi, N, roughness)` (learnopengl's: `a = roughness*roughness`, `phi = 2.0 * PI * Xi.x`, `cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y))`, tangent space → world) and the loop: `Xi = Hammersley(i, SAMPLE_COUNT)`, `H`, `L = normalize(2.0 * dot(V, H) * H - V)`, `NdotL`; inside `if (NdotL > 0.0)`: `pdf = D * NdotH / (4.0 * HdotV) + 0.0001`, `saTexel = 4.0 * PI / (6.0 * resolution * resolution)` with `resolution = 128.0`, `saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001)`, `mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel)`, `prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL; totalWeight += NdotL;` – at the end `prefilteredColor / totalWeight`.
- **When done:** `main.cpp`: `float roughness` in `CapturePushConstants`; `prefilterPipeline` (cubemap.vert +
  prefilter.frag, capture pass, list); `createCubemap(128, 8, envCubemapImage, …)`, `createCubemap(64, 5,
  prefilterImage, …)`, the cube map's usage with `VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT`;
  `renderToCubemap(…, uint32_t mipLevel, uint32_t size, float roughness)` (`baseMipLevel = mipLevel`,
  `constants.roughness = roughness`); `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6)`
  between the conversion and the irradiance pass; the loop over 5 mip levels calling `renderToCubemap(prefilterPipeline,
  envDescriptorSet, prefilterImage, mip, mipWidth, roughness)` (sizes 64, 32, 16, 8, 4; roughness 0, 0.25, 0.5, 0.75,
  1); `prefilterDescriptorSet`, `maxSets = 5`; the background binds `prefilterDescriptorSet`; destroyed in `cleanup()`.
  `background.frag`: `textureLod(environmentMap, fragWorldPos, 1.2)`. `prefilter.frag`: `ImportanceSampleGGX`, the
  128-sample loop with the mip level from the pdf (`resolution = 128.0`), `prefilteredColor / totalWeight`.
  **The background is a blurred environment** (roughness ≈ 0.3: between mip 1 and 2): the sky still blue at the top,
  the horizon gone soft, and a wide warm glow at the left edge below the horizon – a bright lamp of the environment,
  spread out: sky-tl = 167,175,192, sky-top = 162,172,191, sky-low = 167,174,186, hills = 152,156,165 (was 85,103,86),
  ground = 136,135,136, ground-bottom = 123,113,105, left = 169,161,156, right = 149,150,158, ground-bl = 180,159,130
  (the glow), ground-br = 123,111,113. The spheres stay as in the start (s33 = 146,19,19, s00 = 193,1,1 …; top33 =
  152,13,13 – one step brighter: the irradiance pass now reads the environment map through its mip levels).

## brdf-lut
- **Task:** Create the BRDF lookup texture: a 128 × 128 image with two 16-bit float channels, filled once by drawing the screen quad with `brdf.frag` (`IntegrateBRDF(NdotV, roughness)` with 128 samples: the scale and the bias of F0). For now show it on the screen quad over the whole window.
- **Hint:** Members `brdfRenderPass`, `brdfPipeline`, `debugQuadPipeline`, `brdfLUTImage` / `…Memory` / `…View`, `brdfLUTDescriptorSet`. `createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass)`; `createPipeline("shaders/brdf.vert.spv", "shaders/brdf.frag.spv", brdfRenderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, brdfPipeline)` and `createPipeline("shaders/brdf.vert.spv", "shaders/debug_quad.frag.spv", renderPass, VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, debugQuadPipeline)`; `createImage(128, 128, 1, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, brdfLUTImage, brdfLUTImageMemory)` and `createImageView(brdfLUTImage, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT, 1)`; `createTextureDescriptorSet(brdfLUTImageView, clampSampler, brdfLUTDescriptorSet)` (pool: 6 sets). `renderBrdfLUT()`: a framebuffer (`brdfRenderPass`, `&brdfLUTImageView`, 128 × 128), `beginSingleTimeCommands()`, viewport and scissor 128 × 128, `vkCmdBeginRenderPass`, `vkCmdBindPipeline(…, brdfPipeline)`, `renderQuad(commandBuffer)`, `vkCmdEndRenderPass`, `endSingleTimeCommands(commandBuffer)`, destroy the framebuffer; call it after the pre-filter loop. In `recordCommandBuffer()` after the background: `vkCmdBindPipeline(…, debugQuadPipeline); vkCmdBindDescriptorSets(…, &brdfLUTDescriptorSet, …); renderQuad(commandBuffer);`. `brdf.frag`: `ImportanceSampleGGX` as in `prefilter.frag`; `GeometrySchlickGGX` with `k = (roughness * roughness) / 2.0` (the k of IBL), `GeometrySmith`; `IntegrateBRDF`: `V = (sqrt(1.0 - NdotV*NdotV), 0.0, NdotV)`, `N = (0, 0, 1)`, per sample `G_Vis = (G * VdotH) / (NdotH * NdotV)`, `Fc = pow(1.0 - VdotH, 5.0)`, `A += (1.0 - Fc) * G_Vis; B += Fc * G_Vis;`, divided by `SAMPLE_COUNT`; `outColor = IntegrateBRDF(fragTexCoord.x, fragTexCoord.y)`.
- **When done:** `main.cpp`: `brdfRenderPass` (`createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass)`),
  `brdfPipeline` (brdf.vert + brdf.frag, `brdfRenderPass`), `debugQuadPipeline` (brdf.vert + debug_quad.frag,
  `renderPass`), `brdfLUTImage` (128 × 128, `VK_FORMAT_R16G16_SFLOAT`, colour attachment + sampled) and its view,
  `brdfLUTDescriptorSet`, `maxSets = 6`, `renderBrdfLUT()` (one render pass into the lookup texture: `brdfPipeline`,
  `renderQuad(commandBuffer)`) called after the pre-filter loop; the screen quad drawn last in `recordCommandBuffer()`
  with `debugQuadPipeline` and `brdfLUTDescriptorSet`; destroyed in `cleanup()`. `brdf.frag`: `ImportanceSampleGGX`,
  `GeometrySchlickGGX` (`k = (a * a) / 2.0`), `GeometrySmith`, `IntegrateBRDF` (`SAMPLE_COUNT = 128u`), `main`.
  **The lookup texture covers the whole window** (the quad is at depth 0, in front of everything): red = the scale,
  green = the bias, blue 0; NdotV grows from left (0) to right (1), roughness from the bottom (0) to the top (1). Mostly
  red, brightest at the bottom right, darker towards the top; green only near the left edge, strongest in the
  bottom-left corner: (10,590) = 16,234,0, (40,560) = 54,180,0, (100,560) = 121,126,0, (200,450) = 164,45,0, (10,300) =
  149,33,0, (400,590) = 247,8,0, (790,590) = 255,0,0, (700,560) = 255,0,0, (400,300) = 186,5,0, (790,300) = 228,0,0,
  (600,150) = 150,0,0, (10,10) = 149,5,0, (400,10) = 108,1,0, (790,10) = 84,0,0. No tone mapping, no gamma: the stored
  values × 255.

## specular
- **Task:** Complete the split-sum approximation in `pbr.frag`: `R = reflect(-V, N)`, the pre-filtered colour `textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD)` (4.0), the lookup `texture(brdfLUT, vec2(NdotV, roughness)).rg`, `specular = prefilteredColor * (F * brdf.x + brdf.y)` and `ambient = (kD * diffuse + specular) * ao`. Give the spheres' descriptor set the two new images, remove the debug quad, and show the environment map as the background again.
- **Hint:** The layout: `std::array<VkDescriptorSetLayoutBinding, 4>` (three image bindings); the pool: 5 sets, `5 * 3` image samplers. `createDescriptorSet()`: `std::array<VkImageView, 3> imageViews = {irradianceImageView, prefilterImageView, brdfLUTImageView};`, `std::array<VkSampler, 3> samplers = {clampSampler, clampSampler, clampSampler};`, `std::array<VkDescriptorImageInfo, 3> imageInfos{};`, `std::array<VkWriteDescriptorSet, 4> descriptorWrites{};` and a loop writing `dstBinding = i + 1` (as in PBR Lighting's `textured`). Remove `debugQuadPipeline` (member, `createPipeline`, `vkDestroyPipeline`), `brdfLUTDescriptorSet` and the quad's draw; bind `envDescriptorSet` for the background (the other two lines stay as comments, like learnopengl's); `background.frag` back to level `0.0`. `pbr.frag`: `layout(binding = 2) uniform samplerCube prefilterMap; layout(binding = 3) uniform sampler2D brdfLUT;`, `vec3 R = reflect(-V, N);`, `vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness); vec3 kS = F; …`, `const float MAX_REFLECTION_LOD = 4.0;`.
- **When done:** `main.cpp`: `std::array<VkDescriptorSetLayoutBinding, 4> bindings`; the pool with `maxSets = 5` and `5 * 3`
  image samplers; `createDescriptorSet()` with the three image views (irradiance, prefilter, brdfLUT – bindings 1, 2,
  3), `clampSampler` for each; no `debugQuadPipeline`, no `brdfLUTDescriptorSet`, no `renderQuad` in
  `recordCommandBuffer()`; the background binds `envDescriptorSet`. `background.frag`: `textureLod(environmentMap,
  fragWorldPos, 0.0)`. `pbr.frag`: `prefilterMap` (binding 2), `brdfLUT` (binding 3), `R = reflect(-V, N)`,
  `prefilteredColor = textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD).rgb`, `brdf = texture(brdfLUT,
  vec2(max(dot(N, V), 0.0), roughness)).rg`, `specular = prefilteredColor * (F * brdf.x + brdf.y)`, `ambient = (kD *
  diffuse + specular) * ao`. **The spheres reflect the environment**: the smooth ones (left columns) mirror the sky in
  their upper half and the dark ground below, with the horizon as a line across them and small bright spots (the sun,
  the lamps); to the right the reflection blurs into a soft sheen; the metallic rows (top) are red mirrors, the
  non-metallic ones (bottom) keep their red with a pale sky reflection on top (green and blue are no longer near 0):
  s00 = 194,59,66 (was 193,1,1), s03 = 189,66,71, s06 = 189,58,61, s30 = 152,22,20, s33 = 157,37,39 (was 146,19,19), s36
  = 157,39,41, s60 = 101,10,9 (was 76,0,0), s63 = 122,17,17, s66 = 139,21,22; h33 = 217,109,108; top33 = 165,48,57
  against bot33 = 115,21,21; top00 = 186,47,63, bot00 = 174,20,18; top60 = 129,25,34, bot60 = 76,12,10. The background
  is the sharp environment map again (sky-tl = 165,176,194, sky-low = 180,187,198, hills = 85,103,86, ground =
  112,105,94, ground-bl = 106,99,88). learnopengl's `2.2.1`.

## textured
- **Task:** Put the course's material on the spheres (learnopengl 2.2.2), as in PBR Lighting's last task: load the five maps, add them to the spheres' descriptor set at bindings 4..8, read albedo, metallic, roughness, ao and the normal from them in `pbr.frag`, and draw a 3 × 3 grid of large spheres (`spacing = 6.0`, rotated 90° about y, scaled 2.4).
- **Hint:** As in `pbr-lighting`: the image members and `textureSampler`; the five `loadTexture("textures/<name>.png", VK_FORMAT_R8G8B8A8_UNORM, …)` calls and `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE, textureSampler)`; `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`, `glm::rotate` / `glm::scale` in the loop; `PushConstants` only `model`, `UniformBufferObject` without `albedo` / `ao`. New here: the layout has 9 bindings (`std::array<VkDescriptorSetLayoutBinding, 9>`), the pool `5 * 8` image samplers, and `createDescriptorSet()` eight images with their samplers: `imageViews = {irradianceImageView, prefilterImageView, brdfLUTImageView, albedoImageView, normalImageView, metallicImageView, roughnessImageView, aoImageView}`, `samplers = {clampSampler, clampSampler, clampSampler, textureSampler, textureSampler, textureSampler, textureSampler, textureSampler}`. `pbr.frag`: `layout(binding = 4) uniform sampler2D albedoMap;` … `layout(binding = 8) uniform sampler2D aoMap;`, `getNormalFromMap()`, the four material lines, `vec3 N = getNormalFromMap();`; `pbr.vert`: `fragTangent`.
- **When done:** `main.cpp`: the five material images loaded (`VK_FORMAT_R8G8B8A8_UNORM`, with mip levels) and
  `textureSampler` (repeat); `std::array<VkDescriptorSetLayoutBinding, 9> bindings`; the pool with `5 * 8` image
  samplers; `createDescriptorSet()` with `std::array<VkImageView, 8>` / `std::array<VkSampler, 8>` /
  `std::array<VkWriteDescriptorSet, 9>` (bindings 1..3 the IBL images with `clampSampler`, 4..8 the maps with
  `textureSampler`); `struct PushConstants { glm::mat4 model; }`; no `albedo` / `ao` in `UniformBufferObject`; `nrRows =
  3`, `nrColumns = 3`, `spacing = 6.0`; `glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f))`,
  `glm::scale(model, glm::vec3(2.4f))`; nine sphere draws, then the background; the images and the sampler destroyed.
  `pbr.vert`: `fragTangent = mat3(pc.model) * inTangent`. `pbr.frag`: the five `sampler2D`s at bindings 4..8,
  `getNormalFromMap()`, `albedo = pow(texture(albedoMap, fragTexCoord).rgb, vec3(2.2))`, `metallic` / `roughness` /
  `ao` from `.r`. **Nine large spheres of riveted steel with rust in the environment** (centres (202.5 + 197.5 · c,
  497.5 - 197.5 · r), radius ≈ 80 px): the steel is a blurred mirror – bluish-white where it reflects the sky (upper
  halves), darker where it reflects the ground –, the rust stays matt orange-brown, the grooves and rivets catch the
  light. Middle sphere: the cross (400,300) = 111,107,111; steel above it (385,255) = 128,139,163 (sky reflection;
  pbr-lighting's picture: 79,80,83); rivets (368,283) = 144,152,166 and (430,283) = 171,172,178; rust (450,340) =
  136,81,55. Other spheres: (160,60) = 186,189,198 (steel, top-left sphere), rust (240,130) = 136,80,53, (640,440) =
  152,126,116, steel (400,470) = 100,104,114. (9×9 box means: 104,101,105 / 125,137,162 / 149,157,171 / 167,169,174 /
  141,84,56 / 167,171,184 / 137,81,53 / 151,121,110 / 125,129,139.) The background between the spheres: sky-tl (20,20)
  = 165,176,194, (300,12) = 161,173,193, hills (300,259) = 85,103,87, ground (300,341) = 112,105,94, (300,588) =
  104,97,87, left (60,300) = 96,99,83, right (740,300) = 100,103,89. learnopengl shows five materials on five spheres;
  the course has one material, on a 3 × 3 grid so the reflections can be compared at different positions. This is the
  solution.
