# SSAO

We've briefly touched the topic in the basic lighting chapter: ambient lighting. Ambient lighting is a fixed light
constant we add to the overall lighting of a scene to simulate the scattering of light. In reality, light scatters in
all kinds of directions with varying intensities so the indirectly lit parts of a scene should also have varying
intensities. One type of indirect lighting approximation is called *ambient occlusion* that tries to approximate
indirect lighting by darkening creases, holes, and surfaces that are close to each other. These areas are largely
occluded by surrounding geometry and thus light rays have fewer places to escape to, hence the areas appear darker. Take
a look at the corners and creases of the room you're in to see that the light there seems just a little darker.

Ambient occlusion techniques are expensive as they have to take surrounding geometry into account. One could shoot a
large number of rays for each point in space to determine its amount of occlusion, but that quickly becomes
computationally infeasible for real-time solutions. In 2007, Crytek published a technique called *screen-space ambient
occlusion* (SSAO) for use in their title Crysis. The technique uses a scene's depth buffer in screen-space to determine
the amount of occlusion instead of real geometrical data. This approach is incredibly fast compared to real ambient
occlusion and gives plausible results, making it the de-facto standard for approximating real-time ambient occlusion.

The basics behind screen-space ambient occlusion are simple: for each fragment on a screen-filled quad we calculate an
*occlusion factor* based on the fragment's surrounding depth values. The occlusion factor is then used to reduce or
nullify the fragment's ambient lighting component. The occlusion factor is obtained by taking multiple depth samples in
a sphere sample kernel surrounding the fragment position and compare each of the samples with the current fragment's
depth value. The number of samples that have a higher depth value than the fragment's depth represents the occlusion
factor: a sample that lies inside the geometry – behind the surface the camera sees at that sample's spot on the
screen – counts as occluded.

It is clear the quality and precision of the effect directly relates to the number of surrounding samples we take. If
the sample count is too low, the precision drastically reduces and we get an artifact called *banding*; if it is too
high, we lose performance. We can reduce the amount of samples we have to test by introducing some randomness into the
sample kernel. By randomly rotating the sample kernel each fragment we can get high quality results with a much smaller
amount of samples. This does come at a price as the randomness introduces a noticeable *noise pattern* that we'll have
to fix by blurring the results.

This is the last lesson of the Advanced Lighting part, and it builds directly on the last one: SSAO needs positions and
normals per pixel, and a deferred renderer has them in its G-buffer. The SSAO pass and its blur are two more screen-quad
passes into single-channel targets; this chapter shows how {{api}} sets them up, and one new kind of resource – a small
texture filled with random data from the CPU.

## The scene

learnopengl lights its backpack model in a large room; the course puts a **planet** there – the Model Loading part's
model, a sphere of radius 1 with a flat ring around it, standing on the floor (translated to (0, 0.5, 0); learnopengl
rotates its backpack by -90° about x, the planet stays upright). The room is the 2 × 2 × 2 cube scaled by 7.5 and moved
up by 7, its normals inverted because we see its inside: the floor is at y = -0.5, the back wall at z = -7.5. Everything
has the same light grey albedo, 0.95 – learnopengl's: the model's textures are loaded but not used, so the occlusion is
easy to see. The camera is learnopengl's, at (0, 0, 5) looking down -z, with a far plane at 50.

One point light, learnopengl's: at (2, 4, -2) – above and behind the planet, to the right – with a blue colour (0.2, 0.2,
0.7), linear attenuation 0.09 and quadratic 0.032. The lighting pass is learnopengl's Blinn-Phong: an ambient term of
`0.3 * Diffuse`, diffuse and specular (exponent 8), attenuated. It works in **view space**: the light's position is
transformed by the view matrix before it is sent, and the viewer sits at the origin, so `viewDir = normalize(-FragPos)`.

Two deviations from learnopengl's code, both for the same reason – the course computes every pixel of its checks and
expected results on the CPU, and the SSAO pass is one of the most expensive passes in this course:

- **32 kernel samples instead of 64.** That halves the SSAO pass's work; the result is a little noisier before the blur
  and practically the same after it.
- **`rand()` instead of `std::uniform_real_distribution`.** learnopengl draws its random floats with
  `std::uniform_real_distribution<GLfloat>` and `std::default_random_engine`, and the numbers that engine produces
  differ between standard libraries. The course uses `srand(42)` and `rand() / (float)RAND_MAX` – a float between 0.0
  and 1.0 – whose sequence the course's pictures reproduce (glibc's), so the **Expected result** shows the same kernel
  and noise as your program on Linux, every run. On Windows, Microsoft's `rand()` (with a `RAND_MAX` of 32767) gives
  other numbers: the picture looks the same, the noise differs in detail.

:::opengl
The start is a deferred renderer like the last chapter's: `main.cpp` draws the room (`renderCube()` with
`invertedNormals` = 1) and the planet (`Model planet("models/planet.obj")`, the Model Loading part's `Model` class in
`model.h` / `mesh.h`) into the G-buffer with `ssao_geometry.vs` / `.fs`, then lights the screen quad with `ssao.vs` /
`ssao_lighting.fs`, which has no ambient occlusion yet. `ssao.vs` is the screen quad's vertex shader, shared by all
three screen passes. `ssao.fs` and `ssao_blur.fs` have their declarations, but their `main` is a TODO.
:::
:::vulkan
The start is a deferred renderer like the last chapter's: `recordCommandBuffer()` draws the room (the cube of the vertex
buffer, `invertedNormals = VK_TRUE` in the push constants: `struct PushConstants { glm::mat4 model; VkBool32
invertedNormals; }` – a GLSL `bool` is 4 bytes) and the planet (`loadModel(MODEL_PATH, modelVertices, modelIndices)` with
tinyobjloader, its own vertex and index buffers, one `vkCmdDrawIndexed`) into the G-buffer, then the screen quad
(vertices 36..41) into the window with `lightingPipeline` (`ssao.vert` / `ssao_lighting.frag`). There is **one descriptor
set for all passes**, `descriptorSet`, like vulkan-tutorial's: the uniform buffer at binding 0, gPosition, gNormal and
gAlbedo at 1, 2 and 3; each pass's shaders read only the bindings they declare. The window's render pass has no depth
attachment – only the quad is drawn into it – and the screen pipelines are made with `depthTestEnable = VK_FALSE`
(`createPipeline(…, colorAttachmentCount, depthTestEnable, …)` from the last chapter). The uniform buffer holds `view`,
`proj` and the light (`struct Light { glm::vec3 position; float linear; glm::vec3 color; float quadratic; }`, std140),
whose position `updateUniformBuffer()` transforms into view space. `ssao.frag` and `ssao_blur.frag` are TODOs that
compile and write nothing.
:::
:::d3d12
The start is a deferred renderer like the last chapter's: `PopulateCommandList` draws the room (the cube of the vertex
buffer, `invertedNormals = TRUE` in the root constants) and the planet (`Model m_model`, the Model Loading part's classes
ported with Assimp; `m_model.Draw` binds each mesh's maps) into the G-buffer `m_gBuffer[3]`, then the screen quad into the
back buffer with `m_lightingPipelineState` (`ssao_lighting.hlsl`). The heap holds the CBV in slot 0, the meshes' maps in
slots 1–4 (`MaxMeshes = 2`) and the G-buffer's SRVs in slots 5, 6 and 7. The root signature has the root constants
(b0: `ModelConstants` – `model`, `normalMatrix`, `BOOL invertedNormals`), table 1 for the CBV (b1), table 2 with two SRVs
(t0, t1) and table 3 with one (t2), and static sampler s0: point filtering, CLAMP. Every screen pass has its own copy of
learnopengl's shared `ssao.vs` as `VSMain` – a pipeline state takes its shaders from one file here. `ssao.hlsl` and
`ssao_blur.hlsl` have their declarations; their `PSMain` is a TODO (they aren't compiled before you need them).
:::

The `// TODO:` comments in the project mark where your code goes. Build and run the program in your IDE: the inside of a
large grey room lit blue from the upper right – the back wall, the floor below a thin edge line, and the grey planet in
the middle, standing on the floor. Its front faces away from the light and gets only the ambient light; its upper right
edge is lit blue. The ring crosses in front of it from one side of the window to the other, just above the eye: you see
it **from below**. Everything that isn't lit directly is the same flat grey; nothing shows where the planet touches the
floor.

## Sample buffers

SSAO requires geometrical info as we need some way to determine the occlusion factor of a fragment. For each fragment,
we're going to need the following data:

- A per-fragment **position** vector.
- A per-fragment **normal** vector.
- A per-fragment **albedo** colour.
- A **sample kernel**.
- A per-fragment **random rotation** vector used to rotate the sample kernel.

Using a per-fragment view-space position we can orient a sample hemisphere kernel around the fragment's view-space
surface normal and use this kernel to sample the position buffer texture at varying offsets. For each per-fragment
kernel sample we compare its depth with its depth in the position buffer to determine the amount of occlusion. The
resulting occlusion factor is then used to limit the final ambient lighting component.

As SSAO is a screen-space technique we calculate its effect on each fragment on a screen-filled 2D quad. This does mean
we have no geometrical information of the scene. What we could do, is render the geometrical per-fragment data into
screen-space textures that we then later send to the SSAO shader so we have access to the per-fragment geometrical data.
If you've followed along with the previous chapter you'll realize this looks quite like a deferred renderer's G-buffer
setup. For that reason SSAO is perfect in combination with deferred rendering as we already have the position and normal
vectors in the G-buffer.

This time the G-buffer is in **view space**, not world space: the SSAO shader projects its samples onto the screen with
the projection matrix alone, and compares depths as the camera sees them – and in view space the depth of a point is
simply its z (negative: the camera looks down -z). The geometry shaders of the start do this – learnopengl's
`ssao_geometry.vs`: the position is `view * model * aPos`, the normal is transformed with
`transpose(inverse(mat3(view * model)))` and negated for the room, whose inside we see:

:::opengl
```glsl
void main()
{
    vec4 viewPos = view * model * vec4(aPos, 1.0);
    FragPos = viewPos.xyz;
    TexCoords = aTexCoords;

    mat3 normalMatrix = transpose(inverse(mat3(view * model)));
    Normal = normalMatrix * (invertedNormals ? -aNormal : aNormal);

    gl_Position = projection * viewPos;
}
```

The G-buffer is the last chapter's – gPosition and gNormal `GL_RGBA16F`, gAlbedo `GL_RGBA`, all `GL_NEAREST` – with one
addition on gPosition:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
```

The SSAO samples around a fragment near the window's edge can land outside the texture; with the default `GL_REPEAT`
they would read the positions at the opposite edge, and occlusion would appear where there is none.
:::
:::vulkan
```glsl
void main() {
    // the G-buffer is in view space: positions and normals as the camera sees them
    vec4 viewPos = ubo.view * pc.model * vec4(inPosition, 1.0);
    vs_out.fragPos = viewPos.xyz;
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(ubo.view * pc.model)));
    vs_out.normal = normalMatrix * (pc.invertedNormals ? -inNormal : inNormal);

    gl_Position = ubo.proj * viewPos;
}
```

The G-buffer is the last chapter's – gPosition and gNormal `VK_FORMAT_R16G16B16A16_SFLOAT`, gAlbedo
`VK_FORMAT_R8G8B8A8_UNORM` – sampled with `gBufferSampler`: `VK_FILTER_NEAREST` and
**`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`**. The SSAO samples around a pixel near the window's edge can land outside the
image; with REPEAT they would read the positions at the opposite edge, and occlusion would appear where there is none.
:::
:::d3d12
```hlsl
    // The position in view space: model, then view.
    float4 viewPos = mul(mul(position, model), view);
    result.fragPos = viewPos.xyz;
    result.texCoord = texCoord;

    float3 n = invertedNormals ? -normal : normal;
    float3 worldNormal = mul(float4(n, 0.0f), normalMatrix).xyz;
    result.normal = mul(float4(worldNormal, 0.0f), view).xyz;

    result.position = mul(viewPos, projection);
```

learnopengl's `transpose(inverse(mat3(view * model)))` is computed in two steps: first the model's normal matrix (from
`main.cpp`, as in the earlier chapters), then the view matrix itself – it only rotates and moves, so it is its own normal
matrix. The G-buffer is the last chapter's – gPosition and gNormal `R16G16B16A16_FLOAT`, gAlbedo `R8G8B8A8_UNORM` – read
with static sampler s0: point filtering and **CLAMP**. The SSAO samples around a pixel near the window's edge can land
outside the texture; with WRAP they would read the positions at the opposite edge, and occlusion would appear where there
is none.
:::

The depth we need is gPosition's z. learnopengl notes that it's possible to reconstruct the actual position vectors from
depth values alone, using some clever tricks – that saves the position target's memory and bandwidth, and is what larger
renderers do. Here, for the sake of clarity, the position buffer stays.

Next to the G-buffer, the SSAO pass needs a target of its own. Its result is a single number per pixel, the occlusion
factor between 0.0 and 1.0 – so the target has a **single channel**:

:::opengl
```cpp
    // also create framebuffer to hold SSAO processing stage
    // -----------------------------------------------------
    unsigned int ssaoFBO;
    glGenFramebuffers(1, &ssaoFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    unsigned int ssaoColorBuffer;
    // SSAO color buffer
    glGenTextures(1, &ssaoColorBuffer);
    glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, SCR_WIDTH, SCR_HEIGHT, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColorBuffer, 0);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "SSAO Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`GL_RED` as internal format: one channel (8 bits normalized on most implementations – plenty for a factor between 0 and
1). The `GL_FLOAT` only describes the (absent) data passed in. No depth buffer: the pass draws only the screen quad. A
shader whose output is a `float` writes it into the red channel.
:::
:::vulkan
In Vulkan that's a render pass with one colour attachment, `VK_FORMAT_R8_UNORM` (learnopengl's `GL_RED`: one 8-bit
channel), and no depth. `createSsaoRenderPass()` is built like the bloom chapter's blur pass: the old contents aren't
needed – the screen quad covers every pixel – so `loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE` and nothing is cleared, and
the image is left ready to be sampled:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R8_UNORM; // one 8-bit channel: the ambient occlusion, 0..1
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Its two subpass dependencies: before the pass, wait until the last frame's shaders have read the image (it is written
again now); after it, make the colour writes visible to the next pass's fragment shader. `createSsaoFramebuffers()`
creates the image (`VK_FORMAT_R8_UNORM`, colour attachment + sampled), its view and its framebuffer:

```cpp
        // SSAO color buffer
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, ssaoColorImage, ssaoColorImageMemory);
        ssaoColorImageView = createImageView(ssaoColorImage, VK_FORMAT_R8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

and the pipeline is made for this render pass, without the depth test:

```cpp
        // the SSAO pass's for its own (one channel, no depth)
        createPipeline("shaders/ssao.vert.spv", "shaders/ssao.frag.spv", ssaoRenderPass, 1, VK_FALSE, ssaoPipeline);
```

Every Vulkan device can render into and sample `VK_FORMAT_R8_UNORM` images. A shader output declared as `float` writes
the image's single channel.
:::
:::d3d12
In Direct3D 12 that's a render target with the format `DXGI_FORMAT_R8_UNORM` (learnopengl's `GL_RED`: one 8-bit
channel), created like the G-buffer's textures – it starts in `PIXEL_SHADER_RESOURCE`, its RTV is in slot `FrameCount + 3`
(the RTV heap grows to `FrameCount + 4`), its SRV in slot 8:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8_UNORM, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        const float optimizedClearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8_UNORM, optimizedClearColor);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_ssaoColorBuffer)));
```

followed by `CreateRenderTargetView` and an SRV with `srvDesc.Format = DXGI_FORMAT_R8_UNORM`. The pass's PSO,
`m_ssaoPipelineState`, compiles `ssao.hlsl` and writes one 8-bit channel, without depth:

```cpp
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8_UNORM;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_ssaoPipelineState)));
```

A pixel shader that returns a `float` writes the target's single channel.
:::

## Normal-oriented hemisphere

We need to generate a number of samples oriented along the normal of a surface. As we briefly discussed at the start of
this chapter, we want to generate samples that form a hemisphere. As it is difficult nor plausible to generate a sample
kernel for each surface normal direction, we're going to generate a sample kernel in *tangent space*, with the normal
vector pointing in the positive z direction.

Why a hemisphere and not Crytek's sphere? With a sphere, half of the samples around a fragment on a flat wall lie
behind the wall: a perfectly flat, unoccluded surface would be counted as half occluded, and everything gets a grey
look. A hemisphere oriented along the surface's normal only samples the space in front of the surface, so a flat wall
gets no occlusion and only real creases and nearby objects darken it.

```quiz
Why does SSAO sample a hemisphere oriented along the normal instead of a full sphere around the fragment?
- [ ] A hemisphere needs half the memory for its kernel
- [x] Half of a sphere lies behind the surface itself: a flat, open wall would count as about half occluded and everything would look grey – the hemisphere only samples the space in front of the surface
- [ ] The projection matrix can only project points in front of the camera
- [ ] A sphere's samples can't be rotated by the noise vectors
---
Crytek's original SSAO used a sphere, which gave its characteristic grey, edge-highlighting look. The normal from the G-buffer makes the hemisphere possible.
```

Assuming we have a unit hemisphere, we can obtain a sample kernel with a maximum of 32 samples like this: we vary the x
and y direction in tangent space between -1.0 and 1.0, and vary the z direction of the samples between 0.0 and 1.0 (if
we varied the z direction between -1.0 and 1.0 as well we'd have a sphere sample kernel). As the sample kernel will be
oriented along the surface normal, the resulting sample vectors will all end up in the hemisphere. Then each sample is
normalized and scaled by a random length, so the samples lie inside the hemisphere, not only on its surface.

Currently, all samples are randomly distributed in the sample kernel, but we'd rather place a larger weight on
occlusions close to the actual fragment. We want to distribute more kernel samples closer to the origin. We can do this
with an accelerating interpolation function: the i-th sample's length is multiplied by `lerp(0.1, 1.0, (i / 32)²)` – the
first samples stay within a tenth of the radius, and only the last few reach out to the full radius.

:::opengl
learnopengl's code, with the course's random numbers – `ourLerp` is learnopengl's linear interpolation, `a + f * (b - a)`:

```cpp
    srand(42);
    std::vector<glm::vec3> ssaoKernel;
    for (unsigned int i = 0; i < 32; ++i) // 32 samples (learnopengl uses 64)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
        glm::vec3 sample(x, y, z);
        sample = glm::normalize(sample);
        sample *= rand() / (float)RAND_MAX;
        float scale = float(i) / 32.0f;

        // scale samples s.t. they're more aligned to center of kernel
        scale = ourLerp(0.1f, 1.0f, scale * scale);
        sample *= scale;
        ssaoKernel.push_back(sample);
    }
```

The kernel is the same for every pixel: `ssao.fs` declares `uniform vec3 samples[32];`, and the render loop sends it
before the SSAO pass draws (`shaderSSAO.setVec3("samples[" + std::to_string(i) + "]", ssaoKernel[i])` for each `i`).
:::
:::vulkan
learnopengl's code, with the course's random numbers, in `generateSampleKernel()` – `ourLerp` is learnopengl's linear
interpolation, `a + f * (b - a)`, a free function before the class:

```cpp
    void generateSampleKernel() {
        srand(42);
        for (unsigned int i = 0; i < 32; ++i) { // 32 samples (learnopengl uses 64)
            float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
            glm::vec3 sample(x, y, z);
            sample = glm::normalize(sample);
            sample *= rand() / (float)RAND_MAX;
            float scale = float(i) / 32.0f;

            // scale samples s.t. they're more aligned to center of kernel
            scale = ourLerp(0.1f, 1.0f, scale * scale);
            sample *= scale;
            ssaoKernel.push_back(sample);
        }
    }
```

`ssaoKernel` is a member, `std::vector<glm::vec3>`. The kernel is the same for every pixel, so it goes into the uniform
buffer – but not as `vec3`s: **std140 puts the elements of an array 16 bytes apart**, so a `vec3 samples[32]` would have
a 4-byte gap after every element. The uniform buffer gets `glm::vec4 samples[32];` after the light (the shader uses only
`xyz`), and `updateUniformBuffer()` copies the kernel into it:

```cpp
        // send kernel
        for (unsigned int i = 0; i < 32; ++i) {
            ubo.samples[i] = glm::vec4(ssaoKernel[i], 0.0f);
        }
```
:::
:::d3d12
learnopengl's code, with the course's random numbers, in `LoadAssets` – with DirectXMath's vector functions, and
`ourLerp`, learnopengl's linear interpolation `a + f * (b - a)`, as a global function next to the global
`std::vector<XMFLOAT3> ssaoKernel;`:

```cpp
    srand(42);
    for (unsigned int i = 0; i < 32; ++i) // 32 samples (learnopengl uses 64)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
        XMVECTOR sample = XMVectorSet(x, y, z, 0.0f);
        sample = XMVector3Normalize(sample);
        sample *= rand() / (float)RAND_MAX;
        float scale = static_cast<float>(i) / 32.0f;

        // scale samples s.t. they're more aligned to center of kernel
        scale = ourLerp(0.1f, 1.0f, scale * scale);
        sample *= scale;
        XMFLOAT3 kernelSample;
        XMStoreFloat3(&kernelSample, sample);
        ssaoKernel.push_back(kernelSample);
    }
```

The kernel is the same for every pixel, so it goes into the constant buffer – but not as `float3`s: **every element of
an array in a constant buffer starts a new 16-byte row**, so a `float3` sample takes as much space as a `float4`. The
C++ struct says so explicitly with `XMFLOAT4 samples[32];` after the light, and `OnUpdate` copies the kernel into it:

```cpp
    // Send kernel: the 32 samples, for the SSAO pass.
    for (unsigned int i = 0; i < 32; ++i)
        constantBufferData.samples[i] = XMFLOAT4(ssaoKernel[i].x, ssaoKernel[i].y, ssaoKernel[i].z, 0.0f);
```
:::

Each random number gets its own statement: `float x = …; float y = …; float z = …;`. Writing
`glm::vec3(rand…, rand…, rand…)` would be shorter, but C++ does not fix the order in which a function's arguments are
evaluated – another compiler could draw the three numbers in another order and get another kernel.

```quiz
Why is each sample's length multiplied by `lerp(0.1, 1.0, (i / 32)²)`?
- [ ] To keep the samples inside the window
- [ ] To make the kernel symmetric around the normal
- [x] To put more samples close to the fragment: the first ones stay within a tenth of the radius, only the last few reach the full radius – occluders close by weigh more than distant ones
- [ ] To normalize the samples to unit length
---
Without it the random lengths would be spread evenly, and most samples would lie in the outer part of the hemisphere (it has more volume there). The squared index makes the scale grow slowly at first.
```

## Random kernel rotations

By introducing some randomness onto the sample kernels we largely reduce the number of samples necessary to get good
results. We could create a random rotation vector for each fragment of a scene, but that quickly eats up memory. It
makes more sense to create a small texture of random rotation vectors that we tile over the screen.

We create a 4 × 4 array of random rotation vectors oriented around the tangent-space surface normal. As the sample
kernel is oriented along the positive z direction in tangent space, we leave the z component at 0.0 so we rotate around
the z axis. The 16 vectors go into a 4 × 4 texture with **repeat** wrapping and **nearest** filtering: the SSAO shader
reads it at `TexCoords * noiseScale`, with `noiseScale = (800 / 4, 600 / 4)` – the window's size divided by the noise
size – so the texture coordinates run from 0 to 200 across the window, the texture repeats 200 × 150 times, and every
pixel gets exactly one of the 16 vectors, the same as the pixel 4 to its right or 4 below it.

:::opengl
```cpp
    std::vector<glm::vec3> ssaoNoise;
    for (unsigned int i = 0; i < 16; i++)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        glm::vec3 noise(x, y, 0.0f); // rotate around z-axis (in tangent space)
        ssaoNoise.push_back(noise);
    }
    unsigned int noiseTexture; glGenTextures(1, &noiseTexture);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &ssaoNoise[0]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

The noise continues the same random sequence after the kernel – that's why the kernel is generated first. The data is
three floats per texel (`GL_RGB`, `GL_FLOAT`), stored in a texture with four 32-bit float channels (`GL_RGBA32F`): a
`glm::vec3` is three tightly packed floats, so the vector's memory is exactly the 4 × 4 texels' data.
:::
:::vulkan
`createNoiseTexture()`, called right after `generateSampleKernel()` – the noise continues the same random sequence:

```cpp
        std::vector<glm::vec4> ssaoNoise;
        for (unsigned int i = 0; i < 16; i++) {
            float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            glm::vec4 noise(x, y, 0.0f, 0.0f); // rotate around z-axis (in tangent space)
            ssaoNoise.push_back(noise);
        }
```

The vectors are `vec4`s and the image is `VK_FORMAT_R32G32B32A32_SFLOAT`, learnopengl's `GL_RGBA32F`: Vulkan devices
need not support sampling 3-channel float images (`VK_FORMAT_R32G32B32_SFLOAT`), while the 4-channel one is required.
The upload is vulkan-tutorial's texture upload: a staging buffer with the 16 vectors (256 bytes), a 4 × 4 image (transfer
destination + sampled), a transition to `TRANSFER_DST_OPTIMAL`, the copy, a transition to `SHADER_READ_ONLY_OPTIMAL`:

```cpp
        createImage(4, 4, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, noiseTextureImage, noiseTextureImageMemory);

        transitionImageLayout(noiseTextureImage, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, noiseTextureImage, 4, 4);
        transitionImageLayout(noiseTextureImage, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
```

then the staging buffer is destroyed and the view created. It is sampled with its own sampler,
`createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_REPEAT, noiseSampler)` – the G-buffer's sampler clamps,
the noise must repeat. The descriptor set layout gets binding 4 for the noise and binding 5 for the SSAO image (copies of
`gPositionLayoutBinding` with another `binding`), the pool 5 combined image samplers, and `createDescriptorSet()` two more
`VkDescriptorImageInfo`s and writes: `noiseTextureImageView` with `noiseSampler` at 4, `ssaoColorImageView` with
`gBufferSampler` at 5.
:::
:::d3d12
Right after the kernel – the noise continues the same random sequence:

```cpp
    std::vector<XMFLOAT4> ssaoNoise;
    for (unsigned int i = 0; i < 16; i++)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        XMFLOAT4 noise(x, y, 0.0f, 0.0f); // rotate around z-axis (in tangent space)
        ssaoNoise.push_back(noise);
    }
```

The texture is `DXGI_FORMAT_R32G32B32A32_FLOAT`, learnopengl's `GL_RGBA32F`, so the vectors are `XMFLOAT4`s – 16 bytes
per texel. It's filled the way the HelloTexture sample fills its texture: the texture in a default heap, created in
`COPY_DEST`; an upload buffer of `GetRequiredIntermediateSize`; `UpdateSubresources` copies the data into the upload
buffer and records the copy into the texture; a barrier makes it a shader resource:

```cpp
        // Copy the noise to the upload heap now and schedule the copy into the texture.
        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = ssaoNoise.data();
        textureData.RowPitch = 4 * sizeof(XMFLOAT4);              // bytes per row: 4 texels
        textureData.SlicePitch = textureData.RowPitch * 4;       // bytes in the whole texture: 4 rows
        UpdateSubresources(m_commandList.Get(), m_noiseTexture.Get(), noiseTextureUploadHeap.Get(), 0, 0, 1, &textureData);

        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_noiseTexture.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

`noiseTextureUploadHeap` is a local `ComPtr` declared before the block: it must stay alive until the command list that
copies from it has executed – the end of `LoadAssets` waits for that. The SRV goes into heap slot 9 (the CBV/SRV heap
grows to `1 + 2 * MaxMeshes + 5`). The noise must repeat over the window, but s0 clamps – so the root signature gets a
second static sampler, s1, with the same point filtering and WRAP addressing:

```cpp
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].ShaderRegister = 1;
```

(`D3D12_STATIC_SAMPLER_DESC samplers[2]`.) The root signature also gets a fifth parameter for the lighting pass's SSAO
texture at t3: `ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 3)` and
`rootParameters[4].InitAsDescriptorTable(1, &ranges[3], D3D12_SHADER_VISIBILITY_PIXEL)`. The shaders' registers are
learnopengl's texture units: the SSAO pass reads gPosition (t0), gNormal (t1) and the noise (t2); the lighting pass
gPosition, gNormal, gAlbedo (t2) and the SSAO texture (t3).
:::

:::opengl
```quiz
`glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &ssaoNoise[0])` – what does the noise texture hold, and what makes it cover the whole window?
- [x] 16 texels of (x, y, 0, 1) – the missing alpha becomes 1 –, read with `GL_NEAREST` at `TexCoords * noiseScale` (0..200, 0..150) and `GL_REPEAT`, so the 4 × 4 texture tiles the window and each pixel gets one vector
- [ ] 16 texels of (x, y, 0), stretched over the window with linear filtering
- [ ] 800 × 600 random vectors, one per pixel
- [ ] 16 texels, but only the window's top-left 4 × 4 pixels read them; the others get (0, 0, 0)
---
With `GL_CLAMP_TO_EDGE`, every coordinate above 1.0 would read the last texel: almost the whole window would get one rotation.
```
:::
:::vulkan
```quiz
Why are the noise vectors `glm::vec4(x, y, 0.0f, 0.0f)` in a `VK_FORMAT_R32G32B32A32_SFLOAT` image, instead of learnopengl's `vec3`s?
- [ ] Vulkan images can't have fewer than four channels
- [ ] The staging buffer must be a multiple of 64 bytes
- [ ] The w component holds the rotation angle
- [x] Vulkan devices need not support sampling 3-channel float images, while `R32G32B32A32_SFLOAT` is required – and a 4-channel texel is 16 bytes, so the vectors must be `vec4`s for the copy to fill the texels right
---
learnopengl's `GL_RGBA32F` texture is four channels too; OpenGL converts its `GL_RGB` data on upload. Vulkan copies bytes as they are, so the data must already have the image's layout.
```
:::
:::d3d12
```quiz
Why does the root signature get a second static sampler, s1, for the noise texture?
- [ ] A static sampler can only serve one texture
- [x] The noise is read at `texCoord * noiseScale` – coordinates from 0 to 200 – and must repeat (WRAP), while the window-sized textures are read with s0, which clamps so the SSAO samples near the edges don't wrap around
- [ ] Float textures need a sampler of their own
- [ ] s0 has linear filtering, and the noise needs point filtering
---
Both samplers filter with points; they differ only in the addressing. The shader picks the sampler per lookup: `texNoise.Sample(wrapSampler, …)`, `gPosition.Sample(clampSampler, …)`.
```
:::

## The SSAO shader

The SSAO shader runs on the screen-filled quad and calculates the occlusion value for each of its fragments. Its
parameters are learnopengl's: the kernel size (32 here), a radius of 0.5 – the hemisphere's size in view-space units –
and a bias of 0.025.

We start by building a TBN matrix that transforms any vector from tangent space to view space. Using a process called
the *Gram-Schmidt process* we create an orthogonal basis, each time slightly tilted based on the value of `randomVec`:
the random vector minus its part along the normal is a tangent perpendicular to the normal, the bitangent is the cross
product of the two. Note that because we use a random vector for constructing the tangent vector, there is no need to
have the TBN matrix exactly aligned to the geometry's surface, thus no need for per-vertex tangent (and bitangent)
vectors.

Next we iterate over each of the kernel samples, transform the samples from tangent to view space, add them to the
current fragment position, and compare the fragment position's depth with the sample depth stored in the position
buffer:

1. `samplePos = fragPos + TBN * sample * radius` – the sample in view space.
2. Project it with the projection matrix and do the perspective divide; transform x and y from normalized device
   coordinates (-1..1) into texture coordinates (0..1).
3. Read gPosition there: its z is the depth of the surface the camera sees at that spot of the screen – the
   `sampleDepth`.
4. If that surface is in front of the sample – `sampleDepth >= samplePos.z + bias` (view-space z is negative; larger is
   nearer) – the sample is inside the geometry and counts as occluded. The bias keeps a flat surface from occluding
   itself through the precision of the stored positions – the same idea as the shadow bias.

There is one more issue: whenever a fragment is tested for ambient occlusion that is aligned close to the edge of a
surface, it will also consider the depth values of surfaces far behind the test surface; these values will (incorrectly)
contribute to the occlusion factor. We can solve this by introducing a **range check**:
`smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` is 1.0 when the depth difference is within the radius, and
falls off smoothly for surfaces farther away, so a distant surface hardly contributes. Finally the occlusion
contribution is normalized by the size of the kernel and subtracted from 1.0, so the result is the fraction of samples
that are *not* occluded – the factor the ambient light is multiplied with later.

:::opengl
`ssao.fs` has its declarations – the samplers, `uniform vec3 samples[32];`, `int kernelSize = 32; float radius = 0.5;
float bias = 0.025;`, `const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0);` and `uniform mat4 projection;`. Its `main` is
learnopengl's:

```glsl
void main()
{
    // get input for SSAO algorithm
    vec3 fragPos = texture(gPosition, TexCoords).xyz;
    vec3 normal = normalize(texture(gNormal, TexCoords).rgb);
    vec3 randomVec = normalize(texture(texNoise, TexCoords * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0;
    for(int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        vec3 samplePos = TBN * samples[i]; // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        vec4 offset = vec4(samplePos, 1.0);
        offset = projection * offset; // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        offset.xyz = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0

        // get sample depth
        float sampleDepth = texture(gPosition, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }
    occlusion = 1.0 - (occlusion / kernelSize);

    FragColor = occlusion;
}
```

`FragColor` is `out float` – the red channel of `ssaoColorBuffer`. In `main.cpp`: `Shader shaderSSAO("ssao.vs",
"ssao.fs");`, its samplers on units 0–2 (`shaderSSAO.setInt("gPosition", 0)`, `("gNormal", 1)`, `("texNoise", 2)`), and
the pass between the geometry pass and the lighting pass:

```cpp
        // 2. generate SSAO texture
        // ------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
        glClear(GL_COLOR_BUFFER_BIT);
        shaderSSAO.use();
        // Send kernel + rotation
        for (unsigned int i = 0; i < 32; ++i)
            shaderSSAO.setVec3("samples[" + std::to_string(i) + "]", ssaoKernel[i]);
        shaderSSAO.setMat4("projection", projection);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gPosition);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, gNormal);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, noiseTexture);
        renderQuad();
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

To see the result, the lighting pass shows it for now: it binds `ssaoColorBuffer` on unit 3
(`shaderLightingPass.setInt("ssao", 3)`), and `ssao_lighting.fs` gets `uniform sampler2D ssao;` and, after its last
line, `FragColor = vec4(vec3(texture(ssao, TexCoords).r), 1.0); // for now: show the SSAO texture`. Now do the first
task, **kernel**, and delete the SSAO texture, its framebuffer and the noise texture at the end.
:::
:::vulkan
`ssao.frag` declares the uniform buffer up to the kernel (the light comes first, so the block must declare it to get
the offsets right), gPosition, gNormal and the noise at bindings 1, 2 and 4, a `float` output, and learnopengl's
parameters:

```glsl
// the uniform buffer up to the kernel
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light light;
    vec4 samples[32]; // the kernel (xyz; std140: array elements are 16 bytes apart)
} ubo;

layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 4) uniform sampler2D texNoise;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out float outColor; // the SSAO image has one channel

// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
int kernelSize = 32;
float radius = 0.5;
float bias = 0.025;

// tile noise texture over screen based on screen dimensions divided by noise size
const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0);
```

(with `struct Light` declared as in `ssao_lighting.frag`). Its `main` is learnopengl's, reading the kernel and the
projection from the uniform buffer:

```glsl
void main() {
    // get input for SSAO algorithm
    vec3 fragPos = texture(gPosition, fragTexCoord).xyz;
    vec3 normal = normalize(texture(gNormal, fragTexCoord).rgb);
    vec3 randomVec = normalize(texture(texNoise, fragTexCoord * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0;
    for (int i = 0; i < kernelSize; ++i) {
        // get sample position
        vec3 samplePos = TBN * ubo.samples[i].xyz; // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        vec4 offset = vec4(samplePos, 1.0);
        offset = ubo.proj * offset; // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        offset.xy = offset.xy * 0.5 + 0.5; // transform to range 0.0 - 1.0 (the flipped projection's y points down, like v)

        // get sample depth
        float sampleDepth = texture(gPosition, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }
    occlusion = 1.0 - (occlusion / kernelSize);

    outColor = occlusion;
}
```

The projection is the course's Vulkan projection with `proj[1][1] *= -1`: after it, normalized device y points down –
the same way as the image's v, which is 0 at the top row. So `offset.xy * 0.5 + 0.5` gives the texture coordinates
directly, as in OpenGL. Only x and y are transformed: the depth is read from gPosition, not from the projected z
(which is 0..1 in Vulkan anyway).

In `recordCommandBuffer()`, the SSAO pass comes between the geometry pass and the window's pass. The descriptor set is
still bound from the geometry pass, the viewport and scissor are still set, and the vertex buffer is bound again before
the screen passes (the planet's draw bound its own):

```cpp
        // 2. generate SSAO texture
        VkRenderPassBeginInfo ssaoPassInfo{};
        ssaoPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        ssaoPassInfo.renderPass = ssaoRenderPass;
        ssaoPassInfo.framebuffer = ssaoFramebuffer;
        ssaoPassInfo.renderArea.offset = {0, 0};
        ssaoPassInfo.renderArea.extent = swapChainExtent;
        ssaoPassInfo.clearValueCount = 0; // loadOp DONT_CARE: nothing to clear

        vkCmdBeginRenderPass(commandBuffer, &ssaoPassInfo, VK_SUBPASS_CONTENTS_INLINE);
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, ssaoPipeline);
        // the kernel and the projection are in the uniform buffer, gPosition, gNormal and the noise in the descriptor set
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad()
        vkCmdEndRenderPass(commandBuffer); // the SSAO image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

The set contains the SSAO image at binding 5 while the SSAO pass draws into it – allowed, because no shader of that pass
reads binding 5. To see the result, the lighting pass shows it for now: `ssao_lighting.frag` gets `layout(binding = 5)
uniform sampler2D ssao;` and, after its last line, `outColor = vec4(vec3(texture(ssao, fragTexCoord).r), 1.0); // for now:
show the SSAO texture`. Now do the first task, **kernel**, and destroy the noise texture and its sampler, the SSAO image,
its framebuffer, the pipeline and the render pass in `cleanup()`.
:::
:::d3d12
`ssao.hlsl` has its declarations: gPosition, gNormal and the noise at t0, t1 and t2, the samplers `clampSampler` (s0)
and `wrapSampler` (s1), the constant buffer up to the kernel (`float4 samples[32];` after the light), and learnopengl's
parameters as `static const` – `kernelSize = 32`, `radius = 0.5f`, `bias = 0.025f`, `noiseScale = float2(800.0f / 4.0f,
600.0f / 4.0f)`. Its `PSMain` returns a `float` and is learnopengl's `main`:

```hlsl
    // get input for SSAO algorithm
    float3 fragPos = gPosition.Sample(clampSampler, input.texCoord).xyz;
    float3 normal = normalize(gNormal.Sample(clampSampler, input.texCoord).rgb);
    float3 randomVec = normalize(texNoise.Sample(wrapSampler, input.texCoord * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space (its rows are the
    // tangent, the bitangent and the normal, so mul(v, TBN) = v.x * T + v.y * B + v.z * N)
    float3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    float3 bitangent = cross(normal, tangent);
    float3x3 TBN = float3x3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0f;
    for (int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        float3 samplePos = mul(samples[i].xyz, TBN); // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        float4 offset = float4(samplePos, 1.0f);
        offset = mul(offset, projection); // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        // transform to range 0.0 - 1.0: x as in OpenGL, y flipped - texture coordinate v
        // points down, normalized device y up
        offset.xy = float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f);

        // get sample depth
        float sampleDepth = gPosition.Sample(clampSampler, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0f, 1.0f, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0f : 0.0f) * rangeCheck;
    }
    occlusion = 1.0f - (occlusion / kernelSize);

    return occlusion;
```

Two places differ from GLSL. `float3x3(tangent, bitangent, normal)` has the three vectors as **rows** (GLSL's `mat3`
constructor takes columns), so the row vector times the matrix, `mul(samples[i].xyz, TBN)`, is x·T + y·B + z·N – GLSL's
`TBN * samples[i]`. And Direct3D's texture coordinate v points **down** while normalized device y points up, so y is
flipped on the way to texture coordinates. The view space is learnopengl's right-handed one (`XMMatrixLookAtRH`), so the
depths are negative and the comparisons are unchanged; the `kernelSize` loop has a fixed count, so `Sample` is fine in it.

In `PopulateCommandList`, between the geometry pass and the lighting pass – a barrier, the SSAO texture as the only render
target, no DSV, the PSO, gPosition and gNormal in table 2 (the handle `gPositionNormal`, slot 5), the noise in table 3:

```cpp
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBuffer.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, barriers);
    CD3DX12_CPU_DESCRIPTOR_HANDLE ssaoRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 3, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &ssaoRtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(ssaoRtvHandle, clearColor, 0, nullptr);
    m_commandList->SetPipelineState(m_ssaoPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, gPositionNormal);
    CD3DX12_GPU_DESCRIPTOR_HANDLE texNoise(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 9, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, texNoise);
    m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBuffer.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, barriers);
```

To see the result, the lighting pass shows it for now: it sets table 4 to slot 8 (`SetGraphicsRootDescriptorTable(4,
ssao)`), and `ssao_lighting.hlsl` gets `Texture2D ssao : register(t3);` and, instead of its `return`,
`return float4(ssao.Sample(clampSampler, input.texCoord).rrr, 1.0f);` – "for now: show the SSAO texture". Now do the first
task, **kernel**.
:::

:::opengl
```quiz
In `ssao.fs`, what does `offset.xyz = offset.xyz * 0.5 + 0.5` after the perspective divide do?
- [ ] It converts the sample from view space to world space
- [ ] It scales the sample to the kernel's radius
- [x] It maps normalized device coordinates (-1..1) to texture coordinates (0..1), so `offset.xy` is where the sample appears in gPosition – OpenGL's texture v and NDC y both point up
- [ ] It undoes the bias
---
Only `offset.xy` is used afterwards: the depth to compare is read from gPosition, not taken from the projected z.
```
:::
:::vulkan
```quiz
Why does Vulkan's `ssao.frag` turn the projected sample into texture coordinates with just `offset.xy * 0.5 + 0.5`, without flipping y?
- [x] The course's projection has `proj[1][1] *= -1`: normalized device y points down, like the image's v (0 at the top row), so the mapping is the same in both axes
- [ ] Vulkan's textures are stored upside down, which cancels the flip
- [ ] The sampler flips v when `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` is set
- [ ] Only x matters for the SSAO lookup
---
Only xy are transformed: the depth to compare is gPosition's z. Vulkan's projected z is 0..1 anyway, so `* 0.5 + 0.5` would be wrong for it.
```
:::
:::d3d12
```quiz
Why does `ssao.hlsl` compute the texture coordinates as `float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f)`?
- [ ] HLSL's `mul` mirrors the projection in y
- [ ] The noise texture is stored upside down
- [ ] Direct3D's normalized device x points left
- [x] Direct3D's texture coordinate v points down while normalized device y points up: a sample above the fragment must be looked up in a row nearer the top of gPosition
---
Without the flip, every sample would read the depth of a spot mirrored about the window's middle row – the occlusion would come from the wrong places.
```
:::

```quiz
What is the range check `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` for?
- [ ] It keeps the samples inside the hemisphere
- [ ] It replaces the bias for surfaces facing the camera
- [ ] It makes the result a smooth gradient instead of a hard 0 or 1 per sample
- [x] At a fragment near an object's edge, samples land on a surface far behind it; without the check that distant surface would count as occluding – with it, a depth difference much larger than the radius hardly contributes
---
Within the radius the check is 1.0 and the sample counts fully; at twice the radius it's down to about 0.5 and keeps falling. Without it you'd see dark halos around the planet on the back wall.
```

Build and run: the window shows **the raw SSAO texture in grey**. White where nothing occludes: most of the planet, the
floor, the walls. Grey where something does: a contact shadow on the floor right under the planet, a thin grey line
along the edge between the floor and the back wall, a faint band on the planet just above the ring – and the **ring's
underside, dark**, darkest towards its outer edge. The grey areas are dithered in a fine regular pattern: the 4 × 4
noise, each pixel rotated by one of the 16 vectors, the pattern repeating every 4 pixels.

Why is the ring so dark? The ring is a single flat plane whose normal points up (+y), and the camera sees its underside.
SSAO puts the hemisphere of samples on the normal's side – above the ring, which is *behind* the ring's surface as the
camera sees it. So most samples land behind the surface the camera sees there, and count as occluded. learnopengl's
backpack has no such one-sided surfaces. A fix would flip the normal for back faces in the geometry pass
(`gl_FrontFacing` in GLSL, `SV_IsFrontFace` in HLSL); the course keeps learnopengl's shaders.

:::vulkan d3d12
The noise pattern is tiled from the window's **top**, as v runs from the top row down, while in OpenGL it starts at the
bottom: a given pixel gets another of the 16 rotations than in the OpenGL version. The pictures agree overall, but not
pixel for pixel.
:::

## Ambient occlusion blur

Between the SSAO pass and the lighting pass we first want to blur the SSAO texture. The repeating noise pattern of the
random rotations is clearly visible in the raw result, and we want a smooth occlusion. A simple blur shader is enough:
we traverse the surrounding SSAO texels between -2.0 and 2.0 (exclusive), sampling the SSAO texture an amount identical
to the noise texture's dimensions – 4 × 4 – and average the results.

Why exactly 4 × 4? The noise repeats every 4 pixels in both directions, so every 4 × 4 block of pixels contains each of
the 16 rotations exactly once. Averaging such a block averages over all the rotations – the pattern disappears
completely, while a smaller window would leave a part of it. The window is not centred (offsets -2, -1, 0, 1): the
picture moves by half a pixel, which you won't see.

:::opengl
`ssao_blur.fs` is learnopengl's:

```glsl
void main()
{
    vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));
    float result = 0.0;
    for (int x = -2; x < 2; ++x)
    {
        for (int y = -2; y < 2; ++y)
        {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(ssaoInput, TexCoords + offset).r;
        }
    }
    FragColor = result / (4.0 * 4.0);
}
```

The blur gets a framebuffer like `ssaoFBO`: `ssaoBlurFBO` with one `GL_RED` texture, `ssaoColorBufferBlur` (`GL_NEAREST`;
learnopengl's `// and blur stage`). In `main.cpp`: `Shader shaderSSAOBlur("ssao.vs", "ssao_blur.fs");` with
`shaderSSAOBlur.setInt("ssaoInput", 0);`, and the pass after the SSAO pass:

```cpp
        // 3. blur SSAO texture to remove noise
        // ------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, ssaoBlurFBO);
        glClear(GL_COLOR_BUFFER_BIT);
        shaderSSAOBlur.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
        renderQuad();
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The lighting pass now binds `ssaoColorBufferBlur` on unit 3. Now do the task **blur**, and delete the blur's texture and
framebuffer at the end.
:::
:::vulkan
`ssao_blur.frag` is learnopengl's, reading the SSAO image at binding 5:

```glsl
// the SSAO image (binding 5)
layout(binding = 5) uniform sampler2D ssaoInput;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out float outColor;

void main() {
    vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));
    float result = 0.0;
    for (int x = -2; x < 2; ++x) {
        for (int y = -2; y < 2; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(ssaoInput, fragTexCoord + offset).r;
        }
    }
    outColor = result / (4.0 * 4.0);
}
```

The blurred image has the same format as the SSAO image, so it uses the **same render pass**: `createSsaoFramebuffers()`
creates a second image (`ssaoBlurImage`, `VK_FORMAT_R8_UNORM`, colour attachment + sampled) and its view, and reuses
`framebufferInfo` for its framebuffer:

```cpp
        framebufferInfo.pAttachments = &ssaoBlurImageView;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &ssaoBlurFramebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create SSAO blur framebuffer!");
        }
```

The pipeline, too, is made for `ssaoRenderPass`: `createPipeline("shaders/ssao.vert.spv", "shaders/ssao_blur.frag.spv",
ssaoRenderPass, 1, VK_FALSE, ssaoBlurPipeline)`. The blurred image gets binding 6 (the layout's bindings grow to 7, the
pool to 6 samplers, `createDescriptorSet()` writes `ssaoBlurImageView` with `gBufferSampler`). In
`recordCommandBuffer()`, after the SSAO pass, the blur's pass – the SSAO pass's begin info with the other framebuffer:

```cpp
        // 3. blur SSAO texture to remove noise
        VkRenderPassBeginInfo ssaoBlurPassInfo = ssaoPassInfo;
        ssaoBlurPassInfo.framebuffer = ssaoBlurFramebuffer;

        vkCmdBeginRenderPass(commandBuffer, &ssaoBlurPassInfo, VK_SUBPASS_CONTENTS_INLINE);
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, ssaoBlurPipeline);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad(): reads the SSAO image (binding 5)
        vkCmdEndRenderPass(commandBuffer);
```

The render pass's dependencies chain the two passes: the blur's fragment shader waits for the SSAO pass's colour writes.
`ssao_lighting.frag` now reads binding 6: `layout(binding = 6) uniform sampler2D ssao; // the blurred SSAO image`. Now do
the task **blur**, and destroy the blur's image, view, memory, framebuffer and pipeline in `cleanup()`.
:::
:::d3d12
`ssao_blur.hlsl`'s `PSMain` is learnopengl's, with `GetDimensions` for `textureSize`:

```hlsl
float PSMain(PSInput input) : SV_TARGET
{
    float width, height;
    ssaoInput.GetDimensions(width, height);
    float2 texelSize = 1.0f / float2(width, height);
    float result = 0.0f;
    for (int x = -2; x < 2; ++x)
    {
        for (int y = -2; y < 2; ++y)
        {
            float2 offset = float2(float(x), float(y)) * texelSize;
            result += ssaoInput.Sample(clampSampler, input.texCoord + offset).r;
        }
    }
    return result / (4.0f * 4.0f);
}
```

The blur's target, `m_ssaoColorBufferBlur`, is created like `m_ssaoColorBuffer` – `R8_UNORM`, RTV slot `FrameCount + 4`,
SRV slot 10 (the heaps grow to `FrameCount + 5` and `1 + 2 * MaxMeshes + 6`). Its PSO, `m_ssaoBlurPipelineState`, is the
SSAO pass's description with the shaders of `ssao_blur.hlsl`. In `PopulateCommandList`, after the SSAO pass:

```cpp
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBufferBlur.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, barriers);
    CD3DX12_CPU_DESCRIPTOR_HANDLE ssaoBlurRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 4, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &ssaoBlurRtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(ssaoBlurRtvHandle, clearColor, 0, nullptr);
    m_commandList->SetPipelineState(m_ssaoBlurPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE ssaoInput(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 8, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, ssaoInput);
    m_commandList->DrawInstanced(6, 1, 36, 0);
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBufferBlur.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, barriers);
```

The SSAO texture is read as t0 through table 2 – a two-SRV range, so it covers slots 8 and 9; the blur reads only t0. The
lighting pass's table 4 now points at slot 10. Now do the task **blur**.
:::

```quiz
Why does the blur average exactly a 4 × 4 block of texels?
- [x] The noise texture is 4 × 4 and repeats: every 4 × 4 block of pixels contains each of the 16 rotations once, so averaging it removes the noise pattern completely
- [ ] A 4 × 4 block is the largest a fragment shader can read
- [ ] The SSAO target is 4 times smaller than the window
- [ ] Four is the number of channels of the noise texture
---
A smaller block would leave part of the pattern; a larger one would blur the occlusion itself more than needed.
```

Build and run: the window shows **the smooth AO**. The dither is gone; the ring's underside is a soft dark gradient, the
contact shadow under the planet a smooth grey patch, the floor/wall edge a soft line, and the band on the planet above
the ring a little wider and softer. Everything else is still white.

## Applying ambient occlusion

Applying the occlusion factors to the lighting equation is incredibly easy: all we have to do is multiply the
per-fragment ambient occlusion factor to the lighting's ambient component and we're done. Only the ambient light is
occluded – it stands for the light that arrives indirectly, from all around; the direct light from the point light keeps
its own diffuse and specular (without shadows – those would need the shadow maps of the earlier chapters).

:::opengl
In `ssao_lighting.fs`, read the factor and multiply the ambient term by it – learnopengl's lighting shader:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 Diffuse = texture(gAlbedo, TexCoords).rgb;
    float AmbientOcclusion = texture(ssao, TexCoords).r;

    // then calculate lighting as usual
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
```

and remove the "for now" line, so `FragColor = vec4(lighting, 1.0);` is the shader's last word again. Now do the last
task, **apply**.
:::
:::vulkan
In `ssao_lighting.frag`, read the factor and multiply the ambient term by it – learnopengl's lighting shader:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedo, fragTexCoord).rgb;
    float AmbientOcclusion = texture(ssao, fragTexCoord).r;

    // then calculate lighting as usual
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
```

and remove the "for now" line, so `outColor = vec4(lighting, 1.0);` is the shader's last word again. Now do the last
task, **apply**.
:::
:::d3d12
In `ssao_lighting.hlsl`, read the factor and multiply the ambient term by it – learnopengl's lighting shader:

```hlsl
    // retrieve data from gbuffer
    float3 FragPos = gPosition.Sample(clampSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(clampSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedo.Sample(clampSampler, input.texCoord).rgb;
    float AmbientOcclusion = ssao.Sample(clampSampler, input.texCoord).r;

    // then calculate lighting as usual
    float3 ambient = 0.3f * Diffuse * AmbientOcclusion;
```

and restore the end of `PSMain`: `return float4(lighting, 1.0f);` instead of the "for now" line. Now do the last task,
**apply**.
:::

```quiz
Why does the occlusion factor multiply only the ambient term, not the diffuse and specular light?
- [ ] The diffuse and specular terms are computed before the SSAO pass
- [ ] Multiplying them too would make the picture brighter
- [x] Ambient occlusion approximates how much of the indirect light from all around reaches a point; the direct light from the point light depends on whether the light itself is visible – a question for shadows, not for the nearby geometry SSAO samples
- [ ] The SSAO texture has only one channel, and the diffuse term has three
---
In this scene the planet's front gets only ambient light, so that's where the occlusion shows best; the lit parts barely change.
```

Build and run: the lit scene is back, **darker where the AO was grey**. The ring's underside is much darker than before
(its outer parts lose half to two thirds of their brightness), the floor right under the planet has a soft contact
shadow that sets the planet on the floor, and the floor/wall edge is a little darker. The open floor, the walls, the
planet's front and its lit edge are unchanged. That is the solution, and learnopengl's SSAO.

Screen-space ambient occlusion is a highly customizable effect that relies heavily on tweaking its parameters based on
the type of scene. There is no perfect combination of parameters for every type of scene. Some scenes only work with a
small radius, while other scenes require a larger radius and a larger sample count for them to look realistic. The
kernel size, the radius and the bias are the main dials; learnopengl also suggests raising the final occlusion value to
a user-defined power to make the effect stronger (`FragColor = pow(occlusion, power);`). More advanced screen-space
techniques, such as horizon-based ambient occlusion (HBAO), sample the depth buffer along directions and give a more
physically grounded occlusion – but the structure stays the one you built here: a G-buffer, an occlusion pass into a
single-channel target, a blur, and an ambient term that uses it.

That concludes the lessons of the Advanced Lighting part: Blinn-Phong, gamma correction, shadows, normal and parallax
mapping, HDR, bloom, deferred shading and SSAO – the same techniques in every API, each in the place its API gives it.

## Additional resources

:::opengl
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengl's chapter this chapter follows, with the backpack
  scene and pictures of each step.
- [ssao.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/9.ssao/ssao.cpp):
  learnopengl's program.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): the C library's random numbers, `srand` and
  `RAND_MAX`.
:::
:::vulkan
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengl's chapter this chapter follows, with the backpack
  scene and pictures of each step.
- [Texture mapping: Images](https://vulkan-tutorial.com/Texture_mapping/Images): vulkan-tutorial's texture upload through a staging
  buffer, which the noise texture uses.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): the specification's lists of the format features
  every device must support.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): the C library's random numbers, `srand` and
  `RAND_MAX`.
:::
:::d3d12
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengl's chapter this chapter follows, with the backpack
  scene and pictures of each step.
- [UpdateSubresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/updatesubresources2): copying CPU data
  into a texture through an upload buffer.
- [D3D12_STATIC_SAMPLER_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_static_sampler_desc):
  the static samplers of the root signature and their address modes.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): the C library's random numbers, `srand` and
  `RAND_MAX`.
:::
