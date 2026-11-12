# Colors

We briefly used and manipulated colors in the previous chapters, but never defined them properly. Here we'll discuss
what colors are and start building the scene for the upcoming *Lighting* chapters.

In the real world, colors can take any known color value with each object having its own color(s). In the digital
world we need to map the (infinite) real colors to (limited) digital values and therefore not all real-world colors
can be represented digitally. Colors are digitally represented using a *red*, *green* and *blue* component, commonly
abbreviated as *RGB*. Using different combinations of just those 3 values, within a range of [0, 1], we can represent
almost any color there is. For example, to get a *coral* color, we define a color vector as:

:::opengl vulkan
```cpp
glm::vec3 coral(1.0f, 0.5f, 0.31f);
```
:::
:::d3d12
```cpp
XMFLOAT3 coral(1.0f, 0.5f, 0.31f);
```
:::

The color of an object we see in real life is not the color it actually has, but is the color *reflected* from the
object. The colors that aren't absorbed (rejected) by the object is the color we perceive of it. As an example, the
light of the sun is perceived as a white light that is the combined sum of many different colors. If we would shine
this white light on a blue toy, it would absorb all the white color's sub-colors except the blue color. Since the toy
does not absorb the blue color part, it is reflected. This reflected light enters our eye, making it look like the toy
has a blue color. A coral-coloured toy works the same way: it reflects all of the red, about half of the green and a
third of the blue that falls on it, and absorbs the rest.

You can see that the white sunlight is a collection of all the visible colors and the object absorbs a large portion
of those colors. It only reflects those colors that represent the object's color and the combination of those is what
we perceive.

These rules of color reflection apply directly in graphics-land. When we define a light source in {{api}} we want to
give this light source a color. In the previous paragraph we had a white color so we'll give the light source a white
color as well. If we would then multiply the light source's color with an object's color value, the resulting color
would be the reflected color of the object (and thus its perceived color). Let's revisit our toy (this time with a
coral value) and see how we would calculate its perceived color in graphics-land. We get the resulting color vector by
doing a component-wise multiplication between the light and object color vectors:

:::opengl vulkan
```cpp
glm::vec3 lightColor(1.0f, 1.0f, 1.0f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (1.0f, 0.5f, 0.31f);
```

GLM's `*` between two vectors multiplies them component by component, exactly like `*` between two `vec3`s in GLSL.
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(1.0f, 1.0f, 1.0f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (1.0f, 0.5f, 0.31f);
```

DirectXMath's `*` between two `XMVECTOR`s is `XMVectorMultiply`: a component-by-component product. HLSL does the
same with `*` between two `float3`s – a *matrix* (or dot) product is always written with `mul` (or `dot`).
:::

We can see that the toy's color *absorbs* a large portion of the white light, but reflects several red, green and blue
values based on its own color value. This is a representation of how colors would work in real life. We can thus
define an object's color as *the amount of each color component it reflects from a light source*. Now what would
happen if we used a green light?

:::opengl vulkan
```cpp
glm::vec3 lightColor(0.0f, 1.0f, 0.0f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (0.0f, 0.5f, 0.0f);
```
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (0.0f, 0.5f, 0.0f);
```
:::

As we can see, the toy has no red and blue light to absorb and/or reflect. The toy also absorbs half of the light's
green value, but also reflects half of the light's green value. The toy's color we perceive would then be a dark-greenish
color. We can see that if we use a green light, only the green color components can be reflected and thus perceived;
no red and blue colors are perceived. As a result the coral object suddenly becomes a dark-greenish object. Let's try
one more example with a dark olive-green light:

:::opengl vulkan
```cpp
glm::vec3 lightColor(0.33f, 0.42f, 0.18f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (0.33f, 0.21f, 0.06f);
```
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(0.33f, 0.42f, 0.18f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (0.33f, 0.21f, 0.06f);
```
:::

As you can see, we can get interesting colors from objects using different light colors. It's not hard to get
creative with colors.

```quiz
A coral object (1.0, 0.5, 0.31) is lit by a pure blue light (0.0, 0.0, 1.0). Which colour do we see?
- [ ] (1.0, 0.5, 1.0) – the light's blue is added to the object's colour
- [x] (0.0, 0.0, 0.31) – a very dark blue: the object only reflects 31 % of the blue it receives, and there is no red or green to reflect
- [ ] (0.0, 0.0, 1.0) – the object takes on the colour of the light
---
The reflected colour is the component-wise product of the light's colour and the object's colour: (0 · 1.0, 0 · 0.5, 1.0 · 0.31). A colour the light doesn't contain can't be reflected, however strongly the object would reflect it.
```

But enough about colors, let's start building a scene where we can experiment in.

## A lighting scene

In the upcoming chapters we'll be creating interesting visuals by simulating real-world lighting making extensive use
of colors. Since now we'll be using light sources we want to display them as visual objects in the scene and add at
least one object to simulate the lighting from.

The first thing we need is an object to cast the light on and we'll use the infamous container cube from the previous
chapters. We'll also be needing a light object to show where the light source is located in the 3D scene. For
simplicity's sake we'll represent the light source with a cube as well.

### The project

The project of this chapter is already prepared for that. It is the result of *Camera*, reduced to what the lighting
chapters start with: **one cube at the origin**, built from the same 36 vertices as before but with **positions only**
– no texture coordinates and no textures any more, since we want to see the cube's colour, not a picture. The clear
colour is a dark grey, (0.1, 0.1, 0.1), as in all of learnopengl's lighting chapters, so that the lamp stands out.
The free camera of the previous chapter, with its W/A/S/D, mouse look and zoom, is still there.

:::opengl
The files are `main.cpp`, `shader_m.h`, `colors.vs` and `colors.fs` (the shaders of the lit cube) and `light_cube.vs`
and `light_cube.fs` (the shaders of the lamp – more about those below). learnopengl numbers its shader files per
chapter (`1.colors.vs`); the course drops the numbers.

The vertex array now has 3 floats per vertex, so the position attribute has a stride of `3 * sizeof(float)`:

```cpp
    // first, configure the cube's VAO (and VBO)
    unsigned int VBO, cubeVAO;
    glGenVertexArrays(1, &cubeVAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(cubeVAO);

    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

The vertex shader of the cube is the one of the previous chapters without the texture coordinates:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

The program is built with `Shader lightingShader("colors.vs", "colors.fs");`, and the render loop sets `projection`,
`view` and an identity `model` matrix on it before it draws the 36 vertices with `cubeVAO`.
:::
:::vulkan
The shaders are `shaders/colors.vert` and `shaders/colors.frag` (the lit cube) and `shaders/light_cube.vert` and
`shaders/light_cube.frag` (the lamp – more about those below).

:::ide clion vscode
Your `CMakeLists.txt` compiles each of them to SPIR-V, `shaders/<name>.vert.spv` and `shaders/<name>.frag.spv`. It
compiles every shader it finds in `shaders/`, so new shader files need no change to it.
:::
:::ide vs rider
The pre-build event of your project compiles each of them to SPIR-V, `shaders\<name>.vert.spv` and
`shaders\<name>.frag.spv`. It compiles every shader it finds in `shaders\`, so new shader files need no change to it.
:::

As before, the view and projection matrices live in the uniform
buffer (still at **binding 2** – bindings 0 and 1 held the textures and come back with the lighting maps), filled every
frame by `updateUniformBuffer()`, and the model matrix is a push constant. The `Vertex` struct holds just a
`glm::vec3 pos`, and `getAttributeDescriptions()` describes that one attribute.

Since this chapter needs **two** graphics pipelines – one for the cube, one for the lamp – the old
`createGraphicsPipeline()` has been split in two:

- `createPipelineLayout()` creates the pipeline layout – the descriptor set layout and the push constant range – once.
  Every pipeline uses it.
- `createPipeline(vertShaderFile, fragShaderFile, attributeCount, pipeline)` creates one graphics pipeline from a
  vertex and a fragment shader, with all the fixed-function state of before (no culling, depth test on, dynamic
  viewport and scissor):

```cpp
    // One graphics pipeline from a vertex and a fragment shader. All pipelines share the vertex buffer, the fixed
    // functions and the pipeline layout (descriptor set + push constants); they differ in their shaders and in how
    // many of the Vertex's attributes (in the order of getAttributeDescriptions) their vertex shader reads.
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkPipeline& pipeline) {
```

`attributeCount` becomes `vertexAttributeDescriptionCount` – the pipeline describes only the first `attributeCount`
attributes of `getAttributeDescriptions()`. Today every vertex has just a position, so it is 1; in the next chapter
the vertices get a second attribute that only one of the pipelines reads. `initVulkan()` creates the cube's pipeline
like this:

```cpp
        createPipelineLayout();
        createPipeline("shaders/colors.vert.spv", "shaders/colors.frag.spv", 1, lightingPipeline);
```

`recordCommandBuffer()` binds `lightingPipeline`, pushes `model = glm::mat4(1.0f)` and draws the 36 vertices.
:::
:::d3d12
The files are `main.cpp`, `colors.hlsl` (the shaders of the lit cube: `VSMain` and `PSMain`) and `light_cube.hlsl`
(the shaders of the lamp – more about those below). The `Vertex` struct holds just an `XMFLOAT3 position`, and the
input layout has only the `POSITION` element.

With the textures gone, the root signature got smaller, and its parameters moved down by one:

- **root parameter 0**: the 16 root constants of `ModelConstants` (register b0) – the model matrix, for the vertex
  shader;
- **root parameter 1**: a descriptor table with the CBV of the constant buffer (register b1) – view and projection.

The CBV/SRV heap holds only the CBV now. The constant buffer's struct, `SceneConstantBuffer`, will grow in every
lighting chapter, so the buffer and its CBV are no longer sized with a padding array and a `static_assert`: they get
`CalculateConstantBufferByteSize(sizeof(SceneConstantBuffer))` bytes – the size rounded up to the next multiple of 256
bytes (`D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT`), the same helper as in DXSampleHelper.h of Microsoft's samples:

```cpp
// The size of a constant buffer view must be a multiple of 256 bytes
// (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT): rounds a size up to the next multiple.
inline UINT CalculateConstantBufferByteSize(UINT byteSize)
{
    return (byteSize + (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1)) & ~(D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1);
}
```

The vertex shader of the cube is the one of the previous chapters without the texture coordinates:

```hlsl
// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The position is a row vector, multiplied by the matrices from left to right:
    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}
```

In `LoadAssets`, the two `D3DCompileFromFile` calls for `colors.hlsl` and the pipeline state description are in one
block, with `compileFlags` at its top, so that a second pipeline state can reuse both later in this chapter.
`PopulateCommandList` sets the cube's model matrix (`XMMatrixIdentity()`) as root constants and draws the 36
vertices.
:::

The project's `// TODO:` comments mark where your code goes. Build and run the program at any time. At the start you see
a flat **white** cube on the dark grey background – the cube's fragment shader still writes plain white.

### The default camera

There is one more change to the camera: where it starts. learnopengl's lighting chapters place the light source at
(1.2, 1.0, 2.0) – in front of the cube, to the right and above it. A camera at (0, 0, 3) looking down -z can't see
that point: the lamp is only one unit in front of the camera but 1.2 units to the side, about 50° off the line of
sight, while the 45° field of view of an 800×600 window reaches only about 29° to each side. (In learnopengl's
screenshots the author has simply flown the camera somewhere else first.)

The course therefore starts every camera of the first lighting chapters **front-left of the cube**, looking at it a
little from above:

:::opengl vulkan
```cpp
// camera: look at the cube's lit front and the lamp from the left
glm::vec3 cameraPos   = glm::vec3(-3.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::normalize(glm::vec3(3.5f, 0.4f, -2.2f));
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);

bool firstMouse = true;
float yaw   = -32.2f; // yaw and pitch (in degrees) of cameraFront, so the first mouse movement does not make the camera jump
float pitch =   5.5f;
```
:::
:::d3d12
```cpp
// camera: look at the cube's lit front and the lamp from the left
XMVECTOR cameraPos   = XMVectorSet(-3.0f, 0.0f, 3.0f, 0.0f);
XMVECTOR cameraFront = XMVector3Normalize(XMVectorSet(3.5f, 0.4f, -2.2f, 0.0f));
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);

// Which keys are held down, by virtual-key code ('W', VK_UP ...). WindowProc keeps it up to date.
bool keys[256] = {};

// Mouse look: the camera's direction as two angles, in degrees.
bool firstMouse = true;
float yaw   = -32.2f;    // yaw and pitch (in degrees) of cameraFront, so the first mouse movement does not make the camera jump
float pitch =   5.5f;
```
:::

From (-3, 0, 3) the camera sees two faces of the cube: its **front face** (the one facing +z, on the right of the
picture) and its **left face** (facing -x), and the lamp up and to the right. That is exactly what the coming chapters
need: the front face turns towards the light and the left face away from it, so you can compare a lit and an unlit
face, and in the next chapter the shiny highlight lands on the front face where this camera can see it.

`yaw` and `pitch` are the angles of this `cameraFront` (the yaw of (3.5, 0.4, -2.2) is atan2(-2.2, 3.5) ≈ -32.2°, the
pitch asin(0.4 / 4.15) ≈ 5.5°). They have to match: the first mouse movement computes `cameraFront` from yaw and pitch,
and with the old values (-90°, 0°) the camera would jump back to looking down -z. *Colors*, *Basic Lighting*,
*Materials* and *Lighting Maps* keep this camera; *Light Casters* and *Multiple Lights* go back to (0, 0, 3).

> The **Expected result** pictures can't press keys or move the mouse, so they always show this starting view. In your
> own program you can still fly around the scene as in the previous chapter.

```quiz
Why does the course start the camera at (-3, 0, 3) instead of learnopengl's (0, 0, 3)?
- [ ] Because the lighting calculations only work when the camera is not on the z-axis
- [ ] Because the lamp would be hidden behind the cube from (0, 0, 3)
- [x] Because the lamp at (1.2, 1.0, 2.0) is too far to the side of a camera at (0, 0, 3) – outside its field of view – and from the front-left both a face towards the light and a face away from it are visible
---
Seen from (0, 0, 3), the lamp is 1 unit ahead but 1.2 units to the right: about 50° off the line of sight, far outside a 45° field of view. Nothing about the lighting itself depends on where the camera is – this is only about what you get to see.
```

### The object's colour

Filling a vertex buffer, setting vertex attribute pointers and all that jazz should be familiar for you by now, so we
won't walk you through those steps. Let's first look at the cube's fragment shader. We want to multiply the light's
color with the object's color, exactly as we did in the first section. Both colours come from the application:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

uniform vec3 objectColor;
uniform vec3 lightColor;

void main()
{
    FragColor = vec4(lightColor * objectColor, 1.0);
}
```

The fragment shader accepts both an object color and a light color from a uniform variable. Here we multiply the
light's color with the object's (reflected) color like we discussed at the start of this chapter. Let's give the
object our coral color and the light a white light, in the render loop right after the shader is activated:

```cpp
        // be sure to activate shader when setting uniforms/drawing objects
        lightingShader.use();
        lightingShader.setVec3("objectColor", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("lightColor",  1.0f, 1.0f, 1.0f);
```

The order matters: `setVec3` calls `glUniform3f`, which sets a uniform of the program that is *currently in use*.
:::
:::vulkan
In the Vulkan project the colours, like the matrices, are values that stay the same for every draw of a frame, so they
go into the uniform buffer. The fragment shader declares the uniform block – the same block as the vertex shader, now
with two more members – and multiplies the light's color with the object's (reflected) color like we discussed at the
start of this chapter:

```glsl
#version 450

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 objectColor;
    vec3 lightColor;
} ubo;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(ubo.lightColor * ubo.objectColor, 1.0);
}
```

The vertex shaders may keep declaring only `view` and `proj`: a shader may declare just the first members of a block,
as long as they sit at the same offsets.

The C++ struct needs the same two members, and here we meet the layout rules of uniform blocks. A uniform block in a
Vulkan shader uses the **std140** layout, in which a `vec3` is aligned like a `vec4`, to a multiple of 16 bytes (see
*Alignment requirements* in vulkan-tutorial's *Descriptor pool and sets*). `view` and `proj` take bytes 0–127, so
`objectColor` starts at 128 and takes 12 bytes – but `lightColor` can't start at 140; it starts at the next multiple of
16, 144. A `glm::vec3` in C++ is just three floats with an alignment of 4, so without help the C++ struct would put
`lightColor` at 140 and the shader would read garbage. A `float` after each `glm::vec3` fills the gap:

```cpp
// The same layout as the uniform block in the shaders: the values that stay the same for every draw of a frame.
// In a uniform block (std140 layout) a vec3 starts at a multiple of 16 bytes, like a vec4: a float after each
// vec3 fills the 4 bytes up to the next one, so the C++ struct has the same offsets as the shader's block.
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 objectColor;
    float pad1;
    glm::vec3 lightColor;
    float pad2;
};
```

(`alignas(16)` before each `glm::vec3` would do the same; explicit padding floats make the layout visible.)

The uniform buffer is created with `sizeof(UniformBufferObject)` bytes, so it grows by itself. Two more things change.
The descriptor set layout so far made binding 2 visible to the vertex stage only; now the fragment shader reads it
too, and a shader may only use a descriptor whose binding includes its stage – the validation layers report an error
when the pipeline is created otherwise:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // the fragment shader reads the colours
```

And `updateUniformBuffer()` sets the colours – our coral object and a white light – every frame, after the matrices:

```cpp
        ubo.objectColor = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.lightColor  = glm::vec3(1.0f, 1.0f, 1.0f);
```
:::
:::d3d12
In the Direct3D 12 project the colours, like the view and projection matrices, are values that stay the same for every
draw of a frame, so they go into the constant buffer. In `colors.hlsl`, `SceneConstantBuffer` gets two more members,
and the pixel shader multiplies the light's color with the object's (reflected) color like we discussed at the start
of this chapter:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 objectColor;
    float3 lightColor;
};
```

```hlsl
// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(lightColor * objectColor, 1.0f);
}
```

The C++ struct needs the same two members, and here we meet HLSL's *packing rules* for constant buffers. HLSL packs a
cbuffer in rows of 16 bytes and never lets a variable straddle the boundary between two rows. `view` and `projection`
take bytes 0–127, `objectColor` takes bytes 128–139 – and `lightColor` (12 bytes) doesn't fit into the 4 bytes left in
that row, so it starts the next row, at byte 144. An `XMFLOAT3` in C++ is just three floats, so without help the C++
struct would put `lightColor` at 140. A `float` after each `XMFLOAT3` fills the gap:

```cpp
    // The constant buffer: what the shaders see as cbuffer SceneConstantBuffer.
    // HLSL packs a cbuffer in rows of 16 bytes and never lets a float3 cross from one row
    // into the next: a float3 followed by another float3 needs a float of padding here.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 objectColor;
        float padding0;
        XMFLOAT3 lightColor;
        float padding1;
    };
```

(A `float` declared right after a `float3` in the cbuffer *would* share its row – then no padding is needed. You'll see
that in a later chapter.)

Two more things change. Root parameter 1, the table with the CBV, was visible to the vertex shader only; now the pixel
shader reads the constant buffer too. If the root signature doesn't make b1 visible to the pixel shader, creating the
pipeline state fails, because the root signature no longer matches the shaders:

```cpp
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
```

And `OnUpdate` sets the colours – our coral object and a white light – before the `memcpy` into the constant buffer:

```cpp
    // The object's colour (coral) and the light's colour (white).
    constantBufferData.objectColor = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.lightColor = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

:::opengl
```quiz
Why are the two `setVec3` calls placed after `lightingShader.use()`?
- [ ] `use()` clears all uniforms, so anything set before it would be lost
- [ ] Uniforms of type `vec3` can only be set while a VAO is bound, and `use()` binds one
- [x] `glUniform*` functions set the uniform in the program that is currently in use, so the lighting program must be active first
---
A uniform belongs to a program object, and `glUniform3f` writes to the program made current with `glUseProgram`. Set before `use()`, the values would go to whatever program was active then (from the second frame on: the lamp's, which was used last).
```
:::
:::vulkan
```quiz
Why does `UniformBufferObject` have a `float pad1;` between `objectColor` and `lightColor`?
- [x] In the std140 layout a `vec3` starts at a multiple of 16 bytes, so the shader reads `lightColor` at offset 144; without the padding float the C++ struct would put it at 140
- [ ] Vulkan requires every member of a uniform buffer to be 16 bytes long
- [ ] The padding stores the alpha value of `objectColor`
---
`objectColor` starts at 128 and ends at 140. The shader expects the next `vec3` at the next multiple of 16, byte 144, while a `glm::vec3` only needs 4-byte alignment. The padding float makes both sides agree.
```
:::
:::d3d12
```quiz
Why does `SceneConstantBuffer` in C++ have a `float padding0;` between `objectColor` and `lightColor`?
- [ ] Direct3D 12 requires every member of a constant buffer to be 16 bytes long
- [x] HLSL never lets a `float3` straddle a 16-byte row, so `lightColor` starts at byte 144 in the cbuffer; without the padding float the C++ struct would put it at 140
- [ ] The padding is needed so that the whole buffer is a multiple of 256 bytes
---
`objectColor` fills bytes 128–139. The 4 bytes left in that row can't hold a 12-byte `float3`, so HLSL starts `lightColor` in the next row. The 256-byte size is a separate rule, handled by `CalculateConstantBufferByteSize`.
```
:::

Now do the first task, **object-color**: give the cube's fragment shader the two colours and output their product, and
set them from the application. When you build and run it, the white cube turns **coral** – (255, 128, 79) on screen,
because 0.5 · 255 = 127.5 rounds to 128 and 0.31 · 255 ≈ 79.

Look closely, though: the front face and the left face have exactly the same colour, and the cube looks flat, like a
paper cut-out. Nothing in the shader depends on where the light is or which way a face is turned, so every fragment
gets the same colour. That is what the next chapter is about.

```quiz
After the task **object-color** both visible faces of the cube have exactly the same coral colour. Why?
- [ ] Because a white light can't produce shading – a coloured light would
- [x] Because the colour is just lightColor × objectColor: the shader doesn't know where the light is or which way a face points, so every fragment gets the same result
- [ ] Because the camera looks at both faces from the same angle
---
Real shading needs the light's position and the direction of the surface (its normal). Both come in the next chapter, *Basic Lighting*.
```

### The lamp

One thing left to note is that when we start to update these lighting shaders in the next chapters, the light source
cube would also be affected and this is not what we want. We don't want the light source object's color to be affected
by the lighting calculations, but rather keep the light source isolated from the rest. We want the light source to have
a constant bright color, unaffected by other color changes (this makes it look like the light source cube really is the
source of the light).

:::opengl
To accomplish this we need to create a second set of shaders that we'll use to draw the light source cube, thus being
safe from any changes to the lighting shaders. The vertex shader, `light_cube.vs`, is the same as the cube's vertex
shader – it is already complete in the project. The fragment shader ensures the cube's color remains bright by
defining a constant white color on the lamp:

```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(1.0); // set all 4 vector values to 1.0
}
```

The program is built next to `lightingShader`:

```cpp
    Shader lightingShader("colors.vs", "colors.fs");
    Shader lightCubeShader("light_cube.vs", "light_cube.fs");
```
:::
:::vulkan
To accomplish this we need a second set of shaders that we'll use to draw the light source cube, thus being safe from
any changes to the lighting shaders. In Vulkan the shaders are part of a graphics pipeline, so the lamp gets **a
second pipeline**. `shaders/light_cube.vert` is the same as the cube's vertex shader – it is already complete in the
project. The fragment shader ensures the cube's color remains bright by defining a constant white color on the lamp,
and it doesn't even declare the uniform block:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0); // set all 4 vector values to 1.0
}
```

Thanks to the `createPipeline` helper the second pipeline takes one line in `initVulkan()` – plus a member
`VkPipeline lightCubePipeline;` next to `lightingPipeline`, and a `vkDestroyPipeline` in `cleanup()`:

```cpp
        createPipeline("shaders/colors.vert.spv", "shaders/colors.frag.spv", 1, lightingPipeline);
        createPipeline("shaders/light_cube.vert.spv", "shaders/light_cube.frag.spv", 1, lightCubePipeline); // the lamp only needs the position
```

```cpp
        vkDestroyPipeline(device, lightingPipeline, nullptr);
        vkDestroyPipeline(device, lightCubePipeline, nullptr);
```

Both pipelines use the same pipeline layout – the same descriptor set layout and push constant range – and the same
fixed-function state; only the shaders differ.
:::
:::d3d12
To accomplish this we need a second set of shaders that we'll use to draw the light source cube, thus being safe from
any changes to the lighting shaders. In Direct3D 12 the shaders are part of a pipeline state object, so the lamp gets
**a second pipeline state object**. In `light_cube.hlsl`, `VSMain` is the same as the cube's vertex shader – it is
already complete in the project, and its cbuffer declares only the two matrices it needs. `PSMain` ensures the cube's
color remains bright by returning a constant white color:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 1.0f, 1.0f, 1.0f); // set all 4 vector values to 1.0
}
```

In `LoadAssets`, right after the cube's pipeline state has been created, we compile the lamp's two shaders and create
a second pipeline state from the same description – the same root signature, input layout and depth test – with only
the shaders swapped:

```cpp
        // The lamp: its own shaders (light_cube.hlsl) in the same description - the same
        // root signature, input layout and depth test.
        ComPtr<ID3DBlob> lightCubeVertexShader;
        ComPtr<ID3DBlob> lightCubePixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"light_cube.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &lightCubeVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"light_cube.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &lightCubePixelShader, nullptr));

        psoDesc.VS = CD3DX12_SHADER_BYTECODE(lightCubeVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(lightCubePixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightCubePipelineState)));
```

`m_lightCubePipelineState` is a new member, `ComPtr<ID3D12PipelineState>`, next to `m_pipelineState`. Reusing the
description is safe: `CreateGraphicsPipelineState` copies what it needs, so changing `psoDesc` afterwards doesn't
affect the first pipeline state.
:::

The main purpose of the light source cube is to show where the light comes from. We usually define a light source's
position somewhere in the scene, but this is simply a position that has no visual meaning. To show where the light
source actually is we render a cube at the same location of the light source.

```quiz
Why does the lamp get its own shaders instead of being drawn with the cube's lighting shaders?
- [x] So that the lamp keeps a constant bright colour: the lighting calculations we add to the cube's shaders in the next chapters must not change the lamp
- [ ] Because a single shader can only draw one object per frame
- [ ] Because the lamp has different vertex data than the cube
---
The lamp uses exactly the same 36 vertices as the cube. What differs is what its fragments should look like: always white, whatever the lighting shaders do.
```

:::opengl
Now do the task **lamp-shader**. Nothing is drawn with the new program yet, so the picture doesn't change.
:::
:::vulkan
Now do the task **lamp-shader**. Nothing is drawn with the new pipeline yet, so the picture doesn't change.
:::
:::d3d12
Now do the task **lamp-shader**. Nothing is drawn with the new pipeline state yet, so the picture doesn't change.
:::

### Drawing the lamp

We'll declare a global variable `lightPos` that represents the light source's location in world-space coordinates:

:::opengl vulkan
```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
```
:::
:::d3d12
```cpp
// lighting
XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);
```
:::

Then we translate the light source cube to the light source's position and scale it down before rendering it, so that
it doesn't look as dominant as the object.

:::opengl
As we're also going to render a light source cube, we want to generate a new VAO specifically for the light source. We
could render the light source with the same VAO and then do a few light position transformations on the `model`
matrix, but in the upcoming chapters we'll be changing the vertex data and attribute pointers of the container object
quite often and we don't want these changes to propagate to the light source object (we only care about the light
cube's vertex positions), so we'll create a new VAO:

```cpp
    // second, configure the light's VAO (VBO stays the same; the vertices are the same for the light object which is also a 3D cube)
    unsigned int lightCubeVAO;
    glGenVertexArrays(1, &lightCubeVAO);
    glBindVertexArray(lightCubeVAO);

    // we only need to bind to the VBO (to link it with glVertexAttribPointer), no need to fill it; the VBO's data already contains all we need (it's already bound, but we do it again for educational purposes)
    glBindBuffer(GL_ARRAY_BUFFER, VBO);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

The code should be relatively straightforward: the lamp uses the same buffer (`VBO`) with the cube's vertices, but has
its own vertex array object that records its own attribute setup.

In the render loop, after the cube has been drawn, we draw the lamp with its own shader program. It needs the same
`projection` and `view` matrices – they are uniforms of `lightCubeShader` now, which has its own set – and its own
model matrix:

```cpp
        // also draw the lamp object
        lightCubeShader.use();
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);
        model = glm::mat4(1.0f);
        model = glm::translate(model, lightPos);
        model = glm::scale(model, glm::vec3(0.2f)); // a smaller cube
        lightCubeShader.setMat4("model", model);

        glBindVertexArray(lightCubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
```

Don't forget to delete the new VAO at the end of `main`, next to the cube's: `glDeleteVertexArrays(1, &lightCubeVAO);`.
:::
:::vulkan
The lamp doesn't need a vertex buffer of its own: it is the same 36 vertices. In `recordCommandBuffer()`, after the
cube's draw, we bind the lamp's pipeline, push the lamp's model matrix and draw the vertices again:

```cpp
        // also draw the lamp object
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightCubePipeline);
        model = glm::mat4(1.0f);
        model = glm::translate(model, lightPos);
        model = glm::scale(model, glm::vec3(0.2f)); // a smaller cube
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

Note what we *don't* repeat. The vertex buffer binding stays bound when another pipeline is bound. The descriptor set
stays bound too, because the new pipeline uses the same (and therefore compatible) pipeline layout – so the lamp's
vertex shader reads the same view and projection matrices. Viewport and scissor are dynamic state in both pipelines,
so the values set with `vkCmdSetViewport` and `vkCmdSetScissor` stay valid as well. Only the pipeline and the model
matrix change.
:::
:::d3d12
The lamp doesn't need a vertex buffer of its own: it is the same 36 vertices. In `PopulateCommandList`, after the
cube's draw, we switch to the lamp's pipeline state, set the lamp's model matrix and draw the vertices again:

```cpp
    // Also draw the lamp object: the same cube, with the lamp's pipeline state (its own
    // shaders), made smaller (scale 0.2) and moved to lightPos.
    m_commandList->SetPipelineState(m_lightCubePipelineState.Get());
    model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(lightPos.x, lightPos.y, lightPos.z);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
```

DirectXMath multiplies row vectors, so the product is read from left to right: first scale, then move – the same as
learnopengl's `translate` followed by `scale`.

Note what we *don't* repeat. `SetPipelineState` doesn't change the root signature, and the root arguments set on the
command list – the descriptor table of root parameter 1 with view and projection – stay in place, so the lamp's
vertex shader reads the same matrices. The vertex buffer, the primitive topology, the viewport and the scissor
rectangle are command list state, not pipeline state, and stay set as well. Only the pipeline state and the model
matrix change.
:::

:::opengl
```quiz
The lamp uses the same VBO as the cube. Why does it still get its own VAO, `lightCubeVAO`?
- [x] Because the cube's vertex data and attribute pointers will change in the coming chapters, and the lamp's attribute setup (positions only) should not be affected
- [ ] Because a VAO stores the shader program, and the lamp has its own program
- [ ] Because a VBO can only be referenced by one VAO
---
A VAO records the attribute setup – which buffer, which attributes, which strides. Several VAOs can point into the same VBO. Keeping a separate VAO for the lamp means later changes to the cube's attributes leave the lamp alone.
```
:::
:::vulkan
```quiz
Before drawing the lamp, `recordCommandBuffer()` binds `lightCubePipeline` but does not bind the descriptor set or the vertex buffer again. Why does the lamp still get the view and projection matrices?
- [ ] Because `vkCmdBindPipeline` copies all bindings of the previous pipeline into the new one
- [x] Because both pipelines use the same pipeline layout, so the bound descriptor set stays valid, and vertex buffer bindings are not part of the pipeline at all
- [ ] Because the lamp's vertex shader has the matrices compiled in
---
Descriptor sets stay bound across pipeline changes as long as the pipeline layouts are compatible – here they are identical. Vertex buffers, like dynamic viewport and scissor values, are command buffer state.
```
:::
:::d3d12
```quiz
Before drawing the lamp, `PopulateCommandList` calls `SetPipelineState` but doesn't set the descriptor table or the vertex buffer again. Why does the lamp still get the view and projection matrices?
- [ ] Because `SetPipelineState` copies the root arguments into the new pipeline state object
- [x] Because the root signature stays the same, so the root arguments set on the command list stay in place, and the vertex buffer is command list state, not part of the pipeline state
- [ ] Because the lamp's vertex shader has the matrices compiled in
---
Root arguments belong to the command list and are kept as long as the root signature doesn't change. The pipeline state object only holds shaders and fixed-function state.
```
:::

Now do the task **lamp**: declare `lightPos`, then draw the lamp after the cube. When you build and run it, a **small
white cube** appears up and to the right of the coral cube. Applying all the transformations, the result should look
like this: a coral cube on the left, lit by nothing but a flat white light, and a small, bright white lamp floating in
front of it, to its right and slightly above.

If you have difficulties, compare your code with learnopengl's `colors.cpp` (linked in the sources); apart from the
camera's start values it is the same program.

Fiddling with the colours is a good way to get a feel for this chapter: try a green or an olive-green light, as in the
examples at the start, and see the coral cube change. Then set the light back to white – the coming chapters rely on
it. Having some knowledge about colors and a basic scene for experimenting with lighting, we can jump to the next
chapter where the real magic begins.
