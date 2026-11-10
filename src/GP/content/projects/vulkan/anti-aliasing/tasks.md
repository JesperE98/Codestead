# Anti Aliasing (Vulkan) – multisample anti-aliasing (learnopengl "Anti Aliasing", vulkan-tutorial "Multisampling")

learnopengl `11.1.anti_aliasing_msaa` and `11.2.anti_aliasing_offscreen`; vulkan-tutorial `en/10_Multisampling.md` /
`code/30_multisampling.cpp`. Files: `main.cpp`, `shaders/anti_aliasing.vert/.frag` (the cube: `ubo.proj * ubo.view *
pc.model`, flat green `vec4(0.0, 1.0, 0.0, 1.0)`) and `shaders/aa_post.vert/.frag` (the screen quad, used from the
`resolve` task on).

**Start:** learnopengl 11.1's scene without multisampling, in the program of the earlier chapters
(HelloTriangleApplication, `createPipeline(vert, frag, attributeCount, pipeline)`, the model matrix as a push constant,
view/projection in the uniform buffer, the camera globals at (0, 0, 3) looking down -z – yaw -90, pitch 0, fov 45,
800/600, 0.1, 100; WASD / mouse / scroll still work): one cube (36 vertices, the cube of the earlier chapters – its
texture coordinates are not read) at the origin, flat green, clear (0.1, 0.1, 0.1), depth test on. No textures. TODOs:
in `pickPhysicalDevice()` (the sample count), in `createRenderPass()` (the multisampled attachments) and in `aa_post.frag`
(the grayscale effect). `aa_post.vert/.frag` compile but are unused until `resolve`.

**Deviation from learnopengl (as in the OpenGL chapter):** the cube is turned by a fixed
`model = glm::rotate(model, glm::radians(30.0f), glm::vec3(1.0f, 1.0f, 0.0f));` – learnopengl's unrotated cube seen
from (0, 0, 3) is a square with horizontal and vertical edges, which show no jagged steps.

Vulkan has no `GLFW_SAMPLES`: the swap chain's images always have one sample per pixel. Multisampling means drawing
into a **multisampled colour image of our own** (with a depth image of the same sample count) and **resolving** it –
averaging each pixel's samples – into a one-sample image at the end of the render pass (a resolve attachment). So
learnopengl's two steps (a multisampled window, then an off-screen multisampled framebuffer with `glBlitFramebuffer`)
are one step here (`msaa`, vulkan-tutorial's chapter, resolving into the swap chain image); `resolve` then resolves
into an image of our own instead, which a screen quad shows (learnopengl's intermediate framebuffer), and
`post-process` changes the quad's shader. Every state compiles and runs with zero validation messages.

Pixels measured on lavapipe (800×600, from the top left). Nothing depends on time. The cube's silhouette (a hexagon:
three faces, all the same green) covers x 257..590, y 157..490. Background 26,26,26.

**Start picture:** the green silhouette with **hard, stair-stepped edges**: the image has exactly two colours, 0,255,0
and 26,26,26 (0 mixed edge pixels). Centre (400,300) = 0,255,0; (257,350) and (567,350) = 0,255,0; background
(100,100), (200,150), (600,450), (100,500) = 26,26,26. Identical to the OpenGL start, pixel for pixel.

How to check smooth edges: count the pixels that are neither background nor pure green (nor, after `post-process`, pure
182 grey). With 4 samples the edge pixels get the mixes 1/4, 2/4, 3/4 of green and background (green channel ≈ 83, 140,
198): lavapipe **806** such pixels – as many as Mesa's OpenGL; which edge pixel gets which mix depends on the sample
positions (Vulkan's standard 4-sample pattern is OpenGL's mirrored in y, so 338 edge pixels have a different mix than in
the OpenGL picture) – check the count (several hundred, > 300) rather than single edge pixels.

## `sample-count`
- **Task:** Find out how many samples per pixel to use: a member `VkSampleCountFlagBits msaaSamples = VK_SAMPLE_COUNT_1_BIT;`, set in `pickPhysicalDevice()` with `getMaxUsableSampleCount()` – 4 if the device supports 4 samples for both colour and depth attachments (else 2, else 1); and give `createImage()` a `VkSampleCountFlagBits numSamples` parameter for `imageInfo.samples` (the depth image passes `VK_SAMPLE_COUNT_1_BIT` for now).
- **Hint:** `VkSampleCountFlags counts = physicalDeviceProperties.limits.framebufferColorSampleCounts & physicalDeviceProperties.limits.framebufferDepthSampleCounts;` then `if (counts & VK_SAMPLE_COUNT_4_BIT) { return VK_SAMPLE_COUNT_4_BIT; }` … vulkan-tutorial returns the most the device offers (up to 64); we take 4 like learnopengl, so the picture is the same on every GPU.
- **When done:** code only, **no visible change** (the jagged start picture): member `msaaSamples`;
  `msaaSamples = getMaxUsableSampleCount();` after `physicalDevice = device;`; `VkSampleCountFlagBits
  getMaxUsableSampleCount()` with `framebufferColorSampleCounts & framebufferDepthSampleCounts` and
  `VK_SAMPLE_COUNT_4_BIT` / `_2_BIT` / `_1_BIT`; `void createImage(uint32_t width, uint32_t height,
  VkSampleCountFlagBits numSamples, VkFormat format, …)` with `imageInfo.samples = numSamples;`; the depth image's
  `createImage(…, VK_SAMPLE_COUNT_1_BIT, depthFormat, …)`.

## `msaa`
- **Task:** Turn on multisampling (vulkan-tutorial's Multisampling chapter): a multisampled colour image (`createColorResources()`: `colorImage` with `msaaSamples`, usage `VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`, and its view), the depth image with `msaaSamples` too, a render pass whose colour and depth attachments have `msaaSamples` and whose third attachment – the swap chain image – is the subpass's **resolve attachment**, framebuffers with the three views, and `multisampling.rasterizationSamples = msaaSamples` in the pipeline.
- **Hint:** The multisampled colour attachment keeps `finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` (it is never presented); `colorAttachmentResolve` (one sample, `loadOp` DONT_CARE, `storeOp` STORE, `finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR`) with `colorAttachmentResolveRef.attachment = 2` and `subpass.pResolveAttachments = &colorAttachmentResolveRef;`. Framebuffer attachments in the render pass's order: `{colorImageView, depthImageView, swapChainImageViews[i]}`. The colour image is reused every frame: the subpass dependency's `srcAccessMask` gets `VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT`. Destroy the colour image, its memory and view in `cleanup()`.
- **When done:** members `colorImage`, `colorImageMemory`, `colorImageView`; `createColorResources()` called before
  `createDepthResources()` (`createImage(…, msaaSamples, colorFormat, VK_IMAGE_TILING_OPTIMAL,
  VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, …)`);
  the depth image with `msaaSamples`; in `createRenderPass()` `colorAttachment.samples = msaaSamples`,
  `colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`, `depthAttachment.samples = msaaSamples`,
  `colorAttachmentResolve` + `colorAttachmentResolveRef` (attachment 2), `subpass.pResolveAttachments`,
  `std::array<VkAttachmentDescription, 3> attachments = {colorAttachment, depthAttachment, colorAttachmentResolve}`,
  `dependency.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT`;
  `createFramebuffers()` with `{colorImageView, depthImageView, swapChainImageViews[i]}`;
  `multisampling.rasterizationSamples = msaaSamples;`; cleanup of the colour image. **The cube's edges become smooth**:
  806 mixed edge pixels (green channel 83 / 140 / 198), e.g. (257,350) = 7,198,7, (567,350) = 7,198,7,
  (304,480) = 7,198,7 (OpenGL: 13,140,13 – the mirrored sample pattern); centre (400,300) = 0,255,0; background
  26,26,26; bounding box x 256..590, y 156..490. Unlike OpenGL's window samples this works headless too (lavapipe).

## `resolve`
- **Task:** Resolve into an image of our own instead of the window, so the anti-aliased picture can be post-processed (learnopengl 11.2's intermediate framebuffer, the framebuffers chapter's offscreen target): the multisampled render pass becomes `createOffscreenRenderPass()` whose resolve attachment `offscreenImage` ends in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, with `offscreenFramebuffer` (`createOffscreenFramebuffer()`: `{colorImageView, depthImageView, offscreenImageView}`); `createRenderPass()` becomes the window's pass with the swap chain image only; a sampler and a descriptor set (`screenDescriptorSet`, the image at binding 1) for the screen quad; the screen quad (learnopengl's `quadVertices`, vertices 36..41) drawn with `aa_post.vert/.frag` in the window's pass.
- **Hint:** A multisampled image cannot be sampled like a normal one; the resolve attachment turns it into one. `createPipeline()` gets the render pass, the sample count and the depth test as parameters: the cube's pipeline `createPipeline("shaders/anti_aliasing.vert.spv", "shaders/anti_aliasing.frag.spv", 1, offscreenRenderPass, msaaSamples, VK_TRUE, graphicsPipeline)`, the quad's `createPipeline("shaders/aa_post.vert.spv", "shaders/aa_post.frag.spv", 2, renderPass, VK_SAMPLE_COUNT_1_BIT, VK_FALSE, screenPipeline)`. Two subpass dependencies in the offscreen pass: before it, wait for the last frame's quad to have read the image; after it, the quad's fragment shader waits for the resolve's writes (`VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT` → `VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT`). The descriptor pool now holds two sets of the layout (UBO + texture each). In `recordCommandBuffer()`: `// 1.` the offscreen pass (clear 0.1 and depth 1.0, the cube), then `// 2.` the window's pass (cleared white), `screenPipeline`, `screenDescriptorSet`, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`.
- **When done:** `main.cpp`: the quad's six vertices appended to `vertices`; members `offscreenRenderPass`,
  `screenPipeline`, `offscreenImage`, `offscreenImageMemory`, `offscreenImageView`, `offscreenFramebuffer`,
  `textureSampler`, `screenDescriptorSet` (all destroyed in `cleanup()`); `createRenderPass()` = one attachment
  (`swapChainImageFormat`, 1 sample, CLEAR, `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR`), `createOffscreenRenderPass()` = the
  `msaa` render pass with `colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` and
  `std::array<VkSubpassDependency, 2> dependencies`; `createFramebuffers()` with `{swapChainImageViews[i]}`;
  `createOffscreenFramebuffer()` (`offscreenImage`: 1 sample, `swapChainImageFormat`, usage
  `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`); `createTextureSampler()` (LINEAR, CLAMP_TO_EDGE);
  the layout's `samplerLayoutBinding` (binding 1, fragment stage); pool sizes 2 × UBO, 2 × sampler, `maxSets = 2`;
  `createScreenDescriptorSet()`; `createPipeline(…, uint32_t attributeCount, VkRenderPass pipelineRenderPass,
  VkSampleCountFlagBits rasterizationSamples, VkBool32 depthTestEnable, VkPipeline& pipeline)` with
  `multisampling.rasterizationSamples = rasterizationSamples`, `depthStencil.depthTestEnable/depthWriteEnable =
  depthTestEnable`, `pipelineInfo.renderPass = pipelineRenderPass`; the two passes in `recordCommandBuffer()`
  (`offscreenPassInfo` with `offscreenRenderPass` / `offscreenFramebuffer`, then `renderPassInfo` with
  `VkClearValue clearColor = {{{1.0f, 1.0f, 1.0f, 1.0f}}};`). **No visible change** (the smooth cube of `msaa`, pixel for
  pixel: 806 mixed edge pixels, centre 0,255,0, background 26,26,26; the white clear is completely covered by the quad).

## `post-process`
- **Task:** Post-process the anti-aliased picture: show it in grey in `aa_post.frag` (learnopengl's weighted grayscale 0.2126 / 0.7152 / 0.0722).
- **Hint:** `float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;` then `outColor = vec4(vec3(grayscale), 1.0);`. The effect works on the resolved picture, so the edges stay smooth.
- **When done:** `aa_post.frag`: `float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;` and
  `outColor = vec4(vec3(grayscale), 1.0);`. **The cube turns grey**: inside (400,300) = 182,182,182 (0.7152 × 255),
  background (100,100) = 26,26,26 (grey stays grey), smooth grey edges ≈ 65 / 104 / 144 (806 mixed pixels, e.g.
  (257,350) = 144,144,144). Static. Final state.
