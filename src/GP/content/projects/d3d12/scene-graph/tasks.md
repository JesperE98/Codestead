# Scene Graph – tasks (DirectX 12)

learnopengl "Guest Articles / Scene / Scene Graph": `src/8.guest/2021/1.scene/1.scene_graph/scene_graph.cpp` and
`includes/learnopengl/entity.h` (its `Transform` and `Entity` classes), on top of the Model Loading part's Direct3D 12
code. Files: `main.cpp` (the `Mesh` and `Model` classes of the `model` chapter, unchanged, then the scene graph and the
`D3D12App` class), `model_loading.hlsl` (the `model` chapter's shaders before its `lighting` task: the diffuse texture,
no lighting) and `models/` (the course's planet: `planet.obj`, `planet.mtl`, `planet_diffuse.png`,
`planet_specular.png`, `rings.png`, `rings_specular.png`).

**Screenshot time: 2.0 s** (the last task turns the scene with the time; the earlier states are still).

**Fixed choices (the same in every API – see the OpenGL tasks.md):**
- **Plain structs and free functions** instead of learnopengl's classes (the simulator follows those; a real project
  would keep learnopengl's classes):
  - `struct Transform { XMFLOAT3 pos = XMFLOAT3(0.0f, 0.0f, 0.0f); XMFLOAT3 eulerRot = …; XMFLOAT3 scale =
    XMFLOAT3(1.0f, 1.0f, 1.0f); XMFLOAT4X4 modelMatrix = (the identity); bool isDirty = true; };` (`isDirty` from the
    `dirty-flag` task on). DirectXMath's storage types (`XMFLOAT3`, `XMFLOAT4X4`) in the struct, `XMMATRIX` for the
    maths. `XMMATRIX getLocalModelMatrix(const Transform&)`: learnopengl's rotation `transformY * transformX *
    transformZ` and `translate * rotation * scale` – with DirectXMath's row vectors the same matrices in the opposite
    order: `transformZ * transformX * transformY` and `XMMatrixScaling(…) * rotationMatrix * XMMatrixTranslation(…)`
    (`XMMatrixRotationX/Y/Z` turn the same way as `glm::rotate` about the axes). `void computeModelMatrix(Transform&,
    const XMMATRIX& parentGlobalModelMatrix)`: `local * parent` (learnopengl's `parent * local`), stored with
    `XMStoreFloat4x4`. `setLocalPosition / setLocalRotation / setLocalScale(Transform&, const XMFLOAT3&)`.
  - `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr; };` – the children by
    value in a vector, the parent's model matrix passed as a parameter (the root gets `XMMatrixIdentity()`):
    `addChild(Entity& parent, Model& model)`, `updateSelfAndChild(Entity&, const XMMATRIX&)`,
    `forceUpdateSelfAndChild(Entity&, const XMMATRIX&)` (from `dirty-flag` on), `drawSelfAndChild(Entity&,
    ID3D12GraphicsCommandList*)`: the entity's model matrix (transposed for HLSL) as the root constants
    (`struct ModelConstants { XMFLOAT4X4 model; }` – moved out of the `D3D12App` class so the free function can use it,
    root parameter 0), then `entity.pModel->Draw(commandList)` (each mesh binds its textures and draws itself), then the
    children, recursively.
  - The scene graph's root is a member of the application: `Entity m_ourEntity;` (learnopengl's `ourEntity`), built in
    `LoadAssets` right after `m_model.Load(...)`.
- The scene: the root = the planet at the origin (scale 1: radius 1, rings to 2); a chain of ten children, each the
  child of the one before, at local position (3.5, 0, 0) with local scale 0.6.
- Camera (globals): `cameraPos = (3, 6, 12)`, `cameraFront = (0, -0.42262, -0.90631)` (yaw -90, pitch -25), fov 45,
  800/600, 0.1, 100 (`XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`, view and projection in the constant buffer as in
  the `model` chapter). Clear (0.05, 0.05, 0.05) = 13,13,13, depth test on, no culling.
- Animation (`animate`, in `OnUpdate`): the root's local rotation is set every frame to (0, 20 · time, 0) degrees, time
  from `std::chrono` since the first frame (`static auto startTime`), and the graph is updated before the frame is
  drawn (at 2.0 s: 40°).

**What the camera sees** (the same as OpenGL's; pixels from the top left of the 800×600 window): the root planet with its
ring in the left half, centre (238,320). Before `animate` the chain runs to the right along y = 320: children centres
x = 427, 540, 608, 649, 674 … At 2.0 s after `animate` the chain points 40° into the screen: children centres (385,273),
(456,250), (494,238), (515,231), (527,227) …

Named points: **root** (238,320), **ring** (238,372), **c1-flat** (427,320), **c2-flat** (540,320), **c1-turned**
(385,273), **c2-turned** (456,250), **c3-turned** (494,238), **background** (600,500), **bg2** (700,150). Test "planet
there" as "not the clear colour 13,13,13".

**Start picture:** one planet at the origin (drawn with `XMMatrixIdentity()` as the model matrix): root = 75,126,53,
ring = 77,66,51 (the simulator: 55,47,37 – it gives the OpenGL project the same value), everything else 13,13,13.

## `transform`
- **Task:** Write the `Transform` struct (local position, Euler rotation in degrees, scale, and the model matrix) with `getLocalModelMatrix` (scale · rotation · translation in DirectXMath's order, the rotation as Z · X · Y), `computeModelMatrix` (local matrix · parent's model matrix) and the three `setLocal…` functions. Draw the planet with the model matrix of a `Transform`.
- **Hint:** `XMMatrixRotationX(XMConvertToRadians(transform.eulerRot.x))` for each axis, then `transformZ * transformX * transformY` (learnopengl's Y · X · Z for column vectors). In `PopulateCommandList`: `Transform planetTransform; computeModelMatrix(planetTransform, XMMatrixIdentity());` and `XMMatrixTranspose(XMLoadFloat4x4(&planetTransform.modelMatrix))` into the root constants.
- **When done:** `main.cpp`: `struct Transform` with `pos`, `eulerRot`, `scale` (`XMFLOAT3`), `modelMatrix`
  (`XMFLOAT4X4`, the identity), `XMMATRIX getLocalModelMatrix(const Transform& transform)` (three `XMMatrixRotation…`,
  `transformZ * transformX * transformY`, `XMMatrixScaling(…) * rotationMatrix * XMMatrixTranslation(…)`), `void
  computeModelMatrix(Transform& transform, const XMMATRIX& parentGlobalModelMatrix)` (`XMStoreFloat4x4(&transform.modelMatrix,
  getLocalModelMatrix(transform) * parentGlobalModelMatrix)`), `setLocalPosition`, `setLocalRotation`, `setLocalScale`;
  the draw uses `planetTransform.modelMatrix`. **No visible change** (a default transform is the identity).

## `entity`
- **Task:** Write the `Entity` struct (a vector of child entities, a `Transform`, a pointer to its `Model`) with `addChild`, a recursive `updateSelfAndChild` and a recursive `drawSelfAndChild` (root constants, then the model, then the children). Build the root planet (`m_ourEntity`) and a chain of ten children – each the child of the previous one, at local position (3.5, 0, 0) with local scale 0.6 – in `LoadAssets`, update the graph once and draw it in `PopulateCommandList`.
- **Hint:** learnopengl's loop with `Entity* lastEntity = &m_ourEntity;`: `addChild(*lastEntity, m_model); lastEntity = &lastEntity->children.back();` then `setLocalPosition(lastEntity->transform, XMFLOAT3(3.5f, 0.0f, 0.0f)); setLocalScale(lastEntity->transform, XMFLOAT3(scale, scale, scale));`. After the loop `updateSelfAndChild(m_ourEntity, XMMatrixIdentity());`. In `PopulateCommandList` `drawSelfAndChild(m_ourEntity, m_commandList.Get());` instead of the single draw. The member `Entity m_ourEntity;` goes next to `m_model`.
- **When done:** `main.cpp`: `struct Entity { std::vector<Entity> children; Transform transform; Model* pModel = nullptr;
  };`, `void addChild(Entity& parent, Model& model)`, `void updateSelfAndChild(Entity& entity, const XMMATRIX&
  parentGlobalModelMatrix)` (computeModelMatrix, then `for (Entity& child : entity.children)
  updateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));`), `void drawSelfAndChild(Entity& entity,
  ID3D12GraphicsCommandList* commandList)` (`SetGraphicsRoot32BitConstants(0, …)` with the transposed model matrix,
  `entity.pModel->Draw(commandList)`, the children); `Entity m_ourEntity;`; in `LoadAssets` `m_ourEntity.pModel =
  &m_model;`, `const float scale = 0.6f;`, the `for` loop over 10 children, `updateSelfAndChild(m_ourEntity,
  XMMatrixIdentity());`; `PopulateCommandList` draws with `drawSelfAndChild(m_ourEntity, m_commandList.Get());`.
  11 planets (22 mesh draws): the chain of ever smaller ringed planets to the right: root = 75,126,53, ring = 77,66,51,
  c1-flat = 106,140,60, c2-flat = 102,139,59 (planets there), c1-turned, c2-turned, c3-turned, background, bg2 =
  13,13,13.

## `dirty-flag`
- **Task:** Add a dirty flag to `Transform`: the `setLocal…` functions set it, `computeModelMatrix` clears it. Split the update: `forceUpdateSelfAndChild` recomputes an entity and everything below it; `updateSelfAndChild` calls it only for a dirty entity and otherwise just looks further down.
- **Hint:** `bool isDirty = true;` in the struct. `updateSelfAndChild`: `if (entity.transform.isDirty) { forceUpdateSelfAndChild(entity, parentGlobalModelMatrix); return; }` then recurse into the children with `XMLoadFloat4x4(&entity.transform.modelMatrix)`.
- **When done:** `main.cpp`: `bool isDirty = true;` in `Transform`, `transform.isDirty = true;` in the three
  `setLocal…` functions, `transform.isDirty = false;` in `computeModelMatrix`, `void forceUpdateSelfAndChild(Entity&
  entity, const XMMATRIX& parentGlobalModelMatrix)` (recursive, always computes), `updateSelfAndChild` with the `if
  (entity.transform.isDirty)` test. **No visible change** (same pixels as after `entity`).

## `animate`
- **Task:** Turn the root about its y axis over time – 20 degrees per second – and update the scene graph every frame in `OnUpdate`, before the frame is drawn: the whole chain swings round with it.
- **Hint:** `static auto startTime = std::chrono::high_resolution_clock::now(); float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();` then `setLocalRotation(m_ourEntity.transform, XMFLOAT3(0.0f, 20.0f * time, 0.0f)); updateSelfAndChild(m_ourEntity, XMMatrixIdentity());` – only the root is dirty, so the update recomputes it and, through it, all its children.
- **When done:** `main.cpp` (`OnUpdate`): `static auto startTime`, `float time = …(currentFrame - startTime).count()`,
  `setLocalRotation(m_ourEntity.transform, XMFLOAT3(0.0f, 20.0f * time, 0.0f));`, `updateSelfAndChild(m_ourEntity,
  XMMatrixIdentity());`. At 2.0 s (40°) the chain points back to the right, into the screen: root = 101,138,59, ring =
  74,63,49, c1-turned = 93,135,57, c2-turned = 94,136,58, c3-turned = 88,132,59 (planets there), c1-flat = c2-flat =
  background = bg2 = 13,13,13. The picture depends on the time (at 0 s it equals the `entity` picture). This is the
  solution.

*Simulator:* the start and `transform` states match (root 75,126,53). From `entity` on it draws nothing: it does not
follow the recursive free function `drawSelfAndChild` with `entity.pModel->Draw(commandList)` (nor the scene graph's
`std::vector<Entity>` built in `LoadAssets`) – see the D3D12 writer's report.
