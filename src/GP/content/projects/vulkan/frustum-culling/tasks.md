# Frustum Culling (Vulkan) – tasks

learnopengl "Guest Articles / Scene / Frustum Culling": `src/8.guest/2021/1.scene/2.frustum_culling/frustum_culling.cpp`
and `includes/learnopengl/entity.h` (`Plane`, `Frustum`, `BoundingVolume`, `Sphere`, `AABB`, `createFrustumFromCamera`,
`generateSphereBV`, `generateAABB`, `Entity::drawSelfAndChild`). Files: as in `scene-graph` (`main.cpp`,
`shaders/model_loading.vert/.frag`, `models/` with the course's planet). **The start is the `scene-graph` chapter's
solution** (with three TODO comments added).

**Screenshot time: 2.0 s** (the root still turns at 20°/s from `scene-graph`'s `animate`: at 2.0 s the grid is turned
by 40°; which planets are culled depends on the time).

**Fixed choices (the same in every API, see `../../opengl/frustum-culling/tasks.md`):**
- Structs and free functions as in `scene-graph` (see its tasks.md): `struct Plane { glm::vec3 normal = { 0, 1, 0 };
  float distance = 0; };` with `Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)` (learnopengl's constructor)
  and `float getSignedDistanceToPlane(const Plane&, const glm::vec3&)`; `struct Frustum { Plane topFace, bottomFace,
  rightFace, leftFace, farFace, nearFace; };`; `Frustum createFrustumFromCamera(const glm::vec3& position, const
  glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar)` – learnopengl's maths
  with the camera globals instead of a `Camera` (right = `normalize(cross(front, worldUp))`, up = `normalize(cross(right,
  front))`); `struct Sphere { glm::vec3 center; float radius; };` and `struct AABB { glm::vec3 center; glm::vec3 extents;
  };` with overloads `isOnOrForwardPlane(const Sphere&/const AABB&, const Plane&)` and `isOnFrustum(const Sphere&/const
  AABB&, const Frustum&, const Transform&)`. The bounding volume is a member of `Entity` (`Sphere boundingVolume;`,
  from `aabb` on `AABB boundingVolume;`), set by `addChild` and for the root.
- The frustum is built in world space from the camera's position and directions, so Vulkan's y flip in the projection
  (`proj[1][1] *= -1`) and its 0..1 depth range do not change it: the planes, the culled set and the counts are
  OpenGL's.
- **Vulkan's model on the CPU:** learnopengl's `generateSphereBV(const Model&)` loops over `model.meshes` and their
  `vertices`; Vulkan's `Model` (see `scene-graph`) only holds GPU buffers, so the `bounding-sphere` task gives it a copy
  of the vertices: `std::vector<Vertex> vertices;` in `struct Model`, `ourModel.vertices = vertices;` in
  `loadEntities()`, and the loop `for (const Vertex& vertex : model.vertices)` reads `vertex.pos`.
- Two small corrections of learnopengl's helpers (as OpenGL): the box's maximum starts at
  `std::numeric_limits<float>::lowest()`; the sphere's radius is half the box's diagonal, its world radius `radius *
  maxScale`.
- The scene (`grid`): the root planet at the origin (scale 1) and **10 × 10 children** at local positions **(x · 5 −
  22.5, 0, z · 5 − 22.5)** for x, z = 0 … 9, local scale **0.5**; the `scene-graph` camera (3, 6, 12), pitch −25; the
  root keeps turning (20°/s).
- Culling (`cull`): `drawSelfAndChild(Entity&, const Frustum&, VkCommandBuffer, VkPipelineLayout, unsigned int&
  display, unsigned int& total)` records an entity's push constant and draw only if `isOnFrustum(entity.boundingVolume,
  frustum, entity.transform)`, counts `display` (drawn) and `total` (visited) and always visits the children. The frustum
  and the counters live in `recordCommandBuffer()` (every frame); the counts go into the **window title**:
  `glfwSetWindowTitle(window, title.c_str())` with `"Vulkan - drawn: 37 / 101"` (learnopengl prints them with
  `std::cout`). Culled entities are simply not recorded: fewer `vkCmdPushConstants` / `vkCmdDrawIndexed` calls in the
  command buffer.
- The test frustum (`cull`): built with a far plane at **15** while the projection keeps 100; `camera-frustum` sets it
  to the projection's values (fov 45°, 800/600, 0.1, 100).

**What the camera sees** (lavapipe, 800×600, 2.0 s): after `grid` the root planet (238,320) among the grid's smaller
ringed planets, which recede towards the top of the window. Named points (planet centres): **root** (238,320), **near**
(680,459), **mid** (429,327), **edge16** (596,261), **left** (55,312), **far17** (283,251), **far20** (442,208),
**far42** (396,76), **background** (600,560). Test "planet there" as "not 13,13,13". Every state equals OpenGL's
picture except along the rings' fine bands (Vulkan's anisotropic sampler, as in `scene-graph`): planets' points differ
by at most 3 except edge16 (67,123,51 here, 64,118,66 in OpenGL – the point lies on a ring).

**Start picture** (= `scene-graph`'s solution at 2.0 s): the turned chain; root = 100,138,59; near, mid, edge16, left,
far17, far20, far42 = 13,13,13.

## `grid`
- **Task:** Replace the chain with learnopengl's frustum-culling scene: a 10 × 10 grid of planets, all children of the root, 5 units apart (local positions x · 5 − 22.5 and z · 5 − 22.5), each half the root's size.
- **Hint:** In `loadEntities()`: two nested `for` loops over `x` and `z`; `addChild(ourEntity, ourModel); lastEntity = &ourEntity.children.back();` then `setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));` and `setLocalScale(…, glm::vec3(scale, scale, scale))` with `const float scale = 0.5f;`.
- **When done:** `main.cpp`: the two nested loops (`x < 10`, `z < 10`) adding 100 children to `ourEntity` with
  `glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f)` and scale 0.5. 101 planets (101 `vkCmdDrawIndexed`), the grid
  turned by 40°: root = 100,138,59, near = 65,122,51, mid = 107,141,60, edge16 = 67,123,51, left = 100,137,58, far17 =
  91,134,57, far20 = 91,133,56, far42 = 78,128,54, background = 13,13,13.

## `frustum`
- **Task:** Write the `Plane` struct (a unit normal and its distance from the origin) with `makePlane` and `getSignedDistanceToPlane`, the `Frustum` struct (six planes) and `createFrustumFromCamera`, which builds the six planes from the camera's position, front and up vectors, aspect ratio, vertical field of view and near/far distances, with their normals pointing into the frustum.
- **Hint:** `halfVSide = zFar * tanf(fovY * 0.5f)`, `halfHSide = halfVSide * aspect`, `frontMultFar = zFar * front`; near: `makePlane(position + zNear * front, front)`, far: `makePlane(position + frontMultFar, -front)`, right: `makePlane(position, glm::cross(frontMultFar - right * halfHSide, up))`, left: `glm::cross(up, frontMultFar + right * halfHSide)`, top: `glm::cross(right, frontMultFar - up * halfVSide)`, bottom: `glm::cross(frontMultFar + up * halfVSide, right)`.
- **When done:** `main.cpp`: `struct Plane`, `Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)`, `float
  getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)`, `struct Frustum` with `topFace`, `bottomFace`,
  `rightFace`, `leftFace`, `farFace`, `nearFace`, `Frustum createFrustumFromCamera(…)` with learnopengl's six planes.
  Not called yet: **no visible change**.

## `bounding-sphere`
- **Task:** Give every entity a bounding sphere: keep a copy of the model's vertices in `Model`, write the `Sphere` struct, `generateSphereBV` (the box around all of the model's vertices; centre = the box's centre, radius = half its diagonal), `isOnOrForwardPlane` (signed distance > −radius) and `isOnFrustum`, which moves and scales the sphere with the entity's model matrix and tests it against the six planes. Store it in `Entity` (`boundingVolume`) for the root and every child.
- **Hint:** `std::vector<Vertex> vertices;` in `struct Model` and `ourModel.vertices = vertices;` in `loadEntities()`. Loop `for (const Vertex& vertex : model.vertices)` with `std::min` / `std::max` per axis of `vertex.pos`. In `isOnFrustum`: the global scale is the length of the model matrix's first three columns, the centre `glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f))`, the radius `sphere.radius * maxScale`.
- **When done:** `main.cpp`: `std::vector<Vertex> vertices;` in `Model`, `ourModel.vertices = vertices;`; `struct Sphere
  { glm::vec3 center; float radius; }`, `Sphere generateSphereBV(const Model& model)` (min from
  `std::numeric_limits<float>::max()`, max from `lowest()`, `radius = glm::length(maxAABB - minAABB) * 0.5f`), `bool
  isOnOrForwardPlane(const Sphere&, const Plane&)`, `bool isOnFrustum(const Sphere&, const Frustum&, const Transform&)`
  (all six planes); `Sphere boundingVolume;` in `Entity`, `child.boundingVolume = generateSphereBV(model);` in
  `addChild`, `ourEntity.boundingVolume = generateSphereBV(ourModel);`. Not used yet: **no visible change**.

## `cull`
- **Task:** Cull: build the camera's frustum every frame and let `drawSelfAndChild` record an entity only when its bounding sphere is in the frustum, counting the drawn and the visited entities; show the counts in the window title. To see the culling at work, build the frustum with its far plane at 15 for now (the projection still reaches 100).
- **Hint:** In `recordCommandBuffer()`: `const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, swapChainExtent.width / (float) swapChainExtent.height, glm::radians(fov), 0.1f, 15.0f);`, `unsigned int total = 0, display = 0; drawSelfAndChild(ourEntity, camFrustum, commandBuffer, pipelineLayout, display, total);`, then `std::string title = "Vulkan - drawn: " + std::to_string(display) + " / " + std::to_string(total); glfwSetWindowTitle(window, title.c_str());`.
- **When done:** `main.cpp`: `void drawSelfAndChild(Entity& entity, const Frustum& frustum, VkCommandBuffer
  commandBuffer, VkPipelineLayout pipelineLayout, unsigned int& display, unsigned int& total)` with `if
  (isOnFrustum(entity.boundingVolume, frustum, entity.transform))` around the push constant and the draw, `display++`,
  `total++`, the children; in `recordCommandBuffer()` `createFrustumFromCamera(…, 0.1f, 15.0f)`, the counters,
  `drawSelfAndChild(ourEntity, camFrustum, commandBuffer, pipelineLayout, display, total)` and `glfwSetWindowTitle`. At
  2.0 s **8 of 101** entities are drawn (title "Vulkan - drawn: 8 / 101", 8 `vkCmdDrawIndexed`): root, near, mid,
  edge16, left keep their colours; **far17 = far20 = far42 = 13,13,13** (the back of the grid is gone).

## `camera-frustum`
- **Task:** Build the culling frustum with the projection's own values – far plane 100 – so that exactly what the camera can see is drawn.
- **Hint:** Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
- **When done:** `main.cpp`: `createFrustumFromCamera(cameraPos, cameraFront, cameraUp, swapChainExtent.width / (float)
  swapChainExtent.height, glm::radians(fov), 0.1f, 100.0f)`. The picture is the `grid` picture again (identical pixels)
  but only **37 of 101** entities are drawn at 2.0 s (title "Vulkan - drawn: 37 / 101", 37 draws instead of 101): the
  planets beside and behind the camera are culled.

## `aabb`
- **Task:** Use learnopengl's tighter bounding volume instead: an axis-aligned box (`AABB`, centre and half sizes) with `generateAABB`, `isOnOrForwardPlane` (the box's projection radius on the plane's normal) and `isOnFrustum` (the world-space box around the turned and scaled box), and store an `AABB` in `Entity`.
- **Hint:** `r = extents.x * std::abs(plane.normal.x) + extents.y * std::abs(plane.normal.y) + extents.z * std::abs(plane.normal.z)`; inside: `-r <= getSignedDistanceToPlane(plane, center)`. In `isOnFrustum`: `right = glm::vec3(modelMatrix[0]) * extents.x`, `up = glm::vec3(modelMatrix[1]) * extents.y`, `forward = -glm::vec3(modelMatrix[2]) * extents.z`, and the new half sizes `newIi`, `newIj`, `newIk` as sums of `std::abs(glm::dot(axis, …))`.
- **When done:** `main.cpp`: `struct AABB { glm::vec3 center; glm::vec3 extents; }`, `AABB generateAABB(const Model&
  model)`, `bool isOnOrForwardPlane(const AABB&, const Plane&)`, `bool isOnFrustum(const AABB&, const Frustum&, const
  Transform&)`; `AABB boundingVolume;` in `Entity`, `generateAABB(model)` / `generateAABB(ourModel)` instead of
  `generateSphereBV`. **No visible change** (identical pixels); at 2.0 s **38 of 101** are drawn (title "Vulkan - drawn:
  38 / 101"): for this flat ringed planet turned 40° the world-space box around the turned box is a little larger than
  the sphere, so one more planet just outside the view passes. This is the solution.
