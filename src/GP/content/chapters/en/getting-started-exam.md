# Exam: Getting started

Show what you've learned in *Getting started*: the window and the frame, the triangle and its shaders, values from the
CPU and textures. The questions cover the whole part, some of them for {{api}} in particular. Answer all of them and
press **Submit answers**; you need 80 % right to pass, and you can take the exam again.

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
In the first frame, the program calls `glUniform4f(vertexColorLocation, 0.0f, 1.0f, 0.0f, 1.0f);` and only then `glUseProgram(shaderProgram);`. What happens to the green colour in that frame?
- [ ] It is stored in the shader program and used by the next draw call
- [ ] It is set on every shader program that has a uniform with that name
- [x] It doesn't reach the program: `glUniform…` sets the uniform on the program that is active at the moment of the call, and none is yet
- [ ] OpenGL waits with the call until `glUseProgram` has been called
---
`glUniform…` has no program argument: it acts on the program that `glUseProgram` made active. Activate the program first, then set its uniforms.
```
:::
:::vulkan
```quiz
The fragment shader now reads a value from the push constant block, but the `VkPushConstantRange` and `vkCmdPushConstants` still say `VK_SHADER_STAGE_VERTEX_BIT` only. What happens?
- [ ] Nothing: push constants are visible to every stage of the pipeline
- [x] The fragment shader is not given the range: the validation layer reports the mismatch, and the fragment stage has to be added to the range and to `vkCmdPushConstants`
- [ ] The vertex shader passes the value on to the fragment shader by itself
- [ ] The value arrives one frame late in the fragment shader
---
A push constant range belongs to the stages named in its `stageFlags`. A shader stage that reads the block must be in the range, and `vkCmdPushConstants` must name the same stages.
```
:::
:::d3d12
```quiz
The pixel shader now reads a value from the root constants' `cbuffer`, but the root parameter was created with `D3D12_SHADER_VISIBILITY_VERTEX`. What happens?
- [ ] Nothing: root constants are visible to every shader stage
- [ ] The vertex shader passes the value on to the pixel shader by itself
- [ ] The value arrives one frame late in the pixel shader
- [x] The pixel shader doesn't see the root parameter: its visibility must include the pixel stage (`D3D12_SHADER_VISIBILITY_ALL` or `_PIXEL`)
---
A root parameter's visibility says which shader stages can read it. With `VERTEX`, only the vertex shader sees the constants; the debug layer reports a pixel shader that reads a register no visible parameter provides.
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

```quiz
A rectangle's texture coordinates run from (0, 0) to (3, 2) instead of (0, 0) to (1, 1), and the wrapping mode is *repeat*. What do you see?
- [x] The texture three times across and twice up the rectangle
- [ ] The texture once, three times wider and twice as tall as the rectangle, cut off at its edges
- [ ] The texture once, in the corner from 0 to 1, and the edge texels stretched over the rest
- [ ] Nothing: texture coordinates above 1 are invalid
---
With repeat, only the fractional part of the coordinate counts: from 0 to 3 the texture starts over at 1 and at 2, so it fits three times across. Clamp to edge would stretch the edge texels instead.
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
A 16 × 16 pixel-art texture is drawn over most of an 800 × 600 window. Which magnification filter keeps its pixels as sharp squares?
- [ ] Linear filtering, because it reads more texels
- [ ] A mipmap filter, because the texture is drawn larger than it is
- [x] Nearest filtering
- [ ] Clamp to edge
---
Magnified, each texel covers many pixels. Nearest gives every pixel the colour of the closest texel – sharp squares; linear blends the neighbours into a smooth blur. Mipmaps are for minification, and clamping is a wrapping mode.
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
In the Vulkan project the images are loaded with stb_image without flipping them, and the container is the right way up. Why?
- [ ] stb_image flips images by itself when they are copied into a `VkImage`
- [ ] The vertex shader flips y, so the texture is turned the right way
- [x] In Vulkan, texture coordinate v = 0 is the first row of the image data – the top row an image file stores first – and the vertices' coordinates are written with v = 0 at the top
- [ ] The sampler's address mode turns the image around
---
Image files and Vulkan agree: the first row is v = 0, at the top. OpenGL puts t = 0 at the bottom, which is why learnopengl flips its images while loading them.
```
:::
:::d3d12
```quiz
In the Direct3D 12 project the images are loaded with stb_image without flipping them, and the container is the right way up. Why?
- [ ] stb_image flips images by itself when they are copied into the upload heap
- [x] In Direct3D, texture coordinate v = 0 is the first row of the image data – the top row an image file stores first – and the vertices' coordinates are written with v = 0 at the top
- [ ] The vertex shader flips y, so the texture is turned the right way
- [ ] The static sampler's address mode turns the image around
---
Image files and Direct3D agree: the first row is v = 0, at the top. OpenGL puts t = 0 at the bottom, which is why learnopengl flips its images while loading them.
```
:::

```quiz
The fragment shader returns `mix(container, face, 0.2)` (in HLSL: `lerp`). What does a fragment get?
- [ ] 20 % of the container and 80 % of the face
- [ ] The container where it is brighter than 0.2, otherwise the face
- [ ] The sum of both colours times 0.2
- [x] 80 % of the container's colour and 20 % of the face's
---
`mix(a, b, t)` is a · (1 − t) + b · t: at t = 0 only `a`, at t = 1 only `b`. With 0.2 the container dominates and the face shows through faintly.
```
