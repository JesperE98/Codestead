# Instancing

Say you have a scene where you're drawing a lot of models where most of these models contain the same set of vertex
data, but with different world transformations. Think of a scene filled with grass leaves: each grass leave is a small
model that consists of only a few triangles. You'll probably want to draw quite a few of them and your scene may end up
with thousands or maybe tens of thousands of grass leaves that you need to render each frame. Because each leaf is only
a few triangles, the leaf is rendered almost instantly. However, the thousands of render calls you'll have to make will
drastically reduce performance.

If we were to actually render such a large amount of objects it will look a bit like this in code:

:::opengl
```cpp
for(unsigned int i = 0; i < amount_of_models_to_draw; i++)
{
    DoSomePreparations(); // bind VAO, bind textures, set uniforms etc.
    glDrawArrays(GL_TRIANGLES, 0, amount_of_vertices);
}
```
:::
:::vulkan
```cpp
for (uint32_t i = 0; i < amountOfModelsToDraw; i++) {
    DoSomePreparations(); // bind buffers and descriptor sets, push the model matrix etc.
    vkCmdDraw(commandBuffer, amountOfVertices, 1, 0, 0);
}
```
:::
:::d3d12
```cpp
for (UINT i = 0; i < amountOfModelsToDraw; i++)
{
    DoSomePreparations(); // set vertex buffers, root constants, descriptor tables etc.
    m_commandList->DrawInstanced(amountOfVertices, 1, 0, 0);
}
```
:::

When drawing many *instances* of your model like this you'll quickly reach a performance bottleneck because of the many
draw calls. Compared to rendering the actual vertices, telling the GPU to render your vertex data with a draw call is
quite expensive: the CPU has to prepare and validate the state the draw needs – which buffers to read, where the vertex
attributes are, which textures and constants to use – and hand it all over to the GPU. All of this happens on the CPU,
one draw at a time. So even though rendering your vertices is super fast, giving your GPU the commands to render them
isn't, and the GPU spends its time waiting for the next one.

:::vulkan
Vulkan was designed to make draw calls much cheaper than in OpenGL: there is no hidden state for the driver to check
at every draw, and command buffers can be recorded once and reused. But each `vkCmdDraw` is still a command with its
own bindings and push constants, recorded by the CPU and processed one after another by the GPU – thousands of them add
up.
:::
:::d3d12
Direct3D 12 was designed to make draw calls much cheaper than in Direct3D 11: the pipeline state is compiled in
advance, and there is no hidden state for the driver to check at every draw. But each `DrawInstanced` is still a
command with its own root arguments and vertex buffers, recorded by the CPU and processed one after another by the GPU
– thousands of them add up.
:::

It would be much more convenient if we could send data over to the GPU once, and then tell the GPU to draw multiple
objects using this data with a single drawing call. Enter *instancing*.

Instancing is a technique where we draw many (equal mesh data) objects at once with a single render call, saving us all
the CPU → GPU communications each time we need to render an object. To render using instancing all we need to do is
change the render calls `glDrawArrays` and `glDrawElements` to `glDrawArraysInstanced` and `glDrawElementsInstanced`
respectively – in OpenGL. These *instanced* versions of the classic rendering functions take an extra parameter called
the *instance count* that sets the number of instances we want to render.

:::opengl
`glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100)` draws the same 6 vertices 100 times. We thus sent all the required
data to the GPU once, and then tell the GPU how it should draw all these instances with a single call. The GPU then
renders all these instances without having to continually communicate with the CPU.
:::
:::vulkan
In Vulkan you've had this parameter all along: `vkCmdDraw(commandBuffer, vertexCount, instanceCount, firstVertex,
firstInstance)` and `vkCmdDrawIndexed(commandBuffer, indexCount, instanceCount, firstIndex, vertexOffset,
firstInstance)`. So far we always passed 1 as the instance count; `vkCmdDraw(commandBuffer, 6, 100, 0, 0)` draws the
same 6 vertices 100 times. We thus send the required data to the GPU once, and then tell the GPU how it should draw all
these instances with a single command.
:::
:::d3d12
In Direct3D 12 you've had this parameter all along – the "Instanced" in `DrawInstanced(VertexCountPerInstance,
InstanceCount, StartVertexLocation, StartInstanceLocation)` and `DrawIndexedInstanced(IndexCountPerInstance,
InstanceCount, StartIndexLocation, BaseVertexLocation, StartInstanceLocation)`. So far we always passed 1 as the
instance count; `DrawInstanced(6, 100, 0, 0)` draws the same 6 vertices 100 times. We thus send the required data to
the GPU once, and then tell the GPU how it should draw all these instances with a single command.
:::

By itself this function is a bit useless. Rendering the same object a thousand times is of no use to us since each of
the rendered objects is rendered exactly the same and thus also at the same location; we would only see one object!
For this reason the shader gives us another built-in variable in the vertex shader: the number of the instance that is
being drawn.

:::opengl
GLSL's `gl_InstanceID` is an integer that starts at 0 for the first instance of an instanced draw call and is
incremented for each instance being rendered. If we were to render the 43rd instance for example, `gl_InstanceID` would
have the value 42 in the vertex shader. Having a unique value per instance means we could now for example index into a
large array of position values to position each instance at a different location in the world.
:::
:::vulkan
Vulkan's GLSL calls it `gl_InstanceIndex` (OpenGL's `gl_InstanceID`): an integer that starts at 0 for the first
instance – more precisely at the draw's `firstInstance`, which is 0 for us – and is incremented for each instance being
rendered. If we were to render the 43rd instance for example, `gl_InstanceIndex` would have the value 42 in the vertex
shader. Having a unique value per instance means we could now for example index into a large array of position values
to position each instance at a different location in the world.
:::
:::d3d12
HLSL gives it to the vertex shader as an input with the system-value semantic `SV_InstanceID` (GLSL's `gl_InstanceID`):
a `uint` that starts at 0 for the first instance of the draw and is incremented for each instance being rendered (it
does not include `StartInstanceLocation`). If we were to render the 43rd instance for example, it would have the value
42 in the vertex shader. Having a unique value per instance means we could now for example index into a large array of
position values to position each instance at a different location in the world.
:::

The technique is the same in every API; this chapter shows it for {{api}}.

:::opengl
The project starts with learnopengl's first example before instancing: no camera, no matrices, the clear colour (0.1,
0.1, 0.1), and one small quad – learnopengl's `quadVertices`, a 2D position and a colour per vertex, ±0.05 – drawn once
in the centre with `glDrawArrays(GL_TRIANGLES, 0, 6)` by `instancing.vs` / `instancing.fs`. For the asteroid field the
project already contains the Model chapter's `mesh.h` and `model.h` – with `Mesh::VAO`, `Mesh::indices`,
`Model::meshes` and `Model::textures_loaded` public, as learnopengl's asteroid demo needs – the planet and the course's
rock (`models/rock.obj`, `rock.mtl`, `rock.png`), and the shaders `planet.vs/.fs` and `asteroids.vs/.fs`.
:::
:::vulkan
The project starts with learnopengl's first example before instancing: no camera, no matrices, the clear colour (0.1,
0.1, 0.1), and one small quad – learnopengl's `quadVertices` (`struct QuadVertex { glm::vec2 pos; glm::vec3 color; }`,
±0.05, in its own vertex buffer `quadVertexBuffer`) – drawn once in the centre with `vkCmdDraw(commandBuffer, 6, 1, 0,
0)` by `shaders/instancing.vert` / `.frag`. Vulkan's y axis points down, so the quad's y values are negated and the
picture is learnopengl's (red corner top-left). `createPipeline(vertFile, fragFile, bindingDescriptions,
attributeDescriptions, pipeline)` takes the vertex input as parameters – a *vector* of bindings, because instancing adds
a second one. For the asteroid field the start already creates (but doesn't use yet) the Model chapter's code for two
models: `loadModel(path, vertices, indices)` for the planet and the course's rock, their vertex and index buffers, three
textures, the uniform buffer (`view`, `proj`) and two descriptor sets, `planetDescriptorSet` and `rockDescriptorSet`.
:::
:::d3d12
The project starts with learnopengl's first example before instancing: no camera, no matrices, the clear colour (0.1,
0.1, 0.1), and one small quad – learnopengl's `quadVertices` (`struct QuadVertex { XMFLOAT2 position; XMFLOAT3 color;
}`, ±0.05, 6 vertices) – drawn once in the centre with `DrawInstanced(6, 1, 0, 0)` by `instancing.hlsl`. For the
asteroid field the project already contains the Model chapter's `Model` class – with each mesh's `vertexBufferView`,
`indexBufferView` and `srvHandle` public, as learnopengl makes the mesh's VAO public for its asteroid demo – the
planet, the course's rock (`models/rock.obj`, `rock.mtl`, `rock.png`), the root signature with root constants (b0), the
CBV table (b1) and a texture table, and the shaders `planet.hlsl` and `asteroids.hlsl`.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, build and run the program in your
IDE. Right now it shows one small quad in the centre of the window, coloured from its corners: red, green, blue and
cyan.

## Instancing

To get a feel for instanced drawing we're going to demonstrate a simple example that renders a hundred 2D quads in
normalized device coordinates with just one render call. We accomplish this by uniquely positioning each instanced quad
by indexing a uniform array of 100 offset vectors. The result is a neatly organized grid of quads that fill the entire
window.

Each quad consists of 2 triangles with a total of 6 vertices. Each vertex contains a 2D NDC position vector and a
colour vector – the quad you see now. The vertex shader adds an offset to each position; the offset is picked from an
array by the instance number.

We'll define the offset translations in a nested for-loop before we enter the render loop: we create a total of 100
translation vectors that contains a translation vector for all positions in a 10x10 grid. The loop runs y from -10 up
and x from -10 to the right, in steps of 2, and divides by 10: the quads' centres are at -0.9, -0.7, … 0.9 in both
directions. So instance 0 is the bottom-left quad, instance 9 the bottom-right one, and instance 99 the top-right one.

:::opengl
Now do the first task, **offsets**. In `instancing.vs`, add the uniform array and use the instance's element:

```glsl
uniform vec2 offsets[100];
```

```glsl
void main()
{
    vec2 offset = offsets[gl_InstanceID]; // gl_InstanceID: 0 for the first instance, 1 for the second ...
    fColor = aColor;
    gl_Position = vec4(aPos + offset, 0.0, 1.0);
}
```

In `main.cpp`, at the TODO, generate the translations and hand them to the shader:

```cpp
    // generate a list of 100 quad locations/translation-vectors
    // ---------------------------------------------------------
    glm::vec2 translations[100];
    int index = 0;
    float offset = 0.1f;
    for (int y = -10; y < 10; y += 2)
    {
        for (int x = -10; x < 10; x += 2)
        {
            glm::vec2 translation;
            translation.x = (float)x / 10.0f + offset;
            translation.y = (float)y / 10.0f + offset;
            translations[index++] = translation;
        }
    }

    // hand the offsets to the shader: one uniform per array element, offsets[0] .. offsets[99]
    shader.use();
    for (unsigned int i = 0; i < 100; i++)
    {
        shader.setVec2("offsets[" + std::to_string(i) + "]", translations[i]);
    }
```

Within this snippet of code we transform the for-loop counter `i` to a `string` to dynamically create a location string
for querying the uniform location. For each item in the offsets uniform array we then set the corresponding
translation vector.

Now that all the preparations are finished we can start rendering the quads. To draw via instanced rendering we call
`glDrawArraysInstanced` instead of `glDrawArrays`:

```cpp
        glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100); // 100 quads of 6 vertices each
```
:::
:::vulkan
Now do the first task, **offsets**. Vulkan has no single uniforms, so the array goes into the uniform buffer, after
`proj`. Here the uniform block's memory layout matters (std140, as in the *Advanced GLSL* chapter): **every element of
an array in a uniform block takes 16 bytes**, so a `vec2` array would be padded to `vec4` slots anyway. We make that
explicit and use `vec4` elements, of which the shader reads `.xy`. In `main.cpp`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    // std140: every element of an array in a uniform block takes 16 bytes - a vec2 would be padded to a vec4 anyway
    glm::vec4 offsets[100];
};
```

`updateUniformBuffer()` generates the translations (the view and projection stay empty until the `planet` task):

```cpp
        // a list of 100 quad locations/translation-vectors: a 10x10 grid
        int index = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
            for (int x = -10; x < 10; x += 2) {
                glm::vec2 translation;
                translation.x = (float)x / 10.0f + offset;
                translation.y = -((float)y / 10.0f + offset); // learnopengl's rows go up from the bottom; Vulkan's y points down
                ubo.offsets[index++] = glm::vec4(translation, 0.0f, 0.0f);
            }
        }
```

The y value is negated like the quad's vertices, so instance 0 is the bottom-left quad as in learnopengl. In
`shaders/instancing.vert`, declare the block and use the instance's element:

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 offsets[100]; // x, y: the offset (z, w unused)
} ubo;

void main() {
    vec2 offset = ubo.offsets[gl_InstanceIndex].xy; // gl_InstanceIndex: 0 for the first instance, 1 for the second ...
    fragColor = inColor;
    gl_Position = vec4(inPosition + offset, 0.0, 1.0);
}
```

In `recordCommandBuffer()` the quad now needs the uniform buffer bound – both descriptor sets of the project contain
it, and the quads read nothing else, so `planetDescriptorSet` will do – and the draw gets its instance count:

```cpp
        // the offsets are in the uniform buffer (both descriptor sets have it; the quads read nothing else)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &planetDescriptorSet, 0, nullptr);

        vkCmdDraw(commandBuffer, 6, 100, 0, 0); // 100 instances of the quad's 6 vertices
```
:::
:::d3d12
Now do the first task, **offsets**. Direct3D 12 has no single uniforms, so the array goes into a constant buffer of its
own. Here HLSL's packing rules matter (as in the *Advanced GLSL* chapter): **every element of an array in a cbuffer
starts a new 16-byte register**, so a `float2` array would be padded to `float4` slots anyway. We make that explicit
and use `float4` elements, of which the shader reads `.xy`. In `instancing.hlsl`:

```hlsl
cbuffer OffsetConstantBuffer : register(b2)
{
    float4 offsets[100];
};
```

```hlsl
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, uint instanceID : SV_InstanceID)
{
    PSInput result;

    float2 offset = offsets[instanceID].xy;    // SV_InstanceID: 0 for the first instance, 1 for the second ...
    result.color = color;
    result.position = float4(position + offset, 0.0f, 1.0f);
```

In `main.cpp` the matching C++ structure goes next to the other constant buffer structures, with a member
`ComPtr<ID3D12Resource> m_offsetBuffer;`:

```cpp
    struct OffsetConstantBuffer
    {
        XMFLOAT4 offsets[100];
    };
```

The offsets never change, so the buffer doesn't need a descriptor in the heap: we bind it as a *root constant buffer
view* – a root descriptor, set directly with the buffer's GPU address. The root signature gets a fourth parameter,
register b2 for the vertex shader:

```cpp
        CD3DX12_ROOT_PARAMETER rootParameters[4];
```

```cpp
        rootParameters[3].InitAsConstantBufferView(2, 0, D3D12_SHADER_VISIBILITY_VERTEX);
```

In `LoadAssets`, at the TODO, generate the translations and write them into the buffer once:

```cpp
    XMFLOAT2 translations[100];
    int index = 0;
    float offset = 0.1f;
    for (int y = -10; y < 10; y += 2)
    {
        for (int x = -10; x < 10; x += 2)
        {
            XMFLOAT2 translation;
            translation.x = static_cast<float>(x) / 10.0f + offset;
            translation.y = static_cast<float>(y) / 10.0f + offset;
            translations[index++] = translation;
        }
    }

    // Create the offsets' constant buffer and write the offsets into it, once.
    {
        // HLSL gives every element of an array in a cbuffer its own 16-byte register: an
        // offset (2 floats) takes the room of 4, so the C++ array is one of XMFLOAT4.
        OffsetConstantBuffer offsetData = {};
        for (UINT i = 0; i < 100; i++)
        {
            offsetData.offsets[i] = XMFLOAT4(translations[i].x, translations[i].y, 0.0f, 0.0f);
        }

        const UINT offsetBufferSize = CalculateConstantBufferByteSize(sizeof(OffsetConstantBuffer));    // CB size is required to be 256-byte aligned.
```

followed by an upload-heap buffer `m_offsetBuffer` of that size, `Map`, `memcpy(pOffsetDataBegin, &offsetData,
sizeof(offsetData))` and `Unmap` – like the vertex buffer of Hello Triangle. In `PopulateCommandList` the root
parameter points at the buffer, and the draw gets its instance count:

```cpp
    m_commandList->SetGraphicsRootConstantBufferView(3, m_offsetBuffer->GetGPUVirtualAddress());
```

```cpp
    m_commandList->DrawInstanced(6, 100, 0, 0);    // 100 quads of 6 vertices each
```
:::

Build and run: a 10x10 grid of the little quad fills the window – a hundred quads, drawn with one draw call.

```quiz
The loops run y from -10 upwards and, inside, x from -10 to the right. Which instance number does the quad in the top-right corner of the window have?
- [ ] 0
- [ ] 9
- [ ] 90
- [x] 99
---
Instance 0 is the bottom-left quad, the first row (bottom) holds instances 0 to 9 from left to right, and the last row (top) holds 90 to 99 – so the top-right quad is the last one, 99.
```

## Instanced arrays

While the previous implementation works fine for this specific use case, whenever we are rendering a lot more than 100
instances (which is quite common) we will eventually hit a limit on the amount of uniform data we can send to the
shaders. One alternative option is known as *instanced arrays*. Instanced arrays are defined as a vertex attribute
(allowing us to store much more data) that are updated per instance instead of per vertex.

With vertex attributes, at the start of each run of the vertex shader, the GPU will retrieve the next set of vertex
attributes that belong to the current vertex. When defining a vertex attribute as an instanced array however, the
vertex shader only updates the content of the vertex attribute per instance. This allows us to use the standard vertex
attributes for data per vertex and use the instanced array for storing data that is unique per instance.

To give you an example of an instanced array we're going to take the previous example and convert the offset uniform
array to an instanced array. We'll have to update the vertex shader by adding another vertex attribute; we no longer
use the instance number in the shader – the attribute *is* the instance's offset.

:::opengl
Now do the task **instanced-array**. In `instancing.vs` the uniform array becomes an attribute:

```glsl
layout (location = 2) in vec2 aOffset; // an instanced array: a new value for every instance
```

```glsl
void main()
{
    fColor = aColor;
    gl_Position = vec4(aPos + aOffset, 0.0, 1.0);
}
```

Because an instanced array is a vertex attribute, just like the position and colour variables, we need to store its
content in a vertex buffer object and configure its attribute pointer. We're first going to store the `translations`
array (from the previous section) in a new buffer object, instead of the loop of `setVec2` calls:

```cpp
    // store instance data in an array buffer
    // --------------------------------------
    unsigned int instanceVBO;
    glGenBuffers(1, &instanceVBO);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(glm::vec2) * 100, &translations[0], GL_STATIC_DRAW);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
```

Then we also need to set its vertex attribute pointer and enable the vertex attribute, while `quadVAO` is bound, after
attribute 1:

```cpp
    // also set instance data
    glEnableVertexAttribArray(2);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO); // this attribute comes from a different vertex buffer
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glVertexAttribDivisor(2, 1); // tell OpenGL this is an instanced vertex attribute.
```

What makes this code interesting is the last line where we call `glVertexAttribDivisor`. This function tells OpenGL
*when* to update the content of a vertex attribute to the next element. Its first parameter is the vertex attribute in
question and the second parameter the *attribute divisor*. By default, the attribute divisor is 0 which tells OpenGL to
update the content of the vertex attribute each iteration of the vertex shader. By setting this attribute to 1 we're
telling OpenGL that we want to update the content of the vertex attribute when we start to render a new instance. By
setting it to 2 we'd update the content every 2 instances and so on. By setting the attribute divisor to 1 we're
effectively telling OpenGL that the vertex attribute at attribute location 2 is an instanced array.

The draw call stays `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100);`. Delete `instanceVBO` at the end too
(`glDeleteBuffers(1, &instanceVBO);`).
:::
:::vulkan
Now do the task **instanced-array**. In `shaders/instancing.vert` the uniform block goes, and the offset becomes an
attribute:

```glsl
layout(location = 2) in vec2 inOffset; // an instanced array: a new value for every instance
```

```glsl
void main() {
    fragColor = inColor;
    gl_Position = vec4(inPosition + inOffset, 0.0, 1.0);
}
```

Because an instanced array is a vertex attribute, just like the position and colour, its content goes into a vertex
buffer – a second one, next to the quad's. In Vulkan a *binding* describes one vertex buffer: its stride and its *input
rate*. So far every binding had `VK_VERTEX_INPUT_RATE_VERTEX`: the next element for every vertex. The instance buffer
gets `VK_VERTEX_INPUT_RATE_INSTANCE`: the next element for every instance. `QuadVertex::getBindingDescriptions()`
returns two bindings now:

```cpp
        std::vector<VkVertexInputBindingDescription> bindingDescriptions(2);

        bindingDescriptions[0].binding = 0;
        bindingDescriptions[0].stride = sizeof(QuadVertex);
        bindingDescriptions[0].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        // binding 1: an instanced array - the next glm::vec2 offset for every instance, not every vertex
        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::vec2);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_INSTANCE;
```

and `getAttributeDescriptions()` a third attribute, `attributeDescriptions(3)`, read from binding 1:

```cpp
        // the instance's offset: location 2, from binding 1
        attributeDescriptions[2].binding = 1;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = 0;
```

This is OpenGL's `glVertexAttribDivisor(2, 1)` in Vulkan form. (OpenGL's divisor can also be 2 or more – a new value
every 2 instances and so on; core Vulkan has only "per vertex" and "per instance", larger divisors need the
`VK_KHR_vertex_attribute_divisor` extension.)

The offsets leave the uniform buffer: remove `offsets[100]` from `UniformBufferObject` and the loop from
`updateUniformBuffer()`. Instead, a new function fills a vertex buffer with them, once. Add the members
`VkBuffer instanceBuffer; VkDeviceMemory instanceBufferMemory;` (destroyed in `cleanup()`), and call
`createInstanceBuffer()` after the quad's vertex buffer is created:

```cpp
    // The instance data in a vertex buffer of its own: learnopengl's 100 translations, one glm::vec2 per quad.
    void createInstanceBuffer() {
        glm::vec2 translations[100];
        int index = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
            for (int x = -10; x < 10; x += 2) {
                glm::vec2 translation;
                translation.x = (float)x / 10.0f + offset;
                translation.y = -((float)y / 10.0f + offset); // learnopengl's rows go up from the bottom; Vulkan's y points down
                translations[index++] = translation;
            }
        }

        createVertexBuffer(&translations[0], sizeof(glm::vec2) * 100, instanceBuffer, instanceBufferMemory);
    }
```

When drawing, both vertex buffers are bound, to bindings 0 and 1; the descriptor set is no longer needed for the quads:

```cpp
        // draw 100 instanced quads: binding 0 the quad's vertices, binding 1 the instance data
        VkBuffer vertexBuffers[] = {quadVertexBuffer, instanceBuffer};
        VkDeviceSize offsets[] = {0, 0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets);
```

The draw stays `vkCmdDraw(commandBuffer, 6, 100, 0, 0);`.
:::
:::d3d12
Now do the task **instanced-array**. In `instancing.hlsl` the cbuffer goes, and the offset becomes an input of the
vertex shader – with its own semantic, `OFFSET`:

```hlsl
// offset: an instanced input - a new value for every instance (input slot 1).
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset : OFFSET)
{
    PSInput result;

    result.color = color;
    result.position = float4(position + offset, 0.0f, 1.0f);
```

Because an instanced array is a vertex input, just like the position and colour, its content goes into a vertex buffer
– a second one, bound to input slot 1 next to the quad's in slot 0. The input layout describes where each input comes
from: the new element reads `OFFSET` from slot 1, and its classification says that it advances once per instance
instead of once per vertex:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 8, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "OFFSET", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 }
        };
```

The last member, `InstanceDataStepRate`, is OpenGL's attribute divisor: 1 means a new value for every instance, 2 a
new value every 2 instances and so on (per-vertex data must have 0). `PER_INSTANCE_DATA` with step rate 1 is
`glVertexAttribDivisor(2, 1)`.

The offsets' constant buffer goes: remove `OffsetConstantBuffer`, `m_offsetBuffer`, root parameter 3 (back to
`CD3DX12_ROOT_PARAMETER rootParameters[3];`) and `SetGraphicsRootConstantBufferView`. Instead, add the members
`ComPtr<ID3D12Resource> m_instanceBuffer;` and `D3D12_VERTEX_BUFFER_VIEW m_instanceBufferView = {};`, and after the
`translations` loop store them in a vertex buffer: an upload-heap buffer of `sizeof(translations)` bytes, `Map`,
`memcpy(pInstanceDataBegin, translations, sizeof(translations))`, `Unmap`, and its view:

```cpp
        // The view: one offset (an XMFLOAT2) per instance.
        m_instanceBufferView.BufferLocation = m_instanceBuffer->GetGPUVirtualAddress();
        m_instanceBufferView.StrideInBytes = sizeof(XMFLOAT2);
        m_instanceBufferView.SizeInBytes = instanceBufferSize;
```

When drawing, both vertex buffers are set, each to its slot:

```cpp
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
    m_commandList->IASetVertexBuffers(1, 1, &m_instanceBufferView);
```

The draw stays `DrawInstanced(6, 100, 0, 0)`.
:::

Build and run: nothing changes – the same grid, pixel for pixel. But now the offsets come from a vertex buffer, which
can hold far more instances than a uniform array.

```quiz
Why does learnopengl replace the uniform array of offsets by an instanced array?
- [ ] An instanced array is drawn with fewer draw calls
- [x] The amount of uniform data a shader can read is limited; a vertex buffer can hold data for far more instances
- [ ] A uniform array cannot be indexed with the instance number
- [ ] The vertex shader runs fewer times with an instanced array
---
Both versions use one draw call and run the vertex shader 600 times. The difference is where the per-instance data lives: uniforms are small (OpenGL guarantees only 1024 components of default-block uniforms for a vertex shader and 16 KB per uniform block, Direct3D 64 KB per constant buffer), vertex buffers can be as large as memory allows.
```

:::opengl
```quiz
What does `glVertexAttribDivisor(2, 1)` tell OpenGL?
- [x] Attribute 2 advances to its next element once per instance, not once per vertex
- [ ] Attribute 2 is read from every second element of the buffer
- [ ] Attribute 2 is divided by 1 before the vertex shader reads it
- [ ] Only the first instance reads attribute 2
---
The divisor says how many instances share one element: 0 (the default) means a new element for every vertex, 1 a new element for every instance, 2 one for every two instances.
```
:::
:::vulkan
```quiz
Which setting makes the vertex shader's `inOffset` take a new value for every instance instead of every vertex?
- [ ] `vkCmdDraw` with an instance count of 100
- [ ] The attribute's `location = 2`
- [x] `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE` on the vertex binding the attribute reads from
- [ ] The attribute's format `VK_FORMAT_R32G32_SFLOAT`
---
The input rate belongs to the binding – the vertex buffer – and every attribute read from binding 1 advances once per instance. It is OpenGL's `glVertexAttribDivisor(2, 1)`.
```
:::
:::d3d12
```quiz
Which part of the `OFFSET` input element makes it take a new value for every instance instead of every vertex?
- [ ] The input slot 1
- [x] `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` with `InstanceDataStepRate` 1
- [ ] The semantic name `OFFSET`
- [ ] The format `DXGI_FORMAT_R32G32_FLOAT`
---
The classification and the step rate are OpenGL's attribute divisor: per-instance data with step rate 1 advances once per instance. The slot only says which vertex buffer the element is read from.
```
:::

For fun we could slowly downscale each quad from top-right to bottom-left using the instance number again, because why
not?

:::opengl
Now do the task **scale-quads**. In `instancing.vs`:

```glsl
    vec2 pos = aPos * (gl_InstanceID / 100.0); // the quads grow from the first instance (bottom-left) to the last (top-right)
    fColor = aColor;
    gl_Position = vec4(pos + aOffset, 0.0, 1.0);
```
:::
:::vulkan
Now do the task **scale-quads**. In `shaders/instancing.vert`:

```glsl
    vec2 pos = inPosition * (gl_InstanceIndex / 100.0); // the quads grow from the first instance (bottom-left) to the last (top-right)
    fragColor = inColor;
    gl_Position = vec4(pos + inOffset, 0.0, 1.0);
```
:::
:::d3d12
Now do the task **scale-quads**. In `instancing.hlsl`, `VSMain` gets the instance number again,
`uint instanceID : SV_InstanceID`, after `offset`:

```hlsl
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset : OFFSET, uint instanceID : SV_InstanceID)
{
    PSInput result;

    float2 pos = position * (instanceID / 100.0f);    // the quads grow from the first instance (bottom-left) to the last (top-right)
    result.color = color;
    result.position = float4(pos + offset, 0.0f, 1.0f);
```
:::

Build and run. The result is that the first instances of the quads are drawn extremely small and the further we're in
the process of drawing the instances, the closer the instance number gets to 100 and thus the more the quads regain
their original size: the top-right quad has its full size, the quads shrink row by row towards the bottom, and the
bottom-left one – instance 0 – has disappeared completely. It's perfectly legal to use instanced arrays together with
the instance number like this.

```quiz
In the **scale-quads** task, what would happen if you divided the instance number by `100` instead of `100.0`?
- [ ] Nothing: the result is converted to a float anyway
- [ ] The quads would grow ten times bigger
- [x] It would be an integer division, 0 for every instance from 0 to 99 – every quad would get size 0 and disappear
- [ ] The shader would fail to compile
---
An integer divided by an integer is an integer division: 42 / 100 is 0. Only with a floating-point operand (100.0) is the result 0.42, a fraction that grows from instance to instance.
```

## An asteroid field

Imagine a scene where we have one large planet that's at the center of a large asteroid ring. Such an asteroid ring
could contain thousands or tens of thousands of rock formations and quickly becomes un-renderable on any decent
graphics card. This scenario proves itself particularly useful for instanced rendering, since all the asteroids can be
represented with a single model. Each single asteroid then gets its variation from a transformation matrix unique to
each asteroid.

To demonstrate the impact of instanced rendering we're first going to render a scene of asteroids hovering around a
planet *without* instanced rendering. The scene will contain a large planet model and a large set of asteroid rocks
that we position around the planet. The planet model is the one from the *Model* chapter, and the rock is the course's
own `rock.obj` with its texture `rock.png`.

To achieve the effect we're looking for we'll generate a model transformation matrix for each asteroid. The
transformation matrix first translates the rock somewhere in the asteroid ring – then we'll add a small random
displacement value to the offset to make the ring look more natural. From there we also apply a random scale and a
random rotation. The result is a transformation matrix that translates each asteroid somewhere around the planet while
also giving it a more natural and unique look compared to the other asteroids.

learnopengl first draws every rock with its own draw call – `rock.Draw(shader)` in a loop, with the rock's model matrix
set as a uniform before each one – and shows how the frame rate drops as the number of rocks grows: from a couple of
thousand rocks on, the scene stops running smoothly, although each rock is a small model. Then it draws the same rocks
instanced, and the very same machine handles 100,000 rocks (in a ring of radius 150) easily. A real GPU draws such a
field with instancing in a fraction of a frame.

Our version is smaller: 500 rocks in a ring of radius 15. The course draws its checks and expected results on the CPU,
so it keeps the field small – it can't show what instancing gains on a real GPU – but the code is exactly the code that
would draw 100,000 rocks: change `amount` and the radius, and nothing else. And instead of seeding the random numbers
with the time, as learnopengl does, we use `srand(42)`: the same field every run, so you can compare your picture with
the expected one. (Only the same C library gives the same sequence: on another platform, `rand()` produces a different
field.)

First, the planet on its own.

:::opengl
Now do the task **planet**. Replace the quads by the planet: camera globals after `SCR_HEIGHT` – far away, so the whole
field fits in the window:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f, 55.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Instead of `shader`, the translations, `instanceVBO` and the quad's data, VAO and VBO (and their cleanup), the planet
gets its shader and is loaded:

```cpp
    Shader planetShader("planet.vs", "planet.fs");

    // load models
    // -----------
    // (aiProcess_FlipUVs in model.h turns the texture coordinates the right way up: no stbi_set_flip_vertically_on_load)
    Model planet("models/planet.obj");
```

In the render loop, the planet is drawn below the centre, scaled by 4:

```cpp
        // configure transformation matrices
        glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 1000.0f); // far plane 1000: the field is large
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        planetShader.use();
        planetShader.setMat4("projection", projection);
        planetShader.setMat4("view", view);

        // draw planet
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
        model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
        planetShader.setMat4("model", model);
        planet.Draw(planetShader);
```
:::
:::vulkan
Now do the task **planet**. Replace the quads by the planet: camera globals after `HEIGHT` – far away, so the whole
field fits in the window:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f, 55.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Remove everything of the quads: `QuadVertex`, `quadVertices`, `quadVertexBuffer`, `instanceBuffer` and
`createInstanceBuffer()` (with their creation and cleanup). The pipeline draws the planet's `Vertex`es with
`planet.vert/.frag`:

```cpp
        // the planet: each vertex a Vertex
        createPipeline("shaders/planet.vert.spv", "shaders/planet.frag.spv", Vertex::getBindingDescriptions(), Vertex::getAttributeDescriptions(), graphicsPipeline);
```

`updateUniformBuffer()` writes the view and the projection – with the far plane at 1000, because the field is large:

```cpp
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        // the far plane at 1000: the scene is large
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 1000.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan
        ubo.proj[1][1] *= -1;
```

And `recordCommandBuffer()` draws the planet below the centre, scaled by 4:

```cpp
        // draw planet
        VkBuffer vertexBuffers[] = {planetVertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
        vkCmdBindIndexBuffer(commandBuffer, planetIndexBuffer, 0, VK_INDEX_TYPE_UINT32);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &planetDescriptorSet, 0, nullptr);

        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
        model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(planetIndices.size()), 1, 0, 0, 0);
```
:::
:::d3d12
Now do the task **planet**. Replace the quads by the planet: camera globals before `struct Vertex` – far away, so the
whole field fits in the window:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f, 55.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

Remove everything of the quads: `struct QuadVertex`, `m_vertexBuffer`, `m_vertexBufferView`, `m_instanceBuffer`,
`m_instanceBufferView`, the quad's vertex buffer, `translations` and the instance buffer. Add a member
`Model m_planet;`. The pipeline state takes `planet.hlsl`'s `VSMain` and `PSMain` and the mesh's input layout
(`POSITION`, `NORMAL` at 12, `TEXCOORD` at 24). In `LoadAssets` the planet is loaded – and
`m_planet.uploadHeaps.clear();` follows the final `WaitForPreviousFrame()`:

```cpp
    m_planet.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

`OnUpdate` writes the view and the projection – with the far plane at 1000, because the field is large – transposed
into the constant buffer:

```cpp
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 1000.0f);
```

And `PopulateCommandList` draws the planet below the centre, scaled by 4:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    // draw planet: the model matrix (root parameter 0) moves it down by 3 and scales it
    // by 4 - learnopengl's translate * scale, written in the order DirectXMath applies it.
    XMMATRIX model = XMMatrixScaling(4.0f, 4.0f, 4.0f) * XMMatrixTranslation(0.0f, -3.0f, 0.0f);
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_planet.Draw(m_commandList.Get());
```
:::

Build and run: a small textured planet just below the centre of the window. The camera is 3 units above the plane of its
ring, so the ring is seen almost edge-on – a thin beige line through the middle of the planet.

Now the rocks. Instead of a draw call per rock, we compute all their model matrices once, put them into a buffer, and
read the matrix in the vertex shader as an instanced array – one matrix per instance. learnopengl's loop that creates
the matrices is the same in every API (only the matrix type differs): the angle runs around the circle, three random
displacements in [-offset, offset] move the rock off the circle (the height only by 40%, to keep the ring flat), and
then a random scale between 0.05 and 0.25 and a random rotation about the axis (0.4, 0.6, 0.8) follow.

A matrix is too big for one vertex attribute: an attribute is at most four floats, a `vec4`. A `mat4` is basically 4
`vec4`s, so the attribute takes 4 consecutive locations, one per vector of the matrix, and each of them needs its own
attribute description, all reading from the same buffer with the stride of a whole matrix.

:::opengl
Now do the last task, **asteroids**. In `asteroids.vs`, the rock's model matrix becomes an attribute:

```glsl
layout (location = 3) in mat4 aInstanceMatrix; // a mat4 attribute takes four locations: 3, 4, 5 and 6
```

```glsl
    gl_Position = projection * view * aInstanceMatrix * vec4(aPos, 1.0f);
```

Note that we no longer use a model uniform variable, but instead declare a `mat4` as a vertex attribute so we can store
an instanced array of transformation matrices. However, when we declare a datatype as a vertex attribute that is
greater than a `vec4` things work a bit differently. The maximum amount of data allowed for a vertex attribute is equal
to a `vec4`. Because a `mat4` is basically 4 `vec4`s, we have to reserve 4 vertex attributes for this specific matrix.
Because we assigned it a location of 3, the columns of the matrix will have vertex attribute locations of 3, 4, 5, and
6.

In `main.cpp`, add the rocks' shader and load the rock before the planet:

```cpp
    Shader asteroidShader("asteroids.vs", "asteroids.fs");
```

```cpp
    Model rock("models/rock.obj");
```

After the planet is loaded, generate the matrices:

```cpp
    // generate a list of semi-random model transformation matrices
    // ------------------------------------------------------------------
    unsigned int amount = 500;
    glm::mat4* modelMatrices;
    modelMatrices = new glm::mat4[amount];
    srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
    float radius = 15.0f;
    float offset = 2.5f;
    for (unsigned int i = 0; i < amount; i++)
    {
        glm::mat4 model = glm::mat4(1.0f);
        // 1. translation: displace along circle with 'radius' in range [-offset, offset]
        float angle = (float)i / (float)amount * 360.0f;
        float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float x = sin(angle) * radius + displacement;
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float z = cos(angle) * radius + displacement;
        model = glm::translate(model, glm::vec3(x, y, z));

        // 2. scale: Scale between 0.05 and 0.25f
        float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);
        model = glm::scale(model, glm::vec3(scale));

        // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
        float rotAngle = static_cast<float>((rand() % 360));
        model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

        // 4. now add to list of matrices
        modelMatrices[i] = model;
    }
```

Then we store the matrices in a buffer and configure the matrix attribute on each of the rock's meshes:

```cpp
    // configure instanced array
    // -------------------------
    unsigned int buffer;
    glGenBuffers(1, &buffer);
    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferData(GL_ARRAY_BUFFER, amount * sizeof(glm::mat4), &modelMatrices[0], GL_STATIC_DRAW);

    for (unsigned int i = 0; i < rock.meshes.size(); i++)
    {
        unsigned int VAO = rock.meshes[i].VAO;
        glBindVertexArray(VAO);
        // set attribute pointers for matrix (4 times vec4)
        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)0);
        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(sizeof(glm::vec4)));
        glEnableVertexAttribArray(5);
        glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(2 * sizeof(glm::vec4)));
        glEnableVertexAttribArray(6);
        glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(3 * sizeof(glm::vec4)));

        glVertexAttribDivisor(3, 1);
        glVertexAttribDivisor(4, 1);
        glVertexAttribDivisor(5, 1);
        glVertexAttribDivisor(6, 1);

        glBindVertexArray(0);
    }
```

Note that we cheated a little by declaring the `VAO` variable of the `Mesh` as a public variable instead of a private
variable so we could access its vertex array object. This is not the cleanest solution, but just a simple modification
to suit this example. Aside from the little hack, this code should be clear: we're declaring how OpenGL should
interpret the buffer for each of the matrix's vertex attributes and that each of those vertex attributes is an
instanced array.

In the render loop, `asteroidShader` gets the projection and the view next to the planet's shader
(`asteroidShader.use(); asteroidShader.setMat4("projection", projection); asteroidShader.setMat4("view", view);`), and
after the planet we draw the rocks – one instanced draw per mesh of the rock:

```cpp
        // draw meteorites
        asteroidShader.use();
        asteroidShader.setInt("texture_diffuse1", 0);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, rock.textures_loaded[0].id); // note: we also made the textures_loaded vector public (instead of private) from the model class.
        for (unsigned int i = 0; i < rock.meshes.size(); i++)
        {
            glBindVertexArray(rock.meshes[i].VAO);
            glDrawElementsInstanced(GL_TRIANGLES, static_cast<unsigned int>(rock.meshes[i].indices.size()), GL_UNSIGNED_INT, 0, amount);
            glBindVertexArray(0);
        }
```

Here we draw the same amount of asteroids as before, but this time with instanced rendering. Finally, free what you
allocated, before `glfwTerminate()`: `glDeleteBuffers(1, &buffer); delete[] modelMatrices;`.
:::
:::vulkan
Now do the last task, **asteroids**. In `shaders/asteroids.vert`, the rock's model matrix becomes an attribute:

```glsl
layout(location = 4) in mat4 inInstanceMatrix; // a mat4 attribute takes four locations: 4, 5, 6 and 7
```

```glsl
    gl_Position = ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0);
```

Note that the shader no longer uses a model matrix from a push constant, but a `mat4` vertex attribute, so we can store
an instanced array of transformation matrices. A `mat4` attribute takes four consecutive locations, one per column.
learnopengl puts it at location 3; our `Vertex` already uses locations 0 to 3 (position, normal, texture coordinate and
material index – the pipeline's vertex input declares all four), so the matrix starts at 4 and takes 4, 5, 6 and 7.

In `main.cpp`, add `const uint32_t amount = 500;` after the file paths, and give `Vertex` the vertex input of an
instanced pipeline: the rock's vertices at binding 0 as before, and a matrix per instance at binding 1:

```cpp
    // The asteroids' vertex input: the rock's vertices (binding 0) and, per instance, a model matrix (binding 1).
    static std::vector<VkVertexInputBindingDescription> getInstancedBindingDescriptions() {
        std::vector<VkVertexInputBindingDescription> bindingDescriptions = getBindingDescriptions();
        bindingDescriptions.resize(2);

        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::mat4);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_INSTANCE; // the next matrix for every instance

        return bindingDescriptions;
    }
```

```cpp
    // A mat4 attribute takes four locations, one vec4 (a column of the matrix) each: 4, 5, 6 and 7.
    static std::vector<VkVertexInputAttributeDescription> getInstancedAttributeDescriptions() {
        std::vector<VkVertexInputAttributeDescription> attributeDescriptions = getAttributeDescriptions();
        attributeDescriptions.resize(8);

        attributeDescriptions[4].binding = 1;
        attributeDescriptions[4].location = 4;
        attributeDescriptions[4].format = VK_FORMAT_R32G32B32A32_SFLOAT;
        attributeDescriptions[4].offset = 0;

        attributeDescriptions[5].binding = 1;
        attributeDescriptions[5].location = 5;
        attributeDescriptions[5].format = VK_FORMAT_R32G32B32A32_SFLOAT;
        attributeDescriptions[5].offset = sizeof(glm::vec4);
```

and likewise `[6]` (location 6, offset `2 * sizeof(glm::vec4)`) and `[7]` (location 7, offset `3 * sizeof(glm::vec4)`).
GLM stores a matrix column by column, so the four `vec4`s at offsets 0, 16, 32 and 48 are its columns – exactly what
the shader's `mat4` attribute expects.

The rocks need different shaders and a different vertex input than the planet, so they get their own pipeline. Add a
member `VkPipeline asteroidPipeline;` (destroyed in `cleanup()`) and create it after the planet's:

```cpp
        // the asteroids: a Vertex per vertex and a model matrix per instance
        createPipeline("shaders/asteroids.vert.spv", "shaders/asteroids.frag.spv", Vertex::getInstancedBindingDescriptions(), Vertex::getInstancedAttributeDescriptions(), asteroidPipeline);
```

The matrices go into a vertex buffer of their own. Add the members `VkBuffer instanceBuffer; VkDeviceMemory
instanceBufferMemory;` (destroyed in `cleanup()`), and call `createInstanceBuffer()` after the rock's index buffer is
created:

```cpp
    // The instance data: a list of semi-random model transformation matrices, one per asteroid, in a vertex buffer.
    void createInstanceBuffer() {
        std::vector<glm::mat4> modelMatrices(amount);
        srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
        float radius = 15.0f;
        float offset = 2.5f;
        for (unsigned int i = 0; i < amount; i++) {
            glm::mat4 model = glm::mat4(1.0f);
            // 1. translation: displace along circle with 'radius' in range [-offset, offset]
            float angle = (float)i / (float)amount * 360.0f;
            float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float x = sin(angle) * radius + displacement;
            displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
            displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float z = cos(angle) * radius + displacement;
            model = glm::translate(model, glm::vec3(x, y, z));

            // 2. scale: Scale between 0.05 and 0.25f
            float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);
            model = glm::scale(model, glm::vec3(scale));

            // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
            float rotAngle = static_cast<float>((rand() % 360));
            model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

            // 4. now add to list of matrices
            modelMatrices[i] = model;
        }

        createVertexBuffer(modelMatrices.data(), sizeof(glm::mat4) * amount, instanceBuffer, instanceBufferMemory);
    }
```

In `recordCommandBuffer()`, after the planet, we draw all the rocks with one command: the asteroid pipeline, the
rock's vertices at binding 0 and the matrices at binding 1, the rock's indices and its descriptor set (with its
texture):

```cpp
        // draw meteorites: all of them with one draw call, amount instances of the rock
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, asteroidPipeline);
        VkBuffer rockVertexBuffers[] = {rockVertexBuffer, instanceBuffer}; // binding 0: the rock's vertices, binding 1: the matrices
        VkDeviceSize rockOffsets[] = {0, 0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, rockVertexBuffers, rockOffsets);
        vkCmdBindIndexBuffer(commandBuffer, rockIndexBuffer, 0, VK_INDEX_TYPE_UINT32);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &rockDescriptorSet, 0, nullptr);
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(rockIndices.size()), amount, 0, 0, 0);
```

No push constant is needed for the rocks: each instance's matrix comes from the instance buffer.
:::
:::d3d12
Now do the last task, **asteroids**. In `asteroids.hlsl`, the rock's model matrix becomes an input of the vertex
shader. An input element is at most four floats, so the matrix arrives as four `float4` inputs with the semantic
`INSTANCEMATRIX` and the indices 0 to 3, and the shader builds the matrix from them:

```hlsl
// The rock's model matrix is a per-instance input (input slot 1): a vertex input is at
// most a float4, so the matrix comes as its four rows, INSTANCEMATRIX0 to INSTANCEMATRIX3.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD,
    float4 instanceRow0 : INSTANCEMATRIX0, float4 instanceRow1 : INSTANCEMATRIX1,
    float4 instanceRow2 : INSTANCEMATRIX2, float4 instanceRow3 : INSTANCEMATRIX3)
{
    PSInput result;

    float4x4 instanceMatrix = float4x4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);
    result.texCoords = texCoords;
    result.position = mul(mul(mul(position, instanceMatrix), view), projection);
```

The rocks need a different shader and a different input layout than the planet, so they get their own pipeline state,
`ComPtr<ID3D12PipelineState> m_asteroidPipelineState;`, made from the same description after the planet's:

```cpp
        D3D12_INPUT_ELEMENT_DESC asteroidInputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "INSTANCEMATRIX", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 1, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 16, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 2, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 32, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 3, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 48, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 }
        };

        ComPtr<ID3DBlob> asteroidVertexShader;
        ComPtr<ID3DBlob> asteroidPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"asteroids.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &asteroidVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"asteroids.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &asteroidPixelShader, nullptr));
        psoDesc.InputLayout = { asteroidInputElementDescs, _countof(asteroidInputElementDescs) };
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(asteroidVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(asteroidPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_asteroidPipelineState)));
```

Slot 0 is the rock's mesh, as for the planet; slot 1 holds a matrix per instance – its four rows at byte offsets 0, 16,
32 and 48. Add `static const UINT amount = 500;` next to `MaxMeshes`, `#include <cstdlib>` for `rand`, and the members
`Model m_rock;`, `ComPtr<ID3D12Resource> m_instanceBuffer;` and `D3D12_VERTEX_BUFFER_VIEW m_instanceBufferView = {};`.
In `LoadAssets`, load the rock after the planet – its texture views go into the heap after the planet's, two slots per
mesh:

```cpp
    m_rock.Load("models/rock.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1 + 2 * static_cast<UINT>(m_planet.meshes.size()));
```

Then generate the matrices:

```cpp
    std::vector<XMFLOAT4X4> modelMatrices(amount);
    srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
    float radius = 15.0f;
    float offset = 2.5f;
    for (UINT i = 0; i < amount; i++)
    {
        // 1. translation: displace along circle with 'radius' in range [-offset, offset]
        float angle = static_cast<float>(i) / static_cast<float>(amount) * 360.0f;
        float displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float x = std::sin(angle) * radius + displacement;
        displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
        displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float z = std::cos(angle) * radius + displacement;

        // 2. scale: Scale between 0.05 and 0.25f
        float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);

        // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
        float rotAngle = static_cast<float>((rand() % 360));

        // 4. now add to list of matrices: rotate, then scale, then move - learnopengl's
        // translate * scale * rotate, written in the order DirectXMath applies it. Not
        // transposed: the vertex shader builds the matrix from these rows.
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(0.4f, 0.6f, 0.8f, 0.0f), rotAngle)
            * XMMatrixScaling(scale, scale, scale)
            * XMMatrixTranslation(x, y, z);
        XMStoreFloat4x4(&modelMatrices[i], model);
    }
```

Note the one place where we do *not* transpose a matrix. The matrices in constant buffers are transposed because HLSL
reads a `float4x4` in a constant buffer column by column. Here the shader builds the matrix itself from four input
rows with `float4x4(row0, row1, row2, row3)`, and `XMStoreFloat4x4` stores DirectXMath's matrix row by row – so the
four `float4`s in the buffer are exactly the rows `mul(position, instanceMatrix)` needs.

The matrices go into an upload-heap buffer `m_instanceBuffer` (`memcpy(pInstanceDataBegin, modelMatrices.data(),
instanceBufferSize)`) with a view of one matrix per element (`StrideInBytes = sizeof(XMFLOAT4X4)`), and
`m_rock.uploadHeaps.clear();` follows `m_planet.uploadHeaps.clear();`. In `PopulateCommandList`, after the planet, we
draw the rocks – one instanced draw per mesh of the rock:

```cpp
    m_commandList->SetPipelineState(m_asteroidPipelineState.Get());
    m_commandList->IASetVertexBuffers(1, 1, &m_instanceBufferView);
    for (UINT i = 0; i < m_rock.meshes.size(); i++)
    {
        m_commandList->SetGraphicsRootDescriptorTable(2, m_rock.meshes[i].srvHandle);
        m_commandList->IASetVertexBuffers(0, 1, &m_rock.meshes[i].vertexBufferView);
        m_commandList->IASetIndexBuffer(&m_rock.meshes[i].indexBufferView);
        m_commandList->DrawIndexedInstanced(static_cast<UINT>(m_rock.meshes[i].indices.size()), amount, 0, 0, 0);
    }
```

This is why the mesh's views and `srvHandle` were made public: like learnopengl's demo, we draw the rock's meshes
ourselves instead of calling `m_rock.Draw`. No root constants are needed for the rocks: each instance's matrix comes
from slot 1.
:::

Build and run: a flat band of grey rocks across the upper half of the planet – the ring of radius 15 seen from 3 units
above its plane, so it looks like a band. The planet below the band is unchanged.

:::opengl
```quiz
`aInstanceMatrix` is declared at location 3. Which attribute locations does it occupy?
- [ ] Only 3: a `mat4` is a single attribute
- [x] 3, 4, 5 and 6: one location per column, because an attribute holds at most a `vec4`
- [ ] 3 to 18: one location per float
- [ ] 0 to 3: a matrix always starts at location 0
---
The largest vertex attribute is a `vec4`. A `mat4` is four of them, so it takes four consecutive locations, and each needs its own `glVertexAttribPointer` (stride `sizeof(glm::mat4)`, offsets 0, 16, 32, 48) and divisor.
```
:::
:::vulkan
```quiz
Why does the Vulkan project put the instance matrix at location 4 instead of learnopengl's 3?
- [ ] Location 3 is reserved for `gl_InstanceIndex`
- [ ] A matrix attribute has to start at a multiple of 4
- [ ] The instance binding always starts at location 4
- [x] Our `Vertex` uses locations 0 to 3 (position, normal, texture coordinate, material index), and the matrix needs four free locations in a row
---
A `mat4` attribute takes four consecutive locations, one per column (`VK_FORMAT_R32G32B32A32_SFLOAT` each). With the vertex's four attributes at 0–3, the matrix gets 4, 5, 6 and 7.
```
:::
:::d3d12
```quiz
Why does the asteroid pipeline's input layout have four `INSTANCEMATRIX` elements?
- [x] An input element holds at most four components, so a 4x4 matrix comes as four `float4` rows, which the shader puts together with `float4x4(...)`
- [ ] Each rock has four meshes
- [ ] One element per input slot
- [ ] DirectXMath stores a matrix in four separate buffers
---
`DXGI_FORMAT_R32G32B32A32_FLOAT` is the largest vertex format: one row of the matrix. The four elements read the 64-byte matrix of each instance at offsets 0, 16, 32 and 48 of slot 1.
```
:::

```quiz
Why does drawing the rocks instanced scale so much better than one draw call per rock?
- [x] The cost of a draw call is mostly on the CPU – preparing and sending the commands; one instanced draw replaces hundreds of them, and the GPU processes all instances in one go
- [ ] The GPU only runs the vertex shader once for all instances
- [ ] Instanced rocks are rendered at a lower resolution
- [ ] Instancing skips the depth test
---
The GPU still processes every vertex of every rock. What instancing removes is the per-draw work: the bindings, the uniform updates and the commands for each single rock. That's why learnopengl's machine goes from struggling with a few thousand rocks to handling 100,000.
```

On learnopengl's machine, 100,000 asteroids at a radius of 150 run smoothly with instancing – a number of draw calls
that would be completely out of reach one rock at a time. Try it on a real GPU: set `amount` to 100,000, the radius to
150 and the offset to 25, and move the camera back. As you can see, with the right type of environments, instanced
rendering can make an enormous difference to the rendering capabilities of your application. For this reason,
instanced rendering is commonly used for grass, flora, particles, and scenes like this – basically any scene with many
repeating shapes can benefit from instanced rendering.

## Additional resources

:::opengl
- [glDrawArraysInstanced](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysInstanced.xhtml) and
  [glVertexAttribDivisor](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribDivisor.xhtml): the
  reference pages.
- [asteroids_instanced.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/4.advanced_opengl/10.3.asteroids_instanced/asteroids_instanced.cpp):
  learnopengl's instanced asteroid field.
:::
:::vulkan
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): vulkan-tutorial on
  bindings, input rates and attributes.
- [Fixed-Function Vertex Processing](https://docs.vulkan.org/spec/latest/chapters/fxvertex.html): the chapter of the
  Vulkan specification on vertex input, including `VK_VERTEX_INPUT_RATE_INSTANCE`.
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): why an array element in a
  uniform block takes 16 bytes.
:::
:::d3d12
- [D3D12_INPUT_ELEMENT_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_input_element_desc):
  input slots, `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` and `InstanceDataStepRate`.
- [DrawIndexedInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-drawindexedinstanced):
  the parameters of an instanced, indexed draw.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  why an array element in a cbuffer takes a whole register.
:::

In the next chapter, the last one of this part, we look at the jagged edges every picture so far had, and how to smooth
them: *anti-aliasing*.
