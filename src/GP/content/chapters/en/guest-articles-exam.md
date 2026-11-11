# Exam: Guest Articles

Show what you've learned in *Guest Articles*: order-independent transparency, skeletal animation, the scene graph and
frustum culling, cascaded shadow maps, terrain from a height map with and without tessellation, direct state access,
physically based bloom, compute shaders and area lights. The questions cover the whole part, some of them for {{api}} in
particular. Answer all of them and press **Submit answers**; you need 80 % right to pass, and you can take the exam
again.

```quiz
In which of these scenes can sorting the transparent objects back to front by their centres NOT give the right picture everywhere? (Several answers are right.)
- [x] Two transparent panes that pass through each other
- [ ] Three small transparent quads far apart from each other, at different distances
- [x] A cloud of transparent particles drawn as one mesh in one draw call
- [x] Three transparent objects that overlap like the blades of a fan: A in front of B, B in front of C, C in front of A
---
Sorting orders whole objects. Intersecting objects, cyclic overlap and a mesh that overlaps itself need an order per fragment – which is what order-independent transparency provides.
```

```quiz
Which order-independent transparency technique is exact but needs one pass over all transparent geometry for every layer it resolves?
- [ ] Weighted blended OIT
- [ ] Per-pixel linked lists
- [x] Depth peeling
- [ ] Moment-based OIT
---
Each pass keeps the nearest fragment behind the layer found by the pass before. Per-pixel linked lists are exact in one geometry pass (plus a resolve pass); weighted blended and moment-based OIT are approximations.
```

```quiz
Three transparent layers with alphas 0.5, 0.5 and 0.2 cover a pixel. What is the revealage weighted blended OIT computes there?
- [x] 0.2 = 0.5 · 0.5 · 0.8, whatever the order the layers are drawn in
- [ ] 0.8, the alpha of the layer drawn last
- [ ] 0.25, because the faintest layer is ignored
- [ ] It depends on which layer is nearest to the camera
---
The revealage is the product of all (1 − α) – exact and order-independent. Only the colour, the weighted average, is an approximation.
```

```quiz
How do the accumulation and revealage targets get their contents in the transparent pass?
- [ ] Both blend with `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`; the composite pass separates them
- [x] Accumulation adds `(C · α, α) · w` with `ONE, ONE` from 0; revealage starts at 1 and is multiplied by `1 − α` with `ZERO, ONE_MINUS_SRC_COLOR`
- [ ] The fragment shader reads both targets and writes the new values
- [ ] Accumulation is multiplied, revealage is added up
---
Fixed-function blending computes the sum and the product, so no shader needs to read the target it writes. It needs different blend functions for the two targets in one draw.
```

```quiz
The tentacle's `Upper` bone sits at y = 1.1 in the bind pose. What is its offset matrix, and what is its final matrix `globalTransform · offset` while the tentacle stands in the bind pose?
- [ ] The identity; `translate(0, 1.1, 0)`
- [ ] `translate(0, 1.1, 0)`; `translate(0, 2.2, 0)`
- [ ] `translate(0, -1.1, 0)`; `translate(0, -1.1, 0)`
- [x] `translate(0, -1.1, 0)`; the identity
---
The offset matrix is the inverse of the bone's global bind-pose transform: it takes a vertex into the bone's space. In the bind pose the global transform undoes it again, so the mesh stays as it was modelled.
```

```quiz
Why does the animator interpolate bone rotations as quaternions with slerp instead of interpolating the components of the rotation matrices?
- [x] Linearly interpolated rotation matrices are not rotations – the mesh shrinks and shears between the keys; slerp moves along the shortest arc at a constant angular speed
- [ ] Because assimp cannot store rotation matrices
- [ ] Because slerp is cheaper than adding two matrices
- [ ] Because quaternions also contain the bone's scale
---
Euler angles fail differently: the three angles change independently and can swing through orientations neither key has. Positions and scales are interpolated linearly with `mix`.
```

```quiz
The tentacle's animation has 1000 ticks per second, a duration of 2000 ticks and keys at 0, 500, 1000, 1500 and 2000. After 2.6 s of playing, between which keys does a bone interpolate, and with which factor?
- [ ] 2500 and 3000, factor 0.2
- [ ] 0 and 500, factor 0.6
- [ ] 1500 and 2000, factor 0.6
- [x] 500 and 1000, factor 0.2
---
2.6 s is 2600 ticks; `fmod(2600, 2000)` = 600, between the keys at 500 and 1000: `(600 − 500) / (1000 − 500)` = 0.2.
```

```quiz
In a scene graph a planet is scaled to 0.5. Its moon has the local position (3.5, 0, 0) and the local scale 0.6. How far from the planet's centre is the moon in the world, and how large is it?
- [ ] 3.5 units away, at scale 0.6 – local values are world values
- [x] 1.75 units away, at scale 0.3 – the parent's scale carries over to the position and the size of the child
- [ ] 1.75 units away, at scale 0.6
- [ ] 7 units away, at scale 1.2
---
`global = parentGlobal · local`: the planet's scale applies to everything in its space, the moon's offset included.
```

```quiz
With the dirty flag, an entity in the middle of the tree gets a new local position. What does the next update recompute?
- [ ] Only that entity's matrix
- [ ] Every entity in the tree, as without the flag
- [x] That entity's matrix and the matrices of everything below it, whose global matrices contain it
- [ ] That entity and its parent
---
Clean entities above and beside it keep their matrices; the update only looks further down them for dirty entities.
```

```quiz
A planet's bounding sphere has the radius 1.2 in world space. Its centre's signed distance to the frustum's far plane (normal pointing inwards) is −0.8, and it is well inside the other five planes. Is the planet drawn?
- [ ] No: a negative signed distance means outside the frustum
- [x] Yes: the sphere is on or in front of the plane when the distance is greater than −radius, and −0.8 > −1.2 – the planet pokes into the frustum
- [ ] No: the centre must be inside every plane
- [ ] Only if its AABB says so too
---
The test is conservative: a model whose volume is partly inside is drawn, and the GPU clips the rest. It may draw something invisible but never skips something visible.
```

```quiz
In the turned grid, axis-aligned boxes let 38 planets through where spheres let 37. Why are the boxes not tighter, though the ringed planet fits a box much better than a sphere?
- [ ] Because AABBs are tested against only four of the six planes
- [ ] Because the box's extents are measured from the smallest positive float
- [ ] Because boxes ignore the entity's scale
- [x] Because the model matrix turns the box with the grid, and the axis-aligned box around a turned box is larger than the box itself
---
An AABB is tight only while the object stays aligned with the axes. An oriented bounding box keeps the tight fit, at a higher cost per test.
```

```quiz
What does frustum culling save? (Several answers are right.)
- [x] The draw calls the CPU would record and submit for objects outside the view
- [ ] The fragments of planets hidden behind other planets in the view
- [x] The vertex shader work for the culled objects' vertices
- [ ] The pixels of the objects that are in view
---
Culling knows nothing about occlusion – a hidden planet is inside the frustum and drawn – and a visible object costs as much as before.
```

```quiz
Why does cascaded shadow mapping split the camera's view into slices with a shadow map each?
- [ ] Because a shadow map can't be larger than 1024 × 1024
- [x] Because one map over a large view spreads its texels evenly while the view shows near things large: near the camera there are too few texels per pixel – perspective aliasing
- [ ] Because a directional light needs one map per cube face
- [ ] Because the depth test can't compare distances beyond 50 units
---
The near slices are short and their maps sharp; the far slices are long, but far away a texel covers few pixels, so a coarser map is good enough.
```

```quiz
learnopengl stretches the z range of each cascade's light box by `zMult = 10`. What would go wrong if the box ended at the slice's corners?
- [ ] The shadow maps would hold negative depths
- [ ] The cascades would overlap
- [ ] The bias would have to be ten times larger
- [x] Objects between the light and the slice – outside the camera's view, but casting shadows into it – would be clipped away in the depth pass, and their shadows would vanish
---
The factor has to be tuned to the scene; fitting the light box's near and far planes to the scene's bounds uses the depth precision better.
```

```quiz
Why does the cascaded shadow function divide the bias by the cascade's far distance?
- [x] The bias is a distance in the shadow map's depth range; a larger cascade box turns the same bias into a larger distance in the world, which detaches the shadows from their casters (peter panning)
- [ ] Because the far cascades are rendered with front-face culling
- [ ] To make the far shadows darker
- [ ] Because PCF needs a different bias in every cascade
---
The farther and larger the cascade, the smaller the bias in depth units – so that it stands for a similar distance in the world in every cascade.
```

```quiz
The CPU terrain is one set of triangle strips, two rows each. Why can't the whole index buffer be drawn as one strip?
- [ ] Because a strip can have at most 512 indices
- [ ] Because the strips' winding alternates
- [x] Because the last vertex of one strip and the first of the next would form long triangles across the terrain; each strip needs its own draw, or a restart index between them
- [ ] Because the vertex buffer has no texture coordinates
---
learnopengl draws 255 strips one by one, each from its own place in the index buffer. Primitive restart ends a strip with a special index, so one draw covers all of them.
```

```quiz
Which tessellation stage decides how finely a patch is cut, and which one computes where each new vertex goes?
- [ ] The tessellator decides the levels; the vertex shader positions the new vertices
- [ ] The evaluation (domain) shader decides the levels; the control (hull) shader positions the vertices
- [ ] Both are decided by the fixed-function tessellator
- [x] The control (hull) shader sets the tessellation levels per patch; the evaluation (domain) shader runs for each generated point and computes its position
---
In between, the fixed-function tessellator turns the levels into (u, v) points and triangles over an abstract patch – without knowing positions or textures.
```

```quiz
learnopengl's levels of 8 with `fractional_odd_spacing` cut each edge into 9 segments, two of them shorter. Why does fractional spacing pay off once the levels depend on the distance?
- [ ] Because odd numbers of segments need fewer triangles
- [x] Because a level that changes smoothly then moves the points smoothly, instead of making new points pop in at whole numbers
- [ ] Because integer spacing can't go above level 8
- [ ] Because fractional spacing reads the height map with mipmaps
---
`equal_spacing` (`integer` in Direct3D) rounds up to whole equal segments: a level crossing a whole number would add points at once.
```

```quiz
The distance-based control shader computes each outer level from the nearer of its edge's two corners, not from the patch's centre. Why?
- [ ] Because the patch's centre is not known in the control shader
- [ ] Because the inner levels must be larger than the outer ones
- [ ] Because the tessellator only accepts levels from corners
- [x] Because two neighbouring patches share the edge: computed from the edge's own corners, both give it the same level, so their points line up – otherwise cracks open between the patches
---
The inner levels may differ freely between patches: they only affect the inside of one patch.
```

```quiz
The height map has mipmaps, yet the evaluation (domain) shader reads only level 0. Why?
- [ ] Because a one-channel texture can't have mipmaps
- [ ] Because the tessellator clamps every coordinate to the edge
- [x] Because the evaluation stage runs before rasterisation: there are no screen-space derivatives to choose a mip level from
- [ ] Because mipmaps are generated only for the fragment shader's textures
---
That is why the Vulkan and Direct3D 12 versions create the height map with one level and read it with an explicit level (`SampleLevel(…, 0)`).
```

```quiz
What is the difference between `glGenBuffers` and `glCreateBuffers`?
- [x] `glGenBuffers` only reserves names – the object is created when a name is first bound, which also fixes its type; `glCreateBuffers` creates the objects at once, so they can be edited by name without ever being bound
- [ ] `glCreateBuffers` also allocates the buffer's memory
- [ ] `glGenBuffers` is for vertex buffers, `glCreateBuffers` for every other kind
- [ ] There is none; `glCreateBuffers` is just the newer name
---
That is also why `glCreateTextures` takes the target as a parameter: the texture's type must be known when it is created.
```

```quiz
A buffer was created with `glNamedBufferStorage(VBO, size, data, 0)`. What does the last argument promise, and what happens if the program later calls `glNamedBufferStorage` on the same buffer again?
- [ ] 0 means "use the default usage hint"; the second call reallocates the buffer
- [ ] 0 means the GPU never reads the buffer; the second call is ignored
- [x] 0 means the contents are never changed from the CPU after creation; the storage is immutable, so the second call is an error
- [ ] 0 means the buffer can be mapped; the second call resizes it
---
`GL_DYNAMIC_STORAGE_BIT` would allow `glNamedBufferSubData`, the map bits mapping. A fixed size and flags stated up front let the driver know where the memory lives – the step towards the explicit APIs.
```

```quiz
The physically based bloom ends with `hdrColor = mix(hdrColor, bloomColor, 0.04)` instead of the old `hdrColor += bloomColor`. What changes?
- [ ] Only the brightness: `mix` is `+=` scaled by 0.04
- [ ] Only pixels brighter than 1.0 get bloom
- [ ] The bloom replaces the scene where it is brighter
- [x] There is no threshold and no light is added: 4 % of every pixel's light is taken from it and spread around it, as a lens scatters part of the light passing through it
---
Bright things glow because 4 % of a lot of light is still a lot; a dimly lit wall's glow is too faint to see.
```

```quiz
What does the Karis average in the first downsample protect against?
- [ ] Banding in the R11G11B10 levels
- [x] Fireflies: a single extremely bright pixel dominating its box and jumping between texels as the camera moves – each box is weighted by `1 / (1 + luma)`
- [ ] Light leaking across the edge of the texture
- [ ] Overflow of the additive upsample blending
---
It is only needed in the first downsample, where single pixels are still single pixels; after that the image is smooth enough.
```

```quiz
A compute shader has `local_size_x = 10, local_size_y = 10`. Which texel does the invocation with the local ID (3, 4) in the work group (2, 1) write, if it writes `gl_GlobalInvocationID.xy` (`SV_DispatchThreadID.xy`)?
- [ ] (5, 5)
- [ ] (3, 4)
- [x] (23, 14)
- [ ] (32, 41)
---
Global ID = group ID × group size + local ID: (2 · 10 + 3, 1 · 10 + 4). The dispatch of 80 × 60 groups covers the 800 × 600 texture with one invocation per texel.
```

```quiz
The program dispatches the compute shader that writes the texture and then draws the quad that samples it. Why does it need a barrier between the two?
- [ ] Because a compute shader may only run when no render pass is active
- [ ] Because the barrier converts the texture's format from 32-bit floats to 8 bits
- [ ] Because the dispatch has to finish on the CPU before the draw is recorded
- [x] Because the GPU runs work asynchronously and caches writes: without it the quad's fragment shader may read the texture before or while the compute shader writes it
---
In the graphics pipeline the API works most such dependencies out; writes from a compute shader to an image are not covered, so the program must state them.
```

```quiz
What is the idea of linearly transformed cosines?
- [ ] Sampling the GGX lobe with many rays per pixel, weighted by a cosine
- [ ] Replacing the polygonal light by a point light at its centre
- [x] Integrating the GGX-like distribution over the polygon equals integrating a clamped cosine over the polygon transformed by M⁻¹ – which has an exact edge formula
- [ ] Blurring the light's shape in a texture by the roughness
---
The matrices were fitted in advance for a grid of roughness and view angles (LTC1); LTC2 holds the BRDF's magnitude with the Fresnel terms and the horizon-clipped sphere.
```

```quiz
Why does the diffuse part of the area light need no lookup in LTC1?
- [ ] Because the diffuse part is computed on the CPU
- [x] Because Lambert's diffuse reflection is the clamped cosine itself: M⁻¹ is the identity
- [ ] Because the diffuse part uses LTC2.w only
- [ ] Because a two-sided light has no diffuse part
---
Only the glossy part needs the fitted M⁻¹ for its roughness and view angle; the result is `color · intensity · (specular + mDiffuse · diffuse)`.
```

:::opengl
```quiz
The transparent pass of weighted blended OIT renders into two colour attachments with different blend functions. Which OpenGL calls set them and clear each target to its own value?
- [x] `glBlendFunci(0, …)` and `glBlendFunci(1, …)` (core since 4.0), and `glClearBufferfv(GL_COLOR, i, value)` per draw buffer
- [ ] `glBlendFunc` twice, the second call for attachment 1
- [ ] `glBlendFuncSeparate`, which sets colour and alpha separately
- [ ] `glClear` with two `glClearColor` calls
---
`glBlendFuncSeparate` separates colour from alpha, not one target from another. `glClear` clears every draw buffer to the same `glClearColor`.
```
:::
:::vulkan
```quiz
The transparent pipeline of weighted blended OIT has two colour blend attachment states with different factors. What does Vulkan require for that?
- [x] The device feature `independentBlend`, checked in `isDeviceSuitable` and enabled when the device is created – without it all attachment states of a pipeline must be identical
- [ ] Two pipelines, one per attachment
- [ ] A separate subpass per colour attachment
- [ ] Nothing: every pipeline can blend each attachment differently
---
It is learnopengl's `glBlendFunci` in Vulkan terms. Almost every desktop GPU has the feature, but the program must ask for it.
```
:::
:::d3d12
```quiz
The transparent pipeline state of weighted blended OIT sets different blend functions in `BlendState.RenderTarget[0]` and `[1]`. What else does it need?
- [x] `BlendState.IndependentBlendEnable = TRUE` – without it Direct3D uses `RenderTarget[0]` for every target
- [ ] A second pipeline state for the second target
- [ ] A root parameter per render target
- [ ] Nothing: each entry always applies to its own target
---
It is learnopengl's `glBlendFunci` in Direct3D terms. The pixel shader writes the two targets through a struct with `SV_TARGET0` and `SV_TARGET1`.
```
:::

:::opengl
```quiz
The bone ids are set up with `glVertexAttribIPointer(3, 4, GL_INT, …)`. What would go wrong with `glVertexAttribPointer(3, 4, GL_INT, GL_FALSE, …)` and an `ivec4` in the shader?
- [ ] Nothing: both functions pass integers through
- [ ] The weights would be read as ids
- [x] `glVertexAttribPointer` converts the data to floats on the way, so the shader's integer input wouldn't receive the ids
- [ ] The ids would be normalised to 0..1
---
Integer attributes need the **I** variant; the weights, which are floats, use the ordinary `glVertexAttribPointer` at location 4.
```
:::
:::vulkan
```quiz
How does Vulkan deliver the bone ids to the vertex shader's `ivec4` input at location 3?
- [ ] With `VK_FORMAT_R32G32B32A32_SFLOAT` and a cast in the shader
- [ ] Through the uniform buffer, next to the bone matrices
- [x] With the attribute format `VK_FORMAT_R32G32B32A32_SINT` – a signed integer format; a float or normalised format would deliver floats
- [ ] With a push constant per vertex
---
It is Vulkan's counterpart of OpenGL's `glVertexAttribIPointer`; the weights use `VK_FORMAT_R32G32B32A32_SFLOAT` at location 4.
```
:::
:::d3d12
```quiz
learnopengl computes a bone's final matrix as `globalTransformation * offset` with GLM. How does the course write it with DirectXMath, and why?
- [ ] The same, `globalTransformation * offset`: matrix products don't depend on the library
- [ ] `XMMatrixInverse(nullptr, offset) * globalTransformation`, because DirectXMath stores inverses
- [x] `offset * globalTransformation`, because DirectXMath multiplies row vectors from the left, so transforms are written in the order they apply – the offset first
- [ ] `globalTransformation * XMMatrixTranspose(offset)`, because HLSL transposes matrices
---
For the same reason a node's global transform is `nodeTransform * parentTransform`. The resulting matrices are GLM's, transposed.
```
:::

:::opengl
```quiz
The depth pass of cascaded shadow mapping has a geometry shader with `layout (triangles, invocations = 5) in;` and sets `gl_Layer = gl_InvocationID`. What does that do?
- [ ] It draws the scene five times from the CPU
- [x] The geometry shader runs five times per triangle, each invocation transforming it with its cascade's light-space matrix and sending it to the layer of the same number of the layered framebuffer
- [ ] It splits each triangle into five smaller ones
- [ ] It selects one of five shadow maps at random
---
Geometry shader instancing is core since OpenGL 4.0; the framebuffer is layered because `glFramebufferTexture` attached the whole texture array.
```
:::
:::vulkan
```quiz
learnopengl's `getFrustumCornersWorldSpace` uses `2.0f * z - 1.0f` for the corners' z. Why does the Vulkan version use `z` (0 or 1) instead?
- [ ] Because Vulkan's y axis points down
- [ ] Because the light's projection is orthographic
- [ ] Because Vulkan's texture arrays start at layer 1
- [x] Because with `GLM_FORCE_DEPTH_ZERO_TO_ONE` Vulkan's NDC depth runs from 0 to 1; z = −1 would lie in front of the near plane, and every cascade's box would grow
---
The four x, y corners are the same in every API; only the depth range of normalized device coordinates differs.
```
:::
:::d3d12
```quiz
The depth pass's geometry shader has `[instance(5)]` and writes `SV_RenderTargetArrayIndex`. What do they do?
- [ ] They draw five instances of every cube
- [ ] They pick the cascade a pixel belongs to
- [ ] They make the pixel shader run five times per pixel
- [x] The geometry shader runs five times per triangle (`SV_GSInstanceID` 0 to 4), and each invocation sends its transformed triangle to that slice of the depth texture array
---
They are GLSL's `invocations = 5`, `gl_InvocationID` and `gl_Layer`. The DSV covers all five slices of the array, so one draw fills all cascades.
```
:::

:::opengl
```quiz
OpenGL can draw tessellated patches without a tessellation control shader. Where do the levels come from then?
- [ ] From `GL_MAX_TESS_GEN_LEVEL`: every patch is cut as finely as possible
- [x] From the default levels set with `glPatchParameterfv(GL_PATCH_DEFAULT_OUTER_LEVEL, …)` and `GL_PATCH_DEFAULT_INNER_LEVEL`
- [ ] From the evaluation shader's `layout` line
- [ ] Nowhere: the program fails to link
---
Vulkan and Direct3D 12 have no such defaults and always need the control (hull) stage – which is why the course keeps it in every API and every state.
```
:::
:::vulkan
```quiz
What does a Vulkan graphics pipeline with tessellation need?
- [ ] Only the evaluation shader; the control shader is optional, as in OpenGL
- [x] The `tessellationShader` device feature, both a control and an evaluation shader, the topology `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` and a tessellation state with `patchControlPoints`
- [ ] A separate render pass for the tessellated geometry
- [ ] Only `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST`; the patch size is taken from the draw call
---
That is why the start's control shader writes level 1 everywhere: without it the pipeline couldn't have been built.
```
:::
:::d3d12
```quiz
OpenGL's control shader writes the levels in `if (gl_InvocationID == 0)`. Where does Direct3D 12 compute them?
- [ ] In the domain shader, once per generated point
- [ ] In the hull shader's main function, once per control point
- [x] In the hull shader's patch constant function, which runs once per patch and returns `SV_TessFactor[4]` and `SV_InsideTessFactor[2]`
- [ ] In the root signature, as root constants
---
The hull shader's main function runs per output control point (`SV_OutputControlPointID`) and passes the points through; its attributes declare the domain, partitioning and output topology.
```
:::

:::opengl
```quiz
How does the compute shader write to the texture that the screen quad samples on texture unit 0?
- [ ] Through texture unit 0 as well, with `texture()` and a write mask
- [ ] By rendering into it with a framebuffer
- [ ] Through a shader storage buffer that is copied into the texture
- [x] Through image unit 0, bound with `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F)` – image units are separate from texture units, and the format must be a sized one matching the shader's
---
`imageStore` writes by integer coordinates, without sampler, filtering or mipmaps; the same texture stays bound on texture unit 0 for the quad.
```
:::
:::vulkan
```quiz
In which image layout does the program keep the texture that the compute shader writes and the quad samples, and why?
- [ ] `SHADER_READ_ONLY_OPTIMAL`, because the quad samples it
- [ ] `COLOR_ATTACHMENT_OPTIMAL`, because the compute shader writes it
- [ ] `TRANSFER_DST_OPTIMAL`, because it is filled from the GPU
- [x] `GENERAL`, the layout in which a shader may both store to an image and sample it – used by the storage image descriptor and the quad's combined image sampler
---
The image memory barrier between the dispatch and the render pass keeps the layout and orders the compute writes before the fragment shader's reads.
```
:::
:::d3d12
```quiz
How does the compute shader write the texture, and what makes the pixel shader wait for it?
- [ ] A render target view and a `ClearRenderTargetView` between the passes
- [ ] A second SRV with write access; the fence of the next frame
- [ ] A copy queue that copies the result into the texture
- [x] An unordered access view (`RWTexture2D<float4>`, u0) on a texture created with `ALLOW_UNORDERED_ACCESS`, and a transition barrier from `UNORDERED_ACCESS` to `PIXEL_SHADER_RESOURCE` before the quad
---
At the end of the frame a second barrier turns the texture back for the next dispatch. Two compute passes on the same UAV would use a UAV barrier instead.
```
:::

:::opengl
```quiz
With DSA, `glVertexAttribPointer` is replaced by three calls. Which one says where the data comes from?
- [ ] `glVertexArrayAttribFormat`
- [ ] `glVertexArrayAttribBinding`
- [x] `glVertexArrayVertexBuffer`, which feeds a binding point from a buffer at an offset with a stride
- [ ] `glEnableVertexArrayAttrib`
---
`glVertexArrayAttribFormat` describes the attribute (components, type, offset within a vertex), `glVertexArrayAttribBinding` connects it to a binding point. The format stays when the buffer changes.
```
:::
:::vulkan
```quiz
DSA splits OpenGL's vertex setup into an attribute's format and the buffer that feeds it. Where does Vulkan keep these two?
- [ ] Both in a vertex array object
- [ ] Both in the descriptor set
- [x] The format in the pipeline (`VkVertexInputAttributeDescription` and `VkVertexInputBindingDescription`), the buffers bound per draw with `vkCmdBindVertexBuffers`
- [ ] The format in the vertex buffer, the buffer in the render pass
---
Vulkan has no VAO and never had bind to edit: every call names the objects it works on – the model DSA moves OpenGL towards.
```
:::
:::d3d12
```quiz
DSA splits OpenGL's vertex setup into an attribute's format and the buffer that feeds it. Where does Direct3D 12 keep these two?
- [ ] Both in a vertex array object
- [ ] Both in the root signature
- [x] The format in the pipeline state's input layout, the buffers bound per draw with `IASetVertexBuffers` and views that carry the stride
- [ ] The format in the vertex buffer view, the buffer in the input layout
---
Direct3D 12 has no VAO and never had bind to edit: every call names the object it works on – the model DSA moves OpenGL towards.
```
:::

:::opengl
```quiz
The eight area lights are set as `areaLights[i].points[k]`, `areaLights[i].color` and so on. Why does the OpenGL program need no thought about the struct's memory layout?
- [ ] Because OpenGL packs structs without padding
- [x] Because each member of each array element is a uniform of its own with its own location, set by name – there is no buffer whose layout the C++ side must match
- [ ] Because the lights are stored in a texture
- [ ] Because GLSL has no `bool` type
---
The explicit APIs put the lights into a uniform or constant buffer, where std140 or HLSL's packing rules decide the offsets and the C++ mirror must match them.
```
:::
:::vulkan
```quiz
In the std140 uniform block, a light is `{ float intensity; vec3 color; vec4 points[4]; bool twoSided; }`. Why is it 112 bytes?
- [ ] Because std140 stores every member as a `mat4`
- [ ] Because a `bool` takes 16 bytes
- [x] `color` is aligned like a `vec4` and starts at 16, the four corners take 16 bytes each from 32, `twoSided` takes 4 bytes at 96, and the struct rounds up to a multiple of 16
- [ ] Because the array of 32 lights is divided evenly
---
The C++ mirror spells the padding out so that its offsets match the shader's. The corners are `vec4` in the shader because every array element starts on a 16-byte boundary anyway.
```
:::
:::d3d12
```quiz
In the HLSL constant buffer, a light is `{ float intensity; float3 color; float4 points[4]; bool twoSided; }`. Why is it 96 bytes?
- [ ] Because HLSL stores every member as a `float4x4`
- [ ] Because a `bool` takes 16 bytes
- [x] `intensity` and `color` share the first 16-byte row, the four corners take a row each, `twoSided` starts the last row, and a struct in a cbuffer array fills whole rows
- [ ] Because the array of 32 lights is divided evenly
---
A `float3` may follow a `float` as long as it doesn't cross a row boundary – which std140 doesn't allow, so Vulkan's version of the same struct takes 112 bytes.
```
:::
