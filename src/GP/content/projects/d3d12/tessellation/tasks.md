# Tessellation (GPU) – tasks (DirectX 12)

learnopengl "Guest Articles / Tessellation / Tessellation": `src/8.guest/2021/3.tessellation/terrain_gpu_dist/main.cpp`
with `8.3.gpuheight.vs/.tcs/.tes/.fs`, in Direct3D 12: the tessellation control shader is the **hull shader**, the
evaluation shader the **domain shader**. Files: `main.cpp`, `cpuheight.hlsl` (the start's shaders, unused once the CPU
grid is gone – the edits cannot delete files), `gpuheight.hlsl` (`VSMain`, `PatchConstantFunction` + `HSMain`, `DSMain`,
`PSMain`; in the start the hull shader writes every level 1 and `DSMain` is a TODO) and `heightmap.png`.

**Start = the solution of `tessellation-height-map`** (the CPU terrain) plus `gpuheight.hlsl`; the tasks replace the CPU
grid by patches the GPU tessellates.

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API – see the OpenGL tasks.md):** the height map, orientation, heights, colour,
camera, projection (near 0.1, far 1000) and clear colour of `tessellation-height-map`; the height map as a one-channel
texture clamped at the edges (`DXGI_FORMAT_R8_UNORM`, read as `.r`); `rez = 20` → 20 × 20 patches of 4 control points
(position + texture coordinate, learnopengl's corner order (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)); learnopengl's
domain (evaluation) shader; the hull (control) shader with every level 1 in the start, **8** after `tess-control`, and
learnopengl's distance-based levels with **MIN_TESS_LEVEL = 2, MAX_TESS_LEVEL = 8, MIN_DISTANCE = 250, MAX_DISTANCE =
450** after `distance-levels`; the solution in wireframe.

**Direct3D 12's choices:**
- **No version to ask for**: tessellation is part of every Direct3D 12 device (feature level 11_0 and up). The first
  task (`max-tess-level`, OpenGL's `opengl-4-1`) only writes the largest tessellation factor to the debugger's output –
  a constant in Direct3D 12, `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR` = 64 (OpenGL asks the driver,
  `GL_MAX_TESS_GEN_LEVEL`, at least 64).
- **The height map texture**: `stbi_load(…, 1)` (one channel), a `DXGI_FORMAT_R8_UNORM` texture in a default heap filled
  through an upload heap with `UpdateSubresources` (`RowPitch = width`: 1 byte per pixel), then the barrier to
  `D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE` (the domain shader reads it, not the pixel shader), its SRV in slot 1
  of the CBV/SRV heap. **One mip level**: the domain shader reads it with `SampleLevel(…, 0)` – outside the pixel shader
  there are no screen-space derivatives to choose a level, and OpenGL's evaluation shader reads level 0 too (OpenGL's
  mipmaps are never used here). The setup command list stays open for the upload and is executed and waited for at the
  end of `LoadAssets` (from `height-texture` on).
- **Root signature**: parameter 0 = the CBV table (b0: model, view, projection), now visible to **all** shaders (the hull
  shader's distance levels and the domain shader use the matrices); parameter 1 = the SRV table (t0, the height map),
  visible to the domain shader only (`D3D12_SHADER_VISIBILITY_DOMAIN`); a static sampler s0 (linear, `CLAMP` – OpenGL's
  `GL_CLAMP_TO_EDGE`) for the domain shader.
- **The pipeline**: `D3DCompileFromFile(L"gpuheight.hlsl", …)` four times – `VSMain`/`vs_5_0`, `HSMain`/`hs_5_0`,
  `DSMain`/`ds_5_0`, `PSMain`/`ps_5_0` – and `psoDesc.HS` / `psoDesc.DS`; `psoDesc.PrimitiveTopologyType =
  D3D12_PRIMITIVE_TOPOLOGY_TYPE_PATCH`; the input layout `POSITION` (R32G32B32_FLOAT, offset 0) + `TEXCOORD`
  (R32G32_FLOAT, offset 12), stride 5 floats. The draw: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST)`
  (OpenGL's `GL_PATCHES` + `glPatchParameteri(GL_PATCH_VERTICES, 4)` in one) and `DrawInstanced(m_vertexCount, 1, 0, 0)`
  with `m_vertexCount = NUM_PATCH_PTS * rez * rez` (1,600).
- **Hull shader** = OpenGL's control shader split in two: `HSMain` runs once per output control point
  (`SV_OutputControlPointID` = `gl_InvocationID`) and passes it through; the levels come from the **patch constant
  function** (`[patchconstantfunc("PatchConstantFunction")]`), which Direct3D runs once per patch – OpenGL's `if
  (gl_InvocationID == 0)` block. It returns `float edges[4] : SV_TessFactor` (`gl_TessLevelOuter`) and `float inside[2] :
  SV_InsideTessFactor` (`gl_TessLevelInner`) – the same edge order as OpenGL's for quads (edge 0 at u = 0, 1 at v = 0,
  2 at u = 1, 3 at v = 1; inside 0 along u, 1 along v), so learnopengl's code carries over line by line (`lerp` for
  `mix`). The patch's layout is declared on the hull shader in Direct3D (OpenGL: on the evaluation shader):
  `[domain("quad")]`, `[partitioning("fractional_odd")]` (`fractional_odd_spacing`), `[outputtopology("triangle_ccw")]`
  (`ccw`), `[outputcontrolpoints(4)]` (`layout (vertices = 4) out`). Direct3D always needs the hull shader for a
  tessellated pipeline – the start's writes 1 everywhere (one quad per patch), as OpenGL's start does.
- **Domain shader** = learnopengl's evaluation shader: `[domain("quad")]`, `float2 tessCoord : SV_DomainLocation`
  (`gl_TessCoord`, u and v), `const OutputPatch<HSOutput, 4> patch` (`gl_in` / the control shader's outputs),
  `heightMap.SampleLevel(heightMapSampler, texCoord, 0).r * 64.0f - 16.0f`, the position moved along the patch normal and
  projected with `mul(mul(mul(p, model), view), projection)`.
- **Wireframe**: `psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME` (OpenGL's `glPolygonMode`). No culling,
  as before.

**What the camera sees**: the terrain of `tessellation-height-map`, from the same place. Named points (OpenGL's):
**peak** (420,110), **ridge** (230,150), **centre** (400,300), **hill** (150,380), **valley** (380,440), **lake**
(580,390), **front** (600,470), **background** (400,40), **below** (400,560). For the wireframe states, two boxes: the
**front box** (x 300…499, y 400…449) and the **back box** (x 250…449, y 150…199): the share of their pixels that are not
the clear colour tells how dense the triangles are. The values below are OpenGL's (Mesa); Direct3D 12's tessellator
makes the same triangles (the same fractional-odd rules and edge order).

**Start picture** (= the solution of `tessellation-height-map`): peak = 212,212,212, ridge = 144,144,144, centre =
91,91,91, hill = 102,102,102, valley = 88,88,88, lake = 28,28,28, front = 66,66,66, background = below = 26,26,26.

## `max-tess-level`
- **Task:** Write the largest tessellation factor Direct3D 12 supports to the debugger's output (OpenGL asks the driver for it; Direct3D 12 fixes it for every device).
- **Hint:** At the top of `LoadAssets`: `snprintf(text, sizeof(text), "Max available tess level: %d\n", D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR); OutputDebugStringA(text);`.
- **When done:** `main.cpp`: the `OutputDebugStringA` with `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR` (64). The CPU
  terrain is still drawn: **no visible change** (the start picture).

## `height-texture`
- **Task:** The GPU will read the heights itself: instead of turning the pixels into vertices on the CPU, load the height map into a one-channel texture (`DXGI_FORMAT_R8_UNORM`) with an SRV, and give the root signature a table for it and a clamping sampler for the domain shader. Remove the CPU grid – its vertices, indices, buffers and the strip drawing.
- **Hint:** `stbi_load("heightmap.png", …, 1)`; the texture like the earlier chapters' (default heap, upload heap, `UpdateSubresources` with `RowPitch = width`), but the barrier goes to `D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE`; SRV in heap slot 1 (`NumDescriptors = 2`). Root parameter 0 becomes `D3D12_SHADER_VISIBILITY_ALL`, root parameter 1 a table with `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)` for `D3D12_SHADER_VISIBILITY_DOMAIN`, the static sampler `D3D12_TEXTURE_ADDRESS_MODE_CLAMP`. The command list now stays open until the end of `LoadAssets` (`Close`, `ExecuteCommandLists`, `WaitForPreviousFrame` after the fence is created). `PopulateCommandList` sets table 1 to heap slot 1.
- **When done:** `main.cpp`: `m_heightMap` (no `m_indexBuffer`, `m_numStrips`, `m_numTrisPerStrip`),
  `NumDescriptors = 2`, the root signature with two tables and the static sampler, `heightMapUploadHeap`, the texture
  (`DXGI_FORMAT_R8_UNORM`, one mip level), its SRV, the command list executed and waited for at the end of `LoadAssets`,
  `SetGraphicsRootDescriptorTable(1, …)`; no vertex loop, index loop, strip draws. Nothing is drawn: **only the clear
  colour** (all named points 26,26,26).

## `patch-grid`
- **Task:** Build the patches: a grid of 20 × 20 flat squares, each given as its 4 corners (a patch of 4 control points) with a position (y = 0) and a texture coordinate; put them into a vertex buffer (5 floats per vertex) and add the texture coordinate to the input layout.
- **Hint:** learnopengl's loop over `i` and `j` (0 … rez - 1) pushes the corners (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1): x = `-width / 2.0f + width * i / (float)rez`, z = `-height / 2.0f + height * j / (float)rez`, texture coordinate `(i / (float)rez, j / (float)rez)`. `const unsigned int NUM_PATCH_PTS = 4;` (a global), `unsigned rez = 20;`, `m_vertexCount = NUM_PATCH_PTS * rez * rez;`, `StrideInBytes = 5 * sizeof(float)`, `{ "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 12, … }`.
- **When done:** `main.cpp`: `NUM_PATCH_PTS = 4`, `unsigned rez = 20;`, the 1,600 vertices (5 floats each),
  `m_vertexCount = NUM_PATCH_PTS * rez * rez`, the vertex buffer with stride 5 floats, the `TEXCOORD` input element. Still
  nothing drawn: **only the clear colour**.

## `tess-evaluation`
- **Task:** Write the domain shader: for each vertex the tessellator makes (at `SV_DomainLocation` u, v inside the patch) interpolate the corners' texture coordinates and positions bilinearly, read the height from the height map, move the point up by it, and project it. Build the pipeline from all four shaders and draw the patches.
- **Hint:** `float2 t0 = (t01 - t00) * u + t00; float2 t1 = (t11 - t10) * u + t10; float2 texCoord = (t1 - t0) * v + t0;` (the same for the positions, `patch[0..3].position`), `output.height = heightMap.SampleLevel(heightMapSampler, texCoord, 0).r * 64.0f - 16.0f;`, the normal `normalize(float4(cross(vVec.xyz, uVec.xyz), 0.0f))`. C++: `hullShader` (`"HSMain", "hs_5_0"`) and `domainShader` (`"DSMain", "ds_5_0"`) from `gpuheight.hlsl`, `psoDesc.HS` / `psoDesc.DS`, `D3D12_PRIMITIVE_TOPOLOGY_TYPE_PATCH`; `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST)`, `DrawInstanced(m_vertexCount, 1, 0, 0)`.
- **When done:** `gpuheight.hlsl`: learnopengl's evaluation shader as `DSMain` (`[domain("quad")]`). `main.cpp`: the four
  shaders compiled from `gpuheight.hlsl`, `psoDesc.HS`, `psoDesc.DS`, the `PATCH` topology type, the patch-list draw. The
  start's hull shader sets every level to 1, so **every patch is one flat quad** with the heights of its 4 corners: **a
  coarse terrain** of 20 × 20 tilted squares (800 triangles), the right outline but no detail – the lake a shallow dent,
  the peaks blunt: peak = 214,214,214, ridge = 144,144,144, centre = 87,87,87, hill = 101,101,101, valley = 76,76,76,
  lake = 28,28,28, front = 64,64,64, background = below = 26,26,26.

## `tess-control`
- **Task:** Tessellate: in the patch constant function set all four edge factors and both inside factors to 8, so every patch is cut into 9 × 9 small quads (fractional_odd spacing rounds level 8 up to 9 segments) whose new vertices each read their own height.
- **Hint:** `output.edges[0..3] = 8; output.inside[0..1] = 8;` – the patch constant function runs once per patch (OpenGL's `if (gl_InvocationID == 0)` block).
- **When done:** `gpuheight.hlsl`: the six factors 8. **The full terrain** again (about 64,800 triangles: 400 patches × 162; the same as the
  CPU terrain within a few grey levels): peak = 213,213,213, ridge = 145,145,145, centre = 91,91,91, hill =
  101,101,101, valley = 88,88,88, lake = 28,28,28, front = 67,67,67, background = below = 26,26,26.

## `wireframe`
- **Task:** Draw only the triangles' edges to see the tessellation.
- **Hint:** `psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;` (learnopengl toggles `glPolygonMode` with a key).
- **When done:** `main.cpp`: `D3D12_FILL_MODE_WIREFRAME`. **The terrain as a grey wireframe**: a regular mesh, the same
  density on every patch, the clear colour between the lines (OpenGL: front box 74.8 % lines, back box 87.3 % – far
  patches are smaller on screen, so their lines crowd). The named points lie on lines or gaps by chance – check the boxes.

## `distance-levels`
- **Task:** Make the factors depend on the distance to the camera: for each corner its eye-space depth, scaled to 0…1 between `MIN_DISTANCE` (250) and `MAX_DISTANCE` (450); each edge factor from the nearer of its edge's two corners, interpolated from `MAX_TESS_LEVEL` (8) near to `MIN_TESS_LEVEL` (2) far; the inside factors the larger of the opposite edge factors.
- **Hint:** learnopengl's code in the patch constant function: `float4 eyeSpacePos00 = mul(mul(patch[0].position, model), view);`, `float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f, 1.0f);`, `float tessLevel0 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));` …, `output.inside[0] = max(tessLevel1, tessLevel3);`. An edge shared by two patches gets the same factor from both, so no cracks open.
- **When done:** `gpuheight.hlsl`: `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450`,
  the eye-space depths with `model` and `view`, the distance-based factors. **Near patches stay fine, far ones get
  coarse**: the wireframe at the back opens up into large triangles (OpenGL: back box 47.3 % lines, was 87.3 %), the
  front stays dense (front box 71.8 %). This is the solution.

*Simulator:* the start (the CPU terrain) shows nothing – see `tessellation-height-map`. `height-texture` and
`patch-grid` match (only the clear colour). From `tess-evaluation` on the simulator draws nothing: it has no hull or
domain stage – the pipeline's `HS`/`DS`, the patch topology and `DSMain` are not followed (it reports "'VSMain' returns
no SV_POSITION").
