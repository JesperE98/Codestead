# Face culling

Try mentally visualizing a 3D cube and count the maximum number of faces you'll be able to see from any direction. If
your imagination is not too creative you probably ended up with a maximum number of 3. You can view a cube from any
position and/or direction, but you would never be able to see more than 3 faces. So why would we waste the effort of
drawing those other 3 faces that we can't even see? If we could discard those in some way we would save more than 50%
of this cube's total fragment shader runs!

We say *more than 50%* instead of 50%, because from certain angles only 2 or even 1 face could be visible. In that
case we'd save *more* than 50%.

This is a really great idea, but there's one problem we need to solve: how do we know if a face of an object is not
visible from the viewer's point of view? If we imagine any closed shape, each of its faces has two sides. Each side
would either *face* the user or show its back to the user. What if we could only render the faces that are *facing*
the viewer?

This is exactly what *face culling* does. {{api}} checks all the faces that are *front facing* towards the viewer and
renders those while discarding all the faces that are *back facing*, saving us a lot of fragment shader calls. We do
need to tell {{api}} which of the faces we use are actually the front faces and which faces are the back faces. It
does this by a clever trick: it analyzes the *winding order* of the vertex data.

:::opengl
The project is once more the *Depth testing* scene: the two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor,
`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, the camera at (0, 0, 3), and learnopengl's `cubeVertices` and
`planeVertices`. Face culling is off – OpenGL's default.
:::
:::vulkan
The project is once more the *Depth testing* scene: the two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor,
one pipeline with the depth test (`VK_COMPARE_OP_LESS`), the camera at (0, 0, 3), and all vertices in one vertex
buffer – the cube is vertices 0..35, the floor 36..41. The pipeline's rasterizer has
`cullMode = VK_CULL_MODE_NONE`: you turned culling off in the *Coordinate systems* chapter, because learnopengl's cube
isn't made for it. In this chapter we fix that.
:::
:::d3d12
The project is once more the *Depth testing* scene: the two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor,
a PSO with the depth function LESS, the camera at (0, 0, 3), the shaders in `face_culling.hlsl`, and all vertices in
one vertex buffer – the cube is vertices 0 to 35, the floor 36 to 41. The PSO has
`psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;`: you turned culling off in the *Coordinate systems*
chapter, because learnopengl's cube isn't made for it. In this chapter we fix that.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run**
(Ctrl+Enter) to compile the program and run it in the built-in simulator.

## Winding order

When we define a set of triangle vertices we're defining them in a certain winding order that is either *clockwise*
or *counter-clockwise*. Each triangle consists of 3 vertices and we specify those 3 vertices in a winding order as
seen from the center of the triangle.

Imagine a triangle with the corners 1 at the top, 2 at the bottom right and 3 at the bottom left. Going 1 → 2 → 3
you move clockwise; going 1 → 3 → 2 you move counter-clockwise. In the vertex data, the order is simply the order in
which the corners are listed:

```text
// clockwise
vertices[0], // vertex 1
vertices[1], // vertex 2
vertices[2], // vertex 3
// counter-clockwise
vertices[0], // vertex 1
vertices[2], // vertex 3
vertices[1]  // vertex 2
```

Each set of 3 vertices that form a triangle primitive thus contain a winding order. {{api}} uses this information when
rendering your primitives to determine if a triangle is a *front-facing* or a *back-facing* triangle.

:::opengl
By default, triangles defined with counter-clockwise vertices are processed as front-facing triangles.
:::
:::vulkan
Vulkan has no default here: you choose which winding is the front with the rasterizer's `frontFace`
(`VK_FRONT_FACE_COUNTER_CLOCKWISE` or `VK_FRONT_FACE_CLOCKWISE`). Our pipeline still has vulkan-tutorial's
`VK_FRONT_FACE_CLOCKWISE` from the *Hello Triangle* chapter.
:::
:::d3d12
Direct3D's default is the opposite of OpenGL's: with `FrontCounterClockwise = FALSE` (what
`CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` sets), triangles whose corners are clockwise on the render target are the
front-facing ones. That's why the *Hello Triangle* chapter listed its triangle's corners clockwise.
:::

When defining your vertex order you visualize the corresponding triangle as if it was facing you, so each triangle
that you're specifying should be counter-clockwise as if you're directly facing that triangle. The cool thing about
specifying all your vertices like this is that the actual winding order is calculated at the rasterization stage, so
when the vertex shader has already run. The vertices are then seen as from the *viewer's* point of view – their
positions on the screen.

All the triangle vertices that the viewer is then facing are indeed in the correct winding order as we specified
them, but the vertices of the triangles at the other side of the cube are now rendered in such a way that their
winding order becomes reversed. The result is that the triangles we're facing are seen as front-facing triangles and
the triangles at the back are seen as back-facing triangles.

Think of the cube's front face and its back face, both specified counter-clockwise as seen from outside the cube. From
the camera in front of the cube, the front face's triangles are counter-clockwise. The back face's triangles were
specified counter-clockwise for someone standing *behind* the cube; seen through the cube from the front, the same
corners go round the other way: clockwise. So the back face is back-facing – exactly what we want, since it's hidden
behind the cube anyway.

```quiz
A triangle's corners are counter-clockwise on the screen as the camera sees it. The camera now moves to the other side of the triangle and looks at it from behind. How do the same corners, in the same order, appear?
- [ ] Still counter-clockwise: the winding order is stored with the vertex data
- [x] Clockwise: seen from the other side, the same corners go round the other way
- [ ] The triangle isn't visible from behind at all
- [ ] It depends on the texture coordinates
---
The order of the corners in the vertex data never changes, but their positions on the screen do. Mirrored by looking from the other side, the order goes round the other way – that's how the rasterizer tells front faces from back faces.
```

There is one catch: this only works if *every* triangle of the cube was specified counter-clockwise as seen from
outside. learnopengl's cube, the one we've used since the *Coordinate systems* chapter, wasn't made with culling in
mind: seen from outside, its front, left and bottom faces are counter-clockwise, but its back, right and top faces are
clockwise. learnopengl's face culling chapter therefore gives a new cube with every triangle counter-clockwise. It has
the same vertices and texture coordinates; in each triangle of the back, right and top faces two corners are swapped.
For the back face (z = -0.5):

:::opengl
```cpp
    float cubeVertices[] = {
        // positions          // texture Coords
        // every triangle is counter-clockwise when you look at its face from outside the cube
        // back face (z = -0.5)
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,

        // front face (z = 0.5)
        ...
```

The old back face started `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: looked at from behind (from
-z), that goes from the bottom right to the bottom left and up to the top left – clockwise.
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, {1.0f, 0.0f}},
    {{ 0.5f, -0.5f, -0.5f}, {1.0f, 1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{-0.5f,  0.5f, -0.5f}, {0.0f, 0.0f}},

    // front (z = +0.5)
    ...
```

The old back face started `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: looked at from behind (from
-z), that goes from the bottom right to the bottom left and up to the top left – clockwise. (The texture coordinates
are learnopengl's with v flipped, as before; each corner keeps its own.)
:::
:::d3d12
```cpp
            // every triangle is counter-clockwise when you look at its face from outside the cube
            // back face (z = -0.5)
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },

            // front face (z = 0.5)
            ...
```

The old back face started `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: looked at from behind (from
-z), that goes from the bottom right to the bottom left and up to the top left – clockwise. (The texture coordinates
are learnopengl's with v flipped, as before; each corner keeps its own.)
:::

You don't have to picture every face to check a triangle. For corners a, b and c, the cross product
(b − a) × (c − a) is the triangle's normal by the right-hand rule: it points towards the side from which the corners
are counter-clockwise. For the old back face that's (1, 0, 0) × (1, 1, 0) = (0, 0, 1) – into the cube, so seen from
outside it was clockwise. For the new one it's (1, 1, 0) × (1, 0, 0) = (0, 0, -1): out of the cube.

Now do the first task, **ccw-cube**: rewrite the cube's 36 vertices so that every triangle is counter-clockwise seen
from outside, keeping each vertex's texture coordinates, and press **Build & run**. Nothing changes – not a single
pixel – because nothing is culled yet. The order of a triangle's corners only matters once culling is on.

```quiz
How can you check that a triangle with the corners a, b, c (in this order) is counter-clockwise when you look at the cube's face from outside?
- [ ] All three corners have a positive z coordinate
- [ ] Its texture coordinates increase from a to c
- [ ] Its first corner is the lowest one
- [x] The cross product (b − a) × (c − a) points out of the cube
---
By the right-hand rule, (b − a) × (c − a) points towards the viewer for whom a → b → c runs counter-clockwise. If it points into the cube, swap two corners.
```

## Face culling

At the start of the chapter we said that {{api}} is able to discard triangle primitives if they're rendered as
back-facing triangles. Now that we know how to set the winding order of the vertices we can start using face
culling.

:::opengl
Face culling is disabled by default. To enable it we only have to enable OpenGL's `GL_CULL_FACE` option:

```cpp
    glEnable(GL_CULL_FACE); // do not draw the faces that point away from the camera
```

From this point on, all the faces that are not front-faces are discarded – from inside a cube you would see nothing
of it, since all its inner faces are back faces. Currently we save over 50% of performance on rendering fragments if OpenGL decides
to render the back faces first (otherwise depth testing would've discarded them already). Do note that this only
really works with closed shapes like a cube. We do have to disable face culling again when we draw the grass leaves
from the previous chapter, since their front *and* back face should be visible.

OpenGL allows us to change the type of face we want to cull as well. What if we want to cull front faces and not the
back faces? We can define this behavior with `glCullFace`:

```cpp
    glCullFace(GL_BACK);    // cull the back faces (the default)
```

The `glCullFace` function has three possible options:

- `GL_BACK`: culls only the back faces.
- `GL_FRONT`: culls only the front faces.
- `GL_FRONT_AND_BACK`: culls both the front and back faces.

The initial value of `glCullFace` is `GL_BACK`. We can also tell OpenGL we'd rather prefer clockwise faces as the
front-faces instead of counter-clockwise faces via `glFrontFace`:

```cpp
    glFrontFace(GL_CCW);    // front faces are the counter-clockwise ones (the default)
```

The default value is `GL_CCW` that stands for counter-clockwise ordering with the other option being `GL_CW` which
(obviously) stands for clockwise ordering. Both calls set the defaults, but writing them out says what the program
relies on. The three lines go where the TODO is, after `glDepthFunc`.
:::
:::vulkan
In Vulkan face culling is part of the pipeline, in the rasterization state (vulkan-tutorial's *Fixed functions*
chapter): `cullMode` says which faces to cull and `frontFace` which winding is the front.

`cullMode` takes `VK_CULL_MODE_NONE`, `VK_CULL_MODE_FRONT_BIT`, `VK_CULL_MODE_BACK_BIT` or
`VK_CULL_MODE_FRONT_AND_BACK` (both – OpenGL's `GL_FRONT_AND_BACK`). Our cube is now counter-clockwise from outside,
so the front faces should be the counter-clockwise ones – OpenGL's `GL_CCW`:

```cpp
        // Skip the triangles that face away from the camera. Front = counter-clockwise on screen, like OpenGL's GL_CCW:
        // the y flip in the projection (proj[1][1] *= -1) shows the scene upright, so a triangle that is counter-clockwise
        // seen from outside is counter-clockwise on screen too (without the flip the picture and the winding would be
        // upside down).
        rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE;
```

Why is counter-clockwise right, when Vulkan's framebuffer has y pointing down? Vulkan judges the winding in
framebuffer coordinates – on the finished image, as you see it in the window. Without the flip, GLM's projection
(made for OpenGL, with y up) would put the picture upside down in Vulkan's y-down framebuffer, and that mirror image
would reverse every triangle's winding. `ubo.proj[1][1] *= -1` turns the picture upright again, so every triangle
lands on the screen with the same orientation as in OpenGL. vulkan-tutorial makes the same switch to
`VK_FRONT_FACE_COUNTER_CLOCKWISE` when it adds this flip to its projection matrix, for this reason.

Do note that this only really works with closed shapes like a cube. Since the pipeline fixes the cull mode, the grass
leaves from the previous chapter, whose front *and* back face should be visible, would need a pipeline with
`VK_CULL_MODE_NONE`.
:::
:::d3d12
In Direct3D 12 face culling is part of the PSO's rasterizer state: `CullMode` says which faces to cull and
`FrontCounterClockwise` which winding is the front.

`CullMode` takes `D3D12_CULL_MODE_NONE`, `D3D12_CULL_MODE_FRONT` or `D3D12_CULL_MODE_BACK`; there is no option to cull
both (OpenGL's `GL_FRONT_AND_BACK`). Our cube is now counter-clockwise from outside, so the front faces should be the
counter-clockwise ones – OpenGL's `GL_CCW`. At the TODO, replace the `D3D12_CULL_MODE_NONE` line:

```cpp
        // Face culling: do not draw the triangles that face away from the camera (their back
        // faces). Which side is the front: counter-clockwise on the screen, like OpenGL's
        // default. (Direct3D's default is clockwise, but the right-handed view and projection
        // matrices give the same screen positions as OpenGL, so the same winding rule fits.)
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_BACK;
        psoDesc.RasterizerState.FrontCounterClockwise = TRUE;
```

Why counter-clockwise, when Direct3D's default is clockwise? Direct3D judges the winding on the render target – on
the finished image, as you see it in the window. This course builds view and projection with the right-handed
`XMMatrixLookAtRH` and `XMMatrixPerspectiveFovRH`, which give the same clip-space x and y as GLM's `lookAt` and
`perspective`, so every triangle lands on the screen at the same place, with the same orientation, as in OpenGL. A
face that is counter-clockwise seen from outside is then counter-clockwise on the screen whenever it faces the camera.
(Direct3D's clockwise default comes from its traditional left-handed coordinates, where models are wound the other
way.)

Do note that this only really works with closed shapes like a cube. Since the PSO fixes the cull mode, the grass
leaves from the previous chapter, whose front *and* back face should be visible, would need a PSO with
`D3D12_CULL_MODE_NONE`.
:::

:::opengl
```quiz
At which point does OpenGL decide whether a triangle is front- or back-facing?
- [ ] When `glBufferData` uploads the vertices, from their order in the buffer
- [ ] In the fragment shader, for each fragment separately
- [x] At rasterization, after the vertex shader: from the winding order of the triangle's corners on the screen
- [ ] When `glEnable(GL_CULL_FACE)` is called, once for all triangles
---
Only the transformed positions say from which side the camera sees a triangle. That's why the same triangle can be a front face from one side and a back face from the other – and why a culled triangle never reaches the fragment shader.
```
:::
:::vulkan
```quiz
Vulkan's framebuffer has y pointing down. Why is `VK_FRONT_FACE_COUNTER_CLOCKWISE` still the right choice for our counter-clockwise cube?
- [ ] Vulkan always measures the winding in object space, before any transformation
- [ ] `frontFace` is ignored when `cullMode` is `VK_CULL_MODE_BACK_BIT`
- [x] The winding is judged on the finished image, and `proj[1][1] *= -1` makes that image upright – so the triangles keep the orientation they have in OpenGL
- [ ] Vulkan's y-down axis turns clockwise triangles into counter-clockwise ones only in the vertex shader
---
Without the flip the picture would be upside down, a mirror image, and every winding reversed. With it, a face that is counter-clockwise seen from outside is counter-clockwise on the screen, exactly as in OpenGL. vulkan-tutorial switches to `VK_FRONT_FACE_COUNTER_CLOCKWISE` for this reason.
```
:::
:::d3d12
```quiz
Direct3D's default front face is clockwise. Why does the project set `FrontCounterClockwise = TRUE`?
- [ ] Culling only works with counter-clockwise front faces
- [ ] `D3D12_CULL_MODE_BACK` ignores `FrontCounterClockwise`
- [x] The winding is judged on the render target, and the right-handed matrices put every triangle on the screen as OpenGL does – so the cube's outside faces are counter-clockwise there
- [ ] The HLSL compiler reverses the vertex order of every triangle
---
`XMMatrixLookAtRH` and `XMMatrixPerspectiveFovRH` give the same clip-space x and y as GLM. A face that is counter-clockwise seen from outside is then counter-clockwise on the render target whenever it faces the camera, so counter-clockwise is the front.
```
:::

There's one more thing before we can switch culling on: the floor. Its two triangles are a front face too – the side
facing up, towards the camera above it, should be the front. But learnopengl's floor starts with the corners
(5, -0.5, 5), (-5, -0.5, 5), (-5, -0.5, -5): seen from above, that's clockwise. Culled as a back face, the floor would
simply vanish. Swapping the 2nd and 3rd corner of both triangles (each with its texture coordinates) fixes it:

:::opengl
```cpp
    float planeVertices[] = {
        // positions          // texture Coords (note we set these higher than 1 (together with GL_REPEAT as texture wrapping mode). this will cause the floor texture to repeat)
        // both triangles are counter-clockwise seen from above, so the floor's front face points up
         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,
        -5.0f, -0.5f,  5.0f,  0.0f, 0.0f,

         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
         5.0f, -0.5f, -5.0f,  2.0f, 2.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f
    };
```
:::
:::vulkan
```cpp
    // floor (y = -0.5): vertices 36..41, counter-clockwise seen from above (it was clockwise)
    {{ 5.0f, -0.5f,  5.0f}, {2.0f, 2.0f}},
    {{-5.0f, -0.5f, -5.0f}, {0.0f, 0.0f}},
    {{-5.0f, -0.5f,  5.0f}, {0.0f, 2.0f}},
    {{ 5.0f, -0.5f,  5.0f}, {2.0f, 2.0f}},
    {{ 5.0f, -0.5f, -5.0f}, {2.0f, 0.0f}},
    {{-5.0f, -0.5f, -5.0f}, {0.0f, 0.0f}}
```
:::
:::d3d12
```cpp
            // both triangles are counter-clockwise seen from above: the floor's front face points up
            { {  5.0f, -0.5f,  5.0f }, { 2.0f, 2.0f } },
            { { -5.0f, -0.5f, -5.0f }, { 0.0f, 0.0f } },
            { { -5.0f, -0.5f,  5.0f }, { 0.0f, 2.0f } },

            { {  5.0f, -0.5f,  5.0f }, { 2.0f, 2.0f } },
            { {  5.0f, -0.5f, -5.0f }, { 2.0f, 0.0f } },
            { { -5.0f, -0.5f, -5.0f }, { 0.0f, 0.0f } }
```
:::

```quiz
What would happen with back-face culling on if you left learnopengl's floor vertices as they were?
- [ ] Nothing: a floor is a single plane, so culling never applies to it
- [x] The floor would disappear: its triangles are clockwise seen from above, so the camera sees their back face
- [ ] Only the half of the floor behind the cubes would disappear
- [ ] The floor would show its texture mirrored
---
Culling doesn't know about floors and cubes, only about triangles and their winding on the screen. The camera looks at the floor from above; if its corners are clockwise from there, both triangles are back faces and get culled.
```

Now do the task **cull-back**: turn culling on as shown above and fix the floor, then press **Build & run**. You
should see... exactly the same picture as before. (A few floor pixels may differ by a level or two from rounding.)

That's not a mistake. The cubes' back faces – the far sides of each cube – were already hidden: they were drawn, but
the front faces covered them, and wherever a back face was drawn after a front face, the depth test threw its
fragments away. Now they aren't even rasterized, so the fragment shader never runs for them. The picture is the same;
the work is less.

```quiz
After the **cull-back** task the picture looks exactly as before. What did culling change?
- [x] The back faces are no longer rasterized, so the fragment shader doesn't run for them – before, they were drawn and then hidden by the front faces and the depth test
- [ ] Nothing: the depth test already skips back faces before they are rasterized
- [ ] The back faces are now drawn with a transparent colour
---
Without culling the GPU shaded the hidden back faces too, and either overwrote them with the front faces or rejected them in the depth test. Culling drops them right after the vertex shader – more than half the fragment work of a cube saved, with no visible difference.
```

This is all well and good, but let's see what happens when we cull the faces we *can* see. learnopengl's chapter
tries the other winding: with `glFrontFace(GL_CW)` the counter-clockwise faces become the back faces, and back-face
culling now removes the faces that face the camera. The same happens if you keep counter-clockwise front faces and
cull the front faces instead:

:::opengl
```cpp
    glCullFace(GL_FRONT);   // cull the front faces: now only the back faces (the cubes' insides) are drawn
```
:::
:::vulkan
```cpp
        rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT; // the exercise: skip the front faces instead
```
:::
:::d3d12
```cpp
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;    // cull the front faces: now only the back faces (the cubes' insides) are drawn
```
:::

Now do the last task, **cull-front**, and press **Build & run**. The cubes keep their outlines, but you now look into
them: the faces nearest to you are gone, and you see the inside of the far faces, with the marble on them. And the floor has disappeared: its front face points up, at the camera, so
it's culled now.

```quiz
With the front faces culled, why do the cubes look hollow, while the floor disappears completely?
- [x] Each cube still has back faces – its far sides, seen from inside – but the floor's only face that the camera sees is its front face
- [ ] The floor is drawn after the cubes, and culling only affects the last draw call
- [ ] The cubes' marble texture has an alpha channel, the floor's metal texture doesn't
- [ ] The floor is too far away to be rasterized
---
A closed cube always has faces turned away from the camera, which are now drawn. The floor is a single surface seen from above: its front face is culled, and its back face points down, away from the camera, so nothing of it is left.
```

Face culling is a great tool for increasing performance of your applications with minimal effort; especially as all
3D applications export models with consistent winding orders (counter-clockwise by default). You do have to keep track
of the objects that will actually benefit from face culling and which objects shouldn't be culled at all.

## Exercises

- Can you re-define the vertex data by specifying each triangle in clockwise order and then render the scene with
  clockwise triangles set as the front faces? The picture should look exactly like the one after the **cull-back**
  task – including the floor.

:::opengl
Clockwise front faces are `glFrontFace(GL_CW)`.
:::
:::vulkan
Clockwise front faces are `rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE`.
:::
:::d3d12
Clockwise front faces are `FrontCounterClockwise = FALSE`, Direct3D's default.
:::
