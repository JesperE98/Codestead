# Face Culling – tasks (OpenGL)

learnopengl "Face culling" (the chapter has no source file; its counter-clockwise cube is written out here). Files:
`main.cpp`, `shader_m.h`, `face_culling.vs`, `face_culling.fs` (the textured shaders of Depth Testing), `marble.png`,
`metal.png`.

Start: the Depth Testing scene drawn normally (`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, cube 0 at (-1, 0, -1),
cube 1 at (2, 0, 0), then the floor), same camera globals (cameraPos (0, 0, 3) looking down -z, fov 45), clear colour
(0.1, 0.1, 0.1), learnopengl's cube vertices (mixed winding) and plane vertices. One TODO after `glDepthFunc`: face
culling.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Start picture = the Depth Testing start: **background** (400,100) = 26,26,26; **cube 0** (front face x ≈ 90..319, y ≈
197..402): **cube0-centre** (193,300) ≈ 141,140,138, (150,250) ≈ 208,204,194; **cube 1** (only its left face, at the
right edge) (760,250) ≈ 168,165,159; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93, **floor-far**
(600,370) ≈ 135,139,145.

## `ccw-cube`
- **Task:** Replace `cubeVertices` with a cube whose every triangle is counter-clockwise when you look at its face from outside the cube; keep each vertex's texture coordinate.
- **Hint:** Look at each face from outside (the back face from behind, the top face from above …) and order each triangle's corners counter-clockwise. In learnopengl's cube the back, right and top faces are clockwise: swapping two corners of each of their triangles fixes them.
- **When done:** `cubeVertices` has the same 36 vertices (6 faces × 2 triangles, each vertex with its old texture
  coordinate), commented per face (`// back face (z = -0.5)`, `// front face (z = 0.5)`, `// left face (x = -0.5)`,
  `// right face (x = 0.5)`, `// bottom face (y = -0.5)`, `// top face (y = 0.5)`); the triangles of the back, right and top
  faces have their 2nd and 3rd corner swapped, e.g. the back face starts `(-0.5, -0.5, -0.5) (0, 0)`, `(0.5, 0.5, -0.5)
  (1, 1)`, `(0.5, -0.5, -0.5) (1, 0)`. Every triangle's normal (b - a) × (c - a) points out of the cube. **Nothing
  visible changes** (identical pixels): culling is still off.

## `cull-back`
- **Task:** Enable face culling: cull the back faces, with counter-clockwise triangles as the front faces. Make sure the floor still shows: its triangles must be counter-clockwise seen from above.
- **Hint:** `glEnable(GL_CULL_FACE); glCullFace(GL_BACK); glFrontFace(GL_CCW);` (the last two are the defaults). learnopengl's `planeVertices` are clockwise seen from above (the camera is above the floor) – swap the 2nd and 3rd vertex of both triangles.
- **When done:** `glEnable(GL_CULL_FACE);`, `glCullFace(GL_BACK);`, `glFrontFace(GL_CCW);` after `glDepthFunc`; the
  plane's triangles are `(5, 5) (-5, -5) (-5, 5)` and `(5, 5) (5, -5) (-5, -5)` (x, z at y = -0.5, each vertex with its
  old texture coordinate; comment: counter-clockwise seen from above). **Nothing visible changes**: same picture (a few
  floor pixels may differ by 1 from rounding) – the cubes' back faces were hidden by the depth test anyway, now they are
  not even rasterised. Without the plane fix the floor would vanish (its front face would point down).

## `cull-front`
- **Task:** learnopengl's exercise: cull the front faces instead (`glCullFace(GL_FRONT)`).
- **Hint:** Now only the faces that point away from the camera are drawn: you look into the cubes.
- **When done:** `glCullFace(GL_FRONT);` instead of `GL_BACK`. The cubes show their **back (inside) faces** – the far
  sides of each cube, seen through the missing near faces (the outlines stay the same): **cube0-centre** (193,300) ≈
  155,154,150, cube 1 (760,250) ≈ 213,209,197 (other parts of the marble than before). The **floor disappears** (its
  front face points up at the camera): **floor-near** (100,500), (400,560) and **floor-far** (600,370) = 26,26,26.
  Background unchanged. Final state.

## Other APIs (for the chapter text)
Winding is judged on the finished image, as you see it in the window. With learnopengl's vertex data, Vulkan's
`proj[1][1] *= -1` exactly undoes Vulkan's downward y, and Direct3D's right-handed projection keeps OpenGL's clip space,
so both show the same upright picture as OpenGL – and the cube's outside faces are counter-clockwise on screen there
too. So the same choice gives the same result: Vulkan `frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE` (vulkan-tutorial
switches to it for this reason when it adds the y flip – its own vertices were written for y-down and the flip
reverses them on screen), Direct3D `FrontCounterClockwise = TRUE`.
