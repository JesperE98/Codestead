# Frustum Culling – tasks (OpenGL)

learnopengl "Guest Articles / Scene / Frustum Culling": `src/8.guest/2021/1.scene/2.frustum_culling/frustum_culling.cpp`
and `includes/learnopengl/entity.h` (`Plane`, `Frustum`, `BoundingVolume`, `Sphere`, `AABB`, `createFrustumFromCamera`,
`generateSphereBV`, `generateAABB`, `Entity::drawSelfAndChild`). Files: as in `scene-graph` (`main.cpp`, `shader_m.h`,
`mesh.h`, `model.h`, `model_loading.vs/.fs`, `models/` with the course's planet). **The start is the `scene-graph`
chapter's solution** (with three TODO comments added).

**Screenshot time: 2.0 s** (the root still turns at 20°/s from `scene-graph`'s `animate`: at 2.0 s the grid is turned
by 40°; which planets are culled depends on the time).

**OpenGL 3.3 core.**

**Fixed choices (the same in every API):**
- Structs and free functions as in `scene-graph` (see its tasks.md): learnopengl's classes become
  `struct Plane { glm::vec3 normal = { 0, 1, 0 }; float distance = 0; };` with `Plane makePlane(const glm::vec3& p1,
  const glm::vec3& norm)` (learnopengl's constructor: `normal = normalize(norm)`, `distance = dot(normal, p1)`) and
  `float getSignedDistanceToPlane(const Plane&, const glm::vec3&)`; `struct Frustum { Plane topFace, bottomFace,
  rightFace, leftFace, farFace, nearFace; };` (six `Plane` members in that order); `Frustum createFrustumFromCamera(const
  glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float
  zFar)` – learnopengl's maths; it takes the camera globals instead of a `Camera` and computes the camera's right =
  `normalize(cross(front, worldUp))` and up = `normalize(cross(right, front))` (learnopengl's `Camera::Right` / `Up`);
  `struct Sphere { glm::vec3 center; float radius; };` and `struct AABB { glm::vec3 center; glm::vec3 extents; };` with
  overloads `isOnOrForwardPlane(const Sphere&/const AABB&, const Plane&)` and `isOnFrustum(const Sphere&/const AABB&,
  const Frustum&, const Transform&)` (learnopengl's virtual `BoundingVolume` methods become overloads; no base class).
  The bounding volume is a member of `Entity` (`Sphere boundingVolume;`, from `aabb` on `AABB boundingVolume;`), set by
  `addChild` and for the root.
- Two small corrections of learnopengl's helpers, said in the text: the box's maximum starts at
  `std::numeric_limits<float>::lowest()` (learnopengl's `min()` is the smallest *positive* float – wrong for a model
  that lies entirely at negative coordinates); the sphere's radius is half the box's diagonal and its world radius is
  `radius * maxScale` (learnopengl stores the whole diagonal and halves it later – the same result).
- The scene (`grid` task, learnopengl's frustum demo: a grid of planets, all children of the root): the root planet at
  the origin (scale 1) and **10 × 10 children** at local positions **(x · 5 − 22.5, 0, z · 5 − 22.5)** for x, z = 0 … 9,
  local scale **0.5** (learnopengl: 20 × 20 at x · 10 − 100, scale 1, camera (0, 10, 0) – the course keeps the
  `scene-graph` camera (3, 6, 12), pitch −25, and fewer planets: the simulator draws on the CPU). The root keeps
  turning (learnopengl's frustum demo stops it), so the culled set changes over time.
- Culling (`cull`): `drawSelfAndChild(Entity&, const Frustum&, Shader&, unsigned int& display, unsigned int& total)`
  draws an entity only if `isOnFrustum(entity.boundingVolume, frustum, entity.transform)`, counts `display` (drawn) and
  `total` (visited) and always visits the children (learnopengl's). The counts go into the **window title**
  (`glfwSetWindowTitle`, `"LearnOpenGL - drawn: 37 / 101"`; learnopengl prints them with `std::cout` every frame).
  Vulkan / D3D12: their window title (`glfwSetWindowTitle` / `SetWindowTextW`).
- The test frustum (`cull`): built with a far plane at **15** while the projection keeps 100, so the culling is visible;
  `camera-frustum` sets it to the projection's values (fov 45°, 800/600, 0.1, 100).

**What the camera sees** (Mesa, 800×600, 2.0 s): after `grid` the root planet (238,320) among the grid's smaller ringed
planets, which recede towards the top of the window (the farthest about y 75). Named points (planet centres): **root**
(238,320), **near** (680,459) (local (2.5, 7.5), 9.7 in front of the camera), **mid** (429,327) (13.1), **edge16**
(596,261) (16.0 – its bounding sphere still reaches inside 15), **left** (55,312) (13.7), **far17** (283,251) (16.6),
**far20** (442,208) (19.5), **far42** (396,76) (42.1, the farthest), **background** (600,560). The planets' colours come
from their texture; test "planet there" as "not 13,13,13".

**Start picture** (= `scene-graph`'s solution at 2.0 s): the turned chain of `scene-graph`; root = 101,138,59; near,
mid, edge16, left, far17, far20, far42 = 13,13,13 (the chain's planets lie elsewhere).

## `grid`
- **Task:** Replace the chain with learnopengl's frustum-culling scene: a 10 × 10 grid of planets, all children of the root, 5 units apart (local positions x · 5 − 22.5 and z · 5 − 22.5), each half the root's size.
- **Hint:** Two nested `for` loops over `x` and `z`; `addChild(ourEntity, ourModel); lastEntity = &ourEntity.children.back();` then `setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));` and `setLocalScale(…, glm::vec3(scale, scale, scale))` with `const float scale = 0.5f;`.
- **When done:** `main.cpp`: the two nested loops (`x < 10`, `z < 10`) adding 100 children to `ourEntity` with
  `glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f)` and scale 0.5. 101 planets (202 model draws), the grid turned
  by 40°: root = 101,138,59, near = 66,122,51, mid = 107,141,60, edge16 = 64,118,66, left = 101,138,59, far17 =
  92,135,57, far20 = 92,134,57, far42 = 80,129,54, background = 13,13,13 (67,815 pixels differ from the clear colour).

## `frustum`
- **Task:** Write the `Plane` struct (a unit normal and its distance from the origin) with `makePlane` and `getSignedDistanceToPlane`, the `Frustum` struct (six planes) and `createFrustumFromCamera`, which builds the six planes from the camera's position, front and up vectors, aspect ratio, vertical field of view and near/far distances, with their normals pointing into the frustum.
- **Hint:** `halfVSide = zFar * tanf(fovY * 0.5f)`, `halfHSide = halfVSide * aspect`, `frontMultFar = zFar * front`; near: `makePlane(position + zNear * front, front)`, far: `makePlane(position + frontMultFar, -front)`, right: `makePlane(position, glm::cross(frontMultFar - right * halfHSide, up))`, left: `glm::cross(up, frontMultFar + right * halfHSide)`, top: `glm::cross(right, frontMultFar - up * halfVSide)`, bottom: `glm::cross(frontMultFar + up * halfVSide, right)`.
- **When done:** `main.cpp`: `struct Plane`, `Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)`, `float
  getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)` (`dot(normal, point) - distance`), `struct
  Frustum` with `topFace`, `bottomFace`, `rightFace`, `leftFace`, `farFace`, `nearFace`, `Frustum
  createFrustumFromCamera(…)` with learnopengl's six planes. Not called yet: **no visible change**.

## `bounding-sphere`
- **Task:** Give every entity a bounding sphere: write the `Sphere` struct, `generateSphereBV` (the box around all of the model's vertices; centre = the box's centre, radius = half its diagonal), `isOnOrForwardPlane` (signed distance > −radius) and `isOnFrustum`, which moves and scales the sphere with the entity's model matrix and tests it against the six planes. Store it in `Entity` (`boundingVolume`) for the root and every child.
- **Hint:** Loop `for (const Mesh& mesh : model.meshes) for (const Vertex& vertex : mesh.vertices)` with `std::min` / `std::max` per axis. In `isOnFrustum`: the global scale is the length of the model matrix's first three columns, the centre `glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f))`, the radius `sphere.radius * maxScale`. `#include <limits>` and `<algorithm>`.
- **When done:** `main.cpp`: `#include <limits>`, `#include <algorithm>`; `struct Sphere { glm::vec3 center; float
  radius; }`, `Sphere generateSphereBV(const Model& model)` (min from `std::numeric_limits<float>::max()`, max from
  `lowest()`, `radius = glm::length(maxAABB - minAABB) * 0.5f`), `bool isOnOrForwardPlane(const Sphere&, const
  Plane&)`, `bool isOnFrustum(const Sphere&, const Frustum&, const Transform&)` (all six planes); `Sphere
  boundingVolume;` in `Entity`, `child.boundingVolume = generateSphereBV(model);` in `addChild`,
  `ourEntity.boundingVolume = generateSphereBV(ourModel);`. Not used yet: **no visible change**.

## `cull`
- **Task:** Cull: build the camera's frustum every frame and let `drawSelfAndChild` draw an entity only when its bounding sphere is in the frustum, counting the drawn and the visited entities; show the counts in the window title. To see the culling at work, build the frustum with its far plane at 15 for now (the projection still reaches 100).
- **Hint:** `const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, (float)SCR_WIDTH / (float)SCR_HEIGHT, glm::radians(fov), 0.1f, 15.0f);`, `unsigned int total = 0, display = 0; drawSelfAndChild(ourEntity, camFrustum, ourShader, display, total);`, then `std::string title = "LearnOpenGL - drawn: " + std::to_string(display) + " / " + std::to_string(total); glfwSetWindowTitle(window, title.c_str());`.
- **When done:** `main.cpp`: `#include <string>`; `void drawSelfAndChild(Entity& entity, const Frustum& frustum, Shader&
  ourShader, unsigned int& display, unsigned int& total)` with `if (isOnFrustum(entity.boundingVolume, frustum,
  entity.transform))` around the draw, `display++`, `total++`, the children; in the loop `createFrustumFromCamera(…,
  0.1f, 15.0f)`, the counters, `drawSelfAndChild(ourEntity, camFrustum, ourShader, display, total)` and
  `glfwSetWindowTitle`. At 2.0 s **8 of 101** entities are drawn (title "LearnOpenGL - drawn: 8 / 101", 16 model
  draws): only the planets whose sphere reaches closer than 15: root, near, mid, edge16, left keep their colours;
  **far17 = far20 = far42 = 13,13,13** (the back of the grid is gone; 45,654 pixels differ from the clear colour).

## `camera-frustum`
- **Task:** Build the culling frustum with the projection's own values – far plane 100 – so that exactly what the camera can see is drawn.
- **Hint:** Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
- **When done:** `main.cpp`: `createFrustumFromCamera(cameraPos, cameraFront, cameraUp, (float)SCR_WIDTH /
  (float)SCR_HEIGHT, glm::radians(fov), 0.1f, 100.0f)`. The picture is the `grid` picture again (identical pixels: every
  planet on screen is drawn) but only **37 of 101** entities are drawn at 2.0 s (title "LearnOpenGL - drawn: 37 / 101",
  74 model draws instead of 202): the planets beside and behind the camera are culled.

## `aabb`
- **Task:** Use learnopengl's tighter bounding volume instead: an axis-aligned box (`AABB`, centre and half sizes) with `generateAABB`, `isOnOrForwardPlane` (the box's projection radius on the plane's normal) and `isOnFrustum` (the world-space box around the turned and scaled box), and store an `AABB` in `Entity`.
- **Hint:** `r = extents.x * std::abs(plane.normal.x) + extents.y * std::abs(plane.normal.y) + extents.z * std::abs(plane.normal.z)`; inside: `-r <= getSignedDistanceToPlane(plane, center)`. In `isOnFrustum`: `right = glm::vec3(modelMatrix[0]) * extents.x`, `up = glm::vec3(modelMatrix[1]) * extents.y`, `forward = -glm::vec3(modelMatrix[2]) * extents.z`, and the new half sizes `newIi`, `newIj`, `newIk` as sums of `std::abs(glm::dot(axis, …))`.
- **When done:** `main.cpp`: `struct AABB { glm::vec3 center; glm::vec3 extents; }`, `AABB generateAABB(const Model&
  model)`, `bool isOnOrForwardPlane(const AABB&, const Plane&)`, `bool isOnFrustum(const AABB&, const Frustum&, const
  Transform&)` (learnopengl's `AABB::isOnFrustum`); `AABB boundingVolume;` in `Entity`, `generateAABB(model)` /
  `generateAABB(ourModel)` instead of `generateSphereBV`. **No visible change** (identical pixels); at 2.0 s **38 of
  101** are drawn (title "LearnOpenGL - drawn: 38 / 101"): for this flat ringed planet turned 40° the world-space box
  around the turned box is a little larger than the sphere, so one more planet just outside the view passes – the
  article's point that a box is not always tighter once it is turned. This is the solution.
