# Skeletal Animation

Everything the course has drawn so far was rigid: a model matrix moved, turned and scaled a whole mesh at once. Living
things don't move like that. An arm bends at the elbow, a tail curls, a face smiles – the mesh *deforms*. One way to
animate a deforming mesh is *vertex animation*: store the position of every vertex for every frame (or for a few key
frames, and blend between them). That is simple and exact, but it costs memory for every vertex in every key, and an
animation made for one mesh can't be reused on another.

Almost every game uses *skeletal animation* instead. An artist gives the mesh a **skeleton**: a small tree of **bones**,
each with its own transform. Every vertex is attached to one or a few bones with **weights** that say how much each bone
pulls it. An animation then only stores the bones' transforms over time – a handful of positions, rotations and scales
per bone, not per vertex – and the vertex shader moves every vertex by the bones it belongs to. This is called
*skinning*: the mesh is a skin over the bones. The same walk cycle can drive any character with the same skeleton.

This chapter follows learnopengl's guest article *Skeletal Animation*. It loads a skinned, animated model with assimp,
interpolates the bones' keyframes on the CPU, walks the bone hierarchy to compute one matrix per bone, and skins the mesh
in the vertex shader. Only the last step involves the GPU, and it works the same way in every API: integer bone ids and
float weights as vertex attributes, and an array of bone matrices in a buffer. This chapter shows where {{api}} puts them.

## The model

learnopengl animates a dancing character from an asset site. The course uses its own model: a **tentacle** – a tapered,
striped tube with a rounded tip and a row of pale suckers – 2.2 units tall, its foot at the origin. It is a glTF 2.0
file, `models/tentacle.gltf` (with `tentacle.bin` and the texture `tentacle.png`), written by the course's script
`models/make_tentacle.py`. Its skeleton is a chain of **four bones**: `Base` at the foot, `Lower` at y = 0.55, `Upper`
at 1.1 and `Tip` at 1.65; every vertex is attached to at most two of them, with weights that add up to 1. Its one
animation, `Sway`, lasts 2 seconds and loops: a wave of rotations runs up the tentacle, the base turns and bobs, and the
tip swells – five keys per bone, at 0, 0.5, 1, 1.5 and 2 seconds.

The camera is learnopengl's, at (0, 0, 3) looking down -z, and the model matrix `translate(0, -1, 0) · scale(0.9)` stands
the tentacle in the middle of the window (learnopengl uses `translate(0, -0.4, 0) · scale(0.5)` for its character). The
fragment shader shows the diffuse texture without lighting, as learnopengl's does.

:::opengl
The project is the *Model Loading* part's program with learnopengl's `model_animation.h` changes still to come: `model.h`
and `mesh.h` (the `Model` and `Mesh` classes), `assimp_glm_helpers.h` (learnopengl's conversions from assimp's types to
GLM's, as free `inline` functions: `ConvertMatrixToGLMFormat`, `GetGLMVec`, `GetGLMQuat`) and the shaders
`anim_model.vs` / `.fs`. The model is loaded as learnopengl's `model_animation.h` does – `aiProcess_Triangulate |
aiProcess_GenSmoothNormals | aiProcess_CalcTangentSpace`, **without** `aiProcess_FlipUVs`: assimp already turns glTF's
texture coordinates into OpenGL's v-up convention, and `stbi_set_flip_vertically_on_load(true)` turns the image the
same way. The program uses OpenGL 3.3 core, like learnopengl's demo.
:::
:::vulkan
The project loads the model with assimp as vulkan-tutorial's `loadModel` does: the whole model becomes one list of
vertices and one list of indices, for one vertex buffer and one index buffer. learnopengl's `Model` class becomes a struct
with free functions – `struct Model { std::vector<Vertex> vertices; std::vector<uint32_t> indices; … }`, filled by
`LoadModel(Model&, path)` → `processNode` → `processMesh` – and the file names are constants, `MODEL_PATH =
"models/tentacle.gltf"` and `TEXTURE_PATH = "models/tentacle.png"` (loaded with the course's `loadTexture`). assimp turns
glTF's texture coordinates into OpenGL's v-up convention; Vulkan's v = 0 is the image's top row, so the model is read
with `aiProcess_FlipUVs` added, which turns them back. learnopengl's GLM helpers (`ConvertMatrixToGLMFormat`,
`GetGLMVec`, `GetGLMQuat`) are free `inline` functions at the top of `main.cpp`. The model matrix is a push constant.
:::
:::d3d12
The project loads the model with the *Model* chapter's `Model` class and assimp, with `aiProcess_FlipUVs` – assimp turns
glTF's texture coordinates into OpenGL's v-up convention, the flag turns them back, and Direct3D's v = 0 is the image's
top row. There is no `aiProcess_ConvertToLeftHanded`: the course's maths is right-handed (`XMMatrixLookAtRH`,
`XMMatrixPerspectiveFovRH`). The model matrix is a root constant, as in the *Model* chapter.
:::

The `// TODO:` comments mark where your code goes. Build and run the program in your IDE: a straight tentacle in the
middle of the window – the mesh in its *rest pose*, the shape it was modelled in.

## Bones, the bind pose and the offset matrix

A bone is a transform in a hierarchy, like the scene graph's entities: each bone's transform is relative to its parent,
and a bone's global transform is its parent's global transform times its own local one. When the tentacle's base turns,
everything above it turns with it.

The mesh was modelled in the **bind pose** (the rest pose): the vertices' positions are in model space with the
skeleton standing straight. To move a vertex with a bone, we first have to express the vertex *relative to that bone* –
undo the bone's bind-pose transform – and then apply the bone's current, animated global transform. The first part is
the **offset matrix** (the *inverse bind matrix*): the inverse of the bone's global transform in the bind pose. For the
tentacle's `Lower` bone, which sits at y = 0.55 in the bind pose, it is simply `translate(0, -0.55, 0)`. So each bone's
final matrix is

```text
finalBoneMatrix = globalTransform(bone, now) · offset(bone)
```

In the bind pose the two cancel and the final matrix is the identity: the mesh stays as it was modelled. When the bone
turns, the vertex turns with it about the bone's own position.

A vertex attached to several bones is moved by each of them, and the results are blended with the vertex's weights:

```text
position = Σ weight[i] · finalBoneMatrix[boneId[i]] · bindPosePosition
```

This is *linear blend skinning*. Because the weights sum to 1, a vertex halfway between two bones that bend apart lands
between where each bone would take it, and the mesh bends smoothly at the joint.

```quiz
A vertex sits at (0, 0.55, 0) in the bind pose, and its only bone `Lower` (at y = 0.55 in the bind pose) has not moved. What does the bone's final matrix do to the vertex?
- [ ] It moves the vertex to the origin, because the offset matrix translates by −0.55
- [ ] It moves it up by 0.55 a second time
- [x] Nothing: global transform · offset = translate(0, 0.55, 0) · translate(0, −0.55, 0) = identity in the bind pose
- [ ] It rotates it about the origin
---
The offset matrix takes the vertex into the bone's space, the global transform brings it back out. Only when the bone's global transform differs from its bind pose does the vertex move.
```

## Keyframes and interpolation

An animation stores, for every animated bone, three **tracks** of keyframes: positions, rotations and scales, each key
with a time stamp. Between the keys, the bone's transform is interpolated. Positions and scales are interpolated
linearly – `mix(a, b, t)` – with `t` the fraction of the way from the earlier key to the later one.

Rotations are stored as **quaternions**, and interpolated with **slerp**, spherical linear interpolation, which moves
along the shortest arc between the two orientations at a constant angular speed. Interpolating Euler angles instead
gives strange paths – the three angles change independently, so the rotation in between can swing through orientations
that are on neither key's way, and angles that wrap around 360° take the long way. Even interpolating the components of
the rotation *matrices* linearly fails: the result is not a rotation at all (it shrinks and shears the mesh in between).
Quaternions avoid both.

Time in an animation file is counted in **ticks**. The file says how many ticks make a second (`mTicksPerSecond`) and how
long the animation is (`mDuration`). For the tentacle's glTF file assimp reports 1000 ticks per second and a duration of
2000 ticks, so its keys are at 0, 500, 1000, 1500 and 2000 ticks. The animator advances its time by `ticksPerSecond ·
deltaTime` each frame and wraps it with `fmod(time, duration)` to loop.

```quiz
Why are a bone's rotation keys interpolated with slerp on quaternions rather than by interpolating Euler angles linearly?
- [ ] Because Euler angles can't be stored in an animation file
- [x] Because slerp follows the shortest arc between the two orientations at a constant speed, while interpolating three angles independently can take detours (and the long way round at 360°)
- [ ] Because slerp is cheaper to compute than a linear interpolation
- [ ] Because the GPU only accepts quaternions in the vertex shader
---
The keys' orientations are what the artist set; what happens between them is up to the interpolation. Quaternion slerp gives the most direct, even rotation – and the result stays a pure rotation, which a linear mix of matrices does not.
```

## Bone weights in the vertices

assimp stores the skin per bone: each `aiBone` of a mesh has a name, its offset matrix (`mOffsetMatrix`) and a list of
the vertices it influences with their weights (`mWeights`, each an `mVertexId` and an `mWeight`). A vertex shader needs
it the other way round – per vertex, the bones that move it. learnopengl turns it around while loading the mesh:
every vertex gets room for up to four bone ids and four weights (`MAX_BONE_INFLUENCE = 4`, enough for almost every
character; the tentacle uses two), all ids set to −1 (no bone) and weights to 0 at first. Then, for every bone, its
weights are written into the first free slot of each vertex it influences. Each bone name gets an id, in the order the
bones are first seen, and its offset matrix is kept in a map, `m_BoneInfoMap`, of `BoneInfo { int id; mat4 offset; }`.
For the tentacle the ids are 0, 1, 2, 3 for `Base`, `Lower`, `Upper` and `Tip`.

:::opengl
In `mesh.h`, `Vertex` grows by `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];`, and the
VAO gets two more attributes – the course's `Vertex` has no tangents, so the next free locations are 3 and 4
(learnopengl's are 5 and 6):

```cpp
        glVertexAttribIPointer(3, 4, GL_INT, sizeof(Vertex), (void*)offsetof(Vertex, m_BoneIDs));
```

```cpp
        glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, m_Weights));
```

Note the **I** in `glVertexAttribIPointer`: the bone ids are integers and must reach the shader as integers (`ivec4`).
`glVertexAttribPointer` would convert them to floats on the way. `model.h` gets the map and the counter and the loading
functions:
:::
:::vulkan
`Vertex` grows by `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];`, and the attribute
descriptions get two more entries – the ids at location 3, the weights at location 4:

```cpp
        // ids: four 32-bit signed integers (SINT keeps them integers: the shader reads an ivec4)
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32G32B32A32_SINT;
        attributeDescriptions[3].offset = offsetof(Vertex, m_BoneIDs);
```

and `VK_FORMAT_R32G32B32A32_SFLOAT` for the weights. The format decides how the shader sees the data: `SINT` delivers
integers to an `ivec4` – Vulkan's counterpart of OpenGL's `glVertexAttribIPointer` – where an `SFLOAT` or `SNORM` format
would deliver floats. The model struct keeps `std::map<std::string, BoneInfo> m_BoneInfoMap; int m_BoneCounter = 0;`
and the loading functions are learnopengl's:
:::
:::d3d12
`Vertex` grows by `int m_BoneIDs[4]; float m_Weights[4];` (at bytes 32 and 48), and the input layout gets two more
elements with the semantics Direct3D reserves for skinning:

```cpp
            { "BLENDINDICES", 0, DXGI_FORMAT_R32G32B32A32_SINT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BLENDWEIGHT", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 0, 48, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

The `SINT` format delivers integers to the shader's `int4` – Direct3D's counterpart of OpenGL's
`glVertexAttribIPointer`. The model keeps a map of `BoneInfo` (with the offset as an `XMFLOAT4X4`) and a counter, and
the loading functions are learnopengl's:
:::

```cpp
    // put the bone and its weight into the vertex's first free slot (at most MAX_BONE_INFLUENCE bones per vertex)
    void SetVertexBoneData(Vertex& vertex, int boneID, float weight)
    {
        for (int i = 0; i < MAX_BONE_INFLUENCE; ++i)
        {
            if (vertex.m_BoneIDs[i] < 0)
            {
                vertex.m_Weights[i] = weight;
                vertex.m_BoneIDs[i] = boneID;
                break;
            }
        }
    }
```

`ExtractBoneWeightForVertices`, called at the end of `processMesh`, gives every new bone name the next id and stores its
offset matrix (converted from assimp's row-major `aiMatrix4x4`), then walks the bone's weights:

```cpp
            for (int weightIndex = 0; weightIndex < numWeights; ++weightIndex)
            {
                int vertexId = weights[weightIndex].mVertexId;
                float weight = weights[weightIndex].mWeight;
                SetVertexBoneData(vertices[vertexId], boneID, weight);
            }
```

Now do the first task, **bone-weights**. The shader doesn't use the new attributes yet, so the tentacle still stands
straight.

## The Bone

learnopengl's `Bone` class holds one bone's three tracks and computes its local transform at a given time. As in the
*Scene Graph* chapter, the course writes it as a struct with free functions, with learnopengl's names:
`CreateBone(name, ID, channel)` copies the keys of an `aiNodeAnim` into `m_Positions`, `m_Rotations` and `m_Scales`;
`UpdateBone(bone, time)` interpolates all three and combines them.

Finding the two keys around a time is a search for the first key whose *next* key is later:

:::opengl vulkan
```cpp
int GetPositionIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumPositions - 1; ++index)
    {
        if (animationTime < bone.m_Positions[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumPositions - 2; // not reached: the animation's time stays below its duration
}
```

(learnopengl ends the function with `assert(0)`, which leaves it without a return value in a release build; the course
returns the last pair.) `GetScaleFactor(last, next, time)` is `(time − last) / (next − last)`, the fraction between the
keys. The rotation:

```cpp
    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    glm::quat finalRotation = glm::slerp(bone.m_Rotations[p0Index].orientation, bone.m_Rotations[p1Index].orientation,
        scaleFactor);
    finalRotation = glm::normalize(finalRotation);
    return glm::toMat4(finalRotation);
```

Positions and scales do the same with `glm::mix`. A track with a single key just returns that key's value. Finally:

```cpp
void UpdateBone(Bone& bone, float animationTime)
{
    glm::mat4 translation = InterpolatePosition(bone, animationTime);
    glm::mat4 rotation = InterpolateRotation(bone, animationTime);
    glm::mat4 scale = InterpolateScaling(bone, animationTime);
    bone.m_LocalTransform = translation * rotation * scale;
}
```

`glm::toMat4` and `glm::slerp` for quaternions need `#define GLM_ENABLE_EXPERIMENTAL` and `<glm/gtx/quaternion.hpp>`.
assimp's quaternions store w first; `GetGLMQuat` builds `glm::quat(w, x, y, z)`.
:::
:::d3d12
The functions are learnopengl's, with DirectXMath in place of GLM. Matrices are stored as `XMFLOAT4X4` and quaternions as
`XMFLOAT4` in the structs and vectors (`XMMATRIX` and `XMVECTOR` need a 16-byte alignment that `std::vector` and
`std::map` don't promise). `glm::mix` becomes `XMVectorLerp`, and the rotation:

```cpp
    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    XMVECTOR finalRotation = XMQuaternionSlerp(XMLoadFloat4(&bone.m_Rotations[p0Index].orientation), XMLoadFloat4(&bone.m_Rotations[p1Index].orientation),
        scaleFactor);
    finalRotation = XMQuaternionNormalize(finalRotation);
    return XMMatrixRotationQuaternion(finalRotation);
```

`GetXMQuat` reorders assimp's w-first quaternion into DirectXMath's (x, y, z, w). And since DirectXMath multiplies a **row
vector** by the matrix on its right, every product of transforms is written in the opposite order from GLM's – the local
transform learnopengl writes `translation * rotation * scale` becomes:

```cpp
void UpdateBone(Bone& bone, float animationTime)
{
    XMMATRIX translation = InterpolatePosition(bone, animationTime);
    XMMATRIX rotation = InterpolateRotation(bone, animationTime);
    XMMATRIX scale = InterpolateScaling(bone, animationTime);
    XMStoreFloat4x4(&bone.m_LocalTransform, scale * rotation * translation);
}
```

`GetPositionIndex` and the other searches are learnopengl's loops; learnopengl ends them with `assert(0)`, which leaves
the function without a return value in a release build, so the course returns the last pair (`count - 2`).
`GetScaleFactor(last, next, time)` is `(time − last) / (next − last)`.
:::

Now do the second task, **bone**. Nothing calls it yet.

## The Animation

learnopengl's `Animation` loads the animation from the file – with its own `Assimp::Importer`, here from the same
`tentacle.gltf` as the mesh – and keeps what the animator needs:

- the duration and the ticks per second;
- a copy of the file's **node tree** (`AssimpNodeData`: each node's name, its own transformation and its children),
  read recursively by `ReadHierarchyData`. The bones are nodes of this tree – `Tentacle` (the root) with the children
  `TentacleMesh` and `Base` → `Lower` → `Upper` → `Tip` – and the tree is what makes the bones a hierarchy;
- one `Bone` per animation **channel** (`ReadMissingBones`). A channel names the node it animates. If the name is not in
  the model's `m_BoneInfoMap` – a bone that moves but that no vertex uses directly – it gets a new id there; then the
  `Bone` is created with that id. The tentacle's channels come in the order `Tip`, `Upper`, `Lower`, `Base`, all of
  them already known from the mesh;
- the bone info map itself, copied from the model.

:::opengl vulkan
```cpp
void LoadAnimation(Animation& animation, const std::string& animationPath, Model& model)
{
    Assimp::Importer importer;
    const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);
    if (!scene || !scene->mRootNode || scene->mNumAnimations == 0)
    {
        std::cout << "ERROR::ASSIMP:: no animation in " << animationPath << std::endl;
        return;
    }
    auto aiAnim = scene->mAnimations[0];
    animation.m_Duration = aiAnim->mDuration;
    animation.m_TicksPerSecond = aiAnim->mTicksPerSecond;
    ReadHierarchyData(animation.m_RootNode, scene->mRootNode);
    ReadMissingBones(animation, aiAnim, model);
}
```

`FindBone(animation, name)` returns the `Bone` with that name, or `nullptr` for a node that isn't animated (learnopengl
searches with `std::find_if` and a lambda; the course with a range-for).
:::
:::d3d12
`LoadAnimation(animation, path, model)` is learnopengl's: `importer.ReadFile(animationPath, aiProcess_Triangulate)`,
`scene->mAnimations[0]`'s `mDuration` and `mTicksPerSecond`, `ReadHierarchyData` from `scene->mRootNode` (with each
node's `mTransformation` converted by `ConvertMatrixToXMFormat`), and `ReadMissingBones`. `FindBone(animation, name)`
returns the `Bone` with that name, or `nullptr` for a node that isn't animated. assimp's matrices are row-major and made
for column vectors (the translation in the last column); DirectXMath's row vectors want the translation in the last
row, so the conversion **transposes** them – the same numbers as learnopengl's `ConvertMatrixToGLMFormat` copies into
GLM's column-major storage, read the other way.
:::

Now do the third task, **animation**, and load the sway animation after the model:
:::opengl
`Animation swayAnimation; LoadAnimation(swayAnimation, "models/tentacle.gltf", ourModel);`. The picture doesn't change.
:::
:::vulkan
`LoadAnimation(swayAnimation, MODEL_PATH, ourModel)` in `initVulkan()`, after `LoadModel` and before the buffers are
created (`swayAnimation` is a member of the application). The picture doesn't change.
:::
:::d3d12
`LoadAnimation(m_swayAnimation, …, m_model)` in `LoadAssets`, right after the model (`m_swayAnimation` is a member of
`D3D12App`). The picture doesn't change.
:::

## The Animator

The `Animator` plays an animation: it keeps the current time and the **final bone matrices**, 100 of them (learnopengl's
`MAX_BONES`), all identities at first. `CalculateBoneTransform` walks the node tree from the root, passing each node's
global transform down to its children – exactly the scene graph's update. For a node that is an animated bone, its own
transform is the bone's interpolated local transform at the current time; otherwise the node's static transformation from
the file. For a node that is a bone, the final matrix is its global transform times its offset matrix:

:::opengl vulkan
```cpp
void CalculateBoneTransform(Animator& animator, const AssimpNodeData* node, glm::mat4 parentTransform)
{
    std::string nodeName = node->name;
    glm::mat4 nodeTransform = node->transformation;

    Bone* bone = FindBone(*animator.m_CurrentAnimation, nodeName);

    if (bone)
    {
        UpdateBone(*bone, animator.m_CurrentTime);
        nodeTransform = bone->m_LocalTransform;
    }

    glm::mat4 globalTransformation = parentTransform * nodeTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        glm::mat4 offset = boneInfoMap[nodeName].offset;
        animator.m_FinalBoneMatrices[index] = globalTransformation * offset;
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
}
```

and `UpdateAnimation` advances the time and recomputes everything:

```cpp
void UpdateAnimation(Animator& animator, float dt)
{
    animator.m_DeltaTime = dt;
    if (animator.m_CurrentAnimation)
    {
        animator.m_CurrentTime += animator.m_CurrentAnimation->m_TicksPerSecond * dt;
        animator.m_CurrentTime = fmod(animator.m_CurrentTime, animator.m_CurrentAnimation->m_Duration);
        CalculateBoneTransform(animator, &animator.m_CurrentAnimation->m_RootNode, glm::mat4(1.0f));
    }
}
```
:::
:::d3d12
The walk is learnopengl's with the products in row-vector order – a node's global transform is `nodeTransform *
parentTransform`, a bone's final matrix `offset * globalTransformation`:

```cpp
    XMMATRIX globalTransformation = nodeTransform * parentTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        XMMATRIX offset = XMLoadFloat4x4(&boneInfoMap[nodeName].offset);
        XMStoreFloat4x4(&animator.m_FinalBoneMatrices[index], offset * globalTransformation);
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
```

The results are the same matrices as GLM's, transposed. `UpdateAnimation(animator, dt)` is learnopengl's: `m_CurrentTime
+= m_TicksPerSecond * dt`, `fmod(m_CurrentTime, m_Duration)`, then `CalculateBoneTransform` from the root with
`XMMatrixIdentity()`.
:::

Read a final matrix from the vertex's point of view: the offset matrix acts first (it takes the bind-pose vertex into the
bone's space), then the bone's local transform, then its parent's, and so on up to the root. GLM writes that chain from
the root down to the offset; DirectXMath, with row vectors, writes it from the offset up to the root.

Now do the fourth task, **animator**: create the animator for the sway animation and, for now, compute the bones once at
time 0 with `UpdateAnimation(animator, 0.0f)` before the loop. The matrices exist, but nothing uses them yet.

```quiz
In `CalculateBoneTransform`, the node `TentacleMesh` is not a bone and has no animation channel. What happens at that node?
- [ ] The walk stops there: its children are not visited
- [x] Its static transformation from the file is used for its global transform, and no final bone matrix is written for it
- [ ] It gets a new bone id and a final matrix of its own
- [ ] Its global transform is reset to the identity
---
Only nodes found in `m_BoneInfoMap` get a final matrix, and only animated nodes take their transform from a `Bone`. Every node still passes its global transform on to its children – a bone below a static node inherits that node's transformation.
```

## Skinning in the vertex shader

The vertex shader now moves every vertex by its bones: for each of its four slots, skip an id of −1, transform the
bind-pose position by that bone's final matrix and add the result with the slot's weight. learnopengl also guards against
an id beyond the array, falling back to the unskinned position.

:::opengl
```glsl
layout (location = 3) in ivec4 boneIds;
layout (location = 4) in vec4 weights;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

const int MAX_BONES = 100;
const int MAX_BONE_INFLUENCE = 4;
uniform mat4 finalBonesMatrices[MAX_BONES];

out vec2 TexCoords;

void main()
{
    // the position as the weighted sum of where each of the vertex's bones moves it
    vec4 totalPosition = vec4(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES)
        {
            totalPosition = vec4(pos, 1.0);
            break;
        }
        vec4 localPosition = finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0);
        totalPosition += localPosition * weights[i];
    }

    mat4 viewModel = view * model;
    gl_Position = projection * viewModel * totalPosition;
    TexCoords = tex;
}
```

The 100 matrices are uniforms, set every frame one by one:

```cpp
        auto transforms = animator.m_FinalBoneMatrices;
        for (int i = 0; i < (int)transforms.size(); ++i)
            ourShader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i]);
```

That is 100 `glUniformMatrix4fv` calls a frame – fine for one model. A renderer with many animated models puts the
matrices into a uniform buffer or a shader storage buffer and uploads them in one go, as the explicit APIs do.
:::
:::vulkan
The 100 matrices go into the uniform buffer, after view and projection – 6,400 bytes of them, well within the 16 KB every
Vulkan device allows for a uniform buffer:

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 finalBonesMatrices[MAX_BONES];
} ubo;
```

with `glm::mat4 finalBonesMatrices[MAX_BONES];` in the C++ struct (std140 puts matrices 64 bytes apart, as C++ does).
The shader's loop is learnopengl's:

```glsl
    vec4 totalPosition = vec4(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++) {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES) {
            totalPosition = vec4(pos, 1.0);
            break;
        }
        vec4 localPosition = ubo.finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0);
        totalPosition += localPosition * weights[i];
    }
```

`updateUniformBuffer()` copies the animator's matrices into the struct every frame:

```cpp
        // the bones' final matrices
        auto transforms = animator.m_FinalBoneMatrices;
        for (int i = 0; i < (int)transforms.size(); ++i)
            ubo.finalBonesMatrices[i] = transforms[i];
```

and one `memcpy` uploads them. With many animated models a real renderer would use a storage buffer, or one region of
a buffer per model.
:::
:::d3d12
The 100 matrices go into the constant buffer after view and projection – `XMFLOAT4X4 finalBonesMatrices[MAX_BONES]` in
C++, `float4x4 finalBonesMatrices[MAX_BONES]` in HLSL; the buffer is 6,528 bytes, rounded up to 6,656 for its view. The
vertex shader reads the bones through `BLENDINDICES` and `BLENDWEIGHT`:

```hlsl
PSInput VSMain(float3 pos : POSITION, float3 norm : NORMAL, float2 tex : TEXCOORD, int4 boneIds : BLENDINDICES, float4 weights : BLENDWEIGHT)
{
    PSInput result;

    // the position as the weighted sum of where each of the vertex's bones moves it
    float4 totalPosition = float4(0.0f, 0.0f, 0.0f, 0.0f);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES)
        {
            totalPosition = float4(pos, 1.0f);
            break;
        }
        float4 localPosition = mul(float4(pos, 1.0f), finalBonesMatrices[boneIds[i]]);
        totalPosition += localPosition * weights[i];
    }
```

`OnUpdate` copies the matrices into the constant buffer every frame, transposed like the others:

```cpp
    for (int i = 0; i < static_cast<int>(m_animator.m_FinalBoneMatrices.size()); ++i)
        XMStoreFloat4x4(&constantBufferData.finalBonesMatrices[i], XMMatrixTranspose(XMLoadFloat4x4(&m_animator.m_FinalBoneMatrices[i])));
```

and one `memcpy` uploads them all.
:::

Now do the fifth task, **skinning**. Build and run: the tentacle takes the animation's first pose – at time 0 it is
already bent: the middle to the right, the upper part curving back to the left, the tip at the top left. It stands still,
because the time doesn't advance yet.

```quiz
Why are the bone ids passed as an integer attribute (`ivec4` / `SINT` / `int4`) rather than as floats?
- [ ] Because floats can't hold values up to 100
- [ ] Because integer attributes take less memory
- [x] Because they index the matrix array: an integer stays exact, while a float converted on the way – or normalised – could index the wrong bone or need a conversion in the shader
- [ ] Because the weights must be integers too
---
`glVertexAttribPointer` converts its data to floats; `glVertexAttribIPointer` keeps integers. Vulkan's `SINT` and Direct3D's `R32G32B32A32_SINT` formats do the same: the shader gets the ids as integers to index with.
```

## Playing the animation

The last step is the one learnopengl's render loop has: advance the animator by the frame's `deltaTime` every frame,
after the input and before drawing, and drop the one-time update at time 0.

:::opengl
`UpdateAnimation(animator, deltaTime);` in the render loop, right after `processInput(window);`.
:::
:::vulkan
`UpdateAnimation(animator, deltaTime);` in `mainLoop()`, after `processInput()` and before `drawFrame()`.
:::
:::d3d12
`UpdateAnimation(m_animator, deltaTime);` in `OnUpdate`, after the input and before the constant buffer is filled.
:::

Now do the last task, **play**. Build and run: the tentacle sways – a wave runs up from the base, the base turns and
bobs, the tip swells and shrinks – one cycle every two seconds, looping without a jump because the last key equals the
first. The expected result shows it at 1.25 s, 1250 ticks, between the keys at 1000 and 1500: the tentacle leans to the
right, its tip at the top right. At 0.25 s it leans to the left in the mirror pose.

```quiz
The animation has a duration of 2000 ticks at 1000 ticks per second. The animator's time is at 1990 ticks and the next frame takes 1/60 s. Where is the animation after the update?
- [ ] At 2006.7 ticks: the time runs on, and the keys past 2000 repeat the last one
- [ ] At 0: the animation restarts exactly at the beginning
- [x] At about 6.7 ticks: 1990 + 1000 · (1/60) = 2006.7, and `fmod` by 2000 wraps it to the start of the next cycle
- [ ] At 1990: the animator stops at the end
---
`fmod` keeps the time inside the animation. Because the tentacle's key at 2000 equals the key at 0, the wrap is seamless.
```

## Going further

learnopengl's animator is the core every engine starts from. What real engines add:

- **Blending animations.** A character walks, then runs: instead of switching, the two animations' local bone
  transforms are interpolated (slerp for the rotations) with a weight that changes over time. Layers let an upper body
  play a different animation from the legs.
- **Dual quaternion skinning.** Linear blend skinning averages matrices, and where two bones twist strongly against each
  other the mesh collapses at the joint (the "candy wrapper" effect). Representing each bone as a dual quaternion and
  blending those keeps the volume.
- **Normals.** The normals must be skinned too – with the same matrices (or their inverse transpose when scaled), which
  learnopengl's shader prepares in its unused `localNormal`. The tentacle is unlit, so the course leaves it out.
- **Skinning on the GPU, once.** When a skinned mesh is drawn several times a frame (shadow maps, depth pre-pass), engines
  skin it once in a compute shader into a vertex buffer and draw that – the *Compute Shaders* chapter shows the basics.
- **More bones, fewer uploads.** Bone matrices of all characters in one storage buffer; or 3 × 4 matrices instead of
  4 × 4 to save space.

## Additional resources

- [Skeletal Animation](https://learnopengl.com/Guest-Articles/2020/Skeletal-Animation): learnopengl's guest article this
  chapter follows.
- [skeletal_animation.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2020/skeletal_animation/skeletal_animation.cpp):
  learnopengl's demo; its `Bone`, `Animation` and `Animator` classes are in `includes/learnopengl/`.
- [glTF 2.0 specification: skins](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins): joints, inverse
  bind matrices and vertex weights in the format of the course's tentacle.

:::opengl
- [glVertexAttribPointer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribPointer.xhtml): includes
  `glVertexAttribIPointer` for integer attributes.
:::
:::vulkan
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): attribute formats,
  such as `R32G32B32A32_SINT` for integer attributes.
:::
:::d3d12
- [XMQuaternionSlerp](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmquaternionslerp):
  DirectXMath's spherical linear interpolation.
:::
