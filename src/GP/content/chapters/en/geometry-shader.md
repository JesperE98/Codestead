# Geometry Shader

Between the vertex and the fragment shader there is an optional shader stage called the *geometry shader*. A geometry
shader takes as input a set of vertices that form a single primitive, e.g. a point or a triangle. The geometry shader
can then transform these vertices as it sees fit before sending them to the next shader stage. What makes the
geometry shader interesting is that it is able to convert the original primitive (set of vertices) to completely
different primitives, possibly generating more vertices than were initially given.

:::opengl
In OpenGL the geometry shader is part of the core profile since version 3.2, so our 3.3 context always has it. You
write it in GLSL like the other two stages, compile it as a `GL_GEOMETRY_SHADER` and link it into the same program.
:::
:::vulkan
In Vulkan the geometry shader is an *optional device feature*, `geometryShader`: most desktop GPUs have it, but many
mobile GPUs don't (and Apple's Metal, which MoltenVK translates Vulkan to, has no geometry shaders at all). Like every
optional feature, it has to be switched on when the logical device is created before a pipeline may contain a geometry
stage. The shader itself is GLSL, compiled to SPIR-V like the others (`shaders/<name>.geom` becomes
`shaders/<name>.geom.spv`), and it becomes one more `VkPipelineShaderStageCreateInfo` of the pipeline.
:::
:::d3d12
In Direct3D 12 the geometry shader stage is always there: every Direct3D 12 device supports at least feature level
11_0, which includes it. A geometry shader is an HLSL function with an input primitive and an output stream, compiled
with the target `gs_5_0`, and like every shader it is part of a pipeline state object: `psoDesc.GS`, between `VS` and
`PS`.
:::

The technique is the same in every API – this chapter shows it for {{api}}, following learnopengl's three examples:
points that grow into houses, a model that explodes, and a model whose normal vectors are drawn as lines.

:::opengl
The project starts with learnopengl's first example before the geometry shader: no camera, no matrices, the clear
colour (0.1, 0.1, 0.1), and four points – a 2D position and a colour each – drawn with
`glDrawArrays(GL_POINTS, 0, 4)` by `geometry_shader.vs` and `geometry_shader.fs`. The project already contains the
Model chapter's `mesh.h` and `model.h` and the planet (`models/planet.obj` with its textures) for the second half, and
the shader files of the later tasks: `explode.vs/.fs/.gs`, `default.vs/.fs` and `normal_visualization.vs/.fs/.gs`.
`geometry_shader.gs` and `normal_visualization.gs` are still empty apart from a TODO, and `explode.gs` passes every
triangle through unchanged.
:::
:::vulkan
The project starts with learnopengl's first example before the geometry shader: no camera, no matrices, the clear
colour (0.1, 0.1, 0.1), and learnopengl's four points (`struct PointVertex { glm::vec2 pos; glm::vec3 color; }` in
their own vertex buffer, `pointsVertexBuffer`), drawn by `graphicsPipeline` with the topology
`VK_PRIMITIVE_TOPOLOGY_POINT_LIST` and `vkCmdDraw(commandBuffer, static_cast<uint32_t>(points.size()), 1, 0, 0)`.
Vulkan's y axis points down, so the points' y values are negated – learnopengl's top-left point (-0.5, 0.5) is
(-0.5, -0.5) here, and the picture is the same. `createPipeline(vertFile, fragFile, topology, bindingDescription,
attributeDescriptions, pipeline)` takes the topology and the vertex input as parameters, because the points and the
model differ in both. The Model chapter's code (tinyobjloader, the planet's vertex and index buffer, its two diffuse
maps, the uniform buffer with `view` and `proj`, the descriptor set, the model matrix as a push constant) is already
created in `initVulkan()` but unused until the `planet` task. Every `.geom` file is compiled like the other shaders;
`geometry_shader.geom` and `normal_visualization.geom` only have their layout lines and an empty `main`, and
`explode.geom` passes every triangle through unchanged.

:::ide clion vscode
Your `CMakeLists.txt` compiles them – its `file(GLOB …)` line lists `shaders/*.geom` – to `shaders/<name>.geom.spv`.
:::
:::ide vs rider
The pre-build event of your project compiles them – its loop lists `shaders\*.geom` – to `shaders\<name>.geom.spv`.
:::
:::
:::d3d12
The project starts with learnopengl's first example before the geometry shader: no camera, no matrices, the clear
colour (0.1, 0.1, 0.1), and learnopengl's four points (`struct PointVertex { XMFLOAT2 position; XMFLOAT3 color; }`) in
an upload-heap vertex buffer, drawn with `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`,
`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_POINTLIST)` and `DrawInstanced(4, 1, 0, 0)`. The shaders are in
`geometry_shader.hlsl`. Prepared for the second half (unused by the points): the Model chapter's `Model` class, the
root signature (root constants `ModelConstants` at b0, a table with the CBV at b1 – visible to **all** stages, because
the geometry shaders read it – and a table with a mesh's textures), the constant buffer `SceneConstantBuffer` and the
member `Model m_model;`. `explode.hlsl` (whose geometry shader passes every triangle through), `default.hlsl` and
`normal_visualization.hlsl` are there for the later tasks. All pipeline states use `CullMode = D3D12_CULL_MODE_NONE`,
like learnopengl, which draws without face culling.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, build and run the program in your
IDE. Right now it shows four single pixels: red top-left, green top-right, yellow bottom-left and blue bottom-right.

## Using geometry shaders

Let's start with an example of a geometry shader:

:::opengl
```glsl
#version 330 core
layout (points) in;
layout (line_strip, max_vertices = 2) out;

void main() {
    gl_Position = gl_in[0].gl_Position + vec4(-0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    gl_Position = gl_in[0].gl_Position + vec4( 0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    EndPrimitive();
}
```

At the start of a geometry shader we need to declare the type of primitive input we're receiving from the vertex
shader. We do this by declaring a layout specifier in front of the `in` keyword. This input layout qualifier can take
any of the following primitive values:

| Input qualifier | Draw modes | Vertices per primitive |
|---|---|---|
| `points` | `GL_POINTS` | 1 |
| `lines` | `GL_LINES`, `GL_LINE_STRIP` | 2 |
| `lines_adjacency` | `GL_LINES_ADJACENCY`, `GL_LINE_STRIP_ADJACENCY` | 4 |
| `triangles` | `GL_TRIANGLES`, `GL_TRIANGLE_STRIP`, `GL_TRIANGLE_FAN` | 3 |
| `triangles_adjacency` | `GL_TRIANGLES_ADJACENCY`, `GL_TRIANGLE_STRIP_ADJACENCY` | 6 |

These are almost all the rendering primitives we're able to give to rendering calls like `glDrawArrays`. If we'd
chosen to draw vertices as `GL_TRIANGLES` we should set the input qualifier to `triangles`. The number in the last
column is the minimal number of vertices that form a single primitive.

We also need to specify a primitive type that the geometry shader will output, and we do this via a layout specifier
in front of the `out` keyword. Like the input layout qualifier, the output layout qualifier can take several primitive
values: `points`, `line_strip` and `triangle_strip`. With just these 3 output specifiers we can create almost any
shape we want from the input primitives. To generate a single triangle for example we'd specify `triangle_strip` as
the output and output 3 vertices.

The geometry shader also expects us to set a maximum number of vertices it outputs (if you exceed this number, OpenGL
won't draw the extra vertices), which we can also do within the layout qualifier of the `out` keyword. In this
particular case we're going to output a `line_strip` with a maximum number of 2 vertices.

In case you're wondering what a line strip is: a line strip binds together a set of points to form one continuous
line between them with a minimum of 2 points. Each extra point results in a new line between the new point and the
previous point.

To generate meaningful results we need some way to retrieve the output from the previous shader stage. GLSL gives us
a built-in variable called `gl_in` that internally (probably) looks something like this:

```glsl
in gl_PerVertex
{
    vec4  gl_Position;
    float gl_PointSize;
    float gl_ClipDistance[];
} gl_in[];
```

Here it is declared as an interface block (as discussed in the previous chapter) that contains a few interesting
variables of which the most interesting one is `gl_Position` that contains the vector we set as the vertex shader's
output. Note that it is declared as an array, because most render primitives contain more than 1 vertex. The geometry
shader receives *all* vertices of a primitive as its input.

Using the vertex data from the vertex shader stage we can generate new data with 2 geometry shader functions called
`EmitVertex` and `EndPrimitive`. The geometry shader expects you to generate/output at least one of the primitives you
specified as output. Each time we call `EmitVertex`, the vector currently set to `gl_Position` is added to the output
primitive. Whenever `EndPrimitive` is called, all emitted vertices for this primitive are combined into the specified
output render primitive. By repeatedly calling `EndPrimitive`, after one or more `EmitVertex` calls, multiple
primitives can be generated.
:::
:::vulkan
```glsl
#version 450

layout(points) in;
layout(line_strip, max_vertices = 2) out;

void main() {
    gl_Position = gl_in[0].gl_Position + vec4(-0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    gl_Position = gl_in[0].gl_Position + vec4( 0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    EndPrimitive();
}
```

At the start of a geometry shader we need to declare the type of primitive input we're receiving from the vertex
shader. We do this by declaring a layout specifier in front of the `in` keyword. This input layout qualifier can take
any of the following primitive values:

| Input qualifier | Pipeline topologies | Vertices per primitive |
|---|---|---|
| `points` | `VK_PRIMITIVE_TOPOLOGY_POINT_LIST` | 1 |
| `lines` | `..._LINE_LIST`, `..._LINE_STRIP` | 2 |
| `lines_adjacency` | `..._LINE_LIST_WITH_ADJACENCY`, `..._LINE_STRIP_WITH_ADJACENCY` | 4 |
| `triangles` | `..._TRIANGLE_LIST`, `..._TRIANGLE_STRIP`, `..._TRIANGLE_FAN` | 3 |
| `triangles_adjacency` | `..._TRIANGLE_LIST_WITH_ADJACENCY`, `..._TRIANGLE_STRIP_WITH_ADJACENCY` | 6 |

In OpenGL the draw call names the primitive; in Vulkan it is the pipeline's `inputAssembly.topology`, and it has to
fit the geometry shader's input qualifier: a point list for `points`, a triangle list for `triangles`. The number in
the last column is the number of vertices that form a single primitive.

We also need to specify a primitive type that the geometry shader will output, and we do this via a layout specifier
in front of the `out` keyword. The output layout qualifier can take three values: `points`, `line_strip` and
`triangle_strip`. With just these 3 output specifiers we can create almost any shape we want from the input
primitives. To generate a single triangle for example we'd specify `triangle_strip` as the output and output 3
vertices.

The geometry shader also expects us to set a maximum number of vertices it outputs, `max_vertices`, in the same
layout qualifier (vertices beyond it are not drawn; the device limit `maxGeometryOutputVertices` is at least 256). In
this particular case we're going to output a `line_strip` with a maximum number of 2 vertices.

In case you're wondering what a line strip is: a line strip binds together a set of points to form one continuous
line between them with a minimum of 2 points. Each extra point results in a new line between the new point and the
previous point.

To generate meaningful results we need some way to retrieve the output from the previous shader stage. GLSL gives us
a built-in array called `gl_in`, one element per vertex of the input primitive:

```glsl
in gl_PerVertex
{
    vec4  gl_Position;
    float gl_PointSize;
    float gl_ClipDistance[];
} gl_in[];
```

Its most interesting member is `gl_Position`, the vector the vertex shader wrote. It is an array because most
primitives contain more than one vertex: the geometry shader receives *all* vertices of a primitive.

Using the vertex data from the vertex shader stage we can generate new data with 2 geometry shader functions called
`EmitVertex` and `EndPrimitive`. Each time we call `EmitVertex`, the vector currently set to `gl_Position` (and the
current values of the other outputs) is added to the output primitive. Whenever `EndPrimitive` is called, all emitted
vertices for this primitive are combined into the specified output render primitive. By repeatedly calling
`EndPrimitive`, after one or more `EmitVertex` calls, multiple primitives can be generated.
:::
:::d3d12
```hlsl
[maxvertexcount(2)]
void GSMain(point VSOutput input[1], inout LineStream<GSOutput> lineStream)
{
    GSOutput output;
    output.position = input[0].position + float4(-0.1f, 0.0f, 0.0f, 0.0f);
    lineStream.Append(output);

    output.position = input[0].position + float4( 0.1f, 0.0f, 0.0f, 0.0f);
    lineStream.Append(output);

    lineStream.RestartStrip();
}
```

A geometry shader is a function (we call it `GSMain`) whose first parameter declares the type of primitive it
receives, as an array of the vertex shader's output structure. The primitive type keyword in front of it can be one
of these:

| Primitive type | Topologies (`IASetPrimitiveTopology`) | Array size |
|---|---|---|
| `point` | `D3D_PRIMITIVE_TOPOLOGY_POINTLIST` | 1 |
| `line` | `..._LINELIST`, `..._LINESTRIP` | 2 |
| `lineadj` | `..._LINELIST_ADJ`, `..._LINESTRIP_ADJ` | 4 |
| `triangle` | `..._TRIANGLELIST`, `..._TRIANGLESTRIP` | 3 |
| `triangleadj` | `..._TRIANGLELIST_ADJ`, `..._TRIANGLESTRIP_ADJ` | 6 |

The topology set with `IASetPrimitiveTopology` has to fit it, and so does the pipeline state's
`PrimitiveTopologyType` (`D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`, `_LINE` or `_TRIANGLE`): with a geometry shader, it
describes the primitive the geometry shader takes as input, not what reaches the rasterizer. The array size is the
number of vertices that form a single primitive.

The second parameter is the output: an `inout` *stream-output object*, whose type decides the primitive the geometry
shader outputs – `PointStream`, `LineStream` or `TriangleStream` – and whose template argument is the structure of
one output vertex. With just these 3 kinds of streams we can create almost any shape we want from the input
primitives. To generate a single triangle for example we'd use a `TriangleStream` and output 3 vertices.

The geometry shader also has to declare the maximum number of vertices it outputs, with the attribute
`[maxvertexcount(n)]` in front of the function (the total output of one invocation is limited to 1024 scalars). In
this particular case we output a line strip with a maximum number of 2 vertices.

In case you're wondering what a line strip is: a line strip binds together a set of points to form one continuous
line between them with a minimum of 2 points. Each extra point results in a new line between the new point and the
previous point.

The input array holds what the vertex shader returned for each vertex of the primitive – here one, `input[0]` – so
there is no built-in like GLSL's `gl_in`: the position is the member with the `SV_POSITION` semantic. New vertices are
made with two methods of the stream: `Append(output)` adds a copy of the output structure, as it is at that moment, to
the current strip (GLSL's `EmitVertex`), and `RestartStrip()` ends the strip so the next `Append` starts a new
primitive (GLSL's `EndPrimitive`). By repeatedly calling `RestartStrip`, after one or more `Append` calls, multiple
primitives can be generated.
:::

In this case we emit two vertices that are translated by a small offset from the original vertex position and then
end the primitive, combining the two vertices into a single line strip of 2 vertices. Every point that goes in comes
out as a small horizontal line.

Now that you (sort of) know how geometry shaders work you can probably guess what this geometry shader does. This
geometry shader takes a point primitive as its input and creates a horizontal line primitive with the input point at
its center. It's a relatively simple geometry shader, but it shows how a geometry shader can dynamically generate new
shapes on the fly.

```quiz
A geometry shader declares triangles as its input. The program draws 12 vertices as a triangle list. How often does the geometry shader run?
- [ ] 12 times: once per vertex, like the vertex shader
- [x] 4 times: once per triangle, with that triangle's three vertices as its input
- [ ] 3 times: once per vertex of a triangle
- [ ] Once for the whole draw call
---
The vertex shader runs per vertex; the geometry shader runs per primitive and gets all of the primitive's vertices at once (an array of 3 for triangles). 12 vertices in a triangle list are 4 triangles.
```

### A pass-through geometry shader

To demonstrate the use of a geometry shader we're going to render a really simple scene where we draw 4 points on
the z-plane in normalized device coordinates – the points you see in the window now. Each point has a position and a
colour.

:::opengl
```cpp
float points[] = {
    -0.5f,  0.5f, 1.0f, 0.0f, 0.0f, // top-left
     0.5f,  0.5f, 0.0f, 1.0f, 0.0f, // top-right
     0.5f, -0.5f, 0.0f, 0.0f, 1.0f, // bottom-right
    -0.5f, -0.5f, 1.0f, 1.0f, 0.0f  // bottom-left
};
```

The vertex shader needs to draw the points on the z-plane so we'll create a basic vertex shader, and the fragment
shader outputs the colour the vertex shader hands on. Points are drawn with `glDrawArrays(GL_POINTS, 0, 4);`.
:::
:::vulkan
```cpp
// learnopengl's four points, in Vulkan's normalized device coordinates: y points down, so -0.5 is the upper row
const std::vector<PointVertex> points = {
    {{-0.5f, -0.5f}, {1.0f, 0.0f, 0.0f}}, // top-left: red
    {{ 0.5f, -0.5f}, {0.0f, 1.0f, 0.0f}}, // top-right: green
    {{ 0.5f,  0.5f}, {0.0f, 0.0f, 1.0f}}, // bottom-right: blue
    {{-0.5f,  0.5f}, {1.0f, 1.0f, 0.0f}}  // bottom-left: yellow
};
```

The vertex shader puts the points on the z-plane and writes `gl_PointSize = 1.0;` – Vulkan draws a point list only
if the last shader stage before the rasterizer sets the points' size (learnopengl's *Advanced GLSL* chapter has the
details). The fragment shader outputs the colour the vertex shader hands on.
:::
:::d3d12
```cpp
        PointVertex points[] =
        {
            { { -0.5f,  0.5f }, { 1.0f, 0.0f, 0.0f } },    // top-left
            { {  0.5f,  0.5f }, { 0.0f, 1.0f, 0.0f } },    // top-right
            { {  0.5f, -0.5f }, { 0.0f, 0.0f, 1.0f } },    // bottom-right
            { { -0.5f, -0.5f }, { 1.0f, 1.0f, 0.0f } }     // bottom-left
        };
```

`VSMain` puts the points on the z-plane, and `PSMain` returns the colour the vertex shader hands on. A point is always
rasterized as a single pixel in Direct3D.
:::

Now we add a geometry shader that does nothing yet: it takes a point and passes it on unchanged, colour and all. The
colour is the one new thing. Without a geometry shader the vertex shader's output goes straight to the rasterizer and
the fragment shader; with one, the geometry shader receives the vertex shader's outputs and has to write the outputs
the fragment shader reads itself, for every vertex it emits.

:::opengl
Now do the first task, **pass-through**. First, the `Shader` class has to learn about a third shader file. In
`shader_m.h`, the constructor gets an optional parameter:

```cpp
    Shader(const char* vertexPath, const char* fragmentPath, const char* geometryPath = nullptr)
```

After the fragment shader is compiled, read and compile the geometry shader the same way, if a file is given:

```cpp
        // if a geometry shader file is given, read and compile it too
        unsigned int geometry = 0;
        if (geometryPath != nullptr)
        {
            std::string geometryCode;
            std::ifstream gShaderFile;
            gShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
            try
            {
                gShaderFile.open(geometryPath);
                std::stringstream gShaderStream;
                gShaderStream << gShaderFile.rdbuf();
                gShaderFile.close();
                geometryCode = gShaderStream.str();
            }
            catch (std::ifstream::failure& e)
            {
                std::cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " << e.what() << std::endl;
            }
            const char * gShaderCode = geometryCode.c_str();
            geometry = glCreateShader(GL_GEOMETRY_SHADER);
            glShaderSource(geometry, 1, &gShaderCode, NULL);
            glCompileShader(geometry);
            checkCompileErrors(geometry, "GEOMETRY");
        }
```

Attach it to the program next to the other two, and delete it after linking:

```cpp
        glAttachShader(ID, fragment);
        if (geometryPath != nullptr)
            glAttachShader(ID, geometry);
```

```cpp
        glDeleteShader(fragment);
        if (geometryPath != nullptr)
            glDeleteShader(geometry);
```

In `main.cpp` the shader gets its third file: `Shader shader("geometry_shader.vs", "geometry_shader.fs",
"geometry_shader.gs");`.

The vertex shader now writes its colour into an interface block for the geometry shader instead of straight to the
fragment shader. In `geometry_shader.vs`:

```glsl
out VS_OUT {
    vec3 color;
} vs_out;

void main()
{
    vs_out.color = aColor;
```

And `geometry_shader.gs` passes the point through:

```glsl
#version 330 core
layout (points) in;
layout (points, max_vertices = 1) out;

in VS_OUT {
    vec3 color;
} gs_in[];

out vec3 fColor;

void main()
{
    fColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = gl_in[0].gl_Position;
    EmitVertex();
    EndPrimitive();
}
```

The geometry shader receives the vertex shader's outputs as an array, `gs_in[]`, like `gl_in[]`: one element per
input vertex – even for points, where there is only one. It doesn't have to be an interface block (`in vec3
outColor[];` would work too), but blocks are easier to work with in shaders like the geometry shader. Its own output,
`fColor`, is what `geometry_shader.fs` already reads as `in vec3 fColor;` – the names of the fragment shader's inputs
have to match the geometry shader's outputs now.
:::
:::vulkan
Now do the first task, **pass-through**. Geometry shaders are an optional feature, so `createLogicalDevice()` turns it
on (and `isDeviceSuitable()` only accepts a GPU that has it, with `&& supportedFeatures.geometryShader` at the end of
its `return`):

```cpp
        deviceFeatures.samplerAnisotropy = VK_TRUE;
        deviceFeatures.geometryShader = VK_TRUE; // geometry shaders are an optional feature: turn it on
```

A pipeline with a geometry stage on a device without the feature enabled is invalid – the validation layer reports
it as soon as you create the pipeline.

Then `createPipeline()` gets a third, optional shader file. The signature gets a `geomShaderFile` after
`fragShaderFile` (`""` means none), and the fixed array of two stages becomes a vector that the geometry stage is added
to:

```cpp
        std::vector<VkPipelineShaderStageCreateInfo> shaderStages = {vertShaderStageInfo, fragShaderStageInfo};

        // the geometry shader, if there is one: it runs between the vertex and the fragment shader
        VkShaderModule geomShaderModule = VK_NULL_HANDLE;
        if (!geomShaderFile.empty()) {
            auto geomShaderCode = readFile(geomShaderFile);
            geomShaderModule = createShaderModule(geomShaderCode);

            VkPipelineShaderStageCreateInfo geomShaderStageInfo{};
            geomShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
            geomShaderStageInfo.stage = VK_SHADER_STAGE_GEOMETRY_BIT;
            geomShaderStageInfo.module = geomShaderModule;
            geomShaderStageInfo.pName = "main";
            shaderStages.push_back(geomShaderStageInfo);
        }
```

```cpp
        pipelineInfo.stageCount = static_cast<uint32_t>(shaderStages.size());
        pipelineInfo.pStages = shaderStages.data();
```

The order of the stages in the array doesn't matter – each says which stage it is. After `vkCreateGraphicsPipelines`,
the geometry module is destroyed like the other two (`if (geomShaderModule != VK_NULL_HANDLE)`), and the points'
pipeline is created with `"shaders/geometry_shader.geom.spv"` as its third file.

The vertex shader now writes its colour into an interface block for the geometry shader instead of straight to the
fragment shader. In `shaders/geometry_shader.vert`:

```glsl
// the outputs for the geometry shader, in an interface block
layout(location = 0) out VS_OUT {
    vec3 color;
} vs_out;

void main() {
    vs_out.color = inColor;
```

And `shaders/geometry_shader.geom` passes the point through:

```glsl
layout(points) in;
layout(points, max_vertices = 1) out;

layout(location = 0) in VS_OUT {
    vec3 color;
} gs_in[];

layout(location = 0) out vec3 fragColor;

void main() {
    fragColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = gl_in[0].gl_Position;
    EmitVertex();
    EndPrimitive();
}
```

The geometry shader receives the vertex shader's outputs as an array, `gs_in[]`, like `gl_in[]`: one element per
input vertex – even for points, where there is only one. As always in Vulkan, the stages are matched by `location`:
the block at location 0 of the vertex shader feeds `gs_in` at location 0, and the geometry shader's `fragColor` at
location 0 feeds the fragment shader's `fragColor`. The geometry shader doesn't write `gl_PointSize`: without the
optional `shaderTessellationAndGeometryPointSize` feature, points emitted by a geometry shader are always 1 pixel, and
the vertex shader's size no longer matters.
:::
:::d3d12
Now do the first task, **pass-through**. In `geometry_shader.hlsl` the vertex shader's output and the geometry
shader's output get a structure each – `PSInput` becomes `VSOutput`, and the pixel shader takes `GSOutput`:

```hlsl
// What the vertex shader hands on to the geometry shader.
struct VSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct GSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};
```

`VSMain` now returns a `VSOutput`, and `PSMain` becomes `float4 PSMain(GSOutput input) : SV_TARGET`. Between them goes
the geometry shader:

```hlsl
[maxvertexcount(1)]
void GSMain(point VSOutput input[1], inout PointStream<GSOutput> outputStream)
{
    GSOutput output;
    output.color = input[0].color;    // input[0] since there's only one input vertex
    output.position = input[0].position;
    outputStream.Append(output);
    outputStream.RestartStrip();
}
```

The two structures have the same members, so one would do; two names make clear which stage hands what to which.
What matters is that the semantics of the geometry shader's output match the pixel shader's input (`SV_POSITION`,
`COLOR`).

In `main.cpp`, compile `GSMain` with the geometry shader target, between the vertex and the pixel shader:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"geometry_shader.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
```

(with `ComPtr<ID3DBlob> geometryShader;` next to the other two blobs), and put it into the pipeline state:

```cpp
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());
```

`PrimitiveTopologyType` stays `D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`: it is the geometry shader's input.
:::

Build and run. If everything went well you see no change at all: the same four single-pixel points, in the same colours
and places. That's the point – the geometry shader passes everything through. It may seem a lot of work for nothing, but
now everything is in place to change what comes out.

:::opengl
```quiz
The geometry shader declares `layout (triangles) in;`, but the program still draws with `glDrawArrays(GL_POINTS, 0, 4)`. What happens?
- [ ] OpenGL converts each point into a degenerate triangle
- [ ] The geometry shader runs once for every three points
- [x] The draw call fails with `GL_INVALID_OPERATION`: the draw mode must fit the geometry shader's input
- [ ] The geometry shader is skipped and the points are drawn as before
---
The input qualifier and the primitive mode of the draw call have to fit (`points` for `GL_POINTS`, `triangles` for `GL_TRIANGLES`, …). Otherwise nothing is drawn and `glGetError` reports `GL_INVALID_OPERATION`.
```
:::
:::vulkan
```quiz
Why does `createLogicalDevice()` set `deviceFeatures.geometryShader = VK_TRUE`?
- [x] Geometry shaders are an optional feature: a pipeline may only contain a geometry stage if the feature is enabled on the logical device
- [ ] It makes the vertex shader's outputs available to the fragment shader
- [ ] It turns the point list into triangles
- [ ] It is needed for every pipeline with more than two shader stages
---
Optional features are off unless you request them in `VkDeviceCreateInfo::pEnabledFeatures`. `isDeviceSuitable()` checks `supportedFeatures.geometryShader` first, because requesting a feature the GPU doesn't have makes `vkCreateDevice` fail.
```
:::
:::d3d12
```quiz
With the geometry shader in place, what does `psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT` describe?
- [ ] The primitives the geometry shader outputs
- [ ] The primitives the rasterizer receives
- [ ] Nothing: with a geometry shader the field is ignored
- [x] The primitives the geometry shader takes as input: it must fit `point VSOutput input[1]`
---
With a geometry shader, the topology type describes the input assembler's primitives, which the geometry shader receives. What it outputs – points, lines or triangles – is decided by its stream type (`PointStream`, `LineStream`, `TriangleStream`).
```
:::

## Let's build houses

Drawing points and lines isn't that interesting so we're going to get a little creative by using the geometry shader
to draw a house for us at the location of each point. We can accomplish this by setting the output of the geometry
shader to `triangle_strip` and draw a total of three triangles: two for the square house and one for the roof.

A triangle strip in OpenGL is a more efficient way to draw triangles with fewer vertices. After the first triangle is
drawn, each subsequent vertex generates another triangle next to the first triangle: every 3 adjacent vertices will
form a triangle. If we have a total of 6 vertices that form a triangle strip we'd get the following triangles:
(1,2,3), (2,3,4), (3,4,5) and (4,5,6); forming a total of 4 triangles. A triangle strip needs at least 3 vertices and
will generate N-2 triangles; with 6 vertices we created 6-2 = 4 triangles. (Every API has triangle strips, and they
work the same way.)

Using a triangle strip as the output of the geometry shader we can easily create the house shape we're after by
generating 3 adjacent triangles in the correct order: bottom-left, bottom-right, top-left, top-right, and finally the
top of the roof. The first three vertices form the left half of the wall, the next three the right half, and the last
three the roof.

:::opengl
Now do the task **houses**. In `geometry_shader.gs`, the output becomes a triangle strip of at most 5 vertices:

```glsl
layout (triangle_strip, max_vertices = 5) out;
```

and `main` hands the point's position to a function that emits the house around it:

```glsl
void build_house(vec4 position)
{
    fColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = position + vec4(-0.2, -0.2, 0.0, 0.0); // 1:bottom-left
    EmitVertex();
    gl_Position = position + vec4( 0.2, -0.2, 0.0, 0.0); // 2:bottom-right
    EmitVertex();
    gl_Position = position + vec4(-0.2,  0.2, 0.0, 0.0); // 3:top-left
    EmitVertex();
    gl_Position = position + vec4( 0.2,  0.2, 0.0, 0.0); // 4:top-right
    EmitVertex();
    gl_Position = position + vec4( 0.0,  0.4, 0.0, 0.0); // 5:top
    EmitVertex();
    EndPrimitive();
}

void main()
{
    build_house(gl_in[0].gl_Position);
}
```
:::
:::vulkan
Now do the task **houses**. In `shaders/geometry_shader.geom`, the output becomes a triangle strip of at most 5
vertices:

```glsl
layout(triangle_strip, max_vertices = 5) out;
```

and `main` hands the point's position to a function that emits the house around it. One thing differs from
learnopengl's shader: Vulkan's y axis points down, so the bottom of the house is at +0.2 and the top of the roof at
-0.4 – the y offsets are negated, just like the points' positions, and the picture is the same:

```glsl
// Vulkan's y points down: the house's bottom is at +0.2, its roof's top at -0.4
void build_house(vec4 position) {
    fragColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = position + vec4(-0.2,  0.2, 0.0, 0.0); // 1:bottom-left
    EmitVertex();
    gl_Position = position + vec4( 0.2,  0.2, 0.0, 0.0); // 2:bottom-right
    EmitVertex();
    gl_Position = position + vec4(-0.2, -0.2, 0.0, 0.0); // 3:top-left
    EmitVertex();
    gl_Position = position + vec4( 0.2, -0.2, 0.0, 0.0); // 4:top-right
    EmitVertex();
    gl_Position = position + vec4( 0.0, -0.4, 0.0, 0.0); // 5:top
    EmitVertex();
    EndPrimitive();
}

void main() {
    build_house(gl_in[0].gl_Position);
}
```

The pipeline still has the point list topology – that's the geometry shader's input – and it culls nothing, so the
winding of the strip's triangles doesn't matter.
:::
:::d3d12
Now do the task **houses**. In `geometry_shader.hlsl`, the geometry shader now outputs a `TriangleStream` of at most 5
vertices. HLSL has no global output variables like GLSL's `gl_Position`, so the helper function gets the position,
the colour and the stream as parameters:

```hlsl
void build_house(float4 position, float3 color, inout TriangleStream<GSOutput> triStream)
{
    GSOutput output;
    output.color = color;
    output.position = position + float4(-0.2f, -0.2f, 0.0f, 0.0f);    // 1:bottom-left
    triStream.Append(output);
    output.position = position + float4( 0.2f, -0.2f, 0.0f, 0.0f);    // 2:bottom-right
    triStream.Append(output);
    output.position = position + float4(-0.2f,  0.2f, 0.0f, 0.0f);    // 3:top-left
    triStream.Append(output);
    output.position = position + float4( 0.2f,  0.2f, 0.0f, 0.0f);    // 4:top-right
    triStream.Append(output);
    output.position = position + float4( 0.0f,  0.4f, 0.0f, 0.0f);    // 5:top
    triStream.Append(output);
    triStream.RestartStrip();
}

[maxvertexcount(5)]
void GSMain(point VSOutput input[1], inout TriangleStream<GSOutput> triStream)
{
    build_house(input[0].position, input[0].color, triStream);    // input[0] since there's only one input vertex
}
```

The stream is passed on as `inout`, like in `GSMain`'s own signature. `PrimitiveTopologyType` stays `POINT`: the
geometry shader still takes points; that it outputs triangles is said by the `TriangleStream` alone.
:::

This geometry shader generates 5 vertices, with each vertex being the point's position plus an offset to form one large
triangle strip. The resulting primitive is then rasterized and the fragment shader runs on the entire triangle strip,
resulting in a coloured house for each point we've rendered.

Build and run: four houses, each in the colour of its point – a wall 160 pixels wide and 120 high with a roof 60 pixels
high on top, where the single pixels were before. You can see that each house indeed consists of 3 triangles – all drawn
using a single point in space.

```quiz
The five vertices of the house are emitted as one triangle strip: 1 bottom-left, 2 bottom-right, 3 top-left, 4 top-right, 5 top. Which vertices form the roof?
- [ ] 1, 2 and 5
- [ ] 1, 3 and 5
- [ ] 2, 4 and 5
- [x] 3, 4 and 5
---
In a strip every vertex makes a triangle with the two before it: (1,2,3) and (2,3,4) are the wall, (3,4,5) is the roof. That's why the vertices are emitted in this zig-zag order and not around the outline.
```

The houses look a bit boring with a single colour, so let's give each house a little extra by putting snow on its roof:
we give the last vertex – the top of the roof – its own colour, white.

:::opengl
Now do the task **roof-white**: in `build_house`, set the colour just before the fifth vertex is emitted:

```glsl
    gl_Position = position + vec4( 0.0,  0.4, 0.0, 0.0); // 5:top
    fColor = vec3(1.0, 1.0, 1.0); // the roof's tip is white: snow
    EmitVertex();
```

Because the shader's output `fColor` is a per-vertex value, every `EmitVertex` stores the value it has at that moment
with the vertex: the first four vertices keep the house's colour, and only the last one is white.
:::
:::vulkan
Now do the task **roof-white**: in `build_house`, set the colour just before the fifth vertex is emitted:

```glsl
    gl_Position = position + vec4( 0.0, -0.4, 0.0, 0.0); // 5:top
    fragColor = vec3(1.0, 1.0, 1.0); // the roof's tip is white: snow
    EmitVertex();
```

Because the shader's output `fragColor` is a per-vertex value, every `EmitVertex` stores the value it has at that
moment with the vertex: the first four vertices keep the house's colour, and only the last one is white.
:::
:::d3d12
Now do the task **roof-white**: in `build_house`, set the colour just before the fifth vertex is appended:

```hlsl
    output.position = position + float4( 0.0f,  0.4f, 0.0f, 0.0f);    // 5:top
    output.color = float3(1.0f, 1.0f, 1.0f);    // the roof's tip is white: snow
    triStream.Append(output);
```

`Append` copies the output structure as it is at that moment: the first four vertices keep the house's colour, and
only the last one is white.
:::

Build and run. The walls are unchanged, but each roof now fades from the house's colour at the eaves to white at its
tip, as if covered in snow.

```quiz
Only the roof's top vertex is white, yet the whole roof gets lighter towards the top. Why?
- [x] The colour is a per-vertex output: the rasterizer interpolates it across the roof triangle between its three vertices
- [ ] The geometry shader runs once per fragment and computes the gradient
- [ ] White is blended over the roof with alpha blending
- [ ] The vertices of a triangle strip always share their colours with the next strip
---
As with every vertex output, the fragment shader receives a value interpolated between the triangle's vertices – here two in the house's colour (the eaves) and one white (the tip). The wall's triangles have no white vertex, so they keep a single colour.
```

You can see that with geometry shaders you can get pretty creative, even with the simplest primitives. Because the
shapes are generated dynamically on the ultra-fast hardware of your GPU this can be a lot more powerful than defining
these shapes yourself within vertex buffers. Geometry shaders are a great tool for simple (often-repeating) shapes, like
cubes in a voxel world or grass leaves on a large outdoor field.

## Exploding objects

While drawing houses is fun and all, it's not something we're going to use that much. That's why we're now going to
take it up one notch and explode objects! That is something we're also probably not going to use that much either, but
it's definitely fun to do!

When we say exploding an object we're not actually going to blow up our precious bundled sets of vertices, but we're
going to move each triangle along the direction of their normal vector over a small period of time. The effect is that
the entire object's triangles seem to explode. The effect of exploding triangles on a model looks a bit like the model
falls apart into its pieces and comes together again.

First we need a model. learnopengl uses the backpack of its model loading chapter; we use the planet of our *Model*
chapter, with its ring.

:::opengl
Now do the task **planet**: replace the points by the Model chapter's scene. Add the camera globals after
`SCR_HEIGHT`:

```cpp
// camera: at (0, 0, 3) looking down -z
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Instead of the points' data, their VBO and VAO, the shader takes the `explode` files and the model is loaded:

```cpp
    Shader shader("explode.vs", "explode.fs", "explode.gs");

    // load models
    // -----------
    // (aiProcess_FlipUVs in model.h turns the texture coordinates the right way up: no stbi_set_flip_vertically_on_load)
    Model ourModel("models/planet.obj");
```

In the render loop, the planet is drawn with learnopengl's matrices instead of the points (remove the cleanup of the
VAO and VBO at the end too):

```cpp
        // configure transformation matrices
        glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        shader.use();
        shader.setMat4("projection", projection);
        shader.setMat4("view", view);
        shader.setMat4("model", model);

        // draw model
        ourModel.Draw(shader);
```

`explode.vs` transforms the vertices with `projection * view * model` and hands the texture coordinates on in an
interface block `VS_OUT { vec2 texCoords; }`. `explode.gs` takes `layout (triangles) in;` – `Mesh::Draw` draws
`GL_TRIANGLES` – and so far emits the triangle's three vertices again, each with its `TexCoords`.
:::
:::vulkan
Now do the task **planet**: replace the points by the Model chapter's scene. Add the camera globals after `HEIGHT`:

```cpp
// camera: at (0, 0, 3) looking down -z
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Remove everything of the points: `struct PointVertex`, `points`, and `pointsVertexBuffer` with its memory (the member,
its creation and its cleanup). The pipeline now draws the model with the `explode` shaders:

```cpp
        // the model: a triangle list, each vertex a Vertex; the geometry shader gets one triangle at a time
        createPipeline("shaders/explode.vert.spv", "shaders/explode.frag.spv", "shaders/explode.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), graphicsPipeline);
```

`updateUniformBuffer()` writes the view and the projection:

```cpp
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan
        ubo.proj[1][1] *= -1;
```

And `recordCommandBuffer()` draws the model like the Model chapter, instead of the points:

```cpp
        // the model's vertices and indices, and the descriptor set with its textures
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

        // the indices are uint32_t: a model can have more than 65536 vertices
        vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32);

        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

        // configure the model matrix
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        // draw model
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

`explode.vert` transforms the vertices with `ubo.proj * ubo.view * pc.model` and hands the texture coordinate and the
material index on in an interface block `VS_OUT { vec2 texCoord; flat uint materialIndex; }`. `explode.geom` takes
`layout(triangles) in;` and so far emits the triangle's three vertices again, each with its `fragTexCoord` and
`fragMaterialIndex` for the fragment shader.
:::
:::d3d12
Now do the task **planet**: replace the points by the Model chapter's scene. Add the camera globals before
`struct Vertex`:

```cpp
// camera: at (0, 0, 3) looking down -z, at the model in the centre of the scene
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f,  3.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

Remove everything of the points: `struct PointVertex`, `m_vertexBuffer`, `m_vertexBufferView` and the block that
creates the points' vertex buffer. The pipeline state now takes the three shaders of `explode.hlsl`, the mesh's input
layout and triangles:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout: a vertex of a mesh is a position, a normal and
        // texture coordinates (3 + 3 + 2 floats, at byte offsets 0, 12 and 24).
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

```cpp
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
```

In `LoadAssets` the model is loaded where the points' buffer was, its texture views from heap slot 1 on, and
`m_model.uploadHeaps.clear();` follows the `WaitForPreviousFrame()` at the end:

```cpp
    m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

`OnUpdate` writes the view and the projection into the constant buffer:

```cpp
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

And `PopulateCommandList` draws the model instead of the points:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    // The model matrix (root parameter 0): scale, then tilt, then move - learnopengl's
    // translate * rotate * scale, written in the order DirectXMath applies it.
    XMMATRIX model = XMMatrixScaling(0.5f, 0.5f, 0.5f)                                            // planet radius 0.5, ring up to 1.0
        * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f), XMConvertToRadians(25.0f))   // tilt it so the ring shows
        * XMMatrixTranslation(0.0f, 0.0f, 0.0f);                                                  // centre of the scene
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);

    // draw model: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());
```

`explode.hlsl`'s `VSMain` transforms the vertices with model, view and projection; its `GSMain` takes
`triangle VSOutput input[3]` and, with `[maxvertexcount(3)]`, so far appends the triangle's three vertices to a
`TriangleStream` again, each with its texture coordinates.
:::

Build and run: the textured planet with its ring, tilted towards you, on the dark background – the picture of the Model
chapter, unlit. It now goes through a geometry shader that changes nothing yet.

What we're going to do is translate each vertex of a triangle in the direction of the triangle's normal vector. That
means we first need to calculate this normal vector. What we need to do is calculate a vector that is perpendicular to
the surface of a triangle, using just the 3 vertices we have access to. You may remember from the transformations
chapter that we can retrieve a vector perpendicular to two other vectors using the cross product. If we were to
retrieve two vectors `a` and `b` that are parallel to the surface of a triangle we can retrieve its normal vector by
doing a cross product on those vectors.

:::opengl
The following geometry shader function does exactly this to retrieve the normal vector using 3 input vertex
coordinates:

```glsl
vec3 GetNormal()
{
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    return normalize(cross(a, b));
}
```

Here we retrieve two vectors `a` and `b` that are parallel to the surface of the triangle using vector subtraction.
Subtracting two vectors from each other results in a vector that is the difference of the two vectors. Since all 3
points lie on the triangle plane, subtracting any of its vectors from each other results in a vector parallel to the
plane. Do note that if we switched `a` and `b` in the `cross` function we'd get a normal vector that points in the
opposite direction – order is important here!
:::
:::vulkan
learnopengl's geometry shader function does exactly this to retrieve the normal vector using 3 input vertex
coordinates – with one change for Vulkan:

```glsl
vec3 GetNormal() {
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    // learnopengl returns cross(a, b); Vulkan's projection flips y (proj[1][1] *= -1), which mirrors clip space and
    // turns that vector around: b x a points out of the model here
    return normalize(cross(b, a));
}
```

Here we retrieve two vectors `a` and `b` that are parallel to the surface of the triangle using vector subtraction.
Since all 3 points lie on the triangle plane, subtracting any of its vectors from each other results in a vector
parallel to the plane. The order of `a` and `b` in the `cross` function decides whether the normal points out of the
model or into it – order is important here! These positions are in clip space, and our projection matrix negates y
to fit Vulkan's downward y axis. A mirror like that reverses the direction of a cross product: in clip space, learnopengl's
`cross(a, b)` points *into* the planet here (try it – the pieces fly inwards and the planet shrinks to a small blot),
and `cross(b, a)` points out of it.
:::
:::d3d12
The following function does exactly this to retrieve the normal vector using 3 input vertex coordinates. HLSL has no
`gl_in` that every function can read, so it gets the triangle's three positions as parameters:

```hlsl
// The normal of a triangle: the cross product of two of its sides.
float3 GetNormal(float4 position0, float4 position1, float4 position2)
{
    float3 a = position0.xyz - position1.xyz;
    float3 b = position2.xyz - position1.xyz;
    return normalize(cross(a, b));
}
```

Here we retrieve two vectors `a` and `b` that are parallel to the surface of the triangle using vector subtraction.
Subtracting two vectors from each other results in a vector that is the difference of the two vectors. Since all 3
points lie on the triangle plane, subtracting any of its vectors from each other results in a vector parallel to the
plane. Do note that if we switched `a` and `b` in the `cross` function we'd get a normal vector that points in the
opposite direction – order is important here!
:::

Now that we know how to calculate a normal vector we can create an `explode` function that takes this normal vector
along with a vertex position vector. The function returns a new vector that translates the position vector along the
direction of the normal vector. The `sin` function receives a `time` uniform variable as its argument that, based on
the time, returns a value between -1.0 and 1.0. Because we don't want to *implode* the object we transform the sin value
to the [0,1] range. The resulting value is then used to scale the normal vector and the resulting direction vector is
added to the position vector.

:::opengl
Now do the task **explode**. In `explode.gs`, at the TODO, add the `time` uniform and the two functions:

```glsl
uniform float time;

vec4 explode(vec4 position, vec3 normal)
{
    float magnitude = 2.0;
    vec3 direction = normal * ((sin(time) + 1.0) / 2.0) * magnitude; // 0 .. 2 and back, following sin(time)
    return position + vec4(direction, 0.0);
}

vec3 GetNormal()
{
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    return normalize(cross(a, b));
}
```

`main` computes the triangle's normal once and moves each of its three vertices along it:

```glsl
void main() {
    vec3 normal = GetNormal();

    gl_Position = explode(gl_in[0].gl_Position, normal);
    TexCoords = gs_in[0].texCoords;
    EmitVertex();
    gl_Position = explode(gl_in[1].gl_Position, normal);
    TexCoords = gs_in[1].texCoords;
    EmitVertex();
    gl_Position = explode(gl_in[2].gl_Position, normal);
    TexCoords = gs_in[2].texCoords;
    EmitVertex();
    EndPrimitive();
}
```

Note that we're also outputting the appropriate texture coordinates before emitting a vertex. Don't forget to actually
set the `time` uniform in your OpenGL code, after the model matrix:

```cpp
        // add time component to geometry shader in the form of a uniform
        shader.setFloat("time", static_cast<float>(glfwGetTime()));
```
:::
:::vulkan
Now do the task **explode**. Vulkan has no single uniforms, so the time goes into the uniform buffer: a new member
`float time` after `proj`, both in C++ and in the shader's block. In `main.cpp`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    float time; // for the geometry shader
};
```

`updateUniformBuffer()` fills it after the projection:

```cpp
        // add time component to geometry shader in the form of a uniform
        ubo.time = static_cast<float>(glfwGetTime());
```

So far only the vertex shader read the uniform buffer; now the geometry shader reads it too, and a descriptor is only
visible to the stages its binding names. In `createDescriptorSetLayout()`:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT; // the geometry shader reads it too
```

In `shaders/explode.geom`, at the TODO, declare the block and add the two functions:

```glsl
// the time in seconds: a new member of the uniform buffer (the matrices before it are not used here)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    float time;
} ubo;

vec4 explode(vec4 position, vec3 normal) {
    float magnitude = 2.0;
    vec3 direction = normal * ((sin(ubo.time) + 1.0) / 2.0) * magnitude; // 0 .. 2 and back, following sin(time)
    return position + vec4(direction, 0.0);
}
```

plus `GetNormal()` from above, with `cross(b, a)`. `main` computes the triangle's normal once and moves each of its
three vertices along it:

```glsl
void main() {
    vec3 normal = GetNormal();

    gl_Position = explode(gl_in[0].gl_Position, normal);
    fragTexCoord = gs_in[0].texCoord;
    fragMaterialIndex = gs_in[0].materialIndex;
    EmitVertex();
```

and the same with `explode(gl_in[1].gl_Position, normal)` and `explode(gl_in[2].gl_Position, normal)` for the other two
vertices. Note that we're also outputting the appropriate texture coordinate and material index before emitting a
vertex.
:::
:::d3d12
Now do the task **explode**. The time goes into the constant buffer: a new member `float time` after `projection`, both
in the HLSL `cbuffer SceneConstantBuffer` of `explode.hlsl` and in the C++ `struct SceneConstantBuffer`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float time;    // seconds since the first frame
};
```

`OnUpdate` fills it with `std::chrono`, like the *Transformations* chapter, before the `memcpy`:

```cpp
    // The time in seconds since the first frame, for the geometry shader.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    constantBufferData.time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
```

The root signature's table with the CBV is already visible to all stages (`D3D12_SHADER_VISIBILITY_ALL`), so the
geometry shader can read it. In `explode.hlsl`, at the TODO, add `GetNormal` from above and the `explode` function:

```hlsl
// Moves a position along a direction: 0 .. 2 units and back, following sin(time).
float4 explode(float4 position, float3 normal)
{
    float magnitude = 2.0f;
    float3 direction = normal * ((sin(time) + 1.0f) / 2.0f) * magnitude;
    return position + float4(direction, 0.0f);
}
```

`GSMain` computes the triangle's normal once and moves each of its three vertices along it:

```hlsl
    GSOutput output;
    float3 normal = GetNormal(input[0].position, input[1].position, input[2].position);

    output.position = explode(input[0].position, normal);
    output.texCoords = input[0].texCoords;
    triStream.Append(output);
```

and the same with `explode(input[1].position, normal)` and `explode(input[2].position, normal)` for the other two
vertices. Note that we're also outputting the appropriate texture coordinates before appending a vertex.
:::

Build and run. The result is a planet that seems to continually explode its triangles over time and then return to
normal again: with `sin(time)` the pieces fly apart and come back with a period of 2π seconds – furthest apart at about
1.6 seconds, whole again at about 4.7 seconds. Although not exactly super useful, it does show you a more advanced use
of the geometry shader.

Note *where* this happens: the vertex shader already multiplied the positions by the projection matrix, so the
geometry shader works in clip space, and both the normal and the movement are clip-space vectors – as in learnopengl.
That's why the planet doesn't explode into a neat sphere around itself but stretches towards the viewer and the window's
edges. It also means the picture differs a little between the APIs: OpenGL's clip-space z runs from -w to w, Vulkan's
and Direct3D's from 0 to w, which gives the normals slightly different directions.

:::opengl
```quiz
In `GetNormal`, what happens if you write `cross(b, a)` instead of `cross(a, b)`?
- [ ] Nothing: the cross product is commutative
- [x] The normal points the other way, so the triangles move into the planet instead of out of it
- [ ] The normal gets twice as long
- [ ] The normal lies in the triangle's plane instead of perpendicular to it
---
The cross product is anti-commutative: b × a = -(a × b). Both are perpendicular to the triangle, but only one points outwards – order is important here.
```
:::
:::vulkan
```quiz
Why does the Vulkan project's `GetNormal` return `cross(b, a)` instead of learnopengl's `cross(a, b)`?
- [ ] Vulkan's GLSL defines `cross` with the opposite sign
- [ ] Vulkan's clip-space z runs from 0 to 1
- [x] The projection matrix flips y (`proj[1][1] *= -1`), which mirrors clip space – and a mirror turns the cross product around
- [ ] The planet's triangles are clockwise in the OBJ file
---
In a mirrored space, a × b points the other way than the mirrored version of the original normal. With `cross(a, b)` the pieces would fly into the planet; `cross(b, a)` points outwards again.
```
:::
:::d3d12
```quiz
In `GetNormal`, what happens if you write `cross(b, a)` instead of `cross(a, b)`?
- [ ] Nothing: the cross product is commutative
- [x] The normal points the other way, so the triangles move into the planet instead of out of it
- [ ] The normal gets twice as long
- [ ] The normal lies in the triangle's plane instead of perpendicular to it
---
The cross product is anti-commutative: b × a = -(a × b). Both are perpendicular to the triangle, but only one points outwards – order is important here.
```
:::

## Visualizing normal vectors

To shake things up we're going to now discuss an example of using the geometry shader that is actually useful:
visualizing the normal vectors of any object. When programming lighting shaders you will eventually run into weird
visual outputs of which the cause is hard to determine. A common cause of lighting errors is incorrect normal vectors.
Either caused by incorrectly loading vertex data, improperly specifying them as vertex attributes, or by incorrectly
managing them in the shaders. What we want is some way to detect if the normal vectors we supplied are correct. A great
way to determine if your normal vectors are correct is by visualizing them, and it just so happens that the geometry
shader is an extremely useful tool for this purpose.

The idea is as follows: we first draw the scene as normal without a geometry shader and then we draw the scene a
second time, but this time only displaying normal vectors that we generate via a geometry shader. The geometry shader
takes as input a triangle primitive and generates 3 lines from them in the directions of their normal – one normal
vector for each vertex.

This time we're creating a geometry shader that uses the vertex normals supplied by the model instead of generating it
ourselves. To accommodate for scaling and rotations (due to the view and model matrix) we'll transform the normals with
a normal matrix. The geometry shader receives its position vectors as view-space coordinates so we should also
transform the normal vectors to the same space. The projection is applied in the geometry shader, after the normal has
been added: in view space a length of 0.2 is the same in every direction, while after the projection it would be
distorted by the perspective.

One small difference from learnopengl: our planet is scaled by 0.5. The normal matrix of a scaled model makes the
normals longer (twice as long here), so our vertex shader normalizes the transformed normal – otherwise the lines would
be 0.4 long instead of 0.2. learnopengl's model isn't scaled, so it doesn't need that.

:::opengl
`normal_visualization.vs` is complete:

```glsl
void main()
{
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(view * model)));
    vs_out.normal = normalize(normalMatrix * aNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = view * model * vec4(aPos, 1.0);
}
```

Now do the last task, **normals**. Write `normal_visualization.gs`:

```glsl
#version 330 core
layout (triangles) in;
layout (line_strip, max_vertices = 6) out;

in VS_OUT {
    vec3 normal;
} gs_in[];

const float MAGNITUDE = 0.2;

uniform mat4 projection;

void GenerateLine(int index)
{
    gl_Position = projection * gl_in[index].gl_Position;
    EmitVertex();
    gl_Position = projection * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    EmitVertex();
    EndPrimitive();
}

void main()
{
    GenerateLine(0); // first vertex normal
    GenerateLine(1); // second vertex normal
    GenerateLine(2); // third vertex normal
}
```

The contents of geometry shaders like these should be self-explanatory by now. Note that we're multiplying the normal
vector by a `MAGNITUDE` vector to restrain the size of the displayed normal vectors (otherwise they'd be a bit too
large). Since visualizing normals are mostly used for debugging purposes we can just display them as mono-colored lines
(or super-fancy lines if you feel like it) with the help of the fragment shader `normal_visualization.fs`, which
outputs yellow.

In `main.cpp`, the first shader becomes the plain one (no geometry shader), and a second one draws the normals:

```cpp
    Shader shader("default.vs", "default.fs");
    Shader normalShader("normal_visualization.vs", "normal_visualization.fs", "normal_visualization.gs");
```

Remove the `setFloat("time", …)` line. Then render the model twice – first as usual, then with the normal shader:

```cpp
        // draw model as usual
        ourModel.Draw(shader);

        // then draw model with normal visualizing geometry shader
        normalShader.use();
        normalShader.setMat4("projection", projection);
        normalShader.setMat4("view", view);
        normalShader.setMat4("model", model);

        ourModel.Draw(normalShader);
```
:::
:::vulkan
`shaders/normal_visualization.vert` is complete:

```glsl
void main() {
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(ubo.view * pc.model)));
    vs_out.normal = normalize(normalMatrix * inNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

Now do the last task, **normals**. Write the rest of `shaders/normal_visualization.geom`. It reads the projection from
the uniform buffer, so it declares the block (the binding's stage flags keep the geometry bit from the last task):

```glsl
layout(triangles) in;
layout(line_strip, max_vertices = 6) out;

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in VS_OUT {
    vec3 normal;
} gs_in[];

const float MAGNITUDE = 0.2;

void GenerateLine(int index) {
    gl_Position = ubo.proj * gl_in[index].gl_Position;
    EmitVertex();
    gl_Position = ubo.proj * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    EmitVertex();
    EndPrimitive();
}

void main() {
    GenerateLine(0); // first vertex normal
    GenerateLine(1); // second vertex normal
    GenerateLine(2); // third vertex normal
}
```

The contents of geometry shaders like these should be self-explanatory by now. Note that we're multiplying the normal
vector by `MAGNITUDE` to restrain the size of the displayed normal vectors. Since visualizing normals are mostly used
for debugging purposes we just display them as mono-coloured lines: `normal_visualization.frag` outputs yellow.

The time is no longer needed: remove `float time` from `UniformBufferObject` and the `ubo.time` line. In OpenGL you
would switch shader programs between the two draws; in Vulkan the shaders belong to the pipeline, so we need a second
one. Add a member `VkPipeline normalPipeline;` (destroyed in `cleanup()` next to `graphicsPipeline`), and create both:

```cpp
        // the model: a triangle list, each vertex a Vertex - drawn as usual, then its normals with a geometry shader
        createPipeline("shaders/default.vert.spv", "shaders/default.frag.spv", "", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), graphicsPipeline);
        createPipeline("shaders/normal_visualization.vert.spv", "shaders/normal_visualization.frag.spv", "shaders/normal_visualization.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), normalPipeline);
```

The first one passes `""`: no geometry shader. Then render the model twice in `recordCommandBuffer()`:

```cpp
        // draw model as usual
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);

        // then draw model with normal visualizing geometry shader (the same buffers, descriptor set and push constants)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, normalPipeline);
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

Both pipelines share the pipeline layout, so the vertex and index buffers, the descriptor set and the push constants
bound for the first draw stay valid for the second.
:::
:::d3d12
The vertex shader of `normal_visualization.hlsl` is complete. It needs the normal matrix, which the root constants
deliver (more on that below):

```hlsl
VSOutput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    VSOutput result;

    // The geometry shader works in view space: the position only gets the model and the
    // view matrix (the geometry shader applies the projection).
    result.position = mul(mul(position, model), view);
    // The normal: into world space with the normal matrix, then into view space with the
    // view matrix (it only turns and moves the scene, so it turns normals like positions).
    // Normalized: the model is scaled, the lines must still be 0.2 long.
    float3 worldNormal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.normal = normalize(mul(float4(worldNormal, 0.0f), view).xyz);

    return result;
}
```

Now do the last task, **normals**. Write the geometry shader of `normal_visualization.hlsl`:

```hlsl
static const float MAGNITUDE = 0.2f;

// A line from a vertex along its normal, as a strip of 2 vertices.
void GenerateLine(VSOutput vertex, inout LineStream<GSOutput> lineStream)
{
    GSOutput output;
    output.position = mul(vertex.position, projection);
    lineStream.Append(output);
    output.position = mul(vertex.position + float4(vertex.normal, 0.0f) * MAGNITUDE, projection);
    lineStream.Append(output);
    lineStream.RestartStrip();
}

// The geometry shader: runs once per triangle and outputs three lines (6 vertices).
[maxvertexcount(6)]
void GSMain(triangle VSOutput input[3], inout LineStream<GSOutput> lineStream)
{
    GenerateLine(input[0], lineStream);    // first vertex normal
    GenerateLine(input[1], lineStream);    // second vertex normal
    GenerateLine(input[2], lineStream);    // third vertex normal
}
```

The contents of geometry shaders like these should be self-explanatory by now. Note that we're multiplying the normal
vector by `MAGNITUDE` to restrain the size of the displayed normal vectors. Since visualizing normals are mostly used
for debugging purposes we just display them as mono-coloured lines: `PSMain` returns yellow.

In `main.cpp`, the root constants get the normal matrix next to the model matrix – 32 floats now:

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
```

`PopulateCommandList` computes it like the lighting chapters, transposed once more for HLSL like every matrix:

```cpp
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

The time is no longer needed: remove `float time` from `SceneConstantBuffer` and its lines in `OnUpdate`. In OpenGL
you would switch shader programs between the two draws; in Direct3D 12 the shaders belong to the pipeline state, so we
need a second one, `ComPtr<ID3D12PipelineState> m_normalPipelineState;`. `m_pipelineState` now uses `default.hlsl`'s
`VSMain` and `PSMain` – and no geometry shader, so the `psoDesc.GS = …` line goes. After it is created, the same
description becomes the normals' pipeline state:

```cpp
        ComPtr<ID3DBlob> normalVertexShader;
        ComPtr<ID3DBlob> normalPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &normalVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &normalPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(normalVertexShader.Get());
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(normalPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_normalPipelineState)));
```

Its `PrimitiveTopologyType` stays `TRIANGLE`: the geometry shader takes triangles and outputs lines. Then render the
model twice:

```cpp
    // draw model as usual: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());

    // then draw model with normal visualizing geometry shader
    m_commandList->SetPipelineState(m_normalPipelineState.Get());
    m_model.Draw(m_commandList.Get());
```

Both pipeline states use the same root signature, so the root constants and the CBV table set for the first draw
stay set for the second.
:::

Build and run: the planet as in the `planet` task, unexploded, with yellow hairs standing out of its sphere and up from
its ring – one per vertex. Looking at the picture, it seems the normals are indeed correct: they point straight away
from the surface everywhere. Apart from visualizing normals, a geometry shader like this is frequently used to add fur
to objects.

```quiz
Why does the normal visualization's vertex shader leave out the projection and let the geometry shader apply it?
- [ ] The vertex shader cannot read the projection matrix
- [ ] Clip-space positions cannot be passed between shader stages
- [x] The line's end point is computed by adding the normal in view space, where a length of 0.2 means the same in every direction; the projection comes after
- [ ] The projection is only needed for triangles, not for lines
---
Adding a direction to a position only makes sense in a space without perspective distortion. So the vertex shader stops in view space, the geometry shader adds `normal * MAGNITUDE` there, and only then projects both ends of the line.
```

Geometry shaders are a powerful but slightly special tool: on some hardware they are slow when they emit many vertices,
which is why modern engines often use compute shaders or (where available) mesh shaders for heavy geometry generation.
For simple tasks like the ones in this chapter, and for debugging, they are perfect.

## Additional resources

:::opengl
- [Geometry Shader](https://www.khronos.org/opengl/wiki/Geometry_Shader): the OpenGL wiki on input and output
  primitives, `gl_in` and the limits.
- learnopengl's source code of the three examples, e.g.
  [geometry_shader_houses.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/4.advanced_opengl/9.1.geometry_shader_houses/geometry_shader_houses.cpp).
:::
:::vulkan
- [Geometry Shading](https://docs.vulkan.org/spec/latest/chapters/geometry.html): the chapter of the Vulkan
  specification on geometry shaders, their input and output primitives and point sizes.
- [GL_KHR_vulkan_glsl](https://github.com/KhronosGroup/GLSL/blob/main/extensions/khr/GL_KHR_vulkan_glsl.txt): how
  Vulkan's GLSL differs from OpenGL's.
:::
:::d3d12
- [Geometry-Shader Object](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-geometry-shader):
  `[maxvertexcount]` and the input primitive types.
- [Stream-Output Object](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-so-type):
  `PointStream`, `LineStream`, `TriangleStream`, `Append` and `RestartStrip`.
- [Geometry Shader Stage](https://learn.microsoft.com/en-us/windows/win32/direct3d11/geometry-shader-stage): what the
  stage receives and outputs (written for Direct3D 11; the stage is the same in Direct3D 12).
:::

In the next chapter we draw not one model but hundreds of copies of it – with a single draw call: *instancing*.
