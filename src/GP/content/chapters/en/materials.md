# Materials

In the real world, each object has a different reaction to light. Steel objects are often shinier than a clay vase
for example, and a wooden container doesn't react the same to light as a steel container. Some objects reflect the
light without much scattering, resulting in small specular highlights, and others scatter a lot, giving the highlight
a larger radius. If we want to simulate several types of objects in {{api}} we have to define *material* properties
specific to each surface.

In the previous chapter we defined an object and light color to define the visual output of the object, combined
with an ambient and specular intensity component. When describing a surface we can define a material color for each
of the 3 lighting components: ambient, diffuse and specular lighting. By specifying a color for each of the
components we have fine-grained control over the color output of the surface. Now add a shininess component to those
3 colors and we have all the material properties we need:

:::opengl
```glsl
#version 330 core
struct Material {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

uniform Material material;
```

In the fragment shader we create a `struct` to store the material properties of the surface. We can also store them
as individual uniform values, but storing them as a struct keeps it more organized. We first define the layout of
the struct and then simply declare a uniform variable with the newly created struct as its type.
:::
:::vulkan
```glsl
struct Material {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
};
```

In the fragment shader we create a `struct` to store the material properties of the surface. In Vulkan every
uniform value lives in a uniform block backed by a buffer, so the material becomes a member `Material material;` of
the uniform block at binding 2 – the block that already holds the matrices and the lighting values. We could also
store the four values as individual members of the block, but a struct keeps it more organized, and the same struct
also exists in C++, with the same layout, so `updateUniformBuffer()` can fill it.
:::
:::d3d12
```hlsl
// The surface of the object: the colours it reflects under ambient, diffuse and
// specular light, and how sharp its highlight is.
struct Material
{
    float3 ambient;
    float3 diffuse;
    float3 specular;
    float shininess;
};
```

In `materials.hlsl` we create a `struct` to store the material properties of the surface. The values reach the
shader through the constant buffer at register `b1`, so the material becomes a member `Material material;` of
`cbuffer SceneConstantBuffer`. We could also store the four values as individual members of the cbuffer, but a
struct keeps it more organized, and the same struct also exists in C++, with the same layout, so `OnUpdate` can
fill it.
:::

As you can see, we define a color vector for each of the Phong lighting's components:

- The `ambient` material vector defines what color the surface reflects under ambient lighting; this is usually the
  same as the surface's color.
- The `diffuse` material vector defines the color of the surface under diffuse lighting. The diffuse color is (just
  like ambient lighting) set to the desired surface's color.
- The `specular` material vector sets the color of the specular highlight on the surface (or possibly even reflect
  a surface-specific color).
- Lastly, the `shininess` impacts the scattering/radius of the specular highlight.

With these 4 components that define an object's material we can simulate many real-world materials. learnopengl.com
shows a table of material properties for real materials such as emerald, jade, obsidian, gold or cyan plastic (taken
from a page by Frédéric Devernay), and renders a cube with each of them: emerald looks like a translucent green gem,
gold has a warm, sharp highlight, and the plastics have a dull grey-white sheen. Note that the table's shininess
values are between 0 and 1; they have to be multiplied by 128 to get the exponent our shader expects.

As you can see, by correctly specifying the material properties of a surface it seems to change the perception we
have of the object. The effects are clearly noticeable, but for the more realistic results we'll need to replace the
simple cube with something more complicated; learnopengl's *Model Loading* chapters load such shapes.

Figuring out the right material settings for an object is a difficult feat that mostly requires experimentation and
a lot of experience. It's not that uncommon to completely destroy the visual quality of an object by a misplaced
material.

```quiz
You raise the material's `shininess` from 32 to 256. What happens to the specular highlight?
- [ ] It becomes larger and brighter, because the surface reflects more light
- [x] It becomes smaller and sharper: the specular factor is raised to a higher power, so it falls off faster away from the perfect reflection
- [ ] Nothing: shininess only matters for the ambient component
---
`spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess)`. The dot product is at most 1, so a higher exponent pushes every value below 1 closer to 0: only directions very close to the reflection keep a visible highlight. A shiny surface (polished metal) has a small, tight highlight; a rough one a wide, soft one.
```

Let's try implementing such a material system in the shaders.

## Setting materials

:::opengl
This chapter's project is the result of *Basic Lighting*, with the shaders of the lit cube renamed to `materials.vs`
and `materials.fs` (`main.cpp` builds `lightingShader` from them). The moving light of that chapter's exercise is gone
again: the lamp stays at `lightPos` (1.2, 1.0, 2.0). The fragment shader still has the uniforms `objectColor`,
`lightColor`, `lightPos` and `viewPos`, and computes ambient (strength 0.1), diffuse and specular (strength 0.5,
exponent 32) lighting. The camera looks at the cube's left and front faces and at the lamp.
:::
:::vulkan
This chapter's project is the result of *Basic Lighting*, with the cube's shaders renamed to
`shaders/materials.vert` and `shaders/materials.frag` (`createPipeline("shaders/materials.vert.spv",
"shaders/materials.frag.spv", 2, lightingPipeline)`). The moving light of that chapter's exercise is gone again: the
lamp stays at `lightPos` (1.2, 1.0, 2.0). The uniform buffer at binding 2 still holds `view`, `proj`, `objectColor`,
`lightColor`, `lightPos` and `viewPos`, each `glm::vec3` followed by a padding `float` in C++. The camera looks at the
cube's left and front faces and at the lamp.
:::
:::d3d12
This chapter's project is the result of *Basic Lighting*, with the lit cube's shaders renamed to `materials.hlsl`.
The moving light of that chapter's exercise is gone again: the lamp stays at `lightPos` (1.2, 1.0, 2.0). The constant
buffer at register `b1` still holds `view`, `projection`, `objectColor`, `lightColor`, `lightPos` and `viewPos` (each
`XMFLOAT3` followed by a `float` of padding in C++), and `OnUpdate` fills it every frame. The camera looks at the
cube's left and front faces and at the lamp. `light_cube.hlsl`, the lamp's shaders, only declares the first two
matrices of the constant buffer, so nothing in this chapter changes it.
:::

There are no `// TODO:` comments this time: every task changes code that is already there, and the task text tells
you where. After each task, press **Build & run** (Ctrl+Enter) to compile the program and run it in the built-in
simulator.

We created a material struct in the fragment shader, so next we want to change the lighting calculations to comply
with the new material properties. Since all the material variables are stored in a struct we can access them from
the `material` member:

:::opengl
```glsl
void main()
{
    // ambient
    vec3 ambient = lightColor * material.ambient;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = lightColor * (diff * material.diffuse);

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    vec3 specular = lightColor * (spec * material.specular);

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```

The `objectColor` uniform is gone (`uniform Material material;` takes its place), and so are `ambientStrength` and
`specularStrength`.
:::
:::vulkan
The block loses `objectColor` and gets the material as its last member:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 lightColor;
    vec3 lightPos;
    vec3 viewPos;
    Material material;
} ubo;
```

and `main()` reads the material through `ubo`:

```glsl
void main() {
    // ambient
    vec3 ambient = ubo.lightColor * ubo.material.ambient;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.lightPos - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.lightColor * (diff * ubo.material.diffuse);

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.lightColor * (spec * ubo.material.specular);

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
```

`ambientStrength` and `specularStrength` are gone. The vertex shaders declare only the first two members of the
block (the matrices), so they don't change.
:::
:::d3d12
The cbuffer loses `objectColor` and gets the material as its last member:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 lightColor;
    float3 lightPos;
    float3 viewPos;
    Material material;
};
```

and `PSMain` reads the material's fields:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float3 ambient = lightColor * material.ambient;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(lightPos - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = lightColor * (diff * material.diffuse);

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = lightColor * (spec * material.specular);

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```

`ambientStrength` and `specularStrength` are gone.
:::

As you can see we now access all of the material struct's properties wherever we need them and this time calculate
the resulting output color with the help of the material's colors. Each of the object's material attributes is
multiplied with its respective lighting component, and the object's colour is no longer a single factor at the end.

:::opengl
We can set the material of the object in the application by setting the appropriate uniforms. A struct in GLSL
however is not special in any regard when setting uniforms; a struct only really acts as a namespace of uniform
variables. If we want to fill the struct we will have to set the individual uniforms, but prefixed with the struct's
name:

```cpp
        // material properties
        lightingShader.setVec3("material.ambient", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.diffuse", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.specular", 0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
        lightingShader.setFloat("material.shininess", 32.0f);
```

These lines go into the render loop after `viewPos`, and the `objectColor` line goes away. Every field is a uniform of
its own, with its own location: `glGetUniformLocation(ID, "material.shininess")`, which is what `setFloat` calls.
:::
:::vulkan
In C++ the material is a struct with the same fields, and the `UniformBufferObject` struct gets it as its last
member instead of `objectColor`:

```cpp
// The same layout as the Material struct in the fragment shader. A struct in a uniform block also starts at a
// multiple of 16 bytes and its size is rounded up to one; with a float after every vec3 it is 48 bytes, in C++ too.
struct Material {
    glm::vec3 ambient;
    float pad1;
    glm::vec3 diffuse;
    float pad2;
    glm::vec3 specular;
    float shininess; // fills the 4 bytes after specular
};
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 lightColor;
    float pad1;
    glm::vec3 lightPos;
    float pad2;
    glm::vec3 viewPos;
    float pad3;
    Material material;
};
```

The padding follows the *std140* layout rules of uniform blocks that you met in the previous chapters: a `vec3` starts at a
multiple of 16 bytes, like a `vec4`. Structs add two more rules: a struct also starts at a multiple of 16 bytes, and
its size is rounded up to a multiple of 16. In the shader `ambient` is at offset 0 of the struct, `diffuse` at 16,
`specular` at 32 – and `shininess`, a single `float`, fits into the 4 free bytes after `specular`, at offset 44. That
makes 48 bytes. `glm::vec3` is 12 bytes, so the C++ struct needs a padding float after `ambient` and after `diffuse`,
while `shininess` itself fills the gap after `specular`. If you get this wrong, the shader reads the values at the
wrong offsets and the colours come out shifted between the fields.

In `updateUniformBuffer()` the `objectColor` line goes away and the material is set like every other member:

```cpp
        // material properties
        ubo.material.ambient   = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.material.diffuse   = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.material.specular  = glm::vec3(0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
        ubo.material.shininess = 32.0f;
```

The whole struct is copied to the mapped uniform buffer with the `memcpy` at the end, as before. Unlike OpenGL, there
is nothing to set field by field on the GPU side: the shader simply reads the buffer at the offsets of the block.
:::
:::d3d12
In C++ the material is a struct with the same fields, declared in the class before `SceneConstantBuffer`, which gets
it as its last member instead of `objectColor`:

```cpp
    // The material: what the shaders see as struct Material. Laid out as HLSL does:
    // each float3 starts a new 16-byte row, shininess fills the row of specular.
    struct Material
    {
        XMFLOAT3 ambient;
        float padding0;
        XMFLOAT3 diffuse;
        float padding1;
        XMFLOAT3 specular;
        float shininess;
    };
```

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 lightColor;
        float padding0;
        XMFLOAT3 lightPos;
        float padding1;
        XMFLOAT3 viewPos;
        float padding2;
        Material material;
    };
```

HLSL packs a constant buffer in rows of 16 bytes (four floats) and never lets a `float3` cross from one row into the
next – the rule you met in the previous chapters. A struct member also always starts a new row. Inside `Material`,
`ambient`, `diffuse` and `specular` each take the first 12 bytes of a row, and `shininess`, a single `float`, fits
into the last 4 bytes of the row of `specular`. That makes 3 rows, 48 bytes. `XMFLOAT3` is 12 bytes, so the C++ struct
needs a `float` of padding after `ambient` and after `diffuse`, while `shininess` itself fills the row of `specular`.
If you get this wrong, the shader reads the values at the wrong offsets and the colours come out shifted between the
fields.

In `OnUpdate` the `objectColor` line goes away and the material is set like every other member:

```cpp
    // material properties
    constantBufferData.material.ambient = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.material.diffuse = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.material.specular = XMFLOAT3(0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
    constantBufferData.material.shininess = 32.0f;
```

The whole struct is copied to the mapped constant buffer with the `memcpy` at the end, as before. There is nothing to
set field by field: the shader simply reads the buffer at the offsets of the cbuffer.
:::

We set the ambient and diffuse component to the color we'd like the object to have and set the specular component of
the object to a medium-bright color; we don't want the specular component to be too strong on this specific object.
We also keep the shininess at 32.

:::opengl
```quiz
How does `main.cpp` set the `shininess` field of `uniform Material material;`?
- [ ] `lightingShader.setFloat("shininess", 32.0f);` – the struct's fields are uniforms with their own names
- [x] `lightingShader.setFloat("material.shininess", 32.0f);` – each field is a uniform of its own, named with the struct's name as prefix
- [ ] Not at all: a whole struct can only be set at once, with one `glUniform` call for all four fields
---
A uniform struct is little more than a namespace: `material.ambient`, `material.diffuse`, `material.specular` and `material.shininess` are four separate uniforms with four locations, and you set each one by its full name.
```
:::
:::vulkan
```quiz
The C++ `Material` has `pad1` after `ambient` and `pad2` after `diffuse`, but no padding after `specular`. Why?
- [ ] The last `vec3` of a struct never needs padding in std140
- [x] In std140 every `vec3` starts at a multiple of 16 bytes, and `shininess`, a single `float`, fits into the 4 free bytes after `specular` (offset 44) – in the shader and in C++
- [ ] `glm::vec3` is 16 bytes, so only the first two need extra floats
---
`glm::vec3` is 12 bytes. Without `pad1` and `pad2`, `diffuse` would start at byte 12 in C++ but at byte 16 in the shader. After `specular` (bytes 32–43) the shader puts the float `shininess` at 44, exactly where the C++ struct puts it, and the struct ends at 48, a multiple of 16.
```
:::
:::d3d12
```quiz
The C++ `Material` has `padding0` after `ambient` and `padding1` after `diffuse`, but no padding after `specular`. Why?
- [ ] HLSL never pads the last `float3` of a struct
- [x] Each `float3` takes the first 12 bytes of a 16-byte row, and `shininess`, a single `float`, fits into the last 4 bytes of the row of `specular` – in HLSL and in C++
- [ ] `XMFLOAT3` is 16 bytes, so only the first two need extra floats
---
`XMFLOAT3` is 12 bytes. Without the padding floats, `diffuse` would start at byte 12 in C++ but at the second row (byte 16) in HLSL. After `specular` (bytes 32–43) HLSL packs the float `shininess` into the same row, at byte 44, exactly where the C++ struct puts it.
```
:::

Now do the first task, **material**: add the `Material` struct, use it in the lighting instead of `objectColor`, the
two strengths and the 32, and set the coral material from the application. Then press **Build & run**.

The cube is far too bright! The light colour is still white, (1.0, 1.0, 1.0), at full strength for all three
components – and the ambient component now uses the full `material.ambient`. Before, ambient lighting was scaled by
an ambient strength of 0.1; now a face the light doesn't reach, like the cube's left face, shows the full coral
colour, and the lit front face is close to white where the diffuse and specular parts are added on top.

```quiz
After the **material** task, why is the cube's left face (which faces away from the light) bright coral instead of dark?
- [ ] The diffuse term is now computed with the material's colour, so every face gets diffuse light
- [x] The ambient term is now `lightColor * material.ambient`: white light times the full coral colour, with no 0.1 strength any more
- [ ] The normals of the left face are flipped by the material
---
The left face gets no diffuse or specular light (`diff` is 0 there), so it shows only the ambient term. With a white light at full strength, that term is the whole `material.ambient` – the full coral colour. The light's strength per component is what we need to control next.
```

## Light properties

The object is way too bright. The reason for the object being too bright is that the ambient, diffuse and specular
colors are reflected with full force from any light source. Light sources also have different intensities for their
ambient, diffuse and specular components respectively. In the previous chapter we solved this by varying the
ambient and specular intensities with a strength value. We want to do something similar, but this time by specifying
intensity vectors for each of the lighting components. If we'd visualize the light colour as (1.0, 1.0, 1.0) the
ambient intensity of (0.1, 0.1, 0.1) would make the light's ambient part 10 times weaker – exactly what the ambient
strength did before. The diffuse intensity of a light source is usually set to the exact color we'd like a light to
have, often a bright white color. The specular component is usually kept at (1.0, 1.0, 1.0), shining at full
intensity. Note that we also add the light's position to the same struct:

:::opengl
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform Light light;
```

The `Light` struct and `uniform Light light;` replace the uniforms `lightPos` and `lightColor`. A light source has a
different intensity for its ambient, diffuse and specular components. We update the fragment shader to use them:

```glsl
    vec3 ambient = light.ambient * material.ambient;
    vec3 lightDir = normalize(light.position - FragPos);
    vec3 diffuse = light.diffuse * (diff * material.diffuse);
    vec3 specular = light.specular * (spec * material.specular);
```

We then want to set the light intensities in the application:

```cpp
        lightingShader.setVec3("light.position", lightPos);
        lightingShader.setVec3("viewPos", cameraPos);

        // light properties
        lightingShader.setVec3("light.ambient", 0.2f, 0.2f, 0.2f);
        lightingShader.setVec3("light.diffuse", 0.5f, 0.5f, 0.5f); // darken diffuse light a bit
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```

The `lightColor` and `lightPos` uniforms are gone.
:::
:::vulkan
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

The light becomes a member of the block too, replacing `lightColor` and `lightPos`:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;
```

A light source has a different intensity for its ambient, diffuse and specular components. We update the fragment
shader to use them:

```glsl
    vec3 ambient = ubo.light.ambient * ubo.material.ambient;
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    vec3 diffuse = ubo.light.diffuse * (diff * ubo.material.diffuse);
    vec3 specular = ubo.light.specular * (spec * ubo.material.specular);
```

In C++ the same struct gets a padding float after each `glm::vec3` – four vec3s at offsets 0, 16, 32 and 48, and a
size of 64 bytes:

```cpp
// learnopengl's Light: a position and the strength of each light component
struct Light {
    glm::vec3 position;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    Material material;
    Light light;
};
```

`viewPos` is followed by a padding float because the next member, a struct, starts at a multiple of 16 bytes.
`Material` ends at a multiple of 16 already, so `Light` follows it directly. The whole block is now 256 bytes: the
matrices (128), `viewPos` (16), the material (48) and the light (64). We then set the light intensities in
`updateUniformBuffer()`:

```cpp
        ubo.light.position = lightPos;
        ubo.viewPos = cameraPos;

        // light properties
        ubo.light.ambient  = glm::vec3(0.2f, 0.2f, 0.2f);
        ubo.light.diffuse  = glm::vec3(0.5f, 0.5f, 0.5f); // darken diffuse light a bit
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```
:::
:::d3d12
```hlsl
// The light: where it is and how strong its ambient, diffuse and specular parts are.
struct Light
{
    float3 position;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

The light becomes a member of the cbuffer too, replacing `lightColor` and `lightPos`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};
```

A light source has a different intensity for its ambient, diffuse and specular components. We update `PSMain` to
use them:

```hlsl
    float3 ambient = light.ambient * material.ambient;
    float3 lightDir = normalize(light.position - input.fragPos);
    float3 diffuse = light.diffuse * (diff * material.diffuse);
    float3 specular = light.specular * (spec * material.specular);
```

In C++ the same struct gets a `float` of padding after each `XMFLOAT3`, since every `float3` starts a new row:

```cpp
    // The light: what the shaders see as struct Light.
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float padding0;
        Material material;
        Light light;
    };
```

`viewPos` is followed by a padding float because the next member, a struct, starts a new row. The whole buffer is
now exactly 256 bytes – the matrices (128), `viewPos` (16), the material (48) and the light (64) – so
`CalculateConstantBufferByteSize`, which rounds a constant buffer up to a multiple of 256 bytes, has nothing to add. We then set the light intensities in `OnUpdate`:

```cpp
    constantBufferData.light.position = lightPos;
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position

    // light properties
    constantBufferData.light.ambient = XMFLOAT3(0.2f, 0.2f, 0.2f);
    constantBufferData.light.diffuse = XMFLOAT3(0.5f, 0.5f, 0.5f); // darken diffuse light a bit
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

The ambient light is set to a low intensity, (0.2, 0.2, 0.2), so it doesn't dominate the object's colour; the diffuse
light is darkened a bit to (0.5, 0.5, 0.5); and the specular light shines at full intensity, (1.0, 1.0, 1.0). These
are learnopengl's values; the exact numbers are a matter of taste, as long as the ambient part stays weak.

Now do the task **light**: add the `Light` struct, let it replace `lightPos` and `lightColor`, use its intensities in
the three terms, and set them from the application. Press **Build & run**: the cube looks lit normally again, coral
with a dark left face and a whitish highlight on the front face – the highlight is white because the light's specular
colour is white, toned down by the material's specular colour of 0.5.

```quiz
With `light.ambient` = (0.2, 0.2, 0.2) and `material.ambient` = (1.0, 0.5, 0.31), what colour does a face get that only ambient light reaches?
- [ ] (1.0, 0.5, 0.31) – the material's ambient colour
- [x] (0.2, 0.1, 0.062) – the two vectors multiplied component by component
- [ ] (1.2, 0.7, 0.51) – the light's ambient part added to the material's colour
---
The lighting components multiply the light's intensity with the material's colour, component by component: 0.2 × 1.0, 0.2 × 0.5, 0.2 × 0.31. That's the left face: a fifth of the coral colour, dark but not black.
```

## Different light colors

So far we used light colors to only vary the intensity of their individual components by choosing colors that range
from white to gray to black, not affecting the actual colors of the object (only its intensity). Since we now have
easy access to the light's properties we can change their colors over time to get some really interesting effects.
Since everything is already set up in the fragment shader, changing the light's colors is easy and immediately
creates some funky effects.

As you can see, a different light color greatly influences the object's color output. Since the light color directly
influences what colors the object can reflect (as you may remember from the *Colors* chapter) it has a significant
impact on the visual output.

We can easily change the light's colors over time by changing the light's ambient and diffuse colors via `sin` and
the time:

:::opengl
```cpp
        // light properties
        glm::vec3 lightColor;
        lightColor.x = static_cast<float>(sin(glfwGetTime() * 2.0));
        lightColor.y = static_cast<float>(sin(glfwGetTime() * 0.7));
        lightColor.z = static_cast<float>(sin(glfwGetTime() * 1.3));
        glm::vec3 diffuseColor = lightColor   * glm::vec3(0.5f); // decrease the influence
        glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f); // low influence
        lightingShader.setVec3("light.ambient", ambientColor);
        lightingShader.setVec3("light.diffuse", diffuseColor);
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```
:::
:::vulkan
```cpp
        // light properties
        glm::vec3 lightColor;
        lightColor.x = static_cast<float>(std::sin(glfwGetTime() * 2.0));
        lightColor.y = static_cast<float>(std::sin(glfwGetTime() * 0.7));
        lightColor.z = static_cast<float>(std::sin(glfwGetTime() * 1.3));
        glm::vec3 diffuseColor = lightColor   * glm::vec3(0.5f); // decrease the influence
        glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f); // low influence
        ubo.light.ambient  = ambientColor;
        ubo.light.diffuse  = diffuseColor;
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```

`updateUniformBuffer()` runs every frame, so the new colours reach the shader every frame through the `memcpy`.
:::
:::d3d12
`OnUpdate` already measures the time between frames with `std::chrono`; for the colour we need the time since the
first frame, measured from a `static` start time, as in the *Camera* chapter:

```cpp
    // light properties: the colour changes over time
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    XMFLOAT3 lightColor;
    lightColor.x = std::sin(time * 2.0f);
    lightColor.y = std::sin(time * 0.7f);
    lightColor.z = std::sin(time * 1.3f);
    XMVECTOR diffuseColor = XMLoadFloat3(&lightColor) * 0.5f; // decrease the influence
    XMVECTOR ambientColor = diffuseColor * 0.2f; // low influence
    XMStoreFloat3(&constantBufferData.light.ambient, ambientColor);
    XMStoreFloat3(&constantBufferData.light.diffuse, diffuseColor);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
```

DirectXMath does its arithmetic on `XMVECTOR`s, so the colour is loaded from the `XMFLOAT3` with `XMLoadFloat3`,
scaled with the `*` operator, and stored back into the constant buffer's `XMFLOAT3`s with `XMStoreFloat3`.
:::

The three components change with different speeds, so the light runs through many different colours over time. The
diffuse colour is half of it and the ambient colour a fifth of that, as before; the specular part stays white.

Now do the task **light-color** and press **Build & run**. The cube's colour now changes over time. At one second,
for example, the light colour is about (0.91, 0.64, 0.96) and the cube is a dark red-brown. The lamp stays white: its
shader doesn't know the light colour – making it follow the light is a nice extra if you like.

```quiz
At one second the light colour is about (0.91, 0.64, 0.96), a pale purple. Why does the coral cube look red-brown and not purple?
- [ ] The specular part, which stays white, covers the purple
- [x] The light and the material are multiplied component by component: the cube reflects 1.0 of the red, but only 0.5 of the green and 0.31 of the blue
- [ ] Because `sin` returns radians, the colour is converted before it is used
---
An object only reflects what its material lets it: (0.91 × 1.0, 0.64 × 0.5, 0.96 × 0.31) ≈ (0.91, 0.32, 0.30) before the diffuse and ambient scaling – mostly red. The blue of the light is largely absorbed by the coral surface.
```

Try and experiment with several lighting and material values and see how they affect the visual output.

## Exercises

- Can you simulate some of the real-world objects by defining their respective materials like we've seen at the start
  of this chapter? Note that the table's ambient values are not the same as the diffuse values; they didn't take
  light intensities into account. To correctly set their values you'd have to set all the light intensities to
  (1.0, 1.0, 1.0) to get the same output. learnopengl's solution is a **cyan plastic** container.

This is not a task in the project: try it once you have finished the tasks, and use **Build & run** to see the
result. Replace the changing light colour with a white light at full intensity and set the cyan plastic material:

:::opengl
```cpp
        lightingShader.setVec3("light.ambient", 1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
        lightingShader.setVec3("light.diffuse", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);

        // material properties
        lightingShader.setVec3("material.ambient", 0.0f, 0.1f, 0.06f);
        lightingShader.setVec3("material.diffuse", 0.0f, 0.50980392f, 0.50980392f);
        lightingShader.setVec3("material.specular", 0.50196078f, 0.50196078f, 0.50196078f);
        lightingShader.setFloat("material.shininess", 32.0f);
```
:::
:::vulkan
```cpp
        ubo.light.ambient  = glm::vec3(1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
        ubo.light.diffuse  = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);

        // material properties
        ubo.material.ambient   = glm::vec3(0.0f, 0.1f, 0.06f);
        ubo.material.diffuse   = glm::vec3(0.0f, 0.50980392f, 0.50980392f);
        ubo.material.specular  = glm::vec3(0.50196078f, 0.50196078f, 0.50196078f);
        ubo.material.shininess = 32.0f;
```
:::
:::d3d12
```cpp
    constantBufferData.light.ambient = XMFLOAT3(1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
    constantBufferData.light.diffuse = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);

    // material properties
    constantBufferData.material.ambient = XMFLOAT3(0.0f, 0.1f, 0.06f);
    constantBufferData.material.diffuse = XMFLOAT3(0.0f, 0.50980392f, 0.50980392f);
    constantBufferData.material.specular = XMFLOAT3(0.50196078f, 0.50196078f, 0.50196078f);
    constantBufferData.material.shininess = 32.0f;
```
:::

The shininess of 32 is the table's 0.25 multiplied by 128. The result is a dark cyan cube with a grey-white,
plastic-looking highlight. Other materials from the table work the same way.

```quiz
Why does the cyan plastic exercise set all three light intensities to (1.0, 1.0, 1.0)?
- [ ] Because plastic needs more light than coral to be visible
- [x] The table's material values already include how strongly each component should show; with full-intensity light they come out unchanged
- [ ] Because the light's ambient and diffuse parts must always be equal
---
The table was made for a white light at full strength: its ambient values are already much darker than its diffuse values. Our light's 0.2 and 0.5 would scale them down a second time. With (1, 1, 1) the material alone decides the colour.
```

With materials you can now give every object its own look. In the next chapter we go one step further and give
different *parts* of the same object different materials, with textures: lighting maps.
