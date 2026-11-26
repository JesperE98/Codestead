# Review: Going 3D

You have reached the end of *Going 3D*. You started with the maths – vectors, matrices, angles – and used it to move,
scale and rotate your objects, to give the scene depth and perspective, and to fly through it with a camera. This page
is a glossary of the most important terms of the part, chapter by chapter. Use it to look things up, and as a check:
if a definition surprises you, go back to the chapter it comes from.

The terms outside the boxes are the same in every API. The boxes list how {{api}} names and does things where the
three APIs differ. When you're done, the exam at the end of the part checks what you've learned.

## The maths of 3D

- **Coordinate axes**: x to the right, y up and z towards you – a **right-handed** system, the one the course uses for
  its world.
- **Degrees and radians**: a full turn is 360° or 2π radians; the maths libraries' functions take radians, so degrees
  are converted (`radians(45°)` ≈ 0.785).
- **Sine and cosine**: on the unit circle, the point at angle θ is (cos θ, sin θ). They turn an angle into x and y –
  in rotation matrices, in the camera's direction from yaw and pitch, and in anything that moves back and forth with
  `sin(time)`.
- **Vector**: a direction and a magnitude. Its **length** comes from Pythagoras; **normalizing** a vector makes it a
  **unit vector** of length 1.
- **Dot product**: the product of the lengths times the cosine of the angle between two vectors – for unit vectors
  the cosine itself, which tells you the angle.
- **Cross product**: a vector perpendicular to two others (in 3D only).
- **Matrix**: a grid of numbers. Matrix multiplication is not commutative: A · B is usually not B · A.
- **Identity matrix**: the matrix that leaves a vector unchanged.
- **Matrix-vector multiplication**: each component of the result is the dot product of one row of the matrix with the
  vector; this is how a matrix transforms a vector.

## Transformations

- **Scaling**, **translation** and **rotation** matrices: change a vector's size, position and orientation.
  Rotation angles are in radians.
- **Homogeneous coordinate**: the vector's w component. With w = 1 a vector is a point and is translated; with w = 0
  it is a direction and is not.
- **Combining matrices**: one matrix can do several transformations. With column vectors (the textbook, GLM) the
  matrix on the right is applied first: in `Trans * Scale` the vector is scaled, then translated.

:::opengl
- **GLM**: the OpenGL Mathematics library: `glm::mat4`, `glm::translate`, `glm::rotate`, `glm::scale`,
  `glm::radians`.
- **glUniformMatrix4fv** and **glm::value_ptr**: send a matrix to a `mat4` uniform; GLM stores matrices column by
  column, the order OpenGL expects, so the *transpose* argument is `GL_FALSE`.
:::
:::vulkan
- **GLM**: the same mathematics library as in learnopengl and vulkan-tutorial: `glm::mat4`, `glm::translate`,
  `glm::rotate`, `glm::scale`. A `glm::mat4` matches GLSL's `mat4` byte for byte.
- **The matrix as a push constant**: `struct PushConstants { glm::mat4 … }` and a `push_constant` block in the vertex
  shader.
- **The y flip**: the maths is done with y up, like learnopengl, and the vertex shader flips y for Vulkan's y-down
  clip space (from *Coordinate systems* on, the projection matrix does it).
:::
:::d3d12
- **DirectXMath**: Microsoft's mathematics library. **Calculation types** (`XMVECTOR`, `XMMATRIX`) are for the
  maths, **storage types** (`XMFLOAT3`, `XMFLOAT4X4`) for your structs.
- **Row vectors**: DirectXMath writes v · M, so its matrices are the transpose of the textbook's and a product reads
  from **left to right**: `XMMatrixScaling(…) * XMMatrixTranslation(…)` scales first, then translates.
- **XMMatrixTranspose** and **mul(position, transform)**: `XMFLOAT4X4` stores row by row while HLSL reads a cbuffer
  matrix column by column, so the matrix is transposed when it's stored; `mul` with the vector first computes
  v · M, like DirectXMath.
- **The matrix as root constants**: a 4×4 matrix is 16 32-bit root constants (of at most 64 DWORDs in a root
  signature).
:::

## Coordinate systems

- **Local space**: the coordinates of an object relative to its own origin.
- **World space**: the coordinates in the larger world. The **model matrix** moves, scales and rotates an object
  from local into world space.
- **View space** (camera or eye space): the world as seen from the camera; the **view matrix** gets you there.
- **Clip space**: what the vertex shader outputs; the **projection matrix** gets you there and decides what is
  visible.
- **Frustum**: the volume the projection matrix keeps; everything outside it is clipped.
- **Orthographic projection**: a box-shaped frustum, no perspective: things far away are as big as things nearby.
- **Perspective projection**: a pyramid-shaped frustum defined by the field of view, the aspect ratio and the near and
  far planes; it puts the distance into w, so things further away get smaller.
- **Perspective division**: dividing x, y and z by w at the end of the vertex stage, which turns clip space into NDC.
- **Screen space**: NDC mapped to the viewport, in pixels.
- **Right-handed system**: +x right, +y up, +z towards you; the camera looks down -z in view space.
- **The chain**: `projection · view · model · position` (with column vectors, read from right to left).
- **Depth buffer** (z-buffer) and **depth testing**: per pixel the depth of the nearest fragment so far, cleared to
  1.0 (the far plane) every frame; a fragment that is further away than the stored value is discarded.

:::opengl
- **OpenGL's NDC**: x, y and z all run from -1 to 1; y points up. `glm::perspective` and `glm::ortho` produce this
  range.
- **Uniforms for all three matrices**: `model`, `view` and `projection` are set with `setMat4` (`shader_m.h`); each
  draw call uses the values set before it.
- **glEnable(GL_DEPTH_TEST)** and **GL_DEPTH_BUFFER_BIT**: switch depth testing on (GLFW creates the depth buffer)
  and clear the depth buffer together with the colour.
:::
:::vulkan
- **Vulkan's NDC**: depth runs from 0 to 1 and y points down. `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` adapts GLM's
  projection to the depth range, and `proj[1][1] *= -1` flips y.
- **Uniform buffer for view and projection**: a `VkBuffer` read through a descriptor (binding 2 of the descriptor
  set); its *contents* are read when the GPU executes the commands, so every draw of a frame sees the same values.
- **Push constant for the model matrix**: recorded into the command buffer, so each draw gets its own.
- **Depth image**: you create the depth buffer yourself: an image in a depth format, its view, a depth attachment in
  the render pass and the framebuffers, the pipeline's depth-stencil state, and a clear value of 1.0.
:::
:::d3d12
- **Direct3D's NDC**: depth runs from 0 to 1; y points up, as in OpenGL. The course uses DirectXMath's right-handed
  functions (`XMMatrixPerspectiveFovRH`), which have the same view space as GLM.
- **Constant buffer for view and projection**: a buffer resource read through a **constant buffer view** (CBV,
  register `b1`) in the descriptor heap; its size is a multiple of 256 bytes. Its *contents* are read when the GPU
  executes the commands, so every draw of a frame sees the same values.
- **Root constants for the model matrix**: recorded into the command list, so each draw gets its own.
- **Depth buffer**: you create it yourself: a **DSV heap**, a `DXGI_FORMAT_D32_FLOAT` texture with its depth stencil
  view, the PSO's depth-stencil state, `ClearDepthStencilView` every frame and the DSV in `OMSetRenderTargets`.
:::

## Camera

- **Camera position**, **direction**, **right** and **up** vectors: the axes of view space, built with cross
  products from the direction and the world's up vector.
- **LookAt matrix**: the view matrix built from those axes and the camera position: a rotation into the camera's
  axes times a translation by the negated position.
- **Free camera**: `cameraPos`, `cameraFront` and `cameraUp`; the view looks from `cameraPos` to
  `cameraPos + cameraFront`, and the WASD keys move `cameraPos`.
- **Delta time**: the time the last frame took. Multiplying speeds by it makes movement the same on fast and slow
  computers.
- **Euler angles**: **yaw** (left/right), **pitch** (up/down) and **roll**. The direction vector is computed from yaw
  and pitch with sine and cosine; pitch is kept between -89° and 89° so the view doesn't flip.
- **Mouse look**: the mouse's movement since the last frame, times a sensitivity, is added to yaw and pitch.
- **Zoom**: a smaller **field of view** in the projection matrix makes the scene look bigger; the course keeps it
  between 1° and 45°.

:::opengl
- **glm::lookAt(position, target, up)**: builds the LookAt matrix.
- **glfwGetKey**: whether a key is held down right now (`processInput`).
- **glfwSetInputMode(…, GLFW_CURSOR, GLFW_CURSOR_DISABLED)**: hides and captures the cursor.
- **glfwSetCursorPosCallback** and **glfwSetScrollCallback**: `mouse_callback` and `scroll_callback`, called when the
  mouse moves and when the wheel turns.
:::
:::vulkan
- **glm::lookAt(position, target, up)**: builds the LookAt matrix; it goes into the uniform buffer in
  `updateUniformBuffer()`, together with the projection, which uses `fov`.
- **GLFW input**: the same as in OpenGL: `glfwGetKey`, `GLFW_CURSOR_DISABLED`, and the callbacks
  `glfwSetCursorPosCallback` and `glfwSetScrollCallback`.
:::
:::d3d12
- **XMMatrixLookAtRH(eye, focus, up)**: builds the right-handed LookAt matrix (the LH version would not fit the RH
  projection).
- **Keyboard**: `WM_KEYDOWN` and `WM_KEYUP` keep an array of held keys up to date, and `OnUpdate` moves the camera
  once per frame.
- **Mouse**: `ShowCursor(FALSE)` hides the cursor, `WM_MOUSEMOVE` reports its position (`GET_X_LPARAM`,
  `GET_Y_LPARAM`), and `SetCursorPos` puts it back into the middle of the window.
- **Mouse wheel**: `WM_MOUSEWHEEL`, with `GET_WHEEL_DELTA_WPARAM` divided by `WHEEL_DELTA` per notch.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Maths library | GLM | GLM | DirectXMath |
| Vectors in the maths | column vectors (M · v) | column vectors (M · v) | row vectors (v · M) |
| The model matrix per draw | uniform | push constant | root constants |
| View and projection for the whole frame | uniforms | uniform buffer (descriptor) | constant buffer (CBV) |
| The LookAt matrix | `glm::lookAt` | `glm::lookAt` | `XMMatrixLookAtRH` |
| Depth range in NDC | -1..1 | 0..1 | 0..1 |
| y in NDC | up | down | up |

That's it for *Going 3D*. In *Lighting* you'll use all of this – shaders, values from the CPU, textures, matrices and
the camera – to light a scene.
