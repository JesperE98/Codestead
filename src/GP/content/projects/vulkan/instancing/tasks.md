# Instancing (Vulkan) – many copies of a mesh with one draw call (learnopengl "Instancing")

learnopengl `10.1.instancing_quads`, `10.2.asteroids`, `10.3.asteroids_instanced`. Files: `main.cpp`, the shaders
(GLSL 450, built to `shaders/<name>.vert.spv` / `.frag.spv`): `instancing.vert/.frag` (the quads), `planet.vert/.frag`
and `asteroids.vert/.frag` (10.3), and the read-only models in `models/`: `planet.obj`, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png` (Model chapter) and the course's rock
`rock.obj`, `rock.mtl`, `rock.png`.

**Start:** learnopengl 10.1 before instancing – no camera, no matrices: clear (0.1, 0.1, 0.1), one small quad
(`struct QuadVertex { glm::vec2 pos; glm::vec3 color; }`, learnopengl's `quadVertices` ±0.05, in its own vertex buffer
`quadVertexBuffer`) drawn once by `graphicsPipeline` with `vkCmdDraw(commandBuffer, 6, 1, 0, 0)`. The positions are in
Vulkan's normalized device coordinates, where **y points down**: learnopengl's y values are negated, so the picture
is the same (red corner top-left).

The start already contains the **Model chapter's code for the two models** of the asteroid scene, created in
`initVulkan()` but not used until the `planet` task (like the OpenGL start includes `model.h`):
`loadModel(path, vertices, indices)` (tinyobjloader) called for `PLANET_MODEL_PATH` and `ROCK_MODEL_PATH`,
`planetVertices/planetIndices` and `rockVertices/rockIndices` with their vertex and index buffers
(`createVertexBuffer(data, size, buffer, memory)`, `createIndexBuffer(indices, buffer, memory)`), three textures
(`planetDiffuseMap`, `ringsDiffuseMap`, `rockDiffuseMap`, loaded in this order), the uniform buffer (`view`, `proj`) and
two descriptor sets with `createDescriptorSet(firstTextureView, secondTextureView, set)`: `planetDescriptorSet` (UBO,
planet, rings at bindings 0, 1, 2) and `rockDescriptorSet` (UBO, the rock's texture at bindings 1 and 2 – it has one
material). `createPipeline(vertFile, fragFile, bindingDescriptions, attributeDescriptions, pipeline)` takes the vertex
input as parameters (a `std::vector` of bindings: instancing adds a second one); `QuadVertex` and `Vertex` have
`getBindingDescriptions()` / `getAttributeDescriptions()` returning vectors. `updateUniformBuffer()` writes an empty
`UniformBufferObject` (TODO for the `planet` task). TODOs: `asteroids.vert` (the instance matrix); `planet.*` and
`asteroids.frag` are complete and unused until their task. Every state compiles and runs with zero validation messages.

Pixels measured on lavapipe (800×600, from the top left). Nothing depends on time. Background = 26,26,26. Every
picture equals the OpenGL chapter's (lavapipe vs Mesa GL: < 0.1 % of the pixels differ; texture filtering gives
small colour differences on the planet and the rocks).

**Start picture:** one 40×30 px quad in the centre (x 380..419, y 285..314), coloured from its corners: near top-left
(382,287) = 234,16,5 (red), bottom-left (382,313) = 13,16,226 (blue), top-right (418,287) = 10,245,224 (cyan),
bottom-right (418,313) = 10,245,3 (green); centre (400,300) = 123,131,1. Every other pixel background, e.g. (40,30),
(760,570), (200,150).

The quads' grid (after `offsets`): quad centres at x = 40, 120, 200, …, 760 and y = 30, 90, 150, …, 570, each 40×30
px; instance 0 is bottom-left, instance 9 bottom-right, instance 90 top-left, instance 99 top-right – as learnopengl:
its loop runs y from −10 (bottom) up; Vulkan's y points down, so the code negates the translation's y
(`translation.y = -((float)y / 10.0f + offset)`).

## `offsets`
- **Task:** Draw 100 quads with one draw call: compute learnopengl's 100 translations (a 10×10 grid, `offset = 0.1f`) in `updateUniformBuffer()`, put them in the uniform buffer as an array `offsets[100]`, pick the instance's offset in the vertex shader with `gl_InstanceIndex`, bind the descriptor set and draw with `vkCmdDraw(commandBuffer, 6, 100, 0, 0)`.
- **Hint:** In a uniform block (std140) every array element takes 16 bytes, so a `vec2` array would be padded anyway: use `glm::vec4 offsets[100];` in `UniformBufferObject` (after `proj`) and `vec4 offsets[100];` in the shader's block, and read `.xy`. The nested loops `for (int y = -10; y < 10; y += 2)` / `for (int x = -10; x < 10; x += 2)` set `ubo.offsets[index++] = glm::vec4(translation, 0.0f, 0.0f);`. Vulkan's `gl_InstanceIndex` is OpenGL's `gl_InstanceID` (plus the first instance, 0 here). Both descriptor sets hold the uniform buffer; bind `planetDescriptorSet` (the quads read nothing else).
- **When done:** `main.cpp`: `glm::vec4 offsets[100];` in `UniformBufferObject`; in `updateUniformBuffer()` the loop
  (`int index = 0; float offset = 0.1f;` … `translation.x = (float)x / 10.0f + offset;`
  `translation.y = -((float)y / 10.0f + offset);` `ubo.offsets[index++] = glm::vec4(translation, 0.0f, 0.0f);`);
  in `recordCommandBuffer()` `vkCmdBindDescriptorSets(…, &planetDescriptorSet, …)` and
  `vkCmdDraw(commandBuffer, 6, 100, 0, 0);`. `instancing.vert`: the `UniformBufferObject` block with `vec4 offsets[100]`,
  `vec2 offset = ubo.offsets[gl_InstanceIndex].xy;`, `gl_Position = vec4(inPosition + offset, 0.0, 1.0);`.
  **A 10×10 grid of the quad** (x 20..779, y 15..584): every grid point (40,30), (760,30), (40,570), (760,570),
  (120,90), (200,150), (440,330) = 123,131,1 (each quad's centre); the window centre (400,300) and (400,330) are
  between quads = 26,26,26.

## `instanced-array`
- **Task:** Replace the uniform array with an instanced array: put the 100 translations in a vertex buffer of their own (`instanceBuffer`, filled once by a new `createInstanceBuffer()`), described as vertex binding 1 with `VK_VERTEX_INPUT_RATE_INSTANCE` and read as attribute location 2 (`inOffset`); bind both vertex buffers when drawing. The offsets leave the uniform buffer.
- **Hint:** `QuadVertex::getBindingDescriptions()` gets a second element: `binding = 1`, `stride = sizeof(glm::vec2)`, `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE` (Vulkan's `glVertexAttribDivisor(2, 1)`); `getAttributeDescriptions()` a third: `binding = 1`, `location = 2`, `VK_FORMAT_R32G32_SFLOAT`, `offset = 0`. `createInstanceBuffer()`: `glm::vec2 translations[100];`, the same loop, then `createVertexBuffer(&translations[0], sizeof(glm::vec2) * 100, instanceBuffer, instanceBufferMemory);`. Drawing: `VkBuffer vertexBuffers[] = {quadVertexBuffer, instanceBuffer}; VkDeviceSize offsets[] = {0, 0}; vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets);`.
- **When done:** `main.cpp`: two binding descriptions (binding 1 `VK_VERTEX_INPUT_RATE_INSTANCE`, stride
  `sizeof(glm::vec2)`), `attributeDescriptions(3)` with `[2]` binding 1 / location 2 / `VK_FORMAT_R32G32_SFLOAT`;
  members `VkBuffer instanceBuffer; VkDeviceMemory instanceBufferMemory;` (destroyed in `cleanup()`);
  `createInstanceBuffer()` called after the quad's vertex buffer; `offsets[100]` and the loop removed from the uniform
  buffer; the descriptor set bind removed from the quads' draw; `vkCmdBindVertexBuffers(commandBuffer, 0, 2, …)` with
  `{quadVertexBuffer, instanceBuffer}`. `instancing.vert`: `layout(location = 2) in vec2 inOffset;` (no uniform block),
  `gl_Position = vec4(inPosition + inOffset, 0.0, 1.0);`. **No visible change** (the same grid, pixel for pixel).

## `scale-quads`
- **Task:** learnopengl's variation: scale each quad by its instance number, `inPosition * (gl_InstanceIndex / 100.0)`, so the quads grow from the first instance (bottom-left, invisible) to the last (top-right, full size).
- **Hint:** `vec2 pos = inPosition * (gl_InstanceIndex / 100.0);` then `gl_Position = vec4(pos + inOffset, 0.0, 1.0);`. Write `100.0`, not `100`: an int division would give 0 for every instance.
- **When done:** `instancing.vert`: `vec2 pos = inPosition * (gl_InstanceIndex / 100.0);`,
  `gl_Position = vec4(pos + inOffset, 0.0, 1.0);`. The quads shrink from top to bottom (and a little from right to
  left): top-right quad (760,30) full size = 123,131,1; top-left (40,30) 36 px wide = 123,131,1; bottom-right (760,570)
  4 px wide = 80,163,12; bottom-left (40,570) has size 0 = 26,26,26 (instance 0); (200,150) = 122,132,1, (440,330) =
  118,135,2; bounding box x 22..779, y 15..570.

## `planet`
- **Task:** Switch to learnopengl's asteroid scene: camera globals at (0, 0, 55) looking down -z, the view and projection (far plane 1000: the scene is large) in `updateUniformBuffer()`, the pipeline with `planet.vert/.frag` and the `Vertex` input, and the planet drawn at (0, -3, 0), scaled 4, instead of the quads. Remove the quads (`QuadVertex`, `quadVertices`, `quadVertexBuffer`, `instanceBuffer`, `createInstanceBuffer()`).
- **Hint:** `createPipeline("shaders/planet.vert.spv", "shaders/planet.frag.spv", Vertex::getBindingDescriptions(), Vertex::getAttributeDescriptions(), graphicsPipeline);` `ubo.proj = glm::perspective(glm::radians(45.0f), …, 0.1f, 1000.0f); ubo.proj[1][1] *= -1;`. Draw: bind `planetVertexBuffer`, `planetIndexBuffer` (`VK_INDEX_TYPE_UINT32`) and `planetDescriptorSet`, push `model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f)); model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));`, `vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(planetIndices.size()), 1, 0, 0, 0)`.
- **When done:** `main.cpp`: globals `cameraPos (0, 0, 55)`, `cameraFront (0, 0, -1)`, `cameraUp (0, 1, 0)`; the quad
  code removed (struct, data, buffers, `createInstanceBuffer()`, cleanup); the pipeline call above;
  `updateUniformBuffer()` with `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`, the projection (far 1000)
  and `ubo.proj[1][1] *= -1`; `recordCommandBuffer()` draws the planet with the push constant model matrix.
  **A small textured planet** below the window centre (no lighting; disc of radius ≈ 53 px around (400,340),
  bounding box x ≈ 294..505, y ≈ 287..391) with its ring seen almost edge-on: a thin beige ellipse through the planet's
  middle, x ≈ 294..505, y ≈ 336..343. (400,320) = 100,138,59 (land), (380,360) = 72,125,52, (355,340) = 28,70,150
  (ocean), (400,380) = 39,88,115 (OpenGL 44,94,101: a coast, filtering differs); ring (300,340) = 136,116,90,
  (500,340) = 165,141,110 (1–2 px thin: allow ±1 px); background (400,200), (100,100), (400,500), (200,300), (600,300)
  = 26,26,26.

## `asteroids`
- **Task:** learnopengl 10.3: 500 rocks (`const uint32_t amount = 500;`) in a ring around the planet (radius 15, offset 2.5), their model matrices computed once on the CPU (learnopengl's loop with `srand(42)` and `rand()`) in a new `createInstanceBuffer()` and stored in an instance buffer; a second pipeline `asteroidPipeline` reads the matrix as a per-instance `mat4` attribute (binding 1, locations 4–7); all rocks are drawn with **one** `vkCmdDrawIndexed(…, rockIndices.size(), amount, 0, 0, 0)`.
- **Hint:** `Vertex::getInstancedBindingDescriptions()` = `getBindingDescriptions()` plus binding 1 (`stride = sizeof(glm::mat4)`, `VK_VERTEX_INPUT_RATE_INSTANCE`); `Vertex::getInstancedAttributeDescriptions()` = the four `Vertex` attributes plus `[4]`..`[7]`: binding 1, locations 4..7, `VK_FORMAT_R32G32B32A32_SFLOAT`, offsets `0`, `sizeof(glm::vec4)`, `2 * …`, `3 * …` (a mat4 attribute takes four locations, one column each – the `Vertex` already uses 0–3, so the matrix starts at 4, not at learnopengl's 3). `createInstanceBuffer()`: `std::vector<glm::mat4> modelMatrices(amount);`, learnopengl's loop, `createVertexBuffer(modelMatrices.data(), sizeof(glm::mat4) * amount, instanceBuffer, instanceBufferMemory);`. In `asteroids.vert`: `layout(location = 4) in mat4 inInstanceMatrix;` and `gl_Position = ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0);`. Draw after the planet: bind `asteroidPipeline`, `{rockVertexBuffer, instanceBuffer}` at bindings 0 and 1, `rockIndexBuffer`, `rockDescriptorSet`.
- **When done:** `asteroids.vert`: `layout(location = 4) in mat4 inInstanceMatrix;` and
  `gl_Position = ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0);`. `main.cpp`:
  `const uint32_t amount = 500;`; `Vertex::getInstancedBindingDescriptions()` / `getInstancedAttributeDescriptions()`;
  members `VkPipeline asteroidPipeline;`, `VkBuffer instanceBuffer; VkDeviceMemory instanceBufferMemory;` (destroyed in
  `cleanup()`); `createPipeline("shaders/asteroids.vert.spv", "shaders/asteroids.frag.spv",
  Vertex::getInstancedBindingDescriptions(), Vertex::getInstancedAttributeDescriptions(), asteroidPipeline);`;
  `createInstanceBuffer()` (after the rock's buffers) with `srand(42);`, `float radius = 15.0f; float offset = 2.5f;`
  and learnopengl's loop (`angle`, three `displacement`s, `glm::translate`, `scale = (rand() % 20) / 100.0 + 0.05`,
  `rotAngle = rand() % 360`, `glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f))`, `modelMatrices[i] = model;`);
  in `recordCommandBuffer()` after the planet: `vkCmdBindPipeline(…, asteroidPipeline)`,
  `vkCmdBindVertexBuffers(commandBuffer, 0, 2, rockVertexBuffers, rockOffsets)` with `{rockVertexBuffer, instanceBuffer}`,
  `vkCmdBindIndexBuffer(…, rockIndexBuffer, 0, VK_INDEX_TYPE_UINT32)`, `vkCmdBindDescriptorSets(…, &rockDescriptorSet, …)`,
  `vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(rockIndices.size()), amount, 0, 0, 0);`.
  **A flat band of grey rocks** across the planet's upper half (the ring of radius 15 seen from 3 units above its
  plane): rock pixels only in x 151..645, y 279..321 (4,955 rock pixels outside the planet – exactly as many as
  OpenGL: the same `rand()` numbers, so the same field); (200,300) = 128,124,120, (600,300) = 143,139,135,
  (400,300) = 130,126,122 (a rock in front of the planet's top) – these depend on glibc's `rand()` with seed 42
  (another C library's `rand()` gives another field – check areas and counts, not single pixels). The planet below
  the band is unchanged: (400,320) = 100,138,59, (355,340) = 28,70,150, (400,380) = 39,88,115; background (400,200),
  (100,100), (400,500) = 26,26,26; nothing outside y 270..400. Static. Final state.

  Why `srand(42)`: learnopengl seeds with `srand(static_cast<unsigned int>(glfwGetTime()))` – a different field each
  run. A fixed seed gives the same field every run, so the picture can be compared. learnopengl's 10.2 (one draw per
  rock, 500 draw calls) is described in the text only; learnopengl's 100,000 rocks / radius 150 are reduced to
  500 / radius 15. The model matrices are learnopengl's exactly (`sin(angle)` with the angle in degrees, as
  learnopengl): the same rocks as in the OpenGL chapter.
