# Assimp

In all the scenes so far we've been extensively playing with our little container friend, but over time, even our
best friends can get a little boring. In bigger graphics applications, there are usually lots of complicated and
interesting models that are much prettier to look at than a static container. However, unlike the container object,
we can't really manually define all the vertices, normals and texture coordinates of complicated shapes like houses,
vehicles or human-like characters. What we want instead is to *import* these models into the application: models
that were carefully designed by 3D artists in tools like Blender, 3DS Max or
Maya.

These so called *3D modelling tools* allow artists to create complicated shapes and apply textures to them via a
process called *uv-mapping*. The tools then automatically generate all the vertex coordinates, vertex normals and
texture coordinates while exporting them to a model file format we can use. This way, artists have an extensive
toolkit to create high quality models without having to care too much about the technical details. All the
technical aspects are hidden in the exported model file. We, as graphics programmers, *do* have to care about these
technical details though.

It is our job to parse these exported model files and extract all the relevant information so we can store them in
a format that {{api}} understands. A common issue is that there are dozens of different file formats, each exporting
the model data in its own unique way. Model formats like the Wavefront `.obj` only contain model data with minor
material information like model colors and diffuse/specular maps, while model formats like the XML-based Collada
file format are extremely extensive and contain models, lights, many types of materials, animation data, cameras,
complete scene information, and much more. The Wavefront object format is generally considered to be an easy-to-parse
model format, and it is worth looking inside such a file once to see how its data is structured – we'll do that
with this part's model below. This should give you a basic perception of how model file formats are generally
structured.

All by all, there are many different file formats where a common general structure between them usually does not
exist. So if we want to import a model from these file formats, we'd have to write an importer ourselves for each of
the file formats we want to import. Luckily for us, there just happens to be a library for this.

## The model of this part

learnopengl.com uses a backpack model for this part; this course has a model of its own: a small planet with a ring,
`models/planet.obj`. It is a Wavefront `.obj` file, a plain text file you can open in your IDE (**Copy start files**
puts it into your project folder). Its first lines name the material library, `planet.mtl`, and start the first object:

```text
# A small planet with a ring - drawn for Codestead GP (see make_planet.py).
mtllib planet.mtl
o planet
```

Then come lists of numbers. `v` is a vertex position, `vt` a texture coordinate and `vn` a normal, one per line:

```text
v 0.07466 0.98079 -0.18024
...
vt 0.18750 0.93750
...
vn 0.07466 0.98079 -0.18024
```

`usemtl planet` says that the faces after it use the material `planet` of `planet.mtl`, and the faces themselves are
`f` lines. Each corner of a face is a triple *position/texture coordinate/normal* – three indices, counted from 1,
into the three lists:

```text
usemtl planet
...
f 101/101/101 102/102/102 69/69/69
```

The second object, `o rings`, is a flat ring around the planet. All its faces point the same way, so all their
corners share one normal – the third index stays 562 while the positions change:

```text
o rings
...
usemtl rings
...
f 562/562/562 563/563/562 565/565/562
```

The planet is a sphere of radius 1 (960 triangles), the ring reaches from 1.4 to 2.0 (96 triangles), and `planet.mtl`
describes the two materials, each with a diffuse map (`map_Kd`) and a specular map (`map_Ks`) – exactly the lighting
maps of the last part:

```text
newmtl planet
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.5 0.5 0.5
Ns 32.0
map_Kd planet_diffuse.png
map_Ks planet_specular.png

newmtl rings
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.1 0.1 0.1
Ns 8.0
map_Kd rings.png
map_Ks rings_specular.png
```

Notice that a face corner has *three* indices, one per list, while a GPU vertex – in {{api}} as everywhere – has
*one* index that selects all its attributes at once. The ring shows why the file does it this way: 98 positions, but
only one normal. A model loader therefore has to build its own vertices: one for every different combination of
position, texture coordinate and normal.

```quiz
A corner of a face in the `.obj` file is written `563/563/562`. Why can't the GPU use these numbers directly as its index buffer?
- [x] They are three separate indices – into the positions, the texture coordinates and the normals – while an index buffer has one index per vertex that selects all its attributes together
- [ ] Because the GPU can only draw quads, and OBJ faces are triangles
- [ ] Because OBJ indices are floats
---
The file stores each list without repeats, and every corner picks from each list on its own. The GPU's vertex fetch reads one vertex – position, normal and texture coordinates side by side – per index. So the loader turns every distinct triple into one vertex (OBJ indices also start at 1, the GPU's at 0).
```

## A model loading library

A very popular model importing library out there is called [Assimp](https://learnopengl.com/Model-Loading/Assimp)
that stands for *Open Asset Import Library*. Assimp is able to import dozens of different model file formats (and
export to some as well) by loading all the model's data into Assimp's generalized data structure. As soon as Assimp
has loaded the model, we can retrieve all the data we need from Assimp's data structure. Because the data structure
of Assimp stays the same, regardless of the type of file format we imported, it abstracts us from all the different
file formats out there.

When importing a model via Assimp it loads the entire model into a *scene* object that contains all the data of the
imported model/scene. Assimp then has a collection of nodes where each node contains indices to data stored in the
scene object where each node can have any number of children. learnopengl.com shows this as a diagram; in words, the
(simplified) model of Assimp's structure is:

- **The scene** (`aiScene`): all the data of the scene/model is contained in the `aiScene` object, like all the
  materials (`mMaterials`) and the meshes (`mMeshes`). It also contains a reference to the root node of the scene
  (`mRootNode`).
- **The nodes** (`aiNode`): the root node of the scene may contain children nodes (like all other nodes,
  `mChildren`) and could have a set of indices that point to mesh data in the scene object's `mMeshes` array. The
  scene's `mMeshes` array contains the actual `aiMesh` objects; the values in the `mMeshes` array of a node are only
  indices for the scene's meshes array.
- **A mesh** (`aiMesh`): a mesh object itself contains all the relevant data required for rendering, think of vertex
  positions (`mVertices`), normal vectors (`mNormals`), texture coordinates (`mTextureCoords`), faces (`mFaces`) and
  the material of the object (`mMaterialIndex`).
- **A face** (`aiFace`): a mesh contains several faces. A face represents a render primitive of the object
  (triangles, squares, points). A face contains the indices of the vertices that form a primitive (`mIndices`).
  Because the vertices and the indices are separated, this makes it easy for us to render via an index buffer (see
  *Hello Triangle*).
- **A material** (`aiMaterial`): finally a mesh also links to a material object that hosts several functions to
  retrieve the material properties of an object. Think of colors and/or texture maps (like diffuse and specular maps).

Unlike the `.obj` file, an `aiMesh` already has *one* index per vertex: Assimp's importer has made the vertices out of
the file's position/texture coordinate/normal triples, so its faces can go straight into an index buffer.

What we want to do is: first load an object into a scene object, recursively retrieve the corresponding mesh objects
from each of the nodes (we recursively search each node's children), and process each mesh object to retrieve the
vertex data, indices, and its material properties. The result is then a collection of mesh data that we want to
contain in a single `Model` object.

```quiz
In Assimp's structure, where is the vertex data of a mesh actually stored?
- [x] In the `aiMesh` objects of the scene's `mMeshes` array; a node only holds indices into that array
- [ ] In the material, next to the textures
- [ ] In the node: every `aiNode` holds its own vertices
---
The scene owns all meshes and materials. Nodes only organise them – which meshes belong together and how the parts are related (parent/children) – by storing indices into `scene->mMeshes`. So the loader walks the nodes and looks every mesh up in the scene.
```

> **Mesh**
>
> When modelling objects in modelling toolkits, artists generally do not create an entire model out of a single
> shape. Usually, each model has several sub-models/shapes that it consists of. Each of those single shapes is
> called a *mesh*. Think of a human-like character: artists usually model the head, limbs, clothes, and weapons all
> as separate components, and the combined result of all these meshes represents the final model. A single mesh is
> the minimal representation of what we need to draw an object in {{api}} (vertex data, indices, and material
> properties). A model (usually) consists of several meshes.

Our planet is such a model: the `o planet` and `o rings` objects of the file become two meshes, each with its own
material – the planet's surface and the ring look different and have different textures, so they can't share one.
For an `.obj` file, Assimp makes a root node with a child node per object, and each child refers to its mesh.

```quiz
Why does `planet.obj` consist of two meshes, `planet` and `rings`, and not one?
- [ ] Because Assimp can only load objects that are spheres
- [x] A mesh has exactly one material, and the planet and the ring have different materials (different diffuse and specular maps)
- [ ] Because a mesh can have at most 1000 triangles
---
A mesh is the smallest unit we draw with one set of textures. Everything that needs other textures – here the ring with `rings.png` and `rings_specular.png` – becomes a mesh of its own, and the model is the collection of both.
```

In the next chapters we'll create our own `Model` and `Mesh` class that load and store imported models using the
structure we've just described. If we then want to draw a model, we do not render the model as a whole, but we render
all of the individual meshes that the model is composed of.

:::vulkan
### Vulkan: tinyobjloader

Vulkan has no model loader of its own – just as it has no image loader. vulkan-tutorial.com's chapter
[Loading models](https://vulkan-tutorial.com/Loading_models) uses the small library **tinyobjloader** instead of
Assimp, and so does this course. Assimp would work just as well with Vulkan (its data is API-independent), but it is a
large library with many dependencies, while tinyobjloader is a single header, `tiny_obj_loader.h`, like
`stb_image.h`. The price: it reads only one format, Wavefront `.obj` with its `.mtl` file.

tinyobjloader has no scene or nodes. One call, `tinyobj::LoadObj`, fills three flat structures:

- **`tinyobj::attrib_t attrib`** – all positions, normals and texture coordinates of the file as flat arrays of
  floats: `attrib.vertices` (3 floats per position), `attrib.normals` (3 per normal) and `attrib.texcoords` (2 per
  texture coordinate). These are the file's `v`, `vn` and `vt` lists.
- **`std::vector<tinyobj::shape_t> shapes`** – the objects of the file (`o planet`, `o rings`). Each shape's
  `mesh.indices` has a `tinyobj::index_t` per face corner with three members, `vertex_index`, `normal_index` and
  `texcoord_index` – the triples of the `f` lines, counted from 0. `mesh.material_ids` has the material number of
  every face. `LoadObj` turns every face into triangles unless you ask it not to, so face `i` has the corners
  `3 * i` to `3 * i + 2`.
- **`std::vector<tinyobj::material_t> materials`** – the materials of the `.mtl` file in the file's order (`planet`
  = 0, `rings` = 1), with their colours and texture names (`diffuse_texname`, `specular_texname` …).

So in Vulkan the "mesh" of learnopengl is a range of faces with one material number – the work of Assimp's importer,
building one vertex per distinct triple, is ours: the *Model* chapter does it with a hash map, which is why the
*Mesh* chapter gives our `Vertex` an `operator==` and a hash function. Because everything ends up in one vertex
buffer, the course draws the whole model with a single draw call and lets each vertex carry its material number.

Using it takes the same two lines as `stb_image.h`, in exactly one source file:

```cpp
#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
```

The define makes that file compile the library's code as well; there is nothing to link.
:::

## Building Assimp

:::opengl
You can download Assimp from its GitHub page and choose the corresponding version; any current version works with
the code of this part. It is advised to compile the libraries by yourself, since their pre-compiled libraries don't always work on all systems.
Review the *Creating a window* chapter if you forgot how to compile a library by yourself via CMake.

On Linux it is easier: the distribution's package (for example `libassimp-dev` on Debian and Ubuntu) has the headers
and the shared library. Then the program links with one more library:

```text
g++ -std=c++17 main.cpp glad.c -Iinclude -o model_loading -lglfw -ldl -lassimp
```

:::ide clion vscode
Install Assimp – on Debian and Ubuntu `libassimp-dev`, on macOS `brew install assimp`, on Windows with
[vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) `vcpkg install assimp:x64-windows` – and add two
lines to the end of your `CMakeLists.txt`, for this and every later chapter:

```text
find_package(assimp REQUIRED)
target_link_libraries(${PROJECT_NAME} PRIVATE assimp::assimp)
```

`find_package` finds the installed library, and linking the target `assimp::assimp` adds its include folder and its
library. With vcpkg, CMake has to use vcpkg's toolchain file: pass
`-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake` to CMake (in CLion under **CMake options** in the
profile, in VS Code in the setting `cmake.configureSettings`). The toolchain then also copies Assimp's DLL next to your
program.
:::
:::ide vs rider
The easiest way on Windows is [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview):
`vcpkg install assimp:x64-windows` builds Assimp, and `vcpkg integrate install` (once) makes every Visual Studio project
find the libraries vcpkg installed – Rider builds the same projects. Your project then gets Assimp's include folder and
library by itself, and vcpkg copies Assimp's DLL next to your `.exe` when you build. Without vcpkg you build Assimp from
its sources with CMake, add its `include` folder to **Additional Include Directories**, its `.lib` to **Additional
Dependencies** (and that file's folder to **Additional Library Directories**), and copy its DLL next to your `.exe` –
the program would not start without it.
:::

The headers you need are `<assimp/Importer.hpp>` (the `Assimp::Importer` class that reads a file), `<assimp/scene.h>`
(the `aiScene`, `aiNode`, `aiMesh` … structures) and `<assimp/postprocess.h>` (the flags of the post-processing steps
that Assimp can apply while loading, like turning every face into triangles).
:::
:::vulkan
learnopengl.com's OpenGL code needs Assimp built and linked, as described on its page. For this course's Vulkan program
there is nothing to build: tinyobjloader is one header. You download `tiny_obj_loader.h` from its GitHub page
(vulkan-tutorial does exactly that) into `libs/tinyobjloader` – your project from *Setting up your IDE* already has that
folder among its include folders. If you do want Assimp for Vulkan – for other formats, or animations – the *Skeletal
Animation* guest article, which needs it, shows how to add it.
:::
:::d3d12
The DirectX 12 program uses Assimp too: the course ports learnopengl's `Mesh` and `Model` classes, so it needs the
same library.

:::ide clion vscode
Install Assimp with [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) –
`vcpkg install assimp:x64-windows` – and add two lines to the end of your `CMakeLists.txt`, for this and every later
chapter:

```text
find_package(assimp REQUIRED)
target_link_libraries(${PROJECT_NAME} PRIVATE assimp::assimp)
```

`find_package` finds the installed library, and linking the target `assimp::assimp` adds its include folder and its
library. With vcpkg, CMake has to use vcpkg's toolchain file: pass
`-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake` to CMake (in CLion under **CMake options** in the
profile, in VS Code in the setting `cmake.configureSettings`). The toolchain then also copies Assimp's DLL next to your
program.
:::
:::ide vs rider
The easiest way on Windows is [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview):
`vcpkg install assimp:x64-windows` builds Assimp, and `vcpkg integrate install` (once) makes every Visual Studio project
find the libraries vcpkg installed – Rider builds the same projects. Your project then gets Assimp's include folder and
library by itself, and vcpkg copies Assimp's DLL next to your `.exe` when you build. Without vcpkg you build Assimp from
its sources with CMake, add its `include` folder to **Additional Include Directories**, its `.lib` to **Additional
Dependencies** (and that file's folder to **Additional Library Directories**), and copy its DLL next to your `.exe` –
the program would not start without it.
:::

The headers are `<assimp/Importer.hpp>` (the `Assimp::Importer` class that reads a file), `<assimp/scene.h>` (the
`aiScene`, `aiNode`, `aiMesh` … structures) and `<assimp/postprocess.h>` (the flags of the post-processing steps that Assimp can apply while loading, like turning every face into triangles).

One thing to know when Assimp meets Direct3D: Assimp hands out its data in a right-handed coordinate system with
counter-clockwise front faces, OpenGL's conventions, and it has a post-processing flag,
`aiProcess_ConvertToLeftHanded`, for programs that work left-handed. Our DirectX 12 program has used right-handed
matrices (`XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH`) since *Coordinate Systems*, like learnopengl, so it loads
the model unchanged.
:::

:::opengl
```quiz
Your OpenGL program now calls `Assimp::Importer::ReadFile`. What does the build need in addition to the earlier chapters?
- [ ] Only `#define ASSIMP_IMPLEMENTATION` in one source file, like stb_image
- [x] Assimp's headers (`<assimp/Importer.hpp>`, `<assimp/scene.h>`, `<assimp/postprocess.h>`) and its library at link time – `-lassimp` on Linux
- [ ] Nothing: Assimp is part of OpenGL
---
Assimp is a compiled library, not a single header: the headers declare its classes and functions, and the linker needs the library that contains them. That's why the build gets `-lassimp` (or Assimp's `.lib` and DLL on Windows).
```
:::
:::vulkan
```quiz
How does the Vulkan program get tinyobjloader's code into the build?
- [x] `#define TINYOBJLOADER_IMPLEMENTATION` before `#include <tiny_obj_loader.h>` in exactly one source file – the header then contains the library's code
- [ ] Vulkan loads `.obj` files itself; tinyobjloader is only needed for the `.mtl` file
- [ ] It links with `-ltinyobjloader`
---
tinyobjloader is a single-header library like `stb_image.h`: normally the header only declares, and in the one file with the define it also compiles the implementation. There is nothing to link.
```
:::
:::d3d12
```quiz
The DirectX 12 program calls `Assimp::Importer::ReadFile`. What does the project need for that?
- [x] Assimp's include folder and its library at link time (and its DLL next to the `.exe`) – for example installed with `vcpkg install assimp`
- [ ] Only `#define ASSIMP_IMPLEMENTATION` in one source file, like stb_image
- [ ] Nothing: Assimp is part of the Windows SDK, like `d3d12.lib`
---
Assimp is a compiled library, not a single header: the headers declare its classes and functions, the linker needs its `.lib`, and the program loads its DLL when it starts. vcpkg's integration sets up the include folder and the library for you.
```
:::

## The project

This chapter has no code to write – learnopengl's *Assimp* chapter has none either. Its project is already the one the
next two chapters work in, so you can look around in it, then build and run: the window shows only the dark grey clear
colour (0.05, 0.05, 0.05), since nothing is drawn yet. (In the next chapters the `// TODO:` comments mark where your
code goes, and you build and run it in your IDE as before.)

:::opengl
The project is learnopengl's `model_loading.cpp` scene before the model: `main.cpp` with the camera of the *Camera*
chapter at (0, 0, 3) looking down -z (WASD, mouse look and zoom), the depth test, one shader
`Shader ourShader("model_loading.vs", "model_loading.fs");`, and the matrices – including the model matrix that
tilts the planet by 25° about the x-axis so you can see the ring, and scales it by 0.5:

```cpp
        // world transformation of the model
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        ourShader.setMat4("model", model);
```

The shaders are learnopengl's `1.model_loading.vs/.fs`: the vertex shader takes a position, a normal and texture
coordinates (locations 0, 1 and 2), and the fragment shader outputs the colour of `texture_diffuse1` – a name you'll
understand in the next chapter. `mesh.h` waits with `// TODO:` comments for the *Mesh* chapter; `model.h` and
Assimp's headers arrive in the *Model* chapter.
:::
:::vulkan
The project is learnopengl's `model_loading.cpp` scene before the model, in Vulkan: the camera of the *Camera*
chapter at (0, 0, 3) looking down -z (WASD, mouse look and zoom), a depth buffer, one pipeline `modelPipeline` from
`shaders/model_loading.vert` and `.frag`, the uniform buffer with the view and projection matrices at binding 0, and
the model matrix as a push constant – it tilts the planet by 25° about the x-axis so you can see the ring, and scales
it by 0.5. Culling is off (`VK_CULL_MODE_NONE`): the ring is a single flat surface that must be visible from both
sides. The `// TODO:` comments in `main.cpp` and the shaders are for the *Mesh* chapter; tinyobjloader arrives in the
*Model* chapter.
:::
:::d3d12
The project is learnopengl's `model_loading.cpp` scene before the model, in DirectX 12: the camera of the *Camera*
chapter at (0, 0, 3) looking down -z (WASD, mouse look and zoom), a depth buffer, `model_loading.hlsl` with
learnopengl's model shaders (`VSMain` takes `POSITION`, `NORMAL` and `TEXCOORD`, `PSMain` returns the colour of
`texture_diffuse1`), and the model matrix as root constants – it tilts the planet by 25° about the x-axis so you can
see the ring, and scales it by 0.5. Culling is off (`D3D12_CULL_MODE_NONE`): the ring is a single flat surface that
must be visible from both sides. The root signature already has a table of two textures (t0 and t1) for root parameter
2, which every mesh will set when it is drawn. The `// TODO:` comments in `main.cpp` are for the *Mesh* chapter;
Assimp's headers arrive in the *Model* chapter.
:::

```quiz
In the next chapters, how will the program draw the loaded planet?
- [ ] By asking the model loader to draw it
- [x] By drawing each of its meshes – the planet and the ring – with that mesh's own vertices, indices and textures
- [ ] As one object with one texture, since a model is a single shape
---
A model loader only reads data; drawing is our job. A model is a collection of meshes, so drawing the model means drawing every mesh with its own material's textures.
```

Now that we've hopefully got an idea of how Assimp is set up, we can start to write a class that holds the data of
one mesh: the *Mesh* chapter.

## Additional resources

- [Assimp](https://learnopengl.com/Model-Loading/Assimp) on learnopengl.com: the chapter this one follows, with the
  diagram of Assimp's structure.
:::vulkan
- [Loading models](https://vulkan-tutorial.com/Loading_models) on vulkan-tutorial.com: loading an `.obj` file with
  tinyobjloader.
:::
:::d3d12
- [What is vcpkg?](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) on Microsoft Learn: the package
  manager that installs Assimp for a Visual Studio project.
:::
