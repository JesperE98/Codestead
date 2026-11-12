# Model

Now it is time to get our hands dirty with a model loader and start writing the actual loading and translation code.
The goal of this chapter is to turn a model file into something {{api}} can draw: a model in its entirety, that is,
a model that contains multiple meshes, possibly with multiple textures. A house that contains a wooden balcony, a
tower and perhaps a swimming pool could still be loaded as a single model.

Our model is the course's own `models/planet.obj`: a small planet with a ring around it. The file holds two objects,
`planet` and `rings`, and its material file `planet.mtl` gives each of them a material of the same name with a
diffuse map and a specular map:

```text
newmtl planet
...
map_Kd planet_diffuse.png
map_Ks planet_specular.png

newmtl rings
...
map_Kd rings.png
map_Ks rings_specular.png
```

So the model has two meshes, two materials and four textures – small enough to follow every step, but with all the
parts a real model has.

:::opengl
Like learnopengl.com, we'll load the model with Assimp and translate it to `Mesh` objects of the class you wrote in
the previous chapter. Without further ado, here is the structure of the `Model` class, in the project's `model.h`:

```cpp
class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded; // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // TODO: the constructor: load the model at path (loadModel)

    // TODO: Draw: draw every mesh of the model

private:
    void loadModel(std::string const &path) { ... }
    void processNode(aiNode *node, const aiScene *scene) { ... }
    Mesh processMesh(aiMesh *mesh, const aiScene *scene) { ... }

    // TODO: loadMaterialTextures: load the material's textures of one type (each file only once)
};
```

The `Model` class contains a vector of `Mesh` objects and requires us to give it a file location in its constructor.
It then loads the file right away via the `loadModel` function that is called in the constructor. The private
functions are all designed to process a part of Assimp's import routine and we'll cover them shortly. We also store
the directory of the file path that we'll later need when loading textures.

The `Draw` function is nothing special and basically loops over each of the meshes to call their respective `Draw`
function:

```cpp
    // draws the model, and thus all its meshes
    void Draw(Shader &shader)
    {
        for (unsigned int i = 0; i < meshes.size(); i++)
            meshes[i].Draw(shader);
    }
```

The project is the result of *Mesh*, with a new file `model.h`. Its `// TODO:` comments mark where your code goes: the
constructor and `Draw`, the bodies of `loadModel`, `processNode` and `processMesh`, and the functions
`loadMaterialTextures` and `TextureFromFile`. `main.cpp` now includes `"model.h"` (which includes `"mesh.h"`) and has
two TODOs of its own: loading the model and drawing it. The program is linked with Assimp, as you set it up in the
*Assimp* chapter. Until the model is drawn, your program shows only the dark grey background (0.05, 0.05, 0.05) – every
step before that compiles and runs, it just doesn't draw anything yet.
:::
:::vulkan
Vulkan has no model loader, and like vulkan-tutorial.com's chapter *Loading models* we use the small header-only
library **tinyobjloader** instead of Assimp (the *Assimp* chapter explained why). learnopengl's `Model` class has four
jobs – read the file, turn its meshes into vertices and indices, load the materials' textures, and draw – and we do
the same four jobs in the application class, next to the vertex and index buffers from the previous chapter:

| learnopengl's `Model` | this chapter's Vulkan program |
| --- | --- |
| `loadModel`, `processNode`, `processMesh` | `loadModel()`: `tinyobj::LoadObj` and a loop over its shapes |
| one `Mesh` (VAO, VBO, EBO) per mesh | one vertex buffer and one index buffer for the whole model |
| `loadMaterialTextures`, `TextureFromFile` | `createTextures()`: the four maps, at descriptor bindings 1–4 |
| `Draw`: one draw per mesh, each with its own textures | one `vkCmdDrawIndexed`; the fragment shader picks each fragment's material |

The project is the result of *Mesh*, unchanged: the test square, drawn in texture-coordinate colours (red = u, green =
v) with one `vkCmdDrawIndexed`. There are no `// TODO:` comments this time: each task changes the code you wrote in the
previous chapter, step by step, until the square has become the planet. Build and run the program after each task to see
the result.
:::
:::d3d12
Like learnopengl.com, we'll load the model with Assimp and translate it to `Mesh` objects of the class you wrote in
the previous chapter. The project's `main.cpp` already contains the structure of the `Model` class, after
`class Mesh`:

```cpp
class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded;    // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // The textures' upload buffers: the copies recorded in the command list read from them,
    // so they must stay alive until it has executed.
    std::vector<ComPtr<ID3D12Resource>> uploadHeaps;

    // Loads a model from a file (learnopengl's constructor). The textures' copies are recorded
    // in commandList; the meshes' texture views go into srvHeap from slot firstDescriptor on.
    void Load(std::string const& path, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ID3D12DescriptorHeap* srvHeap, UINT firstDescriptor)
    {
        m_device = device;
        m_commandList = commandList;
        m_srvHeap = srvHeap;
        m_nextDescriptor = firstDescriptor;
        loadModel(path);
    }

    // draws the model, and thus all its meshes
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        for (UINT i = 0; i < meshes.size(); i++)
            meshes[i].Draw(commandList);
    }

private:
    ...
    void loadModel(std::string const& path) { ... }
    void processNode(aiNode* node, const aiScene* scene) { ... }
    Mesh processMesh(aiMesh* mesh, const aiScene* scene) { ... }
    std::vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName) { ... }
};
```

The `Model` class contains a vector of `Mesh` objects and a function that loads them from a file. learnopengl does
the loading in the constructor; in Direct3D 12 loading a model needs more than a path – the device to create the
buffers and textures, the command list to record the textures' copies in, and the CBV/SRV heap for the meshes'
texture views – so `Load` takes those, keeps them in members for the private functions, and then calls `loadModel`.
The private functions are all designed to process a part of Assimp's import routine and we'll cover them shortly.
We also store the directory of the file path that we'll later need when loading textures. `Draw` is nothing special
and basically loops over each of the meshes to call their respective `Draw` function.

The project is the result of *Mesh*, with the `Model` class added. Its `// TODO:` comments mark where your code goes:
the bodies of `loadModel`, `processNode` and `loadMaterialTextures`, and two parts of `processMesh`; and in `D3D12App`,
the model member, loading it, freeing its upload buffers and drawing it. Until the model is drawn, your program shows
only the dark grey background (0.05, 0.05, 0.05) – every step before that compiles and runs, it just doesn't draw
anything yet.
:::

:::opengl d3d12
## Importing a 3D model into {{api}}

To import a model and translate it to our own structure, we first need to include the appropriate headers of Assimp
(the project has them already):

```cpp
#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>
```

The first function we're calling is `loadModel`. Within `loadModel`, we use Assimp to load the model into a data
structure of Assimp called a scene object. You may remember from the first chapter of the model loading series that
this is the root object of Assimp's data interface. Once we have the scene object, we can access all the data we
need from the loaded model.

The great thing about Assimp is that it neatly abstracts from all the technical details of loading all the different
file formats and does all this with a single one-liner:

```cpp
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
```

We first declare an `Importer` object from Assimp's namespace and then call its `ReadFile` function. The function
expects a file path and several post-processing options as its second argument. Assimp allows us to specify several
options that force Assimp to do extra calculations or operations on the imported data:

- `aiProcess_Triangulate`: if the model does not (entirely) consist of triangles, Assimp transforms all the model's
  primitive shapes to triangles first. Our draw calls only draw triangles.
- `aiProcess_GenSmoothNormals`: creates smooth normal vectors for each vertex if the model doesn't contain normals.
  `planet.obj` has its own normals, so here it does nothing – but the lighting at the end of this chapter needs
  normals, and not every file has them.
- `aiProcess_FlipUVs`: flips the texture coordinates on the y-axis (v becomes 1 − v). We'll see below why that is
  exactly the one flip our textures need.
- `aiProcess_CalcTangentSpace`: computes tangent vectors for normal mapping, a technique of a later part of the
  course. Our shaders don't use them yet; the flag is part of learnopengl's `model.h`, so we keep it.

A few other useful options are `aiProcess_SplitLargeMeshes`, which splits large meshes into smaller sub-meshes (useful
if your renderer has a maximum number of vertices per draw), and `aiProcess_OptimizeMeshes`, which does the reverse by
trying to join several meshes into one larger mesh, reducing draw calls. Assimp provides a great set of
post-processing options. Loading a model via Assimp is (as you can see) surprisingly easy. The hard work is in using
the returned scene object to translate the loaded data to an array of `Mesh` objects.

The complete `loadModel` function is listed here:
:::
:::opengl
```cpp
    void loadModel(std::string const &path)
    {
        // read file via ASSIMP
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
        // check for errors
        if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) // if is Not Zero
        {
            std::cout << "ERROR::ASSIMP:: " << importer.GetErrorString() << std::endl;
            return;
        }
        // retrieve the directory path of the filepath
        directory = path.substr(0, path.find_last_of('/'));

        // process ASSIMP's root node recursively
        processNode(scene->mRootNode, scene);
    }
```

After we load the model, we check if the scene and the root node of the scene are not null and check one of its
flags to see if the returned data is incomplete. If any of these error conditions are met, we report the error
retrieved from the importer's `GetErrorString` function and return. We also retrieve the directory path of the given
file path: for `"models/planet.obj"` that is `"models"`.

The constructor does nothing but call it:

```cpp
    // constructor, expects a filepath to a 3D model.
    Model(std::string const &path)
    {
        loadModel(path);
    }
```

Note that `importer` is a local variable: the `aiScene` belongs to it and is freed when `loadModel` returns. That's
fine, because by then everything we need has been copied into our own `Mesh` objects.

Now do the first task, **load-model**: the constructor and `loadModel`. Build and run: nothing is drawn yet, because
`main.cpp` doesn't create a `Model` – the program compiles and runs, and that's all for now.
:::
:::d3d12
```cpp
    void loadModel(std::string const& path)
    {
        // read file via ASSIMP
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
        // check for errors
        if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) // if is Not Zero
        {
            throw std::runtime_error(std::string("ERROR::ASSIMP:: ") + importer.GetErrorString());
        }
        // retrieve the directory path of the filepath
        directory = path.substr(0, path.find_last_of('/'));

        // process ASSIMP's root node recursively
        processNode(scene->mRootNode, scene);
    }
```

After we load the model, we check if the scene and the root node of the scene are not null and check one of its
flags to see if the returned data is incomplete. If any of these error conditions are met, we report the error
retrieved from the importer's `GetErrorString` function. learnopengl prints it and returns; our program throws it as
an exception instead, like every other failure in the D3D12 samples' style (`ThrowIfFailed`) – a program without its
model has nothing to draw. We also retrieve the directory path of the given file path: for `"models/planet.obj"`
that is `"models"`.

Note that `importer` is a local variable: the `aiScene` belongs to it and is freed when `loadModel` returns. That's
fine, because by then everything we need has been copied into our own `Mesh` objects.

Now do the first task, **load-model**. Build and run: nothing is drawn yet, because nothing calls `Load` – the program
compiles and runs, and that's all for now.
:::
:::opengl d3d12
If nothing went wrong, we want to process all of the scene's nodes. We pass the first node (the root node) to the
recursive `processNode` function. Because each node (possibly) contains a set of children we want to first process
the node in question, and then continue processing all the node's children and so on. This fits a recursive
structure, so we'll be defining a recursive function. A recursive function is a function that does some processing
and recursively calls the same function with different parameters until a certain condition is met. In our case the
exit condition is met when all nodes have been processed.

As you might remember from Assimp's structure, each node contains a set of mesh indices where each index points to a
specific mesh located in the scene object. We thus want to retrieve these mesh indices, retrieve each mesh, process
each mesh, and then do this all again for each of the node's children nodes. The content of the `processNode`
function is shown below:
:::
:::opengl
```cpp
    void processNode(aiNode *node, const aiScene *scene)
    {
        // process each mesh located at the current node
        for (unsigned int i = 0; i < node->mNumMeshes; i++)
        {
            // the node object only contains indices to index the actual objects in the scene.
            // the scene contains all the data, node is just to keep stuff organized (like relations between nodes).
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            meshes.push_back(processMesh(mesh, scene));
        }
        // after we've processed all of the meshes (if any) we then recursively process each of the children nodes
        for (unsigned int i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }
```
:::
:::d3d12
```cpp
    void processNode(aiNode* node, const aiScene* scene)
    {
        // process each mesh located at the current node
        for (UINT i = 0; i < node->mNumMeshes; i++)
        {
            // the node object only contains indices to index the actual objects in the scene.
            // the scene contains all the data, node is just to keep stuff organized (like relations between nodes).
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            meshes.push_back(processMesh(mesh, scene));
        }
        // after we've processed all of the meshes (if any) we then recursively process each of the children nodes
        for (UINT i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }
```
:::
:::opengl d3d12
We first check each of the node's mesh indices and retrieve the corresponding mesh by indexing the scene's `mMeshes`
array. The returned mesh is then passed to the `processMesh` function that returns a `Mesh` object that we can store
in the `meshes` vector. Once all the meshes have been processed, we iterate through all of the node's children and
call the same `processNode` function for each of its children. Once a node no longer has any children, the recursion
stops. For `planet.obj` this gives two meshes, `planet` and `rings`, one for each object in the file.
:::

:::opengl
```quiz
`processNode` gets an `aiNode`. Where is the actual vertex data of the node's i-th mesh?
- [ ] In `scene->mRootNode->mMeshes[i]`, whatever node is being processed
- [x] In `scene->mMeshes[node->mMeshes[i]]`: the node only holds the index of a mesh that the scene owns
- [ ] In `node->mChildren[i]`: every mesh is a child node
- [ ] In `node->mMeshes[i]`, an `aiMesh` stored in the node
---
All meshes live in the scene's `mMeshes` array; a node just lists the indices of the meshes that belong to it. That way several nodes could even share one mesh.
```
:::
:::vulkan
## Importing a 3D model into Vulkan

The tinyobjloader library is included in the same way as the stb libraries. Include the `tiny_obj_loader.h` file and
make sure to define `TINYOBJLOADER_IMPLEMENTATION` in one source file to include the function bodies and avoid linker
errors:

```cpp
#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
```

Put a configuration variable with the model's path next to the window size, and add `<string>` and
`<unordered_map>` to the includes:

```cpp
const std::string MODEL_PATH = "models/planet.obj";
```

We're going to load the vertices and indices from the model file now, so the test square goes. The two members
stay, but they start out empty – `loadModel()` will fill them:

```cpp
    // The mesh's data: its vertices and, three per triangle, the indices of the triangles' vertices.
    // loadModel() fills them from the model file.
    std::vector<Vertex> vertices;
    std::vector<uint32_t> indices;
```

The indices were already `uint32_t` and the index buffer is bound with `VK_INDEX_TYPE_UINT32`: a model can easily
have more than 65535 vertices. `loadModel()` must run before the vertex and index buffers are created – the buffers'
sizes are the sizes of these vectors, and Vulkan cannot create a buffer of size 0 (that's why the previous chapter
needed a test square):

```cpp
        createTextureSampler();
        loadModel();
        createVertexBuffer();
```

A model is loaded into the library's data structures by calling the `tinyobj::LoadObj` function:

```cpp
    void loadModel() {
        tinyobj::attrib_t attrib;                   // all positions, normals and texture coordinates of the file
        std::vector<tinyobj::shape_t> shapes;       // its objects ("o planet", "o rings"): their faces as indices into attrib
        std::vector<tinyobj::material_t> materials; // the materials of the .mtl file, in the file's order
        std::string warn, err;

        // the last argument: the folder of the .mtl file that planet.obj names (mtllib planet.mtl)
        if (!tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err, MODEL_PATH.c_str(), "models/")) {
            throw std::runtime_error(warn + err);
        }
```

An OBJ file consists of positions, normals, texture coordinates and faces. Faces consist of an arbitrary amount of
vertices, where each vertex refers to a position, normal and/or texture coordinate by index. This makes it possible
to not just reuse entire vertices, but also individual attributes.

The `attrib` container holds all of the positions, normals and texture coordinates in its `attrib.vertices`,
`attrib.normals` and `attrib.texcoords` vectors. The `shapes` container contains all of the separate objects and
their faces – for our file two shapes, `planet` and `rings`. Each face consists of an array of vertices, and each
vertex contains the indices of the position, normal and texture coordinate attributes. Unlike vulkan-tutorial's
model, ours has two materials: `materials` holds them in the order of `planet.mtl` (planet = 0, rings = 1), and each
shape's `mesh.material_ids` gives every face the number of its material. The last argument of `LoadObj` is the folder
the `.mtl` file is read from: `planet.obj` names it with `mtllib planet.mtl`, relative to the model.

The `err` string contains errors and the `warn` string contains warnings that occurred while loading the file, like
a missing material definition. Loading only really failed if `LoadObj` returns `false`. As mentioned above, faces in
OBJ files can actually contain an arbitrary number of vertices, whereas our application can only render triangles.
Luckily `LoadObj` has an optional parameter to automatically triangulate such faces, which is enabled by default –
it does what `aiProcess_Triangulate` does for Assimp.

So `tinyobj::attrib_t` is roughly Assimp's per-mesh vertex arrays for the whole file, `shape_t` is an `aiMesh`, and
`material_t` an `aiMaterial`. There is no node hierarchy: an OBJ file doesn't have one.

```quiz
`shape.mesh.indices[i]` is a `tinyobj::index_t`. What does it contain?
- [x] Three separate indices: `vertex_index`, `normal_index` and `texcoord_index`, into `attrib.vertices`, `attrib.normals` and `attrib.texcoords`
- [ ] The three indices of a triangle
- [ ] The position itself, as three floats
- [ ] The number of the vertex in the vertex buffer
---
OBJ indexes each attribute separately, so one corner of a face can combine any position with any normal and any texture coordinate. Our vertex buffer needs one index per complete vertex, so `loadModel()` has to build those vertices itself.
```
:::
:::d3d12
```quiz
`processNode` gets an `aiNode`. Where is the actual vertex data of the node's i-th mesh?
- [ ] In `node->mChildren[i]`: every mesh is a child node
- [ ] In `scene->mRootNode->mMeshes[i]`, whatever node is being processed
- [ ] In `node->mMeshes[i]`, an `aiMesh` stored in the node
- [x] In `scene->mMeshes[node->mMeshes[i]]`: the node only holds the index of a mesh that the scene owns
---
All meshes live in the scene's `mMeshes` array; a node just lists the indices of the meshes that belong to it. That way several nodes could even share one mesh.
```
:::

:::opengl d3d12
A careful reader may have noticed that we could forget about processing any of the nodes and simply loop through all
of the scene's meshes directly, without doing all this complicated stuff with indices. The reason we're doing this is
that the initial idea for using nodes like this is that it defines a parent-child relation between meshes. By
recursively iterating through these relations, we can define certain meshes to be parents of other meshes. An example
use case for such a system is when you want to translate a car mesh and make sure that all its children (like an
engine mesh, a steering wheel mesh, and its tire meshes) translate as well; such a system is easily created using
parent-child relations.

Right now however we're not using such a system, but it is generally recommended to stick with this approach for
whenever you want extra control over your mesh data. These node-like relations are after all defined by the artists
who created the models.
:::
:::opengl
```quiz
Why does `processNode` walk through the node tree recursively, when looping over `scene->mMeshes` would find the same two meshes?
- [ ] Recursion is faster than a loop for arrays of pointers
- [ ] Because Assimp frees each mesh once its node has been visited
- [ ] Because `scene->mMeshes` only holds the root node's meshes
- [x] The nodes keep the parent-child relations the artist defined; walking them keeps the option to use those relations, for example to move a part together with everything attached to it
---
For our planet both ways give the same two meshes. The tree matters as soon as you want to use the model's structure – a car's wheels that should move with the car.
```

Now do the task **process-node**. Again nothing visible changes – `processMesh` still returns empty meshes – but the
structure is complete.
:::
:::vulkan
## From the file to vertices

We're going to combine all of the faces in the file into a single model, so we iterate over all of the shapes and over
the indices of each shape. The triangulation has already made sure that there are three indices per face. For each
index we build one `Vertex`, using the index's three numbers to look up the actual vertex attributes in the `attrib`
arrays:

```cpp
        for (const auto& shape : shapes) {
            for (size_t i = 0; i < shape.mesh.indices.size(); i++) {
                const tinyobj::index_t& index = shape.mesh.indices[i];
                Vertex vertex{};

                vertex.pos = {
                    attrib.vertices[3 * index.vertex_index + 0],
                    attrib.vertices[3 * index.vertex_index + 1],
                    attrib.vertices[3 * index.vertex_index + 2]
                };

                vertex.normal = {
                    attrib.normals[3 * index.normal_index + 0],
                    attrib.normals[3 * index.normal_index + 1],
                    attrib.normals[3 * index.normal_index + 2]
                };

                // OBJ's v goes up from the bottom of the image, Vulkan's down from the top: flip it
                vertex.texCoord = {
                    attrib.texcoords[2 * index.texcoord_index + 0],
                    1.0f - attrib.texcoords[2 * index.texcoord_index + 1]
                };

                // LoadObj has made every face a triangle: indices 0-2 are face 0, 3-5 face 1 ... and each face has
                // the number of its material (planet = 0, rings = 1)
                vertex.materialIndex = static_cast<uint32_t>(shape.mesh.material_ids[i / 3]);
```

Unfortunately the `attrib.vertices` array is an array of `float` values instead of something like `glm::vec3`, so
you need to multiply the index by `3`. Similarly, there are two texture coordinate components per entry. The offsets
of `0`, `1` and `2` are used to access the X, Y and Z components, or the U and V components in the case of texture
coordinates. This is learnopengl's copying of `mesh->mVertices[i]`, `mesh->mNormals[i]` and
`mesh->mTextureCoords[0][i]` into a `Vertex`. (The file has normals and texture coordinates for every vertex; a
loader for any OBJ file would have to check that `normal_index` and `texcoord_index` are not −1.)

Two lines are new compared with vulkan-tutorial. The texture coordinate's v is flipped – more on that below. And
every vertex gets the number of its face's material: `material_ids` has one entry per face, and because every face is
a triangle, index `i` belongs to face `i / 3`. learnopengl keeps the material with the mesh; we keep it with the
vertex, because we'll draw the whole model with one draw call and the fragment shader must know which material it is
drawing.

## Indices

For simplicity, vulkan-tutorial first assumes that every vertex is unique and just counts up the indices. But then we
wouldn't be taking advantage of the index buffer: many vertices are included in several triangles. We keep only the
unique vertices and use the index buffer to reuse them whenever they come up, with an `unordered_map` that remembers
the index of every vertex we've already stored:

```cpp
        // each different vertex goes into vertices once; a vertex that comes again only adds its index
        std::unordered_map<Vertex, uint32_t> uniqueVertices{};
        ...
                if (uniqueVertices.count(vertex) == 0) {
                    uniqueVertices[vertex] = static_cast<uint32_t>(vertices.size());
                    vertices.push_back(vertex);
                }

                indices.push_back(uniqueVertices[vertex]);
            }
        }
    }
```

Every time we read a vertex from the OBJ file, we check if we've already seen a vertex with the exact same position,
normal, texture coordinates and material before. If not, we add it to `vertices` and store its index in
`uniqueVertices`. After that we add the index of the vertex to `indices`. This is why the previous chapter gave
`Vertex` an `operator==` and a `std::hash` specialisation: an `unordered_map` needs both for its keys. For
`planet.obj` the 3168 indices (1056 triangles) refer to only 657 different vertices.

```quiz
Why does `loadModel()` look every vertex up in `uniqueVertices` before adding it?
- [ ] Because Vulkan rejects a vertex buffer with two equal vertices
- [ ] To sort the vertices by material, so that one draw call is enough
- [ ] Because `vkCmdDrawIndexed` needs the indices in increasing order
- [x] So that a vertex shared by several triangles is stored once and reused through the index buffer, instead of once per triangle corner
---
Without the map every corner would be a vertex of its own: 3168 vertices with indices 0, 1, 2, 3 …. With it the vertex buffer holds 657, and the index buffer says which of them each triangle uses.
```

Now do the first task, **load-model**: the include, `MODEL_PATH`, the empty vectors and `loadModel()`, called before
`createVertexBuffer()`. Build and run: the square has become the planet and its ring, seen slightly from above – still
in texture-coordinate colours, because the fragment shader shows them as red and green. Each point's colour tells you
its u (red) and v (green): the white-capped pole of the finished planet is now almost pure red (v ≈ 0 at the top of the
image), and on the right of the ring you can see a sharp edge in the colours: the ring's seam, where its texture
coordinates wrap around. All of it is still one `vkCmdDrawIndexed`, now with all of the model's indices.
:::
:::d3d12
```quiz
Why does `processNode` walk through the node tree recursively, when looping over `scene->mMeshes` would find the same two meshes?
- [ ] Recursion is faster than a loop for arrays of pointers
- [x] The nodes keep the parent-child relations the artist defined; walking them keeps the option to use those relations, for example to move a part together with everything attached to it
- [ ] Because `scene->mMeshes` only holds the root node's meshes
- [ ] Because Assimp frees each mesh once its node has been visited
---
For our planet both ways give the same two meshes. The tree matters as soon as you want to use the model's structure – a car's wheels that should move with the car.
```

Now do the task **process-node**. Again nothing visible changes, but the structure is complete.
:::

:::opengl d3d12
The next step is to process Assimp's data into the `Mesh` class from the previous chapter.

## Assimp to Mesh

Translating an `aiMesh` object to a mesh object of our own is not too difficult. All we need to do is access each of
the mesh's relevant properties and store them in our own object. The general structure of the `processMesh` function
then becomes:
:::
:::opengl
```cpp
    Mesh processMesh(aiMesh *mesh, const aiScene *scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<unsigned int> indices;
        std::vector<Texture> textures;

        // TODO: copy every vertex (position, normal, texture coordinates) and the indices of every face

        // TODO: process materials: load the diffuse, specular and normal maps (loadMaterialTextures)

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures);
    }
```

Processing a mesh is a 3-part process: retrieve all the vertex data, retrieve the mesh's indices, and finally
retrieve the relevant material data. The processed data is stored in one of the 3 vectors and from those a `Mesh` is
created and returned to the function's caller.

Retrieving the vertex data is pretty simple: we define a `Vertex` struct that we add to the `vertices` array after
each loop iteration. We loop for as many vertices as there exist within the mesh (retrieved via
`mesh->mNumVertices`). Within the iteration we want to fill this struct with all the relevant data. For vertex
positions this is done as follows:

```cpp
            glm::vec3 vector; // we declare a placeholder vector since assimp uses its own vector class that doesn't directly convert to glm's vec3 class so we transfer the data to this placeholder glm::vec3 first.
            // positions
            vector.x = mesh->mVertices[i].x;
            vector.y = mesh->mVertices[i].y;
            vector.z = mesh->mVertices[i].z;
            vertex.Position = vector;
```

Note that we define a temporary `vec3` for transferring Assimp's data to. This is necessary as Assimp maintains its
own data types for vectors, matrices, strings etc. and they don't convert that well to glm's data types.

Assimp calls their vertex position array `mVertices` which isn't the most intuitive name.

The procedure for normals should come as no surprise now:

```cpp
            // normals
            if (mesh->HasNormals())
            {
                vector.x = mesh->mNormals[i].x;
                vector.y = mesh->mNormals[i].y;
                vector.z = mesh->mNormals[i].z;
                vertex.Normal = vector;
            }
```

Texture coordinates are roughly the same, but Assimp allows a model to have up to 8 different texture coordinates per
vertex. We're not going to use 8, we only care about the first set of texture coordinates. We'll also want to check
if the mesh actually contains texture coordinates (which may not always be the case):

```cpp
            // texture coordinates
            if (mesh->mTextureCoords[0]) // does the mesh contain texture coordinates?
            {
                glm::vec2 vec;
                // a vertex can contain up to 8 different texture coordinates. We thus make the assumption that we won't
                // use models where a vertex can have multiple texture coordinates so we always take the first set (0).
                vec.x = mesh->mTextureCoords[0][i].x;
                vec.y = mesh->mTextureCoords[0][i].y;
                vertex.TexCoords = vec;
            }
            else
                vertex.TexCoords = glm::vec2(0.0f, 0.0f);
```

The `vertex` struct is now completely filled with the required vertex attributes and we can push it to the back of
the `vertices` vector at the end of the iteration. This process is repeated for each of the mesh's vertices.
:::
:::d3d12
```cpp
    Mesh processMesh(aiMesh* mesh, const aiScene* scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<UINT> indices;
        std::vector<Texture> textures;

        // TODO: walk through each of the mesh's vertices (position, normal, texture coordinates) and faces (indices)
        // TODO: process the material: its diffuse and specular maps (loadMaterialTextures)

        // The mesh's two texture views go into the next two free slots of the CBV/SRV heap.
        ...
        m_nextDescriptor += 2;

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures, m_device, srvCpuHandle, srvGpuHandle);
    }
```

Processing a mesh is a 3-part process: retrieve all the vertex data, retrieve the mesh's indices, and finally
retrieve the relevant material data. The processed data is stored in one of the 3 vectors and from those a `Mesh` is
created and returned to the function's caller. The end of the function is already there: each mesh gets the next two
free slots of the CBV/SRV heap for its texture views (the *Mesh* chapter's `SetupMesh` writes them), and the check
throws if the heap – `1 + 2 * MaxMeshes` descriptors, with `MaxMeshes = 8` – has no room left.

Retrieving the vertex data is pretty simple: we define a `Vertex` struct that we add to the `vertices` array after
each loop iteration. We loop for as many vertices as there exist within the mesh (retrieved via
`mesh->mNumVertices`). Within the iteration we want to fill this struct with all the relevant data. Assimp keeps its
own vector type, `aiVector3D`, which doesn't convert to DirectXMath's types, so we copy its components into an
`XMFLOAT3`:

```cpp
            Vertex vertex;
            // positions
            vertex.position = XMFLOAT3(mesh->mVertices[i].x, mesh->mVertices[i].y, mesh->mVertices[i].z);
```

Assimp calls their vertex position array `mVertices` which isn't the most intuitive name. The procedure for normals
should come as no surprise now:

```cpp
            // normals
            if (mesh->HasNormals())
                vertex.normal = XMFLOAT3(mesh->mNormals[i].x, mesh->mNormals[i].y, mesh->mNormals[i].z);
            else
                vertex.normal = XMFLOAT3(0.0f, 0.0f, 0.0f);
```

`XMFLOAT3` has no default value, so the `else` sets the normal to zero when there are none (with
`aiProcess_GenSmoothNormals` there always are). Texture coordinates are roughly the same, but Assimp allows a model to
have up to 8 different texture coordinates per vertex. We're not going to use 8, we only care about the first set of
texture coordinates. We'll also want to check if the mesh actually contains texture coordinates (which may not always
be the case):

```cpp
            // texture coordinates
            if (mesh->mTextureCoords[0]) // does the mesh contain texture coordinates?
            {
                // a vertex can contain up to 8 different texture coordinates. We thus make the assumption that we won't
                // use models where a vertex can have multiple texture coordinates so we always take the first set (0).
                vertex.texCoord = XMFLOAT2(mesh->mTextureCoords[0][i].x, mesh->mTextureCoords[0][i].y);
            }
            else
                vertex.texCoord = XMFLOAT2(0.0f, 0.0f);

            vertices.push_back(vertex);
```

The `vertex` struct is now completely filled with the required vertex attributes and we push it to the back of the
`vertices` vector at the end of the iteration. This process is repeated for each of the mesh's vertices.
:::

:::opengl d3d12
## Indices

Assimp's interface defines each mesh as having an array of faces, where each face represents a single primitive,
which in our case (due to the `aiProcess_Triangulate` option) are always triangles. A face contains the indices of the
vertices we need to draw in what order for its primitive. So if we iterate over all the faces and store all the
face's indices in the `indices` vector we're all set:
:::
:::opengl
```cpp
        // now walk through each of the mesh's faces (a face is a mesh its triangle) and retrieve the corresponding vertex indices.
        for (unsigned int i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // retrieve all indices of the face and store them in the indices vector
            for (unsigned int j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }
```

After the outer loop has finished, we now have a complete set of vertices and index data for drawing the mesh via
`glDrawElements`.
:::
:::d3d12
```cpp
        // now walk through each of the mesh's faces (a face is a mesh its triangle) and retrieve the corresponding vertex indices.
        for (UINT i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // retrieve all indices of the face and store them in the indices vector
            for (UINT j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }
```

After the outer loop has finished, we now have a complete set of vertices and index data for drawing the mesh via
`DrawIndexedInstanced`.
:::
:::opengl d3d12
One thing to know about the result: unlike our own cube data, the vertices Assimp hands us are not necessarily shared
between triangles. For an OBJ file Assimp typically gives every corner of every face a vertex of its own, so the
indices just count 0, 1, 2, 3 …. If you want shared vertices, add `aiProcess_JoinIdenticalVertices` to the flags: it
merges vertices whose data is identical, and the index buffer then reuses them. learnopengl doesn't use it, and for a
model as small as ours it doesn't matter.

Now do the task **process-mesh**: the vertex loop and the face loop. Nothing visible changes yet. However, to finish
the discussion and to add some detail to the mesh, we want to process the mesh's material as well.
:::

## A note on texture orientation

Before we load any textures, one detail decides whether the planet will be right way up. The OBJ format counts its
texture coordinate v from the **bottom** of the image (v = 0 is the bottom row, v = 1 the top row), as OpenGL does.
stb_image, however, delivers the image's **top** row first.

:::opengl
In OpenGL, `glTexImage2D` puts the first row it gets at t = 0. If we upload stb_image's data as it is, t = 0 is the
image's top row – the opposite of what the OBJ file means. Exactly **one** flip fixes that, and there are two places
to do it: flip the image while loading (`stbi_set_flip_vertically_on_load(true)`, as in the *Textures* chapter), or
flip the coordinates (`aiProcess_FlipUVs`, v becomes 1 − v). Our `model.h` keeps learnopengl's flags, so the
coordinates are flipped, and the project does **not** call `stbi_set_flip_vertically_on_load(true)`.

learnopengl's `model_loading.cpp` does both. That suits its backpack model, whose texture coordinates are stored the
other way round, but for a file like ours the two flips cancel out and the planet's texture ends up upside down – the
ice of the north pole would appear at the south pole. `main.cpp` has a comment about this where the model is loaded.
:::
:::vulkan
In Vulkan, texture coordinate v = 0 is the top row of the image, and stb_image's data is uploaded as it is, top row
first. So v must be flipped exactly **once**, and like vulkan-tutorial we flip it where we read it:
`1.0f - attrib.texcoords[2 * index.texcoord_index + 1]`. (Flipping the image while loading instead would work just as
well; doing both would turn the planet upside down.)
:::
:::d3d12
In Direct3D, texture coordinate v = 0 is the top row of the image, and `TextureFromFile` uploads stb_image's data as
it is, top row first. So v must be flipped exactly **once**, and that is what `aiProcess_FlipUVs` does: v becomes
1 − v. learnopengl's OpenGL program flips twice – `aiProcess_FlipUVs` *and* `stbi_set_flip_vertically_on_load(true)` –
which only suits its backpack model, whose coordinates are stored the other way round. For our planet, one flip makes
it upright, with the white pole at the top. (`aiProcess_ConvertToLeftHanded` is not used either: the program keeps
learnopengl's right-handed maths, `XMMatrixLookAtRH` and `XMMatrixPerspectiveFovRH`.)
:::

```quiz
`planet.obj` counts v from the bottom of the image, and stb_image delivers the top row first. How many times must the program flip v (or the image) for the planet to be upright?
- [ ] Never: model files are always made for the API that loads them
- [ ] Twice: once for the coordinates and once for the image, as learnopengl's model_loading.cpp does
- [x] Exactly once – whether it flips the coordinates or the image doesn't matter
- [ ] It depends on the size of the image
---
Each flip turns the texture upside down, so two flips cancel out. learnopengl flips twice for its backpack only because that model's coordinates are already stored flipped; for ours, one flip is right.
```

:::opengl d3d12
## Material

Similar to nodes, a mesh only contains an index to a material object. To retrieve the material of a mesh, we need to
index the scene's `mMaterials` array. The mesh's material index is set in its `mMaterialIndex` property. (learnopengl
checks it with `if (mesh->mMaterialIndex >= 0)`, but the index is unsigned and Assimp always gives a successfully
loaded scene at least one material – a default one if the file has none – so our code just uses it.)

```cpp
        // process materials
        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
```

We first retrieve the `aiMaterial` object from the scene's `mMaterials` array. Then we want to load the mesh's diffuse
and/or specular textures. A material object internally stores an array of texture locations for each texture type.
The different texture types are all prefixed with `aiTextureType_`. We use a helper function called
`loadMaterialTextures` to retrieve, load, and initialize the textures from the material. The function returns a
vector of `Texture` structs that we store at the end of the mesh's `textures` vector:
:::
:::opengl
```cpp
        // 1. diffuse maps
        std::vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        // 2. specular maps
        std::vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
        // 3. normal maps
        std::vector<Texture> normalMaps = loadMaterialTextures(material, aiTextureType_HEIGHT, "texture_normal");
        textures.insert(textures.end(), normalMaps.begin(), normalMaps.end());
```

The type names are the convention of the *Mesh* chapter: `Mesh::Draw` binds each texture to a sampler called
`texture_diffuseN`, `texture_specularN` or `texture_normalN`. The normal maps are read as `aiTextureType_HEIGHT`
because Assimp's OBJ importer stores a `map_Bump` line under that type; `planet.mtl` has none, so for our model that
call finds nothing. The planet mesh ends up with `planet_diffuse.png` and `planet_specular.png`, the ring with
`rings.png` and `rings_specular.png`.
:::
:::d3d12
```cpp
        // 1. diffuse maps
        std::vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        // 2. specular maps
        std::vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
```

The type names are the convention of the *Mesh* chapter: `SetupMesh` puts the mesh's first `"texture_diffuse"` into
its first heap slot (register `t0`, `texture_diffuse1` in the shader) and its first `"texture_specular"` into the
second (`t1`, `texture_specular1`). learnopengl also loads normal maps (`aiTextureType_HEIGHT`); our meshes have only
two slots and `planet.mtl` has no normal maps, so we leave them out. The planet mesh ends up with
`planet_diffuse.png` and `planet_specular.png`, the ring with `rings.png` and `rings_specular.png`.
:::
:::opengl d3d12
The `loadMaterialTextures` function iterates over all the texture locations of the given texture type, retrieves the
texture's file location and then loads and generates the texture and stores the information in a `Texture` struct. In
its simplest form it looks like this:

```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial *mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (unsigned int i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            Texture texture;
            ...                         // load the file str names
            texture.type = typeName;
            texture.path = str.C_Str();
            textures.push_back(texture);
        }
        return textures;
    }
```

We first check the amount of textures stored in the material via its `GetTextureCount` function that expects one of
the texture types we've given. We retrieve each of the texture's file locations via the `GetTexture` function that
stores the result in an `aiString`. We then use another helper function called `TextureFromFile` that loads a texture
(with stb_image) for us.

Note that we make the assumption that texture file paths in model files are local to the actual model object, e.g. in
the same directory as the location of the model itself. We can then simply concatenate the texture location string
and the directory string we retrieved earlier (in the `loadModel` function) to get the complete texture path (that's
why `TextureFromFile` also needs the directory string): `planet.mtl` says `planet_diffuse.png`, and the file is
`models/planet_diffuse.png`.

Some models found over the internet use absolute paths for their texture locations, which won't work on each
machine. In that case you probably want to manually edit the file to use local paths for the textures (if possible).
:::
:::opengl
`TextureFromFile` is the `loadTexture` function of the lighting chapters, with the directory put in front of the file
name:

```cpp
unsigned int TextureFromFile(const char *path, const std::string &directory)
{
    std::string filename = std::string(path);
    filename = directory + '/' + filename;

    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    unsigned char *data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format = GL_RGB;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
```

It goes after the class, where the TODO is; the class only needs its declaration, which is at the top of `model.h`.
There is no `stbi_set_flip_vertically_on_load` here, for the reason above. `model.h` includes `<stb_image.h>` for the
declarations only: `main.cpp` defines `STB_IMAGE_IMPLEMENTATION` before its own include, so stb_image's code is
compiled exactly once.

Now do the task **texture-from-file**. Still nothing visible changes: nothing calls the function yet.
:::
:::d3d12
`TextureFromFile` is already in the project, after the class. It is the earlier chapters' `LoadTexture` without the
view (each mesh creates its own views in its heap slots), with the directory put in front of the file name:

```cpp
ComPtr<ID3D12Resource> TextureFromFile(const char* path, const std::string& directory, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ComPtr<ID3D12Resource>& uploadHeap)
{
    // the file is next to the model
    std::string filename = directory + '/' + std::string(path);
    ...
    unsigned char* data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 4);
```

It loads the image as RGBA, creates an `R8G8B8A8_UNORM` texture in a default heap, creates the upload buffer it
returns in `uploadHeap`, records the copy with `UpdateSubresources` and a barrier to `PIXEL_SHADER_RESOURCE` in the
command list, and returns the texture. Note that the copy is only *recorded*: it happens when the command list
executes. Until then the upload buffer must stay alive – that's what the model's `uploadHeaps` vector is for.
:::

:::opengl d3d12
## An optimization

We're not completely done yet, since there is still a large (but not completely necessary) optimization we want to
make. Most scenes re-use several of their textures onto several meshes; think of a house again that has a granite
texture for its walls. This texture could also be applied to the floor, its ceilings, the staircase, perhaps a table,
and maybe even a small well close by. Loading textures is not a cheap operation and in our current implementation a
new texture is loaded and generated for each mesh, even though the exact same texture could have been loaded several
times before. This quickly becomes the bottleneck of your model loading implementation.

So we're going to add one small tweak to the model code by storing all of the loaded textures globally. Wherever we
want to load a texture, we first check if it hasn't been loaded already. If so, we take that texture and skip the
entire loading routine, saving us a lot of processing power. To be able to compare textures we need to store their
path as well – that's why the *Mesh* chapter's `Texture` struct has a `path`. All the loaded textures are kept in the
model's `textures_loaded` vector.

In the `loadMaterialTextures` function, we want to compare the texture path with all the textures in the
`textures_loaded` vector to see if the current texture path equals any of those. If so, we skip the texture
loading/generation part and simply use the located texture struct as the mesh's texture. The (updated) function is
shown below:
:::
:::opengl
```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial *mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (unsigned int i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            // check if texture was loaded before and if so, continue to next iteration: skip loading a new texture
            bool skip = false;
            for (unsigned int j = 0; j < textures_loaded.size(); j++)
            {
                if (std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    textures.push_back(textures_loaded[j]);
                    skip = true; // a texture with the same filepath has already been loaded, continue to next one. (optimization)
                    break;
                }
            }
            if (!skip)
            {   // if texture hasn't been loaded already, load it
                Texture texture;
                texture.id = TextureFromFile(str.C_Str(), this->directory);
                texture.type = typeName;
                texture.path = str.C_Str();
                textures.push_back(texture);
                textures_loaded.push_back(texture); // store it as texture loaded for entire model, to ensure we won't unnecessary load duplicate textures.
            }
        }
        return textures;
    }
```

Our two meshes don't share a texture, so for the planet the cache never hits – but load a model whose fifty meshes
all use the same granite texture and the difference is fifty texture loads against one.

Now do the task **material-textures**: `loadMaterialTextures` with the cache, and the material part of
`processMesh`. Everything is loaded now; it just isn't drawn yet.

```quiz
What does `textures_loaded` save when two meshes of a model use the same image file?
- [x] The second mesh gets the `Texture` that was already created for the first – same texture id – so the file is read and uploaded only once
- [ ] It stores the image's pixels so that the second texture can be created without reading the file
- [ ] Nothing: each mesh needs its own texture object, so the file is loaded twice anyway
- [ ] It makes the two meshes into one, so that they're drawn with one draw call
---
The comparison is by path, the name the material gives. A texture object can be bound for any number of draws, so sharing it between meshes is no problem.
```
:::
:::d3d12
```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (UINT i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            // check if texture was loaded before and if so, continue to next iteration: skip loading a new texture
            bool skip = false;
            for (UINT j = 0; j < textures_loaded.size(); j++)
            {
                if (std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    textures.push_back(textures_loaded[j]);
                    skip = true; // a texture with the same filepath has already been loaded, continue to next one. (optimization)
                    break;
                }
            }
            if (!skip)
            {   // if texture hasn't been loaded already, load it
                Texture texture;
                ComPtr<ID3D12Resource> uploadHeap;
                texture.resource = TextureFromFile(str.C_Str(), directory, m_device, m_commandList, uploadHeap);
                texture.type = typeName;
                texture.path = str.C_Str();
                textures.push_back(texture);
                textures_loaded.push_back(texture);  // store it as texture loaded for entire model, to ensure we won't unnecessary load duplicate textures.
                uploadHeaps.push_back(uploadHeap);
            }
        }
        return textures;
    }
```

A `Texture` holds a `ComPtr`, so the copy in `textures_loaded` and the copies in the meshes all refer to the same
`ID3D12Resource`: the texture lives as long as any of them. Each new texture's upload buffer goes into `uploadHeaps`.
Our two meshes don't share a texture, so for the planet the cache never hits – but load a model whose fifty meshes all
use the same granite texture and the difference is fifty texture loads against one.

Now do the task **material-textures**: `loadMaterialTextures` with the cache, and the material part of
`processMesh`. Everything can be loaded now; it just isn't yet.
:::
:::vulkan
## Material

learnopengl's `processMesh` asks each mesh's `aiMaterial` for the names of its textures and loads them. Our program
does the same job more directly, like vulkan-tutorial: it knows the model's materials and loads their textures from
constants. `planet.mtl` names the files – `map_Kd` is the diffuse map, `map_Ks` the specular map – and tinyobjloader
would give us the names too (`materials[i].diffuse_texname` and `materials[i].specular_texname`); a loader for any
model would load the textures from those. We start with the diffuse maps, in the order of the materials:

```cpp
// the textures of the model's materials (map_Kd in planet.mtl), in the order of their bindings
const std::string PLANET_DIFFUSE_PATH = "models/planet_diffuse.png";
const std::string RINGS_DIFFUSE_PATH = "models/rings.png";
```

Each texture is three Vulkan objects – the image, its memory and the view the shaders read it through – so a small
struct keeps them together, and the class gets one for each material:

```cpp
// A texture: the image, its memory and the view the shaders read it through.
struct Texture {
    VkImage image;
    VkDeviceMemory memory;
    VkImageView view;
};
...
    Texture planetDiffuseMap; // material 0, "planet"
    Texture ringsDiffuseMap;  // material 1, "rings"
```

`createTextures()` loads them, called in `initVulkan()` before `createTextureSampler()`; a helper does what every
texture needs – this is learnopengl's `TextureFromFile`:

```cpp
    // The textures of the model's materials, loaded in the order of their bindings.
    void createTextures() {
        int texWidth, texHeight, texChannels;

        stbi_uc* pixels = stbi_load(PLANET_DIFFUSE_PATH.c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
        createTexture(pixels, texWidth, texHeight, planetDiffuseMap);

        pixels = stbi_load(RINGS_DIFFUSE_PATH.c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
        createTexture(pixels, texWidth, texHeight, ringsDiffuseMap);
    }

    // A texture from the pixels stb_image loaded (RGBA): the image and its view. Frees the pixels.
    void createTexture(stbi_uc* pixels, int texWidth, int texHeight, Texture& texture) {
        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, texture.image, texture.memory);
        stbi_image_free(pixels);

        texture.view = createImageView(texture.image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }

    void destroyTexture(Texture& texture) {
        vkDestroyImageView(device, texture.view, nullptr);
        vkDestroyImage(device, texture.image, nullptr);
        vkFreeMemory(device, texture.memory, nullptr);
    }
```

`createTextureImage` is the helper of the lighting chapters: a staging buffer, a device-local
`VK_FORMAT_R8G8B8A8_UNORM` image, the two layout transitions and the copy. In `cleanup()`, after the sampler, call
`destroyTexture(planetDiffuseMap);` and `destroyTexture(ringsDiffuseMap);`.

Now do the task **textures**. The picture doesn't change – nothing reads the textures yet.

Next the shaders need to reach them: each texture becomes a combined image sampler with a binding of its own. Binding
0 stays the uniform buffer; the textures take bindings 1, 2, … in the order of the constants. In
`createDescriptorSetLayout()` one binding description serves for all of them, copied with a different number:

```cpp
        // a combined image sampler for each texture, read by the fragment shader
        VkDescriptorSetLayoutBinding samplerLayoutBinding{};
        samplerLayoutBinding.descriptorCount = 1;
        samplerLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        samplerLayoutBinding.pImmutableSamplers = nullptr;
        samplerLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {uboLayoutBinding, samplerLayoutBinding, samplerLayoutBinding};
        bindings[1].binding = 1; // planetDiffuseMap
        bindings[2].binding = 2; // ringsDiffuseMap
```

The pool needs room for them:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 1; // the set has one uniform buffer
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 2; // and a combined image sampler for each texture
```

and `createDescriptorSets()` writes one image info per texture, all with the same sampler:

```cpp
        // the textures, in binding order (1, 2, ...): one image info for each, all read with the same sampler
        std::array<VkImageView, 2> textureViews = {planetDiffuseMap.view, ringsDiffuseMap.view};
        std::array<VkDescriptorImageInfo, 2> imageInfos{};
        for (size_t i = 0; i < imageInfos.size(); i++) {
            imageInfos[i].imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            imageInfos[i].imageView = textureViews[i];
            imageInfos[i].sampler = textureSampler;
        }

        std::array<VkWriteDescriptorSet, 3> descriptorWrites{};
        ...
        for (size_t i = 0; i < imageInfos.size(); i++) {
            descriptorWrites[1 + i].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
            descriptorWrites[1 + i].dstSet = descriptorSet;
            descriptorWrites[1 + i].dstBinding = static_cast<uint32_t>(1 + i);
            descriptorWrites[1 + i].dstArrayElement = 0;
            descriptorWrites[1 + i].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
            descriptorWrites[1 + i].descriptorCount = 1;
            descriptorWrites[1 + i].pImageInfo = &imageInfos[i];
        }
```

Now do the task **descriptors**. The picture still doesn't change: the descriptors are there, but the shaders don't
declare them yet.

In learnopengl each mesh is drawn on its own, with its own textures bound to `texture_diffuse1`. We draw the whole
model at once, so the fragment shader has both diffuse maps and has to choose: the vertex's `materialIndex` tells it
which. The vertex shader passes it on:

```glsl
layout(location = 2) out vec2 fragTexCoord;
// "flat": the value of the triangle's first vertex, not interpolated (an integer cannot be)
layout(location = 3) flat out uint fragMaterialIndex;
...
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;
```

Normally the rasterizer interpolates every output between the triangle's three vertices. An integer can't be
interpolated – what would be halfway between material 0 and material 1? – so integer outputs must be declared `flat`:
every fragment gets the value of one vertex of the triangle (the *provoking vertex*, by default the first). All three
vertices of one of our triangles have the same material anyway.

The fragment shader declares the two textures and the input, samples both and keeps the one of the fragment's
material:

```glsl
// the diffuse maps of the model's materials: material 0 "planet" and material 1 "rings"
layout(binding = 1) uniform sampler2D planetDiffuseMap;
layout(binding = 2) uniform sampler2D ringsDiffuseMap;

layout(location = 2) in vec2 fragTexCoord;
layout(location = 3) flat in uint fragMaterialIndex;
...
    // sample the texture of every material, then keep the one of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec4 planetColor = texture(planetDiffuseMap, fragTexCoord);
    vec4 ringsColor = texture(ringsDiffuseMap, fragTexCoord);
    outColor = fragMaterialIndex == 0u ? planetColor : ringsColor;
```

Why sample both rather than `if (fragMaterialIndex == 0u) outColor = texture(planetDiffuseMap, …)`? `texture()`
chooses its level of detail from how fast the texture coordinates change between neighbouring fragments, which the
GPU measures by running fragments in 2×2 groups. Inside an `if` whose condition differs between those neighbours –
on the border between the ring and the planet – some of them don't run the `texture()` call, and the result is
undefined. Sampling both outside the condition is always correct; for two textures the extra sample is cheap.

Now do the task **material-textures**, then build and run. The planet appears textured: blue oceans, green land and the
white north pole at the top – the texture is upright – with the beige bands of the ring around it, seen from slightly
above. This is the picture of learnopengl's `model_loading.cpp`: the diffuse texture only, no lighting.

```quiz
The planet and the ring have different diffuse maps, but the whole model is one `vkCmdDrawIndexed`. How does a fragment of the ring get the colour of `rings.png`?
- [ ] The ring's texture coordinates lie outside 0..1, which selects the second texture
- [x] Each vertex carries its material's number; the fragment shader receives it as `fragMaterialIndex` and keeps the sample of `ringsDiffuseMap` when it is 1
- [ ] The descriptor set is switched halfway through the draw call
- [ ] The sampler chooses the texture by the binding number in the vertex
---
`loadModel()` copied each face's `material_ids` entry into its vertices. Both textures are bound all the time; the material index decides which sample becomes the colour.
```

```quiz
Why is `fragMaterialIndex` declared `flat`?
- [ ] Because `flat` makes the triangle's shading flat, which the ring needs
- [x] Integer outputs cannot be interpolated: `flat` gives every fragment the value of one of the triangle's vertices unchanged
- [ ] So that it is passed as a push constant instead of a vertex attribute
- [ ] To save the fragment shader from normalizing it
---
Interpolation is for values that blend smoothly, like texture coordinates and normals. A material number must arrive exactly as it was – and GLSL requires `flat` for integer inputs of a fragment shader.
```

## An optimization

learnopengl's optimization makes sure no texture file is loaded twice, even if many meshes use it. In our program
each texture file is loaded exactly once by construction: one constant, one `stbi_load`, one `Texture` per file. A
loader for any model would need learnopengl's cache – remember the names of the files already loaded, and reuse their
textures.

Our program has two optimizations of its own: the vertex de-duplication of `loadModel()`, which shrinks the vertex
buffer from 3168 vertices to 657, and the single draw call for the whole model. learnopengl draws each mesh with its
own `glDrawElements` and binds its textures before each one; we bind everything once and let the material index do
the choosing. With many materials that stops scaling – a shader can't sample a hundred textures for every fragment –
and real Vulkan programs then use *arrays* of textures indexed by the material, or draw each material separately with
its own descriptor set. For two materials the simple way is the right one.
:::

:::opengl
## No more containers!

So let's give our implementation a spin by actually importing a model. learnopengl loads a backpack made by an
artist; we load the course's planet. Declare a `Model` object and pass in the model's file location. The model then
automatically loads and (if there were no errors) renders the object in the render loop using its `Draw` function and
that is it. No more buffer allocations, attribute pointers, and render commands, just a simple one-liner:

```cpp
    // load models
    // -----------
    // (no stbi_set_flip_vertically_on_load(true) here: aiProcess_FlipUVs in model.h already turns the texture
    // coordinates the right way up - doing both would turn the textures upside down)
    Model ourModel("models/planet.obj");
```

The model is loaded once, after the shader and before the render loop; the path is relative to the program's
folder. In the render loop it is drawn right after its model matrix is set – the matrix that tilts the planet by 25°
about the x-axis so the ring shows, and scales it to half its size:

```cpp
        // world transformation of the model
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        ourShader.setMat4("model", model);
        ourModel.Draw(ourShader);
```

The shaders are the simple ones from the start of this part: the fragment shader only outputs the object's diffuse
texture:

```glsl
uniform sampler2D texture_diffuse1;

void main()
{
    FragColor = texture(texture_diffuse1, TexCoords);
}
```

Now do the task **draw-model**: `Model::Draw`, and the two lines in `main.cpp`. Build and run: the planet appears,
textured and unlit – blue oceans, green land, the white north pole at the top – with the beige ring around it, seen
slightly from above. Its near side passes in front of the planet; behind the planet the depth test hides it.

```quiz
The fragment shader samples only `texture_diffuse1`, yet the planet shows `planet_diffuse.png` and the ring `rings.png`. Why?
- [x] Each mesh is drawn on its own: before its `glDrawElements`, `Mesh::Draw` binds that mesh's diffuse texture to a unit and points `texture_diffuse1` at it
- [ ] `texture_diffuse1` is an array that holds both textures
- [ ] The shader is compiled twice, once per mesh
- [ ] OpenGL picks the texture whose name matches the mesh's name
---
`Model::Draw` calls `Mesh::Draw` for each mesh, and each call binds its own textures before drawing. The sampler's name stays the same; what is bound to it changes between the draws.
```
:::
:::d3d12
## No more containers!

So let's give our implementation a spin by actually importing a model. learnopengl loads a backpack made by an
artist; we load the course's planet. The application gets a model member:

```cpp
    Model m_model;    // the model: its meshes and their textures
```

It is loaded in `LoadAssets`, while the command list is still open – the textures' copies are recorded into it:

```cpp
    // Load the model: its meshes (vertex and index buffers) and its textures, whose copies
    // are recorded in this command list. The meshes' texture views go into the CBV/SRV heap
    // from slot 1 on (slot 0 is the CBV).
    m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

The end of `LoadAssets` closes the command list, executes it and waits for the GPU with `WaitForPreviousFrame()`.
Only after that wait have the copies happened, and only then may the upload buffers go:

```cpp
        // The textures have been copied: their upload buffers can go.
        m_model.uploadHeaps.clear();
```

Releasing them earlier – say, at the end of `Load` – would free memory the GPU is still going to read. Keeping them
for the whole program wouldn't be wrong, but it would waste memory as big as all the textures together.

Finally, `PopulateCommandList` draws the model right after its model matrix is set as root constants – the matrix that
scales the planet to half its size and tilts it by 25° about the x-axis so the ring shows:

```cpp
    XMMATRIX model = XMMatrixScaling(0.5f, 0.5f, 0.5f)                                            // planet radius 0.5, ring up to 1.0
        * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f), XMConvertToRadians(25.0f))   // tilt it so the ring shows
        * XMMatrixTranslation(0.0f, 0.0f, 0.0f);                                                  // centre of the scene
    ...
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);

    // render the loaded model: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());
```

No more buffer allocations, views and draw calls in `D3D12App`: just a simple one-liner. The pixel shader is the
simple one from the start of this part – it only returns the diffuse texture:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
```

Now do the task **draw-model**, then build and run: the planet appears, textured and unlit – blue oceans, green land,
the white north pole at the top – with the beige ring around it, seen slightly from above. Its near side passes in front
of the planet; behind the planet the depth test hides it.

```quiz
When may `LoadAssets` release the textures' upload buffers (`m_model.uploadHeaps.clear()`)?
- [ ] Never: the textures read from their upload buffers every frame
- [ ] Right after `m_model.Load(…)`, because `TextureFromFile` has copied the pixels by then
- [x] After `WaitForPreviousFrame()`: the copies were only recorded in the command list, and they read from the upload buffers when the GPU executes it
- [ ] Before `m_commandList->Close()`, so that the closed command list doesn't refer to them
---
`UpdateSubresources` copies the pixels into the upload buffer on the CPU, but the copy into the texture is a command. Once the fence says the GPU has finished the command list, the textures hold their pixels and the upload buffers are no longer needed.
```

```quiz
The pixel shader samples only `texture_diffuse1` (register `t0`), yet the planet shows `planet_diffuse.png` and the ring `rings.png`. Why?
- [ ] The static sampler chooses the texture by the mesh's name
- [ ] `t0` is an array that holds both textures
- [x] Each mesh is drawn on its own, and `Mesh::Draw` first sets root parameter 2 to that mesh's two heap slots, so `t0` is the planet's diffuse map in one draw and the ring's in the other
- [ ] The shader is compiled twice, once per mesh
---
`SetGraphicsRootDescriptorTable(2, m_srvHandle)` points the table at the mesh's own SRVs. The register stays the same; the descriptors it reads change between the draws.
```
:::
:::vulkan
## No more containers!

learnopengl loads a backpack made by an artist; we have loaded the course's planet – and nothing in `recordCommandBuffer()`
had to change for it: the same buffers, the same `vkCmdDrawIndexed`, only more indices. Compared with the containers
of the lighting part, everything that is model-specific now comes from files.

The materials also have specular maps, `map_Ks` in `planet.mtl`. They'll be needed for the lighting exercise below,
so load and bind them the same way as the diffuse maps: two more constants after the diffuse ones,

```cpp
// and their specular maps (map_Ks)
const std::string PLANET_SPECULAR_PATH = "models/planet_specular.png";
const std::string RINGS_SPECULAR_PATH = "models/rings_specular.png";
```

two more members (`Texture planetSpecularMap;` and `Texture ringsSpecularMap;`), two more `stbi_load` +
`createTexture` at the end of `createTextures()`, two more `destroyTexture` calls in `cleanup()`, and bindings 3 and
4:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 5> bindings = {uboLayoutBinding, samplerLayoutBinding, samplerLayoutBinding, samplerLayoutBinding, samplerLayoutBinding};
        bindings[1].binding = 1; // planetDiffuseMap
        bindings[2].binding = 2; // ringsDiffuseMap
        bindings[3].binding = 3; // planetSpecularMap
        bindings[4].binding = 4; // ringsSpecularMap
```

The pool's combined image sampler count becomes 4, and `createDescriptorSets()` gets four views, four image infos and
five writes:

```cpp
        std::array<VkImageView, 4> textureViews = {planetDiffuseMap.view, ringsDiffuseMap.view, planetSpecularMap.view, ringsSpecularMap.view};
        std::array<VkDescriptorImageInfo, 4> imageInfos{};
        ...
        std::array<VkWriteDescriptorSet, 5> descriptorWrites{};
```

The order of the `stbi_load` calls is the order of the bindings: planet diffuse, rings diffuse, planet specular,
rings specular. Now do the task **specular-maps**. The picture doesn't change: the shader doesn't read them yet.
:::

## Exercises

learnopengl ends the chapter with a teaser: we can also get more creative and introduce the lights of the lighting
chapters to the render equation, and together with specular maps get amazing results. That is this chapter's last
task: light the model like the *Lighting maps* chapter – a white point light at `lightPos` (1.2, 1.0, 2.0) with
ambient 0.2, diffuse 0.5 and specular 1.0 (no attenuation), Phong shading with the diffuse map as the surface colour
and the specular map for the highlight, shininess 32, and the camera's position as `viewPos`. The vertex shader has
to pass on the fragment's world position and its normal, transformed with the normal matrix. Try it yourself first;
the code follows.

:::opengl
`main.cpp` gets the light's position as a global, and after `ourShader.use();` sets the camera position, the
shininess and the light:

```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
...
        ourShader.use();
        ourShader.setVec3("viewPos", cameraPos);
        ourShader.setFloat("shininess", 32.0f);

        // light properties: a white point light, no attenuation
        ourShader.setVec3("light.position", lightPos);
        ourShader.setVec3("light.ambient", 0.2f, 0.2f, 0.2f);
        ourShader.setVec3("light.diffuse", 0.5f, 0.5f, 0.5f);
        ourShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```

The shininess is a plain uniform this time, not part of a `Material` struct: the material's colours come from the
textures `Mesh::Draw` binds. The vertex shader passes the world position and the normal on:

```glsl
out vec3 FragPos;
out vec3 Normal;
out vec2 TexCoords;
...
    FragPos = vec3(model * vec4(aPos, 1.0));
    Normal = mat3(transpose(inverse(model))) * aNormal;
    TexCoords = aTexCoords;
    gl_Position = projection * view * vec4(FragPos, 1.0);
```

and the fragment shader is the *Lighting maps* shader with the samplers named by the model's convention:

```glsl
out vec4 FragColor;

struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

in vec3 FragPos;
in vec3 Normal;
in vec2 TexCoords;

uniform sampler2D texture_diffuse1;
uniform sampler2D texture_specular1;
uniform float shininess;
uniform vec3 viewPos;
uniform Light light;

void main()
{
    // ambient
    vec3 ambient = light.ambient * texture(texture_diffuse1, TexCoords).rgb;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(light.position - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = light.diffuse * diff * texture(texture_diffuse1, TexCoords).rgb;

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = light.specular * spec * texture(texture_specular1, TexCoords).rgb;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```

`Mesh::Draw` has been setting `texture_specular1` all along; until now the shader didn't declare it, so
`glGetUniformLocation` returned −1 and `glUniform1i` silently ignored the call. Now it finds the uniform, and the
specular map is on texture unit 1.
:::
:::vulkan
The uniform block gets the camera position, the material's shininess and the light, laid out for std140 as in
*Lighting maps* – a padding float after `viewPos` and after each `vec3` of the light, and the one-float material
padded to 16 bytes:

```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
...
// The same layout as the Material struct in the fragment shader (a struct in a uniform block takes a multiple of 16 bytes).
struct Material {
    float shininess;
    float pad1;
    float pad2;
    float pad3;
};

// learnopengl's Light: a position and the strength of each light component (a padding float after each vec3)
struct Light {
    glm::vec3 position;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};

struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    Material material;
    Light light;
};
```

The fragment shader now reads the uniform buffer, so its binding's stage flags become
`VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`, and `updateUniformBuffer()` fills the new members:

```cpp
        ubo.viewPos = cameraPos;

        // material properties: the colours come from the textures
        ubo.material.shininess = 32.0f;

        // light properties
        ubo.light.position = lightPos;
        ubo.light.ambient  = glm::vec3(0.2f, 0.2f, 0.2f);
        ubo.light.diffuse  = glm::vec3(0.5f, 0.5f, 0.5f);
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```

The vertex shader passes the world position and the normal on:

```glsl
layout(location = 0) out vec3 fragPos;
layout(location = 1) out vec3 fragNormal;
layout(location = 2) out vec2 fragTexCoord;
...
void main() {
    // the lighting is calculated in world space: the fragment's position after the model matrix
    fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    // the normal matrix: rotations and scaling of the model matrix without the translation (and right for non-uniform scaling)
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;

    gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);
}
```

The fragment shader declares the specular maps, the structs and the uniform block, samples all four maps, chooses the
diffuse and the specular colour by the material, and computes Phong lighting:

```glsl
layout(binding = 3) uniform sampler2D planetSpecularMap;
layout(binding = 4) uniform sampler2D ringsSpecularMap;

struct Material {
    float shininess;
};

struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
...
    // sample the textures of every material, then keep the ones of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec3 planetDiffuse  = texture(planetDiffuseMap, fragTexCoord).rgb;
    vec3 ringsDiffuse   = texture(ringsDiffuseMap, fragTexCoord).rgb;
    vec3 planetSpecular = texture(planetSpecularMap, fragTexCoord).rgb;
    vec3 ringsSpecular  = texture(ringsSpecularMap, fragTexCoord).rgb;
    vec3 diffuseColor  = fragMaterialIndex == 0u ? planetDiffuse : ringsDiffuse;
    vec3 specularColor = fragMaterialIndex == 0u ? planetSpecular : ringsSpecular;

    // ambient
    vec3 ambient = ubo.light.ambient * diffuseColor;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * diffuseColor;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * specularColor;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
```

The vertex shader's uniform block still declares only `view` and `proj`: it reads only those, and the members it
declares lie at the same offsets as in the fragment shader's longer block.
:::
:::d3d12
As in *Lighting maps*, the normal matrix is computed on the CPU – HLSL has no `inverse()` – and sent with the model
matrix as root constants; `ModelConstants` grows to two matrices, 32 root constants:

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
...
    // The normal matrix: the transpose of the inverse of the model matrix. It keeps the
    // normals perpendicular to the surface even when the model matrix scales unevenly.
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
```

The constant buffer gets the camera position, the material's shininess and the light, packed the way HLSL packs a
cbuffer – a padding float after `viewPos` and after each `XMFLOAT3` of the light, and the one-float material padded
to a full 16-byte row:

```cpp
// lighting
XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);
...
    struct Material
    {
        float shininess;
        float padding0[3];
    };

    // The light: what the shaders see as struct Light.
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };

    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float padding0;
        Material material;
        Light light;
    };
```

`OnUpdate` fills them:

```cpp
    constantBufferData.light.position = lightPos;
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position

    // light properties
    constantBufferData.light.ambient = XMFLOAT3(0.2f, 0.2f, 0.2f);
    constantBufferData.light.diffuse = XMFLOAT3(0.5f, 0.5f, 0.5f);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);

    // material properties
    constantBufferData.material.shininess = 32.0f;
```

In `model_loading.hlsl`, `cbuffer ModelConstants` gets `float4x4 normalMatrix;`, the structs and the new members go
into `cbuffer SceneConstantBuffer`, and the specular map is the second texture of the mesh's table:

```hlsl
struct Material
{
    float shininess;
};

struct Light
{
    float3 position;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};

cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};

Texture2D texture_diffuse1 : register(t0);
Texture2D texture_specular1 : register(t1);    // the specular map: t1
```

The vertex shader hands on the world position and the normal:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoords : TEXCOORD;
};
...
    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoords = texCoords;
    result.position = mul(mul(worldPos, view), projection);
```

and the pixel shader computes Phong lighting with both maps:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 diffuseColor = texture_diffuse1.Sample(wrapSampler, input.texCoords).rgb;

    // ambient
    float3 ambient = light.ambient * diffuseColor;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * diff * diffuseColor;

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * spec * texture_specular1.Sample(wrapSampler, input.texCoords).rgb;

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```

`SetupMesh` has put each mesh's specular map into its second heap slot all along, and the table of root parameter 2
already covers two SRVs: only the shader had to start reading `t1`.
:::

Now do the task **lighting**, then build and run. The planet is lit from the upper right front, where the light is: the
side facing it is brightest, the lower left only gets the ambient light, and the whole picture is darker than before (at
most 0.2 + 0.5 of the texture's colour, plus the highlight). The ring, a flat disc, is lit evenly.

And the highlight? With this camera the reflection of the light falls a little right of and above the centre of the
planet – on land. The planet's specular map is dark on land and bright on the oceans (the water shines, the ground
hardly), so the highlight is only a faint, soft spot. Move the camera with A and D or the mouse until the highlight
lands on an ocean, and it becomes a small bright spot.

```quiz
With the lighting done, the highlight at the light's reflection is only a faint spot. Why?
- [x] The reflection falls on land, where the planet's specular map is dark; on an ocean, where the map is bright, the same highlight is strong
- [ ] The shininess of 32 is too low for a visible highlight
- [ ] Specular lighting doesn't work on a model loaded from a file
- [ ] The light has no specular component
---
The specular term is multiplied by the specular map's colour at that fragment. Move the camera so the reflection lands on water, and the highlight lights up.
```

Admittedly, this is a bit more fancy than the containers we've used so far. With a model loader you can
load tons of models found on the internet: there are quite a few websites that offer free 3D models in several file
formats. Do note that some models still won't load properly, have texture paths that won't work, or are simply
exported in a format your loader can't read.

## Further reading

- [learnopengl.com: Model](https://learnopengl.com/Model-Loading/Model): the original chapter, with its backpack
  model.
- [learnopengl's model.h](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/includes/learnopengl/model.h): the
  complete `Model` class this chapter follows.
:::vulkan
- [vulkan-tutorial.com: Loading models](https://vulkan-tutorial.com/Loading_models): tinyobjloader and vertex
  de-duplication, with a single-material model.
:::
:::d3d12
- [Uploading texture data through buffers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/upload-and-readback-of-texture-data):
  why a texture's pixels go through an upload buffer, and how long it must live.
:::
