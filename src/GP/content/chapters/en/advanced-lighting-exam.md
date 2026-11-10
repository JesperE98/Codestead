# Exam: Advanced Lighting

Show what you've learned in *Advanced Lighting*: Blinn-Phong, gamma correction, shadow maps for directional and point
lights, normal and parallax mapping, HDR and tone mapping, bloom, deferred shading and SSAO. The questions cover the
whole part, some of them for {{api}} in particular. Answer all of them and press **Submit answers**; you need 80 % right
to pass, and you can take the exam again.

```quiz
You switch the floor's specular term from Phong to Blinn-Phong and keep the shininess exponent 8. What do you see, and what does learnopengl do about it?
- [ ] The highlight disappears, because the halfway vector is perpendicular to the normal; the exponent is lowered to 1
- [x] The highlight gets wider and brighter, because the angle between N and H is smaller than the one between R and V; the exponent is raised 2–4 times – learnopengl uses 32
- [ ] Nothing changes: both models give the same highlight for the same exponent
- [ ] The highlight gets a hard edge where the angle passes 90°; the exponent is lowered to 2
---
For a flat surface the angle between the normal and the halfway vector is about half the angle between the reflection and the view vector, so its cosine is closer to 1. A higher exponent brings the highlight back to about Phong's size – without Phong's cut-off.
```

```quiz
A renderer gamma-corrects its output. Which of these textures should be read with an sRGB format? (Several answers are right.)
- [x] `wood.png`, the floor's colour texture
- [ ] `bricks2_normal.png`, a normal map
- [ ] `bricks2_disp.png`, a depth map for parallax mapping
- [x] `container2.png`, the containers' colour texture
---
Only images of colours, made by looking at a monitor, are sRGB-encoded; an sRGB format decodes them to linear colours when they are sampled. Normal, depth, specular and shadow maps store data for the maths and must be read as they are. (The normal mapping, parallax mapping and deferred shading projects don't gamma-correct their output, like learnopengl's – there even colour textures are read linear.)
```

:::opengl
```quiz
In the shadow mapping project, what lets pass 2 sample the depths that pass 1 wrote?
- [ ] The window's depth buffer, which `glBindFramebuffer(GL_FRAMEBUFFER, 0)` makes readable as a texture
- [ ] A depth renderbuffer in `depthMapFBO`, read back with `glReadPixels` every frame
- [x] `depthMap` is a texture (`GL_DEPTH_COMPONENT`) attached as the framebuffer's `GL_DEPTH_ATTACHMENT`; after pass 1 it is bound to texture unit 1 and sampled as `shadowMap`
- [ ] `glBlitFramebuffer` copies the depths into the colour buffer of the window
---
Rendering into a texture and sampling it in a later draw is all OpenGL needs; the driver makes the later draw wait for the writes. A renderbuffer can't be sampled, which is why the depth map is a texture.
```
:::
:::vulkan
```quiz
In the shadow mapping project, what lets the window's pass sample the depths that the depth pass wrote?
- [x] The image has the usage `SAMPLED` besides `DEPTH_STENCIL_ATTACHMENT`; the depth pass stores it (`storeOp = STORE`) and leaves it in `DEPTH_STENCIL_READ_ONLY_OPTIMAL`, and a subpass dependency makes the fragment shaders wait for the depth writes
- [ ] `vkQueueWaitIdle` between the two render passes of the command buffer
- [ ] Nothing: commands in one command buffer always run strictly one after the other
- [ ] The depth attachment's `storeOp = DONT_CARE`, like the window's depth buffer, and a copy into a sampled image
---
The image must be allowed to be sampled, its depths must be kept instead of discarded, it must be in a layout a shader can read, and the reads must be ordered after the writes. The descriptor names the same layout.
```
:::
:::d3d12
```quiz
In the shadow mapping project, what lets the scene's pixel shader sample the depths that the depth pass wrote?
- [ ] A `DXGI_FORMAT_D32_FLOAT` texture with a `D32_FLOAT` SRV – no other views needed
- [ ] Nothing: the commands of one command list always run strictly one after the other
- [ ] Copying the shadow map into an upload heap before the scene is drawn
- [x] An `R32_TYPELESS` texture with a `D32_FLOAT` DSV and an `R32_FLOAT` SRV, and a transition barrier from `DEPTH_WRITE` to `PIXEL_SHADER_RESOURCE` after the depth pass
---
A resource with a depth format can't have a shader resource view, so it is typeless and each view picks its interpretation. The barrier changes the resource's role and makes the reads wait for the writes; at the end of the frame a second barrier turns it back.
```
:::

:::opengl
```quiz
In `ShadowCalculation`, `projCoords` is the light-space position after the perspective divide. Which line turns it into what the lookup and the comparison need in OpenGL?
- [x] `projCoords = projCoords * 0.5 + 0.5;`
- [ ] `projCoords.xy = projCoords.xy * 0.5 + 0.5;`
- [ ] `vec2 uv = vec2(projCoords.x * 0.5 + 0.5, -projCoords.y * 0.5 + 0.5);` with z as it is
- [ ] None: the divided coordinates are already texture coordinates and depths
---
OpenGL's NDC is -1..1 in x, y and z, while the texture coordinates and the stored depths are 0..1 – all three are mapped. The texture's v = 0 is its bottom row, like NDC y = -1, so there is no flip.
```
:::
:::vulkan
```quiz
In `ShadowCalculation`, `projCoords` is the light-space position after the perspective divide. Which line turns it into what the lookup and the comparison need in Vulkan?
- [ ] `projCoords = projCoords * 0.5 + 0.5;`
- [x] `projCoords.xy = projCoords.xy * 0.5 + 0.5;`
- [ ] `vec2 uv = vec2(projCoords.x * 0.5 + 0.5, -projCoords.y * 0.5 + 0.5);` with z as it is
- [ ] None: the divided coordinates are already texture coordinates and depths
---
With `GLM_FORCE_DEPTH_ZERO_TO_ONE` NDC z is 0..1 already, the range the depth image stores. And because the light's matrix has no y flip, NDC y = -1 is row 0 both when the depth pass writes and when the lookup reads.
```
:::
:::d3d12
```quiz
In `ShadowCalculation`, `projCoords` is the light-space position after the perspective divide. Which line turns it into what the lookup and the comparison need in Direct3D 12?
- [ ] `projCoords = projCoords * 0.5f + 0.5f;`
- [ ] `projCoords.xy = projCoords.xy * 0.5f + 0.5f;`
- [x] `float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);` with z as it is
- [ ] None: the divided coordinates are already texture coordinates and depths
---
Direct3D's NDC z is 0..1 already, like the depths in the shadow map. Its texture v = 0 is the top row of a render target, which is NDC y = +1, so y is flipped.
```
:::

```quiz
The shadow bias is changed from `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)` to a fixed 0.2. What do you expect?
- [ ] More shadow acne: the stripes come back on the floor
- [ ] Soft shadow edges, as with PCF
- [ ] Everything outside the light's frustum turns dark
- [x] Peter panning: the comparison is moved so far towards the light that shadows start a visible distance away from the objects casting them
---
A bias only has to cover the depth differences within one depth map texel. A much larger one makes the parts of a shadow close to its caster count as lit, so objects seem detached from their shadows.
```

```quiz
Which statement about PCF, as used in both shadow chapters, is right?
- [x] It compares the fragment's depth with the depths stored at several neighbouring positions and averages the results (lit or in shadow), so edge fragments get in-between values
- [ ] It blurs the depth map before the comparison, so the stored depths become smoother
- [ ] It raises the resolution of the depth map by sampling it with linear filtering
- [ ] It moves the shadow towards the light by the size of one texel
---
Averaging depths would give nonsense at the edge of an object, where a near and a far depth meet. PCF averages the binary test results: where 3 of 9 samples are in shadow, the fragment is a third in shadow.
```

```quiz
Shadow mapping's bias is between 0.005 and 0.05; the point shadows use 0.05, and 0.15 with PCF. Why can the point-shadow bias be so much larger?
- [ ] Cube maps have more shadow acne than 2D depth maps
- [ ] The perspective projection makes the stored depth non-linear, so the bias must be large near the far plane
- [x] The comparison is between distances in world units – the stored value times `far_plane` (25) and `length(fragToLight)` – not between 0..1 depths; 0.05 is a twentieth of a unit
- [ ] The bias of the point shadows is applied to the light's position, not to the depth
---
The directional light's depth runs from 0 to 1 over 6.5 units, so 0.005 there is about 0.03 units. In world units both biases are of a similar size; PCF's offsets read slightly different directions, which needs a little more.
```

:::opengl
```quiz
What lets one draw call of the depth pass fill all six faces of `depthCubemap`?
- [ ] `glFramebufferTexture2D` with `GL_TEXTURE_CUBE_MAP_POSITIVE_X`, which attaches the faces that follow it as well
- [x] `glFramebufferTexture` attaches the whole cube map as a layered attachment, and the geometry shader emits each triangle six times, setting `gl_Layer` to the face
- [ ] Six viewports, one per face, set with `glViewport` before the draw
- [ ] The vertex shader writes `gl_Layer`, once per vertex
---
With a layered attachment the geometry shader chooses the layer – the face – of every primitive it emits, each time transformed with that face's matrix. Without it, the scene would be rendered six times, once per attached face.
```
:::
:::vulkan
```quiz
What lets one draw of the depth pass fill all six faces of the depth cube map?
- [ ] Six framebuffers, one per layer, and six render passes recorded one after the other
- [ ] A view of type `VK_IMAGE_VIEW_TYPE_2D` and the push constant `face`
- [ ] The vertex shader writes `gl_Layer`, once per vertex
- [x] A six-layer, cube-compatible image whose view is the attachment of a framebuffer with `layers = 6`, and a geometry shader (an enabled device feature) that emits each triangle six times with `gl_Layer` set to the face
---
The framebuffer sees six layers; the geometry shader picks one per primitive. The same cube view is then sampled as a `samplerCube` in the window's pass.
```
:::
:::d3d12
```quiz
What lets one draw of the depth pass fill all six slices of the depth cube map?
- [x] A depth stencil view of type `TEXTURE2DARRAY` over the six slices, and a geometry shader that appends each triangle six times with `SV_RenderTargetArrayIndex` set to the face
- [ ] Six DSVs bound at once with `OMSetRenderTargets(6, …)`
- [ ] A `TEXTURECUBE` depth stencil view, which the rasterizer fills face by face
- [ ] The vertex shader returns `SV_RenderTargetArrayIndex`, once per vertex
---
The array DSV makes the six slices a layered depth buffer, and `SV_RenderTargetArrayIndex` – GLSL's `gl_Layer` – selects the slice of each primitive. The `TEXTURECUBE` view is the SRV that reads the same slices as a cube.
```
:::

```quiz
A floor faces +y, its tangent is +x, and the normal map holds (0.5, 0.5, 1.0) at a fragment. Which normal does tangent-space normal mapping light the fragment with?
- [ ] (0.5, 0.5, 1.0) normalized, in world space
- [x] (0, 0, 1) in tangent space, which the TBN matrix turns into the floor's own normal (0, 1, 0): a flat spot
- [ ] (0, 0, 1) in world space, pointing along the floor
- [ ] (0, 1, 0) in tangent space: up the texture
---
`texel * 2.0 - 1.0` gives (0, 0, 1), the "straight out of the surface" normal of tangent space. Used as a world-space normal – the chapter's first attempt – it would point along +z, at right angles to the floor's real normal.
```

```quiz
learnopengl's vertex shader transforms the light, view and fragment positions with `transpose(mat3(T, B, N))`. Why may it use the transpose instead of the inverse, and what keeps that true on a mesh with averaged tangents?
- [ ] Any 3 × 3 matrix's transpose is its inverse; nothing more is needed
- [ ] The transpose is only an approximation that looks the same at a distance
- [ ] Because T and B have a length of 2; normalizing them in the fragment shader corrects it
- [x] T, B and N are perpendicular unit vectors, so the matrix is orthogonal and its transpose is its inverse; Gram-Schmidt (`T = normalize(T - dot(T, N) * N)`, `B = cross(N, T)`) makes them perpendicular again where averaging has bent them
---
Smoothing tangents over shared vertices can leave T no longer perpendicular to N. Removing T's component along N restores an orthogonal TBN matrix, and the cheap transpose stays exact.
```

:::opengl
```quiz
learnopengl's quad gets the bitangent (0, 2, 0) – up the wall – because its images are flipped on load and v grows up the image. If v grew down the image instead, so that the bitangent pointed down the wall, what would the bricks' bumps need?
- [ ] Nothing: the normal is normalized anyway
- [ ] Loading the normal map as an sRGB texture
- [x] The normal map's y (green) flipped – or a normal map made for that convention – because green means "up the image" in this map
- [ ] A negated tangent, so that T and B swap places
---
Tangent space's y axis is the bitangent, the direction in which v grows. The normal map's green must mean the same direction, or every bevel is lit from the opposite side – exactly what Direct3D's version has to handle.
```
:::
:::vulkan
```quiz
The Normal and Parallax Mapping projects flip the images on load and keep learnopengl's texture coordinates. What would happen with the earlier Vulkan chapters' approach – rows as stored, v flipped in the vertex data?
- [x] The bitangent, computed from v, would point down the wall while the normal map's green means up the image: every bump would be lit from the wrong side
- [ ] Nothing: tangent space doesn't depend on the texture coordinates
- [ ] The picture would be upside down because of `proj[1][1] *= -1`
- [ ] The normal map would be decoded as sRGB
---
With the flip on load, v grows up the image, the bitangent points up the wall, and tangent space's +y means what the map's green means – as in learnopengl.
```
:::
:::d3d12
```quiz
After Gram-Schmidt, the Direct3D shaders compute `B = cross(T, N)` instead of learnopengl's `cross(N, T)`. Why?
- [ ] HLSL's `cross` takes its arguments in the opposite order to GLSL's
- [x] With Direct3D's texture coordinates v grows down the image, so the bitangent must point down the wall, as the bitangent attribute did – `cross(T, N)` = (0, -1, 0); with `cross(N, T)` the `normal.y = -normal.y` flip would be wrong
- [ ] Because `float3x3(T, B, N)` takes rows, which reverses the cross product
- [ ] Because the window's y points down in Direct3D
---
Tangent space's y has to follow the texture's v. The OpenGL-style normal map's green means up the image, so its y is flipped, and B must point the way v grows: down.
```
:::

```quiz
Parallax mapping shifts the texture coordinates by `viewDir.xy / viewDir.z * (height * heightScale)`. Why must the view direction be in tangent space for this?
- [x] In tangent space x and y run along the texture's u and v and z along the normal, so `viewDir.xy` is a direction in texture coordinates and `viewDir.z` says how flat the view is
- [ ] Because the depth map can only be sampled in tangent space
- [ ] Because tangent space has its origin at the camera
- [ ] It needn't be: world space gives the same offset on every surface
---
The shift has to happen along the texture's axes, whatever the surface's orientation in the world. That's why the vertex shader of normal mapping, which already brings the view position into tangent space, is reused as it is.
```

```quiz
At the start of the HDR chapter, the tunnel's far end is flat white. Which changes, together, bring back its boards? (Several answers are right.)
- [x] A floating point colour buffer, which keeps the values above 1.0 while the scene is drawn
- [ ] Reading the wood as an sRGB texture
- [x] Tone mapping in the screen quad's shader, which maps those values back into 0..1 before they go into the window
- [ ] Turning off the gamma correction
---
The first task alone changes nothing you can see: the floating point buffer holds the true colours, but the 8-bit window clamps them as before. Only the tone mapping curve brings them into the window's range without collapsing them into one white.
```

:::opengl
```quiz
The scene now draws into a floating point colour buffer instead of the window. Besides creating that buffer, what has to know its format?
- [ ] The shader program, which has to be linked again for `GL_RGBA16F`
- [ ] `glDrawBuffers`, which takes `GL_RGBA16F` as its argument
- [ ] The fragment shader, whose output must be declared as `out vec4 FragColor : RGBA16F;`
- [x] Nothing else: the programs draw into whatever framebuffer is bound; the texture's internal format, `GL_RGBA16F`, is all that decides how its texels are stored
---
OpenGL's state and programs are independent of the target's format. Bind `hdrFBO` and the scene is stored as half floats; bind framebuffer 0 and the screen quad writes into the 8-bit window.
```
:::
:::vulkan
```quiz
The scene now draws into a floating point colour image instead of the swap chain image. Besides creating that image, what has to know its format?
- [ ] The vertex shader, through a specialization constant
- [ ] Nothing: a pipeline can draw into any render pass
- [x] The render pass (`hdrRenderPass`) and the scene's pipeline, which must be made for it – a pipeline only works in render passes compatible with its own; the screen quad's pipeline is made for the window's
- [ ] The descriptor set layout, which needs the format of every attachment
---
Compatible render passes have the same number and formats of attachments. The swap chain image is `VK_FORMAT_B8G8R8A8_UNORM`, the HDR image `VK_FORMAT_R16G16B16A16_SFLOAT`, so the scene's pipeline is created again with `hdrRenderPass`.
```
:::
:::d3d12
```quiz
The scene now draws into a floating point render target instead of the back buffer. Besides creating that texture and its views, what has to know its format?
- [ ] The root signature, which lists the formats of the render targets
- [x] The scene's PSO, `RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT` – and the screen quad gets a PSO of its own with the back buffer's format and no depth
- [ ] Nothing: `OMSetRenderTargets` converts the colours to whatever is bound
- [ ] The vertex buffer view
---
A PSO is compiled for the formats it renders into, and they must match the views bound when it draws. The root signature is shared by both PSOs.
```
:::

```quiz
In the Bloom project, where is the colour gamma-corrected?
- [ ] In the scene's lighting shader, so that the bright pass compares gamma-corrected values
- [ ] In every blur pass, after the weights are applied
- [x] Once, in the final pass, after the blurred bright parts have been added and the sum tone-mapped – everything before stays linear in floating point buffers
- [ ] Nowhere: the sRGB textures make it unnecessary
---
Lighting, blurring, adding and tone mapping all expect linear values; gamma correction is the last step before the window. sRGB textures only decode the input – the output still has to be encoded once.
```

```quiz
Why does bloom work best together with HDR?
- [ ] Bloom can only blur floating point textures
- [x] With HDR, "bright" has a natural meaning – a luminance above 1.0, more than the window can show – so the threshold picks the lights; with LDR it would have to be below 1.0, and every white wall would glow too
- [ ] HDR makes the Gaussian blur separable
- [ ] Without HDR the light cubes can't be drawn into a second colour buffer
---
They are different techniques, and bloom can be done with 8-bit buffers. But HDR keeps the true brightness, so a threshold of 1.0 and an addition before the tone mapping give a glow only where the light really is too bright to show.
```

```quiz
learnopengl's blur runs 10 passes with a 9-tap kernel, alternating horizontal and vertical. Which statement is right?
- [ ] 10 passes are needed because each pass can only move the light by one texel
- [ ] The vertical passes undo the horizontal ones, except for their brightness
- [ ] Each pass uses a different set of weights, from narrow to wide
- [x] Each horizontal-and-vertical pair is a full 9 × 9 Gaussian blur with 18 instead of 81 samples per fragment; the five pairs blur the blurred image again and again, which widens the glow
---
The Gaussian is separable, so a 1D pass along x followed by one along y gives the 2D result. Repeating the blur spreads the light further – at the cost of a full-screen pass each time.
```

:::opengl
```quiz
Each of the 10 blur passes reads the texture the pass before it wrote. What makes sure it reads the finished result?
- [x] Nothing explicit: binding the other ping-pong framebuffer and the texture just written is enough – OpenGL makes later draws see the results of earlier ones (as long as a pass never reads the texture it draws into)
- [ ] `glFinish()` between the passes
- [ ] `glDrawBuffers(2, …)` with both ping-pong textures
- [ ] Clearing the framebuffer before each pass
---
The driver tracks which textures are attached and read and orders the work for you. Reading and writing the same texture in one pass is the one thing it doesn't fix – hence the two buffers.
```
:::
:::vulkan
```quiz
Each of the 10 blur passes reads the image the pass before it wrote. What makes sure it reads the finished result?
- [ ] `vkQueueWaitIdle` after every blur pass
- [ ] Nothing: the commands of one command buffer always run strictly one after the other
- [ ] One render pass with ten subpasses that all write the same image
- [x] Every blur pass is a render pass of its own: it leaves its image in `SHADER_READ_ONLY_OPTIMAL`, and its subpass dependencies make the colour writes visible to the next pass's fragment shader (and the writes wait for the earlier reads)
---
An image can't be sampled while it is an attachment of the running pass, so the passes are separate render passes. The dependencies chain them, and the loop records all of them into the command buffer before the GPU runs it.
```
:::
:::d3d12
```quiz
Each of the 10 blur passes reads the texture the pass before it wrote. What makes sure it reads the finished result?
- [ ] `WaitForPreviousFrame()` after every pass
- [ ] Nothing: the commands of one command list always run strictly one after the other
- [x] A barrier pair around every pass: the target turns into `RENDER_TARGET` before the draw and back into `PIXEL_SHADER_RESOURCE` after it, which makes the next pass's reads wait for the writes
- [ ] Binding both ping-pong buffers with `OMSetRenderTargets(2, …)`
---
A resource's state must fit its use, and the transition also orders the GPU's work. The loop records all ten draws with their barriers into the command list.
```
:::

```quiz
The deferred-shading scene has nine boxes and 32 lights. What does deferred shading save compared with the start's forward rendering?
- [ ] It needs fewer lights for the same picture
- [ ] It doesn't need a depth test any more
- [x] The lighting runs once per visible pixel – at most 800 × 600 × 32 light calculations – however many boxes overlap there; fragments that are covered later were never lit, because the geometry pass only stores surface data
- [ ] Nothing: it is the same work in another order, only the picture is sharper
---
Forward rendering lights every fragment as it is drawn, including those hidden by later objects. Deferred shading separates the two: geometry first, then lighting from the G-buffer, so the lighting cost depends on pixels × lights.
```

:::opengl
```quiz
The geometry pass writes three outputs – position, normal, albedo + specular. What sends each output to its own G-buffer texture?
- [ ] Three framebuffers, bound one after the other for three draws of the scene
- [x] The three textures are attached to `GL_COLOR_ATTACHMENT0`, `1` and `2`, `glDrawBuffers(3, attachments)` lists them, and the shader declares the outputs with `layout (location = 0)`, `1` and `2`
- [ ] The names `gPosition`, `gNormal` and `gAlbedoSpec`, which OpenGL matches with the textures' uniforms
- [ ] `glActiveTexture` with units 0, 1 and 2 before the draw
---
Output location n goes to the n-th entry of the draw buffers list. Without `glDrawBuffers`, only `GL_COLOR_ATTACHMENT0` would be written.
```
:::
:::vulkan
```quiz
The geometry pass writes three outputs – position, normal, albedo + specular. What sends each output to its own G-buffer image?
- [x] The subpass has three colour attachment references – output location n writes `pColorAttachments[n]` –, the framebuffer has the views in the same order (depth at 3), and the geometry pipeline has three blend attachment states
- [ ] Three descriptor sets, one per image, bound at bindings 1 to 3
- [ ] The output names, which Vulkan matches with the images' names
- [ ] Three render passes recorded one after the other
---
The pipeline's `colorBlending.attachmentCount` must equal the subpass's colour attachment count – that's why `createPipeline` takes it (3 for the geometry pass, 1 for the window).
```
:::
:::d3d12
```quiz
The geometry pass writes three outputs – position, normal, albedo + specular. What sends each output to its own G-buffer texture?
- [ ] Three root parameters, one per render target
- [ ] The member names of the pixel shader's struct, matched with the textures' names
- [ ] Three PSOs, one per render target, drawn one after the other
- [x] The pixel shader returns a struct with `SV_TARGET0`, `1` and `2`, the PSO has `NumRenderTargets = 3` with the three formats, and `OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle)` binds the three RTVs
---
`SV_TARGETn` writes the n-th bound render target. Render target views are bound with `OMSetRenderTargets`, not through the root signature.
```
:::

```quiz
Why can't the semi-transparent windows of the *Blending* chapter simply go through the G-buffer?
- [x] A G-buffer pixel holds the data of one surface, but blending needs the surface behind it too – transparent objects are drawn forward after the lighting pass, like the light cubes
- [ ] The G-buffer has no alpha channel
- [ ] Transparent objects can't be depth-tested in a deferred renderer
- [ ] The lighting pass draws the screen quad with blending turned off
---
The lighting pass lights one position, normal and albedo per pixel. That's the main limit of deferred shading, together with MSAA, which doesn't simply work with a G-buffer either.
```

:::opengl
```quiz
The light cubes are drawn forward, after the lighting pass, and must be hidden behind the boxes. How do they get the boxes' depths?
- [ ] The lighting pass writes the depths from `gPosition` into the window's depth buffer
- [ ] They don't need them: the lighting quad's depth hides them correctly
- [ ] `gPosition` is attached to framebuffer 0 as its depth buffer
- [x] `glBlitFramebuffer(…, GL_DEPTH_BUFFER_BIT, GL_NEAREST)` copies the G-buffer's depth (`GL_READ_FRAMEBUFFER` gBuffer) into the window's depth buffer (`GL_DRAW_FRAMEBUFFER` 0); the two depth formats must match
---
The window's own depth buffer only holds the screen quad's flat depth. After the copy, the cubes are depth-tested against the boxes as if those had been drawn into the window.
```
:::
:::vulkan
```quiz
The light cubes are drawn forward, after the lighting pass, and must be hidden behind the boxes. How do they get the boxes' depths?
- [ ] `vkCmdBlitImage` copies the G-buffer's depth into the window's depth image every frame
- [x] The G-buffer's depth image is kept (`storeOp = STORE`) and is the window pass's depth attachment, loaded with `loadOp = LOAD`; the lighting quad's pipeline has depth test and writes off, so the quad neither hides nor overwrites it
- [ ] The light cubes' pipeline reads `gPosition` and discards hidden fragments
- [ ] They don't need them: the window's own depth image already holds the quad's depth
---
learnopengl copies the depth with `glBlitFramebuffer`; blitting depth images isn't supported on every Vulkan device, and a copy needs barriers. Sharing the image needs neither.
```
:::
:::d3d12
```quiz
The light cubes are drawn forward, after the lighting pass, and must be hidden behind the boxes. How do they get the boxes' depths?
- [ ] `CopyResource` from the G-buffer's depth into the back buffer's own depth buffer every frame
- [ ] The light cubes' pixel shader reads `gPosition` and discards hidden pixels
- [x] No copy: a depth buffer belongs to no framebuffer, so `m_depthStencil`, which still holds the boxes' depths, is bound again together with the back buffer's RTV; the lighting quad itself is drawn without a DSV
- [ ] They don't need them: the back buffer stores depth in its alpha channel
---
`OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)` combines any render target with any depth buffer of the same size. learnopengl's blit exists because OpenGL's window owns its depth buffer.
```
:::

```quiz
The lighting shader skips a light where the fragment is farther away than the light's radius. Why does that barely save time on a GPU, and what do real renderers do instead?
- [ ] It saves exactly 32 times the work; nothing more is needed
- [x] The fragments of a group run in lockstep, so the loop still costs a light wherever one fragment of the group needs it; real renderers draw each light's volume (a sphere of its radius) and light only the pixels it covers, or sort the lights into tiles or clusters of the screen
- [ ] The radius is computed on the GPU for every fragment, which costs more than it saves
- [ ] The GPU computes both sides of every `if`, so it saves nothing but makes the picture darker
---
The radius is where the light's brightness drops below 5/256. Skipping it per fragment changes the picture a little (32 small contributions add up) without saving much; light volumes and tiled or clustered shading avoid running the lighting for far-away lights at all.
```

```quiz
The blurred SSAO value multiplies which part of the lighting?
- [ ] The whole colour of the fragment
- [ ] The diffuse term of the light
- [ ] The light's colour, before attenuation
- [x] Only the ambient term – `0.3 * Diffuse * AmbientOcclusion`: AO estimates how much indirect light reaches a crease; the direct light keeps its own diffuse and specular
---
Ambient light stands for light that bounces around the scene, which creases and contact points receive less of. Blocking the direct light is the job of shadows.
```

```quiz
Why does SSAO rotate its kernel with random vectors from a 4 × 4 noise texture, and blur the result afterwards?
- [ ] The rotation makes the samples point away from the normal; the blur brings them back
- [ ] The noise texture stores the occlusion of 16 pixels; the blur spreads it over the window
- [x] With only 32 samples, the same kernel everywhere would leave visible bands; a different rotation for each pixel of a 4 × 4 block turns them into a fine, regular noise pattern, and a 4 × 4 blur averages it away
- [ ] The blur hides the edges of the noise texture, which is clamped to the edge
---
Rotating the kernel gives neighbouring pixels different sample directions, so few samples cover many. Because the noise repeats every 4 pixels, a 4 × 4 box blur covers exactly one period and removes it.
```

:::opengl
```quiz
The 4 × 4 noise texture must be tiled over the whole window, a random vector per pixel. How is it set up?
- [x] `GL_RGBA32F`, 4 × 4, from `GL_RGB` / `GL_FLOAT` data, with `GL_NEAREST` and `GL_REPEAT`, sampled at `TexCoords * noiseScale` (800/4, 600/4)
- [ ] An 800 × 600 texture of random vectors with `GL_CLAMP_TO_EDGE`
- [ ] 4 × 4 with `GL_LINEAR` filtering, so neighbouring pixels get smoothly varying vectors
- [ ] `GL_RED`, 4 × 4, with `GL_REPEAT` – one random angle per texel
---
`noiseScale` makes the texture repeat 200 × 150 times; `GL_REPEAT` wraps the coordinates and `GL_NEAREST` gives each pixel exactly one of the 16 vectors.
```
:::
:::vulkan
```quiz
The 4 × 4 noise texture must be tiled over the whole window, a random vector per pixel. How is it set up?
- [ ] An 800 × 600 image of random vectors with `CLAMP_TO_EDGE`
- [ ] `VK_FORMAT_R32G32B32_SFLOAT` with `glm::vec3` noise, like learnopengl's, and a LINEAR sampler
- [x] `VK_FORMAT_R32G32B32A32_SFLOAT` with `vec4` noise (devices need not sample three-channel float images), uploaded through a staging buffer, read with a NEAREST, REPEAT sampler at `fragTexCoord * noiseScale`
- [ ] `VK_FORMAT_R8_UNORM`, 4 × 4, with a REPEAT sampler – one random angle per texel
---
`noiseScale` (800/4, 600/4) makes the texture repeat over the window; REPEAT wraps the coordinates and NEAREST gives each pixel exactly one of the 16 vectors.
```
:::
:::d3d12
```quiz
The 4 × 4 noise texture must be tiled over the whole window, a random vector per pixel. How is it set up?
- [ ] An 800 × 600 texture of random vectors, read with the clamping sampler s0
- [ ] `R8_UNORM`, 4 × 4, read with a linear sampler – one random angle per texel
- [ ] `R32G32B32_FLOAT` uploaded from `XMFLOAT3`s, read with a linear, clamping sampler
- [x] `R32G32B32A32_FLOAT`, uploaded from `XMFLOAT4`s with `UpdateSubresources`, read with static sampler s1 (point, WRAP) at `texCoord * noiseScale`
---
`noiseScale` (800/4, 600/4) makes the texture repeat over the window; WRAP repeats the coordinates and point filtering gives each pixel exactly one of the 16 vectors.
```
:::

```quiz
What does the range check `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` prevent?
- [ ] Samples outside the window from being read
- [x] A surface far in front of the fragment – the planet in front of the back wall – from darkening it: samples whose stored depth differs by much more than the radius count less and less
- [ ] A flat surface from occluding itself – that's what the hemisphere is for
- [ ] Negative depths from being compared
---
Without it, the wall right next to the planet's outline would get a dark halo, because the planet's depth is far nearer than any sample around the wall. Self-occlusion of flat surfaces is handled by the hemisphere and the bias.
```
