# Blending

*Blending* is commonly known as the technique to implement *transparency* within objects. Transparency is all about
objects (or parts of them) not having a solid colour, but having a combination of colours from the object itself and
any other object behind it, with varying intensity. A coloured glass window is a transparent object: the glass has a
colour of its own, but the resulting colour contains the colours of all the objects behind the glass as well. This is
also where the name blending comes from: we *blend* several pixel colours (from different objects) into a single
colour. Transparency thus allows us to see through objects.

Transparent objects can be completely transparent (letting all colours through) or partially transparent (letting
colours through, but also some of its own colours). The amount of transparency of an object is defined by its colour's
**alpha** value. The alpha value is the fourth component of a colour vector that you've probably seen quite often by
now. Up until this chapter we've always kept this fourth component at a value of `1.0`, giving the object 0.0
transparency. An alpha value of `0.0` would result in the object having complete transparency. An alpha value of
`0.5` tells us the object's colour consists of 50% of its own colour and 50% of the colours behind the object.

The textures we've used so far all consisted of 3 colour components (red, green and blue) or had an alpha of 1
everywhere, but some textures also have an embedded alpha channel that contains an alpha value per texel. This alpha
value tells us exactly which parts of the texture have transparency and by how much. The course's `window.png` is
such a texture: red glass with an alpha of about 0.55 – a bit more than half its own colour – in an opaque dark red
frame with a cross in the middle.

We'll first look at how to deal with textures that are either fully transparent or fully opaque, and then at real
blending with the windows. As in the other chapters of this part, everything works the same way in {{api}}; only the
place where you switch it on differs, and the text shows it for your API.

:::opengl
The project starts where the *Depth testing* chapter started: the two marble cubes at (-1, 0, -1) and (2, 0, 0) and
the metal floor, drawn with `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, the camera at (0, 0, 3) looking down -z,
and one shader (`blending.vs`, `blending.fs`) that samples `texture1`. Two new files come with it: `grass.png` and
`window.png` next to `marble.png` and `metal.png`.
:::
:::vulkan
The project starts where the *Depth testing* chapter started: the two marble cubes at (-1, 0, -1) and (2, 0, 0) and
the metal floor, the camera at (0, 0, 3) looking down -z, one pipeline with the depth test (`VK_COMPARE_OP_LESS`), and
all the vertices of the scene in one vertex buffer – the cube is vertices 0..35, the floor 36..41 – from which every
`vkCmdDraw` picks its part with `firstVertex`. Each texture has its own descriptor set (the uniform buffer at
binding 0, the texture at binding 1), and the helpers `loadTexture(...)` and `createTextureSampler(addressMode,
sampler)` load an image and create a sampler. New in `textures/`: `grass.png` and `window.png`.
:::
:::d3d12
The project starts where the *Depth testing* chapter started: the two marble cubes at (-1, 0, -1) and (2, 0, 0) and
the metal floor, the camera at (0, 0, 3) looking down -z, a PSO with the depth function LESS, and the shaders `VSMain`
and `PSMain` in `blending.hlsl`. All vertices are in one vertex buffer – the cube is vertices 0 to 35, the floor 36
to 41 – and each draw picks its part with `DrawInstanced`'s start vertex. Every texture has an SRV in the CBV/SRV heap
(the CBV in slot 0, marble in slot 1, metal in slot 2), and `SetGraphicsRootDescriptorTable(2, …)` points the pixel
shader at one of them before each draw. New next to the other images: `grass.png` and `window.png`.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, build and run the program in your
IDE.

## Discarding fragments

Some effects do not care about partial transparency, but either want to show something or nothing at all based on the
colour value of a texture. Think of grass; to create something like grass with little effort you generally paste a
grass texture onto a 2D quad and place that quad into your scene. However, grass isn't exactly shaped like a 2D
square so you only want to display some parts of the grass texture and ignore the others.

The course's `grass.png` is exactly such a texture: green grass blades, and around them texels with an alpha of `0.0`
(their colour is black). Every texel is either fully opaque (alpha 1) or fully transparent (alpha 0); there's nothing
in between. So when adding vegetation to a scene we don't want to see a square image of grass, but rather only show
the actual grass and see through the rest of the image. We want to *discard* the fragments that show the transparent
parts of the texture and not store those fragments in the colour buffer.

Before we get into that we first need to learn how to load a transparent texture. All our textures are already
loaded with 4 channels, so the alpha values arrive in the shader without extra work:

:::opengl
learnopengl's `loadTexture` picks the format from the number of channels in the file, so a PNG with an alpha channel
is uploaded as `GL_RGBA`:

```cpp
        else if (nrComponents == 4)
            format = GL_RGBA;
```

and the fragment shader's `texture(texture1, TexCoords)` returns all four components.
:::
:::vulkan
`loadTexture` asks stb_image for four channels (`STBI_rgb_alpha`) and stores them in a `VK_FORMAT_R8G8B8A8_UNORM`
image, the same as vulkan-tutorial's texture code; images without an alpha channel simply get alpha 255. So the
fragment shader's `texture(texSampler, fragTexCoord)` returns the grass's alpha as its `a` component.
:::
:::d3d12
`LoadTexture` reads every image as RGBA (4 channels), the layout of `DXGI_FORMAT_R8G8B8A8_UNORM`; images without an
alpha channel simply get alpha 255. So the pixel shader's `texture1.Sample(…)` returns the grass's alpha as its `a`
component.
:::

To add some grass we need a quad to put the texture on: 1 × 1, upright, its left edge at x = 0 and its bottom at
y = -0.5, so that translating it to a position puts its bottom on the floor (the floor is at y = -0.5). We place five
of these quads at the positions learnopengl uses: one just in front of the left cube, one at the right, one close to
the camera, one far behind and one behind the close one.

:::opengl
```cpp
    float transparentVertices[] = {
        // positions         // texture Coords (the image is flipped on load, so v = 1.0 is its top row)
        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,
        0.0f, -0.5f,  0.0f,  0.0f,  0.0f,
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,

        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,
        1.0f,  0.5f,  0.0f,  1.0f,  1.0f
    };
```

(learnopengl loads these images without flipping them and therefore swapped the quad's v coordinates; our
`loadTexture` flips every image with `stbi_set_flip_vertically_on_load(true)`, so the quad keeps v = 1 at its top and
the grass stands upright.)

The quad gets its own VAO, set up exactly like the plane's:

```cpp
    // transparent VAO
    unsigned int transparentVAO, transparentVBO;
    glGenVertexArrays(1, &transparentVAO);
    glGenBuffers(1, &transparentVBO);
    glBindVertexArray(transparentVAO);
    glBindBuffer(GL_ARRAY_BUFFER, transparentVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(transparentVertices), transparentVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glBindVertexArray(0);
```

Then we load the texture and list the positions in a `std::vector` (add `#include <vector>` at the top):

```cpp
    unsigned int transparentTexture = loadTexture("grass.png");

    // transparent vegetation locations
    // --------------------------------
    std::vector<glm::vec3> vegetation
    {
        glm::vec3(-1.5f, 0.0f, -0.48f),
        glm::vec3( 1.5f, 0.0f, 0.51f),
        glm::vec3( 0.0f, 0.0f, 0.7f),
        glm::vec3(-0.3f, 0.0f, -2.3f),
        glm::vec3( 0.5f, 0.0f, -0.6f)
    };
```

Each of the grass objects is rendered as a single quad with the grass texture attached to it. It's not a perfect 3D
representation of grass, but it's a lot more efficient than loading and rendering a large number of complex models.
With a few tricks like adding randomized rotations and scales you can get pretty convincing results with quads.

After the floor, we bind the quad's VAO and the grass texture and draw the quad once per position:

```cpp
        // vegetation
        glBindVertexArray(transparentVAO);
        glBindTexture(GL_TEXTURE_2D, transparentTexture);
        for (unsigned int i = 0; i < vegetation.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, vegetation[i]);
            shader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
```

At the end of `main`, delete the new VAO, VBO and texture together with the others
(`glDeleteVertexArrays(1, &transparentVAO);`, `glDeleteBuffers(1, &transparentVBO);`,
`glDeleteTextures(1, &transparentTexture);`).
:::
:::vulkan
Since all vertices live in one vertex buffer, the quad's six vertices are appended to `vertices`, after the floor –
they become vertices 42..47:

```cpp
    // transparent quad (x 0..1, y -0.5..0.5): vertices 42..47; v = 0 at the top edge, so the image is upright
    {{ 0.0f,  0.5f,  0.0f}, {0.0f, 0.0f}},
    {{ 0.0f, -0.5f,  0.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -0.5f,  0.0f}, {1.0f, 1.0f}},

    {{ 0.0f,  0.5f,  0.0f}, {0.0f, 0.0f}},
    {{ 1.0f, -0.5f,  0.0f}, {1.0f, 1.0f}},
    {{ 1.0f,  0.5f,  0.0f}, {1.0f, 0.0f}}
};
```

These are learnopengl's `transparentVertices` unchanged: stb_image's first row is the top of the image, Vulkan's
v = 0 is the first row, so v = 0 at the quad's top edge keeps the grass upright. Below `vertices`, a global list of
positions:

```cpp
// transparent vegetation locations
const std::vector<glm::vec3> vegetation = {
    glm::vec3(-1.5f, 0.0f, -0.48f),
    glm::vec3( 1.5f, 0.0f,  0.51f),
    glm::vec3( 0.0f, 0.0f,  0.7f),
    glm::vec3(-0.3f, 0.0f, -2.3f),
    glm::vec3( 0.5f, 0.0f, -0.6f)
};
```

The grass texture needs what every texture of this project has: an image, its memory and a view
(`transparentTextureImage`, `transparentTextureImageMemory`, `transparentTextureImageView`), and a descriptor set
`transparentDescriptorSet` with the uniform buffer and the texture. It also gets a sampler of its own,
`transparentSampler` – why, you'll see in a moment. In `initVulkan()`:

```cpp
        loadTexture("textures/grass.png", transparentTextureImage, transparentTextureImageMemory, transparentTextureImageView);
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, textureSampler);
        // clamp to edge: at the top edge, linear filtering would otherwise mix in the opaque bottom row of the image
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, transparentSampler);
```

and after the other two descriptor sets:

```cpp
        createDescriptorSet(transparentTextureImageView, transparentSampler, transparentDescriptorSet);
```

A third set needs room in the pool: `maxSets = 3` and a `descriptorCount` of 3 for both pool sizes. Destroy the new
sampler, view, image and memory in `cleanup()` like the others.

Each of the grass objects is rendered as a single quad with the grass texture attached to it. It's not a perfect 3D
representation of grass, but it's a lot more efficient than loading and rendering a large number of complex models.
With a few tricks like adding randomized rotations and scales you can get pretty convincing results with quads.

In `recordCommandBuffer()`, after the floor, bind the grass's descriptor set and draw the quad once per position:

```cpp
        // vegetation
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &transparentDescriptorSet, 0, nullptr);
        for (unsigned int i = 0; i < vegetation.size(); i++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, vegetation[i]);
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the quad's 6 vertices start at vertex 42
        }
```
:::
:::d3d12
Since all vertices live in one vertex buffer, the quad's six vertices go at the end of `vertices[]`, after the floor
– they become vertices 42 to 47:

```cpp
            // the transparent quad: vertices 42 to 47 - 1 x 1, upright (in the plane z = 0),
            // its left edge at x = 0 and its bottom at y = -0.5. v = 0 is the image's top row.
            { {  0.0f,  0.5f,  0.0f }, { 0.0f, 0.0f } },
            { {  0.0f, -0.5f,  0.0f }, { 0.0f, 1.0f } },
            { {  1.0f, -0.5f,  0.0f }, { 1.0f, 1.0f } },

            { {  0.0f,  0.5f,  0.0f }, { 0.0f, 0.0f } },
            { {  1.0f, -0.5f,  0.0f }, { 1.0f, 1.0f } },
            { {  1.0f,  0.5f,  0.0f }, { 1.0f, 0.0f } }
```

These are learnopengl's `transparentVertices` unchanged: learnopengl loads these images without flipping them, and
Direct3D's v = 0 is the image's top row too.

The grass texture gets heap slot 3: the heap grows to `cbvSrvHeapDesc.NumDescriptors = 4;`, a member
`ComPtr<ID3D12Resource> m_transparentTexture;` holds the texture, and it's loaded like the others:

```cpp
    ComPtr<ID3D12Resource> transparentTextureUploadHeap;
    LoadTexture("grass.png", m_transparentTexture, transparentTextureUploadHeap, 3);
```

In `PopulateCommandList`, next to the GPU handles of the other two textures:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE transparentTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
```

Each of the grass objects is rendered as a single quad with the grass texture attached to it. It's not a perfect 3D
representation of grass, but it's a lot more efficient than loading and rendering a large number of complex models.
With a few tricks like adding randomized rotations and scales you can get pretty convincing results with quads.

After the floor, list the positions (like the earlier chapters' `cubePositions`), point root parameter 2 at the
grass texture and draw the quad once per position:

```cpp
    // vegetation: the transparent texture, the quad's 6 vertices from vertex 42 on, at
    // each position
    XMFLOAT3 vegetation[] =
    {
        XMFLOAT3(-1.5f, 0.0f, -0.48f),
        XMFLOAT3( 1.5f, 0.0f,  0.51f),
        XMFLOAT3( 0.0f, 0.0f,  0.7f),
        XMFLOAT3(-0.3f, 0.0f, -2.3f),
        XMFLOAT3( 0.5f, 0.0f, -0.6f)
    };
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
    for (UINT i = 0; i < _countof(vegetation); i++)
    {
        model = XMMatrixTranslation(vegetation[i].x, vegetation[i].y, vegetation[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(6, 1, 42, 0);
    }
```
:::

Now do the first task, **grass**, then build and run. Five quads stand between and in front of the cubes – the grass
blades are there, but each of them sits on a black square that hides whatever is behind it.

This happens because {{api}} by default does not know what to do with alpha values, nor when to discard them. The
alpha value is just the fourth component of the colour: the shader outputs it, and it is written into the colour
buffer together with red, green and blue. The transparent texels of `grass.png` are black, so black is what we see.

```quiz
Why are the transparent parts of the grass quads drawn as black squares?
- [ ] The texture was loaded without its alpha channel
- [ ] The depth test throws away the colour of transparent texels
- [x] Nothing uses the alpha value yet: the texels' colour (black) is written to the colour buffer like any other colour
- [ ] The quads are drawn before the floor, so the background shows through
---
The alpha arrives in the shader as the fourth component, but neither the shader nor the pipeline does anything with it so far. Transparent texels in `grass.png` are black, and their colour simply replaces what was in the colour buffer.
```

It is up to us to discard the fragments that show the transparent parts. {{shaderLanguage}} gives us the `discard`
command that (once called) ensures the fragment will not be further processed and thus not end up in the colour
buffer – neither its colour nor its depth is written. Thanks to this command we can check whether a fragment has an
alpha value below a certain threshold and if so, discard it as if it had never been processed:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D texture1;

void main()
{
    vec4 texColor = texture(texture1, TexCoords);
    if(texColor.a < 0.1)
        discard;
    FragColor = texColor;
}
```

Here we check if the sampled texture colour contains an alpha value lower than a threshold of `0.1` and if so,
discard the fragment. This fragment shader ensures us that it only renders fragments that are not (almost) completely
transparent. The cubes and the floor have an alpha of 1 everywhere, so they are not affected.
:::
:::vulkan
In `shaders/blending.frag`:

```glsl
void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);
    if (texColor.a < 0.1) {
        discard; // (almost) fully transparent: no colour, no depth for this fragment
    }
    outColor = texColor;
}
```

Here we check if the sampled texture colour contains an alpha value lower than a threshold of `0.1` and if so,
discard the fragment. This fragment shader ensures us that it only renders fragments that are not (almost) completely
transparent. The cubes and the floor use the same shader, but their alpha is 1 everywhere, so they are not affected.
:::
:::d3d12
HLSL has the same `discard` statement. Instead of adding it to `PSMain`, which the cubes and the floor use too, the
transparent objects get a pixel shader of their own in `blending.hlsl`:

```hlsl
// The pixel shader of the transparent objects: it samples with clampSampler and discards
// the pixels that are (almost) fully transparent - nothing is written for them.
float4 PSTransparent(PSInput input) : SV_TARGET
{
    float4 texColor = texture1.Sample(clampSampler, input.texCoord);
    if (texColor.a < 0.1f)
        discard;
    return texColor;
}
```

Here we check if the sampled texture colour contains an alpha value lower than a threshold of `0.1` and if so,
discard the pixel. (HLSL's `clip(texColor.a - 0.1f)` does the same: it discards the pixel when its argument is
negative.) Note the sampler: `clampSampler`, not `wrapSampler` – more on that in a moment.

In Direct3D 12 the pixel shader is part of the pipeline state object, so a different pixel shader means a second
PSO. It's the same description as the first one, with `PSTransparent` compiled and put into `psoDesc.PS`, created
right after `m_pipelineState`:

```cpp
        // The transparent objects: the same description with the pixel shader PSTransparent.
        ComPtr<ID3DBlob> transparentPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"blending.hlsl", nullptr, nullptr, "PSTransparent", "ps_5_0", compileFlags, 0, &transparentPixelShader, nullptr));

        psoDesc.PS = CD3DX12_SHADER_BYTECODE(transparentPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_transparentPipelineState)));
```

with a member `ComPtr<ID3D12PipelineState> m_transparentPipelineState;`. The command list switches to it before the
vegetation is drawn – the cubes and the floor have already been drawn with `m_pipelineState`:

```cpp
    m_commandList->SetPipelineState(m_transparentPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
```
:::

Note that when sampling textures at their borders, {{api}} interpolates the border values with the next repeated
value of the texture (because we set its wrapping parameters to repeat by default). This is usually okay, but since
we're using transparent values, the top of the texture image gets its transparent value interpolated with the bottom
border's solid colour value. The result is then a slightly semi-transparent coloured border you may see wrapped
around your textured quad. To prevent this, set the texture wrapping method to clamp to edge whenever you use alpha
textures that you don't want to repeat:

:::opengl
In OpenGL the wrapping mode belongs to the texture object. `loadTexture` sets it for every texture it loads, so we
make it depend on the format: RGBA images clamp, the others (the floor's texture coordinates go up to 2) keep
repeating:

```cpp
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT); // for this tutorial: use GL_CLAMP_TO_EDGE to prevent semi-transparent borders. Due to interpolation it takes texels from next repeat
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT);
```

Now do the task **discard**: the shader above and the clamped wrapping.
:::
:::vulkan
In Vulkan the wrapping mode belongs to the sampler, not to the image. That's why the grass already got its own
`transparentSampler` with `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` in the previous task, while the cubes and the floor
keep `textureSampler` with `VK_SAMPLER_ADDRESS_MODE_REPEAT` (the floor's texture coordinates go up to 2). Each
descriptor set pairs an image with a sampler, so the grass's set uses the clamping one.

Now do the task **discard**: the shader above.
:::
:::d3d12
In Direct3D 12 the address mode belongs to the sampler, and our sampler is a static sampler – part of the root
signature. The floor needs WRAP (its texture coordinates go up to 2), so the root signature gets a second static
sampler at register `s1` that clamps:

```cpp
        D3D12_STATIC_SAMPLER_DESC samplers[2] = {};
        ...
        // Sampler s1: the same, but texture coordinates outside 0..1 are clamped to the edge.
        // For the transparent textures: with WRAP, filtering at the quad's top edge would mix
        // in the texels of the image's bottom row (a semi-transparent border).
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

(`rootSignatureDesc.Init` already passes `_countof(samplers)`, so both are in the root signature.) In the shader it's
declared next to the first one:

```hlsl
SamplerState wrapSampler : register(s0);
// The second static sampler: register s1, CLAMP (for the transparent textures).
SamplerState clampSampler : register(s1);
```

Now do the task **discard**: the sampler, `PSTransparent`, the second PSO and the `SetPipelineState` call.
:::

Build and run: only the grass blades are left. Where the black squares were, you see the cubes, the floor and the
background again, and there's no thin line along the top of the quads.

```quiz
Why do the grass quads need a sampler mode that clamps to the edge instead of repeating?
- [ ] Repeating textures cannot have an alpha channel
- [x] With repeat, linear filtering at the quad's top edge mixes in texels from the image's opposite (bottom) edge, which are opaque, and a semi-transparent line appears
- [ ] Clamping makes the texture smaller, so fewer fragments are discarded
---
At the very edge of the texture the filter averages neighbouring texels, and with repeat the neighbour of the top row is the bottom row – the grass's opaque roots. Clamping repeats the edge texel itself instead, which is transparent.
```

## Blending

While discarding fragments is great and all, it doesn't give us the flexibility to render semi-transparent images;
we either render the fragment or completely discard it. To render images with different levels of transparency we
have to enable *blending*.

Blending happens after the fragment shader: the colour the shader outputs – the *source* colour – is combined with
the colour that is already in the colour buffer at that position – the *destination* colour. This is done with the
following equation:

```text
C_result = C_source * F_source + C_destination * F_destination
```

- `C_source`: the source colour vector. This is the colour output of the fragment shader.
- `C_destination`: the destination colour vector. This is the colour vector that is currently stored in the colour
  buffer.
- `F_source`: the source factor value. Sets the impact of the alpha value on the source colour.
- `F_destination`: the destination factor value. Sets the impact of the alpha value on the destination colour.

After the fragment shader has run and all the tests have passed, this blend equation is let loose on the fragment's
colour output and with whatever is currently in the colour buffer. The source and destination colours are set by the
GPU, but the source and destination factors can be set to a value of our choosing.

Let's start with a simple example: we have two squares where we want to draw the semi-transparent green square on top
of the red square. The red square will be the destination colour (and thus should be first in the colour buffer) and
we are now going to draw the green square over the red square. The green square has a colour of (0.0, 1.0, 0.0) with
an alpha of 0.6, the red square is (1.0, 0.0, 0.0).

The question then arises: what do we set the factor values to? Well, we at least want to multiply the green square
with its alpha value so we want to set `F_source` equal to the alpha value of the source colour vector, which is
`0.6`. Then it makes sense to let the destination square have a contribution equal to the remainder of the alpha
value. If the green square contributes 60% to the final colour we want the red square to contribute 40% of the final
colour, e.g. `1.0 - 0.6`. So we set `F_destination` equal to one minus the alpha value of the source colour vector.
The equation thus becomes:

```text
C_result = (0.0, 1.0, 0.0) * 0.6 + (1.0, 0.0, 0.0) * (1 - 0.6) = (0.4, 0.6, 0.0)
```

The result is that the combined square fragments contain a colour that is 60% green and 40% red: a dirty, brownish
colour.

```quiz
With `F_source` = source alpha and `F_destination` = 1 − source alpha, a white fragment (1.0, 1.0, 1.0) with alpha 0.25 is drawn over a black colour buffer (0.0, 0.0, 0.0). What colour ends up in the colour buffer?
- [ ] (1.0, 1.0, 1.0)
- [ ] (0.75, 0.75, 0.75)
- [ ] (0.0, 0.0, 0.0)
- [x] (0.25, 0.25, 0.25)
---
`(1, 1, 1) * 0.25 + (0, 0, 0) * (1 - 0.25) = (0.25, 0.25, 0.25)`: a quarter of the white, three quarters of the black.
```

The resulting colour is then stored in the colour buffer, replacing the previous colour. So how do we actually tell
{{api}} to use factors like these?

:::opengl
Blending is part of OpenGL's global state. It's off by default, so we first enable it:

```cpp
glEnable(GL_BLEND);
```

The `glBlendFunc(GLenum sfactor, GLenum dfactor)` function expects two parameters that set the option for the
source and destination factor. OpenGL defined quite a few options for us to set, of which we'll list the most common
ones below. Note that the constant colour vector `C_constant` can be separately set via the `glBlendColor` function.

| Option | Value |
| --- | --- |
| `GL_ZERO` | Factor is equal to 0. |
| `GL_ONE` | Factor is equal to 1. |
| `GL_SRC_COLOR` | Factor is equal to the source colour vector `C_source`. |
| `GL_ONE_MINUS_SRC_COLOR` | Factor is equal to 1 minus the source colour vector: 1 − `C_source`. |
| `GL_DST_COLOR` | Factor is equal to the destination colour vector `C_destination`. |
| `GL_ONE_MINUS_DST_COLOR` | Factor is equal to 1 minus the destination colour vector: 1 − `C_destination`. |
| `GL_SRC_ALPHA` | Factor is equal to the alpha component of the source colour vector. |
| `GL_ONE_MINUS_SRC_ALPHA` | Factor is equal to 1 − alpha of the source colour vector. |
| `GL_DST_ALPHA` | Factor is equal to the alpha component of the destination colour vector. |
| `GL_ONE_MINUS_DST_ALPHA` | Factor is equal to 1 − alpha of the destination colour vector. |
| `GL_CONSTANT_COLOR` | Factor is equal to the constant colour vector `C_constant`. |
| `GL_ONE_MINUS_CONSTANT_COLOR` | Factor is equal to 1 − the constant colour vector. |
| `GL_CONSTANT_ALPHA` | Factor is equal to the alpha component of the constant colour vector. |
| `GL_ONE_MINUS_CONSTANT_ALPHA` | Factor is equal to 1 − alpha of the constant colour vector. |

To get the blending result of our little two square example, we want to take the alpha of the source colour vector
for the source factor and 1 − alpha of the same colour vector for the destination factor. This translates to
`glBlendFunc` as follows:

```cpp
glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

It is also possible to set different options for the RGB and alpha channel individually using
`glBlendFuncSeparate`:

```cpp
glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ZERO);
```

This function sets the RGB components as we've set them previously, but only lets the resulting alpha component be
influenced by the source's alpha value.

OpenGL gives us even more flexibility by allowing us to change the operator between the source and destination part
of the equation. Right now, the source and destination components are added together, but we could also subtract
them if we want. `glBlendEquation(GLenum mode)` allows us to set this operation and has 5 possible options:

- `GL_FUNC_ADD`: the default, adds both colours to each other: `C_result = Src + Dst`.
- `GL_FUNC_SUBTRACT`: subtracts both colours from each other: `C_result = Src − Dst`.
- `GL_FUNC_REVERSE_SUBTRACT`: subtracts both colours, but reverses order: `C_result = Dst − Src`.
- `GL_MIN`: takes the component-wise minimum of both colours: `C_result = min(Dst, Src)`.
- `GL_MAX`: takes the component-wise maximum of both colours: `C_result = max(Dst, Src)`.

Usually we can simply omit a call to `glBlendEquation` because `GL_FUNC_ADD` is the preferred blending equation for
most operations, but if you're really trying your best to break the mainstream circuit any of the other equations
could suit your needs.

Like the depth test, blending is global state: once enabled, it applies to every draw call until you change it. The
cubes and the floor are blended too – but their alpha is 1, so `src * 1 + dst * 0` is simply their own colour.
:::
:::vulkan
In Vulkan blending is not global state but part of the graphics pipeline, in the *color blending* stage you filled in
when you created your first pipeline (vulkan-tutorial's *Fixed functions* chapter). Per colour attachment, a
`VkPipelineColorBlendAttachmentState` decides what happens; for every fragment it computes:

```text
if (blendEnable) {
    finalColor.rgb = (srcColorBlendFactor * newColor.rgb) <colorBlendOp> (dstColorBlendFactor * oldColor.rgb);
    finalColor.a = (srcAlphaBlendFactor * newColor.a) <alphaBlendOp> (dstAlphaBlendFactor * oldColor.a);
} else {
    finalColor = newColor;
}
```

`newColor` is the source, `oldColor` the destination. Up to now `blendEnable` was `VK_FALSE`, so the new colour just
replaced the old one. The factors are `VkBlendFactor` values; the most common ones:

| Option | Value |
| --- | --- |
| `VK_BLEND_FACTOR_ZERO` | Factor is equal to 0. |
| `VK_BLEND_FACTOR_ONE` | Factor is equal to 1. |
| `VK_BLEND_FACTOR_SRC_COLOR` | Factor is equal to the source colour vector `C_source`. |
| `VK_BLEND_FACTOR_ONE_MINUS_SRC_COLOR` | Factor is equal to 1 − `C_source`. |
| `VK_BLEND_FACTOR_DST_COLOR` | Factor is equal to the destination colour vector `C_destination`. |
| `VK_BLEND_FACTOR_ONE_MINUS_DST_COLOR` | Factor is equal to 1 − `C_destination`. |
| `VK_BLEND_FACTOR_SRC_ALPHA` | Factor is equal to the alpha component of the source colour. |
| `VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA` | Factor is equal to 1 − alpha of the source colour. |
| `VK_BLEND_FACTOR_DST_ALPHA` | Factor is equal to the alpha component of the destination colour. |
| `VK_BLEND_FACTOR_ONE_MINUS_DST_ALPHA` | Factor is equal to 1 − alpha of the destination colour. |
| `VK_BLEND_FACTOR_CONSTANT_COLOR` | Factor is equal to the constant colour `C_constant`. |
| `VK_BLEND_FACTOR_ONE_MINUS_CONSTANT_COLOR` | Factor is equal to 1 − the constant colour. |
| `VK_BLEND_FACTOR_CONSTANT_ALPHA` | Factor is equal to the alpha component of the constant colour. |
| `VK_BLEND_FACTOR_ONE_MINUS_CONSTANT_ALPHA` | Factor is equal to 1 − alpha of the constant colour. |

The constant colour is `blendConstants` in `VkPipelineColorBlendStateCreateInfo` (or, with
`VK_DYNAMIC_STATE_BLEND_CONSTANTS`, set while recording with `vkCmdSetBlendConstants`). The operators are
`VK_BLEND_OP_ADD`, `VK_BLEND_OP_SUBTRACT`, `VK_BLEND_OP_REVERSE_SUBTRACT`, `VK_BLEND_OP_MIN` and `VK_BLEND_OP_MAX` –
`ADD` is what almost every effect uses.

Vulkan always takes separate factors for the colour and the alpha channel (OpenGL's `glBlendFuncSeparate`). For our
two square example – the source's alpha for the source, one minus that for the destination – this is
vulkan-tutorial's alpha blending setup, in `createPipeline()`:

```cpp
        // alpha blending: colour = src.rgb * src.a + dst.rgb * (1 - src.a)
        colorBlendAttachment.blendEnable = VK_TRUE;
        colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
        colorBlendAttachment.dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA;
        colorBlendAttachment.colorBlendOp = VK_BLEND_OP_ADD;
        colorBlendAttachment.srcAlphaBlendFactor = VK_BLEND_FACTOR_ONE;
        colorBlendAttachment.dstAlphaBlendFactor = VK_BLEND_FACTOR_ZERO;
        colorBlendAttachment.alphaBlendOp = VK_BLEND_OP_ADD;
```

The colour channels are mixed as in the example; the alpha channel simply takes the source's alpha (`1 * src.a + 0`).
It doesn't matter for the picture, since the window shows only the RGB channels.

Our project has one pipeline for everything, so the cubes and the floor are blended too – but their alpha is 1, so
`src * 1 + dst * 0` is simply their own colour. (You could also create a second pipeline with blending for the
transparent objects only; a pipeline is fixed once created, so state like this can't be switched on and off between
draws as in OpenGL, except for the parts you declare dynamic.)
:::
:::d3d12
In Direct3D 12 blending is part of the pipeline state object, in the output merger's blend state
(`psoDesc.BlendState`). Per render target, a `D3D12_RENDER_TARGET_BLEND_DESC` in `BlendState.RenderTarget[0]`
decides what happens:

```text
result.rgb = (SrcBlend * source.rgb) <BlendOp> (DestBlend * destination.rgb)
result.a   = (SrcBlendAlpha * source.a) <BlendOpAlpha> (DestBlendAlpha * destination.a)
```

`CD3DX12_BLEND_DESC(D3D12_DEFAULT)` sets `BlendEnable = FALSE` (and `SrcBlend = ONE`, `DestBlend = ZERO`), so up to now
the pixel shader's colour simply replaced the render target's. The factors are `D3D12_BLEND` values; Direct3D calls
"one minus" *INV*:

| Option | Value |
| --- | --- |
| `D3D12_BLEND_ZERO` | Factor is equal to 0. |
| `D3D12_BLEND_ONE` | Factor is equal to 1. |
| `D3D12_BLEND_SRC_COLOR` | Factor is equal to the source colour vector `C_source`. |
| `D3D12_BLEND_INV_SRC_COLOR` | Factor is equal to 1 − `C_source`. |
| `D3D12_BLEND_DEST_COLOR` | Factor is equal to the destination colour vector `C_destination`. |
| `D3D12_BLEND_INV_DEST_COLOR` | Factor is equal to 1 − `C_destination`. |
| `D3D12_BLEND_SRC_ALPHA` | Factor is equal to the alpha component of the source colour. |
| `D3D12_BLEND_INV_SRC_ALPHA` | Factor is equal to 1 − alpha of the source colour. |
| `D3D12_BLEND_DEST_ALPHA` | Factor is equal to the alpha component of the destination colour. |
| `D3D12_BLEND_INV_DEST_ALPHA` | Factor is equal to 1 − alpha of the destination colour. |
| `D3D12_BLEND_BLEND_FACTOR` | Factor is equal to the constant blend factor. |
| `D3D12_BLEND_INV_BLEND_FACTOR` | Factor is equal to 1 − the constant blend factor. |

The constant blend factor is not part of the PSO: you set it on the command list with `OMSetBlendFactor`. For
`SrcBlendAlpha` and `DestBlendAlpha` the options ending in `_COLOR` are not allowed. The operators are
`D3D12_BLEND_OP_ADD`, `D3D12_BLEND_OP_SUBTRACT`, `D3D12_BLEND_OP_REV_SUBTRACT`, `D3D12_BLEND_OP_MIN` and
`D3D12_BLEND_OP_MAX` – `ADD` is what almost every effect uses.

For our two square example – the source's alpha for the source, one minus that for the destination – we set the
blend state of the transparent PSO before it is created. OpenGL's `glBlendFunc` sets the same factors for the colour
and the alpha channel, so we do that too:

```cpp
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(transparentPixelShader.Get());
        // Blending: result = source colour * source alpha + destination colour * (1 - source
        // alpha) - the pixel's colour mixed with the colour already in the render target.
        // (OpenGL's glBlendFunc sets the factors of the colour and of the alpha channel.)
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[0].SrcBlendAlpha = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlendAlpha = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_transparentPipelineState)));
```

Since we already have a second PSO for the transparent objects, blending is switched on only there. In OpenGL,
`glEnable(GL_BLEND)` is global and also applies to the cubes and the floor – which makes no difference, since their
alpha is 1 and `src * 1 + dst * 0` is simply their own colour.
:::

:::opengl
```quiz
The project calls `glEnable(GL_BLEND)` and `glBlendFunc` once, before the render loop. Why do the opaque cubes and the floor still look exactly as before?
- [ ] OpenGL only blends draws that use a texture with an alpha channel
- [ ] `glBlendFunc` only takes effect for the draw call right after it
- [x] Blending is global state and applies to them too, but their alpha is 1: `src * 1 + dst * 0` is their own colour
---
OpenGL's state machine keeps blending on for every following draw call. With alpha 1 the source factor is 1 and the destination factor 0, so blending changes nothing for opaque surfaces.
```
:::
:::vulkan
```quiz
The cubes, the floor and the windows are all drawn with the same pipeline, which has `blendEnable = VK_TRUE`. Why do the opaque cubes and the floor still look exactly as before?
- [ ] Vulkan skips blending for draws that bind a descriptor set without an alpha channel
- [ ] `vkCmdBindDescriptorSets` resets the blend state for each object
- [x] They are blended too, but their alpha is 1: `src * 1 + dst * 0` is their own colour
---
The blend state belongs to the pipeline and applies to every draw recorded with it. With alpha 1 the source factor is 1 and the destination factor 0, so blending changes nothing for opaque surfaces.
```
:::
:::d3d12
```quiz
Why does the project turn on blending only in `m_transparentPipelineState`, and what would change if the cubes' PSO blended too?
- [ ] It must: a PSO with blending cannot have a depth test
- [ ] The cubes would become semi-transparent
- [x] The blend state is part of the PSO, and the transparent objects already have their own; for the cubes nothing would change, since their alpha is 1 and `src * 1 + dst * 0` is their own colour
---
Unlike OpenGL's global `glEnable(GL_BLEND)`, Direct3D 12 fixes the blend state when the PSO is created. Turning it on where it's needed is the natural choice, but blending opaque pixels with these factors gives the same result.
```
:::

## Rendering semi-transparent textures

Now that we know how {{api}} works with regards to blending it's time to put our knowledge to the test by adding
several semi-transparent windows. We'll be using the same scene as in the start of this chapter, but instead of
rendering a grass texture we're now going to use the transparent window texture `window.png`.

:::opengl
First, during initialization we enable blending and set the appropriate blending function, next to the depth test:

```cpp
    glDepthFunc(GL_LESS); // pass when the fragment is closer than the stored depth (OpenGL's default)
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA); // result = src * src.alpha + dst * (1 - src.alpha)
```

Then we load `window.png` instead of `grass.png` and, since they are windows now, rename the vector to `windows`
(and its comment to `// transparent window locations`); the draw loop (`// windows`) iterates over `windows`.

Since we enabled blending there is no need to discard fragments, so we could reset the fragment shader to its
original version. In the project the `discard` stays: no texel of the window is below 0.1, so it never triggers.
:::
:::vulkan
In `createPipeline()`, replace `colorBlendAttachment.blendEnable = VK_FALSE;` with the alpha blending setup from
above. Then load `"textures/window.png"` instead of `"textures/grass.png"` and, since they are windows now, rename
`vegetation` to `windows` (with the comment `// transparent window locations`); the draw loop (`// windows`)
iterates over `windows`.

Since we enabled blending there is no need to discard fragments, so we could reset the fragment shader to its
original version. In the project the `discard` stays: no texel of the window is below 0.1, so it never triggers.
:::
:::d3d12
Set the blend state of `m_transparentPipelineState` as shown above. Then load `window.png` instead of `grass.png` and,
since they are windows now, rename `vegetation` to `windows`; the loop runs over `_countof(windows)`.

Since we enabled blending there is no need to discard pixels, so we could go back to a pixel shader without
`discard`. In the project `PSTransparent` keeps it: no texel of the window is below 0.1, so it never triggers – and the
clamping sampler is still what the windows need.
:::

Now do the task **blend**, then build and run. Five red tinted windows stand in the scene: the cube, the floor and the
background show through the glass, darker and redder, while the frame and its cross are opaque. Over the background, the
glass's colour is mixed with the dark grey of the clear colour; over the marble it's much brighter.

If you take a closer look however, you may notice something is off. Look at the nearest window, in front of the
middle: there is a second window behind it, partly covered by it (at (0.5, 0, -0.6)). Through the near window's glass
you see the floor and the background – but not the second window. The transparent parts of the first window occlude
the windows behind it. Why is this happening?

The reason for this is that depth testing works a bit tricky combined with blending. When writing to the depth
buffer, the depth test does not care if the fragment has transparency or not, so the transparent parts are written to
the depth buffer as any other value. The result is that the background windows are tested on depth as any other
opaque object would be, ignoring transparency. Even though the transparent part should show the windows behind it,
the depth test discards them.

In our list, the nearest window, (0, 0, 0.7), is the third one, and the one behind it, (0.5, 0, -0.6), the fifth. So
the near window is drawn first: its glass is blended with the floor and the background and its depth is stored. When
the far window comes, every one of its fragments behind the glass fails the depth test – it is farther away than the
stored depth – and is thrown away before it can be blended.

```quiz
Why is the window at (0.5, 0, -0.6) missing behind the glass of the nearest window?
- [ ] Blending only mixes a fragment with the clear colour, not with other windows
- [x] The nearest window is drawn first and writes its depth; the farther window's fragments then fail the depth test and never reach blending
- [ ] The `discard` in the shader throws away fragments that lie behind glass
- [ ] Two blended surfaces cancel each other out
---
The depth test doesn't know about transparency: the glass stores its depth like an opaque surface. Anything drawn later behind it is rejected – so the order in which we draw transparent objects matters.
```

So we cannot simply render the windows however we want and expect the depth buffer to solve all our issues for us;
this is also where blending gets a little nasty. To make sure the windows show the windows behind them, we have to
draw the windows in the background first. This means we have to manually sort the windows from furthest to nearest
and draw them accordingly ourselves.

Note that with fully transparent objects like the grass leaves we have the option to discard the transparent
fragments instead of blending them, saving us a few of these headaches (no depth issues).

## Don't break the order

To make blending work for multiple objects we have to draw the most distant object first and the closest object last.
The normal non-blended objects can still be drawn as normal using the depth buffer so they don't have to be sorted.
We do have to make sure they are drawn first before drawing the (sorted) transparent objects. When drawing a scene
with non-transparent and transparent objects the general outline is usually as follows:

1. Draw all opaque objects first.
2. Sort all the transparent objects.
3. Draw all the transparent objects in sorted order.

One way of sorting the transparent objects is to retrieve the distance of an object from the viewer's perspective.
This can be achieved by taking the distance between the camera's position vector and the object's position vector.
We then store this distance together with the corresponding position vector in a `map` data structure from the C++
standard library (add `#include <map>`). A `map` automatically sorts its values based on its keys, so once we've added
all positions with their distance as the key they're automatically sorted on their distance value:

:::opengl
```cpp
        // sort the transparent windows before rendering
        // ---------------------------------------------
        std::map<float, glm::vec3> sorted;
        for (unsigned int i = 0; i < windows.size(); i++)
        {
            float distance = glm::length(cameraPos - windows[i]);
            sorted[distance] = windows[i];
        }
```

This goes into the render loop, right after `processInput(window);` – the camera can move, so the distances have to
be computed anew every frame.
:::
:::vulkan
```cpp
        // sort the transparent windows before rendering
        std::map<float, glm::vec3> sorted;
        for (unsigned int i = 0; i < windows.size(); i++) {
            float distance = glm::length(cameraPos - windows[i]);
            sorted[distance] = windows[i];
        }
```

This goes into `recordCommandBuffer()`, right before the windows are drawn. The command buffer is recorded anew every
frame, so the sort follows the camera when it moves.
:::
:::d3d12
```cpp
    // sort the transparent windows before rendering: a std::map keeps its keys (the
    // distances to the camera) in order
    std::map<float, XMFLOAT3> sorted;
    for (UINT i = 0; i < _countof(windows); i++)
    {
        float distance = XMVectorGetX(XMVector3Length(cameraPos - XMLoadFloat3(&windows[i])));
        sorted[distance] = windows[i];
    }
```

`cameraPos` is an `XMVECTOR`, so the position is loaded into one with `XMLoadFloat3`; `XMVector3Length` returns the
length in every component of a vector, and `XMVectorGetX` takes it out. This goes into `PopulateCommandList`, right
after the `windows` array – the command list is recorded anew every frame, so the sort follows the camera when it
moves.
:::

The result is a sorted container object that stores each of the window positions based on their distance key value
from lowest to highest distance.

Then, this time when rendering, we take each of the map's values in reverse order (from farthest to nearest) and then
draw the corresponding windows in correct order:

:::opengl
```cpp
        // windows (from furthest to nearest)
        glBindVertexArray(transparentVAO);
        glBindTexture(GL_TEXTURE_2D, transparentTexture);
        for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, it->second);
            shader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
```
:::
:::vulkan
```cpp
        // windows (from furthest to nearest)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &transparentDescriptorSet, 0, nullptr);
        for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, it->second);
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the quad's 6 vertices start at vertex 42
        }
```
:::
:::d3d12
```cpp
    // windows (from furthest to nearest)
    m_commandList->SetPipelineState(m_transparentPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
    for (std::map<float, XMFLOAT3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
    {
        model = XMMatrixTranslation(it->second.x, it->second.y, it->second.z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(6, 1, 42, 0);
    }
```
:::

We take a reverse iterator from the `map` to iterate through each of the items in reverse order and then translate
each window quad to the corresponding window position. This relatively simple approach to sorting transparent objects
fixes the previous problem. From the starting position the order is (-0.3, 0, -2.3), (-1.5, 0, -0.48),
(0.5, 0, -0.6), (1.5, 0, 0.51) and finally (0, 0, 0.7).

Now do the last task, **sort**, then build and run. The window behind the nearest one now shows through its glass: where
they overlap you look through two layers of glass, and the colour there is a deeper red than through one layer. Because
the sort runs every frame, the order stays right when the camera moves.

```quiz
Why does the outline above draw all opaque objects before the sorted transparent ones?
- [ ] Opaque objects have to be sorted from front to back as well, and that sort must run first
- [ ] Blending is only possible after the depth buffer has been cleared
- [x] A transparent fragment is blended with what is already in the colour buffer, so everything that should be visible behind it has to be there first
---
Blending can only mix in colours that are already in the colour buffer. If an opaque cube were drawn after a window in front of it, the window's fragments would have been blended with the background, and the cube's fragments – behind the window – would then fail the depth test.
```

While this approach of sorting the objects by their distance works well for this specific scenario, it doesn't take
rotations, scaling or any other transformation into account and weirdly shaped objects need a different metric than
simply a position vector. Note also that a `map` keeps one value per key: two windows at exactly the same distance
would end up as one.

Sorting objects in your scene is a difficult feat that depends greatly on the type of scene you have, let alone the
extra processing power it costs. Completely rendering a scene with solid and transparent objects isn't all that easy.
There are more advanced techniques like *order independent transparency* but these are out of the scope of this
chapter. For now you'll have to live with normally blending your objects, but if you're careful and know the
limitations you can get pretty decent blending implementations.

In the next chapter we'll look at one more piece of fixed-function state: *face culling*, which skips the triangles
that face away from the camera.
