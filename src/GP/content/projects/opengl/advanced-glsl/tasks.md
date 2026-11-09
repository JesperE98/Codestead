# Advanced GLSL – tasks (OpenGL)

learnopengl "Advanced GLSL": the `gl_FragCoord` and `gl_FrontFacing` examples and interface blocks of the chapter text,
then `8.advanced_glsl_ubo` (`advanced_glsl_ubo.cpp`, `8.advanced_glsl.vs`, `8.red.fs` … `8.yellow.fs`). Files:
`main.cpp`, `shader_m.h`, `advanced_glsl.vs`, `advanced_glsl.fs` (the textured shaders of Depth Testing), for the last
task `uniform_buffer.vs` (projection and view still plain uniforms, with a TODO), `red.fs`, `green.fs`, `blue.fs`,
`yellow.fs` (complete: one colour each, like learnopengl's), `marble.png`, `metal.png`.

Start: the Depth Testing scene (`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, cube 0 at (-1, 0, -1), cube 1 at
(2, 0, 0), then the floor; camera globals cameraPos (0, 0, 3) looking down -z, fov 45; clear colour (0.1, 0.1, 0.1)),
with **the Face Culling chapter's counter-clockwise cube** (every triangle counter-clockwise seen from outside; culling
is off, so it looks exactly like learnopengl's cube). A TODO after `glDepthFunc` (face culling for `front-facing`).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Start picture: **background** (400,100), (30,150), (400,300) = 26,26,26; **cube0-centre** (193,300) ≈ 141,140,138,
**cube0-light** (150,250) ≈ 208,204,194, **cube0-bottom** (193,390) ≈ 193,190,182, (130,250) ≈ 195,192,183; **cube 1**
(760,250) ≈ 168,165,159; **floor-near** (100,500) ≈ 137,141,147, (400,560) ≈ 83,87,93, (390,500) ≈ 106,110,116,
(410,500) ≈ 84,88,94; **floor-far** (600,370) ≈ 135,139,145.

## `frag-coord`
- **Task:** In `advanced_glsl.fs`, colour every fragment by its window position: red where `gl_FragCoord.x < 400`, green elsewhere.
- **Hint:** `gl_FragCoord` holds the fragment's window coordinates in pixels (origin at the bottom-left). `if(gl_FragCoord.x < 400) FragColor = vec4(1.0, 0.0, 0.0, 1.0); else FragColor = vec4(0.0, 1.0, 0.0, 1.0);`
- **When done:** advanced_glsl.fs main: `if(gl_FragCoord.x < 400) FragColor = vec4(1.0, 0.0, 0.0, 1.0); else FragColor =
  vec4(0.0, 1.0, 0.0, 1.0);` (the texture is no longer sampled). Every object is a flat colour, **split at x = 400**:
  cube 0 and the floor's left half **red**: cube0-centre, cube0-light, cube0-bottom, floor-near (100,500), (390,500) =
  255,0,0; cube 1 and the floor's right half **green**: (760,250), (410,500), (400,560), (600,370) = 0,255,0. The
  background stays 26,26,26 (no fragments there).

## `front-facing`
- **Task:** Texture the front faces with marble and the back faces with metal (`gl_FrontFacing`, samplers `frontTexture` on unit 0 and `backTexture` on unit 1). From outside you only ever see front faces, so also enable face culling and cull the FRONT faces: you look into the cubes and see their back faces.
- **Hint:** `if(gl_FrontFacing) FragColor = texture(frontTexture, TexCoords); else FragColor = texture(backTexture, TexCoords);` – `shader.setInt("frontTexture", 0); shader.setInt("backTexture", 1);`, and before the cubes' draws bind `cubeTexture` to `GL_TEXTURE0` and `floorTexture` to `GL_TEXTURE1`. `glEnable(GL_CULL_FACE); glCullFace(GL_FRONT);` (the cube is counter-clockwise from outside, OpenGL's default front).
- **When done:** after `glDepthFunc`: `glEnable(GL_CULL_FACE); glCullFace(GL_FRONT);`; advanced_glsl.fs has
  `uniform sampler2D frontTexture; uniform sampler2D backTexture;` (no `texture1`) and main
  `if(gl_FrontFacing) FragColor = texture(frontTexture, TexCoords); else FragColor = texture(backTexture, TexCoords);`
  (the frag-coord colours are gone); `shader.setInt("frontTexture", 0); shader.setInt("backTexture", 1);`; the cubes'
  textures `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, cubeTexture); glActiveTexture(GL_TEXTURE1);
  glBindTexture(GL_TEXTURE_2D, floorTexture);` (the floor's own `glBindTexture` then binds metal to unit 1 again). What
  is visible: the cubes' front faces (towards the camera) are culled, so you **look into the cubes**: cube 0 shows the
  inside of its back face (a smaller square, x ≈ 158..320, y ≈ 220..380) framed by the insides of its left, top and
  bottom faces (the left band x ≈ 90..158, thin bands above and below), within the old outline, all **metal** (grey-blue, b > g > r): cube0-centre (193,300) ≈ 138,142,148, cube0-light (150,250) ≈
  149,153,159, cube0-bottom (193,390) ≈ 148,152,158, (130,250) ≈ 147,151,157; cube 1 shows the inside of its back face,
  metal: (760,250) ≈ 130,134,140. **No marble is visible.** The floor (learnopengl's plane, clockwise seen from above, so
  a back face for the camera above it) is still drawn and still metal, unchanged: floor-near ≈ 137,141,147, (400,560) ≈
  83,87,93, floor-far ≈ 135,139,145. Background 26,26,26.

## `interface-block`
- **Task:** Group the vertex shader's outputs in an interface block: `out VS_OUT { vec2 TexCoords; } vs_out;` in advanced_glsl.vs and `in VS_OUT { vec2 TexCoords; } fs_in;` in advanced_glsl.fs.
- **Hint:** The block name (`VS_OUT`) must match in both shaders; the instance names may differ. Write `vs_out.TexCoords = aTexCoords;` and read `fs_in.TexCoords`.
- **When done:** advanced_glsl.vs: `out VS_OUT { vec2 TexCoords; } vs_out;` and `vs_out.TexCoords = aTexCoords;`;
  advanced_glsl.fs: `in VS_OUT { vec2 TexCoords; } fs_in;` and `texture(frontTexture, fs_in.TexCoords)` /
  `texture(backTexture, fs_in.TexCoords)`. **No visible change** (Mesa: identical pixels to `front-facing`).

## `uniform-buffer`
- **Task:** learnopengl's uniform buffer demo replaces the scene: four cubes at (-0.75, 0.75, 0), (0.75, 0.75, 0), (-0.75, -0.75, 0), (0.75, -0.75, 0), each drawn by its own program (`uniform_buffer.vs` with `red.fs`, `green.fs`, `yellow.fs`, `blue.fs`), all sharing projection and view through one std140 uniform block `Matrices` in a uniform buffer bound to binding point 0. Remove the floor, the textures and the face culling.
- **Hint:** In uniform_buffer.vs: `layout (std140) uniform Matrices { mat4 projection; mat4 view; };`. For each program `glUniformBlockBinding(shaderRed.ID, glGetUniformBlockIndex(shaderRed.ID, "Matrices"), 0)`. The buffer: `glBufferData(GL_UNIFORM_BUFFER, 2 * sizeof(glm::mat4), NULL, GL_STATIC_DRAW)` and `glBindBufferRange(GL_UNIFORM_BUFFER, 0, uboMatrices, 0, 2 * sizeof(glm::mat4))`. std140 offsets: projection at 0, view at `sizeof(glm::mat4)` (64): write the projection once with `glBufferSubData`, the view every frame.
- **When done:** uniform_buffer.vs: `layout (std140) uniform Matrices { mat4 projection; mat4 view; };` instead of the two
  uniforms (`uniform mat4 model;` stays). main.cpp: `glEnable(GL_CULL_FACE); glCullFace(GL_FRONT);` removed;
  `Shader shaderRed("uniform_buffer.vs", "red.fs");` (and `shaderGreen`, `shaderBlue`, `shaderYellow`) instead of
  `Shader shader(...)`; `planeVertices`, the plane VAO, the two `loadTexture` calls and the shader configuration removed;
  instead learnopengl's UBO setup: `glGetUniformBlockIndex(shaderRed.ID, "Matrices")` … for the four programs,
  `glUniformBlockBinding(shaderX.ID, uniformBlockIndexX, 0)` ×4, `unsigned int uboMatrices;` with
  `glBufferData(GL_UNIFORM_BUFFER, 2 * sizeof(glm::mat4), NULL, GL_STATIC_DRAW)`,
  `glBindBufferRange(GL_UNIFORM_BUFFER, 0, uboMatrices, 0, 2 * sizeof(glm::mat4))`, `glm::mat4 projection =
  glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);` written once with
  `glBufferSubData(GL_UNIFORM_BUFFER, 0, sizeof(glm::mat4), glm::value_ptr(projection))`. In the loop: `glm::mat4 view =
  glm::lookAt(...)`, `glBufferSubData(GL_UNIFORM_BUFFER, sizeof(glm::mat4), sizeof(glm::mat4), glm::value_ptr(view))`,
  then the four cubes (`cubeVAO`, `shaderX.use()`, `model = glm::translate(...)`, `shaderX.setMat4("model", model)`,
  `glDrawArrays(GL_TRIANGLES, 0, 36)`) – red top-left, green top-right, yellow bottom-left, blue bottom-right; cleanup
  deletes `cubeVAO`, `cubeVBO`, `uboMatrices`. (`advanced_glsl.vs/.fs`, `marble.png` and `metal.png` stay in the
  folder but are no longer used.) Picture: **four flat-coloured cubes** on the dark background, so close to the
  camera that they touch the window's edges (learnopengl's camera (0, 0, 3), fov 45°): **red** x ≈ 38..347, y ≈ 0..247,
  (200,150) = 255,0,0; **green** x ≈ 452..761, y ≈ 0..247, (600,150) = 0,255,0; **yellow** x ≈ 38..347, y ≈ 352..599,
  (200,450) = 255,255,0; **blue** x ≈ 452..761, y ≈ 352..599, (600,450) = 0,0,255; the gaps between them are background:
  centre (400,300), (193,300), (400,100), (30,150) = 26,26,26. Final state.

  (learnopengl's own `advanced_glsl_ubo.cpp` passes `45.0f` to `glm::perspective`, which takes radians – that is why its
  cubes look smaller there; here the field of view is the course's 45°, `glm::radians(fov)`.)
