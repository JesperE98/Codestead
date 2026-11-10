# Instancing – tasks (OpenGL)

learnopengl "Instancing": `src/4.advanced_opengl/10.1.instancing_quads`, `10.2.asteroids`, `10.3.asteroids_instanced`.
Files: `main.cpp`, `shader_m.h`, `mesh.h` + `model.h` (the finished Model chapter classes: `Mesh::VAO`,
`Mesh::indices`, `Model::meshes` and `Model::textures_loaded` are public, as learnopengl's asteroid demo needs),
`instancing.vs/.fs` (the quads), `planet.vs/.fs` and `asteroids.vs/.fs` (10.3), and the read-only models in `models/`:
`planet.obj`, `planet.mtl`, `planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png` (Model chapter)
and the course's rock `rock.obj`, `rock.mtl`, `rock.png`. Compiled with `-lassimp`.

Start: learnopengl 10.1 before instancing – no camera, no matrices: clear (0.1, 0.1, 0.1), one small quad (learnopengl's
`quadVertices`: 2D position + colour, ±0.05) drawn once with `glDrawArrays(GL_TRIANGLES, 0, 6)` in the centre.
`main.cpp` already includes glm, `model.h` and stb_image (used from the `planet` task on). TODOs: `main.cpp` (the
offsets) and `asteroids.vs` (the instance matrix). `planet.vs/.fs` and `asteroids.fs` are complete (learnopengl's) and
unused until their task. Every state between tasks compiles and runs.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window. Nothing depends on time.
Background = 26,26,26.

**Start picture:** one 40×30 px quad in the centre (x 380..419, y 285..314), coloured from its corners: near top-left
(382,287) = 234,16,5 (red), bottom-left (382,313) = 13,16,226 (blue), top-right (418,287) = 10,245,224 (cyan),
bottom-right (418,313) = 10,245,3 (green); centre (400,300) = 123,131,1 (on the diagonal: half red, half green). Every
other pixel background, e.g. (40,30), (760,570), (200,150).

The quads' grid (after `offsets`): quad centres at x = 40, 120, 200, …, 760 and y = 30, 90, 150, …, 570 (NDC −0.9 … 0.9
in steps of 0.2), each 40×30 px; instance 0 is bottom-left, instance 9 bottom-right, instance 90 top-left, instance 99
top-right (learnopengl's loop runs y from −10 (bottom) up).

## `offsets`
- **Task:** Draw 100 quads with one draw call: compute learnopengl's 100 translations (a 10×10 grid, `offset = 0.1f`) on the CPU, hand them to the vertex shader as a uniform array `vec2 offsets[100]`, pick the instance's offset with `gl_InstanceID`, and draw with `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100)`.
- **Hint:** `glm::vec2 translations[100];` filled in two nested loops `for (int y = -10; y < 10; y += 2)` / `for (int x = -10; x < 10; x += 2)` with `translation.x = (float)x / 10.0f + offset;` (same for y) and `translations[index++] = translation;`. Each array element is its own uniform: `shader.setVec2("offsets[" + std::to_string(i) + "]", translations[i]);` for `i` 0..99 (after `shader.use()`). In the shader: `vec2 offset = offsets[gl_InstanceID];` and `gl_Position = vec4(aPos + offset, 0.0, 1.0);`.
- **When done:** `instancing.vs`: `uniform vec2 offsets[100];`, `vec2 offset = offsets[gl_InstanceID];`,
  `gl_Position = vec4(aPos + offset, 0.0, 1.0);`. `main.cpp`: instead of the TODO the `translations` loop
  (`glm::vec2 translations[100]; int index = 0; float offset = 0.1f;` …) and
  `shader.use(); for (unsigned int i = 0; i < 100; i++) { shader.setVec2("offsets[" + std::to_string(i) + "]", translations[i]); }`;
  in the loop `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100);` instead of `glDrawArrays`. **A 10×10 grid of the
  quad** (bounding box x 20..779, y 15..584): every grid point (40,30), (760,30), (40,570), (760,570), (120,90),
  (200,150), (440,330) = 123,131,1 (each quad's centre); the window centre (400,300) and (400,330) are between quads =
  26,26,26.

## `instanced-array`
- **Task:** Replace the uniform array with an instanced array: put the 100 translations in their own vertex buffer (`instanceVBO`) and read them as vertex attribute 2 (`aOffset`) that advances once per instance (`glVertexAttribDivisor(2, 1)`).
- **Hint:** `glBufferData(GL_ARRAY_BUFFER, sizeof(glm::vec2) * 100, &translations[0], GL_STATIC_DRAW);` While `quadVAO` is bound: `glEnableVertexAttribArray(2); glBindBuffer(GL_ARRAY_BUFFER, instanceVBO); glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);` then `glVertexAttribDivisor(2, 1);`. In the shader `layout (location = 2) in vec2 aOffset;` replaces the uniform.
- **When done:** `instancing.vs`: `layout (location = 2) in vec2 aOffset;` (no `offsets[100]`),
  `gl_Position = vec4(aPos + aOffset, 0.0, 1.0);`. `main.cpp`: the `setVec2` loop replaced by
  `unsigned int instanceVBO; glGenBuffers(1, &instanceVBO); glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
  glBufferData(GL_ARRAY_BUFFER, sizeof(glm::vec2) * 100, &translations[0], GL_STATIC_DRAW);`; after attribute 1:
  `glEnableVertexAttribArray(2)`, `glBindBuffer(GL_ARRAY_BUFFER, instanceVBO)`,
  `glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0)`, `glVertexAttribDivisor(2, 1)`;
  cleanup `glDeleteBuffers(1, &instanceVBO);`. **No visible change** (the same grid, pixel for pixel).

## `scale-quads`
- **Task:** learnopengl's variation: scale each quad by its instance number, `aPos * (gl_InstanceID / 100.0)`, so the quads grow from the first instance (bottom-left, invisible) to the last (top-right, full size).
- **Hint:** `vec2 pos = aPos * (gl_InstanceID / 100.0);` then `gl_Position = vec4(pos + aOffset, 0.0, 1.0);`. Write `100.0`, not `100`: an int division would give 0 for every instance.
- **When done:** `instancing.vs`: `vec2 pos = aPos * (gl_InstanceID / 100.0);`, `gl_Position = vec4(pos + aOffset, 0.0, 1.0);`.
  The quads shrink from top to bottom (and a little from right to left): top-right quad (760,30) full size (40 px wide)
  = 123,131,1; top-left (40,30) 36 px wide = 123,131,1; bottom-right (760,570) 4 px wide = 80,163,12; bottom-left
  (40,570) has size 0 = 26,26,26 (instance 0); (200,150) = 122,132,1, (440,330) = 118,135,2 (small quads, still
  coloured at their centre); bounding box x 22..779, y 15..570.

## `planet`
- **Task:** Switch to learnopengl's asteroid scene: the camera at (0, 0, 55) looking down -z (camera globals), the projection with the far plane at 1000 (the scene is large), the planet loaded with `Model planet("models/planet.obj");` and drawn with `planet.vs/.fs` at (0, -3, 0), scaled 4. Remove the quads.
- **Hint:** `Shader planetShader("planet.vs", "planet.fs");` In the loop: `glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 1000.0f)`, `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`, `model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f)); model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));`, then `planet.Draw(planetShader);`.
- **When done:** `main.cpp`: globals `cameraPos (0, 0, 55)`, `cameraFront (0, 0, -1)`, `cameraUp (0, 1, 0)`;
  `Shader planetShader("planet.vs", "planet.fs");` and `Model planet("models/planet.obj");` instead of
  `Shader shader(...)`, the translations, `instanceVBO`, `quadVertices` and `quadVAO`/`quadVBO` (and their cleanup);
  in the loop the projection (far 1000), the view, `planetShader.use()`, `setMat4("projection"/"view"/"model")` and
  `planet.Draw(planetShader);`. **A small textured planet** below the window centre (no lighting; disc of radius ≈ 53 px
  around (400,340), bounding box x ≈ 294..505, y ≈ 287..391) with its ring seen almost edge-on (the camera is 3 units
  above the ring's plane): a thin beige ellipse through the planet's middle, x ≈ 294..505, y ≈ 336..343 (4–8 px high).
  (400,320) = 101,138,59 (land), (380,360) = 72,125,52, (355,340) = 28,70,150 (ocean), (400,380) = 44,94,101; ring
  (300,340) = 138,118,92, (500,340) = 163,139,109 (1–2 px thin: allow ±1 px); background (400,200), (100,100),
  (400,500), (200,300), (600,300) = 26,26,26. (No white pole: seen from the side, the polar cap is under one pixel
  high.)

## `asteroids`
- **Task:** learnopengl 10.3: 500 rocks in a ring around the planet (radius 15, offset 2.5), their model matrices computed once on the CPU (learnopengl's loop: translation on the circle ± a random displacement, random scale 0.05–0.25, random rotation), stored in a buffer and drawn with **one** instanced draw call per rock mesh: the matrix is a per-instance vertex attribute (`mat4 aInstanceMatrix` at location 3, which takes locations 3–6).
- **Hint:** `Model rock("models/rock.obj");`, `unsigned int amount = 500; glm::mat4* modelMatrices = new glm::mat4[amount];`, `srand(42);` then learnopengl's loop with `rand()`. Fill `buffer` with `glBufferData(GL_ARRAY_BUFFER, amount * sizeof(glm::mat4), &modelMatrices[0], GL_STATIC_DRAW);` and, for each `rock.meshes[i].VAO`, four `vec4` attributes 3..6 (`stride sizeof(glm::mat4)`, offsets `0`, `sizeof(glm::vec4)`, `2 * …`, `3 * …`) with `glVertexAttribDivisor(3..6, 1)`. Draw: bind `rock.textures_loaded[0].id` to unit 0, then `glDrawElementsInstanced(GL_TRIANGLES, static_cast<unsigned int>(rock.meshes[i].indices.size()), GL_UNSIGNED_INT, 0, amount);`.
- **When done:** `asteroids.vs`: `layout (location = 3) in mat4 aInstanceMatrix;` and
  `gl_Position = projection * view * aInstanceMatrix * vec4(aPos, 1.0f);`. `main.cpp`:
  `Shader asteroidShader("asteroids.vs", "asteroids.fs");`, `Model rock("models/rock.obj");` before `planet`;
  `unsigned int amount = 500;`, `glm::mat4* modelMatrices; modelMatrices = new glm::mat4[amount];`, `srand(42);`,
  `float radius = 15.0f; float offset = 2.5f;` and learnopengl's loop (`angle`, three `displacement`s,
  `glm::translate`, `scale = (rand() % 20) / 100.0 + 0.05`, `rotAngle = rand() % 360`, `glm::rotate(model, rotAngle,
  glm::vec3(0.4f, 0.6f, 0.8f))`, `modelMatrices[i] = model;`); `unsigned int buffer;` with `glBufferData(…, amount *
  sizeof(glm::mat4), &modelMatrices[0], …)`; the loop over `rock.meshes` with `unsigned int VAO = rock.meshes[i].VAO;`,
  `glVertexAttribPointer(3..6, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), …)` and `glVertexAttribDivisor(3..6, 1)`; in the
  render loop `asteroidShader.use()` + `setMat4("projection"/"view")`, and after the planet `asteroidShader.setInt("texture_diffuse1", 0)`,
  `glBindTexture(GL_TEXTURE_2D, rock.textures_loaded[0].id)`, `glDrawElementsInstanced(…, amount)` per rock mesh;
  cleanup `glDeleteBuffers(1, &buffer); delete[] modelMatrices;`. **A flat band of grey rocks** across the planet's
  upper half (the ring of radius 15 seen from 3 units above its plane, so it looks like a band): rock pixels (grey ≈
  110–150, e.g. 134,130,126) only in x ≈ 151..645, y ≈ 279..321 (≈ 4,600 rock pixels outside the planet, most in rows
  285..319); (200,300) = 134,130,126, (600,300) = 139,135,131, (400,300) = 141,137,133 (a rock in front of the
  planet's top) – these three depend on the exact random numbers (glibc's `rand()` with seed 42; Windows' C library
  has another `rand()`, so the field looks different there – check counts/areas, not single pixels). The planet below
  the band is unchanged: (400,320) = 101,138,59, (355,340) = 28,70,150, (400,380) = 44,94,101; background (400,200),
  (100,100), (400,500) = 26,26,26; nothing outside y 270..400. Static. Final state.

  Why `srand(42)`: learnopengl seeds with `srand(static_cast<unsigned int>(glfwGetTime()))` – a different field each
  run (in practice the time is still 0 there, but that is chance). A fixed seed gives the same field every run, so the
  picture can be compared. learnopengl's 10.2 (one `rock.Draw` per rock, 500 draw calls) is described in the text only;
  learnopengl's 100,000 rocks / radius 150 are reduced to 500 / radius 15 for the simulator.
