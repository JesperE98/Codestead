# Exam: Going 3D

Show what you've learned in *Going 3D*: vectors, matrices and angles, transformations, coordinate systems and the
camera. The questions cover the whole part, some of them for {{api}} in particular. Answer all of them and press
**Submit answers**; you need 80 % right to pass, and you can take the exam again.

```quiz
A full turn is 360°. How many radians is 90°?
- [ ] 90
- [ ] π
- [x] π / 2, about 1.571
- [ ] 2π
---
360° is 2π radians, so 90° – a quarter turn – is 2π / 4 = π / 2. The maths libraries' rotate and perspective functions expect radians.
```

```quiz
**a** and **b** are unit vectors, and **a** · **b** = 0. What does that tell you?
- [ ] They point in the same direction
- [ ] They point in opposite directions
- [ ] One of them must be the zero vector
- [x] They are perpendicular to each other
---
For unit vectors the dot product is the cosine of the angle between them. cos θ = 0 means θ = 90°. Same direction gives 1, opposite directions −1.
```

```quiz
What is the cross product of the x axis (1, 0, 0) and the y axis (0, 1, 0)?
- [x] (0, 0, 1), the z axis: a vector perpendicular to both
- [ ] 0, because the axes are perpendicular
- [ ] (1, 1, 0), the sum of the two
- [ ] (0, 0, −1), because the cross product always points away from you
---
The cross product gives a vector perpendicular to both inputs. In a right-handed system x × y = z; the camera chapter uses this to build its right and up axes. A single number is what the dot product gives.
```

```quiz
A 4 × 4 matrix is multiplied by the vector (x, y, z, 1). How is the first component of the result computed?
- [ ] As the product of all numbers in the matrix's first column
- [x] As the dot product of the matrix's first row with the vector
- [ ] As the first number of the matrix times x
- [ ] As the sum of the vector's components times the matrix's first number
---
Each component of M · v is one row of M "dotted" with v. With the identity matrix every row picks out one component, so the vector comes back unchanged.
```

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

:::opengl
```quiz
The projection is made with `glm::perspective(45.0f, 800.0f / 600.0f, 0.1f, 100.0f);` – without `glm::radians`. What happens?
- [ ] Nothing: `glm::perspective` takes degrees
- [ ] GLM converts the 45 to radians by itself, with a warning
- [ ] The near and far planes swap places
- [x] The field of view becomes 45 radians – many full turns – instead of 45°, and the scene looks completely wrong
---
GLM's functions take angles in radians. 45 radians is about 2578°, so the projection's field of view is nonsense; `glm::radians(45.0f)` is about 0.785.
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
