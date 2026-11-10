# colors – DirectX 12

learnopengl.com "Colors": a coral object lit by a white light, and the lamp – a small white cube drawn with its own
shaders. Files: `main.cpp`, `colors.hlsl` (the lit object: `VSMain` / `PSMain`), `light_cube.hlsl` (the lamp: its own
`VSMain` / `PSMain`). learnopengl's two shader programs (`lightingShader`, `lightCubeShader`) are two **pipeline state
objects** here: `m_pipelineState` (colors.hlsl) and `m_lightCubePipelineState` (light_cube.hlsl), both with the same
root signature; `PopulateCommandList` switches with `SetPipelineState` before the lamp's draw.

Start (prepared from the Camera solution): the free camera with its globals, `WindowProc` input and `OnUpdate`
movement stays, but the scene is reduced to what learnopengl starts the lighting part with – **one cube at the origin**
(`XMMatrixIdentity()` as its model matrix), 36 vertices with **positions only** (`struct Vertex { XMFLOAT3 position; }`,
input layout `POSITION` only), no textures any more (no stb_image, no SRVs, no static sampler), clear colour
**(0.1, 0.1, 0.1)** as in learnopengl's lighting chapters. Changes from the camera code:
- Root signature: **root parameter 0** = the 16 root constants of `ModelConstants` (b0, vertex shader), **root
  parameter 1** = a descriptor table with the CBV (b1) – the textures' table is gone, so the indices moved down by one.
  The CBV/SRV heap (`m_cbvSrvHeap`) holds only the CBV, in slot 0.
- `SceneConstantBuffer` (view, projection) has no padding array and no `static_assert` any more: the buffer and its
  CBV get `CalculateConstantBufferByteSize(sizeof(SceneConstantBuffer))` bytes – the size rounded up to a multiple of
  256 (`D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT`), the helper of the samples' DXSampleHelper.h – because the
  struct grows in every lighting chapter.
- The shaders are in `colors.hlsl` (`PSMain` still returns white) and `light_cube.hlsl` (its `VSMain` is complete,
  the same as colors.hlsl's; its `PSMain` has a TODO and returns black – it is not used yet).
- The `D3DCompileFromFile` calls and the PSO description are in one block with `compileFlags` at its top, so the lamp's
  pipeline state can reuse both.

**New default camera for the lighting chapters** (the same in every API): learnopengl's lamp at (1.2, 1, 2) is outside
the view of a camera at (0, 0, 3), so the camera starts front-left of the cube:
`cameraPos = XMVectorSet(-3.0f, 0.0f, 3.0f, 0.0f)`, `cameraFront = XMVector3Normalize(XMVectorSet(3.5f, 0.4f, -2.2f, 0.0f))`,
and the mouse-look globals match it, `yaw = -32.2f`, `pitch = 5.5f` (comment `// camera: look at the cube's lit front
and the lamp from the left`). With no input the view is `XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront,
cameraUp)` with these values. It sees the cube's front face (+z, on the right, x ≈ 233..356) and its left face (−x,
x ≈ 98..235), cube y ≈ 266..477, and the lamp (x ≈ 619..663, y ≈ 172..216). Colors, Basic Lighting, Materials and
Lighting Maps keep this camera; Light Casters and Multiple Lights go back to (0, 0, 3).

Per-frame values (view, projection, the colours, later the light and the material) go into the constant buffer in
`OnUpdate` (a local `SceneConstantBuffer constantBufferData`, then `memcpy`); per-draw values (the model matrix) are
root constants set in `PopulateCommandList` before each draw. HLSL packs a cbuffer in 16-byte rows and never lets a
`float3` cross into the next row, so in the C++ struct every `XMFLOAT3` is followed by a `float padding…` (unless a
`float` member fills the row).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing in this chapter depends on
time). D3D12 cannot run here: the colours come from a software model of this code (the app's simulator) and agree with
OpenGL's Mesa screenshots of the same steps; a GPU may differ by a unit, edges by a pixel. Named points: **front**
(302,370) = centre of the front face, **left** (163,370) = centre of the left face, **lamp** (641,195),
**background** (400,300) and (100,100) = 26,26,26.

Start picture: a flat **white** cube silhouette (front 255,255,255, left 255,255,255), no lamp (lamp point =
background 26,26,26).

## object-color
- **Task:** Colour the cube as learnopengl does: add `float3 objectColor;` and `float3 lightColor;` to the cbuffer `SceneConstantBuffer` in `colors.hlsl` and return `float4(lightColor * objectColor, 1.0f)` from `PSMain`; add the two fields to the C++ struct (each `XMFLOAT3` followed by a `float` of padding), make root parameter 1 visible to the pixel shader too, and in `OnUpdate` set the object's colour to coral (1.0, 0.5, 0.31) and the light's colour to white (1.0, 1.0, 1.0).
- **Hint:** The colour we see is the light's colour multiplied component by component with the object's colour. HLSL starts `lightColor` in a new 16-byte row (a float3 cannot straddle two rows), so the C++ struct needs `float padding0;` after `objectColor` (and `float padding1;` after `lightColor`). The pixel shader now reads the constant buffer: `D3D12_SHADER_VISIBILITY_ALL` for root parameter 1. In `OnUpdate`: `constantBufferData.objectColor = XMFLOAT3(1.0f, 0.5f, 0.31f);`.
- **When done:** `colors.hlsl`: `float3 objectColor;` and `float3 lightColor;` after `projection` in `SceneConstantBuffer`;
  `PSMain` returns `float4(lightColor * objectColor, 1.0f)`. `main.cpp`: `struct SceneConstantBuffer { XMFLOAT4X4 view;
  XMFLOAT4X4 projection; XMFLOAT3 objectColor; float padding0; XMFLOAT3 lightColor; float padding1; };`,
  `rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);`, in `OnUpdate`
  `constantBufferData.objectColor = XMFLOAT3(1.0f, 0.5f, 0.31f);` and `constantBufferData.lightColor =
  XMFLOAT3(1.0f, 1.0f, 1.0f);` before the `memcpy`. The cube is **flat coral 255,128,79** on every visible face (front
  and left the same colour – no shading yet). Lamp point still background.

## lamp-shader
- **Task:** Give the lamp its own shaders and pipeline state: `PSMain` in `light_cube.hlsl` always returns white (`float4(1.0f, 1.0f, 1.0f, 1.0f)`), and `LoadAssets` compiles `light_cube.hlsl`'s `VSMain` and `PSMain` and creates a second pipeline state object, `m_lightCubePipelineState` (a new member), from the same description with these shaders.
- **Hint:** The lamp must stay white whatever we do to the lighting shader later, so it gets its own shaders – and in Direct3D 12 the shaders are part of the pipeline state. Compile into `lightCubeVertexShader` / `lightCubePixelShader` with `D3DCompileFromFile(L"light_cube.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &lightCubeVertexShader, nullptr)` (and `"PSMain"`, `"ps_5_0"`), set `psoDesc.VS` / `psoDesc.PS` with `CD3DX12_SHADER_BYTECODE`, then `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightCubePipelineState))`.
- **When done:** `light_cube.hlsl`: `return float4(1.0f, 1.0f, 1.0f, 1.0f);`. `main.cpp`:
  `ComPtr<ID3D12PipelineState> m_lightCubePipelineState;` after `m_pipelineState`; after the first
  `CreateGraphicsPipelineState`, two `D3DCompileFromFile(L"light_cube.hlsl", …)` calls (VSMain/vs_5_0, PSMain/ps_5_0),
  `psoDesc.VS`/`psoDesc.PS` set from them and `m_device->CreateGraphicsPipelineState(&psoDesc,
  IID_PPV_ARGS(&m_lightCubePipelineState))`. Nothing is drawn with it yet: **no visible change** (coral cube, no lamp).

## lamp
- **Task:** Draw the lamp: a global `XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);`, and in `PopulateCommandList`, after the cube, switch to `m_lightCubePipelineState` and draw the cube again with the model matrix scale 0.2, then translate to `lightPos`.
- **Hint:** `m_commandList->SetPipelineState(m_lightCubePipelineState.Get());` then `model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(lightPos.x, lightPos.y, lightPos.z);` (left to right: first scale, then move – learnopengl's `translate` then `scale`), store it transposed in `modelConstants.model`, `SetGraphicsRoot32BitConstants(0, …)` and `DrawInstanced(36, 1, 0, 0)`. Same root signature, so root parameter 1 (view and projection) stays bound; the vertex buffer stays bound too.
- **When done:** global `// lighting` `XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);` (after `fov`); in
  `PopulateCommandList` after the cube's draw: `SetPipelineState(m_lightCubePipelineState.Get())`, `model =
  XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(lightPos.x, lightPos.y, lightPos.z)`, `XMStoreFloat4x4(…
  XMMatrixTranspose(model))`, `SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0)`, a
  second `DrawInstanced(36, 1, 0, 0)`. A **small white cube** appears at the top right: lamp point (641,195) =
  255,255,255 (x ≈ 619..663, y ≈ 172..216); the coral cube unchanged (front, left 255,128,79). Final state (=
  learnopengl's `colors.cpp` with the course's camera globals).
