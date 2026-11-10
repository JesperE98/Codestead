# Frustum Culling – tasks (DirectX 12)

learnopengl "Guest Articles / Scene / Frustum Culling": `src/8.guest/2021/1.scene/2.frustum_culling/frustum_culling.cpp`
and `includes/learnopengl/entity.h` (`Plane`, `Frustum`, `BoundingVolume`, `Sphere`, `AABB`, `createFrustumFromCamera`,
`generateSphereBV`, `generateAABB`, `Entity::drawSelfAndChild`), in Direct3D 12 with DirectXMath. Files: as in
`scene-graph` (`main.cpp`, `model_loading.hlsl`, `models/` with the course's planet). **The start is the `scene-graph`
chapter's solution** (with three TODO comments added).

**Screenshot time: 2.0 s** (the root still turns at 20°/s from `scene-graph`'s `animate`: at 2.0 s the grid is turned
by 40°; which planets are culled depends on the time).

**Fixed choices (the same in every API – see the OpenGL tasks.md):**
- Structs and free functions as in `scene-graph`. learnopengl's classes become `struct Plane { XMFLOAT3 normal =
  XMFLOAT3(0.0f, 1.0f, 0.0f); float distance = 0.0f; };` with `Plane makePlane(const XMVECTOR& p1, const XMVECTOR&
  norm)` and `float getSignedDistanceToPlane(const Plane&, const XMVECTOR&)`; `struct Frustum { Plane topFace,
  bottomFace, rightFace, leftFace, farFace, nearFace; };`; `Frustum createFrustumFromCamera(const XMVECTOR& position,
  const XMVECTOR& front, const XMVECTOR& worldUp, float aspect, float fovY, float zNear, float zFar)` – learnopengl's
  maths with the camera globals (right = `XMVector3Normalize(XMVector3Cross(front, worldUp))`, up =
  `XMVector3Normalize(XMVector3Cross(right, front))`; the cross product is the same in a right- and a left-handed
  library: it is the maths, not the convention); `struct Sphere { XMFLOAT3 center; float radius; };` and `struct AABB
  { XMFLOAT3 center; XMFLOAT3 extents; };` with overloads `isOnOrForwardPlane(const Sphere&/const AABB&, const Plane&)`
  and `isOnFrustum(const Sphere&/const AABB&, const Frustum&, const Transform&)`. The bounding volume is a member of
  `Entity` (`Sphere boundingVolume;`, from `aabb` on `AABB boundingVolume;`), set by `addChild` and for the root.
- DirectXMath style: `XMFLOAT3` in the structs, `XMVECTOR` for the maths (`XMVector3Dot` returns the dot product in all
  four components: `XMVectorGetX` takes it out; `XMVector3Length`, `XMVector3Transform(point, matrix)` = the point with
  w = 1 times the matrix; the model matrix's **rows** `modelMatrix.r[0..2]` are glm's columns `modelMatrix[0..2]`).
  The box is found with `XMVectorMin` / `XMVectorMax` starting from `XMVectorReplicate(FLT_MAX)` / `-FLT_MAX` (the
  lowest float – learnopengl's `std::numeric_limits<float>::min()` is the smallest positive float, the correction the
  OpenGL text explains; `<windows.h>` defines `min`/`max` macros, so the Direct3D code avoids `std::min`,
  `std::max` and `numeric_limits<…>::max()` – `fmaxf` / `fabsf` from `<cmath>`, `FLT_MAX` from `<cfloat>`).
- The scene (`grid`): the root planet at the origin and 10 × 10 children at local positions (x · 5 − 22.5, 0,
  z · 5 − 22.5), scale 0.5; the `scene-graph` camera (3, 6, 12), pitch −25.
- Culling (`cull`): `drawSelfAndChild(Entity&, const Frustum&, ID3D12GraphicsCommandList*, unsigned int& display,
  unsigned int& total)` sets the root constants and draws an entity's model only if `isOnFrustum(entity.boundingVolume,
  frustum, entity.transform)`, counts and always visits the children. `PopulateCommandList` builds the frustum, draws,
  and puts the counts into the **window title**: `std::wstring title = L"LearnDirectX - drawn: " +
  std::to_wstring(display) + L" / " + std::to_wstring(total); SetWindowTextW(m_hwnd, title.c_str());`.
- The test frustum (`cull`) has its far plane at 15 while the projection keeps 100; `camera-frustum` sets 100.

**What the camera sees** (the same as OpenGL's, 2.0 s): named points (planet centres) **root** (238,320), **near**
(680,459), **mid** (429,327), **edge16** (596,261), **left** (55,312), **far17** (283,251), **far20** (442,208),
**far42** (396,76), **background** (600,560). The planets' colours come from their texture; test "planet there" as
"not 13,13,13". (The planet centres and the culling counts below were checked by running this project's CPU code –
Transform, Entity, Plane, Frustum, Sphere, AABB, the grid and the frustum – natively with DirectXMath: they are the
OpenGL project's exactly.)

**Start picture** (= `scene-graph`'s solution at 2.0 s): the turned chain; root = 101,138,59; near, mid, edge16, left,
far17, far20, far42 = 13,13,13.

## `grid`
- **Task:** Replace the chain with learnopengl's frustum-culling scene: a 10 × 10 grid of planets, all children of the root, 5 units apart (local positions x · 5 − 22.5 and z · 5 − 22.5), each half the root's size.
- **Hint:** Two nested `for` loops over `x` and `z` in `LoadAssets`; `addChild(m_ourEntity, m_model); lastEntity = &m_ourEntity.children.back();` then `setLocalPosition(lastEntity->transform, XMFLOAT3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));` and `setLocalScale(…, XMFLOAT3(scale, scale, scale))` with `const float scale = 0.5f;`.
- **When done:** `main.cpp`: the two nested loops (`x < 10`, `z < 10`) adding 100 children to `m_ourEntity` with
  `XMFLOAT3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f)` and scale 0.5. 101 planets (202 mesh draws), the grid turned by
  40°: root = 101,138,59, near = 66,122,51, mid = 107,141,60, edge16 = 64,118,66, left = 101,138,59, far17 = 92,135,57,
  far20 = 92,134,57, far42 = 80,129,54, background = 13,13,13.

## `frustum`
- **Task:** Write the `Plane` struct (a unit normal and its distance from the origin) with `makePlane` and `getSignedDistanceToPlane`, the `Frustum` struct (six planes) and `createFrustumFromCamera`, which builds the six planes from the camera's position, front and up vectors, aspect ratio, vertical field of view and near/far distances, with their normals pointing into the frustum.
- **Hint:** `halfVSide = zFar * tanf(fovY * 0.5f)`, `halfHSide = halfVSide * aspect`, `frontMultFar = zFar * front`; near: `makePlane(position + zNear * front, front)`, far: `makePlane(position + frontMultFar, -front)`, right: `makePlane(position, XMVector3Cross(frontMultFar - right * halfHSide, up))`, left: `XMVector3Cross(up, frontMultFar + right * halfHSide)`, top: `XMVector3Cross(right, frontMultFar - up * halfVSide)`, bottom: `XMVector3Cross(frontMultFar + up * halfVSide, right)`. `makePlane`: `XMVector3Normalize(norm)`, `distance = XMVectorGetX(XMVector3Dot(normal, p1))`.
- **When done:** `main.cpp`: `struct Plane`, `Plane makePlane(const XMVECTOR& p1, const XMVECTOR& norm)`, `float
  getSignedDistanceToPlane(const Plane& plane, const XMVECTOR& point)` (dot(normal, point) − distance), `struct
  Frustum` with `topFace`, `bottomFace`, `rightFace`, `leftFace`, `farFace`, `nearFace`, `Frustum
  createFrustumFromCamera(…)` with learnopengl's six planes. Not called yet: **no visible change**.

## `bounding-sphere`
- **Task:** Give every entity a bounding sphere: write the `Sphere` struct, `generateSphereBV` (the box around all of the model's vertices; centre = the box's centre, radius = half its diagonal), `isOnOrForwardPlane` (signed distance > −radius) and `isOnFrustum`, which moves and scales the sphere with the entity's model matrix and tests it against the six planes. Store it in `Entity` (`boundingVolume`) for the root and every child.
- **Hint:** Loop `for (const Mesh& mesh : model.meshes) for (const Vertex& vertex : mesh.vertices)` with `XMVectorMin` / `XMVectorMax` of `XMLoadFloat3(&vertex.position)`. In `isOnFrustum`: the global scale is the length of the model matrix's first three rows (`XMVector3Length(modelMatrix.r[0])` …), the centre `XMVector3Transform(XMLoadFloat3(&sphere.center), modelMatrix)`, the radius `sphere.radius * maxScale` (`fmaxf`). `#include <cfloat>` for `FLT_MAX`.
- **When done:** `main.cpp`: `#include <cfloat>`; `struct Sphere { XMFLOAT3 center; float radius; }`, `Sphere
  generateSphereBV(const Model& model)` (from `XMVectorReplicate(FLT_MAX)` / `XMVectorReplicate(-FLT_MAX)`, `radius =
  XMVectorGetX(XMVector3Length(maxAABB - minAABB)) * 0.5f`), `bool isOnOrForwardPlane(const Sphere&, const Plane&)`,
  `bool isOnFrustum(const Sphere&, const Frustum&, const Transform&)` (all six planes); `Sphere boundingVolume;` in
  `Entity`, `child.boundingVolume = generateSphereBV(model);` in `addChild`, `m_ourEntity.boundingVolume =
  generateSphereBV(m_model);`. Not used yet: **no visible change**.

## `cull`
- **Task:** Cull: build the camera's frustum every frame and let `drawSelfAndChild` draw an entity only when its bounding sphere is in the frustum, counting the drawn and the visited entities; show the counts in the window title. To see the culling at work, build the frustum with its far plane at 15 for now (the projection still reaches 100).
- **Hint:** `const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, static_cast<float>(m_width) / static_cast<float>(m_height), XMConvertToRadians(fov), 0.1f, 15.0f);`, `unsigned int total = 0, display = 0; drawSelfAndChild(m_ourEntity, camFrustum, m_commandList.Get(), display, total);`, then `std::wstring title = L"LearnDirectX - drawn: " + std::to_wstring(display) + L" / " + std::to_wstring(total); SetWindowTextW(m_hwnd, title.c_str());`.
- **When done:** `main.cpp`: `void drawSelfAndChild(Entity& entity, const Frustum& frustum, ID3D12GraphicsCommandList*
  commandList, unsigned int& display, unsigned int& total)` with `if (isOnFrustum(entity.boundingVolume, frustum,
  entity.transform))` around the root constants and the draw, `display++`, `total++`, the children; in
  `PopulateCommandList` `createFrustumFromCamera(…, 0.1f, 15.0f)`, the counters, the draw and `SetWindowTextW`. At 2.0 s
  **8 of 101** entities are drawn (title "LearnDirectX - drawn: 8 / 101", 16 mesh draws): root, near, mid, edge16, left
  keep their colours; **far17 = far20 = far42 = 13,13,13** (the back of the grid is gone).

## `camera-frustum`
- **Task:** Build the culling frustum with the projection's own values – far plane 100 – so that exactly what the camera can see is drawn.
- **Hint:** Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
- **When done:** `main.cpp`: `createFrustumFromCamera(cameraPos, cameraFront, cameraUp, static_cast<float>(m_width) /
  static_cast<float>(m_height), XMConvertToRadians(fov), 0.1f, 100.0f)`. The picture is the `grid` picture again (every
  planet on screen is drawn) but only **37 of 101** entities are drawn at 2.0 s (title "LearnDirectX - drawn: 37 / 101",
  74 mesh draws instead of 202).

## `aabb`
- **Task:** Use learnopengl's tighter bounding volume instead: an axis-aligned box (`AABB`, centre and half sizes) with `generateAABB`, `isOnOrForwardPlane` (the box's projection radius on the plane's normal) and `isOnFrustum` (the world-space box around the turned and scaled box), and store an `AABB` in `Entity`.
- **Hint:** `r = extents.x * fabsf(plane.normal.x) + extents.y * fabsf(plane.normal.y) + extents.z * fabsf(plane.normal.z)`; inside: `-r <= getSignedDistanceToPlane(plane, center)`. In `isOnFrustum`: `right = modelMatrix.r[0] * extents.x`, `up = modelMatrix.r[1] * extents.y`, `forward = -modelMatrix.r[2] * extents.z`, and the new half sizes `newIi`, `newIj`, `newIk` as sums of `fabsf(XMVectorGetX(XMVector3Dot(axis, …)))`.
- **When done:** `main.cpp`: `struct AABB { XMFLOAT3 center; XMFLOAT3 extents; }`, `AABB generateAABB(const Model&
  model)`, `bool isOnOrForwardPlane(const AABB&, const Plane&)`, `bool isOnFrustum(const AABB&, const Frustum&, const
  Transform&)`; `AABB boundingVolume;` in `Entity`, `generateAABB(model)` / `generateAABB(m_model)` instead of
  `generateSphereBV`. **No visible change**; at 2.0 s **38 of 101** are drawn (title "LearnDirectX - drawn: 38 / 101"):
  for this flat ringed planet turned 40° the world-space box around the turned box is a little larger than the sphere,
  so one more planet just outside the view passes. This is the solution.

*Simulator:* it draws nothing for any state of this chapter: it does not follow the scene graph's recursive
`drawSelfAndChild` with `entity.pModel->Draw(commandList)` (see `scene-graph`), and the culling needs `Model::meshes[i].vertices`,
`XMVectorMin/Max/Replicate`, `XMVector3Dot/Length/Transform`, `XMVectorGetX`, `modelMatrix.r[i]`, overloaded free
functions and `SetWindowTextW` with `std::wstring` – see the D3D12 writer's report.
