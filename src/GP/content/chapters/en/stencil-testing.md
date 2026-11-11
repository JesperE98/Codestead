# Stencil testing

Once the fragment shader has processed the fragment a so called *stencil test* is executed that, just like the depth
test, has the option to discard fragments. After that the remaining fragments are passed to the depth test where the
GPU could possibly discard even more fragments. The stencil test is based on the content of yet another buffer called
the *stencil buffer* that we're allowed to update during rendering to achieve interesting effects.

A stencil buffer (usually) contains 8 bits per *stencil value* that amounts to a total of 256 different stencil values
per pixel. We can set these stencil values to values of our liking and we can discard or keep fragments whenever a
particular fragment has a certain stencil value.

:::opengl
Each windowing library needs to set up a stencil buffer for you. GLFW does this automatically: a default window has an
8-bit stencil buffer (the window hint `GLFW_STENCIL_BITS`) next to its 24-bit depth buffer, so we don't have to tell
GLFW to create one.
:::
:::vulkan
In Vulkan nobody sets up a stencil buffer for you. The stencil buffer is part of the depth image: formats like
`VK_FORMAT_D32_SFLOAT_S8_UINT` or `VK_FORMAT_D24_UNORM_S8_UINT` store a depth value *and* an 8-bit stencil value per
pixel. The depth image of the previous chapter, `VK_FORMAT_D32_SFLOAT`, has no stencil part, so the first task
changes its format.
:::
:::d3d12
In Direct3D 12 nobody sets up a stencil buffer for you. The stencil buffer is part of the depth buffer: the formats
`DXGI_FORMAT_D24_UNORM_S8_UINT` (24 bits of depth, 8 of stencil) and `DXGI_FORMAT_D32_FLOAT_S8X24_UINT` (a 32-bit float
depth, 8 bits of stencil and 24 unused bits) store both per pixel. The depth buffer of the previous chapter,
`DXGI_FORMAT_D32_FLOAT`, has no stencil part, so the first task changes its format.
:::

A simple example of a stencil buffer: imagine a screen-sized grid of stencil values that is first cleared with zeros,
and then gets a rectangle of 1s written into its middle. If we then draw a scene with a stencil test that only passes
where the stencil value is 1, the fragments of the scene are only rendered (the others are discarded) inside that
rectangle – as if we looked at the scene through a window cut in a sheet of paper. That's where the name comes from:
like a stencil, the buffer decides where paint gets through.

Stencil buffer operations allow us to set the stencil buffer at specific values wherever we're rendering fragments.
By changing the content of the stencil buffer while we're rendering, we're *writing* to the stencil buffer. In the
same (or following) frame(s) we can *read* these values to discard or pass certain fragments. When using stencil
buffers you can get as crazy as you like, but the general outline is usually as follows:

- Enable writing to the stencil buffer.
- Render objects, updating the content of the stencil buffer.
- Disable writing to the stencil buffer.
- Render (other) objects, this time discarding certain fragments based on the content of the stencil buffer.

By using the stencil buffer we can thus discard certain fragments based on the fragments of other drawn objects in
the scene.

:::opengl
You can enable stencil testing by enabling `GL_STENCIL_TEST`. From that point on, all rendering calls will influence
the stencil buffer in one way or another.

```cpp
glEnable(GL_STENCIL_TEST);
```

Note that you also need to clear the stencil buffer each iteration just like the color and depth buffer:

```cpp
glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
```

Also, just like the depth testing's `glDepthMask` function, there is an equivalent function for the stencil buffer.
The function `glStencilMask` allows us to set a bitmask that is ANDed with the stencil value about to be written to
the buffer. By default this is set to a bitmask of all 1s not affecting the output, but if we were to set this to
`0x00` all the stencil values written to the buffer end up as 0s. This is equivalent to depth testing's
`glDepthMask(GL_FALSE)`:

```cpp
glStencilMask(0xFF); // each bit is written to the stencil buffer as is
glStencilMask(0x00); // each bit ends up as 0 in the stencil buffer (disabling writes)
```

Most of the cases you'll only be using `0x00` or `0xFF` as the stencil mask, but it's good to know there are options
to set custom bit-masks.
:::
:::vulkan
Like the depth test, the stencil test is part of each pipeline, in the same `VkPipelineDepthStencilStateCreateInfo`:
`stencilTestEnable = VK_TRUE` is OpenGL's `glEnable(GL_STENCIL_TEST)`. The stencil buffer is cleared at the start of
the render pass if the depth attachment's `stencilLoadOp` is `VK_ATTACHMENT_LOAD_OP_CLEAR`; the value comes from the
same clear value as the depth – the `0` in `depthStencil = {1.0f, 0}`.

The equivalent of OpenGL's `glStencilMask` – a bitmask that is ANDed with the stencil value about to be written – is
the `writeMask` of the pipeline's stencil state. `0xFF` writes every bit as is, `0x00` makes every write leave the
stored value as it is: writes are disabled, like the depth test's `depthWriteEnable = VK_FALSE`. Most of the cases
you'll only be using `0x00` or `0xFF`, but it's good to know there are options to set custom bit-masks.
:::
:::d3d12
Like the depth test, the stencil test is part of each PSO, in the same `DepthStencilState`: `StencilEnable = TRUE`
is OpenGL's `glEnable(GL_STENCIL_TEST)`. The stencil buffer is cleared with the depth buffer, in the same
`ClearDepthStencilView` call, if its flags include `D3D12_CLEAR_FLAG_STENCIL`; the stencil value is the fourth
argument.

The equivalent of OpenGL's `glStencilMask` – a bitmask that is ANDed with the stencil value about to be written – is
the PSO's `StencilWriteMask`. `0xFF` writes every bit as is, `0x00` makes every write leave the stored value as it is:
writes are disabled, like the depth test's `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`. Most of the cases you'll
only be using `0x00` or `0xFF`, but it's good to know there are options to set custom bit-masks.
:::

## Stencil functions

Similar to depth testing, we have a certain amount of control over when a stencil test should pass or fail and how it
should affect the stencil buffer. There are a total of two things we can configure for stencil testing: the stencil
test function and how the stencil buffer is updated.

:::opengl
The stencil test function is set with `glStencilFunc`, which has three parameters:

- `func`: sets the stencil test function that determines whether a fragment passes or is discarded. This test
  function is applied to the stored stencil value and the `glStencilFunc`'s `ref` value. Possible options are:
  `GL_NEVER`, `GL_LESS`, `GL_LEQUAL`, `GL_GREATER`, `GL_GEQUAL`, `GL_EQUAL`, `GL_NOTEQUAL` and `GL_ALWAYS`. The
  semantic meaning of these is similar to the depth buffer's functions.
- `ref`: specifies the reference value for the stencil test. The stencil buffer's content is compared to this value.
- `mask`: specifies a mask that is ANDed with both the reference value and the stored stencil value before the test
  compares them. Initially set to all 1s.

So in the case of the simple stencil example we've shown at the start, the function would be set to:

```cpp
glStencilFunc(GL_EQUAL, 1, 0xFF);
```

This tells OpenGL that whenever the stencil value of a fragment is equal (`GL_EQUAL`) to the reference value `1`, the
fragment passes the test and is drawn, otherwise discarded.

But `glStencilFunc` only describes whether OpenGL should pass or discard fragments based on the stencil buffer's
content, not how we can actually update the buffer. That is where `glStencilOp` comes in. It has three options of
which we can specify for each option what action to take:

- `sfail`: action to take if the stencil test fails.
- `dpfail`: action to take if the stencil test passes, but the depth test fails.
- `dppass`: action to take if both the stencil and the depth test pass.
:::
:::vulkan
Both live in the pipeline's stencil state, a `VkStencilOpState` – one for triangles seen from the front
(`depthStencil.front`) and one for those seen from behind (`depthStencil.back`). OpenGL's `glStencilFunc(func, ref,
mask)` is three of its fields:

- `compareOp`: the stencil test function that determines whether a fragment passes or is discarded, a `VkCompareOp`
  like the depth test's: `VK_COMPARE_OP_NEVER`, `LESS`, `LESS_OR_EQUAL`, `GREATER`, `GREATER_OR_EQUAL`, `EQUAL`,
  `NOT_EQUAL` and `ALWAYS`. It compares the reference value with the stored stencil value.
- `reference`: the reference value for the stencil test (OpenGL's `ref`).
- `compareMask`: a mask that is ANDed with both the reference value and the stored stencil value before the test
  compares them (OpenGL's `mask`).

So in the case of the simple stencil example we've shown at the start, the stencil state would be `compareOp =
VK_COMPARE_OP_EQUAL`, `reference = 1`, `compareMask = 0xFF`: whenever the stencil value of a fragment is equal to the
reference value 1, the fragment passes the test and is drawn, otherwise discarded.

But that only describes whether fragments pass or are discarded, not how we can actually update the buffer. That is
what three more fields are for – OpenGL's `glStencilOp(sfail, dpfail, dppass)`:

- `failOp`: action to take if the stencil test fails.
- `depthFailOp`: action to take if the stencil test passes, but the depth test fails.
- `passOp`: action to take if both the stencil and the depth test pass.

The seventh field, `writeMask`, is the write mask from above. All of it is fixed when the pipeline is created – unless
you list it as dynamic state: `VK_DYNAMIC_STATE_STENCIL_REFERENCE` (with `vkCmdSetStencilReference`) and the compare
and write masks can be dynamic since Vulkan 1.0, the test function and the operations since Vulkan 1.3. This course
keeps everything in the pipeline.
:::
:::d3d12
The masks are fields of the PSO's `DepthStencilState`, the test function and the operations are in a
`D3D12_DEPTH_STENCILOP_DESC` – one for triangles seen from the front (`FrontFace`) and one for those seen from behind
(`BackFace`). OpenGL's `glStencilFunc(func, ref, mask)` is spread over three places:

- `FrontFace.StencilFunc`: the stencil test function that determines whether a pixel passes or is discarded, a
  `D3D12_COMPARISON_FUNC` like the depth test's: `D3D12_COMPARISON_FUNC_NEVER`, `LESS`, `LESS_EQUAL`, `GREATER`,
  `GREATER_EQUAL`, `EQUAL`, `NOT_EQUAL` and `ALWAYS`. It compares the reference value with the stored stencil value.
- the reference value is **not** in the PSO: it is set on the command list with `OMSetStencilRef` (OpenGL's `ref`).
  It is the only part of the stencil test you can change without another PSO.
- `StencilReadMask`: a mask that is ANDed with both the reference value and the stored stencil value before the test
  compares them (OpenGL's `mask`).

So in the case of the simple stencil example we've shown at the start, the PSO would have `StencilFunc =
D3D12_COMPARISON_FUNC_EQUAL` and `StencilReadMask = 0xFF`, and the command list would call `OMSetStencilRef(1)`:
whenever the stencil value of a pixel is equal to the reference value 1, the pixel passes the test and is drawn,
otherwise discarded.

But that only describes whether pixels pass or are discarded, not how we can actually update the buffer. That is what
three more fields of `D3D12_DEPTH_STENCILOP_DESC` are for – OpenGL's `glStencilOp(sfail, dpfail, dppass)`:

- `StencilFailOp`: action to take if the stencil test fails.
- `StencilDepthFailOp`: action to take if the stencil test passes, but the depth test fails.
- `StencilPassOp`: action to take if both the stencil and the depth test pass.
:::

```quiz
The stored stencil value is 3, the reference value is 1, the test function is EQUAL and the compare mask is `0x01`. Does the fragment pass?
- [ ] No – 3 is not equal to 1
- [x] Yes – the mask is ANDed with both values first: 3 & 1 = 1 and 1 & 1 = 1, which are equal
- [ ] Only if the write mask is `0xFF` too
---
The compare mask selects which bits take part in the test. With `0x01` only the lowest bit is compared, and it is 1 in both values. The write mask has nothing to do with the test; it only limits what is written afterwards.
```

Then, for each of the options you can take any of the following actions:

:::opengl
| Action | Description |
|---|---|
| `GL_KEEP` | The currently stored stencil value is kept. |
| `GL_ZERO` | The stencil value is set to 0. |
| `GL_REPLACE` | The stencil value is replaced with the reference value set with `glStencilFunc`. |
| `GL_INCR` | The stencil value is increased by 1 if it is lower than the maximum value. |
| `GL_INCR_WRAP` | Same as `GL_INCR`, but wraps it back to 0 as soon as the maximum value is exceeded. |
| `GL_DECR` | The stencil value is decreased by 1 if it is higher than the minimum value. |
| `GL_DECR_WRAP` | Same as `GL_DECR`, but wraps it to the maximum value if it ends up lower than 0. |
| `GL_INVERT` | Bitwise inverts the current stencil buffer value. |

By default the `glStencilOp` function is set to `(GL_KEEP, GL_KEEP, GL_KEEP)` so whatever the outcome of any of the
tests, the stencil buffer keeps its values. The default behavior does not update the stencil buffer, so if you want
to write to the stencil buffer you need to specify at least one different action for any of the options.

(Both functions apply to front and back faces alike; `glStencilFuncSeparate` and `glStencilOpSeparate` set them for
one side only.)
:::
:::vulkan
| Action (`VkStencilOp`) | Description |
|---|---|
| `VK_STENCIL_OP_KEEP` | The currently stored stencil value is kept. |
| `VK_STENCIL_OP_ZERO` | The stencil value is set to 0. |
| `VK_STENCIL_OP_REPLACE` | The stencil value is replaced with the reference value. |
| `VK_STENCIL_OP_INCREMENT_AND_CLAMP` | The stencil value is increased by 1 if it is lower than the maximum value. |
| `VK_STENCIL_OP_INCREMENT_AND_WRAP` | Same, but wraps it back to 0 as soon as the maximum value is exceeded. |
| `VK_STENCIL_OP_DECREMENT_AND_CLAMP` | The stencil value is decreased by 1 if it is higher than the minimum value. |
| `VK_STENCIL_OP_DECREMENT_AND_WRAP` | Same, but wraps it to the maximum value if it ends up lower than 0. |
| `VK_STENCIL_OP_INVERT` | Bitwise inverts the current stencil buffer value. |

With all three actions `VK_STENCIL_OP_KEEP`, whatever the outcome of any of the tests, the stencil buffer keeps its
values; to write to it you need at least one different action.
:::
:::d3d12
| Action (`D3D12_STENCIL_OP`) | Description |
|---|---|
| `D3D12_STENCIL_OP_KEEP` | The currently stored stencil value is kept. |
| `D3D12_STENCIL_OP_ZERO` | The stencil value is set to 0. |
| `D3D12_STENCIL_OP_REPLACE` | The stencil value is replaced with the reference value set with `OMSetStencilRef`. |
| `D3D12_STENCIL_OP_INCR_SAT` | The stencil value is increased by 1 if it is lower than the maximum value. |
| `D3D12_STENCIL_OP_INCR` | Increased by 1, wrapping back to 0 as soon as the maximum value is exceeded. |
| `D3D12_STENCIL_OP_DECR_SAT` | The stencil value is decreased by 1 if it is higher than the minimum value. |
| `D3D12_STENCIL_OP_DECR` | Decreased by 1, wrapping to the maximum value if it ends up lower than 0. |
| `D3D12_STENCIL_OP_INVERT` | Bitwise inverts the current stencil buffer value. |

The default state (`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)`) has stencil testing off, all three actions
`D3D12_STENCIL_OP_KEEP`, the function `D3D12_COMPARISON_FUNC_ALWAYS` and both masks `0xFF`. With KEEP everywhere,
whatever the outcome of any of the tests, the stencil buffer keeps its values; to write to it you need at least one
different action.
:::

So using the test function and the actions we can specify when and how we want to update the stencil buffer, and
when to pass or discard fragments based on its content.

## Object outlining

It would be unlikely if you completely understood how stencil testing works from the previous sections alone, so
we're going to demonstrate a particularly useful feature that can be implemented with stencil testing alone called
*object outlining*.

Object outlining does exactly what it says it does. For each object (or only one) we're creating a small colored
border around the (combined) objects. This is a particularly useful effect when you want to select units in a
strategy game for example and need to show the user which of the units were selected. The routine for outlining your
objects is as follows:

1. Enable stencil writing.
2. Set the stencil op to always pass, and before drawing the (to be outlined) objects, update the stencil buffer with
   1s wherever the objects' fragments are rendered.
3. Render the objects.
4. Disable stencil writing and depth testing.
5. Scale each of the objects by a small amount.
6. Use a different fragment shader that outputs a single (border) color.
7. Draw the objects again, but only if their fragments' stencil values are not equal to 1.
8. Enable depth testing again and restore the stencil settings.

This process sets the content of the stencil buffer to 1s for each of the object's fragments and when it's time to
draw the borders, we draw scaled-up versions of the objects only where the stencil test passes. We're effectively
discarding all the fragments of the scaled-up versions that are part of the original objects' fragments using the
stencil buffer.

This chapter's project is the scene of *Depth testing* drawn normally (with textures and the depth function LESS), with
one change, taken from learnopengl's stencil code: the loop draws the **floor first**, then the two cubes. With the
depth test the order doesn't change the picture, but it matters for the stencil buffer, as you'll see. Build and run the
program: the start picture is the one you know from the previous chapter.

:::opengl
The `// TODO:` comments mark where your code goes: after `glDepthFunc`, after the shader, at the `glClear` call, after
the matrices, before the floor, before the cubes and after them. The per-frame matrices are now computed before
`shader.use()`, under `// set uniforms`, so that a second shader can get them too.
:::
:::vulkan
The project has the same structure as the previous chapter's: one vertex buffer, one descriptor set per texture,
`createPipeline(vertFile, fragFile, pipeline)` with the depth function LESS, and the model matrix as a push constant.
The fragment shader `shaders/stencil_single_color.frag` has a `// TODO:` comment; the changes in `main.cpp` are to
lines that are already there and to the functions named in each task.
:::
:::d3d12
The project has the same structure as the previous chapter's: one vertex buffer, one SRV per texture,
`SetGraphicsRootDescriptorTable(2, …)` before each draw. The new file `stencil_single_color.hlsl` already has the
outline's vertex shader. `// TODO:` comments mark every place a task fills in: the depth buffer's format, the PSO's
stencil state, the outline's PSO, the stencil clear and the three draw passes in `PopulateCommandList`.
:::

First we need a stencil buffer that is switched on and cleared every frame, and the stencil operation of step 2: we
only want to update the stencil buffer when both the stencil and the depth test pass – then the stored value is
replaced by the reference value. When either test fails, we keep it.

:::opengl
After `glDepthFunc`:

```cpp
    glEnable(GL_STENCIL_TEST);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE); // stencil fails: keep, depth fails: keep, both pass: replace with the reference value
```

and in the loop:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT); // don't forget to clear the stencil buffer!
```

learnopengl also calls `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)` here. We leave it out: the loop sets the stencil function
before every draw anyway. Until then the function is OpenGL's default, `GL_ALWAYS` with the reference value 0.
:::
:::vulkan
The depth image needs a format with a stencil part. `findDepthFormat()` now offers only such formats;
`findSupportedFormat` picks the first one the GPU supports:

```cpp
            {VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT}, // depth with an 8-bit stencil buffer
```

The view of the depth image in `createDepthResources()` now covers both parts:

```cpp
        depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT | VK_IMAGE_ASPECT_STENCIL_BIT);
```

The render pass clears the stencil part at its start – OpenGL's `GL_STENCIL_BUFFER_BIT` in `glClear` – to the `0` of
the clear value `depthStencil = {1.0f, 0}`, which was there all along:

```cpp
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_CLEAR; // don't forget to clear the stencil buffer!
```

(`stencilStoreOp` stays `VK_ATTACHMENT_STORE_OP_DONT_CARE`: nobody needs the stencil values after the frame.) And in
`createPipeline()` the stencil test is switched on, with the stencil state of step 2 for both sides:

```cpp
        depthStencil.stencilTestEnable = VK_TRUE;
        depthStencil.front.failOp = VK_STENCIL_OP_KEEP;      // the stencil test fails: keep the stored value
        depthStencil.front.depthFailOp = VK_STENCIL_OP_KEEP; // the stencil test passes, the depth test fails: keep it
        depthStencil.front.passOp = VK_STENCIL_OP_REPLACE;   // both pass: store the reference value
        depthStencil.front.compareOp = VK_COMPARE_OP_ALWAYS;
        depthStencil.front.compareMask = 0xFF;
        depthStencil.front.writeMask = 0xFF;
        depthStencil.front.reference = 1;
        depthStencil.back = depthStencil.front; // the same for triangles seen from behind
```

The cubes' triangles aren't culled, so both front- and back-facing ones are drawn: `back` must get the same state.
:::
:::d3d12
The depth buffer needs a format with a stencil part, `DXGI_FORMAT_D24_UNORM_S8_UINT`, in four places: the depth
stencil view (`depthStencilDesc.Format`), the clear value (`depthOptimizedClearValue.Format`), the texture
(`CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D24_UNORM_S8_UINT, …)`) and the PSO (`psoDesc.DSVFormat`):

```cpp
        // A depth stencil buffer: 24 bits of depth and 8 bits of stencil per pixel.
        D3D12_DEPTH_STENCIL_VIEW_DESC depthStencilDesc = {};
        depthStencilDesc.Format = DXGI_FORMAT_D24_UNORM_S8_UINT;
```

In `LoadAssets`, after the depth function, the stencil test is switched on with the operations of step 2 for both
sides:

```cpp
        // The stencil test: on. What happens to the stored stencil value when the stencil
        // test fails: keep it; when the stencil test passes but the depth test fails: keep
        // it; when both pass: replace it with the reference value (OMSetStencilRef). The
        // same for triangles seen from the front and from the back.
        psoDesc.DepthStencilState.StencilEnable = TRUE;
        psoDesc.DepthStencilState.FrontFace.StencilFailOp = D3D12_STENCIL_OP_KEEP;
        psoDesc.DepthStencilState.FrontFace.StencilDepthFailOp = D3D12_STENCIL_OP_KEEP;
        psoDesc.DepthStencilState.FrontFace.StencilPassOp = D3D12_STENCIL_OP_REPLACE;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
```

The cubes' triangles aren't culled, so both front- and back-facing ones are drawn: `BackFace` must get the same state.
Finally `PopulateCommandList` clears the stencil buffer too – OpenGL's `GL_STENCIL_BUFFER_BIT` – to 0, the fourth
argument:

```cpp
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL, 1.0f, 0, 0, nullptr);    // don't forget to clear the stencil buffer!
```

The test function is still the default `ALWAYS`, and the reference value is 0 until a command list sets another one.
:::

```quiz
The stencil operations are KEEP (stencil test fails), KEEP (depth test fails), REPLACE (both pass). When does a fragment change the stored stencil value?
- [ ] Whenever it is drawn, whatever the tests say
- [ ] Only when the stencil test fails
- [ ] When the stencil test passes, even if the depth test fails
- [x] Only when it passes both the stencil and the depth test – the value then becomes the reference value
---
REPLACE is only the third action, the one for "both tests pass". So a cube fragment hidden behind something nearer leaves the stencil buffer as it is: the 1s end up exactly where the cube is visible.
```

Now do the task **stencil-buffer**, then build and run. Nothing visible changes: the test function is ALWAYS, so every
fragment passes and is drawn as before.

:::opengl
(Every fragment also writes the reference value – OpenGL's default, 0.)
:::
:::vulkan
(Every fragment also writes the reference value, 1 – the floor too, for now.)
:::
:::d3d12
(Every pixel also writes the reference value – still 0.)
:::

Step 6 needs a fragment shader that outputs a single border color. We simply set a hardcoded color value, a dark
teal:

:::opengl
`stencil_single_color.fs`:

```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(0.04, 0.28, 0.26, 1.0);
}
```

The outlines are drawn with a shader program of their own, `shaderSingleColor`, built from the same vertex shader and
this fragment shader, right after `shader`:

```cpp
    Shader shaderSingleColor("stencil_testing.vs", "stencil_single_color.fs");
```

It needs the same view and projection matrices as `shader`, every frame. A program must be in use when you set its
uniforms, so after the matrices are computed:

```cpp
        shaderSingleColor.use();
        shaderSingleColor.setMat4("view", view);
        shaderSingleColor.setMat4("projection", projection);
```
:::
:::vulkan
`shaders/stencil_single_color.frag`:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(0.04, 0.28, 0.26, 1.0);
}
```

It doesn't read `fragTexCoord`, which the vertex shader still writes – an output nobody reads is allowed. The outlines
will use it in a pipeline of their own, together with `stencil_testing.vert`: the same vertex shader, so the same
uniform buffer and push constant.
:::
:::d3d12
`PSMain` in `stencil_single_color.hlsl`:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(0.04f, 0.28f, 0.26f, 1.0f);
}
```

The file's `VSMain` is the vertex shader of `stencil_testing.hlsl` without the texture coordinates. The outlines are
drawn with a PSO of their own, `m_singleColorPipelineState` (a new `ComPtr<ID3D12PipelineState>` member), created
from the same `psoDesc` with these two shaders – like the lamp's PSO in the lighting chapters. It goes after
`m_pipelineState` is created:

```cpp
        // The outlines: the same description with the shaders of stencil_single_color.hlsl.
        ComPtr<ID3DBlob> singleColorVertexShader;
        ComPtr<ID3DBlob> singleColorPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"stencil_single_color.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &singleColorVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"stencil_single_color.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &singleColorPixelShader, nullptr));

        psoDesc.VS = CD3DX12_SHADER_BYTECODE(singleColorVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(singleColorPixelShader.Get());
        // TODO: the outline's depth and stencil state
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_singleColorPipelineState)));
```

Keep the `// TODO:` line: the outline's depth and stencil state come in the last task. The input layout still lists
`TEXCOORD`; a vertex shader may ignore elements it doesn't read.
:::

Do the task **single-color**, then build and run. Again nothing changes: nothing is drawn with the new shader yet.

Now steps 1 to 3. We want to draw the cubes as normal and write 1 into the stencil buffer wherever they are drawn. The
floor is drawn as well, but its fragments must *not* end up in the stencil buffer: we only care about the containers.
That's why the floor is drawn first, with stencil writes off, and the cubes after it, with writes on.

:::opengl
Before the floor:

```cpp
        // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers. We set its mask to 0x00 to not write to the stencil buffer.
        glStencilMask(0x00);
```

and before the cubes:

```cpp
        // 1st. render pass, draw objects as normal, writing to the stencil buffer
        // --------------------------------------------------------------------
        glStencilFunc(GL_ALWAYS, 1, 0xFF); // all fragments pass the stencil test and write the reference value 1
        glStencilMask(0xFF);
```

By using `GL_REPLACE` as the stencil op function we make sure that each of the containers' fragments update the
stencil buffer with a stencil value of 1. Because the fragments always pass the stencil test, the stencil buffer is
updated with the reference value wherever we've drawn them.
:::
:::vulkan
In Vulkan, a different stencil function or write mask means a different pipeline. `createPipeline()` gets two
parameters for them:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkCompareOp stencilCompareOp, uint32_t stencilWriteMask, VkPipeline& pipeline) {
```

which take the place of the fixed values in the stencil state:

```cpp
        depthStencil.front.compareOp = stencilCompareOp;
        depthStencil.front.compareMask = 0xFF;
        depthStencil.front.writeMask = stencilWriteMask;
```

There are now two pipelines: a new member `VkPipeline floorPipeline;` next to `graphicsPipeline`, both destroyed in
`cleanup()`:

```cpp
        // the floor does not write to the stencil buffer (write mask 0x00); the cubes write 1 wherever they are drawn
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_COMPARE_OP_ALWAYS, 0x00, floorPipeline);
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_COMPARE_OP_ALWAYS, 0xFF, graphicsPipeline);
```

The write mask 0x00 is OpenGL's `glStencilMask(0x00)`; ALWAYS with the reference value 1 and the write mask 0xFF is
`glStencilFunc(GL_ALWAYS, 1, 0xFF); glStencilMask(0xFF);`. In `recordCommandBuffer()` the floor is drawn with
`floorPipeline` – its `vkCmdBindPipeline` replaces the one at the start of the render pass – and the cubes with
`graphicsPipeline`:

```cpp
        // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, floorPipeline);
        ...
        // 1st. render pass, draw objects as normal, writing to the stencil buffer
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);
        // cubes
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);
```

Binding another pipeline keeps the viewport, scissor, vertex buffer and descriptor sets that are bound: the pipelines
share one layout. Because `passOp` is `VK_STENCIL_OP_REPLACE`, each of the containers' fragments updates the stencil
buffer with the reference value 1; because they always pass the stencil test, that happens wherever we've drawn them.
:::
:::d3d12
In Direct3D 12, a different stencil function or write mask means a different PSO. Before `m_pipelineState` is
created, a PSO for the floor (a new member `m_floorPipelineState`) that writes nothing to the stencil buffer; then the
cubes' PSO, which writes the reference value wherever it draws:

```cpp
        // The floor: drawn as normal, but it does not write to the stencil buffer (we only
        // care about the containers): stencil write mask 0x00.
        psoDesc.DepthStencilState.StencilWriteMask = 0x00;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_floorPipelineState)));

        // The containers: all pixels pass the stencil test (ALWAYS) and write the reference
        // value (StencilPassOp REPLACE) with all 8 bits (write mask 0xFF).
        psoDesc.DepthStencilState.StencilWriteMask = 0xFF;
        psoDesc.DepthStencilState.FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_ALWAYS;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
```

`CreateGraphicsPipelineState` copies what it needs, so the same `psoDesc` can be changed and used again for the next
PSO. In `PopulateCommandList` the floor is drawn with the floor's PSO and the cubes with the other one – and the
reference value 1, which is command-list state:

```cpp
    // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers
    m_commandList->SetPipelineState(m_floorPipelineState.Get());
    ...
    // 1st. render pass, draw objects as normal, writing to the stencil buffer: the reference
    // value 1 wherever a cube is drawn
    m_commandList->SetPipelineState(m_pipelineState.Get());
    m_commandList->OMSetStencilRef(1);
```

This is OpenGL's `glStencilMask(0x00)` before the floor and `glStencilFunc(GL_ALWAYS, 1, 0xFF); glStencilMask(0xFF);`
before the cubes. Because `StencilPassOp` is `D3D12_STENCIL_OP_REPLACE`, each of the containers' pixels updates the
stencil buffer with the reference value 1; because they always pass the stencil test, that happens wherever we've
drawn them.
:::

```quiz
Why must the floor not write to the stencil buffer?
- [x] The outlines are drawn only where the stencil value is not 1; if the floor wrote 1s, the outline around the cubes' lower part – which lies over the floor – would be discarded
- [ ] Because the floor would otherwise fail the depth test
- [ ] Because a stencil buffer can only hold the shape of one kind of object
---
The stencil buffer should hold 1 exactly where the cubes are. The ring of the scaled cubes lies over the background at the top and over the floor at the bottom; a floor that wrote 1 there would block the bottom of the outline.
```

Do the task **write-stencil**, then build and run. Once again the picture doesn't change – but the stencil buffer now
holds 1 wherever a cube is visible and 0 everywhere else.

Now that the stencil buffer is updated with 1s where the containers were drawn we're going to draw the upscaled
containers, but this time with the appropriate test function and disabling writes to the stencil buffer: steps 4 to
8. We set the test function to NOT_EQUAL with the reference value 1, which makes sure that we're only drawing parts of
the containers that are not equal to 1. This way we only draw the part of the containers that are outside the
previously drawn containers. We also disable depth testing, so the scaled containers (the borders) do not get
overwritten by – or hidden behind – the floor. The scale factor is 1.1, a 10% larger cube.

:::opengl
After the cubes:

```cpp
        // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
        // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
        // the objects' size differences, making it look like borders.
        // -----------------------------------------------------------------------------------------------------------------------------
        glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
        glStencilMask(0x00);
        glDisable(GL_DEPTH_TEST);
        shaderSingleColor.use();
        float scale = 1.1f;
        // cubes
        glBindVertexArray(cubeVAO);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        shaderSingleColor.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        shaderSingleColor.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        // restore the state for the next frame: stencil writes on (glClear obeys the stencil mask too), test always passes, depth test on
        glStencilMask(0xFF);
        glStencilFunc(GL_ALWAYS, 0, 0xFF);
        glEnable(GL_DEPTH_TEST);
```

(The `glBindTexture` is learnopengl's; the single-color shader doesn't sample a texture.) Make sure to enable depth
testing again and set the stencil mask back to `0xFF` afterwards. OpenGL is a state machine: whatever we leave set
stays set for the next frame – and `glClear` obeys the stencil mask too, so with the mask left at `0x00` the next
frame's `glClear` could not clear the stencil buffer.
:::
:::vulkan
Again a pipeline of its own: the outline pipeline needs the depth test *off*, so `createPipeline()` gets a third
parameter, `VkBool32 depthTestEnable`, in front of the other two:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkBool32 depthTestEnable, VkCompareOp stencilCompareOp, uint32_t stencilWriteMask, VkPipeline& pipeline) {
```

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable; // with the test off nothing is written either (like glDisable(GL_DEPTH_TEST))
```

The two existing pipelines pass `VK_TRUE`, and a third one, `VkPipeline outlinePipeline;` (destroyed in `cleanup()`),
is built from `stencil_testing.vert` and `stencil_single_color.frag` with the outline's state:

```cpp
        // the floor does not write to the stencil buffer (write mask 0x00); the cubes write 1 wherever they are drawn
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_TRUE, VK_COMPARE_OP_ALWAYS, 0x00, floorPipeline);
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_TRUE, VK_COMPARE_OP_ALWAYS, 0xFF, graphicsPipeline);
        // the outlines: one colour, only where the stencil value is not 1, no stencil writes, no depth test
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_single_color.frag.spv", VK_FALSE, VK_COMPARE_OP_NOT_EQUAL, 0x00, outlinePipeline);
```

The reference value is 1 in every pipeline, so NOT_EQUAL compares with 1. In `recordCommandBuffer()`, after the cubes:

```cpp
        // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
        // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
        // the objects' size differences, making it look like borders.
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, outlinePipeline);
        float scale = 1.1f;
        // cubes
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // nothing to restore: every pipeline carries its own depth and stencil state
```

learnopengl's step 8 – enable depth testing again and restore the stencil settings – has no equivalent here. OpenGL
needs it because its state is global and stays set; in Vulkan each pipeline carries its complete depth and stencil
state, and the next frame starts by binding `floorPipeline` again. Nor does the stencil clear depend on a mask: the
render pass's load op clears the whole stencil buffer, whatever the pipelines' write masks are.
:::
:::d3d12
Again a PSO of its own. The last task's `// TODO:` line before `m_singleColorPipelineState` is created gets the
outline's state:

```cpp
        // Only where the stencil value is not 1 (NOT_EQUAL with the reference value 1), no
        // stencil writes, and no depth test: the outlines are drawn over everything.
        psoDesc.DepthStencilState.FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_NOT_EQUAL;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
        psoDesc.DepthStencilState.StencilWriteMask = 0x00;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
```

`DepthEnable = FALSE` is OpenGL's `glDisable(GL_DEPTH_TEST)`: no depth test and no depth writes. In
`PopulateCommandList`, after the cubes:

```cpp
    // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
    // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
    // the objects' size differences, making it look like borders.
    m_commandList->SetPipelineState(m_singleColorPipelineState.Get());
    float scale = 1.1f;
    model = XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(-1.0f, 0.0f, -1.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(2.0f, 0.0f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // Nothing to restore for the next frame: the depth and stencil states belong to the
    // pipeline state objects, Reset sets the stencil reference back to 0, and
    // ClearDepthStencilView ignores the write mask (OpenGL's glClear obeys glStencilMask).
```

Scale first, then move: DirectXMath multiplies row vectors from the left, so `XMMatrixScaling(…) *
XMMatrixTranslation(…)` scales the cube and then translates it – the same as GLM's `translate` followed by `scale`.
The reference value 1, set before the cubes, still holds. learnopengl's step 8 – enable depth testing again and
restore the stencil settings – has no equivalent here, for the reasons in the last comment: OpenGL needs it because
its state is global and stays set; in Direct3D 12 each PSO carries its complete depth and stencil state.
:::

:::opengl
```quiz
Why does the OpenGL loop end with `glStencilMask(0xFF)`, `glStencilFunc(GL_ALWAYS, 0, 0xFF)` and `glEnable(GL_DEPTH_TEST)`?
- [ ] The outline draw calls only run after these calls
- [ ] To clear the stencil buffer for the next frame
- [x] OpenGL's state is global and stays set into the next frame – and `glClear` obeys the stencil mask, so with the mask left at 0x00 the stencil buffer would not be cleared
---
The 2nd pass left the depth test off, the mask at 0x00 and the function at NOTEQUAL. The next frame's floor and cubes need the depth test, and its `glClear(… | GL_STENCIL_BUFFER_BIT)` writes through the stencil mask like any other stencil write.
```
:::
:::vulkan
```quiz
learnopengl ends the frame by restoring the depth test and the stencil mask. Why does the Vulkan version have nothing to restore?
- [ ] Vulkan resets all state at the end of each command buffer
- [ ] The outline pipeline is created last, so it overrides the others
- [x] Each pipeline carries its complete depth and stencil state, and the render pass's load op clears the stencil buffer regardless of any write mask
---
Binding `floorPipeline` at the start of the next frame brings its own state (depth test on, write mask 0x00) with it. In OpenGL, the state of the last draw stays global – and `glClear` obeys `glStencilMask`, which is why learnopengl must set the mask back to 0xFF.
```
:::
:::d3d12
```quiz
learnopengl ends the frame by restoring the depth test and the stencil mask. Why does the Direct3D 12 version have nothing to restore?
- [ ] Direct3D 12 resets all state at the end of each frame's `Present`
- [ ] The outline PSO is created last, so it overrides the others
- [x] Each PSO carries its complete depth and stencil state, `ClearDepthStencilView` ignores the write mask, and the command list's `Reset` sets the stencil reference back to 0
---
Selecting `m_floorPipelineState` in the next frame brings its own state (depth test on, write mask 0x00) with it. In OpenGL, the state of the last draw stays global – and `glClear` obeys `glStencilMask`, which is why learnopengl must set the mask back to 0xFF.
```
:::

Now do the task **outline**, then build and run. Both cubes now have a solid dark teal border, about 8 to 15 pixels
wide, around everything you can see of them – at the top over the background and at the bottom over the floor, because
the depth test is off. The cubes themselves, the floor and the background are unchanged.

```quiz
The scaled cubes are drawn in full, but only a ring around each cube appears. Why?
- [ ] The vertex shader moves only the edge vertices outwards
- [x] Where the original cube was drawn, the stencil value is 1, so NOT_EQUAL discards those fragments; only the part of the bigger cube that lies outside the original passes
- [ ] The depth test discards the inside, because the scaled cube lies behind the original
- [ ] The single-color shader is transparent in the middle
---
The stencil buffer remembers the original cubes' silhouette. The 10% larger cube covers that silhouette plus a margin around it; the margin is all that passes the test. The depth test plays no part – it is off for the outlines.
```

You can see that the borders overlap between both containers, which is usually the effect that we want (think of
strategy games where we want to select 10 units; merging borders is generally preferred). If you want a complete
border per object you'd have to clear the stencil buffer per object and get a little creative with the depth buffer.

The object outlining algorithm you've seen is commonly used in games to visualize selected objects (think of strategy
games) and such an algorithm can easily be implemented within a model class. You could set a boolean flag within the
model class to draw either with borders or without. If you want to be creative you could even give the borders a
more natural look with the help of post-processing filters like Gaussian Blur.

Note that scaling an object around its own origin only gives an even border for objects like our cubes, whose center
is at the origin of their local space; for other models you would push the vertices out along their normals instead.

Stencil testing has many more purposes (beside outlining objects) like drawing textures inside a rear-view mirror so
it neatly fits into the mirror shape, or rendering real-time shadows with a stencil buffer technique called *shadow
volumes*. Stencil buffers give us yet another nice tool in our already extensive {{api}} toolkit.
