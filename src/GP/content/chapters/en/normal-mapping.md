# Normal Mapping

All of our scenes are filled with meshes, each consisting of hundreds or maybe thousands of triangles. We boosted the
realism by wrapping 2D textures on these flat triangles, hiding the fact that the polygons are just tiny flat
triangles. Textures help, but when you take a good close look at the meshes it is still quite easy to see the
underlying flat surfaces. Most real-life surfaces aren't flat however and exhibit a lot of (bumpy) details.

For instance, take a brick surface. A brick surface is quite a rough surface and obviously not completely flat: it
contains sunken cement stripes and a lot of detailed little holes and cracks. If we were to view such a brick surface
in a lit scene the immersion gets easily broken. The lighting doesn't take any of the small cracks and holes into
account and completely ignores the deep stripes between the bricks; the surface looks perfectly flat.

We can partly fix the flat look by using a specular map to pretend some surfaces are less lit due to depth or other
details, but that's more of a hack than a real solution. What we need is some way to inform the lighting system about
all the little depth-like details of the surface.

If we think about this from a light's perspective: how comes the surface is lit as a completely flat surface? The
answer is the surface's normal vector. From the lighting technique's point of view, the only way it determines the shape
of an object is by its perpendicular normal vector. The brick surface only has a single normal vector, and as a result
the surface is uniformly lit based on this normal vector's direction. What if we, instead of a per-surface normal that
is the same for each fragment, use a per-fragment normal that is different for each fragment? This way we can slightly
deviate the normal vector based on a surface's little details; this gives the illusion the surface is a lot more
complex. This technique to use per-fragment normals compared to per-surface normals is called *normal mapping* or bump
mapping. Like everything in this part, it is the same in every API: only shaders and vertex data change. Where the
APIs differ is the direction of the texture's v axis – and that matters here, as you'll see.

:::opengl
The project is learnopengl's: a 2 × 2 quad facing +z, built by `renderQuad()` from the positions `pos1`…`pos4`
((-1, 1), (-1, -1), (1, -1), (1, 1)), the texture coordinates `uv1`…`uv4` ((0, 1), (0, 0), (1, 0), (1, 1)) and the normal
`nm` (0, 0, 1), as two triangles 1-2-3 and 1-3-4 – for now 8 floats per vertex: position, normal, texture coordinates.
It is rotated by a fixed -30° about normalize(1, 0, 1) (learnopengl turns it with time, `glfwGetTime() * -10.0`
degrees). The colour texture is `brickwall.png`, loaded with `loadTexture` (flipped on load, `GL_REPEAT`, mipmaps), on
texture unit 0. The light is at `lightPos` (0.5, 1.0, 0.3), the camera at (0, 0, 3). `normal_mapping.vs` passes
`FragPos`, `Normal` (with the normal matrix) and `TexCoords`; `normal_mapping.fs` lights with learnopengl's values:
ambient `0.1 * color`, diffuse, and Blinn-Phong specular `vec3(0.2) * pow(…, 32.0)`. (learnopengl also draws a small
copy of the quad at the light's position as a marker; the course leaves it out.)
:::
:::vulkan
The project is learnopengl's: a 2 × 2 quad facing +z, built by `createQuadVertices()` (learnopengl's `renderQuad()`,
called before `createVertexBuffer()`; it fills the member `std::vector<Vertex> vertices`, as vulkan-tutorial's
`loadModel()` does) from the positions `pos1`…`pos4` ((-1, 1), (-1, -1), (1, -1), (1, 1)), the texture coordinates
`uv1`…`uv4` ((0, 1), (0, 0), (1, 0), (1, 1)) and the normal `nm` (0, 0, 1), as two triangles 1-2-3 and 1-3-4 – for now
`{pos1, nm, uv1}` and so on. The push constants carry its model matrix, a fixed -30° rotation about normalize(1, 0, 1)
(learnopengl turns it with time). The colour texture is `textures/brickwall.png` at binding 1. The light is at
`lightPos` (0.5, 1.0, 0.3), the camera at (0, 0, 3). `normal_mapping.vert` passes `fragPos`, `normal` (with the normal
matrix) and `texCoord`; `normal_mapping.frag` lights with learnopengl's values: ambient `0.1 * color`, diffuse, and
Blinn-Phong specular `vec3(0.2) * pow(…, 32.0)`. (learnopengl also draws a small copy of the quad at the light's position
as a marker; the course leaves it out.)
:::
:::d3d12
The project is learnopengl's: a 2 × 2 quad facing +z, built in `LoadAssets` from the positions `pos1`…`pos4`
((-1, 1), (-1, -1), (1, -1), (1, 1)), the normal `nm` (0, 0, 1) and the texture coordinates `uv1`…`uv4` – (0, 0), (0, 1),
(1, 1), (1, 0): learnopengl's with v flipped, because Direct3D's v = 0 is the image's top row – as two triangles 1-2-3
and 1-3-4. For now a `Vertex` is position, normal and texture coordinates (8 floats). The root constants carry its model
matrix, a fixed -30° rotation about normalize(1, 0, 1) (learnopengl turns it with time), and its normal matrix. The
colour texture is `brickwall.png` (t0), loaded by `LoadTexture` as `R8G8B8A8_UNORM`. The light is at `lightPos`
(0.5, 1.0, 0.3), the camera at (0, 0, 3). `normal_mapping.hlsl`'s `VSMain` passes `fragPos`, `normal` (with the normal
matrix) and `texCoords`; `PSMain` lights with learnopengl's values: ambient `0.1f * color`, diffuse, and Blinn-Phong
specular `float3(0.2f, 0.2f, 0.2f) * pow(…, 32.0f)`. (learnopengl also draws a small copy of the quad at the light's
position as a marker; the course leaves it out.)
:::

Build and run the program: a brick wall, turned at an angle – its bottom corner reaches below the window – with a
highlight in its upper right. It is lit evenly – the bricks and the light mortar lines between them look painted on a
flat board. The `// TODO:` comments in the project mark where your code goes.

## Normal mapping

To get normal mapping to work we're going to need a per-fragment normal. Similar to what we did with diffuse and
specular maps we can use a 2D texture to store per-fragment normal data. This way we can sample a 2D texture to get a
normal vector for that specific fragment.

While normal vectors are geometric entities and textures are generally only used for colour information, storing
normal vectors in a texture may not be immediately obvious. If you think about colour vectors in a texture they are
represented as a 3D vector with an r, g, and b component. We can similarly store a normal vector's x, y and z component
in the respective colour components. Normal vectors range between -1 and 1 so they're first mapped to [0,1]: each
component is stored as `normal * 0.5 + 0.5`.

With normal vectors transformed to an RGB colour component like this, we can store a per-fragment normal derived from
the shape of a surface onto a 2D texture. That is `brickwall_normal.png`, the normal map of our brick wall. Open it if
you like: it is mostly bluish. This is because the normals are all closely pointing outwards towards the positive
z-axis (0, 0, 1): a blue-ish colour. The deviations in colour represent normal vectors that are slightly offset from
the general positive z direction, giving a sense of depth to the texture. For example, you can see that at the top of
each brick the colour tends to be more greenish, which makes sense as the top side of a brick would have normals
pointing more in the positive y direction (0, 1, 0) which happens to be the colour green.

One more thing about the texture itself: it holds directions, not colours, so it must be read exactly as stored – not
as an sRGB texture, which the hardware would convert. The project loads it like the colour texture, linear.

```quiz
Why does a normal map look mostly blue?
- [ ] Blue is the channel with the most precision in an 8-bit texture
- [x] Most normals point straight out of the surface, (0, 0, 1); mapped from [-1,1] to [0,1] that is the colour (0.5, 0.5, 1.0), a light blue
- [ ] Normal maps store only the z component, in the blue channel
- [ ] Because normal maps are stored in sRGB
---
Each component is stored as `normal * 0.5 + 0.5`. A normal of (0, 0, 1) becomes (0.5, 0.5, 1.0); normals tilted upwards add green, tilted to the right add red.
```

In the fragment shader we sample the normal map, map the colour from [0,1] back to [-1,1] and normalize it. Then we
proceed with the lighting calculations using the sampled normal vector instead of the surface's normal.

:::opengl
`main.cpp` loads the normal map like the colour texture and binds it to texture unit 1:

```cpp
    unsigned int normalMap  = loadTexture("brickwall_normal.png");
```

```cpp
    shader.setInt("normalMap", 1);
```

```cpp
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, normalMap);
        renderQuad();
```

and `normal_mapping.fs`, with `uniform sampler2D normalMap;`, takes its normal from the map:

```glsl
    // obtain normal from normal map in range [0,1]
    vec3 normal = texture(normalMap, fs_in.TexCoords).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0 - 1.0);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Now do the first task, **normal-map**: these lines, and `glDeleteTextures(1, &normalMap);` at the end.
:::
:::vulkan
`initVulkan()` loads the normal map like the colour texture, into its own image, view and memory
(`normalMapImage`, `normalMapImageView`, `normalMapImageMemory`):

```cpp
        loadTexture("textures/brickwall_normal.png", normalMapImage, normalMapImageMemory, normalMapImageView);
```

The descriptor set gets a third binding – binding 2, a combined image sampler for the fragment stage – which reads the
normal map with the same sampler as the colour texture:

```cpp
        VkDescriptorImageInfo normalMapInfo{};
        normalMapInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        normalMapInfo.imageView = normalMapView;
        normalMapInfo.sampler = sampler;
```

(`createDescriptorSet(diffuseMapImageView, normalMapImageView, textureSampler, descriptorSet)`, a third
`VkWriteDescriptorSet`, a layout binding with `binding = 2`, and two combined image samplers in the pool.) The fragment
shader, with `layout(binding = 2) uniform sampler2D normalMap;`, takes its normal from the map:

```glsl
    // obtain normal from normal map in range [0,1]
    vec3 normal = texture(normalMap, fs_in.texCoord).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0 - 1.0);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Now do the first task, **normal-map**: these pieces, and destroy the normal map's view, image and memory in `cleanup()`.
:::
:::d3d12
`LoadAssets` loads the normal map like the colour texture, into slot 2 of the CBV/SRV heap, right after the colour
texture's SRV:

```cpp
    // The normal map, in slot 2. Its colours are directions, not colours: loaded as they are
    // (UNORM), each channel 0..1 standing for -1..1.
    ComPtr<ID3D12Resource> normalMapUploadHeap;
    LoadTexture("brickwall_normal.png", m_normalMap, normalMapUploadHeap, 2);
```

The heap grows to 3 descriptors (`cbvSrvHeapDesc.NumDescriptors = 3`) and the textures' descriptor range to two
registers, so the same table reaches both: `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)` – t0 the colours,
t1 the normals. In `normal_mapping.hlsl`, with `Texture2D normalMap : register(t1);`, `PSMain` takes its normal from
the map, read with the same sampler:

```hlsl
    // obtain normal from normal map in range [0,1]
    float3 normal = normalMap.Sample(wrapSampler, input.texCoords).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0f - 1.0f);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Now do the first task, **normal-map**: the member `m_normalMap`, the larger heap and range, the loading, and these
shader lines.
:::

Build and run: the bricks get **bumps** – the mortar between them now has edges – but the lighting is wrong. The whole
wall is darker, most of all at its lower left, and the bevels along the bricks don't match the light: the ones that face
up, towards the light, are dark.

There is one issue however that greatly limits this use of normal maps. The normal map we used had normal vectors that
all pointed somewhat in the positive z direction. This worked because the plane's surface normal was also pointing in
the positive z direction – before we rotated it. Our quad is rotated by -30°: its surface no longer faces +z, but the
normals from the map still do. The lighting uses them as if they were world-space normals, so it lights a wall facing
+z – not the one you see. If the quad faced up, along +y, it would be even worse: the map's normals would still point
along +z, at right angles to the surface.

```quiz
After the first task the quad's bumps are lit wrongly. Why?
- [ ] The normal map must be loaded as an sRGB texture
- [ ] `normal * 2.0 - 1.0` should be `normal * 0.5 + 0.5`
- [ ] The light is behind the quad
- [x] The map's normals are relative to the surface (mostly +z), but the shader uses them as world-space normals – right only for a quad that faces +z, and ours is rotated
---
A normal map does not know how the surface is oriented in the world. Its normals have to be brought into the same space as the light and view directions – that's what tangent space is for.
```

## Tangent space

One way to solve this would be to define a normal map for each possible direction of the surface – which obviously
doesn't work for anything but a single flat quad. Another, more difficult, solution is to do the lighting in a
different coordinate space: a coordinate space where the normal map vectors always point towards the positive z
direction; all other lighting vectors are then transformed relative to this positive z direction. This way we can always
use the same normal map, regardless of orientation. This coordinate space is called *tangent space*.

Normal vectors in a normal map are expressed in tangent space where normals always point roughly in the positive z
direction. Tangent space is a space that's local to the surface of a triangle: the normals are relative to the local
reference frame of the individual triangles. Think of it as the local space of the normal map's vectors; they're all
defined pointing in the positive z direction regardless of the final transformed direction. Using a specific matrix we
can then transform normal vectors from this local tangent space to world or view coordinates, orienting them along the
final mapped surface's direction.

Such a matrix is called a TBN matrix where the letters depict a Tangent, Bitangent and Normal vector. These are the
vectors we need to construct this matrix. To construct such a change-of-basis matrix, that transforms a tangent-space
vector to a different coordinate space, we need three perpendicular vectors that are aligned along the surface of a
normal map: an up, right, and forward vector.

We already know the up vector, which is the surface's normal vector. The right and forward vector are the tangent and
bitangent vector respectively: the directions on the surface in which the texture coordinates u and v grow. The tangent
points along the texture's u axis, the bitangent along its v axis – so the normal map's x (red) is measured along the
tangent, its y (green) along the bitangent, its z (blue) along the normal.

### Manual calculation of tangents and bitangents

Calculating the tangent and bitangent vectors is not as straightforward as the normal vector. We can see from the
texture coordinates that the direction of the normal map's tangent and bitangent vector align with the direction in
which we define a surface's texture coordinates. We'll use this fact to calculate tangent and bitangent vectors for
each surface.

Take a triangle with the vertex positions P1, P2, P3 and the texture coordinates (U1, V1), (U2, V2), (U3, V3). Its edges
E1 = P2 − P1 and E2 = P3 − P1 are differences of positions; the matching differences of texture coordinates are
ΔU1, ΔV1 (from vertex 1 to 2) and ΔU2, ΔV2 (from vertex 1 to 3). Since T and B are the directions in which u and v grow,
each edge is a combination of them – go ΔU along the tangent and ΔV along the bitangent:

```text
E1 = ΔU1 · T + ΔV1 · B
E2 = ΔU2 · T + ΔV2 · B
```

That's two vector equations with two unknown vectors – a 2 × 2 linear system per component. Multiplying both sides by
the inverse of the ΔUV matrix solves it:

```text
| T |              1               |  ΔV2  -ΔV1 |   | E1 |
|   | = ------------------------ · |            | · |    |
| B |   ΔU1 · ΔV2  -  ΔU2 · ΔV1    | -ΔU2   ΔU1 |   | E2 |
```

So T = f · (ΔV2 · E1 − ΔV1 · E2) and B = f · (−ΔU2 · E1 + ΔU1 · E2), with f = 1 / (ΔU1 · ΔV2 − ΔU2 · ΔV1).

```quiz
What do a triangle's tangent and bitangent describe?
- [x] The directions on the triangle's surface in which the texture coordinates u and v grow – the axes along which the normal map's x and y are measured
- [ ] Two vectors perpendicular to the surface, beside the normal
- [ ] The directions of the triangle's first two edges
- [ ] The light's direction and the view direction in world space
---
Each edge of the triangle is ΔU steps along T plus ΔV steps along B; solving those two equations gives T and B. Together with the normal they form tangent space.
```

:::opengl
In `renderQuad()` this is learnopengl's code, for the first triangle (pos1, pos2, pos3):

```cpp
        glm::vec3 edge1 = pos2 - pos1;
        glm::vec3 edge2 = pos3 - pos1;
        glm::vec2 deltaUV1 = uv2 - uv1;
        glm::vec2 deltaUV2 = uv3 - uv1;

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

and the same for the second triangle (pos1, pos3, pos4) into `tangent2` and `bitangent2`. Every vertex then gets its
triangle's tangent and bitangent – 14 floats per vertex:

```cpp
        float quadVertices[] = {
            // positions            // normal         // texcoords  // tangent                          // bitangent
            pos1.x, pos1.y, pos1.z, nm.x, nm.y, nm.z, uv1.x, uv1.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,
            pos2.x, pos2.y, pos2.z, nm.x, nm.y, nm.z, uv2.x, uv2.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,
            pos3.x, pos3.y, pos3.z, nm.x, nm.y, nm.z, uv3.x, uv3.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,

            pos1.x, pos1.y, pos1.z, nm.x, nm.y, nm.z, uv1.x, uv1.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z,
            pos3.x, pos3.y, pos3.z, nm.x, nm.y, nm.z, uv3.x, uv3.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z,
            pos4.x, pos4.y, pos4.z, nm.x, nm.y, nm.z, uv4.x, uv4.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z
        };
```

The stride of all attribute pointers becomes `14 * sizeof(float)`, and two attributes are added:

```cpp
        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, 14 * sizeof(float), (void*)(8 * sizeof(float)));
        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 3, GL_FLOAT, GL_FALSE, 14 * sizeof(float), (void*)(11 * sizeof(float)));
```

which `normal_mapping.vs` declares as `layout (location = 3) in vec3 aTangent;` and
`layout (location = 4) in vec3 aBitangent;`. Now do the task **tangents**.
:::
:::vulkan
In `createQuadVertices()` this is learnopengl's code, for the first triangle (pos1, pos2, pos3):

```cpp
        glm::vec3 edge1 = pos2 - pos1;
        glm::vec3 edge2 = pos3 - pos1;
        glm::vec2 deltaUV1 = uv2 - uv1;
        glm::vec2 deltaUV2 = uv3 - uv1;

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

and the same for the second triangle (pos1, pos3, pos4) into `tangent2` and `bitangent2`. `Vertex` gets two more
members, `glm::vec3 tangent;` and `glm::vec3 bitangent;`, and `getAttributeDescriptions()` two more descriptions –
an `std::array<VkVertexInputAttributeDescription, 5>`:

```cpp
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[3].offset = offsetof(Vertex, tangent);

        attributeDescriptions[4].binding = 0;
        attributeDescriptions[4].location = 4;
        attributeDescriptions[4].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[4].offset = offsetof(Vertex, bitangent);
```

Every vertex then gets its triangle's tangent and bitangent:

```cpp
        vertices = {
            // positions, normal, texcoords, tangent, bitangent
            {pos1, nm, uv1, tangent1, bitangent1},
            {pos2, nm, uv2, tangent1, bitangent1},
            {pos3, nm, uv3, tangent1, bitangent1},

            {pos1, nm, uv1, tangent2, bitangent2},
            {pos3, nm, uv3, tangent2, bitangent2},
            {pos4, nm, uv4, tangent2, bitangent2}
        };
```

and `normal_mapping.vert` declares them as `layout(location = 3) in vec3 inTangent;` and
`layout(location = 4) in vec3 inBitangent;`. Now do the task **tangents**.
:::
:::d3d12
In `LoadAssets` this is learnopengl's code, for the first triangle (pos1, pos2, pos3). `XMFLOAT3` and `XMFLOAT2` are
storage types without arithmetic operators, so the differences are written per component:

```cpp
        XMFLOAT3 edge1(pos2.x - pos1.x, pos2.y - pos1.y, pos2.z - pos1.z);
        XMFLOAT3 edge2(pos3.x - pos1.x, pos3.y - pos1.y, pos3.z - pos1.z);
        XMFLOAT2 deltaUV1(uv2.x - uv1.x, uv2.y - uv1.y);
        XMFLOAT2 deltaUV2(uv3.x - uv1.x, uv3.y - uv1.y);

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

and the same for the second triangle (pos1, pos3, pos4) into `tangent2` and `bitangent2`. `Vertex` gets two more
members, `XMFLOAT3 tangent;` and `XMFLOAT3 bitangent;` (14 floats), every vertex its triangle's pair –
`{ pos1, nm, uv1, tangent1, bitangent1 }` and so on – and the input layout two more elements:

```cpp
            { "TANGENT", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BINORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 44, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

`BINORMAL` is HLSL's semantic name for the bitangent. `VSMain` receives them as two more parameters:

```hlsl
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD, float3 tangent : TANGENT, float3 bitangent : BINORMAL)
```

Now do the task **tangents**.
:::

Build and run: nothing changes – the shaders don't use the new attributes yet. For our quad both triangles get the same
vectors, of course: the quad is flat, and its texture is not distorted.

:::opengl
Work it out for the first triangle: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, -1), ΔUV2 = (1, -1), so f = 1,
T = (2, 0, 0) and B = (0, 2, 0). The tangent points right, along u; the bitangent up, along v. They have a length of 2
because the quad is 2 units wide for one texture repetition – the shader will normalize them.
:::
:::vulkan
Work it out for the first triangle: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, -1), ΔUV2 = (1, -1), so f = 1,
T = (2, 0, 0) and B = (0, 2, 0). The tangent points right, along u; the bitangent up, along v. They have a length of 2
because the quad is 2 units wide for one texture repetition – the shader will normalize them.
:::
:::d3d12
Work it out for the first triangle: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, 1), ΔUV2 = (1, 1), so f = -1,
T = (2, 0, 0) and B = (0, -2, 0). The tangent points right, along u – but the bitangent points **down**: with
Direct3D's texture coordinates v grows down the image, so the direction in which v grows on the wall is down. (They have
a length of 2 because the quad is 2 units wide for one texture repetition – the shader will normalize them.) Keep that
in mind; it'll matter in a moment.
:::

### Tangent space normal mapping

To get normal mapping working, we first have to create a TBN matrix in the shaders. To do that, we pass the earlier
calculated tangent and bitangent vectors to the vertex shader as vertex attributes. Within the vertex shader we create
the TBN matrix: we first transform all the TBN vectors to the coordinate system we'd like to work in, which in this case
is world space as we multiply them with the model matrix's normal matrix. Then we create the actual TBN matrix by
directly supplying the relevant vectors to the matrix constructor.

Now that we have a TBN matrix, how are we going to use it? There are two ways we can use a TBN matrix for normal
mapping:

1. We take the TBN matrix that transforms any vector from tangent to world space, give it to the fragment shader, and
   transform the sampled normal from tangent space to world space using the TBN matrix; the normal is then in the same
   space as the other lighting variables.
2. We take the inverse of the TBN matrix that transforms any vector from world space to tangent space, and use this
   matrix to transform not the normal, but the other relevant lighting variables to tangent space; the normal is then
   again in the same space as the other lighting variables.

learnopengl's final code uses the second way. Because T, B and N are perpendicular unit vectors, the TBN matrix is
orthogonal, and the inverse of an orthogonal matrix is equal to its transpose – much cheaper to compute than an inverse.
The second way also looks like more work at first, but it moves work out of the fragment shader: we transform the light
position, the view position and the fragment position to tangent space in the **vertex** shader – which runs once per
vertex, not once per fragment – and let them be interpolated. The fragment shader doesn't need any matrix at all: the
sampled normal is in tangent space already.

```quiz
Why does learnopengl transform the light, view and fragment positions into tangent space in the vertex shader instead of transforming each sampled normal into world space?
- [ ] Because the normal map cannot be read in world space
- [ ] Because tangent space makes the specular highlight sharper
- [x] The vertex shader runs far less often than the fragment shader; with the positions already in tangent space, the fragment shader needs no matrix multiplication per fragment
- [ ] Because the TBN matrix can't be passed to the fragment shader
---
Both ways give the same lighting. The second does the matrix work per vertex – here 6 times – instead of per fragment – here over 200,000 times – and uses the cheap transpose as the inverse.
```

:::opengl
The vertex shader's output block loses `Normal` and gets the three tangent-space positions:

```glsl
out VS_OUT {
    vec3 FragPos;
    vec2 TexCoords;
    vec3 TangentLightPos;
    vec3 TangentViewPos;
    vec3 TangentFragPos;
} vs_out;
```

(the fragment shader's `in VS_OUT` block likewise), and `main` builds the TBN matrix:

```glsl
    mat3 normalMatrix = transpose(inverse(mat3(model)));
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 B = normalize(normalMatrix * aBitangent);
    vec3 N = normalize(normalMatrix * aNormal);

    mat3 TBN = transpose(mat3(T, B, N)); // world space -> tangent space (the inverse of an orthonormal matrix is its transpose)
    vs_out.TangentLightPos = TBN * lightPos;
    vs_out.TangentViewPos  = TBN * viewPos;
    vs_out.TangentFragPos  = TBN * vs_out.FragPos;
```

`mat3(T, B, N)` takes T, B and N as its **columns**: that matrix takes a tangent-space vector to world space. Its
transpose has them as rows and goes the other way. In the fragment shader, the light and view directions now come from
the tangent-space positions:

```glsl
    vec3 lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos);
```

```glsl
    vec3 viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos);
```

Now do the task **tbn**.
:::
:::vulkan
The vertex shader's output block loses `normal` and gets the three tangent-space positions:

```glsl
layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec2 texCoord;
    vec3 tangentLightPos;
    vec3 tangentViewPos;
    vec3 tangentFragPos;
} vs_out;
```

The fragment shader's `in VS_OUT` block must list the same members in the same order: the locations of the members
follow from their order. `main` builds the TBN matrix:

```glsl
    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    vec3 T = normalize(normalMatrix * inTangent);
    vec3 B = normalize(normalMatrix * inBitangent);
    vec3 N = normalize(normalMatrix * inNormal);

    mat3 TBN = transpose(mat3(T, B, N)); // world space -> tangent space (the inverse of an orthonormal matrix is its transpose)
    vs_out.tangentLightPos = TBN * ubo.lightPos;
    vs_out.tangentViewPos  = TBN * ubo.viewPos;
    vs_out.tangentFragPos  = TBN * vs_out.fragPos;
```

`mat3(T, B, N)` takes T, B and N as its **columns**: that matrix takes a tangent-space vector to world space. Its
transpose has them as rows and goes the other way. In the fragment shader, the light and view directions now come from
the tangent-space positions:

```glsl
    vec3 lightDir = normalize(fs_in.tangentLightPos - fs_in.tangentFragPos);
```

```glsl
    vec3 viewDir = normalize(fs_in.tangentViewPos - fs_in.tangentFragPos);
```

**Why the textures are flipped on load in this chapter:** the earlier Vulkan chapters keep stb_image's rows as they are
(row 0 = the image's top = v 0) and flip v in the vertex data instead. That would break normal mapping: the bitangent is
computed from the texture coordinates, so with flipped v it would point *down* the wall, while the normal map's green
channel means *up* the image – every bump would be lit from the wrong side. So this chapter does what learnopengl does:
`initVulkan()` calls `stbi_set_flip_vertically_on_load(true);` before loading (row 0 = the image's bottom = v 0) and
keeps learnopengl's texture coordinates. T then points along +u to the right, B along +v up the image – exactly the
normal map's convention. Now do the task **tbn**.
:::
:::d3d12
`PSInput` loses `normal` and gets the three tangent-space positions:

```hlsl
    float3 fragPos : POSITION;    // the position in world space
    float2 texCoords : TEXCOORD0;
    // the positions the lighting needs, in tangent space
    float3 tangentLightPos : TEXCOORD1;
    float3 tangentViewPos : TEXCOORD2;
    float3 tangentFragPos : TEXCOORD3;
```

and `VSMain` builds the TBN matrix:

```hlsl
    // The tangent, the bitangent and the normal in world space (w = 0: directions).
    float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);
    float3 B = normalize(mul(float4(bitangent, 0.0f), normalMatrix).xyz);
    float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);

    // world space -> tangent space: T, B and N as the rows of the matrix (the inverse of an
    // orthonormal matrix is its transpose - learnopengl: transpose(mat3(T, B, N)))
    float3x3 TBN = float3x3(T, B, N);
    result.tangentLightPos = mul(TBN, lightPos);
    result.tangentViewPos = mul(TBN, viewPos);
    result.tangentFragPos = mul(TBN, result.fragPos);
```

Mind the constructors: GLSL's `mat3(T, B, N)` takes **columns**, HLSL's `float3x3(T, B, N)` takes **rows**. So
`float3x3(T, B, N)` already is learnopengl's `transpose(mat3(T, B, N))`, the world → tangent space matrix, and
`mul(TBN, v)` (matrix times column vector) gives (dot(T, v), dot(B, v), dot(N, v)). In `PSMain`, the light and view
directions come from the tangent-space positions:

```hlsl
    float3 lightDir = normalize(input.tangentLightPos - input.tangentFragPos);
```

```hlsl
    float3 viewDir = normalize(input.tangentViewPos - input.tangentFragPos);
```

And one more line, after the normal map is read:

```hlsl
    // The normal map is OpenGL-style: its y (green) points up the image. In Direct3D, v and
    // so the bitangent point down the image: flip y (a DirectX-style normal map stores it so).
    normal.y = -normal.y;
```

Here's why. Our bitangent is the direction in which v grows – down the wall, (0, -2, 0) – so in our tangent space +y
means "down the image". But `brickwall_normal.png` is an OpenGL-style normal map: its green channel means "up the
image" (normal maps come in both conventions, often called "Y+" / OpenGL and "Y-" / DirectX). Without the flip, every
bevel would be lit from the wrong side. With a DirectX-style map, no flip would be needed. (In the first task there was
no flip: used as a world-space normal, the map's y was simply the wall's up.) Now do the task **tbn**.
:::

Build and run: the bricks' **bumps are lit correctly**. The flat faces of the bricks look as at the start – they are
flat in the normal map too – but the bevels facing the light are bright now, and those facing away are in their own
shade. The wall looks like it has depth, and it's still just two triangles.

:::opengl
```quiz
For our quad, the bitangent is (0, 2, 0) – up the wall. Why does that fit the normal map?
- [ ] Because OpenGL's window y points up
- [ ] It doesn't matter which way the bitangent points, the normal is normalized anyway
- [x] The textures are flipped on load, so v grows up the image; the bitangent – the direction in which v grows – points up the wall, and the normal map's green channel means "up the image" too
- [ ] Because the quad is rotated by -30°
---
The bitangent is tangent space's y axis. The normal map's y must mean the same direction, or every bump is lit from the opposite side.
```
:::
:::vulkan
```quiz
Why does this chapter flip the images on load (`stbi_set_flip_vertically_on_load(true)`) instead of flipping v in the vertex data as the earlier Vulkan chapters do?
- [x] The bitangent is computed from v: with flipped v it would point down the wall, but the normal map's green channel means up the image – the bumps would be lit from the wrong side
- [ ] Because Vulkan cannot sample flipped textures
- [ ] Because the projection's `proj[1][1] *= -1` flips the texture too
- [ ] To make the normal map linear instead of sRGB
---
With the flip on load and learnopengl's texture coordinates, v grows up the image, the bitangent points up the wall, and tangent space's +y means what the normal map's green means.
```
:::
:::d3d12
```quiz
Why does `PSMain` flip the normal map's y (`normal.y = -normal.y`)?
- [ ] Because Direct3D's window y points down
- [x] With Direct3D's texture coordinates v grows down the image, so the bitangent – tangent space's y axis – points down the wall; the OpenGL-style normal map's green channel means up the image
- [ ] Because `float3x3` takes rows instead of columns
- [ ] Because the texture is loaded as `R8G8B8A8_UNORM`
---
Tangent space's y follows v. A normal map made for v pointing up (OpenGL, "Y+") needs its y flipped when v points down; a DirectX-style ("Y-") map would not.
```
:::

## Complex objects

We've demonstrated how we can use normal mapping, together with tangent space transformations, by manually calculating
the tangent and bitangent vectors. Luckily for us, having to manually calculate these tangent and bitangent vectors is
not something we do too often. Most of the time you implement it once in a custom model loader, or in our case use a
model loader like Assimp.

Assimp has a very useful configuration bit we can set when loading a model called `aiProcess_CalcTangentSpace`. When
the `aiProcess_CalcTangentSpace` bit is supplied to Assimp's `ReadFile` function, Assimp calculates smooth tangent and
bitangent vectors for each of the loaded vertices, similarly to how we did it in this chapter. The loader then copies
them from the mesh's `mTangents` and `mBitangents` into the vertex data – in OpenGL into two more vertex attributes, in
Vulkan into two more members of the `Vertex` struct with their attribute descriptions, in Direct3D into two more input
layout elements, as you did for the quad. (A note for Wavefront OBJ files: their normal maps are often exported as
`map_bump`, which Assimp reports as `aiTextureType_HEIGHT`, not `aiTextureType_NORMALS`.)

Using normal maps is also a great way to boost performance. Before normal mapping, you had to use a large number of
vertices to get a high number of detail on a mesh. With normal mapping, we can get the same level of detail on a mesh
using a lot less vertices: an artist models the detailed mesh, bakes its surface into a normal map, and the game draws a
much simpler mesh with that map.

## One last thing

There is one last trick left to discuss that slightly improves quality without too much extra cost.

When tangent vectors are calculated on larger meshes that share a considerable amount of vertices, the tangent vectors
are generally averaged to give nice and smooth results – the same as smooth normals. A problem with this approach is
that the three TBN vectors could end up non-perpendicular, which means the resulting TBN matrix would no longer be
orthogonal – and its transpose would no longer be its inverse. Normal mapping would only be slightly off with a
non-orthogonal TBN matrix, but it's still something we can improve.

Using a mathematical trick called the *Gram-Schmidt process*, we can re-orthogonalize the TBN vectors such that each
vector is again perpendicular to the other vectors: subtract from T its part along N – `dot(T, N) * N` – which leaves
only the part of T that is perpendicular to N, and normalize it. The third vector then doesn't need to come from the
vertex data at all: the cross product of two perpendicular unit vectors is a unit vector perpendicular to both.

```quiz
What does `T = normalize(T - dot(T, N) * N)` do?
- [ ] It rotates T around N by 90°
- [ ] It makes T point in the same direction as N
- [ ] It averages T and N
- [x] It removes the component of T that lies along N, so T is perpendicular to N again (then normalizes it)
---
`dot(T, N) * N` is T's projection onto N. What's left after subtracting it lies in the surface's plane – one step of the Gram-Schmidt process. The bitangent is then the cross product of N and T.
```

:::opengl
In `normal_mapping.vs`:

```glsl
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 N = normalize(normalMatrix * aNormal);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
```

Now do the last task, **gram-schmidt**: these lines replace the three that computed T, B and N; the `aBitangent`
attribute stays in the vertex data and in the shader, as in learnopengl.
:::
:::vulkan
In `normal_mapping.vert`:

```glsl
    vec3 T = normalize(normalMatrix * inTangent);
    vec3 N = normalize(normalMatrix * inNormal);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
```

Now do the last task, **gram-schmidt**: these lines replace the three that computed T, B and N; the `inBitangent`
attribute stays in the vertex data and in the shader, as in learnopengl.
:::
:::d3d12
In `VSMain`:

```hlsl
    float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);
    float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B from T and N: cross(T, N) points down the image, like the bitangent with Direct3D's
    // v (learnopengl's cross(N, T) points up: its v grows up the image)
    float3 B = cross(T, N);
```

Note the order: learnopengl's `cross(N, T)` is (0, 0, 1) × (1, 0, 0) = (0, 1, 0) – up, the direction its v grows. Ours
must point the way our v grows, down, like the bitangent attribute did: `cross(T, N)` = (0, -1, 0). With `cross(N, T)`
the `normal.y = -normal.y` flip would be wrong. Now do the last task, **gram-schmidt**: these lines replace the three
that computed T, B and N; the `bitangent` attribute stays in the vertex data and in `VSMain`'s parameters, as in
learnopengl.
:::

Build and run: nothing changes. On our flat quad T, B and N are already perpendicular, and the cross product equals the
normalized bitangent we passed. On a real mesh with smoothed tangents it makes the difference between a TBN matrix whose
transpose is its inverse and one whose isn't.

## Additional resources

:::opengl
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengl's chapter this chapter follows,
  with pictures of the normal map, tangent space and the results.
- [normal_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/4.normal_mapping/normal_mapping.cpp):
  learnopengl's program.
- [Vertex Specification (OpenGL wiki)](https://www.khronos.org/opengl/wiki/Vertex_Specification): vertex attributes,
  strides and offsets – what the two new attributes need.
:::
:::vulkan
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengl's chapter this chapter follows,
  with pictures of the normal map, tangent space and the results.
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): vulkan-tutorial's
  chapter on `VkVertexInputAttributeDescription`, which gets two more entries here.
- [normal_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/4.normal_mapping/normal_mapping.cpp):
  learnopengl's program.
:::
:::d3d12
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengl's chapter this chapter follows,
  with pictures of the normal map, tangent space and the results.
- [Semantics (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics): the
  vertex shader semantics, `TANGENT` and `BINORMAL` among them.
- [Per-component math operations (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-per-component-math):
  HLSL's matrices, their constructors and `mul`.
:::
