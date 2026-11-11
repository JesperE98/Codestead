# Scene Graph (Vulkan) – tasks

learnopengl "Guest Articles / Scene / Scene Graph": `src/8.guest/2021/1.scene/1.scene_graph/scene_graph.cpp` and
`includes/learnopengl/entity.h` (its `Transform` and `Entity` classes). Files: `main.cpp`, `shaders/model_loading.vert/.frag`
(the Model Loading part's diffuse-only shaders: the planet's two materials picked by the flat `materialIndex`, no
lighting – learnopengl's `1.model_loading` shaders) and `models/` (the course's planet: `planet.obj`, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`). The project is the `model` chapter's
program at its `material-textures` step (tinyobjloader, the staging-buffer vertex/index buffers, one descriptor set with
the uniform buffer and the two diffuse maps, the model matrix as a push constant).

**Screenshot time: 2.0 s** (the last task turns the scene with the time; the earlier states are still).

**Fixed choices (the same in every API, see `../../opengl/scene-graph/tasks.md`):**
- **Plain structs and free functions** instead of learnopengl's classes (a real project would keep learnopengl's
  classes): `struct Transform { glm::vec3 pos = { 0, 0, 0 }; glm::vec3 eulerRot = { 0, 0, 0 } /* degrees */; glm::vec3
  scale = { 1, 1, 1 }; glm::mat4 modelMatrix = glm::mat4(1.0f); bool isDirty = true; };` (`isDirty` from the
  `dirty-flag` task on) with `getLocalModelMatrix(const Transform&)` (`rotationMatrix = transformY * transformX *
  transformZ`, `translate(pos) * rotationMatrix * scale(scale)`), `computeModelMatrix(Transform&, const glm::mat4&
  parentGlobalModelMatrix)`, `setLocalPosition / setLocalRotation / setLocalScale(Transform&, const glm::vec3&)`;
  `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr; };` – the children stored
  by value in a vector (learnopengl: `std::list<std::unique_ptr<Entity>>` plus a `parent` pointer); every recursive
  function gets the parent's model matrix as a parameter (the root gets `glm::mat4(1.0f)`): `addChild(Entity& parent,
  Model& model)`, `updateSelfAndChild(Entity&, const glm::mat4&)`, `forceUpdateSelfAndChild` (from `dirty-flag` on),
  `drawSelfAndChild(…)` (the whole tree, recursively).
- **Vulkan's `Model`** (in the start already): learnopengl's `Model` holds meshes with VAOs and draws them with
  `Model::Draw(shader)`; here `struct Model { VkBuffer vertexBuffer; VkBuffer indexBuffer; uint32_t indexCount; };` is
  filled in `loadEntities()` from the application's `vertexBuffer`, `indexBuffer` and `indices.size()` (the one model
  `loadModel()` read from `models/planet.obj`), and the free function `void Draw(const Model& model, VkCommandBuffer
  commandBuffer)` records `vkCmdBindVertexBuffers`, `vkCmdBindIndexBuffer` (`VK_INDEX_TYPE_UINT32`) and one
  `vkCmdDrawIndexed(…, model.indexCount, 1, 0, 0, 0)`. The descriptor set (uniform buffer + the two diffuse maps) is the
  same for every entity, bound once before the draws. Learnopengl's `ourShader.setMat4("model", …)` before each draw is a
  push constant: `drawSelfAndChild(Entity& entity, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout)`
  records `vkCmdPushConstants` with `entity.transform.modelMatrix` and `Draw(*entity.pModel, commandBuffer)`, then
  its children.
- The application keeps the model and the root as members (`Model ourModel;`, `Entity ourEntity;` – learnopengl's
  locals in `main`); `loadEntities()` (called in `initVulkan()` after `createIndexBuffer()`) builds the graph once.
- The scene: the root entity = the planet at the origin (local position (0, 0, 0), scale 1: radius 1, rings to 2) and
  **a chain of ten children**, each the child of the one before, at local position **(3.5, 0, 0)** with local scale
  **0.6**. World positions along the chain: x = 0, 3.5, 5.6, 6.86, 7.62, 8.07, …
- Camera: **(3, 6, 12)**, yaw -90, **pitch -25** (`cameraFront = (0, -0.42262, -0.90631)`), fov 45, 800/600, near 0.1,
  far 100 (`proj[1][1] *= -1`), no input. Clear (0.05, 0.05, 0.05) = 13,13,13, depth test on, no culling.
- Animation (`animate`): at the top of `recordCommandBuffer()` (the code that runs every frame before the draws) the
  root's local rotation is set to **(0, 20 · time, 0)** degrees with `float currentFrame = static_cast<float>(glfwGetTime());`
  and the graph is updated **before** drawing (at 2.0 s: 40°).

**What the camera sees** (pixels from the top left of the 800×600 window, lavapipe): the root planet with its ring in
the left half, centre (238,320). Before `animate` the chain runs to the right along y = 320: children centres at x =
427, 540, 608, 649, 674 … At 2.0 s after `animate` the chain points 40° into the screen: children centres (385,273),
(456,250), (494,238), (515,231), (527,227) …

Named points: **root** (238,320), **ring** (238,372) (the front of its ring), **c1-flat** (427,320), **c2-flat**
(540,320), **c1-turned** (385,273), **c2-turned** (456,250), **c3-turned** (494,238), **background** (600,500),
**bg2** (700,150). The planet's colours come from its texture; test "planet there" as "not the clear colour 13,13,13".
Every state equals OpenGL's picture except along the rings' fine bands, where Vulkan's sampler filters anisotropically
(`maxAnisotropy`, as in the Model Loading chapters): the ring point reads about 10 darker (e.g. 67,57,44 instead of
77,66,51); the planets' pixels differ by at most 1–3.

**Start picture:** one planet at the origin (drawn with `constants.model = glm::mat4(1.0f)`): root = 75,126,53, ring =
67,57,44, everything else 13,13,13.

## `transform`
- **Task:** Write the `Transform` struct (local position, Euler rotation in degrees, scale, and the model matrix) with `getLocalModelMatrix` (translation · rotation · scale, the rotation as Y · X · Z), `computeModelMatrix` (parent's model matrix · local matrix) and the three `setLocal…` functions. Draw the planet with the model matrix of a `Transform`.
- **Hint:** `glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f))` for each axis, then `transformY * transformX * transformZ`; `glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale)`. In `recordCommandBuffer()`: `Transform planetTransform; computeModelMatrix(planetTransform, glm::mat4(1.0f)); constants.model = planetTransform.modelMatrix;`.
- **When done:** `main.cpp`: `struct Transform` with `pos`, `eulerRot`, `scale`, `modelMatrix` (brace defaults
  `{ 0.0f, 0.0f, 0.0f }` / `{ 1.0f, 1.0f, 1.0f }`, `glm::mat4(1.0f)`), `glm::mat4 getLocalModelMatrix(const Transform&
  transform)`, `void computeModelMatrix(Transform& transform, const glm::mat4& parentGlobalModelMatrix)`,
  `setLocalPosition`, `setLocalRotation`, `setLocalScale`; the push constant is `planetTransform.modelMatrix`. **No
  visible change** (a default transform is the identity): same pixels as the start.

## `entity`
- **Task:** Write the `Entity` struct (a vector of child entities, a `Transform`, a pointer to its `Model`) with `addChild`, a recursive `updateSelfAndChild` (each child's model matrix = its parent's · its local one) and a recursive `drawSelfAndChild` that records each entity's model matrix as a push constant and its model's draw. Build the root planet and a chain of ten children in `loadEntities()` – each the child of the previous one, at local position (3.5, 0, 0) with local scale 0.6 – update the graph once and draw it.
- **Hint:** learnopengl's loop with `Entity* lastEntity = &ourEntity;`: `addChild(*lastEntity, ourModel); lastEntity = &lastEntity->children.back();` then `setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f)); setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));`. After the loop `updateSelfAndChild(ourEntity, glm::mat4(1.0f));`. Add the member `Entity ourEntity;`. In `recordCommandBuffer()` `drawSelfAndChild(ourEntity, commandBuffer, pipelineLayout);` instead of the single draw.
- **When done:** `main.cpp`: `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr;
  };`, `void addChild(Entity& parent, Model& model)`, `void updateSelfAndChild(Entity& entity, const glm::mat4&
  parentGlobalModelMatrix)` (computeModelMatrix, then the children with `entity.transform.modelMatrix`), `void
  drawSelfAndChild(Entity& entity, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout)`
  (`vkCmdPushConstants` with `entity.transform.modelMatrix`, `Draw(*entity.pModel, commandBuffer)`, the children);
  the member `Entity ourEntity;`; in `loadEntities()` `ourEntity.pModel = &ourModel;`, `const float scale = 0.6f;`, the
  `for` loop over 10 children and `updateSelfAndChild(ourEntity, glm::mat4(1.0f));`; `recordCommandBuffer()` draws with
  `drawSelfAndChild(ourEntity, commandBuffer, pipelineLayout);`. 11 planets (11 `vkCmdDrawIndexed`): the **chain of
  ever smaller ringed planets to the right**: root = 75,126,53, ring = 67,57,44 (unchanged), c1-flat = 105,140,60,
  c2-flat = 101,138,59 (planets there), c1-turned, c2-turned, c3-turned, background, bg2 = 13,13,13.

## `dirty-flag`
- **Task:** Add a dirty flag to `Transform`: the `setLocal…` functions set it, `computeModelMatrix` clears it. Split the update: `forceUpdateSelfAndChild` recomputes an entity and everything below it; `updateSelfAndChild` calls it only for a dirty entity and otherwise just looks further down.
- **Hint:** `bool isDirty = true;` in the struct. `updateSelfAndChild`: `if (entity.transform.isDirty) { forceUpdateSelfAndChild(entity, parentGlobalModelMatrix); return; }` then recurse into the children with `entity.transform.modelMatrix`.
- **When done:** `main.cpp`: `bool isDirty = true;` in `Transform`, `transform.isDirty = true;` in the three
  `setLocal…` functions, `transform.isDirty = false;` in `computeModelMatrix`, `void forceUpdateSelfAndChild(Entity&
  entity, const glm::mat4& parentGlobalModelMatrix)` (recursive, always computes), `updateSelfAndChild` with the `if
  (entity.transform.isDirty)` test. **No visible change** (same pixels as after `entity`).

## `animate`
- **Task:** Turn the root about its y axis over time – 20 degrees per second – and update the scene graph every frame before drawing: the whole chain swings round with it.
- **Hint:** At the top of `recordCommandBuffer()`: `float currentFrame = static_cast<float>(glfwGetTime()); setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f)); updateSelfAndChild(ourEntity, glm::mat4(1.0f));` – only the root is dirty, so the update recomputes it and, through it, all its children.
- **When done:** `main.cpp`: `setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));` and
  `updateSelfAndChild(ourEntity, glm::mat4(1.0f));` in `recordCommandBuffer()` before the draws. At 2.0 s (40°) the
  chain points back to the right, into the screen; the root planet has turned (its texture shows another side): root =
  100,138,59, ring = 65,56,43, c1-turned = 92,134,57, c2-turned = 94,135,57, c3-turned = 89,133,56 (planets there),
  c1-flat = c2-flat = background = bg2 = 13,13,13. The picture depends on the time (at 0 s it equals the `entity`
  picture). This is the solution.
