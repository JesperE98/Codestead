# Coordinate Systems (Vulkan) – model / view / projection, a uniform buffer, depth buffering (learnopengl "Coordinate Systems")

vulkan-tutorial: "Uniform buffers" (22 descriptor layout and buffer, 23 descriptor pool and sets) and "Depth buffering"
(27), with learnopengl's scene.

Start: the result of "Transformations" with the transformation code taken out again (like learnopengl's
coordinate_systems.cpp starts from the plain textured rectangle): one `vkCmdDrawIndexed`, no push yet, `shader.vert`
with the y flip (`gl_Position.y = -gl_Position.y;`). Kept from "Transformations": the push constant range (vertex
stage) in the pipeline layout and `struct PushConstants`, its field renamed to `glm::mat4 model`; the includes
(`<glm/gtc/matrix_transform.hpp>`, `<cmath>`). New empty stubs, already called: `createDepthResources()` (in
`initVulkan()` right before `createFramebuffers()`), `createUniformBuffers()` (after `createIndexBuffer()`),
`updateUniformBuffer()` (in `drawFrame()` right after `vkAcquireNextImageKHR`). `// TODO:` lines for
`struct UniformBufferObject`, the members, the cleanup, the uniform buffer layout binding and the two blocks in
`shader.vert`. The picture is the start picture of "Transformations": rectangle x 200..600, y 150..450, centre
(400, 300) = (125, 89, 30), frame (74, 46, 22) at (400, 160), teal (51, 76, 76) outside, e.g. (100, 100).

Where the values live:
- `model` (per draw, like learnopengl's `model` uniform set before each draw) → the **push constant** `pc.model`.
- `view` and `projection` (per frame) → a **uniform buffer** (`layout(binding = 2) uniform UniformBufferObject
  { mat4 view; mat4 proj; } ubo;`, C++ `struct UniformBufferObject { glm::mat4 view; glm::mat4 proj; };`), filled in
  `updateUniformBuffer()` like the tutorial and copied with `memcpy` into the persistently mapped buffer.
- `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` before `<glm/glm.hpp>` (Vulkan depth 0..1) and `ubo.proj[1][1] *= -1;` (GLM's
  clip space y points up, Vulkan's down) – this replaces the y flip in the shader, so learnopengl's vertex data and
  matrices give learnopengl's pictures.

Deviations from the tutorial (on purpose): one frame in flight, so one `VkBuffer uniformBuffer` /
`uniformBufferMemory` / `void* uniformBufferMapped` and `updateUniformBuffer()` without a frame index (it is called
after `vkWaitForFences`, so the GPU is not reading the buffer while we write it); the uniform buffer is binding **2**
of the existing set (bindings 0 and 1 stay the two textures); the model matrix is a push constant (the tutorial puts
it in the UBO, but learnopengl changes it per draw); time is `glfwGetTime()` as in learnopengl; no
`hasStencilComponent()` (unused here); `createDepthResources()` runs before `createFramebuffers()`, which in this
course comes before `createCommandPool()` (the depth image needs no command buffer: the render pass moves it out of
`UNDEFINED`). The window is not resizable, so there is no swap chain recreation.

Winding: with the y flip in the projection the pictures equal learnopengl's. The plane's triangles are clockwise on
screen (front faces with `VK_FRONT_FACE_CLOCKWISE`, back-face culling on). learnopengl's cube mixes clockwise and
counter-clockwise triangles (OpenGL does not cull by default), so the `cube` task sets
`rasterizer.cullMode = VK_CULL_MODE_NONE`.

Colours measured on lavapipe with the time fixed to 1 s (allow ±3). Screenshots of the real program are taken after
about 3 s: for the animated steps use the time-independent points.

Final program (solution): learnopengl's ten cubes (coordinate_systems_multiple) with every third cube rotating with
time, depth tested.

## uniform-buffer
- **Task:** Create the uniform buffer (tutorial "Descriptor layout and buffer"): `struct UniformBufferObject {
  glm::mat4 view; glm::mat4 proj; };`; members `VkBuffer uniformBuffer; VkDeviceMemory uniformBufferMemory; void*
  uniformBufferMapped;`; in `createUniformBuffers()`: `createBuffer(sizeof(UniformBufferObject),
  VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, HOST_VISIBLE | HOST_COHERENT, uniformBuffer, uniformBufferMemory)` and
  `vkMapMemory(…, &uniformBufferMapped)` (it stays mapped); in `cleanup()` `vkDestroyBuffer(device, uniformBuffer, …)`
  and `vkFreeMemory(device, uniformBufferMemory, …)`.
- **Hint:** Mapping once and keeping the pointer ("persistent mapping") is cheaper than mapping every frame; freeing
  the memory unmaps it.
- **When done:** picture unchanged (the rectangle). Code has `VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT`,
  `vkMapMemory(device, uniformBufferMemory, …, &uniformBufferMapped)`, `vkDestroyBuffer(device, uniformBuffer, …)`.

## uniform-descriptor
- **Task:** Make the buffer visible to the vertex shader (tutorial "Descriptor pool and sets"): a
  `VkDescriptorSetLayoutBinding uboLayoutBinding` (binding 2, 1 descriptor, `VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER`,
  `VK_SHADER_STAGE_VERTEX_BIT`) as the third entry of `bindings` (`std::array<…, 3>`); a second pool size
  (`VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER`, count 1); in `createDescriptorSets()` a `VkDescriptorBufferInfo bufferInfo`
  (`uniformBuffer`, offset 0, range `sizeof(UniformBufferObject)`) and a third write `descriptorWrites[2]`
  (binding 2, uniform buffer, `pBufferInfo = &bufferInfo`).
- **Hint:** The set is already bound in `recordCommandBuffer()`; it just gets one more descriptor.
- **When done:** picture unchanged. Code has `uboLayoutBinding.binding = 2`, `VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER` in
  the layout, the pool and the write, `pBufferInfo = &bufferInfo`.

## plane
- **Task:** Look at the rectangle as a floor tilted back, in perspective: `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` before
  `#include <glm/glm.hpp>`; `updateUniformBuffer()` fills `UniformBufferObject ubo{};` with
  `ubo.view = glm::translate(glm::mat4(1.0f), glm::vec3(0.0f, 0.0f, -3.0f));`,
  `ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);`,
  `ubo.proj[1][1] *= -1;` and copies it: `memcpy(uniformBufferMapped, &ubo, sizeof(ubo));`; `recordCommandBuffer()`
  pushes `model = glm::rotate(glm::mat4(1.0f), glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f))` as
  `constants.model` before the draw; `shader.vert` declares `layout(binding = 2) uniform UniformBufferObject { mat4
  view; mat4 proj; } ubo;` and `layout(push_constant) uniform PushConstants { mat4 model; } pc;` and computes
  `gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);` (the y flip line is removed).
- **Hint:** `proj[1][1] *= -1` flips y in the projection, which is why the shader flip must go – with both, the plane
  is upside down. Without `GLM_FORCE_DEPTH_ZERO_TO_ONE` the near half of the depth range would be clipped.
- **When done:** learnopengl's tilted plane: a trapezoid, narrow at the top (x 293..507 at y 241), wide at the bottom
  (x 261..539 at y 377), y 240..380, the crate upright with the face, heart right of centre. Centre (400, 300) =
  (125, 89, 30), (400, 250) = (179, 128, 54), bottom frame (400, 370) = (74, 46, 22), heart (450, 312) ≈
  (161, 83, 54); teal at (400, 235), (400, 400), (270, 240), (530, 240), (100, 100). Not animated.

## cube
- **Task:** Replace the rectangle by learnopengl's cube: `vertices` = its 36 vertices (position + texture coordinate,
  v flipped as before); remove the index buffer (`indices`, the `indexBuffer`/`indexBufferMemory` members,
  `createIndexBuffer()` and its call, the cleanup lines, `vkCmdBindIndexBuffer`) and draw with
  `vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);`; set
  `rasterizer.cullMode = VK_CULL_MODE_NONE;`.
- **Hint:** Every face has its own 6 vertices (its own texture coordinates), so an index buffer would save little.
  The cube's triangles are not all wound the same way – with back-face culling some faces would vanish.
- **When done:** the cube (still tilted -55° about x) without depth testing: faces drawn later cover nearer ones, so
  it looks inside-out (learnopengl's first cube picture). Content in x 244..557, y 139..475. (400, 300) =
  (179, 128, 54), (400, 200) = (179, 128, 54), (400, 380) = (125, 89, 30), (400, 150) and (300, 300) =
  (74, 46, 22), (400, 440) ≈ (160, 117, 48); teal at (400, 480) and (100, 100). Not animated.

## spin
- **Task:** Rotate the cube over time: `model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));`
  instead of the -55° rotation.
- **Hint:** `glm::rotate` normalizes the axis for you.
- **When done:** the cube tumbles (1 rad/s about (0.5, 1, 0)), still without depth test (back faces show through).
  At t = 1 s: (400, 300) = (142, 94, 46), (300, 300) = (125, 89, 30), (500, 300) = (179, 128, 54), (400, 450) =
  (179, 128, 54), (400, 150) = (74, 46, 22); (100, 100) teal at any time.

## depth-image
- **Task:** Create the depth buffer (tutorial "Depth buffering", first half): members `VkImage depthImage;
  VkDeviceMemory depthImageMemory; VkImageView depthImageView;`; `findSupportedFormat()` and `findDepthFormat()`
  (`VK_FORMAT_D32_SFLOAT`, `D32_SFLOAT_S8_UINT`, `D24_UNORM_S8_UINT` with `DEPTH_STENCIL_ATTACHMENT` support);
  `createDepthResources()`: `createImage(swapChainExtent.width, swapChainExtent.height, depthFormat,
  VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, …)` and
  `depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT);` – `createImageView()` gets a
  third parameter `VkImageAspectFlags aspectFlags` (the swap chain and texture views pass
  `VK_IMAGE_ASPECT_COLOR_BIT`); destroy the view, the image and its memory in `cleanup()`.
- **Hint:** One depth image is enough: only one frame is drawn at a time.
- **When done:** picture unchanged (the tumbling cube, still inside-out). Code has `findDepthFormat()`,
  `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT`, `VK_IMAGE_ASPECT_DEPTH_BIT`, `vkDestroyImage(device, depthImage, …)`.

## depth-test
- **Task:** Use it (tutorial "Depth buffering", second half): in `createRenderPass()` a `depthAttachment`
  (`findDepthFormat()`, loadOp `CLEAR`, storeOp `DONT_CARE`, initial layout `UNDEFINED`, final layout
  `DEPTH_STENCIL_ATTACHMENT_OPTIMAL`), `depthAttachmentRef` (attachment 1), `subpass.pDepthStencilAttachment`, the
  dependency extended to the fragment test stages and `DEPTH_STENCIL_ATTACHMENT_WRITE`, both attachments in
  `std::array<VkAttachmentDescription, 2> attachments`; the framebuffers get `{swapChainImageViews[i],
  depthImageView}`; the pipeline gets `VkPipelineDepthStencilStateCreateInfo depthStencil` (`depthTestEnable =
  VK_TRUE`, `depthWriteEnable = VK_TRUE`, `depthCompareOp = VK_COMPARE_OP_LESS`) via `pipelineInfo.pDepthStencilState`;
  `recordCommandBuffer()` clears both: `std::array<VkClearValue, 2> clearValues{}; clearValues[0].color =
  {{0.2f, 0.3f, 0.3f, 1.0f}}; clearValues[1].depthStencil = {1.0f, 0};`.
- **Hint:** The clear values are in attachment order. Depth 1.0 is the far plane, so the first fragment always wins
  and then only nearer ones (LESS).
- **When done:** a solid cube: only the nearest faces are visible (learnopengl's depth-tested cube). Clear colour
  still teal (51, 76, 76). At t = 1 s: (400, 300) = (118, 78, 42), (400, 450) = (74, 46, 22) (was (179, 128, 54)
  without depth test), (500, 300) = (168, 120, 50), (300, 300) = (125, 89, 30); (100, 100) teal.

## ten-cubes
- **Task:** Draw ten cubes: a global `const std::vector<glm::vec3> cubePositions` with learnopengl's ten positions
  ((0, 0, 0), (2, 5, -15), (-1.5, -2.2, -2.5), (-3.8, -2, -12.3), (2.4, -0.4, -3.5), (-1.7, 3, -7.5), (1.3, -2, -2.5),
  (1.5, 2, -2.5), (1.5, 0.2, -1.5), (-1.3, 1, -1.5)); in `recordCommandBuffer()` a loop
  `for (unsigned int i = 0; i < 10; i++)` that builds `model = glm::translate(glm::mat4(1.0f), cubePositions[i])`,
  rotates it by `glm::radians(20.0f * i)` about `(1.0f, 0.3f, 0.5f)`, pushes it and calls `vkCmdDraw` – ten draws.
- **Hint:** Each `vkCmdPushConstants` changes the model matrix for the draws after it; view and projection stay in
  the uniform buffer.
- **When done:** learnopengl's ten cubes, not animated. Cube 0 faces us, upright, front face x 256..544,
  y 156..444: centre (400, 300) = (125, 89, 30), (330, 240) = (168, 120, 50), frame (260, 300), (540, 300),
  (400, 155) = (74, 46, 22), heart right of centre (470, 320) ≈ (151, 80, 52); cube 8 at (640, 270) =
  (125, 89, 30); teal at (100, 500), (700, 500).

## rotate-every-third
- **Task:** Learnopengl's exercise: `if (i % 3 == 0) { angle = (float)glfwGetTime() * 25.0f; }` right after
  `float angle = 20.0f * i;`.
- **Hint:** Cubes 0, 3, 6 and 9 now turn 25° per second; the others keep their fixed angle.
- **When done:** cubes 0, 3, 6, 9 rotate, the rest stand still. At t = 1 s: (400, 300) = (168, 120, 50) (cube 0 turned
  by 25°), (470, 270) = (125, 89, 30), (380, 160) ≈ (98, 62, 22); unchanged: (640, 270) = (125, 89, 30) (cube 8),
  teal at (100, 500), (700, 500).
