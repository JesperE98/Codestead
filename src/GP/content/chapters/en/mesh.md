# Mesh

With Assimp we can load many different models into the application, but once loaded they're all stored in Assimp's
data structures. What we eventually want is to transform that data to a format that {{api}} understands so that we
can render the objects. We learned from the previous chapter that a mesh represents a single drawable entity, so
let's start by defining a mesh of our own.

Let's review a bit of what we've learned so far to think about what a mesh should minimally have as its data. A mesh
should at least need a set of vertices, where each vertex contains a position vector, a normal vector, and a texture
coordinate vector. A mesh should also contain indices for indexed drawing, and material data in the form of textures
(diffuse/specular maps).

```quiz
What does a mesh minimally need, so that it can be drawn on its own?
- [ ] Only its vertex positions; normals and textures belong to the model
- [x] Its vertices (position, normal, texture coordinates), the indices of its triangles, and its material's textures (diffuse and specular maps)
- [ ] A node hierarchy, like Assimp's scene
---
Everything a draw of the mesh reads: the vertex attributes the shaders take in, the indices that form the triangles, and the lighting maps of its material. The hierarchy and the collection of meshes are the model's business – the next chapter.
```

:::opengl
Now that we set the minimal requirements for a mesh class we can define a vertex in OpenGL. The `// TODO:` comments in
`mesh.h` mark where the code goes; the file already has its include guard and includes (`glad`, `glm`,
`"shader_m.h"`, `<string>` and `<vector>`):

```cpp
struct Vertex {
    // position
    glm::vec3 Position;
    // normal
    glm::vec3 Normal;
    // texCoords
    glm::vec2 TexCoords;
};
```

We store each of the required vertex attributes in a struct called `Vertex`. Next to a `Vertex` struct we also want
to organize the texture data in a `Texture` struct:

```cpp
struct Texture {
    unsigned int id;
    std::string type; // e.g. "texture_diffuse" or "texture_specular"
    std::string path; // the file it was loaded from (to load every file only once)
};
```

We store the id of the texture and its type, e.g. a diffuse or specular texture. The `path` is the name of the file
the texture came from; learnopengl adds it in the *Model* chapter, where it lets the model load every image file only
once – we add it right away. (Unlike learnopengl's `mesh.h`, the code writes `std::vector` and `std::string` out: a
header shouldn't say `using namespace std;` for every file that includes it. The vertex has only what OpenGL 3.3 needs
here – learnopengl's tangents, bitangents and bone data belong to later chapters.)

Now do the first task, **vertex-struct**, and press **Build & run** (Ctrl+Enter). Nothing changes on the screen – and
nothing will in this chapter: like learnopengl's *Mesh* chapter, we only write the class here; the *Model* chapter
creates the meshes and draws them. Every step still compiles and runs.

Knowing the actual representation of a vertex and a texture we can start defining the structure of the mesh class:

```cpp
class Mesh {
public:
    // mesh Data
    std::vector<Vertex>       vertices;
    std::vector<unsigned int> indices;
    std::vector<Texture>      textures;
    unsigned int VAO;

    // constructor
    Mesh(std::vector<Vertex> vertices, std::vector<unsigned int> indices, std::vector<Texture> textures)
    {
        this->vertices = vertices;
        this->indices = indices;
        this->textures = textures;

        // now that we have all the required data, set the vertex buffers and its attribute pointers.
        setupMesh();
    }

    // render the mesh
    void Draw(Shader &shader)
    ...
private:
    // render data
    unsigned int VBO, EBO;

    // initializes all the buffer objects/arrays
    void setupMesh()
    ...
};
```

As you can see, the class isn't too complicated. In the constructor, we give the mesh all the necessary data, we
initialize the buffers in the `setupMesh` function, and finally draw the mesh via the `Draw` function. Note that we
give a shader to the `Draw` function; by passing the shader to the mesh we can set several uniforms before drawing
(like linking samplers to texture units).

The function content of the constructor is pretty straightforward. We simply set the class's public variables with
the constructor's corresponding argument variables – the parameters have the same names as the members, so
`this->` says which is which. We also call the `setupMesh` function in the constructor.

Now do the task **mesh-data**: the four members under `// mesh Data` and the constructor. `Draw` and `setupMesh`
already exist with empty bodies; the next tasks fill them.
:::
:::vulkan
In Vulkan the pieces of learnopengl's `Mesh` class map onto vulkan-tutorial's groundwork for loading models: a
`Vertex` with everything a model's vertex has, the mesh's data in `std::vector<Vertex> vertices` and
`std::vector<uint32_t> indices`, a vertex buffer and an index buffer in device-local memory, and an indexed draw.
Vulkan programs – vulkan-tutorial's included – keep these as members of the application class; a separate `Mesh`
class would hold exactly the same buffers. The textures of a mesh come in the next chapter, together with the model's
materials.

The project is the one you looked at in the *Assimp* chapter. The `// TODO:` comments in `main.cpp` and the two
shaders mark where your code goes. So far `Vertex` only has a position:

```cpp
// One vertex of a mesh. For now it only has a position.
struct Vertex {
    // TODO: the vertex's data: its position, normal, texture coordinates and the index of its material
    glm::vec3 pos;
```

Now that we set the minimal requirements for a mesh we can define its vertex: a position, a normal and texture
coordinates, as in learnopengl – and one more member, the number of the material the vertex belongs to:

```cpp
// One vertex of a mesh: everything a vertex of a model has.
struct Vertex {
    glm::vec3 pos;
    glm::vec3 normal;
    glm::vec2 texCoord;
    uint32_t materialIndex; // which of the model's materials the vertex's triangle has (0, 1, ...)
```

Why a material number in every vertex? learnopengl draws a model mesh by mesh, binding each mesh's textures before
its draw call. Our Vulkan program will put the whole model – planet and ring – into one vertex buffer and draw it with
a single draw call, as vulkan-tutorial does; the fragment shader then picks the textures of the fragment's material by
this number (the *Model* chapter). Planet and ring vertices never share a material number, so they stay separate
vertices even where their positions would coincide.
:::
:::d3d12
DirectX 12 has no mesh class of its own, so we port learnopengl's `mesh.h` – `struct Vertex`, `struct Texture` and
`class Mesh` with its data, constructor, `SetupMesh` and `Draw` – into `main.cpp`, at file scope before
`class D3D12App`. The project is the one you looked at in the *Assimp* chapter; the two `// TODO:` comments before
`class D3D12App` mark where the code goes.

Now that we set the minimal requirements for a mesh class we can define a vertex in Direct3D 12:

```cpp
// A vertex of a mesh: the layout of the vertex buffer, which the input layout describes
// (POSITION at byte 0, NORMAL at byte 12, TEXCOORD at byte 24).
struct Vertex
{
    // position
    XMFLOAT3 position;
    // normal
    XMFLOAT3 normal;
    // texCoords
    XMFLOAT2 texCoord;
};
```

We store each of the required vertex attributes in a struct called `Vertex`. Next to a `Vertex` struct we also want
to organize the texture data in a `Texture` struct:

```cpp
// A texture of a mesh: the image in GPU memory, what it is used for and the file it came from.
struct Texture
{
    ComPtr<ID3D12Resource> resource;    // the texture (learnopengl's texture id)
    std::string type;                   // "texture_diffuse" or "texture_specular"
    std::string path;                   // the file name, as the material names it
};
```

Where OpenGL refers to a texture by an id, Direct3D 12 has the texture resource itself, so `Texture` holds a
`ComPtr<ID3D12Resource>` – which also keeps the texture alive as long as a mesh uses it. `type` says whether it is a
diffuse or a specular map, and `path` is the name of the file it came from; learnopengl adds that in the *Model*
chapter, where it lets the model load every image file only once – we add it right away.

Now do the first task, **vertex**, and press **Build & run** (Ctrl+Enter). Nothing changes on the screen – and nothing
will in this chapter: like learnopengl's *Mesh* chapter, we only write the class here; the *Model* chapter creates the
meshes and draws them. Every step still compiles and runs.

Knowing the actual representation of a vertex and a texture we can start defining the structure of the mesh class:

```cpp
class Mesh
{
public:
    // mesh Data
    std::vector<Vertex>  vertices;
    std::vector<UINT>    indices;
    std::vector<Texture> textures;

    // constructor: srvCpuHandle and srvGpuHandle are the mesh's two slots in the CBV/SRV
    // heap (where the CPU writes its texture views, and where the GPU reads them).
    Mesh(std::vector<Vertex> vertices, std::vector<UINT> indices, std::vector<Texture> textures,
        ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle, CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle)
    {
        this->vertices = vertices;
        this->indices = indices;
        this->textures = textures;
        m_srvHandle = srvGpuHandle;

        // now that we have all the required data, create the buffers and the views.
        SetupMesh(device, srvCpuHandle);
    }

    // render the mesh
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        // TODO: bind the mesh's textures (root parameter 2) and draw it (its vertex and index buffers, DrawIndexedInstanced)
    }

private:
    // render data
    ComPtr<ID3D12Resource> m_vertexBuffer;
    ComPtr<ID3D12Resource> m_indexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_vertexBufferView = {};
    D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
    D3D12_GPU_DESCRIPTOR_HANDLE m_srvHandle = {};    // the first of the mesh's two SRVs

    // initializes all the buffers and views
    void SetupMesh(ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle)
    {
        // TODO: the vertex buffer and the index buffer, and their views

        // TODO: the shader resource views of the mesh's textures (diffuse in the first slot, specular in the second)
    }
};
```

As you can see, the class isn't too complicated. In the constructor, we give the mesh all the necessary data, we
create the buffers in the `SetupMesh` function, and finally draw the mesh via the `Draw` function. The indices are
`UINT`, 32-bit unsigned integers – learnopengl's `unsigned int`. The function content of the constructor is pretty
straightforward: we set the class's public variables with the constructor's corresponding arguments (the parameters
have the same names as the members, so `this->` says which is which), and call `SetupMesh`.

The constructor takes three things learnopengl's doesn't, because Direct3D 12 does explicitly what OpenGL does behind
the scenes:

- `device` – OpenGL creates buffers in the current context; in Direct3D 12 every resource and view is created by the
  device.
- `srvCpuHandle` and `srvGpuHandle` – learnopengl binds a mesh's textures to texture units right before drawing. In
  Direct3D 12 the shader reads textures through shader resource views in the CBV/SRV heap. Each mesh gets two
  consecutive slots of that heap: the first for its diffuse map (t0, `texture_diffuse1`), the second for its specular
  map (t1, `texture_specular1`). The CPU handle is where `SetupMesh` writes the views; the GPU handle is what `Draw`
  gives the command list, so the constructor keeps it in `m_srvHandle`.

The project's heap has room for this: `cbvSrvHeapDesc.NumDescriptors = 1 + 2 * MaxMeshes;` – the CBV in slot 0 and
two SRVs for each of up to `MaxMeshes` (8) meshes. Who hands out the slots is the *Model* chapter's job.

Now do the task **mesh-class**: the class as above. `Draw` and `SetupMesh` stay TODOs for the next tasks.
:::

## Initialization

:::opengl
Thanks to the constructor we now have large lists of mesh data that we can use for rendering. We do need to set up
the appropriate buffers and specify the vertex shader layout via vertex attribute pointers. By now you should have no
trouble with these concepts, but we've spiced it up a bit this time with the introduction of vertex data in structs:

```cpp
    void setupMesh()
    {
        // create buffers/arrays
        glGenVertexArrays(1, &VAO);
        glGenBuffers(1, &VBO);
        glGenBuffers(1, &EBO);

        glBindVertexArray(VAO);
        // load data into vertex buffers
        glBindBuffer(GL_ARRAY_BUFFER, VBO);
        // A great thing about structs is that their memory layout is sequential for all its items.
        // The effect is that we can simply pass a pointer to the struct and it translates perfectly to a glm::vec3/2 array which
        // again translates to 3/2 floats which translates to a byte array.
        glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);

        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW);

        // set the vertex attribute pointers
        // vertex Positions
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);
        // vertex normals
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
        // vertex texture coords
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));
        glBindVertexArray(0);
    }
```

The code is not much different from what you'd expect, but a few little tricks were used with the help of the
`Vertex` struct.

Structs have a great property in C++ that their memory layout is sequential. That is, if we were to represent a
struct as an array of data, it would only contain the struct's variables in sequential order which directly
translates to a float (actually byte) array that we want for an array buffer. For example, if we have a filled
`Vertex` struct, its memory layout would be equal to:

```cpp
Vertex vertex;
vertex.Position  = glm::vec3(0.2f, 0.4f, 0.6f);
vertex.Normal    = glm::vec3(0.0f, 1.0f, 0.0f);
vertex.TexCoords = glm::vec2(1.0f, 0.0f);
// = [0.2f, 0.4f, 0.6f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f];
```

Thanks to this useful property we can directly pass a pointer to a large list of `Vertex` structs as the buffer's
data and they translate perfectly to what `glBufferData` expects as its argument:

```cpp
glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);
```

Naturally the `sizeof` operator can also be used on the struct for the appropriate size in bytes. This should be
`32` bytes (8 floats × 4 bytes each).

Another great use of structs is a preprocessor directive called `offsetof(s,m)` that takes as its first argument a
struct and as its second argument a variable name of the struct. The macro returns the byte offset of that variable
from the start of the struct. This is perfect for defining the offset parameter of the `glVertexAttribPointer`
function:

```cpp
glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
```

The offset is now defined using the `offsetof` macro that, in this case, sets the byte offset of the normal vector
equal to the byte offset of the normal attribute in the struct which is `3` floats and thus `12` bytes.

Using a struct like this doesn't only get us more readable code, but also allows us to easily extend the structure.
If we want another vertex attribute we can simply add it to the struct and due to its flexible nature, the rendering
code won't break.

The locations 0, 1 and 2 are the ones `model_loading.vs` declares: `aPos`, `aNormal` and `aTexCoords`. The buffers
`VBO` and `EBO` are private members, under `// render data` – only `setupMesh` needs them; the VAO is public, since
it remembers everything the draw needs.

Now do the task **setup-mesh**: `unsigned int VBO, EBO;` and the body of `setupMesh` as above.
:::
:::vulkan
Thanks to the struct we now have a description of the mesh data, and we need to tell Vulkan how a vertex is laid out,
exactly as the cube's vertices were described since *Hello Triangle*. A struct's members lie one after the other in
memory, so an array of `Vertex` is an interleaved vertex buffer: position, normal, texture coordinates and material
number, vertex after vertex. The binding description keeps its stride of `sizeof(Vertex)`, and
`getAttributeDescriptions()` grows to four attributes, each found with `offsetof` – the byte offset of a member from
the start of the struct:

```cpp
    static std::array<VkVertexInputAttributeDescription, 4> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 4> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);

        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);

        // an integer: one 32-bit unsigned int (a uint in the shader)
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32_UINT;
        attributeDescriptions[3].offset = offsetof(Vertex, materialIndex);

        return attributeDescriptions;
    }
```

The material number is the first integer attribute of the course. Its format is `VK_FORMAT_R32_UINT` – one 32-bit
unsigned integer, passed on as it is – and the shader must declare it with an integer type, `uint`: the format's
numeric type and the shader's type have to match. (A float format such as `VK_FORMAT_R32_SFLOAT` would deliver a
float.) The offsets are 0, 12, 24 and 32, and `sizeof(Vertex)` is 36 bytes.

Our `createPipeline()` helper uses only the first `attributeCount` attributes, so the pipeline must now read all four:

```cpp
        createPipeline("shaders/model_loading.vert.spv", "shaders/model_loading.frag.spv", 4, modelPipeline); // all four attributes of a Vertex
```

The vertex shader declares the new inputs and passes the texture coordinates on:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex;

layout(location = 2) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

There are no textures yet, so the fragment shader shows the texture coordinates as a colour – u as red, v as green.
That is a common way to check texture coordinates before any texture is involved:

```glsl
layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // no textures yet: show the texture coordinates as a colour (red = u, green = v)
    outColor = vec4(fragTexCoord, 0.0, 1.0);
}
```

The normal and the material number are read but not used yet; the *Model* chapter passes the material number on.
(An integer passed from the vertex to the fragment shader must be declared `flat`: it can't be interpolated between
the corners of a triangle.)

Now do the first task, **vertex**, and press **Build & run** (Ctrl+Enter). Nothing is drawn yet – the window stays
dark grey – because nothing calls a draw command; that comes with the last task.

### Comparing vertices

The *Model* chapter will build the vertices from the `.obj` file's position/texture coordinate/normal triples, and many
triples repeat: a corner shared by six triangles appears six times. vulkan-tutorial's "Loading models" keeps each
different vertex only once, using an `std::unordered_map<Vertex, uint32_t>` that maps a vertex to its index. A key of
an `unordered_map` needs two things: a way to compare two keys, and a hash function. The comparison is an
`operator==` in `Vertex`:

```cpp
    bool operator==(const Vertex& other) const {
        return pos == other.pos && normal == other.normal && texCoord == other.texCoord && materialIndex == other.materialIndex;
    }
```

The hash function is a specialisation of `std::hash` for `Vertex`, after the struct. It combines the hashes of the
members, with vulkan-tutorial's shifts and xors (extended by the material number):

```cpp
// A hash function for Vertex, so that it can be the key of an std::unordered_map: it combines the hashes of the members.
namespace std {
    template<> struct hash<Vertex> {
        size_t operator()(Vertex const& vertex) const {
            return ((((hash<glm::vec3>()(vertex.pos) ^ (hash<glm::vec3>()(vertex.normal) << 1)) >> 1) ^ (hash<glm::vec2>()(vertex.texCoord) << 1)) >> 1) ^ (hash<uint32_t>()(vertex.materialIndex) << 1);
        }
    };
}
```

Equal vertices give equal hashes, which is all an `unordered_map` requires; different vertices *may* collide, and the
map then uses `operator==` to tell them apart. The hashes of `glm::vec3` and `glm::vec2` come from glm's
`gtx/hash.hpp`, an "experimental" extension that must be enabled before glm is included:

```cpp
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
// glm's hash functions (gtx/hash.hpp) are an "experimental" extension
#define GLM_ENABLE_EXPERIMENTAL
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtx/hash.hpp>
```

Now do the task **vertex-equality**. The picture doesn't change.

### The mesh data

learnopengl's mesh stores its vertices and indices in two vectors; so does our application class, as members:

```cpp
    // The mesh's data: its vertices and, three per triangle, the indices of the triangles' vertices.
    // A test mesh for now, a square (the next chapter loads a model instead).
    std::vector<Vertex> vertices = {
        {{-1.0f, -1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 1.0f}, 0}, // bottom left
        {{ 1.0f, -1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {1.0f, 1.0f}, 0}, // bottom right
        {{ 1.0f,  1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {1.0f, 0.0f}, 0}, // top right
        {{-1.0f,  1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 0.0f}, 0}  // top left
    };
    std::vector<uint32_t> indices = {
        0, 1, 2, 2, 3, 0
    };
```

Unlike *Hello Triangle*'s vertices they are not `const`: the next chapter fills them from the model file. And unlike
learnopengl's mesh, they aren't empty until then: Vulkan cannot create a buffer of size 0 (the size in
`VkBufferCreateInfo` must be greater than 0), and the buffers of the next tasks are created from these vectors. So
until the model is loaded, the mesh is a small test mesh: a square of 2 × 2 units facing the camera (normal +z), with
the texture coordinates of an image – v = 0 at the top, as Vulkan samples images. The *Model* chapter replaces it.

Now do the task **mesh-data**. The picture doesn't change.

### The vertex buffer

So far the course's vertex buffers were in host-visible memory, which the CPU can write directly. *Hello Triangle*
mentioned that this is not the fastest memory for the GPU to read, and that vulkan-tutorial improves it with a
*staging buffer*. A model has many more vertices than a cube, so now we do that: the vertices go into a host-visible
staging buffer first, and a copy command on the GPU moves them into a vertex buffer in device-local memory – the
GPU's own memory, which the CPU often can't map at all. It's the same path the textures took since the *Textures*
chapter, with a buffer instead of an image at the end:

```cpp
    void createVertexBuffer() {
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        // a staging buffer the CPU can write to
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        // the vertex buffer in the GPU's own (device local) memory, filled with a copy of the staging buffer
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, vertexBuffer, vertexBufferMemory);

        copyBuffer(stagingBuffer, vertexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }
```

The usage flags say what each buffer is for: the staging buffer is the *source* of a transfer
(`VK_BUFFER_USAGE_TRANSFER_SRC_BIT`), the vertex buffer its *destination* and a vertex buffer
(`VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT`). `createBuffer` is the helper from the
*Textures* chapter. The copy itself is vulkan-tutorial's `copyBuffer`, which records a `vkCmdCopyBuffer` into a
one-time command buffer – with the helpers the texture code already uses:

```cpp
    void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferCopy copyRegion{};
        copyRegion.size = size;
        vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

        endSingleTimeCommands(commandBuffer);
    }
```

`endSingleTimeCommands` submits the command buffer and waits until the queue is idle, so the staging buffer can be
destroyed right after `copyBuffer` returns. `initVulkan()` already calls `createVertexBuffer()` after
`createCommandPool()` – the copy needs a command buffer. The vertex buffer lives until the end: `cleanup()` destroys
it and frees its memory:

```cpp
        vkDestroyBuffer(device, vertexBuffer, nullptr);
        vkFreeMemory(device, vertexBufferMemory, nullptr);
```

Now do the task **vertex-buffer**. The picture doesn't change.

### The index buffer

The index buffer is made in exactly the same way; only the data and the usage flag differ:

```cpp
    void createIndexBuffer() {
        VkDeviceSize bufferSize = sizeof(indices[0]) * indices.size();

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, indices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_INDEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, indexBuffer, indexBufferMemory);

        copyBuffer(stagingBuffer, indexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }
```

`sizeof(indices[0])` is 4 now: the indices are `uint32_t`. *Hello Triangle* used `uint16_t`, which allows at most
65536 different vertices – too few for many models. `cleanup()` destroys this buffer too:

```cpp
        vkDestroyBuffer(device, indexBuffer, nullptr);
        vkFreeMemory(device, indexBufferMemory, nullptr);
```

Now do the task **index-buffer**. The picture doesn't change.
:::
:::d3d12
Thanks to the constructor we now have large lists of mesh data that we can use for rendering. We do need to set up
the appropriate buffers – and in OpenGL, specify the vertex shader layout via vertex attribute pointers. In Direct3D 12
that layout is part of the pipeline state, and the project has it already: the input layout of `LoadAssets`.

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

This is the Direct3D 12 counterpart of learnopengl's three `glVertexAttribPointer` calls, and it matches our
`Vertex` because structs have a great property in C++: their memory layout is sequential. That is, if we were to
represent a struct as an array of data, it would only contain the struct's variables in sequential order. For
example, if we have a filled `Vertex` struct, its memory layout would be equal to:

```cpp
Vertex vertex;
vertex.position = XMFLOAT3(0.2f, 0.4f, 0.6f);
vertex.normal   = XMFLOAT3(0.0f, 1.0f, 0.0f);
vertex.texCoord = XMFLOAT2(1.0f, 0.0f);
// = [0.2f, 0.4f, 0.6f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f];
```

The position starts at byte 0, the normal after 3 floats at byte 12, the texture coordinates after 6 floats at byte
24 – the offsets of the input layout – and `sizeof(Vertex)` is 32 bytes, the stride of the vertex buffer view.
(`offsetof(Vertex, normal)` would give the same 12; learnopengl uses that macro in `glVertexAttribPointer`.) Thanks to
this, we can copy a whole `std::vector<Vertex>` into the vertex buffer with a single `memcpy`.

The buffers are created as in *Hello Triangle*, in upload heaps – memory the CPU can write and the GPU can read. That
is simple and fine for a small model; Microsoft's samples point out that a default heap, filled through an upload
buffer like our textures, is the faster choice for static data that is drawn often.

```cpp
        // Upload heaps, as for the cube before: simple, and fine for a small model.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from these resources on the CPU.

        // Create the vertex buffer and copy the vertices into it. A great thing about structs
        // is that their memory layout is sequential for all its items: the vector's data is
        // exactly the bytes the input layout describes.
        const UINT vertexBufferSize = static_cast<UINT>(vertices.size() * sizeof(Vertex));
        CD3DX12_RESOURCE_DESC vertexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &vertexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_vertexBuffer)));

        UINT8* pVertexDataBegin = nullptr;
        ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices.data(), vertexBufferSize);
        m_vertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferView.StrideInBytes = sizeof(Vertex);
        m_vertexBufferView.SizeInBytes = vertexBufferSize;
```

The index buffer follows the same pattern, with the index buffer view in place of the vertex buffer view:

```cpp
        // Create the index buffer and copy the indices into it: 32-bit unsigned integers.
        const UINT indexBufferSize = static_cast<UINT>(indices.size() * sizeof(UINT));
        CD3DX12_RESOURCE_DESC indexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &indexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_indexBuffer)));

        UINT8* pIndexDataBegin = nullptr;
        ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
        memcpy(pIndexDataBegin, indices.data(), indexBufferSize);
        m_indexBuffer->Unmap(0, nullptr);

        // Initialize the index buffer view.
        m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
        m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
        m_indexBufferView.SizeInBytes = indexBufferSize;
```

The format `DXGI_FORMAT_R32_UINT` says that the indices are 32-bit unsigned integers, our `UINT`s. (*Hello Triangle*'s
rectangle used them too; `DXGI_FORMAT_R16_UINT` would allow at most 65536 different vertices – too few for many
models.) The buffers are `ComPtr` members of the mesh, so they live exactly as long as the mesh.

Now do the task **setup-mesh**: this code at the first TODO of `SetupMesh`. The picture doesn't change.

### The textures' views

learnopengl's `Mesh` gets its textures from the model and binds them, by a naming convention, when it is drawn – the
next section. In Direct3D 12 the shader reaches textures through shader resource views, so the mesh creates its views
once, in `SetupMesh`, in its two slots of the heap: the first diffuse texture into the first slot, the first specular
texture into the second.

```cpp
        // The texture views: by the naming convention, the mesh's first diffuse texture goes
        // into its first slot (t0, texture_diffuse1) and its first specular texture into the
        // second (t1, texture_specular1). A slot without a texture gets a null view (the
        // shader reads black from it).
        const char* slotTypes[] = { "texture_diffuse", "texture_specular" };
        for (UINT slot = 0; slot < _countof(slotTypes); slot++)
        {
            ID3D12Resource* resource = nullptr;
            for (UINT i = 0; i < textures.size(); i++)
            {
                if (textures[i].type == slotTypes[slot])
                {
                    resource = textures[i].resource.Get();
                    break;
                }
            }

            D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
            srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
            srvDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
            srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
            srvDesc.Texture2D.MipLevels = 1;
            device->CreateShaderResourceView(resource, &srvDesc, srvHandle);
            srvHandle.Offset(1, device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV));
        }
```

The view description is the one of the *Textures* chapter: an RGBA texture with one mip level. After each view,
`Offset` moves the handle to the next slot – by the size of one descriptor, which the device tells us, since it
differs between GPUs.

What if a mesh has no specular map? The root signature's table always covers two descriptors, t0 and t1, and a slot
the shader may read must hold a valid descriptor (on some hardware every descriptor of a bound table must be
initialized, read or not). So the slot gets a *null descriptor*: `CreateShaderResourceView` with a null resource
and a full description. Direct3D 12 defines that reading it returns zeros – the shader sees black, so a missing
specular map means no highlight. The description must be filled in anyway: it tells Direct3D what kind of view the
slot is.

Now do the task **mesh-textures**. The picture doesn't change.
:::

:::opengl
```quiz
`glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));` – what do `sizeof(Vertex)` and `offsetof(Vertex, TexCoords)` give for our `Vertex`?
- [ ] 8 and 6: the number of floats in a vertex and before the texture coordinates
- [x] 32 and 24: a vertex is 8 floats of 4 bytes, and the texture coordinates come after 3 + 3 floats
- [ ] 32 and 0: every attribute starts at the beginning of the vertex
---
The stride and the offset are in bytes. Because the struct's members lie one after the other, the vertex buffer is interleaved exactly like the cube's 8 floats per vertex in the lighting chapters – but `sizeof` and `offsetof` compute the numbers, and they stay right when the struct grows.
```
:::
:::vulkan
```quiz
The material number is `uint32_t materialIndex`. Which attribute description and shader input fit it?
- [ ] `VK_FORMAT_R32_SFLOAT` and `in float inMaterialIndex`, because vertex attributes are always floats
- [x] `VK_FORMAT_R32_UINT` at `offsetof(Vertex, materialIndex)` and `layout(location = 3) in uint inMaterialIndex`
- [ ] `VK_FORMAT_R8_UINT`, since there are only two materials
---
The format describes the bytes in the buffer: one 32-bit unsigned integer, 32 bytes into the vertex. Its numeric type (UINT) must match the shader's input type (`uint`). R8 would read only the first byte of the four.
```
:::
:::d3d12
```quiz
The project's input layout puts `NORMAL` at byte 12 and `TEXCOORD` at byte 24. Why does that fit our `Vertex`?
- [ ] Because Direct3D 12 sorts the members of a vertex by size
- [x] The members of a struct lie one after the other: `position` takes bytes 0–11, `normal` 12–23, `texCoord` 24–31, so a `std::vector<Vertex>` is exactly the vertex buffer the input layout describes, with a stride of `sizeof(Vertex)` = 32
- [ ] It doesn't matter: the input layout finds the members by their names
---
The semantics (`POSITION`, `NORMAL`, `TEXCOORD`) connect the input layout to the shader's inputs; the byte offsets connect it to the buffer. Both must match the struct – the offsets are what `offsetof` would compute.
```
:::

## Rendering

:::opengl
The last function we need to define for the `Mesh` class to be complete is its `Draw` function. Before rendering the
mesh, we first want to bind the appropriate textures before calling `glDrawElements`. However, this is somewhat
difficult since we don't know from the start how many (if any) textures the mesh has and what type they may have. So
how do we set the texture units and samplers in the shaders?

To solve the issue we're going to assume a certain naming convention: each diffuse texture is named
`texture_diffuseN`, and each specular texture should be named `texture_specularN` where `N` is any number ranging
from `1` to the maximum number of texture samplers allowed. Let's say we have 3 diffuse textures and 2 specular
textures for a particular mesh, their texture samplers should then be called:

```glsl
uniform sampler2D texture_diffuse1;
uniform sampler2D texture_diffuse2;
uniform sampler2D texture_diffuse3;
uniform sampler2D texture_specular1;
uniform sampler2D texture_specular2;
```

By this convention we can define as many texture samplers as we want in the shaders (up to OpenGL's maximum) and if
a mesh actually does contain (so many) textures, we know what their names are going to be. By this convention we can
process any amount of textures on a single mesh and the shader developer is free to use as many of those as he
wants by defining the proper samplers. Our `model_loading.fs` uses one of them, `texture_diffuse1`.

> There are many solutions to problems like this and if you don't like this particular solution it is up to you to
> get creative and come up with your own approach.

The resulting drawing code then becomes:

```cpp
    void Draw(Shader &shader)
    {
        // bind appropriate textures
        unsigned int diffuseNr  = 1;
        unsigned int specularNr = 1;
        unsigned int normalNr   = 1;
        for (unsigned int i = 0; i < textures.size(); i++)
        {
            glActiveTexture(GL_TEXTURE0 + i); // active proper texture unit before binding
            // retrieve texture number (the N in texture_diffuseN)
            std::string number;
            std::string name = textures[i].type;
            if (name == "texture_diffuse")
                number = std::to_string(diffuseNr++);
            else if (name == "texture_specular")
                number = std::to_string(specularNr++); // transfer unsigned int to string
            else if (name == "texture_normal")
                number = std::to_string(normalNr++);

            // now set the sampler to the correct texture unit
            glUniform1i(glGetUniformLocation(shader.ID, (name + number).c_str()), i);
            // and finally bind the texture
            glBindTexture(GL_TEXTURE_2D, textures[i].id);
        }

        // draw mesh
        glBindVertexArray(VAO);
        glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);
        glBindVertexArray(0);

        // always good practice to set everything back to defaults once configured.
        glActiveTexture(GL_TEXTURE0);
    }
```

We first calculate the N-component per texture type and concatenate it to the texture's type string to get the
appropriate uniform name. We then locate the appropriate sampler, give it the location value to correspond with the
currently active texture unit, and bind the texture. This is also the reason we need the shader in the `Draw`
function. Texture `i` always goes to texture unit `i`, and the sampler named after it is told so.

Note that we increment the diffuse and specular counters at the same time we convert them to string. In C++ the
increment call `variable++` returns the variable as is and then increments the variable while `++variable` first
increments the variable and then returns it. In our case the value passed to `std::to_string` is the original
counter value. After that the value is incremented for the next round.

What if the shader doesn't have a sampler of that name – a mesh with a specular map, and a shader that reads only
`texture_diffuse1`, like ours for now? Then `glGetUniformLocation` returns `-1`, and OpenGL silently ignores a
`glUniform1i` to location `-1`. So a mesh can carry more textures than a shader uses, which is exactly what the
convention needs.

Finally, the mesh is drawn with its VAO: `glDrawElements` with `GL_UNSIGNED_INT`, because our indices are
`unsigned int`. At the end the active texture unit goes back to `GL_TEXTURE0`, so code that binds a texture after
the draw doesn't accidentally bind it to the mesh's last unit.

Now do the task **draw-mesh** and press **Build & run**. The window still shows only the dark grey background: no
mesh exists yet. The class is complete, though; the *Model* chapter loads the planet with Assimp, makes a `Mesh` for the planet and
one for the ring, and calls their `Draw`.
:::
:::vulkan
The last step is learnopengl's `Draw` function: binding the mesh's buffers and drawing its triangles. In Vulkan that
is recorded in `recordCommandBuffer()`, after the pipeline, the viewport and the scissor. The vertex buffer goes to
binding 0, the binding our binding description describes, and the index buffer is bound with the type of its indices:

```cpp
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

        // the indices are uint32_t: a model can have more than 65536 vertices
        vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32);
```

`VK_INDEX_TYPE_UINT32` must match the buffer's contents: with `VK_INDEX_TYPE_UINT16` the GPU would read every 4-byte
index as two 2-byte indices. After the push constant with the model matrix, one indexed draw draws all indices:

```cpp
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

As in *Hello Triangle*: the number of indices, one instance, the first index 0, nothing added to the indices, and the
first instance 0. The descriptor set with the uniform buffer is bound as before. There are no textures to bind yet –
in the next chapter they become part of the descriptor set, and the whole model is still this one draw call.

Now do the task **draw** and press **Build & run**. The test square appears, tilted towards you by the model matrix's
25° – wider at the top, where it is nearer – and coloured by its texture coordinates: black in the top-left corner
(u = v = 0), red in the top right (u = 1), green in the bottom left (v = 1) and yellow in the bottom right (u = v =
1), with a smooth blend between them. That is the proof that all four attributes reach the GPU in the right places:
the position puts the square on the screen, and the texture coordinates arrive at offset 24 of each vertex.
:::
:::d3d12
The last function we need to define for the `Mesh` class to be complete is its `Draw` function. learnopengl binds the
mesh's textures to texture units here, by a naming convention: each diffuse texture is named `texture_diffuseN` and
each specular texture `texture_specularN` in the shader, where `N` counts from 1. Our shader follows the convention,
with registers instead of texture units: `texture_diffuse1` is t0 – the only one `model_loading.hlsl` reads for now
– and the specular map, `texture_specular1`, will be t1.

```hlsl
// The mesh's textures, in the descriptor table of root parameter 2: its diffuse map is
// register t0 (learnopengl's texture_diffuse1).
Texture2D texture_diffuse1 : register(t0);
```

Since `SetupMesh` put the views in that order, binding the textures is one call: root parameter 2 is the descriptor
table of t0 and t1, and `m_srvHandle` is where the mesh's two views are in the heap. Then the mesh's buffers are
bound and all its indices drawn:

```cpp
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        // bind the mesh's textures: root parameter 2 is the descriptor table of the
        // pixel shader's textures (t0 = texture_diffuse1, t1 = texture_specular1)
        commandList->SetGraphicsRootDescriptorTable(2, m_srvHandle);

        // draw mesh
        commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
        commandList->IASetIndexBuffer(&m_indexBufferView);
        commandList->DrawIndexedInstanced(static_cast<UINT>(indices.size()), 1, 0, 0, 0);
    }
```

`Draw` takes the command list instead of learnopengl's shader: in Direct3D 12 binding means recording commands. When
the model draws mesh after mesh, every mesh sets root parameter 2 to its own table before its draw; Direct3D 12 keeps
the root arguments of each draw separately, so the first mesh's draw still reads the first mesh's textures.
`DrawIndexedInstanced` takes the number of indices, one instance, the first index 0, nothing added to the indices
(the base vertex) and the first instance 0. The primitive topology (a triangle list), the root signature, the heap and
the model matrix are set in `PopulateCommandList` before the model is drawn.

Now do the task **draw-mesh** and press **Build & run**. The window still shows only the dark grey background: no
mesh exists yet. The class is complete, though – the *Model* chapter loads the planet with Assimp, makes a `Mesh` for
the planet and one for the ring, and calls their `Draw`.
:::

:::opengl
```quiz
A mesh has the textures (in this order) diffuse, specular, diffuse. Which sampler reads which texture unit?
- [ ] `texture_diffuse1` = unit 0, `texture_diffuse2` = unit 1, `texture_specular1` = unit 2
- [x] `texture_diffuse1` = unit 0, `texture_specular1` = unit 1, `texture_diffuse2` = unit 2
- [ ] `texture_diffuse1` = unit 1, `texture_specular1` = unit 2, `texture_diffuse3` = unit 3
---
Texture `i` goes to unit `i`. The number in the name counts per type and starts at 1: `diffuseNr++` hands out 1, then 2, and `specularNr++` its own 1. So the second diffuse texture is `texture_diffuse2` on unit 2.
```
:::
:::vulkan
```quiz
Why does this chapter fill `vertices` and `indices` with a test square instead of leaving them empty until the model is loaded?
- [ ] Because a Vulkan pipeline needs exactly four vertices
- [x] The vertex and index buffers are created from the vectors, and Vulkan cannot create a buffer of size 0
- [ ] Because `vkCmdDrawIndexed` fails on more than 6 indices
---
`VkBufferCreateInfo::size` must be greater than 0. learnopengl's empty `Mesh` is never set up before it has data, but our buffers are created in `initVulkan()` – so they get a small mesh until the *Model* chapter loads the planet into the same vectors.
```
:::
:::d3d12
```quiz
Suppose a mesh's material has no specular map. What does `SetupMesh` put into the mesh's second slot then, and why?
- [ ] Nothing: the slot stays empty, and the table is one descriptor shorter
- [x] A null SRV (null resource, full description): the table of root parameter 2 always covers t0 and t1, and reading a null view returns zeros – black, so no highlight
- [ ] The diffuse map again, so the shader always has two textures
---
A descriptor table is a fixed run of slots, and a slot the shader may read must hold a valid descriptor. `CreateShaderResourceView(nullptr, &srvDesc, …)` makes a null descriptor; the description says what kind of view the slot is.
```
:::

:::opengl
```quiz
Why does `Draw` take the shader as a parameter?
- [ ] Because `glDrawElements` needs the shader's ID
- [x] To point each sampler (`texture_diffuse1`, …) at the texture unit of its texture, it has to look the sampler up in that shader with `glGetUniformLocation(shader.ID, …)`
- [ ] So that the mesh can compile the shader the first time it is drawn
---
The sampler uniforms belong to a shader program. The mesh knows its textures and units; only with the shader can it set `glUniform1i(location, i)` for each name. The shader must be in use (`ourShader.use()`) when `Draw` is called.
```
:::
:::vulkan
```quiz
`vertices` and `indices` are copied into buffers in device-local memory through a staging buffer. Why the detour?
- [ ] Because `memcpy` cannot write more than 64 KB at a time
- [x] Device-local memory is the fastest for the GPU to read, but the CPU often can't map it: the CPU writes a host-visible staging buffer, and `vkCmdCopyBuffer` on the GPU moves the data
- [ ] Because a vertex buffer must always be created twice
---
The staging buffer is `TRANSFER_SRC` in host-visible, coherent memory; the vertex buffer is `TRANSFER_DST | VERTEX_BUFFER` in `DEVICE_LOCAL` memory. After the copy has finished (`endSingleTimeCommands` waits for it), the staging buffer is destroyed.
```
:::
:::d3d12
```quiz
The model draws its meshes one after the other, each calling `SetGraphicsRootDescriptorTable(2, m_srvHandle)` before its draw. Does the first mesh's draw end up with the second mesh's textures?
- [ ] Yes: only the last value set before `Close()` counts, so all meshes must share their textures
- [x] No: each draw uses the root arguments set before it – Direct3D 12 keeps them per draw, so every mesh reads its own two slots
- [ ] Only if both meshes use the same pipeline state
---
Root arguments are recorded state: a draw sees the values that were set when it was recorded, and changing a root parameter between draws is the normal way to give each draw its own resources.
```
:::

:::opengl
```quiz
`glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);` – why `GL_UNSIGNED_INT`?
- [ ] Because the vertex positions are unsigned
- [x] It is the type of the indices in the EBO: `std::vector<unsigned int>`, 4 bytes each; with `GL_UNSIGNED_SHORT` OpenGL would read every index as two 2-byte indices
- [ ] Because OpenGL 3.3 has no other index type
---
The type must describe what the element buffer holds. 32-bit indices also let a mesh have more than 65536 vertices – models often do.
```
:::
:::vulkan
```quiz
`vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32)` – what would `VK_INDEX_TYPE_UINT16` do with our index buffer?
- [ ] Nothing different; Vulkan detects the type from the buffer's size
- [x] The GPU would read every 4-byte `uint32_t` index as two 2-byte indices – wrong vertices, broken triangles
- [ ] It would just limit the mesh to 65536 vertices
---
The index type tells the GPU how to read the buffer's bytes, so it must match the type of `indices` (`uint32_t`). 32-bit indices also allow more than 65536 vertices, which a model can easily have.
```
:::
:::d3d12
```quiz
`m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;` – what would `DXGI_FORMAT_R16_UINT` do with our index buffer?
- [ ] Nothing different; Direct3D 12 detects the type from the buffer's size
- [x] The GPU would read every 4-byte `UINT` index as two 2-byte indices – wrong vertices, broken triangles
- [ ] It would just limit the mesh to 65536 vertices
---
The format of the index buffer view tells the input assembler how to read the buffer's bytes, so it must match the type of `indices` (`UINT`, 32 bits). 32-bit indices also allow more than 65536 vertices, which a model can easily have.
```
:::

With the mesh in place, we have what we need to draw any mesh we can feed with data. The next chapter, *Model*, does
the feeding: it loads `planet.obj` and finally puts the planet on the screen.

## Additional resources

- [Mesh](https://learnopengl.com/Model-Loading/Mesh) on learnopengl.com: the chapter this one follows.

:::opengl
- [mesh.h](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/includes/learnopengl/mesh.h) in learnopengl's
  repository: the full `Mesh` class, with tangents and bone data.
:::
:::vulkan
- [Staging buffer](https://vulkan-tutorial.com/Vertex_buffers/Staging_buffer) and
  [Index buffer](https://vulkan-tutorial.com/Vertex_buffers/Index_buffer) on vulkan-tutorial.com: the Vulkan side of
  the vertex and index buffers.
:::
:::d3d12
- [Descriptors overview](https://learn.microsoft.com/en-us/windows/win32/direct3d12/descriptors-overview) on
  Microsoft Learn: default and null descriptors in Direct3D 12.
:::
