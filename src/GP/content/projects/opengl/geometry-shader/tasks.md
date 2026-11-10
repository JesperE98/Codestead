# Geometry Shader – tasks (OpenGL)

learnopengl "Geometry Shader": `src/4.advanced_opengl/9.1.geometry_shader_houses`, `9.2.geometry_shader_exploding`,
`9.3.geometry_shader_normals`. Files: `main.cpp`, `shader_m.h`, `mesh.h` + `model.h` (the finished Model chapter
classes), the shaders `geometry_shader.vs/.fs/.gs` (houses), `explode.vs/.fs/.gs` (9.2), `default.vs/.fs` and
`normal_visualization.vs/.fs/.gs` (9.3), and the read-only model in `models/` (`planet.obj`, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`, copied from the Model chapter).
Compiled with `-lassimp` (model.h).

Start: learnopengl 9.1's program – no camera, no matrices: clear (0.1, 0.1, 0.1), depth test on, four points
(learnopengl's `points[]`: 2D position + colour) drawn with `glDrawArrays(GL_POINTS, 0, 4)` by `geometry_shader.vs` /
`.fs` (the vertex shader outputs `fColor`). `main.cpp` already includes glm, `model.h` and stb_image (used from the
`planet` task on). TODOs: `shader_m.h` (4: the optional geometry shader file), `geometry_shader.gs` (the whole file is a
TODO), `explode.gs` (a working triangle pass-through with a TODO for the explode functions), `normal_visualization.gs`
(the whole file is a TODO). `explode.vs/.fs`, `default.vs/.fs` and `normal_visualization.vs/.fs` are complete
(learnopengl's) and unused until their task. Every state between tasks compiles and runs.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window. Background = 26,26,26
everywhere it is named.

**Start picture:** four single pixels (points are 1 px) on the background: **red** 255,0,0 at (199,150), **green**
0,255,0 at (599,150), **yellow** 255,255,0 at (199,450), **blue** 0,0,255 at (599,450) – i.e. at NDC (±0.5, ±0.5).
Every other pixel 26,26,26. (The points lie exactly on pixel corners; the simulator puts them one row higher, at
y = 149 / 449 – check a 3×3 neighbourhood.)

## `pass-through`
- **Task:** Let the Shader class take an optional third file, a geometry shader (`const char* geometryPath = nullptr`), compiled as `GL_GEOMETRY_SHADER` and attached to the program; write `geometry_shader.gs` that passes each point through unchanged (with its colour), and use it.
- **Hint:** In `shader_m.h`: if `geometryPath != nullptr`, read the file like the other two, `glCreateShader(GL_GEOMETRY_SHADER)`, `glShaderSource`, `glCompileShader`, `checkCompileErrors(geometry, "GEOMETRY")`; attach it before linking and delete it afterwards. The geometry shader: `layout (points) in; layout (points, max_vertices = 1) out;`, `gl_Position = gl_in[0].gl_Position; EmitVertex(); EndPrimitive();`. The colour now goes vertex shader → geometry shader → fragment shader: the vertex shader writes an interface block `out VS_OUT { vec3 color; } vs_out;`, the geometry shader reads `in VS_OUT { vec3 color; } gs_in[];` (an array: one per input vertex) and writes `out vec3 fColor;`.
- **When done:** `shader_m.h`: `Shader(const char* vertexPath, const char* fragmentPath, const char* geometryPath = nullptr)`;
  after the fragment shader `unsigned int geometry = 0; if (geometryPath != nullptr) { … gShaderFile.open(geometryPath) …
  geometry = glCreateShader(GL_GEOMETRY_SHADER); glShaderSource(geometry, 1, &gShaderCode, NULL); glCompileShader(geometry);
  checkCompileErrors(geometry, "GEOMETRY"); }`; `if (geometryPath != nullptr) glAttachShader(ID, geometry);` after the
  two attaches; `if (geometryPath != nullptr) glDeleteShader(geometry);` after the two deletes.
  `geometry_shader.gs`: `layout (points) in;`, `layout (points, max_vertices = 1) out;`, `in VS_OUT { vec3 color; } gs_in[];`,
  `out vec3 fColor;`, main: `fColor = gs_in[0].color; gl_Position = gl_in[0].gl_Position; EmitVertex(); EndPrimitive();`.
  `geometry_shader.vs`: `out VS_OUT { vec3 color; } vs_out;` and `vs_out.color = aColor;` instead of `fColor`.
  `main.cpp`: `Shader shader("geometry_shader.vs", "geometry_shader.fs", "geometry_shader.gs");`.
  **No visible change** (the same four 1-px points, same colours and places).

## `houses`
- **Task:** Turn each point into a house: the geometry shader outputs a triangle strip of 5 vertices per point (learnopengl's `build_house`): bottom-left, bottom-right, top-left, top-right (±0.2 around the point) and the roof's top (0, +0.4).
- **Hint:** `layout (triangle_strip, max_vertices = 5) out;` A strip of 5 vertices makes 3 triangles: two for the walls, one for the roof. Set `fColor = gs_in[0].color;` once, then `gl_Position = position + vec4(-0.2, -0.2, 0.0, 0.0); EmitVertex();` … and `EndPrimitive();` at the end. Call `build_house(gl_in[0].gl_Position);` from `main`.
- **When done:** `geometry_shader.gs`: `layout (triangle_strip, max_vertices = 5) out;`, a function
  `void build_house(vec4 position)` with the five `gl_Position = position + vec4(…); EmitVertex();` (offsets
  (-0.2,-0.2), (0.2,-0.2), (-0.2,0.2), (0.2,0.2), (0.0,0.4)) and `EndPrimitive();`, `main` calls
  `build_house(gl_in[0].gl_Position);`. **Four houses** in the points' colours: each a 160×120 px wall with a 60 px
  roof on top (bounding box of all four: x 120..679, y 30..509). Red house walls x 120..279, y 90..209, roof tip at
  (200,30); green x 520..679, y 90..209; yellow x 120..279, y 390..509; blue x 520..679, y 390..509.
  (200,150) = 255,0,0, (200,60) = 255,0,0 (roof), (600,150) = 0,255,0, (600,60) = 0,255,0, (200,450) = 255,255,0,
  (200,360) = 255,255,0, (600,450) = 0,0,255, (600,360) = 0,0,255; background between them: (400,300), (400,150),
  (281,150) = 26,26,26.

## `roof-white`
- **Task:** Put snow on the roofs: give the last vertex of the strip (the roof's top) the colour white.
- **Hint:** The fragment shader's input is interpolated between the vertices; `fColor` is a per-vertex output, so set `fColor = vec3(1.0, 1.0, 1.0);` just before the fifth `EmitVertex()`.
- **When done:** `geometry_shader.gs`: `fColor = vec3(1.0, 1.0, 1.0);` between the fifth `gl_Position = …` and its
  `EmitVertex();`. The roofs fade from the house colour at the eaves to **white at the tip**; the walls are unchanged.
  (200,150) = 255,0,0 (wall), (200,60) = 255,125,125, (200,35) = 255,232,232; (600,60) = 125,255,125;
  (200,360) = 255,255,125; (600,360) = 125,125,255, (600,335) = 232,232,255; walls (600,150) = 0,255,0,
  (200,450) = 255,255,0, (600,450) = 0,0,255; background unchanged.

## `planet`
- **Task:** Switch to the model scene of the Model chapter: camera globals at (0, 0, 3) looking down -z, the planet loaded with `Model ourModel("models/planet.obj");`, the projection (45°, 800/600, 0.1, 100), the view (lookAt) and learnopengl's model matrix (tilted 25° about x, scaled 0.5), drawn with the `explode` shaders – whose geometry shader so far passes every triangle through unchanged. Remove the points.
- **Hint:** `Shader shader("explode.vs", "explode.fs", "explode.gs");` – `explode.vs` computes `gl_Position = projection * view * model * vec4(aPos, 1.0)` and hands the texture coordinates on in `VS_OUT`; `explode.gs` takes `layout (triangles) in;` and emits the three vertices again. In the loop set `projection`, `view` and `model` with `shader.setMat4(...)` and call `ourModel.Draw(shader);`.
- **When done:** `main.cpp`: globals `cameraPos (0, 0, 3)`, `cameraFront (0, 0, -1)`, `cameraUp (0, 1, 0)` after
  `SCR_HEIGHT`; `Shader shader("explode.vs", "explode.fs", "explode.gs");` and `Model ourModel("models/planet.obj");`
  instead of the points' setup (`points[]`, `VBO`, `VAO` and their cleanup removed); in the loop
  `glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f)`,
  `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`, the model matrix (`translate (0,0,0)`,
  `rotate(glm::radians(25.0f), (1,0,0))`, `scale(0.5f)`), `shader.use()`, three `setMat4` and `ourModel.Draw(shader);`.
  **The textured planet with its ring** (unlit, the Model chapter's `draw-model` picture on the 0.1 background): model
  x ≈ 147..652, y ≈ 178..445. Centre (400,300) = 105,140,60 (land), pole (400,186) = 235,240,245, sea (380,215) =
  28,70,150, lake (437,220) = 28,70,150, ring-front (400,420) = 178,153,119, ring-left (175,330) = 79,67,52,
  ring-right (625,330) = 82,70,55, gap (250,310), (100,100) and (400,520) = 26,26,26.

## `explode`
- **Task:** Explode the planet: in `explode.gs` move every triangle along its face normal by `(sin(time) + 1) / 2 * 2.0` (learnopengl's `explode` and `GetNormal`), with a `uniform float time` set from `glfwGetTime()`.
- **Hint:** `GetNormal()`: `vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position); vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position); return normalize(cross(a, b));` `explode(position, normal)` returns `position + vec4(normal * ((sin(time) + 1.0) / 2.0) * magnitude, 0.0)` with `magnitude = 2.0`. In `main`: `vec3 normal = GetNormal();` and `gl_Position = explode(gl_in[i].gl_Position, normal);` for the three vertices. In `main.cpp`: `shader.setFloat("time", static_cast<float>(glfwGetTime()));`.
- **When done:** `explode.gs`: `uniform float time;`, `vec4 explode(vec4 position, vec3 normal)` (`float magnitude = 2.0;`,
  `vec3 direction = normal * ((sin(time) + 1.0) / 2.0) * magnitude;`), `vec3 GetNormal()` with the cross product,
  `main` uses `vec3 normal = GetNormal();` and `explode(gl_in[0..2].gl_Position, normal)`. `main.cpp`:
  `shader.setFloat("time", static_cast<float>(glfwGetTime()));` after the model matrix. **Animated:** the planet's
  triangles fly apart and back with a period of 2π s (apart the most at t = π/2, whole again at t = 3π/2 ≈ 4.7 s).
  learnopengl does this in clip space (after the projection), as here. At **t = 1 s** (offset 1.84): the pieces fill
  almost the whole window (bounding box x ≈ 27..773, y 0..599) as a large sphere of separate small quads with dark gaps;
  centre (400,300), pole (400,186), sea (380,215), ring-front (400,420) = 26,26,26 (gaps); (250,310) = 91,134,57 (a
  land piece); in the strip x < 140 (empty before) ≈ 4,000 pixels are not background, in the rows y < 170 ≈ 14,100; in
  the square x 350..449, y 250..349 about half the pixels (≈ 4,900 of 10,000) are pieces. (Measured with the time
  fixed at 1.0; Mesa and the simulator agree to 0.4 %.)

## `normals`
- **Task:** learnopengl 9.3: draw the planet normally (`default.vs/.fs`), then draw it a second time with `normal_visualization.vs/.fs/.gs`, a geometry shader that emits, for each vertex of each triangle, a yellow line of length 0.2 along the vertex normal.
- **Hint:** The vertex shader works in view space (`gl_Position = view * model * vec4(aPos, 1.0)`, the normal with `mat3(transpose(inverse(view * model)))`); the geometry shader takes `layout (triangles) in;`, outputs `layout (line_strip, max_vertices = 6) out;` and for each vertex `i` emits `projection * gl_in[i].gl_Position` and `projection * (gl_in[i].gl_Position + vec4(gs_in[i].normal, 0.0) * MAGNITUDE)`, then `EndPrimitive()`. The time uniform is no longer needed.
- **When done:** `normal_visualization.gs`: `layout (triangles) in;`, `layout (line_strip, max_vertices = 6) out;`,
  `in VS_OUT { vec3 normal; } gs_in[];`, `const float MAGNITUDE = 0.2;`, `uniform mat4 projection;`,
  `void GenerateLine(int index)` (two `EmitVertex()` and `EndPrimitive()`), `main` calls `GenerateLine(0)`, `(1)`, `(2)`.
  `main.cpp`: `Shader shader("default.vs", "default.fs");` and `Shader normalShader("normal_visualization.vs",
  "normal_visualization.fs", "normal_visualization.gs");`, the `setFloat("time", …)` line removed, after
  `ourModel.Draw(shader);` `normalShader.use();`, `setMat4("projection" / "view" / "model", …)` and
  `ourModel.Draw(normalShader);`. (`normal_visualization.vs` normalizes the transformed normal: our model is scaled by
  0.5, so without it the lines would be 0.4 long – learnopengl's model is not scaled.) Picture: the unexploded planet
  of the `planet` task with **yellow (255,255,0) hairs** standing out of the sphere and up from the ring (≈ 12,300
  yellow pixels; bounding box grows to x ≈ 139..660, y ≈ 126..472). Above the planet, x 300..499, y 120..176 (only
  background before) ≈ 2,230 yellow pixels, e.g. (399,126) = 255,255,0. The planet's own pixels where no line passes
  are unchanged: centre (400,300) = 105,140,60, pole (400,186) = 235,240,245, ring-front (400,420) = 178,153,119;
  background (100,100), (400,520) = 26,26,26. Static. Final state.
