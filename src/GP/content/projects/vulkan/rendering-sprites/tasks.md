# Rendering Sprites (Hedgerow) – tasks (Vulkan)

learnopengl "2D Game / Rendering Sprites": `progress/3.game.cpp` and `sprite_renderer.h/.cpp`, `sprite.vs/.frag` of
`0.full_source`. Files: `main.cpp` (= `game-setup`'s solution with TODOs for the sprite renderer), `shaders/sprite.vert`,
`shaders/sprite.frag` (their `main` is a TODO; built to `sprite.vert.spv` / `sprite.frag.spv`), `textures/ball.png`
(the course's ball: 128×128 RGBA, a pale ball on a transparent background). See `../game-setup/tasks.md` for the fixed
choices of the whole game.

**Fixed choices (as the OpenGL chapter):** learnopengl draws `awesomeface.png` at (200, 200), size (300, 400), rotated
45°, colour (0, 1, 0); the course draws **`textures/ball.png`** with exactly those numbers. learnopengl's quad (6
vertices of vec4: xy position 0..1, zw texcoords, (0, 0) = the sprite's top-left), model = translate(position) ·
translate(0.5·size) · rotate(rotate°, z) · translate(-0.5·size) · scale(size), colour = `vec4(spriteColor, 1.0) *
texture(image, TexCoords)`, alpha blending (the ball's transparent corners vanish). A positive angle turns the sprite
**clockwise on screen** (the y-down coordinates mirror the usual counter-clockwise rotation), as in learnopengl's picture.

**Vulkan choices:**
- `struct SpriteRenderer { VkPipeline pipeline; VkPipelineLayout pipelineLayout; VkBuffer quadBuffer; VkDeviceMemory
  quadBufferMemory; VkCommandBuffer commandBuffer; };` and the global `SpriteRenderer Renderer;` (learnopengl: `Shader
  shader; unsigned int quadVAO;` and `SpriteRenderer *Renderer`). `commandBuffer` is the command buffer being recorded:
  `recordCommandBuffer()` sets `Renderer.commandBuffer = commandBuffer;` before `Render(Hedgerow);`, so `DrawSprite`,
  `DrawObject`, `DrawLevel` and `Render` keep learnopengl's (and the OpenGL chapter's) parameters.
- `void DrawSprite(SpriteRenderer& renderer, VkDescriptorSet texture, glm::vec2 position, glm::vec2 size =
  glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))` – a free function; the texture is
  passed as its **descriptor set** (what Vulkan binds for a draw; OpenGL passes the texture ID). It binds the pipeline
  (learnopengl's `shader.Use()`), pushes `model` and `spriteColor` (`struct PushConstants { glm::mat4 model; glm::vec3
  spriteColor; };`, one range for the vertex and fragment stages – learnopengl's two uniforms, which change from sprite
  to sprite), binds the texture's descriptor set and the quad's vertex buffer and draws 6 vertices.
- `void InitRenderData(SpriteRenderer& renderer)` is a member of the application class (it creates a buffer): the quad
  in a host-visible vertex buffer (`Vertex { glm::vec4 vertex; }`, attribute 0 = `VK_FORMAT_R32G32B32A32_SFLOAT`, as
  learnopengl's `glVertexAttribPointer(0, 4, …)`).
- The projection: `ubo.projection = glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f,
  static_cast<float>(Hedgerow.Height), -1.0f, 1.0f);` in `updateUniformBuffer()` (see game-setup: Vulkan's y already
  points down). The sampler `image` is binding 1 of the texture's descriptor set (no texture unit to set).

Named points (from the top-left, 800×600; static picture – the same as OpenGL's): **centre** (350,400) – the sprite's
centre; **top** (350,215) and **bottom** (350,585) – inside the unrotated ball near its top and bottom; **left**
(210,400), **right** (490,400); **upper-right** (470,280) and **lower-left** (230,520) – inside the ball only once it
is rotated; **background** (100,100). The ball is green only: its colours × (0, 1, 0). Every state equals the OpenGL
chapter's pixel for pixel (no pixel differs by more than 1 level).

**Start picture:** black everywhere (0,0,0). No validation message.

## sprite-shader
- **Task:** Write the sprite shaders – the vertex shader passes `vertex.zw` on as `TexCoords` and transforms `vertex.xy` with the projection and the model matrix; the fragment shader multiplies the texture by `spriteColor` – load them in `Init` as `"sprite"`, and set the orthographic projection in `updateUniformBuffer()`.
- **Hint:** The vertex shader reads `ubo.projection` (binding 0) and `pc.model` (push constants); the fragment shader `pc.spriteColor` and the sampler `image` (binding 1). `LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite");`. Projection: `glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f, static_cast<float>(Hedgerow.Height), -1.0f, 1.0f)` – bottom 0 and top = height, because Vulkan's clip space y points down like the game's coordinates.
- **When done:** `sprite.vert`: `TexCoords = vertex.zw; gl_Position = ubo.projection * pc.model * vec4(vertex.xy, 0.0,
  1.0);`; `sprite.frag`: `color = vec4(pc.spriteColor, 1.0) * texture(image, TexCoords);`; in `Init`: `// load shaders`
  `LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite");`; in `updateUniformBuffer()`:
  `ubo.projection = glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f, static_cast<float>(Hedgerow.Height),
  -1.0f, 1.0f);`. No visible change (black): one pipeline exists, nothing is drawn.

## sprite-renderer
- **Task:** Add the `SpriteRenderer` struct (the pipeline, its layout, the quad's vertex buffer and the command buffer being recorded), the member function `InitRenderData`, which creates the quad's vertex buffer (learnopengl's 6 vertices), a global `SpriteRenderer Renderer`; set it up in `Init`, give it the command buffer in `recordCommandBuffer()` and destroy its buffer in `cleanup()`.
- **Hint:** In `Init`: `Renderer.pipeline = GetShader("sprite"); Renderer.pipelineLayout = pipelineLayout; InitRenderData(Renderer);`. `InitRenderData`: `createBuffer(…, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, renderer.quadBuffer, renderer.quadBufferMemory)`, then map, `memcpy` the vertices, unmap. In `recordCommandBuffer()`: `Renderer.commandBuffer = commandBuffer;` before `Render(Hedgerow);`.
- **When done:** `struct SpriteRenderer` with `VkPipeline pipeline`, `VkPipelineLayout pipelineLayout`, `VkBuffer
  quadBuffer`, `VkDeviceMemory quadBufferMemory`, `VkCommandBuffer commandBuffer` (all `VK_NULL_HANDLE`);
  `SpriteRenderer Renderer;` after `Game Hedgerow;`; the member `void InitRenderData(SpriteRenderer& renderer)` with
  learnopengl's `vertices` (`{{0.0f, 1.0f, 0.0f, 1.0f}}, …`) in a `std::vector<Vertex>`, `createBuffer` into
  `renderer.quadBuffer` / `renderer.quadBufferMemory`, `vkMapMemory` + `memcpy` + `vkUnmapMemory`; the three lines in
  `Init` after `LoadShader`; `vkDestroyBuffer(device, Renderer.quadBuffer, nullptr); vkFreeMemory(device,
  Renderer.quadBufferMemory, nullptr);` in `cleanup()` after `ClearResources();`; `Renderer.commandBuffer =
  commandBuffer;` before `Render(Hedgerow);`. No visible change.

## draw-sprite
- **Task:** Write `DrawSprite` – the model matrix (translate to `position`, scale to `size`; the rotation follows in the next task), the model matrix and colour as push constants, the texture's descriptor set, the quad drawn –, load `textures/ball.png` as `"ball"` in `Init` and draw it in `Render` at (200, 200), size (300, 400), 45°, green.
- **Hint:** The order of the transformations is reversed: translate first in code, scale last. Then `vkCmdBindPipeline(renderer.commandBuffer, …, renderer.pipeline)`, `vkCmdPushConstants(renderer.commandBuffer, renderer.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants)`, `vkCmdBindDescriptorSets(…, &texture, …)`, `vkCmdBindVertexBuffers` with `renderer.quadBuffer`, `vkCmdDraw(renderer.commandBuffer, 6, 1, 0, 0)`.
- **When done:** the free function `void DrawSprite(SpriteRenderer& renderer, VkDescriptorSet texture, glm::vec2 position,
  glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))` with
  `vkCmdBindPipeline`, `model = glm::translate(model, glm::vec3(position, 0.0f))`, a TODO for the rotation, `model =
  glm::scale(model, glm::vec3(size, 1.0f))`, `constants.model = model; constants.spriteColor = color;`,
  `vkCmdPushConstants`, `vkCmdBindDescriptorSets`, `vkCmdBindVertexBuffers`, `vkCmdDraw(renderer.commandBuffer, 6, 1, 0,
  0)`; `LoadTexture("textures/ball.png", "ball");` in `Init`; `DrawSprite(Renderer, GetTexture("ball").DescriptorSet,
  glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f, glm::vec3(0.0f, 1.0f, 0.0f));` in `Render`. **The green
  ball appears, stretched to an upright ellipse** (not rotated yet: the angle is not used) filling x 201..498, y
  202..597: centre = 0,230,0, top = 0,223,0, bottom = 0,200,0, left = 0,223,0, right = 0,200,0; upper-right = 0,2,0
  (the ellipse's edge), lower-left = 0,0,0, background 0,0,0. The ball's transparent corners stay black (blending). One
  draw.

## rotate
- **Task:** Rotate the sprite by `rotate` degrees about its centre: move the origin to the quad's centre, rotate about z, move it back – between the translation and the scale.
- **Hint:** `glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f))`, `glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f))`, `glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f))`.
- **When done:** those three lines in `DrawSprite` instead of the TODO. **The ellipse is turned 45° clockwise about
  (350, 400)** – its long axis runs from the lower-left to the upper-right, filling x 172..527, y 222..577: centre =
  0,230,0, upper-right = 0,232,0, lower-left = 0,212,0, left = 0,232,0, right = 0,226,0; top = 0,0,0 and bottom = 0,0,0
  (now outside); background 0,0,0.
