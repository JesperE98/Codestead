# Point Shadows

In the last chapter we learned to create dynamic shadows with shadow mapping. It works great, but it's mostly suited
for directional (or spot) lights as the shadows are generated only in the direction of the light source. It is
therefore also known as *directional shadow mapping*, as the depth (or shadow) map is generated from only the direction
the light is looking at.

What this chapter will focus on is the generation of dynamic shadows in all surrounding directions. The technique we're
using is perfect for point lights, as a real point light would cast shadows in all directions. This technique is known
as point (light) shadows or more formerly as *omnidirectional shadow maps*.

The technique is mostly similar to directional shadow mapping: we generate a depth map from the light's perspective(s),
sample the depth map based on the current fragment position, and compare each fragment with the stored depth value to
see whether it is in shadow. The main difference between directional shadow mapping and omnidirectional shadow mapping
is the depth map we use: instead of a 2D depth texture, a **depth cube map** that stores the closest depth in every
direction around the light. Again it is the same technique in every API; this chapter shows where {{api}} puts the cube
map, the pass that fills all six of its faces at once, and the lookup.

:::opengl
The project is learnopengl's scene: a room – learnopengl's 2 × 2 × 2 `renderCube()` cube scaled by 5, so its walls
are at ±5 – with five wooden cubes in it, all drawn by `renderScene(const Shader &shader)`. The room is drawn with face
culling off and the uniform `reverse_normals` set to 1: its normals point outwards, and the vertex shader turns them
around so that the inside is lit (learnopengl's "small little hack"). The five cubes are drawn with culling on. The
light is at `lightPos` (0, 0, 0), the middle of the room. learnopengl moves it back and forth with
`lightPos.z = static_cast<float>(sin(glfwGetTime() * 0.5) * 3.0);` – that line is in the render loop as a comment, so
the picture does not change with time; uncomment it if you like, and the shadows sweep over the walls.
`point_shadows.vs/.fs` light the scene as in the last chapter: a light colour of 0.3, ambient, diffuse and Blinn-Phong
specular, combined as `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – with `float shadow = 0.0;` for now.
`shader_m.h` is the Shader class with the optional geometry shader file from the *Geometry Shader* chapter, and the
three depth shaders `point_shadows_depth.vs/.gs/.fs` are there with their declarations; their `main` functions are your
work.
:::
:::vulkan
The project is learnopengl's scene: a room – the vertex buffer's one cube (learnopengl's 2 × 2 × 2 `renderCube()` cube,
36 vertices, v flipped as in the earlier chapters) scaled by 5, so its walls are at ±5 – with five wooden cubes in it.
learnopengl's `renderScene()` is the helper `renderScene(VkCommandBuffer commandBuffer)`, which pushes each draw's
`PushConstants` (`glm::mat4 model; VkBool32 reverse_normals;`, vertex stage) and records `vkCmdDraw(commandBuffer, 36, 1,
0, 0)` six times. The room gets `reverse_normals = VK_TRUE`: its normals point outwards, and the vertex shader turns them
around so that the inside is lit (learnopengl's "small little hack"). The light is the global `lightPos` (0, 0, 0), the
middle of the room. learnopengl moves it with `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`; here it stays still, so
the picture does not change with time. `shaders/point_shadows.vert/.frag` light the scene as in the last chapter: a
light colour of 0.3, ambient, diffuse and Blinn-Phong specular, combined as
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – with `float shadow = 0.0;` for now. The depth shaders
`point_shadows_depth.vert/.geom/.frag` are empty stubs. `createPipeline` takes an optional geometry shader (`""` =
none), as in the *Geometry Shader* chapter.
:::
:::d3d12
The project is learnopengl's scene: a room – the vertex buffer's one cube (learnopengl's 2 × 2 × 2 `renderCube()` cube,
36 vertices, v flipped for Direct3D) scaled by 5, so its walls are at ±5 – with five wooden cubes in it. learnopengl's
`renderScene()` is the member function `RenderScene()`: it sets each draw's `ModelConstants` (`model`, `normalMatrix`
and `BOOL reverseNormals`, 33 root constants) with `SetGraphicsRoot32BitConstants(0, …)` and calls
`DrawInstanced(36, 1, 0, 0)` six times. `PopulateCommandList` calls it once per pass. The room gets
`reverseNormals = TRUE`: its normals point outwards, and the vertex shader turns them around so that the inside is lit
(learnopengl's "small little hack"). The light is the global `lightPos` (0, 0, 0), the middle of the room; learnopengl
moves it with `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`, here it stays still, so the picture does not change with
time. `point_shadows.hlsl` lights the scene as in the last chapter: a light colour of 0.3, ambient, diffuse and
Blinn-Phong specular, combined as `(ambient + (1.0f - shadow) * (diffuse + specular)) * color` – with
`float shadow = 0.0f;` for now. `point_shadows_depth.hlsl` has its constant buffers and structs; its three entry points
are your work (the file is not compiled until then).
:::

The camera is at (0, 0, 3), looking down -z: the back wall of the room (z = -5) fills the window, the wood stretched
over its 10 × 10 units, with a soft highlight a little left of the centre. Only one of the five cubes is in view – the
rotated one at (-1.5, 2, -3), in the top-left corner. Build and run the program: the room is lit, but nothing casts a
shadow. The `// TODO:` comments in the project mark where your code goes.

## Generating the depth cubemap

To create a cubemap of surrounding depth values we have to render the scene 6 times: once for each face. One (quite
obvious) way to do this, is render the scene 6 times with 6 different view matrices, each time attaching a different
cubemap face to the framebuffer object. That is quite expensive though, as a lot of render calls are necessary for this
single depth map. In this chapter we're going to use an alternative (more organized) approach using a little trick in
the geometry shader that allows us to build the depth cubemap with just a single render pass: the geometry shader sends
every triangle to all six faces.

The depth cube map is six depth textures of 1024 × 1024 – one per face – that can be drawn into as one *layered*
attachment and sampled afterwards as one cube map.

:::opengl
First, we'll need to create a cubemap:

```cpp
    unsigned int depthCubemap;
    glGenTextures(1, &depthCubemap);
```

And assign each of the single cubemap faces a 2D depth-valued texture image:

```cpp
    const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
    glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);
    for (unsigned int i = 0; i < 6; ++i)
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
```

And don't forget to set the texture parameters:

```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
```

Normally we'd attach a single face of a cubemap texture to the framebuffer object and render the scene 6 times, each
time switching the depth buffer target of the framebuffer to a different cubemap face. Since we're going to use a
geometry shader, that allows us to render to all faces in a single pass, we can directly attach the cubemap as a
framebuffer's depth attachment with `glFramebufferTexture`:

```cpp
    // attach depth texture as FBO's depth buffer: all six faces at once (a layered attachment)
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0);
    glDrawBuffer(GL_NONE); // no colour buffer
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Note the missing `2D` and texture target: `glFramebufferTexture2D` attaches one image – one face – while
`glFramebufferTexture` with a cube map attaches all six faces as a *layered* attachment. Again, note the call to
`glDrawBuffer` and `glReadBuffer`: we only care about depth values when generating a depth cubemap so we have to
explicitly tell OpenGL this framebuffer object does not render to a colour buffer.
:::
:::vulkan
In Vulkan a cube map is not a different kind of image: it is a 2D image with **six array layers** – the faces +X, -X,
+Y, -Y, +Z, -Z, in that order (OpenGL's `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`) – created with a flag that allows a cube
*view* of it. `createDepthCubemap()` creates it with `vkCreateImage` directly, because the `createImage` helper knows
only one layer:

```cpp
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT; // its six layers can be viewed as a cube map
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = SHADOW_WIDTH;
        imageInfo.extent.height = SHADOW_HEIGHT;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 6; // one layer per face
        imageInfo.format = depthMapFormat;
        imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
```

`SHADOW_WIDTH` and `SHADOW_HEIGHT` are 1024, the size of each face. `depthMapFormat` comes from `findDepthMapFormat()`
– a depth format that can be drawn into and sampled, as in the last chapter – and the usage again names both things
we'll do with the image. Memory is allocated and bound as for any image. Then one view of all six layers, as a cube:

```cpp
        // all six layers as a cube map (sampled with a direction: samplerCube)
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = depthCubemapImage;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
        viewInfo.format = depthMapFormat;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_DEPTH_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 6;
```

The same view is the framebuffer's attachment – for a framebuffer, it is simply six layers. learnopengl's
`glFramebufferTexture` with the whole cube map, a *layered* attachment, becomes a framebuffer with `layers = 6`:

```cpp
        // the same view is the framebuffer's depth attachment, with all six layers (a "layered" framebuffer)
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &depthCubemapImageView;
        framebufferInfo.width = SHADOW_WIDTH;
        framebufferInfo.height = SHADOW_HEIGHT;
        framebufferInfo.layers = 6;
```

`depthMapRenderPass` is the last chapter's depth-only render pass, unchanged (`createDepthMapRenderPass()`): one depth
attachment with `loadOp` CLEAR and `storeOp` STORE, `finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`,
`colorAttachmentCount = 0` and the two subpass dependencies. The clear and the layout transitions apply to all six
layers. `createDepthCubemapSampler()` creates `depthCubemapSampler` with `VK_FILTER_NEAREST` and
`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` on U, V and W (learnopengl: `GL_NEAREST`, `GL_CLAMP_TO_EDGE`), and the
descriptor set gets the cube map at binding 2, in the layout the pass leaves it in:

```cpp
        VkDescriptorImageInfo depthMapInfo{};
        depthMapInfo.imageLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // the depth map pass's finalLayout
        depthMapInfo.imageView = depthMapView;
        depthMapInfo.sampler = depthMapSampler;
```

(`createDescriptorSet` takes the cube map's view and sampler as parameters; the pool now holds two combined image
samplers.)
:::
:::d3d12
In Direct3D 12 a cube map is not a different kind of resource either: it is a 2D texture with **six array slices** –
the faces +X, -X, +Y, -Y, +Z, -Z, in that order – and it is a *view* that says "read these six slices as a cube".
The depth cube map is the last chapter's shadow map with `DepthOrArraySize = 6`: typeless, so that it can have a depth
stencil view and a shader resource view:

```cpp
        // R32_TYPELESS: the same 32 bits per texel are a D32_FLOAT depth to the depth stencil
        // view and an R32_FLOAT colour to the shader resource view. DepthOrArraySize = 6.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC cubemapDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);
```

`SHADOW_WIDTH` and `SHADOW_HEIGHT` are 1024, the size of each face. It is created in the `DEPTH_WRITE` state with a
clear value of 1.0 (`D32_FLOAT`), as the shadow map was. Its depth stencil view covers all six slices – a
`Texture2DArray` view. That is learnopengl's `glFramebufferTexture` with the whole cube map, a *layered* attachment:

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        dsvDesc.Texture2DArray.MipSlice = 0;
        dsvDesc.Texture2DArray.FirstArraySlice = 0;
        dsvDesc.Texture2DArray.ArraySize = 6;
        CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
        m_device->CreateDepthStencilView(m_depthCubemap.Get(), &dsvDesc, dsvHandle);
```

and its shader resource view reads the same six slices as a cube:

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_depthCubemap.Get(), &srvDesc, srvHandle);
```

The rest is the last chapter's plumbing: the DSV goes into slot 1 of the DSV heap (`NumDescriptors = 2`,
`m_dsvDescriptorSize`), the SRV into slot 2 of the CBV/SRV heap (`NumDescriptors = 3`), right after the wood's, so the
textures' descriptor table grows to two registers – `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`, t0 the
wood, t1 the cube map. Its static sampler s1 is a copy of s0 with point filtering and clamping (learnopengl:
`GL_NEAREST`, `GL_CLAMP_TO_EDGE`):

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```
:::

:::opengl
```quiz
Why is the depth cube map attached with `glFramebufferTexture` instead of `glFramebufferTexture2D`?
- [x] `glFramebufferTexture` attaches the whole cube map – all six faces – as a layered attachment, so one pass can draw into every face; `glFramebufferTexture2D` attaches a single face
- [ ] `glFramebufferTexture2D` cannot attach depth textures
- [ ] `glFramebufferTexture` creates the six faces' storage
- [ ] Because a framebuffer with a cube map needs no `glDrawBuffer(GL_NONE)`
---
With a layered attachment the geometry shader chooses the face (layer) of every triangle. With single faces you would attach and render six times.
```
:::
:::vulkan
```quiz
What makes one image usable both as the six-layer depth attachment of the pass and as a `samplerCube` afterwards?
- [ ] Six separate images, one per face, and six framebuffers
- [ ] `VK_IMAGE_VIEW_TYPE_2D_ARRAY` for both uses and `layers = 1`
- [ ] Only `VK_IMAGE_USAGE_SAMPLED_BIT`
- [x] `arrayLayers = 6` with `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, a `VK_IMAGE_VIEW_TYPE_CUBE` view of the six layers, a framebuffer with `layers = 6`, and the usage depth attachment + sampled
---
A cube map is a 2D image with six layers that may be viewed as a cube. The framebuffer sees the view's six layers, the geometry shader picks one per triangle, and the shader samples the same view with a direction.
```
:::
:::d3d12
```quiz
Which views does the six-slice `R32_TYPELESS` resource get, and why?
- [ ] Six 2D depth stencil views, one per face, and six shader resource views
- [x] One `D32_FLOAT` depth stencil view of type `TEXTURE2DARRAY` over all six slices, to draw into every face in one pass, and one `R32_FLOAT` shader resource view of type `TEXTURECUBE`, to sample it with a direction
- [ ] One `TEXTURECUBE` depth stencil view and one `TEXTURE2DARRAY` shader resource view
- [ ] Only a render target view: the pixel shader writes the distances as colours
---
The resource is just six slices. The DSV makes them a layered depth buffer (the geometry shader picks the slice); the SRV makes the same slices a cube map. The typeless format lets each view interpret the bits as it needs.
```
:::

### Light space transform

With the framebuffer and cubemap set, we need some way to transform all the scene's geometry to the relevant light
spaces in all 6 directions of the light. Just like the shadow mapping chapter we're going to need a light space
transformation matrix *T*, but this time one for each face.

Each light space transformation matrix contains both a projection and a view matrix. For the projection matrix we're
going to use a perspective projection matrix: the light source represents a point in space, so perspective projection
makes most sense. Each light space transformation matrix uses the same projection matrix. Important to note here is the
field of view parameter of the projection, which we set to 90 degrees. By setting this to 90 degrees we make sure the
viewing field is exactly large enough to fill a single face of the cubemap such that all faces align correctly to each
other at the edges. The aspect ratio is 1 (the faces are square), the near plane 1.0 and the far plane 25.0.

```quiz
Why does the light's projection use a field of view of exactly 90° and an aspect ratio of 1?
- [ ] A smaller field of view gives the cube map more resolution, but 90° is the largest a projection allows
- [ ] Because the room is a cube
- [x] Seen from the cube's centre, each face spans exactly 90° in both directions: the six frusta fill all directions around the light without gaps or overlaps
- [ ] So that the depth values become linear
---
With less than 90° there would be directions no face covers, with more the faces would overlap and their edges would not meet. The aspect ratio is 1 because each face is square.
```

As the projection matrix does not change per direction we can re-use it for each of the 6 transformation matrices. We
do need a different view matrix per direction. With a lookAt function we create 6 view directions, each looking at one
face direction of the cubemap in the order: right, left, top, bottom, near and far – +X, -X, +Y, -Y, +Z, -Z, the order
of the cube map's faces.

The *up* vectors look odd at first: (0, -1, 0) for four of the faces, (0, 0, 1) and (0, 0, -1) for the top and bottom.
They come from how a cube map lookup works. A lookup with a direction picks the face by the direction's largest
component, and the position on that face by the two others – with a fixed table, the same in OpenGL, Vulkan and
Direct3D. On the four side faces, the face's t (or v) coordinate grows *downwards*: the face's first row is its top,
the world's +y. Rendering a face with "up" = -y puts the world's +y into the face's first row – right where the lookup
expects it. So these lookAt calls draw each face exactly as the lookup will read it. (The +X face's right vector, for
example, is cross(+x, -y) = -z, and the table also has the +X face's s coordinate run along -z.)

```quiz
Why do four of the six light views use (0, -1, 0) as their up vector?
- [x] On a cube map's side faces the t coordinate grows downwards (the first row is the world's +y side); rendering with up = -y stores each face the way a cube map lookup reads it
- [ ] Because the light hangs from the ceiling
- [ ] To flip the winding of the triangles for face culling
- [ ] It doesn't matter: any up vector perpendicular to the view direction gives the same face
---
The face a lookup picks and the place on that face are fixed by a table that every API shares. learnopengl's targets and ups produce exactly that layout, so they are the same in all three APIs.
```

:::opengl
```cpp
        float near_plane = 1.0f;
        float far_plane  = 25.0f;
        glm::mat4 shadowProj = glm::perspective(glm::radians(90.0f), (float)SHADOW_WIDTH / (float)SHADOW_HEIGHT, near_plane, far_plane);
        std::vector<glm::mat4> shadowTransforms;
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
```

Here we create 6 view matrices and multiply them with the projection matrix to get a total of 6 different light space
transformation matrices. The `target` parameter of `glm::lookAt` each looks into the direction of a single cubemap
face. These transformation matrices are sent to the shaders that render the depth into the cubemap. They are computed
every frame at the start of the render loop (`// 0.`), so a moving light would work too.
:::
:::vulkan
The six matrices go into the uniform buffer, which grows by `far_plane` (in place of `pad2`) and an array of six
matrices:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float far_plane; // the depth pass stores distance / far_plane
    glm::mat4 shadowMatrices[6]; // world space -> the clip space of each face of the cube map, seen from the light
};
```

std140 lets a float fill the last 4 bytes of a vec3's 16-byte slot, so `far_plane` sits at offset 156, right after
`lightPos`, and the matrix array starts at 160, a multiple of 16 as std140 requires. `updateUniformBuffer()` computes
them:

```cpp
        float near_plane = 1.0f;
        float far_plane = 25.0f;
        glm::mat4 shadowProj = glm::perspective(glm::radians(90.0f), (float) SHADOW_WIDTH / (float) SHADOW_HEIGHT, near_plane, far_plane);
        ubo.shadowMatrices[0] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[1] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[2] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f));
        ubo.shadowMatrices[3] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f));
        ubo.shadowMatrices[4] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[5] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.far_plane = far_plane;
```

**No** `shadowProj[1][1] *= -1` here. The camera's projection has that flip so the picture stands upright in the window;
the faces must instead be stored the way the cube map lookup reads them. In OpenGL, NDC y = -1 lands on a face's first
row (row 0 is the bottom of OpenGL's framebuffers). In Vulkan, NDC y = -1 lands on row 0 as well – the top of its
framebuffers, but the same row in memory. So learnopengl's matrices store the very same texels in Vulkan, and the same
lookup reads them. A flip would store every face upside down.
:::
:::d3d12
The six matrices go into the constant buffer, after `projection`, and `far_plane` takes the place of the padding after
`viewPos` (a float may fill the rest of a float3's 16-byte row):

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4X4 shadowMatrices[6];    // the light's view and projection, one per cube face
        XMFLOAT3 viewPos;
        float far_plane;                 // the depth cubemap holds distance / far_plane
        XMFLOAT3 lightPos;
        float padding1;
    };
```

with the same members in the same order in the shaders' `cbuffer SceneConstantBuffer`. `OnUpdate` computes them:

```cpp
    float near_plane = 1.0f;
    float far_plane = 25.0f;
    XMMATRIX shadowProj = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), static_cast<float>(SHADOW_WIDTH) / static_cast<float>(SHADOW_HEIGHT), near_plane, far_plane)
        * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR light = XMLoadFloat3(&lightPos);
    XMMATRIX shadowTransforms[6] =
    {
        XMMatrixLookAtRH(light, light + XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +X
        XMMatrixLookAtRH(light, light + XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // -X
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)) * shadowProj,    // +Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)) * shadowProj,    // -Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +Z
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj     // -Z
    };
    for (int i = 0; i < 6; ++i)
        XMStoreFloat4x4(&constantBufferData.shadowMatrices[i], XMMatrixTranspose(shadowTransforms[i]));
    constantBufferData.far_plane = far_plane;
```

With DirectXMath's row vectors the view comes first: `lookAt * shadowProj`. The targets and ups are learnopengl's, but
the projection is followed by `XMMatrixScaling(1.0f, -1.0f, 1.0f)`, which turns clip y into -y. Here's why: the cube
map's faces are laid out the same in every API (row 0 is the face's top), but which NDC y lands on row 0 when you draw
into a face differs. OpenGL puts NDC y = -1 there; Direct3D puts NDC y = +1 there – the top of a render target, like the
top of the window. With learnopengl's matrices unchanged, every face would be stored upside down, and the shadows would
land in the wrong places. The flip fixes that. (The alternative is Direct3D's own convention: `XMMatrixLookAtLH` with up
+y for the side faces and (0, 0, -1) / (0, 0, 1) for ±Y.) A flip also reverses the winding of the triangles – that
would matter for face culling, but the pipeline states cull nothing (see below).
:::

### Depth shaders

To render depth values to a depth cubemap we're going to need a total of three shaders: a vertex and fragment shader,
and a geometry shader in between.

The geometry shader will be the shader responsible for transforming all world-space vertices to the 6 different light
spaces. Therefore, the vertex shader simply transforms vertices to world-space and directs them to the geometry shader.

The geometry shader will take as input 3 triangle vertices and an array of light space transformation matrices. The
geometry shader is responsible for transforming the vertices to the light spaces; this is also where it gets
interesting. The geometry shader has a built-in output that specifies which cubemap face (layer) to emit a primitive
to. Since we're in the geometry shader, we can loop six times over the faces: for each face, we set that output, then
transform each of the triangle's three vertices with the face's matrix and emit it. So each triangle is emitted six
times – at most 6 × 3 = 18 vertices.

The fragment shader then calculates its own depth: the linear distance between each fragment position and the light
source's position, divided by `far_plane` to map it to [0,1], and writes that as the fragment's depth. The geometry
shader passes the world-space position on so the fragment shader can do this. Why its own depth? Because the lookup
will compare distances: in the second pass we'll know the fragment's distance to the light, not its depth in some face's
projection – and a distance is the same in every direction, whichever face it is stored on.

```quiz
What does the depth pass's geometry shader do with each triangle it receives?
- [ ] It picks the one face the triangle faces and emits it once
- [x] It emits the triangle six times, each time with one face's light matrix and that face's index as the layer to draw into
- [ ] It splits it into six smaller triangles, one per face
- [ ] It emits it once; the rasterizer copies it to all six layers
---
A triangle may be visible from several faces (it may cross a face's edge), so learnopengl simply sends every triangle to every face; the clipping of each face's frustum throws away what that face can't see.
```

:::opengl
The vertex shader, `point_shadows_depth.vs`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;

void main()
{
    gl_Position = model * vec4(aPos, 1.0); // world space: the geometry shader projects it once per cube map face
}
```

The geometry shader, `point_shadows_depth.gs`:

```glsl
#version 330 core
layout (triangles) in;
layout (triangle_strip, max_vertices=18) out;

uniform mat4 shadowMatrices[6];

out vec4 FragPos; // FragPos from GS (output per emitvertex)

void main()
{
    for(int face = 0; face < 6; ++face)
    {
        gl_Layer = face; // built-in variable that specifies to which face we render.
        for(int i = 0; i < 3; ++i) // for each triangle's vertices
        {
            FragPos = gl_in[i].gl_Position;
            gl_Position = shadowMatrices[face] * FragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
```

The geometry shader takes as input a triangle, and outputs a total of 6 triangles (6 * 3 equals 18 vertices). The
built-in variable `gl_Layer` specifies which cubemap face to emit a primitive to; it only does something when we have
a cubemap texture attached to the active framebuffer. In the main function we iterate over all 6 faces: for each, we
set `gl_Layer` to the face index and then transform each world-space input vertex to the relevant light space by
multiplying `FragPos` with the face's light space transformation matrix. Note that we also sent the resulting `FragPos`
variable to the fragment shader that we'll need to calculate a depth value.

The fragment shader, `point_shadows_depth.fs`:

```glsl
#version 330 core
in vec4 FragPos;

uniform vec3 lightPos;
uniform float far_plane;

void main()
{
    float lightDistance = length(FragPos.xyz - lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / far_plane;

    // write this as modified depth
    gl_FragDepth = lightDistance;
}
```

The fragment shader takes as input the `FragPos` from the geometry shader, the light's position vector, and the
frustum's far plane value. Here we take the distance between the fragment and the light source, map it to the [0,1]
range and write it as the fragment's depth value. Writing `gl_FragDepth` replaces the depth the rasterizer computed –
and the depth test then compares *these* values, so the closest distance wins in every texel.

Rendering the scene with these shaders and the cubemap-attached framebuffer object active should give you a completely
filled depth cubemap for the second pass's shadow calculations:

```cpp
        // 1. render scene to depth cubemap
        // --------------------------------
        glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
            glClear(GL_DEPTH_BUFFER_BIT);
            simpleDepthShader.use();
            for (unsigned int i = 0; i < 6; ++i)
                simpleDepthShader.setMat4("shadowMatrices[" + std::to_string(i) + "]", shadowTransforms[i]);
            simpleDepthShader.setFloat("far_plane", far_plane);
            simpleDepthShader.setVec3("lightPos", lightPos);
            renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`simpleDepthShader` is `Shader simpleDepthShader("point_shadows_depth.vs", "point_shadows_depth.fs",
"point_shadows_depth.gs");` – the third file is the geometry shader. The `glClear` clears all six faces, and the
viewport is the size of one face: every face gets the same viewport.
:::
:::vulkan
The vertex shader, `point_shadows_depth.vert`, needs only the model matrix from the push constants:

```glsl
#version 450

// the model matrix: the first member of the push constants
layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = pc.model * vec4(inPosition, 1.0); // world space: the geometry shader projects it onto each face
}
```

The geometry shader, `point_shadows_depth.geom`, declares the uniform buffer up to the last member it reads, so the
offsets match the C++ struct:

```glsl
layout(triangles) in;
layout(triangle_strip, max_vertices = 18) out;

// the uniform buffer up to the members the geometry shader reads, so that their offsets match the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
    float far_plane;
    mat4 shadowMatrices[6];
} ubo;

layout(location = 0) out vec4 fragPos; // FragPos from GS (output per emitvertex)

void main() {
    for (int face = 0; face < 6; ++face) {
        gl_Layer = face; // built-in variable that specifies to which face we render.
        for (int i = 0; i < 3; ++i) { // for each triangle's vertices
            fragPos = gl_in[i].gl_Position;
            gl_Position = ubo.shadowMatrices[face] * fragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
```

The geometry shader takes as input a triangle, and outputs a total of 6 triangles (6 × 3 = 18 vertices). The built-in
`gl_Layer` specifies which layer of the framebuffer – which face – a primitive goes to; it works because the
framebuffer has six layers. Each world-space input vertex is transformed to the face's light space, and `fragPos`, the
world position, is passed on to the fragment shader, `point_shadows_depth.frag`:

```glsl
layout(location = 0) in vec4 fragPos;

void main() {
    float lightDistance = length(fragPos.xyz - ubo.lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / ubo.far_plane;

    // write this as modified depth
    gl_FragDepth = lightDistance;
}
```

(with the uniform block up to `far_plane`). Writing `gl_FragDepth` replaces the rasterizer's depth, and the depth test
compares these values, so the closest distance wins. Because the stored value is our own, Vulkan's 0..1 depth range of
the projection (`GLM_FORCE_DEPTH_ZERO_TO_ONE`) doesn't change it; the near and far planes still clip.

Three more things the geometry shader needs:

- It is an optional device feature. `isDeviceSuitable` checks `supportedFeatures.geometryShader`, and the device turns
  it on with `deviceFeatures.geometryShader = VK_TRUE;`.
- The uniform buffer is now read in the geometry stage too: its layout binding's `stageFlags` become
  `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`.
- The depth pipeline has three shaders, reads only the position (one attribute), belongs to `depthMapRenderPass` and has
  no colour attachment:

```cpp
        // the depth pass: only the position; the geometry shader draws each triangle into the six faces
        createPipeline("shaders/point_shadows_depth.vert.spv", "shaders/point_shadows_depth.frag.spv", "shaders/point_shadows_depth.geom.spv", 1, depthMapRenderPass, 0, depthPipeline);
```

The depth pass is recorded at the start of `recordCommandBuffer()`, after binding the vertex buffer and the descriptor
set, before the window's pass – as in the last chapter, with one clear value for all six layers:

```cpp
        // one clear value: the depth 1.0 (the far plane), in all six layers
        VkClearValue depthMapClearValue{};
        depthMapClearValue.depthStencil = {1.0f, 0};

        depthMapPassInfo.clearValueCount = 1;
        depthMapPassInfo.pClearValues = &depthMapClearValue;

        vkCmdBeginRenderPass(commandBuffer, &depthMapPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, depthPipeline);
```

then the viewport and scissor of a face, 1024 × 1024 (every layer gets the same), the scene, and the end:

```cpp
        renderScene(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the cube map is now in VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL
```

**Culling:** learnopengl culls back faces, but turns culling off for the room, which is seen from the inside. In Vulkan
the cull mode is part of the pipeline, so that would need a second pipeline (per pass) just for the room. Every pipeline
here has `cullMode = VK_CULL_MODE_NONE` instead: the five cubes are closed, so their back faces are hidden anyway and
the picture is the same.
:::
:::d3d12
All three shaders are in `point_shadows_depth.hlsl`. The vertex shader applies only the model matrix:

```hlsl
// The vertex shader: only the model matrix - the geometry shader applies the light's matrices.
GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}
```

`GSInput` holds just that world position, in `SV_POSITION` like learnopengl's `gl_Position` – only the geometry
shader's output goes to the rasterizer. The geometry shader:

```hlsl
// The geometry shader: every triangle goes to all six faces, each time with that face's
// matrix: at most 6 x 3 = 18 vertices.
[maxvertexcount(18)]
void GSMain(triangle GSInput input[3], inout TriangleStream<PSInput> triStream)
{
    for (int face = 0; face < 6; ++face)
    {
        PSInput output;
        output.layer = face;    // built-in value that specifies to which face we render.
        for (int i = 0; i < 3; ++i)    // for each triangle's vertices
        {
            output.fragPos = input[i].position;
            output.position = mul(output.fragPos, shadowMatrices[face]);
            triStream.Append(output);
        }
        triStream.RestartStrip();
    }
}
```

It takes a triangle and appends 6 triangles to the output stream (6 × 3 = 18 vertices, declared with `maxvertexcount`).
GLSL's `gl_Layer` is a member of the output struct with the system value semantic `SV_RenderTargetArrayIndex`:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float4 fragPos : POSITION;    // FragPos from GS (output per emitvertex)
    uint layer : SV_RenderTargetArrayIndex;    // the cube face (slice) this triangle goes to
};
```

It selects the array slice of the bound views – here the slice of the depth stencil view – a primitive goes to. `fragPos`
carries the world position on to the pixel shader:

```hlsl
// The pixel shader: the depth it writes (SV_Depth) is the distance to the light, divided by
// far_plane to fit into 0..1 - a linear distance instead of the projection's depth.
float PSMain(PSInput input) : SV_Depth
{
    float lightDistance = length(input.fragPos.xyz - lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / far_plane;

    // write this as modified depth
    return lightDistance;
}
```

A pixel shader returning `SV_Depth` replaces the rasterizer's depth (GLSL's `gl_FragDepth`), and the depth test compares
these values, so the closest distance wins. One cost: since the depth is known only after the pixel shader, the GPU
cannot test it early, before the shader runs. The depth pass's pipeline state gets all three shaders and no render
target:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &depthVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &depthGeometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &depthPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(depthVertexShader.Get());
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(depthGeometryShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(depthPixelShader.Get());
        psoDesc.NumRenderTargets = 0;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_depthPipelineState)));
```

Pass 1 is the first thing `PopulateCommandList` records, after the root signature, the descriptor tables and the vertex
buffer:

```cpp
    m_commandList->SetPipelineState(m_depthPipelineState.Get());
    m_commandList->RSSetViewports(1, &m_shadowViewport);
    m_commandList->RSSetScissorRects(1, &m_shadowScissorRect);
    CD3DX12_CPU_DESCRIPTOR_HANDLE cubemapDsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
    m_commandList->OMSetRenderTargets(0, nullptr, FALSE, &cubemapDsvHandle);
    m_commandList->ClearDepthStencilView(cubemapDsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
    RenderScene();

    // The depth cubemap is done: from now on the pixel shaders read it.
    CD3DX12_RESOURCE_BARRIER cubemapBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_depthCubemap.Get(), D3D12_RESOURCE_STATE_DEPTH_WRITE, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &cubemapBarrier);
    m_commandList->SetPipelineState(m_pipelineState.Get());
```

`m_shadowViewport` and `m_shadowScissorRect` are one face's size, 1024 × 1024 – every slice gets the same. The clear
through the array DSV clears all six slices. At the end of the frame, after the back buffer's barrier to `PRESENT`, a
second barrier turns the cube map back to `DEPTH_WRITE` for the next frame's pass – the last chapter's pair of
barriers.

**Culling:** learnopengl culls back faces, but turns culling off for the room, which is seen from the inside. In
Direct3D the cull mode is part of the pipeline state, so that would need extra pipeline states (room and cubes, in each
pass). Every pipeline state here has `CullMode = D3D12_CULL_MODE_NONE` instead: the five cubes are closed, so their back
faces are hidden anyway and the picture is the same.
:::

## Visualizing the cubemap depth buffer

learnopengl shows the depth cube map at the end, as a debugging aid; we'll use it right away to check the first pass.
The scene's own shader can display it: instead of the lighting, each fragment shows the closest depth stored in the
direction from the light to the fragment, as a grey. A cube map is sampled with a direction vector: the vector from the
light's position to the fragment's position.

:::opengl
In `point_shadows.fs`, with `uniform samplerCube depthMap;` and `uniform float far_plane;` declared, the end of `main`
becomes:

```glsl
    // FragColor = vec4(lighting, 1.0);
    // display the depth cube map as debug: the closest depth stored in this fragment's direction (0..1 = 0..far_plane)
    vec3 fragToLight = fs_in.FragPos - lightPos;
    float closestDepth = texture(depthMap, fragToLight).r;
    FragColor = vec4(vec3(closestDepth), 1.0);
```

In `main.cpp`, the shader gets the cube map on texture unit 1 (`shader.setInt("depthMap", 1);` once), `far_plane` every
frame, and the cube map is bound for the second pass:

```cpp
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);
        renderScene(shader);
```

Note the target: `GL_TEXTURE_CUBE_MAP`. Now do the first task, **depth-cubemap**: the depth shader object, the depth
map FBO with its cube map, the matrices and pass 1 in the render loop, `far_plane` and the cube map for pass 2, the three
depth shaders and this debug output. Delete `depthCubemap` and `depthMapFBO` at the end.
:::
:::vulkan
In `point_shadows.frag`, the uniform block gets `float far_plane;` after `lightPos`, the cube map is
`layout(binding = 2) uniform samplerCube depthMap;`, and the end of `main` becomes:

```glsl
    // outColor = vec4(lighting, 1.0);
    // display the depth cube map as debug: the closest depth stored in this fragment's direction (0..1 = 0..far_plane)
    vec3 fragToLight = fs_in.fragPos - ubo.lightPos;
    float closestDepth = texture(depthMap, fragToLight).r;
    outColor = vec4(vec3(closestDepth), 1.0);
```

The descriptor set bound for the depth pass stays bound for the window's pass, the cube map at binding 2 included. Now
do the first task, **depth-cubemap**: `SHADOW_WIDTH` / `SHADOW_HEIGHT`, the uniform buffer's new members and matrices,
`createDepthMapRenderPass()`, `createDepthCubemap()`, `createDepthCubemapSampler()`, the geometry shader feature and
stage, binding 2, the depth pipeline, the depth pass in `recordCommandBuffer()`, the three depth shaders and this debug
output – and destroy the new objects in `cleanup()` (framebuffer, view, image, memory, sampler, pipeline, render pass).
:::
:::d3d12
In `point_shadows.hlsl`, the cube map is `TextureCube depthMap : register(t1);` with
`SamplerState shadowSampler : register(s1);`, the cbuffer gets `shadowMatrices` and `far_plane`, and the end of
`PSMain` becomes:

```hlsl
    // display closestDepth as debug (to visualize depth cubemap) instead of the lighting: the
    // depth cubemap, read in the direction from the light to the fragment, as a grey (0 at
    // the light, 1 at far_plane)
    float3 fragToLight = input.fragPos - lightPos;
    float closestDepth = depthMap.Sample(shadowSampler, fragToLight).r;
    return float4(closestDepth, closestDepth, closestDepth, 1.0f);
```

A `TextureCube`'s `Sample` takes a `float3` direction. The textures' descriptor table already reaches the cube map's SRV
(t1). Now do the first task, **depth-cubemap**: `SHADOW_WIDTH` / `SHADOW_HEIGHT`, the constant buffer's new members,
the shadow viewport and scissor rectangle, the larger heaps and `m_dsvDescriptorSize`, the SRV range of 2 and sampler
s1, the depth pipeline state, the depth cube map with its two views, the matrices in `OnUpdate`, pass 1 with its
barriers, the three depth shaders and this debug output.
:::

Build and run: the window shows the **depth cube map seen from the camera** – grey everywhere, and quite dark. The back
wall is 5 to 8.7 units away from the light, 0.2 to 0.35 of `far_plane`: its centre is 51 out of 255, and it gets lighter
towards the edges and the corners, which are farther from the light. The cube in the top-left corner is darker – closer
to the light. And the shadow shows already: where the cube hides the wall from the light, the cube map holds the cube's
distance, not the wall's – a dark band around the cube's upper-left edge, as dark as the cube itself. No wood, no
lighting: this is the depth cube map, nothing else.

## Omnidirectional shadow maps

With everything set up it is time to render the actual omnidirectional shadows. The procedure is similar to the
directional shadow mapping chapter, although this time we bind a cubemap texture instead of a 2D texture and also pass
the light projection's far plane variable to the shaders.

The vertex shader and fragment shader are mostly similar to the original shadow mapping shaders: the difference being
that the fragment shader no longer requires a fragment position in light space as we can now sample the depth values
with a direction vector. Because of this, the vertex shader doesn't need to transform its position vectors to light
space – it stays as it is.

The first thing we have to do is retrieve the depth of the cubemap. As you may remember from the beginning of this
chapter, we stored the depth as the linear distance between the fragment and the light position. We're taking a
similar approach here: the vector between the fragment position and the light position is the direction vector to
sample the cubemap with. (Its name, `fragToLight`, is learnopengl's; it actually points from the light to the
fragment, which is the direction we need.) Note that the direction vector doesn't need to be a unit vector to sample
from a cubemap, so there's no need to normalize it. The resulting `closestDepth` value is currently in the range [0,1],
so we first transform it back to [0, far_plane] by multiplying it with `far_plane`.

Next we retrieve the depth value between the current fragment and the light source, which we can easily obtain by
taking the length of `fragToLight` due to how we calculated depth values in the cubemap. Now we can compare both depth
values to see which is closer than the other and determine whether the current fragment is in shadow. We also include
a shadow bias so we don't get shadow acne. Note that the bias is now in world units – the depths are distances from
`near_plane` to `far_plane` – so we use a much larger bias of 0.05.

```quiz
Why does the depth pass store `distance / far_plane` instead of the depth the light's projection would give?
- [ ] Because the projection's depth cannot be written to a cube map
- [ ] Because it makes the depth cube map smaller
- [ ] Because a perspective projection has no far plane
- [x] The lookup only has the fragment's distance to the light (`length(fragToLight)`); a stored distance can be compared with it directly, whichever face it came from, while each face's projected depth depends on that face's view direction and is non-linear
---
A distance from the light is the same quantity in all six faces. The second pass multiplies the stored value by `far_plane` and compares it with its own distance – no projection needed.
```

:::opengl
```glsl
float ShadowCalculation(vec3 fragPos)
{
    // get vector between fragment position and light position
    vec3 fragToLight = fragPos - lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = texture(depthMap, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth -  bias > closestDepth ? 1.0 : 0.0;
    // display closestDepth as debug (to visualize depth cubemap)
    // FragColor = vec4(vec3(closestDepth / far_plane), 1.0);

    return shadow;
}
```

Now do the task **shadows**: add `ShadowCalculation` to `point_shadows.fs`, call it in `main` –
`float shadow = ShadowCalculation(fs_in.FragPos);` – and put `FragColor = vec4(lighting, 1.0);` back instead of the debug
output. learnopengl's debug line stays in `ShadowCalculation` as a comment.
:::
:::vulkan
```glsl
float ShadowCalculation(vec3 fragPos) {
    // get vector between fragment position and light position
    vec3 fragToLight = fragPos - ubo.lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = texture(depthMap, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= ubo.far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;
    // display closestDepth as debug (to visualize depth cubemap)
    // outColor = vec4(vec3(closestDepth / ubo.far_plane), 1.0);

    return shadow;
}
```

No projection and no texture coordinates: the direction picks the face and the texel, and because the faces were stored
without a y flip, the lookup finds what the depth pass drew. Now do the task **shadows**: add `ShadowCalculation` to
`point_shadows.frag`, call it in `main()` – `float shadow = ShadowCalculation(fs_in.fragPos);` – and put
`outColor = vec4(lighting, 1.0);` back instead of the debug output.
:::
:::d3d12
```hlsl
// 1.0 if the fragment is in shadow, 0.0 if the light reaches it.
float ShadowCalculation(float3 fragPos)
{
    // get vector between fragment position and light position
    float3 fragToLight = fragPos - lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = depthMap.Sample(shadowSampler, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05f; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;

    return shadow;
}
```

No projection and no texture coordinates: the direction picks the face and the texel, and because the faces were stored
with the y flip, the lookup finds what the depth pass drew. Now do the task **shadows**: add `ShadowCalculation` to
`point_shadows.hlsl`, call it in `PSMain` – `float shadow = ShadowCalculation(input.fragPos);` – and
`return float4(lighting, 1.0f);` again instead of the debug output.
:::

Build and run: the lit room is back, and the rotated cube casts a **shadow** on the back wall – where the depth cube map
showed the dark band, the wall now gets only the ambient light. Light and camera are almost on one line, so the cube
hides most of its own shadow: you see a dark band around its upper-left edge, a thin line along its lower-left edge and
a small piece to the right of its top corner. The other four cubes and their shadows on the side walls, floor and
ceiling are outside the view – turn the camera if your program runs outside the course. The shadow's edges are hard and
jagged (one cube map texel per sample), but there's no shadow acne: the bias in world units covers the depth texels.

## PCF

Since omnidirectional shadow maps are based on the same principles of traditional shadow mapping, they also have the
same resolution dependent artifacts – the jagged edges. Percentage-closer filtering or PCF allows us to smooth out these
jagged edges by filtering multiple samples around the fragment position and average the results.

If we take the same simple PCF filter of the previous chapter and add a third dimension, we get learnopengl's first
attempt: three nested loops that sample 4 × 4 × 4 offsets around `fragToLight`, each between -0.1 and 0.1, and
average the 64 comparisons. That works, but 64 samples per fragment is a lot. And many of them are redundant: they
sample close to the original direction vector, or along it, which doesn't change the direction at all.

Rather, learnopengl uses an array of offset directions that are all roughly separable – each of them points in a
completely different direction: the 8 corners and the 12 edge middles of a cube, 20 in total. Added to `fragToLight`
and scaled by a small radius, they spread the samples over the surroundings of the sample direction.

Another interesting trick we can apply here is that we can change `diskRadius` based on the distance of the viewer to
the fragment, making the shadows softer when far away and sharper when close by:
`diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0`. The bias grows to 0.15, as in learnopengl: the offsets read
the depth of slightly different directions, where a sloped surface lies a little closer to the light.

```quiz
In learnopengl's cube map PCF, what does `diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0` do?
- [ ] It keeps the 20 sample directions inside one face of the cube map
- [ ] It converts the bias from world units to 0..1
- [x] It scales the 20 offset directions: the farther the fragment is from the viewer, the farther apart the samples – softer shadows in the distance, sharper ones close by
- [ ] It sets how many of the 20 samples are taken
---
The offsets are added to `fragToLight` after multiplying them by `diskRadius`. A larger radius averages over a wider area, so the shadow edge becomes a wider, softer transition.
```

:::opengl
The offsets, as a global array in `point_shadows.fs`:

```glsl
// array of offset direction for sampling
vec3 gridSamplingDisk[20] = vec3[]
(
   vec3(1, 1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1, 1,  1),
   vec3(1, 1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1, 1, -1),
   vec3(1, 1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1, 1,  0),
   vec3(1, 0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1, 0, -1),
   vec3(0, 1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0, 1, -1)
);
```

and in `ShadowCalculation`, after `fragToLight`:

```glsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: 20 samples around the direction, in a disk that grows with the distance to the viewer
    float shadow = 0.0;
    float bias = 0.15;
    int samples = 20;
    float viewDistance = length(viewPos - fragPos);
    float diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0;
    for(int i = 0; i < samples; ++i)
    {
        float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= far_plane;   // undo mapping [0;1]
        if(currentDepth - bias > closestDepth)
            shadow += 1.0;
    }
    shadow /= float(samples);
```

Now do the last task, **pcf**: these lines replace the single sample and comparison.
:::
:::vulkan
The offsets, as a global array in `point_shadows.frag`:

```glsl
// array of offset direction for sampling
vec3 gridSamplingDisk[20] = vec3[](
    vec3(1, 1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1, 1,  1),
    vec3(1, 1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1, 1, -1),
    vec3(1, 1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1, 1,  0),
    vec3(1, 0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1, 0, -1),
    vec3(0, 1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0, 1, -1)
);
```

and in `ShadowCalculation`, after `fragToLight`:

```glsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: 20 samples around the direction, in a disk that grows with the distance to the viewer
    float shadow = 0.0;
    float bias = 0.15;
    int samples = 20;
    float viewDistance = length(ubo.viewPos - fragPos);
    float diskRadius = (1.0 + (viewDistance / ubo.far_plane)) / 25.0;
    for (int i = 0; i < samples; ++i) {
        float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= ubo.far_plane; // undo mapping [0;1]
        if (currentDepth - bias > closestDepth)
            shadow += 1.0;
    }
    shadow /= float(samples);
```

Now do the last task, **pcf**: these lines replace the single sample and comparison.
:::
:::d3d12
The offsets, as a constant array in `point_shadows.hlsl` – `static const` makes it part of the shader, not a value of
a constant buffer:

```hlsl
// array of offset direction for sampling
static const float3 gridSamplingDisk[20] =
{
    float3(1, 1,  1), float3( 1, -1,  1), float3(-1, -1,  1), float3(-1, 1,  1),
    float3(1, 1, -1), float3( 1, -1, -1), float3(-1, -1, -1), float3(-1, 1, -1),
    float3(1, 1,  0), float3( 1, -1,  0), float3(-1, -1,  0), float3(-1, 1,  0),
    float3(1, 0,  1), float3(-1,  0,  1), float3( 1,  0, -1), float3(-1, 0, -1),
    float3(0, 1,  1), float3( 0, -1,  1), float3( 0, -1, -1), float3( 0, 1, -1)
};
```

and in `ShadowCalculation`, after `fragToLight`:

```hlsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: sample the depth cubemap around fragToLight, in 20 directions spread over a disk
    // that grows with the distance to the camera (farther away the edges can be softer)
    float shadow = 0.0f;
    float bias = 0.15f;
    int samples = 20;
    float viewDistance = length(viewPos - fragPos);
    float diskRadius = (1.0f + (viewDistance / far_plane)) / 25.0f;
    for (int i = 0; i < samples; ++i)
    {
        float closestDepth = depthMap.Sample(shadowSampler, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= far_plane;   // undo mapping [0;1]
        if (currentDepth - bias > closestDepth)
            shadow += 1.0f;
    }
    shadow /= float(samples);
```

Now do the last task, **pcf**: these lines replace the single sample and comparison.
:::

Build and run: the shadow's **edges become soft** – its inside stays as dark as before, the lit wall around it
unchanged, but along the edges the brightness now changes gradually: where 5 of the 20 samples are in shadow, the
fragment is a quarter in shadow. Only the pixels at the shadow's edges change.

The PCF algorithm here is still quite simple; there is much more to soft shadows, and to point shadows in general: a
geometry shader that emits every triangle six times isn't free, and some renderers draw the six faces in six passes, or
skip the faces a light cannot reach. But the core of the technique stays the same: a cube of depths around the light,
looked up with a direction.

## Additional resources

:::opengl
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengl's chapter this chapter
  follows, with pictures of the scene from other angles.
- [point_shadows_soft.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/3.2.2.point_shadows_soft/point_shadows_soft.cpp):
  learnopengl's final program (with the moving light and the Space key that switches shadows on and off).
- [Cubemap Texture (OpenGL wiki)](https://www.khronos.org/opengl/wiki/Cubemap_Texture): cube map layout, face order
  and how a direction picks a face.
:::
:::vulkan
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengl's chapter this chapter
  follows, with pictures of the scene from other angles.
- [Textures (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/textures.html): the chapter of the
  specification with the cube map face selection table.
- [VkImageCreateInfo](https://registry.khronos.org/vulkan/specs/latest/man/html/VkImageCreateInfo.html): array layers
  and `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`.
:::
:::d3d12
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengl's chapter this chapter
  follows, with pictures of the scene from other angles.
- [Geometry shader stage](https://learn.microsoft.com/en-us/windows/win32/direct3d11/geometry-shader-stage): what a
  geometry shader can do, including single-pass rendering to a cube map with `SV_RenderTargetArrayIndex`.
- [Texture views](https://learn.microsoft.com/en-us/windows/uwp/graphics-concepts/texture-views): one texture array of
  six slices, viewed as a cube map or as an array of render targets.
:::
