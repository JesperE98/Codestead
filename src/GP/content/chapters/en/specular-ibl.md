# Specular IBL

In the previous chapter we've set up PBR in combination with image based lighting by pre-computing an irradiance map as
the lighting's indirect diffuse portion. In this chapter we'll focus on the specular part of the reflectance equation:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  ks · (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

You'll notice that the Cook-Torrance specular portion (multiplied by ks) isn't constant over the integral and is
dependent on the incoming light direction, but also the incoming view direction. Trying to solve the integral for all
incoming light directions including all possible view directions is a combinatorial overload and way too expensive to
calculate on a real-time basis. Epic Games proposed a solution where they were able to pre-convolute the specular part
for real time purposes, given a few compromises, known as the *split sum approximation*.

The split sum approximation splits the specular part of the reflectance equation into two separate parts that we can
individually convolute and later combine in the PBR shader for specular indirect image based lighting. Similar to how
we pre-convoluted the irradiance map, the split sum approximation requires an HDR environment map as its convolution
input. To understand the split sum approximation we'll again look at the reflectance equation, but this time focus on
the specular part:

```text
  Lo(p, ωo) = ∫Ω  ks · (D · F · G) / (4 · (ωo · n) · (ωi · n)) · Li(p, ωi) · (n · ωi)  dωi
            = ∫Ω  fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi)  dωi
```

For the same (performance) reasons as the irradiance convolution, we can't solve the specular part of the integral in
real time and expect a reasonable performance. So preferably we'd pre-compute this integral to get something like a
specular IBL map, sample this map with the fragment's normal, and be done with it. However, this is where it gets a bit
tricky. We were able to pre-compute the irradiance map as the integral only depended on ωi and we could move the
constant diffuse albedo terms out of the integral. This time, the integral depends on more than just ωi as evident from
the BRDF: the view direction ωo and the roughness as well. Pre-computing for every possible combination of ωi and ωo
isn't practical in a real-time setting.

Epic Games' split sum approximation solves the issue by splitting the pre-computation into 2 individual parts that we
can later combine to get the resulting pre-computed result we're after. The split sum approximation splits the
specular integral into two separate integrals:

```text
  Lo(p, ωo) ≈ ∫Ω Li(p, ωi) dωi  ·  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi
```

The first part (when convoluted) is known as the *pre-filtered environment map* which is (similar to the irradiance
map) a pre-computed environment convolution map, but this time taking roughness into account. For increasing roughness
levels, the environment map is convoluted with more scattered sample vectors, creating blurrier reflections. For each
roughness level we convolute, we store the sequentially blurrier results in the pre-filtered map's mipmap levels.

We generate the sample vectors and their scattering amount using the normal distribution function (NDF) of the
Cook-Torrance BRDF that takes as input both a normal and view direction. As we don't know beforehand the view direction
when convoluting the environment map, Epic Games makes a further approximation by assuming the view direction (and thus
the specular reflection direction) to be equal to the output sample direction ωo. This translates itself to the
following code:

```glsl
vec3 N = normalize(w_o);
vec3 R = N;
vec3 V = R;
```

This way, the pre-filtered environment convolution doesn't need to be aware of the view direction. This does mean we
don't get nice grazing specular reflections when looking at specular surface reflections from an angle; however this
is generally considered an acceptable compromise.

The second part of the split sum equation equals the BRDF part of the specular integral. If we pretend the incoming
radiance is completely white for every direction (thus L(p, x) = 1.0) we can pre-calculate the BRDF's response given an
input roughness and an input angle between the normal n and light direction ωi, or n · ωi. Epic Games stores the
pre-computed BRDF's response to each normal and light direction combination on varying roughness values in a 2D lookup
texture (LUT) known as the *BRDF integration map*. The 2D lookup texture outputs a scale (red) and a bias value (green)
to the surface's Fresnel response giving us the second part of the split specular integral.

We generate the lookup texture by treating the horizontal texture coordinate (ranged between 0.0 and 1.0) of a plane
as the BRDF's input n · ωi, and its vertical texture coordinate as the input roughness value. With this BRDF
integration map and the pre-filtered environment map we can combine both to get the result of the specular integral:

```glsl
float lod             = getMipLevelFromRoughness(roughness);
vec3 prefilteredColor = textureCubeLod(PrefilteredEnvMap, refVec, lod);
vec2 envBRDF          = texture2D(BRDFIntegrationMap, vec2(NdotV, roughness)).xy;
vec3 indirectSpecular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
```

(That is Epic's pseudocode; the real lines of this chapter's shader follow later.) This should give you a bit of an
overview on how Epic Games' split sum approximation roughly approaches the indirect specular part of the reflectance
equation. Let's now try and build the pre-convoluted parts ourselves.

```quiz
What does the split sum approximation split the specular integral into?
- [ ] A part for the metal spheres and a part for the non-metal ones
- [ ] The direct light of the four point lights and the indirect light of the environment
- [x] A pre-filtered environment map – the environment's light convolved with the GGX lobe for several roughness levels, assuming n = v = r – and a 2D BRDF integration map holding, for every NdotV and roughness, a scale and a bias for F0; the shader multiplies the two
- [ ] The red and the green channel of the environment, which are filtered separately
---
The full integral depends on the view direction and the roughness as well as on the light direction – too many inputs to tabulate. The product of two integrals, each with only two inputs besides the direction, can be stored in a cube map with mip levels and in a small 2D texture.
```

## The project

The project starts at the end of the previous chapter: the 7 × 7 red spheres, lit directly by the four point lights
and indirectly by the irradiance map, in front of the environment. New in it:

- **The screen quad**, learnopengl's `renderQuad()` of the earlier chapters: two triangles covering the render target,
  with texture coordinates from 0 to 1 – for the BRDF integration map.
- **`prefilter`** and **`brdf`** shaders with TODOs. The pre-filter shader already has `DistributionGGX` and the two
  functions of the Hammersley sequence (`RadicalInverse_VdC` and `Hammersley`), the BRDF shader the Hammersley
  functions; the screen quad's vertex shader is complete.
- **A debug shader** that shows a two-channel texture on the screen quad (`vec4(texture(image, TexCoords).rg, 0.0,
  1.0)`), to look at the BRDF integration map for a moment.
- The material's five maps for the last task.

Three numbers are smaller than learnopengl's, because the course draws its checks and expected results on the CPU (a
real GPU handles learnopengl's values easily): the pre-filter map has 64 × 64 texels per face instead of 128 × 128
(still with 5 mip levels), the pre-filter convolution and the BRDF integration take 128 samples instead of 1024, and the
BRDF integration map is 128 × 128 instead of 512 × 512.

:::opengl
The files are `prefilter.fs`, `brdf.vs` (complete), `brdf.fs`, `debug_quad.fs` (complete) and the five `.png` maps;
`renderQuad()` draws a triangle strip of 4 vertices with the texture coordinates (0, 0) at the bottom left and (1, 1) at
the top right.
:::
:::vulkan
The files are `shaders/prefilter.frag`, `shaders/brdf.vert` (complete), `shaders/brdf.frag`, `shaders/debug_quad.frag`
(complete) and the five maps in `textures/`. The screen quad is vertices 36–41 of the global `vertices` (learnopengl's
quad as two triangles, its texture coordinates unchanged) and `renderQuad(VkCommandBuffer)` draws it:
`vkCmdDraw(commandBuffer, 6, 1, 36, 0)`.
:::
:::d3d12
The files are `prefilter.hlsl` (its `cbuffer CaptureConstants` has a `float roughness` after the two matrices),
`brdf.hlsl` (`VSMain` complete), `downsample.hlsl` (`PSMain` TODO: it makes a mip level from the one above – more
below), `debug_quad.hlsl` (complete) and the five `.png` maps. The screen quad is vertices 36–39 of
`m_cubeVertexBuffer`, a triangle strip drawn by `RenderQuad()` (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)`,
`DrawInstanced(4, 1, 36, 0)`); its texture coordinates are learnopengl's with v flipped: (0, 0) at the **top** left,
(1, 1) at the bottom right.
:::

## Pre-filtering an HDR environment map

Pre-filtering an environment map is quite similar to how we convoluted an irradiance map. The difference being that we
now account for roughness and store sequentially rougher reflections in the pre-filtered map's mip levels.

First, we need to generate a new cubemap to hold the pre-filtered environment map data. To make sure we allocate enough
memory for its mip levels we create it with all of them:

:::opengl
```cpp
    unsigned int prefilterMap;
    glGenTextures(1, &prefilterMap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, prefilterMap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 64, 64, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR); // be sure to set minification filter to mip_linear
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // generate mipmaps for the cubemap so OpenGL automatically allocates the required memory.
    glGenerateMipmap(GL_TEXTURE_CUBE_MAP);
```

Note that because we plan to sample `prefilterMap`'s mipmaps you'll need to make sure its minification filter is set
to `GL_LINEAR_MIPMAP_LINEAR` to enable trilinear filtering. `glGenerateMipmap` is called here only to allocate the
levels: every one of them is rendered afterwards.
:::
:::vulkan
```cpp
        createCubemap(64, 5, prefilterImage, prefilterImageMemory, prefilterImageView);
```

`createCubemap` passes `mipLevels` to the image and to the cube view, which therefore covers all five levels; the
sampler `clampSampler` already filters linearly between mip levels, so sampling it with a fractional level is
trilinear filtering.
:::
:::d3d12
```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

– six array slices with five mip levels each, created in `RENDER_TARGET`. Its `TEXTURECUBE` SRV in heap slot 4 has
`MipLevels = 5`, and the static sampler s0 (`MIN_MAG_MIP_LINEAR`) filters between the levels: trilinear filtering.
:::

We store the pre-filtered specular reflections in the levels: level `mip` holds the environment blurred for the
roughness `mip / 4`, from 0 (64 × 64, a sharp reflection) to 1.0 (4 × 4, completely rough). The blurrier the
reflection, the less resolution it needs, so the shrinking mip levels fit well.

In the previous chapter we convoluted the environment map by generating sample vectors uniformly spread over the
hemisphere Ω using spherical coordinates. While this works just fine for irradiance, for specular reflections it's less
efficient. When it comes to specular reflections, based on the roughness of a surface, the light reflects closely or
roughly around a reflection vector r over a normal n, but (unless the surface is extremely rough) around the reflection
vector nonetheless. The general shape of possible outgoing light reflections is known as the *specular lobe*. As
roughness increases, the specular lobe's size increases; and the shape of the specular lobe changes on varying incoming
light directions. The shape of the specular lobe is thus highly dependent on the material.

When it comes to the microsurface model, we can imagine the specular lobe as the reflection orientation about the
microfacet halfway vectors given some incoming light direction. Seeing as most light rays end up in a specular lobe
reflected around the microfacet halfway vectors, it makes sense to generate the sample vectors in a similar fashion as
most would otherwise be wasted. This process is known as *importance sampling*.

### Monte Carlo integration and importance sampling

To fully get a grasp of importance sampling it's relevant we first delve into the mathematical construct known as
*Monte Carlo integration*. Monte Carlo integration revolves mostly around a combination of statistics and probability
theory. Monte Carlo helps us in discretely solving the problem of figuring out some statistic or value of a population
without having to take *all* of the population into consideration.

For instance, let's say you want to count the average height of all citizens of a country. To get your result, you
could measure every citizen and average their height which will give you the exact answer you're looking for. However,
since most countries have a considerable population this isn't a realistic approach: it would take too much effort and
time.

A different approach is to pick a much smaller completely random (unbiased) subset of this population, measure their
height, and average the result. This population could be as small as a 100 people. While not as accurate as the exact
answer, you'll get an answer that is relatively close to the ground truth. This is known as the *law of large numbers*.
The idea is that if you measure a smaller set of size N of truly random samples from the total population, the result
will be relatively close to the true answer and gets closer as the number of samples N increases.

Monte Carlo integration builds on this law of large numbers and takes the same approach in solving an integral. Rather
than solving an integral for all possible (theoretically infinite) sample values x, simply generate N sample values
randomly picked from the total population and average. As N increases, we're guaranteed to get a result closer to the
exact answer of the integral:

```text
                                       1    N−1  f(xi)
  O  =  ∫(a..b) f(x) dx   ≈   ---  ·   Σ    -------
                                       N    i=0  pdf(xi)
```

To solve the integral, we take N random samples over the population a to b, add them together, and divide by the total
number of samples to average them. The pdf stands for the *probability density function* that tells us the probability
a specific sample occurs over the total sample set. For instance, the pdf of the height of a population would show that
heights around the average are much more likely than very small or very large ones.

When it comes to Monte Carlo integration, some samples may have a higher probability of being generated than others.
This is why for any general Monte Carlo estimation we divide or multiply the sampled value by the sample probability
according to a pdf. So far, in each of our cases of estimating an integral, the samples we've generated were uniform,
having the exact same chance of being generated. Our estimations so far were *unbiased*, meaning that given an
ever-increasing amount of samples we will eventually *converge* to the exact solution of the integral.

However, some Monte Carlo estimators are *biased*, meaning that the generated samples aren't completely random, but
focused towards a specific value or direction. These biased Monte Carlo estimators have a *faster rate of convergence*,
meaning they can converge to the exact solution at a much faster rate, but due to their biased nature it's likely they
won't ever converge to the exact solution. This is generally an acceptable tradeoff, especially in computer graphics,
as the exact solution isn't too important as long as the results are visually acceptable. As we'll soon see with
importance sampling (which uses a biased estimator), the generated samples are biased towards specific directions in
which case we account for this by multiplying or dividing each sample by its corresponding pdf.

Monte Carlo integration is quite prevalent in computer graphics as it's a fairly intuitive way to approximate
continuous integrals in a discrete and efficient fashion: take any area/volume to sample over (like the hemisphere Ω),
generate N amount of random samples within the area/volume, and sum and weigh every sample contribution to the final
result.

Monte Carlo integration is an extensive mathematical topic and I won't delve much further into the specifics, but
we'll mention that there are multiple ways of generating the *random samples*. By default, each sample is completely
(pseudo)random as we're used to, but by utilizing certain properties of semi-random sequences we can generate sample
vectors that are still random, but have interesting properties. For instance, we can do Monte Carlo integration on
something called *low-discrepancy sequences* which still generate random samples, but each sample is more evenly
distributed. When using a low-discrepancy sequence for generating the Monte Carlo sample vectors, the process is known
as *Quasi-Monte Carlo integration*. Quasi-Monte Carlo methods have a faster rate of convergence which makes them
interesting for performance heavy applications.

Given our newly obtained knowledge of Monte Carlo and Quasi-Monte Carlo integration, there is an interesting property
we can use for an even faster rate of convergence known as *importance sampling*. We've mentioned it before in this
chapter, but when it comes to specular reflections of light, the reflected light vectors are constrained in a specular
lobe with its size determined by the roughness of the surface. Seeing as any (quasi-)randomly generated sample outside
the specular lobe isn't relevant to the specular integral it makes sense to focus the sample generation to within the
specular lobe, at the cost of making the Monte Carlo estimator biased.

This is in essence what importance sampling is about: generate sample vectors in some region constrained by the
roughness oriented around the microfacet's halfway vector. By combining Quasi-Monte Carlo sampling with a
low-discrepancy sequence and biasing the sample vectors using importance sampling, we get a high rate of convergence.
Because we reach the solution at a faster rate, we'll need significantly fewer samples to reach an approximation that
is sufficient enough.

```quiz
Why does the pre-filter convolution generate its sample directions with GGX importance sampling instead of spreading them evenly over the hemisphere, as the irradiance convolution does?
- [x] For a specular reflection only the directions inside the specular lobe around the reflection vector matter; generating the samples where the GGX distribution is large puts almost all of them there, so 128 samples give a usable result where evenly spread ones would mostly be wasted
- [ ] Because evenly spread samples can't be computed in a shader
- [ ] Because importance sampling makes the result exactly correct, with no approximation
- [ ] Because the pre-filter map is smaller than the irradiance map
---
The narrower the lobe – the smoother the surface –, the more an even spread would waste. Each sample's contribution has to be weighed by its probability (the pdf) to keep the estimate right; the pre-filter shader weighs by `NdotL` and uses the pdf to pick a mip level.
```

### A low-discrepancy sequence

In this chapter we'll pre-compute the specular portion of the indirect reflectance equation using importance sampling
given a random low-discrepancy sequence based on the Quasi-Monte Carlo method. The sequence we'll be using is known as
the *Hammersley Sequence* as carefully described by Holger Dammertz. The Hammersley sequence is based on the
*Van Der Corput* sequence which mirrors a decimal binary representation around its decimal point.

Given some neat bit tricks, we can quite efficiently generate the Van Der Corput sequence in a shader program which
we'll use to get a Hammersley sequence sample i over N total samples – these functions are already in the project:

:::opengl vulkan
```glsl
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits)
{
     bits = (bits << 16u) | (bits >> 16u);
     bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
     bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
     bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
     bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
     return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
vec2 Hammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}
```

The GLSL `Hammersley` function gives us the low-discrepancy sample i of the total sample set of size N. The integer
operations – shifts, masks, `uint` – need GLSL 1.30 or later, which both OpenGL 3.3 and Vulkan's GLSL 4.50 have.
:::
:::d3d12
```hlsl
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits)
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
float2 Hammersley(uint i, uint N)
{
    return float2(float(i) / float(N), RadicalInverse_VdC(i));
}
```

The `Hammersley` function gives us the low-discrepancy sample i of the total sample set of size N. `uint` arithmetic
with shifts and masks is plain HLSL from shader model 4 on (the project compiles `ps_5_0`).
:::

Reversing the bits of i mirrors its binary digits around the binary point: 1 = 0.1₂ becomes 0.5, 2 = 0.01₂ becomes
0.25, 3 = 0.11₂ becomes 0.75, and so on. Each new sample falls into the largest gap the earlier ones left, so the
points cover the square evenly, without the clumps of random numbers.

```quiz
`Hammersley(i, N)` returns `(i / N, RadicalInverse_VdC(i))`. What does `RadicalInverse_VdC` do with the sample number, and why is that useful?
- [ ] It returns a pseudo-random number from a hash of i, different on every frame
- [ ] It converts i from sRGB to linear
- [ ] It returns i / N a second time, so that both coordinates grow together
- [x] It mirrors the binary digits of i around the binary point (bit reversal): 1, 2, 3 become 0.5, 0.25, 0.75 …; together with i / N this gives points that cover the unit square evenly – a low-discrepancy sequence – and the same points on every run
---
That is the Van der Corput sequence in base 2. Evenly spread sample points make the Monte Carlo estimate converge faster than random ones (Quasi-Monte Carlo), and being deterministic, the pre-filtered map comes out the same every time.
```

### GGX importance sampling

Instead of uniformly or randomly (Monte Carlo) generating sample vectors over the integral's hemisphere Ω, we'll
generate sample vectors biased towards the general reflection orientation of the microsurface halfway vector based on
the surface's roughness. The sampling process will be similar to what we've seen before: begin a large loop, generate a
random (low-discrepancy) sequence value, take the sequence value to generate a sample vector in tangent space, transform
to world space, and sample the scene's radiance. What's different is that we now use a low-discrepancy sequence value
as input to generate a sample vector:

```glsl
const uint SAMPLE_COUNT = 128u;
for(uint i = 0u; i < SAMPLE_COUNT; ++i)
{
    vec2 Xi = Hammersley(i, SAMPLE_COUNT);
```

Additionally, to build a sample vector, we need some way of orienting and biasing the sample vector towards the
specular lobe of some surface roughness. We can take the NDF as described in the *PBR Theory* chapter and combine the
GGX NDF in the spherical sample vector process as described by Epic Games:

:::opengl vulkan
```glsl
vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
    float a = roughness*roughness;

    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates - halfway vector
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space H vector to world-space sample vector
    vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent   = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);

    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}
```
:::
:::d3d12
```hlsl
float3 ImportanceSampleGGX(float2 Xi, float3 N, float roughness)
{
    float a = roughness * roughness;

    float phi = 2.0f * PI * Xi.x;
    float cosTheta = sqrt((1.0f - Xi.y) / (1.0f + (a * a - 1.0f) * Xi.y));
    float sinTheta = sqrt(1.0f - cosTheta * cosTheta);

    // from spherical coordinates to cartesian coordinates - halfway vector
    float3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space H vector to world-space sample vector
    float3 up        = abs(N.z) < 0.999f ? float3(0.0f, 0.0f, 1.0f) : float3(1.0f, 0.0f, 0.0f);
    float3 tangent   = normalize(cross(up, N));
    float3 bitangent = cross(N, tangent);

    float3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}
```
:::

This gives us a sample vector somewhat oriented around the expected microsurface's halfway vector based on some input
roughness and the low-discrepancy sequence value Xi. Note that Epic Games uses the squared roughness for better visual
results as based on Disney's original PBR research. The formula for cos θ is the inverse of the GGX distribution's
cumulative distribution: evenly spread values of Xi.y become values of θ that are spread as the NDF is – densely near
the normal for a smooth surface, widely for a rough one. Xi.x simply turns the sample round the normal.

With the low-discrepancy Hammersley sequence and sample generation defined, we can finalize the pre-filter convolution
shader. The sampled halfway vector is turned into a light direction by reflecting the view vector around it, and the
environment is sampled in that direction:

:::opengl
```glsl
void main()
{
    vec3 N = normalize(WorldPos);

    // make the simplifying assumption that V equals R equals the normal
    vec3 R = N;
    vec3 V = R;

    const uint SAMPLE_COUNT = 128u;
    vec3 prefilteredColor = vec3(0.0);
    float totalWeight = 0.0;

    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0)
        {
            // sample from the environment's mip level based on roughness/pdf
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);

            prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;

    FragColor = vec4(prefilteredColor, 1.0);
}
```

`roughness` is a uniform, set per mip level.
:::
:::vulkan
`prefilter.frag` is the same GLSL as learnopengl's, with `fragWorldPos` as the input, `outColor` as the output and the
roughness from the capture pass's push constants:

```glsl
// the push constants of a capture pass: the roughness comes after the matrix
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
    float roughness;
} pc;
```

`main` starts by copying the roughness into a local variable, so the rest reads like learnopengl's:

```glsl
    vec3 N = normalize(fragWorldPos);
    float roughness = pc.roughness;
```

and the heart of the loop – for each of the 128 samples – is:

```glsl
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if (NdotL > 0.0) {
            // sample from the environment's mip level based on roughness/pdf
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);

            prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
```

and at the end `prefilteredColor / totalWeight` is written.
:::
:::d3d12
```hlsl
    float3 N = normalize(input.worldPos);

    // make the simplifying assumption that V equals R equals the normal
    float3 R = N;
    float3 V = R;

    const uint SAMPLE_COUNT = 128u;
    float3 prefilteredColor = float3(0.0f, 0.0f, 0.0f);
    float totalWeight = 0.0f;

    for (uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
        float2 Xi = Hammersley(i, SAMPLE_COUNT);
        float3 H = ImportanceSampleGGX(Xi, N, roughness);
        float3 L = normalize(2.0f * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0f);
        if (NdotL > 0.0f)
        {
            // sample from the environment's mip level based on roughness/pdf
            float D     = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0f);
            float HdotV = max(dot(H, V), 0.0f);
            float pdf = D * NdotH / (4.0f * HdotV) + 0.0001f;

            float resolution = 128.0f; // resolution of source cubemap (per face)
            float saTexel  = 4.0f * PI / (6.0f * resolution * resolution);
            float saSample = 1.0f / (float(SAMPLE_COUNT) * pdf + 0.0001f);

            float mipLevel = roughness == 0.0f ? 0.0f : 0.5f * log2(saSample / saTexel);

            prefilteredColor += environmentMap.SampleLevel(clampSampler, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;
```

`roughness` comes from the cbuffer `CaptureConstants` (root constants), set per mip level. The level is computed, so
`SampleLevel` is the natural call here – and a loop with a data-dependent branch doesn't allow `Sample` anyway.
:::

We pre-filter the environment, based on some input roughness that varies over each mipmap level of the pre-filter
cubemap (from 0.0 to 1.0), and store the result in `prefilteredColor`. The resulting `prefilteredColor` is divided by
the total sample weight, where samples with less influence on the final result (for small NdotL) contribute less to the
final weight.

### Pre-filter convolution artifacts

While the above pre-filtering process works fine for most purposes, there are some artifacts to be aware of; learnopengl
lists them, together with their solutions, and the course's code already contains both solutions.

#### Cubemap seams at high roughness

Sampling the pre-filter map on surfaces with a rough surface means sampling the pre-filter map on some of its lower
mip levels. When sampling cubemaps, OpenGL by default doesn't linearly interpolate across cubemap faces. Because the
lower mip levels are both of a lower resolution and the pre-filter map is convoluted with a much larger sample lobe,
the lack of between-cube-face filtering becomes quite apparent: visible seams along the edges of the faces.

:::opengl
Luckily for us, OpenGL gives us the option to properly filter across cubemap faces by enabling
`GL_TEXTURE_CUBE_MAP_SEAMLESS`:

```cpp
    glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS);
```

Simply enable this property somewhere at the start of your application and the seams will be gone.
:::
:::vulkan
Vulkan has nothing to switch on: it always filters across the edges of a cube map's faces, as OpenGL does with
`GL_TEXTURE_CUBE_MAP_SEAMLESS` enabled.
:::
:::d3d12
Direct3D has nothing to switch on: it always filters across the edges of a cube map's faces, as OpenGL does with
`GL_TEXTURE_CUBE_MAP_SEAMLESS` enabled.
:::

#### Bright dots in the pre-filter convolution

Due to high frequency details and wildly varying light intensities in specular reflections, convoluting the specular
reflections requires a large number of samples to properly account for the wildly varying nature of HDR environmental
reflections. We already take a very large number of samples, but on some environments it may still not be enough at
some of the rougher mip levels in which case you'll start seeing dotted patterns emerge around bright areas. The
course's environment is exactly such a case: its sun is small and about 60 times brighter than white, and with 128
samples per texel some texels hit it and others miss it.

One option is to further increase the sample count, but this won't be enough for all environments. As described by
Chetan Jags we can reduce this artifact by (during the pre-filter convolution) not directly sampling the environment
map, but sampling a mip level of the environment map based on the integral's pdf and the roughness:

```glsl
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);
```

Each sample stands for a part of the sphere of directions: about `1 / (SAMPLE_COUNT · pdf)` steradians (`saSample`),
large where samples are rare. A texel of the environment's level 0 covers `4π / (6 · 128²)` steradians (`saTexel`). If a
sample stands for 4 texels' worth of directions, it should read the average of those 4 – one mip level up, because each
level averages 2 × 2 texels of the one before: hence `0.5 · log2(saSample / saTexel)`. A small bright sun is then
spread over the sample's area instead of being hit or missed. (The pdf of a GGX sample, converted from the halfway
vector to the light direction, is `D · (n · h) / (4 · (h · v))`.)

Don't forget to enable trilinear filtering on the environment map you want to sample its mip levels from – and, first
of all, to give it mip levels at all: until now the environment cube map had only level 0.

:::opengl
```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR); // enable pre-filter mipmap sampling (combatting visible dots artifact)
```

(in the block that creates `envCubemap`, instead of `GL_LINEAR`).

And let OpenGL generate the mipmaps after the cubemap's base texture is set:

```cpp
    // then let OpenGL generate mipmaps from first mip face (combatting visible dots artifact)
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
    glGenerateMipmap(GL_TEXTURE_CUBE_MAP);
```

`glGenerateMipmap` builds every level from the one before it, with a box filter: each texel is the average of 2 × 2
texels of the bigger level. The irradiance convolution, which runs after it, now reads the environment through its mip
levels as well (`texture` picks one from the screen-space derivatives); its picture changes by a level or so.
:::
:::vulkan
Vulkan has no `glGenerateMipmap` either, but the project has had its counterpart since the PBR Lighting chapter:
`generateMipmaps`, vulkan-tutorial's function, which fills every level with a `vkCmdBlitImage` of the level above it
(a scaled copy with linear filtering). It takes a layer count, so it does all six faces at once. The environment cube
map is created with 8 levels (128, 64 … 1) and with two more usages – a blit reads one level of the image and writes
another, so the image must be a transfer source and destination:

```cpp
        createCubemap(128, 8, envCubemapImage, envCubemapImageMemory, envCubemapImageView);
```

with `VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT` added to the usage in `createCubemap`, and
right after the conversion:

```cpp
        // then generate mipmaps from first mip face (combatting visible dots artifact) - learnopengl: glGenerateMipmap(GL_TEXTURE_CUBE_MAP)
        generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6);
```

The conversion's render pass leaves level 0 in `SHADER_READ_ONLY_OPTIMAL`; `generateMipmaps` turns each level into a
transfer source, the next one into a destination, blits, and leaves both ready for sampling again. The sampler already
filters between mip levels. The irradiance convolution, which runs after it, now reads the environment through its mip
levels as well (`texture` picks one from the derivatives); its picture changes by a level or so.
:::
:::d3d12
Direct3D 12 has no `glGenerateMipmap`: the project makes the levels by drawing. `m_envCubemap` gets `EnvMipLevels = 8`
levels (128, 64 … 1; `Tex2D(…, 6, EnvMipLevels, …)`, and its SRV `TextureCube.MipLevels = EnvMipLevels`). After the
conversion has drawn level 0, every level `mip` = 1 … 7 is drawn from level `mip - 1` with the six capture views and
`downsample.hlsl`, whose pixel shader is a single lookup:

```hlsl
    float3 color = environmentMap.Sample(clampSampler, input.worldPos).rgb;
```

A pixel of the smaller face lies exactly between 2 × 2 texels of the larger one, so the linear filter returns their
average – the box filter of `glGenerateMipmap`. Two rules of Direct3D 12 shape the loop:

- **A level can't be read while it is drawn into.** The pass doesn't read through the cube map's SRV of all levels but
  through one that shows only the level above: `TextureCube.MostDetailedMip = mip - 1`, `TextureCube.MipLevels = 1`,
  created in heap slot `6 + (mip - 1)` (slots 6–12; the heap grows to 13 descriptors) and set as table 2.
- **Resource states are per subresource.** Each face of each level is a subresource of its own,
  `D3D12CalcSubresource(mip, face, 0, EnvMipLevels, 6)` = `mip + face · 8`. After a level's six faces are drawn, six
  barriers turn just those from `RENDER_TARGET` into `PIXEL_SHADER_RESOURCE` – the smaller levels are still to be drawn:

```cpp
            CD3DX12_RESOURCE_BARRIER barriers[6];
            for (UINT i = 0; i < 6; ++i)
            {
                barriers[i] = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12CalcSubresource(mip, i, 0, EnvMipLevels, 6));
            }
            m_commandList->ResourceBarrier(6, barriers);
```

(after the conversion the same with level 0). Per level: `SetCaptureTarget(m_envCubemap.Get(), i, mip)` and the
viewport `128 >> mip`. The pipeline state `m_downsamplePipelineState` is the conversion's with `downsample.hlsl` as the
pixel shader. The irradiance convolution keeps reading level 0 (`SampleLevel(…, 0.0f)`), unlike OpenGL's `texture`,
which now picks a blurrier level there; the irradiance map differs by a few levels at most.
:::

:::opengl
```quiz
learnopengl's fix for the bright dots samples the environment at a mip level chosen from each sample's pdf. What does the environment cube map need for that, and how does the OpenGL project give it to it?
- [ ] Nothing: the pre-filter map's own mip levels are sampled
- [x] Mip levels of its own, each the 2 × 2 average of the level above; OpenGL makes them with `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` right after the six faces have been captured, and the minification filter `GL_LINEAR_MIPMAP_LINEAR` lets `textureLod` blend between them
- [ ] A second, blurred copy of the environment, rendered with a Gaussian blur
- [ ] A higher resolution: the mip level trick only works with 512 × 512 faces
---
Without mip levels `textureLod(environmentMap, L, mipLevel)` would read level 0 whatever `mipLevel` says, and the dots would come back.
```
:::
:::vulkan
```quiz
learnopengl's fix for the bright dots samples the environment at a mip level chosen from each sample's pdf. What does the environment cube map need for that, and how does the Vulkan project give it to it?
- [ ] Nothing: the pre-filter map's own mip levels are sampled
- [ ] A second, blurred copy of the environment, rendered with a Gaussian blur
- [ ] A different sampler only: `VK_SAMPLER_MIPMAP_MODE_LINEAR` computes the levels while sampling
- [x] Mip levels of its own: the image is created with 8 levels and `TRANSFER_SRC | TRANSFER_DST` usage, and `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6)` blits each level into the next for all six layers, right after the conversion
---
A sampler only chooses and blends between levels that exist. `vkCmdBlitImage` with linear filtering halves each level, as `glGenerateMipmap` does; the barriers in `generateMipmaps` make each blit wait for the one before.
```
:::
:::d3d12
```quiz
learnopengl's fix for the bright dots samples the environment at a mip level chosen from each sample's pdf. What does the environment cube map need for that, and how does the Direct3D 12 project give it to it?
- [x] Mip levels of its own: 8 levels in the resource, each drawn from the one above with `downsample.hlsl` through an SRV that shows only that level (`MostDetailedMip = mip - 1`, `MipLevels = 1`), with per-subresource barriers turning each finished level into a shader resource
- [ ] Nothing: the pre-filter map's own mip levels are sampled
- [ ] A call to `GenerateMips` on the command list after the conversion
- [ ] A second, blurred copy of the environment, rendered with a Gaussian blur
---
Direct3D 12 has no mipmap generation call; drawing (or a compute shader) does it. A level being drawn into is in the RENDER_TARGET state and must not be read, which the single-level views and the per-subresource states make sure of.
```
:::

### Capturing pre-filter mipmap levels

What's left to do is let the API pre-filter the environment map with different roughness values over multiple mipmap
levels. This is actually fairly easy to do with the original setup of the irradiance chapter:

:::opengl
```cpp
    prefilterShader.use();
    prefilterShader.setInt("environmentMap", 0);
    prefilterShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    unsigned int maxMipLevels = 5;
    for (unsigned int mip = 0; mip < maxMipLevels; ++mip)
    {
        // resize framebuffer according to mip-level size.
        unsigned int mipWidth  = static_cast<unsigned int>(64 * std::pow(0.5, mip));
        unsigned int mipHeight = static_cast<unsigned int>(64 * std::pow(0.5, mip));
        glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, mipWidth, mipHeight);
        glViewport(0, 0, mipWidth, mipHeight);

        float roughness = (float)mip / (float)(maxMipLevels - 1);
        prefilterShader.setFloat("roughness", roughness);
        for (unsigned int i = 0; i < 6; ++i)
        {
            prefilterShader.setMat4("view", captureViews[i]);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, prefilterMap, mip);

            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            renderCube();
        }
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The process is similar to the irradiance map convolution, but this time we scale the framebuffer's dimensions to the
appropriate mipmap scale, each mip level reducing the dimensions by a scale of 2. Additionally, we specify the mip
level we're rendering into in `glFramebufferTexture2D`'s last parameter and pass the roughness we're pre-filtering for
to the pre-filter shader.
:::
:::vulkan
`renderToCubemap` gets three parameters instead of `size`: the mip level to draw into, the size of that level and the
roughness. The face views use the level – `viewInfo.subresourceRange.baseMipLevel = mipLevel;` – and the push
constants carry the roughness – `constants.roughness = roughness;` (`CapturePushConstants` has `float roughness` after
the matrix now). The calls of the previous chapter become `(…, envCubemapImage, 0, 128, 0.0f)` and `(…,
irradianceImage, 0, 32, 0.0f)`, and after the irradiance pass `initVulkan()` runs learnopengl's loop:

```cpp
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip) {
            // the size of the mip level: each one half the one before
            unsigned int mipWidth = static_cast<unsigned int>(64 * std::pow(0.5, mip));

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            renderToCubemap(prefilterPipeline, envDescriptorSet, prefilterImage, mip, mipWidth, roughness);
        }
```

`prefilterPipeline` is `createPipeline("shaders/cubemap.vert.spv", "shaders/prefilter.frag.spv", captureRenderPass,
VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, prefilterPipeline)`; the pass reads the environment through `envDescriptorSet`,
whose cube view now covers all 8 levels. Each call is its own one-time command buffer, submitted and waited for.
:::
:::d3d12
```cpp
        m_commandList->SetPipelineState(m_prefilterPipelineState.Get());
        // The texture the pass reads (root parameter 2): the environment cube map with all
        // its mip levels, heap slot 2.
        CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip)
        {
            // resize the viewport according to mip-level size.
            unsigned int mipWidth  = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            unsigned int mipHeight = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(mipWidth), static_cast<float>(mipHeight));
            CD3DX12_RECT scissorRect(0, 0, static_cast<LONG>(mipWidth), static_cast<LONG>(mipHeight));
            m_commandList->RSSetViewports(1, &viewport);
            m_commandList->RSSetScissorRects(1, &scissorRect);

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            captureConstants.roughness = roughness;
            for (unsigned int i = 0; i < 6; ++i)
            {
                XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
                m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
                // The render target: face i of mip level mip.
                SetCaptureTarget(m_prefilterMap.Get(), i, mip);

                RenderCube();
            }
        }

        // The pre-filter map is complete, all its levels: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_prefilterMap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

`SetCaptureTarget`'s `mip` parameter, unused so far, now names the level: the render target view's
`Texture2DArray.MipSlice`. `CaptureConstants` has a third member, `float roughness`, so it holds 33 values. The
pre-filter map is simpler than the environment's mip chain: all its levels are only written in this pass, so one barrier
for the whole resource at the end is enough.
:::

For now, show the pre-filter map as the background: bind it instead of the environment map for the background draw and
let the background shader sample mip level **1.2** instead of 0.0 – between the levels for the roughness 0.25 and 0.5.
Now do the first task, **prefilter-map**.

Build and run: the background is **a blurred environment**. The sky is still blue-grey at the top, the hills are smeared
away, and at the bottom left there is a large warm glow: an orange lamp of the environment, just outside the view on the
left, spread out by the blur. There are no bright speckles anywhere – the mip-level trick at work. The spheres hardly
change; the irradiance map is now made from an environment with mip levels.

## Pre-computing the BRDF

With the pre-filtered environment up and running, we can focus on the second part of the split-sum approximation: the
BRDF. Let's briefly review the specular split sum approximation again:

```text
  Lo(p, ωo) ≈ ∫Ω Li(p, ωi) dωi  ·  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi
```

We've pre-computed the left part of the split sum approximation in the pre-filter map over different roughness levels.
The right side requires us to convolute the BRDF equation over the angle n · ωo, the surface roughness, and Fresnel's
F0. This is similar to integrating the specular BRDF with a solid-white environment or a constant radiance Li of 1.0.
Convoluting the BRDF over 3 variables is a bit much, but we try to move F0 out of the specular BRDF equation:

```text
  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi  =  ∫Ω fr(p, ωi, ωo) · F(ωo, h) / F(ωo, h) · (n · ωi) dωi
```

With F being the Fresnel equation. Moving the Fresnel denominator to the BRDF gives us the following equivalent
equation:

```text
  ∫Ω fr(p, ωi, ωo) / F(ωo, h) · F(ωo, h) · (n · ωi) dωi
```

Substituting the right-most F with the Fresnel-Schlick approximation gives us:

```text
  ∫Ω fr(p, ωi, ωo) / F(ωo, h) · (F0 + (1 − F0) · (1 − ωo · h)⁵) · (n · ωi) dωi
```

Let's replace (1 − ωo · h)⁵ by α to make it easier to solve for F0:

```text
  ∫Ω fr / F · (F0 + (1 − F0) · α) · (n · ωi) dωi
  = ∫Ω fr / F · (F0 + α − F0 · α) · (n · ωi) dωi
  = ∫Ω fr / F · (F0 · (1 − α) + α) · (n · ωi) dωi
```

Then we split the Fresnel function F over two integrals:

```text
  = ∫Ω fr / F · F0 · (1 − α) · (n · ωi) dωi  +  ∫Ω fr / F · α · (n · ωi) dωi
```

This way, F0 is constant over the integral and we can take F0 out of the integral. Next, we substitute α back to its
original form giving us the final split sum BRDF equation:

```text
  = F0 · ∫Ω fr(p, ωi, ωo) · (1 − (1 − ωo · h)⁵) · (n · ωi) dωi  +  ∫Ω fr(p, ωi, ωo) · (1 − ωo · h)⁵ · (n · ωi) dωi
```

The two resulting integrals represent a scale and a bias to F0 respectively. Note that as fr(p, ωi, ωo) already
contains a term for F they both cancel out, removing F from fr.

In a similar fashion to the earlier convoluted environment maps, we can convolute the BRDF equations on their inputs:
the angle between n and ωo, and the roughness. We store the convoluted results in a 2D lookup texture (LUT) known as a
BRDF integration map that we later use in our PBR lighting shader to get the final convoluted indirect specular
result.

The BRDF convolution shader operates on a 2D plane, using its 2D texture coordinates directly as inputs to the BRDF
convolution (NdotV and roughness). The convolution code is largely similar to the pre-filter convolution, except that
it now processes the sample vector according to our BRDF's geometry function and Fresnel-Schlick's approximation:

:::opengl vulkan
```glsl
vec2 IntegrateBRDF(float NdotV, float roughness)
{
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    vec3 N = vec3(0.0, 0.0, 1.0);

    const uint SAMPLE_COUNT = 128u;
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the
        // preferred alignment direction (importance sampling).
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}
```

and `main` writes `IntegrateBRDF(TexCoords.x, TexCoords.y)` (`fragTexCoord` in Vulkan) – the output is a `vec2`, for a
two-channel target.
:::
:::d3d12
```hlsl
float2 IntegrateBRDF(float NdotV, float roughness)
{
    float3 V;
    V.x = sqrt(1.0f - NdotV * NdotV);
    V.y = 0.0f;
    V.z = NdotV;

    float A = 0.0f;
    float B = 0.0f;

    float3 N = float3(0.0f, 0.0f, 1.0f);

    const uint SAMPLE_COUNT = 128u;
    for (uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the
        // preferred alignment direction (importance sampling).
        float2 Xi = Hammersley(i, SAMPLE_COUNT);
        float3 H = ImportanceSampleGGX(Xi, N, roughness);
        float3 L = normalize(2.0f * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0f);
        float NdotH = max(H.z, 0.0f);
        float VdotH = max(dot(V, H), 0.0f);

        if (NdotL > 0.0f)
        {
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0f - VdotH, 5.0f);

            A += (1.0f - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return float2(A, B);
}

float2 PSMain(PSInput input) : SV_TARGET
{
    float2 integratedBRDF = IntegrateBRDF(input.texCoords.x, input.texCoords.y);
    return integratedBRDF;
}
```

`PSMain` returns a `float2`: the render target has two channels.
:::

As you can see, the BRDF convolution is a direct translation from the mathematics to code. We take both the angle θ and
the roughness as input, generate a sample vector with importance sampling, process it over the geometry and the derived
Fresnel term of the BRDF, and output both a scale and a bias to F0 for each sample, averaging them in the end. The view
vector is built from NdotV in a tangent space whose normal is +z; only the angle matters, not the direction round the
normal.

You may recall from the *PBR Theory* chapter that the geometry term of the BRDF is slightly different when used
alongside IBL as its k variable has a slightly different interpretation:

```text
               (α + 1)²                       α²
  k_direct  =  --------           k_IBL  =  ----
                  8                           2
```

Since the BRDF convolution is part of the specular IBL integral we'll use k_IBL for the Schlick-GGX geometry function:

:::opengl vulkan
```glsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    // note that we use a different k for IBL
    float a = roughness;
    float k = (a * a) / 2.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
```
:::
:::d3d12
```hlsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    // note that we use a different k for IBL
    float a = roughness;
    float k = (a * a) / 2.0f;

    float nom   = NdotV;
    float denom = NdotV * (1.0f - k) + k;

    return nom / denom;
}
```
:::

`GeometrySmith` is the one of the PBR Lighting chapter. Note that while k takes `a` as its parameter we didn't square
roughness as `a` as we originally did for other interpretations of `a`; likely as `a` is squared here already. I'm not
sure whether this is an inconsistency on Epic Games' part or the original Disney paper, but directly translating
roughness to `a` gives the BRDF integration map that is identical to Epic Games' version.

Finally, to store the BRDF convolution result we'll generate a 2D texture of a 128 by 128 resolution (learnopengl: 512
by 512) with two 16-bit floating point channels, and render the screen quad into it once:

:::opengl
```cpp
    unsigned int brdfLUTTexture;
    glGenTextures(1, &brdfLUTTexture);

    // pre-allocate enough memory for the LUT texture.
    glBindTexture(GL_TEXTURE_2D, brdfLUTTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RG16F, 128, 128, 0, GL_RG, GL_FLOAT, 0);
    // be sure to set wrapping mode to GL_CLAMP_TO_EDGE
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

Note that we use a 16-bit precision floating format as recommended by Epic Games. Be sure to set the wrapping mode to
`GL_CLAMP_TO_EDGE` to prevent edge sampling artifacts. Then, we re-use the same framebuffer object and run this shader
over an NDC screen-space quad:

```cpp
    // then re-configure capture framebuffer object and render screen-space quad with BRDF shader.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 128, 128);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, brdfLUTTexture, 0);

    glViewport(0, 0, 128, 128);
    brdfShader.use();
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    renderQuad();

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

The quad's texture coordinate (0, 0) is at its bottom left, which OpenGL writes into the texture's first row – v = 0 is
roughness 0, and a lookup with v = roughness reads it there.
:::
:::vulkan
The image is `VK_FORMAT_R16G16_SFLOAT` (learnopengl's `GL_RG16F`), 128 × 128, a colour attachment that can be sampled:

```cpp
createImage(128, 128, 1, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, brdfLUTImage, brdfLUTImageMemory);
```

with a view from `createImageView(brdfLUTImage, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT, 1)`. A pipeline is
made for a render pass whose formats it knows, so the lookup texture needs a render pass of its own – the same helper
with the other format, `createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass)` –, and `brdfPipeline` is made
for it (`brdf.vert` + `brdf.frag`, triangle list). `renderBrdfLUT()` creates a framebuffer with the image's view and
records the one pass into a one-time command buffer:

```cpp
        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // brdf.vert and brdf.frag read no uniform buffer, no image and no push constants: nothing else to bind
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, brdfPipeline);
        renderQuad(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the lookup texture is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

with a 128 × 128 viewport and scissor; `initVulkan()` calls it after the pre-filter loop. The sampler is `clampSampler`
(linear, `CLAMP_TO_EDGE`). The quad's vertex with the texture coordinates (0, 0) is at NDC (-1, -1), which Vulkan writes
into row 0 – v = 0, roughness 0 –, exactly the texel OpenGL writes it to (its row 0 is the bottom): the texture holds
the same data in both APIs, and a lookup with v = roughness reads it there.
:::
:::d3d12
The texture is `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, 1, 0,
D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` (learnopengl's `GL_RG16F`), created in `RENDER_TARGET`, with a
`TEXTURE2D` SRV in heap slot 5. `m_brdfPipelineState` has `brdf.hlsl`'s two shaders and `RTVFormats[0] =
DXGI_FORMAT_R16G16_FLOAT`. The pass draws the quad once, into a render target view written into the capture passes'
RTV slot:

```cpp
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_brdfLUTTexture.Get(), nullptr, rtvHandle);
        m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f);
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        m_commandList->SetPipelineState(m_brdfPipelineState.Get());
        RenderQuad();
```

followed by the barrier to `PIXEL_SHADER_RESOURCE`. A `nullptr` view description means: the whole resource, in its own
format. The quad's texture coordinate v = 0 is at its top, which Direct3D writes into the first row – so the first row
is roughness 0, and a lookup with v = roughness reads it there, as in OpenGL, where both "first rows" are at the
bottom.
:::

This gives us a 2D lookup texture. Its horizontal axis is NdotV, from 0 (left, grazing) to 1 (right, head-on), and its
vertical axis the roughness, from 0 to 1. The red channel is the scale of F0, the green channel the bias: looking
straight at a surface (right) F0 counts fully and the scale is near 1; at grazing angles on smooth surfaces (bottom
left) the bias takes over – everything reflects, whatever F0 is; rough surfaces (top) reflect less overall.

To look at it, draw the screen quad over the whole window at the end of the frame with the debug shader, which writes
`(lut.r, lut.g, 0.0, 1.0)` as it is – no tone mapping, no gamma:

:::opengl
```cpp
    Shader debugQuad("brdf.vs", "debug_quad.fs");
```

with `debugQuad.setInt("image", 0);`, and at the end of the frame `debugQuad.use()`, `brdfLUTTexture` bound to unit 0
and `renderQuad()`. The quad's v = 0 is the window's bottom, so the picture shows roughness 0 at the bottom.
:::
:::vulkan
`debugQuadPipeline` is `brdf.vert` + `debug_quad.frag` for the window's render pass; `brdfLUTDescriptorSet` holds the
lookup texture (the pool grows to 6 sets), and `recordCommandBuffer()` draws `renderQuad(commandBuffer)` with them last.
The window's y points down, so `debug_quad.frag` flips v to put roughness 0 at the bottom, as in OpenGL's picture:

```glsl
    // v = 0 (roughness 0) at the bottom of the window, as in a graph: the window's y points down in Vulkan, so v is flipped
    outColor = vec4(texture(image, vec2(fragTexCoord.x, 1.0 - fragTexCoord.y)).rg, 0.0, 1.0);
```

Only the *showing* is flipped; the texture's data is the same as OpenGL's.
:::
:::d3d12
`m_debugQuadPipelineState` is `brdf.hlsl`'s `VSMain` with `debug_quad.hlsl`'s `PSMain`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM` and `DSVFormat = DXGI_FORMAT_D32_FLOAT` (the window's pass binds the depth buffer; the depth
test stays off, as in the capture states). It is created right after `m_brdfPipelineState`. `PopulateCommandList` draws
`RenderQuad()` with it last, table 2 = heap slot 5. The quad's v = 0 is the window's top, so `debug_quad.hlsl` flips v
to put roughness 0 at the bottom, as in OpenGL's picture:

```hlsl
    return float4(image.Sample(clampSampler, float2(input.texCoords.x, 1.0f - input.texCoords.y)).rg, 0.0f, 1.0f);
```

Only the *showing* is flipped; the texture's data matches OpenGL's.
:::

Now do the task **brdf-lut**. Build and run: **the red-green lookup texture fills the window** (the quad lies in front
of everything; blue is 0 everywhere). Red on the right and at the bottom, darker red towards the top, and a green-yellow
corner at the bottom left.

```quiz
In the BRDF integration map, what do the horizontal axis, the vertical axis and the two channels hold?
- [ ] u = the roughness, v = NdotV; red = the diffuse part, green = the specular part
- [x] u = NdotV, v = the roughness; red = the scale applied to F0, green = the bias added to it – so the specular IBL term is `prefilteredColor * (F * brdf.x + brdf.y)`
- [ ] u = the u of the sphere's texture coordinates, v = its v; red and green are the light's colour
- [ ] u = NdotL, v = NdotH; red = D, green = G
---
F0 could be moved out of the integral because the Fresnel-Schlick term is linear in F0: what remains are two integrals of two variables each, stored as two channels of one 2D texture.
```

:::opengl
```quiz
OpenGL writes the screen quad's texture coordinate (0, 0) into the lookup texture's first row. Why does the lookup in the PBR shader, `texture(brdfLUT, vec2(NdotV, roughness))`, read the right texel?
- [ ] It doesn't: the shader has to use `1.0 - roughness`
- [ ] Because the texture is symmetric in v
- [x] Because in OpenGL both the quad's v = 0 (its bottom, NDC y = -1) and a texture's v = 0 are the first row, so the row written for roughness 0 is the row read for roughness 0; the debug quad shows it the same way round, roughness 0 at the bottom of the window
- [ ] Because `GL_CLAMP_TO_EDGE` maps v = roughness onto the right row
---
Writing and reading agree on what "row 0" is, which is all that matters. The Vulkan and Direct3D 12 projects get the same data, but must flip v when they *show* the texture, because their window's first row is the top.
```
:::
:::vulkan
```quiz
`debug_quad.frag` samples the lookup texture at `1.0 - fragTexCoord.y`, but the PBR shader looks it up at `vec2(NdotV, roughness)` without a flip. Why is that not a contradiction?
- [x] The texture's data is the same as OpenGL's: the quad's v = 0 is at NDC y = -1, which Vulkan writes into row 0, so row 0 is roughness 0, and the lookup reads it there; only showing it in the window, whose first row is the top, needs the flip to put roughness 0 at the bottom like OpenGL's picture
- [ ] It is one: the spheres' reflections come out upside down
- [ ] The PBR shader flips v elsewhere, in `fresnelSchlickRoughness`
- [ ] `clampSampler` flips v for 2D images
---
The capture pass and the lookup agree on what row 0 means. Flipping v in the PBR shader would read roughness 1 for a smooth surface – the smooth spheres would get the rough spheres' dull reflections.
```
:::
:::d3d12
```quiz
The Direct3D 12 screen quad has its texture coordinate (0, 0) at the top left, learnopengl's has it at the bottom left. Why does the lookup `brdfLUT.Sample(clampSampler, float2(NdotV, roughness))` still read the right texel?
- [ ] It doesn't: the PBR shader has to use `1.0f - roughness`
- [ ] Because the static sampler flips v for 2D textures
- [x] Because Direct3D writes the quad's top – v = 0 – into the texture's first row, and a lookup with v = 0 reads the first row too: row 0 is roughness 0 when written and when read; only showing the texture in the window needs the flip in `debug_quad.hlsl`, to put roughness 0 at the bottom like OpenGL's picture
- [ ] Because `R16G16_FLOAT` textures are stored bottom-up
---
Flipping the quad's v was what made the data match OpenGL's: in both APIs the first row holds roughness 0. The debug view is for people, who expect the graph's origin at the bottom left.
```
:::

## Completing the IBL reflectance

To get the indirect specular part of the reflectance equation up and running we need to stitch both parts of the split
sum approximation together. Let's start by adding the pre-computed lighting data to the top of our PBR shader:

:::opengl
```glsl
uniform samplerCube prefilterMap;
uniform sampler2D brdfLUT;
```

on texture units 1 and 2 (`pbrShader.setInt("prefilterMap", 1);`, `pbrShader.setInt("brdfLUT", 2);`, and in the loop
`prefilterMap` bound to `GL_TEXTURE1` and `brdfLUTTexture` to `GL_TEXTURE2`, after the irradiance map on unit 0).
:::
:::vulkan
```glsl
layout(binding = 2) uniform samplerCube prefilterMap;
layout(binding = 3) uniform sampler2D brdfLUT;
```

The layout gets three image bindings – 1, 2, 3: `irradianceMap`, `prefilterMap`, `brdfLUT`, learnopengl's texture units
0, 1, 2 – (`std::array<VkDescriptorSetLayoutBinding, 4>`), the pool `5 * 3` image samplers, and `createDescriptorSet()`
writes the three views in a loop (`dstBinding = i + 1`, `clampSampler` for each). The single-image sets of the capture
passes and the background leave the other bindings empty; their shaders don't use them.
:::
:::d3d12
```hlsl
TextureCube prefilterMap : register(t1);
Texture2D brdfLUT : register(t2);
```

They get a table of their own: `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 1)` (two SRVs from t1 on) and
`rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`. The pre-filter map and the
lookup texture are next to each other in the heap (slots 4 and 5), so one handle covers both:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE prefilterMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 4, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, prefilterMap);
```

before the spheres. t0 keeps its own table: the capture passes read their one texture there, and a table that also
covered t1 and t2 would point at textures that are still being drawn into while those passes run.
:::

First, we get the indirect specular reflections of the surface by sampling the pre-filtered environment map using the
reflection vector `R = reflect(-V, N)`. Note that we sample the appropriate mip level based on the surface roughness,
giving rougher surfaces blurrier specular reflections:

```glsl
void main()
{
    [...]
    vec3 R = reflect(-V, N);

    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureLod(prefilterMap, R,  roughness * MAX_REFLECTION_LOD).rgb;
    [...]
}
```

In the pre-filter step we only convoluted the environment map up to a maximum of 5 mip levels (0 to 4), which we denote
here as `MAX_REFLECTION_LOD` to ensure we don't sample a mip level where there's no (relevant) data. A roughness of 0.3
reads level 1.2, between the levels made for 0.25 and 0.5 – the trilinear filter blends them.

Then we sample from the BRDF lookup texture given the material's roughness and the angle between the normal and view
vector:

```glsl
vec3 F        = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
vec2 envBRDF  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
```

Given the scale and bias to F0 (here we're directly using the indirect Fresnel result F) from the BRDF lookup texture,
we combine this with the left pre-filter portion of the IBL reflectance equation and re-construct the approximated
integral result as `specular`.

This gives us the indirect specular part of the reflectance equation. Now, combine this with the diffuse IBL part of the
reflectance equation from the last chapter and we get the full PBR IBL result:

:::opengl vulkan
```glsl
    // ambient lighting (we now use IBL as the ambient term)
    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);

    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;

    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse    = irradiance * albedo;

    // sample both the pre-filter map and the BRDF lut and combine them together as per the Split-Sum approximation to get the IBL specular part.
    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureLod(prefilterMap, R,  roughness * MAX_REFLECTION_LOD).rgb;
    vec2 brdf  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    vec3 ambient = (kD * diffuse + specular) * ao;
```
:::
:::d3d12
```hlsl
    // ambient lighting (we now use IBL as the ambient term)
    float3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness);

    float3 kS = F;
    float3 kD = 1.0f - kS;
    kD *= 1.0f - metallic;

    float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb;
    float3 diffuse    = irradiance * albedo;

    // sample both the pre-filter map and the BRDF lut and combine them together as per the Split-Sum approximation to get the IBL specular part.
    const float MAX_REFLECTION_LOD = 4.0f;
    float3 prefilteredColor = prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD).rgb;
    float2 brdf = brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg;
    float3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    float3 ambient = (kD * diffuse + specular) * ao;
```

with `float3 R = reflect(-V, N);` after `V`. `textureLod` becomes `SampleLevel`.
:::

Note that we don't multiply `specular` by kS as we already have a Fresnel multiplication in there.

```quiz
The shader reads the pre-filter map with `textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD)` and `MAX_REFLECTION_LOD = 4.0`. What does a sphere with roughness 0.3 read?
- [ ] Mip level 0.3, the sharpest level with a little blur from the filter
- [ ] Mip level 4, the blurriest one, because every roughness above 0 is rough
- [ ] The level whose size is 0.3 × 64 texels
- [x] Mip level 1.2: the trilinear filter blends levels 1 and 2, which were pre-filtered for the roughness 0.25 and 0.5 – each level holds the environment blurred for roughness = level / 4, so roughness × 4 finds the right place between them
---
The pre-filter loop rendered level `mip` with `roughness = mip / 4`; reading level `roughness * 4` inverts that. The background of the task prefilter-map showed exactly level 1.2.
```

Remove the debug quad again (its shader object or pipeline, and its draw), and show the environment map as the
background again at level 0.0. Now do the task **specular**.

Build and run: **the spheres reflect the environment**. On the smooth spheres of the left columns you see the sky in the
upper half and the darker ground in the lower half, with the horizon between them; a large white spot up and to the
right of the centre is the sun, which is behind the camera; small coloured spots near the rims are the lamps; and the
four point lights' dots are still there. Towards the right the reflection blurs into a soft sheen. The metal rows
reflect in their own red colour, and green and blue appear on the spheres for the first time: the specular reflection of
non-metals is not tinted by the albedo. This is learnopengl's `2.2.1.ibl_specular`.

The whole scene – direct light, diffuse IBL, specular IBL – costs the spheres' fragment shader three texture lookups
for the environment; everything expensive happened once, before the first frame.

## Textured spheres

learnopengl's last demo, `2.2.2.ibl_specular_textured`, puts textured materials on the spheres: five spheres of five
materials (rusted iron, gold, grass, plastic and a wall). The course has one material, its riveted steel with rust, and
shows it on the 3 × 3 grid of large spheres of the PBR Lighting chapter's last task, so the reflections can be compared
at different places in the environment. The edits are the same as there – the five maps, `getNormalFromMap()` with the
vertex tangent, the albedo converted with `pow(…, 2.2)`, the grid with spacing 6.0, each sphere scaled by 2.4 and
turned by 90° about y – except where the maps go, because the IBL textures come first:

:::opengl
The maps take the texture units 3–7 (learnopengl's numbering): `pbrShader.setInt("albedoMap", 3);` …
`pbrShader.setInt("aoMap", 7);`, and in the loop `glActiveTexture(GL_TEXTURE3)` … `glActiveTexture(GL_TEXTURE7)` after
the IBL textures.
:::
:::vulkan
The maps take the bindings 4–8 (learnopengl's units 3–7) with `textureSampler` (repeat), the IBL images keep 1–3 with
`clampSampler`: the layout has 9 bindings, the pool `5 * 8` image samplers, and `createDescriptorSet()` writes eight
images – `imageViews = {irradianceImageView, prefilterImageView, brdfLUTImageView, albedoImageView, normalImageView,
metallicImageView, roughnessImageView, aoImageView}` with `samplers = {clampSampler, clampSampler, clampSampler,
textureSampler, textureSampler, textureSampler, textureSampler, textureSampler}`.
:::
:::d3d12
The maps take heap slots 13–17 (the heap grows to 18) and the registers t3–t7, in a table of their own:
`ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 3)`, `rootParameters[4].InitAsDescriptorTable(1, &ranges[3],
D3D12_SHADER_VISIBILITY_PIXEL)`, set with the handle at slot 13. They need a wrapping sampler, the IBL textures a
clamping one, so there is a second static sampler, `samplers[1] = samplers[0];` with WRAP in u, v and w and
`ShaderRegister = 1` (`SamplerState wrapSampler : register(s1);`). `ModelConstants` shrinks to the two matrices, 32
values – one fewer than `CaptureConstants`' 33 –, so root parameter 0 becomes `InitAsConstants(sizeof(CaptureConstants)
/ 4, …)`: the root constants must hold the largest struct sent through them.
:::

Now do the last task, **textured**. Build and run: nine large spheres of **riveted steel with rust in front of the
sky**. The steel plates reflect the environment softly – bluish from the sky in the upper halves, darker below, a bright
sheen where the sun and the point lights reflect –, the grooves and the four rivets around each sphere's middle catch
the light on the sides that face it, and the rust patches stay matt orange-brown, now lit by the irradiance map
(brighter than in the PBR Lighting chapter, where only the constant ambient term reached them). Compare the spheres: the
ones at the top reflect more sky, the ones at the bottom more ground. This is the solution, and the end of learnopengl's
PBR chapters.

## What's next?

Hopefully, by the end of this chapter you should have a pretty clear understanding of what PBR is about, and even have
an actual PBR renderer up and running. In these chapters, we've pre-computed all the relevant PBR image based lighting
data at the start of our application, before the render loop. This was fine for educational purposes, but not too great
for any practical use of PBR. First, the pre-computation only really has to be done once, not at every startup. And
second, the moment you use multiple environment maps you'll have to pre-compute each and every one of them at every
startup which tends to build up.

For this reason you'd generally pre-compute an environment map into an irradiance and pre-filter map just once, and
then store it on disk (note that the BRDF integration map isn't dependent on an environment map so you only need to
calculate or load it once). This does mean you'll need to come up with a custom image format to store HDR cubemaps,
including their mip levels. Or, you'll store (and load) it as one of the available formats (like `.dds` that supports
storing mip levels).

Furthermore, we've described the total process in these chapters, including generating the pre-computed IBL images to
help further our understanding of the PBR pipeline. But, you'll be just as fine by using several great tools like
cmftStudio or IBLBaker to generate these pre-computed maps for you.

One point we've skipped over is pre-computed cubemaps as *reflection probes*: cubemap interpolation and parallax
correction. This is the process of placing several reflection probes in your scene that take a cubemap snapshot of the
scene at that specific location, which we can then convolute as IBL data for that part of the scene. By interpolating
between several of these probes based on the camera's vicinity we can achieve local high-detail image-based lighting
that is simply limited by the amount of reflection probes we're willing to place. This way, the image-based lighting
could correctly update when moving from a bright outdoor section of a scene to a darker indoor section, for instance.

## Further reading

- *Real Shading in Unreal Engine 4* by Brian Karis: explains Epic Games' split sum approximation, which this chapter
  follows, and the importance sampled GGX.
- *Physically Based Shading and Image Based Lighting* by Trent Reed, *Implementation Notes: Runtime Environment Map
  Filtering for Image Based Lighting* by Padraic Hennessy, and Holger Dammertz's notes on the Hammersley points on the
  hemisphere – all linked from learnopengl's chapter.

:::opengl
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengl's chapter this chapter follows,
  with pictures of the pre-filter levels, the bright dots and the BRDF integration map.
- [ibl_specular.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/2.2.1.ibl_specular/ibl_specular.cpp):
  learnopengl's program.
- [glGenerateMipmap](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenerateMipmap.xhtml): what it does for a
  cube map.
:::
:::vulkan
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengl's chapter this chapter follows,
  with pictures of the pre-filter levels, the bright dots and the BRDF integration map.
- [Generating Mipmaps](https://vulkan-tutorial.com/Generating_Mipmaps): vulkan-tutorial's `generateMipmaps`, used here
  for the six layers of the environment cube map.
- [vkCmdBlitImage](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdBlitImage.html): the scaled, filtered
  copy that makes each mip level.
:::
:::d3d12
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengl's chapter this chapter follows,
  with pictures of the pre-filter levels, the bright dots and the BRDF integration map.
- [Subresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/subresources): mip slices, array slices and
  `D3D12CalcSubresource`.
- [Using resource barriers to synchronize resource states](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  barriers, also for single subresources.
:::
