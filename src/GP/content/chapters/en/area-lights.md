# Area Lights

Every light in the course so far has been a point, a direction or a spot: light that comes from a single point, or
from infinitely far away. Real lights have a size. A window, a ceiling panel, a TV screen or a neon sign sends light
from a whole surface. That changes two things you can see. Shading becomes softer, because a point is lit by the parts
of the light it can see. Highlights take the light's shape: on a glossy floor, a point light gives a small round
highlight, but a rectangular lamp gives a stretched, rectangular glow. Light from an area is an integral over its
surface, and doing that integral quickly is the problem this chapter solves.

The chapter follows learnopengl's guest article *Area Lights*. It uses **Linearly Transformed Cosines** (LTC), the
method by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt (SIGGRAPH 2016). LTC lights a surface with a
polygonal light, specular part included, using a handful of vector operations and two texture lookups per light. The
program lights a wooden floor with one rectangular light, first with its diffuse part and then with its glossy
reflection. The last task places eight coloured lights in a ring. All three APIs share the shader mathematics; this
chapter shows how {{api}} gets the lookup tables and the light's corners to the shader.

## Light from a polygon

The light a surface point reflects towards the eye is an integral over all directions it receives light from. Each
direction contributes the incoming light times the BRDF times the cosine of the angle with the normal. A point light
covers exactly one direction, so the integral collapses to a single term – the lighting of every earlier chapter. A
polygonal light covers a range of directions: the integral runs over the polygon's solid angle, the area it covers on
the unit sphere around the point.

For one distribution that integral has an exact answer: the **clamped cosine** (`max(cos θ, 0)`, Lambert's diffuse
reflection). Project the polygon's corners onto the unit sphere around the point. Each edge then contributes the angle
it spans, in the direction perpendicular to the plane through the edge and the point. The sum of the edges' vectors is
the polygon's **vector form factor**. Its component along the normal is the integral of the cosine over the polygon:
the light a diffuse surface receives. This result goes back to Lambert in the 18th century, and it is exact. The trouble is the specular
part. A glossy BRDF such as GGX (the microfacet distribution of the PBR chapters) is a lobe that depends on the
roughness and the view direction, and integrating it over a polygon has no closed form. Sampling it with many rays per
pixel is too slow for real time.

## Linearly transformed cosines

The idea of LTC: start from the clamped cosine distribution and transform its directions by a 3 × 3 matrix **M**.
Directions are multiplied by M and normalised again. The result is a new distribution on the sphere, a *linearly
transformed cosine*. Scaling stretches or narrows the lobe, shearing tilts it, and with the right M it closely matches
the GGX lobe for a given roughness and view angle. The key property is this: **integrating the transformed distribution
over a polygon gives the same result as integrating the original cosine over the polygon transformed by M⁻¹**. Every
direction keeps its share of the distribution when it moves. So the shader doesn't integrate GGX at all. It multiplies
the light's corners by M⁻¹ and integrates a clamped cosine over the result, using the exact edge formula from above.

The matrices were fitted in advance, once, for a 64 × 64 grid of roughness and view angle, by the paper's authors. For
an isotropic BRDF, in a frame where the view direction lies in the plane of the normal and one tangent, the lobe is
symmetric about that plane. That leaves M⁻¹ with only five non-zero entries, and after normalising the middle one to 1,
four numbers remain: they fit in one RGBA texel. That is the first table, **LTC1**. The second table, **LTC2**, holds
per texel the BRDF's overall magnitude, split into two terms for the Fresnel factor (x and y), and a value for clipping
at the horizon (w). Both are indexed by the roughness and by `sqrt(1 - cos θ)` of the view angle.

The course includes the tables from the reference implementation of the paper, the `ltc_code` repository. They are in
`textures/ltc/ltc_matrix.hpp`, under that repository's BSD-style licence, whose notice and paper reference are at the
top of the header. learnopengl ships the same numbers. Each project copies the header unchanged next to its
`main.cpp`.

```quiz
Why can the shader evaluate a GGX-like reflection over a polygon without integrating GGX?
- [ ] It approximates the polygon by a single point at its centre and evaluates GGX there
- [ ] The GPU's texture units integrate the BRDF while sampling LTC1
- [x] A cosine transformed by a matrix M approximates the GGX lobe, and integrating it over the polygon equals integrating a plain cosine over the polygon transformed by M⁻¹ – which has an exact edge formula
- [ ] It uses Lambert's diffuse integral and scales it by the roughness
---
The fitted M⁻¹ (from LTC1) moves the polygon's corners. The integral of a clamped cosine over a polygon is exact: a sum over its edges.
```

## The project

The start draws learnopengl's scene. A floor of two triangles, 20 × 20 units, carries the wood texture of the Advanced
Lighting chapters as an sRGB texture (learnopengl uses its own concrete texture). A light, a 2 × 2 rectangle standing at
x = −8 and facing +x, is drawn in its colour, BurlyWood. The camera stands at (0, 1, 0.5) and looks along −x towards the
light. The floor's shader writes black because there is no light yet. Build and run the program: it shows the rectangle
on black; the `// TODO:` comments mark where your code goes.

The values are learnopengl's: intensity 4, roughness 0.5, a specular colour of 0.23 (converted to linear), a
two-sided light, output gamma-corrected with a power of 1/2.2. learnopengl changes the roughness, the intensity, the
sides and the light's position with keys. The course sets them once, so nothing moves. Its two-sided switch starts
with `switchTwoSided(false)`, which doesn't switch: its light is two-sided too.

## The tables as textures

Both tables become 64 × 64 textures with four 32-bit floats per texel. learnopengl creates them with the internal
format `GL_RGBA`. That format is unsized, so the driver may store 8 bits per channel and clamp every number to 0…1. The
tables need more: the entries of M⁻¹ reach far beyond 1, and the small differences between neighbouring texels matter.
The course uses a float format in every API. The sampler magnifies linearly and minifies to the nearest texel
(learnopengl's choice), and it clamps at the edges. Row 0 of each table is texture row 0 (v = 0): the tables are not
images, so they aren't flipped.

:::opengl
`loadMTexture()` and `loadLUTTexture()` (learnopengl's names) create one texture each:

```cpp
    // GL_RGBA32F: four 32-bit floats per texel (the numbers are outside 0..1, an 8-bit format would clamp them)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 64, 64, 0, GL_RGBA, GL_FLOAT, LTC1);
```

with `GL_CLAMP_TO_EDGE` on both axes and

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

LTC1 goes on texture unit 0, LTC2 on unit 1, and the floor's texture on unit 2: `shaderLTC.setInt("LTC1", 0)`,
`setInt("LTC2", 1)`, and the binds in the loop.
:::
:::vulkan
`createFloatTexture(table, …)` copies a table through a staging buffer of 64 · 64 · 4 · 4 bytes into an image:

```cpp
        createImage(64, 64, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, image, imageMemory);
```

and `loadMTexture()` / `loadLUTTexture()` (learnopengl's names) call it with `LTC1` and `LTC2`. Both use one sampler,
`ltcSampler`:

```cpp
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_NEAREST;
```

with `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`. Linear filtering of a 32-bit float format is optional in Vulkan, so
`createLTCSampler()` checks `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT` first; desktop GPUs have it. The tables go into the descriptor set at bindings 1 and 2, learnopengl's texture units 0 and 1, and the wood is
at binding 3. learnopengl keeps the floor's texture in `struct Material { sampler2D diffuse; … }`, but Vulkan can't put
a sampler in a uniform block, so the texture is `diffuseMap` at binding 3.
:::
:::d3d12
One function, `LoadLTCTexture`, does the work of learnopengl's `loadMTexture` and `loadLUTTexture`, through the
project's `CreateTexture` helper:

```cpp
    CreateTexture(table, 64, 64, DXGI_FORMAT_R32G32B32A32_FLOAT, 64 * 4 * sizeof(float), texture, uploadHeap, descriptorIndex);
```

and `LoadAssets` puts LTC1 in heap slot 1 and LTC2 in slot 2:

```cpp
    LoadLTCTexture(LTC1, m_LTC.mat1, ltcMat1UploadHeap, 1);
    LoadLTCTexture(LTC2, m_LTC.mat2, ltcMat2UploadHeap, 2);
```

The upload heaps must live until the setup command list has run. The root signature's table already spans t0…t2 in the
start, with the wood in slot 3 at t2. The tables use static sampler s0:

```cpp
        samplers[0].Filter = D3D12_FILTER_MIN_POINT_MAG_LINEAR_MIP_POINT;
```

with `D3D12_TEXTURE_ADDRESS_MODE_CLAMP`. The wood uses s1, linear and wrapping.
:::

Now do the first task, **ltc-textures**. The shader doesn't read the tables yet, so nothing changes.

```quiz
Why does the course store the LTC tables as 32-bit float textures instead of learnopengl's unsized `GL_RGBA`?
- [x] An 8-bit format clamps every value to 0…1 and keeps only 256 steps, but the tables hold matrix entries far beyond 1 and need fine precision
- [ ] Float textures are faster to sample than 8-bit ones
- [ ] 8-bit textures can't be magnified linearly
- [ ] `GL_RGBA` would flip the table upside down
---
The tables are numbers, not colours. An unsized `GL_RGBA` lets the driver pick an 8-bit normalised format, which stores 0…1 in 256 steps.
```

## The diffuse part

The shader's work happens in two functions from learnopengl, which come from the paper's reference code.
`IntegrateEdgeVec` returns one edge's contribution to the vector form factor: the angle θ between the edge's two
directions, in the direction of their cross product. The cross product's length is sin θ, so the function multiplies
it by θ / sin θ. It computes that factor with a fitted rational function instead of `acos`, which is inaccurate near
±1:

:::opengl
```glsl
    float a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
    float b = 3.4175940 + (4.1616724 + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5 * inversesqrt(max(1.0 - x * x, 1e-7)) - v;

    return cross(v1, v2) * theta_sintheta;
```
:::
:::vulkan
```glsl
    float a = 0.8543985 + (0.4965155 + 0.0145206*y)*y;
    float b = 3.4175940 + (4.1616724 + y)*y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5*inversesqrt(max(1.0 - x*x, 1e-7)) - v;

    return cross(v1, v2)*theta_sintheta;
```
:::
:::d3d12
```hlsl
    float a = 0.8543985f + (0.4965155f + 0.0145206f * y) * y;
    float b = 3.4175940f + (4.1616724f + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0f) ? v : 0.5f * rsqrt(max(1.0f - x * x, 1e-7f)) - v;

    return cross(v1, v2) * theta_sintheta;
```
:::

Here `x` is `dot(v1, v2)`, the cosine of the angle, and `y` is its absolute value.

`LTC_Evaluate(N, V, P, Minv, points, twoSided)` integrates over the light's polygon. First it builds a frame around the
normal: `T1` is the view direction projected into the surface's plane, and `T2 = cross(N, T1)`. The tables were
fitted in this frame. Then it applies M⁻¹ to the light's corners, relative to the shaded point:

:::opengl vulkan
```glsl
    // rotate area light in (T1, T2, N) basis
    Minv = Minv * transpose(mat3(T1, T2, N));
```

```glsl
    L[0] = Minv * (points[0] - P);
```

and the same for the other three corners.
:::
:::d3d12
```hlsl
    Minv = mul(Minv, float3x3(T1, T2, N));
```

```hlsl
    L[0] = mul(Minv, points[0].xyz - P);
```

and the same for the other three corners. GLSL's `mat3(a, b, c)` takes **columns**, HLSL's `float3x3(a, b, c)`
**rows**. learnopengl's `transpose(mat3(T1, T2, N))` is therefore simply `float3x3(T1, T2, N)`: a matrix whose rows are
the frame's axes, which turns world directions into the frame. `Minv * v` becomes `mul(Minv, v)`, a column vector on
the right as in GLSL.
:::

The transformed corners are normalised, which projects them onto the unit sphere, and the four edges are summed:

:::opengl vulkan
```glsl
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);
```
:::
:::d3d12
```hlsl
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);
```
:::

`vsum` is the vector form factor. If the polygon lies entirely above the surface, its z component (along the normal)
is the answer. A polygon that dips below the horizon would have to be clipped first, which is expensive in a shader.
Instead, the code treats the light as a sphere with the same vector form factor. Its length `len` and its elevation
`z` locate that sphere, and the value of the horizon-clipped sphere was tabulated in `LTC2.w`. The lookup coordinates
are `(z * 0.5 + 0.5, len)`, and the result is `len * scale`. The code also checks which side of the light's plane the
point lies on. The light's normal comes from the order of its corners, and a one-sided light gives 0 on one side. All
lights in this program are two-sided.

The lookups use `LUT_SCALE = (64 − 1) / 64` and `LUT_BIAS = 0.5 / 64`. They map 0…1 onto the centres of the first and
the last texel, so that the ends of each parameter's range land exactly on the table's first and last entries.

The diffuse part needs no table for M⁻¹: Lambert's reflection *is* the clamped cosine, so M⁻¹ is the identity matrix.

:::opengl
```glsl
    vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), areaLight.points, areaLight.twoSided);

    result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);
```
:::
:::vulkan
```glsl
    vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), points, ubo.areaLight.twoSided);

    result = ubo.areaLight.color * ubo.areaLight.intensity * (mDiffuse * diffuse);
```

`points` is a `vec3 points[4]` copied from `ubo.areaLight.points[k].xyz`: the uniform block stores the corners as
`vec4`, explained below.
:::
:::d3d12
```hlsl
    float3x3 identity = float3x3(1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f);
```

```hlsl
    float3 diffuse = LTC_Evaluate(N, V, P, identity, areaLight.points, areaLight.twoSided);

    result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);
```
:::

`mDiffuse` is the wood's colour. The texture is sRGB, so sampling it already returns linear values. The shader
converts the result to sRGB with `ToSRGB` before it writes it.

Now do the second task, **diffuse**. Build and run: the floor lights up in the light's warm colour. It is brightest
just in front of the light and fades towards the camera, and the wood's boards are visible.

```quiz
`LTC_Evaluate` is called with the identity matrix for the diffuse part. Why does that give Lambert's diffuse light?
- [ ] The identity matrix turns the polygon into a point light at its centre
- [ ] It doesn't: the identity matrix gives the specular part at roughness 0
- [ ] The LTC2 table converts the result to diffuse light
- [x] With M⁻¹ = I the polygon is left as it is, and its integral over the clamped cosine – which is exactly Lambert's reflection – is computed by the edge formula
---
LTC is a cosine transformed by M. Without a transformation it is the cosine itself: the diffuse lobe.
```

## The specular part

For the glossy part, the shader looks up M⁻¹ in LTC1. The coordinates are the roughness (from
`material.albedoRoughness.w`) and `sqrt(1 − dot(N, V))`, and the four numbers it reads become a 3 × 3 matrix:

:::opengl vulkan
```glsl
    mat3 Minv = mat3(
        vec3(t1.x, 0, t1.y),
```

with `vec3(0, 1, 0)` as the second column and `vec3(t1.z, 0, t1.w)` as the third.
:::
:::d3d12
```hlsl
    float3x3 Minv = float3x3(
        float3(t1.x, 0.0f, t1.z),
        float3(0.0f, 1.0f, 0.0f),
        float3(t1.y, 0.0f, t1.w)
    );
```

These are the same numbers as learnopengl's `mat3(vec3(t1.x, 0, t1.y), …)`, written as rows instead of columns, so
`t1.y` and `t1.z` swap places.
:::

`LTC_Evaluate` with this matrix gives the polygon's integral over the transformed cosine. The fit normalises the lobe
to an integral of 1, so the specular result is then scaled by the BRDF's real magnitude, including Fresnel (Schlick's
approximation split into two tabulated terms):

:::opengl
```glsl
    specular *= mSpecular * t2.x + (1.0f - mSpecular) * t2.y;
```
:::
:::vulkan
```glsl
    specular *= mSpecular*t2.x + (1.0f - mSpecular) * t2.y;
```
:::
:::d3d12
```hlsl
    specular *= mSpecular * t2.x + (1.0f - mSpecular) * t2.y;
```
:::

where `t2` is the LTC2 texel at the same coordinates and `mSpecular` is the specular colour at normal incidence, F0.
The result is `color * intensity * (specular + mDiffuse * diffuse)`.

Now do the third task, **specular**. Build and run: a soft, stretched reflection of the light appears on the floor
between the light and the camera. It is blurred and whitish at roughness 0.5, and its shape follows the rectangle.
That is the effect a point light can't give.

```quiz
Which two values select the texel of LTC1 and LTC2 that the specular part uses?
- [ ] The light's intensity and its distance from the point
- [x] The surface's roughness and the view angle (as `sqrt(1 − cos θ)`)
- [ ] The texture coordinates of the floor
- [ ] The light's colour and the specular colour
---
The fitted lobe depends only on how rough the surface is and how steeply it is seen. The light's position comes in later, through the corners that M⁻¹ transforms.
```

## Several lights

learnopengl's second program fills the scene with lights. Each light is a struct with an offset, a rotation about y, a
colour, an intensity of 2 and a two-sided flag. Its model matrix, `translate(offset) * rotate(yRotation, y)`, moves the
same base rectangle into place: its four corners, multiplied by the matrix, are that light's polygon. The shader gets an
array of lights and their number and adds up every light's diffuse and specular part. The lookups `uv`, `t1`, `t2` and
`Minv` stay outside the loop, because they don't depend on the light. Each rectangle is drawn in its own colour.

learnopengl places 16 lights at random, with a time seed. The course uses a fixed table of **8 lights**, so that every
run and every API shows the same picture. The offset is 0, the rotation is 45° · i, and each colour is chosen to be
easy to tell apart. Rotating the rectangle at x = −8 about the y axis puts the lights on a ring of radius 8, each
facing the middle. The camera moves to learnopengl's view of the multi-light scene, (−0.22, 10.4, −18.9), with yaw 89.4
and pitch −34.3: above and behind the ring, looking down.

:::opengl
learnopengl's shader renames the struct to `AreaLight` and declares an array of 32, of which the program uses 8:

```glsl
uniform AreaLight areaLights[32];
uniform int numAreaLights;
```

In C++, each light's corners are computed once and set by name:

```cpp
        std::string str_pos = "areaLights[" + std::to_string(i) + "].points";
```

```cpp
        shaderLTC.setVec3(str_pos + "[0]", p0);
```

and the same for the colour, the intensity and `twoSided`. Each member of each array element is a uniform of its own,
with its own location. That is why OpenGL needs no thought about memory layout here.
:::
:::vulkan
The lights live in the uniform block, and std140 has rules for their layout. learnopengl's struct

```glsl
struct Light {
    float intensity;
    vec3 color;
    vec4 points[4];
    bool twoSided;
};
```

is laid out like this in std140. `intensity` is at offset 0. A `vec3` is aligned like a `vec4`, so `color` starts at 16.
Every element of an array starts on a 16-byte boundary, so the corners would take 16 bytes each even as `vec3`s, and
the shader declares them as `vec4` (`.xyz` used). A `bool` takes 4 bytes. The whole struct rounds up to a multiple of
16, which makes 112 bytes. The C++ mirror spells the padding out:

```cpp
struct Light {
    float intensity;
    float pad1[3];
    glm::vec3 color;
    float pad2;
    glm::vec4 points[4];
    VkBool32 twoSided;
    float pad3[3];
};
```

The block gets `Light areaLights[32]; int numAreaLights;`. The shader keeps the struct name `Light`, because
`AreaLight` is the C++ table that places the lights. `updateUniformBuffer()` computes the corners every frame, because
the buffer is rewritten each frame anyway:

```cpp
            ubo.areaLights[i].points[0] = model * glm::vec4(vertices[6].pos, 1.0f);
```

`recordCommandBuffer()` draws the eight rectangles, with each one's model matrix and colour as push constants.
:::
:::d3d12
The lights live in the constant buffer, and HLSL has its own packing rules. In learnopengl's struct

```hlsl
struct Light
{
    float intensity;
    float3 color;
    float4 points[4];
    bool twoSided;
};
```

`intensity` and `color` share one 16-byte row: a `float3` may follow a `float` as long as it doesn't cross a row
boundary. Every element of a cbuffer array starts a new row, so the corners take 16 bytes each, and they are `float4`s
(`.xyz` used). A `bool` takes 4 bytes. A struct in a cbuffer array fills whole rows, so the C++ mirror is padded to 96
bytes:

```cpp
    struct Light
    {
        float intensity;
        XMFLOAT3 color;
        XMFLOAT4 points[4];
        BOOL twoSided;
        float padding[3];
    };
```

The constant buffer gets `int numAreaLights` right after `viewPosition`, where it fills the row's last 4 bytes, and
`Light areaLights[32]` at the end. The shader keeps the struct name `Light`, because `AreaLight` is the C++ table that
places the lights. `OnUpdate` computes the corners every frame. The model matrix is in DirectXMath's row-vector order,
rotation first:

```cpp
        XMMATRIX model = XMMatrixRotationY(areaLights[i].yRotation) * XMMatrixTranslation(areaLights[i].offset.x, areaLights[i].offset.y, areaLights[i].offset.z);
```

`PopulateCommandList` draws the eight rectangles, with each one's model matrix and colour as root constants.
:::

:::opengl
```quiz
The shader declares `uniform AreaLight areaLights[32]`, but the program sets only 8 lights. What happens to the other 24?
- [x] Nothing: they keep their default values (zero), and the loop stops at `numAreaLights`, so they are never read
- [ ] The driver fails to link the program, because 24 uniforms are never set
- [ ] They repeat the first 8 lights
- [ ] Each of them adds a black light that still costs a full `LTC_Evaluate`
---
Uniforms that are never set stay zero. Only the loop bound decides how many lights are evaluated, so the array size is just a maximum.
```
:::
:::vulkan
```quiz
At which byte offset does `color` start in std140's layout of `struct Light { float intensity; vec3 color; vec4 points[4]; bool twoSided; }`?
- [x] 16: a `vec3` is aligned to 16 bytes, so 12 bytes of padding follow `intensity`
- [ ] 4: right after `intensity`
- [ ] 8: a `vec3` is aligned to 8 bytes
- [ ] 12: three floats after the start
---
That is why the C++ struct has `float pad1[3]` after `intensity`. HLSL's cbuffer packing would put `color` at 4, in the same row as `intensity`.
```
:::
:::d3d12
```quiz
At which byte offset does `color` start in a cbuffer's layout of `struct Light { float intensity; float3 color; float4 points[4]; bool twoSided; }`?
- [x] 4: a `float3` may share the 16-byte row with `intensity`, because it doesn't cross the row's end
- [ ] 16: a `float3` always starts a new row
- [ ] 8: a `float3` is aligned to 8 bytes
- [ ] 12: three floats after the start
---
That is why the C++ struct has `XMFLOAT3 color` right after `float intensity`. GLSL's std140 would put `color` at 16 instead.
```
:::

Now do the last task, **multiple-lights**. Build and run: a ring of eight coloured lights stands on the floor. Each
light colours the boards in front of it, and their glossy reflections stretch towards the camera.

```quiz
Why do `uv`, `t1`, `t2` and `Minv` stay outside the loop over the lights?
- [ ] Because GLSL and HLSL don't allow texture lookups inside loops
- [x] They depend only on the surface point – its roughness and the view angle – not on the light, so one lookup serves every light
- [ ] Each light needs its own LTC tables, which are bound after the loop
- [ ] To make the lights brighter: lookups outside the loop are not filtered
---
Per light, only the polygon changes: `LTC_Evaluate` runs twice per light with the same two matrices.
```

## Going further

- **Textured lights.** A TV screen or stained glass isn't a single colour. The LTC paper shows how to light with a
  texture on the polygon: it looks up a prefiltered version of the texture in the direction of `vsum`, blurred more for
  rougher surfaces.
- **Other shapes.** LTC works with any polygon, so triangles or more corners only add edges. A later paper extends LTC to
  disks and lines (tube lights).
- **Shadows.** LTC has no visibility term: the floor here can't be shadowed, and an object between a light and a
  surface would not block it. Soft shadows from area lights need other techniques, such as soft shadow maps or
  ray tracing.
- **Engines.** LTC has become a common way to render area lights in real-time engines.

## Additional resources

- [Area Lights](https://learnopengl.com/Guest-Articles/2022/Area-Lights): learnopengl's guest article this chapter
  follows.
- [area_lights.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/7.area_lights/1.area_light/area_lights.cpp)
  and [multiple_area_lights.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/7.area_lights/2.multiple_area_lights/multiple_area_lights.cpp):
  learnopengl's two programs.

:::opengl
- [Uniform (GLSL)](https://www.khronos.org/opengl/wiki/Uniform_(GLSL)): uniforms of structs and arrays and their
  names.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): sized and unsized internal
  formats.
:::
:::vulkan
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): std140, std430 and the
  alignment rules.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): which format features, such as linear
  filtering, a format guarantees.
:::
:::d3d12
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  how HLSL lays out a cbuffer.
- [Matrix ordering](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-per-component-math#matrix-ordering):
  rows, columns and `mul`.
:::
