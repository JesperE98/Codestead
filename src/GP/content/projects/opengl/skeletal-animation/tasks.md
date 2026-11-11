# Skeletal Animation – tasks (OpenGL)

learnopengl "Guest Articles / Skeletal Animation": `src/8.guest/2020/skeletal_animation/skeletal_animation.cpp` with
`anim_model.vs/.fs` and `includes/learnopengl/bone.h`, `animation.h`, `animator.h`, `model_animation.h`, `animdata.h`,
`assimp_glm_helpers.h`. Files: `main.cpp` (Bone, Animation and Animator as structs + free functions), `shader_m.h`,
`mesh.h` and `model.h` (the Model Loading part's, grown by the bone data as in learnopengl's `model_animation.h`),
`assimp_glm_helpers.h` (learnopengl's three conversions as free `inline` functions), `anim_model.vs/.fs` and `models/`
(the course's tentacle, see below – learnopengl uses a dancing vampire from Mixamo).

**Screenshot times: 1.25 s (the main one) and 0.25 s** – the animation plays from the `play` task on; the earlier
states are still (the same picture at both times). The time is the fixed frame clock of the course (frame n sees
`glfwGetTime()` = n / 60; verify.sh: `VERIFY_FIXEDTIME=1 VERIFY_T=1.25`); the animator adds up learnopengl's
`deltaTime` (1/60 per frame), so at frame 75 the animation is at 75 × 1/60 s = 1.25 s = 1250 ticks.

**OpenGL 3.3 core**, like learnopengl's demo.

**Fixed choices (the same in every API):**
- **The model**: `src/GP/content/models/tentacle.gltf` + `tentacle.bin` + `tentacle.png` (glTF 2.0, drawn by
  `make_tentacle.py`), copied into `models/` (all APIs: `models/tentacle.gltf` …). A tapered tube 2.2 tall with a
  rounded tip, its foot at the origin, +y up: 495 vertices, 928 triangles, one material whose base colour texture is
  `tentacle.png` (purple at the foot to orange and yellow at the tip, eight stripes around, dark rings, a row of pale
  suckers on the side facing +z). **Four bones** in a chain: `Base` (y 0) → `Lower` (y 0.55) → `Upper` (y 1.1) → `Tip`
  (y 1.65); each vertex has at most two bones (weights sum to 1). The node tree: `Tentacle` (root) with the children
  `TentacleMesh` (the mesh) and `Base` → `Lower` → `Upper` → `Tip`; every node's own transform is a translation (the
  bones' rest positions), the root's and the mesh's are identities. **One animation**, `Sway`: 2 s, keys at 0, 0.5,
  1.0, 1.5, 2.0 s (the last = the first, so it loops), linear; every bone has a position, a rotation and a scale track
  with those 5 keys (a wave of rotations about z runs up the tentacle; `Base` also turns about y by ±25° and bobs up by
  0.12 at 0.5 s and 1.5 s; `Tip` swells to 1.35× at 0.5 s and 1.5 s). The pose at time 0 is bent (the rest pose is
  straight).
- **What assimp 5 makes of it** (what the simulator must reproduce): `aiAnimation::mTicksPerSecond = 1000`,
  `mDuration = 2000`, key times 0, 500, 1000, 1500, 2000 (glTF's seconds in milliseconds); `aiMesh::mBones` in the skin's
  joint order Base, Lower, Upper, Tip (so `ExtractBoneWeightForVertices` gives them the ids **0, 1, 2, 3**; the channels
  of `mAnimations[0]` come in the order Tip, Upper, Lower, Base – no new ids in `ReadMissingBones`);
  `aiBone::mOffsetMatrix` = the glTF inverse bind matrix = translate(0, -y_bone, 0); the node tree as above; glTF's
  texture coordinates turned to v-up by assimp (v = 0 at the foot).
- **Loading** (learnopengl's): `Model ourModel("models/tentacle.gltf");` with learnopengl's `model_animation.h` flags
  `aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_CalcTangentSpace` (**no** `aiProcess_FlipUVs` – the
  Model Loading chapters' OBJ needed it; assimp already turns glTF's texture coordinates to OpenGL's convention) and
  `stbi_set_flip_vertically_on_load(true)` in main: the texture is upright (the yellow tip at the top). The animation:
  `LoadAnimation(swayAnimation, "models/tentacle.gltf", ourModel)` (learnopengl: `Animation danceAnimation(path,
  &ourModel)`, its own `Assimp::Importer` with `aiProcess_Triangulate`). Vulkan/D3D12 load the glTF with assimp too
  (the same file for the mesh and the animation); D3D12 without `aiProcess_ConvertToLeftHanded` (the RH maths of the
  course), texture coordinates as their textures chapter needs them (v = 0 at the image's top: the tip at the top).
- **Plain structs and free functions** instead of learnopengl's classes (the simulator follows those; a real project
  would keep the classes): `KeyPosition / KeyRotation / KeyScale`, `struct Bone { m_Positions, m_Rotations, m_Scales,
  m_NumPositions, m_NumRotations, m_NumScalings, m_LocalTransform, m_Name, m_ID }` with `Bone CreateBone(const
  std::string& name, int ID, const aiNodeAnim* channel)`, `int GetPositionIndex / GetRotationIndex / GetScaleIndex(const
  Bone&, float animationTime)` (learnopengl's `assert(0)` after the loop – the function would end without returning –
  becomes `return count - 2;`), `float GetScaleFactor(float lastTimeStamp, float nextTimeStamp, float animationTime)`,
  `glm::mat4 InterpolatePosition / InterpolateRotation / InterpolateScaling(const Bone&, float)` (`glm::mix`,
  `glm::slerp` + `glm::normalize` + `glm::toMat4`), `void UpdateBone(Bone&, float)` (`translation * rotation * scale`);
  `struct AssimpNodeData { glm::mat4 transformation; std::string name; int childrenCount; std::vector<AssimpNodeData>
  children; }`, `struct Animation { float m_Duration; int m_TicksPerSecond; std::vector<Bone> m_Bones; AssimpNodeData
  m_RootNode; std::map<std::string, BoneInfo> m_BoneInfoMap; }` with `void ReadHierarchyData(AssimpNodeData&, const
  aiNode*)`, `void ReadMissingBones(Animation&, const aiAnimation*, Model&)`, `void LoadAnimation(Animation&, const
  std::string&, Model&)`, `Bone* FindBone(Animation&, const std::string&)` (a range-for instead of learnopengl's
  `std::find_if` with a lambda); `struct Animator { std::vector<glm::mat4> m_FinalBoneMatrices; Animation*
  m_CurrentAnimation; float m_CurrentTime; float m_DeltaTime; }` with `void InitAnimator(Animator&, Animation*)` (100
  identity matrices), `void CalculateBoneTransform(Animator&, const AssimpNodeData* node, glm::mat4 parentTransform)`
  (recursive: `globalTransformation = parentTransform * nodeTransform`, `m_FinalBoneMatrices[id] =
  globalTransformation * offset`), `void UpdateAnimation(Animator&, float dt)` (`m_CurrentTime += m_TicksPerSecond * dt`,
  `fmod(…, m_Duration)`, then CalculateBoneTransform from the root). learnopengl's Animation constructor also computes
  an unused inverse of the root transform: left out.
- **Model / mesh** (learnopengl's `model_animation.h` / `mesh.h`, kept as the classes of the Model Loading part):
  `struct BoneInfo { int id; glm::mat4 offset; };` in `model.h`; `Vertex` gets `int m_BoneIDs[MAX_BONE_INFLUENCE];
  float m_Weights[MAX_BONE_INFLUENCE];` (`#define MAX_BONE_INFLUENCE 4`); **attribute 3 = the bone ids
  (`glVertexAttribIPointer(3, 4, GL_INT, …)`, `ivec4` in the shader), attribute 4 = the weights** (learnopengl: 5 and
  6, after its tangent and bitangent – the course's Vertex has none, so the next free locations). `Model` gets
  `m_BoneInfoMap`, `m_BoneCounter`, `GetBoneInfoMap()`, `GetBoneCount()`, `SetVertexBoneDataToDefault` (ids -1, weights
  0), `SetVertexBoneData` (the first free slot), `ExtractBoneWeightForVertices` (called in processMesh). Vulkan: the ids
  as `VK_FORMAT_R32G32B32A32_SINT` / `ivec4`; D3D12: `BLENDINDICES` (`DXGI_FORMAT_R32G32B32A32_SINT`, `int4`) and
  `BLENDWEIGHT` (`R32G32B32A32_FLOAT`).
- **Skinning** (`anim_model.vs`, learnopengl's): `uniform mat4 finalBonesMatrices[100];` (`MAX_BONES = 100`,
  `MAX_BONE_INFLUENCE = 4`), `totalPosition += finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0) * weights[i]` skipping
  ids of -1, then `projection * view * model * totalPosition`; learnopengl's unused `localNormal` is left out. The
  fragment shader shows `texture_diffuse1` (no lighting, learnopengl's). The 100 matrices are set every frame with
  `ourShader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i])`. Vulkan: the 100 matrices in a
  uniform buffer (6,400 bytes) updated every frame; D3D12: a constant buffer with `float4x4 finalBonesMatrices[100]`
  (transposed like the other matrices).
- **Scene**: learnopengl's camera **(0, 0, 3)** looking down -z (the camera globals, yaw -90, pitch 0, fov 45, 800/600,
  near 0.1, far 100), clear **(0.05, 0.05, 0.05)**, depth test on. **Model matrix: `translate(0, -1.0, 0) * scale(0.9)`**
  (learnopengl: translate(0, -0.4, 0) * scale(0.5) for its vampire) – the tentacle stands in the middle of the window,
  its foot at y ≈ 550, its tip at y ≈ 65 at rest.

**What the camera sees** (Mesa, 800×600): the tentacle on a dark background, unlit (the texture's colours), the
suckers facing the camera. Named points: **upper** (400,200) (the tube at rest), **tip-0** (280,100) (the tip in the
time-0 pose), **tip-left** (230,100) (the tip at 0.25 s), **tip-right** (568,100) (the tip at 1.25 s), **mid-right**
(460,300) (the middle at 1.25 s), **foot** (400,520) (always on the tube near the foot), **background** (100,300). The
background is 13,13,13 (0.05 in sRGB-less 8 bit). Spans: the tentacle's x-range on rows 100 / 200 / 300 / 400 / 500.

**Start picture** (the rest pose: the bones are not used yet): a straight tentacle in the middle: upper = 82,42,36,
tip-0 / tip-left / tip-right / mid-right = background, foot = 204,176,179 (a sucker), background = 13,13,13; spans
y100: 380..419, y200: 372..427, y300: 365..434, y400: 358..441, y500: 351..448; 34,478 non-background pixels, rows
64..559.

## `bone-weights`
- **Task:** Give every vertex the bones that move it: `Vertex` gets the ids of up to four bones and their weights (as attributes 3 and 4), and `Model` reads them from assimp – a `BoneInfo` (id + offset matrix) per bone name in `m_BoneInfoMap`, filled by `ExtractBoneWeightForVertices`, which walks each `aiBone`'s weights and puts them into the vertices with `SetVertexBoneData`.
- **Hint:** The ids are integers: `glVertexAttribIPointer(3, 4, GL_INT, sizeof(Vertex), (void*)offsetof(Vertex, m_BoneIDs));` (no "normalized" parameter). Start every vertex with ids -1 and weights 0 (`SetVertexBoneDataToDefault`); a bone's offset matrix is `ConvertMatrixToGLMFormat(mesh->mBones[boneIndex]->mOffsetMatrix)`, and its weights are `mesh->mBones[boneIndex]->mWeights[k]` (`mVertexId`, `mWeight`).
- **When done:** `mesh.h`: `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];` in `Vertex`;
  `glEnableVertexAttribArray(3)` + `glVertexAttribIPointer(3, 4, GL_INT, …, offsetof(Vertex, m_BoneIDs))`,
  `glEnableVertexAttribArray(4)` + `glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, …, offsetof(Vertex, m_Weights))`.
  `model.h`: `struct BoneInfo { int id; glm::mat4 offset; };`, `std::map<std::string, BoneInfo> m_BoneInfoMap; int
  m_BoneCounter = 0;`, `GetBoneInfoMap()`, `GetBoneCount()`, `SetVertexBoneDataToDefault(vertex)` in the vertex loop,
  `SetVertexBoneData`, `ExtractBoneWeightForVertices(vertices, mesh, scene)` before `return Mesh(…)`. The shader does not
  use them yet: **no visible change** (the start picture).

## `bone`
- **Task:** Write the Bone: the keyframes of one animation channel (`KeyPosition`, `KeyRotation`, `KeyScale` with their time stamps), read from an `aiNodeAnim` by `CreateBone`, and `UpdateBone`, which finds the two keys around a time, interpolates between them – `glm::mix` for positions and scales, `glm::slerp` for the rotations – and stores `translation * rotation * scale` as the bone's local transform.
- **Hint:** `GetPositionIndex` returns the first index whose *next* key is later than the time; `GetScaleFactor(last, next, time) = (time - last) / (next - last)`. A track with one key is that key's value. Quaternions from assimp: `glm::quat(w, x, y, z)` (`GetGLMQuat`); `glm::toMat4` needs `#define GLM_ENABLE_EXPERIMENTAL` and `<glm/gtx/quaternion.hpp>`.
- **When done:** `main.cpp`: `struct KeyPosition`, `KeyRotation`, `KeyScale`, `struct Bone`, `CreateBone`,
  `GetPositionIndex`, `GetRotationIndex`, `GetScaleIndex`, `GetScaleFactor`, `InterpolatePosition`,
  `InterpolateRotation` (`glm::slerp`, `glm::normalize`, `glm::toMat4`), `InterpolateScaling`, `UpdateBone`. Nothing
  calls them yet: **no visible change**.

## `animation`
- **Task:** Write the Animation: load the file's first animation with assimp (`LoadAnimation`): its duration and ticks per second, a copy of the node tree (`ReadHierarchyData` into `AssimpNodeData`), and one `Bone` per channel (`ReadMissingBones`, which also gives a bone that no vertex uses an id); `FindBone` looks a bone up by name. Load the tentacle's animation after the model.
- **Hint:** `const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);`, `scene->mAnimations[0]`: `mDuration`, `mTicksPerSecond`, `mNumChannels`, `mChannels[i]->mNodeName`. `ReadHierarchyData` is recursive: name, `ConvertMatrixToGLMFormat(src->mTransformation)`, then each child. In main: `Animation swayAnimation; LoadAnimation(swayAnimation, "models/tentacle.gltf", ourModel);`.
- **When done:** `main.cpp`: `struct AssimpNodeData`, `struct Animation`, `ReadHierarchyData`, `ReadMissingBones`,
  `LoadAnimation`, `FindBone`; in main `Animation swayAnimation; LoadAnimation(swayAnimation, "models/tentacle.gltf",
  ourModel);`. The animation is loaded (duration 2000 ticks, 1000 ticks per second, 4 bones) but not played: **no
  visible change**.

## `animator`
- **Task:** Write the Animator: it holds the 100 final bone matrices and the animation's current time. `CalculateBoneTransform` walks the node tree from the root – a node's global transform is its parent's times its own (the bone's interpolated local transform when the node is animated) – and stores `global * offset` as each bone's final matrix; `UpdateAnimation` advances the time (in ticks, looping) and recalculates. Create an animator for the sway animation and, for now, calculate the bones once at time 0.
- **Hint:** `InitAnimator` fills `m_FinalBoneMatrices` with 100 `glm::mat4(1.0f)`. `m_CurrentTime += m_TicksPerSecond * dt; m_CurrentTime = fmod(m_CurrentTime, m_Duration);`, then `CalculateBoneTransform(animator, &animation->m_RootNode, glm::mat4(1.0f))`. The bone's id and offset come from `m_BoneInfoMap[nodeName]`. After creating it: `UpdateAnimation(animator, 0.0f);`.
- **When done:** `main.cpp`: `struct Animator`, `InitAnimator`, `CalculateBoneTransform`, `UpdateAnimation`; in main
  `Animator animator; InitAnimator(animator, &swayAnimation); UpdateAnimation(animator, 0.0f);` before the loop. The
  matrices exist but the shader does not use them: **no visible change**.

## `skinning`
- **Task:** Skin the mesh in the vertex shader: take the bone ids (`ivec4`, location 3) and weights (location 4), and move each vertex to the weighted sum of `finalBonesMatrices[boneId] * position` over its bones (skipping ids of -1). Upload the animator's 100 matrices every frame.
- **Hint:** `uniform mat4 finalBonesMatrices[MAX_BONES];` with `const int MAX_BONES = 100;`. In the loop: `auto transforms = animator.m_FinalBoneMatrices;` and `ourShader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i]);` for every i.
- **When done:** `anim_model.vs`: `layout (location = 3) in ivec4 boneIds; layout (location = 4) in vec4 weights;`,
  `MAX_BONES`, `MAX_BONE_INFLUENCE`, `uniform mat4 finalBonesMatrices[MAX_BONES];`, learnopengl's loop (`continue` for -1,
  `totalPosition = vec4(pos, 1.0); break;` for an id ≥ MAX_BONES). `main.cpp`: the `setMat4("finalBonesMatrices[…]")`
  loop. The tentacle takes **the animation's first pose** (time 0, standing still): its foot in place, the middle bent
  to the right, the upper part curving back to the left, the tip at the top left: upper = 13,13,13 (background),
  tip-0 = 198,140,83, tip-left = 13,13,13, tip-right = 13,13,13, mid-right = 13,13,13, foot = 204,176,179, background =
  13,13,13; spans y100: 269..291, y200: 246..297, y300: 263..340, y400: 310..405, y500: 348..445; 34,320 pixels, rows
  90..563. The same at 0.25 s and 1.25 s.

## `play`
- **Task:** Play the animation: advance it by `deltaTime` every frame (after the input), and drop the one-time update at time 0.
- **Hint:** `UpdateAnimation(animator, deltaTime);` in the render loop – learnopengl's `animator.UpdateAnimation(deltaTime)`.
- **When done:** `main.cpp`: `UpdateAnimation(animator, deltaTime);` in the loop, no `UpdateAnimation(animator, 0.0f)`
  before it. **The tentacle sways** (a wave runs up it, the base turns and bobs, the tip swells), one cycle per 2 s.
  At **1.25 s** (1250 ticks, between the keys at 1000 and 1500): leaning to the right, the tip at the top right, the
  base bobbed up a little: upper = 13,13,13, tip-0 = 13,13,13, tip-left = 13,13,13, tip-right = 135,85,53, mid-right =
  218,184,175, foot = 51,22,71, background = 13,13,13; spans y100: 542..593, y200: 487..557, y300: 418..503, y400:
  372..459, y500: 349..445; 37,747 pixels, rows 60..547. At **0.25 s** (250 ticks): the mirror image, leaning to the
  left: upper = 13,13,13, tip-0 = 13,13,13, tip-left = 171,107,67, tip-right = 13,13,13, mid-right = 13,13,13, foot =
  59,26,82, background = 13,13,13; spans y100: 206..257, y200: 242..312, y300: 296..381, y400: 340..427, y500: 354..450;
  37,747 pixels, rows 60..547. This is the solution.
