# Tessellation: Height map (CPU) – tasks (OpenGL)

learnopengl "Guest Articles / Tessellation / Height map": `src/8.guest/2021/3.tessellation/terrain_cpu_src/main.cpp`
with `8.3.cpuheight.vs/.fs`. Files: `main.cpp`, `shader_m.h` (the course's Shader class), `cpuheight.vs/.fs`
(learnopengl's names without the `8.3.` prefix) and `heightmap.png` (the course's own height map, see below).

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL 3.3 core**, like the course's other code (learnopengl's CPU demo is 3.3 too).

**Fixed choices (the same in every API):**
- **Height map**: `heightmap.png` from `src/GP/content/textures/` (drawn by `make_guest.py`): **256 × 256, one grey
  channel** (8 bit; `stbi_load(..., 0)` reports `nrChannels = 1`), hills with a ridge of peaks along the image's top
  edge, a river valley from the left edge to the bottom edge and a lake in the bottom right. learnopengl's is a
  2.6 k × 2.6 k map of Iceland (RGBA); ours is smaller so the simulator can draw the 65,536-vertex grid. Copy it next to
  `main.cpp` (Vulkan: `textures/heightmap.png`).
- **No vertical flip** when loading (`stbi_set_flip_vertically_on_load` is not called; learnopengl's CPU demo flips, its
  GPU demo does not – the course flips in neither, so both chapters show the same terrain the same way round). The
  first row of the file is the image's top row.
- **Vertices**: one per pixel. Pixel (row `i`, column `j`) → `x = -width / 2 + j`, `y = value * yScale - yShift`,
  `z = -height / 2 + i` with learnopengl's `yScale = 64.0f / 256.0f`, `yShift = 16.0f` (heights -16 … 47.75). So
  columns run along +x and rows along +z: the image's top row is the terrain's back edge (z = -128), seen from above
  the terrain looks like the image. (learnopengl's CPU demo puts the rows along x and the columns along z, its GPU demo
  the other way round; the course uses the GPU demo's orientation in both chapters.) Vertex data: positions only,
  3 floats, attribute 0.
- **Indices / strips** (learnopengl's): `for (i = 0; i < height - 1; i += rez) for (j = 0; j < width; j += rez) for
  (k = 0; k < 2; k++) indices.push_back(j + width * (i + k * rez));` – one triangle strip per pair of rows,
  `numStrips = (height - 1) / rez`, `numTrisPerStrip = (width / rez) * 2 - 2`; drawn with one
  `glDrawElements(GL_TRIANGLE_STRIP, numTrisPerStrip + 2, GL_UNSIGNED_INT, (void*)(sizeof(unsigned int) *
  (numTrisPerStrip + 2) * strip))` per strip. Vulkan: `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` and one
  `vkCmdDrawIndexed(numTrisPerStrip + 2, 1, firstIndex = (numTrisPerStrip + 2) * strip, 0, 0)` per strip (the same
  idea as learnopengl's offsets; primitive restart would be the alternative – one draw, a restart index between
  strips); D3D12: `D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP` and one `DrawIndexedInstanced(numTrisPerStrip + 2, 1,
  (numTrisPerStrip + 2) * strip, 0, 0)` per strip. No culling (the strips' winding alternates).
- **Colour** (`cpuheight.fs`): `float h = (Height + 16.0) / 64.0; FragColor = vec4(h, h, h, 1.0);` – the grey of a
  point is about the height map's own grey there. (learnopengl's CPU shader divides by 32, so everything above
  height 16 is white; its GPU shader divides by 64 – the course uses 64 in both chapters.)
- **Camera**: the camera globals of the course, fixed (no input): **cameraPos (0, 190, 290), yaw -90, pitch -35**
  (`cameraFront = (0, -0.57358, -0.81915)`), up (0, 1, 0), fov 45, aspect 800/600, **near 0.1, far 1000**
  (learnopengl: a "pretty starting point" over its 2.6 k map and far 100000). Model matrix = identity. Clear
  (0.1, 0.1, 0.1), depth test on.
- learnopengl's `rez` (use every rez-th vertex) stays in the index loop with `rez = 1`; its strip counts
  (`(height - 1) / rez`, `(width / rez) * 2 - 2`) only fit when rez divides both 255 and 256 – i.e. only rez = 1 for this
  map – so the course does not change it (the chapter text says why; the Tessellation chapter does level of detail
  properly). learnopengl's keys (Space: wireframe, G: grey) are left out: no input.

**What the camera sees** (Mesa, 800×600): the whole terrain from the front and above: the peaks along the back edge
against the dark background at the top (the highest at (420,95)), the river valley as a darker band from the left edge
(y ≈ 300) down to the front edge (x ≈ 480), the lake as a dark flat oval at (500…665, 330…430); the terrain's front
edge at y ≈ 440…500, its left corner at (0,440), its right corner at (775,490). Named points: **peak** (420,110),
**ridge** (230,150), **centre** (400,300), **hill** (150,380), **valley** (380,440), **lake** (580,390), **front**
(600,470), **background** (400,40), **below** (400,560) (under the terrain's front edge: background).

**Start picture**: nothing is drawn – the clear colour 26,26,26 everywhere.

## `load-heightmap`
- **Task:** Load `heightmap.png` with stb_image (keep its width, height and number of channels) and print its size; if it cannot be loaded, print an error and end the program.
- **Hint:** `unsigned char *data = stbi_load("heightmap.png", &width, &height, &nrChannels, 0);` – 0 asks for the file's own channels (1 here). Print `"Loaded heightmap of size " << height << " x " << width`. Do not free `data` yet: the next task reads the pixels.
- **When done:** `main.cpp`: `int width, height, nrChannels;`, `stbi_load("heightmap.png", …, 0)`, the `if (data)` / `else`
  (with `return -1;`) block. The program prints `Loaded heightmap of size 256 x 256`. **No visible change** (nothing is
  drawn yet).

## `vertices`
- **Task:** Make one vertex per pixel: x from the column, z from the row (both centred around 0), y from the pixel's grey value scaled by 64/256 and shifted down by 16. Free the image, put the vertices into a VBO with a VAO (attribute 0: three floats), and for now draw them as points.
- **Hint:** The pixel at row `i`, column `j` starts at `data + (j + width * i) * bytePerPixel`; its first byte is the height. `vertices.push_back(-width / 2.0f + width * j / (float)width);` (x), `(int)y * yScale - yShift` (y), `-height / 2.0f + height * i / (float)height` (z). Draw: `glDrawArrays(GL_POINTS, 0, (GLsizei)(vertices.size() / 3));`.
- **When done:** `main.cpp`: the vertex loop (`yScale = 64.0f / 256.0f`, `yShift = 16.0f`), `stbi_image_free(data)`,
  `terrainVAO` / `terrainVBO` with `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0)`, in
  the loop `glBindVertexArray(terrainVAO); glDrawArrays(GL_POINTS, …)`, and their deletion at the end. Prints
  `Loaded 65536 vertices`. The terrain appears as **a cloud of white points** (1 pixel each, white because the fragment
  shader still writes white; 57,588 pixels not background): peak = 255,255,255 (the points crowd together on the steep
  peaks), the other named points mostly on gaps between the points (ridge, centre, hill, valley, lake, front =
  26,26,26 – single pixels between rows of points, so check the region, not one pixel), background = below =
  26,26,26.

## `indices`
- **Task:** Build the index buffer for triangle strips: for every pair of neighbouring rows, one strip that zigzags between them (`j + width * i`, `j + width * (i + 1)` for each column j). Count the strips and their triangles, and put the indices into an element buffer bound to the VAO.
- **Hint:** learnopengl's three loops: `for (int i = 0; i < height - 1; i += rez) for (int j = 0; j < width; j += rez) for (int k = 0; k < 2; k++) indices.push_back(j + width * (i + k * rez));` with `rez = 1`; `numStrips = (height - 1) / rez`, `numTrisPerStrip = (width / rez) * 2 - 2`. Bind the IBO while the VAO is bound.
- **When done:** `main.cpp`: `std::vector<unsigned int> indices`, `int rez = 1;`, `numStrips`, `numTrisPerStrip`, the
  prints (`Loaded 130560 indices`, `Created lattice of 255 strips with 510 triangles each`, `Created 130050 triangles
  total`), `terrainIBO` (`GL_ELEMENT_ARRAY_BUFFER`) and its deletion. Still drawn as points: **no visible change**
  (the `vertices` picture).

## `strips`
- **Task:** Draw the terrain as triangle strips instead of points: one `glDrawElements` per strip, each starting at its own offset in the index buffer.
- **Hint:** `glDrawElements(GL_TRIANGLE_STRIP, numTrisPerStrip + 2, GL_UNSIGNED_INT, (void*)(sizeof(unsigned int) * (numTrisPerStrip + 2) * strip));` in a loop over `strip` – a strip of n triangles has n + 2 indices.
- **When done:** `main.cpp`: the `for (int strip = 0; strip < numStrips; strip++)` loop with `GL_TRIANGLE_STRIP`, no
  `GL_POINTS` draw. The terrain is **a solid white shape** (the shader still writes white, so it has no shading): the
  silhouette of the peaks at the top, the front edge at the bottom (211,548 pixels not background): peak = ridge =
  centre = hill = valley = lake = front = 255,255,255, background = below = 26,26,26.

## `height-colour`
- **Task:** Colour the terrain by its height: in the fragment shader shift and scale the height (-16 … 48) into a grey value from 0 to 1.
- **Hint:** `float h = (Height + 16.0) / 64.0; FragColor = vec4(h, h, h, 1.0);` – the vertex shader already passes `Height = aPos.y`.
- **When done:** `cpuheight.fs`: `float h = (Height + 16.0) / 64.0;`, `FragColor = vec4(h, h, h, 1.0);`. **The terrain
  in grey**: bright peaks, dark valley and lake: peak = 212,212,212, ridge = 144,144,144, centre = 91,91,91, hill =
  102,102,102, valley = 88,88,88, lake = 28,28,28 (the flat water level, almost the background's grey), front =
  66,66,66, background = below = 26,26,26. This is the solution.
