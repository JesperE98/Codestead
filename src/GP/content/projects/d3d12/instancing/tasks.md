# instancing – DirectX 12

learnopengl.com "Instancing": `10.1.instancing_quads`, `10.2.asteroids`, `10.3.asteroids_instanced`. In Direct3D 12 an
instanced draw is `DrawInstanced(vertexCount, instanceCount, …)` / `DrawIndexedInstanced(indexCount, instanceCount,
…)`; the vertex shader gets the instance's number as `SV_InstanceID` (GLSL `gl_InstanceID`), and an input element with
`D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` and `InstanceDataStepRate` 1 reads a new value per instance from its
input slot (OpenGL's `glVertexAttribDivisor(…, 1)`) (Microsoft Learn: "D3D12_INPUT_ELEMENT_DESC", "Efficiently drawing
multiple instances of geometry").
Files: `main.cpp` (with the Model chapter's `Vertex`, `Texture`, `Mesh`, `Model`, `TextureFromFile`; the mesh's
`vertexBufferView`, `indexBufferView` and `srvHandle` are **public** here, as learnopengl makes the mesh's VAO public for
its asteroid demo), `instancing.hlsl` (the quads), `planet.hlsl` and `asteroids.hlsl` (10.3), and the read-only models
in `models/`: `planet.obj`, `planet.mtl`, `planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`
(Model chapter) and the course's rock `rock.obj`, `rock.mtl`, `rock.png`.

Start: learnopengl 10.1 before instancing – no camera, no matrices: clear (0.1, 0.1, 0.1), depth buffer and test on,
one small quad (learnopengl's `quadVertices`: `struct QuadVertex { XMFLOAT2 position; XMFLOAT3 color; }`, ±0.05, 6
vertices) drawn once with `DrawInstanced(6, 1, 0, 0)` in the centre (`CullMode = D3D12_CULL_MODE_NONE`: the quad's
second triangle is counter-clockwise; learnopengl draws without culling). Prepared for the planet and the rocks
(unused by the quads): the Model chapter's root signature (0 = root constants `ModelConstants` b0, 1 = table with the
CBV b1, 2 = table with a mesh's SRVs t0/t1, static sampler s0), the CBV/SRV heap (1 CBV + 2 × `MaxMeshes` SRVs), the
constant buffer `SceneConstantBuffer { view; projection; }` with its CBV and persistent mapping,
`SetDescriptorHeaps` + `SetGraphicsRootDescriptorTable(1, …)` in `PopulateCommandList` and an empty `OnUpdate`.
TODOs: `main.cpp` (the offsets) and `asteroids.hlsl` (the instance matrix). `planet.hlsl` is complete. Every state
between tasks compiles.

Pixels: 800×600 client area from the top left; nothing depends on time. Background = 26,26,26. D3D12 cannot run here:
values from the app's simulator where it follows the code (start, `instanced-array`, `scale-quads`, `planet`), else
the OpenGL project's Mesa values for the same picture (see the notes).

**Start picture:** one 40×30 px quad in the centre (x 380..419, y 285..314), coloured from its corners: (382,287) =
234,16,5 (red), bottom-left blue, top-right cyan, bottom-right green; centre (400,300) = 123,131,1. Everything else
background, e.g. (40,30), (760,570), (200,150).

The quads' grid (from `offsets` on): quad centres at x = 40, 120, …, 760 and y = 30, 90, …, 570 (NDC −0.9 … 0.9 in
steps of 0.2), each 40×30 px; instance 0 is bottom-left, instance 9 bottom-right, instance 90 top-left, instance 99
top-right (learnopengl's loop runs y from −10 (bottom) up).

## `offsets`
- **Task:** Draw 100 quads with one draw call: compute learnopengl's 100 translations (a 10×10 grid, `offset = 0.1f`) in `LoadAssets`, put them in a constant buffer the vertex shader reads as `float4 offsets[100]`, pick the instance's offset with `SV_InstanceID`, and draw with `DrawInstanced(6, 100, 0, 0)`.
- **Hint:** `XMFLOAT2 translations[100];` filled in the nested loops `for (int y = -10; y < 10; y += 2)` / `for (int x = -10; x < 10; x += 2)` (`translation.x = static_cast<float>(x) / 10.0f + offset;`). HLSL gives every element of an array in a cbuffer its own 16-byte register, so the C++ struct is `struct OffsetConstantBuffer { XMFLOAT4 offsets[100]; };` (x and y used). The buffer is written once: an upload buffer of `CalculateConstantBufferByteSize(sizeof(OffsetConstantBuffer))` bytes, `Map`, `memcpy`, `Unmap`. Bind it as a **root constant buffer view** – root parameter 3, `rootParameters[3].InitAsConstantBufferView(2, 0, D3D12_SHADER_VISIBILITY_VERTEX)` (register b2), set with `SetGraphicsRootConstantBufferView(3, m_offsetBuffer->GetGPUVirtualAddress())`: a root descriptor needs no descriptor heap. In the shader: `uint instanceID : SV_InstanceID` and `float2 offset = offsets[instanceID].xy;`.
- **When done:** `instancing.hlsl`: `cbuffer OffsetConstantBuffer : register(b2) { float4 offsets[100]; };`, `VSMain(float2
  position : POSITION, float3 color : COLOR, uint instanceID : SV_InstanceID)`, `float2 offset = offsets[instanceID].xy;`,
  `float4(position + offset, 0.0f, 1.0f)`. `main.cpp`: `struct OffsetConstantBuffer { XMFLOAT4 offsets[100]; };`, member
  `ComPtr<ID3D12Resource> m_offsetBuffer;`, `CD3DX12_ROOT_PARAMETER rootParameters[4];` with
  `rootParameters[3].InitAsConstantBufferView(2, 0, D3D12_SHADER_VISIBILITY_VERTEX);`, in `LoadAssets` the
  `translations` loop (`XMFLOAT2 translations[100]; int index = 0; float offset = 0.1f;` …) and a block filling
  `OffsetConstantBuffer offsetData` (`offsetData.offsets[i] = XMFLOAT4(translations[i].x, translations[i].y, 0.0f,
  0.0f)`), creating `m_offsetBuffer` in an upload heap and `memcpy`-ing `offsetData` into it; in `PopulateCommandList`
  `m_commandList->SetGraphicsRootConstantBufferView(3, m_offsetBuffer->GetGPUVirtualAddress());` and
  `DrawInstanced(6, 100, 0, 0)`. **A 10×10 grid of the quad** (bounding box x 20..779, y 15..584): every grid point
  (40,30), (760,30), (40,570), (760,570), (120,90), (200,150), (440,330) = 123,131,1 (each quad's centre); the window
  centre (400,300) and (400,330) are between quads = 26,26,26. (The same picture as `instanced-array`, which the
  simulator shows; see note 1.)

## `instanced-array`
- **Task:** Replace the constant buffer with an instanced array: put the 100 translations in their own vertex buffer (`m_instanceBuffer`), bound to input slot 1, and read them as the input `OFFSET`, which advances once per instance (`D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA`, step rate 1). Remove the offsets' constant buffer and root parameter 3.
- **Hint:** Input element `{ "OFFSET", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 }` – slot 1, offset 0 in that slot's buffer. The buffer: an upload buffer of `sizeof(translations)` bytes, `memcpy` of `translations`, a view with `StrideInBytes = sizeof(XMFLOAT2)`. Draw: `IASetVertexBuffers(0, 1, &m_vertexBufferView)` and `IASetVertexBuffers(1, 1, &m_instanceBufferView)`. In the shader `float2 offset : OFFSET` replaces the cbuffer (and `SV_InstanceID`).
- **When done:** `instancing.hlsl`: no cbuffer; `VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset :
  OFFSET)`, `float4(position + offset, 0.0f, 1.0f)`. `main.cpp`: no `OffsetConstantBuffer`, `m_offsetBuffer`, root
  parameter 3 (`rootParameters[3]` again); members `ComPtr<ID3D12Resource> m_instanceBuffer;` and
  `D3D12_VERTEX_BUFFER_VIEW m_instanceBufferView`; the third input element `"OFFSET"` (slot 1, `PER_INSTANCE_DATA`, 1);
  `// store instance data in a vertex buffer` block (`instanceBufferSize = sizeof(translations)`, `memcpy(…,
  translations, sizeof(translations))`, `StrideInBytes = sizeof(XMFLOAT2)`); `PopulateCommandList`:
  `IASetVertexBuffers(1, 1, &m_instanceBufferView);`, no `SetGraphicsRootConstantBufferView`. **No visible change**
  (the same grid; simulator = Mesa pixel for pixel: (40,30), (760,30), (40,570), (760,570), (120,90), (200,150),
  (440,330) = 123,131,1; (400,300), (400,330) = 26,26,26).

## `scale-quads`
- **Task:** learnopengl's variation: scale each quad by its instance number, `position * (instanceID / 100.0f)`, so the quads grow from the first instance (bottom-left, invisible) to the last (top-right, full size).
- **Hint:** Add `uint instanceID : SV_InstanceID` to `VSMain` again; `float2 pos = position * (instanceID / 100.0f);` then `float4(pos + offset, 0.0f, 1.0f)`. Write `100.0f`: `instanceID / 100` would be an integer division, 0 for every instance.
- **When done:** `instancing.hlsl`: `VSMain(…, float2 offset : OFFSET, uint instanceID : SV_InstanceID)`, `float2 pos =
  position * (instanceID / 100.0f);`, `float4(pos + offset, 0.0f, 1.0f)`. The quads shrink from top to bottom (and a
  little from right to left): (760,30) = 123,131,1 (top-right, full size), (40,30) = 123,131,1 (36 px wide), (760,570) =
  80,163,12 (4 px wide), (40,570) = 26,26,26 (instance 0 has size 0), (200,150) = 122,132,1, (440,330) = 118,135,2;
  bounding box x 22..779, y 15..570. (0.02 % of the pixels differ from Mesa.)

## `planet`
- **Task:** Switch to learnopengl's asteroid scene: camera globals at (0, 0, 55) looking down -z, the projection with the far plane at 1000 (the scene is large), the planet loaded into a new member `Model m_planet` from `"models/planet.obj"` and drawn with `planet.hlsl` at (0, -3, 0), scaled 4. Remove the quads.
- **Hint:** The pipeline state takes `planet.hlsl`'s `VSMain` / `PSMain` and the mesh's input layout (`POSITION`, `NORMAL` at 12, `TEXCOORD` at 24). In `LoadAssets`: `m_planet.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);` instead of the quad's and the instances' buffers, `m_planet.uploadHeaps.clear();` after the wait. `OnUpdate`: `XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), …, 0.1f, 1000.0f)`, transposed into the constant buffer. `PopulateCommandList`: `XMMatrixScaling(4.0f, 4.0f, 4.0f) * XMMatrixTranslation(0.0f, -3.0f, 0.0f)` as root constants, `m_planet.Draw(m_commandList.Get());`.
- **When done:** `main.cpp`: globals `cameraPos = XMVectorSet(0.0f, 0.0f, 55.0f, 0.0f)`, `cameraFront (0, 0, -1)`,
  `cameraUp (0, 1, 0)`; `struct QuadVertex`, `m_vertexBuffer`, `m_vertexBufferView`, `m_instanceBuffer`,
  `m_instanceBufferView`, the quad's vertex buffer, `translations` and the instance buffer removed; member `Model
  m_planet;`; `D3DCompileFromFile(L"planet.hlsl", …)` (VS, PS); the mesh input layout; `m_planet.Load("models/planet.obj",
  …, 1);`, `m_planet.uploadHeaps.clear();`; `OnUpdate` with the view, the projection (far `1000.0f`) and the `memcpy`;
  `PopulateCommandList`: the model matrix, `SetGraphicsRoot32BitConstants(0, …)`, `m_planet.Draw(m_commandList.Get());`.
  **A small textured planet** below the window centre (no lighting; disc of radius ≈ 53 px around (400,340), bounding
  box x ≈ 294..505, y ≈ 287..391) with its ring seen almost edge-on (the camera is 3 units above the ring's plane): a
  thin beige ellipse through the planet's middle, x ≈ 294..505, y ≈ 336..343. (400,320) = 100,138,59 (land), (380,360) =
  72,125,52, (355,340) = 28,70,150 (ocean), (400,380) = 39,88,115 (OpenGL 44,94,101: a coast, mipmapped there); ring
  (300,340) = 135,116,90, (500,340) = 166,142,111 (1–2 px thin: allow ±1 px); background (400,200), (100,100), (400,500),
  (200,300), (600,300) = 26,26,26. (0.1 % of the pixels differ from Mesa.)

## `asteroids`
- **Task:** learnopengl 10.3: 500 rocks (`amount`) in a ring around the planet (radius 15, offset 2.5), their model matrices computed once in `LoadAssets` (learnopengl's loop with `rand()` after `srand(42)`), stored in a vertex buffer bound to input slot 1, and drawn with **one** `DrawIndexedInstanced(…, amount, …)` per rock mesh with a second pipeline state whose input layout reads the matrix per instance.
- **Hint:** A vertex input is at most 4 floats, so the matrix is four elements `INSTANCEMATRIX` 0..3 (`DXGI_FORMAT_R32G32B32A32_FLOAT`, slot 1, offsets 0/16/32/48, `PER_INSTANCE_DATA`, 1) and the vertex shader rebuilds it: `float4x4 instanceMatrix = float4x4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);`. Store the matrices **untransposed** (`XMStoreFloat4x4(&modelMatrices[i], model)`): those are the rows `mul(position, instanceMatrix)` needs. learnopengl's `translate * scale * rotate` is `XMMatrixRotationAxis(…, rotAngle) * XMMatrixScaling(…) * XMMatrixTranslation(x, y, z)` in DirectXMath's order. Load the rock after the planet: `m_rock.Load("models/rock.obj", …, 1 + 2 * static_cast<UINT>(m_planet.meshes.size()))` (its texture views after the planet's). Draw: `SetPipelineState(m_asteroidPipelineState.Get())`, `IASetVertexBuffers(1, 1, &m_instanceBufferView)`, then per mesh `SetGraphicsRootDescriptorTable(2, m_rock.meshes[i].srvHandle)`, `IASetVertexBuffers(0, 1, &m_rock.meshes[i].vertexBufferView)`, `IASetIndexBuffer(&m_rock.meshes[i].indexBufferView)` and `DrawIndexedInstanced(static_cast<UINT>(m_rock.meshes[i].indices.size()), amount, 0, 0, 0)`.
- **When done:** `asteroids.hlsl`: `VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD,
  float4 instanceRow0 : INSTANCEMATRIX0, … float4 instanceRow3 : INSTANCEMATRIX3)`, `float4x4 instanceMatrix =
  float4x4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);`, `mul(mul(mul(position, instanceMatrix), view),
  projection)`. `main.cpp`: `#include <cstdlib>`; `static const UINT amount = 500;`; members `m_asteroidPipelineState`,
  `Model m_rock;`, `m_instanceBuffer`, `m_instanceBufferView`; `D3D12_INPUT_ELEMENT_DESC asteroidInputElementDescs[]`
  (the mesh's three elements + four `"INSTANCEMATRIX"` elements, slot 1, `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA`,
  step rate 1), `D3DCompileFromFile(L"asteroids.hlsl", …)` (VS, PS) and `CreateGraphicsPipelineState(&psoDesc,
  IID_PPV_ARGS(&m_asteroidPipelineState))`; in `LoadAssets` `m_rock.Load("models/rock.obj", …)`,
  `std::vector<XMFLOAT4X4> modelMatrices(amount);`, `srand(42);`, `float radius = 15.0f; float offset = 2.5f;`,
  learnopengl's loop (`angle`, three `displacement`s, `scale = static_cast<float>((rand() % 20) / 100.0 + 0.05)`,
  `rotAngle = static_cast<float>((rand() % 360))`, `XMMatrixRotationAxis(XMVectorSet(0.4f, 0.6f, 0.8f, 0.0f), rotAngle)
  * XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(x, y, z)`, `XMStoreFloat4x4(&modelMatrices[i], model)`),
  the instance buffer (`memcpy(…, modelMatrices.data(), …)`, `StrideInBytes = sizeof(XMFLOAT4X4)`),
  `m_rock.uploadHeaps.clear();`; in `PopulateCommandList` after `m_planet.Draw(...)` the `SetPipelineState`,
  `IASetVertexBuffers(1, …)` and the loop over `m_rock.meshes` with `DrawIndexedInstanced(…, amount, 0, 0, 0)`.
  **A flat band of grey rocks** across the planet's upper half (the ring of radius 15 seen from 3 units above its plane):
  expected as in OpenGL (same numbers: DirectXMath reproduces glm's matrices) – rock pixels (grey ≈ 110–150, e.g.
  134,130,126) only in x ≈ 151..645, y ≈ 279..321 (≈ 4,600 rock pixels outside the planet, most in rows 285..319);
  with glibc's `rand()` (the simulator's) (200,300) = 134,130,126, (600,300) = 139,135,131, (400,300) = 141,137,133 – on
  Windows the C library's `rand()` gives another sequence, so the field looks different there: check counts/areas, not
  single pixels. The planet below the band is unchanged: (400,320) = 100,138,59, (355,340) = 28,70,150; background
  (400,200), (100,100), (400,500) = 26,26,26; nothing outside y 270..400. Static. Final state. (Not rendered by the
  simulator yet: note 2.)

  Why `srand(42)`: learnopengl seeds with the time – a different field each run. A fixed seed gives the same field every
  run, so the picture can be compared. learnopengl's 10.2 (one draw per rock, 500 draw calls) is described in the text
  only; learnopengl's 100,000 rocks / radius 150 are reduced to 500 / radius 15 for the simulator.
