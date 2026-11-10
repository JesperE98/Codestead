# anti-aliasing – DirectX 12

learnopengl.com "Anti Aliasing": `11.1.anti_aliasing_msaa` and `11.2.anti_aliasing_offscreen`; vulkan-tutorial
"Multisampling". Direct3D 12 has no multisampled window: a flip model swap chain (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) must
have `SampleDesc.Count = 1`. So the scene is drawn into a **multisampled render target** – a texture with
`SampleDesc.Count = 4` and its own render target view – with a depth buffer of the same sample count and a pipeline
state with `SampleDesc.Count = 4`, and then **resolved** (`ResolveSubresource`: every pixel gets the average of its
samples) into a single-sampled resource, with barriers to `RESOLVE_SOURCE` / `RESOLVE_DEST` (Microsoft Learn:
"ID3D12GraphicsCommandList::ResolveSubresource", "D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS"; the pattern of
Microsoft's SimpleMSAA sample). D3D12's `msaa` task therefore is learnopengl's 11.2 already (off-screen + resolve into
the window); there is no separate `offscreen-msaa` task. `resolve` resolves into a texture instead and shows it with a
screen quad (learnopengl's intermediate FBO), `post-process` adds the grayscale effect.
Files: `main.cpp`, `anti_aliasing.hlsl` (the cube: `model`, `view`, `projection`, flat green `float4(0.0f, 1.0f, 0.0f,
1.0f)`), `aa_post.hlsl` (the screen quad, used from `resolve` on).

Start: learnopengl 11.1's scene without multisampling – one cube (36 vertices, positions only) at the origin, flat green,
clear (0.1, 0.1, 0.1), depth test on, the course's camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45,
800/600, 0.1, 100; WASD / mouse / wheel work as in the camera chapter), root constants `ModelConstants` (b0) and the
CBV `SceneConstantBuffer { view; projection; }` (b1) – the colors chapter's program without the lamp. TODOs: the
multisampled render target in `LoadAssets` (`main.cpp`) and the grayscale effect in `aa_post.hlsl`.

**Deviation from learnopengl (as in the OpenGL project):** the cube is turned by a fixed
`XMMatrixRotationAxis(XMVectorSet(1.0f, 1.0f, 0.0f, 0.0f), XMConvertToRadians(30.0f))`. learnopengl's unrotated cube,
seen from (0, 0, 3), is a square with horizontal and vertical edges, which show no stairs.

Pixels: 800×600 client area from the top left; nothing depends on time (the simulator marks the scene animated only
because `OnUpdate` reads the clock for the camera's movement). The silhouette (a hexagon of three faces, all the same
green) covers x 256..590, y 157..490. Background 26,26,26. D3D12 cannot run here: the values are the app's simulator's,
which follows this code (multisampled render target, `SampleDesc.Count`, `ResolveSubresource`, the screen quad); they
match the OpenGL project's Mesa screenshots of the same steps (0.07 % of the pixels differ, all on the edges).

**Start picture:** the green silhouette with **hard, stair-stepped edges**: exactly two colours, 0,255,0 and 26,26,26
(0 mixed edge pixels). Centre (400,300) = 0,255,0; (257,350) and (567,350) = 0,255,0 (the left and right edges of row
350); background (100,100), (200,150), (600,450), (100,500) = 26,26,26.

How to check smooth edges: count the pixels that are neither background nor pure green (after `post-process`: nor pure
182 grey). With 4× MSAA the edge pixels get the mixes 1/4, 2/4, 3/4 of green and background: the simulator gives 809
such pixels – 340 × 19,83,19, 228 × 13,140,13, 241 × 6,198,6 (Mesa ≈ 806). Which edge pixel gets which mix depends on
the GPU's sample positions – check the count (several hundred, > 300) rather than single edge pixels.

## `msaa`
- **Task:** Turn on 4× multisample anti-aliasing: draw the scene into a multisampled render target (4 samples per pixel) with a multisampled depth buffer and a pipeline state for 4 samples, then resolve it into the back buffer with `ResolveSubresource`.
- **Hint:** `static const UINT SampleCount = 4;`. Check the support with `CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, …)` (`NumQualityLevels > 0`). The render target: `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, SampleCount, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, created in the `RENDER_TARGET` state with a clear value of (0.1, 0.1, 0.1, 1), and its RTV after the swap chain's (the RTV heap needs `FrameCount + 1` descriptors). The depth buffer gets the same sample count and a `D3D12_DSV_DIMENSION_TEXTURE2DMS` view; the PSO `psoDesc.SampleDesc.Count = SampleCount`. In `PopulateCommandList` draw into the multisampled target, then barriers (target `RENDER_TARGET` → `RESOLVE_SOURCE`, back buffer `PRESENT` → `RESOLVE_DEST`), `ResolveSubresource(back buffer, 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM)` and the barriers back.
- **When done:** `main.cpp`: `static const UINT SampleCount = 4;`, member `ComPtr<ID3D12Resource> m_msaaRenderTarget;`,
  `rtvHeapDesc.NumDescriptors = FrameCount + 1;`, `psoDesc.SampleDesc.Count = SampleCount;`; in `LoadAssets` a block
  with `D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels` (`Format = DXGI_FORMAT_R8G8B8A8_UNORM`,
  `SampleCount = SampleCount`), `CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels,
  sizeof(qualityLevels))` and a `throw` when `NumQualityLevels == 0`, `CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM,
  optimizedClearColor)`, `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, SampleCount, 0,
  D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, `CreateCommittedResource(…, D3D12_RESOURCE_STATE_RENDER_TARGET, &clearValue,
  IID_PPV_ARGS(&m_msaaRenderTarget))`, `CreateRenderTargetView(m_msaaRenderTarget.Get(), nullptr, rtvHandle)` at RTV
  slot `FrameCount`; depth buffer `ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DMS` and `Tex2D(DXGI_FORMAT_D32_FLOAT,
  m_width, m_height, 1, 1, SampleCount, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)`. `PopulateCommandList`:
  `OMSetRenderTargets(1, &msaaRtvHandle, FALSE, &dsvHandle)` (RTV slot `FrameCount`), `ClearRenderTargetView(msaaRtvHandle,
  …)`, the cube's draw, `CD3DX12_RESOURCE_BARRIER barriers[2]` (`m_msaaRenderTarget` RENDER_TARGET → RESOLVE_SOURCE, back
  buffer PRESENT → RESOLVE_DEST), `ResolveSubresource(m_renderTargets[m_frameIndex].Get(), 0, m_msaaRenderTarget.Get(), 0,
  DXGI_FORMAT_R8G8B8A8_UNORM)`, barriers back (RESOLVE_SOURCE → RENDER_TARGET, RESOLVE_DEST → PRESENT); the back buffer's
  PRESENT → RENDER_TARGET barrier and its RTV are gone. **The cube's edges become smooth**: 809 edge pixels in between
  green and background (e.g. (257,350) = (567,350) = (304,480) = 6,198,6; Mesa: 7,198,7 / 7,198,7 / 13,140,13); centre
  (400,300) = 0,255,0 and the background unchanged.

## `resolve`
- **Task:** Resolve into a texture instead of the back buffer (learnopengl 11.2's intermediate framebuffer), so the anti-aliased image can be post-processed: a single-sampled texture `m_screenTexture` with an SRV, resolved into each frame, then drawn to the window by a screen-filling quad (`aa_post.hlsl`, its own pipeline state without depth test).
- **Hint:** A shader cannot sample a multisampled texture like a normal one, but `ResolveSubresource` into a normal texture gives the averaged image. `m_screenTexture`: `Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1)`, created in `PIXEL_SHADER_RESOURCE`, its SRV in CBV/SRV heap slot 1 (the heap needs 2 descriptors). The root signature gets parameter 2 (a table with 1 SRV at t0, pixel shader) and a static sampler. The quad: learnopengl's `quadVertices` with v flipped (Direct3D's v = 0 is the top row), `struct QuadVertex { XMFLOAT2 position; XMFLOAT2 texCoord; }`, its own vertex buffer. Its PSO: `aa_post.hlsl`, the quad's input layout, `DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN` and `SampleDesc.Count = 1` (the back buffer has one sample). After the resolve: back buffer PRESENT → RENDER_TARGET, `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`, clear white, `SetPipelineState(m_screenPipelineState.Get())`, `SetGraphicsRootDescriptorTable(2, …slot 1…)`, the quad's vertex buffer, `DrawInstanced(6, 1, 0, 0)`, back to PRESENT.
- **When done:** `main.cpp`: `struct QuadVertex`; members `m_screenPipelineState`, `m_quadVertexBuffer`,
  `m_quadVertexBufferView`, `m_screenTexture`; `cbvSrvHeapDesc.NumDescriptors = 2;`; `CD3DX12_DESCRIPTOR_RANGE ranges[2]`
  (`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`), `CD3DX12_ROOT_PARAMETER rootParameters[3]` with
  `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`, `D3D12_STATIC_SAMPLER_DESC
  samplers[1]` and `rootSignatureDesc.Init(…, _countof(samplers), samplers, …)`; `D3D12_INPUT_ELEMENT_DESC
  quadInputElementDescs[]` (`POSITION` R32G32 at 0, `TEXCOORD` R32G32 at 8), `D3DCompileFromFile(L"aa_post.hlsl", …)` (VS,
  PS), `psoDesc.DepthStencilState.DepthEnable = FALSE;`, `psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;`,
  `psoDesc.SampleDesc.Count = 1;`, `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_screenPipelineState))`; the
  quad's vertex buffer (6 `QuadVertex`); the screen texture block (`CreateCommittedResource(…,
  D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, nullptr, IID_PPV_ARGS(&m_screenTexture))`,
  `CreateShaderResourceView(m_screenTexture.Get(), &srvDesc, srvHandle)` at slot 1). `PopulateCommandList`: barriers
  `m_msaaRenderTarget` RENDER_TARGET → RESOLVE_SOURCE and `m_screenTexture` PIXEL_SHADER_RESOURCE → RESOLVE_DEST,
  `ResolveSubresource(m_screenTexture.Get(), 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM)`, barriers back;
  then the back buffer pass (`screenClearColor` `{ 1.0f, 1.0f, 1.0f, 1.0f }`, `SetPipelineState(m_screenPipelineState.Get())`,
  `SetGraphicsRootDescriptorTable(2, screenTexture)` with `CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(…, 1,
  m_cbvSrvDescriptorSize)`, `IASetVertexBuffers(0, 1, &m_quadVertexBufferView)`, `DrawInstanced(6, 1, 0, 0)`).
  **No visible change** (the smooth cube of `msaa`, pixel for pixel: 809 mixed edge pixels, centre 0,255,0, background
  26,26,26; the white clear is completely covered by the quad).

## `post-process`
- **Task:** Post-process the anti-aliased image: show it in grey in `aa_post.hlsl` (learnopengl's weighted grayscale 0.2126 / 0.7152 / 0.0722).
- **Hint:** `float grayscale = 0.2126f * col.r + 0.7152f * col.g + 0.0722f * col.b;` then `return float4(grayscale, grayscale, grayscale, 1.0f);`. The effect works on the resolved image, so the edges stay smooth.
- **When done:** `aa_post.hlsl`: `float grayscale = 0.2126f * col.r + 0.7152f * col.g + 0.0722f * col.b;` and
  `return float4(grayscale, grayscale, grayscale, 1.0f);`. **The cube turns grey**: inside (400,300) = 182,182,182
  (0.7152 × 255), background (100,100) = 26,26,26 (grey stays grey), smooth grey edges 65 / 104 / 143 (809 mixed pixels,
  e.g. (257,350) = 143,143,143; Mesa 144). Static. Final state.
