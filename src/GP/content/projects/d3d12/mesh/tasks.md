# mesh – DirectX 12

learnopengl.com "Mesh": a port of learnopengl's `mesh.h` into `main.cpp` (file scope, before `class D3D12App`):
`struct Vertex`, `struct Texture`, `class Mesh` with its data, constructor, `SetupMesh` and `Draw`. Files: `main.cpp`,
`model_loading.hlsl`, read-only `models/` (planet.obj, planet.mtl and its four PNGs). Start = the Assimp chapter's
project (see assimp/tasks.md): the scene skeleton without a draw.

Like learnopengl's chapter, **nothing new is drawn**: no Mesh is created yet (the Model chapter does that). Every
step's picture is the background only, 13,13,13 at (400,300) and (100,100). The tasks are code checks; below is the
code each one adds.

DirectX 12 port decisions (vs learnopengl's OpenGL):
- `Texture` holds the GPU texture (`ComPtr<ID3D12Resource> resource` – learnopengl's `id`), `type` and `path`.
- The mesh's textures are bound with **one descriptor table per mesh**: each mesh owns two consecutive SRV slots of the
  CBV/SRV heap – slot 0 = its first `"texture_diffuse"` (shader `texture_diffuse1`, t0), slot 1 = its first
  `"texture_specular"` (`texture_specular1`, t1); a missing texture gets a null SRV. This is learnopengl's naming
  convention (`texture_diffuseN` → texture unit) in D3D12 terms; the views are created in `SetupMesh`, and `Draw`
  sets the table (root parameter 2).
- Vertex and index buffers in upload heaps (as the earlier chapters' vertex buffers), 32-bit indices
  (`DXGI_FORMAT_R32_UINT`, learnopengl's `unsigned int`). The input layout (POSITION 0 / NORMAL 12 / TEXCOORD 24) is
  in the PSO already and matches `Vertex` – the D3D12 counterpart of setupMesh's glVertexAttribPointer calls.
- The constructor takes, besides learnopengl's three vectors, the device and the mesh's slot in the heap (CPU handle
  to write the views, GPU handle for `Draw`), and calls `SetupMesh` like learnopengl's constructor calls `setupMesh()`.

## vertex
- **Task:** Define the data of a mesh: `struct Vertex` with `XMFLOAT3 position`, `XMFLOAT3 normal`, `XMFLOAT2 texCoord`, and `struct Texture` with `ComPtr<ID3D12Resource> resource`, `std::string type`, `std::string path`.
- **Hint:** The fields of `Vertex` in that order are exactly the input layout: 12 + 12 + 8 bytes, POSITION at 0, NORMAL at 12, TEXCOORD at 24.
- **When done:** at file scope (replacing the TODO `// TODO: struct Vertex (position, normal, texture coordinates) and
  struct Texture`): `struct Vertex { XMFLOAT3 position; XMFLOAT3 normal; XMFLOAT2 texCoord; };` and `struct Texture {
  ComPtr<ID3D12Resource> resource; std::string type; std::string path; };`. No visible change (background 13,13,13).

## mesh-class
- **Task:** Add `class Mesh`: public `std::vector<Vertex> vertices`, `std::vector<UINT> indices`, `std::vector<Texture> textures`; a constructor `Mesh(vertices, indices, textures, ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle, CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle)` that stores them, keeps the GPU handle in `m_srvHandle` and calls `SetupMesh(device, srvCpuHandle)`; `void Draw(ID3D12GraphicsCommandList* commandList)`; private render data (`m_vertexBuffer`, `m_indexBuffer`, `m_vertexBufferView`, `m_indexBufferView`, `m_srvHandle`) and `void SetupMesh(ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle)`. `Draw` and `SetupMesh` stay TODOs for the next tasks.
- **Hint:** As learnopengl: `this->vertices = vertices;` etc., then "now that we have all the required data", set up the buffers. The CPU handle is where the mesh writes its texture views; the GPU handle is what `Draw` gives the command list.
- **When done:** `class Mesh` (replacing `// TODO: class Mesh (the mesh's data, its constructor, SetupMesh and Draw)`)
  with: `std::vector<Vertex>  vertices;`, `std::vector<UINT>    indices;`, `std::vector<Texture> textures;`; the
  constructor `Mesh(std::vector<Vertex> vertices, std::vector<UINT> indices, std::vector<Texture> textures,
  ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle, CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle)` with
  `this->vertices = vertices;`, `this->indices = indices;`, `this->textures = textures;`, `m_srvHandle = srvGpuHandle;`,
  `SetupMesh(device, srvCpuHandle);`; `void Draw(ID3D12GraphicsCommandList* commandList)` (body: a TODO);
  `ComPtr<ID3D12Resource> m_vertexBuffer;`, `ComPtr<ID3D12Resource> m_indexBuffer;`, `D3D12_VERTEX_BUFFER_VIEW
  m_vertexBufferView = {};`, `D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};`, `D3D12_GPU_DESCRIPTOR_HANDLE
  m_srvHandle = {};`; `void SetupMesh(ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle)` (body: two
  TODOs). No visible change.

## setup-mesh
- **Task:** In `SetupMesh`, create the vertex buffer and the index buffer in upload heaps, copy `vertices` and `indices` into them, and fill `m_vertexBufferView` and `m_indexBufferView`.
- **Hint:** The sizes are `vertices.size() * sizeof(Vertex)` and `indices.size() * sizeof(UINT)`; copy with `memcpy(p, vertices.data(), size)` between `Map` and `Unmap`. The index buffer view's format is `DXGI_FORMAT_R32_UINT`.
- **When done:** in `SetupMesh`: `CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);`, `const UINT
  vertexBufferSize = static_cast<UINT>(vertices.size() * sizeof(Vertex));`, `device->CreateCommittedResource(…,
  IID_PPV_ARGS(&m_vertexBuffer))`, `memcpy(pVertexDataBegin, vertices.data(), vertexBufferSize);`,
  `m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();`, `m_vertexBufferView.StrideInBytes =
  sizeof(Vertex);`, `m_vertexBufferView.SizeInBytes = vertexBufferSize;`; `const UINT indexBufferSize =
  static_cast<UINT>(indices.size() * sizeof(UINT));`, `CreateCommittedResource(…, IID_PPV_ARGS(&m_indexBuffer))`,
  `memcpy(pIndexDataBegin, indices.data(), indexBufferSize);`, `m_indexBufferView.BufferLocation =
  m_indexBuffer->GetGPUVirtualAddress();`, `m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;`,
  `m_indexBufferView.SizeInBytes = indexBufferSize;`. No visible change.

## mesh-textures
- **Task:** Still in `SetupMesh`: create the mesh's two shader resource views at `srvHandle` – slot 0 the first texture of type `"texture_diffuse"`, slot 1 the first of type `"texture_specular"` (a null view if there is none).
- **Hint:** Loop over `const char* slotTypes[] = { "texture_diffuse", "texture_specular" };`, find the texture with that `type`, `device->CreateShaderResourceView(resource, &srvDesc, srvHandle);` (R8G8B8A8_UNORM, TEXTURE2D, 1 mip level), then `srvHandle.Offset(1, device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV));`.
- **When done:** in `SetupMesh`: `const char* slotTypes[] = { "texture_diffuse", "texture_specular" };`, a `for (UINT
  slot = 0; slot < _countof(slotTypes); slot++)` loop that searches `textures[i].type == slotTypes[slot]` and takes
  `textures[i].resource.Get()` (else `nullptr`), a `D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc` (`Format =
  DXGI_FORMAT_R8G8B8A8_UNORM`, `ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D`, `Texture2D.MipLevels = 1`),
  `device->CreateShaderResourceView(resource, &srvDesc, srvHandle);` and `srvHandle.Offset(1, …)`. No visible change.

## draw-mesh
- **Task:** Fill `Mesh::Draw`: set root parameter 2 to the mesh's textures (`m_srvHandle`), bind the vertex and index buffers and draw all `indices`.
- **Hint:** `commandList->SetGraphicsRootDescriptorTable(2, m_srvHandle);`, `IASetVertexBuffers(0, 1, &m_vertexBufferView)`, `IASetIndexBuffer(&m_indexBufferView)`, `DrawIndexedInstanced(static_cast<UINT>(indices.size()), 1, 0, 0, 0)`.
- **When done:** `Mesh::Draw` contains `commandList->SetGraphicsRootDescriptorTable(2, m_srvHandle);`,
  `commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);`, `commandList->IASetIndexBuffer(&m_indexBufferView);`,
  `commandList->DrawIndexedInstanced(static_cast<UINT>(indices.size()), 1, 0, 0, 0);`. No visible change (no Mesh
  exists yet; the Model chapter creates and draws them). Final state.

Simulator note: the solution's first `DrawIndexedInstanced` is inside `Mesh::Draw`, not in `PopulateCommandList`; the
current D3D12 reader takes it as the frame's draw and reports `dxNoIndexBuffer` – it should ignore draws inside class
methods (the picture must stay the background).
