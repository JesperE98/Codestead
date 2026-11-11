# Bloom

Bright light sources and brightly lit regions are often difficult to convey to the viewer as the intensity range of a
monitor is limited. One way to distinguish bright light sources on a monitor is by making them glow; their light then
bleeds around the light source. This effectively gives the viewer the illusion these light sources or bright regions
are intensely bright. Think of a street lamp at night seen through a camera, or the sun through a dusty window: the
light seems to spill over whatever is around it.

This light bleeding, or glow effect, is achieved with a post-processing effect called *bloom*. Bloom gives all brightly
lit regions of a scene a glow-like effect. Without it, a light cube of the last chapters is just a white square; with
it, the square glows, and the eye reads it as a light.

Bloom works best in combination with HDR rendering. A common misconception is that HDR is the same as bloom, as many
people use the terms interchangeably. They are however completely different techniques used for different purposes. It
is possible to implement bloom with default 8-bit precision framebuffers, just as it is possible to use HDR without the
bloom effect. It is simply that HDR makes bloom more effective to implement: with HDR, "bright" has a natural meaning –
brighter than 1.0, what the window cannot show – and the threshold that decides what glows is easy to control.

To implement bloom, we render a lit scene as usual and extract both the scene's HDR colour buffer and an image of the
scene with only its bright regions visible. The extracted brightness image is then blurred and the result added on top
of the original HDR scene image. Step by step:

1. Render the scene into a floating point framebuffer, as in the last chapter – and at the same time write the
   fragments whose brightness exceeds 1.0 into a second colour buffer, black everywhere else.
2. Blur that second buffer – a Gaussian blur, done in several passes.
3. Add the blurred image to the scene's HDR colours, then tone-map and gamma-correct the sum onto the window.

None of this is a new mechanism: it is the last chapter's floating point target plus two things – drawing into two
colour buffers at once, and passes that take turns drawing into one buffer and reading another. Every API has both;
this chapter shows how {{api}} does it.

The project is learnopengl's bloom scene: a wooden floor (the 2 × 2 × 2 cube scaled to a thin 25 × 1 × 25 slab) with six
containers on and above it, lit by four point lights that are much brighter than in the earlier chapters: white (5, 5,
5) at (0, 0.5, 1.5), red (10, 0, 0) at (-4, 0.5, -3), blue (0, 0, 15) at (3, 0.5, 1) and green (0, 5, 0) at (-0.8,
2.4, -1). Each light is also shown as a small cube in its own colour – values far above 1.0. The camera is
learnopengl's, at (0, 0, 5) looking down -z. Both textures are read as sRGB textures; the lighting is the last chapter's
(diffuse only, quadratic attenuation, no ambient).

:::opengl
The start is the last chapter's end state with this scene: `main.cpp` renders the scene with `bloom.vs` / `bloom.fs`
and the light cubes with `bloom.vs` / `light_box.fs` into `hdrFBO` – one `GL_RGBA16F` colour texture, `colorBuffer`,
and a depth renderbuffer – and then draws `colorBuffer` on learnopengl's `renderQuad()` with `bloom_final.vs` /
`bloom_final.fs`, which tone-maps with the exposure curve (`exposure` = 1.0) and gamma-corrects. The colour texture
clamps to the edge (`GL_CLAMP_TO_EDGE`) – learnopengl's comment says why: "we clamp to the edge as the blur filter would
otherwise sample repeated texture values!". `blur.vs` is complete, `blur.fs` has its uniforms but its `main` is a TODO.
:::
:::vulkan
The start is the last chapter's end state with this scene: `recordCommandBuffer()` draws the floor and the six
containers with `graphicsPipeline` (`shaders/bloom.vert` / `.frag`) and the light cubes with `lightPipeline`
(`bloom.vert` / `light_box.frag`) into `hdrRenderPass` – one `VK_FORMAT_R16G16B16A16_SFLOAT` colour image and a depth
image – and then the screen quad (vertices 36..41) into the window with `bloomFinalPipeline` (`bloom_final.frag`), which
tone-maps with the exposure curve (`ubo.exposure` = 1.0) and gamma-corrects. The push constants are `struct
PushConstants { glm::mat4 model; glm::vec3 lightColor; }` in one range for the vertex **and** fragment stages (the
model matrix for `bloom.vert`, the light's colour for `light_box.frag`); push constants are laid out like std430, so the
`vec3` sits right after the `mat4`, at offset 64. Each texture has its descriptor set (`woodDescriptorSet`,
`containerDescriptorSet`, `hdrDescriptorSet`); the floating point images are sampled with `colorBufferSampler`, which
clamps to the edge (`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`) – learnopengl's comment says why: "we clamp to the edge as
the blur filter would otherwise sample repeated texture values!". `shaders/blur.vert` is complete; `blur.frag` has its
weights, but its push constants and `main` are TODOs.
:::
:::d3d12
The start is the last chapter's end state with this scene: `PopulateCommandList` calls `RenderScene()` – the floor and
the six containers with `m_pipelineState` (`bloom.hlsl`), the light cubes with `m_lightBoxPipelineState`
(`light_box.hlsl`'s `PSMain`, `lightColor`) – into one `R16G16B16A16_FLOAT` colour buffer, `m_colorBuffer` (RTV heap slot
`FrameCount`, CBV/SRV heap slot 3), with the depth buffer; then it draws the screen quad (vertices 36–41) into the back
buffer with `m_bloomFinalPipelineState` (`bloom_final.hlsl`), which tone-maps with the exposure curve (`exposure` = 1.0,
a root constant) and gamma-corrects. Root parameter 0 holds the root constants of whatever is drawn – `ModelConstants`
(model, normal matrix, `lightColor`: 35 values) for the scene, a single float for the final quad – and is visible to all
shaders. The screen-quad passes sample with the static sampler s1: linear, `D3D12_TEXTURE_ADDRESS_MODE_CLAMP` –
learnopengl clamps its colour buffers to the edge "as the blur filter would otherwise sample repeated texture values!".
`blur.hlsl` has its `VSMain`, its weights and the `BlurConstants` cbuffer; its `PSMain` is a TODO that returns black
(the file isn't compiled before you need it).
:::

The `// TODO:` comments in the project mark where your code goes. Build and run the program in your IDE: the floor and
the containers, the **white light cube** in the middle above the centre, under the top container, and the **green light
cube** at the top edge. The red and blue light cubes aren't in view, but their light colours the floor and the sides of
the boxes. The tone mapping keeps the details, but the light cubes don't look like lights: they have hard edges, and
right next to them the black background is as black as anywhere.

## Extracting bright color

The first step requires us to extract two images from a rendered scene. We could render the scene twice, both rendering
to a different framebuffer with different shaders, but we can also use a neat little trick called *Multiple Render
Targets* (MRT) that allows us to specify more than one fragment shader output; this gives us the option to extract the
first two images in a single render pass. By specifying a location for each output of the fragment shader, we control
which colour buffer it writes to – the shader runs once, and each of its outputs lands in its own colour buffer.

Which fragments are bright? We take the colour's *luminance* – its brightness as the eye sees it – and compare it to a
threshold. The eye is far more sensitive to green than to red, and least to blue, so the luminance weighs the channels
differently: `dot(color, vec3(0.2126, 0.7152, 0.0722))`, the weights of the sRGB (Rec. 709) primaries. We first
transform the fragment colour to grayscale this way, and if it exceeds 1.0 – a brightness the window cannot show – we
output the colour into the second buffer; otherwise black.

```quiz
The blue light cube has the colour (0, 0, 15). Does it end up in the bright colour buffer?
- [ ] No: its red and green are 0, so its brightness is 0
- [x] Yes, but only just: 15 × 0.0722 = 1.08, above the threshold of 1.0 – a blue of 13 would stay black
- [ ] Yes, with a brightness of 15: the largest channel counts
- [ ] No: the threshold is applied after tone mapping, and tone-mapped values never exceed 1.0
---
The luminance weighs blue least. The green cube (0, 5, 0) has 5 × 0.7152 = 3.6, the red one (10, 0, 0) 2.1, the white one (5, 5, 5) 5.0 – all well above 1.0.
```

:::opengl
The framebuffer gets a second floating point colour texture. learnopengl creates both in a loop, attached to
`GL_COLOR_ATTACHMENT0` and `GL_COLOR_ATTACHMENT1`:

```cpp
    // create 2 floating point color buffers (1 for normal rendering, other for brightness threshold values)
    unsigned int colorBuffers[2];
    glGenTextures(2, colorBuffers);
    for (unsigned int i = 0; i < 2; i++)
    {
        glBindTexture(GL_TEXTURE_2D, colorBuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);  // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        // attach texture to framebuffer
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, colorBuffers[i], 0);
    }
```

We do have to explicitly tell OpenGL we're rendering to multiple colour buffers via `glDrawBuffers`. OpenGL, by
default, only renders to a framebuffer's first colour attachment, ignoring all others. We can do this by passing an
array of colour attachment enums that we'd like to render to in subsequent operations:

```cpp
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering
    unsigned int attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glDrawBuffers(2, attachments);
```

When rendering into this framebuffer, whenever a fragment shader uses the layout location specifier, the respective
colour buffer is used to render the fragment to. In `bloom.fs`:

```glsl
layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;
```

and at the end of `main`:

```glsl
    vec3 result = ambient + lighting;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    if(brightness > 1.0)
        BrightColor = vec4(result, 1.0);
    else
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
    FragColor = vec4(result, 1.0);
```

`light_box.fs` gets the same two outputs and the same test on `FragColor.rgb` – the light cubes are what should glow
most. For now, the final pass shows the bright buffer instead of the scene: in pass 3, bind `colorBuffers[1]`. Now do the
first task, **bright-pass**, and delete both textures at the end (`glDeleteTextures(2, colorBuffers);`).
:::
:::vulkan
In Vulkan, the colour buffers a fragment shader writes to are the colour attachments of the current **subpass**: output
`location = n` goes to `pColorAttachments[n]` of the subpass description. `createHdrRenderPass()` gets a second colour
attachment just like the first – `VkAttachmentDescription brightAttachment = colorAttachment;` – and the subpass two
colour references; the depth attachment moves to index 2:

```cpp
        // the fragment shader's outputs: location 0 -> attachment 0, location 1 -> attachment 1 (learnopengl's
        // glDrawBuffers(2, attachments))
        std::array<VkAttachmentReference, 2> colorAttachmentRefs{};
        colorAttachmentRefs[0].attachment = 0;
        colorAttachmentRefs[0].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[1].attachment = 1;
        colorAttachmentRefs[1].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 2;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = static_cast<uint32_t>(colorAttachmentRefs.size());
        subpass.pColorAttachments = colorAttachmentRefs.data();
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

with `std::array<VkAttachmentDescription, 3> attachments = {colorAttachment, brightAttachment, depthAttachment};`.
`createHdrFramebuffer()` creates the bright image like the colour image (`brightColorImage`, `brightColorImageMemory`,
`brightColorImageView`: the floating point format, colour attachment + sampled), and the framebuffer gets three views
in the same order: `hdrColorImageView, brightColorImageView, hdrDepthImageView`. The render pass clears three
attachments, so `recordCommandBuffer()` passes three clear values: two black colours and the depth 1.0.

There is one more place that has to know the number of colour attachments: the pipeline. Its colour blend state has one
`VkPipelineColorBlendAttachmentState` per colour attachment of the subpass, and the counts must be equal. So
`createPipeline` gets a `colorAttachmentCount` parameter and an array of blend states, all the same (no blending):

```cpp
        // one blend state per colour attachment of the subpass (up to 2 here), all the same: no blending
        std::array<VkPipelineColorBlendAttachmentState, 2> colorBlendAttachments{};
        for (auto& colorBlendAttachment : colorBlendAttachments) {
            colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
            colorBlendAttachment.blendEnable = VK_FALSE;
        }
```

```cpp
        colorBlending.attachmentCount = colorAttachmentCount; // as many as the render pass's subpass has
        colorBlending.pAttachments = colorBlendAttachments.data();
```

The scene's two pipelines are created with 2, the final one (the window has one colour attachment) with 1:

```cpp
        createPipeline("shaders/bloom.vert.spv", "shaders/bloom.frag.spv", hdrRenderPass, 2, graphicsPipeline);
        createPipeline("shaders/bloom.vert.spv", "shaders/light_box.frag.spv", hdrRenderPass, 2, lightPipeline);
```

In `bloom.frag`, a second output:

```glsl
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 brightColor; // the second colour attachment
```

and at the end of `main`:

```glsl
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > 1.0)
        brightColor = vec4(result, 1.0);
    else
        brightColor = vec4(0.0, 0.0, 0.0, 1.0);
    outColor = vec4(result, 1.0);
```

`light_box.frag` gets the same output and the same test on `outColor.rgb` – the light cubes are what should glow most.
For now, the final pass shows the bright image instead of the scene: a new `brightDescriptorSet` =
`createDescriptorSet(brightColorImageView, colorBufferSampler, brightDescriptorSet)` (the pool grows to 4 sets: 4 uniform
buffers, 4 samplers, `maxSets = 4`), bound for the final pass instead of `hdrDescriptorSet`. Now do the first task,
**bright-pass**, and destroy the bright image's view, image and memory in `cleanup()`.
:::
:::d3d12
In Direct3D 12, `OMSetRenderTargets` binds up to eight render target views at once, and a pixel shader writes to them
through the semantics `SV_TARGET0`, `SV_TARGET1`, … – `SV_TARGET` alone means `SV_TARGET0`. The colour buffer becomes
two, created in a loop – the RTVs after the swap chain's buffers (slots `FrameCount` and `FrameCount + 1`, so the RTV
heap needs `FrameCount + 2`), the SRVs in slots 3 and 4 of the CBV/SRV heap (which needs 5):

```cpp
        for (UINT i = 0; i < 2; i++)
        {
            ThrowIfFailed(m_device->CreateCommittedResource(
                &heapProperties,
                D3D12_HEAP_FLAG_NONE,
                &textureDesc,
                D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
                &clearValue,
                IID_PPV_ARGS(&m_colorBuffers[i])));

            // A render target view, to draw into it: in the RTV heap after the swap chain's
            // buffers (slots FrameCount and FrameCount + 1).
            CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + i, m_rtvDescriptorSize);
            m_device->CreateRenderTargetView(m_colorBuffers[i].Get(), nullptr, rtvHandle);

            // A shader resource view, to read it: slots 3 and 4 of the CBV/SRV heap.
            CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 3 + i, m_cbvSrvDescriptorSize);
            m_device->CreateShaderResourceView(m_colorBuffers[i].Get(), &srvDesc, srvHandle);
        }
```

The PSO must know how many render targets it writes and their formats. The scene's PSO – and the light cubes', which is
created from the same description with another pixel shader – renders into two:

```cpp
        psoDesc.NumRenderTargets = 2;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT;
```

The final quad's PSO, created from the same description, sets `NumRenderTargets = 1` and `RTVFormats[1] =
DXGI_FORMAT_UNKNOWN` again: past `NumRenderTargets` the formats are expected to be `UNKNOWN`. The blend state needs no change:
`CD3DX12_BLEND_DESC(D3D12_DEFAULT)` has `IndependentBlendEnable = FALSE`, which applies `RenderTarget[0]`'s settings (no
blending) to every render target.

In `PopulateCommandList`, both buffers need their barriers – `ResourceBarrier` takes an array – and both RTVs are bound
in one call:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffers[0].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffers[1].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET)
    };
    m_commandList->ResourceBarrier(2, barriers);

    CD3DX12_CPU_DESCRIPTOR_HANDLE hdrRtvHandles[2] =
    {
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 1, m_rtvDescriptorSize)
    };
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(2, hdrRtvHandles, FALSE, &dsvHandle);
```

The `FALSE` says that `hdrRtvHandles` is an array of separate handles; with `TRUE` it would be a single handle to the
first of consecutive descriptors in the heap. Both RTVs are cleared, and after `RenderScene()` the two barriers go the
other way. In `bloom.hlsl`, the pixel shader returns a struct with one member per render target:

```hlsl
struct PSOutput
{
    float4 FragColor : SV_TARGET0;      // the scene (colour buffer 0)
    float4 BrightColor : SV_TARGET1;    // only its bright parts (colour buffer 1)
};
```

and `PSOutput PSMain(PSInput input)` ends with

```hlsl
    PSOutput output;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, float3(0.2126f, 0.7152f, 0.0722f));
    if (brightness > 1.0f)
        output.BrightColor = float4(result, 1.0f);
    else
        output.BrightColor = float4(0.0f, 0.0f, 0.0f, 1.0f);
    output.FragColor = float4(result, 1.0f);
    return output;
```

`light_box.hlsl` gets the same struct and the same test on `output.FragColor.rgb` – the light cubes are what should
glow most. For now, the final pass shows the bright buffer instead of the scene: its descriptor table (root parameter 2)
points at slot 4. Now do the first task, **bright-pass**.
:::

:::opengl
```quiz
`bloom.fs` writes `layout (location = 1) out vec4 BrightColor;`. What makes that value land in `colorBuffers[1]`?
- [ ] The name `BrightColor`: OpenGL matches outputs to attachments by name
- [ ] Nothing else: every output goes to every colour attachment
- [x] Location 1 is the second entry of the draw buffers list, `glDrawBuffers(2, attachments)` with `GL_COLOR_ATTACHMENT1` there, and `colorBuffers[1]` is attached to `GL_COLOR_ATTACHMENT1`
- [ ] `glActiveTexture(GL_TEXTURE1)` before the draw
---
Without `glDrawBuffers` a framebuffer only draws into `GL_COLOR_ATTACHMENT0`, and the second output would be lost.
```
:::
:::vulkan
```quiz
`bloom.frag` writes `layout(location = 1) out vec4 brightColor;`. What has to agree with it?
- [x] The subpass's `pColorAttachments[1]` is the bright attachment, the framebuffer's view at that attachment index is the bright image, and the pipeline has a blend state for each of the subpass's two colour attachments
- [ ] Only the shader: Vulkan finds the attachment by the output's name
- [ ] The descriptor set: the bright image must be bound at binding 1
- [ ] Nothing: the second output goes to the depth attachment
---
Output location n writes `pColorAttachments[n]`. The pipeline's `colorBlending.attachmentCount` must equal the subpass's `colorAttachmentCount` – that is why `createPipeline` now takes it.
```
:::
:::d3d12
```quiz
`bloom.hlsl`'s pixel shader returns `float4 BrightColor : SV_TARGET1`. What has to agree with it?
- [ ] Only the shader: the semantic picks the resource by name
- [ ] The root signature: a descriptor table with the bright buffer's RTV
- [ ] `BrightColor` must be the struct's first member
- [x] The PSO has `NumRenderTargets = 2` and `RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT`, and `OMSetRenderTargets(2, …)` binds the bright buffer's RTV as the second render target
---
`SV_TARGETn` writes the n-th bound render target. Render target views are bound with `OMSetRenderTargets`, not through the root signature.
```
:::

Build and run: the window shows **only the bright parts**, tone-mapped, on black. The light cubes are there, the white
and the green one; the steel frame of the container right above the white light; a bright edge of the big container in
the lower left that faces the white light; and small dots – the frames' rivets where the light falls on them. Everything
else is black. Even the floor's lit patch under the white light stays black: it is bright, but its luminance stays below
1.0. The edges of the bright parts are still hard.

## Gaussian blur

Now that we have an extracted brightness image we need to blur the image. We could do this with a simple box blur filter
as we've done in the post-processing section of the *Framebuffers* chapter, but we'd rather use a more advanced (and
better-looking) blur filter called *Gaussian blur*.

Gaussian blur is based on the Gaussian curve, which is commonly described as a bell-shaped curve giving high values
close to its centre that gradually wear off over distance. As the Gaussian curve has a larger area close to its centre,
using its values as weights to blur an image gives more natural results as samples close by have a higher precedence.
If we for instance sample a 32 × 32 box around a fragment, we use progressively smaller weights the larger the distance
to the fragment; this gives a better and more realistic blur known as Gaussian blur.

To implement a Gaussian blur filter we'd need a two-dimensional box of weights that we can obtain from a 2-dimensional
Gaussian curve equation. The problem with this approach however is that it quickly becomes extremely heavy on
performance: take a blur kernel of 32 by 32 for example, this would require us to sample a texture a total of 1024
times for each fragment!

Luckily for us, the Gaussian equation has a very neat property that allows us to separate the two-dimensional equation
into two smaller one-dimensional equations: one that describes the horizontal weights and the other that describes the
vertical weights. We'd then first do a horizontal blur with the horizontal weights on the scene texture, and then on the
resulting texture do a vertical blur. Due to this property the results are exactly the same, but this time saving us an
incredible amount of performance as we'd now only have to do 32 + 32 samples compared to 1024! This is known as
*two-pass Gaussian blur*.

Our kernel samples the fragment itself and 4 neighbours on each side – 9 samples per direction, with five weights:
0.2270270270 for the centre, then 0.1945945946, 0.1216216216, 0.0540540541 and 0.0162162162 for the neighbours 1 to 4
texels away. They sum to 1.0 (the centre once, the others twice), so the blur doesn't change the image's overall
brightness. (They are the binomial coefficients 924, 792, 495, 220 and 66 of the 12th row of Pascal's triangle, divided
by their sum of 4070 – binomial coefficients are a good approximation of a Gaussian.) One texel is `1.0` divided by the
texture's size in texels.

```quiz
Why does the blur run as separate horizontal and vertical passes?
- [ ] A shader can only read texels in one direction per pass
- [ ] The vertical pass corrects the colours of the horizontal one
- [ ] The texture is clamped to the edge only along one axis at a time
- [x] A 2D Gaussian is the product of two 1D Gaussians, so blurring along x and then along y gives the same result as the full 9 × 9 kernel – with 9 + 9 = 18 samples per fragment instead of 81
---
The saving grows with the kernel: for 32 × 32, 64 samples instead of 1024. The price is an extra pass and a buffer to hold its result.
```

This means we need to blur an image at least two times and this works best with again the use of framebuffer objects.
Specifically for the two-pass Gaussian blur we're going to implement *ping-pong framebuffers*. That is a pair of
framebuffers where we render and swap, a given number of times, the other framebuffer's colour buffer into the current
framebuffer's colour buffer with an alternating shader effect. We basically continuously switch the framebuffer to
render to and the texture to draw with. This allows us to first blur the scene's texture in the first framebuffer, then
blur the first framebuffer's colour buffer into the second framebuffer, and then the second framebuffer's colour buffer
into the first, and so on.

Why two? A pass cannot read the texture it is drawing into – a fragment would read texels that neighbouring fragments
of the same pass may already have overwritten (the APIs forbid it, or leave the result undefined). So every pass reads one buffer and
writes the other.

learnopengl does **10 passes**, starting with a horizontal one: horizontal, vertical, horizontal, … – five horizontal
and five vertical. Each horizontal-and-vertical pair is one 9 × 9 Gaussian blur; blurring the blurred image again
widens the blur, so five pairs give a much softer, wider glow than one. The first pass reads the bright colour buffer;
every later pass reads the buffer the previous one wrote. The two-element arrays are indexed with the `bool
horizontal`: a horizontal pass draws into buffer 1 (`horizontal` = true = 1) and reads buffer 0 (`!horizontal`), and
then `horizontal` flips. After the 10th pass – a vertical one into buffer 0 – `horizontal` is true again, so the last
result is in buffer `[!horizontal]`, buffer 0.

```quiz
Why does the blur need two ping-pong buffers instead of blurring the bright buffer in place?
- [x] A pass cannot read the texture it is drawing into – neighbouring fragments may already have overwritten the texels it needs – so each pass reads one buffer and writes the other
- [ ] One buffer holds the horizontal result for good and the other the vertical one
- [ ] Floating point buffers can only be written once per frame
- [ ] The second buffer keeps a copy for the next frame
---
After every pass the roles switch: the buffer just written is read by the next pass, which writes the other one. The bright buffer is only read, by the first pass.
```

:::opengl
The blur shader, in `blur.fs` – learnopengl's: the weights are a uniform array with an initializer, `horizontal` a
uniform:

```glsl
void main()
{
    vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
    vec3 result = texture(image, TexCoords).rgb * weight[0];
    if(horizontal)
    {
        for(int i = 1; i < 5; ++i)
        {
            result += texture(image, TexCoords + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            result += texture(image, TexCoords - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
        }
    }
    else
    {
        for(int i = 1; i < 5; ++i)
        {
            result += texture(image, TexCoords + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
            result += texture(image, TexCoords - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
        }
    }
    FragColor = vec4(result, 1.0);
}
```

`textureSize(image, 0)` returns the size of the texture's mip level 0 – 800 × 600 – so `tex_offset` is the size of one
texel in texture coordinates. In `main.cpp`, `Shader shaderBlur("blur.vs", "blur.fs");` with
`shaderBlur.setInt("image", 0);`, and the ping-pong framebuffers – two framebuffers, each with one `GL_RGBA16F` colour
texture and no depth buffer (the blur draws only a quad):

```cpp
    // ping-pong-framebuffer for blurring
    unsigned int pingpongFBO[2];
    unsigned int pingpongColorbuffers[2];
    glGenFramebuffers(2, pingpongFBO);
    glGenTextures(2, pingpongColorbuffers);
    for (unsigned int i = 0; i < 2; i++)
    {
        glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[i]);
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, pingpongColorbuffers[i], 0);
        // also check if framebuffers are complete (no need for depth buffer)
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
            std::cout << "Framebuffer not complete!" << std::endl;
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Between the scene and the final pass, the 10 blur passes:

```cpp
        // 2. blur bright fragments with two-pass Gaussian Blur
        // --------------------------------------------------
        bool horizontal = true, first_iteration = true;
        unsigned int amount = 10;
        shaderBlur.use();
        for (unsigned int i = 0; i < amount; i++)
        {
            glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]);
            shaderBlur.setInt("horizontal", horizontal);
            glBindTexture(GL_TEXTURE_2D, first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]);  // bind texture of other framebuffer (or scene if first iteration)
            renderQuad();
            horizontal = !horizontal;
            if (first_iteration)
                first_iteration = false;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

For now, the final pass shows the blurred result: bind `pingpongColorbuffers[!horizontal]` instead of
`colorBuffers[1]`. Now do the task **blur**, and delete the ping-pong textures and framebuffers at the end.
:::
:::vulkan
The blur shader, `blur.frag`, first needs the blur's direction. It's a push constant: `PushConstants` gets a
`VkBool32 horizontal;` after `lightColor` (a GLSL `bool` is 4 bytes, at offset 76 right after the `vec3`), and the shader
declares the block up to it:

```glsl
// the push constants up to horizontal: blur along x (true) or along y (false)
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
    bool horizontal;
} pc;
```

The weights are a `const float weight[5]` in the shader – learnopengl declares them as a `uniform` array with an
initializer, but GLSL for Vulkan has no uniforms outside blocks (other than samplers and images), and a constant array
is what they are anyway. Then learnopengl's `main`:

```glsl
void main() {
    vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
    vec3 result = texture(image, fragTexCoord).rgb * weight[0];
    if (pc.horizontal) {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
        }
    } else {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
        }
    }
    outColor = vec4(result, 1.0);
}
```

`textureSize(image, 0)` returns the size of the image's mip level 0 – 800 × 600 – so `tex_offset` is the size of one
texel in texture coordinates.

In Vulkan an image that a render pass draws into can't be sampled in that same render pass – while the pass runs, the
image is in `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` – so every blur pass is a **render pass of its own**: `createBlurRenderPass()` has one floating point colour attachment and no depth. Its old contents aren't needed –
the screen quad covers every pixel – so `loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE` and nothing is cleared; it is
stored and left in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` for the next pass:

```cpp
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Its two subpass dependencies chain the passes: before a pass, wait until the earlier pass's fragment shader has
finished reading this image (it is written again now); after it, make the colour writes visible to the next pass's
fragment shader (or the final pass's). `createPingpongFramebuffers()` creates, in a loop over `i` = 0, 1, an image
(`VK_FORMAT_R16G16B16A16_SFLOAT`, colour attachment + sampled), its view and a framebuffer for `blurRenderPass` – no
depth needed:

```cpp
            createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, pingpongImages[i], pingpongImageMemories[i]);
            pingpongImageViews[i] = createImageView(pingpongImages[i], VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

The blur's pipeline is made for the blur's render pass, with one colour attachment –
`createPipeline("shaders/blur.vert.spv", "shaders/blur.frag.spv", blurRenderPass, 1, blurPipeline)` – and each ping-pong
image gets a descriptor set with `colorBufferSampler`, `pingpongDescriptorSets[i]` (the pool grows to 6 sets).
In `recordCommandBuffer()`, after the scene's render pass, learnopengl's loop records 10 render passes:

```cpp
        bool horizontal = true, first_iteration = true;
        unsigned int amount = 10;
        for (unsigned int i = 0; i < amount; i++) {
            VkRenderPassBeginInfo blurPassInfo{};
            blurPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
            blurPassInfo.renderPass = blurRenderPass;
            blurPassInfo.framebuffer = pingpongFramebuffers[horizontal];
            blurPassInfo.renderArea.offset = {0, 0};
            blurPassInfo.renderArea.extent = swapChainExtent;
            blurPassInfo.clearValueCount = 0; // loadOp DONT_CARE: nothing to clear

            vkCmdBeginRenderPass(commandBuffer, &blurPassInfo, VK_SUBPASS_CONTENTS_INLINE);
            vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, blurPipeline);
            constants.horizontal = horizontal;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
            // the image of the other framebuffer (or the bright image if first iteration)
            VkDescriptorSet imageDescriptorSet = first_iteration ? brightDescriptorSet : pingpongDescriptorSets[!horizontal];
            vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &imageDescriptorSet, 0, nullptr);
            vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad
            vkCmdEndRenderPass(commandBuffer);

            horizontal = !horizontal;
            if (first_iteration)
                first_iteration = false;
        }
```

Note that the loop runs on the CPU while the command buffer is *recorded*: it records 10 render passes with fixed
framebuffers and descriptor sets, which the GPU then executes in order. For now, the final pass shows the blurred
result: it binds `pingpongDescriptorSets[!horizontal]`. Now do the task **blur**, and destroy the ping-pong
framebuffers, views, images and memory, the blur's pipeline and its render pass in `cleanup()`.
:::
:::d3d12
The blur shader, `blur.hlsl`. The weights are already there as `static const float weight[5]` – in HLSL a global
without `static` is a shader input in the default constant buffer `$Globals`, set by the application, and its
initializer would not be used – and the direction comes from
the root constants, `cbuffer BlurConstants : register(b0) { bool horizontal; };`. Its `PSMain`:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float width, height;
    image.GetDimensions(width, height);
    float2 tex_offset = 1.0f / float2(width, height); // gets size of single texel
    float3 result = image.Sample(clampSampler, input.texCoord).rgb * weight[0];
    if (horizontal)
    {
        for (int i = 1; i < 5; ++i)
        {
            result += image.Sample(clampSampler, input.texCoord + float2(tex_offset.x * i, 0.0f)).rgb * weight[i];
            result += image.Sample(clampSampler, input.texCoord - float2(tex_offset.x * i, 0.0f)).rgb * weight[i];
        }
    }
    else
    {
        for (int i = 1; i < 5; ++i)
        {
            result += image.Sample(clampSampler, input.texCoord + float2(0.0f, tex_offset.y * i)).rgb * weight[i];
            result += image.Sample(clampSampler, input.texCoord - float2(0.0f, tex_offset.y * i)).rgb * weight[i];
        }
    }
    return float4(result, 1.0f);
}
```

`GetDimensions` is HLSL's `textureSize`: the texture's width and height in texels, 800 × 600. Unlike the parallax loop
of the *Parallax Mapping* chapter, these loops have a fixed count of 4, so `Sample` is fine in them.

In `main.cpp`, `struct BlurConstants { BOOL horizontal; };` mirrors the cbuffer. The blur gets a PSO,
`m_blurPipelineState`, with the shaders of `blur.hlsl`, one floating point render target and no depth:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(blurVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(blurPixelShader.Get());
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_blurPipelineState)));
```

(`RTVFormats[0]` is still the scene's `DXGI_FORMAT_R16G16B16A16_FLOAT`.) The two ping-pong buffers,
`m_pingpongColorbuffers[2]`, are created like the colour buffers – the same description, starting in
`D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE` – with RTVs in slots `FrameCount + 2 + i` and SRVs in slots `5 + i` (the
heaps grow to `FrameCount + 4` and 7 descriptors). In `PopulateCommandList`, between the scene and the final pass,
learnopengl's loop – each pass with its barrier pair:

```cpp
    bool horizontal = true, first_iteration = true;
    unsigned int amount = 10;
    m_commandList->SetPipelineState(m_blurPipelineState.Get());
    for (unsigned int i = 0; i < amount; i++)
    {
        // The target: ping-pong buffer [horizontal] (RTV heap slot FrameCount + 2 + horizontal).
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_pingpongColorbuffers[horizontal].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
        m_commandList->ResourceBarrier(1, &barrier);
        CD3DX12_CPU_DESCRIPTOR_HANDLE pingpongRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 2 + horizontal, m_rtvDescriptorSize);
        m_commandList->OMSetRenderTargets(1, &pingpongRtvHandle, FALSE, nullptr);

        BlurConstants blurConstants = {};
        blurConstants.horizontal = horizontal;
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(BlurConstants) / 4, &blurConstants, 0);
        // bind texture of other framebuffer (or scene if first iteration): the bright parts'
        // SRV (heap slot 4) or ping-pong buffer [!horizontal]'s (slot 5 + !horizontal)
        CD3DX12_GPU_DESCRIPTOR_HANDLE image(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), first_iteration ? 4 : 5 + !horizontal, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, image);
        m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41

        // Done: the next pass reads it.
        barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_pingpongColorbuffers[horizontal].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);

        horizontal = !horizontal;
        if (first_iteration)
            first_iteration = false;
    }
```

The barrier back to `PIXEL_SHADER_RESOURCE` after each draw is what lets the next pass read what this one wrote. The
loop runs on the CPU while the command list is recorded: it records 10 draws with fixed descriptors, which the GPU then
executes in order. For now, the final pass shows the blurred result: its table 2 points at slot `5 + !horizontal`. Now
do the task **blur**.
:::

Build and run: the **bright parts are blurred**. Soft glowing blobs surround the light cubes – white around the white
one, green around the green one – and the steel edge and the rivets have become soft bands and dots. The middle of the
white cube stays saturated; away from the bright parts everything is still black. Look along a row to the right of the
white cube: where the brightness dropped from white to black in one step, it now fades over a dozen pixels.

## Blending both textures

With the scene's HDR texture and a blurred brightness texture of the scene we only need to combine the two to achieve
the infamous bloom or glow effect. In the final fragment shader we additively blend both textures, before the tone
mapping:

```text
hdrColor = scene + bloomBlur
then tone mapping and gamma correction, as before
```

Interesting to note here is that we add the bloom effect before we apply tone mapping. This way, the added brightness
of bloom is also softly transformed to LDR range with better relative lighting as a result. The blurred brightness is
light in the same units as the scene's – it belongs to the scene's HDR colour, and the sum goes through the same curve.
Where the blurred texture is black, the sum is the scene, unchanged.

```quiz
Why is the blurred brightness added to the scene before the tone mapping, not afterwards?
- [ ] Tone mapping would turn the blurred texture black
- [ ] Adding after the tone mapping is not possible in one shader
- [x] Both are HDR light in the same units: their sum goes through the tone mapping curve, which keeps it below 1.0 and blends the glow smoothly into the scene; added afterwards, glow plus scene would clip to white again
- [ ] The blur only works on gamma-corrected values
---
A tone-mapped colour is already close to 1.0 near the lights; adding more on top of it would be clamped by the window – the problem of the HDR chapter all over again.
```

:::opengl
The final pass needs two textures, so two texture units: the scene on unit 0, the blurred brightness on unit 1. Once,
in the shader configuration:

```cpp
    shaderBloomFinal.setInt("scene", 0);
    shaderBloomFinal.setInt("bloomBlur", 1);
```

and in pass 3:

```cpp
        shaderBloomFinal.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, colorBuffers[0]);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[!horizontal]);
        shaderBloomFinal.setFloat("exposure", exposure);
        renderQuad();
```

`bloom_final.fs` gets `uniform sampler2D bloomBlur;`, and in `main`:

```glsl
    vec3 hdrColor = texture(scene, TexCoords).rgb;
    vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
```

That is learnopengl's `bloom_final.fs` without its `bloom` toggle (learnopengl switches the bloom on and off with the
space bar). Now do the last task, **combine**.
:::
:::vulkan
The final pass needs two images at once. The descriptor set layout gets a second combined image sampler at binding 2,
for the fragment stage:

```cpp
        VkDescriptorSetLayoutBinding bloomBlurLayoutBinding{};
        bloomBlurLayoutBinding.binding = 2;
        bloomBlurLayoutBinding.descriptorCount = 1;
        bloomBlurLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        bloomBlurLayoutBinding.pImmutableSamplers = nullptr;
        bloomBlurLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {uboLayoutBinding, samplerLayoutBinding, bloomBlurLayoutBinding};
```

All sets share the one layout, so every set now has a binding 2; in all but the final pass's set it stays empty. That
is allowed as long as no shader that runs with those sets reads it – and only `bloom_final.frag` does. A new function,
`createBloomDescriptorSet(sceneImageView, bloomBlurImageView, sampler, descriptorSet)`, is `createDescriptorSet` with a
third `VkWriteDescriptorSet` for binding 2. Which ping-pong image holds the result is known when the program starts –
the 10 passes always end with a vertical pass into image 0 – so the set can be made once:

```cpp
        // the 10 blur steps end in ping-pong image 0 (the last, vertical step writes into pingpongImages[0])
        createBloomDescriptorSet(hdrColorImageView, pingpongImageViews[0], colorBufferSampler, bloomDescriptorSet);
```

The pool hands out descriptors by what each set's layout contains: every set takes one uniform buffer and **two**
combined image samplers now, whether binding 2 is written or not. Seven sets take 7 uniform buffers and 14 samplers:

```cpp
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 7;
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 14;
```

with `maxSets = 7`. The final pass binds `bloomDescriptorSet` (the scene now comes through it, so `hdrDescriptorSet` is
no longer bound). `bloom_final.frag` gets `layout(binding = 2) uniform sampler2D bloomBlur;`, and in `main`:

```glsl
    vec3 hdrColor = texture(scene, fragTexCoord).rgb;
    vec3 bloomColor = texture(bloomBlur, fragTexCoord).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);
```

That is learnopengl's `bloom_final.fs` without its `bloom` toggle (learnopengl switches the bloom on and off with the
space bar). Now do the last task, **combine**.
:::
:::d3d12
The final pass needs two textures at once: the scene at t0 and the blurred brightness at t1. Each descriptor table
points at consecutive descriptors in the heap, so one table with two SRVs would need the scene's SRV right before the
blurred one's – and which ping-pong buffer holds the result depends on the number of passes. Two tables need no such
ordering. The root signature gets a third range and a fourth root parameter:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[3];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);
        ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1);
```

```cpp
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL);
```

(`CD3DX12_ROOT_PARAMETER rootParameters[4]`). The other draws never set table 3; that is fine, because their shaders
don't read t1. The final pass sets both tables:

```cpp
    m_commandList->SetPipelineState(m_bloomFinalPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE scene(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, scene);
    CD3DX12_GPU_DESCRIPTOR_HANDLE bloomBlur(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 5 + !horizontal, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, bloomBlur);
```

`bloom_final.hlsl` gets `Texture2D bloomBlur : register(t1);`, and in `PSMain`:

```hlsl
    float3 hdrColor = scene.Sample(clampSampler, input.texCoord).rgb;
    float3 bloomColor = bloomBlur.Sample(clampSampler, input.texCoord).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);
```

That is learnopengl's `bloom_final.fs` without its `bloom` toggle (learnopengl switches the bloom on and off with the
space bar). Now do the last task, **combine**.
:::

:::opengl
```quiz
How does `bloom_final.fs` get two different textures in one draw?
- [ ] It samples `colorBuffers` as an array with two layers
- [x] Two texture units: the samplers `scene` and `bloomBlur` are set to units 0 and 1 with `setInt`, and before the draw `colorBuffers[0]` is bound on `GL_TEXTURE0` and `pingpongColorbuffers[!horizontal]` on `GL_TEXTURE1`
- [ ] `glDrawBuffers` with both textures
- [ ] The second texture is attached to the window's framebuffer
---
A sampler uniform holds the number of a texture unit; `glActiveTexture` picks the unit that `glBindTexture` binds to.
```
:::
:::vulkan
```quiz
The descriptor set layout gets a second sampler at binding 2. Why does the pool now need 14 combined image samplers for 7 sets?
- [ ] Each image needs two descriptors: one for the image, one for the sampler
- [ ] The bloom set needs 8 samplers, the others one each
- [x] Every set is allocated with the one layout, which has two combined image samplers – binding 2 counts even in the six sets that leave it empty
- [ ] Ping-pong images need twice the descriptors of other images
---
A pool hands out what the layouts of its sets contain. Allocating more than the pool holds is an error: the validation layers report it, and `vkAllocateDescriptorSets` may return `VK_ERROR_OUT_OF_POOL_MEMORY`.
```
:::
:::d3d12
```quiz
Why does the final pass use two descriptor tables (root parameters 2 and 3) instead of one table with two SRVs?
- [x] A table points at consecutive descriptors: one table would need the scene's SRV directly before the blurred buffer's, and which ping-pong buffer holds the result depends on the number of passes – two tables can point anywhere
- [ ] A descriptor table can only hold one descriptor
- [ ] t0 and t1 must be in different root signatures
- [ ] Two tables are faster to set than one
---
The scene's SRV is in slot 3, the ping-pong buffers' in 5 and 6: slot 4, the bright buffer, is in between. Two tables take one more root parameter, but no rearranging of the heap.
```
:::

Build and run: the scene is back, and **the light cubes glow**. A soft white halo spreads from the white cube over the
black background and the container above it; the green cube bleeds green over the steel frame next to it; the bright
steel edge of the big container glows too. Away from the bright parts – the floor, the boxes' wood, the background –
nothing has changed. That is the solution, and learnopengl's bloom.

## Final thoughts

The threshold decides what glows, and HDR makes it a natural one: everything brighter than the window can show. In an
LDR scene you'd need a threshold below 1.0 and would see the bright parts of every white wall glow as well.

The blur we used is learnopengl's – a 9-tap kernel, repeated five times in each direction – and its reach is limited:
the glow extends a few dozen pixels, and widening it means more passes, each one a full-screen pass. A common
improvement is to blur at lower resolutions: downsample the bright image to half, quarter, eighth size, blur each
level, and add them up again while upsampling. A blur of a few texels on a small image covers many pixels of the full
one, so the glow can be much wider for less work. learnopengl's guest article *Physically Based Bloom* builds such a
chain – and leaves out the threshold altogether, adding a little of the whole blurred scene instead, so that bright
things don't snap from "no glow" to "glow" as their brightness passes 1.0.

Tune the effect to taste: the threshold, the number of blur passes, the strength with which the blur is added (a
factor before `+=`). Bloom is the first of the effects that take the HDR picture as their input; the rest of this part
builds on the same idea of rendering into several buffers and combining them in a final pass.

## Additional resources

:::opengl
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengl's chapter this chapter follows, with
  pictures of each step.
- [bloom.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/7.bloom/bloom.cpp):
  learnopengl's program, with the Space, Q and E keys.
- [glDrawBuffers](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawBuffers.xhtml): which colour
  attachments the fragment shader's outputs go to.
:::
:::vulkan
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengl's chapter this chapter follows, with
  pictures of each step.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial on attachments, subpasses and attachment references.
- [Descriptor pool and sets](https://vulkan-tutorial.com/Uniform_buffers/Descriptor_pool_and_sets): vulkan-tutorial on
  descriptor pools and allocating sets.
:::
:::d3d12
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengl's chapter this chapter follows, with
  pictures of each step.
- [ID3D12GraphicsCommandList::OMSetRenderTargets](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-omsetrendertargets):
  binding several render targets, and the meaning of `RTsSingleHandleToDescriptorRange`.
- [Semantics (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics):
  `SV_Target[n]` and the other system-value semantics.
:::
