# Exam: Model Loading

Show what you've learned in *Model Loading*: model files and Assimp's data structure, meshes and their buffers, and
loading, texturing and lighting a whole model. The questions cover the whole part, some of them for {{api}} in
particular. Answer all of them and press **Submit answers**; you need 80 % right to pass, and you can take the exam
again.

```quiz
What is a mesh, in the sense of this part?
- [ ] A whole model file with all its objects
- [ ] The list of materials of a model
- [ ] A single triangle of a model
- [x] The smallest unit drawn with one set of textures: its vertices, its indices and its textures
---
A model consists of one or more meshes. The planet and its ring need different textures, so they are two meshes of one model.
```

```quiz
In Assimp's data structure, where is the vertex data of the meshes that belong to an `aiNode`?
- [ ] In the materials, one mesh per material
- [ ] In the node itself: each node owns its `aiMesh` objects
- [x] In the scene's `mMeshes` array; the node only holds the indices of its meshes in that array
- [ ] In the root node, which holds every mesh of the model
---
The scene owns all meshes and all materials. Nodes only organize them – which meshes belong together, and which parts are children of which.
```

:::opengl
```quiz
`Vertex` is `{ glm::vec3 Position; glm::vec3 Normal; glm::vec2 TexCoords; }`. How does `setupMesh()` describe the normal attribute?
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`
- [ ] `glVertexAttribPointer(1, 8, GL_FLOAT, GL_FALSE, 0, (void*)offsetof(Vertex, Normal));`
- [x] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)sizeof(Vertex));`
---
The stride is the size of a whole vertex, because the attributes are interleaved; the offset is where the normal starts within it – 12 bytes, which `offsetof` works out for you.
```
:::
:::vulkan
```quiz
`Vertex` has a member `uint32_t materialIndex`. How is it described to the pipeline and declared in the vertex shader?
- [ ] A descriptor binding, one per material
- [ ] A push constant, because integers can't be vertex attributes
- [x] An attribute with `VK_FORMAT_R32_UINT` at `offsetof(Vertex, materialIndex)`, and `layout(location = 3) in uint inMaterialIndex;`
- [ ] An attribute with `VK_FORMAT_R32_SFLOAT`, and `in float inMaterialIndex;` – every attribute is a float
---
Integer attributes have integer formats and integer types in the shader. A float format would convert the bits as a number, and the shader would get a different value.
```
:::
:::d3d12
```quiz
`Vertex` is `{ XMFLOAT3 position; XMFLOAT3 normal; XMFLOAT2 texCoord; }`. Which byte offsets must the input layout give its elements?
- [x] POSITION 0, NORMAL 12, TEXCOORD 24
- [ ] All 0: each element is read from its own buffer
- [ ] POSITION 0, NORMAL 16, TEXCOORD 32 – every element starts at a multiple of 16 bytes
- [ ] POSITION 0, NORMAL 1, TEXCOORD 2 – the number of the member
---
The members lie one after the other in memory: two `XMFLOAT3`s of 12 bytes each, then the `XMFLOAT2`. The vertex buffer view's stride is `sizeof(Vertex)`, 32 bytes.
```
:::

```quiz
Why can a `std::vector<Vertex>` be copied into a vertex buffer as it is?
- [x] The members of a struct lie one after the other in memory, so the vector's data is exactly the interleaved bytes the vertex buffer needs
- [ ] Because the GPU understands C++ structs
- [ ] Because `std::vector` converts its elements to floats when it is copied
- [ ] It can't: every attribute must be copied into a buffer of its own
---
`vertices.data()` (or `&vertices[0]`) points at the first vertex, and the next one follows right after it. The attribute descriptions say where each member lies within a vertex.
```

:::opengl
```quiz
A mesh has the textures, in this order: two of type `"texture_diffuse"` and one of type `"texture_specular"`. Which samplers does `Mesh::Draw` point at texture units 0, 1 and 2?
- [x] `texture_diffuse1`, `texture_diffuse2`, `texture_specular1`
- [ ] `texture_diffuse0`, `texture_diffuse1`, `texture_specular0`
- [ ] `texture_diffuse`, `texture_diffuse`, `texture_specular`
- [ ] `texture_diffuse1`, `texture_diffuse2`, `texture_specular3`
---
Each type counts its own textures from 1 (`diffuseNr`, `specularNr`), and texture `i` goes to unit `i`. The shader declares the samplers it uses by those names.
```
:::
:::vulkan
```quiz
Why did the *Mesh* chapter fill `vertices` and `indices` with a test square, before any model was loaded?
- [x] Because Vulkan cannot create a buffer of size 0, and the vertex and index buffers were created before there was a model to fill them
- [ ] Because tinyobjloader needs a mesh to start from
- [ ] Because `vkCmdDrawIndexed` needs exactly six indices to be valid
- [ ] So that the staging buffer could be tested without a texture
---
A buffer's size must be greater than 0. With the square every state of the project could build and run; the *Model* chapter replaced it with the planet's vertices, filled by `loadModel()` before the buffers are created.
```
:::
:::d3d12
```quiz
A mesh has a diffuse texture but no specular texture. What does `SetupMesh` put into its second SRV slot (`t1`), and what does the shader read there?
- [x] A null SRV – `CreateShaderResourceView` with no resource – and the shader reads zero: no highlight
- [ ] A copy of the diffuse texture's view
- [ ] Creating the mesh fails: every mesh must have both textures
- [ ] Nothing: the slot is skipped and `t1` reads the next mesh's diffuse map
---
A null descriptor is valid in a descriptor table and reads as zeros. With a black specular map the specular term is zero, so the mesh simply doesn't shine.
```
:::

```quiz
`planet.mtl` contains `map_Kd planet_diffuse.png`. What does that line say?
- [ ] `planet_diffuse.png` must be loaded with the colour key K
- [x] The material's diffuse colour comes from the texture `planet_diffuse.png`
- [ ] The model file is `planet_diffuse.png`
- [ ] The material's specular map is `planet_diffuse.png`
---
`Kd` is the diffuse colour and `Ks` the specular colour in MTL; the `map_` lines give the textures for them. `map_Ks` names the specular map.
```

```quiz
A model's faces have four corners each. Why do the loaders turn them into triangles first (`aiProcess_Triangulate`, and tinyobjloader by default)?
- [ ] Because a quad can't have texture coordinates
- [x] Because our draw calls draw triangle lists: three indices per triangle
- [ ] Because normals can only be computed for triangles
- [ ] To make the model smaller on disk
---
GPUs draw points, lines and triangles. A face with four or more corners has to be split into triangles before its indices can go into an index buffer for a triangle list.
```

```quiz
Why does learnopengl's model loader walk through the node tree recursively instead of simply looping over all of the scene's meshes?
- [ ] Because a loop over `mMeshes` would miss the meshes of child nodes
- [ ] Because Assimp frees each node after it has been visited
- [x] The nodes keep the parent-child relations of the model's parts, for example a car's wheels that should move with the car; walking the tree keeps that structure usable
- [ ] Because recursion loads the meshes in parallel
---
For our planet both ways give the same two meshes. The tree matters when the model's structure is used – moving or animating a part together with everything attached to it.
```

:::opengl
```quiz
Two meshes of a model use the same image file. What does `loadMaterialTextures` do for the second one?
- [ ] It merges the two meshes into one
- [x] It finds the path in `textures_loaded` and reuses that `Texture` – the file is loaded only once
- [ ] It throws an error: a file may be used by one mesh only
- [ ] It loads the file again, because each mesh needs its own texture object
---
The cache compares paths with `std::strcmp`. A texture object can be bound for any number of draws, so the meshes can share it.
```
:::
:::vulkan
```quiz
`loadModel()` adds a vertex to `vertices` only if `uniqueVertices` doesn't contain it yet. What does that achieve for `planet.obj`?
- [ ] The vertices end up sorted by material
- [x] Vertices shared by several triangles are stored once: 657 vertices instead of 3168, reused through the index buffer
- [ ] Nothing, because no two corners of an OBJ file are ever equal
- [ ] It removes triangles that face away from the camera
---
The `unordered_map` needs `operator==` and `std::hash<Vertex>` – which is why the *Mesh* chapter gave `Vertex` both. Two corners are the same vertex only if position, normal, texture coordinate and material are all equal.
```
:::
:::d3d12
```quiz
`TextureFromFile` records the copy of a texture's pixels from an upload buffer. When may that upload buffer be released?
- [ ] As soon as `TextureFromFile` returns
- [ ] Never: the texture keeps reading from it
- [x] After the command list with the copies has executed: in `LoadAssets`, after `WaitForPreviousFrame()`
- [ ] At the end of `Model::Load`
---
Recording a copy doesn't perform it. Only when the GPU has executed the command list – which the fence wait confirms – do the textures hold their pixels.
```
:::

```quiz
`planet.obj` counts v from the bottom of the image, and stb_image delivers the top row first. learnopengl's `model_loading.cpp` flips both the coordinates (`aiProcess_FlipUVs`) and the image (`stbi_set_flip_vertically_on_load(true)`). What happens to our planet if you do the same?
- [ ] It's upright: two flips are needed for every OBJ file
- [ ] Nothing is drawn, because the coordinates are out of range
- [x] The texture is upside down: the two flips cancel out, and our file needs exactly one
- [ ] The texture is mirrored left to right
---
Each flip turns the texture upside down. learnopengl's backpack has its coordinates stored the other way round, so it needs both; our planet needs one.
```

:::opengl
```quiz
The fragment shader samples only `texture_diffuse1`, yet the planet shows `planet_diffuse.png` and the ring `rings.png`. Why?
- [ ] The vertices carry the number of their texture
- [ ] `texture_diffuse1` is an array with both textures
- [ ] The shader is compiled once per mesh
- [x] Each mesh is drawn with its own `glDrawElements`, and before it `Mesh::Draw` binds that mesh's textures and points `texture_diffuse1` at its diffuse map
---
`Model::Draw` calls `Mesh::Draw` for each mesh. The sampler's name stays the same; the texture bound to its unit changes between the draws.
```
:::
:::vulkan
```quiz
The whole model is one `vkCmdDrawIndexed`. How does a fragment of the ring get the colour of `rings.png`?
- [ ] The ring's texture coordinates select the second binding
- [x] Its vertices carry material index 1, passed on as a `flat` output; the fragment shader samples both diffuse maps and keeps the ring's
- [ ] The descriptor set is switched in the middle of the draw
- [ ] Vulkan draws each shape of the OBJ file separately
---
Both textures are bound all the time, at bindings 1 and 2. Sampling both before choosing keeps the level of detail correct on the border between the materials.
```
:::
:::d3d12
```quiz
The pixel shader samples only `texture_diffuse1` (`t0`), yet the planet shows `planet_diffuse.png` and the ring `rings.png`. Why?
- [ ] The static sampler chooses the texture by the mesh
- [ ] The vertices carry the number of their texture
- [x] Each mesh is drawn on its own, and `Mesh::Draw` first sets root parameter 2 to that mesh's own SRVs, so `t0` is a different texture in each draw
- [ ] `t0` is an array with both textures
---
`SetGraphicsRootDescriptorTable(2, m_srvHandle)` points the table at the mesh's two heap slots. The register stays the same; the descriptors it reads change between the draws.
```
:::

```quiz
`planet.mtl` names the texture `planet_diffuse.png`, and the model is `models/planet.obj`. Which file does the loader have to open?
- [ ] Whatever file the `.obj` file contains: the textures are stored inside it
- [ ] `models/planet.obj/planet_diffuse.png`
- [x] `models/planet_diffuse.png`: texture names in a material file are relative to the model file
- [ ] `planet_diffuse.png`, in the program's folder
---
That's why learnopengl's loader keeps the model's `directory` and puts it in front of each texture's name. Models with absolute texture paths often don't work on another machine.
```

:::opengl
```quiz
`Mesh::setupMesh()` uploads `indices`, a `std::vector<unsigned int>`. What must `glDrawElements` be told?
- [ ] `GL_UNSIGNED_SHORT`, because indices are always 16-bit
- [ ] Nothing: OpenGL detects the index type from the buffer
- [ ] `GL_FLOAT`, like the vertex data
- [x] `GL_UNSIGNED_INT` – the indices are 32-bit, so a model can have more than 65 536 vertices
---
The type tells OpenGL how to read the bytes of the element buffer. It must match what was uploaded.
```
:::
:::vulkan
```quiz
`indices` is a `std::vector<uint32_t>`. What must `recordCommandBuffer()` pass to `vkCmdBindIndexBuffer`?
- [ ] `VK_INDEX_TYPE_UINT16`, because index buffers are always 16-bit
- [ ] `VK_FORMAT_R32_UINT`, like the material index attribute
- [x] `VK_INDEX_TYPE_UINT32` – the indices are 32-bit, so a model can have more than 65 536 vertices
- [ ] Nothing: Vulkan detects the index type from the buffer
---
The type tells the GPU how to read the bytes of the index buffer. It must match what was uploaded.
```
:::
:::d3d12
```quiz
`indices` is a `std::vector<UINT>`. What must the mesh's `D3D12_INDEX_BUFFER_VIEW` say?
- [ ] Nothing: Direct3D detects the index type from the buffer
- [ ] `StrideInBytes = sizeof(Vertex)`
- [x] `Format = DXGI_FORMAT_R32_UINT` – the indices are 32-bit, so a model can have more than 65 536 vertices
- [ ] `Format = DXGI_FORMAT_R16_UINT`, because index buffers are always 16-bit
---
The format tells the GPU how to read the bytes of the index buffer. It must match what was uploaded.
```
:::

```quiz
The lit planet shows only a faint highlight where the light is reflected towards the camera. What is the reason?
- [ ] The light has no specular component
- [ ] Models loaded from files can't have specular lighting
- [x] The reflection falls on land, and the planet's specular map is dark on land and bright on the oceans
- [ ] A shininess of 32 never shows a highlight
---
The specular term is multiplied by the specular map. Move the camera so that the reflection lands on water, and the highlight becomes bright.
```
