# Basic Lighting

Lighting in the real world is extremely complicated and depends on way too many factors, something we can't afford to
calculate on the limited processing power we have. Lighting in {{api}} is therefore based on approximations of reality
using simplified models that are much easier to process and look relatively similar. These lighting models are based
on the physics of light as we understand it. One of those models is called the *Phong lighting model*. The major
building blocks of the Phong lighting model consist of 3 components: ambient, diffuse and specular lighting.

- **Ambient lighting**: even when it is dark there is usually still some light somewhere in the world (the moon, a
  distant light) so objects are almost never completely dark. To simulate this we use an ambient lighting constant
  that always gives the object some color.
- **Diffuse lighting**: simulates the directional impact a light object has on an object. This is the most visually
  significant component of the lighting model. The more a part of an object faces the light source, the brighter it
  becomes.
- **Specular lighting**: simulates the bright spot of a light that appears on shiny objects. Specular highlights are
  more inclined to the color of the light than the color of the object.

To create visually interesting scenes we want to at least simulate these 3 lighting components. We'll start with the
simplest one: *ambient lighting*.

:::opengl
This chapter's project is the result of *Colors*: the coral cube, the white lamp at `lightPos` and the camera
front-left of the cube. Two things were prepared. The cube's shaders are renamed to `basic_lighting.vs` and
`basic_lighting.fs` (same contents as `colors.vs`/`colors.fs`; `Shader lightingShader("basic_lighting.vs",
"basic_lighting.fs");`), and the vertex array has **6 floats per vertex** now – a position and a *normal vector*,
which we'll get to in a moment. Both VAOs' position attributes already use the new stride, `6 * sizeof(float)`.
:::
:::vulkan
This chapter's project is the result of *Colors*: the coral cube, the white lamp at `lightPos`, two pipelines made by
`createPipeline(...)` and the camera front-left of the cube. Two things were prepared. The cube's shaders are renamed to
`shaders/basic_lighting.vert` and `shaders/basic_lighting.frag` (same contents as before;
`createPipeline("shaders/basic_lighting.vert.spv", "shaders/basic_lighting.frag.spv", 1, lightingPipeline)`), and every
vertex has a **position and a normal vector** now – which we'll get to in a moment: `struct Vertex { glm::vec3 pos;
glm::vec3 normal; }`.
:::
:::d3d12
This chapter's project is the result of *Colors*: the coral cube, the white lamp at `lightPos`, two pipeline state
objects and the camera front-left of the cube. Two things were prepared. The cube's shaders are renamed to
`basic_lighting.hlsl` (same contents as `colors.hlsl`; both `D3DCompileFromFile` calls use the new name), and every
vertex has a **position and a normal vector** now – which we'll get to in a moment: `struct Vertex { XMFLOAT3
position; XMFLOAT3 normal; }`. The vertex buffer view's stride is `sizeof(Vertex)`, 24 bytes now, so the positions are
still read correctly.
:::

Most tasks of this chapter change code that is already there; the one `// TODO:` comment marks where the normal
attribute goes. Build and run the program after each task to see the result. The start picture is the end of the
previous chapter: a flat coral cube and a white lamp.

## Ambient lighting

Light usually does not come from a single light source, but from many light sources scattered all around us, even
when they're not immediately visible. One of the properties of light is that it can scatter and bounce in many
directions, reaching spots that aren't directly visible; light can thus *reflect* on other surfaces and have an
indirect impact on the lighting of an object. Algorithms that take this into consideration are called *global
illumination* algorithms, but these are complicated and expensive to calculate.

Since we're not big fans of complicated and expensive algorithms we'll start by using a very simplistic model of
global illumination, namely *ambient lighting*. As you've seen at the start of this chapter we use a small constant
(light) color that we add to the final resulting color of the object's fragments, thus making it look like there is
always some scattered light even when there's not a direct light source.

Adding ambient lighting to the scene is really easy. We take the light's color, multiply it with a small constant
ambient factor, multiply this with the object's color, and use that as the fragment's color in the cube object's
shader:

:::opengl
```glsl
void main()
{
    // ambient
    float ambientStrength = 0.1;
    vec3 ambient = ambientStrength * lightColor;

    vec3 result = ambient * objectColor;
    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // ambient
    float ambientStrength = 0.1;
    vec3 ambient = ambientStrength * ubo.lightColor;

    vec3 result = ambient * ubo.objectColor;
    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float ambientStrength = 0.1f;
    float3 ambient = ambientStrength * lightColor;

    float3 result = ambient * objectColor;
    return float4(result, 1.0f);
}
```
:::

Now do the task **ambient**. If you build and run the program, you'll notice that the first stage of lighting is now
successfully applied to the object. The object is quite dark – (26, 13, 8), a tenth of coral – but not completely
since ambient lighting is applied (note that the light cube is unaffected because it has its own shaders). It should
look something like a very dark coral silhouette.

```quiz
After the task **ambient** every visible face of the cube has the same very dark coral colour. Why?
- [x] The ambient term is a constant – 0.1 × lightColor – that doesn't depend on the light's position or on which way a face points
- [ ] The light is too far away from the cube to light it
- [ ] The ambient term only lights the faces that point away from the light
---
Ambient light stands in for light that has bounced around everywhere, so it is the same for every fragment. Differences between the faces need a term that depends on direction: diffuse lighting.
```

## Diffuse lighting

Ambient lighting by itself doesn't produce the most interesting results, but diffuse lighting however will start to
give a significant visual impact on the object. Diffuse lighting gives the object more brightness the closer its
fragments are aligned to the light rays from a light source. Picture a light ray hitting a fragment: the light comes
from the light source, the fragment has a *normal vector* sticking straight out of its surface, and θ is the angle
between that normal and the direction towards the light.

If the light ray is perpendicular to the object's surface the light has the greatest impact. To measure the angle
between the light ray and the fragment we use something called a normal vector, that is a vector perpendicular to the
fragment's surface; the light direction is the vector from the fragment to the light source. To measure the angle
between the light ray and the fragment we take the dot product between the normal vector and the light direction.

You may remember from the *Transformations* chapter that, the lower the angle between two unit vectors, the more the
dot product is inclined towards a value of 1. When the angle between both vectors is 90 degrees, the dot product
becomes 0. The same applies to θ: the larger θ becomes, the less of an impact the light should have on the fragment's
color.

> Note that to get (only) the cosine of the angle between both vectors we will work with *unit vectors* (vectors of
> length 1) so we need to make sure all the vectors are normalized, otherwise the dot product returns more than just
> the cosine.

The resulting dot product thus returns a scalar that we can use to calculate the light's impact on the fragment's
color, resulting in differently lit fragments based on their orientation towards the light.

So, what do we need to calculate diffuse lighting:

- **Normal vector**: a vector that is perpendicular to the vertex' surface.
- **The directed light ray**: a direction vector that is the difference vector between the light's position and the
  fragment's position. To calculate this light ray we need the light's position vector and the fragment's position
  vector.

### Normal vectors

A normal vector is a (unit) vector that is perpendicular to the surface of a vertex. Since a vertex by itself has no
surface (it's just a single point in space) we retrieve a normal vector by using its surrounding vertices to figure out
the surface of the vertex. We can use a little trick to calculate the normal vectors for all the cube's vertices by
using the cross product, but since a 3D cube is not a complicated shape we can simply manually add them to the vertex
data. The updated vertex data array is already in the project; try to visualize that the normals are indeed vectors
perpendicular to each plane's surface (a cube consists of 6 planes). The first face, the back face at z = -0.5, has
the normal (0, 0, -1), pointing away from the cube:

:::opengl
```cpp
    float vertices[] = {
        // positions          // normals
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
```

Since we added an extra input to the vertex array we should update the cube's VAO, which needs a second attribute
pointer: 3 floats, starting 3 floats into each 6-float vertex:

```cpp
    // normal attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
```

We only want to use the first 3 floats of each vertex for the lamp and ignore the last 3 floats, so we only need to
update the lamp VAO's stride parameter – which the project has already done:

```cpp
    // note that we update the lamp's position attribute's stride to reflect the updated buffer data
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

> It may look inefficient using vertex data that is not completely used by the lamp shader, but the vertex data is
> already stored in the GPU's memory from the container object so we don't have to store new data into the GPU's
> memory. This actually makes it more efficient compared to allocating a new VBO specifically for the lamp.

All the lighting calculations are done in the fragment shader, so we need to forward the normal vectors from the
vertex shader to the fragment shader. We'll also need the fragment's position: we're going to do all the lighting
calculations in world space, so we want a vertex position that is in world space first. We can accomplish this by
multiplying the vertex position attribute with the model matrix only (not the view and projection matrix) to
transform it to world space coordinates. The vertex shader then becomes:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 FragPos;
out vec3 Normal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    FragPos = vec3(model * vec4(aPos, 1.0));
    Normal = aNormal;

    gl_Position = projection * view * vec4(FragPos, 1.0);
}
```

And in the fragment shader we declare the corresponding input variables:

```glsl
in vec3 Normal;
in vec3 FragPos;
```
:::
:::vulkan
```cpp
// learnopengl's cube: 6 faces of 2 triangles, 36 vertices (no index buffer).
// Each vertex has its position and the normal of its face (a vector perpendicular to the face, pointing out).
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
    {{ 0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
```

The vertex buffer already holds the normals, but the pipeline doesn't know about them yet. As in vulkan-tutorial's
*Vertex input description*, `getAttributeDescriptions()` gets a second entry – location 1, three 32-bit floats, at the
offset of `normal` in the struct:

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
        attributeDescriptions[1].offset = offsetof(Vertex, normal);

        return attributeDescriptions;
    }
```

Here the third parameter of `createPipeline` comes in: the number of attributes, from the start of this array, that
a pipeline describes. The cube's vertex shader reads both, so its pipeline gets 2; the lamp's vertex shader reads only
the position, so its pipeline keeps 1 – like learnopengl's lamp VAO, which only enables attribute 0. (Describing an
attribute that the vertex shader doesn't read isn't an error, but the validation layers warn about it.) The binding's
stride is `sizeof(Vertex)`, 24 bytes, for both pipelines, so the lamp still finds its positions:

```cpp
        createPipeline("shaders/basic_lighting.vert.spv", "shaders/basic_lighting.frag.spv", 2, lightingPipeline); // position and normal
        createPipeline("shaders/light_cube.vert.spv", "shaders/light_cube.frag.spv", 1, lightCubePipeline); // the lamp only needs the position
```

> It may look inefficient to have vertex data the lamp doesn't use, but the vertices are already in the GPU's memory
> for the cube, so both pipelines simply read the same vertex buffer – cheaper than a second buffer just for the lamp.

All the lighting calculations are done in the fragment shader, so we need to forward the normal vectors from the
vertex shader to the fragment shader. We'll also need the fragment's position: we're going to do all the lighting
calculations in world space, so we want a vertex position that is in world space first. We can accomplish this by
multiplying the vertex position with the model matrix only (not the view and projection matrix). The vertex shader
then becomes:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;

layout(location = 0) out vec3 fragPos;
layout(location = 1) out vec3 fragNormal;

void main() {
    // the lighting is calculated in world space: the fragment's position after the model matrix
    fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    fragNormal = inNormal;

    gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);
}
```

And in the fragment shader we declare the corresponding inputs – in Vulkan GLSL they are matched by `location`, not by
name:

```glsl
layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
```
:::
:::d3d12
```cpp
            // positions                normals
            { { -0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
            { {  0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
            { {  0.5f,  0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
```

The vertex buffer already holds the normals, but the input layout doesn't describe them yet. It gets a second element,
`NORMAL`: three floats at byte offset 12, right after the position:

```cpp
        // Define the vertex input layout.
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

The lamp's pipeline state is created from the same description, so it gets this input layout too, although
`light_cube.hlsl`'s `VSMain` reads only `POSITION`. That is fine: an input layout may provide more elements than the
vertex shader reads (only the reverse is an error).

> It may look inefficient to have vertex data the lamp doesn't use, but the vertices are already in the GPU's memory
> for the cube, so both pipeline states simply read the same vertex buffer – cheaper than a second buffer just for the
> lamp.

All the lighting calculations are done in the pixel shader, so we need to forward the normal vectors from the vertex
shader to the pixel shader. We'll also need the fragment's position: we're going to do all the lighting calculations
in world space, so we want a vertex position that is in world space first. We can accomplish this by multiplying the
vertex position with the model matrix only (not the view and projection matrix). `PSInput` gets two more members –
any semantic except the `SV_` system values just passes a value on to the pixel shader:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};
```

and `VSMain` gets the normal as a second input:

```hlsl
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.normal = normal;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}
```

`PSMain` already receives the whole `PSInput` as `input`, so it can read `input.fragPos` and `input.normal`.
:::

Now do the task **normals**. Nothing uses the new values yet, so the picture doesn't change.

:::opengl
```quiz
Why does the lamp's VAO use a stride of `6 * sizeof(float)` although the lamp only reads the position?
- [ ] Because every attribute must have the same stride as the largest attribute
- [ ] Because the lamp's shader reads the normal too, to stay white
- [x] Because the stride is the distance from one vertex to the next in the shared VBO, and each vertex now takes 6 floats – the lamp just skips the normal
---
The lamp's VAO points into the same VBO as the cube's. With a stride of `3 * sizeof(float)`, the second vertex position would be read from the first vertex's normal.
```
:::
:::vulkan
```quiz
Why is the lamp's pipeline created with an `attributeCount` of 1 while the cube's gets 2?
- [x] Because the lamp's vertex shader reads only the position (location 0), while the cube's reads the position and the normal; both read the same 24-byte vertices
- [ ] Because the lamp is drawn from a separate vertex buffer that contains only positions
- [ ] Because a pipeline can't describe more attributes than the previous pipeline
---
Both pipelines use the same binding with a stride of `sizeof(Vertex)`, so the lamp still finds every position. It simply doesn't describe the normal its shader never reads.
```
:::
:::d3d12
```quiz
Why does the `NORMAL` element of the input layout have the byte offset 12?
- [ ] Because every input element must start at a multiple of 12 bytes
- [ ] Because the normal is stored 12 vertices after the position in the vertex buffer
- [x] Because each vertex starts with its position, an `XMFLOAT3` of 3 × 4 = 12 bytes, and the normal follows right after it
---
The offset is measured from the start of each vertex. The vertex buffer view's stride, `sizeof(Vertex)` = 24, takes the input assembler from one vertex to the next.
```
:::

### Calculating the diffuse color

We now have the normal vector for each vertex, but we still need the light's position vector and the fragment's
position vector. Since the light's position is a single static variable we can declare it as a uniform in the cube
object's shader:

:::opengl
```glsl
uniform vec3 lightPos;
```

And then update the uniform in the render loop (or outside since it doesn't change per frame). We use the `lightPos`
vector declared in the previous chapter as the location of the diffuse light source:

```cpp
        lightingShader.setVec3("lightPos", lightPos);
```
:::
:::vulkan
In Vulkan it becomes the next member of the uniform block in `basic_lighting.frag`:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 objectColor;
    vec3 lightColor;
    vec3 lightPos;
} ubo;
```

and of the C++ struct, again with a padding float, because in the std140 layout the next `vec3` starts at the next
multiple of 16 bytes:

```cpp
    glm::vec3 lightColor;
    float pad2;
    glm::vec3 lightPos;
    float pad3;
};
```

`updateUniformBuffer()` copies the `lightPos` variable declared in the previous chapter into it, as the location of
the diffuse light source:

```cpp
        ubo.lightPos    = lightPos;
```
:::
:::d3d12
In Direct3D 12 it becomes the next member of `SceneConstantBuffer` in `basic_lighting.hlsl`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 objectColor;
    float3 lightColor;
    float3 lightPos;
};
```

and of the C++ struct, again with a padding float, because HLSL starts this `float3` in a new 16-byte row:

```cpp
        XMFLOAT3 lightColor;
        float padding1;
        XMFLOAT3 lightPos;
        float padding2;
    };
```

`OnUpdate` copies the `lightPos` variable declared in the previous chapter into it, as the location of the diffuse
light source:

```cpp
    constantBufferData.lightPos = lightPos;
```

The constant buffer is sized with `CalculateConstantBufferByteSize`, so its 256 bytes still have room; nothing else
changes.
:::

Then the last thing we need is the actual fragment's position. We already have it: it is the world-space position the
vertex shader passes on, which the rasterizer interpolates across each triangle. Now that all the required variables
are set we can start the lighting calculations.

The first thing we need to calculate is the direction vector between the light source and the fragment's position.
From the previous section we know that the light's direction vector is the difference vector between the light's
position vector and the fragment's position vector. We can easily calculate this difference by subtracting both
vectors from each other. We also want to make sure all the relevant vectors end up as unit vectors so we normalize
both the normal and the resulting direction vector:

:::opengl
```glsl
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
```
:::
:::vulkan
```glsl
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.lightPos - fragPos);
```
:::
:::d3d12
```hlsl
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(lightPos - input.fragPos);
```
:::

> When calculating lighting we usually do not care about the magnitude of a vector or their position; we only care
> about their direction. Because we only care about their direction almost all the calculations are done with unit
> vectors since it simplifies most calculations (like the dot product). So when doing lighting calculations, make sure
> you always normalize the relevant vectors to ensure they're actual unit vectors. Forgetting to normalize a vector is
> a popular mistake. The normal needs it too, even though every normal in the vertex data has length 1: interpolating
> between differently oriented normals (and, later, a model matrix that scales) can change its length.

Next we need to calculate the diffuse impact of the light on the current fragment by taking the dot product between
the `norm` and `lightDir` vectors. The resulting value is then multiplied with the light's color to get the diffuse
component, resulting in a darker diffuse component the greater the angle between both vectors:

:::opengl
```glsl
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * lightColor;
```
:::
:::vulkan
```glsl
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * ubo.lightColor;
```
:::
:::d3d12
```hlsl
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = diff * lightColor;
```
:::

If the angle between both vectors is greater than 90 degrees then the result of the dot product will actually become
negative and we end up with a negative diffuse component. For that reason we use the `max` function that returns the
highest of both its parameters to make sure the diffuse component (and thus the colors) never become negative.
Lighting for negative colors is not really defined so it's best to stay away from that, unless you're one of those
eccentric artists.

Now that we have an ambient and a diffuse component we add both colors to each other and then multiply the result with
the color of the object to get the resulting fragment's output color:

:::opengl
```glsl
    vec3 result = (ambient + diffuse) * objectColor;
    FragColor = vec4(result, 1.0);
```
:::
:::vulkan
```glsl
    vec3 result = (ambient + diffuse) * ubo.objectColor;
    outColor = vec4(result, 1.0);
```
:::
:::d3d12
```hlsl
    float3 result = (ambient + diffuse) * objectColor;
    return float4(result, 1.0f);
```
:::

Now do the task **diffuse**. If your application (and shaders) compiled successfully you should see the cube come alive:
the **front face**, which faces the lamp, is lit – about (202, 101, 63) in its centre, brighter towards the lamp and
slightly darker away from it – while the **left face** stays as dark as before. You can see that with diffuse lighting
the cube starts to look like an actual cube again. Try visualizing the normal vectors in your head and move the camera
around the cube to see that the larger the angle between the normal vector and the light's direction, the darker the
fragment.

Let's check the number in the centre of the front face, (0, 0, 0.5): the direction to the lamp
is (1.2, 1.0, 1.5), of length 2.17, so `lightDir` = (0.55, 0.46, 0.69). With the normal (0, 0, 1) the dot product is
0.69; ambient plus diffuse gives 0.79, and 0.79 × coral × 255 = (202, 101, 63).

```quiz
Why does the cube's left face stay as dark as with ambient light alone?
- [ ] Because the rasterizer interpolates the normals of the front face across the left face
- [ ] Because the camera looks at the left face from too steep an angle
- [x] Because its normal (-1, 0, 0) points away from the lamp at x = 1.2, so the dot product with the light direction is negative and `max(…, 0.0)` makes the diffuse term 0
---
The lamp is to the right of the cube, the left face points left: the angle between its normal and the direction to the light is more than 90°. Only the ambient term is left.
```

### One last thing

In the previous section we passed the normal vector directly from the vertex shader to the fragment shader. However,
the calculations in the fragment shader are all done in world space, so shouldn't we transform the normal vectors to
world space coordinates as well? Basically yes, but it's not as simple as simply multiplying it with a model matrix.

First of all, normal vectors are only direction vectors and do not represent a specific position in space. Second,
normal vectors do not have a homogeneous coordinate (the w component of a vertex position). This means that
translations should not have any effect on the normal vectors. So if we want to multiply the normal vectors with a
model matrix we want to remove the translation part of the matrix by taking the upper-left 3x3 matrix of the model
matrix (note that we could also set the w component of a normal vector to 0 and multiply with the 4x4 matrix).

Second, if the model matrix would perform a non-uniform scale, the vertices would be changed in such a way that the
normal vector is not perpendicular to the surface anymore. Picture a slanted surface with its normal, and then stretch
the object along y only: the surface tilts, but the normal, scaled the same way, tilts in the wrong direction. The
following shows this in 2D for a surface going diagonally up, along (1, 1), with the normal (1, -1) (unnormalized
for readability), stretched by 2 along y:

```text
surface direction         (1, 1)   ->  (1, 2)       the stretched surface
normal, scaled the same   (1, -1)  ->  (1, -2)      dot((1, 2), (1, -2)) = -3: no longer perpendicular
normal, normal matrix     (1, -1)  ->  (1, -0.5)    dot((1, 2), (1, -0.5)) = 0: perpendicular again
```

Whenever we apply a non-uniform scale (note: a uniform scale only changes the normal's magnitude, not its direction,
which is easily fixed by normalizing it) the normal vectors are not perpendicular to the corresponding surface anymore
which distorts the lighting.

The trick of fixing this behavior is to use a different model matrix specifically tailored for normal vectors. This
matrix is called the *normal matrix* and uses a few linear algebraic operations to remove the effect of wrongly
scaling the normal vectors. The normal matrix is defined as "the transpose of the inverse of the upper-left 3x3 part
of the model matrix". Phew, that's a mouthful and if you don't really understand what that means, don't worry; we
haven't discussed inverse and transpose matrices yet. Note that most resources define the normal matrix as derived
from the model-view matrix, but since we're working in world space (and not in view space) we will derive it from the
model matrix.

:::opengl vulkan
In the vertex shader we can generate the normal matrix by using the `inverse` and `transpose` functions in the vertex
shader that work on any matrix type. Note that we cast the matrix to a 3x3 matrix to ensure it loses its translation
properties and that it can multiply with the `vec3` normal vector:
:::
:::opengl
```glsl
    Normal = mat3(transpose(inverse(model))) * aNormal;
```
:::
:::vulkan
```glsl
    // the normal matrix: rotations and scaling of the model matrix without the translation (and right for non-uniform scaling)
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
```
:::
:::opengl vulkan

> Inversing matrices is a costly operation for shaders, so wherever possible try to avoid doing inverse operations
> since they have to be done on each vertex of your scene. For learning purposes this is fine, but for an efficient
> application you'll likely want to calculate the normal matrix on the CPU and send it to the shaders via a uniform
> before drawing (just like the model matrix).
:::
:::d3d12
In GLSL, learnopengl writes `mat3(transpose(inverse(model)))` right in the vertex shader. HLSL has `transpose`, but
**no `inverse` function** – and inverting a matrix for every vertex is costly anyway, since it gives the same result for
every vertex of a draw. So we do what learnopengl recommends for an efficient application: compute the normal matrix
on the CPU, once per draw, and send it along with the model matrix. It becomes a second member of the root constants:

```cpp
    // The root constants: what the vertex shader sees as cbuffer ModelConstants.
    // Two 4x4 matrices are 32 floats: 32 32-bit root constants.
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
```

```hlsl
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};
```

Root parameter 0 is created with `InitAsConstants(sizeof(ModelConstants) / 4, …)` and set with
`SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, …)`, so both follow the struct to 32 constants by
themselves. That fits: a root signature may hold 64 32-bit values in all, and the descriptor table of root parameter
1 costs one more.

In `PopulateCommandList`, after storing the cube's model matrix, we compute the normal matrix with `XMMatrixInverse`
and `XMMatrixTranspose`:

```cpp
    // The normal matrix: the transpose of the inverse of the model matrix. It keeps the
    // normals perpendicular to the faces even when the model matrix scales unevenly.
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

The first `XMMatrixTranspose` is part of the maths – the *transpose* of the inverse. The second is the one every
matrix in this project gets before it goes to the GPU, because HLSL reads constant buffer matrices column by column
(the first argument of `XMMatrixInverse` could receive the determinant; we don't need it). The formula is the same for
DirectXMath's row vectors as for GLM's column vectors.

The lamp's draw sends the same struct; `light_cube.hlsl` declares only `model`, so its shaders ignore the second
matrix. In `VSMain` the normal is now multiplied by the normal matrix. To make sure the translation in the 4x4 matrix
has no effect, the normal gets a w of 0 – the same as taking the upper-left 3x3 part:

```hlsl
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
```
:::

Now do the task **normal-matrix**. In the previous section the lighting was fine because we didn't do any scaling on
the object, so there was not really a need to use a normal matrix and we could've just multiplied the normals with
the model matrix. Our cube's model matrix is even the identity, so this task changes **nothing** in the picture. If
you are doing a non-uniform scale however, it is essential that you multiply your normal vectors with the normal
matrix.

```quiz
Why can't we transform the normals with the model matrix itself when the model matrix scales non-uniformly?
- [x] Because a non-uniform scale tilts the surface one way and the normal another, so the transformed normal is no longer perpendicular to the surface
- [ ] Because normals must not be scaled at all, not even uniformly
- [ ] Because the model matrix would move the normals to the object's position
---
The translation is dealt with separately (the upper-left 3x3, or w = 0). The non-uniform scale is the reason for the transpose of the inverse: it scales the normal by the inverse amounts, which keeps it perpendicular.
```

## Specular Lighting

If you're not exhausted already by all the lighting talk we can start finishing the Phong lighting model by adding
specular highlights.

Similar to diffuse lighting, specular lighting is based on the light's direction vector and the object's normal
vectors, but this time it is also based on the view direction e.g. from what direction the player is looking at the
fragment. Specular lighting is based on the reflective properties of surfaces. If we think of the object's surface as a
mirror, the specular lighting is the strongest wherever we would see the light reflected on the surface.

We calculate a reflection vector by reflecting the light direction around the normal vector. Then we calculate the
angular distance between this reflection vector and the view direction. The closer the angle between them, the
greater the impact of the specular light. The resulting effect is that we see a bit of a highlight when we're looking
at the light's direction reflected via the surface.

The view vector is the one extra variable we need for specular lighting which we can calculate using the viewer's
world space position and the fragment's position. Then we calculate the specular's intensity, multiply this with the
light color and add this to the ambient and diffuse components.

> We chose to do the lighting calculations in world space, but most people tend to prefer doing lighting in view
> space. An advantage of view space is that the viewer's position is always at (0, 0, 0) so you already got the
> position of the viewer for free. However, we find calculating lighting in world space more intuitive for learning
> purposes. If you still want to calculate lighting in view space you want to transform all the relevant vectors with
> the view matrix as well (don't forget to change the normal matrix too).

To get the world space coordinates of the viewer we simply take the position vector of the camera object (which is
the viewer of course). So let's add another uniform to the fragment shader and pass the camera position vector to the
shader:

:::opengl
```glsl
uniform vec3 viewPos;
```

```cpp
        lightingShader.setVec3("viewPos", cameraPos);
```
:::
:::vulkan
In Vulkan it is the last member of the uniform block (`vec3 viewPos;` after `lightPos` in `basic_lighting.frag`) and
of the C++ struct, with its padding float:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 objectColor;
    float pad1;
    glm::vec3 lightColor;
    float pad2;
    glm::vec3 lightPos;
    float pad3;
    glm::vec3 viewPos;
    float pad4;
};
```

```cpp
        ubo.viewPos     = cameraPos;
```
:::
:::d3d12
In Direct3D 12 it is the last member of `SceneConstantBuffer` (`float3 viewPos;` after `lightPos` in
`basic_lighting.hlsl`) and of the C++ struct, with its padding float:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 objectColor;
        float padding0;
        XMFLOAT3 lightColor;
        float padding1;
        XMFLOAT3 lightPos;
        float padding2;
        XMFLOAT3 viewPos;
        float padding3;
    };
```

`cameraPos` is an `XMVECTOR`, so `OnUpdate` stores its x, y and z into the `XMFLOAT3` with `XMStoreFloat3`:

```cpp
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position
```
:::

Now that we have all the required variables we can calculate the specular intensity. First we define a specular
intensity value to give the specular highlight a medium-bright color so that it doesn't have too much of an impact:

:::opengl vulkan
```glsl
    float specularStrength = 0.5;
```
:::
:::d3d12
```hlsl
    float specularStrength = 0.5f;
```
:::

If we would set this to 1.0f we'd get a really bright specular component which is a bit too much for a coral cube. In
the next chapter we'll talk about properly setting all these lighting intensities and how they affect the objects.
Next we calculate the view direction vector and the corresponding reflect vector along the normal axis:

:::opengl
```glsl
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
```
:::
:::vulkan
```glsl
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
```
:::
:::d3d12
```hlsl
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
```
:::

Note that we negate the `lightDir` vector. The `reflect` function expects the first vector to point from the light
source towards the fragment's position, but the `lightDir` vector is currently pointing the other way around: from
the fragment towards the light source (this depends on the order of subtraction earlier on when we calculated the
`lightDir` vector). To make sure we get the correct `reflect` vector we reverse its direction by negating the
`lightDir` vector first. The second argument expects a normal vector so we supply the normalized `norm` vector.
{{shaderLanguage}}'s `reflect(i, n)` computes `i - 2 * dot(n, i) * n`.

Then what's left to do is to actually calculate the specular component. This is accomplished with the following
formula:

:::opengl
```glsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32);
    vec3 specular = specularStrength * spec * lightColor;
```
:::
:::vulkan
```glsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32);
    vec3 specular = specularStrength * spec * ubo.lightColor;
```
:::
:::d3d12
```hlsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), 32);
    float3 specular = specularStrength * spec * lightColor;
```
:::

We first calculate the dot product between the view direction and the reflect direction (and make sure it's not
negative) and then raise it to the power of 32. This 32 value is the *shininess* value of the highlight. The higher
the shininess value of an object, the more it properly reflects the light instead of scattering it all around and
thus the smaller the highlight becomes. Going through the shininess values 2, 4, 8, 16 and on to 256, the highlight
shrinks from a broad glow over much of the face to a small, sharp spot.

We don't want the specular component to be too distracting so we keep the exponent at 32. The only thing left to do
is to add it to the ambient and diffuse components and multiply the combined result with the object's color:

:::opengl
```glsl
    vec3 result = (ambient + diffuse + specular) * objectColor;
    FragColor = vec4(result, 1.0);
```
:::
:::vulkan
```glsl
    vec3 result = (ambient + diffuse + specular) * ubo.objectColor;
    outColor = vec4(result, 1.0);
```
:::
:::d3d12
```hlsl
    float3 result = (ambient + diffuse + specular) * objectColor;
    return float4(result, 1.0f);
```
:::

We now calculated all the lighting components of the Phong lighting model. Now do the task **specular**. Based on
your point of view you should see a **highlight** appear in the upper-left part of the front face: around it the
colour rises to (255, 145, 90) – brighter than coral itself, because ambient + diffuse + specular add up to more than
1 there and the colour is clamped – while the lower right of the face hardly changes.

Why there? The highlight appears where the face would mirror the lamp into the camera. The front face is the plane z =
0.5; the lamp is 1.5 units in front of it, the camera 2.5 units. The mirror point lies on the line between the lamp's
and the camera's positions in that plane, 1.5 / (1.5 + 2.5) of the way from the lamp: at about x = -0.4, y = 0.6 – in
the left half, just above the top edge of the face. So the face's brightest specular light is along its upper-left edge,
and it fades towards the lower right. From learnopengl's default camera at (0, 0, 3) with the lamp in view, you'd see
the same effect at a different spot; move the camera in your program and watch the highlight slide over the face.

```quiz
Why is `lightDir` negated in `reflect(-lightDir, norm)`?
- [ ] Because `reflect` only works with vectors that point away from the viewer
- [x] Because `lightDir` points from the fragment to the light, while `reflect` expects the incoming vector, pointing from the light to the fragment
- [ ] Because the normal points into the cube, so one of the vectors has to be flipped
---
`lightDir` was computed as `lightPos - fragPos`, towards the light. Reflecting its negation around the normal gives the direction in which the light bounces off – which we then compare with the direction to the viewer.
```

> In the earlier days of lighting shaders, developers used to implement the Phong lighting model in the vertex
> shader. The advantage of doing lighting in the vertex shader is that it is a lot more efficient since there are
> generally a lot less vertices compared to fragments, so the (expensive) lighting calculations are done less
> frequently. However, the resulting color value in the vertex shader is the resulting lighting color of that vertex
> only and the color values of the surrounding fragments are then the result of interpolated lighting colors. The
> result was that the lighting was not very realistic unless large amounts of vertices were used.
>
> When the Phong lighting model is implemented in the vertex shader it is called *Gouraud shading* instead of *Phong
> shading*. Note that due to the interpolation the lighting looks somewhat off. The Phong shading gives much smoother
> lighting results.

By now you should be starting to see just how powerful shaders are. With little information shaders are able to
calculate how lighting affects the fragment's colors for all our objects. In the next chapters we'll be delving much
deeper into what we can do with the lighting model.

## Exercises

- Right now the light source is a boring static light source that doesn't move. Try to **move the light source
  around** the scene over time using either sin or cos. Watching the lighting change over time gives you a good
  understanding of Phong's lighting model. This one is the last task of the chapter, **moving-light** (below).
- Play around with different ambient, diffuse and specular strengths and see how they impact the result. Also
  experiment with the shininess factor. Try to comprehend why certain values have a certain visual output.
- Do Phong shading in **view space** instead of world space.
- Implement **Gouraud shading** instead of Phong shading. If you did things right the lighting should look a bit off
  (especially the specular highlights) with the cube object. Try to reason why it looks so weird.

### Moving the light

learnopengl's solution moves the light along x between -1 and 3 and along y between -1 and 1, with `sin` of the
time:

:::opengl
```cpp
        // change the light's position values over time (before the light's position is used)
        lightPos.x = static_cast<float>(1.0 + sin(glfwGetTime()) * 2.0);
        lightPos.y = static_cast<float>(sin(glfwGetTime() / 2.0) * 1.0);
```

It goes at the top of the render loop's rendering part, before `lightingShader.use();` – before both the lighting
uniform `lightPos` and the lamp's model matrix use the position, so the lamp is drawn exactly where the light is.
:::
:::vulkan
```cpp
    void updateUniformBuffer() {
        // change the light's position values over time (before the light's position is used)
        lightPos.x = static_cast<float>(1.0 + std::sin(glfwGetTime()) * 2.0);
        lightPos.y = static_cast<float>(std::sin(glfwGetTime() / 2.0) * 1.0);

        UniformBufferObject ubo{};
```

It goes at the start of `updateUniformBuffer()`, before `ubo.lightPos` is set. `drawFrame()` calls
`updateUniformBuffer()` before `recordCommandBuffer()`, so the lamp's model matrix uses the same new position and the
lamp is drawn exactly where the light is.
:::
:::d3d12
`OnUpdate` needs the time since the first frame, measured with `std::chrono` as in *Camera*. It goes right after the
per-frame time logic:

```cpp
    // Move the light over time: the time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    lightPos.x = 1.0f + std::sin(time) * 2.0f;
    lightPos.y = std::sin(time / 2.0f) * 1.0f;
```

That is before `constantBufferData.lightPos` is set, and `OnUpdate` runs before `OnRender` calls
`PopulateCommandList`, so the lamp's model matrix uses the same new position and the lamp is drawn exactly where the
light is.
:::

Now do the task **moving-light**. The lamp now swings from side to side and up and down (one full swing to the side
takes 2π ≈ 6.3 seconds), and the lighting on the cube follows it: when the lamp moves to the right, the highlight slides
towards the right edge of the front face; when the lamp moves left past x = -0.5, the plane of the left face, that face
starts to catch light too. After 1 second, for example, the light is at (2.68, 0.48, 2.0) and the lamp is lower and
further right than before.

### View space and Gouraud shading

The other two exercises are not tasks, but worth trying once you've finished.

For lighting in **view space** (learnopengl's `basic_lighting_exercise2`), the vertex shader multiplies the position
by `view * model` instead of `model`, the normal by the normal matrix of `view * model`, and transforms the light's
position by the view matrix too, so that every vector the fragment shader uses is in view space. The viewer then sits
at the origin of view space, so the view direction is simply `normalize(-fragPos)` and `viewPos` isn't needed any
more. The picture stays exactly the same – the angles between the vectors don't depend on the space you measure them
in.

:::d3d12
In HLSL that means multiplying by `model` and then `view` (`mul(mul(position, model), view)`), and – since HLSL has no
`inverse` – computing the normal matrix of `model * view` in `PopulateCommandList`: `XMMatrixTranspose(XMMatrixInverse(nullptr, model * view))`.
`OnUpdate` would also have to give `PopulateCommandList` the view matrix, or send the view-space light position in
the constant buffer.
:::

For **Gouraud shading** (exercise 3), move the whole lighting calculation into the vertex shader, pass the resulting
lighting colour on instead of the position and the normal, and let the fragment shader multiply it by the object's
colour. The specular highlight then looks blocky and wrong: each face of our cube has just 4 different corner vertices
(6 vertices for its 2 triangles), so the highlight can only be computed at the corners and is interpolated linearly in
between – a highlight that falls between the corners is missed or smeared across a whole triangle.

```quiz
With Gouraud shading the highlight on our cube looks blocky or disappears. Why?
- [x] Because the lighting is only computed at the corner vertices of each face and interpolated in between, so a small highlight between the corners can't be represented
- [ ] Because the normals are not interpolated in the vertex shader
- [ ] Because the vertex shader can't use the `reflect` and `pow` functions
---
Phong shading interpolates the normal and position and lights every fragment; Gouraud shading interpolates the finished colours. With 4 corners per face, a sharp highlight in the middle of a face simply falls through the gaps.
```

You now have the complete Phong lighting model: ambient, diffuse and specular. In the next chapter we'll give
objects their own material properties, so that each one can react to light in its own way.
