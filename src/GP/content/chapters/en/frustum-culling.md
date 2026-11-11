# Frustum Culling

The last chapter built a scene graph and drew every entity in it. The GPU doesn't mind drawing things that end up off
screen – it transforms their vertices, clips the triangles against the view volume and throws them away – but that work
is not free. Every vertex of every object is still run through the vertex shader, and every draw call still costs CPU
time to record and submit. In a large scene most objects are usually *not* in view: behind the camera, beside it,
beyond the far plane. *Frustum culling* finds them on the CPU, before any draw is issued, and skips them.

The idea is simple: describe the volume the camera can see – the *view frustum* – with six planes, wrap every object in
a simple *bounding volume* that is cheap to test, and only draw an object whose bounding volume is at least partly
inside all six planes. This chapter follows learnopengl's guest article *Frustum Culling*, the second of its two scene
articles; it builds on the scene graph of the last chapter. Like the scene graph it is CPU code: the API only sees fewer
draw calls. The maths is the same for {{api}} as for every other API, and the chapter shows why.

## The scene

learnopengl's frustum demo replaces the chain of planets with a grid: many planets, all children of the root. The
course's grid has 10 × 10 children, 5 units apart, at local positions (x · 5 − 22.5, 0, z · 5 − 22.5) for x and z from 0
to 9, each half the root's size – 101 planets in all. learnopengl's demo has 20 × 20 planets 10 units apart, seen from
(0, 10, 0); the course keeps the last chapter's camera at (3, 6, 12), looking down 25°, and fewer planets, because the
course draws its checks and expected results on the CPU. The root keeps turning at 20° per second, as at the end of the
last chapter, so the whole grid turns about the origin, and which planets are in view changes over time. The expected
results show the grid at 2.0 s, with the grid turned by 40°.

The project is the last chapter's solution with three new `// TODO:` comments. Build and run it in your IDE: you see the
turning chain of planets.

:::opengl
The grid is built with two nested loops, where the chain was built before:

```cpp
    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int x = 0; x < 10; ++x)
        {
            for (unsigned int z = 0; z < 10; ++z)
            {
                addChild(ourEntity, ourModel);
                lastEntity = &ourEntity.children.back();

                // set transform values: 5 units apart, half the root's size
                setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
            }
        }
    }
```

with `const float scale = 0.5f;`.
:::
:::vulkan
The grid is built in `loadEntities()` with two nested loops, where the chain was built before:

```cpp
        {
            Entity* lastEntity = &ourEntity;

            for (unsigned int x = 0; x < 10; ++x) {
                for (unsigned int z = 0; z < 10; ++z) {
                    addChild(ourEntity, ourModel);
                    lastEntity = &ourEntity.children.back();

                    // set transform values: 5 units apart, half the root's size
                    setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                    setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
                }
            }
        }
```

with `const float scale = 0.5f;`.
:::
:::d3d12
The grid is built in `LoadAssets` with two nested loops, where the chain was built before:

```cpp
        for (unsigned int x = 0; x < 10; ++x)
        {
            for (unsigned int z = 0; z < 10; ++z)
            {
                addChild(m_ourEntity, m_model);
                lastEntity = &m_ourEntity.children.back();

                // set transform values: 5 units apart, half the root's size
                setLocalPosition(lastEntity->transform, XMFLOAT3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                setLocalScale(lastEntity->transform, XMFLOAT3(scale, scale, scale));
            }
        }
```

with `Entity* lastEntity = &m_ourEntity;` before the loops and `const float scale = 0.5f;`.
:::

All hundred children are added to the *same* vector, the root's, so it grows and reallocates many times – remember the
last chapter's warning about pointers into vectors. The loop is still safe, because it takes `lastEntity` afresh after
every `addChild` and uses it only before the next one.

Now do the first task, **grid**. Build and run: 101 ringed planets fill the window, the near ones large at the bottom,
the far ones small towards the top, the grid turned by 40°. Each of them is drawn, whether it is on screen or not –
including the planets beside and behind the camera.

## The frustum

The view frustum of a perspective camera is a pyramid with its top cut off: the near plane, the far plane, and four
side planes through the camera's position and the edges of the picture. A point is visible (before the depth test)
exactly when it is on the inner side of all six planes.

A plane can be described by a unit *normal* **n** and a *distance* d from the origin: it is the set of points **p** with
`dot(n, p) = d`. For any point, `dot(n, p) − d` is its *signed distance* to the plane: positive on the side the normal
points to, negative on the other, zero on the plane. If the six normals all point *into* the frustum, a point is inside
when its signed distance to every plane is positive.

:::opengl
learnopengl's `Plane` and its two helpers, as a struct and free functions:

```cpp
struct Plane
{
    glm::vec3 normal = { 0.0f, 1.0f, 0.0f }; // unit vector
    float distance = 0.0f;                    // distance with origin
};

// the plane through the point p1 with the normal norm
Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)
{
    Plane plane;
    plane.normal = glm::normalize(norm);
    plane.distance = glm::dot(plane.normal, p1);
    return plane;
}

// > 0: the point is on the side the normal points to, < 0: behind the plane
float getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)
{
    return glm::dot(plane.normal, point) - plane.distance;
}
```
:::
:::vulkan
learnopengl's `Plane` and its two helpers, as a struct and free functions – GLM, as in learnopengl:

```cpp
struct Plane {
    glm::vec3 normal = { 0.0f, 1.0f, 0.0f }; // unit vector
    float distance = 0.0f;                    // distance with origin
};
```

`makePlane(const glm::vec3& p1, const glm::vec3& norm)` normalises the normal and sets `distance = glm::dot(normal,
p1)`: the plane through the point `p1`. `getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)` returns
`glm::dot(plane.normal, point) - plane.distance`.
:::
:::d3d12
learnopengl's `Plane` and its two helpers with DirectXMath – `XMFLOAT3` in the struct, `XMVECTOR` for the maths.
`XMVector3Dot` returns the dot product replicated into all four components of a vector; `XMVectorGetX` takes it out:

```cpp
Plane makePlane(const XMVECTOR& p1, const XMVECTOR& norm)
{
    Plane plane;
    const XMVECTOR normal = XMVector3Normalize(norm);
    XMStoreFloat3(&plane.normal, normal);
    plane.distance = XMVectorGetX(XMVector3Dot(normal, p1));    // XMVector3Dot puts the dot product in every component
    return plane;
}
```

```cpp
float getSignedDistanceToPlane(const Plane& plane, const XMVECTOR& point)
{
    return XMVectorGetX(XMVector3Dot(XMLoadFloat3(&plane.normal), point)) - plane.distance;
}
```
:::

The frustum is six such planes: `struct Frustum { Plane topFace; Plane bottomFace; Plane rightFace; Plane leftFace;
Plane farFace; Plane nearFace; };`.

### Building the frustum from the camera

learnopengl builds the six planes from the camera's own parameters – the same ones the projection matrix is made from.
Think of the camera's position, its *front*, *right* and *up* vectors, and the far plane at distance `zFar` along the
front vector. With a vertical field of view `fovY`, the far plane's rectangle is `2 · halfVSide` high and `2 ·
halfHSide` wide:

```text
halfVSide = zFar · tan(fovY / 2)
halfHSide = halfVSide · aspect
```

- The **near** plane goes through `position + zNear · front` with the normal `front`; the **far** plane through
  `position + zFar · front` with the normal `−front`. Both normals point inwards.
- The four **side** planes all go through the camera's position. Each contains one edge of the frustum: the vector from
  the camera to the middle of the far rectangle's left edge, for instance, is `zFar · front − right · halfHSide`. A
  side plane contains that edge vector and the camera's up (or right) vector, so its normal is the cross product of the
  two – in the order that makes it point into the frustum.

learnopengl's function takes a `Camera`; the course's takes the camera's values directly and computes right and up as
learnopengl's `Camera` class does:

:::opengl
```cpp
Frustum createFrustumFromCamera(const glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar)
{
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const glm::vec3 right = glm::normalize(glm::cross(front, worldUp));
    const glm::vec3 up = glm::normalize(glm::cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const glm::vec3 frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, glm::cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, glm::cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, glm::cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, glm::cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```
:::
:::vulkan
```cpp
Frustum createFrustumFromCamera(const glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar) {
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const glm::vec3 right = glm::normalize(glm::cross(front, worldUp));
    const glm::vec3 up = glm::normalize(glm::cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const glm::vec3 frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, glm::cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, glm::cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, glm::cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, glm::cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```
:::
:::d3d12
```cpp
Frustum createFrustumFromCamera(const XMVECTOR& position, const XMVECTOR& front, const XMVECTOR& worldUp, float aspect, float fovY, float zNear, float zFar)
{
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const XMVECTOR right = XMVector3Normalize(XMVector3Cross(front, worldUp));
    const XMVECTOR up = XMVector3Normalize(XMVector3Cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const XMVECTOR frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, XMVector3Cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, XMVector3Cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, XMVector3Cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, XMVector3Cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```

The course's DirectX 12 code uses a right-handed camera (`XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH`), like GLM, and
the cross product is the same function in any library – it is maths, not a convention – so the planes are learnopengl's.
:::

If you check the directions, you will find that the plane learnopengl names `rightFace` contains the frustum's *left*
edge (with its normal pointing right, into the frustum), and `topFace` the bottom edge; the names of the side planes are
swapped. It doesn't matter for culling, which tests all six, but it is worth knowing if you ever use one face on its
own.

Note what the function does *not* use: the projection matrix. The planes are built in world space from the camera's
position and directions, so it doesn't matter how the projection maps depth or which way it points y.
:::opengl
OpenGL's projection maps depth to -1..1 in normalised device coordinates; the planes don't care.
:::
:::vulkan
Vulkan's projection maps depth to 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE`) and flips y (`proj[1][1] *= -1`); neither
changes the planes, and the culled set and the counts are exactly OpenGL's. (A different way to get the planes extracts
them from the rows of the view-projection matrix; *that* method does depend on the depth range – the near plane is
row 3 alone for 0..1 depth but row 4 + row 3 for -1..1 – and on the y flip.)
:::
:::d3d12
Direct3D's projection maps depth to 0..1; that doesn't change the planes, and the culled set and the counts are exactly
OpenGL's. (A different way to get the planes extracts them from the view-projection matrix; *that* method does depend on
the depth range – for 0..1 depth the near plane comes from the third column alone, for -1..1 from the fourth plus the
third.)
:::

Now do the second task, **frustum**: `Plane`, its two helpers, `Frustum` and `createFrustumFromCamera`. Nothing calls
them yet, so the picture stays the same.

```quiz
A plane has the unit normal (0, 0, −1) and the distance 2. What is the signed distance of the point (1, 0, −5), and on which side is it?
- [ ] −3: behind the plane
- [x] 3: on the side the normal points to
- [ ] 7: on the side the normal points to
- [ ] −7: behind the plane
---
dot((0, 0, −1), (1, 0, −5)) − 2 = 5 − 2 = 3. A positive signed distance means the side the normal points to – for a frustum plane, the inside.
```

## Bounding volumes

Testing every vertex of a model against six planes would cost more than drawing it. Instead each model gets a *bounding
volume*: a simple shape that encloses all of its vertices and can be tested with a few operations. If the bounding volume
is completely outside the frustum, so is the model. If it is partly inside, the model may or may not be visible – we
draw it, and let the GPU clip it. The test is *conservative*: it can draw something invisible, but it never skips
something visible.

The simplest bounding volume is a **sphere**: a centre and a radius. learnopengl generates it from the model's vertices:
find the axis-aligned box around all vertices (the smallest and largest x, y and z), take its centre as the sphere's
centre and half its diagonal as the radius.

The course corrects one detail of learnopengl's helper: learnopengl starts the box's maximum at
`std::numeric_limits<float>::min()`, which is the smallest *positive* float, not the most negative one – for a model
lying entirely at negative coordinates the maximum would stay wrong. The course starts it at
`std::numeric_limits<float>::lowest()`. (learnopengl also stores the whole diagonal as the radius and halves it later;
the course stores half the diagonal – the same result.)

:::opengl
```cpp
// the sphere around the box that encloses all the model's vertices
Sphere generateSphereBV(const Model& model)
{
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB.x = std::min(minAABB.x, vertex.Position.x);
            minAABB.y = std::min(minAABB.y, vertex.Position.y);
            minAABB.z = std::min(minAABB.z, vertex.Position.z);

            maxAABB.x = std::max(maxAABB.x, vertex.Position.x);
            maxAABB.y = std::max(maxAABB.y, vertex.Position.y);
            maxAABB.z = std::max(maxAABB.z, vertex.Position.z);
        }
    }

    Sphere sphere;
    sphere.center = (maxAABB + minAABB) * 0.5f;
    sphere.radius = glm::length(maxAABB - minAABB) * 0.5f; // half the box's diagonal
    return sphere;
}
```

`Model` keeps its meshes and their vertices on the CPU after loading (`model.meshes`, `mesh.vertices`), so the helper
can read them. Add `#include <limits>` and `#include <algorithm>`.
:::
:::vulkan
learnopengl's helper loops over `model.meshes` and their `vertices`. Vulkan's `Model` only holds GPU buffers – the
vertices were copied into a device-local buffer and are no longer on the CPU as far as the struct knows – so the task
gives it a copy: `std::vector<Vertex> vertices;` in `struct Model` (`// a copy of the vertices on the CPU, for the
model's bounding volume`), filled with `ourModel.vertices = vertices;` in `loadEntities()`. Then:

```cpp
Sphere generateSphereBV(const Model& model) {
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Vertex& vertex : model.vertices) {
        minAABB.x = std::min(minAABB.x, vertex.pos.x);
        minAABB.y = std::min(minAABB.y, vertex.pos.y);
        minAABB.z = std::min(minAABB.z, vertex.pos.z);

        maxAABB.x = std::max(maxAABB.x, vertex.pos.x);
        maxAABB.y = std::max(maxAABB.y, vertex.pos.y);
        maxAABB.z = std::max(maxAABB.z, vertex.pos.z);
    }

    Sphere sphere;
    sphere.center = (maxAABB + minAABB) * 0.5f;
    sphere.radius = glm::length(maxAABB - minAABB) * 0.5f; // half the box's diagonal
    return sphere;
}
```

A real engine computes bounding volumes once, when it imports an asset, and stores them with it.
:::
:::d3d12
The `model` chapter's `Model` keeps its meshes and their vertices on the CPU after loading (`model.meshes`,
`mesh.vertices`), so the helper can read them. With DirectXMath, `XMVectorMin` and `XMVectorMax` compare component by
component, so the box takes one line per bound:

```cpp
Sphere generateSphereBV(const Model& model)
{
    // the box: the smallest and the largest x, y and z (XMVectorMin / XMVectorMax compare
    // component by component); -FLT_MAX is the lowest float
    XMVECTOR minAABB = XMVectorReplicate(FLT_MAX);
    XMVECTOR maxAABB = XMVectorReplicate(-FLT_MAX);
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB = XMVectorMin(minAABB, XMLoadFloat3(&vertex.position));
            maxAABB = XMVectorMax(maxAABB, XMLoadFloat3(&vertex.position));
        }
    }

    Sphere sphere;
    XMStoreFloat3(&sphere.center, (maxAABB + minAABB) * 0.5f);
    sphere.radius = XMVectorGetX(XMVector3Length(maxAABB - minAABB)) * 0.5f;    // half the box's diagonal
    return sphere;
}
```

`FLT_MAX` comes from `<cfloat>`.
:::

The sphere is in the model's own space. To test it, it has to be in world space, like the planes: its centre is
transformed by the entity's global model matrix, and its radius scaled by the largest of the matrix's three scale
factors – the length of each of its first three columns. (If an object is stretched more along one axis, the sphere has
to grow by the largest stretch to still enclose it.) A sphere is then on the inner side of a plane, at least partly,
when its centre's signed distance is greater than `−radius`:

:::opengl
```cpp
// the sphere is (at least partly) on the side of the plane its normal points to
bool isOnOrForwardPlane(const Sphere& sphere, const Plane& plane)
{
    return getSignedDistanceToPlane(plane, sphere.center) > -sphere.radius;
}

// the sphere, moved and scaled by the entity's model matrix, is (at least partly) inside the frustum
bool isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)
{
    // get global scale thanks to our transform (the lengths of the model matrix's first three columns)
    const glm::vec3 globalScale = glm::vec3(glm::length(glm::vec3(transform.modelMatrix[0])),
                                            glm::length(glm::vec3(transform.modelMatrix[1])),
                                            glm::length(glm::vec3(transform.modelMatrix[2])));

    // get our global center with process it with the global model matrix of our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f));

    // to wrap correctly our shape, we need the maximum scale scalar
    const float maxScale = std::max(std::max(globalScale.x, globalScale.y), globalScale.z);

    Sphere globalSphere;
    globalSphere.center = globalCenter;
    globalSphere.radius = sphere.radius * maxScale;

    // check firstly the result that have the most chance to failure to avoid to call all functions
    return (isOnOrForwardPlane(globalSphere, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.farFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.topFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.bottomFace));
}
```

```quiz
In `isOnFrustum`, what is `glm::vec3(transform.modelMatrix[0])`?
- [x] The first column of the global model matrix: the model's x axis in world space, scaled by the global scale along x
- [ ] The entity's world position
- [ ] The first row of the matrix, the same in every model matrix
- [ ] The x coordinate of the sphere's centre
---
GLM indexes a matrix by columns. For a model matrix, the first three columns are the model's scaled axes and the fourth its translation – so their lengths are the scale factors, including the parents' scales.
```
:::
:::vulkan
```cpp
// the sphere is (at least partly) on the side of the plane its normal points to
bool isOnOrForwardPlane(const Sphere& sphere, const Plane& plane) {
    return getSignedDistanceToPlane(plane, sphere.center) > -sphere.radius;
}
```

`isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)` is learnopengl's GLM code:
the global scale from the lengths of `glm::vec3(transform.modelMatrix[0])`, `[1]` and `[2]` (the matrix's first three
columns), the centre `glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f))`, the radius
`sphere.radius * maxScale`, and the six `isOnOrForwardPlane` tests joined with `&&`, the side planes first – they fail
most often, and `&&` stops at the first failure.

```quiz
Why does the Vulkan project's `Model` get a `std::vector<Vertex> vertices` copy for the bounding volume?
- [ ] Because `vkCmdDrawIndexed` needs the vertices on the CPU
- [ ] Because the bounding volume has to be recomputed every frame
- [ ] Because push constants can only hold vertex positions
- [x] Because the struct only holds GPU buffers – the vertices were copied into a device-local buffer – and the helper has to read the positions on the CPU
---
learnopengl's `Model` keeps its meshes' vertices on the CPU; Vulkan's `Model` struct of this course only had the buffer handles. The bounding volume is computed once, from the copy; a real engine would compute it when importing the asset.
```
:::
:::d3d12
`isOnOrForwardPlane(const Sphere& sphere, const Plane& plane)` returns `getSignedDistanceToPlane(plane,
XMLoadFloat3(&sphere.center)) > -sphere.radius`. In `isOnFrustum` one thing differs from GLM: with DirectXMath's row
vectors, the matrix's scaled axes are its **rows** `r[0..2]`, where GLM has them in its columns:

```cpp
bool isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)
{
    const XMMATRIX modelMatrix = XMLoadFloat4x4(&transform.modelMatrix);

    // get global scale thanks to our transform: the lengths of the model matrix's first three
    // rows (DirectXMath's rows are glm's columns)
    const XMFLOAT3 globalScale(XMVectorGetX(XMVector3Length(modelMatrix.r[0])),
                               XMVectorGetX(XMVector3Length(modelMatrix.r[1])),
                               XMVectorGetX(XMVector3Length(modelMatrix.r[2])));

    // get our global center with process it with the global model matrix of our transform
    // (XMVector3Transform: the point with w = 1, times the matrix)
    const XMVECTOR globalCenter = XMVector3Transform(XMLoadFloat3(&sphere.center), modelMatrix);

    // to wrap correctly our shape, we need the maximum scale scalar
    const float maxScale = fmaxf(fmaxf(globalScale.x, globalScale.y), globalScale.z);

    Sphere globalSphere;
    XMStoreFloat3(&globalSphere.center, globalCenter);
    globalSphere.radius = sphere.radius * maxScale;

    // check firstly the result that have the most chance to failure to avoid to call all functions
    return (isOnOrForwardPlane(globalSphere, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.farFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.topFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.bottomFace));
}
```

```quiz
Where does DirectXMath keep the model's scaled x axis in an `XMMATRIX` model matrix?
- [ ] In `r[3]`, with the translation
- [ ] In the first column, as in GLM
- [x] In the first row, `r[0]`, because DirectXMath works with row vectors
- [ ] Nowhere: it has to be extracted with `XMMatrixDecompose`
---
With row vectors (`v · M`) the axes and the translation are the rows; GLM's column vectors put them in the columns. That is why the DirectX 12 code takes the lengths of `r[0]`, `r[1]` and `r[2]`.
```
:::

learnopengl writes `BoundingVolume` as a base class with virtual functions and `Sphere` and `AABB` as subclasses; the
course has no base class and writes the functions as overloads for each shape. Each entity stores its bounding volume –
`Sphere boundingVolume;` in `Entity`, set in `addChild` (`child.boundingVolume = generateSphereBV(model);`) and for the
root. All planets share one model, so all their spheres are the same in model space; the model matrices make them
different in the world.

Now do the third task, **bounding-sphere**. Again nothing uses it yet.

```quiz
A planet's bounding sphere has radius 2 in model space. Its global model matrix scales by 0.5 along x and z and by 1.5 along y. Which radius does `isOnFrustum` test with?
- [ ] 2 · 0.5 = 1, the smallest scale, so the sphere stays tight
- [ ] 2 · (0.5 + 0.5 + 1.5) / 3, the average scale
- [ ] 2, because scaling doesn't change a sphere
- [x] 2 · 1.5 = 3, the largest scale, so the sphere still encloses the stretched model
---
A stretched model fits into a sphere only if the sphere grows by the largest stretch. The lengths of the model matrix's first three columns (rows in DirectXMath) are the scale factors along the three axes – including the parents' scales, since it is the global matrix.
```

## Culling the scene graph

The drawing function now tests each entity before drawing it: build the frustum once per frame, and in
`drawSelfAndChild` draw an entity only when `isOnFrustum` says its bounding volume is in the frustum. learnopengl also
counts how many entities were visited (`total`) and how many drawn (`display`) and prints them every frame; the course
puts them into the window's title, so you can read them in the window.

Note that the function always goes on to the children, even when the entity itself is culled. A planet's children are
not inside its bounding sphere – they are 5 units away – so a culled parent says nothing about its children. A scene
graph with *hierarchical* bounding volumes, where each node's volume encloses its whole subtree, could skip the subtree
too; that is what makes culling large scenes fast.

To see the culling at work, the culling frustum is built with its far plane at **15** for now, while the projection
still reaches 100: everything farther than 15 should disappear.

:::opengl
```cpp
// draw an entity and all of its children - only those inside the frustum; count the drawn (display) and all (total) entities
void drawSelfAndChild(Entity& entity, const Frustum& frustum, Shader& ourShader, unsigned int& display, unsigned int& total)
{
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform))
    {
        ourShader.setMat4("model", entity.transform.modelMatrix);
        entity.pModel->Draw(ourShader);
        display++;
    }
    total++;

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, frustum, ourShader, display, total);
    }
}
```

In the render loop, after view and projection:

```cpp
        const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, (float)SCR_WIDTH / (float)SCR_HEIGHT, glm::radians(fov), 0.1f, 15.0f);

        unsigned int total = 0, display = 0;
        drawSelfAndChild(ourEntity, camFrustum, ourShader, display, total);

        std::string title = "LearnOpenGL - drawn: " + std::to_string(display) + " / " + std::to_string(total);
        glfwSetWindowTitle(window, title.c_str());
```

(`#include <string>` for `std::to_string`.)
:::
:::vulkan
A culled entity is simply not recorded: no push constant, no draw in the command buffer.

```cpp
void drawSelfAndChild(Entity& entity, const Frustum& frustum, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout, unsigned int& display, unsigned int& total) {
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform)) {
        PushConstants constants{};
        constants.model = entity.transform.modelMatrix;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        Draw(*entity.pModel, commandBuffer);
        display++;
    }
    total++;

    for (Entity& child : entity.children) {
        drawSelfAndChild(child, frustum, commandBuffer, pipelineLayout, display, total);
    }
}
```

The frustum and the counters live in `recordCommandBuffer()`, which runs every frame:

```cpp
        const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, swapChainExtent.width / (float) swapChainExtent.height, glm::radians(fov), 0.1f, 15.0f);

        unsigned int total = 0, display = 0;
        drawSelfAndChild(ourEntity, camFrustum, commandBuffer, pipelineLayout, display, total);

        std::string title = "Vulkan - drawn: " + std::to_string(display) + " / " + std::to_string(total);
        glfwSetWindowTitle(window, title.c_str());
```

(`#include <string>` for `std::to_string`.)
:::
:::d3d12
A culled entity is simply not recorded: no root constants, no draw in the command list.

```cpp
void drawSelfAndChild(Entity& entity, const Frustum& frustum, ID3D12GraphicsCommandList* commandList, unsigned int& display, unsigned int& total)
{
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform))
    {
        ModelConstants modelConstants = {};
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(XMLoadFloat4x4(&entity.transform.modelMatrix)));
        commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        entity.pModel->Draw(commandList);
        display++;
    }
    total++;

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, frustum, commandList, display, total);
    }
}
```

In `PopulateCommandList` the frustum is built, the graph drawn, and the counts put into the window's title with the
Win32 function `SetWindowTextW`:

```cpp
    const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, static_cast<float>(m_width) / static_cast<float>(m_height), XMConvertToRadians(fov), 0.1f, 15.0f);
```

```cpp
    // show how many entities were drawn in the window's title
    std::wstring title = L"LearnDirectX - drawn: " + std::to_wstring(display) + L" / " + std::to_wstring(total);
    SetWindowTextW(m_hwnd, title.c_str());
```

with `unsigned int total = 0, display = 0;` and `drawSelfAndChild(m_ourEntity, camFrustum, m_commandList.Get(),
display, total);` between them.
:::

Now do the fourth task, **cull**. Build and run: the back of the grid is gone. At 2.0 s the title says **8 / 101**:
only eight planets are drawn, the root and the nearest ones, whose bounding spheres reach closer than 15 units – among
them a planet whose centre is 16 units away but whose sphere still pokes inside the far plane. The planets 17, 20 or 42 units away
are culled, although the projection would have shown them. The scene is animated, so the counts change over time: at 1.0 s the title says
10 / 101 here – the numbers in this chapter are the ones at 2.0 s, the time the task checks look at.

```quiz
`drawSelfAndChild` visits the children of an entity even when the entity itself is culled. Why?
- [ ] Because the children's bounding volumes are stored in the parent
- [ ] Because a culled entity's model matrix is not up to date
- [x] Because a planet's bounding sphere encloses only its own model, not its children 5 units away – a culled parent says nothing about where its children are
- [ ] Because the GPU needs every draw call to keep the order of the children
---
Only a bounding volume that encloses the whole subtree would allow skipping the subtree – a hierarchical bounding volume. learnopengl's entities don't have one, so every entity is tested on its own.
```

## The camera's own frustum

The far plane at 15 was only there to make the culling visible. The culling frustum should be exactly what the
projection shows: the same field of view, aspect ratio, near and far plane.

:::opengl
Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
:::
:::vulkan
Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
:::
:::d3d12
Change the last argument of `createFrustumFromCamera` from `15.0f` to `100.0f`.
:::

Now do the fifth task, **camera-frustum**. Build and run: the picture is the grid's picture again, pixel for pixel –
every planet on screen is drawn – but the title says **37 / 101**. Almost two thirds of the planets lie beside or behind
the camera, and none of them is drawn any more. Everything you see is still there; only the invisible work is gone.

## AABB

A sphere is a loose fit for many shapes. The course's planet is flat: a sphere with a wide ring, about twice as
wide as it is high. Its bounding sphere is as tall as it is wide, mostly empty space. learnopengl's article offers a
second bounding volume, the **axis-aligned bounding box** (AABB): a centre and three half sizes, the *extents*. In the
model's own space it fits the ringed planet much more tightly.

`generateAABB` finds the same box as `generateSphereBV`, but keeps it: `center = (max + min) * 0.5` and `extents = max −
center`. The test against a plane projects the box onto the plane's normal: the box's "radius" in the normal's direction
is the sum of its extents, each weighted by how much the normal points along that axis:

:::opengl
```cpp
// see https://gdbooks.gitbooks.io/3dcollisions/content/Chapter2/static_aabb_plane.html
bool isOnOrForwardPlane(const AABB& aabb, const Plane& plane)
{
    // compute the projection interval radius of the box onto the plane's normal
    const float r = aabb.extents.x * std::abs(plane.normal.x) + aabb.extents.y * std::abs(plane.normal.y) +
        aabb.extents.z * std::abs(plane.normal.z);

    return -r <= getSignedDistanceToPlane(plane, aabb.center);
}
```
:::
:::vulkan
```cpp
// see https://gdbooks.gitbooks.io/3dcollisions/content/Chapter2/static_aabb_plane.html
bool isOnOrForwardPlane(const AABB& aabb, const Plane& plane) {
    // compute the projection interval radius of the box onto the plane's normal
    const float r = aabb.extents.x * std::abs(plane.normal.x) + aabb.extents.y * std::abs(plane.normal.y) +
        aabb.extents.z * std::abs(plane.normal.z);

    return -r <= getSignedDistanceToPlane(plane, aabb.center);
}
```
:::
:::d3d12
`isOnOrForwardPlane(const AABB& aabb, const Plane& plane)` computes the same radius with `fabsf` from the
`XMFLOAT3`s, `r = aabb.extents.x * fabsf(plane.normal.x) + aabb.extents.y * fabsf(plane.normal.y) + aabb.extents.z *
fabsf(plane.normal.z)`, and returns `-r <= getSignedDistanceToPlane(plane, XMLoadFloat3(&aabb.center))`.
:::

That works for a box whose sides are parallel to the world's axes. But the model matrix turns the box with the entity –
the grid is turned by 40° – and a turned box is no longer axis-aligned. learnopengl's `isOnFrustum` therefore builds a
new axis-aligned box in world space that encloses the turned one: it takes the box's three half axes after the model
matrix (each column of the matrix times its extent) and, for each world axis, adds up how far the three half axes reach
along it:

:::opengl
```cpp
    // get global center thanks to our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(aabb.center, 1.0f));

    // scaled orientation: the box's three half axes in world space
    const glm::vec3 right = glm::vec3(transform.modelMatrix[0]) * aabb.extents.x;
    const glm::vec3 up = glm::vec3(transform.modelMatrix[1]) * aabb.extents.y;
    const glm::vec3 forward = -glm::vec3(transform.modelMatrix[2]) * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const float newIi = std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), forward));
```

`newIj` and `newIk` do the same with the y and z axes; the new box (`globalAABB`, centre `globalCenter`, extents
`(newIi, newIj, newIk)`) is tested against the six planes as the sphere was.
:::
:::vulkan
```cpp
    // get global center thanks to our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(aabb.center, 1.0f));

    // scaled orientation: the box's three half axes in world space
    const glm::vec3 right = glm::vec3(transform.modelMatrix[0]) * aabb.extents.x;
    const glm::vec3 up = glm::vec3(transform.modelMatrix[1]) * aabb.extents.y;
    const glm::vec3 forward = -glm::vec3(transform.modelMatrix[2]) * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const float newIi = std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), forward));
```

`newIj` and `newIk` do the same with the y and z axes; the new box (`globalAABB`, centre `globalCenter`, extents
`(newIi, newIj, newIk)`) is tested against the six planes as the sphere was.
:::
:::d3d12
The half axes are the model matrix's rows:

```cpp
    // scaled orientation: the box's three half axes in world space (the model matrix's rows)
    const XMVECTOR right = modelMatrix.r[0] * aabb.extents.x;
    const XMVECTOR up = modelMatrix.r[1] * aabb.extents.y;
    const XMVECTOR forward = -modelMatrix.r[2] * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const XMVECTOR unitX = XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f);
    const XMVECTOR unitY = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
    const XMVECTOR unitZ = XMVectorSet(0.0f, 0.0f, 1.0f, 0.0f);
    const float newIi = fabsf(XMVectorGetX(XMVector3Dot(unitX, right))) +
        fabsf(XMVectorGetX(XMVector3Dot(unitX, up))) +
        fabsf(XMVectorGetX(XMVector3Dot(unitX, forward)));
```

`newIj` and `newIk` do the same with `unitY` and `unitZ`; the new box (centre `XMVector3Transform(center,
modelMatrix)`, extents `(newIi, newIj, newIk)`) is tested against the six planes as the sphere was.
:::

(`forward` is negated in learnopengl's code; with `abs` the sign makes no difference.) The entity's bounding volume
becomes an `AABB boundingVolume;`, generated with `generateAABB` in `addChild` and for the root.

Now do the last task, **aabb**. Build and run: the picture is the same, and the title says **38 / 101** – *one more*
than with spheres. The box was supposed to be tighter. It is, in the model's space; but the grid is turned by 40°, and
the axis-aligned box around a turned box is larger than the box itself. For a planet just outside the view, that larger
box pokes into the frustum where the sphere didn't. That is learnopengl's article's point about AABBs: they are tight
for objects that stay aligned with the axes, and they lose that advantage – sometimes to the sphere – once the objects
turn. An *oriented* bounding box (OBB), tested in the box's own axes, keeps the tight fit at a higher cost per test.

```quiz
Why can the turned grid make the AABB test draw more planets than the sphere test?
- [ ] Because the AABB is computed from fewer vertices than the sphere
- [x] Because the test uses the world-axis-aligned box around the turned box, which is larger than the box itself and can reach into the frustum where the sphere doesn't
- [ ] Because an AABB is always larger than the sphere around the same model
- [ ] Because the frustum's planes turn with the grid
---
In model space the box is tighter than the sphere for the flat ringed planet. Turned by 40°, the box that encloses it along the world axes grows, and for one planet just outside the view that makes the difference.
```

## What culling saves – and what it doesn't

Frustum culling saves work on both sides: the CPU records and submits fewer draw calls (and with a real engine sets
fewer states and uploads fewer constants), and the GPU runs fewer vertices through the vertex shader and clips fewer
triangles. In this scene, 64 of 101 planets are skipped at the moment of the expected result. Culling costs a few dot
products per entity per frame – far less than drawing the entity.

What it does *not* save:

- **Overdraw.** A planet hidden behind another planet is inside the frustum and is drawn; the depth test throws its
  fragments away, but they were rasterised. Frustum culling knows nothing about occlusion.
- **Pixels.** The planets in view cost exactly as much as before.
- **Invisible parts of visible objects.** A model partly in view is drawn whole; the GPU's clipping handles the rest.

Real renderers add more: **occlusion culling** skips objects hidden behind others (with hardware occlusion queries, a
hierarchical depth buffer from the last frame, or software rasterisation of large occluders); **spatial structures** –
bounding volume hierarchies, octrees, grids – test whole groups of objects at once, so that a scene of a hundred thousand
objects doesn't need a hundred thousand tests; and **GPU-driven culling** moves the tests into a compute shader that
writes the draw commands for indirect drawing, so the CPU doesn't even see the culled objects. All of them build on the
two ideas of this chapter: a frustum made of planes and a bounding volume that is cheap to test.

## Additional resources

- [Frustum Culling](https://learnopengl.com/Guest-Articles/2021/Scene/Frustum-Culling): learnopengl's guest article this
  chapter follows, with pictures of the frustum's planes.
- [frustum_culling.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/1.scene/2.frustum_culling/frustum_culling.cpp):
  learnopengl's demo; `Plane`, `Frustum`, `Sphere`, `AABB` and the culled `drawSelfAndChild` are in
  `includes/learnopengl/entity.h`.
- [std::numeric_limits::lowest](https://en.cppreference.com/w/cpp/types/numeric_limits/lowest): the most negative
  float – unlike `min()`, which is the smallest positive one.

:::opengl
- [glfwSetWindowTitle](https://www.glfw.org/docs/latest/group__window.html): GLFW's window functions, with the title
  the counts go into.
:::
:::vulkan
- [glfwSetWindowTitle](https://www.glfw.org/docs/latest/group__window.html): GLFW's window functions, with the title
  the counts go into.
:::
:::d3d12
- [SetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowtextw): the Win32
  function that sets the window's title.
- [DirectXMath programming guide](https://learn.microsoft.com/en-us/windows/win32/dxmath/directxmath-portal): `XMVECTOR`,
  `XMVector3Dot`, `XMVectorMin` / `XMVectorMax` and the row-vector matrices.
:::
