# hello-triangle – DirectX 12

Follows Microsoft's D3D12HelloTriangle sample (with the triangle and colours of learnopengl). Start =
`hello-window/solution` plus what the triangle needs declared: `struct Vertex { XMFLOAT3 position; };`,
`m_viewport`/`m_scissorRect` (initialised in the constructor to 800×600), `m_rootSignature`, `m_vertexBuffer`,
`m_vertexBufferView`; and TODOs in `LoadAssets`, `PopulateCommandList` and `shaders.hlsl` (which holds only
comments). The start runs and shows the clear colour `(0.2, 0.3, 0.3, 1.0)` (RGB 51, 77, 77); Escape closes it.

Pixel positions below are in the 800×600 client area. The triangle's corners are top (400, 150), bottom right
(600, 450), bottom left (200, 450); the rectangle covers (200, 150)–(600, 450).

Nothing new is visible until `draw`: the shaders are only compiled once `pipeline` is done, and nothing uses the
pipeline or the vertex buffer before `draw`.

## vertex-shader
- **Task:** In `shaders.hlsl`, write the vertex shader: `struct PSInput { float4 position : SV_POSITION; };` and `PSInput VSMain(float4 position : POSITION)` that copies the position into `result.position`.
- **Hint:** `POSITION` is the name the input layout gives the vertex buffer's data; `SV_POSITION` is the clip-space position the rasterizer needs. The buffer has x, y, z – w becomes 1.0.
- **Observable:** `shaders.hlsl` has `PSInput` with `SV_POSITION` and `VSMain` taking `float4 position : POSITION`. Picture unchanged (clear colour only).

## pixel-shader
- **Task:** Write the pixel shader `float4 PSMain(PSInput input) : SV_TARGET` returning orange `float4(1.0f, 0.5f, 0.2f, 1.0f)`.
- **Hint:** `SV_TARGET` means: this value goes to the render target (the back buffer).
- **Observable:** `PSMain` returns `float4(1.0f, 0.5f, 0.2f, 1.0f)`. Picture unchanged.

## root-signature
- **Task:** Create an empty root signature with the flag `D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT`: `CD3DX12_ROOT_SIGNATURE_DESC::Init(0, nullptr, 0, nullptr, flag)`, `D3D12SerializeRootSignature(..., D3D_ROOT_SIGNATURE_VERSION_1, ...)`, `CreateRootSignature`.
- **Hint:** The root signature lists what the shaders read besides the vertices (constants, textures …) – nothing yet. The flag allows a vertex input layout.
- **Observable:** `D3D12SerializeRootSignature` and `CreateRootSignature(..., IID_PPV_ARGS(&m_rootSignature))` with `ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT`. Picture unchanged.

## pipeline
- **Task:** Compile the shaders with `D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr)` (and `"PSMain"`, `"ps_5_0"`), describe the input layout `{ "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`, fill a `D3D12_GRAPHICS_PIPELINE_STATE_DESC` (root signature, VS/PS, `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)`, `CD3DX12_BLEND_DESC(D3D12_DEFAULT)`, no depth/stencil, `SampleMask = UINT_MAX`, triangle topology type, one render target `DXGI_FORMAT_R8G8B8A8_UNORM`, `SampleDesc.Count = 1`) and `CreateGraphicsPipelineState`. Pass `m_pipelineState.Get()` instead of `nullptr` to `CreateCommandList`.
- **Hint:** The pipeline state object (PSO) bakes shaders and fixed-function state into one object. `compileFlags` adds debug info in debug builds. The shader file is looked up in the working directory.
- **Observable:** two `D3DCompileFromFile` calls (`vs_5_0`, `ps_5_0`), the `POSITION` input element, `CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState))`, `CreateCommandList(..., m_pipelineState.Get(), ...)`. Picture unchanged; a shader error now stops the program at start-up (exception with the HRESULT).

## vertex-buffer
- **Task:** Create the vertex buffer: `Vertex vertices[]` = `{ { 0.0f, 0.5f, 0.0f } }, { { 0.5f, -0.5f, 0.0f } }, { { -0.5f, -0.5f, 0.0f } }` (top, bottom right, bottom left), a committed resource in an upload heap (`CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD)`, `CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize)`, state `D3D12_RESOURCE_STATE_GENERIC_READ`), `Map` + `memcpy` + `Unmap`, and the view (`BufferLocation`, `StrideInBytes = sizeof(Vertex)`, `SizeInBytes`).
- **Hint:** Keep the heap properties and the resource description in local variables and pass their addresses (`&CD3DX12_HEAP_PROPERTIES(...)` only compiles in MSVC). Top, bottom right, bottom left is clockwise on screen – the default rasterizer state treats clockwise triangles as front faces and culls the others.
- **Observable:** `CreateCommittedResource` with `D3D12_HEAP_TYPE_UPLOAD` and `GENERIC_READ`, `Map`/`memcpy`/`Unmap`, `m_vertexBufferView` filled in, the three vertices above. Picture unchanged.

## draw
- **Task:** In `PopulateCommandList`: set the root signature, viewport and scissor rectangle (`SetGraphicsRootSignature`, `RSSetViewports(1, &m_viewport)`, `RSSetScissorRects(1, &m_scissorRect)`), bind the back buffer as render target (`OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`), and after the clear draw: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST)`, `IASetVertexBuffers(0, 1, &m_vertexBufferView)`, `DrawInstanced(3, 1, 0, 0)`.
- **Hint:** Clearing needs only the RTV handle, drawing needs the render target bound. The pipeline state is set by `m_commandList->Reset(..., m_pipelineState.Get())`.
- **Observable:** the calls above. The orange triangle `(1.0, 0.5, 0.2, 1.0)` (RGB 255, 128, 51) appears with corners (400, 150), (600, 450), (200, 450) on the clear colour; centre pixel (400, 300) orange. This is the state of `introduction/start`.

## rectangle-vertices
- **Task:** Replace the three vertices by the four corners of a rectangle (learnopengl's): top right `{ 0.5f, 0.5f, 0.0f }`, bottom right `{ 0.5f, -0.5f, 0.0f }`, bottom left `{ -0.5f, -0.5f, 0.0f }`, top left `{ -0.5f, 0.5f, 0.0f }`.
- **Hint:** `DrawInstanced(3, ...)` still draws the first three vertices only.
- **Observable:** four vertices in `vertices`. The picture shows the lower-right half of the rectangle: an orange right triangle with corners (600, 150), (600, 450), (200, 450) (clockwise, so not culled); e.g. (550, 200) orange, (250, 200) clear colour.

## index-buffer
- **Task:** Draw the whole rectangle with an index buffer: members `ComPtr<ID3D12Resource> m_indexBuffer;` and `D3D12_INDEX_BUFFER_VIEW m_indexBufferView`; `UINT indices[] = { 0, 1, 3, 1, 2, 3 };` in an upload-heap buffer like the vertex buffer, view with `Format = DXGI_FORMAT_R32_UINT`; in `PopulateCommandList` `IASetIndexBuffer(&m_indexBufferView)` and `DrawIndexedInstanced(6, 1, 0, 0, 0)` instead of `DrawInstanced`.
- **Hint:** Both triangles (top right, bottom right, top left) and (bottom right, bottom left, top left) are clockwise on screen, so neither is culled. To see the two triangles, try `psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;` (wireframe mode).
- **Observable:** `IASetIndexBuffer`, `DrawIndexedInstanced(6, 1, 0, 0, 0)`, `DXGI_FORMAT_R32_UINT`, indices `{ 0, 1, 3, 1, 2, 3 }`. An orange rectangle covering (200, 150)–(600, 450); (250, 200), (550, 200), (400, 300) orange; (100, 500) clear colour.
