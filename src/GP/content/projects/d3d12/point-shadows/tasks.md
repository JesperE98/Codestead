# Point Shadows – tasks (DirectX 12)

learnopengl.com "Point Shadows": `src/5.advanced_lighting/3.2.1.point_shadows`, `3.2.2.point_shadows_soft`; the Direct3D 12
side keeps the shadow-mapping chapter's structure (an `R32_TYPELESS` depth resource with a `D32_FLOAT` depth stencil view
and an `R32_FLOAT` shader resource view, a depth-only pipeline state, barriers DEPTH_WRITE ↔ PIXEL_SHADER_RESOURCE) and
adds what a cube map needs: a resource with 6 array slices, a `D3D12_DSV_DIMENSION_TEXTURE2DARRAY` view over all six, a
`D3D12_SRV_DIMENSION_TEXTURECUBE` view, a geometry shader writing `SV_RenderTargetArrayIndex` and a pixel shader writing
`SV_Depth`. Files: `main.cpp`, `point_shadows.hlsl` (the scene's shaders), `point_shadows_depth.hlsl` (the depth pass:
its cbuffers and structs are there in the start, the three entry points are TODOs – the file is not compiled before
`depth-cubemap`), `wood.png`.

**Fixed choices (the same in every API):**
- Scene (learnopengl's `renderScene`, here the member function `RenderScene()` called from `PopulateCommandList` in each
  pass): one vertex buffer with learnopengl's `renderCube` cube (36 vertices: 2×2×2, normals, texture coordinates with v
  flipped), drawn six times with `DrawInstanced(36, 1, 0, 0)`: the room – scaled 5 (walls at ±5), `reverseNormals = TRUE`
  (the vertex shader negates the normal so the inside is lit, learnopengl's `reverse_normals`) – and five cubes: (4, -3.5,
  0) scale 0.5; (2, 3, 1) scale 0.75; (-3, -1, 0) scale 0.5; (-1.5, 1, 1.5) scale 0.5; (-1.5, 2, -3) rotated 60° about
  normalize(1, 0, 1), scale 0.75 – in DirectXMath's row-vector order `XMMatrixScaling * XMMatrixRotationAxis *
  XMMatrixTranslation`. All wood (t0, static sampler s0: linear, WRAP, `R8G8B8A8_UNORM` like round 1).
- Root constants (root parameter 0, `cbuffer ModelConstants : register(b0)`): `model`, `normalMatrix` (transpose(inverse
  (model)) – stored transposed for HLSL, that is `XMMatrixInverse(nullptr, model)`) and `BOOL reverseNormals` (HLSL `bool`,
  4 bytes in both): 33 32-bit constants, one `ModelConstants modelConstants` reused for the six draws.
- The light at `lightPos` (0, 0, 0), **static**: learnopengl moves it with `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0` –
  mentioned in the comment above the `lightPos` global, so the picture does not depend on time.
- Camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1)
  (never visible: the room fills the window), depth test on.
- Lighting (learnopengl's point_shadows.fs, `PSMain`): light colour 0.3, ambient 0.3 × light colour, diffuse,
  Blinn-Phong specular (64), `lighting = (ambient + (1.0f - shadow) * (diffuse + specular)) * color`.
- Depth cube map: 1024 × 1024 per face, point sampling, clamp (static sampler s1 – learnopengl's `GL_NEAREST`,
  `GL_CLAMP_TO_EDGE`). Light projection `XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), 1.0f, 1.0f, 25.0f)` followed
  by `XMMatrixScaling(1.0f, -1.0f, 1.0f)` (Direct3D's y flip, below); the six views `XMMatrixLookAtRH(light, light + dir,
  up)` in the cube face order +X, -X, +Y, -Y, +Z, -Z with learnopengl's dir / up. The depth stored is the **linear
  distance to the light / far_plane** (written with `SV_Depth`).
- **Deviations from learnopengl:** no `shadows` toggle (learnopengl switches shadows with the Space key; there is no input
  here – the `shadows` task switches them on in the code). **No face culling at all** (`CullMode = D3D12_CULL_MODE_NONE`
  in every pipeline state): learnopengl culls the five cubes' back faces and turns culling off only for the room; in
  Direct3D the cull mode is part of the pipeline state object, so that would need two more pipeline states (room and
  cubes, in each pass) for a picture that is exactly the same – the cubes are closed, their back faces are always hidden.

**What the camera sees:** from (0, 0, 3) the back wall (z = -5) fills the window – the wood stretched over the 10 × 10
wall, with dark seams – with a soft highlight a little left of the centre, and only one of the five cubes: the rotated
one at (-1.5, 2, -3), in the top-left corner. Light and camera are almost on one line, so the cube hides most of its own
shadow: the shadow shows as a dark band around the cube's upper-left edge (x 38..110, y 0..100), a thin line along its
lower-left edge and a small piece right of its top corner (x ≈ 300..350, y 0..40). The other four cubes and their
shadows (on the side walls, floor and ceiling) are outside the view.

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here. The start picture is
the app's simulator's (with `RenderScene()`'s body pasted into `PopulateCommandList`, see the end); it matches the OpenGL
project's Mesa screenshot (mean difference 0.25 per pixel, none more than 24). The simulator does not follow the depth
cube map yet (see the end): the pictures of the later tasks were computed with the simulator on a test copy of each state
that keeps every matrix and shader line but stores the six faces in six 2D `R32_FLOAT` targets (one pass per face, the
face's matrix chosen by an extra root constant instead of the geometry shader, the distance written as the pixel
shader's colour instead of `SV_Depth`) and replaces `depthMap.Sample(shadowSampler, dir)` by a lookup that applies
Direct3D's cube face table by hand – they equal the OpenGL project's Mesa screenshots at every named point (whole
pictures: mean difference ≤ 0.25 per pixel). This also checks the y flip of `shadowProj` end to end.
Named points (as OpenGL's): **wall-centre** (350,300) = 117,80,49 (in the highlight); **seam** (400,300) = 47,32,19;
**wall-right** (700,450) = 61,42,25; **wall-left** (100,500) = 60,41,25; **wall-top-right** (750,50) = 54,37,22;
**cube-face** (150,100) = 69,47,29 (the rotated cube's lit face); **shadow-1** (60,40), **shadow-2** (50,80),
**shadow-3** (330,15) – on the wall where the cube's shadow falls; **edge-1** (150,160), **edge-2** (120,150) – at the
shadow's lower edge.

**Start picture:** the room lit, no shadows: shadow-1 = 56,38,23, shadow-2 = 51,35,21, shadow-3 = 61,41,25, edge-1 =
55,38,23, edge-2 = 57,39,24; the other named points as above.

## depth-cubemap
- **Task:** Create the depth cube map – one 1024×1024 depth resource with six array slices (the faces), a depth stencil view over all six and a cube map shader resource view – and its depth pipeline state; every frame draw the scene into all six faces in one pass from the light: the geometry shader sends every triangle to each face (`SV_RenderTargetArrayIndex`) with that face's light matrix, the pixel shader writes the distance to the light / far_plane as the depth (`SV_Depth`). Then show the cube map: the scene's pixel shader returns the stored depth in the fragment's direction from the light as grey.
- **Hint:** The resource: `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)` (arraySize 6), clear value `D32_FLOAT` 1.0, initial state `DEPTH_WRITE`. Its DSV (DSV heap slot 1, the heap needs 2 descriptors and `m_dsvDescriptorSize`): `D3D12_DSV_DIMENSION_TEXTURE2DARRAY` with `Texture2DArray.ArraySize = 6` (learnopengl: `glFramebufferTexture` with the whole cube map – a layered attachment); its SRV (CBV/SRV slot 2, 3 descriptors): `R32_FLOAT`, `D3D12_SRV_DIMENSION_TEXTURECUBE`, `TextureCube.MipLevels = 1`; the SRV range grows to 2 (t0, t1); sampler s1 = s0 with `D3D12_FILTER_MIN_MAG_MIP_POINT` and `CLAMP` on U, V, W. The depth PSO: `point_shadows_depth.hlsl`'s `VSMain` (vs_5_0), `GSMain` (`gs_5_0`, `psoDesc.GS`) and `PSMain`, `NumRenderTargets = 0`, `RTVFormats[0] = DXGI_FORMAT_UNKNOWN`, `DSVFormat = D32_FLOAT`. The matrices (`OnUpdate`): `shadowProj = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), …, near_plane, far_plane) * XMMatrixScaling(1.0f, -1.0f, 1.0f)` (the flip: see "Cube map directions" below), `shadowTransforms[i] = XMMatrixLookAtRH(light, light + dir, up) * shadowProj` (row vectors: view first), stored transposed in `shadowMatrices[i]`. The geometry shader: `[maxvertexcount(18)] void GSMain(triangle GSInput input[3], inout TriangleStream<PSInput> triStream)` with `for (int face = 0; face < 6; ++face) { output.layer = face; for (int i = 0; i < 3; ++i) { output.fragPos = input[i].position; output.position = mul(output.fragPos, shadowMatrices[face]); triStream.Append(output); } triStream.RestartStrip(); }`; the vertex shader returns only `mul(position, model)` (in `SV_POSITION`, like learnopengl's `gl_Position = model * vec4(aPos, 1.0)`); the pixel shader `float PSMain(PSInput input) : SV_Depth` returns `length(input.fragPos.xyz - lightPos) / far_plane`. Pass 1 (`PopulateCommandList`): `SetPipelineState(m_depthPipelineState)`, the 1024×1024 viewport/scissor (one for all faces), `OMSetRenderTargets(0, nullptr, FALSE, &cubemapDsvHandle)`, clear depth 1.0, `RenderScene()`, barrier DEPTH_WRITE → PIXEL_SHADER_RESOURCE, `SetPipelineState(m_pipelineState)`; at the end of the frame the barrier back. Debug view in `PSMain`: `depthMap.Sample(shadowSampler, input.fragPos - lightPos).r` on a `TextureCube depthMap : register(t1)`.
- **When done:** `main.cpp`: `static const UINT SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`; `SceneConstantBuffer` gets
  `XMFLOAT4X4 shadowMatrices[6];` after `projection` and `float far_plane;` instead of `padding0` (after `viewPos`, in
  the same 16-byte row – `point_shadows.hlsl`'s cbuffer gets `float4x4 shadowMatrices[6];` and `float far_plane;` at the
  same places); members `m_shadowViewport`, `m_shadowScissorRect` (constructor), `m_depthPipelineState`,
  `m_dsvDescriptorSize`, `m_depthCubemap`; `dsvHeapDesc.NumDescriptors = 2`, `cbvSrvHeapDesc.NumDescriptors = 3`;
  `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`; `samplers[2]` with `samplers[1]` (`MIN_MAG_MIP_POINT`,
  `D3D12_TEXTURE_ADDRESS_MODE_CLAMP` ×3, `ShaderRegister = 1`); three `D3DCompileFromFile(L"point_shadows_depth.hlsl", …)`
  (`VSMain`/`vs_5_0`, `GSMain`/`gs_5_0`, `PSMain`/`ps_5_0`) → `psoDesc.VS/GS/PS`, `NumRenderTargets = 0`,
  `m_depthPipelineState`; the depth cubemap block (`Tex2D(DXGI_FORMAT_R32_TYPELESS, …, 6, 1, 1, 0,
  D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)`, `CreateDepthStencilView` with `D3D12_DSV_DIMENSION_TEXTURE2DARRAY` /
  `Texture2DArray.ArraySize = 6` at DSV slot 1, `CreateShaderResourceView` with `D3D12_SRV_DIMENSION_TEXTURECUBE` at
  CBV/SRV slot 2); `OnUpdate`: `near_plane = 1.0f`, `far_plane = 25.0f`, `shadowProj` (with `XMMatrixScaling(1.0f, -1.0f,
  1.0f)`), `XMMATRIX shadowTransforms[6]` (six `XMMatrixLookAtRH(…) * shadowProj`), the `for` loop storing them
  transposed, `constantBufferData.far_plane = far_plane;`; `PopulateCommandList`: pass 1 as in the hint before the
  window's pass, then `SetPipelineState(m_pipelineState.Get())`, and the PIXEL_SHADER_RESOURCE → DEPTH_WRITE barrier after
  the back buffer's. `point_shadows_depth.hlsl`: `VSMain`, `GSMain` (`[maxvertexcount(18)]`, `layer = face`,
  `triStream.Append`, `RestartStrip`) and `PSMain` (`: SV_Depth`, `length(input.fragPos.xyz - lightPos)`, `/ far_plane`).
  `point_shadows.hlsl`: `TextureCube depthMap : register(t1);`, `SamplerState shadowSampler : register(s1);`, and at
  the end of `PSMain` (instead of `return float4(lighting, 1.0f);`) `float3 fragToLight = input.fragPos - lightPos; float
  closestDepth = depthMap.Sample(shadowSampler, fragToLight).r; return float4(closestDepth, closestDepth, closestDepth,
  1.0f);` – learnopengl's debug line `FragColor = vec4(vec3(closestDepth / far_plane), 1.0)` (there `closestDepth` has
  already been multiplied by far_plane).
  The window shows the **depth cube map seen from the camera** – grey everywhere (r = g = b, 15..84), dark: the wall is
  5–8.7 units from the light, 0.2–0.35 of far_plane. **seam**/centre (400,300) = 51,51,51 (distance 5 → 0.2 × 255),
  (400,20) = 60,60,60, (20,300) = 67,67,67, wall-right (700,450) = 64,64,64, wall-left (100,500) = 65,65,65,
  wall-top-right (750,50) = 70,70,70, (780,580) = 74,74,74 (the corner, farthest); the wall gets lighter towards the
  edges. The cube is darker (closer to the light): cube-face (150,100) = 34,34,34. **The shadow shows here too:** where
  the cube hides the wall from the light, the cube map holds the cube's distance: shadow-1 (60,40) = 34,34,34, shadow-2
  (50,80) = 35,35,35, shadow-3 (330,15) = 32,32,32, edge-1 (150,160) = 35,35,35, while the wall next to it is lighter:
  edge-2 (120,150) = 62,62,62. No wood texture, no lighting.

## shadows
- **Task:** Draw the lit scene again with shadows: `ShadowCalculation(fragPos)` reads the closest depth in the direction from the light to the fragment, turns it back into a distance (`* far_plane`), and compares it with the fragment's own distance to the light, with a bias of 0.05.
- **Hint:** `float3 fragToLight = fragPos - lightPos; float closestDepth = depthMap.Sample(shadowSampler, fragToLight).r; closestDepth *= far_plane; float currentDepth = length(fragToLight); float bias = 0.05f; float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;`. In `PSMain`: `float shadow = ShadowCalculation(input.fragPos);` and `return float4(lighting, 1.0f);` again (the debug lines go). The direction does not need to be normalised: a `TextureCube` picks the face and texel from its direction only.
- **When done:** `point_shadows.hlsl`: learnopengl 3.2.1's `float ShadowCalculation(float3 fragPos)` (`fragToLight`,
  `depthMap.Sample(shadowSampler, fragToLight).r`, `closestDepth *= far_plane`, `currentDepth = length(fragToLight)`,
  `bias = 0.05f`, `currentDepth - bias > closestDepth ? 1.0f : 0.0f`), `float shadow = ShadowCalculation(input.fragPos);`,
  `return float4(lighting, 1.0f);` (the debug output removed). The lit room is back with the cube's **shadow** on the
  back wall: shadow-1 (60,40) = 16,11,7, shadow-2 (50,80) = 15,10,6, shadow-3 (330,15) = 16,11,7, edge-1 (150,160) =
  14,10,6 (ambient only: 0.09 × the wood); edge-2 (120,150) = 57,39,24 (lit, just outside the shadow); all other named
  points as in the start (wall-centre 117,80,49, wall-right 61,42,25, wall-left 60,41,25, cube-face 69,47,29,
  wall-top-right 54,37,22). About 7,100 pixels change against the start, all inside x 38..351, y 0..196. In the box
  x 0..360, y 0..200, ≈ 11,860 pixels have red < 20 (start ≈ 4,750). Hard, jagged edges (one cube map texel per sample).
  No shadow acne (the bias in world units covers the depth texels).

## pcf
- **Task:** Soften the shadow's edges with learnopengl's PCF for cube maps: 20 samples along offset directions (`gridSamplingDisk`), spread over a disk whose radius grows with the distance to the viewer, averaged; bias 0.15.
- **Hint:** Add learnopengl's offsets as `static const float3 gridSamplingDisk[20] = { float3(1, 1, 1), … };` (the 8 corners and 12 edge middles of a cube; `static const` makes it a constant array of the shader, not a cbuffer value). In `ShadowCalculation`: `float shadow = 0.0f; float bias = 0.15f; int samples = 20; float viewDistance = length(viewPos - fragPos); float diskRadius = (1.0f + (viewDistance / far_plane)) / 25.0f;` then `for (int i = 0; i < samples; ++i) { float closestDepth = depthMap.Sample(shadowSampler, fragToLight + gridSamplingDisk[i] * diskRadius).r; closestDepth *= far_plane; if (currentDepth - bias > closestDepth) shadow += 1.0f; } shadow /= float(samples);`.
- **When done:** `point_shadows.hlsl`: the `gridSamplingDisk[20]` array and learnopengl 3.2.2's PCF loop in
  `ShadowCalculation` (`bias = 0.15f`, `samples = 20`, `viewDistance`, `diskRadius`, `shadow /= float(samples)`). The
  shadow's **edges become soft**, its inside stays: shadow-1/2/3 = 16,11,7 / 15,10,6 / 16,11,7; edge-1 (150,160) ≈
  21,14,9 (was 14,10,6), edge-2 (120,150) ≈ 51,35,22 (was 57,39,24). Only ≈ 1,600 pixels change against `shadows`, all
  at the shadow's edges (x 38..353, y 0..198); in the box x 0..360, y 0..200 the pixels with red < 20 go from ≈ 11,860
  to ≈ 10,300, those with red 20..49 from ≈ 5,700 to ≈ 8,250. The rest of the picture is unchanged. This is the solution
  (learnopengl's `3.2.2.point_shadows.fs`, without the `shadows` toggle).

## Cube map directions and clip space (Direct3D 12)
- **Face selection** is the same in OpenGL, Vulkan and Direct3D: the largest component of the direction picks the face
  (+X, -X, +Y, -Y, +Z, -Z = array slices 0 to 5), and the face's u/v follow the same table (for +X: u from -z, v from -y
  – v points *down* the face). So learnopengl's six targets/ups are kept: rendering face +X with `XMMatrixLookAtRH(light,
  light + (1,0,0), (0,-1,0))` (up = -y) puts what the light sees in that direction where `depthMap.Sample(…, dir)` looks
  for it – once the rows are the right way round.
- **Rows:** a face's row 0 is v = 0 in every API (the sampling side is identical), but which NDC y lands on row 0 when
  drawing into it differs: OpenGL (and Vulkan) put NDC y = -1 there, **Direct3D puts NDC y = +1 there** (the top of a
  render target, like the top of the window). With learnopengl's matrices every face would be stored upside down, so
  `shadowProj` is followed by `XMMatrixScaling(1.0f, -1.0f, 1.0f)`: clip y → -y (Vulkan's `proj[1][1] *= -1` idea, here
  for the opposite reason). Checked numerically: with the flip, `uv = (ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5)` of
  `mul(pos, shadowMatrices[face])` equals the cube map's own u/v of the direction `pos - lightPos` for 10,000 random
  points; without it v is mirrored for all of them. The flip also reverses the triangles' winding – no matter here, the
  pipeline states cull nothing (with culling, a flipped pass would cull the other faces). The alternative is Direct3D's
  own convention: `XMMatrixLookAtLH` with up +y for ±X/±Z and (0,0,-1) / (0,0,1) for ±Y.
- **Depth values:** the stored depth is our own `SV_Depth` (distance / far_plane), so the projection's depth (0..1) does
  not matter; near 1.0 and far 25.0 still clip (nothing is nearer than 1.0 – the closest cube corner is ≈ 1.5 from the
  light – or farther than 25: the room's corners are 8.7 away). Writing `SV_Depth` turns off the early depth test for
  the depth pass; the hardware alternative is a depth bias in the rasterizer – not used, as learnopengl.

**Simulator (checked with the app's simulator on every state):**
- **Draws in a helper are not found:** `PopulateCommandList` has no `DrawInstanced` itself – the six draws are in
  `RenderScene()`, which it calls – so the reader's draw search (`Recorded(c)`: the draw call must be written in
  `PopulateCommandList`) finds nothing and **every state shows only the clear colour** (26,26,26, `draws=0`). With the
  helper's body pasted into `PopulateCommandList` (in braces, at each call) the start renders as described above.
- `depth-cubemap`, `shadows`, `pcf` (with the helper inlined): **the depth cube map is not rendered or not read** – the
  debug view is black (0,0,0 everywhere) and the shadows do not appear: the six-slice resource behind a
  `D3D12_DSV_DIMENSION_TEXTURE2DARRAY` depth stencil view is registered as a one-layer target (`RegisterTarget` passes no
  `Layers`), and a `D3D12_SRV_DIMENSION_TEXTURECUBE` view of a render-target resource gives a cube texture of its loaded
  images – none – instead of the six rendered slices (`D3D12Device.TextureAt`).
- **Arrays of matrices in the constant buffer arrive empty:** `float4x4 shadowMatrices[6]` in the cbuffer, filled from
  the C++ struct's `XMFLOAT4X4 shadowMatrices[6]`, reaches the geometry shader as empty matrices – "cannot multiply a
  vec4 by a mat0" on `mul(output.fragPos, shadowMatrices[face])` – whether the six are stored in the `for` loop from
  `XMMATRIX shadowTransforms[6] = { … }` or one by one (`XMStoreFloat4x4(&constantBufferData.shadowMatrices[0],
  XMMatrixTranspose(XMMatrixLookAtRH(…) * shadowProj))` …). Six separate `XMFLOAT4X4` / `float4x4` fields work. (Also:
  `FrameRecorder.Upload` transposes single matrices only, not matrices inside arrays.)
- **`SV_Depth` is ignored in the depth-only pass:** the depth pass's pixel shader runs (the draw has the right pixel
  shader, `PSOutput` with `SV_Depth` is seen), but the shadow map holds the rasterizer's depth, not the written one –
  checked with a pixel shader returning a constant 0.1: the six faces still hold the light projection's depth (0.833 on
  the back wall, distance 5). Both forms fail: `float PSMain(…) : SV_Depth` (a semantic on the function, which
  `Rasterizer.Stages`' `WritesDepth` does not look at – it only checks struct fields) and a `struct { float depth :
  SV_Depth; }` return value. With the distance written as an `R32_FLOAT` colour instead, the pictures are right.
- A vertex shader that feeds a geometry shader must return `SV_POSITION` for the simulator ("'VSMain' returns no
  SV_POSITION") – Direct3D does not require it; the code returns the world position in `SV_POSITION` anyway (learnopengl's
  `gl_Position = model * vec4(aPos, 1.0)`).
