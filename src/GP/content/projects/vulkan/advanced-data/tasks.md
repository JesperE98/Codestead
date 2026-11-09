# Advanced Data (Vulkan) – filling and copying buffers in other ways (learnopengl "Advanced Data")

learnopengl's chapter has no demo program; here are its ideas in Vulkan terms. Files: `main.cpp`,
`shaders/advanced_data.vert` / `.frag`, `textures/marble.png`, `textures/metal.png`.

Start: the depth-testing scene (two marble cubes, the metal floor, camera (0, 0, 3), clear colour 0.1) in the program of
the earlier chapters: one vertex buffer `vertices` (cube 0..35, floor 36..41) created in `createVertexBuffer()` in
host-visible memory and filled with one `vkMapMemory` / `memcpy` / `vkUnmapMemory`; the uniform buffer persistently mapped
and written by `updateUniformBuffer()` every frame. TODO lines mark where each task changes the code.

**Every task leaves the picture exactly as it is** – the checks look at the code. Pixels on lavapipe (800×600, from the top
left), the same at the start and after every task: **background** (400,100) = 26,26,26, **cube0-centre** (193,300) =
141,140,138, **cube1** (760,250) = 163,161,156, **floor-near** (100,500) = 137,141,147, **floor-far** (600,370) = 130,134,140.

| OpenGL (learnopengl) | Vulkan here |
| --- | --- |
| `glBufferSubData`, `glMapBuffer` | `vkMapMemory` of a range (offset, size) + `memcpy` + `vkUnmapMemory` |
| `glBufferSubData` of a uniform buffer every frame | `vkCmdUpdateBuffer` recorded in the command buffer |
| batched attributes, `glVertexAttribPointer(…, (void*)sizeof(positions))` | two vertex input bindings, `vkCmdBindVertexBuffers` with two offsets |
| `glCopyBufferSubData` | `vkCmdCopyBuffer` (staging buffer → device-local buffer) |

## map-memory
- **Task:** In `createVertexBuffer()` copy the vertices part by part: map only the cube's range
  (`vkMapMemory(device, vertexBufferMemory, 0, cubeSize, 0, &data)`, `cubeSize = sizeof(Vertex) * 36`), copy the 36
  vertices, unmap; then map the floor's range (offset `cubeSize`, size `sizeof(Vertex) * 6`), copy `vertices.data() + 36`,
  unmap.
- **Hint:** `vkMapMemory` maps the bytes from offset to offset + size and returns a pointer to the first of them – like
  `glMapBufferRange`, or `glBufferSubData` when you copy right away. A memory object may be mapped only once at a time, so
  unmap before mapping the next range.
- **When done:** no visible change. Code: two `vkMapMemory` calls on `vertexBufferMemory`, the second with offset
  `cubeSize` (= `sizeof(Vertex) * 36`), each followed by `memcpy` and `vkUnmapMemory`.

## update-buffer
- **Task:** Let the GPU write the uniform buffer: `createUniformBuffers()` creates it with
  `VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT` in `VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT` memory,
  not mapped (remove `uniformBufferMapped`); `updateUniformBuffer(VkCommandBuffer commandBuffer)` records
  `vkCmdUpdateBuffer(commandBuffer, uniformBuffer, 0, sizeof(ubo), &ubo)` and a buffer memory barrier
  (`VK_ACCESS_TRANSFER_WRITE_BIT` → `VK_ACCESS_UNIFORM_READ_BIT`, `VK_PIPELINE_STAGE_TRANSFER_BIT` →
  `VK_PIPELINE_STAGE_VERTEX_SHADER_BIT`); `recordCommandBuffer()` calls it right after `vkBeginCommandBuffer`, before the
  render pass; `drawFrame()` no longer calls it.
- **Hint:** `vkCmdUpdateBuffer` copies the data into the command buffer when it is recorded; the GPU writes it into the
  buffer when it runs the commands. It is meant for small data (at most 65536 bytes, a multiple of 4: here 128) and is not
  allowed inside a render pass. The barrier makes the vertex shaders wait for the write.
- **When done:** no visible change. Code: `vkCmdUpdateBuffer` on `uniformBuffer` and `vkCmdPipelineBarrier` with a
  `VkBufferMemoryBarrier`, both before `vkCmdBeginRenderPass`; no `vkMapMemory` of `uniformBufferMemory`.

## batched-attributes
- **Task:** Store the vertices batched – all positions, then all texture coordinates (111222 instead of 123123): in
  `createVertexBuffer()` split `vertices` into `std::vector<glm::vec3> positions` and `std::vector<glm::vec2> texCoords`,
  make the buffer `positionsSize + texCoordsSize` bytes and copy the two blocks (the two mapped ranges of the previous task
  now hold the positions block at 0 and the texture coordinates block at `positionsSize`). Describe two bindings:
  `getBindingDescriptions()` returns binding 0 (stride `sizeof(glm::vec3)`) and binding 1 (stride `sizeof(glm::vec2)`);
  attribute 0 reads binding 0, attribute 1 binding 1, both at offset 0; `createPipeline()` passes both bindings. In
  `recordCommandBuffer()` bind the same buffer twice:
  `offsets[] = {0, sizeof(glm::vec3) * vertices.size()}`, `vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets)`.
- **Hint:** A binding steps through its data with its stride, so each block needs its own binding; the offsets passed to
  `vkCmdBindVertexBuffers` tell each binding where its block starts – OpenGL's `(void*)(sizeof(positions))` in
  `glVertexAttribPointer`.
- **When done:** no visible change. Code: two `VkVertexInputBindingDescription`s (strides 12 and 8), attribute 1 with
  `binding = 1`, `vertexBindingDescriptionCount = 2`, `vkCmdBindVertexBuffers(…, 0, 2, …)` with the second offset
  `sizeof(glm::vec3) * vertices.size()` (= 504 bytes).

## copy-buffer
- **Task:** Put the vertex buffer in device-local memory and fill it by a copy: write the two blocks into a staging buffer
  (`createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, HOST_VISIBLE | HOST_COHERENT, …)`), create `vertexBuffer`
  with `createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT,
  VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, …)`, add vulkan-tutorial's `copyBuffer(srcBuffer, dstBuffer, size)`
  (`vkCmdCopyBuffer` in a one-time command buffer), call it, then destroy the staging buffer.
- **Hint:** vulkan-tutorial's "Staging buffer" chapter: device-local memory is the fastest for the GPU to read, but the CPU
  cannot map it, so the data goes through a host-visible buffer – OpenGL's `glCopyBufferSubData` from one buffer to
  another. The texture upload already used the same idea with `vkCmdCopyBufferToImage`.
- **When done (the solution):** no visible change. Code: `vkCmdCopyBuffer` (in `copyBuffer`), the vertex buffer with
  `VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT` and `VK_BUFFER_USAGE_TRANSFER_DST_BIT`, the staging buffer destroyed after the copy.
