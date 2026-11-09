# textures – DirectX 12

Follows Microsoft's D3D12HelloTexture sample (root signature with a descriptor table and a static sampler, a
shader-visible SRV heap, the texture in a default heap filled from an upload heap with `UpdateSubresources`, a
barrier to `PIXEL_SHADER_RESOURCE`, `CreateShaderResourceView`, `SetDescriptorHeaps` +
`SetGraphicsRootDescriptorTable`, execute + fence wait at the end of `LoadAssets`) – but the pixels come from the
course's PNG files, loaded with stb_image, instead of the sample's generated checkerboard. Files: `main.cpp`,
`shaders.hlsl`, `container.png` (256×256 RGB), `awesomeface.png` (256×256 RGBA; its transparent pixels are black
with alpha 0). The images are loaded from the working directory by file name, like `shaders.hlsl`.

Start = `hello-triangle/solution` (the indexed rectangle, empty root signature, default culling) with a colour per
vertex: `struct Vertex { XMFLOAT3 position; XMFLOAT3 color; };`, a `COLOR` input element at offset 12, the corners
top right red, bottom right green, bottom left blue, top left yellow; `shaders.hlsl` passes `color` through
`PSInput` and `PSMain` returns `input.color`. TODOs: in `LoadPipeline` (SRV heap), in the root signature block,
after the index buffer (the texture), and in `PopulateCommandList` (heap + descriptor table).

Pixel positions are in the 800×600 client area, from the top left. The rectangle covers (200, 150)–(600, 450);
outside it the clear colour (0.2, 0.3, 0.3) ≈ RGB (51, 77, 77). D3D12 cannot run here, so the RGB values below come
from a software model of the pipeline (bilinear filtering at pixel centres, the real PNGs); a GPU may differ by a
few units.

Start pixels: (210, 160) yellow ≈ (246, 253, 2), (590, 160) red ≈ (246, 15, 0), (210, 440) blue ≈ (8, 15, 240),
(590, 440) green ≈ (8, 253, 0), centre (400, 300) ≈ (127, 255, 0) (on the diagonal from the green to the yellow
corner, where the two triangles meet).

Where the crate is once it shows (upright): Direct3D's texture coordinates have v = 0 at the image's top row, so the
image is loaded **without** a vertical flip and the top left corner gets (0, 0). Its dark frame (≈ 92, 58, 28) runs
along the rectangle's edges (e.g. (210, 300), (400, 155)), its dark diagonal brace goes from the bottom left to the
top right corner through the centre: (400, 300), (500, 225) and (300, 375) are dark ≈ (92, 58, 28); the planks
either side are light: (300, 225) ≈ (146, 96, 52), (500, 375) ≈ (160, 106, 58). (If the image were upside down, the
brace would run from the top left to the bottom right: (300, 225) and (500, 375) dark.)

Nothing visible changes in the first six tasks (`load-image` … `texture-coords`): the program still shows the
colour rectangle. Each of them must still run without errors; the simulator can check the calls and fields.

## load-image
- **Task:** Include stb_image (`#define STB_IMAGE_IMPLEMENTATION` before `#include <stb_image.h>`) and, after the index buffer, open a block `// Create the first texture: the container.` that loads `container.png` with `stbi_load(..., 4)`, throws `std::runtime_error` if it fails, and frees the pixels with `stbi_image_free`.
- **Hint:** `int width, height, nrChannels;` – `stbi_load` fills them. The last argument 4 asks for RGBA, the layout of `DXGI_FORMAT_R8G8B8A8_UNORM`. No vertical flip: in Direct3D, v = 0 is the image's top row.
- **Observable:** `#define STB_IMAGE_IMPLEMENTATION` + `#include <stb_image.h>` after `#include "d3dx12.h"`; in `LoadAssets` `unsigned char* data = stbi_load("container.png", &width, &height, &nrChannels, 4);`, `if (data == nullptr)` throwing `"Failed to load texture container.png"`, `stbi_image_free(data);`. The image loads (256×256). Picture unchanged.

## texture
- **Task:** Create the texture: a `D3D12_RESOURCE_DESC` for a `D3D12_RESOURCE_DIMENSION_TEXTURE2D`, `DXGI_FORMAT_R8G8B8A8_UNORM`, `width` × `height`, 1 mip level, 1 array slice, 1 sample; `CreateCommittedResource` in a `D3D12_HEAP_TYPE_DEFAULT` heap in state `D3D12_RESOURCE_STATE_COPY_DEST` into a new member `ComPtr<ID3D12Resource> m_texture1`.
- **Hint:** A default heap is GPU memory the CPU cannot write – the pixels get there by a copy (next task), so the texture starts as a copy destination. Use a local `CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);` (never the address of a temporary).
- **Observable:** member `m_texture1`; `textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D`, `Format = DXGI_FORMAT_R8G8B8A8_UNORM`, `Width`/`Height` from `stbi_load`, `MipLevels = 1`; `CreateCommittedResource(&heapProperties /*DEFAULT*/, D3D12_HEAP_FLAG_NONE, &textureDesc, D3D12_RESOURCE_STATE_COPY_DEST, nullptr, IID_PPV_ARGS(&m_texture1))`. Picture unchanged.

## upload
- **Task:** Copy the pixels into the texture through an upload heap and wait for the copy: `GetRequiredIntermediateSize(m_texture1.Get(), 0, 1)`, an upload buffer `textureUploadHeap1` (`D3D12_HEAP_TYPE_UPLOAD`, `CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize)`, `D3D12_RESOURCE_STATE_GENERIC_READ`) declared in `LoadAssets` itself (before the texture block), a `D3D12_SUBRESOURCE_DATA` (`pData = data`, `RowPitch = width * 4`, `SlicePitch = RowPitch * height`), `UpdateSubresources(m_commandList.Get(), m_texture1.Get(), textureUploadHeap1.Get(), 0, 0, 1, &textureData)`, a barrier `COPY_DEST → PIXEL_SHADER_RESOURCE`. The command list now stays open after `CreateCommandList` (remove the early `Close()`); at the end of `LoadAssets` close it, `ExecuteCommandLists`, and call `WaitForPreviousFrame()` after the fence and event are created.
- **Hint:** `UpdateSubresources` (d3dx12) copies the pixels into the upload heap at once and records a GPU copy into the texture – which only happens when the command list executes. The upload heap must stay alive until then: it is a local of `LoadAssets`, and `LoadAssets` waits for the GPU before it returns.
- **Observable:** `GetRequiredIntermediateSize`, the upload heap `CreateCommittedResource` (UPLOAD, `GENERIC_READ`, `IID_PPV_ARGS(&textureUploadHeap1)`), `UpdateSubresources(...)`, `CD3DX12_RESOURCE_BARRIER::Transition(m_texture1.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE)`; no `m_commandList->Close()` right after `CreateCommandList`; at the end of `LoadAssets`: `m_commandList->Close()`, `ExecuteCommandLists(1, …)`, `WaitForPreviousFrame()` inside the synchronization block (after `CreateEvent`). Picture unchanged.

## srv
- **Task:** Create a shader-visible SRV heap in `LoadPipeline` (`D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV`, `NumDescriptors = 1`, `D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE`, member `ComPtr<ID3D12DescriptorHeap> m_srvHeap`) and, after the barrier, a shader resource view of the texture in its first slot: `CreateShaderResourceView(m_texture1.Get(), &srvDesc, m_srvHeap->GetCPUDescriptorHandleForHeapStart())`.
- **Hint:** A descriptor (here a SRV) tells the GPU how to read a resource: format, dimension, mip levels. Shaders can only reach descriptors in a shader-visible heap. `Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING`.
- **Observable:** `srvHeapDesc` with `CBV_SRV_UAV`, `SHADER_VISIBLE`, 1 descriptor; `srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D`, `Format = textureDesc.Format`, `Texture2D.MipLevels = 1`; `CreateShaderResourceView(m_texture1.Get(), …)`. Picture unchanged.

## root-signature
- **Task:** Give the root signature a descriptor table and a static sampler: `CD3DX12_DESCRIPTOR_RANGE ranges[1]` with `ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)` (t0), `rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL)`, a `D3D12_STATIC_SAMPLER_DESC samplers[1]` (s0: `D3D12_FILTER_MIN_MAG_MIP_LINEAR`, address mode `WRAP` on U, V, W, `MaxLOD = D3D12_FLOAT32_MAX`, `ShaderRegister = 0`, pixel shader visibility), passed to `rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, …)`. In `PopulateCommandList`, after `SetGraphicsRootSignature`: `SetDescriptorHeaps` with `m_srvHeap` and `SetGraphicsRootDescriptorTable(0, m_srvHeap->GetGPUDescriptorHandleForHeapStart())`.
- **Hint:** The table is a pointer into the SRV heap, set per frame (a reset command list forgets it); the heap must be set with `SetDescriptorHeaps` first. A static sampler lives in the root signature itself and needs no descriptor. Linear filtering + wrap = learnopengl's `GL_LINEAR` + `GL_REPEAT`.
- **Observable:** root parameter 0 = descriptor table (1 SRV range, base register t0, `D3D12_SHADER_VISIBILITY_PIXEL`); 1 static sampler (s0, MIN_MAG_MIP_LINEAR, WRAP); `SetDescriptorHeaps(1, …m_srvHeap…)` and `SetGraphicsRootDescriptorTable(0, …)` every frame. Picture unchanged (the shaders don't read the texture yet).

## texture-coords
- **Task:** Add texture coordinates: `XMFLOAT2 texCoord;` in `Vertex`, an input element `{ "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`, the coordinates top right `(1, 0)`, bottom right `(1, 1)`, bottom left `(0, 1)`, top left `(0, 0)`; in `shaders.hlsl` `float2 texCoord : TEXCOORD;` in `PSInput`, a `float2 texCoord : TEXCOORD` parameter of `VSMain` and `result.texCoord = texCoord;`.
- **Hint:** Direct3D's texture coordinates start at the image's top left corner – so the top left vertex gets (0, 0), not the bottom left one as in OpenGL. The coordinates start 24 bytes into a vertex (after 3 + 3 floats); the stride grows to 32 automatically.
- **Observable:** `XMFLOAT2 texCoord` in `Vertex`; the `TEXCOORD` element (`R32G32_FLOAT`, offset 24); the four coordinates above; `PSInput.texCoord`, `result.texCoord = texCoord`. Picture unchanged (the pixel shader still returns `input.color`).

## sample
- **Task:** Sample the texture in the pixel shader: declare `Texture2D texture1 : register(t0);` and `SamplerState wrapSampler : register(s0);` in `shaders.hlsl` and return `texture1.Sample(wrapSampler, input.texCoord);` in `PSMain`.
- **Hint:** The registers connect the shader to the root signature: t0 is the first SRV of the descriptor table, s0 the static sampler.
- **Observable:** `Texture2D texture1 : register(t0)`, `SamplerState wrapSampler : register(s0)`, `PSMain` returns `texture1.Sample(wrapSampler, input.texCoord)`. The crate fills the rectangle, upright (see above): (400, 300) ≈ (92, 58, 28) brace, (500, 225) and (300, 375) ≈ (92, 58, 28) brace, (300, 225) ≈ (146, 96, 52) plank, (500, 375) ≈ (160, 106, 58) plank, (210, 300) and (400, 155) ≈ (92, 58, 28) frame, light grey screws in the corners ((210, 160) ≈ (149, 134, 116)). No vertex colours any more.

## tint
- **Task:** Multiply the texture's colour by the vertex colour: `return texture1.Sample(wrapSampler, input.texCoord) * input.color;`.
- **Hint:** Colours multiply per channel: red keeps only the texture's red, yellow its red and green.
- **Observable:** `* input.color` in `PSMain`. The "funky" crate: tinted yellow at the top left, red at the top right, blue at the bottom left (very dark), green at the bottom right. E.g. (300, 225) ≈ (109, 96, 0), (500, 375) ≈ (40, 106, 0), (400, 300) ≈ (46, 58, 0), (500, 225) ≈ (69, 29, 0), (300, 375) ≈ (23, 29, 14); blue channel 0 in the whole right part and top half.

## second-texture
- **Task:** Load `awesomeface.png` into a second texture `m_texture2`, after the container's block, with the same steps (stbi_load with 4 channels, default-heap texture, its own upload heap `textureUploadHeap2` declared next to `textureUploadHeap1`, `UpdateSubresources`, barrier), and create its SRV in the heap's **second** slot: `CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_srvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize)`. The SRV heap gets 2 descriptors, the descriptor range 2 SRVs (t0, t1), and `m_srvDescriptorSize = GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV)` is stored in `LoadPipeline`.
- **Hint:** The descriptor table points at the heap's start and covers 2 descriptors: slot 0 is t0 (container), slot 1 is t1 (face). The size of one descriptor depends on the GPU – ask the device for it. Load the container first, then the face.
- **Observable:** `stbi_load("awesomeface.png", …, 4)` after the container's `stbi_load`; `m_texture2`, `textureUploadHeap2`, second `UpdateSubresources` and barrier; `srvHeapDesc.NumDescriptors = 2`; `ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`; `CreateShaderResourceView(m_texture2.Get(), &srvDesc, srvHandle)` with offset 1. Picture unchanged (still the tinted crate: the shader does not read t1 yet).

## texture-units
- **Task:** In `shaders.hlsl` declare `Texture2D texture2 : register(t1);` and return `lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, input.texCoord), 0.2f);` (the tint goes again).
- **Hint:** HLSL's `lerp(a, b, t)` is GLSL's `mix`: `a * (1 - t) + b * t` – 80% container, 20% face. Each texture is reached by its register, like learnopengl's texture units.
- **Observable:** `texture2 : register(t1)`, `lerp(…, …, 0.2f)` in `PSMain`, no `* input.color`. The crate (as in `sample`, slightly darker where the face is transparent: its transparent pixels are black) with a faint smiley over it: inside the face (300, 225) ≈ (168, 120, 50), centre (400, 300) ≈ (125, 89, 30); outside the face (400, 155) ≈ (74, 46, 22). The heart is on the **right**: (492, 325) ≈ (161, 83, 54) (reddish), its mirror point (308, 325) ≈ (168, 120, 50).

## flip-face
- **Task:** Mirror only the face horizontally: sample `texture2` at `float2(1.0f - input.texCoord.x, input.texCoord.y)`.
- **Hint:** u = 1 − u mirrors left and right; the container keeps `input.texCoord`.
- **Observable:** `float2(1.0f - input.texCoord.x, input.texCoord.y)` for `texture2`. The heart moves to the **left**: (308, 325) ≈ (161, 83, 54), (492, 325) ≈ (168, 120, 50). Everything else as before (the face is symmetric apart from the heart).

## repeat
- **Task:** Make the texture coordinates go from 0 to 2 (top right `(2, 0)`, bottom right `(2, 2)`, bottom left `(0, 2)`, top left `(0, 0)`), and give the container a second static sampler that clamps: `samplers[2]`, `samplers[1] = samplers[0];` with address mode `D3D12_TEXTURE_ADDRESS_MODE_CLAMP` on U, V, W and `ShaderRegister = 1`; in the shader `SamplerState clampSampler : register(s1);` and `texture1.Sample(clampSampler, …)`.
- **Hint:** With `WRAP` (s0) the face repeats 2 × 2; with `CLAMP` (s1) coordinates beyond 1 take the container's edge pixels. In D3D12 the sampler is separate from the texture, so each texture can use its own (learnopengl sets `GL_CLAMP_TO_EDGE` on texture 1).
- **Observable:** coordinates 2.0 in the vertex data; 2 static samplers (s0 WRAP, s1 CLAMP); `clampSampler : register(s1)` used for `texture1`. Four small (mirrored) faces in a 2 × 2 grid, centred at (300, 225), (500, 225), (300, 375), (500, 375) (each ≈ (125, 89, 30) there, hearts on their left, e.g. (254, 237) ≈ (161, 83, 54)); the whole crate, half size, only in the top left quarter (200, 150)–(400, 300); the rest of the rectangle is the crate's dark edge stretched out: (400, 300), (245, 312) ≈ (74, 46, 22) between the faces.

## mix-value
- **Task:** Set the mix amount from C++ as a root constant: `struct MixConstants { float mixValue; };`, a member `float m_mixValue = 0.5f;`, a second root parameter `rootParameters[1].InitAsConstants(sizeof(MixConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)` (b0), every frame `SetGraphicsRoot32BitConstants(1, sizeof(MixConstants) / 4, &mixConstants, 0)`; in the shader `cbuffer MixConstants : register(b0) { float mixValue; };` and `lerp(…, …, mixValue)`.
- **Hint:** Root parameter 1 now: the descriptor table stays parameter 0. One float = one 32-bit root constant.
- **Observable:** `InitAsConstants(1 value, register b0)` as root parameter 1, `SetGraphicsRoot32BitConstants(1, 1, …, 0)` with `mixValue = m_mixValue` (0.5), `cbuffer MixConstants : register(b0)`, `lerp(…, mixValue)`. Half container, half face: the faces are much stronger – face centres (300, 225) etc. ≈ (174, 136, 34), hearts e.g. (254, 237) ≈ (183, 63, 56); between the faces (400, 300) ≈ (46, 29, 14).

## mix-keys
- **Task:** Let Up/Down change the mix value: a public `void OnKeyDown(UINT8 key);` that adds 0.1 for `VK_UP` (at most 1.0) and subtracts 0.1 for `VK_DOWN` (at least 0.0); in `wWinMain` after creating the app `SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(&app));`; in `WindowProc` get it back with `GetWindowLongPtr(hWnd, GWLP_USERDATA)` and pass every key except Escape to `pApp->OnKeyDown(static_cast<UINT8>(wParam))`.
- **Hint:** Like the samples' `Win32Application`, which keeps the sample's pointer in the window's user data. `WM_KEYDOWN` repeats while a key is held. The value goes to the GPU every frame through the root constant.
- **Observable:** `OnKeyDown` with `VK_UP`/`VK_DOWN` and the clamps; `SetWindowLongPtr(…GWLP_USERDATA…)`, `GetWindowLongPtr`, `pApp->OnKeyDown`. At start the picture is the same as after `mix-value` (0.5). Each Up press moves 0.1 towards the faces (1.0: only the faces, their transparent parts black; e.g. (400, 300) ≈ (0, 0, 0) at 1.0), each Down press 0.1 towards the crate (0.0: only the crate as in `repeat`'s top left quarter and edges, e.g. (400, 300) ≈ (92, 58, 28)). Escape still closes the window.
