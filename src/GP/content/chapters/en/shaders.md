# Shaders

As mentioned in the *Hello Triangle* chapter, shaders are little programs that rest on the GPU. These programs are
run for each specific section of the graphics pipeline. In a basic sense, shaders are nothing more than programs
transforming inputs to outputs. Shaders are also very isolated programs in that they're not allowed to communicate
with each other; the only communication they have is via their inputs and outputs.

In the previous chapter we briefly touched the surface of shaders and how to properly use them. We will now explain
shaders, and specifically the {{shaderLanguage}} shading language, in a more general fashion: what types it has,
how data gets into and out of a shader, and how the application on the CPU can hand values to the shaders while
the program runs.

:::opengl
This chapter's project is the triangle from *Hello Triangle* with one change you will recognise at the end of this
chapter: the shader sources no longer live as strings in `main.cpp` but in two files of their own,
`shader.vs` (the vertex shader) and `shader.fs` (the fragment shader), and a small `Shader` class in `shader_s.h`
reads, compiles and links them. The sections *Our own shader class* and *Reading from file* explain how that class
works; until then it is enough to know that `Shader ourShader("shader.vs", "shader.fs");` builds the
shader program and `ourShader.use();` activates it.
:::
:::vulkan
This chapter's project is the finished Hello Triangle program: the orange triangle on a teal background, drawn from
a vertex buffer that holds one `glm::vec3 pos` per vertex. The two shaders are in `shaders/shader.vert` and
`shaders/shader.frag`. Remember that Vulkan's clip space has its y axis pointing **down**: the vertex
`{0.0f, -0.5f, 0.0f}` is the top corner of the triangle.
:::
:::d3d12
This chapter's project is the finished Hello Triangle program in the style of Microsoft's D3D12HelloTriangle
sample: the orange triangle on a teal background, drawn from a vertex buffer that holds one `XMFLOAT3 position` per
vertex. Both shaders are in the file `shaders.hlsl`: the vertex shader `VSMain` and the pixel shader `PSMain`
(Direct3D's name for the fragment shader).
:::

All the tasks in this chapter change a program that already works, so there are no `// TODO:` comments this time: each
task tells you which lines to change. After each one, build and run the program to see the result.

## {{shaderLanguage}}

:::opengl
Shaders are written in the C-like language GLSL. GLSL is tailored for use with graphics and contains useful
features specifically targeted at vector and matrix manipulation.

Shaders always begin with a version declaration, followed by a list of input and output variables, uniforms and
its `main` function. Each shader's entry point is at its `main` function where we process any input variables and
output the results in its output variables. Don't worry if you don't know what uniforms are, we'll get to those
shortly.

A shader typically has the following structure:

```glsl
#version version_number
in type in_variable_name;
in type in_variable_name;

out type out_variable_name;

uniform type uniform_name;

void main()
{
  // process input(s) and do some weird graphics stuff
  ...
  // output processed stuff to output variable
  out_variable_name = weird_stuff_we_processed;
}
```

When we're talking specifically about the vertex shader each input variable is also known as a *vertex attribute*.
There is a maximum number of vertex attributes we're allowed to declare limited by the hardware. OpenGL guarantees
there are always at least 16 4-component vertex attributes available, but some hardware may allow for more which
you can retrieve by querying `GL_MAX_VERTEX_ATTRIBS`:

```cpp
int nrAttributes;
glGetIntegerv(GL_MAX_VERTEX_ATTRIBS, &nrAttributes);
std::cout << "Maximum nr of vertex attributes supported: " << nrAttributes << std::endl;
```

This often returns the minimum of 16 which should be more than enough for most purposes.
:::
:::vulkan
Vulkan shaders are usually written in GLSL as well – the same C-like language that OpenGL uses, tailored for
graphics, with useful features specifically targeted at vector and matrix manipulation. The difference is in how
the shaders reach the driver: Vulkan does not accept GLSL source code at all. It only takes shaders in **SPIR-V**,
a binary intermediate format, so the GLSL files are compiled *before* the program runs, by a compiler such as
`glslc` (more about that in *Our own shader class*).

Shaders always begin with a version declaration, followed by a list of input and output variables, uniform blocks
and its `main` function. Each shader's entry point is at its `main` function where we process any input variables
and output the results in its output variables. For Vulkan we use `#version 450`, and every input and output
variable gets a `layout(location = …)` qualifier – SPIR-V for Vulkan requires one:

```glsl
#version 450

layout(location = 0) in type in_variable_name;

layout(location = 0) out type out_variable_name;

void main() {
    // process input(s) and do some weird graphics stuff
    ...
    // output processed stuff to output variable
    out_variable_name = weird_stuff_we_processed;
}
```

When we're talking specifically about the vertex shader each input variable is also known as a *vertex attribute*.
The number of vertex attributes is limited by the hardware: Vulkan guarantees at least 16
(`VkPhysicalDeviceLimits::maxVertexInputAttributes`), which is more than enough for most purposes.
:::
:::d3d12
Direct3D shaders are written in **HLSL**, the High-Level Shading Language. If you have seen GLSL (the language of
OpenGL and Vulkan tutorials), HLSL will look very familiar: both are C-like, both are tailored for graphics, and
both have vector and matrix types built in. The main differences are in the details:

| | GLSL | HLSL |
|---|---|---|
| Entry point | always `main` | any name you choose: here `VSMain` and `PSMain` |
| Inputs and outputs | global `in` / `out` variables | function parameters and return values, tagged with *semantics* (`: POSITION`, `: SV_TARGET`) |
| Vector types | `vec2`, `vec3`, `vec4` | `float2`, `float3`, `float4` |
| Both shaders in one file | no (one file per stage) | yes: a file can hold several entry points |

The project's `shaders.hlsl` has this structure:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

When we're talking specifically about the vertex shader each input is also known as a *vertex attribute* (Direct3D
calls the description of one an *input element*). The number of input elements is limited: Direct3D 12 allows up
to 32 per vertex, which is more than enough for most purposes.
:::

## Types

{{shaderLanguage}} has, like any other programming language, data types for specifying what kind of variable we want
to work with. {{shaderLanguage}} has most of the default basic types we know from languages like C: `int`, `float`,
`double`, `uint` and `bool`. {{shaderLanguage}} also features two container types that we'll be using a lot, namely
vectors and matrices. We'll discuss matrices in a later chapter.

### Vectors

:::opengl vulkan
A vector in GLSL is a 2, 3 or 4 component container for any of the basic types just mentioned. They can take the
following form (`n` represents the number of components):

- `vecn`: the default vector of `n` floats.
- `bvecn`: a vector of `n` booleans.
- `ivecn`: a vector of `n` integers.
- `uvecn`: a vector of `n` unsigned integers.
- `dvecn`: a vector of `n` double components.

Most of the time we will be using the basic `vecn` since floats are sufficient for most of our purposes.

Components of a vector can be accessed via `vec.x` where `x` is the first component of the vector. You can use
`.x`, `.y`, `.z` and `.w` to access their first, second, third and fourth component respectively. GLSL also allows
you to use `rgba` for colors or `stpq` for texture coordinates, accessing the same components.

The vector datatype allows for some interesting and flexible component selection called *swizzling*. Swizzling
allows us to use syntax like this:

```glsl
vec2 someVec;
vec4 differentVec = someVec.xyxx;
vec3 anotherVec = differentVec.zyw;
vec4 otherVec = someVec.xxxx + anotherVec.yxzy;
```

You can use any combination of up to 4 letters to create a new vector (of the same type) as long as the original
vector has those components; it is not allowed to access the `.z` component of a `vec2` for example. We can also
pass vectors as arguments to different vector constructor calls, reducing the number of arguments required:

```glsl
vec2 vect = vec2(0.5, 0.7);
vec4 result = vec4(vect, 0.0, 0.0);
vec4 otherResult = vec4(result.xyz, 1.0);
```

You have already seen this in the vertex shader, which builds `gl_Position` with `vec4(…, 1.0)`: a 4-component
vector from the 3-component position and a `w` of `1.0`.
:::
:::d3d12
A vector in HLSL is a 1 to 4 component container for any of the basic types just mentioned. The type name is the
basic type followed by the number of components (`n`):

- `floatn`: the default vector of `n` floats (`float2`, `float3`, `float4`).
- `booln`: a vector of `n` booleans.
- `intn`: a vector of `n` integers.
- `uintn`: a vector of `n` unsigned integers.
- `doublen`: a vector of `n` double components.

Most of the time we will be using `floatn` since floats are sufficient for most of our purposes.

Components of a vector can be accessed via `v.x` where `x` is the first component of the vector. You can use `.x`,
`.y`, `.z` and `.w` to access their first, second, third and fourth component respectively, or `.r`, `.g`, `.b` and
`.a` for the same components when the vector is a colour (you may not mix the two sets in one access).

The vector datatype allows for some interesting and flexible component selection called *swizzling*. Swizzling
allows us to use syntax like this:

```hlsl
float2 someVec;
float4 differentVec = someVec.xyxx;
float3 anotherVec = differentVec.zyw;
float4 otherVec = someVec.xxxx + anotherVec.yxzy;
```

You can use any combination of up to 4 letters to create a new vector (of the same type) as long as the original
vector has those components; it is not allowed to access the `.z` component of a `float2` for example. We can also
pass vectors as arguments to vector constructors, reducing the number of arguments required:

```hlsl
float2 vect = float2(0.5f, 0.7f);
float4 result = float4(vect, 0.0f, 0.0f);
float4 otherResult = float4(result.xyz, 1.0f);
```

The vertex shader of this chapter will use exactly this to build its output position:
`float4(position.x, -position.y, position.z, 1.0f)`.
:::

Vectors are thus a flexible datatype that we can use for all kinds of input and output. Throughout the course you'll
see plenty of examples of how we can creatively manage vectors.

## Ins and outs

Shaders are nice little programs on their own, but they are part of a whole and for that reason we want to have
inputs and outputs on the individual shaders so that we can move stuff around.

:::opengl
GLSL defined the `in` and `out` keywords specifically for that purpose. Each shader can specify inputs and outputs
using those keywords and wherever an output variable matches with an input variable of the next shader stage
they're passed along. The vertex and fragment shader differ a bit though.

The vertex shader *should* receive some form of input otherwise it would be pretty ineffective. The vertex shader
differs in its input, in that it receives its input straight from the vertex data. To define how the vertex data
is organized we specify the input variables with location metadata so we can configure the vertex attributes on
the CPU. We've seen this in the previous chapter as `layout (location = 0)`. The vertex shader thus requires an
extra layout specification for its inputs so we can link it with the vertex data.

> It is also possible to omit the `layout (location = 0)` specifier and query for the attribute locations in your
> OpenGL code via `glGetAttribLocation`, but we prefer to set them in the vertex shader. It is easier to understand
> and saves you (and OpenGL) some work.

The other exception is that the fragment shader requires a `vec4` color output variable, since the fragment
shaders needs to generate a final output color. If you fail to specify an output color in your fragment shader,
the color buffer output for those fragments will be undefined (which usually means OpenGL will render them either
black or white).

So if we want to send data from one shader to the other we'd have to declare an output in the sending shader and
a similar input in the receiving shader. When the types and the names are equal on both sides OpenGL will link
those variables together and then it is possible to send data between shaders (this is done when linking a
program object). To show you how this works in practice we're going to alter the shaders from the previous chapter
to let the vertex shader decide the color for the fragment shader.

**Vertex shader** (`shader.vs`)

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec4 vertexColor; // specify a color output to the fragment shader

void main()
{
    gl_Position = vec4(aPos, 1.0); // see how we directly give a vec3 to vec4's constructor
    vertexColor = vec4(0.5, 0.0, 0.0, 1.0); // set the output variable to a dark-red color
}
```

**Fragment shader** (`shader.fs`)

```glsl
#version 330 core
out vec4 FragColor;

in vec4 vertexColor; // the input variable from the vertex shader (same name and same type)

void main()
{
    FragColor = vertexColor;
}
```

You can see we declared a `vertexColor` variable as a `vec4` output that we set in the vertex shader and we declare
a similar `vertexColor` input in the fragment shader. Since they both have the same type and name, the
`vertexColor` in the fragment shader is linked to the `vertexColor` in the vertex shader. Because we set the color
to a dark-red color in the vertex shader, the resulting fragments should be dark-red as well.
:::
:::vulkan
GLSL defines the `in` and `out` keywords for this. Each shader can specify inputs and outputs using those keywords,
and wherever an output variable matches with an input variable of the next shader stage they're passed along. The
vertex and fragment shader differ a bit though.

The vertex shader receives its input straight from the vertex data. Its input variables carry a location –
`layout(location = 0) in vec3 inPosition;` – and the attribute descriptions in `main.cpp`
(`Vertex::getAttributeDescriptions()`) say which bytes of the vertex buffer go to which location.

The fragment shader writes its result to an output variable as well: `layout(location = 0) out vec4 outColor;`.
For a fragment shader, location 0 means the first colour attachment of the subpass – the swap chain image we draw
into.

Between the vertex and the fragment shader there is one important difference from OpenGL. In OpenGL's GLSL 3.30,
an output and an input are connected when they have the same **name** and type. In Vulkan they are connected by
their **location**: the output at `location = 0` of the vertex shader feeds the input at `location = 0` of the
fragment shader, and the types have to match. The names don't matter at all – you could call the variable
`vertexColor` in one shader and `color` in the other. That is also why the location qualifier is required on every
`in` and `out`.

To show you how this works in practice we're going to alter the shaders to let the vertex shader decide the color
for the fragment shader.

**Vertex shader** (`shaders/shader.vert`)

```glsl
#version 450

layout(location = 0) in vec3 inPosition;

layout(location = 0) out vec4 vertexColor; // the color we pass on to the fragment shader

void main() {
    gl_Position = vec4(inPosition, 1.0);
    vertexColor = vec4(0.5, 0.0, 0.0, 1.0); // dark red
}
```

**Fragment shader** (`shaders/shader.frag`)

```glsl
#version 450

layout(location = 0) in vec4 vertexColor; // from the vertex shader (same location, same type)

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vertexColor;
}
```

Note that the vertex shader's input and its output both use location 0: inputs and outputs are separate
interfaces, each with its own locations. Because we set the color to dark red in the vertex shader, the resulting
fragments should be dark red as well.
:::
:::d3d12
In HLSL, a shader's inputs are its function parameters and its outputs are its return value. Each of them carries a
**semantic** after a colon, a name that says what the value is and how it connects to the stage before and after:

- The vertex shader's inputs come straight from the vertex data. `float4 position : POSITION` receives the input
  element with the semantic name `"POSITION"` from the input layout in `main.cpp`. (The buffer holds only three
  floats per vertex; when a shader asks for more components than the format provides, the missing `w` is filled in
  with 1.)
- Semantics that start with `SV_` are *system values* with a special meaning for the pipeline. `SV_POSITION` in the
  vertex shader's output is the clip-space position the rasterizer uses (GLSL's `gl_Position`); `SV_TARGET` on the
  pixel shader's return value is the colour written to render target 0.
- All other semantics, such as `COLOR`, are names you choose. A value the vertex shader writes with semantic
  `COLOR` arrives in the pixel shader's input with semantic `COLOR`.

The usual way to keep both sides in agreement is one struct used as the vertex shader's return type and as the
pixel shader's parameter – that is what `PSInput` is for. To show you how this works in practice we're going to
alter the shaders to let the vertex shader decide the color for the pixel shader:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = float4(0.5f, 0.0f, 0.0f, 1.0f);    // dark red

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The colour from the vertex shader, interpolated across the triangle.
    return input.color;
}
```

Because we set the color to dark red in the vertex shader, the resulting pixels should be dark red as well.
:::

Now do the first task, **in-out**: make the change above and build. You should see the same triangle, now dark red
(RGB 128, 0, 0) instead of orange.

There we go! We just managed to send a value from the vertex shader to the fragment shader.

:::opengl
```quiz
How does OpenGL connect an `out` variable of the vertex shader to an `in` variable of the fragment shader in this project?
- [ ] By the order in which they are declared, whatever their names
- [ ] With `glVertexAttribPointer`, like a vertex attribute
- [x] They must have the same name and the same type; the connection is made when the program is linked
---
With GLSL 3.30 (and no explicit locations on the outputs), the linker pairs outputs and inputs by name and type. `glVertexAttribPointer` is only for the vertex shader's inputs from the vertex data.
```
:::
:::vulkan
```quiz
How does Vulkan connect an `out` variable of the vertex shader to an `in` variable of the fragment shader?
- [ ] By name, like in OpenGL
- [x] By the `location` (with matching types); the names don't matter
- [ ] With a vertex attribute description in `main.cpp`
---
In Vulkan the interface between stages is matched by location. The attribute descriptions only feed the vertex shader's inputs from the vertex buffer.
```
:::
:::d3d12
```quiz
How does Direct3D 12 connect what the vertex shader outputs to what the pixel shader receives?
- [x] By the semantics: the value written with `COLOR` arrives in the input with `COLOR`
- [ ] By the variable names in the two functions
- [ ] With an input element in the input layout in `main.cpp`
---
Outputs and inputs between stages are matched by their semantics; using one struct (`PSInput`) on both sides keeps them in agreement. The input layout only feeds the vertex shader from the vertex buffer.
```
:::

## Uniforms

:::opengl
*Uniforms* are another way to pass data from our application on the CPU to the shaders on the GPU. Uniforms are
however slightly different compared to vertex attributes. First of all, uniforms are *global*. Global, meaning
that a uniform variable is unique per shader program object, and can be accessed from any shader at any stage in
the shader program. Second, whatever you set the uniform value to, uniforms will keep their values until they're
either reset or updated.

To declare a uniform in GLSL we simply add the `uniform` keyword to a shader with a type and a name. From that
point on we can use the newly declared uniform in the shader. Let's see if this time we can set the color of the
triangle via a uniform:

```glsl
#version 330 core
out vec4 FragColor;

uniform vec4 ourColor; // we set this variable in the OpenGL code.

void main()
{
    FragColor = ourColor;
}
```

We declared a uniform `vec4` `ourColor` in the fragment shader and set the fragment's output color to the content
of this uniform value. Since uniforms are global variables, we can define them in any shader stage we'd like so no
need to go through the vertex shader again to get something to the fragment shader. We're not using this uniform
in the vertex shader so there's no need to define it there.

> If you declare a uniform that isn't used anywhere in your GLSL code the compiler will silently remove the variable
> from the compiled version which is the cause for several frustrating errors; keep this in mind!

The uniform is currently empty; we haven't added any data to the uniform yet so let's try that. We first need to
find the index/location of the uniform attribute in our shader. Once we have the index/location of the uniform, we
can update its values. Instead of passing a single color to the fragment shader, let's spice things up by
gradually changing color over time:

```cpp
        ourShader.use();

        // update the uniform color (the shader must be active before glUniform calls)
        double timeValue = glfwGetTime();
        float greenValue = static_cast<float>(sin(timeValue) / 2.0 + 0.5);
        int vertexColorLocation = glGetUniformLocation(ourShader.ID, "ourColor");
        glUniform4f(vertexColorLocation, 0.0f, greenValue, 0.0f, 1.0f);
```

First, we retrieve the running time in seconds via `glfwGetTime()`. Then we vary the color in the range of
`0.0` - `1.0` by using the `sin` function and store the result in `greenValue` (`sin` comes from `<cmath>`, so add
`#include <cmath>` at the top of `main.cpp`).

Then we query for the location of the `ourColor` uniform using `glGetUniformLocation`. We supply the shader
program (`ourShader.ID`, the program object the `Shader` class created) and the name of the uniform (that we want
to retrieve the location from) to the query function. If `glGetUniformLocation` returns `-1`, it could not find
the location. Lastly we can set the uniform value using the `glUniform4f` function. Note that finding the uniform
location does not require you to use the shader program first, but updating a uniform **does** require you to
first use the program (by calling `glUseProgram`, which `ourShader.use()` does), because it sets the uniform on the
currently active shader program.

> Because OpenGL is in its core a C library it does not have native support for function overloading, so wherever
> a function can be called with different types OpenGL defines new functions for each type required;
> `glUniform` is a perfect example of this. The function requires a specific postfix for the type of the uniform
> you want to set. A few of the possible postfixes are:
>
> - `f`: the function expects a `float` as its value.
> - `i`: the function expects an `int` as its value.
> - `ui`: the function expects an `unsigned int` as its value.
> - `3f`: the function expects 3 `float`s as its value.
> - `fv`: the function expects a `float` vector/array as its value.
>
> Whenever you want to configure an option of OpenGL simply pick the overloaded function that corresponds with
> your type. In our case we want to set 4 floats of the uniform individually so we pass our data via `glUniform4f`
> (note that we also could've used the `fv` version).

Now that we know how to set the values of uniform variables, we can use them for rendering. If we want the color
to gradually change, we want to update this uniform every frame, otherwise the triangle would maintain a single
solid color if we only set it once. That is why the code goes into the render loop, right after
`ourShader.use();` and before the draw call.

Now do the task **uniform**: declare the uniform in `shader.fs`, include `<cmath>` and add the lines above to the
render loop. If you did things right you'll see the triangle gradually change from green to black and back to
green. (The `vertexColor` output of the vertex shader is still there, but nothing reads it any more.)
:::
:::vulkan
In OpenGL, the usual way to pass a value from the application on the CPU to the shaders is a *uniform*: a global
variable in the shader program that the application sets with `glUniform*` and that keeps its value until it is
changed. Vulkan has no such loose uniform variables. A shader gets values from the CPU in one of two ways:

- **Uniform buffers**: a buffer in GPU memory that the shader reads as a `uniform` block. The shader finds it
  through a *descriptor set*, which takes a descriptor set layout, a descriptor pool and an update call to set up.
  That is the general solution, and vulkan-tutorial builds it in its *Uniform buffers* chapter – we will need it
  later in this course for transformation matrices.
- **Push constants**: a small block of values (at least 128 bytes on every Vulkan implementation) that you write
  straight into the command buffer while recording it. No buffer, no descriptors. That is exactly what we need for
  a single colour, so we use push constants here.

Push constants take three steps. First, the shader declares a block with `layout(push_constant)`. Let's set the
colour of the triangle this way, in the fragment shader:

```glsl
#version 450

// Push constants: a few bytes the application sets from the CPU while recording the commands.
layout(push_constant) uniform PushConstants {
    vec4 color;
} pc;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = pc.color;
}
```

The block is accessed through its instance name: `pc.color`. Since the colour now comes from the CPU, the vertex
shader no longer needs its `vertexColor` output: the task removes it from both shaders again.

Second, the pipeline layout must announce the push constants. The pipeline layout describes everything a pipeline's
shaders get from outside besides the vertex data; until now it was empty. A `VkPushConstantRange` says which shader
stages read which bytes. On the C++ side we describe the block with a struct of the same layout, above the class:

```cpp
// The same layout as the push constant block in the shader.
struct PushConstants {
    glm::vec4 color;
};
```

and in `createGraphicsPipeline()`:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);

        VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
        pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
        pipelineLayoutInfo.setLayoutCount = 0;
        pipelineLayoutInfo.pushConstantRangeCount = 1;
        pipelineLayoutInfo.pPushConstantRanges = &pushConstantRange;
```

Third, the values are recorded into the command buffer with `vkCmdPushConstants`, after binding the pipeline and
before the draw call. Instead of passing a single color to the fragment shader, let's spice things up by gradually
changing color over time. In `recordCommandBuffer()`, right before `vkCmdDraw`:

```cpp
        static auto startTime = std::chrono::high_resolution_clock::now();

        auto currentTime = std::chrono::high_resolution_clock::now();
        float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
        float greenValue = std::sin(time) / 2.0f + 0.5f;

        PushConstants constants{};
        constants.color = glm::vec4(0.0f, greenValue, 0.0f, 1.0f);
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
```

First we compute the time in seconds since the first frame with `std::chrono` (the same way vulkan-tutorial
animates its uniform buffer). Then we vary the color in the range of `0.0` - `1.0` by using `std::sin` and store
the result in `greenValue`. Add `#include <chrono>` and `#include <cmath>` below the `glm` include.

`vkCmdPushConstants` takes the command buffer, the pipeline layout, the stages that will read the values, an offset
and a size in bytes, and a pointer to the data. The stage flags and the byte range must lie within a range declared
in the pipeline layout. The values are copied into the command buffer at the moment you record the call, so they
only change when you record again. That works here because `drawFrame()` records the command buffer anew every
frame – which is why the colour can change every frame.

Now do the task **uniform**. If you did things right you'll see the triangle gradually change from green to black
and back to green.
:::
:::d3d12
In OpenGL, the usual way to pass a value from the application on the CPU to the shaders is a *uniform*: a global
variable in the shader program that the application sets with `glUniform*` and that keeps its value until it is
changed. In Direct3D 12, everything a shader reads from outside besides the vertex data goes through the **root
signature**, the object that describes the shaders' parameters. Until now the project's root signature was empty.
A root signature can hold three kinds of *root parameters*:

- **Root constants**: 32-bit values stored directly in the root signature. They are the fastest way to give a
  shader a few values, and the shader sees them as a constant buffer.
- **Root descriptors** and **descriptor tables**: references to resources such as constant buffers in GPU memory
  (*constant buffer views*, CBVs) and textures. That is the general solution, and we will need it later in this
  course for transformation matrices and textures.

For a single colour, root constants are exactly right. They take three steps. First, the shader declares a
constant buffer, `cbuffer`, at a register. Let's set the colour of the triangle this way, at the top of
`shaders.hlsl`:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the shaders
// see them as a constant buffer at register b0.
cbuffer ColorConstants : register(b0)
{
    float4 color;
};
```

and the pixel shader returns that colour:

```hlsl
    // The colour set from the CPU.
    return color;
```

The members of a `cbuffer` are used like global variables: `color`. `b0` is the first constant-buffer register
(`b` for constant buffers; textures and samplers use `t` and `s` registers, as you will see later).

Second, the root signature gets a root parameter for register `b0`. On the C++ side we describe the values with a
struct of the same layout, next to `Vertex` in the class:

```cpp
    // The root constants: what the shaders see as cbuffer ColorConstants.
    struct ColorConstants
    {
        XMFLOAT4 color;
    };
```

and in `LoadAssets()` the empty root signature becomes one with a parameter:

```cpp
    // Create a root signature with one parameter: root constants for register b0.
    {
        // Root constants live in the root signature itself, as 32-bit values:
        // sizeof(ColorConstants) / 4 of them, visible to all shader stages.
        CD3DX12_ROOT_PARAMETER rootParameters[1];
        rootParameters[0].InitAsConstants(sizeof(ColorConstants) / 4, 0);

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

`InitAsConstants(num32BitValues, shaderRegister)` – here 4 values (a `float4` is 16 bytes) for register `b0`. The
optional further arguments are the register space (0) and the shader visibility (all stages by default).

Third, the values are set on the command list with `SetGraphicsRoot32BitConstants`, after
`SetGraphicsRootSignature`. Instead of passing a single color to the pixel shader, let's spice things up by
gradually changing color over time. In `PopulateCommandList()`, after `RSSetScissorRects`:

```cpp
    // The colour for the pixel shader: green goes up and down with the time.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
    float greenValue = std::sin(time) / 2.0f + 0.5f;

    ColorConstants colorConstants = {};
    colorConstants.color = XMFLOAT4(0.0f, greenValue, 0.0f, 1.0f);
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ColorConstants) / 4, &colorConstants, 0);
```

First we compute the time in seconds since the first frame with `std::chrono`. Then we vary the color in the range
of `0.0` - `1.0` by using `std::sin` and store the result in `greenValue`. Add `#include <chrono>` and
`#include <cmath>` to the includes.

`SetGraphicsRoot32BitConstants` takes the index of the root parameter (0), the number of 32-bit values, a pointer to
the data and the offset (in 32-bit values) of the first one. The values are recorded into the command list. Since
`PopulateCommandList()` resets the command list every frame – and a reset command list starts without a root
signature or root arguments – they are set every frame, which is also what lets the colour change.

Now do the task **uniform**. If you did things right you'll see the triangle gradually change from green to black
and back to green. (The vertex shader still writes `result.color`, but the pixel shader no longer reads it.)
:::

As you can see, a value set from the CPU is a useful tool for setting attributes that may change every frame, or
for interchanging data between your application and your shaders, but what if we want to set a color for each
vertex? In that case we'd have to declare as many of them as we have vertices. A better solution would be to
include more data in the vertex attributes which is what we're going to do now.

:::opengl
```quiz
Where in the render loop must `glUniform4f(vertexColorLocation, ...)` be called?
- [ ] Anywhere: `glGetUniformLocation` has already bound the uniform to the program
- [ ] Before `ourShader.use()`, because `glUseProgram` resets all uniforms
- [x] After `ourShader.use()`, because `glUniform*` sets the uniform of the currently active program
---
`glGetUniformLocation` only looks up the location; it doesn't need the program to be active. `glUniform*` writes into the active program, so `glUseProgram` (here `ourShader.use()`) must come first.
```
:::
:::vulkan
```quiz
The fragment shader reads a push constant block. What must the `VkPushConstantRange` in the pipeline layout contain?
- [ ] Nothing: push constants don't have to be declared in the pipeline layout
- [ ] A descriptor set with a uniform buffer for the block
- [x] `VK_SHADER_STAGE_FRAGMENT_BIT` in `stageFlags`, and an offset and size that cover the block
---
The pipeline layout declares which stages read which bytes of the push constants, and `vkCmdPushConstants` must use stage flags and a range that fit inside it. Descriptor sets are for uniform buffers, which push constants don't need.
```
:::
:::d3d12
```quiz
How does the pixel shader see the root constants that `SetGraphicsRoot32BitConstants(0, ...)` sets?
- [ ] As a constant buffer view that has to be created in a descriptor heap first
- [x] As a constant buffer (`cbuffer`) at the register given to `InitAsConstants`, here `b0`
- [ ] As a vertex attribute with semantic `COLOR`
---
Root constants live in the root signature itself. Root parameter 0 was created with `InitAsConstants(..., 0)`, so it maps to register `b0`, where the shader declares its `cbuffer`. Constant buffer views are the other, more general way, which we will use later.
```
:::

## More attributes!

In the previous chapter we saw how we can fill a buffer with vertex data and tell the pipeline how the data is
organised. This time, we also want to add color data to the vertex data. We're going to add color data as 3 floats
to the vertices array. We assign a red, green and blue color to each of the corners of our triangle respectively.

:::opengl
```cpp
    float vertices[] = {
        // positions         // colors
         0.5f, -0.5f, 0.0f,  1.0f, 0.0f, 0.0f,  // bottom right
        -0.5f, -0.5f, 0.0f,  0.0f, 1.0f, 0.0f,  // bottom left
         0.0f,  0.5f, 0.0f,  0.0f, 0.0f, 1.0f   // top
    };
```

Since we now have more data to send to the vertex shader, it is necessary to adjust the vertex shader to also
receive our color value as a vertex attribute input. Note that we set the location of the `aColor` attribute to 1
with the layout specifier:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;

void main()
{
    gl_Position = vec4(aPos, 1.0);
    ourColor = aColor;
}
```

Since we no longer use a uniform for the fragment's color, but now use the `ourColor` output variable we'll have
to change the fragment shader as well:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;

void main()
{
    FragColor = vec4(ourColor, 1.0f);
}
```

Because we added another vertex attribute and updated the VBO's memory we have to re-configure the vertex
attribute pointers. The updated data in the VBO's memory now looks a bit like this:

| Byte offset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Value | x | y | z | r | g | b | x | y | … |
| Belongs to | vertex 1 position | | | vertex 1 color | | | vertex 2 position | | |

Knowing the current layout we can update the vertex format with `glVertexAttribPointer`:

```cpp
    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
```

The first few arguments of `glVertexAttribPointer` are relatively straightforward. This time we are configuring
the vertex attribute on attribute location `1`. The color values have a size of 3 floats and we do not normalize
the values.

Since we now have two vertex attributes we have to re-calculate the *stride* value. To get the next attribute value
(e.g. the next `x` component of the position vector) in the data array we have to move 6 floats to the right,
three for the position values and three for the color values. This gives us a stride value of 6 times the size of
a float in bytes (= 24 bytes). Also, this time we have to specify an offset. For each vertex, the position vertex
attribute is first so we declare an offset of `0`. The color attribute starts after the position data so the
offset is `3 * sizeof(float)` in bytes (= 12 bytes).

The uniform from the previous section is no longer needed: remove its lines from the render loop and the
`#include <cmath>` again.
:::
:::vulkan
In Vulkan the vertex data is described by the `Vertex` struct, so we add a member for the color – exactly what
vulkan-tutorial's *Vertex input description* chapter does:

```cpp
struct Vertex {
    glm::vec3 pos;
    glm::vec3 color;
```

and give every vertex its color:

```cpp
const std::vector<Vertex> vertices = {
    {{0.0f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}}
};
```

The top corner is red, the bottom right corner green and the bottom left corner blue. Each vertex is now 6 floats
in memory:

| Byte offset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Value | x | y | z | r | g | b | x | y | … |
| Belongs to | vertex 1 `pos` | | | vertex 1 `color` | | | vertex 2 `pos` | | |

The binding description doesn't change: its `stride` is `sizeof(Vertex)`, which grows from 12 to 24 bytes by
itself. What we need is a second **attribute description** for the new attribute, so `getAttributeDescriptions()`
now returns an array of two:

```cpp
    static std::array<VkVertexInputAttributeDescription, 2> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 2> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, color);

        return attributeDescriptions;
    }
```

The colour comes from binding 0 (the same vertex buffer), goes to `location = 1` in the vertex shader, is three
32-bit floats (`VK_FORMAT_R32G32B32_SFLOAT`, the same format as a `vec3`), and starts `offsetof(Vertex, color)`
bytes – 12 – into each vertex. `createGraphicsPipeline()` already passes `attributeDescriptions.size()` to the
vertex input state, so nothing else in the pipeline changes.

Since we now have more data to send to the vertex shader, it is necessary to adjust the vertex shader to also
receive our color value as a vertex attribute input, at location 1, and pass it on to the fragment shader:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;

layout(location = 0) out vec3 fragColor;

void main() {
    gl_Position = vec4(inPosition, 1.0);
    fragColor = inColor;
}
```

The fragment shader no longer reads the push constant, but the colour from the vertex shader:

```glsl
#version 450

layout(location = 0) in vec3 fragColor;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(fragColor, 1.0);
}
```

The C++ code still pushes the colour every frame. That is harmless – nothing reads it any more – and we will reuse
the push constant in the exercises.
:::
:::d3d12
In Direct3D 12 the vertex data is described by the `Vertex` struct, so we add a member for the color:

```cpp
    struct Vertex
    {
        XMFLOAT3 position;
        XMFLOAT3 color;
    };
```

and give every vertex its color in `LoadAssets()`:

```cpp
        Vertex vertices[] =
        {
            // position               color
            { { 0.0f, 0.5f, 0.0f },   { 0.0f, 0.0f, 1.0f } },    // top: blue
            { { 0.5f, -0.5f, 0.0f },  { 1.0f, 0.0f, 0.0f } },    // bottom right: red
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 1.0f, 0.0f } }     // bottom left: green
        };
```

Each vertex is now 6 floats in memory:

| Byte offset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Value | x | y | z | r | g | b | x | y | … |
| Belongs to | vertex 1 `position` | | | vertex 1 `color` | | | vertex 2 `position` | | |

The vertex buffer view's `StrideInBytes` is `sizeof(Vertex)`, which grows from 12 to 24 bytes by itself. What we
need is a second **input element** in the input layout:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

The fields are: the semantic name (`"COLOR"`, which the vertex shader's parameter must use), the semantic index (0),
the format (three 32-bit floats), the input slot (vertex buffer 0), the *aligned byte offset* – the colour starts
12 bytes into each vertex, after the three floats of the position – and finally that this is per-vertex data (the
last 0 only matters for instanced data).

Since we now have more data to send to the vertex shader, it is necessary to adjust the vertex shader to also
receive our color value, and pass it on to the pixel shader. The `cbuffer ColorConstants` and the pixel shader's
`return color;` go again, and `shaders.hlsl` becomes:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float4 color : COLOR)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = color;    // the vertex's colour from the vertex buffer

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The colour from the vertex shader, interpolated across the triangle.
    return input.color;
}
```

The colour parameter is a `float4` although the buffer holds three floats: just like with the position, the
missing fourth component (alpha) is filled in with 1. The C++ code still sets the root constants every frame. That
is harmless – no shader reads them any more – and we will reuse the root parameter in the exercises.
:::

```quiz
Each vertex now holds 3 position floats followed by 3 colour floats (a float is 4 bytes). At which byte offset does a vertex's colour start, and how many bytes is it from one vertex to the next?
- [ ] Offset 24, 12 bytes to the next vertex
- [ ] Offset 0, 12 bytes to the next vertex
- [x] Offset 12, 24 bytes to the next vertex
- [ ] Offset 12, 12 bytes to the next vertex
---
The colour comes after the three position floats: 3 × 4 = 12 bytes. One whole vertex is 6 floats, so the stride is 6 × 4 = 24 bytes – for both attributes, since they live in the same buffer.
```

Now do the task **vertex-colors**: add the colours to the vertex data, describe the second attribute and update
both shaders. Running the application should give you a triangle with a red, a green and a
blue corner, and colours that blend smoothly in between.

The image may not be exactly what you would expect, since we only supplied 3 colors, not the huge color palette
we're seeing right now. This is all the result of something called *fragment interpolation* in the fragment
shader. When rendering a triangle the rasterization stage usually results in a lot more fragments than vertices
originally specified. The rasterizer then determines the positions of each of those fragments based on where they
reside on the triangle shape. Based on these positions, it *interpolates* all the fragment shader's input
variables. Say for example we have a line where the upper point has a green color and the lower point a blue
color. If the fragment shader is run at a fragment that resides around a position at 70% of the line, its
resulting color input attribute would then be a linear combination of green and blue; to be more precise: 30% blue
and 70% green.

This is exactly what happened at the triangle. We have 3 vertices and thus 3 colors, and judging from the
triangle's pixels it contains around 60000 fragments, where the fragment shader interpolated the colors
among those pixels. If you take a good look at the colors you'll see it all makes sense: red to blue first gets to
purple and then to blue. Fragment interpolation is applied to all the fragment shader's input attributes.

```quiz
A fragment lies exactly halfway along the edge between the red corner (1, 0, 0) and the green corner (0, 1, 0). Which colour does the fragment shader receive?
- [ ] Red or green, whichever corner the rasterizer processed first
- [ ] (1.0, 1.0, 0.0): both colours added together
- [x] (0.5, 0.5, 0.0): half red and half green
- [ ] The colour of the third corner, blue
---
The outputs of the vertex shader are interpolated linearly across the triangle. Halfway along an edge, each of the two corners contributes 50%, and the third corner (not on that edge) contributes nothing.
```

## Our own shader class

:::opengl
Writing, compiling and managing shaders can be quite cumbersome. As a final touch on the shader subject we're
going to make our life a bit easier by building a shader class that reads shaders from disk, compiles and links
them, checks for errors and is easy to use. This also gives you a bit of an idea how we can encapsulate some of the
knowledge we learned so far into useful abstract objects. This is the class in `shader_s.h` that the project has
used from the start.

We will create the shader class entirely in a header file, mainly for learning purposes and portability. Let's
start by adding the required includes and by defining the class structure:

```cpp
#ifndef SHADER_H
#define SHADER_H

#include <glad/glad.h>

#include <string>
#include <fstream>
#include <sstream>
#include <iostream>

class Shader
{
public:
    unsigned int ID;
    // constructor generates the shader on the fly
    Shader(const char* vertexPath, const char* fragmentPath);
    // activate the shader
    void use();
    // utility uniform functions
    void setBool(const std::string &name, bool value) const;
    void setInt(const std::string &name, int value) const;
    void setFloat(const std::string &name, float value) const;
};

#endif
```

> We used several preprocessor directives at the top of the header file. Using these little lines of code informs
> your compiler to only include and compile this header file if it hasn't been included yet, even if multiple files
> include the shader header. This prevents linking conflicts.

The shader class holds the ID of the shader program. Its constructor requires the file paths of the source code of
the vertex and fragment shader respectively that we can store on disk as simple text files. To add a little extra
we also add several utility functions to ease our lives a little: `use` activates the shader program, and all
`set…` functions query a uniform location and set its value. (In `shader_s.h` the functions are written directly
inside the class body; the declarations above show its shape.)
:::
:::vulkan
In OpenGL, learnopengl.com now writes a small `Shader` class that reads the GLSL source files at run time and has
the driver compile and link them. Vulkan has no such step at run time: there is no compiler for GLSL in the Vulkan
driver and no "shader program" object to link. Instead, the work is split differently:

1. **Before the program runs**, the GLSL files are compiled to SPIR-V by `glslc`, the compiler from Google's shaderc
   project that ships with the Vulkan SDK. When you build and run, the build does exactly what vulkan-tutorial's
   `compile` script does:

   ```text
   glslc shaders/shader.vert -o shaders/vert.spv
   glslc shaders/shader.frag -o shaders/frag.spv
   ```

   A mistake in a shader is therefore reported by the build, before the program starts – not at run time like in
   OpenGL.
2. **At run time**, the program reads the two `.spv` files as raw bytes and wraps each in a `VkShaderModule`.
3. The shader modules are put into the graphics pipeline as *shader stages*, with the name of the entry point
   (`"main"`). The pipeline is what plays the role of OpenGL's linked shader program: it ties the stages together,
   along with all the fixed-function state.

So the closest thing to a "shader class" in our Vulkan program is the pair of helpers `readFile` and
`createShaderModule`, and the start of `createGraphicsPipeline()`:

```cpp
    void createGraphicsPipeline() {
        auto vertShaderCode = readFile("shaders/vert.spv");
        auto fragShaderCode = readFile("shaders/frag.spv");

        VkShaderModule vertShaderModule = createShaderModule(vertShaderCode);
        VkShaderModule fragShaderModule = createShaderModule(fragShaderCode);

        VkPipelineShaderStageCreateInfo vertShaderStageInfo{};
        vertShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
        vertShaderStageInfo.stage = VK_SHADER_STAGE_VERTEX_BIT;
        vertShaderStageInfo.module = vertShaderModule;
        vertShaderStageInfo.pName = "main";
```

The shader modules are only needed while the pipeline is created – the SPIR-V is translated to the GPU's own
machine code at that point – so `createGraphicsPipeline()` destroys them again at its end.
:::
:::d3d12
In OpenGL, learnopengl.com now writes a small `Shader` class that reads the GLSL source files at run time and has
the driver compile and link them. The Direct3D 12 sample program needs no class for this: both shaders live in one
file, `shaders.hlsl`, and the HLSL compiler is a library the program calls itself – `D3DCompileFromFile` from
`d3dcompiler.lib`. In `LoadAssets()`:

```cpp
        ComPtr<ID3DBlob> vertexShader;
        ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
        // Enable better shader debugging with the graphics debugging tools.
        UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
        UINT compileFlags = 0;
#endif

        // Compile the vertex shader (VSMain) and the pixel shader (PSMain) in shaders.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

The same file is compiled twice, each time for a different **entry point** (`"VSMain"`, `"PSMain"`) and **target**
(`"vs_5_0"`: a vertex shader for shader model 5.0; `"ps_5_0"`: a pixel shader). The result is bytecode in an
`ID3DBlob`. The bytecode is then handed to the pipeline state object, `psoDesc.VS` and `psoDesc.PS`, which plays
the role of OpenGL's linked shader program: it ties the stages, the input layout, the root signature and all the
fixed-function state together.

Compiling at run time is convenient while learning, because you can edit `shaders.hlsl` without rebuilding the
C++ program. Real applications usually compile their shaders ahead of time instead – with the offline compilers
`fxc` (shader model 5) or `dxc` (shader model 6 and later) – and load the bytecode from a file, much like Vulkan
loads SPIR-V.
:::

## Reading from file

:::opengl
We're using C++ filestreams to read the content from the file into several `string` objects:

```cpp
    Shader(const char* vertexPath, const char* fragmentPath)
    {
        // 1. retrieve the vertex/fragment source code from filePath
        std::string vertexCode;
        std::string fragmentCode;
        std::ifstream vShaderFile;
        std::ifstream fShaderFile;
        // ensure ifstream objects can throw exceptions:
        vShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
        fShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
        try
        {
            // open files
            vShaderFile.open(vertexPath);
            fShaderFile.open(fragmentPath);
            std::stringstream vShaderStream, fShaderStream;
            // read file's buffer contents into streams
            vShaderStream << vShaderFile.rdbuf();
            fShaderStream << fShaderFile.rdbuf();
            // close file handlers
            vShaderFile.close();
            fShaderFile.close();
            // convert stream into string
            vertexCode   = vShaderStream.str();
            fragmentCode = fShaderStream.str();
        }
        catch (std::ifstream::failure& e)
        {
            std::cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " << e.what() << std::endl;
        }
        const char* vShaderCode = vertexCode.c_str();
        const char * fShaderCode = fragmentCode.c_str();
```

Next we need to compile and link the shaders. Note that we're also reviewing if compilation/linking failed and if
so, print the compile-time errors. This is extremely useful when debugging (you are going to need those error logs
eventually):

```cpp
        // 2. compile shaders
        unsigned int vertex, fragment;
        // vertex shader
        vertex = glCreateShader(GL_VERTEX_SHADER);
        glShaderSource(vertex, 1, &vShaderCode, NULL);
        glCompileShader(vertex);
        checkCompileErrors(vertex, "VERTEX");
        // fragment Shader
        fragment = glCreateShader(GL_FRAGMENT_SHADER);
        glShaderSource(fragment, 1, &fShaderCode, NULL);
        glCompileShader(fragment);
        checkCompileErrors(fragment, "FRAGMENT");
        // shader Program
        ID = glCreateProgram();
        glAttachShader(ID, vertex);
        glAttachShader(ID, fragment);
        glLinkProgram(ID);
        checkCompileErrors(ID, "PROGRAM");
        // delete the shaders as they're linked into our program now and no longer necessary
        glDeleteShader(vertex);
        glDeleteShader(fragment);
    }
```

`checkCompileErrors` is a small private helper in the class: for a shader it checks `GL_COMPILE_STATUS` with
`glGetShaderiv` and prints `glGetShaderInfoLog`; for the program it checks `GL_LINK_STATUS` with `glGetProgramiv`
and prints `glGetProgramInfoLog` – the same checks you wrote in *Hello Triangle*.

The `use` function is straightforward:

```cpp
    void use()
    {
        glUseProgram(ID);
    }
```

Similarly for any of the uniform setter functions:

```cpp
    void setBool(const std::string &name, bool value) const
    {
        glUniform1i(glGetUniformLocation(ID, name.c_str()), (int)value);
    }
    // ------------------------------------------------------------------------
    void setInt(const std::string &name, int value) const
    {
        glUniform1i(glGetUniformLocation(ID, name.c_str()), value);
    }
    // ------------------------------------------------------------------------
    void setFloat(const std::string &name, float value) const
    {
        glUniform1f(glGetUniformLocation(ID, name.c_str()), value);
    }
```

And there we have it, a completed shader class. Using the shader class is fairly easy; we create a shader object
once and from that point on simply start using it:

```cpp
    Shader ourShader("shader.vs", "shader.fs"); // you can name your shader files however you like
```

and in the render loop:

```cpp
        ourShader.use();
        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 3);
```

Here we stored the vertex and fragment shader source code in two files called `shader.vs` and `shader.fs`. You're
free to name your shader files however you like; I personally find the extensions `.vs` and `.fs` quite
intuitive.
:::
:::vulkan
`readFile` is vulkan-tutorial's helper that loads all bytes of a file into a `std::vector<char>`:

```cpp
    static std::vector<char> readFile(const std::string& filename) {
        std::ifstream file(filename, std::ios::ate | std::ios::binary);

        if (!file.is_open()) {
            throw std::runtime_error("failed to open file!");
        }

        size_t fileSize = (size_t) file.tellg();
        std::vector<char> buffer(fileSize);

        file.seekg(0);
        file.read(buffer.data(), fileSize);

        file.close();

        return buffer;
    }
```

Two flags matter here. `std::ios::binary` reads the file as raw bytes – SPIR-V is a binary format, and text mode
could change bytes that look like line endings. `std::ios::ate` starts reading at the end of the file, so
`tellg()` immediately tells us the file size and we can allocate the buffer; then we seek back to the beginning and
read everything at once.

`createShaderModule` wraps the bytes in a shader module:

```cpp
    VkShaderModule createShaderModule(const std::vector<char>& code) {
        VkShaderModuleCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
        createInfo.codeSize = code.size();
        createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

        VkShaderModule shaderModule;
        if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
            throw std::runtime_error("failed to create shader module!");
        }

        return shaderModule;
    }
```

`codeSize` is in bytes, but `pCode` is a pointer to `uint32_t`, because SPIR-V consists of 32-bit words. The
`reinterpret_cast` is safe here because the default allocator of `std::vector` returns memory that is suitably
aligned for that.

Notice what is *not* here compared with OpenGL: no compile step and no info log. The GLSL was already checked and
compiled by `glslc` during the build. When you make a mistake in a shader in the exercises below, the error appears in
your IDE's build output with the file name and line, and the program doesn't run at all.
:::
:::d3d12
`D3DCompileFromFile` reads the file for us, so there is no file-reading code of our own. Its parameters, in order:

| Parameter | Value here | Meaning |
|---|---|---|
| `pFileName` | `L"shaders.hlsl"` | the source file (a wide string) |
| `pDefines` | `nullptr` | optional preprocessor macros |
| `pInclude` | `nullptr` | how to handle `#include` in the shader (none here) |
| `pEntrypoint` | `"VSMain"` / `"PSMain"` | the function to compile |
| `pTarget` | `"vs_5_0"` / `"ps_5_0"` | the shader stage and shader model |
| `Flags1` | `compileFlags` | in debug builds: debug information and no optimisation |
| `Flags2` | `0` | only used for effect files |
| `ppCode` | `&vertexShader` / `&pixelShader` | receives the bytecode |
| `ppErrorMsgs` | `nullptr` | could receive the compiler's error messages |

If the compilation fails, the function returns a failure `HRESULT` and `ThrowIfFailed` stops the program with an
exception. Because we pass `nullptr` for the last parameter, we don't get to see *why* it failed. When you write
larger shaders it pays to pass an `ID3DBlob` there and print its text (`GetBufferPointer()`) on failure – the
equivalent of OpenGL's `glGetShaderInfoLog`.

The bytecode is used when the pipeline state object is described:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
```

`CD3DX12_SHADER_BYTECODE` (from the helper header `d3dx12.h`) fills in a pointer to the blob's bytes and their
size. Once `CreateGraphicsPipelineState` has returned, the pipeline has its own copy, and the blobs are released
when the `ComPtr`s go out of scope.
:::

:::opengl
```quiz
When are this project's shaders compiled?
- [ ] Before the program runs, by the build
- [x] While the program runs: the `Shader` constructor reads the files and has the driver compile and link them
- [ ] Never: the GPU runs the GLSL source text directly
---
OpenGL compiles GLSL at run time, in the driver: `glCompileShader` and `glLinkProgram` inside the `Shader` constructor.
```
:::
:::vulkan
```quiz
When are this project's shaders compiled?
- [ ] Never: the GPU runs the GLSL source text directly
- [ ] While the program runs: the driver compiles the GLSL source text
- [x] Before the program runs: `glslc` compiles them to SPIR-V, which the program loads at run time
---
Vulkan only accepts SPIR-V, so the GLSL is compiled beforehand. At run time the driver translates the SPIR-V into the GPU's own code when the pipeline is created.
```
:::
:::d3d12
```quiz
When are this project's shaders compiled?
- [ ] Never: the GPU runs the HLSL source text directly
- [ ] Before the program runs, by the C++ build
- [x] While the program runs: `D3DCompileFromFile` compiles `shaders.hlsl` into bytecode for the pipeline state object
---
The sample compiles HLSL at run time with the D3DCompiler library; real applications often compile ahead of time with `fxc` or `dxc`.
```
:::

## Exercises

1. Adjust the vertex shader so that the triangle is upside down.
2. Specify a horizontal offset via a value set from the CPU and move the triangle to the right side of the screen
   in the vertex shader using this offset value.
3. Output the vertex position to the fragment shader and set the fragment's color equal to this vertex position
   (see how even the vertex position values are interpolated across the triangle). Once you managed to do this, try
   to answer the following question: why is one corner of the triangle black?

The last three tasks are these exercises. Each builds on the one before, so the triangle you end with is upside
down, moved to the right and coloured by its position.

### Upside down

:::opengl
To turn the triangle upside down, negate the y coordinate of the position in the vertex shader:

```glsl
    gl_Position = vec4(aPos.x, -aPos.y, aPos.z, 1.0); // just add a - to the y position
```

That is all OpenGL needs. Flipping y also mirrors the triangle: its corners, which went clockwise on screen, now go
counter-clockwise. That would matter if *face culling* were enabled, because OpenGL would then decide which side of
the triangle we are looking at from that order. But face culling is **disabled** by default in OpenGL (we will turn
it on in the *Face culling* chapter), so both sides are drawn and the flipped triangle simply appears.

Now do the task **upside-down**.
:::
:::vulkan
To turn the triangle upside down, negate the y coordinate of the position in the vertex shader:

```glsl
    gl_Position = vec4(inPosition.x, -inPosition.y, inPosition.z, 1.0);
```

Try only this change first and build: the triangle is gone! The reason is in the rasterizer state of the pipeline.
Our pipeline has back-face culling enabled (`rasterizer.cullMode = VK_CULL_MODE_BACK_BIT`), and it decides which
side of a triangle faces us by the order of its corners on screen: with
`rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE`, a triangle whose corners appear clockwise is a front face. Our
vertices – top, bottom right, bottom left – appear clockwise. Mirroring the triangle in y mirrors that order too:
the corners now appear counter-clockwise, the triangle turns its back to us, and the rasterizer culls it.

Since we flipped the triangle on purpose, we tell the pipeline that counter-clockwise triangles are now the front
faces, in `createGraphicsPipeline()`:

```cpp
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE; // the flip in the vertex shader mirrors the winding order
```

(Turning culling off with `VK_CULL_MODE_NONE` would work too; vulkan-tutorial makes this same `frontFace` change
later, when its projection matrix flips y.) Now do the task **upside-down**.
:::
:::d3d12
To turn the triangle upside down, negate the y coordinate of the position in the vertex shader:

```hlsl
    result.position = float4(position.x, -position.y, position.z, 1.0f);    // y flipped: upside down
```

Try only this change first and build: the triangle is gone! The reason is in the rasterizer state of the pipeline
state object. `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` culls back faces (`CullMode = D3D12_CULL_MODE_BACK`), and
with `FrontCounterClockwise = FALSE` a triangle whose corners appear clockwise on screen is a front face. Our
vertices – top, bottom right, bottom left – appear clockwise. Mirroring the triangle in y mirrors that order too:
the corners now appear counter-clockwise, the triangle becomes a back face, and the rasterizer culls it.

So we draw both sides: after the default rasterizer state is set in `LoadAssets()`, turn culling off:

```cpp
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        // Flipping y turns clockwise triangles counter-clockwise: back faces, which the
        // default state culls. Draw both sides.
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
```

(Setting `FrontCounterClockwise = TRUE` instead would work as well.) Now do the task **upside-down**.
:::

:::opengl
```quiz
After you negate y in the vertex shader, the corners of the triangle appear in the opposite order on screen. Why is the triangle still drawn in OpenGL?
- [x] Face culling is disabled by default, so OpenGL draws both sides of a triangle
- [ ] OpenGL flips the order of the vertices back automatically
- [ ] The winding order only matters for the fragment shader
---
The winding order decides which side of a triangle is the front. That only matters once `glEnable(GL_CULL_FACE)` turns face culling on, which this project doesn't do.
```
:::
:::vulkan
```quiz
Why does the upside-down task also change `rasterizer.frontFace` to `VK_FRONT_FACE_COUNTER_CLOCKWISE`?
- [ ] Because Vulkan's y axis points down, every shader that changes y needs it
- [x] Flipping y reverses the order of the corners on screen, so with back-face culling the triangle would otherwise be culled
- [ ] To make the colours interpolate in the right direction
---
The pipeline culls back faces and decides the front from the winding order on screen. The flip turns our clockwise triangle counter-clockwise, so we declare counter-clockwise triangles the front faces.
```
:::
:::d3d12
```quiz
Why does the upside-down task also set `CullMode` to `D3D12_CULL_MODE_NONE`?
- [x] Flipping y reverses the order of the corners on screen, so the triangle becomes a back face, which the default rasterizer state culls
- [ ] To make the colours interpolate in the right direction
- [ ] Because the pixel shader can't write to a mirrored triangle
---
The default rasterizer state treats clockwise triangles as front faces and culls back faces. After the flip our triangle is counter-clockwise on screen, so we draw both sides.
```
:::

### Horizontal offset

:::opengl
For the offset we use a uniform `float` in the vertex shader and add it to the x coordinate:

```glsl
uniform float xOffset;

void main()
{
    gl_Position = vec4(aPos.x + xOffset, -aPos.y, aPos.z, 1.0); // still upside down, and moved to the right by xOffset
```

In the render loop we set it with the shader class's `setFloat`, right after `ourShader.use();`:

```cpp
        ourShader.use();
        float offset = 0.5f;
        ourShader.setFloat("xOffset", offset);
```

Now do the task **offset**. Normalized device coordinates run from -1 to 1 across the window, so an offset of 0.5
is a quarter of the window's width: 200 pixels in our 800 pixel wide window.
:::
:::vulkan
For the offset we use the push constant again, now in the vertex shader. The block in `shader.vert` gets a single
`float`:

```glsl
layout(push_constant) uniform PushConstants {
    float xOffset;
} pc;
```

and the position becomes:

```glsl
    gl_Position = vec4(inPosition.x + pc.xOffset, -inPosition.y, inPosition.z, 1.0);
```

On the C++ side, the struct changes to match the block:

```cpp
struct PushConstants {
    float xOffset;
};
```

Since the push constants are now read by the vertex shader, the range in the pipeline layout must name that stage:

```cpp
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;
```

and in `recordCommandBuffer()`, the time code and the colour are replaced by the offset, pushed for the vertex
stage:

```cpp
        PushConstants constants{};
        constants.xOffset = 0.5f;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

The `<chrono>` and `<cmath>` includes are no longer needed. Now do the task **offset**. Normalized device
coordinates run from -1 to 1 across the window, so an offset of 0.5 is a quarter of the window's width: 200 pixels
in our 800 pixel wide window.
:::
:::d3d12
For the offset we reuse root parameter 0, now with a single 32-bit value. In `shaders.hlsl`, the constant buffer
gets a new name and member:

```hlsl
cbuffer OffsetConstants : register(b0)
{
    float xOffset;
};
```

and the position becomes:

```hlsl
    result.position = float4(position.x + xOffset, -position.y, position.z, 1.0f);    // upside down, moved right
```

On the C++ side, `ColorConstants` becomes:

```cpp
    // The root constants: what the shaders see as cbuffer OffsetConstants.
    struct OffsetConstants
    {
        float xOffset;
    };
```

so `InitAsConstants(sizeof(OffsetConstants) / 4, 0)` now declares one 32-bit value, and in `PopulateCommandList()`
the time code and the colour are replaced by:

```cpp
    // The offset for the vertex shader: moves the triangle to the right.
    OffsetConstants offsetConstants = {};
    offsetConstants.xOffset = 0.5f;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(OffsetConstants) / 4, &offsetConstants, 0);
```

The root parameter needs no change of visibility: `InitAsConstants` makes it visible to all shader stages by
default. The `<chrono>` and `<cmath>` includes are no longer needed. Now do the task **offset**. Clip-space
coordinates run from -1 to 1 across the window, so an offset of 0.5 is a quarter of the window's width: 200 pixels
in our 800 pixel wide window.
:::

### Position as colour

:::opengl
For the last exercise the vertex shader outputs the position instead of the colour. Comment out the `ourColor`
lines and add an output `ourPosition`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

// out vec3 ourColor;
out vec3 ourPosition;

uniform float xOffset;

void main()
{
    gl_Position = vec4(aPos.x + xOffset, -aPos.y, aPos.z, 1.0); // still upside down, and moved to the right by xOffset
    // ourColor = aColor;
    ourPosition = aPos;
}
```

```glsl
#version 330 core
out vec4 FragColor;

// in vec3 ourColor;
in vec3 ourPosition;

void main()
{
    FragColor = vec4(ourPosition, 1.0); // note how the position value is linearly interpolated to get all the different colors
}
```

Remember that the output and the input must have the same name to be linked. Now do the task **position-color**.
:::
:::vulkan
For the last exercise the vertex shader outputs the position instead of the colour. Only one line changes, because
`fragColor` is a `vec3` just like `inPosition`:

```glsl
    fragColor = inPosition; // the position as the color (negative values become 0)
```

Now do the task **position-color**.
:::
:::d3d12
For the last exercise the vertex shader outputs the position instead of the colour. Only one line changes:

```hlsl
    result.color = position;    // the position as the colour: x -> red, y -> green, z -> blue
```

`position` is the `float4` input `(x, y, z, 1)`, so x becomes red, y green, z (always 0 here) blue, and the alpha is
1\. Now do the task **position-color**.
:::

Notice that the colour comes from the *input* position, before the flip and the offset. The x, y and z coordinates
of the vertex become the red, green and blue of its colour, and like every output of the vertex shader they are
interpolated across the triangle.

So why is one corner black? Our vertex positions run from -0.5 to 0.5, so some of the colour components are
**negative**. A colour component can't be darker than 0: when the fragment's colour is written to the window's
colour buffer, which stores each component as an unsigned normalized value between 0.0 and 1.0, everything below
0.0 is clamped to 0.0 (and everything above 1.0 to 1.0).

:::opengl
The vertex at `(-0.5, -0.5, 0.0)` – the bottom left corner of the original triangle, now the top left one because
it is upside down – has a negative x and a negative y: its colour becomes (0, 0, 0), black. The other two corners
get (0.5, 0.0, 0.0), dark red (x = 0.5, y = -0.5 clamped to 0), and (0.0, 0.5, 0.0), dark green. And since the
interpolated values stay negative for a good distance from that corner, a large area around it is black as well.
:::
:::vulkan
In Vulkan the top vertex of the original triangle is `(0.0, -0.5, 0.0)` (y points down): x is 0 and y is negative,
so its colour becomes (0, 0, 0), black – that corner is now at the bottom, because the triangle is upside down. The
other two corners get (-0.5, 0.5, 0.0) → (0.0, 0.5, 0.0), green, and (0.5, 0.5, 0.0), olive. And since the
interpolated values stay negative for a good distance from that corner, a large area around it is black as well.
:::
:::d3d12
The vertex at `(-0.5, -0.5, 0.0)` – the bottom left corner of the original triangle, now the top left one because
it is upside down – has a negative x and a negative y: its colour becomes (0, 0, 0), black. The other two corners
get (0.5, 0.0, 0.0), dark red (x = 0.5, y = -0.5 clamped to 0), and (0.0, 0.5, 0.0), dark green. And since the
interpolated values stay negative for a good distance from that corner, a large area around it is black as well.
:::

```quiz
Why is one corner of the triangle black when the position is output as the colour?
- [ ] The rasterizer does not interpolate positions, only colours
- [x] Its x and y are not positive, and colour components below 0 are clamped to 0 when they are written to the colour buffer
- [ ] The offset pushes that corner outside the window
- [ ] The vertex shader no longer writes a colour for that vertex
---
Positions from -0.5 to 0.5 become colours from -0.5 to 0.5. The colour buffer stores values between 0 and 1, so a vertex with only zero or negative components ends up black – and so does the area where the interpolated values are still negative.
```

You have now seen the whole path of data through the shaders: from the vertex buffer into the vertex shader, from
the vertex shader into the fragment shader with interpolation in between, and from the application into the
shaders with
:::opengl
uniforms. In the next chapter, *Textures*, we'll bring images into the shaders.
:::
:::vulkan
push constants. In the next chapter, *Textures*, we'll bring images into the shaders.
:::
:::d3d12
root constants. In the next chapter, *Textures*, we'll bring images into the shaders.
:::
