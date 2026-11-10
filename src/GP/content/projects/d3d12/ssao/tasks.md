# SSAO – tasks (DirectX 12)

learnopengl.com "SSAO": `src/5.advanced_lighting/9.ssao`. The Direct3D 12 side continues the deferred-shading chapter
(a G-buffer of three render targets, screen-quad passes reading it through descriptor tables) and the Model Loading part
(learnopengl's Mesh and Model classes ported, with Assimp). New: a **single-channel render target** (`R8_UNORM`), a
**texture filled from CPU data** (the 4 × 4 noise texture: `R32G32B32A32_FLOAT`, `UpdateSubresources` from a
`std::vector<XMFLOAT4>`), a **wrapping point sampler** for it, and an **array in the constant buffer** (the kernel).
Files: `main.cpp`, `ssao_geometry.hlsl` (the geometry pass, learnopengl's 9.ssao_geometry.vs/.fs), `ssao.hlsl` (the SSAO
pass: learnopengl's 9.ssao.vs + 9.ssao.fs – declarations ready in the start, `PSMain` a TODO), `ssao_blur.hlsl` (9.ssao.vs
+ 9.ssao_blur.fs – `PSMain` a TODO), `ssao_lighting.hlsl` (9.ssao.vs + 9.ssao_lighting.fs), and the read-only model in
`models/` (`planet.obj`, `planet.mtl` and its four textures). Every screen pass has its own copy of learnopengl's
shared `9.ssao.vs` (`VSMain`), as a D3D12 pipeline state takes its shaders from one file here.

**Fixed choices (the same in every API, as OpenGL's):**
- learnopengl's scene with the course's planet instead of learnopengl's **backpack** model: the room = the cube of the
  vertex buffer (learnopengl's `renderCube`) with `XMMatrixScaling(7.5f, 7.5f, 7.5f) * XMMatrixTranslation(0.0f, 7.0f,
  0.0f)`, drawn with `invertedNormals = TRUE` (the inside is seen: floor at y = -0.5, back wall at z = -7.5); the planet
  (`Model m_model`, `m_model.Load("models/planet.obj", …)` – its meshes `planet`, radius 1, and `rings`, a flat ring
  1.4–2.0 in the xz plane, normal +y) with `XMMatrixScaling(1.0f, 1.0f, 1.0f) * XMMatrixTranslation(0.0f, 0.5f, 0.0f)`:
  it stands on the floor. learnopengl rotates the backpack -90° about x – the planet is not rotated.
- Camera (0, 0, 5) looking down -z (yaw -90, pitch 0), fov 45, 800/600, near 0.1, **far 50** (learnopengl's ssao.cpp),
  `XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`. Clear (0, 0, 0), depth test on, no culling. The ring at y = 0.5 is
  just above the eye: it is seen **from below**.
- G-buffer in **view space** (learnopengl's ssao_geometry.vs): `fragPos = mul(mul(position, model), view)`; the normal
  with learnopengl's `transpose(inverse(mat3(view * model)))`, computed as `mul(mul(float4(n, 0.0f), normalMatrix), view)`
  – `normalMatrix` is the model's (the inverse of the model matrix from `main.cpp`, as in the earlier chapters), and the
  view matrix is its own normal matrix (a rotation plus a translation) – with `n = invertedNormals ? -normal : normal`.
  `m_gBuffer[3]`: gPosition and gNormal `R16G16B16A16_FLOAT`, gAlbedo `R8G8B8A8_UNORM` (RTVs `FrameCount + i`, SRVs heap
  slots `5 + i` after the meshes' slots 1–4; `MaxMeshes = 2`). Albedo = `float4(0.95f, 0.95f, 0.95f, 1.0f)` for everything
  (learnopengl's; the model's textures are loaded by `Model` but not used). All the window-sized textures are read with
  static sampler **s0: point, CLAMP** (learnopengl's GL_NEAREST + GL_CLAMP_TO_EDGE: the SSAO samples near the edges must
  not wrap).
- Root signature: root constants b0 (`ModelConstants`: `model`, `normalMatrix`, `BOOL invertedNormals` – 33 values),
  table 1 = the CBV (b1), table 2 = 2 SRVs t0–t1 (a mesh's two maps – `Mesh::Draw` binds them –, or gPosition +
  gNormal, or the blur's input), table 3 = 1 SRV t2 (gAlbedo, or the noise texture), table 4 = 1 SRV t3 (the SSAO
  texture, from `kernel` on): the shaders' registers are learnopengl's texture units (lighting pass: gPosition 0,
  gNormal 1, gAlbedo 2, ssao 3; SSAO pass: gPosition 0, gNormal 1, texNoise 2).
- One light: `lightPos` (2, 4, -2) in world space, sent in view space (`XMVector3TransformCoord(XMLoadFloat3(&lightPos),
  view)` – learnopengl's `glm::vec3(view * glm::vec4(lightPos, 1.0))`), colour (0.2, 0.2, 0.7), linear 0.09, quadratic
  0.032. `ssao_lighting.hlsl` (learnopengl's): ambient `0.3 * Diffuse` (× AO after `apply`), diffuse, Blinn-Phong
  specular `pow(…, 8.0)` with `viewDir = normalize(-FragPos)` (the camera is the origin of view space), attenuated.
  Constant buffer: `view`, `projection`, `Light light` (C++ `XMFLOAT3 Position; float padding0; XMFLOAT3 Color; float
  Linear; float Quadratic; float padding1[3];` – Color starts the second 16-byte row), then `XMFLOAT4 samples[32]`
  (every array element takes its own 16-byte row: a float3 sample is stored as a float4, w unused – learnopengl's
  `uniform vec3 samples[64]`).
- **Kernel: 32 samples** (learnopengl 64; the course's simulator computes the SSAO pass on the CPU), radius 0.5, bias
  0.025 (`static const` in `ssao.hlsl`, with `noiseScale = float2(800.0f / 4.0f, 600.0f / 4.0f)`). **Random numbers:
  `srand(42)` and `rand() / (float)RAND_MAX`** instead of learnopengl's `std::uniform_real_distribution` +
  `std::default_random_engine` (whose sequence differs between standard libraries): the course's simulator reproduces
  glibc's `rand()` exactly. Every random number gets its own statement (`float x = …; float y = …; float z = …;`) – C++
  does not fix the order in which a function's arguments are evaluated. Order: per sample x, y (`* 2.0f - 1.0f`), z
  (0..1), then the length factor; `scale = ourLerp(0.1f, 1.0f, (i / 32.0f)²)`; then the 16 noise vectors (x, y each
  `* 2.0f - 1.0f`, z = 0). The kernel goes into the global `std::vector<XMFLOAT3> ssaoKernel` in `LoadAssets` and is
  copied into the constant buffer in `OnUpdate`. **On Windows** Microsoft's `rand()` (and `RAND_MAX` = 32767) gives other
  numbers – the picture looks the same, the noise pattern differs in detail.
- Noise texture `m_noiseTexture` 4 × 4 `R32G32B32A32_FLOAT` (learnopengl's GL_RGBA32F; uploaded from
  `std::vector<XMFLOAT4> ssaoNoise` with `UpdateSubresources`, `RowPitch = 4 * sizeof(XMFLOAT4)`), heap slot 9, sampled
  with static sampler **s1: point, WRAP** (GL_NEAREST + GL_REPEAT) at `texCoord * noiseScale`. SSAO target
  `m_ssaoColorBuffer` `R8_UNORM` 800 × 600 (learnopengl's GL_RED: one 8-bit channel), RTV `FrameCount + 3`, SRV slot 8;
  the blur target `m_ssaoColorBufferBlur` the same, RTV `FrameCount + 4`, SRV slot 10.
- Direct3D's texture v points down while normalized device y points up: the SSAO pass turns a projected sample into
  texture coordinates with `float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f)` (learnopengl: `offset.xyz * 0.5 +
  0.5`). The depth compared is gPosition's view-space z (negative, the RH view space of learnopengl), so the range check
  and `sampleDepth >= samplePos.z + bias` are learnopengl's unchanged. The TBN matrix: `float3x3(tangent, bitangent,
  normal)` has them as rows, so `mul(samples[i].xyz, TBN)` is GLSL's `TBN * samples[i]` (= x·T + y·B + z·N).
- What the window shows in between: after `kernel` and `blur` the lighting pass still runs, but `ssao_lighting.hlsl`
  returns `float4(ssao.Sample(clampSampler, input.texCoord).rrr, 1.0f); // for now: show the SSAO texture` – the grey AO
  texture (table 4 = slot 8 after `kernel`, slot 10 after `blur`). `apply` restores `return float4(lighting, 1.0f);`.
- The blur's 4 × 4 window is not centred (offsets -2..1, as learnopengl's); with v pointing down the half-texel shift is
  up-left here, down-left in OpenGL – not visible.
- No input (WASD/mouse work but are not needed; nothing depends on time).

**What the camera sees** (as OpenGL's; start / solution): the inside of a large grey room lit blue from the upper right
(the light is behind and above the planet): the back wall, the floor below y ≈ 327 (the floor/wall edge a thin line),
and the grey planet in the middle (a disc x ≈ 252..548, y ≈ 75..372) standing on the floor; its front faces away from the
light and gets only the ambient light; its upper right edge is lit blue. The ring crosses in front of it from x ≈ 85 to
715 (y ≈ 180..245), seen from below; behind the planet the ring is hidden.

**Why the ring is dark in the AO picture:** the ring is a single plane whose normal points up (+y), and the camera sees
its underside. SSAO puts its hemisphere of samples on the normal's side – above the ring, i.e. behind it as the camera
sees it – so most samples land behind the ring's own surface and count as occluded. learnopengl's backpack has no such
one-sided surfaces. (A fix would flip the normal for back faces with `SV_IsFrontFace` in the geometry pass; not done –
the course keeps learnopengl's shaders.)

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here: the values are
OpenGL's (Mesa) – the reference picture; the app's simulator follows every state of this project. Named points (as
OpenGL's): **planet** (400,280), **planet-left** (300,240), **planet-lit** (470,110), **above-ring** (400,172),
**ring-mid** (400,190), **ring-left** (150,213), **ring-right** (650,215), **contact** (400,376), **contact-left**
(340,372), **edge** (100,327), **floor** (400,500), **wall** (100,100), **wall-lit** (520,40).

**Start picture** (deferred, no AO): planet = 73,73,73, planet-left = 73,73,73, planet-lit = 103,103,179, above-ring
= 73,73,75, ring-mid = 87,87,122, ring-left = 84,84,114, ring-right = 99,99,165, contact = 93,93,144, contact-left =
91,91,136, edge = 79,79,95, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199.

## kernel
- **Task:** Generate the SSAO input on the CPU – the 32-sample kernel in a hemisphere (`srand(42)`, `rand() / (float)RAND_MAX`) into `ssaoKernel`, and the 4 × 4 noise texture of random rotations – and add the SSAO pass: a single-channel render target (`R8_UNORM`) filled by `ssao.hlsl` on the screen quad, reading gPosition, gNormal and the noise. For now show the SSAO texture in the window.
- **Hint:** Kernel: per sample `x`, `y` = `rand() / (float)RAND_MAX * 2.0f - 1.0f`, `z` = `rand() / (float)RAND_MAX`; `XMVector3Normalize(XMVectorSet(x, y, z, 0.0f))`, `*= rand() / (float)RAND_MAX`, then `*= ourLerp(0.1f, 1.0f, scale * scale)` with `scale = static_cast<float>(i) / 32.0f`; `XMStoreFloat3` and `push_back`. Noise: 16 × `XMFLOAT4(x, y, 0.0f, 0.0f)` into a 4 × 4 `R32G32B32A32_FLOAT` texture (default heap in COPY_DEST, an upload buffer of `GetRequiredIntermediateSize`, `UpdateSubresources`, a barrier to PIXEL_SHADER_RESOURCE, an SRV in slot 9). Root signature: `ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 3)` + `rootParameters[4]`, sampler s1 (point, WRAP). `m_ssaoPipelineState`: `ssao.hlsl`, `RTVFormats[0] = DXGI_FORMAT_R8_UNORM`, no depth. `OnUpdate`: `constantBufferData.samples[i] = XMFLOAT4(ssaoKernel[i].x, …, 0.0f)`. Frame `// 2.`: barrier, `OMSetRenderTargets(1, &ssaoRtvHandle, FALSE, nullptr)`, clear, the PSO, table 2 = `gPositionNormal`, table 3 = slot 9, the quad, barrier back; the lighting pass: table 4 = slot 8. `ssao.hlsl`'s `PSMain` is learnopengl's `main` (see the notes above on TBN and v).
- **When done:** `main.cpp`: globals `std::vector<XMFLOAT3> ssaoKernel;` and `float ourLerp(float a, float b, float f)`;
  `XMFLOAT4 samples[32];` in `SceneConstantBuffer`; members `m_ssaoPipelineState`, `m_ssaoColorBuffer`, `m_noiseTexture`;
  heaps `FrameCount + 4` and `1 + 2 * MaxMeshes + 5`; `CD3DX12_DESCRIPTOR_RANGE ranges[4]`, `CD3DX12_ROOT_PARAMETER
  rootParameters[5]`, `D3D12_STATIC_SAMPLER_DESC samplers[2]` (s1 WRAP); `D3DCompileFromFile(L"ssao.hlsl", …)`,
  `RTVFormats[0] = DXGI_FORMAT_R8_UNORM`, `CreateGraphicsPipelineState(…, &m_ssaoPipelineState)`; the `// also create
  framebuffer to hold SSAO processing stage` block (`R8_UNORM`, RTV `FrameCount + 3`, SRV slot 8); `// generate sample
  kernel` (`srand(42)`, the loop `i < 32` with four `rand() / (float)RAND_MAX`, `ourLerp(0.1f, 1.0f, scale * scale)`,
  `ssaoKernel.push_back`); `// generate noise texture` (`std::vector<XMFLOAT4> ssaoNoise`, 16 vectors,
  `DXGI_FORMAT_R32G32B32A32_FLOAT`, 4 × 4, `UpdateSubresources`, SRV slot 9); `OnUpdate`: `// Send kernel` loop;
  `PopulateCommandList`: `// 2. generate SSAO texture` (`m_ssaoColorBuffer` barriers, `SetPipelineState(m_ssaoPipelineState
  .Get())`, `SetGraphicsRootDescriptorTable(3, texNoise)`, `DrawInstanced(6, 1, 36, 0)`), the lighting pass's
  `SetGraphicsRootDescriptorTable(4, ssao)` (slot 8). `ssao.hlsl`: learnopengl's `main`. `ssao_lighting.hlsl`: `Texture2D
  ssao : register(t3);` and the "for now" return. The window shows **the raw SSAO texture in grey** (as OpenGL's):
  white (255) where nothing occludes – planet, planet-left, planet-lit, floor, wall, wall-lit = 255,255,255; grey where
  it does: the ring's underside dark with a gradient (ring-left = 53,53,53, ring-right = 63,63,63, ring-mid =
  112,112,112; darkest ≈ 14 at the ring's outer edge), the contact shadow under the planet (contact = 143,143,143,
  contact-left = 192,192,192), the floor/wall edge as a thin grey line (edge = 208,208,208), a faint band on the planet
  just above the ring (above-ring = 249,249,249). The grey areas show the **4 × 4 noise pattern** (a fine regular
  dither: neighbouring pixels differ).

## blur
- **Task:** Blur the SSAO texture to remove the noise pattern: a second single-channel render target filled by `ssao_blur.hlsl` (learnopengl's 4 × 4 box blur) reading the SSAO texture. Show the blurred texture.
- **Hint:** `m_ssaoColorBufferBlur` like `m_ssaoColorBuffer` (RTV `FrameCount + 4`, SRV slot 10; heaps `FrameCount + 5` and `1 + 2 * MaxMeshes + 6`), `m_ssaoBlurPipelineState` from `ssao_blur.hlsl` with the SSAO pass's settings. Frame `// 3.`: barrier, its RTV, clear, the PSO, table 2 = slot 8 (the SSAO texture as t0), the quad, barrier back; the lighting pass's table 4 = slot 10. `ssao_blur.hlsl`: `ssaoInput.GetDimensions(width, height); float2 texelSize = 1.0f / float2(width, height);` and the sum of `ssaoInput.Sample(clampSampler, input.texCoord + float2(float(x), float(y)) * texelSize).r` for x and y from -2 to 1, divided by 16.
- **When done:** `main.cpp`: members `m_ssaoBlurPipelineState`, `m_ssaoColorBufferBlur`; heaps `FrameCount + 5` and `1 + 2 *
  MaxMeshes + 6`; `D3DCompileFromFile(L"ssao_blur.hlsl", …)`, `CreateGraphicsPipelineState(…, &m_ssaoBlurPipelineState)`;
  `// and blur stage` (RTV `FrameCount + 4`, SRV slot 10); `// 3. blur SSAO texture to remove noise` (barriers,
  `SetPipelineState(m_ssaoBlurPipelineState.Get())`, `SetGraphicsRootDescriptorTable(2, ssaoInput)` at slot 8,
  `DrawInstanced(6, 1, 36, 0)`); the lighting pass's `ssao` handle at slot 10. `ssao_blur.hlsl`: learnopengl's `main`
  (`GetDimensions`, the two `for` loops, `/ (4.0f * 4.0f)`). The window shows **the smooth AO** (as OpenGL's: the dither
  is gone): ring-left = 56,56,56, ring-right = 60,60,60, ring-mid = 110,110,110, contact = 161,161,161, contact-left =
  196,196,196, edge = 219,219,219, above-ring = 233,233,233, planet-left = 254,254,254; still white: planet,
  planet-lit, floor, wall, wall-lit = 255,255,255.

## apply
- **Task:** Use the blurred AO in the lighting: multiply the ambient term by it, and remove the line that showed the SSAO texture.
- **Hint:** `float AmbientOcclusion = ssao.Sample(clampSampler, input.texCoord).r;` and `float3 ambient = 0.3f * Diffuse * AmbientOcclusion;` – only the ambient light is occluded; the direct light keeps its own (shadow-free) diffuse and specular. The end of `PSMain` is `return float4(lighting, 1.0f);` again.
- **When done:** `ssao_lighting.hlsl`: `float AmbientOcclusion = ssao.Sample(clampSampler, input.texCoord).r;`, `float3
  ambient = 0.3f * Diffuse * AmbientOcclusion;`, `return float4(lighting, 1.0f);` (learnopengl's 9.ssao_lighting.fs);
  `main.cpp`: the pass comment `// 4. lighting pass: traditional deferred Blinn-Phong lighting with added screen-space
  ambient occlusion`. The lit scene is back, **darker where the AO is grey** (as OpenGL's): the ring's underside
  (ring-left = 28,28,57 – start 84,84,114; ring-right = 44,44,110 – start 99,99,165; ring-mid = 45,45,81 – start
  87,87,122), the contact shadow under the planet (contact = 66,66,117 – start 93,93,144; contact-left = 74,74,120 –
  start 91,91,136), the floor/wall edge (edge = 69,69,85 – start 79,79,95), above-ring = 67,67,68 (start 73,73,75);
  unchanged: planet = 73,73,73, planet-lit = 103,103,179, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199,
  planet-left = 72,72,72. This is the solution.