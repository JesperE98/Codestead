# Exam: Advanced OpenGL

Show what you've learned in *Advanced OpenGL*: the depth and stencil tests, blending, face culling, framebuffers and
post-processing, cube maps, buffers and uniform blocks, geometry shaders, instancing and anti-aliasing. The questions
cover the whole part, some of them for {{api}} in particular. Answer all of them and press **Submit answers**; you need
80 % right to pass, and you can take the exam again.

```quiz
In the *Depth testing* chapter, drawing each fragment's depth value as a grey showed the cubes and the floor almost white, although they are only a few units from the camera. Why?
- [ ] The depth test failed everywhere, so only the clear colour was left
- [ ] The depth buffer stores the distance in units, which is clamped to 1.0
- [x] The stored depth is proportional to 1/z: almost the whole range is used up close to the near plane, so objects a few units away already have values close to 1.0
- [ ] A 32-bit depth buffer has too few bits for darker values
---
With near = 0.1 and far = 100, a depth of 0.5 is only 0.2 units away, and the front of the left cube, 3.5 units away, is already at about 0.97. Linearizing the depth – inverting the projection's equation – gives the real distance.
```

```quiz
The cubes' bottom faces lie exactly on the floor, and you see z-fighting there. Which change also reduces z-fighting in the rest of the scene?
- [ ] Moving the far plane out from 100 to 1000
- [x] Moving the near plane out from 0.1 as far as the scene allows
- [ ] Switching the depth function from LESS to LESS_OR_EQUAL
- [ ] Drawing the floor before the cubes
---
The depth buffer spends most of its precision just in front of the near plane; pushing the near plane out spreads that precision over the scene. Pushing the far plane out does the opposite, and the depth function or the draw order don't change the precision at all. (Lifting the cubes a little would remove this particular tie.)
```

```quiz
Leaving early depth testing aside, in which order does a fragment go through these steps?
- [ ] Depth test → fragment shader → stencil test → blending
- [ ] Stencil test → depth test → blending → fragment shader
- [ ] Fragment shader → blending → depth test → stencil test
- [x] Fragment shader → stencil test → depth test → blending
---
The stencil and depth tests decide whether the fragment's output is kept at all; only a fragment that passes both is blended with the colour buffer. Early depth testing moves the tests before the shader as an optimisation – only possible when the shader doesn't write the depth.
```

:::opengl
```quiz
For the outlines, learnopengl calls `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)` and `glStencilMask(0x00)` before drawing the scaled cubes. What do the two calls do?
- [ ] They write 1 into the stencil buffer wherever the scaled cubes are drawn
- [x] A fragment passes only where the stored value is not 1, and no fragment changes the stencil buffer
- [ ] A fragment passes only where the stored value is 1 – inside the original cubes
- [ ] They clear the stencil buffer to 0 before the scaled cubes are drawn
---
NOTEQUAL with the reference value 1 keeps the fragments outside the cubes' silhouette – the ring. The write mask 0x00 makes every write leave the stored value as it is, so the silhouette stays intact for the second cube.
```
:::
:::vulkan
```quiz
The outlines need the stencil function NOT_EQUAL, the write mask 0x00 and no depth test, while the cubes before them used ALWAYS and 0xFF. How does `recordCommandBuffer()` switch from one to the other?
- [ ] With `vkCmdSetStencilCompareMask` and `vkCmdSetStencilWriteMask` before the outline draws
- [x] By binding `outlinePipeline`: its whole depth and stencil state comes with it
- [ ] By ending the render pass and beginning one without a depth attachment
- [ ] By binding another descriptor set for the outlines
---
The stencil and depth state are baked into each pipeline when it is created (unless declared dynamic). So the project has three pipelines – floor, cubes, outlines – and binding one brings its state along; nothing has to be restored afterwards.
```
:::
:::d3d12
```quiz
Which part of the stencil test is not stored in the PSO, but set on the command list?
- [ ] The stencil function, `StencilFunc`
- [ ] The write mask, `StencilWriteMask`
- [x] The reference value, with `OMSetStencilRef`
- [ ] The operation for "both tests pass", `StencilPassOp`
---
`OMSetStencilRef(1)` before the cubes sets the value that REPLACE writes and that NOT_EQUAL compares with. Everything else – functions, operations, masks – is fixed when the PSO is created, which is why the floor, the cubes and the outlines each have their own PSO.
```
:::

```quiz
With alpha blending (`F_source` = source alpha, `F_destination` = 1 − source alpha), a red fragment (1.0, 0.0, 0.0) with alpha 0.5 is drawn over a blue colour buffer (0.0, 0.0, 1.0). What colour is stored?
- [x] (0.5, 0.0, 0.5)
- [ ] (1.0, 0.0, 1.0)
- [ ] (1.0, 0.0, 0.0)
- [ ] (0.5, 0.0, 1.0)
---
`(1, 0, 0) * 0.5 + (0, 0, 1) * (1 - 0.5) = (0.5, 0, 0.5)`: half of the red, half of the blue that was there before.
```

:::opengl
```quiz
Which calls give learnopengl's alpha blending for the windows?
- [ ] `glEnable(GL_BLEND); glBlendFunc(GL_ONE, GL_ZERO);`
- [ ] `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);` alone – blending is on by default
- [x] `glEnable(GL_BLEND); glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);`
- [ ] `glEnable(GL_BLEND); glBlendEquation(GL_FUNC_SUBTRACT);`
---
Blending is off by default and must be enabled; `glBlendFunc` sets the source and destination factors. `GL_ONE, GL_ZERO` would just replace the colour, and the equation stays `GL_FUNC_ADD`.
```
:::
:::vulkan
```quiz
Which settings of the pipeline's `VkPipelineColorBlendAttachmentState` give alpha blending?
- [x] `blendEnable = VK_TRUE`, `srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, `colorBlendOp = VK_BLEND_OP_ADD`
- [ ] The same factors with `blendEnable = VK_FALSE`: the factors alone switch blending on
- [ ] `srcColorBlendFactor = VK_BLEND_FACTOR_ONE`, `dstColorBlendFactor = VK_BLEND_FACTOR_ZERO`
- [ ] `colorBlendOp = VK_BLEND_OP_MAX`, so that the brighter colour wins
---
Without `blendEnable` the new colour simply replaces the old one, whatever the factors say. ONE and ZERO are exactly that replacement, and MAX isn't transparency at all.
```
:::
:::d3d12
```quiz
Which settings in `psoDesc.BlendState.RenderTarget[0]` give alpha blending?
- [ ] `SrcBlend = D3D12_BLEND_ONE`, `DestBlend = D3D12_BLEND_ZERO` – the defaults
- [ ] The same factors as below with `BlendEnable = FALSE`: the factors alone switch blending on
- [ ] `BlendOp = D3D12_BLEND_OP_MAX`, so that the brighter colour wins
- [x] `BlendEnable = TRUE`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`, `DestBlend = D3D12_BLEND_INV_SRC_ALPHA`, `BlendOp = D3D12_BLEND_OP_ADD`
---
Direct3D calls "one minus" *INV*. Without `BlendEnable` the pixel's colour simply replaces the render target's, whatever the factors say; ONE and ZERO are exactly that replacement.
```
:::

```quiz
A scene has opaque cubes and five semi-transparent windows. Which drawing order gives the right picture?
- [ ] The windows first, sorted from near to far, then the opaque objects
- [x] All opaque objects first, in any order, then the windows sorted from the farthest to the nearest
- [ ] Everything sorted from far to near, with the depth test off
- [ ] The opaque objects, then the windows in any order – the depth test sorts them
---
Blending mixes a window with what is already in the colour buffer, so everything behind it must be there first. The depth test takes care of the opaque objects, but not of windows behind windows: a near window drawn first would store its depth and reject the farther ones.
```

```quiz
Why does the grass use `discard` rather than blending?
- [ ] Blending cannot handle an alpha of exactly 0
- [ ] `discard` turns the depth test off for the grass
- [x] Its texels are either fully opaque or fully transparent, and a discarded fragment writes neither colour nor depth – so the grass needs no sorting
- [ ] `discard` makes the texture clamp at its edges
---
With blending, a transparent texel would still store its depth and hide what is drawn behind it later. Discarded fragments leave no trace at all, so the order doesn't matter – as long as there are no semi-transparent texels.
```

```quiz
What would happen to the grass quads if they were drawn with back-face culling on?
- [x] Each quad would disappear whenever the camera sees it from behind: a single quad has only one side, and from behind it is a back face
- [ ] Nothing: culling only affects closed objects like cubes
- [ ] Their transparent texels would be culled, so `discard` would no longer be needed
- [ ] They would be drawn twice, once for each side
---
Culling knows nothing about objects, only about each triangle's winding on the screen. That's why open surfaces that must be visible from both sides are drawn without culling.
```

:::opengl
```quiz
In the framebuffers project, what does `glBindFramebuffer(GL_FRAMEBUFFER, 0)` after the floor's draw do?
- [ ] It deletes the framebuffer object
- [x] It makes the window's default framebuffer the target again, so the screen quad is drawn into the window
- [ ] It copies `textureColorbuffer` into the window
- [ ] It clears the framebuffer's attachments for the next frame
---
Draw calls go into whatever framebuffer is bound. The scene went into our framebuffer's texture; binding 0 switches back to the window, where the screen quad then shows that texture.
```
:::
:::vulkan
```quiz
After the offscreen render pass, what makes `offscreenImage` ready to be sampled by the screen quad's fragment shader?
- [ ] `vkQueueWaitIdle` between the two render passes
- [ ] Presenting it once with `vkQueuePresentKHR`
- [ ] Nothing: the commands of one command buffer run strictly one after the other
- [x] The pass leaves it in its `finalLayout`, `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, and a subpass dependency makes the following fragment shaders wait for the colour writes
---
Commands may overlap on the GPU unless something orders them. The dependency to `VK_SUBPASS_EXTERNAL` does that, and the render pass transitions the image into the layout a sampled image must have.
```
:::
:::d3d12
```quiz
After the scene has been drawn into `m_offscreenTarget`, what makes it readable for the screen quad's pixel shader?
- [x] A transition barrier from `D3D12_RESOURCE_STATE_RENDER_TARGET` to `D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE`, and its SRV in the descriptor table
- [ ] Calling `OMSetRenderTargets` with the back buffer's RTV is enough
- [ ] `WaitForPreviousFrame()` between the two passes
- [ ] Creating the texture in an upload heap
---
A resource's state must fit its use, and the barrier also makes the GPU finish the writes before the reads begin. At the start of the next frame another barrier turns it back into a render target.
```
:::

```quiz
Why do post-processing effects such as blur first render the scene into a texture?
- [ ] Kernels only work on textures with an alpha channel
- [ ] The window's framebuffer has no colour buffer
- [ ] The texture coordinates are needed to compute the kernel's weights
- [x] While the scene is drawn, a fragment shader only knows its own fragment; to combine a pixel with its neighbours, the finished picture must be readable as a texture
---
Once the whole scene is in a texture, the screen quad's shader can sample any pixel of it – its own and those around it, at `offset = 1.0 / 300.0` – and combine them.
```

```quiz
A 3×3 kernel's weights add up to 0, like the edge-detection kernel. What does it do to an area of uniform colour?
- [ ] It leaves the colour unchanged
- [x] It turns it black
- [ ] It turns it white
- [ ] It inverts the colour
---
If all nine samples have the colour c, the result is c times the sum of the weights: 0. Only where the colour changes – at edges – is something left. A kernel whose weights add up to 1, such as sharpen or blur, keeps uniform areas as they are.
```

```quiz
The skybox is drawn last, its vertex shader returns `pos.xyww`, and the depth function for it is LESS_OR_EQUAL. What does this gain over drawing it first?
- [ ] The sky turns with the camera but never comes closer
- [ ] The sky is drawn over every object, like a background picture
- [x] Its fragment shader only runs where no object covers the sky, because its depth is 1.0 and the depth test rejects the rest early
- [ ] The depth buffer no longer needs to be cleared
---
z = w gives a depth of exactly 1.0 after the perspective division. Where the cubes were drawn, their nearer depth keeps the sky out; where nothing was drawn, the cleared 1.0 lets it pass – that's why the function must include "equal".
```

```quiz
The reflective cubes sample the cube map with `R = reflect(I, N)`. Why does the reflection change when the camera moves, while the skybox around it only changes when the camera turns?
- [ ] The cubes are nearer to the camera than the sky
- [ ] The reflection uses a dynamic cube map that is rendered every frame
- [ ] The skybox is drawn with the depth test off
- [x] `I` is the direction from the camera to the fragment, so it depends on the camera's position; the skybox uses the view matrix without its translation
---
A mirror shows what lies in the reflected viewing direction, and that direction changes as you walk around the cube. The sky itself is treated as infinitely far away: only the camera's rotation reaches its vertices.
```

```quiz
A buffer holds 24 positions (3 floats each) followed by 24 texture coordinates (2 floats each) – the batched layout. A float is 4 bytes. Where does the texture coordinate attribute start, and what is its stride?
- [ ] At byte 12, with a stride of 20 bytes
- [ ] At byte 288, with a stride of 20 bytes
- [x] At byte 288, with a stride of 8 bytes
- [ ] At byte 480, with a stride of 8 bytes
---
The positions take 24 × 12 = 288 bytes, and the texture coordinates follow them, tightly packed: one every 8 bytes. A stride of 20 bytes and an offset of 12 would describe the interleaved layout.
```

:::opengl
```quiz
In a `layout (std140)` uniform block, the members are `float a; vec3 b; float c;`. At which byte offset does `c` start?
- [ ] 4
- [ ] 16
- [x] 28
- [ ] 32
---
`a` is at 0. A `vec3` is aligned to 16 bytes, so `b` starts at 16 and takes 12 bytes, up to 28. A `float` only needs a multiple of 4, so `c` fits right after it, at 28.
```
:::
:::vulkan
```quiz
In a uniform block of Vulkan's GLSL (std140 by default), the members are `float a; vec3 b; float c;`. At which byte offset does `c` start?
- [ ] 4
- [ ] 16
- [x] 28
- [ ] 32
---
`a` is at 0. A `vec3` is aligned to 16 bytes, so `b` starts at 16 and takes 12 bytes, up to 28. A `float` only needs a multiple of 4, so `c` fits right after it, at 28. A plain C++ struct would put `b` at 4 – hence `alignas(16)`.
```
:::
:::d3d12
```quiz
In an HLSL `cbuffer`, the members are `float a; float3 b; float c;`. At which byte offset does `c` start?
- [ ] 4
- [x] 16
- [ ] 28
- [ ] 32
---
HLSL only moves a variable to the next 16-byte register when it would straddle one. `b` fits into the 12 bytes left after `a`, so it starts at 4 and fills the register; `c` starts the next one, at 16. GLSL's std140 would put `b` at 16 and `c` at 28.
```
:::

```quiz
A geometry shader takes a point and outputs a triangle strip of 5 vertices – learnopengl's house. How many triangles does one house have?
- [ ] 1
- [ ] 2
- [x] 3
- [ ] 5
---
In a strip, every vertex after the first two adds a triangle with the two before it: 5 − 2 = 3 – two for the walls and one for the roof.
```

:::opengl
```quiz
What does the project's Shader class need to do to use a geometry shader?
- [ ] Link the geometry shader as a second program and use both programs in the draw call
- [x] Compile the third file as `GL_GEOMETRY_SHADER` and attach it to the same program before linking
- [ ] Call `glEnable(GL_GEOMETRY_SHADER)` before drawing
- [ ] Nothing: OpenGL finds a `.gs` file next to the vertex shader by itself
---
A geometry shader is one more stage of the shader program, between the vertex and the fragment shader. It is compiled and attached like the other two; the program is then linked as usual.
```
:::
:::vulkan
```quiz
What does the Vulkan project need to use a geometry shader?
- [ ] A render pass of its own for the geometry stage
- [ ] A descriptor set that holds the geometry shader module
- [x] The device feature `geometryShader` enabled, and the `.geom` module as one more stage, `VK_SHADER_STAGE_GEOMETRY_BIT`, in the pipeline
- [ ] Nothing beyond compiling the `.geom` file: the pipeline finds it next to the vertex shader
---
Geometry shaders are an optional device feature in Vulkan, so the logical device must enable it. The shader is then simply another `VkPipelineShaderStageCreateInfo` in the pipeline's stages.
```
:::
:::d3d12
```quiz
What does the Direct3D 12 project need to use a geometry shader?
- [x] Compile `GSMain` with the target `gs_5_0` and put it into the PSO as `psoDesc.GS`; `PrimitiveTopologyType` names the shader's input primitive
- [ ] Set it on the command list with a `SetGeometryShader` call before the draw
- [ ] Compile it with `vs_5_0` and append it to the vertex shader's bytecode
- [ ] Change `PrimitiveTopologyType` to `TRIANGLE` for the houses, since the shader outputs triangles
---
The geometry shader is part of the pipeline state like the vertex and pixel shaders. The topology type describes what reaches the geometry shader – points for the houses – not what it emits.
```
:::

```quiz
learnopengl's asteroid field has 100 000 rocks. Why is drawing them with one draw call per rock slow, even though each rock is small?
- [x] Every draw call costs CPU time – the driver prepares and sends commands to the GPU – so the GPU spends most of its time waiting for the next small draw
- [ ] The GPU has to load the rock's vertices from the hard disk again for every draw
- [ ] Each draw call clears the depth buffer
- [ ] A vertex shader can only run a limited number of times per frame
---
Drawing a small mesh is quick for the GPU; preparing the draw is the bottleneck. One instanced draw call hands the GPU the mesh once and the per-instance data (the model matrices) in a buffer, so it can draw all rocks without waiting for the CPU.
```

:::opengl
```quiz
In the `instanced-array` task, what makes attribute 2 (`aOffset`) advance once per instance instead of once per vertex?
- [ ] `glDrawArraysInstanced` does that for every attribute
- [ ] Reading `gl_InstanceID` in the vertex shader
- [ ] `glVertexAttribPointer` with a stride of 0
- [x] `glVertexAttribDivisor(2, 1)`
---
The divisor says after how many instances the attribute moves on to its next element: 0 (the default) means once per vertex, 1 once per instance. The other attributes keep advancing per vertex.
```
:::
:::vulkan
```quiz
In the `instanced-array` task, what makes attribute location 2 (`inOffset`) advance once per instance instead of once per vertex?
- [x] Its vertex binding (1) has `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE`
- [ ] `vkCmdDraw(commandBuffer, 6, 100, 0, 0)` does that for every attribute
- [ ] Reading `gl_InstanceIndex` in the vertex shader
- [ ] Its format, `VK_FORMAT_R32G32_SFLOAT`
---
The input rate belongs to the binding: binding 0 (the quad's vertices) advances per vertex, binding 1 (the offsets) per instance. That's Vulkan's version of OpenGL's `glVertexAttribDivisor(2, 1)`.
```
:::
:::d3d12
```quiz
In the `instanced-array` task, what makes the `OFFSET` input advance once per instance instead of once per vertex?
- [ ] `DrawInstanced(6, 100, 0, 0)` does that for every input
- [ ] Reading `SV_InstanceID` in the vertex shader
- [x] Its input element has `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` with a step rate of 1
- [ ] The instance buffer's view has `StrideInBytes = 0`
---
Each input element says whether it is per-vertex or per-instance data, and the step rate says after how many instances it moves on – Direct3D's version of OpenGL's `glVertexAttribDivisor(2, 1)`.
```
:::

```quiz
With 4× MSAA, a flat green triangle (0.0, 1.0, 0.0) covers 2 of the 4 samples of an edge pixel; the other two keep the background (0.1, 0.1, 0.1). What colour does the pixel get after the resolve?
- [ ] (0.0, 1.0, 0.0)
- [x] (0.05, 0.55, 0.05)
- [ ] (0.1, 0.1, 0.1)
- [ ] (0.0, 0.5, 0.0)
---
The fragment shader ran once and its green was stored in the two covered samples. The resolve averages all four: (2 × green + 2 × background) / 4 – half of each, which is what makes the edge look smooth.
```

:::opengl
```quiz
In the `offscreen-msaa` task, what turns the samples of the multisampled framebuffer into the window's pixels?
- [x] `glBlitFramebuffer` from the multisampled framebuffer (`GL_READ_FRAMEBUFFER`) into the default one (`GL_DRAW_FRAMEBUFFER`), which averages each pixel's samples
- [ ] A screen quad that samples the multisampled texture with `texture()`
- [ ] `glEnable(GL_MULTISAMPLE)`
- [ ] `glfwSwapBuffers`, which resolves every bound framebuffer
---
The blit resolves the multisampled image. For post-processing, learnopengl blits into `intermediateFBO` instead, whose normal texture the screen quad can sample.
```
:::
:::vulkan
```quiz
In the `msaa` task, how does the multisampled picture end up in the swap chain image?
- [ ] `vkCmdBlitImage` after the render pass copies it over
- [x] The swap chain image is the subpass's resolve attachment: at the end of the subpass each pixel's samples are averaged into it
- [ ] The swap chain is created with 4 samples per pixel
- [ ] The fragment shader writes each of the four samples into the swap chain image
---
`pResolveAttachments` names the single-sampled attachment the multisampled colour attachment is resolved into. The multisampled image itself is never presented.
```
:::
:::d3d12
```quiz
Why does the `msaa` task draw into `m_msaaRenderTarget` and call `ResolveSubresource`, instead of creating the swap chain with 4 samples?
- [ ] `ResolveSubresource` is faster than a multisampled swap chain would be
- [ ] A PSO can only draw into a texture, never into a back buffer
- [ ] The back buffer's format doesn't support multisampling
- [x] A flip-model swap chain must have `SampleDesc.Count = 1`, so the samples live in a render target of their own and are resolved into the back buffer
---
The multisampled render target, its depth buffer and the PSO all have 4 samples. `ResolveSubresource`, between barriers to `RESOLVE_SOURCE` and `RESOLVE_DEST`, averages the samples into the single-sampled back buffer.
```
:::

```quiz
Why do the *Anti Aliasing* projects resolve the multisampled image before the post-processing pass?
- [x] A shader can't sample a multisampled image like a normal texture; the resolve averages each pixel's samples into a normal image that the screen quad can sample
- [ ] Resolving doubles the number of samples, which the effect needs
- [ ] The post-processing effect would otherwise remove the anti-aliasing
- [ ] The window can't show an image that has been post-processed
---
The effect – here the grayscale – then works on the already smooth picture, so the edges stay smooth. Reading the individual samples is possible too (learnopengl's custom anti-aliasing), but needs special shader functions.
```
