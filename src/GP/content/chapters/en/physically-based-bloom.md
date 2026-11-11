# Physically Based Bloom

The *Bloom* chapter of the *Advanced Lighting* part made bright light glow: a bright pass wrote every fragment brighter
than 1.0 into a second colour buffer, ten passes of a Gaussian blur smeared it, and the final pass added the blur to the
scene before tone mapping. It works, and it is how many games did bloom for years. But it has weaknesses you see as
soon as you look closely:

- **The hard threshold.** A colour just below 1.0 doesn't glow at all, one just above glows fully. A surface whose
  brightness crosses the threshold – a light that fades, a highlight that moves – switches its glow on and off.
- **A small, blocky glow.** Learnopengl's 9-tap kernel, repeated five times in each direction, reaches a few dozen
  pixels. A wider glow needs more passes – each one a full-screen pass at full resolution – and the blur's shape
  becomes visible as blocks and lines around small bright spots.
- **Flicker.** A tiny, very bright detail – a specular highlight one pixel wide – is in the bright buffer in one frame
  and not in the next, as the camera moves. Its glow, many pixels wide, blinks.
- **Cost.** Twenty full-resolution passes for one effect.

learnopengl's guest article *Physically Based Bloom* replaces the technique with the one Jorge Jimenez presented for
*Call of Duty: Advanced Warfare* at SIGGRAPH 2014, in the course *Advances in Real-Time Rendering*: blur by
**downsampling** the HDR image step by step into ever smaller textures, then **upsampling** it back up and adding the
levels together. The small textures make a wide blur cheap – a few texels of blur in a 12 × 9 texture cover a large part
of the screen – and the filters are chosen so that the result is smooth and stable. And it drops the threshold: instead
of adding only what is brighter than 1.0, it mixes a small fraction of the *whole* blurred image into the scene. That is
what "physically based" refers to here: a real lens scatters a little of *all* light that passes through it, not only of
the light above some brightness, and bright things glow more simply because there is more of their light to scatter.

Like the earlier bloom, the technique is a chain of full-screen passes over textures, and it works the same way in every
API. This chapter shows how {{api}} renders into a chain of smaller and smaller targets.

## The project

The scene is the *Bloom* chapter's – the wooden floor, six containers and four light cubes, the camera at (0, 0, 5) –
rendered into a floating-point colour buffer and tone-mapped with the exposure curve, **without** the bright pass and
the blur: the start of the *Bloom* chapter, a scene with hard-edged light cubes. Following the article, the new bloom
works on the whole HDR image. (learnopengl's demo code still hands its thresholded bright buffer to the new bloom
renderer; the article's text and the course use the scene itself.)

learnopengl writes the bloom as two classes, `bloomFBO` and `BloomRenderer`. As in the *In Practice* part, the course
writes them as structs and free functions with learnopengl's names: a `BloomMip` (the size of a level and its texture), a
`BloomFBO` (the chain of levels), and the functions `InitBloomFBO`, `RenderDownsamples` and `RenderUpsamples`;
`RenderBloomTexture`'s few steps are written out where the frame is drawn.

:::opengl
`main.cpp` renders the scene into `hdrFBO` – the `GL_RGBA16F` texture `colorBuffer` and a depth renderbuffer – and draws
`colorBuffer` on the screen quad with `bloom_final.vs` / `.fs`. `downsample.vs/.fs` and `upsample.vs/.fs`
(learnopengl's `6.new_downsample` and `6.new_upsample`) are there with their uniforms; their `main`s are TODOs.
:::
:::vulkan
`recordCommandBuffer()` renders the scene into the floating-point image of the *Bloom* chapter (`hdrRenderPass`) and draws
it on the screen quad (vertices 36–41) with `bloomFinalPipeline`. The push constants and the descriptor sets are the
*Bloom* chapter's; `shaders/downsample.frag` and `upsample.frag` have their inputs, their `main`s are TODOs.
:::
:::d3d12
`PopulateCommandList` renders the scene into the floating-point colour buffer of the *Bloom* chapter (CBV/SRV heap slot 3)
and draws it on the screen quad (vertices 36–41) with the final pipeline state. `downsample.hlsl` and `upsample.hlsl`
have their inputs; their pixel shaders are TODOs.
:::

The `// TODO:` comments mark where your code goes. Build and run the program in your IDE: the scene with hard light
cubes and a black background right next to them.

## The mip chain

The bloom works on a chain of textures, each half the size of the one before: a *mip chain*, like the mip levels of a
texture. learnopengl starts at half the window and uses six levels – for an 800 × 600 window:

```text
level 0: 400 × 300    level 1: 200 × 150    level 2: 100 × 75
level 3:  50 × 37     level 4:  25 × 18     level 5:  12 × 9
```

(The integer halving rounds down: 75 / 2 = 37.) Every level holds HDR colour, so it needs a floating-point format. But it
needs no alpha, and the bloom doesn't need full 16-bit precision: learnopengl picks **R11G11B10 float** – three small
floating-point numbers packed into 32 bits, 11 bits each for red and green, 10 for blue, no sign and no alpha. That is
half the memory and bandwidth of RGBA16F, and the bloom passes are mostly bandwidth: each one reads and writes a whole
level. All levels use linear filtering – the filters below rely on it – and clamp to the edge, so that a sample just
outside the texture repeats the border instead of wrapping around to the other side.

learnopengl's chain is **separate textures**, one per level, rendered through one framebuffer whose colour attachment
is switched to the level being written. A single texture with six mip levels would work too (you would render into one
level while sampling another); the course follows learnopengl's separate textures in every API.

:::opengl
```cpp
struct BloomMip
{
    glm::vec2 size;
    glm::ivec2 intSize;
    unsigned int texture;
};

// learnopengl's bloomFBO class as a struct: one framebuffer that renders into the textures of the mip chain
struct BloomFBO
{
    unsigned int FBO = 0;
    std::vector<BloomMip> mipChain;
};
```

`InitBloomFBO` creates the framebuffer and the six textures:

```cpp
    glm::vec2 mipSize((float)windowWidth, (float)windowHeight);
    glm::ivec2 mipIntSize((int)windowWidth, (int)windowHeight);

    for (unsigned int i = 0; i < mipChainLength; i++)
    {
        BloomMip mip;

        mipSize *= 0.5f;
        mipIntSize /= 2;
        mip.size = mipSize;
        mip.intSize = mipIntSize;

        glGenTextures(1, &mip.texture);
        glBindTexture(GL_TEXTURE_2D, mip.texture);
        // we are downscaling an HDR color buffer, so we need a float texture format
        glTexImage2D(GL_TEXTURE_2D, 0, GL_R11F_G11F_B10F, (int)mipSize.x, (int)mipSize.y, 0, GL_RGB, GL_FLOAT, nullptr);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        bloomFBO.mipChain.push_back(mip);
    }

    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, bloomFBO.mipChain[0].texture, 0);
```

followed by `glDrawBuffers` with one attachment and the completeness check (the framebuffer is checked with level 0
attached; the passes will attach the others). `DestroyBloomFBO` deletes the textures and the framebuffer. In `main`:
`BloomFBO bloomFBO;`, `InitBloomFBO(bloomFBO, SCR_WIDTH, SCR_HEIGHT, 6)`, and `DestroyBloomFBO(bloomFBO)` at the end.
```quiz
learnopengl renders all six levels through one framebuffer. What changes from one pass to the next?
- [ ] Nothing: the framebuffer has six colour attachments, one per level
- [x] The texture attached as `GL_COLOR_ATTACHMENT0` (`glFramebufferTexture2D`) and the viewport, set to the level's size
- [ ] The framebuffer's size, with `glRenderbufferStorage`
- [ ] Only the shader's `srcResolution`: OpenGL scales the output to the attachment's size by itself
---
An OpenGL framebuffer's attachments can be changed at any time. Without the matching `glViewport`, the quad would cover only part of a larger level or spill over a smaller one.
```
:::
:::vulkan
A Vulkan framebuffer's attachments are fixed when it is created, so learnopengl's one framebuffer with a switched
attachment becomes **one framebuffer per level**. Each level also gets a descriptor set, so that the next pass can read
it:

```cpp
struct BloomMip {
    glm::vec2 size;
    glm::ivec2 intSize;
    VkImage image;
    VkDeviceMemory memory;
    VkImageView view;
    VkFramebuffer framebuffer;
    VkDescriptorSet descriptorSet;
};
```

The format is `VK_FORMAT_B10G11R11_UFLOAT_PACK32` – learnopengl's `GL_R11F_G11F_B10F`, with the channels named from the
most significant bits down – and each image is created with colour-attachment and sampled usage:

```cpp
            createImage(static_cast<uint32_t>(mipSize.x), static_cast<uint32_t>(mipSize.y), VK_FORMAT_B10G11R11_UFLOAT_PACK32, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, mip.image, mip.memory);
            mip.view = createImageView(mip.image, VK_FORMAT_B10G11R11_UFLOAT_PACK32, VK_IMAGE_ASPECT_COLOR_BIT);
```

`BloomFBO` holds the chain and **two render passes** for the levels: `renderPass` for the downsample – `loadOp
DONT_CARE`, because the screen quad covers every pixel of the level, and final layout `SHADER_READ_ONLY_OPTIMAL` – and
`upsampleRenderPass` for the upsample – `loadOp LOAD`, because the upsample *adds* to what the level holds, with initial
and final layout `SHADER_READ_ONLY_OPTIMAL` (the upsample task adds this second one). The two render passes are compatible (same attachment format and sample
count), so the same framebuffers serve both. Their subpass dependencies make each pass wait for the colour writes of the
one before it; the layout changes happen at the render pass boundaries, so no explicit barriers are needed. The levels are
sampled through the *Bloom* chapter's `colorBufferSampler` (linear, clamp to edge). `InitBloomFBO` and `DestroyBloomFBO`
are member functions of the application, because they need the device and its helpers.
```quiz
Why does every level of the Vulkan chain have its own `VkFramebuffer`, where learnopengl uses one framebuffer object?
- [ ] Because a Vulkan framebuffer can only be used once per frame
- [ ] Because each level needs its own render pass
- [ ] Because the levels have different formats
- [x] Because a Vulkan framebuffer's attachments are fixed when it is created – there is no `glFramebufferTexture2D` to switch them
---
The framebuffers differ only in their image view and size. The downsample and upsample render passes are compatible, so each level's framebuffer serves both.
```
:::
:::d3d12
Direct3D 12 has no framebuffer objects: each level is a render target with its own **render target view**, and a
**shader resource view** to be read by the next pass. So the chain is all that remains of learnopengl's `bloomFBO`:

```cpp
struct BloomMip
{
    XMFLOAT2 size;
    XMINT2 intSize;
    ComPtr<ID3D12Resource> texture;
    UINT rtvIndex = 0;    // its render target view: slot in the RTV heap
    UINT srvIndex = 0;    // its shader resource view: slot in the CBV/SRV heap
};
```

The textures use `DXGI_FORMAT_R11G11B10_FLOAT` – learnopengl's `GL_R11F_G11F_B10F`, which Direct3D can render into,
filter and blend:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R11G11B10_FLOAT, mipIntSize.x, mipIntSize.y, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

Their RTVs go into RTV heap slots `FrameCount + 1` … `+ 6`, their SRVs into CBV/SRV heap slots 4 … 9, and every level
rests in `PIXEL_SHADER_RESOURCE`; a pass that draws into one turns it into a `RENDER_TARGET` and back with barriers. No
`DestroyBloomFBO` is needed: the `ComPtr`s release the textures once `OnDestroy` has waited for the GPU.
`InitBloomFBO` is a method of `D3D12App` (it uses the device and the heaps).
```quiz
What takes the place of learnopengl's bloom framebuffer in Direct3D 12?
- [x] A render target view per level, passed to `OMSetRenderTargets` for the pass that draws into it
- [ ] A descriptor table with all six levels
- [ ] One texture array with six slices
- [ ] A framebuffer object created with `CreateFramebuffer`
---
Direct3D 12 has no framebuffer objects: render targets are bound as views on the command list. So `BloomFBO` keeps only the chain, and each `BloomMip` remembers its RTV and SRV slots.
```
:::

Now do the first task, **mip-chain**: the two structs, `InitBloomFBO` and its call for the window with six levels, and the
cleanup. Nothing draws into the chain yet, so the picture stays the same.

```quiz
Why does learnopengl store the bloom's levels as R11G11B10 float instead of RGBA16F?
- [ ] Because R11G11B10 can store negative colours, which the filters produce
- [ ] Because R11G11B10 has more precision than a 16-bit float
- [x] Because the levels need HDR values but no alpha: three small floats in 32 bits halve the memory and bandwidth of RGBA16F, and the bloom passes are mostly bandwidth
- [ ] Because only R11G11B10 can be blended additively
---
11 and 10 bits per channel (no sign bit) are plenty for a blurred glow that is mixed in at 4 %. The scene's own colour buffer stays RGBA16F.
```

## Downsampling

The first half of the bloom is a chain of downsample passes: draw a screen quad into level 0 while reading the HDR scene,
then into level 1 while reading level 0, and so on down to level 5. Each pass halves the resolution and blurs a little.

Halving an image naively – one bilinear sample per output pixel, in the middle of four source texels – averages those
four texels and ignores everything else. Small bright details then appear in one level and vanish in the next, depending
on exactly where they fall in the grid, and that is the source of shimmering. Jimenez's downsample filter takes **13
samples** around the output pixel, from a 6 × 6 texel area of the source. Because every sample is a bilinear fetch, one
sample already averages up to four texels:

```text
a - b - c
- j - k -
d - e - f
- l - m -
g - h - i
```

`e` is the centre; `a`…`i` are two source texels apart, `j`…`m` one texel diagonally from the centre. The weights come from
five overlapping 2 × 2 boxes – the four corner boxes (`a b d e`, `b c e f`, `d e g h`, `e f h i`) count 0.125 each, the
inner box (`j k l m`) 0.5 – and add up to 1, so the downsample keeps the image's energy: summed out, `e` gets 0.125, the
corners `a c g i` 0.03125 each, the edges `b d f h` 0.0625 each, and `j k l m` 0.125 each.

:::opengl vulkan
```glsl
    vec3 a = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y + 2*y)).rgb;
    vec3 b = texture(srcTexture, vec2(texCoord.x,       texCoord.y + 2*y)).rgb;
    vec3 c = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y + 2*y)).rgb;

    vec3 d = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y)).rgb;
    vec3 e = texture(srcTexture, vec2(texCoord.x,       texCoord.y)).rgb;
    vec3 f = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y)).rgb;

    vec3 g = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y - 2*y)).rgb;
    vec3 h = texture(srcTexture, vec2(texCoord.x,       texCoord.y - 2*y)).rgb;
    vec3 i = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y - 2*y)).rgb;

    vec3 j = texture(srcTexture, vec2(texCoord.x - x, texCoord.y + y)).rgb;
    vec3 k = texture(srcTexture, vec2(texCoord.x + x, texCoord.y + y)).rgb;
    vec3 l = texture(srcTexture, vec2(texCoord.x - x, texCoord.y - y)).rgb;
    vec3 m = texture(srcTexture, vec2(texCoord.x + x, texCoord.y - y)).rgb;
```

with `x` and `y` the size of one source texel, `1.0 / srcResolution`, and then the weighted sum:

```glsl
        downsample = e*0.125;
        downsample += (a+c+g+i)*0.03125;
        downsample += (b+d+f+h)*0.0625;
        downsample += (j+k+l+m)*0.125;
```

The output is a `vec3` – the levels have no alpha.
:::
:::d3d12
```hlsl
    float3 a = srcTexture.Sample(clampSampler, float2(texCoord.x - 2 * x, texCoord.y + 2 * y)).rgb;
    float3 b = srcTexture.Sample(clampSampler, float2(texCoord.x,         texCoord.y + 2 * y)).rgb;
    float3 c = srcTexture.Sample(clampSampler, float2(texCoord.x + 2 * x, texCoord.y + 2 * y)).rgb;
```

and so on for `d` … `m`, with `x` and `y` the size of one source texel, `1.0f / srcResolution` (a root constant, with
`mipLevel`, in `DownsampleConstants`), and then the weighted sum:

```hlsl
        downsample = e * 0.125f;
        downsample += (a + c + g + i) * 0.03125f;
        downsample += (b + d + f + h) * 0.0625f;
        downsample += (j + k + l + m) * 0.125f;
```

The sample offsets go +y where GLSL goes +y. Direct3D's v points down, so "+y" is lower in the texture, but the filter is
symmetric, so the result is the same. The static sampler s1 filters bilinearly and clamps.
:::

The pass loop sets each level's viewport, makes it the target, draws, and then reads it as the next pass's source:

:::opengl
```cpp
    // progressively downsample through the mip chain
    for (unsigned int i = 0; i < bloomFBO.mipChain.size(); i++)
    {
        const BloomMip& mip = bloomFBO.mipChain[i];
        glViewport(0, 0, (int)mip.size.x, (int)mip.size.y);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, mip.texture, 0);

        // render screen-filled quad of resolution of current mip
        renderQuad();

        // set current mip resolution as srcResolution for next iteration
        downsampleShader.setVec2("srcResolution", mip.size);
        // set current mip as texture input for next iteration
        glBindTexture(GL_TEXTURE_2D, mip.texture);
    }
```

Before the loop `RenderDownsamples` uses the shader, sets `srcResolution` to the source's size (800 × 600) and binds the
HDR `colorBuffer` on unit 0. In the render loop, after the scene:

```cpp
        glBindFramebuffer(GL_FRAMEBUFFER, bloomFBO.FBO);
        RenderDownsamples(bloomFBO, downsampleShader, colorBuffer, glm::vec2((float)SCR_WIDTH, (float)SCR_HEIGHT));
```

then `glBindFramebuffer(GL_FRAMEBUFFER, 0)` and the window's viewport again.
:::
:::vulkan
Each level is a render pass of its own: `RenderDownsamples` begins `bloomFBO.renderPass` with the level's framebuffer,
sets viewport and scissor to the level's size (learnopengl's `glViewport`), binds the downsample pipeline, pushes the
source's size as `srcResolution`, binds the source's descriptor set – `hdrDescriptorSet` for the first pass, then the
previous level's `descriptorSet` – and draws the quad. The push constants grow by learnopengl's uniforms:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 lightColor;
    alignas(8) glm::vec2 srcResolution;
    float filterRadius;
    int mipLevel;
};
```

Push constants are laid out like std430: a `vec2` starts at a multiple of 8, so `srcResolution` sits at offset 80, after
four bytes of padding behind the `vec3` – `alignas(8)` makes the C++ struct agree. `recordCommandBuffer()` calls
`RenderDownsamples(bloomFBO, commandBuffer, downsamplePipeline, pipelineLayout, hdrDescriptorSet, …)` between the scene's
render pass and the final one, and sets the window's viewport and scissor again afterwards.
:::
:::d3d12
`RenderDownsamples` sets the downsample pipeline state, and per level: viewport and scissor at the level's size, a barrier
`PIXEL_SHADER_RESOURCE → RENDER_TARGET`, `OMSetRenderTargets` with the level's RTV (no depth buffer), the
`DownsampleConstants` root constants with the source's size, the source's SRV as root parameter 2's table – the HDR
colour buffer (slot 3) for the first pass, then the previous level's `srvIndex` – `DrawInstanced(6, 1, 36, 0)` and the
barrier back. `PopulateCommandList` calls it between the scene and the final pass and sets the window's viewport and
scissor again afterwards.
:::

To check the downsample, the final pass shows **level 2** (100 × 75) instead of the scene for now. Now do the second task,
**downsample**. Build and run: the window shows the scene at an eighth of its resolution, stretched – blurred and blocky,
with the light cubes smeared into their surroundings.

## Upsampling

The second half goes back up. Starting at the smallest level, each upsample pass reads level i, filters it, and **adds**
it to level i − 1 – additive blending, `ONE, ONE`. After five passes level 0 holds the sum of all levels, each blurred
again on its way up: the bloom texture. The small levels contribute the wide glow, the large ones the tight glow around
bright details, and the sum has a smooth falloff with a long tail – much like the glow around a real light.

The upsample filter is a 3 × 3 **tent** filter: nine bilinear samples weighted 1 2 1 / 2 4 2 / 1 2 1, divided by 16.
Its radius is given in **texture coordinates**, not texels – learnopengl's `filterRadius` of 0.005 – so on a small level
it spans less than a texel and on a large one several: the blur grows with the level it is applied to, as it should.

:::opengl vulkan
```glsl
    // Apply weighted distribution, by using a 3x3 tent filter:
    //  1   | 1 2 1 |
    // -- * | 2 4 2 |
    // 16   | 1 2 1 |
    upsample = e*4.0;
    upsample += (b+d+f+h)*2.0;
    upsample += (a+c+g+i);
    upsample *= 1.0 / 16.0;
```

with the nine samples `a`…`i` taken `filterRadius` apart around `texCoord`.
:::
:::d3d12
The pixel shader takes nine samples `a`…`i` `filterRadius` apart around `texCoord` (a root constant in
`UpsampleConstants`) and returns `(e * 4 + (b + d + f + h) * 2 + (a + c + g + i)) / 16` – learnopengl's tent filter.
:::

:::opengl
```cpp
    // enable additive blending
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    glBlendEquation(GL_FUNC_ADD);

    for (int i = (int)bloomFBO.mipChain.size() - 1; i > 0; i--)
    {
        const BloomMip& mip = bloomFBO.mipChain[i];
        const BloomMip& nextMip = bloomFBO.mipChain[i - 1];

        // bind viewport and texture from where to read
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mip.texture);

        // set framebuffer render target (we write to this texture)
        glViewport(0, 0, (int)nextMip.size.x, (int)nextMip.size.y);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, nextMip.texture, 0);

        // render screen-filled quad of resolution of current mip
        renderQuad();
    }

    // disable additive blending
    glDisable(GL_BLEND);
```

`RenderUpsamples(bloomFBO, upsampleShader, bloomFilterRadius)` comes right after `RenderDownsamples`, with `float
bloomFilterRadius = 0.005f;`.
:::
:::vulkan
The upsample pipeline is created for `upsampleRenderPass` with blending on – `ONE`, `ONE`, `ADD` (`createPipeline` gets
a `blendEnable` parameter). Each pass loads the target level and adds the quad to it:

```cpp
        // set framebuffer render target (we write to this texture): its contents are loaded and the quad added to them
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = bloomFBO.upsampleRenderPass;
        renderPassInfo.framebuffer = nextMip.framebuffer;
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = {static_cast<uint32_t>(nextMip.intSize.x), static_cast<uint32_t>(nextMip.intSize.y)};
        renderPassInfo.clearValueCount = 0; // loadOp LOAD: nothing to clear
```

then viewport and scissor at `nextMip`'s size, the pipeline, the push constants with `filterRadius`, `mip.descriptorSet`
(the smaller level is read) and `vkCmdDraw(commandBuffer, 6, 1, 36, 0)` – in learnopengl's loop from the last level down
to 1.
:::
:::d3d12
`m_upsamplePipelineState` blends additively (`SrcBlend = DestBlend = D3D12_BLEND_ONE`, `BlendOp = ADD` – learnopengl's
`glBlendFunc(GL_ONE, GL_ONE)`). Per pass:

```cpp
        // Bind viewport and texture from where to read
        CD3DX12_GPU_DESCRIPTOR_HANDLE mipHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), mip.srvIndex, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, mipHandle);

        // Set framebuffer render target (we write to this texture)
        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(nextMip.intSize.x), static_cast<float>(nextMip.intSize.y));
        CD3DX12_RECT scissorRect(0, 0, nextMip.intSize.x, nextMip.intSize.y);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(nextMip.texture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
        m_commandList->ResourceBarrier(1, &barrier);
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), nextMip.rtvIndex, m_rtvDescriptorSize);
        m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

        // Render screen-filled quad of resolution of current mip
        m_commandList->DrawInstanced(6, 1, 36, 0);
```

and the barrier back to `PIXEL_SHADER_RESOURCE` – in learnopengl's loop from the last level down to 1. A render target
keeps its contents between passes, so the blending adds to what the downsample wrote.
:::

For now the final pass shows **level 0**, the finished bloom texture. Now do the third task, **upsample**. Build and run:
the whole scene very soft and very bright – six levels added up – with big white halos around the light cubes, and even
the black background lit by the glow.

```quiz
Why does the upsample *add* each level to the next larger one instead of replacing it?
- [ ] Because a render target can't be overwritten while it is bound
- [ ] To undo the energy the downsample lost
- [ ] Because the tent filter's weights sum to more than 1
- [x] So that level 0 ends up holding the sum of all levels – the tight glow of the large levels plus the ever wider glow of the small ones – a smooth falloff with a long tail
---
Each level is the image blurred to a different width. Their sum is a blur with a sharp core and wide skirts, close to how a lens scatters light. The sum is much brighter than the scene, which is why it is mixed in at a small strength.
```

## Mixing the bloom with the scene

The *Bloom* chapter *added* the blurred bright parts to the scene: `hdrColor += bloomColor`. The physically based version
**interpolates** between the scene and the bloom texture instead:

```text
hdrColor = mix(hdrColor, bloomColor, bloomStrength)        bloomStrength = 0.04
```

96 % of the scene and 4 % of its blurred self. A linear interpolation keeps the energy: the light that glows around a
bright spot is taken from the spot itself, as a lens scatters part of the light that passes through it rather than
adding light. There is no threshold: every pixel glows in proportion to its brightness. A dark wall's glow is too faint to
see; a light cube with a value of 5 or 15 spreads a clearly visible halo – not because it passed a threshold, but because
4 % of a lot of light is still a lot. Then the exposure tone mapping and gamma correction follow as before.

:::opengl
`bloom_final.fs` gets the bloom texture and the strength:

```glsl
uniform sampler2D bloomBlur;
uniform float exposure;
uniform float bloomStrength;
```

and in `main`, before the tone mapping, `vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;` and

```glsl
    hdrColor = mix(hdrColor, bloomColor, bloomStrength); // linear interpolation
```

In C++: `float bloomStrength = 0.04f;`, `shaderBloomFinal.setInt("bloomBlur", 1);` once, and in the final pass the scene
(`colorBuffer`) on unit 0, `bloomFBO.mipChain[0].texture` on unit 1 and `setFloat("bloomStrength", bloomStrength)`.
(learnopengl gives the uniform a GLSL default, `= 0.04f`; the course sets it from the program.)
:::
:::vulkan
`bloom_final.frag` reads the bloom texture at binding 2 – a `bloomDescriptorSet` made by `createBloomDescriptorSet`, as in
the *Bloom* chapter, with the scene at binding 1 and level 0's view at binding 2 – and `bloomStrength` from the uniform
buffer, where it follows `exposure` (std140 offset 272). Before the tone mapping:
`hdrColor = mix(hdrColor, bloomColor, ubo.bloomStrength);` with `bloomStrength` = 0.04.
:::
:::d3d12
`bloom_final.hlsl` reads the bloom texture (level 0) at t1 through a fourth root parameter – a descriptor table with one
SRV – and gets `bloomStrength` next to `exposure` in its root constants (`HdrConstants`). Before the tone mapping:

```hlsl
    hdrColor = lerp(hdrColor, bloomColor, bloomStrength); // linear interpolation (GLSL's mix)
```

with `bloomStrength` = 0.04 – HLSL's `lerp` is GLSL's `mix`.
:::

Now do the fourth task, **combine**. Build and run: the scene is back, and every bright thing glows softly – the light
cubes most, with halos much wider and smoother than the Gaussian bloom's, and even the lit boxes and floor a little,
which brightens the black background near them. Compare it with the *Bloom* chapter's picture: no hard boundary between
"glows" and "doesn't glow", and no blocky blur.

```quiz
With `mix(hdrColor, bloomColor, 0.04)` and no threshold, why does a light cube glow visibly but a dimly lit wall hardly at all?
- [x] Because the glow is proportional to brightness: 4 % of the blurred light of a cube with values of 5–15 is still bright, 4 % of a wall's blurred colour below 1 is too faint to notice
- [ ] Because the downsample filter removes colours below 1.0
- [ ] Because the tone mapping removes the glow of dark surfaces
- [ ] Because only the light cubes are rendered into the mip chain
---
That is the "physically based" idea: no switch at a threshold, just a fraction of all light scattered. A surface that brightens gradually also glows gradually, without popping.
```

## Fireflies and the Karis average

One problem remains, and you can only see it in motion. A single very bright pixel – a specular highlight on a bolt, a
spark – can be far brighter than everything around it. In the first downsample it dominates whatever 2 × 2 box it falls
into, and as the camera moves it drifts from one box to the next, jumping between levels' texels: a pulsating spot of
glow, a *firefly*. Jimenez's fix is to weight each box of the first downsample by the **Karis average** (after Brian
Karis, who described it for temporal anti-aliasing): divide by one plus the box's brightness,

```text
weight = 1 / (1 + luma(box) / 4)
```

so that very bright boxes count less and a single extreme pixel can't take over the average. learnopengl measures the
luma of the box's colour converted to sRGB (`pow(c, 1/2.2)`, weights 0.299, 0.587, 0.114). It is only needed in the first
downsample, where single pixels are still single pixels; after that the image is smooth enough. The shader gets a
`mipLevel` uniform – 0 for the first pass, 1 after it – and uses the five boxes as groups instead of the combined weights:

:::opengl
```glsl
        groups[0] = (a+b+d+e) * (0.125f/4.0f);
        groups[1] = (b+c+e+f) * (0.125f/4.0f);
        groups[2] = (d+e+g+h) * (0.125f/4.0f);
        groups[3] = (e+f+h+i) * (0.125f/4.0f);
        groups[4] = (j+k+l+m) * (0.5f/4.0f);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0]+groups[1]+groups[2]+groups[3]+groups[4];
        downsample = max(downsample, 0.0001f);
```

learnopengl switches with `switch (mipLevel)`; the course writes `if (mipLevel == 0) … else …` with the old weights in
the `else`, and `uniform int mipLevel;` next to the other uniforms.
:::
:::vulkan
```glsl
        groups[0] = (a+b+d+e) * (0.125/4.0);
        groups[1] = (b+c+e+f) * (0.125/4.0);
        groups[2] = (d+e+g+h) * (0.125/4.0);
        groups[3] = (e+f+h+i) * (0.125/4.0);
        groups[4] = (j+k+l+m) * (0.5/4.0);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0]+groups[1]+groups[2]+groups[3]+groups[4];
        downsample = max(downsample, 0.0001);
```

learnopengl switches with `switch (mipLevel)`; the course writes `if (pc.mipLevel == 0) { … } else { … }` with the old
weights in the `else` – `mipLevel` is the last field of the push constants.
:::
:::d3d12
```hlsl
        groups[0] = (a + b + d + e) * (0.125f / 4.0f);
        groups[1] = (b + c + e + f) * (0.125f / 4.0f);
        groups[2] = (d + e + g + h) * (0.125f / 4.0f);
        groups[3] = (e + f + h + i) * (0.125f / 4.0f);
        groups[4] = (j + k + l + m) * (0.5f / 4.0f);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0] + groups[1] + groups[2] + groups[3] + groups[4];
        downsample = max(downsample, 0.0001f);
```

`mipLevel` is part of the `DownsampleConstants` root constants. learnopengl switches with `switch (mipLevel)`; the course
writes `if (mipLevel == 0) … else …` with the old weights in the `else`.
:::

`RenderDownsamples` sets `mipLevel` to 0 before the loop and to 1 after the first pass (`if (i == 0) { … }` at the end of
the loop body). The `max(…, 0.0001)` keeps the result from becoming exactly zero.

Now do the last task, **karis-average**. Build and run: the glow around the brightest parts becomes a little weaker – the
bright boxes count less – and otherwise the picture is the same. The project's camera stands still, so there are no
fireflies to see; in learnopengl's demo, with a moving camera, the difference is a calm glow instead of a flickering one.

```quiz
Why is the Karis average applied only in the first downsample?
- [ ] Because the later levels are too small for 13 samples
- [ ] Because the later passes read R11G11B10, which can't store bright values
- [x] Because only the full-resolution input still has single, extremely bright pixels; after the first downsample they are already averaged, and weighting again would only darken the glow
- [ ] Because the upsample applies it to the other levels
---
Fireflies come from sub-pixel details of the full-resolution image. Once the first level has tamed them, the later downsamples use the energy-preserving weights.
```

## Final thoughts

Compared with the *Bloom* chapter's Gaussian blur, the physically based bloom gives a wider, smoother glow for less work:
six downsample and five upsample passes, all at half resolution or below, instead of ten full-resolution blur passes; no
threshold to tune and no glow popping on and off; and the Karis average keeps it stable in motion. Two numbers control
it: `filterRadius` (how far each upsample spreads) and `bloomStrength` (how much of the blurred scene is mixed in).

Engines build on the same chain. A *dirt mask* – a texture of smudges multiplied with the bloom – makes the glow look like
light scattered on a dirty lens. The chain can be built as one texture with mip levels, and the passes done in compute
shaders with groupshared memory. And one point is worth keeping in mind: the bloom is part of the HDR pipeline – it
belongs before the tone mapping, working on the scene's unclamped values, and that is where every API puts it.

## Additional resources

- [Physically Based Bloom](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom): learnopengl's guest article
  this chapter follows, with comparison pictures of the old and the new bloom and of fireflies.
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengl's original bloom with the threshold and the
  Gaussian blur, the *Bloom* chapter of the course.
- [physically_based_bloom.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/6.physically_based_bloom/physically_based_bloom.cpp):
  learnopengl's demo, which switches between no bloom, the old and the new bloom.

:::opengl
- [Image Format (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Image_Format): the packed float format
  `GL_R11F_G11F_B10F` among the other formats.
:::
:::vulkan
- [VkFormat](https://registry.khronos.org/vulkan/specs/latest/man/html/VkFormat.html): `VK_FORMAT_B10G11R11_UFLOAT_PACK32`
  and the other packed formats.
:::
:::d3d12
- [DXGI_FORMAT](https://learn.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format):
  `DXGI_FORMAT_R11G11B10_FLOAT` and the other formats.
:::
