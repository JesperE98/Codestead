# Tessellation

The last chapter built a landscape on the CPU: 65,536 vertices, one per pixel of the height map, and 130,050 triangles,
all of them transformed and rasterised every frame no matter how near or far they were. This chapter draws the same
landscape from **400 small square patches** – 1,600 vertices – and lets the GPU cut each patch into as many triangles
as it needs, reading the heights from the height map as a texture. Then it goes one step further: patches near the camera
are cut finely, patches far away coarsely, decided anew every frame. That is **tessellation**, and this chapter follows
learnopengl's guest article *Tessellation*.

Tessellation has been part of every API since Direct3D 11 and OpenGL 4.0. It adds two programmable stages and one fixed
one between the vertex shader and the rasterizer; the names differ between the APIs, the ideas don't. This chapter shows
how {{api}} sets them up.

## The tessellation stages

With tessellation, the pipeline doesn't draw triangles from the vertices you submit. It draws **patches**: groups of a
fixed number of *control points*. Here a patch is a square with its four corners. Three stages turn each patch into
triangles:

1. The **tessellation control shader** – Direct3D calls it the **hull shader** – runs once per control point of a patch.
   It can pass the control points on (or change them), and it decides, once per patch, the **tessellation levels**: how
   finely each edge and the inside of the patch are to be cut.
2. The **tessellator** – a fixed-function stage, not a shader – takes the levels and generates a grid of new points over
   an abstract, normalised patch: for a quad, the unit square with coordinates (u, v) from 0 to 1. It also generates the
   triangles that connect them. It knows nothing of positions or textures; it only produces (u, v) coordinates.
3. The **tessellation evaluation shader** – the **domain shader** in Direct3D – runs once for every point the
   tessellator made. It gets the point's (u, v) and the patch's control points and computes the vertex's real position:
   here, it interpolates the four corners, reads the height map at that place and moves the point up.

The vertex shader before them now just passes the control points through, and the rasterizer after them gets ordinary
triangles. The control/hull stage decides *how much* detail; the evaluation/domain stage decides *where* each new vertex
goes.

:::opengl
Tessellation shaders are core since OpenGL 4.0. learnopengl's program asks for **4.1**, and so does this chapter's: 4.1 is
also the highest version macOS offers, and it includes tessellation, so the chapter runs there. The shaders start with
`#version 410 core`. The project's `shader_t.h` is learnopengl's `Shader` class with three optional stages after the
fragment shader: a geometry shader, a tessellation control shader and a tessellation evaluation shader.
:::
:::vulkan
Vulkan has no versions to ask for: tessellation shaders are an optional **device feature**, `tessellationShader`, which
you check for in `isDeviceSuitable()` and enable when you create the device. Every desktop GPU has it; many mobile GPUs
don't.
:::
:::d3d12
Tessellation is part of every Direct3D 12 device – it came with feature level 11_0, and Direct3D 12 needs at least that.
There is nothing to ask for or enable.
:::

## The project

The start is the last chapter's solution, the CPU terrain, with the GPU version's files added: `gpuheight` shaders for the
vertex stage (passing the control points through), the control/hull stage (passing them through and setting every level
to 1 – more on that below), an empty evaluation/domain stage, and the fragment stage that colours by height, the same as
before. The camera, the height map and the colours are the last chapter's, so the two chapters show the same landscape
from the same place. **Build & run** (Ctrl+Enter) shows the grey CPU terrain; the `// TODO:` comments mark where the GPU
version goes.

:::opengl
The first task asks for the 4.1 context and prints the largest tessellation level the GPU supports:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 1);
```

and, once GLAD is loaded, `glGetIntegerv(GL_MAX_TESS_GEN_LEVEL, &maxTessLevel)` – at least 64 on every implementation.
Now do the first task, **opengl-4-1**. The CPU terrain still draws as before.
:::
:::vulkan
The first task enables the feature – `deviceFeatures.tessellationShader = VK_TRUE;` in `createLogicalDevice()` and
`supportedFeatures.tessellationShader` in `isDeviceSuitable()` – and prints the largest tessellation level, a device limit:

```cpp
        std::cout << "Max available tess level: " << properties.limits.maxTessellationGenerationLevel << std::endl;
```

(64 on every current GPU.) Now do the first task, **tessellation-feature**. The CPU terrain still draws as before.
:::
:::d3d12
In Direct3D 12 the largest tessellation factor isn't even a device property: it is fixed at 64 for every device, the
constant `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR`. The first task writes it to the debugger's output:

```cpp
        snprintf(text, sizeof(text), "Max available tess level: %d\n", D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR);
```

Now do the first task, **max-tess-level**. The CPU terrain still draws as before.
:::

## The height map as a texture

The evaluation stage reads the heights from the height map, so the map must now be a **texture**. It has one channel, so
a one-channel 8-bit format fits (learnopengl uploads its RGBA map as RGBA and reads the second channel; the course's map
is grey and reads `.r`). It is not flipped, as in the last chapter. The sampler filters linearly and **clamps to the
edge**: learnopengl repeats, and then the bilinear filter at the terrain's front edge blends in the height map's
opposite edge – the far peaks – and raises a fringe of spikes along the front.

:::opengl
```cpp
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R8, width, height, 0, GL_RED, GL_UNSIGNED_BYTE, data);
    glGenerateMipmap(GL_TEXTURE_2D);
```

with `GL_CLAMP_TO_EDGE` on S and T, `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`, on texture unit 0. learnopengl generates
mipmaps; they are never used here, though: the evaluation shader runs before rasterisation, where there are no
screen-space derivatives to choose a mip level, so `texture()` there reads level 0.
:::
:::vulkan
`loadHeightMap()` loads the map with `STBI_grey` (one channel) into a `VK_FORMAT_R8_UNORM` image through a staging buffer
of `width * height` bytes, with an image view and a sampler at **binding 1** of the descriptor set, for the stage
`VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT`. The sampler is linear with `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, and the
image has **no mipmaps**: the evaluation shader runs before rasterisation, where there are no screen-space derivatives to
choose a mip level, so `texture()` there reads level 0 anyway.
:::
:::d3d12
The map goes into a `DXGI_FORMAT_R8_UNORM` texture in a default heap, uploaded with `UpdateSubresources` (row pitch =
width, one byte per pixel), then turned into `D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE` – the domain shader reads
it, not the pixel shader. Its SRV is in slot 1 of the heap. The root signature gets a table for it, visible to the domain
shader (`D3D12_SHADER_VISIBILITY_DOMAIN`), and a static sampler (linear, `CLAMP`); the constant buffer's table becomes
visible to all shaders, because the hull and domain shaders use the matrices now. The texture has **one mip level**: the
domain shader runs before rasterisation, where there are no screen-space derivatives to choose a level, so it reads with
`SampleLevel(…, 0)`.
:::

```quiz
Why is a mipmapped height map no help in the evaluation (domain) shader?
- [ ] Because mipmaps can't be generated for one-channel textures
- [x] Because the stage runs before rasterisation: there are no neighbouring pixels to compute screen-space derivatives from, so a plain texture lookup there reads level 0
- [ ] Because the tessellator removes the mipmaps
- [ ] Because the evaluation shader may only read buffers, not textures
---
That is why the Direct3D code calls `SampleLevel(…, 0)` and the Vulkan image has no mip levels. To use a coarser level for far patches, a shader would have to pick it itself, for instance from the tessellation level.
```

The CPU grid – its vertices, indices, buffers and strip drawing – goes. Now do the second task, **height-texture**. The
window shows only the clear colour: there is nothing to draw until there are patches.

## Patches

learnopengl divides the terrain into `rez × rez` = 20 × 20 patches. Each patch is a flat square at y = 0 given by its four
corners, each with a position and a texture coordinate into the height map (0 to 1 across the terrain). The corners are
pushed in learnopengl's order – (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1) – which the evaluation shader relies on:

:::opengl
```cpp
    unsigned rez = 20;
    for (unsigned i = 0; i <= rez - 1; i++)
    {
        for (unsigned j = 0; j <= rez - 1; j++)
        {
            vertices.push_back(-width / 2.0f + width * i / (float)rez); // v.x
            vertices.push_back(0.0f); // v.y
            vertices.push_back(-height / 2.0f + height * j / (float)rez); // v.z
            vertices.push_back(i / (float)rez); // u
            vertices.push_back(j / (float)rez); // v
```

and the same for the three other corners. 400 patches, 1,600 vertices of five floats – attribute 0 the position, 1 the
texture coordinate. One more call tells OpenGL how many control points make a patch:

```cpp
    glPatchParameteri(GL_PATCH_VERTICES, NUM_PATCH_PTS);
```

with `const unsigned int NUM_PATCH_PTS = 4;`. Patches are drawn with the primitive type `GL_PATCHES`.
:::
:::vulkan
The loop is learnopengl's: for `i` and `j` from 0 to `rez - 1` (`const unsigned int rez = 20;`), four `Vertex`es with
`pos` = (`-width / 2.0f + width * i / (float) rez`, 0, `-height / 2.0f + height * j / (float) rez`) and `texCoord` =
(`i / (float) rez`, `j / (float) rez`), and likewise for (i + 1, j), (i, j + 1), (i + 1, j + 1). `Vertex` gets the
`glm::vec2 texCoord`; its attribute description (location 1) comes with the new pipeline in the next task. 400 patches,
1,600 vertices, and `createVertexBuffer()` is back. The patch size is part of the pipeline in Vulkan, so it too comes in
the next task.
:::
:::d3d12
The loop is learnopengl's: for `i` and `j` from 0 to `rez - 1` (`rez = 20`), five floats per corner pushed into
`std::vector<float> vertices` – the position (`-width / 2.0f + width * i / (float)rez`, 0, `-height / 2.0f + height * j /
(float)rez`) and the texture coordinate (`i / (float)rez`, `j / (float)rez`) – for the corners (i, j), (i + 1, j),
(i, j + 1), (i + 1, j + 1). 400 patches, 1,600 vertices in a vertex buffer with a stride of five floats; the input layout
gets `TEXCOORD` (R32G32_FLOAT at byte 12) next to `POSITION`.
:::

Now do the third task, **patch-grid**. Still only the clear colour: the patches exist, but nothing draws them yet.

```quiz
The terrain is drawn from 20 × 20 patches of 4 control points. How many vertices does the vertex shader process per frame, compared with the last chapter's grid?
- [ ] 65,536, the same as before – tessellation only changes the triangles
- [ ] 102,400, one per vertex the tessellator makes
- [ ] 400, one per patch
- [x] 1,600, the patches' corners; the points the tessellator makes are processed by the evaluation shader instead
---
The vertex shader only sees the control points. The new vertices – thousands of them – are made on the GPU and positioned by the evaluation (domain) shader. The CPU sends 1,600 vertices instead of 65,536.
```

## The tessellation evaluation shader

The evaluation shader runs once for every point the tessellator generates. Its input is the point's position in the
abstract patch – `gl_TessCoord` in GLSL (u and v for a quad), `SV_DomainLocation` in HLSL – and the four control points.
From them it computes the vertex:

- the **texture coordinate** by bilinear interpolation of the corners' texture coordinates: along u on the edge between
  corners 0 and 1 and on the edge between 2 and 3, then along v between those two results;
- the **height** from the height map at that texture coordinate, scaled to −16 … 48 as on the CPU before;
- the **position** by the same bilinear interpolation of the corners, moved along the patch's normal by the height. The
  patch is flat with y = 0, so the normal is (0, 1, 0) – learnopengl computes it from the corners all the same, which
  works for patches of any orientation;
- the clip-space position, with the model, view and projection matrices – which move here from the vertex shader.

The patch's layout is declared with it. `quads` says the tessellator works on a square domain; `fractional_odd_spacing`
how it spaces the points (below); `ccw` the winding of the triangles it makes.

:::opengl
```glsl
// quads, spaced with fractional odd levels, triangles counter-clockwise
layout (quads, fractional_odd_spacing, ccw) in;
```

and, in `main`:

```glsl
    // where in the patch this vertex is: (u, v) from 0 to 1
    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    // the corners' texture coordinates
    vec2 t00 = TextureCoord[0];
    vec2 t01 = TextureCoord[1];
    vec2 t10 = TextureCoord[2];
    vec2 t11 = TextureCoord[3];

    // bilinear interpolation: along u on both edges, then along v
    vec2 t0 = (t01 - t00) * u + t00;
    vec2 t1 = (t11 - t10) * u + t10;
    vec2 texCoord = (t1 - t0) * v + t0;

    // the height from the texture: 0..1 -> -16..48
    Height = texture(heightMap, texCoord).r * 64.0 - 16.0;
```

then the positions the same way – `p0 = (p01 - p00) * u + p00`, `p1 = (p11 - p10) * u + p10` – and

```glsl
    vec4 p = (p1 - p0) * v + p0 + normal * Height;

    // output patch point position in clip space
    gl_Position = projection * view * model * p;
```

`TextureCoord[]` is an array: the control shader's per-control-point outputs, one for each of the patch's four points.
The program is now built from four files – `Shader tessHeightMapShader("gpuheight.vs", "gpuheight.fs", nullptr,
"gpuheight.tcs", "gpuheight.tes");`, no geometry shader – and the patches are drawn with

```cpp
        glDrawArrays(GL_PATCHES, 0, NUM_PATCH_PTS * rez * rez);
```
:::
:::vulkan
```glsl
// quads, spaced with fractional odd levels, triangles counter-clockwise
layout(quads, fractional_odd_spacing, ccw) in;
```

and, in `main`:

```glsl
    // where in the patch this vertex is: (u, v) from 0 to 1
    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    // the corners' texture coordinates
    vec2 t00 = TextureCoord[0];
    vec2 t01 = TextureCoord[1];
    vec2 t10 = TextureCoord[2];
    vec2 t11 = TextureCoord[3];

    // bilinear interpolation: along u on both edges, then along v
    vec2 t0 = (t01 - t00) * u + t00;
    vec2 t1 = (t11 - t10) * u + t10;
    vec2 texCoord = (t1 - t0) * v + t0;

    // the height from the texture: 0..1 -> -16..48
    Height = texture(heightMap, texCoord).r * 64.0 - 16.0;
```

then the positions the same way, the point moved along the normal by the height, and `gl_Position = ubo.proj * ubo.view *
pc.model * p;`. The height map is `layout(binding = 1) uniform sampler2D heightMap;`, the matrices the uniform block and
the push constant – which now serve the control and evaluation stages instead of the vertex stage. Vulkan's tessellator
places `gl_TessCoord` the same way as OpenGL's, so the picture is OpenGL's.

The pipeline gets the two new stages (`VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT`, `..._EVALUATION_BIT`, from
`gpuheight.tesc` and `gpuheight.tese`), the topology `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` – OpenGL's `GL_PATCHES` – and a
tessellation state with the patch size, OpenGL's `glPatchParameteri`:

```cpp
        VkPipelineTessellationStateCreateInfo tessellationState{};
        tessellationState.sType = VK_STRUCTURE_TYPE_PIPELINE_TESSELLATION_STATE_CREATE_INFO;
        tessellationState.patchControlPoints = NUM_PATCH_PTS;
```

(`pipelineInfo.pTessellationState = &tessellationState;`). The draw is `vkCmdDraw(commandBuffer, NUM_PATCH_PTS * rez *
rez, 1, 0, 0)`.
:::
:::d3d12
In Direct3D the patch's layout is declared on the **hull** shader (see the next section); the domain shader only says
which domain it works on, `[domain("quad")]`, and gets the point's position as `SV_DomainLocation`, the patch's control
points as an `OutputPatch` and the patch constants:

```hlsl
DSOutput DSMain(HSConstantOutput patchConstants, float2 tessCoord : SV_DomainLocation, const OutputPatch<HSOutput, 4> patch)
{
    DSOutput output;

    // get patch coordinate
    float u = tessCoord.x;
    float v = tessCoord.y;

    // ----------------------------------------------------------------------
    // retrieve control point texture coordinates
    float2 t00 = patch[0].textureCoord;
    float2 t01 = patch[1].textureCoord;
    float2 t10 = patch[2].textureCoord;
    float2 t11 = patch[3].textureCoord;

    // bilinearly interpolate texture coordinate across patch
    float2 t0 = (t01 - t00) * u + t00;
    float2 t1 = (t11 - t10) * u + t10;
    float2 texCoord = (t1 - t0) * v + t0;

    // lookup texel at patch coordinate for height and scale + shift as desired
    // (SampleLevel: outside the pixel shader there are no derivatives to pick a mip level)
    output.height = heightMap.SampleLevel(heightMapSampler, texCoord, 0).r * 64.0f - 16.0f;
```

then the positions the same way, the point moved along the normal by the height, and the projection with
`mul(mul(mul(p, model), view), projection)`. The pipeline state gets the two new stages – `psoDesc.HS` and `psoDesc.DS`,
compiled from `gpuheight.hlsl`'s `HSMain` (`hs_5_0`) and `DSMain` (`ds_5_0`) – and `psoDesc.PrimitiveTopologyType =
D3D12_PRIMITIVE_TOPOLOGY_TYPE_PATCH`. The command list says how many control points a patch has, in the topology itself:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST);
```

– OpenGL's `GL_PATCHES` and `glPatchParameteri(GL_PATCH_VERTICES, 4)` in one constant – and `DrawInstanced(m_vertexCount, 1,
0, 0)` draws the 1,600 control points.
:::

The start's control/hull stage sets every level to 1, so the tessellator makes no new points: each patch becomes a
single quad – two triangles – with the heights of its four corners. Now do the fourth task, **tess-evaluation**. Build
and run: a **coarse terrain** of 20 × 20 tilted squares – the right outline, but the peaks blunt and the lake only a
shallow dent.

## Tessellation levels

The control/hull stage decides how finely the tessellator cuts each patch. For a quad there are six levels:

- four **outer** levels, one per edge: into how many segments that edge is cut. In OpenGL's numbering (and Direct3D's,
  which matches for quads), outer level 0 is the edge at u = 0, 1 the edge at v = 0, 2 the edge at u = 1 and 3 the edge
  at v = 1;
- two **inner** levels: into how many segments the inside is cut along u and along v.

The levels are floats, and how the tessellator turns a level into segments is the **spacing**. `equal_spacing`
(`integer` in Direct3D) rounds the level up to a whole number of equal segments: with all six levels at 8, each patch
would become a grid of 8 × 8 small quads. `fractional_odd_spacing`, which learnopengl uses, rounds the level up to the
next **odd** number and makes two of the segments, placed symmetrically, shorter by the fraction; `fractional_even_spacing`
does the same with even numbers. So here a level of 8 gives 9 segments – seven of equal length and two shorter ones – and
each patch becomes 9 × 9 small quads: 100 points, each reading its own height, and 162 triangles. The point of fractional
spacing: a level that changes smoothly – as it will with the distance – moves the points smoothly, instead of making new
ones pop in.

The control shader runs once per control point – `gl_InvocationID` says which – but the levels are per patch, so
learnopengl writes them only in invocation 0:

:::opengl
```glsl
// the patch: 4 control points in, 4 out
layout (vertices = 4) out;
```

```glsl
    // pass the control point (and its texture coordinate) through
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    TextureCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    // the tessellation levels: once per patch (by invocation 0)
    if (gl_InvocationID == 0)
    {
```

and inside the `if`, for this task, `gl_TessLevelOuter[0]` … `[3]` and `gl_TessLevelInner[0]` … `[1]` = 8. OpenGL could
even do without a control shader: the levels then come from `glPatchParameterfv(GL_PATCH_DEFAULT_OUTER_LEVEL, …)` and
`GL_PATCH_DEFAULT_INNER_LEVEL`. The course keeps the stage in every state, as Vulkan and Direct3D require.

```quiz
Why does the control shader set the levels inside `if (gl_InvocationID == 0)`?
- [x] Because the shader runs once per control point, but the levels belong to the whole patch – one invocation writing them is enough
- [ ] Because only control point 0 has a texture coordinate
- [ ] Because `gl_TessLevelOuter` is an input that only invocation 0 may read
- [ ] Because the levels must be different for each control point
---
All four invocations could write the same values; writing them once is simpler and clearer. Direct3D separates the two jobs completely: a function per control point and a patch constant function per patch.
```
:::
:::vulkan
```glsl
// the patch: 4 control points in, 4 out
layout(vertices = 4) out;
```

```glsl
    // pass the control point (and its texture coordinate) through
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    TextureCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    // the tessellation levels: once per patch (by invocation 0)
    if (gl_InvocationID == 0) {
```

and inside the `if`, for this task, `gl_TessLevelOuter[0]` … `[3]` and `gl_TessLevelInner[0]` … `[1]` = 8. A Vulkan
pipeline with tessellation **must** have both a control and an evaluation shader – OpenGL can leave the control shader out
and use default levels, Vulkan has no such defaults. That is why the start's control shader writes level 1 everywhere:
without it, the pipeline of the last task couldn't have been built.

```quiz
Why does the start of the Vulkan project already have a control shader that only writes level 1 everywhere?
- [ ] Because level 1 makes the tessellator double the vertices
- [ ] Because the evaluation shader can't read `gl_TessCoord` without it
- [ ] Because Vulkan requires the levels to be written once per frame by the CPU
- [x] Because a Vulkan pipeline with tessellation must have both a control and an evaluation shader – there are no default levels as in OpenGL
---
With every level 1 the tessellator makes no new points: each patch becomes one quad, the coarse terrain of the evaluation task.
```
:::
:::d3d12
Direct3D splits the control shader in two. `HSMain` runs once per output control point (`SV_OutputControlPointID` =
`gl_InvocationID`) and passes it through; the levels come from a separate **patch constant function**, which Direct3D
runs once per patch – OpenGL's `if (gl_InvocationID == 0)` block. The hull shader's attributes declare the patch layout
that OpenGL declares on the evaluation shader:

```hlsl
[domain("quad")]
[partitioning("fractional_odd")]
[outputtopology("triangle_ccw")]
[outputcontrolpoints(4)]
[patchconstantfunc("PatchConstantFunction")]
HSOutput HSMain(InputPatch<VSOutput, 4> patch, uint i : SV_OutputControlPointID)
{
    HSOutput output;

    output.position = patch[i].position;
    output.textureCoord = patch[i].texCoord;

    return output;
}
```

The patch constant function returns the levels with their system-value semantics – `SV_TessFactor` for the four edges
(`gl_TessLevelOuter`), `SV_InsideTessFactor` for the two inside factors (`gl_TessLevelInner`):

```hlsl
struct HSConstantOutput
{
    float edges[4] : SV_TessFactor;
    float inside[2] : SV_InsideTessFactor;
};
```

For this task, `PatchConstantFunction` sets all six to 8. A Direct3D pipeline with tessellation always needs a hull
shader – there are no default factors – which is why the start's writes 1 everywhere.

```quiz
Which part of the Direct3D hull shader does what OpenGL's `if (gl_InvocationID == 0)` block in the control shader does?
- [ ] `HSMain`, called with `SV_OutputControlPointID` 0
- [x] The patch constant function named in `[patchconstantfunc(...)]`, which Direct3D runs once per patch and which returns `SV_TessFactor` and `SV_InsideTessFactor`
- [ ] The domain shader's `[domain("quad")]` attribute
- [ ] `[outputcontrolpoints(4)]`
---
Direct3D splits OpenGL's control shader: `HSMain` handles one control point per call, the patch constant function the per-patch levels.
```
:::

Now do the fifth task, **tess-control**. Build and run: the full terrain again, as detailed as the CPU version – about
65,000 triangles (400 patches × 162) made on the GPU from 1,600 vertices.

```quiz
All six levels of a quad patch are 8, with `fractional_odd_spacing`. What does the tessellator produce for each patch?
- [ ] 8 triangles
- [ ] 8 new vertices on each edge, but the inside stays one quad
- [x] A grid of 9 × 9 small quads: the level is rounded up to the next odd number, 9 segments per side, two of them shorter
- [ ] 8 copies of the patch, one per level
---
With `equal_spacing` it would be 8 × 8. The tessellator only produces the (u, v) points and the triangles that connect them; the evaluation (domain) shader reads a height for each point.
```

## Wireframe

To see what the tessellator does, the next task draws only the triangles' edges.

:::opengl
`glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` once before the render loop (learnopengl toggles it with a key; the course
has no input).
:::
:::vulkan
`rasterizer.polygonMode = VK_POLYGON_MODE_LINE;` in the pipeline. Anything but `FILL` needs another device feature,
`fillModeNonSolid`, enabled and checked like `tessellationShader`.
:::
:::d3d12
`psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;` in the pipeline state.
:::

Now do the sixth task, **wireframe**. Build and run: the terrain as a grey wireframe – a regular mesh, the same 9 × 9
density on every patch. Near the camera the triangles are large on the screen; at the back the lines crowd together, many
triangles to a few pixels. That is wasted work, and the last task fixes it.

## Level of detail by distance

The levels don't have to be constants: the control shader can compute them, per patch, every frame. learnopengl makes
them depend on the distance to the camera. For each corner of the patch it takes the depth in eye space (the camera looks
along −z, so the absolute z), and scales it to 0 … 1 between `MIN_DISTANCE` and `MAX_DISTANCE`. Each outer level is then
interpolated from `MAX_TESS_LEVEL` (near) to `MIN_TESS_LEVEL` (far) by the **nearer of its edge's two corners**, and each
inner level is the larger of the two outer levels parallel to it.

learnopengl's numbers – levels 4 to 64 between 20 and 800 units – are made for its terrain of 2.6 thousand pixels. The
course's terrain is 256 units wide and seen from 240 to 450 units away, so it uses **2 to 8 between 250 and 450**: the
front edge gets level 8, the back about 2.

:::opengl
```glsl
        const int MIN_TESS_LEVEL = 2;
        const int MAX_TESS_LEVEL = 8;
        const float MIN_DISTANCE = 250;
        const float MAX_DISTANCE = 450;

        // the corners in eye space (the camera looks along -z)
        vec4 eyeSpacePos00 = view * model * gl_in[0].gl_Position;
        vec4 eyeSpacePos01 = view * model * gl_in[1].gl_Position;
        vec4 eyeSpacePos10 = view * model * gl_in[2].gl_Position;
        vec4 eyeSpacePos11 = view * model * gl_in[3].gl_Position;

        // "distance" from camera scaled between 0 and 1
        float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance01 = clamp((abs(eyeSpacePos01.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance10 = clamp((abs(eyeSpacePos10.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance11 = clamp((abs(eyeSpacePos11.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);

        // each edge from its nearer corner (two patches sharing an edge compute the same level: no cracks)
        float tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
        float tessLevel1 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
        float tessLevel2 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
        float tessLevel3 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

        gl_TessLevelOuter[0] = tessLevel0;
        gl_TessLevelOuter[1] = tessLevel1;
        gl_TessLevelOuter[2] = tessLevel2;
        gl_TessLevelOuter[3] = tessLevel3;

        gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);
        gl_TessLevelInner[1] = max(tessLevel0, tessLevel2);
```

The control shader now uses the `model` and `view` uniforms, which the program sets on the shader as before.
:::
:::vulkan
learnopengl's code, with the matrices from the uniform block and the push constant:

```glsl
        // the corners in eye space (the camera looks along -z)
        vec4 eyeSpacePos00 = ubo.view * pc.model * gl_in[0].gl_Position;
        vec4 eyeSpacePos01 = ubo.view * pc.model * gl_in[1].gl_Position;
        vec4 eyeSpacePos10 = ubo.view * pc.model * gl_in[2].gl_Position;
        vec4 eyeSpacePos11 = ubo.view * pc.model * gl_in[3].gl_Position;
```

then `distance00` … `distance11` as `clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0,
1.0)`, the four edge levels `tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));` … (edge 1
from corners 00 and 01, edge 2 from 01 and 11, edge 3 from 11 and 10), and `gl_TessLevelInner[0] = max(tessLevel1,
tessLevel3); gl_TessLevelInner[1] = max(tessLevel0, tessLevel2);`, with `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`,
`MIN_DISTANCE = 250` and `MAX_DISTANCE = 450`. The uniform buffer and the push constant are visible to the control stage
since the evaluation task.
:::
:::d3d12
learnopengl's code in the patch constant function – `lerp` for `mix`, and the row-vector products for the eye-space
positions:

```hlsl
    // the corners in eye space (the camera looks along -z)
    float4 eyeSpacePos00 = mul(mul(patch[0].position, model), view);
    float4 eyeSpacePos01 = mul(mul(patch[1].position, model), view);
    float4 eyeSpacePos10 = mul(mul(patch[2].position, model), view);
    float4 eyeSpacePos11 = mul(mul(patch[3].position, model), view);
```

```hlsl
    float tessLevel0 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
    float tessLevel1 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
    float tessLevel2 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
    float tessLevel3 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

    output.edges[0] = tessLevel0;
    output.edges[1] = tessLevel1;
    output.edges[2] = tessLevel2;
    output.edges[3] = tessLevel3;

    // the inside: the larger level of its two parallel edges
    output.inside[0] = max(tessLevel1, tessLevel3);
    output.inside[1] = max(tessLevel0, tessLevel2);
```

with `distance00` … `distance11` as `clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f,
1.0f)` and `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450`. The patch constant
function reads the constant buffer's matrices – its table is visible to all shaders since the height-texture task.
:::

### Cracks

Why the *nearer corner of the edge*, and not, say, the patch's centre? Because of **cracks**. Two neighbouring patches
share an edge. If each computed that edge's level from something of its own – its centre, its nearest corner overall –
the two could give the shared edge different levels: one cuts it into 8 segments, the other into 5. The points along the
edge then lie at different places on the two sides, the heights read there differ, and a thin gap opens in the terrain
where the background shows through. Computing an edge's level only from the edge's own two corners guarantees that both
patches compute exactly the same value for it, so their points line up. The inner levels may differ freely: they only
affect the inside of one patch.

```quiz
Two neighbouring patches share an edge. Patch A computes that edge's outer level as 8, patch B as 5. What can you see?
- [ ] Nothing: the evaluation shader interpolates across the patches
- [ ] The patch with the lower level is drawn darker
- [x] Cracks: the edge's points lie at different places on the two sides, they read different heights, and gaps open between the patches
- [ ] The tessellator rejects both patches
---
Both sides of a shared edge must be cut identically. learnopengl's rule – an edge's level depends only on the edge's two corners – makes both patches compute the same level, whatever their other corners are.
```

Now do the last task, **distance-levels**. Build and run: the front of the terrain stays as dense as before, while at the
back the wireframe opens up into large triangles – a level near 2 gives three segments per edge instead of nine. The terrain's shape
is unchanged at a glance: the far patches cover so few pixels that the extra triangles were invisible anyway. Move the
camera (in your own project) and the levels follow it every frame.

## Going further

learnopengl's terrain is the starting point; real terrain renderers add:

- **Screen-space levels.** The distance is a stand-in for what matters: how many pixels an edge covers. Projecting the
  edge to the screen and choosing the level for a target triangle size in pixels adapts to the field of view and the
  resolution as well.
- **Culling patches.** A patch outside the frustum can get level 0 – the tessellator then discards it – so the evaluation
  shader never runs for it. Its bounding box must include the heights, which the control shader can read from a texture
  of per-patch minima and maxima.
- **Lighting.** The normals can be computed in the evaluation shader from neighbouring height samples, or read from a
  normal map baked from the height map.
- **Displacement on models.** The same stages refine characters and objects: a coarse mesh with a displacement map gains
  detail close to the camera. Newer hardware also offers *mesh shaders*, which replace the whole vertex/tessellation/
  geometry front end with compute-like stages.

## Additional resources

- [Tessellation](https://learnopengl.com/Guest-Articles/2021/Tessellation/Tessellation): learnopengl's guest article this
  chapter follows, with pictures of the tessellator's patterns.
- [terrain_gpu_dist](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/8.guest/2021/3.tessellation/terrain_gpu_dist):
  learnopengl's demo with distance-based levels.

:::opengl
- [Tessellation (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Tessellation): the stages, the levels of each
  primitive type and the spacing modes.
- [glPatchParameter](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPatchParameter.xhtml): the patch size and
  the default levels.
:::
:::vulkan
- [Tessellation (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/tessellation.html): the tessellator,
  the levels and the spacing.
- [VkPipelineTessellationStateCreateInfo](https://registry.khronos.org/vulkan/specs/latest/man/html/VkPipelineTessellationStateCreateInfo.html):
  the number of control points per patch.
:::
:::d3d12
- [Tessellation stages](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-tessellation):
  the hull shader, the tessellator and the domain shader.
- [Hull shader design](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-hull-shader-design):
  the control point function and the patch constant function.
:::
