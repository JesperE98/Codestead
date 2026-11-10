# Scene Graph – tasks (OpenGL)

learnopengl "Guest Articles / Scene / Scene Graph": `src/8.guest/2021/1.scene/1.scene_graph/scene_graph.cpp` and
`includes/learnopengl/entity.h` (its `Transform` and `Entity` classes). Files: `main.cpp`, `shader_m.h`, `mesh.h` and
`model.h` (the Model Loading part's, unchanged), `model_loading.vs/.fs` (learnopengl's `1.model_loading` shaders: the
diffuse texture, no lighting) and `models/` (the course's planet: `planet.obj`, `planet.mtl`, `planet_diffuse.png`,
`planet_specular.png`, `rings.png`, `rings_specular.png` – learnopengl uses its own planet model).

**Screenshot time: 2.0 s** (the last task turns the scene with the time; the earlier states are still).

**OpenGL 3.3 core**, like the course's other code.

**Fixed choices (the same in every API):**
- **Plain structs and free functions** instead of learnopengl's classes (the simulator follows those; a real project
  would keep learnopengl's classes):
  - `struct Transform { glm::vec3 pos = { 0, 0, 0 }; glm::vec3 eulerRot = { 0, 0, 0 } /* degrees */; glm::vec3 scale =
    { 1, 1, 1 }; glm::mat4 modelMatrix = glm::mat4(1.0f); bool isDirty = true; };` (`isDirty` from the `dirty-flag`
    task on) with `glm::mat4 getLocalModelMatrix(const Transform&)` (learnopengl's: `rotationMatrix = transformY *
    transformX * transformZ`, `translate(pos) * rotationMatrix * scale(scale)`), `void computeModelMatrix(Transform&,
    const glm::mat4& parentGlobalModelMatrix)` (`modelMatrix = parent * local`), `setLocalPosition / setLocalRotation /
    setLocalScale(Transform&, const glm::vec3&)`.
  - `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr; };` – **the children
    are stored by value in a vector** (learnopengl: `std::list<std::unique_ptr<Entity>>` plus a `parent` pointer).
    Instead of following `parent`, every recursive function gets the parent's model matrix as a parameter (the root
    gets `glm::mat4(1.0f)`): `void addChild(Entity& parent, Model& model)`, `void updateSelfAndChild(Entity&, const
    glm::mat4&)`, `void forceUpdateSelfAndChild(Entity&, const glm::mat4&)` (from `dirty-flag` on), `void
    drawSelfAndChild(Entity&, Shader&)` (sets `model` = `entity.transform.modelMatrix`, `entity.pModel->Draw(shader)`,
    then its children – learnopengl's scene graph demo walks the chain with a `while` loop that skips the last child;
    the course draws the whole tree recursively like learnopengl's `drawSelfAndChild` of the frustum culling demo).
    Vulkan/D3D12: the same structs; `pModel` points to their Model, the draw records one push constant / root constant
    model matrix and the model's draw per entity.
- The scene: the root entity = the planet at the origin (local position (0, 0, 0), scale 1: radius 1, rings to 2);
  **a chain of ten children**, each the child of the one before, each at local position **(3.5, 0, 0)** with local
  scale **0.6** (learnopengl: (10, 0, 0) and 0.75 for its model). World positions along the chain: x = 0, 3.5, 5.6,
  6.86, 7.62, 8.07, … (each planet 0.6 times the size of the one before; the eleventh is tiny).
- Camera: **(3, 6, 12)**, yaw -90, **pitch -25** (`cameraFront = (0, -0.42262, -0.90631)`), fov 45, 800/600, near
  0.1, far 100, no input (learnopengl: (0, 0, 3) for its larger model). Clear (0.05, 0.05, 0.05) = 13,13,13, depth
  test on, no culling.
- Animation (`animate`): the root's local rotation is set each frame to **(0, 20 · time, 0)** degrees (20°/s, learnopengl's
  speed) and the graph is updated **before** drawing. learnopengl adds `20 * deltaTime` to the angle after drawing; the
  course sets the angle from the time so the picture at a given time is always the same (at 2.0 s: 40°).

**What the camera sees** (pixels from the top left of the 800×600 window, Mesa): the root planet with its ring in the
left half, centre (238,320) (sphere about x 180..290, ring about x 125..345, y 270..375). Before `animate` the chain runs
to the right along y = 320: children centres at x = 427, 540, 608, 649, 674 … At 2.0 s after `animate` the chain points
40° into the screen: children centres (385,273), (456,250), (494,238), (515,231), (527,227) …

Named points: **root** (238,320) (the root planet's centre), **ring** (238,372) (the front of its ring), **c1-flat**
(427,320) and **c2-flat** (540,320) (the first two children before `animate`), **c1-turned** (385,273), **c2-turned**
(456,250), **c3-turned** (494,238) (the first three children at 2.0 s after `animate`), **background** (600,500),
**bg2** (700,150). The planet's colours come from its texture (green land, blue oceans, white poles); test "planet
there" as "not the clear colour 13,13,13".

**Start picture:** one planet at the origin (drawn with `model = glm::mat4(1.0f)`): root = 75,126,53, ring = 77,66,51,
everything else 13,13,13 (15,796 pixels differ from the clear colour).

## `transform`
- **Task:** Write the `Transform` struct (local position, Euler rotation in degrees, scale, and the model matrix) with `getLocalModelMatrix` (translation · rotation · scale, the rotation as Y · X · Z), `computeModelMatrix` (parent's model matrix · local matrix) and the three `setLocal…` functions. Draw the planet with the model matrix of a `Transform`.
- **Hint:** `glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f))` for each axis, then `transformY * transformX * transformZ`; `glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale)`. In the loop: `Transform planetTransform; computeModelMatrix(planetTransform, glm::mat4(1.0f)); ourShader.setMat4("model", planetTransform.modelMatrix);`.
- **When done:** `main.cpp`: `struct Transform` with `pos`, `eulerRot`, `scale`, `modelMatrix` (brace defaults
  `{ 0.0f, 0.0f, 0.0f }` / `{ 1.0f, 1.0f, 1.0f }`, `glm::mat4(1.0f)`), `glm::mat4 getLocalModelMatrix(const Transform&
  transform)` (three `glm::rotate`, `transformY * transformX * transformZ`, translate · rotation · scale), `void
  computeModelMatrix(Transform& transform, const glm::mat4& parentGlobalModelMatrix)`, `setLocalPosition`,
  `setLocalRotation`, `setLocalScale`; the draw uses `planetTransform.modelMatrix`. **No visible change** (a default
  transform is the identity): same pixels as the start.

## `entity`
- **Task:** Write the `Entity` struct (a vector of child entities, a `Transform`, a pointer to its `Model`) with `addChild`, a recursive `updateSelfAndChild` (each child's model matrix = its parent's · its local one) and a recursive `drawSelfAndChild`. Build the root planet and a chain of ten children – each the child of the previous one, at local position (3.5, 0, 0) with local scale 0.6 – update the graph once and draw it.
- **Hint:** learnopengl's loop with `Entity* lastEntity = &ourEntity;`: `addChild(*lastEntity, ourModel); lastEntity = &lastEntity->children.back();` then `setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f)); setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));`. After the loop `updateSelfAndChild(ourEntity, glm::mat4(1.0f));`. In the render loop `drawSelfAndChild(ourEntity, ourShader);` instead of the single draw.
- **When done:** `main.cpp`: `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr;
  };`, `void addChild(Entity& parent, Model& model)`, `void updateSelfAndChild(Entity& entity, const glm::mat4&
  parentGlobalModelMatrix)` (computeModelMatrix, then `for (Entity& child : entity.children) updateSelfAndChild(child,
  entity.transform.modelMatrix);`), `void drawSelfAndChild(Entity& entity, Shader& ourShader)`
  (`ourShader.setMat4("model", entity.transform.modelMatrix); entity.pModel->Draw(ourShader);` and the children);
  `Entity ourEntity; ourEntity.pModel = &ourModel;`, `const float scale = 0.6f;`, the `for` loop over 10 children,
  `updateSelfAndChild(ourEntity, glm::mat4(1.0f));` before the render loop; the loop draws with
  `drawSelfAndChild(ourEntity, ourShader);`. 11 planets (22 model draws: 2 meshes each): the **chain of ever smaller
  ringed planets to the right**: root = 75,126,53, ring = 77,66,51 (unchanged), c1-flat = 106,140,60, c2-flat =
  102,139,59 (planets there), c1-turned, c2-turned, c3-turned, background, bg2 = 13,13,13 (24,431 pixels differ from
  the clear colour).

## `dirty-flag`
- **Task:** Add a dirty flag to `Transform`: the `setLocal…` functions set it, `computeModelMatrix` clears it. Split the update: `forceUpdateSelfAndChild` recomputes an entity and everything below it; `updateSelfAndChild` calls it only for a dirty entity and otherwise just looks further down.
- **Hint:** `bool isDirty = true;` in the struct. `updateSelfAndChild`: `if (entity.transform.isDirty) { forceUpdateSelfAndChild(entity, parentGlobalModelMatrix); return; }` then recurse into the children with `entity.transform.modelMatrix`.
- **When done:** `main.cpp`: `bool isDirty = true;` in `Transform`, `transform.isDirty = true;` in the three
  `setLocal…` functions, `transform.isDirty = false;` in `computeModelMatrix`, `void forceUpdateSelfAndChild(Entity&
  entity, const glm::mat4& parentGlobalModelMatrix)` (recursive, always computes), `updateSelfAndChild` with the `if
  (entity.transform.isDirty)` test. **No visible change** (same pixels as after `entity`).

## `animate`
- **Task:** Turn the root about its y axis over time – 20 degrees per second – and update the scene graph every frame before drawing: the whole chain swings round with it.
- **Hint:** At the top of the frame: `setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f)); updateSelfAndChild(ourEntity, glm::mat4(1.0f));` – only the root is dirty, so the update recomputes it and, through it, all its children.
- **When done:** `main.cpp`: `setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));` and
  `updateSelfAndChild(ourEntity, glm::mat4(1.0f));` in the render loop before the drawing. At 2.0 s (40°) the chain
  points back to the right, into the screen; the root planet has turned (its texture shows another side): root =
  101,138,59, ring = 74,63,49, c1-turned = 93,135,57, c2-turned = 94,136,58, c3-turned = 88,132,59 (planets there),
  c1-flat = c2-flat = background = bg2 = 13,13,13 (21,356 pixels differ from the clear colour). The picture depends on
  the time (at 0 s it equals the `entity` picture). This is the solution.
