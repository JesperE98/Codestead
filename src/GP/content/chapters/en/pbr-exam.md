# Exam: PBR

Show what you've learned in *PBR*: the theory of microfacets and the reflectance equation, the Cook-Torrance BRDF for
point lights, textured PBR materials, and image based lighting with an irradiance map, a pre-filtered environment map and
a BRDF integration map. The questions cover the whole part, some of them for {{api}} in particular. Answer all of them
and press **Submit answers**; you need 80 % right to pass, and you can take the exam again.

```quiz
Which conditions must a lighting model meet to count as physically based in learnopengl's sense? (Several answers are right.)
- [x] It is based on the microfacet surface model
- [ ] It reads all its material parameters from textures
- [x] It is energy conserving: the reflected light never exceeds the incoming light
- [x] It uses a physically based BRDF
---
Textures are a convenient way to author the parameters, but the 7 × 7 spheres with uniform values are just as physically based. HDR and linear lighting are needed to feed the model physical values, but they are not part of its definition.
```

```quiz
The Cook-Torrance BRDF is `kd · c / π + ks · D · F · G / (4 (ωo · n)(ωi · n))`. Why does the shader's final line read `Lo += (kD * albedo / PI + specular) * radiance * NdotL` – without a `kS` in front of `specular`?
- [ ] Because ks is always 1.0 for point lights
- [x] Because the Fresnel factor F is the ratio of reflected light – it is ks – and it is already in `specular`; multiplying by kS again would count it twice
- [ ] Because metals have no specular reflection
- [ ] Because the geometry function already contains ks
---
`kS = F` is used only to compute `kD = (1 - kS) * (1 - metallic)`, the energy left for the diffuse part.
```

```quiz
A gold-coloured metal has the albedo (1.0, 0.71, 0.29) and `metallic = 1.0`; a white plastic has the albedo (0.9, 0.9, 0.9) and `metallic = 0.0`. What base reflectivities F0 does the metallic workflow give them?
- [ ] Both (0.04, 0.04, 0.04): F0 is a constant
- [ ] Both their albedo: F0 is always the surface colour
- [ ] (0.04, 0.04, 0.04) for the gold and (0.9, 0.9, 0.9) for the plastic
- [x] (1.0, 0.71, 0.29) for the gold – a tinted reflection – and (0.04, 0.04, 0.04) for the plastic – a weak, untinted one
---
`F0 = mix(vec3(0.04), albedo, metallic)`. The plastic's white goes into its diffuse light instead; the gold has no diffuse light at all (`kD *= 1 - metallic`).
```

```quiz
Which remapping of the roughness does Schlick-GGX use for the four point lights, and which one for the BRDF integration map?
- [x] `k = (roughness + 1)² / 8` for direct light, `k = roughness² / 2` for IBL
- [ ] `k = roughness² / 2` for direct light, `k = (roughness + 1)² / 8` for IBL
- [ ] `k = roughness` in both cases
- [ ] `k = roughness²` for both; only the NDF uses a different remapping
---
Both remappings come from Epic Games' notes. The NDF uses α = roughness² in both cases; the k belongs to the geometry function only.
```

```quiz
After the task ndf, the spheres of the right column are white all over, while those of the left column have four tiny white dots. What does this show?
- [ ] That the roughness is squared twice
- [ ] That the halfway vector is computed wrongly
- [ ] That the lights are too close to the right column
- [x] How the GGX NDF depends on the roughness: concentrated around h = n for smooth surfaces, spread over the whole sphere for rough ones – and that the NDF alone, without G, F and the denominator, reflects far more light than arrives
---
The NDF is a density of microfacet normals, not yet an energy-conserving BRDF. The geometry and Fresnel tasks complete the Cook-Torrance term.
```

```quiz
The textured task reads the albedo with `pow(…, 2.2)` and metallic, roughness and ao as they are. What would happen if the roughness map were also converted with `pow(…, 2.2)`?
- [ ] Nothing visible: the conversion only matters for colours
- [ ] The rust would turn metallic
- [x] The material would change: a roughness of 0.5 would become about 0.22, so the whole surface would look much smoother and shinier than authored
- [ ] The normal map would be inverted
---
Data maps are authored as linear values; only colour images carry the monitor's curve and need the conversion (or an sRGB format).
```

```quiz
At the end of the PBR shader the colour is tone-mapped with `color / (color + 1.0)` and then gamma-corrected with `pow(color, 1.0 / 2.2)`. Why is the lighting computed without either until then?
- [ ] Because tone mapping is only needed for the background
- [ ] Because the GPU can't compute `pow` before the lighting
- [x] Because PBR needs linear values for its maths (adding lights, multiplying by the BRDF) and physical intensities that exceed 1.0; Reinhard maps the HDR result into 0..1 without clipping, and gamma encoding comes last, once
- [ ] Because both functions are linear, so the order doesn't matter
---
Before the task tone-map the picture was dark and harsh: linear values written straight into the window and clipped at 1.0.
```

```quiz
Why is the irradiance map only 32 × 32 per face, while the environment cube map it is made from has 128 × 128?
- [x] Because the irradiance – the cosine-weighted average over a whole hemisphere – changes very slowly with the direction; a small map with linear filtering represents it without visible loss
- [ ] Because a cube map smaller than 64 × 64 can't have mip levels
- [ ] Because the irradiance map only stores the sky, not the ground
- [ ] Because floating point cube maps are limited to 32 × 32
---
The convolution blurs away all detail: neighbouring directions share almost their whole hemisphere. learnopengl uses 32 × 32 as well.
```

```quiz
In the irradiance convolution each sample is multiplied by `cos(theta) * sin(theta)`, and the sum at the end by `PI / nrSamples`. Where do the `sin(theta)` and the `PI` come from?
- [ ] Both from the Fresnel equation
- [x] `sin θ` from the solid angle in spherical coordinates (dω = sin θ dθ dφ: samples near the top stand for less area); the π from the Riemann sum's step sizes, (2π / n1) · (π/2 / n2) = π² / n, one π of which cancels the Lambertian 1/π
- [ ] `sin θ` makes the result brighter near the horizon; π converts degrees to radians
- [ ] Both from the GGX normal distribution function
---
The `cos θ` is the n · ωi of the reflectance equation. The map stores π times the average, so the PBR shader multiplies the irradiance by the albedo alone.
```

```quiz
The background cube is drawn last, with `clipPos.xyww` and a depth test of less-or-equal. What would happen with the default less-than test?
- [ ] The background would cover the spheres
- [ ] Nothing: the depth of 1.0 is less than every value in the depth buffer
- [ ] The background would only appear behind the metal spheres
- [x] It would vanish: its depth is exactly 1.0, the value the depth buffer is cleared to, and 1.0 < 1.0 fails everywhere
---
With less-or-equal it passes exactly where no sphere has written a nearer depth. Drawing it last lets the spheres' pixels reject it before its fragment shader runs.
```

```quiz
The ambient term uses `fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)` instead of `fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0)`. Why?
- [ ] Because the irradiance map contains the halfway vectors
- [ ] Because N · V is always larger than H · V
- [x] The ambient light comes from the whole hemisphere, so there is no single halfway vector; N · V stands in for it, and the roughness term `max(1 − roughness, F0)` keeps rough surfaces from reflecting as strongly at grazing angles as smooth ones
- [ ] Because the roughness must be applied twice for indirect light
---
Without it, kS would rise to 1 at every sphere's rim and kD fall to 0 there: rough non-metals would get bright, mirror-like edges.
```

```quiz
What are the two factors of the split sum approximation, and what does each depend on?
- [x] The pre-filtered environment map – the environment convolved with the GGX lobe, a roughness per mip level, read with the reflection vector – and the BRDF integration map – a scale and a bias for F0, read with (NdotV, roughness), independent of the environment
- [ ] The irradiance map and the pre-filtered environment map, both read with the normal
- [ ] The diffuse and the specular BRDF, each stored in one channel of the lookup texture
- [ ] The direct light and the ambient light, added at the end of the shader
---
The full specular integral depends on the light direction, the view direction and the roughness. Splitting it into a product of two integrals with fewer inputs each makes both tabulatable.
```

```quiz
The course's environment has a small sun about 60 times brighter than white. What does the pre-filter shader do so that the rough mip levels show no bright dots?
- [ ] It clamps every sample to 1.0 before adding it
- [x] It samples the environment at a mip level chosen from each sample's probability: `0.5 * log2(saSample / saTexel)` – a rare sample, standing for a large solid angle, reads a blurrier level, where the sun is already spread over the area the sample stands for
- [ ] It uses 1024 samples instead of 128
- [ ] It skips the samples that hit the sun
---
With only level 0, some texels' 128 samples hit the tiny sun and others miss it. The trick needs the environment cube map to have mip levels.
```

```quiz
The BRDF integration map is drawn on a screen quad. What do its axes and channels hold?
- [ ] u = the roughness, v = NdotL; red = D, green = G
- [ ] u and v the sphere's texture coordinates; red and green the environment's colour
- [ ] u = NdotV, v = the roughness; red = the diffuse light, green = the specular light
- [x] u = NdotV, v = the roughness; red = the scale applied to F0, green = the bias added: `specular = prefilteredColor * (F * brdf.x + brdf.y)`
---
At grazing angles on smooth surfaces (bottom left) the bias dominates – everything reflects, whatever F0 is; looking straight at a surface (right) F0 counts fully.
```

```quiz
The pre-filter map was rendered with `roughness = mip / 4` for its levels 0 to 4. A sphere has a roughness of 0.5. Which level does `textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD)` read?
- [ ] Level 0.5, between levels 0 and 1
- [ ] Level 4, because MAX_REFLECTION_LOD is 4
- [x] Level 2.0 – exactly the level that was filtered for the roughness 0.5
- [ ] Level 1, because the roughness is squared first
---
Multiplying by 4 inverts `mip / 4`. A roughness of 0.3 would read level 1.2, which the trilinear filter blends from levels 1 and 2.
```

:::opengl
```quiz
How does the OpenGL project draw the sphere's 1200 indices as one triangle strip?
- [ ] With `glPrimitiveRestartIndex` between the rows
- [x] With `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – the primitive type is an argument of the draw call, and the rows are walked in a zigzag so that one strip covers them all
- [ ] With a vertex array object created with the flag `GL_TRIANGLE_STRIP`
- [ ] With `glDrawArrays(GL_TRIANGLES, 0, 1200)`
---
Every index after the first two makes a triangle with the two before it, so the strip needs about one index per triangle.
```
:::
:::vulkan
```quiz
How does the Vulkan project draw the sphere's 1200 indices as one triangle strip, and the background cube as a triangle list?
- [ ] With an argument of `vkCmdDrawIndexed` that names the topology for each draw
- [ ] With one pipeline whose topology is changed by `vkCmdSetPrimitiveTopology` before each draw
- [ ] By converting the strip to a list in `createSphere()`
- [x] With different pipelines: the topology is part of the pipeline (`inputAssembly.topology`), so `createPipeline` takes it as a parameter – `TRIANGLE_STRIP` for `pbrPipeline`, `TRIANGLE_LIST` for the cube's pipelines
---
Like the render pass, the input assembly state is baked into a pipeline. (Dynamic topology exists as an extension or in newer Vulkan versions; the course doesn't use it.)
```
:::
:::d3d12
```quiz
How does the Direct3D 12 project draw the sphere's indices as a triangle strip and the background cube as a triangle list?
- [ ] With two pipeline states, one with `PrimitiveTopologyType` STRIP and one with LIST
- [ ] By converting the strip to a list in `LoadAssets`
- [x] With `IASetPrimitiveTopology` before each draw – `RenderSphere()` sets `TRIANGLESTRIP`, `RenderCube()` `TRIANGLELIST`; the pipeline states' `PrimitiveTopologyType` is `TRIANGLE` for both
- [ ] With an argument of `DrawIndexedInstanced` that names the topology
---
The pipeline state fixes the type of primitive (triangle), the command list whether triangles come as a list or a strip.
```
:::

:::opengl
```quiz
How does the OpenGL project render the equirectangular image into the six faces of `envCubemap`?
- [x] With `captureFBO`: for each face `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)`, that face's view matrix, `glClear` and `renderCube()`, with a 128 × 128 viewport – once, before the render loop
- [ ] With six framebuffers drawn in parallel by six threads
- [ ] With a geometry shader that writes `gl_Layer`, in one draw
- [ ] By drawing into the window six times and copying with `glCopyTexSubImage2D`
---
The viewport must match the face size during the capture and be set back to the window's size afterwards.
```
:::
:::vulkan
```quiz
How does the Vulkan project render the equirectangular image into the six faces of the environment cube map?
- [ ] With one framebuffer whose attachment is the cube view
- [ ] With a geometry shader that writes `gl_Layer`, in one render pass of every frame
- [x] `renderToCubemap` makes a 2D view of each layer (`baseArrayLayer = i`) and a framebuffer with it, and records six capture render passes into a one-time command buffer that is submitted and waited for – in `initVulkan()`, before the first frame
- [ ] By copying the HDR image into the six layers with `vkCmdCopyBufferToImage`
---
The capture render pass has one colour attachment and no depth, loadOp DONT_CARE (the cube covers every pixel) and finalLayout `SHADER_READ_ONLY_OPTIMAL`, so the face is ready to be sampled after the pass.
```
:::
:::d3d12
```quiz
How does the Direct3D 12 project render the equirectangular image into the six faces of `m_envCubemap`?
- [ ] With six separate textures, combined with `CopyTextureRegion`
- [x] `SetCaptureTarget` writes an RTV of one array slice (`TEXTURE2DARRAY`, `FirstArraySlice = face`, `ArraySize = 1`) into the spare RTV descriptor and binds it; the six passes are recorded in `LoadAssets` and executed before the first frame, then one barrier makes the cube map a shader resource
- [ ] With the cube map's `TEXTURECUBE` SRV bound as a render target
- [ ] With a geometry shader that writes `SV_RenderTargetArrayIndex`, in every frame
---
`OMSetRenderTargets` copies the descriptor when it is recorded, so one descriptor slot can be rewritten for each face.
```
:::

:::opengl
```quiz
learnopengl's capture views use the up vector (0, -1, 0) for the side faces. Why?
- [ ] Because OpenGL's NDC y points down
- [ ] To flip the winding so that the cube's inside is not culled
- [x] Because cube map faces are addressed with the image's origin at the top left (a convention from RenderMan); with these ups each picture lands in its face so that a lookup with a direction returns the right texel
- [ ] It doesn't matter: any up vector gives the same cube map
---
With the ups turned round the faces would be stored upside down, and the background would show the ground above the horizon on the side faces.
```
:::
:::vulkan
```quiz
The Vulkan project's window projection has `proj[1][1] *= -1`, but its capture projection doesn't. Why is that right?
- [x] Because a cube map lookup uses the same table in both APIs, and a Vulkan capture pass writes NDC y = -1 into a layer's row 0 just as OpenGL writes it into its row 0 (the bottom); with learnopengl's matrices unchanged the layers hold OpenGL's texels
- [ ] Because `GLM_FORCE_DEPTH_ZERO_TO_ONE` flips y in the capture
- [ ] Because the capture render pass flips y in its finalLayout transition
- [ ] It isn't: the background is upside down, which nobody notices in the sky
---
The window needs the flip because people look at its rows; a cube map is only ever sampled, so only the agreement between writing and the lookup table matters.
```
:::
:::d3d12
```quiz
Why does the Direct3D 12 project's capture projection end with `* XMMatrixScaling(1.0f, -1.0f, 1.0f)`?
- [ ] Because `XMMatrixPerspectiveFovRH` is left-handed
- [ ] To keep the cube's inside faces from being culled
- [ ] Because Direct3D orders the cube map faces differently from OpenGL
- [x] Because Direct3D writes NDC y = +1 – the top of the picture – into a render target's first row, OpenGL y = -1; the faces are addressed the same in both, so without the flip every face would be stored upside down
---
The Point Shadows chapter's shadow projection did the same. Nothing is culled, so the reversed winding doesn't matter.
```
:::

:::opengl
```quiz
The mip-level trick needs mip levels of the environment cube map. How does the OpenGL project make them?
- [ ] They are made automatically when the cube map's faces are rendered
- [x] `GL_LINEAR_MIPMAP_LINEAR` as the cube map's minification filter and `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` right after the six faces have been captured
- [ ] By rendering every level with the conversion shader
- [ ] With `glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS)`
---
`GL_TEXTURE_CUBE_MAP_SEAMLESS` is about filtering across faces, a different matter. For the pre-filter map `glGenerateMipmap` only allocates the levels, which are then all rendered.
```
:::
:::vulkan
```quiz
The mip-level trick needs mip levels of the environment cube map. How does the Vulkan project make them?
- [ ] With a sampler whose `mipmapMode` is `VK_SAMPLER_MIPMAP_MODE_LINEAR`
- [ ] By rendering every level with the conversion pipeline
- [ ] With `vkCmdCopyImage` from level 0 into each level
- [x] The image is created with 8 levels and `TRANSFER_SRC | TRANSFER_DST` usage, and `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6)` blits each level into the next for all six layers
---
`vkCmdBlitImage` with `VK_FILTER_LINEAR` is a scaled, filtered copy; a plain copy can't change the size. The sampler only blends between levels that exist.
```
:::
:::d3d12
```quiz
The mip-level trick needs mip levels of the environment cube map. How does the Direct3D 12 project make them?
- [x] By drawing: each level from the one above with `downsample.hlsl`, through an SRV that shows only that level (`MostDetailedMip = mip - 1`, `MipLevels = 1`), and barriers per subresource (`D3D12CalcSubresource(mip, face, 0, EnvMipLevels, 6)`) turning each finished level into a shader resource
- [ ] With `ID3D12GraphicsCommandList::GenerateMips`
- [ ] With a static sampler whose `MaxLOD` is 8
- [ ] By uploading eight smaller copies of the HDR image
---
Direct3D 12 has no mipmap generation call. A level that is being drawn into is in the RENDER_TARGET state and must not be read – hence the single-level views.
```
:::

:::opengl
```quiz
When do the OpenGL project's IBL passes – conversion, mip levels, convolution, pre-filter, BRDF integration – run?
- [ ] In every frame, before the spheres
- [ ] In the first frame only, behind a flag in the render loop
- [ ] In a second thread, while the first frames are drawn
- [x] Once, in `main` before the render loop: each OpenGL call is executed in order, so the maps are finished before the first frame
---
A real application would compute them once and store them on disk. The BRDF integration map doesn't even depend on the environment.
```
:::
:::vulkan
```quiz
When do the Vulkan project's IBL passes – conversion, mip levels, convolution, pre-filter, BRDF integration – run?
- [ ] In every frame, recorded into the frame's command buffer before the spheres
- [x] Once, in `initVulkan()`: each step records a one-time command buffer (`beginSingleTimeCommands`), and `endSingleTimeCommands` submits it and waits until it has run – before the frames' command buffer is created
- [ ] In the first frame only, behind a flag in `recordCommandBuffer()`
- [ ] Whenever the swap chain is recreated
---
Waiting after each step is simple and orders the passes: the convolution can only start when the environment cube map is complete.
```
:::
:::d3d12
```quiz
When do the Direct3D 12 project's IBL passes – conversion, mip levels, convolution, pre-filter, BRDF integration – run?
- [ ] In every frame, recorded in `PopulateCommandList` before the spheres
- [ ] In the first frame only, behind a flag in `PopulateCommandList`
- [x] Once: they are recorded in `LoadAssets` into the command list that also carries the texture uploads, and executed at the end of `LoadAssets`, before the first frame; barriers between the passes order them
- [ ] On a copy queue, in parallel to the first frames
---
All passes are in one command list, so it's the barriers (RENDER_TARGET → PIXEL_SHADER_RESOURCE) that make each pass wait for the writes of the one before.
```
:::

:::opengl
```quiz
In the last task of Specular IBL the five material maps are added. Where do they go in the OpenGL project?
- [x] On the texture units 3–7, because 0–2 are taken by the irradiance map, the pre-filter map and the BRDF integration map
- [ ] On the units 0–4, replacing the IBL textures
- [ ] Into the alpha channels of the IBL textures
- [ ] Into one array texture on unit 0
---
learnopengl numbers them the same way: `irradianceMap` 0, `prefilterMap` 1, `brdfLUT` 2, then `albedoMap` 3 … `aoMap` 7.
```
:::
:::vulkan
```quiz
In the last task of Specular IBL the five material maps are added. Where do they go in the Vulkan project?
- [ ] Into a second descriptor set at set 1
- [ ] At the bindings 1–5, replacing the IBL images
- [x] At the bindings 4–8 of the spheres' descriptor set, with the REPEAT `textureSampler`, while the IBL images keep bindings 1–3 with `clampSampler`: the layout has 9 bindings
- [ ] Into the push constants
---
The bindings follow learnopengl's texture units shifted by one, because binding 0 is the uniform buffer. The single-image sets of the capture passes leave the other bindings empty.
```
:::
:::d3d12
```quiz
In the last task of Specular IBL the material maps get a table (t3–t7) and `ModelConstants` shrinks to the two matrices (32 values). Why does root parameter 0 now become `InitAsConstants(sizeof(CaptureConstants) / 4, …)`?
- [ ] Because the spheres now read `CaptureConstants`
- [x] Because root parameter 0 carries both structs – `ModelConstants` for the spheres, `CaptureConstants` (33 values with the roughness) for the capture passes – and must be large enough for the larger one
- [ ] Because root constants must be a multiple of 33 values
- [ ] Because the static sampler s1 needs one more root constant
---
Until then `ModelConstants` (38 values with the material) was the larger one. Each pipeline's shaders read their own cbuffer at b0.
```
:::
