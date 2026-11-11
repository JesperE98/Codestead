# Physically Based Bloom – tasks (DirectX 12)

learnopengl "Guest Articles / Phys. Based Bloom": `src/8.guest/2022/6.physically_based_bloom/physically_based_bloom.cpp`
with `6.new_downsample.fs`, `6.new_upsample.fs`, `6.bloom_final.fs` (its `bloom_new()`), and the scene of the course's
Direct3D 12 `bloom` chapter. Files: `main.cpp`, `bloom.hlsl` (the scene's lighting), `light_box.hlsl` (the light cubes),
`bloom_final.hlsl` (tone mapping), `downsample.hlsl` and `upsample.hlsl` (learnopengl's `6.new_downsample` /
`6.new_upsample`; their `PSMain`s are TODOs in the start and return black), `wood.png`, `container2.png`.

**Screenshot time: 1.0 s** (nothing moves).

**The start** is the D3D12 `bloom` chapter's start without its blur TODOs: the scene rendered into one
`R16G16B16A16_FLOAT` colour buffer (`m_colorBuffer`, RTV heap slot `FrameCount`, CBV/SRV heap slot 3) with a depth
buffer, tone-mapped to the window by `bloom_final.hlsl` (exposure 1.0). No bright pass: the physically based bloom works
on the whole HDR image, without a threshold (see the OpenGL tasks.md).

**Fixed choices (the same in every API – see the OpenGL tasks.md):**
- Scene, camera (0, 0, 5), lights, textures (sRGB), exposure and tone mapping exactly as the `bloom` chapter.
- **The mip chain: separate textures** (learnopengl's way): six `DXGI_FORMAT_R11G11B10_FLOAT` textures (learnopengl's
  `GL_R11F_G11F_B10F`: three small floats, no alpha – Direct3D can render into it, filter it and blend it), each half
  the size of the one before, starting at half the window: 400×300, 200×150, 100×75, 50×37, 25×18, 12×9. Each has its
  own render target view (RTV heap slots `FrameCount + 1` … `+ 6`) and shader resource view (CBV/SRV heap slots 4 … 9)
  and rests in `PIXEL_SHADER_RESOURCE`; every pass that draws into one turns it into a `RENDER_TARGET` and back
  (barriers). The alternative – one texture with 6 mip levels and an RTV (`Texture2D.MipSlice = i`) plus an SRV
  (`MostDetailedMip = i, MipLevels = 1`) per level – works the same; separate textures keep learnopengl's
  `bloomMip.texture` and the course's earlier render-target code.
- **Structs** (learnopengl's `bloomMip` / `bloomFBO` classes): `struct BloomMip { XMFLOAT2 size; XMINT2 intSize;
  ComPtr<ID3D12Resource> texture; UINT rtvIndex; UINT srvIndex; };` and `struct BloomFBO { std::vector<BloomMip>
  mipChain; };` (Direct3D 12 has no framebuffer objects: each level is drawn through its own RTV, so the chain is all
  that is left of learnopengl's `mFBO`). The functions are `D3D12App` methods next to `RenderScene` (they record into
  `m_commandList` and use the heaps): `InitBloomFBO(BloomFBO&, unsigned int windowWidth, unsigned int windowHeight,
  unsigned int mipChainLength)`, `RenderDownsamples(BloomFBO&, UINT srcTexture, XMFLOAT2 srcViewportSize)`,
  `RenderUpsamples(BloomFBO&, float filterRadius)`; learnopengl's `RenderBloomTexture` is written out in
  `PopulateCommandList` (downsample, upsample, back to the window's viewport). No `DestroyBloomFBO`: the `ComPtr`s
  release the textures (after `OnDestroy` waited for the GPU).
- Per pass: `RSSetViewports` / `RSSetScissorRects` with the level's integer size, `OMSetRenderTargets` with the level's
  RTV (no depth buffer), the source texture's SRV as root parameter 2's table, the screen quad (`DrawInstanced(6, 1,
  36, 0)`). Root constants per pipeline: `DownsampleConstants { XMFLOAT2 srcResolution; int mipLevel; }`,
  `UpsampleConstants { float filterRadius; }`, `HdrConstants { float exposure; float bloomStrength; }`.
- **Downsample** (`downsample.hlsl`): learnopengl's 13-tap filter, `srcResolution` = the size of the texture being read
  (800×600 for the first pass, then each level's float `size`), first input = the colour buffer (heap slot 3). Sampler
  s1 (bilinear, clamp). The sample offsets go +y where GLSL goes +y; Direct3D's v points down, but the filter is
  symmetric, so the result is the same.
- **Upsample** (`upsample.hlsl`): the 3×3 tent filter with `filterRadius` = 0.005, from the smallest level up into the
  level above it with additive blending (`m_upsamplePipelineState`: `SrcBlend = DestBlend = D3D12_BLEND_ONE`,
  `BlendOp = ADD`).
- **Combine** (`bloom_final.hlsl`): `hdrColor = lerp(hdrColor, bloomColor, bloomStrength)` (GLSL's `mix`) with
  bloomStrength = 0.04, the bloom texture (level 0) on a fourth root parameter (a table with one SRV at t1).
- **Karis average** (last task): on the first downsample only (`mipLevel` 0, then 1), `if (mipLevel == 0) … else …`.

Named points (pixels from the top left): **white-light** (400,200), **green-light** (300,20), **box-top** (400,60),
**box-frame** (400,128), **box-right** (675,300), **floor-mid** (450,380), **floor-left** (200,450), **floor-right**
(700,500), **background** (600,100), **glow-right** (465,200), **glow-below** (400,262), **glow-green** (290,55),
**corner** (480,130), **rim** (338,200). The values are OpenGL's (Mesa); the simulator's for this project are within a
few levels of them (e.g. its start's rim = 32,32,70, box-right = 174,124,69).

**Start picture** (no bloom): white-light = 254,254,254, green-light = 0,254,0, box-top = 164,116,70, box-frame =
208,210,218, box-right = 171,122,67, floor-mid = 172,134,93, floor-left = 85,59,48, floor-right = 123,91,70,
background = glow-right = glow-below = glow-green = 0,0,0, corner = 3,3,3, rim = 43,38,72. Hard edges around the light
cubes.

## `mip-chain`
- **Task:** Create the bloom's mip chain: the `BloomMip` struct (float and integer size, the texture, its RTV and SRV slots) and the `BloomFBO` struct (a vector of mips), and `InitBloomFBO`, which creates six `R11G11B10_FLOAT` render-target textures, each half the size of the one before (starting at half the window), with an RTV and an SRV each. Make room for the views in the heaps and call it for the window size with 6 levels.
- **Hint:** In the loop: `mipSize.x *= 0.5f; … mipIntSize.x /= 2; …`, `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R11G11B10_FLOAT, mipIntSize.x, mipIntSize.y, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` in `PIXEL_SHADER_RESOURCE`, `mip.rtvIndex = FrameCount + 1 + i; mip.srvIndex = 4 + i;`, `CreateRenderTargetView` / `CreateShaderResourceView`, `bloomFBO.mipChain.push_back(mip);`. The RTV heap gets `FrameCount + 1 + 6` descriptors, the CBV/SRV heap `4 + 6`. `#include <vector>`.
- **When done:** `main.cpp`: `#include <vector>`, `struct BloomMip`, `struct BloomFBO`, `BloomFBO m_bloomFBO;`, `void
  InitBloomFBO(…)` (the `for` loop over `mipChainLength`, `DXGI_FORMAT_R11G11B10_FLOAT`, `ALLOW_RENDER_TARGET`, the two
  views, `push_back`), `rtvHeapDesc.NumDescriptors = FrameCount + 1 + 6`, `cbvSrvHeapDesc.NumDescriptors = 4 + 6`,
  `InitBloomFBO(m_bloomFBO, m_width, m_height, 6);` in `LoadAssets`. **No visible change**.

## `downsample`
- **Task:** Downsample the HDR scene through the mip chain every frame: write the 13-tap filter in `downsample.hlsl`, a pipeline state for it (one `R11G11B10_FLOAT` target, no depth buffer) and `RenderDownsamples` – for each level set the viewport and scissor rectangle to its size, make it the render target, draw the screen quad reading the previous level (the scene for the first), then read this level next. For now show the third level (100 × 75) in the window instead of the scene.
- **Hint:** In `downsample.hlsl` take the 13 samples a … m around `texCoord` (`x`, `y` = one source texel = `1.0f / srcResolution`) and add `e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125`. In `PopulateCommandList` after the scene: `RenderDownsamples(m_bloomFBO, 3, XMFLOAT2(static_cast<float>(m_width), static_cast<float>(m_height)));`, then `RSSetViewports(1, &m_viewport)` and `RSSetScissorRects(1, &m_scissorRect)` again. The final pass binds `m_bloomFBO.mipChain[2].srvIndex`.
- **When done:** `main.cpp`: `struct DownsampleConstants { XMFLOAT2 srcResolution; }`, `m_downsamplePipelineState`
  (`D3DCompileFromFile(L"downsample.hlsl", …)`, `RTVFormats[0] = DXGI_FORMAT_R11G11B10_FLOAT`, `DepthEnable = FALSE`,
  `DSVFormat = DXGI_FORMAT_UNKNOWN`), `void RenderDownsamples(…)` (the loop over `bloomFBO.mipChain` with the viewport,
  the barriers, `OMSetRenderTargets` with `mip.rtvIndex`, the root constants, `DrawInstanced(6, 1, 36, 0)`,
  `srcResolution = mip.size`, the table at `mip.srvIndex`); the `// 2.` block in `PopulateCommandList`; the final pass
  reads `m_bloomFBO.mipChain[2].srvIndex`. `downsample.hlsl`: learnopengl's 13 samples and weights. The window shows the
  **100 × 75 level, stretched: the scene blurred and blocky**: white-light = 254,254,254, green-light = 7,254,8, box-top
  = 169,120,72, box-frame = 240,239,239, box-right = 166,118,64, floor-mid = 175,137,97, floor-left = 85,58,47,
  floor-right = 122,91,69, background = 0,0,0, glow-right = 165,165,164, glow-below = 145,145,145, glow-green = 0,222,0,
  corner = 155,156,169, rim = 213,213,214.

## `upsample`
- **Task:** Upsample back up the chain: write the tent filter in `upsample.hlsl`, a pipeline state for it with additive blending (ONE, ONE), and `RenderUpsamples` – from the smallest level up, read level i and draw it into level i − 1 (its viewport and RTV). The filter radius is 0.005 in texture coordinates. For now show level 0 – the finished bloom texture – in the window.
- **Hint:** `for (int i = static_cast<int>(bloomFBO.mipChain.size()) - 1; i > 0; i--)` with `mip = mipChain[i]`, `nextMip = mipChain[i - 1]`. The pipeline state: `BlendState.RenderTarget[0]` with `SrcBlend = DestBlend = D3D12_BLEND_ONE`, `BlendOp = ADD`; reset `psoDesc.BlendState` afterwards for the final screen quad. `upsample.hlsl`: 9 samples `filterRadius` apart, `e*4 + (b+d+f+h)*2 + (a+c+g+i)`, divided by 16. A global `float bloomFilterRadius = 0.005f;`.
- **When done:** `main.cpp`: `float bloomFilterRadius = 0.005f;`, `struct UpsampleConstants { float filterRadius; }`,
  `m_upsamplePipelineState` (blending ONE / ONE / ADD), `void RenderUpsamples(…)` (the reverse loop, the barriers around
  `nextMip`, `OMSetRenderTargets` with `nextMip.rtvIndex`, the table at `mip.srvIndex`), `RenderUpsamples(m_bloomFBO,
  bloomFilterRadius);` after `RenderDownsamples`; the final pass reads `m_bloomFBO.mipChain[0].srvIndex`.
  `upsample.hlsl`: learnopengl's tent filter. The window shows the **bloom texture**: the whole scene very soft and
  bright, big white halos around the light cubes, even the black background lit: white-light = 255,255,255,
  green-light = 138,255,121, box-top = 250,234,196, box-frame = 255,255,255, box-right = 245,214,153, floor-mid =
  251,236,209, floor-left = 179,137,128, floor-right = 222,184,147, background = 38,36,36, glow-right = 254,254,254,
  glow-below = 254,254,254, glow-green = 139,255,127, corner = 251,251,252, rim = 255,255,255.

## `combine`
- **Task:** Mix the bloom texture into the scene in the final pass: the scene on root parameter 2 again, the bloom texture (level 0) on a new root parameter 3 (`Texture2D bloomBlur : register(t1)`), and in `bloom_final.hlsl` `lerp(hdrColor, bloomColor, bloomStrength)` with a bloom strength of 0.04 before the tone mapping.
- **Hint:** The root signature gets a third descriptor range (`ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1)`) and `rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`. `float bloomStrength = 0.04f;` and `float bloomStrength;` in `HdrConstants` (C++ and HLSL). A linear interpolation instead of an addition keeps the energy: 96 % scene, 4 % bloom.
- **When done:** `main.cpp`: `ranges[3]`, `rootParameters[4]` with the table for t1, `float bloomStrength = 0.04f;`,
  `HdrConstants::bloomStrength`, the final pass sets the colour buffer (slot 3) on root parameter 2 and
  `m_bloomFBO.mipChain[0].srvIndex` on root parameter 3 and `hdrConstants.bloomStrength = bloomStrength;`.
  `bloom_final.hlsl`: `Texture2D bloomBlur : register(t1);`, `float bloomStrength;`, `float3 bloomColor =
  bloomBlur.Sample(clampSampler, input.texCoord).rgb;`, `hdrColor = lerp(hdrColor, bloomColor, bloomStrength);`. The
  scene is back with a **soft glow everywhere bright light is**: white-light = 255,255,255, green-light = 34,255,29,
  box-top = 176,130,84, box-frame = 225,226,230, box-right = 179,130,74, floor-mid = 183,145,105, floor-left = 93,65,55,
  floor-right = 132,99,76, background = 9,8,8, glow-right = 119,119,117, glow-below = 117,116,114, glow-green =
  34,125,31, corner = 99,98,102, rim = 141,140,147.

## `karis-average`
- **Task:** Against "fireflies": in the first downsample only, weight each of the five 4-sample groups by the Karis average `1 / (1 + luma / 4)` of its sRGB colour. A `mipLevel` root constant says which pass it is: 0 for the first, 1 after it.
- **Hint:** In `RenderDownsamples`: `downsampleConstants.mipLevel = 0;` before the loop and `if (i == 0) { downsampleConstants.mipLevel = 1; }` at the end of the first iteration. `downsample.hlsl`: `int mipLevel;` in the cbuffer, learnopengl's `PowVec3`, `ToSRGB`, `sRGBToLuma` (0.299, 0.587, 0.114) and `KarisAverage`; for `mipLevel == 0` the groups `(a + b + d + e) * (0.125f / 4.0f)` … `(j + k + l + m) * (0.5f / 4.0f)`, each `*= KarisAverage(…)`, summed, `max(downsample, 0.0001f)`; otherwise the old weights.
- **When done:** `main.cpp`: `int mipLevel;` in `DownsampleConstants`, `downsampleConstants.mipLevel = 0;` before and
  `if (i == 0) { downsampleConstants.mipLevel = 1; }` in the loop of `RenderDownsamples`. `downsample.hlsl`: `int
  mipLevel;`, `PowVec3`, `ToSRGB`, `sRGBToLuma`, `KarisAverage`, `float3 groups[5];` and the `if (mipLevel == 0)` branch.
  The glow gets a little weaker: white-light = 255,255,255, green-light = 33,255,28, box-top = 175,128,82, box-frame =
  222,223,228, box-right = 178,129,73, floor-mid = 182,144,103, floor-left = 93,65,54, floor-right = 131,98,76,
  background = 8,8,8, glow-right = 108,108,105, glow-below = 105,105,103, glow-green = 33,117,29, corner = 92,91,96, rim
  = 129,128,137. This is the solution.

*Simulator:* it follows every state of this project (separate R11G11B10 render targets, per-level viewports, additive
blending, the fourth root parameter); its pixels are within a few levels of the values above (the final state renders in
about 57 s at 800 px).
