# Diffuse Irradiance – tasks (DirectX 12)

learnopengl.com "PBR / IBL / Diffuse irradiance": `src/6.pbr/2.1.1.ibl_irradiance_conversion` and `2.1.2.ibl_irradiance`;
the Direct3D 12 side continues `pbr-lighting` and uses what the Advanced Lighting projects introduced: floating-point
render targets, a cube map as a texture with six array slices (point-shadows), the skybox drawn last with `xyww`
(cubemaps), pipeline states made by changing one `psoDesc`. New: **render target views of single cube faces**, passes
that are **recorded once in `LoadAssets`**, and a floating-point texture loaded with `stbi_loadf`.
Files: `main.cpp`, `pbr.hlsl` (the finished direct lighting of the previous chapter), `environment.hdr` (the course's
own 512 × 256 Radiance HDR environment, equirectangular; learnopengl uses `newport_loft.hdr`), `cubemap.hlsl` (complete:
`VSMain` of the capture passes, learnopengl's cubemap.vs, with `cbuffer CaptureConstants { float4x4 captureView;
float4x4 captureProjection; }` at b0), `equirectangular_to_cubemap.hlsl` and `irradiance_convolution.hlsl` (a `PSMain`
each, bodies TODO), `background.hlsl` (`VSMain` + `PSMain`, bodies TODO).

The fixed choices of the whole PBR part (camera (0, 0, 22), the 24-segment sphere, the 7 × 7 grid at z = 0, the four
lights, the IBL sizes) are at the top of `../pbr-lighting/tasks.md`. **In this chapter:**
- **Start** = `pbr-lighting` after its `tone-map` task (the 7 × 7 red spheres with the material in the root constants,
  Reinhard + gamma in `pbr.hlsl`, ambient `0.03 * albedo * ao`), plus: a second vertex buffer `m_cubeVertexBuffer` with
  learnopengl's `renderCube` cube (36 vertices, the same `Vertex` struct, tangent zero) and the helper `RenderCube()`
  (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST)`, `IASetVertexBuffers`, `DrawInstanced(36, 1, 0, 0)`),
  the shader files above and TODO comments. `LoadTexture` is still there, unused.
- **Descriptor heaps.** CBV/SRV heap: slot 0 the CBV, 1 the HDR texture, 2 the environment cube map, 3 the irradiance
  map. RTV heap: the two back buffers and **one** more descriptor (slot `FrameCount`) that every capture pass reuses:
  `SetCaptureTarget(cubemap, face, mip)` writes a view of one face into it (`D3D12_RTV_DIMENSION_TEXTURE2DARRAY`,
  `Texture2DArray.FirstArraySlice = face`, `ArraySize = 1`, `MipSlice = mip`) and calls `OMSetRenderTargets` – the
  counterpart of learnopengl's `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, mip)` on its one
  `captureFBO`. This works because `OMSetRenderTargets` records the descriptor's contents into the command list (RTV
  heaps are not shader visible; Microsoft Learn, "Non Shader Visible Descriptor Heaps"), so the slot is free again
  right after the call.
- **Root signature** (after `environment-map`): parameter 0 = root constants (b0; each pipeline's shaders read their
  own cbuffer there: `ModelConstants`, 38 values, or `CaptureConstants`, 32), 1 = a table with the CBV (b1), 2 = a
  table with **one SRV (t0)** – the texture the pass reads: the HDR texture for the conversion, the environment cube
  map for the convolution and the background, the irradiance map for the spheres (`ambient`); static sampler s0:
  `MIN_MAG_MIP_LINEAR`, CLAMP (learnopengl's `GL_LINEAR`, `GL_CLAMP_TO_EDGE`).
- **The environment:** `LoadHdrTexture("environment.hdr", m_hdrTexture, hdrTextureUploadHeap, 1)`: `stbi_loadf(path, …,
  4)` (four floats per pixel), a `DXGI_FORMAT_R32G32B32A32_FLOAT` 2D texture (learnopengl: `GL_RGB16F` from `GL_RGB`
  floats – Direct3D has no three-channel float format that can be filtered everywhere; `R32G32B32A32_FLOAT` takes the
  loader's floats as they are and feature level 11.0 guarantees linear filtering for it), uploaded like `LoadTexture`
  with `RowPitch = width * 4 * sizeof(float)`; not flipped. `SampleSphericalMap` therefore ends with `uv.y = 1.0f -
  uv.y` (Direct3D's v = 0 is the image's top row = straight up; learnopengl flips the image when loading instead).
- **The capture** (recorded once, in `LoadAssets`, into the command list that also carries the texture uploads – it is
  executed at the end of `LoadAssets`, before the first frame; learnopengl does the same before its render loop):
  `captureProjection = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), 1.0f, 0.1f, 10.0f) * XMMatrixScaling(1.0f,
  -1.0f, 1.0f)` and learnopengl's six `captureViews` as `XMMatrixLookAtRH(eye, direction, up)` (+x, -x, +y, -y, +z, -z
  with the ups (0, -1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0)); per face: the matrices as root
  constants (`CaptureConstants`, transposed), `SetCaptureTarget(…, i, 0)`, `RenderCube()`; viewport and scissor
  rectangle of the cube map's size; at the end a barrier RENDER_TARGET → PIXEL_SHADER_RESOURCE.
  Environment cube map `m_envCubemap`: `Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, 1, …,
  D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, created in the RENDER_TARGET state, SRV `D3D12_SRV_DIMENSION_TEXTURECUBE`
  (slot 2). Irradiance map `m_irradianceMap`: the same with 32 × 32 (slot 3), `sampleDelta = 0.1` (learnopengl 0.025;
  63 × 16 = 1008 samples per texel).
- **The background:** `background.hlsl` with `m_backgroundPipelineState` (depth function LESS_EQUAL) drawn last with
  `RenderCube()`: `mul(position, (float3x3)view)`, `clipPos.xyww` (depth 1.0); `PSMain`: `environmentMap.SampleLevel(
  clampSampler, input.worldPos, 0.0f)`, Reinhard, gamma 2.2. After `irradiance-map` the same pipeline shows the
  irradiance map (only the SRV in root parameter 2 changes: slot 3 instead of 2); `ambient` shows the environment again.

**Deviations from learnopengl (Direct3D 12):**
- **The y flip in `captureProjection`.** Cube map faces are addressed the same way in OpenGL and Direct3D (for +X: u
  from -z, v from -y), but a render target's first row is the *top* of the picture in Direct3D (NDC y = +1) and the
  bottom in OpenGL. With learnopengl's views and ups every face would be stored upside down; the scaling by (1, -1, 1)
  after the projection puts them right (the point-shadows chapter's `shadowProj` does the same). Checked numerically:
  with the flip, the pixel a direction is drawn to (`uv = (ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5)`) equals the cube
  map's own (u, v) of that direction for 10,000 random directions; without it v is mirrored for all of them. Nothing
  is culled (`D3D12_CULL_MODE_NONE`), so the reversed winding does not matter.
- **No depth buffer and no clear in the capture passes** (learnopengl attaches a depth renderbuffer `captureRBO` and
  clears): the cube is drawn from its centre – one face covers every pixel, the others are outside the view – so
  nothing overlaps and every pixel is written. The capture pipeline states have `DepthEnable = FALSE`, `DSVFormat =
  DXGI_FORMAT_UNKNOWN`.
- **`SampleLevel(…, 0.0f)` in the convolution's loops** instead of learnopengl's `texture(…)`: a `Sample` needs
  screen-space derivatives, which HLSL does not allow in a loop with a varying number of iterations; the environment
  cube map has one mip level in this chapter anyway.
- **Names:** the capture matrices are `captureView` / `captureProjection` in `CaptureConstants` (learnopengl's
  uniforms are `view` / `projection`; the camera's `view` / `projection` live in `SceneConstantBuffer`). Pipeline
  states: `m_equirectangularToCubemapPipelineState`, `m_irradiancePipelineState`, `m_backgroundPipelineState`
  (learnopengl's shader objects `equirectangularToCubemapShader`, `irradianceShader`, `backgroundShader`).
- The viewport needs no restoring: `PopulateCommandList` sets the window's viewport every frame.

**What the camera sees of the environment** (as in OpenGL). The camera looks down -z, which is the middle of the
image's left half (u = 0.25): pale blue-grey sky above, dark green hills on the horizon (higher on the left of the
window: a solid band from y ≈ 250 to 295 at x < 110; lower and hazier on the right), grey-brown ground below y ≈ 305.
The sun (direction (0.455, 0.682, 0.573): up, to the right, **behind** the camera) and the three coloured lamps are
outside the view; they light the spheres from the front. The 128² faces are magnified about ten times, so the
background is soft.

Pixels: coordinates from the top left of the 800×600 client area; nothing depends on time. D3D12 cannot run here, and
the app's simulator does not follow the capture passes of this project yet (see *Simulator* at the end): the values
below are the **OpenGL project's Mesa values** of the same states – the same maths, sizes and sample counts; expect a
level or two of difference from rounding and from the convolution reading mip level 0. The sphere points are the
previous chapter's: **c00** (153,547), **c03** (400,547), **c06** (647,547), **c33** (400,300), **c60** (153,53),
**c63** (400,53), **c66** (647,53), **h33** (411,288), **h62** (331,46). Background points: **sky** (60,60), **sky-top**
(400,10), **sky-right** (740,180), **hills** (60,270), **hills-high** (60,255) (hill on the left, sky at the same height
on the right: **sky-low-right** (740,255)), **hills-right** (740,270), **ground** (60,500), **ground-bottom** (400,594),
**gap-sky** (359,95) and **gap-ground** (359,506) (between four spheres).

**Start picture:** the previous chapter's tone-mapped spheres on the clear colour: every background point = 26,26,26;
c00 = 157,1,1, c03 = 146,27,27, c06 = 159,41,41, c33 = 115,19,19, c60 = 68,0,0, c63 = 95,11,11, c66 = 124,17,17, h33 =
177,71,71, h62 = 239,81,81. (The simulator follows this state, with the triangle strip caveat of `pbr-lighting`.)

## environment-map
- **Task:** Load `environment.hdr` with `stbi_loadf` into a floating-point 2D texture (`LoadHdrTexture`), render it once – in `LoadAssets` – into the six faces of a 128 × 128 floating-point cube map (`m_envCubemap`) with the 90° capture projection and the six capture views, and draw that cube map as the background behind the spheres.
- **Hint:** In the class: `struct CaptureConstants { XMFLOAT4X4 captureView; XMFLOAT4X4 captureProjection; };`, the members, and the two new functions. Heaps: `rtvHeapDesc.NumDescriptors = FrameCount + 1`, `cbvSrvHeapDesc.NumDescriptors = 3`. Root signature: `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`, `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`, a static sampler `samplers[0]` (`D3D12_FILTER_MIN_MAG_MIP_LINEAR`, `D3D12_TEXTURE_ADDRESS_MODE_CLAMP` ×3, register 0). Pipeline states from the same `psoDesc`: the conversion (`cubemap.hlsl` `VSMain`, `equirectangular_to_cubemap.hlsl` `PSMain`, `RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`, `DepthStencilState.DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN`), then the background (`background.hlsl`, `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthEnable = TRUE`, `DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`). `LoadHdrTexture` is `LoadTexture` with `float* data = stbi_loadf(path, &width, &height, &nrComponents, 4)`, `DXGI_FORMAT_R32G32B32A32_FLOAT` and `RowPitch = width * 4 * sizeof(float)`. The cube map: `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` in the state `D3D12_RESOURCE_STATE_RENDER_TARGET`, SRV with `D3D12_SRV_DIMENSION_TEXTURECUBE` in slot 2. `SetCaptureTarget`: a `D3D12_RENDER_TARGET_VIEW_DESC` with `D3D12_RTV_DIMENSION_TEXTURE2DARRAY`, `Texture2DArray.MipSlice = mip`, `.FirstArraySlice = face`, `.ArraySize = 1`, created in RTV heap slot `FrameCount`, then `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`. The pass: `SetGraphicsRootSignature`, `SetDescriptorHeaps`, table 1, then `SetPipelineState(m_equirectangularToCubemapPipelineState.Get())`, table 2 = slot 1, a 128 × 128 `CD3DX12_VIEWPORT` and `CD3DX12_RECT`, and for each face `XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]))`, `SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0)`, `SetCaptureTarget(m_envCubemap.Get(), i, 0)`, `RenderCube()`; finally the barrier to `PIXEL_SHADER_RESOURCE`. `equirectangular_to_cubemap.hlsl`: `float2 uv = float2(atan2(v.z, v.x), asin(v.y)); uv *= invAtan; uv += 0.5f; uv.y = 1.0f - uv.y;` with `static const float2 invAtan = float2(0.1591f, 0.3183f)`. `background.hlsl`: `float3 viewPosition = mul(position, (float3x3)view); float4 clipPos = mul(float4(viewPosition, 1.0f), projection); result.position = clipPos.xyww;` and `environmentMap.SampleLevel(clampSampler, input.worldPos, 0.0f).rgb`, then `envColor / (envColor + 1)` and `pow(envColor, 1.0f / 2.2f)`. In `PopulateCommandList`, after `RenderScene()`: `SetPipelineState(m_backgroundPipelineState.Get())`, table 2 = slot 2, `RenderCube()`.
- **When done:** `main.cpp`: `struct CaptureConstants` (`captureView`, `captureProjection`); members `m_equirectangularToCubemapPipelineState`, `m_backgroundPipelineState`, `m_hdrTexture`, `m_envCubemap`; declarations and definitions of `SetCaptureTarget(ID3D12Resource* cubemap, UINT face, UINT mip)` (`D3D12_RTV_DIMENSION_TEXTURE2DARRAY`, `Texture2DArray.FirstArraySlice = face`, `ArraySize = 1`, `MipSlice = mip`, `CreateRenderTargetView(cubemap, &rtvDesc, rtvHandle)` at slot `FrameCount`, `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`) and `LoadHdrTexture` (`stbi_loadf(…, 4)`, `DXGI_FORMAT_R32G32B32A32_FLOAT`, `UpdateSubresources`, the barrier, the SRV); `rtvHeapDesc.NumDescriptors = FrameCount + 1`, `cbvSrvHeapDesc.NumDescriptors = 3`; `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`, `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`, `samplers[0]` (CLAMP) passed to `rootSignatureDesc.Init`; `D3DCompileFromFile` of `cubemap.hlsl` (`VSMain`), `equirectangular_to_cubemap.hlsl` (`PSMain`) and `background.hlsl` (both) with the two `CreateGraphicsPipelineState` calls (`RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`, `DepthEnable = FALSE`, `DSVFormat = DXGI_FORMAT_UNKNOWN`; then `DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthEnable = TRUE`, `D3D12_COMPARISON_FUNC_LESS_EQUAL`, `DXGI_FORMAT_D32_FLOAT`); in `LoadAssets` after the depth buffer: `LoadHdrTexture("environment.hdr", m_hdrTexture, hdrTextureUploadHeap, 1)`, the `// pbr: setup cubemap to render to` block (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, `D3D12_RESOURCE_STATE_RENDER_TARGET`, `D3D12_SRV_DIMENSION_TEXTURECUBE` at slot 2), `captureProjection` (with `XMMatrixScaling(1.0f, -1.0f, 1.0f)`), the six `XMMatrixLookAtRH` `captureViews`, `SetGraphicsRootSignature` / `SetDescriptorHeaps` / table 1, and the `// pbr: convert HDR equirectangular environment map to cubemap equivalent` block (the loop over the six faces with `SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, …)`, `SetCaptureTarget(m_envCubemap.Get(), i, 0)`, `RenderCube()`, and the barrier RENDER_TARGET → PIXEL_SHADER_RESOURCE); in `PopulateCommandList` the `// render skybox` block after `RenderScene()` (`m_backgroundPipelineState`, table 2 = heap slot 2, `RenderCube()`). `equirectangular_to_cubemap.hlsl`: `invAtan`, `SampleSphericalMap` (with `uv.y = 1.0f - uv.y`), `equirectangularMap.Sample(clampSampler, uv)`. `background.hlsl`: `(float3x3)view`, `clipPos.xyww`; `SampleLevel(clampSampler, input.worldPos, 0.0f)`, Reinhard, gamma.
  **Picture: the sky behind the spheres** (the spheres themselves are unchanged – the ambient term is still the constant): sky = 169,178,195, sky-top = 161,173,193, sky-right = 190,193,201, hills = 64,89,64, hills-high = 64,89,64 while sky-low-right = 158,164,166 (the hills are higher on the left), hills-right = 117,127,119, ground = 107,100,90, ground-bottom = 104,97,87, gap-sky = 170,179,195, gap-ground = 107,100,89; c00 = 157,1,1, c33 = 115,19,19, c66 = 124,17,17, h33 = 177,71,71 as before. The sky is the right way up (bright blue-grey at the top, ground at the bottom), the higher hills on the left. About 305,400 pixels change (all of the background).

## irradiance-map
- **Task:** Create the irradiance map: a 32 × 32 floating-point cube map (`m_irradianceMap`) into which the environment cube map is convoluted with `irradiance_convolution.hlsl` – for every direction the cosine-weighted average of the environment over the hemisphere around it (`sampleDelta = 0.1`). For now show the irradiance map as the background.
- **Hint:** A third pipeline state between the other two: the same `psoDesc` with `psoDesc.PS` = `irradiance_convolution.hlsl`'s `PSMain` → `m_irradiancePipelineState`. `cbvSrvHeapDesc.NumDescriptors = 4`. After the environment's capture in `LoadAssets`: the new cube map like `m_envCubemap` but 32 × 32, its SRV in slot 3; then `SetPipelineState(m_irradiancePipelineState.Get())`, table 2 = slot 2 (the environment cube map), a 32 × 32 viewport and scissor rectangle and the same six-face loop with `SetCaptureTarget(m_irradianceMap.Get(), i, 0)`; the barrier to `PIXEL_SHADER_RESOURCE`. The shader: `float3 up = float3(0.0f, 1.0f, 0.0f); float3 right = normalize(cross(up, N)); up = normalize(cross(N, right));`, then two loops `for (float phi = 0.0f; phi < 2.0f * PI; phi += sampleDelta)` and `for (float theta = 0.0f; theta < 0.5f * PI; theta += sampleDelta)`: `tangentSample = float3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta))`, `sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N`, `irradiance += environmentMap.SampleLevel(clampSampler, sampleVec, 0.0f).rgb * cos(theta) * sin(theta); nrSamples++;` and finally `irradiance = PI * irradiance * (1.0f / float(nrSamples));`. In `PopulateCommandList` give the background heap slot 3 instead of 2.
- **When done:** `main.cpp`: members `m_irradiancePipelineState`, `m_irradianceMap`; `cbvSrvHeapDesc.NumDescriptors = 4`; `D3DCompileFromFile(L"irradiance_convolution.hlsl", …, "PSMain", "ps_5_0", …)`, `psoDesc.PS = …`, `CreateGraphicsPipelineState(…, &m_irradiancePipelineState)` (between the conversion's and the background's); the blocks `// pbr: create an irradiance cubemap` (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 32, 32, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, SRV `TEXTURECUBE` at slot 3) and `// pbr: solve diffuse integral by convolution to create an irradiance (cube)map.` (`m_irradiancePipelineState`, table 2 = slot 2, the 32 × 32 viewport, the loop with `SetCaptureTarget(m_irradianceMap.Get(), i, 0)` and `RenderCube()`, the barrier); the background's table 2 = `irradianceMap` at heap slot 3. `irradiance_convolution.hlsl`: `up` / `right`, `sampleDelta = 0.1f`, the two loops with `SampleLevel(clampSampler, sampleVec, 0.0f)`, `PI * irradiance * (1.0f / float(nrSamples))`.
  **Picture: the background is a very soft blur** – the irradiance changes slowly with the direction, the hills and the horizon are gone: a pale grey-violet everywhere, slightly bluer at the top and warmer at the bottom: sky ≈ 162,163,176, sky-top ≈ 164,164,180, sky-right ≈ 163,159,175, hills ≈ 161,158,168, hills-high and sky-low-right within 3 of 161,158,170, hills-right ≈ 161,156,172, ground ≈ 157,150,157, ground-bottom ≈ 158,146,155, gap-sky ≈ 163,163,177, gap-ground ≈ 160,150,160. It is bright even below the horizon because every direction's hemisphere reaches part of the sky or the sun. The spheres are unchanged (c00 = 157,1,1, c33 = 115,19,19, c66 = 124,17,17).

## ambient
- **Task:** Use the irradiance map as the ambient light in `pbr.hlsl`: sample it with the normal, multiply by the albedo, and weight it with `kD` – one minus the Fresnel reflectance from `fresnelSchlickRoughness`, times `1.0 - metallic`. Show the environment map as the background again.
- **Hint:** `TextureCube irradianceMap : register(t0);` and `SamplerState clampSampler : register(s0);`; in `PopulateCommandList` before `RenderScene()`: `CD3DX12_GPU_DESCRIPTOR_HANDLE irradianceMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize); m_commandList->SetGraphicsRootDescriptorTable(2, irradianceMap);`, and the background's table 2 = slot 2 again. `float3 fresnelSchlickRoughness(float cosTheta, float3 F0, float roughness) { float invRoughness = 1.0f - roughness; return F0 + (max(float3(invRoughness, invRoughness, invRoughness), F0) - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f); }`. The ambient term: `float3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness); float3 kD = 1.0f - kS; kD *= 1.0f - metallic; float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb; float3 diffuse = irradiance * albedo; float3 ambient = (kD * diffuse) * ao;`.
- **When done:** `main.cpp` (`PopulateCommandList`): `SetGraphicsRootDescriptorTable(2, irradianceMap)` (heap slot 3) before `RenderScene()`; the background's table 2 = `envCubemap` at heap slot 2 again. `pbr.hlsl`: `TextureCube irradianceMap : register(t0);`, `SamplerState clampSampler : register(s0);`, `fresnelSchlickRoughness`, and the ambient lines above instead of `float3(0.03f, 0.03f, 0.03f) * albedo * ao`.
  **Picture:** the environment behind the spheres as after `environment-map` (sky = 169,178,195, hills = 64,89,64, ground = 107,100,90, gap-sky = 170,179,195, gap-ground = 107,100,89 …), and **the non-metal spheres are lit by the sky**: the bottom rows are clearly brighter and evenly lit, no dark rims: c00 ≈ 193,1,1 (was 157,1,1), c03 ≈ 187,27,27 (146,27,27), c06 ≈ 188,41,41 (159,41,41), c33 ≈ 146,19,19 (115,19,19), h33 ≈ 190,71,71 (177,71,71); the metal rows hardly change, because metals have no diffuse reflection: c60 ≈ 76,0,0 (68,0,0), c63 ≈ 99,11,11 (95,11,11), c66 ≈ 125,17,17 (124,17,17), h62 ≈ 239,81,81. Only the red channel grows (the albedo is (0.5, 0, 0)). About 137,000 sphere pixels change. This is the solution.

## Notes
- The conversion and the convolution run **once**: they are recorded in `LoadAssets` and executed with the texture
  uploads before the first frame; a frame only samples the two cube maps. The alternative – recording them in the first
  `PopulateCommandList` behind a flag – would work too, but `LoadAssets` is where this program already does its one-time
  GPU work (the command list is open there), and the frame's code stays the frame's.
- `stbi_loadf` returns floats (linear radiance, values far above 1.0: the sun is about 60); an 8-bit texture would clip
  them, hence floating-point formats everywhere on the way: `R32G32B32A32_FLOAT` for the loaded image,
  `R16G16B16A16_FLOAT` (half floats, up to 65504) for the cube maps.
- Resource states: the cube maps are created as render targets, drawn into, and turned into shader resources with one
  barrier each (all six faces at once – `D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES` is the default of `Transition`). They
  have no optimized clear value: they are never cleared.
- Tier 1 hardware wants every descriptor a bound table covers to be initialised: the tables here have exactly one SRV
  (t0) and always point at a slot that was written when its texture was created.

## Simulator
Checked with a runner on the app's simulator (`Simulator.Build` + `Rasterizer.Render`), every state. What it shows now
and what is missing for this project (states `environment-map`, `irradiance-map`, `ambient`):
- **Draws recorded in the setup are dropped** (`FrameRecorder.Setup` clears the draws and clears recorded in
  `LoadAssets`): the six conversion draws and the six convolution draws never happen, the cube maps stay empty. Shown:
  a **black background** in all three states (the background samples an empty cube map); after `ambient` the spheres
  lose their ambient light (irradiance 0) instead of gaining it. Expected: the pictures above.
- **A render target view written again between draws** (`SetCaptureTarget`: `CreateRenderTargetView` into the same RTV
  heap slot for each face, then `OMSetRenderTargets`): the device model keeps one resource per RTV handle and resolves
  it after the run, and it ignores the view description (`Texture2DArray.FirstArraySlice`, `MipSlice`) – it would need
  the (resource, array slice, mip level) at the time of `OMSetRenderTargets`.
- **Per-draw topology:** the simulator takes the first `IASetPrimitiveTopology` in the source for every draw; here
  `RenderSphere()` sets `TRIANGLESTRIP` and `RenderCube()` `TRIANGLELIST` (and `TRIANGLESTRIP` is read as a list, see
  `pbr-lighting`).
- Not reached yet, so untested here: `stbi_loadf` data with four channels as an `R32G32B32A32_FLOAT` texture
  (`UpdateSubresources` with `pData` = the loader's pointer), `atan2` / `asin` in HLSL, `SampleLevel` on a
  `TextureCube`, `float` loop counters in HLSL.
- The start state is followed (with the triangle strip caveat).
