# face-culling – DirectX 12

learnopengl.com "Face culling" (the chapter has no program of its own: its counter-clockwise cube is in the text).
Files: `main.cpp`, `face_culling.hlsl`, `marble.png`, `metal.png`.

Start: the Depth testing scene (marble cubes at (-1, 0, -1) and (2, 0, 0), metal floor, LESS, camera at (0, 0, 3), draw
order cube 0, cube 1, floor; one vertex buffer: cube 0–35, floor 36–41), shaders in `face_culling.hlsl`. The PSO has
`psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;` (no culling, learnopengl's default) with a TODO line above it.

Winding in D3D12: the rasterizer decides front or back by the order of a triangle's corners **on the render target**
(as seen on the screen): `FrontCounterClockwise = FALSE` (the `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` default) makes the
clockwise ones front faces, `TRUE` the counter-clockwise ones. This course builds view and projection with the
right-handed `XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`, which give the same clip-space x and y as GLM's
`lookAt` / `perspective`, so every triangle lands at the same screen positions, with the same orientation, as in
OpenGL. A face that is counter-clockwise seen from outside the cube (learnopengl's rule) is counter-clockwise on the
screen whenever it faces the camera – so `FrontCounterClockwise = TRUE` matches OpenGL's default `glFrontFace(GL_CCW)`.
(The Hello Triangle chapter's clockwise triangle was drawn with Direct3D's defaults: there the vertices were given
directly in clip space, clockwise.)

The floor: learnopengl's `planeVertices` are **clockwise seen from above** (normal of (5,-0.5,5), (-5,-0.5,5),
(-5,-0.5,-5) points down), so with back-face culling the floor would vanish (it is seen from above). The `cull-back`
task swaps the 2nd and 3rd corner of both floor triangles (same texture coordinates per corner – no visible change).

The CCW cube: learnopengl's cube with, in each clockwise triangle (both triangles of the back, right and top faces – every
triangle checked with the cross product against the face's outward normal) the 2nd and 3rd corner swapped. Each corner keeps its texture coordinates, so the picture does not change; the faces
are commented (`// back face (z = -0.5)` …).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). D3D12 cannot run here:
the colours come from the app's simulator and agree with the OpenGL project's Mesa screenshots of the same steps
(OpenGL's mipmaps make cube 1 a little brighter). Named points: **c0** (190,300) = cube 0's front face, **c0-top**
(120,220) = its top face, **c0-right** (295,250) = its right face, **c0-low** (190,380), **c1** (760,300),
**floor-near** (400,520), **floor-left** (150,450), **background** (400,300) = 26,26,26.

Start picture: c0 151,150,147, c0-top 208,204,193, c0-right 168,167,162, c0-low 206,202,193, c1 ≈ 139,138,136 (OpenGL
149,147,145), floor-near 84,88,94, floor-left 139,143,149.

## ccw-cube
- **Task:** Replace the cube's 36 vertices with a cube whose every triangle is counter-clockwise when you look at its face from outside.
- **Hint:** For each triangle, look at its face from outside the cube (e.g. the back face z = -0.5 from behind, from -z): if the corners go clockwise, swap two of them (keep each corner's texture coordinates). Check: the cross product (b - a) × (c - a) points outwards.
- **When done:** `main.cpp`: the first 36 entries of `vertices[]` are the CCW cube (comments `// back face (z = -0.5)`,
  `// front face (z = 0.5)`, `// left face`, `// right face`, `// bottom face`, `// top face`); e.g. the back face starts
  `{ { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } }, { { 0.5f, 0.5f, -0.5f }, { 1.0f, 0.0f } }, { { 0.5f, -0.5f, -0.5f },
  { 1.0f, 1.0f } }`. No visible change (nothing is culled yet).

## cull-back
- **Task:** Turn on back-face culling with counter-clockwise front faces (`CullMode = D3D12_CULL_MODE_BACK`, `FrontCounterClockwise = TRUE`), and make the floor's two triangles counter-clockwise seen from above so the floor stays visible.
- **Hint:** Both are fields of `psoDesc.RasterizerState` (OpenGL: `glEnable(GL_CULL_FACE); glCullFace(GL_BACK); glFrontFace(GL_CCW);`). Direct3D's default front is clockwise – but with the right-handed matrices the screen looks like OpenGL's. The floor: swap the 2nd and 3rd vertex of each of its triangles.
- **When done:** `main.cpp`: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_BACK;` and
  `psoDesc.RasterizerState.FrontCounterClockwise = TRUE;` (no `D3D12_CULL_MODE_NONE`); the floor's vertices in the order
  (5, -0.5, 5), (-5, -0.5, -5), (-5, -0.5, 5) and (5, -0.5, 5), (5, -0.5, -5), (-5, -0.5, -5). No visible change: the
  cubes' hidden faces are culled now, the floor still shows (floor-near 84,88,94, floor-left 139,143,149, c0
  151,150,147). (Without the floor fix the floor would disappear: floor-near 26,26,26.)

## cull-front
- **Task:** learnopengl's exercise: cull the front faces instead (`D3D12_CULL_MODE_FRONT`).
- **Hint:** Only `CullMode` changes. You now see each cube's back faces – the inside of the box – and the floor (whose front faces up) disappears.
- **When done:** `main.cpp`: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;` (`FrontCounterClockwise = TRUE`
  stays). The cubes show their **inner faces** (the far walls, the marble seen mirrored): c0 ≈ 198,195,186,
  c0-top ≈ 215,212,201, c0-right ≈ 216,212,201, c0-low ≈ 184,182,174 (OpenGL 198,195,186), c1 ≈ 178,176,169; the
  **floor is gone**: floor-near 26,26,26, floor-left 26,26,26, background 26,26,26.
