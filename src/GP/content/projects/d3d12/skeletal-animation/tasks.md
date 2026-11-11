# Skeletal Animation – tasks (DirectX 12)

learnopengl "Guest Articles / Skeletal Animation": `src/8.guest/2020/skeletal_animation/skeletal_animation.cpp` with
`anim_model.vs/.fs` and `includes/learnopengl/bone.h`, `animation.h`, `animator.h`, `model_animation.h`, `animdata.h`,
`assimp_glm_helpers.h`, in Direct3D 12 with DirectXMath. Files: `main.cpp` (the course's Direct3D 12 `Mesh` and `Model`
classes of the Model Loading part, grown by the bone data; Bone, Animation and Animator as structs + free functions),
`anim_model.hlsl` (`VSMain` / `PSMain`) and `models/` (the course's tentacle: `tentacle.gltf`, `tentacle.bin`,
`tentacle.png` – see the OpenGL tasks.md; learnopengl uses a dancing vampire from Mixamo).

**Screenshot times: 1.25 s (the main one) and 0.25 s** – the animation plays from the `play` task on; the earlier states
are still (the same picture at both times). Frame n sees the time n / 60 (the course's fixed frame clock: `OnUpdate`'s
`std::chrono` deltaTime is 0 in frame 0 and 1/60 after that), and the animator adds up deltaTime, so at frame 75 the
animation is at 1.25 s = 1250 ticks.

**Fixed choices (the same in every API – see the OpenGL tasks.md):** the tentacle (four bones Base → Lower → Upper →
Tip, ids 0…3; one 2 s animation "Sway", 1000 ticks per second, 5 keys per track), loaded with assimp for the mesh and
again (its own `Assimp::Importer`, `aiProcess_Triangulate`) for the animation; learnopengl's classes as plain structs
and free functions with learnopengl's names (`CreateBone`, `GetPositionIndex` …, `UpdateBone`, `ReadHierarchyData`,
`ReadMissingBones`, `LoadAnimation`, `FindBone`, `InitAnimator`, `CalculateBoneTransform`, `UpdateAnimation`; the
`assert(0)` after the index loops becomes `return count - 2;`); at most 4 bones per vertex (`MAX_BONE_INFLUENCE`),
100 final bone matrices (`MAX_BONES`); the camera globals at (0, 0, 3) looking down -z, fov 45, 800/600, near 0.1, far
100; clear (0.05, 0.05, 0.05), depth test on, no culling; the model matrix learnopengl's `translate(0, -1, 0) *
scale(0.9)`; the pixel shader shows the diffuse texture (no lighting).

**Direct3D 12's choices:**
- **DirectXMath instead of GLM.** Matrices are stored as `XMFLOAT4X4` in structs and vectors (`XMMATRIX` is for
  calculations: it needs 16-byte alignment that `std::vector` and `std::map` do not promise), quaternions as `XMFLOAT4`
  (x, y, z, w – `GetXMQuat` reorders assimp's w-first quaternion), vectors as `XMFLOAT3`. GLM ↔ DirectXMath:
  `glm::mix` → `XMVectorLerp`, `glm::slerp` + `glm::normalize` + `glm::toMat4` → `XMQuaternionSlerp` +
  `XMQuaternionNormalize` + `XMMatrixRotationQuaternion` (both slerps take the shorter way round),
  `glm::translate/scale(mat4(1), v)` → `XMMatrixTranslationFromVector` / `XMMatrixScalingFromVector`.
- **Row vectors: every product is written the other way round.** DirectXMath multiplies a row vector by the matrix on
  its right, so a transformation that GLM writes `A * B` (B first) is `B * A` here: a bone's local transform
  `translation * rotation * scale` → `scale * rotation * translation`; a node's global transform `parentTransform *
  nodeTransform` → `nodeTransform * parentTransform`; a bone's final matrix `globalTransformation * offset` → `offset *
  globalTransformation`; the model matrix → `XMMatrixScaling(0.9) * XMMatrixTranslation(0, -1, 0)`. assimp's matrices
  (row-major, translation in the last column, for column vectors) become DirectXMath's by **transposing** them:
  `ConvertMatrixToXMFormat` (learnopengl's `ConvertMatrixToGLMFormat`, which copies them into GLM's column-major
  storage – the same numbers, read the other way). The results are the same matrices, transposed: checked natively (the
  skinned vertices at frames 0, 37, 60 and 150 land on the same pixels as with the OpenGL project's GLM code).
- **Texture coordinates**: `aiProcess_FlipUVs` (the course's Direct3D 12 Model chapter's): assimp turns glTF's
  coordinates to OpenGL's v-up convention, the flag turns them back, and the image is loaded without a flip – Direct3D's v
  = 0 is the image's top row, so the yellow tip is at the top (OpenGL: no flag, `stbi_set_flip_vertically_on_load(true)`).
  No `aiProcess_ConvertToLeftHanded`: the course's maths is right-handed (`XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH`).
  One mip level (the Model chapter's textures have none either).
- **Bone data in the vertex buffer**: `Vertex` gets `int m_BoneIDs[4]; float m_Weights[4];` (bytes 32 and 48); the input
  layout `BLENDINDICES` = `DXGI_FORMAT_R32G32B32A32_SINT` (read as `int4` – integers stay integers, OpenGL's
  `glVertexAttribIPointer`) and `BLENDWEIGHT` = `DXGI_FORMAT_R32G32B32A32_FLOAT` (`float4`).
- **The bone matrices in the constant buffer**: `SceneConstantBuffer { view; projection; XMFLOAT4X4
  finalBonesMatrices[MAX_BONES]; }` (6,528 bytes, the CBV rounded up to 6,656), filled every frame in `OnUpdate` – the
  matrices transposed like the others (`XMMatrixTranspose`), so the shader's `mul(float4(pos, 1.0f),
  finalBonesMatrices[boneIds[i]])` is DirectXMath's row-vector product. (OpenGL sets 100 uniforms one by one;
  Direct3D 12 copies them all with the one `memcpy`.) The model matrix stays a root constant (root parameter 0), as in the
  Model chapter.
- **Where things run**: the model and the animation are loaded in `LoadAssets` (`m_model`, `m_swayAnimation`,
  `m_animator` are `D3D12App` members); `UpdateAnimation(m_animator, deltaTime)` runs in `OnUpdate` (learnopengl: in the
  render loop after the input), before the constant buffer is filled.

**What the camera sees** (OpenGL's picture, Mesa, 800×600): the tentacle on a dark background, unlit (the texture's
colours), the suckers facing the camera. Named points: **upper** (400,200), **tip-0** (280,100), **tip-left** (230,100),
**tip-right** (568,100), **mid-right** (460,300), **foot** (400,520), **background** (100,300); background = 13,13,13.

**Start picture** (the rest pose: the bones are not used yet): a straight tentacle in the middle: upper = 82,42,36,
tip-0 / tip-left / tip-right / mid-right = background, foot = 204,176,179 (a sucker), background = 13,13,13; spans
y100: 380..419, y200: 372..427, y300: 365..434, y400: 358..441, y500: 351..448.

## `bone-weights`
- **Task:** Give every vertex the bones that move it: `Vertex` gets the ids of up to four bones and their weights (input elements `BLENDINDICES` and `BLENDWEIGHT`), and `Model` reads them from assimp – a `BoneInfo` (id + offset matrix) per bone name in `m_BoneInfoMap`, filled by `ExtractBoneWeightForVertices`, which walks each `aiBone`'s weights and puts them into the vertices with `SetVertexBoneData`.
- **Hint:** `{ "BLENDINDICES", 0, DXGI_FORMAT_R32G32B32A32_SINT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }` and `{ "BLENDWEIGHT", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 0, 48, … }`. Start every vertex with ids -1 and weights 0 (`SetVertexBoneDataToDefault`); a bone's offset matrix is `ConvertMatrixToXMFormat(mesh->mBones[boneIndex]->mOffsetMatrix)`, its weights `mesh->mBones[boneIndex]->mWeights[k]` (`mVertexId`, `mWeight`).
- **When done:** `main.cpp`: `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];` in `Vertex`;
  `struct BoneInfo { int id; XMFLOAT4X4 offset; };`; in `Model` `GetBoneInfoMap()`, `GetBoneCount()`, `std::map<std::string,
  BoneInfo> m_BoneInfoMap; int m_BoneCounter = 0;`, `SetVertexBoneDataToDefault(vertex)` in the vertex loop,
  `SetVertexBoneData`, `ExtractBoneWeightForVertices(vertices, mesh, scene)` in `processMesh`; the two input elements.
  The shader does not use them yet: **no visible change** (the start picture).

## `bone`
- **Task:** Write the Bone: the keyframes of one animation channel (`KeyPosition`, `KeyRotation`, `KeyScale` with their time stamps), read from an `aiNodeAnim` by `CreateBone`, and `UpdateBone`, which finds the two keys around a time, interpolates between them – `XMVectorLerp` for positions and scales, `XMQuaternionSlerp` for the rotations – and stores the bone's local transform: scale, then rotation, then translation (`scale * rotation * translation` with DirectXMath's row vectors – learnopengl's `translation * rotation * scale`).
- **Hint:** `GetPositionIndex` returns the first index whose *next* key is later than the time; `GetScaleFactor(last, next, time) = (time - last) / (next - last)`. A track with one key is that key's value. `XMMatrixTranslationFromVector(XMLoadFloat3(&…position))`, `XMMatrixRotationQuaternion(XMQuaternionNormalize(…))`, `XMMatrixScalingFromVector(…)`; store the result with `XMStoreFloat4x4(&bone.m_LocalTransform, …)`.
- **When done:** `main.cpp`: `struct KeyPosition` (`XMFLOAT3`), `KeyRotation` (`XMFLOAT4`), `KeyScale`, `struct Bone`
  (`XMFLOAT4X4 m_LocalTransform`), `CreateBone`, `GetPositionIndex`, `GetRotationIndex`, `GetScaleIndex`,
  `GetScaleFactor`, `InterpolatePosition`, `InterpolateRotation` (`XMQuaternionSlerp`), `InterpolateScaling`,
  `UpdateBone`. Nothing calls them yet: **no visible change**.

## `animation`
- **Task:** Write the Animation: load the file's first animation with assimp (`LoadAnimation`): its duration and ticks per second, a copy of the node tree (`ReadHierarchyData` into `AssimpNodeData`), and one `Bone` per channel (`ReadMissingBones`, which also gives a bone that no vertex uses an id); `FindBone` looks a bone up by name. Load the tentacle's animation in `LoadAssets`, after the model.
- **Hint:** `const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);`, `scene->mAnimations[0]`: `mDuration`, `mTicksPerSecond`, `mNumChannels`, `mChannels[i]->mNodeName`. `ReadHierarchyData` is recursive: name, `ConvertMatrixToXMFormat(src->mTransformation)`, then each child. A member `Animation m_swayAnimation;` and `LoadAnimation(m_swayAnimation, "models/tentacle.gltf", m_model);`.
- **When done:** `main.cpp`: `struct AssimpNodeData` (`XMFLOAT4X4 transformation`), `struct Animation`,
  `ReadHierarchyData`, `ReadMissingBones`, `LoadAnimation` (throws when there is no animation), `FindBone`; the member
  `m_swayAnimation` and the `LoadAnimation` call. The animation is loaded (duration 2000 ticks, 1000 ticks per second, 4
  bones) but not played: **no visible change**.

## `animator`
- **Task:** Write the Animator: it holds the 100 final bone matrices and the animation's current time. `CalculateBoneTransform` walks the node tree from the root – a node's global transform is its own (the bone's interpolated local transform when the node is animated) followed by its parent's (`nodeTransform * parentTransform`) – and stores `offset * globalTransformation` as each bone's final matrix; `UpdateAnimation` advances the time (in ticks, looping) and recalculates. Create an animator for the sway animation and, for now, calculate the bones once at time 0.
- **Hint:** `InitAnimator` fills `m_FinalBoneMatrices` (`std::vector<XMFLOAT4X4>`) with 100 identities. `m_CurrentTime += m_TicksPerSecond * dt; m_CurrentTime = fmod(m_CurrentTime, m_Duration);`, then `CalculateBoneTransform(animator, &animation->m_RootNode, XMMatrixIdentity())`. The bone's id and offset come from `m_BoneInfoMap[nodeName]`. In `LoadAssets`: `InitAnimator(m_animator, &m_swayAnimation); UpdateAnimation(m_animator, 0.0f);`.
- **When done:** `main.cpp`: `struct Animator`, `InitAnimator`, `CalculateBoneTransform` (`const XMMATRIX&
  parentTransform`), `UpdateAnimation`; the member `Animator m_animator;`, `InitAnimator` and `UpdateAnimation(m_animator,
  0.0f)` in `LoadAssets`. The matrices exist but the shader does not use them: **no visible change**.

## `skinning`
- **Task:** Skin the mesh in the vertex shader: take the bone ids (`int4 boneIds : BLENDINDICES`) and weights (`float4 weights : BLENDWEIGHT`), and move each vertex to the weighted sum of where each of its bones puts it (skipping ids of -1). Put the animator's 100 matrices into the constant buffer every frame.
- **Hint:** HLSL: `static const int MAX_BONES = 100; static const int MAX_BONE_INFLUENCE = 4;`, `float4x4 finalBonesMatrices[MAX_BONES];` in `SceneConstantBuffer`, `float4 localPosition = mul(float4(pos, 1.0f), finalBonesMatrices[boneIds[i]]); totalPosition += localPosition * weights[i];`. C++: `const int MAX_BONES = 100;`, `XMFLOAT4X4 finalBonesMatrices[MAX_BONES];` in `SceneConstantBuffer`, and in `OnUpdate` `XMStoreFloat4x4(&constantBufferData.finalBonesMatrices[i], XMMatrixTranspose(XMLoadFloat4x4(&m_animator.m_FinalBoneMatrices[i])));` for every i.
- **When done:** `anim_model.hlsl`: `MAX_BONES`, `MAX_BONE_INFLUENCE`, `finalBonesMatrices[MAX_BONES]`, the `BLENDINDICES`
  / `BLENDWEIGHT` inputs, learnopengl's loop (`continue` for -1, `totalPosition = float4(pos, 1.0f); break;` for an id
  ≥ MAX_BONES). `main.cpp`: `MAX_BONES`, the constant buffer field, the copy loop. The tentacle takes **the animation's
  first pose** (time 0, standing still): its foot in place, the middle bent to the right, the upper part curving back to
  the left, the tip at the top left: upper = 13,13,13 (background), tip-0 = 198,140,83, tip-left = 13,13,13, tip-right
  = 13,13,13, mid-right = 13,13,13, foot = 204,176,179, background = 13,13,13; spans y100: 269..291, y200: 246..297,
  y300: 263..340, y400: 310..405, y500: 348..445. The same at 0.25 s and 1.25 s.

## `play`
- **Task:** Play the animation: advance it by `deltaTime` every frame in `OnUpdate` (after the input, before the constant buffer is filled), and drop the one-time update at time 0.
- **Hint:** `UpdateAnimation(m_animator, deltaTime);` – learnopengl's `animator.UpdateAnimation(deltaTime)`.
- **When done:** `main.cpp`: `UpdateAnimation(m_animator, deltaTime);` in `OnUpdate`, no `UpdateAnimation(m_animator,
  0.0f)` in `LoadAssets`. **The tentacle sways** (a wave runs up it, the base turns and bobs, the tip swells), one cycle
  per 2 s. At **1.25 s** (1250 ticks): leaning to the right, the tip at the top right: upper = 13,13,13, tip-0 =
  13,13,13, tip-left = 13,13,13, tip-right = 135,85,53, mid-right = 218,184,175, foot = 51,22,71, background = 13,13,13;
  spans y100: 542..593, y200: 487..557, y300: 418..503, y400: 372..459, y500: 349..445. At **0.25 s** (250 ticks): the
  mirror image, leaning to the left: tip-left = 171,107,67, tip-right = 13,13,13, mid-right = 13,13,13, foot =
  59,26,82; spans y100: 206..257, y200: 242..312, y300: 296..381, y400: 340..427, y500: 354..450. This is the solution.
  (OpenGL's values; the texture has no mipmaps here, so single pixels on the stripes may differ by a few levels.)

*Simulator:* no state shows the tentacle yet: the simulator does not load glTF files ("modelFileMissing" – the Model
reader knows `.obj`), so `m_model.Load("models/tentacle.gltf", …)` draws nothing, and assimp's bones and animations
(`aiMesh::mBones`, `aiAnimation`, `aiNodeAnim`, `mTicksPerSecond`), `int4` / `BLENDINDICES` vertex input, the 100
matrices in the constant buffer and `XMQuaternionSlerp` are untested (see the D3D12 writer's report).
