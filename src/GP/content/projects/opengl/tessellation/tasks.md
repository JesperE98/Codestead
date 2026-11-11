# Tessellation (GPU) – tasks (OpenGL)

learnopengl "Guest Articles / Tessellation / Tessellation": `src/8.guest/2021/3.tessellation/terrain_gpu_dist/main.cpp`
with `8.3.gpuheight.vs/.tcs/.tes/.fs` and `includes/learnopengl/shader_t.h`. Files: `main.cpp`, `shader_t.h`
(learnopengl's Shader class with optional geometry, tessellation control and tessellation evaluation files – the
course's `shader_m.h` grown by two parameters), `cpuheight.vs/.fs` (the start's CPU shaders), `gpuheight.vs/.tcs/.tes/.fs`
(learnopengl's names without the `8.3.` prefix) and `heightmap.png`.

**Start = the solution of `tessellation-height-map`** (the CPU terrain), with the GPU version's files added
(`gpuheight.vs/.fs` complete, `gpuheight.tcs` passing the patches through with every level 1, `gpuheight.tes` an empty
TODO stub) and `shader_t.h` included instead of `shader_m.h` (same class, two more optional stages); the tasks replace
the CPU grid by patches the GPU tessellates.

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL 4.1 core** (learnopengl's; tessellation shaders are core since 4.0). Shaders `#version 410 core`. 4.1 is the
highest version macOS offers, so the chapter runs there.

**Fixed choices (the same in every API):**
- Height map, orientation, heights, colour, camera, projection (near 0.1, far 1000), clear colour: exactly as in
  `tessellation-height-map` (see its tasks.md) – both chapters show the same terrain from the same place.
- **The height map as a texture**: `GL_R8` (one channel, `GL_RED` data – our map has one channel; learnopengl uploads
  its RGBA map with `GL_RGBA` and reads `.y`, the course reads `.r`), not flipped, **`GL_CLAMP_TO_EDGE`**
  (learnopengl: `GL_REPEAT` – then the bilinear filter blends the last row with the first one at the terrain's edges
  and pulls the far peaks' heights into the front edge: a fringe of spikes), `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`,
  `glGenerateMipmap`, on texture unit 0 (`heightMap`). Vulkan:
  `VK_FORMAT_R8_UNORM`; D3D12: `DXGI_FORMAT_R8_UNORM` (or the RGBA8 formats with the grey in every channel – say so).
- **Patches** (learnopengl's): `rez = 20` → 20 × 20 patches of **4 control points** each (1,600 vertices, 5 floats:
  position + texture coordinate), patch (i, j) with the corners in learnopengl's order
  `(x_i, z_j), (x_i+1, z_j), (x_i, z_j+1), (x_i+1, z_j+1)` where `x_i = -width / 2 + width * i / rez`, `z_j = -height / 2
  + height * j / rez`, y = 0, texture coordinates `(i / rez, j / rez)` …; attribute 0 = position (vec3), 1 = texture
  coordinate (vec2). `glPatchParameteri(GL_PATCH_VERTICES, 4)`, `glDrawArrays(GL_PATCHES, 0, 4 * rez * rez)`.
  Vulkan: `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST`, the `tessellationShader` device feature,
  `VkPipelineTessellationStateCreateInfo.patchControlPoints = 4`, `vkCmdDraw(4 * rez * rez, 1, 0, 0)`; D3D12:
  `D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST` (PSO topology type `PATCH`), `DrawInstanced(4 * rez * rez, 1, 0, 0)`.
- **Tessellation evaluation** (`gpuheight.tes`, learnopengl's): `layout (quads, fractional_odd_spacing, ccw) in;`,
  `u = gl_TessCoord.x`, `v = gl_TessCoord.y`, the texture coordinate and the position interpolated bilinearly from the
  four corners (`t0 = (t01 - t00) * u + t00; t1 = (t11 - t10) * u + t10; texCoord = (t1 - t0) * v + t0`, the same for
  the positions), `Height = texture(heightMap, texCoord).r * 64.0 - 16.0`, moved along the patch normal
  `normalize(cross(vVec, uVec))` (= +y), then `projection * view * model`. D3D12 domain shader: `[domain("quad")]`,
  `SV_DomainLocation` (float2 u, v) and `OutputPatch<…, 4>`; the hull shader `[domain("quad")]`,
  `[partitioning("fractional_odd")]`, `[outputtopology("triangle_ccw")]`, `[outputcontrolpoints(4)]`,
  `[patchconstantfunc(...)]` writing `SV_TessFactor[4]` / `SV_InsideTessFactor[2]`. Vulkan's tessellator reads
  `gl_TessCoord` with the same convention as OpenGL's; check on lavapipe that the terrain is not mirrored.
- **Tessellation control** (`gpuheight.tcs`, `layout (vertices = 4) out;`): first (task `tess-control`) the article's
  fixed levels, with the course's number: all four outer and both inner levels **8** (the article: 16 – with 20 × 20
  patches over a 256-pixel map, 8 already reaches about one segment per 1.6 texels, and the wireframe stays readable);
  then (task `distance-levels`) learnopengl's distance-based levels with the course's numbers for its smaller map and
  this camera: `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450` (learnopengl: 4,
  64, 20, 800 for its 2.6 k map; the terrain's eye-space depth here runs from about 240 at the front edge to 450 at the
  back, so the front gets level 8 and the back about 2) – eye-space depth
  `abs((view * model * gl_in[k].gl_Position).z)` of each corner, scaled to 0 … 1, the outer level of an edge from the
  nearer of its two corners (`mix(MAX, MIN, min(d_a, d_b))`), the inner levels the max of the opposite outer levels –
  learnopengl's code exactly. **The start already has the control shader with every level 1** (it passes the control
  points and their texture coordinates through – learnopengl's control shader renames the vertex shader's `TexCoord`
  to `TextureCoord` – and writes 1 for all six levels: no new vertices, one quad (two triangles) per patch). OpenGL
  could leave the control stage out (the levels then come from `GL_PATCH_DEFAULT_OUTER_LEVEL` / `INNER`, 1.0), but the
  vertex shader's outputs would have to be named like the evaluation shader's inputs; Vulkan and D3D12 always need the
  control / hull stage – so every API keeps it in every state.
- **Wireframe** (task `wireframe`): `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)` once before the loop. Vulkan:
  `polygonMode = VK_POLYGON_MODE_LINE` with the `fillModeNonSolid` device feature; D3D12: `D3D12_FILL_MODE_WIREFRAME`.
  The solution ends in wireframe (learnopengl toggles it with a key; the course has no input).
- The CPU code of the start (vertices from the pixels, strips) is removed by the tasks.

- `cpuheight.vs/.fs` of the start stay in the project, unused once the CPU grid is gone (the edits cannot delete files).

**What the camera sees**: the terrain of `tessellation-height-map`, from the same place. Named points (as there):
**peak** (420,110), **ridge** (230,150), **centre** (400,300), **hill** (150,380), **valley** (380,440), **lake**
(580,390), **front** (600,470), **background** (400,40), **below** (400,560). For the wireframe states, two boxes: the
**front box** (x 300…499, y 400…449, near the camera) and the **back box** (x 250…449, y 150…199, the far slopes):
the share of their pixels that are not the clear colour (lines) tells how dense the triangles are.

**Start picture** (= the solution of `tessellation-height-map`): peak = 212,212,212, ridge = 144,144,144, centre =
91,91,91, hill = 102,102,102, valley = 88,88,88, lake = 28,28,28, front = 66,66,66, background = below = 26,26,26.

## `opengl-4-1`
- **Task:** Ask GLFW for an OpenGL 4.1 core context (tessellation shaders are core since 4.0), and print the largest tessellation level the GPU supports.
- **Hint:** `glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4); glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 1);` and, after GLAD is loaded, `glGetIntegerv(GL_MAX_TESS_GEN_LEVEL, &maxTessLevel);` (at least 64).
- **When done:** `main.cpp`: the 4 / 1 window hints, `GLint maxTessLevel; glGetIntegerv(GL_MAX_TESS_GEN_LEVEL,
  &maxTessLevel);` and the print `Max available tess level: 64` (Mesa; NVIDIA and AMD say 64 too). The CPU terrain is
  still drawn: **no visible change** (the start picture).

## `height-texture`
- **Task:** The GPU will read the heights itself: instead of turning the pixels into vertices on the CPU, load the height map into a texture (one channel, `GL_R8`, clamped at the edges, with mipmaps) on texture unit 0. Remove the CPU grid – its vertices, indices, buffers and the strip drawing.
- **Hint:** `glTexImage2D(GL_TEXTURE_2D, 0, GL_R8, width, height, 0, GL_RED, GL_UNSIGNED_BYTE, data); glGenerateMipmap(GL_TEXTURE_2D);` with `GL_CLAMP_TO_EDGE` on S and T, `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`, then `stbi_image_free(data)`. Delete the texture at the end.
- **When done:** `main.cpp`: `unsigned int texture;` (`glGenTextures`, `glActiveTexture(GL_TEXTURE0)`, `glBindTexture`,
  the four `glTexParameteri`, `glTexImage2D(… GL_R8 … GL_RED …)`, `glGenerateMipmap`), `glDeleteTextures(1, &texture)`;
  no `vertices`/`indices`/`terrainIBO`/strip loop any more. Nothing is drawn: **only the clear colour** (all named
  points 26,26,26).

## `patch-grid`
- **Task:** Build the patches: a grid of 20 × 20 flat squares, each given as its 4 corners (a patch of 4 control points) with a position (y = 0) and a texture coordinate; put them into a VAO/VBO (attribute 0: position, 1: texture coordinate) and tell OpenGL that a patch has 4 vertices.
- **Hint:** learnopengl's loop over `i` and `j` (0 … rez - 1) pushes the corners (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1): x = `-width / 2.0f + width * i / (float)rez`, z = `-height / 2.0f + height * j / (float)rez`, texture coordinate `(i / (float)rez, j / (float)rez)`. `glPatchParameteri(GL_PATCH_VERTICES, NUM_PATCH_PTS);` with `const unsigned int NUM_PATCH_PTS = 4;`.
- **When done:** `main.cpp`: `NUM_PATCH_PTS = 4`, `unsigned rez = 20;`, the 1,600 vertices (5 floats each), the prints
  (`Loaded 400 patches of 4 control points each`, `Processing 1600 vertices in vertex shader`), `terrainVAO` /
  `terrainVBO` with attributes 0 (3 floats) and 1 (2 floats, offset 3 floats), stride 5 floats,
  `glPatchParameteri(GL_PATCH_VERTICES, NUM_PATCH_PTS)`, their deletion at the end. Still nothing drawn: **only the
  clear colour**.

## `tess-evaluation`
- **Task:** Write the tessellation evaluation shader: for each vertex the tessellator makes (at `gl_TessCoord` u, v inside the patch) interpolate the corners' texture coordinates and positions bilinearly, read the height from the height map, move the point up by it, and project it. Build the shader program from all four stages and draw the patches.
- **Hint:** `layout (quads, fractional_odd_spacing, ccw) in;`; `t0 = (t01 - t00) * u + t00; t1 = (t11 - t10) * u + t10; texCoord = (t1 - t0) * v + t0;` (the same for the positions), `Height = texture(heightMap, texCoord).r * 64.0 - 16.0;`, the normal `normalize(cross(vVec.xyz, uVec.xyz))`. `Shader tessHeightMapShader("gpuheight.vs", "gpuheight.fs", nullptr, "gpuheight.tcs", "gpuheight.tes");`, `glDrawArrays(GL_PATCHES, 0, NUM_PATCH_PTS * rez * rez);`.
- **When done:** `gpuheight.tes`: learnopengl's evaluation shader (`uniform sampler2D heightMap;`, `out float Height;`).
  `main.cpp`: `tessHeightMapShader` from the four files (no geometry shader), `use()` + `setInt("heightMap", 0)`, the
  matrices set on it in the loop, `glBindVertexArray(terrainVAO); glDrawArrays(GL_PATCHES, 0, NUM_PATCH_PTS * rez *
  rez);`. The start's control shader sets every level to 1, so **every patch is one flat quad** with the heights of
  its 4 corners: **a coarse terrain** of 20 × 20 tilted squares (800 triangles), the right outline but no detail – the
  lake a shallow dent, the peaks blunt: peak = 214,214,214, ridge = 144,144,144, centre = 87,87,87, hill =
  101,101,101, valley = 76,76,76, lake = 28,28,28, front = 64,64,64, background = below = 26,26,26 (214,031 pixels not
  background).

## `tess-control`
- **Task:** Tessellate: in the control shader set all four outer levels and both inner levels to 8, so every patch is cut into 8 × 8 small quads whose new vertices each read their own height.
- **Hint:** `gl_TessLevelOuter[0..3] = 8; gl_TessLevelInner[0..1] = 8;` – written once per patch, by invocation 0 (`if (gl_InvocationID == 0)`).
- **When done:** `gpuheight.tcs`: the six levels 8. **The full terrain** again (about 102,400 triangles; the same
  as the CPU terrain within a few grey levels): peak = 213,213,213, ridge = 145,145,145, centre = 91,91,91, hill =
  101,101,101, valley = 88,88,88, lake = 28,28,28, front = 67,67,67, background = below = 26,26,26 (213,964 pixels).

## `wireframe`
- **Task:** Draw only the triangles' edges to see the tessellation.
- **Hint:** `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` once before the render loop (learnopengl toggles it with a key).
- **When done:** `main.cpp`: `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);`. **The terrain as a grey wireframe**: a regular
  mesh, the same density on every patch, the clear colour between the lines (167,297 pixels not background; front box
  74.8 % lines, back box 87.3 % – far patches are smaller on screen, so their lines crowd). The named points lie on lines
  or gaps by chance (on Mesa: the solid values of `tess-control`) – check the boxes.

## `distance-levels`
- **Task:** Make the levels depend on the distance to the camera: for each corner its eye-space depth, scaled to 0…1 between `MIN_DISTANCE` (250) and `MAX_DISTANCE` (450); each outer level from the nearer of its edge's two corners, mixed from `MAX_TESS_LEVEL` (8) near to `MIN_TESS_LEVEL` (2) far; the inner levels the larger of the opposite outer levels.
- **Hint:** learnopengl's code: `vec4 eyeSpacePos00 = view * model * gl_in[0].gl_Position;`, `float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);`, `tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));` …, `gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);`. An edge shared by two patches gets the same level from both, so no cracks open.
- **When done:** `gpuheight.tcs`: `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450`,
  the uniforms `model` and `view` used, the distance-based levels. **Near patches stay fine, far ones get coarse**: the
  wireframe at the back opens up into large triangles (back box 47.3 % lines, was 87.3 %), the front stays dense
  (front box 71.8 %); 137,244 pixels not background. This is the solution.
