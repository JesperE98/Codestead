# Tessellation (GPU) – tasks (OpenGL)

learnopengl "Guest Articles / Tessellation / Tessellation": `src/8.guest/2021/3.tessellation/terrain_gpu_dist/main.cpp`
with `8.3.gpuheight.vs/.tcs/.tes/.fs` and `includes/learnopengl/shader_t.h`. Files: `main.cpp`, `shader_t.h`
(learnopengl's Shader class with optional geometry, tessellation control and tessellation evaluation files – the
course's `shader_m.h` grown by two parameters), `cpuheight.vs/.fs` (the start's CPU shaders), `gpuheight.vs/.tcs/.tes/.fs`
(learnopengl's names without the `8.3.` prefix) and `heightmap.png`.

**Start = the solution of `tessellation-height-map`** (the CPU terrain), with the GPU version's files added as
TODOs; the tasks replace the CPU grid by patches the GPU tessellates.

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL 4.1 core** (learnopengl's; tessellation shaders are core since 4.0). Shaders `#version 410 core`. 4.1 is the
highest version macOS offers, so the chapter runs there.

**Fixed choices (the same in every API):**
- Height map, orientation, heights, colour, camera, projection (near 0.1, far 1000), clear colour: exactly as in
  `tessellation-height-map` (see its tasks.md) – both chapters show the same terrain from the same place.
- **The height map as a texture**: `GL_R8` (one channel, `GL_RED` data – our map has one channel; learnopengl uploads
  its RGBA map with `GL_RGBA` and reads `.y`, the course reads `.r`), not flipped, `GL_REPEAT`,
  `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`, `glGenerateMipmap`, on texture unit 0 (`heightMap`). Vulkan:
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
  fixed levels: all four outer and both inner levels **16**; then (task `distance-levels`) learnopengl's distance-based
  levels with the course's numbers for its smaller map: `MIN_TESS_LEVEL = 4`, `MAX_TESS_LEVEL = 16`,
  `MIN_DISTANCE = 100`, `MAX_DISTANCE = 450` (learnopengl: 4, 64, 20, 800 for its 2.6 k map) – eye-space depth
  `abs((view * model * gl_in[k].gl_Position).z)` of each corner, scaled to 0 … 1, the outer level of an edge from the
  nearer of its two corners (`mix(MAX, MIN, min(d_a, d_b))`), the inner levels the max of the opposite outer levels –
  learnopengl's code exactly. Without a control shader (task `tess-evaluation`), OpenGL uses the default levels
  (`GL_PATCH_DEFAULT_OUTER_LEVEL` / `INNER`, all 1.0): one quad (two triangles) per patch. Vulkan and D3D12 always need
  the control / hull stage: in their `tess-evaluation` step use a control/hull shader that writes 1.0 for every level
  (and say why).
- **Wireframe** (task `wireframe`): `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)` once before the loop. Vulkan:
  `polygonMode = VK_POLYGON_MODE_LINE` with the `fillModeNonSolid` device feature; D3D12: `D3D12_FILL_MODE_WIREFRAME`.
  The solution ends in wireframe (learnopengl toggles it with a key; the course has no input).
- The CPU code of the start (vertices from the pixels, strips) is removed by the tasks.

(Tasks and pixel values follow.)
