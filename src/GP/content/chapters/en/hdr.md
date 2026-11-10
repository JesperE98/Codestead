# HDR

Brightness and colour values, by default, are clamped between 0.0 and 1.0 when stored into a framebuffer. This at
first seemingly innocent statement caused us to always specify light and colour values somewhere in this range, trying
to make them fit into the scene. This works okay and gives decent results, but what happens if we walk into a really
bright area with multiple bright light sources whose total sum exceeds 1.0? The answer is that all fragments with a
brightness or colour sum over 1.0 get clamped to 1.0, which isn't pretty to look at: a large area of the picture turns
into one flat white (or flat yellow, or flat red) and every detail in it is lost.

Because a large number of fragments' colour values get clamped to 1.0, each of the bright fragments gets the exact same
white colour value in large regions, losing a significant amount of detail and giving the picture a fake look. A
solution to this problem would be to reduce the strength of the light sources and make sure no area of fragments in
the scene ends up brighter than 1.0. This is not a good solution, as it forces us to use unrealistic lighting
parameters. A better approach is to allow colour values to temporarily exceed 1.0 and transform them back to the
original range of 0.0 to 1.0 as a final step, without losing detail.

Monitors (non-HDR ones) are limited to display colours in the range of 0.0 and 1.0, but there is no such limitation in
lighting equations. By allowing fragment colours to exceed 1.0 we have a much higher range of colour values available
to work in, known as *high dynamic range* (HDR). With high dynamic range, bright things can be really bright, dark
things can be really dark, and details can be seen in both.

High dynamic range was originally only used for photography, where a photographer takes multiple pictures of the same
scene with varying exposure levels, capturing a large range of colour values. Combining these forms an HDR image where
a large range of details are visible based on the combined exposure levels, or a specific exposure it is viewed with.
This is also how our eyes work and the basis of high dynamic range rendering: when there is little light, the eye
adapts itself so the darker parts become more visible, and similarly for bright areas. It's like the eye has an
automatic exposure slider based on the scene's brightness.

HDR rendering works a bit like that. We allow a much larger range of colour values to render to, collecting a large
range of dark and bright details of a scene, and at the end we transform all the HDR values back to the *low dynamic
range* (LDR) of 0.0 to 1.0. This process of converting HDR values to LDR values is called *tone mapping*, and a large
collection of tone mapping algorithms exists that aim to preserve most HDR details during the conversion. These
algorithms often involve an exposure parameter that selectively favours dark or bright regions.

When it comes to real-time rendering, high dynamic range allows us not only to exceed the LDR range of [0.0, 1.0] and
preserve more detail, but also gives us the ability to specify a light source's intensity by its real intensity. For
instance, the sun has a much higher intensity than something like a flashlight, so why not configure the sun as such
(a diffuse brightness of 100.0, say)? This allows us to more properly configure a scene's lighting with more realistic
lighting parameters, something that wouldn't be possible with LDR rendering as the values would then directly get
clamped to 1.0.

The technique is the same in every API: draw the scene into a colour buffer that can hold values above 1.0, then draw
that buffer onto the window with a shader that tone-maps it. You have built the second half before – the *Framebuffers*
chapter's off-screen target and screen quad. What is new is the format of the colour buffer and what the screen quad's
shader does with it.

The project is learnopengl's HDR scene: a long wooden tunnel – the 2 × 2 × 2 cube scaled by (2.5, 2.5, 27.5) and moved
to z = 25, so it runs from z = -2.5 to z = 52.5 and is 5 units wide and high – lit by four point lights. Three of them
are dim and coloured and hang near the camera: (-1.4, -1.9, 9) red with a strength of 0.1, (0, -1.8, 4) blue with 0.2,
(0.8, -1.7, 6) green with 0.1. The fourth, at (0, 0, 49.5), 3 units in front of the tunnel's far end, is white with a
strength of **200** – far beyond what an 8-bit colour can hold. The camera is inside the tunnel at (0, 0, 5). We look at
the cube from the inside, so its normals are turned round in the vertex shader (`inverse_normals` – the room of the
*Point Shadows* chapter did the same with `reverse_normals`), and face culling is off. The wood texture is read as an sRGB texture, as in the *Gamma
Correction* chapter.

The lighting is learnopengl's: no ambient light, diffuse only, quadratic attenuation `1.0 / (distance * distance)`
(the right one once lighting happens in linear space), no specular. Two choices differ from learnopengl's program:

- **The camera looks down +z, into the tunnel** (a yaw of +90°; the camera's front vector is (0, 0, 1)). learnopengl's
  demo starts at the same position, but its camera looks down -z, at the tunnel's near end wall 7.5 units away, which
  is almost black; you would have to turn round with the mouse to see anything. Here the tunnel and its bright end lie
  straight ahead.
- **Four lights, not sixteen.** learnopengl's shader declares `Light lights[16]` and sets four; the other twelve are
  zero and add nothing. The course declares exactly four, so that the explicit APIs can put exactly four lights into
  their uniform (constant) buffer.

:::opengl
`main.cpp` draws the tunnel with `lighting.vs` / `lighting.fs`, straight into the window; `lighting.fs` ends as in the
*Gamma Correction* chapter, gamma-correcting its own result:

```glsl
    const float gamma = 2.2;
    FragColor = vec4(pow(ambient + lighting, vec3(1.0 / gamma)), 1.0);
```

The lights are uniforms `lights[i].Position` and `lights[i].Color`, set in a loop over two `std::vector<glm::vec3>`.
Two more shader files are there for the second half: `hdr.vs`, which is complete (the screen quad: positions already in
normalized device coordinates, no matrices), and `hdr.fs`, whose `main` is still a TODO. learnopengl's `renderQuad()`
is in `main.cpp` too, unused so far.
:::
:::vulkan
`recordCommandBuffer()` draws the tunnel – vertices 0..35 of the one vertex buffer – into the window's render pass with
`shaders/lighting.vert` / `.frag`. The model matrix and `inverse_normals` are push constants (`struct PushConstants {
glm::mat4 model; VkBool32 inverse_normals; }` – a GLSL `bool` in a block is 4 bytes); view, projection, the lights and
`viewPos` are in the uniform buffer:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float pad1;
};
```

std140 puts the elements of an array 16 bytes apart, so the positions and colours are `vec4`s of which the shader uses
only `xyz` – the same rule as the *Gamma Correction* chapter's light arrays. `updateUniformBuffer()` copies the global
`lightPositions` and `lightColors` into them in a `for` loop. `lighting.frag` gamma-corrects its own result, as in the
*Gamma Correction* chapter:

```glsl
    vec3 result = pow(ambient + lighting, vec3(1.0 / 2.2));
    outColor = vec4(result, 1.0);
```

Two more shaders are there for the second half: `shaders/hdr.vert`, which is complete (the screen quad: positions
already in normalized device coordinates, no matrices), and `shaders/hdr.frag`, whose `main` is still a TODO.
`createPipeline(vertFile, fragFile, pipelineRenderPass, pipeline)` takes the render pass the pipeline is made for – you
will need that.
:::
:::d3d12
`PopulateCommandList` draws the tunnel – vertices 0–35 of the one vertex buffer – into the back buffer with the depth
buffer, using the shaders of `lighting.hlsl`. The model matrix, the normal matrix and `BOOL inverseNormals` are 33 root
constants (`cbuffer ModelConstants : register(b0)`); view, projection, the lights and `viewPos` are in the constant
buffer (b1):

```cpp
    struct Light
    {
        XMFLOAT3 Position;
        float padding0;
        XMFLOAT3 Color;
        float padding1;
    };
```

Every element of an array starts a new 16-byte row in a constant buffer, and a `float3` never crosses a row, so
`Color` starts the second row and each `float3` is followed by a float of padding. `OnUpdate` copies the global
`lightPositions[]` and `lightColors[]` into `constantBufferData.lights[i]` in a `for` loop. `lighting.hlsl`'s `PSMain`
gamma-corrects its own result, as in the *Gamma Correction* chapter:

```hlsl
    const float gamma = 2.2f;
    float3 result = pow(ambient + lighting, 1.0f / gamma);
    return float4(result, 1.0f);
```

A second shader file, `hdr.hlsl`, is there for the second half: its `VSMain` is complete (the screen quad: positions
already in normalized device coordinates, no matrices), its `PSMain` still returns black – it isn't compiled until you
need it.
:::

The `// TODO:` comments in the project mark where your code goes. Press **Build & run** (Ctrl+Enter) to compile the
program and run it in the built-in simulator: you look down the tunnel, its boards running towards a small square in
the middle of the window – the far end. Near the camera the walls are very dark (only a faint red tint in the
bottom-right corner, from the red light); towards the end they get brighter. And the end itself is **flat white**: the
200-strength light makes the colour there far brighter than 1.0, the window stores 0.0 to 1.0 per channel, and
everything above is cut off at 1.0. The wood's boards are gone from that square – only along its edges, where the blue
channel of the wood is still below 1.0, a little yellow remains.

```quiz
The lighting shader computes the colour (3.5, 2.4, 1.2) for a fragment at the tunnel's end and writes it into the window, whose colour buffer has 8 bits per channel. What is stored?
- [ ] (3.5, 2.4, 1.2): the colour buffer stores what the shader writes
- [x] (1.0, 1.0, 1.0): each channel is clamped to 1.0 – the colour turns white, and the neighbouring fragment, at (3.1, 2.2, 1.1), turns exactly the same white
- [ ] (1.0, 0.69, 0.34): the colour is scaled so that its largest channel becomes 1.0
- [ ] (0.5, 0.34, 0.17): values above 1.0 wrap round
---
A normalized 8-bit channel stores 0 to 255 for 0.0 to 1.0, and the conversion clamps. Every fragment brighter than 1.0 in all channels becomes the same white – that's the lost detail.
```

## Floating point framebuffers

To implement high dynamic range rendering we need some way to prevent colour values getting clamped after each fragment
shader run. When a framebuffer's colour buffer uses a floating point format, it can store floating point values
outside the default range of 0.0 and 1.0. This is perfect for rendering in high dynamic range!

The window's colour buffer uses 8 bits per colour component, normalized: 256 steps between 0.0 and 1.0. A floating
point buffer with 32 bits per component (a normal `float`) could store any value we like, but takes four times the
memory. 16 bits per component – a *half-precision* float – is usually enough: it stores values up to 65504 with about
three significant decimal digits, which is plenty for colours. All three APIs have the format: four 16-bit floats per
texel, red, green, blue and alpha.

| | OpenGL | Vulkan | Direct3D 12 |
|---|---|---|---|
| 8-bit window | the default framebuffer | `VK_FORMAT_B8G8R8A8_UNORM` swap chain image | `DXGI_FORMAT_R8G8B8A8_UNORM` back buffer |
| floating point | `GL_RGBA16F` | `VK_FORMAT_R16G16B16A16_SFLOAT` | `DXGI_FORMAT_R16G16B16A16_FLOAT` |

learnopengl's program uses `GL_RGBA16F`; it mentions `GL_RGB16F` too. The three-channel version is a poorer choice
outside OpenGL: Vulkan does not require devices to render into `VK_FORMAT_R16G16B16_SFLOAT`, and DXGI has no 48-bit
format at all – four channels are what all three APIs can rely on.

The plan is the same as in the *Framebuffers* chapter, in two passes: first we render the lit scene into the floating
point colour buffer, and then display that colour buffer on a screen-filled quad. The lighting shader now writes its
result unchanged – linear and unclipped – and the screen quad's shader reads it back as a texture. Because the texture
holds floats, the values above 1.0 survive the trip.

What about gamma correction? Tone mapping – the next section – works on linear colours, like lighting does; the gamma
correction must come after it, as the very last step before the colour goes into the window. So the `pow(…, 1.0 / 2.2)`
moves out of the lighting shader into the screen quad's shader. Nothing else in the lighting changes.

:::opengl
The framebuffer with its floating point colour buffer is learnopengl's code – the *Framebuffers* chapter's, with
`GL_RGBA16F` as the internal format of the colour texture:

```cpp
    // configure floating point framebuffer
    // ------------------------------------
    unsigned int hdrFBO;
    glGenFramebuffers(1, &hdrFBO);
    // create floating point color buffer
    unsigned int colorBuffer;
    glGenTextures(1, &colorBuffer);
    glBindTexture(GL_TEXTURE_2D, colorBuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // create depth buffer (renderbuffer)
    unsigned int rboDepth;
    glGenRenderbuffers(1, &rboDepth);
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    // attach buffers
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, colorBuffer, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The third argument of `glTexImage2D`, the internal format, is what makes the difference: `GL_RGBA16F` stores half
floats. The last three describe the data we upload – none (`NULL`), so `GL_RGBA` / `GL_FLOAT` only have to be a valid
combination. The tunnel also needs a depth buffer while it is drawn into this framebuffer: the renderbuffer.

The render loop gets learnopengl's two passes around the tunnel's drawing code. Before it:

```cpp
        // 1. render scene into floating point framebuffer
        // -----------------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

and after `renderCube()`:

```cpp
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. now render floating point color buffer to 2D quad and tonemap HDR colors to default framebuffer's (clamped) color range
        // --------------------------------------------------------------------------------------------------------------------------
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        hdrShader.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, colorBuffer);
        renderQuad();
```

with `Shader hdrShader("hdr.vs", "hdr.fs");` next to the other shader and `hdrShader.setInt("hdrBuffer", 0);` in the
shader configuration. `lighting.fs` now ends with

```glsl
    FragColor = vec4(ambient + lighting, 1.0); // linear and unclipped: the floating point buffer keeps values above 1.0
```

and `hdr.fs` reads the floating point colour buffer and only gamma-corrects – no tone mapping yet:

```glsl
void main()
{
    const float gamma = 2.2;
    vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb;
    // no tone mapping yet: only gamma correction (values above 1.0 are still clipped by the window)
    vec3 result = pow(hdrColor, vec3(1.0 / gamma));
    FragColor = vec4(result, 1.0);
}
```

Now do the first task, **float-buffer**, and delete `colorBuffer`, `rboDepth` and `hdrFBO` at the end.
:::
:::vulkan
In Vulkan the floating point framebuffer is three objects you know from the *Framebuffers* chapter: a render pass that
describes the attachments, the images (and their views and memory), and a `VkFramebuffer` that puts the views together
for the render pass. The new render pass, `createHdrRenderPass()`, is a copy of `createRenderPass()` with a different
colour attachment:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // 16-bit floats: values above 1.0 are kept
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the picture: the screen quad reads it
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

The format is the floating point one; the image is not presented but sampled afterwards, so the render pass leaves it
in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` instead of `PRESENT_SRC_KHR`. The depth attachment is the one of
`createRenderPass()` (`findDepthFormat()`, attachment 1). Two subpass dependencies order the pass against what reads
the image: before it, wait until the previous frame's screen quad has finished reading the image (and its depth writes
are done); after it, make the colour writes visible to the fragment shaders that sample the image:

```cpp
        // after the pass: the fragment shaders that sample the image wait until the scene has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

`createHdrFramebuffer()` creates the colour image – the window's size, the floating point format, usable as a colour
attachment **and** as a sampled image –, a depth image of its own, their views, and the framebuffer:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, hdrColorImage, hdrColorImageMemory);
        hdrColorImageView = createImageView(hdrColorImage, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

followed by the depth image (`hdrDepthImage`, `findDepthFormat()`, `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT`) and
`vkCreateFramebuffer` with `hdrRenderPass` and the two views. You don't have to ask whether the device supports the
format: every Vulkan device must be able to render into `VK_FORMAT_R16G16B16A16_SFLOAT` images and sample them with a
linear filter.

A pipeline is created for one render pass and can only be used in render passes compatible with it – the same number
and formats of attachments. The scene's pipeline now draws into the floating point image, the screen quad's into the
window:

```cpp
        // a pipeline is made for one render pass: the scene's pipeline for the floating point target's
        createPipeline("shaders/lighting.vert.spv", "shaders/lighting.frag.spv", hdrRenderPass, graphicsPipeline);
        // the screen quad's pipeline for the window's render pass
        createPipeline("shaders/hdr.vert.spv", "shaders/hdr.frag.spv", renderPass, hdrPipeline);
```

The screen quad is learnopengl's `quadVertices` as six vertices (two triangles) after the cube, 36..41, with the texture
coordinates unchanged: in OpenGL both the window's y and an image's v point up, in Vulkan both point down – the two
flips cancel, and the picture appears upright. Its descriptor set, `hdrDescriptorSet`, is `createDescriptorSet(
hdrColorImageView, textureSampler, hdrDescriptorSet)` – the uniform buffer at binding 0 and the floating point image at
binding 1, in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` as the render pass leaves it. The pool now hands out two sets
(two uniform buffer descriptors, two combined image samplers, `maxSets = 2`).

`recordCommandBuffer()` records two render passes. The first, with `hdrRenderPass` and `hdrFramebuffer`, draws the
tunnel exactly as before; the second, the window's, draws the screen quad:

```cpp
        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // the screen quad with the floating point image as its texture (the viewport, scissor and vertex buffer set
        // above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, hdrPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &hdrDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad's 6 vertices start at vertex 36

        vkCmdEndRenderPass(commandBuffer);
```

`lighting.frag` now ends with

```glsl
    // into the floating point target: values above 1.0 are kept (the screen quad gamma-corrects)
    outColor = vec4(ambient + lighting, 1.0);
```

and `hdr.frag` reads the floating point image and only gamma-corrects – no tone mapping yet:

```glsl
void main() {
    const float gamma = 2.2;
    vec3 hdrColor = texture(hdrBuffer, fragTexCoord).rgb;
    // no tone mapping yet: only gamma correction - values above 1.0 are still cut off by the window
    vec3 result = pow(hdrColor, vec3(1.0 / gamma));
    outColor = vec4(result, 1.0);
}
```

Now do the first task, **float-buffer**, and destroy the new framebuffer, views, images, memory, pipeline and render
pass in `cleanup()`.
:::
:::d3d12
The floating point colour buffer is the *Framebuffers* chapter's off-screen render target with a floating point
format: a default-heap texture that can be a render target, a render target view to draw into it and a shader resource
view to read it:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);

        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R16G16B16A16_FLOAT, optimizedClearColor);

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_colorBuffer)));
```

The render target view goes into the RTV heap after the swap chain's buffers (slot `FrameCount`, so the heap needs
`FrameCount + 1` descriptors), the shader resource view – `DXGI_FORMAT_R16G16B16A16_FLOAT`, `TEXTURE2D`, one mip
level – into slot 2 of the CBV/SRV heap (which needs 3). The scene keeps using the depth buffer it has.

A pipeline state object is compiled for the formats it renders into, and they must match what is bound when it draws.
The scene's PSO now renders into the floating point buffer:

```cpp
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
```

and the screen quad gets a PSO of its own, `m_hdrPipelineState`, with the shaders of `hdr.hlsl`, the back buffer's
format and no depth buffer:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(hdrVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(hdrPixelShader.Get());
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_hdrPipelineState)));
```

The screen quad is learnopengl's `renderQuad()` as six vertices (two triangles) after the cube, 36–41, with v = 0 at
the top: in Direct3D the top of the window is y = +1 in normalized device coordinates and the top row of a texture is
v = 0.

`PopulateCommandList` now has two passes. The first turns the colour buffer into a render target and draws the tunnel
into it:

```cpp
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffer.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE hdrRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &hdrRtvHandle, FALSE, &dsvHandle);
```

(cleared, the tunnel drawn as before). The second turns it back into a shader resource, then the back buffer into a
render target – bound without a depth buffer –, and draws the screen quad with the colour buffer as its texture:

```cpp
    m_commandList->SetPipelineState(m_hdrPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE hdrBuffer(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, hdrBuffer);
    m_commandList->DrawInstanced(6, 1, 36, 0);
```

`lighting.hlsl` now returns the colour as it is:

```hlsl
    // The colour as it is: linear, and far above 1.0 near the bright light. The screen quad
    // tone-maps and gamma-corrects it.
    return float4(ambient + lighting, 1.0f);
```

and `hdr.hlsl`'s `PSMain` reads the floating point buffer and only gamma-corrects – no tone mapping yet:

```hlsl
    const float gamma = 2.2f;
    float3 hdrColor = hdrBuffer.Sample(wrapSampler, input.texCoord).rgb;
    float3 result = pow(hdrColor, 1.0f / gamma);
    return float4(result, 1.0f);
```

Now do the first task, **float-buffer**.
:::

:::opengl
```quiz
What makes `colorBuffer` able to hold the light's 200-strength colours?
- [ ] `GL_FLOAT` as the type argument of `glTexImage2D`
- [ ] `GL_LINEAR` filtering
- [ ] Attaching it with `glFramebufferTexture2D` instead of a renderbuffer
- [x] The internal format `GL_RGBA16F`: four half-precision floats per texel; `GL_RGBA` / `GL_FLOAT` only describe the (absent) data we upload
---
The internal format decides how the texture stores its texels. With `GL_RGBA` as the internal format it would be 8-bit normalized again, whatever the type argument says.
```
:::
:::vulkan
```quiz
The scene's pipeline was created for the window's render pass. Why must it now be created with `hdrRenderPass`?
- [x] A pipeline can only be used in a render pass compatible with the one it was made for – the same number and formats of attachments – and the floating point colour attachment has a different format than the swap chain image
- [ ] `hdrRenderPass` has a depth attachment and the window's has none
- [ ] Pipelines can only draw into images that will be sampled
- [ ] The vertex shader needs to know where its output goes
---
Both render passes have a colour and a depth attachment, but the colour formats differ: `VK_FORMAT_R16G16B16A16_SFLOAT` vs. `VK_FORMAT_B8G8R8A8_UNORM`. The screen quad's pipeline, in turn, is made for the window's render pass.
```
:::
:::d3d12
```quiz
Why does the screen quad need a pipeline state object of its own, `m_hdrPipelineState`?
- [ ] Each PSO can draw only one mesh
- [ ] The back buffer can only be drawn into by the first PSO created
- [x] A PSO is compiled for its shaders and for the formats it renders into: the screen quad has other shaders, renders into the 8-bit back buffer instead of the floating point buffer, and has no depth buffer bound (`DSVFormat = DXGI_FORMAT_UNKNOWN`, no depth test)
- [ ] Root signatures cannot be shared between PSOs
---
`RTVFormats` and `DSVFormat` must match the views bound with `OMSetRenderTargets` when the PSO draws. Both PSOs share the root signature.
```
:::

Press **Build & run**: **nothing changes**. The far end is as flat white as before. That is expected: the floating point
buffer now holds the true colours, 200-light and all, but the screen quad's shader writes them unchanged (only
gamma-corrected) into the 8-bit window – where they are clamped, exactly as before. Keeping the values isn't enough;
something has to map them into 0.0 to 1.0.

## Tone mapping

Tone mapping is the process of transforming floating point colour values to the expected [0.0, 1.0] range known as low
dynamic range, without losing too much detail, often accompanied with a specific stylistic colour balance.

One of the simpler tone mapping algorithms is *Reinhard tone mapping*, which involves dividing the entire HDR colour
values by themselves plus one:

```text
mapped = hdrColor / (hdrColor + 1.0)
```

It maps 0 to 0, 1 to 0.5, 3 to 0.75, 200 to 0.995 – every value from 0 to infinity to somewhere below 1.0, keeping
the order: a brighter colour stays brighter. And for small values it changes almost nothing, as x / (x + 1) ≈ x when x
is small. Its curve evenly balances out all bright values onto LDR.

:::opengl
In `hdr.fs`, the gamma correction now works on the tone-mapped colour:

```glsl
    // reinhard tone mapping
    vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // also gamma correct while we're at it
    result = pow(result, vec3(1.0 / gamma));
```
:::
:::vulkan
In `hdr.frag`, the gamma correction now works on the tone-mapped colour:

```glsl
    // reinhard tone mapping: 0..infinity -> 0..1
    vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // also gamma correct while we're at it
    result = pow(result, vec3(1.0 / gamma));
```
:::
:::d3d12
In `hdr.hlsl`'s `PSMain`, the gamma correction now works on the tone-mapped colour:

```hlsl
    // reinhard
    float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));
    // also gamma correct while we're at it
    result = pow(result, 1.0f / gamma);
```
:::

Now do the task **reinhard**.

```quiz
Reinhard tone mapping computes `hdrColor / (hdrColor + 1.0)` per channel. Which statement is true?
- [ ] It maps 1.0 to 1.0, so everything up to 1.0 stays as it was
- [ ] It clamps the values above 1.0 more gently, but values above 10 still become 1.0
- [ ] It needs the brightest value of the frame to divide by
- [x] Every value from 0 to infinity ends below 1.0, the order is kept (200 → 0.995, 3 → 0.75, 1 → 0.5), and small values barely change (0.05 → 0.048)
---
No value ever reaches 1.0, so no two different bright colours collapse into the same white. The price: values around 1.0 come out noticeably darker (0.5), which is why the bright parts gain detail while the scene as a whole gets a little darker.
```

Press **Build & run**: **the far end shows its wood again** – the boards are back in the bright square, warm and
detailed, and no pixel is pure white any more. The glow on the walls around it gets a little darker; the dark rest of the
tunnel looks the same, because small values pass through Reinhard almost unchanged.

With Reinhard tone mapping applied we no longer lose any detail on the bright areas of our scene. It does tend to
slightly favour brighter areas, making darker regions seem less detailed and distinct.

### Exposure

Another interesting use of tone mapping is to allow the use of an exposure parameter. You probably remember from the
introduction that HDR images contain a lot of details visible at different exposure levels. If we have a scene that
features a day and night cycle it makes sense to use a lower exposure at daylight and a higher exposure at night time,
similar to how the human eye adapts. With such an exposure parameter we can configure lighting parameters that work
both at day and night under different lighting conditions, as we only have to change the exposure parameter.

A relatively simple exposure tone mapping algorithm looks as follows:

```text
mapped = 1.0 - exp(-hdrColor * exposure)
```

This curve also starts at 0, rises steeply and approaches 1.0 without ever reaching it. The exposure scales the input:
a **higher exposure** pushes the dark values up the steep part of the curve and makes them brighter and more visible,
while the bright values all crowd together near 1.0; a **lower exposure** darkens the dark regions towards black but
spreads the bright values over the curve, bringing out the details in the bright parts. With an exposure of 1.0 the
result is close to Reinhard's – a bit brighter (1.0 maps to 0.63 instead of 0.5).

:::opengl
The exposure is a uniform, set from a global in `main.cpp` (`float exposure = 1.0f;`) before the quad is drawn:

```cpp
        glBindTexture(GL_TEXTURE_2D, colorBuffer);
        hdrShader.setFloat("exposure", exposure);
        renderQuad();
```

In `hdr.fs`, with `uniform float exposure;`, the Reinhard line becomes a comment and the exposure curve takes its place:

```glsl
    // reinhard
    // vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // exposure
    vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
```

That is learnopengl's `hdr.fs`, without the `hdr` toggle. Now do the last task, **exposure**.
:::
:::vulkan
The exposure goes into the uniform buffer, which `hdrDescriptorSet` already has at binding 0. A float fits into the 4
bytes after a `vec3`, so it takes the place of `pad1`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float exposure; // a float fits into the 4 bytes after a vec3
};
```

with a global `float exposure = 1.0f;` and `ubo.exposure = exposure;` in `updateUniformBuffer()`. The descriptor set
layout already makes the uniform buffer visible to the fragment stage (the lighting shader reads the lights from it).
`hdr.frag` declares the block with all members up to `exposure` – the offsets come from the declaration, so the shader
must declare everything before it, even what it doesn't use:

```glsl
// the uniform buffer up to exposure, so that its offset matches the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
    float exposure;
} ubo;
```

and in `main`, the Reinhard line becomes a comment and the exposure curve takes its place:

```glsl
    // reinhard
    // vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // exposure
    vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);
```

That is learnopengl's `hdr.fs`, without the `hdr` toggle. Now do the last task, **exposure**.
:::
:::d3d12
The exposure is one 32-bit value per draw – a root constant. Root parameter 0 already holds the scene's 33 root
constants (`ModelConstants`, register b0); the screen quad uses the same parameter for its own cbuffer at b0 with a
single float:

```cpp
    struct HdrConstants
    {
        float exposure;
    };
```

Until now root parameter 0 was visible only to the vertex shader. The root signature must make every register a shader
uses visible to that shader's stage – otherwise creating the PSO fails – so it becomes visible to all shaders:

```cpp
        rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL);
```

Before the quad is drawn, with a global `float exposure = 1.0f;`:

```cpp
    HdrConstants hdrConstants = {};
    hdrConstants.exposure = exposure;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(HdrConstants) / 4, &hdrConstants, 0);
```

This sets the first of the 33 values; the next frame's tunnel draw sets all 33 again. In `hdr.hlsl`, with

```hlsl
cbuffer HdrConstants : register(b0)
{
    float exposure;
};
```

the Reinhard line becomes a comment and the exposure curve takes its place:

```hlsl
    // reinhard
    // float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));
    // exposure
    float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);
```

That is learnopengl's `hdr.fs`, without the `hdr` toggle. Now do the last task, **exposure**.
:::

Press **Build & run**: the far end is **brighter than with Reinhard, but still shows its boards** – its brightest
middle gets close to white, the edges and the glow around it are a little brighter too. The dark rest of the tunnel is
unchanged.

learnopengl changes the exposure at run time with the Q and E keys (and toggles HDR with the space bar). Here the tasks
switch the code instead, so try other values for the global `exposure` yourself:

- **5.0**: the dark walls near the camera become clearly visible – the boards, the red tint of the red light – while
  the far end and the glow around it saturate to a bright white again. A high exposure shows the dark parts.
- **0.1**: the walls sink into black, but the far end shows its boards in full detail, with no bright spot left.
  A low exposure shows the bright parts.

```quiz
With exposure tone mapping, what does a higher exposure (5.0 instead of 1.0) do?
- [ ] It makes the bright far end show more detail
- [x] It brightens the dark tunnel walls, so their details become visible, while the bright end crowds together near white again
- [ ] It changes nothing: the curve never reaches 1.0
- [ ] It makes the whole picture darker
---
The exposure multiplies the HDR colour before the curve. Dark values move up the steep start of the curve; bright values are pushed to the flat end, where they all look alike. A night scene wants a high exposure, a sunny one a low exposure.
```

```quiz
Why does the gamma correction move from the lighting shader into the screen quad's shader?
- [ ] The floating point buffer stores gamma-corrected colours automatically
- [ ] Gamma correction only works on values above 1.0
- [x] Tone mapping, like lighting, expects linear colours, and gamma correction has to be the last step before the colour goes into the window – so it comes after the tone mapping
- [ ] The screen quad's shader runs fewer times, which makes it faster
---
If the lighting shader gamma-corrected first, the tone mapping curve would bend already bent values. The order is: light in linear space, keep it linear in the floating point buffer, tone-map, gamma-correct.
```

## More HDR

The two tone mapping algorithms shown are only a few of a large collection of (more advanced) tone mapping algorithms,
each of which has its own strengths and weaknesses. Some tone mapping algorithms favour certain colours/intensities
above others and some algorithms display both the low and high exposure colours at the same time to create more
colourful and detailed images. Games often use so-called *filmic* curves, which imitate how photographic film responds
to light.

There is also a collection of techniques known as *automatic exposure adjustment* or *eye adaptation* that determine
the brightness of the scene in the previous frame and (slowly) adapt the exposure parameter such that the scene gets
brighter in dark areas or darker in bright areas, mimicking the human eye.

The real benefit of HDR rendering really shows itself in large and complex scenes with heavy lighting algorithms. The
tunnel is a simple scene, but it already shows the main point: a light 200 times brighter than white, which an LDR
renderer can only show as a white blob. Because HDR rendering makes it possible to work with realistic light
intensities, it is also the basis of the later techniques of this course: bloom, in the next chapter, uses the
brightness above 1.0 to decide what glows.

:::vulkan
A note on the hardware alternative from the *Gamma Correction* chapter: an `_SRGB` swap chain format would do the
final gamma step for us – the screen quad's shader would write linear colours and the hardware would encode them when
storing. The course's projects keep the `B8G8R8A8_UNORM` swap chain, so `hdr.frag` gamma-corrects like learnopengl.
:::
:::d3d12
A note on the hardware alternative from the *Gamma Correction* chapter: an `_SRGB` render target view of the back
buffer would do the final gamma step for us – the screen quad's shader would return linear colours and the hardware
would encode them when storing. The course keeps learnopengl's shader way, so `hdr.hlsl` gamma-corrects in `PSMain`.
:::

## Additional resources

:::opengl
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengl's chapter this chapter follows, with screenshots of
  the tunnel at different exposures.
- [hdr.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/6.hdr/hdr.cpp):
  learnopengl's program, with the Space, Q and E keys.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): the internal formats,
  among them `GL_RGBA16F`.
:::
:::vulkan
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengl's chapter this chapter follows, with screenshots of
  the tunnel at different exposures.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial on attachments, load and store operations and layouts.
- [Formats (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/formats.html): the formats every device
  must support, and for what.
:::
:::d3d12
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengl's chapter this chapter follows, with screenshots of
  the tunnel at different exposures.
- [DXGI_FORMAT](https://learn.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format): the formats,
  among them `DXGI_FORMAT_R16G16B16A16_FLOAT`.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants, as used for the exposure.
:::
