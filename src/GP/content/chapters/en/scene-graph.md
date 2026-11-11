# Scene Graph

So far every object in a scene had its own model matrix, computed from scratch each frame: translate here, rotate
there, scale. That is fine for a few boxes. It stops being fine as soon as objects belong to each other. A moon circles
a planet that circles a sun; a wheel turns on a car that drives along a road; a sword sits in a hand at the end of an
arm that swings from a shoulder. You want to describe the moon *relative to its planet* – "3.5 units to the side, a
little smaller" – and have it follow the planet wherever the planet goes, without recomputing its world position by
hand. The structure that does this is a *scene graph*: a tree of objects in which each object's transform is relative
to its parent's.

This chapter follows learnopengl's guest article *Scene Graph*, the first of two on organising a scene; the second,
*Frustum Culling*, uses the graph to skip objects the camera can't see. Nothing in it is specific to an API: a scene
graph is CPU-side code that ends in one model matrix per object, and the API only receives those matrices. What
{{api}} does with them is the same as in the *Model Loading* part.

## Local and global space

Each object in the graph – an *entity* – stores its transform in **local space**: its position, rotation and scale
relative to its parent. What the shader needs is its transform in **global space** (world space): the model matrix that
takes the object's vertices all the way to the world. The two are connected by one rule:

```text
global(child) = global(parent) · local(child)
```

The child's local matrix takes its vertices into the parent's space; the parent's global matrix takes them from there
into the world. For the root of the tree, which has no parent, the global matrix is the local one (its "parent" is the
identity matrix). Going down the tree, each level multiplies one more local matrix onto the right.

Because the parent's global matrix includes its *scale* and *rotation*, they carry over to everything below. That is
exactly what we want for a moon: if the planet is scaled to half its size, a moon 3.5 units away in the planet's space
is 1.75 units away in the world, and also half as large; if the planet turns, the moon swings round with it.

The project's scene is a chain of planets – the course's planet with its rings, from the *Model Loading* part
(learnopengl uses its own planet model). The root is the planet at the origin, at scale 1. It has one child, at local
position (3.5, 0, 0) with local scale 0.6; that child has one child with the same local transform, and so on, ten
children deep. learnopengl's demo uses (10, 0, 0) and 0.75 for its larger model.

```quiz
The root is at the origin with scale 1. Its child is at local position (3.5, 0, 0) with local scale 0.6, and the child's child has the same local transform. Where is the second child in world space?
- [ ] At x = 7.0: 3.5 + 3.5
- [x] At x = 5.6: 3.5 + 0.6 · 3.5, because the first child's scale also scales the local offset of its child
- [ ] At x = 3.5: every child is at (3.5, 0, 0)
- [ ] At x = 2.1: 3.5 · 0.6
---
global(child 2) = global(child 1) · local(child 2). The first child's global matrix translates by 3.5 and scales by 0.6, so the second child's offset of 3.5 becomes 2.1 in the world, and it lands at 3.5 + 2.1 = 5.6. The next ones follow at 6.86, 7.62, 8.07, … – each 0.6 times closer and smaller.
```

## The project

The project is the *Model Loading* part's program, reduced to learnopengl's `1.model_loading` shaders: the diffuse
texture without lighting. It loads the planet once and draws it once at the origin. The camera stands at (3, 6, 12),
looking down at 25° (pitch -25) so that the chain of planets fits into the window; learnopengl's demo has its camera at
(0, 0, 3) for its model. The background is a dark grey (0.05, 0.05, 0.05).

learnopengl writes `Transform` and `Entity` as classes with member functions; its `Entity` even derives from `Model`
and keeps its children in a `std::list<std::unique_ptr<Entity>>` with a pointer back to its parent. As in the *In
Practice* part, the course writes them as **plain structs with free functions** in one `main.cpp`, with learnopengl's
names: `computeModelMatrix(transform, …)` instead of `transform.computeModelMatrix(…)`. The steps and the maths are
learnopengl's; a real project would keep its classes in their own files.

:::opengl
The start draws the planet with the identity as its model matrix:

```cpp
        // draw the model once, at the origin
        glm::mat4 model = glm::mat4(1.0f);
        ourShader.setMat4("model", model);
        ourModel.Draw(ourShader);
```

`Model` and `Mesh` are the *Model Loading* part's classes (`model.h`, `mesh.h`), unchanged: `ourModel.Draw(ourShader)`
draws the planet's two meshes, the sphere and the rings, each with its texture.
:::
:::vulkan
The start draws the planet with the identity as its model matrix, a push constant (`struct PushConstants { glm::mat4
model; }`) as in the *Model Loading* part. The start also has learnopengl's `Model` in Vulkan terms – what an entity
will point to. learnopengl's `Model` holds meshes with their VAOs and draws itself with `Model::Draw(shader)`; here it is
a struct with the buffers the program loaded from `models/planet.obj` and a free function that records its draw:

```cpp
struct Model {
    VkBuffer vertexBuffer = VK_NULL_HANDLE;
    VkBuffer indexBuffer = VK_NULL_HANDLE;
    uint32_t indexCount = 0;
};

// record the draw of a model (learnopengl: Model::Draw): bind its buffers, draw its triangles
void Draw(const Model& model, VkCommandBuffer commandBuffer) {
    VkBuffer vertexBuffers[] = {model.vertexBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

    // the indices are uint32_t: a model can have more than 65536 vertices
    vkCmdBindIndexBuffer(commandBuffer, model.indexBuffer, 0, VK_INDEX_TYPE_UINT32);

    vkCmdDrawIndexed(commandBuffer, model.indexCount, 1, 0, 0, 0);
}
```

The planet's two materials (sphere and rings) are picked in the shaders by each vertex's material index, so one indexed
draw covers both. The descriptor set – the uniform buffer with view and projection, and the two diffuse maps – is the
same for every planet and is bound once before the draws.
:::
:::d3d12
The start draws the planet with the identity as its model matrix, in the root constants (root parameter 0) as in the
*Model Loading* part. `Mesh` and `Model` are the `model` chapter's classes, unchanged: `m_model.Draw(commandList)` draws
the planet's two meshes, the sphere and the rings, each binding its own texture.
:::

The `// TODO:` comments in the project mark where your code goes; **Build & run** (Ctrl+Enter) compiles the program and
runs it in the built-in simulator: one ringed planet on the left of the window.

## The Transform

The first piece is the transform: the local position, rotation and scale, and the global model matrix computed from
them. learnopengl stores the rotation as three *Euler angles* in degrees – about x, y and z – and builds the rotation
matrix from three rotations about the axes, applied in the order z, x, y (the matrix product Y · X · Z: the matrix
nearest to the vertex applies first). The local matrix is the usual translation · rotation · scale, often called a *TRS*
matrix: scale the object about its own origin, rotate it about its own origin, then move it into place.

:::opengl
```cpp
struct Transform
{
    // local space information
    glm::vec3 pos = { 0.0f, 0.0f, 0.0f };
    glm::vec3 eulerRot = { 0.0f, 0.0f, 0.0f }; // in degrees
    glm::vec3 scale = { 1.0f, 1.0f, 1.0f };

    // global space information concatenated in a matrix
    glm::mat4 modelMatrix = glm::mat4(1.0f);
};

// the local model matrix: translation * rotation * scale (also known as a TRS matrix)
glm::mat4 getLocalModelMatrix(const Transform& transform)
{
    const glm::mat4 transformX = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f));
    const glm::mat4 transformY = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.y), glm::vec3(0.0f, 1.0f, 0.0f));
    const glm::mat4 transformZ = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.z), glm::vec3(0.0f, 0.0f, 1.0f));

    // Y * X * Z
    const glm::mat4 rotationMatrix = transformY * transformX * transformZ;

    // translation * rotation * scale (also known as TRS matrix)
    return glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale);
}

// the model matrix in world space: the parent's model matrix * the local one (the root's parent matrix is the identity)
void computeModelMatrix(Transform& transform, const glm::mat4& parentGlobalModelMatrix)
{
    transform.modelMatrix = parentGlobalModelMatrix * getLocalModelMatrix(transform);
}
```

The three setters only store the new value for now – `setLocalPosition(Transform& transform, const glm::vec3&
newPosition)` sets `transform.pos`, and `setLocalRotation` and `setLocalScale` likewise. They will do one more thing in
the dirty-flag task. In the render loop the planet's model matrix now comes from a transform:

```cpp
        Transform planetTransform;
        computeModelMatrix(planetTransform, glm::mat4(1.0f));
        ourShader.setMat4("model", planetTransform.modelMatrix);
```
:::
:::vulkan
```cpp
struct Transform {
    // local space information
    glm::vec3 pos = { 0.0f, 0.0f, 0.0f };
    glm::vec3 eulerRot = { 0.0f, 0.0f, 0.0f }; // in degrees
    glm::vec3 scale = { 1.0f, 1.0f, 1.0f };

    // global space information concatenated in a matrix
    glm::mat4 modelMatrix = glm::mat4(1.0f);
};
```

`getLocalModelMatrix` and `computeModelMatrix` are learnopengl's GLM code, unchanged – GLM is as much at home in a
Vulkan program as in an OpenGL one:

```cpp
    // Y * X * Z
    const glm::mat4 rotationMatrix = transformY * transformX * transformZ;

    // translation * rotation * scale (also known as TRS matrix)
    return glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale);
```

with `transformX` = `glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f))` and
likewise for y and z, and `transform.modelMatrix = parentGlobalModelMatrix * getLocalModelMatrix(transform);`. The three
setters only store the new value for now. In `recordCommandBuffer()` the push constant now comes from a transform:
`Transform planetTransform; computeModelMatrix(planetTransform, glm::mat4(1.0f)); constants.model =
planetTransform.modelMatrix;`.
:::
:::d3d12
The struct stores DirectXMath's storage types – `XMFLOAT3` for the vectors and `XMFLOAT4X4` for the matrix – and the
functions compute with `XMMATRIX`, as everywhere in the course. The maths is learnopengl's, with one thing to watch:
DirectXMath works with **row vectors** (`v · M`), so a product of matrices applies from left to right, the opposite of
GLM's column vectors. The same transformations are therefore written in the opposite order:

```cpp
XMMATRIX getLocalModelMatrix(const Transform& transform)
{
    const XMMATRIX transformX = XMMatrixRotationX(XMConvertToRadians(transform.eulerRot.x));
    const XMMATRIX transformY = XMMatrixRotationY(XMConvertToRadians(transform.eulerRot.y));
    const XMMATRIX transformZ = XMMatrixRotationZ(XMConvertToRadians(transform.eulerRot.z));

    // learnopengl's Y * X * Z: with DirectXMath's row vectors the matrices apply from left to
    // right, so the same rotation is Z * X * Y
    const XMMATRIX rotationMatrix = transformZ * transformX * transformY;

    // translation * rotation * scale (also known as TRS matrix) - here scale * rotation * translation
    return XMMatrixScaling(transform.scale.x, transform.scale.y, transform.scale.z) * rotationMatrix * XMMatrixTranslation(transform.pos.x, transform.pos.y, transform.pos.z);
}
```

and the parent comes last: `global = local · parent`.

```cpp
void computeModelMatrix(Transform& transform, const XMMATRIX& parentGlobalModelMatrix)
{
    XMStoreFloat4x4(&transform.modelMatrix, getLocalModelMatrix(transform) * parentGlobalModelMatrix);
}
```

`XMMatrixRotationX/Y/Z` turn the same way about the axes as `glm::rotate` does, so the angles mean the same in both. The
three setters only store the new value for now. In `PopulateCommandList` the planet's model matrix now comes from a
transform: `Transform planetTransform; computeModelMatrix(planetTransform, XMMatrixIdentity());`, transposed for HLSL
into the root constants as before.
:::

Now do the first task, **transform**. A default transform is the identity, so the picture doesn't change.

## The Entity

An entity is a node of the tree: a transform, the model it draws, and its children. learnopengl's `Entity` keeps its
children as `std::list<std::unique_ptr<Entity>>` and a raw `parent` pointer, and its update reads the parent's matrix
through that pointer. The course's struct stores the children **by value** in a `std::vector`, and has no parent
pointer: every recursive function instead receives the parent's global matrix as a parameter, which is all it ever
needed from the parent. The root gets the identity.

:::opengl
```cpp
struct Entity
{
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};

// add a child that draws the given model
void addChild(Entity& parent, Model& model)
{
    Entity child;
    child.pModel = &model;
    parent.children.push_back(child);
}
```

(A `std::vector` of the struct that contains it is allowed since C++17: the vector only needs the element type to be
complete when it is used, not when it is declared.) Updating the graph walks it from the root, computing each entity's
global matrix from its parent's, and passing its own on to its children:

```cpp
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Drawing walks it the same way: set the entity's model matrix, draw its model, then its children.

```cpp
// draw an entity and all of its children
void drawSelfAndChild(Entity& entity, Shader& ourShader)
{
    ourShader.setMat4("model", entity.transform.modelMatrix);
    entity.pModel->Draw(ourShader);

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, ourShader);
    }
}
```

learnopengl's scene graph demo draws its chain with a `while` loop that follows the last child down (and leaves out the
last one); the course draws the whole tree recursively, as learnopengl's frustum culling demo does. The graph is built
after the model is loaded, with learnopengl's loop:

```cpp
    Entity ourEntity;
    ourEntity.pModel = &ourModel;
    setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
    const float scale = 0.6f;

    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int i = 0; i < 10; ++i)
        {
            addChild(*lastEntity, ourModel);
            lastEntity = &lastEntity->children.back();

            // set transform values: beside its parent, 0.6 times its size
            setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f));
            setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
        }
    }
    updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```

and the render loop draws it with `drawSelfAndChild(ourEntity, ourShader);` instead of the single draw.
:::
:::vulkan
```cpp
struct Entity {
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};
```

(A `std::vector` of the struct that contains it is allowed since C++17: the vector only needs the element type to be
complete when it is used, not when it is declared.) `addChild(Entity& parent, Model& model)` creates an `Entity child;`
with `child.pModel = &model;` and pushes it into `parent.children`. Updating the graph walks it from the root,
computing each entity's global matrix from its parent's and passing its own on:

```cpp
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children) {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Drawing walks it the same way. learnopengl's `ourShader.setMat4("model", …)` before each draw is a push constant, so
the recursive function records, per entity, the push constant and the model's draw into the command buffer:

```cpp
void drawSelfAndChild(Entity& entity, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout) {
    PushConstants constants{};
    constants.model = entity.transform.modelMatrix;
    vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
    Draw(*entity.pModel, commandBuffer);

    for (Entity& child : entity.children) {
        drawSelfAndChild(child, commandBuffer, pipelineLayout);
    }
}
```

Each `vkCmdDrawIndexed` sees the push constant values recorded before it – that is what makes one model drawn eleven
times appear in eleven places. learnopengl's scene graph demo draws its chain with a `while` loop that follows the last
child down (and leaves out the last one); the course draws the whole tree recursively, as learnopengl's frustum culling
demo does.

The application keeps learnopengl's two locals as members, `Model ourModel;` (in the start) and `Entity ourEntity;`,
and builds the graph once in `loadEntities()`, which `initVulkan()` calls after the buffers exist:

```cpp
    void loadEntities() {
        ourModel.vertexBuffer = vertexBuffer;
        ourModel.indexBuffer = indexBuffer;
        ourModel.indexCount = static_cast<uint32_t>(indices.size());

        // load entities
        // -------------
        ourEntity.pModel = &ourModel;
        setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
        const float scale = 0.6f;

        {
            Entity* lastEntity = &ourEntity;

            for (unsigned int i = 0; i < 10; ++i) {
                addChild(*lastEntity, ourModel);
                lastEntity = &lastEntity->children.back();

                // set transform values: beside its parent, 0.6 times its size
                setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f));
                setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
            }
        }
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
    }
```

`recordCommandBuffer()` then draws with `drawSelfAndChild(ourEntity, commandBuffer, pipelineLayout);` instead of the
single draw.
:::
:::d3d12
```cpp
struct Entity
{
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};
```

(A `std::vector` of the struct that contains it is allowed since C++17: the vector only needs the element type to be
complete when it is used, not when it is declared.) `addChild(Entity& parent, Model& model)` creates an `Entity child;`
with `child.pModel = &model;` and pushes it into `parent.children`. Updating the graph walks it from the root,
computing each entity's global matrix from its parent's and passing its own on – loaded back from its `XMFLOAT4X4` into
an `XMMATRIX`:

```cpp
void updateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}
```

Drawing walks it the same way. learnopengl's `ourShader.setMat4("model", …)` before each draw is a set of root
constants, so the recursive function records, per entity, the transposed model matrix and the model's draw into the
command list:

```cpp
void drawSelfAndChild(Entity& entity, ID3D12GraphicsCommandList* commandList)
{
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(XMLoadFloat4x4(&entity.transform.modelMatrix)));
    commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    entity.pModel->Draw(commandList);

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, commandList);
    }
}
```

`ModelConstants` (`XMFLOAT4X4 model`) moves out of the `D3D12App` class so that this free function can use it. Each draw
sees the root constants set before it – that is what makes one model drawn eleven times appear in eleven places.
learnopengl's scene graph demo draws its chain with a `while` loop that follows the last child down (and leaves out the
last one); the course draws the whole tree recursively, as learnopengl's frustum culling demo does.

The root is a member next to the model, `Entity m_ourEntity;`, built in `LoadAssets` right after `m_model.Load(...)` with
learnopengl's loop:

```cpp
        Entity* lastEntity = &m_ourEntity;

        for (unsigned int i = 0; i < 10; ++i)
        {
            addChild(*lastEntity, m_model);
            lastEntity = &lastEntity->children.back();

            // set transform values
            setLocalPosition(lastEntity->transform, XMFLOAT3(3.5f, 0.0f, 0.0f));
            setLocalScale(lastEntity->transform, XMFLOAT3(scale, scale, scale));
        }
```

with `m_ourEntity.pModel = &m_model;` and `const float scale = 0.6f;` before it and `updateSelfAndChild(m_ourEntity,
XMMatrixIdentity());` after it. `PopulateCommandList` then draws with `drawSelfAndChild(m_ourEntity,
m_commandList.Get());` instead of the single draw.
:::

### A word on pointers into vectors

The loop takes a pointer to the child it just added – `lastEntity = &lastEntity->children.back();` – and keeps using it.
With a `std::vector` of values that deserves a second look: when a vector grows beyond its capacity, it allocates new
memory and moves its elements there, and every pointer or reference to an old element now points into freed memory. Here
it is safe, because each entity gets exactly one child, and once the loop has moved on to that child it never adds to the
parent's vector again. But if you add a second child to an entity while you hold a pointer to its first, or store
`Entity*` parent pointers in the children as learnopengl does, those pointers can dangle after the next `push_back`.
That is why learnopengl keeps `std::unique_ptr<Entity>` in its list: each entity lives in its own allocation and never
moves. The course avoids the problem differently – no stored pointers into the tree, the parent's matrix passed down as a
parameter – and `pModel` points to the model, which lives outside the tree for the whole program.

```quiz
After `addChild(root, model)` the code stores `Entity* first = &root.children.back();`, then calls `addChild(root, model)` again. What may happen to `first`?
- [ ] Nothing: a pointer to a vector element stays valid as long as the vector exists
- [ ] It now points to the second child, because `back()` changed
- [x] It may dangle: if the second `push_back` exceeded the vector's capacity, the vector moved its elements to new memory
- [ ] It becomes `nullptr` automatically
---
`push_back` invalidates all pointers and references to the elements when it reallocates. The project's loop is safe because it only ever adds one child to each entity; learnopengl avoids the issue with `std::unique_ptr` in a list.
```

Now do the second task, **entity**: the struct and its three functions, the graph built from the root and ten children,
updated once, and drawn instead of the single planet. Build and run: a chain of eleven ringed planets runs to the right,
each 0.6 times the size of the one before and closer to it – the last ones are dots. Every one of them is the same model
with its own model matrix; the graph worked out where each goes from nothing but "3.5 to the right of my parent, 0.6 of
its size".

## The dirty flag

`updateSelfAndChild` recomputes every model matrix in the tree each time it is called. In a static scene that is
wasted work, and in a large scene – thousands of entities, most of them still – it adds up. learnopengl's answer is the
*dirty flag*: each transform remembers whether its local values changed since its matrix was last computed. The setters
set it; `computeModelMatrix` clears it.

The update then only recomputes what is out of date. If an entity is dirty, its matrix must be recomputed – and so must
the matrices of everything below it, even if their own local values didn't change, because their global matrices
contain this one. If it is clean, its matrix is still right, and the update only has to look further down the tree for
dirty entities. So the update is split in two:

:::opengl
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        forceUpdateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    if (entity.transform.isDirty)
    {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

The flag is `bool isDirty = true;` in `Transform` – true at the start, so that a new entity is computed the first time.
Each `setLocal…` function adds `transform.isDirty = true;`, and `computeModelMatrix` ends with `transform.isDirty =
false;`.
:::
:::vulkan
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children) {
        forceUpdateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    if (entity.transform.isDirty) {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children) {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

The flag is `bool isDirty = true;` in `Transform` – true at the start, so that a new entity is computed the first time.
Each `setLocal…` function adds `transform.isDirty = true;`, and `computeModelMatrix` ends with `transform.isDirty =
false;`.
:::
:::d3d12
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        forceUpdateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    if (entity.transform.isDirty)
    {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}
```

The flag is `bool isDirty = true;` in `Transform` – true at the start, so that a new entity is computed the first time.
Each `setLocal…` function adds `transform.isDirty = true;`, and `computeModelMatrix` ends with `transform.isDirty =
false;`.
:::

Now do the third task, **dirty-flag**. The picture stays the same – the first update finds everything dirty and computes
it all, exactly as before. The flag pays off in the next step, when one entity changes every frame.

```quiz
With the dirty flag, the root's rotation is set every frame, and nothing else changes. Which model matrices does `updateSelfAndChild(root, identity)` recompute?
- [ ] Only the root's: the children's local values didn't change
- [x] All eleven: the root is dirty, so `forceUpdateSelfAndChild` recomputes it and everything below it, because every child's global matrix contains the root's
- [ ] None: the flag is cleared at the end of every frame
- [ ] Only the children's, because the root has no parent
---
A clean entity below a dirty one still needs a new global matrix. Had only the last, tiny planet moved, the update would have walked down the clean chain and recomputed that one matrix alone.
```

## Moving the graph

Now the graph can show what it is for: move one entity and everything attached to it follows. The root turns about its
y axis at 20 degrees per second, learnopengl's speed. learnopengl adds `20 * deltaTime` to the angle after each frame;
the course sets the angle from the time instead – `20 · time` – so that the picture at a given moment is always the same
(the screenshot is taken at 2.0 s, an angle of 40°). Then the graph is updated, **before** it is drawn, so that the
frame shows this frame's matrices.

:::opengl
At the top of the frame, after the time:

```cpp
        // turn the root about its y axis (20 degrees per second): its children follow it
        setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```
:::
:::vulkan
At the top of `recordCommandBuffer()` – the code that runs every frame before the draws are recorded:

```cpp
        // turn the root about its y axis (20 degrees per second): its children follow it
        float currentFrame = static_cast<float>(glfwGetTime());
        setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```

The model matrices travel to the GPU inside the command buffer, as push constants, so updating them before the
recording is all it takes.
:::
:::d3d12
In `OnUpdate`, which runs every frame before `OnRender` records the command list, with the time since the first frame:

```cpp
    // turn the root about its y axis (20 degrees per second): its children follow it
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    setLocalRotation(m_ourEntity.transform, XMFLOAT3(0.0f, 20.0f * time, 0.0f));
    updateSelfAndChild(m_ourEntity, XMMatrixIdentity());
```

The model matrices travel to the GPU inside the command list, as root constants, so updating them before the
recording is all it takes.
:::

Now do the last task, **animate**. Build and run: the root planet turns, and the whole chain swings round with it like
the arm of a carousel – at 2.0 s it points 40° into the screen, back and to the right. You changed one rotation; the
graph moved eleven planets. Note that the children turn about the *root's* axis, not their own: the rotation is part of
the root's global matrix, which every child's global matrix starts with. To make every planet also spin about its own
axis, you would set each child's local rotation as well – try it, and the chain curls up, because each child's rotation
adds to its parent's.

## Going further

A scene graph is the backbone of most engines' scene representation, and learnopengl's article mentions a few things a
real one adds:

- **Rotations as quaternions.** Euler angles are easy to read but suffer from *gimbal lock* (two axes line up and a
  degree of freedom is lost) and interpolate badly. Engines store rotations as quaternions (`glm::quat`,
  `XMVECTOR` with `XMQuaternion…`) and convert to a matrix only for the model matrix.
- **Removing and reparenting.** Moving an entity to another parent changes its global matrix unless you also change its
  local one – usually you want it to stay where it is, so the new local matrix is `inverse(global(new parent)) ·
  global(entity)`.
- **More than transforms.** The same tree carries what else is inherited: visibility, a layer, a bounding volume that
  encloses all children. The next chapter, *Frustum Culling*, uses that last one: when a bounding volume is outside the
  camera's view, the entity – and, with hierarchical volumes, its whole subtree – needn't be drawn.
- **Flattening for the GPU.** Walking a tree with pointers is slow on large scenes; engines often store the nodes in
  arrays sorted so that parents come before children, update them in one linear pass, and upload all model matrices in
  one buffer for instanced or indirect drawing.

## Additional resources

- [Scene Graph](https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph): learnopengl's guest article this
  chapter follows.
- [scene_graph.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/1.scene/1.scene_graph/scene_graph.cpp):
  learnopengl's demo; its `Transform` and `Entity` classes are in `includes/learnopengl/entity.h`.
- [std::vector::push_back](https://en.cppreference.com/w/cpp/container/vector/push_back): when growing a vector
  invalidates pointers and references to its elements.

:::opengl
- [Transformations](https://learnopengl.com/Getting-started/Transformations): learnopengl's chapter on matrices and the
  order of translation, rotation and scale.
:::
:::vulkan
- [Push constants (Vulkan Guide)](https://docs.vulkan.org/guide/latest/push_constants.html): how each draw gets its own
  model matrix.
:::
:::d3d12
- [DirectXMath programming guide](https://learn.microsoft.com/en-us/windows/win32/dxmath/directxmath-portal):
  row vectors, `XMMATRIX` and the storage types `XMFLOAT3` / `XMFLOAT4X4`.
:::
