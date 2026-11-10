# stencil-testing – DirectX 12

learnopengl.com "Stencil testing" (object outlining): `stencil_testing.cpp` with `2.stencil_testing.vs/.fs` and
`2.stencil_single_color.fs`. Files: `main.cpp`, `stencil_testing.hlsl`, `stencil_single_color.hlsl`, `marble.png`,
`metal.png`.

Start: the Depth testing scene drawn normally (marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor, LESS, camera
at (0, 0, 3)), with learnopengl's draw order of this chapter: **floor first**, then the cubes. Same structure as
depth-testing (one vertex buffer: cube 0–35, floor 36–41; one SRV per texture; `SetGraphicsRootDescriptorTable(2, …)`
before each draw). The depth buffer is still `DXGI_FORMAT_D32_FLOAT`. `stencil_single_color.hlsl` already has the
outline's vertex shader (`VSMain`: position only, same matrices) and a `PSMain` with a TODO that returns black. TODO
comments mark every place a task fills in: the depth buffer's format, the PSO's stencil state, the outline PSO, the
stencil clear, and the three draw passes in `PopulateCommandList`.

D3D12 notes: the stencil test's function, operations and masks are part of the **pipeline state object**
(`DepthStencilState`), so every combination learnopengl switches with `glStencilFunc` / `glStencilMask` /
`glDisable(GL_DEPTH_TEST)` is a PSO of its own – `m_floorPipelineState` (no stencil writes), `m_pipelineState` (cubes,
write 1), `m_singleColorPipelineState` (outlines) – selected with `SetPipelineState`. Only the reference value is
command-list state: `m_commandList->OMSetStencilRef(1)`. Front and back faces get the same stencil state
(`BackFace = FrontFace`; nothing is culled). Nothing needs restoring after the outlines (OpenGL's `glStencilMask(0xFF)`
before the next `glClear`): `ClearDepthStencilView` ignores the PSO's write mask, and `Reset` sets the reference back
to 0.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). D3D12 cannot run here:
the colours come from the app's simulator and agree with the OpenGL project's Mesa screenshots of the same steps
(OpenGL's mipmaps make cube 1 a little brighter). Named points: **c0** (190,300) = cube 0's front face, **c0-low**
(190,380), **c1** (760,300) = cube 1, **floor-near** (400,520), **floor-left** (150,450), **background** (400,300) =
26,26,26, and the outline ring: **ring-left** (82,300) and (82,380) left of cube 0, **ring-top** (190,191) above cube 0,
**ring-bottom** (190,406) below cube 0 (over the floor), **ring-c1** (704,300) left of cube 1.

Start picture (and after stencil-buffer, single-color and write-stencil – none of them changes the picture): c0 ≈
151,150,147, c0-low 206,202,193, c1 ≈ 139,138,136 (OpenGL 149,147,145), floor-near 84,88,94, floor-left 139,143,149,
ring points = background 26,26,26 except ring-bottom = the floor ≈ 134,138,144 (OpenGL 143,147,153).

## stencil-buffer
- **Task:** Give the depth buffer a stencil part (`DXGI_FORMAT_D24_UNORM_S8_UINT` in the view, the clear value, the texture and the PSO's `DSVFormat`), turn the stencil test on in the PSO with the operations KEEP, KEEP, REPLACE for front and back faces, and clear the stencil buffer too.
- **Hint:** `psoDesc.DepthStencilState.StencilEnable = TRUE;` and `FrontFace.StencilFailOp = D3D12_STENCIL_OP_KEEP`, `FrontFace.StencilDepthFailOp = D3D12_STENCIL_OP_KEEP`, `FrontFace.StencilPassOp = D3D12_STENCIL_OP_REPLACE`, then `BackFace = FrontFace` (OpenGL: `glEnable(GL_STENCIL_TEST); glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);`). Clear with `D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL` (stencil value 0 – the 4th argument).
- **When done:** `main.cpp`: `DXGI_FORMAT_D24_UNORM_S8_UINT` in `depthStencilDesc.Format`, `depthOptimizedClearValue.Format`,
  `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D24_UNORM_S8_UINT, …)` and `psoDesc.DSVFormat` (no `DXGI_FORMAT_D32_FLOAT`
  left); `StencilEnable = TRUE`, `FrontFace.StencilFailOp = D3D12_STENCIL_OP_KEEP`, `FrontFace.StencilDepthFailOp =
  D3D12_STENCIL_OP_KEEP`, `FrontFace.StencilPassOp = D3D12_STENCIL_OP_REPLACE`, `BackFace = FrontFace` before the
  PSO is created; `ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL, 1.0f, 0, 0,
  nullptr)`. No visible change (the stencil function is the default ALWAYS and the reference value 0: every pixel
  writes 0).

## single-color
- **Task:** Make the outline's pixel shader (`stencil_single_color.hlsl`) return `float4(0.04f, 0.28f, 0.26f, 1.0f)`, and create a second pipeline state `m_singleColorPipelineState` with that file's shaders.
- **Hint:** Declare `ComPtr<ID3D12PipelineState> m_singleColorPipelineState;`, compile `VSMain` / `PSMain` of `stencil_single_color.hlsl` into `singleColorVertexShader` / `singleColorPixelShader` after `m_pipelineState` is created, set `psoDesc.VS` / `psoDesc.PS` and call `CreateGraphicsPipelineState` again – like the lamp's PSO in the lighting chapters.
- **When done:** `stencil_single_color.hlsl`: `PSMain` returns `float4(0.04f, 0.28f, 0.26f, 1.0f)`. `main.cpp`: member
  `m_singleColorPipelineState`, `D3DCompileFromFile(L"stencil_single_color.hlsl", …, "VSMain", "vs_5_0", …)` and
  `(…, "PSMain", "ps_5_0", …)`, then `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_singleColorPipelineState))`
  (a `// TODO: the outline's depth and stencil state` line stays before it for the last task). Not used yet: no
  visible change.

## write-stencil
- **Task:** Draw the floor with a PSO that writes nothing to the stencil buffer (`m_floorPipelineState`, `StencilWriteMask = 0x00`) and the cubes with `m_pipelineState`, whose stencil test always passes (`StencilFunc = D3D12_COMPARISON_FUNC_ALWAYS`, write mask 0xFF), after `OMSetStencilRef(1)` – so the stencil buffer holds 1 wherever a cube is.
- **Hint:** Before `m_pipelineState` is created: set `psoDesc.DepthStencilState.StencilWriteMask = 0x00;` and create `m_floorPipelineState`; then `StencilWriteMask = 0xFF`, `FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_ALWAYS`, `BackFace = FrontFace`. In `PopulateCommandList`: `m_commandList->SetPipelineState(m_floorPipelineState.Get());` before the floor, `SetPipelineState(m_pipelineState.Get()); m_commandList->OMSetStencilRef(1);` before the cubes (OpenGL: `glStencilMask(0x00)` / `glStencilFunc(GL_ALWAYS, 1, 0xFF); glStencilMask(0xFF);`).
- **When done:** `main.cpp`: member `m_floorPipelineState`; in `LoadAssets` `StencilWriteMask = 0x00` +
  `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_floorPipelineState))`, then `StencilWriteMask = 0xFF`,
  `FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_ALWAYS`, `BackFace = FrontFace`, `m_pipelineState` created (the
  outline PSO after it inherits these). In `PopulateCommandList`: `SetPipelineState(m_floorPipelineState.Get())`
  before the floor's draw, `SetPipelineState(m_pipelineState.Get())` and `OMSetStencilRef(1)` before the cubes'.
  No visible change (the stencil buffer is 1 under both cubes, 0 elsewhere).

## outline
- **Task:** Give the outline PSO the state "draw where the stencil value is not 1, write no stencil, no depth test" and draw both cubes once more with it, scaled by 1.1.
- **Hint:** Before `m_singleColorPipelineState` is created: `FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_NOT_EQUAL`, `BackFace = FrontFace`, `StencilWriteMask = 0x00`, `DepthEnable = FALSE`. In `PopulateCommandList`, after the cubes: `SetPipelineState(m_singleColorPipelineState.Get())`, `float scale = 1.1f;` and for each cube `model = XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(…)` (scale first, then move – DirectXMath multiplies left to right), root constants, `DrawInstanced(36, 1, 0, 0)`. The reference value 1 set before the cubes still holds.
- **When done:** `main.cpp`: `StencilFunc = D3D12_COMPARISON_FUNC_NOT_EQUAL`, `StencilWriteMask = 0x00`, `DepthEnable =
  FALSE` before `m_singleColorPipelineState`; after the cubes' draws `SetPipelineState(m_singleColorPipelineState.Get())`,
  `float scale = 1.1f;`, two draws of 36 vertices with `XMMatrixScaling(scale, scale, scale) *
  XMMatrixTranslation(-1.0f, 0.0f, -1.0f)` and `… * XMMatrixTranslation(2.0f, 0.0f, 0.0f)` (5 draws in all). Both cubes
  get a **dark teal outline** 10,71,66 (= 0.04, 0.28, 0.26), drawn over the background and the floor alike: ring-left
  (82,300) and (82,380) 10,71,66, ring-top (190,191) 10,71,66, ring-bottom (190,406) 10,71,66, ring-c1 (704,300)
  10,71,66. Inside the cubes nothing changes (c0 151,150,147, c0-low 206,202,193, c1 ≈ 139,138,136); floor-near
  84,88,94, background 26,26,26.
