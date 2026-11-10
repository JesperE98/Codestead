# PBR Lighting

In the previous chapter we laid the foundation for getting a realistic physically based renderer off the ground. In
this chapter we'll focus on translating the previously discussed theory into an actual renderer that uses direct (or
analytic) light sources: think of point lights, directional lights and/or spotlights.

Let's start by re-visiting the final reflectance equation of the previous chapter:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

We now know mostly what's going on, but what still remained a big unknown is how exactly we're going to represent
irradiance, the total radiance L, of the scene. We know that radiance L (as interpreted in computer graphics land)
measures the radiant flux Φ or light energy of a light source over a given solid angle ω. In our case we assumed the
solid angle ω to be infinitely small in which case radiance measures the flux of a light source over a single light ray
or direction vector.

Given this knowledge, how do we translate this into some of the lighting knowledge we've accumulated from previous
chapters? Well, imagine we have a single point light (a light source that shines equally bright in all directions)
with a radiant flux of (23.47, 21.31, 20.79) as translated to an RGB triplet. The radiant intensity of this light source
equals its radiant flux at all outgoing direction rays. However, when shading a specific point p on a surface, of all
possible incoming light directions over its hemisphere Ω, only one incoming direction vector ωi directly comes from the
point light source. As we only have a single light source in our scene, assumed to be at a single point in space, all
other possible incoming light directions have zero radiance observed over the surface point p.

If at first, we assume that light attenuation (dimming of light over distance) does not affect the point light source,
the radiance of the incoming light ray is the same regardless of where we position the light (excluding scaling the
radiance by the incident angle cos θ). This, because the point light has the same radiant intensity regardless of the
angle we look at it, effectively modeling its radiant intensity as its radiant flux: a constant vector
(23.47, 21.31, 20.79).

However, radiance also takes a position p as input and as any realistic point light source takes light attenuation
into account, the radiant intensity of the point light source is scaled by some measure of the distance between point
p and the light source. Then, as extracted from the original radiance equation, the result is scaled by the dot product
between the surface normal n and the incoming light direction ωi.

To put this in more practical terms: in the case of a direct point light the radiance function L measures the light
colour, attenuated over its distance to p and scaled by n · ωi, but only over the single light ray ωi that hits p,
which equals the light's direction vector from p. In code this translates to:

```glsl
vec3  lightColor  = vec3(23.47, 21.31, 20.79);
vec3  wi          = normalize(lightPos - fragPos);
float cosTheta    = max(dot(Normal, wi), 0.0);
float attenuation = calculateAttenuation(fragPos, lightPos);
vec3  radiance    = lightColor * attenuation * cosTheta;
```

Aside from the different terminology, this piece of code should be awfully familiar to you: this is exactly how we've
been doing diffuse lighting so far. When it comes to direct lighting, radiance is calculated similarly to how we've
calculated lighting before as only a single light direction vector contributes to the surface's radiance.

Note that this assumption holds as point lights are infinitely small and only a single point in space. If we were to
model a light that has area or volume, its radiance would be non-zero in more than one incoming light direction.

For other types of light sources originating from a single point we calculate radiance similarly. For instance, a
directional light source has a constant ωi without an attenuation factor. And a spotlight would not have a constant
radiant intensity, but one that is scaled by the forward direction vector of the spotlight.

This also brings us back to the integral ∫ over the surface's hemisphere Ω. As we know beforehand the single locations
of all the contributing light sources while shading a single surface point, it is not required to try and solve the
integral. We can directly take the (known) number of light sources and calculate their total irradiance, given that
each light source has only a single light direction that influences the surface's radiance. This makes PBR on direct
light sources relatively simple as we effectively only have to loop over the contributing light sources. When we later
take environment lighting into account in the IBL chapters, we do have to take the integral into account as light can
come from any direction.

## The project

The project is the one you ran at the end of the previous chapter: learnopengl's PBR lighting scene. 7 × 7 spheres of
radius 1, 2.5 units apart, at z = 0, with `metallic = row / 7` (the bottom row 0, the top row 0.857) and `roughness =
clamp(col / 7, 0.05, 1.0)` (the left column 0.05, the right column 0.857); every sphere has the albedo (0.5, 0.0, 0.0)
and an ao of 1.0. The roughness is clamped to at least 0.05 because perfectly smooth surfaces (a roughness of 0.0) tend
to look a bit off with direct light: the highlight of a point light would become an infinitely small point. Four point
lights hang at (-10, 10, 10), (10, 10, 10), (-10, -10, 10) and (10, -10, 10), each with the colour (300, 300, 300).
learnopengl also draws a small sphere at each light; with the course's camera they are outside the view, so the course
does not draw them.

A few numbers differ from learnopengl's program:

- **The camera is at (0, 0, 22)**, looking down -z with a field of view of 45°: the whole grid, about 17 units across,
  fits into the window. learnopengl's camera starts at (0, 0, 3), in the middle of the grid.
- **The sphere has 24 × 24 segments** instead of learnopengl's 64 × 64. The built-in simulator runs on the CPU and draws
  every triangle itself; a real GPU draws learnopengl's 64 × 64 spheres just as easily. With 24 segments the spheres'
  outlines are a little polygonal, the lighting is the same.
- The project has no multisampling (learnopengl asks GLFW for 4 samples), so that the three APIs give the same picture.

The sphere is learnopengl's `renderSphere()`: a *UV sphere*, whose vertices lie on a grid of 25 × 25 points in (u, v) =
(xSegment, ySegment), each turned into a point on the sphere:

```cpp
float xPos = std::cos(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
float yPos = std::cos(ySegment * PI);
float zPos = std::sin(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
```

The normal of a unit sphere is the position itself, the texture coordinates are (xSegment, ySegment). Each vertex has
one more attribute that learnopengl's sphere doesn't have: a **tangent**, `(-sin(2π · xSegment), 0, cos(2π ·
xSegment))` – the direction in which u grows on the surface (the position's derivative by u, normalized). It is there
from the start, but only the last task uses it. The indices form one long **triangle strip**: the grid's rows are
walked in a zigzag – the even ones from left to right, the odd ones back from right to left – each row contributing two
indices per column, one in the row and one in the next. 24 rows × 25 columns × 2 gives 1200 indices for the 625
vertices. In a triangle strip every index after the first two makes a triangle with the two before it, so a strip needs
about one index per triangle instead of three.

:::opengl
`renderSphere()` builds the vertex array object at the first call: 11 floats per vertex (position, normal, texture
coordinates, tangent at locations 0–3), an element buffer with the 1200 indices, and then
`glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – in OpenGL the kind of primitive is an argument of
the draw call. Before the loop `main.cpp` sets the uniforms that are the same for every sphere:

```cpp
    shader.use();
    shader.setVec3("albedo", 0.5f, 0.0f, 0.0f);
    shader.setFloat("ao", 1.0f);
```

and in the render loop `projection`, `view`, `camPos` and the lights (`"lightPositions[" + std::to_string(i) + "]"` –
each element of a uniform array has its own location), then per sphere `metallic`, `roughness`, `model` and
`normalMatrix` (`glm::transpose(glm::inverse(glm::mat3(model)))`, a `mat3` uniform, learnopengl's way).
:::
:::vulkan
`createSphere()` fills `sphereVertices` and `sphereIndices` once; they are copied through staging buffers into
`sphereVertexBuffer` and `sphereIndexBuffer`, and `renderSphere(commandBuffer)` binds both and calls
`vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(sphereIndices.size()), 1, 0, 0, 0)` with
`VK_INDEX_TYPE_UINT32`. In Vulkan the kind of primitive is part of the pipeline, not of the draw call:

```cpp
        inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP; // the sphere is one long strip (learnopengl: GL_TRIANGLE_STRIP)
```

and `rasterizer.cullMode = VK_CULL_MODE_NONE`, as learnopengl's PBR demos don't cull. The values that change per sphere
are push constants, recorded in `recordCommandBuffer()` with learnopengl's two loops:

```cpp
struct PushConstants {
    glm::mat4 model;
    float metallic;
    float roughness;
};
```

72 bytes, for the vertex and the fragment stage (`vkCmdPushConstants` with `VK_SHADER_STAGE_VERTEX_BIT |
VK_SHADER_STAGE_FRAGMENT_BIT`). learnopengl passes a `normalMatrix` uniform; here `pbr.vert` computes
`transpose(inverse(mat3(pc.model)))` itself, as in the earlier chapters. Everything that is the same for all spheres is
in the uniform buffer:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 albedo;
    float ao;
    glm::vec3 camPos;
    float pad1;
};
```

std140 puts the elements of an array 16 bytes apart, so the light positions and colours are `vec4`s of which the shader
uses `.xyz` / `.rgb`. A `vec3` takes 16 bytes as well; `ao` fits into the 4 bytes after `albedo`, and `pad1` fills those
after `camPos`.
:::
:::d3d12
`LoadAssets` builds `std::vector<Vertex> vertices` and `std::vector<UINT> indices` with learnopengl's loops and copies
them into `m_sphereVertexBuffer` and `m_sphereIndexBuffer`. The input layout is POSITION / NORMAL / TEXCOORD / TANGENT
at the byte offsets 0, 12, 24, 32. One value differs from learnopengl's: the texture coordinate is **(xSegment, 1 -
ySegment)**, because the images are not flipped when they are loaded – Direct3D's v = 0 is an image's first (top) row,
OpenGL's the bottom one, so OpenGL flips the images instead. Both then sample the same texel at every point of the
sphere. `RenderSphere()` draws it:

```cpp
void D3D12App::RenderSphere()
{
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
    m_commandList->IASetVertexBuffers(0, 1, &m_sphereVertexBufferView);
    m_commandList->IASetIndexBuffer(&m_sphereIndexBufferView);
    m_commandList->DrawIndexedInstanced(m_indexCount, 1, 0, 0, 0);
}
```

The pipeline state needs no change for a strip: its `PrimitiveTopologyType` is `D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE`
for lists and strips alike; which of them is drawn is chosen in the command list with `IASetPrimitiveTopology`. Nothing
is culled (`D3D12_CULL_MODE_NONE`). Per sphere, `RenderScene()` sends 38 root constants (root parameter 0, `cbuffer
ModelConstants : register(b0)`):

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;    // transpose(inverse(model)), for the normals
        // material parameters
        XMFLOAT3 albedo;
        float metallic;
        float roughness;
        float ao;
    };
```

`albedo` and `metallic` share one 16-byte row, in HLSL and in the C++ struct alike. The normal matrix is
`XMMatrixInverse(nullptr, model)`: stored transposed for HLSL, as every matrix, the transpose of the inverse becomes the
inverse itself. The constant buffer (b1) holds `view`, `projection`, `XMFLOAT4 lightPositions[4]`, `XMFLOAT4
lightColors[4]` and `camPos` – `float4`s, because every element of an HLSL array in a constant buffer starts a new
16-byte row; the shader uses `.xyz` / `.rgb`.
:::

```quiz
The lights have the colour (300, 300, 300) – far more than the 1.0 of the earlier chapters. Why doesn't every sphere turn white?
- [ ] Because the shader divides every light colour by 255
- [ ] Because only one of the four lights is used per sphere
- [x] Because the radiance falls with the inverse square of the distance: a light at (-10, 10, 10) is about 17.3 units from the centre of the grid, and 1 / 17.3² ≈ 1/300 brings it back to about 1.0
- [ ] Because the window can store values up to 300
---
`attenuation = 1.0 / (distance * distance)` is the physically correct fall-off of a point light (and the right one in linear space, as the Gamma Correction chapter showed). With realistic attenuation a light's strength has to be realistic too.
```

:::opengl
```quiz
The sphere's indices form one triangle strip. Where does the OpenGL project say that they are to be read as a strip and not as a list of triangles?
- [ ] In the vertex array object, with `glVertexAttribPointer`
- [x] In the draw call itself: `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – the same buffers drawn with `GL_TRIANGLES` would give scattered wrong triangles
- [ ] In `pbr.vs`, with a `layout (triangle_strip)` qualifier
- [ ] Nowhere: OpenGL recognises a strip from the order of the indices
---
In OpenGL the primitive type is an argument of every draw call, so one VAO could even be drawn both ways. A strip of n indices gives n − 2 triangles, each made of an index and the two before it.
```
:::
:::vulkan
```quiz
The sphere's indices form one triangle strip. Where does the Vulkan project say that they are to be read as a strip and not as a list of triangles?
- [ ] In `vkCmdDrawIndexed`, whose last argument is the topology
- [ ] In the index buffer's usage flags, `VK_BUFFER_USAGE_INDEX_BUFFER_BIT`
- [ ] In `pbr.vert`, with a `layout(triangle_strip)` qualifier
- [x] In the pipeline: `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` – a pipeline is made for one kind of primitive, so drawing a triangle list would need a second pipeline
---
The input assembly state is baked into the pipeline. (The IBL chapters need exactly that: the spheres are a strip, the cube is a list, so `createPipeline` gets a topology parameter.)
```
:::
:::d3d12
```quiz
The sphere's indices form one triangle strip. Where does the Direct3D 12 project say that they are to be read as a strip and not as a list of triangles?
- [ ] Only in the pipeline state: `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE` means a strip
- [ ] In the index buffer view's `Format`, `DXGI_FORMAT_R32_UINT`
- [x] In the command list: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)` before the draw; the pipeline state only says "triangles", which covers lists and strips alike
- [ ] In `VSMain`, with the `SV_PrimitiveID` semantic
---
The pipeline state fixes the type of primitive (point, line, triangle, patch) the shaders are made for; whether triangles come as a list or a strip is command-list state and can change between draws with the same pipeline state.
```
:::

The `// TODO:` comments in the project mark where your code goes. Each task is one step of learnopengl's shader, and
**Build & run** (Ctrl+Enter) shows after each one how the spheres change.

## A PBR surface model

Let's start by writing a fragment shader that implements the previously described PBR models. First, we need to take
the relevant PBR inputs required for shading the surface:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;
in vec3 Normal;

// material parameters
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

// lights
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];

uniform vec3 camPos;
```

We take the standard inputs as calculated from a generic vertex shader and a set of constant material properties over
the surface of the object. Then at the start of the fragment shader we do the usual calculations required for any
lighting algorithm:

```glsl
void main()
{
    vec3 N = normalize(Normal);
    vec3 V = normalize(camPos - WorldPos);
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    // lights
    vec4 lightPositions[4];
    vec4 lightColors[4];
    // material parameters (the same for every sphere)
    vec3 albedo;
    float ao;
    vec3 camPos;
} ubo;

// material parameters (one sphere's): they come after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    float metallic;
    float roughness;
} pc;

layout(location = 0) in vec2 fragTexCoord;
layout(location = 1) in vec3 fragWorldPos;
layout(location = 2) in vec3 fragNormal;

layout(location = 0) out vec4 outColor;
```

We take the standard inputs from the vertex shader, the material from the uniform buffer and the push constants, and
at the start of `main` copy the material into local variables – so the rest of the shader reads like learnopengl's –
and do the usual calculations required for any lighting algorithm:

```glsl
void main() {
    vec3 albedo     = ubo.albedo;
    float metallic  = pc.metallic;
    float roughness = pc.roughness;
    float ao        = ubo.ao;

    vec3 N = normalize(fragNormal);
    vec3 V = normalize(ubo.camPos - fragWorldPos);
```
:::
:::d3d12
`pbr.hlsl` declares the two cbuffers described above and the interface between the shaders:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
    float3 worldPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};
```

The material's `albedo`, `metallic`, `roughness` and `ao` come straight from the cbuffer `ModelConstants`, the lights
and `camPos` from `SceneConstantBuffer`. At the start of `PSMain` we do the usual calculations required for any lighting
algorithm:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 N = normalize(input.normal);
    float3 V = normalize(camPos - input.worldPos);
```

HLSL against learnopengl's GLSL, for the whole chapter: `vec3` → `float3`, `mix` → `lerp`, `WorldPos` →
`input.worldPos`, `lightPositions[i]` → `lightPositions[i].xyz`, `FragColor = …` → `return …`.
:::

### Direct lighting

In this chapter's example demo we have a total of 4 point lights that together represent the scene's irradiance. To
satisfy the reflectance equation we loop over each light source, calculate its individual radiance and sum its
contribution scaled by the BRDF and the light's incident angle. We can think of the loop as solving the integral ∫ over
Ω for direct light sources. First, we calculate the relevant per-light variables:

:::opengl
```glsl
    vec3 Lo = vec3(0.0);
    for(int i = 0; i < 4; ++i)
    {
        // calculate per-light radiance
        vec3 L = normalize(lightPositions[i] - WorldPos);
        float distance = length(lightPositions[i] - WorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i] * attenuation;
```
:::
:::vulkan
```glsl
    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 4; ++i) {
        // calculate per-light radiance
        vec3 L = normalize(ubo.lightPositions[i].xyz - fragWorldPos);
        float distance = length(ubo.lightPositions[i].xyz - fragWorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = ubo.lightColors[i].rgb * attenuation;
```
:::
:::d3d12
```hlsl
    float3 Lo = float3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 4; ++i)
    {
        // calculate per-light radiance
        float3 L = normalize(lightPositions[i].xyz - input.worldPos);
        float distance = length(lightPositions[i].xyz - input.worldPos);
        float attenuation = 1.0f / (distance * distance);
        float3 radiance = lightColors[i].rgb * attenuation;
```
:::

As we calculate lighting in linear space (we'll gamma correct at the end of the shader) we attenuate the light sources
by the more physically correct *inverse-square law*. While physically correct, you may still want to use the constant,
linear, quadratic attenuation equation that (while not physically correct) can offer you significantly more control
over the light's energy falloff.

We start with the simplest BRDF there is: the Lambertian diffuse alone, `albedo / π`, multiplied by the radiance and by
the light's incident angle n · ωi. The loop ends with:

:::opengl
```glsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::
:::vulkan
```glsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::
:::d3d12
```hlsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0f);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::

After the loop the shader already adds the constant ambient term `0.03 * albedo * ao` and writes the colour. Now do the
first task, **lambert**: write the light loop.

Press **Build & run**: the spheres are **matt red**, all 49 alike – metallic and roughness are not used yet. Each sphere
is brighter on the sides that face the lights, and the spheres near the corners of the grid are brighter than the one in
the middle, because they are closer to a light: the centre sphere is about 17 units from each light, a corner sphere
only about 10.6 from the nearest one. Only the red channel is lit (the albedo is pure red), and nothing is saturated.

### The normal distribution function

Then, for each light we want to calculate the full Cook-Torrance specular BRDF term. We'll build it one function at a
time, starting with the normal distribution function. It needs the halfway vector between the light and the view
direction, computed right after `L` in the loop:

:::opengl vulkan
```glsl
        vec3 H = normalize(V + L);
```
:::
:::d3d12
```hlsl
        float3 H = normalize(V + L);
```
:::

The function is the Trowbridge-Reitz GGX of the previous chapter, with the roughness squared first:

:::opengl vulkan
```glsl
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}
```
:::
:::d3d12
```hlsl
float DistributionGGX(float3 N, float3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0f);
    float NdotH2 = NdotH * NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0f) + 1.0f);
    denom = PI * denom * denom;

    return nom / denom;
}
```

The parameter `roughness` hides the cbuffer's value of the same name inside the function – just as in learnopengl's
GLSL, where it hides the uniform.
:::

To see what the NDF does on its own, the task uses it alone as the specular term for now and adds it to the diffuse
term:

:::opengl vulkan
```glsl
        // Cook-Torrance BRDF: only the normal distribution function for now
        float NDF = DistributionGGX(N, H, roughness);
        vec3 specular = vec3(NDF);
```

and `Lo += (albedo / PI + specular) * radiance * NdotL;` at the end of the loop.
:::
:::d3d12
```hlsl
        // Cook-Torrance BRDF: only the normal distribution function for now
        float NDF = DistributionGGX(N, H, roughness);
        float3 specular = float3(NDF, NDF, NDF);
```

and `Lo += (albedo / PI + specular) * radiance * NdotL;` at the end of the loop.
:::

Now do the task **ndf**. Press **Build & run**: **glaring white highlights that grow with the roughness**, the same in
every row. In the left column (roughness 0.05) each sphere has four tiny white dots – one reflection per light –, in the
middle columns they have grown into four fat white blobs, and the spheres of the right column are white all over. This
is what the NDF is: for a smooth surface it is huge where the halfway vector meets the normal and almost zero elsewhere,
for a rough one it is spread over the whole sphere. But nothing limits it yet: the specular term is not divided by the
normalization factor and there is no Fresnel factor, so the spheres reflect far more light than arrives.

```quiz
After the task ndf, the rough spheres on the right are white all over. Why?
- [x] The NDF of a rough surface is spread out, so it is large almost everywhere on the sphere; without the denominator 4 (ωo · n)(ωi · n), the geometry function and the Fresnel factor nothing keeps the reflected light below the light that arrives, and every channel clips at 1.0
- [ ] The NDF returns 1.0 for every rough surface, a mirror's value
- [ ] The halfway vector is not normalized, so N · H is larger than 1
- [ ] The roughness is squared twice, once in main.cpp and once in the shader
---
The NDF is a density of microfacet normals; on its own it is not yet a BRDF that conserves energy. The next two tasks add the rest of the Cook-Torrance term.
```

### The geometry function

The geometry function is Smith's method with Schlick-GGX, using the k for direct light, `k = (roughness + 1)² / 8`:

:::opengl vulkan
```glsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
```
:::
:::d3d12
```hlsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0f);
    float k = (r * r) / 8.0f;

    float nom   = NdotV;
    float denom = NdotV * (1.0f - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(float3 N, float3 V, float3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0f);
    float NdotL = max(dot(N, L), 0.0f);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
```
:::

In the loop, the specular term becomes the NDF times the geometry function, divided by the Cook-Torrance
normalization factor:

:::opengl vulkan
```glsl
        float G   = GeometrySmith(N, V, L, roughness);

        vec3 numerator    = vec3(NDF * G);
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero
        vec3 specular = numerator / denominator;
```
:::
:::d3d12
```hlsl
        float G   = GeometrySmith(N, V, L, roughness);

        float numerator   = NDF * G;
        float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; // + 0.0001 to prevent divide by zero
        float3 specular = numerator / denominator;
```

The division gives one float; assigning it to a `float3` copies it into the three channels.
:::

Note that we add 0.0001 to the denominator to prevent a divide by zero in case any dot product ends up 0.0. Now do the
task **geometry**. Press **Build & run**: the highlights are **smaller and dimmer on the rough spheres**, which are pink
now instead of white; the centres of the highlights on the smooth and middle spheres are still white. Every sphere still
reflects like a perfect mirror in its highlight – nothing depends on what the sphere is made of yet, so the rows still
look alike.

### The Fresnel equation

The Fresnel equation is the Fresnel-Schlick approximation, clamped so that `pow` never gets a negative base:

:::opengl vulkan
```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
```
:::
:::d3d12
```hlsl
float3 fresnelSchlick(float cosTheta, float3 F0)
{
    return F0 + (1.0f - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
```
:::

The Fresnel-Schlick approximation expects an F0 parameter which is known as the *surface reflection at zero incidence*
or how much the surface reflects if looking directly at the surface. The F0 varies per material and is tinted on metals
as we find in large material databases. In the PBR metallic workflow we make the simplifying assumption that most
dielectric surfaces look visually correct with a constant F0 of 0.04, while we do specify F0 for metallic surfaces as
then given by the albedo value. This translates to code as follows, before the loop:

:::opengl vulkan
```glsl
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);
```
:::
:::d3d12
```hlsl
    float3 F0 = float3(0.04f, 0.04f, 0.04f);
    F0 = lerp(F0, albedo, metallic);
```

(`lerp` is HLSL's `mix`.)
:::

As you can see, for non-metallic surfaces F0 is always 0.04. For metallic surfaces, we vary F0 by linearly
interpolating between the original F0 and the albedo value given the metallic property. In the loop, F is computed with
the halfway and the view vector and multiplied into the specular term. Then, as the Fresnel value directly corresponds
to kS, we can use F to denote the specular contribution of any light that hits the surface. From kS we then calculate
the ratio of refraction kD:

:::opengl vulkan
```glsl
        vec3 F    = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);

        vec3 numerator    = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero
        vec3 specular = numerator / denominator;

        // kS is equal to Fresnel
        vec3 kS = F;
        // for energy conservation, the diffuse and specular light can't
        // be above 1.0 (unless the surface emits light); to preserve this
        // relationship the diffuse component (kD) should equal 1.0 - kS.
        vec3 kD = vec3(1.0) - kS;
        // multiply kD by the inverse metalness such that only non-metals
        // have diffuse lighting, or a linear blend if partly metal (pure metals
        // have no diffuse light).
        kD *= 1.0 - metallic;
```
:::
:::d3d12
```hlsl
        float3 F  = fresnelSchlick(clamp(dot(H, V), 0.0f, 1.0f), F0);

        float3 numerator  = NDF * G * F;
        float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; // + 0.0001 to prevent divide by zero
        float3 specular = numerator / denominator;

        // kS is equal to Fresnel
        float3 kS = F;
        // for energy conservation, the diffuse and specular light can't
        // be above 1.0 (unless the surface emits light); to preserve this
        // relationship the diffuse component (kD) should equal 1.0 - kS.
        float3 kD = float3(1.0f, 1.0f, 1.0f) - kS;
        // multiply kD by the inverse metalness such that only non-metals
        // have diffuse lighting, or a linear blend if partly metal (pure metals
        // have no diffuse light).
        kD *= 1.0f - metallic;
```
:::

Seeing as kS represents the energy of light that gets reflected, the remaining ratio of light energy is the light that
gets refracted which we store as kD. Furthermore, because metallic surfaces don't refract light and thus have no
diffuse reflections we enforce this property by nullifying kD if the surface is metallic. This gives us the final data
we need to calculate each light's outgoing reflectance value:

:::opengl
```glsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;  // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::
:::vulkan
```glsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL; // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::
:::d3d12
```hlsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;  // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::

The resulting Lo value, or the outgoing radiance, is effectively the result of the reflectance equation's integral ∫
over Ω. We don't really have to try and solve the integral for all possible incoming light directions as we know
exactly the 4 incoming light directions that can influence the fragment. Because of this, we can directly loop over
these incoming light directions, e.g. the number of lights in the scene.

What's left is to add an (improvised) ambient term to the direct lighting result Lo and we have the final lit colour of
the fragment – the project already has it after the loop:

:::opengl vulkan
```glsl
    vec3 ambient = vec3(0.03) * albedo * ao;

    vec3 color = ambient + Lo;
```
:::
:::d3d12
```hlsl
    float3 ambient = float3(0.03f, 0.03f, 0.03f) * albedo * ao;

    float3 color = ambient + Lo;
```
:::

Now do the task **fresnel**. Press **Build & run**: **the rows differ now**. The bottom row (non-metal) keeps its red
diffuse colour with small white-ish highlights – a dielectric's reflection is not tinted. Towards the top (metal) the
diffuse light disappears and the highlights take the albedo's red; the top row is almost black except for its red
highlights. The picture is dark and harsh, though: the colours are linear and are cut off at 1.0.

```quiz
After the task fresnel, why are the spheres of the top rows so dark apart from their highlights?
- [ ] Because F0 = 0.04 for metals, so they reflect only 4 % of the light
- [ ] Because the geometry function shadows all microfacets of metals
- [ ] Because the lights are below the grid and only reach the bottom rows
- [x] Because `kD *= 1.0 - metallic` removes their diffuse light: metals absorb all refracted light, so a (nearly) pure metal only shows its specular reflection, tinted by F0 = albedo
---
The top row has metallic = 6/7, so only 1/7 of its diffuse light remains. Its reflections are red because F0 is mixed towards the albedo; the bottom row's highlights are white because a dielectric's F0 is the same 0.04 for every colour.
```

## Linear and HDR rendering

So far we've assumed all our lighting calculations to be in linear space and to account for this we need to gamma
correct at the end of the shader. Calculating lighting in linear space is incredibly important as PBR requires all
inputs to be linear. Not taking this into account will result in incorrect lighting. Additionally, we want light inputs
to be close to their physical equivalents such that their radiance or colour values can vary wildly over a high
spectrum of values. As a result, Lo can rapidly grow really high which then gets clamped between 0.0 and 1.0 due to the
default low dynamic range (LDR) output. We fix this by taking Lo and tone or exposure map the high dynamic range (HDR)
value correctly to LDR before gamma correction:

:::opengl
```glsl
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));
```
:::
:::vulkan
```glsl
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));
```
:::
:::d3d12
```hlsl
    color = color / (color + float3(1.0f, 1.0f, 1.0f));
    color = pow(color, 1.0f / 2.2f);
```
:::

Here we tone map the HDR colour using the Reinhard operator, preserving the high dynamic range of a possibly highly
varying irradiance, after which we gamma correct the colour. We don't have a separate framebuffer or post-processing
stage so we can directly apply both the tone mapping and gamma correction step at the end of the forward fragment
shader. The order matters: tone mapping works on the linear HDR values, and gamma correction encodes the result for the
monitor as the very last step – exactly once (the *Gamma Correction* chapter).

:::vulkan
The swap chain format is `B8G8R8A8_UNORM`, as in every chapter, so the shader gamma-corrects itself. With an `_SRGB`
swap chain format the hardware would do the `pow` instead, and the shader would have to leave it out.
:::
:::d3d12
The back buffer is `DXGI_FORMAT_R8G8B8A8_UNORM` with a `UNORM` render target view, as in every chapter, so the shader
gamma-corrects itself. With an `_SRGB` render target view the hardware would do the `pow` instead, and the shader would
have to leave it out.
:::

Taking both linear colour space and high dynamic range into account is incredibly important in a PBR pipeline. Without
these it's impossible to properly capture the high and low details of varying light intensities and your calculations
end up incorrect and thus visually unpleasing.

```quiz
The task tone-map adds `color = color / (color + 1.0)` and then `color = pow(color, 1.0/2.2)`. Why in this order, and why here?
- [ ] Gamma first, so that Reinhard works on the colours the monitor shows
- [x] Reinhard maps the unbounded linear (HDR) result into 0..1 without cutting off the highlights; gamma correction then encodes the linear result for the monitor, once, as the last step – and since there is no post-processing pass, both happen at the end of this shader
- [ ] Both are needed only because the lights are white; with coloured lights the colour could be written as it is
- [ ] The order doesn't matter: both functions are linear
---
The lighting maths needs linear values and is not bounded by 1.0. Reinhard is not linear, so it must see the linear values; gamma encoding must come after everything else, or later steps would work on encoded values.
```

## Full direct lighting PBR shader

All that's left now is to put it all together: the inputs, the BRDF's three functions, the loop with the complete
reflectance equation, the ambient term, the tone mapping and the gamma correction. Now do the task **tone-map**.

Press **Build & run**: this is learnopengl's picture. The spheres are brighter and softer, and the highlights are no
longer cut off. From bottom to top, the bottom row looks like red plastic, shiny on the left and matt on the right, with
small white highlights on the smooth ones and broad, faint sheens on the rough ones; the top row is dark red metal whose
reflections are red, sharp on the left and wide and dim on the right. Each sphere has a different look, while all share
the same albedo: the roughness and the metalness alone make the difference. The clear colour around them is not tone
mapped, so it stays the same grey.

Take a moment to compare the picture with the Blinn-Phong spheres of the earlier parts: nowhere did we tune a specular
strength or a shininess exponent. The size of a highlight follows from the roughness, its brightness from energy
conservation, and its colour from the metalness. The lights' (300, 300, 300) is a physical quantity; a light half as far
away would be four times as bright, without any constant, linear or quadratic terms to tweak.

## Textured PBR

Extending the system to now accept its surface parameters as textures instead of uniform values gives us per-fragment
control over the surface material's properties. learnopengl's second demo (`1.2.lighting_textured`) does this with its
rusted iron material; the course uses its own material: **riveted steel with patches of rust**, five 256 × 256 maps
(`albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png`). The shader reads the material at the top of
`main` instead of from the uniforms:

:::opengl
```glsl
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform sampler2D metallicMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;

void main()
{
    vec3 albedo     = pow(texture(albedoMap, TexCoords).rgb, vec3(2.2));
    float metallic  = texture(metallicMap, TexCoords).r;
    float roughness = texture(roughnessMap, TexCoords).r;
    float ao        = texture(aoMap, TexCoords).r;

    vec3 N = getNormalFromMap();
    vec3 V = normalize(camPos - WorldPos);
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D albedoMap;
layout(binding = 2) uniform sampler2D normalMap;
layout(binding = 3) uniform sampler2D metallicMap;
layout(binding = 4) uniform sampler2D roughnessMap;
layout(binding = 5) uniform sampler2D aoMap;

void main() {
    vec3 albedo     = pow(texture(albedoMap, fragTexCoord).rgb, vec3(2.2));
    float metallic  = texture(metallicMap, fragTexCoord).r;
    float roughness = texture(roughnessMap, fragTexCoord).r;
    float ao        = texture(aoMap, fragTexCoord).r;

    vec3 N = getNormalFromMap();
    vec3 V = normalize(ubo.camPos - fragWorldPos);
```
:::
:::d3d12
```hlsl
Texture2D albedoMap : register(t0);
Texture2D normalMap : register(t1);
Texture2D metallicMap : register(t2);
Texture2D roughnessMap : register(t3);
Texture2D aoMap : register(t4);
// The sampler: register s0, the static sampler of the root signature (linear, WRAP).
SamplerState wrapSampler : register(s0);

float4 PSMain(PSInput input) : SV_TARGET
{
    float3 albedo   = pow(albedoMap.Sample(wrapSampler, input.texCoords).rgb, 2.2f);
    float metallic  = metallicMap.Sample(wrapSampler, input.texCoords).r;
    float roughness = roughnessMap.Sample(wrapSampler, input.texCoords).r;
    float ao        = aoMap.Sample(wrapSampler, input.texCoords).r;

    float3 N = getNormalFromMap(input);
    float3 V = normalize(camPos - input.worldPos);
```
:::

The rest of the shader stays as it is: its `albedo`, `metallic`, `roughness` and `ao` are local variables now. Note
that the albedo textures that come from artists are generally authored in sRGB space which is why we first convert them
to linear space before using albedo in our lighting calculations. Based on the system artists use to generate ambient
occlusion maps you may also have to convert these from sRGB to linear space as well; the course's maps of metallic,
roughness and ambient occlusion are linear data, read from their red channel. Loading the albedo as an sRGB texture
would do the `pow` in the sampler instead, as in the *Gamma Correction* chapter; learnopengl converts in the shader, and
so does the course.

### The normal from the normal map

learnopengl's `getNormalFromMap()` builds the tangent space from screen-space derivatives – `dFdx` / `dFdy` of the
world position and of the texture coordinates – "to keep things simple". The course does it the *Normal Mapping*
chapter's way instead: the sphere has a tangent per vertex, the vertex shader turns it with the model matrix
(a tangent lies in the surface, so it turns with the surface, not with the normal matrix), and the fragment shader makes
the interpolated tangent perpendicular to the normal again (Gram-Schmidt) and completes the TBN matrix with the
bitangent:

:::opengl
```glsl
vec3 getNormalFromMap()
{
    vec3 tangentNormal = texture(normalMap, TexCoords).xyz * 2.0 - 1.0;

    vec3 N = normalize(Normal);
    vec3 T = normalize(Tangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}
```

`pbr.vs` gets `layout (location = 3) in vec3 aTangent;`, `out vec3 Tangent;` and `Tangent = mat3(model) * aTangent;`,
and `pbr.fs` `in vec3 Tangent;`.
:::
:::vulkan
```glsl
vec3 getNormalFromMap() {
    vec3 tangentNormal = texture(normalMap, fragTexCoord).xyz * 2.0 - 1.0;

    vec3 N = normalize(fragNormal);
    vec3 T = normalize(fragTangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}
```

`pbr.vert` gets `layout(location = 3) out vec3 fragTangent;` and `fragTangent = mat3(pc.model) * inTangent;`, and
`pbr.frag` the matching input at location 3.
:::
:::d3d12
```hlsl
float3 getNormalFromMap(PSInput input)
{
    float3 tangentNormal = normalMap.Sample(wrapSampler, input.texCoords).xyz * 2.0f - 1.0f;

    float3 N = normalize(input.normal);
    float3 T = normalize(input.tangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B points the way the image's rows go up on the sphere: the normal map's green axis
    float3 B = cross(N, T);
    // T, B and N as the rows: with the vector on the left, mul gives x * T + y * B + z * N
    // (learnopengl: mat3(T, B, N) * tangentNormal)
    float3x3 TBN = float3x3(T, B, N);

    return normalize(mul(tangentNormal, TBN));
}
```

HLSL has no global inputs, so the function takes the `PSInput`. `VSMain` gets a fourth input `float3 tangent :
TANGENT`, `PSInput` a fourth field, and `result.tangent = mul(float4(tangent, 0.0f), model).xyz;` – w = 0, as for any
direction. `float3x3(T, B, N)` has T, B and N as its *rows*, so the vector goes on the left of `mul`; that is
learnopengl's `mat3(T, B, N) * tangentNormal`, whose `mat3` has them as columns.
:::

Why not learnopengl's derivatives? They give one tangent per triangle (the derivatives are constant across a triangle),
so the lighting shows the facets of the sphere; the vertex tangent is smooth. And it works the same way in every API and
in the simulator. Why `B = cross(N, T)` and not `cross(T, N)`? T points where u grows; the normal map's green channel
means "up in the image", which is where the image's rows go up – and with the sphere's texture coordinates that is
`cross(N, T)`.

:::opengl
The images are flipped when they are loaded (`stbi_set_flip_vertically_on_load(true)` in `loadTexture`, as in every
OpenGL chapter), so v = 0 is the image's bottom row. The sphere's v is 0 at the top (y = +1), so the textures appear
turned by 180° on the sphere – turned, not mirrored, so the normal map's directions stay right.
:::
:::vulkan
The prepared `loadTexture` flips the images when they are loaded (`stbi_set_flip_vertically_on_load(true)`), so v = 0
is the image's bottom row, as in OpenGL – the sphere's texture coordinates and the normal map's green axis expect that.
The sphere's v is 0 at the top (y = +1), so the textures appear turned by 180° on the sphere – turned, not mirrored.
:::
:::d3d12
The images are not flipped; the sphere's v is `1 - ySegment` instead. Both together sample the same texel as OpenGL at
every point of the sphere, and the same world-space formulas hold. (The *Normal Mapping* chapter's quad had its v
growing down the image and flipped the normal map's y there; here the flipped v has done that already.) The textures
appear turned by 180° on the sphere, as in OpenGL.
:::

### Loading the five maps

:::opengl
`main.cpp` loads the five maps with the earlier chapters' `loadTexture` (linear `GL_RGB`, mipmaps, `GL_REPEAT`,
`GL_LINEAR_MIPMAP_LINEAR`) and gives the samplers the texture units 0 to 4:

```cpp
    shader.use();
    shader.setInt("albedoMap", 0);
    shader.setInt("normalMap", 1);
    shader.setInt("metallicMap", 2);
    shader.setInt("roughnessMap", 3);
    shader.setInt("aoMap", 4);

    // load PBR material textures
    // --------------------------
    unsigned int albedoMap    = loadTexture("albedo.png");
    unsigned int normalMap    = loadTexture("normal.png");
    unsigned int metallicMap  = loadTexture("metallic.png");
    unsigned int roughnessMap = loadTexture("roughness.png");
    unsigned int aoMap        = loadTexture("ao.png");
```

In the render loop the five textures are bound with `glActiveTexture(GL_TEXTURE0)` … `glActiveTexture(GL_TEXTURE4)`
and `glBindTexture(GL_TEXTURE_2D, …)` before the spheres; the `albedo`, `ao`, `metallic` and `roughness` uniforms go
away. The texture objects have the samplers' names (learnopengl's demo calls them `albedo`, `normal` …). At the end the
five textures are deleted with `glDeleteTextures`.
:::
:::vulkan
`main.cpp` has members for the five images, their memories and views and one `textureSampler`. After
`createCommandPool()`:

```cpp
        loadTexture("textures/albedo.png", VK_FORMAT_R8G8B8A8_UNORM, albedoImage, albedoImageMemory, albedoImageView);
        loadTexture("textures/normal.png", VK_FORMAT_R8G8B8A8_UNORM, normalImage, normalImageMemory, normalImageView);
        loadTexture("textures/metallic.png", VK_FORMAT_R8G8B8A8_UNORM, metallicImage, metallicImageMemory, metallicImageView);
        loadTexture("textures/roughness.png", VK_FORMAT_R8G8B8A8_UNORM, roughnessImage, roughnessImageMemory, roughnessImageView);
        loadTexture("textures/ao.png", VK_FORMAT_R8G8B8A8_UNORM, aoImage, aoImageMemory, aoImageView);
```

and `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE, textureSampler)`. The prepared `loadTexture` creates
each image with all its mip levels and fills them with `generateMipmaps` – `vkCmdBlitImage` from each level into the
next, vulkan-tutorial's *Generating Mipmaps* and Vulkan's counterpart of `glGenerateMipmap`; the sampler filters inside
and between the levels (`maxLod = VK_LOD_CLAMP_NONE`), like OpenGL's `GL_LINEAR_MIPMAP_LINEAR`. Without anisotropic
filtering (`VK_FALSE`) the maps are filtered exactly like OpenGL's. All five are `_UNORM`: the shader converts the albedo
itself; `VK_FORMAT_R8G8B8A8_SRGB` for the albedo would do that in the sampler instead.

The descriptor set layout gets five `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` bindings 1–5 for the fragment stage
(a loop over a `std::array<VkDescriptorSetLayoutBinding, 6>`), the pool a second pool size with five image samplers, and
`createDescriptorSet()` five more writes – a loop over the image views in binding order, `dstBinding = i + 1`.
`metallic` and `roughness` leave `PushConstants`, which keeps only `model`, and `albedo` and `ao` leave the uniform
buffer (`camPos` and `pad1` follow the lights directly). `cleanup()` destroys the sampler and the images.
:::
:::d3d12
`LoadTexture` (there since the start, unused so far) loads an image with `stbi_load` as RGBA, creates a
`DXGI_FORMAT_R8G8B8A8_UNORM` texture with **one mip level** in a default heap, copies the pixels through an upload heap
(`UpdateSubresources`), turns it into a `PIXEL_SHADER_RESOURCE` with a barrier and writes its SRV into a slot of the
CBV/SRV heap. The heap grows to 6 descriptors, and the five maps take the slots 1–5 – consecutive, so one descriptor
table covers them:

```cpp
    LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 1);
```

and the same for `normal.png` (2), `metallic.png` (3), `roughness.png` (4) and `ao.png` (5), each with its own upload
heap that lives until the end of `LoadAssets` (the copies run when the command list is executed there). The root
signature gets a second range and a third root parameter, and a static sampler:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 0);
        ...
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);
```

`samplers[0]`: `D3D12_FILTER_MIN_MAG_MIP_LINEAR`, `D3D12_TEXTURE_ADDRESS_MODE_WRAP` in u, v and w, `ShaderRegister = 0`.
In `PopulateCommandList` the table is set once per frame – all spheres share the material:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE materialTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, materialTextures);
```

`ModelConstants` shrinks to `model` and `normalMatrix` (32 values; the root constants follow `sizeof(ModelConstants) /
4`). Direct3D 12 has no `glGenerateMipmap`, so the maps have no mipmaps here; that only shows where they are minified,
by a level or two (the *Specular IBL* chapter shows how mip levels are made by hand).
:::

### Bigger spheres

The 7 × 7 small spheres would show little of the material. The task draws a **3 × 3 grid of large spheres**
instead: `nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`, each scaled by 2.4 and turned by 90° about the y axis, so that
the middle of the textures – u = 0.5, where the plates' grooves cross with four rivets around the cross – faces the
camera. (learnopengl's textured demo keeps the 7 × 7 grid and uses one light of strength 150 at (0, 0, 10); the course
keeps its four lights.)

:::opengl vulkan
```cpp
                model = glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f)); // turn the middle of the textures towards the camera
                model = glm::scale(model, glm::vec3(2.4f));
```

after the translation – the matrices apply from right to left: first scale, then rotate, then translate.
:::
:::d3d12
```cpp
            XMMATRIX model = XMMatrixScaling(2.4f, 2.4f, 2.4f)
                * XMMatrixRotationY(XMConvertToRadians(90.0f)) // turn the middle of the textures towards the camera
                * XMMatrixTranslation(
                    (float)(col - (nrColumns / 2)) * spacing,
                    (float)(row - (nrRows / 2)) * spacing,
                    0.0f);
```

With row vectors the matrices apply from left to right: scale, then rotate, then translate – learnopengl's
`translate · rotate · scale`.
:::

```quiz
The textured task reads the albedo with `pow(…, 2.2)`, but metallic, roughness and ao as they are. Why the difference?
- [x] The albedo is a colour image authored in sRGB and must be converted to linear values for the lighting maths; the other maps store data (and the normal map directions) that are already linear
- [ ] The albedo has three channels and the others one; `pow` only works on vectors
- [ ] The other maps are converted by the sampler, because they have mipmaps
- [ ] `pow(…, 2.2)` makes the albedo brighter to make up for the missing ambient light
---
Only images of colours, made by looking at a monitor, carry the monitor's curve. Converting a roughness map would change the material: a roughness of 0.5 would become about 0.22.
```

Now do the last task, **textured**. Press **Build & run**: nine large spheres of **riveted steel with rust**. Through the
middle of each sphere runs a dark cross of grooves with four dome-shaped rivets around it; the steel is grey and shiny,
with the four lights' soft white highlights, and the rust patches – mostly on the right and in the lower part of each
sphere – are matt orange-brown, without highlights: rust is rough and not a metal, so the roughness and metallic maps
switch it to a different material within the same sphere. The rivets look raised: each one is lit on the side facing a
light and dark on the other, and the grooves' far walls catch the light – the normal map's directions arrive in world
space the right way round. The ambient light is still the constant `0.03 * albedo * ao`, so the parts that no light
reaches are nearly black; the next chapters replace it with light from an environment.

## Further reading

- *Real Shading in Unreal Engine 4* by Brian Karis: the functions used here, and why the roughness is remapped.
- learnopengl's chapter suggests the Disney and Unreal papers for more on the choice of functions, and the *Theory*
  chapter's references for radiometry.

:::opengl
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengl's chapter this chapter follows, with screenshots of
  the grid of spheres and the textured material.
- [lighting.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/1.1.lighting/lighting.cpp):
  learnopengl's program, with `renderSphere()`.
- [glDrawElements](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElements.xhtml): the primitive types,
  among them `GL_TRIANGLE_STRIP`.
:::
:::vulkan
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengl's chapter this chapter follows, with screenshots of
  the grid of spheres and the textured material.
- [Fixed functions](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  vulkan-tutorial on the input assembly's topologies.
- [Generating Mipmaps](https://vulkan-tutorial.com/Generating_Mipmaps): the `generateMipmaps` the project's
  `loadTexture` uses.
:::
:::d3d12
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengl's chapter this chapter follows, with screenshots of
  the grid of spheres and the textured material.
- [D3D_PRIMITIVE_TOPOLOGY](https://learn.microsoft.com/en-us/windows/win32/api/d3dcommon/ne-d3dcommon-d3d_primitive_topology):
  the topologies `IASetPrimitiveTopology` takes, among them `D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  why the light arrays are `float4`s.
:::
