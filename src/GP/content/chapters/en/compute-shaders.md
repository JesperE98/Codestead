# Compute Shaders

Every shader so far had a place in the graphics pipeline: vertex shaders transformed vertices, fragment shaders coloured
the pixels of triangles, and the stages in between – geometry, tessellation – shaped the primitives. The pipeline decided
when each one ran and what it got. But a GPU is, underneath, a machine that runs one small program on thousands of data
items in parallel, and that is useful for far more than triangles: physics, particles, image filters, culling, skinning,
the simulation of fluids or crowds, or the mathematics of machine learning. A **compute shader** gives you that machine
directly: no vertices, no rasterizer, no fragments – just a program, a number of invocations, and the buffers and images
it reads and writes.

This chapter follows learnopengl's guest article *Compute Shaders: Introduction*. Its program is the "hello world" of
compute: a compute shader fills a texture with a colour gradient that moves over time, and an ordinary screen quad shows
the texture. Small as it is, it shows every piece: the compute pipeline, the work groups and their IDs, writing to an
image from a shader, dispatching, and the barrier that makes the drawing wait for the result. All three APIs have compute
shaders; this chapter shows how {{api}} does it.

## The compute stage

A compute shader runs as a grid of **invocations** (Direct3D: *threads*), organised in **work groups** (*thread groups*).
You choose the size of a work group in the shader – here 10 × 10 × 1 = 100 invocations – and the number of work groups
when you start the work, with a **dispatch** – here 80 × 60 × 1 groups. Invocations of one work group run together on the
same part of the GPU and can share fast memory and synchronise with each other; different work groups are independent
and may run in any order, at the same time or one after another.

Every invocation knows where it is through built-in IDs:

| GLSL | HLSL | Meaning |
|---|---|---|
| `gl_WorkGroupSize` | – (the `[numthreads]` values) | the size of a work group |
| `gl_NumWorkGroups` | – | the number of work groups in the dispatch |
| `gl_WorkGroupID` | `SV_GroupID` | which work group this invocation is in |
| `gl_LocalInvocationID` | `SV_GroupThreadID` | its position inside its work group |
| `gl_GlobalInvocationID` | `SV_DispatchThreadID` | its position in the whole dispatch: group ID × group size + local ID |

The program uses the last one: with one invocation per texel, `gl_GlobalInvocationID.xy` (`SV_DispatchThreadID.xy`) *is*
the texel the invocation writes. 80 × 60 groups of 10 × 10 invocations make 800 × 600 invocations – one for every texel
of an 800 × 600 texture. learnopengl's texture is 1000 × 1000, stretched over the window; the course makes it exactly as
large as the window, so that one texel is one pixel.

Why choose the work group size at all, instead of just "one invocation per texel"? Because the hardware works in groups:
a GPU executes invocations in batches of 32 or 64 (*warps*, *wavefronts*), and a work group is split into such batches.
A work group of 100 fills batches of 32 or 64 only partly – 64 or 128 would use them better – but 10 × 10 divides
800 × 600 evenly, and the difference is small for a program this size. Real code picks multiples of 32 or 64, such as
8 × 8 or 16 × 16, and dispatches enough groups to cover the data, rounding up.

```quiz
A compute shader with `local_size_x = 10, local_size_y = 10` is dispatched with 80 × 60 × 1 work groups. Which value does `gl_GlobalInvocationID.xy` have in the invocation with local ID (3, 7) of work group (2, 5)?
- [ ] (5, 12): group ID + local ID
- [ ] (3, 7): the global ID is the local ID
- [ ] (6, 35): group ID × local ID
- [x] (23, 57): group ID × group size + local ID
---
`gl_GlobalInvocationID = gl_WorkGroupID * gl_WorkGroupSize + gl_LocalInvocationID` – in HLSL `SV_DispatchThreadID = SV_GroupID * numthreads + SV_GroupThreadID`. With one invocation per texel it is the texel's coordinate.
```

:::opengl
Compute shaders came with OpenGL **4.3**; learnopengl's program asks for 4.3, and so does this chapter's (shaders
`#version 430 core`). **macOS stops at OpenGL 4.1**, so this chapter's program doesn't run on a Mac – Apple's way to
compute on the GPU is Metal. A compute shader is a program of its own, made of one shader of type `GL_COMPUTE_SHADER`:
learnopengl's `ComputeShader` class in `shader_c.h` compiles one file and links it, like the `Shader` class does with two.
learnopengl names its file `computeShader.cs`; the course uses `.comp`, the usual extension for GLSL compute shaders –
`.cs` means C# to most tools.
:::
:::vulkan
Compute is part of Vulkan from the start: every Vulkan device that can draw has a queue family that supports both graphics
and compute work (vulkan-tutorial's `graphicsAndComputeFamily`, already in the start). A compute shader runs in a
**compute pipeline** – much simpler than a graphics pipeline: one shader stage and a pipeline layout, created with
`vkCreateComputePipelines`.
:::
:::d3d12
Compute is part of every Direct3D 12 device. A compute shader runs with a **compute pipeline state** – much simpler than a
graphics one: a root signature and the compute shader, nothing else – and its own **compute root signature**. The direct
command list that draws can also dispatch compute work; a separate compute queue (as in Microsoft's nBodyGravity sample)
lets compute run alongside drawing, which this program doesn't need.
:::

## The project

The start creates the texture – 800 × 600 texels of four 32-bit floats – fills it from the CPU with dark blue, and draws
it on a screen quad that covers the window: learnopengl's `renderQuad()` with `screenQuad.vs` / `.fs`. The CPU fill is
the course's addition, so that the quad shows something before there is a compute shader; learnopengl creates the
texture without data. The compute shader's file is there, empty. Build and run the program: it shows a dark blue window;
the `// TODO:` comments mark where your code goes.

## Limits

A dispatch can't be arbitrarily large. Three limits matter: the largest number of work groups in each dimension of a
dispatch, the largest work group in each dimension, and the most invocations a work group may have in total. learnopengl
prints them at the start.

:::opengl
The counts and sizes are *indexed* queries – one value per dimension – read with `glGetIntegeri_v`:

```cpp
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT, idx, &max_compute_work_group_count[idx]);
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_SIZE, idx, &max_compute_work_group_size[idx]);
```

for `idx` 0, 1 and 2, and `glGetIntegerv(GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS, &max_compute_work_group_invocations)`.
The OpenGL minimum is 65535 work groups in each dimension, work groups of 1024 × 1024 × 64 and 1024 invocations.
:::
:::vulkan
The limits are part of `VkPhysicalDeviceLimits`: `maxComputeWorkGroupCount[3]`, `maxComputeWorkGroupSize[3]` and
`maxComputeWorkGroupInvocations`, printed by `printComputeLimits()` with learnopengl's texts. Vulkan guarantees at least
65535 work groups per dimension, work groups of 128 × 128 × 64 and 128 invocations – less than OpenGL, because Vulkan also
runs on small mobile GPUs.
:::
:::d3d12
Direct3D 12 doesn't ask the driver: the limits are the same for every device, constants in `d3d12.h` –
`D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION` = 65535, `D3D12_CS_THREAD_GROUP_MAX_X` and `_MAX_Y` = 1024, `_MAX_Z` =
64, and `D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP` = 1024. The task writes them to the debugger's output with
`OutputDebugStringA`, in learnopengl's words.
:::

Your program prints your driver's numbers. Mesa's CPU driver, for example, reports 65535 groups in each dimension, work
groups of 1024 × 1024 × 1024 and 1024 invocations. Desktop GPUs typically report 65535 or 2³¹ − 1 groups in x, work
groups of 1024 × 1024 × 64 and 1024 invocations. Note that the size limits per dimension are *not* the whole story: a
work group of 1024 × 1024 × 1 is within the per-dimension limits but far beyond the 1024 invocations allowed in total.

Now do the first task, **limits**. The window stays dark blue; the numbers appear where your program writes its text:
the console, or for `OutputDebugStringA` the debugger's Output window.

```quiz
Which work group size is allowed on a GPU that reports work groups up to 1024 × 1024 × 64 and 1024 invocations?
- [ ] 1024 × 1024 × 1: each dimension is within its limit
- [x] 32 × 32 × 1: 1024 invocations, within every limit
- [ ] 64 × 64 × 1: 64 is far below 1024
- [ ] 1 × 1 × 128: one invocation per group in x and y
---
The total – the product of the three sizes – must not exceed the invocation limit, and each dimension must stay within its own: 64 × 64 = 4096 is too many, and 128 exceeds the limit of 64 in z.
```

## Writing to an image

A fragment shader writes to its render targets at a fixed place – the pixel it was run for. A compute shader has no such
place; it writes wherever it wants, to buffers or to **images**. An image here is a texture bound for *load and store*:
the shader reads and writes individual texels by integer coordinates – `imageLoad` and `imageStore` in GLSL, indexing a
`RWTexture2D` in HLSL – without filtering, without mipmaps, without a sampler. The same texture can be bound as an image
for the compute shader and as an ordinary sampled texture for the quad.

:::opengl
OpenGL binds images to **image units**, a set of binding points separate from the texture units:

```cpp
    glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F);
```

– image unit 0, the texture, mip level 0, not layered (`GL_FALSE`; the layer argument is then ignored), access read and
write, format `GL_RGBA32F`. The format must match how the shader declares the image, and image load/store works only with
sized formats. The texture itself stays on texture unit 0 for the quad – an image unit is not a texture unit.
:::
:::vulkan
Vulkan has no image units: what a shader can do with an image is decided by the image's **usage** and the **descriptor**
it is bound with. The image gets `VK_IMAGE_USAGE_STORAGE_BIT` next to `SAMPLED_BIT`, and it lives in
**`VK_IMAGE_LAYOUT_GENERAL`**, the one layout in which a shader may both store to it and sample it. The compute shader
sees it through a descriptor set of its own – binding 0, `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE`, stage
`VK_SHADER_STAGE_COMPUTE_BIT`, with `imageLayout = VK_IMAGE_LAYOUT_GENERAL` and no sampler – while the quad's set has the
same image view as a combined image sampler, also in `GENERAL`. Storage use and linear filtering of a 32-bit float format
are optional features of a format in Vulkan; `createTexture()` checks both with `vkGetPhysicalDeviceFormatProperties`.
:::
:::d3d12
Direct3D's image unit is an **unordered access view** (UAV): a view through which a shader reads and writes a resource in
any order. The texture is created with `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS` and gets two views in the
shader-visible heap: the SRV in slot 0 for the quad's `Texture2D tex : register(t0)`, and the UAV in slot 1 for the
compute shader's `RWTexture2D<float4> imgOutput : register(u0)`. The compute shader's root signature has a table with the
UAV.
:::

Now do the second task, **image-unit** (**storage-image** in Vulkan). Nothing changes yet: the texture can be written,
but nothing writes it.

```quiz
The compute shader writes the texture as an image, and the quad reads the same texture through a sampler. Why the two kinds of access?
- [x] Storing addresses single texels by integer coordinates, without filtering; sampling reads filtered values at normalized coordinates – one texture can be bound both ways
- [ ] A texture can be written only once; after that it is read-only and must be sampled
- [ ] Images live in CPU memory, so the quad can't read them directly
- [ ] Only a fragment shader may write to a texture through a sampler
---
`imageStore` / `RWTexture2D` write exact texels, and a shader can write wherever it wants. Sampling adds filtering, mipmaps and wrapping, but can't write. Both are views of the same memory.
```

## The compute shader

The shader is short. It declares the size of its work groups, the image it writes, and in `main` computes one texel's
colour: red rising from 0 at the left edge to 1 at the right, green from 0 in texel row 0 to 1 in the last row. The
width and height are the number of invocations in each dimension – the number of work groups times their size – which
is the texture's size because the dispatch covers it exactly.

:::opengl
```glsl
// a work group is 10 x 10 invocations (one per texel)
layout (local_size_x = 10, local_size_y = 10, local_size_z = 1) in;

// the texture we write to, on image unit 0
layout (rgba32f, binding = 0) uniform image2D imgOutput;
```

and in `main`:

```glsl
    vec4 value = vec4(0.0, 0.0, 0.0, 1.0);
    ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy); // this invocation's texel
```

```glsl
    value.y = float(texelCoord.y) / (gl_NumWorkGroups.y * gl_WorkGroupSize.y);
    imageStore(imgOutput, texelCoord, value);
```

with `value.x = float(texelCoord.x) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` for now. `binding = 0` names the image
unit, `rgba32f` the format the shader reads and writes it in.
:::
:::vulkan
```glsl
// one work group = 10 x 10 invocations (gl_WorkGroupSize); the program dispatches 80 x 60 groups (gl_NumWorkGroups)
layout(local_size_x = 10, local_size_y = 10, local_size_z = 1) in;

// the texture the program also samples, as a storage image: four 32-bit floats per texel
layout(rgba32f, binding = 0) uniform image2D imgOutput;
```

and in `main`:

```glsl
    vec4 value = vec4(0.0, 0.0, 0.0, 1.0);
    ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy);
```

```glsl
    value.y = float(texelCoord.y) / (gl_NumWorkGroups.y * gl_WorkGroupSize.y);
    imageStore(imgOutput, texelCoord, value);
```

with `value.x = float(texelCoord.x) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` for now. `binding = 0` is the storage
image's binding in the compute descriptor set, `rgba32f` the format the shader reads and writes it in.
:::
:::d3d12
```hlsl
[numthreads(10, 10, 1)]
void CSMain(uint3 dispatchThreadID : SV_DispatchThreadID)
{
    float4 value = float4(0.0f, 0.0f, 0.0f, 1.0f);
    // SV_DispatchThreadID: the thread's position among all threads of the dispatch
    // (GLSL's gl_GlobalInvocationID) - here the texel it writes.
    int2 texelCoord = int2(dispatchThreadID.xy);
    // The texture's size: all the threads of the dispatch, one per texel (GLSL's
    // gl_NumWorkGroups * gl_WorkGroupSize - HLSL has no number of thread groups).
    uint imageWidth, imageHeight;
    imgOutput.GetDimensions(imageWidth, imageHeight);
```

then `value.x = float(texelCoord.x) / imageWidth;` for now, `value.y = float(texelCoord.y) / imageHeight;` and

```hlsl
    imgOutput[texelCoord] = value;
```

– writing to a `RWTexture2D` is just an assignment to an element. HLSL has no built-in for the number of thread groups,
so the shader asks the texture for its size, which the dispatch covers exactly.
:::

### Dispatching, and the barrier

Every frame, the program now runs the compute shader before it draws the quad: 80 × 60 work groups, one invocation per
texel. Then comes a step that is easy to forget: a **barrier**. The GPU runs work asynchronously and in parallel, and
caches what it writes; without being told, it may start the quad's fragment shader while the compute shader is still
writing the texture, or read stale data from a cache. In the graphics pipeline, the API inserts such waits for you – a
render target is finished before it is sampled in OpenGL, Vulkan's render passes declare their dependencies, Direct3D 12's
transitions do it. Writes from a compute shader to an image are not covered by that, so the program must say that the
next reads depend on them.

:::opengl
```cpp
        // fill the texture: one invocation per texel, in work groups of 10 x 10
        computeShader.use();
        computeShader.setFloat("t", currentFrame);
        glDispatchCompute((unsigned int)TEXTURE_WIDTH / 10, (unsigned int)TEXTURE_HEIGHT / 10, 1);

        // make sure writing to image has finished before read
        glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
```

(without the `setFloat` line in this task – it comes with the time.) `glMemoryBarrier` names how the written data will be
*read* afterwards: `GL_SHADER_IMAGE_ACCESS_BARRIER_BIT` covers `imageLoad` / `imageStore`. The quad reads the texture by
sampling it, and for sampled reads the specification names `GL_TEXTURE_FETCH_BARRIER_BIT`. learnopengl uses only the
image bit, and the course keeps it; it works on common drivers, but
`GL_SHADER_IMAGE_ACCESS_BARRIER_BIT | GL_TEXTURE_FETCH_BARRIER_BIT` is the careful choice. Since the shader writes every texel, the texture no longer needs data:
create it with `NULL`, as learnopengl does, and delete the program at the end with `glDeleteProgram(computeShader.ID)`.
:::
:::vulkan
`recordCommandBuffer()` records the compute work first, before the render pass:

```cpp
        vkCmdDispatch(commandBuffer, TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1);
```

after binding `computePipeline` and the compute descriptor set at `VK_PIPELINE_BIND_POINT_COMPUTE`. Then an image memory
barrier – from the compute shader's writes to the fragment shader's reads, the layout staying `GENERAL`:

```cpp
        VkImageMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
        barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
        barrier.oldLayout = VK_IMAGE_LAYOUT_GENERAL;
        barrier.newLayout = VK_IMAGE_LAYOUT_GENERAL;
```

```cpp
        vkCmdPipelineBarrier(commandBuffer, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, 0, 0, nullptr, 0, nullptr, 1, &barrier);
```

– learnopengl's `glMemoryBarrier`, but precise: the stages say *who* waits for *whom*, the access masks *what* must be made
visible. Then the render pass draws the quad. vulkan-tutorial's compute chapter submits compute work on its own queue with
a semaphore between the two submissions, so that compute and drawing can overlap; one command buffer with a barrier is the
simple equivalent of learnopengl's program. The compute pipeline (`createComputePipeline()`, vulkan-tutorial's) has its own
layout with the compute descriptor set layout. The image no longer needs data: it goes straight from `UNDEFINED` to
`GENERAL`.
:::
:::d3d12
`PopulateCommandList` records the compute work first – the compute pipeline state and root signature, the UAV table, the
dispatch:

```cpp
    m_commandList->SetPipelineState(m_computePipelineState.Get());
    m_commandList->SetComputeRootSignature(m_computeRootSignature.Get());
    m_commandList->SetComputeRootDescriptorTable(0, CD3DX12_GPU_DESCRIPTOR_HANDLE(m_srvUavHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_srvUavDescriptorSize));    // the UAV, heap slot 1
```

```cpp
    m_commandList->Dispatch(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1);
```

Compute and graphics have separate root signatures and separate calls – `SetComputeRoot…` and `SetGraphicsRoot…`. Then a
**transition barrier**, which both waits for the compute shader and changes the texture's role from UAV to shader resource
– learnopengl's `glMemoryBarrier`:

```cpp
    CD3DX12_RESOURCE_BARRIER textureBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture.Get(), D3D12_RESOURCE_STATE_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &textureBarrier);
```

Then the graphics pipeline state and root signature draw the quad, and at the end of the frame a barrier turns the texture
back into `UNORDERED_ACCESS` for the next dispatch. (Two compute passes that write and read the same UAV, without changing
its state, would use a **UAV barrier** – `CD3DX12_RESOURCE_BARRIER::UAV` – instead.) The compute pipeline state needs only
the root signature and the shader: `D3D12_COMPUTE_PIPELINE_STATE_DESC` with `CS` compiled from `CSMain` as `cs_5_0`,
created with `CreateComputePipelineState`. The texture no longer needs data: it starts in `UNORDERED_ACCESS`.
:::

Which way up does the picture come out? The compute shader writes texel row 0 with green 0. OpenGL's quad has texture
coordinate v = 0 at the bottom of the window, and v = 0 is texture row 0, so green starts at the bottom.
:::vulkan
Vulkan's y in normalized device coordinates points down, so the course's quad puts v = 0 on the vertices at y = +1 – the
bottom of the window – and v = 1 at the top: row 0 at the bottom, as in OpenGL.
:::
:::d3d12
The quad keeps learnopengl's texture coordinates – v = 1 at the top, v = 0 at the bottom – and Direct3D's v = 0 is row 0
too, so row 0 lands at the bottom, as in OpenGL. (The flipped v the course uses for image files isn't wanted here: this
texture is not an image file, and the shader decides what row 0 is.)
:::
Window pixel (x, y) shows texel (x, 599 − y) in every API.

Now do the third task, **compute-shader**. Build and run: a red-green gradient – black at the bottom left, red to the
right, green to the top, yellow at the top right – computed by 480,000 invocations.

```quiz
What can happen if the barrier after the dispatch is left out?
- [ ] Nothing: commands on the GPU always finish in the order they were recorded
- [ ] The dispatch is skipped, because the texture is still bound to the quad
- [x] The quad's fragment shader may read the texture while the compute shader is still writing it, or read stale cached data – the picture can be partly old or wrong
- [ ] The compiler rejects the compute shader
---
GPUs overlap work and cache writes. The barrier tells the driver that the next reads depend on the compute shader's writes: wait for them and make them visible.
```

## Animation

learnopengl moves the red ramp over time: the shader gets the time `t` in seconds, adds `t · speed` to the texel's x,
and wraps the sum at the texture's width with `mod`, so the ramp scrolls to the right at 100 texels per second and starts
again from the left. learnopengl wraps at 1000, its texture's width; the course's is 800.

:::opengl
```glsl
layout (location = 0) uniform float t; // time
```

```glsl
    value.x = mod(float(texelCoord.x) + t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);
```

with `float speed = 100;` and `float width = 800;`, and in the loop `computeShader.setFloat("t", currentFrame);` after
`computeShader.use()` – a uniform of the compute program, set like any other.
:::
:::vulkan
The time becomes a push constant of the compute pipeline – `layout(push_constant) uniform PushConstants { float t; } pc;`
in the shader, `struct PushConstants { float t; }` in C++, a push constant range for `VK_SHADER_STAGE_COMPUTE_BIT` in
`computePipelineLayout` – pushed after binding the compute pipeline with `vkCmdPushConstants(commandBuffer,
computePipelineLayout, VK_SHADER_STAGE_COMPUTE_BIT, …)`. The shader's line:

```glsl
    value.x = mod(float(texelCoord.x) + pc.t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);
```
:::
:::d3d12
The time becomes a root constant – `cbuffer TimeConstants : register(b0) { float t; };` in HLSL, root parameter 1 of the
compute root signature, set with `SetComputeRoot32BitConstants(1, sizeof(TimeConstants) / 4, &timeConstants, 0)` before
the dispatch – and the shader's line uses `fmod`, HLSL's `mod` (the same for positive numbers):

```hlsl
    value.x = fmod(float(texelCoord.x) + t * speed, width) / imageWidth;
```
:::

Now do the last task, **time**. Build and run: the red ramp scrolls to the right and wraps around. At 1.0 s it has moved
100 texels: the brightest red is at x = 699, and the ramp starts again from black at x = 700.

```quiz
At t = 1.0 s, what is the red value of texel x = 700, with speed 100 and width 800?
- [ ] 1.0: it is the brightest texel
- [x] 0.0: mod(700 + 100, 800) = 0 – the ramp has wrapped around
- [ ] 0.875: 700 / 800
- [ ] 1.0, clamped from 800 / 800
---
x = 699 gives mod(799, 800) / 800 ≈ 1.0, x = 700 gives 0. Over time the wrap point moves right with the ramp, 100 texels per second.
```

## Going further

This program writes a texture that a fragment shader could just as well have drawn. Compute shaders shine where the work
doesn't fit the shape of the graphics pipeline:

- **Shared memory.** Invocations of a work group can share fast on-chip memory (`shared` in GLSL, `groupshared` in HLSL)
  and synchronise with `barrier()` / `GroupMemoryBarrierWithGroupSync()`. A blur loads a tile of the image once into
  shared memory and lets every invocation read its neighbours from there – the trick behind fast bloom and post-processing
  filters.
- **Particles and simulation.** Positions and velocities in a storage buffer, updated by a compute shader every frame and
  drawn as instances – no round trip to the CPU.
- **Culling and indirect drawing.** A compute shader tests thousands of objects against the frustum and writes the draw
  commands for the visible ones into a buffer that an indirect draw consumes.
- **Skinning, lighting, post-processing.** Skinning meshes once per frame, binning lights into tiles for tiled or clustered
  shading, tone mapping and other screen-space effects.

## Additional resources

- [Compute Shaders: Introduction](https://learnopengl.com/Guest-Articles/2022/Compute-Shaders/Introduction):
  learnopengl's guest article this chapter follows.
- [compute_shader_hello_world.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/5.computeshader_helloworld/compute_shader_hello_world.cpp):
  learnopengl's program.

:::opengl
- [Compute Shader (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Compute_Shader): work groups, the built-in IDs, shared
  memory and the limits.
- [glMemoryBarrier](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMemoryBarrier.xhtml): which barrier bit
  belongs to which kind of read.
:::
:::vulkan
- [Compute Shader](https://vulkan-tutorial.com/Compute_Shader): vulkan-tutorial's chapter on compute pipelines, storage
  buffers and images, and synchronisation.
- [vkCmdPipelineBarrier](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdPipelineBarrier.html): stages,
  access masks and image memory barriers.
:::
:::d3d12
- [Compute Shader Overview](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-compute-shader):
  thread groups and the system values.
- [Using resource barriers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  transition and UAV barriers.
:::
