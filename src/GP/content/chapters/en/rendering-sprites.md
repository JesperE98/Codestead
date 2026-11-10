# Rendering Sprites

To bring some life to the currently black abyss of our game world, we will render sprites to fill the void. A *sprite*
has many definitions, but it's effectively not much more than a 2D image used together with some data to position it
in a larger world (e.g. position, rotation, and size). Basically, sprites are the render-able image/texture objects we
use in a 2D game.

We can, just like we did in previous chapters, create a 2D shape out of vertex data, pass all data to the GPU, and
transform it all by hand. However, in a larger application like this we rather have some abstractions on rendering 2D
shapes. If we were to manually define these shapes and transformations for each object, it'll quickly get messy.

In this chapter we'll define a rendering class that allows us to render a large amount of unique sprites with a
minimal amount of code. This way, we're abstracting the gameplay code from the gritty {{api}} rendering code as is
commonly done in larger projects. First, we have to set up a proper projection matrix though.

## 2D projection matrix

We know from the Coordinate Systems chapter that a projection matrix converts all view-space coordinates to clip-space
(and then to normalized device) coordinates. By generating the appropriate projection matrix we can work with
different coordinates that are easier to work with, compared to directly specifying all coordinates as normalized
device coordinates.

We don't need any perspective applied to the coordinates, since the game is entirely in 2D, so an orthographic
projection matrix would suit the rendering quite well. Because an orthographic projection matrix directly transforms
all coordinates to normalized device coordinates, we can choose to specify the world coordinates as screen coordinates
by defining the projection matrix as follows:

:::opengl
```cpp
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
```

The first four arguments specify in order the left, right, bottom, and top part of the projection frustum. This
projection matrix transforms all x coordinates between 0 and 800 to -1 and 1, and all y coordinates between 0 and 600
to 1 and -1 – note the order: *bottom* is 600 and *top* is 0. Here we specified that the top of the frustum has a y
coordinate of 0, while the bottom has a y coordinate of 600. The result is that the top-left coordinate of the scene
will be at (0, 0) and the bottom-right part of the screen is at coordinate (800, 600), just like screen coordinates;
the world-space coordinates directly correspond to the resulting pixel coordinates.
:::
:::vulkan
```cpp
        ubo.projection = glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f, static_cast<float>(Hedgerow.Height), -1.0f, 1.0f);
```

(in `updateUniformBuffer()`, every frame, like every Vulkan chapter). The first four arguments specify in order the
left, right, bottom, and top part of the projection frustum: x from 0 to 800 maps to -1 … 1, and y from 0 to 600 maps
to -1 … 1. learnopengl writes `glm::ortho(0, 800, 600, 0, -1, 1)` – bottom 600, top 0 – to turn OpenGL's clip space,
whose y points *up*, into coordinates whose y points down. Vulkan's clip space y already points *down* (y = -1 is the
top of the window), so here the plain order gives the same result, and there is no `proj[1][1] *= -1` either. The
result is that the top-left coordinate of the scene will be at (0, 0) and the bottom-right part of the screen is at
coordinate (800, 600), just like screen coordinates; the world-space coordinates directly correspond to the resulting
pixel coordinates. (With `GLM_FORCE_DEPTH_ZERO_TO_ONE`, z = 0 lands at depth 0.5 – there is no depth buffer anyway.)
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(Hedgerow.Width), static_cast<float>(Hedgerow.Height), 0.0f, -1.0f, 1.0f);
```

The first four arguments specify in order the left, right, bottom, and top part of the projection volume – learnopengl's
`glm::ortho(0, Width, Height, 0, -1, 1)`. Direct3D's clip space y points up like OpenGL's, so with bottom 600 and top 0
all x coordinates between 0 and 800 go to -1 … 1 and all y coordinates between 0 and 600 to 1 … -1. The result is that
the top-left coordinate of the scene will be at (0, 0) and the bottom-right part of the screen is at coordinate
(800, 600), just like screen coordinates; the world-space coordinates directly correspond to the resulting pixel
coordinates. (The right-handed version maps z = 0 to depth 0.5 – there is no depth buffer anyway.) Like the view and
projection of the earlier Direct3D 12 chapters, the matrix is written into the constant buffer in `OnUpdate`, stored
transposed for HLSL; learnopengl sets it once in `Init` as a uniform.
:::

This allows us to specify all vertex coordinates equal to the pixel coordinates they end up in on the screen, which is
rather intuitive for 2D games. And it is how the textures are read: the images are not flipped when they are loaded,
so their first row is the top of the picture – and with the y axis pointing down, the quad's top (y = 0) gets that first
row (v = 0).

```quiz
With the game's projection, where on the screen does a quad from (0, 580) to (100, 600) end up?
- [ ] In the top-left corner, 20 pixels high
- [x] In the bottom-left corner: y grows downwards, and 600 is the bottom edge of the window
- [ ] Outside the window, because y = 600 is beyond the projection
- [ ] In the bottom-left corner, but upside down
---
The projection maps the game's pixels one to one onto the window's: (0, 0) top-left, (800, 600) bottom-right. That is where the next chapter puts the paddle, 100 × 20 pixels at (350, 580).
```

## Rendering sprites

Rendering an actual sprite shouldn't be too complicated. We create a textured quad that we can transform with a model
matrix, after which we project it using the previously defined orthographic projection matrix.

Since Hedgerow is a static scene, there's no need for a view/camera matrix. Using the projection matrix we can directly
transform the world-space coordinates to normalized device coordinates.

To transform a sprite, we use the following vertex shader:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;

uniform mat4 model;
// note that we're omitting the view matrix; the view never changes so we basically have an identity view matrix and can therefore omit it.
uniform mat4 projection;

void main()
{
    TexCoords = vertex.zw;
    gl_Position = projection * model * vec4(vertex.xy, 0.0, 1.0);
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    TexCoords = vertex.zw;
    // no view matrix: the view never changes (the window shows the game's 800 x 600 pixels)
    gl_Position = ubo.projection * pc.model * vec4(vertex.xy, 0.0, 1.0);
}
```

learnopengl's two uniforms that change from sprite to sprite – `model` and `spriteColor` – are push constants:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 spriteColor;
};
```

76 bytes, well inside the 128 bytes every device offers, in one range for the vertex and the fragment stage. The
projection, the same for every sprite, is in the uniform buffer.
:::
:::d3d12
```hlsl
cbuffer SpriteConstants : register(b0)
{
    float4x4 model;
    float3 spriteColor;
};

cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 projection;
};

PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.texCoord = texCoord;
    result.position = mul(mul(float4(position, 0.0f, 1.0f), model), projection);

    return result;
}
```

learnopengl's two uniforms that change from sprite to sprite – `model` and `spriteColor` – are root constants, the
19 values of root parameter 0 (`cbuffer SpriteConstants : register(b0)`, visible to both shaders); the C++ side is

```cpp
struct SpriteConstants
{
    XMFLOAT4X4 model;
    XMFLOAT3   spriteColor;
};
```

The projection, the same for every sprite, is in the constant buffer at b1. The input layout of the game's pipeline
state has two `float2`s, `POSITION` and `TEXCOORD` – learnopengl's one `vec4`.
:::

Note that we store both the position and texture-coordinate data in a single `vec4` variable. Because both the
position and texture coordinates contain two floats, we can combine them in a single vertex attribute.

The fragment shader is relatively straightforward as well. We take a texture and a color vector that both affect the
final color of the fragment. By having a uniform color vector, we can easily change the color of sprites from the
game-code:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D image;
uniform vec3 spriteColor;

void main()
{
    color = vec4(spriteColor, 1.0) * texture(image, TexCoords);
}
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D image;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    color = vec4(pc.spriteColor, 1.0) * texture(image, TexCoords);
}
```

The sampler `image` is binding 1 of the texture's descriptor set – there is no texture unit to set.
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(spriteColor, 1.0f) * image.Sample(wrapSampler, input.texCoord);
}
```

`image` is the `Texture2D` at t0 (the table of root parameter 2), `wrapSampler` the root signature's static sampler
s0.
:::

The colour multiplies the texture: white (1, 1, 1) keeps the image as it is, and any other colour tints it – a light
grey block tile becomes an orange or a blue block, which is how the next chapter colours the level's blocks.

Now do the first task, **sprite-shader**: write the two shaders' `main` and load them as `"sprite"` in `Init`:

:::opengl
```cpp
    // load shaders
    LoadShader("sprite.vs", "sprite.fs", nullptr, "sprite");
    // configure shaders
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
    Use(GetShader("sprite"));
    SetInteger(GetShader("sprite"), "image", 0);
    SetMatrix4(GetShader("sprite"), "projection", projection);
```

The sampler `image` reads texture unit 0, and the projection is set once – it never changes.
:::
:::vulkan
```cpp
        // load shaders
        LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite");
```

and set the projection in `updateUniformBuffer()` as above.
:::
:::d3d12
```cpp
    // load shaders
    LoadShader(L"sprite.hlsl", "sprite");
```

and write the projection into the constant buffer in `OnUpdate`, after `Update`:

```cpp
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```
:::

Press **Build & run**: still black – the shader exists, but nothing is drawn with it yet.

Now that we have the shaders in place, we can write the sprite renderer – in learnopengl a class that holds a shader
and a single vertex array object, with a `DrawSprite` function that draws a textured quad given a position, size,
rotation and colour. As everywhere in the game, the course writes it as a struct and free functions:

:::opengl
```cpp
struct SpriteRenderer
{
    // render state
    Shader       shader;
    unsigned int quadVAO = 0;
};
```

and the global `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, created with `new` in `Init`).
:::
:::vulkan
```cpp
struct SpriteRenderer {
    // render state
    VkPipeline       pipeline = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};
```

and the global `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, created with `new` in `Init`).
learnopengl's shader is the pipeline (and its layout, which `vkCmdPushConstants` and `vkCmdBindDescriptorSets` need),
its VAO the quad's vertex buffer. And there is one more member: the **command buffer being recorded**. In OpenGL,
`DrawSprite` can draw from anywhere, because the context is global. In Vulkan a draw is a command recorded into a
command buffer, and `DrawSprite` – called by `Render`, called by `recordCommandBuffer` – needs to know which one. Instead
of adding a parameter to every function of the game, `recordCommandBuffer()` hands it to the renderer before it calls
`Render`:

```cpp
        // the game's draws go into this command buffer
        Renderer.commandBuffer = commandBuffer;
        Render(Hedgerow);
```

so `DrawSprite` and the later `DrawObject` and `DrawLevel` keep learnopengl's parameters.
:::
:::d3d12
```cpp
struct SpriteRenderer
{
    // render state
    Shader                   shader;
    ComPtr<ID3D12Resource>   quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {};
};
```

and the global `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, created with `new` in `Init`).
learnopengl's shader is the pipeline state object, its VAO the quad's vertex buffer and its view. The draws go into
`Graphics.CommandList`, the one command list, so `DrawSprite` keeps learnopengl's parameters.
:::

### Initialization

learnopengl's constructor of the sprite renderer calls `initRenderData`, which configures the quad's vertex data; the
course's `InitRenderData` is called in `Init` after the shader is loaded:

:::opengl
```cpp
void InitRenderData(SpriteRenderer& renderer)
{
    // configure VAO/VBO
    unsigned int VBO;
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };

    glGenVertexArrays(1, &renderer.quadVAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(renderer.quadVAO);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}
```

In `Init`:

```cpp
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
```

and at the end of `main`, after `ClearResources();`, `glDeleteVertexArrays(1, &Renderer.quadVAO);` (learnopengl deletes
it in the renderer's destructor).
:::
:::vulkan
```cpp
    void InitRenderData(SpriteRenderer& renderer) {
        // the quad: (0, 0) is the sprite's top-left corner, (1, 1) its bottom-right, in position and texture coordinates
        const std::vector<Vertex> vertices = {
            // pos      // tex
            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}},
            {{0.0f, 0.0f, 0.0f, 0.0f}},

            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 1.0f, 1.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}}
        };
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, renderer.quadBuffer, renderer.quadBufferMemory);

        void* data;
        vkMapMemory(device, renderer.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, renderer.quadBufferMemory);
    }
```

A member function, because it creates a buffer with the device. The vertex is the project's `Vertex { glm::vec4
vertex; }`, attribute 0 of format `VK_FORMAT_R32G32B32A32_SFLOAT` – learnopengl's `glVertexAttribPointer(0, 4, …)`. Six
vertices that never change could also live in device-local memory behind a staging buffer; host-visible memory is
simpler and plenty fast for 96 bytes. In `Init`:

```cpp
        // set render-specific controls
        Renderer.pipeline = GetShader("sprite");
        Renderer.pipelineLayout = pipelineLayout;
        InitRenderData(Renderer);
```

and in `cleanup()`, after `ClearResources();`, `vkDestroyBuffer` and `vkFreeMemory` for the quad's buffer.
:::
:::d3d12
```cpp
void InitRenderData(SpriteRenderer& renderer)
{
    // the unit quad: two triangles with the corners (0, 0) to (1, 1) and their texture
    // coordinates (v = 0 is the image's top row, and y = 0 is the window's top)
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
```

followed by an upload-heap vertex buffer like those of the earlier chapters – `CreateCommittedResource` into
`renderer.quadVertexBuffer`, `Map`, `memcpy`, `Unmap` – and its view with `StrideInBytes = 4 * sizeof(float)`. In
`Init`:

```cpp
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
```

and in `OnDestroy`, after `ClearResources();`, `Renderer = SpriteRenderer();` – the assignment releases the buffer's
`ComPtr` (learnopengl deletes the VAO in the renderer's destructor).
:::

Here, we first define a set of vertices with (0, 0) being the top-left corner of the quad. This means that when we
apply translation or scaling transformations on the quad, they're transformed from the top-left position of the quad.
This is commonly accepted in 2D graphics and/or GUI systems where elements' positions correspond to the top-left corner
of the elements. The texture coordinates are the same numbers: the quad's top-left corner gets the image's top-left
texel, the bottom-right corner its bottom-right one – which is why the images need no flipping with this projection.

Now do the task **sprite-renderer**: the struct, `InitRenderData`, the global `Renderer`, its set-up in `Init` and its
clean-up at the end.
:::vulkan
Also give it the command buffer in `recordCommandBuffer()`, as shown above.
:::
Run it: still black – the quad exists, but nothing draws it.

### Rendering

Rendering sprites is not too difficult; we use the sprite renderer's shader, configure a model matrix, and set the
relevant uniforms. What is important here is the order of transformations:

:::opengl
```cpp
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))
{
    // prepare transformations
    Use(renderer.shader);
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    SetMatrix4(renderer.shader, "model", model);

    // render textured quad
    SetVector3f(renderer.shader, "spriteColor", color);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, texture);

    glBindVertexArray(renderer.quadVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}
```

learnopengl passes a `Texture2D` and calls its `Bind()`; the course passes the texture's ID, which the game objects of
the next chapter keep as their sprite.
:::
:::vulkan
```cpp
void DrawSprite(SpriteRenderer& renderer, VkDescriptorSet texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f)) {
    vkCmdBindPipeline(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipeline);

    // prepare transformations
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    PushConstants constants{};
    constants.model = model;

    // render textured quad
    constants.spriteColor = color;
    vkCmdPushConstants(renderer.commandBuffer, renderer.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);

    vkCmdBindDescriptorSets(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipelineLayout, 0, 1, &texture, 0, nullptr);

    VkBuffer vertexBuffers[] = {renderer.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(renderer.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(renderer.commandBuffer, 6, 1, 0, 0);
}
```

Each of learnopengl's OpenGL calls has its command: `shader.Use()` is `vkCmdBindPipeline`, the two uniforms are one
`vkCmdPushConstants`, `texture.Bind()` is `vkCmdBindDescriptorSets` with the texture's descriptor set – the texture is
passed as that set, which is what a draw binds –, the VAO is `vkCmdBindVertexBuffers`, and `glDrawArrays` is
`vkCmdDraw`. Push constants are recorded into the command buffer with each draw, so every sprite of a frame gets its
own matrix and colour although the GPU runs them all later.
:::
:::d3d12
```cpp
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, XMFLOAT2 position, XMFLOAT2 size = XMFLOAT2(10.0f, 10.0f), float rotate = 0.0f, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))
{
    // prepare transformations (DirectXMath applies the matrices from left to right: first
    // scale, then rotation, and then final translation happens - learnopengl's reversed order)
    XMMATRIX model = XMMatrixScaling(size.x, size.y, 1.0f); // first scale

    model = model * XMMatrixTranslation(-0.5f * size.x, -0.5f * size.y, 0.0f);   // move origin of rotation to center of quad
    model = model * XMMatrixRotationZ(XMConvertToRadians(rotate));             // then rotate
    model = model * XMMatrixTranslation(0.5f * size.x, 0.5f * size.y, 0.0f);     // move origin back

    model = model * XMMatrixTranslation(position.x, position.y, 0.0f); // last translate

    SpriteConstants constants = {};
    XMStoreFloat4x4(&constants.model, XMMatrixTranspose(model));
    constants.spriteColor = color;

    // render textured quad: the shader, its root constants (root parameter 0) and the
    // texture's view (root parameter 2)
    Use(renderer.shader);
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(SpriteConstants) / 4, &constants, 0);
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), texture, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);

    Graphics.CommandList->IASetVertexBuffers(0, 1, &renderer.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}
```

Each of learnopengl's OpenGL calls has its command: `shader.Use()` is `SetPipelineState` (in `Use`), the two uniforms
are one `SetGraphicsRoot32BitConstants`, `texture.Bind()` is `SetGraphicsRootDescriptorTable(2, …)` with a handle to the
texture's view – the texture is passed as its heap slot –, the VAO is `IASetVertexBuffers`, and `glDrawArrays` is
`DrawInstanced`. Root constants are recorded into the command list with each draw, so every sprite of a frame gets its
own matrix and colour although the GPU runs them all later.
:::

When trying to position objects somewhere in a scene with rotation and scaling transformations, it is advised to first
scale, then rotate, and finally translate the object. Because multiplying matrices occurs from right to left, we
transform the matrix in reverse order: translate, rotate, and then scale.

The rotation transformation may still seem a bit daunting. We know from the Transformations chapter that rotations
always revolve around the origin (0, 0). Because we specified the quad's vertices with (0, 0) as the top-left
coordinate, all rotations will rotate around this point of (0, 0). The *origin of rotation* is at the top-left of the
quad, which produces undesirable results. What we want to do is move the origin of rotation to the center of the quad
so the quad neatly rotates around this origin, instead of rotating around the top-left of the quad. We solve this by
translating the quad by half its size first, so its center is at coordinate (0, 0) before rotating.

Since we first scale the quad, we have to take the size of the sprite into account when translating to the sprite's
center (which is why we multiply with the sprite's size). Once the rotation transformation is applied, we reverse the
previous translation. Read in the order the transformations happen to a corner of the unit quad:

1. **scale** to `size` – the quad now spans (0, 0) … (size.x, size.y);
2. **translate by -0.5 · size** – its centre is at the origin;
3. **rotate** about z by `rotate` degrees – about its centre;
4. **translate by +0.5 · size** – back to (0, 0) … size, still turned;
5. **translate to `position`** – the top-left corner of the unrotated sprite goes to `position`.

:::opengl vulkan
In the code they are written in the reverse order, because glm multiplies each new matrix onto the right of `model`,
and the matrix written last is the first one to touch the vertex (`projection * model * vertex`).
:::
:::d3d12
DirectXMath multiplies *row* vectors from the left (`mul(position, model)` in HLSL), so the matrices are combined in
the order they happen – scale first, translation last, `model = model * …` each time. That is learnopengl's list
written forwards instead of backwards; the result is the same matrix, transposed when it is stored for the shader.
:::

Combining all these transformations, we can position, scale, and rotate each sprite in any way we like.

A positive angle turns the sprite **clockwise on the screen**. `rotate` about +z turns the x axis towards the y axis –
counter-clockwise in the usual y-up drawing of a coordinate system. But the game's y axis points *down*, so turning x
towards y means turning right-then-down: clockwise.

```quiz
Why does `DrawSprite` translate by half the size, rotate, and translate back, instead of only rotating?
- [ ] Because a rotation must always be the first transformation of a model matrix
- [ ] Because the projection would otherwise mirror the sprite
- [ ] Because rotating a scaled quad without them would distort its shape
- [x] Because a rotation turns about the origin, which is the quad's top-left corner: the translations move the centre to the origin for the rotation and back again, so the sprite turns in place
---
Without them, a sprite at (200, 200) turned by 45° would swing around its top-left corner and end up half outside its spot. The translations by ±0.5 · size are in pixels because the quad has already been scaled to its size.
```

:::opengl
```quiz
In the code the model matrix is built as `translate(position)`, the rotation lines, and `scale(size)` last. In which order are these transformations applied to a vertex?
- [x] Scale first, then the rotation about the centre, then the translation to `position` – the reverse of the order in the code
- [ ] Translate first, then rotate, then scale – the order in the code
- [ ] All at the same time, so the order does not matter
- [ ] Rotate first, because rotations are always applied before scaling
---
Each `glm::translate/rotate/scale(model, …)` multiplies the new matrix onto the right of `model`, and in `projection * model * vertex` the matrix nearest the vertex is applied first – the one written last.
```
:::
:::vulkan
```quiz
`DrawSprite` sends the model matrix and the colour with `vkCmdPushConstants` before each draw. Why do all sprites of a frame get their own values, although the GPU runs the draws only after the command buffer is submitted?
- [ ] Because `vkCmdPushConstants` writes into the uniform buffer, and each sprite has its own part of it
- [ ] They don't: every sprite of the frame gets the values of the last push
- [x] Because the push constant values are copied into the command buffer when the command is recorded; each draw uses the values pushed before it
- [ ] Because the pipeline is bound again for every sprite
---
That is the difference to rewriting one uniform buffer between draws, which would have the problem of the Text Rendering chapter: all draws would see the last values. Push constants are made for small values that change from draw to draw.
```
:::
:::d3d12
```quiz
Why does the Direct3D 12 `DrawSprite` combine its matrices in the order scale, translate, rotate, translate, translate – the opposite of the order in learnopengl's code?
- [ ] Because `XMMatrixRotationZ` turns the other way than `glm::rotate`
- [ ] Because Direct3D's y axis points down
- [ ] Because the matrix is transposed when it is stored
- [x] Because DirectXMath multiplies row vectors from the left (`mul(position, model)`), so the matrix written first is applied first: the order of the code is the order things happen
---
glm (and GLSL) multiply column vectors from the right, so the matrix written last touches the vertex first. Both programs build the same transformation; the transpose when it is stored converts DirectXMath's row-vector matrix into HLSL's column-major packing.
```
:::

## Hello sprite

With the sprite renderer we can draw a sprite in two lines. learnopengl draws its own face texture here; the course
draws **its ball** – `textures/ball.png`, a pale green ball on a transparent background, 128 × 128 pixels – with exactly
learnopengl's numbers: at (200, 200), 300 × 400 pixels, rotated 45°, tinted green. In `Init`:

:::opengl
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
```

(with alpha: the ball's corners are transparent), and in `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").ID, glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f, glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
```cpp
        // load textures
        LoadTexture("textures/ball.png", "ball");
```

and in `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").DescriptorSet, glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f, glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::d3d12
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
```

(with alpha: the ball's corners are transparent), and in `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").ID, XMFLOAT2(200.0f, 200.0f), XMFLOAT2(300.0f, 400.0f), 45.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));
```
:::

Now do the task **draw-sprite**: `DrawSprite` – for now only with the translation and the scale; the rotation lines are
the next task –, the texture and the call. Press **Build & run**: **the green ball, stretched into an upright
ellipse**, 300 pixels wide and 400 high, from (200, 200) to (500, 600). It is green only: the ball's own colours times
(0, 1, 0) keep just their green channel. Its transparent corners don't show – blending, switched on in the previous
chapter. The 45° are passed but not used yet.

Now do the task **rotate**: the three lines between the translation and the scale. Press **Build & run**: the ellipse
is **turned 45° clockwise about its centre (350, 400)** – its long axis now runs from the lower left to the upper
right. That is learnopengl's picture with the course's ball.

```quiz
The sprite is drawn at `position` (200, 200) with `size` (300, 400). Where is its centre, the point it rotates about?
- [ ] At (200, 200)
- [ ] At (150, 200)
- [x] At (350, 400): `position` is the top-left corner of the unrotated sprite, and the centre is half the size further
- [ ] At (400, 300), the centre of the window
---
(200 + 300 / 2, 200 + 400 / 2) = (350, 400). Turning about the centre keeps it there, so the turned ellipse stays where the upright one was.
```

## Additional resources

- [Rendering Sprites](https://learnopengl.com/In-Practice/2D-Game/Rendering-Sprites): learnopengl's chapter this
  chapter follows.
- [Transformations](https://learnopengl.com/Getting-started/Transformations): why the matrices are combined in
  reverse order.

:::vulkan
- [Push constants (Vulkan Guide)](https://docs.vulkan.org/guide/latest/push_constants.html): the sprite's matrix and
  colour.
:::
:::d3d12
- [XMMatrixOrthographicOffCenterRH](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmmatrixorthographicoffcenterrh):
  the projection.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  the sprite's matrix and colour.
:::
