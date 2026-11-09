# depth-testing – DirectX 12

learnopengl.com "Depth testing": `depth_testing.cpp` (1.1) and `1.2.depth_testing.fs` (depth_testing_view).
Files: `main.cpp`, `depth_testing.hlsl`, `marble.png`, `metal.png`.

Start: learnopengl's scene – two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor (learnopengl's
`planeVertices`, y = -0.5, ±5), clear colour (0.1, 0.1, 0.1), the camera globals of the Camera chapter at (0, 0, 3)
looking down -z (yaw -90, pitch 0, fov 45, 800/600, 0.1, 100). One vertex buffer holds the cube (vertices 0–35) and the
floor (36–41); the cubes are drawn with `DrawInstanced(36, 1, 0, 0)`, the floor with `DrawInstanced(6, 1, 36, 0)`
(learnopengl's two VAOs). Texture coordinates are learnopengl's with v flipped (`1 - v`, the floor `2 - v`) because
Direct3D's v = 0 is the image's top row, so every image is upright. Textures: one SRV each in the CBV/SRV heap (CBV
slot 0, marble slot 1, metal slot 2); root parameter 2 is a one-SRV descriptor table set before each draw with
`SetGraphicsRootDescriptorTable(2, cubeTexture)` / `(2, floorTexture)` (`CD3DX12_GPU_DESCRIPTOR_HANDLE(heapStart, 1 / 2,
m_cbvSrvDescriptorSize)`) – learnopengl's `glBindTexture`. The static sampler s0 wraps (the floor's coordinates go up to
2). Model matrix = root constants (root parameter 0), view/projection = the CBV (root parameter 1). Draw order as
learnopengl: cube 0, cube 1, floor. `CullMode = D3D12_CULL_MODE_NONE`. The PSO's depth state is
`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` followed by `psoDesc.DepthStencilState.DepthFunc =
D3D12_COMPARISON_FUNC_LESS;` written out (learnopengl's `glDepthFunc(GL_LESS)`).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). D3D12 cannot run here:
the colours come from the app's simulator (one mip level as in the code) and agree with the OpenGL project's Mesa
screenshots of the same steps (OpenGL's mipmaps make the far floor and cube 1 a few units brighter). Named points:
**c0** (190,300) = cube 0's front face, **c0-low** (190,380) = the lower part of cube 0's front face (below the horizon,
where the floor lies behind it), **c1** (760,300) = cube 1 at the right border, **floor-near** (400,520),
**floor-left** (150,450), **floor-far** (400,370), **background** (400,300) and (400,150) = 26,26,26.

Start picture: two marble cubes standing on a grey metal floor (chevron pattern, far edge = the horizon at y ≈ 345):
c0 ≈ 151,150,147, c0-low ≈ 206,202,193, c1 ≈ 139,138,136 (OpenGL 149,147,145), floor-near 84,88,94, floor-left
139,143,149, floor-far ≈ 79,83,89 (OpenGL 84,88,94), background 26,26,26.

## depth-always
- **Task:** Make every pixel pass the depth test: set the PSO's `DepthStencilState.DepthFunc` to `D3D12_COMPARISON_FUNC_ALWAYS`.
- **Hint:** It is the line `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;` in `LoadAssets` – the depth state is part of the pipeline state object, like OpenGL's `glDepthFunc(GL_ALWAYS)`.
- **When done:** `main.cpp`: `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS;` (the `LESS` line is
  gone). The floor, drawn last, now covers the cubes wherever they overlap it: the lower part of both cubes shows the
  metal floor – c0-low ≈ 126,130,136 (OpenGL 130,134,140); above the horizon the cubes still show, but as their
  last-drawn faces (the inside of the box: c0 151,150,147, (120,250) 206,202,192). floor-near, floor-left, background
  unchanged.

## depth-less
- **Task:** Set the depth function back to `D3D12_COMPARISON_FUNC_LESS` (learnopengl's default).
- **Hint:** Same line as before. LESS keeps a pixel only if it is nearer than the one already in the depth buffer.
- **When done:** `main.cpp`: `psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;` again (no `ALWAYS`).
  The picture is the start picture again (c0-low ≈ 206,202,193 marble).

## visualize-depth
- **Task:** In `PSMain` (`depth_testing.hlsl`) return the pixel's depth as a grey colour: `return float4(input.position.zzz, 1.0f);`.
- **Hint:** In the pixel shader the `SV_POSITION` input holds the pixel's window position in x, y and its depth (0 at the near plane, 1 at the far plane) in z – GLSL's `gl_FragCoord`. learnopengl: `FragColor = vec4(vec3(gl_FragCoord.z), 1.0);`.
- **When done:** `depth_testing.hlsl`: `PSMain` returns `float4(input.position.zzz, 1.0f)` (no texture sample). The depth
  is not linear – almost everything is near-white: c0 248,248,248, c0-low 248, c1 247,247,247, floor-near 240,240,240,
  floor-left 245, floor-far 250,250,250; the background stays 26,26,26 (nothing drawn there).

## linear-depth
- **Task:** Add learnopengl's `LinearizeDepth` with `near = 0.1` and `far = 100.0` (as `static const float`) and return `LinearizeDepth(input.position.z) / far` as grey.
- **Hint:** Direct3D's depth is already 0..1, so the formula is `(near * far) / (far - depth * (far - near))` – learnopengl first maps OpenGL's depth back to NDC (`z * 2.0 - 1.0`, because OpenGL's NDC z is -1..1) and uses `(2.0 * near * far) / (far + near - z * (far - near))`; both give the distance from the camera. `static const`: a global without `static` would be a constant-buffer value set from the CPU.
- **When done:** `depth_testing.hlsl`: `static const float near = 0.1f;`, `static const float far = 100.0f;`, `float
  LinearizeDepth(float depth) { return (near * far) / (far - depth * (far - near)); }` before `PSMain`, and `PSMain`:
  `float depth = LinearizeDepth(input.position.z) / far; return float4(depth, depth, depth, 1.0f);`. Everything drawn is
  almost black (distances of a few units out of 100), darker the nearer: floor-near 4,4,4, floor-left 6,6,6, c1 8,8,8,
  c0 9,9,9, c0-low 9,9,9, floor-far 13,13,13; background 26,26,26.
