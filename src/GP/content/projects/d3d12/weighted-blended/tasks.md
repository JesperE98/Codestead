# Weighted Blended OIT – tasks (DirectX 12)

learnopengl "Guest Articles / OIT / Weighted Blended": `src/8.guest/2020/oit/weighted_blended.cpp` with its shaders,
written the D3D12HelloWorld way (one `main.cpp`, class `D3D12App`, `LoadPipeline` / `LoadAssets` /
`PopulateCommandList`). Files: `main.cpp`, `solid.hlsl`, `transparent.hlsl`, `composite.hlsl`, `screen.hlsl`
(learnopengl's solid / transparent / composite / screen shader pairs, each file with `VSMain` and `PSMain`). No textures.
The start is the `oit-introduction` chapter's project (the problem the introduction describes: unsorted alpha blending).

**Screenshot time: 1.0 s** (nothing moves: every picture is the same at any time).

**Fixed choices (the same in every API – see the OpenGL tasks.md):**
- Window 800×600, camera (0, 0, 5) looking down -z (the camera globals: yaw -90, pitch 0, fov 45, 800/600, near 0.1,
  far 100; `XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH` as in the whole course), no input. Clear colour (0, 0, 0, 0).
- Three 2×2 quads (learnopengl's `quadVertices`, 6 vertices, `POSITION` + `TEXCOORD` with v flipped for Direct3D) placed
  with learnopengl's `calculate_model_matrix(position, rotation, scale)` (a free function returning an `XMMATRIX`:
  `Scaling * RotationZ * RotationY * RotationX * Translation`, the row-vector order of learnopengl's translate · rotate ·
  scale); the three model matrices are computed once in `LoadAssets` (members `m_redModelMat`, `m_greenModelMat`,
  `m_blueModelMat`, `XMFLOAT4X4`): **red** opaque (1, 0, 0) at (0.5, -0.2, 1.0); **green** (0, 1, 0, 0.5) at
  (-0.3, -0.6, 2.0) – the nearest; **blue** (0, 0, 1, 0.5) at (-0.6, 0.5, 0.0) – the farthest, partly behind the red
  quad. Drawing order red, green, blue (learnopengl's).
- Per draw, root constants (root parameter 0, b0, 20 values): `struct ObjectConstants { XMFLOAT4X4 mvp; XMFLOAT4 color; }`
  = HLSL `cbuffer ObjectConstants` – learnopengl's uniforms `mvp` and `color`. `PopulateCommandList` computes
  `projection`, `view` and `vp = view * projection` (learnopengl's `projection * view` in row-vector order) and per draw
  `XMMatrixTranspose(XMLoadFloat4x4(&m_redModelMat) * vp)`; the shaders use `mul(float4(position, 1.0f), mvp)`.
- No culling (`CullMode = D3D12_CULL_MODE_NONE` – learnopengl draws both sides; the quads are counter-clockwise on
  screen).
- Root parameter 1: a descriptor table of **two SRVs** (t0, t1), pixel shader only, and a static sampler s0 (linear,
  clamp) – the screen quads' textures. It is in the start already (unused there), and so are the descriptor heaps at
  their final sizes: RTV heap `FrameCount + 3` (the back buffers, then the opaque, accum and reveal textures), SRV heap 3
  (slot 0 opaque, 1 accum, 2 reveal – so the composite pass's table starts at slot 1 (t0 accum, t1 reveal) and the final
  pass's at slot 0 (t0 opaque)), DSV heap 1 with the depth buffer (`D32_FLOAT`, `m_depthTexture`).
- **The D3D12 equivalents of learnopengl's state:** `glBlendFunci` → `BlendState.IndependentBlendEnable = TRUE` with
  `RenderTarget[0]` (accum: ONE / ONE, ADD) and `RenderTarget[1]` (reveal: ZERO / INV_SRC_COLOR, ADD – the alpha factors
  ZERO / INV_SRC_ALPHA, because Direct3D does not allow _COLOR factors for alpha; R8 has no alpha anyway);
  `glDepthMask(GL_FALSE)` → `DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`; `glDepthFunc(GL_ALWAYS)` →
  `DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS`; `glClearBufferfv` per attachment → `ClearRenderTargetView` on each RTV;
  framebuffers → render target views passed to `OMSetRenderTargets` (two at once for the transparent pass); the shared
  depth texture → the same DSV bound in the solid, transparent and composite passes; `texelFetch(…, ivec2(gl_FragCoord.xy), 0)`
  → `Texture2D.Load(int3(int2(input.position.xy), 0))`; `gl_FragCoord.z` → `SV_POSITION.z` (Direct3D's depth is 0…1 like
  OpenGL's window depth; both weights are clamped to 3000 here, so the pictures match); `layout (location = 1) out float
  reveal` → a `PSOutput` struct with `float4 accum : SV_TARGET0; float reveal : SV_TARGET1;`. Formats: opaque and accum
  `DXGI_FORMAT_R16G16B16A16_FLOAT`, reveal `DXGI_FORMAT_R8_UNORM`. The resource states: each off-screen texture rests
  in `PIXEL_SHADER_RESOURCE` and is turned into a `RENDER_TARGET` for the pass that draws into it (barriers).

**What the camera sees** (pixels from the top left): the red quad x 309..671, y 155..516; the green quad x 86..568,
y 203..599; the blue quad x 168..457, y 83..371 (its lower right part x 309..457, y 155..371 behind the red quad).
Named points: **red** (620,300), **green-over-red** (450,400), **green** (200,450), **blue** (250,120), **overlap**
(230,300) (green in front of blue, no red behind), **red-over-blue** (400,180), **background** (700,80).

**Start picture** (`oit-introduction`'s project: everything drawn straight into the back buffer with a depth buffer;
the transparent pipeline state blends SRC_ALPHA / INV_SRC_ALPHA with depth writes on, green before blue – the wrong
order): red = 255,0,0, green-over-red = 127,128,0 (128,128,0 in the simulator: rounding), green = 0,128,0, blue =
0,0,128, **overlap = 0,128,0** (the green quad wrote its depth first, so the blue quad behind it fails the depth test –
its lower left corner is cut off along the green quad's top edge y = 203), red-over-blue = 255,0,0, background = 0,0,0.

## `opaque-pass`
- **Task:** Render the scene into an off-screen "opaque" texture (`DXGI_FORMAT_R16G16B16A16_FLOAT`, with an RTV and an SRV) instead of the back buffer, and copy it to the window at the end of the frame with a screen pipeline state (`screen.hlsl`).
- **Hint:** `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` in a default heap, created in `PIXEL_SHADER_RESOURCE` with a clear value; its RTV in RTV heap slot `FrameCount`, its SRV in SRV heap slot 0. The solid pipeline state's `RTVFormats[0]` becomes the texture's format. In `PopulateCommandList`: barrier PIXEL_SHADER_RESOURCE → RENDER_TARGET, `OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle)`, clear; at the end the final pass: barriers (opaque → PIXEL_SHADER_RESOURCE, back buffer PRESENT → RENDER_TARGET), the back buffer without a depth buffer, clear, `m_screenPipelineState`, table at the SRV heap's start, `DrawInstanced(6, 1, 0, 0)`.
- **When done:** `main.cpp`: `psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT` for the solid (and so the
  transparent) pipeline state; the screen pipeline state (`D3DCompileFromFile(L"screen.hlsl", …)`, no blending,
  `DepthEnable = FALSE`, `NumRenderTargets = 1`, `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM`, `DSVFormat =
  DXGI_FORMAT_UNKNOWN`, `IID_PPV_ARGS(&m_screenPipelineState)`); `m_opaqueTexture` (R16G16B16A16_FLOAT,
  `ALLOW_RENDER_TARGET`, `CreateRenderTargetView` at RTV slot `FrameCount`, `CreateShaderResourceView` at SRV slot 0); in
  `PopulateCommandList` the barrier `m_opaqueTexture` PIXEL_SHADER_RESOURCE → RENDER_TARGET and `OMSetRenderTargets(1,
  &opaqueRtvHandle, FALSE, &dsvHandle)` before the solid pass's clears, and the final-pass block (`finalBarriers`,
  `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`, `SetPipelineState(m_screenPipelineState.Get())`,
  `SetGraphicsRootDescriptorTable(1, m_srvHeap->GetGPUDescriptorHandleForHeapStart())`, `DrawInstanced(6, 1, 0, 0)`). The
  transparent quads are still blended the ordinary way (now into the opaque texture). **No visible change** (the same
  points as the start; green-over-red = 128,128,0 – the 16-bit float target rounds like OpenGL's).

## `transparent-pass`
- **Task:** Draw the transparent quads into two render targets at once – accum (`R16G16B16A16_FLOAT`, blended ONE / ONE, cleared to 0) and reveal (`R8_UNORM`, blended ZERO / INV_SRC_COLOR, cleared to 1) – with the solid pass's depth buffer, depth writes off. The transparent pixel shader writes the weighted, premultiplied colour to `SV_TARGET0` and the alpha to `SV_TARGET1`.
- **Hint:** The pipeline state: `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`, `NumRenderTargets = 2`, `RTVFormats[1] = DXGI_FORMAT_R8_UNORM`, `BlendState.IndependentBlendEnable = TRUE` (without it every target uses `RenderTarget[0]`), then `RenderTarget[0]` and `RenderTarget[1]`. The textures: like the opaque one, RTVs at `FrameCount + 1` / `+ 2`, SRVs at 1 / 2. In `PopulateCommandList`: barriers for both, `OMSetRenderTargets(2, transparentRtvHandles, FALSE, &dsvHandle)`, `ClearRenderTargetView` with `zeroFillerVec` / `oneFillerVec`, and after the blue quad the barriers back to PIXEL_SHADER_RESOURCE. `transparent.hlsl`: `struct PSOutput { float4 accum : SV_TARGET0; float reveal : SV_TARGET1; };`, learnopengl's weight with `input.position.z`.
- **When done:** `main.cpp`: the transparent pipeline state with `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`,
  `NumRenderTargets = 2`, `RTVFormats[0] = R16G16B16A16_FLOAT`, `RTVFormats[1] = R8_UNORM`, `IndependentBlendEnable =
  TRUE`, `RenderTarget[0]` ONE/ONE/ADD, `RenderTarget[1]` ZERO/INV_SRC_COLOR/ADD; `m_accumTexture` and `m_revealTexture`
  with their RTVs and SRVs; in `PopulateCommandList` the `transparentBarriers` (PIXEL_SHADER_RESOURCE → RENDER_TARGET
  before, back after the two quads), `OMSetRenderTargets(2, transparentRtvHandles, FALSE, &dsvHandle)`, the clears to 0
  and 1. `transparent.hlsl`: `PSOutput` with `SV_TARGET0` / `SV_TARGET1`, the weight function
  `clamp(pow(min(1.0f, color.a * 10.0f) + 0.01f, 3.0f) * 1e8 * pow(1.0f - input.position.z * 0.9f, 3.0f), 1e-2, 3e3)`,
  `output.accum = float4(color.rgb * color.a, color.a) * weight`, `output.reveal = color.a`. The transparent quads go
  into textures nobody shows yet: the window shows **only the red quad** on black: red = green-over-red =
  red-over-blue = 255,0,0; green, blue, overlap, background = 0,0,0.

## `composite`
- **Task:** Composite the transparent result over the opaque image: a pipeline state for `composite.hlsl` (depth function ALWAYS, depth writes off, blending SRC_ALPHA / INV_SRC_ALPHA, one R16G16B16A16_FLOAT target) and, after the transparent pass, a screen quad drawn into the opaque texture with accum (t0) and reveal (t1). The pixel shader divides the accumulated colour by the accumulated alpha and uses `1 - revealage` as the alpha.
- **Hint:** `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS`, `NumRenderTargets = 1`, `RTVFormats[1] = DXGI_FORMAT_UNKNOWN`, a fresh `CD3DX12_BLEND_DESC(D3D12_DEFAULT)` with `RenderTarget[0]` SRC_ALPHA / INV_SRC_ALPHA. In `PopulateCommandList`: `OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle)`, `SetPipelineState(m_compositePipelineState.Get())`, the table at SRV heap slot 1 (`CD3DX12_GPU_DESCRIPTOR_HANDLE(…, 1, m_srvDescriptorSize)`), `DrawInstanced(6, 1, 0, 0)`. `composite.hlsl`: `int2 coords = int2(input.position.xy)`, `reveal.Load(int3(coords, 0)).r` (learnopengl's `texelFetch`), `discard` where the revealage is (approximately) 1, the `isinf` overflow guard, `average_color = accumulation.rgb / max(accumulation.a, EPSILON)`.
- **When done:** `main.cpp`: the composite pipeline state (`D3DCompileFromFile(L"composite.hlsl", …)`, `DepthFunc =
  D3D12_COMPARISON_FUNC_ALWAYS`, blending SRC_ALPHA / INV_SRC_ALPHA, `IID_PPV_ARGS(&m_compositePipelineState)`); the
  composite block in `PopulateCommandList` between the transparent pass and the final pass. `composite.hlsl`: `Texture2D
  accum : register(t0)`, `Texture2D reveal : register(t1)`, `EPSILON`, `isApproximatelyEqual`, `max3`, `Load`,
  `discard`, `isinf`, `average_color`, `return float4(average_color, 1.0f - revealage)`. The transparent quads are back,
  **independent of their drawing order**: red = 255,0,0, green-over-red = 127,128,0, green = 0,128,0, blue = 0,0,128,
  red-over-blue = 255,0,0 (the blue quad is still hidden behind the red one: the shared depth buffer), background =
  0,0,0, and **overlap = 0,96,96** (start 0,128,0): the average colour (0, 0.5, 0.5) with alpha 1 - 0.5 · 0.5 = 0.75 over
  black – the blue quad's lower left corner now shows through the green quad. Ordinary blending sorted back to front
  would give 0,128,64: weighted blended OIT approximates. This is the solution.

*Simulator* (lead): states 0–2 match the pictures above. The solution needs `Texture2D.Load`, `isinf`, per-render-target
blend states (`IndependentBlendEnable`) and the clear of the second render target of an MRT set (reveal cleared to 1) –
see the D3D12 writer's report.
