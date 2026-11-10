# framebuffers – DirectX 12

learnopengl.com "Framebuffers": `5.1.framebuffers` (render to a texture, then a screen quad) and its post-processing
effects (inversion, grayscale, kernels: sharpen, blur, edge detection). Direct3D 12 has no framebuffer object: an
off-screen render target is a texture created with `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET` plus two views – a render
target view (RTV) to draw into it and a shader resource view (SRV) to read it – and barriers that switch it between
RENDER_TARGET and PIXEL_SHADER_RESOURCE (Microsoft's "Render targets" / "Resource binding" docs).
Files: `main.cpp`, `framebuffers.hlsl` (the scene's shaders = depth_testing.hlsl of the depth-testing chapter),
`framebuffers_screen.hlsl` (the screen quad's shaders), `marble.png`, `metal.png`.

Start: the depth-testing scene drawn to the window (two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor,
clear (0.1, 0.1, 0.1), camera (0, 0, 3) looking down -z, fov 45, 800/600, 0.1, 100). One vertex buffer: cube =
vertices 0–35, floor = 36–41. Heaps: RTV heap = the 2 swap chain buffers; CBV/SRV heap = CBV (slot 0), marble (1), metal
(2). TODO comments mark: the off-screen render target in `LoadAssets`, the screen quad's PSO, the quad's vertices, the
first pass and the second pass in `PopulateCommandList`; `framebuffers_screen.hlsl` exists with a finished `VSMain`
and a `PSMain` that returns black (TODO).

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves). Named points (as in
depth-testing): **c0** (190,300) cube 0's front face, **c0-low** (190,380), **c1** (760,300), **floor-near** (400,520),
**floor-left** (150,450), **floor-far** (400,370), **background** (400,300) and (400,150).
D3D12 cannot run here. The start picture is the simulator's; the pictures after `offscreen-target` are what the
program draws (the simulator does not follow the off-screen pass yet), computed from the start picture with the
shader's maths (bilinear samples, offset 1/300) and checked against the OpenGL project's Mesa screenshots of the
same steps (OpenGL in brackets where it differs by more than a few units – OpenGL's mipmapped textures).

Start picture: c0 ≈ 151,150,147, c0-low ≈ 206,202,193, c1 ≈ 139,138,136 (OpenGL 149,147,145), floor-near 84,88,94,
floor-left 139,143,149, floor-far ≈ 79,83,89 (OpenGL 84,88,94), background 26,26,26.

## offscreen-target
- **Task:** Draw the scene into an off-screen render target: create `m_offscreenTarget` (a window-sized
  `R8G8B8A8_UNORM` texture with `ALLOW_RENDER_TARGET`) with an RTV and an SRV, and in `PopulateCommandList` draw the
  scene into it; the window itself is only cleared to white.
- **Hint:** The RTV heap needs one more descriptor (`FrameCount + 1`: the RTV goes after the swap chain's), the
  CBV/SRV heap one more (`4`: the SRV goes to slot 3). The texture starts in `PIXEL_SHADER_RESOURCE`; each frame a
  barrier turns it into a `RENDER_TARGET` for the scene and another one back. The scene keeps using the depth buffer
  (learnopengl's depth/stencil renderbuffer); the window's pass gets `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`
  – no depth buffer.
- **When done:** `main.cpp`: member `ComPtr<ID3D12Resource> m_offscreenTarget;`, `rtvHeapDesc.NumDescriptors =
  FrameCount + 1;`, `cbvSrvHeapDesc.NumDescriptors = 4;`, in `LoadAssets` a block with
  `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, 1, 0,
  D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, `CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM,
  optimizedClearColor)` (0.1, 0.1, 0.1, 1), `CreateCommittedResource(…, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
  &clearValue, IID_PPV_ARGS(&m_offscreenTarget))`, `CreateRenderTargetView(m_offscreenTarget.Get(), nullptr, rtvHandle)`
  at RTV slot `FrameCount`, `CreateShaderResourceView(m_offscreenTarget.Get(), &srvDesc, srvHandle)` at CBV/SRV slot 3
  (`D3D12_SRV_DIMENSION_TEXTURE2D`). `PopulateCommandList`: barrier `m_offscreenTarget` PIXEL_SHADER_RESOURCE →
  RENDER_TARGET, `OMSetRenderTargets(1, &offscreenRtvHandle, FALSE, &dsvHandle)` (RTV slot FrameCount), clear 0.1 and
  depth, the three scene draws, barrier RENDER_TARGET → PIXEL_SHADER_RESOURCE, then barrier back buffer PRESENT →
  RENDER_TARGET, `OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`, `ClearRenderTargetView(rtvHandle,
  screenClearColor, 0, nullptr)` with `{ 1.0f, 1.0f, 1.0f, 1.0f }`, barrier back to PRESENT.
  **The window is white everywhere (255,255,255)** – the scene is drawn, but into the texture, which nothing shows yet.

## screen-quad
- **Task:** Show the texture: add the screen quad (vertices 42–47), its pipeline state `m_screenPipelineState`
  (`framebuffers_screen.hlsl`, no depth test), and draw it in the window's pass with the off-screen texture; in
  `framebuffers_screen.hlsl` return the texture's colour.
- **Hint:** The quad is learnopengl's `quadVertices` – already in normalized device coordinates, so its vertex shader
  uses no matrices – with z = 0 and v flipped (D3D's v = 0 is the texture's top row, which is the top of the rendered
  scene). Its PSO is the scene's description with the other shaders, `DepthStencilState.DepthEnable = FALSE` and
  `DSVFormat = DXGI_FORMAT_UNKNOWN` (the window's pass has no depth buffer – learnopengl's `glDisable(GL_DEPTH_TEST)`).
  The texture's SRV is in heap slot 3: `CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(heapStart, 3, m_cbvSrvDescriptorSize)`.
- **When done:** `main.cpp`: member `m_screenPipelineState`; `LoadAssets` compiles `framebuffers_screen.hlsl`
  (`VSMain` vs_5_0, `PSMain` ps_5_0) into `screenVertexShader` / `screenPixelShader`, sets `psoDesc.VS`/`PS`,
  `psoDesc.DepthStencilState.DepthEnable = FALSE;`, `psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;` and creates
  `m_screenPipelineState`; the vertex array ends with 6 quad vertices `{ { -1.0f, 1.0f, 0.0f }, { 0.0f, 0.0f } }` …
  `{ { 1.0f, 1.0f, 0.0f }, { 1.0f, 0.0f } }`; `PopulateCommandList`, after the white clear:
  `SetPipelineState(m_screenPipelineState.Get())`, `SetGraphicsRootDescriptorTable(2, screenTexture)` (slot 3),
  `DrawInstanced(6, 1, 42, 0)`. `framebuffers_screen.hlsl` `PSMain`: `float3 col = screenTexture.Sample(wrapSampler,
  input.texCoord).rgb; return float4(col, 1.0f);`. The scene appears again, exactly as at the start (no white
  anywhere): c0 151,150,147, c0-low 206,202,193, floor-near 84,88,94, floor-left 139,143,149, background 26,26,26.

## inversion
- **Task:** Post-processing: in `framebuffers_screen.hlsl` return the inverted colour, `1.0f - colour` (alpha 1).
- **Hint:** `return float4(1.0f - screenTexture.Sample(wrapSampler, input.texCoord).rgb, 1.0f);` – learnopengl's
  `vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0)`.
- **When done:** `PSMain` returns `float4(1.0f - screenTexture.Sample(…).rgb, 1.0f)`. Every pixel is 255 minus the start
  colour: background 229,229,229 (light grey), c0 ≈ 104,105,108, c0-low ≈ 49,53,62 (dark blue-grey marble),
  floor-near 171,167,161, floor-left 116,112,106 (brownish floor).

## grayscale
- **Task:** Replace the inversion with learnopengl's weighted grayscale: `0.2126 * r + 0.7152 * g + 0.0722 * b` in all
  three channels.
- **Hint:** Sample into a `float4 color`, compute `float average = …;` and return `float4(average, average, average, 1.0f)`.
- **When done:** `PSMain`: `float average = 0.2126f * color.r + 0.7152f * color.g + 0.0722f * color.b;
  return float4(average, average, average, 1.0f);` (no `1.0f -`). Every pixel has r = g = b: background 26,26,26,
  c0 ≈ 150,150,150, c0-low ≈ 202, floor-near 88,88,88, floor-left 143,143,143.

## sharpen
- **Task:** Replace the grayscale with a 3×3 kernel effect: sample the 9 pixels around (offset `1.0f / 300.0f`),
  multiply them by learnopengl's sharpen kernel (`-1` around, `9` in the middle) and add them up.
- **Hint:** `static const float offset = 1.0f / 300.0f;` before `PSMain`; inside, `float2 offsets[9] = { … };`,
  `float kernel[9] = { … };`, a loop filling `float3 sampleTex[9]` and a loop summing `sampleTex[k] * kernel[k]`. HLSL
  arrays are initialised with `{ … }` (GLSL: `vec2[](…)`); in Direct3D v grows downwards, so the top row of `offsets`
  has `-offset` in y.
- **When done:** `framebuffers_screen.hlsl`: `static const float offset = 1.0f / 300.0f;`, `float2 offsets[9]` (top-left
  `float2(-offset, -offset)` … bottom-right `float2(offset, offset)`), `float kernel[9] = { -1.0f, -1.0f, -1.0f, -1.0f,
  9.0f, -1.0f, -1.0f, -1.0f, -1.0f };`, the two loops and `return float4(col, 1.0f);`. Flat areas keep their colour
  (background 26,26,26, floor-near ≈ 86,90,96); edges and the marble veins get hard and bright/dark: c0-low ≈ 239,229,221,
  floor-left ≈ 20,24,30 (OpenGL 18,22,28), the cube outlines show bright fringes.

## blur
- **Task:** Change the kernel to learnopengl's blur: `1, 2, 1 / 2, 4, 2 / 1, 2, 1`, each divided by 16.
- **Hint:** Only the `kernel` array changes; the weights add up to 1, so the brightness stays.
- **When done:** `kernel` = `{ 1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f, 2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
  1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f }`. The picture looks like the start, slightly blurred: background 26,26,26,
  c0 ≈ 150,149,146, c0-low ≈ 203,200,191, floor-near 84,88,94, floor-left ≈ 149,153,159.

## edge-detection
- **Task:** Change the kernel to learnopengl's edge detection: `1` around, `-8` in the middle.
- **Hint:** The weights add up to 0: wherever the colour does not change, the result is black.
- **When done:** `kernel` = `{ 1.0f, 1.0f, 1.0f, 1.0f, -8.0f, 1.0f, 1.0f, 1.0f, 1.0f }`. Almost everything is black
  (background 0,0,0, floor-near 0,0,0, c0-low 0,0,0, c0 ≈ 2,1,0 (OpenGL 13,11,9)); only edges are bright: the cubes'
  outlines, the marble veins, the floor pattern (floor-left ≈ 119,119,119) and the horizon line. This is the solution.
