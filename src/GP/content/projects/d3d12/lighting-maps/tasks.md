# lighting-maps – DirectX 12

learnopengl.com "Lighting maps": `lighting_maps_diffuse.cpp` (4.1), `lighting_maps_specular.cpp` (4.2) and exercise 4
(`lighting_maps_exercise4`, the emission map). Files: `main.cpp`, `lighting_maps.hlsl`, `light_cube.hlsl`, and the
course's own images `container2.png` (wooden planks in a steel frame – the diffuse map), `container2_specular.png`
(steel bright, wood dark – the specular map), `matrix.png` (green glyphs on black – the emission map). learnopengl's
`container2.png`/`matrix.jpg` are not used.

Start (prepared from the Materials solution): the lit object's shaders are renamed to `lighting_maps.hlsl` (the
Materials shaders), the light back to learnopengl's fixed values (`light.ambient` 0.2, `light.diffuse` 0.5,
`light.specular` 1.0 – no changing colour), material still coral (ambient/diffuse (1, 0.5, 0.31), specular 0.5,
shininess 32). New in the start:
- `#define STB_IMAGE_IMPLEMENTATION` + `#include <stb_image.h>` (as in the Textures chapter) and `<string>`;
- `struct Vertex { XMFLOAT3 position; XMFLOAT3 normal; XMFLOAT2 texCoord; }` with learnopengl's 36 vertices with
  **position + normal + texture coordinates** – the texture coordinates with v flipped (`1 - v`), because Direct3D's
  v = 0 is the image's top row and the images are loaded without a flip (as in the Textures chapter), so they appear
  upright; the input layout still has only `POSITION` and `NORMAL` (TODO for the texture coordinates);
- learnopengl's utility `loadTexture` as a member function at the end of the file: `void LoadTexture(const char*
  path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)` – the Textures
  chapter's steps in one place: `stbi_load(path, …, 4)` (RGBA), a `DXGI_FORMAT_R8G8B8A8_UNORM` texture with one mip
  level in a default heap, an upload buffer (`GetRequiredIntermediateSize`), `UpdateSubresources` into the command
  list, the barrier to `PIXEL_SHADER_RESOURCE`, and the SRV in slot `descriptorIndex` of the CBV/SRV heap. The command
  list is still open there and executed at the end of `LoadAssets`, which waits for the GPU – so the upload buffers
  (kept in locals of `LoadAssets`) live long enough.
- TODOs: the texture coordinate element, loading the textures (after the vertex buffer), and root parameter 2 in
  `PopulateCommandList`.

Heap and root signature as the textures come in: CBV/SRV heap slot 0 = the CBV, slots 1, 2, 3 = the SRVs of the
diffuse, specular and emission maps; root parameter 2 = a descriptor table with one SRV range starting at t0 (1, then
2, then 3 descriptors), visible to the pixel shader, pointing at slot 1; a static sampler s0 (linear, wrap) as in the
Textures chapter. The images are loaded in register order (t0, t1, t2). Textures cannot be members of a cbuffer, so the
HLSL `Material` keeps only the numbers (`specular`, `shininess`, at the end only `shininess`), and the maps are
`Texture2D` globals – learnopengl's `material.diffuse` sampler becomes `diffuseMap`.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing depends on time). D3D12
cannot run here: the colours come from a software model of this code (the app's simulator: bilinear filtering, one mip
level as in the code, the real PNGs) and agree with OpenGL's Mesa screenshots of the same steps, except a few units at
fine texture detail – OpenGL uses mipmaps, the D3D12 code one level. Named points: **front** (302,370) = centre of the
front face (wood once textured), **front-lower-right** (331,415) (wood), **frame** (243,278) = steel frame at the
upper-left corner of the front face, where the specular highlight is, **plank** (253,291) = wood right next to it,
**left** (163,370) = centre of the left face (wood, only ambient), **lamp** (641,195) = 255,255,255 in every step,
**background** (400,300) and (100,100) = 26,26,26.

Start picture (= Materials after `light`): a coral cube – front ≈ 141,71,45, frame/highlight ≈ 233,165,140, plank ≈
216,148,123, left ≈ 51,26,16.

## texcoords
- **Task:** Pass the texture coordinates on: a `TEXCOORD` element in the input layout (2 floats at byte offset 24, after the normal), a third input `float2 texCoord : TEXCOORD` of `VSMain`, `float2 texCoord : TEXCOORD;` in `PSInput`, and `result.texCoord = texCoord;`.
- **Hint:** `{ "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }` – 3 + 3 floats come before it, 24 bytes.
- **When done:** `main.cpp`: the input layout's third element `{ "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24,
  D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`. `lighting_maps.hlsl`: `float2 texCoord : TEXCOORD;` in `PSInput`,
  `VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)`, `result.texCoord =
  texCoord;`. **No visible change** (coral cube).

## diffuse-map
- **Task:** Make the material's diffuse colour a texture: in `lighting_maps.hlsl` a `Texture2D diffuseMap : register(t0);` and `SamplerState wrapSampler : register(s0);`, `Material` without `ambient` and `diffuse`, and the ambient and diffuse colour from `diffuseMap.Sample(wrapSampler, input.texCoord).rgb`; in `main.cpp` the same `Material` (`XMFLOAT3 specular; float shininess;`), a member `m_diffuseMap`, `container2.png` loaded with `LoadTexture` into heap slot 1 (the heap gets 2 descriptors), root parameter 2 (a table with 1 SRV at t0, pixel shader) and the static sampler in the root signature, the table set in `PopulateCommandList`, and shininess 64.
- **Hint:** `float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;` and `float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;`. Root signature: `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);`, `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);`, the sampler description of the Textures chapter and `rootSignatureDesc.Init(…, _countof(samplers), samplers, …)`. Loading: `ComPtr<ID3D12Resource> diffuseMapUploadHeap; LoadTexture("container2.png", m_diffuseMap, diffuseMapUploadHeap, 1);`. Drawing: `CD3DX12_GPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize); m_commandList->SetGraphicsRootDescriptorTable(2, srvHandle);`
- **When done:** `lighting_maps.hlsl`: `Texture2D diffuseMap : register(t0);`, `SamplerState wrapSampler :
  register(s0);`, `struct Material { float3 specular; float shininess; };`, ambient and diffuse use
  `diffuseMap.Sample(wrapSampler, input.texCoord).rgb`. `main.cpp`: `struct Material { XMFLOAT3 specular; float
  shininess; };`; `ComPtr<ID3D12Resource> m_diffuseMap;`; `cbvSrvHeapDesc.NumDescriptors = 2`; `CD3DX12_DESCRIPTOR_RANGE
  ranges[2]` with `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`; `CD3DX12_ROOT_PARAMETER rootParameters[3]`
  with `rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`; `D3D12_STATIC_SAMPLER_DESC
  samplers[1]` (linear, wrap, register 0, pixel) passed to `rootSignatureDesc.Init`; `LoadTexture("container2.png",
  m_diffuseMap, diffuseMapUploadHeap, 1);`; in `OnUpdate` no `material.ambient`/`material.diffuse`,
  `material.specular` (0.5, 0.5, 0.5) stays, `material.shininess = 64.0f`; in `PopulateCommandList`
  `SetGraphicsRootDescriptorTable(2, srvHandle)` with the handle of slot 1. The cube is a **wooden crate in a steel
  frame**, lit like before: front (wood) ≈ 82,54,28, front-lower-right ≈ 73,48,25, left (wood, ambient only) ≈
  30,20,10; the highlight is grey-white on steel and wood alike: frame ≈ 181,182,185, plank ≈ 125,102,83.

## specular-map
- **Task:** Make the specular strength a texture too: `Texture2D specularMap : register(t1);`, `specular = light.specular * spec * specularMap.Sample(wrapSampler, input.texCoord).rgb`, `Material` keeps only `shininess`; load `container2_specular.png` into heap slot 2 (`m_specularMap`, 3 descriptors), and the SRV range gets 2 descriptors (t0, t1).
- **Hint:** The C++ `Material` is now `{ float shininess; float padding0[3]; }`: HLSL starts the next member (`Light light`, a struct) in a new 16-byte row, so the C++ struct must fill the row. Remove `material.specular` from `OnUpdate`. The table of root parameter 2 already starts at slot 1, so it now covers slots 1 and 2.
- **When done:** `lighting_maps.hlsl`: `Texture2D specularMap : register(t1);`, `struct Material { float shininess; };`,
  the specular term of the task. `main.cpp`: `struct Material { float shininess; float padding0[3]; };`,
  `ComPtr<ID3D12Resource> m_specularMap;`, `NumDescriptors = 3`, `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2,
  0)`, `LoadTexture("container2_specular.png", m_specularMap, specularMapUploadHeap, 2);` after the diffuse map, no
  `material.specular` in `OnUpdate`. **Only the steel shines**: frame 181,182,185 → **255,255,255** (bright white),
  plank 125,102,83 → **81,59,39** (the wood lost its highlight); front ≈ 82,54,28, left ≈ 30,20,10 unchanged.
  (= learnopengl's `lighting_maps_specular.cpp`.)

## emission
- **Task:** Exercise: add an emission map – `Texture2D emissionMap : register(t2);`, `emission = emissionMap.Sample(wrapSampler, input.texCoord).rgb` added to the result; load `matrix.png` into heap slot 3 (`m_emissionMap`, 4 descriptors), the SRV range gets 3 descriptors.
- **Hint:** Emitted light does not depend on any light source: `float3 result = ambient + diffuse + specular + emission;`. `LoadTexture("matrix.png", m_emissionMap, emissionMapUploadHeap, 3);`
- **When done:** `lighting_maps.hlsl`: `Texture2D emissionMap : register(t2);`, `// emission` `float3 emission =
  emissionMap.Sample(wrapSampler, input.texCoord).rgb;`, `float3 result = ambient + diffuse + specular + emission;`.
  `main.cpp`: `ComPtr<ID3D12Resource> m_emissionMap;`, `NumDescriptors = 4`, `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV,
  3, 0)`, `LoadTexture("matrix.png", m_emissionMap, emissionMapUploadHeap, 3);`. **Green glyphs glow** on both visible
  faces, even on the unlit left face: front (302,370) ≈ 82,207,74, left (163,370) ≈ 30,190,61, plank (253,291) ≈
  81,255,111; between the glyphs the crate is unchanged, e.g. (271,320) ≈ 73,49,26 and frame (243,278) 255,255,255.
  Final state.

Optional exercises of the chapter (not tasks): set the light's ambient/diffuse/specular to other values; invert the
specular map in the shader (`1.0f - specularMap.Sample(…).rgb`: the wood shines, the steel not); a coloured specular
map. The next chapter starts without the emission map.
