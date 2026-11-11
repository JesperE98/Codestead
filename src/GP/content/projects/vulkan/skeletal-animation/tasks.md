# Skeletal Animation (Vulkan) – tasks

learnopengl "Guest Articles / Skeletal Animation": `src/8.guest/2020/skeletal_animation/skeletal_animation.cpp` with
`anim_model.vs/.fs` and `includes/learnopengl/bone.h`, `animation.h`, `animator.h`, `model_animation.h`, `animdata.h`,
`assimp_glm_helpers.h`. Files: `main.cpp`, `shaders/anim_model.vert/.frag` (built to `anim_model.vert.spv` /
`.frag.spv`) and `models/` (the course's tentacle: `tentacle.gltf`, `tentacle.bin`, `tentacle.png` – learnopengl uses a
dancing vampire from Mixamo). The program is built like the Vulkan Model Loading chapters (one vertex and one index
buffer through a staging buffer, the uniform buffer at binding 0 with the camera's matrices, the texture at binding 1,
the model matrix as a push constant), but reads the model with **Assimp** (vulkan-tutorial's tinyobjloader reads OBJ
files, which have no bones or animations).

**Screenshot times: 1.25 s (the main one) and 0.25 s** – the animation plays from the `play` task on; the earlier
states are still (the same picture at both times). The time is the course's fixed frame clock (frame n sees
`glfwGetTime()` = n / 60; verify.sh: `VERIFY_FIXEDTIME=1 VERIFY_T=1.25`); `mainLoop()` adds up learnopengl's `deltaTime`
(1/60 per frame), so at frame 75 the animation is at 1.25 s = 1250 ticks.

**Fixed choices (the same in every API, see `../../opengl/skeletal-animation/tasks.md`):**
- **The model and its animation**: `models/tentacle.gltf` (glTF 2.0, four bones `Base` → `Lower` → `Upper` → `Tip`, one
  2-second animation `Sway` with 5 linear keys per track; assimp 5 reads it with `mTicksPerSecond = 1000`, `mDuration =
  2000`, the bones' ids 0..3 in the skin's order). Camera (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600,
  near 0.1, far 100, `proj[1][1] *= -1`), clear (0.05, 0.05, 0.05), depth test on, no culling, model matrix
  `translate(0, -1, 0) * scale(0.9)` (a push constant). The fragment shader shows `texture_diffuse1` (no lighting).
- **Plain structs and free functions** (the simulator follows those; a real project would keep learnopengl's classes):
  the Bone, Animation and Animator code is **word for word the OpenGL chapter's** (`struct Bone` with `CreateBone`,
  `Get…Index`, `GetScaleFactor`, `Interpolate…`, `UpdateBone`; `struct AssimpNodeData`, `struct Animation` with
  `ReadHierarchyData`, `ReadMissingBones`, `LoadAnimation`, `FindBone`; `struct Animator` with `InitAnimator`,
  `CalculateBoneTransform`, `UpdateAnimation`) – they are API-independent. learnopengl's `AssimpGLMHelpers` are the free
  `inline` functions `ConvertMatrixToGLMFormat`, `GetGLMVec`, `GetGLMQuat` at the top of `main.cpp`.
- **The model (Vulkan's own)**: OpenGL keeps the Model Loading part's `Model` / `Mesh` classes (a VAO per mesh). Here,
  as in vulkan-tutorial's `loadModel`, the whole model is one list of vertices and one list of indices for one vertex
  buffer and one index buffer: `struct Model { std::vector<Vertex> vertices; std::vector<uint32_t> indices;
  std::map<std::string, BoneInfo> m_BoneInfoMap; int m_BoneCounter = 0; };` filled by the free functions
  `LoadModel(Model&, path)` → `processNode` → `processMesh` (learnopengl's, appending each mesh's vertices and its
  indices counted from the mesh's first vertex) with `SetVertexBoneDataToDefault`, `SetVertexBoneData` and
  `ExtractBoneWeightForVertices(Model&, vertices, mesh, scene)`. `ReadMissingBones` therefore reads `model.m_BoneInfoMap`
  and `model.m_BoneCounter` directly (OpenGL: `model.GetBoneInfoMap()` / `GetBoneCount()`). The application holds
  `Model ourModel; Animation swayAnimation; Animator animator;` as members; `initVulkan()` calls `LoadModel(ourModel,
  MODEL_PATH)`, `LoadAnimation(swayAnimation, MODEL_PATH, ourModel)`, `InitAnimator(animator, &swayAnimation)` before
  the buffers are created; `mainLoop()` calls `UpdateAnimation(animator, deltaTime)` after the input, before
  `drawFrame()` (learnopengl's loop order).
- **File names as constants** (vulkan-tutorial's): `const std::string MODEL_PATH = "models/tentacle.gltf";` and
  `const std::string TEXTURE_PATH = "models/tentacle.png";` – the texture is loaded with the course's `loadTexture`
  (stb_image, RGBA, UNORM, repeat, linear, anisotropic, no mipmaps), not looked up through the glTF material.
- **Texture coordinates**: stb_image loads the image top row first, and Vulkan's v = 0 is the image's top row (no flip on
  load, as in every Vulkan chapter). assimp turns glTF's v-down texture coordinates into OpenGL's v-up ones; Vulkan
  reads with `aiProcess_FlipUVs` added (`aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs |
  aiProcess_CalcTangentSpace`), which turns them back: the yellow tip at the top, as in OpenGL (which flips the image
  instead). The animation's own `Assimp::Importer` uses `aiProcess_Triangulate` (learnopengl's).
- **Vertex data**: learnopengl's `Vertex` with Vulkan's binding and attribute descriptions: `Position` (location 0),
  `Normal` (1), `TexCoords` (2), **`int m_BoneIDs[4]` at location 3 as `VK_FORMAT_R32G32B32A32_SINT`** (an `ivec4` in
  the shader – the `SINT` format keeps them integers, Vulkan's `glVertexAttribIPointer`), **`float m_Weights[4]` at
  location 4 as `VK_FORMAT_R32G32B32A32_SFLOAT`**.
- **The bone matrices in the uniform buffer**: `struct UniformBufferObject { glm::mat4 view; glm::mat4 proj; glm::mat4
  finalBonesMatrices[MAX_BONES]; }` (`const int MAX_BONES = 100;`, 6,528 bytes – every Vulkan device accepts uniform
  buffers of 16 KB), filled every frame in `updateUniformBuffer()` from `animator.m_FinalBoneMatrices`
  (`auto transforms = animator.m_FinalBoneMatrices;` + a loop, OpenGL's `setMat4("finalBonesMatrices[i]")` loop). The
  shader declares the same block (`mat4 finalBonesMatrices[MAX_BONES]`, std140: 64 bytes per matrix, as in C++). A real
  renderer with many animated models would rather use a storage buffer or one uniform buffer region per model.
- Building: the program links Assimp (`-lassimp`; verify.sh does this for a Vulkan project that includes `assimp/`).

**What the camera sees** (lavapipe, 800×600): the tentacle on a dark background, unlit (the texture's colours).
Named points (OpenGL's): **upper** (400,200), **tip-0** (280,100), **tip-left** (230,100), **tip-right** (568,100),
**mid-right** (460,300), **foot** (400,520), **background** (100,300) = 13,13,13. Every state equals OpenGL's picture
except along the tube's edges and the dark rings of the texture (OpenGL samples with mipmaps, Vulkan without): 0.02–0.03 %
of the pixels differ by more than 24, e.g. tip-right at 1.25 s 121,76,47 here and 135,85,53 in OpenGL, tip-left at
0.25 s 156,98,61 vs 171,107,67 (both on the tip's last dark ring); all other named points within 1.

**Start picture** (the rest pose: no bones yet): a straight tentacle in the middle: upper = 82,42,36, foot =
204,176,179, tip-0 / tip-left / tip-right / mid-right = background.

## `bone-weights`
- **Task:** Give every vertex the bones that move it: `Vertex` gets the ids of up to four bones and their weights (attributes 3 and 4, also declared in the vertex shader), and the model reads them from assimp – a `BoneInfo` (id + offset matrix) per bone name in `ourModel.m_BoneInfoMap`, filled by `ExtractBoneWeightForVertices`, which walks each `aiBone`'s weights and puts them into the vertices with `SetVertexBoneData`.
- **Hint:** The ids are integers: `attributeDescriptions[3].format = VK_FORMAT_R32G32B32A32_SINT;` (`offsetof(Vertex, m_BoneIDs)`), the weights `VK_FORMAT_R32G32B32A32_SFLOAT` – the array of descriptions grows from 3 to 5. In `anim_model.vert`: `layout(location = 3) in ivec4 boneIds;` and `layout(location = 4) in vec4 weights;`. Start every vertex with ids -1 and weights 0 (`SetVertexBoneDataToDefault`); a bone's offset matrix is `ConvertMatrixToGLMFormat(mesh->mBones[boneIndex]->mOffsetMatrix)`, its weights `mesh->mBones[boneIndex]->mWeights[k]` (`mVertexId`, `mWeight`).
- **When done:** `main.cpp`: `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];` in `Vertex`;
  `std::array<VkVertexInputAttributeDescription, 5>` with location 3 (`VK_FORMAT_R32G32B32A32_SINT`, `offsetof(Vertex,
  m_BoneIDs)`) and location 4 (`VK_FORMAT_R32G32B32A32_SFLOAT`, `offsetof(Vertex, m_Weights)`); `struct BoneInfo { int
  id; glm::mat4 offset; };`, `std::map<std::string, BoneInfo> m_BoneInfoMap; int m_BoneCounter = 0;` in `Model`;
  `SetVertexBoneDataToDefault`, `SetVertexBoneData`, `ExtractBoneWeightForVertices(Model&, …)`;
  `SetVertexBoneDataToDefault(vertex);` in `processMesh`'s vertex loop and `ExtractBoneWeightForVertices(model, vertices,
  mesh, scene);` after it. `anim_model.vert`: the inputs at locations 3 and 4 (unused yet). **No visible change** (the
  start picture).

## `bone`
- **Task:** Write the Bone: the keyframes of one animation channel (`KeyPosition`, `KeyRotation`, `KeyScale` with their time stamps), read from an `aiNodeAnim` by `CreateBone`, and `UpdateBone`, which finds the two keys around a time, interpolates between them – `glm::mix` for positions and scales, `glm::slerp` for the rotations – and stores `translation * rotation * scale` as the bone's local transform.
- **Hint:** `GetPositionIndex` returns the first index whose *next* key is later than the time; `GetScaleFactor(last, next, time) = (time - last) / (next - last)`. A track with one key is that key's value. Quaternions from assimp: `glm::quat(w, x, y, z)` (`GetGLMQuat`); `glm::toMat4` needs `#define GLM_ENABLE_EXPERIMENTAL` and `<glm/gtx/quaternion.hpp>` (both at the top of `main.cpp` already).
- **When done:** `main.cpp`: `struct KeyPosition`, `KeyRotation`, `KeyScale`, `struct Bone`, `CreateBone`,
  `GetPositionIndex`, `GetRotationIndex`, `GetScaleIndex`, `GetScaleFactor`, `InterpolatePosition`,
  `InterpolateRotation` (`glm::slerp`, `glm::normalize`, `glm::toMat4`), `InterpolateScaling`, `UpdateBone` – the
  OpenGL chapter's code. Nothing calls them yet: **no visible change**.

## `animation`
- **Task:** Write the Animation: load the file's first animation with assimp (`LoadAnimation`): its duration and ticks per second, a copy of the node tree (`ReadHierarchyData` into `AssimpNodeData`), and one `Bone` per channel (`ReadMissingBones`, which also gives a bone that no vertex uses an id); `FindBone` looks a bone up by name. Give the application an `Animation swayAnimation` and load it from the model's file after the model.
- **Hint:** `const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);`, `scene->mAnimations[0]`: `mDuration`, `mTicksPerSecond`, `mNumChannels`, `mChannels[i]->mNodeName`. `ReadHierarchyData` is recursive: name, `ConvertMatrixToGLMFormat(src->mTransformation)`, then each child. `ReadMissingBones` uses `model.m_BoneInfoMap` and `model.m_BoneCounter`. In `initVulkan()`: `LoadAnimation(swayAnimation, MODEL_PATH, ourModel);` after `LoadModel`.
- **When done:** `main.cpp`: `struct AssimpNodeData`, `struct Animation`, `ReadHierarchyData`, `ReadMissingBones`,
  `LoadAnimation`, `FindBone`; the member `Animation swayAnimation;` and `LoadAnimation(swayAnimation, MODEL_PATH,
  ourModel);` in `initVulkan()`. Loaded (2000 ticks, 1000 ticks per second, 4 bones) but not played: **no visible
  change**.

## `animator`
- **Task:** Write the Animator: it holds the 100 final bone matrices and the animation's current time. `CalculateBoneTransform` walks the node tree from the root – a node's global transform is its parent's times its own (the bone's interpolated local transform when the node is animated) – and stores `global * offset` as each bone's final matrix; `UpdateAnimation` advances the time (in ticks, looping) and recalculates. Give the application an `Animator animator` for the sway animation and, for now, calculate the bones once at time 0.
- **Hint:** `InitAnimator` fills `m_FinalBoneMatrices` with 100 `glm::mat4(1.0f)`. `m_CurrentTime += m_TicksPerSecond * dt; m_CurrentTime = fmod(m_CurrentTime, m_Duration);`, then `CalculateBoneTransform(animator, &animation->m_RootNode, glm::mat4(1.0f))`. The bone's id and offset come from `m_BoneInfoMap[nodeName]`. In `initVulkan()`: `InitAnimator(animator, &swayAnimation); UpdateAnimation(animator, 0.0f);`.
- **When done:** `main.cpp`: `struct Animator`, `InitAnimator`, `CalculateBoneTransform`, `UpdateAnimation`; the member
  `Animator animator;`; in `initVulkan()` `InitAnimator(animator, &swayAnimation); UpdateAnimation(animator, 0.0f);`. The
  matrices exist but the shader does not use them: **no visible change**.

## `skinning`
- **Task:** Skin the mesh in the vertex shader: move each vertex to the weighted sum of `finalBonesMatrices[boneId] * position` over its bones (skipping ids of -1). The 100 matrices go into the uniform buffer, copied from the animator every frame.
- **Hint:** In C++: `const int MAX_BONES = 100;` and `glm::mat4 finalBonesMatrices[MAX_BONES];` after `proj` in `UniformBufferObject`; in `updateUniformBuffer()`: `auto transforms = animator.m_FinalBoneMatrices;` and `ubo.finalBonesMatrices[i] = transforms[i];` for every i. In the shader the same member in the uniform block, `const int MAX_BONE_INFLUENCE = 4;`, and learnopengl's loop: `totalPosition += ubo.finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0) * weights[i];`.
- **When done:** `main.cpp`: `MAX_BONES`, `finalBonesMatrices[MAX_BONES]` in `UniformBufferObject`, the copy loop in
  `updateUniformBuffer()`. `anim_model.vert`: `MAX_BONES`, `MAX_BONE_INFLUENCE`, `mat4 finalBonesMatrices[MAX_BONES]` in
  the block, learnopengl's loop (`continue` for -1, `totalPosition = vec4(pos, 1.0); break;` for an id ≥ MAX_BONES). The
  tentacle takes **the animation's first pose** (time 0, standing still), the same at 0.25 s and 1.25 s: tip-0 =
  198,140,82, foot = 204,176,179, upper / tip-left / tip-right / mid-right = 13,13,13 (OpenGL: tip-0 198,140,83).

## `play`
- **Task:** Play the animation: advance it by `deltaTime` every frame (after the input), and drop the one-time update at time 0.
- **Hint:** `UpdateAnimation(animator, deltaTime);` in `mainLoop()`, after `processInput()` – learnopengl's `animator.UpdateAnimation(deltaTime)`. `updateUniformBuffer()` copies the new matrices every frame already.
- **When done:** `main.cpp`: `UpdateAnimation(animator, deltaTime);` in `mainLoop()`, no `UpdateAnimation(animator,
  0.0f)` in `initVulkan()`. **The tentacle sways**, one cycle per 2 s. At **1.25 s**: leaning to the right, the tip at the
  top right: tip-right = 121,76,47 (OpenGL 135,85,53 – a dark ring, see above), mid-right = 218,184,175, foot = 51,22,70,
  upper / tip-0 / tip-left = 13,13,13. At **0.25 s**: the mirror image, leaning to the left: tip-left = 156,98,61 (OpenGL
  171,107,67), foot = 59,26,82, upper / tip-0 / tip-right / mid-right = 13,13,13. This is the solution.
