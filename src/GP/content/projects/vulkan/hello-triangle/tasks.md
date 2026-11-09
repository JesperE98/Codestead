# Hello Triangle (Vulkan) – vulkan-tutorial 09–12 (pipeline), 18–19 (vertex buffer, no staging), 21 (index buffer)

Start: the solution of "Hello Window" (window cleared to teal every frame) plus:
- `shaders/shader.vert` and `shaders/shader.frag` (GLSL 450) with `// TODO:` lines and empty `main()`s. The build
  compiles them to `shaders/vert.spv` and `shaders/frag.spv`, which the program loads with `readFile`.
- a `createGraphicsPipeline()` stub (called in `initVulkan()` after `createRenderPass()`) with four `// TODO:` lines,
  and `// TODO:` lines for `Vertex`, `vertices`, `indices`, the members, `createVertexBuffer()`,
  `createIndexBuffer()`, `findMemoryType()`, `createShaderModule()`, `readFile()`, the draw commands in
  `recordCommandBuffer()` and the `cleanup()` calls.
- the includes `<glm/glm.hpp>`, `<fstream>` and `<array>` are already there.

Every intermediate state builds and runs without validation messages and shows the teal window until `draw`.
Note: after `shader-modules`, `vertex-input` and `fixed-functions` the compiler warns about unused local variables
(`shaderStages`, `vertexInputInfo`, …) – expected, they are used once the `pipeline` task is done.

Solution: an orange `(1.0, 0.5, 0.2)` rectangle (two triangles, index buffer) on teal `(0.2, 0.3, 0.3)`.
Deviation from the tutorial: the index buffer uses host-visible memory like the vertex buffer (no staging buffer,
as in 19_vertex_buffer); the tutorial's 21 uses staging buffers for both.

## shaders
- **Task:** Write the two shaders: `shader.vert` takes `layout(location = 0) in vec3 inPosition;` and writes
  `gl_Position = vec4(inPosition, 1.0);`; `shader.frag` declares `layout(location = 0) out vec4 outColor;` and writes
  `outColor = vec4(1.0, 0.5, 0.2, 1.0);`.
- **Hint:** Vulkan shaders need explicit `location`s; `#version 450` is already there.
- **When done:** both shaders compile (to vert.spv / frag.spv); the window still only shows teal (the program does
  not use the shaders yet).

## shader-modules
- **Task:** Load the SPIR-V files and wrap them in shader modules: write `readFile()` and `createShaderModule()`;
  in `createGraphicsPipeline()` read `shaders/vert.spv` and `shaders/frag.spv`, create the two modules, fill the two
  `VkPipelineShaderStageCreateInfo`s (vertex / fragment stage, entry point `"main"`) and the `shaderStages` array,
  and destroy the modules at the end of the function.
- **Hint:** Open the file with `std::ios::ate | std::ios::binary` to get its size from `tellg()`.
- **When done:** still teal; the program fails with "failed to open file!" if the .spv files are missing.
  Code has `readFile("shaders/vert.spv")`, `vkCreateShaderModule` and two `vkDestroyShaderModule` calls.

## vertex-input
- **Task:** Describe the vertex data: add `struct Vertex { glm::vec3 pos; }` with `getBindingDescription()`
  (binding 0, stride `sizeof(Vertex)`, per vertex) and `getAttributeDescriptions()` (location 0,
  `VK_FORMAT_R32G32B32_SFLOAT`, `offsetof(Vertex, pos)`), and the triangle
  `{{0.0f, -0.5f, 0.0f}}, {{0.5f, 0.5f, 0.0f}}, {{-0.5f, 0.5f, 0.0f}}`.
- **Hint:** In Vulkan, y points down: (0, -0.5) is the top corner; the order top, bottom-right, bottom-left is
  clockwise on screen.
- **When done:** still teal (nothing uses the data yet). Code has `struct Vertex`, `glm::vec3 pos;` and
  `const std::vector<Vertex> vertices` with 3 vertices.

## fixed-functions
- **Task:** Describe the fixed-function stages in `createGraphicsPipeline()`: vertex input (the `Vertex`
  descriptions), input assembly (triangle list), viewport state (1 viewport, 1 scissor – both dynamic), rasterizer
  (fill, line width 1, `cullMode = VK_CULL_MODE_BACK_BIT`, `frontFace = VK_FRONT_FACE_CLOCKWISE`), multisampling
  (1 sample), colour blending (off, write RGBA), dynamic state (viewport and scissor); then create an empty
  pipeline layout (`pipelineLayout` member) and destroy it in `cleanup()`.
- **Hint:** Viewport and scissor are dynamic, so they are set while recording, not here.
- **When done:** still teal. Code has `vkCreatePipelineLayout` and `vkDestroyPipelineLayout`,
  `rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;`, `rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;`.

## pipeline
- **Task:** Create the graphics pipeline: fill a `VkGraphicsPipelineCreateInfo` (2 stages, all the states, the
  layout, the render pass, subpass 0), call `vkCreateGraphicsPipelines` into the `graphicsPipeline` member, destroy
  it in `cleanup()` before the layout.
- **Hint:** The shader modules can be destroyed right after the pipeline is created.
- **When done:** still teal (nothing is drawn yet), no validation message. Code has `vkCreateGraphicsPipelines`
  and `vkDestroyPipeline(device, graphicsPipeline, nullptr);`.

## vertex-buffer
- **Task:** Put the vertices in a vertex buffer: add `vertexBuffer` and `vertexBufferMemory`, write
  `createVertexBuffer()` (`VK_BUFFER_USAGE_VERTEX_BUFFER_BIT`, memory `HOST_VISIBLE | HOST_COHERENT`, bind, map,
  `memcpy`, unmap) and `findMemoryType()`, call `createVertexBuffer()` after `createCommandPool()`, destroy the
  buffer and free its memory in `cleanup()`.
- **Hint:** `vkGetBufferMemoryRequirements` tells which memory types fit; `findMemoryType` picks one that also has
  the properties you need.
- **When done:** still teal. Code has `vkCreateBuffer`, `vkAllocateMemory`, `vkMapMemory`, `memcpy`,
  `vkDestroyBuffer(device, vertexBuffer, nullptr)` and `vkFreeMemory(device, vertexBufferMemory, nullptr)`.

## draw
- **Task:** Draw the triangle in `recordCommandBuffer()`, inside the render pass: `vkCmdBindPipeline`, set the
  viewport (whole swap chain extent, depth 0..1) and the scissor, `vkCmdBindVertexBuffers` with `vertexBuffer`, and
  `vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);`.
- **Hint:** Viewport and scissor must be set every time because they are dynamic state.
- **When done:** an orange triangle RGB (255, 128, 51) on teal: top corner at the top centre (400, 150 in an
  800×600 window), bottom corners at (600, 450) and (200, 450).

## index-buffer
- **Task:** Create an index buffer: add `const std::vector<uint16_t> indices = { 0, 1, 2, 2, 3, 0 };`, the members
  `indexBuffer` and `indexBufferMemory`, and `createIndexBuffer()` (like `createVertexBuffer()` with
  `VK_BUFFER_USAGE_INDEX_BUFFER_BIT`); call it after `createVertexBuffer()` and destroy it in `cleanup()`.
- **Hint:** `sizeof(indices[0]) * indices.size()` bytes.
- **When done:** picture unchanged (still the triangle; the index buffer is not used yet). Code has
  `createIndexBuffer();` and `VK_BUFFER_USAGE_INDEX_BUFFER_BIT`.

## rectangle
- **Task:** Draw a rectangle from 4 vertices and 6 indices: change `vertices` to
  `{{-0.5f, -0.5f, 0.0f}}, {{0.5f, -0.5f, 0.0f}}, {{0.5f, 0.5f, 0.0f}}, {{-0.5f, 0.5f, 0.0f}}`, bind the index
  buffer (`VK_INDEX_TYPE_UINT16`) and replace `vkCmdDraw` with
  `vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);`.
- **Hint:** Both triangles (0, 1, 2) and (2, 3, 0) are clockwise on screen, so culling keeps them. For a wireframe,
  set `rasterizer.polygonMode = VK_POLYGON_MODE_LINE` (needs the `fillModeNonSolid` device feature) – not part of
  the task.
- **When done:** an orange rectangle from (200, 150) to (600, 450) on teal. Code has `vkCmdBindIndexBuffer` and
  `vkCmdDrawIndexed`; `vkCmdDraw` is gone.
