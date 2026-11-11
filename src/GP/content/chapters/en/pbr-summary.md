# Review: PBR

Congratulations on reaching the end of the *PBR* part – and of learnopengl's lighting chapters. You started with the
theory of microfacets and the reflectance equation; since then you have turned the Cook-Torrance BRDF into a shader
for four point lights, step by step from a matt Lambertian sphere to learnopengl's grid of plastic and metal spheres,
given the spheres a textured material of riveted steel with rust, converted an HDR image into an environment cube map,
convoluted it into an irradiance map for the diffuse ambient light, and added the specular ambient light with a
pre-filtered environment map and a BRDF integration map – Epic Games' split sum approximation. This page is a glossary
of the most important terms of the part, chapter by chapter, like the reviews learnopengl.com has at the end of its
sections. Use it to look things up, and as a check: if a definition surprises you, go back to the chapter it comes from.

PBR is maths in the shaders plus textures computed in advance; the maths is the same in every API, so most of this page
is outside the boxes. What differs is how {{api}} does the work that happens once before the first frame: rendering
into the faces and mip levels of cube maps, making mip levels, and drawing into a two-channel lookup texture. In OpenGL
one framebuffer object gets a different face or level attached for each pass, and everything runs at once when it is
called. In Vulkan each face (and level) gets an image view and a framebuffer, the passes are recorded into one-time
command buffers in `initVulkan()` and submitted and waited for, and pipelines are made for one render pass and one
topology. In Direct3D 12 each face (and level) gets a render target view written into one reused descriptor, the passes
are recorded into the command list in `LoadAssets` and executed before the first frame, and barriers – per subresource
where needed – turn render targets into shader resources. When you're done, the exam at the end of the part checks what
you've learned.

## PBR Theory

- **Physically based rendering**: a lighting model that approximates how light behaves, so that one set of material
  parameters looks right under any light. Three conditions: based on the **microfacet model**, **energy conserving**,
  and a **physically based BRDF**. The course follows Disney's and Epic Games' approach, the **metallic workflow**.
- **Microfacets**: a surface is modelled as tiny perfect mirrors; the **roughness** (0 to 1) describes statistically how
  chaotically they are aligned. A rough surface spreads its reflection – wider and dimmer –, a smooth one concentrates
  it – small and bright. The **halfway vector** h = normalize(l + v) is the microfacet orientation that reflects l into v.
- **Energy conservation**: the outgoing light never exceeds the incoming light. Reflected (specular) and refracted
  (diffuse) light are mutually exclusive: `kD = 1.0 - kS`. Metals absorb all refracted light – no diffuse colour.
  Refracted light that scatters inside and leaves elsewhere is **subsurface scattering**, which PBR here ignores.
- **Radiometry**: **radiant flux** Φ (energy per time, watts; in graphics an RGB triplet), **solid angle** ω (the area of
  a shape projected on the unit sphere, in steradians; a hemisphere is 2π), **radiant intensity** I = dΦ/dω,
  **radiance** L = d²Φ / (dA · dω · cos θ) (the light along one ray, scaled by the incident angle), **irradiance** (the
  sum of all incoming radiance at a point).
- **The reflectance equation**: `Lo(p, ωo) = ∫Ω fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi) dωi` – the outgoing radiance in the
  view direction is the integral over the hemisphere Ω of the incoming radiance, weighted by the BRDF fr and the cosine
  n · ωi. With no analytic solution it is solved numerically – a **Riemann sum** of discrete steps.
- **BRDF**: the bidirectional reflective distribution function fr(ωi, ωo) – how much light from ωi is reflected into ωo.
  Blinn-Phong is a BRDF too, but doesn't conserve energy.
- **Cook-Torrance**: `fr = kd · c / π + ks · (D · F · G) / (4 · (ωo · n) · (ωi · n))`. The diffuse part is **Lambertian**,
  c / π – the π normalizes it; the cosine is outside the BRDF, in the equation. Because F already is the reflected
  fraction, ks is not multiplied in again: `(kd · c / π + D · F · G / (4 · (ωo · n) · (ωi · n))) · Li · (n · ωi)`.
- **NDF D, Trowbridge-Reitz GGX**: `α² / (π · ((n · h)² · (α² − 1) + 1)²)` – the share of microfacets aligned with h. With
  α = roughness² (Disney's and Epic's remapping, so the roughness changes the look evenly).
- **Geometry function G, Schlick-GGX with Smith's method**: `G_sub(n, v, k) = (n · v) / ((n · v) · (1 − k) + k)`,
  `G = G_sub(n, v, k) · G_sub(n, l, k)` – self-shadowing (light direction) and obstruction (view direction) of the
  microfacets. `k_direct = (α + 1)² / 8`, `k_IBL = α² / 2`, with α the roughness in the code.
- **Fresnel F, Fresnel-Schlick**: `F0 + (1 − F0) · (1 − (h · v))⁵` – every surface reflects more at grazing angles.
  **F0**, the base reflectivity at normal incidence: dielectrics 0.02–0.17 and untinted, metals 0.5–1.0 and tinted.
- **Metallic workflow**: `F0 = mix(vec3(0.04), albedo, metallic)` – 0.04 for every non-metal, the albedo for metals – and
  `kD *= 1.0 - metallic`.
- **PBR materials**: **albedo** (the colour or, for metals, F0; no lighting in it; sRGB, so converted to linear),
  **normal** (tangent-space normal map), **metallic**, **roughness** (some engines use smoothness = 1 − roughness), **AO**
  (ambient occlusion of the material). Metallic, roughness and AO are linear data. The course's material is riveted
  steel with rust (learnopengl: rusted iron): the steel metallic and smoother, the rust a rough dielectric.

## PBR Lighting

- **Radiance of a point light**: only one direction ωi carries light, so the integral becomes a sum over the lights:
  `radiance = lightColor * attenuation`, multiplied by `NdotL` in the equation. A directional light has a constant ωi
  and no attenuation; a spotlight's intensity depends on its direction.
- **Inverse-square law**: `attenuation = 1.0 / (distance * distance)`, physically correct in linear space. Hence the
  lights' (300, 300, 300): about 17 units away, 1/300 brings them back to about 1.0.
- **The scene**: learnopengl's 7 × 7 spheres, 2.5 apart, `metallic = row / 7` (bottom 0),
  `roughness = clamp(col / 7, 0.05, 1.0)` (a roughness of exactly 0 would make a point light's highlight infinitely
  small), albedo (0.5, 0, 0), ao 1.0; four lights at (±10, ±10, 10). The course's camera is at (0, 0, 22) (learnopengl:
  (0, 0, 3), inside the grid), the sphere has 24 × 24 segments (learnopengl: 64 × 64 – the course draws its checks and
  expected results on the CPU), no multisampling.
- **The UV sphere**: 25 × 25 vertices on a (u, v) grid, normal = position, and here a vertex **tangent**
  (-sin 2πu, 0, cos 2πu) – the direction in which u grows. **Indexed triangle strip**: the rows walked in a zigzag,
  1200 indices; each index after the first two makes a triangle with the two before it.
- **The steps of the shader**: `lambert` (matt red, all spheres alike), `ndf` (white highlights that grow with the
  roughness – the NDF alone reflects more than arrives), `geometry` (G and the denominator: the rough spheres no longer
  white), `fresnel` (F, F0 and kD: the rows differ, metals lose their diffuse light and get red highlights), `tone-map`
  (Reinhard and gamma: learnopengl's picture), `textured`.
- **Linear and HDR**: the lighting is computed with linear, unbounded values; `color / (color + 1.0)` (Reinhard) maps it
  into 0..1, then `pow(color, 1.0 / 2.2)` encodes it – once, last. Without a post-processing pass both happen at the end
  of the forward shader.
- **Textured PBR**: albedo `pow(…, 2.2)` (an sRGB texture would do the same in the sampler), metallic, roughness and ao
  from the red channel. The normal through a **TBN** built from the interpolated normal and vertex tangent:
  `T = normalize(T - dot(T, N) * N)` (Gram-Schmidt), `B = cross(N, T)`. learnopengl derives T from screen-space
  derivatives (`dFdx` / `dFdy`) instead; the vertex tangent is smooth, needs no derivatives, and works the same in
  every API. 3 × 3 large spheres (spacing 6, scale 2.4, turned 90° about y so the texture's middle faces the camera).

:::opengl
- **The strip**: `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – the primitive type is part of
  the draw call.
- **Uniforms**: the lights as `lightPositions[i]` / `lightColors[i]` – every element of a uniform array has its own
  location; `normalMatrix` a `mat3` uniform per sphere.
- **The maps**: `loadTexture` (flipped on load, mipmaps, `GL_REPEAT`), samplers on texture units 0–4.
:::
:::vulkan
- **The strip**: `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` – the topology is part of the pipeline;
  `cullMode = VK_CULL_MODE_NONE`.
- **Per sphere**: push constants `{ mat4 model; float metallic; float roughness; }` (72 bytes, vertex and fragment
  stage); the vertex shader computes the normal matrix itself.
- **std140**: the light arrays are `vec4` (array elements 16 bytes apart); a float fits after a `vec3` (`albedo` + `ao`,
  `camPos` + `pad1`).
- **The maps**: `loadTexture` flips on load and makes all mip levels with `generateMipmaps` (`vkCmdBlitImage`, Vulkan's
  `glGenerateMipmap`); five combined image samplers at bindings 1–5 with one REPEAT `textureSampler`.
:::
:::d3d12
- **The strip**: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)` in the command list; the pipeline state's
  `PrimitiveTopologyType` is `TRIANGLE` for lists and strips alike.
- **Per sphere**: 38 root constants (`model`, `normalMatrix` = `XMMatrixInverse(nullptr, model)` stored for HLSL, the
  material); `albedo` and `metallic` share a 16-byte row.
- **Light arrays**: `float4` in the constant buffer – each array element starts a new 16-byte row.
- **Texture coordinates**: `(xSegment, 1 - ySegment)`, because the images are not flipped (Direct3D's v = 0 is the top
  row). `float3x3(T, B, N)` has T, B, N as rows: `mul(tangentNormal, TBN)`.
- **The maps**: `LoadTexture` with one mip level (no `glGenerateMipmap`), five SRVs in heap slots 1–5, a table t0–t4 and
  a static WRAP sampler.
:::

## Diffuse Irradiance

- **Image based lighting (IBL)**: the environment as one big light source – every texel of an environment cube map a
  light emitter. A form of ambient light that takes the surroundings into account.
- **Splitting the integral**: the reflectance equation's diffuse and specular parts are independent; the diffuse one is
  `kd · c / π · ∫Ω Li(p, ωi) · (n · ωi) dωi`, an integral that depends only on the normal's direction.
- **Convolution and the irradiance map**: computing that integral once for every direction and storing it in a cube map
  – the **irradiance map**, sampled with the normal: `texture(irradianceMap, N)`. 32 × 32 per face is enough: it changes
  slowly. It assumes p is at the map's centre; engines place **reflection probes** to light different places.
- **HDR environment**: the **Radiance `.hdr`** format stores floats (8 bits per channel with a shared exponent); most
  environments are **equirectangular** – longitude across, latitude up. `stbi_loadf` returns floats; the course's
  `environment.hdr` (512 × 256: sky, a hazy sun of radiance about 60, hills, ground, three lamps; learnopengl:
  `newport_loft.hdr`). Every texture on the way is floating point, or the sun would be clipped at 1.0.
- **Equirectangular to cube map**: a cube drawn from its centre with a 90° projection, aspect 1, and six views (+x, -x,
  +y, -y, +z, -z with the ups (0, -1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0) – the cube map faces
  have their image origin at the top left); `SampleSphericalMap`: `uv = (atan(z, x), asin(y)) · (1/2π, 1/π) + 0.5`.
  128 × 128 per face here (learnopengl 512 × 512).
- **The background**: the cube around the camera with the view's rotation only, `xyww` (depth 1.0), depth function
  less-or-equal, drawn last; the HDR colour tone-mapped and gamma-corrected.
- **The convolution**: for each texel, N = the direction; the hemisphere around it in spherical coordinates, φ in 0..2π,
  θ in 0..π/2, step `sampleDelta = 0.1` (learnopengl 0.025: 1008 samples per texel instead of about 16,000); each sample
  weighted by `cos θ` (the n · ωi) and `sin θ` (the smaller area near the top: dω = sin θ dθ dφ); the result
  `PI * irradiance / nrSamples` – the π from the step sizes cancels the Lambertian 1/π.
- **The ambient term**: `kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)` (no single halfway vector;
  the roughness term `max(1 − roughness, F0)` keeps rough rims from shining), `kD = (1 − kS) · (1 − metallic)`,
  `ambient = kD · irradiance · albedo · ao`. Non-metals are lit by the sky; metals hardly change – their ambient light is
  specular.

:::opengl
- **The capture**: one `captureFBO` with a depth renderbuffer; per face `glFramebufferTexture2D(GL_FRAMEBUFFER,
  GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, 0)`; the viewport set to the face size and back to
  the window's afterwards. All before the render loop.
- **Formats**: `GL_RGB16F` for the HDR texture and the cube maps, `GL_CLAMP_TO_EDGE`, `GL_LINEAR`.
- **Depth**: `glDepthFunc(GL_LEQUAL)` for the background.
:::
:::vulkan
- **The capture**: `createCaptureRenderPass(format, …)` – one colour attachment, no depth, loadOp DONT_CARE (the cube
  covers every pixel), finalLayout `SHADER_READ_ONLY_OPTIMAL`; `createCubemap` – six array layers,
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, a `VK_IMAGE_VIEW_TYPE_CUBE` view; `renderToCubemap` – a 2D view of one layer
  (`baseArrayLayer = i`) and a framebuffer per face, six render passes in a one-time command buffer
  (`beginSingleTimeCommands` / `endSingleTimeCommands`), called in `initVulkan()` before the first frame.
- **Per face**: the matrix as a push constant (`CapturePushConstants`) – a uniform buffer can't change between the draws
  of one command buffer.
- **No y flip in the capture projection**: a capture pass writes NDC y = -1 into row 0 in Vulkan as OpenGL does in its
  own row 0, and both look cube maps up by the same table – the layers hold the same texels.
- **Formats**: `R32G32B32A32_SFLOAT` for the HDR image (`STBI_rgb_alpha`; linear filtering checked with
  `findSupportedFormat`), `R16G16B16A16_SFLOAT` for the cube maps. `createPipeline` takes the render pass and the
  topology; depth compare `LESS_OR_EQUAL`; descriptor sets with one image at binding 1.
:::
:::d3d12
- **The capture**: `SetCaptureTarget(cubemap, face, mip)` writes an RTV of one array slice (`TEXTURE2DARRAY`,
  `FirstArraySlice = face`, `ArraySize = 1`) into the one spare RTV descriptor and binds it – `OMSetRenderTargets`
  copies the descriptor when recorded. Recorded in `LoadAssets` with the texture uploads, executed before the first
  frame; no depth buffer, no clear; a barrier RENDER_TARGET → PIXEL_SHADER_RESOURCE at the end.
- **The y flip**: `captureProjection = XMMatrixPerspectiveFovRH(…) * XMMatrixScaling(1, -1, 1)` – Direct3D writes NDC y =
  +1 into a render target's first row, OpenGL y = -1.
- **Formats**: `R32G32B32A32_FLOAT` for the HDR texture (filterable on feature level 11.0; not flipped, `uv.y = 1 - uv.y`
  in `SampleSphericalMap`), `R16G16B16A16_FLOAT` cube maps with `TEXTURECUBE` SRVs.
- **One SRV table (t0)** for the texture each pass reads; root parameter 0 holds `ModelConstants` or `CaptureConstants`.
- **`SampleLevel(…, 0.0f)`** in the convolution's loop: `Sample` needs derivatives, which a loop with a varying count
  doesn't allow.
:::

## Specular IBL

- **Split sum approximation** (Epic Games): `∫ Li · fr · (n · ωi) dωi ≈ ∫ Li dωi · ∫ fr · (n · ωi) dωi` – the first factor
  the **pre-filtered environment map**, the second the **BRDF integration map**.
- **Pre-filtered environment map**: the environment convolved with the GGX lobe, one roughness per mip level (mip / 4),
  assuming n = v = r (no stretched reflections at grazing angles). 64 × 64 with 5 levels here (learnopengl 128 × 128).
- **Monte Carlo integration**: `∫ f(x) dx ≈ (1/N) Σ f(xi) / pdf(xi)` – random samples instead of the whole population.
  **Quasi-Monte Carlo**: samples from a **low-discrepancy sequence**, more evenly spread, faster convergence.
- **Hammersley sequence**: `(i / N, RadicalInverse_VdC(i))`, the **Van der Corput** sequence by bit reversal – integer
  bit operations in the shader.
- **Importance sampling**: samples generated where the GGX NDF is large – inside the specular lobe:
  `phi = 2π · Xi.x`, `cosTheta = sqrt((1 − Xi.y) / (1 + (a² − 1) · Xi.y))` with a = roughness², H turned into world space,
  `L = 2 · dot(V, H) · H − V`; each sample weighted by `NdotL`. 128 samples here (learnopengl 1024).
- **Seams**: low mip levels need filtering across cube faces – OpenGL's `GL_TEXTURE_CUBE_MAP_SEAMLESS`; Vulkan and
  Direct3D always do it.
- **Bright dots and the mip-level trick**: few samples hit or miss a small, very bright source; instead each sample reads
  the environment at `0.5 · log2(saSample / saTexel)` with `saSample = 1 / (N · pdf)`, `saTexel = 4π / (6 · res²)` and
  `pdf = D · NdotH / (4 · HdotV)` – the environment cube map needs mip levels for that.
- **BRDF integration map**: F0 moved out of the integral, `F0 · A + B`, with A = ∫ fr / F · (1 − (1 − v · h)⁵) · (n · ωi) and
  B = ∫ fr / F · (1 − v · h)⁵ · (n · ωi); a 2D texture with u = NdotV and v = roughness, red = scale, green = bias;
  `V = (sqrt(1 − NdotV²), 0, NdotV)`, `G_Vis = G · VdotH / (NdotH · NdotV)`, `Fc = (1 − VdotH)⁵`, with `k_IBL = α² / 2`.
  128 × 128 two-channel 16-bit float, 128 samples (learnopengl 512 × 512, 1024). Independent of the environment.
- **The split sum in the shader**: `R = reflect(-V, N)`, `prefilteredColor = textureLod(prefilterMap, R, roughness ·
  MAX_REFLECTION_LOD)` (4.0), `brdf = texture(brdfLUT, (NdotV, roughness)).rg`, `specular = prefilteredColor · (F ·
  brdf.x + brdf.y)` with F from `fresnelSchlickRoughness`, `ambient = (kD · diffuse + specular) · ao` – specular not
  multiplied by kS again.
- **What you saw**: the background at pre-filter level 1.2 (blurred, a warm glow of a lamp, no speckles), the LUT over
  the window (red right and bottom, green-yellow at the bottom left), then spheres mirroring sky, ground, sun and lamps;
  non-metal reflections untinted. learnopengl's last demo has five materials; the course shows its one material on nine
  spheres.
- **In practice**: compute the maps once and store them (with mip levels, e.g. `.dds`), use tools (cmftStudio,
  IBLBaker), and place **reflection probes** with interpolation and parallax correction.

:::opengl
- **Mip levels**: the environment's `GL_LINEAR_MIPMAP_LINEAR` and `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` after the
  capture; for the pre-filter map `glGenerateMipmap` only allocates the levels.
- **Rendering into a level**: `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, prefilterMap, mip)`, the
  renderbuffer and viewport resized to `64 · 0.5^mip`, `roughness` a uniform.
- **The LUT**: `GL_RG16F`, rendered on `renderQuad()` into `captureFBO`; its v = 0 is the first row for writing and
  reading. Texture units: irradiance 0, pre-filter 1, LUT 2, the maps 3–7.
:::
:::vulkan
- **Mip levels**: the environment created with 8 levels and `TRANSFER_SRC | TRANSFER_DST` usage;
  `generateMipmaps(…, 128, 128, 8, 6)` blits each level into the next for all six layers.
- **Rendering into a level**: `renderToCubemap(…, mipLevel, size, roughness)` – the face view's `baseMipLevel`, the
  roughness in `CapturePushConstants`.
- **The LUT**: `VK_FORMAT_R16G16_SFLOAT`, its own render pass (`createCaptureRenderPass` with that format – a pipeline
  knows its render pass's formats), `renderBrdfLUT()` in a one-time command buffer. The data equals OpenGL's; only the
  debug view flips v. Bindings: irradiance 1, pre-filter 2, LUT 3, the maps 4–8.
:::
:::d3d12
- **Mip levels by drawing**: 8 levels, each drawn from the one above with `downsample.hlsl` (the linear filter averages
  2 × 2 texels) through an SRV of that level only (`MostDetailedMip = mip − 1`, `MipLevels = 1`), with barriers per
  subresource: `D3D12CalcSubresource(mip, face, 0, mipLevels, 6)`. A level being drawn into must not be read.
- **Rendering into a level**: `SetCaptureTarget(…, face, mip)` – the RTV's `MipSlice`; `roughness` in `CaptureConstants`
  (33 values, so root parameter 0 is sized for it once `ModelConstants` has 32).
- **The LUT**: `R16G16_FLOAT`, `PSMain` returns a `float2`; the quad's v = 0 at the top is the first row – only the debug
  view flips v. Tables: t0 (irradiance; the passes' texture), t1–t2 (pre-filter, LUT), t3–t7 (the maps, with a WRAP
  sampler s1).
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Triangle strip | `glDrawElements(GL_TRIANGLE_STRIP, …)` | pipeline topology `TRIANGLE_STRIP` | `IASetPrimitiveTopology(…TRIANGLESTRIP)` |
| Arrays in a uniform/constant buffer | `lightPositions[i]` uniforms | std140: `vec4` elements | `float4` elements |
| Floating point image from `stbi_loadf` | `GL_RGB16F` | `R32G32B32A32_SFLOAT` | `R32G32B32A32_FLOAT` |
| Cube map | `GL_TEXTURE_CUBE_MAP` | 6 layers, `CUBE_COMPATIBLE`, cube view | 6 array slices, `TEXTURECUBE` SRV |
| Render into one face / level | `glFramebufferTexture2D(…, face, tex, mip)` | 2D view of one layer and level + framebuffer | RTV `TEXTURE2DARRAY`, `FirstArraySlice`, `MipSlice` |
| y of the capture projection | as learnopengl | as learnopengl (no flip) | `* XMMatrixScaling(1, -1, 1)` |
| Passes once before the first frame | before the render loop | one-time command buffers in `initVulkan()` | recorded in `LoadAssets` |
| Mip levels of a cube map | `glGenerateMipmap` | `generateMipmaps` (`vkCmdBlitImage`) | drawn level by level, per-subresource barriers |
| Seamless cube filtering | `GL_TEXTURE_CUBE_MAP_SEAMLESS` | always | always |
| Two-channel float target | `GL_RG16F` | `VK_FORMAT_R16G16_SFLOAT` | `DXGI_FORMAT_R16G16_FLOAT` |
| Sampling at a level | `textureLod` | `textureLod` | `SampleLevel` |

With this part done you have a physically based renderer: a BRDF that conserves energy, lights with physical
intensities in an HDR pipeline, materials from five maps, and the environment as diffuse and specular light. It is the
model modern engines use – what they add are more lights (deferred or clustered), shadows, probes and better
approximations, all built on what you have written in these chapters.
