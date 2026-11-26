# Review: Getting started

Congratulations on reaching the end of the *Getting started* part. By now you can open a window, write shaders,
send vertex data and values to them, and put textures on your objects. That's a lot of new ideas, and a lot of new
names. This page is a
glossary of the most important terms of the part, chapter by chapter – the same kind of review learnopengl.com has
at the end of its first section. Use it to look things up, and as a check: if a definition surprises you, go back to
the chapter it comes from.

The terms outside the boxes are the same in every API. The boxes list how {{api}} names and does things where the
three APIs differ. When you're done, the exam at the end of the part checks what you've learned.

## {{api}} and the window

- **Graphics API**: the interface between your program and the graphics driver: the functions you call to put
  something on the screen. OpenGL, Vulkan and Direct3D 12 are three such APIs; the GPU work behind them is the same.
- **Window**: the operating system owns windows, not the graphics API, so a window is created separately and then
  connected to the API.
- **Render loop**: the loop that keeps the program running until the window is closed: process input, render a
  frame, show it, handle the window's events, again.
- **Double buffering**: the GPU draws into a *back buffer* while the window shows the *front buffer*. When the
  frame is finished the two are swapped, so you never see a half-drawn image.
- **Clear colour**: the colour every pixel of the back buffer gets at the start of a frame, before anything is
  drawn.
- **Viewport**: the rectangle of the window that normalized device coordinates are mapped to, in pixels.

:::opengl
- **OpenGL**: a specification that says what each function must do; the graphics driver implements it. This course
  uses version 3.3.
- **Core profile**: the modern part of OpenGL, without the deprecated *immediate mode* functions.
- **State machine** and **context**: OpenGL is a large collection of state, the *context*. State-setting functions
  such as `glClearColor` change it; state-using functions such as `glClear` act on the current state.
- **Objects**: collections of state (`unsigned int` ids) that you generate, bind to a target, configure, and use.
- **Extensions**: new functionality a driver offers before (or outside) the core specification.
- **GLFW**: a library that creates the window and the OpenGL context, and reports input.
- **GLAD**: a loader that finds the addresses of the OpenGL functions in the driver at run time
  (`gladLoadGLLoader`); without it, calls to `gl…` functions crash.
- **glViewport**: sets the viewport; `framebuffer_size_callback` calls it again when the window is resized.
- **glfwSwapBuffers** shows the finished back buffer, and **glfwPollEvents** handles the window's events.
:::
:::vulkan
- **Vulkan**: an *explicit* API: you create and manage almost everything a driver would do for you in OpenGL –
  memory, synchronisation, the order of work on the GPU.
- **Instance** (`VkInstance`): the connection between your program and the Vulkan library.
- **Validation layers**: optional layers that check every call for mistakes during development and report them
  through the **debug messenger**. Vulkan itself does little error checking.
- **Physical device**: a GPU in the computer; **queue families** are the kinds of queues it offers (graphics,
  presentation, …).
- **Logical device** (`VkDevice`) and **queues**: your connection to the chosen GPU, and the queues you submit work
  to.
- **Window surface** (`VkSurfaceKHR`): connects Vulkan to the GLFW window.
- **Swap chain**: a queue of images that are presented to the window in turn – Vulkan's double buffering. Its
  settings are the surface format, the present mode and the extent.
- **Image view**: describes how an image is accessed (which part, which format); you need one per swap chain image.
- **Render pass**: describes the attachments a frame renders into and what happens to them (clear at the start,
  store at the end); **framebuffers** bind the actual image views to a render pass.
- **Command pool** and **command buffer**: commands are *recorded* into a command buffer and *submitted* to a queue;
  nothing happens on the GPU when you call a `vkCmd…` function.
- **Semaphore**: orders work on the GPU (acquire → render → present) without blocking the CPU.
- **Fence**: lets the CPU wait for the GPU (`vkWaitForFences`), here: until the previous frame has finished.
- **Viewport and scissor**: set while recording (`vkCmdSetViewport`, `vkCmdSetScissor`), because the pipeline
  declares them as *dynamic state*.
:::
:::d3d12
- **Direct3D 12**: an *explicit* API: you create and manage almost everything a driver would do for you in OpenGL –
  memory, resource states, the order of work on the GPU.
- **COM**, **ComPtr** and **HRESULT**: Direct3D objects are COM objects with reference counts; `ComPtr` releases
  them automatically, and every call returns an `HRESULT` that `ThrowIfFailed` checks.
- **Win32 window**: the window is created with the Win32 API (a window class, `CreateWindowW`, a message loop and
  `WindowProc`).
- **DXGI factory** and **adapter**: DXGI enumerates the GPUs (adapters) and creates swap chains.
- **Device** (`ID3D12Device`): creates every other object. The **feature level** is the minimum set of
  capabilities the GPU must support.
- **Debug layer**: enabled before the device is created; it checks every call for mistakes during development.
- **Command queue**, **command allocator** and **command list**: commands are *recorded* into a command list (its
  memory comes from the allocator) and executed when the list is submitted to the queue with
  `ExecuteCommandLists`.
- **Swap chain** and **back buffers**: the buffers that are presented to the window in turn – Direct3D's double
  buffering. `Present` shows the finished one.
- **Descriptor** and **descriptor heap**: a descriptor (here a *render target view*, RTV) describes a resource to
  the GPU; descriptors live in descriptor heaps (here an RTV heap).
- **Resource barrier**: a resource is in a *state*; a transition barrier changes it, for example a back buffer from
  `PRESENT` to `RENDER_TARGET` before drawing and back again before `Present`.
- **Fence**: a 64-bit value the queue sets when it reaches a `Signal`; the CPU waits for it, here until the previous
  frame has finished.
- **Viewport and scissor rectangle**: set on the command list every frame (`RSSetViewports`,
  `RSSetScissorRects`).
:::

## Hello Triangle

- **Graphics pipeline**: the steps that turn 3D coordinates into coloured pixels: vertex shader, primitive
  assembly, rasterization, fragment shader, tests and blending. Some are programmable (the shaders), the others are
  fixed-function and only configurable.
- **Shader**: a small program that runs on the GPU for one stage of the pipeline.
- **Vertex**: a collection of data per corner of a shape – so far a position, later also a colour, texture
  coordinates and a normal. Each kind of data is a **vertex attribute**.
- **Vertex shader**: runs once per vertex and outputs its position in clip space.
- **Normalized device coordinates (NDC)**: the small space in which x and y run from -1 to 1 after the vertex shader;
  everything outside it is clipped. The viewport maps NDC to pixels.
- **Primitive**: the shape the vertices form – here triangles.
- **Rasterization**: finding the pixels a primitive covers and producing a **fragment** for each one.
- **Fragment shader** (in HLSL: **pixel shader**): runs once per fragment and outputs its colour.
- **Vertex buffer**: GPU memory that holds the vertex data.
- **Stride** and **offset**: the number of bytes from one vertex to the next, and where an attribute starts inside a
  vertex.
- **Index buffer** and **indexed drawing**: a list of vertex indices, so that vertices shared by several triangles
  are stored only once (a rectangle: 4 vertices and 6 indices instead of 6 vertices).
- **Wireframe** and **back-face culling**: drawing only the edges of triangles, and skipping triangles whose
  vertices run the other way round on screen.

:::opengl
- **Vertex buffer object (VBO)**: a buffer object bound to `GL_ARRAY_BUFFER`; `glBufferData` copies the vertices into
  it.
- **glVertexAttribPointer**: tells OpenGL how to read one vertex attribute (location, size, type, stride, offset)
  from the VBO currently bound; `glEnableVertexAttribArray` switches the attribute on.
- **Vertex array object (VAO)**: stores the vertex attribute configuration and which buffers it reads – bind the VAO
  and you're ready to draw.
- **Element buffer object (EBO)**: OpenGL's index buffer, bound to `GL_ELEMENT_ARRAY_BUFFER` while the VAO is bound,
  so the VAO remembers it.
- **Shader object** and **shader program**: shaders are compiled at run time (`glCompileShader`) and linked into a
  program (`glLinkProgram`) that `glUseProgram` activates.
- **glDrawArrays** and **glDrawElements**: draw from the vertices directly, or through the indices.
- **glPolygonMode**: `GL_LINE` switches to wireframe mode.
:::
:::vulkan
- **VkBuffer** and **VkDeviceMemory**: a buffer does not allocate its own memory; you allocate memory of a suitable
  type (here host-visible, so the CPU can map and fill it) and bind it to the buffer.
- **Vertex input description**: a **binding description** (which buffer, the stride, per vertex) and one
  **attribute description** per attribute (location, format, offset). They are part of the pipeline.
- **SPIR-V**: the bytecode Vulkan reads. GLSL is compiled to SPIR-V before the program runs (`glslc`) and loaded
  into a **shader module**.
- **Graphics pipeline** (`VkPipeline`): one object with the shaders and *all* the fixed-function settings (vertex
  input, input assembly, rasterizer, multisampling, blending). To change one setting you need another pipeline.
- **Pipeline layout**: what the shaders get from outside besides the vertices (descriptor set layouts, push
  constants).
- **Face culling**: the rasterizer's `cullMode` and `frontFace`; Vulkan's NDC have **y pointing down**.
- **vkCmdBindVertexBuffers**, **vkCmdBindIndexBuffer**, **vkCmdDraw** and **vkCmdDrawIndexed**: recorded into the
  command buffer inside the render pass.
:::
:::d3d12
- **Resource** (`ID3D12Resource`) and **upload heap**: a buffer is a resource; a *committed resource* in an upload
  heap is memory the CPU can write (`Map`) and the GPU can read.
- **Input layout**: one `D3D12_INPUT_ELEMENT_DESC` per attribute: a **semantic** name (`POSITION`, `COLOR`), a
  format and a byte offset. It is part of the pipeline state.
- **Vertex buffer view** and **index buffer view**: where the buffer is, how big it is, and the stride (or the index
  format); set with `IASetVertexBuffers` and `IASetIndexBuffer`.
- **HLSL** and **D3DCompileFromFile**: the shaders are written in HLSL and compiled at run time (targets `vs_5_0`
  and `ps_5_0`) to bytecode.
- **Root signature**: what the shaders get from outside besides the vertices; empty for the first triangle.
- **Pipeline state object (PSO)**: one object with the shaders, the input layout and *all* the fixed-function
  settings (rasterizer, blending, render target format). To change one setting you need another PSO.
- **DrawInstanced** and **DrawIndexedInstanced**: draw from the vertices directly, or through the indices.
:::

## Shaders

- **{{shaderLanguage}}**: the language your shaders are written in, C-like with vector and matrix types.
- **Vectors** and **swizzling**: `vec2`…`vec4` (HLSL: `float2`…`float4`); components can be picked and recombined
  freely, as in `color.rgb` or `pos.xyxx`.
- **Inputs and outputs**: what a shader stage receives and hands on. The vertex shader's inputs come from the
  vertex buffer; its outputs become the fragment shader's inputs.
- **Interpolation**: the rasterizer blends the vertex shader's outputs across the triangle, so a fragment between a
  red and a green vertex gets a mixture of both.
- **Values from the CPU**: values that are the same for every vertex of a draw (a colour, a time, later matrices) –
  OpenGL's *uniforms*.

:::opengl
- **in / out**: an `out` of the vertex shader and an `in` of the fragment shader with the same name and type are
  connected when the program is linked.
- **layout (location = n)**: gives a vertex attribute its location, the first argument of `glVertexAttribPointer`.
- **Uniform**: a global variable of the shader program; it keeps its value until you change it.
  `glGetUniformLocation` finds it, `glUniform…` sets it on the *active* program. An unused uniform is removed by the
  compiler (its location is `-1`).
- **Shader class**: `Shader` (`shader_s.h`) reads the shader files, compiles, links and checks them, with `use()`
  and `setBool/setInt/setFloat`.
:::
:::vulkan
- **in / out**: connected between stages by their **location**, not by their names.
- **Push constants**: a small block of values (at least 128 bytes) recorded straight into the command buffer with
  `vkCmdPushConstants`; the shader declares it with `layout(push_constant)`, the pipeline layout with a
  `VkPushConstantRange`.
- **Uniform buffer**: a buffer the shader reads as a `uniform` block through a descriptor – the general way for
  larger values (see *Coordinate systems*).
- **Shader files**: `shader.vert` and `shader.frag`, compiled to `vert.spv` and `frag.spv`, which
  `readFile` loads.
:::
:::d3d12
- **Semantics**: inputs and outputs are connected by their semantics (`POSITION`, `COLOR`); semantics that begin with
  `SV_` are *system values*, such as `SV_POSITION` (the clip-space position) and `SV_TARGET` (the colour of render
  target 0).
- **cbuffer** and **registers**: the shader reads values from the CPU as a constant buffer at a register: `b` for
  constant buffers, `t` for textures, `s` for samplers.
- **Root constants**: 32-bit values stored in the root signature itself (`InitAsConstants`) and set with
  `SetGraphicsRoot32BitConstants`; the shader sees them as a `cbuffer`.
- **Root descriptors** and **descriptor tables**: the other kinds of root parameter, which refer to resources such as
  constant buffers and textures.
- **Entry points**: `VSMain` and `PSMain` in one file, `shaders.hlsl`.
:::

## Textures

- **Texture**: an image the shaders can read. Its pixels are called **texels**.
- **Texture coordinates**: where on the texture a vertex lies, from 0 to 1 on both axes (*s*/*t* or *u*/*v*); they
  are interpolated for every fragment.
- **Sampling**: reading the texture's colour at a texture coordinate.
- **Wrapping** (address mode): what happens to coordinates outside 0..1: repeat, mirrored repeat, clamp to edge, or
  clamp to a border colour.
- **Filtering**: how a texel is chosen: **nearest** (the closest texel, blocky) or **linear** (a blend of the
  neighbouring texels, smooth). The **magnification** filter is used when the texture is drawn larger than it is,
  the **minification** filter when it is drawn smaller.
- **Mipmaps**: a chain of smaller and smaller copies of a texture, each half the size of the one before, used for
  minified textures to avoid artifacts and save memory bandwidth.
- **Sampler**: the rules for reading a texture (filters, wrapping).
- **stb_image**: the library that loads the image files.
- **mix** (HLSL: **lerp**): blends two values; `mix(a, b, 0.2)` is 80 % of `a` and 20 % of `b`.

:::opengl
- **Texture object**: generated, bound to `GL_TEXTURE_2D`, configured with `glTexParameteri` (wrapping, filtering –
  stored in the texture object) and filled with `glTexImage2D`; `glGenerateMipmap` creates its mipmaps.
- **Flipping the image**: OpenGL expects texture coordinate 0.0 on the y axis at the bottom of the image, while
  images store the top row first; `stbi_set_flip_vertically_on_load(true)` flips them.
- **sampler2D**: the uniform type of a 2D texture in GLSL; `texture(sampler, coords)` samples it.
- **Texture unit**: a slot a texture is bound to (`glActiveTexture(GL_TEXTURE0 + n)`, then `glBindTexture`); a
  sampler uniform is set to the unit's number with `glUniform1i`. At least 16 units are available.
:::
:::vulkan
- **VkImage**: a texture's image, in device-local memory, with its own **mip levels** (one in this course).
- **Staging buffer**: a host-visible buffer the pixels are copied into first; `vkCmdCopyBufferToImage` then copies
  them into the image.
- **Image layout** and **layout transition**: an image is in a layout suited to its use; a pipeline barrier moves it
  from `UNDEFINED` to `TRANSFER_DST_OPTIMAL` (for the copy) and on to `SHADER_READ_ONLY_OPTIMAL` (for sampling).
- **Image view** and **sampler** (`VkSampler`): how the shader sees the image, and how it reads it. A sampler doesn't
  belong to any image, so one sampler can read many.
- **Descriptor**, **descriptor set layout**, **descriptor pool** and **descriptor set**: a descriptor points a shader
  at a resource. The layout says which **bindings** hold which kinds of descriptors (part of the pipeline layout),
  the set is allocated from the pool, written with `vkUpdateDescriptorSets` and bound with
  `vkCmdBindDescriptorSets`.
- **Combined image sampler**: an image view and a sampler in one descriptor; the shader sees a `sampler2D` at
  `layout(binding = n)`.
- **Texture coordinates**: v = 0 is the top row of the image, so the image is not flipped.
:::
:::d3d12
- **Texture resource**: a `TEXTURE2D` resource in a **default heap** (GPU memory), filled from an upload heap with
  `UpdateSubresources`, then moved from `COPY_DEST` to `PIXEL_SHADER_RESOURCE` with a resource barrier.
- **Shader resource view (SRV)**: the descriptor through which a shader reads the texture, in a **shader-visible**
  CBV/SRV/UAV descriptor heap.
- **Descriptor table**: a root parameter that points at a range of descriptors in the heap; its SRVs become the
  registers `t0`, `t1`, …; set with `SetDescriptorHeaps` and `SetGraphicsRootDescriptorTable`.
- **Static sampler**: a sampler described in the root signature itself, at register `s0`; it doesn't belong to any
  texture, so one sampler can read many.
- **Texture2D** and **Sample**: `texture1.Sample(wrapSampler, input.texCoord)` samples a texture in HLSL.
- **Texture coordinates**: v = 0 is the top row of the image, so the image is not flipped.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Show the finished frame | `glfwSwapBuffers` | `vkQueuePresentKHR` | `Present` |
| Vertex format | VAO (`glVertexAttribPointer`) | vertex input description in the pipeline | input layout in the PSO |
| Pipeline settings | state of the context | `VkPipeline` | pipeline state object |
| Small values per draw | uniform | push constant | root constants |
| A texture for the shader | texture unit | descriptor binding | SRV register (`t0`) |
| How a texture is read | texture parameters | `VkSampler` | (static) sampler |
| Waiting for the GPU | (done by the driver) | fence | fence |

That's it for the first part. Everything so far has been flat: a rectangle that stays where its vertices put it. In
*Going 3D* you'll learn the maths behind 3D graphics and use it to move your objects, give the scene perspective and
fly through it with a camera.
