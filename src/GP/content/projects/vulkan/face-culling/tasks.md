# Face Culling (Vulkan) – winding order and culling (learnopengl "Face culling")

learnopengl's face culling chapter (its counter-clockwise cube from the chapter text). Files: `main.cpp`,
`shaders/face_culling.vert` / `.frag`, `textures/marble.png`, `textures/metal.png`.

Start: the Depth Testing scene (see that chapter's tasks.md: one vertex buffer – cube vertices 0..35, floor 36..41 –,
one descriptor set per texture, one pipeline with `rasterizer.cullMode = VK_CULL_MODE_NONE`, depth LESS), drawn cube 0,
cube 1, floor. learnopengl's cube has mixed winding: seen from outside, the back, right and top faces are clockwise, the
front, left and bottom faces counter-clockwise. learnopengl's floor is clockwise seen from above.

Pixels measured on lavapipe, 800×600, nothing depends on time. Start = the Depth Testing start: **background**
(400,100) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138, (150,250) ≈ 208,204,194, (193,390) ≈ 193,190,182;
**cube 1** (760,250) ≈ 163,161,156; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93, **floor-far**
(600,370) ≈ 130,134,140.

## ccw-cube
- **Task:** Replace the cube's 36 vertices with a cube whose every face is counter-clockwise seen from outside.
- **Hint:** Seen from outside, go round each triangle counter-clockwise. learnopengl's vertices only need fixing on the
  back, right and top faces: swap two vertices of each of their triangles (keep each vertex's texture coordinates with
  it, so the images stay where they were).
- **When done:** no visible change (culling is still off): all points as at the start, pixel for pixel.

## cull-back
- **Task:** Cull the back faces: `rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;` with
  `rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE;`, and make the floor counter-clockwise seen from above (swap
  the 2nd and 3rd vertex of both floor triangles).
- **Hint:** Vulkan decides the winding on screen (framebuffer coordinates, y down). Without the y flip in the projection
  the picture would be upside down and every triangle's winding reversed. `proj[1][1] *= -1` turns the picture upright
  again, so a triangle that is counter-clockwise seen from outside is counter-clockwise on screen, exactly as in
  OpenGL: `VK_FRONT_FACE_COUNTER_CLOCKWISE` is OpenGL's `glFrontFace(GL_CCW)` (vulkan-tutorial switches to
  COUNTER_CLOCKWISE for the same reason when it adds the projection). learnopengl's floor is clockwise seen from
  above, so with culling it would vanish – hence the swap.
- **When done:** no visible change: the cubes look the same (only their back faces, which are hidden anyway, are
  skipped) and the floor still shows: all points as at the start (a few floor pixels differ by 1–2 levels from
  interpolation order). Code: `VK_CULL_MODE_BACK_BIT`, `VK_FRONT_FACE_COUNTER_CLOCKWISE`.

## cull-front
- **Task:** learnopengl's exercise: cull the front faces instead: `rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT;`.
- **Hint:** Now only the faces turned away from the camera are drawn – you look into the cubes. The floor's upper side
  is its front face, so it disappears too (as in OpenGL with `glCullFace(GL_FRONT)`).
- **When done:** the cubes show their insides (the far faces): **cube0-centre** (193,300) ≈ 155,154,150, (193,390) ≈
  199,196,187, (760,250) ≈ 212,208,197 (cube 1's inside right face); the floor is gone: **floor-near** (100,500),
  (400,560) and **floor-far** (600,370) = 26,26,26 (background); background unchanged. Equal to the OpenGL
  chapter's final picture (within texture filtering).
