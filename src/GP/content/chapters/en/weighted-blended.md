# OIT: Weighted Blended

The last chapter ended with three quads: an opaque red one and two half-transparent ones, green and blue, drawn in the
wrong order with depth writes on – so where the green quad covers the blue one, the blue quad is missing. In this
chapter we fix that with *weighted blended order-independent transparency*, the technique Morgan McGuire and Louis
Bavoil published in the *Journal of Computer Graphics Techniques* in 2013. It is an approximation, but a cheap one: one
pass over the transparent geometry into two extra render targets, one full-screen pass to put them together, no sorting
and no per-pixel lists. It has been used in games and engines for particles, smoke, glass and foliage since.

The idea in one sentence: replace the over operator, which depends on the order of the fragments, with a sum and a
product, which don't. Everything else in the chapter is how to compute that sum and that product with fixed-function
blending, and how {{api}} lets you blend differently into two render targets at once.

## Weighted, blended

Recall the over operator from the last chapter: each new fragment with colour `Ci` and alpha `αi` turns the pixel's
colour `C` into `Ci · αi + C · (1 − αi)`. For n transparent layers over an opaque background `C0`, blended correctly
from back to front, the final colour is a nested expression in which each layer's contribution is dimmed by every
layer in front of it. That nesting is what makes the order matter.

McGuire and Bavoil approximate it in two parts. The first part is how much of the background still shows through all
the layers – the *revealage*. That one is exact and order-independent, because it is a product:

```text
revealage = (1 − α1) · (1 − α2) · … · (1 − αn)
```

Two layers of alpha 0.5 reveal 0.5 · 0.5 = 0.25 of the background, in whatever order. The second part is the colour of
the layers themselves. Instead of nesting them, we take a weighted average of their (premultiplied) colours:

```text
                Σ Ci · αi · w(zi, αi)
average  =  -----------------------------
                  Σ αi · w(zi, αi)
```

and blend that average over the background with the coverage `1 − revealage`:

```text
C = average · (1 − revealage) + C0 · revealage
```

Sums and products don't care about the order of their terms: draw the layers in any order and you get the same result.
What the average loses is the occlusion *between* the transparent layers – in sorted blending the nearest layer dims
everything behind it. The weight `w(z, α)` is there to win some of that back: it gives fragments near the camera a
larger weight than those far away, so the nearer layers dominate the average, as they would with sorting. The paper
proposes several weight functions; learnopengl uses this one:

```text
w = clamp(pow(min(1.0, α * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3)
```

where `z` is the fragment's window depth, 0 at the near plane and 1 at the far plane. The alpha factor favours fragments
that cover more (it saturates at α = 0.1, so it only matters for very faint fragments), the depth factor falls steeply
with depth, and the clamp keeps the weights in a range a 16-bit float can add up without overflowing too quickly.

```quiz
Two transparent layers, both with alpha 0.5, cover a pixel. How much of the background does weighted blended OIT let through there, and does it depend on which layer is drawn first?
- [ ] 0.5, from the layer drawn last; yes
- [ ] 0, because two half-covering layers cover everything; no
- [x] 0.25 = (1 − 0.5) · (1 − 0.5); no, a product doesn't depend on the order of its factors
- [ ] 0.25, but only if the nearer layer is drawn first
---
The revealage is the product of all (1 − α): exact and order-independent. The approximation is in the colour, the weighted average of the layers.
```

### Two render targets

The transparent pass computes both parts per pixel with blending alone – no reading of the target in the shader. It
renders into two colour targets at once:

- the **accumulation** target, RGBA in 16-bit floating point, cleared to (0, 0, 0, 0). The fragment shader writes
  `(C · α, α) · w`, and the blend function `ONE, ONE` adds it to what is there. After the pass, its rgb holds
  `Σ Ci · αi · wi` and its alpha `Σ αi · wi` – numerator and denominator of the average. They exceed 1.0 easily (the
  weights reach 3000), hence floating point.
- the **revealage** target, a single 8-bit channel, cleared to 1. The fragment shader writes `α`, and the blend function
  `ZERO, ONE_MINUS_SRC_COLOR` turns it into `dst = 0 · α + dst · (1 − α)`: each fragment multiplies the target by its
  `1 − α`. After the pass, it holds the revealage.

The two targets need *different* blend functions in the same draw call. That is the one requirement of the technique on
the hardware, and each API has a switch for it – we'll get to it in the transparent pass.

A third pass, the **composite** pass, reads both targets, divides the accumulated colour by the accumulated alpha and
blends the average over the opaque picture with the ordinary over operator and an alpha of `1 − revealage`. Over
operator with alpha `a = 1 − revealage` gives `average · (1 − revealage) + C0 · revealage` – exactly the formula above.

The frame then has four steps, the four passes of learnopengl's program:

1. **Solid pass**: the opaque objects into an off-screen "opaque" colour target with a depth buffer.
2. **Transparent pass**: the transparent objects into the accumulation and revealage targets, depth-tested against the
   opaque depth but without writing it.
3. **Composite pass**: a full-screen quad that blends the transparent result over the opaque target.
4. **Final pass**: a full-screen quad that copies the opaque target to the window.

The project is the last chapter's: the camera at (0, 0, 5), the red opaque quad at (0.5, -0.2, 1.0), the green quad
(alpha 0.5) at (-0.3, -0.6, 2.0) – the nearest – and the blue quad (alpha 0.5) at (-0.6, 0.5, 0.0) – the farthest,
partly behind the red one – drawn red, green, blue. learnopengl's demo puts the three quads on top of each other in the
middle of the window; the course spreads them out so that every case is visible.

:::opengl
The program asks for an OpenGL 4.2 core context (learnopengl's): `glBlendFunci`, a blend function per colour
attachment, is core since OpenGL 4.0, and `layout (binding = N)` on samplers in GLSL needs 4.2 – all shaders start with
`#version 420 core`. The rest of the course uses 3.3. macOS stops at 4.1: there you would ask for 4.1, write
`#version 410 core` and set the composite shader's two sampler units from C++ with `compositeShader.setInt("accum", 0)`
and `setInt("reveal", 1)` instead of `layout (binding = …)`.
:::
:::vulkan
learnopengl's render states – depth test, depth writes, blend function – are pipeline state in Vulkan, so the project
has one helper that creates a pipeline with all of them:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkRenderPass pipelineRenderPass, uint32_t colorAttachmentCount,
                        VkBool32 depthTestEnable, VkBool32 depthWriteEnable, VkBool32 blendEnable,
                        VkBlendFactor srcBlendFactor0, VkBlendFactor dstBlendFactor0, VkBlendFactor srcBlendFactor1, VkBlendFactor dstBlendFactor1,
                        VkPipeline& pipeline)
```

It sets the depth compare op to `LESS`, `VK_BLEND_OP_ADD` (learnopengl's `glBlendEquation(GL_FUNC_ADD)`) and blends the
alpha channel with the same factors as the colour, like `glBlendFunc` does. learnopengl's uniforms `mvp` and `color` are
push constants (`struct PushConstants { glm::mat4 mvp; glm::vec4 color; }`), and learnopengl's framebuffers become
render passes with framebuffers made for them – four render passes per frame, recorded one after the other in
`recordCommandBuffer()`.
:::
:::d3d12
learnopengl's render states are pipeline state in DirectX 12: each pass gets a pipeline state object of its own,
created in `LoadAssets` from one `D3D12_GRAPHICS_PIPELINE_STATE_DESC` that is changed step by step. learnopengl's
uniforms `mvp` and `color` are root constants (root parameter 0: `struct ObjectConstants { XMFLOAT4X4 mvp; XMFLOAT4
color; }`). The start already has what the screen quads need: root parameter 1, a descriptor table of two SRVs (t0, t1)
for the pixel shader, a static sampler s0 (linear, clamp), and the descriptor heaps at their final sizes – the RTV heap
with `FrameCount + 3` slots (the back buffers, then the opaque, accumulation and revealage textures), the SRV heap with 3
(slot 0 opaque, 1 accumulation, 2 revealage) and the DSV heap with the depth buffer (`D32_FLOAT`). Each off-screen
texture rests in the state `PIXEL_SHADER_RESOURCE` and is turned into a `RENDER_TARGET` by a barrier for the pass that
draws into it.
:::

The `// TODO:` comments in the project mark where your code goes; you build and run the program in your IDE.

## The opaque pass

The opaque objects are drawn as always: depth test on, depth writes on, no blending. The difference is where they go.
learnopengl renders them into a framebuffer of its own – a floating-point colour texture and a depth texture – rather
than into the window. Two reasons: the transparent pass has to test against *this* depth buffer, so it must be one you
can attach to another framebuffer (the window's depth buffer can't be shared with an off-screen framebuffer in OpenGL),
and the composite pass blends into this colour target. At the end of the frame a final pass copies the opaque texture to
the window.

:::opengl
The opaque framebuffer, learnopengl's setup:

```cpp
    // set up the opaque framebuffer and its texture attachments
    // ------------------------------------------------------------------
    unsigned int opaqueFBO;
    glGenFramebuffers(1, &opaqueFBO);

    unsigned int opaqueTexture;
    glGenTextures(1, &opaqueTexture);
    glBindTexture(GL_TEXTURE_2D, opaqueTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_HALF_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glBindTexture(GL_TEXTURE_2D, 0);

    unsigned int depthTexture;
    glGenTextures(1, &depthTexture);
    glBindTexture(GL_TEXTURE_2D, depthTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glBindTexture(GL_TEXTURE_2D, 0);

    glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, opaqueTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTexture, 0);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Opaque framebuffer is not complete!" << std::endl;

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The depth is a *texture* rather than a renderbuffer because the transparent framebuffer will attach the same texture
in the next task. In the render loop, bind `opaqueFBO` before the solid pass clears; the solid pass then draws the red
quad into it as before. After everything, the final pass draws the opaque texture to the window:

```cpp
        // draw to backbuffer (final pass)
        // -----

        // set render states
        glDisable(GL_DEPTH_TEST);
        glDepthMask(GL_TRUE); // enable depth writes so glClear won't ignore clearing the depth buffer
        glDisable(GL_BLEND);

        // bind backbuffer
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

        // use screen shader
        screenShader.use();

        // draw final screen quad
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, opaqueTexture);
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

Note the comment on `glDepthMask(GL_TRUE)`: `glClear` respects the depth write mask. The transparent pass will turn
depth writes off, and if they were still off here, the next frame's `glClear` would leave the depth buffer as it is.
The screen shader (`Shader screenShader("screen.vs", "screen.fs");`) samples the texture at the quad's texture
coordinates.

Now do the first task, **opaque-pass**: create the shader, the framebuffer and its two textures, bind it for the solid
pass, add the final pass, and delete the textures and the framebuffer at the end.
:::
:::vulkan
The opaque framebuffer becomes a render pass of its own, `opaqueRenderPass`, with two attachments: a colour attachment
in `VK_FORMAT_R16G16B16A16_SFLOAT` (learnopengl's `GL_RGBA16F`) and a depth attachment in `findDepthFormat()`. Both are
cleared at the start and **stored** at the end – later passes use them again:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // learnopengl: GL_RGBA16F
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass

        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // the transparent pass tests against it
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

For now the colour ends in `SHADER_READ_ONLY_OPTIMAL`, because the final pass samples it right after. The render pass
gets two subpass dependencies: before the pass, wait until the previous frame has finished using the images (the final
pass read the colour, the transparent pass tested against the depth); after it, a fragment shader that samples the
colour waits for the colour writes (`COLOR_ATTACHMENT_OUTPUT` / `COLOR_ATTACHMENT_WRITE` →
`FRAGMENT_SHADER` / `SHADER_READ`). These dependencies are what OpenGL's driver works out for you when you bind a
texture that was just rendered to.

`createOpaqueFramebuffer()` creates the images – `opaqueImage` (colour attachment **and** sampled usage) and
`opaqueDepthImage` (learnopengl's `depthTexture`; the window keeps its own `depthImage`) – their views and
`opaqueFramebuffer`. The solid and transparent pipelines are now created for `opaqueRenderPass`, and a new pipeline for
the final pass, for the window's `renderPass`, without depth test or blending:

```cpp
        // final pass: no depth test, no blending
        createPipeline("shaders/screen.vert.spv", "shaders/screen.frag.spv", renderPass, 1, VK_FALSE, VK_FALSE, VK_FALSE,
            VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, screenPipeline);
```

The screen shader reads the opaque image through a descriptor set. The start has a descriptor set layout with two
combined image samplers (bindings 0 and 1 – the composite pass will need both), a pool, the sampler
`colorBufferSampler` (linear, clamp to edge) and the helper `createDescriptorSet(firstView, secondView, set)`; the final
pass uses `createDescriptorSet(opaqueImageView, opaqueImageView, screenDescriptorSet)` (binding 1 is unused by
`screen.frag`).

In `recordCommandBuffer()` the solid pass now begins `opaqueRenderPass` with `opaqueFramebuffer` (clear values (0, 0, 0,
0) and depth 1.0), and after the transparent quads comes the final pass in the window's render pass:

```cpp
        // use screen shader
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);

        // draw final screen quad
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);
```

The screen quad uses the same six vertices as the three quads, uv unchanged: in Vulkan both the window's y and an
image's v point down, so the image comes out upright.

Now do the first task, **opaque-pass**: the render pass, the images and framebuffer, the screen pipeline and descriptor
set, the two render passes in `recordCommandBuffer()`, and the cleanup of the new objects.
:::
:::d3d12
The opaque framebuffer becomes a texture with two views: a render target view (the pass draws into it) and a shader
resource view (the final pass reads it). It is a committed resource in a default heap with the flag
`ALLOW_RENDER_TARGET`, created in `PIXEL_SHADER_RESOURCE` with an optimised clear value:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        const float zeroFillerVec[] = { 0.0f, 0.0f, 0.0f, 0.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R16G16B16A16_FLOAT, zeroFillerVec);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_opaqueTexture)));
```

Its RTV goes into RTV heap slot `FrameCount` (after the swap chain's buffers), its SRV into SRV heap slot 0. The depth
buffer is the one the start already has. The solid pipeline state now renders into the texture's format,
`psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT` – the transparent one is derived from it – and the final pass
gets a pipeline state of its own, `m_screenPipelineState`, compiled from `screen.hlsl`: no blending, `DepthEnable =
FALSE`, one target in the back buffer's `DXGI_FORMAT_R8G8B8A8_UNORM` and `DSVFormat = DXGI_FORMAT_UNKNOWN`.

In `PopulateCommandList` the solid pass begins with a barrier that turns the texture into a render target, binds it with
the depth buffer and clears both:

```cpp
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_opaqueTexture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);
    CD3DX12_CPU_DESCRIPTOR_HANDLE opaqueRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle);
```

At the end, the final pass: two barriers at once (the opaque texture back to `PIXEL_SHADER_RESOURCE`, the back buffer
from `PRESENT` to `RENDER_TARGET`), the back buffer bound without a depth buffer and cleared, then the screen quad with
the table at the start of the SRV heap (t0 = the opaque texture):

```cpp
    // use screen pipeline state, with the opaque texture (t0): the table starts at slot 0
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(1, m_srvHeap->GetGPUDescriptorHandleForHeapStart());

    // draw final screen quad
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

Now do the first task, **opaque-pass**: the texture and its two views, the screen pipeline state and the new format of
the solid one, and the barriers, targets and final pass in `PopulateCommandList`.
:::

Build and run: **nothing changes** in the picture – that is the point. The transparent quads are still blended the
ordinary way, now into the opaque target instead of the window, and the blue quad's corner is still missing under the
green one. Only where the green quad covers the red one does the value move by one step (128 instead of 127 in the red
channel): the 16-bit float target rounds differently from an 8-bit window.

```quiz
Why does the frame render the opaque objects into an off-screen target instead of straight into the window?
- [ ] Because the window cannot hold the colour of an opaque object
- [x] Because the transparent pass must test against the opaque objects' depth buffer, and the composite pass blends into the opaque colour target – both have to be targets the program can bind again in later passes
- [ ] Because the over operator needs floating-point numbers
- [ ] Because the opaque objects must be sorted from back to front
---
The transparent pass shares the opaque pass's depth (tested, not written) so that transparent fragments behind opaque objects are rejected; the composite pass then blends into the opaque picture. The final pass only copies the result to the window.
```

## The transparent pass

Now the heart of the technique. The transparent quads go into the accumulation and revealage targets, with three
render states that differ from the solid pass:

- **Depth test on, depth writes off.** The test against the opaque depth rejects transparent fragments behind opaque
  objects – the blue quad stays hidden behind the red one. Without writes, transparent fragments never hide each other.
- **A blend function per target.** Accumulation: `ONE, ONE` (add). Revealage: `ZERO, ONE_MINUS_SRC_COLOR` (multiply by
  `1 − α`).
- **Different clear values per target.** Accumulation starts at 0 (nothing added), revealage at 1 (everything visible).

The fragment shader is the same in every API: the weight, then the two outputs.

:::opengl
`transparent.fs` gets two outputs instead of one:

```glsl
// shader outputs
layout (location = 0) out vec4 accum;
layout (location = 1) out float reveal;

// material color (alpha = opacity)
uniform vec4 color;

void main()
{
    // weight function
    float weight = clamp(pow(min(1.0, color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    // store pixel color accumulation
    accum = vec4(color.rgb * color.a, color.a) * weight;

    // store pixel revealage threshold
    reveal = color.a;
}
```

`gl_FragCoord.z` is the fragment's window depth, the value that goes into the depth buffer. The transparent
framebuffer has two colour textures – `accumTexture` (`GL_RGBA16F`) and `revealTexture` (`GL_R8`, one 8-bit channel) –
and attaches the opaque framebuffer's `depthTexture` as its depth:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, accumTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, revealTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTexture, 0); // opaque framebuffer's depth texture

    const GLenum transparentDrawBuffers[] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glDrawBuffers(2, transparentDrawBuffers);
```

`glDrawBuffers` you know from the *Bloom* chapter: output location 0 goes to attachment 0, location 1 to attachment 1.
Unlike the draw buffers, the blend state is global, but since OpenGL 4.0 it can be set per draw buffer with
`glBlendFunci(buf, src, dst)`. In the render loop, the ordinary blending is replaced by the transparent pass's states:

```cpp
        // configure render states
        glDepthMask(GL_FALSE);
        glEnable(GL_BLEND);
        glBlendFunci(0, GL_ONE, GL_ONE);
        glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR);
        glBlendEquation(GL_FUNC_ADD);

        // bind transparent framebuffer to render transparent objects
        glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO);
        glClearBufferfv(GL_COLOR, 0, &zeroFillerVec[0]);
        glClearBufferfv(GL_COLOR, 1, &oneFillerVec[0]);
```

`glClear` would clear both colour attachments to the same `glClearColor`; `glClearBufferfv(GL_COLOR, i, value)` clears
draw buffer `i` to a value of its own – `zeroFillerVec` and `oneFillerVec` are `glm::vec4(0.0f)` and `glm::vec4(1.0f)`.
The depth buffer is not cleared: it holds the red quad.

```quiz
What does `glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR)` do that `glBlendFunc` cannot?
- [ ] It blends the revealage texture with a 16-bit float precision
- [ ] It makes the blend function depend on the fragment's depth
- [ ] It turns blending on for draw buffer 1 only
- [x] It sets the blend function of draw buffer 1 alone, so that draw buffer 0 can keep `GL_ONE, GL_ONE` in the same draw call
---
`glBlendFunc` sets the same function for every draw buffer. Per-buffer blend functions are core since OpenGL 4.0 (and the extension ARB_draw_buffers_blend before that) – the reason this chapter's program asks for a 4.x context.
```

Now do the second task, **transparent-pass**: the framebuffer with its two textures and the shared depth, the two
filler vectors, the states and clears before the green and blue quads, the shader, and the cleanup.
:::
:::vulkan
`transparent.frag` gets two outputs instead of one; the colour comes from the push constants:

```glsl
// shader outputs
layout(location = 0) out vec4 accum;
layout(location = 1) out float reveal;

// material color
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    // weight function
    float weight = clamp(pow(min(1.0, pc.color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    // store pixel color accumulation
    accum = vec4(pc.color.rgb * pc.color.a, pc.color.a) * weight;

    // store pixel revealage threshold
    reveal = pc.color.a;
}
```

The weight uses `gl_FragCoord.z` exactly as learnopengl's shader does. With `GLM_FORCE_DEPTH_ZERO_TO_ONE`, Vulkan's
window depth is the same value as OpenGL's for the same point – OpenGL maps its -1..1 NDC depth to 0..1, Vulkan's
projection produces 0..1 directly – so the weights are the same.

The transparent framebuffer is a render pass with three attachments: the accumulation image
(`VK_FORMAT_R16G16B16A16_SFLOAT`) and the revealage image (`VK_FORMAT_R8_UNORM`), both cleared and stored and left in
`SHADER_READ_ONLY_OPTIMAL` for the composite pass, and the opaque pass's depth image – **loaded**, not cleared:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD; // the opaque objects' depth
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

The initial layout is the one the opaque pass left the image in. The subpass has two colour references (output
location 0 → accum, 1 → reveal, learnopengl's `glDrawBuffers`) and the depth at index 2; `createTransparentFramebuffer()`
creates the two images and a framebuffer of `accumImageView`, `revealImageView` and `opaqueDepthImageView`.

The blend functions belong to the pipeline: a `VkPipelineColorBlendAttachmentState` per colour attachment. By default
Vulkan requires all of them to be **identical**; different ones need the device feature `independentBlend` –
learnopengl's `glBlendFunci` in Vulkan terms. Almost every desktop GPU has it, but you have to check for it in
`isDeviceSuitable` (`supportedFeatures.independentBlend`) and enable it when you create the device:

```cpp
        deviceFeatures.independentBlend = VK_TRUE; // a different blend function per colour attachment (glBlendFunci)
```

Then the transparent pipeline is created for the new render pass, with two attachments, depth test on, depth writes off,
and the two pairs of factors:

```cpp
        // transparent objects: depth test against the opaque depth, no depth writes; a blend function per attachment
        // (learnopengl's glBlendFunci): accum ONE, ONE (add up), reveal ZERO, ONE_MINUS_SRC_COLOR (multiply by 1 - alpha)
        createPipeline("shaders/transparent.vert.spv", "shaders/transparent.frag.spv", transparentRenderPass, 2, VK_TRUE, VK_FALSE, VK_TRUE,
            VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, VK_BLEND_FACTOR_ONE_MINUS_SRC_COLOR, transparentPipeline);
```

In `recordCommandBuffer()` the opaque pass now ends after the red quad, and the transparent pass begins with its own
clear values – learnopengl's two `glClearBufferfv` calls:

```cpp
        // accum starts at 0 (nothing added yet), reveal at 1 (everything behind fully visible); the depth is loaded
        std::array<VkClearValue, 3> transparentClearValues{};
        transparentClearValues[0].color = {{0.0f, 0.0f, 0.0f, 0.0f}};
        transparentClearValues[1].color = {{1.0f, 1.0f, 1.0f, 1.0f}};
```

The third value belongs to the depth attachment; it must be there (clear values are indexed by attachment), but with
`loadOp LOAD` it is ignored.

```quiz
Why does the transparent pipeline need the device feature `independentBlend`?
- [ ] Because blending into a floating-point image is an optional feature
- [ ] Because the depth attachment is loaded instead of cleared
- [x] Because its two colour attachments have different blend states, and without the feature all `VkPipelineColorBlendAttachmentState`s of a pipeline must be identical
- [ ] Because the fragment shader writes two outputs
---
Two outputs into two attachments are always allowed (that is what the subpass's colour references are for); only different blend states per attachment are optional. Desktop GPUs support it, but the device has to be created with it.
```

Now do the second task, **transparent-pass**: the feature, the render pass, images and framebuffer, the pipeline, the
two render passes in `recordCommandBuffer()`, the shader, and the cleanup.
:::
:::d3d12
`transparent.hlsl`'s pixel shader gets two outputs instead of one. In HLSL, a pixel shader writes several render
targets by returning a struct whose members carry the semantics `SV_TARGET0`, `SV_TARGET1`, …:

```hlsl
// The pixel shader's two outputs: SV_TARGET0 goes to the first render target (accum),
// SV_TARGET1 to the second (reveal).
struct PSOutput
{
    float4 accum : SV_TARGET0;
    float reveal : SV_TARGET1;
};

// The pixel shader: the weighted, premultiplied colour into accum and the opacity into reveal.
PSOutput PSMain(PSInput input)
{
    PSOutput output;

    // weight function: input.position.z is the fragment's depth (0 at the near plane, 1 at
    // the far plane - learnopengl's gl_FragCoord.z)
    float weight = clamp(pow(min(1.0f, color.a * 10.0f) + 0.01f, 3.0f) * 1e8 * pow(1.0f - input.position.z * 0.9f, 3.0f), 1e-2, 3e3);

    // store pixel color accumulation
    output.accum = float4(color.rgb * color.a, color.a) * weight;

    // store pixel revealage threshold
    output.reveal = color.a;

    return output;
}
```

`SV_POSITION.z` in the pixel shader is the depth that goes into the depth buffer, 0..1 like OpenGL's window depth, so the
weights are the same. The two textures are created like the opaque one – accumulation in
`DXGI_FORMAT_R16G16B16A16_FLOAT` (clear value 0), revealage in `DXGI_FORMAT_R8_UNORM` (clear value 1) – with RTVs in
slots `FrameCount + 1` and `+ 2` and SRVs in slots 1 and 2.

The blend functions belong to the pipeline state's `BlendState`, which has a `RenderTarget[8]` array – but by default
Direct3D uses `RenderTarget[0]` for **every** target. `IndependentBlendEnable = TRUE` makes it use each entry for its own
target; that is learnopengl's `glBlendFunci`:

```cpp
        psoDesc.DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO;
        psoDesc.NumRenderTargets = 2;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R8_UNORM;
        // Each render target blends in its own way: IndependentBlendEnable makes Direct3D use
        // RenderTarget[1] for the second target (otherwise every target uses RenderTarget[0]).
        psoDesc.BlendState.IndependentBlendEnable = TRUE;
        // accum: glBlendFunci(0, GL_ONE, GL_ONE) - the colours are added up.
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[0].SrcBlendAlpha = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].DestBlendAlpha = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        // reveal: glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR) - the target is multiplied
        // by (1 - alpha) of every fragment. (Alpha factors cannot be _COLOR factors in
        // Direct3D: INV_SRC_ALPHA does the same for the alpha channel, which R8 does not have.)
        psoDesc.BlendState.RenderTarget[1].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[1].SrcBlend = D3D12_BLEND_ZERO;
        psoDesc.BlendState.RenderTarget[1].DestBlend = D3D12_BLEND_INV_SRC_COLOR;
        psoDesc.BlendState.RenderTarget[1].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[1].SrcBlendAlpha = D3D12_BLEND_ZERO;
        psoDesc.BlendState.RenderTarget[1].DestBlendAlpha = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[1].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[1].RenderTargetWriteMask = D3D12_COLOR_WRITE_ENABLE_ALL;
```

`D3D12_DEPTH_WRITE_MASK_ZERO` is `glDepthMask(GL_FALSE)`; the depth test (LESS) stays on. In `PopulateCommandList` the
transparent pass turns both textures into render targets, binds **both** at once with the solid pass's depth buffer and
clears each to its own value – learnopengl's two `glClearBufferfv` calls:

```cpp
    m_commandList->OMSetRenderTargets(2, transparentRtvHandles, FALSE, &dsvHandle);
    const float oneFillerVec[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(transparentRtvHandles[0], zeroFillerVec, 0, nullptr);
    m_commandList->ClearRenderTargetView(transparentRtvHandles[1], oneFillerVec, 0, nullptr);
```

The depth buffer is not cleared: it holds the red quad. After the blue quad, two barriers turn both textures back into
`PIXEL_SHADER_RESOURCE` for the composite pass.

```quiz
What happens if the transparent pipeline state sets `RenderTarget[1]` but leaves `IndependentBlendEnable` FALSE?
- [x] Direct3D ignores `RenderTarget[1]` and blends the revealage target with `RenderTarget[0]`'s ONE / ONE as well – 1 + α clamps to 1 in the 8-bit target, the revealage stays 1, and the composite pass discards every pixel
- [ ] The pipeline state cannot be created, because two render targets need independent blending
- [ ] The second render target is not written at all
- [ ] Nothing: Direct3D detects that the two entries differ and uses each for its own target
---
Without `IndependentBlendEnable`, only `RenderTarget[0]` counts, for every target. Two render targets with the same blending are allowed – the flag is only needed when they differ.
```

Now do the second task, **transparent-pass**: the pipeline state, the two textures with their views, the barriers,
targets and clears in `PopulateCommandList`, and the shader.
:::

Build and run: the green and blue quads are **gone**. They are drawn – into two targets that nothing shows yet. The
window shows only the red quad on black. The next pass brings them back.

```quiz
The revealage target is cleared to 1 and blended with the factors ZERO (source) and ONE_MINUS_SRC_COLOR (destination). The shader writes the fragment's alpha. What does the target hold after the green and the blue quad (both alpha 0.5) have been drawn over the same pixel?
- [ ] 1.0: the source factor ZERO throws the shader's output away
- [x] 0.25: each fragment multiplies the target by 1 − 0.5
- [ ] 0.5: only the last fragment counts
- [ ] 0.0: the alphas add up to 1
---
The blend computes src · 0 + dst · (1 − src). The source colour only enters through the destination factor – that is how fixed-function blending multiplies the target by (1 − α), in any order.
```

## The composite pass

The composite pass turns the two targets into one colour and blends it over the opaque picture. It draws a full-screen
quad into the opaque target with ordinary alpha blending (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`), and the depth test must not
reject it – learnopengl sets `glDepthFunc(GL_ALWAYS)`. The shader, learnopengl's `composite.fs`, step by step:

1. Read the revealage and the accumulation **of the same pixel**. The targets have the window's size, so the shader
   reads texel `ivec2(gl_FragCoord.xy)` directly – `texelFetch`, no filtering, no texture coordinates needed.
2. If the revealage is 1, no transparent fragment touched this pixel: `discard`, which saves the blending and the second
   read.
3. If the accumulated colour overflowed to infinity – a 16-bit float tops out at 65504, and with weights up to 3000 a
   few dozen fragments are enough – replace it by the accumulated alpha, so that the average stays finite.
4. Divide the accumulated colour by the accumulated alpha (at least a small epsilon, against dividing by zero): the
   weighted average colour.
5. Output the average with alpha `1 − revealage`: the blending puts it over the opaque colour with exactly the weights
   of McGuire and Bavoil's formula.

:::opengl
```glsl
// color accumulation buffer
layout (binding = 0) uniform sampler2D accum;

// revealage threshold buffer
layout (binding = 1) uniform sampler2D reveal;

// epsilon number
const float EPSILON = 0.00001f;

// calculate floating point numbers equality accurately
bool isApproximatelyEqual(float a, float b)
{
    return abs(a - b) <= (abs(a) < abs(b) ? abs(b) : abs(a)) * EPSILON;
}

// get the max value between three values
float max3(vec3 v)
{
    return max(max(v.x, v.y), v.z);
}

void main()
{
    // fragment coordination
    ivec2 coords = ivec2(gl_FragCoord.xy);

    // fragment revealage
    float revealage = texelFetch(reveal, coords, 0).r;

    // save the blending and color texture fetch cost if there is not a transparent fragment
    if (isApproximatelyEqual(revealage, 1.0f))
        discard;

    // fragment color
    vec4 accumulation = texelFetch(accum, coords, 0);

    // suppress overflow
    if (isinf(max3(abs(accumulation.rgb))))
        accumulation.rgb = vec3(accumulation.a);

    // prevent floating point precision bug
    vec3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);

    // blend pixels
    frag = vec4(average_color, 1.0f - revealage);
}
```

`layout (binding = 0)` sets the sampler's texture unit in the shader itself – the reason for the 4.2 context. In the
render loop, the composite pass sits between the transparent pass and the final pass:

```cpp
        // set render states
        glDepthFunc(GL_ALWAYS);
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        // bind opaque framebuffer
        glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);

        // use composite shader
        compositeShader.use();

        // draw screen quad
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, accumTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, revealTexture);
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

`glBlendFunc` (without the `i`) sets the same function for every draw buffer again; the opaque framebuffer has only one.
The depth test is still enabled from the solid pass, and depth writes are still off from the transparent pass – with
`GL_ALWAYS` the quad passes everywhere and leaves the depth buffer alone.

Now do the last task, **composite**: the shader object, the pass in the render loop, and `composite.fs`.
:::
:::vulkan
`composite.frag` is learnopengl's shader with Vulkan's binding syntax, which is the same as GLSL 4.2's:

```glsl
// color accumulation buffer
layout(binding = 0) uniform sampler2D accum;

// revealage threshold buffer
layout(binding = 1) uniform sampler2D reveal;
```

followed by `EPSILON`, `isApproximatelyEqual`, `max3` and the `main` of the steps above – `texelFetch(reveal, coords, 0)`
at `ivec2(gl_FragCoord.xy)`, the `discard`, the `isinf` guard, `average_color` and `frag = vec4(average_color, 1.0 -
revealage)`.

The pass draws into the opaque colour image again, after the transparent pass. In Vulkan that is a third render pass,
`compositeRenderPass`, with one attachment: the opaque colour image, **loaded** (it holds the red quad) and left in
`SHADER_READ_ONLY_OPTIMAL` for the final pass:

```cpp
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD; // keep the solid objects: the composite blends over them
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL; // as the solid pass left it
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
```

Since the composite pass now uses the image as an attachment again, the opaque render pass must leave it in
`COLOR_ATTACHMENT_OPTIMAL` instead of `SHADER_READ_ONLY_OPTIMAL` – change its `finalLayout`. The composite render pass's
first dependency waits for the solid pass's colour writes before blending reads them (`COLOR_ATTACHMENT_READ`), the
second makes the final pass's shader wait for the composite's writes. learnopengl's `glDepthFunc(GL_ALWAYS)` becomes
simply *no depth test*: the composite render pass has no depth attachment at all, and its framebuffer,
`compositeFramebuffer`, only `opaqueImageView`. The pipeline:

```cpp
        // composite pass: no depth test (learnopengl: GL_ALWAYS), the usual alpha blending over the opaque image
        createPipeline("shaders/composite.vert.spv", "shaders/composite.frag.spv", compositeRenderPass, 1, VK_FALSE, VK_FALSE, VK_TRUE,
            VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, compositePipeline);
```

and `createDescriptorSet(accumImageView, revealImageView, compositeDescriptorSet)` – accum at binding 0, reveal at
binding 1. In `recordCommandBuffer()`, between the transparent pass and the final pass:

```cpp
        compositePassInfo.clearValueCount = 0; // loadOp LOAD: nothing to clear

        vkCmdBeginRenderPass(commandBuffer, &compositePassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // use composite shader
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, compositePipeline);

        // draw screen quad (accum at binding 0, reveal at binding 1)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &compositeDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);

        vkCmdEndRenderPass(commandBuffer); // the opaque image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

Now do the last task, **composite**: the render pass and framebuffer, the opaque pass's new final layout, the pipeline
and descriptor set, the pass in `recordCommandBuffer()`, `composite.frag`, and the cleanup.
:::
:::d3d12
`composite.hlsl`'s pixel shader is learnopengl's with HLSL's names. `texelFetch(tex, coords, 0)` is `Texture2D.Load`,
which takes the texel's column and row and the mip level in one `int3`, and `gl_FragCoord.xy` is `SV_POSITION.xy`:

```hlsl
// color accumulation buffer: register t0, the first SRV of root parameter 1's table
Texture2D accum : register(t0);

// revealage threshold buffer: register t1, the second SRV
Texture2D reveal : register(t1);

// epsilon number
static const float EPSILON = 0.00001f;

// calculate floating point numbers equality accurately
bool isApproximatelyEqual(float a, float b)
{
    return abs(a - b) <= (abs(a) < abs(b) ? abs(b) : abs(a)) * EPSILON;
}

// get the max value between three values
float max3(float3 v)
{
    return max(max(v.x, v.y), v.z);
}

// The pixel shader: the average colour of the transparent fragments, with alpha = how much
// of what is behind them they cover.
float4 PSMain(PSInput input) : SV_TARGET
{
    // fragment coordination: the pixel's column and row (SV_POSITION's x and y)
    int2 coords = int2(input.position.xy);

    // fragment revealage: Load reads one texel without filtering (learnopengl's texelFetch)
    float revealage = reveal.Load(int3(coords, 0)).r;

    // save the blending and color texture fetch cost if there is not a transparent fragment
    if (isApproximatelyEqual(revealage, 1.0f))
        discard;

    // fragment color
    float4 accumulation = accum.Load(int3(coords, 0));

    // suppress overflow
    if (isinf(max3(abs(accumulation.rgb))))
        accumulation.rgb = accumulation.aaa;

    // prevent floating point precision bug
    float3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);

    // blend pixels
    return float4(average_color, 1.0f - revealage);
}
```

The pipeline state: the depth function `D3D12_COMPARISON_FUNC_ALWAYS` (learnopengl's `glDepthFunc(GL_ALWAYS)`; depth
writes stay off from the transparent one), one target in the opaque texture's format, `RTVFormats[1] =
DXGI_FORMAT_UNKNOWN` again, and a fresh blend description with ordinary alpha blending in `RenderTarget[0]`:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
```

In `PopulateCommandList`, after the transparent pass's barriers, the opaque texture is bound again (with the depth
buffer, which the test ignores), and the descriptor table of root parameter 1 starts at SRV heap slot 1, so that t0 is
the accumulation texture and t1 the revealage texture:

```cpp
    // bind the opaque texture again (with the depth buffer: the depth test always passes)
    m_commandList->OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle);

    // use composite pipeline state, with accum (t0) and reveal (t1): root parameter 1's
    // table starts at SRV heap slot 1
    m_commandList->SetPipelineState(m_compositePipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE accumAndReveal(m_srvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(1, accumAndReveal);

    // draw screen quad
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

The final pass's table started at slot 0 (t0 = the opaque texture): the same table of two SRVs, read from a different
place in the heap.

Now do the last task, **composite**: the pipeline state, the pass in `PopulateCommandList`, and `composite.hlsl`.
:::

Build and run. The transparent quads are back, and the blue quad's lower left corner now shows through the green quad.
Where the two overlap (around (230, 300)) the pixel is (0, 96, 96): both quads count. Let's check: both weights are
3000 here (the quiz below explains why), so each quad adds `(C · 0.5, 0.5) · 3000` to the accumulation – the sum is
`(0, 1500, 1500, 3000)` and the average `(0, 0.5, 0.5)`. The revealage is `0.5 · 0.5 = 0.25`, the alpha `0.75`, and over
black that is `(0, 0.375, 0.375)` – 96 out of 255. Everywhere else the picture is what sorted blending would give: green over the red
quad, green and blue over the background, and the blue quad still hidden behind the red one (the shared depth). And it no
longer matters in which order the green and blue quads are drawn – swap the two draws and the picture stays the same.

```quiz
In the overlap the result is (0, 96, 96), while correctly sorted blending (blue first, then the nearer green) would give (0, 128, 64). Why does weighted blended OIT give the two quads the same share here?
- [x] Their weights are equal: both depths are close to 1, so the depth factor makes both weights larger than 3000 and the clamp cuts them to 3000
- [ ] The weight function ignores the depth
- [ ] The revealage target has only 8 bits
- [ ] The composite pass divides by the number of fragments instead of the sum of the weights
---
With near = 0.1 and far = 100, a quad 3 to 5 units away has a window depth of about 0.97–0.98, and 1e8 · (1 − 0.9z)³ is still over 100 000 – far above the clamp. With equal weights, the average gives the layers equal shares, where sorted blending would let the nearer green layer dominate. That is the approximation.
```

## What it gets wrong

Weighted blended OIT trades exactness for speed, and it is worth knowing where the trade shows:

- **The nearest layer doesn't dominate as it should.** The average replaces the occlusion between transparent layers.
  The weight function gives nearer layers more weight, but only relative to each other, and only in the depth range for
  which it was tuned – as the overlap above shows, where the clamp makes two quads at different depths count equally.
  McGuire and Bavoil give several weight functions for different depth ranges; a scene usually needs its own.
- **Strongly opaque layers.** A layer with alpha 0.9 in front of another should hide it almost completely. In the average
  the one behind still contributes its weighted share of the colour – the result looks washed out.
- **Many overlapping layers.** The sums grow, and the 16-bit floats lose precision or overflow (the `isinf` guard). The
  weights' clamp range is a compromise between the two.
- **No refraction, no coloured transmission.** Each layer covers the background by its alpha, the same for all colours.
  A red glass that lets only red light through, or a lens that bends what is behind it, needs other techniques; the
  paper's authors extended the method for coloured transmission and diffusion later.
- **Order still matters elsewhere.** Opaque objects must be drawn first, and transparent fragments behind them are
  rejected by the depth test, as before. Only the order *among* the transparent objects stops mattering.

What you get in return: one geometry pass, no sorting, a fixed amount of memory (two screen-sized targets) and one
full-screen pass – and correct results wherever only one transparent layer covers a pixel, and plausible ones where
several do. For particles, foliage and glass in a game that is often the best trade there is.

## Additional resources

- [OIT: Weighted Blended](https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended): learnopengl's guest article
  this chapter follows. It links McGuire and Bavoil's paper, which explains the weight functions and their depth ranges.

:::opengl
- [weighted_blended.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2020/oit/weighted_blended.cpp):
  learnopengl's program, with the three quads on top of each other.
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): `glBlendFunc` and
  `glBlendFunci`, the blend function per draw buffer.
- [glClearBuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBuffer.xhtml): clearing one draw buffer
  to a value of its own.
:::
:::vulkan
- [VkPipelineColorBlendAttachmentState](https://registry.khronos.org/vulkan/specs/latest/man/html/VkPipelineColorBlendAttachmentState.html):
  the blend state per colour attachment, and the rule that they must be identical without `independentBlend`.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial on attachments, load and store operations and subpasses.
:::
:::d3d12
- [D3D12_BLEND_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_blend_desc):
  `IndependentBlendEnable` and the `RenderTarget` array.
- [Load (DirectX HLSL Texture Object)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-load):
  reading one texel without a sampler.
:::
