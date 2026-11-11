# Tessellation: Height map (CPU) (Vulkan) – tasks

learnopengl "Guest Articles / Tessellation / Height map": `src/8.guest/2021/3.tessellation/terrain_cpu_src/main.cpp`
with `8.3.cpuheight.vs/.fs`. Files: `main.cpp`, `shaders/cpuheight.vert/.frag` (learnopengl's names without the `8.3.`
prefix, built to `cpuheight.vert.spv` / `.frag.spv`) and `textures/heightmap.png` (the course's own height map). The
program is the course's Vulkan skeleton (the camera globals, a uniform buffer with view and projection at binding 0,
the model matrix as a push constant, a depth buffer, vertex and index buffers through a staging buffer as in the Model
Loading chapters).

**Screenshot time: 1.0 s** (nothing moves).

**Fixed choices (the same in every API, see `../../opengl/tessellation-height-map/tasks.md`):**
- **Height map**: `heightmap.png` (256 × 256, one grey channel; `stbi_load(path, &width, &height, &nrChannels, 0)`
  reports `nrChannels = 1`), **not flipped**: the first row of the file is the image's top row. learnopengl's is a
  2.6 k × 2.6 k map of Iceland; ours is smaller so the simulator can draw the 65,536-vertex grid.
- **Vertices** (`loadHeightMap()`): pixel (row `i`, column `j`) → `x = -width / 2 + j`, `y = value * yScale - yShift`,
  `z = -height / 2 + i` with `yScale = 64.0f / 256.0f`, `yShift = 16.0f`: columns along +x, rows along +z, the image's
  top row at the terrain's back edge (z = -128). `struct Vertex { glm::vec3 pos; }` (location 0) in the global
  `std::vector<Vertex> vertices`. The image is only read on the CPU, so no texture and no Vulkan image is created.
- **Indices / strips** (learnopengl's): `for (i = 0; i < height - 1; i += rez) for (j = 0; j < width; j += rez) for (k =
  0; k < 2; k++) indices.push_back(j + width * (i + k * rez));` into the global `std::vector<uint32_t> indices`
  (`VK_INDEX_TYPE_UINT32`), `rez = 1`, `numStrips = (height - 1) / rez`, `numTrisPerStrip = (width / rez) * 2 - 2`.
- **Drawing the strips**: the pipeline's topology is `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` and `recordCommandBuffer()`
  records one `vkCmdDrawIndexed(commandBuffer, numTrisPerStrip + 2, 1, (numTrisPerStrip + 2) * strip, 0, 0)` per strip –
  the `firstIndex` parameter is learnopengl's byte offset `sizeof(unsigned int) * (numTrisPerStrip + 2) * strip` counted
  in indices. The alternative is **primitive restart**: `inputAssembly.primitiveRestartEnable = VK_TRUE` and the special
  index `0xFFFFFFFF` (for 32-bit indices) after each strip – then one `vkCmdDrawIndexed` draws the whole terrain. The
  course keeps learnopengl's one draw per strip. No culling (`VK_CULL_MODE_NONE`: a strip's triangles alternate their
  winding).
- **Colour** (`cpuheight.frag`): `float h = (Height + 16.0) / 64.0; outColor = vec4(h, h, h, 1.0);` (learnopengl's CPU
  shader divides by 32; the course uses its GPU shader's 64 in both chapters).
- **Camera**: cameraPos **(0, 190, 290)**, yaw -90, pitch -35 (`cameraFront = (0, -0.57358, -0.81915)`), fov 45, 800/600,
  **near 0.1, far 1000**, `proj[1][1] *= -1`; model matrix = identity (push constant). Clear (0.1, 0.1, 0.1), depth test
  on.
- **The start** runs without drawing: `loadHeightMap()` is empty and `vertexBuffer` / `indexBuffer` stay
  `VK_NULL_HANDLE` (Vulkan cannot create a buffer of size 0; destroying a null handle in `cleanup()` does nothing).
  `createVertexBuffer()` and `createIndexBuffer()` (the Model Loading chapters' staging-buffer functions) are there
  already – the tasks call them.

**What the camera sees** (lavapipe, 800×600): the whole terrain from the front and above. Named points (OpenGL's):
**peak** (420,110), **ridge** (230,150), **centre** (400,300), **hill** (150,380), **valley** (380,440), **lake**
(580,390), **front** (600,470), **background** (400,40), **below** (400,560). Every state is the same picture as
OpenGL's (the strips: 1 pixel differs; the points: 490 single points land one pixel apart).

**Start picture**: nothing is drawn – the clear colour 26,26,26 everywhere.

## `load-heightmap`
- **Task:** In `loadHeightMap()`, load the height map with stb_image (keep its width, height and number of channels) and print its size; if it cannot be loaded, throw an error.
- **Hint:** `unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);` – 0 asks for the file's own channels (1 here). `if (!data) { throw std::runtime_error("failed to load height map!"); }`, then `std::cout << "Loaded heightmap of size " << height << " x " << width << std::endl;`. Do not free `data` yet: the next task reads the pixels.
- **When done:** `main.cpp`: `int width, height, nrChannels;`, `stbi_load(path, …, 0)`, the error check, the print
  (`Loaded heightmap of size 256 x 256`). **No visible change** (nothing is drawn yet).

## `vertices`
- **Task:** Make one vertex per pixel: x from the column, z from the row (both centred around 0), y from the pixel's grey value scaled by 64/256 and shifted down by 16; free the image. Create the vertex buffer from them, and for now draw the vertices as points.
- **Hint:** The pixel at row `i`, column `j` starts at `data + (j + width * i) * bytePerPixel`; its first byte is the height. `vertex.pos.x = -width / 2.0f + width * j / (float) width;`, `vertex.pos.y = (int) y * yScale - yShift;`, `vertex.pos.z = -height / 2.0f + height * i / (float) height;`, `vertices.push_back(vertex);`. Call `createVertexBuffer();` after `loadHeightMap(…)` in `initVulkan()`. Points: `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_POINT_LIST;`, and the vertex shader must write `gl_PointSize = 1.0;` (Vulkan draws points only with a size from the shader). In `recordCommandBuffer()`: `vkCmdBindVertexBuffers` and `vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);`.
- **When done:** `main.cpp`: the vertex loop (`yScale = 64.0f / 256.0f`, `yShift = 16.0f`), `stbi_image_free(data)`,
  the print `Loaded 65536 vertices`, `createVertexBuffer();` in `initVulkan()`, `VK_PRIMITIVE_TOPOLOGY_POINT_LIST`, the
  bind and the `vkCmdDraw`; `cpuheight.vert`: `gl_PointSize = 1.0;`. The terrain appears as **a cloud of white points**
  (1 pixel each, white because the fragment shader still writes white; 57,598 pixels not background, OpenGL 57,588):
  peak = 255,255,255, the other named points on gaps between the points (ridge, centre, hill, valley, lake, front =
  26,26,26 – single pixels, check the region), background = below = 26,26,26.

## `indices`
- **Task:** Build the indices of the triangle strips: for every pair of neighbouring rows, one strip that zigzags between them (`j + width * i`, `j + width * (i + 1)` for each column j). Count the strips and their triangles, print the numbers, and create the index buffer.
- **Hint:** learnopengl's three loops: `for (int i = 0; i < height - 1; i += rez) for (int j = 0; j < width; j += rez) for (int k = 0; k < 2; k++) indices.push_back(j + width * (i + k * rez));` with `int rez = 1;`; `numStrips = (height - 1) / rez;`, `numTrisPerStrip = (width / rez) * 2 - 2;`. Call `createIndexBuffer();` after `createVertexBuffer();`.
- **When done:** `main.cpp`: the index loops, `numStrips`, `numTrisPerStrip`, the prints (`Loaded 130560 indices`,
  `Created lattice of 255 strips with 510 triangles each`, `Created 130050 triangles total`), `createIndexBuffer();` in
  `initVulkan()`. Still drawn as points: **no visible change** (the `vertices` picture).

## `strips`
- **Task:** Draw the terrain as triangle strips instead of points: bind the index buffer and record one indexed draw per strip, each starting at its own first index.
- **Hint:** `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP;` (and the vertex shader no longer needs `gl_PointSize`). `vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32);`, then `for (int strip = 0; strip < numStrips; strip++) vkCmdDrawIndexed(commandBuffer, numTrisPerStrip + 2, 1, (numTrisPerStrip + 2) * strip, 0, 0);` – a strip of n triangles has n + 2 indices.
- **When done:** `main.cpp`: `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP`, `vkCmdBindIndexBuffer`, the loop of 255
  `vkCmdDrawIndexed`, no `vkCmdDraw`; `cpuheight.vert` without `gl_PointSize`. The terrain is **a solid white shape**
  (211,549 pixels not background): peak = ridge = centre = hill = valley = lake = front = 255,255,255, background = below
  = 26,26,26.

## `height-colour`
- **Task:** Colour the terrain by its height: in the fragment shader shift and scale the height (-16 … 48) into a grey value from 0 to 1.
- **Hint:** `float h = (Height + 16.0) / 64.0; outColor = vec4(h, h, h, 1.0);` – the vertex shader already passes `Height = inPosition.y`.
- **When done:** `cpuheight.frag`: `float h = (Height + 16.0) / 64.0;`, `outColor = vec4(h, h, h, 1.0);`. **The terrain
  in grey**: peak = 212,212,212, ridge = 144,144,144, centre = 91,91,91, hill = 102,102,102, valley = 88,88,88, lake =
  28,28,28, front = 66,66,66, background = below = 26,26,26 (OpenGL's values exactly). This is the solution.
