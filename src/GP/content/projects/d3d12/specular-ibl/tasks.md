# Specular IBL – tasks (DirectX 12)

learnopengl.com "PBR / IBL / Specular IBL": `src/6.pbr/2.2.1.ibl_specular` and `2.2.2.ibl_specular_textured`; the
Direct3D 12 side continues `diffuse-irradiance` (capture passes recorded once in `LoadAssets`, `SetCaptureTarget`,
`CaptureConstants`, one SRV table for the texture a pass reads). New: **rendering into mip levels** (a render target
view per face *and* level, a viewport per level), **shader resource views of single mip levels** and **per-subresource
barriers** (to make a cube map's mip levels by hand – Direct3D 12 has no `glGenerateMipmap`), `SampleLevel` with a
computed level, a **two-channel float render target** (`DXGI_FORMAT_R16G16_FLOAT`).
Files: `main.cpp`, `pbr.hlsl`, `environment.hdr`, `cubemap.hlsl`, `equirectangular_to_cubemap.hlsl`,
`irradiance_convolution.hlsl`, `background.hlsl` (all as the previous chapter left them), and new: `prefilter.hlsl`
(`PSMain` with TODOs; `DistributionGGX`, `RadicalInverse_VdC`, `Hammersley` are there; its `cbuffer CaptureConstants`
has `float roughness` after the two matrices), `brdf.hlsl` (`VSMain` complete – learnopengl's brdf.vs –,
`RadicalInverse_VdC` and `Hammersley` there, the rest of `PSMain`'s functions TODO), `downsample.hlsl` (`PSMain` TODO:
makes a mip level from the one above), `debug_quad.hlsl` (complete: shows a two-channel texture) and the material's
maps `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png` for the last task.

The fixed choices of the whole PBR part are at the top of `../pbr-lighting/tasks.md`, the environment, the capture
(`captureProjection` with its y flip, `captureViews`, `SetCaptureTarget`) and the background in
`../diffuse-irradiance/tasks.md`. **In this chapter:**
- **Start** = the end of `diffuse-irradiance`, plus: the screen quad as vertices 36–39 of `m_cubeVertexBuffer`
  (learnopengl's `renderQuad`: a triangle strip of 4 vertices covering the render target; texture coordinates (0, 0) at
  the **top** left … (1, 1) bottom right – learnopengl's with v flipped) and the helper `RenderQuad()`
  (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)`, `DrawInstanced(4, 1, 36, 0)`), the new shader files
  and TODO comments.
- **CBV/SRV heap** (13 descriptors after `prefilter-map`, 18 after `textured`): 0 the CBV, 1 the HDR texture, 2 the
  environment cube map (all mip levels), 3 the irradiance map, 4 the pre-filter map, 5 the BRDF lookup texture, 6–12
  the environment cube map's mip levels 0–6 one by one (the sources for making levels 1–7), 13–17 the material's maps.
- **The environment's mip levels** (`prefilter-map`): `m_envCubemap` gets `EnvMipLevels = 8` levels (128 … 1). After
  the conversion has drawn level 0, every level `mip` = 1 … 7 is drawn from level `mip - 1` with the six capture views:
  the pipeline state `m_downsamplePipelineState` (`cubemap.hlsl` + `downsample.hlsl`), a cube map SRV that shows only
  level `mip - 1` (`TextureCube.MostDetailedMip = mip - 1`, `MipLevels = 1`, heap slot `6 + (mip - 1)`), the viewport
  `128 >> mip`, `SetCaptureTarget(m_envCubemap.Get(), i, mip)`. A pixel of the smaller face lies exactly between 2 × 2
  texels of the larger one, so the linear filter returns their average – the box filter of `glGenerateMipmap`. A level
  cannot be read while it is drawn into: the single-level view leaves the level being drawn out, and the resource
  states follow per subresource – after a level's six faces are drawn, six barriers turn `D3D12CalcSubresource(mip, i,
  0, EnvMipLevels, 6)` from RENDER_TARGET to PIXEL_SHADER_RESOURCE.
- **Pre-filter map** `m_prefilterMap`: `Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, …)` (learnopengl 128 × 128),
  SRV `TEXTURECUBE` with `MipLevels = 5` in slot 4, read with s0 (`MIN_MAG_MIP_LINEAR`: trilinear); `maxMipLevels = 5`:
  level `mip` is drawn with `captureConstants.roughness = mip / 4` (0, 0.25, 0.5, 0.75, 1.0) into
  `SetCaptureTarget(m_prefilterMap.Get(), i, mip)` with the viewport `64 * 0.5^mip` (64, 32, 16, 8, 4).
  `prefilter.hlsl`: `SAMPLE_COUNT = 128u` (learnopengl 1024), `N = R = V`, Hammersley + `ImportanceSampleGGX`, and
  learnopengl's **mip-level trick** against bright dots: each sample reads the environment at `mipLevel = roughness ==
  0.0f ? 0.0f : 0.5f * log2(saSample / saTexel)` with `resolution = 128.0f` – `environmentMap.SampleLevel(clampSampler,
  L, mipLevel)`.
- **BRDF lookup texture** `m_brdfLUTTexture`: `Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, …)` (learnopengl 512 × 512,
  `GL_RG16F`), SRV in slot 5, drawn once with `m_brdfPipelineState` (`brdf.hlsl`, `RTVFormats[0] =
  DXGI_FORMAT_R16G16_FLOAT`) on `RenderQuad()` through the capture RTV slot (`CreateRenderTargetView(m_brdfLUTTexture.Get(),
  nullptr, rtvHandle)`); `PSMain` returns a `float2`; `SAMPLE_COUNT = 128u`; u = NdotV, v = roughness; red = the scale
  of F0, green = the bias. With the quad's v = 0 at the top, the texture's first row is roughness 0 – and a lookup with
  v = roughness reads it there, as in OpenGL (where both "first rows" are at the bottom).
- **What the window shows meanwhile:** after `prefilter-map` the background samples the pre-filter map (heap slot 4) at
  mip level 1.2 (`SampleLevel(…, 1.2f)` in `background.hlsl`); after `brdf-lut` a screen quad with
  `m_debugQuadPipelineState` (`brdf.hlsl`'s `VSMain` + `debug_quad.hlsl`, no depth test) drawn last covers the whole
  window with the lookup texture – `debug_quad.hlsl` samples it with **v flipped**, so roughness 0 is at the bottom of
  the window as in learnopengl's (and OpenGL's) picture; `specular` removes that quad and its pipeline state again and
  restores the environment background (slot 2, level 0.0). `debug_quad.hlsl` stays in the folder as an unused helper.
- **The split sum** in `pbr.hlsl` (`specular`): `R = reflect(-V, N)`, `F = fresnelSchlickRoughness(max(dot(N, V), 0.0f),
  F0, roughness)`, `prefilteredColor = prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD).rgb`
  with `MAX_REFLECTION_LOD = 4.0f`, `brdf = brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg`,
  `specular = prefilteredColor * (F * brdf.x + brdf.y)`, `ambient = (kD * diffuse + specular) * ao`. Registers
  (learnopengl's texture units): `irradianceMap` t0 (root parameter 2), `prefilterMap` t1 and `brdfLUT` t2 (a new root
  parameter 3: a table of 2 SRVs, heap slots 4 and 5), in the last task `albedoMap` t3 … `aoMap` t7 (root parameter 4:
  a table of 5 SRVs, slots 13–17) with a second static sampler s1 (WRAP).
- **The last task's spheres:** the 3 × 3 grid of `pbr-lighting`'s last task (spacing 6.0, rotate 90° about +y, scale
  2.4), the maps and `getNormalFromMap(input)` exactly as there. learnopengl shows five materials on five spheres; the
  course has one material and shows it on nine spheres at different places of the environment. `ModelConstants`
  shrinks to 32 values there, one fewer than `CaptureConstants` (33): root parameter 0 is sized
  `sizeof(CaptureConstants) / 4` from then on.
- The smaller numbers (64² / 128² / 128 samples) are for the course's simulator, which runs on the CPU; a real GPU
  handles learnopengl's 128² pre-filter map, 512² lookup texture and 1024 samples easily.

**Deviations from learnopengl (Direct3D 12)** besides those of `diffuse-irradiance`:
- **Mip levels made by drawing** instead of `glGenerateMipmap` (see above; pipeline state `m_downsamplePipelineState`,
  `downsample.hlsl`). The pre-filter map needs no such call at all: its levels exist from `Tex2D(…, 5, …)` on, and all
  are drawn.
- The irradiance convolution keeps reading level 0 of the environment (`SampleLevel(…, 0.0f)`); learnopengl's
  `texture(…)` picks a blurrier level there once the environment has mipmaps. The irradiance map changes by at most a
  few levels (OpenGL's own picture changes by up to 3 levels between the two chapters for this reason).
- No `glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS)`: Direct3D always filters across the edges of a cube map's faces.
- The lookup texture is *shown* with v flipped (`debug_quad.hlsl`), so the picture matches the other APIs'.

Pixels: coordinates from the top left of the 800×600 client area; nothing depends on time. D3D12 cannot run here; the
values below are the **OpenGL project's Mesa values** of the same states – the same maths, sizes and sample counts. The
app's simulator follows this project in every state (see *Simulator* at the end for where it differs). Sphere points as before: **c00** (153,547), **c03**
(400,547), **c06** (647,547), **c30** (153,300), **c33** (400,300), **c36** (647,300), **c60** (153,53), **c63** (400,53),
**c66** (647,53), **h33** (411,288), **h62** (331,46). On the smooth bottom left sphere (row 0, col 0): **sky-refl**
(146,527) (its upper half), **ground-refl** (153,563) (its lower half), **sun00** (157,539) (where the sun's reflection
appears; **sun01** (240,539) on the next sphere); on the smooth metal sphere (row 6, col 0): **metal-sky** (139,37),
**metal-ground** (153,61). Background points: **sky** (60,60), **sky-top** (400,10), **sky-right** (740,180), **hills**
(60,270), **hills-right** (740,270), **ground** (60,500), **ground-bottom** (400,594), **glow** (20,560),
**bottom-right** (790,590), **gap-sky** (359,95), **gap-ground** (359,506).

**Start picture:** the previous chapter's result: sky = 169,178,195, sky-top = 161,173,193, sky-right = 190,193,201,
hills = 64,89,64, hills-right = 117,127,119, ground = 107,100,90, ground-bottom = 104,97,87, glow = 106,99,89,
bottom-right = 105,98,88, gap-sky = 170,179,195, gap-ground = 107,100,89; c00 ≈ 193,1,1, c03 ≈ 187,27,27, c06 ≈
188,41,41, c30 ≈ 147,0,0, c33 ≈ 146,19,19, c36 ≈ 149,29,29, c60 ≈ 76,0,0, c63 ≈ 99,11,11, c66 ≈ 125,17,17, h33 ≈
190,71,71, h62 ≈ 239,81,81, sky-refl ≈ 188,1,1, ground-refl ≈ 186,1,1, sun00 ≈ 193,2,2, sun01 ≈ 191,13,13, metal-sky ≈
84,1,1, metal-ground ≈ 68,0,0. The spheres show no trace of the environment's shapes yet.

## prefilter-map
- **Task:** Create the pre-filtered environment map: a 64 × 64 floating-point cube map with 5 mip levels (`m_prefilterMap`) whose levels hold the environment blurred for the roughness 0, 0.25, 0.5, 0.75 and 1.0. Write `ImportanceSampleGGX` and the sampling loop in `prefilter.hlsl` (128 samples, the mip level of the environment chosen from each sample's pdf). Give the environment cube map mip levels for that – all 8, each drawn from the level above with `downsample.hlsl` – and draw every face of every pre-filter level, all in `LoadAssets`. For now show the pre-filter map's mip level 1.2 as the background.
- **Hint:** `static const UINT EnvMipLevels = 8;`; `CaptureConstants` gets `float roughness;`; `cbvSrvHeapDesc.NumDescriptors = 13`. Two more pipeline states after the irradiance one, each only a new `psoDesc.PS`: `downsample.hlsl` → `m_downsamplePipelineState`, `prefilter.hlsl` → `m_prefilterPipelineState`. The environment cube map: `Tex2D(…, 128, 128, 6, EnvMipLevels, …)` and `srvDesc.TextureCube.MipLevels = EnvMipLevels`. After the conversion loop, instead of the one barrier: `CD3DX12_RESOURCE_BARRIER barriers[6]` with `Transition(m_envCubemap.Get(), RENDER_TARGET, PIXEL_SHADER_RESOURCE, D3D12CalcSubresource(0, i, 0, EnvMipLevels, 6))`, `ResourceBarrier(6, barriers)`. Then `for (UINT mip = 1; mip < EnvMipLevels; ++mip)`: an SRV with `TextureCube.MostDetailedMip = mip - 1; TextureCube.MipLevels = 1;` created in heap slot `6 + (mip - 1)` and set as table 2, the viewport `128 >> mip`, the six faces with `SetCaptureTarget(m_envCubemap.Get(), i, mip)` and `RenderCube()`, and the six barriers for level `mip`. `downsample.hlsl`: `environmentMap.Sample(clampSampler, input.worldPos).rgb`. The pre-filter cube map: `Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, SRV with `MipLevels = 5` in slot 4. Its pass: `m_prefilterPipelineState`, table 2 = slot 2, `for (unsigned int mip = 0; mip < maxMipLevels; ++mip)`: `mipWidth = static_cast<unsigned int>(64 * std::pow(0.5, mip))`, viewport and scissor rectangle, `captureConstants.roughness = (float)mip / (float)(maxMipLevels - 1);`, and for the six faces `SetCaptureTarget(m_prefilterMap.Get(), i, mip)` – the last argument is the mip level; one barrier for the whole map at the end. `prefilter.hlsl`: `ImportanceSampleGGX` turns the two random numbers `Xi` into a halfway vector (`phi = 2.0f * PI * Xi.x`, `cosTheta = sqrt((1.0f - Xi.y) / (1.0f + (a * a - 1.0f) * Xi.y))`, then tangent space → world space); in `PSMain` for each `i`: `Xi = Hammersley(i, SAMPLE_COUNT)`, `H = ImportanceSampleGGX(Xi, N, roughness)`, `L = normalize(2.0f * dot(V, H) * H - V)`, and if `NdotL > 0.0f`: `pdf = D * NdotH / (4.0f * HdotV) + 0.0001f`, `saTexel = 4.0f * PI / (6.0f * resolution * resolution)`, `saSample = 1.0f / (float(SAMPLE_COUNT) * pdf + 0.0001f)`, `mipLevel = roughness == 0.0f ? 0.0f : 0.5f * log2(saSample / saTexel)`, `prefilteredColor += environmentMap.SampleLevel(clampSampler, L, mipLevel).rgb * NdotL; totalWeight += NdotL;`. The background: table 2 = slot 4 and level 1.2 in `background.hlsl`.
- **When done:** `main.cpp`: `static const UINT EnvMipLevels = 8;`; `float roughness;` in `CaptureConstants`; members `m_downsamplePipelineState`, `m_prefilterPipelineState`, `m_prefilterMap`; `cbvSrvHeapDesc.NumDescriptors = 13`; `D3DCompileFromFile` of `downsample.hlsl` and `prefilter.hlsl` (`PSMain`) with a `CreateGraphicsPipelineState` each; `m_envCubemap` with `EnvMipLevels` levels (`Tex2D(…, 6, EnvMipLevels, …)`, `TextureCube.MipLevels = EnvMipLevels`); six per-subresource barriers (`D3D12CalcSubresource(0, i, 0, EnvMipLevels, 6)`) after the conversion; the `// then generate mipmaps from first mip face` block (`m_downsamplePipelineState`, `for (UINT mip = 1; mip < EnvMipLevels; ++mip)`, the SRV with `MostDetailedMip = mip - 1` / `MipLevels = 1` at slot `6 + (mip - 1)`, table 2, viewport `128 >> mip`, `SetCaptureTarget(m_envCubemap.Get(), i, mip)`, `RenderCube()`, the six barriers with `D3D12CalcSubresource(mip, i, 0, EnvMipLevels, 6)`); the blocks `// pbr: create a pre-filter cubemap` (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, …)`, SRV `TEXTURECUBE`, `MipLevels = 5`, slot 4) and `// pbr: run a quasi monte-carlo simulation on the environment lighting to create a prefilter (cube)map.` (`m_prefilterPipelineState`, table 2 = slot 2, `maxMipLevels = 5`, the `mip` loop with `mipWidth` / `mipHeight` from `64 * std::pow(0.5, mip)`, viewport, `captureConstants.roughness = roughness`, the face loop with `SetCaptureTarget(m_prefilterMap.Get(), i, mip)` and `RenderCube()`, the barrier); the background's table 2 = `prefilterMap` at heap slot 4. `background.hlsl`: `SampleLevel(clampSampler, input.worldPos, 1.2f)`. `downsample.hlsl`: `environmentMap.Sample(clampSampler, input.worldPos)`. `prefilter.hlsl`: `ImportanceSampleGGX` and learnopengl's sampling loop with `SAMPLE_COUNT = 128u`, `resolution = 128.0f` and `SampleLevel(clampSampler, L, mipLevel)`.
  **Picture: the background is a blurred environment** (between the levels for roughness 0.25 and 0.5): the sky still blue-grey at the top, the hills smeared away, and a **large warm glow at the bottom left** – the orange lamp just outside the view on the left, spread out by the blur: sky ≈ 168,176,191, sky-top ≈ 162,172,191, sky-right ≈ 173,178,188, hills ≈ 168,164,164, hills-right ≈ 157,160,168, ground ≈ 203,182,149, glow ≈ 216,197,161, ground-bottom ≈ 120,111,104, bottom-right ≈ 127,112,117, gap-sky ≈ 167,175,191, gap-ground ≈ 127,118,112. No bright speckles anywhere (the mip-level trick). The spheres are unchanged: c00 ≈ 193,1,1, c33 ≈ 146,19,19, c66 ≈ 125,17,17, sky-refl ≈ 189,1,1, sun00 ≈ 193,2,2.

## brdf-lut
- **Task:** Render the BRDF integration map: a 128 × 128 two-channel floating-point texture (`m_brdfLUTTexture`, `DXGI_FORMAT_R16G16_FLOAT`) that stores, for every NdotV (u) and roughness (v), the scale and the bias applied to F0. Write `ImportanceSampleGGX`, the geometry functions (with the IBL `k`) and `IntegrateBRDF` in `brdf.hlsl`, draw the screen quad once into the texture in `LoadAssets`, and for now show the texture on a screen quad that covers the window.
- **Hint:** Two pipeline states after the pre-filter one: `brdf.hlsl`'s `VSMain` and `PSMain`, `psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16_FLOAT` → `m_brdfPipelineState`; right after it the same vertex shader with `debug_quad.hlsl`'s `PSMain`, `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM` and `DSVFormat = DXGI_FORMAT_D32_FLOAT` (the window's pass binds the depth buffer; `DepthEnable` is still `FALSE` from the capture passes) → `m_debugQuadPipelineState`. In `LoadAssets` after the pre-filter pass: `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` in the RENDER_TARGET state, an SRV (`D3D12_SRV_DIMENSION_TEXTURE2D`, `DXGI_FORMAT_R16G16_FLOAT`) in slot 5; `CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize); m_device->CreateRenderTargetView(m_brdfLUTTexture.Get(), nullptr, rtvHandle); m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);`, a 128 × 128 viewport and scissor rectangle, `SetPipelineState(m_brdfPipelineState.Get())`, `RenderQuad()`, the barrier to PIXEL_SHADER_RESOURCE. `brdf.hlsl`: `float k = (a * a) / 2.0f;` with `a = roughness` in `GeometrySchlickGGX`; `IntegrateBRDF`: `V = (sqrt(1.0f - NdotV * NdotV), 0.0f, NdotV)`, `N = (0, 0, 1)`, per sample `H`, `L = normalize(2.0f * dot(V, H) * H - V)`, and if `NdotL > 0.0f`: `G_Vis = (G * VdotH) / (NdotH * NdotV)`, `Fc = pow(1.0f - VdotH, 5.0f)`, `A += (1.0f - Fc) * G_Vis; B += Fc * G_Vis;`; both divided by the sample count; `PSMain` returns `IntegrateBRDF(input.texCoords.x, input.texCoords.y)`. To look at it, at the end of `PopulateCommandList`: `SetPipelineState(m_debugQuadPipelineState.Get())`, table 2 = slot 5, `RenderQuad()`.
- **When done:** `main.cpp`: members `m_brdfPipelineState`, `m_debugQuadPipelineState`, `m_brdfLUTTexture`; `D3DCompileFromFile(L"brdf.hlsl", …)` twice (`VSMain`, `PSMain`), `psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16_FLOAT`, `CreateGraphicsPipelineState(…, &m_brdfPipelineState)`; right after it `D3DCompileFromFile(L"debug_quad.hlsl", …, "PSMain", …)`, `psoDesc.PS = …`, `RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`, `CreateGraphicsPipelineState(…, &m_debugQuadPipelineState)`; the block `// pbr: generate a 2D LUT from the BRDF equations used.` (`Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, the SRV at slot 5, `CreateRenderTargetView(m_brdfLUTTexture.Get(), nullptr, rtvHandle)` at RTV slot `FrameCount`, `OMSetRenderTargets`, the 128 × 128 viewport, `m_brdfPipelineState`, `RenderQuad()`, the barrier); in `PopulateCommandList` after the background the `// render BRDF map to screen` block (`m_debugQuadPipelineState`, table 2 = `brdfLUTTexture` at heap slot 5, `RenderQuad()`). `brdf.hlsl`: `ImportanceSampleGGX`, `GeometrySchlickGGX` (`k = (a * a) / 2.0f`), `GeometrySmith`, `IntegrateBRDF` with `SAMPLE_COUNT = 128u`, `return integratedBRDF;` (`PSMain` returns a `float2`).
  **Picture: the red-green lookup texture fills the window** (the quad lies in front of everything; blue is 0 everywhere): red on the right and at the bottom (F0 counts fully when you look straight at a smooth surface), darker red towards the top (rough), and a green-yellow corner at the bottom left (at grazing angles on smooth surfaces the bias takes over – everything reflects). Points (x, y) → NdotV = (x + 0.5) / 800, roughness = 1 - (y + 0.5) / 600: (20,590) ≈ 31,222,0, (40,570) ≈ 56,188,0, (80,540) ≈ 97,136,0, (200,450) ≈ 164,45,0, (400,300) ≈ 186,5,0, (600,450) ≈ 248,0,0, (760,570) = 255,0,0, (780,590) = 255,0,0, (200,150) ≈ 154,5,0, (600,150) ≈ 150,0,0, (40,30) ≈ 150,5,0, (760,30) ≈ 94,0,0.

## specular
- **Task:** Add the specular part of the image based lighting to `pbr.hlsl` with the split sum approximation: sample the pre-filter map along the reflection vector at the mip level `roughness * 4.0`, look up scale and bias in the BRDF texture with (NdotV, roughness), and add `prefilteredColor * (F * brdf.x + brdf.y)` to the ambient term. Give the two textures a descriptor table of their own (registers t1 and t2), remove the lookup texture's quad again and show the environment as the background.
- **Hint:** Root signature: `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 1)` (2 SRVs from t1 on) and `rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`; the two SRVs are next to each other in the heap (slots 4 and 5), so in `PopulateCommandList` before the spheres `CD3DX12_GPU_DESCRIPTOR_HANDLE prefilterMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 4, m_cbvSrvDescriptorSize); m_commandList->SetGraphicsRootDescriptorTable(3, prefilterMap);`. `pbr.hlsl`: `TextureCube prefilterMap : register(t1); Texture2D brdfLUT : register(t2);`; `float3 R = reflect(-V, N);` and for the ambient term `float3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness); float3 kS = F; float3 kD = 1.0f - kS; kD *= 1.0f - metallic;`, the diffuse part as before, then `const float MAX_REFLECTION_LOD = 4.0f; float3 prefilteredColor = prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD).rgb; float2 brdf = brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg; float3 specular = prefilteredColor * (F * brdf.x + brdf.y); float3 ambient = (kD * diffuse + specular) * ao;`. Delete the debug quad (member, pipeline state, draw); the background's table 2 = slot 2 and `background.hlsl` reads level 0.0 again.
- **When done:** `main.cpp`: `CD3DX12_DESCRIPTOR_RANGE ranges[3]` with `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 1)`, `CD3DX12_ROOT_PARAMETER rootParameters[4]` with `rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`; in `PopulateCommandList` `SetGraphicsRootDescriptorTable(3, prefilterMap)` (heap slot 4) after the irradiance map's table 2 and before `RenderScene()`; no `m_debugQuadPipelineState` any more (neither the member, nor its `D3DCompileFromFile` / `CreateGraphicsPipelineState`, nor the `// render BRDF map to screen` block); the background's table 2 = `envCubemap` at heap slot 2. `background.hlsl`: `SampleLevel(clampSampler, input.worldPos, 0.0f)`. `pbr.hlsl`: `TextureCube prefilterMap : register(t1);`, `Texture2D brdfLUT : register(t2);`, `float3 R = reflect(-V, N);` and learnopengl's ambient block with `MAX_REFLECTION_LOD = 4.0f`, `prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD)`, `brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg` and `float3 ambient = (kD * diffuse + specular) * ao;`.
  **Picture: the spheres reflect the environment** (learnopengl's result): the background is the sharp environment again (sky = 169,178,195, hills = 64,89,64, ground = 107,100,90, glow = 106,99,89, bottom-right = 105,98,88, gap-sky = 170,179,195, gap-ground = 107,100,89), and on the smooth spheres (left columns) you see the sky in the upper half and the darker ground in the lower half with the horizon between them, a **large white spot up right of the centre: the sun** (it is behind the camera), small coloured spots of the lamps near the rims, and the four point lights' dots; towards the right the reflection blurs into a soft sheen. sky-refl ≈ 189,45,61 (start 188,1,1), ground-refl ≈ 186,22,19 (186,1,1), sun00 ≈ 228,216,212 (193,2,2), sun01 ≈ 223,207,203 (191,13,13), metal-sky ≈ 130,20,26 (84,1,1), metal-ground ≈ 91,9,8 (68,0,0) – the metal reflects in its own colour; c00 ≈ 194,59,66, c03 ≈ 189,66,71, c06 ≈ 189,58,61, c30 ≈ 152,22,20, c33 ≈ 157,37,39, c36 ≈ 157,39,41, c60 ≈ 101,10,9, c63 ≈ 122,17,17, c66 ≈ 139,21,22, h33 ≈ 220,115,113, h62 ≈ 240,83,84. Green and blue appear on the spheres for the first time: the specular reflection of non-metals is not tinted by the albedo.

## textured
- **Task:** Put the course's material on the spheres, as in the last task of the PBR Lighting chapter: load the five maps into heap slots 13–17, add a descriptor table for them (registers t3–t7) and a wrapping sampler (s1), read the material from them in `pbr.hlsl` (the normal through `getNormalFromMap(input)` with the vertex tangent), and draw the 3 × 3 grid of large spheres (spacing 6.0, turned 90° about the y axis, scale 2.4).
- **Hint:** The same edits as in `pbr-lighting`'s `textured` task, but t0–t2 are taken by the IBL textures: `ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 3)`, `rootParameters[4].InitAsDescriptorTable(1, &ranges[3], D3D12_SHADER_VISIBILITY_PIXEL)`, `samplers[1] = samplers[0];` with WRAP ×3 and `ShaderRegister = 1`; `cbvSrvHeapDesc.NumDescriptors = 18`; `LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 13)` … slot 17; `SetGraphicsRootDescriptorTable(4, materialTextures)` with the handle at slot 13. `ModelConstants` loses the material (32 values) – `CaptureConstants` has 33, so root parameter 0 becomes `InitAsConstants(sizeof(CaptureConstants) / 4, …)`: the root constants must hold the largest struct sent through them. `pbr.hlsl`: `Texture2D albedoMap : register(t3);` … `Texture2D aoMap : register(t7);`, `SamplerState wrapSampler : register(s1);`, the tangent through `VSMain` and `PSInput`, `getNormalFromMap(PSInput input)`, and at the top of `PSMain`: `float3 albedo = pow(albedoMap.Sample(wrapSampler, input.texCoords).rgb, 2.2f); float metallic = metallicMap.Sample(wrapSampler, input.texCoords).r; float roughness = roughnessMap.Sample(wrapSampler, input.texCoords).r; float ao = aoMap.Sample(wrapSampler, input.texCoords).r; float3 N = getNormalFromMap(input);`.
- **When done:** `main.cpp`: `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0f`; `struct ModelConstants { XMFLOAT4X4 model; XMFLOAT4X4 normalMatrix; };`; members `m_albedoTexture`, `m_normalTexture`, `m_metallicTexture`, `m_roughnessTexture`, `m_aoTexture`; `cbvSrvHeapDesc.NumDescriptors = 18`; `CD3DX12_DESCRIPTOR_RANGE ranges[4]` with `ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 3)`; `CD3DX12_ROOT_PARAMETER rootParameters[5]` with `rootParameters[0].InitAsConstants(sizeof(CaptureConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL)` and `rootParameters[4].InitAsDescriptorTable(1, &ranges[3], D3D12_SHADER_VISIBILITY_PIXEL)`; `D3D12_STATIC_SAMPLER_DESC samplers[2]` with `samplers[1] = samplers[0]`, WRAP ×3, `ShaderRegister = 1`; `LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 13);`, `("normal.png", …, 14)`, `("metallic.png", …, 15)`, `("roughness.png", …, 16)`, `("ao.png", …, 17)`; `SetGraphicsRootDescriptorTable(4, materialTextures)` (heap slot 13) before `RenderScene()`; `RenderScene` without material values and with `XMMatrixScaling(2.4f, 2.4f, 2.4f) * XMMatrixRotationY(XMConvertToRadians(90.0f)) * XMMatrixTranslation(…)`. `pbr.hlsl`: the five `Texture2D` (t3–t7), `SamplerState wrapSampler : register(s1)`, `cbuffer ModelConstants` with only the two matrices, `float3 tangent : TANGENT` in `VSMain`'s inputs and in `PSInput`, `result.tangent = mul(float4(tangent, 0.0f), model).xyz;`, `getNormalFromMap(PSInput input)` (T made perpendicular to N, `B = cross(N, T)`, `float3x3 TBN = float3x3(T, B, N)`, `mul(tangentNormal, TBN)`), the material read from the maps (albedo with `pow(…, 2.2f)`), `float3 N = getNormalFromMap(input);`.
  **Picture:** nine large spheres (centres at x = 202, 400, 598 and y = 102, 300, 498, about 158 pixels wide) of **riveted steel with rust in front of the sky**: the steel plates reflect the environment softly – bluish from the sky in the upper halves, darker below, a bright sheen where the sun and the point lights reflect –, the grooves and the four rivets around each sphere's middle catch light on the sides that face it, and the rust patches stay matt orange-brown, lit by the irradiance map (brighter than without IBL). On the centre sphere: **steel-l** (370,270) ≈ 230,231,234, **steel-r** (430,270) ≈ 234,235,236, **steel-low** (377,327) ≈ 199,200,203, **rust** (450,330) ≈ 149,90,58, **groove** (400,262) ≈ 114,117,127, **rivet** (369,281) ≈ 211,213,218; other spheres: **top-steel** (372,70) ≈ 206,206,211, **left-steel** (172,270) ≈ 203,206,212, **bottom-rust** (255,540) ≈ 148,87,54, **right-rust** (650,330) ≈ 147,105,79; at the window points c33 (400,300) ≈ 111,107,111 (the groove cross), c00 (153,547) ≈ 116,110,111, c66 (647,53) ≈ 161,165,176. The background is unchanged: (20,20) = 165,176,194, sky = 169,178,195, sky-top = 161,173,193, hills = 64,89,64, ground = 107,100,90, ground-bottom = 104,97,87, and between the spheres (300,200) = 183,189,198. For comparison, `pbr-lighting`'s last picture (the same spheres without IBL, on the grey clear colour) has rust ≈ 114,67,42, groove ≈ 95,96,98, left-steel ≈ 197,198,201. (The material's maps have no mipmaps in Direct3D: a few levels of difference where they are minified.) This is the solution.

## Notes
- All the IBL passes (environment capture, its mip levels, irradiance convolution, pre-filter levels, BRDF texture) are
  recorded **once, in `LoadAssets`**, and executed before the first frame.
- The pre-filter pass assumes the view direction equals the reflection direction equals the normal (learnopengl's
  simplification, from Epic's split sum approximation).
- Without the mip-level trick the 128 samples per texel would miss or over-count the small, very bright sun and the
  lamps: the rougher levels show bright dots. Sampling a blurrier level of the environment for samples with a low pdf
  removes them; that is why the environment cube map gets mip levels. Sampling level 0 only would save the
  `downsample` pass, its pipeline state and seven descriptors – and bring the dots back.
- **Subresources.** A texture's mip levels and array slices are separate subresources, each with its own state:
  `D3D12CalcSubresource(mip, slice, 0, mipLevels, arraySize)` = `mip + slice * mipLevels`. While the environment's
  levels are made, the finished levels are PIXEL_SHADER_RESOURCE and the others still RENDER_TARGET; a view that covers
  only finished levels (`MostDetailedMip`, `MipLevels = 1`) may be read. The pre-filter map is simpler: all its levels
  are only written, then one barrier for the whole resource.
- **Descriptor tables.** The three IBL textures could not share one table with the single texture of the capture
  passes without those passes' table covering descriptors of textures that are being drawn into; so t0 keeps its own
  table (root parameter 2), t1/t2 get one (3) and the material's t3–t7 one (4). The capture passes use only t0. In a
  frame all tables are set before the spheres are drawn.
- `uint` arithmetic with shifts and masks (`RadicalInverse_VdC`) is plain HLSL from shader model 4 on.
- The vertex tangent replaces learnopengl's `dFdx` / `dFdy` trick in `getNormalFromMap()`: see the notes in
  `../pbr-lighting/tasks.md`, also for the texture coordinates' v and the normal map's y.

## Simulator
Checked with a runner on the app's simulator (`Simulator.Build` + `Rasterizer.Render`, commit e1fc5e0), every state at
SIMW=240, compared with the OpenGL project's Mesa screenshots scaled to the same size. The simulator follows the whole
chapter: the hand-made mip chain (single-mip SRVs, per-mip render target views, per-subresource barriers), the
pre-filter levels, `SampleLevel` with fractional levels, the `R16G16_FLOAT` lookup texture written by a `float2 PSMain`,
the screen quad's strip in the same vertex buffer as the cube's list, the four descriptor tables of `specular` and
`textured`.
- `brdf-lut`: the lookup texture equals OpenGL's (all twelve points within 1 level, e.g. (20,590) 32,220,0, (400,300)
  187,5,0, (760,30) 94,0,0; mean difference 0.29 levels).
- `specular`: the background equals OpenGL's within 2 levels; the spheres within 3 levels except on the rough metal
  ones (c66 148,23,24 against 142,21,22, c63 130,18,18 against 127,17,18) – they read the pre-filter map's blurriest
  levels, see the next point.
- `prefilter-map` (the background shows the pre-filter map at level 1.2): the simulator is **brighter and warmer than
  Mesa** below the horizon – hills 180,174,174 against 167,163,163, ground-bottom 132,119,112 against 119,111,104,
  gap-ground 140,127,119 against 127,118,111, glow 224,207,172 against 215,196,160 (sky within 5). The simulator's
  rendering of the *OpenGL* project shows the same (hills 179,173,173, ground-bottom 125,115,108), so this is the
  simulator against Mesa in the pre-filter pass or in sampling level 1.2 (trilinear between levels 1 and 2 of a 64²
  cube map), not a difference of the two programs. Between the two programs in the simulator: within 3 levels, except
  ground-bottom / gap-ground / bottom-right 5–8 levels brighter in Direct3D – the environment's mip chain here is drawn
  with a linear 2 × 2 filter instead of `glGenerateMipmap`, and the irradiance convolution reads level 0.
- `textured`: the named points at a 240-pixel preview differ by up to about 40 levels on the rivets, grooves and steel edges in both
  chapters' textured states (the course's maps have no mipmaps in Direct3D, so the minified preview samples them
  sharper than OpenGL's mipmapped textures); at 800 px they agree within 2 levels (`pbr-lighting`).
- A pipeline state whose vertex shader is a blob compiled earlier than the last `vs_` compile before it is paired with
  that last compile (the simulator's rule "the shaders compiled last before the PSO"): the course's code is written so
  that this does not matter (the debug quad's pipeline state follows the BRDF one directly), but a reordering would show
  the wrong vertex shader (seen while writing: the debug quad was drawn with the background's vertex shader).
- Render time of the final state: about 36 s at SIMW=240 (the D3D12 setup passes; the OpenGL project's `prefilter-map`
  takes about 15 s, this one's 33 s).
