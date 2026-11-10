# Bloom – tasks (DirectX 12)

learnopengl.com "Bloom": `src/5.advanced_lighting/7.bloom`; the Direct3D 12 side continues the hdr chapter (floating-point
render targets `R16G16B16A16_FLOAT` with RTV + SRV, barriers RENDER_TARGET ↔ PIXEL_SHADER_RESOURCE, screen-quad pipeline
states without depth) and adds **multiple render targets** (`NumRenderTargets = 2`, two RTVs in one `OMSetRenderTargets`,
a pixel shader returning a struct with `SV_TARGET0` / `SV_TARGET1`) and **ping-pong passes** (two render targets that
take turns being written and read, with a barrier pair around every pass). Files: `main.cpp`, `bloom.hlsl` (the scene's
shaders, learnopengl's 7.bloom.vs/.fs), `light_box.hlsl` (the light cubes' pixel shader, learnopengl's 7.light_box.fs –
its vertex shader is `bloom.hlsl`'s `VSMain`), `blur.hlsl` (learnopengl's 7.blur: `VSMain`, the weights and the
`BlurConstants` cbuffer are there in the start, `PSMain` is a TODO that returns black – not compiled before `blur`),
`bloom_final.hlsl` (the final screen quad, learnopengl's 7.bloom_final), `wood.png`, `container2.png`.

**Fixed choices (the same in every API):**
- Camera: (0, 0, 5) looking down -z (yaw -90, pitch 0, fov 45, 800/600, near 0.1, far 100) – learnopengl's. Clear
  (0.0, 0.0, 0.0), depth test on, no culling.
- Scene (`RenderScene()`, called from `PopulateCommandList`'s pass 1; one vertex buffer: learnopengl's `renderCube` cube,
  vertices 0–35, and the screen quad, 36–41): the floor cube `XMMatrixScaling(12.5f, 0.5f, 12.5f) *
  XMMatrixTranslation(0.0f, -1.0f, 0.0f)` with `wood.png` (heap slot 1); six boxes with `container2.png` (slot 2):
  (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5; (-1, -1, 2) rotated 60° about normalize(1, 0, 1) (no scale); (0, 2.7, 4)
  rotated 23°, scale 1.25; (-2, 1, -3) rotated 124° (no scale); (-3, 0, 0) scale 0.5 – in row-vector order `Scaling *
  RotationAxis * Translation`. Both textures **sRGB** (`DXGI_FORMAT_R8G8B8A8_UNORM_SRGB`), sampler s0 linear WRAP.
- Four lights (globals `lightPositions[]` / `lightColors[]`): (0, 0.5, 1.5), (-4, 0.5, -3), (3, 0.5, 1), (-0.8, 2.4, -1);
  colours (5, 5, 5), (10, 0, 0), (0, 0, 15), (0, 5, 0). `bloom.hlsl`: no ambient, diffuse with `1.0f / (distance *
  distance)`, no specular. The light cubes: `XMMatrixScaling(0.25f, …) * XMMatrixTranslation(lightPositions[i]…)` in a
  `for` loop with the pipeline state `m_lightBoxPipelineState` (`light_box.hlsl`: `lightColor`).
- Root constants (root parameter 0, visible to all shaders, 35 values): the scene's `ModelConstants` (`model`,
  `normalMatrix`, `XMFLOAT3 lightColor`), the blur's `BlurConstants` (`BOOL horizontal`), the final quad's
  `HdrConstants` (`float exposure`) – each pipeline's shaders read their own cbuffer at b0. Per frame (CBV, b1): `view`,
  `projection`, `Light lights[4]`, `viewPos` – as in the hdr chapter.
- Exposure 1.0, tone mapping as learnopengl's bloom_final.fs: `result = 1 - exp(-hdrColor * exposure)`, then
  `pow(result, 1.0f / 2.2f)`. The screen-quad passes sample with static sampler s1: linear, **CLAMP** (learnopengl's
  `GL_CLAMP_TO_EDGE` for the colour buffers: the blur must not wrap round to the other edge).
- **Start** = the hdr chapter's end state with this scene: the scene rendered into one floating-point colour buffer
  (`m_colorBuffer`, RTV heap slot `FrameCount`, CBV/SRV slot 3) with the depth buffer, then tone-mapped onto the window by
  `m_bloomFinalPipelineState` (`bloom_final.hlsl`, `Texture2D scene : register(t0)`).
- Intermediate pictures: after `bright-pass` the final quad samples the **bright texture** (colour buffer 1, slot 4)
  instead of the scene, after `blur` the **blurred bright texture** – both through the same tone mapping (only the SRV
  in root parameter 2 changes). After `combine`: the scene plus the blurred bright texture.
- Blur: learnopengl's ping-pong buffers (`m_pingpongColorbuffers[2]`, `R16G16B16A16_FLOAT` 800×600, no depth; RTVs at
  `FrameCount + 2 + i`, SRVs at slots `5 + i`), `amount = 10` passes starting horizontal, the first reading the bright
  texture; weights 0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162; the texel size from
  `image.GetDimensions(width, height)` (learnopengl's `textureSize`). The final pass reads ping-pong buffer
  `[!horizontal]` (index 0 after 10 passes).
- No input: there is no `bloom` toggle (learnopengl's Space key) – `combine` adds the bloom for good.

**What the camera sees** (as OpenGL's): the wooden floor from just above (its far edge at y ≈ 320), the large box at
(-1, -1, 2) very close on the left, the box (0, 1.5, 0) at the top centre with the **white light cube** right under it
(x ≈ 345..455, y ≈ 133..250), the box (-2, 1, -3) behind on the left (its top lit green), the **green light cube** cut by
the top edge (x ≈ 268..320, y 0..50), and the left side of the box (2, 0, 1) at the right. Above the floor's far edge the
background is black. The red light cube is hidden behind the big box, the blue one is outside the view.

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here; see the notes on
the simulator at each task. Named points (as OpenGL's): **white-light** (400,200), **green-light** (300,20), **box-top**
(400,60), **box-frame** (400,128), **box-right** (675,300), **floor-mid** (450,380), **floor-left** (200,450),
**floor-right** (700,500), **background** (600,100), **glow-right** (465,200), **glow-below** (400,262), **glow-green**
(290,55), **frame-green** (325,30), **corner** (480,130), **rim** (338,200).

**Start picture** (the simulator follows it): the tone-mapped scene without bloom: white-light = 254,254,254, green-light =
0,254,0, box-top = 164,116,71, box-frame = 207,209,217, box-right = 174,124,69, floor-mid = 172,134,93, floor-left =
85,59,48, floor-right = 123,91,70, background = 0,0,0, glow-right = 0,0,0, glow-below = 0,0,0, glow-green = 0,0,0,
frame-green = 149,150,162, corner = 0,0,0, rim = 32,32,70. The light cubes have hard edges: right next to them the
background is black. (The simulator gives exactly these values for the OpenGL project's start too.)

## bright-pass
- **Task:** Give the scene pass a second floating-point render target and let both scene pixel shaders write two outputs: the colour as before (`SV_TARGET0`), and – only where the colour's brightness is above 1.0 – the same colour into the second (`SV_TARGET1`, black elsewhere). For now show the second colour buffer in the window.
- **Hint:** `m_colorBuffers[2]` created in a `for` loop (RTVs at `FrameCount + i`, SRVs at slots `3 + i`; the RTV heap needs `FrameCount + 2`, the CBV/SRV heap 5). The scene's PSO (and the light cubes', which copies it): `NumRenderTargets = 2`, `RTVFormats[0]` and `RTVFormats[1]` = `DXGI_FORMAT_R16G16B16A16_FLOAT`; the final quad's: `NumRenderTargets = 1`, `RTVFormats[1] = DXGI_FORMAT_UNKNOWN`. Pass 1: barriers for both buffers (`CD3DX12_RESOURCE_BARRIER barriers[2]`, `ResourceBarrier(2, barriers)`), `CD3DX12_CPU_DESCRIPTOR_HANDLE hdrRtvHandles[2]`, `OMSetRenderTargets(2, hdrRtvHandles, FALSE, &dsvHandle)`, clear both. HLSL: `struct PSOutput { float4 FragColor : SV_TARGET0; float4 BrightColor : SV_TARGET1; };` and `float brightness = dot(result, float3(0.2126f, 0.7152f, 0.0722f)); if (brightness > 1.0f) output.BrightColor = float4(result, 1.0f); else output.BrightColor = float4(0.0f, 0.0f, 0.0f, 1.0f);`. The final pass's table 2: slot 4.
- **When done:** `main.cpp`: `ComPtr<ID3D12Resource> m_colorBuffers[2];`; `rtvHeapDesc.NumDescriptors = FrameCount + 2`,
  `cbvSrvHeapDesc.NumDescriptors = 5`; scene PSO `NumRenderTargets = 2`, `RTVFormats[1] =
  DXGI_FORMAT_R16G16B16A16_FLOAT`; final PSO `NumRenderTargets = 1`, `RTVFormats[1] = DXGI_FORMAT_UNKNOWN`; the colour
  buffers' `for (UINT i = 0; i < 2; i++)` loop (`CreateCommittedResource(… &m_colorBuffers[i])`, RTV `FrameCount + i`,
  SRV `3 + i`); `PopulateCommandList`: `barriers[2]` for `m_colorBuffers[0]`/`[1]` before and after the scene,
  `OMSetRenderTargets(2, hdrRtvHandles, FALSE, &dsvHandle)`, two `ClearRenderTargetView`, the final pass's `scene` handle
  at slot 4. `bloom.hlsl` and `light_box.hlsl`: `struct PSOutput` with `SV_TARGET0` / `SV_TARGET1`, `PSOutput PSMain`,
  learnopengl's brightness test. The window shows **only the bright parts**, tone-mapped, on black (as OpenGL's
  `bright-pass`): the light cubes, the steel frame right above the white light, the bright stripe along the big box's top
  edge, rivet dots near the lights; everything else black.

  *Simulator:* it follows this state and shows the picture above (the OpenGL project's Mesa values).

## blur
- **Task:** Blur the bright texture with learnopengl's two-pass Gaussian blur: two ping-pong render targets, 10 passes of the screen quad that alternate horizontal and vertical, each reading the texture the previous pass wrote (the first reads the bright texture). Show the last blurred texture in the window.
- **Hint:** `m_blurPipelineState`: `blur.hlsl`'s `VSMain`/`PSMain`, `NumRenderTargets = 1`, `RTVFormats[1] = DXGI_FORMAT_UNKNOWN`, `DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN`. `m_pingpongColorbuffers[2]` like the colour buffers (RTVs `FrameCount + 2 + i`, SRVs `5 + i`; heaps `FrameCount + 4` and 7). In `PopulateCommandList`: `bool horizontal = true, first_iteration = true; unsigned int amount = 10;`, `SetPipelineState(m_blurPipelineState.Get())`, and for each pass: barrier `m_pingpongColorbuffers[horizontal]` PIXEL_SHADER_RESOURCE → RENDER_TARGET, `OMSetRenderTargets(1, &pingpongRtvHandle, FALSE, nullptr)` (slot `FrameCount + 2 + horizontal`), `blurConstants.horizontal = horizontal` as root constants, table 2 = slot `first_iteration ? 4 : 5 + !horizontal`, `DrawInstanced(6, 1, 36, 0)`, the barrier back, `horizontal = !horizontal; if (first_iteration) first_iteration = false;`. The final pass: table 2 = slot `5 + !horizontal`. `blur.hlsl`: `image.GetDimensions(width, height); float2 tex_offset = 1.0f / float2(width, height);`, the centre texel times `weight[0]`, then for `i` 1..4 the texels `± tex_offset.x * i` (horizontal) or `± tex_offset.y * i` (vertical) times `weight[i]`.
- **When done:** `main.cpp`: `struct BlurConstants { BOOL horizontal; };`, members `m_blurPipelineState`,
  `m_pingpongColorbuffers[2]`; heaps `FrameCount + 4` / 7; two `D3DCompileFromFile(L"blur.hlsl", …)` and
  `CreateGraphicsPipelineState(…, &m_blurPipelineState)`; the `// ping-pong-framebuffer for blurring` block (a `for` loop,
  `&m_pingpongColorbuffers[i]`, RTV `FrameCount + 2 + i`, SRV `5 + i`); `PopulateCommandList`: the `// 2.` loop as in the
  hint (`amount = 10`, `m_pingpongColorbuffers[horizontal]`, `SetGraphicsRoot32BitConstants(0, sizeof(BlurConstants) / 4,
  &blurConstants, 0)`, `first_iteration ? 4 : 5 + !horizontal`, `DrawInstanced(6, 1, 36, 0)`, `horizontal =
  !horizontal`); the final pass's `scene` handle at `5 + !horizontal`. `blur.hlsl`'s `PSMain`: `GetDimensions`,
  `tex_offset`, the two `for` loops. The window shows the **blurred bright parts** (as OpenGL's `blur`): soft blobs around
  the light cubes and a soft white band along the big box's edge; black far from the lights.

  *Simulator:* it follows this state and shows the picture above (the OpenGL project's Mesa values).

## combine
- **Task:** Add the blurred bright texture to the scene in the final pass before the tone mapping: the scene (colour buffer 0) as the first texture (t0), the blurred texture as a second one (t1, in its own descriptor table), and in `bloom_final.hlsl` add the two colours.
- **Hint:** Root signature: a third range `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1)` (t1) and a fourth root parameter `rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`. Final pass: table 2 = slot 3 (the scene), table 3 = slot `5 + !horizontal`. `bloom_final.hlsl`: `Texture2D bloomBlur : register(t1);`, `float3 bloomColor = bloomBlur.Sample(clampSampler, input.texCoord).rgb; hdrColor += bloomColor; // additive blending` before the tone mapping. (One table with 2 SRVs would need the two descriptors next to each other in the heap – the scene's and whichever ping-pong buffer was written last; two tables need no such ordering.)
- **When done:** `main.cpp`: `CD3DX12_DESCRIPTOR_RANGE ranges[3]` with `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1,
  1)`, `CD3DX12_ROOT_PARAMETER rootParameters[4]` with `rootParameters[3].InitAsDescriptorTable(1, &ranges[2],
  D3D12_SHADER_VISIBILITY_PIXEL)`; the final pass: `scene` at slot 3 → `SetGraphicsRootDescriptorTable(2, scene)`,
  `bloomBlur` at `5 + !horizontal` → `SetGraphicsRootDescriptorTable(3, bloomBlur)`. `bloom_final.hlsl`: `Texture2D
  bloomBlur : register(t1);`, `float3 bloomColor = bloomBlur.Sample(…)`, `hdrColor += bloomColor;` – learnopengl's
  bloom_final.fs without the `bloom` toggle. The scene is back with **the light cubes glowing** (as OpenGL's `combine`):
  a soft halo spreads over the black background and the boxes next to them, the big box's bright top edge glows too;
  unchanged away from the bright parts. Expected (the OpenGL project's Mesa values, which the two
  checked states above match): glow-right = 49,49,49, glow-below = 33,33,33, glow-green = 0,176,0, corner = 128,129,140
  (start 0,0,0), rim ≈ 152,151,158 (start 32,32,70), frame-green ≈ 149,190,162 (start 149,150,162: green light on the
  frame), box-frame ≈ 246,246,249 (start 207,209,217); white-light = 255,255,255, green-light = 0,255,0; unchanged away
  from the bright parts: box-top = 164,116,71, box-right = 174,124,69, floor-mid = 172,134,93, floor-left = 85,59,48,
  floor-right = 123,91,70, background = 0,0,0.

  *Simulator:* it follows this state and shows the picture above (the OpenGL project's Mesa values).