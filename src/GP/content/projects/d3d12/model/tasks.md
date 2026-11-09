# model – DirectX 12

learnopengl.com "Model": a port of learnopengl's `model.h` (class `Model` with Assimp) into `main.cpp`, then the model
loaded and drawn – learnopengl's `model_loading.cpp` scene with the course's planet. Files: `main.cpp`,
`model_loading.hlsl`, read-only `models/` (`planet.obj` – objects `planet` and `rings` –, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`).

Start = the Mesh chapter's solution plus, prepared:
- `#include <assimp/Importer.hpp>`, `<assimp/scene.h>`, `<assimp/postprocess.h>` (comment: add Assimp's include folder
  and library, e.g. `vcpkg install assimp`);
- `class Model` (after `class Mesh`) with learnopengl's members `textures_loaded`, `meshes`, `directory`, plus
  `uploadHeaps` (the textures' upload buffers, alive until the command list has executed); `void Load(std::string
  const& path, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ID3D12DescriptorHeap* srvHeap, UINT
  firstDescriptor)` (learnopengl's constructor: keeps the D3D objects, then `loadModel(path)`); `void
  Draw(ID3D12GraphicsCommandList* commandList)` (calls every mesh's `Draw`); private `loadModel`, `processNode`,
  `processMesh`, `loadMaterialTextures` with TODO bodies; `processMesh` already has the "data to fill" vectors and its
  end: the mesh's two heap slots (`m_nextDescriptor`, checked against the heap's size, `+= 2`) and `return
  Mesh(vertices, indices, textures, m_device, srvCpuHandle, srvGpuHandle);`;
- `ComPtr<ID3D12Resource> TextureFromFile(const char* path, const std::string& directory, ID3D12Device*,
  ID3D12GraphicsCommandList*, ComPtr<ID3D12Resource>& uploadHeap)` (learnopengl's TextureFromFile = the earlier
  chapters' `LoadTexture` without the view): `stbi_load(directory + '/' + path, …, 4)`, an R8G8B8A8 texture in a default
  heap, `UpdateSubresources` from an upload buffer, barrier to PIXEL_SHADER_RESOURCE;
- TODOs in `D3D12App`: the member, loading in `LoadAssets`, freeing the upload buffers after the wait, drawing in
  `PopulateCommandList`.

Texture orientation: `aiProcess_FlipUVs` (learnopengl's flags) and stb_image **without** a flip: D3D12's v = 0 is the
image's top row, so flipping v once (in Assimp) makes the planet upright – white pole at the top. (learnopengl's
OpenGL flips twice: FlipUVs and stbi_set_flip_vertically_on_load.) `aiProcess_ConvertToLeftHanded` is not used: the RH
maths matches learnopengl.

Pixels: 800×600 client area from the top left, time 1 s (nothing depends on time). D3D12 cannot run here: the colours
come from the app's simulator (the real OBJ and PNGs, bilinear, one mip level), with two simulator gaps patched in a
local copy (see the note at the end). Named points: **background** (100,100) and (400,500); **centre** (400,300) =
land on the planet; **pole** (400,186) = the white north polar cap; **ocean** (375,215) = the ocean at the upper left;
**ocean-right** (437,220); **limb** (290,300) = ocean at the planet's left edge; **planet-right** (505,300) = land;
**spot** (435,270) = land right of the centre, where the specular highlight appears in the lighting step; **ring-front**
(400,430), **ring-left** (160,330), **ring-right** (640,330) = the ring's beige bands.

Start picture: background only (13,13,13 everywhere) – the model is neither loaded nor drawn.

## load-model
- **Task:** Fill `loadModel`: read the file with an `Assimp::Importer` (`ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace)`), throw if it failed, keep the file's directory and process the root node.
- **Hint:** The check is learnopengl's `if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode)`; throw `std::runtime_error(std::string("ERROR::ASSIMP:: ") + importer.GetErrorString())`. `directory = path.substr(0, path.find_last_of('/'));` then `processNode(scene->mRootNode, scene);`.
- **When done:** `loadModel` contains `Assimp::Importer importer;`, `const aiScene* scene = importer.ReadFile(path,
  aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);`, the check
  with `AI_SCENE_FLAGS_INCOMPLETE` and `throw std::runtime_error(… importer.GetErrorString())`, `directory =
  path.substr(0, path.find_last_of('/'));`, `processNode(scene->mRootNode, scene);`. No visible change (nothing calls
  `Load` yet).

## process-node
- **Task:** Fill `processNode`: for each of the node's meshes, `meshes.push_back(processMesh(scene->mMeshes[node->mMeshes[i]], scene))`; then call `processNode` for each child.
- **Hint:** Two loops: `for (UINT i = 0; i < node->mNumMeshes; i++)` and `for (UINT i = 0; i < node->mNumChildren; i++) processNode(node->mChildren[i], scene);`.
- **When done:** `processNode` contains `aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];`,
  `meshes.push_back(processMesh(mesh, scene));` in a loop to `node->mNumMeshes`, and `processNode(node->mChildren[i],
  scene);` in a loop to `node->mNumChildren`. No visible change.

## process-mesh
- **Task:** In `processMesh`, fill `vertices` (position, normal, texture coordinates of each of the mesh's `mNumVertices` vertices) and `indices` (the indices of each face).
- **Hint:** `vertex.position = XMFLOAT3(mesh->mVertices[i].x, mesh->mVertices[i].y, mesh->mVertices[i].z);`, the normal from `mesh->mNormals[i]` if `mesh->HasNormals()`, the texture coordinates from `mesh->mTextureCoords[0][i]` if `mesh->mTextureCoords[0]` (else 0, 0); faces: `aiFace face = mesh->mFaces[i];` and `indices.push_back(face.mIndices[j]);`.
- **When done:** `processMesh` contains a loop `for (UINT i = 0; i < mesh->mNumVertices; i++)` with `Vertex vertex;`,
  `vertex.position = XMFLOAT3(mesh->mVertices[i].x, …)`, `if (mesh->HasNormals()) vertex.normal = XMFLOAT3(mesh->mNormals[i].x,
  …)`, `if (mesh->mTextureCoords[0]) … vertex.texCoord = XMFLOAT2(mesh->mTextureCoords[0][i].x,
  mesh->mTextureCoords[0][i].y);`, `vertices.push_back(vertex);`, and a loop over `mesh->mNumFaces` with `aiFace face =
  mesh->mFaces[i];` and `indices.push_back(face.mIndices[j]);`. No visible change.

## material-textures
- **Task:** Load the mesh's textures: in `processMesh` get its `aiMaterial` and append `loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse")` and `loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular")` to `textures`; fill `loadMaterialTextures` with learnopengl's loop and the `textures_loaded` cache, loading new files with `TextureFromFile`.
- **Hint:** `mat->GetTexture(type, i, &str);` gives the file name; compare it with `textures_loaded[j].path` (`std::strcmp`). A new texture: `texture.resource = TextureFromFile(str.C_Str(), directory, m_device, m_commandList, uploadHeap);`, set `type` and `path`, push it to `textures` and `textures_loaded`, and keep `uploadHeap` in `uploadHeaps`.
- **When done:** `processMesh` contains `aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];`,
  `loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse")`,
  `loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular")` and two `textures.insert(textures.end(),
  …)`. `loadMaterialTextures` contains `for (UINT i = 0; i < mat->GetTextureCount(type); i++)`, `aiString str;`,
  `mat->GetTexture(type, i, &str);`, the `textures_loaded` search with `std::strcmp(textures_loaded[j].path.data(),
  str.C_Str()) == 0`, `texture.resource = TextureFromFile(str.C_Str(), directory, m_device, m_commandList,
  uploadHeap);`, `texture.type = typeName;`, `texture.path = str.C_Str();`, `textures.push_back(texture);`,
  `textures_loaded.push_back(texture);`, `uploadHeaps.push_back(uploadHeap);`. No visible change.

## draw-model
- **Task:** Use the class: a member `Model m_model;` in `D3D12App`, `m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);` in `LoadAssets` (while the command list is open), `m_model.uploadHeaps.clear();` after `WaitForPreviousFrame()` there, and `m_model.Draw(m_commandList.Get());` in `PopulateCommandList` after the model matrix.
- **Hint:** The last argument is the first free slot of the CBV/SRV heap: slot 0 holds the CBV. The textures' copies are recorded in the command list that `LoadAssets` executes and waits for – only after that wait may their upload buffers go.
- **When done:** `Model m_model;` in `D3D12App`; in `LoadAssets` `m_model.Load("models/planet.obj", m_device.Get(),
  m_commandList.Get(), m_cbvSrvHeap.Get(), 1);` (before `m_commandList->Close()`) and `m_model.uploadHeaps.clear();`
  after `WaitForPreviousFrame();`; in `PopulateCommandList` `m_model.Draw(m_commandList.Get());` after
  `SetGraphicsRoot32BitConstants(0, …)`. **The planet appears** (= learnopengl's model_loading.cpp, unlit diffuse
  texture): a textured sphere in the centre with the white polar cap at the top, the beige ring around it seen
  slightly from above (its near side passes in front of the planet's lower edge, its far side is hidden behind the planet). centre (400,300) ≈
  105,140,60 (green land), pole (400,186) ≈ 235,240,245, ocean (375,215) ≈ 28,70,150, ocean-right (437,220) and limb
  (290,300) ≈ 28,70,150, planet-right (505,300) ≈ 72,125,52, spot (435,270) ≈ 72,125,52, ring-front (400,430) ≈
  132,113,88, ring-left (160,330) ≈ 164,140,109, ring-right (640,330) ≈ 149,128,99, background (100,100) and
  (400,500) = 13,13,13.

## lighting
- **Task:** Exercise: light the model like the Lighting maps chapter – a point light at `lightPos` (1.2, 1.0, 2.0) with ambient 0.2, diffuse 0.5, specular 1.0, Phong with the diffuse map (`texture_diffuse1`) and the specular map (`texture_specular1`, t1), shininess 32, viewPos = cameraPos; the normals with the normal matrix.
- **Hint:** As in Lighting maps: `ModelConstants` gets `normalMatrix` (computed in `PopulateCommandList` as `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`, stored transposed); `SceneConstantBuffer` gets `viewPos` (+ padding), `Material material` (`shininess` + 3 floats of padding) and `Light light` (each XMFLOAT3 padded to 16 bytes); the vertex shader outputs `fragPos` and `normal`; no attenuation.
- **When done:** `model_loading.hlsl`: `float4x4 normalMatrix;` in `cbuffer ModelConstants`; `struct Material { float
  shininess; };`, `struct Light { float3 position; float3 ambient; float3 diffuse; float3 specular; };`, `cbuffer
  SceneConstantBuffer` with `float3 viewPos; Material material; Light light;`; `Texture2D texture_specular1 :
  register(t1);`; `PSInput` with `float3 fragPos : POSITION;` and `float3 normal : NORMAL;`; VSMain `float4 worldPos =
  mul(position, model);`, `result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;`; PSMain ambient + diffuse +
  specular with `texture_specular1.Sample(…)`. `main.cpp`: global `XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);`;
  `struct ModelConstants { XMFLOAT4X4 model; XMFLOAT4X4 normalMatrix; };` (32 root constants);
  `struct Material { float shininess; float padding0[3]; };`, `struct Light` (padded); `SceneConstantBuffer` with
  `XMFLOAT3 viewPos; float padding0; Material material; Light light;`; in `OnUpdate` `light.position = lightPos`,
  `XMStoreFloat3(&constantBufferData.viewPos, cameraPos)`, `light.ambient` (0.2, 0.2, 0.2), `light.diffuse` (0.5, 0.5,
  0.5), `light.specular` (1, 1, 1), `material.shininess = 32.0f`; in `PopulateCommandList` the normal matrix stored
  into `modelConstants.normalMatrix`. **The planet is lit from the upper right front**: brightest right of and above
  the centre, the left edge only ambient; overall darker than unlit (at most ambient 0.2 + diffuse 0.5 of the texture).
  centre (400,300) 105,140,60 → **57,76,33**; pole 235,240,245 → 120,123,125; ocean (375,215) → 15,37,80; ocean-right
  (437,220) → 19,47,101; limb (290,300) → **6,14,30** (ambient only: 0.2 × the ocean); planet-right (505,300) → 43,74,31;
  ring-front → 80,68,53, ring-left → 81,69,54, ring-right → 92,79,61 (the right part of the ring is brighter);
  background unchanged 13,13,13. The specular highlight (shininess 32) is a small spot around **spot (435,270) ≈
  67,102,54** (47,82,34 without the specular term): it falls on land, whose specular map is dark, so it is faint – the
  ocean areas in view (upper left, lower right) are outside it. Final state.

Optional (not tasks): learnopengl's Camera class (`camera.h`) instead of the globals; the material's shininess from the
.mtl (`Ns`: planet 32, rings 8 – `aiGetMaterialFloat`/`AI_MATKEY_SHININESS`); other models (several meshes share the
heap: raise `MaxMeshes`).

Simulator notes (gaps in the current D3D12 reader; the values above were measured with them patched in a local copy):
1. The build check's "no member named" rule for `->` calls rejects Assimp's methods `mesh->HasNormals()`,
   `mat->GetTextureCount(type)`, `mat->GetTexture(type, i, &str)` (learnopengl's code) – they must be allowed.
2. The reader takes the first `DrawIndexedInstanced` (inside `Mesh::Draw`) as the frame's draw: it reports
   `dxNoIndexBuffer` (the index data is a vector filled at run time) and would run `Draw` instead of
   `PopulateCommandList`. With a `Model` variable's `.Draw(…)` in `PopulateCommandList`, the frame must be recorded from
   `PopulateCommandList` and the index-data check skipped.
3. `tooFewTextures` warning: in a Model program the textures come from the .mtl, not from `stbi_load` calls with
   string literals, so the count check should be skipped.
