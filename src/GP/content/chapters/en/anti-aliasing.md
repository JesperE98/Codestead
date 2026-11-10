# Anti Aliasing

Somewhere in your adventurous rendering journey you probably came across some jagged saw-like patterns along the edges
of your models. The reason these *jagged edges* appear is due to how the rasterizer transforms the vertex data into
actual fragments behind the scene. A pixel is either inside a triangle or it isn't; an edge that runs at a slant
through the grid of pixels therefore becomes a staircase. This effect, of clearly seeing the pixel formations an edge
is composed of, is called *aliasing*. There are quite a few techniques out there called *anti-aliasing* techniques
that fight this aliasing behavior by producing *smooth* edges.

At first we had a technique called *super sample anti-aliasing* (SSAA) that temporarily uses a much higher resolution
render buffer to render the scene in (super sampling). Then when the full scene is rendered, the resolution is
downsampled back to the normal resolution. This *extra* resolution was used to prevent these jagged edges. While it
did provide us with a solution to the aliasing problem, it came with a major performance drawback since we have to
draw **a lot** more fragments than usual: four times the pixels means four times the work for every fragment shader.
This technique therefore only had a short glory moment.

This technique did give birth to a more modern technique called *multisample anti-aliasing* or MSAA that borrows from
the concepts behind SSAA while implementing a much more efficient approach. In this chapter we'll be extensively
discussing this MSAA technique, as every graphics API has it built in.

:::opengl
The project is learnopengl's scene: one cube at the origin, flat green, on the dark (0.1, 0.1, 0.1) background, seen by
the camera at (0, 0, 3) – WASD, the mouse and the scroll wheel still move it. One thing is different from learnopengl:
the cube is turned by a fixed 30° about the axis (1, 1, 0). learnopengl's unrotated cube, seen from the front, is a
square with horizontal and vertical edges, which show no stairs at all – so anti-aliasing would change nothing you
could see. The shaders are `anti_aliasing.vs/.fs`; `aa_post.vs/.fs`, for a screen quad, are used from the `resolve`
task on.
:::
:::vulkan
The project is learnopengl's scene in the program of the earlier chapters: one cube at the origin, flat green, on the
dark (0.1, 0.1, 0.1) background, seen by the camera at (0, 0, 3) – WASD, the mouse and the scroll wheel still move it.
`createPipeline(vert, frag, attributeCount, pipeline)` creates the cube's pipeline (the cube's shaders only read the
position), view and projection are in the uniform buffer, the model matrix is a push constant. One thing is different
from learnopengl: the cube is turned by a fixed 30° about the axis (1, 1, 0). learnopengl's unrotated cube, seen from
the front, is a square with horizontal and vertical edges, which show no stairs at all – so anti-aliasing would change
nothing you could see. The shaders are `shaders/anti_aliasing.vert/.frag`; `shaders/aa_post.vert/.frag`, for a screen
quad, are used from the `resolve` task on.
:::
:::d3d12
The project is learnopengl's scene: one cube at the origin, flat green, on the dark (0.1, 0.1, 0.1) background, seen by
the camera at (0, 0, 3) – WASD, the mouse and the wheel still move it. The root constants hold the model matrix (b0),
the constant buffer view and projection (b1); the shaders are in `anti_aliasing.hlsl`. One thing is different from
learnopengl: the cube is turned by a fixed 30° about the axis (1, 1, 0). learnopengl's unrotated cube, seen from the
front, is a square with horizontal and vertical edges, which show no stairs at all – so anti-aliasing would change
nothing you could see. `aa_post.hlsl`, for a screen quad, is used from the `resolve` task on.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator. Right now it shows the green silhouette of the
cube – a hexagon of three faces, all the same green – with hard, stair-stepped edges: every pixel is either exactly
green or exactly the background. Zoom in on a slanted edge in your mind's eye and you see the staircase.

## Multisampling

To understand what multisampling is and how it works into solving the aliasing problem we first need to delve a bit
further into the inner workings of the rasterizer.

The rasterizer is the combination of all algorithms and processes that sit between your final processed vertices and
the fragment shader. The rasterizer takes all vertices belonging to a single primitive and transforms this to a set of
fragments. Vertex coordinates can theoretically have any coordinate, but fragments can't since they are bound by the
resolution of your screen. There will almost never be a one-on-one mapping between vertex coordinates and fragments,
so the rasterizer has to determine in some way what fragment/screen-coordinate each specific vertex will end up at.

Without multisampling, each pixel has a single *sample point* in its centre that is used to determine if the pixel is
covered by the triangle. If the sample point is covered by the triangle, a fragment is generated for that covered
pixel; if not, the pixel stays as it is – even when the triangle covers most of the pixel except its centre. Due to
the limited amount of screen pixels, some pixels will be rendered along an edge and some won't. The result is that
we're rendering primitives with non-smooth edges giving rise to the jagged edges we've seen before.

What multisampling does, is not use a single sampling point for determining coverage of the triangle, but multiple
sample points (guess where it got its name from). Instead of a single sample point at the center of each pixel we're
going to place 4 *subsamples* in a general pattern and use those to determine pixel coverage. This means the colour
buffer has to grow too: it now stores a colour for every sample, 4 per pixel.

A triangle that covers only some of a pixel's subsamples is still drawn for that pixel. Here comes the efficient part:
instead of running the fragment shader for every covered subsample (that would be SSAA again), **the fragment shader
runs only once per pixel** (per primitive), no matter how many subsamples the triangle covers – with the vertex data
interpolated to the centre of the pixel. Its single output colour is then stored in every subsample the triangle
covers. The subsamples the triangle doesn't cover keep what was there before – the background, say.

Once all primitives are drawn, the samples of each pixel are combined: the final pixel colour is the average of its
subsamples. This step is called *resolving* the multisampled buffer. A pixel on the edge of the cube whose 4 samples are
2 green and 2 background ends up halfway between the two colours; with 1 or 3 green samples it is a quarter or three
quarters green. That's exactly what makes the edge look smooth: the more sample points covered, the more the pixel
colour is determined by the triangle.

For depth testing the same holds: the depth buffer is multisampled as well, with the same number of samples. The
vertex's depth value is interpolated to each subsample before running the depth test, and the stencil test likewise
stores a stencil value per subsample. This does mean that the size of the buffers are now increased by the amount of
samples per pixel.

```quiz
With 4x MSAA, a triangle covers 2 of a pixel's 4 samples. How often does the fragment shader run for this pixel and triangle, and what does the pixel show after the resolve?
- [ ] 2 times, once per covered sample; the pixel shows the triangle's colour
- [ ] 4 times, once per sample; the pixel shows the average of four shader results
- [x] Once; its colour is stored in the 2 covered samples, and the resolved pixel is half the triangle's colour, half what the other 2 samples hold
- [ ] Not at all, because the pixel's centre may not be covered
---
That's the trick of MSAA compared to SSAA: coverage (and depth) is tested per sample, but the fragment shader runs once per pixel and primitive. The resolve averages the samples, so an edge pixel gets a mix in proportion to its coverage.
```

What we've discussed so far is a basic overview of how multisampled anti-aliasing works behind the scenes. The actual
logic behind the rasterizer is a bit more complicated, but this brief description should be enough to understand the
concept and logic behind multisampled anti-aliasing; enough to delve into the practical aspects.

## MSAA in {{api}}

:::opengl
If we want to use MSAA in OpenGL we need to use a buffer that is able to store more than one sample value per pixel.
We need a new type of buffer that can store a given amount of multisamples and this is called a *multisample buffer*.

Most windowing systems are able to provide us a multisample buffer instead of a default buffer. GLFW also gives us this
functionality and all we need to do is *hint* GLFW that we'd like to use a multisample buffer with N samples instead
of a normal buffer by calling `glfwWindowHint` before creating the window. When we now call `glfwCreateWindow` we
create a rendering window, but this time with a buffer containing 4 subsamples per screen coordinate. This does mean
that the size of the buffer is increased by 4.

Now that we asked GLFW for multisampled buffers we need to enable multisampling by calling `glEnable` with
`GL_MULTISAMPLE`. On most OpenGL drivers, multisampling is enabled by default so this call is then a bit redundant,
but it's usually a good idea to enable it anyways. This way all OpenGL implementations have multisampling enabled.

Now do the first task, **msaa**. Next to the other window hints, before the window is created:

```cpp
    glfwWindowHint(GLFW_SAMPLES, 4); // a multisample buffer with 4 samples per pixel
```

and after `glEnable(GL_DEPTH_TEST);`:

```cpp
    glEnable(GL_MULTISAMPLE); // enabled by default on some drivers, but not all so always enable to make sure
```

Because the actual multisampling algorithms are implemented in the rasterizer in your OpenGL drivers there's not much
else we need to do. If we now were to render the green cube from the start of this chapter we should see smoother
edges.

Press **Build & run**: the cube's edges are smooth now. About 800 pixels along the edges are no longer pure green or
pure background, but mixes of a quarter, a half and three quarters green. Whether a real window gets a multisample
buffer depends on the window system and driver: where none is available, GLFW quietly creates a window without one,
and the edges stay jagged. The next section's off-screen version doesn't depend on that.
:::
:::vulkan
In OpenGL, MSAA starts with a window hint: GLFW asks the window system for a multisampled default framebuffer
(`glfwWindowHint(GLFW_SAMPLES, 4)`), and the driver resolves it when the picture is shown. Vulkan has no such thing:
the swap chain's images always have one sample per pixel. Multisampling in Vulkan means drawing into a **multisampled
colour image of our own** (with a depth image of the same sample count) and **resolving** it – averaging each pixel's
samples – into the one-sample swap chain image at the end of the render pass. That is OpenGL's next section,
*off-screen MSAA*, and it is what vulkan-tutorial's *Multisampling* chapter does. So in Vulkan learnopengl's two steps
are one.

### Getting available sample count

Let's start off by determining how many samples our hardware can use. Most modern GPUs support at least 8 samples, but
this number is not guaranteed to be the same everywhere. The physical device's limits tell us which counts we can use
for colour and for depth attachments; since we use both, we take the counts both support.

Now do the first task, **sample-count**. Add a member for the sample count:

```cpp
    VkSampleCountFlagBits msaaSamples = VK_SAMPLE_COUNT_1_BIT; // samples per pixel
```

and a function that finds it:

```cpp
    // The number of samples per pixel to use: 4 like learnopengl, if the device has them for colour and depth images
    // (vulkan-tutorial takes the most the device offers, up to 64).
    VkSampleCountFlagBits getMaxUsableSampleCount() {
        VkPhysicalDeviceProperties physicalDeviceProperties;
        vkGetPhysicalDeviceProperties(physicalDevice, &physicalDeviceProperties);

        VkSampleCountFlags counts = physicalDeviceProperties.limits.framebufferColorSampleCounts & physicalDeviceProperties.limits.framebufferDepthSampleCounts;
        if (counts & VK_SAMPLE_COUNT_4_BIT) { return VK_SAMPLE_COUNT_4_BIT; }
        if (counts & VK_SAMPLE_COUNT_2_BIT) { return VK_SAMPLE_COUNT_2_BIT; }

        return VK_SAMPLE_COUNT_1_BIT;
    }
```

vulkan-tutorial checks from `VK_SAMPLE_COUNT_64_BIT` downwards and takes the most the device offers; we stop at 4,
learnopengl's count, so the picture is the same on every GPU. (Every Vulkan device supports at least 1 and 4 samples
for these attachments.) In `pickPhysicalDevice()`, at the TODO, right after `physicalDevice = device;`:

```cpp
                msaaSamples = getMaxUsableSampleCount();
```

The images we're about to create need to know their sample count, so `createImage()` gets a parameter for it, after
the height, which ends up in `imageInfo.samples`:

```cpp
    void createImage(uint32_t width, uint32_t height, VkSampleCountFlagBits numSamples, VkFormat format,
```

```cpp
        imageInfo.samples = numSamples;
```

For now the depth image passes `VK_SAMPLE_COUNT_1_BIT`. Press **Build & run**: nothing changes yet – we only found out
what we can use.

### Setting up a render target

In MSAA, each pixel is sampled in an offscreen buffer which is then rendered to the screen. This new buffer is slightly
different from regular images we've been rendering to – they have to be able to store more than one sample per pixel.
Once a multisampled buffer is created, it has to be resolved to the default framebuffer (which stores only a single
sample per pixel). This is why we have to create an additional render target and modify our current drawing process.
We only need one render target since only one drawing operation is active at a time, just like with the depth buffer.

Now do the task **msaa**. Add the members `VkImage colorImage; VkDeviceMemory colorImageMemory; VkImageView
colorImageView;` and a function that creates the multisampled colour image, called before `createDepthResources()`:

```cpp
    // The multisampled colour image (and its view) the size of the window. It only lives during the render pass
    // (transient): only the resolved picture is kept.
    void createColorResources() {
        VkFormat colorFormat = swapChainImageFormat;

        createImage(swapChainExtent.width, swapChainExtent.height, msaaSamples, colorFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, colorImage, colorImageMemory);
        colorImageView = createImageView(colorImage, colorFormat, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

`VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT` tells the driver that the image's content is only needed during the render
pass – on GPUs with tile memory it may never be written to real memory at all. Multisampled images also can't have mip
levels: the specification requires one level when there's more than one sample. Destroy the image, its memory and its
view in `cleanup()`.

The depth image gets the same sample count – coverage and depth are tested per sample:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, msaaSamples, depthFormat,
```

### Adding new attachments

Let's take care of the render pass first. In `createRenderPass()`, the colour attachment is now the multisampled image,
and the depth attachment gets the samples too:

```cpp
        colorAttachment.samples = msaaSamples;
```

```cpp
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
```

```cpp
        depthAttachment.samples = msaaSamples; // the depth test is done for every sample
```

You'll notice that we have changed the `finalLayout` from `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` to
`VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`. That's because multisampled images cannot be presented directly. We first
need to resolve them to a regular image. This requirement does not apply to the depth buffer, since it won't be
presented at any point. Therefore we will have only to add one new attachment for colour which is a so-called resolve
attachment – the swap chain image:

```cpp
        // the swap chain image: at the end of the subpass each pixel's samples are averaged ("resolved") into it
        VkAttachmentDescription colorAttachmentResolve{};
        colorAttachmentResolve.format = swapChainImageFormat;
        colorAttachmentResolve.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachmentResolve.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachmentResolve.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachmentResolve.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
```

Its `loadOp` is `DONT_CARE`: every pixel will be overwritten by the resolve. The render pass now has to be instructed
to resolve the multisampled colour image into the regular attachment. Create a new attachment reference that will
point to the colour buffer which will serve as the resolve target, and set it as the subpass's
`pResolveAttachments`:

```cpp
        VkAttachmentReference colorAttachmentResolveRef{};
        colorAttachmentResolveRef.attachment = 2;
        colorAttachmentResolveRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
```

```cpp
        subpass.pResolveAttachments = &colorAttachmentResolveRef;
```

This is enough to let the render pass define a multisample resolve operation which will let us render the image to
screen: at the end of the subpass, each pixel's samples of colour attachment 0 are averaged into resolve attachment 2.
The render pass gets all three attachments – `std::array<VkAttachmentDescription, 3> attachments = {colorAttachment,
depthAttachment, colorAttachmentResolve};` – and the framebuffers get three views in the same order:

```cpp
            std::array<VkImageView, 3> attachments = {
                colorImageView,
                depthImageView,
                swapChainImageViews[i]
            };
```

The colour image is used again every frame, like the depth image, so the subpass dependency now waits for the
previous frame's colour writes as well:

```cpp
        dependency.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT; // the colour image is reused every frame too
```

Finally, tell the pipeline to rasterize with that many samples – it must match the render pass's attachments:

```cpp
        multisampling.rasterizationSamples = msaaSamples; // must match the render pass's attachments
```

Press **Build & run**: the cube's edges are smooth now. About 800 pixels along the edges are no longer pure green or
pure background, but mixes of a quarter, a half and three quarters green. (Which edge pixel gets which mix depends on
the sample positions: Vulkan's standard 4-sample pattern is OpenGL's mirrored in y, so single edge pixels can differ
from the OpenGL picture.)
:::
:::d3d12
In OpenGL, MSAA starts with a window hint: GLFW asks the window system for a multisampled default framebuffer
(`glfwWindowHint(GLFW_SAMPLES, 4)`), and the driver resolves it when the picture is shown. Direct3D 12 has no
multisampled window: our swap chain uses the flip model (`DXGI_SWAP_EFFECT_FLIP_DISCARD`), and a flip-model swap chain
must have `SampleDesc.Count = 1`. So the scene is drawn into a **multisampled render target** of our own – a texture
with 4 samples per pixel and its own render target view – with a depth buffer of the same sample count and a pipeline
state for 4 samples, and then **resolved** into the back buffer with `ResolveSubresource`: every pixel gets the average
of its samples. That is OpenGL's next section, *off-screen MSAA*, and it is the pattern of Microsoft's own MSAA samples.
So in Direct3D 12 learnopengl's two steps are one.

Now do the first task, **msaa**. Add the sample count next to `FrameCount`, and a member for the render target:

```cpp
    // Multisample anti-aliasing (MSAA): 4 samples per pixel.
    static const UINT SampleCount = 4;
```

```cpp
    ComPtr<ID3D12Resource> m_msaaRenderTarget;    // the multisampled render target: the scene is drawn into it
```

The render target needs a render target view, after the swap chain's in the RTV heap:

```cpp
        rtvHeapDesc.NumDescriptors = FrameCount + 1;    // the swap chain's buffers + the multisampled render target
```

At the TODO in `LoadAssets`, create it. First, check that the device can draw 4 samples per pixel in our format (every
Direct3D 11-class GPU can: from feature level 11_0 on, 4x is required for it), with `CheckFeatureSupport`:

```cpp
        D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels = {};
        qualityLevels.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        qualityLevels.SampleCount = SampleCount;
        qualityLevels.Flags = D3D12_MULTISAMPLE_QUALITY_LEVELS_FLAG_NONE;
        ThrowIfFailed(m_device->CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels, sizeof(qualityLevels)));
        if (qualityLevels.NumQualityLevels == 0)
        {
            throw std::runtime_error("4x MSAA is not supported for DXGI_FORMAT_R8G8B8A8_UNORM");
        }
```

`NumQualityLevels` is the number of quality levels the device offers for this format and sample count; 0 means the
count isn't supported. The quality level is the second half of a `DXGI_SAMPLE_DESC` – vendor-specific patterns; level
0 is always the standard one, and that's what we use. Then the texture itself – as big as the window, one mip level,
`SampleCount` samples at quality 0, allowed to be a render target:

```cpp
        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, optimizedClearColor);

        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC msaaDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, SampleCount, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &msaaDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            &clearValue,
            IID_PPV_ARGS(&m_msaaRenderTarget)));

        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_msaaRenderTarget.Get(), nullptr, rtvHandle);
```

Without a view description, the view fits the resource: a multisampled `D3D12_RTV_DIMENSION_TEXTURE2DMS` view.

Everything that is bound together while drawing must have the same sample count. The depth buffer gets
`SampleCount` samples in its `Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, SampleCount, 0,
D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)` and a multisampled view:

```cpp
        depthStencilDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DMS;    // a multisampled depth buffer
```

and the pipeline state is made for 4 samples:

```cpp
        psoDesc.SampleDesc.Count = SampleCount;    // the render target's samples per pixel: coverage and depth are tested at each of them
```

In `PopulateCommandList` the scene is no longer drawn into the back buffer. Its `PRESENT` → `RENDER_TARGET` barrier
and its RTV handle go; the multisampled target (RTV slot `FrameCount`) takes their place:

```cpp
    // 1. draw scene as normal in the multisampled render target (RTV slot FrameCount)
    // with the multisampled depth buffer
    CD3DX12_CPU_DESCRIPTOR_HANDLE msaaRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &msaaRtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    m_commandList->ClearRenderTargetView(msaaRtvHandle, clearColor, 0, nullptr);
```

After the cube's draw, the multisampled target is resolved into the back buffer. `ResolveSubresource` needs its source
in the `RESOLVE_SOURCE` state and its destination in `RESOLVE_DEST`, so barriers come first, and afterwards both go
back – the target to be drawn into next frame, the back buffer to be presented:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
    m_commandList->ResolveSubresource(m_renderTargets[m_frameIndex].Get(), 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM);

    // And back: the render target for the next frame, the back buffer to be presented.
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RESOLVE_SOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    barriers[1] = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RESOLVE_DEST, D3D12_RESOURCE_STATE_PRESENT);
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
```

The parameters are the destination and its subresource, the source and its subresource, and the format to resolve in
– here both resources have `DXGI_FORMAT_R8G8B8A8_UNORM`, like the swap chain.

Press **Build & run**: the cube's edges are smooth now. About 800 pixels along the edges are no longer pure green or
pure background, but mixes of a quarter, a half and three quarters green.
:::

```quiz
Why does the depth buffer have to be multisampled too, with the same number of samples as the colour buffer?
- [x] The depth test is done per sample: each subsample keeps its own depth, so overlapping triangles are sorted correctly within a pixel
- [ ] Because the resolve averages the depth values too
- [ ] It doesn't have to; any depth buffer works with a multisampled colour buffer
- [ ] So that the fragment shader runs once per sample
---
Coverage and depth are evaluated at every subsample, and a sample's colour is only written if it passes its own depth test. That needs a depth value per sample – and all attachments of one draw must have the same sample count.
```

:::opengl
## Off-screen MSAA

Because GLFW takes care of creating the multisampled buffers, enabling MSAA is quite easy. If we want to use our own
framebuffers however, we have to generate the multisampled buffers ourselves; now we *do* need to take care of creating
multisampled buffers.

There are two ways we can create multisampled buffers to act as attachments for framebuffers: texture attachments and
renderbuffer attachments. Quite similar to normal attachments like we've discussed in the *Framebuffers* chapter.

### Multisampled texture attachments

To create a texture that supports storage of multiple sample points we use `glTexImage2DMultisample` instead of
`glTexImage2D` that accepts `GL_TEXTURE_2D_MULTISAMPLE` as its texture target. The second argument sets the number of
samples we'd like the texture to have. If the last argument is set to `GL_TRUE`, the image will use identical sample
locations and the same number of subsamples for each texel.

To attach a multisampled texture to a framebuffer we use `glFramebufferTexture2D`, but this time with
`GL_TEXTURE_2D_MULTISAMPLE` as the texture type. The currently bound framebuffer now has a multisampled colour buffer
in the form of a texture image.

### Multisampled renderbuffer objects

Like textures, creating a multisampled renderbuffer object isn't difficult. It is even quite easy since all we need
to change is `glRenderbufferStorage` to `glRenderbufferStorageMultisample` when we configure the (currently bound)
renderbuffer's memory storage. The one thing that changed here is the extra second parameter where we set the amount of
samples we'd like to use; 4 in this particular case.

Now do the task **offscreen-msaa**. Remove the `GLFW_SAMPLES` hint – the window no longer needs samples; we do the
multisampling ourselves (`glEnable(GL_MULTISAMPLE)` stays). At the TODO, create the multisampled framebuffer:

```cpp
    // configure MSAA framebuffer
    // --------------------------
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    // create a multisampled color attachment texture
    unsigned int textureColorBufferMultiSampled;
    glGenTextures(1, &textureColorBufferMultiSampled);
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled);
    glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, GL_RGB, SCR_WIDTH, SCR_HEIGHT, GL_TRUE);
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled, 0);
    // create a (also multisampled) renderbuffer object for depth and stencil attachments
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT);
    glBindRenderbuffer(GL_RENDERBUFFER, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

All attachments of a framebuffer must have the same number of samples, or the framebuffer isn't complete.

### Render to multisampled framebuffer

Rendering to a multisampled framebuffer is straightforward. Whenever we draw anything while the framebuffer object is
bound, the rasterizer will take care of all the multisample operations. However, because a multisampled buffer is a bit
special, we can't directly use the buffer for other operations like sampling it in a shader.

A multisampled image contains much more information than a normal image so what we need to do is downscale or
*resolve* the image. Resolving a multisampled framebuffer is generally done through `glBlitFramebuffer` that copies a
region from one framebuffer to the other while also resolving any multisampled buffers.

`glBlitFramebuffer` transfers a given source region defined by 4 screen-space coordinates to a given target region
also defined by 4 screen-space coordinates. You may remember from the *Framebuffers* chapter that if we bind to
`GL_FRAMEBUFFER` we're binding to both the read and draw framebuffer targets. We could also bind to those targets
individually by binding framebuffers to `GL_READ_FRAMEBUFFER` and `GL_DRAW_FRAMEBUFFER` respectively. The
`glBlitFramebuffer` function reads from these two targets to determine which is the source and which is the target
framebuffer. We could then transfer the multisampled framebuffer output to the actual screen by *blitting* the image to
the default framebuffer.

In the render loop, after the window's clear, draw the scene into the multisampled framebuffer:

```cpp
        // 1. draw scene as normal in multisampled buffers
        glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glEnable(GL_DEPTH_TEST);
```

and after the cube's draw, blit it to the window:

```cpp
        // 2. now blit the multisampled buffer to the window's framebuffer: this resolves the samples (their average)
        glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);
```

At the end, delete `textureColorBufferMultiSampled`, `rbo` and `framebuffer`. (A blit into a multisampled window would
need the same sample count and format on both sides – one reason the window no longer asks for samples.)

Press **Build & run**: the same smooth edges as in the `msaa` task – but now the multisampling happens in our own
framebuffer, independent of what the window system offers.
:::
:::vulkan
## Off-screen MSAA

Our multisampled picture already lives in an image of our own: the scene is drawn into `colorImage`, and the render
pass resolves it into the swap chain image. learnopengl's *off-screen MSAA* section – a multisampled framebuffer whose
picture is resolved with `glBlitFramebuffer` – is what the **msaa** task already did. (Vulkan's counterpart of the blit
is `vkCmdResolveImage`, a command that resolves one image into another outside a render pass; the resolve attachment
does the same at the end of the subpass, usually more efficiently.)

But what if we want to use the result of a multisampled framebuffer to do stuff like post-processing? We can't directly
use the multisampled image in the fragment shader like a normal texture. What we can do however is resolve it into a
one-sample image of our own, and sample *that* – exactly the offscreen setup of the *Framebuffers* chapter, with a
resolve on the way.
:::
:::d3d12
## Off-screen MSAA

Our multisampled picture already lives in a texture of our own: the scene is drawn into `m_msaaRenderTarget`, and
`ResolveSubresource` resolves it into the back buffer. learnopengl's *off-screen MSAA* section – a multisampled
framebuffer whose picture is resolved with `glBlitFramebuffer` – is what the **msaa** task already did.

But what if we want to use the result of a multisampled framebuffer to do stuff like post-processing? We can't directly
use the multisampled texture in the pixel shader like a normal texture. What we can do however is resolve it into a
one-sample texture of our own, and sample *that* – exactly the off-screen setup of the *Framebuffers* chapter, with a
resolve on the way.
:::

:::opengl
But what if we wanted to use the texture result of a multisampled framebuffer to do stuff like post-processing? We
can't directly use the multisampled texture(s) in the fragment shader. What we can do however is blit the multisampled
buffer(s) to a different FBO with a non-multisampled texture attachment. We then use this ordinary colour attachment
texture for post-processing, effectively post-processing an image rendered via multisampling. This does mean we have to
generate a new FBO that acts solely as an intermediate framebuffer object to resolve the multisampled buffer into; a
normal 2D texture we can use in the fragment shader.
:::

```quiz
Why can't the screen quad's shader simply sample the multisampled image the way it samples a normal texture?
- [ ] A multisampled image is stored upside down
- [ ] Multisampled images can only be read on the CPU
- [ ] A shader can only read textures that were loaded from a file
- [x] A multisampled image holds several samples per pixel; normal filtered sampling isn't defined for it, so it is first resolved into a one-sample image
---
Filtering, mipmaps and normalized texture coordinates all assume one value per texel. A shader can read single samples of a multisampled image (the last section shows how), but for a normal texture lookup the samples have to be resolved first.
```

:::opengl
Now do the task **resolve**. The screen quad is the one of the *Framebuffers* chapter: learnopengl's `quadVertices`
(6 vertices, an NDC position and texture coordinates each) in `quadVAO` / `quadVBO`, with attribute 0 (2 floats) and 1
(2 floats) and a stride of 4 floats, drawn with `Shader screenShader("aa_post.vs", "aa_post.fs");`. After the MSAA
framebuffer, create the intermediate one:

```cpp
    // configure second post-processing framebuffer
    unsigned int intermediateFBO;
    glGenFramebuffers(1, &intermediateFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, intermediateFBO);
    // create a color attachment texture
    unsigned int screenTexture;
    glGenTextures(1, &screenTexture);
    glBindTexture(GL_TEXTURE_2D, screenTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, screenTexture, 0); // we only need a color buffer

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Intermediate framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

and set `screenShader.setInt("screenTexture", 0);` once. In the render loop, the blit now goes into the intermediate
framebuffer, and a third step draws the quad with its texture into the window:

```cpp
        // 2. now blit multisampled buffer(s) to normal colorbuffer of intermediate FBO. Image is stored in screenTexture
        glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, intermediateFBO);
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);

        // 3. now render quad with scene's visuals as its texture image
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        // draw Screen quad
        screenShader.use();
        glBindVertexArray(quadVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, screenTexture); // use the now resolved color attachment as the quad's texture
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

Delete `quadVAO`, `quadVBO`, `screenTexture` and `intermediateFBO` at the end too.
:::
:::vulkan
Now do the task **resolve**. It splits the frame into two render passes, like the *Framebuffers* chapter: the scene
into images of our own, then a screen quad into the swap chain image.

The multisampled render pass of the last task becomes `createOffscreenRenderPass()` (creating `offscreenRenderPass`).
Its resolve attachment is no longer the swap chain image but `offscreenImage`, an image of our own, and it ends ready
to be read by a shader:

```cpp
        colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

It gets two subpass dependencies, as the offscreen pass of the *Framebuffers* chapter did: before the pass, wait until
the previous frame's screen quad has read `offscreenImage`; after it, the screen quad's fragment shader waits until the
resolve has written it:

```cpp
        // after the pass: the fragment shaders that sample offscreenImage wait until the resolve has written it
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

(`dependencies[0]` waits for `VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT |
VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT` before the colour and depth writes.) `createRenderPass()` becomes the
window's pass: one attachment, the swap chain image, with one sample, cleared, ending in
`VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` – the screen quad needs neither depth nor multisampling. The swap chain framebuffers
go back to one view, `{swapChainImageViews[i]}`.

`createOffscreenFramebuffer()` creates `offscreenImage` – one sample, the swap chain's format, usage
`VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT` – with its view, and `offscreenFramebuffer` with
the three views of the offscreen pass:

```cpp
        std::array<VkImageView, 3> attachments = {
            colorImageView,
            depthImageView,
            offscreenImageView
        };
```

To sample the resolved image, the quad needs a sampler (`createTextureSampler()`: linear filtering, clamp to edge) and
a descriptor: the descriptor set layout gets a `samplerLayoutBinding` (binding 1, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`,
fragment stage), the pool holds two sets of the layout (2 uniform buffers, 2 samplers, `maxSets = 2`), and
`createScreenDescriptorSet()` allocates `screenDescriptorSet` and writes `offscreenImageView` with
`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` into binding 1.

The two pipelines now differ in their render pass, their sample count and their depth test, so `createPipeline()` gets
those as parameters (`multisampling.rasterizationSamples = rasterizationSamples`, `depthStencil.depthTestEnable` and
`depthWriteEnable = depthTestEnable`, `pipelineInfo.renderPass = pipelineRenderPass`):

```cpp
        createPipeline("shaders/anti_aliasing.vert.spv", "shaders/anti_aliasing.frag.spv", 1, offscreenRenderPass, msaaSamples, VK_TRUE, graphicsPipeline);
        createPipeline("shaders/aa_post.vert.spv", "shaders/aa_post.frag.spv", 2, renderPass, VK_SAMPLE_COUNT_1_BIT, VK_FALSE, screenPipeline);
```

The screen quad is learnopengl's `quadVertices`, appended to `vertices` as vertices 36 to 41 (with z = 0). Its texture
coordinates are learnopengl's unchanged: in Vulkan both the window's y and an image's v point down, so the two flips
cancel and the picture shows upright.

In `recordCommandBuffer()`, the cube is drawn in the offscreen pass, and the quad in the window's pass:

```cpp
        // 1. draw scene as normal in the multisampled image; at the end of the pass it is resolved into offscreenImage
        VkRenderPassBeginInfo offscreenPassInfo{};
        offscreenPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        offscreenPassInfo.renderPass = offscreenRenderPass;
        offscreenPassInfo.framebuffer = offscreenFramebuffer;
```

(with the clear values 0.1 for the colour and 1.0 for the depth – the resolve attachment isn't cleared), then the
cube's draw and `vkCmdEndRenderPass`, and:

```cpp
        // 2. the window: a screen-filling quad with the resolved picture as its texture
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = renderPass;
        renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = swapChainExtent;

        // white (not really necessary, the quad covers the whole window)
        VkClearValue clearColor = {{{1.0f, 1.0f, 1.0f, 1.0f}}};
        renderPassInfo.clearValueCount = 1;
        renderPassInfo.pClearValues = &clearColor;

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad's 6 vertices start at vertex 36

        vkCmdEndRenderPass(commandBuffer);
```

Destroy everything new in `cleanup()`: `offscreenRenderPass`, `screenPipeline`, the offscreen image with its memory,
view and framebuffer, and the sampler.
:::
:::d3d12
Now do the task **resolve**. The multisampled render target is now resolved into a normal texture,
`ComPtr<ID3D12Resource> m_screenTexture;`, which a screen-filling quad shows in the back buffer – the off-screen setup
of the *Framebuffers* chapter. The texture has one sample per pixel and a shader resource view in slot 1 of the
CBV/SRV heap (`cbvSrvHeapDesc.NumDescriptors = 2;`); it starts in the state the pixel shader reads it in:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            nullptr,
            IID_PPV_ARGS(&m_screenTexture)));
```

followed by `CreateShaderResourceView(m_screenTexture.Get(), &srvDesc, srvHandle)` with a `TEXTURE2D` view at heap
slot 1. The root signature gets a third parameter, a descriptor table with one SRV at t0 for the pixel shader
(`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`,
`rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`), and a static sampler s0 with
linear filtering.

The screen quad has its own vertex buffer (`m_quadVertexBuffer`, `m_quadVertexBufferView`) with learnopengl's
`quadVertices` – `struct QuadVertex { XMFLOAT2 position; XMFLOAT2 texCoord; }` – but with v flipped, because
Direct3D's v = 0 is the texture's top row. And it has its own pipeline state, `m_screenPipelineState`, made from the
same description with `aa_post.hlsl`'s shaders and the quad's input layout (`POSITION` and `TEXCOORD`, 2 floats each,
at offsets 0 and 8) – and three changes, because the quad is drawn into the back buffer:

```cpp
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        psoDesc.SampleDesc.Count = 1;
```

No depth buffer and no depth test (learnopengl: `glDisable(GL_DEPTH_TEST)`), and one sample: the back buffer has one.

In `PopulateCommandList` the resolve goes into the screen texture instead of the back buffer. Its states are now
`PIXEL_SHADER_RESOURCE` → `RESOLVE_DEST` and back:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(m_screenTexture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
    m_commandList->ResolveSubresource(m_screenTexture.Get(), 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM);
```

(and the reverse two transitions after it). Then the back buffer becomes a render target again, without the depth
buffer, and the quad is drawn with the screen texture:

```cpp
    // 3. now render quad with scene's visuals as its texture image, into the back buffer
    // (no depth buffer)
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    const float screenClearColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, screenClearColor, 0, nullptr);

    // draw Screen quad: root parameter 2 points at the screen texture's SRV (heap slot 1)
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, screenTexture);
    m_commandList->IASetVertexBuffers(0, 1, &m_quadVertexBufferView);
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

and finally the back buffer's barrier `RENDER_TARGET` → `PRESENT`.
:::

Press **Build & run**: nothing changes – the same smooth cube, pixel for pixel. The white clear is completely covered by
the quad. But now the anti-aliased picture is in a texture that a shader reads, so we can change it.

:::opengl
```quiz
In the **offscreen-msaa** task, what does `glBlitFramebuffer` from the multisampled framebuffer to the window's framebuffer do with the samples?
- [ ] It copies the first sample of every pixel
- [x] It resolves them: every pixel of the destination gets the average of the source pixel's samples
- [ ] It copies all samples, so the window becomes multisampled
- [ ] Nothing: a blit cannot read a multisampled framebuffer
---
Blitting from a multisampled read framebuffer into a single-sampled draw framebuffer resolves the samples. That's why the blit both copies the picture and smooths its edges – into the window, or into the intermediate framebuffer's texture.
```
:::
:::vulkan
```quiz
In the **msaa** task, why does the multisampled colour attachment end in `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` instead of `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR`?
- [ ] Present layouts are only allowed for depth attachments
- [ ] The multisampled image is copied to the swap chain with `vkCmdCopyImage` afterwards
- [ ] So that the next frame can skip its clear
- [x] A multisampled image cannot be presented: the resolve attachment – the one-sample swap chain image – is what gets presented
---
The subpass resolves the multisampled image into the resolve attachment at its end. Only that one-sample image goes to the screen, so only it ends in the present layout; the multisampled image just stays a colour attachment for the next frame.
```
:::
:::d3d12
```quiz
Why doesn't the Direct3D 12 project simply create a swap chain with 4 samples per pixel?
- [ ] Swap chains can only have 2 samples
- [ ] Multisampled back buffers cannot be cleared
- [x] A flip-model swap chain (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) must have `SampleDesc.Count = 1`; MSAA needs a multisampled render target that is resolved into the back buffer
- [ ] `ResolveSubresource` would then resolve the picture twice
---
DXGI's flip-model swap chains don't support multisampling. The scene goes into a texture with 4 samples, and `ResolveSubresource` averages them into the single-sampled back buffer (or, from the **resolve** task on, into a texture).
```
:::

## Post-processing the resolved image

With the anti-aliased image in a texture, we can post-process it like in the *Framebuffers* chapter – and the edges
stay smooth, because the effect works on the already resolved image. Let's show it in grey, with learnopengl's weighted
grayscale: the human eye tends to be more sensitive to green colours and the least to blue.

:::opengl
Now do the last task, **post-process**. In `aa_post.fs`:

```glsl
    float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b; // weighted: the eye is most sensitive to green
    FragColor = vec4(vec3(grayscale), 1.0);
```
:::
:::vulkan
Now do the last task, **post-process**. In `shaders/aa_post.frag`:

```glsl
    float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    outColor = vec4(vec3(grayscale), 1.0);
```
:::
:::d3d12
Now do the last task, **post-process**. In `aa_post.hlsl`:

```hlsl
    float grayscale = 0.2126f * col.r + 0.7152f * col.g + 0.0722f * col.b;    // weighted: the eye is most sensitive to green
    return float4(grayscale, grayscale, grayscale, 1.0f);
```
:::

Press **Build & run**: the cube turns grey (0.7152 × 255 ≈ 182), the background stays its dark grey, and the edges are
still smooth, now in shades of grey.

```quiz
The grayscale effect runs on the screen quad, after the resolve. Why are the cube's edges still smooth?
- [ ] The grayscale shader runs once per sample
- [x] The edge pixels of the resolved image already hold the averaged mixes; the effect turns each mix into the matching grey
- [ ] The screen quad is drawn with multisampling too
- [ ] The texture's linear filter blurs the edges
---
Anti-aliasing happened before the effect: the resolved texture has smooth edge colours, and the post-processing shader only maps every pixel to its grey value. Had we post-processed per sample and resolved afterwards – which is what the last section is about – some effects would give different results.
```

Mind one thing, though: if the post-processing shader itself creates hard edges (an edge-detection kernel, for
instance), those are drawn into the one-sample image after the resolve – they get no anti-aliasing. You can solve that
by applying a separate anti-aliasing step to the post-processed image, as many games do.

## Custom Anti-Aliasing algorithm

It is possible to directly pass a multisampled texture image to a shader instead of first resolving it. Shader
languages give us the option to retrieve the texture values per subsample so we can create our own anti-aliasing
algorithms.

:::opengl
To get a texture value per subsample you'd have to define the texture uniform sampler as a `sampler2DMS` instead of
the usual `sampler2D`:

```glsl
uniform sampler2DMS screenTextureMS;
```

Using the `texelFetch` function it is then possible to retrieve the colour value per sample:

```glsl
vec4 colorSample = texelFetch(screenTextureMS, TexCoords, 3);  // 4th subsample
```

Here `TexCoords` are integer pixel coordinates (an `ivec2`), not normalized texture coordinates, and the last argument
is the sample index. We won't go into the details of creating custom anti-aliasing techniques here, but this may be
enough to get started on building one yourself.
:::
:::vulkan
Vulkan's GLSL has the same tools as OpenGL's: the image is declared as a `sampler2DMS` instead of a `sampler2D`, and
`texelFetch` reads one sample at integer pixel coordinates:

```glsl
layout(binding = 1) uniform sampler2DMS screenTextureMS;
```

```glsl
vec4 colorSample = texelFetch(screenTextureMS, ivec2(gl_FragCoord.xy), 3);  // 4th subsample
```

For that, the multisampled image needs `VK_IMAGE_USAGE_SAMPLED_BIT` (and not `TRANSIENT`), must be stored at the end of
the render pass and transitioned to `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`. vulkan-tutorial's chapter ends with a
related, built-in improvement: *sample shading* (the device feature `sampleRateShading`, then
`multisampling.sampleShadingEnable = VK_TRUE` and a `minSampleShading`), which runs the fragment shader for several
samples per pixel – smoothing aliasing *inside* triangles too, such as in high-contrast textures, at a performance cost.
We won't go into the details of creating custom anti-aliasing techniques here, but this may be enough to get started
on building one yourself.
:::
:::d3d12
In HLSL, a multisampled texture is declared as a `Texture2DMS` instead of a `Texture2D`, and its `Load` method reads
one sample at integer pixel coordinates:

```hlsl
Texture2DMS<float4> screenTextureMS : register(t0);
```

```hlsl
float4 colorSample = screenTextureMS.Load(int2(input.position.xy), 3);  // 4th subsample
```

For that, the multisampled texture needs a shader resource view with `D3D12_SRV_DIMENSION_TEXTURE2DMS` and has to be in
the `PIXEL_SHADER_RESOURCE` state while it is read. We won't go into the details of creating custom anti-aliasing
techniques here, but this may be enough to get started on building one yourself.
:::

This was the last chapter of *Advanced OpenGL*. Over its chapters you saw the depth and stencil buffers, blending, face
culling, framebuffers, cube maps, the details of buffers and shaders, geometry shaders, instancing and now
anti-aliasing – each of them for {{api}}. The part's summary and exam follow.

## Additional resources

:::opengl
- [Multisampling](https://www.khronos.org/opengl/wiki/Multisampling): the OpenGL wiki on multisampled framebuffers and
  textures.
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml) and
  [glTexImage2DMultisample](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2DMultisample.xhtml): the
  reference pages.
- [Window hints](https://www.glfw.org/docs/latest/window_guide.html#window_hints_fb): GLFW's framebuffer hints,
  including `GLFW_SAMPLES`.
:::
:::vulkan
- [Multisampling](https://vulkan-tutorial.com/Multisampling): vulkan-tutorial's chapter this chapter follows, including
  sample shading.
- [Rasterization](https://docs.vulkan.org/spec/latest/chapters/primsrast.html): the chapter of the Vulkan
  specification on rasterization, coverage and the standard sample positions.
:::
:::d3d12
- [ID3D12GraphicsCommandList::ResolveSubresource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-resolvesubresource):
  the parameters and the required resource states.
- [DXGI flip model](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-flip-model): why a flip-model
  swap chain has one sample per pixel.
- [Multisampling in UWP apps](https://learn.microsoft.com/en-us/windows/uwp/gaming/multisampling--multi-sample-anti-aliasing--in-windows-store-apps):
  the multisampled render target and resolve pattern (written for Direct3D 11; the steps are the same).
:::
