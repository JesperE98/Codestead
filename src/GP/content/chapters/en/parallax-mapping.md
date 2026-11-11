# Parallax Mapping

Parallax mapping is a technique similar to normal mapping, but based on different principles. Just like normal mapping
it is a technique that significantly boosts a textured surface's detail and gives it a sense of depth. While also an
illusion, parallax mapping is a lot better in conveying a sense of depth and together with normal mapping gives
incredibly realistic results. While parallax mapping isn't necessarily a technique directly related to (advanced)
lighting, we'll still discuss it here as the technique is a logical follow-up of normal mapping.

Parallax mapping is closely related to the family of displacement mapping techniques that displace or offset vertices
based on geometrical information stored inside a texture. One way to do this, is to take a plane with roughly 1000
vertices and displace each of these vertices based on a value in a texture that tells us the height of the plane at
that specific area. Such a texture that contains height values per texel is called a *height map*. Displacing every
vertex this way gives a real, bumpy surface – but it needs a lot of vertices to look good.

What if we could somehow achieve the same level of realism, but with only two triangles? That is exactly what parallax
mapping does. The idea behind parallax mapping is to alter the texture coordinates in such a way that it looks like a
fragment's surface is higher or lower than it actually is, all based on the view direction and a height map. Like
normal mapping, it happens entirely in the fragment shader, in tangent space – so it is the same in every API. The
differences are where the third texture goes, and – in Direct3D – how a texture may be sampled inside a loop.

:::opengl
The project continues the last chapter: the normal-mapped quad – `renderQuad()` with tangents and bitangents, 14 floats
per vertex – and the vertex shader `parallax_mapping.vs`, which is complete: the TBN matrix with Gram-Schmidt, and the
light, view and fragment positions in tangent space. The textures are new: `bricks2.png` (sandy bricks with deep
mortar, unit 0) and its normal map `bricks2_normal.png` (unit 1). The quad is rotated by a fixed -45° about the x axis:
its top edge tilts away and its normal points to (0, 0.707, 0.707), so the camera at (0, 0, 3) looks at the bricks
from 45° above, like at a floor in front of it (learnopengl turns the quad with time). `parallax_mapping.fs` lights it
as the last chapter did, but `main` computes the view direction first and samples the normal map and the colour at
`vec2 texCoords = fs_in.TexCoords;` – the TODO is the line that changes `texCoords`. The light is at `lightPos`
(0.5, 1.0, 0.3).
:::
:::vulkan
The project continues the last chapter: the normal-mapped quad – `createQuadVertices()` with tangents and bitangents –
and the vertex shader `parallax_mapping.vert`, which is complete: the TBN matrix with Gram-Schmidt, and the light,
view and fragment positions in tangent space. The textures are new: `textures/bricks2.png` (sandy bricks with deep
mortar, binding 1) and its normal map `textures/bricks2_normal.png` (binding 2), loaded flipped
(`stbi_set_flip_vertically_on_load(true)`) as in the last chapter. The quad is rotated by a fixed -45° about the x axis:
its top edge tilts away and its normal points to (0, 0.707, 0.707), so the camera at (0, 0, 3) looks at the bricks from
45° above, like at a floor in front of it (learnopengl turns the quad with time). `parallax_mapping.frag` lights it as
the last chapter did, but `main` computes the view direction first and samples the normal map and the colour at
`vec2 texCoords = fs_in.texCoord;` – the TODO is the line that changes `texCoords`. The light is at `lightPos`
(0.5, 1.0, 0.3).
:::
:::d3d12
The project continues the last chapter: the normal-mapped quad – tangents and bitangents computed in `LoadAssets`, 14
floats per vertex – and `VSMain` in `parallax_mapping.hlsl`, which is complete: the TBN matrix with Gram-Schmidt and
`B = cross(T, N)`, and the light, view and fragment positions in tangent space. The textures are new: `bricks2.png`
(sandy bricks with deep mortar, t0) and its normal map `bricks2_normal.png` (t1) – OpenGL-style, so `PSMain` flips its
y as in the last chapter. The quad is rotated by a fixed -45° about the x axis (`XMMatrixRotationX`): its top edge tilts
away and its normal points to (0, 0.707, 0.707), so the camera at (0, 0, 3) looks at the bricks from 45° above, like at
a floor in front of it (learnopengl turns the quad with time). `PSMain` computes the view direction first and samples
the normal map and the colour at `float2 texCoords = input.texCoords;` – the TODO is the line that changes `texCoords`.
The light is at `lightPos` (0.5, 1.0, 0.3).
:::

Build and run the program: a brick floor seen at an angle, a trapezoid narrower at the top. The normal map gives the
mortar its bevels, but every brick is at the same height – look along the bricks and they're painted on a flat board.
The `// TODO:` comments in the project mark where your code goes.

## Parallax mapping

Look at a single fragment on the flat quad – call its point A. The eye looks at A along the view direction. If the
surface really had a relief, the eye's ray wouldn't stop at A: A lies above a deep part of the surface (in the mortar,
say), so the ray would continue into the surface and hit it at some other point B further along. B is what we should see
at A's fragment. Parallax mapping aims to offset the texture coordinates at fragment position A in such a way that we get
texture coordinates at point B. We then use the texture coordinates at point B for all subsequent texture samples,
making it look like the viewer is actually looking at point B.

The trick is to figure out how to get the texture coordinates at point B from point A. Parallax mapping tries to solve
this by scaling the fragment-to-view direction vector by the height (or depth) at fragment A. We scale the vector by the
value at A, giving a vector P, and take P's projection onto the surface – its x and y in tangent space – as the texture
coordinate offset. This works because the depth at A is approximately the depth at B. It isn't exact, of course: if the
surface changes depth quickly, the approximation fails, and we'll come back to that.

The texture we use is not a height map but a *depth map* – a height map inverted: `bricks2_disp.png` is white where the
surface is deep (the mortar) and black where it is at the surface (the bricks' tops). learnopengl prefers it because it
is easier to fake depth than height on flat surfaces: the bricks stay where the quad is, and the mortar sinks into it.

Then the offset. The view direction `viewDir` points from the fragment towards the camera, in tangent space – where z is
the surface's normal and x, y run along the texture's u and v. A ray from the camera travels the opposite way, so to sink
to a depth d it moves *against* `viewDir.xy` – by `viewDir.xy / viewDir.z * d`: the smaller `viewDir.z`, the flatter the
angle, and the farther the ray travels sideways before it reaches that depth. Hence the subtraction, and the division.
`heightScale` (0.1 in the project; learnopengl changes it with the Q and E keys) scales how deep the depth map's 1.0 goes,
in texture units.

```quiz
The depth map is white (1.0) in the mortar and black (0.0) on the bricks' tops. What happens to a fragment on a brick's top?
- [ ] It is shifted the most, because black means far away
- [x] Nothing: its depth is 0, so the offset `viewDir.xy / viewDir.z * (height * heightScale)` is 0 – the bricks' tops stay where the quad is, and only deeper parts are shifted
- [ ] It is discarded
- [ ] It is shifted towards the camera, so the brick looks raised
---
A depth map says how far below the quad's surface each texel lies. The surface itself (depth 0) is not displaced; the mortar (depth 1, times `heightScale`) is shifted the farthest.
```

Some people prefer to leave the division by `viewDir.z` out of the equation, as the default equation can produce
undesirable results at very flat angles; that technique is called parallax mapping with offset limiting. learnopengl's
chapter text divides (its first sample program doesn't), and so does the course. Choosing which technique to pick is
usually a matter of personal preference.

```quiz
Why does the offset divide by `viewDir.z`?
- [ ] To normalize the view direction
- [ ] Because `viewDir.z` is the depth map's value
- [x] `viewDir.z` is small when the view is flat to the surface; a ray at a flat angle travels farther sideways before it sinks to a given depth, so the offset must grow
- [ ] To convert from tangent space to texture coordinates
---
Looking straight at the surface (`viewDir.z` = 1) a ray sinks without moving sideways; at a grazing angle it moves a long way. Leaving the division out ("offset limiting") keeps the offset small at grazing angles, at the cost of less depth.
```

:::opengl
`main.cpp` loads the depth map like the other two, binds it to texture unit 2, and passes `heightScale` (a global
`float heightScale = 0.1f;`):

```cpp
    unsigned int heightMap  = loadTexture("bricks2_disp.png");
```

```cpp
    shader.setInt("depthMap", 2);
```

```cpp
        shader.setFloat("heightScale", heightScale);
```

```cpp
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, heightMap);
        renderQuad();
```

In `parallax_mapping.fs`, with `uniform sampler2D depthMap;` and `uniform float heightScale;`:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{
    float height =  texture(depthMap, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * heightScale);
}
```

and in `main`, right after `texCoords` is set to the original coordinates:

```glsl
    texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);
```

Now do the first task, **parallax**. Delete `heightMap` at the end with `glDeleteTextures`.
:::
:::vulkan
`heightScale` (a global `float heightScale = 0.1f;`) goes into the uniform buffer, in place of `pad2` – std140 lets a
float fill the last 4 bytes of a vec3's 16-byte slot:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float heightScale; // fills the 4 bytes after lightPos
};
```

with `ubo.heightScale = heightScale;` in `updateUniformBuffer()` and `float heightScale;` after `lightPos` in the fragment
shader's uniform block. The depth map is loaded like the other two (`heightMapImage`, `heightMapImageMemory`,
`heightMapImageView`):

```cpp
        loadTexture("textures/bricks2_disp.png", heightMapImage, heightMapImageMemory, heightMapImageView);
```

and becomes binding 3 of the descriptor set – a fourth layout binding (combined image sampler, fragment stage), three
image samplers in the pool, `createDescriptorSet(diffuseMapImageView, normalMapImageView, heightMapImageView,
textureSampler, descriptorSet)` with a fourth write. In `parallax_mapping.frag`, with
`layout(binding = 3) uniform sampler2D depthMap;`:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) {
    float height = texture(depthMap, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * ubo.heightScale);
}
```

and in `main`, right after `texCoords` is set to the original coordinates:

```glsl
    texCoords = ParallaxMapping(fs_in.texCoord, viewDir);
```

The depth map must be sampled at exactly the coordinates of the other two maps – it is loaded flipped like them. Now do
the first task, **parallax**, and destroy the depth map's view, image and memory in `cleanup()`.
:::
:::d3d12
`heightScale` (a global `float heightScale = 0.1f;`) goes into the constant buffer, in place of the padding after
`viewPos` – a float may fill the rest of a float3's 16-byte row:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float heightScale;
        XMFLOAT3 lightPos;
        float padding1;
    };
```

with `constantBufferData.heightScale = heightScale;` in `OnUpdate` and `float heightScale;` after `viewPos` in the
shader's cbuffer. The depth map is loaded like the other two, into slot 3 of the CBV/SRV heap (`NumDescriptors = 4`):

```cpp
    ComPtr<ID3D12Resource> depthMapUploadHeap;
    LoadTexture("bricks2_disp.png", m_depthMap, depthMapUploadHeap, 3);
```

and the textures' range grows to three registers – `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 3, 0)`, t2 the
depth map. In `parallax_mapping.hlsl`, with `Texture2D depthMap : register(t2);`:

```hlsl
float2 ParallaxMapping(float2 texCoords, float3 viewDir)
{
    float height = depthMap.Sample(wrapSampler, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * heightScale);
}
```

and in `PSMain`, right after `texCoords` is set to the original coordinates:

```hlsl
    texCoords = ParallaxMapping(input.texCoords, viewDir);
```

learnopengl's shift works unchanged with Direct3D's texture coordinates: v points down the image, and so does our
tangent space's y (B = `cross(T, N)`, the direction v grows), so `viewDir.xy` is in texture-coordinate directions. Now do
the first task, **parallax**.
:::

Build and run: the **bricks look raised** above the mortar. Their front sides – the sides facing the camera – appear,
and the mortar between them narrows. Not bad for two triangles. Look at the borders of the quad, though: there the
shifted coordinates leave the [0,1] range, and because the textures repeat, bits of the neighbouring bricks show along
the edges. And close up the bricks' sides look smeared – we'll come to that.

### Discarding the edges

To fix the borders, we could discard the fragment whenever it samples outside the default texture coordinate range.
Note that this only works for a plane like ours; on more complex surfaces discarding fragments is not as effective, and
the edge artifacts are something to live with or to hide.

```quiz
After the shift, the quad's borders show bits of neighbouring bricks. Why, and what does discarding do?
- [x] At the borders the shifted coordinates fall outside [0,1], where the repeating texture shows other bricks; discarding those fragments lets the bricks' outline end the quad
- [ ] The depth map is clamped at the borders; discarding resets it
- [ ] The normal map has no data at the borders; discarding hides the lighting errors
- [ ] The vertex shader moves the border vertices; discarding moves them back
---
A brick at the quad's edge, shifted, would continue beyond the texture's border. Instead of the repeated texture we see the background there: the quad's outline becomes ragged, following the raised bricks.
```

:::opengl
After `ParallaxMapping`:

```glsl
    texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);
    if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;
```

Now do the task **discard-edges**.
:::
:::vulkan
After `ParallaxMapping`:

```glsl
    texCoords = ParallaxMapping(fs_in.texCoord, viewDir);
    if (texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;
```

Now do the task **discard-edges**.
:::
:::d3d12
After `ParallaxMapping`:

```hlsl
    texCoords = ParallaxMapping(input.texCoords, viewDir);
    if (texCoords.x > 1.0f || texCoords.y > 1.0f || texCoords.x < 0.0f || texCoords.y < 0.0f)
        discard;
```

HLSL's `discard` works like GLSL's (`clip(x)`, which discards where x < 0, is another way). Now do the task
**discard-edges**.
:::

Build and run: the quad's borders become **ragged** – where the raised bricks' outline ends, the background shows.
Everything inside is unchanged.

## Steep Parallax Mapping

Steep parallax mapping is an extension on top of parallax mapping in that it uses the same principles, but instead of 1
sample it takes multiple samples to better pinpoint vector P to B. This gives much better results, even with steep
height changes, as the accuracy of the technique is improved by the number of samples.

The general idea of steep parallax mapping is that it divides the total depth range into multiple layers of the same
height/depth. For each of these layers we sample the depth map, shifting the texture coordinates along the direction of
P, until we find a sampled depth value that is less than the depth value of the current layer. In other words: we walk
along the view ray, one layer deeper at each step, and stop as soon as the ray is below the surface the depth map
describes. The texture coordinates of that step are where the ray hits.

We can improve the algorithm a bit by exploiting one of parallax mapping's properties. When looking straight onto a
surface there isn't much texture displacement going on while there is a lot of displacement when looking at a surface
from an angle. By taking less samples when looking straight at a surface and more samples when looking at an angle we
only sample the necessary amount: here 8 layers when looking straight at it, up to 32 at grazing angles. `dot(vec3(0.0,
0.0, 1.0), viewDir)` – the cosine of the angle between the view direction and the surface's normal – picks between
them.

```quiz
Steep parallax mapping uses `numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)))`. When are the most layers used?
- [ ] When looking straight at the surface
- [ ] When the depth map is deepest
- [ ] Always 32: `mix` only rounds the value
- [x] At grazing angles: the dot product goes to 0, `mix` gives `maxLayers` (32); looking straight at the surface it is 1 and gives `minLayers` (8)
---
At a flat angle the ray travels far sideways through the depth range, crossing many texels, so it needs finer steps. Looking straight down it barely moves sideways; 8 layers are enough.
```

:::opengl
`ParallaxMapping` becomes:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{
    // number of depth layers
    const float minLayers = 8;
    const float maxLayers = 32;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * heightScale;
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
    float currentDepthMapValue = texture(depthMap, currentTexCoords).r;

    while(currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(depthMap, currentTexCoords).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

We first set things up: we specify the number of layers, calculate the depth offset of each layer, and finally
calculate the texture coordinate offset that we have to shift along the direction of P per layer. We then iterate
through all the layers, starting from the top, until we find a depthmap value less than the layer's depth value.

One thing to know about this loop: `texture()` picks a mip level from how fast the texture coordinates change between
neighbouring fragments – their *implicit derivatives*. Inside a loop whose number of steps differs from fragment to
fragment, neighbours may not be at the same step, and GLSL leaves the derivatives undefined there. learnopengl does it
anyway, and on most hardware it works; the strict version takes the derivatives of the original coordinates before the
loop (`dFdx`, `dFdy`) and samples with `textureGrad`. Now do the task **steep**.
:::
:::vulkan
`ParallaxMapping` becomes:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) {
    // number of depth layers
    const float minLayers = 8;
    const float maxLayers = 32;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * ubo.heightScale;
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
    float currentDepthMapValue = texture(depthMap, currentTexCoords).r;

    while (currentLayerDepth < currentDepthMapValue) {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(depthMap, currentTexCoords).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

We first set things up: we specify the number of layers, calculate the depth offset of each layer, and finally
calculate the texture coordinate offset that we have to shift along the direction of P per layer. We then iterate
through all the layers, starting from the top, until we find a depthmap value less than the layer's depth value.

One thing to know about this loop: `texture()` picks a mip level (and the anisotropic filter its footprint) from how
fast the texture coordinates change between neighbouring fragments – their *implicit derivatives*. Inside a loop whose
number of steps differs from fragment to fragment, neighbours may not be at the same step, and GLSL leaves the
derivatives undefined there. learnopengl does it anyway, and on most drivers it works; the strict version takes the
derivatives of the original coordinates before the loop (`dFdx`, `dFdy`) and samples with `textureGrad`. Now do the
task **steep**.
:::
:::d3d12
`ParallaxMapping` becomes:

```hlsl
float2 ParallaxMapping(float2 texCoords, float3 viewDir)
{
    // number of depth layers: more when the view is flat to the surface
    const float minLayers = 8.0f;
    const float maxLayers = 32.0f;
    float numLayers = lerp(maxLayers, minLayers, abs(dot(float3(0.0f, 0.0f, 1.0f), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0f / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0f;
    // the amount to shift the texture coordinates per layer (from vector P)
    float2 P = viewDir.xy / viewDir.z * heightScale;
    float2 deltaTexCoords = P / numLayers;

    // get initial values. SampleLevel(..., 0): mip level 0 - inside a loop whose number of
    // steps differs from pixel to pixel the hardware cannot work out the mip level (Sample
    // needs it from the neighbouring pixels), and the compiler refuses Sample there.
    float2 currentTexCoords = texCoords;
    float currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;

    while (currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

HLSL's `lerp` is GLSL's `mix`. We first set things up: we specify the number of layers, calculate the depth offset of
each layer, and finally calculate the texture coordinate offset that we have to shift along the direction of P per
layer. We then iterate through all the layers, starting from the top, until we find a depthmap value less than the
layer's depth value.

Note `SampleLevel(wrapSampler, uv, 0)` instead of `Sample`. `Sample` picks a mip level from how fast the texture
coordinates change between neighbouring pixels – the *gradients*, which the GPU gets by comparing the pixels of a 2 × 2
quad that run together. Inside a loop whose number of steps depends on a texture read, neighbouring pixels may be at
different steps, so there is no valid gradient. The HLSL compiler that `D3DCompileFromFile` uses knows that: a gradient
instruction in a loop with a varying number of iterations forces it to unroll the loop (warning X3570) – which it can't,
because the count isn't known – and the compile fails. `SampleLevel` names the mip level itself and needs no gradient.
Our textures have one mip level, so level 0 is exactly what `Sample` would read. With mipmaps, you'd take the gradients
of the original coordinates before the loop – `ddx(texCoords)`, `ddy(texCoords)` – and sample with `SampleGrad`. Now do
the task **steep**.
:::

:::opengl
```quiz
The steep parallax loop calls `texture()` a number of times that differs from fragment to fragment. What's the catch?
- [ ] `texture()` cannot be called in a `while` loop
- [ ] The loop is unrolled 32 times, whatever the number of layers
- [x] `texture()` picks the mip level from the implicit derivatives of the coordinates between neighbouring fragments, which GLSL leaves undefined when neighbours may take different paths through the loop; it usually works, `textureGrad` with derivatives taken before the loop is the strict version
- [ ] Each sample in the loop has to be normalized
---
Derivatives come from comparing neighbouring fragments that run together. If one fragment leaves the loop earlier than its neighbour, there is no common "current" coordinate to compare.
```
:::
:::vulkan
```quiz
The steep parallax loop calls `texture()` a number of times that differs from fragment to fragment. What's the catch?
- [x] `texture()` picks the mip level from the implicit derivatives of the coordinates between neighbouring fragments, which GLSL leaves undefined when neighbours may take different paths through the loop; it usually works, `textureGrad` with derivatives taken before the loop is the strict version
- [ ] `texture()` cannot be called in a `while` loop
- [ ] The loop is unrolled 32 times, whatever the number of layers
- [ ] Each sample in the loop has to be normalized
---
Derivatives come from comparing neighbouring fragments that run together. If one fragment leaves the loop earlier than its neighbour, there is no common "current" coordinate to compare.
```
:::
:::d3d12
```quiz
Why does the loop read the depth map with `SampleLevel(wrapSampler, uv, 0)` instead of `Sample`?
- [ ] `SampleLevel` is faster because it skips filtering
- [ ] `Sample` cannot read a `Texture2D` in a pixel shader
- [ ] `SampleLevel` wraps the coordinates, `Sample` clamps them
- [x] `Sample` needs gradients between neighbouring pixels to pick a mip level, and in a loop whose step count varies per pixel there are none – the compiler refuses it; `SampleLevel` names the level itself (with mipmaps, `SampleGrad` with gradients taken before the loop)
---
With one mip level, level 0 is what `Sample` would have read anyway, so the picture is the same as OpenGL's.
```
:::

Build and run: the **bricks get sharp, solid sides** – no more smearing. But look at the front sides: they're made of
**steps**, horizontal bands, one per layer. The ray stops at the first layer below the surface, so every depth in
between is rounded to a layer.

We can reduce the issue by taking a larger number of samples, but this quickly becomes too heavy a burden on
performance. There are several approaches that aim to fix this issue by not taking the first position that's below the
(displaced) surface, but by interpolating between the position's two closest depth layers to find a much closer match
to B.

## Parallax Occlusion Mapping

Two of the more popular of these approaches are called Relief Parallax Mapping and Parallax Occlusion Mapping of which
Relief Parallax Mapping gives the most accurate results, but is also more performance heavy compared to Parallax
Occlusion Mapping. Because Parallax Occlusion Mapping gives almost the same results and is more efficient it is often
the preferred approach.

Parallax Occlusion Mapping is based on the same principles as Steep Parallax Mapping, but instead of taking the texture
coordinates of the first depth layer after a collision, we're going to linearly interpolate between the depth layer
after and before the collision. We base the weight of the linear interpolation on how far the surface's depth is from
the depth value of both layers.

After the loop, the ray is just below the surface: `afterDepth` – the depth map's value minus the layer's depth – is 0 or
negative. One step back, the ray was still above it: `beforeDepth`, the same difference one layer earlier, is positive.
Where between the two steps does the difference cross zero? Assuming it changes linearly, at the fraction
`weight = afterDepth / (afterDepth - beforeDepth)` of the way back from the last step to the one before. The final
texture coordinates mix the two steps with that weight.

```quiz
In parallax occlusion mapping, `afterDepth = -0.03` and `beforeDepth = 0.01`. Where do the final texture coordinates lie?
- [ ] Exactly at `currentTexCoords`, the first step below the surface
- [x] Three quarters of the way back from `currentTexCoords` to `prevTexCoords`: `weight` = -0.03 / (-0.03 - 0.01) = 0.75, and `finalTexCoords = prevTexCoords * 0.75 + currentTexCoords * 0.25`
- [ ] Halfway between the two steps, always
- [ ] At `prevTexCoords`, the last step above the surface
---
The ray crosses the surface where the depth difference changes sign. It was 0.01 above and is 0.03 below, so the crossing is a quarter of the way from the step before to the step after – three quarters of the way back from the last step.
```

:::opengl
After the loop, instead of `return currentTexCoords;`:

```glsl
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
```

Now do the last task, **occlusion**.
:::
:::vulkan
After the loop, instead of `return currentTexCoords;`:

```glsl
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
```

Now do the last task, **occlusion**.
:::
:::d3d12
After the loop, instead of `return currentTexCoords;` – with `SampleLevel` here too, since it's still in the same
function after a varying loop:

```hlsl
    // get texture coordinates before collision (reverse operations)
    float2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = depthMap.SampleLevel(wrapSampler, prevTexCoords, 0).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    float2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0f - weight);

    return finalTexCoords;
```

Now do the last task, **occlusion**.
:::

Build and run: **the steps disappear** – the bricks' front sides become smooth gradients. The tops of the bricks and the
background are unchanged.

Parallax occlusion mapping gives surprisingly good results and although some slight artifacts and aliasing issues are
still visible, it's generally a good trade-off and only really visible when heavily zoomed in or looking at very steep
angles. Parallax mapping is a great technique to boost the detail of your scene, but does come with a few artifacts
you'll have to consider when using it. Most often, parallax mapping is used on floor or wall-like surfaces where it's
not as easy to determine the surface's outline and the viewing angle is most often roughly perpendicular to the
surface. This way, the artifacts of parallax mapping aren't as noticeable and make it an incredibly interesting
technique for boosting your objects' details.

## Additional resources

:::opengl
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengl's chapter this chapter
  follows, with the diagrams of points A and B, the layers and the interpolation.
- [parallax_occlusion_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/5.3.parallax_occlusion_mapping/parallax_occlusion_mapping.cpp):
  learnopengl's final program (with the Q and E keys for `heightScale`).
- [textureGrad](https://registry.khronos.org/OpenGL-Refpages/gl4/html/textureGrad.xhtml): sampling with explicit
  derivatives – the strict version of a lookup inside a loop.
:::
:::vulkan
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengl's chapter this chapter
  follows, with the diagrams of points A and B, the layers and the interpolation.
- [parallax_occlusion_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/5.3.parallax_occlusion_mapping/parallax_occlusion_mapping.cpp):
  learnopengl's final program (with the Q and E keys for `heightScale`).
- [Descriptor pool and sets](https://vulkan-tutorial.com/Uniform_buffers/Descriptor_pool_and_sets): vulkan-tutorial on
  descriptor sets, with a section on the alignment of uniform buffer members.
:::
:::d3d12
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengl's chapter this chapter
  follows, with the diagrams of points A and B, the layers and the interpolation.
- [SampleLevel](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplelevel) and
  [SampleGrad](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplegrad): sampling
  with a given mip level or given gradients.
- [HLSL errors and warnings](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/hlsl-errors-and-warnings):
  among them X3570, the gradient instruction in a loop with varying iteration.
:::
