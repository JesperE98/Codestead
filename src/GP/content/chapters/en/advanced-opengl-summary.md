# Review: Advanced OpenGL

Congratulations on reaching the end of the *Advanced OpenGL* part. You started with two marble cubes on a metal floor
and looked at the depth buffer behind them; since then you have drawn outlines with the stencil buffer, grass and
windows with alpha, skipped the faces nobody sees, rendered the scene into a texture of your own and post-processed it,
put a sky around it, filled buffers in new ways, shared uniforms between shaders, generated geometry in a shader, drawn
an asteroid field with one draw call and smoothed jagged edges with multisampling. This page is a glossary of the most
important terms of the part, chapter by chapter, like the reviews learnopengl.com has at the end of its sections. Use
it to look things up, and as a check: if a definition surprises you, go back to the chapter it comes from.

The part keeps learnopengl's name, but every technique in it exists in every API. The terms outside the boxes are the
same everywhere; the boxes say how {{api}} does it. One difference runs through the whole part: OpenGL keeps settings
like the depth function, the stencil test, blending and culling in a global **state machine** that you switch with
calls such as `glEnable`, while Vulkan and DirectX 12 bake them into a **pipeline object** that you create up front and
bind before drawing – a different setting means another pipeline. When you're done, the exam at the end of the part
checks what you've learned.

## Depth testing

- **Depth buffer** (z-buffer): a buffer as big as the colour buffer that stores one depth value per pixel, usually
  with 24 or 32 bits.
- **Depth test**: the GPU compares a fragment's depth with the stored one; if the test passes, the fragment is drawn
  and its depth is stored, otherwise it is discarded. It runs after the fragment shader and after the stencil test.
- **Early depth testing**: a hardware feature that runs the test *before* the fragment shader, so hidden fragments
  are never shaded. It only works if the shader doesn't write its own depth.
- **Depth function**: the comparison the test uses – ALWAYS, NEVER, LESS (the usual one: nearer than the stored
  depth), EQUAL, LESS_OR_EQUAL, GREATER, NOT_EQUAL, GREATER_OR_EQUAL. With ALWAYS the last fragment drawn wins, as
  without a depth test.
- **Read-only depth buffer**: the test runs, but nothing is written – the depth write mask.
- **Depth value precision**: the projection makes the stored depth proportional to `1/z`:
  `F_depth = (1/z - 1/near) / (1/far - 1/near)`. Most of the range is spent close to the near plane: with near = 0.1
  and far = 100, a depth of 0.5 is only 0.2 units from the camera.
- **Visualizing the depth buffer**: the depth as a grey shows the scene almost white; **linearizing** it (inverting
  the projection's depth equation) gives the distance from the camera, divided by `far` for display.
- **Z-fighting**: two surfaces so close together that the depth buffer can't tell which one is in front – they
  flicker. Prevention: never let surfaces overlap closely (a small offset), push the near plane as far out as
  possible, use more depth bits.

:::opengl
- **State**: `glEnable(GL_DEPTH_TEST)`, `glDepthFunc(GL_LESS)` (the default), `glDepthMask(GL_FALSE)` for a read-only
  depth buffer, `glClear(… | GL_DEPTH_BUFFER_BIT)` every frame.
- **The depth buffer**: created by GLFW with the window, 24 bits by default (`GLFW_DEPTH_BITS`).
- **`gl_FragCoord`**: x and y are the window position (origin bottom-left), z is the depth value.
- **`LinearizeDepth`**: starts with `depth * 2.0 - 1.0`, because OpenGL's NDC z runs from -1 to 1 and the viewport
  maps it to 0..1.
:::
:::vulkan
- **State**: `VkPipelineDepthStencilStateCreateInfo` in each pipeline: `depthTestEnable`, `depthWriteEnable`,
  `depthCompareOp = VK_COMPARE_OP_LESS`. Another depth function means another pipeline (or dynamic state).
- **The depth buffer**: your own image, `VK_FORMAT_D32_SFLOAT`, the render pass's second attachment; it is cleared by
  its `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR` with `clearValues[1].depthStencil = {1.0f, 0}`.
- **`gl_FragCoord`**: origin top-left; z is the depth value.
- **0..1 depth**: `GLM_FORCE_DEPTH_ZERO_TO_ONE` makes NDC z run from 0 to 1, so the depth value *is* NDC z and
  `LinearizeDepth` is `near * far / (far - depth * (far - near))`, without learnopengl's `depth * 2.0 - 1.0`.
- **Reversed z**: with a float depth buffer, mapping near to 1 and far to 0 (cleared to 0, function GREATER) spreads
  the precision almost evenly.
:::
:::d3d12
- **State**: the PSO's `DepthStencilState`, starting from `CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` (depth test on,
  writes on, `D3D12_COMPARISON_FUNC_LESS`); `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` for a read-only depth
  buffer. Another depth function means another PSO.
- **The depth buffer**: your own resource, `m_depthStencil` (`DXGI_FORMAT_D32_FLOAT`), with a DSV bound by
  `OMSetRenderTargets` and cleared with `ClearDepthStencilView`.
- **`SV_POSITION` in the pixel shader**: the pixel's window position (origin top-left) and its depth in z – GLSL's
  `gl_FragCoord`.
- **0..1 depth**: Direct3D's NDC z runs from 0 to 1, so `LinearizeDepth` is `near * far / (far - depth * (far - near))`;
  `near` and `far` are `static const` (without `static` they would be constant-buffer values).
- **Reversed z**: with a float depth buffer, mapping near to 1 and far to 0 (cleared to 0, function GREATER) spreads
  the precision almost evenly.
:::

## Stencil testing

- **Stencil buffer**: usually 8 bits per pixel (256 values) that you write while drawing and test against later.
- **Stencil test**: runs after the fragment shader and before the depth test. It compares a **reference value** with
  the stored value, both ANDed with a **compare mask** first, using a test function (the same eight as the depth
  test).
- **Stencil operations**: what happens to the stored value when the stencil test fails, when it passes but the depth
  test fails, and when both pass – KEEP, ZERO, REPLACE (with the reference value), increment and decrement (clamped or
  wrapping), INVERT.
- **Write mask**: ANDed with every value written; `0xFF` writes as is, `0x00` disables stencil writes.
- **Object outlining**: draw the objects with the function ALWAYS, the operation REPLACE (reference 1) and writes on,
  so the stencil buffer holds 1 where they are visible; then draw them scaled up by 1.1 in a single colour, with the
  function NOT_EQUAL 1, stencil writes off and the depth test off – only the ring outside the originals passes. The
  floor is drawn first and must not write to the stencil buffer.

:::opengl
- **State**: `glEnable(GL_STENCIL_TEST)`, `glStencilFunc(func, ref, mask)`, `glStencilOp(sfail, dpfail, dppass)` –
  here `GL_KEEP, GL_KEEP, GL_REPLACE` – and `glStencilMask(0xFF / 0x00)`.
- **The stencil buffer**: GLFW's default window has 8 stencil bits (`GLFW_STENCIL_BITS`); it is cleared with
  `GL_STENCIL_BUFFER_BIT`.
- **Restoring state**: the loop ends with `glStencilMask(0xFF)`, `glStencilFunc(GL_ALWAYS, 0, 0xFF)` and
  `glEnable(GL_DEPTH_TEST)`, because the state stays set into the next frame – and `glClear` obeys the stencil mask.
:::
:::vulkan
- **The stencil buffer**: part of the depth image – `VK_FORMAT_D32_SFLOAT_S8_UINT` or `VK_FORMAT_D24_UNORM_S8_UINT`,
  a view with `VK_IMAGE_ASPECT_DEPTH_BIT | VK_IMAGE_ASPECT_STENCIL_BIT`, cleared by `stencilLoadOp = CLEAR`.
- **State**: `stencilTestEnable` and two `VkStencilOpState`s, `front` and `back`, with `failOp`, `depthFailOp`,
  `passOp`, `compareOp`, `compareMask`, `writeMask` and `reference` – all fixed in the pipeline.
- **Three pipelines**: `floorPipeline` (write mask 0x00), `graphicsPipeline` (ALWAYS, 0xFF) and `outlinePipeline`
  (NOT_EQUAL, 0x00, depth test off). Nothing has to be restored: each pipeline carries its whole state.
:::
:::d3d12
- **The stencil buffer**: part of the depth buffer – `DXGI_FORMAT_D24_UNORM_S8_UINT` in the resource, the DSV, the
  clear value and the PSO's `DSVFormat`; cleared with `D3D12_CLEAR_FLAG_STENCIL`.
- **State**: `StencilEnable`, `StencilReadMask`, `StencilWriteMask` and two `D3D12_DEPTH_STENCILOP_DESC`s,
  `FrontFace` and `BackFace` (`StencilFailOp`, `StencilDepthFailOp`, `StencilPassOp`, `StencilFunc`).
- **The reference value** is not in the PSO: `OMSetStencilRef(1)` sets it on the command list.
- **Three PSOs**: `m_floorPipelineState`, `m_pipelineState` and `m_singleColorPipelineState`. Nothing has to be
  restored: each PSO carries its whole state, `ClearDepthStencilView` ignores the write mask, and `Reset` sets the
  reference back to 0.
:::

## Blending

- **Alpha**: the colour's fourth component, its opacity: 1.0 opaque, 0.0 fully transparent.
- **Discarding fragments**: for textures that are either fully opaque or fully transparent (the grass), the shader
  throws away fragments whose alpha is below a threshold (`if (texColor.a < 0.1) discard;`). A discarded fragment
  writes neither colour nor depth.
- **Clamp to edge**: transparent textures are sampled with clamping, because with repeat the filter at the top edge
  mixes in the opposite (opaque) edge and draws a semi-transparent line.
- **Blending**: after the fragment shader and the tests, the **source** colour (the shader's output) is combined with
  the **destination** colour (already in the colour buffer): `C_result = C_source * F_source + C_destination *
  F_destination`.
- **Alpha blending**: `F_source` = source alpha, `F_destination` = 1 − source alpha. Opaque surfaces (alpha 1) keep
  their own colour.
- **Blend operation**: how the two parts are combined – add (the usual), subtract, reverse subtract, min, max.
- **Transparency and the depth test**: the depth test doesn't know about transparency; a window drawn first stores its
  depth, and windows behind it are rejected before they can be blended.
- **Don't break the order**: draw all opaque objects first, then sort the transparent ones by their distance to the
  camera (a `std::map` keyed by distance) and draw them from the farthest to the nearest (a reverse iterator).

:::opengl
- **State**: `glEnable(GL_BLEND)`, `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`; `glBlendFuncSeparate` for
  separate alpha factors, `glBlendEquation(GL_FUNC_ADD)` for the operation, `glBlendColor` for the constant colour.
  Global: it applies to the opaque objects too, which changes nothing for alpha 1.
- **Wrapping**: belongs to the texture; `loadTexture` uses `GL_CLAMP_TO_EDGE` for RGBA images.
:::
:::vulkan
- **State**: the pipeline's `VkPipelineColorBlendAttachmentState`: `blendEnable = VK_TRUE`,
  `srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`,
  `colorBlendOp = VK_BLEND_OP_ADD`, and separate factors for alpha (always). The project draws everything with one
  blending pipeline.
- **Wrapping**: belongs to the sampler; the grass and the windows use `transparentSampler`
  (`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`).
:::
:::d3d12
- **State**: the PSO's `BlendState.RenderTarget[0]`: `BlendEnable = TRUE`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`,
  `DestBlend = D3D12_BLEND_INV_SRC_ALPHA` ("one minus" is *INV*), `BlendOp = D3D12_BLEND_OP_ADD`, and the same for
  alpha. The constant factor is set with `OMSetBlendFactor`.
- **A second PSO**: `m_transparentPipelineState` with the pixel shader `PSTransparent` (which discards) and blending;
  the cubes and the floor keep `m_pipelineState`.
- **Wrapping**: belongs to the sampler; a second static sampler at `s1` clamps (`clampSampler`).
:::

## Face culling

- **Winding order**: the order in which a triangle's corners go round – clockwise or counter-clockwise – as seen on
  the screen. Seen from the other side, the same corners go round the other way.
- **Front and back faces**: by convention a closed model's triangles are counter-clockwise seen from outside; the
  rasterizer decides after the vertex shader, from the winding on the screen, whether a triangle faces the camera.
- **Face culling**: back faces are dropped before rasterization, so the fragment shader never runs for them – more
  than half the fragment work of a closed object saved, with the same picture. Culling the front faces instead shows
  the insides of the cubes.
- **Not for open surfaces**: single quads like the grass must be seen from both sides, so they are drawn without
  culling. learnopengl's floor had to be reordered: it was clockwise seen from above.
- **Cross product check**: (b − a) × (c − a) points out of the model when a → b → c is counter-clockwise seen from
  outside.

:::opengl
- **State**: `glEnable(GL_CULL_FACE)`, `glCullFace(GL_BACK)` (or `GL_FRONT`, `GL_FRONT_AND_BACK`),
  `glFrontFace(GL_CCW)` (or `GL_CW`).
:::
:::vulkan
- **State**: the pipeline's rasterization state: `cullMode = VK_CULL_MODE_BACK_BIT` (or `FRONT_BIT`, `NONE`,
  `FRONT_AND_BACK`) and `frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE`.
- **Why counter-clockwise**: Vulkan judges the winding on the finished image; `proj[1][1] *= -1` keeps that image
  upright, so the triangles have OpenGL's orientation.
:::
:::d3d12
- **State**: the PSO's rasterizer state: `CullMode = D3D12_CULL_MODE_BACK` (or `FRONT`, `NONE` – there is no "both")
  and `FrontCounterClockwise = TRUE`.
- **Why counter-clockwise**: Direct3D's default is clockwise, but the right-handed `XMMatrixLookAtRH` and
  `XMMatrixPerspectiveFovRH` put every triangle on the screen as OpenGL does.
:::

## Framebuffers

- **Framebuffer**: the colour, depth and stencil buffers drawn into, together. Until this chapter it was always the
  window's.
- **Off-screen rendering**: drawing into a framebuffer of your own; nothing appears in the window until you show it.
- **Attachment**: a memory location (an image) of a framebuffer. If a shader must read it later, it is a texture; if
  it is only written and tested (usually depth and stencil), it can be stored in whatever way is fastest – OpenGL's
  **renderbuffer**.
- **Rendering to a texture**: draw the scene into your own colour texture, switch back to the window and draw a
  **screen quad** – two triangles given in NDC, no matrices, no depth test – textured with it.
- **Post-processing**: effects on the finished picture in the screen quad's shader: **inversion** (`1.0 - colour`),
  **grayscale** (weighted: 0.2126 red, 0.7152 green, 0.0722 blue).
- **Kernel** (convolution matrix): a 3×3 grid of weights for a pixel and its eight neighbours, sampled at
  `offset = 1.0 / 300.0`. Sharpen (weights sum to 1), blur (`1 2 1 / 2 4 2 / 1 2 1`, divided by 16), edge detection
  (sum 0: uniform areas turn black). At the border the sampler's wrapping decides what the neighbours are.

:::opengl
- **Framebuffer object**: `glGenFramebuffers`, `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer)`; binding `0` returns
  to the window's **default framebuffer**. `GL_READ_FRAMEBUFFER` and `GL_DRAW_FRAMEBUFFER` bind it for one direction.
- **Attachments**: `glTexImage2D(…, NULL)` and `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
  GL_TEXTURE_2D, textureColorbuffer, 0)`; a renderbuffer with `glRenderbufferStorage(GL_RENDERBUFFER,
  GL_DEPTH24_STENCIL8, …)` and `glFramebufferRenderbuffer(…, GL_DEPTH_STENCIL_ATTACHMENT, …)`.
- **Completeness**: `glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE`.
- **The loop**: bind the framebuffer and `glEnable(GL_DEPTH_TEST)`, draw the scene, bind 0, `glDisable(GL_DEPTH_TEST)`,
  draw the quad with `screenShader`.
:::
:::vulkan
- **Three parts**: images (the attachments), a render pass that describes them, and a `VkFramebuffer` that names the
  views for it – `offscreenRenderPass` and `offscreenFramebuffer`.
- **Usage flags**: the colour image is `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`; a depth
  image with only `DEPTH_STENCIL_ATTACHMENT` is the renderbuffer's equivalent.
- **Readable afterwards**: the colour attachment's `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, and a
  subpass dependency to `VK_SUBPASS_EXTERNAL` makes the next fragment shaders wait for the colour writes.
- **Pipelines per render pass**: a pipeline is made for one render pass (or a compatible one), so the screen quad gets
  `screenPipeline` for the window's `renderPass`, without depth test. Two render passes in one command buffer replace
  "bind a framebuffer, draw, bind the default one, draw".
:::
:::d3d12
- **No framebuffer object**: a texture created with `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`, an RTV to draw into it
  and an SRV to read it; `OMSetRenderTargets` is the closest thing to `glBindFramebuffer`.
- **Resource states**: a transition barrier turns `m_offscreenTarget` from `PIXEL_SHADER_RESOURCE` into `RENDER_TARGET`
  for the scene and back for the screen quad – and makes the reads wait for the writes.
- **Formats**: the texture has the back buffer's format, so the scene's PSO can draw into it; the quad's PSO has
  `DSVFormat = DXGI_FORMAT_UNKNOWN` and `DepthEnable = FALSE`, because its pass binds no depth buffer.
- **Renderbuffer**: the existing depth buffer, which has no SRV, plays that role.
:::

## Cubemaps

- **Cube map**: six square 2D textures that form the faces of a cube, sampled with a **direction** from the cube's
  centre; the length of the direction doesn't matter. The faces are in the order +X, -X, +Y, -Y, +Z, -Z.
- **Clamp to edge**: cube maps are sampled with clamping, so directions between two faces still get edge values.
- **Skybox**: a cube around the camera with a cube map of the surroundings; its vertex positions are the directions
  it is sampled with.
- **View without translation**: the skybox uses only the rotation of the view matrix (`mat4(mat3(view))`), so the
  camera can turn but never gets closer to the sky.
- **Drawn first**: with depth writes off, so everything drawn later covers it.
- **An optimization – drawn last**: the vertex shader sets `gl_Position = pos.xyww`, so the depth after the perspective
  division is 1.0; with the depth function LESS_OR_EQUAL the sky only passes where nothing was drawn, and early depth
  testing skips its fragment shader everywhere else.
- **Environment mapping**: **reflection** samples the cube map with `R = reflect(I, normalize(Normal))`, where `I` is
  the direction from the camera to the fragment in world space; **refraction** uses `refract(I, N, 1.00 / 1.52)`, the
  ratio of the refractive indices (air to glass).
- **Dynamic environment map**: a cube map rendered every frame from the object's position, six times with a 90° field
  of view, so the reflection shows the other objects too.

:::opengl
- **Creating it**: `glBindTexture(GL_TEXTURE_CUBE_MAP, …)` and `glTexImage2D` six times with the targets
  `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`; `GL_TEXTURE_WRAP_S/T/R` set to `GL_CLAMP_TO_EDGE`.
- **Loading the faces**: `stbi_set_flip_vertically_on_load(false)` – cube map faces start with their top row.
- **In GLSL**: `samplerCube` sampled with a `vec3`.
- **Skybox state**: drawn first between `glDepthMask(GL_FALSE)` and `glDepthMask(GL_TRUE)`; drawn last between
  `glDepthFunc(GL_LEQUAL)` and `glDepthFunc(GL_LESS)`.
:::
:::vulkan
- **Creating it**: a 2D image with 6 array layers and `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, read through a
  `VK_IMAGE_VIEW_TYPE_CUBE` view; layer i is face i. The descriptor is still a combined image sampler.
- **In GLSL**: `samplerCube` sampled with a `vec3`.
- **Skybox state**: its own `skyboxPipeline` – first with `depthWriteEnable = VK_FALSE`, then with
  `VK_COMPARE_OP_LESS_OR_EQUAL` and drawn last; the cubes' pipeline keeps LESS. The vertex shader removes the
  translation itself, `mat4(mat3(ubo.view))`.
- **Reflection**: `cameraPos` follows `proj` in the uniform buffer (offset 128), which is now visible to the fragment
  stage too.
:::
:::d3d12
- **Creating it**: a 2D texture with `DepthOrArraySize = 6` and an SRV with `D3D12_SRV_DIMENSION_TEXTURECUBE`; slice i
  is face i. A second static sampler at `s1` clamps.
- **In HLSL**: `TextureCube`, whose `Sample` takes a `float3`.
- **Skybox state**: its own `m_skyboxPipelineState` – first with `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`, then
  with `D3D12_COMPARISON_FUNC_LESS_EQUAL` and drawn last. The vertex shader removes the translation with
  `(float3x3)view` and returns `pos.xyww`.
- **Reflection**: the normal matrix is computed on the CPU and sent with the model matrix; `cameraPos` follows
  `projection` in the constant buffer, which is now visible to all stages.
:::

## Advanced Data

- **Buffer**: a piece of GPU memory; what it is used for is decided by how you bind or describe it.
- **Filling in parts**: reserve the memory first, then write a range at an offset, or get a pointer to the memory and
  write through it (**mapping**).
- **Interleaved vs batched**: interleaved puts each vertex's attributes together (123123…), batched puts each
  attribute's array in a block of its own (111…222…). Batched, an attribute's **stride** is its own size and its
  **offset** is where its block starts – for 36 positions of 3 floats, the texture coordinates start at byte 432.
- **Copying buffers**: a copy from one buffer to another runs on the GPU; the data never comes back to the program.
- **Staging**: the CPU writes into memory it can reach, the GPU copies it into memory that is fastest for the GPU to
  read.
- **The picture never changes**: the chapter's tasks only change how the data gets into the buffers.

:::opengl
- **Filling**: `glBufferData(…, NULL, …)` reserves memory; `glBufferSubData(target, offset, size, data)` fills a range;
  `glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY)` returns a pointer, `glUnmapBuffer` ends it.
- **Batched attributes**: `glVertexAttribPointer` with the stride of one attribute (`2 * sizeof(float)`) and the block's
  offset (`(void*)(sizeof(cubePositions))`).
- **Copying**: `glCopyBufferSubData(readtarget, writetarget, readoffset, writeoffset, size)`, with the targets
  `GL_COPY_READ_BUFFER` and `GL_COPY_WRITE_BUFFER` so two buffers can be bound at once.
:::
:::vulkan
- **Filling**: `vkMapMemory` maps a range (offset and size) of host-visible memory; one mapping at a time; with
  `HOST_COHERENT` memory no flush is needed. `vkCmdUpdateBuffer` records a small update (at most 65536 bytes, outside
  a render pass, into a `TRANSFER_DST` buffer), followed by a barrier.
- **Batched attributes**: a binding has one stride, so two blocks need two bindings; `vkCmdBindVertexBuffers` gives
  each binding the offset of its block.
- **Copying**: `vkCmdCopyBuffer` with `VkBufferCopy` regions (source offset, destination offset, size): the staging
  buffer is copied into a device-local vertex buffer.
:::
:::d3d12
- **Heaps**: an upload heap can be mapped by the CPU, a default heap is GPU-only and fastest for the GPU.
- **Filling**: `Map` (a read range of `(0, 0)` promises not to read), `memcpy`, `Unmap`.
- **Batched attributes**: a vertex buffer view has one stride, so two blocks need two input slots with a view each.
- **Copying**: `CopyBufferRegion(dst, dstOffset, src, srcOffset, numBytes)`; the copy promotes the destination from
  `COMMON` to `COPY_DEST`, and a barrier makes it `VERTEX_AND_CONSTANT_BUFFER`. The vertex buffer moves into a
  default heap, filled from an upload buffer.
:::

## Advanced GLSL

- **Built-in variables**: values the shading language provides: the vertex shader's position output, the **point
  size**, the **vertex ID**, the fragment's window coordinates and depth (`gl_FragCoord`), whether it belongs to a
  **front face**, and its writable **depth**.
- **Window coordinates**: a fragment's x and y are its pixel's centre, e.g. 0.5 for the first column; comparing x with
  400 splits the 800-pixel window in two.
- **Front-facing**: tells the fragment shader whether its triangle is a front or back face – by the same rule culling
  uses; with the front faces culled, only back faces (the cubes' insides) are drawn.
- **Writing the depth**: turns early depth testing off; *conservative depth* (a promise to only make the depth greater
  or smaller) keeps part of it.
- **Interface blocks**: the outputs of one stage and the inputs of the next grouped like a struct.
- **Uniform buffer objects**: uniforms that many shaders share – the projection and view – stored once in a buffer.
- **std140 layout**: standardized offsets: scalars 4 bytes, a `vec3` or `vec4` aligned to 16, every array element and
  every matrix column 16 bytes, structs padded to 16. A `vec3` after a `float` starts at byte 16.
- **The example**: four cubes with four shader programs (red, green, yellow, blue) share one buffer with the projection
  and view; only the model matrix is set per cube.

:::opengl
- **Built-ins**: `gl_PointSize` (with `glEnable(GL_PROGRAM_POINT_SIZE)`), `gl_VertexID`, `gl_FragCoord` (origin
  bottom-left: the top-left pixel is (0.5, 599.5)), `gl_FrontFacing`, `gl_FragDepth`; `layout (depth_greater)` needs
  OpenGL 4.2.
- **Interface blocks**: `out VS_OUT { vec2 TexCoords; } vs_out;` and `in VS_OUT { … } fs_in;` – matched by the block
  name.
- **Uniform blocks**: `layout (std140) uniform Matrices { … };` (the default *shared* and *packed* layouts must be
  queried); `glUniformBlockBinding` with `glGetUniformBlockIndex` links a block to a binding point,
  `glBindBufferBase` / `glBindBufferRange` link the buffer; `glBufferSubData` writes the projection once and the view
  every frame.
:::
:::vulkan
- **Built-ins**: `gl_PointSize` must be written for a point list; `gl_VertexIndex` and `gl_InstanceIndex` (OpenGL's
  `gl_VertexID`, `gl_InstanceID`); `gl_FragCoord` with its origin top-left; `gl_FrontFacing`, `gl_FragDepth` and the
  depth conditions.
- **Interface blocks**: matched by `location`, so the block gets `layout(location = 0)`.
- **Uniform blocks**: every uniform is in a block – std140 by default, push constants std430. The binding point is
  `layout(binding = 0)`, the buffer range a `VkDescriptorBufferInfo`, binding it `vkCmdBindDescriptorSets`; C++ members
  may need `alignas(16)`.
- **Four pipelines**: with the same pipeline layout, the descriptor set stays bound when the pipeline changes.
:::
:::d3d12
- **System-value semantics**: `SV_VertexID`, `SV_InstanceID`, `SV_POSITION` (in the pixel shader: origin top-left),
  `SV_IsFrontFace`, `SV_Depth`, and `SV_DepthGreaterEqual` / `SV_DepthLessEqual` for conservative depth. There is no
  point size: a point is always one pixel.
- **Interface blocks**: the struct the vertex shader returns and the pixel shader takes; stages are matched by
  semantics.
- **Constant buffers**: `cbuffer … : register(b1)` is a uniform block. HLSL packs into 16-byte registers and only
  moves a variable that would straddle one, so a `float3` after a `float` starts at byte 4. A CBV is a multiple of 256
  bytes, and matrices are transposed because HLSL reads them column by column.
- **Four PSOs**: with the same root signature, the root arguments stay set when the PSO changes.
:::

## Geometry Shader

- **Geometry shader**: an optional stage between the vertex and the fragment shader. It gets a whole primitive –
  a point, a line or a triangle, with all its vertices – and emits new primitives: points, line strips or triangle
  strips, up to a declared maximum number of vertices.
- **Emitting**: each output vertex gets its position (and outputs such as a colour) and is emitted; ending the
  primitive starts a new strip.
- **Houses**: each point becomes a triangle strip of 5 vertices – 3 triangles, two for the walls and one for the roof.
  Giving the last vertex the colour white makes the roof fade to white at its tip: outputs are interpolated.
- **Exploding objects**: each triangle is moved along its face normal (the normalized cross product of two edges) by
  `(sin(time) + 1) / 2 * 2.0`. learnopengl does it in clip space.
- **Visualizing normal vectors**: draw the model normally, then a second time with a geometry shader that emits a
  short line (length 0.2) along each vertex's normal – a good way to check normals.

:::opengl
- **Program**: the Shader class takes an optional third file, compiled as `GL_GEOMETRY_SHADER` and attached before
  linking.
- **GLSL**: `layout (points) in;`, `layout (triangle_strip, max_vertices = 5) out;`, the input vertices in `gl_in[]`,
  `EmitVertex()` and `EndPrimitive()`; the vertex shader's outputs arrive as an array of interface blocks,
  `in VS_OUT { vec3 color; } gs_in[];`.
:::
:::vulkan
- **Pipeline**: the device feature `geometryShader` must be enabled, and the `.geom` module is one more shader stage,
  `VK_SHADER_STAGE_GEOMETRY_BIT` (optional per pipeline).
- **GLSL**: as in OpenGL (`gl_in[]`, `EmitVertex()`, `EndPrimitive()`), with `layout(location = …)` on the interface
  blocks; the uniform buffer's binding gets the geometry stage in its `stageFlags`.
- **Vulkan's y points down**: the y offsets are negated, so the houses look the same, and the face normal is
  `cross(b, a)`, because the projection's y flip mirrors clip space.
- **Points**: a point list needs `gl_PointSize` in the vertex shader.
:::
:::d3d12
- **HLSL**: `[maxvertexcount(5)]`, the input primitive as a parameter (`point VSOutput input[1]`,
  `triangle VSOutput input[3]`) and an output stream (`inout PointStream<…>`, `LineStream<…>`,
  `TriangleStream<…>`) with `Append` and `RestartStrip` – GLSL's `EmitVertex` and `EndPrimitive`.
- **PSO**: compiled with the target `gs_5_0` and set as `psoDesc.GS`; `PrimitiveTopologyType` names the geometry
  shader's input primitive. The CBV's root parameter is visible to all stages.
:::

## Instancing

- **Instancing**: drawing many copies (instances) of the same mesh with one draw call; the vertex shader gets the
  instance's number and picks that instance's data.
- **Why**: every draw call costs CPU time – the driver prepares and sends commands to the GPU – so thousands of small
  draws keep the GPU waiting for the CPU. One instanced draw sends the mesh once.
- **Per-instance data in an array**: 100 offsets in a uniform array, indexed by the instance number.
- **Instanced arrays**: a vertex attribute that advances once per instance instead of once per vertex – no size limit
  of a uniform array.
- **Integer division**: scaling by `gl_InstanceID / 100.0` needs the `.0`; `/ 100` would give 0.
- **Asteroid field**: 500 rocks in a ring (radius 15) around the planet, each with a model matrix computed once on
  the CPU (`srand(42)`: the same field every run), stored as a per-instance **mat4 attribute**. A vertex attribute is at
  most four components, so the matrix takes four attributes, one per column. learnopengl draws 100 000 rocks – a real
  GPU does that easily with instancing; the course uses 500 because its simulator runs on the CPU.

:::opengl
- **Drawing**: `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100)`, `glDrawElementsInstanced(…, amount)`; in the shader
  `gl_InstanceID`.
- **Uniform array**: `uniform vec2 offsets[100];`, each element set by name (`"offsets[" + std::to_string(i) + "]"`).
- **Instanced array**: `glVertexAttribDivisor(2, 1)` for `aOffset`; the matrix is `layout (location = 3) in mat4
  aInstanceMatrix;` over locations 3–6, each with `glVertexAttribDivisor(…, 1)`.
:::
:::vulkan
- **Drawing**: `vkCmdDraw(commandBuffer, 6, 100, 0, 0)`, `vkCmdDrawIndexed(…, amount, …)`; in the shader
  `gl_InstanceIndex`.
- **Uniform array**: `vec4 offsets[100]` in the uniform buffer – in std140 every array element takes 16 bytes anyway.
- **Instanced array**: vertex binding 1 with `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE`; the matrix is a `mat4` at
  locations 4–7 (the `Vertex` already uses 0–3), four `VK_FORMAT_R32G32B32A32_SFLOAT` attributes.
:::
:::d3d12
- **Drawing**: `DrawInstanced(6, 100, 0, 0)`, `DrawIndexedInstanced(…, amount, …)`; in the shader `SV_InstanceID`.
- **Constant buffer array**: `float4 offsets[100]` (every array element takes a 16-byte register), bound as a root
  constant buffer view (`SetGraphicsRootConstantBufferView`).
- **Instanced array**: input elements with `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` and a step rate of 1 in
  input slot 1; the matrix is four `INSTANCEMATRIX` elements that the shader puts back together, stored untransposed.
:::

## Anti Aliasing

- **Aliasing**: jagged, stair-stepped edges, because each pixel is either inside a triangle or not.
- **SSAA** (super-sample anti-aliasing): render at a higher resolution and scale down – smooth, but every pixel is
  shaded several times.
- **MSAA** (multisample anti-aliasing): each pixel has several **samples** (here 4). The rasterizer checks which samples
  a triangle covers; the fragment shader still runs **once** per pixel and triangle, and its colour is stored in the
  covered samples. Depth and stencil are tested per sample.
- **Resolve**: averaging each pixel's samples into one colour – an edge pixel covered by 2 of 4 samples gets half the
  triangle's colour and half the background's.
- **Off-screen MSAA**: a multisampled image can't be sampled like a normal texture, so for post-processing it is first
  resolved into a normal image; the effect then works on the smooth picture. (Reading the samples one by one, with
  `sampler2DMS` and `texelFetch`, is learnopengl's "custom anti-aliasing algorithm".)
- **The scene**: a flat green cube, turned by 30° so that its edges show the stairs.

:::opengl
- **MSAA in the window**: `glfwWindowHint(GLFW_SAMPLES, 4)` before the window is created, `glEnable(GL_MULTISAMPLE)`.
- **Off-screen**: `glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, …)` and `glRenderbufferStorageMultisample(…,
  4, GL_DEPTH24_STENCIL8, …)`; `glBlitFramebuffer(…, GL_COLOR_BUFFER_BIT, GL_NEAREST)` from the multisampled framebuffer
  (`GL_READ_FRAMEBUFFER`) resolves it into the window or into `intermediateFBO`, whose texture the screen quad samples.
:::
:::vulkan
- **No `GLFW_SAMPLES`**: the sample count is chosen with `getMaxUsableSampleCount()` (the device's
  `framebufferColorSampleCounts & framebufferDepthSampleCounts`; 4 here).
- **MSAA**: a multisampled colour image (`TRANSIENT_ATTACHMENT | COLOR_ATTACHMENT`), a depth image with the same
  samples, `rasterizationSamples = msaaSamples` in the pipeline, and a **resolve attachment** in the subpass
  (`pResolveAttachments`) – the swap chain image, or an offscreen image that the screen quad samples.
:::
:::d3d12
- **No multisampled window**: a flip-model swap chain must have `SampleDesc.Count = 1`, so the scene goes into a
  multisampled render target (`Tex2D(…, 1, 1, 4, 0, ALLOW_RENDER_TARGET)`), with a depth buffer of the same sample
  count (`D3D12_DSV_DIMENSION_TEXTURE2DMS`) and `psoDesc.SampleDesc.Count = 4`; `CheckFeatureSupport` with
  `D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS` checks the support.
- **Resolve**: `ResolveSubresource` between barriers to `RESOLVE_SOURCE` and `RESOLVE_DEST` – into the back buffer, or
  into `m_screenTexture` for post-processing (the quad's PSO has one sample).
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Where the settings live | global state (`glEnable`, …) | the pipeline | the PSO |
| Depth test and function | `GL_DEPTH_TEST`, `glDepthFunc` | `depthTestEnable`, `depthCompareOp` | `DepthEnable`, `DepthFunc` |
| Read-only depth | `glDepthMask(GL_FALSE)` | `depthWriteEnable = VK_FALSE` | `D3D12_DEPTH_WRITE_MASK_ZERO` |
| Stencil test | `glStencilFunc`, `glStencilOp`, `glStencilMask` | `front` / `back` `VkStencilOpState` | `FrontFace` / `BackFace`, masks, `OMSetStencilRef` |
| Blending | `glEnable(GL_BLEND)`, `glBlendFunc` | `VkPipelineColorBlendAttachmentState` | `BlendState.RenderTarget[0]` |
| Face culling | `glCullFace`, `glFrontFace` | `cullMode`, `frontFace` | `CullMode`, `FrontCounterClockwise` |
| Own render target | framebuffer object | image + render pass + `VkFramebuffer` | resource + RTV + SRV |
| Readable afterwards | done by the driver | `finalLayout` + subpass dependency | transition barrier |
| Cube map | `GL_TEXTURE_CUBE_MAP` | 6 layers, `VK_IMAGE_VIEW_TYPE_CUBE` | 6 slices, `TEXTURECUBE` SRV |
| Copying buffers | `glCopyBufferSubData` | `vkCmdCopyBuffer` | `CopyBufferRegion` |
| Shared uniforms | uniform block, binding point | uniform block, descriptor | `cbuffer`, register |
| Geometry shader | `GL_GEOMETRY_SHADER` in the program | `geometryShader` feature, geometry stage | `gs_5_0`, `psoDesc.GS` |
| Per-instance attribute | `glVertexAttribDivisor` | `VK_VERTEX_INPUT_RATE_INSTANCE` | `PER_INSTANCE_DATA` |
| Instance number | `gl_InstanceID` | `gl_InstanceIndex` | `SV_InstanceID` |
| MSAA resolve | `glBlitFramebuffer` (or the window) | resolve attachment | `ResolveSubresource` |

With this part done you know the tools that the rest of learnopengl.com builds on: shadow maps are depth textures
rendered off-screen, HDR and bloom are post-processing, and deferred shading renders into several framebuffer
attachments at once.
