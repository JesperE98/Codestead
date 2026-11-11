# Review: Guest Articles

Congratulations on reaching the end of the *Guest Articles* part – and of the course. The part followed the articles
guest authors wrote for learnopengl.com between 2020 and 2022, each on a technique of its own: transparency that doesn't
depend on the drawing order, a tentacle animated by its bones, a scene graph and the frustum culling built on it,
cascaded shadow maps for a large view, a landscape from a height map – first as one dense mesh, then tessellated on the
GPU –, OpenGL's direct state access, a bloom made from a chain of ever smaller textures, compute shaders, and lights
with an area. This page is a glossary of the most important terms of the part, chapter by chapter, like the reviews
learnopengl.com has at the end of its sections. Use it to look things up, and as a check: if a definition surprises
you, go back to the chapter it comes from.

Most of these techniques are ways of organising passes, buffers and shaders, and CPU code such as the scene graph, the
animator and the culling – the same in every API, so most of this page is outside the boxes. What differs is how {{api}}
switches the optional parts of the GPU on, renders into several or ever smaller targets, and makes one pass wait for
another. OpenGL asks for a context version (4.0 for tessellation and geometry shader instancing, 4.3 for compute, 4.5 for
DSA) and works out most dependencies itself, with `glMemoryBarrier` as the exception. Vulkan enables device features
(`independentBlend`, `tessellationShader`, `geometryShader`, `fillModeNonSolid`), bakes blending, topology and the
tessellation state into pipelines, and has render passes, layouts and barriers say who waits for whom. Direct3D 12 has
all of these stages on every device, switches them on in the pipeline state (`IndependentBlendEnable`, `HS` / `DS` / `GS`,
the `PATCH` topology type) and changes resource states with barriers. When you're done, the exam at the end of the part
checks what you've learned.

## OIT: Introduction

- **The over operator**: `C = Cs · αs + Cd · (1 − αs)` – ordinary alpha blending. Right for one layer over an opaque
  background; for several layers only when they arrive **back to front**, because it is not commutative: the layer
  blended last counts most.
- **Depth writes and transparency**: a transparent object that writes its depth hides everything behind it, as if it
  were opaque (the blue quad's missing corner). Without depth writes the blending order is the drawing order – still
  wrong, just less obviously.
- **Sorting** per object by its distance – the *Blending* chapter's answer – fails where objects **intersect**, overlap
  **cyclically**, **overlap themselves** (one mesh, one draw call), or where centres are in one order and fragments in
  the other; and it costs CPU time every frame.
- **Order-independent transparency (OIT)**: the result of back-to-front blending (or close to it) whatever the order of
  the draws. The families:
  - **Depth peeling** (Everitt, 2001): one pass per layer, each keeping the nearest fragment behind the previous layer;
    exact, but a pass over all transparent geometry per layer (*dual depth peeling* halves them).
  - **A-buffer / per-pixel linked lists**: every transparent fragment stored with its depth (atomic counter, atomic
    exchange on a per-pixel head image), then each pixel's list sorted and blended in a full-screen pass; exact in one
    geometry pass, but memory grows with the fragments (*k-buffers* keep only the k nearest).
  - **Weighted blended OIT** (McGuire and Bavoil, 2013): sums and products instead of the over operator – an
    approximation with a fixed amount of memory and no sorting.
  - **Moment-based OIT** and **stochastic transparency**: approximations of the per-pixel transmittance between the two.

## OIT: Weighted Blended

- **Revealage**: `(1 − α1) · (1 − α2) · … · (1 − αn)`, how much of the background shows through – exact and independent
  of the order (a product).
- **Weighted average**: `Σ Ci · αi · wi / Σ αi · wi`, blended over the background with the coverage `1 − revealage`. What
  it loses is the occlusion *between* the transparent layers.
- **The weight** `w = clamp(pow(min(1.0, α · 10) + 0.01, 3) · 1e8 · pow(1 − z · 0.9, 3), 1e-2, 3e3)` with z the window
  depth: nearer and more opaque fragments count more; the clamp keeps 16-bit floats from overflowing too quickly. Near
  the camera both quads hit the clamp at 3000 and count equally – the (0, 96, 96) where they overlap.
- **Two render targets**: **accumulation** (RGBA 16-bit float, cleared to 0, blend `ONE, ONE`: `(C · α, α) · w` added up)
  and **revealage** (one 8-bit channel, cleared to 1, blend `ZERO, ONE_MINUS_SRC_COLOR`: multiplied by `1 − α`). The one
  requirement on the hardware: **different blend functions per target** in one draw.
- **The four passes**: solid pass into an off-screen opaque target with depth; transparent pass into the two targets,
  depth test on against the opaque depth, **depth writes off**; composite pass – a full-screen quad, `texelFetch` of the
  same pixel, `discard` where revealage is 1, an `isinf` guard, the average with alpha `1 − revealage`, ordinary alpha
  blending, the depth test always passing; final pass to the window.
- **What it gets wrong**: the nearest layer doesn't dominate, strongly opaque layers look washed out, many layers lose
  precision, no coloured transmission or refraction. Only the order *among* transparent objects stops mattering.

:::opengl
- **OpenGL 4.2 core**: `glBlendFunci(buf, src, dst)` (core since 4.0) for a blend function per draw buffer, and
  `layout (binding = N)` on samplers (4.2). macOS (4.1) would set the units with `setInt` instead.
- **Clearing per target**: `glClearBufferfv(GL_COLOR, i, value)` – `glClear` would clear both to one `glClearColor`.
- The depth is a **texture** (`depthTexture`) so the transparent framebuffer can attach the same one; the composite pass
  uses `glDepthFunc(GL_ALWAYS)`; `glDepthMask(GL_TRUE)` before the next frame's `glClear`, which respects the mask.
:::
:::vulkan
- **`independentBlend`**: by default all `VkPipelineColorBlendAttachmentState`s of a pipeline must be identical; the
  device feature allows different ones – checked in `isDeviceSuitable` and enabled at device creation.
- **Render passes instead of framebuffers**: the opaque pass stores its colour and depth; the transparent pass **loads**
  the opaque depth (its clear value ignored, but present – clear values are indexed by attachment); the composite pass
  loads the opaque colour and has no depth attachment at all (`glDepthFunc(GL_ALWAYS)` becomes no depth test). Subpass
  dependencies and final layouts (`COLOR_ATTACHMENT_OPTIMAL`, `SHADER_READ_ONLY_OPTIMAL`) order the passes.
:::
:::d3d12
- **`IndependentBlendEnable = TRUE`**: without it `BlendState.RenderTarget[0]` applies to every target.
- **Two targets from one pixel shader**: a returned struct with `SV_TARGET0` and `SV_TARGET1`; both RTVs bound at once
  with the opaque depth buffer, each cleared to its own value; `D3D12_DEPTH_WRITE_MASK_ZERO` for the transparent pass,
  `D3D12_COMPARISON_FUNC_ALWAYS` for the composite. `texelFetch` is `Texture2D.Load(int3(x, y, mip))`.
- Every off-screen texture rests in `PIXEL_SHADER_RESOURCE` and becomes a `RENDER_TARGET` by a barrier for its pass.
:::

## Skeletal Animation

- **Skeletal animation and skinning**: a mesh with a **skeleton** – a tree of **bones** – and every vertex attached to a
  few bones with **weights**. An animation stores the bones' transforms over time, not the vertices; the vertex shader
  moves each vertex by its bones. *Vertex animation* stores every vertex per key instead – exact, but heavy, and not
  reusable.
- **The course's model**: a tentacle in glTF 2.0 with four bones in a chain (`Base`, `Lower`, `Upper`, `Tip`), at most two
  bones per vertex, and one 2-second looping animation, `Sway`.
- **Bind pose and offset matrix**: the mesh is modelled in the bind (rest) pose; the **offset matrix** (inverse bind
  matrix) takes a vertex into its bone's space. A bone's final matrix is `globalTransform · offset` – the identity in the
  bind pose.
- **Linear blend skinning**: `Σ weight_i · finalBonesMatrices[boneId_i] · position` over up to four bones
  (`MAX_BONE_INFLUENCE = 4`), ids of −1 skipped; the weights sum to 1, so the mesh bends smoothly at the joints.
- **Keyframes**: three tracks per bone – positions and scales interpolated with `mix`, rotations as **quaternions** with
  **slerp** (shortest arc, constant angular speed; Euler angles and lerped matrices give wrong paths or shear). The two
  keys around a time and the fraction `(time − last) / (next − last)`; the local transform `translation · rotation · scale`.
- **Ticks**: `mTicksPerSecond` (1000 for the glTF file) and `mDuration` (2000); `time += ticksPerSecond · dt`, wrapped
  with `fmod(time, duration)`.
- **assimp's data**: per `aiBone` a name, `mOffsetMatrix` and `mWeights` (`mVertexId`, `mWeight`) – turned around into
  per-vertex ids and weights by `ExtractBoneWeightForVertices`; ids in the order the bones are first seen, kept in
  `m_BoneInfoMap` (`BoneInfo { id; offset; }`). `ReadMissingBones` gives animated bones that no vertex uses an id.
- **Bone, Animation, Animator**: `CreateBone` / `UpdateBone`; `LoadAnimation` (duration, ticks, a copy of the **node
  tree** with `ReadHierarchyData`, one bone per channel); `CalculateBoneTransform` walks the tree like the scene graph's
  update, and `UpdateAnimation` advances the time. **100 final matrices** (`MAX_BONES`), uploaded every frame.
- **Going further**: blending animations, **dual quaternion skinning** (against the "candy wrapper" collapse of linear
  blending), skinned normals, skinning once in a compute shader.

:::opengl
- **`glVertexAttribIPointer(3, 4, GL_INT, …)`** – the **I** keeps the bone ids integers (`ivec4` in the shader); the
  weights at location 4 with `glVertexAttribPointer`.
- The 100 matrices as uniforms `finalBonesMatrices[i]`, set one by one every frame; no `aiProcess_FlipUVs` – assimp
  already turns glTF's texture coordinates to OpenGL's v-up convention.
:::
:::vulkan
- **`VK_FORMAT_R32G32B32A32_SINT`** at location 3 delivers integers to an `ivec4` – Vulkan's `glVertexAttribIPointer`.
- The 100 matrices in the uniform buffer after view and projection (6,400 bytes, within the 16 KB every device allows),
  copied from the animator in `updateUniformBuffer()`; the model read with `aiProcess_FlipUVs` (Vulkan's v = 0 is the
  image's top row).
:::
:::d3d12
- **`BLENDINDICES`** (`DXGI_FORMAT_R32G32B32A32_SINT`, `int4`) and **`BLENDWEIGHT`** – the semantics Direct3D reserves
  for skinning.
- **Row vectors**: every product in the opposite order – the local transform `scale · rotation · translation`, a node's
  global transform `nodeTransform · parentTransform`, a bone's final matrix `offset · global`; assimp's matrices are
  transposed on conversion; `XMQuaternionSlerp`, `XMVectorLerp`; `XMFLOAT4X4` / `XMFLOAT4` in containers.
- The 100 matrices in the constant buffer, transposed like the others, filled in `OnUpdate`.
:::

## Scene Graph

- **Scene graph**: a tree of **entities**, each with a transform **relative to its parent** – a moon relative to its
  planet. **Local space** (relative to the parent) and **global space** (the world): `global = parentGlobal · local`;
  the root's parent is the identity. The parent's scale and rotation carry over to everything below.
- **The Transform**: position, Euler rotation (degrees, applied z, x, y: `Y · X · Z`) and scale; the local matrix is a
  **TRS** matrix – translation · rotation · scale.
- **The Entity**: a transform, the model it draws and its children. The course keeps the children **by value** in a
  `std::vector` and passes the parent's global matrix down as a parameter, with no parent pointer (learnopengl:
  `std::list<std::unique_ptr<Entity>>` and a raw `parent`). `updateSelfAndChild` and `drawSelfAndChild` walk the tree
  recursively.
- **Pointers into vectors**: a `push_back` beyond the capacity moves the elements and leaves pointers to them dangling –
  safe in the course's loop only because each pointer is used before the next `push_back` into that vector.
- **The chain**: ten children at (3.5, 0, 0) and scale 0.6 each – one model drawn eleven times with eleven model matrices.
- **Dirty flag**: a transform remembers whether its local values changed; the setters set it, `computeModelMatrix`
  clears it. A dirty entity recomputes itself and **everything below it** (`forceUpdateSelfAndChild`); a clean one only
  looks further down.
- **Moving the graph**: the root turned by `20 · time` degrees, the graph updated **before** it is drawn – the whole
  chain follows.

:::d3d12
- DirectXMath's **row vectors** reverse every product: the local matrix `S · Z · X · Y · T`, the global one `local · parent`.
  `XMFLOAT3` / `XMFLOAT4X4` are stored in the structs, `XMMATRIX` used for the maths.
:::

## Frustum Culling

- **Frustum culling**: skipping, on the CPU, objects outside the **view frustum** – no draw call, no vertices shaded.
- **Plane**: a unit normal **n** and a distance d, `dot(n, p) = d`; the **signed distance** `dot(n, p) − d` is positive
  on the side the normal points to. The frustum is six planes with their normals pointing **inwards**.
- **`createFrustumFromCamera`**: the planes built in world space from the camera's position, front, right and up, the
  field of view, the aspect ratio and the near and far distances – the near plane through `pos + zNear · front`, the far
  plane through `pos + zFar · front`, the side planes through the camera with normals from cross products. No projection
  matrix, so the API's depth range and y direction don't matter (extracting the planes from the view-projection matrix
  would depend on both). learnopengl's names of the side planes are swapped – harmless when all six are tested.
- **Bounding volume**: a simple shape enclosing the model, tested instead of its vertices. The test is **conservative**:
  it may draw something invisible, never skip something visible.
- **Sphere**: centre and radius from the box around the vertices (start the maximum at `numeric_limits<float>::lowest()`,
  not `min()`, the smallest *positive* float). In world space: the centre through the model matrix, the radius times the
  **largest scale**. On a plane's inner side when the signed distance is `> −radius`.
- **AABB**: centre and extents; against a plane, its "radius" along the normal is `Σ extent_i · |n_i|`. A turned box needs
  a new axis-aligned box around it in world space – larger than the box itself.
- **The grid**: 10 × 10 planets around the root, turning; at 2.0 s **8 / 101** drawn with a far plane of 15, **37 / 101**
  with the camera's own frustum (the same picture), **38 / 101** with AABBs – one more than spheres, because the box
  around a turned box is loose. Children are tested even when their parent is culled (no hierarchical volumes).
- **What it doesn't save**: overdraw (occlusion), the pixels of visible objects, the invisible parts of a visible object.
  More: occlusion culling, bounding volume hierarchies and octrees, GPU-driven culling with indirect draws.

:::opengl
- The counts `drawn / total` go into the window title with `glfwSetWindowTitle`.
:::
:::vulkan
- `Model` gets a CPU copy of its vertices for `generateSphereBV` – its vertex data otherwise lives only in a device-local
  buffer. The counts go into the window title with `glfwSetWindowTitle`.
:::
:::d3d12
- The model matrix's scaled axes are its **rows** `r[0..2]` (row vectors), where GLM has them in its columns. The counts go
  into the window title with `SetWindowTextW`.
:::

## Cascaded Shadow Mapping

- **Perspective aliasing**: a shadow map spreads its texels evenly, a perspective view doesn't – too few texels per pixel
  near the camera when one map covers a large view.
- **Cascades**: the view frustum split along its depth into slices, each with a shadow map fitted tightly around it. The
  splits are fractions of the far plane (500): `far / 50, / 25, / 10, / 2` = 10, 20, 50, 250 – four splits, **five
  cascades**, each longer than the one before.
- **The corners of a slice**: the eight corners of the normalized device coordinate box, transformed by the
  **inverse of projection · view** and divided by w, using a projection with the slice's near and far distance.
- **A tight light box**: the light view at the corners' centre looking along −lightDir; the orthographic box from the
  corners' minima and maxima in light space, its z range stretched by `zMult = 10` so that casters between the light and
  the slice aren't clipped. Recomputed every frame – the cascades follow the camera.
- **One texture array**: five layers, depth, nearest filtering, a border of depth 1.0 (nothing outside a box is in shadow).
- **All cascades in one pass**: **geometry shader instancing** – the geometry shader runs five times per triangle, applies
  the invocation's light-space matrix and sends the triangle to the layer of the same number.
- **Picking the cascade**: the fragment's view-space depth `abs((view · pos).z)` compared with the split distances; beyond
  the last split, the last cascade. The debug view tints the cascades red, green, blue …
- **Shadows**: the cascade's matrix, the depth from that layer (the layer as the third texture coordinate), and the bias
  scaled per cascade (divided by the cascade's far distance · 0.5) – a fixed bias would detach shadows in large boxes
  (*peter panning*). **PCF** over 3 × 3 texels of the layer, the texel size from the array's width and height.
- **Going further**: blending across cascade seams, **stabilising** the cascades against shimmering (a bounding sphere
  and texel snapping), tighter z ranges, a practical split scheme, culling per cascade.

:::opengl
- **OpenGL 4.1**: `layout (triangles, invocations = 5) in;` (core since 4.0), `gl_InvocationID`, `gl_Layer`.
- **Corners**: z from −1 to 1, `(2x − 1, 2y − 1, 2z − 1)`. The matrices in a `std140` uniform block of `mat4[16]` at
  binding point 0.
- `glTexImage3D` with five layers; `glFramebufferTexture` (no `Layer`) attaches the whole array – a **layered**
  framebuffer; `sampler2DArray`, `textureSize` returns an `ivec3`.
:::
:::vulkan
- **Corners**: Vulkan's depth is 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE`), so z goes from 0 to 1: `(2x − 1, 2y − 1, z)` –
  learnopengl's `2z − 1` would put the near corners in front of the near plane and enlarge every box.
- **The `geometryShader` feature**; one image with `arrayLayers = 5`, one `VK_IMAGE_VIEW_TYPE_2D_ARRAY` view used as the
  sampled array and as the attachment of a framebuffer with `layers = 5`; clamp to a white border.
- std140: `float cascadePlaneDistances[16]` becomes an array of `vec4` (array elements are 16 bytes apart).
:::
:::d3d12
- **Corners**: Direct3D's depth is 0..1, so `(2x − 1, 2y − 1, z)`, by the inverse of view · projection (row vectors).
- **`[instance(5)]`**, `SV_GSInstanceID`, `SV_RenderTargetArrayIndex`; an `R32_TYPELESS` texture with `DepthOrArraySize = 5`,
  a DSV and an SRV over all slices; a border sampler with `OPAQUE_WHITE`.
- HLSL packing: every element of a cbuffer array starts a new 16-byte row, so the split distances are `float4`s.
:::

## Tessellation: Height Map

- **Height map**: a grey image read as terrain – each pixel a grid point, its grey the height. The course's is 256 × 256
  with one 8-bit channel (`stbi_load(…, 0)` reports one channel), not flipped: its top row is the terrain's back edge.
- **One vertex per pixel**: x from the column, z from the row (centred), `y = value · 64/256 − 16` – 65,536 vertices.
- **Triangle strips**: zigzag between two rows, every vertex after the first two makes a triangle. 255 strips of 510
  triangles (130,560 indices for 130,050 triangles; a list would need three indices per triangle). Each strip is drawn
  on its own – one strip over the whole buffer would connect the end of one row pair to the start of the next.
- **Primitive restart**: a special index (`0xFFFFFFFF` for 32-bit indices) ends a strip, so all strips fit in one draw.
- **`rez`**: learnopengl's every-n-th vertex only fits this map for `rez = 1` (it must divide 255 and 256).
- **Colour by height**: `h = (height + 16) / 64` as grey; learnopengl's CPU demo divides by 32.
- **The cost**: every vertex stored, transformed and every triangle set up each frame, near or far; the detail is fixed
  when the mesh is built.

:::opengl
- `GL_POINTS` for a first look; the strips with one `glDrawElements(GL_TRIANGLE_STRIP, …)` each, whose last argument is a
  **byte** offset; primitive restart with `glEnable(GL_PRIMITIVE_RESTART)` + `glPrimitiveRestartIndex`.
:::
:::vulkan
- Points need **`gl_PointSize`** written by the vertex shader; `VK_INDEX_TYPE_UINT32` (65,536 vertices use every 16-bit
  value); `vkCmdDrawIndexed`'s `firstIndex` counts indices; primitive restart with `primitiveRestartEnable` in the pipeline.
:::
:::d3d12
- The topology in two parts: the pipeline state's `PrimitiveTopologyType` (point, line, triangle, patch) and
  `IASetPrimitiveTopology` (list or strip); a point is always one pixel. `StartIndexLocation` counts indices; the
  restart index is the pipeline state's `IBStripCutValue`. Output goes to `OutputDebugStringA`.
:::

## Tessellation

- **The stages**: the **tessellation control shader** (Direct3D: **hull shader**) runs per control point and sets the
  **tessellation levels** per patch; the fixed-function **tessellator** generates (u, v) points and triangles over an
  abstract patch; the **tessellation evaluation shader** (**domain shader**) runs per generated point and computes its
  position. The input is **patches** of a fixed number of control points.
- **The project**: 20 × 20 patches of **4 control points** (1,600 vertices, position + texture coordinate), the height map
  as a one-channel texture, **clamped to the edge** (repeat would pull the far peaks' heights into the front edge).
- **Evaluation**: the texture coordinate and the position interpolated bilinearly from the four corners with u and v, the
  height read from the texture, the point moved along the patch normal, then model, view and projection. Mipmaps are of
  no use here: before rasterisation there are no derivatives, so the shader reads level 0.
- **Levels**: four **outer** levels (one per edge) and two **inner** levels. **Spacing**: `equal_spacing` / `integer`
  rounds up to whole equal segments; **`fractional_odd_spacing`** rounds up to the next odd number with two shorter
  segments, so a changing level moves the points smoothly. Level 8 → 9 segments, 9 × 9 quads, 162 triangles per patch.
- **Levels 1** (the start's control stage): one flat quad per patch – a coarse terrain; **levels 8**: the full terrain,
  about 65,000 triangles from 1,600 vertices.
- **Distance-based levels**: per corner the eye-space depth, scaled to 0..1 between 250 and 450; each outer level
  `mix(MAX, MIN, …)` (8 to 2) from the **nearer of its edge's two corners**, the inner levels the larger of the two
  parallel outer levels. Computing an edge only from its own corners avoids **cracks** between neighbouring patches.
- **Wireframe**: the triangles' edges only – the same density on every patch with fixed levels, coarse at the back with
  distance-based ones.
- **Going further**: screen-space levels, culling patches (level 0), normals in the evaluation shader, displacement on
  models, **mesh shaders**.

:::opengl
- **OpenGL 4.0** (the course asks for 4.1, which macOS has): `GL_MAX_TESS_GEN_LEVEL` (64); `glPatchParameteri(
  GL_PATCH_VERTICES, 4)` and `glDrawArrays(GL_PATCHES, …)`.
- `layout (quads, fractional_odd_spacing, ccw) in;` on the evaluation shader, `layout (vertices = 4) out;` and
  `gl_TessLevelOuter[4]` / `gl_TessLevelInner[2]` – written by invocation 0 – on the control shader, `gl_TessCoord`.
  OpenGL could do without a control shader (default levels); the course keeps it.
- `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)` for the wireframe; `GL_R8` with `GL_RED` data.
:::
:::vulkan
- The **`tessellationShader`** device feature; `maxTessellationGenerationLevel` (64); `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST`
  and `VkPipelineTessellationStateCreateInfo.patchControlPoints = 4` – the patch size is pipeline state.
- A tessellation pipeline **must** have both a control and an evaluation shader – hence the start's control shader with
  levels 1. The tessellator places `gl_TessCoord` as OpenGL's does.
- Wireframe with `VK_POLYGON_MODE_LINE` and the **`fillModeNonSolid`** feature; the height map `VK_FORMAT_R8_UNORM`
  without mipmaps, sampled in the evaluation stage.
:::
:::d3d12
- Tessellation is part of every Direct3D 12 device; the largest factor is the constant
  `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR` (64).
- The **hull shader** declares the layout – `[domain("quad")]`, `[partitioning("fractional_odd")]`,
  `[outputtopology("triangle_ccw")]`, `[outputcontrolpoints(4)]`, `[patchconstantfunc(…)]` – and runs per control point
  (`SV_OutputControlPointID`); the **patch constant function** runs once per patch and returns `SV_TessFactor[4]` and
  `SV_InsideTessFactor[2]`. The domain shader gets `SV_DomainLocation` and an `OutputPatch`.
- `PrimitiveTopologyType = PATCH` in the pipeline state, `D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST` on the
  command list (topology and patch size in one constant); `SampleLevel(…, 0)`; `D3D12_FILL_MODE_WIREFRAME`.
:::

## DSA

- **Bind to edit**: OpenGL's classic model – bind an object to a target, then call functions that work on whatever is
  bound. Problems: **state leaks**, **hidden dependencies** (a VAO that swallows an element buffer, a helper that replaces
  a texture binding), extra calls, and one binding with two meanings (editing and drawing).
- **Direct state access** (OpenGL **4.5**, `ARB_direct_state_access`): functions that take the object as a parameter –
  `glNamedBufferStorage(buffer, …)`, `glTextureParameteri(texture, …)`. Binding stays for **drawing** only.
- **`glCreate*` vs `glGen*`**: `glGen*` reserves a name, and the first bind creates the object and fixes its type;
  `glCreate*` creates the objects at once (`glCreateTextures` takes the target).
- **Immutable storage**: `glNamedBufferStorage` fixes a buffer's size for good, with **flags** instead of usage hints –
  `0` (never changed from the CPU), `GL_DYNAMIC_STORAGE_BIT` (allows `glNamedBufferSubData`), the map bits, persistent
  mapping. `glTextureStorage2D` allocates all mip levels at once – complete by construction; data with
  `glTextureSubImage2D`, mipmaps with `glGenerateTextureMipmap`; a full chain has `1 + floor(log2(max(w, h)))` levels.
- **Separate attribute format** (from 4.3): `glVertexArrayAttribFormat` (format and offset in a vertex),
  `glVertexArrayAttribBinding` (which binding point), `glVertexArrayVertexBuffer` (buffer, offset, stride),
  `glVertexArrayElementBuffer`; `glBindTextureUnit(unit, texture)` for drawing.
- **Other objects**: `glCreateFramebuffers` + `glNamedFramebufferTexture`, `glNamedRenderbufferStorage`,
  `glProgramUniform*` (4.1). macOS stops at 4.1 – no DSA there.

:::opengl
- The tasks rewrite *Hello Triangle*'s rectangle with DSA and give it the container texture: `glTextureStorage2D(texture,
  levels, GL_RGB8, …)` (a **sized** internal format) and `glTextureSubImage2D(…, GL_RGB, GL_UNSIGNED_BYTE, data)`
  (the format of the uploaded data).
:::
:::vulkan
- No tasks: Vulkan never had bind to edit. Every call names its objects; a `VkBuffer` has a fixed size and its memory is
  a separate `VkDeviceMemory` from a chosen memory type – what immutable storage and its flags move OpenGL towards. The
  vertex format lives in the pipeline (attribute and binding descriptions), the buffers are bound per draw.
:::
:::d3d12
- No tasks: Direct3D 12 never had bind to edit. Resources are COM objects with fixed sizes, created with their memory
  (heap type) or placed into an `ID3D12Heap`; the vertex format is the pipeline state's input layout, the buffers are
  bound per draw with views that carry the stride.
:::

## Physically Based Bloom

- **The Gaussian bloom's weaknesses**: a hard threshold (glow switches on and off), a small, blocky glow, flicker of tiny
  bright details, and twenty full-resolution passes.
- **Jimenez's bloom** (*Call of Duty: Advanced Warfare*, SIGGRAPH 2014): **downsample** the HDR image step by step into
  ever smaller textures, then **upsample** back up, adding the levels together. Small textures make a wide blur cheap.
- **The mip chain**: six levels from half the window (400 × 300 … 12 × 9), **R11G11B10 float** (no alpha, no sign – half
  the memory and bandwidth of RGBA16F), linear filtering, clamped to the edge; separate textures, as learnopengl does.
- **Downsample**: **13 bilinear samples** from a 6 × 6 texel area – five overlapping 2 × 2 boxes, the four corner boxes
  0.125 each, the inner box 0.5 – so the energy is kept and small details don't shimmer between levels.
- **Upsample**: a 3 × 3 **tent** filter (1 2 1 / 2 4 2 / 1 2 1 / 16) with a radius in **texture coordinates**
  (`filterRadius = 0.005`), blended additively (`ONE, ONE`) into the next larger level; level 0 ends up as the bloom
  texture.
- **No threshold**: `mix(hdrColor, bloomColor, 0.04)` – the bloom *interpolated*, not added, keeping the energy as a lens
  scatters part of all light; bright things glow because 4 % of a lot is still a lot.
- **Karis average**: in the first downsample only, each box weighted by `1 / (1 + luma)` (luma of the sRGB-converted
  colour), so a single extreme pixel – a **firefly** – can't dominate; `max(…, 0.0001)` keeps the result above zero.

:::opengl
- One framebuffer whose colour attachment is switched to the level being drawn, `glViewport` per level;
  `GL_R11F_G11F_B10F`; `glBlendFunc(GL_ONE, GL_ONE)` for the upsample.
:::
:::vulkan
- A framebuffer's attachments are fixed, so **one framebuffer per level** and a descriptor set per level to read it;
  `VK_FORMAT_B10G11R11_UFLOAT_PACK32`. Two compatible render passes: the downsample's (`loadOp DONT_CARE`) and the
  upsample's (`loadOp LOAD`, it adds to the level). Viewport and scissor per level; `srcResolution` in the push
  constants at offset 80 (std430: a `vec2` is 8-byte aligned).
:::
:::d3d12
- No framebuffer objects: each level has an **RTV** (to draw into) and an **SRV** (to be read), rests in
  `PIXEL_SHADER_RESOURCE` and becomes a `RENDER_TARGET` by a barrier for its pass; `DXGI_FORMAT_R11G11B10_FLOAT`; the
  upsample pipeline state blends `ONE, ONE`; the parameters as root constants.
:::

## Compute Shaders

- **Compute shader**: a program outside the graphics pipeline – no vertices, no rasterizer – run as a grid of
  **invocations** (threads) in **work groups** (thread groups). The group size is declared in the shader (10 × 10 × 1),
  the number of groups given with a **dispatch** (80 × 60 × 1 – one invocation per texel of the 800 × 600 texture).
- **IDs**: `gl_WorkGroupID` / `SV_GroupID`, `gl_LocalInvocationID` / `SV_GroupThreadID`, `gl_GlobalInvocationID` /
  `SV_DispatchThreadID` = group ID × group size + local ID.
- **Work group size**: invocations run in batches of 32 or 64 (warps, wavefronts); real code picks multiples of those and
  rounds the number of groups up. Groups are independent and may run in any order; invocations of one group can share
  memory (`shared` / `groupshared`) and synchronise.
- **Limits**: groups per dimension, group size per dimension, and invocations per group in total – 1024 × 1024 × 1 fits
  the per-dimension sizes but not the 1024 invocations.
- **Images for load/store**: a texture read and written by integer coordinates – `imageLoad` / `imageStore`,
  `RWTexture2D` – without sampler, filtering or mipmaps; the same texture is also sampled by the quad.
- **The barrier**: compute writes are not ordered before later reads automatically – the program must make the drawing
  wait for them and make the data visible.
- **The program**: red rising to the right, green to the top, the red ramp moving 100 texels per second and wrapping with
  `mod` at the width. Going further: shared memory for blurs, particles, culling and indirect draws, skinning, tiled lighting.

:::opengl
- **OpenGL 4.3** (macOS stops at 4.1 – no compute there); a program of one `GL_COMPUTE_SHADER`;
  `glDispatchCompute(80, 60, 1)`.
- Limits with `glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT / _SIZE, i, …)` and `GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS`.
- **Image units**: `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F)` – separate from texture
  units, sized formats only; `layout (rgba32f, binding = 0) uniform image2D`.
- **`glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`** – named after how the data is read next;
  `GL_TEXTURE_FETCH_BARRIER_BIT` covers sampling and is the careful addition.
:::
:::vulkan
- A **compute pipeline** (`vkCreateComputePipelines`: one stage and a layout), bound at `VK_PIPELINE_BIND_POINT_COMPUTE`;
  `vkCmdDispatch` before the render pass; the time as a push constant.
- Limits from `VkPhysicalDeviceLimits` (guaranteed only 128 × 128 × 64 and 128 invocations).
- **Storage image**: `VK_IMAGE_USAGE_STORAGE_BIT`, a `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE` descriptor, the image in
  **`VK_IMAGE_LAYOUT_GENERAL`** (store and sample in one layout); format features checked.
- An **image memory barrier** from the compute shader's writes to the fragment shader's reads – stages and access masks
  say who waits for whom.
:::
:::d3d12
- A **compute pipeline state** (`D3D12_COMPUTE_PIPELINE_STATE_DESC`: root signature and `CS`), its own root signature,
  `SetComputeRoot…` calls, `Dispatch(80, 60, 1)` on the direct command list; the time as a root constant (`fmod`).
- Limits are constants of the API: 65535 groups per dimension, 1024 × 1024 × 64, 1024 threads per group.
- An **unordered access view** (`RWTexture2D<float4>`, u0) on a texture with `ALLOW_UNORDERED_ACCESS`, next to the SRV.
- A **transition barrier** UNORDERED_ACCESS → PIXEL_SHADER_RESOURCE (and back next frame); a **UAV barrier** between two
  compute passes on the same UAV.
:::

## Area Lights

- **Area light**: light from a surface – softer shading, and highlights in the light's shape. The lighting is an integral
  over the light's solid angle.
- **Vector form factor**: for the **clamped cosine** (Lambert) the integral over a polygon is exact – each edge of the
  polygon projected onto the unit sphere contributes its angle in the direction of the cross product; the normal
  component of the sum is the diffuse result. `IntegrateEdgeVec` computes θ / sin θ with a fitted function instead of `acos`.
- **Linearly transformed cosines** (Heitz, Dupuy, Hill and Neubelt, 2016): a clamped cosine whose directions are
  transformed by a matrix M approximates the GGX lobe. Integrating it over a polygon equals integrating the cosine over
  the polygon transformed by **M⁻¹** – so the shader multiplies the corners by M⁻¹ and uses the exact edge formula.
- **The tables**: **LTC1** – the four non-trivial entries of M⁻¹, 64 × 64 over roughness and `sqrt(1 − cos θ)`; **LTC2** –
  the BRDF's magnitude split for Fresnel (`specular *= F0 · t2.x + (1 − F0) · t2.y`) and, in w, the horizon-clipped sphere
  that stands in for clipping the polygon. Float textures (an unsized `GL_RGBA` would clamp to 0..1), not flipped,
  `LUT_SCALE` / `LUT_BIAS` onto the texel centres.
- **Diffuse**: M⁻¹ is the identity; **specular**: M⁻¹ from LTC1, scaled by LTC2 – a soft, stretched reflection of the
  rectangle. The result `color · intensity · (specular + diffuse · albedo)`, two-sided lights.
- **Several lights**: one base rectangle placed eight times by `translate · rotate` – a ring of eight coloured lights,
  their corners set once; the lookups stay outside the loop. LTC has no shadows; it extends to textured lights, disks and lines.

:::opengl
- `GL_RGBA32F` textures on units 0 and 1, the wood (sRGB) on unit 2; the lights as uniform arrays of structs –
  every member of every element has its own location, so no layout rules apply.
:::
:::vulkan
- `VK_FORMAT_R32G32B32A32_SFLOAT` images through a staging buffer; linear filtering of 32-bit floats checked
  (`SAMPLED_IMAGE_FILTER_LINEAR_BIT`); a sampler can't live in a uniform block, so the wood is its own binding.
- **std140**: in a light, `color` (a `vec3`) starts at 16, the corners are `vec4`s 16 bytes apart, a `bool` takes 4 bytes,
  the struct rounds up to 112 bytes – spelled out in the C++ mirror.
:::
:::d3d12
- `DXGI_FORMAT_R32G32B32A32_FLOAT` textures uploaded with `UpdateSubresources`, a static sampler
  `MIN_POINT_MAG_LINEAR_MIP_POINT`.
- `float3x3(a, b, c)` takes **rows** where GLSL's `mat3` takes columns: `transpose(mat3(T1, T2, N))` is `float3x3(T1, T2, N)`.
- **HLSL packing**: `intensity` and `color` share a row, the corners are `float4`s, a struct in a cbuffer array fills
  whole rows – 96 bytes.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| A blend function per target | `glBlendFunci` (4.0) | `independentBlend` feature | `IndependentBlendEnable` |
| Clear each target to its own value | `glClearBufferfv` | clear values per attachment | `ClearRenderTargetView` per RTV |
| Integer vertex attribute | `glVertexAttribIPointer` | `R32G32B32A32_SINT` | `BLENDINDICES`, `R32G32B32A32_SINT` |
| Product order of transforms | column vectors: `parent · local` | as OpenGL (GLM) | row vectors: `local · parent` |
| NDC depth of the frustum corners | −1..1 | 0..1 | 0..1 |
| One pass into all cascades | `invocations = 5`, `gl_Layer` | `geometryShader` feature, `layers = 5` | `[instance(5)]`, `SV_RenderTargetArrayIndex` |
| Restart a strip | `GL_PRIMITIVE_RESTART` | `primitiveRestartEnable` | `IBStripCutValue` |
| Tessellation available | OpenGL 4.0 | `tessellationShader` feature | always |
| Patch of 4 control points | `glPatchParameteri` + `GL_PATCHES` | `PATCH_LIST` + `patchControlPoints` | `4_CONTROL_POINT_PATCHLIST` |
| Levels per patch | `gl_TessLevelOuter/Inner` in invocation 0 | the same | patch constant function |
| Wireframe | `glPolygonMode(…, GL_LINE)` | `VK_POLYGON_MODE_LINE` + `fillModeNonSolid` | `D3D12_FILL_MODE_WIREFRAME` |
| Objects named in every call | DSA (4.5) | always | always |
| Render into a chain of levels | one framebuffer, switched attachment | a framebuffer per level | an RTV per level |
| Packed float HDR format | `GL_R11F_G11F_B10F` | `B10G11R11_UFLOAT_PACK32` | `R11G11B10_FLOAT` |
| Compute available | OpenGL 4.3 | always (graphics + compute queue) | always |
| Writable image | image unit, `image2D` | storage image, layout `GENERAL` | UAV, `RWTexture2D` |
| Wait for compute writes | `glMemoryBarrier` | image memory barrier | transition (or UAV) barrier |
| Float lookup tables | `GL_RGBA32F` | `R32G32B32A32_SFLOAT` | `R32G32B32A32_FLOAT` |

With this part done you have gone through every section of learnopengl.com, and through its guest articles as well:
transparency without sorting, animated characters, scenes organised and culled, shadows for large views, terrain refined
on the GPU, OpenGL's modern object model, a modern bloom, compute shaders and area lights. Each of them is a starting
point – the articles' "going further" lists are where engines take them next – and each of them you have now written in
{{api}}.
