# Review: Advanced Lighting

Congratulations on reaching the end of the *Advanced Lighting* part. You started with a wooden floor and one highlight
on it; since then you have given that highlight a better model, made the lighting physically linear with gamma
correction, let cubes cast shadows from a directional light and from a point light in a room, added bumps and depth to a
brick wall that is still two triangles, kept the light of a 200-strength lamp with HDR and tone mapping, made bright
lights glow, lit nine boxes with 32 lights in a deferred renderer and darkened the creases of a scene with screen-space
ambient occlusion. This page is a glossary of the most important terms of the part, chapter by chapter, like the
reviews learnopengl.com has at the end of its sections. Use it to look things up, and as a check: if a definition
surprises you, go back to the chapter it comes from.

Almost everything in this part is maths in the shaders plus extra render passes into textures of your own: a depth-only
target for shadows, a depth cube map, floating point colour buffers, several render targets written at once, and screen
quads that read them. The terms outside the boxes are the same in every API; the boxes say how {{api}} does it. One
difference runs through the whole part: in OpenGL a framebuffer object collects the textures, and the driver makes sure
that a pass reads what the previous one wrote. In Vulkan a render pass describes the attachments, their formats, what
happens to them at the start and end of the pass and which layout they are left in, and subpass dependencies order the
passes; pipelines are made for one render pass. In Direct3D 12 a texture gets a view for each role (RTV, DSV, SRV), a
transition barrier announces every change of role, and each pipeline state names the formats it renders into. When
you're done, the exam at the end of the part checks what you've learned.

## Advanced Lighting

- **Phong's cut-off**: Phong's specular term uses the angle between the view direction and the reflection vector. Past
  90° their dot product is negative and `max(…, 0.0)` makes the term exactly 0 – on lit surfaces, too. With a low
  exponent the highlight is wide enough to reach that line, and its edge is cut off hard.
- **Blinn-Phong**: uses the **halfway vector** H = normalize(L + V), the unit vector exactly between the direction to
  the light and the direction to the viewer, and `pow(max(dot(N, H), 0.0), shininess)`. For a surface that both light
  and viewer see, the angle between N and H never exceeds 90°: the highlight fades out smoothly. It is the model of
  OpenGL's old fixed-function pipeline.
- **The exponent**: the angle between N and H is usually smaller than the one between R and V, so the same exponent
  gives a wider, brighter highlight. Rule of thumb: 2–4 times Phong's exponent – learnopengl uses 8 for Phong, 32 for
  Blinn-Phong.
- **The scene**: a wooden floor 20 × 20 units with `wood.png` repeated ten times, one light half a unit above it, and a
  `blinn` flag that switches between the two models (learnopengl's B key).

:::opengl
- **The flag**: `uniform bool blinn;` – there is no `glUniform1b`: a boolean uniform is set with `glUniform1i` (the
  shader class's `setInt`) or `glUniform1f`, 0 meaning false.
:::
:::vulkan
- **The flag**: a push constant, `layout(push_constant) uniform PushConstants { bool blinn; } pc;`. A GLSL `bool` in a
  block takes 4 bytes, so the C++ struct uses `VkBool32`, not C++'s 1-byte `bool`; the pipeline layout has a
  `VkPushConstantRange` for the fragment stage, and `vkCmdPushConstants` sets it before the draw.
- **std140 padding**: `viewPos` and `lightPos` are `vec3`s, each starting at a multiple of 16 bytes, so the C++ struct
  pads each with a float.
:::
:::d3d12
- **The flag**: a **root constant** – `rootParameters[0].InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)`, 32
  bits stored in the root signature itself, set with `SetGraphicsRoot32BitConstant(0, blinn, 0)`, no buffer or
  descriptor needed. The shader reads it as `cbuffer BlinnConstant : register(b0) { bool blinn; };` – an HLSL `bool` in
  a constant buffer takes 32 bits.
- **Packing**: a `float3` never crosses a 16-byte row, so `SceneConstantBuffer` pads `viewPos` and `lightPos` with a
  float each.
:::

## Gamma Correction

- **Gamma**: a monitor shows a value v with a brightness of about v to the power **2.2**. The value 0.5 appears at
  0.5^2.2 ≈ 0.218 of white.
- **Linear space vs sRGB space**: lighting maths – adding lights, scaling by `diff`, attenuation – assumes that twice
  the value means twice the light (linear). The colours we pick on a monitor, and the images artists make, are in the
  non-linear **sRGB** space (roughly a gamma of 2.2).
- **Gamma correction**: raise the final colour to the power **1/2.2** before it reaches the monitor (0.5 becomes 0.73,
  which the monitor shows as 0.5). It happens **exactly once, as the last step**; intermediate results of several
  passes stay linear.
- **Two ways**: in the shader (`pow(color, vec3(1.0/2.2))`), or by the hardware, which encodes every colour written to
  an sRGB render target. Never both: the picture would be corrected twice and look washed out.
- **sRGB textures**: colour textures are sRGB-encoded. Read as if linear and then gamma-corrected, they are corrected
  twice – the washed-out floor. An **sRGB format** makes the GPU decode them to linear when they are sampled (alpha
  stays linear). Textures of data – specular, normal, depth maps, shadow maps – are linear and must not be sRGB.
- **Attenuation**: once lighting is linear, the physically correct `1.0 / (distance * distance)` looks right. Before,
  the monitor turned `1 / d` into about `1 / d^2.2` – close to physical – and `1 / d²` into `1 / d^4.4`, much too steep.
- **Tune lighting with gamma correction in place**: values tuned without it have the monitor's curve baked in.

:::opengl
- **sRGB textures**: the internal formats `GL_SRGB` and `GL_SRGB_ALPHA`; the data format stays `GL_RGB` / `GL_RGBA`.
  learnopengl's `loadTexture(path, gammaCorrection)` picks them.
- **Hardware correction**: `glEnable(GL_FRAMEBUFFER_SRGB)` encodes every colour written to an sRGB-capable framebuffer,
  the default one included.
- **Uniform arrays**: `glUniform3fv(location, 4, &lightPositions[0][0])` sets all four `vec3` elements from 12
  consecutive floats; uniforms outside a block have no memory layout to match.
:::
:::vulkan
- **sRGB textures**: `VK_FORMAT_R8G8B8A8_SRGB` for the image and its view – the same bytes as `_UNORM`, decoded when
  sampled; `loadTexture` takes the format as a parameter.
- **Hardware correction**: an `_SRGB` attachment encodes what is written to it. vulkan-tutorial's swap chain is
  `VK_FORMAT_B8G8R8A8_SRGB` – its pictures are gamma-corrected for free. The course uses `VK_FORMAT_B8G8R8A8_UNORM`, so
  its colours match OpenGL's default framebuffer and the shaders correct, learnopengl's way.
- **Uniform arrays**: in std140 every array element starts at a multiple of 16 bytes, so the lights are `vec4`
  arrays on both sides (xyz used).
:::
:::d3d12
- **sRGB textures**: `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` for the texture and its SRV – the same bytes as `_UNORM`,
  decoded when sampled.
- **Hardware correction**: a flip-model swap chain can't have an `_SRGB` format, but its `R8G8B8A8_UNORM` buffers may
  get an `R8G8B8A8_UNORM_SRGB` render target view; the PSO's `RTVFormats[0]` must then be the `_SRGB` format too. The
  course keeps UNORM views and corrects in the shader.
- **Constant buffer arrays**: every element of a cbuffer array starts a new 16-byte row, so the lights are `float4`
  arrays on both sides. (`distance` is an HLSL intrinsic, hence `lightDistance`.)
:::

## Shadow Mapping

- **Shadow mapping**: render the scene from the light into a **depth map** (shadow map) – the closest depth in every
  direction the light looks in – then render it from the camera and compare each fragment's depth in the light's view
  with the stored one: farther away means something is in between, the fragment is **in shadow**.
- **The depth map**: a depth-only render target, here 1024 × 1024, sampled with nearest filtering (depths are compared,
  not blended). The depth pass needs no colour, no lighting and no texture – only the vertices transformed into light
  space – and its own viewport of the depth map's size.
- **Light space transform**: `lightSpaceMatrix = lightProjection * lightView`, a view from the light towards the origin
  and, for a **directional light** with parallel rays, an **orthographic** projection: a 20 × 20 box from 1.0 to 7.5
  units in front of the light. Only what the box contains casts shadows.
- **ShadowCalculation**: the light-space position after the perspective divide (w is 1 for an orthographic
  projection, but the divide keeps the function right for perspective ones), turned into texture coordinates and a
  0..1 depth; `currentDepth > closestDepth` means shadow.
- **Shadows and ambient light**: `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – shadows are rarely
  completely dark, so the ambient term stays.
- **Shadow acne**: several fragments share one depth map texel; on a surface tilted to the light some of them lie
  slightly behind the stored depth and shadow their own surface – stripes. **Shadow bias**:
  `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)` is subtracted from the fragment's depth, larger for steep angles.
- **Peter panning**: a bias that is too large detaches shadows from the objects that cast them. Rendering the depth map
  with front faces culled helps for solid objects – but not for a single plane like the floor, so it isn't used here.
- **Over sampling**: outside the depth map's 0..1 coordinates a repeating map returns unrelated depths. A border colour
  of depth 1.0 (clamp to border) makes those regions lit; fragments beyond the far plane (projected z > 1.0) get
  `shadow = 0.0`.
- **PCF** (percentage-closer filtering): compare against the 3 × 3 texels around the position (one texel = 1 / the map's
  size) and average the nine results: soft edges. It averages comparisons, not depths.
- **Orthographic vs perspective**: orthographic for directional lights, perspective for spot and point lights; a
  perspective depth map is non-linear and must be linearized to be viewed.

:::opengl
- **The framebuffer**: `depthMapFBO` with a `GL_DEPTH_COMPONENT` texture attached as `GL_DEPTH_ATTACHMENT`, and
  `glDrawBuffer(GL_NONE)` / `glReadBuffer(GL_NONE)` – without a colour buffer it would otherwise be incomplete.
- **The passes**: `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)` for pass 1 and back to the window's size for pass 2;
  `shadowMap` on texture unit 1.
- **Coordinates**: NDC is -1..1 in x, y **and** z, so `projCoords = projCoords * 0.5 + 0.5;` maps all three.
- **Border**: `GL_CLAMP_TO_BORDER` and `GL_TEXTURE_BORDER_COLOR` { 1.0, 1.0, 1.0, 1.0 }; texel size from
  `textureSize(shadowMap, 0)`.
:::
:::vulkan
- **The depth image**: a format from `findDepthMapFormat()` (`VK_FORMAT_D32_SFLOAT` or `VK_FORMAT_D16_UNORM`, with the
  depth attachment **and** sampled image features), usage `DEPTH_STENCIL_ATTACHMENT | SAMPLED`.
- **The render pass**: one depth attachment, `colorAttachmentCount = 0` (learnopengl's `glDrawBuffer(GL_NONE)`),
  `storeOp = STORE` (the window's depth uses `DONT_CARE`), `finalLayout = DEPTH_STENCIL_READ_ONLY_OPTIMAL`, and two
  subpass dependencies that order the depth writes against the fragment shaders that sample the map.
- **The depth pipeline**: one vertex attribute, made for `depthMapRenderPass`, no colour blend attachment; the pass is
  recorded before the window's, with a 1024 × 1024 viewport.
- **Coordinates**: with `GLM_FORCE_DEPTH_ZERO_TO_ONE` NDC z is 0..1 already, so only
  `projCoords.xy = projCoords.xy * 0.5 + 0.5;`. The light's matrix has **no** y flip: pass 1 and the lookup agree on
  the rows (only the debug quad flips v).
- **Border**: `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` with `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` – Vulkan has a few
  fixed border colours, not a free one.
:::
:::d3d12
- **The shadow map**: a `DXGI_FORMAT_R32_TYPELESS` texture with `ALLOW_DEPTH_STENCIL`, a `D32_FLOAT` **DSV** to draw
  into it and an `R32_FLOAT` **SRV** to read it – a resource with a depth format can't have an SRV.
- **The depth PSO**: only a vertex shader (`PS` empty), `NumRenderTargets = 0`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`;
  `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)` binds only the DSV.
- **Barriers**: `DEPTH_WRITE` → `PIXEL_SHADER_RESOURCE` after pass 1, and back at the end of the frame.
- **The matrix**: `XMMatrixOrthographicRH(20.0f, 20.0f, …)` and `lightView * lightProjection` – row vectors, the view
  first.
- **Coordinates**: NDC z is 0..1 already, and texture v points down while NDC y points up: `shadowUV =
  (x * 0.5 + 0.5, -y * 0.5 + 0.5)`.
- **Border**: `D3D12_TEXTURE_ADDRESS_MODE_BORDER` with `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`; texel size from
  `shadowMap.GetDimensions(width, height)`. Hardware alternatives: the rasterizer's `DepthBias` /
  `SlopeScaledDepthBias`, and PCF with a comparison sampler and `SampleCmpLevelZero`.
:::

## Point Shadows

- **Omnidirectional shadow maps**: a point light shines in every direction, so its depth map is a **depth cube map** –
  six faces around the light.
- **One pass with a geometry shader**: the depth cube map is a **layered** attachment; the geometry shader emits every
  triangle six times (at most 18 vertices), each time with one face's light matrix and that face's index as the layer
  it goes to. Clipping throws away what a face can't see.
- **The six matrices**: one perspective projection with a **90° field of view** and an aspect ratio of 1 – exactly one
  face per frustum, no gaps or overlaps – near 1.0, far 25.0; six `lookAt`s towards +X, -X, +Y, -Y, +Z, -Z (the faces'
  order) with up (0, -1, 0) for the four side faces and (0, 0, 1) / (0, 0, -1) for ±Y: a cube map face's first row is
  its top, and these ups store each face as a lookup reads it. They are the same in every API.
- **The stored value**: the fragment shader writes `distance(fragment, light) / far_plane` as its depth. A distance is
  the same in all six faces and can be compared directly with the fragment's own distance in pass 2. (Writing the
  depth turns early depth testing off.)
- **The lookup**: the cube map is sampled with `fragToLight = fragPos - lightPos` (any length; it points from the light
  to the fragment), the stored value is multiplied by `far_plane` and compared with `length(fragToLight)`. The bias is
  in world units now: 0.05.
- **PCF**: 20 offset directions – the cube's 8 corners and 12 edge middles – scaled by
  `diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0` (softer shadows farther from the viewer), bias 0.15. A 4 × 4 × 4
  grid of offsets would take 64 samples, many of them redundant.
- **The scene**: a room seen from inside (normals reversed in the vertex shader) with five cubes and a light in the
  middle; learnopengl moves the light with time, the course keeps it still.

:::opengl
- **The cube map**: `GL_TEXTURE_CUBE_MAP` with six `glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0,
  GL_DEPTH_COMPONENT, …)`, `GL_NEAREST`, `GL_CLAMP_TO_EDGE` on S, T and R.
- **Layered attachment**: `glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0)` attaches all six
  faces (`glFramebufferTexture2D` would attach one face).
- **Shaders**: the geometry shader sets `gl_Layer = face`; the fragment shader writes `gl_FragDepth`; the lighting
  shader samples a `samplerCube`. The Shader class takes the geometry shader as a third file.
:::
:::vulkan
- **The cube map**: a 2D image with `arrayLayers = 6` and `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, one
  `VK_IMAGE_VIEW_TYPE_CUBE` view of all six layers, and a framebuffer with `layers = 6` – the layered attachment. The
  render pass is the last chapter's depth-only pass; its clear and transitions cover all layers.
- **Shaders**: the geometry shader sets `gl_Layer`; the device enables the `geometryShader` feature, and the uniform
  buffer is visible to the geometry stage too. `gl_FragDepth` replaces the depth; the lookup is a `samplerCube`.
- **No y flip** of the shadow projection: NDC y = -1 lands on a face's row 0 in Vulkan as in OpenGL, so learnopengl's
  matrices store the same texels. Culling is off everywhere (the room would need its own pipelines).
:::
:::d3d12
- **The cube map**: an `R32_TYPELESS` texture with `DepthOrArraySize = 6`, a `D32_FLOAT` DSV of type
  `TEXTURE2DARRAY` over all six slices (the layered attachment) and an `R32_FLOAT` SRV of type `TEXTURECUBE`.
- **Shaders**: the geometry shader (`[maxvertexcount(18)]`, `gs_5_0`) writes `SV_RenderTargetArrayIndex`; the pixel
  shader returns `SV_Depth`; the lookup is a `TextureCube` sampled with a `float3`.
- **The y flip**: Direct3D puts NDC y = +1 on a render target's row 0, so the shadow projection is followed by
  `XMMatrixScaling(1.0f, -1.0f, 1.0f)`, or every face would be stored upside down. Culling is off everywhere.
:::

## Normal Mapping

- **Normal mapping** (bump mapping): a per-fragment normal from a texture, so a flat surface is lit as if it had
  bumps, cracks and mortar lines.
- **The normal map**: each component stored as `normal * 0.5 + 0.5`; mostly light blue, (0.5, 0.5, 1.0), because most
  normals point straight out of the surface. It holds directions, so it is read linear, never as sRGB. In the shader:
  `normalize(texel * 2.0 - 1.0)`.
- **The wrong first attempt**: the map's normals used as world-space normals – only right for a surface facing +z.
- **Tangent space**: the space local to the surface, in which the map's normals point roughly along +z. Its axes are the
  **tangent** T (where the texture's u grows), the **bitangent** B (where v grows) and the normal N: the map's red is
  measured along T, green along B, blue along N.
- **TBN matrix**: `mat3(T, B, N)` with T, B, N as columns takes a tangent-space vector to world space. Its inverse is its
  **transpose** – T, B and N are perpendicular unit vectors.
- **Computing tangents**: for a triangle with edges E1, E2 and texture coordinate differences ΔU, ΔV,
  `E1 = ΔU1·T + ΔV1·B` and `E2 = ΔU2·T + ΔV2·B`; solving gives `T = f·(ΔV2·E1 − ΔV1·E2)`, `B = f·(−ΔU2·E1 + ΔU1·E2)` with
  `f = 1 / (ΔU1·ΔV2 − ΔU2·ΔV1)`. They become two more vertex attributes.
- **Lighting in tangent space**: learnopengl's final code transforms the light, view and fragment positions with the
  transposed TBN in the **vertex** shader – once per vertex instead of once per fragment – and the fragment shader uses
  the sampled normal as it is.
- **Gram-Schmidt**: averaged tangents on a real mesh may not be perpendicular to N; `T = normalize(T - dot(T, N) * N)`
  makes them so, and `B = cross(N, T)`.
- **Complex objects**: Assimp's `aiProcess_CalcTangentSpace` computes the tangents; normal maps let a simple mesh show
  the detail of a much finer one.

:::opengl
- **Vertex data**: 14 floats per vertex – position, normal, texture coordinates, tangent, bitangent – with attributes 3
  and 4 for the tangent and bitangent. The images are flipped on load, so v grows up the image and B = (0, 2, 0) points
  up the wall – the direction the normal map's green means.
:::
:::vulkan
- **Vertex data**: `Vertex` gets `tangent` and `bitangent`, and `getAttributeDescriptions()` two more entries (locations
  3 and 4); the normal map is binding 2.
- **Flipped on load**: these chapters call `stbi_set_flip_vertically_on_load(true)` and keep learnopengl's texture
  coordinates. With the earlier chapters' flipped v, the bitangent – computed from v – would point down the wall while
  the map's green means up the image: every bump would be lit from the wrong side.
:::
:::d3d12
- **Vertex data**: two more input elements, `TANGENT` and `BINORMAL` (HLSL's name for the bitangent).
- **Matrices**: HLSL's `float3x3(T, B, N)` takes **rows**, so it already is learnopengl's `transpose(mat3(T, B, N))`, the
  world → tangent matrix.
- **v points down**: with Direct3D's texture coordinates the bitangent points down the wall, while the OpenGL-style
  normal map's green means up the image – so `PSMain` flips it, `normal.y = -normal.y`, and Gram-Schmidt computes
  `B = cross(T, N)` (pointing down, as v grows), not learnopengl's `cross(N, T)`.
:::

## Parallax Mapping

- **Displacement mapping** moves vertices by a height map – real relief, but many vertices. **Parallax mapping** moves
  only the **texture coordinates**, in the fragment shader, so that a fragment shows the point the view ray would hit on
  the relief.
- **Depth map**: an inverted height map – white where the surface is deep (the mortar), black at the surface;
  `heightScale` (0.1) says how deep 1.0 is.
- **The offset**: `texCoords - viewDir.xy / viewDir.z * (height * heightScale)`, with the view direction in tangent
  space, where x and y run along the texture's u and v. The division makes the offset grow at flat angles; leaving it
  out is *parallax mapping with offset limiting*.
- **Discarding the edges**: fragments whose shifted coordinates leave [0,1] are discarded – the quad's outline follows
  the raised bricks. Works for a plane, not for complex surfaces.
- **Steep parallax mapping**: divides the depth range into **layers** and walks along the ray, one layer and one
  coordinate step at a time, until the layer is deeper than the depth map's value. More layers at grazing angles:
  `mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)))`, 8 to 32. Leaves visible steps.
- **Parallax occlusion mapping**: interpolates between the last layer above and the first layer below the surface,
  with `weight = afterDepth / (afterDepth - beforeDepth)`. *Relief parallax mapping* is more accurate and more expensive.

:::opengl
- **Bindings**: the depth map on texture unit 2, `heightScale` a uniform.
- **Sampling in the loop**: `texture()` chooses the mip level from implicit derivatives, which GLSL leaves undefined
  when neighbouring fragments take different paths through a loop. It usually works; the strict version takes `dFdx` /
  `dFdy` of the original coordinates before the loop and samples with `textureGrad`.
:::
:::vulkan
- **Bindings**: the depth map at binding 3; `heightScale` in the uniform buffer, in place of a padding float.
- **Sampling in the loop**: `texture()` chooses the mip level from implicit derivatives, which GLSL leaves undefined
  when neighbouring fragments take different paths through a loop. It usually works; the strict version takes `dFdx` /
  `dFdy` of the original coordinates before the loop and samples with `textureGrad`.
:::
:::d3d12
- **Bindings**: the depth map at t2 (a range of three SRVs); `heightScale` in the constant buffer, in place of a padding
  float.
- **Sampling in the loop**: `Sample` needs gradients between neighbouring pixels; in a loop whose count varies per pixel
  there are none, and the compiler refuses it (warning X3570). The loop uses `SampleLevel(wrapSampler, uv, 0)`; with
  mipmaps, `SampleGrad` with `ddx` / `ddy` taken before the loop.
- **v points down**: B = `cross(T, N)` points down too, so `viewDir.xy` is in texture-coordinate directions and the
  shift works unchanged.
:::

## HDR

- **LDR** (low dynamic range): an 8-bit colour buffer stores 0.0 to 1.0 per channel; everything brighter is clamped, and
  large bright areas turn into one flat white.
- **HDR** (high dynamic range): colours may exceed 1.0 while the scene is rendered, so lights can have realistic
  strengths – the tunnel's end light has 200.
- **Floating point framebuffer**: a colour buffer with **16-bit half floats** per channel (up to 65504, about three
  significant digits), RGBA in every API – three-channel float targets are not portable.
- **The passes**: the scene into the floating point buffer, linear and unclipped; then a screen quad that reads it,
  **tone-maps** it into 0..1 and gamma-corrects it. Gamma correction moves out of the lighting shader: it must come
  after the tone mapping, as the very last step.
- **Tone mapping**: converting HDR to LDR without losing detail. **Reinhard**: `hdrColor / (hdrColor + 1.0)` – 1 → 0.5,
  3 → 0.75, 200 → 0.995; every value stays below 1.0 and keeps its order, small values barely change.
- **Exposure**: `1.0 - exp(-hdrColor * exposure)`. A **high** exposure shows the details of dark areas (the bright ones
  crowd near white); a **low** exposure shows the details of bright areas (the dark ones sink to black). learnopengl
  changes it with Q and E; the course switches the code in the tasks.
- **More HDR**: filmic curves; **automatic exposure** (eye adaptation) from the previous frame's brightness.
- **The scene**: a wooden tunnel with three dim coloured lights and one of strength 200 at its far end; the camera
  looks down the tunnel (yaw +90), and there are four lights instead of learnopengl's sixteen-slot array.

:::opengl
- **The framebuffer**: `hdrFBO` with a colour texture whose **internal format** is `GL_RGBA16F` (`GL_RGBA` / `GL_FLOAT`
  only describe the absent data) and a depth renderbuffer. The programs don't change: they draw into whatever
  framebuffer is bound.
- **The quad**: `hdrShader` samples `hdrBuffer`; `exposure` is a uniform.
:::
:::vulkan
- **The render pass**: `hdrRenderPass` with a `VK_FORMAT_R16G16B16A16_SFLOAT` colour attachment left in
  `SHADER_READ_ONLY_OPTIMAL`, a depth attachment and two subpass dependencies; every device must be able to render into
  that format and sample it linearly.
- **Pipelines**: a pipeline only works in render passes compatible with the one it was made for – the scene's pipeline
  is made for `hdrRenderPass`, the screen quad's for the window's.
- **Descriptors**: `hdrDescriptorSet` with the floating point image; the pool hands out two sets. `exposure` goes into
  the uniform buffer in place of a padding float.
:::
:::d3d12
- **The buffer**: a `DXGI_FORMAT_R16G16B16A16_FLOAT` texture with `ALLOW_RENDER_TARGET`, an RTV after the swap chain's
  and an SRV; barriers `PIXEL_SHADER_RESOURCE` ↔ `RENDER_TARGET` around the scene pass.
- **PSOs**: a PSO is compiled for the formats it renders into – the scene's PSO gets `RTVFormats[0] =
  DXGI_FORMAT_R16G16B16A16_FLOAT`, the screen quad its own `m_hdrPipelineState` with the back buffer's format and no depth.
- **Exposure**: a root constant; root parameter 0 becomes visible to all shaders, because the pixel shader reads it now.
:::

## Bloom

- **Bloom**: a glow around bright light sources and brightly lit areas – the light seems to bleed over its
  surroundings. It is not the same as HDR, but works best with it.
- **The steps**: render the scene and, at the same time, its bright parts into a second buffer; blur the bright buffer;
  add it to the scene, then tone-map and gamma-correct.
- **Multiple render targets** (MRT): a fragment shader with several outputs, each written to its own colour buffer in
  one pass.
- **Bright parts**: the **luminance** `dot(color, vec3(0.2126, 0.7152, 0.0722))` (the eye is most sensitive to green,
  least to blue) above **1.0** – what the window can't show. With LDR a lower threshold would make every white wall glow.
- **Gaussian blur**: weights from the bell-shaped Gaussian curve, so near samples count most. It is **separable**: a
  horizontal pass and then a vertical pass give the full 2D blur – 9 + 9 = 18 samples instead of 81 for a 9-tap kernel.
  Five weights, 0.2270270270 for the centre down to 0.0162162162 four texels away, sum to 1 (the others counted twice).
- **Ping-pong framebuffers**: a pass can't read the texture it is drawing into, so two buffers take turns – each pass
  reads one and writes the other. learnopengl does **10 passes** (horizontal first): five horizontal-and-vertical pairs,
  each blurring the blurred image again, which widens the glow. The result ends in buffer `[!horizontal]`, buffer 0.
- **Clamping**: the colour buffers are sampled clamped to the edge, or the blur would mix in the opposite edge.
- **Blending both textures**: `hdrColor += bloomColor` **before** the tone mapping – both are HDR light in the same
  units, and their sum goes through the curve instead of clipping to white.
- **Final thoughts**: a wider glow is cheaper with a downsampled blur chain (half, quarter, eighth size); learnopengl's
  *Physically Based Bloom* builds one and drops the threshold.

:::opengl
- **MRT**: two `GL_RGBA16F` textures on `GL_COLOR_ATTACHMENT0` and `1`, `glDrawBuffers(2, attachments)` – without it
  only attachment 0 is drawn – and `layout (location = 1) out vec4 BrightColor;` in the shader.
- **Ping-pong**: `pingpongFBO[2]` with one colour texture each and no depth; binding the other framebuffer and texture is
  all a pass needs.
- **Final pass**: `scene` on unit 0 and `bloomBlur` on unit 1.
:::
:::vulkan
- **MRT**: output location n writes `pColorAttachments[n]` of the subpass; `createHdrRenderPass()` has two colour
  attachments (depth at index 2), the framebuffer three views, the pass three clear values, and each pipeline one
  blend attachment state per colour attachment (`colorAttachmentCount`).
- **Ping-pong**: an image in a render pass can't be sampled in that pass, so every blur pass is a render pass of its
  own: `blurRenderPass` (`loadOp = DONT_CARE` – the quad covers every pixel –, `finalLayout = SHADER_READ_ONLY_OPTIMAL`,
  dependencies that chain the passes). The loop runs while the command buffer is recorded.
- **Shaders**: `horizontal` is a `VkBool32` push constant; the weights a `const float weight[5]` (Vulkan GLSL has no
  uniforms outside blocks).
- **Descriptors**: one layout for all sets, now with binding 2 – so every set takes two combined image samplers, and
  seven sets need 14 in the pool.
:::
:::d3d12
- **MRT**: the pixel shader returns a struct with `SV_TARGET0` and `SV_TARGET1`; the PSO has `NumRenderTargets = 2` and
  two `RTVFormats`; `OMSetRenderTargets(2, hdrRtvHandles, FALSE, …)` binds both (`FALSE`: an array of handles).
  `IndependentBlendEnable = FALSE` applies `RenderTarget[0]`'s blend settings to every target.
- **Ping-pong**: `m_pingpongColorbuffers[2]`, each pass between a barrier to `RENDER_TARGET` and one back to
  `PIXEL_SHADER_RESOURCE` – what lets the next pass read it.
- **Shaders**: `static const float weight[5]` (without `static` it would be a constant-buffer input whose initializer
  is ignored); `horizontal` a root constant.
- **Two tables**: the final pass reads the scene and the blurred buffer through two descriptor tables (root parameters
  2 and 3), because a table points at consecutive descriptors.
:::

## Deferred Shading

- **Forward rendering**: each object is lit while it is drawn – every fragment with every light, including fragments
  that later objects cover.
- **Deferred shading**: a **geometry pass** writes each pixel's surface data into the **G-buffer** without lighting;
  a **lighting pass** draws a screen quad and lights every pixel once, from the G-buffer. The cost of lighting depends
  on pixels × lights, no longer on how many objects overlap.
- **The G-buffer**: three colour targets and a depth buffer – positions and normals (world space) in 16-bit float
  targets, because they need range and precision, and albedo (rgb) plus specular intensity (a) in an 8-bit target. They
  are read with nearest filtering.
- **The scene**: nine container boxes (learnopengl draws its backpack model) and learnopengl's 32 lights from
  `srand(13)`, seen from above the grid; the lighting is learnopengl's, without gamma correction.
- **Combining deferred with forward rendering**: things that don't fit the G-buffer – the light cubes, blended objects
  – are drawn forward after the lighting pass, depth-tested against the geometry pass's depths.
- **Light volumes**: a light's **radius** is where its attenuated brightness drops below 5/256: solving
  `Imax · 1 / (1 + Kl·d + Kq·d²) = 5/256` gives
  `(-linear + sqrt(linear² - 4·quadratic·(constant - (256/5)·Imax))) / (2·quadratic)`, here about 3.5 to 5.1. Skipping
  lights beyond it darkens the picture slightly – each skipped light adds less than 5/256, but 32 of them add up.
- **Why the `if` saves little**: a GPU runs the fragments of a group in lockstep, so a loop costs every light wherever
  one fragment of the group needs it. Real renderers draw each light's **volume** (a sphere of that radius, with
  front-face culling) and light only the pixels it covers, or sort lights into screen tiles or clusters (**tiled** and
  **clustered** shading).
- **Limits**: a G-buffer pixel holds one surface, so **blending** (transparency) needs a forward pass; **MSAA** doesn't
  simply work; all surfaces share one lighting model; the G-buffer costs memory and bandwidth.

:::opengl
- **The G-buffer**: `gBuffer` with `gPosition` and `gNormal` (`GL_RGBA16F`), `gAlbedoSpec` (`GL_RGBA`), attached to
  `GL_COLOR_ATTACHMENT0`–`2` with `glDrawBuffers(3, attachments)`, and a `GL_DEPTH_COMPONENT` renderbuffer.
- **The light cubes**: `glBlitFramebuffer(…, GL_DEPTH_BUFFER_BIT, GL_NEAREST)` from `gBuffer` (`GL_READ_FRAMEBUFFER`) to
  framebuffer 0 copies the geometry pass's depths into the window's depth buffer – the two depth formats must match.
:::
:::vulkan
- **The G-buffer**: `gBufferRenderPass` with three colour attachments (`R16G16B16A16_SFLOAT` twice, `R8G8B8A8_UNORM`) and
  depth at attachment 3; the geometry pipeline has three blend states; `gBufferSampler` is NEAREST (no anisotropy) and
  clamps.
- **The light cubes**: no copy – the G-buffer's depth image is kept (`storeOp = STORE`) and is the window pass's depth
  attachment (`loadOp = LOAD`, `initialLayout = DEPTH_STENCIL_ATTACHMENT_OPTIMAL`); the lighting quad's pipeline has
  depth test and writes off.
- **The lights**: `struct Light { vec3 position; float linear; vec3 color; float quadratic; }` – the floats fill the
  gaps after the `vec3`s; with `radius` the struct grows to 36 bytes and std140 rounds the array stride up to 48.
:::
:::d3d12
- **The G-buffer**: `m_gBuffer[3]` (`R16G16B16A16_FLOAT` twice, `R8G8B8A8_UNORM`), a PSO with `NumRenderTargets = 3`,
  `OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle)` and a pixel shader with `SV_TARGET0`–`2`; the lighting
  pass reads them with a point, clamping sampler through two descriptor tables.
- **The light cubes**: no copy – a depth buffer belongs to no framebuffer, so `m_depthStencil`, which still holds the
  boxes' depths, is bound again with the back buffer (the lighting quad itself is drawn without a DSV).
- **The lights**: HLSL packs `Light` into 48 bytes (Color starts the second row); the C++ struct pads to match.
  Microsoft's `rand()` differs from glibc's, so on Windows the lights land elsewhere.
:::

## SSAO

- **Ambient occlusion**: creases, corners and places where objects touch get less of the scene's indirect (ambient)
  light. Computing it properly is expensive.
- **SSAO** (screen-space ambient occlusion, Crytek 2007): estimates it per pixel from the G-buffer – sample points
  around the fragment; the more of them lie behind the stored surface, the more the fragment is occluded.
- **Normal-oriented hemisphere**: the samples lie in a hemisphere on the normal's side, so a flat surface doesn't
  occlude itself (a full sphere makes everything grey).
- **View space**: the G-buffer stores positions and normals in **view space**, so the stored z is the depth to compare;
  the albedo is a plain 0.95.
- **The sample kernel**: 32 samples (learnopengl 64 – the simulator runs on the CPU), z ≥ 0, each scaled by
  `lerp(0.1, 1.0, (i / 32)²)`: more samples close to the fragment. Radius 0.5, bias 0.025.
- **Random kernel rotations**: a 4 × 4 **noise texture** of random vectors in the xy plane, tiled over the window with
  repeat and nearest sampling. With the normal it gives a TBN matrix (Gram-Schmidt), so each pixel of a 4 × 4 block
  turns the kernel differently: few samples, no banding – but a regular noise pattern.
- **The SSAO shader**: `samplePos = fragPos + TBN * sample * radius`, projected to texture coordinates, the stored depth
  read at that place; occluded if `sampleDepth >= samplePos.z + bias`. The **range check**
  `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` stops surfaces far in front of the fragment from
  darkening it. Result: `1.0 - occlusion / kernelSize`, in a single-channel target.
- **Blur**: a 4 × 4 box blur (offsets -2..1) removes the noise pattern.
- **Applying it**: only the ambient term is multiplied – `0.3 * Diffuse * AmbientOcclusion`; direct light keeps its own
  diffuse and specular.
- **The scene**: the planet in a room instead of learnopengl's backpack. Its ring is a single plane with an upward
  normal, seen from below: the hemisphere lies behind it as the camera sees it, so its underside comes out dark. The
  random numbers come from `srand(42)` and `rand() / (float)RAND_MAX` – the same kernel and noise in the simulator and
  every run (learnopengl's `std::uniform_real_distribution` differs between standard libraries).

:::opengl
- **Targets**: `ssaoColorBuffer` and `ssaoColorBufferBlur` with the internal format `GL_RED` (one channel);
  `gPosition` clamps to the edge, so samples near the window's border don't wrap.
- **Noise**: a 4 × 4 `GL_RGBA32F` texture from `GL_RGB` / `GL_FLOAT` data, `GL_NEAREST`, `GL_REPEAT`, sampled at
  `TexCoords * noiseScale` (800/4, 600/4). The projected sample becomes texture coordinates with `* 0.5 + 0.5`.
:::
:::vulkan
- **Targets**: `VK_FORMAT_R8_UNORM` images for the SSAO and its blur, drawn with `ssaoRenderPass` (no depth,
  `loadOp = DONT_CARE`); one descriptor set for all passes (bindings 0–6).
- **Noise**: `VK_FORMAT_R32G32B32A32_SFLOAT` with `vec4` noise – devices need not sample three-channel float images –
  uploaded through a staging buffer, `noiseSampler` NEAREST and REPEAT. Tiled from the window's top (v points down), so
  single AO pixels differ from OpenGL's.
- **Kernel**: `vec4 samples[32]` in the uniform buffer (std140 array stride). The flipped projection's y points down
  like v: `offset.xy * 0.5 + 0.5` needs no extra flip.
:::
:::d3d12
- **Targets**: `R8_UNORM` render targets for the SSAO and its blur; every screen pass has its own copy of the quad's
  `VSMain`.
- **Noise**: `R32G32B32A32_FLOAT` uploaded from `XMFLOAT4`s with `UpdateSubresources`, read with static sampler s1
  (point, WRAP); the G-buffer with s0 (point, CLAMP).
- **Kernel**: `XMFLOAT4 samples[32]` in the constant buffer (every element its own row). Texture coordinates are
  `(x * 0.5 + 0.5, -y * 0.5 + 0.5)`, and `mul(samples[i].xyz, TBN)` is GLSL's `TBN * samples[i]` because `float3x3`
  takes rows.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| A small per-draw value | `uniform bool`, `setInt` | push constant, `VkBool32` | root constant |
| sRGB texture | `GL_SRGB` / `GL_SRGB_ALPHA` | `VK_FORMAT_R8G8B8A8_SRGB` | `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` |
| Gamma correction by the hardware | `GL_FRAMEBUFFER_SRGB` | `_SRGB` swap chain format | `_SRGB` RTV of the UNORM back buffer |
| Depth-only target | FBO, `GL_DEPTH_COMPONENT` texture, `glDrawBuffer(GL_NONE)` | depth image + render pass without colour | `R32_TYPELESS`, D32 DSV + R32 SRV, PSO without pixel shader |
| Readable after the pass | done by the driver | `storeOp`, `finalLayout`, subpass dependency | transition barrier |
| Light-space NDC → depth map | `xyz * 0.5 + 0.5` | `xy * 0.5 + 0.5` | `x * 0.5 + 0.5`, `-y * 0.5 + 0.5` |
| Depth 1.0 outside the map | `GL_CLAMP_TO_BORDER` + border colour | `CLAMP_TO_BORDER` + `FLOAT_OPAQUE_WHITE` | `BORDER` + `STATIC_BORDER_COLOR_OPAQUE_WHITE` |
| Texture size in a shader | `textureSize` | `textureSize` | `GetDimensions` |
| Layered depth cube map | `glFramebufferTexture`, `gl_Layer` | 6 layers, framebuffer `layers = 6`, `gl_Layer` | `TEXTURE2DARRAY` DSV, `SV_RenderTargetArrayIndex` |
| Writing the depth | `gl_FragDepth` | `gl_FragDepth` | `SV_Depth` |
| Tangent and bitangent | attributes 3 and 4 | `Vertex` members, locations 3 and 4 | `TANGENT`, `BINORMAL` |
| Sampling in a varying loop | `textureGrad` (strict) | `textureGrad` (strict) | `SampleLevel` / `SampleGrad` |
| Floating point target | `GL_RGBA16F` | `VK_FORMAT_R16G16B16A16_SFLOAT` | `DXGI_FORMAT_R16G16B16A16_FLOAT` |
| Several render targets | `glDrawBuffers`, `location = n` | subpass colour attachments, blend states | `NumRenderTargets`, `SV_TARGETn` |
| Forward objects after deferred | `glBlitFramebuffer` of the depth | G-buffer depth image, `loadOp` LOAD | the same DSV bound again |
| Single-channel target | `GL_RED` | `VK_FORMAT_R8_UNORM` | `DXGI_FORMAT_R8_UNORM` |
| Repeating noise texture | `GL_REPEAT`, `GL_NEAREST` | sampler REPEAT, NEAREST | static sampler WRAP, point |

With this part done you know the building blocks of a modern real-time renderer: linear lighting with gamma
correction, shadow maps, normal and parallax maps, an HDR pipeline with tone mapping and bloom, a G-buffer and
screen-space effects that read it. Physically based rendering, learnopengl's next part, keeps all of them and replaces
Blinn-Phong with a physically based lighting model.
