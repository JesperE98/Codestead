# Deferred Shading – tasks (DirectX 12)

learnopengl.com "Deferred Shading": `src/5.advanced_lighting/8.1.deferred_shading` and `8.2.deferred_shading_volumes`.
The Direct3D 12 side continues the bloom chapter (off-screen render targets with an RTV and an SRV each, barriers
RENDER_TARGET ↔ PIXEL_SHADER_RESOURCE, several render targets in one `OMSetRenderTargets`, screen-quad pipeline states
without depth) and adds the **G-buffer**: three render targets of different formats (`NumRenderTargets = 3`, a pixel
shader returning a struct with `SV_TARGET0..2`), read by a lighting pass through **two descriptor tables**. Files:
`main.cpp`, `forward_shading.hlsl` (the start's forward rendering; stays in the project, unused, for comparison),
`g_buffer.hlsl` (the geometry pass, learnopengl's 8.1.g_buffer.vs/.fs – `PSMain` is a TODO in the start),
`deferred_shading.hlsl` (the lighting pass, learnopengl's 8.1/8.2 deferred_shading.vs/.fs – in the start it only shows
the albedo), `deferred_light_box.hlsl` (the light cubes, learnopengl's 8.1.deferred_light_box.vs/.fs – complete in the
start, used from `light-cubes` on), `container2.png`, `container2_specular.png`. learnopengl draws its **backpack**
model nine times; the course draws boxes (no model needed for the lighting technique).

**Fixed choices (the same in every API, as OpenGL's):**
- **Camera: (0, 5, 9), yaw -90, pitch -35** (`cameraFront = XMVectorSet(0.0f, -0.5735764f, -0.8191520f, 0.0f)`), fov 45,
  800/600, near 0.1, far 100, `XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`. learnopengl starts at (0, 0, 5) looking
  straight ahead: from there the front row hides the grid and most lights; from above and behind the whole grid shows.
- **Boxes**: the cube of the vertex buffer (learnopengl's `renderCube`, 2 × 2 × 2, vertices 0–35) at learnopengl's nine
  `objectPositions` (x -3, 0, 3; y -0.5; z -3, 0, 3 – a global `XMFLOAT3 objectPositions[]`) with model =
  `XMMatrixScaling(0.75f, 0.75f, 0.75f) * XMMatrixTranslation(objectPositions[i]…)` – boxes 1.5 units wide, 1.5 apart.
  `container2.png` (diffuse, t0) and `container2_specular.png` (specular, t1) in heap slots 1 and 2 – one descriptor
  table, root parameter 2 – loaded **linear** (`DXGI_FORMAT_R8G8B8A8_UNORM`: learnopengl's deferred demo does not
  gamma-correct), static sampler s0 linear WRAP, v already flipped in the vertex data. Clear (0, 0, 0), depth test on,
  no culling.
- **32 lights**, learnopengl's, filled in `LoadAssets` into the globals `std::vector<XMFLOAT3> lightPositions` /
  `lightColors`: `srand(13)`, then per light x = `((rand() % 100) / 100.0) * 6.0 - 3.0`, y = `… * 6.0 - 4.0`, z =
  `… * 6.0 - 3.0`, colour r, g, b = `((rand() % 100) / 200.0f) + 0.5` (in this order). **Note:** the pictures below
  are glibc's `rand()` (Linux, the course's simulator); Microsoft's C runtime has another `rand()`, so on Windows the 32
  lights land elsewhere and the pictures differ in detail (the same kind of scene). Attenuation constant 1 (not sent),
  linear 0.7, quadratic 1.8, set per light in `OnUpdate`'s loop. Lighting (learnopengl's): ambient `Diffuse * 0.1`, per
  light diffuse, Blinn-Phong specular `pow(…, 16.0)` times the specular map's red channel, both times `1 / (1 + Linear d
  + Quadratic d²)`; world space, `viewPos` = cameraPos; no tone mapping, no gamma.
- Constant buffer (b1, `SceneConstantBuffer`): `view`, `projection`, `Light lights[32]`, `viewPos`. HLSL packing of
  `struct Light { float3 Position; float3 Color; float Linear; float Quadratic; (float Radius;) }`: Position at 0,
  Color at 16 (a float3 never crosses a 16-byte row), Linear at 28, Quadratic at 32 (Radius 36), each element 48 bytes –
  C++ `XMFLOAT3 Position; float padding0; XMFLOAT3 Color; float Linear; float Quadratic; float padding1[3];` (with
  Radius: `float Radius; float padding1[2];`). Root constants (b0, 35 values): `ModelConstants` (`model`,
  `normalMatrix` = the inverse of the model matrix, i.e. transpose(inverse(model)) stored transposed, `lightColor`).
- **Start** = forward rendering: `forward_shading.hlsl` lights every pixel of the boxes with all 32 lights while they are
  drawn into the back buffer (the same lighting code), so the deferred picture after `lighting-pass` equals the start.
  No light cubes in the start.
- G-buffer: `ComPtr<ID3D12Resource> m_gBuffer[3]` – gPosition `R16G16B16A16_FLOAT`, gNormal `R16G16B16A16_FLOAT`,
  gAlbedoSpec `R8G8B8A8_UNORM` (rgb albedo, a specular) – created in a `for` loop over `gBufferFormats[3]`, RTVs at
  `FrameCount + i`, SRVs at heap slots `3 + i`, starting in PIXEL_SHADER_RESOURCE; positions and normals in world space;
  the depth buffer `m_depthStencil` as before. The lighting pass reads them with static sampler **s1: point, CLAMP**
  (learnopengl's GL_NEAREST): gPosition + gNormal through root parameter 2 (slots 3, 4: t0, t1) and gAlbedoSpec through
  a new **root parameter 3** (slot 5: t2). Why a second table: root parameter 2 is a 2-SRV range (a box's two maps); a
  3-SRV range for everything would make the boxes' table reach into slot 3 = gPosition, which is a render target while
  the boxes are drawn – legal as long as the shader never reads it, but confusing. Two tables bind exactly what each pass
  reads.
- After `g-buffer` the window shows the **albedo** (`deferred_shading.hlsl`'s start `PSMain` returns
  `float4(Diffuse, 1.0f)` – "for now: show the albedo"), unlit.
- `light-cubes`: learnopengl copies the G-buffer's depth into the window's depth buffer (`glBlitFramebuffer`).
  **Direct3D 12 needs no copy:** a depth buffer belongs to no framebuffer – the geometry pass's `m_depthStencil` still
  holds the scene's depths after the lighting pass, so the light cubes are drawn into the back buffer with that same
  DSV bound (`OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)`). The lighting quad itself is drawn without a DSV
  (its PSO has no depth). A copy (`CopyResource` into a second depth buffer) would only be needed if the window pass
  had its own depth buffer, e.g. one with other contents. Light cubes: scale 0.125, `m_lightBoxPipelineState`
  (`deferred_light_box.hlsl`, back-buffer format, `DSVFormat = D32_FLOAT`, depth LESS).
- `light-volumes` (8.2): each light's radius from learnopengl's formula with `maxBrightness = std::fmax(std::fmax(r, g),
  b)` (learnopengl writes `std::fmaxf`, which not every standard library declares in `std`) – about 3.5 (colour 0.5) to
  5.1 (colour 1.0); the shader skips a light where `distance >= Radius`. With 32 lights the skipped small amounts add
  up: the picture gets slightly darker in places (as OpenGL's).
- No input (WASD/mouse work but are not needed; nothing depends on time).

**What the camera sees** (solution): the 3 × 3 grid of wooden boxes with steel frames from above and behind, the near
row large at the bottom (x ≈ 15..785, y ≈ 300..495), the far row small at the top (y ≈ 110..225), black background
around them; the boxes' tops and faces turned to nearby lights lit warm, the rest dark (ambient 0.1). After
`light-cubes` 32 small pastel cubes float between, above and below the boxes (those behind a box hidden).

Pixels in the 800×600 client area from the top left; nothing depends on time. Named points (as OpenGL's):
**mid-box** (400,280), **front-top** (400,340), **front-face** (400,440), **left-side** (195,400), **right-side**
(610,400), **back-frame** (400,150), **left-top** (110,340), **background** (400,50), **light-grey** (150,226),
**light-orange** (609,233), **light-pink** (428,258), **light-mint** (288,212), **light-cyan** (320,446),
**light-purple** (543,556).

D3D12 cannot run here. The values below are OpenGL's (Mesa) – the reference picture; the app's simulator follows
every state of this project and differs from them by a few units at most (it samples textures without mip maps).

**Start picture** (forward rendering, no light cubes): mid-box = 81,48,26, front-top = 35,24,13, front-face =
15,10,5, left-side = 86,59,32, right-side = 51,34,18, back-frame = 149,146,159, left-top = 33,22,12, background =
0,0,0, light-grey = 34,24,13 (the box behind it), light-orange = 81,81,73 (a box frame), light-pink = 114,60,34,
light-mint = light-cyan = light-purple = 0,0,0.

## g-buffer
- **Task:** Draw the boxes into a G-buffer instead of the window: three render targets – positions (`R16G16B16A16_FLOAT`), normals (`R16G16B16A16_FLOAT`), albedo + specular (`R8G8B8A8_UNORM`) – filled by `g_buffer.hlsl`, with the depth buffer. Then draw the screen quad into the back buffer with the lighting pass's pipeline state (`deferred_shading.hlsl`), which for now shows the albedo.
- **Hint:** `m_gBuffer[3]` in a `for` loop over `const DXGI_FORMAT gBufferFormats[3]` (RTV `FrameCount + i`, SRV slot `3 + i`; heaps `FrameCount + 3` and 6). The scene PSO compiles `g_buffer.hlsl` and gets `NumRenderTargets = 3` with the three formats; `m_lightingPipelineState`: `deferred_shading.hlsl`, one `R8G8B8A8_UNORM` target, `DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN`. Root signature: `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 2)` + `rootParameters[3]`, static sampler s1 (point, CLAMP). Frame: barriers for the three textures, `OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle)`, clear all three and the depth, the boxes, barriers back; then the back buffer without DSV, `SetPipelineState(m_lightingPipelineState)`, table 2 = slot 3, table 3 = slot 5, `DrawInstanced(6, 1, 36, 0)`. `g_buffer.hlsl`'s `PSMain`: `gPosition = float4(input.fragPos, 1.0f)`, `gNormal = float4(normalize(input.normal), 1.0f)`, `gAlbedoSpec.rgb` = the diffuse map, `.a` = the specular map's red.
- **When done:** `main.cpp`: members `m_lightingPipelineState`, `m_gBuffer[3]`; `rtvHeapDesc.NumDescriptors = FrameCount +
  3`, `cbvSrvHeapDesc.NumDescriptors = 6`; `CD3DX12_DESCRIPTOR_RANGE ranges[3]` (`ranges[2]`: SRV, 1, register 2),
  `CD3DX12_ROOT_PARAMETER rootParameters[4]`, `D3D12_STATIC_SAMPLER_DESC samplers[2]` (s1: `D3D12_FILTER_MIN_MAG_MIP_POINT`,
  CLAMP, `ShaderRegister = 1`); `D3DCompileFromFile(L"g_buffer.hlsl", …)`, `NumRenderTargets = 3`, `RTVFormats[0..2]` =
  R16G16B16A16_FLOAT, R16G16B16A16_FLOAT, R8G8B8A8_UNORM; `D3DCompileFromFile(L"deferred_shading.hlsl", …)` and
  `CreateGraphicsPipelineState(…, &m_lightingPipelineState)`; the `// configure g-buffer framebuffer` block;
  `PopulateCommandList`: `// 1. geometry pass` (`CD3DX12_RESOURCE_BARRIER barriers[3]`, `ResourceBarrier(3, barriers)`,
  `CD3DX12_CPU_DESCRIPTOR_HANDLE gBufferRtvHandles[3]`, `OMSetRenderTargets(3, …)`, three `ClearRenderTargetView`), the
  barriers back, `// 2. lighting pass` (back buffer, `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`,
  `SetPipelineState(m_lightingPipelineState.Get())`, `SetGraphicsRootDescriptorTable(2, gPositionNormal)` (slot 3),
  `SetGraphicsRootDescriptorTable(3, gAlbedoSpec)` (slot 5), `DrawInstanced(6, 1, 36, 0)`). `g_buffer.hlsl`: learnopengl's
  four assignments. The window shows the **albedo, unlit** (as OpenGL's): mid-box = 145,95,50, front-top = 150,98,52,
  front-face = 149,97,52, left-side = 150,98,52, right-side = 133,88,46, back-frame = 156,158,164, left-top =
  150,98,52, light-grey = 150,98,52, light-orange = 153,155,161, light-pink = 133,88,46, background = light-mint =
  light-cyan = light-purple = 0,0,0 – every face equally bright; wood ≈ 150,98,52, steel ≈ 155,157,163.

## lighting-pass
- **Task:** Light the G-buffer in `deferred_shading.hlsl`: read the position, normal, albedo and specular intensity of the pixel and compute learnopengl's lighting with the 32 lights of the constant buffer.
- **Hint:** Declare `struct Light` and `cbuffer SceneConstantBuffer : register(b1)` as in `forward_shading.hlsl` (`#define NR_LIGHTS 32`). In `PSMain`: `FragPos`, `Normal`, `Diffuse` (`.rgb`) and `Specular` (`.a` of gAlbedoSpec) with `pointSampler`; `float3 lighting = Diffuse * 0.1f;`, `float3 viewDir = normalize(viewPos - FragPos);` and the forward shader's loop. `main.cpp` already sends the lights (they were the forward pass's).
- **When done:** `deferred_shading.hlsl`: `struct Light { float3 Position; float3 Color; float Linear; float Quadratic; };`,
  `#define NR_LIGHTS 32`, `cbuffer SceneConstantBuffer : register(b1) { float4x4 view; float4x4 projection; Light
  lights[NR_LIGHTS]; float3 viewPos; };`; `PSMain`: the four G-buffer reads, `lighting = Diffuse * 0.1f`, the loop
  `for (int i = 0; i < NR_LIGHTS; ++i)` with diffuse, `pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f)`, `1.0f / (1.0f +
  lights[i].Linear * distance + lights[i].Quadratic * distance * distance)`, `return float4(lighting, 1.0f);`. No change in
  `main.cpp`. The picture is **the start picture again** (OpenGL: no pixel differs by more than 1): mid-box =
  81,48,26, front-top = 35,24,13, front-face = 15,10,5, left-side = 86,59,32, right-side = 51,34,18, back-frame =
  149,146,159, left-top = 33,22,12, light-grey = 34,24,13, light-orange = 81,81,73, light-pink = 114,60,34, background =
  light-mint = light-cyan = light-purple = 0,0,0. Now each pixel is lit once (800 × 600 × 32 light calculations),
  however many boxes overlap there.

## light-cubes
- **Task:** Show the lights: after the lighting pass, bind the geometry pass's depth buffer together with the back buffer and draw a small cube at every light (scale 0.125) in the light's colour with a new pipeline state for `deferred_light_box.hlsl`, depth-tested against the boxes.
- **Hint:** `m_lightBoxPipelineState`: `deferred_light_box.hlsl`'s `VSMain`/`PSMain`, the back buffer's format, `DepthStencilState.DepthEnable = TRUE`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`. In `PopulateCommandList` after the quad: `OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)` (no copy: the depth buffer still holds the boxes' depths), `SetPipelineState(m_lightBoxPipelineState.Get())`, and for every light `XMMatrixScaling(0.125f, …) * XMMatrixTranslation(lightPositions[i]…)` and `modelConstants.lightColor = lightColors[i]` as root constants, `DrawInstanced(36, 1, 0, 0)`.
- **When done:** `main.cpp`: member `m_lightBoxPipelineState`; `D3DCompileFromFile(L"deferred_light_box.hlsl", …)`,
  `DepthEnable = TRUE`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`, `CreateGraphicsPipelineState(…, &m_lightBoxPipelineState)`;
  `PopulateCommandList`: `// 2.5.` comment + `OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)`, `// 3. render lights
  on top of scene`: the `for` loop over `lightPositions.size()` with scale 0.125, `lightColor`, `DrawInstanced(36, 1, 0,
  0)`. **32 small pastel cubes** appear (about 12 × 12 to 28 × 28 px; a few hidden behind boxes, e.g. under the left
  middle box): light-grey = 161,159,163, light-orange = 244,209,158, light-pink = 238,150,171, light-mint =
  143,204,181, light-cyan = 129,242,231, light-purple = 201,157,237. Everything else as before.

## light-volumes
- **Task:** Give every light a radius (learnopengl's light volume: the distance where its attenuated brightness drops below 5/256) and skip the light in `deferred_shading.hlsl` where the pixel is farther away than that.
- **Hint:** C++ `Light`: `float Radius; float padding1[2];` after Quadratic. In `OnUpdate`'s loop: `const float constant = 1.0f;`, then after Quadratic `const float maxBrightness = std::fmax(std::fmax(lightColors[i].x, lightColors[i].y), lightColors[i].z);`, `float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);`, `constantBufferData.lights[i].Radius = radius;`. HLSL: `float Radius;` in `Light`; in the loop compute `distance` first and wrap the rest in `if (distance < lights[i].Radius)`.
- **When done:** `main.cpp`: `float Radius; float padding1[2];` in `struct Light`; `// update attenuation parameters and
  calculate radius`, `const float constant = 1.0f;`, `maxBrightness` with `std::fmax`, `radius` with `std::sqrt`,
  `constantBufferData.lights[i].Radius = radius;`. `deferred_shading.hlsl`: `float Radius;` and learnopengl's 8.2 loop
  (`if (distance < lights[i].Radius)`). **Almost the same picture, a little darker where many lights just outside their
  radius used to add up** (as OpenGL's: about 28,000 pixels darker by more than 5, at most ~43): back-frame =
  117,113,124 (before 149,146,159), left-side = 66,46,25 (86,59,32), right-side = 36,24,12 (51,34,18), mid-box =
  80,47,25, left-top = 31,20,11; unchanged: front-top = 35,24,13, front-face = 15,10,5, the light cubes, background =
  0,0,0. Why a real renderer goes further: the `if` saves little on a GPU – the pixels of a group run in lockstep, so the
  loop still costs every light wherever one pixel of the group needs it. learnopengl's answer is to draw each light's
  **volume** (a sphere of that radius, front faces culled so it also works with the camera inside) and light only the
  pixels it covers, additively blended: the lighting shader then runs once per light per covered pixel. This is the
  solution.