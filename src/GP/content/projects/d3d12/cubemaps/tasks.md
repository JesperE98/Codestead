# cubemaps – DirectX 12

learnopengl.com "Cubemaps": `6.1.cubemaps_skybox` (loading a cube map, the skybox, drawing it last) and
`6.2.cubemaps_environment_mapping` (reflection, refraction). In Direct3D 12 a cube map is a 2D texture with six array
slices (`DepthOrArraySize = 6`, the faces +X, -X, +Y, -Y, +Z, -Z = subresources 0–5) seen through a shader resource view
with `D3D12_SRV_DIMENSION_TEXTURECUBE`; HLSL reads it as a `TextureCube` sampled with a direction (`float3`).
Files: `main.cpp`, `cubemaps.hlsl` (the cubes), `skybox.hlsl` (only a TODO comment at the start), `marble.png`,
`skybox/right.png`, `left.png`, `top.png`, `bottom.png`, `front.png`, `back.png` (the course's sky: +X, -X, +Y, -Y, +Z,
-Z, 256×256; mountains on the horizon, a green checkered ground, a red/white tower towards +Z).

Start: the depth-testing scene without the floor (learnopengl draws only the two marble cubes here): cubes at (-1, 0, -1)
and (2, 0, 0), clear (0.1, 0.1, 0.1), camera (0, 0, 3) looking down -z, fov 45, 800/600, 0.1, 100. One vertex buffer:
the cube = vertices 0–35 (position + texture coordinates). CBV/SRV heap: CBV (slot 0), marble (slot 1). TODO comments
mark `LoadCubemap` (declaration and function), the cube map's loading in `LoadAssets`, the skybox's vertices, its PSO and
its draw.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). Named points:
**c0** (190,300) cube 0's front face, **c0-top** (190,250), **c0-low** (190,360), **c1** (760,300) cube 1, **centre**
(400,300) (background – the horizon once the sky is there), **sky** (400,100), **ground** (400,500), **mountain**
(600,285). D3D12 cannot run here and the app's simulator does not read Direct3D cube maps yet, so the colours after
`skybox` are the OpenGL project's Mesa screenshots of the same steps with the same images and the same maths (same
directions, same cube map face rules – Direct3D and OpenGL address cube faces the same way, both with unflipped images);
the start colours are the simulator's (OpenGL in brackets where its mipmaps differ).

Start picture: two marble cubes on dark grey: c0 ≈ 151,150,147, c1 ≈ 139,138,136 (OpenGL 149,147,145), everything
else 26,26,26.

## load-cubemap
- **Task:** Write `LoadCubemap(faces, texture, uploadHeap, descriptorIndex)` and load the six sky images into
  `m_skyboxTexture` (SRV in heap slot 2), in the order right, left, top, bottom, front, back. Add a second static sampler
  `s1` that clamps to the edge.
- **Hint:** Like `LoadTexture`, but six `stbi_load` calls (4 channels, no flip), `textureDesc.DepthOrArraySize = 6`,
  `GetRequiredIntermediateSize(texture.Get(), 0, 6)`, an array of six `D3D12_SUBRESOURCE_DATA` (subresource i = face i,
  OpenGL's `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`) for one `UpdateSubresources(…, 0, 0, 6, faceData)`, and the SRV with
  `ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE`, `TextureCube.MipLevels = 1`. The heap needs 3 descriptors.
  Copy the sampler: `samplers[1] = samplers[0];` then CLAMP in U, V, W and `ShaderRegister = 1` (learnopengl's
  GL_CLAMP_TO_EDGE: no filtering across the seams).
- **When done:** `main.cpp`: `#include <vector>`, member `m_skyboxTexture`, `cbvSrvHeapDesc.NumDescriptors = 3;`,
  `D3D12_STATIC_SAMPLER_DESC samplers[2]` with `samplers[1]` CLAMP at register 1, `std::vector<std::string> faces {
  "skybox/right.png", "skybox/left.png", "skybox/top.png", "skybox/bottom.png", "skybox/front.png", "skybox/back.png" };`,
  `LoadCubemap(faces, m_skyboxTexture, skyboxTextureUploadHeap, 2);`, the declaration in the class and the function
  (`DepthOrArraySize = 6`, `UpdateSubresources(m_commandList.Get(), texture.Get(), uploadHeap.Get(), 0, 0, 6, faceData)`,
  `D3D12_SRV_DIMENSION_TEXTURECUBE`). **No visible change** (nothing samples the cube map yet).

## skybox
- **Task:** Draw the sky: the skybox's 36 vertices (vertices 36–71), its shaders in `skybox.hlsl`, a pipeline state
  `m_skyboxPipelineState` without depth writes, and draw it first in `PopulateCommandList`.
- **Hint:** The vertices are learnopengl's `skyboxVertices` (a cube from -1 to 1) in the same vertex buffer: `{ { -1.0f,
  1.0f, -1.0f }, {} }` – `{}` leaves the unused second attribute at zero. The vertex shader passes the position on as the
  direction (`texCoords = position`) and removes the view matrix's translation with `(float3x3)view` (learnopengl:
  `mat4(mat3(view))`). PSO: the scene's description with skybox.hlsl's shaders and
  `DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` (learnopengl's `glDepthMask(GL_FALSE)`). Draw: set
  `m_skyboxPipelineState`, the cube map's table (`CD3DX12_GPU_DESCRIPTOR_HANDLE skyboxTexture(heapStart, 2, …)`),
  `DrawInstanced(36, 1, 36, 0)`, then set `m_pipelineState` again for the cubes.
- **When done:** `main.cpp`: member `m_skyboxPipelineState`; `LoadAssets` compiles `skybox.hlsl` (`VSMain`, `PSMain`),
  `psoDesc.DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO;`, creates `m_skyboxPipelineState`; 36 skybox
  vertices after the cube; `PopulateCommandList` before the cubes: `SetPipelineState(m_skyboxPipelineState.Get())`,
  `SetGraphicsRootDescriptorTable(2, skyboxTexture)`, `DrawInstanced(36, 1, 36, 0)`,
  `SetPipelineState(m_pipelineState.Get())`. `skybox.hlsl`: `TextureCube skybox : register(t0);`,
  `SamplerState clampSampler : register(s1);`, `cbuffer SceneConstantBuffer` (view, projection), `VSMain(float3 position
  : POSITION)` with `result.texCoords = position;` and `mul(position, (float3x3)view)`, `PSMain` returns
  `skybox.Sample(clampSampler, input.texCoords)`. The sky appears behind the cubes (no dark grey left): sky ≈ 127,164,219
  (blue), centre ≈ 134,156,178 (hazy horizon), mountain ≈ 100,112,136 (grey-blue mountains), ground ≈ 85,132,56 (green
  checkered ground); the cubes are unchanged (c0 marble ≈ 151,150,147).

## skybox-last
- **Task:** learnopengl's optimisation: draw the skybox last, with depth 1.0 (`pos.xyww`) and the depth function
  `D3D12_COMPARISON_FUNC_LESS_EQUAL` in its PSO.
- **Hint:** In the vertex shader `result.position = pos.xyww;` – after the divide by w the depth is w / w = 1.0, the value
  the depth buffer is cleared to, so the sky passes only where nothing else was drawn, and LESS would fail there. In the
  PSO the `DepthWriteMask` line becomes `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL;`
  (learnopengl: `glDepthFunc(GL_LEQUAL)`). Move the draw after the cubes (no `SetPipelineState(m_pipelineState…)` is needed
  any more).
- **When done:** `main.cpp`: `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL;` (no
  `DEPTH_WRITE_MASK_ZERO`); the skybox's three calls (`SetPipelineState(m_skyboxPipelineState.Get())`,
  `SetGraphicsRootDescriptorTable(2, skyboxTexture)`, `DrawInstanced(36, 1, 36, 0)`) come after the second cube's draw.
  `skybox.hlsl`: `float4 pos = mul(float4(viewPosition, 1.0f), projection); result.position = pos.xyww;`. **No visible
  change** (same colours as after `skybox`).

## reflection
- **Task:** Make the cubes mirrors: give the cube's vertices normals (learnopengl's position + normal cube), pass the
  camera position in the constant buffer and the normal matrix in the root constants, and in `cubemaps.hlsl` sample the
  cube map in the reflected direction `reflect(I, normalize(normal))`.
- **Hint:** `Vertex` gets `XMFLOAT3 normal` instead of `texCoord`, the input layout `"NORMAL"` (R32G32B32_FLOAT, offset
  12) – the skybox's `{}` fits either. `SceneConstantBuffer` gets `XMFLOAT3 cameraPos; float padding;` (written in
  `OnUpdate` with `XMStoreFloat3`) and the pixel shader reads it, so root parameter 1 becomes
  `D3D12_SHADER_VISIBILITY_ALL`. `ModelConstants` gets `normalMatrix` = transpose(inverse(model)) (as in the lighting
  chapters). The marble texture goes; the cube map moves to heap slot 1 (2 descriptors). `I = normalize(fragPos -
  cameraPos)`.
- **When done:** `main.cpp`: `XMFLOAT3 normal;` in `Vertex`; `XMFLOAT4X4 normalMatrix;` in `ModelConstants`;
  `XMFLOAT3 cameraPos; float padding;` in `SceneConstantBuffer`; no `m_cubeTexture` / marble `LoadTexture`;
  `cbvSrvHeapDesc.NumDescriptors = 2;`; `rootParameters[1]…D3D12_SHADER_VISIBILITY_ALL`; input element `"NORMAL"`;
  the 36 cube vertices with learnopengl's normals (e.g. `{ { -0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } }`);
  `LoadCubemap(…, 1)`; `XMStoreFloat3(&constantBufferData.cameraPos, cameraPos);`; the cubes are drawn with
  `SetGraphicsRootDescriptorTable(2, skyboxTexture)` (slot 1) and `normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr,
  model))` stored transposed. `cubemaps.hlsl`: `TextureCube skybox : register(t0)`, `clampSampler : register(s1)`,
  `float3 cameraPos` in the cbuffer, `VSMain(float4 position : POSITION, float3 normal : NORMAL)` outputs `fragPos` (world)
  and `normal` (`mul(float4(normal, 0.0f), normalMatrix).xyz`); `PSMain`: `float3 I = normalize(input.fragPos -
  cameraPos); float3 R = reflect(I, normalize(input.normal)); return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);`.
  The cubes become mirrors of the sky: their front faces show the sky and horizon seen in the mirror – c0 ≈ 135,157,178
  (horizon haze), c0-top ≈ 157,191,230 (sky), c0-low ≈ 124,161,138 (the ground's reflection), c1's left face ≈
  171,199,223; cube 0 is hard to tell apart from the background except at its edges; the sky elsewhere unchanged
  (sky 127,164,219, ground 85,132,56, mountain 100,112,136).

## refraction
- **Task:** Make the cubes glass: `refract(I, normalize(normal), ratio)` with `ratio = 1.00 / 1.52` instead of `reflect`.
- **Hint:** learnopengl's ratio: from air (refractive index 1.00) into glass (1.52). With one refraction (not two, as a
  real glass cube would have) the cubes look like magnifying glass.
- **When done:** `cubemaps.hlsl` `PSMain`: `float ratio = 1.00f / 1.52f;` and `float3 R = refract(I, normalize(input.normal),
  ratio);` (no `reflect`). The cubes show the sky behind them, slightly magnified and shifted: c0 ≈ 133,154,175, c0-top ≈
  105,117,141 (the mountains, enlarged), c0-low ≈ 144,176,166, c1 ≈ 133,154,176; the rest of the sky unchanged. This is
  the solution.
