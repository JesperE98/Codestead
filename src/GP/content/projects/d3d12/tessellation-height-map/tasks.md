# Tessellation: Height map (CPU) – tasks (DirectX 12)

learnopengl "Guest Articles / Tessellation / Height map": `src/8.guest/2021/3.tessellation/terrain_cpu_src/main.cpp`
with `8.3.cpuheight.vs/.fs`, written as a Direct3D 12 program in the style of the course's earlier chapters (the
`D3D12App` class, the camera globals, a constant buffer with the matrices). Files: `main.cpp`, `cpuheight.hlsl`
(`VSMain` passes the height on; `PSMain` writes white in the start) and `heightmap.png`.

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API – see the OpenGL tasks.md):** the course's `heightmap.png` (256 × 256, one grey
channel, loaded with `stbi_load(…, 0)` – `nrChannels = 1` – no vertical flip), one vertex per pixel with column j along
x, row i along z (`x = -width / 2 + j`, `y = value * 64 / 256 - 16`, `z = -height / 2 + i`), learnopengl's strip
indices with `rez = 1` (255 strips of 510 triangles), the grey `(height + 16) / 64`, the camera globals at **(0, 190,
290), yaw -90, pitch -35** (`cameraFront = (0, -0.57358, -0.81915)`), fov 45, 800/600, near 0.1, **far 1000**
(`XMMatrixPerspectiveFovRH` / `XMMatrixLookAtRH`), model = identity, clear (0.1, 0.1, 0.1), depth test on, **no
culling** (`CullMode = D3D12_CULL_MODE_NONE`: the strips' winding alternates, and OpenGL culls nothing).

**Direct3D 12's choices:**
- **No `std::cout`**: a Windows program has no console. The prints of learnopengl (and OpenGL's chapter) go to the
  debugger's output window with `OutputDebugStringA` (`snprintf` into a `char` buffer first): `Loaded heightmap of size
  256 x 256` after loading and `Created lattice of 255 strips with 510 triangles each` after the indices.
- **The buffers** are upload-heap buffers like the earlier chapters' (`CreateCommittedResource` + `Map` / `memcpy` /
  `Unmap`), filled from learnopengl's `std::vector<float> vertices` (3 floats per vertex: `StrideInBytes = 3 *
  sizeof(float)`, input layout `POSITION` R32G32B32_FLOAT) and `std::vector<unsigned int> indices` (`DXGI_FORMAT_R32_UINT`).
  What `PopulateCommandList` needs later is kept in members: `m_vertexCount` (the points draw), `m_numStrips` and
  `m_numTrisPerStrip` (learnopengl's locals `numStrips`, `numTrisPerStrip`).
- **The primitive topology has two parts in Direct3D 12**: the PSO's `PrimitiveTopologyType` (POINT, LINE, TRIANGLE or
  PATCH – what the rasterizer gets) and the command list's `IASetPrimitiveTopology` (list or strip – how the vertices are
  put together). The start's PSO is made for points (`D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`, drawn with
  `D3D_PRIMITIVE_TOPOLOGY_POINTLIST` in `vertices`); `strips` switches the PSO to `TRIANGLE` and the command list to
  `D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`. Points are 1 pixel in Direct3D (there is no point size).
- **One draw per strip**: `DrawIndexedInstanced(m_numTrisPerStrip + 2, 1, (m_numTrisPerStrip + 2) * strip, 0, 0)` – the
  third argument (`StartIndexLocation`) counts indices where OpenGL's last `glDrawElements` argument is a byte offset
  (`sizeof(unsigned int) * …`). A real program would draw all strips at once: one draw with a strip-cut index
  (`0xFFFFFFFF` between the strips and `psoDesc.IBStripCutValue = D3D12_INDEX_BUFFER_STRIP_CUT_VALUE_0xFFFFFFFF`, Direct3D's
  primitive restart) or a triangle list – the chapter text says so; the course keeps learnopengl's loop.

**What the camera sees** (OpenGL's picture, Mesa, 800×600 – Direct3D 12 draws the same triangles with the same
matrices): the whole terrain from the front and above: the peaks along the back edge against the dark background at the
top (the highest at (420,95)), the river valley as a darker band from the left edge (y ≈ 300) down to the front edge
(x ≈ 480), the lake as a dark flat oval at (500…665, 330…430); the terrain's front edge at y ≈ 440…500, its left corner at
(0,440), its right corner at (775,490). Named points: **peak** (420,110), **ridge** (230,150), **centre** (400,300),
**hill** (150,380), **valley** (380,440), **lake** (580,390), **front** (600,470), **background** (400,40), **below**
(400,560).

**Start picture**: nothing is drawn – the clear colour 26,26,26 everywhere.

## `load-heightmap`
- **Task:** Load `heightmap.png` with stb_image (keep its width, height and number of channels); if it cannot be loaded, throw an error. Write its size to the debugger's output.
- **Hint:** `unsigned char* data = stbi_load("heightmap.png", &width, &height, &nrChannels, 0);` – 0 asks for the file's own channels (1 here). `snprintf(text, sizeof(text), "Loaded heightmap of size %d x %d\n", height, width); OutputDebugStringA(text);`. Do not free `data` yet: the next task reads the pixels.
- **When done:** `main.cpp` (`LoadAssets`): `int width, height, nrChannels;`, `stbi_load("heightmap.png", …, 0)`, `if
  (data == nullptr)` with `throw std::runtime_error(…)`, the `OutputDebugStringA` of the size. **No visible change**
  (nothing is drawn yet).

## `vertices`
- **Task:** Make one vertex per pixel: x from the column, z from the row (both centred around 0), y from the pixel's grey value scaled by 64/256 and shifted down by 16. Free the image, put the vertices into a vertex buffer with its view, and for now draw them as points.
- **Hint:** The pixel at row `i`, column `j` starts at `data + (j + width * i) * bytePerPixel`; its first byte is the height. `vertices.push_back(-width / 2.0f + width * j / (float)width);` (x), `(int)y * yScale - yShift` (y), `-height / 2.0f + height * i / (float)height` (z). Keep the count: `m_vertexCount = static_cast<UINT>(vertices.size() / 3);`. In `PopulateCommandList`: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_POINTLIST)`, `IASetVertexBuffers`, `DrawInstanced(m_vertexCount, 1, 0, 0)` – the PSO is already made for points.
- **When done:** `main.cpp`: the members `m_vertexBuffer`, `m_vertexBufferView`, `m_vertexCount`; the vertex loop
  (`yScale = 64.0f / 256.0f`, `yShift = 16.0f`), `m_vertexCount`, `stbi_image_free(data)`, the upload-heap vertex buffer
  (`StrideInBytes = 3 * sizeof(float)`); in `PopulateCommandList` the `POINTLIST` draw. The terrain appears as **a cloud
  of white points** (1 pixel each, white because the pixel shader still returns white): peak = 255,255,255 (the points
  crowd together on the steep peaks), the other named points mostly on gaps between the points (ridge, centre, hill,
  valley, lake, front = 26,26,26 – single pixels between rows of points, so check the region, not one pixel), background
  = below = 26,26,26.

## `indices`
- **Task:** Build the index buffer for triangle strips: for every pair of neighbouring rows, one strip that zigzags between them (`j + width * i`, `j + width * (i + 1)` for each column j). Count the strips and their triangles, write them to the debugger's output, and put the indices into an index buffer with its view.
- **Hint:** learnopengl's three loops: `for (int i = 0; i < height - 1; i += rez) for (int j = 0; j < width; j += rez) for (int k = 0; k < 2; k++) indices.push_back(j + width * (i + k * rez));` with `rez = 1`; `m_numStrips = (height - 1) / rez`, `m_numTrisPerStrip = (width / rez) * 2 - 2`. The view's format is `DXGI_FORMAT_R32_UINT`.
- **When done:** `main.cpp`: the members `m_indexBuffer`, `m_indexBufferView`, `m_numStrips`, `m_numTrisPerStrip`;
  `std::vector<unsigned int> indices`, `int rez = 1;`, the counts and their output (`Created lattice of 255 strips with
  510 triangles each`), the upload-heap index buffer and its view (130,560 indices). Still drawn as points: **no visible
  change** (the `vertices` picture).

## `strips`
- **Task:** Draw the terrain as triangle strips instead of points: make the PSO draw triangles, set the strip topology and the index buffer, and record one indexed draw per strip, each starting at its own place in the index buffer.
- **Hint:** `psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;` (strips are triangles too), `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)`, `IASetIndexBuffer(&m_indexBufferView)`, and `DrawIndexedInstanced(m_numTrisPerStrip + 2, 1, (m_numTrisPerStrip + 2) * strip, 0, 0);` in a loop over `strip` – a strip of n triangles has n + 2 indices.
- **When done:** `main.cpp`: `D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE` in the PSO; in `PopulateCommandList`
  `D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`, `IASetIndexBuffer`, the `for (int strip = 0; strip < m_numStrips; strip++)` loop
  with `DrawIndexedInstanced`, no `POINTLIST` draw. The terrain is **a solid white shape** (the shader still returns
  white, so it has no shading): the silhouette of the peaks at the top, the front edge at the bottom: peak = ridge =
  centre = hill = valley = lake = front = 255,255,255, background = below = 26,26,26.

## `height-colour`
- **Task:** Colour the terrain by its height: in the pixel shader shift and scale the height (-16 … 48) into a grey value from 0 to 1.
- **Hint:** `float h = (input.height + 16.0f) / 64.0f; return float4(h, h, h, 1.0f);` – the vertex shader already passes `result.height = position.y`.
- **When done:** `cpuheight.hlsl`: `float h = (input.height + 16.0f) / 64.0f;`, `return float4(h, h, h, 1.0f);`. **The
  terrain in grey**: bright peaks, dark valley and lake: peak = 212,212,212, ridge = 144,144,144, centre = 91,91,91, hill
  = 102,102,102, valley = 88,88,88, lake = 28,28,28 (the flat water level, almost the background's grey), front =
  66,66,66, background = below = 26,26,26. This is the solution.

*Simulator:* the start (clear colour) matches. From `vertices` on the simulator does not show the terrain: with the
heights read through `pixelOffset[0]` (`data + (j + width * i) * bytePerPixel` of the `stbi_load` data) no point is
drawn, and with a constant height only a narrow band of the first rows appears (the 65,536-iteration loop seems cut
short) – the OpenGL project shows the same in the simulator (see the D3D12 writer's report).
