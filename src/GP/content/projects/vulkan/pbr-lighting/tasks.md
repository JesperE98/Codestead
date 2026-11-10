# PBR Lighting (Vulkan) – tasks

learnopengl "PBR / Lighting": `src/6.pbr/1.1.lighting`, then `1.2.lighting_textured`. Files: `main.cpp`, in `shaders/`
`pbr.vert` and `pbr.frag` (built to `pbr.vert.spv` / `pbr.frag.spv`), and `textures/albedo.png`, `normal.png`,
`metallic.png`, `roughness.png`, `ao.png` (256², the course's riveted steel with rust; used by the last task).

**Fixed choices for the whole PBR part (`pbr-theory`, `pbr-lighting`, `diffuse-irradiance`, `specular-ibl`) – the same in
every API, taken from the OpenGL project:**
- Window 800×600, no multisampling. **Camera: (0, 0, 22) looking down -z** (yaw -90, pitch 0, fov 45, 800/600, near 0.1,
  far 100; `GLM_FORCE_DEPTH_ZERO_TO_ONE` and `proj[1][1] *= -1` as always). learnopengl's camera starts at (0, 0, 3),
  in the middle of the grid.
- Sphere: learnopengl's `renderSphere()` UV sphere, radius 1, **24 × 24 segments** (learnopengl 64 × 64; the course's
  simulator draws on the CPU – a real GPU handles 64 easily), one indexed **triangle strip**: 25 × 25 = 625 vertices,
  1200 indices (`uint32_t`). Per vertex `pos`, `normal` (= pos), `texCoord` (xSegment, ySegment) and a **`tangent`**
  (-sin(2π·xSegment), 0, cos(2π·xSegment)) – the direction in which u grows – for the textured task. Here the sphere is
  built once by `createSphere()` into the members `sphereVertices` / `sphereIndices` (learnopengl builds it at the first
  `renderSphere()` call), copied to `sphereVertexBuffer` / `sphereIndexBuffer` (through staging buffers:
  `createVertexBuffer(data, size, buffer, memory)`, `createIndexBuffer(indices, buffer, memory)`), and drawn by
  `renderSphere(VkCommandBuffer)`: `vkCmdBindVertexBuffers`, `vkCmdBindIndexBuffer(…, VK_INDEX_TYPE_UINT32)`,
  `vkCmdDrawIndexed(commandBuffer, 1200, 1, 0, 0, 0)`. The pipeline's topology is
  `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP`, `cullMode = VK_CULL_MODE_NONE` (learnopengl's PBR demos do not cull).
- The grid: 7 × 7 spheres at ((col - 3) · 2.5, (row - 3) · 2.5, 0) (the globals `nrRows = 7`, `nrColumns = 7`,
  `spacing = 2.5`; learnopengl's IBL demos put them at z = -2, the course keeps z = 0); `metallic = row / 7` (bottom row
  0), `roughness = clamp(col / 7, 0.05, 1.0)` (left column 0.05), albedo (0.5, 0.0, 0.0), ao 1.0. Recorded in
  `recordCommandBuffer()` with learnopengl's two `for` loops: per sphere `vkCmdPushConstants` with `struct PushConstants
  { glm::mat4 model; float metallic; float roughness; }` (72 bytes, vertex + fragment stages) and
  `renderSphere(commandBuffer)`. learnopengl passes a `normalMatrix` uniform; here the vertex shader computes
  `transpose(inverse(mat3(pc.model)))` as in the earlier chapters.
- Four lights at (-10, 10, 10), (10, 10, 10), (-10, -10, 10), (10, -10, 10), colour (300, 300, 300) (the globals
  `lightPositions`, `lightColors`). learnopengl also draws a small sphere at each light; with this camera they are
  outside the view, so the course does not draw them.
- Uniform buffer (binding 0, `updateUniformBuffer()`): `view`, `proj`, `glm::vec4 lightPositions[4]`, `glm::vec4
  lightColors[4]` (**std140: array elements are 16 bytes apart, so vec4s**, only xyz used), `glm::vec3 albedo` + `float
  ao` (the float fills the 4 bytes after the vec3), `glm::vec3 camPos` + `float pad1`. One descriptor set
  (`descriptorSet`, `createDescriptorSet()`), a layout with only the uniform buffer.
- Clear colour (0.1, 0.1, 0.1) = 26,26,26.
- **Prepared helpers (used by the last task and by the IBL chapters, as in vulkan-tutorial's "Generating Mipmaps"):**
  `loadTexture(path, format, image, imageMemory, imageView)` loads with `stbi_set_flip_vertically_on_load(true)` (v = 0 is
  the image's bottom row, as in OpenGL – the sphere's texture coordinates and the normal map expect that), creates the
  image with all its mip levels (`createTextureImage(pixels, imageSize, width, height, mipLevels, format, …)`,
  `createImage(width, height, mipLevels, …)`, `createImageView(image, format, aspect, mipLevels)`) and fills them with
  `generateMipmaps(image, format, width, height, mipLevels, layerCount)` – `vkCmdBlitImage` from each level into the next,
  Vulkan's `glGenerateMipmap` (earlier Vulkan chapters had no mipmaps). `createTextureSampler(addressMode,
  anisotropyEnable, sampler)`: linear filtering inside and between mip levels (`maxLod = VK_LOD_CLAMP_NONE`).
- The spheres' screen positions: centre of the sphere in row r (0 = bottom), column c (0 = left) = (153 + 82.3 · c,
  547 - 82.3 · r), radius ≈ 33 px. Named points below: **sRC** = that centre – s00 (153,547), s03 (400,547), s06
  (647,547), s30 (153,300), s33 (400,300), s36 (647,300), s60 (153,53), s63 (400,53), s66 (647,53); **h33** (411,289) =
  the highlight of the upper-right light on the middle sphere, **h03** (411,536), **h63** (411,42), **h62** (328,42) the
  same on other spheres; **rim33** (400,270) near the middle sphere's upper edge; **bg** (30,30) and (770,570).

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every state
equals the OpenGL chapter's picture (largest difference 1/255; the textured state: one pixel differs by 5).

**Start picture:** `pbr.frag` has learnopengl's skeleton: `Lo` stays 0, the colour is the ambient term `vec3(0.03) *
albedo * ao` = (0.015, 0, 0), written as is: every sphere a flat, almost black disc – all sRC and h points = 4,0,0 –
on bg = 26,26,26.

## lambert
- **Task:** In `shaders/pbr.frag`, write the light loop: for each of the 4 lights compute the radiance that arrives (`lightColor / distance²`) and add the diffuse (Lambert) reflection `albedo / PI * radiance * NdotL` to `Lo`.
- **Hint:** `for (int i = 0; i < 4; ++i) { vec3 L = normalize(ubo.lightPositions[i].xyz - fragWorldPos); float distance = length(ubo.lightPositions[i].xyz - fragWorldPos); float attenuation = 1.0 / (distance * distance); vec3 radiance = ubo.lightColors[i].rgb * attenuation; float NdotL = max(dot(N, L), 0.0); Lo += (albedo / PI) * radiance * NdotL; }` – the lights are vec4s in the uniform block (std140), use `.xyz` / `.rgb`.
- **When done:** `pbr.frag`: the `for (int i = 0; i < 4; ++i)` loop with `L`, `distance`, `attenuation = 1.0 / (distance *
  distance)`, `radiance = ubo.lightColors[i].rgb * attenuation`, `NdotL`, `Lo += (albedo / PI) * radiance * NdotL`.
  **Matt red spheres**, all alike (metallic and roughness are not used yet), brighter towards the corners of the grid
  (nearer to a light): s00 = 138,0,0, s03 = 108,0,0, s06 = 140,0,0, s30 = 108,0,0, s33 = 97,0,0, s36 = 108,0,0, s60 =
  137,0,0, s63 = 108,0,0, s66 = 138,0,0; h33 = 87,0,0, rim33 = 71,0,0; green and blue are 0 everywhere on the spheres;
  bg = 26,26,26.

## ndf
- **Task:** Add the normal distribution function `DistributionGGX(N, H, roughness)` (Trowbridge-Reitz GGX) and, for now, use it alone as the specular term: `vec3 specular = vec3(NDF)`, added to the diffuse term.
- **Hint:** `float a = roughness*roughness; float a2 = a*a; float NdotH = max(dot(N, H), 0.0); … return a2 / (PI * denom * denom)` with `denom = NdotH*NdotH * (a2 - 1.0) + 1.0`. In the loop: `vec3 H = normalize(V + L);`, `float NDF = DistributionGGX(N, H, roughness);`, `Lo += (albedo / PI + specular) * radiance * NdotL;`.
- **When done:** `pbr.frag`: `float DistributionGGX(vec3 N, vec3 H, float roughness)` (learnopengl's), `vec3 H = normalize(V +
  L);`, `float NDF = DistributionGGX(N, H, roughness);`, `vec3 specular = vec3(NDF);`, `Lo += (albedo / PI + specular) *
  radiance * NdotL;`. **Glaring white highlights that grow with the roughness** (left to right): in the left
  column four tiny dots (s00 = 138,0,0, s30 = 108,0,0, s60 = 137,0,0 unchanged), in the middle columns four white blobs
  (h33 = h03 = h63 = h62 = 255,255,255; s33 = 192,95,95, s03 = 240,131,131, s63 = 240,132,132; rim33 = 86,15,15), the
  right column almost completely white (s06 = s36 = s66 = 255,255,255). The rows look alike (metallic is not used yet).

## geometry
- **Task:** Add the geometry function – `GeometrySchlickGGX(NdotV, roughness)` with `k = (roughness + 1)² / 8` and `GeometrySmith(N, V, L, roughness)` – and divide by the normalisation: `specular = NDF * G / (4 * NdotV * NdotL + 0.0001)`.
- **Hint:** `float r = (roughness + 1.0); float k = (r*r) / 8.0; return NdotV / (NdotV * (1.0 - k) + k);` – Smith multiplies the term for the view direction with the one for the light direction. In the loop: `float G = GeometrySmith(N, V, L, roughness); vec3 numerator = vec3(NDF * G); float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; vec3 specular = numerator / denominator;`.
- **When done:** `pbr.frag`: `GeometrySchlickGGX` (`k = (r*r) / 8.0`), `GeometrySmith` (`ggx1 * ggx2`), `float G =
  GeometrySmith(N, V, L, roughness);`, `vec3 numerator = vec3(NDF * G);`, `float denominator = 4.0 * max(dot(N, V), 0.0)
  * max(dot(N, L), 0.0) + 0.0001;`, `vec3 specular = numerator / denominator;`. The highlights are **much weaker and
  no longer flood the rough spheres**: s33 = 133,36,36 (was 192,95,95), s03 = 156,47,47, s63 = 155,48,48, s36 =
  200,92,92, s06 = 255,120,120, s66 = 255,118,118 (was white); the highlight centres stay white (h33 = h63 = h62 =
  255,255,255, h03 = 255,246,246); rim33 = 79,8,8; left column unchanged (s00 = 138,0,0).

## fresnel
- **Task:** Add `fresnelSchlick(cosTheta, F0)` with `F0 = mix(vec3(0.04), albedo, metallic)`, use `F` in the specular term (`NDF * G * F / denominator`) and weight the diffuse term with `kD = (1 - kS) * (1 - metallic)`: learnopengl's complete reflectance equation.
- **Hint:** `return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);`. Before the loop: `vec3 F0 = vec3(0.04); F0 = mix(F0, albedo, metallic);`. In the loop: `vec3 F = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);`, `vec3 numerator = NDF * G * F;`, `vec3 kS = F; vec3 kD = vec3(1.0) - kS; kD *= 1.0 - metallic;`, `Lo += (kD * albedo / PI + specular) * radiance * NdotL;`.
- **When done:** `pbr.frag`: `vec3 fresnelSchlick(float cosTheta, vec3 F0)`, `F0 = mix(F0, albedo, metallic)`, `vec3 F =
  fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);`, `numerator = NDF * G * F`, `kS`, `kD *= 1.0 - metallic`, `Lo += (kD
  * albedo / PI + specular) * radiance * NdotL`. **The rows differ now** – the bottom row (metallic 0) is matt red with
  small white-ish highlights, towards the top the spheres get darker (no diffuse light) with red highlights: s00 =
  133,0,0, s03 = 106,2,2, s06 = 139,5,5, s30 = 49,0,0, s33 = 53,1,1, s36 = 71,2,2, s60 = 15,0,0, s63 = 33,0,0, s66 =
  66,1,1; h33 = 205,16,16, h03 = 97,10,10, h63 = 255,4,4, h62 = 153,2,2; rim33 = 35,0,0. Dark overall: the colours are
  still linear and unbounded.

## tone-map
- **Task:** At the end of `pbr.frag`, tone map the colour with Reinhard (`color / (color + 1.0)`) and gamma-correct it (`pow(color, vec3(1.0 / 2.2))`).
- **Hint:** Two lines between `vec3 color = ambient + Lo;` and `outColor = vec4(color, 1.0);`. The swap chain format is `B8G8R8A8_UNORM`, so the shader does the gamma correction itself.
- **When done:** `pbr.frag`: `color = color / (color + vec3(1.0));` and `color = pow(color, vec3(1.0 / 2.2));` before
  `outColor`. learnopengl's picture – **brighter, the highlights soft**: s00 = 157,1,1, s03 = 146,27,27, s06 = 159,41,41,
  s30 = 111,0,0, s33 = 115,19,19, s36 = 128,29,29, s60 = 68,0,0, s63 = 95,11,11, s66 = 124,17,17; h33 = 177,70,70, h03 =
  142,57,57, h63 = 192,37,37, h62 = 163,27,27; rim33 = 98,9,9; bg = 26,26,26.

## textured
- **Task:** Give the spheres the course's material (learnopengl 1.2): load the five maps, put them into the descriptor set at bindings 1..5, and read albedo (converted with `pow(…, vec3(2.2))`), metallic, roughness and ao from them in `pbr.frag`; the normal comes from the normal map through a TBN matrix built from the interpolated normal and tangent. Draw a 3 × 3 grid of large spheres (`spacing = 6.0`, each rotated 90° about y and scaled 2.4).
- **Hint:** `main.cpp`: members `albedoImage` / `albedoImageMemory` / `albedoImageView` (and `normal…`, `metallic…`, `roughness…`, `ao…`) and `textureSampler`; `loadTexture("textures/albedo.png", VK_FORMAT_R8G8B8A8_UNORM, albedoImage, albedoImageMemory, albedoImageView);` … and `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE, textureSampler);` after `createCommandPool()`; the layout gets five `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` bindings 1..5 (fragment stage; a `for` loop over a `std::array<VkDescriptorSetLayoutBinding, 6>`), the pool a second size (5 image samplers), `createDescriptorSet()` five more writes (a loop over `std::array<VkImageView, 5> imageViews` and `std::array<VkDescriptorImageInfo, 5> imageInfos`); `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`; in the loop `model = glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f)); model = glm::scale(model, glm::vec3(2.4f));` after the translation; `metallic`, `roughness` leave `PushConstants`, `albedo`, `ao` leave `UniformBufferObject` (and `updateUniformBuffer()`); destroy the sampler and the images in `cleanup()`. `pbr.vert`: `layout(location = 3) out vec3 fragTangent; fragTangent = mat3(pc.model) * inTangent;`. `pbr.frag`: `layout(binding = 1) uniform sampler2D albedoMap;` … `layout(binding = 5) uniform sampler2D aoMap;`, `getNormalFromMap()`: `vec3 tangentNormal = texture(normalMap, fragTexCoord).xyz * 2.0 - 1.0; vec3 N = normalize(fragNormal); vec3 T = normalize(fragTangent); T = normalize(T - dot(T, N) * N); vec3 B = cross(N, T); return normalize(mat3(T, B, N) * tangentNormal);`.
- **When done:** `main.cpp`: five `loadTexture("textures/<name>.png", VK_FORMAT_R8G8B8A8_UNORM, …)` calls (albedo, normal,
  metallic, roughness, ao – in binding order) and `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE,
  textureSampler)`; `std::array<VkDescriptorSetLayoutBinding, 6> bindings` (bindings 1..5 combined image samplers);
  the pool with `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` × 5; `std::array<VkWriteDescriptorSet, 6> descriptorWrites`
  with `dstBinding = i + 1`; `struct PushConstants { glm::mat4 model; }`; `UniformBufferObject` without `albedo` / `ao`
  (`glm::vec3 camPos; float pad1;` after the lights); `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`; `glm::rotate(model,
  glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f))` and `glm::scale(model, glm::vec3(2.4f))`; nine draws; the images,
  views, memories and the sampler destroyed. `pbr.vert`: `fragTangent`. `pbr.frag`: the five `sampler2D`s at bindings
  1..5, `getNormalFromMap()`, `albedo = pow(texture(albedoMap, fragTexCoord).rgb, vec3(2.2))`, `metallic` / `roughness`
  / `ao` from `.r`, `vec3 N = getNormalFromMap();`. **Nine large spheres of riveted steel with rust patches** (centres
  (202.5 + 197.5 · c, 497.5 - 197.5 · r), radius ≈ 80 px): two grooves cross in the middle of each sphere, four rivets
  around the cross, grey steel with soft highlights of the four lights, matt orange-brown rust. Middle sphere: the
  cross (400,300) = 93,88,86; steel above it (385,255) = 79,80,83; a rivet's lit top (368,283) = 111,113,116 and
  (430,283) = 109,109,112 (the rivets look raised: lit on the side towards the nearer lights, a dark edge on the other
  side); rust (450,340) = 105,62,40. Other spheres: steel highlight (160,60) = 175,176,179 (top-left sphere), rust
  (240,130) = 104,60,39, (640,440) = 88,67,55, steel (400,470) = 75,75,77; between the spheres bg (300,300) = 26,26,26.
  (9×9 box means around those points: 82,78,77 / 76,77,79 / 114,115,118 / 111,112,114 / 110,64,41 / 145,144,147 /
  105,61,39 / 84,61,49 / 90,91,94.) All five maps are sampled as they are (`_UNORM`, "linear"); the shader converts
  the albedo itself, learnopengl's way – `VK_FORMAT_R8G8B8A8_SRGB` for the albedo image would do the same conversion in
  the sampler. **The normal map:** learnopengl's `getNormalFromMap` derives the tangent from screen-space derivatives
  (`dFdx` / `dFdy`) "to keep things simple"; the course uses the sphere's vertex tangent, the Normal Mapping chapter's
  way. With the images flipped on load, u grows along `T` and v along `B = cross(N, T)` – the directions the normal
  map's red and green channels mean. No anisotropic filtering (`VK_FALSE`), so the maps are filtered exactly like
  OpenGL's `GL_LINEAR_MIPMAP_LINEAR` (with `VK_TRUE` the picture is a little sharper near the spheres' edges: mean
  difference 0.2/255). This is the solution.
