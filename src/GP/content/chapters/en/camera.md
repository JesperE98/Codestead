# Camera

In the previous chapter we discussed the view matrix and how we can use the view matrix to move around the scene
(we moved backwards a little). {{api}} by itself is not familiar with the concept of a *camera*, but we can try to
simulate one by moving all objects in the scene in the reverse direction, giving the illusion that we are moving.

In this chapter we'll discuss how we can set up a camera in {{api}}. We will discuss a fly style camera that allows
you to freely move around in a 3D scene. We'll also discuss keyboard and mouse input and finish with a custom camera
class.

:::opengl
This chapter's project is the result of *Coordinate Systems*: the same files (`main.cpp`, `shader_m.h`,
`shader.vs`, `shader.fs`, `container.png`, `awesomeface.png`) and the same ten textured crates, every third one
(cubes 0, 3, 6 and 9) turning over time. Every frame the render loop builds a `view` matrix (a translation by
(0, 0, -3)) and a `projection` matrix (45°, 800/600, 0.1, 100) and sets them with `ourShader.setMat4`; then the
`for` loop computes one `model` matrix per cube and draws it with `glDrawArrays`.
:::
:::vulkan
This chapter's project is the result of *Coordinate Systems*: ten depth-tested, textured crates, every third one
(cubes 0, 3, 6 and 9) turning over time. The view and projection matrices live in the uniform buffer, filled every
frame by `updateUniformBuffer()`; the model matrix of each cube is pushed as a push constant before its draw in
`recordCommandBuffer()`. All camera work in this chapter happens in `updateUniformBuffer()` and in new input code;
`recordCommandBuffer()` does not change.
:::
:::d3d12
This chapter's project is the result of *Coordinate Systems*: ten depth-tested, textured crates, every third one
(cubes 0, 3, 6 and 9) turning over time. `OnUpdate` writes the view matrix (`XMMatrixTranslation(0, 0, -3)`) and the
45° projection into the constant buffer every frame; `PopulateCommandList` sets each cube's model matrix as root
constants and draws it. All camera work in this chapter happens in `OnUpdate` and in the window's message handler,
`WindowProc`; `PopulateCommandList` does not change.
:::

This time the project has no `// TODO:` comments: every task changes or extends code that is already there, and the
task text tells you where. After each task, press **Build & run** (Ctrl+Enter) to compile the program and run it in
the built-in simulator.

> The built-in simulator cannot press keys or move the mouse. Once the camera is controlled by the keyboard and the
> mouse, the preview therefore shows the camera's **starting view** – which, as you will see, is exactly the picture
> you start with. Only the circling camera of the second task visibly moves on its own, over time. Everything you
> write is still real input code: on your own computer, the same program lets you fly through the scene.

## Camera/View space

When we're talking about camera/view space we're talking about all the vertex coordinates as seen from the camera's
perspective as the origin of the scene: the view matrix transforms all the world coordinates into view coordinates
that are relative to the camera's position and direction. To define a camera we need its position in world space,
the direction it's looking at, a vector pointing to the right and a vector pointing upwards from the camera. A
careful reader may notice that we're actually going to create a coordinate system with 3 perpendicular unit axes
with the camera's position as the origin.

:::d3d12
> The *RH* functions of DirectXMath, which this course uses, work in a right-handed coordinate system exactly like
> OpenGL's: +x to the right, +y up and +z out of the screen, towards you. Everything in this section is therefore the
> same in Direct3D 12. (DirectXMath also has left-handed *LH* versions, where +z points into the screen; you would
> then have to flip the signs of every z below.)
:::

### 1. Camera position

Getting the camera position is easy. The camera position is a vector in world space that points to the camera's
position. We set the camera at the same position we've set the camera in the previous chapter:

:::opengl vulkan
```cpp
glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);
```
:::
:::d3d12
```cpp
XMVECTOR cameraPos = XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f);
```
:::

> Don't forget that the positive z-axis is going through your screen towards you so if we want the camera to move
> backwards, we move along the positive z-axis.

### 2. Camera direction

The next vector required is the camera's direction, e.g. at what direction it is pointing at. For now we let the
camera point to the origin of our scene: (0, 0, 0). Remember that if we subtract two vectors from each other we get a
vector that's the difference of these two vectors? Subtracting the camera position vector from the scene's origin
vector thus results in the direction vector we want. For the view matrix's coordinate system we want its z-axis to
be positive and because by convention the camera points towards the negative z-axis, we want to negate the direction
vector. If we switch the subtraction order around we now get a vector pointing towards the camera's positive
z-axis:

:::opengl vulkan
```cpp
glm::vec3 cameraTarget = glm::vec3(0.0f, 0.0f, 0.0f);
glm::vec3 cameraDirection = glm::normalize(cameraPos - cameraTarget);
```
:::
:::d3d12
```cpp
XMVECTOR cameraTarget = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);
XMVECTOR cameraDirection = XMVector3Normalize(cameraPos - cameraTarget);
```
:::

> The name *direction* vector is not the best chosen name, since it is actually pointing in the reverse direction of
> what it is targeting.

### 3. Right axis

The next vector that we need is a *right* vector that represents the positive x-axis of the camera space. To get the
right vector we use a little trick by first specifying an *up* vector that points upwards (in world space). Then we
do a cross product on the up vector and the direction vector from step 2. Since the result of a cross product is a
vector perpendicular to both vectors, we will get a vector that points in the positive x-axis's direction (if we
would switch the cross product order we'd get a vector that points in the negative x-axis):

:::opengl vulkan
```cpp
glm::vec3 up = glm::vec3(0.0f, 1.0f, 0.0f);
glm::vec3 cameraRight = glm::normalize(glm::cross(up, cameraDirection));
```
:::
:::d3d12
```cpp
XMVECTOR up = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
XMVECTOR cameraRight = XMVector3Normalize(XMVector3Cross(up, cameraDirection));
```
:::

### 4. Up axis

Now that we have both the x-axis vector and the z-axis vector, retrieving the vector that points to the camera's
positive y-axis is relatively easy: we take the cross product of the direction and the right vector:

:::opengl vulkan
```cpp
glm::vec3 cameraUp = glm::cross(cameraDirection, cameraRight);
```
:::
:::d3d12
```cpp
XMVECTOR cameraUp = XMVector3Cross(cameraDirection, cameraRight);
```
:::

With the help of the cross product and a few tricks we were able to create all the vectors that form the view/camera
space. For the more mathematically inclined readers, this process is known as the *Gram-Schmidt* process in linear
algebra. Using these camera vectors we can now create a **LookAt** matrix that proves very useful for creating a camera.

For our camera at (0, 0, 3) looking at the origin the results are simple: the direction is (0, 0, 1), the right
vector (1, 0, 0) and the up vector (0, 1, 0) – the camera's axes are exactly the world's axes. Keep that in mind for
the first task.

```quiz
The camera's direction vector is computed as `normalize(cameraPos - cameraTarget)`. Which way does it point?
- [ ] From the camera towards the target – the way the camera looks
- [ ] Along the world's up axis, perpendicular to the line of sight
- [x] From the target towards the camera – opposite to the way the camera looks, along the positive z-axis of view space
---
The camera looks down its own negative z-axis, so the view space's positive z-axis points backwards, out of the screen. Subtracting the target from the position gives exactly that axis – which is why the name *direction* is a little misleading.
```

## Look At

A great thing about matrices is that if you define a coordinate space using 3 perpendicular (or non-linear) axes you
can create a matrix with those 3 axes plus a translation vector and you can transform any vector to that coordinate
space by multiplying it with this matrix. This is exactly what the *LookAt* matrix does and now that we have 3
perpendicular axes and a position vector to define the camera space we can create our own LookAt matrix:

```text
           | Rx  Ry  Rz  0 |   | 1  0  0  -Px |
LookAt  =  | Ux  Uy  Uz  0 | * | 0  1  0  -Py |
           | Dx  Dy  Dz  0 |   | 0  0  1  -Pz |
           | 0   0   0   1 |   | 0  0  0   1  |
```

Where *R* is the right vector, *U* is the up vector, *D* is the direction vector and *P* is the camera's position
vector. Note that the rotation (left matrix) and translation (right matrix) parts are inverted (transposed and
negated respectively) since we want to rotate and translate the world in the opposite direction of where we want
the camera to move. Using this LookAt matrix as our view matrix effectively transforms all the world coordinates to
the view space we just defined. The LookAt matrix then does exactly what it says: it creates a view matrix that
*looks* at a given target.

:::opengl
Luckily for us, GLM already does all this work for us. We only have to specify a camera position, a target position
and a vector that represents the up vector in world space (the up vector we used for calculating the right vector).
GLM then creates the LookAt matrix that we can use as our view matrix:

```cpp
glm::mat4 view;
view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f),
                   glm::vec3(0.0f, 0.0f, 0.0f),
                   glm::vec3(0.0f, 1.0f, 0.0f));
```

The `glm::lookAt` function requires a position, target and up vector respectively. In the project, replace the
translation in the render loop with this call:

```cpp
        // camera/view transformation: a camera at (0, 0, 3) looking at the origin, with +y as up
        view       = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
Luckily for us, GLM already does all this work for us – and it works for Vulkan exactly as for OpenGL, because the
view matrix only moves the world into camera space; the differences between the APIs (depth from 0 to 1, y pointing
down in clip space) are handled by the projection matrix, which the project already adjusts with
`GLM_FORCE_DEPTH_ZERO_TO_ONE` and `ubo.proj[1][1] *= -1`. We only have to specify a camera position, a target
position and a vector that represents the up vector in world space (the up vector we used for calculating the right
vector). You may remember `glm::lookAt` from vulkan-tutorial's *Uniform buffers* chapter, which looks at its
rectangle from (2, 2, 2) with **z** as the up axis; we keep learnopengl's convention, where y is up.

In `updateUniformBuffer()`, replace the translation with this call:

```cpp
        // camera/view transformation: a camera at (0, 0, 3) looking at the origin, with +y as up
        ubo.view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```

The `glm::lookAt` function requires a position, target and up vector respectively.
:::
:::d3d12
Luckily for us, DirectXMath already does all this work for us. `XMMatrixLookAtRH(EyePosition, FocusPosition,
UpDirection)` takes the camera position, the target position and a vector that represents the up vector in world
space (the up vector we used for calculating the right vector), and returns the LookAt matrix for a right-handed
coordinate system – the counterpart of GLM's `glm::lookAt`. DirectXMath multiplies row vectors (`v * M`), so the
`XMMATRIX` it returns is the transpose of the matrix above: R, U and D are its columns and the translation sits in its
last row. The maths is the same.

In `OnUpdate`, replace the translation with a look-at matrix:

```cpp
    // The view matrix: a camera at (0, 0, 3) looking at the origin, with +y as up.
    // The *RH functions use a right-handed system like OpenGL: +z points out of the
    // screen, towards you.
    XMMATRIX view = XMMatrixLookAtRH(XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
```

> Don't mix up `XMMatrixLookAtRH` and `XMMatrixLookAtLH`. The LH version builds a view matrix for a left-handed
> system in which the camera looks down +z; combined with the project's right-handed `XMMatrixPerspectiveFovRH` the
> scene would end up behind the camera.
:::

Now do the first task, **look-at**. When you build and run it, *nothing* changes – and that is the point. As we saw
above, a camera at (0, 0, 3) looking at the origin with +y as up has the world's x, y and z axes as its right, up and
direction vectors. The rotation part of the LookAt matrix is then the identity matrix, and what remains is a
translation by -cameraPos = (0, 0, -3): exactly the matrix you had before.

```quiz
After the task **look-at** the picture is identical to before. Why does a look-at matrix from (0, 0, 3) towards the origin, with (0, 1, 0) as up, equal a translation by (0, 0, -3)?
- [ ] The look-at function ignores its target when the target is the origin
- [ ] The two matrices are different, but the difference is too small to see in an 800×600 window
- [x] The camera's right, up and direction vectors are the world's x, y and z axes, so the rotation part is the identity and only the translation by -cameraPos is left
---
The LookAt matrix is a rotation (the camera's axes as rows) times a translation by the negated position. With the camera's axes equal to the world's axes the rotation does nothing, so the matrices are exactly equal – not just similar.
```

Before delving into user input, let's get a little funky first by rotating the camera around our scene. We keep the
target of the scene at (0, 0, 0). We use a little bit of trigonometry to create an x and z coordinate each frame that
represents a point on a circle and we'll use these for our camera position. By re-calculating the x and z coordinate
over time we're traversing all the points in a circle and thus the camera rotates around the scene. We enlarge this
circle by a pre-defined `radius` and create a new view matrix each frame using the time:

:::opengl
```cpp
        // camera/view transformation: the camera circles the scene, always looking at the origin
        float radius = 10.0f;
        float camX = static_cast<float>(sin(glfwGetTime()) * radius);
        float camZ = static_cast<float>(cos(glfwGetTime()) * radius);
        view       = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
```cpp
        // camera/view transformation: the camera circles the scene, always looking at the origin
        float radius = 10.0f;
        float camX = static_cast<float>(std::sin(glfwGetTime()) * radius);
        float camZ = static_cast<float>(std::cos(glfwGetTime()) * radius);
        ubo.view = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```

`glfwGetTime()` returns the seconds since GLFW was initialized – the same clock OpenGL programs use.
:::
:::d3d12
`OnUpdate` needs the time for this. There is no `glfwGetTime()` in a Win32 program, so we measure the seconds since
the first frame with `std::chrono`, as the project already does for the turning cubes in `PopulateCommandList`:

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // The view matrix: the camera circles the scene at a distance of 10 (in the
    // xz plane), always looking at the origin, with +y as up.
    float radius = 10.0f;
    float camX = std::sin(time) * radius;
    float camZ = std::cos(time) * radius;
    XMMATRIX view = XMMatrixLookAtRH(XMVectorSet(camX, 0.0f, camZ, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
```
:::

Now do the task **circle**. The camera now orbits the scene at a distance of 10, one full turn every 2π ≈ 6.3
seconds, and always looks at the origin: cube 0 stays in the centre of the window while the other crates – much
smaller now – swing around it. At t = 0 the camera is at (0, 0, 10), in front of the scene; one second later it is at
(8.4, 0, 5.4), and all crates have moved into the right half of the window. Run it for a while in the simulator and
watch the scene turn.

The view matrix is rebuilt every frame, and every frame it has to reach the vertex shader again:

:::opengl
It is the `view` uniform of `shader.vs` (`uniform mat4 view;`), set right after it is computed:

```cpp
        // pass transformation matrices to the shader
        ourShader.setMat4("view", view);
```

A uniform keeps its value until you set it again, so setting it once per frame – before the draws – is enough.
:::
:::vulkan
It is the `view` member of the `UniformBufferObject` in the uniform buffer (binding 2 in `shader.vert`).
`drawFrame()` calls `updateUniformBuffer()` every frame, after waiting for the fence, and it copies the new matrices
into the persistently mapped buffer:

```cpp
        memcpy(uniformBufferMapped, &ubo, sizeof(ubo));
```

The project has a single frame in flight, so the GPU has finished the previous frame (and its reads of the buffer)
before the CPU overwrites it.
:::
:::d3d12
It is the `view` member of `SceneConstantBuffer` (`cbuffer SceneConstantBuffer : register(b1)` in
`shaders.hlsl`). At the end of `OnUpdate` the matrix is copied into the constant buffer, transposed like the model
matrix:

```cpp
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

`OnRender` waits until the GPU has finished each frame, so the GPU is not reading the buffer while `OnUpdate`
writes it.
:::

## Walk around

Swinging the camera around a scene is fun, but it's more fun to do all the movement ourselves! First we need to set
up a camera system, so it is useful to define some camera variables at the top of our program:

:::opengl
```cpp
// camera
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

They go under the settings, before `main`: global variables, so that the input functions you will write can change
them. The `LookAt` function now becomes:

```cpp
        // camera/view transformation: look from cameraPos in the direction of cameraFront
        view       = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
```
:::
:::vulkan
```cpp
// camera
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

As in learnopengl, they are global variables at file scope, before the `PushConstants` struct and the
`HelloTriangleApplication` class – the GLFW callbacks you will write later are plain functions and can reach them
there. The `LookAt` call in `updateUniformBuffer()` now becomes:

```cpp
        // camera/view transformation: look from cameraPos in the direction of cameraFront
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
```
:::
:::d3d12
```cpp
// The camera: where it is, the direction it looks in, and which way is up. Globals,
// so that OnUpdate and the window's message handler can both use them.
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f,  3.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

They go before `class D3D12App`. The view matrix in `OnUpdate` now becomes:

```cpp
    // The view matrix: look from cameraPos in the direction of cameraFront.
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
```

DirectXMath overloads the arithmetic operators for `XMVECTOR` (`+`, `-`, `*` with a float, `+=`, `-=`), so the code
reads like the GLM version. There is also `XMMatrixLookToRH(cameraPos, cameraFront, cameraUp)`, which takes the
direction directly – Microsoft's samples use it in their `SimpleCamera` class – and gives the same matrix.
:::

First we set the camera position to the previously defined `cameraPos`. The direction is the current position + the
direction vector we just defined. This ensures that however we move, the camera keeps looking at the target
direction. Note that `cameraFront` points the way the camera *looks*, (0, 0, -1) – unlike the direction vector of the
previous sections, which pointed backwards – and that `cameraUp` here is simply the world's up vector; the look-at
function computes the camera's real up axis from it.

Now do the task **free-camera**: add the three variables and replace the circling camera (its `radius`, `camX` and
`camZ` go away) with the look-at above. The default picture is back – the camera stands still at (0, 0, 3) looking
down -z – and from now on the camera only moves when its variables change.

Let's play a bit with these variables by updating the `cameraPos` vector when we press some keys.

:::opengl
We already defined a `processInput` function to manage GLFW's keyboard input, so let's add a few extra key
commands. Each `glfwGetKey` call asks GLFW whether a key is held down right now:

```cpp
    float cameraSpeed = static_cast<float>(2.5 * deltaTime);
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        cameraPos += cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        cameraPos -= cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
```
:::
:::vulkan
The Vulkan project has no `processInput` function yet, so we add one as a member of `HelloTriangleApplication`,
modelled on learnopengl's. Each `glfwGetKey` call asks GLFW whether a key is held down right now. Escape closes the
window – you will need that once the mouse is captured:

```cpp
    void processInput() {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        float cameraSpeed = 2.5f * deltaTime; // units per second, the same speed at any frame rate
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
            cameraPos += cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
            cameraPos -= cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
            cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
            cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
    }
```

`mainLoop()` calls it every frame, right after `glfwPollEvents()` has processed the window's events.
:::
:::d3d12
A Win32 program does not ask whether a key is down; Windows *tells* the window, with messages. `WM_KEYDOWN` arrives
when a key goes down (and repeats while it is held), `WM_KEYUP` when it is released. To know which keys are held –
what `glfwGetKey` tells a GLFW program – we keep an array, indexed by the key's *virtual-key code*. For letter keys
that code is the capital letter: `'W'` is 0x57.

```cpp
// Which keys are held down, by virtual-key code ('W', VK_UP ...). WindowProc keeps it up to date.
bool keys[256] = {};
```

`WindowProc` keeps it up to date (Escape still closes the window):

```cpp
    case WM_KEYDOWN:
        // Escape closes the window; any key pressed is held down until its WM_KEYUP.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        keys[static_cast<UINT8>(wParam)] = true;
        return 0;

    case WM_KEYUP:
        keys[static_cast<UINT8>(wParam)] = false;
        return 0;
```

and `OnUpdate`, which runs once per frame, moves the camera:

```cpp
    float cameraSpeed = 2.5f * deltaTime;
    if (keys['W'])
        cameraPos += cameraSpeed * cameraFront;
    if (keys['S'])
        cameraPos -= cameraSpeed * cameraFront;
    if (keys['A'])
        cameraPos -= XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;
    if (keys['D'])
        cameraPos += XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;
```

Microsoft's samples do the same in their `SimpleCamera` class: `OnKeyDown`/`OnKeyUp` record which keys are pressed,
and `Update(elapsedSeconds)` moves the camera once per frame.
:::

Whenever we press one of the WASD keys, the camera's position is updated accordingly. If we want to move forward or
backwards we add or subtract the direction vector from the position vector scaled by some speed value. If we want to
move sideways we do a cross product to create a *right* vector and we move along the right vector accordingly. This
creates the familiar *strafe* effect when using the camera.

> Note that we normalize the resulting right vector. If we wouldn't normalize this vector, the resulting cross
> product may return differently sized vectors based on the `cameraFront` variable. If we would not normalize the
> vector we would move slow or fast based on the camera's orientation instead of at a consistent movement speed.

Don't write this code just yet: it uses a `deltaTime` that doesn't exist. Where it comes from is the topic of the
next section.

## Movement speed

learnopengl's first version of this code uses a constant `cameraSpeed` of 0.05 units per frame. That works, but
graphics applications and games usually keep track of a *deltatime* variable that stores the time it took to render the last
frame, and there's a good reason. In practice people have different processing powers and the result of that is that
some people are able to render much more frames than others each second. Whenever a user renders more frames than
another user he also calls the input code more often. The result is that some people move really fast and some
really slow depending on their setup. When shipping your application you want to make sure it runs the same on all
kinds of hardware.

We then multiply all velocities with this `deltaTime` value. The result is that when we have a large `deltaTime` in
a frame, meaning that the last frame took longer than average, the velocity for that frame will also be a bit higher
to balance it all out. When using this approach it does not matter if you have a very fast or slow pc, the velocity
of the camera will be balanced out accordingly so each user will have the same experience.

To calculate the `deltaTime` value we keep track of 2 global variables:

:::opengl vulkan
```cpp
// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;
```
:::

:::opengl
Within each frame we then calculate the new `deltaTime` value for later use, at the start of the render loop:

```cpp
        // per-frame time logic
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;
```
:::
:::vulkan
Within each frame we then calculate the new `deltaTime` value in `mainLoop()`, before the events are polled and the
input is processed:

```cpp
        while (!glfwWindowShouldClose(window)) {
            // per-frame time logic
            float currentFrame = static_cast<float>(glfwGetTime());
            deltaTime = currentFrame - lastFrame;
            lastFrame = currentFrame;

            glfwPollEvents();
            processInput();
            drawFrame();
        }
```
:::
:::d3d12
In `OnUpdate` the time since the last frame comes from `std::chrono`. A `static` local is initialized only on the
first call, so `lastFrame` starts at the first frame and then keeps the previous frame's time:

```cpp
    // Per-frame time logic: deltaTime is the time since the last frame, in seconds.
    static auto lastFrame = std::chrono::high_resolution_clock::now();
    auto currentFrame = std::chrono::high_resolution_clock::now();
    float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();
    lastFrame = currentFrame;
```

This goes at the very start of `OnUpdate`, before the movement code. The main loop in `wWinMain` calls `OnUpdate`
and `OnRender` whenever no window messages are waiting, so every frame first sees the keys that changed since the
last one.
:::

Now that we have `deltaTime` we can take it into account when calculating the velocities: `cameraSpeed` is
2.5 × `deltaTime`, which makes the camera move 2.5 units per second, however fast the frames come.

Now do the task **wasd**. Without keys, nothing visible changes – the simulator shows the default picture. On your
own computer, holding W moves the camera forward into the scene (the crates grow), S back, A left and D right, the
same distance per second at any frame rate. Together with the previous section we now have a much smoother and more
consistent camera system for moving around the scene.

```quiz
One computer runs the program at 30 frames per second, another at 120. On both, the user holds W for exactly one second. How far does the camera move?
- [ ] 2.5 units at 30 fps, 10 units at 120 fps
- [x] 2.5 units on both: each frame moves 2.5 × deltaTime, and the deltaTimes of one second add up to one second
- [ ] 2.5 units at 120 fps, 0.625 units at 30 fps
---
With a fixed step per frame, the faster computer would run the input code four times as often and move four times as far. Multiplying by deltaTime turns the speed into units per second: many short frames each move a little, few long frames each move more.
```

## Look around

Only using the keyboard keys to move around isn't that interesting. Especially since we can't turn around making the
movement rather restricted. That's where the mouse comes in!

To look around the scene we have to change the `cameraFront` vector based on the input of the mouse. However,
changing the direction vector based on mouse rotations is a little complicated and requires some trigonometry. If
you do not understand the trigonometry, don't worry, you can just skip to the code sections and paste them in your
code; you can always come back later if you want to know more.

## Euler angles

Euler angles are 3 values that can represent any rotation in 3D, defined by Leonhard Euler somewhere in the 1700s.
There are 3 Euler angles: *pitch*, *yaw* and *roll*:

- The **pitch** is the angle that depicts how much we're looking up or down – a rotation around the camera's right
  axis.
- The **yaw** represents the magnitude we're looking to the left or to the right – a rotation around the up axis.
- The **roll** represents how much we roll, as mostly used in space-flight cameras – a rotation around the direction
  of view.

Each of the Euler angles are represented by a single value and with the combination of all 3 of them we can
calculate any rotation vector in 3D. For our camera system we only care about the yaw and pitch values so we won't
discuss the roll value here.

Given a pitch and a yaw value we can convert them into a 3D vector that represents a new direction vector. The
process of converting yaw and pitch values to a direction vector requires a bit of trigonometry. Picture a
right-angled triangle whose hypotenuse has length 1, with an angle θ where the hypotenuse meets the adjacent side.
From trigonometry (*soh cah toa*) we know that the adjacent side's length is cos θ / h = cos θ / 1 = **cos θ** and
that the opposite side's length is sin θ / h = sin θ / 1 = **sin θ**. This gives us some general formulas for
retrieving the length of both sides of a right triangle, depending on the given angle.

Let's first look at the yaw. Imagine looking from above onto the xz-plane: the direction vector lies flat in that
plane, and the yaw is its angle measured from the x-axis. Its x component is then `cos(yaw)` and its z component
`sin(yaw)`:

```text
direction.x = cos(yaw)
direction.z = sin(yaw)
```

Now imagine looking at the same triangle from the side: the pitch tilts the vector up or down out of the xz-plane.
Its y component is `sin(pitch)`, and the part that is left in the xz-plane shrinks to `cos(pitch)`. Both the x and
the z component are scaled by that, which gives us the final direction vector:

```text
direction.x = cos(yaw) * cos(pitch)
direction.y = sin(pitch)
direction.z = sin(yaw) * cos(pitch)
```

:::opengl vulkan
The angles are kept in degrees, but `sin` and `cos` expect radians, so the code converts them first with
`glm::radians`.
:::
:::d3d12
The angles are kept in degrees, but `std::sin` and `std::cos` expect radians, so the code converts them first with
`XMConvertToRadians`, DirectXMath's version of `glm::radians`.
:::

This gives us a formula to convert yaw and pitch values to a 3-dimensional direction vector that we can use for
looking around.

We've set up the scene world so everything's positioned in the direction of the negative z-axis. However, if we look
at the x and z yaw triangle we see that a yaw of 0 results in the camera's direction vector to point towards the
positive x-axis. To make sure the camera points towards the negative z-axis by default we give the yaw a default
value of -90 degrees, a quarter turn from +x towards -z (cos(-90°) = 0, sin(-90°) = -1):

```cpp
float yaw = -90.0f;
```

You've probably wondered by now: how do we set and modify these yaw and pitch values?

```quiz
With yaw = 0° and pitch = 0° the formula gives the direction (cos 0 · cos 0, sin 0, sin 0 · cos 0). Where would the camera look, and why does the code start with yaw = -90°?
- [ ] Along -z; yaw = -90° turns the camera upside down to match the window's y axis
- [x] Along +x, to the right; yaw = -90° gives (0, 0, -1), the direction the camera looked before
- [ ] Straight up along +y; -90° tilts it down to the horizon
---
cos 0 = 1 and sin 0 = 0, so the direction is (1, 0, 0). With yaw = -90°, cos(-90°) = 0 and sin(-90°) = -1: the direction is (0, 0, -1), down the negative z-axis, so the scene looks the same as before the mouse code was added.
```

## Mouse input

The yaw and pitch values are obtained from mouse (or controller/joystick) movement where horizontal mouse-movement
affects the yaw and vertical mouse-movement affects the pitch. The idea is to store the last frame's mouse positions
and calculate in the current frame how much the mouse values changed. The higher the horizontal or vertical
difference, the more we update the pitch or yaw value and thus the more the camera should move.

:::opengl vulkan
First we will tell GLFW that it should hide the cursor and *capture* it. Capturing a cursor means that, once the
application has focus, the mouse cursor stays within the center of the window (unless the application loses focus
or quits). We can do this with one simple configuration call:

```cpp
    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```

After this call, wherever we move the mouse it won't be visible and it should not leave the window. This is perfect
for an FPS camera system. In GLFW's own words, `GLFW_CURSOR_DISABLED` "hides and grabs the cursor, providing virtual
and unlimited cursor movement": the reported position keeps growing past the window's edges, so you can keep
turning in one direction.

To calculate the pitch and yaw values we need to tell GLFW to listen to mouse-movement events. We do this by creating
a callback function with the following prototype:

```cpp
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
```

Here `xpos` and `ypos` represent the current mouse positions. As soon as we register the callback function with
GLFW each time the mouse moves, the `mouse_callback` function is called:

```cpp
    glfwSetCursorPosCallback(window, mouse_callback);
```
:::
:::d3d12
Win32 has no "disabled cursor" mode like GLFW's, so we build one from three pieces:

- `ShowCursor(FALSE)` hides the cursor. The project calls it once, right after `ShowWindow`.
- Windows sends `WM_MOUSEMOVE` to the window whenever the cursor moves over it. Its `lParam` holds the cursor's
  position in the client area, in pixels from the top left. Read it with `GET_X_LPARAM` and `GET_Y_LPARAM` from
  `<windowsx.h>`, not with `LOWORD`/`HIWORD`: the coordinates can be negative on systems with several monitors.
- After each move we put the cursor back into the middle of the window with `SetCursorPos`, so it never reaches an
  edge – like GLFW's captured cursor, the mouse can keep turning the camera in one direction.

```cpp
        // Hide the cursor over the window: the mouse turns the camera now.
        ShowCursor(FALSE);
```

The maths goes into a free function `OnMouseMove(float xpos, float ypos)` – the counterpart of learnopengl's
`mouse_callback` – which `WindowProc` calls for every `WM_MOUSEMOVE`.

> Games often read mouse look from *raw input* (`WM_INPUT`) instead, which reports the mouse's own movement rather
> than cursor positions. The cursor approach here stays closer to learnopengl and needs no extra setup.
:::

When handling mouse input for a fly style camera there are several steps we have to take before we're able to fully
calculate the camera's direction vector:

1. Calculate the mouse's offset since the last frame.
2. Add the offset values to the camera's yaw and pitch values.
3. Add some constraints to the minimum/maximum pitch values.
4. Calculate the direction vector.

The first step is to calculate the offset of the mouse since last frame. We first have to store the last mouse
positions in the application, which we initialize to be in the center of the screen (screen size is 800 by 600)
initially:

:::opengl d3d12
```cpp
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```
:::
:::vulkan
```cpp
float lastX =  WIDTH / 2.0f;
float lastY =  HEIGHT / 2.0f;
```
:::

Then in the mouse's callback function we calculate the offset movement between the last and current frame:

```cpp
    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;
```

Note that we multiply the offset values by a `sensitivity` value. If we omit this multiplication the mouse movement
would be way too strong; fiddle around with the sensitivity value to your liking. The y offset is reversed because
window coordinates grow *downwards*: moving the mouse up makes `ypos` smaller, and we want that to look up – a
positive pitch.

Next we add the offset values to the globally declared `pitch` and `yaw` values:

```cpp
    yaw += xoffset;
    pitch += yoffset;
```

In the third step we'd like to add some constraints to the camera so users won't be able to make weird camera
movements (also causes a LookAt flip once direction vector is parallel to the world up direction). The pitch needs
to be constrained in such a way that users won't be able to look higher than 89 degrees (at 90 degrees we get the
LookAt flip) and also not below -89 degrees. This ensures the user will be able to look up to the sky or below to his
feet but not further. At exactly ±90 degrees the direction would be parallel to the up vector, their cross product –
the camera's right vector – would be zero, and the look-at matrix would no longer be defined. The constraints work by
replacing the Euler value with its constraint value whenever it breaches the constraint:

```cpp
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;
```

Note that we set no constraint on the yaw value since we don't want to constrain the user in horizontal rotation.
However, it's just as easy to add a constraint to the yaw as well if you feel like it.

The fourth and last step is to calculate the actual direction vector using the formula from the previous section,
and to store it, normalized, in `cameraFront`. The `W` key then walks wherever you look.

If you now run the code you'll notice the camera makes a large sudden jump whenever the window first receives focus
of your mouse cursor. The cause for this sudden jump is that as soon as your cursor enters the window the mouse
callback function is called with an `xpos` and `ypos` position equal to the location your mouse entered the screen
from. This is often a position that is significantly far away from the center of the screen, resulting in large
offsets and thus a large movement jump. We can circumvent this issue by defining a global `bool` variable to check if
this is the first time we receive mouse input. If it is the first time, we update the initial mouse positions to the
new `xpos` and `ypos` values. The resulting mouse movements will then use the newly entered mouse's position
coordinates to calculate the offsets:

```cpp
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }
```

The final code then becomes:

:::opengl
```cpp
// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    glm::vec3 front;
    front.x = cos(glm::radians(yaw)) * cos(glm::radians(pitch));
    front.y = sin(glm::radians(pitch));
    front.z = sin(glm::radians(yaw)) * cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}
```

It goes at the end of `main.cpp`, with a declaration next to the other ones at the top of the file. The globals go
under the camera vectors:

```cpp
bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```

and the two GLFW calls go right after `glfwSetFramebufferSizeCallback`:

```cpp
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);

    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```
:::
:::vulkan
```cpp
// glfw: whenever the mouse moves, this callback is called
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn) {
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse) {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since window y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f) {
        pitch = 89.0f;
    }
    if (pitch < -89.0f) {
        pitch = -89.0f;
    }

    glm::vec3 front;
    front.x = std::cos(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    front.y = std::sin(glm::radians(pitch));
    front.z = std::sin(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}
```

The callback is a free function at file scope, before the `PushConstants` struct, under these globals:

```cpp
bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  WIDTH / 2.0f;
float lastY =  HEIGHT / 2.0f;
```

GLFW calls plain C functions; it cannot call a member function of `HelloTriangleApplication`. vulkan-tutorial
solves that for its resize callback with `glfwSetWindowUserPointer`, which stores a pointer to the application in the
window so that a static callback can get it back with `glfwGetWindowUserPointer`. With the camera state in globals,
as in learnopengl, we don't need it. In `initWindow()`, register the callback and capture the cursor right after the
window is created:

```cpp
        window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
        glfwSetCursorPosCallback(window, mouse_callback);

        // tell GLFW to capture our mouse
        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```

GLFW calls the callback from inside `glfwPollEvents()`, so `cameraFront` is up to date before `drawFrame()` builds
the view matrix.
:::
:::d3d12
```cpp
// Mouse look: WindowProc calls this whenever the mouse moves, with the cursor's
// position in the window's client area (in pixels from its top left corner).
void OnMouseMove(float xpos, float ypos)
{
    // The first time, the cursor can be anywhere: start from there instead of
    // jumping from (lastX, lastY).
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;    // reversed since y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f;    // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // Make sure that when pitch is out of bounds, the screen doesn't get flipped.
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    XMVECTOR front = XMVectorSet(
        std::cos(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        0.0f);
    cameraFront = XMVector3Normalize(front);
}
```

It goes before `WindowProc` (the comment `// Main message handler for the window.`), and the globals go under
`keys`:

```cpp
// Mouse look: the camera's direction as two angles, in degrees.
bool firstMouse = true;
float yaw   = -90.0f;    // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```

`WindowProc` gets a new case. It only reacts while our window is the foreground window, so after Alt+Tab the mouse
is free again. It hands the position to `OnMouseMove` and then captures the cursor:

```cpp
    case WM_MOUSEMOVE:
        // Only while the window is the active one, so the mouse is free otherwise.
        if (GetForegroundWindow() == hWnd)
        {
            int xpos = GET_X_LPARAM(lParam);
            int ypos = GET_Y_LPARAM(lParam);
            OnMouseMove(static_cast<float>(xpos), static_cast<float>(ypos));

            // Capture the cursor: put it back in the middle of the window, so it never
            // reaches an edge. lastX and lastY move with it, so the jump does not turn
            // the camera (the WM_MOUSEMOVE it causes has an offset of 0).
            RECT clientRect = {};
            GetClientRect(hWnd, &clientRect);
            POINT centre = { clientRect.right / 2, clientRect.bottom / 2 };
            if (xpos != centre.x || ypos != centre.y)
            {
                lastX = static_cast<float>(centre.x);
                lastY = static_cast<float>(centre.y);
                ClientToScreen(hWnd, &centre);
                SetCursorPos(centre.x, centre.y);
            }
        }
        return 0;
```

`GetClientRect` gives the client area's size, `ClientToScreen` turns the centre into screen coordinates, which is
what `SetCursorPos` expects. Moving the cursor makes Windows send another `WM_MOUSEMOVE`, at the centre; because
`lastX` and `lastY` were set to the centre first, its offset is 0. Finally, add `#include <windowsx.h>` under
`#include <windows.h>` for `GET_X_LPARAM` and `GET_Y_LPARAM`.
:::

Now do the task **mouse-look**. Without mouse movement the default picture stays.

:::opengl vulkan
GLFW may report the cursor's position once when it is captured, but thanks to `firstMouse` that only sets `lastX` and
`lastY`, and the recomputed `cameraFront` differs from (0, 0, -1) only by rounding.
:::
:::d3d12
`cameraFront` keeps its value (0, 0, -1) until the first `WM_MOUSEMOVE`, and thanks to `firstMouse` even that one
only sets `lastX` and `lastY`.
:::

On your own computer the cursor disappears, moving the mouse right turns the view right (the scene slides left),
moving it up looks up – but never beyond ±89° – and W now walks where you look.

:::opengl vulkan
```quiz
What does `glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED)` do for mouse look?
- [ ] It turns the cursor-position callback off until the user clicks into the window
- [ ] It pins the cursor to the window's centre, so `mouse_callback` always receives 400 and 300
- [x] It hides the cursor and keeps it in the window; GLFW reports a virtual, unlimited cursor position, so the camera can keep turning without the cursor stopping at the window's edge
---
The positions passed to `mouse_callback` keep changing – that is how the callback computes its offsets – but they are no longer limited by the window. Without capturing, the cursor would stop at the screen's edge and the camera with it.
```
:::
:::d3d12
```quiz
The `WM_MOUSEMOVE` handler puts the cursor back into the window's centre with `SetCursorPos`, and before that sets `lastX` and `lastY` to the centre. Why move `lastX` and `lastY` too?
- [ ] It sets `firstMouse` back to `true`, so the next move starts fresh
- [x] `SetCursorPos` causes another `WM_MOUSEMOVE` at the centre; with `lastX`/`lastY` already there its offset is 0, so the jump back doesn't turn the camera
- [ ] `SetCursorPos` only moves the cursor to the position stored in `lastX` and `lastY`
---
Without it, every real movement would be followed by an equally large movement back to the centre, and the camera would turn back to where it was.
```
:::

## Zoom

As a little extra to the camera system we'll also implement a zooming interface. In the previous chapter we said
the *Field of view* or *fov* largely defines how much we can see of the scene. When the field of view becomes
smaller, the scene's projected space gets smaller. This smaller space is projected over the same NDC, giving the
illusion of zooming in. To zoom in, we're going to use the mouse's scroll wheel.

:::opengl
Similar to mouse movement and keyboard input we have a callback function for mouse scrolling:

```cpp
// glfw: whenever the mouse scroll wheel scrolls, this callback is called
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    fov -= (float)yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}
```

It goes at the end of `main.cpp`, with a declaration at the top next to the others.
:::
:::vulkan
Similar to mouse movement and keyboard input we have a callback function for mouse scrolling, again a free function
before the `PushConstants` struct:

```cpp
// glfw: whenever the mouse scroll wheel scrolls, this callback is called
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    fov -= static_cast<float>(yoffset);
    if (fov < 1.0f) {
        fov = 1.0f;
    }
    if (fov > 45.0f) {
        fov = 45.0f;
    }
}
```
:::
:::opengl vulkan
When scrolling, the `yoffset` value tells us the amount we scrolled vertically – positive when the wheel turns up,
away from you. When the `scroll_callback` function is called we change the content of the globally declared `fov`
variable, which starts at 45 and goes under `lastY`:

```cpp
float fov   =  45.0f;
```

Since 45 is the default fov value we want to constrain the zoom level between 1.0 and 45.0. We also have to register
the scroll callback function, right after the cursor-position callback:

```cpp
    glfwSetScrollCallback(window, scroll_callback);
```
:::
:::d3d12
Windows reports the scroll wheel with `WM_MOUSEWHEEL`. The high word of its `wParam` – read it with
`GET_WHEEL_DELTA_WPARAM` – is the distance the wheel turned, in multiples of `WHEEL_DELTA` (120) per notch: positive
when it turns away from you, negative towards you. Dividing by `WHEEL_DELTA` gives learnopengl's `yoffset` of 1 per
notch (wheels with a finer resolution send smaller values):

```cpp
    case WM_MOUSEWHEEL:
        // One notch of the wheel is WHEEL_DELTA (120); a fine wheel sends less.
        OnMouseWheel(static_cast<float>(GET_WHEEL_DELTA_WPARAM(wParam)) / WHEEL_DELTA);
        return 0;
```

`OnMouseWheel`, next to `OnMouseMove`, changes the globally declared `fov`, which starts at 45:

```cpp
// Zoom: WindowProc calls this when the mouse wheel turns, with the number of notches
// (positive: turned away from you, which zooms in).
void OnMouseWheel(float yoffset)
{
    fov -= yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}
```

```cpp
// Zoom: the field of view, in degrees.
float fov   =  45.0f;
```

Since 45 is the default fov value we want to constrain the zoom level between 1.0 and 45.0.
:::

We now have to upload the perspective projection matrix to the GPU each frame, but this time with the `fov` variable
as its field of view:

:::opengl
```cpp
        projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
```

The project already sets the projection every frame. The old note above `ourShader.setMat4("projection", projection)`,
which suggested setting it only once outside the loop, no longer applies: replace it with a comment that the
projection now changes whenever fov changes (zoom), so it is set every frame.
:::
:::vulkan
```cpp
        ubo.proj = glm::perspective(glm::radians(fov), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
```

`updateUniformBuffer()` already rebuilds both matrices every frame, so this is the only change.
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(fov), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);
```

`OnUpdate` already rebuilds the projection every frame, so this is the only change there.
:::

Now do the task **zoom**. Without scrolling, fov stays 45 and you see the default picture. On your own computer,
scrolling up zooms in (a smaller fov, bigger crates) down to a field of view of 1°, and scrolling down zooms out
again, at most back to 45°. And there you have it: a simple camera system that allows for free movement in a 3D
environment.

```quiz
Scrolling up three notches changes `fov` from 45 to 42. What happens to the picture?
- [ ] Nothing, until the program is restarted and the projection matrix is created again
- [x] The crates look slightly bigger: a smaller field of view projects a smaller part of the scene onto the same window
- [ ] The crates look smaller, because a smaller field of view moves the camera back
---
The camera doesn't move – only the projection changes. A narrower view volume is stretched over the same normalized device coordinates, so everything in it is drawn larger. Because the projection matrix is rebuilt every frame from `fov`, the change shows at once.
```

Feel free to experiment a little and if you're stuck compare your code with the solution.

> Note that a camera system using Euler angles is still not a perfect system. Depending on your constraints and your
> setup it could still introduce a Gimbal lock problem. The best camera system would be developed using quaternions
> but we'll leave that to a later topic.

## Camera class

In the upcoming chapters we'll always use a camera to easily look around the scenes and see the results from all
angles. However, since the camera code can take up a significant amount of space on each chapter we'll abstract its
details a little and create our own camera object that does most of the work for us with some neat little extras.
learnopengl does this with a `Camera` class in `camera.h`. This step is **optional** in this course: the projects keep
the globals and free functions you just wrote, so if you write the class, your pictures will be the same.

:::opengl vulkan
Just like the Shader object, the camera class is defined entirely in a single header file. In outline:

```cpp
// Defines several possible options for camera movement. Used as abstraction to stay away from window-system specific input methods
enum Camera_Movement {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT
};

// Default camera values
const float YAW         = -90.0f;
const float PITCH       =  0.0f;
const float SPEED       =  2.5f;
const float SENSITIVITY =  0.1f;
const float ZOOM        =  45.0f;

class Camera
{
public:
    // camera Attributes
    glm::vec3 Position;
    glm::vec3 Front;
    glm::vec3 Up;
    glm::vec3 Right;
    glm::vec3 WorldUp;
    // euler Angles
    float Yaw;
    float Pitch;
    // camera options
    float MovementSpeed;
    float MouseSensitivity;
    float Zoom;

    // returns the view matrix calculated using Euler Angles and the LookAt Matrix
    glm::mat4 GetViewMatrix()
    {
        return glm::lookAt(Position, Position + Front, Up);
    }

    void ProcessKeyboard(Camera_Movement direction, float deltaTime);
    void ProcessMouseMovement(float xoffset, float yoffset, bool constrainPitch = true);
    void ProcessMouseScroll(float yoffset);

private:
    // calculates the front vector from the Camera's (updated) Euler Angles
    void updateCameraVectors();
};
```

The bodies are the code you wrote: `ProcessKeyboard` moves `Position` by `MovementSpeed * deltaTime` along `Front`
or `Right`, `ProcessMouseMovement` applies the sensitivity, adds the offsets to `Yaw` and `Pitch` and clamps the
pitch, and `ProcessMouseScroll` changes `Zoom` between 1 and 45. One thing is new: `updateCameraVectors` also
computes the camera's own `Right` and `Up` vectors from `Front` and `WorldUp`:

```cpp
        Right = glm::normalize(glm::cross(Front, WorldUp));  // normalize the vectors, because their length gets closer to 0 the more you look up or down which results in slower movement.
        Up    = glm::normalize(glm::cross(Right, Front));
```

The program then keeps one `Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));`, uses `camera.GetViewMatrix()` and
`glm::radians(camera.Zoom)` for its matrices, calls `camera.ProcessKeyboard(FORWARD, deltaTime)` and friends from its
key handling, and passes the offsets to `camera.ProcessMouseMovement` and `camera.ProcessMouseScroll` from the GLFW
callbacks.
:::
:::vulkan
In the Vulkan project the natural home for it is a member `Camera camera;` of `HelloTriangleApplication`. The GLFW
callbacks can then reach it the way vulkan-tutorial's resize callback reaches the application: store `this` with
`glfwSetWindowUserPointer(window, this)` and get it back in the callback with
`reinterpret_cast<HelloTriangleApplication*>(glfwGetWindowUserPointer(window))`.
:::
:::d3d12
In DirectXMath the class looks the same: `XMVECTOR` members `Position`, `Front`, `Up`, `Right` and `WorldUp`, the
angles `Yaw` and `Pitch`, and the options `MovementSpeed`, `MouseSensitivity` and `Zoom`, with:

- `GetViewMatrix()` returning `XMMatrixLookAtRH(Position, Position + Front, Up)`;
- `ProcessKeyboard(direction, deltaTime)` moving `Position` along `Front` or `Right` by `MovementSpeed * deltaTime`;
- `ProcessMouseMovement(xoffset, yoffset)` applying the sensitivity, changing `Yaw` and `Pitch`, clamping the pitch
  and calling `updateCameraVectors()`;
- `ProcessMouseScroll(yoffset)` changing `Zoom` between 1 and 45;
- `updateCameraVectors()` computing `Front` from the angles, then
  `Right = XMVector3Normalize(XMVector3Cross(Front, WorldUp))` and `Up = XMVector3Normalize(XMVector3Cross(Right, Front))`.

A natural home for it is a member of `D3D12App`, with public `OnKeyDown`/`OnKeyUp`/`OnMouseMove`/`OnMouseWheel`
methods that `WindowProc` calls through the pointer stored with `SetWindowLongPtr(hwnd, GWLP_USERDATA, …)` – the way
Microsoft's samples hand input to their `SimpleCamera`. Note that `SimpleCamera` is a keyboard-only camera (the arrow
keys turn it) with its own yaw convention, so its code doesn't line up with this chapter line by line.
:::

A camera class gives you one place for all camera state and one interface, which is handy once several programs
share the same camera. The globals you wrote do exactly the same work, which is why the course keeps them.

## Exercises

- See if you can transform the camera so that it becomes a **true fps camera** where you cannot fly; you can only look
  around while staying on the xz plane.
- Try to create your **own LookAt function** where you manually create a view matrix as discussed at the start of
  this chapter. Replace the library's look-at function with your own implementation and see if it still acts the
  same. Try it with the circling camera too, where every frame gives a different matrix.

These are not tasks in the project: try them once you have finished the tasks, and use **Build & run** to compare
the pictures.

:::opengl vulkan
For the first exercise, set `cameraPos.y = 0.0f;` after the W/A/S/D checks – you can still look up and down, but
walking never leaves the ground.
:::
:::d3d12
For the first exercise, set `cameraPos = XMVectorSetY(cameraPos, 0.0f);` after the W/A/S/D checks in `OnUpdate` – you
can still look up and down, but walking never leaves the ground.
:::

:::opengl vulkan
For the second exercise, this is learnopengl's solution. GLM stores matrices column by column, so `mat[col][row]` is the element in column
`col` and row `row`:

```cpp
glm::mat4 calculate_lookAt_matrix(glm::vec3 position, glm::vec3 target, glm::vec3 worldUp)
{
    // 1. Position = known
    // 2. Calculate cameraDirection
    glm::vec3 zaxis = glm::normalize(position - target);
    // 3. Get positive right axis vector
    glm::vec3 xaxis = glm::normalize(glm::cross(glm::normalize(worldUp), zaxis));
    // 4. Calculate camera up vector
    glm::vec3 yaxis = glm::cross(zaxis, xaxis);

    // Create translation and rotation matrix
    // In glm we access elements as mat[col][row] due to column-major layout
    glm::mat4 translation = glm::mat4(1.0f); // Identity matrix by default
    translation[3][0] = -position.x; // Fourth column, first row
    translation[3][1] = -position.y;
    translation[3][2] = -position.z;
    glm::mat4 rotation = glm::mat4(1.0f);
    rotation[0][0] = xaxis.x; // First column, first row
    rotation[1][0] = xaxis.y;
    rotation[2][0] = xaxis.z;
    rotation[0][1] = yaxis.x; // First column, second row
    rotation[1][1] = yaxis.y;
    rotation[2][1] = yaxis.z;
    rotation[0][2] = zaxis.x; // First column, third row
    rotation[1][2] = zaxis.y;
    rotation[2][2] = zaxis.z;

    // Return lookAt matrix as combination of translation and rotation matrix
    return rotation * translation; // Remember to read from right to left (first translation then rotation)
}
```
:::
:::d3d12
For the second exercise, this is one way to write it in DirectXMath. Remember that DirectXMath works with row vectors, so the rotation is the
transpose of the matrix in the text (the axes become its columns), and the product is read from left to right:

```cpp
XMMATRIX MyLookAtRH(FXMVECTOR position, FXMVECTOR target, FXMVECTOR worldUp)
{
    XMVECTOR zaxis = XMVector3Normalize(position - target);                                // the camera direction
    XMVECTOR xaxis = XMVector3Normalize(XMVector3Cross(XMVector3Normalize(worldUp), zaxis)); // the right axis
    XMVECTOR yaxis = XMVector3Cross(zaxis, xaxis);                                          // the up axis

    // The three axes as rows, then transposed: as columns, for row vectors.
    XMMATRIX rotation = XMMatrixTranspose(XMMATRIX(xaxis, yaxis, zaxis, XMVectorSet(0.0f, 0.0f, 0.0f, 1.0f)));
    XMMATRIX translation = XMMatrixTranslationFromVector(-position);

    return translation * rotation; // row vectors: first the translation, then the rotation
}
```

It relies on the w components of the three axes being 0, which holds for vectors made with `XMVectorSet(…, 0.0f)` as
in the project.
:::

Congratulations – you can now fly through your scene. This is the last chapter of *Getting started*: you have a window, shaders,
textures, transformations, a 3D scene and a camera to look at it with – everything the coming chapters build on.
