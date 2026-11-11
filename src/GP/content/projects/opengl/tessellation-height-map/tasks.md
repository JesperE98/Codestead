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

**What the camera sees** (Mesa, 800×600): the whole terrain from the front and above: the peaks along the back edge
against the dark background at the top (y ≈ 90…150), the river valley as a dark band from the left edge down to the
bottom middle, the lake as a dark flat oval in the bottom right; the front edge of the terrain at y ≈ 440…500.

(Tasks and pixel values follow.)
