# geometry-shader – DirectX 12

learnopengl.com "Geometry Shader": `9.1.geometry_shader_houses`, `9.2.geometry_shader_exploding`,
`9.3.geometry_shader_normals`. In Direct3D 12 a geometry shader is an HLSL function with `[maxvertexcount(N)]`, an
input primitive (`point VSOutput input[1]`, `triangle VSOutput input[3]`) and an output stream (`inout
PointStream<GSOutput>`, `LineStream<…>`, `TriangleStream<…>`) to which it `Append`s vertices (`RestartStrip()` ends a
strip – GLSL's `EmitVertex()` / `EndPrimitive()`). It is compiled with the target `gs_5_0` and set in the pipeline
state as `psoDesc.GS`; `psoDesc.PrimitiveTopologyType` is the primitive the geometry shader takes as input (Microsoft
Learn: "Geometry shader stage", "Stream-Output Object").
Files: `main.cpp` (with the Model chapter's `Vertex`, `Texture`, `Mesh`, `Model` and `TextureFromFile`, used from the
`planet` task on), `geometry_shader.hlsl` (the points/houses: `VSMain`, `GSMain` from `pass-through` on, `PSMain`),
`explode.hlsl` (9.2), `default.hlsl` and `normal_visualization.hlsl` (9.3), and the read-only model in `models/`
(`planet.obj`, `planet.mtl`, `planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`, as in the
Model chapter).

Start: learnopengl 9.1's program – no camera, no matrices: clear (0.1, 0.1, 0.1), depth buffer and test on, the four
points of learnopengl's `points[]` (`struct PointVertex { XMFLOAT2 position; XMFLOAT3 color; }`: (-0.5, 0.5) red, (0.5,
0.5) green, (0.5, -0.5) blue, (-0.5, -0.5) yellow) in an upload-heap vertex buffer, input layout `POSITION`
(R32G32_FLOAT) + `COLOR` (R32G32B32_FLOAT, offset 8), `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`,
`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_POINTLIST)`, `DrawInstanced(4, 1, 0, 0)`. All pipeline states have
`CullMode = D3D12_CULL_MODE_NONE` (learnopengl draws without face culling; the houses' strips are counter-clockwise on
screen and the ring is a single plane). Prepared for the planet tasks (unused by the points): the Model chapter's root
signature (0 = root constants `ModelConstants` b0 for the vertex shader, 1 = descriptor table with the CBV b1 for
**all** stages – the geometry shaders read it –, 2 = descriptor table with a mesh's two SRVs t0/t1, static sampler
s0), the CBV/SRV heap (1 CBV + 2 × `MaxMeshes` SRVs), the constant buffer `SceneConstantBuffer { view; projection; }`
with its CBV and persistent mapping, `SetDescriptorHeaps` + `SetGraphicsRootDescriptorTable(1, …)` in
`PopulateCommandList`, an empty `OnUpdate`, and the member `Model m_model;`. TODOs: `main.cpp` (compile `GSMain`,
`psoDesc.GS`), `geometry_shader.hlsl` (`GSMain`), `explode.hlsl` (`time`, `explode`, `GetNormal` – its `GSMain` already
passes each triangle through), `normal_visualization.hlsl` (`GSMain`; its `VSMain` and `PSMain` are complete).
`default.hlsl` is complete. Every state between tasks compiles.

Pixels: 800×600 client area from the top left, at time 1 s. Background = 26,26,26. D3D12 cannot run here; the values
are the app's simulator's, with the geometry shader stage wired into the D3D12 reader in a local copy (the shipped
simulator ignores `psoDesc.GS` – see the note at the end); they equal the OpenGL project's Mesa screenshots of the same
steps unless stated.

**Start picture:** four single pixels (points are 1 px): red 255,0,0 at about (199,150), green at (599,150), yellow at
(199,450), blue at (599,450), i.e. NDC (±0.5, ±0.5) – the points lie on pixel corners: the simulator puts them at
y = 149 / 449; check a 3×3 neighbourhood. Everything else 26,26,26.

## `pass-through`
- **Task:** Add a geometry shader `GSMain` to `geometry_shader.hlsl` that passes each point through unchanged (with its colour), compile it with the target `gs_5_0` and put it into the pipeline state (`psoDesc.GS`).
- **Hint:** The vertex shader now hands its output to the geometry shader: rename its struct to `VSOutput`, and give the geometry shader's output its own struct `GSOutput` (the same two fields), which the pixel shader takes. `[maxvertexcount(1)] void GSMain(point VSOutput input[1], inout PointStream<GSOutput> outputStream)`: copy `input[0]`'s position and colour into a `GSOutput`, `outputStream.Append(output);` and `outputStream.RestartStrip();`. In `main.cpp`: `ComPtr<ID3DBlob> geometryShader;`, `D3DCompileFromFile(L"geometry_shader.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr)` and `psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());`. The PSO's `PrimitiveTopologyType` stays `POINT`: it is the geometry shader's input.
- **When done:** `geometry_shader.hlsl`: `struct VSOutput { float4 position : SV_POSITION; float3 color : COLOR; }`,
  `struct GSOutput` (same fields), `VSOutput VSMain(float2 position : POSITION, float3 color : COLOR)`,
  `[maxvertexcount(1)] void GSMain(point VSOutput input[1], inout PointStream<GSOutput> outputStream)` with
  `output.color = input[0].color;`, `output.position = input[0].position;`, `outputStream.Append(output);`,
  `outputStream.RestartStrip();`, and `float4 PSMain(GSOutput input) : SV_TARGET`. `main.cpp`: `ComPtr<ID3DBlob>
  geometryShader;`, the `"GSMain", "gs_5_0"` compile of `geometry_shader.hlsl` (between the VS and PS compiles),
  `psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());`. **No visible change** (the same four 1-px points).

## `houses`
- **Task:** Turn each point into a house: the geometry shader outputs a triangle strip of 5 vertices per point (learnopengl's `build_house`): bottom-left, bottom-right, top-left, top-right (±0.2 around the point) and the roof's top (0, +0.4).
- **Hint:** `[maxvertexcount(5)]` and `inout TriangleStream<GSOutput> triStream`. A strip of 5 vertices makes 3 triangles: two for the walls, one for the roof. HLSL has no global output variables: `build_house(float4 position, float3 color, inout TriangleStream<GSOutput> triStream)` fills a `GSOutput` (colour once, then `output.position = position + float4(-0.2f, -0.2f, 0.0f, 0.0f); triStream.Append(output);` …) and ends with `triStream.RestartStrip();`. `GSMain` calls `build_house(input[0].position, input[0].color, triStream);`.
- **When done:** `geometry_shader.hlsl`: `void build_house(float4 position, float3 color, inout TriangleStream<GSOutput>
  triStream)` with five `output.position = position + float4(…); triStream.Append(output);` (offsets (-0.2,-0.2),
  (0.2,-0.2), (-0.2,0.2), (0.2,0.2), (0.0,0.4)) and `triStream.RestartStrip();`; `[maxvertexcount(5)] void
  GSMain(point VSOutput input[1], inout TriangleStream<GSOutput> triStream)` calling `build_house(...)`. **Four houses**
  in the points' colours: each a 160×120 px wall with a 60 px roof (bounding box of all four x 120..679, y 30..509;
  96,000 non-background pixels). (200,150) = 255,0,0, (200,60) = 255,0,0 (roof), (600,150) = 0,255,0, (600,60) = 0,255,0,
  (200,450) = 255,255,0, (200,360) = 255,255,0, (600,450) = 0,0,255, (600,360) = 0,0,255; background (400,300), (400,150),
  (281,150) = 26,26,26. (Identical to OpenGL.)

## `roof-white`
- **Task:** Put snow on the roofs: give the last vertex of the strip (the roof's top) the colour white.
- **Hint:** The pixel shader's input is interpolated between the vertices, and `Append` copies the output as it is at that moment: set `output.color = float3(1.0f, 1.0f, 1.0f);` just before the fifth `triStream.Append(output);`.
- **When done:** `geometry_shader.hlsl`: `output.color = float3(1.0f, 1.0f, 1.0f);` between the fifth `output.position = …`
  and its `Append`. The roofs fade from the house colour at the eaves to **white at the tip**; walls unchanged.
  (200,150) = 255,0,0, (200,60) = 255,125,125, (200,35) = 255,232,232, (600,60) = 125,255,125, (200,360) = 255,255,125,
  (600,360) = 125,125,255, (600,335) = 232,232,255; walls (600,150) = 0,255,0, (200,450) = 255,255,0, (600,450) =
  0,0,255; background unchanged. (Identical to OpenGL.)

## `planet`
- **Task:** Switch to the model scene of the Model chapter: camera globals at (0, 0, 3) looking down -z, the planet loaded into `m_model` from `"models/planet.obj"`, the view and projection (45°, 800/600, 0.1, 100) in the constant buffer, learnopengl's model matrix (tilted 25° about x, scaled 0.5) as root constants, drawn with the three shaders of `explode.hlsl` – whose geometry shader so far passes every triangle through unchanged. Remove the points.
- **Hint:** The pipeline state takes `explode.hlsl`'s `VSMain` / `GSMain` / `PSMain`, the mesh's input layout (`POSITION`, `NORMAL` at 12, `TEXCOORD` at 24) and `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE` (the geometry shader now takes triangles). In `LoadAssets`: `m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);` instead of the points' vertex buffer, and `m_model.uploadHeaps.clear();` after the wait. `OnUpdate`: `XMMatrixLookAtRH` and `XMMatrixPerspectiveFovRH`, transposed into the constant buffer. `PopulateCommandList`: `TRIANGLELIST`, the model matrix with `SetGraphicsRoot32BitConstants(0, …)` and `m_model.Draw(m_commandList.Get());`.
- **When done:** `main.cpp`: globals `XMVECTOR cameraPos = XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f)`, `cameraFront (0, 0, -1)`,
  `cameraUp (0, 1, 0)` before `struct Vertex`; `struct PointVertex`, `m_vertexBuffer`, `m_vertexBufferView` and the
  points' vertex buffer block removed; the three `D3DCompileFromFile(L"explode.hlsl", …)` (`vs_5_0`, `gs_5_0`, `ps_5_0`);
  the mesh input layout; `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE`; `m_model.Load("models/planet.obj",
  …, 1);` and `m_model.uploadHeaps.clear();`; `OnUpdate` with `XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront,
  cameraUp)`, `XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), …, 0.1f, 100.0f)`, `XMStoreFloat4x4(…,
  XMMatrixTranspose(…))` and `memcpy(m_pCbvDataBegin, …)`; `PopulateCommandList`: `IASetPrimitiveTopology(
  D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST)`, `XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f,
  0.0f, 0.0f), XMConvertToRadians(25.0f)) * XMMatrixTranslation(0.0f, 0.0f, 0.0f)`, `SetGraphicsRoot32BitConstants(0,
  sizeof(ModelConstants) / 4, &modelConstants, 0)`, `m_model.Draw(m_commandList.Get());`. **The textured planet with its
  ring** (unlit) on the 0.1 background: model x ≈ 147..652, y ≈ 178..445. Centre (400,300) = 105,140,60 (land), pole
  (400,186) = 235,240,245, sea (380,215) = 28,70,150, lake (437,220) = 28,70,150, ring-front (400,420) = 181,155,120
  (OpenGL 178,153,119), ring-left (175,330) = 76,65,51, ring-right (625,330) = 80,69,54, gap (250,310), (100,100) and
  (400,520) = 26,26,26. (The shipped simulator shows this picture too: 0.1 % of the pixels differ from Mesa.)

## `explode`
- **Task:** Explode the planet: in `explode.hlsl` move every triangle along its face normal by `(sin(time) + 1) / 2 * 2.0` (learnopengl's `explode` and `GetNormal`), with `float time` in the constant buffer, set every frame in `OnUpdate`.
- **Hint:** `explode(float4 position, float3 normal)` returns `position + float4(normal * ((sin(time) + 1.0f) / 2.0f) * magnitude, 0.0f)` with `magnitude = 2.0f`. HLSL has no `gl_in`: `GetNormal(float4 position0, float4 position1, float4 position2)` takes the triangle's three positions, `a = position0.xyz - position1.xyz`, `b = position2.xyz - position1.xyz`, `normalize(cross(a, b))`. In `GSMain`: `float3 normal = GetNormal(input[0].position, input[1].position, input[2].position);` and `output.position = explode(input[i].position, normal);`. The time: `float time;` after `projection` in both the HLSL cbuffer and the C++ `SceneConstantBuffer`, filled with `std::chrono` like the transformations chapter.
- **When done:** `explode.hlsl`: `float time;` in `cbuffer SceneConstantBuffer`, `float4 explode(float4 position, float3
  normal)` (`float magnitude = 2.0f;`, `float3 direction = normal * ((sin(time) + 1.0f) / 2.0f) * magnitude;`),
  `float3 GetNormal(float4 position0, float4 position1, float4 position2)` with the cross product, `GSMain` uses `float3
  normal = GetNormal(...)` and `explode(input[0..2].position, normal)`. `main.cpp`: `float time;` in `SceneConstantBuffer`;
  in `OnUpdate` `static auto startTime = std::chrono::high_resolution_clock::now();` … `constantBufferData.time =
  std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();`. **Animated** (period
  2π s, apart the most at t = π/2, whole again at t ≈ 4.7 s), in clip space as learnopengl. At **t = 1 s**: the pieces
  fill almost the whole window as a large sphere of small separate quads with dark gaps; centre (400,300), pole
  (400,186), sea (380,215), ring-front (400,420) = 26,26,26 (gaps); (250,310) = 91,134,57 (a land piece); in the strip
  x < 140 ≈ 3,300 non-background pixels (OpenGL ≈ 4,000), in the rows y < 170 ≈ 13,100 (OpenGL ≈ 14,100), in the square
  x 350..449, y 250..349 ≈ 4,900. 0.7 % of the pixels differ from the OpenGL picture at t = 1 s: Direct3D's clip-space z
  (0..w, not -w..w) is a little different, so the face normals, computed in clip space, are too.

## `normals`
- **Task:** learnopengl 9.3: draw the planet as usual (`default.hlsl`, pipeline state `m_pipelineState` without a geometry shader), then a second time with a second pipeline state `m_normalPipelineState` from `normal_visualization.hlsl`, whose geometry shader emits, for each vertex of each triangle, a yellow line of length 0.2 along the vertex normal.
- **Hint:** The vertex shader works in view space and needs the normal matrix: add `XMFLOAT4X4 normalMatrix` to `ModelConstants` (root constants: now 32) and compute it like the Model chapter, `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`. The geometry shader: `static const float MAGNITUDE = 0.2f;`, `void GenerateLine(VSOutput vertex, inout LineStream<GSOutput> lineStream)` appends `mul(vertex.position, projection)` and `mul(vertex.position + float4(vertex.normal, 0.0f) * MAGNITUDE, projection)` and restarts the strip; `[maxvertexcount(6)] void GSMain(triangle VSOutput input[3], inout LineStream<GSOutput> lineStream)` calls it for the three vertices. The normal PSO is the same description with `VS`, `GS`, `PS` from `normal_visualization.hlsl` (its input is still `TRIANGLE`). In `PopulateCommandList` after the first `m_model.Draw`: `SetPipelineState(m_normalPipelineState.Get())` and `m_model.Draw(...)` again. `time` is no longer needed.
- **When done:** `normal_visualization.hlsl`: `static const float MAGNITUDE = 0.2f;`, `GenerateLine(VSOutput vertex, inout
  LineStream<GSOutput> lineStream)` (two `Append`, `RestartStrip()`), `[maxvertexcount(6)] void GSMain(triangle VSOutput
  input[3], inout LineStream<GSOutput> lineStream)` with `GenerateLine(input[0..2], lineStream)`. `main.cpp`:
  `ModelConstants` with `normalMatrix`; `SceneConstantBuffer` without `time` (and the time lines in `OnUpdate`
  removed); member `ComPtr<ID3D12PipelineState> m_normalPipelineState;`; `m_pipelineState` from `default.hlsl` (`vs_5_0`,
  `ps_5_0`, no `psoDesc.GS`); then `normalVertexShader`, `geometryShader` (`"GSMain", "gs_5_0"`), `normalPixelShader`
  from `normal_visualization.hlsl`, `psoDesc.VS/GS/PS` and `CreateGraphicsPipelineState(&psoDesc,
  IID_PPV_ARGS(&m_normalPipelineState))`; `PopulateCommandList`: `normalMatrix` stored, `m_model.Draw(...)`,
  `m_commandList->SetPipelineState(m_normalPipelineState.Get());`, `m_model.Draw(...)`. (`normal_visualization.hlsl`
  normalizes the view-space normal: the model is scaled by 0.5, so the normal matrix makes the normals 2 long and the
  lines would be 0.4 long without it; the view matrix
  only turns and moves the scene, so it turns the world-space normal like a position.) Picture: the unexploded planet of
  `planet` with **yellow (255,255,0) hairs** out of the sphere and up from the ring (≈ 12,400 yellow pixels; bounding box
  x ≈ 139..660, y ≈ 126..472; above the planet, x 300..499, y 120..176, ≈ 2,240 yellow pixels). The planet where no line
  passes: centre (400,300) = 105,140,60, (395,186) = 235,240,245, (350,250) = 84,130,55, (450,350) = 75,127,53, sea
  (380,215) = 28,70,150, ring (160,330) = 164,140,109, (640,330) = 149,128,99; background (100,100), (400,520) = 26,26,26.
  0.6 % of the pixels differ from Mesa (where single lines run). Static. Final state.

## Simulator note (for the lead)
The shipped simulator's D3D12 reader does not use geometry shaders: `D3DCompileFromFile(…, "GSMain", "gs_5_0", …)` and
`psoDesc.GS` are ignored (`DrawCall.GeometryShader` is never set; `PipelineInfo` has no GS). So `houses` and
`roof-white` still show the four points, `explode` shows the whole planet, and `normals` draws the model once more with
the normal PSO's vertex shader (view-space positions taken as clip positions) and no lines. The rasterizer's HLSL
geometry stage itself works with this code: wired in a local copy (the GS compiled last before each
`CreateGraphicsPipelineState` whose `psoDesc.GS` was set after the previous one, and passed to `ModelDraws`), every
picture above came out as described.
