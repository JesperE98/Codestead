# Advanced GLSL

This chapter won't really show you super advanced cool new features that give an enormous boost to your scene's
visual quality. This chapter goes more or less into some interesting aspects of {{shaderLanguage}} and some nice tricks
that may help you in your future endeavors – basically some *good to knows* and *features that may make your life
easier* when creating {{api}} applications in combination with {{shaderLanguage}}.

We'll discuss some interesting *built-in variables*, new ways to organize shader input and output, and a very useful
tool called *uniform buffer objects*.

:::vulkan
Vulkan's shaders are written in GLSL too – compiled to SPIR-V – so most of learnopengl's chapter applies directly.
Where Vulkan's GLSL differs from OpenGL's, this chapter says so.
:::
:::d3d12
learnopengl's chapter is about GLSL; Direct3D 12's shaders are written in HLSL. Every idea of the chapter has an HLSL
counterpart, often with a different name and form, and this chapter shows each one next to the GLSL original.
:::

:::opengl
The project is once more the *Depth testing* scene – two marble cubes, the metal floor, the camera at (0, 0, 3) – with
the *Face culling* chapter's cube, whose triangles are all counter-clockwise seen from outside. Face culling is off, so
it looks exactly like learnopengl's cube. The last task replaces the scene with learnopengl's uniform buffer demo; its
shaders (`uniform_buffer.vs`, `red.fs`, `green.fs`, `blue.fs`, `yellow.fs`) are already in the project.
:::
:::vulkan
The project is once more the *Depth testing* scene – two marble cubes, the metal floor, the camera at (0, 0, 3) – with
the *Face culling* chapter's cube, whose triangles are all counter-clockwise seen from outside. The pipeline culls
nothing (`VK_CULL_MODE_NONE`, `VK_FRONT_FACE_CLOCKWISE`), so it looks exactly like learnopengl's cube. The last task
replaces the scene with learnopengl's uniform buffer demo; its shaders (`shaders/uniform_buffer.vert`, `red.frag`,
`green.frag`, `blue.frag`, `yellow.frag`) are already in the project.
:::
:::d3d12
The project is once more the *Depth testing* scene – two marble cubes, the metal floor, the camera at (0, 0, 3) – with
the *Face culling* chapter's cube, whose triangles are all counter-clockwise seen from outside, and
`psoDesc.RasterizerState.FrontCounterClockwise = TRUE;`. `CullMode` is still `D3D12_CULL_MODE_NONE`, so it looks
exactly like learnopengl's cube. The shaders are in `advanced_glsl.hlsl`. The last task replaces the scene with
learnopengl's uniform buffer demo; its shaders (`uniform_buffer.hlsl`, `red.hlsl`, `green.hlsl`, `blue.hlsl`,
`yellow.hlsl`) are already in the project.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## GLSL's built-in variables

Shaders are extremely pipelined; if we need data from any other source outside of the current shader we'll have to
pass data around. We learned to do this via vertex attributes, uniforms, and samplers. There are however a few extra
variables defined by the shading language itself, which give us an extra means to gather and/or write data.

:::opengl
GLSL defines several such *built-in variables*, prefixed with `gl_`. We've already seen two of them in the chapters so
far: `gl_Position`, the output vector of the vertex shader, and the fragment shader's `gl_FragCoord`, which we
used in the *Depth testing* chapter to look at the depth values.
:::
:::vulkan
GLSL defines several such *built-in variables*, prefixed with `gl_`. We've already seen two of them in the chapters so
far: `gl_Position`, the output vector of the vertex shader, and the fragment shader's `gl_FragCoord`, which we
used in the *Depth testing* chapter to look at the depth values. Vulkan's GLSL has nearly all of them; a few are
renamed.
:::
:::d3d12
HLSL has no variables with fixed names for this. Instead, a shader's inputs and outputs are marked with
*system-value semantics*, names that start with `SV_`: whatever variable or struct member you tag with
`SV_POSITION`, `SV_TARGET`, `SV_IsFrontFace` … is wired to that built-in value. We've used two of them in every
shader so far: `SV_POSITION`, the clip-space position the vertex shader returns (GLSL's `gl_Position`), and
`SV_TARGET`, the colour the pixel shader returns.
:::

We'll discuss a few interesting built-in input and output variables of the shading language and explain how they
might benefit us.

### Vertex shader variables

:::opengl
We've already seen `gl_Position`, which is the clip-space output position vector of the vertex shader. Setting
`gl_Position` in the vertex shader is a strict requirement if you want to render anything on the screen. Nothing we
haven't seen before.
:::
:::vulkan
We've already seen `gl_Position`, which is the clip-space output position vector of the vertex shader. Setting
`gl_Position` in the vertex shader is a strict requirement if you want to render anything on the screen. Nothing we
haven't seen before.
:::
:::d3d12
We've already seen `SV_POSITION`, the clip-space position the vertex shader returns (in our shaders the `position`
member of the struct `VSMain` returns). Writing it is a strict requirement if you want to render anything on the
screen. Nothing we haven't seen before.
:::

#### gl_PointSize

One of the render primitives we're able to choose from is points, in which case each single vertex is a primitive
and rendered as a point.

:::opengl
It is possible to set the size of the points being rendered via OpenGL's `glPointSize` function, but we can also
influence this value in the vertex shader. One output variable defined by GLSL is called `gl_PointSize` that is a
`float` variable where you can set the point's width and height in pixels. By setting the point's size in the vertex
shader we get per-vertex control over this point's dimensions.

Influencing the point sizes in the vertex shader is disabled by default, but if you want to enable this you'll have to
enable OpenGL's `GL_PROGRAM_POINT_SIZE`:

```cpp
glEnable(GL_PROGRAM_POINT_SIZE);
```

A simple example of influencing point sizes is by setting the point size equal to the clip-space position's z value
which is equal to the vertex's distance to the viewer. The point size should then increase the further we are from the
vertices as the viewer:

```glsl
void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
    gl_PointSize = gl_Position.z;
}
```
:::
:::vulkan
Vulkan has no `glPointSize` and no switch like OpenGL's `GL_PROGRAM_POINT_SIZE`: when the pipeline's topology is
`VK_PRIMITIVE_TOPOLOGY_POINT_LIST`, the size of each point comes from the vertex shader's `gl_PointSize`, a `float`
with the point's width and height in pixels. So the vertex shader has to write it (unless the device enables the
`maintenance5` feature, which makes 1.0 the default). Sizes other than 1.0 need the device feature `largePoints`, and
the supported range is the device limit `pointSizeRange`.

A simple example of influencing point sizes is by setting the point size equal to the clip-space position's z value
which is equal to the vertex's distance to the viewer. The point size should then increase the further we are from the
vertices as the viewer:

```glsl
void main() {
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
    gl_PointSize = gl_Position.z;
}
```
:::
:::d3d12
Here Direct3D 12 has no equivalent: a point (`D3D_PRIMITIVE_TOPOLOGY_POINTLIST`) is always rasterized as a single
pixel. HLSL's `PSIZE` semantic is a leftover of Direct3D 9 and has no special meaning from Direct3D 10 on. If you need bigger
points – particles, for instance – you draw each one as a small quad: two triangles, or a geometry shader that turns
each point into a quad.
:::

You can imagine that varying the point size per vertex is interesting for techniques like particle generation.

#### gl_VertexID

:::opengl
The `gl_Position` and `gl_PointSize` are *output variables* since their value is read as output from the vertex
shader; we can influence the result by writing to them. The vertex shader also gives us an interesting *input
variable*, that we can only read from, called `gl_VertexID`.

The integer variable `gl_VertexID` holds the current ID of the vertex we're drawing. When doing *indexed rendering*
(with `glDrawElements`) this variable holds the current index of the vertex we're drawing. When drawing without
indices (via `glDrawArrays`) this variable holds the number of the currently processed vertex since the start of the
render call.
:::
:::vulkan
The `gl_Position` and `gl_PointSize` are *output variables* since their value is read as output from the vertex
shader; we can influence the result by writing to them. The vertex shader also gives us an interesting *input
variable*, that we can only read from: OpenGL's `gl_VertexID`, which Vulkan's GLSL calls `gl_VertexIndex`.

The integer variable `gl_VertexIndex` holds the index of the vertex we're drawing. When doing *indexed rendering*
(`vkCmdDrawIndexed`) it is the vertex's index from the index buffer plus `vertexOffset`; when drawing without indices
(`vkCmdDraw`) it counts from `firstVertex` – our floor's vertices are 36 to 41. (Likewise, OpenGL's `gl_InstanceID` is
`gl_InstanceIndex` in Vulkan.)
:::
:::d3d12
The `SV_POSITION` output is an *output* since its value is read as output from the vertex shader. The vertex shader
also gets interesting *inputs* from the system that we can only read: OpenGL's `gl_VertexID` is HLSL's `SV_VertexID`,
an unsigned integer you add as a parameter to the vertex shader:

```hlsl
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD, uint vertexID : SV_VertexID)
```

It holds the ID of the vertex we're drawing: with `DrawIndexedInstanced` the vertex's index from the index buffer,
with `DrawInstanced` a counter of the vertices of the draw. (Likewise, `gl_InstanceID` is `SV_InstanceID`.)
:::

Although not particularly useful right now, it's good to know that we have access to info like this.

### Fragment shader variables

Within the fragment shader we also have access to some interesting variables.

:::opengl
GLSL gives us two interesting input variables called `gl_FragCoord` and `gl_FrontFacing`.
:::
:::vulkan
GLSL gives us two interesting input variables called `gl_FragCoord` and `gl_FrontFacing`.
:::
:::d3d12
HLSL gives the pixel shader the same two interesting inputs: `SV_POSITION` (GLSL's `gl_FragCoord`) and
`SV_IsFrontFace` (GLSL's `gl_FrontFacing`).
:::

#### gl_FragCoord

:::opengl
We've seen the `gl_FragCoord` a couple of times before during the discussion of depth testing, because the z
component of the `gl_FragCoord` vector is equal to the depth value of that particular fragment. However, we can also
use the x and y component of that vector for some interesting effects.

The `gl_FragCoord`'s x and y component are the window- or screen-space coordinates of the fragment, originating from
the bottom-left of the window. We specified a render window of 800x600 with `glViewport` so the screen-space
coordinates of the fragment will have x values between 0 and 800, and y values between 0 and 600. A fragment's
coordinates are the centre of its pixel: the bottom-left pixel is at (0.5, 0.5).
:::
:::vulkan
We've seen the `gl_FragCoord` a couple of times before during the discussion of depth testing, because the z
component of the `gl_FragCoord` vector is equal to the depth value of that particular fragment. However, we can also
use the x and y component of that vector for some interesting effects.

The `gl_FragCoord`'s x and y component are the framebuffer coordinates of the fragment, in pixels. Here Vulkan differs
from OpenGL: Vulkan's GLSL puts the origin at the **top-left** of the framebuffer (OpenGL's is the bottom-left). Our
800x600 window gives x values between 0 and 800 and y values between 0 and 600 – y counting downwards. A fragment's
coordinates are the centre of its pixel: the top-left pixel is at (0.5, 0.5). x is the same as in OpenGL.
:::
:::d3d12
We've seen the depth value of a pixel before, in the depth testing chapter. In the pixel shader, the input with the
`SV_POSITION` semantic is no longer the clip-space position the vertex shader wrote: the rasterizer has turned it into
the pixel's position in the render target – GLSL's `gl_FragCoord`. Its z component is the pixel's depth value, and its
x and y components can be used for some interesting effects.

Here Direct3D differs from OpenGL: the origin is the **top-left** of the render target (OpenGL's is the bottom-left).
Our 800x600 window gives x values between 0 and 800 and y values between 0 and 600 – y counting downwards. A pixel's
coordinates are its centre: the top-left pixel is at (0.5, 0.5). x is the same as in OpenGL. Because our
`PSInput` struct is both what the vertex shader returns and what the pixel shader takes, the same member `position`
means clip space in one stage and pixel coordinates in the other.
:::

Using the fragment shader we could calculate a different color value based on the screen coordinate of the fragment.
A common usage for the `gl_FragCoord` variable is for comparing visual output of different fragment calculations, as
usually seen in tech demos. We could for example split the screen in two by rendering one output to the left side of
the window and another output on the right side of the window.

:::opengl
Now do the first task, **frag-coord**: in `advanced_glsl.fs`, replace the texture lookup with an output based on the
fragment's window coordinates:

```glsl
    if(gl_FragCoord.x < 400) // gl_FragCoord: the fragment's window position in pixels (origin at the bottom-left)
        FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    else
        FragColor = vec4(0.0, 1.0, 0.0, 1.0);
```
:::
:::vulkan
Now do the first task, **frag-coord**: in `shaders/advanced_glsl.frag`, replace the texture lookup with an output
based on the fragment's window coordinates:

```glsl
    if (gl_FragCoord.x < 400) { // gl_FragCoord: the fragment's window position in pixels (in Vulkan from the top-left)
        outColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        outColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
```
:::
:::d3d12
Now do the first task, **frag-coord**: in `PSMain` (`advanced_glsl.hlsl`), replace the texture lookup with an output
based on the pixel's window coordinates:

```hlsl
    // SV_POSITION in the pixel shader: the pixel's position in the window, in pixels
    // (origin at the top-left; GLSL's gl_FragCoord has its origin at the bottom-left).
    if (input.position.x < 400.0f)
        return float4(1.0f, 0.0f, 0.0f, 1.0f);
    else
        return float4(0.0f, 1.0f, 0.0f, 1.0f);
```
:::

Because the width of the window is equal to 800, whenever a pixel's x-coordinate is less than 400 it must be at the
left side of the window and we'll give that fragment a different color. Press **Build & run**: everything drawn – the
cubes and the floor – is red left of the window's middle and green right of it, while the background, where no
fragments are drawn, stays dark.

We can now calculate two completely different fragment shader results and display each of them on a different side
of the window. This is great for testing out different lighting techniques for example.

:::opengl
```quiz
What are `gl_FragCoord.x` and `gl_FragCoord.y` for the fragment of the top-left pixel of the 800x600 window?
- [ ] (0.0, 0.0)
- [ ] (0.5, 0.5)
- [x] (0.5, 599.5)
- [ ] (400.0, 300.0)
---
OpenGL's window coordinates start at the bottom-left, and a fragment's coordinates are its pixel's centre. The top row of the window is y = 599.5.
```
:::
:::vulkan
```quiz
What are `gl_FragCoord.x` and `gl_FragCoord.y` for the fragment of the top-left pixel of the 800x600 window in Vulkan?
- [ ] (0.0, 0.0)
- [x] (0.5, 0.5)
- [ ] (0.5, 599.5)
- [ ] (400.0, 300.0)
---
Vulkan's framebuffer coordinates start at the top-left, and a fragment's coordinates are its pixel's centre. In OpenGL the same pixel would be (0.5, 599.5).
```
:::
:::d3d12
```quiz
What are x and y of the pixel shader's `SV_POSITION` input for the top-left pixel of the 800x600 window?
- [ ] (0.5, 599.5)
- [ ] (0.0, 0.0)
- [ ] (400.0, 300.0)
- [x] (0.5, 0.5)
---
Direct3D's render target coordinates start at the top-left, and a pixel's coordinates are its centre. GLSL's `gl_FragCoord` would give (0.5, 599.5) for the same pixel.
```
:::

#### gl_FrontFacing

:::opengl
Another interesting input variable in the fragment shader is the `gl_FrontFacing` variable. In the *face culling*
chapter we mentioned that OpenGL is able to figure out if a face is a front or back face due to the winding order of
the vertices. The `gl_FrontFacing` variable tells us if the current fragment is part of a front-facing or a
back-facing face. We could, for example, decide to output different colors for all back faces.

The `gl_FrontFacing` variable is a `bool` that is `true` if the fragment is part of a front face and `false`
otherwise.
:::
:::vulkan
Another interesting input variable in the fragment shader is the `gl_FrontFacing` variable. In the *face culling*
chapter we saw that Vulkan figures out if a face is a front or back face from the winding order of its vertices on
the screen and the pipeline's `frontFace`. The `gl_FrontFacing` variable tells us if the current fragment is part of a
front-facing or a back-facing face. We could, for example, decide to output different colors for all back faces.

The `gl_FrontFacing` variable is a `bool` that is `true` if the fragment is part of a front face and `false`
otherwise – by the pipeline's `frontFace`, the same rule culling uses.
:::
:::d3d12
Another interesting input of the pixel shader is the one with the `SV_IsFrontFace` semantic – GLSL's
`gl_FrontFacing`. In the *face culling* chapter we saw that Direct3D figures out if a face is a front or back face from
the winding order of its vertices on the screen and the PSO's `FrontCounterClockwise`. `SV_IsFrontFace` tells us if
the current pixel is part of a front-facing or a back-facing face. We could, for example, decide to output different
colors for all back faces.

You get it by adding a `bool` parameter with that semantic to the pixel shader: it is `true` if the pixel is part of a
front face and `false` otherwise – by the PSO's `FrontCounterClockwise`, the same rule culling uses.
:::

learnopengl's example textures the container with one texture on the outside and another on the inside. But from
outside a closed cube you only ever see front faces: to see the inside, the front faces have to go. So we cull the
front faces, as at the end of the *Face culling* chapter, and look into the cubes: what remains are the insides of
the far faces – back faces.

:::opengl
Now do the task **front-facing**. At the TODO after `glDepthFunc`, cull the front faces (our cube is counter-clockwise
from outside, OpenGL's default front):

```cpp
    glEnable(GL_CULL_FACE);
    glCullFace(GL_FRONT); // only the back faces are drawn: the insides of the cubes (and the floor, which is clockwise seen from above)
```

In `advanced_glsl.fs`, `texture1` becomes two samplers, and the output picks one by `gl_FrontFacing`:

```glsl
uniform sampler2D frontTexture;
uniform sampler2D backTexture;
```

```glsl
    if(gl_FrontFacing) // true for the front faces (counter-clockwise on screen), false for the back faces
        FragColor = texture(frontTexture, TexCoords);
    else
        FragColor = texture(backTexture, TexCoords);
```

The two samplers read texture units 0 and 1 (`shader.setInt("frontTexture", 0); shader.setInt("backTexture", 1);`
instead of `texture1`), and before the cubes' draws marble goes to unit 0 and metal to unit 1:

```cpp
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);  // front faces: marble
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, floorTexture); // back faces: metal
```

The floor's own `glBindTexture(GL_TEXTURE_2D, floorTexture)` now binds to unit 1, which is still active – fine, since
the floor is a back face.
:::
:::vulkan
Now do the task **front-facing**. In `createPipeline()`, make counter-clockwise the front (our cube is
counter-clockwise from outside – see the *Face culling* chapter) and cull the front faces:

```cpp
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE; // the cube's outside: counter-clockwise on screen (face culling chapter)
```

```cpp
        rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT; // only the back faces are drawn: the insides of the cubes (and the floor, which is clockwise seen from above)
```

The fragment shader needs a second texture. In `shaders/advanced_glsl.frag`:

```glsl
layout(binding = 1) uniform sampler2D frontTexture;
layout(binding = 2) uniform sampler2D backTexture;
```

```glsl
    if (gl_FrontFacing) { // true for the front faces (the pipeline's frontFace: counter-clockwise on screen)
        outColor = texture(frontTexture, fragTexCoord);
    } else {
        outColor = texture(backTexture, fragTexCoord);
    }
```

What OpenGL does with a second texture unit, Vulkan does with a second descriptor: the descriptor set layout gets a
third binding, `backSamplerLayoutBinding` (binding 2, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`,
`VK_SHADER_STAGE_FRAGMENT_BIT`); `createDescriptorSet` takes a second image view and writes it with a second
`VkDescriptorImageInfo` in `descriptorWrites[2]`; the pool holds 4 image descriptors (two in each set). The cubes' set
gets marble for the front and metal for the back, the floor's set metal for both:

```cpp
        createDescriptorSet(cubeTextureImageView, floorTextureImageView, textureSampler, cubeDescriptorSet);   // front faces marble, back faces metal
        createDescriptorSet(floorTextureImageView, floorTextureImageView, textureSampler, floorDescriptorSet); // metal on both sides
```
:::
:::d3d12
Now do the task **front-facing**. At the TODO, cull the front faces (`FrontCounterClockwise = TRUE` stays: our cube is
counter-clockwise from outside):

```cpp
        // Cull the front faces: only the back faces are drawn - the insides of the cubes (and
        // the floor, which is clockwise seen from above).
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;
```

The pixel shader needs a second texture and the `SV_IsFrontFace` input. In `advanced_glsl.hlsl`:

```hlsl
Texture2D frontTexture : register(t0);
Texture2D backTexture : register(t1);
```

```hlsl
float4 PSMain(PSInput input, bool isFrontFace : SV_IsFrontFace) : SV_TARGET
{
    if (isFrontFace)
        return frontTexture.Sample(wrapSampler, input.texCoord);
    else
        return backTexture.Sample(wrapSampler, input.texCoord);
}
```

What OpenGL does with a second texture unit, Direct3D 12 does with a second descriptor in the table of root parameter
2. The range now covers two SRVs, t0 and t1:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

A descriptor table points at consecutive descriptors in the heap, and ours are already in the right order: slot 1
holds marble, slot 2 metal. So one GPU handle at slot 1 gives t0 = marble and t1 = metal. In `PopulateCommandList` it
replaces `cubeTexture` and `floorTexture`:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE faceTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
```

`SetGraphicsRootDescriptorTable(2, faceTextures)` is set once before the cubes; the floor uses the same table (no call
before its draw) – it is a back face, so it gets metal as before.
:::

Press **Build & run**. The cubes keep their outlines, but now you look into them: the inside of the far face, framed by
the insides of the side faces – all in metal. Not a single pixel of marble is left, and the floor is unchanged.

```quiz
After the **front-facing** task there is no marble anywhere, although the front-face texture is marble. Why?
- [ ] The marble texture is no longer bound
- [x] The front faces are culled, so every fragment that is drawn belongs to a back face and reads the back-face texture
- [ ] The front faces are drawn, but the metal back faces are drawn over them
- [ ] The front-facing check is always false when culling is on
---
From outside a closed cube you only see front faces; with those culled, only the insides – back faces – remain. The floor is a back face too (clockwise seen from above), so it keeps its metal.
```

#### gl_FragDepth

:::opengl
The input variable `gl_FragCoord` is an input variable that allows us to read screen-space coordinates and get the
depth value of the current fragment, but it is a *read-only* variable. We can't influence the screen-space coordinates
of the fragment, but it is possible to set the depth value of the fragment. GLSL gives us an output variable called
`gl_FragDepth` that we can use to manually set the depth value of the fragment within the shader.

To set the depth value in the shader we write any value between 0.0 and 1.0 to the output variable:

```glsl
gl_FragDepth = 0.0; // this fragment now has a depth value of 0.0
```

If the shader does not write anything to `gl_FragDepth`, the variable will automatically take its value from
`gl_FragCoord.z`.
:::
:::vulkan
The input variable `gl_FragCoord` is an input variable that allows us to read screen-space coordinates and get the
depth value of the current fragment, but it is a *read-only* variable. We can't influence the screen-space coordinates
of the fragment, but it is possible to set the depth value of the fragment. GLSL gives us an output variable called
`gl_FragDepth` that we can use to manually set the depth value of the fragment within the shader – in Vulkan just as
in OpenGL.

To set the depth value in the shader we write any value between 0.0 and 1.0 to the output variable:

```glsl
gl_FragDepth = 0.0; // this fragment now has a depth value of 0.0
```

If the shader does not write anything to `gl_FragDepth`, the depth comes from `gl_FragCoord.z`.
:::
:::d3d12
The pixel shader's `SV_POSITION` input lets us read the pixel's position and depth, but changing it changes nothing:
it's an input. It is possible to set the depth value of the pixel, though, with an *output* tagged `SV_Depth` –
GLSL's `gl_FragDepth`. The pixel shader then returns a struct with the colour and the depth:

```hlsl
struct PSOutput
{
    float4 color : SV_TARGET;
    float depth : SV_Depth;
};

PSOutput PSMain(PSInput input)
{
    PSOutput output;
    output.color = float4(1.0f, 1.0f, 1.0f, 1.0f);
    output.depth = 0.0f; // this pixel now has a depth value of 0.0
    return output;
}
```

If the pixel shader has no `SV_Depth` output, the depth is the one the rasterizer interpolated (`SV_POSITION`'s z).
:::

Setting the depth value manually has a major disadvantage however. That is because the GPU usually disables *early
depth testing* (as discussed in the depth testing chapter) as soon as the fragment shader writes the depth. It is
disabled, because the GPU cannot know what depth value the fragment will have *before* we run the fragment shader,
since the fragment shader may actually change this value.

By writing the depth yourself you should take this performance penalty into consideration. There is, however, a way
to keep part of the benefit: *conservative depth*, where you promise the GPU in which direction you'll change the
depth value.

:::opengl
From OpenGL 4.2 however, we can still sort of mediate between both sides by redeclaring the `gl_FragDepth` variable at
the top of the fragment shader with a *depth condition*:

```glsl
layout (depth_<condition>) out float gl_FragDepth;
```

This `condition` can take the following values:

| Condition | Description |
| --- | --- |
| `any` | The default value. Early depth testing is disabled. |
| `greater` | You can only make the depth value larger compared to `gl_FragCoord.z`. |
| `less` | You can only make the depth value smaller compared to `gl_FragCoord.z`. |
| `unchanged` | If you write to `gl_FragDepth`, you will write exactly `gl_FragCoord.z`. |

By specifying `greater` or `less` as the depth condition, OpenGL can make the assumption that you'll only write depth
values larger or smaller than the fragment's depth value. This way OpenGL is still able to do early depth testing when
the depth buffer value is part of the other direction of `gl_FragCoord.z`.

An example of where we increase the depth value in the fragment shader, but still want to preserve some of the early
depth testing is shown in the fragment shader below:

```glsl
#version 420 core // note the GLSL version!
out vec4 FragColor;
layout (depth_greater) out float gl_FragDepth;

void main()
{
    FragColor = vec4(1.0);
    gl_FragDepth = gl_FragCoord.z + 0.1;
}
```

Do note that this feature is only available from OpenGL version 4.2 or higher – not in our OpenGL 3.3.
:::
:::vulkan
Vulkan's GLSL (`#version 450`) supports the same *depth condition* that OpenGL has from version 4.2: you redeclare
`gl_FragDepth` at the top of the fragment shader:

```glsl
layout (depth_<condition>) out float gl_FragDepth;
```

This `condition` can take the following values:

| Condition | Description |
| --- | --- |
| `any` | The default value. Early depth testing is disabled. |
| `greater` | You can only make the depth value larger compared to `gl_FragCoord.z`. |
| `less` | You can only make the depth value smaller compared to `gl_FragCoord.z`. |
| `unchanged` | If you write to `gl_FragDepth`, you will write exactly `gl_FragCoord.z`. |

By specifying `greater` or `less`, the GPU can assume that you'll only write depth values larger or smaller than the
fragment's depth value, and can still test early when the stored depth lies on the other side:

```glsl
#version 450
layout(location = 0) out vec4 outColor;
layout (depth_greater) out float gl_FragDepth;

void main() {
    outColor = vec4(1.0);
    gl_FragDepth = gl_FragCoord.z + 0.1;
}
```
:::
:::d3d12
HLSL (from shader model 5.0) has two more depth semantics for this: `SV_DepthGreaterEqual` and `SV_DepthLessEqual`.
They promise that the depth you write is greater (or less) than or equal to the rasterized one, so the GPU can still
test early when the stored depth lies on the other side:

```hlsl
struct PSOutput
{
    float4 color : SV_TARGET;
    float depth : SV_DepthGreaterEqual; // the depth only ever grows
};

PSOutput PSMain(PSInput input)
{
    PSOutput output;
    output.color = float4(1.0f, 1.0f, 1.0f, 1.0f);
    output.depth = input.position.z + 0.1f;
    return output;
}
```
:::

```quiz
Why can writing the depth value in the fragment shader make rendering slower?
- [x] The GPU can't run the depth test before the fragment shader any more, because the depth is only known after it
- [ ] Because the depth buffer has to be cleared again for every fragment
- [ ] Because a written depth value is stored with more precision
- [ ] Because the vertex shader then runs twice
---
Early depth testing throws hidden fragments away before shading them. If the shader may change the depth, the test has to wait for the shader – unless a conservative depth promise (greater/less) lets the GPU decide some cases early anyway.
```

## Interface blocks

So far, every time we sent data from the vertex to the fragment shader we declared several matching input/output
variables. Declaring these one at a time is the easiest way to send data from one shader to another, but as
applications become larger you probably want to send more than a few variables over.

:::opengl
To help us organize these variables GLSL offers us something called *interface blocks* that allows us to group
variables together. The declaration of such an interface block looks a lot like a `struct` declaration, except that
it is now declared using an `in` or `out` keyword based on the block being an input or an output block.

Now do the task **interface-block**. In `advanced_glsl.vs`:

```glsl
out VS_OUT
{
    vec2 TexCoords;
} vs_out;
```

```glsl
    vs_out.TexCoords = aTexCoords;
```

This time we declared an interface block called `VS_OUT` that groups together all the output variables we want to
send to the next shader. This is kind of a trivial example, but you can imagine that this helps organize your
shaders' inputs/outputs. It is also useful when we want to group shader input/output into arrays as we'll see in the
next chapter about geometry shaders.

Then we also need to declare an input interface block in the next shader which is the fragment shader. The *block
name* (`VS_OUT`) should be the same in the fragment shader, but the *instance name* (`vs_out` as used in the vertex
shader) can be anything we like – avoiding confusing names like `vs_out` for a fragment struct containing input
values. In `advanced_glsl.fs`:

```glsl
in VS_OUT
{
    vec2 TexCoords;
} fs_in;
```

```glsl
    if(gl_FrontFacing) // true for the front faces (counter-clockwise on screen), false for the back faces
        FragColor = texture(frontTexture, fs_in.TexCoords);
    else
        FragColor = texture(backTexture, fs_in.TexCoords);
```

As long as both interface block names are equal, their corresponding input and output is matched together.
:::
:::vulkan
To help us organize these variables GLSL offers us something called *interface blocks* that allows us to group
variables together. The declaration of such an interface block looks a lot like a `struct` declaration, except that
it is now declared using an `in` or `out` keyword based on the block being an input or an output block.

Now do the task **interface-block**. In `shaders/advanced_glsl.vert`:

```glsl
layout(location = 0) out VS_OUT {
    vec2 texCoord;
} vs_out;
```

```glsl
    vs_out.texCoord = inTexCoord;
```

This time we declared an interface block called `VS_OUT` that groups together all the output variables we want to
send to the next shader. This is kind of a trivial example, but you can imagine that this helps organize your
shaders' inputs/outputs. It is also useful when we want to group shader input/output into arrays, as learnopengl's
geometry shader chapter shows.

Then we also need to declare an input interface block in the fragment shader. In `shaders/advanced_glsl.frag`:

```glsl
layout(location = 0) in VS_OUT {
    vec2 texCoord;
} fs_in;
```

```glsl
        outColor = texture(frontTexture, fs_in.texCoord);
    } else {
        outColor = texture(backTexture, fs_in.texCoord);
```

In OpenGL the stages' outputs and inputs are matched by name. Vulkan's GLSL matches them by `location`, which is why
the block gets `layout(location = 0)` – its member takes location 0, the location `fragTexCoord` had. Keep the block
name (`VS_OUT`) the same in both shaders, as GLSL asks; the *instance names* (`vs_out`, `fs_in`) may differ.
:::
:::d3d12
HLSL has no `in` or `out` blocks – it doesn't need them: the struct that the vertex shader returns and the pixel
shader takes already *is* an interface block. GLSL's

```glsl
out VS_OUT
{
    vec2 TexCoords;
} vs_out;
```

in the vertex shader and `in VS_OUT { … } fs_in;` in the fragment shader are, in HLSL, one struct used by both
stages. Now do the task **interface-block**: give our struct learnopengl's names – `PSInput` becomes `VS_OUT`, the
vertex shader's variable `vs_out` and the pixel shader's parameter `fs_in`:

```hlsl
struct VS_OUT
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
VS_OUT VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    VS_OUT vs_out;

    // model, then view, then projection (GLSL: projection * view * model * position).
    vs_out.position = mul(mul(mul(position, model), view), projection);
    vs_out.texCoord = texCoord;

    return vs_out;
}
```

```hlsl
float4 PSMain(VS_OUT fs_in, bool isFrontFace : SV_IsFrontFace) : SV_TARGET
{
    if (isFrontFace)
        return frontTexture.Sample(wrapSampler, fs_in.texCoord);
    else
        return backTexture.Sample(wrapSampler, fs_in.texCoord);
}
```

The stages are matched by the *semantics* (`SV_POSITION`, `TEXCOORD`), not by the names: the vertex shader's
`TEXCOORD` output arrives in the pixel shader's `TEXCOORD` input. The struct could even be declared twice, under two
names, in two files – as long as the semantics match.
:::

Press **Build & run**: nothing changes, not a single pixel. The block only organizes the shaders' inputs and outputs.

:::opengl
```quiz
The vertex shader declares `out VS_OUT { vec2 TexCoords; } vs_out;`. What must the fragment shader's input block have in common with it?
- [ ] The instance name `vs_out`
- [ ] Nothing: OpenGL matches blocks by their order in the file
- [x] The block name `VS_OUT` (and its members); the instance name may differ
- [ ] The `layout (std140)` qualifier
---
The block name connects the two stages; the instance name (`vs_out`, `fs_in`) is only how each shader refers to the block. That's why the fragment shader can call it `fs_in`.
```
:::
:::vulkan
```quiz
How does Vulkan connect the vertex shader's `VS_OUT` output block with the fragment shader's input block?
- [x] By `location`: the stages' outputs and inputs are matched by location, which is why the block gets `layout(location = 0)`
- [ ] By the instance names `vs_out` and `fs_in`
- [ ] By the order in which the pipeline lists the shader stages
- [ ] Through the descriptor set, like a uniform buffer
---
Vulkan's GLSL matches the interface between stages by location, not by name. The block's member takes location 0 – the location the plain `fragTexCoord` variable had before.
```
:::
:::d3d12
```quiz
How does Direct3D connect the vertex shader's output struct with the pixel shader's input?
- [ ] By the struct's name: both stages must use `VS_OUT`
- [x] By the semantics (`SV_POSITION`, `TEXCOORD`) of the members
- [ ] By the parameter names `vs_out` and `fs_in`
- [ ] Through the input layout of the PSO
---
HLSL matches what one stage writes with what the next reads by semantic. The struct's name and the variable names are only for you; the input layout is about the vertex shader's inputs from the vertex buffers.
```
:::

## Uniform buffer objects

:::opengl
We've been using OpenGL for quite a while now and learned some pretty cool tricks, but also a few annoyances. For
example, when using more than one shader we continuously have to set uniform variables where most of them are exactly
the same for each shader.

OpenGL gives us a tool called *uniform buffer objects* that allow us to declare a set of *global* uniform variables
that remain the same over any number of shader programs. When using uniform buffer objects we set the relevant
uniforms only **once** in fixed GPU memory. We do still have to manually set the uniforms that are unique per shader.
Creating and configuring a uniform buffer object requires a bit of work though.

Because a uniform buffer object is a buffer like any other buffer we can create one via `glGenBuffers`, bind it to the
`GL_UNIFORM_BUFFER` buffer target and store all the relevant uniform data into the buffer. There are certain rules as
to how the data for uniform buffer objects should be stored and we'll get to that later. First, we'll take a simple
vertex shader and store our `projection` and `view` matrix in a so called *uniform block*:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

layout (std140) uniform Matrices
{
    mat4 projection; // offset 0
    mat4 view;       // offset 64 (sizeof(glm::mat4))
};
uniform mat4 model;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

In most of our samples we set a projection and view uniform matrix every frame for each shader we're using. This is a
perfect example of where uniform buffer objects become useful since now we only have to store these matrices once.

Here we declared a uniform block called `Matrices` that stores two 4x4 matrices. Variables in a uniform block can be
directly accessed without the block name as a prefix. Then we store these matrix values in a buffer somewhere in the
OpenGL code and each shader that declares this uniform block has access to the matrices.

You're probably wondering right now what the `layout (std140)` statement means. What this says is that the currently
defined uniform block uses a specific memory layout for its content; this statement sets the *uniform block layout*.
:::
:::vulkan
In OpenGL, learnopengl introduces *uniform buffer objects* at this point: instead of setting the same uniforms – the
projection and view matrices – in every shader program separately, you declare them in a *uniform block* and store
them **once** in a buffer that every program reads.

In Vulkan you have been doing this since vulkan-tutorial's *Uniform buffers* chapters. Vulkan's GLSL has no loose
uniform variables at all (apart from opaque ones like samplers): every value comes from a block. Our vertex shader's

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;
```

is a uniform block, the `uniformBuffer` behind it is the uniform buffer object, and every pipeline that uses the same
descriptor set reads the same matrices. The per-object `model` matrix comes from a second kind of block, the push
constants (`layout(push_constant) uniform PushConstants`), which travel inside the command buffer. What remains to
learn from learnopengl's chapter is *how* the data is laid out in the buffer – the rules every uniform block follows,
in Vulkan as in OpenGL.
:::
:::d3d12
In OpenGL, learnopengl introduces *uniform buffer objects* at this point: instead of setting the same uniforms – the
projection and view matrices – in every shader program separately, you declare them in a *uniform block* and store
them **once** in a buffer that every program reads.

In Direct3D 12 you have been doing this since the *Coordinate systems* chapter. HLSL's *constant buffers* are uniform
blocks:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};
```

declares a block at register `b1` whose members are used by name, without a prefix – just like a GLSL uniform block.
The buffer behind it, `m_constantBuffer`, is the uniform buffer object, and every pipeline state that reads `b1` with
the same root signature reads the same matrices. The per-object `model` matrix comes from root constants
(`cbuffer ModelConstants : register(b0)`, set with `SetGraphicsRoot32BitConstants`), which travel inside the command
list. What remains to learn from learnopengl's chapter is *how* the data is laid out in the buffer – HLSL has its own
rules for that.
:::

## Uniform block layout

The content of a uniform block is stored in a buffer object, which is effectively nothing more than a reserved piece
of global GPU memory. Because this piece of memory holds no information on what kind of data it holds, we need to tell
the GPU what parts of the memory correspond to which uniform variables in the shader.

:::opengl
Imagine the following uniform block in a shader:

```glsl
layout (std140) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
};
```
:::
:::vulkan
Imagine the following uniform block in a shader:

```glsl
layout(binding = 0) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
} example;
```
:::
:::d3d12
Imagine the following GLSL uniform block in a shader:

```glsl
layout (std140) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
};
```
:::

What we want to know is the size (in bytes) and the offset (from the start of the block) of each of these variables
so we can place them in the buffer in their respective order. The size of each of the elements is clearly stated in
C++ and has a direct relation to C++ variables; vectors and matrices being (large) arrays of floats. What isn't
clearly stated is the *spacing* between the variables. This allows the hardware to position or pad variables as it
sees fit. The hardware is able to place a `vec3` adjacent to a `float` for example. Not all hardware can handle this
and pads the `vec3` to an array of 4 floats before appending the `float`. A great feature, but inconvenient for us.

:::opengl
By default, GLSL uses a uniform memory layout called a *shared* layout – shared because once the offsets are defined
by the hardware, they are consistently shared between multiple programs. With a shared layout GLSL is allowed to
reposition the uniform variables for optimization as long as the variables' order remains intact. Because we don't
know at what offset each uniform variable will be we don't know how to precisely fill our uniform buffer. We can query
this information with functions like `glGetUniformIndices`, but that's not the approach we're going to take in this
chapter.

While a shared layout gives us some space-saving optimizations, we'd need to query the offset for each and every
uniform variable which translates to a lot of work. The general practice however is to not use the shared layout, but
to use the *std140* layout. The std140 layout explicitly states the memory layout for each variable type by
standardizing their respective offsets governed by a set of rules. Since this is standardized we can manually figure
out the offsets for each variable.
:::
:::vulkan
In OpenGL a uniform block's default layout, *shared*, leaves the offsets to the driver, and you'd have to query them;
that's why learnopengl writes `layout (std140)`, a layout whose offsets are standardized by a set of rules. In
Vulkan's GLSL the choice is made for you: a uniform block uses **std140** by default (the *shared* and *packed*
layouts don't exist there), and a push constant block uses the tighter *std430*. Since the layout is standardized we
can manually figure out the offsets for each variable – and must, because the C++ struct we copy into the buffer has
to put every member at exactly that offset.
:::
:::d3d12
GLSL has several layouts for this; learnopengl uses *std140*, which standardizes the offset of each variable by a set
of rules. HLSL has one set of rules for constant buffers, the *packing rules for constant variables*. They look much
like std140 at first – both work in 16-byte units – but they pack tighter in one important case. Let's look at std140
first, then at what HLSL does differently.
:::

Each variable has a *base alignment* equal to the space a variable takes (including padding) within a uniform block
using the std140 layout rules. For each variable, we calculate its *aligned offset*: the byte offset of a variable
from the start of the block. The aligned byte offset of a variable **must** be equal to a multiple of its base
alignment.

The exact layout rules can be found at OpenGL's uniform buffer specification, but we'll list the most common rules
below. Each variable type in GLSL such as `int`, `float` and `bool` are defined to be four-byte quantities with each
entity of 4 bytes represented as `N`.

| Type | Layout rule |
| --- | --- |
| Scalar e.g. `int` or `bool` | Each scalar has a base alignment of N. |
| Vector | Either 2N or 4N. This means that a `vec3` has a base alignment of 4N. |
| Array of scalars or vectors | Each element has a base alignment equal to that of a `vec4`. |
| Matrices | Stored as a large array of column vectors, where each of those vectors has a base alignment of `vec4`. |
| Struct | Equal to the computed size of its elements according to the previous rules, but padded to a multiple of the size of a `vec4`. |

Like most of OpenGL's specifications it's easier to understand with an example. We're taking the uniform block called
`ExampleBlock` we introduced earlier and calculate the aligned offset for each of its members using the std140 layout:

```glsl
layout (std140) uniform ExampleBlock
{
                     // base alignment  // aligned offset
    float value;     // 4               // 0
    vec3 vector;     // 16              // 16  (offset must be multiple of 16 so 4->16)
    mat4 matrix;     // 16              // 32  (column 0)
                     // 16              // 48  (column 1)
                     // 16              // 64  (column 2)
                     // 16              // 80  (column 3)
    float values[3]; // 16              // 96  (values[0])
                     // 16              // 112 (values[1])
                     // 16              // 128 (values[2])
    bool boolean;    // 4               // 144
    int integer;     // 4               // 148
};
```

As an exercise, try to calculate the offset values yourself and compare them to this table. With these calculated
offset values, based on the rules of the std140 layout, we can fill the buffer with data at the appropriate offsets.
While not the most efficient, the std140 layout does guarantee us that the
memory layout remains the same over each program that declares this uniform block.

:::opengl
By adding the statement `layout (std140)` in the definition of the uniform block we tell OpenGL that this uniform
block uses the std140 layout. There are two other layouts to choose from that require us to query each offset before
filling the buffers. We've already seen the `shared` layout, with the other remaining layout being `packed`. When
using the `packed` layout, there is no guarantee that the layout remains the same between programs (not shared)
because it allows the compiler to optimize uniform variables away from the uniform block which may differ per shader.

Note that the matrices are stored as columns – and so does GLM: `glm::value_ptr` of a `glm::mat4` gives exactly the
four columns std140 expects, which is why we can copy GLM matrices into a uniform buffer as they are.
:::
:::vulkan
The same rules hold for our `UniformBufferObject`: two `mat4`, each four columns of 16 bytes, `view` at offset 0 and
`proj` at offset 64. The C++ struct with two `glm::mat4` has exactly this layout – GLM also stores matrices as columns
– so `memcpy` of the struct puts every byte in its place. For a block like `ExampleBlock` it wouldn't: a C++ struct
would put `vector` at offset 4, std140 expects it at 16. vulkan-tutorial's *Descriptor pool and sets* chapter shows the
fix: `alignas(16)` on such members of the C++ struct.
:::
:::d3d12
Here is the same block as an HLSL constant buffer, with HLSL's offsets:

```hlsl
cbuffer ExampleBlock
{
    float    value;     // offset 0
    float3   vector;    // offset 4: fits in the rest of the first 16 bytes
    float4x4 matrix;    // offset 16
    float    values[3]; // offsets 80, 96, 112: every array element starts a new 16 bytes
};
```

HLSL packs variables into 16-byte registers (four 4-byte components) and only moves a variable to the next register
when it would *straddle* a 16-byte boundary. A `float3` after a `float` fits into the rest of the register, so it
lands at offset 4 – where std140 would put it at 16. Arrays are the same in both: every element starts a new register.

Two more rules matter for Direct3D 12. A constant buffer view's size must be a multiple of 256 bytes
(`D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT`) – that's what the project's `CalculateConstantBufferByteSize`
rounds up to – and its start address must be 256-byte aligned too. And HLSL stores a matrix in a constant buffer
column by column by default (`column_major`), while DirectXMath stores an `XMMATRIX` row by row. That's why the project
transposes every matrix (`XMMatrixTranspose`) before copying it: the transposed rows are the original's columns,
exactly what HLSL expects.
:::

:::opengl
```quiz
In a `layout (std140)` uniform block, `float value;` is followed by `vec3 vector;`. At which byte offset does `vector` start?
- [ ] 4
- [ ] 12
- [x] 16
- [ ] 32
---
A `vec3` has a base alignment of 4N = 16 bytes, so its offset must be a multiple of 16. After the float at offset 0, the next multiple of 16 is 16 – bytes 4 to 15 are padding.
```
:::
:::vulkan
```quiz
In a uniform block of Vulkan's GLSL (std140 by default), `float value;` is followed by `vec3 vector;`. At which byte offset does `vector` start?
- [ ] 4
- [ ] 12
- [x] 16
- [ ] 32
---
A `vec3` has a base alignment of 4N = 16 bytes, so its offset must be a multiple of 16. After the float at offset 0, the next multiple of 16 is 16 – bytes 4 to 15 are padding. A plain C++ struct would put it at 4, hence `alignas(16)`.
```
:::
:::d3d12
```quiz
In an HLSL `cbuffer`, `float value;` is followed by `float3 vector;`. At which byte offset does `vector` start?
- [x] 4
- [ ] 12
- [ ] 16
- [ ] 32
---
HLSL only moves a variable to the next 16-byte register if it would straddle a boundary. The float3 needs 12 bytes, and 12 are left in the first register after the float – so it starts at 4, where GLSL's std140 would put it at 16.
```
:::

## Using uniform buffers

:::opengl
We've defined uniform blocks and specified their memory layout, but we haven't discussed how to actually use them
yet.

First, we need to create a uniform buffer object which is done via the familiar `glGenBuffers`. Once we have a buffer
object we bind it to the `GL_UNIFORM_BUFFER` target and allocate enough memory by calling `glBufferData`:

```cpp
unsigned int uboExampleBlock;
glGenBuffers(1, &uboExampleBlock);
glBindBuffer(GL_UNIFORM_BUFFER, uboExampleBlock);
glBufferData(GL_UNIFORM_BUFFER, 152, NULL, GL_STATIC_DRAW); // allocate 152 bytes of memory
glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Now whenever we want to update or insert data into the buffer, we bind to `uboExampleBlock` and use
`glBufferSubData` to update its memory. We only have to update this uniform buffer once, and all shaders that use
this buffer now use its updated data. But, how does OpenGL know what uniform buffers correspond to which uniform
blocks?

In the OpenGL context there is a number of *binding points* defined where we can link a uniform buffer to. Once we
created a uniform buffer we link it to one of those binding points and we also link the uniform block in the shader
to the same binding point, effectively linking them together: a shader's uniform block points at binding point 2,
say, and binding point 2 points at the buffer. Several shaders' blocks can point at the same binding point, and that
is how they share the data.

To set a shader uniform block to a specific binding point we call `glUniformBlockBinding` that takes a program object,
a uniform block index, and the binding point to link to. The *uniform block index* is a location index of the defined
uniform block in the shader. This can be retrieved via a call to `glGetUniformBlockIndex` that accepts a program
object and the name of the uniform block. We can set the `Lights` uniform block from a shader to binding point 2 as
follows:

```cpp
unsigned int lights_index = glGetUniformBlockIndex(shaderA.ID, "Lights");
glUniformBlockBinding(shaderA.ID, lights_index, 2);
```

Note that we have to repeat this process for **each** shader.

From OpenGL version 4.2 and onwards it is also possible to store the binding point of a uniform block explicitly in
the shader by adding another layout specifier, saving us the calls to `glGetUniformBlockIndex` and
`glUniformBlockBinding`. The following code sets the binding point of the `Lights` uniform block explicitly:

```glsl
layout(std140, binding = 2) uniform Lights { ... };
```

Then we also need to bind the uniform buffer object to the same binding point and this can be accomplished with
either `glBindBufferBase` or `glBindBufferRange`.

```cpp
glBindBufferBase(GL_UNIFORM_BUFFER, 2, uboExampleBlock);
// or
glBindBufferRange(GL_UNIFORM_BUFFER, 2, uboExampleBlock, 0, 152);
```

The function `glBindBufferBase` expects a target, a binding point index and a uniform buffer object. This function
links `uboExampleBlock` to binding point 2; from this point on, both sides of the binding point are linked. You can
also use `glBindBufferRange` that expects an extra offset and size parameter – this way you can bind only a specific
range of the uniform buffer to a binding point. Using `glBindBufferRange` you could have multiple different uniform
blocks linked to a single uniform buffer object (the offsets must then be multiples of
`GL_UNIFORM_BUFFER_OFFSET_ALIGNMENT`).

Now that everything is set up, we can start adding data to the uniform buffer. We could add all the data as a single
byte array, or update parts of the buffer whenever we feel like it using `glBufferSubData`. To update the uniform
variable `boolean` we could update the uniform buffer object as follows:

```cpp
glBindBuffer(GL_UNIFORM_BUFFER, uboExampleBlock);
int b = true; // bools in GLSL are represented as 4 bytes, so we store it in an integer
glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b);
glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

And the same procedure applies for all the other uniform variables inside the uniform block, but with different range
arguments.
:::
:::vulkan
Everything OpenGL does with binding points, Vulkan does with descriptors – you know the pieces from vulkan-tutorial:

- **The binding point** is the block's `layout(binding = 0)` (in descriptor set 0, the default `set`), declared in the
  shader – like OpenGL 4.2's `layout(std140, binding = 2)`. There is no `glUniformBlockBinding` to call.
- **The binding's type** is declared in the descriptor set layout: `uboLayoutBinding` with `binding = 0`,
  `VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER` and `stageFlags = VK_SHADER_STAGE_VERTEX_BIT`.
- **`glBindBufferRange`** is the descriptor's `VkDescriptorBufferInfo` – the buffer, an offset and a range:

```cpp
        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);
```

  written into the set with `vkUpdateDescriptorSets`. As in OpenGL, several blocks can use ranges of one buffer; the
  offsets must then be multiples of the device limit `minUniformBufferOffsetAlignment`.
- **Binding the buffer for drawing** is `vkCmdBindDescriptorSets`.
- **Updating the data** is what the previous chapter showed: write the mapped memory (`memcpy` into
  `uniformBufferMapped`, as `updateUniformBuffer()` does every frame) or record `vkCmdUpdateBuffer`. Updating one
  member means writing its bytes at its std140 offset – OpenGL's `glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b)`.
:::
:::d3d12
Everything OpenGL does with binding points, Direct3D 12 does with registers, the root signature and views – you know
the pieces from the *Coordinate systems* chapter:

- **The binding point** is the register in the shader: `cbuffer SceneConstantBuffer : register(b1)` – like OpenGL
  4.2's `layout(std140, binding = 2)`. There is no `glUniformBlockBinding` to call.
- **Which buffer feeds the register** is decided by the root signature: root parameter 1 is a descriptor table with a
  CBV range for register `b1` (`ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1)`).
- **`glBindBufferRange`** is the constant buffer view: `D3D12_CONSTANT_BUFFER_VIEW_DESC` with a `BufferLocation` (the
  GPU address of the buffer plus an offset) and a `SizeInBytes` – both multiples of 256. `CreateConstantBufferView`
  puts the view into the descriptor heap, and `SetGraphicsRootDescriptorTable(1, …)` points root parameter 1 at it.
- **Updating the data** is a `memcpy` into the persistently mapped upload buffer, as `OnUpdate` does every frame.
  Updating one member means writing its bytes at its offset – OpenGL's `glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b)`.
:::

## A simple example

So let's demonstrate a real example of uniform buffer objects. If we look back at all the previous code samples we've
continually been using 3 matrices: the projection, view and model matrix. Of all those matrices, only the model
matrix changes frequently. If we have multiple shaders that use this same set of matrices, we'd probably be better
off using uniform buffer objects.

We're going to store the projection and view matrix in a uniform block called `Matrices`. We're not going to store the
model matrix in there since the model matrix tends to change frequently between shaders, so we wouldn't really
benefit from uniform buffer objects.

learnopengl's demo draws four cubes, each with its own shader program and its own colour: red top-left, green
top-right, yellow bottom-left, blue bottom-right – all sharing one buffer with the projection and view.

:::opengl
Now do the last task, **uniform-buffer**. It replaces the scene: the floor, the textures and the face culling go. In
`uniform_buffer.vs`, the two plain uniforms become the uniform block (`model` stays a normal uniform):

```glsl
layout (std140) uniform Matrices
{
    mat4 projection; // offset 0
    mat4 view;       // offset 64 (sizeof(glm::mat4))
};
```

In `main.cpp`, four shader programs replace `shader`, all with the same vertex shader:

```cpp
    Shader shaderRed("uniform_buffer.vs", "red.fs");
    Shader shaderGreen("uniform_buffer.vs", "green.fs");
    Shader shaderBlue("uniform_buffer.vs", "blue.fs");
    Shader shaderYellow("uniform_buffer.vs", "yellow.fs");
```

The first thing we want to do is set the uniform block of the vertex shaders equal to binding point 0. Note that we
have to do this for each shader:

```cpp
    unsigned int uniformBlockIndexRed = glGetUniformBlockIndex(shaderRed.ID, "Matrices");
    unsigned int uniformBlockIndexGreen = glGetUniformBlockIndex(shaderGreen.ID, "Matrices");
    unsigned int uniformBlockIndexBlue = glGetUniformBlockIndex(shaderBlue.ID, "Matrices");
    unsigned int uniformBlockIndexYellow = glGetUniformBlockIndex(shaderYellow.ID, "Matrices");
    // then we link each shader's uniform block to this uniform binding point
    glUniformBlockBinding(shaderRed.ID, uniformBlockIndexRed, 0);
    glUniformBlockBinding(shaderGreen.ID, uniformBlockIndexGreen, 0);
    glUniformBlockBinding(shaderBlue.ID, uniformBlockIndexBlue, 0);
    glUniformBlockBinding(shaderYellow.ID, uniformBlockIndexYellow, 0);
```

Next we create the actual uniform buffer object and bind that buffer to binding point 0:

```cpp
    unsigned int uboMatrices;
    glGenBuffers(1, &uboMatrices);
    glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
    glBufferData(GL_UNIFORM_BUFFER, 2 * sizeof(glm::mat4), NULL, GL_STATIC_DRAW);
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
    // define the range of the buffer that links to a uniform binding point
    glBindBufferRange(GL_UNIFORM_BUFFER, 0, uboMatrices, 0, 2 * sizeof(glm::mat4));
```

First we allocate enough memory for our buffer which is equal to 2 times the size of `glm::mat4`. The size of GLM's
matrix types correspond directly to `mat4` in GLSL. Then we link a specific range of the buffer, in this case the
entire buffer, to binding point 0.

Now all that's left to do is fill the buffer. If we keep the field of view value constant of the projection matrix
(so no more camera zoom) we only have to update it once in our application – this means we only have to insert this
into the buffer only once as well. Because we already allocated enough memory in the buffer object we can use
`glBufferSubData` to store the projection matrix before we enter the render loop:

```cpp
    glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
    glBufferSubData(GL_UNIFORM_BUFFER, 0, sizeof(glm::mat4), glm::value_ptr(projection));
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Here we store the first half of the uniform buffer with the projection matrix. Then before we render the objects each
frame we update the second half of the buffer with the view matrix:

```cpp
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
        glBufferSubData(GL_UNIFORM_BUFFER, sizeof(glm::mat4), sizeof(glm::mat4), glm::value_ptr(view));
        glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

And that's it for uniform buffer objects. Each vertex shader that contains a `Matrices` uniform block will now contain
the data stored in `uboMatrices`. So if we now were to draw 4 cubes using 4 different shaders, their projection and
view matrix should be the same:

```cpp
        glBindVertexArray(cubeVAO);
        shaderRed.use();
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-0.75f, 0.75f, 0.0f)); // move top-left
        shaderRed.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // ... draw Green Cube
        // ... draw Blue Cube
        // ... draw Yellow Cube
```

The green cube goes to (0.75, 0.75, 0), the yellow one to (-0.75, -0.75, 0) and the blue one to (0.75, -0.75, 0).
The only uniform we still need to set is the `model` uniform. Remove `planeVertices`, the plane VAO, the two
`loadTexture` calls, the shader configuration and the face culling, and delete `uboMatrices` at the end.
:::
:::vulkan
Now do the last task, **uniform-buffer**. It replaces the scene with learnopengl's demo. In
`shaders/uniform_buffer.vert`, declare the same uniform block as `advanced_glsl.vert` – the same block at the same
binding – and use it:

```glsl
// one uniform buffer for all four pipelines (learnopengl's Matrices block): the same block, at the same binding
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;
```

```glsl
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
```

OpenGL's four shader programs are four pipelines in Vulkan – a pipeline holds its shaders. `graphicsPipeline` becomes
`redPipeline`, `greenPipeline`, `bluePipeline` and `yellowPipeline`. The colour shaders only read the position, so
`createPipeline` gets an `attributeCount` parameter (`vertexAttributeDescriptionCount = attributeCount`) and the four
pipelines pass 1:

```cpp
        // the shaders only read the position (1 attribute of a Vertex)
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/red.frag.spv", 1, redPipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/green.frag.spv", 1, greenPipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/blue.frag.spv", 1, bluePipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/yellow.frag.spv", 1, yellowPipeline);
```

Culling goes off again (`VK_CULL_MODE_NONE`), and the floor's descriptor set is no longer needed (the pool: 1 set, 1
uniform buffer descriptor, 2 image descriptors). Destroy the four pipelines in `cleanup()`.

Here comes the part OpenGL needs `glUniformBlockBinding` and `glBindBufferRange` for. In Vulkan nothing extra is
needed: all four pipelines are created with the same pipeline layout, and a descriptor set bound with
`vkCmdBindDescriptorSets` stays bound when you switch to another pipeline with a compatible layout. So
`recordCommandBuffer()` binds `cubeDescriptorSet` – it holds the uniform buffer at binding 0 – once, and then only
switches pipelines and pushes model matrices:

```cpp
        // the set with the uniform buffer (binding 0), shared by the four pipelines (the colour shaders read no texture)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);

        // RED
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, redPipeline);
        model = glm::translate(model, glm::vec3(-0.75f, 0.75f, 0.0f)); // move top-left
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // ... GREEN, YELLOW, BLUE
```

The green cube goes to (0.75, 0.75, 0), the yellow one to (-0.75, -0.75, 0) and the blue one to (0.75, -0.75, 0),
each with its own pipeline. Remove the old `vkCmdBindPipeline` of `graphicsPipeline` after `vkCmdBeginRenderPass`.
`updateUniformBuffer()` stays as it is: it writes view and projection once per frame, and all four pipelines read them.
:::
:::d3d12
Now do the last task, **uniform-buffer**. It replaces the scene with learnopengl's demo. `uniform_buffer.hlsl` is
ready: it declares `cbuffer SceneConstantBuffer : register(b1)` like `advanced_glsl.hlsl`, and its `VSMain` only
reads the position:

```hlsl
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(mul(position, model), view), projection);
}
```

OpenGL's four shader programs are four pipeline states in Direct3D 12 – a PSO holds its shaders. Add the members
`m_redPipelineState`, `m_greenPipelineState`, `m_bluePipelineState` and `m_yellowPipelineState`. At the TODO in
`LoadAssets`, compile the vertex shader once and reuse `psoDesc` for each colour, changing only the pixel shader:

```cpp
        ComPtr<ID3DBlob> uboVertexShader;
        ThrowIfFailed(D3DCompileFromFile(L"uniform_buffer.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &uboVertexShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(uboVertexShader.Get());
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // no face culling, like learnopengl's demo

        ComPtr<ID3DBlob> redPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"red.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &redPixelShader, nullptr));
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(redPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_redPipelineState)));

        // ... the same for green.hlsl, blue.hlsl and yellow.hlsl
```

Here comes the part OpenGL needs `glUniformBlockBinding` and `glBindBufferRange` for. In Direct3D 12 nothing extra is
needed: all four PSOs use the same root signature, and root arguments – like the descriptor table of root parameter 1
with the CBV – stay set when you switch PSOs with `SetPipelineState`. Every shader that declares
`register(b1)` reads the one constant buffer, which `OnUpdate` writes once per frame. In `PopulateCommandList` the
four cubes replace the scene:

```cpp
    // RED
    m_commandList->SetPipelineState(m_redPipelineState.Get());
    XMMATRIX model = XMMatrixTranslation(-0.75f, 0.75f, 0.0f);    // move top-left
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // ... GREEN, YELLOW, BLUE
```

The green cube goes to (0.75, 0.75, 0), the yellow one to (-0.75, -0.75, 0) and the blue one to (0.75, -0.75, 0),
each with its own PSO. The scene's PSO stays the command list's initial state, and the texture table stays set,
although these shaders read no texture.
:::

Press **Build & run**: four flat-coloured cubes – red, green, yellow and blue – on the dark background, each drawn by
a different shader, all with the same view and projection.

```quiz
In the four-cubes demo, how often per frame does the program write the view matrix?
- [ ] Four times: once for each shader (or pipeline)
- [x] Once: every shader reads it from the same buffer
- [ ] Never: the view matrix is stored in the vertex shader's code
- [ ] Once per vertex, in the vertex shader
---
That's the point of a shared uniform buffer: data that's the same for every shader is written once, and every shader whose block is bound to that buffer sees it. Only the model matrix is still set per draw.
```

Uniform buffer objects have several advantages over single uniforms. First, setting a lot of uniforms at once is
faster than setting multiple uniforms one at a time. Second, if you want to change the same uniform over several
shaders, it is much easier to change a uniform once in a uniform buffer. One last advantage that is not immediately
apparent is that you can use a lot more uniforms in shaders using uniform buffer objects. OpenGL has a limit to how
much uniform data it can handle which can be queried with `GL_MAX_VERTEX_UNIFORM_COMPONENTS`. When using uniform buffer
objects, this limit is much higher. So whenever you reach a maximum number of uniforms (when doing skeletal animation
for example) there's always uniform buffer objects.

:::vulkan
In Vulkan the same reasoning decides between the two kinds of blocks you have: push constants are tiny (the
guaranteed minimum `maxPushConstantsSize` is 128 bytes) and fit per-draw data like the model matrix; uniform buffers
hold far more and are shared between draws.
:::
:::d3d12
In Direct3D 12 the same reasoning decides between root constants and constant buffers: the root signature is limited
to 64 DWORDs in total, so root constants fit small per-draw data like the model matrix, while a constant buffer holds
up to 4096 `float4` registers and is shared between draws.
:::

## Additional resources

:::opengl
- [Interface Block (GLSL)](https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL)): the OpenGL wiki on interface
  blocks, uniform blocks and their layouts.
- [glUniformBlockBinding](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformBlockBinding.xhtml) and
  [glBindBufferRange](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBufferRange.xhtml): the two sides of
  a binding point.
:::
:::vulkan
- [GL_KHR_vulkan_glsl](https://github.com/KhronosGroup/GLSL/blob/main/extensions/khr/GL_KHR_vulkan_glsl.txt): how
  Vulkan's GLSL differs from OpenGL's (`gl_VertexIndex`, block layouts, locations).
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): the Vulkan Guide on std140,
  std430 and alignment.
:::
:::d3d12
- [Semantics](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics): HLSL's
  system-value semantics (`SV_Position`, `SV_IsFrontFace`, `SV_Depth`, `SV_VertexID` …).
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  how HLSL lays out a constant buffer.
:::
