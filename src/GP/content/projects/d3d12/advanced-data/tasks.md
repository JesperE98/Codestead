# advanced-data – DirectX 12

learnopengl.com "Advanced Data" (no demo program there): filling buffers in parts, writing them through a pointer,
batching vertex attributes, copying between buffers. In Direct3D 12 terms: `Map` / `memcpy` / `Unmap` on an upload
heap (learnopengl's `glMapBuffer`), two input slots with a vertex buffer view each (batched attributes),
`CopyBufferRegion` between buffers with a resource barrier (`glCopyBufferSubData`), and a vertex buffer in a default
heap – the "Default Heap usage" the samples' comment recommends for static data.
Files: `main.cpp`, `advanced_data.hlsl` (= depth_testing.hlsl), `marble.png`, `metal.png`.

Start: the depth-testing scene, unchanged (one upload-heap vertex buffer: cube = vertices 0–35, floor = 36–41). TODO
comments mark where each task goes. **Every task leaves the picture exactly as it is** – the checks are on the code.
Picture (all steps, time 1 s, simulator of the start; positions from the top left of the 800×600 client area): c0
(190,300) ≈ 151,150,147, c0-low (190,380) ≈ 206,202,193, c1 (760,300) ≈ 139,138,136, floor-near (400,520) 84,88,94,
floor-left (150,450) 139,143,149, floor-far (400,370) ≈ 79,83,89, background (400,150) 26,26,26.

## map-buffer
- **Task:** Give the floor its own vertex buffer `m_floorVertexBuffer` (learnopengl's `planeVBO`): an upload heap,
  filled through the CPU pointer `Map` returns, with `memcpy`, then `Unmap` with the range of bytes written. Draw the
  floor from it.
- **Hint:** Move the floor's 6 vertices out of `vertices` into `Vertex planeVertices[]`. `Map(0, &readRange, …)` with
  `readRange(0, 0)` (the CPU reads nothing) gives the pointer (`glMapBuffer`); `Unmap(0, &writtenRange)` with
  `writtenRange(0, sizeof(planeVertices))` ends it (`glUnmapBuffer`). In `PopulateCommandList` bind the floor's view with
  `IASetVertexBuffers` before its draw – its vertices now start at 0.
- **When done:** `main.cpp`: members `ComPtr<ID3D12Resource> m_floorVertexBuffer;` and `D3D12_VERTEX_BUFFER_VIEW
  m_floorVertexBufferView`; `vertices` holds only the cube (36); a new block with `Vertex planeVertices[]` (6 vertices),
  `CreateCommittedResource(… D3D12_HEAP_TYPE_UPLOAD … IID_PPV_ARGS(&m_floorVertexBuffer))`,
  `m_floorVertexBuffer->Map(0, &readRange, …)`, `memcpy(pPlaneDataBegin, planeVertices, sizeof(planeVertices))`,
  `CD3DX12_RANGE writtenRange(0, sizeof(planeVertices)); m_floorVertexBuffer->Unmap(0, &writtenRange);`, the view
  (stride `sizeof(Vertex)`); the floor draw: `IASetVertexBuffers(0, 1, &m_floorVertexBufferView)` and
  `DrawInstanced(6, 1, 0, 0)` (no more `…, 36, 0)`). No visible change.

## batched-attributes
- **Task:** Store the cube's data batched – first all 36 positions, then all 36 texture coordinates (111222 instead of
  123123) – in the one vertex buffer, and read the two attributes from two input slots with a vertex buffer view each.
- **Hint:** `XMFLOAT3 cubePositions[]` and `XMFLOAT2 cubeTexCoords[]`; two `memcpy` into the mapped buffer: the
  positions at offset 0, the texture coordinates at `sizeof(cubePositions)` (learnopengl's two `glBufferSubData`). In
  the input layout `TEXCOORD` comes from input slot 1 at offset 0. View 0: the buffer's start, stride 12; view 1: start
  + `sizeof(cubePositions)`, stride 8; `IASetVertexBuffers(0, 2, m_vertexBufferViews)`. The floor's vertices stay
  interleaved, but the input layout is the same for it: two views into its buffer, both with stride `sizeof(Vertex)`, the
  second one `sizeof(XMFLOAT3)` bytes in.
- **When done:** `main.cpp`: `D3D12_VERTEX_BUFFER_VIEW m_vertexBufferViews[2]` and `m_floorVertexBufferViews[2]` (no
  `m_vertexBufferView` / `m_floorVertexBufferView`); input layout `{ "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, … }`;
  `XMFLOAT3 cubePositions[]` (36) and `XMFLOAT2 cubeTexCoords[]` (36) instead of `Vertex vertices[]`;
  `vertexBufferSize = sizeof(cubePositions) + sizeof(cubeTexCoords)`; `memcpy(pVertexDataBegin, cubePositions, …)` and
  `memcpy(pVertexDataBegin + sizeof(cubePositions), cubeTexCoords, …)`; the views as above;
  `IASetVertexBuffers(0, 2, m_vertexBufferViews)` and `IASetVertexBuffers(0, 2, m_floorVertexBufferViews)`. No visible
  change.

## copy-buffer
- **Task:** Copy the floor's vertices on the GPU into a second buffer `m_floorCopyBuffer` (in a default heap) with
  `CopyBufferRegion`, and draw the floor from the copy.
- **Hint:** learnopengl's `glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER, 0, 0, size)`. Create the copy
  with `D3D12_HEAP_TYPE_DEFAULT` in the `COMMON` state (buffers are created in COMMON; the copy promotes it to
  COPY_DEST by itself); `CopyBufferRegion(dest, destOffset, source, sourceOffset, bytes)` is recorded in the command list
  (executed at the end of `LoadAssets`); then a barrier COPY_DEST → VERTEX_AND_CONSTANT_BUFFER. The floor's two views
  point into the copy. `m_floorVertexBuffer` stays (the copy reads it when the list executes).
- **When done:** `main.cpp`: member `m_floorCopyBuffer`; `CreateCommittedResource(&defaultHeapProperties, …,
  D3D12_RESOURCE_STATE_COMMON, nullptr, IID_PPV_ARGS(&m_floorCopyBuffer))`,
  `m_commandList->CopyBufferRegion(m_floorCopyBuffer.Get(), 0, m_floorVertexBuffer.Get(), 0, planeVertexBufferSize);`,
  `CD3DX12_RESOURCE_BARRIER::Transition(m_floorCopyBuffer.Get(), D3D12_RESOURCE_STATE_COPY_DEST,
  D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER)` + `ResourceBarrier`; `m_floorVertexBufferViews[0/1].BufferLocation =
  m_floorCopyBuffer->GetGPUVirtualAddress() (+ sizeof(XMFLOAT3))`. No visible change.

## default-heap
- **Task:** Put the cube's vertex buffer in a default heap (memory only the GPU uses): fill an upload buffer
  (`vertexBufferUploadHeap`) with the two blocks and copy it into `m_vertexBuffer` with `CopyBufferRegion`.
- **Hint:** The samples' comment says it: an upload heap is read across the bus every time the GPU uses it – fine for a
  few vertices, but static data belongs in a default heap. The CPU cannot write a default heap, so: upload buffer (Map,
  the two `memcpy`, Unmap) → `CopyBufferRegion` → barrier COPY_DEST → VERTEX_AND_CONSTANT_BUFFER. Declare
  `vertexBufferUploadHeap` before the block, like the textures' upload heaps: it must live until the command list has
  executed. The views do not change.
- **When done:** `main.cpp`: `ComPtr<ID3D12Resource> vertexBufferUploadHeap;` before `// Create the vertex buffer.`;
  `m_vertexBuffer` created with `D3D12_HEAP_TYPE_DEFAULT` and `D3D12_RESOURCE_STATE_COMMON`; the upload buffer with
  `D3D12_HEAP_TYPE_UPLOAD` / `GENERIC_READ`; `vertexBufferUploadHeap->Map(…)`, the two `memcpy`,
  `vertexBufferUploadHeap->Unmap(0, nullptr)`; `m_commandList->CopyBufferRegion(m_vertexBuffer.Get(), 0,
  vertexBufferUploadHeap.Get(), 0, vertexBufferSize);` and the barrier COPY_DEST → VERTEX_AND_CONSTANT_BUFFER on
  `m_vertexBuffer`; the "Note: using upload heaps …" comment is gone. No visible change. This is the solution.
