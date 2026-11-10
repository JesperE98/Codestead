# Shadow Mapping

Shadows are a result of the absence of light due to occlusion. When a light source's light rays do not hit an object
because it gets occluded by some other object, the object is in shadow. Shadows add a great deal of realism to a lit
scene and make it easier for a viewer to observe spatial relationships between objects. They give a greater sense of
depth to our scene and objects: without shadows, a cube floating above the floor and a cube standing on it look almost
the same.

Shadows are a bit tricky to implement though, specifically because in current real-time research an ideal shadow
algorithm hasn't been developed yet. There are several good shadow approximation techniques, but they all have their
little quirks and annoyances which we have to take into account.

One technique used by most videogames that gives decent results and is relatively easy to implement is *shadow
mapping*. Shadow mapping is not too difficult to understand, doesn't cost too much in performance and quite easily
extends into more advanced algorithms (like omnidirectional shadow maps and cascaded shadow maps). Like everything in
this part, it is the same technique in every API: a second render pass plus some maths in the shaders. This chapter
shows where {{api}} puts the pass and the depth texture it draws into.

:::opengl
The project is learnopengl's scene: a large wooden floor (`planeVertices`, 50 × 50 units at y = -0.5, `wood.png`
repeated 25 times) and three wooden cubes drawn by learnopengl's `renderScene(const Shader &shader)` with
`renderCube()`: one floating at (0, 1.5, 0), one at (2, 0, 1) and a small rotated one at (-1, 0, 2). The light is at
`lightPos` (-2, 4, -1). `shadow_mapping.vs/.fs` light the scene: a light colour of 0.3, ambient, diffuse and Blinn-Phong
specular, combined as `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – with `float shadow = 0.0;` for now.
`renderQuad()`, a quad covering the window, is already there. The new shaders `shadow_mapping_depth.vs/.fs`,
`debug_quad.vs` and `debug_quad_depth.fs` are used from the first task on.
:::
:::vulkan
The project is learnopengl's scene: a large wooden floor (vertices 0..5: 50 × 50 units at y = -0.5,
`textures/wood.png` repeated 25 times) and three wooden cubes (one cube, vertices 6..41, drawn three times): one
floating at (0, 1.5, 0), one at (2, 0, 1) and a small rotated one at (-1, 0, 2). learnopengl's `renderScene()` is a
helper `renderScene(VkCommandBuffer commandBuffer)` that pushes each model matrix (a push constant, vertex stage) and
records the four draws. The light is at the global `lightPos` (-2, 4, -1). `shaders/shadow_mapping.vert/.frag` light the
scene: a light colour of 0.3, ambient, diffuse and Blinn-Phong specular, combined as
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – with `float shadow = 0.0;` for now. The new shaders
`shadow_mapping_depth.vert/.frag`, `debug_quad.vert` and `debug_quad_depth.frag` are used from the first task on.
:::
:::d3d12
The project is learnopengl's scene: a large wooden floor (vertices 0–5: 50 × 50 units at y = -0.5, `wood.png` repeated
25 times) and three wooden cubes (one cube, vertices 6–41, drawn three times): one floating at (0, 1.5, 0), one at
(2, 0, 1) and a small rotated one at (-1, 0, 2). `PopulateCommandList` computes four `ModelConstants` (the model matrix
and the normal matrix of each object) and sets them with `SetGraphicsRoot32BitConstants(0, …)` before each of the four
draws – learnopengl's `renderScene()`. The light is at the global `lightPos` (-2, 4, -1). `shadow_mapping.hlsl` lights the
scene: a light colour of 0.3, ambient, diffuse and Blinn-Phong specular, combined as
`(ambient + (1.0f - shadow) * (diffuse + specular)) * color` – with `float shadow = 0.0f;` for now.
`shadow_mapping_depth.hlsl` and `debug_quad.hlsl` are complete already; the first task compiles them.
:::

From the camera at (0, 0, 3) you see the floor and, at the top of the window, the floating cube from below. The two
other cubes are just outside the view, left and right of the camera; you'll meet them in the depth map. Press **Build &
run** (Ctrl+Enter): the floor is lit evenly – dim, the light colour is only 0.3 – and nothing casts a shadow. The
`// TODO:` comments in the project mark where your code goes.

## Shadow mapping

The idea behind shadow mapping is quite simple: we render the scene from the light's point of view and everything we
see from the light's perspective is lit and everything we can't see must be in shadow. Imagine a floor section with a
large box between itself and a light source. Since the light source will see this box and not the floor section when
looking in its direction, that specific floor section should be in shadow.

We want to get the point on the ray where it first hit an object and compare this closest point to other points on
this ray. We then do a basic test to see if a test point's ray position is further down the ray than the closest
point and if so, the test point must be in shadow. Iterating through possibly thousands of light rays from such a light
source is an extremely inefficient approach and doesn't lend itself too well for real-time rendering. We can do
something similar, but without casting light rays. Instead, we use something we're quite familiar with: the depth
buffer.

You may remember from the *Depth testing* chapter that a value in the depth buffer corresponds to the depth of a
fragment clamped to [0,1] from the camera's point of view. What if we were to render the scene from the light's
perspective and store the resulting depth values in a texture? This way, we can sample the closest depth values as
seen from the light's perspective. After all, the depth values show the first fragment visible from the light's
perspective. We store all these depth values in a texture that we call a *depth map* or *shadow map*.

To render the scene with shadows, we then go through two steps:

- **Pass 1:** render the scene from the light's point of view into the depth map. For every direction the light looks
  in, the depth map now holds the depth of the closest surface.
- **Pass 2:** render the scene as normal from the camera, and for every fragment, transform its position into the
  light's view. Its depth there – its distance from the light, so to speak – is compared with the closest depth stored
  in the depth map at that place. If the fragment is farther away than the closest surface, something stands between
  it and the light: the fragment is in shadow.

Let's say a fragment on the floor gets the depth 0.9 in the light's view, but the depth map holds 0.4 at that place –
the top of a box. Since 0.9 is greater than 0.4, the fragment is occluded and in shadow.

```quiz
In pass 2, a floor fragment transformed into the light's view has the depth 0.9, and the depth map holds 0.4 at its place. What does that mean?
- [ ] The fragment is lit: its depth is greater than the stored one
- [x] Something is closer to the light at that place (depth 0.4), so the fragment (0.9) is occluded: it's in shadow
- [ ] The fragment lies outside the light's view
- [ ] The depth map was not cleared
---
The depth map stores the closest depth the light sees in each direction. A fragment that is farther from the light than that closest surface is behind it – in its shadow.
```

## The depth map

The first pass requires us to generate a depth map. The depth map is the depth texture as rendered from the light's
perspective that we'll be using for testing for shadows. Because we need to store the rendered result of a scene into a
texture we're going to need a framebuffer again – or the {{api}} equivalent.

:::opengl
First we'll create a framebuffer object for rendering the depth map:

```cpp
    unsigned int depthMapFBO;
    glGenFramebuffers(1, &depthMapFBO);
```

Next we create a 2D texture that we'll use as the framebuffer's depth buffer:

```cpp
    const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
    unsigned int depthMap;
    glGenTextures(1, &depthMap);
    glBindTexture(GL_TEXTURE_2D, depthMap);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

Generating the depth map shouldn't look too complicated. Because we only care about depth values we specify the
texture's formats as `GL_DEPTH_COMPONENT`. We also give the texture a width and height of 1024: this is the resolution
of the depth map. `GL_NEAREST` filtering, because depths are compared, not blended.

With the generated depth texture we can attach it as the framebuffer's depth buffer:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);
    glDrawBuffer(GL_NONE); // no colour buffer: tell OpenGL we draw no colour data
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

We only need the depth information when rendering the scene from the light's perspective so there is no need for a
colour buffer. A framebuffer object however is not complete without a colour buffer so we need to explicitly tell
OpenGL we're not going to render any colour data. We do this by setting both the read and draw buffer to `GL_NONE`
with `glDrawBuffer` and `glReadBuffer`.
:::
:::vulkan
In Vulkan, "a framebuffer with only a depth texture" consists of four objects: a **depth image** that can be both drawn
into and sampled, its view, a **render pass** with a single depth attachment, and a **framebuffer** that connects the two.
The image needs a format that supports both uses. `findDepthMapFormat()` asks for it:

```cpp
    // a depth format that can be drawn into and sampled (learnopengl: GL_DEPTH_COMPONENT, GL_FLOAT)
    VkFormat findDepthMapFormat() {
        return findSupportedFormat(
            {VK_FORMAT_D32_SFLOAT, VK_FORMAT_D16_UNORM},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT
        );
    }
```

The render pass has one attachment, and no colour at all – learnopengl's `glDrawBuffer(GL_NONE)` becomes
`colorAttachmentCount = 0`:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthMapFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the depths: the shaders read them afterwards
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Compare it with the window's depth attachment of the earlier chapters: that one has `storeOp = DONT_CARE`, because its
depths are thrown away after the frame. Here the depths are the whole point, so they are stored, and the pass leaves
the image in `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`, the layout for sampling a depth image. The subpass
references it as its depth attachment:

```cpp
        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 0; // no colour: only the depth is drawn
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

Two subpass dependencies order the pass against the fragment shaders that read the depth map: before the pass, the
depth writes wait until the last frame's fragment shaders have read the old depths
(`VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT` / `VK_ACCESS_SHADER_READ_BIT` → the fragment tests stages and the depth
attachment accesses); after it, the fragment shaders wait until the depths are written:

```cpp
        // after the pass: the fragment shaders that sample the depth map wait until the depths have been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

All of that is `createDepthMapRenderPass()`, creating `depthMapRenderPass`. `createDepthMap()` creates the image – the
size is the depth map's resolution, `const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`, and the usage says
both things we'll do with it – its view and the framebuffer:

```cpp
    void createDepthMap() {
        VkFormat depthMapFormat = findDepthMapFormat();
        createImage(SHADOW_WIDTH, SHADOW_HEIGHT, depthMapFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, depthMapImage, depthMapImageMemory);
        depthMapImageView = createImageView(depthMapImage, depthMapFormat, VK_IMAGE_ASPECT_DEPTH_BIT);

        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &depthMapImageView;
        framebufferInfo.width = SHADOW_WIDTH;
        framebufferInfo.height = SHADOW_HEIGHT;
        framebufferInfo.layers = 1;
```

`createDepthMapSampler()` creates `depthMapSampler` with `VK_FILTER_NEAREST` for both filters (depths are compared,
not blended), `VK_SAMPLER_ADDRESS_MODE_REPEAT` like learnopengl's texture, and no anisotropy. The descriptor set gets
the depth map at binding 2 – a `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` for the fragment stage, written with the layout
the pass leaves it in:

```cpp
        VkDescriptorImageInfo depthMapInfo{};
        depthMapInfo.imageLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // the depth map pass's finalLayout
        depthMapInfo.imageView = depthMapView;
        depthMapInfo.sampler = depthMapSampler;
```

(`createDescriptorSet()` takes the depth map's view and sampler as parameters, and the pool now holds two combined
image samplers.)
:::
:::d3d12
In Direct3D 12 the depth map is a texture with two views: a **depth stencil view** (DSV) for drawing into it, and a
**shader resource view** (SRV) for reading it in a shader – the pattern of Microsoft's D3D12Multithreading sample. The
catch is the format. A depth format like `DXGI_FORMAT_D32_FLOAT` can only be viewed as a depth buffer, not as a
shader resource. So the resource is created **typeless**, `DXGI_FORMAT_R32_TYPELESS` – 32 bits per texel, no
interpretation yet – and each view picks its interpretation: `DXGI_FORMAT_D32_FLOAT` for the DSV,
`DXGI_FORMAT_R32_FLOAT` for the SRV. The resource must also be allowed to be a depth stencil:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC shadowDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);

        // It is cleared to 1.0, the far plane, every frame.
        D3D12_CLEAR_VALUE clearValue = {};
        clearValue.Format = DXGI_FORMAT_D32_FLOAT;
        clearValue.DepthStencil.Depth = 1.0f;
        clearValue.DepthStencil.Stencil = 0;

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &shadowDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &clearValue,
            IID_PPV_ARGS(&m_shadowMap)));
```

`SHADOW_WIDTH` and `SHADOW_HEIGHT` are 1024 (`static const UINT SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`): the
resolution of the depth map. The texture starts in the `DEPTH_WRITE` state, ready for the first pass. Its DSV goes into
slot 1 of the DSV heap, after the window's depth buffer (the heap now has `NumDescriptors = 2`, and
`m_dsvDescriptorSize` is the step between its slots):

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2D;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
        m_device->CreateDepthStencilView(m_shadowMap.Get(), &dsvDesc, dsvHandle);
```

Its SRV goes into slot 2 of the CBV/SRV heap (now 3 descriptors), right after the wood's:

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_shadowMap.Get(), &srvDesc, srvHandle);
```

Because the two SRVs are neighbours in the heap, one descriptor table reaches both: the root signature's SRV range grows
to two registers, t0 (the wood) and t1 (the shadow map):

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

The shadow map gets its own static sampler s1, a copy of the wood's with point filtering (learnopengl: `GL_NEAREST` –
depths are compared, not blended), still wrapping like learnopengl's `GL_REPEAT` for now:

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].ShaderRegister = 1;
```
:::

:::opengl
```quiz
Why does the depth map framebuffer call `glDrawBuffer(GL_NONE)` and `glReadBuffer(GL_NONE)`?
- [ ] To clear the colour buffer before the depth pass
- [ ] Because a depth texture can only be attached when no shader is bound
- [ ] To make the depth map read-only for the second pass
- [x] It has no colour attachment, and a framebuffer is only complete without one if OpenGL is told that no colour is drawn or read
---
The depth pass only needs depths. Without a colour buffer the framebuffer would be incomplete – unless the draw and read buffers are set to `GL_NONE`.
```
:::
:::vulkan
```quiz
Which settings make the depth image usable as a texture after the depth pass?
- [ ] `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD` and the usage `VK_IMAGE_USAGE_TRANSFER_SRC_BIT`
- [ ] Only `colorAttachmentCount = 0`
- [x] The usage `VK_IMAGE_USAGE_SAMPLED_BIT` (besides the depth attachment bit), `storeOp = VK_ATTACHMENT_STORE_OP_STORE`, and `finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`
- [ ] A second framebuffer for the window's render pass
---
The image must be allowed to be sampled, its depths must be kept at the end of the pass instead of discarded, and it must end in a layout a shader can read from – the same layout the descriptor names.
```
:::
:::d3d12
```quiz
Why is the shadow map created as `DXGI_FORMAT_R32_TYPELESS` instead of `DXGI_FORMAT_D32_FLOAT`?
- [x] A resource with a depth format can't have a shader resource view; a typeless one can be viewed as `D32_FLOAT` by the DSV and as `R32_FLOAT` by the SRV
- [ ] Typeless resources are faster to clear
- [ ] `D32_FLOAT` textures cannot be 1024 × 1024
- [ ] So that the pixel shader can write depths into it
---
The DSV and the SRV interpret the same 32 bits per texel differently: as a depth when drawing, as a float colour when sampling. That needs a typeless resource of the same bit layout.
```
:::

### Light space transform

What we need is a matrix that transforms every vertex into the light's view – the *light space*. For that we need a
view matrix and a projection matrix, just like for the camera.

Because we're modelling a directional light source, all its light rays are parallel. For this reason, we're going to
use an orthographic projection matrix for the light source where there is no perspective deform. The light is
positioned at `lightPos`, looks at the origin, and its orthographic box is 20 × 20 units wide around that line of
sight, from 1.0 to 7.5 units in front of the light. Because a projection matrix indirectly determines the range of what
is visible (e.g. what is not clipped) you want to make sure the size of the projection frustum correctly contains the
objects you want to be in the depth map. When objects or fragments are not in the depth map they will not produce
shadows.

:::opengl
```cpp
        float near_plane = 1.0f, far_plane = 7.5f;
        lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane); // a directional light: parallel rays
        lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
        lightSpaceMatrix = lightProjection * lightView;
```

Combining these two gives us a light space transformation matrix that transforms each world-space vector into the space
as visible from the light source; exactly what we need to render the depth map.
:::
:::vulkan
The matrix goes into the uniform buffer, after `proj`. It's computed in `updateUniformBuffer()`:

```cpp
        float near_plane = 1.0f, far_plane = 7.5f;
        glm::mat4 lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane);
        glm::mat4 lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
        ubo.lightSpaceMatrix = lightProjection * lightView;
```

Combining these two gives us a light space transformation matrix that transforms each world-space vector into the
space as visible from the light source. Two Vulkan details:

- The project defines `GLM_FORCE_DEPTH_ZERO_TO_ONE`, so `glm::ortho` maps the depth to 0..1, Vulkan's range – the same
  0..1 the depth image stores.
- The camera's projection gets `proj[1][1] *= -1` so the picture stands upright in the window. The light's matrix does
  **not**: the depth pass and the shadow lookup in pass 2 use the same matrix, so whatever its y direction is, the two
  agree. Nobody looks at the depth map as a picture – except the debug quad, which we'll come to.

Add `glm::mat4 lightSpaceMatrix;` after `proj` in `UniformBufferObject`, and `mat4 lightSpaceMatrix;` after `proj` in
the uniform block of `shadow_mapping.frag` too, so the members after it (`viewPos`, `lightPos`) keep their offsets.
:::
:::d3d12
The matrix goes into the constant buffer, after `projection` (`XMFLOAT4X4 lightSpaceMatrix;` in `SceneConstantBuffer`,
`float4x4 lightSpaceMatrix;` in the cbuffer of `shadow_mapping.hlsl`, so both layouts stay the same). It's computed in
`OnUpdate`:

```cpp
    float near_plane = 1.0f, far_plane = 7.5f;
    XMMATRIX lightProjection = XMMatrixOrthographicRH(20.0f, 20.0f, near_plane, far_plane);
    XMMATRIX lightView = XMMatrixLookAtRH(XMLoadFloat3(&lightPos), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
    XMMATRIX lightSpaceMatrix = lightView * lightProjection;    // row vectors: the view first, then the projection
    XMStoreFloat4x4(&constantBufferData.lightSpaceMatrix, XMMatrixTranspose(lightSpaceMatrix));
```

`XMMatrixOrthographicRH(20.0f, 20.0f, …)` is a box 20 units wide and high, centred on the line of sight – the same box
as learnopengl's symmetric `glm::ortho(-10, 10, -10, 10, …)` (`XMMatrixOrthographicOffCenterRH(-10.0f, 10.0f, -10.0f,
10.0f, …)` would be the literal translation). It maps the depth to 0..1, Direct3D's range. With DirectXMath's row
vectors the product is written the other way round: `lightView * lightProjection`, the view first. Combining these
two gives us a light space transformation matrix that transforms each world-space vector into the space as visible
from the light source.
:::

```quiz
Why does the directional light use an orthographic projection for its depth map?
- [ ] Because orthographic depth maps need no depth test
- [x] A directional light's rays are parallel; an orthographic projection has no perspective, so it renders the scene along parallel rays
- [ ] Because a perspective projection cannot have a near plane of 1.0
- [ ] So that the depth map can be smaller than the window
---
An orthographic projection projects along parallel lines – like sunlight. A light at a point, which shines in all directions from there, needs a perspective projection instead (see the end of the chapter).
```

### Render to depth map

When we render the scene from the light's perspective we'd much rather use a simple shader that only transforms the
vertices to light space and not much more. Only the depth matters: no lighting, no texture, not even a colour.

:::opengl
For such a simple shader called `simpleDepthShader` we'll use the following vertex shader, `shadow_mapping_depth.vs`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 lightSpaceMatrix;
uniform mat4 model;

void main()
{
    gl_Position = lightSpaceMatrix * model * vec4(aPos, 1.0);
}
```

This vertex shader takes a per-object model, a vertex, and transforms all vertices to light space using
`lightSpaceMatrix`. Since we have no colour buffer and disabled the draw and read buffers, the resulting fragments do
not require any processing so we can simply use an empty fragment shader – that's `shadow_mapping_depth.fs`:

```glsl
#version 330 core

void main()
{
    // nothing to do: the depth buffer is written anyway
    // gl_FragDepth = gl_FragCoord.z;
}
```

This empty fragment shader does no processing whatsoever, and at the end of its run the depth buffer is updated. We
could explicitly set the depth by uncommenting its one line, but this is effectively what happens behind the scene
anyways.

Rendering the depth map now effectively becomes:

```cpp
        simpleDepthShader.use();
        simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);

        glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
            glClear(GL_DEPTH_BUFFER_BIT);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, woodTexture);
            renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // reset viewport
        glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

Make sure to call `glViewport`. Because shadow maps often have a different resolution compared to what we originally
render the scene in (usually the window resolution), we need to change the viewport parameters to accommodate for the
size of the shadow map. If we forget to update the viewport parameters, the resulting depth map will be either
incomplete or too small.
:::
:::vulkan
For such a simple shader we'll use the following vertex shader, `shaders/shadow_mapping_depth.vert`. It reads the
uniform buffer's first three members and the model matrix from the push constants:

```glsl
// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 lightSpaceMatrix;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = ubo.lightSpaceMatrix * pc.model * vec4(inPosition, 1.0);
}
```

This vertex shader transforms all vertices to light space using `lightSpaceMatrix`. Since the render pass has no colour
attachment, the resulting fragments do not require any processing, so `shadow_mapping_depth.frag` is empty: the depth
test writes the depth by itself.

The depth pass needs its own pipeline: it reads only the position (one vertex attribute), belongs to
`depthMapRenderPass`, and has no colour blend attachment – their number must match the subpass's colour attachments,
which is 0. So `createPipeline` gets three parameters for that:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkRenderPass pipelineRenderPass, uint32_t colorAttachmentCount, VkPipeline& pipeline) {
```

used as `vertexInputInfo.vertexAttributeDescriptionCount = attributeCount;`, `colorBlending.attachmentCount =
colorAttachmentCount;` and `pipelineInfo.renderPass = pipelineRenderPass;`. The three pipelines:

```cpp
        createPipeline("shaders/shadow_mapping.vert.spv", "shaders/shadow_mapping.frag.spv", 3, renderPass, 1, graphicsPipeline);
        // the depth pass: only the position, for the depth map's render pass, which has no colour attachment
        createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv", 1, depthMapRenderPass, 0, depthPipeline);
        createPipeline("shaders/debug_quad.vert.spv", "shaders/debug_quad_depth.frag.spv", 3, renderPass, 1, debugPipeline);
```

Rendering the depth map is a render pass of its own, recorded at the start of `recordCommandBuffer()`, before the
window's:

```cpp
        // 1. render depth of scene to texture (from light's perspective)
        VkRenderPassBeginInfo depthMapPassInfo{};
        depthMapPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        depthMapPassInfo.renderPass = depthMapRenderPass;
        depthMapPassInfo.framebuffer = depthMapFramebuffer;
        depthMapPassInfo.renderArea.offset = {0, 0};
        depthMapPassInfo.renderArea.extent = {SHADOW_WIDTH, SHADOW_HEIGHT};

        // one clear value: the depth 1.0 (the far plane)
        VkClearValue depthMapClearValue{};
        depthMapClearValue.depthStencil = {1.0f, 0};

        depthMapPassInfo.clearValueCount = 1;
        depthMapPassInfo.pClearValues = &depthMapClearValue;

        vkCmdBeginRenderPass(commandBuffer, &depthMapPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, depthPipeline);
```

then the depth map's viewport and scissor – 1024 × 1024 (learnopengl: `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)`) –
the descriptor set and the scene:

```cpp
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);
        renderScene(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the depth map is now in VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL
```

(The vertex buffer is now bound once at the top, before both passes.) Make sure to set the viewport. Because shadow
maps often have a different resolution compared to the window, the viewport must match the size of the shadow map; the
window's pass then sets the window's viewport again and binds its own pipeline. Bindings like the vertex buffer and the
descriptor set are command buffer state: they stay bound across render passes.
:::
:::d3d12
For such a simple shader we'll use `shadow_mapping_depth.hlsl`, which is only a vertex shader:

```hlsl
// The vertex shader: the position as the light's view and projection see it.
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(position, model), lightSpaceMatrix);
}
```

It transforms all vertices to light space using `lightSpaceMatrix`. There is no pixel shader at all: with no render
target there is no colour to compute, and the rasterizer and the depth test write the depth by themselves
(learnopengl's fragment shader for this pass is empty). The depth pass's pipeline state is the scene's description
with four changes:

```cpp
        ComPtr<ID3DBlob> depthVertexShader;
        ThrowIfFailed(D3DCompileFromFile(L"shadow_mapping_depth.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &depthVertexShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(depthVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(nullptr, 0);
        psoDesc.NumRenderTargets = 0;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_depthPipelineState)));
```

The DSV format is the format of the view the pass draws through. Rendering the depth map is the first thing
`PopulateCommandList` records:

```cpp
    m_commandList->SetPipelineState(m_depthPipelineState.Get());
    m_commandList->RSSetViewports(1, &m_shadowViewport);
    m_commandList->RSSetScissorRects(1, &m_shadowScissorRect);
    CD3DX12_CPU_DESCRIPTOR_HANDLE shadowDsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
    m_commandList->OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle);
    m_commandList->ClearDepthStencilView(shadowDsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

followed by the scene's four draws (`SetGraphicsRoot32BitConstants` with each object's constants, then
`DrawInstanced`). `OMSetRenderTargets(0, nullptr, …)` binds no render target, only the shadow map's DSV –
learnopengl's `glDrawBuffer(GL_NONE)`. `m_shadowViewport` and `m_shadowScissorRect` are the shadow map's size, 1024 ×
1024 (set in the constructor). Make sure to set them: because shadow maps often have a different resolution compared
to the window, the viewport must match the size of the shadow map, and the window's pass then sets `m_viewport` again.

When the pass is done, the shadow map changes roles – from a depth buffer that is written to a texture the pixel shader
reads – and Direct3D 12 wants that said with a barrier:

```cpp
    CD3DX12_RESOURCE_BARRIER shadowBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_shadowMap.Get(), D3D12_RESOURCE_STATE_DEPTH_WRITE, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &shadowBarrier);
```

At the end of the frame, after the back buffer's barrier to `PRESENT`, a second barrier turns it back for the next
frame's depth pass:

```cpp
    shadowBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_shadowMap.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_DEPTH_WRITE);
    m_commandList->ResourceBarrier(1, &shadowBarrier);
```
:::

If we did everything right, the depth map is now filled with the closest depth of every visible fragment from the
light's perspective. By rendering this texture onto a 2D quad that fills the screen (similar to what we did in the
post-processing section of the *Framebuffers* chapter) we can display it on the screen – a good way to check it.

:::opengl
`debug_quad.vs` passes the quad's positions and texture coordinates through; in `debug_quad_depth.fs` we sample the
depth map and show the depth as a grey:

```glsl
    float depthValue = texture(depthMap, TexCoords).r;
    // FragColor = vec4(vec3(LinearizeDepth(depthValue) / far_plane), 1.0); // perspective
    FragColor = vec4(vec3(depthValue), 1.0); // orthographic
```

The light's projection is orthographic, so its depth is linear already; the `LinearizeDepth` function in the shader is
for perspective projections, which we'll come back to at the end. After the scene's normal render (pass 2), draw the
quad:

```cpp
        debugDepthQuad.use();
        debugDepthQuad.setFloat("near_plane", near_plane);
        debugDepthQuad.setFloat("far_plane", far_plane);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        renderQuad(); // covers the whole window
```

Now do the first task, **depth-map**. It brings everything of this section together: the two shaders
(`Shader simpleDepthShader("shadow_mapping_depth.vs", "shadow_mapping_depth.fs");` and
`Shader debugDepthQuad("debug_quad.vs", "debug_quad_depth.fs");`), the depth map FBO, `debugDepthQuad.setInt("depthMap",
0)` once, pass 1 at the start of the render loop, the debug quad after pass 2, the vertex shader's `gl_Position` and the
debug fragment shader. Delete `depthMap` and `depthMapFBO` at the end.
:::
:::vulkan
The debug quad is learnopengl's quad that covers the window, appended to `vertices` as vertices 42 to 47 – with v
flipped. Here's why: the depth pass has no y flip, so the depth image's row 0 holds the light's NDC y = -1, the bottom
of its view; but in Vulkan's window NDC y = -1 is the top. With learnopengl's texture coordinates the quad would show
the depth map upside down; with `1 - v` it's upright, like OpenGL's:

```cpp
    // debug quad (vertices 42..47): covers the window (x, y = -1..1, z = 0); v flipped: the depth map has no y flip
    // (see updateUniformBuffer), so its row 0 is the light's bottom (NDC y = -1), and Vulkan's NDC y = -1 is the top
    {{-1.0f,  1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 0.0f}},
    {{-1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 1.0f}},
```

(and the second triangle). `debug_quad.vert` passes the positions and texture coordinates through;
`debug_quad_depth.frag` reads the depth map at binding 2 and shows the depth as a grey:

```glsl
    float depthValue = texture(depthMap, fragTexCoord).r;
    outColor = vec4(vec3(depthValue), 1.0); // orthographic: the depth is linear already
```

In the window's pass, the debug quad replaces the scene for now:

```cpp
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, debugPipeline);
        vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the debug quad's 6 vertices start at vertex 42
```

Now do the first task, **depth-map**. It brings everything of this section together: `SHADOW_WIDTH` / `SHADOW_HEIGHT`,
the debug quad's vertices, the light-space matrix, `createDepthMapRenderPass()`, `createDepthMap()`,
`createDepthMapSampler()`, the new `createPipeline` parameters and the two new pipelines, binding 2 of the descriptor
set, the depth pass in `recordCommandBuffer()`, the two shaders – and destroying the new objects in `cleanup()`
(framebuffer, view, image, memory, sampler, pipelines, render pass).
:::
:::d3d12
`debug_quad.hlsl` passes the quad's positions and texture coordinates through and shows the shadow map (t1, through the
same descriptor table as the wood) as a grey:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float depthValue = depthMap.Sample(shadowSampler, input.texCoord).r;
    return float4(depthValue, depthValue, depthValue, 1.0f);
}
```

The light's projection is orthographic, so its depth is linear already. The quad is learnopengl's, appended to the vertex
buffer as vertices 42 to 47, in Direct3D's texture coordinates (v = 0 at the top). It's upright as it is: the shadow
map's row 0 holds the light's NDC y = +1, the top of its view. Its pipeline state, `m_debugQuadPipelineState`, uses
`debug_quad.hlsl`'s shaders, one render target again (`NumRenderTargets = 1`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM`) and `DepthStencilState.DepthEnable = FALSE`. After the scene's draws in the window:

```cpp
    m_commandList->SetPipelineState(m_debugQuadPipelineState.Get());
    m_commandList->DrawInstanced(6, 1, 42, 0);
```

Now do the first task, **depth-map**. It brings everything of this section together: `SHADOW_WIDTH` / `SHADOW_HEIGHT`,
the shadow viewport and scissor rectangle, the larger heaps and `m_dsvDescriptorSize`, the SRV range of 2 and sampler
s1, the two pipeline states, the quad's vertices, the shadow map with its two views, the light-space matrix, pass 1 with
its barriers, and the debug quad's draw.
:::

Press **Build & run**: instead of the scene, the window shows the **depth map** – grey everywhere, the 1024 × 1024 map
stretched to the window. The floor is a vertical gradient: white at the top, where it lies beyond the far plane (nothing
was drawn there and the cleared depth 1.0 stays), mid grey in the middle, darker towards the bottom where it comes
closer to the light, and then white again in a band at the bottom: that part of the floor is in front of the near plane
and was clipped. The floating cube is the darkest spot, closest to the light; the cube at (2, 0, 1) is lighter than the
floor around it, and the small rotated cube sits between the two.

## Rendering shadows

With a properly generated depth map we can start rendering the actual shadows. The code to check if a fragment is in
shadow is (quite obviously) executed in the fragment shader, but we do the light-space transformation in the vertex
shader.

:::opengl
```glsl
out VS_OUT {
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
    vec4 FragPosLightSpace;
} vs_out;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
uniform mat4 lightSpaceMatrix;

void main()
{
    vs_out.FragPos = vec3(model * vec4(aPos, 1.0));
    vs_out.Normal = transpose(inverse(mat3(model))) * aNormal;
    vs_out.TexCoords = aTexCoords;
    vs_out.FragPosLightSpace = lightSpaceMatrix * vec4(vs_out.FragPos, 1.0);
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

What is new here is the extra output vector `FragPosLightSpace`. We take the same `lightSpaceMatrix` (used to transform
vertices to light space in the depth map stage) and transform the world-space vertex position to light space for use
in the fragment shader.
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 lightSpaceMatrix;
} ubo;
```

```glsl
void main() {
    vs_out.fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    vs_out.normal = transpose(inverse(mat3(pc.model))) * inNormal;
    vs_out.texCoord = inTexCoord;
    vs_out.fragPosLightSpace = ubo.lightSpaceMatrix * vec4(vs_out.fragPos, 1.0);
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

What is new here is the extra output `vec4 fragPosLightSpace;` in the `VS_OUT` block (and in the fragment shader's
block too). We take the same `lightSpaceMatrix` (used to transform vertices to light space in the depth pass) and
transform the world-space vertex position to light space for use in the fragment shader.
:::
:::d3d12
```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD0;
    float4 fragPosLightSpace : TEXCOORD1;    // the position as the light's view and projection see it
};
```

```hlsl
    // The same position, as the depth pass saw it from the light.
    result.fragPosLightSpace = mul(worldPos, lightSpaceMatrix);
```

What is new here is the extra output `fragPosLightSpace`. We take the same `lightSpaceMatrix` (used to transform
vertices to light space in the depth pass) and transform the world-space position to light space for use in the pixel
shader.
:::

The main fragment shader we'll use to render the scene uses the Blinn-Phong lighting model. Within the fragment shader
we then calculate a `shadow` value that is either 1.0 when the fragment is in shadow or 0.0 when not in shadow. The
resulting diffuse and specular components are then multiplied by this shadow component. Because shadows are rarely
completely dark (due to light scattering) we leave the ambient component out of the shadow multiplications – that's the
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color` already in the shader.

The first thing to do to check whether a fragment is in shadow, is transform the light-space fragment position in clip
space to normalized device coordinates. When we output a clip-space vertex position to the built-in position output in
the vertex shader, the rasterizer automatically does a perspective divide e.g. transform clip-space coordinates in the
range [-w,w] to [-1,1] by dividing the x, y and z component by the vector's w component. As the clip-space
`FragPosLightSpace` is not passed to the fragment shader through that output, we have to do this perspective divide
ourselves. (With an orthographic projection w stays 1.0, so the divide changes nothing – but it does no harm and makes
the function work for perspective projections as well.)

Because the depth from the depth map is in the range [0,1] and we also want to use the projected coordinates to sample
from the depth map, we transform the NDC coordinates to the range [0,1]. And here the APIs differ.

:::opengl
In OpenGL, NDC is -1..1 in x, y **and** z, while the depth texture stores the window depth 0..1. So all three
components are mapped with `* 0.5 + 0.5`. The texture's v = 0 is its bottom row, the same direction as NDC y, so no flip
is needed:

```glsl
float ShadowCalculation(vec4 fragPosLightSpace)
{
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth  ? 1.0 : 0.0;

    return shadow;
}
```
:::
:::vulkan
In Vulkan (with `GLM_FORCE_DEPTH_ZERO_TO_ONE`) NDC z is already 0..1 – the same range the depth image stores – so only
x and y are mapped with `* 0.5 + 0.5`. And y needs no flip: in the depth pass NDC y = -1 landed on the image's row 0
(Vulkan's framebuffer y points down), and the lookup's v = -1 × 0.5 + 0.5 = 0 also reads row 0. The two agree:

```glsl
float ShadowCalculation(vec4 fragPosLightSpace) {
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y to the [0,1] range of texture coordinates; z is in [0,1] already (GLM_FORCE_DEPTH_ZERO_TO_ONE)
    projCoords.xy = projCoords.xy * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth ? 1.0 : 0.0;

    return shadow;
}
```
:::
:::d3d12
In Direct3D, NDC z is already 0..1 – the same range the shadow map stores – so only x and y become texture coordinates.
And y is flipped: Direct3D's texture v = 0 is the top row of the render target, which is NDC y = +1. So
v = -y * 0.5 + 0.5:

```hlsl
float ShadowCalculation(float4 fragPosLightSpace)
{
    // perform perspective divide
    float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y from [-1,1] to [0,1] texture coordinates: in Direct3D v points down
    // while y points up, so y is flipped. z needs nothing: Direct3D's depth is 0..1 already.
    float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = shadowMap.Sample(shadowSampler, shadowUV).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth ? 1.0f : 0.0f;

    return shadow;
}
```

The shader declares `Texture2D shadowMap : register(t1);` and `SamplerState shadowSampler : register(s1);`.
:::

With these projected coordinates we can sample the depth map as the resulting [0,1] coordinates from `projCoords`
directly correspond to the transformed NDC coordinates from the first render pass. This gives us the closest depth from
the light's point of view. To get the current depth at this fragment we simply retrieve the projected vector's z
coordinate which equals the depth of this fragment from the light's perspective. The actual comparison is then simply
a check whether `currentDepth` is higher than `closestDepth` and if so, the fragment is in shadow.

:::opengl
```quiz
Why does OpenGL's `ShadowCalculation` map z with `* 0.5 + 0.5` too, not only x and y?
- [ ] Because the depth map was cleared to 0.5
- [ ] Because the depth texture stores values from -1 to 1
- [ ] Because the bias needs positive values
- [x] OpenGL's NDC z runs from -1 to 1, but the depth texture stores the window depth 0..1 – the fragment's z must be in the same range as the stored depths
---
x and y become texture coordinates (0..1), and z must match the depth range the depth pass wrote. In Vulkan and Direct3D, NDC z is 0..1 already, so there only x and y are mapped.
```
:::
:::vulkan
```quiz
Why does Vulkan's `ShadowCalculation` map only x and y, and why doesn't it flip y?
- [x] NDC z is 0..1 already (`GLM_FORCE_DEPTH_ZERO_TO_ONE`), like the stored depths; and the light's matrix has no y flip, so NDC y = -1 is row 0 both when the depth pass writes and when the lookup reads
- [ ] Because Vulkan samplers flip y automatically
- [ ] Because the depth image is stored upside down and z is ignored
- [ ] Because only `proj[1][1] *= -1` would make z negative
---
OpenGL's NDC z is -1..1, Vulkan's 0..1. And as long as the depth pass and the lookup use the same unflipped matrix, the image's row order and the texture coordinates agree – only the debug quad, which shows the image as a picture, needs a flipped v.
```
:::
:::d3d12
```quiz
Why does Direct3D's `ShadowCalculation` use `-projCoords.y * 0.5f + 0.5f` for v and leave z as it is?
- [ ] Because the shadow map was drawn upside down by the depth pass
- [x] Direct3D's texture v = 0 is the top row of the render target, which is NDC y = +1, so y is flipped; and NDC z is 0..1 already, like the stored depths
- [ ] Because `XMMatrixOrthographicRH` flips y
- [ ] Because z must be negative for the comparison
---
In Direct3D, NDC y points up while texture v points down; the depth range is 0..1 in NDC and in the depth buffer alike. OpenGL instead maps x, y and z with `* 0.5 + 0.5` and needs no flip.
```
:::

:::opengl
In `main.cpp`, the scene's shader gets the depth map on texture unit 1 and the light-space matrix:

```cpp
    shader.setInt("shadowMap", 1);
```

```cpp
        shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        renderScene(shader);
```

Now do the task **shadows**: the vertex shader's `FragPosLightSpace`, the fragment shader's `uniform sampler2D
shadowMap;` (and `FragPosLightSpace` in its block), `ShadowCalculation`, `float shadow =
ShadowCalculation(fs_in.FragPosLightSpace);` in `main`, the two lines in `main.cpp` – and comment out the debug quad's
`renderQuad();` so we see the scene again.
:::
:::vulkan
Now do the task **shadows**: the vertex shader's `lightSpaceMatrix` and `fragPosLightSpace`, the fragment shader's
`layout(binding = 2) uniform sampler2D shadowMap;` (and `fragPosLightSpace` in its block), `ShadowCalculation`, and
`float shadow = ShadowCalculation(fs_in.fragPosLightSpace);` in `main`. In the window's pass, draw the scene again with
`graphicsPipeline` and leave the debug quad as a comment:

```cpp
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);
        renderScene(commandBuffer);

        // render the depth map to the debug quad for visual debugging (instead of the scene):
        // vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, debugPipeline);
        // vkCmdDraw(commandBuffer, 6, 1, 42, 0);
```

The descriptor set bound for the depth pass is still bound – the depth map at binding 2 included.
:::
:::d3d12
Now do the task **shadows**: `shadowMap` and `shadowSampler` in `shadow_mapping.hlsl`, `fragPosLightSpace` in
`PSInput` and `VSMain`, `ShadowCalculation`, and `float shadow = ShadowCalculation(input.fragPosLightSpace);` in
`PSMain`. In `main.cpp` comment out the debug quad's two lines so we see the scene again:

```cpp
    // m_commandList->SetPipelineState(m_debugQuadPipelineState.Get());
    // m_commandList->DrawInstanced(6, 1, 42, 0);
```

The textures' descriptor table already reaches the shadow map's SRV (t1), and sampler s1 is part of the root
signature.
:::

Press **Build & run**: the floating cube now casts a **shadow** on the floor, lower right – the fragments there get only
the ambient light. But something is clearly off: the lit floor is covered in fine dark stripes, a moiré of rings. Let's
fix that.

## Improving shadow maps

We managed to get the basics of shadow mapping working, but as you can see there are still a few artifacts related to
shadow mapping we need to fix for better results, which we'll focus on in the next sections.

### Shadow acne

This shadow mapping artifact is called *shadow acne*. We can explain shadow acne by looking at the depth map: because
the shadow map is limited by resolution, multiple fragments can sample the same value from the depth map when they're
relatively far away from the light source. One texel of our 1024 × 1024 depth map covers 20/1024 ≈ 0.02 units of the
floor seen from the light, which is several pixels of the window.

Each texel of the depth map stores one depth, measured at the texel's centre – think of it as a little flat tile, held
perpendicular to the light. The floor, however, is tilted relative to the light. So across the area of one texel, the
real floor is partly a bit closer to the light than the tile and partly a bit farther away. Several fragments sample the
same depth; the ones slightly closer to the light than the stored value are lit, the ones slightly farther away are
considered in shadow – although nothing covers them. That's the striped pattern: the floor shadows itself.

We can solve this issue with a small little hack called a *shadow bias* where we simply offset the depth of the surface
(or the shadow map) by a small bias amount such that the fragments are not incorrectly considered above the surface. A
fixed bias like 0.005 solves the issue to a large extent, but surfaces at a steep angle to the light may still produce
shadow acne. A more solid approach would be to change the amount of bias based on the surface angle towards the light:
something we can solve with the dot product. Here we have a maximum bias of 0.05 and a minimum of 0.005 based on the
surface's normal and light direction. This way, surfaces like the floor that are almost perpendicular to the light
source get a small bias, while surfaces like the cube's side-faces get a much larger bias.

```quiz
What causes shadow acne, and what does the bias do against it?
- [ ] The depth map has too many mip levels; the bias selects level 0
- [ ] The light is too close to the floor; the bias moves the light away
- [x] Several fragments share one depth map texel, and on a surface tilted to the light half of them lie slightly behind its stored depth; subtracting a small bias from the fragment's depth stops the surface from shadowing itself
- [ ] The comparison should use `>=`; the bias rounds the depths
---
The depth map's limited resolution turns a sloped surface into a staircase of stored depths. A bias – larger for steeper angles to the light – moves the comparison a little towards the light, so a surface no longer counts as its own occluder.
```

:::opengl
Now do the task **bias**. In `ShadowCalculation`:

```glsl
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.Normal);
    vec3 lightDir = normalize(lightPos - fs_in.FragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
```
:::
:::vulkan
Now do the task **bias**. In `ShadowCalculation`:

```glsl
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.normal);
    vec3 lightDir = normalize(ubo.lightPos - fs_in.fragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;
```
:::
:::d3d12
Now do the task **bias**. HLSL has no global inputs like GLSL's `fs_in`, so `ShadowCalculation` gets the normal and the
light direction that `PSMain` has computed already:

```hlsl
float ShadowCalculation(float4 fragPosLightSpace, float3 normal, float3 lightDir)
```

```hlsl
    // calculate bias (based on depth map resolution and slope)
    float bias = max(0.05f * (1.0f - dot(normal, lightDir)), 0.005f);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;
```

and `PSMain` calls `ShadowCalculation(input.fragPosLightSpace, normal, lightDir)`. Direct3D can also bias in the
rasterizer, while writing the depth: the depth pass PSO's `RasterizerState.DepthBias` and `SlopeScaledDepthBias`. The
course stays with learnopengl's shader bias.
:::

The depth is linear from 0 at the near plane to 1 at the far plane in all three APIs (the projection is orthographic),
so learnopengl's bias values fit unchanged. Press **Build & run**: **the stripes are gone**, the floor is lit as at the
start, and the cube's shadow stays – with hard, jagged edges.

### Peter panning

A disadvantage of using a shadow bias is that you're applying an offset to the actual depth of objects. As a result,
the bias may become large enough to see a visible offset of shadows compared to the actual object locations: the shadow
seems to start a little away from the foot of the object, as if the object were floating. This shadow artifact is
called *peter panning* since objects seem slightly detached from their shadows. In our scene the floating cube floats
anyway, so you won't notice it; for the cubes standing on the floor it would show.

We can use a little trick to solve most of the peter panning issue by using front face culling when rendering the
depth map. You may remember from the *Face culling* chapter that by default we cull back faces. When rendering the depth
map we could cull the front faces instead: the depth map then stores the depths of the back faces of solid objects, and
the bias no longer pushes the comparison past the front faces. That works for solid objects – but not for the floor: it
is a single plane with no back side, and with its front face culled it would not be in the depth map at all. That's
why learnopengl doesn't keep this trick in its final code, and neither do we; it's not a task.

:::opengl
In OpenGL it would be `glEnable(GL_CULL_FACE); glCullFace(GL_FRONT);` around `renderScene(simpleDepthShader)`, and
`glCullFace(GL_BACK)` afterwards.
:::
:::vulkan
In Vulkan it would be a setting of the depth pipeline: `rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT`, with
`frontFace = VK_FRONT_FACE_CLOCKWISE` – the light's projection has no y flip, so the cube's counter-clockwise faces
appear clockwise in Vulkan's framebuffer.
:::
:::d3d12
In Direct3D 12 it would be a setting of the depth pass's pipeline state:
`psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT` for `m_depthPipelineState`.
:::

Another consideration is that objects that are close to the shadow receiver (like the distant cube) may still give
incorrect results. However, with normal bias values you can generally avoid peter panning.

### Over sampling

Another visual discrepancy which you may like or dislike is that regions outside the light's visible frustum are
considered to be in shadow while they're (usually) not. This happens because projected coordinates outside the light's
frustum are higher than 1.0 and will thus sample the depth texture outside its default range of [0,1]. Based on the
texture's wrapping method, we will get incorrect depth results not based on the real depth values from the light
source. With the repeat wrapping we use so far, the depth map's content repeats: far away, outside the light's 20 × 20
box, you'd see copies of the cubes' shadows, and dark regions where no shadow belongs.

What we'd rather have is that all coordinates outside the depth map's range have a depth of 1.0 which as a result means
these coordinates will never be in shadow (as no object will have a depth larger than 1.0). We can do this by
configuring a texture border colour and set the depth map's texture wrap options to clamp to border.

:::opengl
```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
    float borderColor[] = { 1.0, 1.0, 1.0, 1.0 }; // depth 1.0 outside the map: never in shadow
    glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
:::
:::vulkan
In Vulkan the wrap mode and the border colour are settings of the sampler. Vulkan has no free border colour like
OpenGL's `GL_TEXTURE_BORDER_COLOR` array, but a few fixed ones – opaque white is the one we need. In
`createDepthMapSampler()`:

```cpp
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.anisotropyEnable = VK_FALSE;
        samplerInfo.maxAnisotropy = 1.0f;
        samplerInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
```
:::
:::d3d12
In Direct3D 12 the wrap mode and the border colour are settings of the sampler – here the static sampler s1. A static
sampler has three border colours to choose from: transparent black, opaque black and opaque white. In the root
signature, after `samplers[1].ShaderRegister = 1;`:

```cpp
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].BorderColor = D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE;
```
:::

Now whenever we sample outside the depth map's [0,1] coordinate range, the texture function will always return a depth
of 1.0, producing a shadow value of 0.0.

There still seems to be one more case: fragments farther away than the light's far plane. Their projected z is larger
than 1.0, so they are larger than any stored depth – even the border's 1.0 – and in shadow. The solution is relatively
simple: we force the shadow value to 0.0 whenever the projected vector's z coordinate is larger than 1.0. That is,
everything beyond the far plane of the light's orthographic frustum counts as lit.

:::opengl
Now do the task **over-sampling**: the border settings above instead of `GL_REPEAT`, and in `ShadowCalculation`,
before `return`:

```glsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if(projCoords.z > 1.0)
        shadow = 0.0;
```
:::
:::vulkan
Now do the task **over-sampling**: the sampler settings above instead of `VK_SAMPLER_ADDRESS_MODE_REPEAT` and
`VK_BORDER_COLOR_INT_OPAQUE_BLACK`, and in `ShadowCalculation`, before `return`:

```glsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (projCoords.z > 1.0)
        shadow = 0.0;
```
:::
:::d3d12
Now do the task **over-sampling**: the four sampler lines above, and in `ShadowCalculation`, before `return`:

```hlsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (projCoords.z > 1.0f)
        shadow = 0.0f;
```
:::

Press **Build & run** – and look closely, because from the default camera this changes almost nothing. The regions
outside the light's frustum lie far away, near the horizon: only a thin dark line on the far floor at the right edge
of the window disappears. Look down with the mouse and move back with S – the camera rises as it moves away – until you
see the scene from above, and you'll see the difference: before this task, the floor beyond the far plane is dark and copies of the shadows repeat far away;
after it, all of that floor is lit. This all means that only the region of the depth map that the light's frustum
covers gets shadows, while everything outside it has none – which is what we want in this scene.

```quiz
Why does a white border colour (depth 1.0) stop over sampling outside the depth map?
- [ ] White makes the floor brighter outside the map
- [ ] The border colour switches the depth test off
- [x] Lookups outside the map return the depth 1.0, the far plane; no fragment inside the frustum is farther than that, so none counts as in shadow
- [ ] It makes the sampler repeat the map's edge texels
---
With `REPEAT` a lookup outside the map reads some unrelated texel of the map. With the border at 1.0, the stored "closest depth" outside the map is as far as it gets. Fragments beyond the far plane (z > 1.0) would still lose that comparison, which is why `ShadowCalculation` also sets the shadow to 0.0 for them.
```

### PCF

The shadows right now are a nice addition to the scenery, but it's still not exactly what we want. If you look closely
at the shadow's edges, they are hard and jagged: a staircase of depth map texels. Because the depth map has a fixed
resolution, one of its texels frequently spans more than one fragment. As a result, multiple fragments
sample the same depth value from the depth map and come to the same shadow conclusions, which produces these jagged
blocky edges.

You can reduce these blocky shadows by increasing the depth map resolution, or by trying to fit the light frustum as
closely to the scene as possible.

Another (partial) solution to these jagged edges is called PCF, or *percentage-closer filtering*, which is a term that
hosts many different filtering functions that produce softer shadows, making them appear less blocky or hard. The idea
is to sample more than once from the depth map, each time with slightly different texture coordinates. For each
individual sample we check whether it is in shadow or not. All the sub-results are then combined and averaged and we
get a nice soft looking shadow.

One simple implementation of PCF is to simply sample the surrounding texels of the depth map and average the results.
The size of one texel is 1 divided by the depth map's size in texels, which the shader can ask for. We sample the 3 × 3
texels around the projected coordinate, test each for shadow occlusion, and divide the total by 9.

:::opengl
`textureSize` returns an `ivec2` of the width and height of the given sampler texture at mipmap level 0; 1 divided over
this returns the size of a single texel that we use to offset the texture coordinates:

```glsl
    // PCF: the average of the 3 x 3 depth map texels around the position
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

Now do the last task, **pcf**: these lines replace the single comparison (leave it as a comment); the
`projCoords.z > 1.0` test stays after them.
:::
:::vulkan
`textureSize` returns an `ivec2` of the width and height of the given sampler texture at mip level 0; 1 divided over
this returns the size of a single texel that we use to offset the texture coordinates:

```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

Now do the last task, **pcf**: these lines replace the single comparison (leave it as a comment); the
`projCoords.z > 1.0` test stays after them.
:::
:::d3d12
HLSL asks a texture for its size with the method `GetDimensions`, which writes the width and height into two
variables; 1 divided over them is the size of a single texel that we use to offset the texture coordinates:

```hlsl
    // PCF (percentage-closer filtering): the test for the 3 x 3 texels around the
    // fragment's place, averaged - soft shadow edges
    float shadow = 0.0f;
    uint width, height;
    shadowMap.GetDimensions(width, height);
    float2 texelSize = 1.0f / float2(width, height);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = shadowMap.Sample(shadowSampler, shadowUV + float2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0f : 0.0f;
        }
    }
    shadow /= 9.0f;
```

Now do the last task, **pcf**: these lines replace the single comparison, and `closestDepth` is no longer needed; the
`projCoords.z > 1.0f` test stays after them. (Direct3D also has PCF in hardware: a comparison sampler, such as
`D3D12_FILTER_COMPARISON_MIN_MAG_LINEAR_MIP_POINT` with `ComparisonFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL`, and
`SampleCmpLevelZero(…, currentDepth - bias)` in the shader – that's what Microsoft's samples use. The course uses
learnopengl's loop.)
:::

Press **Build & run**: the shadow's **edges become soft**. Inside the shadow and on the lit floor nothing changes, but
the edge pixels now get in-between values: where 3 of the 9 samples are in shadow, the fragment is a third in shadow.
From a distance the shadows look a lot better and less hard. If you zoom in, you can still see the resolution artifacts
of shadow mapping, but in general this gives good results for most applications.

```quiz
With the 3 × 3 PCF, a fragment on the shadow's edge finds 6 of the 9 samples in shadow. What is its `shadow` value?
- [ ] 1.0 – one sample in shadow is enough
- [ ] 0.0 – the centre sample decides
- [ ] 0.5 – PCF only knows lit and half-lit
- [x] 6 / 9 ≈ 0.67: its diffuse and specular light are reduced to a third
---
PCF averages the binary test results of neighbouring texels. Along the edge the share of occluded samples changes gradually from 0 to 1, which turns the hard staircase into a soft transition.
```

There is actually much more to PCF and quite a few techniques to considerably improve the quality of soft shadows, but
for the sake of this chapter's length we'll leave that for a later discussion.

## Orthographic vs projection

There is a difference between rendering the depth map with an orthographic or a perspective projection matrix. An
orthographic projection matrix does not deform the scene with perspective so all view/light rays are parallel. This
makes it a great projection matrix for directional lights. A perspective projection matrix however does deform all
vertices based on perspective which gives different results.

Perspective projections make most sense for light sources that have actual locations, unlike directional lights.
Perspective projections are most often used with spotlights and point lights, while orthographic projections are used
for directional lights.

Another subtle difference with using a perspective projection matrix is that visualizing the depth buffer will often
give an almost completely white result. This happens because with perspective projection the depth is transformed to
non-linear depth values with most of its noticeable range close to the near plane. To be able to properly view the
depth values as we did with the orthographic projection you first want to transform the non-linear depth values to
linear, as we discussed in the *Depth testing* chapter.

:::opengl
That's the `LinearizeDepth` function already in `debug_quad_depth.fs` – with the commented-out line
`FragColor = vec4(vec3(LinearizeDepth(depthValue) / far_plane), 1.0); // perspective` you'd use it:

```glsl
// required when using a perspective projection matrix
float LinearizeDepth(float depth)
{
    float z = depth * 2.0 - 1.0; // Back to NDC
    return (2.0 * near_plane * far_plane) / (far_plane + near_plane - z * (far_plane - near_plane));
}
```
:::
:::vulkan
In Vulkan the depth is 0..1 in NDC already, so the *Depth testing* chapter's version for 0..1 depth applies – without
OpenGL's `depth * 2.0 - 1.0` step: `(near * far) / (far - depth * (far - near))`.
:::
:::d3d12
In Direct3D the depth is 0..1 in NDC already, so the *Depth testing* chapter's version for 0..1 depth applies – without
OpenGL's `depth * 2.0 - 1.0` step: `(near * far) / (far - depth * (far - near))`.
:::

This is similar to what we did in the depth testing chapter. Shadows for point lights, which shine in all directions,
need even more than a perspective projection – one depth map per direction, a cube map. That's the next chapters'
topic: *Point Shadows*, and later cascaded shadow maps for large outdoor scenes.

## Additional resources

:::opengl
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengl's chapter this chapter
  follows, with the pictures of the depth map, shadow acne and peter panning.
- [shadow_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/3.1.3.shadow_mapping/shadow_mapping.cpp):
  learnopengl's final program.
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  a classic article on bias, fitting the light's frustum and PCF (written for Direct3D, valid for every API).
:::
:::vulkan
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengl's chapter this chapter
  follows, with the pictures of the depth map, shadow acne and peter panning.
- [Render pass](https://docs.vulkan.org/spec/latest/chapters/renderpass.html): the chapter of the Vulkan specification
  on render passes, attachments, load/store operations and subpass dependencies.
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  a classic article on bias, fitting the light's frustum and PCF (written for Direct3D, valid for every API).
:::
:::d3d12
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengl's chapter this chapter
  follows, with the pictures of the depth map, shadow acne and peter panning.
- [Walkthrough: Implement shadow volumes using depth buffers in Direct3D 11](https://learn.microsoft.com/en-us/windows/uwp/gaming/implementing-depth-buffers-for-shadow-mapping):
  Microsoft's shadow map walkthrough – the typeless depth texture, the comparison sampler, the passes (Direct3D 11; the
  ideas are the same).
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  a classic article on bias, fitting the light's frustum and PCF.
:::
