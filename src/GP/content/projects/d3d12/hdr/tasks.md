# HDR – tasks (DirectX 12)

learnopengl.com "HDR": `src/5.advanced_lighting/6.hdr`; the Direct3D 12 side keeps the framebuffers chapter's off-screen
render target (a default-heap texture with `ALLOW_RENDER_TARGET`, an RTV in the RTV heap after the swap chain's buffers,
an SRV in the shader-visible heap, barriers RENDER_TARGET ↔ PIXEL_SHADER_RESOURCE, a screen-quad pipeline state without
depth) – now with a floating-point format, `DXGI_FORMAT_R16G16B16A16_FLOAT`. Files: `main.cpp`, `lighting.hlsl`
(learnopengl's 6.lighting – the tunnel's shaders), `hdr.hlsl` (the screen quad's shaders, learnopengl's 6.hdr: `VSMain`
complete, `PSMain` a TODO that returns black – the file is not compiled before `float-buffer`), `wood.png`.

**Fixed choices (the same in every API):**
- **Camera: (0, 0, 5) looking down +z – yaw = +90°** (`cameraFront` (0, 0, 1), pitch 0, fov 45, 800/600, near 0.1, far
  100). learnopengl's hdr demo starts at (0, 0, 5) with its camera looking down -z; that shows only the tunnel's near end
  wall (z = -2.5, almost black). The tunnel and its bright end (z = 52.5) lie in +z, so the camera is turned round (the
  globals `cameraFront` and `yaw` say so in a comment).
- Scene: one vertex buffer – learnopengl's `renderCube` cube (vertices 0–35: 2×2×2, normals, texture coordinates with v
  flipped) and, from `float-buffer` on, the screen quad (36–41: two triangles in NDC, v = 0 at the top). The tunnel: model
  = `XMMatrixScaling(2.5f, 2.5f, 27.5f) * XMMatrixTranslation(0.0f, 0.0f, 25.0f)` (row vectors: learnopengl's translate ·
  scale) – from z = -2.5 to 52.5, ±2.5 in x/y – with `inverseNormals = TRUE` (learnopengl's `inverse_normals`: the vertex
  shader negates the normal so the inside is lit); no culling; depth test on; clear (0.1, 0.1, 0.1) (never visible).
- Root constants (root parameter 0, `cbuffer ModelConstants : register(b0)`): `model`, `normalMatrix`
  (transpose(inverse(model)), stored transposed = `XMMatrixInverse(nullptr, model)`), `BOOL inverseNormals` – 33 values.
  Per frame (CBV, `cbuffer SceneConstantBuffer : register(b1)`): `view`, `projection`, `Light lights[4]` (learnopengl's
  `struct Light { vec3 Position; vec3 Color; }`; C++ `struct Light { XMFLOAT3 Position; float padding0; XMFLOAT3 Color;
  float padding1; }` – each array element starts a 16-byte row and a float3 never crosses one, so `Color` starts the
  second row), `viewPos` (+ padding).
- `wood.png` loaded as an **sRGB texture**: `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` for the texture and its SRV (learnopengl's
  `loadTexture(…, true)` → `GL_SRGB`), static sampler s0 linear WRAP, one mip level (no mipmaps, like every Direct3D 12
  chapter of the course).
- Four lights (learnopengl's), globals `XMFLOAT3 lightPositions[]` / `lightColors[]`: (0, 0, 49.5), (-1.4, -1.9, 9),
  (0, -1.8, 4), (0.8, -1.7, 6); colours (200, 200, 200), (0.1, 0, 0), (0, 0, 0.2), (0, 0.1, 0), copied in `OnUpdate` with
  a `for` loop into `constantBufferData.lights[i].Position` / `.Color`. `lighting.hlsl` `PSMain`: no ambient (0.0 ×
  colour), diffuse `lights[i].Color * diff * color` with `1.0f / (distance * distance)`, no specular. **Deviation:**
  `Light lights[4]` and a loop over 4 (learnopengl declares 16 and sets 4).
- **Start:** the scene drawn straight into the window (the back buffer, `R8G8B8A8_UNORM`, with the depth buffer);
  `lighting.hlsl` gamma-corrects its result itself (`pow(ambient + lighting, 1.0f / gamma)`, gamma 2.2). The back buffer
  stores 0..1, so the far end (values far above 1) clips to plain white.
- No input: learnopengl toggles HDR with Space and changes the exposure with Q/E – the tasks switch the code instead;
  `exposure` is a fixed 1.0.
- The colour buffer (`m_colorBuffer`) is `R16G16B16A16_FLOAT`, 800×600, RTV heap slot `FrameCount`, CBV/SRV heap slot 2,
  created in the PIXEL_SHADER_RESOURCE state (optimized clear colour 0.1); the scene uses the existing D32_FLOAT depth
  buffer with it. The screen quad's pipeline state `m_hdrPipelineState` renders to the back buffer with no depth buffer.

**What the camera sees:** the inside of the long wooden tunnel in perspective – the boards of the four walls run towards
the centre – and its far end (z = 52.5) as a small square in the middle of the window (x ≈ 355..445, y ≈ 255..345), lit by
the 200-strength back light 3 units in front of it. The walls get brighter towards the far end (a glow around the
square); near the camera they are very dark, with a faint red tint in the bottom-right corner (the red light). The blue
and green lights are too weak to see.

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here: the values are the
app's simulator's, which follows every state of this chapter (the floating-point render target, its SRV, the root
constants of the screen quad). The same simulator gives **exactly the same values for the OpenGL project** of this
chapter (checked for `reinhard`). The OpenGL project's Mesa values differ by a few steps at the far end only (Mesa
samples the mipmapped wood there; the Direct3D 12 texture has one mip level, as does the simulator).
Named points (as OpenGL's): **end-centre** (400,300), **end-1** (370,270), **end-2** (420,280), **end-3** (400,340),
**end-edge** (400,255), **glow** (350,300), **wall-near-end** (330,300), **ceiling** (400,100), **floor** (400,560),
**wall-right** (600,300), **floor-left** (100,500), **red-corner** (760,560).

**Start picture:** the far end **clipped to flat white**: end-centre = 255,255,255, end-1 = 255,255,211, end-2 =
255,255,255, end-3 = 255,255,255, end-edge = 255,234,147 (red and green clip, the wood's blue does not) – the wood's
boards are lost in the white. glow = 159,108,68, wall-near-end = 41,28,18, ceiling = 10,7,4, floor = 9,6,4, wall-right =
9,7,4, floor-left = 24,14,9, red-corner = 38,14,9.

## float-buffer
- **Task:** Render the scene into a floating-point colour buffer (`R16G16B16A16_FLOAT`: values above 1.0 are kept) instead of the back buffer, then draw that buffer onto the window with a screen quad whose pixel shader (`hdr.hlsl`) only gamma-corrects. Move the gamma correction from `lighting.hlsl` to `hdr.hlsl`.
- **Hint:** The colour buffer like the framebuffers chapter's off-screen target, but `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, a `CD3DX12_CLEAR_VALUE` in the same format, RTV at RTV heap slot `FrameCount` (the heap needs `FrameCount + 1`), SRV (`R16G16B16A16_FLOAT`, `TEXTURE2D`) at CBV/SRV slot 2 (the heap needs 3). The scene's PSO: `RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`; `m_hdrPipelineState`: `hdr.hlsl`'s `VSMain`/`PSMain`, `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN`. `PopulateCommandList`: barrier PIXEL_SHADER_RESOURCE → RENDER_TARGET, `OMSetRenderTargets(1, &hdrRtvHandle, FALSE, &dsvHandle)`, clear, the tunnel, barrier back; then the back buffer's barrier, `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`, `SetPipelineState(m_hdrPipelineState.Get())`, `SetGraphicsRootDescriptorTable(2, …slot 2…)`, `DrawInstanced(6, 1, 36, 0)`. `hdr.hlsl`: `float3 hdrColor = hdrBuffer.Sample(wrapSampler, input.texCoord).rgb; float3 result = pow(hdrColor, 1.0f / gamma);`.
- **When done:** `main.cpp`: members `m_hdrPipelineState`, `m_colorBuffer`; `rtvHeapDesc.NumDescriptors = FrameCount + 1`,
  `cbvSrvHeapDesc.NumDescriptors = 3`; the scene's `psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`; two
  `D3DCompileFromFile(L"hdr.hlsl", …)` (`VSMain`/`vs_5_0`, `PSMain`/`ps_5_0`) and `CreateGraphicsPipelineState(…,
  &m_hdrPipelineState)` with `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthStencilState.DepthEnable = FALSE`,
  `DSVFormat = DXGI_FORMAT_UNKNOWN`; the six screen-quad vertices 36–41 in `vertices[]`; the `// configure floating point
  framebuffer` block (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, …, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`,
  `D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE`, `CreateRenderTargetView` at slot `FrameCount`, `CreateShaderResourceView`
  at slot 2); `PopulateCommandList`: pass 1 into `hdrRtvHandle` (slot `FrameCount`) with the two barriers of
  `m_colorBuffer`, pass 2 into the back buffer without DSV with `m_hdrPipelineState`, table 2 = heap slot 2,
  `DrawInstanced(6, 1, 36, 0)`. `lighting.hlsl` returns `float4(ambient + lighting, 1.0f)` (no `pow`); `hdr.hlsl`'s
  `PSMain` reads `hdrBuffer` and returns `pow(hdrColor, 1.0f / gamma)`. **No visible change:** the picture is identical to the start (every named point as in
  the start, end-centre still 255,255,255) – the buffer now holds values above 1.0, but nothing maps them into 0..1 yet,
  so the window still clips them.

## reinhard
- **Task:** Tone-map the HDR colour with Reinhard before the gamma correction: `hdrColor / (hdrColor + 1.0)` maps 0..∞ into 0..1.
- **Hint:** In `hdr.hlsl`: `float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));` then `result = pow(result, 1.0f / gamma);`.
- **When done:** `hdr.hlsl` has `float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));` followed by
  `result = pow(result, 1.0f / gamma);`. **The far end shows its wood again** – no pure white pixel: end-centre = 245,234,207, end-1 =
  232,209,168, end-2 = 240,223,188, end-3 = 248,239,217, end-edge = 210,178,131, glow = 138,102,66 (was 159,108,68). The
  dark rest of the tunnel is unchanged within a step (x / (x + 1) ≈ x for small x): wall-near-end 40,28,18, ceiling
  10,7,4, floor 9,6,4, wall-right 9,7,4, floor-left 24,14,9, red-corner 38,14,9. Only the far end and its glow change
  (x ≈ 337..462, y ≈ 237..362).

## exposure
- **Task:** Replace Reinhard with learnopengl's exposure tone mapping `1.0 - exp(-hdrColor * exposure)`, with an `exposure` of 1.0 passed from the program as a root constant (keep the Reinhard line as a comment).
- **Hint:** `main.cpp`: a global `float exposure = 1.0f;`, `struct HdrConstants { float exposure; };`, root parameter 0 visible to all shaders (`D3D12_SHADER_VISIBILITY_ALL` – the pixel shader reads it now) and, before the quad's draw, `HdrConstants hdrConstants = {}; hdrConstants.exposure = exposure; m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(HdrConstants) / 4, &hdrConstants, 0);`. `hdr.hlsl`: `cbuffer HdrConstants : register(b0) { float exposure; };` and `float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);`.
- **When done:** `main.cpp`: the global `float exposure = 1.0f;`, `struct HdrConstants` with `float exposure;`,
  `rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL)`, and in pass 2
  `hdrConstants.exposure = exposure;` + `SetGraphicsRoot32BitConstants(0, sizeof(HdrConstants) / 4, &hdrConstants, 0)`
  before `DrawInstanced(6, 1, 36, 0)`; `hdr.hlsl`: `cbuffer HdrConstants : register(b0)` with `float exposure;`, the
  Reinhard line commented out and `float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);`, then the gamma
  correction – learnopengl's 6.hdr.fs without the `hdr` toggle. The far end is **brighter than with Reinhard but still
  shows its boards**: end-centre = 255,254,233, end-1 = 253,236,183, end-2 =
  255,249,209, end-3 = 255,255,244, end-edge = 237,196,138, glow = 147,105,67; the dark rest unchanged (wall-near-end
  41,28,18, ceiling 10,7,4, floor 9,6,4, wall-right 9,7,4, floor-left 24,14,9, red-corner 38,14,9). This is the solution.
- With exposure 1.0 the result is close to Reinhard; the parameter is the point: a **higher exposure** (e.g. 5.0) brightens
  the dark tunnel walls and lets the far end saturate again – it shows the dark parts; a **lower exposure** (e.g. 0.1)
  darkens the walls to black and brings out the far end's boards – it shows the bright parts. learnopengl changes it with
  Q/E at run time; here try other values for the global in `main.cpp`.
- The hardware alternative to the `pow` in the shader would be an `_SRGB` render target view of the back buffer (the
  gamma-correction chapter); the course keeps learnopengl's shader way.
