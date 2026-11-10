# Cubemaps – tasks (OpenGL)

learnopengl "Cubemaps": `6.1.cubemaps_skybox` (`cubemaps_skybox.cpp`, `6.1.skybox.vs/.fs`) and
`6.2.cubemaps_environment_mapping` (`cubemaps_environment_mapping.cpp`, `6.2.cubemaps.vs/.fs`), plus the refraction of
the chapter text. Files: `main.cpp`, `shader_m.h`, `cubemaps.vs`, `cubemaps.fs` (the textured shaders of Depth Testing),
`skybox.vs`, `skybox.fs` (main is a TODO in both), `marble.png`, and the course's sky in `skybox/`: `right.png`,
`left.png`, `top.png`, `bottom.png`, `front.png`, `back.png` (+X, -X, +Y, -Y, +Z, -Z, 256×256 RGB: blue sky with clouds,
green chequered fields below the horizon).

Start: the Depth Testing scene **without the floor** (learnopengl draws only the cubes here): two marble cubes at
(-1, 0, -1) and (2, 0, 0), `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, camera globals cameraPos (0, 0, 3) looking
down -z, fov 45, clear colour (0.1, 0.1, 0.1). In the loop `model`, `view` and `projection` are computed first, then a
TODO (draw the skybox first), then the cubes. Other TODOs: after `Shader shader(...)` (the skybox shader), after
`cubeVertices` (the skybox's vertices), after the cube VAO (the skybox's VAO), after loading marble.png (load the cube
map), at the end of the file (the `loadCubemap` function).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Start picture: **background** (400,100), (30,150), (400,300), (100,500), (600,450) = 26,26,26; **cube0-centre** (193,300)
≈ 141,140,138, **cube0-light** (150,250) ≈ 208,204,194, **cube0-bottom** (193,390) ≈ 193,190,182, (300,250) ≈
192,189,181; **cube 1** (only its left face, at the right edge) (760,250) ≈ 168,165,159.

## `load-cubemap`
- **Task:** Load the six sky images into one cube map texture: write `loadCubemap(std::vector<std::string> faces)` (one `glTexImage2D` per face with `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`, linear filtering, `GL_CLAMP_TO_EDGE` on S, T and R) and call it with the files in the order right, left, top, bottom, front, back.
- **Hint:** The six face targets are consecutive numbers, so `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i` walks through +X, -X, +Y, -Y, +Z, -Z. Do not flip these images: call `stbi_set_flip_vertically_on_load(false)` first (loadTexture switched flipping on) – the cube map rule puts an image's first row at the top of its face. `#include <string>` and `<vector>`.
- **When done:** `#include <string>`, `#include <vector>`, the prototype `unsigned int loadCubemap(std::vector<std::string>
  faces);`, in main `std::vector<std::string> faces { "skybox/right.png", "skybox/left.png", "skybox/top.png",
  "skybox/bottom.png", "skybox/front.png", "skybox/back.png" }; unsigned int cubemapTexture = loadCubemap(faces);`,
  `glDeleteTextures(1, &cubemapTexture);` at the end, and learnopengl's `loadCubemap` at the end of the file:
  `glBindTexture(GL_TEXTURE_CUBE_MAP, textureID)`, `stbi_set_flip_vertically_on_load(false)`, a `for` loop with `stbi_load`
  and `glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data)`
  (printing `Cubemap texture failed to load at path: …` on failure), `GL_TEXTURE_MIN_FILTER`/`MAG_FILTER` `GL_LINEAR`,
  `GL_TEXTURE_WRAP_S`/`T`/`R` `GL_CLAMP_TO_EDGE`. **Nothing visible changes** (the cube map is not used yet): identical
  pixels.

## `skybox`
- **Task:** Draw the sky: a skybox cube (`skyboxVertices`, positions -1..1, its own VAO) with `skyboxShader` (`skybox.vs` / `skybox.fs`, `skybox` = unit 0), drawn first with depth writes off, using the view matrix without its translation.
- **Hint:** skybox.vs: `TexCoords = aPos; gl_Position = projection * view * vec4(aPos, 1.0);` (the direction from the cube's centre is the sample direction). skybox.fs: `FragColor = texture(skybox, TexCoords);`. In the loop: `glDepthMask(GL_FALSE);`, `skyboxShader.setMat4("view", glm::mat4(glm::mat3(view)));` (mat3 drops the translation: the sky moves with the camera), bind `skyboxVAO` and `GL_TEXTURE_CUBE_MAP` `cubemapTexture`, draw 36 vertices, `glDepthMask(GL_TRUE);`.
- **When done:** `Shader skyboxShader("skybox.vs", "skybox.fs");`, learnopengl's `skyboxVertices` (36 vertices, 3 floats),
  `skyboxVAO`/`skyboxVBO` (attribute 0, stride `3 * sizeof(float)`), `skyboxShader.use(); skyboxShader.setInt("skybox", 0);`,
  in the loop before the cubes: `glDepthMask(GL_FALSE); skyboxShader.use(); skyboxShader.setMat4("view",
  glm::mat4(glm::mat3(view))); skyboxShader.setMat4("projection", projection); glBindVertexArray(skyboxVAO);
  glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture); glDrawArrays(GL_TRIANGLES, 0, 36); glBindVertexArray(0);
  glDepthMask(GL_TRUE);`, the VAO/VBO deleted at the end; skybox.vs main `TexCoords = aPos; gl_Position = projection *
  view * vec4(aPos, 1.0);`, skybox.fs main `FragColor = texture(skybox, TexCoords);`. **The sky appears behind the
  cubes**, upright: blue sky with clouds above the horizon (y ≈ 300), green chequered fields below. **sky-top** (400,100)
  ≈ 127,164,219, (30,150) ≈ 146,179,225, (600,150) ≈ 172,197,232 (a cloud); **horizon** (400,300) ≈ 170,199,223 (light
  haze); **ground** (100,500) ≈ 82,130,54, (400,560) ≈ 85,132,56, (600,450) ≈ 95,140,60, (390,500) ≈ 70,120,50. The cubes
  are unchanged and in front of the sky: cube0-centre ≈ 141,140,138, cube0-light ≈ 208,204,194, cube 1 ≈ 168,165,159.

## `skybox-last`
- **Task:** learnopengl's optimisation: draw the skybox last, at the largest depth (`gl_Position = pos.xyww`), with the depth function `GL_LEQUAL` – then the sky is only drawn where nothing else is.
- **Hint:** In skybox.vs: `vec4 pos = projection * view * vec4(aPos, 1.0); gl_Position = pos.xyww;` (z / w = 1.0 after the perspective divide). Move the skybox's draw after the cubes, replace `glDepthMask(GL_FALSE)` by `glDepthFunc(GL_LEQUAL)` (depth 1.0 must pass against the cleared 1.0) and set `glDepthFunc(GL_LESS)` back afterwards.
- **When done:** the skybox block is after the cubes: `glDepthFunc(GL_LEQUAL); skyboxShader.use(); …
  glDrawArrays(GL_TRIANGLES, 0, 36); glBindVertexArray(0); glDepthFunc(GL_LESS);` (no `glDepthMask` calls any more);
  skybox.vs: `vec4 pos = projection * view * vec4(aPos, 1.0); gl_Position = pos.xyww;`. **Nothing visible changes**
  (Mesa: identical pixels to `skybox`).

## `reflection`
- **Task:** Make the cubes mirrors of the sky: give the cube vertices normals instead of texture coordinates (learnopengl's position + normal cube), and in cubemaps.vs/.fs reflect the view direction about the normal and sample the cube map with it (`reflect(I, normalize(Normal))`, `cameraPos` as a uniform).
- **Hint:** cubemaps.vs: `Normal = mat3(transpose(inverse(model))) * aNormal; Position = vec3(model * vec4(aPos, 1.0));`. cubemaps.fs: `vec3 I = normalize(Position - cameraPos); vec3 R = reflect(I, normalize(Normal)); FragColor = vec4(texture(skybox, R).rgb, 1.0);`. Attribute 1 is now 3 floats, stride `6 * sizeof(float)`. Bind `cubemapTexture` (GL_TEXTURE_CUBE_MAP) for the cubes, `shader.setInt("skybox", 0)`, `shader.setVec3("cameraPos", cameraPos)`. The marble texture is no longer needed.
- **When done:** `cubeVertices` = learnopengl's 36 vertices with positions + normals (`// positions // normals`, e.g.
  `-0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f`); `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float),
  (void*)0)` and `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)))`; the
  marble `loadTexture` call and its `glDeleteTextures` removed; `shader.setInt("skybox", 0);`;
  `shader.setVec3("cameraPos", cameraPos);` after the projection; the cubes bind
  `glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture)`; cubemaps.vs/.fs = learnopengl's 6.2 shaders (`out vec3 Normal;
  out vec3 Position;`, `uniform vec3 cameraPos; uniform samplerCube skybox;`, `reflect`). The **marble is gone: the cubes
  show the sky**. With the camera looking straight at them, their front faces mirror the sky behind the camera, which
  looks much like the sky behind the cubes, so the cubes are hard to see – only the clouds and the chequered ground do not
  line up at their edges: **cube0-centre** (193,300) ≈ 170,199,223 (horizon haze), **cube0-light** (150,250) ≈
  157,191,230 (sky), (300,250) ≈ 157,191,230, **cube0-bottom** (193,390) ≈ 106,148,100 (ground), **cube 1** (760,250) ≈
  158,192,230. The sky around them is unchanged: (400,100) ≈ 127,164,219, (100,500) ≈ 82,130,54.

## `refraction`
- **Task:** Make the cubes glass instead of mirrors: refract the view direction with the ratio 1.00 / 1.52 (air to glass).
- **Hint:** `float ratio = 1.00 / 1.52; vec3 R = refract(I, normalize(Normal), ratio);` instead of `reflect`.
- **When done:** cubemaps.fs main: `float ratio = 1.00 / 1.52; vec3 I = normalize(Position - cameraPos);
  vec3 R = refract(I, normalize(Normal), ratio); FragColor = vec4(texture(skybox, R).rgb, 1.0);`. The cubes look like
  **glass blocks**: they show the sky behind them magnified (the horizon band is wider, the cubes' outlines are visible
  as slightly lighter squares): **cube0-centre** ≈ 171,200,223, **cube0-light** (150,250) ≈ 163,196,232, (300,250) ≈
  164,197,232, **cube0-bottom** (193,390) ≈ 132,168,142 (the haze above the ground, was 106,148,100), **cube 1** ≈
  163,196,232. The sky around them is unchanged. Final state.

  Note: learnopengl's sky makes the effect obvious when you move the camera (WASD / mouse); with the default camera the
  difference to `reflection` is small but visible at cube0-bottom.
