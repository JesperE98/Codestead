# DSA

This chapter is about OpenGL itself. Since its beginnings OpenGL has worked with a model often called *bind to edit*:
to change an object – a buffer, a texture, a vertex array – you first bind it to a *target* of the context, and the
functions you call afterwards work on whatever is bound to that target. `glBufferData(GL_ARRAY_BUFFER, …)` doesn't say
which buffer it fills; it fills the one that happens to be bound to `GL_ARRAY_BUFFER`. OpenGL 4.5 added a second way,
*direct state access* (DSA): functions that take the object they work on as a parameter. learnopengl's guest article
*DSA* introduces them, and this chapter follows it.

:::opengl
You have used bind to edit since *Hello Triangle*. In this chapter you rewrite that chapter's program – the orange
rectangle drawn from a vertex buffer, an element buffer and a vertex array object – with DSA, and then go one step
further than learnopengl's demo and put the container texture on it, created through DSA as well.
:::
:::vulkan
Vulkan never had bind to edit: from the start, every Vulkan function names the object it works on. So this chapter has
**no tasks** for Vulkan. Its project is the *Hello Triangle* program – the orange rectangle from a vertex buffer and an
index buffer – and the chapter explains what DSA changes in OpenGL and how it brings OpenGL closer to the model Vulkan
has always had, comparing each DSA function with the Vulkan code you know. It is worth reading even if you never write
OpenGL: much OpenGL code you will meet is written one way or the other, and the comparison shows why Vulkan's API looks
the way it does.
:::
:::d3d12
Direct3D 12 never had bind to edit: every call names the object it works on, and objects are COM interfaces with
methods. So this chapter has **no tasks** for DirectX 12. Its project is the *Hello Triangle* program – the orange
rectangle from a vertex buffer and an index buffer – and the chapter explains what DSA changes in OpenGL and how it
brings OpenGL closer to the model Direct3D 12 has always had, comparing each DSA function with the Direct3D 12 code you
know. It is worth reading even if you never write OpenGL: much OpenGL code you will meet is written one way or the
other, and the comparison shows why Direct3D 12's API looks the way it does.
:::

## Bind to edit

Here is how *Hello Triangle* sets up its vertex data:

```cpp
    unsigned int VBO, VAO, EBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glGenBuffers(1, &EBO);
    // bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
    glBindVertexArray(VAO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

Every line after the first four depends on what is bound at that moment. `glBufferData` fills the buffer bound to its
target. `glVertexAttribPointer` describes attribute 0 of the bound VAO *and* records the buffer bound to
`GL_ARRAY_BUFFER` as its source. Binding `GL_ELEMENT_ARRAY_BUFFER` while a VAO is bound stores the element buffer in that
VAO – which is why learnopengl warns never to unbind the element buffer while the VAO is still bound. None of this is
visible in the calls themselves; you have to know the context's state to know what a line does.

In a small program that is manageable. In a large one it causes real trouble:

- **State leaks.** A function binds a buffer to change it and doesn't restore the old binding. Later code that relied
  on the old binding now edits the wrong buffer – far away from the function that caused it.
- **Hidden dependencies.** A helper that creates a texture binds it to `GL_TEXTURE_2D` of the active texture unit, and
  silently replaces whatever texture the caller had bound there for drawing. A VAO that happens to be bound when you
  set up an element buffer for something else swallows it.
- **Extra work.** Binding only to edit costs calls, and the driver has to track and validate bindings that don't matter
  for any draw.
- **Two meanings for one binding.** `glBindTexture` is used both to edit a texture and to choose the texture a draw
  reads. The two uses fight over the same binding point.

```quiz
A function `loadTexture()` calls `glBindTexture(GL_TEXTURE_2D, newTexture)` to set up a new texture and returns without restoring the binding. The caller had bound its sand texture to unit 0 before calling it and draws right after. What does the draw use?
- [ ] The sand texture: a texture bound for drawing can't be replaced by one bound for editing
- [x] The new texture, if unit 0 was the active unit: bind-to-edit changed the binding the draw reads
- [ ] No texture at all: `glBindTexture` without a draw unbinds the unit
- [ ] Both textures, blended
---
This is a typical state leak: the binding used for editing is the same one used for drawing. With DSA, `glTextureStorage2D(newTexture, …)` and friends set the texture up without touching any binding.
```

## Direct state access

OpenGL 4.5 made the extension `ARB_direct_state_access` part of the core: for almost every function that edits a bound
object there is now a version that takes the object's name instead. They follow a few naming patterns:

| Bind to edit | Direct state access |
|---|---|
| `glGenBuffers` + `glBindBuffer` | `glCreateBuffers` |
| `glBufferData(GL_ARRAY_BUFFER, …)` | `glNamedBufferData(buffer, …)` / `glNamedBufferStorage(buffer, …)` |
| `glBufferSubData(GL_ARRAY_BUFFER, …)` | `glNamedBufferSubData(buffer, …)` |
| `glGenVertexArrays` + `glBindVertexArray` | `glCreateVertexArrays` |
| `glVertexAttribPointer` | `glVertexArrayAttribFormat` + `glVertexArrayAttribBinding` + `glVertexArrayVertexBuffer` |
| `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, …)` with a VAO bound | `glVertexArrayElementBuffer(vao, buffer)` |
| `glGenTextures` + `glBindTexture` | `glCreateTextures(target, …)` |
| `glTexParameteri(GL_TEXTURE_2D, …)` | `glTextureParameteri(texture, …)` |
| `glTexImage2D` | `glTextureStorage2D` + `glTextureSubImage2D` |
| `glGenerateMipmap(GL_TEXTURE_2D)` | `glGenerateTextureMipmap(texture)` |
| `glActiveTexture` + `glBindTexture` (for drawing) | `glBindTextureUnit(unit, texture)` |
| `glGenFramebuffers` + `glBindFramebuffer` + `glFramebufferTexture2D` | `glCreateFramebuffers` + `glNamedFramebufferTexture` |

`glCreate*` differs from `glGen*` in a subtle way: `glGen*` only reserves a *name*; the object behind it is created the
first time the name is bound, and that first bind also decides what kind of object it is (a texture first bound to
`GL_TEXTURE_2D` is a 2D texture forever). `glCreate*` creates the objects right away – `glCreateTextures` therefore
takes the target as a parameter – so they can be edited by name without ever being bound.

DSA doesn't remove binding. To *draw*, you still bind: the program, the VAO, the textures to their units. What
disappears is binding in order to *edit*. Objects are created and set up by name, and binding is left for what it is
good at: choosing what the next draw uses.

```quiz
Why can't a buffer name from `glGenBuffers` simply be passed to `glNamedBufferStorage` before it has ever been bound?
- [ ] Because `glGenBuffers` creates buffers of a fixed size
- [ ] Because named functions only work on buffers created with `GL_DYNAMIC_STORAGE_BIT`
- [x] Because `glGenBuffers` only reserves a name; the buffer object itself is created at its first bind – `glCreateBuffers` creates the object at once
- [ ] It can: `glGen*` and `glCreate*` are the same function under two names
---
This is why DSA comes with its own create functions. For textures the difference is even clearer: `glCreateTextures(GL_TEXTURE_2D, …)` fixes the texture's type at creation, where `glGenTextures` leaves it to the first `glBindTexture`.
```

:::opengl
### The context

The DSA functions are core only from OpenGL **4.5**; the course's other programs ask for 3.3. learnopengl's demo asks
for 4.5, and so does this chapter's program:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 5);
```

GLAD has to be generated for 4.5 (or with the extension) so that the function pointers are loaded. **macOS stops at
OpenGL 4.1**, so this chapter's program doesn't run on a Mac – the bind-to-edit code of the other chapters does.
(Before 4.5, the older extension `EXT_direct_state_access` offered similar functions with other names, such as
`glNamedBufferDataEXT` and `glTextureParameteriEXT`; you may still meet them in older code.)

The project is the course's *Hello Triangle* solution, the orange rectangle, with `// TODO:` comments where the DSA code
goes. Build and run it in your IDE. Now do the first task, **context**. The picture doesn't change: the bind-to-edit
code runs unchanged in a 4.5 context.
:::
:::vulkan
### The project

The project is the course's Vulkan *Hello Triangle* solution: the orange rectangle `(1.0, 0.5, 0.2)` – two triangles
from an index buffer – on the teal clear colour. Build and run it in your IDE; it is the same rectangle the OpenGL
version of this chapter starts from. The sections below put its code next to OpenGL's DSA calls.
:::
:::d3d12
### The project

The project is the course's DirectX 12 *Hello Triangle* solution: the orange rectangle `(1.0, 0.5, 0.2)` – two triangles
from an index buffer – on the teal clear colour. Build and run it in your IDE; it is the same rectangle the OpenGL
version of this chapter starts from. The sections below put its code next to OpenGL's DSA calls.
:::

## Buffers

With DSA a buffer is created with `glCreateBuffers` and given its memory with `glNamedBufferStorage` – no binding:

```cpp
    // Here we create the VBO with DSA.
    GLuint VBO = 0;
    // Note how we do not have to call glBindBuffer() after the create call.
    glCreateBuffers(1, &VBO);
    glNamedBufferStorage(VBO, sizeof(vertices), vertices, 0x0);
```

`glNamedBufferStorage` is not just `glBufferData` with a name. It allocates **immutable storage**: the buffer's size is
fixed once and for all, and calling it a second time on the same buffer is an error. `glBufferData` (and its DSA
version `glNamedBufferData`) may be called again with another size, and the driver then has to throw the old memory away
and allocate new memory behind the same name – which is convenient, but means the driver can never be sure where a
buffer's memory lives. With immutable storage it can.

The last parameter replaces `glBufferData`'s usage hint (`GL_STATIC_DRAW` …) with **flags** that are promises and
permissions: `0` means the program will never change the contents from the CPU – the vertices are uploaded once, at
creation. `GL_DYNAMIC_STORAGE_BIT` allows `glNamedBufferSubData`; `GL_MAP_READ_BIT` / `GL_MAP_WRITE_BIT` allow mapping,
and `GL_MAP_PERSISTENT_BIT` lets a buffer stay mapped while the GPU uses it. learnopengl's demo creates the element
buffer that way – storage without data, but updatable, then the indices uploaded into it:

```cpp
    // Here we create the EBO with DSA while also specifying that the buffer is mutable from the client side.
    GLuint EBO = 0;
    glCreateBuffers(1, &EBO);
    glNamedBufferStorage(EBO, sizeof(indices), nullptr, GL_DYNAMIC_STORAGE_BIT);
    glNamedBufferSubData(EBO, 0, sizeof(indices), indices);
```

:::opengl
Now do the second task, **vertex-buffer**, and the third, **element-buffer**: replace `glGenBuffers` and the bind +
`glBufferData` pairs with the DSA calls. The vertex array setup that follows still binds the vertex buffer to
`GL_ARRAY_BUFFER` once for `glVertexAttribPointer` – the next task removes that too. The picture stays the same.
:::
:::vulkan
In Vulkan this has always been the only way, and it goes a step further. The buffer is an object with a fixed size,
created by name:

```cpp
        if (vkCreateBuffer(device, &bufferInfo, nullptr, &vertexBuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create vertex buffer!");
        }
```

but it has no memory yet. Its memory is a separate object, `VkDeviceMemory`, allocated from a memory type you choose –
`HOST_VISIBLE | HOST_COHERENT` here, so the CPU can write it – and attached to the buffer once:

```cpp
        vkBindBufferMemory(device, vertexBuffer, vertexBufferMemory, 0);
```

Every call names its objects: `vkGetBufferMemoryRequirements(device, vertexBuffer, …)`, `vkMapMemory(device,
vertexBufferMemory, …)`. There is no "currently bound buffer" anywhere. OpenGL's immutable storage is the step towards
this model: a fixed size, and flags that say up front how the memory will be used – Vulkan's memory property flags play
that part.
:::
:::d3d12
In Direct3D 12 this has always been the only way. A buffer is an `ID3D12Resource`, created with its size and its memory
in one call – the heap type says what kind of memory (`UPLOAD` here, CPU-writable; `DEFAULT` for memory only the GPU
uses):

```cpp
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

It is filled through the resource itself – `m_vertexBuffer->Map(…)`, `memcpy`, `m_vertexBuffer->Unmap(…)` – like
`glNamedBufferSubData`, never through a bound target. Its size is fixed, like OpenGL's immutable storage. A
*committed* resource gets memory of its own; `CreatePlacedResource` places several resources into one `ID3D12Heap` you
allocated yourself – the fully explicit way, as Vulkan's `vkBindBufferMemory` does.
:::

```quiz
The element buffer is created with `glNamedBufferStorage(EBO, sizeof(indices), nullptr, 0x0)` – flags 0 – and the program then calls `glNamedBufferSubData(EBO, 0, sizeof(indices), indices)`. What happens?
- [ ] The indices are uploaded: flags only matter for mapping
- [ ] The storage is reallocated with the new data
- [ ] Nothing, silently: the buffer stays empty without an error
- [x] `GL_INVALID_OPERATION`: immutable storage created without `GL_DYNAMIC_STORAGE_BIT` may not be changed with `glNamedBufferSubData`
---
The flags are permissions. Flags 0 promise that the contents never change after creation – fine for the vertex buffer, whose data is passed to `glNamedBufferStorage` directly.
```

## Vertex arrays

The biggest change is in the vertex array object. `glVertexAttribPointer` did three things at once: it described an
attribute's format (three floats), said where its data starts (an offset), and fetched the buffer from the
`GL_ARRAY_BUFFER` binding. DSA – using the *separate attribute format* model that OpenGL 4.3 introduced – splits that into
independent pieces:

- an attribute's **format**: its component count, type and its offset *within a vertex*
  (`glVertexArrayAttribFormat`);
- which **binding point** the attribute reads from (`glVertexArrayAttribBinding`);
- which **buffer** feeds a binding point, at which offset and with which stride between vertices
  (`glVertexArrayVertexBuffer`).

```cpp
    // Here we create the VAO with DSA and specify its format.
    GLuint VAO = 0;
    glCreateVertexArrays(1, &VAO);

    // Specifying our vertex layout with the VAO: attribute 0 = three floats at offset 0, read from binding point 0.
    glEnableVertexArrayAttrib(VAO, 0);
    glVertexArrayAttribFormat(VAO, 0, 3, GL_FLOAT, GL_FALSE, 0);
    glVertexArrayAttribBinding(VAO, 0, 0);
```

and, after the attributes, the buffers:

```cpp
    glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 3);
    glVertexArrayElementBuffer(VAO, EBO);
```

The format says *what* a vertex looks like; the binding says *where* the data comes from. You can now switch a VAO to
another buffer with one `glVertexArrayVertexBuffer` call without touching the format, and several attributes can share
one binding point – one interleaved buffer – with one stride. The element buffer is attached explicitly with
`glVertexArrayElementBuffer`: no more VAO that swallows whatever is bound to `GL_ELEMENT_ARRAY_BUFFER`.

:::opengl
Now do the fourth task, **vertex-array**: create the VAO with `glCreateVertexArrays`, describe attribute 0 and attach both
buffers – no `glGenVertexArrays`, `glBindBuffer`, `glVertexAttribPointer` or `glEnableVertexAttribArray` in the setup any
more. The render loop still binds the VAO with `glBindVertexArray(VAO)` – that is binding for drawing, which DSA keeps.
With this task your program is learnopengl's demo. The picture is still the orange rectangle.
:::
:::vulkan
This split is exactly how Vulkan describes vertex input. The *format* lives in the pipeline: a
`VkVertexInputAttributeDescription` per attribute (location, binding, format, offset) and a
`VkVertexInputBindingDescription` per binding (binding, stride):

```cpp
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
```

– `glVertexArrayAttribFormat` and `glVertexArrayAttribBinding`. The *buffers* are chosen when the command buffer is
recorded – `vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets)` (`glVertexArrayVertexBuffer`) and
`vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT16)` (`glVertexArrayElementBuffer`). Vulkan has no
VAO: the format is baked into the pipeline, and the buffers are bound per draw. (Vulkan puts the stride with the binding
description in the pipeline; DSA puts it with the buffer in `glVertexArrayVertexBuffer`.)
:::
:::d3d12
This split is exactly how Direct3D describes vertex input. The *format* is the input layout in the pipeline state
object – per element a semantic, a format, an input slot and a byte offset:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

– `glVertexArrayAttribFormat` (format, offset) and `glVertexArrayAttribBinding` (the input slot). The *buffers* are
bound per draw with views that carry the stride and size – `m_commandList->IASetVertexBuffers(0, 1,
&m_vertexBufferView)` (`glVertexArrayVertexBuffer`) and `m_commandList->IASetIndexBuffer(&m_indexBufferView)`
(`glVertexArrayElementBuffer`). Direct3D 12 has no VAO: the format is baked into the pipeline state, and the buffers are
bound on the command list. (The view puts the stride with the buffer, as `glVertexArrayVertexBuffer` does.)
:::

```quiz
With DSA, the vertices are changed to five floats each (position and texture coordinates) in the same buffer. Which call changes when only the stride changes?
- [ ] `glVertexArrayAttribFormat(VAO, 0, …)`: the format of attribute 0 includes the stride
- [x] `glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 5)`: the stride belongs to the binding point and its buffer
- [ ] `glVertexArrayAttribBinding(VAO, 0, 0)`
- [ ] `glNamedBufferStorage`: the stride is part of the buffer's storage
---
The attribute format holds only the relative offset inside a vertex; the distance between vertices belongs to the buffer binding. That is the split `glVertexAttribPointer` mixed up.
```

## Textures

Textures get the same treatment, and here immutable storage matters even more. `glTexImage2D` defines one mip level at a
time; a texture whose levels don't fit together (wrong sizes, different formats) is *incomplete*, and the driver can only
check that when it is used. `glTextureStorage2D` allocates **all** levels at once, with one format and fixed sizes –
complete by construction; the image is then uploaded into level 0 with `glTextureSubImage2D`, and the other levels are
generated with `glGenerateTextureMipmap`. The number of levels for a full mip chain is `1 + floor(log2(max(width,
height)))` – for the 256 × 256 container, 9: 256, 128, …, 1.

:::opengl
The last task goes a step beyond learnopengl's demo, to the article's section on textures: the rectangle gets the
container texture of the *Textures* chapter. The vertices get texture coordinates – attribute 1, two floats, three
floats into each vertex, read from the same binding point, whose stride grows to five floats:

```cpp
    // attribute 1 = two floats 3 floats into each vertex, from the same binding point
    glEnableVertexArrayAttrib(VAO, 1);
    glVertexArrayAttribFormat(VAO, 1, 2, GL_FLOAT, GL_FALSE, 3 * sizeof(float));
    glVertexArrayAttribBinding(VAO, 1, 0);

    // Binding the VBO (to binding point 0, with the stride between vertices) and the element buffer to the VAO.
    glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 5);
    glVertexArrayElementBuffer(VAO, EBO);
```

The texture is created and filled without a single bind:

```cpp
    GLuint texture = 0;
    glCreateTextures(GL_TEXTURE_2D, 1, &texture);
    // set the texture wrapping and filtering parameters
    glTextureParameteri(texture, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTextureParameteri(texture, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTextureParameteri(texture, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTextureParameteri(texture, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // load image, allocate immutable storage for all mip levels, upload level 0 and generate the mipmaps
    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded texture's on the y-axis.
    unsigned char *data = stbi_load("container.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        int levels = 1 + (int)std::floor(std::log2((float)std::max(width, height)));
        glTextureStorage2D(texture, levels, GL_RGB8, width, height);
        glTextureSubImage2D(texture, 0, 0, 0, width, height, GL_RGB, GL_UNSIGNED_BYTE, data);
        glGenerateTextureMipmap(texture);
    }
```

Note the two kinds of format: `GL_RGB8` in `glTextureStorage2D` is the *internal* format the texture stores – a sized
format is required for immutable storage – and `GL_RGB, GL_UNSIGNED_BYTE` in `glTextureSubImage2D` describe the data
you upload. For drawing, one call replaces `glActiveTexture` + `glBindTexture`:

```cpp
        glBindTextureUnit(0, texture);
```

The fragment shader's `uniform sampler2D texture1;` keeps its default unit 0, so no `glUniform1i` is needed. The vertex
shader string passes `aTexCoord` (location 1) on as `TexCoord`, and the fragment shader returns
`texture(texture1, TexCoord)`. Delete the texture at the end with `glDeleteTextures(1, &texture)`.

Now do the last task, **texture**. Build and run: the wooden container sits on the rectangle, upright, its diagonal brace
running from the bottom left to the top right.
:::
:::vulkan
In Vulkan a texture has always been built this way. `vkCreateImage` creates the image with its size, format and number
of mip levels fixed – immutable storage, like `glTextureStorage2D`. Its memory is allocated and bound separately, as for
a buffer. The pixels arrive through a staging buffer and `vkCmdCopyBufferToImage` – `glTextureSubImage2D` – and the
mip levels, where a program wants them, are filled with `vkCmdBlitImage` from level to level (vulkan-tutorial's
*Generating Mipmaps* chapter) – `glGenerateTextureMipmap`. And there are no texture
units: a shader reads a texture through a **descriptor** that names the image view and the sampler, written with
`vkUpdateDescriptorSets` and bound with `vkCmdBindDescriptorSets` – the counterpart of `glBindTextureUnit(unit,
texture)`, where the descriptor set's binding plays the unit's part. The *Textures* chapter's project has the image,
the staging copy and the descriptor; this chapter's project has no texture.
:::
:::d3d12
In Direct3D 12 a texture has always been built this way. A texture is an `ID3D12Resource` created with its size, format
and number of mip levels fixed – immutable storage, like `glTextureStorage2D`. The pixels arrive through an upload
buffer and `UpdateSubresources` (a copy on the command list) – `glTextureSubImage2D`. Direct3D 12 has no built-in mipmap
generation: the levels are computed by the program (with a compute shader, for instance) or loaded with the image. And
there are no texture units: a shader reads a texture through a **descriptor** – a shader resource view in a descriptor
heap – that the root signature's descriptor table points to (`SetGraphicsRootDescriptorTable`) – the counterpart of
`glBindTextureUnit(unit, texture)`, where the shader register `t0` plays the unit's part. The *Textures* chapter's
project has all of it; this chapter's project has no texture.
:::

```quiz
How many mip levels does `1 + floor(log2(max(width, height)))` give for a 512 × 128 texture?
- [ ] 8
- [ ] 7
- [x] 10
- [ ] 1: immutable storage has a single level unless mipmaps are generated
---
log2(512) = 9, plus the base level: 512, 256, … down to 1 along the longer side (the shorter side stops at 1 earlier and stays there). `glTextureStorage2D` allocates them all; `glGenerateTextureMipmap` fills them.
```

## Other objects

The pattern runs through the whole API. Framebuffers are created with `glCreateFramebuffers` and set up with
`glNamedFramebufferTexture(fbo, GL_COLOR_ATTACHMENT0, texture, 0)`, `glNamedFramebufferDrawBuffers` and
`glCheckNamedFramebufferStatus` – without binding them until you render into them; `glClearNamedFramebufferfv` clears
one of their buffers. Renderbuffers have `glCreateRenderbuffers` and `glNamedRenderbufferStorage`, queries
`glCreateQueries`. For shader programs a similar step came earlier: since OpenGL 4.1, `glProgramUniform*(program,
location, …)` sets a uniform of any program, not only of the one made current with `glUseProgram`.

## Closer to the explicit APIs

Put together, DSA moves OpenGL a good part of the way towards the explicit APIs:

| Idea | OpenGL with DSA | Vulkan | Direct3D 12 |
|---|---|---|---|
| Objects named in every call | `glNamedBufferStorage(buffer, …)` | `vkBindBufferMemory(device, buffer, …)` | `m_vertexBuffer->Map(…)` |
| Fixed size, set up once | immutable storage | `VkBuffer` / `VkImage` with fixed size | resource with fixed size |
| How memory is used, said up front | storage flags | memory property flags | heap type |
| Vertex format apart from buffers | attrib format / binding | vertex input descriptions in the pipeline | input layout in the pipeline state |
| Choosing resources for a draw | `glBindTextureUnit`, `glBindVertexArray` | descriptor sets, `vkCmdBindVertexBuffers` | descriptor tables, `IASetVertexBuffers` |

What DSA does *not* change is the rest of OpenGL's model: the global state machine (depth test, blending, the bound
program) is still set call by call and applies to every following draw, the driver still decides when work reaches the
GPU and synchronises for you, and there are no command buffers you record yourself. Vulkan and Direct3D 12 differ in
those points too – pipeline state objects, explicit command recording and synchronisation – and DSA was never meant to
change them. It removes the part of OpenGL's design that caused the most bugs for the least benefit.

```quiz
Which of these does DSA NOT change about OpenGL?
- [ ] That a buffer has to be bound before its data can be set
- [ ] That a texture has to be bound to a unit before its parameters can be set
- [x] That render state such as the depth test and blending is global state that applies to every following draw
- [ ] That a VAO records the element buffer bound while it is bound
---
DSA is about creating and editing objects. The global render state, the implicit synchronisation and the driver-managed submission stay – those are the differences that pipeline state objects and command buffers address in Vulkan and Direct3D 12.
```

## Additional resources

- [DSA](https://learnopengl.com/Guest-Articles/2021/DSA): learnopengl's guest article this chapter follows.
- [hello_triangle_dsa.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/4.dsa/hello_triangle_dsa.cpp):
  learnopengl's demo, the rectangle with DSA buffers and VAO.

:::opengl
- [glBufferStorage](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferStorage.xhtml): `glNamedBufferStorage`,
  immutable storage and its flags.
- [glVertexAttribFormat](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribFormat.xhtml): the separate
  attribute format, with `glVertexArrayAttribFormat`.
- [glTexStorage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage2D.xhtml): immutable texture
  storage, with `glTextureStorage2D`.
:::
:::vulkan
- [Vertex buffer creation](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation): vulkan-tutorial on
  `vkCreateBuffer`, memory requirements and `vkBindBufferMemory`.
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): the binding and
  attribute descriptions.
:::
:::d3d12
- [ID3D12Device::CreateCommittedResource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12device-createcommittedresource):
  a resource and its memory in one call.
- [D3D12_INPUT_ELEMENT_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_input_element_desc):
  the input layout's elements.
:::
