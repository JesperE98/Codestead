# Mesh (Vulkan) – the vertex of a model, its vertex and index buffers, and an indexed draw (learnopengl "Mesh")

learnopengl's Mesh class (vertices, indices, textures; setupMesh; Draw) maps onto vulkan-tutorial's model-loading
groundwork: a `Vertex` with everything a model's vertex has, the mesh's data in `std::vector<Vertex> vertices` and
`std::vector<uint32_t> indices`, device-local vertex and index buffers filled through staging buffers, and
`vkCmdDrawIndexed` with 32-bit indices. (Vulkan programs keep this in the application class – a separate Mesh class
would hold the same buffers; the textures per material come in the next chapter.)

**Why a test mesh:** Vulkan cannot create a buffer of size 0, and this chapter loads no file yet. So the `mesh-data`
task fills `vertices` / `indices` with a small test mesh, a square (4 vertices, 6 indices), and the last task draws
it. The `model` chapter replaces the square with the vertices and indices of `models/planet.obj`. Every state between
the tasks builds and runs without validation messages; nothing is drawn until `draw`.

**Start** (prepared from the multiple-lights project): the scene of learnopengl's model_loading.cpp – clear colour
`{{0.05f, 0.05f, 0.05f, 1.0f}}`, depth buffer, camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45,
WASD/mouse/scroll as before), one pipeline `modelPipeline` made with the `createPipeline` helper from
`shaders/model_loading.vert.spv` / `.frag.spv` (attribute count 1: the position), `cullMode = VK_CULL_MODE_NONE`
(the model's ring is a single plane), the uniform buffer `{ mat4 view; mat4 proj; }` at **binding 0** (vertex stage)
set in `updateUniformBuffer()`, the model matrix as the push constant `PushConstants { glm::mat4 model; }` set in
`recordCommandBuffer()` (translate (0, 0, 0), rotate 25° about x, scale 0.5 – the brief's matrix), the texture
helpers of the earlier chapters (createTextureImage, createImage, transitionImageLayout, copyBufferToImage) and the
sampler `textureSampler` (created, not used until the next chapter). `Vertex` has only `glm::vec3 pos` (one attribute
description) and TODOs; the members `vertexBuffer`/`vertexBufferMemory`/`indexBuffer`/`indexBufferMemory` are
declared; `createVertexBuffer()` and `createIndexBuffer()` are called in `initVulkan()` but are TODO stubs; TODOs in
`cleanup()`, for `copyBuffer`, and in `recordCommandBuffer()` (bind the buffers; draw). `models/` holds the six model
files (read-only). Shaders: `model_loading.vert` reads `inPosition` only, `model_loading.frag` writes white.

Start picture: only the background, (13, 13, 13) everywhere (no draw call).

Named points of the 800×600 window (lavapipe and the app's simulator agree exactly): **centre** (400, 300),
**top** (400, 200), **left** (300, 330), **top-left** (280, 190), **top-right** (520, 190), **bottom-left**
(295, 395), **bottom-right** (505, 395), **background** (30, 300) and (400, 170). Nothing depends on time.

## vertex
- **Task:** Give `Vertex` everything a model's vertex has: `glm::vec3 pos; glm::vec3 normal; glm::vec2 texCoord;
  uint32_t materialIndex;`, four attribute descriptions (locations 0–3; the material index as `VK_FORMAT_R32_UINT`),
  and pass the attribute count 4 to `createPipeline`. In the vertex shader declare `inNormal` (1), `inTexCoord` (2),
  `in uint inMaterialIndex` (3) and pass the texture coordinates on (`layout(location = 2) out vec2 fragTexCoord`);
  the fragment shader shows them as a colour: `outColor = vec4(fragTexCoord, 0.0, 1.0);`.
- **Hint:** Like the cube's attributes, with `offsetof(Vertex, …)`; an integer attribute has an integer format
  (`R32_UINT`) and the shader type `uint`.
- **When done:** code only (nothing is drawn yet; the picture stays (13, 13, 13)): `Vertex` has the four members,
  `std::array<VkVertexInputAttributeDescription, 4>` with `attributeDescriptions[3].format = VK_FORMAT_R32_UINT` and
  `offsetof(Vertex, materialIndex)`, `createPipeline(…, 4, modelPipeline)`, the shader inputs at locations 1–3.

## vertex-equality
- **Task:** Make vertices comparable and hashable, so a model's repeated vertices can be found later:
  `bool operator==(const Vertex& other) const` comparing all four members, and the specialisation
  `template<> struct hash<Vertex>` in `namespace std` combining `hash<glm::vec3>` / `hash<glm::vec2>` /
  `hash<uint32_t>` of the members (vulkan-tutorial's shifts and xors). glm's hashes need `#define
  GLM_ENABLE_EXPERIMENTAL` before `<glm/glm.hpp>` and `#include <glm/gtx/hash.hpp>`.
- **Hint:** Two equal vertices must give the same hash; an `std::unordered_map<Vertex, uint32_t>` needs both.
- **When done:** code only (picture unchanged): `operator==`, `struct hash<Vertex>`, `GLM_ENABLE_EXPERIMENTAL`,
  `glm/gtx/hash.hpp`.

## mesh-data
- **Task:** Add the mesh's data as members of the class: `std::vector<Vertex> vertices` – for now a test square of
  4 vertices at (±1, ±1, 0), normal (0, 0, 1), texture coordinates (0, 1) bottom left, (1, 1) bottom right, (1, 0)
  top right, (0, 0) top left, material 0 – and `std::vector<uint32_t> indices = { 0, 1, 2, 2, 3, 0 }`.
- **Hint:** Not `const` this time: the next chapter fills these vectors from a file.
- **When done:** code only (picture unchanged): the two member vectors with the test square.

## vertex-buffer
- **Task:** Fill `createVertexBuffer()` like vulkan-tutorial's staging buffer chapter: a host-visible staging buffer
  (`TRANSFER_SRC`), `memcpy` the vertices into it, a `DEVICE_LOCAL` vertex buffer (`TRANSFER_DST | VERTEX_BUFFER`),
  `copyBuffer(stagingBuffer, vertexBuffer, bufferSize)`, then destroy the staging buffer. Write `copyBuffer` (a one-time
  command buffer with `vkCmdCopyBuffer`) and destroy the vertex buffer / free its memory in `cleanup()`.
- **Hint:** `createBuffer` makes both buffers; `beginSingleTimeCommands` / `endSingleTimeCommands` record and submit
  the copy.
- **When done:** code only (picture unchanged): `createBuffer(… VK_BUFFER_USAGE_TRANSFER_SRC_BIT …)`,
  `createBuffer(… VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
  vertexBuffer …)`, `vkCmdCopyBuffer` in `copyBuffer`, `vkDestroyBuffer(device, vertexBuffer, nullptr)` in cleanup.

## index-buffer
- **Task:** The same for the indices in `createIndexBuffer()` (`VK_BUFFER_USAGE_INDEX_BUFFER_BIT`, size
  `sizeof(indices[0]) * indices.size()`), and destroy the index buffer in `cleanup()`.
- **Hint:** Only the data and the usage flag differ from the vertex buffer.
- **When done:** code only (picture unchanged): `VK_BUFFER_USAGE_INDEX_BUFFER_BIT`, `copyBuffer(stagingBuffer,
  indexBuffer, bufferSize)`, `vkDestroyBuffer(device, indexBuffer, nullptr)`.

## draw
- **Task:** In `recordCommandBuffer()` bind the vertex buffer (`vkCmdBindVertexBuffers`) and the index buffer
  (`vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32)`), and after the push constant draw all
  indices: `vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0)`.
- **Hint:** `VK_INDEX_TYPE_UINT32` because `indices` holds `uint32_t` (a model can have more than 65536 vertices).
- **When done:** one indexed draw of 6 indices: the square in texture-coordinate colours, tilted towards the camera
  (wider at the top; y ≈ 182..401, x ≈ 270..529 at the top, 287..512 at the bottom): centre = (128, 128, 0),
  top = (128, 19, 0), left = (20, 164, 0), top-left = (10, 8, 0) (black: u = v = 0), top-right = (246, 8, 0) (red),
  bottom-left = (10, 246, 0) (green), bottom-right = (246, 246, 0) (yellow); background (30, 300) and (400, 170) =
  (13, 13, 13).
