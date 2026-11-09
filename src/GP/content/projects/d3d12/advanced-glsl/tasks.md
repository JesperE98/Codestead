# advanced-glsl – DirectX 12

learnopengl.com "Advanced GLSL" and `8.advanced_glsl_ubo`, in HLSL terms: the pixel shader's built-in inputs
(`SV_Position` = GLSL's `gl_FragCoord`, `SV_IsFrontFace` = `gl_FrontFacing`), the struct between the shader stages
(GLSL's interface block), and one constant buffer shared by several pipeline states (GLSL's uniform block).
Files: `main.cpp`, `advanced_glsl.hlsl` (= depth_testing.hlsl at the start), `uniform_buffer.hlsl` (the demo's vertex
shader), `red.hlsl`, `green.hlsl`, `blue.hlsl`, `yellow.hlsl` (one `PSMain` each, returning its colour), `marble.png`,
`metal.png` – the five demo shader files are complete from the start.

Start: the depth-testing scene (two marble cubes at (-1, 0, -1) and (2, 0, 0), the metal floor, clear 0.1, camera (0, 0, 3)
looking down -z, fov 45, 800/600, 0.1, 100), with the face-culling chapter's counter-clockwise cube (every triangle
counter-clockwise seen from outside) and `psoDesc.RasterizerState.FrontCounterClockwise = TRUE;` – still
`CullMode = D3D12_CULL_MODE_NONE`, so nothing changes on screen. The floor keeps learnopengl's order (clockwise seen
from above: a back face). TODO comments mark the culling line, the demo's PSOs and draws.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s (nothing moves); colours from the app's
simulator, which agree with the OpenGL project's Mesa screenshots of the same steps (OpenGL in brackets where its
mipmaps differ). Named points: **c0** (190,300) cube 0's front face, **c0-low** (190,380), **c0-left** (120,250) and
**c0-right** (230,250) (left / right part of cube 0's upper half), **c1** (760,300), **floor-near** (400,520),
**floor-left** (150,450), **floor-far** (400,370), **background** (400,150).

Start picture: as depth-testing: c0 ≈ 151,150,147, c0-low ≈ 206,202,193, c1 ≈ 139,138,136, floor-near 84,88,94,
floor-left 139,143,149, background 26,26,26.

## frag-coord
- **Task:** In `PSMain` (`advanced_glsl.hlsl`) colour by the pixel's window position: red `(1, 0, 0, 1)` where
  `input.position.x < 400.0f`, else green `(0, 1, 0, 1)` – learnopengl's split screen.
- **Hint:** In the pixel shader the `SV_POSITION` input holds the pixel's window position in pixels (x from the left, y
  from the TOP – GLSL's `gl_FragCoord.y` counts from the bottom; x is the same).
- **When done:** `advanced_glsl.hlsl` `PSMain`: `if (input.position.x < 400.0f) return float4(1.0f, 0.0f, 0.0f, 1.0f);
  else return float4(0.0f, 1.0f, 0.0f, 1.0f);` (no texture sample). Everything drawn (cubes and floor) is pure red
  255,0,0 left of x = 400 and pure green 0,255,0 right of it: c0, c0-low, floor-left 255,0,0; c1, floor-near (400,520)
  and floor-far (400,370) 0,255,0 (x = 400 is on the right side); the background stays 26,26,26.

## front-facing
- **Task:** Cull the cubes' FRONT faces (`CullMode = D3D12_CULL_MODE_FRONT`) and texture by `SV_IsFrontFace`: front faces
  marble (`frontTexture`, t0), back faces metal (`backTexture`, t1) – learnopengl's `gl_FrontFacing` example.
- **Hint:** From outside only front faces show, so culling them lets you see the cubes' insides (their back faces). Add
  `bool isFrontFace : SV_IsFrontFace` to `PSMain`'s parameters; it follows the PSO's `FrontCounterClockwise`. Two
  textures in one table: `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)` and the table at heap slot 1 gives t0 =
  slot 1 (marble) and t1 = slot 2 (metal) – learnopengl binds two texture units. The floor uses the same table: it is a
  back face (clockwise from above), so it gets metal as before.
- **When done:** `main.cpp`: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;` (no `CULL_MODE_NONE`),
  `FrontCounterClockwise = TRUE` stays; `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);`; one GPU handle
  `faceTextures` (slot 1) instead of `cubeTexture` / `floorTexture`, `SetGraphicsRootDescriptorTable(2, faceTextures)` once
  before the cubes and none before the floor. `advanced_glsl.hlsl`: `Texture2D frontTexture : register(t0); Texture2D
  backTexture : register(t1);`, `PSMain(PSInput input, bool isFrontFace : SV_IsFrontFace)`: `if (isFrontFace) return
  frontTexture.Sample(…); else return backTexture.Sample(…);`. Picture: the cubes are open boxes seen from inside, all
  metal (no marble anywhere – every visible face is a back face): c0 ≈ 137,141,147 (OpenGL 140,144,150), c0-low ≈
  85,89,95 (the box's inner floor; OpenGL 130,134,140), c0-left ≈ 163,167,173, c0-right ≈ 133,137,143, c1 ≈ 140,144,150;
  the floor unchanged (floor-near 84,88,94, floor-left 139,143,149), background 26,26,26.

## interface-block
- **Task:** Make the struct between the stages learnopengl's interface block: rename `PSInput` to `VS_OUT`, the vertex
  shader's variable to `vs_out` and the pixel shader's parameter to `fs_in`.
- **Hint:** HLSL has no `out`/`in` blocks: the struct the vertex shader returns and the pixel shader takes already is
  one (GLSL: `out VS_OUT { vec2 TexCoords; } vs_out;` / `in VS_OUT { … } fs_in;`). The stages are matched by the
  semantics (`SV_POSITION`, `TEXCOORD`), not by the names, so the struct could even be declared twice.
- **When done:** `advanced_glsl.hlsl`: `struct VS_OUT { float4 position : SV_POSITION; float2 texCoord : TEXCOORD; };`,
  `VS_OUT VSMain(…)` with `VS_OUT vs_out;` … `return vs_out;`, `float4 PSMain(VS_OUT fs_in, bool isFrontFace :
  SV_IsFrontFace)` sampling with `fs_in.texCoord` (no `PSInput` left). No visible change (as after front-facing).

## uniform-buffer
- **Task:** learnopengl's uniform buffer demo: four pipeline states (`m_redPipelineState`, `m_greenPipelineState`,
  `m_bluePipelineState`, `m_yellowPipelineState`) with `uniform_buffer.hlsl`'s vertex shader and the pixel shader of
  `red.hlsl`, `green.hlsl`, `blue.hlsl`, `yellow.hlsl`, no face culling; draw four cubes at (-0.75, 0.75, 0) red,
  (0.75, 0.75, 0) green, (-0.75, -0.75, 0) yellow, (0.75, -0.75, 0) blue instead of the scene.
- **Hint:** The shared block is already there: every shader that declares `cbuffer SceneConstantBuffer : register(b1)`
  reads the one constant buffer (the CBV of root parameter 1), which `OnUpdate` writes once per frame – OpenGL needs a
  uniform block bound to a binding point for that. Compile the vertex shader once, then per colour: compile its
  `PSMain`, set `psoDesc.PS`, `CreateGraphicsPipelineState`. Set `psoDesc.RasterizerState.CullMode =
  D3D12_CULL_MODE_NONE` before (the scene's PSO culls front faces). In `PopulateCommandList`: `SetPipelineState` + model
  matrix + `DrawInstanced(36, 1, 0, 0)` per cube.
- **When done:** `main.cpp`: the four `ComPtr<ID3D12PipelineState>` members; `LoadAssets` compiles `uniform_buffer.hlsl`
  (`VSMain`) once and `red.hlsl`, `green.hlsl`, `blue.hlsl`, `yellow.hlsl` (`PSMain`), with
  `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;` and four `CreateGraphicsPipelineState(…,
  IID_PPV_ARGS(&m_redPipelineState))` etc.; `PopulateCommandList` draws, in this order, RED
  (`SetPipelineState(m_redPipelineState.Get())`, `XMMatrixTranslation(-0.75f, 0.75f, 0.0f)`), GREEN (0.75, 0.75), YELLOW
  (-0.75, -0.75), BLUE (0.75, -0.75), each `DrawInstanced(36, 1, 0, 0)`; the marble cubes and the floor are no longer
  drawn (the scene's PSO stays the command list's initial state, and the texture table stays set though these shaders
  read none). Picture: four flat-coloured cubes around the centre on the 26,26,26 background: red at (220,140)
  255,0,0, green at (580,140) 0,255,0, yellow at (220,460) 255,255,0, blue at (580,460) 0,0,255; centre (400,300)
  26,26,26. This is the solution.
