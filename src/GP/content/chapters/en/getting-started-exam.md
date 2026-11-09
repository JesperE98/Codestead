# Exam: Getting started

Show what you've learned in *Getting started*: the window and the frame, the triangle and its shaders, textures,
transformations, coordinate systems and the camera. The questions cover the whole part, some of them for {{api}} in
particular. Answer all of them and press **Submit answers**; you need 80 % right to pass, and you can take the exam again.

:::opengl
```quiz
Your program creates a GLFW window, makes its context current, and then crashes on its very first OpenGL call, `glClearColor`. Which step is most likely missing?
- [ ] `glViewport(0, 0, 800, 600)` before the first OpenGL call
- [ ] `glfwSwapBuffers(window)` once before the render loop
- [ ] `glfwPollEvents()` before the first OpenGL call
- [x] `gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)` after making the context current
---
The addresses of the OpenGL functions are only known at run time; GLAD looks them up in the driver. Without it, `glClearColor` is a null function pointer, and calling it crashes.
```
:::
:::vulkan
```quiz
In which order does the project create these Vulkan objects?
- [ ] Instance, swap chain, logical device, physical device, window surface
- [ ] Physical device, instance, swap chain, window surface, logical device
- [ ] Logical device, instance, physical device, window surface, swap chain
- [x] Instance, window surface, physical device, logical device, swap chain
---
Everything starts with the instance. The surface comes next, because choosing a physical device needs to know which queue family can present to it. The logical device is created from the physical device, and the swap chain from the logical device and the surface.
```
:::
:::d3d12
```quiz
In which order does the project set up Direct3D 12?
- [ ] Device, DXGI factory, swap chain, command queue, debug layer
- [ ] Adapter, device, debug layer, swap chain, command queue
- [x] Debug layer, DXGI factory, adapter, device, command queue, swap chain
- [ ] DXGI factory, swap chain, adapter, device, command queue
---
The debug layer must be enabled before the device is created. The factory finds the adapter, the adapter gives the device, and the swap chain is created for the command queue that will present to it.
```
:::

```quiz
Why does a program draw each frame into a back buffer and only then swap (present) it?
- [ ] So the window's events can be handled while the GPU draws
- [ ] So the clear colour only has to be set once, at the start of the program
- [x] So the window never shows a frame that is still being drawn
- [ ] So the GPU can draw twice as many frames per second
---
The window always shows a finished image (the front buffer) while the next one is drawn. Swapping replaces it at once, without the flicker of a half-drawn picture.
```

:::opengl
```quiz
The render loop calls `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` every frame but never `glClear`. What happens?
- [ ] The window turns teal: `glClearColor` clears the colour buffer
- [ ] The window turns teal once `glfwSwapBuffers` shows the back buffer
- [x] Nothing is cleared: `glClearColor` only sets state, which `glClear(GL_COLOR_BUFFER_BIT)` would use
- [ ] OpenGL reports an error because the clear colour is never used
---
`glClearColor` is a state-setting function: it changes the context's clear colour. `glClear` is the state-using function that actually fills the buffer with it.
```
:::
:::vulkan
```quiz
At the start of `drawFrame()`, the CPU must wait until the GPU has finished the previous frame. Which object does that?
- [x] The fence `inFlightFence`, with `vkWaitForFences` (and `vkResetFences` afterwards)
- [ ] The render pass, which only ends when the GPU has finished drawing
- [ ] The semaphore `imageAvailableSemaphore`
- [ ] `vkQueueSubmit`, which returns when the command buffer has been executed
---
Semaphores order work on the GPU (acquire → render → present) without blocking the CPU. A fence is how the CPU waits for the GPU. `vkQueueSubmit` returns at once, long before the commands have run.
```
:::
:::d3d12
```quiz
Before `ClearRenderTargetView` can clear the current back buffer, what must the command list record?
- [ ] A `Signal` of the fence, so the GPU knows the clear may start
- [x] A transition barrier from `D3D12_RESOURCE_STATE_PRESENT` to `D3D12_RESOURCE_STATE_RENDER_TARGET` (and the opposite one before `Present`)
- [ ] The creation of a new render target view for the back buffer
- [ ] A call to `Present`, which makes the buffer the back buffer
---
A back buffer handed to the swap chain is in the `PRESENT` state; to render into it, it must be in the `RENDER_TARGET` state. The RTVs are created once, and the fence is for the CPU.
```
:::

```quiz
After the perspective division, one corner of a triangle has x = 1.5; the other two lie well inside the window. What do you see?
- [x] The part of the triangle inside the view volume; the rest is clipped at the window's right edge
- [ ] The whole triangle, squeezed so that x = 1.5 lands on the window's right edge
- [ ] The whole triangle; the corner outside the window is drawn beyond its edge
- [ ] Nothing: a triangle with a vertex outside the view volume is discarded
---
Only coordinates between -1 and 1 in x and y end up in the viewport. A triangle that is partly outside is clipped: the GPU cuts it to the part that is inside.
```

```quiz
The three corners of a triangle are red, green and blue, and the vertex shader passes each vertex's colour on to the fragment shader. What colour does the fragment at the exact centre of the triangle get?
- [ ] It's undefined: the fragment shader only receives colours at the vertices
- [x] A mixture of a third of each, about (0.33, 0.33, 0.33)
- [ ] White, the sum of the three colours
- [ ] Red, the colour of the first vertex
---
The rasterizer interpolates the vertex shader's outputs across the triangle. At the centre all three vertices weigh the same, so each colour contributes one third.
```

:::opengl
```quiz
Each vertex is now 3 floats of position followed by 3 floats of colour. Which call describes the colour attribute at location 1?
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)(3 * sizeof(float)));`
- [x] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));`
- [ ] `glVertexAttribPointer(1, 6, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`
---
The stride is the size of a whole vertex (6 floats); the offset is where the colour starts within a vertex (after the 3 position floats). The size is the number of components of the attribute, 3.
```
:::
:::vulkan
```quiz
`struct Vertex` now has a position and a colour. Where are the vertex's stride and the colour's offset described?
- [x] The stride in the `VkVertexInputBindingDescription` (`sizeof(Vertex)`), the offset in the colour's `VkVertexInputAttributeDescription` (`offsetof(Vertex, color)`)
- [ ] Both in the call to `vkCmdBindVertexBuffers`
- [ ] In the vertex shader, with `layout(location = 1, offset = 12)`
- [ ] Both in the colour's `VkVertexInputAttributeDescription`
---
The binding description says how to step through the buffer (the stride, per vertex); each attribute description says where its attribute is (location, format, offset). Both are part of the pipeline's vertex input state.
```
:::
:::d3d12
```quiz
`struct Vertex` now has a position and a colour. Where are the vertex's stride and the colour's offset described?
- [ ] In the vertex shader, with the semantic `COLOR12`
- [ ] Both in the root signature
- [x] The stride in the vertex buffer view (`StrideInBytes = sizeof(Vertex)`), the offset in the colour's input element of the input layout (byte offset 12)
- [ ] Both in the colour's input element of the input layout
---
The vertex buffer view says where the buffer is, how big it is and how far apart the vertices are. Each input element of the input layout says where its attribute lies inside a vertex. The number after a semantic is a semantic index, not an offset.
```
:::

```quiz
A rectangle is drawn as two triangles with indexed drawing. How many vertices and how many indices does it need?
- [ ] 4 vertices and 4 indices
- [x] 4 vertices and 6 indices
- [ ] 6 vertices and 6 indices
- [ ] 6 vertices and 4 indices
---
The two triangles share two corners. With an index buffer each corner is stored once (4 vertices), and the 6 indices say which corners make up each triangle.
```

:::opengl
```quiz
Ten cubes are drawn by setting the `model` uniform and calling `glDrawArrays`, ten times per frame. Why does every cube get its own matrix?
- [ ] It doesn't: all ten cubes get the last matrix that was set
- [ ] Every `setMat4` call creates a new uniform with the same name
- [x] Each draw call uses the uniform values the program has at the moment of the call
- [ ] OpenGL keeps a separate copy of every uniform for each draw call until `glfwSwapBuffers`
---
A uniform keeps its value until you change it, and OpenGL makes sure every draw call uses the values current when it is issued. So setting the model matrix before each draw is enough.
```
:::
:::vulkan
```quiz
Ten cubes are drawn per frame. Why is each cube's model matrix a push constant, while view and projection are in the uniform buffer?
- [ ] Uniform buffers can only hold two matrices
- [ ] Push constants are read by the vertex shader only, uniform buffers by the fragment shader only
- [ ] Push constants are kept until the next frame, uniform buffers only until the next draw
- [x] Push constants are recorded into the command buffer per draw; the uniform buffer's contents are only read when the GPU executes the commands, so ten matrices written into it would all end up as the last one
---
`vkCmdPushConstants` copies the bytes into the command buffer, so every draw sees the values pushed before it. A descriptor only points at the buffer; whatever it contains when the GPU runs the commands is what every draw of the frame sees – right for view and projection, wrong for the model matrix.
```
:::
:::d3d12
```quiz
Ten cubes are drawn per frame. Why is each cube's model matrix in root constants, while view and projection are in the constant buffer?
- [ ] A constant buffer can only hold two matrices
- [ ] Root constants are kept until the next frame, constant buffers only until the next draw
- [ ] Root constants are read by the vertex shader only, constant buffers by the pixel shader only
- [x] Root constants are recorded into the command list per draw; the constant buffer's contents are only read when the GPU executes the commands, so ten matrices written into it would all end up as the last one
---
`SetGraphicsRoot32BitConstants` records the values into the command list, so every draw sees the values set before it. The CBV only points at the buffer; whatever it contains when the GPU runs the commands is what every draw of the frame sees – right for view and projection, wrong for the model matrix.
```
:::

```quiz
A large floor with a detailed texture stretches far into the distance, and far away it shimmers and looks noisy. What helps?
- [ ] A texture with a higher resolution
- [x] Mipmaps, with a minification filter that uses them
- [ ] Clamp-to-edge wrapping instead of repeat
- [ ] Nearest filtering as the magnification filter
---
Far away, many texels fall on one pixel (the texture is minified), and picking one of them gives a different, random-looking colour from frame to frame. A smaller, pre-filtered mip level gives the right average colour. A larger texture would make it worse.
```

:::opengl
```quiz
The fragment shader declares `uniform sampler2D texture1;` and `uniform sampler2D texture2;`. What makes `texture2` read the face image?
- [ ] `glBindTexture(GL_TEXTURE_2D, texture2);` right after binding `texture1`
- [x] `ourShader.setInt("texture2", 1);` once, and `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, texture2);` before drawing
- [ ] `ourShader.setInt("texture2", texture2);` with the texture object's id
- [ ] `glActiveTexture(GL_TEXTURE1);` alone: the sampler finds the texture by its name
---
A sampler uniform holds the number of a texture unit, not a texture id. Binding the face to unit 1 and setting the sampler to 1 connects them. Binding without changing the active unit would replace the container on unit 0.
```
:::
:::vulkan
```quiz
The fragment shader reads the face with `layout(binding = 1) uniform sampler2D faceSampler;`. What does the face texture need on the C++ side, besides its image and image view?
- [ ] A second `VkSampler`, because a sampler belongs to one image
- [ ] A second descriptor set, bound with `vkCmdBindDescriptorSets` at index 1
- [x] A second binding (binding 1, a combined image sampler) in the descriptor set layout, room for it in the pool, and a descriptor write with its image view and the sampler
- [ ] A second vertex buffer binding, so `vkCmdBindVertexBuffers` can pass the image
---
Bindings play the role of OpenGL's texture units: each is a slot in the descriptor set that the shader names. A sampler doesn't belong to an image, so the same `textureSampler` reads both.
```
:::
:::d3d12
```quiz
The pixel shader reads the face with `Texture2D texture2 : register(t1);`. What does the face texture need on the C++ side, besides the texture resource?
- [ ] A second static sampler at register `s1`, because a sampler belongs to one texture
- [ ] A second root signature for the second texture
- [ ] A second vertex buffer view, so `IASetVertexBuffers` can pass the texture
- [x] Its SRV in the heap slot right after the container's, and a descriptor range of 2 SRVs starting at `t0`
---
Registers play the role of OpenGL's texture units: the descriptor table covers consecutive descriptors in the heap, and they become `t0`, `t1`, … A sampler doesn't belong to a texture, so `s0` reads both.
```
:::

```quiz
With column vectors (as in the textbook and GLM), you want every vertex to be scaled first, then rotated, then translated. Which matrix do you use?
- [ ] `S · R · T`
- [x] `T · R · S`
- [ ] Any of them: the order of matrix multiplication doesn't matter
- [ ] `R · T · S`
---
With column vectors the matrix closest to the vector – the rightmost – is applied first: `T · R · S · v` scales, then rotates, then translates. Matrix multiplication is not commutative, so the order matters.
```

:::opengl
```quiz
If the program didn't call `stbi_set_flip_vertically_on_load(true)`, the container would appear upside down. Why?
- [ ] stb_image loads images mirrored, in every API
- [ ] The vertex shader flips y because OpenGL's NDC have y pointing down
- [ ] The texture's wrapping mode `GL_REPEAT` turns the image around
- [x] OpenGL puts texture coordinate 0.0 on the y axis at the first row of the data, which it treats as the bottom of the image, while image files store the top row first
---
`glTexImage2D` takes the first row of the data as the bottom of the texture (t = 0). Image files start with the top row, so without the flip the picture arrives upside down.
```
:::
:::vulkan
```quiz
Why does the project multiply `proj[1][1]` by -1 after `glm::perspective`?
- [ ] Because Vulkan's texture coordinates start at the top of the image
- [ ] To map depth from -1..1 to 0..1
- [x] GLM was written for OpenGL, where y points up in clip space; in Vulkan it points down, so the y scale is flipped to keep +y at the top of the window
- [ ] Because the swap chain stores its images bottom row first
---
Without the flip the whole scene would be upside down. The depth range is a separate difference, handled by `GLM_FORCE_DEPTH_ZERO_TO_ONE`.
```
:::
:::d3d12
```quiz
The projection is made with `XMMatrixPerspectiveFovRH`. What happens if you build the view matrix with `XMMatrixLookAtLH` instead of `XMMatrixLookAtRH`?
- [x] The LH view matrix makes the camera look down +z, but the RH projection expects it to look down -z, so the scene ends up behind the camera
- [ ] Nothing: LH and RH only differ in how they store the matrix
- [ ] The picture is mirrored left to right but otherwise correct
- [ ] The depth range changes from 0..1 to -1..1
---
The view matrix and the projection must agree on the view space. The course uses the right-handed functions everywhere, which have the same view space as GLM and OpenGL.
```
:::

:::opengl
```quiz
The transformation is sent with `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));`. Why is the third argument `GL_FALSE`?
- [ ] It means the uniform is set only once, not every frame
- [ ] It means the matrix isn't normalized, which is right for transformations
- [ ] GLM matrices are row-major, and OpenGL transposes them by itself
- [x] It means "don't transpose": GLM stores its matrices column by column, which is the order OpenGL expects
---
The argument asks OpenGL to transpose the matrix while reading it. GLM's memory layout already matches OpenGL's column-major convention, so no transpose is needed.
```
:::
:::vulkan
```quiz
`struct PushConstants { glm::mat4 model; };` is copied byte for byte into the shader's `mat4 model`, with no transpose. Why is that correct?
- [ ] It isn't correct, but transformations look the same either way
- [ ] Push constants can only hold matrices that are symmetric
- [ ] `vkCmdPushConstants` transposes every matrix it copies
- [x] GLM stores a `mat4` column by column, and that is how GLSL lays out a `mat4` too
---
Both sides use column-major storage, so the bytes mean the same matrix on the CPU and on the GPU. (A transposed rotation would turn the other way, so it does matter.)
```
:::
:::d3d12
```quiz
Before a matrix is stored into the constants, the project calls `XMMatrixTranspose`, and the shader computes `mul(position, transform)`. Why the transpose?
- [x] `XMFLOAT4X4` stores row by row, while HLSL reads a matrix in a constant buffer column by column by default; transposing makes the shader see the same matrix
- [ ] `mul` in HLSL only works with transposed matrices
- [ ] DirectXMath matrices are wrong and must always be corrected
- [ ] Root constants are stored in reverse order
---
Row-major storage plus column-major packing would hand the shader the transpose. Storing the transpose cancels that out, and `mul` with the vector first computes v · M, exactly as DirectXMath does on the CPU.
```
:::

```quiz
What makes objects further away look smaller with a perspective projection?
- [ ] The rasterizer draws distant triangles with fewer fragments
- [ ] The view matrix scales every object by its distance from the camera
- [x] The projection matrix puts the distance into w, and the perspective division divides x and y by it
- [ ] The depth test shrinks fragments that are further away
---
After the projection, w grows with the distance from the camera. Dividing by w at the end of the vertex stage brings far-away points closer to the centre: perspective.
```

```quiz
Depth testing is on, but the program forgets to clear the depth buffer at the start of each frame. What happens?
- [x] Fragments are tested against depth values left over from earlier frames, so many fail the test and parts of the scene go missing
- [ ] Only the first object of each frame is drawn
- [ ] The scene is drawn without depth testing
- [ ] Nothing changes: every fragment overwrites the depth buffer anyway
---
Clearing sets every depth to 1.0, the far plane, so the first fragment on a pixel always passes. Without it, the old values hide this frame's fragments wherever they aren't nearer than before.
```

```quiz
The camera code keeps the pitch between -89° and 89°. Why not allow 90°?
- [ ] Because the projection matrix only supports angles below 90°
- [ ] So the mouse can't move the camera faster than 89° per frame
- [x] At 90° the view direction is parallel to the world's up vector, so the cross product for the right vector becomes zero and the view flips
- [ ] Because `sin` and `cos` aren't defined at 90°
---
The LookAt matrix computes the camera's right axis as the cross product of the direction and the world up vector. When the two are parallel, that product is zero and the camera's orientation is no longer defined.
```

```quiz
Why is the camera's speed multiplied by `deltaTime`, the time the last frame took?
- [x] So the camera moves equally fast on fast and slow computers, however many frames per second they draw
- [ ] So the camera stops when the window loses focus
- [ ] So the movement speeds up the longer a key is held
- [ ] Because the view matrix expects distances in seconds
---
Without it, the camera moves a fixed distance per frame, so a computer that draws twice as many frames moves twice as fast. Speed times frame time gives a distance per second.
```

```quiz
The mouse wheel changes `fov`, the field of view of the projection matrix. What do you see when `fov` goes from 45° to 20°?
- [x] The scene looks bigger: you're zooming in
- [ ] The scene looks smaller: you're zooming out
- [ ] Objects near the camera are clipped
- [ ] The camera moves forward along its direction
---
A smaller field of view fits a smaller part of the scene into the same window, so everything in it looks larger. The camera itself doesn't move.
```
