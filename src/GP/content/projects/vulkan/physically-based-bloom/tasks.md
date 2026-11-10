# Physically Based Bloom (Vulkan) – tasks

learnopengl "Guest Articles / Phys. Based Bloom": `src/8.guest/2022/6.physically_based_bloom/physically_based_bloom.cpp`
with `6.new_downsample.vs/.fs`, `6.new_upsample.vs/.fs`, `6.bloom_final.fs` (its `bloom_new()`), and the scene of
learnopengl's Bloom chapter. Files: `main.cpp`, `textures/wood.png`, `textures/container2.png`, and in `shaders/` (each
built to `<name>.spv`): `bloom.vert/.frag` (the scene's lighting), `light_box.frag` (the light cubes), `bloom_final.vert/.frag`
(tone mapping), `downsample.vert/.frag` and `upsample.vert/.frag` (learnopengl's `6.new_downsample` / `6.new_upsample`; the
`.vert` files – the screen quad – are complete, the `.frag` files' push constants and `main`s are TODOs in the start).

**Screenshot time: 1.0 s** (nothing moves).

**The start** is the Vulkan `bloom` chapter's start (the scene **without** bloom, learnopengl's `programChoice == 1`),
with the Gaussian blur's TODOs removed: the scene rendered into one `VK_FORMAT_R16G16B16A16_SFLOAT` colour image
(`hdrColorImage`) + a depth image (`hdrRenderPass`, `hdrFramebuffer`), tone-mapped to the window by `bloomFinalPipeline`
(`bloom_final.frag`, sampler `scene` at binding 1) on the screen quad (vertices 36..41). There is no bright pass: the
physically based bloom works on the **whole HDR image, without a threshold** (as the article says; learnopengl's demo
still passes its thresholded image) – it reads `hdrDescriptorSet`.

**Fixed choices (the same in every API, see `../../opengl/physically-based-bloom/tasks.md`):**
- Scene, camera, lights, textures, exposure (1.0) and tone mapping exactly as the `bloom` chapter (see
  `../bloom/tasks.md`): camera (0, 0, 5) looking down -z, clear (0, 0, 0), floor cube + six container boxes + four light
  cubes, both textures sRGB.
- **Structs and free functions** (learnopengl's `bloomFBO` / `BloomRenderer` classes): `struct BloomMip { glm::vec2
  size; glm::ivec2 intSize; VkImage image; VkDeviceMemory memory; VkImageView view; VkFramebuffer framebuffer;
  VkDescriptorSet descriptorSet; };` and `struct BloomFBO { VkRenderPass renderPass; VkRenderPass upsampleRenderPass;
  std::vector<BloomMip> mipChain; };` (learnopengl's FBO → Vulkan's render passes + one framebuffer per level);
  `RenderDownsamples(BloomFBO&, VkCommandBuffer, VkPipeline downsamplePipeline, VkPipelineLayout, VkDescriptorSet
  srcTexture, glm::vec2 srcViewportSize)` and `RenderUpsamples(BloomFBO&, VkCommandBuffer, VkPipeline upsamplePipeline,
  VkPipelineLayout, float filterRadius)` are free functions called from `recordCommandBuffer()`; `InitBloomFBO(BloomFBO&,
  unsigned int windowWidth, unsigned int windowHeight, unsigned int mipChainLength)` and `DestroyBloomFBO(BloomFBO&)` are
  member functions of the application (they need the device and its `createImage` / `createImageView` helpers).
- **The mip chain: separate images** (like learnopengl's separate textures), 6 levels, each half the size of the one
  before, starting at half the window: **400×300, 200×150, 100×75, 50×37, 25×18, 12×9** (`mipSize *= 0.5f; mipIntSize
  /= 2;` – the image sizes are the truncated float sizes, the same numbers), format **`VK_FORMAT_B10G11R11_UFLOAT_PACK32`**
  (learnopengl's `GL_R11F_G11F_B10F`: three small unsigned floats, no alpha), usage colour attachment + sampled, read
  through `colorBufferSampler` (LINEAR, clamp to edge). The other Vulkan way – one image with 6 mip levels and an image
  view (and framebuffer) per level, with barriers per level – saves allocations; the course keeps learnopengl's
  structure. A Vulkan framebuffer's attachments are fixed, so every level has **its own framebuffer** (learnopengl
  switches one FBO's colour attachment with `glFramebufferTexture2D`), and its own **descriptor set** (the uniform
  buffer at binding 0, the level at binding 1) to be read by the next pass.
- Two render passes for the levels (`InitBloomFBO`): `bloomFBO.renderPass` (the downsample: `loadOp DONT_CARE` – the
  quad covers the whole level –, `STORE`, initial layout `UNDEFINED`, final `SHADER_READ_ONLY_OPTIMAL`) and
  `bloomFBO.upsampleRenderPass` (the upsample: `loadOp LOAD`, initial and final layout `SHADER_READ_ONLY_OPTIMAL`; the same
  framebuffers – the two render passes are compatible). Their subpass dependencies make each pass wait for the colour
  writes of the pass before it (the image layouts change at the render pass boundaries: no explicit barriers needed).
  Every level pass sets the viewport and scissor to the level's size (learnopengl's `glViewport`); after the bloom
  passes the window's viewport and scissor are set again.
- Push constants (one range, vertex + fragment): `struct PushConstants { glm::mat4 model; glm::vec3 lightColor;
  alignas(8) glm::vec2 srcResolution; float filterRadius; int mipLevel; }` – std430: the vec2 starts at a multiple of 8
  (offset 80, after 4 bytes of padding – hence `alignas(8)` in C++), `filterRadius` at 88, `mipLevel` at 92; each task
  adds the field it needs. `bloomStrength` goes into the uniform buffer after `exposure` (std140 offset 272).
- **Downsample** (`downsample.frag`): learnopengl's 13-tap filter, `srcResolution` = the size of the texture being read
  (800×600 for the first pass, then each level's float `size`), first input = `hdrDescriptorSet`.
- **Upsample** (`upsample.frag`): learnopengl's 3×3 tent filter with `filterRadius` = **0.005** (texture coordinates),
  from the smallest level up: level i is read and **added** (the upsample pipeline blends with ONE / ONE, `ADD` –
  `createPipeline` gets a `blendEnable` parameter) to level i − 1, for i = 5 … 1. The bloom texture is level 0.
- **Combine** (`bloom_final.frag`): `hdrColor = mix(hdrColor, bloomColor, ubo.bloomStrength)` with **bloomStrength =
  0.04**, the bloom texture at binding 2 (`bloomDescriptorSet` from `createBloomDescriptorSet`, as in the `bloom`
  chapter), then the exposure tone mapping and gamma.
- **Karis average** (last task): on the first downsample only (`pc.mipLevel`: 0 for the first pass, then 1),
  learnopengl's five 4-sample groups each weighted by `1 / (1 + luma(ToSRGB(group)) * 0.25)`, then `max(…, 0.0001)`;
  `if (pc.mipLevel == 0) … else …`.
- The texture coordinates of the screen quad are used unchanged in every pass (Vulkan's window y and image v both point
  down); the filters are symmetric in y, so learnopengl's "+ y" / "− y" samples give the same result.

Named points (as OpenGL's; pixels from the top left of the 800×600 window, lavapipe): **white-light** (400,200),
**green-light** (300,20), **box-top** (400,60), **box-frame** (400,128), **box-right** (675,300), **floor-mid**
(450,380), **floor-left** (200,450), **floor-right** (700,500), **background** (600,100), **glow-right** (465,200),
**glow-below** (400,262), **glow-green** (290,55), **corner** (480,130), **rim** (338,200). Every state equals OpenGL's
picture within 1–3 per channel at these points, except **corner**, which is the edge pixel of a box's steel frame:
lavapipe covers it, Mesa's OpenGL does not (start: 96,97,106 here, 3,3,3 in OpenGL; later states 125–155 here) – a
check should not use it.

**Start picture** (the scene without bloom): white-light = 254,254,254, green-light = 0,254,0, box-top = 166,117,71,
box-frame = 208,209,218, box-right = 169,120,66, floor-mid = 172,134,93, floor-left = 85,59,48, floor-right =
123,91,70, background = 0,0,0, glow-right = 0,0,0, glow-below = 0,0,0, glow-green = 0,0,0, rim = 32,33,70. Hard edges
around the light cubes.

## `mip-chain`
- **Task:** Create the bloom framebuffer and its mip chain: a `BloomMip` struct (float and integer size, image, memory, view, framebuffer) and a `BloomFBO` struct (the render pass that writes a level, the vector of mips), and `InitBloomFBO`, which creates the render pass and six `VK_FORMAT_B10G11R11_UFLOAT_PACK32` images, each half the size of the one before (starting at half the window), with their views and framebuffers; `DestroyBloomFBO` for the cleanup. Call it for the window size with 6 levels.
- **Hint:** The render pass: one colour attachment, `loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE`, `storeOp = VK_ATTACHMENT_STORE_OP_STORE`, `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, a dependency from earlier fragment-shader reads / colour writes to this pass's colour writes and one from its colour writes to later fragment-shader reads. In the loop: `mipSize *= 0.5f; mipIntSize /= 2;`, `createImage(static_cast<uint32_t>(mipSize.x), static_cast<uint32_t>(mipSize.y), VK_FORMAT_B10G11R11_UFLOAT_PACK32, …, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, …)`, `createImageView`, `vkCreateFramebuffer`, `bloomFBO.mipChain.push_back(mip);`. Call it in `initVulkan()` right after `createHdrRenderPass()` (the bloom's pipelines will need its render pass).
- **When done:** `main.cpp`: `struct BloomMip`, `struct BloomFBO`, the member `BloomFBO bloomFBO;`, `bool InitBloomFBO(…)`
  (`vkCreateRenderPass(…, &bloomFBO.renderPass)`, the `for` loop over `mipChainLength` with
  `VK_FORMAT_B10G11R11_UFLOAT_PACK32`, `push_back`), `void DestroyBloomFBO(BloomFBO&)`; in `initVulkan()`
  `InitBloomFBO(bloomFBO, swapChainExtent.width, swapChainExtent.height, 6)` with the error check; `DestroyBloomFBO(bloomFBO);`
  in `cleanup()`. **No visible change** (same pixels as the start).

## `downsample`
- **Task:** Downsample the HDR scene through the mip chain every frame: write the 13-tap downsample shader and `RenderDownsamples` – for each level begin its render pass on its framebuffer, set the viewport and scissor to its size, draw the screen quad reading the previous level (the scene for the first), then read this level next. Give every level a descriptor set, and for now show the third level (100 × 75) in the window instead of the scene.
- **Hint:** Push constants: `alignas(8) glm::vec2 srcResolution;` in `PushConstants` and the block up to `vec2 srcResolution` in `downsample.frag`. In `downsample.frag` take the 13 samples a … m around `texCoord` (`x`, `y` = one source texel = `1.0 / pc.srcResolution`) and add `e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125`. `downsamplePipeline` with `bloomFBO.renderPass`; `for (BloomMip& mip : bloomFBO.mipChain) createDescriptorSet(mip.view, colorBufferSampler, mip.descriptorSet);` (the pool now has 9 sets). In `recordCommandBuffer()` after the HDR pass: `RenderDownsamples(bloomFBO, commandBuffer, downsamplePipeline, pipelineLayout, hdrDescriptorSet, glm::vec2((float)swapChainExtent.width, (float)swapChainExtent.height));`, then the window's viewport and scissor again; the final pass binds `bloomFBO.mipChain[2].descriptorSet`.
- **When done:** `main.cpp`: `srcResolution` in `PushConstants`, `VkDescriptorSet descriptorSet;` in `BloomMip`, `void
  RenderDownsamples(…)` (per level: `vkCmdBeginRenderPass` with `bloomFBO.renderPass` and `mip.framebuffer`, viewport and
  scissor `mip.intSize`, `downsamplePipeline`, `vkCmdPushConstants`, the input's descriptor set, `vkCmdDraw(commandBuffer,
  6, 1, 36, 0)`, `vkCmdEndRenderPass`; then `constants.srcResolution = mip.size; inputTexture = mip.descriptorSet;`),
  `downsamplePipeline` (`createPipeline("shaders/downsample.vert.spv", "shaders/downsample.frag.spv", bloomFBO.renderPass,
  downsamplePipeline)`), the six descriptor sets, the `// 2.` block in `recordCommandBuffer()`, the final pass binds
  `bloomFBO.mipChain[2].descriptorSet`. `downsample.frag`: the push constants and learnopengl's 13 samples and weights
  (no Karis average yet). The window shows the **100 × 75 level, stretched: the scene blurred and blocky**: white-light =
  254,254,254, green-light = 7,254,8, box-top = 169,120,72, box-frame = 240,239,239, box-right = 165,118,64, floor-mid =
  175,137,97, floor-left = 85,58,47, floor-right = 122,91,69, background = 0,0,0, glow-right = 165,165,164, glow-below =
  145,145,144, glow-green = 0,222,0, rim = 213,213,214 (the light cubes smeared into their surroundings).

## `upsample`
- **Task:** Upsample back up the chain: a second render pass for the levels that loads their contents (`loadOp LOAD`), the tent-filter upsample shader, a `blendEnable` parameter for `createPipeline` (additive blending ONE / ONE), and `RenderUpsamples` – from the smallest level up, read level i and draw it into level i − 1 (its framebuffer, viewport and scissor), adding to what the downsample left there. The filter radius is 0.005 in texture coordinates. For now show level 0 – the finished bloom texture – in the window.
- **Hint:** In `InitBloomFBO` change the attachment to `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD`, `initialLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` and create `bloomFBO.upsampleRenderPass` with the same create info (destroy it in `DestroyBloomFBO`). `createPipeline(…, VkBool32 blendEnable, …)`: `colorBlendAttachment.blendEnable = blendEnable;` with `srcColorBlendFactor = dstColorBlendFactor = VK_BLEND_FACTOR_ONE`, `colorBlendOp = VK_BLEND_OP_ADD` (the same for alpha); `VK_FALSE` for the existing pipelines, `VK_TRUE` for `upsamplePipeline` (`bloomFBO.upsampleRenderPass`). `float filterRadius;` in `PushConstants`, `float bloomFilterRadius = 0.005f;`. `for (int i = (int)bloomFBO.mipChain.size() - 1; i > 0; i--)` with `mip = mipChain[i]`, `nextMip = mipChain[i - 1]`. `upsample.frag`: 9 samples `pc.filterRadius` apart, `e*4 + (b+d+f+h)*2 + (a+c+g+i)`, divided by 16.
- **When done:** `main.cpp`: `float bloomFilterRadius = 0.005f;`, `filterRadius` in `PushConstants`,
  `upsampleRenderPass` in `BloomFBO` (created in `InitBloomFBO` with `VK_ATTACHMENT_LOAD_OP_LOAD`, destroyed in
  `DestroyBloomFBO`), `createPipeline` with `VkBool32 blendEnable` (ONE / ONE, ADD), `upsamplePipeline`
  (`createPipeline("shaders/upsample.vert.spv", "shaders/upsample.frag.spv", bloomFBO.upsampleRenderPass, VK_TRUE,
  upsamplePipeline)`), `void RenderUpsamples(…)` (the reverse loop: `bloomFBO.upsampleRenderPass` with
  `nextMip.framebuffer`, viewport `nextMip.intSize`, `upsamplePipeline`, `mip.descriptorSet`, 6 vertices),
  `RenderUpsamples(bloomFBO, commandBuffer, upsamplePipeline, pipelineLayout, bloomFilterRadius);` after
  `RenderDownsamples`; the final pass binds `bloomFBO.mipChain[0].descriptorSet`. `upsample.frag`: the push constants up
  to `filterRadius` and learnopengl's tent filter. The window shows the **bloom texture**: the whole scene very soft and
  bright (the six levels add up), big white halos around the light cubes, even the black background lit: white-light =
  255,255,255, green-light = 139,255,121, box-top = 250,234,196, box-frame = 255,255,255, box-right = 245,214,153,
  floor-mid = 251,236,209, floor-left = 179,137,128, floor-right = 222,184,147, background = 41,40,40, glow-right =
  254,254,254, glow-below = 254,254,254, glow-green = 140,255,128, rim = 255,255,255.

## `combine`
- **Task:** Mix the bloom texture into the scene in the final pass: the scene at binding 1, the bloom texture (level 0) at binding 2 (sampler `bloomBlur`), and in `bloom_final.frag` `mix(hdrColor, bloomColor, ubo.bloomStrength)` with a bloom strength of 0.04 before the tone mapping.
- **Hint:** `float bloomStrength = 0.04f;`, `float bloomStrength;` after `exposure` in `UniformBufferObject` and in the shader's block, `ubo.bloomStrength = bloomStrength;` in `updateUniformBuffer()`. A third layout binding (binding 2, combined image sampler, fragment stage), the pool for 10 sets (10 uniform buffers, 20 image samplers), `createBloomDescriptorSet(hdrColorImageView, bloomFBO.mipChain[0].view, colorBufferSampler, bloomDescriptorSet)` (the `bloom` chapter's helper) and the final pass binds `bloomDescriptorSet`. A linear interpolation instead of an addition keeps the energy: 96 % scene, 4 % bloom.
- **When done:** `main.cpp`: `float bloomStrength = 0.04f;`, `bloomStrength` in the uniform buffer, the binding-2 layout
  entry, `createBloomDescriptorSet`, `bloomDescriptorSet` bound in the final pass. `bloom_final.frag`: `float
  bloomStrength;` in the block, `layout(binding = 2) uniform sampler2D bloomBlur;`, `vec3 bloomColor = texture(bloomBlur,
  fragTexCoord).rgb;`, `hdrColor = mix(hdrColor, bloomColor, ubo.bloomStrength);`. The scene is back with a **soft glow
  everywhere bright light is**: white-light = 255,255,255, green-light = 34,255,29, box-top = 177,131,85, box-frame =
  225,225,230, box-right = 177,128,73, floor-mid = 183,145,105, floor-left = 93,65,55, floor-right = 132,99,76,
  background = 10,9,9, glow-right = 119,119,117, glow-below = 117,116,114, glow-green = 35,124,31, rim = 139,139,146.

## `karis-average`
- **Task:** Against "fireflies" (single very bright pixels that flicker when they move): in the first downsample only, weight each of the five 4-sample groups by the Karis average `1 / (1 + luma / 4)` of its sRGB colour. A `mipLevel` push constant says which pass it is: 0 for the first, 1 after it.
- **Hint:** `int mipLevel;` at the end of `PushConstants` and of the shader's block. In `RenderDownsamples`: `constants.mipLevel = 0;` before the loop and `if (i == 0) { constants.mipLevel = 1; }` at the end of the first iteration. `downsample.frag`: learnopengl's `PowVec3`, `ToSRGB`, `sRGBToLuma` (0.299, 0.587, 0.114) and `KarisAverage`; for `pc.mipLevel == 0` the groups `(a+b+d+e) * (0.125/4.0)` … `(j+k+l+m) * (0.5/4.0)`, each `*= KarisAverage(…)`, summed, `max(downsample, 0.0001)`; otherwise the old weights.
- **When done:** `main.cpp`: `int mipLevel;` in `PushConstants`, `constants.mipLevel = 0;` and `if (i == 0) {
  constants.mipLevel = 1; }` in `RenderDownsamples`. `downsample.frag`: `int mipLevel;` in the block, `PowVec3`, `ToSRGB`,
  `sRGBToLuma`, `KarisAverage`, `vec3 groups[5];` and the `if (pc.mipLevel == 0)` branch. The glow around the brightest
  parts gets a little weaker: white-light = 255,255,255, green-light = 33,255,28, box-top = 176,129,83, box-frame =
  222,223,228, box-right = 177,127,73, floor-mid = 182,144,103, floor-left = 93,65,54, floor-right = 131,98,76,
  background = 9,9,9, glow-right = 107,107,105, glow-below = 106,105,103, glow-green = 33,117,29, rim = 127,127,136.
  The scene is still: there are no fireflies to see in a still picture. This is the solution.
