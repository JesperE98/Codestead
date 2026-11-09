# blending – DirectX 12

learnopengl.com "Blending": `blending_discard.cpp` (3.1) and then `blending_sorted.cpp` (3.2). Files: `main.cpp`,
`blending.hlsl`, `marble.png`, `metal.png`, `grass.png` (RGBA, alpha 0 or 255), `window.png` (RGBA, red glass alpha ≈
0.55 in an opaque frame).

Start: the Depth testing scene (marble cubes at (-1, 0, -1) and (2, 0, 0), metal floor, LESS, camera at (0, 0, 3), draw
order cube 0, cube 1, floor), with the shaders in `blending.hlsl` (`VSMain`, `PSMain` sampling `texture1` with
`wrapSampler`). One vertex buffer (cube 0–35, floor 36–41), one SRV per texture in the CBV/SRV heap (CBV 0, marble 1,
metal 2), `SetGraphicsRootDescriptorTable(2, …)` before each draw. TODO comments: the transparent quad's vertices at the
end of `vertices[]`, loading grass.png into slot 3, its GPU handle, and the vegetation draws after the floor.

D3D12 notes:
- The quad's texture coordinates are learnopengl's `transparentVertices` unchanged: (0, 0) at the top – learnopengl
  loads these images without a flip and swapped v for that; Direct3D's v = 0 is the image's top row too.
- A sampler's address mode is not part of a texture in D3D12 but of the root signature (static samplers). The floor
  needs WRAP (coordinates up to 2), the transparent textures CLAMP (learnopengl: `GL_CLAMP_TO_EDGE` for RGBA images, so
  filtering at the quad's top edge does not mix in the image's bottom row). So the `discard` task adds a second static
  sampler (s1, CLAMP) and a second pixel shader `PSTransparent` in `blending.hlsl` that samples with it, used by a
  second PSO `m_transparentPipelineState` for the quads.
- Blending is part of the PSO (`BlendState.RenderTarget[0]`), so it is turned on only in the transparent objects' PSO
  (learnopengl's `glEnable(GL_BLEND)` is global; the opaque objects have alpha 1 and look the same either way).
- The positions are local arrays in `PopulateCommandList` (`XMFLOAT3 vegetation[]` / `XMFLOAT3 windows[]`, like the
  earlier chapters' `cubePositions`), looped with `_countof(…)`; the sorting uses learnopengl's `std::map<float, …>`
  and `reverse_iterator` loop with `XMFLOAT3`, the distance computed with DirectXMath:
  `XMVectorGetX(XMVector3Length(cameraPos - XMLoadFloat3(&windows[i])))`. learnopengl sorts at the top of the render
  loop; here the sort is in `PopulateCommandList` right before the windows are drawn (opaque objects first, as
  learnopengl).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). D3D12 cannot run here:
the colours are the OpenGL project's Mesa screenshots of the same steps (same scene, camera, textures and draw order),
checked against the app's simulator where it can render the step (see the lead's notes: per-draw textures, `_countof`
and the sort are not simulated yet); the simulator agrees within 1–2 units on the quads (e.g. window over background
132,33,33 vs 133,34,34). Named points: **grass-gap** (115,240) = a transparent texel of the grass quad in front of cube
0 (the window's glass later), **blade** (111,322) = a grass blade in front of cube 0 (later the window's glass),
**c0** (190,300) = cube 0 (later behind the window's frame cross), **pane** (480,200) = the nearest quad (at z = 0.7)
over the background, **sort-a** (620,221) and **sort-b** (520,330) = where the nearest window lies in front of the
window at (0.5, 0, -0.6), **c1** (760,300) = cube 1, **floor-near** (400,520) = 84,88,94 and **background** (300,100) =
26,26,26 in every step.

Start picture: grass-gap 214,210,199 and blade 217,213,202 (marble of cube 0), c0 150,149,146, pane/sort-a/sort-b
26,26,26 (background), c1 ≈ 149,147,145.

## grass
- **Task:** Add learnopengl's transparent quad (vertices 42–47 of the vertex buffer), load `grass.png` into heap slot 3 (`m_transparentTexture`, 4 descriptors in the heap), and draw the quad at the five vegetation positions with the grass texture.
- **Hint:** The quad: `{ { 0.0f, 0.5f, 0.0f }, { 0.0f, 0.0f } }`, `{ { 0.0f, -0.5f, 0.0f }, { 0.0f, 1.0f } }`, `{ { 1.0f, -0.5f, 0.0f }, { 1.0f, 1.0f } }`, then `(0, 0.5)`, `(1, -0.5)`, `(1, 0.5)` with (0, 0), (1, 1), (1, 0). In `PopulateCommandList`: `CD3DX12_GPU_DESCRIPTOR_HANDLE transparentTexture(heapStart, 3, m_cbvSrvDescriptorSize)`, positions (-1.5, 0, -0.48), (1.5, 0, 0.51), (0, 0, 0.7), (-0.3, 0, -2.3), (0.5, 0, -0.6), and for each `XMMatrixTranslation`, the root constants and `DrawInstanced(6, 1, 42, 0)`.
- **When done:** `main.cpp`: 48 vertices (the quad after the floor), `cbvSrvHeapDesc.NumDescriptors = 4`, member
  `m_transparentTexture`, `LoadTexture("grass.png", m_transparentTexture, transparentTextureUploadHeap, 3)`, the
  handle `transparentTexture` (slot 3), `XMFLOAT3 vegetation[]` with the 5 positions, `SetGraphicsRootDescriptorTable(2,
  transparentTexture)` and a loop of 5 `DrawInstanced(6, 1, 42, 0)` after the floor (8 draws). Five grass quads stand
  between and in front of the cubes, but their transparent parts are **black blocks** (alpha is ignored): grass-gap
  0,0,0, c0 0,0,0, pane 0,0,0, sort-a 0,0,0; blades green: blade 46,133,30, sort-b 56,152,30.

## discard
- **Task:** Give the quads their own pixel shader `PSTransparent` that samples with a new CLAMP sampler (s1) and discards pixels with alpha < 0.1, and their own PSO `m_transparentPipelineState`, set before the vegetation's draws.
- **Hint:** HLSL: `SamplerState clampSampler : register(s1);` and `float4 texColor = texture1.Sample(clampSampler, input.texCoord); if (texColor.a < 0.1f) discard; return texColor;`. Root signature: `samplers[2]`, `samplers[1] = samplers[0];` with `AddressU/V/W = D3D12_TEXTURE_ADDRESS_MODE_CLAMP` and `ShaderRegister = 1`. PSO: compile `"PSTransparent"` (`ps_5_0`) from blending.hlsl after `m_pipelineState` is created, set `psoDesc.PS`, create `m_transparentPipelineState`; `m_commandList->SetPipelineState(m_transparentPipelineState.Get());` before the vegetation.
- **When done:** `blending.hlsl`: `clampSampler : register(s1)`, `PSTransparent` with `discard` for `texColor.a <
  0.1f`. `main.cpp`: `D3D12_STATIC_SAMPLER_DESC samplers[2]`, `samplers[1]` CLAMP with `ShaderRegister = 1`, member
  `m_transparentPipelineState`, `D3DCompileFromFile(L"blending.hlsl", …, "PSTransparent", "ps_5_0", …)`,
  `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_transparentPipelineState))`, `SetPipelineState(
  m_transparentPipelineState.Get())` before the vegetation loop. Only the **grass blades** remain: grass-gap
  214,210,199 (cube 0 seen through), c0 150,149,146, pane 26,26,26, sort-a 26,26,26; blade 46,133,30, sort-b
  56,152,30.

## blend
- **Task:** Turn on alpha blending in the transparent PSO (source alpha / one minus source alpha), load `window.png` instead of `grass.png`, and call the positions `windows`.
- **Hint:** Before `m_transparentPipelineState` is created: `psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`, `DestBlend = D3D12_BLEND_INV_SRC_ALPHA`, `BlendOp = D3D12_BLEND_OP_ADD` (and the same for `SrcBlendAlpha`, `DestBlendAlpha`, `BlendOpAlpha` – glBlendFunc sets both). OpenGL: `glEnable(GL_BLEND); glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);`.
- **When done:** `main.cpp`: `BlendEnable = TRUE`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`, `DestBlend =
  D3D12_BLEND_INV_SRC_ALPHA`, `BlendOp = D3D12_BLEND_OP_ADD`, `SrcBlendAlpha = D3D12_BLEND_SRC_ALPHA`, `DestBlendAlpha
  = D3D12_BLEND_INV_SRC_ALPHA`, `BlendOpAlpha = D3D12_BLEND_OP_ADD` on `psoDesc.BlendState.RenderTarget[0]` before the
  transparent PSO; `LoadTexture("window.png", …, 3)`; `XMFLOAT3 windows[]` and the loop over `_countof(windows)`.
  Five **red tinted windows** in opaque dark-red frames: the scene shows through the glass – grass-gap 218,117,112 and
  blade 219,118,113 (marble through red glass), pane 133,34,34 (background through glass), c0 110,20,20 (the frame's
  cross). Unsorted: the nearest window (z = 0.7) is drawn before the one at (0.5, 0, -0.6) behind it, which then fails
  the depth test where they overlap – sort-a and sort-b show only one glass: 133,34,34.

## sort
- **Task:** Sort the windows by distance to the camera with learnopengl's `std::map<float, XMFLOAT3> sorted` and draw them from the farthest to the nearest with its `reverse_iterator`.
- **Hint:** `#include <map>`; `for (UINT i = 0; i < _countof(windows); i++) { float distance = XMVectorGetX(XMVector3Length(cameraPos - XMLoadFloat3(&windows[i]))); sorted[distance] = windows[i]; }` and `for (std::map<float, XMFLOAT3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)` with `XMMatrixTranslation(it->second.x, it->second.y, it->second.z)`.
- **When done:** `main.cpp`: `#include <map>`, the `std::map<float, XMFLOAT3> sorted` filled in a for loop with
  `XMVector3Length(cameraPos - XMLoadFloat3(&windows[i]))`, the windows drawn in the `reverse_iterator` loop with
  `it->second`. Drawn far to near, the window behind the nearest one is now visible through it: sort-a and sort-b
  181,37,37 (two layers of glass). Everything else unchanged (pane 133,34,34, grass-gap 218,117,112, c0 110,20,20).
