# Framebuffers

So far we've used several types of screen buffers: a colour buffer for writing colour values, a depth buffer to
write and test depth information, and a stencil buffer that allows us to discard certain fragments based on some
condition. The combination of these buffers is stored somewhere in GPU memory and is called a *framebuffer*. Up to
now every picture went straight into the framebuffer of the window – the one whose colour buffer is shown on the
screen. In this chapter we create a framebuffer of our own, draw the scene into it, and then use what we drew as a
texture.

The rendering operations we've done so far were all done on top of the render buffers attached to the window's
framebuffer. Drawing into a framebuffer of our own instead may seem like an unnecessary detour, but it opens a lot of
doors: once the scene is in a texture, a shader can read every pixel of it, and its neighbours, and change the picture
as a whole. This is called *post-processing*, and it is how games make mirrors in a scene, blur the picture, tint
it or run all kinds of other effects over it. Later on, shadow maps use the same technique: the scene is drawn into
a depth texture from the light's point of view.

:::opengl
OpenGL calls such a framebuffer a *framebuffer object* (FBO). The window's framebuffer, the one GLFW created for us
together with the context, is the *default framebuffer*, and OpenGL draws into it unless we bind another one.
:::
:::vulkan
Vulkan has no default framebuffer that the API draws into on its own: you have always drawn into an image of your
own choosing. In vulkan-tutorial's *Framebuffers* chapter you wrapped every swap chain image (and the depth image)
in a `VkFramebuffer` for your render pass, and `recordCommandBuffer()` begins that render pass with the framebuffer of
the image that `vkAcquireNextImageKHR` handed out. So for Vulkan, learnopengl's framebuffer object is nothing new in
principle – it is one more set of images, one more render pass and one more `VkFramebuffer`, except that this time
the colour image is not a swap chain image but one we create ourselves, and that a shader reads afterwards.
:::
:::d3d12
Direct3D 12 has no framebuffer object at all. What it has are *render target views* (RTVs) and *depth stencil views*
(DSVs): descriptors that describe a resource as something to draw into. `OMSetRenderTargets` binds up to eight RTVs
and one DSV, and draws then write into those resources – that call is the closest thing to binding a framebuffer.
Until now the RTV always pointed at a back buffer of the swap chain. In this chapter we create a texture of our own
that can be a render target, give it an RTV to draw into it and a shader resource view (SRV) to read it, and switch
it between the two uses with resource barriers (Microsoft's *Using resource barriers* documentation).
:::

As in the other chapters of this part, the technique is the same in every API; the text shows it for {{api}}.

:::opengl
The project starts with the *Depth testing* scene drawn straight into the window: the two marble cubes at
(-1, 0, -1) and (2, 0, 0) and the metal floor, `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, the camera at
(0, 0, 3) looking down -z, and the shaders `framebuffers.vs` / `framebuffers.fs` that sample `texture1`. Two more
shader files are there for the second half: `framebuffers_screen.vs`, which is complete, and `framebuffers_screen.fs`,
whose `main` is still a TODO.
:::
:::vulkan
The project starts with the *Depth testing* scene drawn straight into the window: the two marble cubes at
(-1, 0, -1) and (2, 0, 0) and the metal floor, the camera at (0, 0, 3) looking down -z, all vertices in one vertex
buffer (the cube is vertices 0..35, the floor 36..41), one descriptor set per texture, the model matrix in a push
constant and view and projection in the uniform buffer. `createPipeline(vert, frag, pipeline)` creates the scene's
pipeline from `shaders/framebuffers.vert` / `.frag`. Two more shaders are there for the second half:
`shaders/framebuffers_screen.vert`, which is complete, and `shaders/framebuffers_screen.frag`, whose `main` is still
a TODO.
:::
:::d3d12
The project starts with the *Depth testing* scene drawn straight into the window: the two marble cubes at
(-1, 0, -1) and (2, 0, 0) and the metal floor, the camera at (0, 0, 3) looking down -z, a PSO with the depth function
LESS and the shaders of `framebuffers.hlsl`. One vertex buffer holds the cube (vertices 0–35) and the floor (36–41);
the RTV heap holds the swap chain's two buffers, and the CBV/SRV heap the CBV (slot 0), the marble (slot 1) and the
metal (slot 2). A second shader file, `framebuffers_screen.hlsl`, is there for the second half: its `VSMain` is
complete, its `PSMain` still returns black.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## Creating a framebuffer

:::opengl
Just like any other object in OpenGL we can create a framebuffer object by using a function called
`glGenFramebuffers`:

```cpp
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
```

This pattern of object creation and usage is something we've seen dozens of times now so their usage functions are
similar to all the other objects we've seen: first we create a framebuffer object, bind it as the active framebuffer,
do some operations, and unbind the framebuffer. To bind the framebuffer we use `glBindFramebuffer`:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
```

By binding to the `GL_FRAMEBUFFER` target all the next *read* and *write* framebuffer operations will affect the
currently bound framebuffer. It is also possible to bind a framebuffer to a read or write target specifically by
binding to `GL_READ_FRAMEBUFFER` or `GL_DRAW_FRAMEBUFFER` respectively. The framebuffer bound to
`GL_READ_FRAMEBUFFER` is then used for all read operations like `glReadPixels`, and the framebuffer bound to
`GL_DRAW_FRAMEBUFFER` is used as the destination for rendering, clearing and other write operations. Most of the
times you won't need to make this distinction though and you generally bind to both with `GL_FRAMEBUFFER`.

Unfortunately, we can't use our framebuffer yet because it is not *complete*. For a framebuffer to be complete the
following requirements have to be satisfied:

- We have to attach at least one buffer (colour, depth or stencil buffer).
- There should be at least one colour attachment.
- All attachments should be complete as well (reserved memory).
- Each buffer should have the same number of samples.

Don't worry if you don't know what samples are, we'll get to those in a later chapter.

From the requirements it should be clear that we need to create some kind of attachment for the framebuffer and
attach this attachment to the framebuffer. After we've completed all requirements we can check if we actually
successfully completed the framebuffer by calling `glCheckFramebufferStatus` with `GL_FRAMEBUFFER`. It then checks
the currently bound framebuffer and returns any of the values found in the specification. If it returns
`GL_FRAMEBUFFER_COMPLETE` we're good to go:

```cpp
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
```

All subsequent rendering operations will now render to the attachments of the currently bound framebuffer. Since our
framebuffer is not the default framebuffer, the rendering commands will have no impact on the visual output of your
window. For this reason it is called *off-screen rendering* when rendering to a different framebuffer. If you want
all rendering operations to have a visual impact again on the main window we need to make the default framebuffer
active by binding to `0`:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

When we're done with all framebuffer operations, do not forget to delete the framebuffer object:

```cpp
    glDeleteFramebuffers(1, &framebuffer);
```

Now before the completeness check is executed we need to attach one or more attachments to the framebuffer. An
*attachment* is a memory location that can act as a buffer for the framebuffer; think of it as an image. When
creating an attachment we have two options to take: textures or *renderbuffer objects*.
:::
:::vulkan
A Vulkan framebuffer is created in three parts, which you know from vulkan-tutorial's *Render passes* and
*Framebuffers* chapters:

1. **Images** with memory and image views: the *attachments*, the memory that is drawn into.
2. A **render pass** that describes the attachments – their formats, what happens to their contents when the pass
   begins (`loadOp`) and ends (`storeOp`), and which layout each image is in before, during and after the pass.
3. A **`VkFramebuffer`** that names the actual image views for a render pass, in the order the render pass lists its
   attachments.

The render pass is where the biggest difference to the window's pass lies, so we create it first, in a new function
`createOffscreenRenderPass()` next to `createRenderPass()`. It is a copy of the window's render pass with three
changes. The colour attachment has a format of our own choosing instead of the swap chain's:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the picture: the screen quad reads it
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Its final layout is not `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` – this image is never presented – but
`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, the layout a texture must be in when a shader samples it. When the render
pass ends, it transitions the image into that layout by itself, so we need no extra pipeline barrier for it. The depth
attachment, the attachment references and the subpass are exactly those of `createRenderPass()`.

The third change is the synchronization. The window's render pass has one subpass dependency that makes it wait for
the previous use of its attachments. The offscreen pass gets two:

```cpp
        std::array<VkSubpassDependency, 2> dependencies{};
        // before the pass: wait until the last frame's screen quad has read the image and its depth writes are done
        dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[0].dstSubpass = 0;
        dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependencies[0].srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT;
        dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        // after the pass: the fragment shaders that sample the image wait until the scene has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

The second one is the important new idea. The scene is written in the colour attachment output stage; afterwards a
fragment shader reads the same image. Without the dependency, the GPU would be free to start the reading fragment
shaders while the scene is still being written. `VK_SUBPASS_EXTERNAL` as the destination means "everything recorded
after this render pass", so the screen quad's fragment shaders wait until the colour writes are done and visible to
shader reads. The first dependency is the mirror image for the next frame: before the scene is drawn into the image
again, the previous frame's fragment shaders must have finished reading it. Both go into the create info with
`renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());` and
`renderPassInfo.pDependencies = dependencies.data();`, and the result is stored in a new member
`VkRenderPass offscreenRenderPass;`.

What OpenGL checks at run time with `glCheckFramebufferStatus` – is the framebuffer *complete*? – is in Vulkan a
matter of valid usage: `vkCreateFramebuffer` requires that the image views match the render pass's attachments in
number, format and sample count and are at least as large as the framebuffer. There is no status to query; if you get
it wrong, the call is invalid and the validation layer tells you. With learnopengl we now need *attachments* for the
framebuffer – memory locations that can act as a buffer for the framebuffer; think of them as images. OpenGL offers
two kinds, textures and *renderbuffer objects*, and the next two sections show what they correspond to in Vulkan.
:::
:::d3d12
In Direct3D 12 there is no object to create that stands for "a framebuffer". To draw into memory of our own, we need:

1. A **resource** that may be a render target: a 2D texture created with `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`.
2. A **render target view** of it in the RTV heap, to draw into it.
3. A **shader resource view** of it in the CBV/SRV heap, to read it in a pixel shader afterwards.

`OMSetRenderTargets` with that RTV (and a DSV) then plays the role of OpenGL's `glBindFramebuffer`: everything drawn
afterwards goes into our texture instead of the back buffer. There is no "unbinding"; you simply call
`OMSetRenderTargets` again with the back buffer's RTV.

OpenGL checks at run time with `glCheckFramebufferStatus` whether a framebuffer is *complete*. Direct3D 12 has no such
check: the rules are part of the API (an RTV must describe a resource that allows render targets, the formats of the
bound views must be the ones the pipeline state object was created with, and so on), and the debug layer reports a
call that breaks them. With learnopengl we now need *attachments* – memory locations that can act as a buffer for the
framebuffer; think of them as images. OpenGL offers two kinds, textures and *renderbuffer objects*, and the next two
sections show what they correspond to in Direct3D 12.
:::

### Texture attachments

When attaching a texture to a framebuffer, all rendering commands will write to the texture as if it was a normal
colour/depth or stencil buffer. The advantage of using textures is that the render output is stored inside a texture
image that we can then easily use in our shaders.

:::opengl
Creating a texture for a framebuffer is roughly the same as creating a normal texture:

```cpp
    // create a color attachment texture
    unsigned int textureColorbuffer;
    glGenTextures(1, &textureColorbuffer);
    glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL); // no data: the scene is drawn into it
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

The main differences here is that we set the dimensions equal to the screen size (although this is not required) and
we pass `NULL` as the texture's `data` parameter. For this texture, we're only allocating memory and not actually
filling it. Filling the texture will happen as soon as we render to the framebuffer. Also note that we do not care
about any of the wrapping methods or mipmapping since we won't be needing those in most cases. The minifying filter
must still be set, though: its default, `GL_NEAREST_MIPMAP_LINEAR`, needs mipmaps, and a texture without the mipmaps
its filter asks for cannot be sampled.

If you want to render your whole screen to a texture of a smaller or larger size you need to call `glViewport` again
(before rendering to your framebuffer) with the new dimensions of your texture, otherwise render commands will only
fill part of the texture.

Now that we've created a texture, the last thing we need to do is actually attach it to the framebuffer:

```cpp
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0);
```

The `glFramebufferTexture2D` function has the following parameters:

- `target`: the framebuffer type we're targeting (draw, read or both).
- `attachment`: the type of attachment we're going to attach. Right now we're attaching a colour attachment. Note
  that the `0` at the end suggests we can attach more than 1 colour attachment. We'll get to that in a later chapter.
- `textarget`: the type of the texture you want to attach.
- `texture`: the actual texture to attach.
- `level`: the mipmap level. We keep this at `0`.

Next to the colour attachments we can also attach a depth and a stencil texture to the framebuffer object. To attach
a depth attachment we specify the attachment type as `GL_DEPTH_ATTACHMENT`. Note that the texture's format and
internalformat type should then become `GL_DEPTH_COMPONENT` to reflect the depth buffer's storage format. To attach a
stencil buffer you use `GL_STENCIL_ATTACHMENT` as the second argument and specify the texture's formats as
`GL_STENCIL_INDEX`.

It is also possible to attach both a depth buffer and a stencil buffer as a single texture. Each 32 bit value of the
texture then contains 24 bits of depth information and 8 bits of stencil information. To attach a depth and stencil
buffer as one texture we use the `GL_DEPTH_STENCIL_ATTACHMENT` type and configure the texture's formats to contain
combined depth and stencil values:

```cpp
glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH24_STENCIL8, 800, 600, 0, GL_DEPTH_STENCIL, GL_UNSIGNED_INT_24_8, NULL);

glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_TEXTURE_2D, texture, 0);
```
:::
:::vulkan
In Vulkan every attachment is an image, and what you are allowed to do with an image is fixed when you create it, by
its *usage* flags. The offscreen colour image is drawn into, so it needs `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`, and it
is read by a shader afterwards, so it also needs `VK_IMAGE_USAGE_SAMPLED_BIT` – this second flag is what makes it
learnopengl's *texture* attachment. The project's `createImage` and `createImageView` helpers from the texture
chapters do the rest, in a new function `createOffscreenFramebuffer()`:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, offscreenImage, offscreenImageMemory);
        offscreenImageView = createImageView(offscreenImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

The image is as big as the window (`swapChainExtent`), and its format must be the one the render pass's colour
attachment declares, `VK_FORMAT_R8G8B8A8_UNORM`. Like learnopengl's `glTexImage2D(..., NULL)`, this only allocates
memory: no pixels are uploaded, and there is no staging buffer or layout transition as for a loaded texture – the
render pass clears the image (`loadOp` CLEAR) before anything is drawn into it, and its `initialLayout` of
`VK_IMAGE_LAYOUT_UNDEFINED` says that we don't care about its old contents.

If you wanted the offscreen picture smaller or larger than the window, the image, the framebuffer and the viewport
you set while recording would all get the new size.

A depth image that a later pass should read – for a shadow map, say – would get `VK_IMAGE_USAGE_SAMPLED_BIT` too, next
to `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT`. Whether an image holds depth only, or depth and stencil together,
is decided by its format: `VK_FORMAT_D32_SFLOAT` has depth only, `VK_FORMAT_D24_UNORM_S8_UINT` packs 24 bits of depth
and 8 bits of stencil into each texel, like OpenGL's `GL_DEPTH24_STENCIL8`.
:::
:::d3d12
The texture is a committed resource like the ones `LoadTexture` creates, with two differences: the flag
`D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`, without which no RTV can be created for it, and an *optimized clear value*:

```cpp
        // A texture as big as the window, in the back buffer's format, that can be a render
        // target (ALLOW_RENDER_TARGET). It starts in the PIXEL_SHADER_RESOURCE state: every
        // frame turns it into a render target for the scene, and back for the screen quad.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);

        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, optimizedClearColor);

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_offscreenTarget)));
```

`CD3DX12_RESOURCE_DESC::Tex2D(format, width, height, arraySize, mipLevels, sampleCount, sampleQuality, flags)`
describes a texture as big as the window, with one mip level and one sample. Like learnopengl's
`glTexImage2D(..., NULL)` this only allocates memory: nothing is uploaded, there is no upload heap and no copy. The
clear value tells the driver which colour we will clear the texture to (the scene's 0.1 grey); clearing to exactly
this colour can be faster, and the debug layer warns when a clear uses another one. The resource starts in the
`D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE` state – why, you'll see when we use it.

The format, `DXGI_FORMAT_R8G8B8A8_UNORM`, is the back buffer's. That matters: a pipeline state object is created for
fixed render target formats (`psoDesc.RTVFormats[0]`), and since our texture has the same format as the back buffer,
the scene's PSO can draw into either.

Next come the two views. The RTV goes into the RTV heap after the swap chain's buffers, which means the heap needs one
more descriptor (`rtvHeapDesc.NumDescriptors = FrameCount + 1;`); the SRV goes into slot 3 of the CBV/SRV heap, after
the marble and the metal (`cbvSrvHeapDesc.NumDescriptors = 4;`):

```cpp
        // A render target view, to draw into it: in the RTV heap after the swap chain's buffers.
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_offscreenTarget.Get(), nullptr, rtvHandle);

        // A shader resource view, to read it in a pixel shader: slot 3 of the CBV/SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_offscreenTarget.Get(), &srvDesc, srvHandle);
```

(`nullptr` as the RTV's description means "a view of the whole resource in its own format".) One resource, two views:
that is Direct3D 12's way of saying what OpenGL's texture attachment says – the same memory is drawn into and read.

A depth texture that a later pass should read – for a shadow map, say – works the same way: a resource with
`D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL`, a DSV to draw into it and an SRV to read it. Whether it holds depth only, or
depth and stencil together, is decided by its format: `DXGI_FORMAT_D32_FLOAT` has depth only,
`DXGI_FORMAT_D24_UNORM_S8_UINT` packs 24 bits of depth and 8 bits of stencil, like OpenGL's `GL_DEPTH24_STENCIL8`.
:::

### Renderbuffer object attachments

:::opengl
Renderbuffer objects were introduced to OpenGL after textures as a possible type of framebuffer attachment. Just like
a texture image, a renderbuffer object is an actual buffer e.g. an array of bytes, integers, pixels or whatever.
However, a renderbuffer object can not be directly read from. This gives it the added advantage that OpenGL can do a
few memory optimizations that can give it a performance edge over textures for off-screen rendering to a framebuffer.

Renderbuffer objects store all the render data directly into their buffer without any conversions to
texture-specific formats, making them faster as a writeable storage medium. You cannot read from them directly, but
it is possible to read from them via the slow `glReadPixels`. This returns a specified area of pixels from the
currently bound framebuffer, but not directly from the attachment itself.

Because their data is in a native format they are quite fast when writing data or copying data to other buffers.
Operations like switching buffers are therefore quite fast when using renderbuffer objects. The `glfwSwapBuffers`
function we've been using at the end of each frame may as well be implemented with renderbuffer objects: we simply
write to a renderbuffer image, and swap to the other one at the end.

Creating a renderbuffer object looks similar to the framebuffer's code:

```cpp
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
```

And similarly we want to bind the renderbuffer object so all subsequent renderbuffer operations affect the current
`rbo`:

```cpp
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
```

Since renderbuffer objects are write-only they are often used as depth and stencil attachments, since most of the
time we don't really need to read values from them, but we do care about depth and stencil testing. We need the
depth and stencil values for testing, but don't need to sample these values so a renderbuffer object suits this
perfectly. When we're not sampling from these buffers, a renderbuffer object is generally preferred.

Creating a depth and stencil renderbuffer object is done by calling the `glRenderbufferStorage` function:

```cpp
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT); // use a single renderbuffer object for both a depth AND stencil buffer.
```

Creating a renderbuffer object is similar to texture objects, the difference being that this object is specifically
designed to be used as a framebuffer attachment, instead of a general purpose data buffer like a texture. Here we've
chosen `GL_DEPTH24_STENCIL8` as the internal format, which holds both the depth and stencil buffer with 24 and 8 bits
respectively.

The last thing left to do is to actually attach the renderbuffer object:

```cpp
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo); // now actually attach it
```

Renderbuffer objects can be more efficient for use in your off-screen render projects, but it is important to realize
when to use renderbuffer objects and when to use textures. The general rule is that if you never need to sample data
from a specific buffer, it is wise to use a renderbuffer object for that specific buffer. If you need to sample data
from a specific buffer like colours or depth values, you should use a texture attachment instead.
:::
:::vulkan
Vulkan has no renderbuffer objects: every attachment is a `VkImage`. What makes an image "renderbuffer-like" is,
again, its usage. An image that is only ever a depth attachment – `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT` and
nothing else, so it can never be sampled – leaves the driver free to store it in whatever way is fastest for depth
testing. That is exactly learnopengl's reason to use a renderbuffer for depth and stencil: we need the values for
testing, but never sample them.

The offscreen framebuffer gets such a depth image of its own, created like `createDepthResources()` creates the
window's:

```cpp
        VkFormat depthFormat = findDepthFormat();
        createImage(swapChainExtent.width, swapChainExtent.height, depthFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, offscreenDepthImage, offscreenDepthImageMemory);
        offscreenDepthImageView = createImageView(offscreenDepthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT);
```

`findDepthFormat()` picks `VK_FORMAT_D32_SFLOAT` here, a depth buffer without stencil – our scene doesn't use the
stencil test. learnopengl's `GL_DEPTH24_STENCIL8` would be `VK_FORMAT_D24_UNORM_S8_UINT`. (Vulkan goes one step
further than renderbuffers: an attachment that only lives during a render pass can be created with
`VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT`, and on GPUs that support it, bound to lazily allocated memory that may never
be backed by real memory at all.)

Finally the framebuffer itself, which puts the two views together for `offscreenRenderPass` – the colour view first,
the depth view second, as the render pass lists them:

```cpp
        std::array<VkImageView, 2> attachments = {
            offscreenImageView,
            offscreenDepthImageView
        };

        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = offscreenRenderPass;
        framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        framebufferInfo.pAttachments = attachments.data();
        framebufferInfo.width = swapChainExtent.width;
        framebufferInfo.height = swapChainExtent.height;
        framebufferInfo.layers = 1;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &offscreenFramebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create offscreen framebuffer!");
        }
```

The new members (`offscreenImage`, `offscreenImageMemory`, `offscreenImageView`, the same three for the depth image,
and `VkFramebuffer offscreenFramebuffer`) are destroyed in `cleanup()` next to the window's depth image, and the render
pass next to `renderPass`. `createOffscreenFramebuffer()` is called in `initVulkan()` after `createFramebuffers()`.

The rule of thumb carries over from OpenGL: if you never need to sample from an attachment, don't give it
`VK_IMAGE_USAGE_SAMPLED_BIT`; if you do need to sample it (colours, or depth for a shadow map), it needs the flag.
:::
:::d3d12
Direct3D 12 has no renderbuffer objects: every attachment is a resource. What makes a resource "renderbuffer-like" is
that it has only the view it is drawn through and no SRV, so no shader can ever read it. A depth buffer created with
`D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL` and without an SRV is exactly that, and the project already has one:
`m_depthStencil`, the window's depth buffer (`DXGI_FORMAT_D32_FLOAT`, no stencil – our scene doesn't use the stencil
test), with its DSV in `m_dsvHeap`. (The flag `D3D12_RESOURCE_FLAG_DENY_SHADER_RESOURCE` goes even further: it promises
that there will never be an SRV of the depth buffer, which leaves the driver free to optimise it for depth testing
alone.)

Since we never sample the depth values, we don't need a second depth buffer: the scene keeps using `m_depthStencil`
while it is drawn into our texture. It has the window's size, so it fits. That is learnopengl's renderbuffer object
for depth and stencil – memory that is tested against, but never read by a shader.

The rule of thumb carries over from OpenGL: if you never need to sample from an attachment, it needs no SRV; if you
do need to sample it (colours, or depth for a shadow map), create one.
:::

```quiz
learnopengl uses a texture for the framebuffer's colour and a renderbuffer for its depth and stencil. What is the reason for that split?
- [ ] Renderbuffers cannot store colours
- [x] The colour is read by a shader afterwards, the depth and stencil values are only needed for the tests during drawing – an attachment that is never sampled can be stored in whatever way is fastest
- [ ] Textures cannot be as big as the window
- [ ] Depth values must have the same format as the window's depth buffer
---
Attachments that are only written and tested don't need to be readable by shaders, which leaves room for optimisations. The colour is the picture we want to post-process, so it must be sampleable.
```

## Rendering to a texture

Now that we know how framebuffers (sort of) work it's time to put them to good use. We're going to render the scene
into a colour texture attached to a framebuffer object we created and then draw this texture over a simple quad that
spans the whole screen. The visual output is then exactly the same as without a framebuffer, but this time it's all
printed on top of a single quad. Now why is this useful? In the next section we'll see why.

:::opengl
First thing to do is to create an actual framebuffer object and bind it, this is all relatively straightforward:

```cpp
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
```

Next we create a texture image that we attach as a colour attachment to the framebuffer. We set the texture's
dimensions equal to the width and height of the window and keep its data uninitialized – the code from *Texture
attachments*, followed by `glFramebufferTexture2D`. We also want to make sure OpenGL is able to do depth testing (and
stencil testing) so we have to make sure to add a depth (and stencil) attachment to the framebuffer. Since we'll only
be sampling the colour buffer and not the other buffers we can create a renderbuffer object for this purpose – the
code from *Renderbuffer object attachments*. Then we check if the framebuffer is complete and if it's not, we print an
error message, and finally we unbind the framebuffer to make sure we're not accidentally rendering to the wrong
framebuffer. All of this goes after the shader configuration, as one block:

```cpp
    // framebuffer configuration
    // -------------------------
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    // create a color attachment texture
    unsigned int textureColorbuffer;
    glGenTextures(1, &textureColorbuffer);
    glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL); // no data: the scene is drawn into it
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0);
    // create a renderbuffer object for depth and stencil attachment (we won't be sampling these)
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT); // use a single renderbuffer object for both a depth AND stencil buffer.
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo); // now actually attach it
    // now that we actually created the framebuffer and added all attachments we want to check if it is actually complete now
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Now that the framebuffer is complete, all we need to do to render to the framebuffer's buffers instead of the default
framebuffers is to simply bind the framebuffer object. All subsequent render commands will then influence the
currently bound framebuffer. All the depth and stencil operations will also read from the currently bound
framebuffer's depth and stencil attachments if they're available. If you were to omit a depth buffer for example, all
the depth testing operations will no longer work, because there's not a depth buffer present in the currently bound
framebuffer.

So, to draw the scene to a single texture we'll have to take the following steps:

1. Render the scene as usual with the new framebuffer bound as the active framebuffer.
2. Bind to the default framebuffer.
3. Draw a quad that spans the entire screen with the new framebuffer's colour buffer as its texture.

The first two steps go into the render loop now. Before the clear, we bind our framebuffer:

```cpp
        // bind to framebuffer and draw scene as we normally would to color texture
        glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
        glEnable(GL_DEPTH_TEST); // enable depth testing (is disabled for rendering screen-space quad)

        // make sure we clear the framebuffer's content
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
```

The clear and the three draws of the scene stay as they are – they now go into our framebuffer. After the floor, we
go back to the default framebuffer:

```cpp
        // now bind back to default framebuffer and draw a quad plane with the attached framebuffer color texture
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glDisable(GL_DEPTH_TEST); // disable depth test so screen-space quad isn't discarded due to depth test.
        // clear all relevant buffers
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f); // set clear color to white (not really necessary actually, since we won't be able to see behind the quad anyways)
        glClear(GL_COLOR_BUFFER_BIT);
```

The screen quad will be a single quad drawn without any depth, so there's nothing to test it against: we disable the
depth test for it. Depth testing is global state, so the next frame has to enable it again before the scene is drawn
– that's why `glEnable(GL_DEPTH_TEST)` moved into the render loop, right after binding the framebuffer.

At the end of `main`, delete the texture, the renderbuffer and the framebuffer with the other objects:

```cpp
    glDeleteTextures(1, &textureColorbuffer);
    glDeleteRenderbuffers(1, &rbo);
    glDeleteFramebuffers(1, &framebuffer);
```
:::
:::vulkan
First comes the render pass from *Creating a framebuffer*, then the images and the framebuffer from the two attachment
sections. In `initVulkan()` the render pass is created right after the window's:

```cpp
        createRenderPass();
        createOffscreenRenderPass();
        createDescriptorSetLayout();
        createPipelineLayout();
        // a pipeline is made for one render pass: the scene's pipeline for the offscreen one
        createPipeline("shaders/framebuffers.vert.spv", "shaders/framebuffers.frag.spv", offscreenRenderPass, graphicsPipeline);
```

Note the change to `createPipeline`: it gets a `VkRenderPass pipelineRenderPass` parameter, which goes into
`pipelineInfo.renderPass`. A graphics pipeline is created for one render pass (and one of its subpasses), and can only
be used with that render pass or one *compatible* with it – one with the same attachment formats and sample counts.
Our offscreen colour image is `VK_FORMAT_R8G8B8A8_UNORM`, the swap chain's images are `VK_FORMAT_B8G8R8A8_UNORM`, so
the two render passes are not compatible, and the scene's pipeline must name `offscreenRenderPass`. Unlike OpenGL,
where any shader program can draw into any framebuffer, Vulkan wants to know the target's formats when it builds the
pipeline.

So, to draw the scene to a single texture we'll have to take the following steps:

1. Render the scene as usual in the offscreen render pass, into the offscreen framebuffer.
2. Begin the window's render pass.
3. Draw a quad that spans the entire screen with the offscreen image as its texture.

In `recordCommandBuffer()` the scene's render pass now begins with the offscreen render pass and framebuffer, with
clear values of its own:

```cpp
        // 1. the scene, drawn into the offscreen target as we normally would (learnopengl: glBindFramebuffer(GL_FRAMEBUFFER, framebuffer))
        VkRenderPassBeginInfo offscreenPassInfo{};
        offscreenPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        offscreenPassInfo.renderPass = offscreenRenderPass;
        offscreenPassInfo.framebuffer = offscreenFramebuffer;
        offscreenPassInfo.renderArea.offset = {0, 0};
        offscreenPassInfo.renderArea.extent = swapChainExtent;

        // one clear value per attachment: the colour, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 2> offscreenClearValues{};
        offscreenClearValues[0].color = {{0.1f, 0.1f, 0.1f, 1.0f}};
        offscreenClearValues[1].depthStencil = {1.0f, 0};

        offscreenPassInfo.clearValueCount = static_cast<uint32_t>(offscreenClearValues.size());
        offscreenPassInfo.pClearValues = offscreenClearValues.data();

        vkCmdBeginRenderPass(commandBuffer, &offscreenPassInfo, VK_SUBPASS_CONTENTS_INLINE);
```

Everything that follows – binding the pipeline, viewport and scissor, the vertex buffer, the three draws – stays as it
was. After the floor the offscreen pass ends, and the window's pass begins, cleared to white:

```cpp
        vkCmdEndRenderPass(commandBuffer); // the offscreen image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL

        // 2. the window (learnopengl: glBindFramebuffer(GL_FRAMEBUFFER, 0))
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = renderPass;
        renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = swapChainExtent;

        // white (not really necessary actually, since we won't be able to see behind the quad anyways)
        std::array<VkClearValue, 2> clearValues{};
        clearValues[0].color = {{1.0f, 1.0f, 1.0f, 1.0f}};
        clearValues[1].depthStencil = {1.0f, 0};

        renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
        renderPassInfo.pClearValues = clearValues.data();

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // TODO: draw the screen quad (screenPipeline, screenDescriptorSet, its 6 vertices) with the offscreen image as its texture

        vkCmdEndRenderPass(commandBuffer);
```

Two render passes in one command buffer: that's all there is to Vulkan's version of "bind a framebuffer, draw, bind the
default framebuffer, draw". The subpass dependencies and the final layout of the offscreen pass take care of what
OpenGL's driver does silently between the two – making sure the picture is finished and readable before the second
pass samples it.
:::
:::d3d12
The texture and its two views go into `LoadAssets`, after the depth buffer is created. Then the drawing, in
`PopulateCommandList`. So, to draw the scene to a single texture we'll have to take the following steps:

1. Render the scene as usual with our texture's RTV (and the depth buffer's DSV) bound.
2. Bind the back buffer's RTV.
3. Draw a quad that spans the entire screen with our texture's SRV as its texture.

A resource in Direct3D 12 is always in a *state*, and the state must fit the use: to be drawn into it must be in
`D3D12_RESOURCE_STATE_RENDER_TARGET`, to be read by a pixel shader in `D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE`.
A *transition barrier* switches it from one to the other – and makes the GPU finish the writes before the reads begin.
You know this from the back buffer, which goes from PRESENT to RENDER_TARGET at the start of every frame and back at
the end. Our texture goes around a circle as well: it was created in PIXEL_SHADER_RESOURCE, becomes a render target for
the scene, and is a pixel shader resource again when the screen quad reads it – which is also the state the next frame
starts from.

The first pass binds our texture's RTV (slot `FrameCount` of the RTV heap) together with the depth buffer, and clears
it – instead of the back buffer:

```cpp
    // First pass: the scene, drawn into the off-screen render target with the depth buffer.
    // The screen quad of the previous frame read the texture: now it is written again.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_offscreenTarget.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE offscreenRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &offscreenRtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    m_commandList->ClearRenderTargetView(offscreenRtvHandle, clearColor, 0, nullptr);
```

The depth clear and the three draws of the scene stay as they are. After the floor, the texture becomes readable, the
back buffer becomes a render target, and the second pass binds it – without a depth buffer – and clears it to white:

```cpp
    // The scene is in the texture: from now on the pixel shader reads it.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_offscreenTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &barrier);

    // Second pass: the window. Indicate that the back buffer will be used as a render target.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    // The back buffer, without a depth buffer: the screen quad needs no depth test.
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

    // Clear it to white (not really necessary: the screen quad covers the whole window).
    const float screenClearColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, screenClearColor, 0, nullptr);
```

The barrier that ends the frame – the back buffer from RENDER_TARGET to PRESENT – stays at the end. Two
`OMSetRenderTargets` calls in one command list: that's Direct3D 12's version of "bind a framebuffer, draw, bind the
default framebuffer, draw".
:::

Now do the first task, **offscreen-target**, and press **Build & run**. The window is completely white.

```quiz
After the **offscreen-target** task the window is white everywhere, although the scene is still drawn every frame. Why?
- [ ] The depth test now rejects every fragment of the scene
- [ ] The scene is drawn, but the white clear afterwards erases the texture it was drawn into
- [x] The scene goes into our own colour texture; the window only gets its white clear, and nothing shows the texture yet
- [ ] A framebuffer of our own cannot be drawn into before it has been shown once
---
That is off-screen rendering: the draws affect only the target that is bound while they run. The window's clear doesn't touch our texture – it's a different piece of memory – and the next task puts the texture on the screen.
```

To show the texture we need a quad that fills the screen. Its vertices are given directly in normalized device
coordinates, so the vertex shader needs no matrices at all – it passes the positions through:

:::opengl
```cpp
    float quadVertices[] = { // vertex attributes for a quad that fills the entire screen in Normalized Device Coordinates.
        // positions   // texCoords
        -1.0f,  1.0f,  0.0f, 1.0f,
        -1.0f, -1.0f,  0.0f, 0.0f,
         1.0f, -1.0f,  1.0f, 0.0f,

        -1.0f,  1.0f,  0.0f, 1.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f,  1.0f, 1.0f
    };
```

Each vertex has a 2D position and 2D texture coordinates, so the quad's VAO has two attributes of two floats each and a
stride of four floats:

```cpp
    // screen quad VAO
    unsigned int quadVAO, quadVBO;
    glGenVertexArrays(1, &quadVAO);
    glGenBuffers(1, &quadVBO);
    glBindVertexArray(quadVAO);
    glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));
    glBindVertexArray(0);
```

The vertex shader, `framebuffers_screen.vs`, is already there:

```glsl
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

void main()
{
    TexCoords = aTexCoords;
    gl_Position = vec4(aPos.x, aPos.y, 0.0, 1.0); // the quad's corners are already in normalized device coordinates
}
```

Nothing too fancy. The fragment shader will be even more basic since the only thing we have to do is sample from a
texture:

```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D screenTexture;

void main()
{
    vec3 col = texture(screenTexture, TexCoords).rgb;
    FragColor = vec4(col, 1.0);
}
```

The texture coordinates go from (0, 0) at the bottom left to (1, 1) at the top right, the same way the framebuffer's
texture was filled: OpenGL's window coordinates start at the bottom left, and so does a texture's first row. The
picture therefore comes out the right way up.

It is then up to you to create the shader program, `Shader screenShader("framebuffers_screen.vs",
"framebuffers_screen.fs");`, and to point its sampler at texture unit 0 in the shader configuration:

```cpp
    screenShader.use();
    screenShader.setInt("screenTexture", 0);
```

In the render loop, after the white clear, we draw the quad with the framebuffer's colour texture:

```cpp
        screenShader.use();
        glBindVertexArray(quadVAO);
        glBindTexture(GL_TEXTURE_2D, textureColorbuffer); // use the color attachment texture as the texture of the quad plane
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);
```

The quad's VAO and VBO are deleted at the end of `main` with the others.
:::
:::vulkan
All vertices of the project live in one vertex buffer, so the quad's six vertices are appended to `vertices`, after
the floor – they become vertices 42..47. The `Vertex` struct has a 3D position, so the quad gets z = 0:

```cpp
    // screen quad: vertices 42..47, learnopengl's quadVertices (positions already in normalized device coordinates,
    // z = 0) with its texture coordinates unchanged: in Vulkan both the y of the window and the v of an image point
    // down, so the two flips cancel and the offscreen picture shows upright
    {{-1.0f,  1.0f,  0.0f}, {0.0f, 1.0f}},
    {{-1.0f, -1.0f,  0.0f}, {0.0f, 0.0f}},
    {{ 1.0f, -1.0f,  0.0f}, {1.0f, 0.0f}},

    {{-1.0f,  1.0f,  0.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -1.0f,  0.0f}, {1.0f, 0.0f}},
    {{ 1.0f,  1.0f,  0.0f}, {1.0f, 1.0f}}
```

These are learnopengl's `quadVertices` unchanged, and that deserves a second look. In Vulkan, normalized device
coordinate y = -1 is the *top* of the framebuffer, so the corner (-1, 1) is at the bottom left of the window. The
scene was drawn into the offscreen image with the same convention (the projection's y flip keeps it upright), so the
image's first row, v = 0, holds the top of the picture. At the bottom of the window we therefore need v = 1, the
image's last row – and that is what learnopengl's coordinates give the corner (-1, 1).

The vertex shader, `shaders/framebuffers_screen.vert`, is already there – no matrices, the corners are passed through:

```glsl
void main() {
    fragTexCoord = inTexCoord;
    gl_Position = vec4(inPosition.x, inPosition.y, 0.0, 1.0);
}
```

and the fragment shader only samples the image:

```glsl
#version 450

layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 col = texture(screenTexture, fragTexCoord).rgb;
    outColor = vec4(col, 1.0);
}
```

The quad gets a pipeline of its own, `screenPipeline`, made for the window's `renderPass` – and without the depth
test: the screen quad is a single quad drawn without any depth, so there's nothing to test it against. In OpenGL that
is `glDisable(GL_DEPTH_TEST)` before drawing it; in Vulkan the depth test is part of the pipeline, so `createPipeline`
gets one more parameter, `VkBool32 depthTestEnable`:

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable; // with the test off nothing is written either (like glDisable(GL_DEPTH_TEST))
```

and `initVulkan()` creates both pipelines:

```cpp
        createPipeline("shaders/framebuffers.vert.spv", "shaders/framebuffers.frag.spv", offscreenRenderPass, VK_TRUE, graphicsPipeline);
        // the screen quad: for the window's render pass, without the depth test (it must never be hidden)
        createPipeline("shaders/framebuffers_screen.vert.spv", "shaders/framebuffers_screen.frag.spv", renderPass, VK_FALSE, screenPipeline);
```

The shader reads the offscreen image through a descriptor set, created with the project's helper from the image view
and the existing `textureSampler` (the pool now needs room for 3 sets: `maxSets = 3` and a `descriptorCount` of 3 for
both pool sizes):

```cpp
        createDescriptorSet(offscreenImageView, textureSampler, screenDescriptorSet);
```

The helper writes the image with `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` into the descriptor – the layout our render
pass leaves the image in. Finally the draw, in the window's render pass where the TODO is:

```cpp
        // the screen quad with the offscreen image as its texture (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the screen quad's 6 vertices start at vertex 42
```

The viewport, the scissor and the vertex buffer binding are state of the command buffer, not of a render pass, so the
values set for the first pass still apply in the second. Destroy `screenPipeline` in `cleanup()` with the other
pipeline.
:::
:::d3d12
All vertices of the project live in one vertex buffer, so the quad's six vertices go at the end of `vertices[]`,
after the floor – they become vertices 42 to 47:

```cpp
            // the screen quad: vertices 42 to 47 - two triangles that fill the whole window,
            // in normalized device coordinates (x and y from -1 to 1; z is not used). The
            // texture coordinates are learnopengl.com's with v flipped: v = 0 at the top.
            { { -1.0f,  1.0f, 0.0f }, { 0.0f, 0.0f } },
            { { -1.0f, -1.0f, 0.0f }, { 0.0f, 1.0f } },
            { {  1.0f, -1.0f, 0.0f }, { 1.0f, 1.0f } },

            { { -1.0f,  1.0f, 0.0f }, { 0.0f, 0.0f } },
            { {  1.0f, -1.0f, 0.0f }, { 1.0f, 1.0f } },
            { {  1.0f,  1.0f, 0.0f }, { 1.0f, 0.0f } }
```

Why flipped? In Direct3D, normalized device coordinate y = 1 is the top of the render target, and the top row of the
render target is the texture's first row, v = 0. So when we drew the scene, its top ended up at v = 0, and the quad's
top corners need v = 0 to show it there. (In OpenGL the first row of a texture is at the bottom, so learnopengl's quad
has v = 1 at the top.)

The shaders are in `framebuffers_screen.hlsl`. The vertex shader is already there – no matrices, the corners are
passed through:

```hlsl
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.x, position.y, 0.0f, 1.0f);
    result.texCoord = texCoord;

    return result;
}
```

and the pixel shader only samples the texture:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 col = screenTexture.Sample(wrapSampler, input.texCoord).rgb;
    return float4(col, 1.0f);
}
```

`screenTexture` is the `Texture2D` at register `t0` – the SRV that root parameter 2's descriptor table points at,
like `texture1` in the scene's shader – and `wrapSampler` the static sampler `s0`.

The quad needs a pipeline state object of its own, `m_screenPipelineState`. The screen quad is a single quad drawn
without any depth, so there's nothing to test it against – and the window's pass binds no depth buffer at all. A PSO
records the format of the depth buffer it draws with (`DSVFormat`), so the quad's PSO says "none", and switches the
depth test off (learnopengl's `glDisable(GL_DEPTH_TEST)`). It is the scene's description with the other shaders,
created right after `m_pipelineState`:

```cpp
        ComPtr<ID3DBlob> screenVertexShader;
        ComPtr<ID3DBlob> screenPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"framebuffers_screen.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &screenVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"framebuffers_screen.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &screenPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(screenVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(screenPixelShader.Get());
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_screenPipelineState)));
```

`RTVFormats[0]` stays `DXGI_FORMAT_R8G8B8A8_UNORM`, the back buffer's format. Finally the draw, in the window's pass
where the TODO is: the quad's PSO, our texture's SRV in heap slot 3 for root parameter 2, and the six vertices from
vertex 42 on:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, screenTexture);
    m_commandList->DrawInstanced(6, 1, 42, 0);
```

The viewport, the scissor rectangle, the vertex buffer and the root signature were set for the first pass; they are
state of the command list and still apply.
:::

:::opengl
```quiz
Why does the render loop switch the depth test off before drawing the screen quad, and on again at the start of every frame?
- [ ] The default framebuffer has no depth buffer, so OpenGL would report an error
- [ ] With the depth test on, the quad would be drawn behind the scene's cubes
- [ ] `glBindFramebuffer` resets all global state, so it has to be set again anyway
- [x] The quad is a single flat layer with nothing to be tested against; but the depth test is global state, so the scene in the next frame needs it switched back on
---
OpenGL's state machine keeps whatever was set last. The quad needs no depth test (and a leftover depth value could even hide it); the scene does, so the frame starts with `glEnable(GL_DEPTH_TEST)` right after binding our framebuffer.
```
:::
:::vulkan
```quiz
Why does the project need a second pipeline for the screen quad instead of drawing it with `graphicsPipeline`?
- [ ] A pipeline can only be bound once per command buffer
- [ ] The screen quad has a different number of vertices
- [ ] Only one pipeline may use a given descriptor set layout
- [x] The quad is drawn in the window's render pass, whose colour format differs from the offscreen pass's, and it needs other shaders and no depth test – all of which are fixed in a pipeline
---
A pipeline is created for one render pass (or a compatible one), with its shaders and its depth state baked in. The quad needs `renderPass`, the screen shaders and `depthTestEnable = VK_FALSE`, so it gets `screenPipeline`.
```
:::
:::d3d12
```quiz
Why does the screen quad's PSO set `DSVFormat = DXGI_FORMAT_UNKNOWN` and `DepthEnable = FALSE`?
- [ ] A PSO that samples a texture must not have a depth buffer
- [ ] Otherwise the quad's z = 0 would be clipped
- [ ] `DXGI_FORMAT_UNKNOWN` tells Direct3D to pick the back buffer's format
- [x] The window's pass binds no DSV (`OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`), and a PSO must match the formats bound when it draws; without a depth buffer there is nothing to test against
---
A PSO is created for fixed render target and depth formats. The quad is one flat layer that needs no depth test – learnopengl's `glDisable(GL_DEPTH_TEST)` – so its pass has no depth buffer and its PSO says so.
```
:::

Now do the task **screen-quad** and press **Build & run**. The scene is back, exactly as it looked at the start of
the chapter – the cubes, the floor, the dark grey background. If you'd look at it in wireframe mode you'd see a single
quad covering the window, but nothing in the picture tells that the scene took a detour through a texture.

So what was the use of this? Because we can now freely access each of the pixels of the completely rendered scene as a
single texture image, we can create some interesting effects in the fragment shader.

## Post-processing

Now that the entire scene is rendered to a single texture we can create cool post-processing effects by manipulating
the scene texture. In this section we'll show you some of the more popular post-processing effects and how you may
create your own with some added creativity.

Let's start with one of the simplest post-processing effects.

### Inversion

We have access to each of the colours of the render output so it's not so hard to return the inverse of these colours
in the fragment shader. We take the colour of the screen texture and inverse it by subtracting it from `1.0`:

:::opengl
```glsl
void main()
{
    FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0); // every colour channel inverted
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = vec4(vec3(1.0 - texture(screenTexture, fragTexCoord)), 1.0); // every colour channel inverted
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f - screenTexture.Sample(wrapSampler, input.texCoord).rgb, 1.0f);    // every colour channel inverted
}
```
:::

While inversion is a relatively simple post-processing effect it already creates funky results. Do the task
**inversion** and press **Build & run**: the whole scene has all its colours inversed with a single line of code in
the fragment shader. The dark grey background turns light grey, the white marble becomes a dark blue-grey and the grey
steel floor turns brownish.

```quiz
The background was cleared to (0.1, 0.1, 0.1) – 26, 26, 26 in 8-bit values. What colour does it have after the inversion?
- [x] 229, 229, 229
- [ ] 26, 26, 26: the clear colour is not part of the texture
- [ ] 0, 0, 0
- [ ] 255, 255, 255
---
`1.0 - 0.1 = 0.9`, and 255 − 26 = 229. The clear colour was written into the texture like any drawn pixel, so it is inverted too.
```

### Grayscale

Another interesting effect is to remove all colours from the scene except the white, gray and black colours;
effectively grayscaling the entire image. An easy way to do this is by taking all the colour components and averaging
their results:

:::opengl
```glsl
void main()
{
    FragColor = texture(screenTexture, TexCoords);
    float average = (FragColor.r + FragColor.g + FragColor.b) / 3.0;
    FragColor = vec4(average, average, average, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = texture(screenTexture, fragTexCoord);
    float average = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor = vec4(average, average, average, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = screenTexture.Sample(wrapSampler, input.texCoord);
    float average = (color.r + color.g + color.b) / 3.0f;
    return float4(average, average, average, 1.0f);
}
```
:::

This already creates pretty good results, but the human eye tends to be more sensitive to green colours and the least
to blue. So to get the most physically accurate results we'll need to use weighted channels:

:::opengl
```glsl
void main()
{
    FragColor = texture(screenTexture, TexCoords);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126 * FragColor.r + 0.7152 * FragColor.g + 0.0722 * FragColor.b;
    FragColor = vec4(average, average, average, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = texture(screenTexture, fragTexCoord);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126 * outColor.r + 0.7152 * outColor.g + 0.0722 * outColor.b;
    outColor = vec4(average, average, average, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = screenTexture.Sample(wrapSampler, input.texCoord);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126f * color.r + 0.7152f * color.g + 0.0722f * color.b;
    return float4(average, average, average, 1.0f);
}
```
:::

Do the task **grayscale** with the weighted version and press **Build & run**: the inversion is gone, and the scene
is shown in shades of grey – every pixel has the same red, green and blue value. You probably won't notice the
difference to the plain average right away, but with more complicated scenes, such a weighted grayscaling effect tends
to be more realistic.

## Kernel effects

Another advantage about doing post-processing on a single texture image is that we can sample colour values from
other parts of the texture not specific to that fragment. We could for example take a small area around the current
texture coordinate and sample multiple texture values around the current texture value. We can then create
interesting effects by combining them in creative ways.

A *kernel* (or convolution matrix) is a small matrix-like array of values centered on the current pixel that
multiplies surrounding pixel values by its kernel values and adds them all together to form a single value. We're
adding a small offset to the texture coordinates in surrounding directions of the current pixel and combine the
results based on the kernel. An example of a kernel is given below:

```text
 2   2   2
 2 -15   2
 2   2   2
```

This kernel takes 8 surrounding pixel values and multiplies them by `2` and the current pixel by `-15`. This example
kernel multiplies the surrounding pixels by several weights determined in the kernel and balances the result by
multiplying the current pixel by a large negative weight.

Most kernels you'll find over the internet all sum up to `1` if you add all the weights together. If they don't add up
to `1` it means that the resulting texture colour ends up brighter or darker than the original texture value.

Kernels are an extremely useful tool for post-processing since they're quite easy to use and experiment with, and a
lot of examples can be found online. We do have to slightly adapt the fragment shader a bit to actually support
kernels. We make the assumption that each kernel we'll be using is a 3×3 kernel (which most kernels are):

:::opengl
```glsl
const float offset = 1.0 / 300.0; // the distance to the neighbouring samples

void main()
{
    vec2 offsets[9] = vec2[](
        vec2(-offset,  offset), // top-left
        vec2( 0.0,     offset), // top-center
        vec2( offset,  offset), // top-right
        vec2(-offset,  0.0),    // center-left
        vec2( 0.0,     0.0),    // center-center
        vec2( offset,  0.0),    // center-right
        vec2(-offset, -offset), // bottom-left
        vec2( 0.0,    -offset), // bottom-center
        vec2( offset, -offset)  // bottom-right
    );

    float kernel[9] = float[](
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0
    );

    vec3 sampleTex[9];
    for(int i = 0; i < 9; i++)
    {
        sampleTex[i] = vec3(texture(screenTexture, TexCoords.st + offsets[i]));
    }
    vec3 col = vec3(0.0);
    for(int i = 0; i < 9; i++)
        col += sampleTex[i] * kernel[i];

    FragColor = vec4(col, 1.0);
}
```

In the fragment shader we first create an array of 9 `vec2` offsets for each surrounding texture coordinate. The
offset is a constant value that you could customize to your liking. Then we define the kernel, which in this case is
a *sharpen* kernel that sharpens each colour value by sampling all surrounding pixels in an interesting way. Lastly,
we add each offset to the current texture coordinate when sampling and multiply these texture values with the
weighted kernel values that we add together. In OpenGL, v grows upwards, so the top row of samples is at `+offset`.
:::
:::vulkan
```glsl
const float offset = 1.0 / 300.0; // the distance to the neighbouring samples

void main() {
    // in Vulkan v points down in an image: -offset is the row above
    vec2 offsets[9] = vec2[](
        vec2(-offset, -offset), // top-left
        vec2( 0.0,    -offset), // top-center
        vec2( offset, -offset), // top-right
        vec2(-offset,  0.0),    // center-left
        vec2( 0.0,     0.0),    // center-center
        vec2( offset,  0.0),    // center-right
        vec2(-offset,  offset), // bottom-left
        vec2( 0.0,     offset), // bottom-center
        vec2( offset,  offset)  // bottom-right
    );

    float kernel[9] = float[](
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0
    );

    vec3 sampleTex[9];
    for (int i = 0; i < 9; i++) {
        sampleTex[i] = vec3(texture(screenTexture, fragTexCoord.st + offsets[i]));
    }
    vec3 col = vec3(0.0);
    for (int i = 0; i < 9; i++) {
        col += sampleTex[i] * kernel[i];
    }

    outColor = vec4(col, 1.0);
}
```

In the fragment shader we first create an array of 9 `vec2` offsets for each surrounding texture coordinate. The
offset is a constant value that you could customize to your liking. Then we define the kernel, which in this case is
a *sharpen* kernel that sharpens each colour value by sampling all surrounding pixels in an interesting way. Lastly,
we add each offset to the current texture coordinate when sampling and multiply these texture values with the
weighted kernel values that we add together.

One detail differs from learnopengl's shader: in a Vulkan image v points down, so the row above the current pixel is
at `-offset`, and the top row of `offsets` has `-offset` in y where learnopengl has `+offset`. For the kernels of this
chapter it makes no difference – they are all symmetric from top to bottom – but for a kernel that isn't, the order
matters.
:::
:::d3d12
```hlsl
// The distance to the neighbouring samples, in texture coordinates.
static const float offset = 1.0f / 300.0f;

// The pixel shader: the colour of the window's pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The 3x3 samples around the pixel. v grows downwards in Direct3D, so the top row
    // is at -offset (learnopengl's GLSL, where v grows upwards, has +offset there).
    float2 offsets[9] =
    {
        float2(-offset, -offset),    // top-left
        float2( 0.0f,   -offset),    // top-center
        float2( offset, -offset),    // top-right
        float2(-offset,  0.0f),      // center-left
        float2( 0.0f,    0.0f),      // center-center
        float2( offset,  0.0f),      // center-right
        float2(-offset,  offset),    // bottom-left
        float2( 0.0f,    offset),    // bottom-center
        float2( offset,  offset)     // bottom-right
    };

    // The kernel: how much each sample counts.
    float kernel[9] =
    {
        -1.0f, -1.0f, -1.0f,
        -1.0f,  9.0f, -1.0f,
        -1.0f, -1.0f, -1.0f
    };

    float3 sampleTex[9];
    for (int i = 0; i < 9; i++)
    {
        sampleTex[i] = screenTexture.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;
    }
    float3 col = float3(0.0f, 0.0f, 0.0f);
    for (int k = 0; k < 9; k++)
        col += sampleTex[k] * kernel[k];

    return float4(col, 1.0f);
}
```

In the pixel shader we first create an array of 9 `float2` offsets for each surrounding texture coordinate. The offset
is a constant value that you could customize to your liking (`static const` makes it a constant of the shader, not a
value in a constant buffer). Then we define the kernel, which in this case is a *sharpen* kernel that sharpens each
colour value by sampling all surrounding pixels in an interesting way. Lastly, we add each offset to the current
texture coordinate when sampling and multiply these texture values with the weighted kernel values that we add
together.

Two details differ from learnopengl's GLSL: HLSL initialises arrays with braces, `{ … }`, where GLSL writes
`vec2[](…)`; and in Direct3D v grows downwards, so the row above the current pixel is at `-offset`, and the top row of
`offsets` has `-offset` in y where learnopengl has `+offset`. For the kernels of this chapter it makes no difference –
they are all symmetric from top to bottom – but for a kernel that isn't, the order matters.
:::

This particular sharpen kernel looks like this:

```text
-1  -1  -1
-1   9  -1
-1  -1  -1
```

Its weights add up to 9 − 8 = 1: where all nine samples have the same colour, the result is that colour. Where the
centre differs from its neighbours, the difference is amplified eightfold.

Do the task **sharpen** and press **Build & run**. The colours are back, and the background and the even parts of the
floor look as before – but every edge is hard: the dark veins of the marble turn black, light pixels beside them turn
almost white, the cubes get bright rims, and the floor's pattern looks grainy. This could create some interesting
effects of where your player may be on a narcotic adventure.

```quiz
Why does the sharpen kernel leave the uniform dark grey background unchanged, while it turns the marble's veins black?
- [ ] The background is not part of the scene texture
- [ ] The kernel only works on pixels that were drawn with a texture
- [x] Its weights add up to 1: where all nine samples are equal the result is that colour, but a pixel darker than its neighbours gets the difference amplified
- [ ] The offset of 1/300 is too small to reach the background's neighbours
---
In a uniform area 9 · c − 8 · c = c. At a vein, the centre is darker than its eight neighbours, so 9 · centre − (sum of the neighbours) becomes much darker – it's clamped to black.
```

### Blur

A kernel that creates a *blur* effect is defined as follows:

```text
1   2   1
2   4   2   / 16
1   2   1
```

Because all values add up to 16, directly returning the combined sampled colours would result in an extremely bright
colour so we have to divide each value of the kernel by `16`. The resulting kernel array then becomes:

:::opengl vulkan
```glsl
    float kernel[9] = float[](
        1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
        2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0,
        1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0
    );
```
:::
:::d3d12
```hlsl
    float kernel[9] =
    {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
```
:::

By only changing the kernel array in the fragment shader we can completely change the post-processing effect. Do the
task **blur** and press **Build & run**: the picture looks like the start picture, slightly blurred – the marble's
veins are softened and the outlines of the cubes are no longer crisp.

Such a blur effect creates interesting possibilities. We could vary the blur amount over time to create the effect of
someone being drunk, or increase the blur whenever the main character is not wearing glasses. Blurring can also be a
useful tool for smoothing colour values which we'll see use of in later chapters.

You can see that once we have such a little kernel implementation in place it is quite easy to create cool
post-processing effects. Let's show you a last popular effect to finish this discussion.

### Edge detection

Below you can find an *edge-detection* kernel that is similar to the sharpen kernel:

```text
1   1   1
1  -8   1
1   1   1
```

This kernel highlights all edges and darkens the rest, which is pretty useful when we only care about edges in an
image. Its weights add up to 0: wherever all nine samples are the same, the result is black.

:::opengl vulkan
```glsl
    float kernel[9] = float[](
        1.0,  1.0, 1.0,
        1.0, -8.0, 1.0,
        1.0,  1.0, 1.0
    );
```
:::
:::d3d12
```hlsl
    float kernel[9] =
    {
        1.0f,  1.0f, 1.0f,
        1.0f, -8.0f, 1.0f,
        1.0f,  1.0f, 1.0f
    };
```
:::

Do the last task, **edge-detection**, and press **Build & run**. Almost everything is black now: the background, the
even parts of the floor and the flat areas of the marble. What's left are bright lines wherever the colour changes –
the cubes' outlines, the marble's veins, the floor's pattern and the horizon where the floor meets the background.

It probably does not come as a surprise that kernels like this are used as image-manipulating tools/filters in tools
like Photoshop. Because of a graphic card's ability to process fragments with extreme parallel capabilities, we can
manipulate images on a per-pixel basis in real-time with relative ease. Image-editing tools therefore tend to use
graphics cards for image-processing.

If you look closely, you'll also see a light line along the very top edge of the window, where the picture shows
only black background. The sampler our screen texture is read with repeats the texture, like every sampler we've
used:

:::opengl
we never set `GL_TEXTURE_WRAP_S` and `GL_TEXTURE_WRAP_T` for `textureColorbuffer`, so they keep their default,
`GL_REPEAT`.
:::
:::vulkan
`screenDescriptorSet` uses `textureSampler`, created with `VK_SAMPLER_ADDRESS_MODE_REPEAT`.
:::
:::d3d12
`wrapSampler`, the static sampler `s0`, uses `D3D12_TEXTURE_ADDRESS_MODE_WRAP`.
:::

For the top row of pixels, the samples one row above lie outside the texture and wrap around to its bottom row – the
floor. The kernel then sees a big difference and draws an edge that isn't there. learnopengl's picture has the same
lines. A sampler that clamps to the edge would avoid them, as with the grass in the *Blending* chapter.

```quiz
With the edge-detection kernel, why does a light line appear along the top edge of the window, where the scene shows only the black background?
- [ ] The background colour is not uniform at the top of the window
- [ ] The screen quad doesn't reach the top edge, so the white clear colour shows through
- [x] The texture is sampled with repeat wrapping: the samples above the top row wrap around to the bottom row, the floor, and the kernel sees an edge
---
The kernel needs neighbours for every pixel. At the borders, the address mode decides what "outside" means: repeat brings in the opposite side of the picture, clamp to edge would repeat the border pixel itself, which gives no false edge.
```

## Exercises

- Can you use framebuffers to create a rear-view mirror? For this you'll have to draw your scene twice: one with the
  camera rotated 180 degrees and the other as normal. Try to create a small quad at the top of your screen to apply
  the mirror texture on.
- Play around with the kernel values and create your own interesting post-processing effects. Try searching the
  internet as well for other interesting kernels.

:::opengl
For the mirror you can use the framebuffer of this chapter for the rotated view (a view matrix that looks along
`-cameraFront`), draw the normal scene straight into the default framebuffer, and draw a small quad – its corners at,
say, x from -0.3 to 0.3 and y from 0.6 to 0.95 – with `textureColorbuffer` last, with the depth test off.
:::
:::vulkan
For the mirror you can use the offscreen pass of this chapter for the rotated view (a second view matrix that looks
along `-cameraFront`, in a second uniform buffer or a push constant), draw the normal scene in the window's render
pass – which then needs the scene's shaders in a pipeline for `renderPass` – and draw a small quad, its corners at, say,
x from -0.3 to 0.3 and y from -0.95 to -0.6 (the top of the window in Vulkan), with the offscreen image last.
:::
:::d3d12
For the mirror you can use the off-screen render target of this chapter for the rotated view (a second view matrix
that looks along `-cameraFront`, in a second constant buffer), draw the normal scene into the back buffer with the depth
buffer, and draw a small quad – its corners at, say, x from -0.3 to 0.3 and y from 0.6 to 0.95 – with the off-screen
texture last. The scene's second pass needs the depth buffer cleared again before it starts.
:::

In the next chapter we stay with textures that are more than a flat picture: *cube maps*, six images that together
surround the whole scene.
