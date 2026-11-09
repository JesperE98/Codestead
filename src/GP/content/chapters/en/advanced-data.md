# Advanced Data

Throughout most chapters we've been extensively using buffers to store data on the GPU. In this chapter we'll briefly
discuss a few alternative approaches to managing buffers: filling a buffer in parts, writing into it through a
pointer, storing the vertex attributes in blocks instead of interleaved, and copying one buffer into another.

:::opengl
A buffer in OpenGL is, at its core, an object that manages a certain piece of GPU memory and nothing more. We give
meaning to a buffer when binding it to a specific *buffer target*. A buffer is only a vertex array buffer when we bind
it to `GL_ARRAY_BUFFER`, but we could just as easily bind it to `GL_ELEMENT_ARRAY_BUFFER`. OpenGL internally stores a
reference to the buffer per target and, based on the target, processes the buffer differently.
:::
:::vulkan
A buffer in Vulkan is, at its core, a `VkBuffer` – a description of a range of bytes and what it may be used for (its
usage flags: vertex buffer, uniform buffer, transfer source …) – bound to a `VkDeviceMemory` allocation that holds the
bytes. The memory type you allocate from decides who can reach the bytes: *host-visible* memory can be mapped and
written by the CPU, *device-local* memory is the fastest for the GPU but usually out of the CPU's reach.
:::
:::d3d12
A buffer in Direct3D 12 is an `ID3D12Resource` with a buffer description, created in a *heap*. The heap type decides
who can reach the bytes: an *upload* heap (`D3D12_HEAP_TYPE_UPLOAD`) can be mapped and written by the CPU and read by
the GPU, a *default* heap (`D3D12_HEAP_TYPE_DEFAULT`) is memory only the GPU uses – the fastest for the GPU to read,
but the CPU can't write it. What the buffer *is* (vertex buffer, constant buffer …) is decided by the views you make of
it: a vertex buffer view, a constant buffer view.
:::

learnopengl.com's chapter has no demo program of its own, so this chapter's project is once more the *Depth testing*
scene – the two marble cubes, the metal floor, the camera at (0, 0, 3) – and every task changes *how* the vertex data
gets into the buffers, not *what* is drawn. **After every task the picture is exactly the same.** That is the point:
the tasks check your code, and the unchanged picture proves the data arrived where the GPU expects it.

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## Filling buffers

:::opengl
So far we've been filling the buffer's memory by calling `glBufferData`, which allocates a piece of GPU memory and
adds data into this memory. If we were to pass `NULL` as its data argument, the function would only allocate memory
and not fill it. This is useful if we first want to *reserve* a specific amount of memory and later come back to this
buffer.

Instead of filling the entire buffer with one function call we can also fill specific regions of the buffer by
calling `glBufferSubData`. This function expects a buffer target, an offset, the size of the data and the actual data
as its arguments. What's new with this function is that we can now give an offset that specifies from *where* we want
to fill the buffer. This allows us to insert/update only certain parts of the buffer's memory. Do note that the buffer
should have enough allocated memory, so a call to `glBufferData` is necessary before calling `glBufferSubData` on the
buffer.

Now do the first task, **buffer-sub-data**: at the TODO in the cube's VAO block, reserve the memory first and fill it
in a second step:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), NULL, GL_STATIC_DRAW); // only make room: no data yet
    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubeVertices), &cubeVertices);  // fill the buffer from byte 0 on
```

Here the range is the whole buffer, from byte 0 to `sizeof(cubeVertices)`, so the result is the same as before. But
with an offset you could, for instance, replace only the texture coordinates of one face later on.

Yet another method for getting data into a buffer is to ask for a pointer to the buffer's memory and directly copy the
data in memory yourself. By calling `glMapBuffer` OpenGL returns a pointer to the currently bound buffer's memory for
us to operate on:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW); // only make room
    void *ptr = glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY); // a pointer to the buffer's memory
    memcpy(ptr, planeVertices, sizeof(planeVertices));    // copy the vertices into it
    glUnmapBuffer(GL_ARRAY_BUFFER);                        // done: the pointer is no longer valid
```

By telling OpenGL we're finished with the pointer operations via `glUnmapBuffer`, OpenGL knows we're done. By
unmapping, the pointer becomes invalid; the function returns `GL_TRUE`, or `GL_FALSE` in the rare case that the
buffer's contents got corrupted while it was mapped. The second argument of `glMapBuffer`, `GL_WRITE_ONLY`, promises that we only write through
the pointer and never read.

Using `glMapBuffer` is useful for directly mapping data to a buffer, without first storing it in temporary memory.
Think of directly reading data from file and copying it into the buffer's memory.

Now do the task **map-buffer**: fill the floor's buffer this way, at the TODO in the plane's VAO block. `memcpy` needs
`#include <cstring>` at the top of `main.cpp`.
:::
:::vulkan
OpenGL fills a buffer with `glBufferData` (allocate and fill), `glBufferSubData` (fill a part) or `glMapBuffer` (get a
pointer and write through it). Vulkan has no call that takes your data and puts it in a buffer behind the scenes;
what it has is the third way – a pointer – plus a command for small updates.

Our vertex buffer lives in host-visible, host-coherent memory, and `createVertexBuffer()` fills it like
vulkan-tutorial's *Vertex buffer creation* chapter: `vkMapMemory` maps the memory, `memcpy` copies all 42 vertices,
`vkUnmapMemory` ends the mapping. But `vkMapMemory` takes an offset and a size – it maps only the bytes from `offset`
to `offset + size`, and the pointer it returns points at the first of them. Mapping a range and copying right away is
Vulkan's `glBufferSubData`; mapping and writing through the pointer is `glMapBuffer`.

Now do the first task, **map-memory**: copy the vertices part by part – first the cube's range, then the floor's:

```cpp
        // part by part: vkMapMemory maps only the bytes from offset to offset + size (glBufferSubData / glMapBuffer in
        // OpenGL); the pointer it returns points at the first of them
        VkDeviceSize cubeSize = sizeof(Vertex) * 36;  // vertices 0..35
        VkDeviceSize floorSize = sizeof(Vertex) * 6;  // vertices 36..41, right after the cube's
        void* data;
        vkMapMemory(device, vertexBufferMemory, 0, cubeSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) cubeSize);
        vkUnmapMemory(device, vertexBufferMemory);

        vkMapMemory(device, vertexBufferMemory, cubeSize, floorSize, 0, &data);
            memcpy(data, vertices.data() + 36, (size_t) floorSize);
        vkUnmapMemory(device, vertexBufferMemory);
```

Two rules apply. A memory object may be mapped only once at a time, so you unmap before you map the next range. And
because the memory is `VK_MEMORY_PROPERTY_HOST_COHERENT_BIT`, what you write through the pointer becomes visible to
the GPU without an explicit `vkFlushMappedMemoryRanges`.

The uniform buffer uses the same mechanism differently: it stays mapped while the program runs ("persistent
mapping"), and `updateUniformBuffer()` copies the view and projection into it every frame. That's fine because
`drawFrame()` waits for the fence first, so the GPU isn't reading the buffer while the CPU writes it.

For small data that changes every frame Vulkan has a second way, closer to `glBufferSubData` than mapping is:
`vkCmdUpdateBuffer`. It is a *command*: when you record it, it copies your data into the command buffer, and the GPU
writes the data into the buffer when it runs the commands. It's meant for small updates – at most 65536 bytes, a
multiple of 4 – and it isn't allowed inside a render pass. The buffer needs `VK_BUFFER_USAGE_TRANSFER_DST_BIT`, and
since the CPU never maps it, it can live in device-local memory.

Now do the task **update-buffer**: create the uniform buffer as a transfer destination in device-local memory (and
drop the mapping and `uniformBufferMapped`), let `updateUniformBuffer` take the command buffer and record the update,
and call it from `recordCommandBuffer()` right after `vkBeginCommandBuffer`, before the render pass. `drawFrame()` no
longer calls it.

```cpp
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, uniformBuffer, uniformBufferMemory);
```

```cpp
        vkCmdUpdateBuffer(commandBuffer, uniformBuffer, 0, sizeof(ubo), &ubo);

        // a barrier: the vertex shaders read the uniform buffer only after the write has finished
        VkBufferMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
        barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_UNIFORM_READ_BIT;
        barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.buffer = uniformBuffer;
        barrier.offset = 0;
        barrier.size = sizeof(ubo);

        vkCmdPipelineBarrier(
            commandBuffer,
            VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_VERTEX_SHADER_BIT,
            0,
            0, nullptr,
            1, &barrier,
            0, nullptr
        );
```

The update is a transfer operation. Without the barrier the GPU could start the vertex shaders of the draws while the
write is still going on; the barrier says: everything in the vertex shader stage that reads uniforms waits for the
transfer writes before it. `sizeof(ubo)` is two `glm::mat4`, 128 bytes – well within the limit.
:::
:::d3d12
OpenGL fills a buffer with `glBufferData` (allocate and fill), `glBufferSubData` (fill a part) or `glMapBuffer` (get a
pointer and write through it). Direct3D 12 has no call that takes your data and puts it in a buffer behind the scenes;
what it has is the pointer: `Map` returns a CPU pointer to the memory of a buffer in an upload heap, and `Unmap` ends
it. Writing through the pointer is OpenGL's `glMapBuffer`; copying a block to an offset of the pointer is
`glBufferSubData`. (For data that changes per draw there are also root constants, `SetGraphicsRoot32BitConstants`,
which the project already uses for the model matrix: they travel inside the command list itself.)

Right now one upload-heap vertex buffer holds everything: the cube is vertices 0 to 35, the floor 36 to 41. learnopengl
gives the floor a buffer of its own, `planeVBO`. Now do the first task, **map-buffer**: move the floor's six vertices
out of `vertices` into a `Vertex planeVertices[]` of their own and give them their own buffer, `m_floorVertexBuffer`,
filled through the pointer:

```cpp
        // Map gives a CPU pointer to the buffer's memory (learnopengl: glMapBuffer). The read
        // range (0, 0) says that the CPU reads nothing from it.
        UINT8* pPlaneDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);
        ThrowIfFailed(m_floorVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pPlaneDataBegin)));
        // Write through the pointer: copy the vertices in.
        memcpy(pPlaneDataBegin, planeVertices, sizeof(planeVertices));
        // Done: Unmap (learnopengl: glUnmapBuffer); the pointer is no longer valid. The written
        // range tells the driver which bytes the CPU changed: all of them.
        CD3DX12_RANGE writtenRange(0, sizeof(planeVertices));
        m_floorVertexBuffer->Unmap(0, &writtenRange);
```

The first argument of both is the subresource – a buffer has only one, 0. The two ranges are hints: the read range
says which bytes the CPU will read (none: `(0, 0)`; `nullptr` would mean all of them), the written range which bytes
it changed (`nullptr` would mean all of them). Upload-heap memory is usually write-combined: fast to write in order,
very slow to read, so telling the driver you won't read matters. The buffer is created like the cube's – an upload
heap, `CD3DX12_RESOURCE_DESC::Buffer(planeVertexBufferSize)`, the state `D3D12_RESOURCE_STATE_GENERIC_READ` – and gets a
vertex buffer view of its own, `m_floorVertexBufferView` (stride `sizeof(Vertex)`).

In `PopulateCommandList` the floor now binds its own view before its draw, and its vertices start at 0:

```cpp
    // floor: its own vertex buffer, the metal texture, no model transformation, its 6 vertices
    m_commandList->IASetVertexBuffers(0, 1, &m_floorVertexBufferView);
```

with `m_commandList->DrawInstanced(6, 1, 0, 0);` instead of `DrawInstanced(6, 1, 36, 0)`.

Like the constant buffer, an upload-heap buffer may also stay mapped for its whole life ("Keeping things mapped for the
lifetime of the resource is okay", as the samples' comment says). What you must never do is change bytes the GPU is
still reading – the constant buffer is written in `OnUpdate` only after `OnRender` has waited for the previous frame.
:::

:::opengl
```quiz
What does `glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW)` do?
- [ ] It deletes the buffer's contents and frees its memory
- [x] It allocates `sizeof(planeVertices)` bytes for the bound buffer without filling them
- [ ] It fills the buffer with zeros, so `glBufferSubData` isn't needed any more
- [ ] Nothing: OpenGL ignores a call with `NULL` data
---
With `NULL` as data the buffer only gets its memory. `glBufferSubData` or `glMapBuffer` then fill it – and both need that memory to exist first.
```
:::
:::vulkan
```quiz
Why does `recordCommandBuffer()` call `updateUniformBuffer(commandBuffer)` before `vkCmdBeginRenderPass`?
- [ ] Because the uniform buffer must be updated before the swap chain image is acquired
- [ ] Because `vkCmdUpdateBuffer` only works on host-visible memory
- [ ] Because a barrier can only be recorded at the very start of a command buffer
- [x] Because `vkCmdUpdateBuffer` is a transfer command and isn't allowed inside a render pass
---
Transfer commands like `vkCmdUpdateBuffer` and `vkCmdCopyBuffer` must be recorded outside a render pass. The barrier after it then makes the vertex shaders wait until the write has finished.
```
:::
:::d3d12
```quiz
What does the read range `CD3DX12_RANGE readRange(0, 0)` passed to `Map` tell the driver?
- [ ] That only byte 0 of the buffer will be written
- [ ] That the buffer is unmapped right away
- [ ] That the GPU may not read the buffer while it is mapped
- [x] That the CPU will read none of the buffer's bytes through the pointer
---
An empty read range is a promise not to read. Upload-heap memory is typically write-combined – fast to write, slow to read back – so the driver needn't prepare it for reading. `nullptr` would mean the CPU may read everything.
```
:::

## Batching vertex attributes

:::opengl
Using `glVertexAttribPointer` we were able to specify the attribute layout of the vertex array buffer's content.
:::
:::vulkan
Using the vertex input binding and attribute descriptions we were able to specify the layout of the vertex buffer's
content.
:::
:::d3d12
Using the input layout (`D3D12_INPUT_ELEMENT_DESC`) and the vertex buffer view we were able to specify the layout of
the vertex buffer's content.
:::

Within the vertex buffer we *interleaved* the attributes; that is, we placed the position and texture coordinates of
each vertex next to each other in memory. Now that we know a bit more about buffers we can take a different approach.

What we could also do is batch all the vector data into large chunks per attribute type instead of interleaving them.
Instead of an interleaved layout 123123123123 we take a batched approach 111122223333.

When loading vertex data from file you generally retrieve an array of positions, an array of normals and/or an array
of texture coordinates. It may cost some effort to combine these arrays into one large array of interleaved data.
Taking the batching approach is then an easier solution that we can easily implement by putting each array into the
buffer one after another.

:::opengl
Using `glBufferSubData` this is straightforward: one call per array, each at the offset where the previous one ends.
The cube's data gets two arrays, `cubePositions` (36 × 3 floats) and `cubeTexCoords` (36 × 2 floats), instead of
`cubeVertices`:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubePositions) + sizeof(cubeTexCoords), NULL, GL_STATIC_DRAW);
    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubePositions), &cubePositions);                      // positions at the start
    glBufferSubData(GL_ARRAY_BUFFER, sizeof(cubePositions), sizeof(cubeTexCoords), &cubeTexCoords); // texture coordinates after them
```

This way we can directly transfer the attribute arrays as a whole into the buffer without first having to process
them. We could have also combined them in one large array and fill the buffer right away using `glBufferData`, but
using `glBufferSubData` lends itself perfectly for tasks like these.

We'll also have to update the vertex attribute pointers to reflect these changes:

```cpp
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);                     // tightly packed positions
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)(sizeof(cubePositions))); // the second block
```

Note that the stride parameter is equal to the size of the vertex attribute, since the next vertex attribute vector
can be found directly after its 3 (or 2) components. The last argument, the offset, is now where the attribute's
block starts in the buffer.
:::
:::vulkan
In Vulkan a *binding* steps through its data with one stride. An interleaved buffer needs one binding (stride
`sizeof(Vertex)`, 20 bytes) whose attributes sit at different offsets *within* a vertex. A batched buffer has two blocks
with two different strides – 12 bytes per position, 8 per texture coordinate – so each block needs a binding of its
own. Both bindings can read from the same `VkBuffer`; `vkCmdBindVertexBuffers` gives each binding the offset at which
its block starts – OpenGL's `(void*)(sizeof(cubePositions))` in `glVertexAttribPointer`.

Now do the task **batched-attributes**. In `createVertexBuffer()` split `vertices` into the two blocks, make the buffer
`positionsSize + texCoordsSize` bytes and copy each block into its own mapped range:

```cpp
        // batched: the positions of all the vertices first, then all their texture coordinates
        std::vector<glm::vec3> positions;
        std::vector<glm::vec2> texCoords;
        for (const Vertex& vertex : vertices) {
            positions.push_back(vertex.pos);
            texCoords.push_back(vertex.texCoord);
        }
        VkDeviceSize positionsSize = sizeof(positions[0]) * positions.size();
        VkDeviceSize texCoordsSize = sizeof(texCoords[0]) * texCoords.size();
```

```cpp
        void* data;
        vkMapMemory(device, vertexBufferMemory, 0, positionsSize, 0, &data);
            memcpy(data, positions.data(), (size_t) positionsSize);
        vkUnmapMemory(device, vertexBufferMemory);

        vkMapMemory(device, vertexBufferMemory, positionsSize, texCoordsSize, 0, &data);
            memcpy(data, texCoords.data(), (size_t) texCoordsSize);
        vkUnmapMemory(device, vertexBufferMemory);
```

Then describe the two bindings – `getBindingDescription()` becomes `getBindingDescriptions()`:

```cpp
    static std::array<VkVertexInputBindingDescription, 2> getBindingDescriptions() {
        std::array<VkVertexInputBindingDescription, 2> bindingDescriptions{};

        bindingDescriptions[0].binding = 0;
        bindingDescriptions[0].stride = sizeof(glm::vec3);
        bindingDescriptions[0].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::vec2);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescriptions;
    }
```

Attribute 0 (the position) reads binding 0, attribute 1 (the texture coordinates) binding 1, both at offset 0 – a
vertex's 12 (or 8) bytes in its block hold nothing but that attribute. `createPipeline()` passes both bindings
(`vertexBindingDescriptionCount = static_cast<uint32_t>(bindingDescriptions.size())`,
`pVertexBindingDescriptions = bindingDescriptions.data()`). Finally `recordCommandBuffer()` binds the same buffer
twice:

```cpp
        // the same buffer for both bindings: binding 0 reads from its start (the positions), binding 1 from the
        // texture coordinates block after the positions
        VkBuffer vertexBuffers[] = {vertexBuffer, vertexBuffer};
        VkDeviceSize offsets[] = {0, sizeof(glm::vec3) * vertices.size()};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets);
```

The second offset is 12 × 42 = 504 bytes. The floor's draw, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`, still works
unchanged: vertex 36 is read from byte 36 × 12 of binding 0 and byte 36 × 8 of binding 1 – each binding multiplies the
vertex index by its own stride.
:::
:::d3d12
In Direct3D 12 the input assembler reads each *input slot* from one vertex buffer view with one stride. An interleaved
buffer needs one slot (stride `sizeof(Vertex)`, 20 bytes) whose elements sit at different byte offsets *within* a
vertex. A batched buffer has two blocks with two different strides – 12 bytes per position, 8 per texture coordinate –
so each block needs a slot of its own, with its own view. Both views can point into the same buffer; the second one
simply starts where the texture coordinates start – OpenGL's `(void*)(sizeof(cubePositions))` in
`glVertexAttribPointer`.

Now do the task **batched-attributes**. The cube's data becomes two arrays, `XMFLOAT3 cubePositions[]` and
`XMFLOAT2 cubeTexCoords[]` (36 each), and the buffer holds them one after the other:

```cpp
        const UINT vertexBufferSize = sizeof(cubePositions) + sizeof(cubeTexCoords);
```

```cpp
        // The two blocks one after the other: the positions at the start, the texture
        // coordinates right after them (learnopengl: two glBufferSubData calls).
        memcpy(pVertexDataBegin, cubePositions, sizeof(cubePositions));
        memcpy(pVertexDataBegin + sizeof(cubePositions), cubeTexCoords, sizeof(cubeTexCoords));
```

The input layout reads `TEXCOORD` from input slot 1 – the fourth value of its element:

```cpp
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

and the single view becomes an array of two, `D3D12_VERTEX_BUFFER_VIEW m_vertexBufferViews[2]`:

```cpp
        m_vertexBufferViews[0].BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferViews[0].StrideInBytes = sizeof(XMFLOAT3);
        m_vertexBufferViews[0].SizeInBytes = sizeof(cubePositions);
        m_vertexBufferViews[1].BufferLocation = m_vertexBuffer->GetGPUVirtualAddress() + sizeof(cubePositions);
        m_vertexBufferViews[1].StrideInBytes = sizeof(XMFLOAT2);
        m_vertexBufferViews[1].SizeInBytes = sizeof(cubeTexCoords);
```

`IASetVertexBuffers(0, 2, m_vertexBufferViews)` binds both, to slots 0 and 1.

The input layout is part of the PSO, so the floor – drawn with the same PSO – must also deliver its texture
coordinates through slot 1. Its vertices stay interleaved, and that works too: two views into the floor's buffer,
`m_floorVertexBufferViews[2]`, both with the stride `sizeof(Vertex)`; the second one starts `sizeof(XMFLOAT3)` bytes in,
at the first texture coordinates:

```cpp
        m_floorVertexBufferViews[0].BufferLocation = m_floorVertexBuffer->GetGPUVirtualAddress();
        m_floorVertexBufferViews[0].StrideInBytes = sizeof(Vertex);
        m_floorVertexBufferViews[0].SizeInBytes = planeVertexBufferSize;
        m_floorVertexBufferViews[1].BufferLocation = m_floorVertexBuffer->GetGPUVirtualAddress() + sizeof(XMFLOAT3);
        m_floorVertexBufferViews[1].StrideInBytes = sizeof(Vertex);
        m_floorVertexBufferViews[1].SizeInBytes = planeVertexBufferSize - sizeof(XMFLOAT3);
```

and its draw binds them with `IASetVertexBuffers(0, 2, m_floorVertexBufferViews)`.
:::

Press **Build & run**: the marble on the cubes is exactly the same. Which approach is better? Neither is wrong for
{{api}}; the interleaved approach is still the most common one, since the vertex attributes for each vertex shader run
are then closely aligned in memory.

```quiz
You batch the 36 positions (3 floats each) of a cube and then its 36 texture coordinates (2 floats each) into one buffer. A float is 4 bytes. At which byte does the block of texture coordinates start?
- [ ] 12
- [ ] 20
- [x] 432
- [ ] 720
---
The positions come first: 36 × 3 × 4 = 432 bytes. The texture coordinates start right after them, and that offset is what the second attribute's pointer, binding or view needs.
```

:::opengl
```quiz
After batching, why is the stride of the texture coordinate attribute `2 * sizeof(float)` and not `5 * sizeof(float)`?
- [x] In the second block the next vertex's texture coordinates follow directly after the current ones
- [ ] Because the stride is always the size of the attribute itself
- [ ] Because the stride counts from the end of the positions block
- [ ] Because OpenGL ignores the stride when the offset isn't 0
---
The stride is the distance between one vertex's attribute and the next vertex's. Interleaved, a position and texture coordinates (5 floats) sat in between; batched, the texture coordinates are tightly packed, 2 floats apart.
```
:::
:::vulkan
```quiz
Why does the batched vertex buffer need two vertex input bindings instead of one?
- [ ] Because one `VkBuffer` can only be bound to one binding at a time
- [x] Because a binding has one stride, and the two blocks need different strides (12 and 8 bytes)
- [ ] Because attributes at an offset other than 0 aren't allowed
- [ ] Because the vertex shader can only read one attribute per binding
---
Within one binding every vertex is `stride` bytes after the previous one. The positions are 12 bytes apart and the texture coordinates 8, so each block gets a binding with its own stride – and its own offset from `vkCmdBindVertexBuffers`.
```
:::
:::d3d12
```quiz
Why does the batched cube need two input slots, each with its own vertex buffer view?
- [ ] Because a buffer can only have one vertex buffer view
- [ ] Because `TEXCOORD` must always come from slot 1
- [x] Because a view has one stride, and the two blocks need different strides (12 and 8 bytes)
- [ ] Because `IASetVertexBuffers` can only bind one view per call
---
In one slot every vertex is `StrideInBytes` after the previous one. The positions are 12 bytes apart and the texture coordinates 8, so each block gets its own view (with its own start address and stride) in its own slot.
```
:::

## Copying buffers

Once your buffers are filled with data you may want to share that data with other buffers or perhaps copy the
buffer's content into another buffer.

:::opengl
The function `glCopyBufferSubData` allows us to copy the data from one buffer to another buffer with relative ease.
The function's prototype is as follows:

```cpp
void glCopyBufferSubData(GLenum readtarget, GLenum writetarget, GLintptr readoffset,
                         GLintptr writeoffset, GLsizeiptr size);
```

The `readtarget` and `writetarget` parameters expect to give the buffer targets that we want to copy from and to. We
could for example copy from a `GL_ARRAY_BUFFER` buffer to a `GL_ELEMENT_ARRAY_BUFFER` buffer by specifying
those buffer targets as the read and write targets respectively. The buffers currently bound to those buffer targets
will then be affected.

But what if we wanted to read and write data into two different buffers that are both vertex array buffers? We can't
bind two buffers at the same time to the same buffer target. For this reason, and this reason alone, OpenGL gives us
two more buffer targets called `GL_COPY_READ_BUFFER` and `GL_COPY_WRITE_BUFFER`. We then bind the buffers of our
choice to these new buffer targets and set those targets as the `readtarget` and `writetarget` argument.

`glCopyBufferSubData` then reads data of a given `size` from a given `readoffset` and writes it into the
`writetarget` buffer at `writeoffset`. The copy happens on the GPU: the data never comes back to your program's
memory.

Now do the last task, **copy-buffer**: copy the floor's vertices into a second buffer, `planeCopyVBO`, and let the
floor's VAO read its attributes from the copy:

```cpp
    // copy the vertices into a second buffer (GPU to GPU) and let the VAO read from the copy
    unsigned int planeCopyVBO;
    glGenBuffers(1, &planeCopyVBO);
    glBindBuffer(GL_COPY_WRITE_BUFFER, planeCopyVBO);
    glBufferData(GL_COPY_WRITE_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW);
    glBindBuffer(GL_COPY_READ_BUFFER, planeVBO);
    glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER, 0, 0, sizeof(planeVertices)); // read offset, write offset, size
    glBindBuffer(GL_ARRAY_BUFFER, planeCopyVBO); // the attribute pointers below take the buffer bound to GL_ARRAY_BUFFER
```

The new buffer first needs its memory (`glBufferData` with `NULL`), just like before `glBufferSubData`. And note the
last line: `glVertexAttribPointer` stores the buffer that is bound to `GL_ARRAY_BUFFER` at the time of the call, so
binding the copy there makes the VAO read from it. We could also have bound one of the two buffers to
`GL_ARRAY_BUFFER` and used that as the read or write target – any two different targets will do. Delete the new
buffer at the end with `glDeleteBuffers(1, &planeCopyVBO);`.
:::
:::vulkan
Vulkan's copy command is `vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, regionCount, pRegions)`: each
`VkBufferCopy` region has a source offset, a destination offset and a size – the three numbers of OpenGL's
`glCopyBufferSubData`. Unlike OpenGL there are no targets to bind: the command names both buffers directly. The source
needs `VK_BUFFER_USAGE_TRANSFER_SRC_BIT`, the destination `VK_BUFFER_USAGE_TRANSFER_DST_BIT`, and like every command it
is recorded in a command buffer and runs on the GPU when that is submitted.

This is exactly the tool for vulkan-tutorial's *Staging buffer* chapter. Our vertex buffer lives in host-visible
memory, which the GPU may read more slowly than device-local memory – but device-local memory usually can't be mapped.
So the data goes through a *staging buffer*: the CPU writes it into a host-visible buffer, and the GPU copies it into
the device-local vertex buffer. The texture upload already does the same with `vkCmdCopyBufferToImage`.

Now do the last task, **copy-buffer**. In `createVertexBuffer()` the two blocks now go into the staging buffer, and the
vertex buffer is created in device-local memory as a transfer destination:

```cpp
        VkDeviceSize bufferSize = positionsSize + texCoordsSize;

        // the staging buffer: memory the CPU can write (a transfer source)
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);
```

The two `vkMapMemory` / `memcpy` / `vkUnmapMemory` blocks of the previous task stay, now on `stagingBufferMemory`.
Then:

```cpp
        // the vertex buffer: device-local memory, the fastest for the GPU to read (a transfer destination)
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, vertexBuffer, vertexBufferMemory);

        // the GPU copies the data from one buffer to the other (glCopyBufferSubData in OpenGL)
        copyBuffer(stagingBuffer, vertexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
```

`copyBuffer` is vulkan-tutorial's helper, written with the project's one-time command buffer functions:

```cpp
    // Copies size bytes from the start of one buffer to the start of another, with a one-time command buffer.
    void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferCopy copyRegion{};
        copyRegion.srcOffset = 0;
        copyRegion.dstOffset = 0;
        copyRegion.size = size;
        vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

        endSingleTimeCommands(commandBuffer);
    }
```

`endSingleTimeCommands` submits the command buffer and waits with `vkQueueWaitIdle` until the queue is idle, so the
copy has finished when `copyBuffer` returns – that is why the staging buffer can be destroyed right away. The hand-written
`vkCreateBuffer` / `vkAllocateMemory` code of the vertex buffer is gone: `createBuffer` does it.
:::
:::d3d12
Direct3D 12's copy command is `CopyBufferRegion(pDstBuffer, DstOffset, pSrcBuffer, SrcOffset, NumBytes)` – the
destination and its offset, the source and its offset, the number of bytes: OpenGL's `glCopyBufferSubData` with the
buffers named directly instead of bound to targets. (`CopyResource` copies a whole resource.) It is recorded in a
command list and runs on the GPU when the list is executed.

Now do the task **copy-buffer**: copy the floor's vertices into a second buffer, `m_floorCopyBuffer`, in a default
heap, and draw the floor from the copy:

```cpp
        CD3DX12_HEAP_PROPERTIES defaultHeapProperties(D3D12_HEAP_TYPE_DEFAULT);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &defaultHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_COMMON,
            nullptr,
            IID_PPV_ARGS(&m_floorCopyBuffer)));

        // Recorded in the command list (it runs when the list is executed, at the end of
        // LoadAssets): the destination and its offset, the source and its offset, the bytes.
        m_commandList->CopyBufferRegion(m_floorCopyBuffer.Get(), 0, m_floorVertexBuffer.Get(), 0, planeVertexBufferSize);

        // After the copy the input assembler reads the buffer: a transition to the vertex buffer state.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_floorCopyBuffer.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
        m_commandList->ResourceBarrier(1, &barrier);
```

Resources in Direct3D 12 have *states*, and the GPU must know when a resource changes its role. The copy buffer is created in
the `COMMON` state; the copy *promotes* it to `COPY_DEST` by itself (buffers are allowed this implicit promotion), and
the barrier then moves it from `COPY_DEST` to `VERTEX_AND_CONSTANT_BUFFER`, so the input assembler only reads it after
the copy has written it. The source, an upload-heap buffer, stays in `GENERIC_READ`, which includes being a copy
source. The floor's two views now point into the copy (`m_floorCopyBuffer->GetGPUVirtualAddress()`, and
`+ sizeof(XMFLOAT3)` for the second). `m_floorVertexBuffer` must stay: the copy reads it when the command list runs.

Copying into a default heap isn't just an exercise. The cube's vertex buffer still lives in an upload heap, with the
samples' comment above it: *"using upload heaps to transfer static data like vert buffers is not recommended. Every
time the GPU needs it, the upload heap will be marshalled over. Please read up on Default Heap usage."* The textures
already go the right way – an upload buffer, then a copy into a default-heap texture.

Now do the last task, **default-heap**: create `m_vertexBuffer` in a default heap (`D3D12_HEAP_TYPE_DEFAULT`, state
`D3D12_RESOURCE_STATE_COMMON`), write the two blocks into an upload buffer `vertexBufferUploadHeap` instead (`Map`, the
two `memcpy`, `Unmap`), and copy it over:

```cpp
        // Schedule the copy into the vertex buffer (the COMMON state is promoted to COPY_DEST
        // by the copy), then make it a vertex buffer.
        m_commandList->CopyBufferRegion(m_vertexBuffer.Get(), 0, vertexBufferUploadHeap.Get(), 0, vertexBufferSize);
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_vertexBuffer.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
        m_commandList->ResourceBarrier(1, &barrier);
```

Declare `ComPtr<ID3D12Resource> vertexBufferUploadHeap;` *before* the `// Create the vertex buffer.` block, like the
textures' upload heaps: the copy only runs when the command list is executed at the end of `LoadAssets`, which then
waits for the GPU – the upload buffer must still exist at that point. The views don't change; they point at
`m_vertexBuffer`, now in a default heap.
:::

Press **Build & run**: the floor and the cubes are drawn exactly as before – now from copied data.

```quiz
What happens to the data during a buffer-to-buffer copy (`glCopyBufferSubData`, `vkCmdCopyBuffer`, `CopyBufferRegion`)?
- [ ] The driver reads it back into your program's memory and uploads it again
- [ ] Only a reference is copied: both buffers then share the same memory
- [x] The GPU copies the bytes from one buffer to the other; your program never sees them
- [ ] The copy happens when the next frame is presented
---
A copy is GPU work: the bytes go straight from the source range to the destination range. That's what makes it the way to fill memory the CPU can't write, and to duplicate data without a trip through the CPU.
```

:::opengl
```quiz
Why does OpenGL have the extra targets `GL_COPY_READ_BUFFER` and `GL_COPY_WRITE_BUFFER`?
- [ ] Because `glCopyBufferSubData` only works on buffers created for copying
- [ ] Because they make the copy faster than with other targets
- [ ] Because a buffer bound to `GL_ARRAY_BUFFER` can't be copied
- [x] Because only one buffer can be bound to a target at a time, so copying between two vertex buffers needs two other targets
---
`glCopyBufferSubData` names targets, not buffers. Two vertex buffers can't both be bound to `GL_ARRAY_BUFFER`, so OpenGL adds two targets that exist for this reason alone.
```
:::
:::vulkan
```quiz
Why does the vertex data go through a staging buffer instead of being written into the device-local vertex buffer directly?
- [ ] Because `vkCmdCopyBuffer` is faster than `memcpy`
- [x] Because device-local memory usually can't be mapped, so the CPU can't write into it
- [ ] Because a vertex buffer may not be created with `VK_BUFFER_USAGE_TRANSFER_DST_BIT`
- [ ] Because the validation layers forbid `vkMapMemory` on vertex buffers
---
Device-local memory is the fastest for the GPU to read, but it is usually not host-visible. The CPU writes into a host-visible staging buffer, and the GPU copies from there.
```
:::
:::d3d12
```quiz
Why is `vertexBufferUploadHeap` declared before the vertex buffer block, and not inside it?
- [x] Because the copy only runs when the command list is executed at the end of `LoadAssets` – the upload buffer must still exist then
- [ ] Because a default-heap buffer can only be copied from a member variable
- [ ] Because `Map` fails on a local `ComPtr`
- [ ] Because `CopyBufferRegion` copies the data at once and then releases the source
---
`CopyBufferRegion` only records the copy. Inside the block, the `ComPtr` would release the upload buffer at the closing brace, long before the GPU reads it. Declared outside, it lives until `LoadAssets` has waited for the GPU.
```
:::

Having several ways to fill and copy buffers gives you more control over how your data gets to the GPU: reserve and
fill in parts, write through a pointer, batch the attributes when that suits your source data, and copy data into
memory the CPU can't reach. You'll see these techniques again whenever data is too big, too static or too dynamic for
the simple one-call upload.

## Additional resources

:::opengl
- [glBufferSubData](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferSubData.xhtml),
  [glMapBuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapBuffer.xhtml) and
  [glCopyBufferSubData](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyBufferSubData.xhtml): the reference
  pages of this chapter's functions.
:::
:::vulkan
- [Staging buffer](https://vulkan-tutorial.com/Vertex_buffers/Staging_buffer): vulkan-tutorial's chapter on
  device-local vertex buffers and `vkCmdCopyBuffer`.
- [vkCmdUpdateBuffer](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdUpdateBuffer.html): the limits
  and rules of the update command.
:::
:::d3d12
- [ID3D12GraphicsCommandList::CopyBufferRegion](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-copybufferregion)
  and [ID3D12Resource::Map](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12resource-map):
  the reference pages of this chapter's calls.
- [Using resource barriers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  resource states, including implicit state promotion.
:::
