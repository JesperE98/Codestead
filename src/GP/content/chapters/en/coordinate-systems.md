# Coordinate Systems

In the last chapter we learned how we can use matrices to our advantage by transforming all vertices with
transformation matrices. {{api}} expects all the vertices that we want to become visible to be in normalized device
coordinates after each vertex shader run. That is, the x, y and z coordinates of each vertex should be between `-1.0`
and `1.0` (for z, as you'll see, that depends on the API); coordinates outside this range will not be visible. What
we usually do is specify the coordinates in a range (or space) we determine ourselves and in the vertex shader
transform these coordinates to normalized device coordinates (NDC). These NDC are then given to the rasterizer to
transform them to 2D coordinates/pixels on your screen.

Transforming coordinates to NDC is usually accomplished in a step-by-step fashion where we transform an object's
vertices to several coordinate systems before finally transforming them to NDC. The advantage of transforming them
to several *intermediate* coordinate systems is that some operations/calculations are easier in certain coordinate
systems, as will soon become apparent. There are a total of 5 different coordinate systems that are of importance
to us:

- Local space (or Object space)
- World space
- View space (or Eye space)
- Clip space
- Screen space

Those are all a different state at which our vertices will be transformed in before finally ending up as fragments.

You're probably quite confused by now by what a space or coordinate system actually is, so we'll explain them in a
more high-level fashion first by showing the total picture and what each specific space represents.

:::opengl
This chapter's project is the result of *Transformations* with the transformation taken out again: the textured
container (80 % crate, 20 % face) lies flat in the middle of the window, and `shader.vs` writes
`gl_Position = vec4(aPos, 1.0);`. One thing is new: the shader class is now learnopengl's **`shader_m.h`** – the same
class as `shader_s.h`, with functions to set vectors and matrices added (`setVec2/3/4`, `setMat2/3/4`). The one we use
is `setMat4`:

```cpp
    void setMat4(const std::string &name, const glm::mat4 &mat) const
    {
        glUniformMatrix4fv(glGetUniformLocation(ID, name.c_str()), 1, GL_FALSE, &mat[0][0]);
    }
```
:::
:::vulkan
This chapter's project is the result of *Transformations* with the transformation code taken out again: the textured
container lies flat in the middle of the window, `shader.vert` writes `gl_Position = vec4(inPosition, 1.0);` and flips
y, and `recordCommandBuffer()` draws once without pushing anything. Kept from *Transformations*: the push constant
range in the pipeline layout and `struct PushConstants`, whose field is now called `glm::mat4 model`.

This chapter follows two parts of vulkan-tutorial: *Uniform buffers* and *Depth buffering*. Their new functions
already exist as empty stubs and are called from the right places: `createDepthResources()` in `initVulkan()` right
before `createFramebuffers()`, `createUniformBuffers()` after `createIndexBuffer()`, and `updateUniformBuffer()` in
`drawFrame()` right after `vkAcquireNextImageKHR`.
:::
:::d3d12
This chapter's project is the result of *Transformations* with the transformation code taken out again:
`PopulateCommandList()` draws the textured container once with `XMMATRIX model = XMMatrixIdentity();`, so it lies
flat in the middle of the window. The root constants at register `b0` are now called
`struct ModelConstants { XMFLOAT4X4 model; }` (`cbuffer ModelConstants : register(b0) { float4x4 model; }` in the
shader). The CBV/SRV descriptor heap is renamed `m_cbvSrvHeap` (with `m_cbvSrvDescriptorSize`), because it will hold
a constant buffer view next to the two textures' SRVs.

The constant buffer follows Microsoft's D3D12HelloConstBuffers sample, the depth buffer the way the other
D3D12 samples (for example D3D12Bundles) create theirs.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## The global picture

To transform the coordinates from one space to the next coordinate space we'll use several transformation matrices
of which the most important are the *model*, *view* and *projection* matrix. Our vertex coordinates first start in
*local space* as *local coordinates* and are then further processed to *world coordinates*, *view coordinates*,
*clip coordinates* and eventually end up as *screen coordinates*. The following picture shows the process and what
each transformation does:

```text
                  model             view              projection
  local space  ─────────▶  world  ─────────▶  view  ──────────────▶  clip space
  (object)                 space              space
                                                                         │
                                                      perspective divide │
                                                                         ▼
  screen space  ◀─────────────────────────────────────────────  normalized device
                         viewport transform                     coordinates (NDC)
```

1. Local coordinates are the coordinates of your object relative to its local origin; they're the coordinates your
   object begins in.
2. The next step is to transform the local coordinates to world-space coordinates which are coordinates in respect
   of a larger world. These coordinates are relative to some global origin of the world, together with many other
   objects also placed relative to this world's origin.
3. Next we transform the world coordinates to view-space coordinates in such a way that each coordinate is as seen
   from the camera or viewer's point of view.
4. After the coordinates are in view space we want to project them to clip coordinates. Clip coordinates are
   processed to the `-1.0` and `1.0` range (z: see below) and determine which vertices will end up on the screen.
   Projection to clip-space coordinates can add perspective if using perspective projection.
5. And lastly we transform the clip coordinates to screen coordinates in a process we call *viewport transform* that
   transforms the coordinates from `-1.0` and `1.0` to the coordinate range defined by the viewport. The resulting
   coordinates are then sent to the rasterizer to turn them into fragments.

You probably got a slight idea what each individual space is used for. The reason we're transforming our vertices
into all these different spaces is that some operations make more sense or are easier to use in certain coordinate
systems. For example, when modifying your object it makes most sense to do this in local space, while calculating
certain operations on the object with respect to the position of other objects makes most sense in world
coordinates and so on. If we want, we could define one transformation matrix that goes from local space to clip
space all in one go, but that leaves us with less flexibility.

The first three steps are yours: you write them as matrices and apply them in the vertex shader. The last two – the
perspective divide and the viewport transform – the GPU does for you after the vertex shader. We'll discuss each
coordinate system in more detail below.

```quiz
In which order does a vertex pass through the coordinate systems?
- [ ] local space → clip space → world space → view space → screen space
- [x] local space → world space → view space → clip space → screen space
- [ ] local space → view space → world space → clip space → screen space
- [ ] world space → local space → view space → clip space → screen space
---
The model matrix takes local coordinates into the world, the view matrix brings the world in front of the camera, the projection matrix produces clip coordinates, and the GPU's perspective divide and viewport transform end on the screen.
```

## Local space

Local space is the coordinate space that is local to your object, i.e. where your object begins in. Imagine that
you've created your cube in a modeling software package (like Blender). The origin of your cube is probably at
`(0,0,0)` even though your cube may end up at a different location in your final application. Probably all the
models you've created all have `(0,0,0)` as their initial position. All the vertices of your model are therefore in
*local* space: they are all local to your object.

The vertices of the container we've been using were specified as coordinates between `-0.5` and `0.5` with `0.0` as
its origin. These are local coordinates.

## World space

If we would import all our objects directly in the application they would probably all be somewhere positioned
inside each other at the world's origin of `(0,0,0)` which is not what we want. We want to define a position for each
object to position them inside a larger world. The coordinates in world space are exactly what they sound like: the
coordinates of all your vertices relative to a (game) world. This is the coordinate space where you want your objects
transformed to in such a way that they're all scattered around the place (preferably in a realistic fashion). The
coordinates of your object are transformed from local to world space; this is accomplished with the *model* matrix.

The model matrix is a transformation matrix that translates, scales and/or rotates your object to place it in the
world at a location/orientation they belong to. Think of it as transforming a house by scaling it down (it was a bit
too large in local space), translating it to a suburbia town and rotating it a bit to the left on the y-axis so that
it neatly fits with the neighboring houses. You could think of the matrix in the previous chapter to position the
container all over the scene as a sort of model matrix as well; we transformed the local coordinates of the
container to some different place in the scene/world.

## View space

The view space is what people usually refer to as the *camera* of {{api}} (it is sometimes also known as *camera
space* or *eye space*). The view space is the result of transforming your world-space coordinates to coordinates that
are in front of the user's view. The view space is thus the space as seen from the camera's point of view. This is
usually accomplished with a combination of translations and rotations to translate/rotate the scene so that certain
items are transformed to the front of the camera. These combined transformations are generally stored inside a *view
matrix* that transforms world coordinates to view space. In the next chapter we'll extensively discuss how to create
such a view matrix to simulate a camera.

:::vulkan d3d12
Like OpenGL, {{api}} has no camera of its own: the API knows nothing about cameras, worlds or objects. The camera is
just a matrix your program computes and your vertex shader applies.
:::

## Clip space

At the end of each vertex shader run, {{api}} expects the coordinates to be within a specific range and any
coordinate that falls outside this range is *clipped*. Coordinates that are clipped are discarded, so the remaining
coordinates will end up as fragments visible on your screen. This is also where *clip space* gets its name from.

Because specifying all the visible coordinates to be within the range `-1.0` and `1.0` isn't really intuitive, we
specify our own coordinate set to work in and convert those back to NDC as {{api}} expects them.

To transform vertex coordinates from view to clip space we define a so called *projection matrix* that specifies a
range of coordinates e.g. `-1000` and `1000` in each dimension. The projection matrix then converts coordinates
within this specified range to normalized device coordinates. All coordinates outside this range will not be mapped
between `-1.0` and `1.0` and therefore be clipped. With this range we specified in the projection matrix, a
coordinate of (`1250`, `500`, `750`) would not be visible, since the x coordinate is out of range and thus gets
converted to a coordinate higher than `1.0` in NDC and is therefore clipped.

> Note that if only a part of a primitive e.g. a triangle is outside the clipping volume the GPU will reconstruct
> the triangle as one or more triangles to fit inside the clipping range.

This viewing box a projection matrix creates is called a *frustum* and each coordinate that ends up inside this
frustum will end up on the user's screen. The total process to convert coordinates within a specified range to NDC
that can easily be mapped to 2D view-space coordinates is called *projection* since the projection matrix *projects*
3D coordinates to the easy-to-map-to-2D normalized device coordinates.

Once all the vertices are transformed to clip space a final operation called *perspective division* is performed
where we divide the x, y and z components of the position vectors by the vector's homogeneous w component;
perspective division is what transforms the 4D clip space coordinates to 3D normalized device coordinates. This step
is performed automatically at the end of the vertex shader step.

It is after this stage where the resulting coordinates are mapped to screen coordinates (using the settings of the
viewport) and turned into fragments.

The exact shape of the NDC volume is where the three APIs differ:

:::opengl
In OpenGL, x, y **and z** of a visible vertex must all lie between `-1.0` and `1.0` after the perspective divide.
x = `-1` is the left edge of the viewport, y = `-1` the **bottom** edge (+y points up), z = `-1` the near plane and
z = `1` the far plane. The viewport transform later maps z from `-1..1` to the depth range `0..1` (set by
`glDepthRange`, `0..1` by default) – that is the value that ends up in the depth buffer.

```text
OpenGL NDC:   x  -1 (left)   .. +1 (right)
              y  -1 (bottom) .. +1 (top)
              z  -1 (near)   .. +1 (far)
```

GLM was written for OpenGL, so `glm::ortho` and `glm::perspective` produce exactly this range.
:::
:::vulkan
Vulkan's NDC differ from OpenGL's in two ways. **Depth runs from `0` to `1`** (not `-1` to `1`): z = `0` is the near
plane and z = `1` the far plane. And **y points down**: y = `-1` is the *top* edge of the viewport and y = `1` the
bottom. x is the same as in OpenGL.

```text
Vulkan NDC:   x  -1 (left)  .. +1 (right)
              y  -1 (top)   .. +1 (bottom)
              z   0 (near)  ..  1 (far)
```

GLM was written for OpenGL, so by default its projection functions produce OpenGL's range. Two small changes adapt
them to Vulkan, exactly as vulkan-tutorial does:

- `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` before including GLM makes `glm::perspective` and `glm::ortho` map depth to
  `0..1`. Without it, everything in the near half of the depth range would get a negative z and be clipped.
- `proj[1][1] *= -1;` flips the sign of the projection's y scale, so that +y in your world still ends up at the top
  of the window. In *Transformations* the vertex shader did this flip (`gl_Position.y = -gl_Position.y;`); from now
  on the projection matrix does it, and the line in the shader goes.
:::
:::d3d12
Direct3D's NDC differ from OpenGL's in one way: **depth runs from `0` to `1`** (not `-1` to `1`): z = `0` is the near
plane and z = `1` the far plane. x and y are the same as in OpenGL – y = `-1` is the bottom edge of the viewport and
+y points up.

```text
Direct3D NDC:  x  -1 (left)   .. +1 (right)
               y  -1 (bottom) .. +1 (top)
               z   0 (near)   ..  1 (far)
```

DirectXMath's projection functions produce this range. They come in two flavours, `…LH` (left-handed) and `…RH`
(right-handed), which differ in which way the camera looks in view space – we'll come back to that in *Going 3D*. This
course uses the **right-handed** ones (`XMMatrixPerspectiveFovRH`, `XMMatrixOrthographicOffCenterRH`), because they
use the same view space as GLM and OpenGL: with them, every number in this chapter is learnopengl's.
:::

:::opengl
```quiz
After the perspective divide, a vertex of the scene has z = 0.5. Is it inside OpenGL's view volume, and what would z = -0.5 be?
- [ ] z = 0.5 is visible, z = -0.5 is clipped because it lies in front of the near plane
- [ ] Both are clipped: z must be exactly 0 in NDC
- [ ] Only z = -0.5 is visible, because +z points away from the camera
- [x] Both are visible: OpenGL keeps z between -1 (near) and 1 (far)
---
OpenGL's NDC cube runs from -1 to 1 on all three axes. Vulkan and Direct3D use 0..1 for z, which is why their projection matrices are built differently.
```
:::
:::vulkan
```quiz
After the perspective divide, a vertex of the scene has z = -0.5. What happens to it in Vulkan?
- [x] It is clipped: Vulkan keeps z between 0 (near) and 1 (far)
- [ ] It is drawn at the top of the window, because Vulkan's y points down
- [ ] It is drawn: Vulkan keeps z between -1 and 1 like OpenGL
- [ ] It is drawn, but behind every other vertex
---
Vulkan's depth range in NDC is 0..1. That's why `GLM_FORCE_DEPTH_ZERO_TO_ONE` is needed: GLM's default (OpenGL) projection would put everything in the near half of the frustum at negative z.
```
:::
:::d3d12
```quiz
After the perspective divide, a vertex of the scene has z = -0.5. What happens to it in Direct3D?
- [ ] It is drawn at the top of the window, because Direct3D's y points down
- [ ] It is drawn: Direct3D keeps z between -1 and 1 like OpenGL
- [ ] It is drawn, but behind every other vertex
- [x] It is clipped: Direct3D keeps z between 0 (near) and 1 (far)
---
Direct3D's depth range in NDC is 0..1, and its y points up like OpenGL's. DirectXMath's projection functions produce this range for you.
```
:::

To transform view coordinates to clip coordinates we usually use one of two different forms of projection matrices,
where each form defines its own unique frustum. We can either create an *orthographic* projection matrix or a
*perspective* projection matrix.

### Orthographic projection

An orthographic projection matrix defines a cube-like frustum box that defines the clipping space where each vertex
outside this box is clipped. When creating an orthographic projection matrix we specify the width, height and
length of the visible frustum. All the coordinates inside this frustum will end up within the NDC range after
transformed by its matrix and thus won't be clipped. The frustum looks a bit like a container:

```text
                 far plane
             ┌──────────────┐
            ╱│             ╱│
           ╱ │            ╱ │      all edges parallel:
          ┌──────────────┐  │      a box
          │  └───────────│──┘
  near    │ ╱            │ ╱
  plane   │╱             │╱
          └──────────────┘
                 ▲
               camera
```

The frustum defines the visible coordinates and is specified by a width, a height and a *near* and *far* plane. Any
coordinate in front of the near plane is clipped and the same applies to coordinates behind the far plane. The
orthographic frustum directly maps all coordinates inside the frustum to normalized device coordinates without any
special side effects since it won't touch the w component of the transformed vector; if the w component remains equal
to `1.0` perspective division won't change the coordinates.

:::opengl
To create an orthographic projection matrix we make use of GLM's built-in function `glm::ortho`:

```cpp
glm::ortho(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
```
:::
:::vulkan
To create an orthographic projection matrix we make use of GLM's built-in function `glm::ortho` – with
`GLM_FORCE_DEPTH_ZERO_TO_ONE` defined, and y flipped like the perspective matrix later:

```cpp
glm::mat4 proj = glm::ortho(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
proj[1][1] *= -1; // flip y: the scale ...
proj[3][1] *= -1; // ... and the offset, because this box isn't centred on y = 0
```

(The perspective matrix below is centred, so for it `proj[1][1]` is all there is to flip.)
:::
:::d3d12
To create an orthographic projection matrix we make use of DirectXMath's function
`XMMatrixOrthographicOffCenterRH`:

```cpp
XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
```
:::

The first two parameters specify the left and right coordinate of the frustum and the third and fourth parameter
specify the bottom and top part of the frustum. With those 4 points we've defined the size of the near and far
planes and the 5th and 6th parameter then define the distances between the near and far plane. This specific
projection matrix transforms all coordinates between these x, y and z range values to normalized device
coordinates. Written out, with *l*, *r*, *b*, *t* for left, right, bottom and top and *n* and *f* for the near and
far distances, the matrix is:

:::opengl
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -2/(f-n)   -(f+n)/(f-n) |
| 0         0         0           1           |
```

A point at view-space z = `-n` gets z = `-1`, one at z = `-f` gets z = `1`.
:::
:::vulkan
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -1/(f-n)   -n/(f-n)     |
| 0         0         0           1           |
```

(before the y flip). A point at view-space z = `-n` gets z = `0`, one at z = `-f` gets z = `1`: only the third row
differs from OpenGL's.
:::
:::d3d12
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -1/(f-n)   -n/(f-n)     |
| 0         0         0           1           |
```

A point at view-space z = `-n` gets z = `0`, one at z = `-f` gets z = `1`: only the third row differs from OpenGL's.
This is the matrix written for a column vector on the right, like GLSL's; DirectXMath stores its transpose, because
it multiplies a row vector from the left (`v * M`, see *Transformations*).
:::

An orthographic projection matrix directly maps coordinates to the 2D plane that is your screen, but in reality a
direct projection produces unrealistic results since the projection doesn't take *perspective* into account. That is
something the perspective projection matrix fixes for us.

### Perspective projection

If you ever were to enjoy the graphics the *real life* has to offer you'll notice that objects that are farther away
appear much smaller. This weird effect is something we call *perspective*. Perspective is especially noticeable when
looking down the end of an infinite motorway or railway: the two lines of the road seem to coincide at a far enough
distance.

As you can see, due to perspective the lines seem to coincide at a far enough distance. This is exactly the effect
perspective projection tries to mimic and it does so using a perspective projection matrix. The projection matrix
maps a given frustum range to clip space, but also manipulates the w value of each vertex coordinate in such a way
that the further away a vertex coordinate is from the viewer, the higher this w component becomes. Once the
coordinates are transformed to clip space they are in the range `-w` to `w` (anything outside this range is clipped).
{{api}} requires that the visible coordinates fall between the NDC range as the final vertex shader output, thus once
the coordinates are in clip space, perspective division is applied to the clip space coordinates:

```text
         | x / w |
  out =  | y / w |
         | z / w |
```

Each component of the vertex coordinate is divided by its w component giving smaller vertex coordinates the further
away a vertex is from the viewer. This is another reason why the w component is important, since it helps us with
perspective projection. The resulting coordinates are then in normalized device space.

:::opengl
A perspective projection matrix can be created in GLM as follows:

```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), (float)width/(float)height, 0.1f, 100.0f);
```
:::
:::vulkan
A perspective projection matrix can be created in GLM as follows (with `GLM_FORCE_DEPTH_ZERO_TO_ONE` defined):

```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), (float)width/(float)height, 0.1f, 100.0f);
proj[1][1] *= -1;
```
:::
:::d3d12
A perspective projection matrix can be created with DirectXMath as follows:

```cpp
XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), (float)width / (float)height, 0.1f, 100.0f);
```
:::

What the perspective function does is again create a large *frustum* that defines the visible space, anything
outside the frustum will not end up in the clip space volume and will thus become clipped. A perspective frustum can
be visualized as a non-uniformly shaped box from where each coordinate inside this box will be mapped to a point in
clip space:

```text
            far plane
   ┌───────────────────────────┐
    ╲                         ╱
     ╲                       ╱
      ╲     the frustum     ╱
       ╲                   ╱
        ┌─────────────────┐   near plane
         ╲      fov      ╱
          ╲             ╱
           ╲           ╱
                 ●  camera
```

Its first parameter defines the *fov* value, that stands for *field of view* and sets how large the view space is.
For a realistic view it is usually set to 45 degrees, but for more doom-style results you could set it to a higher
value. The second parameter sets the aspect ratio which is calculated by dividing the viewport's width by its height.
The third and fourth parameter set the *near* and *far* plane of the frustum. We usually set the near distance to
`0.1` and the far distance to `100.0`. All the vertices between the near and far plane and inside the frustum will be
rendered.

> Whenever the near value of your perspective matrix is set too high (like `10.0`), {{api}} will clip all
> coordinates close to the camera (between `0.0` and `10.0`), which can give a visual result you maybe have seen
> before in videogames where you could see through certain objects when moving uncomfortably close to them.

Written out, with *a* for the aspect ratio:

:::opengl
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  1/tan(fov/2)    0               0           |
| 0                  0               -(f+n)/(f-n)    -2·f·n/(f-n) |
| 0                  0               -1              0           |
```
:::
:::vulkan
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  -1/tan(fov/2)   0               0           |
| 0                  0               -f/(f-n)        -f·n/(f-n)  |
| 0                  0               -1              0           |
```

– the `-` in the second row is `proj[1][1] *= -1`, the third row is `GLM_FORCE_DEPTH_ZERO_TO_ONE`.
:::
:::d3d12
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  1/tan(fov/2)    0               0           |
| 0                  0               -f/(f-n)        -f·n/(f-n)  |
| 0                  0               -1              0           |
```

(again written for a column vector; `XMMATRIX` holds the transpose).
:::

The last row is the trick: it copies `-z` into w. In view space the camera looks down the negative z axis, so `-z` is
the distance in front of the camera – and dividing by it makes things that are twice as far away half as big.

Let's follow one point all the way, with the numbers this chapter will use: fov 45°, a = 800 / 600, n = `0.1`,
f = `100`. Then 1/tan(22.5°) ≈ `2.414` and 2.414 / a ≈ `1.811`. Take the container's top right corner
(`0.5`, `0.5`, `0.0`) and move it 3 units away from the camera, to (`0.5`, `0.5`, `-3.0`) in view space. The
projection gives x = 1.811 · 0.5 ≈ `0.905`, y = 2.414 · 0.5 ≈ `1.207` and w = `3`. After the divide by w the corner is
at x ≈ `0.302`, y ≈ `0.402` in NDC – a third of what it would be without the divide, and x and y are no longer stretched
by the window's 4:3 shape, because x was scaled by `1/a`. For depth:

:::opengl
z = (-1.002 · -3 − 0.2002) / 3 ≈ `0.935` in NDC, which the viewport transform maps to (0.935 + 1) / 2 ≈ `0.968` in
the depth buffer.
:::
:::vulkan
z = (-1.001 · -3 − 0.1001) / 3 ≈ `0.968` in NDC, which goes into the depth buffer unchanged (the viewport's depth
range is `0..1`). OpenGL arrives at exactly the same depth buffer value by a different route: `0.935` in NDC, then
mapped from `-1..1` to `0..1`.
:::
:::d3d12
z = (-1.001 · -3 − 0.1001) / 3 ≈ `0.968` in NDC, which goes into the depth buffer unchanged (the viewport's depth
range is `0..1`). OpenGL arrives at exactly the same depth buffer value by a different route: `0.935` in NDC, then
mapped from `-1..1` to `0..1`.
:::

Notice how close to 1 that is, although the point is only 3 of 100 units away: depth after a perspective projection
isn't linear – most of the precision is spent close to the near plane. Advanced chapters come back to this.

When using orthographic projection, each of the vertex coordinates are directly mapped to clip space without any
fancy perspective division (it still does perspective division, but the w component is not manipulated (it stays
`1`) and thus has no effect). Because the orthographic projection doesn't use perspective projection, objects
farther away do not seem smaller, which produces a weird visual output. For this reason the orthographic projection
is mainly used for 2D renderings and for some architectural or engineering applications where we'd rather not have
vertices distorted by perspective. Applications like Blender that are used for 3D modeling sometimes use orthographic
projection for modeling, because it more accurately depicts each object's dimensions. Seen side by side, the
perspective projection shows the far vertices smaller, while the orthographic one draws every cube the same size, no
matter how far away it is.

```quiz
Two identical cubes stand in front of a perspective camera, one 2 units away and one 4 units away. Why does the far one look half as big?
- [x] The projection puts the distance into w, and dividing x and y by w (perspective division) halves the far cube's coordinates
- [ ] The rasterizer skips every second pixel of objects that are far away
- [ ] The far plane pulls far vertices towards the centre of the screen
- [ ] The projection matrix multiplies far vertices by a smaller scale factor in x and y
---
The x and y scale in the projection matrix is the same for every vertex. The difference comes from w = -z: the far cube's w is twice as large, so after the division its x and y are half as large.
```

## Putting it all together

We create a transformation matrix for each of the aforementioned steps: model, view and projection matrix. A vertex
coordinate is then transformed to clip coordinates as follows:

```text
V_clip = M_projection · M_view · M_model · V_local
```

Note that the order of matrix multiplication is reversed (remember that we need to read matrix multiplication from
right to left). The resulting vertex should then be assigned to the vertex shader's output position and {{api}} will
then automatically perform perspective division and clipping.

:::opengl
The resulting vertex is assigned to `gl_Position` in the vertex shader.

**And then?** The output of the vertex shader requires the coordinates to be in clip space which is what we just did
with the transformation matrices. OpenGL then performs *perspective division* on the clip-space coordinates to
transform them to normalized-device coordinates. OpenGL then uses the parameters from `glViewport` to map the
normalized-device coordinates to screen coordinates where each coordinate corresponds to a point on your screen (in
our case a 800x600 screen). This process is called the *viewport transform*. NDC (`-1`, `-1`) becomes the bottom left
corner of the window.
:::
:::vulkan
The resulting vertex is assigned to `gl_Position` in the vertex shader – the same built-in as in OpenGL.

**And then?** Vulkan performs *perspective division* on the clip-space coordinates to transform them to normalized
device coordinates, and then maps them to the framebuffer with the `VkViewport` you set in `recordCommandBuffer()`
(x, y, width, height, and `minDepth = 0.0f` / `maxDepth = 1.0f` for depth). This is the *viewport transform*. NDC
(`-1`, `-1`) becomes the **top** left corner of the window.
:::
:::d3d12
The resulting vertex is the vertex shader's `SV_POSITION` output.

**And then?** Direct3D performs *perspective division* on the clip-space coordinates to transform them to normalized
device coordinates, and then maps them to the render target with the viewport you set with `RSSetViewports`
(`m_viewport`: x, y, width, height, and depth `0..1`). This is the *viewport transform*. NDC (`-1`, `-1`) becomes the
bottom left corner of the window.
:::

This is a difficult topic to understand so if you're still not exactly sure about what each space is used for you
don't have to worry. Below you'll see how we can actually put these coordinate spaces to good use and enough
examples will follow in the upcoming chapters.

### Where the matrices live

Before we use them, there's one practical question: how do the three matrices get to the vertex shader? They don't
all change equally often. In this chapter you'll draw ten cubes per frame. Each cube has its **own model matrix**,
so the model matrix changes between two draws. The **view and projection matrices** are the same for all ten cubes:
they change at most once per frame (the view when the camera moves, the projection when the window is resized).

:::opengl
In OpenGL all three are **uniforms** of the shader program, set with `ourShader.setMat4(…)`. A uniform keeps its value
until you set it again, and every draw call uses the values the program has at the moment of the call – OpenGL takes
care of keeping them for the draw. So you can simply set the model matrix before each draw call and set view and
projection once per frame. That's what learnopengl does, and so will you.

```cpp
        ourShader.setMat4("model", model);
        ourShader.setMat4("view", view);
        ourShader.setMat4("projection", projection);
```

`setMat4` calls `glUniformMatrix4fv` with `GL_FALSE` for its *transpose* parameter: GLM stores its matrices column by
column, which is exactly the order OpenGL expects.
:::
:::vulkan
In Vulkan you choose the mechanism, and the two kinds of value fit two different ones:

- **The model matrix: a push constant.** You know push constants from *Transformations*: `vkCmdPushConstants` copies
  the bytes *into the command buffer*. Each draw recorded afterwards sees the values pushed before it, so ten
  pushes and ten draws give ten different model matrices. The project already has the range and
  `struct PushConstants { glm::mat4 model; };`.
- **View and projection: a uniform buffer.** A uniform buffer is an ordinary `VkBuffer` that the shader reads through
  a descriptor. The command buffer only refers to it; the GPU reads its *contents* when it executes the commands. So
  every draw of a frame sees the same values – exactly right for view and projection, and exactly wrong for the model
  matrix: if you wrote ten model matrices into one buffer while recording, all ten cubes would get the last one.

vulkan-tutorial puts all three matrices in the uniform buffer, because it only draws one object. We follow
learnopengl's split instead. (vulkan-tutorial itself notes that push constants are the more efficient way to pass a
small, often-changing piece of data to the shaders.)

#### Descriptor layout and buffer

The data for the uniform buffer is a struct with the same layout as the uniform block in the vertex shader:

```cpp
// The same layout as the uniform block in the vertex shader: the matrices that stay the same for every draw of a frame.
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
};
```

GLM's `glm::mat4` matches GLSL's `mat4` byte for byte (16 floats, column by column), and two matrices need no
padding. (Vulkan does have alignment rules for uniform buffers – a `vec3` or a nested struct can need `alignas(16)`;
vulkan-tutorial's chapter on the descriptor pool explains them. Matrices are always aligned correctly.)

The buffer that holds it: since the CPU writes it every frame, it lives in host-visible memory, like the staging
buffers you know – no copy to device-local memory. The project has a member for the buffer, one for its memory and a
pointer to the mapped memory:

```cpp
    VkBuffer uniformBuffer;
    VkDeviceMemory uniformBufferMemory;
    void* uniformBufferMapped;
```

`createUniformBuffers()` creates it with the helper `createBuffer()` from the *Textures* chapter and maps it:

```cpp
    void createUniformBuffers() {
        VkDeviceSize bufferSize = sizeof(UniformBufferObject);

        createBuffer(bufferSize, VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, uniformBuffer, uniformBufferMemory);

        // "persistent mapping": the memory stays mapped while the program runs, we write to it every frame
        vkMapMemory(device, uniformBufferMemory, 0, bufferSize, 0, &uniformBufferMapped);
    }
```

The buffer stays mapped for the whole program. Mapping isn't free, and vulkan-tutorial calls this technique
*persistent mapping*. In `cleanup()` the buffer is destroyed and its memory freed – freeing it unmaps it:

```cpp
        vkDestroyBuffer(device, uniformBuffer, nullptr);
        vkFreeMemory(device, uniformBufferMemory, nullptr);
```

> vulkan-tutorial creates one uniform buffer per frame in flight, because the CPU writes the next frame's values
> while the GPU may still be reading the previous ones. This course's programs have a single frame in flight:
> `drawFrame()` waits for the fence before `updateUniformBuffer()` writes the buffer, so the GPU is never reading it
> at that moment, and one buffer is enough.

Now do the task **uniform-buffer**: the struct, the three members, `createUniformBuffers()` and the two cleanup lines.
The picture doesn't change – nothing uses the buffer yet.

#### Descriptor pool and sets

The shader reaches the buffer through a descriptor, exactly like the textures: the project's descriptor set already
has the container's sampler at binding 0 and the face's at binding 1. The uniform buffer becomes binding 2 of the same
set. First the layout, in `createDescriptorSetLayout()`:

```cpp
        VkDescriptorSetLayoutBinding uboLayoutBinding{};
        uboLayoutBinding.binding = 2;
        uboLayoutBinding.descriptorCount = 1;
        uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        uboLayoutBinding.pImmutableSamplers = nullptr;
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {samplerLayoutBinding, faceSamplerLayoutBinding, uboLayoutBinding};
```

`stageFlags` says which shader stages read it: only the vertex shader. The pool must have room for a descriptor of
the new type, so `createDescriptorPool()` gets a second pool size:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[0].descriptorCount = 2; // the set has two combined image samplers
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[1].descriptorCount = 1; // and one uniform buffer
```

And `createDescriptorSets()` writes the descriptor: a `VkDescriptorBufferInfo` says which buffer and which part of
it, and a third `VkWriteDescriptorSet` puts it into binding 2:

```cpp
        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);

        std::array<VkWriteDescriptorSet, 3> descriptorWrites{};
```

```cpp
        descriptorWrites[2].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[2].dstSet = descriptorSet;
        descriptorWrites[2].dstBinding = 2;
        descriptorWrites[2].dstArrayElement = 0;
        descriptorWrites[2].descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        descriptorWrites[2].descriptorCount = 1;
        descriptorWrites[2].pBufferInfo = &bufferInfo;
```

Images use `pImageInfo`, buffers `pBufferInfo`. `recordCommandBuffer()` already binds the set with
`vkCmdBindDescriptorSets`, so nothing else changes there.

Now do the task **uniform-descriptor**. The picture still doesn't change.
:::
:::d3d12
In Direct3D 12 you choose the mechanism, and the two kinds of value fit two different ones:

- **The model matrix: root constants.** You know them from *Transformations*: root parameter 1 holds 16 32-bit
  constants (`ModelConstants`, register `b0`), and `SetGraphicsRoot32BitConstants` records their values *into the
  command list*. Each draw sees the values set before it, so ten calls and ten draws give ten different model
  matrices.
- **View and projection: a constant buffer.** A constant buffer is an ordinary buffer resource that the shader reads
  through a *constant buffer view* (CBV). The command list only refers to it; the GPU reads its *contents* when it
  executes the commands. So every draw of a frame sees the same values – exactly right for view and projection, and
  exactly wrong for the model matrix: if you wrote ten model matrices into one constant buffer while recording, all
  ten cubes would get the last one.

The root signature is limited to 64 DWORDs; a matrix as root constants costs 16 of them, a descriptor table only 1.
Root constants are the fastest way to get a few values to a shader, constant buffers the way for everything bigger.

#### The constant buffer

This is what Microsoft's D3D12HelloConstBuffers sample does (it moves a triangle with an offset). The data is a struct
with the same layout as the `cbuffer` in the shader – plus padding:

```cpp
    // The constant buffer: what the vertex shader sees as cbuffer SceneConstantBuffer.
    // Its size must be a multiple of 256 bytes.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        float padding[32]; // Padding so the constant buffer is 256-byte aligned.
    };
    static_assert((sizeof(SceneConstantBuffer) % 256) == 0, "Constant Buffer size must be 256-byte aligned");
```

A constant buffer view must start at a 256-byte boundary and cover a multiple of 256 bytes. Two matrices are
2 × 64 = 128 bytes; 32 floats of padding make 256. The `static_assert` stops the build if someone adds a member and
breaks the rule.

The class gets the buffer and a pointer to its mapped memory:

```cpp
    ComPtr<ID3D12Resource> m_constantBuffer;
    UINT8* m_pCbvDataBegin = nullptr;    // where the constant buffer is mapped (CPU address)
```

The CBV is a descriptor, and descriptors that shaders use live in the shader-visible CBV/SRV heap. Slots 0 and 1 hold
the textures' SRVs, so the heap grows to three:

```cpp
        cbvSrvHeapDesc.NumDescriptors = 3;    // one SRV per texture + one CBV
```

At the end of `LoadAssets()` the buffer is created in an **upload heap** – the CPU writes it every frame, the GPU reads
it – its CBV goes into the heap's third slot (descriptor 2, one `m_cbvSrvDescriptorSize` further than the second
texture's), and it is mapped for good:

```cpp
    // Create the constant buffer.
    {
        const UINT constantBufferSize = sizeof(SceneConstantBuffer);    // CB size is required to be 256-byte aligned.

        // An upload heap: the CPU writes the buffer every frame, the GPU reads it.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(constantBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_constantBuffer)));

        // Describe and create a constant buffer view (CBV) in the third slot of the
        // CBV/SRV heap (descriptor 2), after the two textures' SRVs.
        D3D12_CONSTANT_BUFFER_VIEW_DESC cbvDesc = {};
        cbvDesc.BufferLocation = m_constantBuffer->GetGPUVirtualAddress();
        cbvDesc.SizeInBytes = constantBufferSize;
        CD3DX12_CPU_DESCRIPTOR_HANDLE cbvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateConstantBufferView(&cbvDesc, cbvHandle);

        // Map the constant buffer. We don't unmap this until the app closes.
        // Keeping things mapped for the lifetime of the resource is okay.
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_constantBuffer->Map(0, &readRange, reinterpret_cast<void**>(&m_pCbvDataBegin)));
    }
```

Unlike the vertex buffer, it is never unmapped: like in the sample, the pointer `m_pCbvDataBegin` stays valid as long
as the resource lives, and each frame simply `memcpy`s new values to it.

> D3D12HelloConstBuffers waits for the GPU at the end of every frame, and so does this course's `OnRender()`. That's
> why one constant buffer is enough: when the CPU writes it for the next frame, the GPU has finished reading it.
> Programs that keep several frames in flight need one buffer (or one 256-byte slice) per frame.

Now do the task **constant-buffer**. The picture doesn't change – nothing reads the buffer yet.
:::

:::opengl
```quiz
In the ten-cubes loop you call `ourShader.setMat4("model", model)` before each `glDrawArrays`. Why does every cube get its own model matrix?
- [ ] `glDrawArrays` resets the uniforms to the identity matrix after drawing
- [ ] It doesn't: all cubes get the last model matrix, and only view and projection differ
- [ ] OpenGL draws all ten cubes at `glfwSwapBuffers`, each with the model matrix of its own loop iteration stored in the VAO
- [x] Each draw call uses the uniform values the program has at the moment of the call
---
A uniform is program state. Setting it between two draw calls changes it for the next draw; OpenGL makes sure the earlier draw still uses the earlier value.
```
:::
:::vulkan
```quiz
Why does the model matrix go into a push constant while view and projection go into the uniform buffer?
- [ ] Push constants are only visible to the fragment shader
- [ ] The uniform buffer may only be written once, when the program starts
- [ ] A uniform buffer can't hold more than two matrices
- [x] Push constants are recorded into the command buffer with each draw; the uniform buffer's contents are read when the GPU executes the commands, so all draws of a frame see the same values
---
Ten pushes and ten draws give ten model matrices. Ten writes into one uniform buffer during recording would leave only the last one for all ten draws – fine for view and projection, which don't change within a frame.
```
:::
:::d3d12
```quiz
Why does the model matrix go into root constants while view and projection go into the constant buffer?
- [ ] The constant buffer may only be written once, when the program starts
- [x] Root constants are recorded into the command list with each draw; the constant buffer's contents are read when the GPU executes the commands, so all draws of a frame see the same values
- [ ] A constant buffer can't hold more than two matrices
- [ ] Root constants are only visible to the pixel shader
---
Ten `SetGraphicsRoot32BitConstants` calls and ten draws give ten model matrices. Ten writes into one constant buffer during recording would leave only the last one for all ten draws – fine for view and projection, which don't change within a frame.
```
:::

## Going 3D

Now that we know how to transform 3D coordinates to 2D coordinates we can start rendering real 3D objects instead
of the lame 2D plane we've been showing so far.

To start drawing in 3D we'll first create a model matrix. The model matrix consists of translations, scaling and/or
rotations we'd like to apply to transform all object's vertices to the global world space. Let's transform our plane
a bit by rotating it on the x-axis so it looks like it's laying on the floor. The model matrix then looks like this:

:::opengl
```cpp
glm::mat4 model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
```
:::
:::vulkan
```cpp
glm::mat4 model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
```
:::
:::d3d12
```cpp
XMMATRIX model = XMMatrixRotationX(XMConvertToRadians(-55.0f));
```
:::

By multiplying the vertex coordinates with this model matrix we're transforming the vertex coordinates to world
coordinates. Our plane that is slightly on the floor thus represents the plane in the global world.

Next we need to create a view matrix. We want to move slightly backwards in the scene so the object becomes visible
(when in world space we're located at the origin `(0,0,0)`). To move around the scene, think about the following:

- To move a camera backwards, is the same as moving the entire scene forward.

That is exactly what a view matrix does, we move the entire scene around inversed to where we want the camera to
move. Because we want to move backwards and since OpenGL is a right-handed system we have to move in the positive
z-axis. We do this by translating the scene towards the negative z-axis. This gives the impression that we are
moving backwards.

> **Right-handed system**
>
> By convention, OpenGL is a right-handed system. What this basically says is that the positive x-axis is to your
> right, the positive y-axis is up and the positive z-axis is backwards. Think of your screen being the center of
> the 3 axes and the positive z-axis going through your screen towards you.
>
> To understand why it's called right-handed do the following:
>
> - Stretch your right-arm along the positive y-axis with your hand up top.
> - Let your thumb point to the right.
> - Let your pointing finger point up.
> - Now bend your middle finger downwards 90 degrees.
>
> If you did things right, your thumb should point towards the positive x-axis, the pointing finger towards the
> positive y-axis and your middle finger towards the positive z-axis. If you were to do this with your left-arm you
> would see the z-axis is reversed. This is known as a left-handed system and is commonly used by DirectX. Note that
> in normalized device coordinates OpenGL actually uses a left-handed system (the projection matrix switches the
> handedness).

:::vulkan
Vulkan itself has no opinion about world and view space – the handedness there is chosen by your math library. GLM
is right-handed by default, so with GLM you use exactly OpenGL's convention: +x right, +y up, the camera looking down
-z. Only the projection (with `proj[1][1] *= -1`) adapts the result to Vulkan's NDC.
:::
:::d3d12
Direct3D itself has no opinion about world and view space either – the handedness is chosen by your math library.
DirectXMath has both: the `…LH` functions put the camera looking down **+z** (the classic DirectX convention), the
`…RH` functions down **-z** like OpenGL. With `XMMatrixPerspectiveFovRH` you use exactly OpenGL's convention: +x right,
+y up, +z towards you – so all of learnopengl's positions and rotations work unchanged.
:::

We'll discuss how to move around the scene in more detail in the next chapter. For now the view matrix looks like
this:

:::opengl
```cpp
glm::mat4 view = glm::mat4(1.0f);
// note that we're translating the scene in the reverse direction of where we want to move
view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
```
:::
:::vulkan
```cpp
glm::mat4 view = glm::mat4(1.0f);
// note that we're translating the scene in the reverse direction of where we want to move
view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
```
:::
:::d3d12
```cpp
XMMATRIX view = XMMatrixTranslation(0.0f, 0.0f, -3.0f);
```
:::

The last thing we need to define is the projection matrix. We want to use perspective projection for our scene so
we'll declare the projection matrix like this:

:::opengl
```cpp
glm::mat4 projection;
projection = glm::perspective(glm::radians(45.0f), 800.0f / 600.0f, 0.1f, 100.0f);
```

Now that we created the transformation matrices we should pass them to our shaders. First let's declare the
transformation matrices as uniforms in the vertex shader and multiply them with the vertex coordinates:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoord;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    // note that we read the multiplication from right to left
    gl_Position = projection * view * model * vec4(aPos, 1.0);
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

We should also send the matrices to the shader (this is usually done each frame since transformation matrices tend
to change a lot). In the render loop, at the `// TODO:` after `ourShader.use();`:

```cpp
        // create transformations
        glm::mat4 model         = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        glm::mat4 view          = glm::mat4(1.0f);
        glm::mat4 projection    = glm::mat4(1.0f);
        model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
        view  = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
        projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // pass them to the shader
        ourShader.setMat4("model", model);
        ourShader.setMat4("view", view);
        // note: currently we set the projection matrix each frame, but since the projection matrix rarely changes it's often best practice to set it outside the main loop only once.
        ourShader.setMat4("projection", projection);
```

Now do the task **plane**.
:::
:::vulkan
```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
proj[1][1] *= -1;
```

The aspect ratio comes from the swap chain extent, like in vulkan-tutorial. The y flip only works together with
Vulkan's depth range, so first add the define at the top of `main.cpp`, before GLM is included:

```cpp
// Vulkan's depth range is 0..1 (OpenGL's is -1..1): make glm::perspective use it.
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
```

View and projection go into the uniform buffer. `updateUniformBuffer()` runs once per frame, after the fence wait, and
copies them into the mapped memory:

```cpp
    void updateUniformBuffer() {
        UniformBufferObject ubo{};
        // note that we're translating the scene in the reverse direction of where we want to move
        ubo.view = glm::translate(glm::mat4(1.0f), glm::vec3(0.0f, 0.0f, -3.0f));
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan (this replaces the flip in the shader)
        ubo.proj[1][1] *= -1;

        memcpy(uniformBufferMapped, &ubo, sizeof(ubo));
    }
```

The model matrix is pushed in `recordCommandBuffer()`, at the `// TODO:` before the draw:

```cpp
        // the model matrix: tilt the plane back
        glm::mat4 model = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));

        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

The vertex shader declares both blocks – the uniform buffer at binding 2, the push constant block as before – and
multiplies:

```glsl
#version 450

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    // note that we read the multiplication from right to left
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
    fragTexCoord = inTexCoord;
}
```

Note that the line `gl_Position.y = -gl_Position.y;` is gone: the projection matrix flips y now. With both flips the
plane would be upside down – and since that also reverses the triangles' winding on screen, back-face culling would
remove it entirely.

Now do the task **plane**.
:::
:::d3d12
```cpp
XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);
```

View and projection go into the constant buffer, so the shader needs a way to reach it. The CBV sits in the heap, and
shaders reach heap descriptors through a **descriptor table** in the root signature. Add a second descriptor range
– one CBV, starting at register `b1` – and root parameter 2, a table with that range for the vertex shader:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);

        // A second range: 1 CBV at register b1, for the table of root parameter 2.
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
```

```cpp
        // Root parameter 2: a descriptor table with the constant buffer view (b1:
        // view and projection), for the vertex shader.
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_VERTEX);
```

(`b0` is already taken by the root constants, so the constant buffer is `b1`.) The values are written once per frame,
in `OnUpdate()` – Microsoft's samples update their constant buffers there, before `OnRender()` records the frame:

```cpp
    // The view matrix moves the whole scene 3 units away from the camera. The *RH
    // functions use a right-handed system like OpenGL: the camera looks down -z.
    XMMATRIX view = XMMatrixTranslation(0.0f, 0.0f, -3.0f);

    // The projection matrix adds perspective: a 45 degree field of view, the window's
    // aspect ratio, and the near and far planes at 0.1 and 100 units.
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    // Copy both into the constant buffer, transposed like the model matrix. The GPU
    // has finished the previous frame (OnRender waits for it), so it is not reading it.
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

They are stored transposed for the same reason as the model matrix in *Transformations*: HLSL reads a `float4x4` from
a constant buffer column by column. In `PopulateCommandList()` the table of root parameter 2 is set to the heap's
third descriptor, right after the textures' table:

```cpp
    // Root parameter 2: the table with the constant buffer view, the heap's third
    // descriptor.
    CD3DX12_GPU_DESCRIPTOR_HANDLE cbvHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, cbvHandle);
```

Finally the shader declares the constant buffer and multiplies:

```hlsl
// The constant buffer at register b1 (the CBV in root parameter 2's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};
```

```hlsl
    // The position is a row vector, multiplied by the matrices from left to right:
    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);
```

With row vectors the order reads left to right – the same transformations as GLSL's
`projection * view * model * position`, applied in the same order.

Now do the task **view-projection**. The model matrix is still the identity, so you see the effect of view and
projection alone: the container is smaller – from (279, 179) to (520, 420), the numbers we calculated above – and it's
**square**. Until now it was stretched to the window's 4:3 shape; the aspect ratio in the projection undoes that.

Then replace the identity model matrix in `PopulateCommandList()` with the rotation:

```cpp
    // The model matrix: rotate the rectangle by -55 degrees about the x axis, so it
    // lies tilted back like a floor.
    XMMATRIX model = XMMatrixRotationX(XMConvertToRadians(-55.0f));
```

Now do the task **plane**.
:::

If you run the program, the result should look like a floor tilted back: a trapezoid, narrow at its far (top) edge
and wide at its near (bottom) edge, the crate upright on it. This plane is laying on some imaginary floor. If you're
not getting the same result, compare your code with the code excerpts above.

```quiz
You want the camera 3 units further back, at z = +3, looking down -z. What do you put in the view matrix?
- [ ] A rotation by 180° about the y axis
- [ ] A translation by (0, 0, 3): the camera moves in +z
- [ ] Nothing – the projection's near plane at 0.1 moves the camera back automatically
- [x] A translation by (0, 0, -3): moving the camera back is the same as moving the whole scene forward
---
The view matrix moves the world, not the camera, so it uses the inverse of the camera's movement. Put the scene at z = -3 and it lies 3 units in front of a camera at the origin looking down -z.
```

## More 3D

So far we've been working with a 2D plane, even in 3D space, so let's take the adventurous route and extend our 2D
plane to a 3D cube. To render a cube we need a total of 36 vertices (6 faces * 2 triangles * 3 vertices each). 36
vertices are a lot to sum up so you can retrieve them from here:

:::opengl
```cpp
    float vertices[] = {
        // positions          // texture coords
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,

        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,

        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,

        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f
    };
```

Every face has its own four corners with their own texture coordinates, so an element buffer would save little:
we draw the cube with `glDrawArrays` and remove `indices` and the `EBO` – its `glGenBuffers`, the
`GL_ELEMENT_ARRAY_BUFFER` binding and upload, and its `glDeleteBuffers`. The attribute pointers stay as they are
(still 5 floats per vertex). The draw becomes:

```cpp
        // render box
        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
```

Now do the task **cube**. You'll see a box – but a strange one; more about that in a moment.
:::
:::vulkan
```cpp
// learnopengl's cube: 6 faces of 2 triangles, 36 vertices (no index buffer).
// The texture coordinates have v flipped (1 - v) because learnopengl flips the images when loading them.
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{0.5f, -0.5f, -0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},

    // front (z = +0.5)
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 0.0f}},
    {{-0.5f, 0.5f, 0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},

    // left (x = -0.5)
    {{-0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},

    // right (x = +0.5)
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},

    // bottom (y = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},

    // top (y = +0.5)
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, 0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}}
};
```

These are learnopengl's positions and texture coordinates, with v flipped as in the previous chapters. Every face has
its own four corners with their own texture coordinates, so an index buffer would save little: remove `indices`, the
`indexBuffer`/`indexBufferMemory` members, `createIndexBuffer()` and its call, the two cleanup lines and
`vkCmdBindIndexBuffer`, and draw with `vkCmdDraw`:

```cpp
        vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

One more thing. Our pipeline culls back faces (`VK_CULL_MODE_BACK_BIT`, with clockwise triangles as front faces).
learnopengl's cube wasn't made for culling: OpenGL doesn't cull unless you enable it, and the cube's triangles are
not all wound the same way. With culling on, some faces would vanish. So turn it off:

```cpp
        rasterizer.cullMode = VK_CULL_MODE_NONE; // the cube's triangles are not all wound the same way
```

Now do the task **cube**. You'll see a box – but a strange one; more about that in a moment.
:::
:::d3d12
```cpp
        // A cube: 6 faces of 2 triangles, 36 vertices. The texture coordinates are
        // learnopengl.com's with v flipped (1 - v): Direct3D's v = 0 is the image's top.
        Vertex vertices[] =
        {
            // position                texture coords
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },

            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 0.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },

            { { -0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },

            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },

            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },

            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } }
        };
```

These are learnopengl's positions and texture coordinates, with v flipped as in the previous chapters. Every face has
its own four corners with their own texture coordinates, so an index buffer would save little: remove the index
buffer's block in `LoadAssets()`, the members `m_indexBuffer` and `m_indexBufferView` and the `IASetIndexBuffer`
call, and draw without indices – learnopengl's `glDrawArrays(GL_TRIANGLES, 0, 36)`:

```cpp
    m_commandList->DrawInstanced(36, 1, 0, 0);
```

One more thing. By default Direct3D culls back faces – triangles that are counter-clockwise on screen.
learnopengl's cube wasn't made for culling: OpenGL doesn't cull unless you enable it, and the cube's triangles are
not all wound the same way. With culling on, some faces would vanish. So turn it off in the PSO:

```cpp
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // the cube's triangles are not all clockwise: draw both sides
```

Now do the task **cube**. You'll see a box – but a strange one; more about that in a moment.
:::

For fun, we'll let the cube rotate over time:

:::opengl
```cpp
        model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));
```

This replaces the -55° rotation: the angle is the time in seconds, in radians, about the axis (0.5, 1.0, 0.0).
`glm::rotate` normalizes the axis for you.
:::
:::vulkan
```cpp
        // the model matrix: rotate the cube over time
        glm::mat4 model = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));
```

This replaces the -55° rotation: the angle is GLFW's time in seconds, in radians, about the axis (0.5, 1.0, 0.0).
`glm::rotate` normalizes the axis for you. `recordCommandBuffer()` runs every frame, so every frame pushes a new
matrix.
:::
:::d3d12
```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // The model matrix: rotate the cube about the axis (0.5, 1, 0) by the time (in
    // radians). XMMatrixRotationAxis normalizes the axis.
    XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(0.5f, 1.0f, 0.0f, 0.0f), time);
```

This replaces the -55° rotation in `PopulateCommandList()`: the angle is the time since the first frame, in radians,
about the axis (0.5, 1.0, 0.0). `XMMatrixRotationAxis` is `glm::rotate` with an axis, and it normalizes the axis too.
:::

Now do the task **spin**. Well, it does resemble a cube slightly but something's off. Some sides of the cube are
being drawn over other sides of the cube. This happens because when {{api}} draws your cube triangle-by-triangle,
fragment by fragment, it will overwrite any pixel color that may have already been drawn there before. The triangles
of a draw reach the framebuffer in the order they appear in the vertex buffer, and nothing checks which of them is
nearer – so some triangles are drawn on top of each other even though one should clearly be behind the other:
whatever face comes later in `vertices` wins, near or far.

```quiz
Without depth testing, why can you see faces at the back of the cube through the front ones?
- [ ] The back faces are drawn with inverted texture coordinates
- [ ] The texture's alpha channel makes the front faces transparent
- [x] Every fragment simply overwrites the pixel; triangles drawn later cover earlier ones no matter which is nearer
- [ ] The projection matrix maps the far side of the cube in front of the near side
---
Without a depth test, the only thing that decides which colour stays in a pixel is the drawing order. Something must remember how far away the pixel's current colour is: the depth buffer.
```

Luckily, there is a buffer that stores depth information: the *z-buffer*, which allows {{api}} to decide when to draw
over a pixel and when not to. Using the z-buffer we can configure {{api}} to do depth-testing.

### Z-buffer

The GPU stores all its depth information in a z-buffer, also known as a *depth buffer*. It is an image as big as the
color buffer that stores, per pixel, a depth value. When depth testing is enabled, the GPU tests the depth value of
each fragment against the content of the depth buffer: if the current fragment is behind the other fragment it is
discarded, otherwise overwritten (and its depth value written into the depth buffer). This process is called *depth
testing*.

The depth value is the z of the fragment after the viewport transform, between `0` (near plane) and `1` (far plane) –
in all three APIs, as we saw above. Two settings make the test work:

- At the start of every frame the depth buffer is cleared to `1.0`, the far plane: the farthest anything can be.
- The test is "less": a fragment passes if its depth is *less* than the value already stored.

So the first fragment that lands on a pixel always passes, and after that only nearer ones. Without clearing, the
depth values of the last frame would stay in the buffer and hide this frame's fragments.

:::opengl
GLFW automatically creates such a buffer for you (just like it has a color buffer that stores the colors of the
output image). The depth is stored within each fragment (as the fragment's `z` value) and whenever the fragment wants
to output its color, OpenGL compares its depth values with the z-buffer.

However, if we want to make sure OpenGL actually performs the depth testing we first need to tell OpenGL we want to
enable depth testing; it is disabled by default. We can enable depth testing using `glEnable`. The `glEnable` and
`glDisable` functions allow us to enable/disable certain functionality in OpenGL. That functionality is then
enabled/disabled until another call is made to disable/enable it. Right now we want to enable depth testing by
enabling `GL_DEPTH_TEST`, once, after GLAD has been loaded:

```cpp
    // configure global opengl state
    // -----------------------------
    glEnable(GL_DEPTH_TEST);
```

Since we're using a depth buffer we also want to clear the depth buffer before each render iteration (otherwise the
depth information of the previous frame stays in the buffer). Just like clearing the color buffer, we can clear the
depth buffer by specifying the `GL_DEPTH_BUFFER_BIT` bit in the `glClear` function:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT); // also clear the depth buffer now!
```

OpenGL's defaults are exactly the two settings above: `glClearDepth` is `1.0` and `glDepthFunc` is `GL_LESS`.

Now do the task **depth-test**. There you go! A fully textured cube with proper depth testing that rotates over time.
:::
:::vulkan
The swap chain gives you color images only. The depth buffer is your job: an image, its memory and a view, an
attachment in the render pass and the framebuffers, and depth state in the pipeline. This is vulkan-tutorial's
*Depth buffering* chapter.

#### Depth image and view

```cpp
    VkImage depthImage;
    VkDeviceMemory depthImageMemory;
    VkImageView depthImageView;
```

One depth image is enough – only one frame is drawn at a time. It has the swap chain's size. Its format must contain
a depth component; vulkan-tutorial notes that we don't need a specific one, because we never access the texels from
the program – it just needs reasonable accuracy, and at least 24 bits are common. Not every format is supported on
every GPU, so we ask for the first one in a list of candidates that the device supports as a depth attachment:

```cpp
    VkFormat findSupportedFormat(const std::vector<VkFormat>& candidates, VkImageTiling tiling, VkFormatFeatureFlags features) {
        for (VkFormat format : candidates) {
            VkFormatProperties props;
            vkGetPhysicalDeviceFormatProperties(physicalDevice, format, &props);

            if (tiling == VK_IMAGE_TILING_LINEAR && (props.linearTilingFeatures & features) == features) {
                return format;
            } else if (tiling == VK_IMAGE_TILING_OPTIMAL && (props.optimalTilingFeatures & features) == features) {
                return format;
            }
        }

        throw std::runtime_error("failed to find supported format!");
    }

    VkFormat findDepthFormat() {
        return findSupportedFormat(
            {VK_FORMAT_D32_SFLOAT, VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT
        );
    }
```

`VK_FORMAT_D32_SFLOAT` is a 32-bit float per pixel; the other two also have a stencil component, which we don't use
yet. Then `createDepthResources()` creates the image with the `createImage()` helper from the *Textures* chapter, as a
depth attachment in device-local memory, and its view:

```cpp
    void createDepthResources() {
        VkFormat depthFormat = findDepthFormat();

        createImage(swapChainExtent.width, swapChainExtent.height, depthFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, depthImage, depthImageMemory);
        depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT);
    }
```

`createImageView()` used to hard-code `VK_IMAGE_ASPECT_COLOR_BIT`. A depth image's view must name the depth aspect, so
the function gets a third parameter:

```cpp
    VkImageView createImageView(VkImage image, VkFormat format, VkImageAspectFlags aspectFlags) {
```

```cpp
        viewInfo.subresourceRange.aspectMask = aspectFlags;
```

and the existing calls pass `VK_IMAGE_ASPECT_COLOR_BIT` – the swap chain views in `createImageViews()` and the two
texture views:

```cpp
            swapChainImageViews[i] = createImageView(swapChainImages[i], swapChainImageFormat, VK_IMAGE_ASPECT_COLOR_BIT);
```

```cpp
        textureImageView = createImageView(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        faceTextureImageView = createImageView(faceTextureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

In `cleanup()` destroy the view and the image and free the memory:

```cpp
        vkDestroyImageView(device, depthImageView, nullptr);
        vkDestroyImage(device, depthImage, nullptr);
        vkFreeMemory(device, depthImageMemory, nullptr);
```

The image starts in `VK_IMAGE_LAYOUT_UNDEFINED`. vulkan-tutorial shows how to transition it explicitly with a
barrier, and then notes that it isn't necessary: the render pass will do it, as you'll see next. That's also why
`createDepthResources()` can run before `createFramebuffers()` – in this course before the command pool even exists.

Now do the task **depth-image**. The picture doesn't change yet: the image exists, but nothing uses it.

#### Render pass, framebuffer and pipeline

In `createRenderPass()` the depth image becomes the render pass's second attachment:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

`loadOp = CLEAR` is Vulkan's version of `GL_DEPTH_BUFFER_BIT`: the render pass clears it at its start. `storeOp =
DONT_CARE`, because nobody needs the depth values after the frame is drawn. The initial layout `UNDEFINED` says we
don't care about the previous contents (they're cleared anyway); the final layout is the one the subpass uses. The
subpass references it as attachment 1:

```cpp
        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 1;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

```cpp
        subpass.pColorAttachments = &colorAttachmentRef;
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

A subpass can only use one depth (+stencil) attachment, so unlike the color attachments it's a single pointer, not an
array. The subpass dependency gets the depth stages and accesses, and the render pass both attachments:

```cpp
        dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependency.srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT;
        dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;

        std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, depthAttachment};
        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        renderPassInfo.pAttachments = attachments.data();
```

The depth image is first touched in the *early fragment tests* stage, where the load operation clears it – a write.
And since every frame uses the same depth image, that clear must wait until the previous frame's depth writes (in
the *late fragment tests* stage) are done. That's what the extra stage and access bits say.

Each framebuffer gets the depth image view as its second attachment – the same view for every swap chain image:

```cpp
            std::array<VkImageView, 2> attachments = {
                swapChainImageViews[i],
                depthImageView
            };
```

```cpp
            framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
            framebufferInfo.pAttachments = attachments.data();
```

The pipeline gets its depth state in `createGraphicsPipeline()`:

```cpp
        VkPipelineDepthStencilStateCreateInfo depthStencil{};
        depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
        depthStencil.depthTestEnable = VK_TRUE;
        depthStencil.depthWriteEnable = VK_TRUE;
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS;
        depthStencil.depthBoundsTestEnable = VK_FALSE;
        depthStencil.stencilTestEnable = VK_FALSE;
```

```cpp
        pipelineInfo.pDepthStencilState = &depthStencil;
```

`depthTestEnable` compares each fragment's depth with the buffer, `depthWriteEnable` writes the depth of the fragments
that pass (transparent objects, later, test without writing). `VK_COMPARE_OP_LESS` keeps nearer fragments. The
depth bounds test and the stencil test stay off.

Last, the clear values. There is now one per attachment, in attachment order – the color, and the depth `1.0`:

```cpp
        // one clear value per attachment: the colour, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 2> clearValues{};
        clearValues[0].color = {{0.2f, 0.3f, 0.3f, 1.0f}};
        clearValues[1].depthStencil = {1.0f, 0};

        renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
        renderPassInfo.pClearValues = clearValues.data();
```

Now do the task **depth-test**. There you go! A fully textured cube with proper depth testing that rotates over time.
:::
:::d3d12
The swap chain gives you color buffers only. The depth buffer is your job: a descriptor heap for its view, a texture,
the view, depth state in the PSO, and two changes in `PopulateCommandList()`.

#### The depth buffer

Render target views live in an RTV heap; depth stencil views live in their own heap type, a **DSV heap**. One
descriptor, not shader-visible (shaders never read it), created in `LoadPipeline()` next to the RTV heap:

```cpp
        // Describe and create a depth stencil view (DSV) descriptor heap.
        D3D12_DESCRIPTOR_HEAP_DESC dsvHeapDesc = {};
        dsvHeapDesc.NumDescriptors = 1;
        dsvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_DSV;
        dsvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&dsvHeapDesc, IID_PPV_ARGS(&m_dsvHeap)));
```

The class gets the members `ComPtr<ID3D12DescriptorHeap> m_dsvHeap;` and `ComPtr<ID3D12Resource> m_depthStencil;`.
At the end of `LoadAssets()` the depth texture is created – one 32-bit float depth per pixel
(`DXGI_FORMAT_D32_FLOAT`), as big as the window, in a default heap, with the flag that allows it to be a depth
stencil:

```cpp
    // Create the depth buffer and its depth stencil view.
    {
        D3D12_DEPTH_STENCIL_VIEW_DESC depthStencilDesc = {};
        depthStencilDesc.Format = DXGI_FORMAT_D32_FLOAT;
        depthStencilDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2D;
        depthStencilDesc.Flags = D3D12_DSV_FLAG_NONE;

        // The value the depth buffer is usually cleared to: 1.0, the far plane.
        D3D12_CLEAR_VALUE depthOptimizedClearValue = {};
        depthOptimizedClearValue.Format = DXGI_FORMAT_D32_FLOAT;
        depthOptimizedClearValue.DepthStencil.Depth = 1.0f;
        depthOptimizedClearValue.DepthStencil.Stencil = 0;

        // A texture as big as the window, one 32-bit float depth per pixel (1 array
        // slice, 1 mip level), in a default heap and in the DEPTH_WRITE state.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC depthDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &depthDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &depthOptimizedClearValue,
            IID_PPV_ARGS(&m_depthStencil)));

        m_device->CreateDepthStencilView(m_depthStencil.Get(), &depthStencilDesc, m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    }
```

The resource starts in `D3D12_RESOURCE_STATE_DEPTH_WRITE` and stays there: it's only ever used as a depth buffer, so
no barriers are needed. The *optimized clear value* tells the driver which value we will clear it to; clearing to
exactly that value can be faster on many GPUs (passing a different value later works, but may trigger a debug-layer
warning).

#### The pipeline state

Until now the PSO switched depth testing off (`DepthEnable = FALSE`, from D3D12HelloTriangle). Replace those two lines
with the default depth stencil state and tell the PSO the DSV's format:

```cpp
        // The default depth stencil state: depth test on (a pixel is kept only if it is
        // nearer than the one already there, D3D12_COMPARISON_FUNC_LESS), depth writes on.
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);
```

```cpp
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
```

`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` means: depth test on, depth writes on (`D3D12_DEPTH_WRITE_MASK_ALL`),
comparison `D3D12_COMPARISON_FUNC_LESS`, stencil off.

#### Using it

In `PopulateCommandList()` the depth buffer is bound together with the render target and cleared every frame, right
after the color:

```cpp
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);
```

```cpp
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

`D3D12_CLEAR_FLAG_DEPTH` clears depth only (there's no stencil in a D32 format), to `1.0`; the last two arguments
(0 rectangles, `nullptr`) clear the whole texture. One depth buffer serves both back buffers, because `OnRender()`
waits for each frame to finish.

Now do the task **depth-test**. There you go! A fully textured cube with proper depth testing that rotates over time.
:::

```quiz
The depth buffer is cleared to 1.0 every frame, and the depth test is "less". What does that achieve?
- [ ] Nothing changes as long as you don't clear the color buffer too
- [ ] Only fragments exactly on the far plane are drawn
- [x] The first fragment on a pixel always passes, and after that only fragments nearer than the stored depth replace it
- [ ] Fragments are drawn back to front, so far faces cover near ones
---
1.0 is the far plane, so every visible fragment is nearer than the cleared value. Each passing fragment writes its depth, and later fragments must beat it. Without clearing, last frame's depths would block this frame's fragments.
```

### More cubes!

Say we wanted to display 10 of our cubes on screen. Each cube will look the same but will only differ in where it's
located in the world with each a different rotation. The graphical layout of the cube is already defined so we don't
have to change our buffers or attribute arrays when rendering more objects. The only thing we have to change for each
object is its model matrix where we transform the cubes into the world.

First, let's define a translation vector for each cube that specifies its position in world space. We'll define 10
cube positions in an array:

:::opengl
```cpp
    // world space positions of our cubes
    glm::vec3 cubePositions[] = {
        glm::vec3( 0.0f,  0.0f,  0.0f),
        glm::vec3( 2.0f,  5.0f, -15.0f),
        glm::vec3(-1.5f, -2.2f, -2.5f),
        glm::vec3(-3.8f, -2.0f, -12.3f),
        glm::vec3( 2.4f, -0.4f, -3.5f),
        glm::vec3(-1.7f,  3.0f, -7.5f),
        glm::vec3( 1.3f, -2.0f, -2.5f),
        glm::vec3( 1.5f,  2.0f, -2.5f),
        glm::vec3( 1.5f,  0.2f, -1.5f),
        glm::vec3(-1.3f,  1.0f, -1.5f)
    };
```

Put it right after `vertices[]`. Now, within the render loop we want to call `glDrawArrays` 10 times, but this time
send a different model matrix to the vertex shader each time before we send the draw call. We will create a small
loop within the render loop that renders our object 10 times with a different model matrix each time. Note that we
also add a small unique rotation to each container. View and projection are set once, before the loop, and the old
`model` lines outside the loop go:

```cpp
        // create transformations
        glm::mat4 view          = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        glm::mat4 projection    = glm::mat4(1.0f);
        view       = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
        projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // pass transformation matrices to the shader
        ourShader.setMat4("view", view);
        // note: currently we set the projection matrix each frame, but since the projection matrix rarely changes it's often best practice to set it outside the main loop only once.
        ourShader.setMat4("projection", projection);

        // render boxes
        glBindVertexArray(VAO);
        for (unsigned int i = 0; i < 10; i++)
        {
            // calculate the model matrix for each object and pass it to shader before drawing
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            ourShader.setMat4("model", model);

            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
```cpp
// world space positions of our cubes
const std::vector<glm::vec3> cubePositions = {
    glm::vec3( 0.0f,  0.0f,  0.0f),
    glm::vec3( 2.0f,  5.0f, -15.0f),
    glm::vec3(-1.5f, -2.2f, -2.5f),
    glm::vec3(-3.8f, -2.0f, -12.3f),
    glm::vec3( 2.4f, -0.4f, -3.5f),
    glm::vec3(-1.7f,  3.0f, -7.5f),
    glm::vec3( 1.3f, -2.0f, -2.5f),
    glm::vec3( 1.5f,  2.0f, -2.5f),
    glm::vec3( 1.5f,  0.2f, -1.5f),
    glm::vec3(-1.3f,  1.0f, -1.5f)
};
```

Put it next to `vertices`, before `struct PushConstants`. Now, within `recordCommandBuffer()` we want to call
`vkCmdDraw` 10 times, but this time push a different model matrix each time before we record the draw. We will create
a small loop that renders our object 10 times with a different model matrix each time. Note that we also add a small
unique rotation to each container. It replaces the single push and draw:

```cpp
        for (unsigned int i = 0; i < 10; i++) {
            // calculate the model matrix for each object and push it before drawing
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));

            PushConstants constants{};
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```

The vertex buffer, the pipeline and the descriptor set are bound once; only the push constants change between the
draws. View and projection stay in the uniform buffer, written once per frame.
:::
:::d3d12
```cpp
    // World space positions of our cubes.
    XMFLOAT3 cubePositions[] =
    {
        XMFLOAT3( 0.0f,  0.0f,  0.0f),
        XMFLOAT3( 2.0f,  5.0f, -15.0f),
        XMFLOAT3(-1.5f, -2.2f, -2.5f),
        XMFLOAT3(-3.8f, -2.0f, -12.3f),
        XMFLOAT3( 2.4f, -0.4f, -3.5f),
        XMFLOAT3(-1.7f,  3.0f, -7.5f),
        XMFLOAT3( 1.3f, -2.0f, -2.5f),
        XMFLOAT3( 1.5f,  2.0f, -2.5f),
        XMFLOAT3( 1.5f,  0.2f, -1.5f),
        XMFLOAT3(-1.3f,  1.0f, -1.5f)
    };
```

Put it in `PopulateCommandList()`, where the time lines and the single model matrix were (nothing uses the time any
more, so those lines go). Now we want to call `DrawInstanced` 10 times, but this time set a different model matrix
each time before we record the draw. We will create a small loop that renders our object 10 times with a different
model matrix each time. Note that we also add a small unique rotation to each container:

```cpp
    // Draw the cube 10 times, each with its own model matrix: rotate by 20 degrees
    // per cube about the axis (1, 0.3, 0.5), then move it to its position.
    for (UINT i = 0; i < 10; i++)
    {
        float angle = 20.0f * i;
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(1.0f, 0.3f, 0.5f, 0.0f), XMConvertToRadians(angle))
            * XMMatrixTranslation(cubePositions[i].x, cubePositions[i].y, cubePositions[i].z);

        // Root parameter 1: this cube's model matrix. Root constants are recorded with
        // each draw, so every cube keeps its own.
        ModelConstants modelConstants = {};
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(ModelConstants) / 4, &modelConstants, 0);

        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```

Note the order of the product: with DirectXMath's row vectors, `rotation * translation` rotates first and then
moves – the same as learnopengl's `glm::translate` followed by `glm::rotate`, which GLM applies to the vertex in
reverse. View and projection stay in the constant buffer, written once per frame in `OnUpdate()`.
:::

Read the model matrix right to left: each cube is first rotated about its own centre – by 20° more than the cube
before it, about the axis (1.0, 0.3, 0.5) – and then moved to its position in the world. The first cube, at the
origin with an angle of 0, faces you head on.

Now do the task **ten-cubes**. This snippet of code will update the model matrix each time a new cube is drawn and do
this 10 times in total. Right now we should be looking into a world filled with 10 oddly rotated cubes, some close,
some far away and smaller.

Perfect! It looks like our container found some like-minded friends. If you're stuck see if you can compare your code
with the excerpts above.

## Exercises

- Try experimenting with the FoV and aspect-ratio parameters of the projection function. See if you can figure out
  how those affect the perspective frustum.
- Play with the view matrix by translating in several directions and see how the scene changes. Think of the view
  matrix as a camera object.
- Try to make every 3rd container (including the 1st) rotate over time, while leaving the other containers static
  using just the model matrix.

The first two are experiments for you – try them after the last task and undo them afterwards (a wider FoV makes
everything smaller and shows more of the world; an aspect ratio that doesn't match the window stretches the picture
again). The third is the last task of this chapter.

:::opengl
Inside the loop, right after the angle is computed, use the time for every third cube instead:

```cpp
            float angle = 20.0f * i;
            if (i % 3 == 0) // every 3rd iteration (including the first) we set the angle using GLFW's time function.
                angle = (float)glfwGetTime() * 25.0f;
```
:::
:::vulkan
Inside the loop, right after the angle is computed, use the time for every third cube instead:

```cpp
            float angle = 20.0f * i;
            if (i % 3 == 0) { // every 3rd iteration (including the first) we set the angle using GLFW's time function
                angle = (float)glfwGetTime() * 25.0f;
            }
```
:::
:::d3d12
The time lines come back, before the cube positions:

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
```

and inside the loop, right after the angle is computed, every third cube uses the time instead:

```cpp
        float angle = 20.0f * i;
        if (i % 3 == 0)    // every 3rd cube (including the first) rotates with the time
            angle = time * 25.0f;
```
:::

`i % 3 == 0` is true for cubes 0, 3, 6 and 9. Their angle grows by 25 degrees per second; the others keep their fixed
`20.0f * i`.

Now do the task **rotate-every-third**. Four of the ten crates turn slowly, the other six stand still.

You've now gone all the way from a vertex in local space to a pixel on the screen. In the next chapter we'll turn the
view matrix into a real camera you can move through this little world.
