# coordinate-systems – DirectX 12

learnopengl.com "Coordinate Systems": model, view and projection matrices, the textured cube, depth testing, ten
cubes. DirectXMath with the **right-handed** functions (`XMMatrixPerspectiveFovRH`), so the numbers are
learnopengl's: same camera, same pictures (the RH projection maps depth to Direct3D's 0..1 instead of OpenGL's -1..1;
x, y and w are identical – checked numerically against GLM for every step). Per-draw value (the model matrix) =
**root constants** (root parameter 1, b0), per-frame values (view, projection) = a **constant buffer view** in the
CBV/SRV heap, like D3D12HelloConstBuffers (256-byte aligned `SceneConstantBuffer` with padding + `static_assert`, an
upload-heap buffer persistently mapped, `memcpy` every frame in `OnUpdate`). The depth buffer is set up like
D3D12Bundles (DSV heap, `DXGI_FORMAT_D32_FLOAT` texture with an optimized clear value of 1.0 in the `DEPTH_WRITE`
state, `CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` and `DSVFormat` in the PSO, `OMSetRenderTargets` with the DSV,
`ClearDepthStencilView` every frame).

Start = `transformations/solution` with these changes: the SRV heap is renamed `m_cbvSrvHeap`
(`m_cbvSrvDescriptorSize`, `cbvSrvHeapDesc`) because it will also hold the CBV; the root constants are now
`struct ModelConstants { XMFLOAT4X4 model; }` / `cbuffer ModelConstants : register(b0) { float4x4 model; }` with
`mul(position, model)`; `PopulateCommandList` draws the rectangle once with `XMMATRIX model = XMMatrixIdentity();`
(the transformations' time/two-container code is gone, `<chrono>`/`<cmath>` stay included). TODOs: root parameter 2
(root signature block and `PopulateCommandList`), the constant buffer and the depth buffer (end of `LoadAssets`),
`OnUpdate` (view and projection).

Matrix conventions as in `transformations`: products apply left to right (`v * M`), each matrix is stored with
`XMMatrixTranspose`, HLSL multiplies the row vector on the left: `mul(mul(mul(position, model), view), projection)`
(= GLSL's `projection * view * model * position`). Per-frame code: `OnUpdate` (view, projection → constant buffer,
local `SceneConstantBuffer constantBufferData`) and `PopulateCommandList` (time, model, draws). Window size from
`m_width` / `m_height`. Time = `std::chrono` since the first frame (static `startTime` in `PopulateCommandList`).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s. D3D12 cannot run here: the colours
come from a software model of these exact matrices and draw orders (perspective-correct texture coordinates,
bilinear filtering at pixel centres, one mip level as in the code, the real PNGs, depth test LESS when enabled); a GPU
may differ by a few units, edges by a pixel. The pictures match OpenGL's except that OpenGL's mipmaps blur small or
slanted faces a little more. Background ≈ (51, 77, 77). Crate colours: face centre / brace ≈ (125, 89, 30), frame
≈ (74, 46, 22), planks ≈ (168, 120, 50) / (179, 128, 54), screws ≈ (152, 152, 144).

The cube's texture coordinates are learnopengl's with v flipped (`1 - v`), because Direct3D's v = 0 is the top row of
the image (the textures chapter loads the images without a flip): every face shows the crate upright, as in OpenGL.

Start picture: the crate rectangle, full size and upright, (200, 150)–(600, 450); centre (400, 300) ≈ (125, 89, 30),
(400, 155) ≈ (74, 46, 22), (300, 225) ≈ (168, 120, 50).

## constant-buffer
- **Task:** Create the constant buffer for the view and projection matrices: `struct SceneConstantBuffer { XMFLOAT4X4 view; XMFLOAT4X4 projection; float padding[32]; };` with `static_assert((sizeof(SceneConstantBuffer) % 256) == 0, …)`, members `ComPtr<ID3D12Resource> m_constantBuffer` and `UINT8* m_pCbvDataBegin`, 3 descriptors in the CBV/SRV heap, and in `LoadAssets` an upload-heap buffer of `sizeof(SceneConstantBuffer)`, a constant buffer view in the heap's third slot (`CD3DX12_CPU_DESCRIPTOR_HANDLE cbvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize)`), and `Map` it for good.
- **Hint:** A constant buffer view must cover a multiple of 256 bytes: two matrices are 128 bytes, the padding makes 256. The buffer lives in an upload heap and stays mapped (like D3D12HelloConstBuffers): the CPU writes it each frame with `memcpy`. Slots 0 and 1 hold the textures' SRVs, so the CBV goes into slot 2 – one descriptor further is `m_cbvSrvDescriptorSize` bytes.
- **Observable:** `SceneConstantBuffer` (view, projection, `padding[32]`, size 256) + `static_assert`; `cbvSrvHeapDesc.NumDescriptors = 3`; `CreateCommittedResource` (UPLOAD, `Buffer(constantBufferSize)`, `GENERIC_READ`, `&m_constantBuffer`); `D3D12_CONSTANT_BUFFER_VIEW_DESC` with `BufferLocation = m_constantBuffer->GetGPUVirtualAddress()`, `SizeInBytes = constantBufferSize`; `CreateConstantBufferView(&cbvDesc, cbvHandle)` at offset 2; `m_constantBuffer->Map(0, &readRange, …&m_pCbvDataBegin)`. Picture unchanged (nothing reads the buffer yet).

## view-projection
- **Task:** Use the constant buffer: a second descriptor range `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1)` (b1) and root parameter 2 `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_VERTEX)`; in `OnUpdate` `XMMATRIX view = XMMatrixTranslation(0.0f, 0.0f, -3.0f);` and `XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);`, stored transposed in a local `SceneConstantBuffer` and `memcpy`'d to `m_pCbvDataBegin`; in `PopulateCommandList` `SetGraphicsRootDescriptorTable(2, cbvHandle)` with the GPU handle of slot 2; in the shader `cbuffer SceneConstantBuffer : register(b1) { float4x4 view; float4x4 projection; };` and `result.position = mul(mul(mul(position, model), view), projection);`.
- **Hint:** The camera looks down -z (right-handed, like OpenGL), so moving the scene by -3 in z puts it 3 units in front of the camera. The projection divides by the distance: the rectangle shrinks, and the window's 4:3 stretch is undone. Writing the buffer in `OnUpdate` is safe because `OnRender` waits for the GPU each frame.
- **Observable:** `ranges[2]` with a CBV range at b1; `rootParameters[3]`, parameter 2 = descriptor table (vertex); `OnUpdate`: `XMMatrixTranslation(0.0f, 0.0f, -3.0f)`, `XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), 800/600, 0.1f, 100.0f)`, two `XMStoreFloat4x4(…, XMMatrixTranspose(…))`, `memcpy(m_pCbvDataBegin, …)`; `CD3DX12_GPU_DESCRIPTOR_HANDLE cbvHandle(…, 2, m_cbvSrvDescriptorSize)` + `SetGraphicsRootDescriptorTable(2, cbvHandle)`; HLSL `cbuffer SceneConstantBuffer : register(b1)` and the `mul` chain. Picture: the crate, smaller and now **square**, about (279, 179)–(520, 420) (241 × 241 pixels), centred; centre (400, 300) ≈ (125, 89, 30), screws (290, 190) and (510, 410) ≈ (152, 152, 144), frame (285, 300) and (400, 185) ≈ (74, 46, 22); (270, 300), (200, 150) background ≈ (51, 77, 77).

## plane
- **Task:** Tilt the rectangle back like a floor: `XMMATRIX model = XMMatrixRotationX(XMConvertToRadians(-55.0f));`.
- **Hint:** A rotation about the x axis by -55° moves the top edge away from the camera and the bottom edge towards it; with the perspective projection the far edge looks shorter.
- **Observable:** `XMMatrixRotationX(XMConvertToRadians(-55.0f))` as the model matrix. Picture (as learnopengl's): a trapezoid, narrow at the top and wide at the bottom: top edge at y ≈ 240 from x ≈ 293 to 506, bottom edge at y ≈ 379 from x ≈ 260 to 539; centre (400, 300) ≈ (125, 89, 30), (400, 250) ≈ (179, 128, 54), bottom frame (400, 370) ≈ (74, 46, 22), bottom screws (270, 370) and (530, 370) ≈ (150, 150, 140); (400, 230) and (400, 385) background ≈ (51, 77, 77). Upright: the heart is right of the face.

## cube
- **Task:** Replace the rectangle by learnopengl's cube: 36 vertices (position + texture coordinates, v flipped to `1 - v`), remove the index buffer (its block, `m_indexBuffer`, `m_indexBufferView`, `IASetIndexBuffer`), draw with `m_commandList->DrawInstanced(36, 1, 0, 0);`, and turn culling off: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;`.
- **Hint:** Every face is 2 triangles of 3 vertices – no indices this time (learnopengl's `glDrawArrays(GL_TRIANGLES, 0, 36)`). learnopengl's cube mixes clockwise and counter-clockwise triangles (OpenGL draws both sides by default), but Direct3D culls back faces (counter-clockwise on screen) by default – so culling is turned off. The model matrix is still the -55° tilt.
- **Observable:** `Vertex vertices[]` with 36 entries (first `{ { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } }`); no index buffer anywhere; `DrawInstanced(36, 1, 0, 0)`; `RasterizerState.CullMode = D3D12_CULL_MODE_NONE`. Picture: the tilted cube, **without depth testing**: the triangles are drawn in buffer order, so faces at the back cover faces at the front – it looks like an open box seen from above, about x 243–556, y 138–474; (400, 300) ≈ (179, 128, 54), (400, 150) ≈ (74, 46, 22), (250, 300) and (550, 300) ≈ (74, 46, 22) (side frames); (200, 300) background.

## spin
- **Task:** Rotate the cube with the time: compute `time` with `std::chrono` (static `startTime`) and use `XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(0.5f, 1.0f, 0.0f, 0.0f), time);`.
- **Hint:** `XMMatrixRotationAxis` is `glm::rotate` with an axis: it normalizes the axis (0.5, 1, 0) itself; the angle is in radians (one turn in 6.3 s).
- **Observable:** the chrono time lines and `XMMatrixRotationAxis(XMVectorSet(0.5f, 1.0f, 0.0f, 0.0f), time)`. The cube turns about a slanted axis, still without depth testing (faces at the back still cover faces at the front wherever they are drawn later). At 1 s it spans about x 216–594, y 146–508; (400, 300) ≈ (143, 95, 46), (450, 300) ≈ (136, 91, 50), (400, 400) ≈ (168, 120, 50), (400, 350) ≈ (74, 46, 22). Changes with time.

## depth-test
- **Task:** Add a depth buffer: a DSV heap (`D3D12_DESCRIPTOR_HEAP_TYPE_DSV`, 1 descriptor) in `LoadPipeline`; in `LoadAssets` a `DXGI_FORMAT_D32_FLOAT` texture of the window's size (`CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)`, default heap, state `D3D12_RESOURCE_STATE_DEPTH_WRITE`, clear value depth 1.0) and its `CreateDepthStencilView`; in the PSO `psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);` and `psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;`; in `PopulateCommandList` `OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)` and `ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr)` after clearing the colour.
- **Hint:** The depth buffer keeps, per pixel, the depth of the nearest thing drawn so far; with the default state a new pixel is kept only if it is nearer (`LESS`). Clear it to 1.0 (the far plane) every frame – learnopengl's `glClear(GL_DEPTH_BUFFER_BIT)`. The PSO must know the DSV's format. The optimized clear value lets the GPU clear faster.
- **Observable:** member `m_dsvHeap` (DSV heap, 1 descriptor, `FLAG_NONE`) and `m_depthStencil`; `D3D12_DEPTH_STENCIL_VIEW_DESC` (D32_FLOAT, `D3D12_DSV_DIMENSION_TEXTURE2D`); `D3D12_CLEAR_VALUE` depth 1.0; `CreateCommittedResource(… DEFAULT, Tex2D(D32_FLOAT, 800, 600, …, ALLOW_DEPTH_STENCIL), DEPTH_WRITE, &depthOptimizedClearValue, &m_depthStencil)`; `CreateDepthStencilView(…, m_dsvHeap->GetCPUDescriptorHandleForHeapStart())`; PSO `CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` (no `DepthEnable = FALSE` any more) and `DSVFormat = DXGI_FORMAT_D32_FLOAT`; `OMSetRenderTargets` with `&dsvHandle`; `ClearDepthStencilView(…, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr)`. Picture: a solid spinning cube (only the front faces visible), same outline as in `spin` (x 216–594, y 146–508 at 1 s); at 1 s (400, 300) ≈ (117, 77, 42), (450, 300) ≈ (74, 46, 22), (400, 400) ≈ (74, 46, 22), (400, 350) ≈ (168, 120, 50), (500, 300) ≈ (168, 120, 50) – i.e. at (450, 300) and (400, 400) the front cube edges' dark frame instead of the light inner faces of `spin`.

## ten-cubes
- **Task:** Draw ten cubes: a local `XMFLOAT3 cubePositions[]` with learnopengl's ten positions, and a loop `for (UINT i = 0; i < 10; i++)` that computes `float angle = 20.0f * i;`, `XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(1.0f, 0.3f, 0.5f, 0.0f), XMConvertToRadians(angle)) * XMMatrixTranslation(cubePositions[i].x, cubePositions[i].y, cubePositions[i].z);`, sets it as root constants and calls `DrawInstanced(36, 1, 0, 0)` (the time lines go: nothing uses them now).
- **Hint:** One vertex buffer, ten draws: only the model matrix changes, and root constants are recorded with each draw. Rotate first, then move to the position (learnopengl: `translate` then `rotate` in GLM). View and projection stay in the constant buffer, the same for all ten.
- **Observable:** the ten `cubePositions` (`( 0, 0, 0)`, `( 2, 5, -15)`, `(-1.5, -2.2, -2.5)`, `(-3.8, -2, -12.3)`, `( 2.4, -0.4, -3.5)`, `(-1.7, 3, -7.5)`, `( 1.3, -2, -2.5)`, `( 1.5, 2, -2.5)`, `( 1.5, 0.2, -1.5)`, `(-1.3, 1, -1.5)`); 10 `SetGraphicsRoot32BitConstants(1, …)` + `DrawInstanced(36, 1, 0, 0)` per frame. Static picture (learnopengl's ten cubes): the first cube, unrotated, faces the camera as a square (255, 155)–(545, 445): centre (400, 300) ≈ (125, 89, 30), frame (260, 300), (540, 300), (400, 160), (400, 440) ≈ (74, 46, 22), screw (265, 165) ≈ (152, 152, 144); just outside it (400, 150), (400, 450), (250, 300) background ≈ (51, 77, 77) – but (550, 300) is another cube ≈ (179, 128, 54); about half the window is covered, cubes reach all four edges; (80, 60) background.

## rotate-every-third
- **Task:** Make every third cube rotate with the time: bring back the `time` lines before the cube positions, and in the loop `if (i % 3 == 0) angle = time * 25.0f;`.
- **Hint:** learnopengl's exercise: cubes 0, 3, 6 and 9 turn at 25 degrees per second; the angle stays in degrees (`XMConvertToRadians(angle)`).
- **Observable:** `if (i % 3 == 0)` + `angle = time * 25.0f`. Cubes 0, 3, 6, 9 turn, the others stand still. At 1 s the first cube is turned by 25°: (400, 300) ≈ (168, 120, 50), (440, 330) ≈ (125, 89, 30), (300, 225) ≈ (117, 77, 42); the fixed cube on the right (600, 300) ≈ (158, 117, 48) unchanged from `ten-cubes`; (80, 60) background. Changes with time.
