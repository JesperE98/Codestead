# Review: Model Loading

Congratulations on reaching the end of the *Model Loading* part. You started with an empty window and a model file,
and ended with a planet and its ring loaded from `planet.obj` – two meshes, two materials, four textures – drawn
textured and lit by your own shaders. From now on, the shapes you draw no longer have to be typed into arrays: an
artist can make them. This page is a glossary of the most important terms of the part, chapter by chapter, like the
review learnopengl.com has at the end of its sections. Use it to look things up, and as a check: if a definition
surprises you, go back to the chapter it comes from.

The terms outside the boxes are the same in every API: a model file, its meshes and its materials don't depend on the
API that draws them. The boxes say how {{api}} loads and draws them. When you're done, the exam at the end of the part
checks what you've learned.

## Assimp

- **Model**: a 3D object made by an artist in a modelling tool and exported to a file, with everything needed to
  draw it: vertex positions, normals, texture coordinates, how the vertices form faces, and the materials.
- **Model file formats**: Wavefront `.obj`, FBX, glTF, Collada and many more. Each stores the same kind of data in its
  own way.
- **OBJ and MTL**: our model's format. `planet.obj` lists positions (`v`), texture coordinates (`vt`), normals (`vn`)
  and faces (`f`), each corner of a face with its own indices into those three lists; `o` starts an object, `usemtl`
  chooses a material, and `mtllib planet.mtl` names the material file. In `planet.mtl`, `newmtl` starts a material,
  `map_Kd` names its diffuse map and `map_Ks` its specular map.
- **Assimp** (Open Asset Import Library): a library that reads dozens of model formats into one data structure, so
  the program needs only one way to process a model.
- **Scene** (`aiScene`): the root of Assimp's data. It owns all meshes (`mMeshes`) and all materials (`mMaterials`),
  and it has the **root node** (`mRootNode`).
- **Node** (`aiNode`): a part of the scene's hierarchy. It holds the **indices** of its meshes in the scene's
  `mMeshes` (not the meshes themselves) and its children (`mChildren`), so it keeps parent-child relations between
  parts of a model.
- **Mesh** (`aiMesh`): the vertex data of one part of the model – `mVertices` (the positions), `mNormals`,
  `mTextureCoords` – plus its **faces** and the index of its **material** (`mMaterialIndex`).
- **Face** (`aiFace`): one primitive of a mesh, with the indices of its vertices (`mIndices`); after triangulation
  always three.
- **Material** (`aiMaterial`): a mesh's surface: among other things the file names of its textures, per texture type
  (`aiTextureType_DIFFUSE`, `aiTextureType_SPECULAR`, …).

:::opengl
- **Building with Assimp**: Assimp is a compiled library, not a single header. The program includes
  `<assimp/Importer.hpp>`, `<assimp/scene.h>` and `<assimp/postprocess.h>` and is linked with `-lassimp`.
:::
:::vulkan
- **tinyobjloader**: the small header-only OBJ loader vulkan-tutorial.com uses, and the Vulkan program of this part.
  `#define TINYOBJLOADER_IMPLEMENTATION` in one source file compiles its code. Assimp would work just as well; for a
  single format the small library is enough.
- **`tinyobj::LoadObj`**: reads the `.obj` file (and the `.mtl` file from the folder given as its last argument) into
  `attrib` (all positions, normals and texture coordinates as flat `float` arrays), `shapes` (the objects, each with
  its faces as `tinyobj::index_t`s and a material number per face in `mesh.material_ids`) and `materials` (in the
  order of the `.mtl` file). It triangulates faces by default.
- **`tinyobj::index_t`**: one corner of a face: three separate indices, `vertex_index`, `normal_index` and
  `texcoord_index`.
:::
:::d3d12
- **Building with Assimp**: Assimp is a compiled library, not a single header. The program includes
  `<assimp/Importer.hpp>`, `<assimp/scene.h>` and `<assimp/postprocess.h>`; its include folder and library are added
  to the project, for example with vcpkg (`vcpkg install assimp`).
:::

## Mesh

- **Mesh**: the smallest unit drawn with one set of textures: its vertices, its indices and its textures. The ring
  needs other textures than the planet, so it is a mesh of its own.
- **Vertex struct**: everything a vertex of a model has – position, normal, texture coordinates – in one struct. The
  members of a struct lie one after the other in memory, so an array of `Vertex` is exactly the interleaved vertex
  buffer the GPU reads, and `offsetof` gives each attribute's byte offset.
- **Texture struct**: a texture of the mesh, its **type** (`"texture_diffuse"`, `"texture_specular"`) and the **path**
  it was loaded from.
- **Naming convention**: the shader names the mesh's textures by type and number – `texture_diffuse1`,
  `texture_specular1`, … – so the code that binds them knows which texture goes where.
- **32-bit indices**: a model can have more than 65 536 vertices, so the indices are 32-bit unsigned integers.

:::opengl
- **`Mesh` class**: `vertices`, `indices`, `textures` and the `VAO`; the constructor stores the data and calls
  `setupMesh()`.
- **`setupMesh()`**: creates the VAO, VBO and EBO, uploads the vertices and indices with `glBufferData`, and sets the
  three attribute pointers with the stride `sizeof(Vertex)` and the offsets `0`, `offsetof(Vertex, Normal)` and
  `offsetof(Vertex, TexCoords)`.
- **`Draw(Shader &shader)`**: binds each texture to its own texture unit (`glActiveTexture(GL_TEXTURE0 + i)`), points
  the sampler named by the convention at that unit (`glUniform1i(glGetUniformLocation(shader.ID, (name +
  number).c_str()), i)`), and draws with `glDrawElements(GL_TRIANGLES, …, GL_UNSIGNED_INT, 0)`.
:::
:::vulkan
- **No `Mesh` class**: the mesh's data lives in the application class: `std::vector<Vertex> vertices` and
  `std::vector<uint32_t> indices`, a vertex buffer and an index buffer.
- **`Vertex`**: `pos`, `normal`, `texCoord` and `materialIndex`, four attribute descriptions; the material index is an
  integer attribute, `VK_FORMAT_R32_UINT`, a `uint` in the shader.
- **`operator==` and `std::hash<Vertex>`**: make vertices comparable and hashable, so they can be keys of an
  `std::unordered_map` (glm's hashes need `GLM_ENABLE_EXPERIMENTAL` and `<glm/gtx/hash.hpp>`).
- **Staging buffers**: the vertices and indices are copied into host-visible staging buffers, and from there with
  `vkCmdCopyBuffer` into **device-local** vertex and index buffers, the fastest memory for the GPU to read.
- **Test mesh**: Vulkan cannot create a buffer of size 0, so the *Mesh* chapter drew a test square before any model
  was loaded.
- **Indexed draw**: `vkCmdBindIndexBuffer(…, VK_INDEX_TYPE_UINT32)` and `vkCmdDrawIndexed`.
:::
:::d3d12
- **`Mesh` class**: `vertices`, `indices`, `textures`, its vertex and index buffers and their views; the constructor
  also takes the device and the mesh's two slots in the CBV/SRV heap, and calls `SetupMesh`.
- **`SetupMesh`**: creates the vertex and index buffers in upload heaps, copies the data in, fills the
  `D3D12_VERTEX_BUFFER_VIEW` (`StrideInBytes = sizeof(Vertex)`) and the `D3D12_INDEX_BUFFER_VIEW`
  (`DXGI_FORMAT_R32_UINT`), and creates the mesh's two SRVs. The input layout (POSITION 0, NORMAL 12, TEXCOORD 24)
  matches `Vertex`.
- **A descriptor table per mesh**: each mesh owns two consecutive SRVs – its first diffuse texture (`t0`,
  `texture_diffuse1`) and its first specular texture (`t1`, `texture_specular1`). A missing texture gets a **null
  SRV**, which reads as zero.
- **`Draw`**: `SetGraphicsRootDescriptorTable(2, m_srvHandle)` for the mesh's textures, then `IASetVertexBuffers`,
  `IASetIndexBuffer` and `DrawIndexedInstanced`.
:::

## Model

- **Post-processing flags**: options that make the loader change the data while importing: `aiProcess_Triangulate`
  (every face becomes triangles), `aiProcess_GenSmoothNormals` (normals for models without them),
  `aiProcess_FlipUVs` (v becomes 1 − v), `aiProcess_CalcTangentSpace` (tangents for normal mapping, later),
  `aiProcess_JoinIdenticalVertices` (shared vertices instead of one per face corner).
- **Recursive node processing**: `processNode` turns the node's meshes into `Mesh` objects, then calls itself for each
  child. Walking the tree instead of looping over all meshes keeps the parent-child relations available.
- **Mesh processing**: copy each vertex's position, normal and first set of texture coordinates, then each face's
  indices, then load the material's textures.
- **Texture paths**: a material names its textures relative to the model file, so the loader puts the model's
  directory in front: `planet_diffuse.png` becomes `models/planet_diffuse.png`.
- **Texture cache** (`textures_loaded`): a texture that's already loaded – same path – is reused instead of loaded
  again.
- **Texture orientation**: OBJ counts v from the bottom of the image, stb_image delivers the top row first. Exactly
  **one** flip – of the coordinates or of the image – makes the model upright; two flips cancel out.
- **Lighting a model**: the same Phong lighting as in *Lighting maps*, with the diffuse and specular maps of each
  fragment's material. Our planet's specular map is bright on the oceans and dark on land, so the highlight shines
  only where it falls on water.

:::opengl
- **`Model` class**: `meshes`, `directory` and `textures_loaded`; the constructor calls `loadModel(path)`, and
  `Draw(shader)` calls each mesh's `Draw`.
- **`Model ourModel("models/planet.obj");`**: loaded once, before the render loop; `ourModel.Draw(ourShader);` after
  the model matrix is set.
- **`TextureFromFile`**: the lighting chapters' `loadTexture` with the directory in front of the file name.
- **One flip**: `aiProcess_FlipUVs` and **no** `stbi_set_flip_vertically_on_load(true)` – learnopengl's
  `model_loading.cpp` does both, which suits only its backpack.
- **Unused samplers**: `Mesh::Draw` sets `texture_specular1` even when the shader doesn't declare it;
  `glGetUniformLocation` returns −1 and `glUniform1i` ignores the call.
:::
:::vulkan
- **`loadModel()`**: one loop over all shapes and indices builds a `Vertex` per index – the position and normal looked
  up with `3 * index.vertex_index + …`, the texture coordinate with v flipped (`1.0f - …`), and the material of the
  face, `shape.mesh.material_ids[i / 3]`.
- **Vertex de-duplication**: `std::unordered_map<Vertex, uint32_t> uniqueVertices` stores each different vertex once;
  `planet.obj`'s 3168 indices use 657 vertices.
- **The materials' textures**: loaded from constants in binding order by `createTextures()`; each is a `Texture` (image,
  memory, view) and a combined image sampler at bindings 1–4 (binding 0 is the uniform buffer).
- **One draw call**: the whole model is one `vkCmdDrawIndexed`. The vertex shader passes the material index on as a
  **`flat`** output (integers can't be interpolated); the fragment shader samples every material's texture and keeps
  the one of the fragment's material – sampling outside an `if` keeps the level of detail correct.
:::
:::d3d12
- **`Model` class**: `meshes`, `directory`, `textures_loaded` and `uploadHeaps`; `Load(path, device, commandList,
  srvHeap, firstDescriptor)` does what learnopengl's constructor does, and `Draw(commandList)` calls each mesh's
  `Draw`.
- **Loading**: in `LoadAssets`, while the command list is open: `m_model.Load("models/planet.obj", …, 1)` – the heap's
  slot 0 is the CBV, so the meshes' SRVs start at slot 1. The heap has `1 + 2 * MaxMeshes` descriptors.
- **`TextureFromFile`**: the earlier `LoadTexture` without the view; it *records* the copy from an upload buffer.
- **Upload buffers**: they must live until the command list has executed – `m_model.uploadHeaps.clear()` comes after
  `WaitForPreviousFrame()`.
- **One flip**: `aiProcess_FlipUVs`, and stb_image without a flip: Direct3D's v = 0 is the image's top row.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Model loader | Assimp | tinyobjloader | Assimp |
| A mesh on the GPU | VAO, VBO and EBO per `Mesh` | one vertex and one index buffer for the whole model, device local | vertex and index buffer per `Mesh`, upload heaps |
| Index type | `GL_UNSIGNED_INT` | `VK_INDEX_TYPE_UINT32` | `DXGI_FORMAT_R32_UINT` |
| Draw calls | one `glDrawElements` per mesh | one `vkCmdDrawIndexed` | one `DrawIndexedInstanced` per mesh |
| A mesh's textures | texture units, samplers `texture_diffuseN` … | combined image samplers, bindings 1–4, chosen by the material index | two SRVs per mesh (`t0`, `t1`), table of root parameter 2 |
| Flipping v once | `aiProcess_FlipUVs` | `1.0f - v` in `loadModel()` | `aiProcess_FlipUVs` |
| Loading a file once | `textures_loaded` | one constant per file | `textures_loaded` |

With model loading done, the scenes you draw can be as detailed as the models you find – the next parts of
learnopengl.com build on exactly this.
