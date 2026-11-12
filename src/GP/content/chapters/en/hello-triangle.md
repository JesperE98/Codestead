# Hello Triangle

In the previous chapter you cleared the window to a colour. Now you'll draw something in it: a triangle. Drawing a
single triangle sounds simple, but it touches almost every part of the graphics pipeline, so this is one of the
longest chapters of the course. Take your time with it. Once you understand how this one triangle gets on the
screen, you understand the core of every program in the rest of the course.

In a 3D program everything lives in a 3D coordinate system, but the screen (and your window) is a 2D array of
pixels. A large part of {{api}}'s work is to turn 3D coordinates into 2D pixels that fit on your screen. This is done
by the **graphics pipeline**. The graphics pipeline can be split into two large parts: the first turns your 3D
coordinates into 2D coordinates, the second turns those 2D coordinates into actual coloured pixels.

As usual, the chapter's start files have `// TODO:` comments that mark where your code goes, and you build and run the
program in your IDE. Until you reach the draw task, the program only shows the teal window from the previous chapter.

## The graphics pipeline

The graphics pipeline takes a list of 3D coordinates as input and turns them into coloured 2D pixels on the screen.
It is divided into several steps, where each step takes the output of the previous step as its input. Every step is
specialised in one thing, which is why they can easily run in parallel. Because of this parallel nature, today's
graphics cards have thousands of small processing cores that run small programs for each step of the pipeline on
the GPU. These small programs are called **shaders**.

Some of the shaders can be written by you. This lets you replace the default behaviour of a stage with your own
code, which gives you much finer control over specific parts of the pipeline – and because shaders run on the GPU,
they save CPU time. Shaders for {{api}} are written in {{shaderLanguage}}; more about that in the next sections.

Here is an overview of the stages, in the order the data flows through them:

1. **Vertex input.** You pass in a list of three 3D coordinates that should form a triangle: the **vertex data**.
   A *vertex* is a collection of data for one 3D coordinate. Its data is made of *vertex attributes* that can hold
   any data you like; for now, each vertex has only a 3D position.
2. **Vertex shader.** The first programmable stage. It runs once per vertex and transforms the 3D coordinate into
   another 3D coordinate (more about that later). It can also do some basic processing on the vertex attributes.
3. **Geometry shader** (optional). It receives a collection of vertices that form a primitive and can generate other
   shapes by emitting new vertices. You won't use one in this course's early chapters.
4. **Primitive assembly** (learnopengl calls it *shape assembly*). Takes the vertices and assembles them into the
   primitive shape you asked for – in this chapter, triangles. To know what to make of your coordinates, the
   pipeline needs a hint: do they form points, lines or triangles?
5. **Rasterization.** Maps the primitives to the corresponding pixels on the screen, producing **fragments**.
   A fragment is all the data needed to render a single pixel. Before the fragment shaders run, *clipping* throws
   away everything that lies outside your view.
6. **Fragment shader.** Runs once per fragment and calculates its final colour. This is usually where all the
   advanced effects happen: later on, the fragment shader uses the lighting, shadows and textures of the scene to
   compute the colour.
7. **Tests and blending.** Checks the fragment's depth (and stencil) value to decide whether the fragment is in
   front of or behind other objects and should be kept, and blends it with the colour already in the framebuffer
   (for transparency). So even if a fragment shader computed a colour, the final pixel colour can end up different.

Every API has these stages, but they have slightly different names:

| Stage | OpenGL | Vulkan | Direct3D 12 |
|---|---|---|---|
| Reading the vertex data | vertex specification (VAO) | input assembler | input assembler (IA) |
| Per vertex | vertex shader | vertex shader | vertex shader (VS) |
| Optional | geometry shader | tessellation and geometry shaders | hull/domain shaders (tessellation), geometry shader (GS) |
| Building primitives | shape assembly | input assembly (topology) | primitive topology (IA) |
| Turning primitives into pixels | rasterization | rasterization | rasterizer (RS) |
| Per pixel | fragment shader | fragment shader | pixel shader (PS) |
| Depth/stencil tests and blending | tests and blending | depth/stencil tests and colour blending | output merger (OM) |

:::opengl
As you can see, the graphics pipeline is quite complex and has many configurable parts. For almost all the cases
you'll meet, you only have to work with the vertex and fragment shader; the geometry shader is optional and usually
left to its default. In modern OpenGL you are **required** to define at least a vertex and a fragment shader of
your own – there are no defaults on the GPU. That is why learning modern OpenGL is often harder at the start: a lot
of knowledge is needed before you can render your first triangle. Once you have it, you'll understand graphics
programming much better.
:::
:::vulkan
In Vulkan, the whole pipeline is one object: a `VkPipeline`. You write the vertex and fragment shader, and you
describe every fixed-function stage (input assembly, rasterization, blending …) in structures. Almost all of it is
fixed once the pipeline is created: if you want a different shader or a different rasterizer setting, you create a
different pipeline. That sounds strict, but it lets the driver optimise everything up front – nothing has to be
checked or recompiled while you draw. In return, Vulkan needs more code than OpenGL before the first triangle
appears: this chapter has nine tasks.
:::
:::d3d12
Notice that the Direct3D 12 command list methods are named after the stages: `IASetVertexBuffers` (input
assembler), `RSSetViewports` (rasterizer), `OMSetRenderTargets` (output merger). Direct3D calls the fragment shader
a **pixel shader**. Like Vulkan, Direct3D 12 bundles the shaders and almost all fixed-function settings into one
object, the **pipeline state object** (PSO), which is created once and then only switched on. You write the vertex
and the pixel shader yourself, in HLSL.
:::

```quiz
Which stage turns a triangle into the fragments (the pixels to be coloured) that it covers?
- [x] Rasterization
- [ ] The vertex shader
- [ ] Blending
---
The vertex shader only works on the corners. The rasterizer works out which pixels the triangle covers and creates a fragment for each of them; the fragment shader then colours each fragment.
```

## Vertex input

To start drawing something, you first have to give {{api}} some input vertex data. {{api}} is a 3D graphics
library, so all coordinates you specify are 3D coordinates (x, y and z). It does not simply turn *all* your 3D
coordinates into pixels on the screen: it only processes 3D coordinates that are in a specific range between `-1.0`
and `1.0` on all three axes (for Vulkan and Direct3D, z goes from `0.0` to `1.0`; it does not matter here because
all our z values are `0.0`). All coordinates within this so-called **normalized device coordinates** (NDC) range
end up visible on your screen; everything outside it is clipped.

Because you want to render a single triangle, you specify a total of three vertices, each with a 3D position. You
define them in normalized device coordinates (the visible region), with z = 0 so the triangle looks 2D: it has no
depth.

:::opengl
```cpp
float vertices[] = {
    -0.5f, -0.5f, 0.0f, // left
     0.5f, -0.5f, 0.0f, // right
     0.0f,  0.5f, 0.0f  // top
};
```

In OpenGL's normalized device coordinates, (0, 0) is the centre of the window, x grows to the right and **y grows
upwards**. So `(0.0, 0.5)` is the top corner, half-way between the centre and the top edge. Unlike usual screen
coordinates, the positive y axis points up.
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    {{0.0f, -0.5f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}}
};
```

Each entry is a `Vertex`, a struct with one `glm::vec3 pos` (you'll write it in the section *Linking vertex
attributes*). In Vulkan's normalized device coordinates, (0, 0) is the centre of the window and x grows to the right
– but **y points down**: `y = -1` is the top edge and `y = 1` the bottom edge, like pixel coordinates in an image.
If you have seen OpenGL, the sign of y is flipped. That is why the triangle is mirrored compared to learnopengl's:
the top corner is `(0.0, -0.5)`, and the two bottom corners have `y = 0.5`.

The order of the vertices matters too: top, bottom right, bottom left goes **clockwise** on the screen. You'll tell
the rasterizer later that clockwise triangles are front faces and that back faces are culled (not drawn). If you
only flipped the sign of y in learnopengl's list and kept its order (left, right, top), the triangle would be
counter-clockwise on the screen and disappear.
:::
:::d3d12
```cpp
Vertex vertices[] =
{
    { { 0.0f, 0.5f, 0.0f } },
    { { 0.5f, -0.5f, 0.0f } },
    { { -0.5f, -0.5f, 0.0f } }
};
```

`Vertex` is already declared in the class: `struct Vertex { XMFLOAT3 position; };`, three floats per vertex.
Direct3D's normalized device coordinates are like OpenGL's: (0, 0) is the centre, x grows to the right and **y grows
upwards**, so `(0.0, 0.5)` is the top corner.

But note the order: top, bottom right, bottom left – not learnopengl's left, right, top. On the screen this order
goes **clockwise**. Direct3D's default rasterizer state treats clockwise triangles as front faces and *culls* (does
not draw) the back faces. learnopengl's order is counter-clockwise, so in Direct3D 12 that triangle would simply be
missing. You'll see the rasterizer settings in the section *Linking vertex attributes*.
:::

Your normalized device coordinates are then transformed to **screen-space coordinates** via the *viewport
transform*, using the viewport you give the API. The window in this course is 800×600 pixels and the viewport
covers all of it, so the triangle's corners end up at the pixels (400, 150), (600, 450) and (200, 450), counted from
the top left corner of the window. These screen-space coordinates are then turned into fragments as input to your
fragment shader.

```quiz
The window is 800×600 and the viewport covers all of it. Which of these vertex positions lies outside the visible region?
- [ ] (0.9, -0.9, 0.0)
- [ ] (0.0, 0.0, 0.0)
- [x] (1.2, 0.0, 0.0)
---
Only coordinates between -1.0 and 1.0 are inside the normalized device coordinates; x = 1.2 lies to the right of the window's edge and is clipped. (0, 0) is the centre of the window.
```

### Vertex buffer objects

With the vertex data defined, you want to send it as input to the first stage of the pipeline: the vertex shader.
That means creating memory on the GPU where you store the vertex data, telling the API how to interpret that
memory, and specifying how to send the data to the graphics card. Sending data from the CPU to the graphics card is
relatively slow, so you try to send as much data as possible at once – and keep it there. Once the data is in the
graphics card's memory, the vertex shader has almost instant access to the vertices.

:::opengl
This memory is managed by a **vertex buffer object** (VBO), which can store a large number of vertices in the GPU's
memory. Just like any object in OpenGL, the buffer has a unique ID, which you generate with `glGenBuffers`:

```cpp
unsigned int VBO;
glGenBuffers(1, &VBO);
```

OpenGL has many types of buffer objects, and the buffer type of a vertex buffer object is `GL_ARRAY_BUFFER`. You can
bind several buffers at once as long as they have different types. Bind the new buffer to the `GL_ARRAY_BUFFER`
target with `glBindBuffer`:

```cpp
glBindBuffer(GL_ARRAY_BUFFER, VBO);
```

From then on, any buffer call you make on the `GL_ARRAY_BUFFER` target configures the currently bound buffer,
`VBO`. Now `glBufferData` copies the vertex data into the buffer's memory:

```cpp
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

`glBufferData` is a function specifically meant to copy user-defined data into the currently bound buffer. Its first
argument is the type of buffer you want to copy data into: the vertex buffer object currently bound to
`GL_ARRAY_BUFFER`. The second argument is the size of the data in bytes; a simple `sizeof` of the vertex data is
enough. The third argument is the actual data.

The fourth argument tells the graphics card how you want to use the data:

- `GL_STREAM_DRAW`: the data is set only once and used by the GPU at most a few times.
- `GL_STATIC_DRAW`: the data is set only once and used many times.
- `GL_DYNAMIC_DRAW`: the data is changed a lot and used many times.

The triangle's position doesn't change, is used a lot and stays the same for every render call, so the best usage
type is `GL_STATIC_DRAW`. If the data were likely to change frequently, `GL_DYNAMIC_DRAW` would let the driver
place it in memory that allows faster writes.

At the end of the program, everything you created should be deleted again. The project has a clean-up section at
the end of `main` for that: `glDeleteBuffers(1, &VBO);`.

Now do the first task: put the three vertices in `float vertices[]`, create the VBO, bind it and fill it with
`glBufferData`, and delete it in the clean-up. Build & run: nothing changes yet – the data is on the GPU, but
nothing uses it.
:::
:::vulkan
In Vulkan, a buffer is a `VkBuffer`: a region of memory that the graphics card can read. Unlike in OpenGL, a buffer
does not allocate its own memory: you create the buffer object, ask what kind of memory it needs, allocate that
memory yourself (a `VkDeviceMemory`) and bind it to the buffer. That is what `createVertexBuffer()` does:

```cpp
void createVertexBuffer() {
    VkBufferCreateInfo bufferInfo{};
    bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    bufferInfo.size = sizeof(vertices[0]) * vertices.size();
    bufferInfo.usage = VK_BUFFER_USAGE_VERTEX_BUFFER_BIT;
    bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateBuffer(device, &bufferInfo, nullptr, &vertexBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create vertex buffer!");
    }
```

`size` is the size of the buffer in bytes. `usage` says what the buffer will be used for – here as a vertex buffer.
Like the images of the swap chain, a buffer can be owned by one queue family or shared between several; it is only
used by the graphics queue, so `VK_SHARING_MODE_EXCLUSIVE` is right.

The buffer has been created, but no memory is assigned to it yet. `vkGetBufferMemoryRequirements` tells you what the
buffer needs: its size in bytes (which can differ from `bufferInfo.size`), its alignment, and `memoryTypeBits`, a
bit field of the memory types that are suitable for it:

```cpp
    VkMemoryRequirements memRequirements;
    vkGetBufferMemoryRequirements(device, vertexBuffer, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &vertexBufferMemory) != VK_SUCCESS) {
        throw std::runtime_error("failed to allocate vertex buffer memory!");
    }

    vkBindBufferMemory(device, vertexBuffer, vertexBufferMemory, 0);
```

Graphics cards offer different types of memory, which differ in allowed operations and performance. You need memory
the CPU can write to: `VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT` means you can map it into the CPU's address space, and
`VK_MEMORY_PROPERTY_HOST_COHERENT_BIT` means that what you write there is visible to the GPU without an explicit
flush. `findMemoryType` picks a memory type that is both allowed for the buffer and has these properties:

```cpp
uint32_t findMemoryType(uint32_t typeFilter, VkMemoryPropertyFlags properties) {
    VkPhysicalDeviceMemoryProperties memProperties;
    vkGetPhysicalDeviceMemoryProperties(physicalDevice, &memProperties);

    for (uint32_t i = 0; i < memProperties.memoryTypeCount; i++) {
        if ((typeFilter & (1 << i)) && (memProperties.memoryTypes[i].propertyFlags & properties) == properties) {
            return i;
        }
    }

    throw std::runtime_error("failed to find suitable memory type!");
}
```

Bit `i` of `typeFilter` is set if memory type `i` is suitable for the buffer, and `(propertyFlags & properties) ==
properties` checks that the type has *all* the properties you asked for, not just one of them.

Finally, copy the vertex data into the buffer: `vkMapMemory` gives you a CPU pointer to the memory, `memcpy` copies
the vertices, and `vkUnmapMemory` releases the pointer again:

```cpp
    void* data;
    vkMapMemory(device, vertexBufferMemory, 0, bufferInfo.size, 0, &data);
        memcpy(data, vertices.data(), (size_t) bufferInfo.size);
    vkUnmapMemory(device, vertexBufferMemory);
}
```

Thanks to the coherent memory, the data is guaranteed to have reached the GPU by the time you next submit work with
`vkQueueSubmit`. Memory the CPU can see is not the fastest memory for the GPU to read; vulkan-tutorial improves this
later with a *staging buffer* that copies the data into device-local memory. For three vertices, host-visible
memory is fine.

The buffer and its memory are members of the class (`VkBuffer vertexBuffer;` and
`VkDeviceMemory vertexBufferMemory;`), `createVertexBuffer()` is called in `initVulkan()` after
`createCommandPool()`, and `cleanup()` destroys both:

```cpp
vkDestroyBuffer(device, vertexBuffer, nullptr);
vkFreeMemory(device, vertexBufferMemory, nullptr);
```

You'll write this code in the sixth task, after the graphics pipeline, in the same order as vulkan-tutorial. First
come the shaders.
:::
:::d3d12
In Direct3D 12, GPU memory is a **resource** (`ID3D12Resource`). The simplest way to create a buffer is a
*committed resource*: a resource together with its own memory (heap). You choose the type of heap with
`CD3DX12_HEAP_PROPERTIES`: an **upload heap** (`D3D12_HEAP_TYPE_UPLOAD`) is memory that the CPU can write to and the
GPU can read from. `CD3DX12_RESOURCE_DESC::Buffer` describes a buffer of the given size in bytes:

```cpp
const UINT vertexBufferSize = sizeof(vertices);

// Note: using upload heaps to transfer static data like vert buffers is not
// recommended. Every time the GPU needs it, the upload heap will be marshalled
// over. Please read up on Default Heap usage. An upload heap is used here for
// code simplicity and because there are very few verts to actually transfer.
CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
ThrowIfFailed(m_device->CreateCommittedResource(
    &heapProperties,
    D3D12_HEAP_FLAG_NONE,
    &bufferDesc,
    D3D12_RESOURCE_STATE_GENERIC_READ,
    nullptr,
    IID_PPV_ARGS(&m_vertexBuffer)));
```

A resource in an upload heap must start in the state `D3D12_RESOURCE_STATE_GENERIC_READ`, the state in which the
GPU may read it. The `nullptr` is an optimised clear value, which only render targets and depth buffers use. As the
comment from Microsoft's sample says, an upload heap is not the best place for data that never changes: the GPU
reads it across the bus every time. Real programs copy such data into a *default heap* (GPU memory); for three
vertices the upload heap keeps the code simple.

Then copy the vertices into the buffer. `Map` gives you a CPU pointer to the resource's memory:

```cpp
// Copy the vertex data to the vertex buffer.
UINT8* pVertexDataBegin = nullptr;
CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
memcpy(pVertexDataBegin, vertices, sizeof(vertices));
m_vertexBuffer->Unmap(0, nullptr);
```

The empty read range `(0, 0)` tells Direct3D that the CPU will not read from the memory. `Unmap(0, nullptr)` says
that the whole buffer may have been written.

Microsoft's sample writes `&CD3DX12_HEAP_PROPERTIES(D3D12_HEAP_TYPE_UPLOAD)` directly in the call. Taking the address
of a temporary object like that only compiles with Visual C++, so this project keeps both descriptions in local
variables. All of this goes in a block in `LoadAssets` (after the command list is created); you'll write it in the
fifth task, together with the *vertex buffer view* that you'll meet in the section *Vertex Array Object*.
:::

## Vertex shader

The vertex shader is one of the shaders you can program yourself. Modern graphics needs at least a vertex and a
fragment shader to render anything, so you'll now write both, in their most basic form, and set them up for
drawing the triangle. The next chapter discusses shaders in much more detail.

:::opengl
The first thing to do is write the vertex shader in the shader language **GLSL** (OpenGL Shading Language). Below is
the source code of a very basic vertex shader:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

void main()
{
    gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0);
}
```

GLSL looks similar to C. Each shader begins with a declaration of its version. Since OpenGL 3.3, the GLSL version
numbers match OpenGL's (GLSL 330 for OpenGL 3.3), and `core` says that you use the core profile.

Next you declare all the input vertex attributes with the `in` keyword. For now you only care about the position,
so you need a single attribute. GLSL has a vector type with 1 to 4 floats; since each vertex has a 3D coordinate,
you declare a `vec3` named `aPos`. `layout (location = 0)` sets the *location* of the input variable – you'll see
later why you need it.

> A vector in graphics programming is a mathematical concept: a position or direction in any space, with useful
> mathematical properties. In GLSL a vector has at most 4 components, accessed as `vec.x`, `vec.y`, `vec.z` and
> `vec.w`. The `w` component is not used as a position in space (we work in 3D, not 4D) but for something called
> *perspective division*, which comes in a later chapter.

To set the output of the vertex shader, assign the position to the predefined `gl_Position` variable, a `vec4`.
At the end of `main`, whatever `gl_Position` holds is the output of the vertex shader. The input is a `vec3`, so you
build a `vec4` from it with `w` set to `1.0`.

This vertex shader is about the simplest you can imagine: it does no processing at all and forwards the input. In
real programs the input data is usually not in normalized device coordinates yet, so the vertex shader first has to
transform it – that comes in later chapters.

In this project, the shader source is stored as a C string at the top of `main.cpp`, `vertexShaderSource`:

```cpp
const char *vertexShaderSource = "#version 330 core\n"
    "layout (location = 0) in vec3 aPos;\n"
    "void main()\n"
    "{\n"
    "   gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0);\n"
    "}\0";
```
:::
:::vulkan
Vulkan shaders are also written in **GLSL**, but with a few differences from OpenGL. The vertex shader of this
project is the file `shaders/shader.vert`:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = vec4(inPosition, 1.0);
}
```

`#version 450` is the GLSL version (that of OpenGL 4.5), the one vulkan-tutorial uses. The input
`inPosition` is a vertex attribute: a `vec3`, one value per vertex, read from the vertex buffer. In Vulkan every
input and output must have an explicit `location` – there is no way to look up variable names at run time like in
OpenGL. The `location = 0` is how the attribute description you'll write in *Linking vertex attributes* finds this
input.

`main` runs once for every vertex. It writes the position to the built-in output `gl_Position`, a `vec4` in *clip
coordinates*. The GPU divides clip coordinates by their last component, `w`, to get normalized device coordinates –
with `w = 1.0` that changes nothing, so the positions from the vertex buffer arrive in normalized device coordinates
unchanged. (vulkan-tutorial starts with the positions hard-coded in the shader and only adds a vertex buffer later;
this project uses a vertex buffer from the start, like learnopengl.)
:::
:::d3d12
Direct3D shaders are written in **HLSL** (High-Level Shading Language). Both shaders of this project are in one
file, `shaders.hlsl`. Here is the vertex shader:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;

    return result;
}
```

HLSL looks like C, with vector types such as `float3` and `float4`. Unlike GLSL, the shader's inputs and outputs are
ordinary function parameters and return values, and each one carries a **semantic** after the colon: a name that
says what the value means.

- `POSITION` is a name you choose. It connects the parameter `position` to the vertex data: the *input layout*,
  which you'll create in *Linking vertex attributes*, describes an element with the semantic name `"POSITION"`, and
  that is how the data finds this parameter.
- `SV_POSITION` is a *system-value* semantic (`SV_`): it has a fixed meaning for the pipeline. The vertex shader
  must output the position in *clip coordinates* with this semantic, so that the rasterizer knows where the vertex
  is on the screen.

The vertex buffer holds three floats per vertex, but the parameter is a `float4`: the input assembler fills in the
missing `w` component with `1.0`. The GPU divides clip coordinates by `w` to get normalized device coordinates, so
with `w = 1.0` the positions arrive unchanged. The struct is called `PSInput` because the pixel shader receives it.

Now do the first task: write `PSInput` and `VSMain` in `shaders.hlsl`. Nothing changes in the picture yet – the
shaders are only compiled once the pipeline is created.
:::

## Compiling a shader

:::opengl
You have the source code of the vertex shader in a C string, but for OpenGL to use the shader, it has to compile it
at run time from its source code. The first thing to do is create a shader object, again referenced by an ID.
Store the vertex shader as an `unsigned int` and create it with `glCreateShader`:

```cpp
unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
```

The argument is the type of shader you want to create; for a vertex shader that's `GL_VERTEX_SHADER`. Next, attach
the source code to the shader object and compile it:

```cpp
glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
glCompileShader(vertexShader);
```

`glShaderSource` takes the shader object, the number of strings you pass as source code (one), the source itself,
and an array of string lengths, which you can leave at `NULL` because the strings are null-terminated.

You probably want to check whether compilation succeeded, and if not, which errors were found, so you can fix them:

```cpp
int success;
char infoLog[512];
glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
if (!success)
{
    glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);
    std::cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << infoLog << std::endl;
}
```

First you define an integer for success and a buffer for the error messages (if any). `glGetShaderiv` with
`GL_COMPILE_STATUS` tells you whether compilation succeeded. If it failed, `glGetShaderInfoLog` retrieves the error
message and you print it. Shader errors don't stop your program: without this check, a typo in a shader only shows
up as a missing triangle.

Now do the second task: write `vertexShaderSource` at the top of `main.cpp`, then create and compile the vertex
shader with the error check (where the TODO in `main` says). Build & run: no error should be printed.
:::
:::vulkan
OpenGL compiles GLSL at run time, inside the driver. Vulkan doesn't: it only accepts shaders in **SPIR-V**, a binary
intermediate language. You compile your GLSL to SPIR-V *before* the program runs, with a compiler such as `glslc`,
which comes with the Vulkan SDK:

```text
glslc shaders/shader.vert -o shaders/vert.spv
glslc shaders/shader.frag -o shaders/frag.spv
```

The advantage is that the driver doesn't need a full GLSL compiler of its own (each vendor's compiler used to accept
slightly different GLSL), and syntax errors show up at build time, not when the program runs.

:::ide clion vscode
Your `CMakeLists.txt` from *Setting up your IDE* compiles both shader files to `shaders/vert.spv` and
`shaders/frag.spv` with `glslc` before it builds `main.cpp`; a mistake in a shader is reported in your IDE's build
output like any other compile error.
:::
:::ide vs rider
The pre-build event of your project from *Setting up your IDE* compiles both shader files to `shaders/vert.spv` and
`shaders/frag.spv` with `glslc` before `main.cpp` is compiled; a mistake in a shader shows up in the build output with
`glslc`'s message, and the build stops.
A solution doesn't link the program again when only a shader changed, and the app counts only a program that is newer
than all your sources: after a change to a shader alone, use **Build → Rebuild Solution**.
:::

At run time, the program loads the bytecode with a small helper, `readFile`:

```cpp
static std::vector<char> readFile(const std::string& filename) {
    std::ifstream file(filename, std::ios::ate | std::ios::binary);

    if (!file.is_open()) {
        throw std::runtime_error("failed to open file!");
    }

    size_t fileSize = (size_t) file.tellg();
    std::vector<char> buffer(fileSize);

    file.seekg(0);
    file.read(buffer.data(), fileSize);

    file.close();

    return buffer;
}
```

`std::ios::binary` reads the file as bytes (no text conversion), and `std::ios::ate` starts reading at the end of
the file: the read position, `tellg()`, is then the size of the file, so you can allocate the buffer. Then it seeks
back to the beginning and reads all the bytes at once.

Before the code can be passed to the pipeline, it has to be wrapped in a `VkShaderModule`:

```cpp
VkShaderModule createShaderModule(const std::vector<char>& code) {
    VkShaderModuleCreateInfo createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    createInfo.codeSize = code.size();
    createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

    VkShaderModule shaderModule;
    if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
        throw std::runtime_error("failed to create shader module!");
    }

    return shaderModule;
}
```

`codeSize` is in bytes, but `pCode` is a pointer to `uint32_t`, because SPIR-V consists of 32-bit words – hence the
`reinterpret_cast`. (The data of a `std::vector` is allocated with an alignment that satisfies `uint32_t`.) A shader
module is only a thin wrapper around the bytecode: the real compilation to the GPU's machine code happens later,
when the graphics pipeline is created.
:::
:::d3d12
HLSL can be compiled before the program runs (with the `fxc` or `dxc` compilers) or at run time. Microsoft's
HelloTriangle sample, and this project, compile at run time with `D3DCompileFromFile`, at the start of the block
that creates the pipeline state in `LoadAssets`:

```cpp
ComPtr<ID3DBlob> vertexShader;
ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
// Enable better shader debugging with the graphics debugging tools.
UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
UINT compileFlags = 0;
#endif

// Compile the vertex shader (VSMain) and the pixel shader (PSMain) in shaders.hlsl.
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

The arguments are: the file name (looked up in the working directory), macro definitions and an include handler
(none), the **entry point** – the function to compile, since one file can hold several shaders – and the **target
profile**: `vs_5_0` is a vertex shader for shader model 5.0, `ps_5_0` a pixel shader. Then come the compile flags
(in debug builds: debug information and no optimisation, which helps graphics debuggers), effect flags (unused), the
output, and an optional blob for the compiler's error messages.

:::ide vs rider
`shaders.hlsl` is read while the program runs, so it must stay out of the build. If you add it to the project to open
it from the Solution Explorer, set its **Properties → General → Item Type** to **Does not participate in build** – in
the `.vcxproj`, which is where you change it in Rider: `<None Include="shaders.hlsl" />` instead of
`<FxCompile Include="shaders.hlsl" />`. Otherwise MSBuild compiles it with Visual Studio's own HLSL compiler, which
looks for a function called `main` and stops the build. The same goes for the `.hlsl` files of later chapters. And
since a solution doesn't link the program again when only `shaders.hlsl` changed, use **Build → Rebuild Solution**
after such a change: the app counts only a program that is newer than all your sources.
:::

The result is bytecode in an `ID3DBlob`, a simple block of memory. If the HLSL has an error, `D3DCompileFromFile`
returns a failure code and `ThrowIfFailed` stops the program with that HRESULT. (The sample passes `nullptr` for the
error blob; pass a `ComPtr<ID3DBlob>` there if you want to print the compiler's message.) The bytecode is not yet
code for your GPU: the driver translates it when the pipeline state object is created. You'll write these lines in
the fourth task, together with the rest of the pipeline state.
:::

:::opengl
```quiz
When is the GLSL code in `vertexShaderSource` compiled?
- [x] At run time, by the OpenGL driver, when the program calls `glCompileShader`
- [ ] When the C++ project is built
- [ ] The first time `glDrawArrays` is called
---
The shader is just a string in your program. OpenGL compiles it while the program runs, which is why you check `GL_COMPILE_STATUS` yourself.
```
:::
:::vulkan
```quiz
What does `vkCreateShaderModule` get from the program?
- [x] SPIR-V bytecode, compiled from GLSL before the program runs
- [ ] GLSL source text, which the driver compiles
- [ ] HLSL source text
---
Vulkan only accepts SPIR-V. The GLSL files are compiled to `vert.spv` and `frag.spv` at build time, and `readFile` loads that bytecode.
```
:::
:::d3d12
```quiz
When are `VSMain` and `PSMain` compiled in this project?
- [ ] When the C++ project is built
- [ ] By the driver, at the first `DrawInstanced`
- [x] At run time, by `D3DCompileFromFile` in `LoadAssets`
---
`D3DCompileFromFile` reads `shaders.hlsl` while the program runs and returns bytecode. The driver turns that bytecode into GPU code when the pipeline state object is created.
```
:::

## Fragment shader

The fragment shader is the second and final shader you need to render a triangle. It is all about calculating the
colour output of your pixels. To keep things simple, it always outputs an orange-ish colour.

Colours in computer graphics are represented as an array of 4 values: red, green, blue and alpha (opacity),
usually abbreviated RGBA. Each component is a value between `0.0` and `1.0`. For example, red `1.0` and green `1.0`
give yellow. With those three colour components you can mix over 16 million different colours. The orange used here
is `(1.0, 0.5, 0.2)` with alpha `1.0` (fully opaque).

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

The fragment shader needs only one output variable: a `vec4` with the final colour, which you declare with the
`out` keyword and name `FragColor`. Then you assign it a `vec4` with the colour orange and an alpha of `1.0`.

Compiling the fragment shader works just like the vertex shader, but with `GL_FRAGMENT_SHADER` as the shader type:

```cpp
unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
glCompileShader(fragmentShader);
```

Check it for errors the same way, reusing `success` and `infoLog`, and print
`ERROR::SHADER::FRAGMENT::COMPILATION_FAILED` if it fails.

Now do the third task: write `fragmentShaderSource` at the top of `main.cpp` and compile the fragment shader with
the error check.
:::
:::vulkan
The fragment shader is the file `shaders/shader.frag`:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

`main` is called for every fragment. Unlike in the vertex shader, there is no built-in output variable for the
colour: you declare your own output, and `layout(location = 0)` says it is written to the framebuffer's attachment
with index 0 – the colour attachment of the render pass you created in the previous chapter.

Now do the first task: write both shaders, `shader.vert` and `shader.frag` (the `#version 450` lines and empty
`main` functions are already there). Build & run compiles them to SPIR-V; the window still shows only teal, because
the program doesn't load them yet.
:::
:::d3d12
In HLSL, the fragment shader is called the **pixel shader**. It is the second function in `shaders.hlsl`:

```hlsl
// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

It receives the `PSInput` that the vertex shader returned – after rasterization, so `input.position` is now the
pixel's position on the screen – and returns the colour. The semantic `SV_TARGET` on the return value means: write
this value to the render target, the back buffer bound with `OMSetRenderTargets`. (`SV_TARGET` is short for
`SV_TARGET0`, the first render target.) This shader doesn't use `input` – every pixel gets the same orange.

Now do the second task: write `PSMain`.
:::

## Shader program

:::opengl
Both shaders are now compiled, and the only thing left is to link both shader objects into a **shader program**
that you can use for rendering. A shader program object is the final linked version of multiple shaders combined.
To use the compiled shaders, you link them into a shader program object and then activate this program when
rendering objects. The activated shader program's shaders will be used when you issue render calls.

When linking the shaders into a program, it links the outputs of each shader to the inputs of the next shader. This
is also where you get linking errors if your outputs and inputs don't match.

Creating a program object is easy:

```cpp
unsigned int shaderProgram = glCreateProgram();
```

`glCreateProgram` creates a program and returns its ID. Now attach the compiled shaders to the program and link
them with `glLinkProgram`:

```cpp
glAttachShader(shaderProgram, vertexShader);
glAttachShader(shaderProgram, fragmentShader);
glLinkProgram(shaderProgram);
```

Just like with shader compilation, you can check whether linking failed and retrieve the log – with
`glGetProgramiv` and `glGetProgramInfoLog` instead:

```cpp
glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
if (!success) {
    glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
    std::cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << std::endl;
}
```

The result is a program object that you can activate with `glUseProgram(shaderProgram)`. Every shader and rendering
call after `glUseProgram` uses this program object (and thus the shaders). Don't forget to delete the shader
objects once you've linked them into the program; you no longer need them:

```cpp
glDeleteShader(vertexShader);
glDeleteShader(fragmentShader);
```

The program itself is deleted at the end of the program, with `glDeleteProgram(shaderProgram);` in the clean-up.

Now do the fourth task: link the shaders into `shaderProgram`, check for link errors, delete the two shader objects,
and delete the program in the clean-up.

Right now you've sent the vertex data to the GPU and told it how to process that data within a vertex and fragment
shader. You're almost there, but not quite yet: OpenGL does not yet know how it should interpret the vertex data in
memory, and how it should connect the vertex data to the vertex shader's attributes. You'll tell it next.
:::
:::vulkan
Vulkan has no shader program object. What OpenGL links into a program – the shaders, plus everything OpenGL
remembers as state, such as how vertices are read – becomes one **graphics pipeline** in Vulkan, a `VkPipeline`.
The pipeline is created in `createGraphicsPipeline()`, which is already called in `initVulkan()` right after
`createRenderPass()`. Its four TODO comments are the steps of the next tasks:

1. load the SPIR-V code, create the shader modules and the shader stages;
2. describe the fixed-function stages and create the pipeline layout;
3. create the graphics pipeline;
4. destroy the shader modules.

To use the shaders, you assign each module to a pipeline stage with a `VkPipelineShaderStageCreateInfo`:

```cpp
auto vertShaderCode = readFile("shaders/vert.spv");
auto fragShaderCode = readFile("shaders/frag.spv");

VkShaderModule vertShaderModule = createShaderModule(vertShaderCode);
VkShaderModule fragShaderModule = createShaderModule(fragShaderCode);

VkPipelineShaderStageCreateInfo vertShaderStageInfo{};
vertShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
vertShaderStageInfo.stage = VK_SHADER_STAGE_VERTEX_BIT;
vertShaderStageInfo.module = vertShaderModule;
vertShaderStageInfo.pName = "main";

VkPipelineShaderStageCreateInfo fragShaderStageInfo{};
fragShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
fragShaderStageInfo.stage = VK_SHADER_STAGE_FRAGMENT_BIT;
fragShaderStageInfo.module = fragShaderModule;
fragShaderStageInfo.pName = "main";

VkPipelineShaderStageCreateInfo shaderStages[] = {vertShaderStageInfo, fragShaderStageInfo};
```

`stage` says in which pipeline stage the shader is used, `module` is the shader module, and `pName` is the
**entry point**: the function to call. One module could contain several shaders, each with its own entry point;
here it's `main` in both.

The linking OpenGL does in `glLinkProgram` – compiling the bytecode to the GPU's machine code and connecting the
vertex shader's outputs to the fragment shader's inputs – happens in Vulkan when the pipeline is created. After that,
the modules are no longer needed, so they are destroyed at the end of `createGraphicsPipeline()` – like
`glDeleteShader` after linking in OpenGL:

```cpp
vkDestroyShaderModule(device, fragShaderModule, nullptr);
vkDestroyShaderModule(device, vertShaderModule, nullptr);
```

Now do the second task: write `readFile()` and `createShaderModule()`, then load the two `.spv` files in
`createGraphicsPipeline()`, create the modules and the two shader stages, and destroy the modules at the end of the
function. Build & run: still teal. If the `.spv` files couldn't be found, the program would stop with "failed to
open file!".

(The compiler warns that `shaderStages` is unused – that's expected until the pipeline task.)
:::
:::d3d12
Direct3D 12 has no shader program object either. The compiled shaders, together with almost all the fixed-function
settings, go into one **pipeline state object** (PSO), an `ID3D12PipelineState`. Before you can create one, you need
a **root signature**.

The root signature describes which resources the shaders use besides the vertices: constants, constant buffers,
textures, samplers … It is the contract between your C++ program and the shaders: "parameter 0 is a constant buffer
for the vertex shader, parameter 1 a table of textures …". The triangle's shaders use none of these, so you create
an **empty** root signature – but every pipeline needs one:

```cpp
// Create an empty root signature.
{
    CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
    rootSignatureDesc.Init(0, nullptr, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);

    ComPtr<ID3DBlob> signature;
    ComPtr<ID3DBlob> error;
    ThrowIfFailed(D3D12SerializeRootSignature(&rootSignatureDesc, D3D_ROOT_SIGNATURE_VERSION_1, &signature, &error));
    ThrowIfFailed(m_device->CreateRootSignature(0, signature->GetBufferPointer(), signature->GetBufferSize(), IID_PPV_ARGS(&m_rootSignature)));
}
```

`Init` takes the root parameters (0 of them, `nullptr`), the static samplers (also none) and flags.
`D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT` opts in to the input assembler with an input layout –
you read vertices from a vertex buffer. (Leaving the flag out can save a little space in the root signature on some
hardware, for pipelines that don't read vertex buffers.)

A root signature isn't created from the description directly: `D3D12SerializeRootSignature` first turns it into a
binary blob (the same format a root signature written in HLSL is compiled to), and `CreateRootSignature` creates the
object from that blob. The first argument, `0`, is the node mask for systems with several GPUs.

Now do the third task: create the empty root signature at the start of `LoadAssets`.

The pipeline state object is the next step. It is the counterpart of OpenGL's linked program – and more: the
"linking" of the shaders happens when the PSO is created, and so does the configuration of the fixed-function
stages. First, though, it needs to know how the vertex data is laid out.
:::

## Linking Vertex Attributes

The vertex shader lets you specify any input you want in the form of vertex attributes. That gives you great
flexibility, but it also means you have to specify manually which part of the input data goes to which vertex
attribute in the vertex shader. In other words: you have to tell {{api}} how to interpret the vertex data before
rendering.

The vertex buffer data is formatted like this:

```text
            vertex 1          vertex 2          vertex 3
          | x | y | z |     | x | y | z |     | x | y | z |
byte:     0   4   8   12    12  16  20  24    24  28  32  36
position: |<- stride: 12 ->|
          ^ offset: 0
```

- The position data is stored as 32-bit (4 byte) floating point values.
- Each position is composed of 3 of those values.
- There is no space (or other values) between each set of 3 values: the values are *tightly packed*.
- The first value in the data is at the beginning of the buffer.

:::opengl
With this knowledge you tell OpenGL how to interpret the vertex data (per vertex attribute) with
`glVertexAttribPointer`:

```cpp
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
```

`glVertexAttribPointer` has quite a few parameters, so let's go through them:

- The first parameter specifies which vertex attribute you want to configure. Remember that you set the location
  of the position attribute in the vertex shader with `layout (location = 0)`. That sets the location of the vertex
  attribute to `0`, and since you want to pass data to this attribute, you pass in `0`.
- The next argument is the size of the vertex attribute. It is a `vec3`, so it's composed of `3` values.
- The third argument is the type of the data, `GL_FLOAT` (a `vec*` in GLSL consists of floats).
- The next argument specifies whether the data should be normalized. If you input integer data (int, byte) and set
  this to `GL_TRUE`, the integer values are mapped to 0 (or -1 for signed data) to 1 when converted to float. That's
  not relevant here, so it's `GL_FALSE`.
- The fifth argument is the **stride**: the space between consecutive vertex attributes. The next set of position
  data is exactly 3 floats away, so the stride is `3 * sizeof(float)`. Because the array is tightly packed, you
  could also pass `0` and let OpenGL work out the stride – but once you have more vertex attributes you have to
  specify the space between them carefully, so it's good practice to write it out.
- The last parameter is of type `void*`, hence the strange cast. It is the **offset** of where the position data
  begins in the buffer. The position data is at the start of the data array, so it's `0`.

Each vertex attribute takes its data from memory managed by a VBO, and *which* VBO is determined by the VBO
currently bound to `GL_ARRAY_BUFFER` when you call `glVertexAttribPointer`. Since `VBO` is still bound, vertex
attribute 0 is now associated with its vertex data.

Now that you've specified how OpenGL should interpret the vertex data, you enable the vertex attribute with
`glEnableVertexAttribArray`, giving the vertex attribute location as its argument; vertex attributes are disabled
by default.
:::
:::vulkan
In Vulkan you describe this format in two structures, and you keep them together with the C++ type of the vertex
data. Here is the `Vertex` struct of this project:

```cpp
struct Vertex {
    glm::vec3 pos;

    static VkVertexInputBindingDescription getBindingDescription() {
        VkVertexInputBindingDescription bindingDescription{};
        bindingDescription.binding = 0;
        bindingDescription.stride = sizeof(Vertex);
        bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 1> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 1> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        return attributeDescriptions;
    }
};
```

`glm::vec3` comes from GLM, a mathematics library whose types match GLSL's (a `glm::vec3` is three floats, just like
a `vec3`), so the struct's memory layout is exactly the layout the shader expects.

A **binding description** describes the buffer as a whole: at which rate to load data from memory.

- `binding` is the index of the binding; you'll bind the vertex buffer to binding 0 when drawing.
- `stride` is the number of bytes from one entry to the next: `sizeof(Vertex)`, 12 bytes.
- `inputRate` is `VK_VERTEX_INPUT_RATE_VERTEX`: move to the next entry after each vertex. (The alternative,
  `VK_VERTEX_INPUT_RATE_INSTANCE`, is for instanced rendering.)

An **attribute description** describes how to extract one vertex attribute from the data of a binding:

- `binding`: the binding the data comes from (0).
- `location`: the `location` of the input in the vertex shader – `layout(location = 0) in vec3 inPosition`.
- `format`: the type of the data. Formats are named like colour formats, oddly enough:
  `VK_FORMAT_R32G32B32_SFLOAT` is three 32-bit signed floats, a `vec3`. (A `float` would be `VK_FORMAT_R32_SFLOAT`,
  a `vec2` `VK_FORMAT_R32G32_SFLOAT`.)
- `offset`: where the attribute begins inside a `Vertex`. `offsetof(Vertex, pos)` computes it (here `0`).

The vertex data, `vertices`, is a `std::vector<Vertex>` with the three corners from *Vertex input*.

Now do the third task: write `struct Vertex` with its two functions, and the `vertices` vector with the triangle.
Build & run: still teal – nothing uses the data yet.
:::
:::d3d12
In Direct3D 12 you describe this format with an **input layout**: an array of `D3D12_INPUT_ELEMENT_DESC`, one per
vertex attribute. The triangle has one attribute, the position:

```cpp
// Define the vertex input layout.
D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
{
    { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
};
```

The fields, in order:

- `"POSITION"` is the **semantic name**. This is how the data finds the shader input: it goes to the parameter of
  `VSMain` with the semantic `POSITION`.
- `0` is the semantic index, for when several elements share a name (`TEXCOORD0`, `TEXCOORD1` …).
- `DXGI_FORMAT_R32G32B32_FLOAT` is the format of the data: three 32-bit floats, like `XMFLOAT3`.
- `0` is the input slot: the vertex buffer is bound to slot 0 when drawing.
- `0` is the byte offset of the element inside a vertex – the position is at the start.
- `D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA` means: the next vertex gets the next element (the alternative is
  per-instance data), and the last `0` (the instance data step rate) must be 0 for per-vertex data.

The stride – the size of one vertex – is not part of the input layout; you give it with the vertex buffer view.

Now the pipeline state object can be described. It holds everything about how the pipeline draws:

```cpp
// Describe and create the graphics pipeline state object (PSO).
D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
psoDesc.pRootSignature = m_rootSignature.Get();
psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
psoDesc.DepthStencilState.DepthEnable = FALSE;
psoDesc.DepthStencilState.StencilEnable = FALSE;
psoDesc.SampleMask = UINT_MAX;
psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
psoDesc.NumRenderTargets = 1;
psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
psoDesc.SampleDesc.Count = 1;
ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
```

- `InputLayout`: the input layout from above, with its number of elements.
- `pRootSignature`: the root signature from the previous section.
- `VS` and `PS`: the compiled bytecode; `CD3DX12_SHADER_BYTECODE` takes the pointer and size from the blob.
- `RasterizerState`: `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` fills in the default rasterizer state: solid fill
  (`D3D12_FILL_MODE_SOLID`), **back faces culled** (`D3D12_CULL_MODE_BACK`) and `FrontCounterClockwise = FALSE` –
  so **clockwise** triangles are front faces. This is why the order of the vertices matters: a triangle whose
  vertices go counter-clockwise on the screen is a back face and isn't drawn. Culling saves work for closed 3D
  objects, whose back sides you can't see anyway.
- `BlendState`: the default – blending off, the pixel shader's colour replaces the old one.
- No depth or stencil test (there is no depth buffer yet), and `SampleMask = UINT_MAX` lets every sample through.
- `PrimitiveTopologyType`: the PSO only needs to know that it draws *triangles* (not points or lines); the exact
  topology – a triangle list – is set on the command list.
- One render target with the format of the swap chain's back buffers, `DXGI_FORMAT_R8G8B8A8_UNORM`, and one sample
  per pixel (no multisampling).

`CreateGraphicsPipelineState` creates the PSO; this is where the driver compiles the shader bytecode for your GPU.
Since the command list should start with this pipeline state, the PSO is created *before* the command list, and
`m_pipelineState.Get()` replaces the `nullptr` in `CreateCommandList`:

```cpp
ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));
```

Now do the fourth task: compile the shaders with `D3DCompileFromFile` (from *Compiling a shader*), define the input
layout, describe and create the PSO, and pass it to `CreateCommandList`. Build & run: still only the clear colour,
but from now on a mistake in `shaders.hlsl` stops the program at start-up with an HRESULT.
:::

:::opengl
```quiz
The first argument of `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0)` is `0`. What does it refer to?
- [ ] The ID of the vertex buffer object
- [ ] The byte offset of the first vertex in the buffer
- [x] The `location = 0` of the input `aPos` in the vertex shader
---
The first argument is the vertex attribute's location. The offset is the last argument; the buffer is whichever VBO is bound to `GL_ARRAY_BUFFER` at the time of the call.
```
:::
:::vulkan
```quiz
How does `inPosition` in `shader.vert` get its data from `Vertex::pos`?
- [x] Through the attribute description: `location = 0` matches `layout(location = 0)`, with format `VK_FORMAT_R32G32B32_SFLOAT` and offset `offsetof(Vertex, pos)`
- [ ] Vulkan matches the names `inPosition` and `pos`
- [ ] Through the order in which the variables are declared in the shader
---
SPIR-V doesn't keep variable names for this: inputs are matched by their location. The binding description adds the stride (`sizeof(Vertex)`).
```
:::
:::d3d12
```quiz
How does the input layout element connect to the parameter of `VSMain`?
- [x] Through the semantic name: `"POSITION"` in the input layout, `: POSITION` on the parameter
- [ ] Through the parameter's name, `position`
- [ ] Through the order of the functions in `shaders.hlsl`
---
Semantics are the glue between the input assembler and the vertex shader. The parameter could be called anything; the semantic has to match.
```
:::

## Vertex Array Object

:::opengl
A **vertex array object** (VAO) can be bound just like a vertex buffer object, and any subsequent vertex attribute
calls from that point on are stored inside the VAO. The advantage is that when configuring vertex attribute
pointers you only have to make those calls once, and whenever you want to draw the object, you just bind the
corresponding VAO. Switching between different vertex data and attribute configurations is then as easy as binding
a different VAO; all the state you just set is stored inside it.

> Core OpenGL **requires** you to use a VAO so it knows what to do with your vertex inputs. If you fail to bind a
> VAO, OpenGL will most likely refuse to draw anything.

A vertex array object stores the following:

- Calls to `glEnableVertexAttribArray` or `glDisableVertexAttribArray`.
- Vertex attribute configurations via `glVertexAttribPointer`.
- The vertex buffer objects associated with vertex attributes by calls to `glVertexAttribPointer`.

Creating a VAO looks like creating a VBO. To use it, bind it with `glBindVertexArray`. From then on, you bind and
configure the corresponding VBO(s) and attribute pointer(s), and unbind the VAO for later use. When you want to draw
an object, you simply bind the VAO with the preferred settings before drawing. In this project, the VAO is created
next to the VBO and bound before the VBO:

```cpp
unsigned int VBO, VAO;
glGenVertexArrays(1, &VAO);
glGenBuffers(1, &VBO);
// bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
glBindVertexArray(VAO);

glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);

// note that this is allowed, the call to glVertexAttribPointer registered VBO as the vertex attribute's bound vertex buffer object so afterwards we can safely unbind
glBindBuffer(GL_ARRAY_BUFFER, 0);

// You can unbind the VAO afterwards so other VAO calls won't accidentally modify this VAO, but this rarely happens. Modifying other
// VAOs requires a call to glBindVertexArray anyways so we generally don't unbind VAOs (nor VBOs) when it's not directly necessary.
glBindVertexArray(0);
```

That's it: the VAO now stores the vertex attribute configuration and which VBO to use. Usually, when you have
multiple objects to draw, you first generate and configure all the VAOs (and thus the required VBOs and attribute
pointers) and store them for later use. When you want to draw one of the objects, you take the corresponding VAO,
bind it, draw the object and unbind the VAO again. The VAO is deleted in the clean-up with
`glDeleteVertexArrays(1, &VAO);`.

Now do the fifth task: create and bind the VAO before the VBO, configure the vertex attribute with
`glVertexAttribPointer` and `glEnableVertexAttribArray`, unbind the VBO and the VAO, and delete the VAO in the
clean-up. The solution also adds a commented-out `//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` line – you'll use it
at the end of the chapter.
:::
:::vulkan
Vulkan has no vertex array objects. The two things a VAO stores are kept in two different places:

- **The format** of the vertex data – the bindings and attributes – is part of the graphics pipeline, in its
  *vertex input state*. It is fixed when the pipeline is created.
- **Which buffer** to read from is chosen while recording the command buffer, with `vkCmdBindVertexBuffers` – you'll
  see it in the next section.

So drawing with different vertex data uses the same pipeline with a different buffer; drawing data with a different
format needs a different pipeline. The vertex input state is the first of the **fixed-function** states of the
pipeline:

```cpp
VkPipelineVertexInputStateCreateInfo vertexInputInfo{};
vertexInputInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO;

auto bindingDescription = Vertex::getBindingDescription();
auto attributeDescriptions = Vertex::getAttributeDescriptions();

vertexInputInfo.vertexBindingDescriptionCount = 1;
vertexInputInfo.vertexAttributeDescriptionCount = static_cast<uint32_t>(attributeDescriptions.size());
vertexInputInfo.pVertexBindingDescriptions = &bindingDescription;
vertexInputInfo.pVertexAttributeDescriptions = attributeDescriptions.data();
```

The rest of the fixed-function stages, which OpenGL configures with default state you can change at any time, also
have to be described up front.

### Fixed functions

**Input assembly** describes what kind of geometry is drawn from the vertices (the *primitive assembly* stage):

```cpp
VkPipelineInputAssemblyStateCreateInfo inputAssembly{};
inputAssembly.sType = VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO;
inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST;
inputAssembly.primitiveRestartEnable = VK_FALSE;
```

`VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST` means: every three vertices form a triangle, without reuse – like
`GL_TRIANGLES`. Primitive restart is only relevant for strip topologies.

The **viewport** describes the region of the framebuffer the output is rendered to (the viewport transform from
normalized device coordinates to pixels), and the **scissor** rectangle defines in which region pixels are actually
stored. Both could be baked into the pipeline, but then the pipeline would have to be recreated whenever the window
size changed. Instead, they are **dynamic state**: the pipeline only needs to know how many there are, and the
values are set while recording the command buffer:

```cpp
VkPipelineViewportStateCreateInfo viewportState{};
viewportState.sType = VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO;
viewportState.viewportCount = 1;
viewportState.scissorCount = 1;
```

The **rasterizer** takes the geometry shaped by the vertices and turns it into fragments. It also performs face
culling:

```cpp
VkPipelineRasterizationStateCreateInfo rasterizer{};
rasterizer.sType = VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO;
rasterizer.depthClampEnable = VK_FALSE;
rasterizer.rasterizerDiscardEnable = VK_FALSE;
rasterizer.polygonMode = VK_POLYGON_MODE_FILL;
rasterizer.lineWidth = 1.0f;
rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;
rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;
rasterizer.depthBiasEnable = VK_FALSE;
```

- `depthClampEnable` would clamp fragments beyond the near and far planes instead of discarding them;
  `rasterizerDiscardEnable` would stop all geometry from reaching the rasterizer. Both are off.
- `polygonMode` is `VK_POLYGON_MODE_FILL`: fill the triangle with fragments. (`VK_POLYGON_MODE_LINE` draws only the
  edges – see *wireframe mode* at the end of the chapter.)
- `lineWidth` is the thickness of lines in fragments; anything thicker than `1.0f` needs the `wideLines` GPU feature.
- `cullMode = VK_CULL_MODE_BACK_BIT` throws away back faces, and `frontFace = VK_FRONT_FACE_CLOCKWISE` says which
  triangles are front faces: those whose vertices appear **clockwise** on the screen. Remember that Vulkan's y axis
  points down: the triangle top `(0.0, -0.5)`, bottom right `(0.5, 0.5)`, bottom left `(-0.5, 0.5)` is clockwise on
  the screen, so it is a front face and is drawn. With the opposite order it would be culled, and you would see
  nothing.
- `depthBiasEnable` is used for shadow mapping later; off.

**Multisampling** is one of the ways to do anti-aliasing. It stays off: one sample per pixel.

```cpp
VkPipelineMultisampleStateCreateInfo multisampling{};
multisampling.sType = VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO;
multisampling.sampleShadingEnable = VK_FALSE;
multisampling.rasterizationSamples = VK_SAMPLE_COUNT_1_BIT;
```

**Colour blending** combines the fragment shader's colour with the colour already in the framebuffer. There is one
`VkPipelineColorBlendAttachmentState` per colour attachment and one global `VkPipelineColorBlendStateCreateInfo`:

```cpp
VkPipelineColorBlendAttachmentState colorBlendAttachment{};
colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
colorBlendAttachment.blendEnable = VK_FALSE;

VkPipelineColorBlendStateCreateInfo colorBlending{};
colorBlending.sType = VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO;
colorBlending.logicOpEnable = VK_FALSE;
colorBlending.logicOp = VK_LOGIC_OP_COPY;
colorBlending.attachmentCount = 1;
colorBlending.pAttachments = &colorBlendAttachment;
colorBlending.blendConstants[0] = 0.0f;
colorBlending.blendConstants[1] = 0.0f;
colorBlending.blendConstants[2] = 0.0f;
colorBlending.blendConstants[3] = 0.0f;
```

With `blendEnable = VK_FALSE`, the new colour simply replaces the old one; `colorWriteMask` lets all four
components through. Blending comes back in the *Blending* chapter.

The **dynamic state** lists the states that are set at draw time instead – here the viewport and the scissor:

```cpp
std::vector<VkDynamicState> dynamicStates = {
    VK_DYNAMIC_STATE_VIEWPORT,
    VK_DYNAMIC_STATE_SCISSOR
};
VkPipelineDynamicStateCreateInfo dynamicState{};
dynamicState.sType = VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO;
dynamicState.dynamicStateCount = static_cast<uint32_t>(dynamicStates.size());
dynamicState.pDynamicStates = dynamicStates.data();
```

Finally, the **pipeline layout** describes the resources the shaders use besides the vertices (uniform values,
textures …), like OpenGL's uniforms. The triangle's shaders have none, so the layout is empty – but it is still
required. It is a member, `VkPipelineLayout pipelineLayout;`, because it is used again when drawing in later
chapters:

```cpp
VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
pipelineLayoutInfo.setLayoutCount = 0;
pipelineLayoutInfo.pushConstantRangeCount = 0;

if (vkCreatePipelineLayout(device, &pipelineLayoutInfo, nullptr, &pipelineLayout) != VK_SUCCESS) {
    throw std::runtime_error("failed to create pipeline layout!");
}
```

It is destroyed in `cleanup()` with `vkDestroyPipelineLayout(device, pipelineLayout, nullptr);`.

Now do the fourth task: describe all the fixed-function stages in `createGraphicsPipeline()` as above, create the
pipeline layout (add the member) and destroy it in `cleanup()`. Build & run: still teal (and a few warnings about
unused variables, which disappear in the next task).

### Creating the pipeline

Now all the pieces can be combined into the pipeline: the shader stages, the fixed-function states, the pipeline
layout and the render pass:

```cpp
VkGraphicsPipelineCreateInfo pipelineInfo{};
pipelineInfo.sType = VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO;
pipelineInfo.stageCount = 2;
pipelineInfo.pStages = shaderStages;
pipelineInfo.pVertexInputState = &vertexInputInfo;
pipelineInfo.pInputAssemblyState = &inputAssembly;
pipelineInfo.pViewportState = &viewportState;
pipelineInfo.pRasterizationState = &rasterizer;
pipelineInfo.pMultisampleState = &multisampling;
pipelineInfo.pColorBlendState = &colorBlending;
pipelineInfo.pDynamicState = &dynamicState;
pipelineInfo.layout = pipelineLayout;
pipelineInfo.renderPass = renderPass;
pipelineInfo.subpass = 0;
pipelineInfo.basePipelineHandle = VK_NULL_HANDLE;

if (vkCreateGraphicsPipelines(device, VK_NULL_HANDLE, 1, &pipelineInfo, nullptr, &graphicsPipeline) != VK_SUCCESS) {
    throw std::runtime_error("failed to create graphics pipeline!");
}
```

`renderPass` and `subpass` say in which render pass – and which of its subpasses – the pipeline will be used; it is
the render pass from the previous chapter, with its single colour attachment. `basePipelineHandle` would let you
derive a pipeline from an existing one; not needed here. `vkCreateGraphicsPipelines` can create several pipelines in
one call, and its second parameter is an optional pipeline cache (none). The pipeline is a member,
`VkPipeline graphicsPipeline;`, and is destroyed in `cleanup()` before the pipeline layout:

```cpp
vkDestroyPipeline(device, graphicsPipeline, nullptr);
vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
```

Now do the fifth task: create the graphics pipeline at the "create the graphics pipeline" TODO, add the member, and
destroy it in `cleanup()`. Build & run: still teal, but there should be no validation message.

Then do the sixth task: the vertex buffer, as described in *Vertex input* – the members `vertexBuffer` and
`vertexBufferMemory`, `createVertexBuffer()`, `findMemoryType()`, the call in `initVulkan()` after
`createCommandPool()`, and the clean-up.
:::
:::d3d12
Direct3D 12 has no vertex array objects. The two things a VAO stores are kept in two different places:

- **The format** of the vertex data is the input layout, which is part of the pipeline state object.
- **Which buffer** to read from is chosen on the command list, with `IASetVertexBuffers` – you'll see it in the next
  section.

`IASetVertexBuffers` doesn't take the resource itself but a **vertex buffer view**, a small structure that says
where the vertex data is and how big it is:

```cpp
// Initialize the vertex buffer view.
m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
m_vertexBufferView.StrideInBytes = sizeof(Vertex);
m_vertexBufferView.SizeInBytes = vertexBufferSize;
```

- `BufferLocation` is the buffer's address in the GPU's virtual address space.
- `StrideInBytes` is the size of one vertex: `sizeof(Vertex)`, 12 bytes. This is the stride that OpenGL passes to
  `glVertexAttribPointer`.
- `SizeInBytes` is the size of the whole buffer.

Unlike most things in Direct3D 12, a vertex buffer view is not stored in a descriptor heap: it is passed directly to
the command list. The member `m_vertexBufferView` is already declared in the class.

Now do the fifth task: create the vertex buffer in `LoadAssets` – the three vertices from *Vertex input* (top,
bottom right, bottom left), the committed resource in the upload heap, `Map` + `memcpy` + `Unmap`, and the vertex
buffer view. Build & run: still only the clear colour; nothing draws yet.
:::

:::opengl
```quiz
What does a vertex array object (VAO) store? (Choose all that apply.)
- [ ] The shader program to draw with
- [x] Whether each vertex attribute is enabled (`glEnableVertexAttribArray`)
- [x] The vertex attribute configurations made with `glVertexAttribPointer`
- [x] Which vertex buffer object each attribute reads from
---
The shader program is activated separately with `glUseProgram`. (A VAO also stores the bound element buffer object, as you'll see below.)
```
:::
:::vulkan
```quiz
Vulkan has no VAO. Where does the information an OpenGL VAO holds go? (Choose all that apply.)
- [x] The vertex data's format goes into the pipeline's vertex input state
- [x] The buffer to read from is bound in the command buffer with `vkCmdBindVertexBuffers`
- [ ] Into a `VkVertexArray` object
---
The format is fixed when the pipeline is created; the buffer can change from one draw to the next. There is no `VkVertexArray` in Vulkan.
```
:::
:::d3d12
```quiz
Direct3D 12 has no VAO. Where does the information an OpenGL VAO holds go? (Choose all that apply.)
- [ ] Into an `ID3D12VertexArray` object
- [x] The vertex data's format goes into the input layout of the pipeline state object
- [x] The buffer to read from is set on the command list with `IASetVertexBuffers` and a vertex buffer view
---
The format is fixed when the PSO is created; the buffer can change from one draw to the next. There is no `ID3D12VertexArray` in Direct3D 12.
```
:::

## The triangle we've all been waiting for

:::opengl
To draw your objects of choice, OpenGL provides the `glDrawArrays` function, which draws primitives using the
currently active shader, the previously defined vertex attribute configuration and the VBO's vertex data
(indirectly bound via the VAO). Put the draw calls in the render loop, after `glClear` and before
`glfwSwapBuffers`:

```cpp
// draw our first triangle
glUseProgram(shaderProgram);
glBindVertexArray(VAO); // seeing as we only have a single VAO there's no need to bind it every time, but we'll do so to keep things a bit more organized
glDrawArrays(GL_TRIANGLES, 0, 3);
```

`glDrawArrays` takes as its first argument the OpenGL primitive type you want to draw. You want triangles, so you
pass `GL_TRIANGLES`. The second argument is the starting index of the vertex array, `0`. The last argument is how
many vertices to draw: `3` (you only render one triangle from your data, which is exactly 3 vertices long).

Now do the sixth task: add the three calls to the render loop, then build and run. You should see an orange triangle on
the teal background, with its corners at the pixels (400, 150), (600, 450) and (200, 450).

If the triangle doesn't appear, look at the program's console for shader compile or link errors, then compare your code
with the excerpts above. Getting here is a real milestone: this is the moment learnopengl calls the triangle "we've all
been waiting for".
:::
:::vulkan
Drawing happens in `recordCommandBuffer()`, between `vkCmdBeginRenderPass` and `vkCmdEndRenderPass` – the render pass
you already begin every frame, which clears the image to teal. Inside it, you bind the pipeline, set the dynamic
state, bind the vertex buffer and draw:

```cpp
vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);

VkViewport viewport{};
viewport.x = 0.0f;
viewport.y = 0.0f;
viewport.width = static_cast<float>(swapChainExtent.width);
viewport.height = static_cast<float>(swapChainExtent.height);
viewport.minDepth = 0.0f;
viewport.maxDepth = 1.0f;
vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

VkRect2D scissor{};
scissor.offset = {0, 0};
scissor.extent = swapChainExtent;
vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

VkBuffer vertexBuffers[] = {vertexBuffer};
VkDeviceSize offsets[] = {0};
vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

- `vkCmdBindPipeline` selects the graphics pipeline (`VK_PIPELINE_BIND_POINT_GRAPHICS`, as opposed to a compute
  pipeline).
- The viewport covers the whole swap chain image, with the standard depth range 0 to 1. The scissor covers the whole
  image too, so nothing is cut off. Because both are dynamic state, you must set them in the command buffer before
  drawing – the pipeline doesn't contain them.
- `vkCmdBindVertexBuffers` binds `vertexBuffer` to binding 0 (the first binding, one binding), starting at byte
  offset 0. This is the binding your binding description refers to.
- `vkCmdDraw` takes the vertex count (3), the instance count (`1`: no instanced rendering), the first vertex (`0`)
  and the first instance (`0`).

Now do the seventh task: add these commands at the TODO in `recordCommandBuffer()`, then build and run. You should see
an orange triangle on the teal background, with its corners at the pixels (400, 150), (600, 450) and (200, 450).

If the window stays teal, check the program's console for validation messages first: they usually name the problem. Then
check the vertices and the rasterizer settings (`cullMode` and `frontFace`). It took a lot of code to get here – about a
thousand lines – but every piece of it is now in place, and the next chapters will change only small parts.
:::
:::d3d12
Drawing happens in `PopulateCommandList`, which records the commands of a frame. `m_commandList->Reset` already sets
the pipeline state (`m_pipelineState.Get()`) at the start of every frame. The commands you add come in three places.
First, right after the reset, the state the PSO doesn't contain:

```cpp
// Set necessary state.
m_commandList->SetGraphicsRootSignature(m_rootSignature.Get());
m_commandList->RSSetViewports(1, &m_viewport);
m_commandList->RSSetScissorRects(1, &m_scissorRect);
```

- The root signature must be set on the command list, and it must match the one the PSO was created with.
- `m_viewport` (from 0, 0 to 800, 600, depth 0 to 1) maps normalized device coordinates to pixels.
- `m_scissorRect` covers the whole window. In Direct3D 12 the scissor test is always on, so pixels outside the
  scissor rectangle are discarded – you must set one before drawing.

Both are already initialised in the constructor, as `CD3DX12_VIEWPORT` and `CD3DX12_RECT`. Second, after the
resource barrier, bind the back buffer as the **render target**:

```cpp
CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
```

In the previous chapter you only cleared the back buffer, and `ClearRenderTargetView` takes the render target view
directly. Drawing is different: the output merger writes to the render targets that are *bound*. The arguments are
one render target, its descriptor handle, `FALSE` (the handles are not one contiguous range – there is only one) and
no depth-stencil view (`nullptr`).

Third, after the clear, the draw itself:

```cpp
m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
m_commandList->DrawInstanced(3, 1, 0, 0);
```

- `IASetPrimitiveTopology` tells the input assembler how to build primitives from the vertices: a triangle list,
  every three vertices form one triangle (like `GL_TRIANGLES`). The PSO only said "triangles"; this sets the exact
  topology.
- `IASetVertexBuffers` binds the vertex buffer view to input slot 0 (the first slot, one view).
- `DrawInstanced` takes the number of vertices per instance (3), the number of instances (`1`), the first vertex
  (`0`) and the first instance (`0`).

Now do the sixth task: add the three groups of calls in `PopulateCommandList`, then build and run. You should see an
orange triangle on the teal background, with its corners at the pixels (400, 150), (600, 450) and (200, 450).

If you only see the clear colour, check the vertex order first (clockwise!), then that the root signature, the
viewport, the scissor rectangle and the render target are all set.
:::

:::opengl
```quiz
You swap the first two vertices, so the triangle's corners are now in clockwise order on the screen. What happens in this program?
- [x] The triangle is still drawn: face culling is off by default in OpenGL
- [ ] The triangle is drawn upside down
- [ ] The triangle disappears, because it is now a back face
---
OpenGL only discards back faces when you enable face culling with `glEnable(GL_CULL_FACE)` – a later chapter does that. Without it, the order of the vertices doesn't matter here.
```
:::
:::vulkan
```quiz
You change only `rasterizer.frontFace` to `VK_FRONT_FACE_COUNTER_CLOCKWISE`. What do you see?
- [ ] The same orange triangle
- [x] Only teal: the clockwise triangle is now a back face, and back faces are culled
- [ ] The triangle upside down
---
`cullMode = VK_CULL_MODE_BACK_BIT` discards back faces. Which triangles are back faces depends on `frontFace` and the order of the vertices on the screen (remember that y points down).
```
:::
:::d3d12
```quiz
You use learnopengl's vertex order instead: left (-0.5, -0.5), right (0.5, -0.5), top (0.0, 0.5). What do you see with `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)`?
- [x] Only the clear colour: the triangle is counter-clockwise on the screen, so it is a back face and is culled
- [ ] The same orange triangle
- [ ] The triangle upside down
---
The default rasterizer state culls back faces (`D3D12_CULL_MODE_BACK`) and treats clockwise triangles as front faces (`FrontCounterClockwise = FALSE`).
```
:::

## Element Buffer Objects

There is one last thing to discuss when rendering vertices: **element buffer objects**, EBO for short (Vulkan and
Direct3D call them **index buffers**). To explain how they work, an example: suppose you want to draw a rectangle
instead of a triangle. You can draw a rectangle with two triangles (the GPU prefers to work with triangles). That
would take the following set of vertices:

:::opengl d3d12
```cpp
float vertices[] = {
    // first triangle
     0.5f,  0.5f, 0.0f,  // top right
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f,  0.5f, 0.0f,  // top left
    // second triangle
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f, -0.5f, 0.0f,  // bottom left
    -0.5f,  0.5f, 0.0f   // top left
};
```
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    // first triangle
    {{-0.5f, -0.5f, 0.0f}},  // top left
    {{0.5f, -0.5f, 0.0f}},   // top right
    {{0.5f, 0.5f, 0.0f}},    // bottom right
    // second triangle
    {{0.5f, 0.5f, 0.0f}},    // bottom right
    {{-0.5f, 0.5f, 0.0f}},   // bottom left
    {{-0.5f, -0.5f, 0.0f}}   // top left
};
```
:::

As you can see, some vertices overlap: bottom right and top left are specified twice. That is an overhead of 50%,
since the same rectangle could also be specified with only 4 vertices instead of 6. It only gets worse with more
complex models of thousands of triangles, where large parts overlap. A better solution is to store only the unique
vertices and then specify the *order* in which to draw them. Then you only need 4 vertices for the rectangle, plus a
list of indices that says which vertices form each triangle. This is called **indexed drawing**, and it is exactly
what element buffer objects are for.

:::opengl
An EBO is a buffer, just like a vertex buffer object, that stores indices which OpenGL uses to decide what vertices
to draw. First you specify the unique vertices and the indices to draw them as a rectangle:

```cpp
float vertices[] = {
     0.5f,  0.5f, 0.0f,  // top right
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f, -0.5f, 0.0f,  // bottom left
    -0.5f,  0.5f, 0.0f   // top left
};
unsigned int indices[] = {  // note that we start from 0!
    0, 1, 3,  // first Triangle
    1, 2, 3   // second Triangle
};
```

When you use indices, you only need 4 vertices instead of 6. Next you create the element buffer object (as a third
name next to `VBO` and `VAO`: `unsigned int VBO, VAO, EBO;` and `glGenBuffers(1, &EBO);`). Similar to the VBO, you
bind the EBO and copy the indices into it with `glBufferData`, this time with the buffer type
`GL_ELEMENT_ARRAY_BUFFER`. Do it while the VAO is bound, right after the VBO's data:

```cpp
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
```

A VAO also keeps track of element buffer object bindings: the last EBO bound while a VAO is bound is stored as that
VAO's element buffer object. Binding the VAO then automatically binds the EBO as well. That is also why you must
**not** unbind the EBO while the VAO is bound – the VAO would then have no EBO:

```cpp
// remember: do NOT unbind the EBO while a VAO is active as the bound element buffer object IS stored in the VAO; keep the EBO bound.
//glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
```

Delete the EBO in the clean-up with `glDeleteBuffers(1, &EBO);`.

Now do the seventh task: replace the vertices with the four corners, add the indices and the EBO, and delete it in
the clean-up. Build & run: since the loop still calls `glDrawArrays(GL_TRIANGLES, 0, 3)`, it draws the first three
of the new vertices – top right, bottom right, bottom left – an orange right-angled triangle, the lower-right half of
the rectangle.

To draw with the indices, replace `glDrawArrays` with `glDrawElements`:

```cpp
glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
```

The first argument is the mode, as with `glDrawArrays`. The second is the count, the number of elements to draw:
6 indices, so 6 vertices in total. The third is the type of the indices, `GL_UNSIGNED_INT`. The last argument is an
offset into the EBO (or an index array, when you don't use an EBO – not done here). `glDrawElements` takes its
indices from the EBO bound to `GL_ELEMENT_ARRAY_BUFFER`, which the VAO brings along. That means you would otherwise
have to bind the corresponding EBO every time you render an object with indices – a VAO does that for you.

Now do the eighth task: replace `glDrawArrays` with `glDrawElements`, then build and run. You should see an orange
rectangle covering the pixels (200, 150) to (600, 450).
:::
:::vulkan
In Vulkan, an index buffer is a `VkBuffer` like the vertex buffer – only with a different usage. The indices are a
`std::vector<uint16_t>`:

```cpp
const std::vector<uint16_t> indices = {
    0, 1, 2, 2, 3, 0
};
```

`uint16_t` is enough as long as you have fewer than 65,536 unique vertices. `createIndexBuffer()` is
`createVertexBuffer()` with three changes: the size is `sizeof(indices[0]) * indices.size()`, the usage is
`VK_BUFFER_USAGE_INDEX_BUFFER_BIT`, and it copies `indices.data()` into `indexBuffer` / `indexBufferMemory`:

```cpp
void createIndexBuffer() {
    VkBufferCreateInfo bufferInfo{};
    bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    bufferInfo.size = sizeof(indices[0]) * indices.size();
    bufferInfo.usage = VK_BUFFER_USAGE_INDEX_BUFFER_BIT;
    bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateBuffer(device, &bufferInfo, nullptr, &indexBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create index buffer!");
    }

    VkMemoryRequirements memRequirements;
    vkGetBufferMemoryRequirements(device, indexBuffer, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &indexBufferMemory) != VK_SUCCESS) {
        throw std::runtime_error("failed to allocate index buffer memory!");
    }

    vkBindBufferMemory(device, indexBuffer, indexBufferMemory, 0);

    void* data;
    vkMapMemory(device, indexBufferMemory, 0, bufferInfo.size, 0, &data);
        memcpy(data, indices.data(), (size_t) bufferInfo.size);
    vkUnmapMemory(device, indexBufferMemory);
}
```

(vulkan-tutorial uses a staging buffer for both buffers at this point; this project keeps host-visible memory for
both, as explained in *Vertex input*.) It is called in `initVulkan()` right after `createVertexBuffer()`, and
`cleanup()` destroys the buffer and frees its memory, like the vertex buffer's.

Now do the eighth task: add `indices`, the members `indexBuffer` and `indexBufferMemory`, `createIndexBuffer()`, the
call and the clean-up. Build & run: the picture doesn't change – the index buffer exists, but the draw command
doesn't use it yet.

To draw the rectangle, the vertices become the four corners. Remember that y points down in Vulkan:

```cpp
const std::vector<Vertex> vertices = {
    {{-0.5f, -0.5f, 0.0f}},
    {{0.5f, -0.5f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}}
};
```

That is top left, top right, bottom right, bottom left. The triangles `0, 1, 2` (top left, top right, bottom right)
and `2, 3, 0` (bottom right, bottom left, top left) both go clockwise on the screen, so neither is culled. In
`recordCommandBuffer()`, bind the index buffer and replace `vkCmdDraw` with `vkCmdDrawIndexed`:

```cpp
vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT16);

vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

`vkCmdBindIndexBuffer` takes the buffer, a byte offset into it and the type of the indices – `VK_INDEX_TYPE_UINT16`
for `uint16_t`. Unlike vertex buffers, there is only ever one index buffer bound. `vkCmdDrawIndexed` takes the number
of indices (6), the number of instances (1), the first index (0), an offset added to every index (0) and the first
instance (0).

Now do the ninth task: change `vertices` to the four corners, bind the index buffer and draw with `vkCmdDrawIndexed`.
Build and run: you should see an orange rectangle covering the pixels (200, 150) to (600, 450).
:::
:::d3d12
In Direct3D 12, an index buffer is a resource like the vertex buffer. First, replace the triangle's vertices with
the four corners of the rectangle, in the same order as learnopengl:

```cpp
// Define the four corners of a rectangle.
Vertex vertices[] =
{
    { { 0.5f, 0.5f, 0.0f } },     // top right
    { { 0.5f, -0.5f, 0.0f } },    // bottom right
    { { -0.5f, -0.5f, 0.0f } },   // bottom left
    { { -0.5f, 0.5f, 0.0f } }     // top left
};
```

Now do the seventh task: replace the vertices. Build & run: `DrawInstanced(3, 1, 0, 0)` still draws only the first
three vertices – top right, bottom right, bottom left. That is clockwise on the screen, so it isn't culled: you see
an orange right-angled triangle, the lower-right half of the rectangle.

The index buffer is created in its own block in `LoadAssets`, after the vertex buffer (before the synchronisation
objects), exactly like the vertex buffer:

```cpp
// Create the index buffer.
{
    // The rectangle's two triangles, as indices into the vertex buffer. Both are
    // clockwise on screen (front faces): top right, bottom right, top left and
    // bottom right, bottom left, top left.
    UINT indices[] =
    {
        0, 1, 3,   // first triangle
        1, 2, 3    // second triangle
    };

    const UINT indexBufferSize = sizeof(indices);

    // An upload heap again, like the vertex buffer.
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
    ThrowIfFailed(m_device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&m_indexBuffer)));

    // Copy the indices to the index buffer.
    UINT8* pIndexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
    memcpy(pIndexDataBegin, indices, sizeof(indices));
    m_indexBuffer->Unmap(0, nullptr);

    // Initialize the index buffer view: 32-bit indices (UINT).
    m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
    m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
    m_indexBufferView.SizeInBytes = indexBufferSize;
}
```

The index buffer view has a `Format` instead of a stride: `DXGI_FORMAT_R32_UINT` for 32-bit indices (`UINT`).
(With `uint16_t` indices it would be `DXGI_FORMAT_R16_UINT`.) The resource and the view are new members of the class:

```cpp
ComPtr<ID3D12Resource> m_indexBuffer;
D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
```

In `PopulateCommandList`, bind the index buffer and draw with `DrawIndexedInstanced` instead of `DrawInstanced`:

```cpp
m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
m_commandList->IASetIndexBuffer(&m_indexBufferView);
m_commandList->DrawIndexedInstanced(6, 1, 0, 0, 0);
```

`DrawIndexedInstanced` takes the number of indices per instance (6), the number of instances (1), the first index
(0), a value added to every index before the vertex is read (the *base vertex*, 0) and the first instance (0).

Now do the eighth task: add the two members, the index buffer block, `IASetIndexBuffer` and `DrawIndexedInstanced`.
Build and run: you should see an orange rectangle covering the pixels (200, 150) to (600, 450).
:::

```quiz
How much data does the indexed rectangle use?
- [ ] 6 vertices and no indices
- [ ] 4 vertices and 4 indices
- [x] 4 vertices and 6 indices
---
Each of the two triangles needs 3 indices, but the two corners they share are stored only once in the vertex buffer.
```

### Wireframe mode

To see the two triangles the rectangle is made of, you can draw it in **wireframe mode**: only the edges of the
triangles are drawn, not their insides.

:::opengl
`glPolygonMode` configures how OpenGL draws its primitives. The solution of the fifth task added this line,
commented out, after the vertex setup:

```cpp
//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
```

The first argument says you want to apply it to the front and back of all triangles, the second to draw them as
lines. Every following draw call renders the triangles in wireframe mode until you set it back to the default with
`glPolygonMode(GL_FRONT_AND_BACK, GL_FILL)`. Try it: uncomment the line, build and run, and you see the outline of
the two triangles and their shared diagonal. Put the comment back afterwards.
:::
:::vulkan
In Vulkan the polygon mode is part of the rasterizer state in the pipeline:

```cpp
rasterizer.polygonMode = VK_POLYGON_MODE_LINE;
```

Any mode other than `VK_POLYGON_MODE_FILL` requires the `fillModeNonSolid` GPU feature, which you must enable when
you create the logical device: in `createLogicalDevice()`, set `deviceFeatures.fillModeNonSolid = VK_TRUE;` before
`vkCreateDevice` (a real program would also check that the GPU supports the feature). Without the feature, the
validation layers report an error. This is not part of the tasks; if you try it, change both lines back afterwards.
And since the polygon mode is baked into the pipeline, switching between wireframe and fill at run time means having
two pipelines.
:::
:::d3d12
In Direct3D 12 the fill mode is part of the rasterizer state in the PSO. To see the triangles, add this line after
`psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);`:

```cpp
psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;
```

Build and run, and you see the outline of the two triangles and their shared diagonal. Remove the line afterwards –
the default is `D3D12_FILL_MODE_SOLID`. Because the fill mode is baked into the PSO, switching between wireframe and
solid at run time means having two pipeline state objects.
:::

If you managed to draw a triangle or a rectangle just like this chapter did, then congratulations: you made it past
one of the hardest parts of modern graphics programming – drawing your first triangle. It is a difficult part,
because a lot of knowledge is required before you can draw anything. Thankfully, you are past that barrier now, and
the next chapters will hopefully be much easier to understand.

## Additional resources

:::opengl
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) on learnopengl.com – the original
  chapter, with diagrams of the pipeline and the vertex data.
- The source code of the chapter: [hello_triangle.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.1.hello_triangle/hello_triangle.cpp)
  and [hello_triangle_indexed.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.2.hello_triangle_indexed/hello_triangle_indexed.cpp).
- [Vertex Specification](https://www.khronos.org/opengl/wiki/Vertex_Specification) on the OpenGL wiki – VBOs, VAOs
  and vertex attributes in depth.
- [Rendering Pipeline Overview](https://www.khronos.org/opengl/wiki/Rendering_Pipeline_Overview) on the OpenGL wiki.
:::
:::vulkan
- vulkan-tutorial.com: [Graphics pipeline basics](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Introduction),
  [Shader modules](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Shader_modules) and
  [Fixed functions](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions).
- vulkan-tutorial.com: [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description),
  [Vertex buffer creation](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation) and
  [Index buffer](https://vulkan-tutorial.com/Vertex_buffers/Index_buffer).
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) on learnopengl.com – the chapter this one
  follows, with diagrams of the pipeline.
:::
:::d3d12
- [Creating a basic Direct3D 12 component](https://learn.microsoft.com/en-us/windows/win32/direct3d12/creating-a-basic-direct3d-12-component)
  on Microsoft Learn – walks through the HelloTriangle sample.
- [Root signatures](https://learn.microsoft.com/en-us/windows/win32/direct3d12/root-signatures) and
  [Managing graphics pipeline state in Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/managing-graphics-pipeline-state-in-direct3d-12).
- [Semantics](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics) in the HLSL
  reference.
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) on learnopengl.com – the chapter this one
  follows, with diagrams of the pipeline.
:::

## Exercises

To really get a good grasp of the concepts discussed, a few exercises were set up. It is advised to work through them
before continuing to the next subject, to make sure you get a good grasp of what's going on. The project is yours to
change: try them in your IDE, and copy the start files into a new folder if you want a clean start.

:::opengl
1. Try to draw 2 triangles next to each other using `glDrawArrays` by adding more vertices to your data.
   [Solution](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.3.hello_triangle_exercise1/hello_triangle_exercise1.cpp).
2. Now create the same 2 triangles using two different VAOs and VBOs for their data.
   [Solution](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.4.hello_triangle_exercise2/hello_triangle_exercise2.cpp).
3. Create two shader programs where the second program uses a different fragment shader that outputs the colour
   yellow; draw both triangles again where one outputs the colour yellow.
   [Solution](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.5.hello_triangle_exercise3/hello_triangle_exercise3.cpp).
:::
:::vulkan
1. Draw 2 triangles next to each other with `vkCmdDraw` by adding more vertices to `vertices` (6 vertices, drawn
   without the index buffer). Keep each triangle clockwise on the screen – remember that y points down.
2. Now create the same 2 triangles using two different vertex buffers: bind the first with `vkCmdBindVertexBuffers`
   and draw it, then bind the second and draw again.
3. Create a second graphics pipeline with a different fragment shader that outputs the colour yellow; bind the first
   pipeline and draw one triangle, then bind the second pipeline and draw the other.
:::
:::d3d12
1. Draw 2 triangles next to each other with `DrawInstanced` by adding more vertices to `vertices` (6 vertices, drawn
   without the index buffer). Keep each triangle clockwise on the screen, or it is culled.
2. Now create the same 2 triangles using two different vertex buffers, each with its own vertex buffer view: set the
   first with `IASetVertexBuffers` and draw, then set the second and draw again.
3. Create a second pipeline state object with a different pixel shader that outputs the colour yellow (a second
   function in `shaders.hlsl`, compiled with its own entry point); draw one triangle with the first PSO, then switch
   with `SetPipelineState` and draw the other.
:::
