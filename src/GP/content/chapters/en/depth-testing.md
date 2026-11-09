# Depth testing

This chapter starts a new part of the course: *Advanced OpenGL*. It keeps learnopengl.com's name in every API, but
nothing in it is specific to OpenGL: depth and stencil tests, blending and face culling exist in Vulkan and
DirectX 12 just as well, and every chapter of this part shows them for the API you chose – {{api}}. What changes
between the APIs is mostly *where* the settings live: OpenGL keeps them in a global state machine that you switch
with calls like `glEnable` and `glDepthFunc`, while Vulkan and DirectX 12 bake them into a pipeline object that you
create up front and bind before drawing.

In the coordinate systems chapter we rendered a 3D container and made use of a depth buffer to prevent triangles
rendering in the front while they're supposed to be behind other triangles. In this chapter we're going to elaborate
a bit more on those depth values the depth buffer (or z-buffer) stores and how it actually determines if a fragment
is in front.

The depth buffer is a buffer that, just like the color buffer (that stores all the fragment colors: the visual
output), stores information per fragment and has the same width and height as the color buffer. Depth values are
typically stored as 16, 24 or 32 bit floats or fixed-point numbers; most systems use a depth buffer with a precision
of 24 or 32 bits.

:::opengl
In OpenGL the depth buffer is created automatically by the windowing system: GLFW asks for a 24-bit depth buffer by
default (the window hint `GLFW_DEPTH_BITS`), together with an 8-bit stencil buffer that the next chapter needs.
:::
:::vulkan
In Vulkan the depth buffer is your own image, as in vulkan-tutorial's *Depth buffering* chapter: `depthImage`, its
memory and `depthImageView`, created in `createDepthResources()` with the format that `findDepthFormat()` picks – here
`VK_FORMAT_D32_SFLOAT`, a 32-bit float per pixel. It is the render pass's second attachment.
:::
:::d3d12
In Direct3D 12 the depth buffer is your own resource, `m_depthStencil`: a texture as big as the window in the format
`DXGI_FORMAT_D32_FLOAT` (a 32-bit float per pixel), with a depth stencil view (DSV) in its own descriptor heap, bound
with `OMSetRenderTargets` next to the render target.
:::

When depth testing is enabled, the GPU tests the depth value of a fragment against the content of the depth buffer.
It performs a depth test and if this test passes, the fragment is rendered and the depth buffer is updated with the
new depth value. If the depth test fails, the fragment is discarded.

Depth testing is done in screen space after the fragment shader has run (and after the stencil test, which we'll
get to in the next chapter). The screen space coordinates relate directly to the viewport: the fragment's window
position and its depth.

:::opengl
GLSL gives you these coordinates in the fragment shader as the built-in vector `gl_FragCoord`: its x and y are the
fragment's window position (with (0, 0) in the bottom-left corner), its z is the fragment's depth value. That z is the
value that is compared to the depth buffer's content.
:::
:::vulkan
GLSL gives you these coordinates in the fragment shader as the built-in vector `gl_FragCoord`: its x and y are the
fragment's window position (in Vulkan with (0, 0) in the top-left corner), its z is the fragment's depth value. That z
is the value that is compared to the depth buffer's content.
:::
:::d3d12
HLSL gives you these coordinates in the pixel shader through the input with the semantic `SV_POSITION`: the
`float4 position : SV_POSITION` that the vertex shader wrote as a clip-space position arrives in the pixel shader as
the pixel's window position in x and y (with (0, 0) in the top-left corner) and its depth value in z – the same thing
as GLSL's `gl_FragCoord`. That z is the value that is compared to the depth buffer's content.
:::

Today most GPUs support a hardware feature called *early depth testing*. Early depth testing allows the depth test to
run before the fragment shader runs. Whenever it is clear a fragment isn't going to be visible (it is behind other
objects) we can prematurely discard the fragment. Fragment shaders are usually quite expensive, so wherever we can
avoid running them we should. A restriction on the fragment shader for early depth testing is that you shouldn't
write to the fragment's depth value: if a fragment shader writes its own depth, the GPU can't know the depth in
advance.

:::opengl
(GLSL can write the depth through `gl_FragDepth`; doing so turns early depth testing off for that shader.)
:::
:::vulkan
(GLSL can write the depth through `gl_FragDepth`; doing so turns early depth testing off for that shader. That is also
why the render pass's dependency names two stages: `VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT` and
`VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT` – the tests before and after the fragment shader.)
:::
:::d3d12
(HLSL can write the depth through an output with the semantic `SV_Depth`; doing so turns early depth testing off for
that shader.)
:::

```quiz
Why does early depth testing require that the fragment shader doesn't write its own depth value?
- [ ] Because the fragment shader runs on a different part of the GPU than the depth test
- [x] The test runs *before* the fragment shader; if the shader could change the depth, the value tested early might not be the one the fragment ends up with
- [ ] Because the depth buffer is read-only while a fragment shader runs
---
Early depth testing is an optimisation: hidden fragments are thrown away before their (expensive) shader runs. That only works if the depth is known beforehand – which is the case when it simply comes from the rasterised triangle, not when the shader computes it.
```

:::opengl
Depth testing is disabled by default, so to enable it we enable it with the `GL_DEPTH_TEST` option:

```cpp
    glEnable(GL_DEPTH_TEST);
```

Once enabled, OpenGL automatically stores fragments' z-values in the depth buffer if they passed the depth test and
discards fragments if they failed the depth test accordingly. If you have depth testing enabled you should also clear
the depth buffer before each frame using `GL_DEPTH_BUFFER_BIT`; otherwise you're stuck with the depth values from the
last frame:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

There are certain scenarios imaginable where you want to perform the depth test on all fragments and discard them
accordingly, but *not* update the depth buffer. Basically, you're (temporarily) using a *read-only* depth buffer.
OpenGL allows us to disable writing to the depth buffer by setting its depth mask to `GL_FALSE`:

```cpp
glDepthMask(GL_FALSE);
```

Note that this only has effect if depth testing is enabled.
:::
:::vulkan
In Vulkan there is nothing to enable globally: the depth test is part of each graphics pipeline, in its
`VkPipelineDepthStencilStateCreateInfo`. This project's `createPipeline()` fills it in as vulkan-tutorial does:

```cpp
        VkPipelineDepthStencilStateCreateInfo depthStencil{};
        depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
        depthStencil.depthTestEnable = VK_TRUE;
        depthStencil.depthWriteEnable = VK_TRUE;
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS; // keep the fragment if it is nearer than the stored depth
        depthStencil.depthBoundsTestEnable = VK_FALSE;
        depthStencil.stencilTestEnable = VK_FALSE;
```

`depthTestEnable` is OpenGL's `glEnable(GL_DEPTH_TEST)`. The depth buffer is cleared at the start of the render pass,
because its attachment has `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR`; the value comes from the second clear value in
`recordCommandBuffer()` – OpenGL's `GL_DEPTH_BUFFER_BIT` in `glClear`:

```cpp
        clearValues[1].depthStencil = {1.0f, 0};
```

There are certain scenarios imaginable where you want to perform the depth test on all fragments and discard them
accordingly, but *not* update the depth buffer. Basically, you're (temporarily) using a *read-only* depth buffer.
That is `depthWriteEnable = VK_FALSE` – OpenGL's `glDepthMask(GL_FALSE)` – in the pipeline you draw those objects
with.
:::
:::d3d12
In Direct3D 12 there is nothing to enable globally: the depth test is part of each pipeline state object (PSO), in
its `DepthStencilState`. This project's `LoadAssets` starts from the defaults and writes the depth function out:

```cpp
        // The default depth stencil state: depth test on, depth writes on. DepthFunc
        // compares a pixel's depth with the one in the depth buffer: LESS (the default)
        // keeps the pixel only if it is nearer than the one already there.
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;
```

The default state has `DepthEnable = TRUE` – OpenGL's `glEnable(GL_DEPTH_TEST)`. The depth buffer is cleared in
`PopulateCommandList` before drawing – OpenGL's `GL_DEPTH_BUFFER_BIT` in `glClear`:

```cpp
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

There are certain scenarios imaginable where you want to perform the depth test on all fragments and discard them
accordingly, but *not* update the depth buffer. Basically, you're (temporarily) using a *read-only* depth buffer.
That is `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` – OpenGL's `glDepthMask(GL_FALSE)` – in the PSO you draw those
objects with.
:::

## Depth test function

{{api}} allows us to modify the comparison operators it uses for the depth test. This allows us to control when the
GPU should pass or discard fragments and when to update the depth buffer.

:::opengl
We can set the comparison operator (or depth function) by calling `glDepthFunc`:

```cpp
glDepthFunc(GL_LESS);
```

The function accepts several comparison operators:

| Function | Description |
|---|---|
| `GL_ALWAYS` | The depth test always passes. |
| `GL_NEVER` | The depth test never passes. |
| `GL_LESS` | Passes if the fragment's depth value is less than the stored depth value. |
| `GL_EQUAL` | Passes if the fragment's depth value is equal to the stored depth value. |
| `GL_LEQUAL` | Passes if the fragment's depth value is less than or equal to the stored depth value. |
| `GL_GREATER` | Passes if the fragment's depth value is greater than the stored depth value. |
| `GL_NOTEQUAL` | Passes if the fragment's depth value is not equal to the stored depth value. |
| `GL_GEQUAL` | Passes if the fragment's depth value is greater than or equal to the stored depth value. |

By default the depth function `GL_LESS` is used that discards all the fragments that have a depth value higher than
or equal to the current depth buffer's value.
:::
:::vulkan
The comparison operator (or depth function) is the pipeline's `depthCompareOp`, a `VkCompareOp`:

| Function | Description |
|---|---|
| `VK_COMPARE_OP_ALWAYS` | The depth test always passes. |
| `VK_COMPARE_OP_NEVER` | The depth test never passes. |
| `VK_COMPARE_OP_LESS` | Passes if the fragment's depth value is less than the stored depth value. |
| `VK_COMPARE_OP_EQUAL` | Passes if the fragment's depth value is equal to the stored depth value. |
| `VK_COMPARE_OP_LESS_OR_EQUAL` | Passes if the fragment's depth value is less than or equal to the stored depth value. |
| `VK_COMPARE_OP_GREATER` | Passes if the fragment's depth value is greater than the stored depth value. |
| `VK_COMPARE_OP_NOT_EQUAL` | Passes if the fragment's depth value is not equal to the stored depth value. |
| `VK_COMPARE_OP_GREATER_OR_EQUAL` | Passes if the fragment's depth value is greater than or equal to the stored depth value. |

Vulkan has no default here: you always choose one. `VK_COMPARE_OP_LESS` is OpenGL's default `GL_LESS`, and it is what
vulkan-tutorial uses. Because the operator is baked into the pipeline when it is created, using a different depth
function for some objects means a second pipeline (or, since Vulkan 1.3, the dynamic state
`VK_DYNAMIC_STATE_DEPTH_COMPARE_OP` with `vkCmdSetDepthCompareOp`; this course keeps it in the pipeline, like
vulkan-tutorial).
:::
:::d3d12
The comparison operator (or depth function) is the PSO's `DepthStencilState.DepthFunc`, a `D3D12_COMPARISON_FUNC`:

| Function | Description |
|---|---|
| `D3D12_COMPARISON_FUNC_ALWAYS` | The depth test always passes. |
| `D3D12_COMPARISON_FUNC_NEVER` | The depth test never passes. |
| `D3D12_COMPARISON_FUNC_LESS` | Passes if the pixel's depth value is less than the stored depth value. |
| `D3D12_COMPARISON_FUNC_EQUAL` | Passes if the pixel's depth value is equal to the stored depth value. |
| `D3D12_COMPARISON_FUNC_LESS_EQUAL` | Passes if the pixel's depth value is less than or equal to the stored depth value. |
| `D3D12_COMPARISON_FUNC_GREATER` | Passes if the pixel's depth value is greater than the stored depth value. |
| `D3D12_COMPARISON_FUNC_NOT_EQUAL` | Passes if the pixel's depth value is not equal to the stored depth value. |
| `D3D12_COMPARISON_FUNC_GREATER_EQUAL` | Passes if the pixel's depth value is greater than or equal to the stored depth value. |

The default state (`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)`) uses `D3D12_COMPARISON_FUNC_LESS`, like OpenGL's
default `GL_LESS`. Because the function is baked into the PSO when it is created, using a different depth function
for some objects means a second PSO, selected with `SetPipelineState` before those draws.
:::

Let's see the effect that changing the depth function has on the visual output. This chapter's project is
learnopengl's depth-testing scene: two textured cubes standing on a textured floor, with no lighting. The cubes use
the image `marble.png`, the floor `metal.png`; the floor's texture coordinates go up to 2, so its image repeats. The
camera is the one of the *Camera* chapter, at (0, 0, 3) looking down -z; the cubes stand at (-1, 0, -1) and (2, 0, 0),
so the left cube is in full view and only the left face of the right cube shows at the window's right edge. The draw
order is learnopengl's: cube 0, cube 1, and the floor last.

:::opengl
The project has learnopengl's two VAOs, `cubeVAO` (36 vertices: position + texture coordinates) and `planeVAO` (the
floor's 6 vertices at y = -0.5), one shader (`depth_testing.vs` / `depth_testing.fs`) and the `loadTexture` function
of the lighting chapters. In the render loop each object binds its VAO and its texture and sets its model matrix:

```cpp
        // cubes
        glBindVertexArray(cubeVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        shader.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        shader.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // floor
        glBindVertexArray(planeVAO);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        shader.setMat4("model", glm::mat4(1.0f));
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

`glEnable(GL_DEPTH_TEST);` is already there; below it, a `// TODO:` comment marks where the depth function goes.
Until you set one, OpenGL's default `GL_LESS` is used.
:::
:::vulkan
The project is the program of the earlier chapters, with a few changes that the whole *Advanced OpenGL* part keeps.
A vertex is now `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }`, and **one vertex buffer** holds both of
learnopengl's meshes: the cube's 36 vertices (0..35) and the floor's 6 (36..41). Where OpenGL binds another VAO, each
draw here picks its part of the buffer with the `firstVertex` parameter of `vkCmdDraw`. The texture coordinates are
learnopengl's with v flipped (`1 - v`, for the floor `2 - v`), as in the *Textures* chapter, so the images are upright.

The descriptor set layout is vulkan-tutorial's: the uniform buffer (view and projection) at binding 0, a combined
image sampler at binding 1. There is **one descriptor set per texture**, `cubeDescriptorSet` and `floorDescriptorSet`,
and binding the right one before a draw is Vulkan's `glBindTexture`. The model matrix is a push constant:

```cpp
        // cubes
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // floor
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &floorDescriptorSet, 0, nullptr);
        constants.model = glm::mat4(1.0f);
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the floor's 6 vertices start at vertex 36
```

`loadTexture(path, image, memory, view)` loads `textures/marble.png` and `textures/metal.png`, and one sampler with
`VK_SAMPLER_ADDRESS_MODE_REPEAT` serves both. There is one pipeline, built from `shaders/depth_testing.vert` and
`.frag`. This project has no `// TODO:` comments: the tasks change lines that are already there.
:::
:::d3d12
The project follows the earlier chapters, with a few changes that the whole *Advanced OpenGL* part keeps. **One
vertex buffer** holds both of learnopengl's meshes: the cube's 36 vertices (0..35) and the floor's 6 (36..41). Where
OpenGL binds another VAO, each draw here picks its part of the buffer with the third parameter of `DrawInstanced`, the
start vertex. The texture coordinates are learnopengl's with v flipped (`1 - v`, for the floor `2 - v`), because
Direct3D's v = 0 is the image's top row.

Each texture has an SRV in the CBV/SRV heap (the CBV in slot 0, marble in slot 1, metal in slot 2), and root
parameter 2 is a one-SRV descriptor table that is pointed at the right slot before each draw – Direct3D's
`glBindTexture`. The model matrix goes in root constants (root parameter 0):

```cpp
    // cubes: the marble texture (root parameter 2) and a model matrix each (root parameter 0)
    ModelConstants modelConstants = {};
    m_commandList->SetGraphicsRootDescriptorTable(2, cubeTexture);
    XMMATRIX model = XMMatrixTranslation(-1.0f, 0.0f, -1.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixTranslation(2.0f, 0.0f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // floor: the metal texture, no model transformation, 6 vertices from vertex 36 on
    m_commandList->SetGraphicsRootDescriptorTable(2, floorTexture);
    model = XMMatrixIdentity();
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(6, 1, 36, 0);
```

`cubeTexture` and `floorTexture` are the GPU handles of heap slots 1 and 2. The static sampler s0 wraps, so the floor's
image repeats. The shaders are in `depth_testing.hlsl`. This project has no `// TODO:` comments: the tasks change
lines that are already there.
:::

Press **Build & run** (Ctrl+Enter) to see the start picture in the built-in simulator: two marble cubes on a metal
floor whose far edge forms the horizon.

Now we set the depth function to "always": every fragment passes the depth test.

:::opengl
```cpp
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_ALWAYS); // always pass the depth test (same effect as glDisable(GL_DEPTH_TEST))
```

The comment is learnopengl's, and it is true for the picture: with `GL_ALWAYS` the test passes, so the colour of the
last fragment drawn stays. (Strictly speaking, the two aren't identical: with `GL_ALWAYS` the depth buffer is still
written, with the depth test disabled it isn't.)
:::
:::vulkan
In `createPipeline()`:

```cpp
        depthStencil.depthCompareOp = VK_COMPARE_OP_ALWAYS; // always pass the depth test (same effect as depthTestEnable = VK_FALSE)
```

The comment is true for the picture: with ALWAYS the test passes, so the colour of the last fragment drawn stays.
(Strictly speaking, the two aren't identical: with ALWAYS the depth buffer is still written, with the depth test
disabled it isn't.)
:::
:::d3d12
In `LoadAssets`, the PSO's depth function:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS;    // always pass the depth test: the last draw wins
```

With ALWAYS the test passes, so the colour of the last pixel drawn stays – the same effect as `DepthEnable = FALSE`
for the picture. (Strictly speaking, the two aren't identical: with ALWAYS the depth buffer is still written, with
the depth test disabled it isn't.)
:::

Now do the task **depth-always** and press **Build & run**. This simulates the same behavior we'd get if we didn't
enable depth testing. The depth test always passes so the fragments that are drawn last are rendered in front of the
fragments that were drawn before, even though they should've been at the front. Since we've drawn the floor last, the
floor's fragments overwrite each of the container's fragments wherever they cover them: the lower parts of both
cubes, below the horizon, now show the metal floor. And inside each cube, the faces drawn later (the back, the sides,
the top) cover the front face, so the upper part of the left cube no longer looks like its front.

```quiz
With the depth function ALWAYS, why does the floor cover the lower half of the cubes – although it lies behind them?
- [ ] Because the floor's depth values are smaller than the cubes'
- [ ] Because ALWAYS makes the GPU sort the triangles from back to front
- [x] Every fragment passes, so the last one drawn into a pixel stays – and the floor is drawn after the cubes
---
With ALWAYS the stored depth is never consulted: only the drawing order decides. The floor covers the cubes only where it lies on screen – below the horizon – and above it the cubes' own later faces win.
```

:::opengl
```quiz
`glDepthFunc(GL_ALWAYS);` is called once, before the render loop. Why does it affect every draw in every frame?
- [x] OpenGL is a state machine: the depth function is global state that stays set until it is changed again
- [ ] `glDepthFunc` is stored in the VAO that is bound
- [ ] It is part of the shader program, so every draw with `shader` uses it
---
Settings like `glEnable(GL_DEPTH_TEST)` and `glDepthFunc` change OpenGL's context state. Every draw call uses whatever state is current at that moment – to draw one object with another depth function you would call `glDepthFunc` again before it.
```
:::
:::vulkan
```quiz
Where is the depth function decided in Vulkan, and when does a change take effect?
- [x] In the pipeline's `VkPipelineDepthStencilStateCreateInfo`: it is baked in when `createPipeline()` creates the pipeline, and every draw with that pipeline uses it
- [ ] In the render pass: `depthAttachment.loadOp` decides how fragments are compared
- [ ] In the depth image's view: `VK_IMAGE_ASPECT_DEPTH_BIT` selects the comparison
---
Vulkan pipelines are immutable. To draw some objects with another depth function you create a second pipeline and bind it before those draws (or, since Vulkan 1.3, make the compare op dynamic state).
```
:::
:::d3d12
```quiz
Where is the depth function decided in Direct3D 12, and when does a change take effect?
- [x] In the PSO's `DepthStencilState`: it is baked in when `CreateGraphicsPipelineState` creates the PSO, and every draw with that PSO uses it
- [ ] In `ClearDepthStencilView`: the clear value selects the comparison
- [ ] In the depth stencil view: its `Format` decides how pixels are compared
---
A PSO is immutable. To draw some objects with another depth function you create a second PSO and select it with `SetPipelineState` before those draws.
```
:::

Then set the depth function back to "less" – a fragment passes when it is nearer than the depth stored so far:

:::opengl
```cpp
    glDepthFunc(GL_LESS); // pass when the fragment is closer than the stored depth (OpenGL's default)
```
:::
:::vulkan
```cpp
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS; // keep the fragment if it is nearer than the stored depth
```
:::
:::d3d12
```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;
```
:::

Do the task **depth-less** and press **Build & run**: the start picture is back, with the cubes standing in front of
the floor.

## Depth value precision

The depth buffer contains depth values between `0.0` and `1.0` and it compares its content with the z-values of all
the objects in the scene as seen from the viewer. These z-values in view space can be any value between the
projection-frustum's `near` and `far` plane. We thus need some way to transform these view-space z-values to the range
of `[0,1]` and one way is to linearly transform them. The following (linear) equation transforms the z-value to a
depth value between `0.0` and `1.0`:

```text
F_depth = (z - near) / (far - near)
```

Here `near` and `far` are the near and far values we used to provide to the projection matrix to set the visible
frustum (in this project 0.1 and 100). The equation takes a depth value z within the frustum and transforms it to the
range `[0,1]`: a z of `near` gives `0.0`, a z of `far` gives `1.0`.

In practice however, a linear depth buffer like this is almost never used. Because of projection properties a
non-linear depth equation is used that is proportional to `1/z`. The result is that we get enormous precision when z
is small and much less precision when z is far away.

Think about this for a second: do we really want depth values that are 1000 units away to have the same precision as
highly-detailed objects at a distance of 1? The linear equation doesn't take this into account.

Since the non-linear function is proportional to `1/z`, z-values between 1.0 and 2.0 result in depth values between
1.0 and 0.5, which is half of the `[0,1]` range of a float, giving us enormous precision at small z-values. Z-values
between 50.0 and 100.0 would account for only 2% of the float's range – this is exactly what we want. Such an
equation, that also takes near and far distances into account, is given below:

```text
F_depth = (1/z - 1/near) / (1/far - 1/near)
```

Don't worry if you don't know exactly what is going on with this equation. The important thing to remember is that
the values in the depth buffer are not linear in clip-space (they are linear in view-space before the projection
matrix is applied). A value of `0.5` in the depth buffer does not mean the pixel's z-value is halfway in the frustum;
the z-value of the vertex is actually quite close to the near plane. With this project's near = 0.1 and far = 100, a
depth of 0.5 is only 0.2 units from the camera, and a depth of 0.9 is still less than 1 unit away: almost the whole
range of the depth buffer is spent on the first unit in front of the camera.

This equation is embedded in the projection matrix. The projection matrix produces the depth in normalized device
coordinates, and the viewport transform maps it to the depth buffer's range:

:::opengl
OpenGL's projection matrix (`glm::perspective`) maps the frustum to NDC z values from `-1` (near) to `1` (far); the
viewport transform then maps `-1..1` to the depth range `0..1` (set by `glDepthRange`, `0..1` by default). The value
that ends up in the depth buffer is exactly `F_depth` above.
:::
:::vulkan
Vulkan's NDC z runs from `0` (near) to `1` (far): `GLM_FORCE_DEPTH_ZERO_TO_ONE`, defined at the top of `main.cpp`,
makes `glm::perspective` produce that range. The viewport's `minDepth = 0.0f` and `maxDepth = 1.0f` keep it as it is,
so NDC z *is* the depth buffer's value – exactly `F_depth` above. (OpenGL gets the same value by a different route:
NDC z from `-1` to `1`, which its viewport transform then maps to `0..1`.)
:::
:::d3d12
Direct3D's NDC z runs from `0` (near) to `1` (far), and `XMMatrixPerspectiveFovRH` produces that range. The viewport's
depth range `0..1` (`CD3DX12_VIEWPORT`'s defaults for `m_viewport`: `MinDepth` 0, `MaxDepth` 1) keeps it as it is, so NDC z *is* the depth buffer's value
– exactly `F_depth` above. (OpenGL gets the same value by a different route: NDC z from `-1` to `1`, which its
viewport transform then maps to `0..1`.)
:::

The effect of this non-linear equation quickly becomes apparent when we try to visualize the depth buffer.

```quiz
With near = 0.1 and far = 100, how far from the camera is a fragment whose depth buffer value is 0.5?
- [ ] About 50 units – halfway between the near and the far plane
- [ ] About 10 units
- [x] About 0.2 units – just in front of the near plane
- [ ] It depends on the size of the window
---
The depth is proportional to 1/z, not to z. Solving `0.5 = (1/z - 10) / (0.01 - 10)` gives z ≈ 0.2: half of the depth buffer's values are used between 0.1 and 0.2 units.
```

## Visualizing the depth buffer

We know that the z-value of the built-in fragment position in the fragment shader contains the depth value of that
particular fragment. If we were to output this depth value of the fragment as a color we could display the depth
values of all the fragments in the scene:

:::opengl
```glsl
    // FragColor = texture(texture1, TexCoords);
    FragColor = vec4(vec3(gl_FragCoord.z), 1.0); // the fragment's depth value: 0.0 at the near plane, 1.0 at the far plane
```

This goes into `depth_testing.fs`; keep the texture line as a comment so that you can switch back later.
:::
:::vulkan
In `shaders/depth_testing.frag`:

```glsl
void main() {
    // the fragment's depth in the depth buffer (0.0 at the near plane, 1.0 at the far plane) as a grey
    outColor = vec4(vec3(gl_FragCoord.z), 1.0);
}
```
:::
:::d3d12
In `PSMain`, in `depth_testing.hlsl`, the texture sample makes way for the pixel's depth:

```hlsl
    // In the pixel shader, SV_POSITION is the pixel's position in the window (x, y)
    // and its depth (z: 0 at the near plane, 1 at the far plane), like GLSL's gl_FragCoord.
    return float4(input.position.zzz, 1.0f);
```

`input.position.zzz` is a *swizzle*: a `float3` with the z component three times.
:::

Now do the task **visualize-depth** and press **Build & run**. If you'd then run the program you'll probably notice
that everything is white, making it look like all of our depth values are the maximum depth value of `1.0`. So why
aren't any of the depth values closer to `0.0` and thus darker?

In the previous section we described that depth values in screen space are non-linear, e.g. they have a very high
precision for small z-values and a low precision for large z-values. The depth value of the fragment increases rapidly
over distance so almost all the vertices have values close to `1.0`. The front of the left cube is 3.5 units away,
and its depth is already about 0.97; the floor lies between 0.93 and 0.98. If we were to carefully move really close to an
object you may eventually see the colors getting darker, their z-values becoming smaller. Only the background stays as
it was: no fragments are drawn there, so it keeps the clear colour.

This clearly shows the non-linearity of the depth value. Objects close by have a much larger effect on the depth
value than objects far away. Moving only a few inches can result in the colors going from dark to completely white.

We can, however, transform the non-linear depth values of the fragment back to its linear sibling. To achieve this we
basically need to reverse the process of projection for the depth values alone.

:::opengl
This means we have to first re-transform the depth values from the range `[0,1]` to normalized device coordinates in
the range `[-1,1]`. Then we want to reverse the non-linear equation as done in the projection matrix and apply this
inversed equation to the resulting depth value. The result is then a linear depth value.

First we transform the depth value to NDC which is not too difficult:

```glsl
float z = depth * 2.0 - 1.0; // back to NDC (OpenGL maps NDC z -1..1 to depth 0..1)
```

We then take the resulting z value and apply the inverse transformation to retrieve the linear depth value:

```glsl
return (2.0 * near * far) / (far + near - z * (far - near));
```

This equation is derived from the projection matrix for non-linearizing the depth values, returning depth values
between `near` and `far` – the distance from the camera. The complete fragment shader that transforms the non-linear
depth in screen-space to a linear depth value is then as follows:

```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D texture1;

float near = 0.1;
float far = 100.0;
float LinearizeDepth(float depth)
{
    float z = depth * 2.0 - 1.0; // back to NDC (OpenGL maps NDC z -1..1 to depth 0..1)
    return (2.0 * near * far) / (far + near - z * (far - near));
}

void main()
{
    // FragColor = texture(texture1, TexCoords);
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    FragColor = vec4(vec3(depth), 1.0);
}
```

Because the linearized depth values range from `near` to `far` most of its values will be above `1.0` and displayed
as completely white. By dividing the linear depth value by `far` in the `main` function we convert the linear depth
value to the range `[0, 1]`.
:::
:::vulkan
learnopengl's version first maps the depth back to OpenGL's NDC, `float z = depth * 2.0 - 1.0;`, because OpenGL's NDC z
runs from `-1` to `1`. In Vulkan there is nothing to undo: the depth buffer's value already *is* the NDC z (`0..1`).
So we can apply the inverse of the projection's depth equation directly. Solving `F_depth = (1/z - 1/near) / (1/far -
1/near)` for z gives:

```text
z = near * far / (far - F_depth * (far - near))
```

– the distance from the camera, between `near` and `far`. Using learnopengl's formula here would give wrong (too
large) distances. The fragment shader becomes:

```glsl
layout(location = 0) out vec4 outColor;

float near = 0.1;
float far = 100.0;

// The depth buffer's value back to the distance from the camera (the inverse of the projection's depth).
// Vulkan's depth is already 0..1 (GLM_FORCE_DEPTH_ZERO_TO_ONE): no "depth * 2.0 - 1.0" back to NDC as in OpenGL.
float LinearizeDepth(float depth) {
    return (near * far) / (far - depth * (far - near));
}

void main() {
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    outColor = vec4(vec3(depth), 1.0);
}
```

Because the linearized depth values range from `near` to `far` most of its values will be above `1.0` and displayed
as completely white. By dividing the linear depth value by `far` in `main` we convert it to the range `[0, 1]`.
(OpenGL's formula is the same function after its `depth * 2.0 - 1.0`: both give the distance.)
:::
:::d3d12
learnopengl's version first maps the depth back to OpenGL's NDC, `float z = depth * 2.0 - 1.0;`, because OpenGL's NDC z
runs from `-1` to `1`. In Direct3D there is nothing to undo: the depth buffer's value already *is* the NDC z (`0..1`).
So we can apply the inverse of the projection's depth equation directly. Solving `F_depth = (1/z - 1/near) / (1/far -
1/near)` for z gives:

```text
z = near * far / (far - F_depth * (far - near))
```

– the distance from the camera, between `near` and `far`. In `depth_testing.hlsl`, before `PSMain`:

```hlsl
// The projection's near and far planes (static const: constants of the shader itself,
// not values in a constant buffer).
static const float near = 0.1f;
static const float far = 100.0f;

// Turns a depth value (0..1, not linear) back into the distance from the camera. Direct3D's
// depth is 0..1 already (OpenGL's NDC z is -1..1, so learnopengl first does z * 2.0 - 1.0).
float LinearizeDepth(float depth)
{
    return (near * far) / (far - depth * (far - near));
}
```

The `static const` matters: in HLSL a global variable without `static` is not a constant of the shader but a value of
an implicit constant buffer (`$Globals`) that the application would have to set. And `PSMain` returns the linear depth:

```hlsl
    // divide by far to get depth in range [0,1] for visualization purposes
    float depth = LinearizeDepth(input.position.z) / far;
    return float4(depth, depth, depth, 1.0f);
```

Because the linearized depth values range from `near` to `far` most of its values will be above `1.0` and displayed
as completely white. By dividing the linear depth value by `far` we convert it to the range `[0, 1]`. (OpenGL's formula
is the same function after its `depth * 2.0 - 1.0`: both give the distance.)
:::

:::opengl
```quiz
Why does OpenGL's `LinearizeDepth` start with `depth * 2.0 - 1.0`?
- [ ] To turn the colour range 0..1 into a signed value for the shader
- [ ] Because `gl_FragCoord.z` runs from -1 to 1
- [ ] To double the precision of the depth value
- [x] The projection matrix produced NDC z in -1..1 and the viewport mapped it to 0..1; to invert the projection, the depth must first go back to -1..1
---
The inverse formula `(2.0 * near * far) / (far + near - z * (far - near))` is the inverse of the projection matrix's depth row, which works in OpenGL's NDC (-1..1). `gl_FragCoord.z` holds the window depth (0..1), so it is mapped back first.
```
:::
:::vulkan
```quiz
learnopengl's `LinearizeDepth` starts with `depth * 2.0 - 1.0`. Why does the Vulkan version leave that out?
- [ ] Vulkan's `gl_FragCoord.z` already holds the linear distance
- [ ] The step is only needed for textures, not for depth values
- [ ] Vulkan's depth buffer runs from -1 to 1, so it is already in NDC
- [x] Vulkan's NDC z already runs from 0 to 1 (with `GLM_FORCE_DEPTH_ZERO_TO_ONE`), so the depth value *is* NDC z – there is no -1..1 range to go back to
---
OpenGL's projection produces NDC z in -1..1 and its viewport maps that to 0..1; learnopengl undoes the mapping first. In Vulkan the viewport (0..1) leaves NDC z unchanged, so `near * far / (far - depth * (far - near))` inverts the projection directly. Doing learnopengl's step anyway would give distances that are too large.
```
:::
:::d3d12
```quiz
learnopengl's `LinearizeDepth` starts with `depth * 2.0 - 1.0`. Why does the HLSL version leave that out?
- [ ] `SV_POSITION.z` already holds the linear distance in the pixel shader
- [ ] The step is only needed for textures, not for depth values
- [ ] Direct3D's depth buffer runs from -1 to 1, so it is already in NDC
- [x] Direct3D's NDC z already runs from 0 to 1, so the depth value *is* NDC z – there is no -1..1 range to go back to
---
OpenGL's projection produces NDC z in -1..1 and its viewport maps that to 0..1; learnopengl undoes the mapping first. In Direct3D the viewport (0..1) leaves NDC z unchanged, so `near * far / (far - depth * (far - near))` inverts the projection directly. Doing learnopengl's step anyway would give distances that are too large.
```
:::

Now do the task **linear-depth** and press **Build & run**. The output is now almost black: the value is the distance
divided by 100, and the objects are only a few units away – the front of the left cube, 3.5 units from the camera,
gets 0.035. The floor grows lighter towards the back, and the background (the clear colour, 0.1) is now lighter than
everything that was drawn. The colors are mostly black because the depth values range linearly from the near plane,
which is 0.1, to the far plane, which is 100 – still quite far away from us. The result is that we're relatively
close to the near plane and therefore get lower (darker) depth values.

## Z-fighting

A common visual artifact may occur when two planes or triangles are so closely aligned to each other that the depth
buffer does not have enough precision to figure out which one of the two shapes is in front of the other. The result
is that the two shapes continually seem to switch order which causes weird glitchy patterns. This is called
*z-fighting*, because it looks like the shapes are fighting over who gets on top.

In the scene we've been using so far there are a few spots where z-fighting can be noticed. The containers were placed
at the exact height of the floor which means the bottom plane of the container is coplanar with the floor plane: both
lie at y = -0.5. The depth values of both planes are then the same, so the resulting depth test has no way of figuring
out which is the right one. If you move the camera inside one of the containers, the effects are clearly visible: the
bottom part of the container constantly switches between the container's bottom face and the floor in a zigzag
pattern.

Z-fighting is a common problem with depth buffers and it's generally more noticeable when objects are further away
(because the depth buffer has less precision at larger z-values). Z-fighting can't be completely prevented, but there
are a few tricks that will help to mitigate or completely prevent z-fighting in your scene.

### Prevent z-fighting

The first and most important trick is *never place objects too close to each other in a way that some of their
triangles closely overlap*. By creating a small offset between two objects you can completely remove z-fighting
between the two objects. In the case of the containers and the plane we could've easily moved the containers slightly
upwards in the positive y direction. The small change of the container's positions would probably not be noticeable
at all and would completely reduce the z-fighting. However, this requires manual intervention of each of the objects
and thorough testing to make sure no objects in a scene produce z-fighting.

A second trick is to *set the near plane as far as possible*. In one of the previous sections we've discussed that
precision is extremely large when close to the near plane, so if we move the near plane away from the viewer, we'll
have significantly greater precision over the entire frustum range. However, setting the near plane too far could
cause clipping of near objects, so it is usually a matter of tweaking and experimentation to figure out the best near
distance for your scene.

Another great trick at the cost of some performance is to *use a higher precision depth buffer*. Most depth buffers
have a precision of 24 bits, but most GPUs nowadays support 32 bit depth buffers, increasing the precision by a
significant amount. So at the cost of some performance you'll get much more precision with depth testing, reducing
z-fighting.

:::opengl
(With GLFW you would ask for it with the window hint `GLFW_DEPTH_BITS` before creating the window.)
:::
:::vulkan
(This project's depth buffer already is one: `VK_FORMAT_D32_SFLOAT`, the first candidate of `findDepthFormat()`.)
:::
:::d3d12
(This project's depth buffer already is one: `DXGI_FORMAT_D32_FLOAT`.)
:::

:::vulkan d3d12
With a 32-bit *floating-point* depth buffer and a `0..1` depth range there is one more trick that many engines use,
*reversed z*: the projection maps the near plane to 1 and the far plane to 0, the depth buffer is cleared to 0, and
the depth function becomes GREATER. A float has the most precision close to 0, and that now lies where the `1/z`
curve has the least – the two roughly cancel out, and the precision becomes nearly even over the whole frustum.
:::

The three techniques we've discussed are the most common and easy-to-implement anti z-fighting techniques. There are
some other techniques out there that require a lot more work and still won't completely disable z-fighting.
Z-fighting is a common issue, but if you use the proper combination of the listed techniques you probably won't need
to deal with z-fighting that much.

```quiz
Which of these help against z-fighting? (Select all that apply.)
- [x] Moving the near plane farther away from the camera, as far as the scene allows
- [ ] Moving the far plane farther away, from 100 to 1000
- [x] Lifting the cubes a tiny bit so that their bottom faces no longer lie exactly on the floor
- [x] Using a depth buffer with more bits, e.g. 32 instead of 24
---
Precision is spent mostly near the near plane, so pushing the near plane out spreads it over the scene; pushing the far plane out does the opposite (a little). Separating coplanar surfaces removes the tie altogether, and more bits give every distance more distinct depth values.
```

The next chapter adds the depth buffer's partner, the stencil buffer, and uses it to draw outlines around the cubes.
